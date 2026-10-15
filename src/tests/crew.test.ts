import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { crewRevision, depthOf, topoOrder } from '../domain/crew';

import { MemoryAdapter } from '../persistence/storage';
import { CrewService } from '../runtime/crew/service';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';

// A Crew run end to end with fake agents: the coordinator plans, members work in dependency order
// (in parallel when they can), the reviewer asks for changes once, the coordinator assembles, the
// user approves. Every step is an ordinary agent task.

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: true, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const tick = () => new Promise((r) => setImmediate(r));
const until = async (cond: () => boolean, n = 800) => {
  for (let i = 0; i < n && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

const PEOPLE: Record<string, { name: string; world: string }> = {
  hana: { name: 'Hana', world: 'office' },
  priya: { name: 'Priya', world: 'office' },
  kenji: { name: 'Kenji', world: 'office' },
  lena: { name: 'Lena', world: 'office' },
  zoe: { name: 'Zoe', world: 'farm' },
};

const PLAN = {
  tasks: [
    { id: 'T1', title: 'Competitor scan', assignee: 'Priya', instructions: 'Find the three main competitors.', deliverable: 'a table', dependsOn: [], review: true },
    { id: 'T2', title: 'Launch copy', assignee: 'kenji', instructions: 'Write the landing copy.', dependsOn: ['T1'], review: true },
    { id: 'T3', title: 'Asset brief', assignee: 'Lena', instructions: 'Brief the visuals.', dependsOn: ['T1'], review: false },
  ],
};

/** the agents: what each prompt gets back (holds until cancelled when the task says HOLD) */
class Agents implements AIProvider {
  readonly id = 'claude-code';
  readonly name = 'Fake';
  readonly capabilities = CAPS;
  prompts: { who: string; text: string }[] = [];
  reviews = new Map<string, number>();
  constructor(private o: { plan?: unknown; fail?: (text: string) => boolean } = {}) {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    const text = req.messages.at(-1)!.content;
    const who = /You are (\w+)/.exec(req.systemPrompt ?? '')?.[1] ?? '?';
    this.prompts.push({ who, text });
    let seq = 0;
    const out = (b: ProviderEventBody) => ({ ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 }) as ProviderEvent;
    yield out({ type: 'provider.started' });
    await tick();
    if (text.includes('HOLD')) {
      await new Promise<void>((r) => (req.abortSignal?.aborted ? r() : req.abortSignal?.addEventListener('abort', () => r())));
      yield out({ type: 'run.cancelled', reason: 'Cancelled.' });
      return;
    }
    if (this.o.fail?.(text)) {
      yield out({ type: 'run.failed', error: { code: 'unknown', message: 'model down' } });
      return;
    }
    let answer: string;
    if (text.includes('coordinator of a crew')) answer = `Here is the plan: ${JSON.stringify(this.o.plan ?? PLAN)}`;
    else if (text.includes('You are the reviewer')) {
      const id = /Task (T\d+)/.exec(text)![1];
      const n = (this.reviews.get(id) ?? 0) + 1;
      this.reviews.set(id, n);
      answer = id === 'T2' && n === 1 ? '{"verdict": "changes", "notes": "Make the headline shorter."}' : '{"verdict": "approve", "notes": "Good."}';
    } else if (text.includes('Assemble the final deliverable')) answer = `FINAL by ${who}${text.includes('Their feedback') ? ' (revised)' : ''}`;
    else {
      const id = /Your task \((T\d+)\)/.exec(text)![1];
      answer = `${id} by ${who}${text.includes('Reviewer\'s notes') ? ' v2' : ''}`;
    }
    yield out({ type: 'run.completed', text: answer });
  }
}

function setup(agents = new Agents(), storage = new MemoryAdapter()) {
  const bus = new EventBus(5000);
  const providers = new ProviderService(new ProviderRegistry().register(agents), bus);
  let n = 0;
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 50), { identity: (id) => ({ name: PEOPLE[id]?.name ?? id, role: '' }), newId: (k) => `${k}-${++n}` });
  const kept: string[] = [];
  const crews = new CrewService(storage, bus, live, {
    name: (id) => PEOPLE[id]?.name,
    worldOf: (id) => PEOPLE[id]?.world,
    keep: async (o) => (kept.push(o.name), `art-${kept.length}`),
    kickoffMs: 0,
  });
  const events: string[] = [];
  bus.on('agent.handoff', (p) => events.push(`handoff ${p.from}→${p.to}`));
  bus.on('agent.meeting.started', (p) => events.push(`meet ${p.agentId}`));
  return { bus, live, crews, agents, kept, events, storage };
}

const LAUNCH = { name: 'Product Launch', worldId: 'office', goal: 'Prepare the product launch', coordinatorId: 'hana', reviewerId: 'lena', members: [{ agentId: 'hana', role: 'Coordinator' }, { agentId: 'priya', role: 'Research', duty: 'competitors and market' }, { agentId: 'kenji', role: 'Copy' }, { agentId: 'lena', role: 'Design + Review' }], brief: 'Our product: Aurora, a note app.' };

describe('Crew: definitions and the graph', () => {
  it('a crew lives in one world; the coordinator and reviewer are members', async () => {
    const { crews } = setup();
    await crews.init();
    expect(() => crews.create({ ...LAUNCH, members: [...LAUNCH.members, { agentId: 'zoe', role: 'Farm' }] })).toThrow(/not in this crew's world/);
    expect(() => crews.create({ ...LAUNCH, coordinatorId: 'zoe' })).toThrow(/coordinator must be a member/);
    expect(() => crews.create({ ...LAUNCH, name: ' ' })).toThrow(/name/);
    const c = crews.create(LAUNCH);
    expect(c.members.map((m) => m.role)).toEqual(['Coordinator', 'Research', 'Copy', 'Design + Review']);
    expect(topoOrder([{ id: 'A', dependsOn: ['B'] }, { id: 'B', dependsOn: ['A'] }])).toBeUndefined();
    expect([...depthOf([{ id: 'T1', dependsOn: [] }, { id: 'T2', dependsOn: ['T1'] }, { id: 'T3', dependsOn: ['T1', 'T2'] }]).values()]).toEqual([0, 1, 2]);
  });
});

describe('Crew: a run', () => {
  it('plan → approve → work in order (in parallel) → review with changes → assemble → feedback → approve', async () => {
    const { crews, live, agents, kept, events } = setup();
    await crews.init();
    const crew = crews.create(LAUNCH);
    const run = crews.start(crew.id);
    expect(run.status).toBe('planning');
    await until(() => crews.run(run.id)!.status === 'awaiting_plan');
    const r = crews.run(run.id)!;
    expect(r.plan.map((t) => `${t.id}:${t.assigneeId}:${t.dependsOn.join('+')}:${t.review}`)).toEqual(['T1:priya::true', 'T2:kenji:T1:true', 'T3:lena:T1:false']);
    // the coordinator's plan was an agent task of theirs, marked with the crew
    const planTask = live.tasksOf('hana')[0];
    expect(planTask.crew).toMatchObject({ crewId: crew.id, runId: run.id, kind: 'plan' });
    // the user edits a title, then starts
    crews.setPlan(run.id, r.plan.map((t) => (t.id === 'T3' ? { ...t, title: 'Visual brief' } : t)));
    expect(() => crews.setPlan(run.id, [{ ...r.plan[0], dependsOn: ['T9'] }])).toThrow(/loop|does not exist/);
    crews.approvePlan(run.id);
    expect(events.filter((e) => e.startsWith('meet'))).toEqual(['meet hana', 'meet priya', 'meet kenji', 'meet lena']);
    await until(() => crews.run(run.id)!.status === 'awaiting_approval');
    const done = crews.run(run.id)!;
    expect(done.plan.map((t) => `${t.id}:${t.status}:${t.output}`)).toEqual(['T1:done:T1 by Priya', 'T2:done:T2 by Kenji v2', 'T3:done:T3 by Lena']);
    // T2 was reviewed twice (changes, then approve) and revised once
    const t2 = done.plan[1];
    expect(t2.attempts.map((a) => `${a.kind}:${a.agentId}:${a.verdict ?? ''}`)).toEqual(['work:kenji:', 'review:lena:changes', 'revision:kenji:', 'review:lena:approve']);
    expect(t2.revisions).toBe(1);
    // hand-offs: T2 and T3 got T1's output (and only theirs), the revision got the notes
    const t2prompt = agents.prompts.find((p) => p.who === 'Kenji' && p.text.includes('Your task (T2)'))!.text;
    expect(t2prompt).toContain('Output of "Competitor scan" by Priya');
    expect(t2prompt).toContain('T1 by Priya');
    expect(t2prompt).toContain('Our product: Aurora');
    expect(t2prompt).not.toContain('T3 by Lena');
    expect(agents.prompts.find((p) => p.text.includes("Reviewer's notes: Make the headline shorter."))?.who).toBe('Kenji');
    expect(events).toContain('handoff priya→kenji');
    expect(events).toContain('handoff kenji→lena');
    // outputs kept as Artifacts, then the final
    expect(done.final).toMatchObject({ text: 'FINAL by Hana' });
    expect(kept).toEqual(expect.arrayContaining(['Product Launch T1 Competitor scan.md', 'Product Launch T2 Launch copy.md', 'Product Launch final.md']));
    expect(done.plan.every((t) => t.artifactId)).toBe(true);
    // the user asks for changes, then approves
    crews.requestChanges(run.id, 'Add a timeline.');
    await until(() => crews.run(run.id)!.status === 'awaiting_approval' && crews.run(run.id)!.final!.text.includes('revised'));
    crews.approveFinal(run.id);
    expect(crews.run(run.id)!.status).toBe('done');
    expect(crews.run(run.id)!.history.map((h) => h.kind)).toEqual(expect.arrayContaining(['plan', 'approve', 'kickoff', 'start', 'handoff', 'output', 'review', 'changes', 'assemble', 'final', 'feedback', 'done']));
  });

  it('a failed task blocks what depends on it; retry or skip goes on', async () => {
    let failing = true;
    const agents = new Agents({ fail: (text) => failing && text.includes('Your task (T1)') });
    const { crews } = setup(agents);
    await crews.init();
    const crew = crews.create({ ...LAUNCH, reviewerId: undefined });
    const run = crews.start(crew.id);
    await until(() => crews.run(run.id)!.status === 'awaiting_plan');
    crews.approvePlan(run.id);
    await until(() => crews.run(run.id)!.plan[0].status === 'failed');
    await until(() => crews.run(run.id)!.plan[1].status === 'blocked');
    expect(crews.run(run.id)!.plan.map((t) => t.status)).toEqual(['failed', 'blocked', 'blocked']);
    // review is off without a reviewer
    expect(crews.run(run.id)!.plan.every((t) => !t.review)).toBe(true);
    failing = false;
    crews.retryTask(run.id, 'T1');
    await until(() => crews.run(run.id)!.status === 'awaiting_approval');
    expect(crews.run(run.id)!.plan.map((t) => t.status)).toEqual(['done', 'done', 'done']);
  });

  it('cancel stops the agents; a run interrupted by a restart resumes', async () => {
    const plan = { tasks: [{ id: 'T1', title: 'HOLD long research', assignee: 'Priya', instructions: 'HOLD', dependsOn: [] }, { id: 'T2', title: 'Copy', assignee: 'Kenji', instructions: 'Write', dependsOn: ['T1'] }] };
    const storage = new MemoryAdapter();
    const a = setup(new Agents({ plan }), storage);
    await a.crews.init();
    const crew = a.crews.create(LAUNCH);
    const run = a.crews.start(crew.id);
    await until(() => a.crews.run(run.id)!.status === 'awaiting_plan');
    a.crews.approvePlan(run.id);
    await until(() => !!a.live.activeRun('priya'));
    // a restart while T1 runs: a new service over the same storage
    const b = setup(new Agents({ plan: { tasks: [{ ...plan.tasks[0], instructions: 'quick now' }, plan.tasks[1]] } }), storage);
    await b.crews.init();
    expect(b.crews.run(run.id)!.status).toBe('interrupted');
    expect(b.crews.run(run.id)!.plan[0]).toMatchObject({ status: 'waiting', note: 'interrupted' });
    // the stored task still holds its HOLD text; resume restarts it with the run's own prompt
    b.crews.run(run.id)!.plan[0].instructions = 'quick now';
    b.crews.run(run.id)!.plan[0].title = 'Research';
    b.crews.resume(run.id);
    await until(() => b.crews.run(run.id)!.status === 'awaiting_approval');
    // cancel, on the first service: its running crew task stops
    await a.crews.cancel(run.id);
    await until(() => !a.live.activeRun('priya'));
    expect(a.crews.run(run.id)!.status).toBe('cancelled');
    expect(a.crews.run(run.id)!.plan[0].status).toBe('cancelled');
  });
});

// docs/HARDENING.md R-7, R-8, R-9, I-6
describe('Crew: hardening', () => {
  it('I-6: an approval made for an older plan or final result is refused', async () => {
    const { crews } = setup();
    await crews.init();
    const crew = crews.create(LAUNCH);
    const run = crews.start(crew.id);
    await until(() => crews.run(run.id)!.status === 'awaiting_plan');
    const seen = crewRevision(crews.run(run.id)!, 'plan');
    // the plan changes after the user saw it (edited on the desktop)
    crews.setPlan(run.id, crews.run(run.id)!.plan.map((t) => (t.id === 'T3' ? { ...t, assigneeId: 'kenji' } : t)));
    expect(() => crews.approvePlan(run.id, seen)).toThrow(/plan changed/);
    expect(crews.run(run.id)!.status).toBe('awaiting_plan');
    crews.approvePlan(run.id, crewRevision(crews.run(run.id)!, 'plan'));
    await until(() => crews.run(run.id)!.status === 'awaiting_approval');
    const final = crewRevision(crews.run(run.id)!, 'final');
    crews.requestChanges(run.id, 'Add a timeline.');
    await until(() => crews.run(run.id)!.status === 'awaiting_approval' && crews.run(run.id)!.final!.text.includes('revised'));
    expect(() => crews.approveFinal(run.id, final)).toThrow(/final result changed/);
    crews.approveFinal(run.id, crewRevision(crews.run(run.id)!, 'final'));
    expect(crews.run(run.id)!.status).toBe('done');
  });

  it('R-9: changes asked while the coordinator is busy are kept and used when they are free', async () => {
    const { crews, live } = setup();
    await crews.init();
    const crew = crews.create({ ...LAUNCH, reviewerId: undefined });
    const run = crews.start(crew.id);
    await until(() => crews.run(run.id)!.status === 'awaiting_plan');
    crews.approvePlan(run.id);
    await until(() => crews.run(run.id)!.status === 'awaiting_approval');
    live.startTask('hana', { prompt: 'HOLD something else' });
    crews.requestChanges(run.id, 'Add a timeline.');
    expect(crews.run(run.id)!.final!.feedback).toBe('Add a timeline.');
    await live.cancel('hana');
    await until(() => crews.run(run.id)!.status === 'awaiting_approval');
    expect(crews.run(run.id)!.final!.text).toBe('FINAL by Hana (revised)');
  });

  it('R-8: a crew stopped while its final result was being kept stays stopped', async () => {
    const bus = new EventBus(5000);
    const providers = new ProviderService(new ProviderRegistry().register(new Agents()), bus);
    const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 50), { identity: (id) => ({ name: PEOPLE[id]?.name ?? id, role: '' }) });
    let release: () => void = () => undefined;
    const keeping: string[] = [];
    const crews = new CrewService(new MemoryAdapter(), bus, live, {
      name: (id) => PEOPLE[id]?.name,
      worldOf: (id) => PEOPLE[id]?.world,
      keep: (o) => (keeping.push(o.name), o.name.endsWith('final.md') ? new Promise<string>((r) => (release = () => r('art-final'))) : Promise.resolve('art')),
      kickoffMs: 0,
    });
    await crews.init();
    const crew = crews.create({ ...LAUNCH, reviewerId: undefined });
    const run = crews.start(crew.id);
    await until(() => crews.run(run.id)!.status === 'awaiting_plan');
    crews.approvePlan(run.id);
    await until(() => keeping.includes('Product Launch final.md'));
    await crews.cancel(run.id);
    release();
    await until(() => crews.run(run.id)!.final?.artifactId === 'art-final');
    expect(crews.run(run.id)!.status).toBe('cancelled');
  });

  it('R-7: open crew runs are never pruned; with every place open a new run is refused', async () => {
    const { crews } = setup();
    await crews.init();
    const crew = crews.create(LAUNCH);
    const first = crews.start(crew.id);
    for (let i = 1; i < 40; i++) crews.start(crew.id);
    expect(() => crews.start(crew.id)).toThrow(/crew runs open/);
    await crews.cancel(first.id);
    const next = crews.start(crew.id);
    expect(crews.run(first.id)).toBeUndefined();
    expect(crews.runsOf()).toHaveLength(40);
    expect(crews.runsOf().every((r) => r.status !== 'cancelled')).toBe(true);
    expect(crews.run(next.id)).toBeDefined();
    for (const r of crews.runsOf()) await crews.cancel(r.id);
  });
});

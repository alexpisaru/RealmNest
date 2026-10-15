import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { ToolDefinition } from '../domain/tool';
import type { Schedule, WorkflowDefinition, WorkflowNode, WorkflowRun } from '../domain/workflow';
import { MemoryAdapter } from '../persistence/storage';
import { CrewService } from '../runtime/crew/service';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';
import { checkDefinition, renderTemplate, WorkflowLibrary } from '../runtime/workflow/library';
import { Orchestrator, type ToolRunner } from '../runtime/workflow/orchestrator';
import { dueTimes, nextTime, parseCron, Scheduler } from '../runtime/workflow/scheduler';
import { ToolPolicyStore } from '../runtime/tools/policy';
import { ToolRegistry } from '../runtime/tools/registry';
import { ToolRuntime } from '../runtime/tools/runtime';

// Workflow (what), Scheduler (when), Orchestrator (how), kept apart. Agents answer from their
// prompt: "SAY x" → x, "FAIL n" → fails the first n times, "HOLD" → waits until cancelled.

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: true, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const tick = () => new Promise((r) => setImmediate(r));
const until = async (cond: () => boolean, n = 600) => {
  for (let i = 0; i < n && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

class Agents implements AIProvider {
  readonly id = 'claude-code';
  readonly name = 'Fake';
  readonly capabilities = CAPS;
  fails = new Map<string, number>();
  prompts: string[] = [];
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    const text = req.messages.at(-1)!.content;
    this.prompts.push(text);
    let seq = 0;
    const out = (b: ProviderEventBody) => ({ ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 }) as ProviderEvent;
    yield out({ type: 'provider.started' });
    await tick();
    if (text.includes('HOLD')) {
      await new Promise<void>((r) => (req.abortSignal?.aborted ? r() : req.abortSignal?.addEventListener('abort', () => r())));
      yield out({ type: 'run.cancelled', reason: 'Cancelled.' });
      return;
    }
    const f = /FAIL (\d)/.exec(text);
    if (f) {
      const n = this.fails.get(text) ?? 0;
      this.fails.set(text, n + 1);
      if (n < Number(f[1])) {
        yield out({ type: 'run.failed', error: { code: 'unknown', message: 'model down' } });
        return;
      }
    }
    if (text.includes('Answer with JSON only: {"answer"')) {
      yield out({ type: 'run.completed', text: text.includes('good news') ? '{"answer": "yes"}' : '{"answer": "no"}', usage: { inputTokens: 10, outputTokens: 2 } });
      return;
    }
    if (text.includes('coordinator of a crew')) {
      yield out({ type: 'run.completed', text: JSON.stringify({ tasks: [{ id: 'T1', title: 'Scan', assignee: 'bob', instructions: 'Scan.', dependsOn: [], review: false }] }) });
      return;
    }
    if (text.includes('Assemble the final deliverable')) {
      yield out({ type: 'run.completed', text: 'CREW FINAL' });
      return;
    }
    const say = /SAY (.+)/.exec(text)?.[1] ?? 'ok';
    yield out({ type: 'run.completed', text: say, usage: { inputTokens: 100, outputTokens: 50 }, costUsd: 0.01 });
  }
}

function setup(o: { storage?: MemoryAdapter; tools?: ToolRunner; now?: () => number; crews?: boolean; crewStorage?: MemoryAdapter } = {}) {
  const bus = new EventBus(5000);
  const agents = new Agents();
  const providers = new ProviderService(new ProviderRegistry().register(agents), bus);
  let n = 0;
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 50), { identity: (id) => ({ name: id, role: '' }), newId: (k) => `${k}-${++n}` });
  const kept: { name: string; text: string }[] = [];
  const storage = o.storage ?? new MemoryAdapter();
  const crews = o.crews ? new CrewService(o.crewStorage ?? new MemoryAdapter(), bus, live, { name: (id) => id, worldOf: () => 'office', keep: async () => 'crew-art', kickoffMs: 0 }) : undefined;
  const orch = new Orchestrator(storage, bus, live, { keep: async (x) => (kept.push(x), `art-${kept.length}`), ...(o.tools && { tools: o.tools }), ...(o.now && { now: o.now }), ...(crews && { crews }) });
  return { bus, live, agents, orch, kept, storage, crews };
}

const def = (nodes: WorkflowNode[], edges: WorkflowDefinition['edges'], more: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({ id: 'wf-1', name: 'Test', version: 1, inputs: [{ name: 'topic' }], nodes, edges, policies: {}, createdAt: 0, updatedAt: 0, ...more });
const agent = (id: string, prompt: string, policy?: WorkflowNode['policy']): WorkflowNode => ({ id, title: id, config: { kind: 'agent', agentId: 'ann', prompt }, ...(policy && { policy }) });
const done = (r: WorkflowRun) => ['completed', 'failed', 'cancelled'].includes(r.status);

describe('Workflow definitions (what)', () => {
  it('are checked: ids, branches, loops, required fields; templates fill in', () => {
    const ok = checkDefinition({ name: 'W', inputs: [], nodes: [agent('a', 'x'), { id: 'c', title: 'c', config: { kind: 'condition', test: 'contains', source: '{{node.a.output}}', value: 'y' } }, agent('b', 'y')], edges: [{ from: 'a', to: 'c' }, { from: 'c', to: 'b', when: 'true' }], policies: { budgetTokens: 1000 } });
    expect(ok.edges[1]).toEqual({ from: 'c', to: 'b', when: 'true' });
    expect(() => checkDefinition({ ...ok, edges: [{ from: 'a', to: 'b', when: 'true' }] })).toThrow(/needs a condition/);
    expect(() => checkDefinition({ ...ok, edges: [{ from: 'a', to: 'c' }, { from: 'c', to: 'a' }] })).toThrow(/loop/);
    expect(() => checkDefinition({ ...ok, nodes: [agent('a', 'x'), agent('a', 'y')], edges: [] })).toThrow(/Two nodes/);
    expect(() => checkDefinition({ ...ok, nodes: [{ id: 'a', title: 'a', config: { kind: 'agent', agentId: '', prompt: 'x' } }], edges: [] })).toThrow(/the agent is missing/);
    expect(() => checkDefinition(ok, { agent: () => false })).toThrow(/no longer exists/);
    expect(renderTemplate('{{input.topic}} / {{node.a.output}} / {{node.c.value}} / {{nope}} / {{date}}', { inputs: { topic: 'Vocella' }, node: (id) => (id === 'a' ? { output: 'A!' } : { value: 'true' }), now: Date.UTC(2026, 9, 15) })).toBe('Vocella / A! / true /  / 2026-10-15');
  });

  it('the library versions every save', async () => {
    const lib = new WorkflowLibrary(new MemoryAdapter());
    await lib.init();
    const w = lib.create({ name: 'W', inputs: [], nodes: [agent('a', 'x')], edges: [], policies: {} });
    expect(w.version).toBe(1);
    expect(lib.update(w.id, { ...w, name: 'W2' }).version).toBe(2);
  });
});

describe('Scheduler (when): it only creates runs', () => {
  it('next times: once, interval, daily, weekly, cron', () => {
    const t = new Date(2026, 9, 15, 8, 30).getTime(); // Thursday 08:30
    expect(nextTime({ kind: 'once', at: t + 1000 }, t)).toBe(t + 1000);
    expect(nextTime({ kind: 'once', at: t - 1000 }, t)).toBeUndefined();
    expect(nextTime({ kind: 'interval', everyMinutes: 60 }, t, t - 30 * 60_000)).toBe(t + 30 * 60_000);
    expect(new Date(nextTime({ kind: 'daily', time: '09:00' }, t)!).getHours()).toBe(9);
    expect(new Date(nextTime({ kind: 'daily', time: '08:00' }, t)!).getDate()).toBe(16);
    const mon = new Date(nextTime({ kind: 'weekly', days: [1], time: '09:00' }, t)!);
    expect([mon.getDay(), mon.getDate(), mon.getHours()]).toEqual([1, 19, 9]);
    const cron = new Date(nextTime({ kind: 'cron', expr: '*/15 9-17 * * 1-5' }, t)!);
    expect([cron.getDate(), cron.getHours(), cron.getMinutes()]).toEqual([15, 9, 0]);
    expect(parseCron('61 * * * *')).toBeUndefined();
    expect(dueTimes({ kind: 'daily', time: '09:00' }, t, t + 3 * 86_400_000)).toHaveLength(3);
  });

  it('due → a run is created (nothing executed by the scheduler); missed while closed → caught up once and reported', async () => {
    let now = new Date(2026, 9, 12, 8, 0).getTime(); // Monday
    const storage = new MemoryAdapter();
    const created: { trigger: string; missed?: number }[] = [];
    const definition = def([agent('a', 'SAY hi')], []);
    const deps = { definition: () => definition, createRun: (_d: WorkflowDefinition, _i: Record<string, string>, trigger: { kind: string; missed?: number }) => (created.push({ trigger: trigger.kind, missed: trigger.missed }), {} as WorkflowRun), now: () => now };
    const s1 = new Scheduler(storage, deps);
    await s1.init();
    const sc = s1.create({ name: 'Morning', workflowId: 'wf-1', inputs: {}, trigger: { kind: 'daily', time: '09:00' }, enabled: true, catchUp: 'once' });
    expect(new Date(sc.nextAt!).getHours()).toBe(9);
    now += 90 * 60_000; // 09:30
    await s1.tick();
    expect(created).toEqual([{ trigger: 'schedule', missed: undefined }]);
    s1.dispose();
    // RealmNest closed for three days: on start, one catch-up run for the three missed mornings
    now += 3 * 86_400_000;
    const s2 = new Scheduler(storage, deps);
    await s2.init();
    expect(created.at(-1)).toEqual({ trigger: 'catchup', missed: 3 });
    expect(s2.get(sc.id)!.missed).toMatchObject({ count: 3, created: 1 });
    expect(new Date(s2.get(sc.id)!.missed!.at).getHours()).toBe(9);
    expect(new Date(s2.get(sc.id)!.nextAt!).getDate()).toBe(16);
    s2.seenMissed(sc.id);
    expect(s2.missedUnseen()).toEqual([]);
    s2.dispose();
    // with "skip" nothing is created, the miss is still reported
    s2.update(sc.id, { ...s2.get(sc.id)!, catchUp: 'skip' });
    now += 2 * 86_400_000;
    const before = created.length;
    const s3 = new Scheduler(storage, deps);
    await s3.init();
    expect(created.length).toBe(before);
    expect(s3.get(sc.id)!.missed).toMatchObject({ count: 2, created: 0 });
    s3.dispose();
    // a one-time schedule missed while closed: caught up, then off
    const once = s3.create({ name: 'Once', workflowId: 'wf-1', inputs: {}, trigger: { kind: 'once', at: now + 60_000 }, enabled: true, catchUp: 'once' });
    s3.dispose();
    now += 3_600_000;
    const s4 = new Scheduler(storage, deps);
    await s4.init();
    expect(created.at(-1)).toEqual({ trigger: 'catchup', missed: 1 });
    expect(s4.get(once.id)).toMatchObject({ enabled: false, missed: { count: 1, created: 1 } });
    s4.dispose();
  });
});

describe('Orchestrator (how)', () => {
  it('runs in order, follows the branch the condition took, skips the other, keeps the output; counts the budget', async () => {
    const { orch, kept, agents } = setup();
    await orch.init();
    const d = def(
      [
        agent('research', 'SAY good news about {{input.topic}}'),
        { id: 'check', title: 'Good?', config: { kind: 'condition', test: 'contains', source: '{{node.research.output}}', value: 'good news' } },
        agent('celebrate', 'SAY yay: {{node.research.output}}'),
        agent('worry', 'SAY hmm'),
        { id: 'save', title: 'Save', config: { kind: 'output', name: '{{input.topic}}.md', content: 'Result: {{node.celebrate.output}}' } },
      ],
      [
        { from: 'research', to: 'check' },
        { from: 'check', to: 'celebrate', when: 'true' },
        { from: 'check', to: 'worry', when: 'false' },
        { from: 'celebrate', to: 'save' },
      ],
    );
    const r = orch.create(d, { topic: 'Vocella' });
    await until(() => done(orch.get(r.id)!));
    const x = orch.get(r.id)!;
    expect(x.status).toBe('completed');
    expect(Object.values(x.nodes).map((n) => `${n.nodeId}:${n.status}:${n.value ?? ''}`)).toEqual(['research:completed:', 'check:completed:true', 'celebrate:completed:', 'worry:skipped:', 'save:completed:']);
    expect(kept).toEqual([{ name: 'Vocella.md', text: 'Result: yay: good news about Vocella', runId: r.id, nodeId: 'save' }]);
    expect(x.artifacts).toEqual(['art-1']);
    expect(x.budget.tokens).toBe(300);
    expect(agents.prompts).toContain('SAY good news about Vocella');
    // the run kept its own copy of the definition
    expect(x.definition).not.toBe(d);
    expect(orch.inbox().map((y) => y.id)).toEqual([r.id]);
    orch.markSeen(r.id);
    expect(orch.inbox()).toEqual([]);
    orch.dispose();
  });

  it('parallel branches meet at a merge (all), and an agent decides a condition', async () => {
    const { orch } = setup();
    await orch.init();
    const d = def(
      [
        { id: 'split', title: 'split', config: { kind: 'parallel' } },
        { ...agent('a', 'SAY A'), config: { kind: 'agent', agentId: 'ann', prompt: 'SAY A' } },
        { id: 'b', title: 'b', config: { kind: 'agent', agentId: 'bob', prompt: 'SAY B' } },
        { id: 'join', title: 'join', config: { kind: 'merge', mode: 'all' } },
        { id: 'judge', title: 'judge', config: { kind: 'condition', test: 'agent', agentId: 'ann', source: '{{node.join.output}}', question: 'Is it positive?' } },
      ],
      [
        { from: 'split', to: 'a' },
        { from: 'split', to: 'b' },
        { from: 'a', to: 'join' },
        { from: 'b', to: 'join' },
        { from: 'join', to: 'judge' },
      ],
    );
    const r = orch.create(d);
    await until(() => done(orch.get(r.id)!));
    const x = orch.get(r.id)!;
    expect(x.nodes.join).toMatchObject({ status: 'completed', output: 'A\n\nB' });
    expect(x.nodes.judge).toMatchObject({ status: 'completed', value: 'false' });
    orch.dispose();
  });

  it('retries with backoff (a durable timer), then the policy decides: fail, continue or skip', async () => {
    let now = 1_000_000;
    const { orch } = setup({ now: () => now });
    await orch.init();
    const r = orch.create(def([agent('flaky', 'FAIL 1 then SAY fine', { retries: 2, backoffMinutes: 5 }), agent('after', 'SAY after')], [{ from: 'flaky', to: 'after' }]));
    await until(() => orch.get(r.id)!.nodes.flaky.status === 'waiting');
    expect(orch.get(r.id)!.nodes.flaky.wakeAt).toBe(now + 5 * 60_000);
    now += 5 * 60_000;
    orch.tick();
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.status).toBe('completed');
    expect(orch.get(r.id)!.nodes.flaky.attempts).toBe(2);
    // no retries left: continue lets the next node run with the error as input; skip skips it
    const r2 = orch.create(def([agent('bad', 'FAIL 9', { onFail: 'continue' }), agent('next', 'SAY got {{node.bad.output}}'), agent('bad2', 'FAIL 8', { onFail: 'skip' }), agent('next2', 'SAY never')], [{ from: 'bad', to: 'next' }, { from: 'bad2', to: 'next2' }]));
    await until(() => done(orch.get(r2.id)!));
    const x = orch.get(r2.id)!;
    expect(x.status).toBe('completed');
    expect(x.nodes.next.output).toBe('got ERROR: model down');
    expect([x.nodes.bad2.status, x.nodes.next2.status]).toEqual(['skipped', 'skipped']);
    // and the default: the run fails
    const r3 = orch.create(def([agent('bad', 'FAIL 7')], []));
    await until(() => done(orch.get(r3.id)!));
    expect(orch.get(r3.id)!).toMatchObject({ status: 'failed', error: 'bad failed: model down' });
    // you give up on the node: it counts as skipped and the run closes
    orch.skipNode(r3.id, 'bad');
    await until(() => done(orch.get(r3.id)!));
    expect(orch.get(r3.id)!.status).toBe('completed');
    orch.dispose();
  });

  it('an approval suspends the run until you decide; a rejected branch is skipped', async () => {
    const { orch } = setup();
    await orch.init();
    const d = def(
      [agent('draft', 'SAY the draft'), { id: 'ok', title: 'Publish?', config: { kind: 'approval', prompt: 'Publish {{node.draft.output}}?' } }, agent('publish', 'SAY published'), agent('fix', 'SAY fixed')],
      [{ from: 'draft', to: 'ok' }, { from: 'ok', to: 'publish', when: 'approved' }, { from: 'ok', to: 'fix', when: 'rejected' }],
    );
    const r = orch.create(d);
    await until(() => orch.get(r.id)!.status === 'awaiting_approval');
    expect(orch.get(r.id)!.nodes.ok.prompt).toBe('Publish the draft?');
    expect(orch.inbox().map((x) => x.id)).toContain(r.id);
    orch.decide(r.id, 'ok', 'rejected');
    await until(() => done(orch.get(r.id)!));
    expect([orch.get(r.id)!.nodes.publish.status, orch.get(r.id)!.nodes.fix.status]).toEqual(['skipped', 'completed']);
    orch.dispose();
  });

  it('durable: a wait survives a restart; a node that was running is interrupted and the run suspended until Resume', async () => {
    let now = 5_000_000;
    const storage = new MemoryAdapter();
    const a = setup({ storage, now: () => now });
    await a.orch.init();
    const r = a.orch.create(def([{ id: 'pause', title: 'pause', config: { kind: 'wait', mode: 'duration', minutes: 60 } }, agent('then', 'SAY after the wait')], [{ from: 'pause', to: 'then' }]));
    expect(a.orch.get(r.id)!.status).toBe('waiting');
    const held = a.orch.create(def([agent('long', 'HOLD')], []));
    await until(() => a.orch.get(held.id)!.nodes.long.status === 'running');
    await a.orch.flush();
    a.orch.dispose();
    // a restart, an hour later
    now += 61 * 60_000;
    const b = setup({ storage, now: () => now });
    await b.orch.init();
    await until(() => done(b.orch.get(r.id)!));
    expect(b.orch.get(r.id)!.nodes.then.output).toBe('after the wait');
    const s = b.orch.get(held.id)!;
    expect([s.status, s.nodes.long.status]).toEqual(['suspended', 'interrupted']);
    expect(b.orch.inbox().map((x) => x.id)).toContain(held.id);
    // the agent's task text was HOLD; resume runs the node again (here it answers at once)
    s.definition.nodes[0].config = { kind: 'agent', agentId: 'ann', prompt: 'SAY resumed' };
    b.orch.resume(held.id);
    await until(() => done(b.orch.get(held.id)!));
    expect(b.orch.get(held.id)!.nodes.long).toMatchObject({ status: 'completed', output: 'resumed' });
    b.orch.dispose();
  });

  it('the time limit counts work only: hours waiting for your approval do not make the run fail', async () => {
    let now = 20_000_000;
    const { orch } = setup({ now: () => now });
    await orch.init();
    const d = def([agent('draft', 'SAY d'), { id: 'ok', title: 'ok', config: { kind: 'approval', prompt: 'ok?' } }, agent('after', 'SAY done')], [{ from: 'draft', to: 'ok' }, { from: 'ok', to: 'after', when: 'approved' }], { policies: { maxMinutes: 60 } });
    const r = orch.create(d);
    await until(() => orch.get(r.id)!.status === 'awaiting_approval');
    now += 5 * 3_600_000;
    orch.tick();
    expect(orch.get(r.id)!.status).toBe('awaiting_approval');
    orch.decide(r.id, 'ok', 'approved');
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.status).toBe('completed');
    expect(orch.activeMs(orch.get(r.id)!)).toBeLessThan(60_000);
    // and when the limit is really passed, the reason has a key for the UI
    const slow = orch.create(def([{ id: 'w', title: 'w', config: { kind: 'wait', mode: 'duration', minutes: 90 } }, agent('x', 'SAY x')], [{ from: 'w', to: 'x' }], { policies: { maxMinutes: 60 } }));
    now += 61 * 60_000;
    orch.tick();
    await until(() => done(orch.get(slow.id)!));
    expect(orch.get(slow.id)!).toMatchObject({ status: 'failed', errorKey: 'tooLong', errorVars: { n: '60' } });
    orch.dispose();
  });

  it('limits: a token budget stops the run; a timeout stops the agent; concurrency holds nodes back', async () => {
    let now = 9_000_000;
    const { orch, live } = setup({ now: () => now });
    await orch.init();
    const r = orch.create(def([agent('a', 'SAY one'), agent('b', 'SAY two')], [{ from: 'a', to: 'b' }], { policies: { budgetTokens: 100 } }));
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!).toMatchObject({ status: 'failed', error: 'token budget reached' });
    expect(orch.get(r.id)!.nodes.b.status).toBe('cancelled');
    const slow = orch.create(def([agent('slow', 'HOLD', { timeoutMinutes: 10 })], []));
    await until(() => orch.get(slow.id)!.nodes.slow.status === 'running');
    now += 11 * 60_000;
    orch.tick();
    await until(() => done(orch.get(slow.id)!));
    expect(orch.get(slow.id)!).toMatchObject({ status: 'failed', error: 'slow failed: timed out' });
    expect(live.activeRun('ann')).toBeUndefined();
    const two = orch.create(def([{ id: 'p', title: 'p', config: { kind: 'parallel' } }, { id: 'x', title: 'x', config: { kind: 'agent', agentId: 'ann', prompt: 'HOLD' } }, { id: 'y', title: 'y', config: { kind: 'agent', agentId: 'bob', prompt: 'HOLD' } }], [{ from: 'p', to: 'x' }, { from: 'p', to: 'y' }], { policies: { maxConcurrency: 1 } }));
    await until(() => Object.values(orch.get(two.id)!.nodes).some((n) => n.status === 'running'));
    expect(Object.values(orch.get(two.id)!.nodes).filter((n) => n.status === 'running')).toHaveLength(1);
    orch.cancel(two.id);
    await until(() => !live.activeRun('ann') && !live.activeRun('bob'));
    expect(orch.get(two.id)!.status).toBe('cancelled');
    orch.dispose();
  });

  it('a tool node: its approval suspends the run; its result is the output', async () => {
    let release: (v: { ok: boolean; output: string }) => void = () => undefined;
    const calls: { toolId: string; input: Record<string, string>; runId: string }[] = [];
    const tools: ToolRunner = { run: (toolId, input, ctx) => (calls.push({ toolId, input, runId: ctx.runId }), new Promise((r) => (release = r))) };
    const { orch, bus } = setup({ tools });
    await orch.init();
    const r = orch.create(def([{ id: 'save', title: 'Save', config: { kind: 'tool', toolId: 'write_text_file', input: { path: 'notes/{{input.topic}}.md', content: 'hi' } } }], []), { topic: 'v' });
    expect(calls).toEqual([{ toolId: 'write_text_file', input: { path: 'notes/v.md', content: 'hi' }, runId: `${r.id}~save` }]);
    bus.emit('tool.awaiting_approval', { runId: `${r.id}~save` } as never);
    expect(orch.get(r.id)!.status).toBe('awaiting_approval');
    bus.emit('tool.approved', { runId: `${r.id}~save` } as never);
    expect(orch.get(r.id)!.status).toBe('running');
    release({ ok: true, output: 'written' });
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.nodes.save).toMatchObject({ status: 'completed', output: 'written' });
    orch.dispose();
  });

  it('a crew node: the plan is approved for you, the final result waits for you (on the Crew screen), then it is the output', async () => {
    const { orch, crews } = setup({ crews: true });
    await crews!.init();
    await orch.init();
    const crew = crews!.create({ name: 'Launch', worldId: 'office', goal: 'g', coordinatorId: 'ann', reviewerId: 'ann', members: [{ agentId: 'ann', role: 'Lead' }, { agentId: 'bob', role: 'Research' }], brief: '' });
    const r = orch.create(def([{ id: 'team', title: 'Team', config: { kind: 'crew', crewId: crew.id, goal: 'Launch {{input.topic}}' } }, agent('after', 'SAY got {{node.team.output}}')], [{ from: 'team', to: 'after' }]), { topic: 'Vocella' });
    await until(() => orch.get(r.id)!.status === 'awaiting_approval');
    const cr = crews!.run(orch.get(r.id)!.nodes.team.crewRunId!)!;
    expect([cr.goal, cr.status]).toEqual(['Launch Vocella', 'awaiting_approval']);
    crews!.approveFinal(cr.id);
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.nodes.after.output).toBe('got CREW FINAL');
    orch.dispose();
  });
});

// docs/HARDENING.md R-1, R-2, R-3, R-7, R-12, R-13, R-14, R-17
describe('Orchestrator: hardening', () => {
  const toolNode = (id: string, toolId: string, policy?: WorkflowNode['policy']): WorkflowNode => ({ id, title: id, config: { kind: 'tool', toolId, input: {} }, ...(policy && { policy }) });
  const approval = (): WorkflowNode => ({ id: 'ok', title: 'ok', config: { kind: 'approval', prompt: 'ok?' } });

  /** a real ToolRuntime behind the node's tool runner: approvals as in the app */
  function realTools() {
    const registry = new ToolRegistry();
    const tool: ToolDefinition = { id: 'write_note', name: 'write_note', description: 'x', source: 'native', inputSchema: { type: 'object', properties: {}, additionalProperties: true }, risk: 'medium', permissions: {}, cancellable: true, timeoutMs: 60_000 };
    registry.register(tool, async () => ({ success: true, content: 'written' }));
    const ref: { runtime?: ToolRuntime } = {};
    const tools: ToolRunner = {
      run: async (toolId, input, ctx) => {
        const { result } = await ref.runtime!.execute({ name: toolId, input }, { runId: ctx.runId, requester: ctx.requester, allowedToolIds: [toolId] }, ctx.signal);
        return { ok: result.success, output: result.content ?? '', ...(result.error && { error: result.error.message, code: result.error.code }) };
      },
      retryable: () => true,
    };
    const attach = async (bus: EventBus) => {
      const policy = new ToolPolicyStore(new MemoryAdapter());
      await policy.init();
      ref.runtime = new ToolRuntime(registry, policy, bus, new MemoryAdapter());
      return ref.runtime;
    };
    return { tools, attach };
  }

  it('R-1: a tool node retried after its timeout: the old call is stopped and its late end is ignored', async () => {
    let now = 1_000_000;
    const calls: { signal: AbortSignal; release: (v: { ok: boolean; output: string; error?: string }) => void }[] = [];
    const tools: ToolRunner = { run: (_t, _i, ctx) => new Promise((release) => calls.push({ signal: ctx.signal, release })), retryable: () => true };
    const { orch } = setup({ tools, now: () => now });
    await orch.init();
    const r = orch.create(def([toolNode('get', 'web_fetch', { retries: 1, timeoutMinutes: 1 })], []));
    expect(calls).toHaveLength(1);
    now += 2 * 60_000;
    orch.tick();
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    // the first call ends late (failed): it does not touch the second attempt
    calls[0].release({ ok: false, output: '', error: 'late' });
    await tick();
    await tick();
    expect(orch.get(r.id)!.nodes.get).toMatchObject({ status: 'running', attempts: 2 });
    expect(calls[1].signal.aborted).toBe(false);
    calls[1].release({ ok: true, output: 'page' });
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.nodes.get).toMatchObject({ status: 'completed', output: 'page' });
    orch.dispose();
  });

  it('R-2: stopping a run cancels a tool call waiting for approval: the prompt goes away', async () => {
    const t = realTools();
    const { orch, bus } = setup({ tools: t.tools });
    const runtime = await t.attach(bus);
    await orch.init();
    const r = orch.create(def([toolNode('save', 'write_note')], []));
    await until(() => runtime.approvals().length === 1);
    expect(orch.get(r.id)!.status).toBe('awaiting_approval');
    orch.cancel(r.id);
    expect(runtime.approvals()).toEqual([]);
    await until(() => runtime.list()[0].status === 'cancelled');
    expect(orch.get(r.id)!).toMatchObject({ status: 'cancelled', nodes: { save: { status: 'cancelled' } } });
    orch.dispose();
  });

  it('R-12: a denied call is never retried; a tool not safe to repeat is not retried', async () => {
    const t = realTools();
    const { orch, bus } = setup({ tools: t.tools });
    const runtime = await t.attach(bus);
    await orch.init();
    const r = orch.create(def([toolNode('save', 'write_note', { retries: 2 })], []));
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'deny');
    await until(() => done(orch.get(r.id)!));
    expect(orch.get(r.id)!.nodes.save).toMatchObject({ status: 'failed', attempts: 1 });
    expect(runtime.approvals()).toEqual([]);
    // without retryable (side effects unknown) a failed call is not made again; a read-only one is
    let n = 0;
    const flaky: ToolRunner = { run: async (toolId) => (n++, { ok: false, output: '', error: `${toolId} broke` }), retryable: (id) => id === 'read' };
    const s = setup({ tools: flaky });
    await s.orch.init();
    const w = s.orch.create(def([toolNode('w', 'write', { retries: 2, onFail: 'continue' }), toolNode('r', 'read', { retries: 1, onFail: 'continue' })], []));
    await until(() => done(s.orch.get(w.id)!));
    expect([s.orch.get(w.id)!.nodes.w.attempts, s.orch.get(w.id)!.nodes.r.attempts, n]).toEqual([1, 2, 3]);
    orch.dispose();
    s.orch.dispose();
  });

  it('R-3: after a restart a tool call that waited for approval is interrupted (its prompt died with the app), and the run suspended', async () => {
    const storage = new MemoryAdapter();
    const tools: ToolRunner = { run: () => new Promise(() => undefined) };
    const a = setup({ storage, tools });
    await a.orch.init();
    const r = a.orch.create(def([toolNode('save', 'write_note')], []));
    a.bus.emit('tool.awaiting_approval', { runId: `${r.id}~save` } as never);
    expect(a.orch.get(r.id)!.status).toBe('awaiting_approval');
    await a.orch.flush();
    a.orch.dispose();
    const b = setup({ storage, tools });
    await b.orch.init();
    expect([b.orch.get(r.id)!.status, b.orch.get(r.id)!.nodes.save.status]).toEqual(['suspended', 'interrupted']);
    expect(b.orch.inbox().map((x) => x.id)).toContain(r.id);
    b.orch.dispose();
  });

  it('R-14: a crew node whose crew run was interrupted by a restart is interrupted too; Resume goes on with the same crew run', async () => {
    const storage = new MemoryAdapter();
    const crewStorage = new MemoryAdapter();
    const a = setup({ storage, crewStorage, crews: true });
    await a.crews!.init();
    await a.orch.init();
    const crew = a.crews!.create({ name: 'Launch', worldId: 'office', goal: 'g', coordinatorId: 'ann', reviewerId: 'ann', members: [{ agentId: 'ann', role: 'Lead' }, { agentId: 'bob', role: 'Research' }], brief: '' });
    // the coordinator holds while planning: the crew run is working when the app closes
    const r = a.orch.create(def([{ id: 'team', title: 'Team', config: { kind: 'crew', crewId: crew.id, goal: 'HOLD {{input.topic}}' } }], []), { topic: 'Vocella' });
    await until(() => !!a.live.activeRun('ann'));
    const crewRunId = a.orch.get(r.id)!.nodes.team.crewRunId!;
    await crewStorage.set(`crew-run.${crewRunId}`, a.crews!.run(crewRunId));
    await a.orch.flush();
    a.orch.dispose();
    const b = setup({ storage, crewStorage, crews: true });
    await b.crews!.init();
    await b.orch.init();
    expect(b.crews!.run(crewRunId)!.status).toBe('interrupted');
    expect([b.orch.get(r.id)!.status, b.orch.get(r.id)!.nodes.team.status]).toEqual(['suspended', 'interrupted']);
    // the time limit does not count the time it was closed
    expect(b.orch.get(r.id)!.pausedSince).toBeDefined();
    b.crews!.run(crewRunId)!.goal = 'Launch Vocella';
    b.orch.resume(r.id);
    await until(() => b.orch.get(r.id)!.status === 'awaiting_approval');
    expect(b.orch.get(r.id)!.nodes.team.crewRunId).toBe(crewRunId);
    b.crews!.approveFinal(crewRunId);
    await until(() => done(b.orch.get(r.id)!));
    expect(b.orch.get(r.id)!.nodes.team).toMatchObject({ status: 'completed', output: 'CREW FINAL' });
    b.orch.dispose();
  });

  it('R-7: open runs are never pruned; when every place holds an open run, a new one is refused', async () => {
    const { orch } = setup();
    await orch.init();
    const d = def([approval()], []);
    const first = orch.create(d);
    for (let i = 1; i < 80; i++) orch.create(d);
    expect(() => orch.create(d)).toThrow(/runs open/);
    expect(orch.list()).toHaveLength(80);
    orch.decide(first.id, 'ok', 'approved');
    expect(orch.get(first.id)!.status).toBe('completed');
    const next = orch.create(d);
    // the ended run made room; every open one is still there
    expect(orch.get(first.id)).toBeUndefined();
    expect(orch.list()).toHaveLength(80);
    expect(orch.list().every((x) => x.status === 'awaiting_approval')).toBe(true);
    expect(orch.get(next.id)).toBeDefined();
    orch.dispose();
  });

  it('R-13: the next time is saved before the run is made; one run per due time; no overlap with the previous run', async () => {
    let now = new Date(2026, 9, 12, 8, 0).getTime();
    const { orch } = setup({ now: () => now });
    await orch.init();
    const definition = def([approval()], []);
    const saved: { schedules: Schedule[] }[] = [];
    class Spy extends MemoryAdapter {
      async set<T>(key: string, value: T) {
        if (key === 'workflow-schedules') saved.push(JSON.parse(JSON.stringify(value)));
        return super.set(key, value);
      }
    }
    const seenAtCreate: (number | undefined)[] = [];
    const sched = new Scheduler(new Spy(), {
      definition: () => definition,
      createRun: (d, i, t) => (seenAtCreate.push(saved.at(-1)?.schedules[0].nextAt), orch.create(d, i, t)),
      now: () => now,
    });
    await sched.init();
    const sc = sched.create({ name: 'Hourly', workflowId: 'wf-1', inputs: {}, trigger: { kind: 'interval', everyMinutes: 60 }, enabled: true, catchUp: 'once' });
    const due = sc.nextAt!;
    now = due + 60_000;
    await sched.tick();
    expect(orch.list()).toHaveLength(1);
    // on disk before the run existed: the NEXT time, not the one being fired
    expect(seenAtCreate[0]).toBe(due + 3_600_000);
    // an hour later the previous run still waits for approval: this firing is skipped, and said so
    now += 3_600_000;
    await sched.tick();
    expect(orch.list()).toHaveLength(1);
    expect(sched.errors.get(sc.id)).toBe('skipped: previous run still running');
    // the same due time again (a crash between saving and creating): refused, not repeated
    expect(() => orch.create(definition, {}, { kind: 'catchup', scheduleId: sc.id, dueAt: due })).toThrow(/already/);
    // "run now" is the user's own choice: it may overlap
    expect(sched.runNow(sc.id)).toBeDefined();
    expect(orch.list()).toHaveLength(2);
    sched.dispose();
    orch.dispose();
  });

  it('R-17: a delegated colleague’s tokens count against the node’s workflow budget', async () => {
    const { orch, live } = setup();
    await orch.init();
    const r = orch.create(def([agent('a', 'HOLD')], [], { policies: { budgetTokens: 1000 } }));
    await until(() => !!live.activeRun('ann'));
    const parent = orch.get(r.id)!.nodes.a.agentRunId!;
    // ann hands work to bob (delegate_task): his run is a child of ann's
    const child = live.startTask('bob', { prompt: 'SAY help', delegatedBy: { runId: parent, agentId: 'ann' } });
    await until(() => live.getRun(child.run.id)!.status === 'completed');
    await tick();
    expect(orch.get(r.id)!.budget.tokens).toBe(150);
    orch.cancel(r.id);
    orch.dispose();
  });
});


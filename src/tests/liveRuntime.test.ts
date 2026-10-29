import { describe, expect, it } from 'vitest';
import { EventBus, type EventType, type LoggedEvent } from '../core/events';
import { PRESETS } from '../data/presets';
import { WORLD_BY_ID } from '../data/worlds';
import type { AgentRun } from '../domain/agent';
import { WorldSession } from '../engine/session';
import type { AgentLook } from '../engine/worldSim';
import { MemoryAdapter } from '../persistence/storage';
import { LiveRuntime, LiveRuntimeError, titleOf } from '../runtime/live/liveRuntime';
import { RuntimeRepository, type RuntimeSnapshot } from '../runtime/live/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';

// A fake provider: the real Claude path is tested by hand (docs/RUNTIME.md).

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: true, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };

type Script = (req: ProviderTurnRequest) => AsyncGenerator<ProviderEventBody>;
const tick = () => new Promise((r) => setTimeout(r, 0));

class FakeProvider implements AIProvider {
  readonly name = 'Fake';
  readonly capabilities = CAPS;
  requests: ProviderTurnRequest[] = [];
  constructor(
    readonly id: string,
    private script: Script,
  ) {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    let seq = 0;
    for await (const b of this.script(req)) yield { ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 } as ProviderEvent;
  }
}

/** streams `chunks`, then completes with their concatenation */
const succeeds = (...chunks: string[]): Script =>
  async function* () {
    yield { type: 'provider.started' };
    yield { type: 'session.started', sessionId: 's-1', resumed: false };
    for (const text of chunks) {
      await tick();
      yield { type: 'text.delta', messageId: 'm', index: 0, text };
    }
    yield { type: 'usage.updated', usage: { inputTokens: 10, outputTokens: 5 }, cumulative: true, costUsd: 0.01 };
    yield { type: 'run.completed', text: chunks.join(''), durationMs: 42 };
  };

const fails: Script = async function* () {
  yield { type: 'provider.started' };
  yield { type: 'provider.error', error: { code: 'not_authenticated', message: 'Claude Code is not signed in.' } };
  yield { type: 'run.failed', error: { code: 'not_authenticated', message: 'Claude Code is not signed in.', detail: 'Not logged in' } };
};

/** streams one chunk, waits for cancellation, then (misbehaving) also claims success */
const hangs: Script = async function* (req) {
  yield { type: 'provider.started' };
  yield { type: 'text.delta', messageId: 'm', index: 0, text: 'partial' };
  await new Promise<void>((r) => (req.abortSignal?.aborted ? r() : req.abortSignal?.addEventListener('abort', () => r())));
  yield { type: 'run.cancelled', reason: 'Cancelled.' };
  yield { type: 'run.completed', text: 'should never count' };
};

function setup(script: Script = succeeds('RealmNest agent ', 'runtime successful.'), storage = new MemoryAdapter(), extra: { resumeQueueMs?: number } = {}) {
  const bus = new EventBus(2000);
  const provider = new FakeProvider('claude-code', script);
  const providers = new ProviderService(new ProviderRegistry().register(provider), bus);
  const repo = new RuntimeRepository(storage, 10);
  let n = 0;
  const live = new LiveRuntime(bus, providers, repo, { identity: (id) => ({ name: id === 'alex' ? 'Alex' : 'Bea', role: 'Developer' }), newId: (k) => `${k}-${++n}`, ...extra });
  const types = () => [...bus.log].reverse().map((e) => e.type);
  const of = <K extends EventType>(k: K) => [...bus.log].reverse().filter((e): e is LoggedEvent<K> => e.type === k);
  return { bus, live, provider, storage, repo, types, of };
}

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};
const finished = (r: AgentRun | undefined) => !!r && ['completed', 'failed', 'cancelled'].includes(r.status);

describe('LiveRuntime: a successful run', () => {
  it('creates a task and a run, streams output, and returns the agent to idle', async () => {
    const { live, provider, types, of } = setup();
    const { task, run } = live.startTask('alex', { prompt: 'Reply exactly with: "RealmNest agent runtime successful."' });
    expect(task).toMatchObject({ agentId: 'alex', status: 'running', runIds: [run.id] });
    expect(run).toMatchObject({ taskId: task.id, agentId: 'alex', providerId: 'claude-code', status: 'starting' });
    expect(live.agentStatus('alex')).toBe('starting');
    expect(live.status('alex')).toBe('working');

    await until(() => live.agentStatus('alex') === 'working');
    expect(live.getRun(run.id)!.status).toBe('running');
    await until(() => finished(live.getRun(run.id)));

    const done = live.getRun(run.id)!;
    expect(done).toMatchObject({ status: 'completed', output: 'RealmNest agent runtime successful.', result: 'RealmNest agent runtime successful.', sessionId: 's-1', costUsd: 0.01 });
    expect(done.finishedAt).toBeGreaterThanOrEqual(done.startedAt!);
    expect(live.getTask(task.id)!.status).toBe('completed');
    expect(live.agentStatus('alex')).toBe('idle');
    expect(live.activeRun('alex')).toBeUndefined();

    // the agent's identity reaches the provider; the prompt is the task
    expect(provider.requests[0].systemPrompt).toContain('You are Alex, Developer');
    expect(provider.requests[0].messages).toEqual([{ role: 'user', content: task.prompt }]);
    expect(provider.requests[0].runId).toBe(run.id);

    expect(of('agent.status.changed').map((e) => `${e.payload.from}>${e.payload.to}`)).toEqual(['idle>starting', 'starting>working', 'working>idle']);
    expect(of('task.status.changed').map((e) => e.payload.to)).toEqual(['queued', 'running', 'completed']);
    expect(of('agent.run.status').map((e) => e.payload.to)).toEqual(['running', 'completed']);
    // world events in order, all marked live; deltas are delivered but not logged
    expect(types().filter((t) => t.startsWith('agent.work') || t === 'agent.idle')).toEqual(['agent.work.started', 'agent.work.completed', 'agent.idle']);
    expect(of('agent.work.started')[0].origin).toBe('live');
    expect(types()).not.toContain('agent.run.output.delta');
  });

  it('streams output to listeners while the run goes', async () => {
    const { live, bus } = setup(succeeds('a', 'b', 'c'));
    const deltas: string[] = [];
    bus.on('agent.run.output.delta', (p) => deltas.push(p.text));
    const { run } = live.startTask('alex', { prompt: 'x' });
    await until(() => deltas.length === 1);
    expect(live.getRun(run.id)!.status).toBe('running');
    expect(live.getRun(run.id)!.output).toBe('a');
    await until(() => finished(live.getRun(run.id)));
    expect(deltas).toEqual(['a', 'b', 'c']);
  });

  it('persists tasks, outcome, output and timestamps', async () => {
    const storage = new MemoryAdapter();
    const { live, repo } = setup(undefined, storage);
    const { run } = live.startTask('alex', { prompt: 'hello' });
    await until(() => finished(live.getRun(run.id)));
    await repo.flush(live.snapshot);
    const saved = (await storage.get<RuntimeSnapshot>('runtime'))!;
    expect(saved.tasks[0]).toMatchObject({ prompt: 'hello', status: 'completed' });
    expect(saved.runs[0]).toMatchObject({ status: 'completed', result: 'RealmNest agent runtime successful.' });
    expect(saved.runs[0].finishedAt).toBeDefined();

    const again = setup(undefined, storage).live;
    await again.init();
    expect(again.tasksOf('alex').map((t) => t.status)).toEqual(['completed']);
  });
});

describe('LiveRuntime: failures and cancellation', () => {
  it('a failed provider run fails the run and the task, stores the error, frees the agent', async () => {
    const { live, types, of } = setup(fails);
    const { task, run } = live.startTask('alex', { prompt: 'x' });
    await until(() => finished(live.getRun(run.id)));
    expect(live.getRun(run.id)).toMatchObject({ status: 'failed', error: { code: 'not_authenticated', message: 'Claude Code is not signed in.', detail: 'Not logged in' } });
    expect(live.getTask(task.id)!.status).toBe('failed');
    expect(live.agentStatus('alex')).toBe('idle');
    expect(types()).toContain('agent.run.failed');
    expect(types()).not.toContain('agent.run.completed');
    expect(of('agent.work.failed')[0].payload.error).toBe('Claude Code is not signed in.');
    expect(types().at(-1)).toBe('agent.idle');
    // the agent can take the next task
    expect(() => live.startTask('alex', { prompt: 'again' })).not.toThrow();
  });

  it('cancel stops the run; nothing counts after it', async () => {
    const { live, types } = setup(hangs);
    const { task, run } = live.startTask('alex', { prompt: 'long task' });
    await until(() => live.getRun(run.id)!.output === 'partial');
    await live.cancel('alex');
    await until(() => finished(live.getRun(run.id)));
    await tick();
    expect(live.getRun(run.id)).toMatchObject({ status: 'cancelled', output: 'partial' });
    expect(live.getRun(run.id)!.result).toBeUndefined();
    expect(live.getTask(task.id)!.status).toBe('cancelled');
    expect(live.agentStatus('alex')).toBe('idle');
    expect(types()).toContain('agent.run.cancelled');
    expect(types()).not.toContain('agent.run.completed');
    expect(types()).not.toContain('agent.work.completed');
  });

  it('refuses a second task while busy, empty prompts and unknown providers', async () => {
    const { live } = setup(hangs);
    live.startTask('alex', { prompt: 'one' });
    expect(() => live.startTask('alex', { prompt: 'two' })).toThrow(LiveRuntimeError);
    expect(() => live.startTask('bea', { prompt: '   ' })).toThrow(/Write a task/);
    live.updateAgent('bea', { connectionId: 'nope' });
    expect(() => live.startTask('bea', { prompt: 'x' })).toThrow(/no usable AI connection/);
    await live.cancel('alex');
  });

  it('marks runs interrupted by a restart as failed', async () => {
    const storage = new MemoryAdapter();
    const run: AgentRun = { id: 'r1', taskId: 't1', agentId: 'alex', providerId: 'claude-code', status: 'running', createdAt: 1, output: 'half' };
    await storage.set('runtime', { version: 1, agents: [], tasks: [{ id: 't1', agentId: 'alex', title: 't', prompt: 'p', status: 'running', runIds: ['r1'], createdAt: 1, updatedAt: 1 }], runs: [run] });
    const { live } = setup(undefined, storage);
    await live.init();
    expect(live.getRun('r1')).toMatchObject({ status: 'failed', error: { code: 'interrupted' } });
    expect(live.getTask('t1')!.status).toBe('failed');
    expect(live.agentStatus('alex')).toBe('idle');
  });
});

describe('LiveRuntime: isolation and agents', () => {
  it('runs of different agents stay isolated', async () => {
    const { live } = setup(async function* (req) {
      const who = String(req.systemPrompt).includes('Alex') ? 'A' : 'B';
      yield { type: 'provider.started' };
      for (let i = 0; i < 3; i++) {
        await tick();
        yield { type: 'text.delta', messageId: who, index: 0, text: who };
      }
      yield { type: 'run.completed', text: who.repeat(3) };
    });
    const a = live.startTask('alex', { prompt: 'a' }).run;
    const b = live.startTask('bea', { prompt: 'b' }).run;
    expect(live.agentStatus('alex')).not.toBe('idle');
    expect(live.agentStatus('bea')).not.toBe('idle');
    await until(() => finished(live.getRun(a.id)) && finished(live.getRun(b.id)));
    expect(live.getRun(a.id)!.output).toBe('AAA');
    expect(live.getRun(b.id)!.output).toBe('BBB');
    expect(live.tasksOf('alex')).toHaveLength(1);
  });

  it('keeps agent configuration and uses it for the run', async () => {
    const { live, provider } = setup();
    expect(live.agent('alex')).toMatchObject({ id: 'alex', connectionId: 'claude-code' });
    live.updateAgent('alex', { model: 'sonnet', instructions: 'Answer in Italian.', workspace: '  ' });
    const def = live.agent('alex');
    expect(def).toMatchObject({ model: 'sonnet', instructions: 'Answer in Italian.' });
    expect(def.workspace).toBeUndefined();
    const { run } = live.startTask('alex', { prompt: 'x' });
    expect(run.model).toBe('sonnet');
    await until(() => provider.requests.length > 0);
    expect(provider.requests[0]).toMatchObject({ model: 'sonnet' });
    expect(provider.requests[0].systemPrompt).toContain('Answer in Italian.');
  });

  it('derives a short title from the prompt', () => {
    expect(titleOf('  Fix the login bug\nmore details')).toBe('Fix the login bug');
    expect(titleOf('x'.repeat(80))).toHaveLength(58);
  });
});

describe('LiveRuntime in the world', () => {
  const look = (name: string): AgentLook => ({ name, role: 'Developer', profile: PRESETS[0].profile, outfitId: 'universal.tee', signature: '#e2553b' });
  const step = (s: WorldSession, seconds: number) => {
    for (let t = 0; t < seconds; t += 0.1) s.update(0.1);
  };

  it('the character works only while its real run goes; sim commands cannot fake work', async () => {
    const { live, bus } = setup(hangs);
    const s = new WorldSession(WORLD_BY_ID.office, bus, new Map([['alex', look('Alex')]]), 42, live);
    expect(s.runtime.kind).toBe('live');
    step(s, 3);
    s.dispatch({ type: 'startWork' });
    s.dispatch({ type: 'forceState', state: 'working' });
    step(s, 8);
    expect(s.sim.get('alex')!.runtime).toBe('idle');
    expect(s.sim.get('alex')!.state).not.toBe('working');

    live.startTask('alex', { prompt: 'long task' });
    step(s, 12);
    expect(s.sim.get('alex')!.runtime).toBe('working');
    expect(['walking', 'working', 'waiting']).toContain(s.sim.get('alex')!.state);

    await live.cancel('alex');
    await until(() => live.agentStatus('alex') === 'idle');
    expect(s.sim.get('alex')!.runtime).toBe('idle');
    s.dispose();
  });

  it('a run that ends during the walk to the desk never shows the character working', async () => {
    const { live, bus } = setup(hangs);
    const s = new WorldSession(WORLD_BY_ID.office, bus, new Map([['alex', look('Alex')]]), 42, live);
    step(s, 3);
    live.startTask('alex', { prompt: 'x' });
    await until(() => live.agentStatus('alex') === 'working');
    // walk until one step from the desk, then end the run
    const a = s.sim.get('alex')!;
    for (let i = 0; i < 400 && !(a.state === 'walking' && a.target?.purpose === 'work' && a.path.length <= 1); i++) s.update(0.05);
    expect(a.target?.purpose).toBe('work');
    await live.cancel('alex');
    await until(() => live.agentStatus('alex') === 'idle');
    const seen = new Set<string>();
    for (let t = 0; t < 6; t += 0.05) {
      s.update(0.05);
      seen.add(a.state);
    }
    expect(seen.has('working')).toBe(false);
    s.dispose();
  });

  it('a world opened during a run shows the agent working (replay on attach)', async () => {
    const { live, bus } = setup(hangs);
    live.startTask('alex', { prompt: 'long task' });
    await until(() => live.agentStatus('alex') === 'working');
    const s = new WorldSession(WORLD_BY_ID.office, bus, new Map([['alex', look('Alex')]]), 42, live);
    expect(s.sim.get('alex')!.runtime).toBe('working');
    s.dispose();
    await live.cancel('alex');
  });

  it('MockRuntime is still the default for a world', () => {
    const bus = new EventBus();
    const s = new WorldSession(WORLD_BY_ID.office, bus, new Map([['a', look('A')]]), 42);
    expect(s.runtime.kind).toBe('mock');
    s.dispatch({ type: 'startWork' });
    expect(s.runtime.status('a')).toBe('working');
    // mock events carry no live origin
    expect(bus.log.find((e) => e.type === 'agent.work.started')?.origin).toBeUndefined();
    s.dispose();
  });
});

// docs/HARDENING.md R-10, R-11, R-15, M-2, I-5
describe('LiveRuntime: hardening', () => {
  const memoryStub = () => {
    const after: string[] = [];
    const memory = { usable: () => true, beginRun: async () => ({ tool: false }), finishRun: () => undefined, afterRun: async (i: { taskId?: string }) => void after.push(i.taskId ?? '') };
    return { memory, after };
  };

  it('R-10: a listener that throws does not keep the others (and the run) from hearing an event', async () => {
    const { bus, live } = setup();
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => void errors.push(a);
    try {
      bus.on('agent.run.started', () => {
        throw new Error('a broken listener');
      });
      const heard: string[] = [];
      bus.on('agent.run.started', (p) => void heard.push(p.runId));
      const { run } = live.startTask('alex', { prompt: 'Hello' });
      expect(heard).toEqual([run.id]);
      await until(() => finished(live.getRun(run.id)));
      expect(live.getRun(run.id)!.status).toBe('completed');
      live.startTask('alex', { prompt: 'Again' });
      // logged once per event type, not once per event
      expect(errors).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });

  it('R-11: a throw while the request is built ends the run failed; the agent is free again', async () => {
    const bus = new EventBus(2000);
    const providers = new ProviderService(new ProviderRegistry().register(new FakeProvider('claude-code', succeeds('ok'))), bus);
    let broken = true;
    const knowledge = {
      validSelection: () => {
        if (broken) throw new Error('Knowledge exploded');
        return undefined;
      },
    };
    const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 10), { identity: () => ({ name: 'Alex', role: '' }), knowledge: knowledge as never });
    const { run } = live.startTask('alex', { prompt: 'Hello' });
    await until(() => finished(live.getRun(run.id)));
    expect(live.getRun(run.id)).toMatchObject({ status: 'failed', error: { code: 'internal', message: 'Knowledge exploded' } });
    expect(live.agentStatus('alex')).toBe('idle');
    broken = false;
    const next = live.startTask('alex', { prompt: 'Hello again' });
    await until(() => finished(live.getRun(next.run.id)));
    expect(live.getRun(next.run.id)!.status).toBe('completed');
  });

  it('R-15: no task for an agent that does not exist; a deleted agent stops and its configuration goes', async () => {
    const bus = new EventBus(2000);
    const providers = new ProviderService(new ProviderRegistry().register(new FakeProvider('claude-code', hangs)), bus);
    const people = new Set(['alex']);
    const repo = new RuntimeRepository(new MemoryAdapter(), 10);
    const live = new LiveRuntime(bus, providers, repo, { identity: (id) => (people.has(id) ? { name: id, role: '' } : undefined) });
    let err: unknown;
    try {
      live.startTask('ghost', { prompt: 'Work' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(LiveRuntimeError);
    expect((err as LiveRuntimeError).code).toBe('UNKNOWN_AGENT');
    live.updateAgent('alex', { instructions: 'Be brief.', toolPermissions: { write_text_file: 'allow' } });
    const { run } = live.startTask('alex', { prompt: 'Long work' });
    await until(() => live.getRun(run.id)!.status === 'running');
    people.delete('alex');
    bus.emit('character.deleted', { id: 'alex', name: 'Alex' });
    await until(() => finished(live.getRun(run.id)));
    expect(live.getRun(run.id)!.status).toBe('cancelled');
    expect(live.agent('alex')).toMatchObject({ updatedAt: 0 });
    expect(live.agent('alex').toolPermissions).toBeUndefined();
    expect(live.snapshot().agents.map((a) => a.id)).not.toContain('alex');
  });

  it('M-2: memories are proposed only from the user’s own tasks, never from a prompt a model wrote', async () => {
    const bus = new EventBus(2000);
    const providers = new ProviderService(new ProviderRegistry().register(new FakeProvider('claude-code', succeeds('done'))), bus);
    const { memory, after } = memoryStub();
    const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 10), { identity: () => ({ name: 'Bea', role: '' }), memory: memory as never });
    const ran: string[] = [];
    const inputs = [
      { prompt: 'from the user' },
      { prompt: 'from a colleague', delegatedBy: { runId: 'run-x', agentId: 'alex' } },
      { prompt: 'crew work', crew: { crewId: 'c', runId: 'cr', kind: 'work' as const } },
      { prompt: 'workflow node', workflow: { workflowId: 'w', runId: 'wr', nodeId: 'n' } },
      { prompt: 'reworded by the concierge', modelWritten: true },
    ];
    for (const input of inputs) {
      const { task, run } = live.startTask('bea', input);
      ran.push(task.id);
      await until(() => finished(live.getRun(run.id)));
    }
    await tick();
    expect(after).toEqual([ran[0]]);
  });

  it('I-5: @mentions and Skill names count only in what the user typed', async () => {
    const bus = new EventBus(2000);
    const providers = new ProviderService(new ProviderRegistry().register(new FakeProvider('claude-code', succeeds('done'))), bus);
    const asked: { ids: string[]; agentToolIds?: string[] }[] = [];
    const skills = {
      catalog: () => [{ id: 'acme.mailer', name: 'Mailer', description: 'Sends mail' }],
      activate: (ids: string[], ctx: { agentToolIds?: string[] }) => (asked.push({ ids, agentToolIds: ctx.agentToolIds }), { ok: true as const, context: '# Active Skills', toolIds: [], refs: ids.map((id) => ({ id, version: '1.0.0', name: id })) }),
    };
    const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 10), { identity: () => ({ name: 'Bea', role: '' }), skills });
    const typed = live.startTask('bea', { prompt: 'Use @acme.mailer to write to Ann' });
    await until(() => finished(live.getRun(typed.run.id)));
    // an agent with no tools of its own: a Skill may bring none (the activator gets an empty list, not "anything")
    expect(asked).toEqual([{ ids: ['acme.mailer'], agentToolIds: [] }]);
    expect(typed.run.skills?.[0].id).toBe('acme.mailer');
    for (const by of [{ delegatedBy: { runId: 'run-x', agentId: 'alex' } }, { crew: { crewId: 'c', runId: 'cr', kind: 'work' as const } }, { workflow: { workflowId: 'w', runId: 'wr', nodeId: 'n' } }, { modelWritten: true }]) {
      const { run } = live.startTask('bea', { prompt: 'Use @acme.mailer and the Mailer skill to write to Ann', ...by });
      await until(() => finished(live.getRun(run.id)));
      expect(run.skills).toBeUndefined();
    }
    expect(asked).toHaveLength(1);
  });
});

describe('LiveRuntime: the queue', () => {
  it('a task for a busy agent waits, then starts by itself when the agent is done (keeping its id)', async () => {
    const { live, provider } = setup();
    const first = live.giveTask('alex', { prompt: 'first' });
    expect(first.queued).toBe(false);
    const second = live.giveTask('alex', { prompt: 'second', title: 'The second one' });
    const third = live.giveTask('alex', { prompt: 'third' });
    expect([second.queued, third.queued]).toEqual([true, true]);
    expect(live.queued('alex').map((t) => t.id)).toEqual([second.task.id, third.task.id]);
    expect(second.task).toMatchObject({ status: 'queued', title: 'The second one', runIds: [] });
    await until(() => live.getTask(third.task.id)?.status === 'completed');
    expect(provider.requests.map((r) => r.messages.at(-1)!.content)).toEqual([expect.stringContaining('first'), expect.stringContaining('second'), expect.stringContaining('third')]);
    expect(live.getTask(second.task.id)).toMatchObject({ status: 'completed', title: 'The second one' });
    expect(live.getTask(second.task.id)!.pending).toBeUndefined();
    expect(live.queued('alex')).toEqual([]);
    expect(live.agentStatus('alex')).toBe('idle');
  });

  it('a waiting task can be taken out; stopping the current one starts the next', async () => {
    const { live, provider } = setup(hangs);
    live.giveTask('alex', { prompt: 'one' });
    const two = live.giveTask('alex', { prompt: 'two' });
    const three = live.giveTask('alex', { prompt: 'three' });
    live.removeQueued(two.task.id);
    expect(live.getTask(two.task.id)!.status).toBe('cancelled');
    await until(() => provider.requests.length === 1);
    await live.cancel('alex');
    await until(() => live.activeRun('alex')?.taskId === three.task.id && provider.requests.length === 2);
    expect(provider.requests[1].messages.at(-1)!.content).toContain('three');
    await live.cancel('alex');
  });

  it('waiting tasks survive a restart and start again; one that cannot start fails and the next tries', async () => {
    const storage = new MemoryAdapter();
    const a = setup(hangs, storage);
    a.live.giveTask('alex', { prompt: 'running' });
    const one = a.live.giveTask('alex', { prompt: 'waiting one' });
    const two = a.live.giveTask('alex', { prompt: 'waiting two' });
    await a.repo.flush(a.live.snapshot);
    // RealmNest closed: the running task was interrupted, the waiting ones wait on
    const b = setup(succeeds('done'), storage, { resumeQueueMs: 5 });
    await b.live.init();
    expect(b.live.queued('alex').map((t) => t.id)).toEqual([one.task.id, two.task.id]);
    await until(() => b.live.getTask(two.task.id)?.status === 'completed');
    expect(b.live.getTask(one.task.id)!.status).toBe('completed');
    const c = setup(succeeds('done'), new MemoryAdapter());
    c.live.startTask('alex', { prompt: 'busy' });
    const later = c.live.giveTask('alex', { prompt: 'later' });
    c.live.updateAgent('alex', { connectionId: 'gone' });
    await until(() => c.live.getTask(later.task.id)?.status === 'failed');
    expect(c.live.getTask(later.task.id)!.error?.message).toMatch(/no usable AI connection/);
  });

  it('checks what it can at once: empty task, unknown agent, files not stored, a full queue; a deleted agent loses its queue', async () => {
    const { live, bus } = setup(hangs);
    live.giveTask('alex', { prompt: 'busy' });
    expect(() => live.giveTask('alex', { prompt: '  ' })).toThrow(/Write a task/);
    expect(() => live.giveTask('alex', { prompt: 'x', attachments: [{ name: 'a.png', kind: 'image', mime: 'image/png', size: 4, data: 'AAAA', createdAt: 0 }] })).toThrow(/could not be kept/);
    const stored = live.giveTask('alex', { prompt: 'x', attachments: [{ name: 'a.png', kind: 'image', mime: 'image/png', size: 4, data: 'AAAA', storageRef: 'sha256:abc', createdAt: 0 }] });
    expect(stored.task.pending?.attachments?.[0]).not.toHaveProperty('data');
    for (let i = live.queued('alex').length; i < 20; i++) live.giveTask('alex', { prompt: `t${i}` });
    expect(() => live.giveTask('alex', { prompt: 'one too many' })).toThrow(/20 tasks waiting/);
    bus.emit('character.deleted', { id: 'alex', name: 'Alex' });
    expect(live.queued('alex')).toEqual([]);
    await until(() => !live.activeRun('alex'));
  });
});

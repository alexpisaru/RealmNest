import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { DelegationService, DELEGATION_DEPTH } from '../runtime/delegation/service';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';

// Delegation: a run hands a task to a colleague, who works as itself; the answer comes back.
// Root tasks here never finish on their own (they wait to be cancelled); handed-over tasks answer
// "done by <name>" — or wait too when the task says HOLD.

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: true, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 400 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

const MEMBERS = [
  { id: 'alex', name: 'Alex', role: 'Developer', worldId: 'office' },
  { id: 'maya', name: 'Maya', role: 'Research lead', worldId: 'office' },
  { id: 'theo', name: 'Theo', role: 'Data analyst', worldId: 'office' },
  { id: 'kenji', name: 'Kenji', role: 'Engineer', worldId: 'office' },
  { id: 'zoe', name: 'Zoe', role: 'Grower', worldId: 'farm' },
];

class Team implements AIProvider {
  readonly id = 'claude-code';
  readonly name = 'Fake';
  readonly capabilities = CAPS;
  prompts: string[] = [];
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    const text = req.messages.at(-1)!.content;
    this.prompts.push(`${req.systemPrompt ?? ''}\n---\n${text}`);
    const who = /You are (\w+)/.exec(req.systemPrompt ?? '')?.[1] ?? '?';
    let seq = 0;
    const out = (b: ProviderEventBody) => ({ ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 }) as ProviderEvent;
    yield out({ type: 'provider.started' });
    await tick();
    if (text.includes('Task handed over') && !text.includes('HOLD')) {
      yield out({ type: 'run.completed', text: `done by ${who}` });
      return;
    }
    await new Promise<void>((r) => (req.abortSignal?.aborted ? r() : req.abortSignal?.addEventListener('abort', () => r())));
    yield out({ type: 'run.cancelled', reason: 'Cancelled.' });
  }
}

function setup(chat?: Record<string, { conversationId: string; agentId?: string }>) {
  const bus = new EventBus(3000);
  const provider = new Team();
  const providers = new ProviderService(new ProviderRegistry().register(provider), bus);
  let n = 0;
  let delegation: DelegationService | undefined;
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter(), 10), {
    identity: (id) => MEMBERS.find((m) => m.id === id),
    newId: (k) => `${k}-${++n}`,
    team: (id) => delegation?.teamPrompt(id),
  });
  delegation = new DelegationService(bus, live, { members: () => MEMBERS, chatRun: (runId) => chat?.[runId], waitMs: 2000 });
  // every agent may delegate (the team list goes in its prompt)
  for (const m of MEMBERS) live.updateAgent(m.id, { allowedToolIds: ['delegate_task'] });
  const root = (agentId: string, prompt = 'own work') => live.startTask(agentId, { prompt }).run;
  return { bus, live, provider, delegation, root };
}

describe('delegate_task', () => {
  it("hands a task to a world-mate, who works as themself; the answer, the links and the world's events", async () => {
    const { bus, live, delegation, root, provider } = setup();
    const events: string[] = [];
    bus.on('agent.delegation', (p) => events.push(`delegation ${p.from}→${p.to} live=${p.live}`));
    bus.on('agent.delegation.returned', (p) => events.push(`returned ${p.from}`));
    const parent = root('alex');
    const ac = new AbortController();
    const { target, run } = await delegation.delegate({ agent: 'maya', task: 'Summarize the Q3 survey.\nThree bullets.' }, { runId: parent.id, signal: ac.signal });
    expect(target.name).toBe('Maya');
    expect(run).toMatchObject({ agentId: 'maya', status: 'completed', result: 'done by Maya', parentRunId: parent.id });
    const task = live.getTask(run.taskId)!;
    expect(task).toMatchObject({ title: 'Summarize the Q3 survey.', delegatedBy: { runId: parent.id, agentId: 'alex', taskId: parent.taskId } });
    expect(task.prompt).toContain('Task handed over by Alex');
    expect(live.delegatedFrom(parent.id).map((t) => t.id)).toEqual([run.taskId]);
    expect(events).toEqual(['delegation alex→maya live=true', 'returned alex']);
    // Maya's own prompt names her team (her world-mates, not Zoe)
    const mayas = provider.prompts.find((p) => p.startsWith('You are Maya'))!;
    expect(mayas).toContain('Your team');
    expect(mayas).toContain('- Alex, Developer');
    expect(mayas).not.toContain('Zoe');
    await live.cancel('alex');
  });

  it('refuses: nobody by that name, another world, oneself, a loop, too deep; and checks the files', async () => {
    const { live, delegation, root } = setup();
    const sig = () => new AbortController().signal;
    const alex = root('alex');
    await expect(delegation.delegate({ agent: 'Bob', task: 'x x x' }, { runId: alex.id, signal: sig() })).rejects.toThrow(/No colleague called "Bob". Your team: Maya, Theo, Kenji/);
    await expect(delegation.delegate({ agent: 'Zoe', task: 'x x x' }, { runId: alex.id, signal: sig() })).rejects.toThrow(/No colleague called "Zoe"/);
    await expect(delegation.delegate({ agent: 'Alex', task: 'x x x' }, { runId: alex.id, signal: sig() })).rejects.toThrow(/yourself/);
    await expect(delegation.delegate({ agent: 'Maya', task: 'x x x', files: ['secret.txt'] }, { runId: alex.id, signal: sig() })).rejects.toThrow(/not one of your files/);
    await expect(delegation.delegate({ agent: 'Maya', task: 'x x x' }, { signal: sig() })).rejects.toThrow(/only inside an agent task or a chat/);
    // a chain: Alex → Maya → Theo, each still working (HOLD)
    const a1 = new AbortController();
    void delegation.delegate({ agent: 'Maya', task: 'HOLD part one' }, { runId: alex.id, signal: a1.signal }).catch(() => undefined);
    await until(() => !!live.activeRun('maya'));
    const maya = live.activeRun('maya')!;
    await expect(delegation.delegate({ agent: 'Alex', task: 'x x x' }, { runId: maya.id, signal: sig() })).rejects.toThrow(/already part of this chain/);
    const a2 = new AbortController();
    void delegation.delegate({ agent: 'Theo', task: 'HOLD part two' }, { runId: maya.id, signal: a2.signal }).catch(() => undefined);
    await until(() => !!live.activeRun('theo'));
    const theo = live.activeRun('theo')!;
    expect(DELEGATION_DEPTH).toBe(2);
    await expect(delegation.delegate({ agent: 'Kenji', task: 'x x x' }, { runId: theo.id, signal: sig() })).rejects.toThrow(/at most 2 levels/);
    // stopping the delegating run's tool stops the colleague's run it started
    a1.abort();
    await until(() => live.getRun(maya.id)!.status === 'cancelled');
    a2.abort();
    await until(() => live.getRun(theo.id)!.status === 'cancelled');
    await live.cancel('alex');
  });

  it('waits in line when the colleague is busy, then hands over', async () => {
    const { live, delegation, root } = setup();
    const alex = root('alex');
    const theosOwn = root('theo', 'busy with my own work');
    let done = false;
    const p = delegation.delegate({ agent: 'Theo', task: 'Check the numbers.' }, { runId: alex.id, signal: new AbortController().signal }).then((r) => ((done = true), r));
    await tick();
    await tick();
    expect(done).toBe(false);
    expect(live.delegatedFrom(alex.id)).toEqual([]);
    await live.cancel('theo');
    const { run } = await p;
    expect(live.getRun(theosOwn.id)!.status).toBe('cancelled');
    expect(run).toMatchObject({ agentId: 'theo', status: 'completed', result: 'done by Theo' });
    await live.cancel('alex');
  });

  it('gives up after the wait limit; a chat may hand work to any agent', async () => {
    const { live, delegation, root } = setup({ 'chat-run-1': { conversationId: 'conv-1' } });
    root('kenji', 'busy');
    const alex = root('alex');
    await expect(delegation.delegate({ agent: 'Kenji', task: 'Help me.' }, { runId: alex.id, signal: new AbortController().signal })).rejects.toThrow(/stayed busy/);
    // a chat: every agent, any world
    expect(delegation.teamPrompt(undefined, true)).toContain('- Zoe, Grower');
    const { run } = await delegation.delegate({ agent: 'Zoe', task: 'How are the tomatoes?' }, { runId: 'chat-run-1', signal: new AbortController().signal });
    expect(run).toMatchObject({ agentId: 'zoe', status: 'completed', result: 'done by Zoe' });
    expect(live.getTask(run.taskId)!.delegatedBy).toEqual({ runId: 'chat-run-1', conversationId: 'conv-1' });
    expect(live.getTask(run.taskId)!.prompt).toContain('Task handed over by the user (chat)');
    await live.cancel('alex');
    await live.cancel('kenji');
  });
});

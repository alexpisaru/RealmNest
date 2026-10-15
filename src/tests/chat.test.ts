import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { AgentDefinition } from '../domain/agent';
import { conversationTitle } from '../domain/conversation';
import { MemoryAdapter } from '../persistence/storage';
import { ChatError, ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository, type ChatSnapshot } from '../runtime/chat/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';

// Fake providers only; the real Claude conversation is tested by hand (docs/CHAT.md).

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: true, local: false, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** keeps its own sessions, like Claude Code: replies with what it remembers */
class SessionProvider implements AIProvider {
  readonly name = 'Sessions';
  readonly capabilities = CAPS;
  requests: ProviderTurnRequest[] = [];
  sessions = new Map<string, string[]>();
  private n = 0;
  /** what the next turns do instead of answering */
  mode: 'answer' | 'fail' | 'hang' = 'answer';
  constructor(readonly id = 'claude-code') {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    let seq = 0;
    const out = (b: ProviderEventBody) => ({ ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 }) as ProviderEvent;
    yield out({ type: 'provider.started' });
    let id: string;
    if (req.session?.mode === 'resume') {
      if (!this.sessions.has(req.session.id)) {
        yield out({ type: 'run.failed', error: { code: 'session_not_found', message: 'gone' } });
        return;
      }
      id = req.session.id;
    } else {
      id = `sess-${++this.n}`;
      if (req.session) this.sessions.set(id, []);
    }
    yield out({ type: 'session.started', sessionId: id, resumed: req.session?.mode === 'resume' });
    const memory = this.sessions.get(id) ?? [];
    memory.push(req.messages.at(-1)!.content);
    if (this.mode === 'fail') {
      yield out({ type: 'run.failed', error: { code: 'api_error', message: 'Claude returned an error.' } });
      return;
    }
    yield out({ type: 'text.delta', messageId: 'm', index: 0, text: 'I remember: ' });
    await tick();
    if (this.mode === 'hang') {
      await new Promise<void>((r) => (req.abortSignal?.aborted ? r() : req.abortSignal?.addEventListener('abort', () => r())));
      yield out({ type: 'run.cancelled', reason: 'Cancelled.' });
      yield out({ type: 'run.completed', text: 'too late' });
      return;
    }
    const text = `I remember: ${memory.join(' | ')}`;
    yield out({ type: 'text.delta', messageId: 'm', index: 0, text: memory.join(' | ') });
    yield out({ type: 'run.completed', text, sessionId: id });
  }
}

/** keeps nothing: answers with the number of messages it was sent */
class StatelessProvider implements AIProvider {
  readonly name = 'Stateless';
  readonly capabilities = { ...CAPS, sessions: false };
  requests: ProviderTurnRequest[] = [];
  constructor(readonly id = 'stateless') {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    yield { type: 'run.completed', text: `got ${req.messages.length}`, runId: req.runId, providerId: this.id, seq: 1, at: 0 };
  }
}

const AGENTS: Record<string, AgentDefinition> = {
  alex: { id: 'alex', connectionId: 'claude-code', model: 'sonnet', instructions: 'Answer briefly.', workspace: 'C:\\work', updatedAt: 0 },
};

function setup(storage = new MemoryAdapter()) {
  const bus = new EventBus(1000);
  const claude = new SessionProvider();
  const stateless = new StatelessProvider();
  const providers = new ProviderService(new ProviderRegistry().register(claude).register(stateless), bus);
  let n = 0;
  const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 10), {
    agent: (id) => AGENTS[id] ?? { id, connectionId: 'claude-code', updatedAt: 0 },
    identity: (id) => (id === 'alex' ? { name: 'Alex', role: 'Developer' } : undefined),
    newId: (k) => `${k}-${++n}`,
  });
  const types = () => [...bus.log].reverse().map((e) => e.type);
  return { bus, chat, claude, stateless, storage, types };
}

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

async function turn(chat: ConversationRuntime, id: string, text: string) {
  const { run } = chat.send(id, text);
  await until(() => !chat.isBusy(id));
  return chat.run(run.id)!;
}

describe('conversations', () => {
  it('an agent chat takes provider, model and workspace from the agent', () => {
    const { chat, types } = setup();
    const c = chat.create({ agentId: 'alex' });
    expect(c).toMatchObject({ agentId: 'alex', connectionId: 'claude-code', providerId: 'claude-code', model: 'sonnet', workspace: 'C:\\work', title: 'New conversation', messages: [] });
    expect(types()).toContain('conversation.created');
  });

  it('a direct chat needs only a provider (from the registry) and maybe a model', () => {
    const { chat } = setup();
    const c = chat.create({ connectionId: 'stateless', model: 'small' });
    expect(c.agentId).toBeUndefined();
    expect(c).toMatchObject({ providerId: 'stateless', model: 'small' });
    expect(() => chat.create({ connectionId: 'nope' })).toThrow(ChatError);
  });

  it('streams the reply, keeps message order, titles the conversation, records the run', async () => {
    const { chat, bus } = setup();
    const c = chat.create({ agentId: 'alex' });
    const deltas: string[] = [];
    bus.on('conversation.output.delta', (p) => deltas.push(p.text));
    const { user, assistant, run } = chat.send(c.id, 'Help me design the provider architecture for RealmNest please');
    expect(assistant.status).toBe('streaming');
    await until(() => deltas.length === 1);
    expect(chat.get(c.id)!.messages.at(-1)!.content).toBe('I remember: ');
    await until(() => !chat.isBusy(c.id));
    const conv = chat.get(c.id)!;
    expect(conv.title).toBe('Help me design the provider architecture for');
    expect(conv.messages.map((m) => [m.role, m.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
    expect(conv.messages[1].content).toBe('I remember: Help me design the provider architecture for RealmNest please');
    expect(chat.run(run.id)).toMatchObject({ status: 'completed', userMessageId: user.id, assistantMessageId: assistant.id, resumed: false });
    expect(conv.providerSession).toEqual({ providerId: 'claude-code', id: 'sess-1', state: 'active' });
  });

  it('continues the same provider session; only the new message is sent', async () => {
    const { chat, claude } = setup();
    const c = chat.create({ agentId: 'alex' });
    await turn(chat, c.id, 'my favourite number is 37');
    const second = await turn(chat, c.id, 'what is my favourite number?');
    expect(claude.requests.map((r) => r.session)).toEqual([{ mode: 'new' }, { mode: 'resume', id: 'sess-1' }]);
    expect(claude.requests[1].messages).toEqual([{ role: 'user', content: 'what is my favourite number?' }]);
    expect(second.resumed).toBe(true);
    expect(chat.get(c.id)!.messages.at(-1)!.content).toContain('37');
  });

  it('keeps conversations isolated: one provider session each', async () => {
    const { chat } = setup();
    const a = chat.create({ agentId: 'alex' });
    const b = chat.create({ agentId: 'alex' });
    await turn(chat, a.id, 'the secret word is ORCHID');
    await turn(chat, b.id, 'what is the secret word?');
    expect(chat.get(a.id)!.providerSession!.id).not.toBe(chat.get(b.id)!.providerSession!.id);
    expect(chat.get(b.id)!.messages.at(-1)!.content).not.toContain('ORCHID');
  });

  it('applies agent instructions on every turn without storing them as messages', async () => {
    const { chat, claude } = setup();
    const c = chat.create({ agentId: 'alex' });
    await turn(chat, c.id, 'one');
    await turn(chat, c.id, 'two');
    for (const r of claude.requests) {
      expect(r.systemPrompt).toContain('You are Alex, Developer');
      expect(r.systemPrompt).toContain('Answer briefly.');
      expect(r.model).toBe('sonnet');
      expect(r.workspace).toBe('C:\\work');
    }
    expect(chat.get(c.id)!.messages.some((m) => m.content.includes('Answer briefly'))).toBe(false);
  });

  it('sends the whole history to providers without sessions', async () => {
    const { chat, stateless } = setup();
    const c = chat.create({ connectionId: 'stateless' });
    await turn(chat, c.id, 'a');
    await turn(chat, c.id, 'b');
    expect(stateless.requests[1].session).toBeUndefined();
    expect(stateless.requests[1].messages).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'got 1' },
      { role: 'user', content: 'b' },
    ]);
    expect(stateless.requests[1].systemPrompt).toBeUndefined(); // direct chat: no agent prompt
  });
});

describe('stopping and failures', () => {
  it('stop keeps the partial reply, cancels the run, and the next turn works', async () => {
    const { chat, claude, types } = setup();
    const c = chat.create({ agentId: 'alex' });
    claude.mode = 'hang';
    const { run } = chat.send(c.id, 'write a long essay');
    await until(() => chat.get(c.id)!.messages.at(-1)!.content === 'I remember: ');
    await chat.stop(c.id);
    await until(() => !chat.isBusy(c.id));
    expect(chat.run(run.id)!.status).toBe('cancelled');
    expect(chat.get(c.id)!.messages.at(-1)).toMatchObject({ status: 'cancelled', content: 'I remember: ' });
    expect(types()).toContain('conversation.run.cancelled');
    expect(types()).not.toContain('conversation.run.completed');
    claude.mode = 'answer';
    expect((await turn(chat, c.id, 'again')).status).toBe('completed');
  });

  it('a failed turn keeps the user message, marks the reply failed, and the conversation goes on', async () => {
    const { chat, claude } = setup();
    const c = chat.create({ agentId: 'alex' });
    await turn(chat, c.id, 'first');
    claude.mode = 'fail';
    const failed = await turn(chat, c.id, 'second');
    expect(failed).toMatchObject({ status: 'failed', error: { code: 'api_error' } });
    const msgs = chat.get(c.id)!.messages;
    expect(msgs.at(-2)).toMatchObject({ role: 'user', content: 'second', status: 'complete' });
    expect(msgs.at(-1)).toMatchObject({ role: 'assistant', status: 'failed', error: { code: 'api_error' } });
    expect(chat.get(c.id)!.providerSession!.state).toBe('active'); // the session itself is fine
    claude.mode = 'answer';
    expect((await turn(chat, c.id, 'third')).resumed).toBe(true);
  });

  it('a session the provider lost blocks the conversation until a new session is chosen', async () => {
    const { chat, claude } = setup();
    const c = chat.create({ agentId: 'alex' });
    await turn(chat, c.id, 'remember ORCHID');
    claude.sessions.clear(); // e.g. the provider's history was deleted
    const r = await turn(chat, c.id, 'what is the word?');
    expect(r.error?.code).toBe('session_not_found');
    expect(chat.get(c.id)!.providerSession!.state).toBe('lost');
    expect(() => chat.send(c.id, 'hello?')).toThrow(/new session/);
    chat.startNewSession(c.id);
    expect(chat.get(c.id)!.messages.at(-1)).toMatchObject({ role: 'system' });
    await turn(chat, c.id, 'hello again');
    expect(claude.requests.at(-1)!.session).toEqual({ mode: 'new' });
    expect(chat.get(c.id)!.providerSession).toMatchObject({ id: 'sess-2', state: 'active' });
  });

  it('the provider cannot change once the conversation has started; the model can', async () => {
    const { chat } = setup();
    const c = chat.create({ agentId: 'alex' });
    chat.configure(c.id, { connectionId: 'stateless' });
    chat.configure(c.id, { connectionId: 'claude-code' });
    await turn(chat, c.id, 'hi');
    expect(() => chat.configure(c.id, { connectionId: 'stateless' })).toThrow(ChatError);
    chat.configure(c.id, { model: 'opus' });
    expect(chat.get(c.id)!.model).toBe('opus');
    chat.configure(c.id, { model: ' ' });
    expect(chat.get(c.id)!.model).toBeUndefined();
  });
});

describe('persistence', () => {
  it('survives a restart and continues the same provider session', async () => {
    const storage = new MemoryAdapter();
    const first = setup(storage);
    const c = first.chat.create({ agentId: 'alex' });
    await turn(first.chat, c.id, 'the secret word is ORCHID');
    await first.chat['repo'].flush(first.chat.snapshot);

    const second = setup(storage);
    second.claude.sessions = first.claude.sessions; // the provider kept its sessions
    await second.chat.init();
    const restored = second.chat.get(c.id)!;
    expect(restored.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(restored.providerSession).toMatchObject({ id: 'sess-1', state: 'active' });
    await turn(second.chat, c.id, 'repeat the secret word');
    expect(second.claude.requests[0].session).toEqual({ mode: 'resume', id: 'sess-1' });
    expect(second.chat.get(c.id)!.messages.at(-1)!.content).toContain('ORCHID');
  });

  it('a reply cut short by closing RealmNest comes back as failed', async () => {
    const storage = new MemoryAdapter();
    // saved before connections existed: no connectionId (migrated on load)
    const snap = {
      version: 1,
      conversations: [{ id: 'c1', title: 't', providerId: 'claude-code', createdAt: 1, updatedAt: 1, messages: [{ id: 'm1', conversationId: 'c1', role: 'assistant', content: 'half', status: 'streaming', createdAt: 1, runId: 'r1' }] }],
      runs: [{ id: 'r1', conversationId: 'c1', userMessageId: 'u', assistantMessageId: 'm1', providerId: 'claude-code', status: 'running', resumed: false, createdAt: 1 }],
    };
    await storage.set('conversations', snap as unknown as ChatSnapshot);
    const { chat } = setup(storage);
    await chat.init();
    expect(chat.get('c1')!.connectionId).toBe('claude-code');
    expect(chat.get('c1')!.messages[0]).toMatchObject({ status: 'failed', content: 'half', error: { code: 'interrupted' } });
    expect(chat.run('r1')!.status).toBe('failed');
    expect(chat.isBusy('c1')).toBe(false);
  });

  it('chat never makes a character work in the world', async () => {
    const { chat, types } = setup();
    const c = chat.create({ agentId: 'alex' });
    await turn(chat, c.id, 'hi');
    expect(types().filter((t) => t.startsWith('agent.'))).toEqual([]);
  });
});

describe('titles', () => {
  it('uses the first user message, cut at a word', () => {
    expect(conversationTitle('Help me design the provider architecture...')).toBe('Help me design the provider architecture');
    expect(conversationTitle('  Hi!\nsecond line')).toBe('Hi');
    expect(conversationTitle('x'.repeat(70))).toHaveLength(48);
    expect(conversationTitle('   ')).toBe('New conversation');
  });
});

describe('chat: hardening (docs/HARDENING.md R-11)', () => {
  it('a throw while the request is built ends the turn failed: the chat is never stuck streaming', async () => {
    const bus = new EventBus(1000);
    const providers = new ProviderService(new ProviderRegistry().register(new StatelessProvider()), bus);
    let broken = true;
    const knowledge = {
      validSelection: () => {
        if (broken) throw new Error('Knowledge exploded');
        return undefined;
      },
    };
    const chat = new ConversationRuntime(bus, providers, new ConversationRepository(new MemoryAdapter(), 10), { knowledge: knowledge as never });
    const c = chat.create({ connectionId: 'stateless' });
    const { run, assistant } = chat.send(c.id, 'Hello');
    await until(() => !chat.isBusy(c.id));
    expect(chat.run(run.id)).toMatchObject({ status: 'failed', error: { code: 'internal', message: 'Knowledge exploded' } });
    expect(chat.get(c.id)!.messages.find((m) => m.id === assistant.id)!.status).toBe('failed');
    broken = false;
    expect((await turn(chat, c.id, 'Again')).status).toBe('completed');
  });
});

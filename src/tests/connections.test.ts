import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { AIConnection } from '../domain/connection';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { COMING_SOON, ProviderCatalog, type ProviderDefinition } from '../runtime/connections/catalog';
import { ConnectionError, ConnectionManager } from '../runtime/connections/manager';
import { UnavailableSecretStore, type SecretStore } from '../runtime/connections/secrets';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec } from '../runtime/process/types';
import { claudeCodeDefinition } from '../runtime/providers/claude-code/definition';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';

// Connections over the real Claude Code adapter with a scripted CLI (no real processes).

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'claude-code', name), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));

/** answers like the Claude CLI; `signedIn` per config folder ('' = the default sign-in) */
class FakeClaudeCli implements ProcessRunner {
  readonly available = true;
  calls: ProcessSpec[] = [];
  signedIn = new Map<string, boolean>([['', true]]);
  installed = true;
  async locate() {
    return this.installed ? { found: true, path: 'C:\\claude\\claude.exe', source: 'desktop-app' } : { found: false };
  }
  async run(spec: ProcessSpec, cb: ProcessCallbacks = {}): Promise<ProcessEnd> {
    this.calls.push(spec);
    if (!this.installed) return { kind: 'spawn_error', code: 'not_found', message: 'claude was not found' };
    const dir = spec.env?.CLAUDE_CONFIG_DIR ?? '';
    const out = (s: string) => (cb.onSpawn?.(), cb.onStdout?.(s));
    if (spec.args[0] === '--version') return out('2.1.293 (Claude Code)\n'), { kind: 'exit', code: 0, signal: null };
    if (spec.args[0] === 'auth') {
      const ok = this.signedIn.get(dir) ?? false;
      out(JSON.stringify(ok ? { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max', email: 'someone@example.com' } : { loggedIn: false, authMethod: 'none' }));
      return { kind: 'exit', code: ok ? 0 : 1, signal: null };
    }
    out(fixture('success-real.jsonl'));
    return { kind: 'exit', code: 0, signal: null };
  }
}

class MemorySecrets implements SecretStore {
  readonly available = true;
  values = new Map<string, string>();
  async set(n: string, v: string) {
    this.values.set(n, v);
  }
  async delete(n: string) {
    this.values.delete(n);
  }
  async has(n: string) {
    return this.values.has(n);
  }
}

/** a provider with an API key and a model list (stands in for a future OpenRouter) */
const keyedDefinition: ProviderDefinition = {
  id: 'keyed',
  name: 'Keyed AI',
  vendor: 'Example',
  description: 'test',
  availability: 'available',
  methods: [{ id: 'api-key', label: 'API key', description: '', fields: [{ key: 'apiKey', label: 'API key', kind: 'secret', required: true }] }],
  create: (c): AIProvider => ({
    id: 'keyed',
    name: 'Keyed AI',
    capabilities: { streaming: true, tools: false, vision: true, sessions: false, local: false, usage: true, cost: true, cancellation: true, modelListing: true, systemPrompt: true },
    getStatus: async () => ({ state: c.secretNames.length ? 'available' : 'not_authenticated', message: 'ok', checkedAt: 0 }),
    listModels: async () => [{ id: 'small' }, { id: 'large' }],
    async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
      yield { type: 'run.completed', text: 'keyed ok', runId: req.runId, providerId: 'keyed', seq: 1, at: 0 };
    },
  }),
};

function setup(storage = new MemoryAdapter(), cli = new FakeClaudeCli(), secrets: SecretStore = new MemorySecrets()) {
  const bus = new EventBus(2000);
  const catalog = new ProviderCatalog().register(claudeCodeDefinition).register(keyedDefinition);
  COMING_SOON.forEach((d) => catalog.register(d));
  let n = 0;
  const connections = new ConnectionManager(bus, catalog, storage, { runner: cli, secrets }, { seedProviderId: 'claude-code', newId: () => `conn-${++n}` });
  const providers = new ProviderService(new ProviderRegistry(), bus, (id) => connections.provider(id));
  return { bus, storage, cli, secrets, catalog, connections, providers };
}

describe('connections', () => {
  it('turns the existing Claude Code sign-in into the first connection, once', async () => {
    const storage = new MemoryAdapter();
    const a = setup(storage);
    await a.connections.init();
    expect(a.connections.list()).toEqual([expect.objectContaining({ id: 'conn-1', providerId: 'claude-code', name: 'Claude', method: 'cli-session', status: 'unknown' })]);
    await a.connections.remove('conn-1');
    const b = setup(storage);
    await b.connections.init();
    expect(b.connections.list()).toEqual([]); // deleted on purpose: not recreated
    expect(b.connections.list({ includeRemoved: true })).toHaveLength(1);
  });

  it('validates for real, maps the state, and never trusts a saved status', async () => {
    const storage = new MemoryAdapter();
    const a = setup(storage);
    await a.connections.init();
    const c = await a.connections.validate('conn-1');
    expect(c).toMatchObject({ status: 'connected', account: 'Claude account · max', version: '2.1.293' });
    expect(JSON.stringify(c)).not.toContain('someone@example.com');

    const b = setup(storage);
    await b.connections.init();
    expect(b.connections.get('conn-1')!.status).toBe('unknown'); // saved as connected, not trusted
    b.cli.signedIn.set('', false);
    expect((await b.connections.validate('conn-1')).status).toBe('auth_required');
    b.cli.installed = false;
    expect((await b.connections.validate('conn-1')).status).toBe('unavailable');
    const events = [...b.bus.log].reverse().filter((e) => e.type === 'connection.status.changed').map((e) => (e.payload as { to: string }).to);
    expect(events).toEqual(['checking', 'auth_required', 'checking', 'unavailable']);
  });

  it('supports several connections of one provider, each with its own sign-in', async () => {
    const { connections, cli } = setup();
    await connections.init();
    const work = await connections.create({ providerId: 'claude-code', method: 'cli-session', name: 'Work Claude', values: { configDir: 'D:\\Claude\\work' } });
    cli.signedIn.set('D:\\Claude\\work', false);
    await connections.validate('conn-1');
    await connections.validate(work.id);
    expect(connections.get('conn-1')!.status).toBe('connected');
    expect(connections.get(work.id)!.status).toBe('auth_required');
    expect(connections.get(work.id)!.statusHint).toContain('CLAUDE_CONFIG_DIR="D:\\Claude\\work"');
    expect(connections.provider('conn-1')).not.toBe(connections.provider(work.id));
    // the work connection's processes get its own config folder, the default one gets none
    const authCalls = cli.calls.filter((c) => c.args[0] === 'auth');
    expect(authCalls.map((c) => c.env?.CLAUDE_CONFIG_DIR)).toEqual(expect.arrayContaining([undefined, 'D:\\Claude\\work']));
  });

  it('rejects bad settings, unknown or unfinished providers, and empty names', async () => {
    const { connections } = setup();
    await connections.init();
    await expect(connections.create({ providerId: 'claude-code', method: 'cli-session', name: 'x', values: { configDir: 'relative\\dir' } })).rejects.toThrow(/full path/);
    await expect(connections.create({ providerId: 'google', method: 'api-key', name: 'x' })).rejects.toThrow(ConnectionError);
    await expect(connections.create({ providerId: 'claude-code', method: 'api-key', name: 'x' })).rejects.toThrow(/does not support/);
    await expect(connections.create({ providerId: 'claude-code', method: 'cli-session', name: '  ' })).rejects.toThrow(/name/);
    expect(connections.catalog.list().find((d) => d.id === 'google')!.availability).toBe('coming-soon');
  });

  it('keeps secrets in the secret store only, and refuses them without one', async () => {
    const storage = new MemoryAdapter();
    const { connections, secrets, bus } = setup(storage);
    await connections.init();
    const c = await connections.create({ providerId: 'keyed', method: 'api-key', name: 'My key', values: { apiKey: 'sk-very-secret-123' } });
    expect((secrets as MemorySecrets).values.get(`conn.${c.id}.apiKey`)).toBe('sk-very-secret-123');
    expect(c.secretNames).toEqual([`conn.${c.id}.apiKey`]);
    const saved = JSON.stringify(await storage.get('connections'));
    expect(saved).not.toContain('sk-very-secret-123');
    expect(JSON.stringify(bus.log)).not.toContain('sk-very-secret-123');
    expect(JSON.stringify(connections.summaries())).not.toContain('sk-very-secret-123');
    await connections.remove(c.id);
    expect((secrets as MemorySecrets).values.size).toBe(0);

    const browser = setup(new MemoryAdapter(), new FakeClaudeCli(), new UnavailableSecretStore());
    await browser.connections.init();
    await expect(browser.connections.create({ providerId: 'keyed', method: 'api-key', name: 'k', values: { apiKey: 'x' } })).rejects.toThrow(/desktop app/);
    expect(await browser.storage.get('connections')).not.toMatchObject({ connections: [expect.objectContaining({ providerId: 'keyed' })] });
  });

  it('takes a capability snapshot and a model list when the provider has one', async () => {
    const { connections } = setup();
    await connections.init();
    const claude = await connections.validate('conn-1');
    // descriptors with provenance; images and PDFs go in as stream-json content blocks
    const support = Object.fromEntries(Object.entries(claude.capabilities!).map(([k, d]) => [k, d!.support]));
    expect(support).toMatchObject({ 'text.chat': 'supported', 'sessions.native': 'supported', coding: 'supported', 'image.generate': 'unsupported' });
    expect(claude.capabilities!['vision.input']).toMatchObject({ support: 'supported' }); // image blocks on stream-json input
    expect(claude.capabilities!['sessions.native']!.source).toMatchObject({ level: 'provider', origin: 'Claude Code', via: 'native' });
    // the Claude models (the CLI cannot list them; RealmNest's catalogue)
    expect(connections.models('conn-1').map((m) => m.id)).toContain('claude-fable-5-1');
    const keyed = await connections.create({ providerId: 'keyed', method: 'api-key', name: 'k', values: { apiKey: 'x' } });
    await connections.validate(keyed.id);
    expect(connections.models(keyed.id)).toEqual([{ id: 'small' }, { id: 'large' }]);
    expect(connections.get(keyed.id)!.modelCatalog).toMatchObject({ count: 2 });
    await connections.update(keyed.id, { preferredModel: 'large', name: 'Keyed work' });
    expect(connections.get(keyed.id)).toMatchObject({ preferredModel: 'large', name: 'Keyed work' });
    await connections.update(keyed.id, { preferredModel: '' });
    expect(connections.get(keyed.id)!.preferredModel).toBeUndefined();
  });

  it('runs turns on a connection and stamps its id on provider events', async () => {
    const { connections, providers, bus } = setup();
    await connections.init();
    const run = providers.run('conn-1', { messages: [{ role: 'user', content: 'hi' }] });
    const done = await run.done;
    expect(done.type).toBe('run.completed');
    expect(run).toMatchObject({ providerId: 'claude-code', connectionId: 'conn-1' });
    expect((bus.log.find((e) => e.type === 'provider.event')!.payload as ProviderEvent).connectionId).toBe('conn-1');
  });
});

describe('chat and agents on connections', () => {
  async function app(storage = new MemoryAdapter()) {
    const s = setup(storage);
    await s.connections.init();
    const opts = { legacyConnection: (p: string) => s.connections.forLegacyProvider(p), defaultConnection: () => s.connections.defaultId() };
    const live = new LiveRuntime(s.bus, s.providers, new RuntimeRepository(storage, 5), { ...opts, identity: () => ({ name: 'Alex', role: 'Developer' }) });
    const chat = new ConversationRuntime(s.bus, s.providers, new ConversationRepository(storage, 5), { ...opts, agent: (id) => live.agent(id) });
    await live.init();
    await chat.init();
    return { ...s, live, chat };
  }
  const until = async (cond: () => boolean) => {
    for (let i = 0; i < 300 && !cond(); i++) await tick();
    expect(cond()).toBe(true);
  };

  it('migrates agents and conversations saved with a provider id', async () => {
    const storage = new MemoryAdapter();
    await storage.set('runtime', { version: 1, agents: [{ id: 'alex', providerId: 'claude-code', model: 'sonnet', updatedAt: 1 }], tasks: [], runs: [] });
    await storage.set('conversations', { version: 1, conversations: [{ id: 'c1', title: 'old', providerId: 'claude-code', providerSession: { providerId: 'claude-code', id: 's-1', state: 'active' }, createdAt: 1, updatedAt: 1, messages: [] }], runs: [] });
    const { live, chat } = await app(storage);
    expect(live.agent('alex')).toMatchObject({ connectionId: 'conn-1', model: 'sonnet' });
    expect((live.agent('alex') as unknown as { providerId?: string }).providerId).toBeUndefined();
    expect(chat.get('c1')).toMatchObject({ connectionId: 'conn-1', providerSession: { id: 's-1' } });
  });

  it('writes the migration back without losing tasks, runs or messages', async () => {
    const storage = new MemoryAdapter();
    const task = { id: 't1', agentId: 'alex', title: 'old task', prompt: 'p', status: 'completed', runIds: ['r1'], createdAt: 1, updatedAt: 1 };
    const run = { id: 'r1', taskId: 't1', agentId: 'alex', providerId: 'claude-code', status: 'completed', createdAt: 1, output: 'done', result: 'done' };
    const msg = { id: 'm1', conversationId: 'c1', role: 'user', content: 'hello', status: 'complete', createdAt: 1 };
    const crun = { id: 'cr1', conversationId: 'c1', userMessageId: 'm1', assistantMessageId: 'm2', providerId: 'claude-code', status: 'completed', resumed: false, createdAt: 1 };
    await storage.set('runtime', { version: 1, agents: [{ id: 'alex', providerId: 'claude-code', updatedAt: 1 }], tasks: [task], runs: [run] });
    await storage.set('conversations', { version: 1, conversations: [{ id: 'c1', title: 'old', providerId: 'claude-code', createdAt: 1, updatedAt: 1, messages: [msg] }], runs: [crun] });
    await app(storage);
    const rt = (await storage.get<{ agents: { connectionId?: string }[]; tasks: unknown[]; runs: unknown[] }>('runtime'))!;
    const cv = (await storage.get<{ conversations: { connectionId?: string; messages: unknown[] }[]; runs: unknown[] }>('conversations'))!;
    expect(rt.agents[0].connectionId).toBe('conn-1');
    expect(rt.tasks).toHaveLength(1);
    expect(rt.runs).toHaveLength(1);
    expect(cv.conversations[0]).toMatchObject({ connectionId: 'conn-1', messages: [expect.objectContaining({ content: 'hello' })] });
    expect(cv.runs).toHaveLength(1);
  });

  it('new agents and chats use the connection; turns and tasks really run on it', async () => {
    const { live, chat, connections } = await app();
    await connections.validate('conn-1');
    expect(live.agent('bea').connectionId).toBe('conn-1');
    const c = chat.create({ agentId: 'bea' });
    expect(c).toMatchObject({ connectionId: 'conn-1', providerId: 'claude-code' });
    chat.send(c.id, 'hello');
    await until(() => !chat.isBusy(c.id));
    expect(chat.get(c.id)!.messages.at(-1)).toMatchObject({ status: 'complete', content: 'RealmNest provider test successful.' });
    const direct = chat.create({ connectionId: 'conn-1' });
    expect(direct.agentId).toBeUndefined();
    const { run } = live.startTask('bea', { prompt: 'x' });
    await until(() => live.getRun(run.id)!.status === 'completed');
    expect(live.getRun(run.id)).toMatchObject({ connectionId: 'conn-1', providerId: 'claude-code' });
  });

  it('a removed connection keeps history but cannot be used', async () => {
    const { live, chat, connections } = await app();
    const c = chat.create({ agentId: 'alex' });
    chat.send(c.id, 'hello');
    await until(() => !chat.isBusy(c.id));
    await connections.remove('conn-1');
    expect(chat.get(c.id)!.messages).toHaveLength(2); // history kept
    expect(() => chat.send(c.id, 'again')).toThrow(/no longer available/);
    expect(() => live.startTask('alex', { prompt: 'x' })).toThrow(/no usable AI connection/);
    expect(connections.get('conn-1')).toMatchObject({ status: 'disconnected', removedAt: expect.any(Number) });
    expect(connections.forLegacyProvider('claude-code')).toBe('conn-1'); // still names the history
  });
});

describe('restart', () => {
  it('connections come back and are checked again', async () => {
    const storage = new MemoryAdapter();
    const first = setup(storage);
    await first.connections.init();
    await first.connections.create({ providerId: 'claude-code', method: 'cli-session', name: 'Alex Claude 2' });
    await tick();
    const second = setup(storage);
    await second.connections.init();
    const names = second.connections.list().map((c: AIConnection) => [c.name, c.status]);
    expect(names).toEqual([
      ['Claude', 'unknown'],
      ['Alex Claude 2', 'unknown'],
    ]);
    await second.connections.validateAll();
    expect(second.connections.list().every((c) => c.status === 'connected')).toBe(true);
  });
});

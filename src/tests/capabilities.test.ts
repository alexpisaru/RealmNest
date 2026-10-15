import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { CapabilityService, RoutingError } from '../runtime/capabilities/service';
import { modelCapabilities, modelSupport } from '../runtime/capabilities/model';
import { realmnestReadiness } from '../runtime/capabilities/readiness';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { ProviderCatalog } from '../runtime/connections/catalog';
import { ConnectionManager } from '../runtime/connections/manager';
import type { SecretStore } from '../runtime/connections/secrets';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec } from '../runtime/process/types';
import { claudeCodeDefinition } from '../runtime/providers/claude-code/definition';
import { createOpenRouterDefinition } from '../runtime/providers/openrouter/definition';
import type { OpenRouterTransport, OrChatRequest, OrStreamEvent, OrValidation } from '../runtime/providers/openrouter/transport';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { ModelInfo } from '../runtime/providers/types';

// Capabilities and routing over the real Claude Code and OpenRouter definitions,
// with a scripted CLI and a scripted OpenRouter host (no network, no processes).

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 300 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

/** the live catalogue fixture, normalized the way the Rust host does it (reasoning object included) */
const RAW = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'openrouter', 'models.sample.json'), 'utf8')).data as {
  id: string;
  name: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
  reasoning?: { mandatory?: boolean; supported_efforts?: string[] };
}[];
const CATALOG: ModelInfo[] = RAW.map((m) => ({
  id: m.id,
  label: m.name,
  inputModalities: m.architecture?.input_modalities ?? [],
  outputModalities: m.architecture?.output_modalities ?? [],
  supportedParameters: m.supported_parameters ?? [],
  ...(m.reasoning && { reasoning: { mandatory: m.reasoning.mandatory, efforts: m.reasoning.supported_efforts ?? [] } }),
}));
/** shapes seen in the live catalogue that the 4-model fixture lacks */
const TEXT_ONLY: ModelInfo = { id: 'acme/plain-7b', inputModalities: ['text'], outputModalities: ['text'], supportedParameters: ['max_tokens', 'temperature', 'stop'] };
const NO_PARAMS: ModelInfo = { id: 'acme/mystery', inputModalities: ['text'], outputModalities: ['text'], supportedParameters: [] };
const IMAGE_ONLY: ModelInfo = { id: 'acme/painter', inputModalities: ['text'], outputModalities: ['image'], supportedParameters: ['seed'] };

const byId = (id: string) => [...CATALOG, TEXT_ONLY, NO_PARAMS, IMAGE_ONLY].find((m) => m.id === id)!;

class FakeHost implements OpenRouterTransport {
  readonly available = true;
  keys = new Map<string, string>();
  catalog: ModelInfo[] = [...CATALOG, TEXT_ONLY, NO_PARAMS, IMAGE_ONLY];
  requests: { connectionId: string; request: OrChatRequest }[] = [];
  async validate(connectionId: string): Promise<OrValidation> {
    const k = this.keys.get(connectionId);
    if (!k) return { status: 'missing_key', message: 'No API key is stored for this connection.' };
    return k.startsWith('sk-or-good') ? { status: 'connected', message: 'ok', freeTier: true } : { status: 'invalid_credentials', message: 'OpenRouter rejected the API key.' };
  }
  async models() {
    return this.catalog;
  }
  private n = 0;
  async chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push({ connectionId, request });
    setTimeout(() => {
      onEvent({ t: 'start', model: request.model });
      onEvent({ t: 'delta', d: 'RealmNest capability routing successful.' });
      onEvent({ t: 'done', finishReason: 'stop' });
    }, 0);
    return `or${++this.n}`;
  }
  async cancel() {
    return true;
  }
}

class Vault implements SecretStore {
  readonly available = true;
  constructor(private host: FakeHost) {}
  async set(name: string, value: string) {
    this.host.keys.set(name.split('.')[1], value);
  }
  async delete(name: string) {
    this.host.keys.delete(name.split('.')[1]);
  }
  async has(name: string) {
    return this.host.keys.has(name.split('.')[1]);
  }
}

/** answers like the Claude CLI (signed in), replies with a recorded run */
class FakeClaudeCli implements ProcessRunner {
  readonly available = true;
  calls: ProcessSpec[] = [];
  signedIn = true;
  async locate() {
    return { found: true, path: 'C:\\claude\\claude.exe', source: 'desktop-app' };
  }
  async run(spec: ProcessSpec, cb: ProcessCallbacks = {}): Promise<ProcessEnd> {
    this.calls.push(spec);
    const out = (s: string) => (cb.onSpawn?.(), cb.onStdout?.(s));
    if (spec.args[0] === '--version') return out('2.1.293 (Claude Code)\n'), { kind: 'exit', code: 0, signal: null };
    if (spec.args[0] === 'auth') return out(JSON.stringify(this.signedIn ? { loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' } : { loggedIn: false })), { kind: 'exit', code: this.signedIn ? 0 : 1, signal: null };
    out(readFileSync(join(__dirname, 'fixtures', 'claude-code', 'success-real.jsonl'), 'utf8'));
    return { kind: 'exit', code: 0, signal: null };
  }
}

const KEY = 'sk-or-good-test-0000';

async function setup(storage = new MemoryAdapter(), host = new FakeHost(), cli = new FakeClaudeCli()) {
  const bus = new EventBus(3000);
  const catalog = new ProviderCatalog().register(claudeCodeDefinition).register(createOpenRouterDefinition(host));
  let n = 0;
  const connections = new ConnectionManager(bus, catalog, storage, { runner: cli, secrets: new Vault(host) }, { seedProviderId: 'claude-code', newId: () => `conn-${++n}` });
  await connections.init();
  const capabilities = new CapabilityService(connections, bus, storage);
  await capabilities.init();
  const route = (cap: Parameters<CapabilityService['resolveRoute']>[0]) => capabilities.resolveRoute(cap);
  const providers = new ProviderService(new ProviderRegistry(), bus, (id) => connections.provider(id));
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(storage, 5), { identity: () => ({ name: 'Alex', role: 'Developer' }), defaultConnection: () => connections.defaultId(), route });
  const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), { agent: (id) => live.agent(id), identity: () => ({ name: 'Alex', role: 'Developer' }), route });
  await live.init();
  await chat.init();
  return { bus, storage, host, cli, connections, capabilities, providers, live, chat };
}

/** Claude (conn-1, seeded) + a validated OpenRouter connection with its catalogue */
async function withBoth(storage = new MemoryAdapter(), host = new FakeHost()) {
  const s = await setup(storage, host);
  await s.connections.validate('conn-1');
  const or = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter 2', values: { apiKey: KEY } });
  await until(() => s.connections.get(or.id)!.status === 'connected' && s.connections.models(or.id).length > 0);
  return { ...s, claude: 'conn-1', or: or.id };
}

describe('model capabilities from catalogue metadata', () => {
  it('reads vision, files, image output, tools, structured output and web search from metadata', () => {
    const auto = modelCapabilities(byId('openrouter/auto'), 'OpenRouter model catalogue');
    expect(auto).toMatchObject({
      'text.chat': { support: 'supported' },
      'vision.input': { support: 'supported' },
      'files.input': { support: 'supported' },
      'image.generate': { support: 'supported' },
      'tools.calling': { support: 'supported' },
      'structured.output': { support: 'supported' },
      'web.search': { support: 'supported', source: { level: 'model', origin: 'OpenRouter model catalogue', via: 'native' } },
      'text.reasoning': { support: 'supported' },
    });
    expect(auto['image.edit']).toBeUndefined(); // image output says nothing about editing
    const banana = modelCapabilities(byId('google/gemini-nano-banana-2.1'), 'x');
    expect(banana['image.generate']?.support).toBe('supported');
    expect(banana['web.search']).toBeUndefined(); // no web_search_options: unknown, not "no"
  });

  it('keeps the reasoning metadata as evidence', () => {
    const step = modelCapabilities(byId('stepfun/step-5-preview'), 'x')['text.reasoning']!;
    expect(step.support).toBe('supported');
    expect(step.source.evidence).toMatch(/always on.*high\/medium\/low/);
  });

  it('says unsupported only where the metadata proves it', () => {
    const plain = modelCapabilities(TEXT_ONLY, 'x');
    expect(plain).toMatchObject({
      'text.chat': { support: 'supported' },
      'vision.input': { support: 'unsupported' },
      'image.generate': { support: 'unsupported' },
      'image.edit': { support: 'unsupported' },
      'tools.calling': { support: 'unsupported' },
      'structured.output': { support: 'unsupported' },
    });
    expect(plain['text.reasoning']).toBeUndefined();
    expect(plain['web.search']).toBeUndefined();
  });

  it('leaves parameter-based capabilities unknown when the model lists no parameters', () => {
    expect(modelSupport(NO_PARAMS, 'tools.calling')).toBe('unknown');
    expect(modelSupport(NO_PARAMS, 'structured.output')).toBe('unknown');
    expect(modelSupport(NO_PARAMS, 'text.chat')).toBe('supported');
    expect(modelSupport({ id: 'bare' }, 'text.chat')).toBe('unknown'); // no modalities at all
  });

  it('never judges by name', () => {
    expect(modelCapabilities({ id: 'openai/gpt-vision-image-tools-search' }, 'x')).toEqual({});
  });

  it('does not chat with an image-only model', () => {
    expect(modelSupport(IMAGE_ONLY, 'text.chat')).toBe('unsupported');
    expect(modelSupport(IMAGE_ONLY, 'image.generate')).toBe('supported');
  });
});

describe('connection and effective capabilities', () => {
  it('describes Claude Code truthfully: images and PDFs in, no image generation', async () => {
    const { capabilities, connections, claude } = await withBoth();
    const conn = capabilities.connectionCapabilities(claude);
    expect(conn['text.chat']).toMatchObject({ support: 'supported', source: { level: 'provider', origin: 'Claude Code' } });
    expect(conn['vision.input']).toMatchObject({ support: 'supported', source: { evidence: expect.stringMatching(/stream-json/) } });
    expect(conn['image.generate']?.support).toBe('unsupported');
    expect(connections.get(claude)!.capabilities).toEqual(conn); // the stored snapshot is the same claims
    const eff = capabilities.effective(claude);
    expect(eff['vision.input']).toMatchObject({ support: 'supported', ready: true });
    expect(eff['files.input']).toMatchObject({ support: 'supported', ready: true });
    expect(eff['text.chat']).toMatchObject({ support: 'supported', available: true, ready: true });
    expect(eff['web.search']).toMatchObject({ support: 'supported', ready: false }); // supported ≠ usable in RealmNest
  });

  it('lets the model claim win over the connection claim, with both in the provenance', async () => {
    const { capabilities, or } = await withBoth();
    expect(capabilities.effective(or)['vision.input'].support).toBe('unknown'); // no model chosen
    const step = capabilities.effective(or, 'stepfun/step-5-preview');
    expect(step['vision.input']).toMatchObject({ support: 'supported', provenance: [{ level: 'model' }] });
    expect(step['text.chat'].provenance.map((p) => p.level)).toEqual(['model', 'provider']);
    expect(capabilities.effective(or, IMAGE_ONLY.id)['text.chat'].support).toBe('unsupported');
    expect(capabilities.effective(or, 'acme/plain-7b')['vision.input'].support).toBe('unsupported');
  });

  it('keeps supported, available and ready apart', async () => {
    const { capabilities, connections, or, host } = await withBoth();
    host.keys.set(or, 'sk-or-revoked');
    await connections.validate(or);
    const eff = capabilities.effective(or, 'openrouter/auto');
    expect(eff['vision.input']).toMatchObject({ support: 'supported', available: false });
    expect(eff['image.generate']).toMatchObject({ support: 'supported', ready: false });
  });

  it('splits the catalogue per capability without trimming it', async () => {
    const { capabilities, connections, or } = await withBoth();
    const vision = capabilities.modelsFor(or, 'vision.input');
    expect(vision.supported.map((m) => m.id).sort()).toEqual(['google/gemini-nano-banana-2.1', 'openrouter/auto', 'stepfun/step-5-preview']);
    expect(vision.unknown).toEqual([]);
    const tools = capabilities.modelsFor(or, 'tools.calling');
    expect(tools.unknown.map((m) => m.id)).toEqual(['acme/mystery']);
    expect(capabilities.modelsFor(or, 'text.chat').supported.map((m) => m.id)).not.toContain(IMAGE_ONLY.id);
    expect(connections.models(or)).toHaveLength(7);
  });

  it('offers only connections that may serve a capability', async () => {
    const { capabilities, claude, or } = await withBoth();
    expect(capabilities.connectionsFor('image.generate').map((c) => c.id)).toEqual([or]);
    expect(capabilities.connectionsFor('text.chat').map((c) => c.id)).toEqual([claude, or]);
  });

  it('knows what RealmNest can run today', () => {
    const a = { streaming: true, tools: false, vision: false, sessions: false, local: false, usage: true, cost: true, cancellation: true, modelListing: true, systemPrompt: true };
    expect(realmnestReadiness('text.chat', a).ready).toBe(true);
    expect(realmnestReadiness('sessions.native', a)).toMatchObject({ ready: false, note: expect.stringMatching(/replays/) });
    for (const c of ['web.search', 'image.generate', 'tools.calling', 'files.input'] as const) expect(realmnestReadiness(c, a).ready).toBe(false);
  });
});

describe('routing policy', () => {
  it('is empty by default: nothing routes on its own', async () => {
    const { capabilities } = await withBoth();
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'NO_ROUTE_CONFIGURED', checks: [] });
  });

  it('persists, survives a restart and is re-evaluated then', async () => {
    const storage = new MemoryAdapter();
    const host = new FakeHost();
    const a = await withBoth(storage, host);
    await a.capabilities.setRoute('text.chat', [{ connectionId: a.or, modelId: 'apodex/apodex-1.1-mini:free' }, { connectionId: a.claude }]);
    expect(a.bus.log.some((e) => e.type === 'routing.updated')).toBe(true);
    expect(a.capabilities.resolveRoute('text.chat')).toMatchObject({ ok: true, source: 'policy', target: { connectionId: a.or } });
    const b = await setup(storage, host);
    expect(b.capabilities.targets('text.chat')).toEqual([{ connectionId: a.or, modelId: 'apodex/apodex-1.1-mini:free' }, { connectionId: a.claude }]);
    // statuses are not trusted after a restart: checked again, not assumed
    expect(b.capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'CONNECTION_CHECKING' });
    await b.connections.validate(a.or);
    expect(b.capabilities.resolveRoute('text.chat')).toMatchObject({ ok: true, target: { connectionId: a.or } });
    expect(JSON.stringify(await storage.get('routing'))).not.toContain(KEY);
  });

  it('drops unknown capabilities and malformed targets from storage', async () => {
    const storage = new MemoryAdapter();
    await storage.set('routing', { version: 1, routes: { 'text.chat': [{ connectionId: 'x' }, { nope: 1 }, null], 'telepathy': [{ connectionId: 'y' }] } });
    const { capabilities } = await setup(storage);
    expect(capabilities.policy().routes).toEqual({ 'text.chat': [{ connectionId: 'x' }] });
  });

  it('refuses to route a non-routable capability', async () => {
    const { capabilities, claude } = await withBoth();
    await expect(capabilities.setRoute('text.streaming', [{ connectionId: claude }])).rejects.toBeInstanceOf(RoutingError);
  });

  it('uses a fallback only when the user configured one', async () => {
    const { capabilities, connections, host, or, claude } = await withBoth();
    host.keys.set(or, 'sk-or-revoked');
    await connections.validate(or);
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'openrouter/auto' }]);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'CONNECTION_UNAVAILABLE', reason: expect.stringMatching(/OpenRouter 2/) });
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'openrouter/auto' }, { connectionId: claude }]);
    const r = capabilities.resolveRoute('text.chat');
    expect(r).toMatchObject({ ok: true, source: 'fallback', target: { connectionId: claude } });
    expect(r.checks.map((c) => c.ok)).toEqual([false, true]);
    expect(capabilities.targets('text.chat')[0].connectionId).toBe(or); // the policy itself is untouched
  });

  it('reports a removed connection and never rewrites the route', async () => {
    const { capabilities, connections, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'openrouter/auto' }]);
    await connections.remove(or);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'CONNECTION_REMOVED' });
    expect(capabilities.targets('text.chat')).toEqual([{ connectionId: or, modelId: 'openrouter/auto' }]);
  });

  it('reports a model that vanished from the catalogue', async () => {
    const { capabilities, connections, host, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'apodex/apodex-1.1-mini:free' }]);
    host.catalog = host.catalog.filter((m) => m.id !== 'apodex/apodex-1.1-mini:free');
    await connections.refreshModels(or);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'MODEL_UNAVAILABLE', reason: expect.stringMatching(/apodex.*no longer/) });
  });

  it('reports a failed connection before asking for a model', async () => {
    const { capabilities, connections, host, or } = await withBoth();
    host.keys.set(or, 'sk-or-revoked');
    await connections.validate(or);
    await capabilities.setRoute('text.chat', [{ connectionId: or }]);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'CONNECTION_UNAVAILABLE', reason: 'OpenRouter 2: OpenRouter rejected the API key.' });
  });

  it('needs a model where the provider has no default', async () => {
    const { capabilities, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or }]);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'MODEL_REQUIRED' });
  });

  it('refuses a model that cannot do the capability', async () => {
    const { capabilities, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: IMAGE_ONLY.id }]);
    expect(capabilities.resolveRoute('text.chat')).toMatchObject({ ok: false, failure: 'CAPABILITY_UNSUPPORTED', checks: [{ support: 'unsupported' }] });
    await capabilities.setRoute('image.generate', [{ connectionId: 'conn-1' }]);
    expect(capabilities.resolveRoute('image.generate').failure).toBe('CAPABILITY_UNSUPPORTED'); // Claude Code says no
  });

  it('accepts a supported route RealmNest cannot run yet, and says so', async () => {
    const { capabilities, or } = await withBoth();
    await capabilities.setRoute('image.generate', [{ connectionId: or, modelId: 'google/gemini-nano-banana-2.1' }]);
    expect(capabilities.resolveRoute('image.generate')).toMatchObject({ ok: false, failure: 'NOT_READY', checks: [{ support: 'supported' }] });
  });

  it('routes to a model whose support is unknown, and says the provider did not state it', async () => {
    const { capabilities, or } = await withBoth();
    await capabilities.setRoute('coding', [{ connectionId: or, modelId: 'acme/mystery' }]);
    expect(capabilities.resolveRoute('coding')).toMatchObject({ ok: true, checks: [{ support: 'unknown', reason: /not stated/ }] });
  });

  it('checks requirements together', async () => {
    const { capabilities, or, claude } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: claude }]);
    expect(capabilities.canSatisfy(['text.chat']).ok).toBe(true);
    await capabilities.setRoute('web.search', [{ connectionId: or, modelId: 'openrouter/auto' }]);
    const deep = capabilities.canSatisfy(['text.chat', 'web.search']);
    expect(deep.ok).toBe(false);
    expect(deep.routes.map((r) => r.failure)).toEqual([undefined, 'NOT_READY']);
  });
});

describe('chat and agents on the routing policy', () => {
  it('Auto chat resolves text.chat once and records why', async () => {
    const { capabilities, chat, host, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'apodex/apodex-1.1-mini:free' }]);
    const c = chat.create({ auto: true });
    expect(c).toMatchObject({ connectionId: or, providerId: 'openrouter', model: 'apodex/apodex-1.1-mini:free', routedBy: { capability: 'text.chat', source: 'policy' } });
    chat.send(c.id, 'Reply exactly with: "RealmNest capability routing successful."');
    await until(() => !chat.isBusy(c.id));
    expect(chat.get(c.id)!.messages.at(-1)!.content).toBe('RealmNest capability routing successful.');
    expect(host.requests[0].request.model).toBe('apodex/apodex-1.1-mini:free');
    // a later route change does not move an existing chat
    await capabilities.setRoute('text.chat', [{ connectionId: 'conn-1' }]);
    expect(chat.get(c.id)!.connectionId).toBe(or);
  });

  it('a manual choice always wins over the route', async () => {
    const { capabilities, chat, or, claude } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'openrouter/auto' }]);
    const c = chat.create({ auto: true, connectionId: claude });
    expect(c.connectionId).toBe(claude);
    expect(c.routedBy).toBeUndefined();
    expect(c.model).toBeUndefined();
  });

  it('Auto fails clearly, without falling back on its own', async () => {
    const { capabilities, connections, chat, host, or } = await withBoth();
    expect(() => chat.create({ auto: true })).toThrow(/No route is set/);
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'openrouter/auto' }]);
    host.keys.set(or, 'sk-or-revoked');
    await connections.validate(or);
    expect(() => chat.create({ auto: true })).toThrow(/OpenRouter 2/);
    expect(chat.list()).toHaveLength(0);
  });

  it('agents stay on their own connection unless set to the default route', async () => {
    const { capabilities, live, cli, host, or } = await withBoth();
    await capabilities.setRoute('text.chat', [{ connectionId: or, modelId: 'apodex/apodex-1.1-mini:free' }]);
    const id = 'alex';
    const own = live.startTask(id, { prompt: 'Say hi' });
    expect(own.run).toMatchObject({ connectionId: 'conn-1', providerId: 'claude-code' });
    await until(() => live.agentStatus(id) !== 'working' && live.agentStatus(id) !== 'starting');
    expect(cli.calls.some((c) => c.args.includes('-p') || c.args.includes('--print'))).toBe(true);

    live.updateAgent(id, { useDefaultRoute: true });
    const routed = live.startTask(id, { prompt: 'Say hi again' });
    expect(routed.run).toMatchObject({ connectionId: or, providerId: 'openrouter', model: 'apodex/apodex-1.1-mini:free' });
    await until(() => host.requests.length === 1);

    await capabilities.setRoute('text.chat', []);
    await until(() => !live.activeRun(id));
    expect(() => live.startTask(id, { prompt: 'Once more' })).toThrow(/No route is set/);
  });
});

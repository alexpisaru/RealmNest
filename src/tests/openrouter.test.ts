import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { ProviderCatalog } from '../runtime/connections/catalog';
import { ConnectionManager, MODEL_CATALOG_TTL_MS } from '../runtime/connections/manager';
import type { SecretStore } from '../runtime/connections/secrets';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { UnavailableProcessRunner } from '../runtime/process/types';
import { createOpenRouterDefinition, OPENROUTER_AUTO } from '../runtime/providers/openrouter/definition';
import { OpenRouterProvider } from '../runtime/providers/openrouter/provider';
import type { OpenRouterTransport, OrChatRequest, OrStreamEvent, OrValidation } from '../runtime/providers/openrouter/transport';
import { UnavailableOpenRouterTransport } from '../runtime/providers/openrouter/transport';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { ModelInfo, ProviderEvent } from '../runtime/providers/types';
import { priceSummary, searchModels } from '../ui/ModelPicker';

// The native host is replaced by a scripted transport (Rust is tested with cargo test).

const tick = () => new Promise((r) => setTimeout(r, 0));

/** catalogue fixture normalized the way the Rust host does it */
const RAW = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'openrouter', 'models.sample.json'), 'utf8')).data as {
  id: string;
  name: string;
  context_length?: number;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
  pricing?: { prompt?: string; completion?: string };
}[];
const CATALOG: ModelInfo[] = RAW.map((m) => ({
  id: m.id,
  label: m.name,
  providerLabel: m.id.split('/')[0],
  contextLength: m.context_length,
  inputModalities: m.architecture?.input_modalities ?? [],
  outputModalities: m.architecture?.output_modalities ?? [],
  supportedParameters: m.supported_parameters ?? [],
  pricing: m.pricing && { prompt: m.pricing.prompt, completion: m.pricing.completion },
}));

/** a fake native host: keys per connection, a scripted stream per turn */
class FakeHost implements OpenRouterTransport {
  readonly available = true;
  keys = new Map<string, string>();
  requests: { connectionId: string; request: OrChatRequest }[] = [];
  modelCalls = 0;
  cancelled: string[] = [];
  script: (req: OrChatRequest, send: (e: OrStreamEvent) => void, id: string) => void = (req, send) => {
    const last = String(req.messages.at(-1)!.content);
    // "remembers" only what is in the messages it is sent: proves history replay
    const seen = req.messages.map((m) => m.content).join(' | ');
    const text = /what number/i.test(last) ? (seen.match(/\b(\d{3})\b/)?.[1] ?? 'none') : 'RealmNest OpenRouter chat successful.';
    setTimeout(() => {
      send({ t: 'start', model: req.model });
      send({ t: 'delta', d: text.slice(0, 6) });
      send({ t: 'delta', d: text.slice(6) });
      send({ t: 'usage', prompt: 20, completion: 7, cost: 0.00001 });
      send({ t: 'done', finishReason: 'stop' });
    }, 0);
  };
  async validate(connectionId: string): Promise<OrValidation> {
    const k = this.keys.get(connectionId);
    if (!k) return { status: 'missing_key', message: 'No API key is stored for this connection.' };
    return k.startsWith('sk-or-good') ? { status: 'connected', message: 'OpenRouter accepted the API key.', freeTier: false } : { status: 'invalid_credentials', message: 'OpenRouter rejected the API key.' };
  }
  async models() {
    this.modelCalls++;
    return CATALOG;
  }
  private n = 0;
  async chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push({ connectionId, request });
    const id = `or${++this.n}`;
    this.script(request, onEvent, id);
    return id;
  }
  async cancel(id: string) {
    this.cancelled.push(id);
    return true;
  }
}

/** the credential store, as the native one behaves: the host reads it, the page cannot */
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

async function setup(storage = new MemoryAdapter(), host = new FakeHost(), now = () => Date.now()) {
  const bus = new EventBus(3000);
  const catalog = new ProviderCatalog().register(createOpenRouterDefinition(host));
  let n = 0;
  const connections = new ConnectionManager(bus, catalog, storage, { runner: new UnavailableProcessRunner(), secrets: new Vault(host) }, { newId: () => `or-conn-${++n}`, now });
  await connections.init();
  const providers = new ProviderService(new ProviderRegistry(), bus, (id) => connections.provider(id));
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(storage, 5), { identity: () => ({ name: 'Alex', role: 'Developer' }), defaultConnection: () => connections.defaultId() });
  const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), { agent: (id) => live.agent(id), identity: () => ({ name: 'Alex', role: 'Developer' }) });
  await live.init();
  await chat.init();
  return { bus, storage, host, connections, providers, live, chat };
}

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 300 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};
const KEY = 'sk-or-good-personal-0123456789';

describe('OpenRouter connections', () => {
  it('is an API-key provider in the catalogue', () => {
    const def = createOpenRouterDefinition(new FakeHost());
    expect(def).toMatchObject({ id: 'openrouter', availability: 'available' });
    expect(def.methods).toEqual([expect.objectContaining({ id: 'api-key', fields: [expect.objectContaining({ key: 'apiKey', kind: 'secret', required: true })] })]);
  });

  it('stores the key in the credential store only and validates for real', async () => {
    const { connections, storage, bus, host } = await setup();
    const c = await connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter Personal', values: { apiKey: KEY } });
    expect(c.secretNames).toEqual([`conn.${c.id}.apiKey`]);
    await until(() => connections.get(c.id)!.status === 'connected');
    expect(connections.get(c.id)!.capabilities).toMatchObject({ 'text.chat': { support: 'supported' }, 'sessions.native': { support: 'unsupported' } });
    expect(connections.get(c.id)!.capabilities!['image.generate']).toBeUndefined(); // decided per model
    for (const where of [JSON.stringify(await storage.get('connections')), JSON.stringify(bus.log), JSON.stringify(connections.summaries())]) expect(where).not.toContain(KEY);
    // the catalogue arrived after the successful check, cached apart from the record
    await until(() => connections.models(c.id).length === 4);
    expect(connections.get(c.id)!.modelCatalog).toMatchObject({ count: 4 });
    expect(JSON.stringify(await storage.get('connections'))).not.toContain('stepfun');
    expect(host.modelCalls).toBe(1);
  });

  it('reports a rejected key as invalid credentials and fetches no catalogue', async () => {
    const { connections, host } = await setup();
    const c = await connections.create({ providerId: 'openrouter', method: 'api-key', name: 'Bad', values: { apiKey: 'sk-or-wrong' } });
    await until(() => connections.get(c.id)!.status === 'invalid_credentials');
    expect(connections.get(c.id)!.statusHint).toMatch(/openrouter.ai\/keys/);
    expect(host.modelCalls).toBe(0);
    expect(connections.get(c.id)!.capabilities).toBeUndefined();
    await expect(connections.refreshModels(c.id)).rejects.toThrow(/Test .* first/);
    expect(connections.models(c.id)).toEqual([]);
  });

  it('keeps several OpenRouter connections independent', async () => {
    const { connections, host } = await setup();
    const a = await connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter Personal', values: { apiKey: KEY } });
    const b = await connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter Work', values: { apiKey: 'sk-or-good-work-999' } });
    await until(() => connections.get(a.id)!.status === 'connected' && connections.get(b.id)!.status === 'connected');
    expect(host.keys.get(a.id)).not.toBe(host.keys.get(b.id));
    await connections.remove(b.id);
    expect(host.keys.has(b.id)).toBe(false);
    expect(host.keys.get(a.id)).toBe(KEY);
    expect((await connections.validate(a.id)).status).toBe('connected');
  });

  it('caches the catalogue with a TTL and refreshes on request', async () => {
    let t = 1_000;
    const storage = new MemoryAdapter();
    const s = await setup(storage, new FakeHost(), () => t);
    const c = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'P', values: { apiKey: KEY } });
    await until(() => s.connections.models(c.id).length === 4);
    await s.connections.validate(c.id);
    expect(s.host.modelCalls).toBe(1); // fresh cache: not fetched again
    t += MODEL_CATALOG_TTL_MS + 1;
    await s.connections.validate(c.id);
    expect(s.host.modelCalls).toBe(2); // stale: refreshed after the successful check
    await s.connections.refreshModels(c.id);
    expect(s.host.modelCalls).toBe(3);
    // after a restart the cache is there, but the status is not trusted
    const again = await setup(storage, s.host, () => t);
    expect(again.connections.models(c.id)).toHaveLength(4);
    expect(again.connections.get(c.id)!.status).toBe('unknown');
  });
});

describe('models', () => {
  it('normalizes live metadata and finds models by name, id or vendor', () => {
    expect(searchModels(CATALOG, 'auto router').map((m) => m.id)).toEqual([OPENROUTER_AUTO]);
    expect(searchModels(CATALOG, 'stepfun').map((m) => m.id)).toEqual(['stepfun/step-5-preview']);
    expect(searchModels(CATALOG, 'google nano').length).toBe(1);
    expect(searchModels(CATALOG, '')).toHaveLength(4);
  });

  it('summarizes prices from the catalogue only', () => {
    expect(priceSummary({ id: 'a', pricing: { prompt: '0', completion: '0' } })).toBe('free');
    expect(priceSummary({ id: 'a', pricing: { prompt: '-1', completion: '-1' } })).toBe('variable price');
    expect(priceSummary({ id: 'a', pricing: { prompt: '0.000001', completion: '0.0000027' } })).toBe('in $1.00 · out $2.70 /1M');
    expect(priceSummary({ id: 'a' })).toBeUndefined();
  });
});

describe('OpenRouterProvider', () => {
  async function collect(it: AsyncIterable<ProviderEvent>) {
    const out: ProviderEvent[] = [];
    for await (const e of it) out.push(e);
    return out;
  }

  it('streams normalized events with usage and sends the system prompt as a system message', async () => {
    const host = new FakeHost();
    host.keys.set('c1', KEY);
    const events = await collect(new OpenRouterProvider('c1', host).runTurn({ runId: 'r1', model: 'stepfun/step-5-preview', systemPrompt: 'You are Alex.', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events.map((e) => e.type)).toEqual(['provider.started', 'message.started', 'text.delta', 'text.delta', 'usage.updated', 'text.completed', 'run.completed']);
    expect(events.filter((e) => e.type === 'text.delta').map((e) => (e as { text: string }).text).join('')).toBe('RealmNest OpenRouter chat successful.');
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'RealmNest OpenRouter chat successful.', usage: { inputTokens: 20, outputTokens: 7 }, costUsd: 0.00001, stopReason: 'stop' });
    expect(host.requests[0].request.messages).toEqual([
      { role: 'system', content: 'You are Alex.' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('effort: levels only for models that take reasoning, and only a listed level is sent', async () => {
    const host = new FakeHost();
    host.models = async () => [
      { id: 'a/think', supportedParameters: ['reasoning'], reasoning: { mandatory: true, efforts: ['high', 'minimal', 'turbo'] } },
      { id: 'a/plain-think', supportedParameters: ['reasoning', 'tools'] },
      { id: 'a/none', supportedParameters: ['tools'], reasoning: { efforts: ['high'] } },
    ];
    const p = new OpenRouterProvider('c1', host);
    // the list is read by the first turn that asks for a level
    const turn = (model: string, effort?: string) => collect(p.runTurn({ runId: 'r', model, messages: [{ role: 'user', content: 'hi' }], ...(effort && { effort }) }));
    await turn('a/think', 'high');
    await turn('a/think', 'medium');
    await turn('a/plain-think', 'medium');
    await turn('a/none', 'high');
    await turn('a/think');
    expect(host.requests.map((r) => r.request.effort)).toEqual(['high', undefined, 'medium', undefined, undefined]);
    expect((await p.listModels()).map((m) => m.reasoning?.efforts)).toEqual([['minimal', 'high'], ['low', 'medium', 'high'], []]);
  });

  it('needs a model and never invents one', async () => {
    const host = new FakeHost();
    const events = await collect(new OpenRouterProvider('c1', host).runTurn({ runId: 'r1', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events).toEqual([expect.objectContaining({ type: 'run.failed', error: expect.objectContaining({ code: 'invalid_request' }) })]);
    expect(host.requests).toHaveLength(0);
  });

  it('normalizes native errors', async () => {
    const cases: [string, string][] = [
      ['invalid_credentials', 'invalid_credentials'],
      ['payment_required', 'payment_required'],
      ['rate_limited', 'rate_limited'],
      ['model_unavailable', 'model_unavailable'],
      ['timeout', 'timeout'],
      ['network', 'unavailable'],
      ['malformed', 'malformed_event'],
    ];
    for (const [native, expected] of cases) {
      const host = new FakeHost();
      host.script = (_r, send) => setTimeout(() => send({ t: 'error', code: native, message: `${native} happened`, status: 400 }), 0);
      const events = await collect(new OpenRouterProvider('c1', host).runTurn({ runId: 'r', model: 'a/b', messages: [{ role: 'user', content: 'x' }] }));
      expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: expected } });
    }
  });

  it('cancels the native request and reports nothing after it', async () => {
    const host = new FakeHost();
    let sendLater: ((e: OrStreamEvent) => void) | null = null;
    host.script = (_r, send) => {
      sendLater = send;
      setTimeout(() => send({ t: 'delta', d: 'partial ' }), 0);
    };
    const ac = new AbortController();
    const events: ProviderEvent[] = [];
    const p = new OpenRouterProvider('c1', host);
    const done = (async () => {
      for await (const e of p.runTurn({ runId: 'r1', model: 'a/b', messages: [{ role: 'user', content: 'long' }], abortSignal: ac.signal })) events.push(e);
    })();
    await until(() => events.some((e) => e.type === 'text.delta'));
    ac.abort();
    await until(() => host.cancelled.length === 1);
    sendLater!({ t: 'cancelled' });
    sendLater!({ t: 'done', finishReason: 'stop' }); // too late: ignored
    await done;
    expect(host.cancelled).toEqual(['or1']);
    expect(events.at(-1)!.type).toBe('run.cancelled');
    expect(events.some((e) => e.type === 'run.completed')).toBe(false);
  });

  it('is unavailable in browser builds', async () => {
    const s = await new OpenRouterProvider('c1', new UnavailableOpenRouterTransport()).getStatus();
    expect(s.state).toBe('unavailable');
  });
});

describe('chat and agents through OpenRouter', () => {
  it('replays RealmNest history each turn: multi-turn memory, isolation, restart', async () => {
    const storage = new MemoryAdapter();
    const s = await setup(storage);
    const c0 = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter Personal', values: { apiKey: KEY } });
    await until(() => s.connections.get(c0.id)!.status === 'connected');
    const conv = s.chat.create({ connectionId: c0.id, model: 'stepfun/step-5-preview' });
    const turn = async (id: string, text: string) => {
      s.chat.send(id, text);
      await until(() => !s.chat.isBusy(id));
      return s.chat.get(id)!.messages.at(-1)!;
    };
    expect((await turn(conv.id, 'Reply exactly with: "RealmNest OpenRouter chat successful."')).content).toBe('RealmNest OpenRouter chat successful.');
    await turn(conv.id, 'Remember the number 742 only in this conversation.');
    expect((await turn(conv.id, 'What number did I ask you to remember?')).content).toBe('742');
    // no provider session: the whole history went out, with no session ref
    const last = s.host.requests.at(-1)!.request;
    expect(last.messages.length).toBe(5);
    expect(s.chat.get(conv.id)!.providerSession).toBeUndefined();

    const other = s.chat.create({ connectionId: c0.id, model: 'stepfun/step-5-preview' });
    expect((await turn(other.id, 'What number did I ask you to remember?')).content).toBe('none');

    // restart: the conversation and its model come back, history is replayed again
    const r = await setup(storage, s.host);
    await r.connections.validateAll();
    expect(r.chat.get(conv.id)!.model).toBe('stepfun/step-5-preview');
    r.chat.send(conv.id, 'What number did I ask you to remember?');
    await until(() => !r.chat.isBusy(conv.id));
    expect(r.chat.get(conv.id)!.messages.at(-1)!.content).toBe('742');
  });

  it('runs an agent task on an OpenRouter connection, with the agent prompt as a system message', async () => {
    const s = await setup();
    const c = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'OpenRouter Personal', values: { apiKey: KEY } });
    await until(() => s.connections.get(c.id)!.status === 'connected');
    s.live.updateAgent('alex', { connectionId: c.id, model: 'stepfun/step-5-preview' });
    const { run } = s.live.startTask('alex', { prompt: 'Reply exactly with: "RealmNest OpenRouter agent successful."' });
    await until(() => s.live.getRun(run.id)!.status === 'completed');
    expect(s.live.getRun(run.id)).toMatchObject({ providerId: 'openrouter', connectionId: c.id, usage: { inputTokens: 20, outputTokens: 7 }, costUsd: 0.00001 });
    expect(s.live.agentStatus('alex')).toBe('idle');
    const sent = s.host.requests[0].request;
    expect(sent.messages[0]).toMatchObject({ role: 'system' });
    expect(sent.messages[0].content).toContain('You are Alex, Developer');
  });

  it('switching an agent or a new chat to another connection drops the old model', async () => {
    const s = await setup();
    const c = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'P', values: { apiKey: KEY } });
    s.live.updateAgent('alex', { connectionId: c.id, model: 'stepfun/step-5-preview' });
    s.live.updateAgent('alex', { connectionId: 'elsewhere' });
    expect(s.live.agent('alex').model).toBeUndefined();
    s.live.updateAgent('alex', { connectionId: c.id, model: 'a/b' });
    expect(s.live.agent('alex').model).toBe('a/b');
    const c2 = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'Q', values: { apiKey: 'sk-or-good-2' } });
    const conv = s.chat.create({ connectionId: c.id, model: 'stepfun/step-5-preview' });
    s.chat.configure(conv.id, { connectionId: c2.id });
    expect(s.chat.get(conv.id)!.model).toBeUndefined();
  });

  it('a chat and an agent keep their effort and send it with every turn', async () => {
    const s = await setup();
    const c = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'P', values: { apiKey: KEY } });
    await until(() => s.connections.get(c.id)!.status === 'connected');
    const conv = s.chat.create({ connectionId: c.id, model: 'stepfun/step-5-preview', effort: 'high' });
    s.chat.send(conv.id, 'hi');
    await until(() => !s.chat.isBusy(conv.id));
    // a level the model does not list stays stored but is not sent; '' goes back to the default
    s.chat.configure(conv.id, { effort: 'max' });
    s.chat.send(conv.id, 'again');
    await until(() => !s.chat.isBusy(conv.id));
    s.chat.configure(conv.id, { effort: '' });
    expect(s.chat.get(conv.id)!.effort).toBeUndefined();
    s.live.updateAgent('alex', { connectionId: c.id, model: 'stepfun/step-5-preview', effort: 'low' });
    const { run } = s.live.startTask('alex', { prompt: 'go' });
    await until(() => s.live.getRun(run.id)!.status === 'completed');
    // an agent chat starts with the agent's effort
    expect(s.chat.create({ agentId: 'alex' }).effort).toBe('low');
    expect(s.host.requests.map((r) => r.request.effort)).toEqual(['high', undefined, 'low']);
    // switching the agent to another connection drops its effort
    s.live.updateAgent('alex', { connectionId: 'elsewhere' });
    expect(s.live.agent('alex').effort).toBeUndefined();
  });

  it("uses the connection's preferred model when a chat or agent sets none", async () => {
    const s = await setup();
    const c = await s.connections.create({ providerId: 'openrouter', method: 'api-key', name: 'P', values: { apiKey: KEY } });
    await s.connections.update(c.id, { preferredModel: OPENROUTER_AUTO });
    const conv = s.chat.create({ connectionId: c.id });
    s.chat.send(conv.id, 'hi');
    await until(() => !s.chat.isBusy(conv.id));
    expect(s.host.requests[0].request.model).toBe(OPENROUTER_AUTO);
  });
});

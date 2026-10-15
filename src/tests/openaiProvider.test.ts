import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { ProviderCatalog } from '../runtime/connections/catalog';
import { ConnectionManager } from '../runtime/connections/manager';
import type { SecretStore } from '../runtime/connections/secrets';
import { EmbeddingError, EmbeddingService, openAiEmbeddings } from '../runtime/knowledge/embeddings';
import { UnavailableProcessRunner } from '../runtime/process/types';
import { createOpenAiDefinition } from '../runtime/providers/openai/definition';
import { OPENAI_API_ID, OPENAI_CAPABILITIES, OpenAiProvider, preferredOpenAiModel } from '../runtime/providers/openai/provider';
import { TauriOpenAiTransport, UnavailableOpenAiTransport } from '../runtime/providers/openai/transport';
import type { ChatCompletionsTransport, OrChatRequest, OrStreamEvent, OrValidation } from '../runtime/providers/openrouter/transport';
import { base64 } from '../runtime/skills/package';
import type { ModelInfo, ProviderEvent } from '../runtime/providers/types';

// The native host is replaced by a scripted transport (Rust is tested with cargo test).

const tick = () => new Promise((r) => setTimeout(r, 0));
const KEY = 'sk-test-good-0123456789abcdef';

const MODELS: ModelInfo[] = ['gpt-4.1-mini', 'gpt-4o-mini', 'o4-mini'].map((id) => ({ id, label: id, providerLabel: 'openai', inputModalities: [], outputModalities: [], supportedParameters: [] }));

class FakeOpenAi implements ChatCompletionsTransport {
  readonly available = true;
  keys = new Map<string, string>();
  requests: { connectionId: string; request: OrChatRequest }[] = [];
  modelCalls: (string | undefined)[] = [];
  cancelled: string[] = [];
  models_ = MODELS;
  script: (req: OrChatRequest, send: (e: OrStreamEvent) => void) => void = (req, send) =>
    setTimeout(() => {
      send({ t: 'start', model: req.model });
      send({ t: 'delta', d: 'Hello ' });
      send({ t: 'delta', d: 'from OpenAI.' });
      // OpenAI reports tokens, never a price
      send({ t: 'usage', prompt: 11, completion: 4 });
      send({ t: 'done', finishReason: 'stop' });
    }, 0);
  async validate(connectionId: string): Promise<OrValidation> {
    const k = this.keys.get(connectionId);
    if (!k) return { status: 'missing_key', message: 'No API key is stored for this connection.' };
    return k.startsWith('sk-test-good') ? { status: 'connected', message: 'OpenAI accepted the API key.' } : { status: 'invalid_credentials', message: 'OpenAI rejected the API key.' };
  }
  async models(connectionId?: string) {
    this.modelCalls.push(connectionId);
    return this.models_;
  }
  private n = 0;
  async chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push({ connectionId, request });
    this.script(request, onEvent);
    return `oa${++this.n}`;
  }
  async cancel(id: string) {
    this.cancelled.push(id);
    return true;
  }
}

async function collect(it: AsyncIterable<ProviderEvent>) {
  const out: ProviderEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('OpenAI API in the catalogue', () => {
  it('is an API-key provider with honest connection-level claims', () => {
    const def = createOpenAiDefinition(new FakeOpenAi());
    expect(def).toMatchObject({ id: 'openai-api', name: 'OpenAI API', availability: 'available', requiresModel: true });
    expect(def.methods).toEqual([expect.objectContaining({ id: 'api-key', fields: [expect.objectContaining({ key: 'apiKey', kind: 'secret', required: true })] })]);
    const caps = def.capabilities!({} as never, OPENAI_CAPABILITIES);
    expect(caps['text.chat']?.support).toBe('supported');
    expect(caps['tools.calling']?.support).toBe('supported');
    expect(caps['vision.input']?.support).toBe('supported');
    expect(caps['files.input']?.support).toBe('supported');
    expect(caps['embeddings.create']?.support).toBe('supported');
    expect(caps['web.search']?.support).toBe('unsupported');
    expect(caps['sessions.native']?.support).toBe('unsupported');
    // the model list says nothing per model: nothing is claimed per model
    expect(def.modelCapabilities!(MODELS[0])).toEqual({});
  });

  it('states what the adapter does: tokens but no cost, no web search, not local', () => {
    expect(OPENAI_CAPABILITIES).toMatchObject({ cost: false, usage: true, webSearch: false, local: false, toolCalling: true, vision: true, files: true, embeddings: true, structuredOutput: true, sessions: false });
  });
});

describe('OpenAiProvider', () => {
  it('streams normalized events, usage without a cost, system prompt as a system message', async () => {
    const host = new FakeOpenAi();
    const p = new OpenAiProvider('c1', host);
    expect(p.id).toBe(OPENAI_API_ID);
    const events = await collect(p.runTurn({ runId: 'r1', model: 'gpt-4.1-mini', systemPrompt: 'You are Alex.', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events.map((e) => e.type)).toEqual(['provider.started', 'message.started', 'text.delta', 'text.delta', 'usage.updated', 'text.completed', 'run.completed']);
    const end = events.at(-1)!;
    expect(end).toMatchObject({ type: 'run.completed', text: 'Hello from OpenAI.', usage: { inputTokens: 11, outputTokens: 4 }, stopReason: 'stop', providerId: 'openai-api' });
    expect('costUsd' in end).toBe(false);
    expect(host.requests[0]).toMatchObject({ connectionId: 'c1', request: { model: 'gpt-4.1-mini', messages: [{ role: 'system', content: 'You are Alex.' }, { role: 'user', content: 'hi' }] } });
  });

  it('offers RealmNest tools as functions and maps tool calls; never asks for web search or an effort', async () => {
    const host = new FakeOpenAi();
    host.script = (_r, send) =>
      setTimeout(() => {
        send({ t: 'start', model: 'gpt-4.1-mini' });
        send({ t: 'tool', id: 'call_1', name: 'read_text_file', args: '{"path":"a.txt"}' });
        send({ t: 'tool', id: 'call_2', name: 'read_text_file', args: '{broken' });
        send({ t: 'usage', prompt: 30, completion: 9 });
        send({ t: 'done', finishReason: 'tool_calls' });
      }, 0);
    const events = await collect(
      new OpenAiProvider('c1', host).runTurn({ runId: 'r', model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'read it' }], toolSchemas: [{ name: 'read_text_file', description: 'Read a file', parameters: { type: 'object' } }], webSearch: { maxUses: 3 }, effort: 'high' }),
    );
    expect(events.filter((e) => e.type === 'tool.requested')).toEqual([expect.objectContaining({ toolCallId: 'call_1', name: 'read_text_file', input: { path: 'a.txt' } }), expect.objectContaining({ toolCallId: 'call_2', input: undefined })]);
    expect(host.requests[0].request.tools).toEqual([{ type: 'function', function: { name: 'read_text_file', description: 'Read a file', parameters: { type: 'object' } } }]);
    expect(host.requests[0].request.webSearch).toBeUndefined();
    // no reasoning effort on OpenAI in RealmNest (the model list cannot tell which models take it)
    expect(host.requests[0].request.effort).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', stopReason: 'tool_calls' });
  });

  it('sends images and PDFs as parts and a response schema when asked', async () => {
    const host = new FakeOpenAi();
    await collect(
      new OpenAiProvider('c1', host).runTurn({
        runId: 'r',
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: 'look', attachments: [{ kind: 'image', name: 'a.png', mime: 'image/png', data: 'AAAA' }, { kind: 'pdf', name: 'd.pdf', mime: 'application/pdf', data: 'JVBERi0=' }] }],
        responseSchema: { name: 'answer', schema: { type: 'object' } },
      }),
    );
    const r = host.requests[0].request;
    expect(r.messages[0].content).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'file', file: { filename: 'd.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' } },
    ]);
    expect(r.responseSchema).toEqual({ name: 'answer', schema: { type: 'object' } });
  });

  it('normalizes native errors', async () => {
    const cases: [string, string][] = [
      ['invalid_credentials', 'invalid_credentials'],
      ['missing_key', 'not_authenticated'],
      ['payment_required', 'payment_required'],
      ['rate_limited', 'rate_limited'],
      ['model_unavailable', 'model_unavailable'],
      ['bad_request', 'invalid_request'],
      ['network', 'unavailable'],
    ];
    for (const [native, expected] of cases) {
      const host = new FakeOpenAi();
      host.script = (_r, send) => setTimeout(() => send({ t: 'error', code: native, message: `${native} happened`, status: 429 }), 0);
      const events = await collect(new OpenAiProvider('c1', host).runTurn({ runId: 'r', model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'x' }] }));
      expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: expected, detail: 'HTTP 429' } });
    }
  });

  it('uses a default model only when the key’s own list has it', async () => {
    expect(preferredOpenAiModel(MODELS)).toBe('gpt-4.1-mini');
    expect(preferredOpenAiModel([{ id: 'o4-mini' }])).toBeUndefined();
    const host = new FakeOpenAi();
    await collect(new OpenAiProvider('c1', host).runTurn({ runId: 'r', messages: [{ role: 'user', content: 'hi' }] }));
    expect(host.requests[0].request.model).toBe('gpt-4.1-mini');
    expect(host.modelCalls).toEqual(['c1']);
    // a list without any default: the turn asks for a model, nothing is sent
    const bare = new FakeOpenAi();
    bare.models_ = [{ id: 'o4-mini' }];
    const events = await collect(new OpenAiProvider('c1', bare).runTurn({ runId: 'r', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events).toEqual([expect.objectContaining({ type: 'run.failed', error: expect.objectContaining({ code: 'invalid_request', message: expect.stringContaining('OpenAI') }) })]);
    expect(bare.requests).toHaveLength(0);
  });

  it('lists models with the connection (the key is needed on OpenAI)', async () => {
    const host = new FakeOpenAi();
    expect((await new OpenAiProvider('c7', host).listModels()).map((m) => m.id)).toEqual(['gpt-4.1-mini', 'gpt-4o-mini', 'o4-mini']);
    expect(host.modelCalls).toEqual(['c7']);
  });

  it('maps the check to a status with OpenAI hints', async () => {
    const host = new FakeOpenAi();
    const p = new OpenAiProvider('c1', host);
    expect(await p.getStatus()).toMatchObject({ state: 'not_authenticated', hint: expect.stringContaining('OpenAI API key') });
    host.keys.set('c1', 'sk-test-bad');
    expect(await p.getStatus()).toMatchObject({ state: 'invalid_credentials', hint: expect.stringContaining('platform.openai.com') });
    host.keys.set('c1', KEY);
    expect(await p.getStatus()).toMatchObject({ state: 'available', message: 'OpenAI accepted the API key.', details: { auth: 'API key' } });
    host.validate = async () => ({ status: 'unavailable', message: 'OpenAI is not available right now.' });
    expect((await p.getStatus()).state).toBe('unavailable');
    host.validate = async () => {
      throw new Error('ipc broke');
    };
    expect(await p.getStatus()).toMatchObject({ state: 'error', message: 'Could not check OpenAI.' });
  });

  it('cancels the native request', async () => {
    const host = new FakeOpenAi();
    let later: ((e: OrStreamEvent) => void) | null = null;
    host.script = (_r, send) => {
      later = send;
      setTimeout(() => send({ t: 'delta', d: 'partial' }), 0);
    };
    const ac = new AbortController();
    const events: ProviderEvent[] = [];
    const done = (async () => {
      for await (const e of new OpenAiProvider('c1', host).runTurn({ runId: 'r', model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'x' }], abortSignal: ac.signal })) events.push(e);
    })();
    for (let i = 0; i < 100 && !events.some((e) => e.type === 'text.delta'); i++) await tick();
    ac.abort();
    for (let i = 0; i < 100 && !host.cancelled.length; i++) await tick();
    later!({ t: 'cancelled' });
    await done;
    expect(host.cancelled).toEqual(['oa1']);
    expect(events.at(-1)!.type).toBe('run.cancelled');
  });

  it('is unavailable in browser builds', async () => {
    const p = new OpenAiProvider('c1', new UnavailableOpenAiTransport());
    expect(await p.getStatus()).toMatchObject({ state: 'unavailable', message: 'OpenAI needs the RealmNest desktop app.' });
    expect(await new UnavailableOpenAiTransport().models()).toEqual([]);
  });
});

describe('OpenAI native commands', () => {
  it('names the flavor and the connection, never a URL', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const call = async <T,>(cmd: string, args?: Record<string, unknown>) => {
      calls.push([cmd, args]);
      return (cmd === 'compat_validate' ? { status: 'connected', message: 'ok' } : cmd === 'compat_cancel' ? true : []) as T;
    };
    const t = new TauriOpenAiTransport(call);
    await t.validate('c1');
    await t.models('c1');
    await t.cancel('oa3');
    expect(calls).toEqual([
      ['compat_validate', { flavor: 'openai', connectionId: 'c1' }],
      ['compat_models', { flavor: 'openai', connectionId: 'c1' }],
      ['compat_cancel', { flavor: 'openai', id: 'oa3' }],
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/https?:/);
  });
});

describe('OpenAI embeddings', () => {
  const vectors = (rows: number[][]) => base64.encode(new Uint8Array(new Float32Array(rows.flat()).buffer));

  it('lists embedding models with the connection and decodes vectors (tokens, no cost)', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const call = async <T,>(cmd: string, args?: Record<string, unknown>) => {
      calls.push([cmd, args]);
      if (cmd === 'compat_embedding_models') return [{ id: 'text-embedding-3-small', name: 'text-embedding-3-small' }] as T;
      return { model: 'text-embedding-3-small', dimensions: 2, count: 2, vectors: vectors([[1, 0], [0.5, 0.25]]), promptTokens: 6 } as T;
    };
    const e = openAiEmbeddings(call);
    expect(e.providerId).toBe('openai-api');
    expect(await e.models('c1')).toEqual([{ id: 'text-embedding-3-small', name: 'text-embedding-3-small' }]);
    const b = await e.embed('c1', 'text-embedding-3-small', ['a', 'b']);
    expect(b.dimensions).toBe(2);
    expect(Array.from(b.vectors[1])).toEqual([0.5, 0.25]);
    expect(b.usage).toEqual({ requests: 1, tokens: 6 });
    expect(calls[0]).toEqual(['compat_embedding_models', { flavor: 'openai', connectionId: 'c1' }]);
    expect(calls[1]).toEqual(['compat_embed', { flavor: 'openai', connectionId: 'c1', model: 'text-embedding-3-small', inputs: ['a', 'b'] }]);
  });

  it('reports failures as EmbeddingError', async () => {
    const e = openAiEmbeddings(async () => {
      throw { code: 'missing_key', message: 'No API key is stored for this connection.' };
    });
    await expect(e.embed('c1', 'text-embedding-3-small', ['a'])).rejects.toBeInstanceOf(EmbeddingError);
  });

  it('the embedding service asks the model list with the connection', async () => {
    const asked: (string | undefined)[] = [];
    const provider = openAiEmbeddings(async <T,>(_cmd: string, args?: Record<string, unknown>) => {
      asked.push(args?.connectionId as string);
      return [{ id: 'text-embedding-3-large', name: 'large' }] as T;
    });
    const service = new EmbeddingService(() => ({ provider, providerId: 'openai-api', available: true, name: 'OpenAI' }), () => undefined);
    expect((await service.models('conn-9')).map((m) => m.id)).toEqual(['text-embedding-3-large']);
    expect(asked).toEqual(['conn-9']);
  });
});

describe('OpenAI connections end to end (scripted host)', () => {
  it('connects with a key, lists the catalogue and chats', async () => {
    const host = new FakeOpenAi();
    const secrets: SecretStore = {
      available: true,
      set: async (name: string, value: string) => void host.keys.set(name.split('.')[1], value),
      delete: async (name: string) => void host.keys.delete(name.split('.')[1]),
      has: async (name: string) => host.keys.has(name.split('.')[1]),
    };
    const bus = new EventBus(1000);
    const connections = new ConnectionManager(bus, new ProviderCatalog().register(createOpenAiDefinition(host)), new MemoryAdapter(), { runner: new UnavailableProcessRunner(), secrets }, { newId: () => 'oa-conn-1' });
    await connections.init();
    const c = await connections.create({ providerId: 'openai-api', method: 'api-key', name: 'OpenAI', values: { apiKey: KEY } });
    for (let i = 0; i < 300 && connections.get(c.id)!.status !== 'connected'; i++) await tick();
    expect(connections.get(c.id)!.status).toBe('connected');
    expect(host.keys.get('oa-conn-1')).toBe(KEY);
    const events = await collect(connections.provider(c.id)!.runTurn({ runId: 'r', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'Hello from OpenAI.' });
  });
});

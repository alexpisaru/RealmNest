import { describe, expect, it } from 'vitest';
import { modelSupport } from '../runtime/capabilities/model';
import { EmbeddingError, ollamaEmbeddings } from '../runtime/knowledge/embeddings';
import { createOllamaDefinition } from '../runtime/providers/ollama/definition';
import { ensureStatus, firstLocalModel, OLLAMA_CAPABILITIES, OLLAMA_ID, OllamaProvider } from '../runtime/providers/ollama/provider';
import type { OllamaEnsure, OllamaTransport } from '../runtime/providers/ollama/transport';
import { TauriOllamaTransport, UnavailableOllamaTransport } from '../runtime/providers/ollama/transport';
import type { OrChatRequest, OrStreamEvent, OrValidation } from '../runtime/providers/openrouter/transport';
import { base64 } from '../runtime/skills/package';
import type { ModelInfo, ProviderEvent } from '../runtime/providers/types';
import { priceSummary } from '../ui/ModelPicker';

// The native host is replaced by a scripted transport (Rust is tested with cargo test).

/** local models as the Rust host describes them (from /api/tags + /api/show) */
const MODELS: ModelInfo[] = [
  { id: 'gemma3:latest', label: 'gemma3:latest · 4.3B', providerLabel: 'gemma3', contextLength: 131072, inputModalities: ['text', 'image'], outputModalities: ['text'], supportedParameters: ['response_format'], pricing: { prompt: '0', completion: '0' } },
  { id: 'qwen3:latest', label: 'qwen3:latest · 8.2B', providerLabel: 'qwen3', inputModalities: ['text'], outputModalities: ['text'], supportedParameters: ['response_format', 'tools'], pricing: { prompt: '0', completion: '0' }, reasoning: { efforts: [] } },
  // an Ollama that did not say: unknown
  { id: 'old:latest', label: 'old:latest', providerLabel: 'ollama', inputModalities: [], outputModalities: [], supportedParameters: [], pricing: { prompt: '0', completion: '0' } },
];

class FakeOllama implements OllamaTransport {
  readonly available = true;
  ensured: OllamaEnsure = { status: 'running', message: 'Ollama 0.12.6 is running.', version: '0.12.6' };
  ensureCalls = 0;
  running = true;
  requests: { connectionId: string; request: OrChatRequest }[] = [];
  cancelled: string[] = [];
  models_ = MODELS;
  script: (req: OrChatRequest, send: (e: OrStreamEvent) => void) => void = (req, send) =>
    setTimeout(() => {
      send({ t: 'start', model: req.model });
      send({ t: 'delta', d: 'Ciao da Ollama.' });
      // Ollama reports tokens; it has no price
      send({ t: 'usage', prompt: 25, completion: 5 });
      send({ t: 'done', finishReason: 'stop' });
    }, 0);
  async ensure() {
    this.ensureCalls++;
    if (this.ensured.status === 'started' || this.ensured.status === 'running') this.running = true;
    return this.ensured;
  }
  async validate(): Promise<OrValidation> {
    return this.running ? { status: 'connected', message: 'Ollama 0.12.6 is running on this PC.' } : { status: 'unavailable', message: 'Ollama is not running on this PC.' };
  }
  async models() {
    return this.models_;
  }
  private n = 0;
  async chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push({ connectionId, request });
    this.script(request, onEvent);
    return `ol${++this.n}`;
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

describe('Ollama in the catalogue', () => {
  it('is a local provider with no key, replacing the coming-soon entry', () => {
    const def = createOllamaDefinition(new FakeOllama());
    expect(def).toMatchObject({ id: 'ollama', availability: 'available', requiresModel: true });
    expect(def.methods).toEqual([expect.objectContaining({ id: 'local-endpoint', fields: [] })]);
    const caps = def.capabilities!({} as never, OLLAMA_CAPABILITIES);
    expect(caps['embeddings.create']?.support).toBe('supported');
    expect(caps['web.search']?.support).toBe('unsupported');
    expect(caps['files.input']?.support).toBe('unsupported');
    expect(caps['sessions.native']?.support).toBe('unsupported');
    expect(OLLAMA_CAPABILITIES).toMatchObject({ local: true, cost: true, toolCalling: true, files: false, webSearch: false });
  });

  it('takes tools and vision per model from Ollama’s own capabilities, unknown when it does not say', () => {
    const def = createOllamaDefinition(new FakeOllama());
    const [gemma, qwen, old] = MODELS;
    expect(def.modelCapabilities!(gemma)['vision.input']?.support).toBe('supported');
    expect(def.modelCapabilities!(gemma)['tools.calling']?.support).toBe('unsupported');
    expect(def.modelCapabilities!(qwen)['tools.calling']?.support).toBe('supported');
    expect(def.modelCapabilities!(qwen)['vision.input']?.support).toBe('unsupported');
    expect(def.modelCapabilities!(qwen)['text.reasoning']?.support).toBe('supported');
    expect(modelSupport(old, 'tools.calling')).toBe('unknown');
    expect(modelSupport(old, 'vision.input')).toBe('unknown');
    // local models show as free in the model picker
    expect(priceSummary(gemma)).toBe('free');
  });
});

describe('OllamaProvider', () => {
  it('starts the local server before the check and reports it', async () => {
    const host = new FakeOllama();
    host.running = false;
    host.ensured = { status: 'started', message: 'RealmNest started Ollama 0.12.6.', version: '0.12.6' };
    const s = await new OllamaProvider('o1', host).getStatus();
    expect(host.ensureCalls).toBe(1);
    expect(s).toMatchObject({ state: 'available', details: { auth: 'local (no key)', server: 'started by RealmNest', version: '0.12.6' } });
  });

  it('maps ensure answers that settle the status by themselves', async () => {
    const host = new FakeOllama();
    host.ensured = { status: 'not_installed', message: 'Ollama is not installed on this PC (install it from ollama.com).' };
    expect(await new OllamaProvider('o1', host).getStatus()).toMatchObject({ state: 'not_installed', hint: expect.stringContaining('ollama.com') });
    host.ensured = { status: 'failed', message: 'Ollama was started but did not answer within 20 seconds.' };
    expect(await new OllamaProvider('o1', host).getStatus()).toMatchObject({ state: 'unavailable', message: expect.stringContaining('20 seconds') });
    expect(ensureStatus({ status: 'running', message: 'x' }, 1)).toBeUndefined();
    expect(ensureStatus({ status: 'started', message: 'x' }, 1)).toBeUndefined();
    // the check itself failing after a good ensure
    host.ensured = { status: 'running', message: 'ok' };
    host.validate = async () => ({ status: 'unavailable', message: 'Ollama is not running on this PC.' });
    expect(await new OllamaProvider('o1', host).getStatus()).toMatchObject({ state: 'unavailable', hint: expect.stringContaining('127.0.0.1:11434') });
    host.ensure = async () => {
      throw new Error('ipc down');
    };
    expect((await new OllamaProvider('o1', host).getStatus()).state).toBe('error');
  });

  it('streams events and reports local usage as free (cost 0)', async () => {
    const host = new FakeOllama();
    const p = new OllamaProvider('o1', host);
    expect(p.id).toBe(OLLAMA_ID);
    const events = await collect(p.runTurn({ runId: 'r', model: 'qwen3:latest', systemPrompt: 'Sei Alex.', messages: [{ role: 'user', content: 'ciao' }] }));
    expect(events.map((e) => e.type)).toEqual(['provider.started', 'message.started', 'text.delta', 'usage.updated', 'text.completed', 'run.completed']);
    expect(events.find((e) => e.type === 'usage.updated')).toMatchObject({ usage: { inputTokens: 25, outputTokens: 5 }, costUsd: 0 });
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'Ciao da Ollama.', costUsd: 0, providerId: 'ollama' });
    expect(host.requests[0].request.messages[0]).toEqual({ role: 'system', content: 'Sei Alex.' });
  });

  it('maps tool calls and never asks for web search', async () => {
    const host = new FakeOllama();
    host.script = (_r, send) =>
      setTimeout(() => {
        send({ t: 'tool', id: 'call_a', name: 'get_current_time', args: '{}' });
        send({ t: 'tool', id: 'call_b', name: 'read_text_file', args: '{"path":"a"}' });
        send({ t: 'done', finishReason: 'tool_calls' });
      }, 0);
    const events = await collect(
      new OllamaProvider('o1', host).runTurn({ runId: 'r', model: 'qwen3:latest', messages: [{ role: 'user', content: 'x' }], toolSchemas: [{ name: 'get_current_time', description: 'd', parameters: { type: 'object' } }], webSearch: {} }),
    );
    expect(events.filter((e) => e.type === 'tool.requested')).toEqual([expect.objectContaining({ toolCallId: 'call_a', input: {} }), expect.objectContaining({ toolCallId: 'call_b', input: { path: 'a' } })]);
    expect(host.requests[0].request.webSearch).toBeUndefined();
    expect(host.requests[0].request.tools).toHaveLength(1);
  });

  it('normalizes errors (a missing model, Ollama down)', async () => {
    for (const [native, expected] of [
      ['model_unavailable', 'model_unavailable'],
      ['network', 'unavailable'],
      ['bad_request', 'invalid_request'],
    ]) {
      const host = new FakeOllama();
      host.script = (_r, send) => setTimeout(() => send({ t: 'error', code: native, message: 'x' }), 0);
      const events = await collect(new OllamaProvider('o1', host).runTurn({ runId: 'r', model: 'nope:latest', messages: [{ role: 'user', content: 'x' }] }));
      expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: expected } });
    }
  });

  it('lists local models and falls back to the first one when a turn names none', async () => {
    const host = new FakeOllama();
    const p = new OllamaProvider('o1', host);
    expect((await p.listModels()).map((m) => m.id)).toEqual(['gemma3:latest', 'qwen3:latest', 'old:latest']);
    await collect(p.runTurn({ runId: 'r', messages: [{ role: 'user', content: 'hi' }] }));
    expect(host.requests[0].request.model).toBe('gemma3:latest');
    expect(firstLocalModel([])).toBeUndefined();
    // nothing installed: the turn asks for a model, nothing is sent
    const empty = new FakeOllama();
    empty.models_ = [];
    const events = await collect(new OllamaProvider('o1', empty).runTurn({ runId: 'r', messages: [{ role: 'user', content: 'hi' }] }));
    expect(events).toEqual([expect.objectContaining({ type: 'run.failed', error: expect.objectContaining({ code: 'invalid_request' }) })]);
    expect(empty.requests).toHaveLength(0);
  });

  it('cancels the native request', async () => {
    const host = new FakeOllama();
    host.script = (_r, send) => setTimeout(() => send({ t: 'delta', d: 'partial' }), 0);
    const ac = new AbortController();
    const events: ProviderEvent[] = [];
    const done = (async () => {
      for await (const e of new OllamaProvider('o1', host).runTurn({ runId: 'r', model: 'qwen3:latest', messages: [{ role: 'user', content: 'x' }], abortSignal: ac.signal })) {
        events.push(e);
        if (e.type === 'text.delta') ac.abort();
        if (e.type === 'text.delta') break;
      }
    })();
    await done;
    for (let i = 0; i < 50 && !host.cancelled.length; i++) await new Promise((r) => setTimeout(r, 0));
    expect(host.cancelled[0]).toBe('ol1');
  });

  it('is unavailable in browser builds', async () => {
    const p = new OllamaProvider('o1', new UnavailableOllamaTransport());
    expect(await p.getStatus()).toMatchObject({ state: 'unavailable', message: 'Ollama needs the RealmNest desktop app.' });
  });
});

describe('Ollama native commands', () => {
  it('names the flavor, never a URL, and ensure is its own narrow command', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const call = async <T,>(cmd: string, args?: Record<string, unknown>) => {
      calls.push([cmd, args]);
      return (cmd === 'ollama_ensure' ? { status: 'running', message: 'ok' } : cmd === 'compat_validate' ? { status: 'connected', message: 'ok' } : []) as T;
    };
    const t = new TauriOllamaTransport(call);
    await t.ensure();
    await t.validate('o1');
    await t.models('o1');
    expect(calls).toEqual([
      ['ollama_ensure', undefined],
      ['compat_validate', { flavor: 'ollama', connectionId: 'o1' }],
      ['compat_models', { flavor: 'ollama', connectionId: 'o1' }],
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/https?:/);
  });
});

describe('Ollama embeddings', () => {
  it('embeds with a local model and reports it as free', async () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const call = async <T,>(cmd: string, args?: Record<string, unknown>) => {
      calls.push([cmd, args]);
      if (cmd === 'compat_embedding_models') return [{ id: 'nomic-embed-text:latest', name: 'nomic-embed-text:latest', contextLength: 2048, pricePrompt: '0' }] as T;
      return { model: 'nomic-embed-text:latest', dimensions: 3, count: 1, vectors: base64.encode(new Uint8Array(new Float32Array([0.5, 0, 1]).buffer)), promptTokens: 2 } as T;
    };
    const e = ollamaEmbeddings(call);
    expect(e.providerId).toBe('ollama');
    expect((await e.models()).map((m) => m.id)).toEqual(['nomic-embed-text:latest']);
    const b = await e.embed('o1', 'nomic-embed-text:latest', ['ciao']);
    expect(Array.from(b.vectors[0])).toEqual([0.5, 0, 1]);
    expect(b.usage).toEqual({ requests: 1, tokens: 2, costUsd: 0 });
    expect(calls[1]).toEqual(['compat_embed', { flavor: 'ollama', connectionId: 'o1', model: 'nomic-embed-text:latest', inputs: ['ciao'] }]);
  });

  it('reports failures as EmbeddingError', async () => {
    const e = ollamaEmbeddings(async () => {
      throw { code: 'network', message: 'Ollama is not running on this PC.' };
    });
    await expect(e.embed('o1', 'nomic-embed-text:latest', ['x'])).rejects.toMatchObject({ code: 'EMBEDDING_FAILED', message: 'Ollama is not running on this PC.' });
    await expect(e.embed('o1', 'nomic-embed-text:latest', ['x'])).rejects.toBeInstanceOf(EmbeddingError);
  });
});

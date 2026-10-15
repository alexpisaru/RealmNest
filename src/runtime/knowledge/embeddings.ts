// Embeddings, provider-independent. Knowledge asks an EmbeddingService; the
// service asks the provider behind a connection (OpenRouter, the OpenAI API,
// a local Ollama: each one an EmbeddingProvider through the native host).
// Batches respect the provider's limits; identical texts are embedded once per
// model (content hash cache); every vector of one index has one model and one size.

import { invoke } from '@tauri-apps/api/core';
import type { EmbeddingIdentity } from '../../domain/knowledge';
import { base64 } from '../skills/package';

export interface EmbeddingUsage {
  /** what the provider reported (never estimated) */
  tokens?: number;
  costUsd?: number;
  requests: number;
}

export interface EmbeddingBatch {
  vectors: Float32Array[];
  dimensions: number;
  model: string;
  usage: EmbeddingUsage;
}

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  pricePrompt?: string;
}

export interface EmbeddingProvider {
  readonly providerId: string;
  /** per request */
  readonly maxInputs: number;
  readonly maxChars: number;
  /** the connection asking (backends whose model list needs its key, e.g. OpenAI) */
  models(connectionId?: string): Promise<EmbeddingModelInfo[]>;
  embed(connectionId: string, model: string, texts: string[]): Promise<EmbeddingBatch>;
}

export class EmbeddingError extends Error {
  constructor(
    readonly code: 'EMBEDDINGS_UNAVAILABLE' | 'EMBEDDING_FAILED' | 'EMBEDDING_MISMATCH' | 'CANCELLED',
    message: string,
  ) {
    super(message);
  }
}

/** OpenRouter's /embeddings through the native host (the key never reaches the page) */
export class OpenRouterEmbeddings implements EmbeddingProvider {
  readonly providerId = 'openrouter';
  readonly maxInputs = 64;
  readonly maxChars = 200_000;
  async models() {
    return invoke<EmbeddingModelInfo[]>('openrouter_embedding_models');
  }
  async embed(connectionId: string, model: string, texts: string[]): Promise<EmbeddingBatch> {
    try {
      const r = await invoke<{ model: string; dimensions: number; count: number; vectors: string; promptTokens?: number; cost?: number }>('openrouter_embed', { connectionId, model, inputs: texts });
      const flat = new Float32Array(base64.decode(r.vectors).buffer.slice(0));
      const vectors = Array.from({ length: r.count }, (_, i) => flat.slice(i * r.dimensions, (i + 1) * r.dimensions));
      return { vectors, dimensions: r.dimensions, model: r.model || model, usage: { requests: 1, ...(r.promptTokens !== undefined && { tokens: r.promptTokens }), ...(r.cost !== undefined && { costUsd: r.cost }) } };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      throw new EmbeddingError('EMBEDDING_FAILED', e?.message ?? String(err));
    }
  }
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/** decode the native answer (float32 little-endian base64) into one vector per input */
function toBatch(r: { model: string; dimensions: number; count: number; vectors: string; promptTokens?: number; cost?: number }, model: string, costWhenSilent?: number): EmbeddingBatch {
  const flat = new Float32Array(base64.decode(r.vectors).buffer.slice(0));
  const vectors = Array.from({ length: r.count }, (_, i) => flat.slice(i * r.dimensions, (i + 1) * r.dimensions));
  const cost = r.cost ?? costWhenSilent;
  return { vectors, dimensions: r.dimensions, model: r.model || model, usage: { requests: 1, ...(r.promptTokens !== undefined && { tokens: r.promptTokens }), ...(cost !== undefined && { costUsd: cost }) } };
}

/**
 * The OpenAI API's or a local Ollama's embeddings through the native compat
 * commands (a typed flavor, never a URL; OpenAI's key stays in Rust).
 * OpenAI reports tokens only; Ollama runs locally and is reported as free.
 */
export class CompatEmbeddings implements EmbeddingProvider {
  readonly maxInputs = 64;
  readonly maxChars = 200_000;
  constructor(
    readonly flavor: 'openai' | 'ollama',
    readonly providerId: string,
    private call: Invoke = invoke,
  ) {}
  async models(connectionId = ''): Promise<EmbeddingModelInfo[]> {
    return this.call<EmbeddingModelInfo[]>('compat_embedding_models', { flavor: this.flavor, connectionId });
  }
  async embed(connectionId: string, model: string, texts: string[]): Promise<EmbeddingBatch> {
    try {
      const r = await this.call<{ model: string; dimensions: number; count: number; vectors: string; promptTokens?: number; cost?: number }>('compat_embed', { flavor: this.flavor, connectionId, model, inputs: texts });
      return toBatch(r, model, this.flavor === 'ollama' ? 0 : undefined);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      throw new EmbeddingError('EMBEDDING_FAILED', e?.message ?? String(err));
    }
  }
}

/** OpenAI API embeddings (text-embedding-3-small / -large…), provider id 'openai-api' */
export const openAiEmbeddings = (call?: Invoke) => new CompatEmbeddings('openai', 'openai-api', call);
/** a local Ollama's embedding models (e.g. nomic-embed-text), provider id 'ollama' */
export const ollamaEmbeddings = (call?: Invoke) => new CompatEmbeddings('ollama', 'ollama', call);

/** where a choice of connection / model lands, or why it cannot */
export interface EmbeddingTarget {
  connectionId: string;
  providerId: string;
  model: string;
  provider: EmbeddingProvider;
}

/** vectors kept in the session cache (least recently used go first) */
const CACHE_ENTRIES = 5_000;
/** one embedding request may take this long before the job stops waiting for it */
const BATCH_TIMEOUT_MS = 5 * 60_000;

/**
 * Wait for a provider call, but stop waiting when the job is cancelled or the call hangs: the
 * native request cannot be aborted from here, its late answer is simply not used.
 */
function abortable<T>(p: Promise<T>, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) return reject(new EmbeddingError('CANCELLED', 'Indexing was cancelled.'));
    const onAbort = () => finish(() => reject(new EmbeddingError('CANCELLED', 'Indexing was cancelled.')));
    const timer = setTimeout(() => finish(() => reject(new EmbeddingError('EMBEDDING_FAILED', `The embedding request did not answer within ${Math.round(timeoutMs / 60_000)} minutes.`))), timeoutMs);
    let done = false;
    const finish = (f: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      f();
    };
    signal?.addEventListener('abort', onAbort);
    p.then(
      (v) => finish(() => resolve(v)),
      (e) => finish(() => reject(e)),
    );
  });
}

export class EmbeddingService {
  /** model + content hash → vector (this session; indexes keep their own vectors); an LRU */
  private cache = new Map<string, Float32Array>();
  private cached(key: string): Float32Array | undefined {
    const v = this.cache.get(key);
    if (v) {
      this.cache.delete(key);
      this.cache.set(key, v);
    }
    return v;
  }
  private remember(key: string, v: Float32Array) {
    this.cache.delete(key);
    this.cache.set(key, v);
    for (const k of this.cache.keys()) {
      if (this.cache.size <= CACHE_ENTRIES) break;
      this.cache.delete(k);
    }
  }

  constructor(
    /** the embedding provider of a connection, when it has one and is usable */
    private providerFor: (connectionId: string) => { provider: EmbeddingProvider; providerId: string; available: boolean; name: string } | undefined,
    /** the routing policy's embeddings.create target */
    private route: () => { connectionId: string; modelId?: string } | undefined,
  ) {}

  private catalogs = new Map<string, EmbeddingModelInfo[]>();
  private loading = new Map<string, Promise<EmbeddingModelInfo[]>>();
  /** called when a catalogue arrives (routes re-check their models) */
  onCatalog?: () => void;

  /** the embedding models a connection offers (fetched once per provider kind and session) */
  async models(connectionId: string): Promise<EmbeddingModelInfo[]> {
    const p = this.providerFor(connectionId);
    if (!p) return [];
    const have = this.catalogs.get(p.providerId);
    if (have) return have;
    let pending = this.loading.get(p.providerId);
    if (!pending) {
      pending = p.provider
        .models(connectionId)
        .then((list) => {
          this.catalogs.set(p.providerId, list);
          this.onCatalog?.();
          return list;
        })
        .finally(() => this.loading.delete(p.providerId));
      this.loading.set(p.providerId, pending);
    }
    return pending;
  }

  /** model ids already known for a connection (undefined: not fetched yet) */
  catalog(connectionId: string): string[] | undefined {
    const p = this.providerFor(connectionId);
    return p ? this.catalogs.get(p.providerId)?.map((m) => m.id) : undefined;
  }

  /** resolve a base's choice now (auto → the route); never invents a model */
  resolve(choice: { connectionId: string | 'auto'; model?: string } | undefined): EmbeddingTarget {
    const c = choice?.connectionId === 'auto' || !choice ? this.route() : { connectionId: choice.connectionId, modelId: choice.model };
    if (!c) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', 'No embedding route is set (Settings › AI Capabilities › Embeddings).');
    const p = this.providerFor(c.connectionId);
    if (!p) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', 'That AI connection cannot create embeddings.');
    if (!p.available) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', `${p.name} is not connected.`);
    const model = choice?.model ?? c.modelId;
    if (!model) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', 'Choose an embedding model.');
    return { connectionId: c.connectionId, providerId: p.providerId, model, provider: p.provider };
  }

  /**
   * Embed texts (with their content hashes) in batches. `known` gives vectors
   * already made with this exact model (a previous index generation).
   * Every vector must have `expectDimensions` when given.
   */
  async embedAll(target: EmbeddingTarget, items: { text: string; hash: string }[], o: { known?: Map<string, Float32Array>; expectDimensions?: number; signal?: AbortSignal } = {}): Promise<{ vectors: Float32Array[]; dimensions: number; usage: EmbeddingUsage; reused: number }> {
    const key = (h: string) => `${target.providerId}:${target.model}:${h}`;
    const out: (Float32Array | undefined)[] = items.map((it) => o.known?.get(it.hash) ?? this.cached(key(it.hash)));
    const reused = out.filter(Boolean).length;
    const todo = items.map((it, i) => ({ ...it, i })).filter((it) => !out[it.i]);
    const usage: EmbeddingUsage = { requests: 0 };
    let dims = o.expectDimensions ?? out.find(Boolean)?.length;
    for (let start = 0; start < todo.length; ) {
      if (o.signal?.aborted) throw new EmbeddingError('CANCELLED', 'Indexing was cancelled.');
      // a batch: at most maxInputs texts and maxChars characters
      const batch: typeof todo = [];
      let chars = 0;
      while (start < todo.length && batch.length < target.provider.maxInputs && (chars + todo[start].text.length <= target.provider.maxChars || !batch.length)) {
        chars += todo[start].text.length;
        batch.push(todo[start++]);
      }
      const r = await abortable(target.provider.embed(target.connectionId, target.model, batch.map((b) => b.text)), o.signal, BATCH_TIMEOUT_MS);
      if (r.vectors.length !== batch.length) throw new EmbeddingError('EMBEDDING_FAILED', 'The provider returned a different number of vectors.');
      if (dims !== undefined && r.dimensions !== dims) throw new EmbeddingError('EMBEDDING_MISMATCH', `The model returned ${r.dimensions}-dimension vectors; this index uses ${dims}.`);
      dims = r.dimensions;
      usage.requests += r.usage.requests;
      if (r.usage.tokens !== undefined) usage.tokens = (usage.tokens ?? 0) + r.usage.tokens;
      if (r.usage.costUsd !== undefined) usage.costUsd = (usage.costUsd ?? 0) + r.usage.costUsd;
      batch.forEach((b, k) => {
        out[b.i] = r.vectors[k];
        this.remember(key(b.hash), r.vectors[k]);
      });
    }
    if (dims === undefined) throw new EmbeddingError('EMBEDDING_FAILED', 'Nothing was embedded.');
    return { vectors: out as Float32Array[], dimensions: dims, usage, reused };
  }

  /** one query vector with exactly the identity an index was built with */
  async embedQuery(identity: EmbeddingIdentity, text: string): Promise<Float32Array> {
    const p = this.providerFor(identity.connectionId);
    if (!p || !p.available) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', 'The embedding connection of this base is not available.');
    const r = await p.provider.embed(identity.connectionId, identity.model, [text.slice(0, 8_000)]);
    if (r.dimensions !== identity.dimensions) throw new EmbeddingError('EMBEDDING_MISMATCH', 'The embedding model changed its vector size.');
    return r.vectors[0];
  }
}

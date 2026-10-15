// ─────────────────────────────────────────────────────────────
// OpenRouterProvider: one OpenRouter connection behind the AIProvider contract.
// The class doing the work, ChatCompletionsProvider, is parametrized (id, name,
// capabilities, hints) and serves every OpenAI-style chat-completions backend
// RealmNest reaches through the native host: OpenRouter, OpenAI, Ollama.
//
// Stateless at the provider level (capabilities.sessions = false): no session
// ids are invented; ConversationRuntime sends the conversation history each
// turn. The system prompt travels as a real system message. The wire format
// (SSE chunks) is parsed in Rust; this class only maps its typed events onto
// normalized ProviderEvents.
// ─────────────────────────────────────────────────────────────

import { AsyncQueue } from '../../../core/asyncQueue';
import { redact } from '../../process/text';
import type { AIProvider, ProviderCapabilities, ProviderErrorCode, ProviderEvent, ProviderEventBody, ProviderMessage, ProviderStatus, ProviderTurnRequest, ModelInfo } from '../types';
import { isTerminal } from '../types';
import { acceptedEffort } from '../effort';
import type { ChatCompletionsTransport, OpenRouterTransport, OrMessage, OrPart, OrStreamEvent, OrValidation } from './transport';

export const OPENROUTER_ID = 'openrouter';

/** OpenRouter's `reasoning.effort` levels, lowest first (the native host allows exactly these) */
export const OPENROUTER_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'];
/** what a model that takes `reasoning` but states no levels gets */
const PLAIN_EFFORTS = ['low', 'medium', 'high'];

/**
 * The effort levels of a catalogue model: only for models that take the `reasoning`
 * parameter; the levels its entry states, else low / medium / high.
 */
export function withOpenRouterEfforts(m: ModelInfo): ModelInfo {
  if (!m.supportedParameters?.includes('reasoning')) return m.reasoning?.efforts?.length ? { ...m, reasoning: { ...m.reasoning, efforts: [] } } : m;
  const stated = OPENROUTER_EFFORTS.filter((e) => m.reasoning?.efforts?.includes(e));
  return { ...m, reasoning: { ...m.reasoning, efforts: stated.length ? stated : PLAIN_EFFORTS } };
}

export const OPENROUTER_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  // no tools of its own: every tool is RealmNest's, run by RealmNest (toolCalling)
  tools: false,
  // images and PDFs as message parts; whether a model takes them is per model (catalogue)
  vision: true,
  files: true,
  // /api/v1/embeddings through the native host (Knowledge)
  embeddings: true,
  // response_format json_schema, for models whose catalogue lists structured_outputs
  structuredOutput: true,
  // RealmNest tools as OpenAI-style functions, for models whose catalogue lists "tools"
  toolCalling: true,
  sessions: false,
  local: false,
  usage: true,
  cost: true,
  cancellation: true,
  modelListing: true,
  systemPrompt: true,
  // the web plugin (paid per search; results as url_citation annotations)
  webSearch: true,
};

/** native error codes → provider-neutral ones */
const ERROR_CODES: Record<string, ProviderErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  missing_key: 'not_authenticated',
  payment_required: 'payment_required',
  forbidden: 'api_error',
  model_unavailable: 'model_unavailable',
  bad_request: 'invalid_request',
  timeout: 'timeout',
  rate_limited: 'rate_limited',
  provider_unavailable: 'unavailable',
  network: 'unavailable',
  malformed: 'malformed_event',
  too_large: 'invalid_request',
};

/** What differs between chat-completions backends; the turn logic is shared. */
export interface ChatCompletionsConfig {
  id: string;
  /** product name used in messages, e.g. "OpenRouter" */
  name: string;
  capabilities: ProviderCapabilities;
  /** what the user can do about a status */
  hints?: { missingKey?: string; invalidKey?: string; unavailable?: string };
  /** how the connection signs in (status details) */
  auth?: string;
  /** extra status facts from the check */
  statusDetails?: (v: OrValidation) => Record<string, string>;
  /** runs before the check (Ollama: start the local server); a `status` ends the check there */
  prepare?: (checkedAt: number) => Promise<{ status?: ProviderStatus; details?: Record<string, string> }>;
  /** the model to use when a turn names none, chosen only among the backend's own list */
  defaultModel?: (models: ModelInfo[]) => string | undefined;
  /** cost reported with usage when the backend reports none (Ollama: 0, it runs locally) */
  costWhenSilent?: number;
  /** the backend takes a reasoning effort: each model's levels (ModelInfo.reasoning.efforts); none: never sent */
  efforts?: (m: ModelInfo) => ModelInfo;
}

export class ChatCompletionsProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /** native run id per turn, for cancellation */
  private native = new Map<string, Promise<string | null>>();
  /** the last model list (an object, so wrappers made with Object.create share it) */
  private cache: { models?: ModelInfo[] } = {};

  constructor(
    protected connectionId: string,
    protected transport: ChatCompletionsTransport,
    protected config: ChatCompletionsConfig,
    private opts: { turnTimeoutMs?: number } = {},
  ) {
    this.id = config.id;
    this.name = config.name;
    this.capabilities = config.capabilities;
  }

  async getStatus(): Promise<ProviderStatus> {
    const checkedAt = Date.now();
    const name = this.config.name;
    if (!this.transport.available) return { state: 'unavailable', message: `${name} needs the RealmNest desktop app.`, checkedAt };
    let v;
    let prepared: Record<string, string> = {};
    try {
      if (this.config.prepare) {
        const p = await this.config.prepare(checkedAt);
        if (p.status) return p.status;
        prepared = p.details ?? {};
      }
      v = await this.transport.validate(this.connectionId);
    } catch (err) {
      return { state: 'error', message: `Could not check ${name}.`, details: { error: redact(String(err)) }, checkedAt };
    }
    const details: Record<string, string> = { ...prepared, ...this.config.statusDetails?.(v) };
    const hints = this.config.hints ?? {};
    switch (v.status) {
      case 'connected':
        return { state: 'available', message: v.message, details: { auth: this.config.auth ?? 'API key', ...details }, checkedAt };
      case 'missing_key':
        return { state: 'not_authenticated', message: v.message, ...(hints.missingKey && { hint: hints.missingKey }), checkedAt };
      case 'invalid_credentials':
        return { state: 'invalid_credentials', message: v.message, ...(hints.invalidKey && { hint: hints.invalidKey }), checkedAt };
      case 'unavailable':
        return { state: 'unavailable', message: v.message, ...(hints.unavailable && { hint: hints.unavailable }), checkedAt };
      default:
        return { state: 'error', message: v.message, checkedAt };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const listed = await this.transport.models(this.connectionId);
    const models = this.config.efforts ? listed.map(this.config.efforts) : listed;
    this.cache.models = models;
    return models;
  }

  /** the turn's effort when this backend and model take it (the model list read once if not cached yet) */
  private async effortFor(model: string, effort: string | undefined): Promise<string | undefined> {
    if (!effort || !this.config.efforts) return undefined;
    const models = this.cache.models ?? (await this.listModels().catch(() => [] as ModelInfo[]));
    return acceptedEffort(models, model, effort);
  }

  /** the configured default, only when the backend's own list has it */
  private async fallbackModel(): Promise<string | undefined> {
    if (!this.config.defaultModel) return undefined;
    const models = this.cache.models ?? (await this.listModels().catch(() => [] as ModelInfo[]));
    return this.config.defaultModel(models);
  }

  async cancel(runId: string) {
    const id = await this.native.get(runId);
    if (id) await this.transport.cancel(id);
  }

  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    let seq = 0;
    const stamp = (body: ProviderEventBody): ProviderEvent => ({ ...body, runId: req.runId, providerId: this.id, seq: ++seq, at: Date.now() }) as ProviderEvent;

    const model = req.model || (await this.fallbackModel());
    if (!model) {
      yield stamp({ type: 'run.failed', error: { code: 'invalid_request', message: `Choose a model for this ${this.config.name} connection (or set a preferred model in Settings).` } });
      return;
    }
    const last = req.messages.at(-1);
    // a turn answers the user, or carries tool results back to the model
    if (!last || !((last.role === 'user' && (last.content.trim() || last.attachments?.length)) || last.role === 'tool')) {
      yield stamp({ type: 'run.failed', error: { code: 'invalid_request', message: 'Write a prompt first.' } });
      return;
    }
    const messages: OrMessage[] = [...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []), ...req.messages.map(toOrMessage)];
    const effort = await this.effortFor(model, req.effort);

    const queue = new AsyncQueue<ProviderEvent>();
    let terminal = false;
    let text = '';
    let messageId = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    let costUsd: number | undefined;
    const emit = (body: ProviderEventBody) => {
      if (terminal) return;
      if (isTerminal(body)) terminal = true;
      queue.push(stamp(body));
      if (terminal) queue.end();
    };

    const onEvent = (e: OrStreamEvent) => {
      switch (e.t) {
        case 'tool': {
          // the arguments arrive as a JSON string; unreadable ones reach the runtime as "no object" (INVALID_TOOL_INPUT)
          let input: unknown;
          try {
            input = JSON.parse(e.args || '{}');
          } catch {
            input = undefined;
          }
          emit({ type: 'tool.requested', messageId: messageId || `${req.runId}-m1`, toolCallId: e.id, name: e.name, input });
          break;
        }
        case 'start':
          messageId = `${req.runId}-m1`;
          emit({ type: 'message.started', messageId, model: e.model });
          break;
        case 'delta':
          if (!messageId) {
            messageId = `${req.runId}-m1`;
            emit({ type: 'message.started', messageId, model });
          }
          text += e.d;
          emit({ type: 'text.delta', messageId, index: 0, text: e.d });
          break;
        case 'usage':
          usage = { inputTokens: e.prompt, outputTokens: e.completion };
          costUsd = e.cost ?? this.config.costWhenSilent;
          emit({ type: 'usage.updated', usage, cumulative: true, ...(costUsd !== undefined && { costUsd }) });
          break;
        case 'done':
          if (messageId) emit({ type: 'text.completed', messageId, index: 0, text });
          emit({ type: 'run.completed', text, stopReason: e.finishReason, ...(usage && { usage }), ...(costUsd !== undefined && { costUsd }) });
          break;
        case 'error':
          emit({ type: 'run.failed', error: { code: ERROR_CODES[e.code] ?? 'api_error', message: e.message, ...(e.status && { detail: `HTTP ${e.status}` }) } });
          break;
        case 'cancelled':
          emit({ type: 'run.cancelled', reason: 'Cancelled.' });
          break;
        case 'search':
          emit({ type: 'search.results', ...(e.query && { query: e.query }), results: e.results });
          break;
      }
    };

    // stream events can arrive before invoke() returns: announce the turn first
    emit({ type: 'provider.started', model });
    const started = this.transport
      .chat(
        this.connectionId,
        {
          model,
          messages,
          ...(req.toolSchemas?.length && { tools: req.toolSchemas.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } })) }),
          timeoutMs: req.timeoutMs ?? this.opts.turnTimeoutMs,
          ...(req.responseSchema && { responseSchema: req.responseSchema }),
          ...(req.webSearch && this.capabilities.webSearch && { webSearch: req.webSearch.maxUses ?? 5 }),
          ...(effort && { effort }),
        },
        onEvent,
      )
      .then(
        (id) => id,
        (err) => {
          emit({ type: 'run.failed', error: { code: 'unavailable', message: `${this.config.name} could not be reached from this build.`, detail: redact(String(err)) } });
          return null;
        },
      );
    this.native.set(req.runId, started);

    const stop = () =>
      void started.then((id) => {
        if (id && !terminal) void this.transport.cancel(id);
      });
    req.abortSignal?.addEventListener('abort', stop);
    if (req.abortSignal?.aborted) stop();

    try {
      for await (const e of queue) yield e;
    } finally {
      // the consumer left early: stop the HTTP request too
      if (!terminal) stop();
      req.abortSignal?.removeEventListener('abort', stop);
      this.native.delete(req.runId);
    }
  }
}

export class OpenRouterProvider extends ChatCompletionsProvider {
  constructor(connectionId: string, transport: OpenRouterTransport, opts: { turnTimeoutMs?: number } = {}) {
    super(
      connectionId,
      transport,
      {
        id: OPENROUTER_ID,
        name: 'OpenRouter',
        capabilities: OPENROUTER_CAPABILITIES,
        hints: { missingKey: 'Remove this connection and add it again with your OpenRouter API key.', invalidKey: 'Check the key at openrouter.ai/keys, then add the connection again.' },
        statusDetails: (v): Record<string, string> => (v.freeTier !== undefined ? { plan: v.freeTier ? 'free tier' : 'paid' } : {}),
        efforts: withOpenRouterEfforts,
      },
      opts,
    );
  }
}

/** a message with images or PDFs becomes OpenRouter content parts (data URLs only); tool calls and results keep their ids */
export function toOrMessage(m: ProviderMessage): OrMessage {
  if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' };
  if (m.toolCalls?.length)
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })),
    };
  if (!m.attachments?.length) return { role: m.role, content: m.content };
  const parts: OrPart[] = [{ type: 'text', text: m.content }];
  for (const a of m.attachments) {
    if (a.kind === 'image') parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${a.data}` } });
    else parts.push({ type: 'file', file: { filename: a.name, file_data: `data:application/pdf;base64,${a.data}` } });
  }
  return { role: m.role, content: parts };
}

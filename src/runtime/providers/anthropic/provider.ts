// ─────────────────────────────────────────────────────────────
// AnthropicProvider: one Anthropic API connection (an API key) behind the AIProvider
// contract. Stateless like OpenRouter: the history is sent each turn, the system prompt
// is the API's `system` field, RealmNest tools are `tools` and come back as tool_use
// blocks. The stream is parsed in Rust (src-tauri/src/anthropic).
// ─────────────────────────────────────────────────────────────

import { AsyncQueue } from '../../../core/asyncQueue';
import { redact } from '../../process/text';
import type { AIProvider, ModelInfo, ProviderCapabilities, ProviderErrorCode, ProviderEvent, ProviderEventBody, ProviderMessage, ProviderStatus, ProviderTurnRequest } from '../types';
import { isTerminal } from '../types';
import type { OrStreamEvent } from '../openrouter/transport';
import type { AnBlock, AnMessage, AnthropicTransport } from './transport';

export const ANTHROPIC_API_ID = 'anthropic-api';
/** used when neither the chat, the agent nor the connection names a model */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-5-5';

export const ANTHROPIC_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  tools: false,
  vision: true,
  files: true,
  toolCalling: true,
  sessions: false,
  local: false,
  usage: true,
  cost: false,
  cancellation: true,
  modelListing: true,
  systemPrompt: true,
  // the server web_search tool (billed per search)
  webSearch: true,
};

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

export class AnthropicProvider implements AIProvider {
  readonly id = ANTHROPIC_API_ID;
  readonly name = 'Anthropic API';
  readonly capabilities = ANTHROPIC_CAPABILITIES;
  private native = new Map<string, Promise<string | null>>();

  constructor(
    private connectionId: string,
    private transport: AnthropicTransport,
    private opts: { turnTimeoutMs?: number } = {},
  ) {}

  async getStatus(): Promise<ProviderStatus> {
    const checkedAt = Date.now();
    if (!this.transport.available) return { state: 'unavailable', message: 'The Anthropic API needs the RealmNest desktop app.', checkedAt };
    let v;
    try {
      v = await this.transport.validate(this.connectionId);
    } catch (err) {
      return { state: 'error', message: 'Could not check the Anthropic API.', details: { error: redact(String(err)) }, checkedAt };
    }
    switch (v.status) {
      case 'connected':
        return { state: 'available', message: v.message, details: { auth: 'API key' }, checkedAt };
      case 'missing_key':
        return { state: 'not_authenticated', message: v.message, hint: 'Remove this connection and add it again with your Anthropic API key.', checkedAt };
      case 'invalid_credentials':
        return { state: 'invalid_credentials', message: v.message, hint: 'Check the key at console.anthropic.com, then add the connection again.', checkedAt };
      case 'unavailable':
        return { state: 'unavailable', message: v.message, checkedAt };
      default:
        return { state: 'error', message: v.message, checkedAt };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.transport.models(this.connectionId);
  }

  async cancel(runId: string) {
    const id = await this.native.get(runId);
    if (id) await this.transport.cancel(id);
  }

  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    let seq = 0;
    const stamp = (body: ProviderEventBody): ProviderEvent => ({ ...body, runId: req.runId, providerId: this.id, seq: ++seq, at: Date.now() }) as ProviderEvent;
    const model = req.model || ANTHROPIC_DEFAULT_MODEL;
    const messages = toAnMessages(req.messages);
    if (!messages.length || messages[0].role !== 'user') {
      yield stamp({ type: 'run.failed', error: { code: 'invalid_request', message: 'Write a prompt first.' } });
      return;
    }

    const queue = new AsyncQueue<ProviderEvent>();
    let terminal = false;
    let text = '';
    let messageId = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    const emit = (body: ProviderEventBody) => {
      if (terminal) return;
      if (isTerminal(body)) terminal = true;
      queue.push(stamp(body));
      if (terminal) queue.end();
    };
    const onEvent = (e: OrStreamEvent) => {
      switch (e.t) {
        case 'tool': {
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
          emit({ type: 'usage.updated', usage, cumulative: true });
          break;
        case 'done':
          if (messageId) emit({ type: 'text.completed', messageId, index: 0, text });
          emit({ type: 'run.completed', text, stopReason: e.finishReason, ...(usage && { usage }) });
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

    emit({ type: 'provider.started', model });
    const started = this.transport
      .chat(
        this.connectionId,
        {
          model,
          ...(req.systemPrompt && { system: req.systemPrompt }),
          messages,
          ...(req.toolSchemas?.length && { tools: req.toolSchemas.map((t) => ({ name: t.name, description: t.description ?? '', input_schema: t.parameters })) }),
          timeout_ms: req.timeoutMs ?? this.opts.turnTimeoutMs,
          ...(req.webSearch && { web_search: req.webSearch.maxUses ?? 5 }),
        },
        onEvent,
      )
      .then(
        (id) => id,
        (err) => {
          emit({ type: 'run.failed', error: { code: 'unavailable', message: 'The Anthropic API could not be reached from this build.', detail: redact(String(err)) } });
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
      if (!terminal) stop();
      req.abortSignal?.removeEventListener('abort', stop);
      this.native.delete(req.runId);
    }
  }
}

/**
 * RealmNest's history in the Messages API's shape: tool results are user turns
 * (tool_result blocks), tool calls are assistant tool_use blocks, attachments are
 * base64 image / document blocks, and consecutive turns of one role are merged
 * (the API wants user and assistant to alternate).
 */
export function toAnMessages(history: ProviderMessage[]): AnMessage[] {
  const out: AnMessage[] = [];
  const push = (role: 'user' | 'assistant', blocks: AnBlock[]) => {
    if (!blocks.length) return;
    const last = out.at(-1);
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of history) {
    if (m.role === 'tool') {
      push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: m.content || '(empty)' }]);
      continue;
    }
    const blocks: AnBlock[] = [];
    if (m.content.trim()) blocks.push({ type: 'text', text: m.content });
    for (const a of m.attachments ?? []) {
      if (a.kind === 'image') blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime, data: a.data } });
      else blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } });
    }
    if (m.role === 'assistant') for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input ?? {} });
    push(m.role, blocks);
  }
  return out;
}

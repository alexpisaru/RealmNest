// ─────────────────────────────────────────────────────────────
// Claude Code stream-json → normalized RealmNest provider events.
//
// One JSON object per stdout line. With --include-partial-messages Claude Code
// sends raw streaming events (`stream_event`) and then the complete message
// (`assistant`) again; text is taken from the stream and the complete message
// only contributes what the stream does not carry (tool calls with full input).
// ─────────────────────────────────────────────────────────────

import type { ProviderErrorCode, ProviderErrorInfo, ProviderEventBody, TokenUsage } from '../types';
import { clip, redact } from '../../process/text';
import type {
  AnthropicStreamEvent,
  ClaudeAssistantMessage,
  ClaudeContentBlock,
  ClaudeResult,
  ClaudeStreamEvent,
  ClaudeSystemInit,
  ClaudeUsage,
  ClaudeUserMessage,
} from './types';

export interface ParsedEvent {
  body: ProviderEventBody;
  raw: unknown;
}

export interface ParserOptions {
  /** the turn resumed an existing session */
  resumed?: boolean;
}

const API_ERRORS: Record<string, { code: ProviderErrorCode; message: string }> = {
  authentication_failed: { code: 'not_authenticated', message: 'Claude Code is not signed in.' },
  rate_limit: { code: 'rate_limited', message: 'Claude usage limit reached. Try again later.' },
  billing_error: { code: 'api_error', message: 'Claude rejected the request because of a billing problem.' },
};

const RESULT_ERRORS: Record<string, { code: ProviderErrorCode; message: string }> = {
  error_max_turns: { code: 'max_turns', message: 'Claude Code stopped: too many turns.' },
  error_max_budget_usd: { code: 'budget_exceeded', message: 'Claude Code stopped: budget limit reached.' },
  error_during_execution: { code: 'execution_error', message: 'Claude Code failed while running the turn.' },
};

export const usageOf = (u: ClaudeUsage | undefined): TokenUsage | undefined =>
  u
    ? {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        ...(u.cache_read_input_tokens !== undefined && { cacheReadTokens: u.cache_read_input_tokens }),
        ...(u.cache_creation_input_tokens !== undefined && { cacheWriteTokens: u.cache_creation_input_tokens }),
      }
    : undefined;

export class ClaudeStreamParser {
  /** message ids whose text arrived through stream events */
  private streamed = new Set<string>();
  /** text blocks being streamed: `${messageId}:${index}` → text so far */
  private blocks = new Map<string, string>();
  /** current streamed message per parent tool call ('' for the main agent) */
  private current = new Map<string, string>();
  private announced = new Set<string>();
  private toolsSeen = new Set<string>();
  private apiError: ProviderErrorInfo | null = null;
  private done = false;

  constructor(private opts: ParserOptions = {}) {}

  /** a terminal event has been produced */
  get finished() {
    return this.done;
  }

  /** the last API error reported in the stream, if any */
  get lastApiError() {
    return this.apiError;
  }

  /** Parse one stdout line. Blank lines produce nothing. */
  push(line: string): ParsedEvent[] {
    const text = line.trim();
    if (!text) return [];
    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return [this.malformed('not JSON', text)];
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return [this.malformed('no "type" field', text)];
    const out: ProviderEventBody[] = [];
    try {
      this.handle(msg as { type: string }, out);
    } catch (err) {
      return [this.malformed(`unexpected shape (${String(err)})`, text)];
    }
    return out.map((body) => ({ body, raw: msg }));
  }

  private malformed(why: string, text: string): ParsedEvent {
    return {
      body: { type: 'provider.error', error: { code: 'malformed_event', message: 'Claude Code sent output RealmNest could not read; it was skipped.', detail: `${why}: ${clip(redact(text), 200)}` } },
      raw: undefined,
    };
  }

  private handle(msg: { type: string }, out: ProviderEventBody[]) {
    switch (msg.type) {
      case 'system':
        return this.system(msg as ClaudeSystemInit, out);
      case 'stream_event':
        return this.stream(msg as ClaudeStreamEvent, out);
      case 'assistant':
        return this.assistant(msg as ClaudeAssistantMessage, out);
      case 'user':
        return this.user(msg as ClaudeUserMessage, out);
      case 'result':
        return this.result(msg as ClaudeResult, out);
      case 'rate_limit_event':
        return this.limits(msg as { rate_limit_info?: unknown }, out);
      // other types (prompt suggestions, hook events…) carry nothing we normalize
    }
  }

  /** the plan's usage windows (5-hour session, week): numbers only, anything else is ignored */
  private limits(m: { rate_limit_info?: unknown }, out: ProviderEventBody[]) {
    const info = (m.rate_limit_info ?? {}) as { status?: unknown; unifiedWindows?: Record<string, { utilization?: unknown; resetsAt?: unknown }> };
    const windows = Object.entries(info.unifiedWindows ?? {})
      .filter(([, w]) => w && typeof w.utilization === 'number' && Number.isFinite(w.utilization))
      .slice(0, 6)
      .map(([id, w]) => ({ id: id.slice(0, 40), utilization: Math.max(0, Math.min(1, w.utilization as number)), ...(typeof w.resetsAt === 'number' && { resetsAt: w.resetsAt * 1000 }) }));
    if (!windows.length) return;
    out.push({ type: 'limits.updated', limits: { windows, ...(typeof info.status === 'string' && { status: info.status.slice(0, 40) }) } });
  }

  private system(m: ClaudeSystemInit, out: ProviderEventBody[]) {
    if (m.subtype !== 'init' || typeof m.session_id !== 'string') return;
    out.push({ type: 'session.started', sessionId: m.session_id, resumed: !!this.opts.resumed, model: m.model, tools: Array.isArray(m.tools) ? m.tools : undefined });
  }

  private announce(messageId: string, model: string | undefined, out: ProviderEventBody[]) {
    if (this.announced.has(messageId)) return;
    this.announced.add(messageId);
    out.push({ type: 'message.started', messageId, model });
  }

  private stream(m: ClaudeStreamEvent, out: ProviderEventBody[]) {
    const ev = m.event as AnthropicStreamEvent;
    if (!ev || typeof ev.type !== 'string') throw new Error('stream_event without event');
    const lane = m.parent_tool_use_id ?? '';
    switch (ev.type) {
      case 'message_start': {
        const { message } = ev as Extract<AnthropicStreamEvent, { type: 'message_start' }>;
        if (typeof message?.id !== 'string') throw new Error('message_start without id');
        this.current.set(lane, message.id);
        this.streamed.add(message.id);
        this.announce(message.id, message.model, out);
        return;
      }
      case 'content_block_start': {
        const e = ev as Extract<AnthropicStreamEvent, { type: 'content_block_start' }>;
        const id = this.current.get(lane);
        if (id && e.content_block?.type === 'text') this.blocks.set(`${id}:${e.index}`, '');
        return;
      }
      case 'content_block_delta': {
        const e = ev as Extract<AnthropicStreamEvent, { type: 'content_block_delta' }>;
        const id = this.current.get(lane);
        const key = `${id}:${e.index}`;
        if (!id || e.delta?.type !== 'text_delta' || !this.blocks.has(key)) return;
        const text = String((e.delta as { text: string }).text ?? '');
        if (!text) return;
        this.blocks.set(key, this.blocks.get(key) + text);
        out.push({ type: 'text.delta', messageId: id, index: e.index, text });
        return;
      }
      case 'content_block_stop': {
        const e = ev as Extract<AnthropicStreamEvent, { type: 'content_block_stop' }>;
        const id = this.current.get(lane);
        const key = `${id}:${e.index}`;
        if (!id || !this.blocks.has(key)) return;
        out.push({ type: 'text.completed', messageId: id, index: e.index, text: this.blocks.get(key)! });
        this.blocks.delete(key);
        return;
      }
      case 'message_delta': {
        const usage = usageOf((ev as Extract<AnthropicStreamEvent, { type: 'message_delta' }>).usage);
        if (usage) out.push({ type: 'usage.updated', usage, cumulative: false });
        return;
      }
    }
  }

  private assistant(m: ClaudeAssistantMessage, out: ProviderEventBody[]) {
    const content = Array.isArray(m.message?.content) ? m.message.content : [];
    if (m.error || m.is_api_error_message) {
      const known = API_ERRORS[m.error ?? ''];
      const said = content.find((b): b is { type: 'text'; text: string } => b.type === 'text')?.text;
      this.apiError = {
        code: known?.code ?? 'api_error',
        message: known?.message ?? 'Claude returned an error.',
        detail: redact(said ?? m.error ?? ''),
      };
      out.push({ type: 'provider.error', error: this.apiError });
      return;
    }
    const id = m.message?.id;
    if (typeof id !== 'string') throw new Error('assistant message without id');
    const streamed = this.streamed.has(id);
    content.forEach((block: ClaudeContentBlock, index) => {
      if (block.type === 'text' && !streamed) {
        this.announce(id, m.message.model, out);
        out.push({ type: 'text.completed', messageId: id, index, text: String((block as { text: string }).text ?? '') });
      } else if (block.type === 'tool_use') {
        const b = block as { id: string; name: string; input: unknown };
        if (this.toolsSeen.has(b.id)) return;
        this.toolsSeen.add(b.id);
        this.announce(id, m.message.model, out);
        out.push({ type: 'tool.requested', messageId: id, toolCallId: b.id, name: b.name, input: b.input });
      }
    });
  }

  private user(m: ClaudeUserMessage, out: ProviderEventBody[]) {
    const hits = webSearchHits(m.tool_use_result);
    if (hits) out.push({ type: 'search.results', ...(hits.query && { query: hits.query }), results: hits.results });
    const content = m.message?.content;
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (block.type !== 'tool_result') continue;
      const b = block as { tool_use_id: string; content?: unknown; is_error?: boolean };
      out.push({ type: 'tool.completed', toolCallId: b.tool_use_id, isError: !!b.is_error, output: clip(redact(toolOutput(b.content)), 4_000) });
    }
  }

  private result(m: ClaudeResult, out: ProviderEventBody[]) {
    if (this.done) return;
    this.done = true;
    const usage = usageOf(m.usage);
    const costUsd = typeof m.total_cost_usd === 'number' ? m.total_cost_usd : undefined;
    if (usage) out.push({ type: 'usage.updated', usage, cumulative: true, costUsd });
    if (m.is_error) {
      const known = RESULT_ERRORS[m.subtype];
      const error: ProviderErrorInfo = this.apiError ?? {
        code: known?.code ?? 'api_error',
        message: known?.message ?? 'Claude Code could not complete the turn.',
        detail: redact(clip([m.terminal_reason, m.result].filter(Boolean).join(': '), 1_000)),
      };
      out.push({ type: 'run.failed', error });
      return;
    }
    out.push({
      type: 'run.completed',
      text: m.result ?? '',
      sessionId: m.session_id,
      durationMs: m.duration_ms,
      turns: m.num_turns,
      stopReason: m.stop_reason ?? undefined,
      usage,
      costUsd,
    });
  }
}

function toolOutput(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content
      .map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : JSON.stringify(c)))
      .join('\n');
  return content === undefined ? '' : JSON.stringify(content);
}

/** WebSearch's structured result → hits (only http(s) URLs; at most 20) */
export function webSearchHits(r: unknown): { query?: string; results: { url: string; title?: string }[] } | undefined {
  if (!r || typeof r !== 'object') return undefined;
  const o = r as { query?: unknown; results?: unknown };
  if (!Array.isArray(o.results)) return undefined;
  const results: { url: string; title?: string }[] = [];
  for (const part of o.results) {
    const items = part && typeof part === 'object' && Array.isArray((part as { content?: unknown }).content) ? (part as { content: unknown[] }).content : [];
    for (const it of items) {
      const x = it as { url?: unknown; title?: unknown };
      if (typeof x.url !== 'string' || !/^https?:\/\//i.test(x.url) || x.url.length > 2000) continue;
      if (results.some((h) => h.url === x.url)) continue;
      results.push({ url: x.url, ...(typeof x.title === 'string' && x.title.trim() && { title: x.title.trim().slice(0, 300) }) });
      if (results.length >= 20) break;
    }
  }
  return { ...(typeof o.query === 'string' && { query: o.query.slice(0, 300) }), results };
}

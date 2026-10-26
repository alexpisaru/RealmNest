// ─────────────────────────────────────────────────────────────
// `codex exec --json` JSONL → normalized RealmNest provider events.
//
// Codex sends whole items, not text deltas. A turn may hold several agent messages: a
// preamble ("I'll look at…") and then the answer, which is the LAST one. Every message is
// reported as it completes; run.completed carries the last one. `item.completed` items of
// type "error" are Codex's own notices and top-level `error` events are retries
// ("Reconnecting… 2/5"): neither is a failure. Failures arrive as `turn.failed`.
// ─────────────────────────────────────────────────────────────

import type { ProviderErrorInfo, ProviderEventBody, TokenUsage } from '../types';
import { clip, redact } from '../../process/text';
import type { CodexEvent, CodexItem, CodexUsage } from './types';

export interface ParsedEvent {
  body: ProviderEventBody;
  raw: unknown;
}

export interface CodexParserOptions {
  /** the turn opened or resumed a session RealmNest keeps (otherwise the thread is ephemeral) */
  session?: boolean;
  /** the turn resumed an existing session */
  resumed?: boolean;
}

/** credentials-looking text masked (the shared patterns, plus OpenAI keys) */
export const redactCodex = (text: string) => redact(text).replace(/\bsk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]');

/** RealmNest's convention (as for Claude): inputTokens are the uncached ones, cache reads apart */
export const usageOf = (u: CodexUsage | undefined): TokenUsage | undefined => {
  if (!u || typeof u !== 'object') return undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const cached = num(u.cached_input_tokens);
  return {
    inputTokens: Math.max(0, num(u.input_tokens) - cached),
    outputTokens: num(u.output_tokens),
    cacheReadTokens: cached,
    ...(num(u.cache_write_input_tokens) > 0 && { cacheWriteTokens: num(u.cache_write_input_tokens) }),
  };
};

/** Codex's error text (sometimes a JSON body from the API) → a RealmNest error */
export function classifyError(raw: string | undefined): ProviderErrorInfo {
  let text = (raw ?? '').trim();
  let status: number | undefined;
  if (text.startsWith('{')) {
    try {
      const body = JSON.parse(text) as { status?: unknown; error?: { message?: unknown } };
      if (typeof body.status === 'number') status = body.status;
      if (typeof body.error?.message === 'string') text = body.error.message;
    } catch {
      // not JSON after all: keep the text
    }
  }
  const detail = clip(redactCodex(text), 1_000) || undefined;
  if (status === 401 || /\b401\b|unauthori[sz]ed|not logged in|log ?in again|authentication/i.test(text))
    return { code: 'not_authenticated', message: 'ChatGPT is not signed in in Codex.', detail };
  if (status === 429 || /\b429\b|usage limit|rate limit|too many requests/i.test(text)) return { code: 'rate_limited', message: 'ChatGPT usage limit reached. Try again later.', detail };
  if (/model\b.*\b(not supported|does not exist|not found|unavailable)|model_not_found/i.test(text))
    return { code: 'model_unavailable', message: 'This model is not available with your ChatGPT account.', detail };
  return { code: 'api_error', message: 'ChatGPT could not complete the turn.', detail };
}

/**
 * A completed `web_search` item → hits: `results[]` of `{ url, title, domain, ref_id }` (Codex CLI 0.162.1).
 * Only http(s) URLs, no duplicates, at most 20. Undefined when the item has no results list
 * (e.g. an open_page or find_in_page action).
 */
export function codexSearchHits(item: unknown): { query?: string; results: { url: string; title?: string }[] } | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const o = item as { query?: unknown; action?: { query?: unknown }; results?: unknown };
  if (!Array.isArray(o.results)) return undefined;
  const results: { url: string; title?: string }[] = [];
  for (const r of o.results) {
    const x = (r && typeof r === 'object' ? r : {}) as { url?: unknown; title?: unknown };
    if (typeof x.url !== 'string' || !/^https?:\/\//i.test(x.url) || x.url.length > 2000) continue;
    if (results.some((h) => h.url === x.url)) continue;
    results.push({ url: x.url, ...(typeof x.title === 'string' && x.title.trim() && { title: x.title.trim().slice(0, 300) }) });
    if (results.length >= 20) break;
  }
  const query = typeof o.query === 'string' && o.query ? o.query : typeof o.action?.query === 'string' ? o.action.query : undefined;
  return { ...(query && { query: query.slice(0, 300) }), results };
}

export class CodexJsonParser {
  private threadId: string | undefined;
  private last: { id: string; text: string } | undefined;
  private lastError: string | undefined;
  private done = false;

  constructor(private opts: CodexParserOptions = {}) {}

  /** a terminal event has been produced */
  get finished() {
    return this.done;
  }

  /** the thread Codex reported (the session id when the turn keeps one) */
  get thread() {
    return this.threadId;
  }

  /** the last transient error, for a failure without a turn.failed */
  get lastErrorText() {
    return this.lastError;
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
      this.handle(msg as CodexEvent, out);
    } catch (err) {
      return [this.malformed(`unexpected shape (${String(err)})`, text)];
    }
    return out.map((body) => ({ body, raw: msg }));
  }

  private malformed(why: string, text: string): ParsedEvent {
    return {
      body: { type: 'provider.error', error: { code: 'malformed_event', message: 'Codex sent output RealmNest could not read; it was skipped.', detail: `${why}: ${clip(redactCodex(text), 200)}` } },
      raw: undefined,
    };
  }

  private handle(m: CodexEvent, out: ProviderEventBody[]) {
    if (this.done) return;
    switch (m.type) {
      case 'thread.started': {
        const id = (m as { thread_id?: unknown }).thread_id;
        if (typeof id !== 'string' || !id) throw new Error('thread.started without thread_id');
        this.threadId = id;
        if (this.opts.session) out.push({ type: 'session.started', sessionId: id, resumed: !!this.opts.resumed });
        return;
      }
      case 'item.completed':
        return this.item((m as { item?: CodexItem }).item, out);
      case 'error': {
        const said = (m as { message?: unknown }).message;
        if (typeof said === 'string') this.lastError = said;
        return;
      }
      case 'turn.completed':
        return this.completed((m as { usage?: CodexUsage }).usage, out);
      case 'turn.failed': {
        this.done = true;
        const said = (m as { error?: { message?: unknown } }).error?.message;
        out.push({ type: 'run.failed', error: classifyError(typeof said === 'string' ? said : this.lastError) });
        return;
      }
      // turn.started, item.started / item.updated and anything newer carry nothing we normalize
    }
  }

  private item(item: CodexItem | undefined, out: ProviderEventBody[]) {
    if (!item || typeof item !== 'object') throw new Error('item.completed without item');
    if (item.type === 'web_search') {
      // a search turn: the search's own results (never URLs the model writes)
      const hits = codexSearchHits(item);
      if (hits) out.push({ type: 'search.results', ...(hits.query && { query: hits.query }), results: hits.results });
      return;
    }
    if (item.type !== 'agent_message') return; // notices, reasoning, (disabled) tool items
    const text = typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '';
    const id = typeof item.id === 'string' && item.id ? item.id : `item_${Date.now()}`;
    this.last = { id, text };
    out.push({ type: 'message.started', messageId: id });
    out.push({ type: 'text.completed', messageId: id, index: 0, text });
  }

  private completed(raw: CodexUsage | undefined, out: ProviderEventBody[]) {
    this.done = true;
    const usage = usageOf(raw);
    if (usage) out.push({ type: 'usage.updated', usage, cumulative: true });
    if (!this.last?.text.trim()) {
      out.push({ type: 'run.failed', error: { code: 'incomplete_stream', message: 'ChatGPT finished the turn without an answer.' } });
      return;
    }
    out.push({
      type: 'run.completed',
      text: this.last.text,
      ...(this.opts.session && this.threadId && { sessionId: this.threadId }),
      ...(usage && { usage }),
    });
  }
}

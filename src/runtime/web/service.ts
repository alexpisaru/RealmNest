// ─────────────────────────────────────────────────────────────
// WebService: RealmNest's web layer.
//
//   web_fetch  URL ─▶ cache? ─▶ Rust GET (SSRF-safe) ─▶ by type: HTML / JSON / text / PDF
//              ─▶ HTML with no readable text (an app shell) ─▶ hidden WebView2 reader (desktop)
//              ─▶ readable text ─▶ WebSource labelled W1… for the run ─▶ UNTRUSTED block
//   web_search query ─▶ the configured WebSearchEngine (none in v1: SEARCH_PROVIDER_NOT_CONFIGURED)
//              ─▶ normalized, de-duplicated results (discovery only)
//
// Runs: budgets (searches, fetches), labels, provenance (WebRunRecord), [W] citations
// resolved against what the run read. web_fetch of an address that came from nowhere the
// user can see (not written by the user, not a search result, not a link on a page read in
// this run) asks for approval: a page cannot make a model send data to a URL it builds.
// docs/WEB.md.
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import type { EventBus } from '../../core/events';
import { DEFAULT_WEB_SETTINGS, WEB_LIMITS, WebError, type WebCitation, type WebErrorCode, type WebPage, type WebRunRecord, type WebSearchEngineInfo, type WebSearchOptions, type WebSearchResult, type WebSettings, type WebSource } from '../../domain/web';
import type { StorageAdapter } from '../../persistence/storage';
import { verifyGrounding, citedLabels } from '../knowledge/grounding';
import { extractDocument } from '../knowledge/extract';
import { base64 } from '../skills/package';
import { extractHtml, sniffCharset } from './html';
import { pageBlock, searchBlock, webRules } from './prompt';
import { dedupeResults, domainOf, normalizeUrl, obviouslyBlocked, siteOf, urlsIn } from './url';

const KEY = 'web';

/** what the native host returns for one GET (src-tauri/src/web) */
export interface RawFetched {
  url: string;
  finalUrl: string;
  status: number;
  redirects: string[];
  contentType?: string;
  bytes: number;
  /** base64 */
  body: string;
  lastModified?: string;
  contentLanguage?: string;
  elapsedMs: number;
}

export interface WebTransport {
  readonly available: boolean;
  fetch(url: string, maxBytes?: number): Promise<RawFetched>;
  /** a page's preview picture: PNG, JPEG, WebP, GIF or AVIF only (never SVG), at most 4 MB */
  fetchImage?(url: string): Promise<RawFetched>;
  /** the hidden page reader (desktop); undefined where it does not exist */
  render?(url: string): Promise<{ finalUrl: string; title: string; html: string; elapsedMs: number }>;
  open?(url: string): Promise<void>;
}

const asWebError = (e: unknown): WebError => {
  if (e instanceof WebError) return e;
  const x = e as { code?: string; message?: string; status?: number; contentType?: string; contentLength?: number; finalUrl?: string } | string;
  if (x && typeof x === 'object' && typeof x.code === 'string') return new WebError(x.code as WebErrorCode, x.message ?? x.code, { ...(x.status && { status: x.status }), ...(x.contentType && { contentType: x.contentType }), ...(x.contentLength && { contentLength: x.contentLength }), ...(x.finalUrl && { finalUrl: x.finalUrl }) });
  return new WebError('FETCH_NETWORK', typeof x === 'string' ? x : String(e));
};

/** the desktop app: Rust does the network (src-tauri/src/web) */
export class TauriWebTransport implements WebTransport {
  readonly available = true;
  async fetch(url: string, maxBytes?: number) {
    try {
      return await invoke<RawFetched>('web_fetch', { url, maxBytes: maxBytes ?? null });
    } catch (e) {
      throw asWebError(e);
    }
  }
  async fetchImage(url: string) {
    try {
      return await invoke<RawFetched>('web_fetch_image', { url });
    } catch (e) {
      throw asWebError(e);
    }
  }
  async render(url: string) {
    try {
      return await invoke<{ finalUrl: string; title: string; html: string; elapsedMs: number }>('web_render', { url });
    } catch (e) {
      throw asWebError(e);
    }
  }
  async open(url: string) {
    try {
      await invoke('web_open', { url });
    } catch (e) {
      throw asWebError(e);
    }
  }
}

/** the browser beta: no network of its own (a page cannot read other sites anyway) */
export class UnavailableWebTransport implements WebTransport {
  readonly available = false;
  async fetch(): Promise<RawFetched> {
    throw new WebError('WEB_UNAVAILABLE', 'Reading web pages needs the RealmNest desktop app.');
  }
}

/** a compliant search backend (official API, terms that allow this use). None ships in v1. */
export interface WebSearchEngine extends WebSearchEngineInfo {
  search(query: string, o: Required<Pick<WebSearchOptions, 'count'>> & WebSearchOptions, signal?: AbortSignal): Promise<{ results: Omit<WebSearchResult, 'id' | 'domain' | 'source'>[]; raw: number }>;
}

export interface WebLogEntry {
  at: number;
  kind: 'fetch' | 'render' | 'search' | 'image' | 'blocked' | 'error';
  url?: string;
  finalUrl?: string;
  query?: string;
  engine?: string;
  status?: number;
  contentType?: string;
  bytes?: number;
  chars?: number;
  method?: string;
  cache?: 'hit' | 'miss';
  redirects?: number;
  rawCount?: number;
  results?: number;
  code?: string;
  message?: string;
  ms?: number;
  runId?: string;
}

interface Session {
  runId: string;
  canFetch: boolean;
  /** normalized URLs the model may read without approval */
  seen: Set<string>;
  labels: Map<string, string>;
  texts: Map<string, string>;
  record: WebRunRecord;
  searchFor: Map<string, { query: string; engine: string }>;
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const clip = (t: string, n: number) => (t.length > n ? { text: t.slice(0, n), truncated: true } : { text: t, truncated: false });

function decode(bytes: Uint8Array, contentType: string, html: boolean): string {
  const fromHeader = /charset\s*=\s*"?([\w-]+)/i.exec(contentType)?.[1];
  const sniffed = html ? sniffCharset(new TextDecoder('latin1').decode(bytes.subarray(0, 2048))) : undefined;
  for (const label of [fromHeader, sniffed, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label.toLowerCase()).decode(bytes);
    } catch {
      /* unknown label: next */
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export class WebService {
  private settingsState: WebSettings = { ...DEFAULT_WEB_SETTINGS };
  private engines = new Map<string, WebSearchEngine>();
  private cache = new Map<string, WebPage>();
  private sessions = new Map<string, Session>();
  private logList: WebLogEntry[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;

  constructor(
    private storage: StorageAdapter,
    private bus: EventBus,
    private transport: WebTransport,
    opts: { now?: () => number } = {},
  ) {
    this.now = opts.now ?? Date.now;
  }

  async init() {
    const raw = await this.storage.get<Partial<WebSettings>>(KEY);
    this.settingsState = {
      ...DEFAULT_WEB_SETTINGS,
      ...(typeof raw?.defaultCount === 'number' && { defaultCount: Math.min(WEB_LIMITS.resultsMax, Math.max(1, raw.defaultCount)) }),
      ...(typeof raw?.renderFallback === 'boolean' && { renderFallback: raw.renderFallback }),
      // an engine id from storage counts only if that engine exists in this build
      ...(typeof raw?.searchEngine === 'string' && { searchEngine: raw.searchEngine }),
    };
    this.changed();
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ── settings and engines ─────────────────────────────────
  get available() {
    return this.transport.available;
  }
  get canRender() {
    return !!this.transport.render && this.settingsState.renderFallback;
  }
  settings(): WebSettings {
    return this.settingsState;
  }
  async setSettings(patch: Partial<WebSettings>) {
    this.settingsState = { ...this.settingsState, ...patch };
    if (patch.searchEngine && !this.engines.has(patch.searchEngine)) this.settingsState.searchEngine = null;
    await this.storage.set(KEY, this.settingsState);
    this.changed();
  }
  /** add a compliant engine to the slots (none ships in v1) */
  registerEngine(engine: WebSearchEngine) {
    this.engines.set(engine.id, engine);
    this.changed();
  }
  engineList(): WebSearchEngineInfo[] {
    return [...this.engines.values()].map(({ search: _s, ...info }) => info);
  }
  engine(): WebSearchEngine | undefined {
    const id = this.settingsState.searchEngine;
    return id ? this.engines.get(id) : undefined;
  }
  get searchConfigured() {
    return !!this.engine();
  }

  log(): WebLogEntry[] {
    return this.logList;
  }
  private note(e: Omit<WebLogEntry, 'at'>) {
    this.logList = [{ at: this.now(), ...e }, ...this.logList].slice(0, 120);
    this.changed();
  }
  cacheSize() {
    return this.cache.size;
  }
  clearCache() {
    this.cache.clear();
    this.changed();
  }

  // ── search ───────────────────────────────────────────────
  async search(query: string, options: WebSearchOptions = {}, runId?: string): Promise<{ engine: string; results: WebSearchResult[]; raw: number }> {
    return this.searchWith(this.engine(), query, options, runId);
  }

  /** search with a given engine (a research run's own provider search), with the same normalization, dedupe, filters and log */
  async searchWith(engine: WebSearchEngine | undefined, query: string, options: WebSearchOptions = {}, runId?: string, signal?: AbortSignal): Promise<{ engine: string; results: WebSearchResult[]; raw: number }> {
    const q = query.trim().slice(0, 300);
    if (!engine) {
      this.note({ kind: 'error', query: q, code: 'SEARCH_PROVIDER_NOT_CONFIGURED', ...(runId && { runId }) });
      throw new WebError('SEARCH_PROVIDER_NOT_CONFIGURED', 'No web search engine is configured in this RealmNest. Read a page whose address you have with web_fetch, or ask the user for a link.');
    }
    if (options.freshness && options.freshness !== 'any' && !engine.supports.freshness) throw new WebError('SEARCH_UNSUPPORTED_OPTION', `${engine.name} cannot filter by date.`);
    if (options.language && !engine.supports.language) throw new WebError('SEARCH_UNSUPPORTED_OPTION', `${engine.name} cannot filter by language.`);
    const count = Math.min(WEB_LIMITS.resultsMax, Math.max(1, options.count ?? this.settingsState.defaultCount));
    const started = this.now();
    let r: Awaited<ReturnType<WebSearchEngine['search']>>;
    try {
      // domains: native when supported, else filtered here (honest: the engine searched everything)
      r = await engine.search(q, { ...options, count, ...(!engine.supports.domains && { domains: undefined }), ...(!engine.supports.excludeDomains && { excludeDomains: undefined }) }, signal);
    } catch (e) {
      const err = e instanceof WebError ? e : new WebError('SEARCH_FAILED', e instanceof Error ? e.message : String(e));
      this.note({ kind: 'error', query: q, engine: engine.id, code: err.code, message: err.message, ...(runId && { runId }) });
      throw err;
    }
    const inDomain = (url: string, list?: string[]) => !!list?.length && list.some((d) => domainOf(url) === d.toLowerCase().replace(/^www\./, '') || domainOf(url).endsWith(`.${d.toLowerCase().replace(/^www\./, '')}`));
    const filtered = r.results.filter((x) => (!options.domains?.length || inDomain(x.url, options.domains)) && !inDomain(x.url, options.excludeDomains));
    const results = dedupeResults(filtered.map((x) => ({ ...x, id: '', domain: '', source: engine.id }))).slice(0, count);
    this.note({ kind: 'search', query: q, engine: engine.id, rawCount: r.raw, results: results.length, ms: this.now() - started, ...(runId && { runId }) });
    this.bus.emit('web.searched', { engine: engine.id, results: results.length, ...(runId && { runId }) });
    return { engine: engine.id, results, raw: r.raw };
  }

  // ── fetch ────────────────────────────────────────────────
  /** read one page (cache within its window); throws WebError */
  async fetchPage(rawUrl: string, o: { runId?: string; fresh?: boolean } = {}): Promise<{ page: WebPage; cache: 'hit' | 'miss' }> {
    const url = normalizeUrl(rawUrl);
    const local = obviouslyBlocked(rawUrl);
    if (!url || local) {
      // unparseable: invalid; parseable but not public http(s): blocked (as the Rust guard says)
      const code = URL.canParse(rawUrl.trim()) ? 'FETCH_BLOCKED_URL' : 'FETCH_INVALID_URL';
      this.note({ kind: 'blocked', url: rawUrl.slice(0, 300), code, message: local ?? 'not a web address', ...(o.runId && { runId: o.runId }) });
      throw new WebError(code, local ?? 'Only http and https addresses can be read.');
    }
    const hit = !o.fresh ? this.cache.get(url) : undefined;
    if (hit && this.now() - hit.fetchedAt < WEB_LIMITS.cacheTtlMs) {
      this.note({ kind: 'fetch', url, finalUrl: hit.finalUrl, cache: 'hit', chars: hit.chars, method: hit.method, ...(o.runId && { runId: o.runId }) });
      return { page: hit, cache: 'hit' };
    }
    const started = this.now();
    let raw: RawFetched;
    try {
      raw = await this.transport.fetch(url);
    } catch (e) {
      const err = asWebError(e);
      this.note({ kind: err.code === 'FETCH_BLOCKED_URL' ? 'blocked' : 'error', url, code: err.code, message: err.message, ...(err.detail?.status && { status: err.detail.status }), ...(err.detail?.contentType && { contentType: err.detail.contentType }), ...(o.runId && { runId: o.runId }) });
      throw err;
    }
    const page = await this.extract(raw, url);
    this.note({ kind: page.method === 'rendered' ? 'render' : 'fetch', url, finalUrl: page.finalUrl, status: raw.status, contentType: raw.contentType, bytes: raw.bytes, chars: page.chars, method: page.method, cache: 'miss', redirects: raw.redirects.length, ms: this.now() - started, ...(o.runId && { runId: o.runId }) });
    this.bus.emit('web.fetched', { method: page.method, bytes: raw.bytes, chars: page.chars, cache: 'miss', ...(o.runId && { runId: o.runId }) });
    this.cache.set(url, page);
    if (normalizeUrl(page.finalUrl) && normalizeUrl(page.finalUrl) !== url) this.cache.set(normalizeUrl(page.finalUrl)!, page);
    while (this.cache.size > WEB_LIMITS.cacheEntries) this.cache.delete(this.cache.keys().next().value!);
    return { page, cache: 'miss' };
  }

  /** a cached page (Save to Knowledge, the source panel); undefined when gone */
  cached(url: string): WebPage | undefined {
    const n = normalizeUrl(url);
    return n ? this.cache.get(n) : undefined;
  }

  /** a page's preview picture (research reports): the bytes and their type; the same rules as pages */
  async fetchImage(url: string, runId?: string): Promise<{ mime: string; bytes: Uint8Array }> {
    if (!this.transport.fetchImage) throw new WebError('WEB_UNAVAILABLE', 'Pictures are fetched from the desktop app.');
    const started = this.now();
    try {
      const raw = await this.transport.fetchImage(url);
      this.note({ kind: 'image', url, finalUrl: raw.finalUrl, status: raw.status, contentType: raw.contentType, bytes: raw.bytes, ms: this.now() - started, ...(runId && { runId }) });
      return { mime: (raw.contentType ?? 'image/png').split(';')[0].trim().toLowerCase(), bytes: base64.decode(raw.body) };
    } catch (e) {
      const err = asWebError(e);
      this.note({ kind: err.code === 'FETCH_BLOCKED_URL' ? 'blocked' : 'error', url, code: err.code, message: err.message, ...(runId && { runId }) });
      throw err;
    }
  }

  async open(url: string) {
    if (!this.transport.open) throw new WebError('WEB_UNAVAILABLE', 'Links open from the desktop app.');
    await this.transport.open(url);
  }

  private async extract(raw: RawFetched, url: string): Promise<WebPage> {
    const bytes = base64.decode(raw.body);
    const ct = (raw.contentType ?? '').toLowerCase();
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512)).trimStart();
    const isPdf = ct.includes('pdf') || head.startsWith('%PDF');
    const isJson = !isPdf && (ct.includes('json') || (!ct && /^[[{]/.test(head)));
    const isHtml = !isPdf && !isJson && (ct.includes('html') || (!ct.startsWith('text/plain') && /^<(!doctype html|html|head|body)\b/i.test(head)));
    const base: Omit<WebPage, 'text' | 'truncated' | 'chars' | 'hash' | 'method'> = {
      url,
      finalUrl: raw.finalUrl,
      domain: domainOf(raw.finalUrl),
      contentType: raw.contentType ?? '',
      bytes: raw.bytes,
      fetchedAt: this.now(),
      redirects: raw.redirects,
      links: [],
      warnings: [],
      ...(raw.contentLanguage && { lang: raw.contentLanguage }),
    };
    const finish = async (p: Omit<WebPage, 'chars' | 'hash' | 'truncated'>): Promise<WebPage> => {
      const c = clip(p.text.trim(), WEB_LIMITS.extractChars);
      if (!c.text.trim()) throw new WebError('FETCH_EXTRACTION_FAILED', 'The page has no readable text.');
      return { ...p, text: c.text, truncated: c.truncated, chars: c.text.length, hash: await sha256(c.text) };
    };
    if (isPdf) {
      try {
        // the same reader as Knowledge (no second PDF parser, no OCR)
        const doc = await extractDocument('page.pdf', 'application/pdf', bytes);
        const byPage = new Map<number, string[]>();
        for (const s of doc.segments) byPage.set(s.location.page ?? 0, [...(byPage.get(s.location.page ?? 0) ?? []), s.text]);
        const text = [...byPage.entries()].map(([n, parts]) => `--- page ${n} ---\n${parts.join('\n\n')}`).join('\n\n');
        return await finish({ ...base, method: 'pdf', text, ...(doc.pages && { pages: doc.pages }), title: decodeURIComponent(new URL(raw.finalUrl).pathname.split('/').pop() || '') || undefined, warnings: doc.warnings.slice(0, 5) });
      } catch (e) {
        if (e instanceof WebError) throw e;
        const code = (e as { code?: string }).code;
        throw new WebError('FETCH_EXTRACTION_FAILED', code === 'NO_EXTRACTABLE_TEXT' ? 'The PDF has no selectable text (a scan): RealmNest does not do OCR.' : `The PDF could not be read (${e instanceof Error ? e.message : String(e)}).`);
      }
    }
    if (isJson) {
      const t = decode(bytes, ct, false);
      let text = t;
      try {
        text = JSON.stringify(JSON.parse(t), null, 2);
      } catch {
        /* JSON Lines or invalid: as text */
      }
      return finish({ ...base, method: 'json', text: `\`\`\`json\n${text.slice(0, WEB_LIMITS.extractChars - 20)}\n\`\`\`` });
    }
    if (isHtml) {
      const html = decode(bytes, ct, true);
      const x = extractHtml(html, raw.finalUrl);
      let method: WebPage['method'] = 'http';
      let ex = x;
      let finalUrl = raw.finalUrl;
      const warnings: string[] = [];
      // an app shell: the page builds its content with JavaScript → the hidden reader
      if (x.needsJs && this.canRender) {
        try {
          const r = await this.transport.render!(raw.finalUrl);
          const rx = extractHtml(r.html, r.finalUrl);
          if (rx.text.length > x.text.length) {
            ex = rx;
            method = 'rendered';
            finalUrl = r.finalUrl;
          }
        } catch (e) {
          warnings.push(`the JavaScript reader failed: ${asWebError(e).message}`);
        }
      } else if (x.needsJs) warnings.push('this page builds its content with JavaScript; only its static text was read');
      return finish({
        ...base,
        finalUrl,
        domain: domainOf(finalUrl),
        method,
        text: ex.text,
        links: ex.links.slice(0, 80),
        warnings,
        ...(ex.meta.title && { title: ex.meta.title }),
        ...(ex.meta.siteName && { siteName: ex.meta.siteName }),
        ...(ex.meta.canonical && { canonicalUrl: ex.meta.canonical }),
        ...(ex.meta.lang && { lang: ex.meta.lang }),
        ...(ex.meta.author && { author: ex.meta.author }),
        ...(ex.meta.publishedAt && { publishedAt: ex.meta.publishedAt }),
        ...(ex.meta.updatedAt && { updatedAt: ex.meta.updatedAt }),
        ...(ex.meta.image && { image: ex.meta.image }),
      });
    }
    if (ct.startsWith('text/') || !ct || ct.includes('xml') || ct.includes('javascript')) {
      const text = decode(bytes, ct, false);
      if (/[\u0000-\u0008\u000e-\u001f]/.test(text.slice(0, 4096))) throw new WebError('FETCH_UNSUPPORTED_CONTENT', 'This address is a binary file, not a page.');
      return finish({ ...base, method: 'text', text, ...(ct.includes('markdown') && { warnings: [] }) });
    }
    throw new WebError('FETCH_UNSUPPORTED_CONTENT', `This address is a ${ct || 'file'}, not a readable page.`);
  }

  // ── runs ─────────────────────────────────────────────────
  /**
   * Start a run's Web: the rules, and (when the model cannot call tools) the pages the user
   * linked, read now. `userTexts`: what the user wrote in this conversation / task.
   */
  async beginRun(runId: string, o: { canFetch: boolean; userTexts: string[]; knowledgeMode?: 'open' | 'grounded' | 'strict'; nativeSearch?: boolean }): Promise<{ context: string; tools: boolean }> {
    const seen = new Set(o.userTexts.flatMap(urlsIn));
    const s: Session = { runId, canFetch: o.canFetch, seen, labels: new Map(), texts: new Map(), record: { searches: [], fetches: [], sources: [], citations: [], invalidLabels: [] }, searchFor: new Map() };
    this.sessions.set(runId, s);
    const parts = [webRules({ canFetch: o.canFetch && this.available, searchConfigured: this.searchConfigured, ...(o.knowledgeMode && { knowledgeMode: o.knowledgeMode }), ...(o.nativeSearch && { nativeSearch: true }) })];
    if (!this.available) parts.push('Web reading is unavailable in this build: say so if the user asks for web information.');
    else if (!o.canFetch) {
      // no tools: the URLs the user wrote in THIS message are read for the model
      const latest = urlsIn(o.userTexts[o.userTexts.length - 1] ?? '').slice(0, WEB_LIMITS.prefetch);
      for (const url of latest) {
        try {
          parts.push((await this.read(s, url, 'prefetch')).block);
        } catch (e) {
          parts.push(`[${url} could not be read: ${asWebError(e).message}]`);
        }
      }
    }
    return { context: parts.join('\n\n'), tools: o.canFetch && this.available };
  }

  hasRun(runId: string) {
    return this.sessions.has(runId);
  }

  /** an address the model may read without asking (undefined), or why it should ask */
  approvalHint(runId: string, url: unknown): string | undefined {
    const s = this.sessions.get(runId);
    if (!s || typeof url !== 'string') return undefined;
    const n = normalizeUrl(url);
    if (!n) return undefined;
    if (s.seen.has(n)) return undefined;
    return 'This address did not come from you, a search result or a page read in this conversation. Approve only if you expect it: a page could try to send data through an address.';
  }

  private async read(s: Session, url: string, via: WebSource['via'], toolCallId?: string): Promise<{ block: string; source: WebSource; page: WebPage }> {
    const fetchesSoFar = s.record.fetches.filter((f) => !f.error).length;
    if (fetchesSoFar >= WEB_LIMITS.fetchesPerRun) throw new WebError('WEB_BUDGET_EXCEEDED', `This answer already read ${WEB_LIMITS.fetchesPerRun} pages: answer with what you have.`);
    let res: { page: WebPage; cache: 'hit' | 'miss' };
    try {
      res = await this.fetchPage(url, { runId: s.runId });
    } catch (e) {
      const err = asWebError(e);
      s.record.fetches.push({ url, at: this.now(), error: err.code, via, ...(toolCallId && { toolCallId }) });
      throw err;
    }
    const { page, cache } = res;
    const key = normalizeUrl(page.finalUrl) ?? page.finalUrl;
    let label = s.labels.get(key);
    if (!label) {
      label = `W${s.labels.size + 1}`;
      s.labels.set(key, label);
    }
    // links on a page the run read may be followed without asking, on the same site only: a page
    // cannot send the model to a third-party address (and data with it) without the user's approval
    const site = siteOf(page.finalUrl);
    for (const l of page.links) {
      const n = normalizeUrl(l);
      if (n && site && siteOf(n) === site) s.seen.add(n);
    }
    s.seen.add(key);
    const from = s.searchFor.get(normalizeUrl(url) ?? url);
    const source: WebSource = {
      label,
      url,
      finalUrl: page.finalUrl,
      ...(page.canonicalUrl && { canonicalUrl: page.canonicalUrl }),
      ...(page.title && { title: page.title }),
      domain: page.domain,
      fetchedAt: page.fetchedAt,
      ...(page.publishedAt && { publishedAt: page.publishedAt }),
      ...(page.updatedAt && { updatedAt: page.updatedAt }),
      ...(page.author && { author: page.author }),
      ...(from && { searchQuery: from.query, searchEngine: from.engine }),
      retrievalMethod: page.method,
      cache,
      hash: page.hash,
      via,
      ...(toolCallId && { toolCallId }),
    };
    if (!s.record.sources.some((x) => x.label === label)) s.record.sources.push(source);
    s.texts.set(label, page.text);
    s.record.fetches.push({ url, finalUrl: page.finalUrl, at: this.now(), method: page.method, contentType: page.contentType, bytes: page.bytes, chars: page.chars, hash: page.hash, cache, label, via, ...(toolCallId && { toolCallId }) });
    const c = clip(page.text, WEB_LIMITS.pageChars);
    return { block: pageBlock(source, c.text, c.truncated || page.truncated), source, page };
  }

  /** web_fetch inside a run */
  async toolFetch(runId: string, url: string, toolCallId?: string) {
    const s = this.sessions.get(runId);
    if (!s) throw new WebError('WEB_UNAVAILABLE', 'Web access is not enabled for this conversation or task.');
    this.changed();
    return this.read(s, url, 'web_fetch', toolCallId);
  }

  /** web_search inside a run */
  async toolSearch(runId: string, query: string, options: WebSearchOptions, toolCallId?: string) {
    const s = this.sessions.get(runId);
    if (!s) throw new WebError('WEB_UNAVAILABLE', 'Web access is not enabled for this conversation or task.');
    if (s.record.searches.filter((x) => !x.error).length >= WEB_LIMITS.searchesPerRun) throw new WebError('WEB_BUDGET_EXCEEDED', `This answer already searched ${WEB_LIMITS.searchesPerRun} times: read the best results or answer.`);
    try {
      const r = await this.search(query, options, runId);
      for (const x of r.results) {
        s.seen.add(x.url);
        s.searchFor.set(x.url, { query, engine: r.engine });
      }
      s.record.searches.push({ query: query.slice(0, 300), engine: r.engine, at: this.now(), results: r.results.map((x) => ({ id: x.id, url: x.url, title: x.title })), rawCount: r.raw, ...(toolCallId && { toolCallId }) });
      this.changed();
      return { block: searchBlock(query, r.engine, r.results), results: r.results, engine: r.engine };
    } catch (e) {
      const err = asWebError(e);
      s.record.searches.push({ query: query.slice(0, 300), at: this.now(), results: [], error: err.code, ...(toolCallId && { toolCallId }) });
      throw err;
    }
  }

  /** the run's web record: [W] citations resolved against what it read, checked */
  finishRun(runId: string, answer: string | undefined): WebRunRecord | undefined {
    const s = this.sessions.get(runId);
    if (!s) return undefined;
    this.sessions.delete(runId);
    const r = s.record;
    if (answer !== undefined) {
      const byLabel = new Map(r.sources.map((x) => [x.label, x]));
      const citations: WebCitation[] = [];
      for (const label of citedLabels(answer, 'W')) {
        const src = byLabel.get(label);
        if (!src) {
          r.invalidLabels.push(label);
          continue;
        }
        const text = (s.texts.get(label) ?? '').replace(/^#[^\n]*\n+/, '').replace(/\s+/g, ' ').trim();
        citations.push({ n: citations.length + 1, label, url: src.url, finalUrl: src.finalUrl, ...(src.title && { title: src.title }), domain: src.domain, ...(src.publishedAt && { publishedAt: src.publishedAt }), ...(src.author && { author: src.author }), fetchedAt: src.fetchedAt, excerpt: text.length > 240 ? `${text.slice(0, 239)}…` : text });
      }
      r.citations = citations;
      if (r.sources.length) r.verification = verifyGrounding(answer, new Map([...s.texts.entries()].map(([k, text]) => [k, { text }])), 'grounded', 'W');
    }
    this.bus.emit('web.run.finished', { runId, sources: r.sources.length, citations: r.citations.length, invalid: r.invalidLabels.length });
    return r;
  }

  /** a record for a run where Web was on but did not take part (strict knowledge, no transport…) */
  skipped(reason: string): WebRunRecord {
    return { skipped: reason, searches: [], fetches: [], sources: [], citations: [], invalidLabels: [] };
  }
}

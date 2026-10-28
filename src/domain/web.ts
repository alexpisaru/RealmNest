// ─────────────────────────────────────────────────────────────
// Web: public pages an agent reads (web_fetch) and, when a compliant search
// engine is configured, search results (web_search). RealmNest owns the layer:
// no provider's own browsing, no scraping of public search engines.
//
//   web_search  → discovery only: normalized results, never cited, never fetched silently
//   web_fetch   → one public page (Rust: SSRF-safe GET; WebView2 fallback for JS pages)
//                 → readable text → a WebSource labelled W1… for this run
//   [W2] in the answer → resolved against what THIS run actually read → WebCitation
//
// Web content is untrusted data. Knowledge ([K]), Memory (M) and Web ([W]) keep
// separate provenance. docs/WEB.md.
// ─────────────────────────────────────────────────────────────

export type WebErrorCode =
  | 'SEARCH_PROVIDER_NOT_CONFIGURED'
  | 'SEARCH_RATE_LIMITED'
  | 'SEARCH_FAILED'
  | 'SEARCH_UNSUPPORTED_OPTION'
  | 'FETCH_INVALID_URL'
  | 'FETCH_BLOCKED_URL'
  | 'FETCH_TIMEOUT'
  | 'FETCH_TOO_LARGE'
  | 'FETCH_TOO_MANY_REDIRECTS'
  | 'FETCH_UNSUPPORTED_CONTENT'
  | 'FETCH_ACCESS_DENIED'
  | 'FETCH_NOT_FOUND'
  | 'FETCH_RATE_LIMITED'
  | 'FETCH_HTTP_ERROR'
  | 'FETCH_NETWORK'
  | 'FETCH_EXTRACTION_FAILED'
  | 'RENDER_UNAVAILABLE'
  | 'WEB_BUDGET_EXCEEDED'
  | 'WEB_UNAVAILABLE';

export class WebError extends Error {
  constructor(
    readonly code: WebErrorCode,
    message: string,
    readonly detail?: { status?: number; contentType?: string; contentLength?: number; finalUrl?: string },
  ) {
    super(message);
  }
}

/** "how recent": each engine maps it to its own syntax, or says it cannot */
export type Freshness = 'any' | 'day' | 'week' | 'month' | 'year';

export interface WebSearchOptions {
  count?: number;
  freshness?: Freshness;
  /** only these domains (example.org, github.com) */
  domains?: string[];
  /** never these domains */
  excludeDomains?: string[];
  /** BCP 47, e.g. "it", "en-US" */
  language?: string;
}

/** one search result, the same whatever engine produced it */
export interface WebSearchResult {
  /** R1, R2… within one search */
  id: string;
  title: string;
  url: string;
  /** the URL as the engine gave it (before tracking parameters were removed) */
  originalUrl?: string;
  domain: string;
  snippet?: string;
  publishedAt?: string;
  score?: number;
  source: string;
}

export interface WebSearchEngineInfo {
  id: string;
  name: string;
  /** what it can honour natively; the rest is emulated (domains) or reported unsupported */
  supports: { freshness: boolean; domains: boolean; excludeDomains: boolean; language: boolean };
  /** needs a key in the credential store */
  needsKey: boolean;
  /** an official API whose terms allow this use (scrapers of public search pages are not engines) */
  compliant: true;
}

/** a page as RealmNest read it */
export interface WebPage {
  url: string;
  /** after redirects (and after the page moved itself, when rendered) */
  finalUrl: string;
  /** rel=canonical when the page declares one */
  canonicalUrl?: string;
  title?: string;
  siteName?: string;
  domain: string;
  contentType: string;
  /** readable text (Markdown-like), never raw HTML */
  text: string;
  /** cut to the extraction limit */
  truncated: boolean;
  lang?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  /** http: one GET · rendered: the hidden WebView2 reader · pdf / json / text: by type */
  method: 'http' | 'rendered' | 'pdf' | 'json' | 'text';
  pages?: number;
  bytes: number;
  chars: number;
  /** sha256 of the extracted text */
  hash: string;
  fetchedAt: number;
  redirects: string[];
  /** links found in the main content (for "follow a link") */
  links: string[];
  /** the page's preview picture (og:image), an address: never fetched with the page */
  image?: string;
  warnings: string[];
}

/** a page given to a run, labelled for citation */
export interface WebSource {
  label: string;
  url: string;
  finalUrl: string;
  canonicalUrl?: string;
  title?: string;
  domain: string;
  fetchedAt: number;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  /** the search that led to it, when one did */
  searchQuery?: string;
  searchEngine?: string;
  retrievalMethod: WebPage['method'];
  cache: 'hit' | 'miss';
  hash: string;
  /** which tool or step read it */
  via: 'web_fetch' | 'prefetch';
  toolCallId?: string;
}

export interface WebCitation {
  n: number;
  label: string;
  url: string;
  finalUrl: string;
  title?: string;
  domain: string;
  publishedAt?: string;
  author?: string;
  fetchedAt: number;
  /** a short excerpt kept with the run */
  excerpt: string;
}

/** what a run remembers about the Web (audit) */
export interface WebRunRecord {
  /** off, strict knowledge, no tools… when Web did not take part */
  skipped?: string;
  searches: { query: string; engine?: string; at: number; results: { id: string; url: string; title: string }[]; rawCount?: number; error?: string; toolCallId?: string }[];
  fetches: { url: string; finalUrl?: string; at: number; method?: WebPage['method']; contentType?: string; bytes?: number; chars?: number; hash?: string; cache?: 'hit' | 'miss'; label?: string; error?: string; via: WebSource['via']; toolCallId?: string }[];
  sources: WebSource[];
  citations: WebCitation[];
  /** [W9] written but never read in this run */
  invalidLabels: string[];
  /** the lexical check of web-cited sentences (numbers and codes must be on the cited page) */
  verification?: import('./knowledge').GroundingReport;
}

export interface WebSettings {
  /**
   * the engine web_search uses: 'auto' (the web search of a connected AI connection that has one),
   * 'off' (web_search answers SEARCH_PROVIDER_NOT_CONFIGURED), or a registered engine's id
   */
  searchEngine: string;
  /** results a search returns by default */
  defaultCount: number;
  /** read pages that need JavaScript in the hidden reader (desktop) */
  renderFallback: boolean;
}

/** WebSettings.searchEngine: the first AI connection that can search, in a fixed order (runtime/web/connectionSearch.ts) */
export const AUTO_ENGINE = 'auto';
/** WebSettings.searchEngine: no web search */
export const OFF_ENGINE = 'off';

export const DEFAULT_WEB_SETTINGS: WebSettings = { searchEngine: AUTO_ENGINE, defaultCount: 5, renderFallback: true };

export const WEB_LIMITS = {
  searchesPerRun: 4,
  fetchesPerRun: 6,
  resultsMax: 10,
  /** text of one page given to a model */
  pageChars: 12_000,
  /** text kept per page (cache, save to knowledge) */
  extractChars: 200_000,
  cacheTtlMs: 15 * 60_000,
  cacheEntries: 60,
  /** a quote a model should not exceed (paraphrase preferred) */
  quoteWords: 25,
  /** URLs from the user's message read before the run when the model cannot call tools */
  prefetch: 2,
} as const;

// The chosen AI connection's own web search as a WebSearchEngine (docs/DEEP_RESEARCH_PLAN.md):
// Claude (account) → Claude Code's WebSearch tool; ChatGPT (account) → Codex's live web search;
// Anthropic API → the server web_search tool; OpenRouter → the web plugin. One short provider turn per query; the results are the search's own
// structured results (search.results events), never URLs the model writes. Every result is then read
// (or not) through the Web layer like any other address.

import { WebError } from '../../domain/web';
import type { ProviderService } from '../providers/service';
import type { ProviderEvent, WebHit } from '../providers/types';
import type { WebSearchEngine } from './service';

const TIMEOUT_MS = 120_000;

export interface ProviderSearchOptions {
  providers: ProviderService;
  connectionId: string;
  model?: string;
  /** shown in provenance, e.g. "Claude · web search" */
  name: string;
  timeoutMs?: number;
  /** a prefix for the searches' run ids (usage is counted for whoever asked: a research run) */
  runTag?: string;
}

/** the prompt of one search turn: search once, the answer itself does not matter */
export function searchPrompt(query: string, o: { freshness?: string; domains?: string[]; language?: string }): string {
  const extra = [
    o.freshness && o.freshness !== 'any' ? `Prefer results from the last ${o.freshness}.` : '',
    o.domains?.length ? `Only results from: ${o.domains.join(', ')}.` : '',
    o.language ? `Prefer results in language "${o.language}".` : '',
  ].filter(Boolean);
  return [`Search the web once for: ${query}`, ...extra, 'Then reply with the single word: done.'].join('\n');
}

export function providerSearchEngine(o: ProviderSearchOptions): WebSearchEngine {
  let n = 0;
  return {
    id: `provider:${o.connectionId}`,
    name: o.name,
    needsKey: false,
    compliant: true,
    // the backends take hints in the prompt; domains are also filtered by the web layer
    supports: { freshness: true, domains: false, excludeDomains: false, language: true },
    async search(query, opts, signal) {
      const hits: WebHit[] = [];
      const run = o.providers.run(
        o.connectionId,
        {
          ...(o.runTag && { runId: `${o.runTag}~s${++n}` }),
          ...(o.model && { model: o.model }),
          messages: [{ role: 'user', content: searchPrompt(query, { ...(opts.freshness && { freshness: opts.freshness }), ...(opts.language && { language: opts.language }) }) }],
          webSearch: { maxUses: 1 },
          timeoutMs: o.timeoutMs ?? TIMEOUT_MS,
        },
        (e: ProviderEvent) => {
          if (e.type === 'search.results') for (const h of e.results) if (!hits.some((x) => x.url === h.url)) hits.push(h);
        },
      );
      const stop = () => void run.cancel();
      signal?.addEventListener('abort', stop, { once: true });
      let end: ProviderEvent;
      try {
        end = await run.done;
      } finally {
        signal?.removeEventListener('abort', stop);
      }
      if (end.type === 'run.failed' && !hits.length) {
        const code = end.error.code;
        if (code === 'rate_limited') throw new WebError('SEARCH_RATE_LIMITED', `${o.name}: ${end.error.message}`);
        if (code === 'payment_required') throw new WebError('SEARCH_FAILED', `${o.name} needs credits for web search (${end.error.message}).`);
        throw new WebError('SEARCH_FAILED', `${o.name}: ${end.error.message}`);
      }
      if (end.type === 'run.cancelled') throw new WebError('SEARCH_FAILED', 'The search was stopped.');
      const results = hits.slice(0, Math.max(1, opts.count)).map((h) => ({ title: h.title ?? h.url, url: h.url, ...(h.snippet && { snippet: h.snippet }), ...(h.published && { publishedAt: h.published }) }));
      return { results, raw: hits.length };
    },
  };
}

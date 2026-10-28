// web_search for every provider (docs/WEB.md): its engine is the web search of an AI connection that has
// one (Claude and ChatGPT by account, the Anthropic API, OpenRouter's web plugin), one short provider
// turn per query (providerSearch.ts). So any model that can call tools can search, whichever provider
// runs it, including providers added later. "Auto" tries the usable connections in a fixed order and
// moves on when one fails (a ChatGPT rate limit, a signed-out account); Settings › Web can name one.

import { AUTO_ENGINE, WebError } from '../../domain/web';
import type { ProviderService } from '../providers/service';
import { providerSearchEngine } from './providerSearch';
import type { WebSearchEngine, WebService } from './service';

export interface SearchConnection {
  id: string;
  name: string;
  providerId: string;
  /** connected (or not checked yet) and, when the provider needs one, with a model */
  usable: boolean;
  model?: string;
}

/** quicker and cheaper first: a Claude search turn is short; a ChatGPT one costs ~40,000 tokens of the plan; API ones are paid */
const ORDER = ['claude-code', 'codex', 'anthropic', 'openrouter'];
const rank = (providerId: string) => (ORDER.includes(providerId) ? ORDER.indexOf(providerId) : ORDER.length);

export const connectionEngineId = (connectionId: string) => `provider:${connectionId}`;

export function connectionEngine(providers: ProviderService, c: SearchConnection): WebSearchEngine {
  // ChatGPT searches stall now and then: one with no results after 60 s is stopped and tried once more
  const codex = c.providerId === 'codex';
  return providerSearchEngine({ providers, connectionId: c.id, ...(c.model && { model: c.model }), name: `${c.name} · web search`, ...(codex && { timeoutMs: 60_000, timeoutRetries: 1 }) });
}

export function autoEngine(providers: ProviderService, list: () => SearchConnection[]): WebSearchEngine {
  return {
    id: AUTO_ENGINE,
    name: 'Auto',
    needsKey: false,
    compliant: true,
    supports: { freshness: true, domains: false, excludeDomains: false, language: true },
    async search(query, opts, signal) {
      const usable = list()
        .filter((c) => c.usable)
        .sort((a, b) => rank(a.providerId) - rank(b.providerId));
      if (!usable.length)
        throw new WebError('SEARCH_PROVIDER_NOT_CONFIGURED', 'No AI connection that can search the web is ready in this RealmNest (Claude or ChatGPT by account, the Anthropic API, OpenRouter). Read a page whose address you have with web_fetch, or ask the user for a link.');
      let last: unknown;
      for (const c of usable) {
        if (signal?.aborted) break;
        try {
          return await connectionEngine(providers, c).search(query, opts, signal);
        } catch (e) {
          last = e;
        }
      }
      throw last ?? new WebError('SEARCH_FAILED', 'The search was stopped.');
    },
  };
}

/** the engines in the Web layer follow the connections: auto, plus one per connection that can search */
export function syncSearchEngines(web: WebService, providers: ProviderService, list: () => SearchConnection[]) {
  const known = new Map<string, string>();
  const sync = () => {
    if (!known.has(AUTO_ENGINE)) {
      web.registerEngine(autoEngine(providers, list));
      known.set(AUTO_ENGINE, '');
    }
    const now = new Map(list().map((c) => [connectionEngineId(c.id), c]));
    for (const id of [...known.keys()]) {
      if (id === AUTO_ENGINE || now.has(id)) continue;
      web.unregisterEngine(id);
      known.delete(id);
    }
    for (const [id, c] of now) {
      // (re)registered only when what the engine is built from changed
      const key = `${c.name}|${c.providerId}|${c.model ?? ''}`;
      if (known.get(id) === key) continue;
      web.registerEngine(connectionEngine(providers, c));
      known.set(id, key);
    }
  };
  sync();
  return sync;
}

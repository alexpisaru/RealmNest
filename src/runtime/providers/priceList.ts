// Reference prices for models sold by subscription (ChatGPT and Claude by account): their CLIs give
// no price, so the model menus show the API price of the same model from OpenRouter's public
// catalogue (the native `openrouter_models`: no key, nothing about the user), read at most once a
// day and only when a model menu opens. It is not what the subscription costs: it shows how heavy
// each model is next to the others (docs/PROVIDERS.md "Reference prices").

import type { StorageAdapter } from '../../persistence/storage';
import type { ModelInfo } from './types';

export type Pricing = NonNullable<ModelInfo['pricing']>;

export interface PriceListSource {
  readonly available: boolean;
  models(): Promise<ModelInfo[]>;
}

const KEY = 'price-list';
const MAX_AGE_MS = 24 * 60 * 60_000;

/** the providers whose models get a reference price, and their makers' prefix in OpenRouter's ids */
const MAKER: Record<string, string> = { codex: 'openai', 'claude-code': 'anthropic' };

/** "anthropic/claude-opus-5.5" and "claude-opus-5-5" are the same model: no maker, dots as dashes */
export const priceKey = (id: string) => id.toLowerCase().replace(/^[^/]+\//, '').replace(/[._]/g, '-');

interface Saved {
  at: number;
  /** maker/priceKey → its API price */
  prices: Record<string, Pricing>;
}

export class PriceList {
  private prices = new Map<string, Pricing>();
  private at = 0;
  private loading: Promise<void> | undefined;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private source: PriceListSource,
    private storage: StorageAdapter,
    private now: () => number = Date.now,
  ) {}

  async init() {
    const s = await this.storage.get<Saved>(KEY);
    if (s && typeof s.at === 'number' && s.prices && typeof s.prices === 'object') {
      this.at = s.at;
      this.prices = new Map(Object.entries(s.prices));
      this.changed();
    }
  }

  /** read the catalogue again if the copy is older than a day (a model menu opened) */
  ensure(): Promise<void> {
    if (!this.source.available || this.now() - this.at < MAX_AGE_MS) return Promise.resolve();
    this.loading ??= this.load().finally(() => (this.loading = undefined));
    return this.loading;
  }

  /** the API price of the same model, for a provider sold by subscription (undefined: none known) */
  reference(providerId: string | undefined, modelId: string): Pricing | undefined {
    const maker = providerId && MAKER[providerId];
    return maker ? this.prices.get(`${maker}/${priceKey(modelId)}`) : undefined;
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

  private async load() {
    let models: ModelInfo[];
    try {
      models = await this.source.models();
    } catch {
      // offline or OpenRouter down: try again at the next menu, not before an hour
      this.at = this.now() - MAX_AGE_MS + 60 * 60_000;
      return;
    }
    const makers = new Set(Object.values(MAKER));
    const prices: Record<string, Pricing> = {};
    for (const m of models) {
      const maker = m.id.split('/')[0];
      // variants (":free", ":thinking"…) are not the model itself
      if (!makers.has(maker) || m.id.includes(':') || !m.pricing || (!m.pricing.prompt && !m.pricing.completion)) continue;
      prices[`${maker}/${priceKey(m.id)}`] = { ...(m.pricing.prompt && { prompt: m.pricing.prompt }), ...(m.pricing.completion && { completion: m.pricing.completion }) };
    }
    this.at = this.now();
    this.prices = new Map(Object.entries(prices));
    await this.storage.set(KEY, { at: this.at, prices } satisfies Saved).catch(() => undefined);
    this.changed();
  }
}

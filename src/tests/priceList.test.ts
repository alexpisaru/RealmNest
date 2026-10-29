import { describe, expect, it } from 'vitest';
import { MemoryAdapter } from '../persistence/storage';
import { PriceList, priceKey } from '../runtime/providers/priceList';
import type { ModelInfo } from '../runtime/providers/types';

const CATALOGUE: ModelInfo[] = [
  { id: 'openai/gpt-6.1-sol', pricing: { prompt: '0.00000125', completion: '0.00001' } },
  { id: 'openai/gpt-6.1-sol:free', pricing: { prompt: '0', completion: '0' } },
  { id: 'anthropic/claude-opus-5.5', pricing: { prompt: '0.000005', completion: '0.000025' } },
  { id: 'google/gemini-x', pricing: { prompt: '0.000001', completion: '0.000002' } },
  { id: 'openai/gpt-no-price' },
];

function rig(o: { fail?: boolean; storage?: MemoryAdapter } = {}) {
  let now = 1_000_000_000;
  let calls = 0;
  const source = {
    available: true,
    models: async () => {
      calls++;
      if (o.fail) throw new Error('offline');
      return CATALOGUE;
    },
  };
  const storage = o.storage ?? new MemoryAdapter();
  const prices = new PriceList(source, storage, () => now);
  return { prices, storage, calls: () => calls, advance: (ms: number) => (now += ms) };
}

describe('reference prices', () => {
  it('a ChatGPT or Claude model gets the API price of the same model; variants, other makers and other providers do not', async () => {
    const { prices } = rig();
    await prices.ensure();
    expect(prices.reference('codex', 'gpt-6.1-sol')).toEqual({ prompt: '0.00000125', completion: '0.00001' });
    expect(prices.reference('claude-code', 'claude-opus-5-5')).toEqual({ prompt: '0.000005', completion: '0.000025' });
    expect(prices.reference('codex', 'gpt-no-price')).toBeUndefined();
    expect(prices.reference('codex', 'gemini-x')).toBeUndefined();
    // a provider with its own prices (OpenRouter, the APIs) never gets a reference price
    expect(prices.reference('openrouter', 'gpt-6.1-sol')).toBeUndefined();
    expect(priceKey('anthropic/claude-opus-5.5')).toBe(priceKey('claude-opus-5-5'));
  });

  it('read at most once a day, kept across a restart; offline tries again after an hour', async () => {
    const storage = new MemoryAdapter();
    const a = rig({ storage });
    await a.prices.ensure();
    await a.prices.ensure();
    expect(a.calls()).toBe(1);
    a.advance(25 * 60 * 60_000);
    await a.prices.ensure();
    expect(a.calls()).toBe(2);
    const b = rig({ storage });
    await b.prices.init();
    expect(b.prices.reference('codex', 'gpt-6.1-sol')).toBeDefined();
    const off = rig({ fail: true });
    await off.prices.ensure();
    await off.prices.ensure();
    expect(off.calls()).toBe(1);
    off.advance(61 * 60_000);
    await off.prices.ensure();
    expect(off.calls()).toBe(2);
  });
});

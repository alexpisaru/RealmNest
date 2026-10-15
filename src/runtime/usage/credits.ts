// What an OpenRouter key has spent and may still spend: asked from Rust (the key never leaves it),
// cached for a minute (the usage popup opens often).

import { invoke } from '@tauri-apps/api/core';

export interface KeyCredits {
  usage?: number;
  usageDaily?: number;
  usageWeekly?: number;
  usageMonthly?: number;
  limit?: number;
  limitRemaining?: number;
  limitReset?: string;
  isFreeTier?: boolean;
}

const cache = new Map<string, { at: number; value: Promise<KeyCredits> }>();

export function openRouterCredits(connectionId: string): Promise<KeyCredits> {
  const hit = cache.get(connectionId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = invoke<KeyCredits>('openrouter_credits', { connectionId }).then((k) => Object.fromEntries(Object.entries(k ?? {}).filter(([, v]) => v !== null && v !== undefined)) as KeyCredits);
  value.catch(() => cache.delete(connectionId));
  cache.set(connectionId, { at: Date.now(), value });
  return value;
}

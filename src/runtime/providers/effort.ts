// ─────────────────────────────────────────────────────────────
// Reasoning effort ("Impegno"): how much a model reasons before it answers.
//
//   ModelInfo.reasoning.efforts  the levels a model accepts (the UI offers only these)
//   ProviderTurnRequest.effort   the level asked for this turn
//
// An adapter sends a level only when the model lists it; anything else is dropped and the
// backend uses its own default. No level is ever invented for a model that lists none.
// ─────────────────────────────────────────────────────────────

import type { ModelInfo } from './types';

/** every level RealmNest knows, lowest first (UI labels: a.effort.<level>) */
export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const isEffortLevel = (v: unknown): v is EffortLevel => typeof v === 'string' && (EFFORT_LEVELS as readonly string[]).includes(v);

/** known levels only, in RealmNest's order, no duplicates */
export function knownEfforts(levels: readonly string[] | undefined): EffortLevel[] {
  return EFFORT_LEVELS.filter((l) => levels?.includes(l));
}

/**
 * The levels a model accepts. Without a model id the backend picks the model, so only the
 * levels every listed model accepts count.
 */
export function modelEfforts(models: readonly ModelInfo[], modelId: string | undefined): string[] {
  if (modelId) return models.find((m) => m.id === modelId)?.reasoning?.efforts ?? [];
  if (!models.length) return [];
  return models.map((m) => m.reasoning?.efforts ?? []).reduce((a, b) => a.filter((x) => b.includes(x)));
}

/** the level the backend uses when none is asked for, when the provider states it */
export function defaultEffort(models: readonly ModelInfo[], modelId: string | undefined): string | undefined {
  return modelId ? models.find((m) => m.id === modelId)?.reasoning?.default : undefined;
}

/** `effort` when the model accepts it, else undefined (nothing is sent) */
export function acceptedEffort(models: readonly ModelInfo[], modelId: string | undefined, effort: string | undefined): string | undefined {
  return effort && modelEfforts(models, modelId).includes(effort) ? effort : undefined;
}

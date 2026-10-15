// The models a ChatGPT account can use through Codex (`-m <slug>`). Codex keeps the account's
// list in `<CODEX_HOME>/models_cache.json`; the desktop host reads only that file and only the
// fields of CodexModelEntry (src-tauri/src/commands_codex.rs → `codex_models`). Hidden helper
// models (the review model…) are left out there. Without the desktop host, or before Codex has
// saved its list, the catalogue below is used (the account's list on 2026-10-15).

import { invoke } from '@tauri-apps/api/core';
import type { ModelInfo } from '../types';
import { CODEX_EFFORTS, MODEL } from './args';
import type { CodexModelEntry } from './types';

export interface CodexModelSource {
  readonly available: boolean;
  /** the models of this Codex folder (undefined: the default one) */
  load(configDir: string | undefined): Promise<CodexModelEntry[]>;
}

export class TauriCodexModels implements CodexModelSource {
  readonly available = true;
  load(configDir: string | undefined) {
    return invoke<CodexModelEntry[]>('codex_models', { configDir: configDir || null });
  }
}

/** browser builds and the dev server: no native host to read Codex's folder */
export class UnavailableCodexModels implements CodexModelSource {
  readonly available = false;
  async load(): Promise<CodexModelEntry[]> {
    return [];
  }
}

export function modelInfo(m: CodexModelEntry): ModelInfo {
  const input = m.inputModalities?.length ? m.inputModalities : ['text'];
  // the levels RealmNest may ask for ("ultra" needs Codex's own delegation, which is off)
  const efforts = (m.reasoningLevels ?? []).filter((l) => CODEX_EFFORTS.includes(l));
  const byDefault = m.defaultReasoningLevel && efforts.includes(m.defaultReasoningLevel) ? m.defaultReasoningLevel : undefined;
  return {
    id: m.slug,
    label: m.displayName || m.slug,
    providerLabel: 'openai',
    ...(m.contextWindow && { contextLength: m.contextWindow }),
    inputModalities: input,
    outputModalities: ['text'],
    ...(efforts.length && { reasoning: { efforts, ...(byDefault && { default: byDefault }) } }),
  };
}

/** what the host returned → the model list (valid ids only, Codex's order, no duplicates) */
export function modelsFromCache(entries: readonly CodexModelEntry[]): ModelInfo[] {
  const seen = new Set<string>();
  return [...entries]
    .filter((m) => m && typeof m.slug === 'string' && MODEL.test(m.slug) && !seen.has(m.slug) && seen.add(m.slug))
    .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))
    .map(modelInfo);
}

const fallback = (slug: string, displayName: string, levels: string[], defaultReasoningLevel: string): CodexModelEntry => ({ slug, displayName, reasoningLevels: levels, defaultReasoningLevel, inputModalities: ['text', 'image'] });
const UP_TO_ULTRA = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const UP_TO_MAX = ['low', 'medium', 'high', 'xhigh', 'max'];

export const CODEX_FALLBACK_MODELS: ModelInfo[] = [
  fallback('gpt-6.1-sol', 'GPT-6.1-Sol', UP_TO_ULTRA, 'low'),
  fallback('gpt-6-astra', 'GPT-6-Astra', UP_TO_ULTRA, 'low'),
  fallback('gpt-6-sol', 'GPT-6-Sol', UP_TO_ULTRA, 'medium'),
  fallback('gpt-6-luna', 'GPT-6-Luna', UP_TO_MAX, 'medium'),
  fallback('gpt-5.6-sol', 'GPT-5.6-Sol', UP_TO_ULTRA, 'low'),
  fallback('gpt-5.6-terra', 'GPT-5.6-Terra', UP_TO_ULTRA, 'medium'),
  fallback('gpt-5.6-luna', 'GPT-5.6-Luna', UP_TO_MAX, 'medium'),
].map(modelInfo);

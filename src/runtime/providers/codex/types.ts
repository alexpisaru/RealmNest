// Raw `codex exec --json` events (JSONL), as far as RealmNest reads them (checked against
// Codex CLI 0.162.1). Fields we do not use are left out; unknown types are ignored.

export interface CodexUsage {
  /** includes the cached part */
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

export type CodexItem =
  /** what the model says; several per turn are possible (a preamble, then the answer) */
  | { id: string; type: 'agent_message'; text: string }
  /** a notice from Codex itself (config warnings, fallbacks): not a failure */
  | { id: string; type: 'error'; message: string }
  | { id: string; type: 'reasoning'; text?: string }
  | { id: string; type: string; [k: string]: unknown };

export type CodexEvent =
  | { type: 'thread.started'; thread_id: string }
  | { type: 'turn.started' }
  | { type: 'item.started' | 'item.updated' | 'item.completed'; item: CodexItem }
  | { type: 'turn.completed'; usage?: CodexUsage }
  | { type: 'turn.failed'; error?: { message?: string } }
  /** transient trouble (e.g. "Reconnecting... 2/5"); a turn.failed follows when it is fatal */
  | { type: 'error'; message?: string }
  | { type: string; [k: string]: unknown };

/** one model of `<CODEX_HOME>/models_cache.json`, as the native `codex_models` command returns it */
export interface CodexModelEntry {
  slug: string;
  displayName?: string;
  description?: string;
  defaultReasoningLevel?: string;
  reasoningLevels: string[];
  priority?: number;
  contextWindow?: number;
  inputModalities: string[];
}

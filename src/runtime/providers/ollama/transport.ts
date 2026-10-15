// ─────────────────────────────────────────────────────────────
// Ollama transport: local models on this PC, through the native host
// (src-tauri/src/openrouter/compat.rs). The host talks only to the fixed
// loopback base http://127.0.0.1:11434 (OpenAI-compatible /v1 for chat and
// embeddings, /api/tags and /api/show for the model list). No key.
// `ensure` starts the Ollama server when it does not answer (fixed program
// locations, `ollama serve` only, no window).
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import type { ChatCompletionsTransport } from '../openrouter/transport';
import { TauriCompatTransport, UnavailableCompatTransport } from '../openai/transport';

/** what `ollama_ensure` found or did (src-tauri compat.rs OllamaEnsure) */
export interface OllamaEnsure {
  /** running (it already answered) · started (RealmNest started it) · not_installed · failed */
  status: 'running' | 'started' | 'not_installed' | 'failed';
  message: string;
  version?: string;
}

export interface OllamaTransport extends ChatCompletionsTransport {
  /** make sure the local server answers, starting it when needed */
  ensure(): Promise<OllamaEnsure>;
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export class TauriOllamaTransport extends TauriCompatTransport implements OllamaTransport {
  constructor(call: Invoke = invoke) {
    super('ollama', call);
  }
  ensure() {
    return this.call<OllamaEnsure>('ollama_ensure');
  }
}

/** Browser builds: the page cannot reach or start a local program. */
export class UnavailableOllamaTransport extends UnavailableCompatTransport implements OllamaTransport {
  constructor() {
    super('Ollama', 'RealmNest reaches and starts the local Ollama from its native side');
  }
  async ensure(): Promise<OllamaEnsure> {
    return { status: 'failed', message: 'Ollama works in the RealmNest desktop app only.' };
  }
}

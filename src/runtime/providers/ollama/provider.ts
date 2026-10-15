// ─────────────────────────────────────────────────────────────
// OllamaProvider: the local Ollama on this PC behind the AIProvider contract.
// Stateless chat completions (the shared ChatCompletionsProvider does the
// work) on Ollama's OpenAI-compatible endpoint. Nothing leaves the computer
// (local), nothing is billed (cost 0). Each status check first makes sure the
// server answers, starting it when it is off (the owner's choice).
// Per-model tools / vision come from Ollama's own /api/show capabilities.
// ─────────────────────────────────────────────────────────────

import { ChatCompletionsProvider } from '../openrouter/provider';
import type { ModelInfo, ProviderCapabilities, ProviderStatus } from '../types';
import type { OllamaEnsure, OllamaTransport } from './transport';

export const OLLAMA_ID = 'ollama';

export const OLLAMA_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  tools: false,
  // image_url parts for models whose /api/show lists "vision"
  vision: true,
  // the compatible endpoint takes no PDF parts
  files: false,
  // /v1/embeddings with an embedding model (e.g. nomic-embed-text)
  embeddings: true,
  // response_format json_schema on the compatible endpoint
  structuredOutput: true,
  // RealmNest tools as functions, for models whose /api/show lists "tools"
  toolCalling: true,
  sessions: false,
  local: true,
  usage: true,
  // free: reported as 0
  cost: true,
  cancellation: true,
  modelListing: true,
  systemPrompt: true,
  webSearch: false,
};

/** the status an `ensure` answer settles by itself (undefined: go on and check) */
export function ensureStatus(e: OllamaEnsure, checkedAt: number): ProviderStatus | undefined {
  switch (e.status) {
    case 'not_installed':
      return { state: 'not_installed', message: e.message, hint: 'Install Ollama from ollama.com, then check the connection again.', checkedAt };
    case 'failed':
      return { state: 'unavailable', message: e.message, hint: 'Start Ollama yourself, or check that it listens on 127.0.0.1:11434.', checkedAt };
    default:
      return undefined;
  }
}

/** the first local model that can chat: used only when a turn names none */
export function firstLocalModel(models: ModelInfo[]): string | undefined {
  return models[0]?.id;
}

export class OllamaProvider extends ChatCompletionsProvider {
  constructor(connectionId: string, transport: OllamaTransport, opts: { turnTimeoutMs?: number } = {}) {
    super(
      connectionId,
      transport,
      {
        id: OLLAMA_ID,
        name: 'Ollama',
        capabilities: OLLAMA_CAPABILITIES,
        auth: 'local (no key)',
        hints: { unavailable: 'Start Ollama, or check that it listens on 127.0.0.1:11434.' },
        prepare: async (checkedAt) => {
          const e = await transport.ensure();
          const status = ensureStatus(e, checkedAt);
          if (status) return { status };
          return { details: { server: e.status === 'started' ? 'started by RealmNest' : 'already running', ...(e.version && { version: e.version }) } };
        },
        defaultModel: firstLocalModel,
        costWhenSilent: 0,
      },
      opts,
    );
  }
}

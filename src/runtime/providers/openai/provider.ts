// ─────────────────────────────────────────────────────────────
// OpenAiProvider: one OpenAI API connection (an API key) behind the AIProvider
// contract. Stateless chat completions like OpenRouter (the shared
// ChatCompletionsProvider does the work): the history is sent each turn, the
// system prompt is a system message, RealmNest tools travel as functions.
// OpenAI reports tokens (stream_options.include_usage) but no cost.
// ─────────────────────────────────────────────────────────────

import { ChatCompletionsProvider } from '../openrouter/provider';
import type { ModelInfo, ProviderCapabilities } from '../types';
import type { OpenAiTransport } from './transport';

export const OPENAI_API_ID = 'openai-api';

export const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  // no tools of its own here: every tool is RealmNest's (toolCalling)
  tools: false,
  // image_url parts (data URLs) and PDF file parts; whether a model takes them is per model
  vision: true,
  files: true,
  // POST /embeddings (text-embedding-3-small / -large) through the native host
  embeddings: true,
  // response_format json_schema (strict)
  structuredOutput: true,
  toolCalling: true,
  sessions: false,
  local: false,
  usage: true,
  // OpenAI returns token counts, never a price
  cost: false,
  cancellation: true,
  modelListing: true,
  systemPrompt: true,
  // web search on OpenAI needs the Responses API or search-preview models: not offered
  webSearch: false,
};

/** used when a turn names no model, in this order, only if the key's own model list has it */
export const OPENAI_DEFAULT_MODELS = ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'];

export function preferredOpenAiModel(models: ModelInfo[]): string | undefined {
  const ids = new Set(models.map((m) => m.id));
  return OPENAI_DEFAULT_MODELS.find((id) => ids.has(id));
}

export class OpenAiProvider extends ChatCompletionsProvider {
  constructor(connectionId: string, transport: OpenAiTransport, opts: { turnTimeoutMs?: number } = {}) {
    super(
      connectionId,
      transport,
      {
        id: OPENAI_API_ID,
        name: 'OpenAI',
        capabilities: OPENAI_CAPABILITIES,
        hints: {
          missingKey: 'Remove this connection and add it again with your OpenAI API key.',
          invalidKey: 'Check the key at platform.openai.com/api-keys, then add the connection again.',
        },
        defaultModel: preferredOpenAiModel,
      },
      opts,
    );
  }
}

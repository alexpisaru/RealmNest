// ─────────────────────────────────────────────────────────────
// OpenRouter transport: how the adapter reaches the native HTTP host
// (src-tauri/src/openrouter). Every call names a connection id; the API key is
// read in Rust from the credential store and never crosses into the webview.
// Only these four narrow operations exist; there is no generic HTTP access.
// ─────────────────────────────────────────────────────────────

import { Channel, invoke } from '@tauri-apps/api/core';
import type { ModelInfo } from '../types';

export interface OrMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** plain text, or parts when the message carries images / PDFs; null on an assistant message that only calls tools */
  content: string | OrPart[] | null;
  /** assistant: the tools it called (OpenAI-style function calls) */
  tool_calls?: OrToolCall[];
  /** tool: the call this message answers */
  tool_call_id?: string;
}

export interface OrToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** a tool offered to the model (OpenAI-style function) */
export interface OrTool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export type OrPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface OrChatRequest {
  model: string;
  messages: OrMessage[];
  /** RealmNest tools the model may call; omitted when none */
  tools?: OrTool[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** answer as JSON matching this schema (response_format json_schema) */
  responseSchema?: { name: string; schema: Record<string, unknown> };
  /** OpenRouter's web plugin with at most this many results (paid per search) */
  webSearch?: number;
  /** OpenRouter's `reasoning.effort` (a level the model lists; OpenRouter only) */
  effort?: string;
}

/** what the native host streams back (src-tauri/src/openrouter/mod.rs StreamEvent) */
export type OrStreamEvent =
  | { t: 'start'; model?: string }
  | { t: 'delta'; d: string }
  | { t: 'usage'; prompt: number; completion: number; cost?: number }
  /** one complete tool call (sent before `done`) */
  | { t: 'tool'; id: string; name: string; args: string }
  | { t: 'done'; finishReason?: string }
  | { t: 'error'; code: string; message: string; status?: number }
  | { t: 'cancelled' }
  /** results of the backend's own web search (structured) */
  | { t: 'search'; query?: string; results: { url: string; title?: string; snippet?: string; published?: string }[] };

export interface OrValidation {
  /** connected · missing_key · invalid_credentials · unavailable · error */
  status: string;
  message: string;
  freeTier?: boolean;
}

export interface OpenRouterTransport {
  readonly available: boolean;
  validate(connectionId: string): Promise<OrValidation>;
  /** OpenRouter's catalogue is public; other chat-completions backends (OpenAI) need the connection's key */
  models(connectionId?: string): Promise<ModelInfo[]>;
  /** starts the stream; resolves with the native run id (events keep arriving on `onEvent`) */
  chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void): Promise<string>;
  cancel(id: string): Promise<boolean>;
}

/** the same four operations for any OpenAI-style chat-completions backend (OpenRouter, OpenAI, Ollama) */
export type ChatCompletionsTransport = OpenRouterTransport;

export class TauriOpenRouterTransport implements OpenRouterTransport {
  readonly available = true;
  validate(connectionId: string) {
    return invoke<OrValidation>('openrouter_validate', { connectionId });
  }
  models() {
    return invoke<ModelInfo[]>('openrouter_models');
  }
  chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    const ch = new Channel<OrStreamEvent>();
    ch.onmessage = onEvent;
    return invoke<string>('openrouter_chat', { connectionId, request, onEvent: ch });
  }
  cancel(id: string) {
    return invoke<boolean>('openrouter_cancel', { id });
  }
}

/** Browser builds: no native host, so no OpenRouter (keys need the OS credential store). */
export class UnavailableOpenRouterTransport implements OpenRouterTransport {
  readonly available = false;
  async validate(): Promise<OrValidation> {
    return { status: 'unavailable', message: 'OpenRouter connections work in the RealmNest desktop app only (the API key lives in the OS credential store).' };
  }
  async models(): Promise<ModelInfo[]> {
    return [];
  }
  async chat(): Promise<string> {
    throw new Error('OpenRouter is available in the RealmNest desktop app only.');
  }
  async cancel() {
    return false;
  }
}

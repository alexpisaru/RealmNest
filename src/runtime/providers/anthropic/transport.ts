// The Anthropic API transport (src-tauri/src/anthropic): every call names a connection id;
// the API key is read in Rust from the credential store and never enters the webview.
// The stream comes back as the same events as OpenRouter's.

import { Channel, invoke } from '@tauri-apps/api/core';
import type { ModelInfo } from '../types';
import type { OrStreamEvent, OrValidation } from '../openrouter/transport';

export type AnSource = { type: 'base64'; media_type: string; data: string };
export type AnBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: AnSource }
  | { type: 'document'; source: AnSource }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export interface AnMessage {
  role: 'user' | 'assistant';
  content: AnBlock[];
}
export interface AnRequest {
  model: string;
  system?: string;
  messages: AnMessage[];
  tools?: { name: string; description: string; input_schema: unknown }[];
  max_tokens?: number;
  timeout_ms?: number;
  /** Anthropic's server web_search tool, at most this many searches (billed per search) */
  web_search?: number;
}

export interface AnthropicTransport {
  readonly available: boolean;
  validate(connectionId: string): Promise<OrValidation>;
  models(connectionId: string): Promise<ModelInfo[]>;
  chat(connectionId: string, request: AnRequest, onEvent: (e: OrStreamEvent) => void): Promise<string>;
  cancel(id: string): Promise<boolean>;
}

export class TauriAnthropicTransport implements AnthropicTransport {
  readonly available = true;
  validate(connectionId: string) {
    return invoke<OrValidation>('anthropic_validate', { connectionId });
  }
  models(connectionId: string) {
    return invoke<ModelInfo[]>('anthropic_models', { connectionId });
  }
  chat(connectionId: string, request: AnRequest, onEvent: (e: OrStreamEvent) => void) {
    const ch = new Channel<OrStreamEvent>();
    ch.onmessage = onEvent;
    return invoke<string>('anthropic_chat', { connectionId, request, onEvent: ch });
  }
  cancel(id: string) {
    return invoke<boolean>('anthropic_cancel', { id });
  }
}

export class UnavailableAnthropicTransport implements AnthropicTransport {
  readonly available = false;
  async validate(): Promise<OrValidation> {
    return { status: 'unavailable', message: 'The Anthropic API needs the RealmNest desktop app (the key lives in the OS credential store).' };
  }
  async models(): Promise<ModelInfo[]> {
    return [];
  }
  async chat(): Promise<string> {
    throw new Error('The Anthropic API needs the RealmNest desktop app.');
  }
  async cancel() {
    return false;
  }
}

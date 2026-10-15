// ─────────────────────────────────────────────────────────────
// OpenAI API transport: the native host (src-tauri/src/openrouter/compat.rs,
// commands in commands_compat.rs) talks to https://api.openai.com/v1 with the
// connection's key, read in Rust from the credential store. The page names a
// flavor ('openai' | 'ollama') and a connection id, never a URL; there is no
// generic HTTP access. Ollama reuses TauriCompatTransport with its own flavor.
// ─────────────────────────────────────────────────────────────

import { Channel, invoke } from '@tauri-apps/api/core';
import type { ModelInfo } from '../types';
import type { ChatCompletionsTransport, OrChatRequest, OrStreamEvent, OrValidation } from '../openrouter/transport';

/** the backends the compat commands accept (a typed enum on the Rust side) */
export type CompatFlavor = 'openai' | 'ollama';

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/** chat completions through the native compat commands, for one flavor */
export class TauriCompatTransport implements ChatCompletionsTransport {
  readonly available = true;
  constructor(
    readonly flavor: CompatFlavor,
    protected call: Invoke = invoke,
  ) {}
  validate(connectionId: string) {
    return this.call<OrValidation>('compat_validate', { flavor: this.flavor, connectionId });
  }
  models(connectionId = '') {
    return this.call<ModelInfo[]>('compat_models', { flavor: this.flavor, connectionId });
  }
  chat(connectionId: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    const ch = new Channel<OrStreamEvent>();
    ch.onmessage = onEvent;
    return this.call<string>('compat_chat', { flavor: this.flavor, connectionId, request, onEvent: ch });
  }
  cancel(id: string) {
    return this.call<boolean>('compat_cancel', { flavor: this.flavor, id });
  }
}

/** Browser builds: no native host, so none of these backends. */
export class UnavailableCompatTransport implements ChatCompletionsTransport {
  readonly available = false;
  constructor(
    private name: string,
    private why: string,
  ) {}
  async validate(): Promise<OrValidation> {
    return { status: 'unavailable', message: `${this.name} connections work in the RealmNest desktop app only (${this.why}).` };
  }
  async models(): Promise<ModelInfo[]> {
    return [];
  }
  async chat(): Promise<string> {
    throw new Error(`${this.name} is available in the RealmNest desktop app only.`);
  }
  async cancel() {
    return false;
  }
}

export type OpenAiTransport = ChatCompletionsTransport;

export class TauriOpenAiTransport extends TauriCompatTransport {
  constructor(call?: Invoke) {
    super('openai', call);
  }
}

export class UnavailableOpenAiTransport extends UnavailableCompatTransport {
  constructor() {
    super('OpenAI API', 'the API key lives in the OS credential store');
  }
}

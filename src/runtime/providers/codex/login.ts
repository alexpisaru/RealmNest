// Signing a ChatGPT connection in and out from RealmNest (src-tauri/src/programs/codex_login.rs):
// `codex login` starts its own sign-in page on localhost and opens the browser; the user signs
// in there and the CLI finishes by itself (no code to paste back). The CLI keeps the
// credentials in its own folder (CODEX_HOME); RealmNest never sees them.
//
// The events are the Claude sign-in's (a `prompt` never comes), so the same transport shape fits
// both: ClaudeLoginTransport, with `code()` unused.

import { Channel, invoke } from '@tauri-apps/api/core';
import type { ClaudeLoginEvent, ClaudeLoginTransport } from '../claude-code/login';

export type CodexLoginEvent = ClaudeLoginEvent;
export type CodexLoginTransport = ClaudeLoginTransport;

export class TauriCodexLogin implements CodexLoginTransport {
  readonly available = true;
  start(configDir: string | undefined, onEvent: (e: CodexLoginEvent) => void) {
    const ch = new Channel<CodexLoginEvent>();
    ch.onmessage = onEvent;
    return invoke<string>('codex_login_start', { configDir: configDir || null, onEvent: ch });
  }
  /** nothing to paste: the browser hands the sign-in back to the CLI itself */
  async code() {}
  cancel(id: string) {
    return invoke<boolean>('codex_login_cancel', { id });
  }
  logout(configDir: string | undefined) {
    return invoke<void>('codex_logout', { configDir: configDir || null });
  }
}

/** browser builds: sign in from a terminal instead */
export class UnavailableCodexLogin implements CodexLoginTransport {
  readonly available = false;
  async start(): Promise<string> {
    throw new Error('Signing in from RealmNest needs the desktop app: run codex login in a terminal.');
  }
  async code() {}
  async cancel() {
    return false;
  }
  async logout() {
    throw new Error('Signing out from RealmNest needs the desktop app.');
  }
}

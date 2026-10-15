// Signing a Claude connection in and out from RealmNest (src-tauri/src/programs/claude_login.rs):
// Claude Code opens the browser, the user signs in and pastes back the code it shows. The CLI
// keeps the credentials in its own config folder; RealmNest never sees them.

import { Channel, invoke } from '@tauri-apps/api/core';

export type ClaudeLoginEvent = { t: 'url'; url: string } | { t: 'prompt' } | { t: 'end'; ok: boolean; message: string };

export interface ClaudeLoginTransport {
  readonly available: boolean;
  /** starts `claude auth login`; resolves with the sign-in id (events keep arriving) */
  start(configDir: string | undefined, onEvent: (e: ClaudeLoginEvent) => void): Promise<string>;
  code(id: string, code: string): Promise<void>;
  cancel(id: string): Promise<boolean>;
  logout(configDir: string | undefined): Promise<void>;
}

export class TauriClaudeLogin implements ClaudeLoginTransport {
  readonly available = true;
  start(configDir: string | undefined, onEvent: (e: ClaudeLoginEvent) => void) {
    const ch = new Channel<ClaudeLoginEvent>();
    ch.onmessage = onEvent;
    return invoke<string>('claude_login_start', { configDir: configDir || null, onEvent: ch });
  }
  code(id: string, code: string) {
    return invoke<void>('claude_login_code', { id, code });
  }
  cancel(id: string) {
    return invoke<boolean>('claude_login_cancel', { id });
  }
  logout(configDir: string | undefined) {
    return invoke<void>('claude_logout', { configDir: configDir || null });
  }
}

/** browser builds: sign in from a terminal instead */
export class UnavailableClaudeLogin implements ClaudeLoginTransport {
  readonly available = false;
  async start(): Promise<string> {
    throw new Error('Signing in from RealmNest needs the desktop app: run claude auth login in a terminal.');
  }
  async code() {}
  async cancel() {
    return false;
  }
  async logout() {
    throw new Error('Signing out from RealmNest needs the desktop app.');
  }
}

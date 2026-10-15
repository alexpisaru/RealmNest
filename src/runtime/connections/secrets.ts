// ─────────────────────────────────────────────────────────────
// SecretStore: where connection secrets (API keys, refresh tokens) go.
//
// Desktop: the OS credential store through narrow Tauri commands
// (src-tauri/src/secrets.rs). The webview can write, replace, delete and
// check a secret, never read it: provider code that needs the value runs in
// Rust. Browser builds have no secure store, so they refuse secrets instead
// of falling back to localStorage.
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';

export interface SecretStore {
  readonly available: boolean;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
  has(name: string): Promise<boolean>;
}

export class SecretStoreUnavailable extends Error {}

/** secret names: `conn.<connectionId>.<field>` */
export const secretName = (connectionId: string, field: string) => `conn.${connectionId}.${field}`;

export class TauriSecretStore implements SecretStore {
  readonly available = true;
  constructor(private call: <T>(cmd: string, args: Record<string, unknown>) => Promise<T> = (cmd, args) => invoke(cmd, args)) {}
  set(name: string, value: string) {
    return this.call<void>('secret_set', { name, value });
  }
  delete(name: string) {
    return this.call<void>('secret_delete', { name });
  }
  has(name: string) {
    return this.call<boolean>('secret_exists', { name });
  }
}

export class UnavailableSecretStore implements SecretStore {
  readonly available = false;
  constructor(private reason = 'Secure credential storage is only available in the RealmNest desktop app.') {}
  async set(): Promise<void> {
    throw new SecretStoreUnavailable(this.reason);
  }
  async delete(): Promise<void> {}
  async has(): Promise<boolean> {
    return false;
  }
}

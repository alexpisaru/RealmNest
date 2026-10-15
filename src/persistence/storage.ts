// ─────────────────────────────────────────────────────────────
// Persistence — a tiny key/value port with swappable adapters.
//
//   Browser beta : LocalStorageAdapter  (this file)
//   Tests        : MemoryAdapter
//   Tauri (later): SqliteAdapter via @tauri-apps/plugin-sql, or
//                  @tauri-apps/plugin-store — same interface.
//
// Nothing else in the app touches localStorage directly.
// ─────────────────────────────────────────────────────────────

import { storageHealth } from './health';

export interface StorageAdapter {
  readonly kind: string;
  /** undefined when missing or unreadable (see isUnreadable) */
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** the key exists but could not be read: its owner keeps defaults in memory and does not save them over it */
  isUnreadable?(key: string): boolean;
}

export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory';
  private data = new Map<string, string>();
  async get<T>(key: string) {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  async set<T>(key: string, value: T) {
    this.data.set(key, JSON.stringify(value));
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

/** the parts of the Web Storage API the adapter uses (tests pass their own) */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** where an unreadable key's raw text is kept (never read back by the app) */
export const CORRUPT_PREFIX = 'corrupt:';

// set while a backup is being restored: nothing may write the old in-memory state over it before the reload
let frozen = false;
export function freezeWrites() {
  frozen = true;
}
/** tests */
export function unfreezeWrites() {
  frozen = false;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'localStorage';
  constructor(
    private prefix = 'nestra:',
    private store?: KeyValueStore,
  ) {}
  private ls(): KeyValueStore {
    return this.store ?? window.localStorage;
  }
  async get<T>(key: string) {
    let raw: string | null;
    try {
      raw = this.ls().getItem(this.prefix + key);
    } catch {
      storageHealth.unreadable(key, false);
      return undefined;
    }
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // unreadable is not missing: keep the raw text (when it fits) and tell the user (D-3)
      let copied = false;
      try {
        const copy = this.prefix + CORRUPT_PREFIX + key;
        if (this.ls().getItem(copy) !== raw) this.ls().setItem(copy, raw);
        copied = true;
      } catch {
        /* no room for a copy */
      }
      storageHealth.unreadable(key, copied);
      return undefined;
    }
  }
  /** the key exists but could not be read (and was not written since): do not reseed it */
  isUnreadable(key: string) {
    return storageHealth.isUnreadable(key);
  }
  async set<T>(key: string, value: T) {
    if (frozen) return;
    try {
      this.ls().setItem(this.prefix + key, JSON.stringify(value));
      storageHealth.writeOk(key);
    } catch (err) {
      // quota or privacy mode: the app keeps working in memory, and the user is told (D-1)
      storageHealth.writeFailed(key, err, this.ls());
    }
  }
  async remove(key: string) {
    if (frozen) return;
    try {
      this.ls().removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }
}

export function defaultAdapter(): StorageAdapter {
  return typeof window !== 'undefined' && 'localStorage' in window ? new LocalStorageAdapter() : new MemoryAdapter();
}

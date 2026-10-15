// Full backup of RealmNest's saved data (docs/HARDENING.md D-7): every `nestra:*` key of the
// app's local storage, as written, in one JSON file. Secrets are not in it: they live in the
// Windows Credential Manager. Files (attachments, artifacts) stay in the app data folder.
//
// Import is all or nothing: the file is checked first, nothing is written when a check fails,
// and a write that fails half-way puts the previous data back.

import { CORRUPT_PREFIX } from './storage';

export const BACKUP_FORMAT = 'realmnest-backup';
export const BACKUP_VERSION = 1;
const PREFIX = 'nestra:';
/** far above what local storage holds (about 10 MB): anything bigger is not a RealmNest backup */
export const MAX_BACKUP_CHARS = 64 * 1024 * 1024;
const KEY = /^[A-Za-z0-9:._-]+$/;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: string;
  createdAt: number;
  /** key without the `nestra:` prefix → the stored JSON text */
  keys: Record<string, string>;
}

/** the parts of the Web Storage API a backup needs (tests pass their own) */
export interface BackupStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BackupError = 'notJson' | 'notBackup' | 'newer' | 'badKey' | 'badValue' | 'tooLarge' | 'empty';

export class BackupRejected extends Error {
  constructor(readonly code: BackupError) {
    super(`backup rejected: ${code}`);
  }
}

/** every `nestra:` key in the store (with the prefix) */
export function dataKeys(store: BackupStore): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(PREFIX)) out.push(k);
  }
  return out;
}

/** approximate bytes per key (local storage keeps UTF-16: two bytes a character), biggest first */
export function storageUsage(store: BackupStore): { total: number; keys: { key: string; bytes: number }[] } {
  const keys = dataKeys(store)
    .map((k) => ({ key: k.slice(PREFIX.length), bytes: (k.length + (store.getItem(k)?.length ?? 0)) * 2 }))
    .sort((a, b) => b.bytes - a.bytes);
  return { total: keys.reduce((n, k) => n + k.bytes, 0), keys };
}

/** the backup of everything saved now (unreadable copies, `corrupt:*`, are not data and stay out) */
export function createBackup(store: BackupStore, app: string, now = Date.now()): BackupFile {
  const keys: Record<string, string> = {};
  for (const k of dataKeys(store)) {
    const name = k.slice(PREFIX.length);
    const v = store.getItem(k);
    if (v !== null && !name.startsWith(CORRUPT_PREFIX)) keys[name] = v;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app, createdAt: now, keys };
}

export function backupName(now = Date.now()) {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `RealmNest backup ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.json`;
}

/** a backup file's text, checked strictly; throws BackupRejected */
export function parseBackup(text: string): BackupFile {
  if (text.length > MAX_BACKUP_CHARS) throw new BackupRejected('tooLarge');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupRejected('notJson');
  }
  const b = raw as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.format !== BACKUP_FORMAT || typeof b.version !== 'number' || typeof b.app !== 'string' || typeof b.createdAt !== 'number' || !Number.isFinite(b.createdAt)) throw new BackupRejected('notBackup');
  if (b.version > BACKUP_VERSION) throw new BackupRejected('newer');
  if (b.version < 1 || !Number.isInteger(b.version)) throw new BackupRejected('notBackup');
  if (!b.keys || typeof b.keys !== 'object' || Array.isArray(b.keys)) throw new BackupRejected('notBackup');
  const entries = Object.entries(b.keys as Record<string, unknown>);
  if (!entries.length) throw new BackupRejected('empty');
  for (const [k, v] of entries) {
    if (!KEY.test(k) || k.startsWith(CORRUPT_PREFIX)) throw new BackupRejected('badKey');
    if (typeof v !== 'string') throw new BackupRejected('badValue');
    try {
      JSON.parse(v);
    } catch {
      throw new BackupRejected('badValue');
    }
  }
  return { format: BACKUP_FORMAT, version: b.version, app: b.app, createdAt: b.createdAt, keys: { ...(b.keys as Record<string, string>) } };
}

/**
 * Replace the saved data with a checked backup: `nestra:*` keys not in it go (unreadable copies
 * stay), its keys are written. If a write fails (no room), the previous data is put back and the
 * error is thrown. The caller reloads the app afterwards.
 */
export function restoreBackup(store: BackupStore, backup: BackupFile) {
  const before = new Map<string, string>();
  for (const k of dataKeys(store)) {
    if (k.slice(PREFIX.length).startsWith(CORRUPT_PREFIX)) continue;
    const v = store.getItem(k);
    if (v !== null) before.set(k, v);
  }
  const clear = () => {
    for (const k of dataKeys(store)) if (!k.slice(PREFIX.length).startsWith(CORRUPT_PREFIX)) store.removeItem(k);
  };
  try {
    // removing first makes room for the backup's data
    clear();
    for (const [k, v] of Object.entries(backup.keys)) store.setItem(PREFIX + k, v);
  } catch (err) {
    clear();
    for (const [k, v] of before) {
      try {
        store.setItem(k, v);
      } catch {
        /* it fitted before the import: nothing better to do */
      }
    }
    throw err;
  }
}

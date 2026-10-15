// FileStore: the one place RealmNest keeps file bytes (attachments and artifacts).
//
// Domain objects never hold a host path: they hold a storage reference, `sha256:<hex>`, and ask
// the store for bytes. In the desktop app the store is native (src-tauri/src/files): blobs in
// RealmNest's data folder, content-addressed, type sniffed natively. In the browser beta and in tests
// it is in memory. A future remote host or worker can implement the same port.

import { invoke } from '@tauri-apps/api/core';
import { looksLikeText, sha256Hex, sniffMime } from './mime';

export type FileErrorCode = 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'UNSUPPORTED_FILE_TYPE' | 'FILE_NOT_FOUND' | 'FILE_CHANGED' | 'IMPORT_FAILED' | 'CANCELLED';

export class FileError extends Error {
  constructor(
    readonly code: FileErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** the largest managed file (mirrors MAX_FILE_BYTES in Rust) */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export interface Stored {
  storageRef: string;
  sha256: string;
  size: number;
  /** sniffed from the content (undefined: text or unrecognised) */
  mime?: string;
  text: boolean;
}

export interface FileStore {
  /** whether the store keeps files across restarts */
  readonly persistent: boolean;
  put(bytes: Uint8Array): Promise<Stored>;
  get(storageRef: string): Promise<Uint8Array>;
  exists(storageRef: string): Promise<boolean>;
  delete(storageRef: string): Promise<boolean>;
  /** keep a copy of a file a tool wrote in a workspace (path relative to it) */
  importWorkspace(workspace: string, path: string): Promise<{ stored: Stored; path: string }>;
  /** write a managed file into a workspace, for a tool to open it there */
  toWorkspace(storageRef: string, workspace: string, path: string): Promise<{ path: string; bytes: number; created: boolean }>;
  /** export a copy (save dialog); the path written, or null when cancelled */
  exportCopy(storageRef: string, name: string): Promise<string | null>;
  open(storageRef: string, name: string, mime?: string): Promise<void>;
  /** a research report page (RealmNest's own export) in the user's browser; the native side locks
   *  it with a policy that allows no scripts, forms or connections */
  openReport(name: string, html: string): Promise<void>;
  /** the same page as a PDF (printed by the desktop app) where the user chooses; the path, or null when cancelled */
  reportPdf(name: string, html: string): Promise<string | null>;
  reveal(storageRef: string, name: string): Promise<void>;
  /** remove files no record uses (`keep`: every referenced storage ref) */
  collect(keep: string[]): Promise<FileUsage>;
}

export interface FileUsage {
  kept: number;
  keptBytes: number;
  removed: number;
  removedBytes: number;
}

const REF = /^sha256:[0-9a-f]{64}$/;
export const isStorageRef = (s: unknown): s is string => typeof s === 'string' && REF.test(s);

const asFileError = (e: unknown): FileError => {
  if (e instanceof FileError) return e;
  const x = e as { code?: string; message?: string } | string;
  if (typeof x === 'object' && x && typeof x.code === 'string') return new FileError(x.code as FileErrorCode, x.message ?? x.code);
  return new FileError('IMPORT_FAILED', String(e));
};
const call = async <T>(p: Promise<T>): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    throw asFileError(e);
  }
};

/** the desktop app: native, persistent (src-tauri/src/files) */
export class TauriFileStore implements FileStore {
  readonly persistent = true;
  put(bytes: Uint8Array) {
    if (bytes.length > MAX_FILE_BYTES) return Promise.reject(new FileError('FILE_TOO_LARGE', `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`));
    // raw body: no JSON, no base64 on the way in
    return call(invoke<Stored>('files_put', bytes));
  }
  async get(storageRef: string) {
    const buf = await call(invoke<ArrayBuffer>('files_get', { storageRef }));
    return new Uint8Array(buf);
  }
  exists(storageRef: string) {
    return call(invoke<boolean>('files_exists', { storageRef }));
  }
  delete(storageRef: string) {
    return call(invoke<boolean>('files_delete', { storageRef }));
  }
  importWorkspace(workspace: string, path: string) {
    return call(invoke<{ stored: Stored; path: string }>('files_import_workspace', { workspace, path }));
  }
  toWorkspace(storageRef: string, workspace: string, path: string) {
    return call(invoke<{ path: string; bytes: number; created: boolean }>('files_to_workspace', { storageRef, workspace, path }));
  }
  exportCopy(storageRef: string, name: string) {
    return call(invoke<string | null>('files_export', { storageRef, name }));
  }
  open(storageRef: string, name: string, mime?: string) {
    return call(invoke<void>('files_open', { storageRef, name, mime: mime ?? null }));
  }
  openReport(name: string, html: string) {
    return call(invoke<void>('files_open_report', { name, html }));
  }
  reportPdf(name: string, html: string) {
    return call(invoke<string | null>('files_report_pdf', { name, html }));
  }
  reveal(storageRef: string, name: string) {
    return call(invoke<void>('files_reveal', { storageRef, name }));
  }
  /** blobs younger than a day are kept (a file being attached right now) */
  collect(keep: string[]) {
    return call(invoke<FileUsage>('files_collect', { keep }));
  }
}

/** a store's description of some bytes (the same rules as the native one) */
export async function describeBytes(bytes: Uint8Array): Promise<Stored> {
  const sha256 = await sha256Hex(bytes);
  return { storageRef: `sha256:${sha256}`, sha256, size: bytes.length, mime: sniffMime(bytes), text: looksLikeText(bytes) };
}

/**
 * In memory: tests, and the browser beta (files last until the page reloads). Workspaces are a
 * map of path → bytes per workspace, for tests of tools that write files.
 */
export class MemoryFileStore implements FileStore {
  readonly persistent = false;
  readonly blobs = new Map<string, Uint8Array>();
  readonly workspaces = new Map<string, Map<string, Uint8Array>>();
  readonly exported: { storageRef: string; name: string }[] = [];
  async put(bytes: Uint8Array) {
    if (bytes.length > MAX_FILE_BYTES) throw new FileError('FILE_TOO_LARGE', `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
    const d = await describeBytes(bytes);
    this.blobs.set(d.storageRef, bytes.slice());
    return d;
  }
  async get(storageRef: string) {
    if (!isStorageRef(storageRef)) throw new FileError('INVALID_FILE', 'Not a storage reference.');
    const b = this.blobs.get(storageRef);
    if (!b) throw new FileError('FILE_NOT_FOUND', 'The managed file is gone.');
    return b.slice();
  }
  async exists(storageRef: string) {
    return this.blobs.has(storageRef);
  }
  async delete(storageRef: string) {
    return this.blobs.delete(storageRef);
  }
  private ws(workspace: string) {
    let w = this.workspaces.get(workspace);
    if (!w) this.workspaces.set(workspace, (w = new Map()));
    return w;
  }
  async importWorkspace(workspace: string, path: string) {
    if (path.includes('..') || /^([a-z]:|[\\/])/i.test(path)) throw new FileError('INVALID_FILE', `${path}: only paths inside the workspace folder are allowed.`);
    const b = this.ws(workspace).get(path.replace(/\\/g, '/'));
    if (!b) throw new FileError('FILE_NOT_FOUND', `${path} does not exist.`);
    return { stored: await this.put(b), path };
  }
  async toWorkspace(storageRef: string, workspace: string, path: string) {
    if (path.includes('..') || /^([a-z]:|[\\/])/i.test(path)) throw new FileError('INVALID_FILE', `${path}: only paths inside the workspace folder are allowed.`);
    const b = await this.get(storageRef);
    const w = this.ws(workspace);
    const created = !w.has(path);
    w.set(path, b);
    return { path, bytes: b.length, created };
  }
  async exportCopy(storageRef: string, name: string) {
    await this.get(storageRef);
    this.exported.push({ storageRef, name });
    return `exports/${name}`;
  }
  async open(): Promise<void> {
    throw new FileError('UNSUPPORTED_FILE_TYPE', 'Opening files works in the desktop app.');
  }
  async openReport(): Promise<void> {
    throw new FileError('UNSUPPORTED_FILE_TYPE', 'Opening pages in the browser works in the desktop app.');
  }
  async reportPdf(): Promise<string | null> {
    throw new FileError('UNSUPPORTED_FILE_TYPE', 'PDF export works in the desktop app.');
  }
  async reveal(): Promise<void> {
    throw new FileError('UNSUPPORTED_FILE_TYPE', 'Revealing files works in the desktop app.');
  }
  async collect(keep: string[]) {
    const k = new Set(keep);
    const u: FileUsage = { kept: 0, keptBytes: 0, removed: 0, removedBytes: 0 };
    for (const [ref, b] of [...this.blobs]) {
      if (k.has(ref)) (u.kept++, (u.keptBytes += b.length));
      else (this.blobs.delete(ref), u.removed++, (u.removedBytes += b.length));
    }
    return u;
  }
}

// Where installed Skill packages live: a `skills/<id>/` folder in RealmNest's
// own data folder, written only by Rust (src-tauri/src/skills), which checks
// every path, size and type again. The page never names a filesystem path:
// imports come from the system file picker, exports go to Documents\RealmNest Skills.

import { invoke } from '@tauri-apps/api/core';
import { base64, type PackageFile } from './package';

export interface SkillStore {
  readonly available: boolean;
  /** replace the stored package of a Skill */
  write(id: string, files: PackageFile[]): Promise<void>;
  read(id: string): Promise<PackageFile[]>;
  readFile(id: string, path: string): Promise<Uint8Array>;
  remove(id: string): Promise<void>;
  /** save an exported bundle; returns where it went */
  export(filename: string, text: string): Promise<string>;
  /** download a package over HTTPS (size-capped); bytes and the final URL */
  fetch(url: string): Promise<{ bytes: Uint8Array; url: string; contentType?: string }>;
}

interface WireFile {
  path: string;
  data: string;
}

export class TauriSkillStore implements SkillStore {
  readonly available = true;
  async write(id: string, files: PackageFile[]) {
    await invoke('skill_store', { id, files: files.map((f): WireFile => ({ path: f.path, data: base64.encode(f.bytes) })) });
  }
  async read(id: string) {
    const files = await invoke<WireFile[]>('skill_load', { id });
    return files.map((f) => ({ path: f.path, bytes: base64.decode(f.data) }));
  }
  async readFile(id: string, path: string) {
    return base64.decode(await invoke<string>('skill_read_file', { id, path }));
  }
  async remove(id: string) {
    await invoke('skill_remove', { id });
  }
  async export(filename: string, text: string) {
    return invoke<string>('skill_export', { filename, text });
  }
  async fetch(url: string) {
    const r = await invoke<{ data: string; url: string; contentType?: string }>('skill_fetch', { url });
    return { bytes: base64.decode(r.data), url: r.url, ...(r.contentType && { contentType: r.contentType }) };
  }
}

/** in memory (tests, and the browser build where packages cannot be kept) */
export class MemorySkillStore implements SkillStore {
  constructor(readonly available = true) {}
  packages = new Map<string, PackageFile[]>();
  exported = new Map<string, string>();
  remote = new Map<string, Uint8Array>();
  async write(id: string, files: PackageFile[]) {
    if (!this.available) throw new Error('Skill files are kept only in the desktop app.');
    this.packages.set(id, files.map((f) => ({ ...f })));
  }
  async read(id: string) {
    return this.packages.get(id) ?? [];
  }
  async readFile(id: string, path: string) {
    const f = this.packages.get(id)?.find((x) => x.path === path);
    if (!f) throw new Error(`${path} is not in this Skill`);
    return f.bytes;
  }
  async remove(id: string) {
    this.packages.delete(id);
  }
  async export(filename: string, text: string) {
    this.exported.set(filename, text);
    return `Documents/RealmNest Skills/${filename}`;
  }
  async fetch(url: string) {
    if (!url.startsWith('https://')) throw new Error('Only https:// addresses are allowed.');
    const bytes = this.remote.get(url);
    if (!bytes) throw new Error('Not found (404).');
    return { bytes, url };
  }
}

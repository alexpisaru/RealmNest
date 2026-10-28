// Updates (docs/UPDATES.md). Shortly after start (and every 6 hours) RealmNest asks GitHub whether a
// newer version is out; if so it says so and installs only when the user agrees. The native side
// (src-tauri/src/update.rs) verifies the update's signature before running its installer. Saving
// what is pending comes first: the installer closes RealmNest.

import { Channel, invoke } from '@tauri-apps/api/core';
import type { StorageAdapter } from '../../persistence/storage';

export interface UpdateInfo {
  version: string;
  current: string;
  notes?: string | null;
  date?: string | null;
}

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current'; at: number }
  | { kind: 'available'; update: UpdateInfo }
  | { kind: 'downloading'; update: UpdateInfo; downloaded: number; total?: number }
  | { kind: 'installing'; update: UpdateInfo }
  | { kind: 'error'; during: 'check' | 'install'; message: string; update?: UpdateInfo };

export interface UpdateSettings {
  /** check at start and every few hours */
  autoCheck: boolean;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = { autoCheck: true };

export interface UpdateTransport {
  readonly available: boolean;
  check(): Promise<UpdateInfo | null>;
  install(onProgress: (downloaded: number, total?: number) => void): Promise<void>;
}

export class TauriUpdateTransport implements UpdateTransport {
  readonly available = true;
  check() {
    return invoke<UpdateInfo | null>('update_check');
  }
  async install(onProgress: (downloaded: number, total?: number) => void) {
    const channel = new Channel<{ downloaded: number; total?: number | null }>();
    channel.onmessage = (p) => onProgress(p.downloaded, p.total ?? undefined);
    await invoke('update_install', { onProgress: channel });
  }
}

export class UnavailableUpdateTransport implements UpdateTransport {
  readonly available = false;
  async check() {
    return null;
  }
  async install() {}
}

const KEY = 'updates';
const FIRST_CHECK_MS = 15_000;
const EVERY_MS = 6 * 60 * 60_000;

export class UpdateService {
  private stateNow: UpdateState = { kind: 'idle' };
  private settingsNow: UpdateSettings = { ...DEFAULT_UPDATE_SETTINGS };
  /** "Later": the notice for this version stays hidden until the next start */
  private dismissedVersion: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private transport: UpdateTransport,
    private storage: StorageAdapter,
    private opts: {
      /** write what is pending before the installer closes RealmNest */
      flush: () => Promise<unknown>;
      log?: (level: 'info' | 'warn' | 'error', message: string) => void;
      now?: () => number;
      firstCheckMs?: number;
      everyMs?: number;
    },
  ) {}

  async init() {
    const s = await this.storage.get<Partial<UpdateSettings>>(KEY);
    if (typeof s?.autoCheck === 'boolean') this.settingsNow = { autoCheck: s.autoCheck };
    this.schedule(this.opts.firstCheckMs ?? FIRST_CHECK_MS);
    this.changed();
  }

  dispose() {
    clearTimeout(this.timer);
  }

  get available() {
    return this.transport.available;
  }
  state(): UpdateState {
    return this.stateNow;
  }
  settings(): UpdateSettings {
    return this.settingsNow;
  }
  /** the notice in the shell: an update to offer, its download, or an install that failed */
  notice(): UpdateState | undefined {
    const s = this.stateNow;
    if (s.kind === 'available' && s.update.version === this.dismissedVersion) return undefined;
    if (s.kind === 'available' || s.kind === 'downloading' || s.kind === 'installing' || (s.kind === 'error' && s.during === 'install')) return s;
    return undefined;
  }

  async setSettings(patch: Partial<UpdateSettings>) {
    this.settingsNow = { ...this.settingsNow, ...patch };
    await this.storage.set(KEY, this.settingsNow);
    this.schedule(this.opts.firstCheckMs ?? FIRST_CHECK_MS);
    this.changed();
  }

  dismiss() {
    const s = this.stateNow;
    const update = s.kind === 'available' ? s.update : s.kind === 'error' ? s.update : undefined;
    if (!update) return;
    this.dismissedVersion = update.version;
    // a failed install goes back to "available", hidden until the next start or a manual check
    if (s.kind === 'error') this.set({ kind: 'available', update });
    else this.changed();
  }

  /** ask GitHub now; `manual`: the user pressed the button (a hidden notice shows again) */
  async check(manual = false) {
    if (!this.transport.available) return;
    const busy = this.stateNow.kind;
    if (busy === 'checking' || busy === 'downloading' || busy === 'installing') return;
    if (manual) this.dismissedVersion = undefined;
    this.set({ kind: 'checking' });
    try {
      const update = await this.transport.check();
      this.set(update ? { kind: 'available', update } : { kind: 'current', at: this.opts.now?.() ?? Date.now() });
      if (update) this.opts.log?.('info', `version ${update.version} is available (this is ${update.current})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.set({ kind: 'error', during: 'check', message });
      // a failed automatic check stays quiet in the shell (offline, GitHub down): only Settings shows it
      this.opts.log?.('warn', `check failed: ${message}`);
    }
  }

  /** download, verify and install the update that was found; RealmNest closes and starts again */
  async install() {
    const s = this.stateNow;
    const update = s.kind === 'available' ? s.update : s.kind === 'error' ? s.update : undefined;
    if (!update) return;
    this.set({ kind: 'downloading', update, downloaded: 0 });
    try {
      await this.opts.flush();
      await this.transport.install((downloaded, total) => {
        if (total !== undefined && downloaded >= total) this.set({ kind: 'installing', update });
        else this.set({ kind: 'downloading', update, downloaded, ...(total !== undefined && { total }) });
      });
      this.set({ kind: 'installing', update });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.set({ kind: 'error', during: 'install', message, update });
      this.opts.log?.('error', `install of ${update.version} failed: ${message}`);
    }
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private set(s: UpdateState) {
    this.stateNow = s;
    this.changed();
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.transport.available || !this.settingsNow.autoCheck) return;
    this.timer = setTimeout(() => {
      void this.check().finally(() => this.schedule(this.opts.everyMs ?? EVERY_MS));
    }, ms);
  }
}

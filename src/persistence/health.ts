// Storage health: what went wrong with saving and loading in this session, for the
// banner in the app shell and Settings › Data (docs/HARDENING.md D-1, D-2, D-3, D-4).
// The app keeps working in memory whatever happens here; this only makes it visible.

/** a small key outside the `nestra:` data (not in backups): a write failed in that session */
export const WRITE_FAILED_MARKER = 'realmnest:write-failed';

export interface WriteFailure {
  key: string;
  error: string;
  at: number;
}
export interface UnreadableKey {
  key: string;
  /** the raw text was copied to `nestra:corrupt:<key>` */
  copied: boolean;
  at: number;
}
export interface StartupIssue {
  service: string;
  error: string;
  at: number;
}

export interface HealthSnapshot {
  /** keys whose last write failed (a later successful write removes them) */
  writeFailures: WriteFailure[];
  lastError?: string;
  lastErrorAt?: number;
  unreadable: UnreadableKey[];
  startupIssues: StartupIssue[];
  /** the previous session could not save something (its marker was found at startup) */
  previousSessionWriteFailure: boolean;
  /** launched with "Start safely": MCP autostart, Telegram and the scheduler are off */
  safeMode: boolean;
  /** why the startup clean-up of unused files did not run */
  collectSkipped?: string;
  /** grows with every new problem (the banner comes back after a dismiss) */
  revision: number;
}

type Marker = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const message = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 300);

const empty = (): HealthSnapshot => ({ writeFailures: [], unreadable: [], startupIssues: [], previousSessionWriteFailure: false, safeMode: false, revision: 0 });

export class StorageHealth {
  private s: HealthSnapshot = empty();
  /** keys read as unreadable and not written since */
  private stillUnreadable = new Set<string>();
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getSnapshot = () => this.s;

  private update(patch: Partial<HealthSnapshot>, problem = true) {
    this.s = { ...this.s, ...patch, revision: this.s.revision + (problem ? 1 : 0) };
    this.listeners.forEach((l) => l());
  }

  writeFailed(key: string, err: unknown, marker?: Marker) {
    const at = Date.now();
    const error = message(err);
    const isNew = !this.s.writeFailures.some((f) => f.key === key);
    this.update({ writeFailures: [...this.s.writeFailures.filter((f) => f.key !== key), { key, error, at }], lastError: error, lastErrorAt: at }, isNew);
    // remembered for the next launch, best effort: the store may be the full one
    for (const m of [marker, safeSession()]) {
      try {
        m?.setItem(WRITE_FAILED_MARKER, String(at));
      } catch {
        /* nowhere to write it */
      }
    }
  }

  writeOk(key: string) {
    this.stillUnreadable.delete(key);
    if (this.s.writeFailures.some((f) => f.key === key)) this.update({ writeFailures: this.s.writeFailures.filter((f) => f.key !== key) }, false);
  }

  unreadable(key: string, copied: boolean) {
    this.stillUnreadable.add(key);
    this.update({ unreadable: [...this.s.unreadable.filter((u) => u.key !== key), { key, copied, at: Date.now() }] });
  }

  /** read as unreadable at startup and not overwritten since: callers must not reseed it */
  isUnreadable(key: string) {
    return this.stillUnreadable.has(key);
  }

  startupIssue(service: string, err: unknown) {
    this.update({ startupIssues: [...this.s.startupIssues, { service, error: message(err), at: Date.now() }] });
  }

  setSafeMode(on: boolean) {
    this.update({ safeMode: on }, on);
  }

  noteCollectSkipped(reason: string | undefined) {
    this.update({ collectSkipped: reason }, false);
  }

  /** at startup: was a write failure recorded by the previous session? The marker is cleared (one session only). */
  readPreviousSession(stores: (Marker | undefined)[] = [safeLocal(), safeSession()]) {
    let found = false;
    for (const m of stores) {
      try {
        if (!m) continue;
        if (m.getItem(WRITE_FAILED_MARKER) != null) found = true;
        m.removeItem(WRITE_FAILED_MARKER);
      } catch {
        /* unreadable store: nothing to learn */
      }
    }
    this.update({ previousSessionWriteFailure: found }, found);
    return found;
  }

  /** anything the user should know about */
  hasProblems(s = this.s) {
    return s.writeFailures.length > 0 || s.unreadable.length > 0 || s.startupIssues.length > 0 || s.safeMode;
  }

  /** tests */
  reset() {
    this.s = empty();
    this.stillUnreadable.clear();
    this.listeners.forEach((l) => l());
  }
}

function safeLocal(): Marker | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
function safeSession(): Marker | undefined {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined;
  } catch {
    return undefined;
  }
}

export const storageHealth = new StorageHealth();

export interface CollectCheck {
  /** the file store keeps files across restarts */
  persistent: boolean;
  /** every storage ref still in use (undefined: a service could not list its refs) */
  keep: string[] | undefined;
  health: HealthSnapshot;
}

/**
 * The startup clean-up deletes managed files no record uses. It runs only when every record
 * loaded cleanly: after a lost or unreadable store the keep-list is short and real attachments
 * would go (D-4). Returns why it must not run, or undefined when it may.
 */
export function shouldCollect({ persistent, keep, health }: CollectCheck): string | undefined {
  if (!persistent) return 'files are not kept across restarts';
  if (!keep) return 'a service could not list the files it uses';
  if (!keep.length) return 'nothing loaded uses a file';
  if (health.unreadable.length) return `unreadable data: ${health.unreadable.map((u) => u.key).join(', ')}`;
  if (health.startupIssues.length) return `services did not start: ${health.startupIssues.map((i) => i.service).join(', ')}`;
  if (health.previousSessionWriteFailure) return 'the previous session could not save everything';
  if (health.writeFailures.length) return 'this session could not save everything';
  if (health.safeMode) return 'safe start';
  return undefined;
}

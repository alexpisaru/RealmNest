// Coalesced saves for data that changes often (streamed model output):
// `touch()` schedules one write of whatever `get` returns when it fires,
// `flush()` writes now and cancels the scheduled one. Used by the runtimes.

import type { StorageAdapter } from './storage';

// every delayed save registers a "write now", run when the window closes, so a
// change made just before quitting is not lost (docs/HARDENING.md D-8)
const flushers = new Set<() => unknown>();

/** register a "write now" for state saved with a delay; returns the unregister */
export function onFlushAll(fn: () => unknown): () => void {
  flushers.add(fn);
  return () => void flushers.delete(fn);
}

/** write every pending delayed save now */
export async function flushAll(): Promise<void> {
  await Promise.allSettled([...flushers].map(async (f) => f()));
}

export class CoalescedWriter<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => T) | null = null;

  constructor(
    private storage: StorageAdapter,
    private key: string,
    private delayMs = 1_000,
    /** applied to every value before it is written (pruning, caps) */
    private prepare: (value: T) => T = (v) => v,
  ) {
    onFlushAll(() => (this.pending ? this.flush() : undefined));
  }

  touch(get: () => T) {
    this.pending = get;
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  async flush(get?: () => T) {
    const source = get ?? this.pending;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    if (source) await this.storage.set<T>(this.key, this.prepare(source()));
  }
}

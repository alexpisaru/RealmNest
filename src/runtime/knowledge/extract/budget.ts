// Limits shared by the extractors: a streaming inflate that stops as soon as its output passes a
// cap (a zip / flate bomb never gets collected first), and a work budget that yields to the UI,
// honours the job's AbortSignal and stops at a deadline. Extraction runs on the UI thread: these
// keep a hostile file from freezing or exhausting it.

/** the extraction was stopped: cancelled, out of time, or the file needs more work than allowed */
export class ExtractStop extends Error {
  constructor(
    readonly kind: 'aborted' | 'timeout' | 'budget',
    message: string,
  ) {
    super(message);
  }
}

/** one stream's output passed its cap (the stream is skipped, the rest of the file is still read) */
export class InflateLimit extends Error {}

export interface ExtractOptions {
  signal?: AbortSignal;
  /** Date.now() past which extraction stops */
  deadline?: number;
}

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

/** counts work; every so often yields to the event loop and checks the signal and the deadline */
export class WorkBudget {
  private ops = 0;
  private lastYield = clock();
  constructor(
    readonly o: ExtractOptions & { maxOps: number },
  ) {}

  /** throws when cancelled or past the deadline */
  check() {
    if (this.o.signal?.aborted) throw new ExtractStop('aborted', 'Indexing was cancelled.');
    if (this.o.deadline !== undefined && Date.now() > this.o.deadline) throw new ExtractStop('timeout', 'The file took too long to read.');
  }

  /** count `n` units; true when the caller should `await pause()` */
  step(n = 1): boolean {
    this.ops += n;
    if (this.ops > this.o.maxOps) throw new ExtractStop('budget', 'The file is too complex to read safely.');
    return (this.ops & 1023) < n || n >= 1024;
  }

  /** check, and give the UI a turn when this run has held it for a while */
  async pause() {
    this.check();
    if (clock() - this.lastYield > 25) {
      await yieldNow();
      this.lastYield = clock();
      this.check();
    }
  }
}

const SLICE = 16 * 1024;

/**
 * Inflate `data`, stopping as soon as the output passes `cap` bytes (InflateLimit). The input is
 * fed in small slices: a decompressor may emit everything one input chunk expands to at once.
 */
export async function inflateCapped(data: Uint8Array, format: 'deflate' | 'deflate-raw', cap: number, signal?: AbortSignal): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const feeding = (async () => {
    for (let i = 0; i < data.length; i += SLICE) await writer.write(data.subarray(i, i + SLICE));
    await writer.close();
  })();
  // errors surface through the reader; this only keeps the promise from being unhandled
  feeding.catch(() => undefined);
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  try {
    for (;;) {
      if (signal?.aborted) throw new ExtractStop('aborted', 'Indexing was cancelled.');
      const r = await reader.read();
      if (r.done) break;
      total += r.value.length;
      if (total > cap) throw new InflateLimit(`a compressed part is larger than ${Math.round(cap / 1024 / 1024)} MB`);
      chunks.push(r.value);
    }
    done = true;
  } finally {
    if (!done) {
      reader.cancel().catch(() => undefined);
      writer.abort().catch(() => undefined);
    }
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

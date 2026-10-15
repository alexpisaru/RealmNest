// ─────────────────────────────────────────────────────────────
// BridgeProcessRunner: the browser side of the dev-server process host.
// Streams a process's output over one fetch (NDJSON). Aborting the fetch
// closes the connection, and the host kills the process.
// ─────────────────────────────────────────────────────────────

import { BRIDGE_HEADER, BRIDGE_META, BRIDGE_PATH, type BridgeMessage, type BridgeRunRequest } from './protocol';
import { LineBuffer } from './text';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec, ProgramLocation } from './types';

/** the token the dev server put in index.html; absent in production builds */
export function bridgeToken(doc: Pick<Document, 'querySelector'> | undefined = globalThis.document): string | null {
  return doc?.querySelector<HTMLMetaElement>(`meta[name="${BRIDGE_META}"]`)?.content || null;
}

/** grace period on top of the host's own timeout before the page gives up */
const CLIENT_GRACE_MS = 15_000;

export class BridgeProcessRunner implements ProcessRunner {
  constructor(
    private token: string | null,
    private base = BRIDGE_PATH,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  get available() {
    return !!this.token;
  }

  private post(route: string, body: unknown, signal?: AbortSignal) {
    return this.fetchImpl(`${this.base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [BRIDGE_HEADER]: this.token ?? '' },
      body: JSON.stringify(body),
      signal,
    });
  }

  async locate(program: string): Promise<ProgramLocation> {
    if (!this.token) return { found: false };
    try {
      const res = await this.post('/locate', { program });
      return res.ok ? ((await res.json()) as ProgramLocation) : { found: false };
    } catch {
      return { found: false };
    }
  }

  async run(spec: ProcessSpec, cb: ProcessCallbacks = {}): Promise<ProcessEnd> {
    if (!this.token) return { kind: 'spawn_error', code: 'host_unavailable', message: 'No local process host: start RealmNest with `npm run dev`.' };
    if (spec.signal?.aborted) return { kind: 'cancelled' };
    const ac = new AbortController();
    let timedOut = false;
    const onAbort = () => ac.abort();
    spec.signal?.addEventListener('abort', onAbort);
    const guard = spec.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          ac.abort();
        }, spec.timeoutMs + CLIENT_GRACE_MS)
      : undefined;
    const body: BridgeRunRequest = { program: spec.program, args: [...spec.args], stdin: spec.stdin, cwd: spec.cwd, ...(spec.env && { env: { ...spec.env } }), timeoutMs: spec.timeoutMs };
    try {
      const res = await this.post('/run', body, ac.signal);
      if (!res.ok || !res.body) {
        const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
        return { kind: 'spawn_error', code: res.status === 403 || res.status === 400 ? 'denied' : 'host_unavailable', message: msg ?? `process host answered ${res.status}` };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const lines = new LineBuffer();
      let end: ProcessEnd | null = null;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const m = JSON.parse(line) as BridgeMessage;
        if (m.t === 'spawn') cb.onSpawn?.();
        else if (m.t === 'out') cb.onStdout?.(m.d);
        else if (m.t === 'err') cb.onStderr?.(m.d);
        else if (m.t === 'end') end = m.end;
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        lines.push(decoder.decode(value, { stream: true })).forEach(handle);
      }
      lines.push(decoder.decode()).forEach(handle);
      lines.end().forEach(handle);
      return end ?? { kind: 'exit', code: null, signal: 'host connection lost' };
    } catch (err) {
      if (timedOut) return { kind: 'timeout', timeoutMs: spec.timeoutMs ?? 0 };
      if (spec.signal?.aborted) return { kind: 'cancelled' };
      return { kind: 'spawn_error', code: 'host_unavailable', message: `process host unreachable: ${(err as Error).message}` };
    } finally {
      clearTimeout(guard);
      spec.signal?.removeEventListener('abort', onAbort);
    }
  }
}

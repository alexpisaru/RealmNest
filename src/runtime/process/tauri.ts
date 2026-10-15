// ─────────────────────────────────────────────────────────────
// TauriProcessRunner: the desktop app's ProcessRunner. Same contract as the
// dev bridge, but the host is Rust (src-tauri/src/process): `process_run`
// starts an allowlisted program and streams the same messages as the bridge
// (protocol.ts) over a Tauri channel; `process_cancel` stops it by run id.
// Rust re-validates everything it receives.
// ─────────────────────────────────────────────────────────────

import { Channel, invoke } from '@tauri-apps/api/core';
import type { BridgeMessage, BridgeRunRequest } from './protocol';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec, ProgramLocation } from './types';

export interface TauriIpc {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  channel(onMessage: (m: BridgeMessage) => void): unknown;
}

const tauriIpc: TauriIpc = {
  invoke: (cmd, args) => invoke(cmd, args),
  channel: (onMessage) => {
    const ch = new Channel<BridgeMessage>();
    ch.onmessage = onMessage;
    return ch;
  },
};

export class TauriProcessRunner implements ProcessRunner {
  readonly available = true;

  constructor(private ipc: TauriIpc = tauriIpc) {}

  async locate(program: string): Promise<ProgramLocation> {
    try {
      return await this.ipc.invoke<ProgramLocation>('process_locate', { program });
    } catch {
      return { found: false };
    }
  }

  async run(spec: ProcessSpec, cb: ProcessCallbacks = {}): Promise<ProcessEnd> {
    if (spec.signal?.aborted) return { kind: 'cancelled' };
    let settle!: (end: ProcessEnd) => void;
    const ended = new Promise<ProcessEnd>((r) => (settle = r));
    const channel = this.ipc.channel((m) => {
      if (m.t === 'spawn') cb.onSpawn?.();
      else if (m.t === 'out') cb.onStdout?.(m.d);
      else if (m.t === 'err') cb.onStderr?.(m.d);
      else if (m.t === 'end') settle(m.end);
    });
    const request: BridgeRunRequest = { program: spec.program, args: [...spec.args], stdin: spec.stdin, cwd: spec.cwd, ...(spec.env && { env: { ...spec.env } }), timeoutMs: spec.timeoutMs };

    let id: string;
    try {
      id = await this.ipc.invoke<string>('process_run', { request, onEvent: channel });
    } catch (err) {
      return { kind: 'spawn_error', code: 'host_unavailable', message: `desktop process host error: ${String(err)}` };
    }
    // cancellation reaches the native process through its run id
    const cancel = () => void this.ipc.invoke('process_cancel', { id }).catch(() => {});
    spec.signal?.addEventListener('abort', cancel);
    if (spec.signal?.aborted) cancel();
    try {
      return await ended;
    } finally {
      spec.signal?.removeEventListener('abort', cancel);
    }
  }
}

import { describe, expect, it } from 'vitest';
import argCases from '../runtime/providers/claude-code/args.cases.json';
import protocolCases from '../runtime/process/protocol.cases.json';
import { checkClaudeArgs } from '../runtime/providers/claude-code/args';
import type { BridgeMessage } from '../runtime/process/protocol';
import { TauriProcessRunner, type TauriIpc } from '../runtime/process/tauri';
import type { ProcessEnd } from '../runtime/process/types';

// The Rust host is tested with `cargo test` against the same JSON cases.

/** a fake Rust side: answers process_run with an id and plays messages on the channel */
function fakeIpc(play: (send: (m: BridgeMessage) => void, cancelled: () => boolean) => void) {
  const calls: { cmd: string; args?: Record<string, unknown> }[] = [];
  let cancelled = false;
  let onMessage: (m: BridgeMessage) => void = () => {};
  const ipc: TauriIpc = {
    channel: (fn) => ((onMessage = fn), { id: 'channel' }),
    invoke: async <T,>(cmd: string, args?: Record<string, unknown>) => {
      calls.push({ cmd, args });
      if (cmd === 'process_run') {
        setTimeout(() => play(onMessage, () => cancelled), 0);
        return 'p1-abc' as T;
      }
      if (cmd === 'process_cancel') {
        cancelled = true;
        setTimeout(() => onMessage({ t: 'end', end: { kind: 'cancelled' } }), 0);
        return true as T;
      }
      if (cmd === 'process_locate') return { found: true, path: 'C:\claude.exe', source: 'desktop-app' } as T;
      throw new Error(`unexpected ${cmd}`);
    },
  };
  return { ipc, calls };
}

describe('TauriProcessRunner', () => {
  it('streams spawn / out / err and resolves with the end message', async () => {
    const { ipc, calls } = fakeIpc((send) => {
      send({ t: 'spawn' });
      send({ t: 'out', d: '{"a":1}\n' });
      send({ t: 'err', d: 'warn\n' });
      send({ t: 'end', end: { kind: 'exit', code: 0, signal: null } });
    });
    const seen: string[] = [];
    const end = await new TauriProcessRunner(ipc).run(
      { program: 'claude', args: ['--version'], stdin: 'hi', timeoutMs: 20_000 },
      { onSpawn: () => seen.push('spawn'), onStdout: (d) => seen.push(`out:${d}`), onStderr: (d) => seen.push(`err:${d}`) },
    );
    expect(seen).toEqual(['spawn', 'out:{"a":1}\n', 'err:warn\n']);
    expect(end).toEqual({ kind: 'exit', code: 0, signal: null });
    // the request has exactly the shape Rust deserializes
    expect(calls[0]).toEqual({ cmd: 'process_run', args: { request: { program: 'claude', args: ['--version'], stdin: 'hi', cwd: undefined, timeoutMs: 20_000 }, onEvent: { id: 'channel' } } });
  });

  it('turns an abort into process_cancel with the run id', async () => {
    const { ipc, calls } = fakeIpc((send) => send({ t: 'spawn' }));
    const ac = new AbortController();
    const done = new TauriProcessRunner(ipc).run({ program: 'claude', args: [], signal: ac.signal }, { onSpawn: () => ac.abort() });
    expect(await done).toEqual({ kind: 'cancelled' });
    expect(calls.find((c) => c.cmd === 'process_cancel')?.args).toEqual({ id: 'p1-abc' });
  });

  it('does not start anything when already aborted', async () => {
    const { ipc, calls } = fakeIpc(() => {});
    const ac = new AbortController();
    ac.abort();
    expect(await new TauriProcessRunner(ipc).run({ program: 'claude', args: [], signal: ac.signal })).toEqual({ kind: 'cancelled' });
    expect(calls).toHaveLength(0);
  });

  it('reports a failing native host as unavailable instead of throwing', async () => {
    const ipc: TauriIpc = { channel: () => ({}), invoke: () => Promise.reject(new Error('command process_run not allowed')) };
    const end = await new TauriProcessRunner(ipc).run({ program: 'claude', args: [] });
    expect(end).toMatchObject({ kind: 'spawn_error', code: 'host_unavailable' });
    expect(await new TauriProcessRunner(ipc).locate('claude')).toEqual({ found: false });
  });

  it('understands every message shape the Rust host serializes', async () => {
    const messages = protocolCases.messages as BridgeMessage[];
    for (const final of messages.filter((m) => m.t === 'end')) {
      const { ipc } = fakeIpc((send) => [...messages.filter((m) => m.t !== 'end'), final].forEach(send));
      const end: ProcessEnd = await new TauriProcessRunner(ipc).run({ program: 'claude', args: [] });
      expect(end).toEqual(final.t === 'end' && final.end);
    }
  });
});

describe('shared Claude argument cases (also checked by cargo test)', () => {
  it('the TypeScript allowlist agrees with the shared cases', () => {
    for (const args of argCases.allow) expect(checkClaudeArgs(args), JSON.stringify(args)).toBeNull();
    for (const args of argCases.deny) expect(checkClaudeArgs(args), JSON.stringify(args)).not.toBeNull();
  });
});

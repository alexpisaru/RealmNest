import { describe, expect, it } from 'vitest';
import { MemoryAdapter } from '../persistence/storage';
import { UpdateService, type UpdateInfo, type UpdateTransport } from '../runtime/update/service';

const until = async (cond: () => boolean, ms = 1000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

const NEW: UpdateInfo = { version: '0.13.0', current: '0.12.0', notes: '## What is new\n- updates' };

function rig(o: { found?: UpdateInfo | null; failCheck?: string; failInstall?: string; storage?: MemoryAdapter } = {}) {
  const calls: string[] = [];
  const transport: UpdateTransport = {
    available: true,
    check: async () => {
      calls.push('check');
      if (o.failCheck) throw new Error(o.failCheck);
      return o.found === undefined ? NEW : o.found;
    },
    install: async (onProgress) => {
      calls.push('install');
      onProgress(50, 100);
      if (o.failInstall) throw new Error(o.failInstall);
      onProgress(100, 100);
    },
  };
  const storage = o.storage ?? new MemoryAdapter();
  const updates = new UpdateService(transport, storage, { flush: async () => void calls.push('flush'), firstCheckMs: 5, everyMs: 60_000 });
  return { updates, calls, storage };
}

describe('updates', () => {
  it('checks shortly after start and offers the new version; later hides it until a manual check', async () => {
    const { updates, calls } = rig();
    await updates.init();
    await until(() => updates.state().kind === 'available');
    expect(calls).toEqual(['check']);
    expect(updates.notice()).toMatchObject({ kind: 'available', update: { version: '0.13.0' } });
    updates.dismiss();
    expect(updates.notice()).toBeUndefined();
    await updates.check(true);
    expect(updates.notice()?.kind).toBe('available');
    updates.dispose();
  });

  it('install saves what is pending first, then downloads (progress) and installs', async () => {
    const { updates, calls } = rig();
    await updates.check(true);
    const seen: string[] = [];
    updates.subscribe(() => seen.push(updates.state().kind));
    await updates.install();
    expect(calls).toEqual(['check', 'flush', 'install']);
    expect(seen).toContain('downloading');
    expect(updates.state().kind).toBe('installing');
  });

  it('a failed install says so and can be tried again; a failed check stays out of the shell', async () => {
    const failing = rig({ failInstall: 'signature does not match' });
    await failing.updates.check(true);
    await failing.updates.install();
    expect(failing.updates.notice()).toMatchObject({ kind: 'error', during: 'install', message: 'signature does not match' });
    failing.updates.dismiss();
    expect(failing.updates.state().kind).toBe('available');
    expect(failing.updates.notice()).toBeUndefined();
    const offline = rig({ failCheck: 'network unreachable' });
    await offline.updates.check();
    expect(offline.updates.state()).toMatchObject({ kind: 'error', during: 'check' });
    expect(offline.updates.notice()).toBeUndefined();
  });

  it('up to date: nothing to offer; with the automatic check off, nothing is asked', async () => {
    const current = rig({ found: null });
    await current.updates.check(true);
    expect(current.updates.state().kind).toBe('current');
    expect(current.updates.notice()).toBeUndefined();
    const storage = new MemoryAdapter();
    const off = rig({ storage });
    await off.updates.setSettings({ autoCheck: false });
    const again = rig({ storage });
    await again.updates.init();
    await new Promise((r) => setTimeout(r, 30));
    expect(again.calls).toEqual([]);
    expect(again.updates.settings().autoCheck).toBe(false);
    off.updates.dispose();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { Conversation, ConversationRun } from '../domain/conversation';
import type { AgentRun, AgentTask } from '../domain/agent';
import { BACKUP_FORMAT, BackupRejected, createBackup, parseBackup, restoreBackup, storageUsage, type BackupStore } from '../persistence/backup';
import { flushAll } from '../persistence/coalesced';
import { shouldCollect, StorageHealth, storageHealth, WRITE_FAILED_MARKER } from '../persistence/health';
import { cleanSettings, DEFAULT_SETTINGS, RealmNestRepository } from '../persistence/repository';
import { LocalStorageAdapter, MemoryAdapter, unfreezeWrites } from '../persistence/storage';
import { MAX_CONVERSATIONS, ConversationRepository, pruneChat, type ChatSnapshot } from '../runtime/chat/repository';
import { ProviderCatalog } from '../runtime/connections/catalog';
import { ConnectionManager } from '../runtime/connections/manager';
import { UnavailableSecretStore } from '../runtime/connections/secrets';
import { MAX_TASKS, prune, RuntimeRepository, type RuntimeSnapshot } from '../runtime/live/repository';
import { McpClientManager } from '../runtime/mcp/manager';
import { normalizeTools } from '../runtime/mcp/normalize';
import type { McpTransportHost } from '../runtime/mcp/transport';
import type { ProcessRunner } from '../runtime/process/types';
import { registerNativeTools, UnavailableToolHost } from '../runtime/tools/native';
import { ToolRegistry } from '../runtime/tools/registry';
import { claudeCodeDefinition } from '../runtime/providers/claude-code/definition';
import { AppStore } from '../store/appStore';

// Data safety and startup (docs/HARDENING.md D-1…D-9, I-10, I-22): nothing is lost silently,
// nothing broken stops the app from opening.

/** Web Storage in memory, with an optional quota in characters */
class FakeStorage implements BackupStore {
  data = new Map<string, string>();
  constructor(public quota = Infinity) {}
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    const used = [...this.data].reduce((n, [kk, vv]) => n + (kk === k ? 0 : kk.length + vv.length), 0);
    if (used + k.length + v.length > this.quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const noRunner: ProcessRunner = {
  available: false,
  locate: async () => ({ found: false }),
  run: async () => ({ kind: 'spawn_error', code: 'not_found', message: 'none' }),
} as unknown as ProcessRunner;

const connections = (storage: LocalStorageAdapter | MemoryAdapter) => new ConnectionManager(new EventBus(), new ProviderCatalog().register(claudeCodeDefinition), storage, { runner: noRunner, secrets: new UnavailableSecretStore() }, { seedProviderId: claudeCodeDefinition.id });

beforeEach(() => {
  storageHealth.reset();
  unfreezeWrites();
});

describe('storage failures are recorded, never thrown (D-1)', () => {
  it('a full store keeps the app working and reports the key', async () => {
    const ls = new FakeStorage(80);
    const a = new LocalStorageAdapter('nestra:', ls);
    await expect(a.set('conversations', { text: 'x'.repeat(200) })).resolves.toBeUndefined();
    const h = storageHealth.getSnapshot();
    expect(h.writeFailures.map((f) => f.key)).toEqual(['conversations']);
    expect(h.lastError).toMatch(/quota/i);
    expect(storageHealth.hasProblems()).toBe(true);
    // the marker for the next launch fits even when the data does not
    expect(ls.getItem(WRITE_FAILED_MARKER)).not.toBeNull();
    // a later successful write of the same key clears it
    await a.set('conversations', { t: 1 });
    expect(storageHealth.getSnapshot().writeFailures).toEqual([]);
  });

  it('the next launch learns that a write failed, once', () => {
    const ls = new FakeStorage();
    ls.setItem(WRITE_FAILED_MARKER, '1');
    const h = new StorageHealth();
    expect(h.readPreviousSession([ls])).toBe(true);
    expect(h.getSnapshot().previousSessionWriteFailure).toBe(true);
    expect(new StorageHealth().readPreviousSession([ls])).toBe(false);
  });
});

describe('unreadable is not missing (D-3)', () => {
  it('keeps a copy of a broken key and does not overwrite it at startup', async () => {
    const ls = new FakeStorage();
    ls.setItem('nestra:connections', '{"connections": [broken');
    const storage = new LocalStorageAdapter('nestra:', ls);
    const m = connections(storage);
    await m.init();
    expect(ls.getItem('nestra:corrupt:connections')).toBe('{"connections": [broken');
    expect(storageHealth.getSnapshot().unreadable).toEqual([expect.objectContaining({ key: 'connections', copied: true })]);
    expect(storage.isUnreadable('connections')).toBe(true);
    // the seed lives in memory; the original stays as it was
    expect(m.list().length).toBe(1);
    expect(ls.getItem('nestra:connections')).toBe('{"connections": [broken');
    // the user's first change saves over it (the copy stays)
    await m.update(m.list()[0].id, { name: 'Mine' });
    expect(JSON.parse(ls.getItem('nestra:connections')!).connections[0].name).toBe('Mine');
    expect(ls.getItem('nestra:corrupt:connections')).toBe('{"connections": [broken');
  });

  it('a broken save opens empty in memory without saving over it (no demo agents)', async () => {
    const ls = new FakeStorage();
    ls.setItem('nestra:save', 'not json');
    const store = new AppStore(new RealmNestRepository(new LocalStorageAdapter('nestra:', ls)), new EventBus());
    await store.init();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().characters).toEqual([]);
    expect(ls.getItem('nestra:save')).toBe('not json');
    expect(ls.getItem('nestra:corrupt:save')).toBe('not json');
  });

  it('records no copy when there is no room for one', async () => {
    const ls = new FakeStorage(40);
    ls.setItem('nestra:runtime', '{bad json here}');
    await new LocalStorageAdapter('nestra:', ls).get('runtime');
    expect(storageHealth.getSnapshot().unreadable).toEqual([expect.objectContaining({ key: 'runtime', copied: false })]);
  });
});

describe('malformed saved data never stops a start (D-2)', () => {
  it('settings: every field checked', () => {
    const s = cleanSettings({ language: 'fr', runtimeMode: 'turbo', volume: { master: 7, music: 'loud' }, animationSpeed: 99, defaultZoom: -3, debug: 'yes', displayName: 42, theme: 12 });
    expect(s.language).toBe('it');
    expect(s.runtimeMode).toBe('mock');
    expect(s.volume).toEqual({ ...DEFAULT_SETTINGS.volume, master: 1 });
    expect(s.animationSpeed).toBe(2);
    expect(s.defaultZoom).toBe(0);
    expect(s.debug).toBe(false);
    expect(s.displayName).toBe('');
    expect(cleanSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('every loader resolves on garbage', async () => {
    const storage = new MemoryAdapter();
    await storage.set('save', { characters: [null, { id: 'x' }, 'y'], settings: [1, 2], currentWorldId: 5 });
    await storage.set('connections', { connections: [null, { id: 1 }, 'x', { id: 'c1', providerId: 'claude-code', name: 'C', method: 'cli', createdAt: 1, updatedAt: 1 }] });
    await storage.set('model-catalogs', 'oops');
    await storage.set('conversations', { conversations: [null, { id: 'c', messages: [null, { id: 'm', status: 'complete' }] }, { id: 'd' }], runs: [null, 'x'] });
    await storage.set('runtime', { agents: [null], tasks: [null, { id: 't', status: 'completed', createdAt: 1 }], runs: [null, { id: 'r', taskId: 't', status: 'completed' }] });
    await storage.set('mcp-tools-cache', { a: { tools: [null, { description: 'no name' }] }, b: 'bad', c: { tools: 'x' } });

    const store = new AppStore(new RealmNestRepository(storage), new EventBus());
    await store.init();
    expect(store.getState().characters.every((c) => typeof c.id === 'string')).toBe(true);
    expect(store.getState().settings.language).toBe('it');

    const m = connections(storage);
    await m.init();
    expect(m.list({ includeRemoved: true }).map((c) => c.id)).toContain('c1');

    const chat = await new ConversationRepository(storage).load();
    expect(chat.conversations.map((c) => c.id)).toEqual(['c', 'd']);
    expect(chat.conversations[0].messages).toEqual([expect.objectContaining({ id: 'm', content: '' })]);
    expect(chat.conversations[1].messages).toEqual([]);
    expect(chat.runs).toEqual([]);
    expect(() => pruneChat(chat)).not.toThrow();

    const rt = await new RuntimeRepository(storage).load();
    expect(rt.tasks.map((t) => t.id)).toEqual(['t']);
    expect(rt.runs[0].output).toBe('');
    expect(() => prune({ ...rt, runs: [...rt.runs, { id: 'q', taskId: 't', status: 'completed' } as AgentRun] })).not.toThrow();

    const mcp = new McpClientManager({ available: false } as McpTransportHost, registerNativeTools(new ToolRegistry(), new UnavailableToolHost()), storage, new UnavailableSecretStore(), new EventBus());
    await expect(mcp.init()).resolves.toBeUndefined();
  });

  it('MCP tools without a name are skipped, not thrown on (I-22)', () => {
    const { defs, skipped } = normalizeTools({ id: 's', key: 'k', name: 'S', toolTimeoutMs: 1000 }, undefined, [null, {}, { name: 5 }, { name: 'ok', inputSchema: { type: 'object', properties: {} }, description: 7 }] as never, new Set());
    expect(defs.map((d) => d.name)).toEqual(['k__ok']);
    expect(skipped.length).toBe(3);
  });
});

describe('MCP exits (I-10)', () => {
  it('a server that exits asking for a secret or a sign-in is auth_required, like a failed connect', async () => {
    const host = { available: true, start: async () => undefined, send: async () => undefined, stop: async () => undefined } as unknown as McpTransportHost;
    const mcp = new McpClientManager(host, registerNativeTools(new ToolRegistry(), new UnavailableToolHost()), new MemoryAdapter(), new UnavailableSecretStore(), new EventBus());
    await mcp.init();
    const c = await mcp.add({ name: 'S', command: 'srv', args: [], env: {}, secretEnv: [] } as never);
    const inner = mcp as unknown as { clients: Map<string, unknown>; setState: (id: string, p: object) => void; onExit: (id: string, client: unknown, message: string, reason: string) => void };
    for (const [reason, status] of [
      ['auth_required', 'auth_required'],
      ['missing_secret', 'auth_required'],
      ['exited', 'failed'],
    ]) {
      const client = { close: async () => undefined };
      inner.clients.set(c.id, client);
      inner.setState(c.id, { status: 'connected' });
      inner.onExit(c.id, client, 'gone', reason);
      expect(mcp.state(c.id).status).toBe(status);
    }
  });
});

describe('startup file clean-up only on clean loads (D-4)', () => {
  const clean = new StorageHealth().getSnapshot();
  it('runs only when everything loaded and saved', () => {
    expect(shouldCollect({ persistent: true, keep: ['sha256:a'], health: clean })).toBeUndefined();
    expect(shouldCollect({ persistent: false, keep: ['sha256:a'], health: clean })).toBeDefined();
    expect(shouldCollect({ persistent: true, keep: [], health: clean })).toBeDefined();
    expect(shouldCollect({ persistent: true, keep: undefined, health: clean })).toMatch(/could not list/);
    expect(shouldCollect({ persistent: true, keep: ['x'], health: { ...clean, unreadable: [{ key: 'conversations', copied: true, at: 0 }] } })).toMatch(/conversations/);
    expect(shouldCollect({ persistent: true, keep: ['x'], health: { ...clean, startupIssues: [{ service: 'research', error: 'x', at: 0 }] } })).toMatch(/research/);
    expect(shouldCollect({ persistent: true, keep: ['x'], health: { ...clean, previousSessionWriteFailure: true } })).toMatch(/previous/);
    expect(shouldCollect({ persistent: true, keep: ['x'], health: { ...clean, writeFailures: [{ key: 'k', error: 'e', at: 0 }] } })).toBeDefined();
  });
});

describe('full backup (D-7)', () => {
  const seeded = () => {
    const ls = new FakeStorage();
    ls.setItem('nestra:save', JSON.stringify({ version: 1, characters: [] }));
    ls.setItem('nestra:conversations', JSON.stringify({ conversations: [{ id: 'c' }] }));
    ls.setItem('nestra:corrupt:runtime', '{broken');
    ls.setItem('realmnest:model-recent', '[]');
    return ls;
  };

  it('round-trips every nestra key (not unreadable copies, not other keys)', () => {
    const ls = seeded();
    const b = createBackup(ls, '0.11.0-beta', 1000);
    expect(b).toMatchObject({ format: BACKUP_FORMAT, version: 1, app: '0.11.0-beta', createdAt: 1000 });
    expect(Object.keys(b.keys).sort()).toEqual(['conversations', 'save']);
    const parsed = parseBackup(JSON.stringify(b));
    const target = new FakeStorage();
    target.setItem('nestra:runtime', '{"old":true}');
    target.setItem('nestra:corrupt:memory', 'raw');
    restoreBackup(target, parsed);
    expect(target.getItem('nestra:save')).toBe(ls.getItem('nestra:save'));
    expect(target.getItem('nestra:conversations')).toBe(ls.getItem('nestra:conversations'));
    // keys not in the backup go; unreadable copies stay
    expect(target.getItem('nestra:runtime')).toBeNull();
    expect(target.getItem('nestra:corrupt:memory')).toBe('raw');
    expect(storageUsage(target).keys[0].key).toBe('conversations');
  });

  it('rejects malformed and foreign files', () => {
    const good = createBackup(seeded(), '1', 1);
    const code = (text: string) => {
      try {
        parseBackup(text);
        return 'accepted';
      } catch (e) {
        return e instanceof BackupRejected ? e.code : 'threw';
      }
    };
    expect(code('not json')).toBe('notJson');
    expect(code(JSON.stringify({ hello: 'world' }))).toBe('notBackup');
    expect(code(JSON.stringify([good]))).toBe('notBackup');
    expect(code(JSON.stringify({ ...good, version: 2 }))).toBe('newer');
    expect(code(JSON.stringify({ ...good, keys: {} }))).toBe('empty');
    expect(code(JSON.stringify({ ...good, keys: { 'bad key!': '{}' } }))).toBe('badKey');
    expect(code(JSON.stringify({ ...good, keys: { 'corrupt:x': '{}' } }))).toBe('badKey');
    expect(code(JSON.stringify({ ...good, keys: { save: 5 } }))).toBe('badValue');
    expect(code(JSON.stringify({ ...good, keys: { save: '{nope' } }))).toBe('badValue');
    expect(code(JSON.stringify(good))).toBe('accepted');
  });

  it('never leaves a half-written import: a failing write puts the old data back', () => {
    const ls = seeded();
    const before = new Map(ls.data);
    ls.quota = [...ls.data].reduce((n, [k, v]) => n + k.length + v.length, 0) + 10;
    const big = parseBackup(JSON.stringify({ ...createBackup(ls, '1', 1), keys: { save: '{}', huge: JSON.stringify('x'.repeat(500)) } }));
    expect(() => restoreBackup(ls, big)).toThrow();
    expect(ls.data).toEqual(before);
  });
});

describe('retention keeps what is in use (D-9)', () => {
  const conv = (id: string, updatedAt: number, pinned = false): Conversation => ({ id, title: id, connectionId: 'c', providerId: 'p', createdAt: 0, updatedAt, messages: [], ...(pinned && { pinned }) });
  it('pinned and replying conversations are never pruned', () => {
    const conversations = Array.from({ length: MAX_CONVERSATIONS + 20 }, (_, i) => conv(`c${i}`, 1000 + i, i < 210));
    conversations.push(conv('old-active', 1));
    const runs = [{ id: 'r', conversationId: 'old-active', status: 'running' } as ConversationRun];
    const out = pruneChat({ version: 1, conversations, runs } as ChatSnapshot);
    const ids = new Set(out.conversations.map((c) => c.id));
    for (let i = 0; i < 210; i++) expect(ids.has(`c${i}`)).toBe(true);
    expect(ids.has('old-active')).toBe(true);
    expect(out.runs.map((r) => r.id)).toEqual(['r']);
  });

  it('queued and running tasks are never pruned', () => {
    const task = (id: string, createdAt: number, status: AgentTask['status'] = 'completed') => ({ id, agentId: 'a', title: id, prompt: '', status, runIds: [], createdAt, updatedAt: createdAt }) as AgentTask;
    const tasks = [task('oldest-running', 0, 'running'), task('oldest-queued', 1, 'queued'), task('old-active-run', 2), ...Array.from({ length: MAX_TASKS + 10 }, (_, i) => task(`t${i}`, 10 + i))];
    const runs = [{ id: 'r', taskId: 'old-active-run', status: 'running', output: '' } as AgentRun];
    const out = prune({ version: 1, agents: [], tasks, runs } as RuntimeSnapshot);
    const ids = out.tasks.map((t) => t.id);
    expect(ids.length).toBe(MAX_TASKS);
    expect(ids).toEqual(expect.arrayContaining(['oldest-running', 'oldest-queued', 'old-active-run', `t${MAX_TASKS + 9}`]));
    expect(ids).not.toContain('t0');
  });
});

describe('the app store (D-6, D-8)', () => {
  it('reset demo deletes every agent it removes', async () => {
    const bus = new EventBus();
    const store = new AppStore(new RealmNestRepository(new MemoryAdapter()), bus);
    await store.init();
    const extra = store.createCharacter({ name: 'Mine', role: 'R', visualPresetId: 'curly', worldId: 'farm' });
    const before = store.getState().characters.map((c) => c.id);
    const deleted: string[] = [];
    bus.on('character.deleted', (p) => void deleted.push(p.id));
    await store.resetDemo();
    expect(deleted.sort()).toEqual([...before].sort());
    expect(deleted).toContain(extra.id);
  });

  it('a pending settings save is written by flushAll', async () => {
    const storage = new MemoryAdapter();
    const store = new AppStore(new RealmNestRepository(storage), new EventBus());
    await store.init();
    store.updateSettings({ night: true });
    await flushAll();
    expect((await new RealmNestRepository(storage).load())?.settings.night).toBe(true);
  });
});

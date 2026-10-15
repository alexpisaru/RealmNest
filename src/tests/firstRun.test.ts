import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { demoCrew } from '../data/seed';
import { RealmNestRepository } from '../persistence/repository';
import { MemoryAdapter } from '../persistence/storage';
import { ProviderCatalog } from '../runtime/connections/catalog';
import { ConnectionManager } from '../runtime/connections/manager';
import { UnavailableSecretStore } from '../runtime/connections/secrets';
import type { ProcessRunner } from '../runtime/process/types';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { CrewService } from '../runtime/crew/service';
import { KnowledgeService } from '../runtime/knowledge/service';
import { MemoryFileStore } from '../runtime/files/store';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { McpClientManager } from '../runtime/mcp/manager';
import type { McpTransportHost } from '../runtime/mcp/transport';
import { MemoryService } from '../runtime/memory/service';
import { claudeCodeDefinition } from '../runtime/providers/claude-code/definition';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import { registerNativeTools, UnavailableToolHost } from '../runtime/tools/native';
import { ToolRegistry } from '../runtime/tools/registry';
import { WorkflowLibrary } from '../runtime/workflow/library';
import { Scheduler } from '../runtime/workflow/scheduler';
import { AppStore } from '../store/appStore';

// 0.11.1: a new installation starts with a clean workspace — no demo agents, no user data — while
// an existing profile opens exactly as saved, whatever it contains (docs/RELEASE_CANDIDATE_0.11.1.md).

const newStore = (storage: MemoryAdapter, bus = new EventBus()) => new AppStore(new RealmNestRepository(storage), bus);
const noRunner = { available: false, locate: async () => ({ found: false }), run: async () => ({ kind: 'spawn_error', code: 'not_found', message: 'none' }) } as unknown as ProcessRunner;
// wired as in main.tsx: connections start before the store, and only a profile saved before connections existed migrates
const newConnections = (storage: MemoryAdapter) =>
  new ConnectionManager(new EventBus(), new ProviderCatalog().register(claudeCodeDefinition), storage, { runner: noRunner, secrets: new UnavailableSecretStore() }, { seedProviderId: claudeCodeDefinition.id, legacyProfile: async () => (await storage.get('save')) !== undefined });

describe('first run: a new profile is a clean workspace', () => {
  it('has zero agents, saves that once, and stays empty after a reload', async () => {
    const storage = new MemoryAdapter();
    const store = newStore(storage);
    await store.init();
    expect(store.getState().characters).toEqual([]);
    // the profile now exists: the next start knows it is not new
    expect((await storage.get<{ characters: unknown[] }>('save'))?.characters).toEqual([]);
    const again = newStore(storage);
    await again.init();
    expect(again.getState().characters).toEqual([]);
  });

  it('the first agent the user creates survives a restart; deleting the last one leaves zero, also after a restart', async () => {
    const storage = new MemoryAdapter();
    const store = newStore(storage);
    await store.init();
    const c = store.createCharacter({ name: 'Prima', role: 'Assistente', visualPresetId: 'curly', worldId: 'farm' });
    await store.persistNow();
    const second = newStore(storage);
    await second.init();
    expect(second.getState().characters.map((x) => x.id)).toEqual([c.id]);
    second.deleteCharacter(c.id);
    await second.persistNow();
    const third = newStore(storage);
    await third.init();
    expect(third.getState().characters).toEqual([]);
  });

  it('a save that exists but is not a save is kept aside, never replaced by a new or demo profile', async () => {
    const storage = new MemoryAdapter();
    await storage.set('save', ['not', 'a', 'save']);
    const store = newStore(storage);
    await store.init();
    expect(store.getState().characters).toEqual([]);
    expect(await storage.get('save')).toEqual(['not', 'a', 'save']);
    expect(await storage.get('corrupt:save')).toEqual(['not', 'a', 'save']);
  });

  it('every user-owned store starts empty: chats, crews, workflows, schedules, memories, Knowledge bases, MCP servers', async () => {
    const storage = new MemoryAdapter();
    const bus = new EventBus();
    const providers = new ProviderService(new ProviderRegistry(), bus);
    const live = new LiveRuntime(bus, providers, new RuntimeRepository(storage, 50), { identity: () => undefined });
    await live.init();
    const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), {});
    await chat.init();
    const crews = new CrewService(storage, bus, live, { name: () => undefined, worldOf: () => undefined, keep: async () => 'art' });
    await crews.init();
    const workflows = new WorkflowLibrary(storage);
    await workflows.init();
    const scheduler = new Scheduler(storage, { definition: () => undefined, createRun: () => ({}) as never });
    await scheduler.init();
    const memory = new MemoryService(storage, bus, {});
    await memory.init();
    const knowledge = new KnowledgeService(storage, new MemoryFileStore(), bus, undefined, {});
    await knowledge.init();
    const mcp = new McpClientManager({ available: false } as McpTransportHost, registerNativeTools(new ToolRegistry(), new UnavailableToolHost()), storage, new UnavailableSecretStore(), bus);
    await mcp.init();
    expect(chat.list()).toEqual([]);
    expect(crews.list()).toEqual([]);
    expect(workflows.all()).toEqual([]);
    expect(scheduler.all()).toEqual([]);
    expect(memory.list()).toEqual([]);
    expect(knowledge.listBases().filter((b) => !b.builtIn)).toEqual([]);
    expect(mcp.list()).toEqual([]);
  });
});

describe('first run: no AI connection is created for the user', () => {
  it('a new profile has zero connections, also on the next starts once the profile exists', async () => {
    const storage = new MemoryAdapter();
    const first = newConnections(storage);
    await first.init();
    await newStore(storage).init();
    expect(first.list()).toEqual([]);
    for (let i = 0; i < 2; i++) {
      const next = newConnections(storage);
      await next.init();
      expect(next.list()).toEqual([]);
    }
  });

  it('a connection the user adds survives a restart, and removing it is not undone', async () => {
    const storage = new MemoryAdapter();
    const first = newConnections(storage);
    await first.init();
    await newStore(storage).init();
    const c = await first.create({ providerId: claudeCodeDefinition.id, method: claudeCodeDefinition.methods[0].id, name: 'Claude' });
    const second = newConnections(storage);
    await second.init();
    expect(second.list().map((x) => x.id)).toEqual([c.id]);
    await second.remove(c.id);
    const third = newConnections(storage);
    await third.init();
    expect(third.list()).toEqual([]);
  });
});

describe('upgrade: an existing profile opens exactly as saved', () => {
  it('keeps every agent, including ones that look like the old demo team (nothing is matched by name or id)', async () => {
    const storage = new MemoryAdapter();
    const theirs = [...demoCrew(1), ...demoCrew(2).slice(0, 1).map((c) => ({ ...c, id: 'mine-1', name: 'Kenji' }))];
    await storage.set('save', { version: 1, characters: theirs, settings: { language: 'it' }, currentWorldId: 'office', seenIntro: true });
    const store = newStore(storage);
    await store.init();
    expect(store.getState().characters.map((c) => c.id)).toEqual(theirs.map((c) => c.id));
    expect(store.getState().currentWorldId).toBe('office');
  });

  it('keeps the connections of a 0.11.0 profile as they are, and adds none to one that has none', async () => {
    const storage = new MemoryAdapter();
    await storage.set('save', { version: 1, characters: [], settings: { language: 'it' }, currentWorldId: 'farm', seenIntro: true });
    await storage.set('connections', { version: 1, seeded: true, connections: [{ id: 'conn-x', providerId: 'claude-code', method: 'cli', name: 'Claude', config: {}, secretNames: [], createdAt: 1, updatedAt: 1, status: 'connected' }] });
    const kept = newConnections(storage);
    await kept.init();
    expect(kept.list().map((c) => c.id)).toEqual(['conn-x']);
    await storage.set('connections', { version: 1, seeded: true, connections: [] });
    const none = newConnections(storage);
    await none.init();
    expect(none.list()).toEqual([]);
  });

  it('a profile saved before connections existed still gets its Claude Code sign-in as a connection (migration)', async () => {
    const storage = new MemoryAdapter();
    await storage.set('save', { version: 1, characters: [], settings: { language: 'it' }, currentWorldId: 'farm', seenIntro: true });
    const legacy = newConnections(storage);
    await legacy.init();
    expect(legacy.list().map((c) => c.providerId)).toEqual(['claude-code']);
  });

  it('a profile whose user deleted every agent stays empty (no demo agents come back)', async () => {
    const storage = new MemoryAdapter();
    await storage.set('save', { version: 1, characters: [], settings: { language: 'en' }, currentWorldId: 'farm', seenIntro: true });
    const store = newStore(storage);
    await store.init();
    expect(store.getState().characters).toEqual([]);
    expect(store.getState().settings.language).toBe('en');
  });
});

describe('production code does not load demo or test data at startup', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : /\.(ts|tsx)$/.test(n) ? [join(dir, n)] : []));
  const production = files(SRC).filter((f) => !/[\\/]src[\\/](tests|dev)[\\/]/.test(f));

  it('no production module imports test files or fixtures', () => {
    const offenders = production.filter((f) => /from ['"][^'"]*(\/tests\/|\/fixtures\/|\.test['"])/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the app creates a connection only for a profile from before connections existed', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    expect(main).toMatch(/new ConnectionManager\([^;]*legacyProfile: async \(\) => \(await defaultAdapter\(\)\.get\('save'\)\) !== undefined/);
  });

  it('the demo team is reachable only on demand: no static import of data/seed outside tests and dev tools', () => {
    const importers = production.filter((f) => /from ['"][^'"]*data\/seed['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([]);
  });
});

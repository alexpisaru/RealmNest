import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { Conversation } from '../domain/conversation';
import { translator } from '../i18n';
import { DEFAULT_SETTINGS, migrate, RealmNestRepository } from '../persistence/repository';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { groupConversations, historyGroup, searchConversations } from '../runtime/chat/history';
import { ConversationRepository, pruneChat, MAX_CONVERSATIONS } from '../runtime/chat/repository';
import { cleanTitle, providerTitler, type Titler } from '../runtime/chat/titles';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';
import { AppStore } from '../store/appStore';
import { outfitsForWorld } from '../data/outfits';
import { WORLD_BY_ID, WORLDS } from '../data/worlds';
import type { AgentTask } from '../domain/agent';
import type { Character } from '../domain/character';
import { overview, placeTags, recentActivity, summarize, TAG_PX, timeAgo } from '../ui/homeData';
import { MAP_ZONES } from '../ui/worldMapZones';
import { contrast, migrateTheme, THEME_BY_ID, THEMES, themeVariables } from '../themes';
import { dayPart, greeting } from '../ui/greeting';
import { initialOf } from '../ui/profile';

// The UI foundation milestone: chat metadata (rename, pin, titles), history
// groups, themes, the greeting, and moving agents between worlds.

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: false, usage: false, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

/** answers every turn; a turn whose system prompt asks for a title answers with `title` */
class EchoProvider implements AIProvider {
  readonly id = 'echo';
  readonly name = 'Echo';
  readonly capabilities = CAPS;
  requests: ProviderTurnRequest[] = [];
  title = '"Provider routing architecture."';
  failTitles = false;
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    const base = { runId: req.runId, providerId: this.id, at: 0 };
    await tick();
    if (req.systemPrompt?.startsWith('Write a title')) {
      if (this.failTitles) yield { ...base, seq: 1, type: 'run.failed', error: { code: 'rate_limited', message: 'busy' } };
      else yield { ...base, seq: 1, type: 'run.completed', text: this.title };
      return;
    }
    yield { ...base, seq: 1, type: 'run.completed', text: `reply to ${req.messages.at(-1)!.content}` };
  }
}

function setup(opts: { aiTitles?: boolean; titler?: Titler } = {}, storage = new MemoryAdapter()) {
  const bus = new EventBus(500);
  const echo = new EchoProvider();
  const providers = new ProviderService(new ProviderRegistry().register(echo), bus);
  let n = 0;
  let aiTitles = opts.aiTitles ?? false;
  const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), {
    newId: (k) => `${k}-${++n}`,
    titler: opts.titler ?? providerTitler(providers),
    aiTitles: () => aiTitles,
  });
  return { bus, chat, echo, storage, providers, setAiTitles: (v: boolean) => (aiTitles = v) };
}

async function turn(chat: ConversationRuntime, id: string, text: string) {
  chat.send(id, text);
  await until(() => !chat.isBusy(id));
}

describe('conversation management', () => {
  it('renames, pins and unpins, and keeps it all after a restart', async () => {
    const storage = new MemoryAdapter();
    const a = setup({}, storage);
    const c = a.chat.create({ connectionId: 'echo' });
    await turn(a.chat, c.id, 'Can you design a provider routing architecture for RealmNest?');
    const used = a.chat.get(c.id)!.updatedAt;
    a.chat.rename(c.id, '  Routing   plan.  ');
    a.chat.setPinned(c.id, true);
    expect(a.chat.get(c.id)).toMatchObject({ title: 'Routing plan', titleSource: 'user', pinned: true });
    // metadata is not use: the conversation keeps its place by recency
    expect(a.chat.get(c.id)!.updatedAt).toBe(used);
    expect([...a.bus.log].filter((e) => e.type === 'conversation.updated').map((e) => (e.payload as { fields: string[] }).fields)).toEqual([['pinned'], ['title']]);
    await a.chat['repo'].flush(a.chat.snapshot);

    const b = setup({}, storage);
    await b.chat.init();
    expect(b.chat.get(c.id)).toMatchObject({ title: 'Routing plan', titleSource: 'user', pinned: true });
    b.chat.setPinned(c.id, false);
    expect(b.chat.get(c.id)!.pinned).toBeUndefined();
    expect(() => b.chat.rename(c.id, '   ')).toThrow(/title/);
  });

  it('deletes a conversation and its runs', async () => {
    const { chat } = setup();
    const c = chat.create({ connectionId: 'echo' });
    await turn(chat, c.id, 'hello');
    chat.remove(c.id);
    expect(chat.get(c.id)).toBeUndefined();
    expect(chat.snapshot().runs).toEqual([]);
  });

  it('keeps pinned conversations when old ones are pruned', () => {
    const conv = (i: number, pinned = false): Conversation => ({ id: `c${i}`, title: `t${i}`, connectionId: 'x', providerId: 'x', createdAt: i, updatedAt: i, messages: [], ...(pinned && { pinned: true }) });
    const list = Array.from({ length: MAX_CONVERSATIONS + 5 }, (_, i) => conv(i + 10));
    const kept = pruneChat({ version: 1, conversations: [conv(1, true), ...list], runs: [] }).conversations;
    expect(kept).toHaveLength(MAX_CONVERSATIONS);
    expect(kept.some((c) => c.id === 'c1')).toBe(true); // the oldest, but pinned
  });
});

describe('conversation titles', () => {
  it('uses the first message at once (no model call) when AI titles are off', async () => {
    const { chat, echo } = setup();
    const c = chat.create({ connectionId: 'echo' });
    await turn(chat, c.id, 'Can you design a provider routing architecture for RealmNest?');
    await tick();
    expect(chat.get(c.id)).toMatchObject({ title: 'Can you design a provider routing architecture', titleSource: 'auto' });
    expect(echo.requests).toHaveLength(1);
  });

  it('asks the model once, after the first reply, without making the chat wait', async () => {
    const { chat, echo } = setup({ aiTitles: true });
    const c = chat.create({ connectionId: 'echo' });
    chat.send(c.id, 'Can you design a provider routing architecture for RealmNest?');
    // the deterministic title is there before any reply
    expect(chat.get(c.id)!.title).toBe('Can you design a provider routing architecture');
    await until(() => chat.get(c.id)!.titleSource === 'ai');
    expect(chat.get(c.id)!.title).toBe('Provider routing architecture');
    await turn(chat, c.id, 'And the fallbacks?');
    await tick();
    expect(echo.requests.filter((r) => r.systemPrompt?.startsWith('Write a title'))).toHaveLength(1);
    expect(echo.requests[1].messages[0].content).toMatch(/^User: Can you design/);
  });

  it('keeps the first-message title when the title request fails', async () => {
    const { chat, echo } = setup({ aiTitles: true });
    echo.failTitles = true;
    const c = chat.create({ connectionId: 'echo' });
    await turn(chat, c.id, 'Plan the garden layout');
    await until(() => !!chat.get(c.id)!.titleRequestedAt);
    for (let i = 0; i < 5; i++) await tick();
    expect(chat.get(c.id)).toMatchObject({ title: 'Plan the garden layout', titleSource: 'auto' });
    await turn(chat, c.id, 'again');
    await tick();
    expect(echo.requests.filter((r) => r.systemPrompt?.startsWith('Write a title'))).toHaveLength(1); // never retried
  });

  it('never overwrites a title the user chose', async () => {
    let release: (t: string) => void = () => {};
    const slow: Titler = () => new Promise((r) => (release = r));
    const { chat } = setup({ aiTitles: true, titler: slow });
    const c = chat.create({ connectionId: 'echo' });
    await turn(chat, c.id, 'something');
    chat.rename(c.id, 'Mine');
    release('An AI title');
    await tick();
    expect(chat.get(c.id)).toMatchObject({ title: 'Mine', titleSource: 'user' });
  });

  it('does not ask for a title when the user renamed before the first reply', async () => {
    let calls = 0;
    const { chat } = setup({ aiTitles: true, titler: async () => (calls++, 'x') });
    const c = chat.create({ connectionId: 'echo' });
    chat.rename(c.id, 'Named first');
    await turn(chat, c.id, 'hello');
    expect(calls).toBe(0);
    expect(chat.get(c.id)!.title).toBe('Named first');
  });

  it('cleans what a model sends back', () => {
    expect(cleanTitle('Title: "Provider routing architecture."\n')).toBe('Provider routing architecture');
    expect(cleanTitle('**Garden plan**')).toBe('Garden plan');
    expect(cleanTitle('a'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe('history drawer groups', () => {
  const now = new Date(2026, 9, 12, 15, 0).getTime();
  const at = (d: number, h = 10) => new Date(2026, 9, 12 - d, h, 0).getTime();
  const c = (id: string, updatedAt: number, pinned = false): Conversation => ({ id, title: id, connectionId: 'x', providerId: 'x', createdAt: 0, updatedAt, messages: [{ id: 'm', conversationId: id, role: 'user', content: `about ${id} gardens`, status: 'complete', createdAt: 0 }], ...(pinned && { pinned: true }) });

  it('puts pinned first, then Today, Yesterday, Previous 7 days and Older (local days)', () => {
    const list = [c('old', at(30)), c('today', at(0, 9)), c('pin', at(40), true), c('yest', at(1, 23)), c('week', at(5)), c('today2', at(0, 14))];
    expect(groupConversations(list, now).map((g) => [g.key, g.items.map((x) => x.id)])).toEqual([
      ['pinned', ['pin']],
      ['today', ['today2', 'today']],
      ['yesterday', ['yest']],
      ['week', ['week']],
      ['older', ['old']],
    ]);
    expect(historyGroup(c('midnight', new Date(2026, 9, 12, 0, 0).getTime()), now)).toBe('today');
    expect(groupConversations([], now)).toEqual([]);
  });

  it('searches titles and messages', () => {
    const list = [c('alpha', at(0)), c('beta', at(0))];
    expect(searchConversations(list, 'BETA gardens').map((x) => x.id)).toEqual(['beta']);
    expect(searchConversations(list, '')).toHaveLength(2);
  });
});

describe('themes', () => {
  it('has a curated set of light and dark themes with every token', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8);
    expect(THEMES.some((t) => t.scheme === 'light') && THEMES.some((t) => t.scheme === 'dark')).toBe(true);
    const keys = Object.keys(THEMES[0].tokens).sort();
    for (const t of THEMES) {
      expect(Object.keys(t.tokens).sort()).toEqual(keys);
      expect(themeVariables(t)).toHaveProperty('--text-primary', t.tokens.textPrimary);
    }
  });

  it('keeps text and accents readable in every theme', () => {
    for (const t of THEMES) {
      const k = t.tokens;
      expect(contrast(k.textPrimary, k.background), `${t.id} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(k.textSecondary, k.surface), `${t.id} secondary`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(k.textMuted, k.surface), `${t.id} muted`).toBeGreaterThanOrEqual(3);
      expect(contrast(k.accentInk, k.accent), `${t.id} on accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(k.accent, k.background), `${t.id} accent`).toBeGreaterThanOrEqual(3);
      for (const s of [k.success, k.warning, k.danger]) expect(contrast(s, k.surface), `${t.id} status`).toBeGreaterThanOrEqual(3);
    }
  });

  it('migrates old appearance values and persists the choice', async () => {
    expect(migrateTheme('dusk')).toBe('ember');
    expect(migrateTheme('night')).toBe('ember');
    expect(migrateTheme('ocean')).toBe('ocean');
    expect(migrateTheme(undefined)).toBe('forest');
    expect(migrateTheme('nestra')).toBe('forest');
    expect(migrate({ settings: { ...DEFAULT_SETTINGS, theme: 'dusk' as never } }).settings).toMatchObject({ theme: 'ember', displayName: '', aiTitles: false });

    const storage = new MemoryAdapter();
    const store = new AppStore(new RealmNestRepository(storage), new EventBus());
    await store.init();
    store.updateSettings({ theme: 'solar', displayName: 'Alex' });
    await store.persistNow();
    const again = new AppStore(new RealmNestRepository(storage), new EventBus());
    await again.init();
    expect(again.getState().settings).toMatchObject({ theme: 'solar', displayName: 'Alex' });
    expect(THEME_BY_ID.solar.scheme).toBe('light');
  });
});

describe('greeting', () => {
  const t = translator('it');
  it('follows the local time and uses the name only when there is one', () => {
    expect(dayPart(new Date(2026, 0, 1, 8))).toBe('morning');
    expect(dayPart(new Date(2026, 0, 1, 14))).toBe('afternoon');
    expect(dayPart(new Date(2026, 0, 1, 21))).toBe('evening');
    expect(dayPart(new Date(2026, 0, 1, 2))).toBe('evening');
    expect(greeting(t, new Date(2026, 0, 1, 21), 'Alex').hello).toBe('Buonasera, Alex.');
    expect(greeting(t, new Date(2026, 0, 1, 9), '  ').hello).toBe('Buongiorno.');
    expect(greeting(translator('en'), new Date(2026, 0, 1, 15)).hello).toBe('Good afternoon.');
  });

  it('picks the line from a small curated set', () => {
    const lines = new Set([0, 1, 2, 3, 4, 5].map((s) => greeting(t, new Date(), undefined, s).line));
    expect([...lines].sort()).toEqual(['Come posso aiutarti?', 'Cosa vuoi fare?', 'Da dove iniziamo?', 'Su cosa lavoriamo?']);
  });
});

describe('product wording', () => {
  it('calls them Agents, and fills placeholders', () => {
    for (const lang of ['it', 'en'] as const) {
      const t = translator(lang);
      for (const k of ['nav.agents', 'menu.crew', 'crew.title', 'worlds.crewHere'] as const) expect(t(k)).not.toMatch(/crew/i);
    }
    expect(translator('it')('nav.agents')).toBe('Agenti');
    expect(translator('en')('nav.agents')).toBe('Agents');
    expect(translator('it')('agent.moved', { name: 'Alex', world: 'Office' })).toBe('Alex ora è in Office');
  });
});

describe('moving agents between worlds', () => {
  it('moves, reports why it cannot, and never moves a working agent', async () => {
    const bus = new EventBus();
    const store = new AppStore(new RealmNestRepository(new MemoryAdapter()), bus);
    await store.init();
    const alex = store.getState().characters.find((c) => c.metadata.founder)!;
    const from = alex.worldId;
    const to = from === 'office' ? 'farm' : 'office';
    expect(store.moveCharacter(alex.id, from)).toEqual({ ok: false, reason: 'same' });
    expect(store.moveCharacter(alex.id, 'atlantis')).toEqual({ ok: false, reason: 'unknown' });
    expect(store.moveCharacter(alex.id, to, () => true)).toEqual({ ok: false, reason: 'busy' });
    expect(store.getState().characters.find((c) => c.id === alex.id)!.worldId).toBe(from);
    expect(store.moveCharacter(alex.id, to, () => false)).toEqual({ ok: true });
    const moved = store.getState().characters.find((c) => c.id === alex.id)!;
    expect(moved.worldId).toBe(to);
    expect(store.crewIn(to).some((c) => c.id === alex.id)).toBe(true);
    expect(bus.log.some((e) => e.type === 'character.moved')).toBe(true);
  });

  it('wears again what it wore when it comes back', async () => {
    const store = new AppStore(new RealmNestRepository(new MemoryAdapter()), new EventBus());
    await store.init();
    const farmer = store.getState().characters.find((c) => c.worldId === 'farm' && !c.metadata.founder)!;
    const other = outfitsForWorld(WORLD_BY_ID.farm.outfitCategory).find((o) => !o.id.startsWith('universal.') && o.id !== WORLD_BY_ID.farm.defaultOutfitId && o.id !== farmer.outfitId)!;
    store.setOutfit(farmer.id, other.id);
    store.moveCharacter(farmer.id, 'office');
    const away = store.getState().characters.find((c) => c.id === farmer.id)!;
    expect(away.outfitId).not.toBe(other.id); // farm clothes stay at the farm
    store.moveCharacter(farmer.id, 'farm');
    expect(store.getState().characters.find((c) => c.id === farmer.id)!.outfitId).toBe(other.id);
  });
});

describe('home dashboard data', () => {
  const now = new Date(2026, 9, 12, 18, 0).getTime();
  const char = (id: string, worldId: string, createdAt = 0) => ({ id, name: id.toUpperCase(), role: 'Dev', worldId, metadata: { createdAt, updatedAt: createdAt } }) as unknown as Character;
  const task = (id: string, agentId: string, status: AgentTask['status'], updatedAt: number) => ({ id, agentId, title: `task ${id}`, prompt: '', status, runIds: [], createdAt: updatedAt, updatedAt }) as AgentTask;
  const chars = [char('a', 'farm'), char('b', 'farm'), char('c', 'office'), char('d', 'port', now - 1000)];
  const tasks: Record<string, AgentTask[]> = {
    a: [task('1', 'a', 'running', now - 60_000), task('2', 'a', 'completed', now - 3_600_000)],
    c: [task('3', 'c', 'failed', now - 2 * 86_400_000), task('4', 'c', 'completed', now - 3 * 86_400_000)],
  };
  const src = (conversations: Conversation[] = []) => ({ characters: chars, tasksOf: (id: string) => tasks[id] ?? [], working: (id: string) => id === 'a', conversations });

  it('summarizes each world from real agents and tasks', () => {
    expect(summarize(WORLD_BY_ID.farm, src())).toMatchObject({ agents: 2, tasks: 1, working: 1 });
    expect(summarize(WORLD_BY_ID.space, src())).toMatchObject({ agents: 0, tasks: 0, working: 0 });
  });

  it('lists recent activity, newest first, and counts the overview', () => {
    const chat: Conversation = { id: 'k', title: 'Routing plan', connectionId: 'x', providerId: 'x', agentId: 'b', createdAt: 0, updatedAt: now - 30_000, messages: [{ id: 'm', conversationId: 'k', role: 'user', content: 'hi', status: 'complete', createdAt: 0 }] };
    const items = recentActivity(src([chat]), 4);
    expect(items.map((i) => [i.kind, i.who, i.what])).toEqual([
      ['agent', 'D', 'Dev'],
      ['chat', 'B', 'Routing plan'],
      ['started', 'A', 'task 1'],
      ['completed', 'A', 'task 2'],
    ]);
    expect(overview(src(), now)).toEqual({ agents: 4, working: 1, doneToday: 1, failedWeek: 1 });
  });

  it('says when things happened in the UI language', () => {
    expect(timeAgo(now - 10_000, 'it', now)).toBe('ora');
    expect(timeAgo(now - 5 * 60_000, 'it', now)).toBe('5 minuti fa');
    expect(timeAgo(now - 3 * 3_600_000, 'en', now)).toBe('3 hours ago');
    expect(timeAgo(now - 86_400_000, 'it', now)).toBe('ieri');
  });
});

describe('profile', () => {
  it('shows the initial until there is a photo, and keeps name, role and photo', async () => {
    expect(initialOf('alex')).toBe('A');
    expect(initialOf('  èlena')).toBe('È');
    expect(initialOf('')).toBe('?');
    const storage = new MemoryAdapter();
    const store = new AppStore(new RealmNestRepository(storage), new EventBus());
    await store.init();
    expect(store.getState().settings).toMatchObject({ displayName: '', profileRole: '', avatar: '' });
    store.updateSettings({ displayName: 'Alex', profileRole: 'Founder', avatar: 'data:image/jpeg;base64,AAAA' });
    await store.persistNow();
    const again = new AppStore(new RealmNestRepository(storage), new EventBus());
    await again.init();
    expect(again.getState().settings).toMatchObject({ displayName: 'Alex', profileRole: 'Founder', avatar: 'data:image/jpeg;base64,AAAA' });
  });
});

describe('home world map', () => {
  it('has a district for every world, inside the picture', () => {
    for (const w of WORLDS) {
      const z = MAP_ZONES[w.id];
      expect(z, w.id).toBeDefined();
      expect(z.u - z.w / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(z.u + z.w / 2, w.id).toBeLessThanOrEqual(1);
      expect(z.v - z.h / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(z.v + z.h / 2, w.id).toBeLessThanOrEqual(1);
    }
  });

  it('places tags without overlapping each other or leaving the view', () => {
    const W = 900;
    const H = (W * 1086) / 1448;
    const ids = Object.keys(MAP_ZONES);
    const places = placeTags(ids.map((id) => ({ id, ...MAP_ZONES[id] })), W, H);
    const rect = (id: string) => {
      const p = places[id];
      const [x, y] = [p.x * W, p.y * H];
      const { w, h } = TAG_PX;
      if (p.side === 'above') return [x - w / 2, y - h, x + w / 2, y];
      if (p.side === 'below') return [x - w / 2, y, x + w / 2, y + h];
      if (p.side === 'right') return [x, y - h / 2, x + w, y + h / 2];
      return [x - w, y - h / 2, x, y + h / 2];
    };
    for (const a of ids) {
      const [x0, y0, x1, y1] = rect(a);
      expect(x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H, `${a} inside`).toBe(true);
      for (const b of ids) {
        if (a >= b) continue;
        const [bx0, by0, bx1, by1] = rect(b);
        expect(x0 < bx1 && bx0 < x1 && y0 < by1 && by0 < y1, `${a} / ${b}`).toBe(false);
      }
    }
    expect(placeTags([], 0, 0)).toEqual({});
  });
});

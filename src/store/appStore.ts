// ─────────────────────────────────────────────────────────────
// AppStore — app-level state (crew, settings, navigation) + persistence.
// Framework-free; React subscribes via useSyncExternalStore.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../core/events';
import type { Character } from '../domain/character';
import { WORLD_BY_ID } from '../data/worlds';
import { onFlushAll } from '../persistence/coalesced';
import { DEFAULT_SETTINGS, systemLanguage, type RealmNestRepository, type Settings } from '../persistence/repository';
import { type CharacterInput, createCharacter, duplicate, moveToWorld, resolveOutfit } from './characters';

export type Screen = 'home' | 'worlds' | 'agents' | 'crews' | 'workflows' | 'skills' | 'simulation' | 'chat' | 'artifacts' | 'knowledge' | 'memory' | 'research' | 'settings';
export type SettingsTab = 'general' | 'appearance' | 'ai' | 'caps' | 'integrations';

/** why an agent cannot move to a world right now (undefined: it can) */
export type MoveBlock = 'unknown' | 'same' | 'busy';

export interface CreatorState {
  editingId?: string;
  worldId?: string;
}

export interface AppState {
  ready: boolean;
  screen: Screen;
  characters: Character[];
  settings: Settings;
  currentWorldId: string;
  seenIntro: boolean;
  creator: CreatorState | null;
  /** world highlighted in the Worlds screen */
  focusWorldId: string;
  /** Settings section to show (not saved) */
  settingsTab: SettingsTab;
  /** what Chat should show next: a conversation, or a new empty one (no id) */
  chatRequest: { conversationId?: string; at: number };
  /** the artifact the Artifacts screen should show */
  artifactFocus: { id?: string; at: number };
  /** the Knowledge screen opened on a base / document / chunk (a citation) */
  knowledgeFocus: { baseId?: string; documentId?: string; chunkId?: string; at: number };
  /** the Memory screen opened on one agent (and its pending proposals) */
  memoryFocus: { agentId?: string; view?: 'active' | 'pending'; entryId?: string; at: number };
  /** open the Research screen on a run (or a new one with this question) */
  researchFocus: { id?: string; question?: string; at: number };
  crewFocus: { runId?: string; crewId?: string; at: number };
  /** the Workflow screen opened on a run, a workflow, a schedule or To do */
  workflowFocus: { runId?: string; workflowId?: string; scheduleId?: string; tab?: 'defs' | 'runs' | 'schedules' | 'inbox'; at: number };
  /** an artifact on its way into a new chat (Use in Chat, Send to Agent), taken by the Chat screen */
  handoff: { artifactId: string; agentId?: string; at: number } | null;
  /** an artifact on its way into an agent's next task, taken by that agent's task panel */
  taskHandoff: { artifactId: string; agentId: string; at: number } | null;
  toast: { text: string; at: number } | null;
}

export class AppStore {
  private state: AppState = {
    ready: false,
    screen: 'home',
    characters: [],
    settings: DEFAULT_SETTINGS,
    currentWorldId: 'farm',
    seenIntro: false,
    creator: null,
    focusWorldId: 'farm',
    settingsTab: 'general',
    chatRequest: { at: 0 },
    artifactFocus: { at: 0 },
    knowledgeFocus: { at: 0 },
    memoryFocus: { at: 0 },
    researchFocus: { at: 0 },
    crewFocus: { at: 0 },
    workflowFocus: { at: 0 },
    handoff: null,
    taskHandoff: null,
    toast: null,
  };
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private repo: RealmNestRepository,
    private bus: EventBus,
  ) {
    // a change made just before the window closes is written then (D-8)
    onFlushAll(() => (this.saveTimer ? this.persistNow() : undefined));
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<AppState>, persist = true) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
    if (persist && this.state.ready) this.schedulePersist();
  }

  async init() {
    let saved: Awaited<ReturnType<RealmNestRepository['load']>>;
    try {
      saved = await this.repo.load();
    } catch (err) {
      // nothing is invented and nothing is saved over what could not be loaded
      this.set({ ready: true, characters: [] }, false);
      throw err;
    }
    if (saved) {
      // an existing profile opens exactly as saved, also with no agents: empty is a valid state
      this.set({ ready: true, characters: saved.characters, settings: saved.settings, currentWorldId: saved.currentWorldId, focusWorldId: saved.currentWorldId, seenIntro: saved.seenIntro }, false);
    } else if (this.repo.unreadable()) {
      // a save that exists but cannot be read opens empty in memory and is not overwritten at
      // startup (its raw text was copied to nestra:corrupt:save); the first real change saves (D-3)
      this.set({ ready: true, characters: [] }, false);
    } else {
      // a genuinely new profile: a clean workspace, with no agents (0.11.1). Demo agents are only
      // created when the user asks for them (Settings › Data › Load the demo team).
      this.set({ ready: true, characters: [], settings: { ...DEFAULT_SETTINGS, language: systemLanguage() } }, false);
      await this.persistNow();
    }
  }

  private schedulePersist() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persistNow(), 250);
  }

  async persistNow() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const { characters, settings, currentWorldId, seenIntro } = this.state;
    await this.repo.save({ characters, settings, currentWorldId, seenIntro });
  }

  // ── navigation ─────────────────────────────────────────────
  navigate(screen: Screen) {
    this.set({ screen }, false);
  }

  openSettings(tab: SettingsTab) {
    this.set({ screen: 'settings', settingsTab: tab }, false);
  }

  setSettingsTab(tab: SettingsTab) {
    this.set({ settingsTab: tab }, false);
  }

  /** open Chat on a new, empty conversation */
  newChat() {
    this.set({ screen: 'chat', chatRequest: { at: Date.now() } }, false);
  }

  /** open Chat on an existing conversation */
  openChat(conversationId: string) {
    this.set({ screen: 'chat', chatRequest: { conversationId, at: Date.now() } }, false);
  }

  /** open the Artifacts screen on one artifact */
  openArtifact(id: string) {
    this.set({ screen: 'artifacts', artifactFocus: { id, at: Date.now() } }, false);
  }

  /** open the Knowledge screen on a base, a document or one chunk of it */
  openKnowledge(focus: { baseId?: string; documentId?: string; chunkId?: string } = {}) {
    this.set({ screen: 'knowledge', knowledgeFocus: { ...focus, at: Date.now() } }, false);
  }

  /** open the Crew screen on a crew or one of its runs */
  openCrew(focus: { runId?: string; crewId?: string } = {}) {
    this.set({ screen: 'crews', crewFocus: { ...focus, at: Date.now() } }, false);
  }
  openWorkflow(focus: { runId?: string; workflowId?: string; scheduleId?: string; tab?: 'defs' | 'runs' | 'schedules' | 'inbox' } = {}) {
    this.set({ screen: 'workflows', workflowFocus: { ...focus, at: Date.now() } }, false);
  }
  openResearch(focus: { id?: string; question?: string } = {}) {
    this.set({ screen: 'research', researchFocus: { ...focus, at: Date.now() } }, false);
  }

  /** open the Memory screen on an agent's memories or proposals */
  openMemory(focus: { agentId?: string; view?: 'active' | 'pending'; entryId?: string } = {}) {
    this.set({ screen: 'memory', memoryFocus: { ...focus, at: Date.now() } }, false);
  }

  /** a new chat (with an agent, when given) that starts with this artifact attached */
  chatWithArtifact(artifactId: string, agentId?: string) {
    const at = Date.now();
    this.set({ screen: 'chat', chatRequest: { at }, handoff: { artifactId, ...(agentId && { agentId }), at } }, false);
  }

  /** the agent's world, its inspector open, and its next task starting with this artifact attached */
  taskWithArtifact(artifactId: string, agentId: string) {
    const c = this.state.characters.find((x) => x.id === agentId);
    if (!c) return;
    this.setWorld(c.worldId);
    this.set({ screen: 'simulation', taskHandoff: { artifactId, agentId, at: Date.now() } }, false);
  }

  takeTaskHandoff(agentId: string) {
    const h = this.state.taskHandoff;
    if (!h || h.agentId !== agentId) return null;
    this.set({ taskHandoff: null }, false);
    return h;
  }

  takeHandoff() {
    const h = this.state.handoff;
    if (h) this.set({ handoff: null }, false);
    return h;
  }

  focusWorld(id: string) {
    this.set({ focusWorldId: id }, false);
  }

  setWorld(id: string) {
    if (!WORLD_BY_ID[id]) return;
    this.set({ currentWorldId: id, focusWorldId: id });
    this.bus.emit('world.changed', { worldId: id });
  }

  toast(text: string) {
    this.set({ toast: { text, at: Date.now() } }, false);
  }

  // ── crew ───────────────────────────────────────────────────
  crewIn(worldId: string) {
    return this.state.characters.filter((c) => c.worldId === worldId);
  }

  createCharacter(input: CharacterInput): Character {
    const c = createCharacter(input);
    this.set({ characters: [...this.state.characters, c] });
    this.bus.emit('character.created', { id: c.id, name: c.name });
    return c;
  }

  updateCharacter(id: string, patch: Partial<Omit<Character, 'id' | 'metadata'>>) {
    const prev = this.state.characters.find((c) => c.id === id);
    if (!prev) return;
    let next: Character = { ...prev, ...patch, metadata: { ...prev.metadata, updatedAt: Date.now() } };
    // moveToWorld needs the world it leaves, to remember what was worn there
    if (patch.worldId && patch.worldId !== prev.worldId) next = moveToWorld({ ...next, worldId: prev.worldId }, patch.worldId);
    else if (patch.outfitId || patch.profile) next.outfitId = resolveOutfit(next.worldId, next.outfitId, next.profile.body);
    this.set({ characters: this.state.characters.map((c) => (c.id === id ? next : c)) });
    this.bus.emit('character.updated', { id, name: next.name, fields: Object.keys(patch) });
  }

  deleteCharacter(id: string) {
    const c = this.state.characters.find((x) => x.id === id);
    if (!c) return;
    this.set({ characters: this.state.characters.filter((x) => x.id !== id) });
    this.bus.emit('character.deleted', { id, name: c.name });
  }

  duplicateCharacter(id: string) {
    const c = this.state.characters.find((x) => x.id === id);
    if (!c) return;
    const copy = duplicate(c);
    this.set({ characters: [...this.state.characters, copy] });
    this.bus.emit('character.created', { id: copy.id, name: copy.name });
    return copy;
  }

  /**
   * Move an agent to another world. `busy` (e.g. LiveRuntime has a run going)
   * blocks it: a working agent stays where its task started.
   */
  moveCharacter(id: string, worldId: string, busy?: (id: string) => boolean): { ok: true } | { ok: false; reason: MoveBlock } {
    const c = this.state.characters.find((x) => x.id === id);
    if (!c || !WORLD_BY_ID[worldId]) return { ok: false, reason: 'unknown' };
    if (c.worldId === worldId) return { ok: false, reason: 'same' };
    if (busy?.(id)) return { ok: false, reason: 'busy' };
    this.updateCharacter(id, { worldId });
    this.bus.emit('character.moved', { id, name: c.name, from: c.worldId, to: worldId });
    return { ok: true };
  }

  setOutfit(id: string, outfitId: string, outfitVariant?: string) {
    this.updateCharacter(id, { outfitId, outfitVariant });
  }

  openCreator(c: CreatorState = {}) {
    this.set({ creator: c }, false);
  }
  closeCreator() {
    this.set({ creator: null }, false);
  }

  // ── settings ───────────────────────────────────────────────
  updateSettings(patch: Partial<Settings>) {
    this.set({ settings: { ...this.state.settings, ...patch } });
  }

  markIntroSeen() {
    if (!this.state.seenIntro) this.set({ seenIntro: true });
  }

  /** the demo agents replace every agent (each one is deleted: its memories and agent settings go); settings go back to the defaults */
  /** "Load the demo team": only on the user's request, never at startup */
  async resetDemo() {
    // loaded on demand: the demo crew is not part of the startup path
    const { demoCrew } = await import('../data/seed');
    // the demo ids are fixed: without a delete, a new demo agent would inherit the old one's data (D-6)
    for (const c of this.state.characters) this.bus.emit('character.deleted', { id: c.id, name: c.name });
    await this.repo.clear();
    this.set({ characters: demoCrew(), settings: DEFAULT_SETTINGS, currentWorldId: 'farm', focusWorldId: 'farm' });
    await this.persistNow();
  }
}

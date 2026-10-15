// ─────────────────────────────────────────────────────────────
// Keeps exactly one live WorldSession for the current world, in sync with
// the crew stored in AppStore, and drives the frame loop.
// Viewports subscribe to `onFrame` to paint.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../core/events';
import type { Character } from '../domain/character';
import { WORLD_BY_ID } from '../data/worlds';
import { startLoop } from './loop';
import { WorldSession } from '../engine/session';
import type { AgentLook } from '../engine/worldSim';
import type { AgentRuntime } from '../runtime/types';
import type { AppStore } from '../store/appStore';

export function lookOf(c: Character): AgentLook {
  return {
    name: c.name,
    role: c.role,
    profile: c.profile,
    outfitId: c.outfitId,
    outfitVariant: c.outfitVariant,
    signature: c.signature,
    founder: c.metadata.founder,
  };
}

export class SessionManager {
  session: WorldSession | null = null;
  private frameListeners = new Set<(now: number) => void>();
  private sessionListeners = new Set<() => void>();
  private lastChars: Character[] | null = null;
  private stop: (() => void) | null = null;

  private mode: 'mock' | 'live' | null = null;

  constructor(
    private store: AppStore,
    private bus: EventBus,
    /** the app's real runtime, used when settings.runtimeMode is 'live' */
    private live?: AgentRuntime,
  ) {}

  start() {
    this.store.subscribe(() => this.syncFromStore());
    this.syncFromStore();
    let last = performance.now();
    this.stop = startLoop((now) => {
      this.session?.update((now - last) / 1000);
      last = now;
      this.frameListeners.forEach((f) => f(now));
    });
  }

  dispose() {
    this.stop?.();
    this.session?.dispose();
  }

  onFrame(fn: (now: number) => void) {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  onSession(fn: () => void) {
    this.sessionListeners.add(fn);
    return () => this.sessionListeners.delete(fn);
  }
  getSession = () => this.session;

  private syncFromStore() {
    const st = this.store.getState();
    if (!st.ready) return;
    const world = WORLD_BY_ID[st.currentWorldId] ?? WORLD_BY_ID.office;
    // the one place that chooses between simulated and real agents
    const mode = st.settings.runtimeMode === 'live' && this.live ? 'live' : 'mock';
    if (!this.session || this.session.world.id !== world.id || this.mode !== mode) {
      this.session?.dispose();
      this.mode = mode;
      this.session = new WorldSession(world, this.bus, this.looks(st.characters, world.id), 7, mode === 'live' ? this.live : undefined);
      this.lastChars = st.characters;
      this.sessionListeners.forEach((f) => f());
      return;
    }
    if (this.lastChars !== st.characters) {
      this.lastChars = st.characters;
      this.session.sync(this.looks(st.characters, world.id));
    }
  }

  private looks(chars: Character[], worldId: string) {
    return new Map(chars.filter((c) => c.worldId === worldId).map((c) => [c.id, lookOf(c)]));
  }
}

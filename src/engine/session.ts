// ─────────────────────────────────────────────────────────────
// WorldSession — one running world: runtime (truth) + visual sim.
// The single entry point for commands: `dispatch(SimCommand)`.
// UI, keyboard, debug panel and (later) real agents all go through it.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import type { AgentState, SimCommand } from '../domain/sim';
import type { WorldDef } from '../domain/world';
import { MockRuntime } from '../runtime/mockRuntime';
import type { AgentRuntime } from '../runtime/types';
import { type AgentLook, WorldSim } from './worldSim';

export class WorldSession {
  readonly sim: WorldSim;
  readonly runtime: AgentRuntime;
  selected = new Set<string>();
  speed = 1;
  frozen = false;
  private version = 0;
  private listeners = new Set<() => void>();
  private uiClock = 0;

  constructor(
    readonly world: WorldDef,
    private bus: EventBus,
    looks: Map<string, AgentLook>,
    seed = 7,
    /** a shared runtime (LiveRuntime); by default the world gets its own MockRuntime */
    runtime?: AgentRuntime,
  ) {
    const rng = new Rng(seed);
    this.runtime = runtime ?? new MockRuntime(bus, world.tasks, new Rng(seed * 31 + 1));
    this.sim = new WorldSim(world, bus, rng);
    bus.clock = () => this.sim.time;
    this.sync(looks);
  }

  dispose() {
    // a shared runtime outlives the world: let go of this world's agents
    for (const a of this.sim.agents) this.runtime.detach(a.id);
    this.sim.dispose();
    this.listeners.clear();
  }

  // ── React glue ─────────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Align runtime + visual roster with the crew assigned to this world. */
  sync(looks: Map<string, AgentLook>) {
    const ids = [...looks.keys()];
    for (const a of this.sim.agents) if (!looks.has(a.id)) this.runtime.detach(a.id);
    // visual agents first, so a runtime can replay what an agent is already doing
    this.sim.sync(looks);
    this.runtime.attach(ids);
    for (const id of [...this.selected]) if (!looks.has(id)) this.selected.delete(id);
    this.changed();
  }

  // ── commands ───────────────────────────────────────────────
  dispatch(cmd: SimCommand) {
    this.bus.emit('command.issued', cmd);
    switch (cmd.type) {
      case 'reset':
        this.runtime.reset();
        this.sim.respawn();
        this.bus.emit('simulation.reset', { worldId: this.world.id });
        break;
      case 'goto':
        for (const id of cmd.targets ?? []) this.sim.goto(id, { pointId: cmd.pointId, tile: cmd.tile });
        break;
      default:
        if (cmd.type === 'startWork') this.bus.emit('simulation.started', { worldId: this.world.id });
        if (cmd.type === 'pause' && !cmd.targets?.length) this.bus.emit('simulation.paused', { worldId: this.world.id, frozen: false });
        this.runtime.dispatch(cmd);
    }
    this.changed();
  }

  /** Commands target the selection when there is one, otherwise everyone. */
  targetsOrSelection(): string[] | undefined {
    return this.selected.size ? [...this.selected] : undefined;
  }

  select(id: string | null, additive = false) {
    if (!id) this.selected.clear();
    else if (additive) this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
    else {
      const only = this.selected.size === 1 && this.selected.has(id);
      this.selected.clear();
      if (!only) this.selected.add(id);
    }
    this.changed();
  }

  selectAll() {
    this.selected = new Set(this.sim.agents.map((a) => a.id));
    this.changed();
  }

  setFrozen(v: boolean) {
    this.frozen = v;
    this.bus.emit('simulation.paused', { worldId: this.world.id, frozen: v });
    this.changed();
  }

  setSpeed(v: number) {
    this.speed = v;
    this.changed();
  }

  setAutopilot(v: boolean) {
    this.runtime.autopilot = v;
    this.changed();
  }

  setFailureRate(v: number) {
    this.runtime.failureRate = v;
    this.changed();
  }

  /** Advance exactly one fixed step (works while frozen). */
  step(dt = 0.25) {
    this.runtime.tick(dt);
    this.sim.update(dt);
    this.bus.emit('simulation.step', { dt });
    this.changed();
  }

  update(realDt: number) {
    if (!this.frozen) {
      const dt = Math.min(Math.max(realDt, 0), 0.1) * this.speed;
      this.runtime.tick(dt);
      this.sim.update(dt);
    }
    this.uiClock += realDt;
    if (this.uiClock > 0.25) {
      this.uiClock = 0;
      this.changed();
    }
  }

  counts(): Record<AgentState, number> {
    const c = { idle: 0, walking: 0, working: 0, on_break: 0, interacting: 0, waiting: 0, paused: 0, error: 0 };
    for (const a of this.sim.agents) if (a.spawnIn <= 0) c[a.state]++;
    return c;
  }
}

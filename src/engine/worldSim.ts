// ─────────────────────────────────────────────────────────────
// WorldSim — the VISUAL simulation of one world.
//
// It never invents work. It listens to runtime events on the bus and turns
// them into movement and visual states:
//
//   agent.work.started   → claim a workstation → walking → working
//   agent.break.started  → pick a break point  → walking → on_break
//   agent.paused         → stop               → paused
//   agent.waiting        → (stay)             → waiting
//   agent.work.failed    → (stay)             → error
//   agent.meeting.started→ meeting point       → interacting
//   agent.delegation     → walk to colleague   → interacting
//   agent.idle           → cozy idle behaviours (look around, coffee, chat…)
//
// Positions are continuous tile coordinates. No DOM, no rendering.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { VisualProfile } from '../domain/character';
import type { AgentState, RuntimeStatus, Task } from '../domain/sim';
import { BREAK_TYPES, OBSERVE_TYPES, WORK_TYPES, type Facing, type InteractionPoint, type InteractionType, type WorldDef } from '../domain/world';
import { NavGrid } from './nav';

export interface AgentLook {
  name: string;
  role: string;
  profile: VisualProfile;
  outfitId: string;
  outfitVariant?: string;
  signature: string;
  founder?: boolean;
}

export type BubbleKind = 'done' | 'chat' | 'idea' | 'coffee' | 'alert' | 'heart' | 'zz' | 'wave' | 'wait' | 'pause' | 'question' | 'music' | 'search';

type Purpose = 'work' | 'break' | 'meet' | 'wander' | 'coffee' | 'sit' | 'chat' | 'observe' | 'delegate' | 'goto' | 'enter';

interface Target {
  purpose: Purpose;
  pointId?: string;
  label: string;
  x: number;
  y: number;
  facing: Facing;
  arrive: AgentState;
  partner?: string;
}

export interface VisualAgent {
  id: string;
  look: AgentLook;
  state: AgentState;
  stateTime: number;
  x: number;
  y: number;
  facing: Facing;
  path: { x: number; y: number }[];
  target: Target | null;
  /** reserved workstation */
  stationId: string | null;
  /** point physically occupied / reserved for the current target */
  at: string | null;
  sitting: boolean;
  activity: string;
  runtime: RuntimeStatus;
  task: Task | null;
  bubble: { kind: BubbleKind; until: number } | null;
  /** after a real hand-over: wait for the colleague's answer (instead of going idle) */
  awaitsColleague?: string;
  /** a deep research of this agent is running: a magnifier comes and goes over its head */
  researching?: boolean;
  anim: number;
  blinkUntil: number;
  nextBlink: number;
  nextIdle: number;
  spawnIn: number;
  partner: string | null;
  chatUntil: number;
  waitingFor: 'station' | 'approval' | null;
}

export interface Effect {
  kind: 'sparkle' | 'puff';
  x: number;
  y: number;
  t: number;
  color: string;
}

const SPEED = 2.4; // tiles per simulated second
const SLOT_OFFSETS = [
  [0, 0],
  [0.32, 0.18],
  [-0.3, 0.22],
  [0.2, -0.3],
  [-0.22, -0.26],
];

export class WorldSim {
  readonly grid: NavGrid;
  agents: VisualAgent[] = [];
  effects: Effect[] = [];
  time = 0;
  private occ = new Map<string, string[]>();
  private reserved = new Map<string, string>(); // work point → agent
  private points: Map<string, InteractionPoint>;
  private offs: (() => void)[] = [];

  constructor(
    readonly world: WorldDef,
    private bus: EventBus,
    private rng: Rng,
  ) {
    this.grid = NavGrid.fromWorld(world);
    this.points = new Map(world.points.map((p) => [p.id, p]));
    this.listen();
  }

  dispose() {
    this.offs.forEach((f) => f());
    this.offs = [];
  }

  get(id: string) {
    return this.agents.find((a) => a.id === id);
  }
  point(id: string | null | undefined) {
    return id ? this.points.get(id) : undefined;
  }

  // ── roster ─────────────────────────────────────────────────
  /** Make the agent list match the given looks (add, update, remove). */
  sync(looks: Map<string, AgentLook>) {
    for (const a of [...this.agents]) if (!looks.has(a.id)) this.remove(a.id);
    let i = 0;
    for (const [id, look] of looks) {
      const a = this.get(id);
      if (a) a.look = look;
      else this.spawn(id, look, (i++) * 0.45);
    }
  }

  private spawn(id: string, look: AgentLook, delay: number) {
    const sp = this.world.spawnPoints[this.agents.length % Math.max(1, this.world.spawnPoints.length)] ?? { x: 0, y: 0 };
    const a: VisualAgent = {
      id,
      look,
      state: 'idle',
      stateTime: 0,
      x: sp.x + 0.5,
      y: sp.y + 0.5,
      facing: 'sw',
      path: [],
      target: null,
      stationId: null,
      at: null,
      sitting: false,
      activity: 'Arriving',
      runtime: 'idle',
      task: null,
      bubble: null,
      anim: this.rng.range(0, 3),
      blinkUntil: 0,
      nextBlink: this.rng.range(1, 4),
      nextIdle: this.rng.range(1, 3),
      spawnIn: delay,
      partner: null,
      chatUntil: 0,
      waitingFor: null,
    };
    this.agents.push(a);
    return a;
  }

  remove(id: string) {
    const a = this.get(id);
    if (!a) return;
    this.leave(a);
    this.releaseStation(a);
    this.agents = this.agents.filter((x) => x !== a);
  }

  /** Back to the start: everyone re-enters from the spawn points. */
  respawn() {
    const looks = new Map(this.agents.map((a) => [a.id, a.look]));
    this.agents = [];
    this.occ.clear();
    this.reserved.clear();
    this.effects = [];
    this.time = 0;
    this.sync(looks);
  }

  // ── runtime → visual ───────────────────────────────────────
  private listen() {
    const on = this.bus.on.bind(this.bus);
    this.offs.push(
      on('agent.work.started', ({ agentId, task }) => this.with(agentId, (a) => this.toWork(a, task))),
      on('agent.work.completed', ({ agentId }) =>
        this.with(agentId, (a) => {
          a.task = null;
          a.researching = false;
          a.awaitsColleague = undefined;
          this.bubble(a, 'done', 1.6);
          this.effects.push({ kind: 'sparkle', x: a.x, y: a.y, t: 0, color: a.look.signature });
          a.activity = 'Task done ✓';
        }),
      ),
      // an agent's deep research: a magnifier while it searches and reads, the step as its activity
      on('research.event', ({ agentId, phase, message }) => {
        if (!agentId) return;
        this.with(agentId, (a) => {
          if (phase === 'done' || phase === 'error' || phase === 'cancel') {
            a.researching = false;
            return;
          }
          if (a.runtime !== 'working') return;
          a.researching = true;
          a.activity = `Research · ${message.slice(0, 70)}`;
          if (phase === 'write') this.bubble(a, 'idea', 1.4);
          else if (!a.bubble) this.bubble(a, 'search', 2);
        });
      }),
      on('agent.work.failed', ({ agentId, task, error }) =>
        this.with(agentId, (a) => {
          a.runtime = 'error';
          a.task = task;
          this.stop(a);
          this.setState(a, 'error');
          a.activity = `Error: ${error}`;
          this.bubble(a, 'alert', 3);
        }),
      ),
      on('agent.break.started', ({ agentId }) =>
        this.with(agentId, (a) => {
          a.runtime = 'break';
          a.partner = null;
          this.goToSpot(a, BREAK_TYPES, 'break', 'on_break');
        }),
      ),
      on('agent.paused', ({ agentId }) =>
        this.with(agentId, (a) => {
          a.runtime = 'paused';
          this.stop(a);
          this.setState(a, 'paused');
          a.activity = a.task ? `Paused · “${a.task.title}”` : 'Paused';
          this.bubble(a, 'pause', 1.2);
        }),
      ),
      on('agent.idle', ({ agentId }) =>
        this.with(agentId, (a) => {
          a.runtime = 'idle';
          a.task = null;
          a.researching = false;
          a.awaitsColleague = undefined;
          a.partner = null;
          this.releaseStation(a);
          if (a.state !== 'walking') this.setState(a, 'idle');
          a.activity = 'Idle';
          a.nextIdle = this.time + this.rng.range(0.8, 2.5);
        }),
      ),
      on('agent.waiting', ({ agentId, reason }) =>
        this.with(agentId, (a) => {
          a.runtime = 'waiting';
          a.waitingFor = 'approval';
          a.activity = `Waiting · ${reason}`;
          if (a.state !== 'walking') this.setState(a, 'waiting');
          this.bubble(a, 'wait', 2);
        }),
      ),
      on('agent.meeting.started', ({ agentId }) =>
        this.with(agentId, (a) => {
          a.runtime = 'meeting';
          this.goToSpot(a, ['MEETING'], 'meet', 'interacting', true);
        }),
      ),
      // a Crew meeting (kickoff, final) ends for someone with no task: back to idle
      on('agent.meeting.ended', ({ agentId }) =>
        this.with(agentId, (a) => {
          if (a.runtime !== 'meeting') return;
          a.runtime = 'idle';
          a.partner = null;
          if (a.state !== 'walking') this.setState(a, 'idle');
          a.activity = 'Idle';
          a.nextIdle = this.time + this.rng.range(0.5, 2);
        }),
      ),
      // a Crew hand-off: the free author walks over to the colleague, talks, then goes back to idle
      on('agent.handoff', ({ from, to }) =>
        this.with(from, (a) => {
          const b = this.get(to);
          if (!b || a.runtime === 'working') return;
          if (a.runtime === 'meeting') a.runtime = 'idle';
          const t = this.besideTile(b, a);
          a.activity = `Handing off to ${b.look.name}`;
          this.walkTo(a, { purpose: 'chat', label: b.look.name, x: t.x + 0.5, y: t.y + 0.5, facing: faceToward(t.x + 0.5, t.y + 0.5, b.x, b.y), arrive: 'interacting', partner: b.id });
        }),
      ),
      on('agent.delegation.returned', ({ from }) =>
        this.with(from, (a) => {
          if (!a.awaitsColleague) return;
          a.awaitsColleague = undefined;
          if (a.runtime === 'working' && a.task) this.toWork(a, a.task);
        }),
      ),
      on('agent.delegation', ({ from, to, live }) =>
        this.with(from, (a) => {
          const b = this.get(to);
          // a real hand-over keeps the agent at work: it talks, then waits for the answer
          if (live) a.awaitsColleague = b?.look.name ?? to;
          else a.runtime = 'meeting';
          if (!b) return;
          const t = this.besideTile(b, a);
          a.activity = `Delegating to ${b.look.name}`;
          this.walkTo(a, { purpose: 'delegate', label: b.look.name, x: t.x + 0.5, y: t.y + 0.5, facing: faceToward(t.x + 0.5, t.y + 0.5, b.x, b.y), arrive: 'interacting', partner: b.id });
        }),
      ),
    );
  }

  private with(id: string, fn: (a: VisualAgent) => void) {
    const a = this.get(id);
    if (a) fn(a);
  }

  private toWork(a: VisualAgent, task: Task) {
    a.runtime = 'working';
    a.task = task;
    a.partner = null;
    a.waitingFor = null;
    const st = this.claimStation(a);
    if (!st) {
      a.waitingFor = 'station';
      this.stop(a);
      this.setState(a, 'waiting');
      a.activity = 'Waiting for a free workstation';
      this.bubble(a, 'wait', 2);
      return;
    }
    a.activity = `Working on “${task.title}” · ${st.label}`;
    if (a.at === st.id && !a.path.length && Math.hypot(a.x - st.x, a.y - st.y) < 0.05) {
      this.setState(a, 'working');
      this.bubble(a, 'idea', 1);
      return;
    }
    this.walkTo(a, { purpose: 'work', pointId: st.id, label: st.label, x: st.x, y: st.y, facing: st.facing, arrive: 'working' });
  }

  // ── points & reservations ─────────────────────────────────
  private claimStation(a: VisualAgent): InteractionPoint | null {
    if (a.stationId && this.reserved.get(a.stationId) === a.id) return this.points.get(a.stationId)!;
    const free = this.world.points.filter((p) => WORK_TYPES.includes(p.type) && !this.reserved.has(p.id));
    if (!free.length) return null;
    free.sort((p, q) => dist(a, p) - dist(a, q));
    const p = free[0];
    this.reserved.set(p.id, a.id);
    a.stationId = p.id;
    return p;
  }

  private releaseStation(a: VisualAgent) {
    if (a.stationId && this.reserved.get(a.stationId) === a.id) this.reserved.delete(a.stationId);
    a.stationId = null;
  }

  occupants(pointId: string) {
    return this.occ.get(pointId) ?? [];
  }
  reservedBy(pointId: string) {
    return this.reserved.get(pointId);
  }

  private freePoints(types: InteractionType[], a: VisualAgent) {
    return this.world.points.filter(
      (p) =>
        types.includes(p.type) &&
        this.occupants(p.id).filter((x) => x !== a.id).length < p.capacity &&
        (!WORK_TYPES.includes(p.type) || !this.reserved.has(p.id)),
    );
  }

  private goToSpot(a: VisualAgent, types: InteractionType[], purpose: Purpose, arrive: AgentState, nearest = false) {
    const free = this.freePoints(types, a);
    if (!free.length) {
      this.stop(a);
      this.setState(a, arrive);
      a.activity = arrive === 'on_break' ? 'On break' : 'Huddling';
      return;
    }
    free.sort((p, q) => dist(a, p) - dist(a, q));
    const p = nearest ? free[0] : this.rng.pick(free.slice(0, Math.min(3, free.length)));
    a.activity = purpose === 'break' ? `On break · ${p.label}` : purpose === 'meet' ? `Huddle · ${p.label}` : p.label;
    this.walkTo(a, { purpose, pointId: p.id, label: p.label, x: p.x, y: p.y, facing: p.facing, arrive });
  }

  private occupy(a: VisualAgent, pointId: string) {
    this.leave(a);
    const list = this.occ.get(pointId) ?? [];
    list.push(a.id);
    this.occ.set(pointId, list);
    a.at = pointId;
  }

  private leave(a: VisualAgent) {
    if (!a.at) return;
    const list = (this.occ.get(a.at) ?? []).filter((x) => x !== a.id);
    if (list.length) this.occ.set(a.at, list);
    else this.occ.delete(a.at);
    this.bus.emit('interaction.completed', { agentId: a.id, pointId: a.at });
    a.at = null;
  }

  // ── movement ───────────────────────────────────────────────
  private walkTo(a: VisualAgent, t: Target) {
    let { x, y } = t;
    if (t.pointId) {
      this.occupy(a, t.pointId);
      const k = this.occupants(t.pointId).indexOf(a.id);
      if (k > 0) {
        const [ox, oy] = SLOT_OFFSETS[k % SLOT_OFFSETS.length];
        x += ox;
        y += oy;
      }
    } else this.leave(a);
    a.sitting = false;
    a.target = { ...t, x, y };
    const tiles = this.grid.findPath(Math.floor(a.x), Math.floor(a.y), Math.floor(x), Math.floor(y));
    if (!tiles) {
      // unreachable: snap rather than get stuck (logged so the world can be fixed)
      a.path = [];
      a.x = x;
      a.y = y;
      this.arrive(a);
      return;
    }
    a.path = tiles.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    if (a.path.length) a.path[a.path.length - 1] = { x, y };
    else a.path = [{ x, y }];
    this.setState(a, 'walking');
    this.bus.emit('agent.walk.started', { agentId: a.id, to: t.label });
  }

  private stop(a: VisualAgent) {
    a.path = [];
    a.target = null;
  }

  private arrive(a: VisualAgent) {
    const t = a.target;
    a.path = [];
    if (!t) return this.setState(a, 'idle');
    a.facing = t.facing;
    const p = this.point(t.pointId);
    a.sitting = !!p?.sit;
    this.bus.emit('agent.walk.completed', { agentId: a.id, at: t.label });
    if (p) this.bus.emit('interaction.started', { agentId: a.id, pointId: p.id, type: p.type });
    // the runtime may have moved on while we were walking — it wins
    let next = t.arrive;
    if (t.purpose === 'work') {
      // the work ended (or failed) during the walk: never sit down and pretend
      if (a.runtime === 'idle') next = 'idle';
      else if (a.runtime === 'waiting') next = 'waiting';
      else if (a.runtime === 'error') next = 'error';
      else if (a.runtime === 'paused') next = 'paused';
    }
    this.setState(a, next);
    switch (t.purpose) {
      case 'coffee':
        a.activity = `Getting a coffee · ${t.label}`;
        this.bubble(a, 'coffee', 2.5);
        a.nextIdle = this.time + this.rng.range(5, 9);
        break;
      case 'sit':
        a.activity = `Relaxing · ${t.label}`;
        a.nextIdle = this.time + this.rng.range(7, 12);
        break;
      case 'observe':
        a.activity = `Looking at ${t.label}`;
        this.bubble(a, this.rng.chance(0.5) ? 'question' : 'music', 2);
        a.nextIdle = this.time + this.rng.range(4, 7);
        break;
      case 'wander':
      case 'goto':
      case 'enter':
        a.activity = 'Idle';
        a.nextIdle = this.time + this.rng.range(2, 5);
        break;
      case 'chat':
      case 'delegate': {
        const b = t.partner ? this.get(t.partner) : undefined;
        a.partner = b?.id ?? null;
        a.chatUntil = this.time + this.rng.range(4, 7);
        if (b) {
          b.facing = faceToward(b.x, b.y, a.x, a.y);
          if (t.purpose === 'chat' && (b.state === 'idle' || b.state === 'on_break')) {
            b.partner = a.id;
            b.chatUntil = a.chatUntil;
            this.setState(b, 'interacting');
            b.activity = `Chatting with ${a.look.name}`;
          } else this.bubble(b, 'chat', 2);
          a.activity = t.purpose === 'chat' ? `Chatting with ${b.look.name}` : `Delegating to ${b.look.name}`;
        }
        break;
      }
      case 'break':
        this.bubble(a, 'coffee', 2);
        break;
      case 'meet':
        this.bubble(a, 'wave', 1.2);
        break;
      case 'work':
        if (next === 'working') this.bubble(a, 'idea', 1);
        break;
    }
  }

  private setState(a: VisualAgent, s: AgentState) {
    if (a.state === s) return;
    const from = a.state;
    a.state = s;
    a.stateTime = 0;
    if (s !== 'walking' && s !== 'interacting') a.partner = s === 'on_break' ? a.partner : null;
    this.bus.emit('agent.state.changed', { agentId: a.id, from, to: s });
  }

  private bubble(a: VisualAgent, kind: BubbleKind, secs: number) {
    a.bubble = { kind, until: this.time + secs };
  }

  /** A walkable tile next to `b`, nearest to `from`. */
  private besideTile(b: VisualAgent, from: VisualAgent) {
    const bx = Math.floor(b.x);
    const by = Math.floor(b.y);
    const opts = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
    ]
      .map(([dx, dy]) => ({ x: bx + dx, y: by + dy }))
      .filter((t) => this.grid.walkable(t.x, t.y));
    opts.sort((p, q) => dist(from, { x: p.x + 0.5, y: p.y + 0.5 }) - dist(from, { x: q.x + 0.5, y: q.y + 0.5 }));
    return opts[0] ?? { x: Math.floor(from.x), y: Math.floor(from.y) };
  }

  /** Debug: send an agent somewhere without touching the runtime. */
  goto(id: string, where: { pointId?: string; tile?: { x: number; y: number } }) {
    const a = this.get(id);
    if (!a) return;
    const p = this.point(where.pointId);
    if (p) this.walkTo(a, { purpose: 'goto', pointId: p.id, label: p.label, x: p.x, y: p.y, facing: p.facing, arrive: a.state === 'walking' ? 'idle' : a.state });
    else if (where.tile && this.grid.walkable(where.tile.x, where.tile.y))
      this.walkTo(a, { purpose: 'goto', label: `tile ${where.tile.x},${where.tile.y}`, x: where.tile.x + 0.5, y: where.tile.y + 0.5, facing: a.facing, arrive: 'idle' });
  }

  // ── tick ───────────────────────────────────────────────────
  update(dt: number) {
    this.time += dt;
    for (const a of [...this.agents]) this.updateAgent(a, dt);
    this.effects = this.effects.filter((e) => (e.t += dt) < 1.2);
  }

  private updateAgent(a: VisualAgent, dt: number) {
    if (a.spawnIn > 0) {
      a.spawnIn -= dt;
      if (a.spawnIn <= 0) {
        this.effects.push({ kind: 'puff', x: a.x, y: a.y, t: 0, color: '#ffffff' });
        this.bubble(a, 'wave', 1.5);
        if (a.runtime === 'idle') this.wander(a, 'enter');
      }
      return;
    }
    a.anim += dt;
    a.stateTime += dt;
    if (a.bubble && a.bubble.until < this.time) a.bubble = null;
    if (this.time > a.nextBlink) {
      a.blinkUntil = this.time + 0.14;
      a.nextBlink = this.time + this.rng.range(2, 5);
    }
    switch (a.state) {
      case 'walking':
        this.walk(a, dt);
        break;
      case 'working':
        if (a.researching && !a.bubble && this.rng.chance(dt * 0.7)) this.bubble(a, 'search', 2.2);
        else if (a.task && this.rng.chance(dt * 0.04)) this.bubble(a, 'idea', 1);
        break;
      case 'waiting':
        if (a.waitingFor === 'station' && a.runtime === 'working' && a.stateTime > 1 && a.task) {
          a.stateTime = 0;
          if (this.claimStation(a)) this.toWork(a, a.task);
        }
        break;
      case 'on_break':
        if (a.stateTime > 1.5 && this.rng.chance(dt * 0.35)) this.findChatPartner(a);
        else if (a.stateTime > 10 && this.rng.chance(dt * 0.08)) this.goToSpot(a, BREAK_TYPES, 'break', 'on_break');
        break;
      case 'interacting':
        if (a.target?.purpose === 'chat' || (a.partner && a.runtime !== 'meeting')) {
          if (this.rng.chance(dt * 0.6)) this.bubble(a, this.rng.chance(0.85) ? 'chat' : 'heart', 1.1);
          if (this.time > a.chatUntil && a.awaitsColleague) {
            a.partner = null;
            a.target = null;
            this.setState(a, 'waiting');
            a.activity = `Waiting for ${a.awaitsColleague}`;
          } else if (this.time > a.chatUntil) {
            const back = a.runtime === 'break' ? 'on_break' : 'idle';
            a.partner = null;
            a.target = null;
            this.setState(a, back);
            a.activity = back === 'on_break' ? 'On break' : 'Idle';
            a.nextIdle = this.time + this.rng.range(2, 4);
          }
        } else if (this.rng.chance(dt * 0.5)) this.bubble(a, 'chat', 1.1);
        break;
      case 'idle':
        if (a.runtime === 'idle' && this.time > a.nextIdle) this.idleBehaviour(a);
        break;
    }
  }

  private walk(a: VisualAgent, dt: number) {
    let budget = SPEED * dt;
    while (budget > 0 && a.path.length) {
      const wp = a.path[0];
      const dx = wp.x - a.x;
      const dy = wp.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) a.facing = faceDir(dx, dy);
      if (d <= budget) {
        a.x = wp.x;
        a.y = wp.y;
        a.path.shift();
        budget -= d;
      } else {
        a.x += (dx / d) * budget;
        a.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (!a.path.length) this.arrive(a);
  }

  // ── cozy idle behaviour ────────────────────────────────────
  private idleBehaviour(a: VisualAgent) {
    const r = this.rng.next();
    a.nextIdle = this.time + this.rng.range(3, 7);
    if (r < 0.22) {
      // look around
      a.facing = this.rng.pick(['ne', 'nw', 'se', 'sw'] as Facing[]);
      a.activity = 'Looking around';
    } else if (r < 0.45) this.wander(a, 'wander');
    else if (r < 0.57) this.goToSpot(a, ['COFFEE'], 'coffee', 'idle');
    else if (r < 0.7) this.goToSpot(a, ['LOUNGE'], 'sit', 'idle');
    else if (r < 0.84) this.goToSpot(a, OBSERVE_TYPES, 'observe', 'idle');
    else {
      const b = this.agents.find((x) => x !== a && x.state === 'idle' && x.runtime === 'idle' && !x.partner && x.spawnIn <= 0);
      if (!b) return this.wander(a, 'wander');
      const t = this.besideTile(b, a);
      this.walkTo(a, { purpose: 'chat', label: b.look.name, x: t.x + 0.5, y: t.y + 0.5, facing: faceToward(t.x + 0.5, t.y + 0.5, b.x, b.y), arrive: 'interacting', partner: b.id });
    }
  }

  private wander(a: VisualAgent, purpose: 'wander' | 'enter') {
    const t = this.grid.randomNear(a.x, a.y, purpose === 'enter' ? 5 : 3, () => this.rng.next());
    if (!t) return;
    this.walkTo(a, { purpose, label: 'a stroll', x: t.x + 0.5, y: t.y + 0.5, facing: this.rng.pick(['sw', 'se'] as Facing[]), arrive: 'idle' });
  }

  private findChatPartner(a: VisualAgent) {
    if (a.partner) return;
    const b = this.agents.find((x) => x !== a && x.state === 'on_break' && !x.partner && Math.hypot(x.x - a.x, x.y - a.y) < 2.6);
    if (!b) return;
    a.partner = b.id;
    b.partner = a.id;
    a.chatUntil = b.chatUntil = this.time + this.rng.range(4, 7);
    for (const [p, q] of [[a, b], [b, a]] as const) {
      if (!p.sitting) p.facing = faceToward(p.x, p.y, q.x, q.y);
      p.target = { purpose: 'chat', label: q.look.name, x: p.x, y: p.y, facing: p.facing, arrive: 'interacting', partner: q.id };
      this.setState(p, 'interacting');
      p.activity = `Chatting with ${q.look.name}`;
    }
  }
}

export function faceDir(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'se' : 'nw';
  return dy > 0 ? 'sw' : 'ne';
}

export function faceToward(x: number, y: number, tx: number, ty: number): Facing {
  return faceDir(tx - x, ty - y);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ─────────────────────────────────────────────────────────────
// MockRuntime — deterministic fake agent runtime.
// Owns statuses and tasks; publishes runtime events on the bus.
// It knows nothing about tiles, sprites or animations.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { AgentState, RuntimeStatus, SimCommand, Task } from '../domain/sim';
import type { AgentRuntime } from './types';

interface Slot {
  status: RuntimeStatus;
  task: Task | null;
  /** status to return to after a timed state (waiting / delegation) */
  resumeTo: RuntimeStatus | null;
  timer: number; // generic countdown (s)
  nextTaskIn: number;
  doneSinceBreak: number;
  pendingDelegation?: { to: string; title: string };
}

export class MockRuntime implements AgentRuntime {
  readonly kind = 'mock' as const;
  autopilot = false;
  failureRate = 0;
  private slots = new Map<string, Slot>();
  private seq = 0;

  constructor(
    private bus: EventBus,
    private tasks: string[],
    private rng: Rng,
  ) {}

  attach(ids: string[]) {
    for (const id of ids)
      if (!this.slots.has(id))
        this.slots.set(id, { status: 'idle', task: null, resumeTo: null, timer: 0, nextTaskIn: 0, doneSinceBreak: 0 });
  }
  detach(id: string) {
    this.slots.delete(id);
  }
  status(id: string): RuntimeStatus {
    return this.slots.get(id)?.status ?? 'idle';
  }
  task(id: string) {
    return this.slots.get(id)?.task ?? null;
  }
  ids() {
    return [...this.slots.keys()];
  }

  reset() {
    for (const s of this.slots.values()) Object.assign(s, { status: 'idle', task: null, resumeTo: null, timer: 0, nextTaskIn: 0, doneSinceBreak: 0 });
  }

  // ── control plane ──────────────────────────────────────────
  dispatch(cmd: SimCommand) {
    const ids = cmd.targets?.length ? cmd.targets.filter((t) => this.slots.has(t)) : this.ids();
    switch (cmd.type) {
      case 'startWork':
      case 'resume':
        ids.forEach((id) => this.work(id));
        break;
      case 'assign':
        ids.forEach((id) => this.work(id, cmd.task ?? this.pickTask(), true));
        break;
      case 'pause':
        ids.forEach((id) => this.set(id, 'paused'));
        break;
      case 'break':
        ids.forEach((id) => this.set(id, 'break'));
        break;
      case 'idle':
        ids.forEach((id) => this.set(id, 'idle'));
        break;
      case 'huddle':
        ids.forEach((id) => {
          const s = this.slots.get(id)!;
          s.resumeTo = s.status === 'working' || s.task ? 'working' : 'idle';
          s.timer = this.rng.range(10, 15);
          this.set(id, 'meeting');
        });
        break;
      case 'delegate': {
        const from = ids[0];
        if (!from || !cmd.to || !this.slots.has(cmd.to) || from === cmd.to) break;
        const s = this.slots.get(from)!;
        s.resumeTo = s.status === 'working' ? 'working' : 'idle';
        s.timer = 4.5;
        s.pendingDelegation = { to: cmd.to, title: cmd.task ?? this.pickTask() };
        s.status = 'meeting';
        this.bus.emit('agent.delegation', { from, to: cmd.to, title: s.pendingDelegation.title });
        break;
      }
      case 'randomize':
        ids.forEach((id) => {
          const r = this.rng.next();
          if (r < 0.45) this.work(id);
          else if (r < 0.7) this.set(id, 'break');
          else if (r < 0.88) this.set(id, 'idle');
          else if (r < 0.95) {
            this.work(id);
            this.wait(id, 'waiting for approval');
          } else this.fail(id, 'simulated tool error');
        });
        break;
      case 'forceState':
        ids.forEach((id) => this.force(id, cmd.state ?? 'idle'));
        break;
      case 'reset':
        this.reset();
        break;
      case 'goto':
        break; // purely visual (debug)
    }
  }

  private pickTask() {
    const busy = new Set([...this.slots.values()].map((s) => s.task?.title));
    const free = this.tasks.filter((t) => !busy.has(t));
    return this.rng.pick(free.length ? free : this.tasks);
  }

  private newTask(title: string, from?: string): Task {
    return { id: `t${++this.seq}`, title, progress: 0, duration: this.rng.range(14, 30), from };
  }

  private work(id: string, title?: string, fresh = false, from?: string) {
    const s = this.slots.get(id);
    if (!s) return;
    const resumed = !!s.task && !fresh;
    if (!s.task || fresh) s.task = this.newTask(title ?? this.pickTask(), from);
    s.status = 'working';
    s.resumeTo = null;
    this.bus.emit('agent.work.started', { agentId: id, task: s.task, resumed });
  }

  private set(id: string, status: RuntimeStatus) {
    const s = this.slots.get(id);
    if (!s) return;
    s.status = status;
    s.resumeTo = status === 'meeting' ? s.resumeTo : null;
    if (status === 'idle') s.task = null;
    if (status === 'break') {
      s.doneSinceBreak = 0;
      s.timer = this.rng.range(12, 22);
      this.bus.emit('agent.break.started', { agentId: id });
    } else if (status === 'paused') this.bus.emit('agent.paused', { agentId: id });
    else if (status === 'idle') {
      s.timer = this.rng.range(3, 6);
      this.bus.emit('agent.idle', { agentId: id });
    } else if (status === 'meeting') this.bus.emit('agent.meeting.started', { agentId: id });
  }

  private wait(id: string, reason: string) {
    const s = this.slots.get(id)!;
    s.status = 'waiting';
    s.resumeTo = 'working';
    s.timer = this.rng.range(3, 6);
    this.bus.emit('agent.waiting', { agentId: id, reason });
  }

  private fail(id: string, error: string) {
    const s = this.slots.get(id)!;
    if (!s.task) s.task = this.newTask(this.pickTask());
    s.status = 'error';
    this.bus.emit('agent.work.failed', { agentId: id, task: s.task, error });
  }

  private force(id: string, state: AgentState) {
    switch (state) {
      case 'working':
      case 'walking':
        return this.work(id);
      case 'on_break':
        return this.set(id, 'break');
      case 'paused':
        return this.set(id, 'paused');
      case 'waiting':
        this.work(id);
        return this.wait(id, 'forced from debug panel');
      case 'error':
        return this.fail(id, 'forced from debug panel');
      case 'interacting':
        return this.dispatch({ type: 'huddle', targets: [id] });
      default:
        return this.set(id, 'idle');
    }
  }

  // ── time ───────────────────────────────────────────────────
  tick(dt: number) {
    for (const [id, s] of this.slots) {
      switch (s.status) {
        case 'working':
          if (s.task) {
            s.task.progress += dt / s.task.duration;
            if (s.task.progress > 0.15 && s.task.progress < 0.9 && this.rng.chance(dt * 0.006)) this.wait(id, 'waiting for approval');
            else if (this.failureRate > 0 && s.task.progress > 0.5 && this.rng.chance(dt * this.failureRate * 0.2)) this.fail(id, 'simulated tool error');
            else if (s.task.progress >= 1) {
              const done = s.task;
              done.progress = 1;
              s.task = null;
              s.doneSinceBreak++;
              s.nextTaskIn = this.rng.range(1.2, 2.4);
              this.bus.emit('agent.work.completed', { agentId: id, task: done });
            }
          } else {
            s.nextTaskIn -= dt;
            if (s.nextTaskIn <= 0) {
              if (this.autopilot && s.doneSinceBreak >= 2 && this.rng.chance(0.6)) this.set(id, 'break');
              else this.work(id);
            }
          }
          break;
        case 'waiting':
          s.timer -= dt;
          if (s.timer <= 0) this.work(id);
          break;
        case 'meeting':
          s.timer -= dt;
          if (s.timer <= 0) {
            const d = s.pendingDelegation;
            s.pendingDelegation = undefined;
            if (d && this.slots.has(d.to)) this.work(d.to, d.title, true, id);
            if (s.resumeTo === 'working') this.work(id);
            else this.set(id, 'idle');
          }
          break;
        case 'break':
          s.timer -= dt;
          if (this.autopilot && s.timer <= 0) this.work(id);
          break;
        case 'idle':
          s.timer -= dt;
          if (this.autopilot && s.timer <= 0) this.work(id);
          break;
      }
    }
  }
}

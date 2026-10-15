// The SCHEDULER (docs/WORKFLOWS.md): WHEN a run starts — once at a time, every N minutes, every
// day or chosen weekdays at a time, or a 5-field cron expression. It never executes anything: when
// a schedule is due it only CREATES a WorkflowRun and hands it to the orchestrator.
//
// RealmNest is a desktop app: while it is closed nothing fires. On start, the times missed since
// the last firing are counted and handled by the schedule's catch-up policy (once · skip · all),
// and the miss is reported.
//
// The new nextAt is saved BEFORE the run is created, so a crash in between can only lose a firing,
// never repeat one; the orchestrator also refuses a second run for the same (schedule, due time)
// and skips a firing while the schedule's previous run is still open (docs/HARDENING.md R-13).

import { WORKFLOW_LIMITS, type Schedule, type ScheduleTrigger, type WorkflowDefinition, type WorkflowRun, type WorkflowTrigger } from '../../domain/workflow';
import type { StorageAdapter } from '../../persistence/storage';
import { WorkflowError } from './library';

const KEY = 'workflow-schedules';
const TICK_MS = 30_000;
const MINUTE = 60_000;

// ── time arithmetic (local time, minute precision) ──────────
const hm = (time: string): [number, number] | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? [h, min] : undefined;
};

/** one cron field: *, n, a-b, lists, steps (* /n, a-b/n) */
function cronField(f: string, min: number, max: number): Set<number> | undefined {
  const out = new Set<number>();
  for (const part of f.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim());
    if (!m) return undefined;
    let [a, b] = m[1] === '*' ? [min, max] : m[1].split('-').map(Number).concat([]);
    if (b === undefined) b = m[2] ? max : a;
    const step = m[2] ? Number(m[2]) : 1;
    if (a < min || b > max || a > b || step < 1) return undefined;
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}

/** a cron expression as sets; undefined when it is not valid */
export function parseCron(expr: string) {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return undefined;
  const [mi, h, dom, mon, dow] = [cronField(f[0], 0, 59), cronField(f[1], 0, 23), cronField(f[2], 1, 31), cronField(f[3], 1, 12), cronField(f[4], 0, 7)];
  if (!mi || !h || !dom || !mon || !dow) return undefined;
  if (dow.has(7)) dow.add(0);
  return { mi, h, dom, mon, dow, anyDom: f[2] === '*', anyDow: f[4] === '*' };
}

/** the first time strictly after `after` (ms) the trigger fires; undefined: never again */
export function nextTime(t: ScheduleTrigger, after: number, anchor?: number): number | undefined {
  switch (t.kind) {
    case 'once':
      return t.at > after ? t.at : undefined;
    case 'interval': {
      const every = Math.max(1, t.everyMinutes) * MINUTE;
      const base = anchor ?? after;
      if (base > after) return base;
      return base + Math.floor((after - base) / every + 1) * every;
    }
    case 'daily':
    case 'weekly': {
      const at = hm(t.time);
      if (!at) return undefined;
      const days = t.kind === 'weekly' ? new Set(t.days) : undefined;
      if (days && !days.size) return undefined;
      const d = new Date(after);
      d.setSeconds(0, 0);
      d.setHours(at[0], at[1]);
      for (let i = 0; i < 8; i++) {
        if (d.getTime() > after && (!days || days.has(d.getDay()))) return d.getTime();
        d.setDate(d.getDate() + 1);
        d.setHours(at[0], at[1], 0, 0);
      }
      return undefined;
    }
    case 'cron': {
      const c = parseCron(t.expr);
      if (!c) return undefined;
      const d = new Date(after);
      d.setSeconds(0, 0);
      d.setMinutes(d.getMinutes() + 1);
      // a year at most, skipping whole days and hours that cannot match
      for (let guard = 0; guard < 366 * 24 * 60; guard++) {
        const dayOk = (c.anyDom && c.anyDow) || (c.anyDom ? c.dow.has(d.getDay()) : c.anyDow ? c.dom.has(d.getDate()) : c.dom.has(d.getDate()) || c.dow.has(d.getDay()));
        if (!c.mon.has(d.getMonth() + 1) || !dayOk) {
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
          continue;
        }
        if (!c.h.has(d.getHours())) {
          d.setHours(d.getHours() + 1, 0, 0, 0);
          continue;
        }
        if (c.mi.has(d.getMinutes())) return d.getTime();
        d.setMinutes(d.getMinutes() + 1);
      }
      return undefined;
    }
  }
}

/** the times it was due in (from, to] — at most `cap` */
export function dueTimes(t: ScheduleTrigger, from: number, to: number, anchor?: number, cap = 1000): number[] {
  const out: number[] = [];
  let at = nextTime(t, from, anchor);
  while (at !== undefined && at <= to && out.length < cap) {
    out.push(at);
    at = nextTime(t, at, anchor);
  }
  return out;
}

/** what is wrong with a trigger (wf.err.trigger.<key> in the UI) */
export const TRIGGER_PROBLEMS = {
  at: 'Choose a date and time.',
  every: 'Every how many minutes?',
  time: 'The time is HH:MM.',
  days: 'Choose at least one day.',
  cron: 'Not a valid cron expression (minute hour day month weekday).',
};

export function checkTrigger(t: ScheduleTrigger): keyof typeof TRIGGER_PROBLEMS | undefined {
  if (t.kind === 'once') return Number.isFinite(t.at) ? undefined : 'at';
  if (t.kind === 'interval') return t.everyMinutes >= 1 ? undefined : 'every';
  if (t.kind === 'daily') return hm(t.time) ? undefined : 'time';
  if (t.kind === 'weekly') return !hm(t.time) ? 'time' : t.days.length ? undefined : 'days';
  return parseCron(t.expr) ? undefined : 'cron';
}

export interface SchedulerDeps {
  definition: (workflowId: string) => WorkflowDefinition | undefined;
  /** the only thing the scheduler does when something is due */
  createRun: (definition: WorkflowDefinition, inputs: Record<string, string>, trigger: WorkflowTrigger) => WorkflowRun;
  now?: () => number;
}

export class Scheduler {
  private list: Schedule[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;
  /** the last error per schedule (a workflow gone, inputs missing) */
  errors = new Map<string, string>();

  constructor(
    private storage: StorageAdapter,
    private deps: SchedulerDeps,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private now = () => (this.deps.now ?? Date.now)();

  /** load; what was missed while closed is handled by each schedule's catch-up policy */
  async init() {
    const s = await this.storage.get<{ version: 1; schedules: Schedule[] }>(KEY);
    this.list = s?.schedules ?? [];
    const t = this.now();
    const due: { sc: Schedule; times: number[]; missed: number }[] = [];
    for (const sc of this.list) {
      if (!sc.enabled || sc.nextAt === undefined || sc.nextAt > t) continue;
      const missed = [sc.nextAt, ...dueTimes(sc.trigger, sc.nextAt, t, this.anchor(sc))];
      due.push({ sc, times: sc.catchUp === 'once' ? [missed.at(-1)!] : sc.catchUp === 'all' ? missed.slice(-WORKFLOW_LIMITS.catchUpAll) : [], missed: missed.length });
      sc.missed = { count: missed.length, at: missed.at(-1)!, created: 0 };
      sc.lastFiredAt = missed.at(-1);
      sc.nextAt = nextTime(sc.trigger, t, this.anchor(sc));
      // a one-time schedule is done once its time has been handled, as when it fires while open
      if (sc.trigger.kind === 'once') sc.enabled = false;
    }
    // the next times are on disk first; then the catch-up runs
    if (due.length) await this.save();
    for (const d of due) for (const at of d.times) d.sc.missed!.created += this.fire(d.sc, at, { kind: 'catchup', missed: d.missed }) ? 1 : 0;
    void this.save();
    this.interval = setInterval(() => void this.tick(), TICK_MS);
    this.arm();
  }
  dispose() {
    clearTimeout(this.timer);
    clearInterval(this.interval);
  }

  all(): Schedule[] {
    return [...this.list];
  }
  get(id: string) {
    return this.list.find((s) => s.id === id);
  }
  /** schedules with a miss the user has not seen */
  missedUnseen(): Schedule[] {
    return this.list.filter((s) => s.missed);
  }

  private anchor(s: Schedule) {
    return s.trigger.kind === 'interval' ? (s.lastFiredAt ?? s.createdAt) : undefined;
  }

  create(input: Pick<Schedule, 'name' | 'workflowId' | 'inputs' | 'trigger' | 'enabled' | 'catchUp'>): Schedule {
    if (this.list.length >= WORKFLOW_LIMITS.schedules) throw new WorkflowError(`At most ${WORKFLOW_LIMITS.schedules} schedules.`, 'scTooMany', { n: String(WORKFLOW_LIMITS.schedules) });
    const clean = this.clean(input);
    const t = this.now();
    const s: Schedule = { ...clean, id: `sch-${t.toString(36)}-${(++this.counter).toString(36)}`, createdAt: t, updatedAt: t };
    s.nextAt = s.enabled ? nextTime(s.trigger, t, this.anchor(s)) : undefined;
    this.list.push(s);
    void this.save();
    this.arm();
    return s;
  }
  update(id: string, input: Pick<Schedule, 'name' | 'workflowId' | 'inputs' | 'trigger' | 'enabled' | 'catchUp'>): Schedule {
    const i = this.list.findIndex((s) => s.id === id);
    if (i < 0) throw new WorkflowError('Unknown schedule.');
    const s: Schedule = { ...this.list[i], ...this.clean(input), updatedAt: this.now() };
    s.nextAt = s.enabled ? nextTime(s.trigger, this.now(), this.anchor(s)) : undefined;
    this.list[i] = s;
    this.errors.delete(id);
    void this.save();
    this.arm();
    return s;
  }
  remove(id: string) {
    this.list = this.list.filter((s) => s.id !== id);
    void this.save();
    this.arm();
  }
  seenMissed(id: string) {
    const s = this.get(id);
    if (!s?.missed) return;
    delete s.missed;
    void this.save();
  }
  /** a run now, as the schedule would make it (it still only creates the run) */
  runNow(id: string): WorkflowRun | undefined {
    const s = this.get(id);
    if (!s) throw new WorkflowError('Unknown schedule.');
    return this.fire(s, this.now(), { kind: 'schedule', byUser: true });
  }

  private clean(input: Pick<Schedule, 'name' | 'workflowId' | 'inputs' | 'trigger' | 'enabled' | 'catchUp'>) {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new WorkflowError('Give the schedule a name.', 'scName');
    if (!this.deps.definition(input.workflowId)) throw new WorkflowError('Choose a workflow.', 'scWorkflow');
    const bad = checkTrigger(input.trigger);
    if (bad) throw new WorkflowError(TRIGGER_PROBLEMS[bad], `trigger.${bad}`);
    return { name, workflowId: input.workflowId, inputs: input.inputs ?? {}, trigger: input.trigger, enabled: !!input.enabled, catchUp: input.catchUp ?? 'once' };
  }

  /** due: create the run (nothing else) */
  private fire(s: Schedule, dueAt: number, trigger: Pick<WorkflowTrigger, 'kind' | 'missed' | 'byUser'>): WorkflowRun | undefined {
    const def = this.deps.definition(s.workflowId);
    if (!def) {
      this.errors.set(s.id, 'The workflow no longer exists.');
      return undefined;
    }
    try {
      const run = this.deps.createRun(def, s.inputs, { ...trigger, scheduleId: s.id, dueAt });
      this.errors.delete(s.id);
      return run;
    } catch (e) {
      // already created for this time (a restart in between): nothing to report
      if (e instanceof WorkflowError && e.key === 'duplicate') return undefined;
      // a full run list, or the previous run still open ("skipped: previous run still running"): recorded, not fired
      this.errors.set(s.id, e instanceof Error ? e.message : String(e));
      this.version++;
      for (const l of this.listeners) l();
      return undefined;
    }
  }

  /** whatever is due now fires once; the next time is computed from now and saved before the runs are made */
  async tick() {
    const t = this.now();
    const due: { s: Schedule; at: number }[] = [];
    for (const s of this.list) {
      if (!s.enabled || s.nextAt === undefined || s.nextAt > t) continue;
      due.push({ s, at: s.nextAt });
      s.lastFiredAt = s.nextAt;
      s.nextAt = nextTime(s.trigger, t, this.anchor(s));
      if (s.nextAt === undefined && s.trigger.kind === 'once') s.enabled = false;
    }
    this.arm();
    if (!due.length) return;
    await this.save();
    for (const d of due) this.fire(d.s, d.at, { kind: 'schedule' });
  }

  private arm() {
    clearTimeout(this.timer);
    const next = Math.min(...this.list.filter((s) => s.enabled && s.nextAt !== undefined).map((s) => s.nextAt!));
    if (!Number.isFinite(next)) return;
    this.timer = setTimeout(() => void this.tick(), Math.max(50, Math.min(next - this.now(), 2 ** 31 - 1)));
  }

  private save(): Promise<void> {
    this.version++;
    for (const l of this.listeners) l();
    return this.storage.set(KEY, { version: 1, schedules: this.list }).catch((e) => console.error('[scheduler] could not save the schedules', e));
  }

}

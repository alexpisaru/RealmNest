// The Crew engine (docs/CREW.md). Crews are saved definitions; a run pursues one goal:
//
//   planning ─▶ awaiting_plan ─(user approves)─▶ running ─▶ assembling ─▶ awaiting_approval ─▶ done
//                                                   │ tasks: waiting → running → (review) → done
//                                                   │        failed → its dependents blocked
//
// Every step an agent does — the coordinator's plan, a task, a review, the final assembly — is an
// ordinary agent task (LiveRuntime) marked with the crew, so it runs with that agent's own
// instructions, Skills, Knowledge, Memory, Web and connection, shows in its panel and in the world.
// The engine listens to the runs ending and moves the graph on. Outputs become Artifacts.

import type { EventBus } from '../../core/events';
import type { AgentRun, AgentTask } from '../../domain/agent';
import type { AttachmentInput } from '../../domain/attachment';
import { blockedQuestion, CREW_LIMITS, crewRevision, isEndedCrewRun, isLiveCrewRun, listItems, topoOrder, type Crew, type CrewEvent, type CrewItem, type CrewMember, type CrewRun, type CrewTask } from '../../domain/crew';
import { onFlushAll } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';
import type { LiveRuntime } from '../live/liveRuntime';
import { parseJsonObject } from '../research/json';
import { assemblePrompt, PLAN_SYSTEM, planUser, reviewPrompt, taskPrompt, type UserFact } from './prompts';

const CREWS = 'crews';
const INDEX = 'crew-runs';
const runKey = (id: string) => `crew-run.${id}`;

export class CrewError extends Error {}

/** why a task waits: English for logs, a key for the UI */
function note(t: CrewTask, english: string, key: string, vars: Record<string, string> = {}) {
  t.note = english;
  t.noteKey = key;
  t.noteVars = vars;
}

export interface CrewTemplate {
  id: string;
  name: string;
  goal: string;
  roles: { role: string; duty: string; reviewer?: boolean }[];
  brief?: string;
}

export const CREW_TEMPLATES: CrewTemplate[] = [
  {
    id: 'launch',
    name: 'Product launch',
    goal: 'Prepara il lancio del prodotto',
    roles: [
      { role: 'Research', duty: 'competitor e mercato' },
      { role: 'Copy', duty: 'messaggi, testi, landing' },
      { role: 'Design', duty: 'brief degli asset visivi' },
      { role: 'Review', duty: 'controlla qualità e coerenza', reviewer: true },
    ],
  },
  {
    id: 'article',
    name: 'Article',
    goal: "Scrivi un articolo approfondito sull'argomento",
    roles: [
      { role: 'Research', duty: 'fonti, dati, esempi' },
      { role: 'Writing', duty: 'struttura e testo' },
      { role: 'Editing', duty: 'revisione e stile', reviewer: true },
    ],
  },
  {
    id: 'analysis',
    name: 'Analysis',
    goal: 'Analizza la situazione e proponi decisioni',
    roles: [
      { role: 'Data', duty: 'raccoglie e ordina i dati' },
      { role: 'Analysis', duty: 'interpreta, confronta, conclude' },
      { role: 'Review', duty: 'verifica ragionamento e numeri', reviewer: true },
    ],
  },
];

export interface CrewServiceOptions {
  /** name of an agent (its Character) */
  name: (agentId: string) => string | undefined;
  /** the world an agent lives in */
  worldOf: (agentId: string) => string | undefined;
  /** keeps an output as an Artifact; its id */
  keep?: (o: { name: string; text: string; runId: string; agentId?: string; agentRunId?: string; agentTaskId?: string }) => Promise<string | undefined>;
  now?: () => number;
  newId?: () => string;
  /** how long the crew meets before work starts (ms; 0 in tests) */
  kickoffMs?: number;
}

type Link = { runId: string; taskId?: string; kind: 'plan' | 'work' | 'revision' | 'review' | 'assemble'; /** an item of a "for each" task */ itemId?: string };

/** how much of a task's output the tasks after it (and the assembly) get: a "for each" task carries all its items */
const handoff = (t: CrewTask) => (t.output ?? '').slice(0, t.forEach ? CREW_LIMITS.handoffChars * 3 : CREW_LIMITS.handoffChars);

export class CrewService {
  private crews: Crew[] = [];
  private runs = new Map<string, CrewRun>();
  private order: string[] = [];
  /** agent run id → what it was for */
  private links = new Map<string, Link>();
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // delayed saves are written when the window closes (docs/HARDENING.md D-8)
  readonly stopFlush = onFlushAll(() => this.flushSaves());

  constructor(
    private storage: StorageAdapter,
    private bus: EventBus,
    private live: LiveRuntime,
    private opts: CrewServiceOptions,
  ) {}

  /** write every delayed save now */
  async flushSaves() {
    for (const id of [...this.saveTimers.keys()]) {
      clearTimeout(this.saveTimers.get(id));
      this.saveTimers.delete(id);
      const r = this.runs.get(id);
      if (r) await this.storage.set(runKey(id), r);
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private now = () => (this.opts.now ?? Date.now)();
  private id = (k: string) => (this.opts.newId ? this.opts.newId() : `${k}-${this.now().toString(36)}-${(++this.counter).toString(36)}`);
  private nameOf = (agentId: string | undefined) => (agentId && this.opts.name(agentId)) || agentId || '?';

  async init() {
    const saved = await this.storage.get<{ version: 1; crews: Crew[] }>(CREWS);
    this.crews = saved?.crews ?? [];
    const ids = (await this.storage.get<string[]>(INDEX)) ?? [];
    for (const id of ids) {
      const r = await this.storage.get<CrewRun>(runKey(id));
      if (!r) continue;
      // work that was going on when RealmNest closed: it can resume
      if (isLiveCrewRun(r.status)) {
        r.status = 'interrupted';
        for (const t of r.plan) {
          // a "for each" task keeps its finished items; the running ones wait again
          if (t.items) for (const i of t.items) if (i.status === 'running') i.status = 'waiting';
          if (t.items && t.status === 'running') continue;
          if (t.status === 'running' || t.status === 'review') ((t.status = 'waiting'), note(t, 'interrupted', 'interrupted'));
        }
      }
      this.runs.set(id, r);
      this.order.push(id);
    }
    // after the runtime has set the agent free (the event comes just before): then the next task can start
    for (const ev of ['agent.run.completed', 'agent.run.failed', 'agent.run.cancelled'] as const) this.bus.on(ev, (p: { runId: string }) => queueMicrotask(() => this.onAgentRun(p.runId)));
    // an agent got free: crew work waiting for it can start
    this.bus.on('agent.idle', () => this.pumpAll());
    this.changed();
  }

  // ── crews ───────────────────────────────────────────────
  /** the shared files of every crew and of every run's snapshot (the file store must not collect them) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const files of [...this.crews.map((c) => c.files), ...[...this.runs.values()].map((r) => r.crew?.files)]) for (const f of files ?? []) if (f?.storageRef) out.add(f.storageRef);
    return out;
  }

  list(): Crew[] {
    return [...this.crews];
  }
  get(id: string): Crew | undefined {
    return this.crews.find((c) => c.id === id);
  }
  create(input: Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>): Crew {
    const c: Crew = { ...this.cleanCrew(input), id: this.id('crew'), createdAt: this.now(), updatedAt: this.now() };
    this.crews.push(c);
    this.saveCrews();
    return c;
  }
  update(id: string, patch: Partial<Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>>): Crew {
    const i = this.crews.findIndex((c) => c.id === id);
    if (i < 0) throw new CrewError('Unknown crew.');
    const next = { ...this.cleanCrew({ ...this.crews[i], ...patch }), id, createdAt: this.crews[i].createdAt, updatedAt: this.now() };
    this.crews[i] = next;
    this.saveCrews();
    return next;
  }
  remove(id: string) {
    this.crews = this.crews.filter((c) => c.id !== id);
    this.saveCrews();
  }

  /** a crew is valid: a name, a goal, members of one world, coordinator and reviewer among them */
  private cleanCrew(c: Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>): Omit<Crew, 'id' | 'createdAt' | 'updatedAt'> {
    const name = c.name.trim().slice(0, 80);
    if (!name) throw new CrewError('Give the crew a name.');
    const seen = new Set<string>();
    const members: CrewMember[] = c.members
      .filter((m) => m.agentId && !seen.has(m.agentId) && seen.add(m.agentId))
      .slice(0, CREW_LIMITS.members)
      .map((m) => ({ agentId: m.agentId, role: (m.role || 'Member').trim().slice(0, 40), ...(m.duty?.trim() && { duty: m.duty.trim().slice(0, 200) }) }));
    if (!members.length) throw new CrewError('Add at least one member.');
    for (const m of members) if (this.opts.worldOf(m.agentId) !== c.worldId) throw new CrewError(`${this.nameOf(m.agentId)} is not in this crew's world: a crew works in one world.`);
    if (!members.some((m) => m.agentId === c.coordinatorId)) throw new CrewError('The coordinator must be a member.');
    if (c.reviewerId && !members.some((m) => m.agentId === c.reviewerId)) throw new CrewError('The reviewer must be a member.');
    // the shared folder: a full path (the file tools check it again, natively, at every call)
    const workspace = c.workspace?.trim();
    if (workspace && (!/^([A-Za-z]:[\\/]|\\\\|\/)/.test(workspace) || workspace.length > 1024)) throw new CrewError('The shared folder must be a full path, for example D:\\Crews\\Launch.');
    return {
      name,
      worldId: c.worldId,
      goal: c.goal.trim().slice(0, 2000),
      coordinatorId: c.coordinatorId,
      ...(c.reviewerId && { reviewerId: c.reviewerId }),
      members,
      ...(c.brief?.trim() && { brief: c.brief.trim().slice(0, 8000) }),
      ...(c.files?.length && { files: c.files.slice(0, 4) }),
      ...(workspace && { workspace }),
      ...(c.templateId && { templateId: c.templateId }),
    };
  }

  // ── runs ────────────────────────────────────────────────
  runsOf(crewId?: string): CrewRun[] {
    return this.order.map((id) => this.runs.get(id)!).filter((r) => r && (!crewId || r.crewId === crewId));
  }
  run(id: string): CrewRun | undefined {
    return this.runs.get(id);
  }
  private require(id: string) {
    const r = this.runs.get(id);
    if (!r) throw new CrewError('Unknown crew run.');
    return r;
  }

  /** a new run: the coordinator plans the goal; the plan waits for the user */
  start(crewId: string, goal?: string): CrewRun {
    const crew = this.get(crewId);
    if (!crew) throw new CrewError('Unknown crew.');
    const text = (goal ?? crew.goal).trim();
    if (!text) throw new CrewError('Write the goal first.');
    // only ended runs make room: an open one is never dropped (docs/HARDENING.md R-7)
    const ended = (id: string) => {
      const r = this.runs.get(id);
      return !r || isEndedCrewRun(r.status);
    };
    if (this.order.length >= CREW_LIMITS.runs && !this.order.some(ended)) throw new CrewError(`There are already ${CREW_LIMITS.runs} crew runs open: stop or delete one first.`);
    const t = this.now();
    const run: CrewRun = {
      id: this.id('crun'),
      crewId,
      crew: { name: crew.name, worldId: crew.worldId, coordinatorId: crew.coordinatorId, ...(crew.reviewerId && { reviewerId: crew.reviewerId }), members: crew.members, ...(crew.brief && { brief: crew.brief }), ...(crew.files && { files: crew.files }), ...(crew.workspace && { workspace: crew.workspace }) },
      goal: text.slice(0, 2000),
      status: 'planning',
      plan: [],
      history: [],
      createdAt: t,
      updatedAt: t,
    };
    this.runs.set(run.id, run);
    this.order.unshift(run.id);
    for (let i = this.order.length - 1; i >= 0 && this.order.length > CREW_LIMITS.runs; i--) {
      if (!ended(this.order[i])) continue;
      const [gone] = this.order.splice(i, 1);
      this.runs.delete(gone);
      void this.storage.remove(runKey(gone));
    }
    void this.storage.set(INDEX, this.order);
    this.event(run, 'plan', `${this.nameOf(crew.coordinatorId)} is planning the work.`, crew.coordinatorId, undefined, ['planning', { name: this.nameOf(crew.coordinatorId) }]);
    this.plan(run);
    return run;
  }

  /** the coordinator writes the task graph (an agent task of theirs); waits if they are busy */
  private plan(run: CrewRun) {
    run.status = 'planning';
    const coord = run.crew.coordinatorId;
    if (this.live.activeRun(coord)) {
      this.note(run, `${this.nameOf(coord)} is busy: the plan starts when they are free.`, ['busyPlan', { name: this.nameOf(coord) }]);
      return this.touch(run);
    }
    const members = run.crew.members.map((m) => ({ name: this.nameOf(m.agentId), role: m.role, ...(m.duty && { duty: m.duty }) }));
    this.startAgent(run, coord, { kind: 'plan' }, `${PLAN_SYSTEM(CREW_LIMITS.tasks)}\n\n${planUser(run.goal, members, run.crew.brief, !!run.crew.workspace)}`, `Plan · ${run.crew.name}`);
  }

  /** the user's edits to the plan (before it starts) */
  setPlan(runId: string, tasks: Pick<CrewTask, 'id' | 'title' | 'assigneeId' | 'instructions' | 'dependsOn' | 'review' | 'deliverable' | 'forEach' | 'assignees'>[]) {
    const run = this.require(runId);
    if (run.status !== 'awaiting_plan') throw new CrewError('The plan can change only before the crew starts.');
    run.plan = this.cleanPlan(run, tasks);
    this.touch(run, true);
  }

  private cleanPlan(run: CrewRun, tasks: Pick<CrewTask, 'id' | 'title' | 'assigneeId' | 'instructions' | 'dependsOn' | 'review' | 'deliverable' | 'forEach' | 'assignees'>[]): CrewTask[] {
    const members = new Set(run.crew.members.map((m) => m.agentId));
    const ids = new Set(tasks.map((t) => String(t.id)));
    const list = tasks.slice(0, CREW_LIMITS.tasks).map((t): CrewTask => {
      const title = String(t.title ?? '').trim().slice(0, 120);
      if (!title) throw new CrewError('Every task needs a title.');
      if (!members.has(t.assigneeId)) throw new CrewError(`"${title}": choose a member of the crew.`);
      const id = String(t.id);
      // "for each": the list task must exist, and this task depends on it (added when missing)
      const forEach = t.forEach && t.forEach !== id && ids.has(String(t.forEach)) ? String(t.forEach) : undefined;
      if (t.forEach && !forEach) throw new CrewError(`"${title}": "for each" must name another task of the plan.`);
      const dependsOn = [...new Set([...(t.dependsOn ?? []).map(String), ...(forEach ? [forEach] : [])])];
      const assignees = forEach ? [...new Set((t.assignees ?? []).filter((a) => members.has(a) && a !== t.assigneeId))] : [];
      return {
        id,
        title,
        assigneeId: t.assigneeId,
        instructions: String(t.instructions ?? '').trim().slice(0, 4000) || title,
        ...(t.deliverable?.trim() && { deliverable: t.deliverable.trim().slice(0, 400) }),
        dependsOn,
        // a "for each" task's items are not reviewed one by one
        review: !!t.review && !!run.crew.reviewerId && !forEach,
        ...(forEach && { forEach }),
        ...(assignees.length && { assignees }),
        status: 'waiting' as const,
        attempts: [],
        revisions: 0,
      };
    });
    if (!list.length) throw new CrewError('The plan needs at least one task.');
    if (new Set(list.map((t) => t.id)).size !== list.length) throw new CrewError('Two tasks have the same id.');
    if (!topoOrder(list)) throw new CrewError('The dependencies make a loop (or name a task that does not exist).');
    return list;
  }

  /** the user starts the approved plan: kickoff in the world, then the work. `revision`: the plan
   *  the user saw (crewRevision); a different one now is refused */
  approvePlan(runId: string, revision?: string) {
    const run = this.require(runId);
    if (run.status !== 'awaiting_plan') throw new CrewError('There is no plan waiting.');
    if (!run.plan.length) throw new CrewError('The plan needs at least one task.');
    if (revision !== undefined && revision !== crewRevision(run, 'plan')) throw new CrewError('The plan changed: look at the new one first.');
    run.status = 'running';
    run.startedAt = this.now();
    this.event(run, 'approve', 'Plan approved: the crew starts.', undefined, undefined, ['approved', {}]);
    this.kickoff(run, () => this.pump(run));
    this.touch(run, true);
  }

  /** the crew meets at the meeting table, then gets to work */
  private kickoff(run: CrewRun, then: () => void) {
    const ms = this.opts.kickoffMs ?? 6000;
    const ids = run.crew.members.map((m) => m.agentId).filter((id) => !this.live.activeRun(id));
    this.event(run, 'kickoff', `Kickoff: ${ids.map((id) => this.nameOf(id)).join(', ')}.`, undefined, undefined, ['kickoff', { names: ids.map((id) => this.nameOf(id)).join(', ') }]);
    for (const id of ids) this.bus.emit('agent.meeting.started', { agentId: id });
    const end = () => {
      then();
      // whoever got no task leaves the table
      for (const id of ids) if (!this.live.activeRun(id)) this.bus.emit('agent.meeting.ended', { agentId: id });
    };
    if (ms <= 0) end();
    else setTimeout(end, ms);
  }

  /** move the graph on: block, start what can start, assemble when everything is done */
  private pump(run: CrewRun) {
    if (run.status !== 'running') return;
    const byId = new Map(run.plan.map((t) => [t.id, t]));
    const settled = (t: CrewTask) => t.status === 'done' || t.status === 'skipped';
    for (const t of run.plan) {
      if (t.status !== 'waiting' && t.status !== 'blocked') continue;
      const deps = t.dependsOn.map((d) => byId.get(d)!);
      const broken = deps.find((d) => d.status === 'failed' || d.status === 'blocked' || d.status === 'cancelled');
      if (broken) {
        if (t.status !== 'blocked') this.event(run, 'block', `${t.id} is blocked: ${broken.id} did not finish.`, undefined, t.id, ['blocked', { id: t.id, dep: broken.id }]);
        t.status = 'blocked';
        note(t, `${broken.id} did not finish`, 'notFinished', { id: broken.id });
        continue;
      }
      if (t.status === 'blocked') ((t.status = 'waiting'), delete t.note, delete t.noteKey, delete t.noteVars);
      if (!deps.every(settled)) {
        const ids = deps.filter((d) => !settled(d)).map((d) => d.id).join(', ');
        note(t, `waits for ${ids}`, 'waitsFor', { ids });
        continue;
      }
      // "for each": the list is there, the task becomes one item per entry
      if (t.forEach) {
        this.fanOut(run, t, byId.get(t.forEach));
        continue;
      }
      if (this.live.activeRun(t.assigneeId)) {
        note(t, `${this.nameOf(t.assigneeId)} is busy`, 'busy', { name: this.nameOf(t.assigneeId) });
        continue;
      }
      this.startWork(run, t, 'work');
    }
    // items of "for each" tasks, on whoever of their assignees is free
    for (const t of run.plan) if (t.status === 'running' && t.items) this.startItems(run, t);
    // reviews waiting for a free reviewer
    for (const t of run.plan) if (t.status === 'review' && !t.attempts.some((a) => a.kind === 'review' && this.pending(a.runId))) this.startReview(run, t);
    const asking = (t: CrewTask) => t.status === 'needs_input' || !!t.items?.some((i) => i.status === 'needs_input');
    const moving = (t: CrewTask) => t.status === 'review' || (t.status === 'running' && (!t.items || t.items.some((i) => i.status === 'running' || i.status === 'waiting'))) || (t.status === 'waiting' && t.dependsOn.every((d) => settled(byId.get(d)!)));
    if (run.plan.every(settled)) this.assemble(run);
    else if (run.plan.some(asking) && !run.plan.some(moving)) {
      // nothing can move until the user answers (what still waits depends on the question)
      const ids = run.plan.filter(asking).map((t) => t.id).join(', ');
      this.note(run, `The crew waits for your answer (${ids}).`, ['needsYou', { ids }]);
    } else if (run.plan.every((t) => settled(t) || t.status === 'failed' || t.status === 'blocked' || t.status === 'cancelled') && run.plan.some((t) => t.status === 'failed')) this.note(run, 'Some tasks failed: retry or skip them to go on.', ['someFailed', {}]);
    this.touch(run);
  }

  private pumpAll() {
    for (const r of this.runs.values()) {
      if (r.status === 'running') this.pump(r);
      else if (r.status === 'planning' && !this.planRunning(r)) this.plan(r);
      else if (r.status === 'assembling' && !this.pending(r.final?.runId)) this.assemble(r, r.final?.feedback);
    }
  }
  private planRunning = (r: CrewRun) => [...this.links.values()].some((l) => l.runId === r.id && l.kind === 'plan');
  /** an agent run of the crew still counts until its end has been handled */
  private pending = (agentRunId: string | undefined) => !!agentRunId && (this.links.has(agentRunId) || this.isLive(agentRunId));
  private isLive = (agentRunId: string | undefined) => {
    const r = agentRunId ? this.live.getRun(agentRunId) : undefined;
    return !!r && (r.status === 'starting' || r.status === 'running');
  };

  private startWork(run: CrewRun, t: CrewTask, kind: 'work' | 'revision', notes?: string) {
    const byId = new Map(run.plan.map((x) => [x.id, x]));
    const inputs = t.dependsOn
      .map((d) => byId.get(d)!)
      .filter((d) => d.status === 'done' && d.output)
      .map((d) => ({ title: d.title, by: this.nameOf(d.assigneeId), output: handoff(d) }));
    const member = run.crew.members.find((m) => m.agentId === t.assigneeId);
    const prompt = taskPrompt({ crew: run.crew.name, goal: run.goal, role: member?.role ?? 'member', ...(run.crew.brief && { brief: run.crew.brief }), task: t, inputs, ...(kind === 'revision' && t.output && { revision: { notes: notes ?? '', previous: t.output } }), facts: this.factsFor(run, t.id), folder: !!run.crew.workspace });
    // in the world: the author of the last input walks over to hand it off
    const from = t.dependsOn.map((d) => byId.get(d)!).filter((d) => d.status === 'done' && d.assigneeId !== t.assigneeId).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
    if (kind === 'work' && from && !this.live.activeRun(from.assigneeId)) {
      this.bus.emit('agent.handoff', { from: from.assigneeId, to: t.assigneeId });
      this.event(run, 'handoff', `${this.nameOf(from.assigneeId)} hands ${from.id} to ${this.nameOf(t.assigneeId)}.`, from.assigneeId, t.id, ['handoff', { from: this.nameOf(from.assigneeId), id: from.id, to: this.nameOf(t.assigneeId) }]);
    }
    const started = this.startAgent(run, t.assigneeId, { kind, taskId: t.id }, prompt, `${run.crew.name} · ${t.id} ${t.title}`);
    if (!started) return;
    t.status = 'running';
    (delete t.note, delete t.noteKey, delete t.noteVars);
    t.startedAt ??= this.now();
    t.attempts.push({ kind, agentId: t.assigneeId, agentTaskId: started.task.id, runId: started.run.id, at: this.now() });
    this.event(run, 'start', kind === 'revision' ? `${this.nameOf(t.assigneeId)} revises ${t.id}.` : `${this.nameOf(t.assigneeId)} starts ${t.id}: ${t.title}.`, t.assigneeId, t.id, kind === 'revision' ? ['revises', { name: this.nameOf(t.assigneeId), id: t.id }] : ['starts', { name: this.nameOf(t.assigneeId), id: t.id, title: t.title }]);
  }

  private startReview(run: CrewRun, t: CrewTask) {
    const reviewer = run.crew.reviewerId!;
    if (this.live.activeRun(reviewer)) {
      note(t, `${this.nameOf(reviewer)} is busy`, 'busy', { name: this.nameOf(reviewer) });
      return;
    }
    if (!t.attempts.some((a) => a.kind === 'review')) this.bus.emit('agent.handoff', { from: t.assigneeId, to: reviewer });
    const started = this.startAgent(run, reviewer, { kind: 'review', taskId: t.id }, reviewPrompt({ crew: run.crew.name, goal: run.goal, task: t, author: this.nameOf(t.assigneeId), output: t.output ?? '', facts: this.factsFor(run, t.id) }), `${run.crew.name} · review ${t.id}`);
    if (!started) return;
    (delete t.note, delete t.noteKey, delete t.noteVars);
    t.attempts.push({ kind: 'review', agentId: reviewer, agentTaskId: started.task.id, runId: started.run.id, at: this.now() });
    this.event(run, 'review', `${this.nameOf(reviewer)} reviews ${t.id}.`, reviewer, t.id, ['reviews', { name: this.nameOf(reviewer), id: t.id }]);
  }

  // ── "for each" tasks ────────────────────────────────────
  /** the list task is done: one item per entry of its list (none: the task fails and says why) */
  private fanOut(run: CrewRun, t: CrewTask, source: CrewTask | undefined) {
    const entries = source?.status === 'done' ? listItems(source.output ?? '') : [];
    t.startedAt ??= this.now();
    (delete t.note, delete t.noteKey, delete t.noteVars);
    if (!entries.length) {
      t.status = 'failed';
      t.error = source?.status === 'skipped' ? `${source.id} was skipped: there is no list to go through.` : `${source?.id ?? '?'} handed in no list (one entry per line, starting with "- "). Retry it, or skip this task.`;
      this.event(run, 'fail', `${t.id}: ${t.error}`, undefined, t.id, ['noList', { id: t.id, list: source?.id ?? '?' }]);
      return;
    }
    t.items = entries.map((label, i) => ({ id: `${t.id}.${i + 1}`, label, status: 'waiting', attempts: [] }));
    t.status = 'running';
    this.event(run, 'start', `${t.id} runs once for each of ${entries.length} entries of ${source!.id}.`, undefined, t.id, ['fansOut', { id: t.id, n: String(entries.length), list: source!.id }]);
  }

  /** start every waiting item that has a free assignee (one item per agent at a time) */
  private startItems(run: CrewRun, t: CrewTask) {
    const team = [t.assigneeId, ...(t.assignees ?? [])];
    for (const item of t.items ?? []) {
      if (item.status !== 'waiting') continue;
      const free = team.find((id) => !this.live.activeRun(id));
      if (!free) {
        note(t, `${team.map((id) => this.nameOf(id)).join(', ')} busy`, 'busy', { name: team.map((id) => this.nameOf(id)).join(', ') });
        return;
      }
      this.startItem(run, t, item, free);
    }
  }

  private startItem(run: CrewRun, t: CrewTask, item: CrewItem, agentId: string) {
    const byId = new Map(run.plan.map((x) => [x.id, x]));
    // the list itself is the item; the other inputs come as for any task
    const inputs = t.dependsOn
      .filter((d) => d !== t.forEach)
      .map((d) => byId.get(d)!)
      .filter((d) => d.status === 'done' && d.output)
      .map((d) => ({ title: d.title, by: this.nameOf(d.assigneeId), output: handoff(d) }));
    const items = t.items ?? [];
    const member = run.crew.members.find((m) => m.agentId === agentId);
    const facts = [...this.factsFor(run, t.id), ...(item.answers ?? []).map((a) => ({ task: item.id, question: a.question, answer: a.answer }))];
    const prompt = taskPrompt({ crew: run.crew.name, goal: run.goal, role: member?.role ?? 'member', ...(run.crew.brief && { brief: run.crew.brief }), task: t, inputs, facts, folder: !!run.crew.workspace, item: { label: item.label, index: items.indexOf(item) + 1, total: items.length, list: t.forEach ?? '', others: items.filter((i) => i !== item).map((i) => i.label.slice(0, 80)) } });
    const started = this.startAgent(run, agentId, { kind: 'work', taskId: t.id, itemId: item.id }, prompt, `${run.crew.name} · ${item.id} ${item.label}`);
    if (!started) return;
    item.status = 'running';
    item.assigneeId = agentId;
    delete item.error;
    (delete t.note, delete t.noteKey, delete t.noteVars);
    item.attempts.push({ kind: 'work', agentId, agentTaskId: started.task.id, runId: started.run.id, at: this.now() });
    this.event(run, 'start', `${this.nameOf(agentId)} starts ${item.id}: ${item.label.slice(0, 80)}.`, agentId, t.id, ['starts', { name: this.nameOf(agentId), id: item.id, title: item.label.slice(0, 80) }]);
  }

  private async onItem(run: CrewRun, t: CrewTask, item: CrewItem, ok: boolean, text: string, ar: AgentRun) {
    if (run.status !== 'running' || item.status !== 'running') return;
    if (!ok) {
      item.status = ar.status === 'cancelled' ? 'cancelled' : 'failed';
      item.error = ar.error?.message ?? (ar.status === 'cancelled' ? 'Stopped.' : 'The item failed.');
      this.event(run, 'fail', `${item.id} ${item.status === 'cancelled' ? 'was stopped' : `failed: ${item.error}`}.`, item.assigneeId, t.id, item.status === 'cancelled' ? ['stopped', { id: item.id }] : ['failed', { id: item.id, error: item.error ?? '' }]);
      this.settleForEach(run, t);
      return this.touch(run, true);
    }
    const question = blockedQuestion(text);
    if (question) {
      item.status = 'needs_input';
      item.question = question;
      this.event(run, 'ask', `${this.nameOf(item.assigneeId)} needs your input on ${item.id}: ${question.slice(0, 200)}`, item.assigneeId, t.id, ['asks', { name: this.nameOf(item.assigneeId), id: item.id, question: question.slice(0, 200) }]);
      return this.touch(run, true);
    }
    item.output = text.slice(0, CREW_LIMITS.outputChars);
    item.artifactId = (await this.opts.keep?.({ name: `${run.crew.name} ${item.id} ${item.label.slice(0, 60)}.md`, text, runId: run.id, agentId: item.assigneeId, agentRunId: ar.id, agentTaskId: ar.taskId }).catch(() => undefined)) ?? item.artifactId;
    if (run.status !== 'running') return this.touch(run, true);
    item.status = 'done';
    this.event(run, 'output', `${this.nameOf(item.assigneeId)} handed in ${item.id}.`, item.assigneeId, t.id, ['handedIn', { name: this.nameOf(item.assigneeId), id: item.id }]);
    this.settleForEach(run, t);
    this.touch(run, true);
  }

  /** every item settled: the task is done with all their outputs together, or failed if some did not finish */
  private settleForEach(run: CrewRun, t: CrewTask) {
    const items = t.items ?? [];
    if (!items.length || items.some((i) => i.status === 'waiting' || i.status === 'running' || i.status === 'needs_input')) return;
    const done = items.filter((i) => i.status === 'done');
    const open = items.filter((i) => i.status === 'failed' || i.status === 'cancelled');
    if (open.length) {
      t.status = 'failed';
      t.error = `${open.length} of ${items.length} entries did not finish (${open.map((i) => i.id).join(', ')}): retry or skip them.`;
      return;
    }
    // each item's share of the combined output, so every entry reaches the tasks after it
    const share = Math.max(1500, Math.floor((CREW_LIMITS.outputChars * 2) / Math.max(1, done.length)));
    t.output = done.map((i) => `### ${i.label}\n${(i.output ?? '').slice(0, share)}`).join('\n\n');
    delete t.error;
    this.done(run, t);
    this.event(run, 'output', `${t.id} is done: ${done.length} of ${items.length} entries.`, undefined, t.id, ['eachDone', { id: t.id, n: String(done.length), total: String(items.length) }]);
  }

  /** the coordinator assembles the final deliverable (waits if busy) */
  private assemble(run: CrewRun, feedback?: string) {
    const coord = run.crew.coordinatorId;
    run.status = 'assembling';
    // the user's feedback is kept first: a busy coordinator gets it when free (docs/HARDENING.md R-9)
    if (feedback) run.final = { ...(run.final ?? { text: '', assembledAt: 0 }), feedback };
    if (this.pending(run.final?.runId)) return;
    if (this.live.activeRun(coord)) {
      this.note(run, `${this.nameOf(coord)} is busy: the final result comes when they are free.`, ['busyFinal', { name: this.nameOf(coord) }]);
      return this.touch(run);
    }
    const outputs = run.plan.filter((t) => t.status === 'done').map((t) => ({ id: t.id, title: t.title, by: this.nameOf(t.assigneeId), output: handoff(t), ...(t.reviewNotes && { notes: t.reviewNotes }) }));
    const started = this.startAgent(run, coord, { kind: 'assemble' }, assemblePrompt({ crew: run.crew.name, goal: run.goal, outputs, ...(feedback && run.final?.text && { feedback: { notes: feedback, previous: run.final.text } }), facts: this.factsFor(run), folder: !!run.crew.workspace }), `${run.crew.name} · final`);
    if (!started) return;
    run.final = { ...(run.final ?? { text: '', assembledAt: 0 }), ...(feedback && { feedback }), agentTaskId: started.task.id, runId: started.run.id };
    this.event(run, 'assemble', `${this.nameOf(coord)} assembles the final result.`, coord, undefined, ['assembles', { name: this.nameOf(coord) }]);
    this.touch(run, true);
  }

  /** what the user answered (BLOCKED) for this task and every task it builds on; no task: the whole run (assembly) */
  private factsFor(run: CrewRun, taskId?: string): UserFact[] {
    const byId = new Map(run.plan.map((t) => [t.id, t]));
    const ids = new Set<string>();
    const walk = (id: string) => {
      if (ids.has(id)) return;
      ids.add(id);
      for (const d of byId.get(id)?.dependsOn ?? []) walk(d);
    };
    if (taskId) walk(taskId);
    else for (const t of run.plan) ids.add(t.id);
    return run.plan
      .filter((t) => ids.has(t.id))
      .flatMap((t) => [...(t.answers ?? []).map((a) => ({ task: t.id, question: a.question, answer: a.answer })), ...(t.items ?? []).flatMap((i) => (i.answers ?? []).map((a) => ({ task: i.id, question: a.question, answer: a.answer })))]);
  }

  /** one agent task for the crew; undefined (and a warning) when it cannot start */
  private startAgent(run: CrewRun, agentId: string, link: Omit<Link, 'runId'>, prompt: string, title: string): { task: AgentTask; run: AgentRun } | undefined {
    try {
      const files: AttachmentInput[] = (link.kind === 'work' || link.kind === 'revision' ? (run.crew.files ?? []) : []).filter((f) => f.storageRef).map(({ id: _id, ...f }) => f);
      const started = this.live.startTask(agentId, { prompt, title: title.slice(0, 120), crew: { crewId: run.crewId, runId: run.id, ...(link.taskId && { taskId: link.taskId }), kind: link.kind === 'revision' ? 'work' : link.kind }, ...(files.length && { attachments: files }), ...(run.crew.workspace && { workspace: run.crew.workspace }) });
      this.links.set(started.run.id, { runId: run.id, ...link });
      return started;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already working/.test(msg)) return undefined;
      this.event(run, 'warning', `${this.nameOf(agentId)}: ${msg}`, agentId, link.taskId);
      if (link.taskId) {
        const t = run.plan.find((x) => x.id === link.taskId);
        if (t && link.kind !== 'review') ((t.status = 'failed'), (t.error = msg), delete t.note, delete t.noteKey, delete t.noteVars);
      } else if (link.kind === 'plan' || link.kind === 'assemble') ((run.status = 'failed'), (run.error = msg));
      this.touch(run, true);
      return undefined;
    }
  }

  // ── the agents' runs end ────────────────────────────────
  private onAgentRun(agentRunId: string) {
    const link = this.links.get(agentRunId);
    if (!link) return void this.pumpAll();
    const run = this.runs.get(link.runId);
    const ar = this.live.getRun(agentRunId);
    if (!run || !ar) return void this.links.delete(agentRunId);
    const text = (ar.result ?? ar.output ?? '').trim();
    const ok = ar.status === 'completed';
    const t = link.taskId ? run.plan.find((x) => x.id === link.taskId) : undefined;
    const item = link.itemId ? t?.items?.find((i) => i.id === link.itemId) : undefined;
    // the link stays until the end is fully handled (keeping an Artifact is async): until then the
    // step still counts as pending, so nothing starts it twice
    const handled: Promise<void> | void =
      link.kind === 'plan'
        ? this.onPlan(run, ok, text, ar)
        : link.kind === 'assemble'
          ? this.onFinal(run, ok, text, ar)
          : t && item
            ? this.onItem(run, t, item, ok, text, ar)
            : t && (link.kind === 'work' || link.kind === 'revision')
            ? this.onWork(run, t, ok, text, ar)
            : t && link.kind === 'review'
              ? this.onReview(run, t, ok, text)
              : undefined;
    void Promise.resolve(handled)
      .catch(() => undefined)
      .finally(() => {
        this.links.delete(agentRunId);
        this.pumpAll();
      });
  }

  private onPlan(run: CrewRun, ok: boolean, text: string, ar: AgentRun) {
    if (run.status !== 'planning') return;
    if (!ok) {
      run.status = ar.status === 'cancelled' ? 'cancelled' : 'failed';
      run.error = ar.error?.message ?? 'The plan was not written.';
      this.event(run, 'fail', `The plan failed: ${run.error}`, run.crew.coordinatorId, undefined, ['planFailed', { error: run.error ?? '' }]);
      return this.touch(run, true);
    }
    const raw = parseJsonObject(text);
    const byName = new Map(run.crew.members.map((m) => [this.nameOf(m.agentId).toLowerCase(), m.agentId]));
    const tasks = (Array.isArray(raw?.tasks) ? raw!.tasks : []).slice(0, CREW_LIMITS.tasks).map((x, i) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const member = (name: unknown) => {
        const who = String(name ?? '').trim().toLowerCase();
        return who ? (byName.get(who) ?? [...byName.entries()].find(([n]) => n.startsWith(who) || who.startsWith(n))?.[1]) : undefined;
      };
      return {
        id: String(o.id ?? `T${i + 1}`).slice(0, 8),
        title: String(o.title ?? ''),
        assigneeId: member(o.assignee) ?? run.crew.coordinatorId,
        instructions: String(o.instructions ?? ''),
        deliverable: String(o.deliverable ?? ''),
        dependsOn: Array.isArray(o.dependsOn) ? o.dependsOn.map(String) : [],
        review: o.review === true,
        ...(typeof o.forEach === 'string' && o.forEach.trim() && { forEach: o.forEach.trim().slice(0, 8) }),
        ...(Array.isArray(o.assignees) && { assignees: o.assignees.map(member).filter((x): x is string => !!x) }),
      };
    });
    try {
      run.plan = this.cleanPlan(run, tasks);
      run.status = 'awaiting_plan';
      this.event(run, 'plan', `${this.nameOf(run.crew.coordinatorId)} proposed ${run.plan.length} tasks.`, run.crew.coordinatorId, undefined, ['proposed', { name: this.nameOf(run.crew.coordinatorId), n: String(run.plan.length) }]);
    } catch (e) {
      run.status = 'failed';
      run.error = `The plan was not usable (${e instanceof Error ? e.message : String(e)}). Plan again, or choose another model for the coordinator.`;
      this.event(run, 'fail', run.error, run.crew.coordinatorId);
    }
    this.touch(run, true);
  }

  private async onWork(run: CrewRun, t: CrewTask, ok: boolean, text: string, ar: AgentRun) {
    if (run.status !== 'running') return;
    if (!ok) {
      t.status = ar.status === 'cancelled' ? 'cancelled' : 'failed';
      t.error = ar.error?.message ?? (ar.status === 'cancelled' ? 'Stopped.' : 'The task failed.');
      t.finishedAt = this.now();
      this.event(run, 'fail', `${t.id} ${t.status === 'cancelled' ? 'was stopped' : `failed: ${t.error}`}.`, t.assigneeId, t.id, t.status === 'cancelled' ? ['stopped', { id: t.id }] : ['failed', { id: t.id, error: t.error ?? '' }]);
      return this.touch(run, true);
    }
    // the agent cannot go on without the user: the task waits for an answer, the rest of the crew goes on
    const question = blockedQuestion(text);
    if (question) {
      t.status = 'needs_input';
      t.question = question;
      (delete t.note, delete t.noteKey, delete t.noteVars);
      this.event(run, 'ask', `${this.nameOf(t.assigneeId)} needs your input on ${t.id}: ${question.slice(0, 200)}`, t.assigneeId, t.id, ['asks', { name: this.nameOf(t.assigneeId), id: t.id, question: question.slice(0, 200) }]);
      this.touch(run, true);
      return this.pump(run);
    }
    t.output = text.slice(0, CREW_LIMITS.outputChars);
    t.artifactId = (await this.opts.keep?.({ name: `${run.crew.name} ${t.id} ${t.title}.md`, text, runId: run.id, agentId: t.assigneeId, agentRunId: ar.id, agentTaskId: ar.taskId }).catch(() => undefined)) ?? t.artifactId;
    // stopped while the output was being kept: it stays, nothing more starts (docs/HARDENING.md R-8)
    if (run.status !== 'running') return this.touch(run, true);
    this.event(run, 'output', `${this.nameOf(t.assigneeId)} handed in ${t.id}.`, t.assigneeId, t.id, ['handedIn', { name: this.nameOf(t.assigneeId), id: t.id }]);
    if (t.review && run.crew.reviewerId && run.crew.reviewerId !== t.assigneeId) {
      t.status = 'review';
      this.startReview(run, t);
    } else this.done(run, t);
    this.touch(run, true);
    this.pump(run);
  }

  private onReview(run: CrewRun, t: CrewTask, ok: boolean, text: string) {
    if (run.status !== 'running') return;
    const attempt = [...t.attempts].reverse().find((a) => a.kind === 'review');
    const o = ok ? parseJsonObject(text) : undefined;
    const verdict = o?.verdict === 'changes' ? 'changes' : o?.verdict === 'approve' ? 'approve' : undefined;
    const notes = String(o?.notes ?? '').trim().slice(0, 1500);
    if (attempt) ((attempt.verdict = verdict), notes && (attempt.notes = notes));
    if (notes) t.reviewNotes = notes;
    const reviewer = run.crew.reviewerId;
    if (!ok || !verdict) {
      // a review that did not happen does not hold the crew up
      this.event(run, 'warning', `The review of ${t.id} did not come back: the output stands.`, reviewer, t.id, ['reviewMissing', { id: t.id }]);
      return this.done(run, t);
    }
    if (verdict === 'approve') {
      this.event(run, 'review', `${this.nameOf(reviewer)} approved ${t.id}.`, reviewer, t.id, ['approvedTask', { name: this.nameOf(reviewer), id: t.id }]);
      return this.done(run, t);
    }
    if (t.revisions >= CREW_LIMITS.revisions) {
      this.event(run, 'warning', `${t.id} still had changes asked after ${CREW_LIMITS.revisions} revisions: accepted with the reviewer's notes.`, reviewer, t.id, ['acceptedAfter', { id: t.id, n: String(CREW_LIMITS.revisions) }]);
      return this.done(run, t);
    }
    t.revisions++;
    this.event(run, 'changes', `${this.nameOf(reviewer)} asked for changes to ${t.id}: ${notes.slice(0, 160)}`, reviewer, t.id, ['changesAsked', { name: this.nameOf(reviewer), id: t.id, notes: notes.slice(0, 160) }]);
    if (reviewer) this.bus.emit('agent.handoff', { from: reviewer, to: t.assigneeId });
    if (this.live.activeRun(t.assigneeId)) ((t.status = 'waiting'), note(t, 'changes asked', 'changesAsked'));
    else this.startWork(run, t, 'revision', notes);
    this.touch(run, true);
  }

  private done(_run: CrewRun, t: CrewTask) {
    t.status = 'done';
    (delete t.note, delete t.noteKey, delete t.noteVars);
    t.finishedAt = this.now();
  }

  private async onFinal(run: CrewRun, ok: boolean, text: string, ar: AgentRun) {
    if (run.status !== 'assembling') return;
    if (!ok) {
      run.status = 'failed';
      run.error = ar.error?.message ?? 'The final result was not written.';
      this.event(run, 'fail', `The final assembly failed: ${run.error}`, run.crew.coordinatorId, undefined, ['finalFailed', { error: run.error ?? '' }]);
      return this.touch(run, true);
    }
    const artifactId = await this.opts.keep?.({ name: `${run.crew.name} final.md`, text, runId: run.id, agentId: run.crew.coordinatorId, agentRunId: ar.id, agentTaskId: ar.taskId }).catch(() => undefined);
    run.final = { ...run.final!, text: text.slice(0, CREW_LIMITS.outputChars * 2), ...(artifactId && { artifactId }), assembledAt: this.now() };
    // stopped while the result was being kept: it stays, but a stopped run does not come back to ask (docs/HARDENING.md R-8)
    if (run.status !== 'assembling') return this.touch(run, true);
    run.status = 'awaiting_approval';
    this.event(run, 'final', `${this.nameOf(run.crew.coordinatorId)} assembled the final result: it waits for your approval.`, run.crew.coordinatorId, undefined, ['finalReady', { name: this.nameOf(run.crew.coordinatorId) }]);
    // the crew meets again
    for (const m of run.crew.members) if (!this.live.activeRun(m.agentId)) this.bus.emit('agent.meeting.started', { agentId: m.agentId });
    const ms = this.opts.kickoffMs ?? 6000;
    setTimeout(() => {
      for (const m of run.crew.members) if (!this.live.activeRun(m.agentId)) this.bus.emit('agent.meeting.ended', { agentId: m.agentId });
    }, Math.max(0, ms));
    this.touch(run, true);
  }

  // ── the user ────────────────────────────────────────────
  approveFinal(runId: string, revision?: string) {
    const run = this.require(runId);
    if (run.status !== 'awaiting_approval') throw new CrewError('Nothing waits for approval.');
    if (revision !== undefined && revision !== crewRevision(run, 'final')) throw new CrewError('The final result changed: look at the new one first.');

    run.status = 'done';
    run.finishedAt = this.now();
    this.event(run, 'done', 'You approved the final result.', undefined, undefined, ['youApproved', {}]);
    this.touch(run, true);
  }
  requestChanges(runId: string, feedback: string) {
    const run = this.require(runId);
    if (run.status !== 'awaiting_approval') throw new CrewError('Nothing waits for approval.');
    const f = feedback.trim();
    if (!f) throw new CrewError('Say what to change.');
    this.event(run, 'feedback', `You asked for changes: ${f.slice(0, 200)}`, undefined, undefined, ['youAsked', { text: f.slice(0, 200) }]);
    this.assemble(run, f.slice(0, 2000));
  }
  /** plan again (after a failed or unwanted plan) */
  replan(runId: string) {
    const run = this.require(runId);
    if (run.status !== 'awaiting_plan' && run.status !== 'failed') throw new CrewError('Only a plan waiting or a failed run can be planned again.');
    run.plan = [];
    delete run.error;
    this.event(run, 'plan', `${this.nameOf(run.crew.coordinatorId)} plans again.`, run.crew.coordinatorId, undefined, ['replans', { name: this.nameOf(run.crew.coordinatorId) }]);
    this.plan(run);
    this.touch(run, true);
  }
  retryTask(runId: string, taskId: string) {
    const run = this.require(runId);
    const t = run.plan.find((x) => x.id === taskId);
    if (!t || (t.status !== 'failed' && t.status !== 'cancelled')) throw new CrewError('Only a failed or stopped task can be retried.');
    const open = t.items?.filter((i) => i.status === 'failed' || i.status === 'cancelled') ?? [];
    if (open.length) {
      // a "for each" task: its unfinished entries run again, the finished ones stay
      for (const i of open) ((i.status = 'waiting'), delete i.error);
      t.status = 'running';
    } else ((t.status = 'waiting'), delete t.items);
    delete t.error;
    if (run.status === 'failed') ((run.status = 'running'), delete run.error);
    this.event(run, 'retry', `${t.id} will be retried.`, undefined, t.id, ['retried', { id: t.id }]);
    this.pump(run);
  }
  /** the user answers what an agent asked (needs_input): the task runs again with the answer */
  answerTask(runId: string, taskId: string, answer: string, itemId?: string) {
    const run = this.require(runId);
    const t = run.plan.find((x) => x.id === taskId);
    const item = itemId ? t?.items?.find((i) => i.id === itemId) : undefined;
    if (itemId ? item?.status !== 'needs_input' : !t || t.status !== 'needs_input') throw new CrewError('This task is not waiting for an answer.');
    const a = answer.trim();
    if (!a) throw new CrewError('Write the answer first.');
    if (item) {
      item.answers = [...(item.answers ?? []), { question: item.question ?? '', answer: a.slice(0, 4000), at: this.now() }].slice(-5);
      delete item.question;
      item.status = 'waiting';
      this.event(run, 'answer', `You answered ${item.id}: ${a.slice(0, 160)}`, undefined, taskId, ['youAnswered', { id: item.id, text: a.slice(0, 160) }]);
      this.touch(run, true);
      return this.pump(run);
    }
    if (!t) return;
    t.answers = [...(t.answers ?? []), { question: t.question ?? '', answer: a.slice(0, 4000), at: this.now() }].slice(-5);
    delete t.question;
    t.status = 'waiting';
    this.event(run, 'answer', `You answered ${t.id}: ${a.slice(0, 160)}`, undefined, t.id, ['youAnswered', { id: t.id, text: a.slice(0, 160) }]);
    this.touch(run, true);
    this.pump(run);
  }
  skipTask(runId: string, taskId: string, itemId?: string) {
    const run = this.require(runId);
    const t = run.plan.find((x) => x.id === taskId);
    const skippable = (i: CrewItem) => i.status === 'waiting' || i.status === 'needs_input' || i.status === 'failed' || i.status === 'cancelled';
    if (t?.items && (itemId || (t.status === 'failed' && t.items.some((i) => i.status === 'done')))) {
      const items = t.items.filter((i) => (itemId ? i.id === itemId : true) && skippable(i));
      if (!items.length) throw new CrewError('This entry cannot be skipped now.');
      for (const i of items) ((i.status = 'skipped'), delete i.question);
      if (t.status === 'failed') t.status = 'running';
      this.event(run, 'skip', `${items.map((i) => i.id).join(', ')} skipped.`, undefined, t.id, ['skipped', { id: items.map((i) => i.id).join(', ') }]);
      this.settleForEach(run, t);
      this.touch(run, true);
      return this.pump(run);
    }
    if (!t || !(t.status === 'failed' || t.status === 'cancelled' || t.status === 'blocked' || t.status === 'waiting' || t.status === 'needs_input')) throw new CrewError('This task cannot be skipped now.');
    delete t.question;
    t.status = 'skipped';
    (delete t.note, delete t.noteKey, delete t.noteVars);
    this.event(run, 'skip', `${t.id} skipped: the tasks after it go on without its output.`, undefined, t.id, ['skipped', { id: t.id }]);
    this.pump(run);
  }
  /** stop the crew: its agents' crew tasks stop; what is done stays */
  async cancel(runId: string) {
    const run = this.require(runId);
    if (run.status === 'done' || run.status === 'cancelled') return;
    run.status = 'cancelled';
    run.finishedAt = this.now();
    for (const [agentRunId, l] of [...this.links.entries()])
      if (l.runId === run.id && this.isLive(agentRunId)) {
        const ar = this.live.getRun(agentRunId)!;
        if (this.live.activeRun(ar.agentId)?.id === agentRunId) await this.live.cancel(ar.agentId);
      }
    for (const t of run.plan) {
      if (t.status === 'waiting' || t.status === 'running' || t.status === 'review' || t.status === 'blocked' || t.status === 'needs_input') t.status = 'cancelled';
      for (const i of t.items ?? []) if (i.status === 'waiting' || i.status === 'running' || i.status === 'needs_input') i.status = 'cancelled';
    }
    this.event(run, 'cancel', 'The crew was stopped; what was done stays.', undefined, undefined, ['stoppedRun', {}]);
    this.touch(run, true);
  }
  /** after a restart: go on from where it was */
  resume(runId: string) {
    const run = this.require(runId);
    if (run.status !== 'interrupted') throw new CrewError('Only an interrupted run can resume.');
    this.event(run, 'resume', 'Resumed.', undefined, undefined, ['resumed', {}]);
    if (!run.plan.length) this.plan(run);
    else if (run.plan.every((t) => t.status === 'done' || t.status === 'skipped')) this.assemble(run, run.final?.feedback);
    else {
      run.status = 'running';
      this.pump(run);
    }
    this.touch(run, true);
  }
  removeRun(runId: string) {
    const run = this.require(runId);
    if (isLiveCrewRun(run.status)) throw new CrewError('Stop the crew first.');
    this.runs.delete(runId);
    this.order = this.order.filter((x) => x !== runId);
    void this.storage.remove(runKey(runId));
    void this.storage.set(INDEX, this.order);
    this.changed();
  }

  /** the crew run an agent task belongs to (agent panels) */
  ofAgentTask(task: AgentTask | undefined): CrewRun | undefined {
    return task?.crew ? this.runs.get(task.crew.runId) : undefined;
  }

  // ── bookkeeping ─────────────────────────────────────────
  private note(run: CrewRun, message: string, say?: [string, Record<string, string>]) {
    const last = run.history.at(-1);
    if (last?.message !== message) this.event(run, 'warning', message, undefined, undefined, say);
  }
  /** `say`: the translated form (cw.ev.<key>) the UI shows */
  private event(run: CrewRun, kind: CrewEvent['kind'], message: string, agentId?: string, taskId?: string, say?: [string, Record<string, string>]) {
    run.history.push({ at: this.now(), kind, message: message.slice(0, 400), ...(agentId && { agentId }), ...(taskId && { taskId }), ...(say && { key: say[0], vars: say[1] }) });
    if (run.history.length > CREW_LIMITS.history) run.history.splice(0, run.history.length - CREW_LIMITS.history);
    this.bus.emit('crew.event', { runId: run.id, crewId: run.crewId, kind, message: message.slice(0, 160) });
  }
  private touch(run: CrewRun, now = false) {
    run.updatedAt = this.now();
    this.changed();
    clearTimeout(this.saveTimers.get(run.id));
    if (now) void this.storage.set(runKey(run.id), run);
    else this.saveTimers.set(run.id, setTimeout(() => void this.storage.set(runKey(run.id), run), 400));
  }
  private saveCrews() {
    void this.storage.set(CREWS, { version: 1, crews: this.crews });
    this.changed();
  }
  private changed() {
    this.version++;
    for (const l of this.listeners) l();
  }
}

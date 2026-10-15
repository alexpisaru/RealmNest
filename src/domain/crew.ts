// ─────────────────────────────────────────────────────────────
// Crew (docs/CREW.md): agents of one world working on one goal with roles, a small task graph,
// hand-offs, review and a final deliverable. Not messages between agents: a Crew is a first-level
// object, and a Crew run is one goal pursued by it.
//
//   Crew      name · world · coordinator · reviewer · members (agent + role + duty) · brief
//   CrewRun   goal · plan (CrewTask graph) · outputs (Artifacts) · final · history
//   CrewTask  T1… · assignee · instructions · dependsOn · review · status · attempts
// ─────────────────────────────────────────────────────────────

import type { Attachment } from './attachment';

export interface CrewMember {
  agentId: string;
  /** the role in this crew ("Research", "Copy") */
  role: string;
  /** what they do here, for the coordinator's plan */
  duty?: string;
}

export interface Crew {
  id: string;
  name: string;
  /** every member lives in this world */
  worldId: string;
  /** the goal a new run starts from (each run can change it) */
  goal: string;
  coordinatorId: string;
  reviewerId?: string;
  members: CrewMember[];
  /** shared context every task receives */
  brief?: string;
  /** shared files every task receives (stored in the FileStore) */
  files?: Attachment[];
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}

/** waiting: dependencies not done (or the agent is busy) · blocked: a dependency failed ·
 *  running · review: with the reviewer · done · failed · cancelled · skipped (by the user) */
export type CrewTaskStatus = 'waiting' | 'blocked' | 'running' | 'review' | 'done' | 'failed' | 'cancelled' | 'skipped';

export interface CrewAttempt {
  kind: 'work' | 'review' | 'revision';
  agentId: string;
  /** the agent task and run that did it */
  agentTaskId: string;
  runId: string;
  at: number;
  verdict?: 'approve' | 'changes';
  notes?: string;
}

export interface CrewTask {
  /** T1, T2… */
  id: string;
  title: string;
  assigneeId: string;
  instructions: string;
  /** what to hand in ("a one-page competitor table") */
  deliverable?: string;
  dependsOn: string[];
  /** the reviewer checks it before it counts as done */
  review: boolean;
  status: CrewTaskStatus;
  /** why it waits or is blocked, in a few words (English) */
  note?: string;
  /** the same, for the UI: cw.note.<key> with these values */
  noteKey?: string;
  noteVars?: Record<string, string>;
  attempts: CrewAttempt[];
  /** the output, as kept (capped); the Artifact has the whole of it */
  output?: string;
  artifactId?: string;
  /** the reviewer's last notes (shown even when accepted after the last revision) */
  reviewNotes?: string;
  revisions: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export type CrewRunStatus = 'planning' | 'awaiting_plan' | 'running' | 'assembling' | 'awaiting_approval' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export interface CrewEvent {
  at: number;
  /** the agent who did it (none: RealmNest or the user) */
  agentId?: string;
  taskId?: string;
  kind: 'plan' | 'approve' | 'kickoff' | 'start' | 'handoff' | 'output' | 'review' | 'changes' | 'fail' | 'block' | 'retry' | 'skip' | 'assemble' | 'final' | 'feedback' | 'done' | 'cancel' | 'resume' | 'warning';
  /** English, for logs */
  message: string;
  /** what the UI shows, translated: cw.ev.<key> with these values */
  key?: string;
  vars?: Record<string, string>;
}

export interface CrewRun {
  id: string;
  crewId: string;
  /** the crew as it was when the run started (members, roles, brief) */
  crew: Pick<Crew, 'name' | 'worldId' | 'coordinatorId' | 'reviewerId' | 'members' | 'brief' | 'files'>;
  goal: string;
  status: CrewRunStatus;
  plan: CrewTask[];
  /** the coordinator's assembly attempts and the user's feedback */
  final?: { text: string; artifactId?: string; feedback?: string; assembledAt: number; agentTaskId?: string; runId?: string };
  history: CrewEvent[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export const CREW_LIMITS = {
  tasks: 12,
  members: 8,
  /** revisions after a review asks for changes */
  revisions: 2,
  /** characters of an upstream output a task receives (each) */
  handoffChars: 8000,
  outputChars: 20_000,
  history: 300,
  runs: 40,
};

export const isLiveCrewRun = (s: CrewRunStatus) => s === 'planning' || s === 'running' || s === 'assembling';
/** ended for good: only these runs make room for new ones (an open run is never dropped) */
export const isEndedCrewRun = (s: CrewRunStatus) => s === 'done' || s === 'failed' || s === 'cancelled';

/** a short fingerprint of what the user approves (the plan, or the final result): an Approve made
 *  for an older version is refused (docs/HARDENING.md I-6) */
export function crewRevision(run: Pick<CrewRun, 'plan' | 'final'>, what: 'plan' | 'final'): string {
  const text = what === 'plan' ? JSON.stringify(run.plan.map((t) => [t.id, t.title, t.assigneeId, t.instructions, t.deliverable ?? '', t.dependsOn, t.review])) : `${run.final?.assembledAt ?? 0}|${run.final?.text ?? ''}`;
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length.toString(36)}.${h.toString(36)}`;
}


/** the tasks in dependency order (Kahn); undefined when the graph has a cycle or an unknown id */
export function topoOrder(tasks: Pick<CrewTask, 'id' | 'dependsOn'>[]): string[] | undefined {
  const ids = new Set(tasks.map((t) => t.id));
  if (tasks.some((t) => t.dependsOn.some((d) => !ids.has(d) || d === t.id))) return undefined;
  const indeg = new Map(tasks.map((t) => [t.id, t.dependsOn.length]));
  const out: string[] = [];
  const ready = tasks.filter((t) => !t.dependsOn.length).map((t) => t.id);
  while (ready.length) {
    const id = ready.shift()!;
    out.push(id);
    for (const t of tasks)
      if (t.dependsOn.includes(id)) {
        indeg.set(t.id, indeg.get(t.id)! - 1);
        if (indeg.get(t.id) === 0) ready.push(t.id);
      }
  }
  return out.length === tasks.length ? out : undefined;
}

/** each task's column in the graph (0: no dependency) */
export function depthOf(tasks: Pick<CrewTask, 'id' | 'dependsOn'>[]): Map<string, number> {
  const d = new Map<string, number>();
  const order = topoOrder(tasks) ?? tasks.map((t) => t.id);
  for (const id of order) {
    const t = tasks.find((x) => x.id === id)!;
    d.set(id, t.dependsOn.length ? Math.max(...t.dependsOn.map((x) => (d.get(x) ?? 0) + 1)) : 0);
  }
  return d;
}

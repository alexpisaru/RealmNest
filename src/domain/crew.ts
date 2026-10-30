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
  /** a folder every task of the crew works in: its file tools read and write there (an absolute path) */
  workspace?: string;
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}

/** waiting: dependencies not done (or the agent is busy) · blocked: a dependency failed ·
 *  running · review: with the reviewer · needs_input: the agent asked the user for something it
 *  cannot get itself · done · failed · cancelled · skipped (by the user) */
export type CrewTaskStatus = 'waiting' | 'blocked' | 'running' | 'review' | 'needs_input' | 'done' | 'failed' | 'cancelled' | 'skipped';

/** what an agent asked the user (BLOCKED: …) and the answer it got */
export interface CrewAnswer {
  question: string;
  answer: string;
  at: number;
}

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

/** one item of a "for each" task: the same work done for one entry of the list */
export interface CrewItem {
  /** T3.1, T3.2… */
  id: string;
  /** the list entry, as the list task wrote it */
  label: string;
  status: 'waiting' | 'running' | 'needs_input' | 'done' | 'failed' | 'cancelled' | 'skipped';
  /** who does it (one of the task's assignees, chosen when it starts) */
  assigneeId?: string;
  output?: string;
  artifactId?: string;
  error?: string;
  question?: string;
  answers?: CrewAnswer[];
  attempts: CrewAttempt[];
}

export interface CrewTask {
  /** T1, T2… */
  id: string;
  title: string;
  assigneeId: string;
  /**
   * "For each": the id of the task whose output is a list (one entry per line). This task then runs
   * once per entry (CrewItem), shared among its assignees; its output is all of theirs together.
   */
  forEach?: string;
  /** more members who share the items of a "for each" task with the assignee */
  assignees?: string[];
  /** the items of a "for each" task, made from the list when it starts */
  items?: CrewItem[];
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
  /** needs_input: what the agent needs from the user, in its words */
  question?: string;
  /** the questions answered so far; every later attempt of the task gets them */
  answers?: CrewAnswer[];
}

export type CrewRunStatus = 'planning' | 'awaiting_plan' | 'running' | 'assembling' | 'awaiting_approval' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export interface CrewEvent {
  at: number;
  /** the agent who did it (none: RealmNest or the user) */
  agentId?: string;
  taskId?: string;
  kind: 'plan' | 'approve' | 'kickoff' | 'start' | 'handoff' | 'output' | 'review' | 'changes' | 'fail' | 'block' | 'retry' | 'skip' | 'assemble' | 'final' | 'feedback' | 'done' | 'cancel' | 'resume' | 'warning' | 'ask' | 'answer';
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
  crew: Pick<Crew, 'name' | 'worldId' | 'coordinatorId' | 'reviewerId' | 'members' | 'brief' | 'files' | 'workspace'>;
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
  /** items of one "for each" task */
  items: 20,
  members: 8,
  /** revisions after a review asks for changes */
  revisions: 2,
  /** characters of an upstream output a task receives (each) */
  handoffChars: 8000,
  outputChars: 20_000,
  history: 300,
  runs: 40,
};

/**
 * An agent that cannot do its task answers "BLOCKED: what I need" (or BLOCCATO) as the first line:
 * the question, or undefined for an ordinary answer. Only a first line that starts so counts.
 */
export function blockedQuestion(text: string): string | undefined {
  const m = /^\s*\**\s*(?:BLOCKED|BLOCCATO)\s*\**\s*[:：—-]\s*([\s\S]+)/i.exec(text);
  const q = m?.[1].trim().replace(/\s+/g, ' ').slice(0, 1000);
  return q || undefined;
}

/**
 * The entries of a list a task handed in, for a "for each" task: lines that start with "- ", "* ",
 * "• " or a number ("1." "1)"), without Markdown emphasis; a JSON array of strings works too.
 * At most CREW_LIMITS.items, no duplicates.
 */
export function listItems(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const v = s.replace(/\*\*|__|`/g, '').trim().slice(0, 300);
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase()) && out.length < CREW_LIMITS.items) out.push(v);
  };
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:[-*•]|\d{1,3}[.)])\s+(.+)$/.exec(line);
    if (m) add(m[1]);
  }
  if (!out.length) {
    const json = /\[[\s\S]*\]/.exec(text)?.[0];
    try {
      const arr = json ? (JSON.parse(json) as unknown) : undefined;
      if (Array.isArray(arr)) for (const x of arr) if (typeof x === 'string') add(x);
    } catch {
      /* not JSON */
    }
  }
  return out;
}

export const isLiveCrewRun = (s: CrewRunStatus) => s === 'planning' || s === 'running' || s === 'assembling';
/** ended for good: only these runs make room for new ones (an open run is never dropped) */
export const isEndedCrewRun = (s: CrewRunStatus) => s === 'done' || s === 'failed' || s === 'cancelled';

/** a short fingerprint of what the user approves (the plan, or the final result): an Approve made
 *  for an older version is refused (docs/HARDENING.md I-6) */
export function crewRevision(run: Pick<CrewRun, 'plan' | 'final'>, what: 'plan' | 'final'): string {
  const text = what === 'plan' ? JSON.stringify(run.plan.map((t) => [t.id, t.title, t.assigneeId, t.instructions, t.deliverable ?? '', t.dependsOn, t.review, t.forEach ?? '', t.assignees ?? []])) :`${run.final?.assembledAt ?? 0}|${run.final?.text ?? ''}`;
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

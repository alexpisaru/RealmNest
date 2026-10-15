// ─────────────────────────────────────────────────────────────
// Workflows (docs/WORKFLOWS.md). Three things kept apart:
//
//   WorkflowDefinition  WHAT happens, in what order: a versioned, declarative graph (pure data)
//   Schedule            WHEN a run starts (the scheduler only creates runs)
//   WorkflowRun         one concrete, durable instance the ORCHESTRATOR carries out (how)
//
// definition ≠ run: a run keeps a snapshot of the definition it started from.
// ─────────────────────────────────────────────────────────────

export type NodeKind = 'agent' | 'tool' | 'crew' | 'wait' | 'approval' | 'condition' | 'parallel' | 'merge' | 'output';
export const NODE_KINDS: NodeKind[] = ['agent', 'tool', 'crew', 'wait', 'approval', 'condition', 'parallel', 'merge', 'output'];

/** text fields are templates: {{input.x}} · {{node.<id>.output}} · {{node.<id>.value}} · {{date}} · {{time}} */
export type NodeConfig =
  | { kind: 'agent'; agentId: string; prompt: string }
  | { kind: 'tool'; toolId: string; input: Record<string, string> }
  | { kind: 'crew'; crewId: string; goal: string; autoApprovePlan?: boolean; autoApproveFinal?: boolean }
  | { kind: 'wait'; mode: 'duration'; minutes: number }
  | { kind: 'wait'; mode: 'until'; at: string }
  | { kind: 'approval'; prompt: string }
  | { kind: 'condition'; test: 'contains' | 'equals' | 'notEmpty'; source: string; value?: string }
  | { kind: 'condition'; test: 'agent'; source: string; agentId: string; question: string }
  | { kind: 'parallel' }
  | { kind: 'merge'; mode: 'all' | 'any' }
  | { kind: 'output'; name: string; content: string };

export interface NodePolicy {
  /** extra attempts after a failure (0–3) */
  retries?: number;
  /** minutes before the next attempt (doubles each time) */
  backoffMinutes?: number;
  /** minutes before an agent task or tool call is stopped */
  timeoutMinutes?: number;
  /** fail: the run fails · continue: go on with the error as output · skip: go on as if skipped */
  onFail?: 'fail' | 'continue' | 'skip';
}

export interface WorkflowNode {
  /** short, unique in the workflow: research, draft… */
  id: string;
  title: string;
  config: NodeConfig;
  policy?: NodePolicy;
}

/** a branch: true / false after a condition, approved / rejected after an approval */
export type EdgeWhen = 'true' | 'false' | 'approved' | 'rejected';

export interface WorkflowEdge {
  from: string;
  to: string;
  when?: EdgeWhen;
}

export interface WorkflowInput {
  name: string;
  label?: string;
  default?: string;
  required?: boolean;
}

export interface WorkflowPolicies {
  /** tokens (in + out) the agents of one run may use */
  budgetTokens?: number;
  /** US dollars the agents of one run may spend (where the provider reports cost) */
  budgetUsd?: number;
  /** minutes a run may last (waits included) */
  maxMinutes?: number;
  /** nodes running at once */
  maxConcurrency?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  /** +1 on every save; runs keep the version they started from */
  version: number;
  inputs: WorkflowInput[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  policies: WorkflowPolicies;
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}

// ── runs ──────────────────────────────────────────────────
/** queued: created, not started · running · waiting: only timers left · awaiting_approval: a person is needed ·
 *  suspended: work was interrupted (a restart) and waits for Resume · completed · failed · cancelled */
export type WorkflowRunStatus = 'queued' | 'running' | 'waiting' | 'awaiting_approval' | 'suspended' | 'completed' | 'failed' | 'cancelled';

export type NodeRunStatus = 'pending' | 'ready' | 'running' | 'waiting' | 'awaiting_approval' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'interrupted';

export interface NodeRun {
  nodeId: string;
  status: NodeRunStatus;
  attempts: number;
  startedAt?: number;
  finishedAt?: number;
  /** the text it produced (capped); the Artifact has an output node's whole content */
  output?: string;
  /** a condition's true/false, an approval's approved/rejected */
  value?: string;
  error?: string;
  /** a durable timer: a wait's end, the next attempt after a failure */
  wakeAt?: number;
  /** what executes it */
  agentTaskId?: string;
  agentRunId?: string;
  toolCallId?: string;
  crewRunId?: string;
  artifactId?: string;
  /** an approval node's question, rendered */
  prompt?: string;
}

export interface WorkflowTrigger {
  kind: 'manual' | 'schedule' | 'catchup';
  scheduleId?: string;
  /** the time it was due (schedules) */
  dueAt?: number;
  /** catch-up: how many times were missed */
  missed?: number;
  /** "run now" on a schedule: the user asked, so it may overlap the previous run */
  byUser?: boolean;
}


export interface WorkflowRunEvent {
  at: number;
  nodeId?: string;
  agentId?: string;
  kind: 'start' | 'node' | 'done' | 'fail' | 'retry' | 'timeout' | 'skip' | 'wait' | 'approval' | 'budget' | 'suspend' | 'resume' | 'cancel' | 'complete' | 'warning';
  /** English, for logs */
  message: string;
  /** translated in the UI: wf.ev.<key> */
  key?: string;
  vars?: Record<string, string>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  /** the definition as it was when the run was created */
  definition: WorkflowDefinition;
  trigger: WorkflowTrigger;
  inputs: Record<string, string>;
  status: WorkflowRunStatus;
  nodes: Record<string, NodeRun>;
  /** Artifacts of output nodes */
  artifacts: string[];
  budget: { tokens: number; usd: number };
  history: WorkflowRunEvent[];
  error?: string;
  /** the error in the user's language: wf.err.run.<key> */
  errorKey?: string;
  errorVars?: Record<string, string>;
  /** time spent waiting for the user or suspended (RealmNest closed): not counted by maxMinutes */
  pausedMs?: number;
  /** since when the run waits for the user, or is suspended */
  pausedSince?: number;
  /** the user has looked at it since it needed them or ended */
  seen?: boolean;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export const isOpenRun = (s: WorkflowRunStatus) => s === 'queued' || s === 'running' || s === 'waiting' || s === 'awaiting_approval' || s === 'suspended';

// ── schedules ─────────────────────────────────────────────
export type ScheduleTrigger =
  | { kind: 'once'; at: number }
  | { kind: 'interval'; everyMinutes: number }
  | { kind: 'daily'; time: string }
  /** days: 0 = Sunday … 6 = Saturday */
  | { kind: 'weekly'; days: number[]; time: string }
  /** minute hour day-of-month month day-of-week */
  | { kind: 'cron'; expr: string };

export interface Schedule {
  id: string;
  name: string;
  workflowId: string;
  inputs: Record<string, string>;
  trigger: ScheduleTrigger;
  enabled: boolean;
  /** missed while RealmNest was closed: one catch-up run · nothing · one run per missed time (≤ 10) */
  catchUp: 'once' | 'skip' | 'all';
  /** when it last created a run (or was due, for skipped times) */
  lastFiredAt?: number;
  nextAt?: number;
  /** reported misses (at: the last missed time), until the user has seen them */
  missed?: { count: number; at: number; created: number };
  createdAt: number;
  updatedAt: number;
}

export const WORKFLOW_LIMITS = {
  nodes: 30,
  outputChars: 20_000,
  history: 400,
  runs: 80,
  schedules: 40,
  catchUpAll: 10,
  retries: 3,
};

/** node ids in dependency order (Kahn); undefined when the edges make a cycle or name a missing node */
export function workflowOrder(nodes: Pick<WorkflowNode, 'id'>[], edges: WorkflowEdge[]): string[] | undefined {
  const ids = new Set(nodes.map((n) => n.id));
  if (edges.some((e) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to)) return undefined;
  const indeg = new Map(nodes.map((n) => [n.id, edges.filter((e) => e.to === n.id).length]));
  const ready = nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  const out: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    out.push(id);
    for (const e of edges.filter((x) => x.from === id)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) ready.push(e.to);
    }
  }
  return out.length === nodes.length ? out : undefined;
}

// ─────────────────────────────────────────────────────────────
// RuntimeRepository: agents, tasks and runs on the existing StorageAdapter
// (localStorage today, SQLite later), under its own key, apart from the save.
//
// Streaming makes many small changes, so saves are coalesced: `touch()`
// schedules one write, `flush()` writes now (used at every status change).
// Bounded: the newest MAX_TASKS tasks are kept, outputs are capped.
// ─────────────────────────────────────────────────────────────

import type { AgentDefinition, AgentRun, AgentTask } from '../../domain/agent';
import { isFinished } from '../../domain/agent';
import { CoalescedWriter } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';

export const RUNTIME_SCHEMA = 1;
const KEY = 'runtime';
export const MAX_TASKS = 200;
export const MAX_OUTPUT_CHARS = 200_000;

export interface RuntimeSnapshot {
  version: number;
  agents: AgentDefinition[];
  tasks: AgentTask[];
  runs: AgentRun[];
}

export class RuntimeRepository {
  private writer: CoalescedWriter<RuntimeSnapshot>;

  constructor(
    private storage: StorageAdapter,
    delayMs = 1_000,
  ) {
    this.writer = new CoalescedWriter(storage, KEY, delayMs, prune);
  }

  /**
   * Load what was saved. Runs that were still going when RealmNest closed cannot
   * be resumed (their process was killed): they are marked failed, with their task.
   */
  async load(now = Date.now()): Promise<RuntimeSnapshot> {
    const raw = await this.storage.get<Partial<RuntimeSnapshot>>(KEY);
    // records are checked one by one: a broken one is dropped, never the whole history (D-2)
    const runs = (Array.isArray(raw?.runs) ? raw.runs : [])
      .filter(isRecord)
      .map((r) => (typeof r.output === 'string' ? r : { ...r, output: '' }))
      .map((r) => (isFinished(r.status) ? r : { ...r, status: 'failed' as const, finishedAt: now, error: { code: 'interrupted', message: 'RealmNest was closed while this run was in progress.' } }));
    const interrupted = new Set(runs.filter((r) => r.error?.code === 'interrupted').map((r) => r.taskId));
    const tasks = (Array.isArray(raw?.tasks) ? raw.tasks : [])
      .filter(isRecord)
      .map((t) => (Array.isArray(t.runIds) ? t : { ...t, runIds: [] }))
      // a task waiting in the agent's queue (it has its input) keeps waiting; any other unfinished one failed
      .map((t) => (!isFinished(t.status) && (interrupted.has(t.id) || (t.status === 'queued' && !t.pending)) ? { ...t, status: 'failed' as const, updatedAt: now } : t));
    return { version: RUNTIME_SCHEMA, agents: (Array.isArray(raw?.agents) ? raw.agents : []).filter(isRecord), tasks, runs };
  }

  /** schedule a save of whatever `get` returns when the timer fires */
  touch(get: () => RuntimeSnapshot) {
    this.writer.touch(get);
  }

  /** save now (and cancel a scheduled save) */
  flush(get?: () => RuntimeSnapshot) {
    return this.writer.flush(get);
  }
}

const isRecord = <T extends { id: string }>(v: T | null | undefined): v is T => typeof v === 'object' && v !== null && typeof v.id === 'string';

/** Keep the newest tasks (and their runs); cap stored outputs. Queued or running tasks, and tasks with a run going, are never pruned (D-9). */
export function prune(s: RuntimeSnapshot): RuntimeSnapshot {
  const active = new Set(s.runs.filter((r) => !isFinished(r.status)).map((r) => r.taskId));
  const kept = (t: AgentTask) => !isFinished(t.status) || active.has(t.id);
  const sorted = [...s.tasks].sort((a, b) => a.createdAt - b.createdAt);
  // newest first, so the oldest finished ones go
  let room = Math.max(0, MAX_TASKS - sorted.filter(kept).length);
  const chosen = new Set(
    [...sorted]
      .reverse()
      .filter((t) => kept(t) || room-- > 0)
      .map((t) => t.id),
  );
  const tasks = sorted.filter((t) => chosen.has(t.id));
  const keep = new Set(tasks.map((t) => t.id));
  const runs = s.runs
    .filter((r) => keep.has(r.taskId))
    .map((r) => (typeof r.output === 'string' && r.output.length > MAX_OUTPUT_CHARS ? { ...r, output: `${r.output.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated]` } : r));
  return { version: RUNTIME_SCHEMA, agents: s.agents, tasks, runs };
}

// ─────────────────────────────────────────────────────────────
// ToolRuntime: the only way a tool runs.
//
//   request ─▶ known tool? ─▶ allowed here? ─▶ valid input? ─▶ permission
//      ─▶ (ask: wait for the user) ─▶ executor (timeout, cancel) ─▶ ToolResult
//
// Every step is a ToolCall status and a `tool.*` event; calls are kept
// (bounded) for run history and debugging. Providers never see executors:
// they only get a normalized ToolResult back through the ToolLoop.
// ─────────────────────────────────────────────────────────────

import type { EmitOptions, EventBus } from '../../core/events';
import type { SkillRunRef } from '../../domain/skill';
import type { ToolCall, ToolCallContext, ToolCallStatus, ToolError, ToolPermission, ToolResult } from '../../domain/tool';
import { CoalescedWriter } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';
import { resolvePermission, type ToolPolicyStore } from './policy';
import type { ToolRegistry } from './registry';
import { validateInput } from './schema';

const KEY = 'tool-calls';
export const MAX_KEPT_CALLS = 300;
/** stored text of an input or output (what the model gets is not cut) */
export const MAX_KEPT_CHARS = 4_000;

/** the choice on an approval prompt */
export type ApprovalDecision = 'deny' | 'once' | 'run' | 'always';

/** everything the runtime needs to know about who is calling */
/** a file a run may hand to its tools (its own attachments only: run scoping) */
export interface ScopedFile {
  id: string;
  name: string;
  mime: string;
  storageRef: string;
}

export interface ToolScope extends ToolCallContext {
  /** tools this agent / chat may use at all */
  allowedToolIds: string[];
  /** the run's attachments: the only stored files its tools may read */
  attachments?: ScopedFile[];
  /** the chat message being written (provenance of what the tools produce) */
  messageId?: string;
  /** the run's active Skills (provenance) */
  skills?: SkillRunRef[];
  /** the agent's own permission choices */
  agentPermissions?: Record<string, ToolPermission>;
  workspace?: string;
  /** shown on the approval prompt ("Alex", "Chat") */
  requester: string;
}

export interface ToolRequest {
  /** the model's id for this call */
  providerCallId?: string;
  name: string;
  input: unknown;
}

export interface PendingApproval {
  call: ToolCall;
  requester: string;
}

interface Waiting {
  pending: PendingApproval;
  resolve: (d: ApprovalDecision | 'cancelled') => void;
}

const LIVE: EmitOptions = { origin: 'live' };
let counter = 0;
const newId = () => `tc-${Date.now().toString(36)}-${(++counter).toString(36)}`;

const clipped = (v: unknown): unknown => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s === undefined) return v;
  return s.length <= MAX_KEPT_CHARS ? v : `${s.slice(0, MAX_KEPT_CHARS)}… [truncated]`;
};

/** a ToolCall fit for storage: inputs and outputs cut to size */
function forStorage(c: ToolCall): ToolCall {
  const out = { ...c, input: clipped(c.input) };
  if (c.output)
    out.output = {
      ...c.output,
      content: c.output.content === undefined ? undefined : (clipped(c.output.content) as string),
      structuredData: clipped(c.output.structuredData),
      // binary content (images, audio, blobs) stays in memory only
      ...(c.output.parts && { parts: c.output.parts.slice(0, 20).map(({ data: _data, ...p }: { data?: string } & Record<string, unknown>) => ('text' in p && typeof p.text === 'string' ? { ...p, text: clipped(p.text) } : p)) as typeof c.output.parts }),
    };
  return out;
}

export class ToolRuntime {
  private calls = new Map<string, ToolCall>();
  private waiting = new Map<string, Waiting>();
  /** "allow for this run": runId → tool ids */
  private runGrants = new Map<string, Set<string>>();
  private writer: CoalescedWriter<{ version: 1; calls: ToolCall[] }>;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private registry: ToolRegistry,
    private policy: ToolPolicyStore,
    private bus: EventBus,
    private storage: StorageAdapter,
    private opts: {
      now?: () => number;
      /** "always allow" on an agent's prompt: remember it on the agent */
      onAlwaysAllow?: (agentId: string, toolId: string) => void;
      /** every completed call with its full result and scope (ArtifactService registers outputs) */
      onCompleted?: (call: ToolCall, result: ToolResult, scope: ToolScope) => void;
      /**
       * a reason to ask for this one call although the tool is allowed (web_fetch of an address
       * that came from nowhere the user can see); never makes a call more permissive
       */
      escalate?: (toolId: string, input: unknown, scope: ToolScope) => string | undefined;
    } = {},
  ) {
    this.writer = new CoalescedWriter(storage, KEY, 1_000, (s) => ({ version: 1, calls: s.calls.slice(-MAX_KEPT_CALLS).map(forStorage) }));
  }

  async init() {
    const raw = await this.storage.get<{ calls?: ToolCall[] }>(KEY);
    const now = this.now();
    for (const c of Array.isArray(raw?.calls) ? raw.calls : []) {
      // a call cut short by a restart did not finish
      const open = c.status === 'requested' || c.status === 'awaiting_approval' || c.status === 'approved' || c.status === 'running';
      this.calls.set(c.id, open ? { ...c, status: 'cancelled', completedAt: now, error: { code: 'TOOL_CANCELLED', message: 'RealmNest was closed during this call.' } } : c);
    }
    this.changed();
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  // ── reading ──────────────────────────────────────────────
  /** most recent first */
  list(filter: { runId?: string; conversationId?: string; agentId?: string } = {}): ToolCall[] {
    return [...this.calls.values()]
      .filter((c) => (!filter.runId || c.runId === filter.runId) && (!filter.conversationId || c.conversationId === filter.conversationId) && (!filter.agentId || c.agentId === filter.agentId))
      .sort((a, b) => b.requestedAt - a.requestedAt);
  }
  get(id: string) {
    return this.calls.get(id);
  }
  /** calls waiting for the user, oldest first */
  approvals(): PendingApproval[] {
    return [...this.waiting.values()].map((w) => w.pending).sort((a, b) => a.call.requestedAt - b.call.requestedAt);
  }

  /** the permission a tool has in a scope (UI and the runtime agree) */
  permissionFor(toolId: string, scope: Pick<ToolScope, 'agentPermissions'>): ToolPermission {
    const tool = this.registry.get(toolId);
    if (!tool) return 'deny';
    return resolvePermission(tool, { agent: scope.agentPermissions?.[toolId], global: this.policy.get().global[toolId] });
  }

  // ── the user's answer ────────────────────────────────────
  decide(callId: string, decision: ApprovalDecision) {
    const w = this.waiting.get(callId);
    if (!w) return;
    this.waiting.delete(callId);
    w.resolve(decision);
  }

  /** forget "allow for this run" grants when a run ends */
  endRun(runId: string) {
    this.runGrants.delete(runId);
  }

  // ── running a call ───────────────────────────────────────
  async execute(req: ToolRequest, scope: ToolScope, signal: AbortSignal): Promise<{ call: ToolCall; result: ToolResult }> {
    const tool = this.registry.byName(req.name);
    const call: ToolCall = {
      id: newId(),
      runId: scope.runId,
      ...(scope.agentId && { agentId: scope.agentId }),
      ...(scope.conversationId && { conversationId: scope.conversationId }),
      ...(scope.taskId && { taskId: scope.taskId }),
      toolId: tool?.id ?? req.name,
      ...(req.providerCallId && { providerCallId: req.providerCallId }),
      input: req.input,
      status: 'requested',
      requestedAt: this.now(),
    };
    this.calls.set(call.id, call);
    this.emit('tool.requested', call);

    const end = (status: ToolCallStatus, result: Omit<ToolResult, 'toolCallId'>): { call: ToolCall; result: ToolResult } => {
      call.status = status;
      call.completedAt = this.now();
      call.output = result;
      if (result.error) call.error = result.error;
      this.emit(status === 'completed' ? 'tool.completed' : status === 'denied' ? 'tool.denied' : status === 'cancelled' ? 'tool.cancelled' : 'tool.failed', call);
      const full = { toolCallId: call.id, ...result };
      if (status === 'completed') this.opts.onCompleted?.(call, full, scope);
      return { call, result: full };
    };
    const failWith = (status: ToolCallStatus, error: ToolError) => end(status, { success: false, error });

    if (signal.aborted) return failWith('cancelled', { code: 'TOOL_CANCELLED', message: 'The run was stopped.' });
    if (!tool) return failWith('failed', { code: 'TOOL_NOT_FOUND', message: `There is no tool named "${req.name}".` });
    if (!scope.allowedToolIds.includes(tool.id)) return failWith('denied', { code: 'TOOL_NOT_ALLOWED', message: `${tool.name} is not enabled here.` });
    if (typeof req.input !== 'object' || req.input === null || Array.isArray(req.input)) return failWith('failed', { code: 'INVALID_TOOL_INPUT', message: 'The tool input must be a JSON object.' });
    const problem = validateInput(tool.inputSchema, req.input);
    if (problem) return failWith('failed', { code: 'INVALID_TOOL_INPUT', message: problem });

    let permission = this.permissionFor(tool.id, scope);
    const why = permission === 'allow' ? this.opts.escalate?.(tool.id, req.input, scope) : undefined;
    if (why) {
      permission = 'ask';
      call.approvalReason = why;
    }
    call.permission = permission;
    if (permission === 'deny') return failWith('denied', { code: 'TOOL_NOT_ALLOWED', message: `${tool.name} is set to "never" in RealmNest.` });
    // an escalated call (e.g. an address the user never saw) asks even after "allow for this run" (docs/HARDENING.md R-16)
    if (permission === 'ask' && (why || !this.runGrants.get(scope.runId)?.has(tool.id))) {

      call.status = 'awaiting_approval';
      this.emit('tool.awaiting_approval', call);
      const decision = await new Promise<ApprovalDecision | 'cancelled'>((resolve) => {
        const onAbort = () => {
          this.waiting.delete(call.id);
          resolve('cancelled');
        };
        signal.addEventListener('abort', onAbort, { once: true });
        this.waiting.set(call.id, { pending: { call, requester: scope.requester }, resolve: (d) => (signal.removeEventListener('abort', onAbort), resolve(d)) });
        this.changed();
      });
      this.changed();
      if (decision === 'cancelled') return failWith('cancelled', { code: 'TOOL_CANCELLED', message: 'The run was stopped while waiting for approval.' });
      if (decision === 'deny') return failWith('denied', { code: 'APPROVAL_DENIED', message: `The user did not allow ${tool.name}.` });
      if (decision === 'run' || decision === 'always') {
        const set = this.runGrants.get(scope.runId) ?? new Set<string>();
        set.add(tool.id);
        this.runGrants.set(scope.runId, set);
      }
      if (decision === 'always' && scope.agentId) this.opts.onAlwaysAllow?.(scope.agentId, tool.id);
    }
    call.status = 'approved';
    call.approvedAt = this.now();
    this.emit('tool.approved', call);

    const executor = this.registry.executor(tool.id);
    if (!executor) return failWith('failed', { code: 'TOOL_UNAVAILABLE', message: `${tool.name} cannot run in this build.` });
    if (tool.needsWorkspace && !scope.workspace) return failWith('failed', { code: 'WORKSPACE_REQUIRED', message: 'No workspace folder is set (Settings › General › Tools, or the agent’s Tools section).' });

    call.status = 'running';
    call.startedAt = this.now();
    this.emit('tool.started', call);
    const ac = new AbortController();
    const stop = () => ac.abort();
    signal.addEventListener('abort', stop, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        executor({ callId: call.id, input: req.input as Record<string, unknown>, workspace: scope.workspace, signal: ac.signal, attachments: scope.attachments ?? [], runId: scope.runId }).then((r) => ({ kind: 'done' as const, r })),
        new Promise<{ kind: 'timeout' }>((resolve) => (timer = setTimeout(() => resolve({ kind: 'timeout' }), tool.timeoutMs))),
        new Promise<{ kind: 'cancelled' }>((resolve) => (ac.signal.aborted ? resolve({ kind: 'cancelled' }) : ac.signal.addEventListener('abort', () => resolve({ kind: 'cancelled' }), { once: true }))),
      ]);
      if (outcome.kind === 'timeout') {
        ac.abort();
        return failWith('failed', { code: 'TOOL_TIMEOUT', message: `${tool.name} did not finish within ${Math.round(tool.timeoutMs / 1000)} s.` });
      }
      if (outcome.kind === 'cancelled') return failWith('cancelled', { code: 'TOOL_CANCELLED', message: 'The run was stopped.' });
      const r = outcome.r;
      return end(r.success ? 'completed' : 'failed', r.success ? r : { ...r, error: r.error ?? { code: 'TOOL_EXECUTION_FAILED', message: `${tool.name} failed.` } });
    } catch (err) {
      return failWith('failed', { code: 'TOOL_EXECUTION_FAILED', message: `${tool.name} failed: ${String(err).slice(0, 300)}` });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
    }
  }

  private emit(type: 'tool.requested' | 'tool.awaiting_approval' | 'tool.approved' | 'tool.denied' | 'tool.started' | 'tool.completed' | 'tool.failed' | 'tool.cancelled', c: ToolCall) {
    // ids and outcome only: inputs and outputs stay in the call record, not the event log
    this.bus.emit(
      type,
      {
        toolCallId: c.id,
        runId: c.runId,
        toolId: c.toolId,
        ...(c.agentId && { agentId: c.agentId }),
        ...(c.conversationId && { conversationId: c.conversationId }),
        ...(c.error && { code: c.error.code }),
      },
      LIVE,
    );
    // bounded in memory too: the oldest finished calls go first
    if (this.calls.size > MAX_KEPT_CALLS * 1.2) {
      const old = [...this.calls.values()].filter((x) => !this.waiting.has(x.id) && x.completedAt).sort((a, b) => a.requestedAt - b.requestedAt);
      for (const x of old.slice(0, this.calls.size - MAX_KEPT_CALLS)) this.calls.delete(x.id);
    }
    this.writer.touch(() => ({ version: 1, calls: [...this.calls.values()].sort((a, b) => a.requestedAt - b.requestedAt) }));
    this.changed();
  }

  flush() {
    return this.writer.flush(() => ({ version: 1, calls: [...this.calls.values()].sort((a, b) => a.requestedAt - b.requestedAt) }));
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

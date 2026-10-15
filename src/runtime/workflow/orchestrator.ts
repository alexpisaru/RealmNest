// The ORCHESTRATOR (docs/WORKFLOWS.md): how a run is carried out. Given a WorkflowRun (created by
// the user or by the scheduler — never started here on its own), it decides which nodes are ready,
// who executes them (an agent task, a tool call, a Crew run, a timer, a person), and what happens
// on failure, timeout, retry, branches, merges, approvals, budget and concurrency.
//
// Durable: every change is saved. After a restart, waits and approval nodes carry on as they were;
// nodes that were executing (or waiting for a tool approval, which lived in memory) become
// "interrupted" and the run "suspended" until Resume.

import type { EventBus } from '../../core/events';
import type { AgentRun } from '../../domain/agent';
import { isOpenRun, WORKFLOW_LIMITS, workflowOrder, type NodeRun, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode, type WorkflowRun, type WorkflowRunEvent, type WorkflowTrigger } from '../../domain/workflow';
import { onFlushAll } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';
import type { CrewService } from '../crew/service';
import type { LiveRuntime } from '../live/liveRuntime';
import { parseJsonObject } from '../research/json';
import { renderTemplate, WorkflowError } from './library';

const INDEX = 'workflow-runs';
const runKey = (id: string) => `workflow-run.${id}`;
const TICK_MS = 30_000;

export interface ToolRunner {
  /** one tool call for a workflow node; approvals and permissions as everywhere else. `code`: the ToolResult error code */
  run(toolId: string, input: Record<string, string>, ctx: { runId: string; requester: string; signal: AbortSignal }): Promise<{ ok: boolean; output: string; error?: string; code?: string }>;
  /** a call of this tool may be made again after a failure (read-only / low risk); without it, tool nodes are not retried */
  retryable?(toolId: string): boolean;
  /** the node's call ended: "allow for this run" grants go with it */
  endRun?(runId: string): void;
}

/** a refusal that another attempt cannot change (docs/HARDENING.md R-12) */
const FINAL_CODES = new Set(['APPROVAL_DENIED', 'TOOL_NOT_ALLOWED']);
/** node states where something may still be executing (an agent task, a tool call or its approval, a crew run) */
const BUSY_NODE = new Set<NodeRun['status']>(['running', 'awaiting_approval', 'interrupted']);

export interface OrchestratorOptions {
  tools?: ToolRunner;
  crews?: CrewService;
  /** keeps an output node's content as an Artifact; its id */
  keep?: (o: { name: string; text: string; runId: string; nodeId: string }) => Promise<string | undefined>;
  name?: (agentId: string) => string | undefined;
  now?: () => number;
}

type Live = { runId: string; nodeId: string; kind: 'agent' | 'condition' };

export class Orchestrator {
  private runs = new Map<string, WorkflowRun>();
  private order: string[] = [];
  /** agent run id → the node it executes */
  private links = new Map<string, Live>();
  /** node key (run|node) → the controller of a tool call in flight (one attempt's: an older one's end is ignored) */
  private aborts = new Map<string, AbortController>();
  /** nodes whose last failure must not be retried (a denial, a tool that is not safe to repeat) */
  private noRetry = new Set<string>();
  /** runs loaded at start (a catch-up must not overlap them either) */
  private loaded = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // delayed saves are written when the window closes (docs/HARDENING.md D-8)
  readonly stopFlush = onFlushAll(() => this.flushPending());

  constructor(
    private storage: StorageAdapter,
    private bus: EventBus,
    private live: LiveRuntime,
    private opts: OrchestratorOptions = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private now = () => (this.opts.now ?? Date.now)();
  private nameOf = (id: string | undefined) => (id && this.opts.name?.(id)) || id || '?';

  async init() {
    const ids = (await this.storage.get<string[]>(INDEX)) ?? [];
    for (const id of ids) {
      const r = await this.storage.get<WorkflowRun>(runKey(id));
      if (!r) continue;
      if (isOpenRun(r.status)) {
        // what was executing is gone with the old process; waits and approval nodes carry on. A tool
        // call waiting for approval is gone too (approvals live in memory): it is interrupted, never
        // stuck (docs/HARDENING.md R-3). A crew node follows its crew run, unless that was interrupted (R-14).
        let cut = false;
        for (const n of Object.values(r.nodes)) {
          const kind = this.kindOf(r, n.nodeId);
          const crewGone = kind === 'crew' && (!n.crewRunId || !this.opts.crews || this.opts.crews.run(n.crewRunId)?.status === 'interrupted' || !this.opts.crews.run(n.crewRunId));
          if ((n.status === 'running' && (kind !== 'crew' || crewGone)) || (n.status === 'awaiting_approval' && (kind === 'tool' || kind === 'agent'))) {
            n.status = 'interrupted';
            cut = true;
          }
        }
        if (cut) {
          r.status = 'suspended';
          r.pausedSince ??= r.updatedAt;
          r.seen = false;
          this.event(r, 'suspend', 'RealmNest closed while the run was working: Resume to go on.', undefined, ['suspended', {}]);
        }
      }
      this.runs.set(id, r);
      this.order.push(id);
      this.loaded.add(id);
    }
    for (const ev of ['agent.run.completed', 'agent.run.failed', 'agent.run.cancelled'] as const) this.bus.on(ev, (p: { runId: string }) => queueMicrotask(() => this.onAgentRun(p.runId)));
    this.bus.on('agent.idle', () => this.pumpAll());
    this.bus.on('tool.awaiting_approval', (c) => this.onToolApproval(c.runId, true));
    this.bus.on('tool.approved', (c) => this.onToolApproval(c.runId, false));
    this.bus.on('crew.event', (p) => queueMicrotask(() => this.onCrew(p.runId)));
    this.interval = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.changed();
  }

  dispose() {
    clearTimeout(this.timer);
    clearInterval(this.interval);
  }

  // ── reading ─────────────────────────────────────────────
  list(workflowId?: string): WorkflowRun[] {
    return this.order.map((id) => this.runs.get(id)!).filter((r) => r && (!workflowId || r.workflowId === workflowId));
  }
  get(id: string) {
    return this.runs.get(id);
  }
  /** runs that need the user: a decision waiting, a suspended run, an unseen failure or end */
  inbox(): WorkflowRun[] {
    return this.list().filter((r) => r.status === 'awaiting_approval' || r.status === 'suspended' || ((r.status === 'failed' || r.status === 'completed' || r.status === 'cancelled') && r.seen === false));
  }
  private kindOf = (r: WorkflowRun, nodeId: string) => r.definition.nodes.find((n) => n.id === nodeId)?.config.kind;
  private node = (r: WorkflowRun, nodeId: string) => r.definition.nodes.find((n) => n.id === nodeId)!;

  // ── creating ────────────────────────────────────────────
  /** a run of a definition (the definition is copied: later edits do not touch it); starts at once */
  create(definition: WorkflowDefinition, inputs: Record<string, string> = {}, trigger: WorkflowTrigger = { kind: 'manual' }): WorkflowRun {
    if (!workflowOrder(definition.nodes, definition.edges)) throw new WorkflowError('This workflow has a loop.', 'loop');
    // a schedule: once per due time, and never on top of its previous run still open (docs/HARDENING.md R-13)
    if (trigger.scheduleId && trigger.kind !== 'manual') {
      const mine = [...this.runs.values()].filter((x) => x.trigger.scheduleId === trigger.scheduleId);
      if (trigger.dueAt !== undefined && !trigger.byUser && mine.some((x) => x.trigger.dueAt === trigger.dueAt)) throw new WorkflowError('A run was already created for this time.', 'duplicate');
      // a catch-up batch may make several runs at once (catch-up "all"): only runs from before count against it
      if (!trigger.byUser && mine.some((x) => isOpenRun(x.status) && (trigger.kind === 'schedule' || this.loaded.has(x.id)))) throw new WorkflowError('skipped: previous run still running', 'overlap');
    }
    // only ended runs make room: an open one is never dropped (docs/HARDENING.md R-7)
    if (this.order.length >= WORKFLOW_LIMITS.runs && !this.order.some((id) => !isOpenRun(this.runs.get(id)?.status ?? 'completed')))
      throw new WorkflowError(`There are already ${WORKFLOW_LIMITS.runs} runs open: stop or delete one first.`, 'tooManyRuns', { n: String(WORKFLOW_LIMITS.runs) });
    const values: Record<string, string> = {};
    for (const i of definition.inputs) {
      const v = (inputs[i.name] ?? i.default ?? '').toString();
      if (i.required && !v.trim()) throw new WorkflowError(`"${i.label ?? i.name}" is required.`, 'required', { name: i.label ?? i.name });
      values[i.name] = v.slice(0, 8000);
    }
    const t = this.now();
    const run: WorkflowRun = {
      id: `wfr-${t.toString(36)}-${(++this.counter).toString(36)}`,
      workflowId: definition.id,
      definition: structuredClone(definition),
      trigger,
      inputs: values,
      status: 'running',
      nodes: Object.fromEntries(definition.nodes.map((n) => [n.id, { nodeId: n.id, status: 'pending' as const, attempts: 0 }])),
      artifacts: [],
      budget: { tokens: 0, usd: 0 },
      history: [],
      createdAt: t,
      updatedAt: t,
      startedAt: t,
    };
    this.runs.set(run.id, run);
    this.order.unshift(run.id);
    for (let i = this.order.length - 1; i >= 0 && this.order.length > WORKFLOW_LIMITS.runs; i--) {
      const old = this.runs.get(this.order[i]);
      if (old && isOpenRun(old.status)) continue;
      const [gone] = this.order.splice(i, 1);
      this.runs.delete(gone);
      this.loaded.delete(gone);
      void this.storage.remove(runKey(gone));
    }
    void this.storage.set(INDEX, this.order);
    const by = trigger.kind === 'manual' ? 'by you' : trigger.kind === 'catchup' ? `as a catch-up (${trigger.missed ?? 1} missed)` : 'by its schedule';
    this.event(run, 'start', `Run of "${definition.name}" v${definition.version} started ${by}.`, undefined, [trigger.kind === 'manual' ? 'startManual' : trigger.kind === 'catchup' ? 'startCatchup' : 'startSchedule', { name: definition.name, v: String(definition.version), n: String(trigger.missed ?? 1) }]);
    this.pump(run);
    // saved at once: a scheduled run must be on disk before anything else happens (R-13)
    this.touch(run, true);
    return run;
  }

  // ── the engine ──────────────────────────────────────────
  /** live: the edge can be followed · dead: it never will · open: not yet known */
  private edgeState(r: WorkflowRun, e: WorkflowEdge): 'live' | 'dead' | 'open' {
    const src = r.nodes[e.from];
    const policy = this.node(r, e.from).policy;
    if (src.status === 'completed') return !e.when || src.value === e.when ? 'live' : 'dead';
    if (src.status === 'failed' && policy?.onFail === 'continue') return e.when ? 'dead' : 'live';
    if (src.status === 'skipped' || src.status === 'cancelled' || src.status === 'failed') return 'dead';
    return 'open';
  }

  /** move the run on: activate, skip, start; then settle the run's status */
  private pump(r: WorkflowRun) {
    if (!isOpenRun(r.status) || r.status === 'suspended') return;
    if (this.overLimits(r)) return;
    const order = workflowOrder(r.definition.nodes, r.definition.edges)!;
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of order) {
        const n = r.nodes[id];
        if (n.status !== 'pending') continue;
        const incoming = r.definition.edges.filter((e) => e.to === id);
        const states = incoming.map((e) => this.edgeState(r, e));
        const node = this.node(r, id);
        const any = node.config.kind === 'merge' && node.config.mode === 'any';
        if (!incoming.length || (any && states.includes('live')) || (!states.includes('open') && states.includes('live'))) {
          n.status = 'ready';
          changed = true;
        } else if (!states.includes('open')) {
          n.status = 'skipped';
          n.finishedAt = this.now();
          this.event(r, 'skip', `${node.title} is skipped (no branch leads to it).`, id, ['skipped', { node: node.title }]);
          changed = true;
        }
      }
      // a merge on "any" that already ran makes the other branches' work pointless: nothing to do
    }
    const max = r.definition.policies.maxConcurrency ?? Infinity;
    for (const id of order) {
      const n = r.nodes[id];
      if (n.status !== 'ready') continue;
      if (Object.values(r.nodes).filter((x) => x.status === 'running').length >= max) break;
      this.start(r, this.node(r, id));
    }
    this.settle(r);
  }

  private settle(r: WorkflowRun) {
    if (!isOpenRun(r.status) || r.status === 'suspended') return this.touch(r);
    const all = Object.values(r.nodes);
    const has = (s: NodeRun['status']) => all.some((n) => n.status === s);
    const failing = all.find((n) => n.status === 'failed' && (this.node(r, n.nodeId).policy?.onFail ?? 'fail') === 'fail');
    if (failing) return this.finish(r, 'failed', `${this.node(r, failing.nodeId).title} failed: ${failing.error ?? 'error'}`, ['nodeFailed', { node: this.node(r, failing.nodeId).title, error: failing.error ?? 'error' }]);
    if (has('running') || has('ready')) r.status = 'running';
    else if (has('awaiting_approval')) {
      if (r.status !== 'awaiting_approval') r.seen = false;
      r.status = 'awaiting_approval';
    } else if (has('waiting')) r.status = 'waiting';
    else if (has('interrupted')) r.status = 'suspended';
    else if (!has('pending')) return this.finish(r, 'completed');
    else r.status = 'running';
    this.touch(r);
    this.arm();
  }

  private finish(r: WorkflowRun, status: 'completed' | 'failed' | 'cancelled', error?: string, why?: [string, Record<string, string>]) {
    this.unpause(r);
    r.status = status;
    r.finishedAt = this.now();
    r.seen = false;
    if (error) r.error = error;
    if (why) ((r.errorKey = why[0]), (r.errorVars = why[1]));
    // nothing keeps running for a run that ended: every open node is stopped, so a tool call waiting
    // for approval is cancelled too and its prompt goes (docs/HARDENING.md R-2)
    for (const n of Object.values(r.nodes)) {
      if (BUSY_NODE.has(n.status)) this.stopNode(r, n);
      if (n.status === 'pending' || n.status === 'ready' || n.status === 'waiting' || n.status === 'awaiting_approval' || n.status === 'running' || n.status === 'interrupted') ((n.status = 'cancelled'), (n.finishedAt = this.now()));
    }
    if (status === 'completed') this.event(r, 'complete', 'The run completed.', undefined, ['completed', {}]);
    else if (status === 'failed') this.event(r, 'fail', `The run failed: ${error}`, undefined, ['runFailed', { error: error ?? '', ...(why && { errorKey: why[0], ...why[1] }) }]);
    else this.event(r, 'cancel', 'The run was stopped.', undefined, ['stopped', {}]);
    this.touch(r, true);
  }

  /** budget and duration: going over stops the run */
  private overLimits(r: WorkflowRun): boolean {
    const p = r.definition.policies;
    if (p.budgetTokens && r.budget.tokens > p.budgetTokens) {
      this.event(r, 'budget', `Token budget reached (${r.budget.tokens} of ${p.budgetTokens}).`, undefined, ['budgetTokens', { used: String(r.budget.tokens), max: String(p.budgetTokens) }]);
      this.finish(r, 'failed', 'token budget reached', ['budgetTokens', { max: String(p.budgetTokens) }]);
      return true;
    }
    if (p.budgetUsd && r.budget.usd > p.budgetUsd) {
      this.event(r, 'budget', `Cost budget reached ($${r.budget.usd.toFixed(2)} of $${p.budgetUsd}).`, undefined, ['budgetUsd', { used: r.budget.usd.toFixed(2), max: String(p.budgetUsd) }]);
      this.finish(r, 'failed', 'cost budget reached', ['budgetUsd', { max: String(p.budgetUsd) }]);
      return true;
    }
    if (p.maxMinutes && r.startedAt && this.activeMs(r) > p.maxMinutes * 60_000) {
      this.finish(r, 'failed', `longer than ${p.maxMinutes} minutes`, ['tooLong', { n: String(p.maxMinutes) }]);
      return true;
    }
    return false;
  }

  /** how long the run has worked: waiting for the user and being suspended do not count */
  activeMs(r: WorkflowRun): number {
    const end = r.finishedAt ?? this.now();
    return Math.max(0, end - (r.startedAt ?? r.createdAt) - (r.pausedMs ?? 0) - (r.pausedSince !== undefined ? end - r.pausedSince : 0));
  }
  private unpause(r: WorkflowRun) {
    if (r.pausedSince === undefined) return;
    r.pausedMs = (r.pausedMs ?? 0) + Math.max(0, this.now() - r.pausedSince);
    delete r.pausedSince;
  }

  private ctx(r: WorkflowRun) {
    return { inputs: r.inputs, node: (id: string) => r.nodes[id], now: this.now() };
  }

  /** start a ready node, by kind */
  private start(r: WorkflowRun, node: WorkflowNode) {
    const n = r.nodes[node.id];
    const c = node.config;
    const render = (s: string) => renderTemplate(s, this.ctx(r));
    switch (c.kind) {
      case 'parallel':
        return this.complete(r, n, '');
      case 'merge': {
        const ins = r.definition.edges.filter((e) => e.to === node.id && this.edgeState(r, e) === 'live').map((e) => r.nodes[e.from].output ?? '');
        return this.complete(r, n, ins.filter(Boolean).join('\n\n'));
      }
      case 'condition':
        if (c.test === 'agent') return this.startAgent(r, node, c.agentId, `${c.question}\n\nWhat to judge:\n<<<\n${render(c.source)}\n>>>\n\nAnswer with JSON only: {"answer": "yes"} or {"answer": "no"}.`, 'condition');
        {
          const src = render(c.source);
          const ok = c.test === 'notEmpty' ? !!src.trim() : c.test === 'equals' ? src.trim() === render(c.value ?? '').trim() : src.toLowerCase().includes(render(c.value ?? '').toLowerCase());
          return this.complete(r, n, '', ok ? 'true' : 'false');
        }
      case 'wait': {
        const at = c.mode === 'duration' ? this.now() + c.minutes * 60_000 : Date.parse(render(c.at));
        if (!Number.isFinite(at)) return this.fail(r, node, `"${render((c as { at: string }).at)}" is not a time`);
        n.status = 'waiting';
        n.wakeAt = at;
        n.startedAt = this.now();
        this.event(r, 'wait', `${node.title} waits until ${new Date(at).toLocaleString()}.`, node.id, ['waits', { node: node.title, until: new Date(at).toISOString() }]);
        return;
      }
      case 'approval':
        n.status = 'awaiting_approval';
        n.prompt = render(c.prompt).slice(0, 12_000);
        n.startedAt = this.now();
        r.seen = false;
        this.event(r, 'approval', `${node.title} waits for your decision.`, node.id, ['awaitsYou', { node: node.title }]);
        return;
      case 'output':
        n.status = 'running';
        n.startedAt = this.now();
        void (async () => {
          const text = render(c.content);
          const id = await this.opts.keep?.({ name: render(c.name), text, runId: r.id, nodeId: node.id }).catch(() => undefined);
          if (id) ((n.artifactId = id), r.artifacts.push(id));
          // the run was stopped meanwhile: the file stays, the node does not complete (R-21)
          if (n.status !== 'running') return this.touch(r, true);
          this.complete(r, n, text);
        })();
        return;
      case 'agent':
        return this.startAgent(r, node, c.agentId, render(c.prompt), 'agent');
      case 'tool':
        return this.startTool(r, node, c.toolId, Object.fromEntries(Object.entries(c.input).map(([k, v]) => [k, render(v)])));
      case 'crew':
        return this.startCrew(r, node, c.crewId, render(c.goal));
    }
  }

  private startAgent(r: WorkflowRun, node: WorkflowNode, agentId: string, prompt: string, kind: 'agent' | 'condition') {
    const n = r.nodes[node.id];
    // one task at a time per agent: it waits, ready, and starts when the agent is free
    if (this.live.activeRun(agentId)) return;
    try {
      const started = this.live.startTask(agentId, { prompt, title: `${r.definition.name} · ${node.title}`.slice(0, 120), workflow: { workflowId: r.workflowId, runId: r.id, nodeId: node.id } });
      this.links.set(started.run.id, { runId: r.id, nodeId: node.id, kind });
      n.status = 'running';
      n.attempts++;
      n.startedAt = this.now();
      n.agentTaskId = started.task.id;
      n.agentRunId = started.run.id;
      delete n.error;
      this.event(r, 'node', `${this.nameOf(agentId)} starts ${node.title}.`, node.id, ['agentStarts', { name: this.nameOf(agentId), node: node.title }], agentId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already working/.test(msg)) return;
      this.fail(r, node, msg);
    }
  }

  private startTool(r: WorkflowRun, node: WorkflowNode, toolId: string, input: Record<string, string>) {
    const n = r.nodes[node.id];
    if (!this.opts.tools) return this.fail(r, node, 'tools are not available here');
    const tools = this.opts.tools;
    const ac = new AbortController();
    const key = `${r.id}|${node.id}`;
    // an older attempt still in flight (a timeout, a retry) is stopped: one call per node at a time
    this.aborts.get(key)?.abort();
    this.aborts.set(key, ac);
    n.status = 'running';
    n.attempts++;
    n.startedAt = this.now();
    delete n.error;
    this.noRetry.delete(key);
    this.event(r, 'node', `${node.title}: ${toolId}.`, node.id, ['toolStarts', { node: node.title, tool: toolId }]);
    const callRunId = `${r.id}~${node.id}`;
    // only this attempt's end counts: a stopped or older one settles later and is ignored (docs/HARDENING.md R-1)
    const settle = (fn: () => void) => {
      if (this.aborts.get(key) !== ac) return;
      this.aborts.delete(key);
      // its "allow for this run" grant ends with the call (R-20)
      tools.endRun?.(callRunId);
      if (n.status !== 'running' && n.status !== 'awaiting_approval') return;
      fn();
    };
    void tools
      .run(toolId, input, { runId: callRunId, requester: `Workflow ${r.definition.name}`, signal: ac.signal })
      .then((res) =>
        settle(() => {
          if (res.ok) return this.complete(r, n, res.output);
          // a refusal is final; a tool that is not safe to repeat is not called again (R-12)
          if ((res.code && FINAL_CODES.has(res.code)) || !tools.retryable?.(toolId)) this.noRetry.add(key);
          this.fail(r, node, res.error ?? 'the tool failed');
        }),
      )
      .catch((e) =>
        settle(() => {
          if (!tools.retryable?.(toolId)) this.noRetry.add(key);
          this.fail(r, node, e instanceof Error ? e.message : String(e));
        }),
      );
  }

  private startCrew(r: WorkflowRun, node: WorkflowNode, crewId: string, goal: string) {
    const n = r.nodes[node.id];
    if (!this.opts.crews) return this.fail(r, node, 'crews are not available here');
    try {
      const run = this.opts.crews.start(crewId, goal);
      n.status = 'running';
      n.attempts++;
      n.startedAt = this.now();
      n.crewRunId = run.id;
      delete n.error;
      this.event(r, 'node', `The crew "${run.crew.name}" starts on: ${goal.slice(0, 80)}`, node.id, ['crewStarts', { crew: run.crew.name, node: node.title }]);
    } catch (e) {
      this.fail(r, node, e instanceof Error ? e.message : String(e));
    }
  }

  private complete(r: WorkflowRun, n: NodeRun, output: string, value?: string) {
    n.status = 'completed';
    n.output = output.slice(0, WORKFLOW_LIMITS.outputChars);
    if (value !== undefined) n.value = value;
    n.finishedAt = this.now();
    delete n.wakeAt;
    const node = this.node(r, n.nodeId);
    if (node.config.kind !== 'parallel' && node.config.kind !== 'merge') this.event(r, 'done', `${node.title} is done${value ? ` (${value})` : ''}.`, n.nodeId, [value ? 'doneValue' : 'done', { node: node.title, value: value ?? '' }]);
    this.pump(r);
  }

  /** a failure: retry (with backoff) while attempts remain, then the node's policy */
  private fail(r: WorkflowRun, node: WorkflowNode, error: string) {
    const n = r.nodes[node.id];
    const p = node.policy ?? {};
    n.error = error.slice(0, 600);
    const retries = p.retries ?? 0;
    const final = this.noRetry.delete(`${r.id}|${node.id}`);
    if (!final && n.attempts <= retries && n.attempts > 0) {
      const wait = (p.backoffMinutes ?? 0) * 60_000 * 2 ** (n.attempts - 1);
      n.status = wait > 0 ? 'waiting' : 'ready';
      if (wait > 0) n.wakeAt = this.now() + wait;
      this.event(r, 'retry', `${node.title} failed (${error.slice(0, 120)}); attempt ${n.attempts + 1} of ${retries + 1}${wait ? ` in ${Math.round(wait / 60_000)} min` : ''}.`, node.id, ['retry', { node: node.title, error: error.slice(0, 120), n: String(n.attempts + 1), of: String(retries + 1) }]);
      return this.pump(r);
    }
    n.finishedAt = this.now();
    if (p.onFail === 'skip') {
      n.status = 'skipped';
      this.event(r, 'skip', `${node.title} failed and is skipped: ${error.slice(0, 160)}`, node.id, ['failSkipped', { node: node.title, error: error.slice(0, 160) }]);
    } else {
      n.status = 'failed';
      if (p.onFail === 'continue') n.output = `ERROR: ${error}`;
      this.event(r, 'fail', `${node.title} failed: ${error.slice(0, 200)}`, node.id, ['nodeFailed', { node: node.title, error: error.slice(0, 200) }]);
    }
    this.pump(r);
  }

  private stopNode(r: WorkflowRun, n: NodeRun) {
    const key = `${r.id}|${n.nodeId}`;
    const ac = this.aborts.get(key);
    // aborted and forgotten: whenever that call settles, its result is ignored (R-1); its run grant goes (R-20)
    if (ac) (ac.abort(), this.aborts.delete(key), this.opts.tools?.endRun?.(`${r.id}~${n.nodeId}`));

    if (n.agentRunId) {
      const ar = this.live.getRun(n.agentRunId);
      if (ar && this.live.activeRun(ar.agentId)?.id === ar.id) void this.live.cancel(ar.agentId);
    }
    if (n.crewRunId) void this.opts.crews?.cancel(n.crewRunId).catch(() => undefined);
  }

  // ── what executes them ends ─────────────────────────────
  private onAgentRun(agentRunId: string) {
    const link = this.links.get(agentRunId);
    if (!link) {
      this.chargeChild(agentRunId);
      return void this.pumpAll();
    }
    this.links.delete(agentRunId);
    const r = this.runs.get(link.runId);
    const ar = this.live.getRun(agentRunId);
    if (!r || !ar) return;
    const n = r.nodes[link.nodeId];
    this.charge(r, ar);
    if (n.status !== 'running' || n.agentRunId !== agentRunId) return this.pumpAll();
    const node = this.node(r, link.nodeId);
    const text = (ar.result ?? ar.output ?? '').trim();
    if (ar.status === 'completed') {
      if (link.kind === 'condition') {
        const a = String(parseJsonObject(text)?.answer ?? (/\byes\b|\bsì\b|\bsi\b/i.test(text) ? 'yes' : 'no')).toLowerCase();
        this.complete(r, n, text, a.startsWith('y') || a.startsWith('s') ? 'true' : 'false');
      } else this.complete(r, n, text);
    } else this.fail(r, node, n.error === 'timeout' ? 'timed out' : ar.status === 'cancelled' ? 'stopped' : (ar.error?.message ?? 'the task failed'));
    this.pumpAll();
  }

  /** what a run's agents consumed counts against its budget */
  private charge(r: WorkflowRun, ar: AgentRun) {
    const u = ar.usage;
    if (u) r.budget.tokens += u.inputTokens + u.outputTokens + (u.cacheWriteTokens ?? 0);
    if (ar.costUsd) r.budget.usd += ar.costUsd;
  }

  /** work done for a node by others counts too: a colleague's delegated task, a crew node's agents (R-17) */
  private chargeChild(agentRunId: string) {
    const ar = this.live.getRun(agentRunId);
    if (!ar) return;
    // up the chain of hand-overs: the first run that belongs to a node (or to a crew node's crew)
    let cur: AgentRun | undefined = ar;
    for (let i = 0; cur && i < 12; i++) {
      const l = this.links.get(cur.id);
      const r = l && this.runs.get(l.runId);
      if (r) return void (isOpenRun(r.status) && this.charge(r, ar));
      const crewRunId = this.live.getTask(cur.taskId)?.crew?.runId;
      if (crewRunId) {
        for (const x of this.runs.values()) if (isOpenRun(x.status) && Object.values(x.nodes).some((n) => n.crewRunId === crewRunId)) return void this.charge(x, ar);
        return;
      }
      cur = cur.parentRunId ? this.live.getRun(cur.parentRunId) : undefined;
    }
  }


  private onToolApproval(callRunId: string | undefined, waiting: boolean) {
    const [runId, nodeId] = (callRunId ?? '').split('~');
    const r = runId ? this.runs.get(runId) : undefined;
    const n = r && nodeId ? r.nodes[nodeId] : undefined;
    if (!r || !n) return;
    if (waiting && n.status === 'running') {
      n.status = 'awaiting_approval';
      r.seen = false;
      this.event(r, 'approval', `${this.node(r, nodeId).title} waits for your approval of a tool.`, nodeId, ['toolApproval', { node: this.node(r, nodeId).title }]);
    } else if (!waiting && n.status === 'awaiting_approval') n.status = 'running';
    this.settle(r);
  }

  private onCrew(crewRunId: string) {
    for (const r of this.runs.values()) {
      if (!isOpenRun(r.status)) continue;
      for (const n of Object.values(r.nodes)) {
        if (n.crewRunId !== crewRunId || (n.status !== 'running' && n.status !== 'awaiting_approval')) continue;
        const c = this.node(r, n.nodeId).config;
        const cr = this.opts.crews?.run(crewRunId);
        if (!cr || c.kind !== 'crew') continue;
        if (cr.status === 'awaiting_plan' && c.autoApprovePlan !== false) {
          try {
            this.opts.crews!.approvePlan(crewRunId);
          } catch {
            /* already started */
          }
        } else if (cr.status === 'awaiting_approval') {
          if (c.autoApproveFinal) this.opts.crews!.approveFinal(crewRunId);
          else if (n.status !== 'awaiting_approval') {
            n.status = 'awaiting_approval';
            r.seen = false;
            this.event(r, 'approval', `${this.node(r, n.nodeId).title}: the crew's result waits for your approval (Crew screen).`, n.nodeId, ['crewApproval', { node: this.node(r, n.nodeId).title }]);
          }
        } else if (cr.status === 'done') this.complete(r, n, cr.final?.text ?? '');
        else if (cr.status === 'failed' || cr.status === 'cancelled') this.fail(r, this.node(r, n.nodeId), cr.error ?? `the crew run ${cr.status}`);
        this.settle(r);
      }
    }
  }

  // ── time ────────────────────────────────────────────────
  /** due waits, retries and timeouts; then every open run moves on */
  tick() {
    const t = this.now();
    for (const r of this.runs.values()) {
      if (!isOpenRun(r.status) || r.status === 'suspended') continue;
      for (const n of Object.values(r.nodes)) {
        const node = this.node(r, n.nodeId);
        if (n.status === 'waiting' && n.wakeAt !== undefined && n.wakeAt <= t) {
          delete n.wakeAt;
          if (node.config.kind === 'wait') this.complete(r, n, '');
          else n.status = 'ready';
        }
        const limit = node.policy?.timeoutMinutes;
        if (n.status === 'running' && limit && n.startedAt && t - n.startedAt > limit * 60_000) {
          n.error = 'timeout';
          this.event(r, 'timeout', `${node.title} took longer than ${limit} min: stopped.`, n.nodeId, ['timeout', { node: node.title, n: String(limit) }]);
          if (node.config.kind === 'tool' || node.config.kind === 'crew') {
            this.stopNode(r, n);
            // a tool that is not safe to repeat is not called again after its timeout (R-12)
            if (node.config.kind === 'tool' && !this.opts.tools?.retryable?.(node.config.toolId)) this.noRetry.add(`${r.id}|${n.nodeId}`);

            this.fail(r, node, 'timed out');
          } else this.stopNode(r, n);
        }
      }
      this.pump(r);
    }
    this.arm();
  }

  private pumpAll() {
    for (const r of this.runs.values()) if (isOpenRun(r.status) && r.status !== 'suspended') this.pump(r);
  }

  /** one timer for the next due wait / retry */
  private arm() {
    clearTimeout(this.timer);
    let next = Infinity;
    for (const r of this.runs.values()) if (isOpenRun(r.status)) for (const n of Object.values(r.nodes)) if (n.wakeAt !== undefined) next = Math.min(next, n.wakeAt);
    if (next === Infinity) return;
    this.timer = setTimeout(() => this.tick(), Math.max(50, Math.min(next - this.now(), 2 ** 31 - 1)));
  }

  // ── the user ────────────────────────────────────────────
  decide(runId: string, nodeId: string, decision: 'approved' | 'rejected') {
    const r = this.require(runId);
    const n = r.nodes[nodeId];
    if (!n || n.status !== 'awaiting_approval' || this.kindOf(r, nodeId) !== 'approval') throw new WorkflowError('Nothing waits for a decision here.');
    this.event(r, 'approval', `You ${decision} ${this.node(r, nodeId).title}.`, nodeId, [decision === 'approved' ? 'youApproved' : 'youRejected', { node: this.node(r, nodeId).title }]);
    this.complete(r, n, decision, decision);
  }
  /** after a restart: run the interrupted nodes again (a crew node's crew run goes on where it was) */
  resume(runId: string) {
    const r = this.require(runId);
    if (r.status !== 'suspended') throw new WorkflowError('Only a suspended run can resume.');
    const follow: string[] = [];
    for (const n of Object.values(r.nodes)) {
      if (n.status !== 'interrupted') continue;
      const cr = this.kindOf(r, n.nodeId) === 'crew' && n.crewRunId ? this.opts.crews?.run(n.crewRunId) : undefined;
      if (cr && cr.status !== 'failed' && cr.status !== 'cancelled') {
        if (cr.status === 'interrupted')
          try {
            this.opts.crews!.resume(cr.id);
          } catch {
            /* resumed meanwhile */
          }
        n.status = 'running';
        follow.push(cr.id);
      } else n.status = 'ready';
    }
    r.status = 'running';
    for (const id of follow) queueMicrotask(() => this.onCrew(id));
    this.event(r, 'resume', 'Resumed.', undefined, ['resumed', {}]);
    this.pump(r);
  }
  /** a failed node again (the run reopens if it had failed because of it) */
  retryNode(runId: string, nodeId: string) {
    const r = this.require(runId);
    const n = r.nodes[nodeId];
    if (!n || (n.status !== 'failed' && n.status !== 'cancelled')) throw new WorkflowError('Only a failed or stopped node can be retried.');
    if (r.status === 'failed' || r.status === 'cancelled') {
      // the run goes on: nodes cancelled by its end wait again
      for (const x of Object.values(r.nodes)) if (x.status === 'cancelled' && x.nodeId !== nodeId) x.status = 'pending';
      delete r.error;
      delete r.errorKey;
      delete r.errorVars;
      delete r.finishedAt;
      // a new attempt: the time limit counts again from now
      r.startedAt = this.now();
      r.pausedMs = 0;
      delete r.pausedSince;
    }
    n.status = 'ready';
    n.attempts = 0;
    delete n.error;
    r.status = 'running';
    this.event(r, 'retry', `${this.node(r, nodeId).title} will be retried.`, nodeId, ['retryByYou', { node: this.node(r, nodeId).title }]);
    this.pump(r);
  }
  /** a failed or stopped node is given up: it counts as skipped, so the nodes after it are skipped too (the run reopens) */
  skipNode(runId: string, nodeId: string) {
    const r = this.require(runId);
    const n = r.nodes[nodeId];
    if (!n || (n.status !== 'failed' && n.status !== 'cancelled' && n.status !== 'interrupted')) throw new WorkflowError('Only a failed or stopped node can be skipped.');
    if (r.status === 'failed' || r.status === 'cancelled') {
      for (const x of Object.values(r.nodes)) if (x.status === 'cancelled' && x.nodeId !== nodeId) x.status = 'pending';
      delete r.error;
      delete r.errorKey;
      delete r.errorVars;
      delete r.finishedAt;
      // a new attempt: the time limit counts again from now
      r.startedAt = this.now();
      r.pausedMs = 0;
      delete r.pausedSince;
    }
    n.status = 'skipped';
    n.finishedAt = this.now();
    if (r.status !== 'suspended' || !Object.values(r.nodes).some((x) => x.status === 'interrupted')) r.status = 'running';
    this.event(r, 'skip', `${this.node(r, nodeId).title} was skipped by you.`, nodeId, ['skipByYou', { node: this.node(r, nodeId).title }]);
    this.pump(r);
  }
  cancel(runId: string) {
    const r = this.require(runId);
    if (!isOpenRun(r.status)) return;
    this.finish(r, 'cancelled');
  }
  markSeen(runId: string) {
    const r = this.runs.get(runId);
    if (!r || r.seen !== false) return;
    r.seen = true;
    this.touch(r, true);
  }
  remove(runId: string) {
    const r = this.require(runId);
    if (isOpenRun(r.status)) throw new WorkflowError('Stop the run first.', 'stopFirst');
    this.runs.delete(runId);
    this.order = this.order.filter((x) => x !== runId);
    void this.storage.remove(runKey(runId));
    void this.storage.set(INDEX, this.order);
    this.changed();
  }
  private require(id: string) {
    const r = this.runs.get(id);
    if (!r) throw new WorkflowError('Unknown run.');
    return r;
  }

  // ── bookkeeping ─────────────────────────────────────────
  private event(r: WorkflowRun, kind: WorkflowRunEvent['kind'], message: string, nodeId?: string, say?: [string, Record<string, string>], agentId?: string) {
    r.history.push({ at: this.now(), kind, message: message.slice(0, 400), ...(nodeId && { nodeId }), ...(agentId && { agentId }), ...(say && { key: say[0], vars: say[1] }) });
    if (r.history.length > WORKFLOW_LIMITS.history) r.history.splice(0, r.history.length - WORKFLOW_LIMITS.history);
    this.bus.emit('workflow.event', { runId: r.id, workflowId: r.workflowId, kind, message: message.slice(0, 160) });
  }
  private touch(r: WorkflowRun, now = false) {
    if (r.status === 'awaiting_approval' || r.status === 'suspended') r.pausedSince ??= this.now();
    else if (isOpenRun(r.status)) this.unpause(r);
    r.updatedAt = this.now();
    this.changed();
    clearTimeout(this.saveTimers.get(r.id));
    this.saveTimers.delete(r.id);
    if (now) void this.storage.set(runKey(r.id), r);
    else
      this.saveTimers.set(
        r.id,
        setTimeout(() => (this.saveTimers.delete(r.id), void this.storage.set(runKey(r.id), r)), 300),
      );

  }
  /** save every open run now (tests, closing) */
  async flush() {
    for (const r of this.runs.values()) await this.storage.set(runKey(r.id), r);
  }
  /** write the runs whose save is still delayed */
  async flushPending() {
    for (const id of [...this.saveTimers.keys()]) {
      clearTimeout(this.saveTimers.get(id));
      this.saveTimers.delete(id);
      const r = this.runs.get(id);
      if (r) await this.storage.set(runKey(id), r);
    }
  }
  private changed() {
    this.version++;
    for (const l of this.listeners) l();
  }
}

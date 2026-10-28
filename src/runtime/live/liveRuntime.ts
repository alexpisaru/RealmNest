// ─────────────────────────────────────────────────────────────
// LiveRuntime: what each agent is REALLY doing.
//
//   UI ──startTask──▶ LiveRuntime ──run──▶ ProviderService ──▶ AIProvider
//                         │  ◀── normalized ProviderEvents ──┘
//                         ├─▶ Task / Run records (RuntimeRepository)
//                         ├─▶ domain events: agent.status.changed, task.status.changed, agent.run.*
//                         └─▶ world events:  agent.work.started / completed / failed, agent.idle
//
// The world (WorldSim) only ever reacts to those events, so a character works
// exactly while a real provider turn runs. It answers "what is this agent
// doing?"; how to talk to a model is the provider layer's job.
//
// Implements AgentRuntime so a WorldSession can use it in place of
// MockRuntime. Simulation commands (break, huddle, force state…) are ignored:
// a live agent only works on real tasks.
// ─────────────────────────────────────────────────────────────

import { mentionedSkills, skillCatalog, stripMentions, type SkillCatalogEntry } from '../skills/mentions';
import { activatePick, pickSkills } from '../skills/precedence';
import { attachmentProblem, type Attachment, type AttachmentInput, type AttachmentKind } from '../../domain/attachment';
import { AttachmentReader } from '../files/payload';
import type { FileStore } from '../files/store';
import type { EmitOptions, EventBus, EventMap, EventType } from '../../core/events';
import type { CapabilityId, ResolvedRoute } from '../../domain/capability';
import {
  AGENT_TRANSITIONS,
  RUN_TRANSITIONS,
  TASK_TRANSITIONS,
  type AgentDefinition,
  type AgentRun,
  type AgentTask,
  type Delegator,
  type LiveAgentStatus,
  type RunStatus,
  type TaskStatus,
} from '../../domain/agent';
import type { RuntimeStatus, SimCommand, Task } from '../../domain/sim';
import type { ProviderRun, ProviderService } from '../providers/service';
import type { ProviderEvent, ProviderMessage } from '../providers/types';
import { agentSystemPrompt, type AgentIdentity } from '../agentPrompt';
import type { ToolService } from '../tools/service';
import type { SkillRunRef } from '../../domain/skill';
import type { ToolPermission } from '../../domain/tool';
import type { AgentRuntime } from '../types';
import { knowledgeTools, STRICT_NOTHING_FOUND, type KnowledgeRunner } from '../knowledge/run';
import { withContext, type MemoryRunner } from '../memory/run';
import { SEARCH_MEMORY_ID } from '../memory/tool';
import type { WebRunner } from '../web/run';
import { WEB_FETCH_ID, WEB_TOOL_IDS } from '../web/tool';
import { MAX_OUTPUT_CHARS, RUNTIME_SCHEMA, type RuntimeRepository, type RuntimeSnapshot } from './repository';

export const DEFAULT_PROVIDER_ID = 'claude-code';

export type { AgentIdentity };

export interface LiveRuntimeOptions {
  /** name and role of an agent (from its Character), for the system prompt */
  identity?: (agentId: string) => AgentIdentity | undefined;
  /** the colleagues an agent may hand work to, for its system prompt (when delegate_task is offered) */
  team?: (agentId: string) => string | undefined;
  /** the connection a new agent uses (ConnectionManager.defaultId) */
  defaultConnection?: () => string | undefined;
  /** the connection standing for a provider id saved before connections existed */
  legacyConnection?: (providerId: string) => string | undefined;
  /** the routing policy, for agents set to the default route */
  route?: (capability: CapabilityId) => ResolvedRoute;
  /** RealmNest tools: an agent's allowed tools run through the ToolLoop (docs/TOOLS.md) */
  tools?: ToolService;
  /** Skills: their context and tools for a run (docs/SKILLS.md) */
  skills?: SkillActivator;
  /** where task files live (docs/FILES.md); without one, bytes stay in memory */
  files?: FileStore;
  /** why this model cannot take an image or a PDF (CapabilityService); undefined: it can */
  consumes?: (connectionId: string, model: string | undefined, kind: 'image' | 'pdf') => string | undefined;
  /** the agent's Knowledge bases (docs/KNOWLEDGE.md) */
  knowledge?: KnowledgeRunner;
  /** the agent's memory (docs/MEMORY.md) */
  memory?: MemoryRunner;
  /** public web pages and search, for agents with Web access on (docs/WEB.md) */
  web?: WebRunner;
  now?: () => number;
  newId?: (kind: 'task' | 'run' | 'att') => string;
}

export class LiveRuntimeError extends Error {
  constructor(
    message: string,
    /** a structured reason, e.g. SKILL_TOOL_LIMIT_EXCEEDED */
    readonly code?: string,
  ) {
    super(message);
  }
}

/** what the runtimes need from SkillService (runtime/skills/service.ts) */
export interface SkillActivator {
  activate(skillIds: string[], ctx: { connectionId?: string; model?: string; agentPermissions?: Record<string, ToolPermission>; agentToolIds?: string[]; canUseTools?: boolean }): SkillActivationResult;
  /** the enabled Skills, for `@` mentions and for telling the model what exists */
  catalog?(): SkillCatalogEntry[];
}
export type SkillActivationResult =
  | { ok: true; context: string; toolIds: string[]; refs: SkillRunRef[] }
  | { ok: false; error: { code: string; message: string; details?: string[] } };

/** a Skill activation failure as one readable message */
export const skillFailure = (e: { message: string; details?: string[] }) => `${e.message}${e.details?.length ? ` — ${e.details.join('; ')}` : ''}`;

interface Active {
  run: AgentRun;
  task: AgentTask;
  handle: ProviderRun | null;
  /** stopped while its request was still being prepared */
  cancelled?: boolean;
}

const LIVE: EmitOptions = { origin: 'live' };
let idCounter = 0;
const defaultId = (kind: 'task' | 'run' | 'att') => `${kind}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;

/** a task title from its prompt: first line, shortened */
export const titleOf = (prompt: string) => {
  const line = prompt.trim().split('\n')[0].trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
};

export class LiveRuntime implements AgentRuntime {
  readonly kind = 'live' as const;
  // simulation-only knobs of the AgentRuntime contract; meaningless for real work
  autopilot = false;
  failureRate = 0;

  private agents = new Map<string, AgentDefinition>();
  private tasks = new Map<string, AgentTask>();
  private runs = new Map<string, AgentRun>();
  private statuses = new Map<string, LiveAgentStatus>();
  /** at most one active run per agent; several agents may run at once */
  private active = new Map<string, Active>();
  private attached = new Set<string>();
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;
  private newId: (kind: 'task' | 'run' | 'att') => string;
  /** task file contents: a cache of the FileStore */
  private reader: AttachmentReader;
  /** tasks whose prompt a model wrote (a colleague, a crew, a workflow, Telegram's concierge): not the user's own words */
  private modelWritten = new Set<string>();

  constructor(
    private bus: EventBus,
    private providers: ProviderService,
    private repo: RuntimeRepository,
    private opts: LiveRuntimeOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
    this.reader = new AttachmentReader(opts.files);
    // a deleted agent stops working and its configuration goes (docs/HARDENING.md R-15, D-6)
    bus.on('character.deleted', (p) => this.onAgentDeleted(p.id));
  }

  private onAgentDeleted(agentId: string) {
    if (this.active.has(agentId)) void this.cancel(agentId).catch(() => undefined);
    if (!this.agents.delete(agentId)) return;
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  async init() {
    const snap = await this.repo.load(this.now());
    snap.agents.forEach((a) => this.agents.set(a.id, this.migrate(a)));
    snap.tasks.forEach((t) => this.tasks.set(t.id, t));
    snap.runs.forEach((r) => this.runs.set(r.id, r));
    // write migrated records back now, not at the next change
    if (snap.agents.some((a) => !a.connectionId)) await this.repo.flush(this.snapshot);
    this.changed();
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ── agents ───────────────────────────────────────────────
  /** the agent's configuration (defaults until the user changes it) */
  agent(agentId: string): AgentDefinition {
    return this.agents.get(agentId) ?? { id: agentId, connectionId: this.opts.defaultConnection?.() ?? DEFAULT_PROVIDER_ID, updatedAt: 0 };
  }

  /** agents saved with a provider id (before connections) now point at its connection */
  private migrate(a: AgentDefinition & { providerId?: string }): AgentDefinition {
    if (a.connectionId) return a;
    const { providerId, ...rest } = a;
    return { ...rest, connectionId: (providerId && this.opts.legacyConnection?.(providerId)) || providerId || DEFAULT_PROVIDER_ID };
  }

  updateAgent(agentId: string, patch: Partial<Omit<AgentDefinition, 'id' | 'updatedAt'>>) {
    const prev = this.agent(agentId);
    const next: AgentDefinition = { ...prev, ...patch, id: agentId, updatedAt: this.now() };
    // a model belongs to its connection: switching connection without a new model goes back to the default (its effort too)
    if (patch.connectionId !== undefined && patch.connectionId !== prev.connectionId && patch.model === undefined) delete next.model;
    if (patch.connectionId !== undefined && patch.connectionId !== prev.connectionId && patch.effort === undefined) delete next.effort;
    if (next.model !== undefined && !next.model.trim()) delete next.model;
    if (next.effort !== undefined && !next.effort.trim()) delete next.effort;
    if (next.instructions !== undefined && !next.instructions.trim()) delete next.instructions;
    if (next.workspace !== undefined && !next.workspace.trim()) delete next.workspace;
    this.agents.set(agentId, next);
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  /** agents configured to use a connection (for "this is in use" warnings) */
  agentsOn(connectionId: string): string[] {
    return [...this.agents.values()].filter((a) => a.connectionId === connectionId).map((a) => a.id);
  }

  agentStatus(agentId: string): LiveAgentStatus {
    return this.statuses.get(agentId) ?? 'idle';
  }

  activeRun(agentId: string): AgentRun | undefined {
    return this.active.get(agentId)?.run;
  }

  getTask(id: string) {
    return this.tasks.get(id);
  }
  getRun(id: string) {
    return this.runs.get(id);
  }
  /** the tasks a run handed to colleagues (delegate_task), oldest first */
  delegatedFrom(runId: string): AgentTask[] {
    return [...this.tasks.values()].filter((t) => t.delegatedBy?.runId === runId).sort((a, b) => a.createdAt - b.createdAt);
  }
  /** newest first */
  tasksOf(agentId: string): AgentTask[] {
    return [...this.tasks.values()].filter((t) => t.agentId === agentId).sort((a, b) => b.createdAt - a.createdAt);
  }
  runsOf(taskId: string): AgentRun[] {
    return (this.tasks.get(taskId)?.runIds ?? []).map((id) => this.runs.get(id)).filter((r): r is AgentRun => !!r);
  }

  // ── work ─────────────────────────────────────────────────
  /**
   * Create a task and its first run, and start it. Throws if the agent is busy, or before anything
   * starts when its files or Skills cannot be used. `skillIds`: Skills picked for this task (chips);
   * `@id` mentions in the prompt count too, and win over the agent's own (skills/precedence.ts).
   */
  startTask(
    agentId: string,
    input: { prompt: string; title?: string; attachments?: AttachmentInput[]; skillIds?: string[]; delegatedBy?: Delegator; crew?: AgentTask['crew']; workflow?: AgentTask['workflow']; /** a model wrote the prompt (Telegram's concierge) */ modelWritten?: boolean },
  ): { task: AgentTask; run: AgentRun } {
    const typed = input.prompt.trim();
    const inputs = input.attachments ?? [];
    if (!typed && !inputs.length) throw new LiveRuntimeError('Write a task first.');
    // only real agents work: a deleted (or never created) one gets no task from a workflow, crew or colleague
    if (this.opts.identity && !this.opts.identity(agentId)) throw new LiveRuntimeError('This agent does not exist (any more).', 'UNKNOWN_AGENT');
    if (this.active.has(agentId)) throw new LiveRuntimeError('This agent is already working on a task.');
    // a prompt a model wrote is not the user's: its @mentions and named Skills are not honoured (docs/HARDENING.md I-5)
    const byModel = !!(input.delegatedBy || input.crew || input.workflow || input.modelWritten);
    const def = this.agent(agentId);
    // the agent's own connection, or the default chat route resolved now
    let connectionId = def.connectionId;
    let model = def.model;
    if (def.useDefaultRoute) {
      const r = this.opts.route?.('text.chat');
      if (!r?.ok || !r.target) throw new LiveRuntimeError(r?.reason ?? 'No default chat route is set (Settings › AI Capabilities).');
      connectionId = r.target.connectionId;
      model = r.target.modelId;
    }
    const provider = this.providers.resolve(connectionId);
    if (!provider) throw new LiveRuntimeError('This agent has no usable AI connection: choose one in its panel.');
    // files: checked before anything starts; a model never gets a file it cannot read
    const problem = attachmentProblem(inputs);
    if (problem) throw new LiveRuntimeError(problem, 'INVALID_FILE');
    for (const a of inputs) {
      if (!a.storageRef && (a.kind === 'text' ? a.text === undefined : !a.data)) throw new LiveRuntimeError(`${a.name} could not be read.`, 'INVALID_FILE');
      const why = this.cannotTake(provider, connectionId, model, a.kind);
      if (why) throw new LiveRuntimeError(`${a.name}: ${why}`, 'UNSUPPORTED_FILE_TYPE');
    }
    // Skills, by precedence: named in the task > the agent's own > a confident automatic pick
    const catalog = this.opts.skills?.catalog?.() ?? [];
    const knownIds = catalog.map((s) => s.id);
    const mentioned = byModel ? [] : mentionedSkills(typed, knownIds);
    const explicit = [...new Set([...(input.skillIds ?? []), ...mentioned])];
    const pick = pickSkills({ explicit, assigned: def.skillIds ?? [], text: typed, catalog, automatic: !byModel });
    const activation = activatePick(this.opts.skills, pick, {
      connectionId,
      model,
      agentPermissions: def.toolPermissions,
      // a Skill's tools must be among the agent's own (none set: none)
      agentToolIds: def.allowedToolIds ?? [],
      canUseTools: !!this.opts.tools?.modeFor(connectionId, model),
    });
    if (!activation.ok) throw new LiveRuntimeError(skillFailure(activation.error), activation.error.code);
    const skill = activation.active;
    const prompt = stripMentions(typed, mentioned, knownIds);

    const t = this.now();
    const task: AgentTask = {
      id: this.newId('task'),
      agentId,
      title: input.title?.trim() || titleOf(prompt || typed || inputs[0].name),
      prompt,
      status: 'queued',
      runIds: [],
      createdAt: t,
      updatedAt: t,
      ...(explicit.length && { skillIds: explicit }),
      ...(input.delegatedBy && { delegatedBy: input.delegatedBy }),
      ...(input.crew && { crew: input.crew }),
      ...(input.workflow && { workflow: input.workflow }),
    };
    if (inputs.length) {
      task.attachments = inputs.map(({ data, ...meta }) => {
        const id = this.newId('att');
        if (data) this.reader.blobs.set(id, data);
        // a stored text file keeps its text out of the record (the store has it)
        if (meta.storageRef && meta.text !== undefined) {
          this.reader.texts.set(id, meta.text);
          delete meta.text;
        }
        return { ...meta, id, createdAt: meta.createdAt ?? t };
      });
    }
    this.tasks.set(task.id, task);
    if (byModel) this.modelWritten.add(task.id);
    this.emit('task.status.changed', { taskId: task.id, agentId, from: null, to: 'queued' });

    const run: AgentRun = { id: this.newId('run'), taskId: task.id, agentId, providerId: provider.id, connectionId, model, status: 'starting', createdAt: t, output: '', ...(skill?.refs.length && { skills: skill.refs }), ...(input.delegatedBy && { parentRunId: input.delegatedBy.runId }) };
    this.runs.set(run.id, run);
    task.runIds.push(run.id);
    const active: Active = { run, task, handle: null };
    this.active.set(agentId, active);

    this.setTask(task, 'running');
    this.setAgent(agentId, 'starting');
    this.emit('agent.run.started', { agentId, runId: run.id, taskId: task.id, providerId: run.providerId, title: task.title });
    // the run exists: the character heads to its desk
    this.emit('agent.work.started', { agentId, task: this.view(task) });
    void this.repo.flush(this.snapshot);
    this.changed();

    if (skill) this.emit('skill.activated', { runId: run.id, skills: skill.refs.map((r) => `${r.id}@${r.version}`), tools: skill.toolIds.length });
    // anything that throws while the request is built ends the run failed: it never stays "starting" (docs/HARDENING.md R-11)
    void this.launch(active, { def, connectionId, model, skill, catalog, pickIds: pick.ids }).catch((e) => {
      try {
        this.failEarly(active, 'internal', e instanceof Error ? e.message : String(e));
      } catch {
        /* the run had already ended */
      }
    });
    return { task, run };
  }

  /** why this model cannot take a kind of attachment (undefined: it can) */
  private cannotTake(provider: { name: string; capabilities: { vision?: boolean; files?: boolean } }, connectionId: string, model: string | undefined, kind: AttachmentKind): string | undefined {
    if (kind === 'text') return undefined;
    if (kind === 'image' && !provider.capabilities.vision) return `${provider.name} cannot take images through RealmNest.`;
    if (kind === 'pdf' && !provider.capabilities.files) return `${provider.name} cannot take PDFs through RealmNest.`;
    return this.opts.consumes?.(connectionId, model, kind);
  }

  /** build the request (file bytes come from the FileStore) and start the provider turn */
  private async launch(
    active: Active,
    t: { def: AgentDefinition; connectionId: string; model?: string; skill?: Extract<SkillActivationResult, { ok: true }>; catalog: SkillCatalogEntry[]; pickIds: string[] },
  ) {
    const { run, task } = active;
    const { def, connectionId, model, skill } = t;
    let message: ProviderMessage;
    try {
      message = await this.reader.message(task.prompt, task.attachments);
    } catch (e) {
      return this.failEarly(active, 'invalid_request', e instanceof Error ? e.message : String(e));
    }
    if (active.cancelled) return;
    // Knowledge: the agent's bases, searched for the task now; search_knowledge for more when its model calls tools
    const sel = this.opts.knowledge?.validSelection(def.knowledgeBaseIds?.length ? { baseIds: def.knowledgeBaseIds, mode: def.knowledgeMode ?? 'grounded' } : undefined);
    const canSearch = !!sel && !!this.opts.tools?.modeFor(connectionId, model);
    let knowledgeContext: string | undefined;
    if (sel && this.opts.knowledge) {
      try {
        const k = await this.opts.knowledge.beginRun(run.id, sel, task.prompt, { canSearch });
        if (active.cancelled) return;
        if (sel.mode === 'strict' && !k.sources && !canSearch) return this.answerLocally(active, STRICT_NOTHING_FOUND);
        knowledgeContext = k.context;
      } catch (e) {
        return this.failEarly(active, 'knowledge_unavailable', e instanceof Error ? e.message : String(e));
      }
    }
    // runtime context in layers: the agent (who, standing instructions), what Skills exist, then the active ones; the task is the user message
    const systemPrompt = [this.systemPrompt(run.agentId, def), skillCatalog(t.catalog, def.skillIds ?? [], t.pickIds), skill?.context].filter(Boolean).join('\n\n') || undefined;
    if (knowledgeContext) message = { ...message, content: `${knowledgeContext}\n\n# Task\n${message.content}` };
    // Memory: the agent's own approved memories for this task (never in STRICT Knowledge runs)
    let memoryTool = false;
    if (this.opts.memory?.usable(run.agentId)) {
      try {
        const m = await this.opts.memory.beginRun(run.id, run.agentId, task.prompt, { canSearch: !!this.opts.tools?.modeFor(connectionId, model), ...(sel && { knowledgeMode: sel.mode }) });
        if (active.cancelled) return;
        memoryTool = m.tool;
        if (m.context) message = { ...message, content: withContext(message.content, m.context, 'Task') };
      } catch {
        // memory never blocks a task
      }
    }
    // Web: only for agents with Web access on; never in STRICT Knowledge runs
    let webTools = false;
    // a backend that searches the web itself (ChatGPT through Codex) may do so when the agent has Web on
    let providerWeb = false;
    if (this.opts.web && def.webAccess) {
      if (sel?.mode === 'strict') run.web = this.opts.web.skipped('Knowledge STRICT mode: answers come from documents only');
      else {
        providerWeb = !!this.providers.resolve(connectionId)?.capabilities.nativeWebInTurns;
        try {
          // addresses in a prompt a model wrote are not the user's (they would be fetched without asking)
          const userTexts = this.modelWritten.has(task.id) ? [] : [task.prompt];
          const w = await this.opts.web.beginRun(run.id, { canFetch: !!this.opts.tools?.modeFor(connectionId, model), userTexts, ...(sel && { knowledgeMode: sel.mode }), ...(providerWeb && { nativeSearch: true }) });
          if (active.cancelled) return;
          webTools = w.tools;
          message = { ...message, content: withContext(message.content, w.context, 'Task') };
        } catch {
          // the web never blocks a task
        }
      }
    }
    // the agent's effort: the adapter sends it only when this model lists it
    const request = { runId: run.id, messages: [message], model, systemPrompt, workspace: def.workspace, ...(def.effort && { effort: def.effort }), ...(providerWeb && { providerWeb: true }) };
    // the agent's tools (with Skills: only what they need, then the agent's own), when its model can call them
    const withKnowledge = knowledgeTools(sel, canSearch, skill ? skill.toolIds : (def.allowedToolIds ?? []), skill?.toolIds) ?? [];
    const withMemory = memoryTool && sel?.mode !== 'strict' ? [...withKnowledge, SEARCH_MEMORY_ID] : withKnowledge;
    // a model with its own web search reads pages with web_fetch, but never searches twice
    const toolIds = webTools ? [...withMemory, ...(providerWeb ? [WEB_FETCH_ID] : WEB_TOOL_IDS)] : withMemory;
    const offer = toolIds.length ? this.opts.tools?.offer(connectionId, model, toolIds, def.toolPermissions, def.workspace) : undefined;
    // the files its tools may read: this task's attachments, nothing else (run scoping)
    const files = (task.attachments ?? []).filter((a) => a.storageRef).map((a) => ({ id: a.id, name: a.name, mime: a.mime, storageRef: a.storageRef! }));
    active.handle = offer?.ids.length
      ? this.opts.tools!.run(
          connectionId,
          request,
          {
            runId: run.id,
            agentId: run.agentId,
            taskId: task.id,
            allowedToolIds: offer.ids,
            agentPermissions: def.toolPermissions,
            workspace: offer.workspace,
            requester: this.opts.identity?.(run.agentId)?.name ?? run.agentId,
            attachments: files,
            ...(skill?.refs.length && { skills: skill.refs }),
          },
          (e) => this.onProviderEvent(active, e),
        )
      : this.providers.run(connectionId, request, (e) => this.onProviderEvent(active, e));
  }

  /** a result RealmNest writes itself (STRICT with nothing to answer from): no provider call */
  private answerLocally(active: Active, text: string) {
    const { run, task } = active;
    run.startedAt = this.now();
    this.setRun(run, 'running');
    run.output = text;
    run.result = text;
    this.finish(active, 'completed');
    this.emit('agent.run.completed', { agentId: run.agentId, runId: run.id, taskId: task.id, result: text, durationMs: 0 });
    this.emit('agent.work.completed', { agentId: run.agentId, task: this.view(task) });
    this.toIdle(run.agentId);
    this.changed();
  }

  /** a run that ends before the provider (its files could not be read) */
  private failEarly(active: Active, code: string, message: string) {
    const { run, task } = active;
    if (RUN_TRANSITIONS[run.status].length === 0) return;
    run.error = { code, message };
    this.finish(active, 'failed');
    this.emit('agent.run.failed', { agentId: run.agentId, runId: run.id, taskId: task.id, error: { code, message } });
    this.emit('agent.work.failed', { agentId: run.agentId, task: this.view(task), error: message });
    this.toIdle(run.agentId);
    this.changed();
  }

  /** Stop the agent's active run (no-op when it has none). */
  async cancel(agentId: string) {
    const active = this.active.get(agentId);
    if (!active) return;
    if (active.handle) return active.handle.cancel();
    // still preparing (reading files): it never reaches the provider
    active.cancelled = true;
    this.finish(active, 'cancelled');
    this.emit('agent.run.cancelled', { agentId, runId: active.run.id, taskId: active.task.id });
    this.toIdle(agentId);
    this.changed();
  }

  /** a task file's bytes (base64), for previews: cache, else the FileStore */
  attachmentBytes(a: Attachment): Promise<string | undefined> {
    return this.reader.bytes(a);
  }

  /** every task file, with its task (Debug › Files) */
  allAttachments(): { attachment: Attachment; taskId: string; agentId: string }[] {
    return [...this.tasks.values()].flatMap((t) => (t.attachments ?? []).map((attachment) => ({ attachment, taskId: t.id, agentId: t.agentId })));
  }

  /** the Artifact a task file was made from (lineage), if any */
  attachmentArtifact(attachmentId: string): string | undefined {
    for (const t of this.tasks.values()) for (const a of t.attachments ?? []) if (a.id === attachmentId) return a.artifactId;
    return undefined;
  }

  /** every stored file the tasks reference (the file store keeps these) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const t of this.tasks.values()) for (const a of t.attachments ?? []) if (a.storageRef) out.add(a.storageRef);
    return out;
  }

  private systemPrompt(agentId: string, def: AgentDefinition): string | undefined {
    const base = agentSystemPrompt(this.opts.identity?.(agentId), def);
    // the team, only for an agent that may delegate
    const team = def.allowedToolIds?.includes('delegate_task') ? this.opts.team?.(agentId) : undefined;
    return [base, team].filter(Boolean).join('\n\n') || undefined;
  }

  /** provider events → run / task / agent state; only what the app needs */
  private onProviderEvent(active: Active, e: ProviderEvent) {
    const { run, task } = active;
    // a finished run accepts nothing more (no completion after a cancel)
    if (RUN_TRANSITIONS[run.status].length === 0) return;
    const agentId = run.agentId;
    switch (e.type) {
      case 'provider.started':
        run.startedAt = this.now();
        this.setRun(run, 'running');
        this.setAgent(agentId, 'working');
        break;
      case 'session.started':
        run.sessionId = e.sessionId;
        break;
      case 'text.delta':
        if (run.output.length < MAX_OUTPUT_CHARS) run.output += e.text;
        this.emit('agent.run.output.delta', { agentId, runId: run.id, text: e.text }, { log: false });
        this.repo.touch(this.snapshot);
        break;
      case 'usage.updated':
        if (e.cumulative) {
          run.usage = e.usage;
          if (e.costUsd !== undefined) run.costUsd = e.costUsd;
        }
        break;
      case 'run.completed':
        run.result = e.text;
        if (!run.output) run.output = e.text;
        if (e.sessionId) run.sessionId = e.sessionId;
        if (e.usage) run.usage = e.usage;
        if (e.costUsd !== undefined) run.costUsd = e.costUsd;
        this.finish(active, 'completed');
        this.emit('agent.run.completed', { agentId, runId: run.id, taskId: task.id, result: e.text, durationMs: e.durationMs, costUsd: run.costUsd });
        this.emit('agent.work.completed', { agentId, task: this.view(task) });
        this.toIdle(agentId);
        break;
      case 'run.failed':
        run.error = { code: e.error.code, message: e.error.message, ...(e.error.detail && { detail: e.error.detail }) };
        this.finish(active, 'failed');
        this.emit('agent.run.failed', { agentId, runId: run.id, taskId: task.id, error: { code: e.error.code, message: e.error.message } });
        this.emit('agent.work.failed', { agentId, task: this.view(task), error: e.error.message });
        this.toIdle(agentId);
        break;
      case 'run.cancelled':
        this.finish(active, 'cancelled');
        this.emit('agent.run.cancelled', { agentId, runId: run.id, taskId: task.id });
        this.toIdle(agentId);
        break;
      default:
        return; // message.started, text.completed, tool.*, provider.error: nothing the app tracks yet
    }
    this.changed();
  }

  private finish(active: Active, outcome: 'completed' | 'failed' | 'cancelled') {
    // a record that cannot be written never keeps the run from ending (docs/HARDENING.md R-11)
    const safe = <T>(f: () => T): T | undefined => {
      try {
        return f();
      } catch {
        return undefined;
      }
    };
    // what was retrieved and cited, checked against the final result
    const k = safe(() => this.opts.knowledge?.finishRun(active.run.id, outcome === 'completed' ? (active.run.result ?? active.run.output) : undefined));
    if (k) active.run.knowledge = k;
    const m = safe(() => this.opts.memory?.finishRun(active.run.id, outcome === 'completed'));
    if (m) active.run.memory = m;
    const w = safe(() => this.opts.web?.finishRun(active.run.id, outcome === 'completed' ? (active.run.result ?? active.run.output) : undefined));
    if (w) active.run.web = w;

    // after a task: maybe propose memories (never blocks, never saves on its own). Not for a prompt a model wrote:
    // extraction takes the prompt as the user's words, so one agent's text would become another's memory (docs/HARDENING.md M-2)
    const byModel = this.modelWritten.delete(active.task.id);
    const memory = this.opts.memory;
    if (outcome === 'completed' && !byModel && memory && safe(() => memory.usable(active.run.agentId)) && active.run.connectionId)
      void memory
        .afterRun({
 runId: active.run.id, agentId: active.run.agentId, sourceType: 'agent_run', taskId: active.task.id, userTexts: [active.task.prompt], answer: active.run.result ?? active.run.output, connectionId: active.run.connectionId, ...(active.run.model && { model: active.run.model }), providerId: active.run.providerId })
        .catch(() => undefined)
        .then(() => this.changed());
    active.run.finishedAt = this.now();
    this.setRun(active.run, outcome);
    this.setTask(active.task, outcome);
    this.active.delete(active.run.agentId);
    void this.repo.flush(this.snapshot);
  }

  private toIdle(agentId: string) {
    this.setAgent(agentId, 'idle');
    this.emit('agent.idle', { agentId });
  }

  // ── state machines ───────────────────────────────────────
  private setAgent(agentId: string, to: LiveAgentStatus) {
    const from = this.agentStatus(agentId);
    if (from === to) return;
    if (!AGENT_TRANSITIONS[from].includes(to)) throw new LiveRuntimeError(`agent ${agentId}: ${from} → ${to} is not allowed`);
    this.statuses.set(agentId, to);
    this.emit('agent.status.changed', { agentId, from, to });
  }

  private setTask(task: AgentTask, to: TaskStatus) {
    const from = task.status;
    if (from === to) return;
    if (!TASK_TRANSITIONS[from].includes(to)) throw new LiveRuntimeError(`task ${task.id}: ${from} → ${to} is not allowed`);
    task.status = to;
    task.updatedAt = this.now();
    this.emit('task.status.changed', { taskId: task.id, agentId: task.agentId, from, to });
  }

  private setRun(run: AgentRun, to: RunStatus) {
    const from = run.status;
    if (from === to) return;
    if (!RUN_TRANSITIONS[from].includes(to)) throw new LiveRuntimeError(`run ${run.id}: ${from} → ${to} is not allowed`);
    run.status = to;
    this.emit('agent.run.status', { agentId: run.agentId, runId: run.id, from, to });
  }

  private emit<K extends EventType>(type: K, payload: EventMap[K], opts: EmitOptions = {}) {
    this.bus.emit(type, payload, { ...LIVE, ...opts });
  }

  /** what the world shows for a task (it has no measurable progress) */
  private view(task: AgentTask): Task {
    return { id: task.id, title: task.title, progress: 0, duration: 0 };
  }

  snapshot = (): RuntimeSnapshot => ({ version: RUNTIME_SCHEMA, agents: [...this.agents.values()], tasks: [...this.tasks.values()], runs: [...this.runs.values()] });

  // ── AgentRuntime contract ────────────────────────────────
  attach(ids: string[]) {
    for (const id of ids) {
      if (this.attached.has(id)) continue;
      this.attached.add(id);
      // a world opened while this agent's run is going: show the truth
      const a = this.active.get(id);
      if (a) this.emit('agent.work.started', { agentId: id, task: this.view(a.task), resumed: true });
    }
  }
  detach(id: string) {
    this.attached.delete(id);
  }
  /** simulation commands do not apply: a live agent works only on real tasks */
  dispatch(_cmd: SimCommand) {}
  tick(_dt: number) {}
  reset() {}
  status(agentId: string): RuntimeStatus {
    return this.agentStatus(agentId) === 'idle' ? 'idle' : 'working';
  }
  task(agentId: string): Task | null {
    const a = this.active.get(agentId);
    return a ? this.view(a.task) : null;
  }
}

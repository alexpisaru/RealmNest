// ─────────────────────────────────────────────────────────────
// ConversationRuntime: persistent chats over the provider layer.
//
//   ChatScreen ──send──▶ ConversationRuntime ──run──▶ ProviderService ──▶ AIProvider
//                              │  ◀── normalized ProviderEvents ──┘
//                              ├─▶ Conversation / ChatMessage / ConversationRun (repository)
//                              └─▶ events: conversation.*  (deltas delivered, not logged)
//
// Provider-independent: providers that keep conversations themselves
// (capabilities.sessions) get a ProviderSessionRef and only the new message;
// the others would get the whole history. It never touches the world: a chat
// turn is not work (that is LiveRuntime's AgentTask).
// ─────────────────────────────────────────────────────────────

import { mentionedSkills, skillCatalog, stripMentions, type SkillCatalogEntry } from '../skills/mentions';
import { activatePick, pickSkills } from '../skills/precedence';
import type { FileStore } from '../files/store';
import { AttachmentReader } from '../files/payload';
import type { EmitOptions, EventBus, EventMap, EventType } from '../../core/events';
import { RUN_TRANSITIONS, type AgentDefinition, type RunStatus } from '../../domain/agent';
import type { CapabilityId, ResolvedRoute } from '../../domain/capability';
import { attachmentProblem, withTextAttachments, type Attachment, type AttachmentInput, type AttachmentKind } from '../../domain/attachment';
import { conversationTitle, type ChatMessage, type Conversation, type ConversationRun, type MessageRole } from '../../domain/conversation';
import { agentSystemPrompt, type AgentIdentity } from '../agentPrompt';
import type { ProviderRun, ProviderService } from '../providers/service';
import type { ProviderAttachment, ProviderEvent, ProviderMessage, ProviderSessionRef } from '../providers/types';
import { CHAT_SCHEMA, MAX_MESSAGE_CHARS, type ChatSnapshot, type ConversationRepository } from './repository';
import { cleanTitle, type Titler } from './titles';
import type { ToolService } from '../tools/service';
import { SKILL_RESOURCE_TOOL } from '../skills/service';
import { skillFailure, type SkillActivator, type SkillActivationResult } from '../live/liveRuntime';
import type { KnowledgeSelection } from '../../domain/knowledge';
import { knowledgeTools, STRICT_NOTHING_FOUND, type KnowledgeRunner } from '../knowledge/run';
import { withContext, type MemoryRunner } from '../memory/run';
import { SEARCH_MEMORY_ID } from '../memory/tool';
import type { WebRunner } from '../web/run';
import { WEB_FETCH_ID, WEB_TOOL_IDS } from '../web/tool';

export interface ConversationRuntimeOptions {
  /** an agent's configuration (LiveRuntime.agent) */
  agent?: (agentId: string) => AgentDefinition;
  /** the connection standing for a provider id saved before connections existed */
  legacyConnection?: (providerId: string) => string | undefined;
  /** the routing policy (CapabilityService.resolveRoute), for "Auto" conversations */
  route?: (capability: CapabilityId) => ResolvedRoute;
  /** an agent's name and role (its Character) */
  identity?: (agentId: string) => AgentIdentity | undefined;
  /** who a chat (or its agent) may hand work to, for the system prompt when delegate_task is offered */
  team?: (agentId: string | undefined) => string | undefined;
  /**
   * Optional short AI title after the first reply (titles.ts). Never awaited by
   * a turn; on any failure the first-message title stays.
   */
  titler?: Titler;
  /** whether AI titles are on right now (a user setting; off by default) */
  aiTitles?: () => boolean;
  /** RealmNest tools, for chats with tools on (docs/TOOLS.md) */
  tools?: ToolService;
  /** Skills chosen in a chat (docs/SKILLS.md) */
  skills?: SkillActivator;
  /** where attachment bytes live (docs/FILES.md); without one, bytes stay in memory as before */
  files?: FileStore;
  /** why this model cannot take an image or a PDF (CapabilityService); undefined: it can */
  consumes?: (connectionId: string, model: string | undefined, kind: 'image' | 'pdf') => string | undefined;
  /** Knowledge bases a chat searches (docs/KNOWLEDGE.md) */
  knowledge?: KnowledgeRunner;
  /** agent memory (agent chats only; docs/MEMORY.md) */
  memory?: MemoryRunner;
  /** public web pages and search (docs/WEB.md) */
  web?: WebRunner;
  now?: () => number;
  newId?: (kind: 'conv' | 'msg' | 'run' | 'att') => string;
}

export class ChatError extends Error {}

interface Active {
  run: ConversationRun;
  conversation: Conversation;
  assistant: ChatMessage;
  handle: ProviderRun | null;
  /** stopped while its request was still being prepared */
  cancelled?: boolean;
}

/** how much of earlier messages' images and PDFs (base64) a provider without sessions gets again */
export const HISTORY_FILE_BUDGET = 8_000_000;

const LIVE: EmitOptions = { origin: 'live' };
/** messages that may wait in one conversation's queue */
export const MAX_QUEUED = 10;

let counter = 0;
const defaultId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(++counter).toString(36)}`;

export class ConversationRuntime {
  private conversations = new Map<string, Conversation>();
  private runs = new Map<string, ConversationRun>();
  /** at most one turn per conversation; different conversations may run at once */
  private active = new Map<string, Active>();
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;
  private newId: (kind: 'conv' | 'msg' | 'run' | 'att') => string;
  /** attachment contents: a cache of the FileStore (files/payload.ts) */
  private reader: AttachmentReader;
  private get blobs() {
    return this.reader.blobs;
  }
  private get texts() {
    return this.reader.texts;
  }

  constructor(
    private bus: EventBus,
    private providers: ProviderService,
    private repo: ConversationRepository,
    private opts: ConversationRuntimeOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
    this.reader = new AttachmentReader(opts.files);
  }

  async init() {
    const snap = await this.repo.load(this.now());
    snap.conversations.forEach((c) => this.conversations.set(c.id, this.migrate(c)));
    // a queue left when RealmNest closed waits for the user (the reply it waited for was interrupted)
    for (const c of this.conversations.values()) if (c.queued?.length) c.queuePaused = true;
    snap.runs.forEach((r) => this.runs.set(r.id, r));
    // write migrated records back now, not at the next change
    if (snap.conversations.some((c) => !c.connectionId)) await this.repo.flush(this.snapshot);
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

  // ── reading ──────────────────────────────────────────────
  /** most recently used first */
  list(): Conversation[] {
    return [...this.conversations.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  get(id: string) {
    return this.conversations.get(id);
  }
  run(id: string) {
    return this.runs.get(id);
  }
  activeRun(conversationId: string): ConversationRun | undefined {
    return this.active.get(conversationId)?.run;
  }
  isBusy(conversationId: string) {
    return this.active.has(conversationId);
  }

  // ── conversations ────────────────────────────────────────
  /** conversations saved before connections existed point at the connection of their provider */
  private migrate(c: Conversation): Conversation {
    if (c.connectionId) return c;
    return { ...c, connectionId: this.opts.legacyConnection?.(c.providerId) ?? c.providerId };
  }

  /**
   * Agent chat (`agentId`): connection, model and effort default to the agent's.
   * Direct chat: give `connectionId` (and `model`). `effort: ''`: the model's default, explicitly.
   */
  create(input: { agentId?: string; connectionId?: string; model?: string; effort?: string; title?: string; auto?: boolean; toolsEnabled?: boolean; skillId?: string }): Conversation {
    const def = input.agentId ? this.opts.agent?.(input.agentId) : undefined;
    // Auto (or an agent on the default route): the routing policy picks once, now; an explicit choice always wins
    let routed: ResolvedRoute | undefined;
    if (!input.connectionId && (input.auto || def?.useDefaultRoute)) {
      routed = this.opts.route?.('text.chat');
      if (!routed?.ok || !routed.target) throw new ChatError(routed?.reason ?? 'No default chat route is set (Settings › AI Capabilities).');
    }
    const connectionId = input.connectionId ?? routed?.target?.connectionId ?? def?.connectionId;
    const provider = connectionId ? this.providers.resolve(connectionId) : undefined;
    if (!connectionId || !provider) throw new ChatError('Choose an AI connection that is set up (Settings › AI Connections).');
    const providerId = provider.id;
    const t = this.now();
    const effort = (input.effort ?? def?.effort)?.trim();
    const c: Conversation = {
      id: this.newId('conv'),
      title: input.title?.trim() || 'New conversation',
      ...(input.agentId && { agentId: input.agentId }),
      connectionId,
      providerId,
      ...((input.model ?? routed?.target?.modelId ?? (routed ? undefined : def?.model)) && { model: input.model ?? routed?.target?.modelId ?? def?.model }),
      ...(effort && { effort }),
      ...(routed && { routedBy: { capability: 'text.chat', source: routed.source ?? 'policy', at: t } }),
      ...(input.toolsEnabled && { toolsEnabled: true }),
      ...(input.skillId && { skillId: input.skillId }),
      // a provider session lives in one working directory: fixed at creation
      ...(def?.workspace && { workspace: def.workspace }),
      createdAt: t,
      updatedAt: t,
      messages: [],
    };
    this.conversations.set(c.id, c);
    this.emit('conversation.created', { conversationId: c.id, agentId: c.agentId, providerId });
    void this.repo.flush(this.snapshot);
    this.changed();
    return c;
  }

  /** Change connection, model or effort ('' = the model's default). The connection can only change before the first turn. */
  configure(conversationId: string, patch: { connectionId?: string; model?: string; effort?: string }) {
    const c = this.require(conversationId);
    if (this.active.has(conversationId)) throw new ChatError('Wait for the reply to finish.');
    if (patch.connectionId !== undefined && patch.connectionId !== c.connectionId) {
      if (c.messages.length) throw new ChatError('The AI connection of a conversation cannot change once it has started.');
      const provider = this.providers.resolve(patch.connectionId);
      if (!provider) throw new ChatError('That AI connection is not available.');
      c.connectionId = patch.connectionId;
      c.providerId = provider.id;
      // a model (and its effort) belongs to its connection
      if (patch.model === undefined) delete c.model;
      if (patch.effort === undefined) delete c.effort;
    }
    if (patch.model !== undefined) {
      if (patch.model.trim()) c.model = patch.model.trim();
      else delete c.model;
    }
    if (patch.effort !== undefined) {
      if (patch.effort.trim()) c.effort = patch.effort.trim();
      else delete c.effort;
    }
    c.updatedAt = this.now();
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  /** A title chosen by the user: kept for good (an AI title never replaces it). */
  rename(conversationId: string, title: string) {
    const c = this.require(conversationId);
    const t = cleanTitle(title);
    if (!t) throw new ChatError('Write a title first.');
    c.title = t;
    c.titleSource = 'user';
    this.updated(c, ['title']);
  }

  /** Use a Skill in this chat from the next message on (undefined: none). */
  setSkill(conversationId: string, skillId: string | undefined) {
    const c = this.require(conversationId);
    if (c.skillId === skillId) return;
    if (skillId) c.skillId = skillId;
    else delete c.skillId;
    this.updated(c, ['skillId']);
  }

  /** The Knowledge this chat searches from the next message on (undefined: none; an agent chat then uses the agent's). */
  setKnowledge(conversationId: string, sel: KnowledgeSelection | undefined) {
    const c = this.require(conversationId);
    const next = sel && sel.baseIds.length ? { baseIds: [...new Set(sel.baseIds)], mode: sel.mode } : undefined;
    if (JSON.stringify(next ?? null) === JSON.stringify(c.knowledge ?? null)) return;
    if (next) c.knowledge = next;
    else delete c.knowledge;
    this.updated(c, ['knowledge']);
  }

  /** what a chat's next turn searches: its own choice, else its agent's */
  knowledgeFor(c: Conversation): KnowledgeSelection | undefined {
    const def = c.agentId ? this.opts.agent?.(c.agentId) : undefined;
    const sel = c.knowledge ?? (def?.knowledgeBaseIds?.length ? { baseIds: def.knowledgeBaseIds, mode: def.knowledgeMode ?? 'grounded' } : undefined);
    return this.opts.knowledge?.validSelection(sel);
  }

  /** Web access for this chat from the next message on (undefined: an agent chat follows its agent). */
  setWeb(conversationId: string, on: boolean | undefined) {
    const c = this.require(conversationId);
    if (c.web === on) return;
    if (on === undefined) delete c.web;
    else c.web = on;
    this.updated(c, ['web']);
  }

  /** Offer RealmNest tools in this chat from the next message on (or stop offering them). */
  setTools(conversationId: string, on: boolean) {
    const c = this.require(conversationId);
    if (!!c.toolsEnabled === on) return;
    if (on) c.toolsEnabled = true;
    else delete c.toolsEnabled;
    this.updated(c, ['toolsEnabled']);
  }

  setPinned(conversationId: string, pinned: boolean) {
    const c = this.require(conversationId);
    if (!!c.pinned === pinned) return;
    if (pinned) c.pinned = true;
    else delete c.pinned;
    this.updated(c, ['pinned']);
  }

  /** metadata changes do not count as use: the conversation keeps its place by recency */
  private updated(c: Conversation, fields: string[]) {
    this.emit('conversation.updated', { conversationId: c.id, fields });
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  remove(conversationId: string) {
    if (this.active.has(conversationId)) throw new ChatError('Stop the reply before deleting the conversation.');
    const c = this.conversations.get(conversationId);
    if (!c) return;
    this.conversations.delete(conversationId);
    for (const m of c.messages)
      for (const a of m.attachments ?? []) {
        this.blobs.delete(a.id);
        this.texts.delete(a.id);
      }
    for (const r of [...this.runs.values()]) if (r.conversationId === conversationId) this.runs.delete(r.id);
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  /**
   * After the provider lost its session: continue with a NEW one, explicitly.
   * The model will not see the earlier messages; a system note says so.
   */
  startNewSession(conversationId: string) {
    const c = this.require(conversationId);
    if (this.active.has(conversationId)) throw new ChatError('Wait for the reply to finish.');
    delete c.providerSession;
    this.addMessage(c, 'system', 'A new provider session starts here: the model does not remember the messages above.');
    void this.repo.flush(this.snapshot);
    this.changed();
  }

  // ── turns ────────────────────────────────────────────────
  /**
   * Add the user's message (and its attachments) and start the assistant's reply.
   * `skillIds`: Skills the user picked for this message (chips); `@id` mentions in the text count too.
   */
  send(conversationId: string, text: string, attachments: AttachmentInput[] = [], opts: { skillIds?: string[] } = {}): { run: ConversationRun; user: ChatMessage; assistant: ChatMessage } {
    const c = this.require(conversationId);
    const typed = text.trim();
    if (!typed && !attachments.length) throw new ChatError('Write a message first.');
    if (this.active.has(c.id)) throw new ChatError('Wait for the reply to finish, or stop it.');
    if (c.providerSession?.state === 'lost') throw new ChatError('The provider no longer has this conversation. Start a new session to continue.');
    const provider = this.providers.resolve(c.connectionId);
    if (!provider) throw new ChatError('This conversation’s AI connection is no longer available.');
    const problem = attachmentProblem(attachments);
    if (problem) throw new ChatError(problem);
    // Skills, by precedence (skills/precedence.ts): named here > the agent's own > a confident automatic pick
    const catalog = this.opts.skills?.catalog?.() ?? [];
    const knownIds = catalog.map((s) => s.id);
    const mentioned = mentionedSkills(typed, knownIds);
    const explicit = [...new Set([...(opts.skillIds ?? []), ...mentioned])];
    const def = c.agentId ? this.opts.agent?.(c.agentId) : undefined;
    const pick = pickSkills({ explicit, assigned: [...(def?.skillIds ?? []), ...(c.skillId ? [c.skillId] : [])], text: typed, catalog });
    const activation = activatePick(this.opts.skills, pick, {
      connectionId: c.connectionId,
      model: c.model,
      canUseTools: !!this.opts.tools?.modeFor(c.connectionId, c.model),
      // with an agent, a Skill's tools must be among the agent's own (docs/HARDENING.md I-5)
      ...(def && { agentPermissions: def.toolPermissions, agentToolIds: def.allowedToolIds ?? [] }),
    });
    if (!activation.ok) throw new ChatError(skillFailure(activation.error));
    const skill = activation.active;
    // the model reads the message without the @mentions: the Skills themselves are active
    const content = stripMentions(typed, mentioned, knownIds);
    for (const a of attachments) {
      if (!a.storageRef && (a.kind === 'text' ? a.text === undefined : !a.data)) throw new ChatError(`${a.name} could not be read.`);
      const why = this.cannotTake(provider, c, a.kind);
      if (why) throw new ChatError(`${a.name}: ${why}`);
    }

    const prior = c.messages.filter((m) => m.status === 'complete' && m.role !== 'system');
    const user = this.addMessage(c, 'user', content);
    if (explicit.length) user.skillIds = explicit;
    if (attachments.length) {
      user.attachments = attachments.map(({ data, ...meta }) => {
        const id = this.newId('att');
        if (data) this.blobs.set(id, data);
        // a stored text file keeps its text in memory only (the message stays small); older ones keep it inline
        if (meta.storageRef && meta.text !== undefined) {
          this.texts.set(id, meta.text);
          delete meta.text;
        }
        return { ...meta, id, createdAt: meta.createdAt ?? this.now() };
      });
    }
    if (c.title === 'New conversation' && c.titleSource !== 'user') {
      c.title = conversationTitle(content || typed || attachments[0].name);
      c.titleSource = 'auto';
    }
    const assistant = this.addMessage(c, 'assistant', '', 'streaming');

    const session: ProviderSessionRef | undefined = provider.capabilities.sessions ? (c.providerSession ? { mode: 'resume', id: c.providerSession.id } : { mode: 'new' }) : undefined;
    const run: ConversationRun = {
      id: this.newId('run'),
      conversationId: c.id,
      userMessageId: user.id,
      assistantMessageId: assistant.id,
      providerId: c.providerId,
      connectionId: c.connectionId,
      ...(c.model && { model: c.model }),
      status: 'starting',
      resumed: session?.mode === 'resume',
      createdAt: this.now(),
      ...(skill?.refs.length && { skills: skill.refs }),
    };
    user.runId = run.id;
    assistant.runId = run.id;
    this.runs.set(run.id, run);
    const active: Active = { run, conversation: c, assistant, handle: null };
    this.active.set(c.id, active);
    this.emit('conversation.run.started', { conversationId: c.id, runId: run.id, providerId: run.providerId, resumed: run.resumed });
    void this.repo.flush(this.snapshot);
    this.changed();
    // anything that throws while the request is built ends the turn failed: never stuck "streaming" (docs/HARDENING.md R-11)
    void this.dispatch(active, { provider, session, prior, user, skill, catalog, pickIds: pick.ids, def }).catch((e) => {
      try {
        this.failRun(active, 'internal', e instanceof Error ? e.message : String(e));
      } catch {
        /* the run had already ended */
      }
    });
    return { run, user, assistant };
  }

  /** why this conversation's model cannot take a kind of attachment (undefined: it can) */
  private cannotTake(provider: { name: string; capabilities: { vision?: boolean; files?: boolean } }, c: Conversation, kind: AttachmentKind): string | undefined {
    if (kind === 'text') return undefined;
    if (kind === 'image' && !provider.capabilities.vision) return `${provider.name} cannot take images through RealmNest.`;
    if (kind === 'pdf' && !provider.capabilities.files) return `${provider.name} cannot take PDFs through RealmNest.`;
    return this.opts.consumes?.(c.connectionId, c.model, kind);
  }

  /** build the provider request (attachment bytes come from the FileStore when not cached) and start the turn */
  private async dispatch(
    active: Active,
    t: {
      provider: { name: string; capabilities: { vision?: boolean; files?: boolean; sessions?: boolean } };
      session?: ProviderSessionRef;
      prior: ChatMessage[];
      user: ChatMessage;
      skill?: Extract<SkillActivationResult, { ok: true }>;
      catalog: SkillCatalogEntry[];
      pickIds: string[];
      def?: AgentDefinition;
    },
  ) {
    const { conversation: c, run } = active;
    let messages: ProviderMessage[];
    try {
      const turn = await this.providerMessage(t.user, { strict: true });
      if (t.session) messages = [turn];
      else {
        // providers without sessions get the history; earlier files only within a budget, and only kinds this model takes
        const budget = { left: HISTORY_FILE_BUDGET };
        const older: ProviderMessage[] = [];
        for (const m of [...t.prior].reverse()) older.unshift(await this.providerMessage(m, { budget, provider: t.provider, conversation: c }));
        messages = [...older, turn];
      }
    } catch (e) {
      return this.failRun(active, 'invalid_request', e instanceof Error ? e.message : String(e));
    }
    if (active.cancelled) return;
    // a resumed provider session keeps the system prompt of its first turn: active Skills travel with the message itself
    const last = messages[messages.length - 1];
    if (t.session?.mode === 'resume' && t.skill) messages = [...messages.slice(0, -1), { ...last, content: `${t.skill.context}\n\n# Message\n${last.content}` }];
    // Knowledge: sources for this message now (every model gets them), search_knowledge for more when tools run
    const sel = this.knowledgeFor(c);
    const canSearch = !!sel && !!this.opts.tools?.modeFor(c.connectionId, c.model);
    if (sel && this.opts.knowledge) {
      let k: Awaited<ReturnType<KnowledgeRunner['beginRun']>>;
      try {
        k = await this.opts.knowledge.beginRun(run.id, sel, t.user.content, { canSearch });
      } catch (e) {
        return this.failRun(active, 'knowledge_unavailable', e instanceof Error ? e.message : String(e));
      }
      if (active.cancelled) return;
      if (sel.mode === 'strict' && !k.sources && !canSearch) return this.answerLocally(active, STRICT_NOTHING_FOUND);
      const now = messages[messages.length - 1];
      messages = [...messages.slice(0, -1), { ...now, content: `${k.context}\n\n# Message\n${now.content}` }];
    }
    // Memory: the agent's own approved memories for this message (never in STRICT Knowledge runs)
    let memoryTool = false;
    if (c.agentId && this.opts.memory?.usable(c.agentId)) {
      try {
        const m = await this.opts.memory.beginRun(run.id, c.agentId, t.user.content, { canSearch: !!this.opts.tools?.modeFor(c.connectionId, c.model), ...(sel && { knowledgeMode: sel.mode }) });
        if (active.cancelled) return;
        memoryTool = m.tool;
        if (m.context) {
          const now = messages[messages.length - 1];
          messages = [...messages.slice(0, -1), { ...now, content: withContext(now.content, m.context) }];
        }
      } catch {
        // memory never blocks a turn
      }
    }
    // Web: public pages (web_fetch) and search (web_search), only when this chat has Web access on
    let webTools = false;
    // a backend that searches the web itself (ChatGPT through Codex) may do so when Web is on
    let providerWeb = false;
    if (this.opts.web && (c.web ?? t.def?.webAccess ?? false)) {
      if (sel?.mode === 'strict') run.web = this.opts.web.skipped('Knowledge STRICT mode: answers come from documents only');
      else {
        providerWeb = !!this.providers.resolve(c.connectionId)?.capabilities.nativeWebInTurns;
        try {
          const userTexts = c.messages.filter((m) => m.role === 'user').map((m) => m.content);
          const w = await this.opts.web.beginRun(run.id, { canFetch: !!this.opts.tools?.modeFor(c.connectionId, c.model), userTexts, ...(sel && { knowledgeMode: sel.mode }), ...(providerWeb && { nativeSearch: true }) });
          if (active.cancelled) return;
          webTools = w.tools;
          const now = messages[messages.length - 1];
          messages = [...messages.slice(0, -1), { ...now, content: withContext(now.content, w.context) }];
        } catch {
          // the web never blocks a turn
        }
      }
    }
    const request = {
      runId: run.id,
      messages,
      session: t.session,
      model: c.model,
      ...(c.effort && { effort: c.effort }),
      ...(providerWeb && { providerWeb: true }),
      // the agent, what Skills exist (so the model can say which it has), then the active Skills
      systemPrompt: [c.agentId ? agentSystemPrompt(this.opts.identity?.(c.agentId), t.def ?? {}) : undefined, skillCatalog(t.catalog, t.def?.skillIds ?? [], t.pickIds), t.skill?.context].filter(Boolean).join('\n\n') || undefined,
      workspace: c.workspace,
    };
    // tools on: the runnable tools the user allows, plus an active Skill's. Tools off: a Skill brings no tools
    // the user did not turn on, only the reading of its own resources (docs/HARDENING.md I-5)
    const skill = t.skill;
    const all = () => this.opts.tools?.offer(c.connectionId, c.model, undefined, undefined, c.workspace).ids ?? [];
    const skillTools = skill && (c.toolsEnabled ? skill.toolIds : skill.toolIds.filter((id) => id === SKILL_RESOURCE_TOOL));
    const base = skillTools ? [...skillTools, ...(c.toolsEnabled ? all() : [])] : c.toolsEnabled ? all() : undefined;
    const withKnowledge = knowledgeTools(sel, canSearch, base, skillTools);
    const withMemory = memoryTool && sel?.mode !== 'strict' ? [...(withKnowledge ?? []), SEARCH_MEMORY_ID] : withKnowledge;
    // a model with its own web search reads pages with web_fetch, but never searches twice
    const wanted = webTools ? [...(withMemory ?? []), ...(providerWeb ? [WEB_FETCH_ID] : WEB_TOOL_IDS)] : withMemory;
    const offer = wanted?.length ? this.opts.tools?.offer(c.connectionId, c.model, [...new Set(wanted)], undefined, c.workspace) : undefined;
    // the files this run may hand to its tools: this conversation's attachments, nothing else
    const files = c.messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.storageRef)).map((a) => ({ id: a.id, name: a.name, mime: a.mime, storageRef: a.storageRef! }));
    // delegate_task offered: the model learns who it can hand work to
    if (offer?.ids.includes('delegate_task')) {
      const team = this.opts.team?.(c.agentId);
      if (team) request.systemPrompt = [request.systemPrompt, team].filter(Boolean).join('\n\n');
    }
    active.handle = offer?.ids.length
      ? this.opts.tools!.run(
          c.connectionId,
          request,
          { runId: run.id, conversationId: c.id, allowedToolIds: offer.ids, workspace: offer.workspace, requester: 'Chat', attachments: files, messageId: active.assistant.id, ...(skill?.refs.length && { skills: skill.refs }), ...(c.agentId && { agentId: c.agentId }) },
          (e) => this.onProviderEvent(active, e),
        )
      : this.providers.run(c.connectionId, request, (e) => this.onProviderEvent(active, e));
  }

  /** a reply RealmNest writes itself (STRICT with nothing to answer from): no provider call */
  private answerLocally(active: Active, text: string) {
    const { run, conversation: c, assistant } = active;
    run.startedAt = this.now();
    this.setRun(run, 'running');
    assistant.content = text;
    assistant.status = 'complete';
    this.finish(active, 'completed');
    this.emit('conversation.message.added', { conversationId: c.id, messageId: assistant.id, role: 'assistant' });
    this.emit('conversation.run.completed', { conversationId: c.id, runId: run.id });
    this.changed();
  }

  /** a run that ends before the provider: the reason is the assistant's error */
  private failRun(active: Active, code: string, message: string) {
    const { run, conversation: c, assistant } = active;
    if (RUN_TRANSITIONS[run.status].length === 0) return;
    run.error = { code, message };
    assistant.status = 'failed';
    assistant.error = { code, message };
    this.finish(active, 'failed');
    this.emit('conversation.run.failed', { conversationId: c.id, runId: run.id, error: { code, message } });
    this.changed();
  }

  /** Stop the reply being written in this conversation. */
  async stop(conversationId: string) {
    const active = this.active.get(conversationId);
    if (!active) return;
    if (active.handle) return active.handle.cancel();
    // still preparing (reading files): it never reaches the provider
    active.cancelled = true;
    active.assistant.status = 'cancelled';
    this.finish(active, 'cancelled');
    this.emit('conversation.run.cancelled', { conversationId, runId: active.run.id });
    this.changed();
  }

  /** an image's or PDF's bytes (base64): the memory cache, else the FileStore (undefined: gone) */
  async attachmentBytes(a: Attachment): Promise<string | undefined> {
    const cached = this.blobs.has(a.id);
    const b64 = await this.reader.bytes(a);
    if (b64 && !cached) this.changed();
    return b64;
  }

  /**
   * A message as a provider gets it: text files written in, images and PDFs attached.
   * `strict`: a file that cannot be read fails the turn (the new message). In the history a note
   * stands in for it, and for files over the budget or of kinds this model does not take.
   */
  private async providerMessage(
    m: ChatMessage,
    o: { strict?: boolean; budget?: { left: number }; provider?: { name: string; capabilities: { vision?: boolean; files?: boolean } }; conversation?: Conversation },
  ): Promise<ProviderMessage> {
    const files: ProviderAttachment[] = [];
    const notes: string[] = [];
    const texts = new Map<string, string>();
    for (const a of m.attachments ?? []) {
      if (a.kind === 'text') {
        const t = await this.reader.text(a);
        if (t !== undefined) texts.set(a.id, t);
        else if (o.strict) throw new ChatError(`${a.name} is no longer available (its file is missing).`);
        else notes.push(`[${a.name} (text) was attached here; its contents are no longer available]`);
        continue;
      }
      const refuse = o.provider && o.conversation ? this.cannotTake(o.provider, o.conversation, a.kind) : undefined;
      if (refuse) {
        notes.push(`[${a.name} (${a.kind}) was attached here; this model cannot take it]`);
        continue;
      }
      if (o.budget && o.budget.left < a.size * 1.37) {
        notes.push(`[${a.name} (${a.kind}) was attached earlier; not sent again]`);
        continue;
      }
      const data = await this.attachmentBytes(a);
      if (data) {
        files.push({ kind: a.kind, name: a.name, mime: a.mime, data });
        if (o.budget) o.budget.left -= data.length;
      } else if (o.strict) throw new ChatError(`${a.name} is no longer available (its file is missing).`);
      else notes.push(`[${a.name} (${a.kind}) was attached here; its contents are no longer available]`);
    }
    const content = [withTextAttachments(m.content, m.attachments, texts), ...notes].filter(Boolean).join('\n\n') || (files.length ? 'See the attached files.' : m.content);
    return { role: m.role as 'user' | 'assistant', content, ...(files.length && { attachments: files }) };
  }

  /** an attachment's bytes while cached (image previews; attachmentBytes loads them) */
  attachmentData(attachmentId: string): string | undefined {
    return this.blobs.get(attachmentId);
  }

  /** a user message's attachments, ready to send again (retry): stored files by reference */
  attachmentInputs(messageId: string): AttachmentInput[] {
    for (const c of this.conversations.values()) {
      const m = c.messages.find((x) => x.id === messageId);
      if (!m) continue;
      return (m.attachments ?? []).flatMap(({ id, ...meta }) => {
        if (meta.storageRef) return [{ ...meta, ...(this.blobs.has(id) && { data: this.blobs.get(id)! }), ...(this.texts.has(id) && { text: this.texts.get(id)! }) }];
        return meta.kind === 'text' ? [meta] : this.blobs.has(id) ? [{ ...meta, data: this.blobs.get(id)! }] : [];
      });
    }
    return [];
  }

  /** the Artifact an attachment was made from (lineage), if any */
  attachmentArtifact(attachmentId: string): string | undefined {
    for (const c of this.conversations.values()) for (const m of c.messages) for (const a of m.attachments ?? []) if (a.id === attachmentId) return a.artifactId;
    return undefined;
  }

  /** every stored file this runtime's conversations reference (the file store keeps these) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const c of this.conversations.values()) for (const m of c.messages) for (const a of m.attachments ?? []) if (a.storageRef) out.add(a.storageRef);
    return out;
  }

  private onProviderEvent(active: Active, e: ProviderEvent) {
    const { run, conversation: c, assistant } = active;
    if (RUN_TRANSITIONS[run.status].length === 0) return; // finished: nothing counts after
    switch (e.type) {
      case 'provider.started':
        run.startedAt = this.now();
        this.setRun(run, 'running');
        break;
      case 'session.started':
        c.providerSession = { providerId: c.providerId, id: e.sessionId, state: 'active' };
        break;
      case 'text.delta':
        if (assistant.content.length < MAX_MESSAGE_CHARS) assistant.content += e.text;
        this.emit('conversation.output.delta', { conversationId: c.id, runId: run.id, text: e.text }, { log: false });
        this.repo.touch(this.snapshot);
        break;
      case 'usage.updated':
        if (e.cumulative) {
          run.usage = e.usage;
          if (e.costUsd !== undefined) run.costUsd = e.costUsd;
        }
        break;
      case 'run.completed':
        // the final answer wins over what streamed (they match for plain text)
        if (e.text) assistant.content = e.text;
        if (e.sessionId) c.providerSession = { providerId: c.providerId, id: e.sessionId, state: 'active' };
        if (e.usage) run.usage = e.usage;
        if (e.costUsd !== undefined) run.costUsd = e.costUsd;
        assistant.status = 'complete';
        this.finish(active, 'completed');
        this.emit('conversation.message.added', { conversationId: c.id, messageId: assistant.id, role: 'assistant' });
        this.emit('conversation.run.completed', { conversationId: c.id, runId: run.id });
        this.maybeTitle(c);
        break;
      case 'run.failed':
        run.error = { code: e.error.code, message: e.error.message, ...(e.error.detail && { detail: e.error.detail }) };
        assistant.status = 'failed';
        assistant.error = { code: e.error.code, message: e.error.message, ...(e.error.detail && { detail: e.error.detail }) };
        // never continue a session the provider says it lost: the user decides (startNewSession)
        if (e.error.code === 'session_not_found' && c.providerSession) c.providerSession = { ...c.providerSession, state: 'lost' };
        this.finish(active, 'failed');
        this.emit('conversation.run.failed', { conversationId: c.id, runId: run.id, error: { code: e.error.code, message: e.error.message } });
        break;
      case 'run.cancelled':
        assistant.status = 'cancelled';
        this.finish(active, 'cancelled');
        this.emit('conversation.run.cancelled', { conversationId: c.id, runId: run.id });
        break;
      default:
        return;
    }
    this.changed();
  }

  /** At most once per conversation, after its first good reply; the turn never waits for it. */
  private maybeTitle(c: Conversation) {
    if (!this.opts.titler || !this.opts.aiTitles?.() || c.titleSource === 'user' || c.titleRequestedAt) return;
    const user = c.messages.find((m) => m.role === 'user' && m.status === 'complete');
    const reply = c.messages.find((m) => m.role === 'assistant' && m.status === 'complete' && m.content.trim());
    if (!user || !reply) return;
    c.titleRequestedAt = this.now();
    void this.opts
      .titler({ connectionId: c.connectionId, model: c.model, firstMessage: user.content, firstReply: reply.content })
      .then((raw) => {
        const t = raw ? cleanTitle(raw) : '';
        // the user may have renamed or deleted it meanwhile
        if (!t || !this.conversations.has(c.id) || c.titleSource === 'user') return;
        c.title = t;
        c.titleSource = 'ai';
        this.updated(c, ['title']);
      })
      .catch(() => undefined);
  }

  private finish(active: Active, outcome: 'completed' | 'failed' | 'cancelled') {
    // a record that cannot be written never keeps the turn from ending (docs/HARDENING.md R-11)
    const safe = <T>(f: () => T): T | undefined => {
      try {
        return f();
      } catch {
        return undefined;
      }
    };
    // what was retrieved and cited, checked against the final answer
    const k = safe(() => this.opts.knowledge?.finishRun(active.run.id, outcome === 'completed' ? active.assistant.content : undefined));
    if (k) active.run.knowledge = k;
    const m = safe(() => this.opts.memory?.finishRun(active.run.id, outcome === 'completed'));
    if (m) active.run.memory = m;
    const w = safe(() => this.opts.web?.finishRun(active.run.id, outcome === 'completed' ? active.assistant.content : undefined));
    if (w) active.run.web = w;
    if (outcome === 'completed') safe(() => this.proposeMemories(active));

    active.run.finishedAt = this.now();
    active.conversation.updatedAt = this.now();
    this.setRun(active.run, outcome);
    this.active.delete(active.conversation.id);
    // the queue: a good reply sends the next message; a stopped or failed one leaves it to the user
    const c = active.conversation;
    if (c.queued?.length) {
      if (outcome === 'completed') queueMicrotask(() => this.sendNextQueued(c.id));
      else c.queuePaused = true;
    }
    void this.repo.flush(this.snapshot);
  }

  // ── queue ────────────────────────────────────────────────
  /**
   * Send a message, or queue it while a reply is going: it is sent by itself after that reply
   * (docs/CHAT.md "Queue"). What can be checked now throws now: something to send, the files kept by
   * reference, the queue size; the rest when it is sent.
   */
  submit(conversationId: string, text: string, attachments: AttachmentInput[] = [], opts: { skillIds?: string[] } = {}): { queued: boolean } {
    const c = this.require(conversationId);
    // nothing waits and nothing runs: an ordinary message
    if (!this.active.has(c.id) && !c.queued?.length) return (this.send(c.id, text, attachments, opts), { queued: false });
    if (!text.trim() && !attachments.length) throw new ChatError('Write a message first.');
    if ((c.queued?.length ?? 0) >= MAX_QUEUED) throw new ChatError(`${MAX_QUEUED} messages are already waiting.`);
    const problem = attachmentProblem(attachments);
    if (problem) throw new ChatError(problem);
    const kept = attachments.map(({ data: _data, ...meta }) => meta);
    const lost = kept.find((a) => !a.storageRef && !(a.kind === 'text' && a.text !== undefined));
    if (lost) throw new ChatError(`${lost.name} could not be kept for later: send it after the reply.`);
    c.queued = [...(c.queued ?? []), { id: this.newId('msg'), text, createdAt: this.now(), ...(kept.length && { attachments: kept }), ...(opts.skillIds?.length && { skillIds: opts.skillIds }) }];
    this.updated(c, ['queued']);
    // nothing runs (a paused queue): this one waits behind the others until the user sends them
    return { queued: true };
  }

  /** take a waiting message out of the queue */
  removeQueued(conversationId: string, queuedId: string) {
    const c = this.require(conversationId);
    if (!c.queued?.some((q) => q.id === queuedId)) return;
    c.queued = c.queued.filter((q) => q.id !== queuedId);
    if (!c.queued.length) (delete c.queued, delete c.queuePaused, delete c.queueError);
    this.updated(c, ['queued']);
  }

  /** a paused queue goes on: its first message is sent now (when no reply is going) */
  resumeQueue(conversationId: string) {
    const c = this.require(conversationId);
    delete c.queuePaused;
    delete c.queueError;
    if (!this.active.has(c.id)) this.sendNextQueued(c.id);
    else this.updated(c, ['queued']);
  }

  /** the first waiting message goes out; one that cannot be sent goes back first and pauses the queue */
  private sendNextQueued(conversationId: string) {
    const c = this.conversations.get(conversationId);
    if (!c || this.active.has(c.id) || c.queuePaused || !c.queued?.length) return;
    const [next, ...rest] = c.queued;
    if (rest.length) c.queued = rest;
    else delete c.queued;
    delete c.queueError;
    try {
      this.send(c.id, next.text, next.attachments ?? [], { ...(next.skillIds && { skillIds: next.skillIds }) });
    } catch (e) {
      c.queued = [next, ...rest];
      c.queuePaused = true;
      c.queueError = e instanceof Error ? e.message : String(e);
      this.updated(c, ['queued']);
    }
  }

  /** after an agent chat turn: maybe propose memories (never blocks, never saves on its own) */
  private proposeMemories(active: Active) {
    const { run, conversation: c, assistant } = active;
    if (!c.agentId || !this.opts.memory?.usable(c.agentId)) return;
    const users = c.messages.filter((m) => m.role === 'user' && m.status === 'complete');
    const at = users.findIndex((m) => m.id === run.userMessageId);
    const texts = users.slice(Math.max(0, at - 2), at + 1).map((m) => m.content);
    if (!texts.length) return;
    void this.opts.memory
      .afterRun({ runId: run.id, agentId: c.agentId, sourceType: 'chat', conversationId: c.id, messageId: run.userMessageId, userTexts: texts, answer: assistant.content, connectionId: c.connectionId, ...(c.model && { model: c.model }), providerId: c.providerId })
      .catch(() => undefined)
      .then(() => this.changed());
  }

  private setRun(run: ConversationRun, to: RunStatus) {
    if (run.status === to) return;
    if (!RUN_TRANSITIONS[run.status].includes(to)) throw new ChatError(`run ${run.id}: ${run.status} → ${to} is not allowed`);
    run.status = to;
  }

  private addMessage(c: Conversation, role: MessageRole, content: string, status: ChatMessage['status'] = 'complete'): ChatMessage {
    const m: ChatMessage = { id: this.newId('msg'), conversationId: c.id, role, content, status, createdAt: this.now() };
    c.messages.push(m);
    c.updatedAt = m.createdAt;
    if (status === 'complete') this.emit('conversation.message.added', { conversationId: c.id, messageId: m.id, role });
    return m;
  }

  private require(id: string): Conversation {
    const c = this.conversations.get(id);
    if (!c) throw new ChatError('Unknown conversation.');
    return c;
  }

  private emit<K extends EventType>(type: K, payload: EventMap[K], opts: EmitOptions = {}) {
    this.bus.emit(type, payload, { ...LIVE, ...opts });
  }

  snapshot = (): ChatSnapshot => ({ version: CHAT_SCHEMA, conversations: [...this.conversations.values()], runs: [...this.runs.values()] });
}

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bus } from './core/events';
import { flushAll } from './persistence/coalesced';
import { shouldCollect, storageHealth } from './persistence/health';
import { RealmNestRepository } from './persistence/repository';
import { defaultAdapter, type StorageAdapter } from './persistence/storage';
import { anthropicTransport, codexModels, fileStore, logTransport, updateTransport, mcpBridgeTransport, mcpHost, notifyTransport, ollamaTransport, openAiTransport, openRouterTransport, processRunner, secretStore, skillStore, telegramTransport, toolHost, webTransport } from './platform';
import { TelegramBridge } from './runtime/telegram/bridge';
import { agentSheet } from './ui/telegram/agentSheet';
import { lookOf } from './ui/sessionManager';
import { translator } from './i18n';
import { dataText } from './locales/data';
import { WORLD_BY_ID } from './data/worlds';
import { ArtifactService } from './runtime/files/artifacts';
import { EmbeddingService, OpenRouterEmbeddings, openAiEmbeddings, ollamaEmbeddings, type EmbeddingProvider } from './runtime/knowledge/embeddings';
import { KnowledgeService } from './runtime/knowledge/service';
import { registerKnowledgeTool } from './runtime/knowledge/tool';
import { MemoryService, type CompleteFn } from './runtime/memory/service';
import { registerMemoryTool } from './runtime/memory/tool';
import { WebService } from './runtime/web/service';
import { registerWebTools, WEB_FETCH_ID } from './runtime/web/tool';
import { syncSearchEngines } from './runtime/web/connectionSearch';
import { DesktopNotifier } from './runtime/notify/service';
import { AppLog, wireLog } from './runtime/diagnostics/log';
import { UpdateService } from './runtime/update/service';
import { PriceList } from './runtime/providers/priceList';
import { CrewService } from './runtime/crew/service';
import { WorkflowLibrary } from './runtime/workflow/library';
import { Orchestrator, type ToolRunner } from './runtime/workflow/orchestrator';
import { Scheduler } from './runtime/workflow/scheduler';
import { DelegationService, registerDelegationTool } from './runtime/delegation/service';
import { pictureKeeper } from './runtime/research/pictures';
import { ResearchService } from './runtime/research/service';
import { UsageService, type UsageOwner } from './runtime/usage/service';
import { registerResearchTool } from './runtime/research/tool';
import { SkillService } from './runtime/skills/service';
import { McpBridge } from './runtime/mcp/bridge';
import { McpClientManager } from './runtime/mcp/manager';
import { ToolLoop } from './runtime/tools/loop';
import { registerNativeTools } from './runtime/tools/native';
import { registerFileTools } from './runtime/tools/fileTools';
import { ToolPolicyStore } from './runtime/tools/policy';
import { ToolRegistry } from './runtime/tools/registry';
import { ToolRuntime } from './runtime/tools/runtime';
import { ToolService } from './runtime/tools/service';
import { COMING_SOON, ProviderCatalog } from './runtime/connections/catalog';
import { ConnectionManager } from './runtime/connections/manager';
import { CapabilityService } from './runtime/capabilities/service';
import { claudeCodeDefinition } from './runtime/providers/claude-code/definition';
import { createOpenRouterDefinition } from './runtime/providers/openrouter/definition';
import { createAnthropicDefinition } from './runtime/providers/anthropic/definition';
import { createOpenAiDefinition } from './runtime/providers/openai/definition';
import { createOllamaDefinition } from './runtime/providers/ollama/definition';
import { createCodexDefinition } from './runtime/providers/codex/definition';
import { ProviderRegistry } from './runtime/providers/registry';
import { ProviderService } from './runtime/providers/service';
import { LiveRuntime } from './runtime/live/liveRuntime';
import { RuntimeRepository } from './runtime/live/repository';
import { ConversationRuntime } from './runtime/chat/conversationRuntime';
import { ConversationRepository } from './runtime/chat/repository';
import { providerTitler } from './runtime/chat/titles';
import { AppStore } from './store/appStore';
import { App } from './ui/App';
import { ErrorBoundary, RecoveryScreen, showRecovery, takeSafeLaunch } from './ui/ErrorBoundary';
import { ServicesProvider } from './ui/context';
import { SessionManager } from './ui/sessionManager';
import { preloadCast } from './render/cast/castPeople';
import { AudioEngine } from './audio/engine';
import { wireAudio } from './audio/wire';
import { APP_VERSION } from './version';
import './styles.css';

// Composition root: wire adapters → store → sessions → UI.
// RealmNest's log first, so a service that does not start is in it too (docs/DIAGNOSTICS.md)
const appLog = new AppLog(logTransport());
wireLog(appLog, bus, window);
// "Start safely" (the recovery page): this launch skips MCP autostart, Telegram and the scheduler's catch-up
const safe = takeSafeLaunch();
storageHealth.setSafeMode(safe);
// a write that failed in the previous session keeps this session from deleting files (D-4)
storageHealth.readPreviousSession();
// a failed save goes to the log too (the banner shows it in the app)
let loggedWriteError: number | undefined;
storageHealth.subscribe(() => {
  const h = storageHealth.getSnapshot();
  if (h.lastErrorAt && h.lastErrorAt !== loggedWriteError) {
    loggedWriteError = h.lastErrorAt;
    appLog.error('storage', `a save failed: ${h.writeFailures.map((f) => f.key).join(', ')}: ${h.lastError ?? ''}`);
  }
});
/** in a safe start, what is not loaded must not be saved over: its writes are dropped */
const unlessSafe = (a: StorageAdapter): StorageAdapter => (safe ? { kind: a.kind, get: (k) => a.get(k), set: async () => undefined, remove: async () => undefined } : a);
const store = new AppStore(new RealmNestRepository(defaultAdapter()), bus);
// providers RealmNest knows (the catalogue) and the user's connections to them (docs/CONNECTIONS.md);
// a profile from before connections existed gets its Claude Code sign-in as the first connection; a new
// installation starts with none (0.11.1)
const catalog = new ProviderCatalog().register(claudeCodeDefinition).register(createOpenRouterDefinition(openRouterTransport())).register(createAnthropicDefinition(anthropicTransport())).register(createCodexDefinition(codexModels())).register(createOpenAiDefinition(openAiTransport())).register(createOllamaDefinition(ollamaTransport()));
COMING_SOON.filter((d) => !catalog.get(d.id)).forEach((d) => catalog.register(d));
const secrets = secretStore();
const connections = new ConnectionManager(bus, catalog, defaultAdapter(), { runner: processRunner(), secrets }, { seedProviderId: claudeCodeDefinition.id, legacyProfile: async () => (await defaultAdapter().get('save')) !== undefined });
// every turn runs on a connection's adapter
// reference prices for models sold by subscription, from OpenRouter's public catalogue (docs/PROVIDERS.md)
const prices = new PriceList(openRouterTransport(), defaultAdapter());
const providers = new ProviderService(new ProviderRegistry(), bus, (id) => connections.provider(id));
// what each connection/model can do, and the user's routing policy (docs/CAPABILITIES.md)
const capabilities = new CapabilityService(connections, bus, defaultAdapter());
const route = (cap: Parameters<CapabilityService['resolveRoute']>[0]) => capabilities.resolveRoute(cap);
const legacyConnection = (providerId: string) => connections.forLegacyProvider(providerId);
// RealmNest tools: one registry, one runtime with permissions and approval (docs/TOOLS.md)
const nativeHost = toolHost();
const toolRegistry = registerNativeTools(new ToolRegistry(), nativeHost);
const toolPolicy = new ToolPolicyStore(defaultAdapter(), bus);
let alwaysAllow: (agentId: string, toolId: string) => void = () => {};
// files: one store for attachment and artifact bytes; what tools produce becomes an Artifact (docs/FILES.md)
const files = fileStore();
let artifacts: ArtifactService | undefined;
// Knowledge: the user's indexed documents, searched by runs with citations RealmNest checks (docs/KNOWLEDGE.md)
// embeddings by provider: OpenRouter, the OpenAI API, or the local Ollama
const embeddingProviders: Record<string, EmbeddingProvider> = { openrouter: new OpenRouterEmbeddings(), 'openai-api': openAiEmbeddings(), ollama: ollamaEmbeddings() };
const embeddings = new EmbeddingService(
  (connectionId) => {
    const c = connections.get(connectionId);
    const adapter = connections.provider(connectionId);
    const provider = c ? embeddingProviders[c.providerId] : undefined;
    if (!c || c.removedAt || !adapter?.capabilities.embeddings || !provider) return undefined;
    return { provider, providerId: c.providerId, available: c.status === 'connected', name: c.name };
  },
  () => {
    const r = capabilities.resolveRoute('embeddings.create');
    return r.ok && r.target ? r.target : undefined;
  },
);
embeddings.onCatalog = () => capabilities.refresh();
capabilities.useEmbeddingCatalog((id) => embeddings.catalog(id));
// RealmNest Docs: the product documentation of this build, searchable as a built-in base
const REALMNEST_DOCS = import.meta.glob(['../docs/{CAPABILITIES,CHAT,CONNECTIONS,FILES,KNOWLEDGE,MEMORY,MCP,PROVIDERS,RUNTIME,SKILLS,TOOLS,UI_UX}.md', '../README.md'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const knowledge = new KnowledgeService(defaultAdapter(), files, bus, embeddings, {
  builtIn: () => Object.entries(REALMNEST_DOCS).map(([path, text]) => ({ name: path.split('/').pop()!, text })),
  artifact: (id) => artifacts?.get(id),
});
registerKnowledgeTool(toolRegistry, knowledge);
// Memory: what each agent learned from working with the user, kept only with the user's approval (docs/MEMORY.md)
let agentInfo: (id: string) => { name?: string; memory?: import('./domain/memory').AgentMemorySettings } | undefined = () => undefined;
const extract: CompleteFn = async ({ connectionId, model, system, user, schema }) => {
  // a JSON-schema answer when the adapter and the model support it; otherwise JSON text, validated the same way
  const so = !!schema && !!connections.provider(connectionId)?.capabilities.structuredOutput && capabilities.effective(connectionId, model)['structured.output'].support === 'supported';
  const run = providers.run(connectionId, { model, systemPrompt: system, messages: [{ role: 'user', content: user }], timeoutMs: 90_000, ...(so && { responseSchema: { name: 'memory_proposals', schema: schema! } }) });
  const end = await run.done;
  if (end.type !== 'run.completed') throw new Error(end.type === 'run.failed' ? end.error.message : 'The extraction did not finish.');
  return { text: end.text ?? '', ...(end.usage && { usage: end.usage }), ...(end.costUsd !== undefined && { costUsd: end.costUsd }), structured: so };
};
const memory = new MemoryService(defaultAdapter(), bus, { embeddings, complete: extract, agent: (id) => agentInfo(id) });
registerMemoryTool(toolRegistry, memory);
// Web: public pages read safely (web_fetch); web_search through the web search of an AI connection that has one (docs/WEB.md)
// the Cast character atlases (about 2 MB) start loading now; figures switch over when ready
preloadCast();
const web = new WebService(defaultAdapter(), bus, webTransport());
registerWebTools(toolRegistry, web);
const UNUSABLE = new Set(['disconnected', 'auth_required', 'invalid_credentials', 'unavailable', 'error']);
const syncSearch = syncSearchEngines(web, providers, () =>
  connections
    .list()
    .filter((c) => connections.provider(c.id)?.capabilities.webSearch)
    .map((c) => {
      const needsModel = !!connections.catalog.get(c.providerId)?.requiresModel && !c.preferredModel;
      return { id: c.id, name: c.name, providerId: c.providerId, usable: !UNUSABLE.has(c.status) && !needsModel, ...(c.preferredModel && { model: c.preferredModel }) };
    }),
);
connections.subscribe(syncSearch);
// Deep Research: the chosen connection's own web search + the Web layer + Knowledge (docs/DEEP_RESEARCH.md)
const research = new ResearchService(defaultAdapter(), bus, providers, web, knowledge, (id) => {
  const c = connections.get(id);
  if (!c) return undefined;
  return { providerId: c.providerId, name: c.name, webSearch: !!connections.provider(id)?.capabilities.webSearch, needsModel: !!connections.catalog.get(c.providerId)?.requiresModel && !c.preferredModel };
}, { ...(web.available && files.persistent && { keepPicture: pictureKeeper(web, files) }) });
// a run's own attachments, copied into its workspace for other tools (desktop: the native store writes there)
registerFileTools(toolRegistry, files, nativeHost.available && files.persistent);
const toolRuntime = new ToolRuntime(toolRegistry, toolPolicy, bus, defaultAdapter(), {
  onAlwaysAllow: (a, t) => alwaysAllow(a, t),
  // web_fetch of an address that came from nowhere the user can see asks first (no silent exfiltration)
  escalate: (toolId, input, scope) => (toolId === WEB_FETCH_ID ? web.approvalHint(scope.runId, (input as { url?: unknown })?.url) : undefined),
  onCompleted: (call, result, scope) => {
    const serverId = toolRegistry.get(call.toolId)?.metadata?.mcpServerId;
    void artifacts?.fromToolResult(call, result, { ...scope, ...(serverId && { serverId }) });
  },
});
capabilities.useToolCount(() => toolRegistry.list().filter((t) => toolRegistry.available(t.id)).length);
// MCP servers: one more source of ToolDefinitions in the same registry (docs/MCP.md)
const mcp = new McpClientManager(mcpHost(), toolRegistry, defaultAdapter(), secrets, bus, { clientInfo: { name: 'RealmNest OS', version: APP_VERSION } });
// Claude Code reaches RealmNest tools through RealmNest's own MCP server (the bridge)
const bridge = new McpBridge(mcpBridgeTransport(), toolRuntime, toolRegistry, { name: 'realmnest', version: APP_VERSION });
capabilities.useToolBridge(() => bridge.available);
const tools = new ToolService(
  toolRegistry,
  toolRuntime,
  toolPolicy,
  new ToolLoop(providers, toolRuntime, toolRegistry),
  (connectionId, model) => {
    const caps = connections.provider(connectionId)?.capabilities;
    const eff = capabilities.effective(connectionId, model)['tools.calling'];
    // loop: the adapter takes RealmNest tools and the model's catalogue lists tool calling
    if (caps?.toolCalling) return eff.support === 'supported' ? 'loop' : undefined;
    // bridge: the adapter runs its own loop and calls RealmNest's MCP server
    if (caps?.toolBridge) return eff.ready ? 'bridge' : undefined;
    return undefined;
  },
  { bridge, providers },
);
// Skills: portable procedures, activated per run (docs/SKILLS.md)
const skills = new SkillService(
  defaultAdapter(),
  skillStore(),
  toolRegistry,
  {
    permission: (toolId, agentPermissions) => toolRuntime.permissionFor(toolId, { agentPermissions }),
    mcpServers: () => mcp.list().map((c) => ({ key: c.key, name: c.name, reportedName: mcp.state(c.id).serverInfo?.name, discovered: mcp.state(c.id).tools.map((t) => t.name), enabled: c.enabledTools })),
    capability: (cap, connectionId, model) => {
      const e = capabilities.effective(connectionId, model)[cap];
      return { ready: e.ready, available: e.available, support: e.support, ...(e.note && { note: e.note }) };
    },
  },
  bus,
);
const defaultConnection = () => connections.defaultId();
// real agents: tasks and runs through the providers (docs/RUNTIME.md)
const identity = (id: string) => store.getState().characters.find((c) => c.id === id);
// a model gets an image or a PDF only when its capabilities say it reads them (never just the file name)
const consumes = (connectionId: string, model: string | undefined, kind: 'image' | 'pdf') => {
  const e = capabilities.effective(connectionId, model)[kind === 'image' ? 'vision.input' : 'files.input'];
  return e.support === 'unsupported' ? `this model does not read ${kind === 'image' ? 'images' : 'PDFs'}${e.note ? ` (${e.note})` : ''}.` : undefined;
};
// delegation: agents (and chats) hand work to colleagues (docs/DELEGATION.md); bound once live and chat exist
let delegation: DelegationService | undefined;
const live = new LiveRuntime(bus, providers, new RuntimeRepository(defaultAdapter()), { identity, defaultConnection, legacyConnection, route, tools, skills, files, consumes, knowledge, memory, web, team: (id) => delegation?.teamPrompt(id) });
agentInfo = (id) => ({ name: identity(id)?.name, memory: live.agent(id).memory });
// "always allow" on an agent's approval prompt is remembered on that agent
alwaysAllow = (agentId, toolId) => live.updateAgent(agentId, { toolPermissions: { ...live.agent(agentId).toolPermissions, [toolId]: 'allow' } });
// conversations: chats with agents or directly with a connection (docs/CHAT.md)
const chat = new ConversationRuntime(bus, providers, new ConversationRepository(defaultAdapter()), {
  identity,
  team: (agentId) => delegation?.teamPrompt(agentId, !agentId),
  agent: (id) => live.agent(id),
  legacyConnection,
  route,
  // optional short titles (Settings › General, off by default: one extra request)
  titler: providerTitler(providers),
  aiTitles: () => store.getState().settings.aiTitles,
  tools,
  skills,
  files,
  consumes,
  knowledge,
  memory,
  web,
});
// deep_research as a tool: the chat turn's or the agent task's own connection and model
delegation = new DelegationService(bus, live, {
  members: () => store.getState().characters.map((c) => ({ id: c.id, name: c.name, role: c.role, worldId: c.worldId })),
  chatRun: (runId) => {
    const r = chat.run(runId);
    if (!r) return undefined;
    const agentId = chat.get(r.conversationId)?.agentId;
    return { conversationId: r.conversationId, ...(agentId && { agentId }) };
  },
});
registerDelegationTool(toolRegistry, delegation);
registerResearchTool(toolRegistry, research, (runId) => {
  const c = chat.run(runId);
  if (c?.connectionId) return { connectionId: c.connectionId, ...(c.model && { model: c.model }) };
  const a = live.getRun(runId);
  if (a?.connectionId) return { connectionId: a.connectionId, ...(a.model && { model: a.model }), agentId: a.agentId };
  return undefined;
});
// a deleted artifact's bytes stay while an attachment still uses them; lineage follows "Use in Chat"
artifacts = new ArtifactService(bus, defaultAdapter(), files, {
  inUse: (): Set<string> => new Set([...chat.storageRefs(), ...live.storageRefs(), ...knowledge.storageRefs(), ...research.storageRefs(), ...crews.storageRefs()]),
  attachmentArtifact: (id) => chat.attachmentArtifact(id) ?? live.attachmentArtifact(id),
});
// crews: agents of one world on one goal, with a task graph, hand-offs and review (docs/CREW.md)
const crews = new CrewService(defaultAdapter(), bus, live, {
  name: (id) => identity(id)?.name,
  worldOf: (id) => identity(id)?.worldId,
  keep: async (o) => {
    const a = await artifacts!.register({ name: o.name, bytes: new TextEncoder().encode(o.text), mimeType: 'text/markdown', provenance: { origin: 'crew', crewRunId: o.runId, ...(o.agentId && { createdByAgentId: o.agentId }), ...(o.agentRunId && { runId: o.agentRunId }), ...(o.agentTaskId && { taskId: o.agentTaskId }) } });
    return a.id;
  },
});
// workflows (docs/WORKFLOWS.md): the library says what, the scheduler when, the orchestrator how
const workflows = new WorkflowLibrary(defaultAdapter(), { refs: { agent: (id) => !!identity(id), tool: (id) => !!toolRegistry.get(id), crew: (id) => !!crews.get(id) } });
/** a tool node: one call through the tool runtime (its permissions and approvals); text fields become the types the schema asks for */
const workflowTools: ToolRunner = {
  run: async (toolId, input, ctx) => {
    const tool = toolRegistry.get(toolId);
    if (!tool) return { ok: false, output: '', error: `the tool ${toolId} is not available` };
    const props = ((tool.inputSchema as { properties?: Record<string, { type?: string }> }).properties ?? {}) as Record<string, { type?: string }>;
    const typed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      const want = props[k]?.type;
      if (want && want !== 'string') {
        try {
          typed[k] = JSON.parse(v);
          continue;
        } catch {
          /* kept as text */
        }
      }
      typed[k] = v;
    }
    const { result } = await toolRuntime.execute({ name: tool.name, input: typed }, { runId: ctx.runId, requester: ctx.requester, allowedToolIds: [toolId] }, ctx.signal);
    return { ok: result.success, output: result.content ?? (result.structuredData === undefined ? '' : JSON.stringify(result.structuredData)), ...(result.error && { error: result.error.message, code: result.error.code }) };
  },
  // only a low-risk (read-only) tool may run again after a failure: a write that timed out may still have happened (docs/HARDENING.md R-12)
  retryable: (toolId) => toolRegistry.get(toolId)?.risk === 'low',
  endRun: (runId) => toolRuntime.endRun(runId),
};
const orchestrator = new Orchestrator(defaultAdapter(), bus, live, {
  tools: workflowTools,
  crews,
  name: (id) => identity(id)?.name,
  keep: async (o) => {
    const a = await artifacts!.register({ name: o.name, bytes: new TextEncoder().encode(o.text), mimeType: 'text/markdown', provenance: { origin: 'workflow', workflowRunId: o.runId } });
    return a.id;
  },
});
// Telegram: the phone as a remote control of RealmNest (docs/TELEGRAM.md); free text goes to a concierge on the Chat route
const concierge = async (system: string, user: string) => {
  const r = capabilities.resolveRoute('text.chat');
  if (!r.ok || !r.target) throw new Error(r.reason ?? 'no Chat route is set');
  const run = providers.run(r.target.connectionId, { model: r.target.modelId, systemPrompt: system, messages: [{ role: 'user', content: user }], timeoutMs: 60_000 });
  const end = await run.done;
  if (end.type !== 'run.completed') throw new Error(end.type === 'run.failed' ? end.error.message : 'no answer');
  return end.text ?? '';
};
const lang = () => store.getState().settings.language;
// the page's language follows the setting (screen readers, hyphenation)
store.subscribe(() => document.documentElement.lang !== lang() && (document.documentElement.lang = lang()));
// the agents' portraits for Telegram's "who do you want to talk to?", drawn again only when they change
let sheet: { key: string; ref: string } | undefined;
const telegram = new TelegramBridge({
  transport: telegramTransport(),
  storage: unlessSafe(defaultAdapter()),
  bus,
  t: () => translator(lang()),
  agents: () => store.getState().characters.map((c) => ({ id: c.id, name: c.name, role: dataText(lang(), c.role), worldId: c.worldId })),
  worldName: (id) => dataText(lang(), WORLD_BY_ID[id]?.name ?? id),
  live: {
    startTask: (a, i) => live.startTask(a, i),
    activeRun: (a) => live.activeRun(a),
    cancel: (a) => live.cancel(a),
    taskTitle: (id) => live.getTask(id)?.title,
    giveTask: (a, i) => live.giveTask(a, i),
    queueLength: (a) => live.queued(a).length,
    queuedEnd: (id) => {
      const task = live.getTask(id);
      return task && { started: task.runIds.length > 0, ...(task.error && { error: task.error.message }) };
    },
  },
  crews,
  workflows,
  orchestrator,
  missedSchedules: () => scheduler.missedUnseen(),
  approvals: { list: () => toolRuntime.approvals(), decide: (id, d) => toolRuntime.decide(id, d) },
  artifacts: {
    get: (id) => artifacts?.get(id),
    // the newest artifact whose name has the most words of the request
    find: (text) => {
      const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
      let best: { a: ReturnType<ArtifactService['list']>[number]; n: number } | undefined;
      for (const a of artifacts?.list() ?? []) {
        const n = words.filter((w) => a.name.toLowerCase().includes(w)).length;
        if (n && (!best || n > best.n || (n === best.n && (a.updatedAt ?? 0) > (best.a.updatedAt ?? 0)))) best = { a, n };
      }
      return best?.a;
    },
  },
  complete: concierge,
  agentSheet: async () => {
    const chars = store.getState().characters;
    const key = `${lang()}|${chars.map((c) => `${c.id}:${c.name}:${c.role}:${c.outfitId}:${c.outfitVariant ?? ''}:${JSON.stringify(c.profile)}`).join('|')}`;
    if (sheet?.key === key) return { storageRef: sheet.ref };
    const bytes = await agentSheet(chars.map((c) => ({ name: c.name, role: dataText(lang(), c.role), look: lookOf(c) })));
    if (!bytes) return undefined;
    const stored = await files.put(bytes);
    sheet = { key, ref: stored.storageRef };
    return { storageRef: stored.storageRef };
  },
});
// Windows notifications while RealmNest is in the background: approvals, and work that ended (docs/NOTIFICATIONS.md)
const notifier = new DesktopNotifier({
  bus,
  storage: defaultAdapter(),
  transport: notifyTransport(),
  t: () => translator(lang()),
  agentName: (id) => store.getState().characters.find((c) => c.id === id)?.name,
  task: (taskId, runId) => {
    const task = live.getTask(taskId);
    return task && { title: task.title, step: !!task.crew || !!task.workflow || !!live.getRun(runId)?.parentRunId };
  },
  approval: (callId) => {
    const p = toolRuntime.approvals().find((x) => x.call.id === callId);
    const tool = p && toolRegistry.get(p.call.toolId);
    return p && { who: p.requester, tool: tool?.title ?? tool?.name ?? p.call.toolId };
  },
  crew: (id) => {
    const r = crews.run(id);
    return r && { status: r.status, name: r.crew.name, ...(r.error && { error: r.error }) };
  },
  workflow: (id) => {
    const r = orchestrator.get(id);
    return r && { status: r.status, name: r.definition.name, ...(r.error && { error: r.error }) };
  },
  research: (id) => {
    const r = research.get(id);
    return r && { status: r.status, question: r.question, agent: r.owner.kind === 'agent', ...(r.error && { error: r.error }) };
  },
  // a click: the screen the notification was about (an approval prompt shows wherever you are)
  open: (tag) => {
    const at = tag.indexOf(':');
    const [kind, id] = [tag.slice(0, at), tag.slice(at + 1)];
    if (kind === 'crew') store.openCrew({ runId: id });
    else if (kind === 'wf') store.openWorkflow({ runId: id, tab: 'runs' });
    else if (kind === 'research') store.openResearch({ id });
    else if (kind === 'agent') {
      const c = store.getState().characters.find((x) => x.id === id);
      if (c) (store.setWorld(c.worldId), store.navigate('simulation'));
    }
  },
});
// updates: signed releases from GitHub, installed only when the user agrees (docs/UPDATES.md)
const updates = new UpdateService(updateTransport(), defaultAdapter(), { flush: () => Promise.all([flushAll(), appLog.flush()]), log: (level, message) => appLog[level]('update', message) });
const scheduler = new Scheduler(unlessSafe(defaultAdapter()), { definition: (id) => workflows.get(id), createRun: (d, inputs, trigger) => orchestrator.create(d, inputs, trigger) });
// usage: every provider turn's tokens and cost, by connection, agent and chat (docs/USAGE.md)
const usageOwner = (runId: string): UsageOwner => {
  const base = runId.split('~')[0];
  const c = chat.run(base);
  if (c) return { kind: 'chat', conversationId: c.conversationId, ...(chat.get(c.conversationId)?.agentId && { agentId: chat.get(c.conversationId)!.agentId! }) };
  const a = live.getRun(base);
  if (a) return { kind: 'agent', agentId: a.agentId };
  const r = research.get(base);
  if (r) return { kind: 'research', researchId: r.id, ...(r.owner.kind === 'agent' && { agentId: r.owner.agentId }) };
  return { kind: 'other' };
};
const usage = new UsageService(defaultAdapter(), bus, usageOwner);
const sessions = new SessionManager(store, bus, live);
// a newer version of an artifact makes the documents made from it stale
bus.on('artifact.updated', () => knowledge.checkStale());
// a deleted agent's memories go with it (tombstones; nothing stays retrievable)
bus.on('character.deleted', (p) => void memory.onAgentDeleted(p.id));

if (import.meta.env.DEV) Object.assign(window, { realmnest: { store, sessions, bus, providers, live, chat, connections, capabilities, tools, mcp, skills, files, artifacts, knowledge, embeddings, memory, web, research, crews, workflows, orchestrator, scheduler } });

// a change saved with a delay is written when the window closes (D-8)
window.addEventListener('pagehide', () => (void flushAll(), void appLog.flush()));
window.addEventListener('beforeunload', () => (void flushAll(), void appLog.flush()));

/** one service's start: a failure marks it as not started (banner) and the app still opens (D-2) */
const step = (service: string, init: () => unknown) =>
  Promise.resolve()
    .then(init)
    .catch((err) => {
      console.error(`[realmnest] ${service} did not start`, err);
      storageHealth.startupIssue(service, err);
    });

/** the files one service still uses; undefined when it cannot say (then nothing is deleted) */
const refsOf = (service: string, refs: () => Iterable<string>): string[] | undefined => {
  try {
    return [...refs()];
  } catch (err) {
    console.error(`[realmnest] ${service} could not list its files`, err);
    return undefined;
  }
};

const rootEl = document.getElementById('root')!;

// connections first: tasks and chats saved before them migrate onto them
step('connections', () => connections.init())
  .then(() =>
    Promise.all([
      step('settings', () => store.init()),
      step('runtime', () => live.init()),
      step('chat', () => chat.init()),
      step('capabilities', () => capabilities.init()),
      step('tool-policy', () => toolPolicy.init()),
      step('tool-calls', () => toolRuntime.init()),
      // a safe start loads the servers but starts none
      step('mcp', () => mcp.init({ autostart: !safe })),
      step('skills', () => skills.init()),
      step('artifacts', () => artifacts.init()),
    ]),
  )
  // Knowledge after artifacts: its stale check reads them
  .then(() => Promise.all([step('knowledge', () => knowledge.init()), step('memory', () => memory.init()), step('web', () => web.init()), step('research', () => research.init()), step('usage', () => usage.init()), step('crews', () => crews.init()), step('workflows', () => workflows.init()), step('notifications', () => notifier.init()), step('prices', () => prices.init())]))
  // the orchestrator after crews (crew nodes follow their runs); the scheduler after it (a catch-up creates runs)
  .then(() => step('orchestrator', () => orchestrator.init()))
  .then(() => (safe ? undefined : step('scheduler', () => scheduler.init())))
  .then(() => {
    // after the scheduler: Telegram reports what was missed while RealmNest was closed; it talks to the
    // network, so the window does not wait for it (I-4)
    if (!safe) void step('telegram', () => telegram.init());
    void step('updates', () => updates.init());
    sessions.start();
    // music, the worlds' ambience and effects, all synthesised (docs/AUDIO.md)
    wireAudio(new AudioEngine(), store, bus);
    // managed files no record uses any more go, only when every store loaded cleanly and nothing failed to save (D-4)
    const lists = [
      refsOf('chat', () => chat.storageRefs()),
      refsOf('runtime', () => live.storageRefs()),
      refsOf('artifacts', () => artifacts.storageRefs()),
      refsOf('knowledge', () => knowledge.storageRefs()),
      refsOf('research', () => research.storageRefs()),
      // crew outputs, once the crew service lists them (C-4)
      refsOf('crews', () => crews.storageRefs()),
    ];
    const keep = lists.every((l): l is string[] => l !== undefined) ? lists.flat() : undefined;
    const skip = shouldCollect({ persistent: files.persistent, keep, health: storageHealth.getSnapshot() });
    storageHealth.noteCollectSkipped(skip);
    if (keep && !skip) void files.collect(keep).catch(() => undefined);
    // statuses are never trusted from disk: check every connection for real
    void connections.validateAll();
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary fallback={(error) => <RecoveryScreen error={error} lang={lang()} />}>
          <ServicesProvider value={{ store, bus, sessions, providers, live, chat, connections, capabilities, tools, mcp, skills, files, artifacts, knowledge, embeddings, memory, web, research, usage, crews, workflows, orchestrator, scheduler, telegram, notifier, log: appLog, updates, prices }}>
            <App />
          </ServicesProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  })
  // whatever else went wrong: a page that says so, never a blank window
  .catch((err) => {
    console.error('[realmnest] start failed', err);
    showRecovery(rootEl, err, lang());
  });

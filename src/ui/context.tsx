import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ArtifactService } from '../runtime/files/artifacts';
import type { FileStore } from '../runtime/files/store';
import type { EventBus } from '../core/events';
import type { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import type { ConnectionManager } from '../runtime/connections/manager';
import type { CapabilityService } from '../runtime/capabilities/service';
import type { LiveRuntime } from '../runtime/live/liveRuntime';
import type { ProviderService } from '../runtime/providers/service';
import type { McpClientManager } from '../runtime/mcp/manager';
import type { EmbeddingService } from '../runtime/knowledge/embeddings';
import type { KnowledgeService } from '../runtime/knowledge/service';
import type { MemoryService } from '../runtime/memory/service';
import type { WebService } from '../runtime/web/service';
import type { ResearchService } from '../runtime/research/service';
import type { UsageService } from '../runtime/usage/service';
import type { CrewService } from '../runtime/crew/service';
import type { WorkflowLibrary } from '../runtime/workflow/library';
import type { Orchestrator } from '../runtime/workflow/orchestrator';
import type { Scheduler } from '../runtime/workflow/scheduler';
import type { TelegramBridge } from '../runtime/telegram/bridge';
import type { DesktopNotifier } from '../runtime/notify/service';
import type { AppLog } from '../runtime/diagnostics/log';
import type { SkillService } from '../runtime/skills/service';
import type { ToolService } from '../runtime/tools/service';
import { translator } from '../i18n';
import { dataText } from '../locales/data';
import type { AppState, AppStore } from '../store/appStore';
import type { SessionManager } from './sessionManager';

export interface Services {
  store: AppStore;
  bus: EventBus;
  sessions: SessionManager;
  providers: ProviderService;
  live: LiveRuntime;
  chat: ConversationRuntime;
  connections: ConnectionManager;
  capabilities: CapabilityService;
  tools: ToolService;
  mcp: McpClientManager;
  skills: SkillService;
  files: FileStore;
  artifacts: ArtifactService;
  knowledge: KnowledgeService;
  embeddings: EmbeddingService;
  memory: MemoryService;
  web: WebService;
  research: ResearchService;
  usage: UsageService;
  crews: CrewService;
  workflows: WorkflowLibrary;
  orchestrator: Orchestrator;
  scheduler: Scheduler;
  telegram: TelegramBridge;
  notifier: DesktopNotifier;
  log: AppLog;
}

const Ctx = createContext<Services | null>(null);
export const ServicesProvider = Ctx.Provider;

export function useServices() {
  const s = useContext(Ctx);
  if (!s) throw new Error('Services missing');
  return s;
}

export function useApp(): AppState {
  const { store } = useServices();
  return useSyncExternalStore(store.subscribe, store.getState);
}

export function useT() {
  const lang = useApp().settings.language;
  return useMemo(() => translator(lang), [lang]);
}

/** world data (world, zone, station, task and outfit names) in the user's language: td('Lounge sofa') */
export function useTD() {
  const lang = useApp().settings.language;
  return useMemo(() => (text: string | undefined) => dataText(lang, text), [lang]);
}

/** Current world session; re-renders on session swap and on sim changes (~4×/s). */
export function useSession() {
  const { sessions } = useServices();
  const session = useSyncExternalStore((fn) => sessions.onSession(fn), sessions.getSession);
  useSyncExternalStore(
    (fn) => (session ? session.subscribe(fn) : () => {}),
    () => (session ? session.getVersion() : 0),
  );
  return session;
}

/** Re-renders when the live runtime changes (runs, streamed output, statuses). */
export function useLive() {
  const { live } = useServices();
  useSyncExternalStore(live.subscribe, live.getVersion);
  return live;
}

/** Re-renders when conversations change (new messages, streamed text, run states). */
export function useChat() {
  const { chat } = useServices();
  useSyncExternalStore(chat.subscribe, chat.getVersion);
  return chat;
}

/** Re-renders when AI connections change (added, renamed, status checked). */
export function useConnections() {
  const { connections } = useServices();
  useSyncExternalStore(connections.subscribe, connections.getVersion);
  return connections;
}

/** Re-renders when capabilities or routes may have changed (policy edits, connection checks, catalogues). */
export function useCapabilities() {
  const { capabilities } = useServices();
  useSyncExternalStore(capabilities.subscribe, capabilities.getVersion);
  return capabilities;
}

/** Re-renders when tools, their calls, pending approvals or the tool policy change. */
/** Skills, re-rendering on Skill, tool, MCP and policy changes (their readiness depends on all four) */
export function useSkills() {
  const { skills, tools, mcp } = useServices();
  useSyncExternalStore(skills.subscribe, skills.getVersion);
  useSyncExternalStore(tools.registry.subscribe, tools.registry.getVersion);
  useSyncExternalStore(tools.policy.subscribe, tools.policy.getVersion);
  useSyncExternalStore(mcp.subscribe, mcp.getVersion);
  return skills;
}

/** Knowledge bases, documents and indexing jobs */
export function useKnowledge() {
  const { knowledge } = useServices();
  useSyncExternalStore(knowledge.subscribe, knowledge.getVersion);
  return knowledge;
}

/** agent memories and proposals */
export function useMemory() {
  const { memory } = useServices();
  useSyncExternalStore(memory.subscribe, memory.getVersion);
  return memory;
}

/** the web layer: settings, engine slots, recent fetches */
/** Deep Research runs */
export function useTelegram() {
  const { telegram } = useServices();
  useSyncExternalStore(telegram.subscribe, telegram.getVersion);
  return telegram;
}

export function useNotifier() {
  const { notifier } = useServices();
  useSyncExternalStore(notifier.subscribe, notifier.getVersion);
  return notifier;
}

export function useWorkflows() {
  const { workflows } = useServices();
  useSyncExternalStore(workflows.subscribe, workflows.getVersion);
  return workflows;
}

export function useOrchestrator() {
  const { orchestrator } = useServices();
  useSyncExternalStore(orchestrator.subscribe, orchestrator.getVersion);
  return orchestrator;
}

export function useScheduler() {
  const { scheduler } = useServices();
  useSyncExternalStore(scheduler.subscribe, scheduler.getVersion);
  return scheduler;
}

export function useCrews() {
  const { crews } = useServices();
  useSyncExternalStore(crews.subscribe, crews.getVersion);
  return crews;
}

export function useUsage() {
  const { usage } = useServices();
  useSyncExternalStore(usage.subscribe, usage.getVersion);
  return usage;
}

export function useResearch() {
  const { research } = useServices();
  useSyncExternalStore(research.subscribe, research.getVersion);
  return research;
}

export function useWeb() {
  const { web } = useServices();
  useSyncExternalStore(web.subscribe, web.getVersion);
  return web;
}

export function useMcp() {
  const { mcp } = useServices();
  useSyncExternalStore(mcp.subscribe, mcp.getVersion);
  return mcp;
}

export function useTools() {
  const { tools } = useServices();
  useSyncExternalStore(tools.runtime.subscribe, tools.runtime.getVersion);
  useSyncExternalStore(tools.policy.subscribe, tools.policy.getVersion);
  useSyncExternalStore(tools.registry.subscribe, tools.registry.getVersion);
  return tools;
}

// ─────────────────────────────────────────────────────────────
// Central event bus + event log.
// Everything that happens (UI, runtime, visual world) is published here.
// In Phase 2 the real agent runtime publishes to the same bus and the
// world simply reacts — "runtime event → visual state".
// ─────────────────────────────────────────────────────────────

import type { LiveAgentStatus, RunStatus, TaskStatus } from '../domain/agent';
import type { ConnectionStatus } from '../domain/connection';
import type { AgentState, SimCommand, Task } from '../domain/sim';
import type { ProviderEvent, ProviderStatus } from '../runtime/providers/types';

/** a tool call's lifecycle (ids and outcome only: inputs and outputs stay in the call record) */
export interface ToolEventPayload {
  toolCallId: string;
  runId: string;
  toolId: string;
  agentId?: string;
  conversationId?: string;
  code?: string;
}

export interface EventMap {
  'character.created': { id: string; name: string };
  'character.updated': { id: string; name: string; fields: string[] };
  'character.deleted': { id: string; name: string };
  'world.changed': { worldId: string };
  'simulation.started': { worldId: string };
  'simulation.paused': { worldId: string; frozen: boolean };
  'simulation.reset': { worldId: string };
  'simulation.step': { dt: number };
  'command.issued': SimCommand;
  // runtime → world
  'agent.work.started': { agentId: string; task: Task; resumed?: boolean };
  'agent.work.completed': { agentId: string; task: Task };
  'agent.work.failed': { agentId: string; task: Task; error: string };
  'agent.break.started': { agentId: string };
  'agent.paused': { agentId: string };
  'agent.idle': { agentId: string };
  'agent.waiting': { agentId: string; reason: string };
  'agent.meeting.started': { agentId: string };
  /** `live`: a real hand-over (delegate_task): after it the delegating agent waits for the answer */
  'agent.delegation': { from: string; to: string; title: string; live?: boolean };
  /** the colleague answered (or the hand-over ended): the delegating agent goes back to work */
  'agent.delegation.returned': { from: string; to: string };
  /** a Crew meeting ends for this agent (kickoff, final): back to idle */
  'agent.meeting.ended': { agentId: string };
  /** a Crew hand-off: `from` walks over to `to` with their output (or a review) */
  'agent.handoff': { from: string; to: string };
  /** something happened in a Crew run (docs/CREW.md) */
  'crew.event': { runId: string; crewId: string; kind: string; message: string };
  /** something happened in a workflow run (docs/WORKFLOWS.md) */
  'workflow.event': { runId: string; workflowId: string; kind: string; message: string };
  // world (visual)
  'agent.state.changed': { agentId: string; from: AgentState; to: AgentState };
  'agent.walk.started': { agentId: string; to: string };
  'agent.walk.completed': { agentId: string; at: string };
  'interaction.started': { agentId: string; pointId: string; type: string };
  'interaction.completed': { agentId: string; pointId: string };
  // live agent runtime: domain truth (see docs/RUNTIME.md)
  'agent.status.changed': { agentId: string; from: LiveAgentStatus; to: LiveAgentStatus };
  'task.status.changed': { taskId: string; agentId: string; from: TaskStatus | null; to: TaskStatus };
  'agent.run.started': { agentId: string; runId: string; taskId: string; providerId: string; title: string };
  'agent.run.status': { agentId: string; runId: string; from: RunStatus; to: RunStatus };
  'agent.run.output.delta': { agentId: string; runId: string; text: string };
  'agent.run.completed': { agentId: string; runId: string; taskId: string; result: string; durationMs?: number; costUsd?: number };
  'agent.run.failed': { agentId: string; runId: string; taskId: string; error: { code: string; message: string } };
  'agent.run.cancelled': { agentId: string; runId: string; taskId: string };
  // conversations (see docs/CHAT.md)
  'conversation.created': { conversationId: string; agentId?: string; providerId: string };
  'conversation.message.added': { conversationId: string; messageId: string; role: 'user' | 'assistant' | 'system' };
  'conversation.run.started': { conversationId: string; runId: string; providerId: string; resumed: boolean };
  'conversation.output.delta': { conversationId: string; runId: string; text: string };
  'conversation.run.completed': { conversationId: string; runId: string };
  'conversation.run.failed': { conversationId: string; runId: string; error: { code: string; message: string } };
  'conversation.run.cancelled': { conversationId: string; runId: string };
  'conversation.updated': { conversationId: string; fields: string[] };
  'character.moved': { id: string; name: string; from: string; to: string };
  'tool.requested': ToolEventPayload;
  'tool.awaiting_approval': ToolEventPayload;
  'tool.approved': ToolEventPayload;
  'tool.denied': ToolEventPayload;
  'tool.started': ToolEventPayload;
  'tool.completed': ToolEventPayload;
  'tool.failed': ToolEventPayload;
  'tool.cancelled': ToolEventPayload;
  'tool.policy.updated': { workspace: boolean; tools: number };
  // MCP servers (ids and counts only; never commands, variables or payloads)
  'mcp.server.added': { serverId: string; name: string };
  'mcp.server.updated': { serverId: string; fields: string[] };
  'mcp.server.removed': { serverId: string };
  'mcp.server.status': { serverId: string; status: string; tools: number; error?: string };
  'mcp.tools.changed': { serverId: string; added: number; removed: number; updated: number };
  // Skills (ids and versions only)
  'skill.installed': { skillId: string; version: string; origin: string; replaced: boolean };
  'skill.updated': { skillId: string; version: string };
  'skill.uninstalled': { skillId: string; version: string };
  'skill.activated': { runId: string; skills: string[]; tools: number };
  // Artifacts (ids and sizes only, never paths or contents; docs/FILES.md)
  'artifact.created': { artifactId: string; kind: string; size: number; runId?: string };
  'artifact.updated': { artifactId: string; kind: string; size: number; runId?: string };
  'artifact.deleted': { artifactId: string };
  'artifact.failed': { toolCallId?: string; code: string };
  // Knowledge (ids, counts and codes only, never document text; docs/KNOWLEDGE.md)
  'knowledge.base.created': { baseId: string; retrievalMode: string };
  'knowledge.base.updated': { baseId: string; fields: string[] };
  'knowledge.base.deleted': { baseId: string; documents: number };
  'knowledge.document.added': { baseId: string; documentId: string; sourceType: string; size: number };
  'knowledge.document.removed': { baseId: string; documentId: string };
  'knowledge.document.stale': { baseId: string; documentId: string; reason: string };
  'knowledge.index.started': { baseId: string; documentId: string; jobId: string };
  'knowledge.index.completed': { baseId: string; documentId: string; jobId: string; chunks: number; generation: number; embedded: number; reused: number; lexicalOnly: boolean };
  'knowledge.index.failed': { baseId: string; documentId: string; jobId: string; code: string };
  'knowledge.searched': { runId?: string; bases: number; results: number; lexicalOnly: boolean };
  'knowledge.run.verified': { runId: string; citations: number; invalid: number; verdict: string };
  // Memory (ids, counts and decisions only, never memory text; docs/MEMORY.md)
  'memory.created': { agentId: string; entryId: string; type: string; sourceType: string };
  'memory.updated': { agentId: string; entryId: string };
  'memory.deleted': { agentId: string; entryId: string };
  'memory.proposed': { runId: string; agentId: string; proposals: number; dropped: number };
  'memory.proposal.decided': { agentId: string; proposalId: string; decision: string };
  'memory.searched': { runId: string; agentId: string; results: number; viaTool: boolean };
  'memory.run.used': { runId: string; agentId: string; retrieved: number };
  'memory.agent.deleted': { agentId: string; entries: number };
  // Web (URLs never logged here; counts and codes only; docs/WEB.md)
  'web.fetched': { method: string; bytes: number; chars: number; cache: string; runId?: string };
  'web.searched': { engine: string; results: number; runId?: string };
  'web.run.finished': { runId: string; sources: number; citations: number; invalid: number };
  'research.created': { id: string; question: string };
  /** agentId: the agent whose task runs this research (the world shows it researching) */
  'research.event': { id: string; phase: string; message: string; agentId?: string };
  'research.done': { id: string };
  /** a run's status changed (e.g. its plan waits for approval); agentId: an agent's own research */
  'research.status': { id: string; status: string; agentId?: string };
  // AI connections (no secrets, ever; see docs/CONNECTIONS.md)
  'connection.created': { connectionId: string; providerId: string; name: string };
  'connection.updated': { connectionId: string; fields: string[] };
  'connection.status.changed': { connectionId: string; from: ConnectionStatus; to: ConnectionStatus };
  'connection.connected': { connectionId: string };
  'connection.disconnected': { connectionId: string };
  'connection.deleted': { connectionId: string };
  // routing policy (docs/CAPABILITIES.md)
  'routing.updated': { capability: string; targets: number };
  // model providers (normalized; see docs/PROVIDERS.md)
  'provider.status': { providerId: string; status: ProviderStatus };
  'provider.event': ProviderEvent;
}

export interface EmitOptions {
  /** false: deliver to listeners but keep it out of the log (high-frequency events) */
  log?: boolean;
  /** who produced it, for the event log ('live' = a real agent run) */
  origin?: 'live' | 'mock';
}

export type EventType = keyof EventMap;

export interface LoggedEvent<K extends EventType = EventType> {
  seq: number;
  type: K;
  payload: EventMap[K];
  /** wall clock ms */
  at: number;
  /** simulation seconds (if a sim was running) */
  simTime?: number;
  origin?: 'live' | 'mock';
}

type Handler<K extends EventType> = (payload: EventMap[K], e: LoggedEvent<K>) => void;

export class EventBus {
  private handlers = new Map<EventType | '*', Set<Handler<EventType>>>();
  private seq = 0;
  /** event types whose listener failure was already logged (once each) */
  private reported = new Set<EventType>();
  readonly log: LoggedEvent[] = [];
  /** set by the active simulation so events carry sim time */
  clock: () => number | undefined = () => undefined;

  constructor(private max = 300) {}

  on<K extends EventType>(type: K | '*', fn: Handler<K>): () => void {
    const key = type as EventType | '*';
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(fn as unknown as Handler<EventType>);
    return () => this.handlers.get(key)?.delete(fn as unknown as Handler<EventType>);
  }

  emit<K extends EventType>(type: K, payload: EventMap[K], opts: EmitOptions = {}) {
    const e: LoggedEvent<K> = { seq: ++this.seq, type, payload, at: Date.now(), simTime: this.clock(), ...(opts.origin && { origin: opts.origin }) };
    if (opts.log !== false) {
      this.log.unshift(e as LoggedEvent);
      if (this.log.length > this.max) this.log.pop();
    }
    // one listener that throws must not keep the others from hearing it (a run would stay stuck: docs/HARDENING.md R-10)
    const call = (h: Handler<EventType>) => {
      try {
        h(payload, e as LoggedEvent);
      } catch (err) {
        if (!this.reported.has(type)) {
          this.reported.add(type);
          console.error(`[bus] a listener of ${type} failed`, err);
        }
      }
    };
    this.handlers.get(type)?.forEach(call);
    this.handlers.get('*')?.forEach(call);
  }

  clearLog() {
    this.log.length = 0;
  }
}

/** The app-wide bus. Tests create their own instances. */
export const bus = new EventBus();

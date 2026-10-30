// ─────────────────────────────────────────────────────────────
// AGENT OS — runtime identity and work.
//
//   Character (visual identity: name, role, look)        domain/character.ts
//        ↓ is shown for
//   AgentDefinition (how it executes: provider, model, instructions)
//        ↓ receives
//   AgentTask (what the user asked)
//        ↓ executed by one or more
//   AgentRun (one attempt)  ──→  ProviderService turn  ──→  AIProvider
//
// Implemented: AgentDefinition, AgentTask, AgentRun (LiveRuntime,
// docs/RUNTIME.md) and the provider layer (docs/PROVIDERS.md).
// Still types only: tools, permissions, workflows, schedules.
// ─────────────────────────────────────────────────────────────

import type { Attachment, AttachmentInput } from './attachment';
import type { KnowledgeMode, KnowledgeRunRecord } from './knowledge';
import type { AgentMemorySettings, MemoryRunRecord } from './memory';
import type { WebRunRecord } from './web';
import type { SkillRunRef } from './skill';
import type { ToolPermission } from './tool';
import type { TokenUsage } from '../runtime/providers/types';

/**
 * The minimal configuration an agent needs to execute. Its id is the id of
 * the Character it is shown as (one agent per character); name and role live
 * on the Character only.
 */
export interface AgentDefinition {
  /** = Character.id */
  id: string;
  /** the AI connection it runs on (Settings › AI Connections) */
  connectionId: string;
  /** run on the default chat route (Settings › AI Capabilities) instead of connectionId */
  useDefaultRoute?: boolean;
  model?: string;
  /** reasoning effort for its runs (one of the model's levels; none: the model's default) */
  effort?: string;
  /** standing instructions, added to every task's system prompt */
  instructions?: string;
  /** absolute working directory: providers that run in one, and the file tools */
  workspace?: string;
  /** RealmNest tools this agent may use (none unless listed; docs/TOOLS.md) */
  allowedToolIds?: string[];
  /** the agent's own allow / ask / deny per tool (over the user's global choice) */
  toolPermissions?: Record<string, ToolPermission>;
  /** Skills assigned to this agent, by stable id (their text stays in the Skill, docs/SKILLS.md) */
  skillIds?: string[];
  /** Knowledge bases its runs search (docs/KNOWLEDGE.md) */
  knowledgeBaseIds?: string[];
  /** how answers may use them (default grounded) */
  knowledgeMode?: KnowledgeMode;
  /** what this agent remembers and how (default: review before saving; docs/MEMORY.md) */
  memory?: AgentMemorySettings;
  /** may read public web pages (web_fetch) and search (web_search); off unless turned on (docs/WEB.md) */
  webAccess?: boolean;
  updatedAt: number;
  // future: memory
}

/** What the agent is doing, according to the runtime (never the animation). */
export const LIVE_AGENT_STATUSES = ['idle', 'starting', 'working'] as const;
export type LiveAgentStatus = (typeof LIVE_AGENT_STATUSES)[number];

/** allowed agent status changes; outcomes (done, failed, cancelled) live on the Run */
export const AGENT_TRANSITIONS: Record<LiveAgentStatus, readonly LiveAgentStatus[]> = {
  idle: ['starting'],
  starting: ['working', 'idle'],
  working: ['idle'],
};

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/** What the user asked an agent to do. May be attempted by several runs (retries later). */
export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  prompt: string;
  status: TaskStatus;
  /** files given with the task (the only files its runs see, besides their tools' and Skills') */
  attachments?: Attachment[];
  /** Skills named in the task (@ or a chip) */
  skillIds?: string[];
  /** attempts, oldest first */
  runIds: string[];
  createdAt: number;
  updatedAt: number;
  /** handed over by a colleague's run or a chat (delegate_task, docs/DELEGATION.md) */
  delegatedBy?: Delegator;
  /** a Crew run's task (docs/CREW.md): its work, a review of it, or the final assembly */
  crew?: { crewId: string; runId: string; taskId?: string; kind: 'plan' | 'work' | 'review' | 'assemble' };
  /** a workflow run's node (docs/WORKFLOWS.md) */
  workflow?: { workflowId: string; runId: string; nodeId: string };
  /** the folder its file tools use for this task (a crew's shared folder); none: the agent's own */
  workspace?: string;
  /** waiting in the agent's queue (status queued): what starts it once the agent is free (docs/RUNTIME.md "Queue") */
  pending?: QueuedTaskInput;
  /** why it never started (a queued task that could not start, or was removed) */
  error?: { code: string; message: string };
}

/** a queued task's input; files by reference only (stored, or text), so it survives a restart */
export interface QueuedTaskInput {
  prompt: string;
  attachments?: AttachmentInput[];
  skillIds?: string[];
  /** a model wrote the prompt (Telegram's concierge) */
  modelWritten?: boolean;
}

/** who handed a task over: an agent's run (agentId, taskId) or a chat (conversationId) */
export interface Delegator {
  runId: string;
  agentId?: string;
  taskId?: string;
  conversationId?: string;
}

export type RunStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  starting: ['running', 'completed', 'failed', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const isFinished = (s: RunStatus | TaskStatus) => s === 'completed' || s === 'failed' || s === 'cancelled';

/** One concrete execution attempt of a task, through one provider turn. */
export interface AgentRun {
  id: string;
  taskId: string;
  agentId: string;
  /** the kind of provider (kept for history even if the connection goes away) */
  providerId: string;
  connectionId?: string;
  model?: string;
  status: RunStatus;
  createdAt: number;
  /** the provider accepted the turn */
  startedAt?: number;
  finishedAt?: number;
  /** everything the model wrote, as streamed */
  output: string;
  /** the final answer reported by the provider */
  result?: string;
  error?: { code: string; message: string; detail?: string };
  sessionId?: string;
  usage?: TokenUsage;
  costUsd?: number;
  /** the Skills this run used, as they were (kept after an uninstall) */
  skills?: SkillRunRef[];
  /** the Knowledge this run used: bases, mode, what was retrieved and cited */
  knowledge?: KnowledgeRunRecord;
  /** the memories this run was given (ids and scores) and its searches */
  memory?: MemoryRunRecord;
  /** the web pages this run read, its searches and its [W] citations */
  web?: WebRunRecord;
  /** the run that delegated this one's task (delegate_task) */
  parentRunId?: string;
}

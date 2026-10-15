// ─────────────────────────────────────────────────────────────
// Conversations: persistent message threads, independent of any provider.
//
//   Conversation ── messages: ChatMessage[] (user / assistant / system)
//        │  agentId?   → Agent chat (the agent's instructions apply to every turn)
//        │  no agent   → Direct chat (just a provider and a model)
//        └─ providerSession? → the provider's own memory of this thread (opaque id)
//
//   ConversationRun: one provider turn (user message → assistant message).
//
// A chat turn is not an AgentTask: tasks are operational work and make the
// character work in the world; chat does not (docs/CHAT.md).
// ─────────────────────────────────────────────────────────────

import type { SkillRunRef } from './skill';
import type { TokenUsage } from '../runtime/providers/types';
import type { Attachment } from './attachment';
import type { RunStatus } from './agent';
import type { KnowledgeRunRecord, KnowledgeSelection } from './knowledge';
import type { MemoryRunRecord } from './memory';
import type { WebRunRecord } from './web';

export type MessageRole = 'user' | 'assistant' | 'system';

/** complete: final · streaming: the assistant is writing it · failed / cancelled: the turn did not finish */
export type MessageStatus = 'complete' | 'streaming' | 'failed' | 'cancelled';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: number;
  /** the run that produced (assistant) or carried (user) it */
  runId?: string;
  /** files the user added (bytes in the FileStore, by storageRef) */
  attachments?: Attachment[];
  /** Skills the user named for this message (@ or a chip), in order */
  skillIds?: string[];
  error?: { code: string; message: string; detail?: string };
}

export interface ProviderSessionInfo {
  providerId: string;
  /** opaque, as reported by the provider */
  id: string;
  /** lost: the provider no longer has it; continuing needs an explicit new session */
  state: 'active' | 'lost';
}

/** auto: from the first message · ai: generated after the first reply · user: renamed (never overwritten) */
export type TitleSource = 'auto' | 'ai' | 'user';

export interface Conversation {
  id: string;
  title: string;
  titleSource?: TitleSource;
  /** an AI title was asked for once (never repeated, whatever the outcome) */
  titleRequestedAt?: number;
  /** shown in the Pinned group; kept when old conversations are pruned */
  pinned?: boolean;
  /** RealmNest tools are offered in this chat (Chat › tools switch) */
  toolsEnabled?: boolean;
  /** a Skill chosen for this chat (its tools are offered with it, whatever the tools switch) */
  skillId?: string;
  /** Knowledge chosen for this chat (an agent chat without one uses the agent's) */
  knowledge?: KnowledgeSelection;
  /** Web access for this chat (undefined: an agent chat follows its agent, a direct chat is off) */
  web?: boolean;
  /** Agent chat when set; Direct chat otherwise */
  agentId?: string;
  /** the AI connection it talks through (fixed once the conversation has started) */
  connectionId: string;
  /** the kind of provider behind that connection (kept for history) */
  providerId: string;
  model?: string;
  /** reasoning effort for this chat's turns (one of the model's levels; none: the model's default) */
  effort?: string;
  /** working directory the provider session lives in (fixed for the conversation) */
  workspace?: string;
  providerSession?: ProviderSessionInfo;
  /** set when "Auto" picked the connection from the routing policy (fixed afterwards) */
  routedBy?: { capability: string; source: 'policy' | 'fallback'; at: number };
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ConversationRun {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  providerId: string;
  connectionId?: string;
  model?: string;
  status: RunStatus;
  /** continued the provider session (false: opened one, or the provider has none) */
  resumed: boolean;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: { code: string; message: string; detail?: string };
  usage?: TokenUsage;
  costUsd?: number;
  /** the Skills this turn used, as they were */
  skills?: SkillRunRef[];
  /** the Knowledge this turn used: bases, mode, what was retrieved and cited */
  knowledge?: KnowledgeRunRecord;
  /** the agent memories this turn was given (ids and scores) and its searches */
  memory?: MemoryRunRecord;
  /** the web pages this turn read, its searches and its [W] citations */
  web?: WebRunRecord;
}

/** A conversation title from its first user message, without a model call. */
export function conversationTitle(firstMessage: string, max = 48): string {
  const line = firstMessage.trim().split('\n')[0].trim().replace(/\s+/g, ' ');
  if (!line) return 'New conversation';
  let t = line;
  if (t.length > max) {
    const cut = t.slice(0, max + 1);
    const space = cut.lastIndexOf(' ');
    t = space > max * 0.5 ? cut.slice(0, space) : t.slice(0, max);
  }
  return t.replace(/[\s.,;:!?…-]+$/u, '') || 'New conversation';
}

// ─────────────────────────────────────────────────────────────
// Memory: small pieces of context an agent learned from working with the
// user, kept only when the user agrees.
//
//   a run completes ─▶ MemoryExtractor ─▶ 0..N MemoryProposal (pending)
//                                            │ the user: Remember / Edit / Reject
//                                            ▼
//                                     MemoryEntry (active) ─▶ MemoryIndex ─▶ later runs
//
// Not Knowledge (documents the user indexed), not chat history (the
// transcript), not a Skill (a procedure), not agent instructions (explicit
// behaviour). Memory is context: it may be stale or wrong, the current user
// message always wins, and its text never has instruction authority.
// docs/MEMORY.md.
// ─────────────────────────────────────────────────────────────

/** a small normalized set; behaviour-changing instructions are not memories */
export const MEMORY_TYPES = ['fact', 'preference', 'decision', 'constraint', 'project_context', 'workflow_preference', 'relationship', 'other'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/**
 * whose memory it is. Only `agent` is used today; the others are reserved so
 * memory never becomes one global bucket (user / project / team / organization later).
 */
export type MemoryScope =
  | { type: 'agent'; agentId: string }
  | { type: 'user'; userId: string }
  | { type: 'project'; projectId: string }
  | { type: 'team'; teamId: string }
  | { type: 'organization'; organizationId: string };

export const scopeKey = (s: MemoryScope): string => {
  switch (s.type) {
    case 'agent':
      return `agent:${s.agentId}`;
    case 'user':
      return `user:${s.userId}`;
    case 'project':
      return `project:${s.projectId}`;
    case 'team':
      return `team:${s.teamId}`;
    case 'organization':
      return `organization:${s.organizationId}`;
  }
};

export type MemoryImportance = 'low' | 'normal' | 'high';
export type MemoryConfidence = 'low' | 'medium' | 'high';

/** where a memory came from: enough to answer "why does RealmNest remember this?" */
export interface MemorySource {
  sourceType: 'chat' | 'agent_run' | 'manual' | 'imported';
  agentId?: string;
  conversationId?: string;
  messageId?: string;
  taskId?: string;
  runId?: string;
  /** the model proposed it (the user approved it) */
  proposedByModel?: boolean;
  connectionId?: string;
  providerId?: string;
  modelId?: string;
  proposalId?: string;
  /** a short quote of what the user said that led to it */
  quote?: string;
}

export const MEMORY_STATUSES = ['active', 'superseded', 'expired', 'deleted'] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

/** one edit by the user: what it was before */
export interface MemoryRevision {
  type: MemoryType;
  content: string;
  editedAt: number;
  by: 'user';
}

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  /** optional structure, for duplicate / update detection: "project reports" + "language" = "Italian" */
  subject?: string;
  key?: string;
  value?: string;
  status: MemoryStatus;
  importance: MemoryImportance;
  confidence?: MemoryConfidence;
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  /** the last run it was given to (proactively or through search_memory) */
  lastUsedAt?: number;
  expiresAt?: number;
  supersedesId?: string;
  supersededById?: string;
  tags: string[];
  /** the text before each user edit (provenance is never rewritten) */
  revisions?: MemoryRevision[];
  /** deleted: the content is gone, the record stays so old runs can say "a memory that was deleted" */
  deletedAt?: number;
  metadata?: Record<string, string>;
}

/** how a proposal relates to what the agent already remembers */
export type ProposalRelation = 'new' | 'duplicate' | 'update' | 'conflict';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'dismissed';

/** what the user decided (kept for Debug and provenance) */
export type ProposalDecision = 'remembered' | 'edited' | 'replaced' | 'kept-both' | 'kept-existing' | 'rejected' | 'duplicate' | 'automatic';

export interface MemoryProposal {
  id: string;
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  subject?: string;
  key?: string;
  value?: string;
  reason?: string;
  confidence?: MemoryConfidence;
  importance: MemoryImportance;
  tags: string[];
  relation: ProposalRelation;
  /** the active memory it duplicates, updates or contradicts */
  existingId?: string;
  source: MemorySource;
  status: ProposalStatus;
  createdAt: number;
  decidedAt?: number;
  decision?: ProposalDecision;
  /** the entry an approval created */
  entryId?: string;
}

/** an agent's memory settings (on AgentDefinition) */
export type MemoryMode = 'off' | 'review' | 'automatic';

export interface AgentMemorySettings {
  /** default review: the model may propose, the user decides */
  mode: MemoryMode;
  /** also search by meaning with the embeddings route (memory text is sent to that provider) */
  useEmbeddings?: boolean;
  /** where extraction runs: the run's own connection and model when unset */
  extraction?: { connectionId: string; model?: string };
}

export const DEFAULT_MEMORY: AgentMemorySettings = { mode: 'review' };

/** what a run remembers about Memory (ids and scores; contents stay in the entries) */
export interface MemoryRunRecord {
  agentId: string;
  mode: MemoryMode;
  /** why it was not used, when it was not (off, strict knowledge…) */
  skipped?: string;
  retrieved: { entryId: string; label: string; type: MemoryType; score: number; lexical?: number; semantic?: number; proactive: boolean }[];
  searches: { query: string; results: number; viaTool: boolean; semantic: boolean; at: number }[];
  /** the version of the agent's index when the run started */
  indexVersion: number;
  embeddingModel?: string;
}

/** one extraction attempt after a run (cost is what the provider reported) */
export interface MemoryExtractionRecord {
  runId: string;
  agentId: string;
  status: 'skipped' | 'running' | 'done' | 'failed';
  /** why skipped / failed */
  reason?: string;
  proposals: number;
  /** duplicates and filtered items that never became pending proposals */
  dropped?: number;
  connectionId?: string;
  model?: string;
  structured?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
  at: number;
}

export const MEMORY_LIMITS = {
  /** active memories per agent */
  activePerAgent: 500,
  pendingPerAgent: 100,
  contentChars: 400,
  tagsPerEntry: 8,
  /** memories injected before a run (budget) */
  injected: 6,
  injectedChars: 1_800,
  /** proposals one extraction may return */
  proposalsPerRun: 3,
  searchResults: 6,
  searchesPerRun: 6,
} as const;

export const isActive = (e: MemoryEntry, now: number) => e.status === 'active' && (!e.expiresAt || e.expiresAt > now);

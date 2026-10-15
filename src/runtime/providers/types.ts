// ─────────────────────────────────────────────────────────────
// Universal provider contract.
//
//   RealmNest runtime → AIProvider (this file) → adapter → Claude Code / Ollama / APIs
//
// Everything outside src/runtime/providers/<adapter>/ talks to models only
// through these types. A provider is a model backend, not an agent: agents,
// tools, memory and permissions belong to the future Agent Runtime.
// ─────────────────────────────────────────────────────────────

import type { ToolSchema } from '../../domain/tool';

// ── status ───────────────────────────────────────────────────

export type ProviderState =
  /** ready to run turns */
  | 'available'
  /** the backend (CLI, daemon) is not installed */
  | 'not_installed'
  /** installed, but not signed in / no credentials */
  | 'not_authenticated'
  /** credentials are present but the provider rejects them */
  | 'invalid_credentials'
  /** cannot be reached from this build or environment */
  | 'unavailable'
  /** the check itself failed unexpectedly */
  | 'error';

export interface ProviderStatus {
  state: ProviderState;
  /** one user-facing sentence, e.g. "Claude Code detected" */
  message: string;
  /** what the user can do about it, when there is something to do */
  hint?: string;
  version?: string;
  /** provider-specific facts worth showing in a debug view (never secrets) */
  details?: Record<string, string>;
  checkedAt: number;
}

// ── capabilities ─────────────────────────────────────────────

/** What a provider can do. Static metadata, read by the future model router. */
export interface ProviderCapabilities {
  /** text arrives incrementally (text.delta events) */
  streaming: boolean;
  /** the backend can use tools of its own and reports them as tool.* events */
  tools: boolean;
  /** accepts RealmNest tools (ProviderTurnRequest.toolSchemas) and asks for them with tool.requested; RealmNest runs them */
  toolCalling?: boolean;
  /**
   * runs its own agent loop and reaches RealmNest tools through the RealmNest MCP
   * bridge (ProviderTurnRequest.realmnestBridge); every call still goes through
   * RealmNest's ToolRuntime (Claude Code)
   */
  toolBridge?: boolean;
  /** image input is supported through this adapter */
  vision: boolean;
  /** PDF input is supported through this adapter */
  files?: boolean;
  /** creates embeddings (Knowledge semantic search) through this adapter */
  embeddings?: boolean;
  /** honours ProviderTurnRequest.responseSchema (an answer as JSON matching a schema) */
  structuredOutput?: boolean;
  /** the backend keeps conversations itself: turns can open and resume sessions (ProviderSessionRef) */
  sessions: boolean;
  /** inference runs on this machine: no prompt leaves it */
  local: boolean;
  /** reports token usage (usage.updated) */
  usage: boolean;
  /** reports a cost in USD */
  cost: boolean;
  /** a running turn can be stopped (cancel / abortSignal) */
  cancellation: boolean;
  /** listModels() returns the models it can use */
  modelListing: boolean;
  /** honours ProviderTurnRequest.systemPrompt */
  systemPrompt: boolean;
  /** can search the web with the backend's own search (ProviderTurnRequest.webSearch) and reports the results (search.results) */
  webSearch?: boolean;
}

/** one web search result as a backend's own search returned it (never invented by the model) */
export interface WebHit {
  url: string;
  title?: string;
  snippet?: string;
  /** as the backend gives it (e.g. "2 days ago", an ISO date) */
  published?: string;
}

/** A model as the provider describes it (only fields the provider really returns). */
export interface ModelInfo {
  /** raw id used in requests */
  id: string;
  label?: string;
  /** family / vendor part of the id, e.g. "anthropic" */
  providerLabel?: string;
  contextLength?: number;
  inputModalities?: string[];
  outputModalities?: string[];
  /** request parameters the model accepts (e.g. tools, structured_outputs, reasoning) */
  supportedParameters?: string[];
  /** USD per token as the provider states it ("-1" = variable) */
  pricing?: { prompt?: string; completion?: string };
  /**
   * present when the provider marks the model as a reasoning model. `efforts`: the levels
   * ProviderTurnRequest.effort may ask for, lowest first (none: no choice); `default`: the
   * level the backend uses when none is asked for, when the provider states it (effort.ts)
   */
  reasoning?: { mandatory?: boolean; efforts?: string[]; default?: string };
}

// ── requests ─────────────────────────────────────────────────

export interface ProviderMessage {
  /** 'tool': the result of one of the assistant's tool calls (toolCallId) */
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** images / PDFs for this message (text files are already in `content`) */
  attachments?: ProviderAttachment[];
  /** assistant: the RealmNest tools it asked for in this message */
  toolCalls?: { id: string; name: string; input: unknown }[];
  /** tool: which call this answers */
  toolCallId?: string;
}

/** a binary attachment as an adapter receives it */
export interface ProviderAttachment {
  kind: 'image' | 'pdf';
  name: string;
  mime: string;
  /** base64, no data: prefix */
  data: string;
}

/**
 * A conversation the provider keeps on its side (only when capabilities.sessions).
 * - `new`: open one; its id arrives in `session.started` / `run.completed`.
 * - `resume`: continue it; send only the new user message.
 * Without a ref a turn is one-off and nothing is kept.
 * The id is opaque to callers; how a backend resumes is the adapter's business.
 */
export type ProviderSessionRef = { mode: 'new' } | { mode: 'resume'; id: string };

export interface ProviderTurnRequest {
  /** caller-chosen id; every event of the turn carries it */
  runId: string;
  session?: ProviderSessionRef;
  model?: string;
  messages: ProviderMessage[];
  systemPrompt?: string;
  /** names of the backend's own tools it may use this turn (Claude Code); none when omitted */
  tools?: string[];
  /** RealmNest tools the model may ask for (only to adapters with capabilities.toolCalling) */
  toolSchemas?: ToolSchema[];
  /** the RealmNest MCP bridge for this turn (adapters with `toolBridge`): its MCP config and the tool names the model may call */
  realmnestBridge?: { configPath: string; tools: string[] };
  /** absolute working directory for providers that run in one */
  workspace?: string;
  /** answer as JSON matching this schema (adapters with structuredOutput; models that support it) */
  responseSchema?: { name: string; schema: Record<string, unknown> };
  /** stop the turn after this long */
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  /** let the backend use its own web search this turn (adapters with capabilities.webSearch) */
  webSearch?: { maxUses?: number };
  /** how much the model reasons first: one of the model's ModelInfo.reasoning.efforts; adapters ignore any other value (effort.ts) */
  effort?: string;
}

// ── normalized events ────────────────────────────────────────

export type ProviderErrorCode =
  | 'not_installed'
  | 'not_authenticated'
  | 'unavailable'
  | 'invalid_request'
  /** the provider no longer has the session the turn tried to resume */
  | 'session_not_found'
  /** the stored key or token was rejected */
  | 'invalid_credentials'
  /** the account has no credits / payment needed */
  | 'payment_required'
  /** the chosen model does not exist or cannot serve this request now */
  | 'model_unavailable'
  | 'rate_limited'
  | 'api_error'
  | 'max_turns'
  | 'budget_exceeded'
  | 'execution_error'
  | 'malformed_event'
  /** the model asked for too many tool calls in one run (ToolLoop) */
  | 'tool_call_limit'
  | 'incomplete_stream'
  | 'process_exit'
  | 'process_crashed'
  | 'timeout'
  | 'unknown';

export interface ProviderErrorInfo {
  code: ProviderErrorCode;
  /** understandable by a user */
  message: string;
  /** for developers: stderr tail, raw snippet… (already redacted) */
  detail?: string;
}

/** A subscription's usage windows as the provider reports them (Claude: the 5-hour session and
 *  the week). `utilization` 0..1; `resetsAt` epoch ms. */
export interface PlanLimits {
  windows: { id: string; utilization: number; resetsAt?: number }[];
  /** allowed · allowed_warning · rejected (the provider's words) */
  status?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** The provider-independent part of each event. Adapters produce these. */
export type ProviderEventBody =
  /** the backend accepted the turn (process started, request sent) */
  | { type: 'provider.started'; model?: string }
  /** the backend opened or resumed a conversation */
  | { type: 'session.started'; sessionId: string; resumed: boolean; model?: string; tools?: string[] }
  | { type: 'message.started'; messageId: string; model?: string }
  | { type: 'text.delta'; messageId: string; index: number; text: string }
  | { type: 'text.completed'; messageId: string; index: number; text: string }
  /** the model asked to run a tool (input is complete) */
  | { type: 'tool.requested'; messageId: string; toolCallId: string; name: string; input: unknown }
  /** a tool started executing (only for providers that report it) */
  | { type: 'tool.started'; toolCallId: string; name: string }
  | { type: 'tool.completed'; toolCallId: string; isError: boolean; output: string }
  /** the backend's own web search returned results (structured, from the search itself) */
  | { type: 'search.results'; query?: string; results: WebHit[] }
  /** the subscription's usage windows (plan limits), when the backend reports them */
  | { type: 'limits.updated'; limits: PlanLimits }
  /** `cumulative`: totals for the whole turn, otherwise for one model message */
  | { type: 'usage.updated'; usage: TokenUsage; cumulative: boolean; costUsd?: number }
  /** something went wrong; a terminal event follows if the turn cannot continue */
  | { type: 'provider.error'; error: ProviderErrorInfo }
  // ── terminal: exactly one per turn ──
  | {
      type: 'run.completed';
      text: string;
      sessionId?: string;
      durationMs?: number;
      turns?: number;
      stopReason?: string;
      usage?: TokenUsage;
      costUsd?: number;
    }
  | { type: 'run.failed'; error: ProviderErrorInfo }
  | { type: 'run.cancelled'; reason: string };

export interface ProviderEventMeta {
  runId: string;
  providerId: string;
  /** the AI connection the turn ran on (stamped by ProviderService) */
  connectionId?: string;
  /** order within the run, from 1 */
  seq: number;
  /** wall clock ms */
  at: number;
  /** the provider's original payload, for debugging only; never rely on it */
  raw?: unknown;
}

export type ProviderEvent = ProviderEventBody & ProviderEventMeta;
export type ProviderEventType = ProviderEventBody['type'];

export const TERMINAL_EVENTS = ['run.completed', 'run.failed', 'run.cancelled'] as const;
export const isTerminal = (e: { type: string }) => (TERMINAL_EVENTS as readonly string[]).includes(e.type);

// ── the contract ─────────────────────────────────────────────

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  getStatus(): Promise<ProviderStatus>;
  /** only when capabilities.modelListing */
  listModels?(): Promise<ModelInfo[]>;
  /**
   * Run one turn. Never throws: failures arrive as provider.error / run.failed,
   * and the stream always ends with exactly one terminal event.
   * Breaking out of the loop cancels the turn.
   */
  runTurn(request: ProviderTurnRequest): AsyncIterable<ProviderEvent>;
  /** only when capabilities.cancellation */
  cancel?(runId: string): Promise<void>;
}

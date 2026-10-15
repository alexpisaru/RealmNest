// Raw Claude Code `--output-format stream-json` messages, as far as RealmNest
// reads them (checked against Claude Code 2.1.293). Fields we do not use are
// left out; unknown message types are ignored by the parser.

export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content?: unknown; is_error?: boolean }
  | { type: 'thinking'; thinking?: string }
  | { type: string; [k: string]: unknown };

export interface ClaudeSystemInit {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model?: string;
  tools?: string[];
  cwd?: string;
  claude_code_version?: string;
}

/** Anthropic Messages streaming events, wrapped by Claude Code (--include-partial-messages) */
export type AnthropicStreamEvent =
  | { type: 'message_start'; message: { id: string; model?: string; usage?: ClaudeUsage } }
  | { type: 'content_block_start'; index: number; content_block: ClaudeContentBlock }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: string; [k: string]: unknown } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta?: { stop_reason?: string | null }; usage?: ClaudeUsage }
  | { type: 'message_stop' }
  | { type: string; [k: string]: unknown };

export interface ClaudeStreamEvent {
  type: 'stream_event';
  event: AnthropicStreamEvent;
  session_id?: string;
  parent_tool_use_id?: string | null;
}

export interface ClaudeAssistantMessage {
  type: 'assistant';
  message: { id: string; model?: string; content: ClaudeContentBlock[]; usage?: ClaudeUsage };
  parent_tool_use_id?: string | null;
  session_id?: string;
  /** set on synthetic error messages, e.g. 'authentication_failed' */
  error?: string;
  is_api_error_message?: boolean;
}

export interface ClaudeUserMessage {
  type: 'user';
  message: { role: 'user'; content: string | ClaudeContentBlock[] };
  parent_tool_use_id?: string | null;
  /** the structured result of a built-in tool (WebSearch: {query, results: [{content: [{title, url}]}, "summary"]}) */
  tool_use_result?: unknown;
}

export interface ClaudeResult {
  type: 'result';
  subtype: string;
  is_error: boolean;
  result?: string;
  session_id?: string;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  usage?: ClaudeUsage;
  stop_reason?: string | null;
  terminal_reason?: string;
  api_error_status?: number | null;
}

/** `claude auth status --json` */
export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  /** e.g. 'max', 'pro' (claude.ai sign-ins) */
  subscriptionType?: string;
}

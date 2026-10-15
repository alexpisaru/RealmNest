// ─────────────────────────────────────────────────────────────
// Tools: executable actions a model may ask RealmNest to run.
//
//   capability  something a model or RealmNest can do        (domain/capability.ts)
//   tool        one executable action with a schema       (this file)
//   skill       instructions that use tools (later; declares `requiresTools`)
//   plugin      a package adding tools / skills (later)
//   MCP / CLI   *sources* of tools — they register ToolDefinitions here
//               (MCP works: runtime/mcp, docs/MCP.md; CLI later)
//
// Model ─tool request─▶ ToolRuntime ─permission─▶ executor ─ToolResult─▶ model.
// docs/TOOLS.md has the whole flow.
// ─────────────────────────────────────────────────────────────

/** where a tool comes from; `native` and `mcp` execute in this version */
export type ToolSource = 'native' | 'mcp' | 'cli' | 'http' | 'plugin';

export type ToolRisk = 'low' | 'medium' | 'high';

export type ToolPermission = 'allow' | 'ask' | 'deny';

export type JsonType = 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';

/**
 * A JSON Schema as tools declare their input. Native tools use a small subset;
 * MCP servers send full JSON Schema (2020-12 by default), so unknown keywords
 * are kept and passed to the model, and runtime/tools/schema.ts validates the
 * keywords it knows (type unions, anyOf/oneOf/allOf, enum, const, ranges…).
 */
export interface JsonSchema {
  /** absent: any value */
  type?: JsonType | JsonType[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  enum?: unknown[];
  const?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  /** other keywords (format, default, $schema, $defs…) are kept, not checked */
  [keyword: string]: unknown;
}

export interface ToolDefinition {
  /**
   * stable, portable id (skills and policies refer to it): native `write_text_file`,
   * MCP `mcp.<server>.<tool>` (see isToolId)
   */
  id: string;
  /** what the model calls it: [A-Za-z0-9_-]{1,64} (= id for native tools, `<server>__<tool>` for MCP) */
  name: string;
  /** a human title when the source gives one */
  title?: string;
  /** for the model and for the approval prompt */
  description: string;
  source: ToolSource;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  risk: ToolRisk;
  permissions: {
    /** used when neither the agent nor the user set one (from the risk when omitted) */
    default?: ToolPermission;
    /** the tool can never be more permissive than this (e.g. 'ask': always asks) */
    ceiling?: 'ask' | 'deny';
  };
  /** needs a workspace folder (filesystem tools) */
  needsWorkspace?: boolean;
  cancellable: boolean;
  timeoutMs: number;
  version?: string;
  metadata?: Record<string, string>;
}

/** what a provider sees of a tool: name, description and the input schema, nothing else */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export const TOOL_CALL_STATUSES = ['requested', 'awaiting_approval', 'approved', 'running', 'completed', 'failed', 'cancelled', 'denied'] as const;
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export type ToolErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'TOOL_NOT_ALLOWED'
  | 'APPROVAL_DENIED'
  | 'INVALID_TOOL_INPUT'
  | 'TOOL_TIMEOUT'
  | 'TOOL_CANCELLED'
  | 'WORKSPACE_REQUIRED'
  | 'PATH_OUTSIDE_WORKSPACE'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'NOT_A_TEXT_FILE'
  | 'TOOL_UNAVAILABLE'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_CALL_LIMIT_REACHED'
  /** an MCP server answered with a protocol error (unknown tool, bad params, server error) */
  | 'MCP_ERROR';

export interface ToolError {
  code: ToolErrorCode;
  message: string;
}

/** a file the tool produced or changed (the future Artifact system starts here) */
export interface ToolArtifact {
  kind: 'file';
  /** workspace-relative path */
  path: string;
  action: 'created' | 'updated';
  bytes?: number;
}

/**
 * One piece of what a tool returned, kept as structure for future Artifacts,
 * attachments and images. Binary `data` (base64) lives in memory only: it is
 * dropped when calls are stored, and the model gets a short description.
 */
export type ToolContentPart =
  | { type: 'text'; text: string }
  | { type: 'image' | 'audio'; mimeType: string; bytes: number; data?: string }
  | { type: 'resource_link'; uri: string; name?: string; mimeType?: string; description?: string }
  | { type: 'resource'; uri: string; mimeType?: string; text?: string; bytes?: number; data?: string };

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  /** short text for the model and the UI */
  content?: string;
  /** machine-readable result (sent to the model as JSON) */
  structuredData?: unknown;
  artifacts?: ToolArtifact[];
  /** everything the tool returned, by kind (MCP results) */
  parts?: ToolContentPart[];
  error?: ToolError;
}

/** who asked: an agent's run or a chat turn */
export interface ToolCallContext {
  runId: string;
  agentId?: string;
  conversationId?: string;
  /** an agent task's id (runs of a task) */
  taskId?: string;
}

export interface ToolCall extends ToolCallContext {
  id: string;
  toolId: string;
  /** the model's own id for the call (provider-specific), kept to answer it */
  providerCallId?: string;
  input: unknown;
  status: ToolCallStatus;
  /** the permission that applied */
  permission?: ToolPermission;
  requestedAt: number;
  /** why this call asks although its tool is allowed (shown on the approval prompt) */
  approvalReason?: string;
  approvedAt?: number;
  startedAt?: number;
  completedAt?: number;
  output?: Omit<ToolResult, 'toolCallId'>;
  error?: ToolError;
}

const ID = /^[a-z][a-z0-9_]{1,63}$/;
/** mcp.<server key>.<the server's own tool name> */
const MCP_ID = /^mcp\.[a-z][a-z0-9_]{0,31}\.[A-Za-z0-9_.-]{1,128}$/;
export const isToolId = (v: string) => ID.test(v) || MCP_ID.test(v);
/** what providers accept as a function name (OpenAI-style) */
export const isToolName = (v: string) => /^[A-Za-z0-9_-]{1,64}$/.test(v);

/** risk → the permission a tool gets when nobody chose one */
export function riskDefault(risk: ToolRisk): ToolPermission {
  return risk === 'low' ? 'allow' : 'ask';
}

export function toolSchema(t: ToolDefinition): ToolSchema {
  // `$schema` is for validators; some providers refuse it in function parameters
  const { $schema: _dialect, ...parameters } = t.inputSchema;
  return { name: t.name, description: t.description, parameters };
}

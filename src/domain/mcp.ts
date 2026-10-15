// ─────────────────────────────────────────────────────────────
// MCP servers: a *source* of tools, nothing more.
//
//   MCP server ─discover─▶ ToolDefinitions (source 'mcp') ─▶ ToolRegistry
//                                                              │
//              the same ToolRuntime, permissions, approval, ◀──┘
//              history, limits and cancellation as native tools
//
// A server is configured by the user (executable + argv, never a shell
// string), started on request (or at startup when the user chose so), and
// its tools get ids `mcp.<key>.<tool>`. docs/MCP.md has the whole flow.
// ─────────────────────────────────────────────────────────────

/** stdio: a program on this computer; http: a server online (Streamable HTTP) */
export type McpTransportKind = 'stdio' | 'http';

export type McpStartup = 'manual' | 'auto';

export interface McpServerConfig {
  id: string;
  /** namespace in tool ids (`mcp.<key>.<tool>`): [a-z][a-z0-9_]{0,31}, unique, never changes */
  key: string;
  name: string;
  transport: McpTransportKind;
  /** stdio: an executable (absolute path, or a bare name the native host finds on PATH); http: '' */
  command: string;
  /** http: the server's address (https; http only on this computer) */
  url?: string;
  /** http: plain headers sent with every request */
  headers?: Record<string, string>;
  /** http: headers whose values live in the OS credential store (`mcp.<id>.<mcpHeaderVar(header)>`) */
  secretHeaders?: string[];
  /** http: signed in with OAuth (tokens kept by the native host) */
  oauth?: boolean;
  args: string[];
  workingDirectory?: string;
  /** plain environment variables (never secrets) */
  env: Record<string, string>;
  /** environment variables whose values live in the OS credential store (`mcp.<id>.<VAR>`) */
  secretEnv: string[];
  enabled: boolean;
  startup: McpStartup;
  /** tools of this server the user turned on (others are listed, never offered) */
  enabledTools: string[];
  /** per-call timeout for this server's tools */
  toolTimeoutMs: number;
  /** who added it: the user, or shipped with RealmNest (future) */
  origin: 'user' | 'bundled';
  /** where it comes from, for a future hub: publisher, homepage */
  source?: { publisher?: string; url?: string };
  createdAt: number;
  updatedAt: number;
  /** last successful connection (display only) */
  lastConnectedAt?: number;
}

/** what the server is really doing; never inferred from the configuration alone */
export type McpServerStatus = 'disconnected' | 'starting' | 'connected' | 'unavailable' | 'failed' | 'auth_required' | 'stopped';

/** modern: per-request `_meta` (2026-07-28+); legacy: `initialize` handshake (2025-11-25 and earlier) */
export type McpEra = 'modern' | 'legacy';

export interface McpServerInfo {
  name?: string;
  version?: string;
}

/** a discovered tool, as the server described it (before it becomes a ToolDefinition) */
export interface McpToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** hints from the server: untrusted (MCP spec), used for display and the default risk only */
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean; title?: string };
}

/** a tool the server offers that RealmNest cannot use, with the reason */
export interface McpSkippedTool {
  name: string;
  reason: string;
}

/** the live state of one server (memory only) */
export interface McpServerState {
  status: McpServerStatus;
  era?: McpEra;
  protocolVersion?: string;
  serverInfo?: McpServerInfo;
  /** the server's advice to models (shown in Manage; not sent to models yet) */
  instructions?: string;
  tools: McpToolInfo[];
  skipped: McpSkippedTool[];
  /** what went wrong last (shown in the UI) */
  error?: string;
  /** the native host's resolved executable */
  executable?: string;
  pid?: number;
  connectedAt?: number;
}

/** one protocol message, for Debug › MCP (method and size only, never the payload) */
export interface McpTraffic {
  at: number;
  dir: 'out' | 'in';
  /** method, or `result #id` / `error #id` */
  what: string;
  bytes: number;
}

export const MCP_KEY = /^[a-z][a-z0-9_]{0,31}$/;
export const MCP_HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;
/** headers RealmNest sets itself (or that would break the transport) */
export const MCP_RESERVED_HEADERS = ['host', 'content-length', 'content-type', 'accept', 'connection', 'transfer-encoding', 'mcp-session-id', 'mcp-protocol-version', 'cookie'];
/** the credential-store variable of a secret header: Authorization → HDR_AUTHORIZATION */
export const mcpHeaderVar = (header: string) => `HDR_${header.toUpperCase().replace(/-/g, '_')}`;
/** an online server's address: https, or http on this computer */
export function mcpUrlProblem(raw: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return 'The address is not valid (e.g. https://example.com/mcp).';
  }
  if (u.username || u.password) return 'Put credentials in a header, not in the address.';
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return undefined;
  return u.protocol === 'http:' ? 'Online servers must use https (http only for a server on this computer).' : 'Only https addresses are allowed.';
}
export const MCP_ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
export const DEFAULT_MCP_TOOL_TIMEOUT_MS = 120_000;

/** the credential-store name of a server's secret variable */
export const mcpSecretRef = (serverId: string, variable: string) => `mcp.${serverId}.${variable}`;

/** a key from a name: "PhotoCraft MCP" → "photocraft_mcp" */
export function mcpKeyFrom(name: string, taken: string[]): string {
  let base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^[^a-z]+|_+$/g, '')
      .slice(0, 28) || 'server';
  if (!/^[a-z]/.test(base)) base = `s_${base}`.slice(0, 28);
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
}

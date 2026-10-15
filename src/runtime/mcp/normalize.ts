// MCP → RealmNest shapes. A discovered tool becomes an ordinary ToolDefinition
// (source 'mcp'); a tools/call result becomes an ordinary ToolResult. Nothing
// MCP-specific leaks past this file except `metadata` (server and tool names).

import type { McpServerConfig, McpServerInfo, McpSkippedTool, McpToolInfo } from '../../domain/mcp';
import type { JsonSchema, ToolContentPart, ToolDefinition, ToolResult, ToolRisk } from '../../domain/tool';
import { checkSchema } from '../tools/schema';
import type { McpCallResult } from './client';

/** what providers accept per tool schema (the OpenRouter host refuses larger ones) */
export const MAX_MCP_SCHEMA_BYTES = 16 * 1024;
const MAX_DESCRIPTION = 2_000;
/** text the model gets from one call */
export const MAX_MODEL_TEXT = 64 * 1024;
/** binary content kept in memory per part (images for a future gallery) */
const MAX_INLINE_DATA = 8 * 1024 * 1024;

const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

/** the stable RealmNest id of an MCP tool */
export const mcpToolId = (serverKey: string, toolName: string) => `mcp.${serverKey}.${toolName}`;

/** FNV-1a, for short stable suffixes */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).slice(0, 5);
}

/** what the model calls it: `<key>__<tool>`, provider-safe, ≤ 64, unique among `taken` */
export function mcpModelName(serverKey: string, toolName: string, taken: Set<string>): string {
  const safe = toolName.replace(/[^A-Za-z0-9_-]/g, '_');
  const plain = `${serverKey}__${safe}`;
  if (plain.length <= 64 && safe === toolName && !taken.has(plain)) return plain;
  // too long, changed by the replacement, or taken: a deterministic suffix keeps it stable across reconnects
  const suffix = `_${hash(toolName)}`;
  return plain.slice(0, 64 - suffix.length) + suffix;
}

/** risk from the server's hints, which are untrusted: never low (low means allowed without asking) */
export function mcpRisk(t: McpToolInfo): ToolRisk {
  return t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint !== true ? 'medium' : 'high';
}

/**
 * Discovered tools → ToolDefinitions for one server. Tools RealmNest cannot
 * offer (bad name, bad or oversized schema) are skipped with a reason.
 * `takenNames` are model names already used by other sources.
 */
export function normalizeTools(server: Pick<McpServerConfig, 'id' | 'key' | 'name' | 'toolTimeoutMs'>, info: McpServerInfo | undefined, tools: McpToolInfo[], takenNames: Set<string>): { defs: ToolDefinition[]; skipped: McpSkippedTool[] } {
  const defs: ToolDefinition[] = [];
  const skipped: McpSkippedTool[] = [];
  const seen = new Set<string>();
  const names = new Set(takenNames);
  for (const t of tools) {
    // a cached or reported entry without a name is skipped, never thrown on (I-22)
    if (!t || typeof t !== 'object' || typeof t.name !== 'string') {
      skipped.push({ name: '(no name)', reason: 'the server listed a tool without a name' });
      continue;
    }
    if (!TOOL_NAME.test(t.name)) {
      skipped.push({ name: t.name.slice(0, 80), reason: 'the name has characters MCP does not allow' });
      continue;
    }
    if (seen.has(t.name)) {
      skipped.push({ name: t.name, reason: 'the server lists this name twice' });
      continue;
    }
    seen.add(t.name);
    const schema = t.inputSchema as JsonSchema;
    const problem = checkSchema(schema);
    if (problem) {
      skipped.push({ name: t.name, reason: `input schema: ${problem}` });
      continue;
    }
    const size = JSON.stringify(schema).length;
    if (size > MAX_MCP_SCHEMA_BYTES) {
      skipped.push({ name: t.name, reason: `input schema is ${Math.round(size / 1024)} KB; models accept at most ${MAX_MCP_SCHEMA_BYTES / 1024} KB` });
      continue;
    }
    const name = mcpModelName(server.key, t.name, names);
    names.add(name);
    const title = typeof t.title === 'string' ? t.title : typeof t.annotations?.title === 'string' ? t.annotations.title : undefined;
    const description = ((typeof t.description === 'string' && t.description.trim()) || title || t.name).slice(0, MAX_DESCRIPTION);
    defs.push({
      id: mcpToolId(server.key, t.name),
      name,
      ...(title && { title: title.slice(0, 120) }),
      description,
      source: 'mcp',
      inputSchema: schema,
      risk: mcpRisk(t),
      // every MCP tool asks until the user decides otherwise (risk medium/high → ask)
      permissions: {},
      cancellable: true,
      timeoutMs: server.toolTimeoutMs,
      ...(info?.version && { version: info.version }),
      metadata: {
        mcpServerId: server.id,
        mcpServerKey: server.key,
        mcpServerName: server.name,
        mcpToolName: t.name,
        ...(t.annotations?.readOnlyHint !== undefined && { readOnlyHint: String(t.annotations.readOnlyHint) }),
        ...(t.annotations?.destructiveHint !== undefined && { destructiveHint: String(t.annotations.destructiveHint) }),
      },
    });
  }
  return { defs, skipped };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const b64bytes = (s: string) => Math.floor((s.length * 3) / 4);
const kb = (n: number) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);

/** one MCP content item → a ToolContentPart (unknown kinds are kept as text notes) */
function part(c: unknown): ToolContentPart | undefined {
  if (!isObject(c)) return undefined;
  switch (c.type) {
    case 'text':
      return { type: 'text', text: typeof c.text === 'string' ? c.text : '' };
    case 'image':
    case 'audio': {
      const data = typeof c.data === 'string' ? c.data : '';
      const bytes = b64bytes(data);
      return { type: c.type, mimeType: typeof c.mimeType === 'string' ? c.mimeType : 'application/octet-stream', bytes, ...(data && bytes <= MAX_INLINE_DATA && { data }) };
    }
    case 'resource_link':
      return {
        type: 'resource_link',
        uri: String(c.uri ?? ''),
        ...(typeof c.name === 'string' && { name: c.name }),
        ...(typeof c.mimeType === 'string' && { mimeType: c.mimeType }),
        ...(typeof c.description === 'string' && { description: c.description.slice(0, 500) }),
      };
    case 'resource': {
      const r = isObject(c.resource) ? c.resource : {};
      const blob = typeof r.blob === 'string' ? r.blob : undefined;
      return {
        type: 'resource',
        uri: String(r.uri ?? ''),
        ...(typeof r.mimeType === 'string' && { mimeType: r.mimeType }),
        ...(typeof r.text === 'string' && { text: r.text }),
        ...(blob && { bytes: b64bytes(blob), ...(b64bytes(blob) <= MAX_INLINE_DATA && { data: blob }) }),
      };
    }
    default:
      return { type: 'text', text: `[${String(c.type ?? 'unknown')} content]` };
  }
}

/** how a part reads for the model (binary content is described, never sent as base64) */
function forModel(p: ToolContentPart): string {
  switch (p.type) {
    case 'text':
      return p.text;
    case 'image':
    case 'audio':
      return `[${p.type} ${p.mimeType}, ${kb(p.bytes)}]`;
    case 'resource_link':
      return `[resource ${p.name ?? ''} ${p.uri}]`.replace(/\s+/g, ' ');
    case 'resource':
      return p.text !== undefined ? `[resource ${p.uri}]\n${p.text}` : `[resource ${p.uri}${p.bytes ? `, ${kb(p.bytes)}` : ''}]`;
  }
}

/** tools/call → ToolResult (without the call id) */
export function normalizeResult(r: McpCallResult): Omit<ToolResult, 'toolCallId'> {
  const parts = (r.content ?? []).map(part).filter((p): p is ToolContentPart => !!p);
  let text = parts.map(forModel).filter(Boolean).join('\n');
  if (!text && r.structuredContent !== undefined) text = JSON.stringify(r.structuredContent);
  if (text.length > MAX_MODEL_TEXT) text = `${text.slice(0, MAX_MODEL_TEXT)}\n… [cut: the result had ${kb(text.length)}]`;
  if (r.isError) {
    return {
      success: false,
      content: text,
      ...(parts.length && { parts }),
      error: { code: 'TOOL_EXECUTION_FAILED', message: (text || 'The tool reported an error.').slice(0, 1_000) },
    };
  }
  return {
    success: true,
    content: text || '(no output)',
    ...(r.structuredContent !== undefined && { structuredData: r.structuredContent }),
    ...(parts.length && { parts }),
  };
}

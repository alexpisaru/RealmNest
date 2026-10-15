// ─────────────────────────────────────────────────────────────
// The RealmNest MCP bridge: RealmNest *is* an MCP server, for Claude Code.
//
//   claude ─tools/call─▶ relay ─▶ Rust BridgeHost ─▶ McpBridge session
//                                                       │ ToolRuntime.execute(scope)
//                                                       │   known? allowed for this run? valid?
//                                                       │   permission → approval prompt
//                                                       ▼   executor (native / MCP)
//   claude ◀─CallToolResult──────────────────────────── result
//
// One session per Claude run, exposing ONLY the tools that run may use.
// Claude is started with `--allowedTools mcp__realmnest__…`, so it does not ask
// on its own: RealmNest's permission and approval are the only ones (no double
// approval), and Claude's built-in tools stay off (`--tools ""`).
// Claude Code 2.1.295 speaks MCP 2026-07-28 and requires `ttlMs` on tools/list.
// ─────────────────────────────────────────────────────────────

import { Channel, invoke } from '@tauri-apps/api/core';
import type { ToolDefinition, ToolResult } from '../../domain/tool';
import { DEFAULT_TOOL_LIMITS, type ToolLoopLimits } from '../tools/loop';
import type { ToolRegistry } from '../tools/registry';
import type { ToolRuntime, ToolScope } from '../tools/runtime';
import { LEGACY_VERSIONS, MODERN_VERSIONS } from './client';

/** what Claude calls a bridged tool: `mcp__<server>__<tool>` */
export const BRIDGE_PREFIX = 'mcp__realmnest__';
const META = 'io.modelcontextprotocol';

export type BridgeEvent = { t: 'connected' } | { t: 'message'; message: unknown } | { t: 'closed' };

export interface BridgeTransport {
  readonly available: boolean;
  open(sessionId: string, onEvent: (e: BridgeEvent) => void): Promise<{ configPath: string }>;
  send(sessionId: string, message: object): Promise<void>;
  close(sessionId: string): Promise<void>;
}

export class TauriBridgeTransport implements BridgeTransport {
  readonly available = true;
  async open(sessionId: string, onEvent: (e: BridgeEvent) => void) {
    const channel = new Channel<BridgeEvent>();
    channel.onmessage = onEvent;
    return invoke<{ configPath: string }>('mcp_bridge_open', { sessionId, channel });
  }
  async send(sessionId: string, message: object) {
    await invoke('mcp_bridge_send', { sessionId, message });
  }
  async close(sessionId: string) {
    await invoke('mcp_bridge_close', { sessionId });
  }
}

export class UnavailableBridgeTransport implements BridgeTransport {
  readonly available = false;
  async open(): Promise<{ configPath: string }> {
    throw new Error('The RealmNest MCP bridge runs only in the desktop app.');
  }
  async send() {}
  async close() {}
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).slice(0, 5);
}

/** the name Claude sees for a tool (its full `mcp__realmnest__…` name stays ≤ 64) */
export function bridgeAlias(t: ToolDefinition): string {
  const room = 64 - BRIDGE_PREFIX.length;
  return t.name.length <= room ? t.name : `${t.name.slice(0, room - 6)}_${hash(t.id)}`;
}

/**
 * a ToolResult as MCP content (images go along: Claude can look at them).
 * The whole answer is in `content`. `structuredContent` goes along only for
 * tools that declare an output schema: Claude Code shows structured content
 * instead of the text when both are present, and RealmNest's structured data
 * (e.g. read_text_file's {path, bytes}) is a summary, not the result.
 */
export function toCallToolResult(r: ToolResult, withStructured = false): Record<string, unknown> {
  const content: Record<string, unknown>[] = [];
  for (const p of r.parts ?? []) {
    if (p.type === 'text') content.push({ type: 'text', text: p.text });
    else if (p.type === 'image' && p.data) content.push({ type: 'image', data: p.data, mimeType: p.mimeType });
  }
  if (!content.some((c) => c.type === 'text')) {
    const text = r.success ? (r.content ?? '(no output)') : `RealmNest: ${r.error?.message ?? 'the tool failed'} (${r.error?.code ?? 'TOOL_EXECUTION_FAILED'})`;
    content.unshift({ type: 'text', text });
  }
  return {
    content,
    isError: !r.success,
    ...(withStructured && r.success && isObject(r.structuredData) && { structuredContent: r.structuredData }),
  };
}

export interface BridgeSession {
  id: string;
  configPath: string;
  /** names for `--allowedTools` */
  toolNames: string[];
  close(): Promise<void>;
}

let counter = 0;

export class McpBridge {
  constructor(
    private transport: BridgeTransport,
    private runtime: ToolRuntime,
    private registry: ToolRegistry,
    private info: { name: string; version: string } = { name: 'realmnest', version: '0.6.0' },
    /** the same tool-call limits as the ToolLoop (docs/HARDENING.md R-5) */
    private limits: ToolLoopLimits = DEFAULT_TOOL_LIMITS,
  ) {}

  get available() {
    return this.transport.available;
  }

  /** Open a session for one run: Claude will see exactly `scope.allowedToolIds`. `onLimit`: the run
   *  went over a tool-call limit (every later call is refused; the caller stops the run). */
  async open(scope: ToolScope, onLimit?: (message: string) => void): Promise<BridgeSession> {
    const id = `br-${scope.runId}-${(++counter).toString(36)}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
    const aliases = new Map<string, string>();
    for (const toolId of scope.allowedToolIds) {
      const def = this.registry.get(toolId);
      if (def) aliases.set(bridgeAlias(def), toolId);
    }
    const inflight = new Map<string | number, AbortController>();
    let closed = false;
    // the ToolLoop's limits, per session: total calls, the same call again, failures in a row
    let calls = 0;
    let failuresInRow = 0;
    const seen = new Map<string, number>();
    let limited: string | undefined;
    const overLimit = (message: string) => {
      if (!limited) {
        limited = message;
        onLimit?.(message);
      }
    };

    const reply = (rid: unknown, body: { result: Record<string, unknown> } | { error: { code: number; message: string } }) => {
      if (closed || (typeof rid !== 'string' && typeof rid !== 'number')) return;
      void this.transport.send(id, { jsonrpc: '2.0', id: rid, ...body }).catch(() => undefined);
    };
    const complete = (modern: boolean, r: Record<string, unknown>) => ({ ...(modern && { resultType: 'complete' }), ...r, _meta: { [`${META}/serverInfo`]: this.info } });

    const tools = () =>
      [...aliases.entries()]
        .map(([alias, toolId]) => {
          const def = this.registry.get(toolId);
          if (!def) return undefined;
          const { $schema: _d, ...inputSchema } = def.inputSchema;
          return { name: alias, ...(def.title && { title: def.title }), description: def.description, inputSchema };
        })
        .filter(Boolean);

    const handle = async (m: unknown) => {
      if (!isObject(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return;
      const params = isObject(m.params) ? m.params : {};
      const modern = isObject(params._meta) && typeof params._meta[`${META}/protocolVersion`] === 'string';
      const rid = m.id;
      switch (m.method) {
        case 'server/discover':
          return reply(rid, {
            result: complete(true, {
              supportedVersions: [...MODERN_VERSIONS, ...LEGACY_VERSIONS],
              capabilities: { tools: {} },
              instructions: 'RealmNest tools. RealmNest checks every call and may ask the user to approve it first.',
            }),
          });
        case 'initialize': {
          const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
          return reply(rid, { result: { protocolVersion: LEGACY_VERSIONS.includes(asked) ? asked : LEGACY_VERSIONS[0], capabilities: { tools: {} }, serverInfo: this.info } });
        }
        case 'ping':
          return reply(rid, { result: complete(modern, {}) });
        case 'tools/list':
          // ttlMs: 0 — the list belongs to this run and may change with the next one
          return reply(rid, { result: complete(modern, { tools: tools(), ttlMs: 0, cacheScope: 'private' }) });
        case 'tools/call': {
          const alias = typeof params.name === 'string' ? params.name : '';
          const toolId = aliases.get(alias);
          const def = toolId ? this.registry.get(toolId) : undefined;
          if (!def) return reply(rid, { error: { code: -32602, message: `Unknown tool: ${alias.slice(0, 80)}` } });
          const key = `${def.name}:${JSON.stringify(params.arguments ?? {})}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
          if (!limited && (calls >= this.limits.maxCalls || (seen.get(key) ?? 0) > this.limits.maxSameCall))
            overLimit(`The model asked for ${calls >= this.limits.maxCalls ? `more than ${this.limits.maxCalls} tool calls` : `the same ${def.name} call again`}; the run was stopped (TOOL_CALL_LIMIT_REACHED).`);
          if (limited) return reply(rid, { result: complete(modern, toCallToolResult({ toolCallId: '', success: false, error: { code: 'TOOL_CALL_LIMIT_REACHED', message: limited } })) });
          calls++;
          const ac = new AbortController();
          if (typeof rid === 'string' || typeof rid === 'number') inflight.set(rid, ac);
          try {
            // the one place tools run: same checks, approval and history as every other model
            const { result } = await this.runtime.execute({ providerCallId: `bridge-${String(rid)}`, name: def.name, input: params.arguments ?? {} }, scope, ac.signal);
            if (!ac.signal.aborted) reply(rid, { result: complete(modern, toCallToolResult(result, !!def.outputSchema)) });
            failuresInRow = result.success ? 0 : failuresInRow + 1;
            if (failuresInRow >= this.limits.maxFailuresInRow) overLimit(`${failuresInRow} tool calls in a row failed or were refused; the run was stopped (TOOL_CALL_LIMIT_REACHED).`);

          } finally {
            if (typeof rid === 'string' || typeof rid === 'number') inflight.delete(rid);
          }
          return;
        }
        case 'notifications/cancelled': {
          const target = params.requestId;
          if (typeof target === 'string' || typeof target === 'number') inflight.get(target)?.abort();
          return;
        }
        default:
          if (rid !== undefined && rid !== null) reply(rid, { error: { code: -32601, message: `RealmNest does not support ${m.method.slice(0, 60)}.` } });
      }
    };

    const stop = () => {
      closed = true;
      for (const ac of inflight.values()) ac.abort();
      inflight.clear();
    };
    const { configPath } = await this.transport.open(id, (e) => {
      if (e.t === 'message') void handle(e.message);
      else if (e.t === 'closed') stop();
    });
    return {
      id,
      configPath,
      toolNames: [...aliases.keys()].map((a) => `${BRIDGE_PREFIX}${a}`),
      close: async () => {
        stop();
        await this.transport.close(id).catch(() => undefined);
      },
    };
  }
}

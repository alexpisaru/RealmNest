// ─────────────────────────────────────────────────────────────
// McpClient: the MCP protocol for one running server (JSON-RPC 2.0).
//
// Dual-era, as the 2026-07-28 spec asks of stdio clients:
//   probe `server/discover` with the modern version in `_meta`
//     ├─ DiscoverResult              → modern: every request carries _meta
//     ├─ UnsupportedProtocolVersion  → modern, pick a mutual version (or fail)
//     └─ any other error / silence   → legacy: `initialize` + `notifications/initialized`
//
// Then tools/list (paginated, capped) and tools/call. Every request has a
// timeout; cancelling sends notifications/cancelled and late answers are
// dropped. The client never decides whether a tool may run: ToolRuntime does.
// ─────────────────────────────────────────────────────────────

import type { McpEra, McpServerInfo, McpToolInfo, McpTraffic } from '../../domain/mcp';
import type { McpHostEvent, McpLaunch, McpTransportHost } from './transport';

/** modern versions this client speaks, preferred first */
export const MODERN_VERSIONS = ['2026-07-28'];
/** legacy (initialize-based) versions it accepts, preferred first */
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export const MCP_LIMITS = {
  discoverTimeoutMs: 5_000,
  requestTimeoutMs: 30_000,
  /** tools/list pages and tools in total */
  maxPages: 20,
  maxTools: 1_000,
  /** server messages kept for Debug */
  traffic: 60,
  stderr: 80,
};

const UNSUPPORTED_VERSION = -32022;
const META = 'io.modelcontextprotocol';

export class McpError extends Error {
  constructor(
    message: string,
    /** JSON-RPC error code, when the server sent one */
    readonly code?: number,
    readonly kind: 'protocol' | 'timeout' | 'cancelled' | 'closed' | 'remote' = 'remote',
  ) {
    super(message);
  }
}

interface Pending {
  method: string;
  resolve: (v: Record<string, unknown>) => void;
  reject: (e: McpError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface McpHandshake {
  era: McpEra;
  protocolVersion: string;
  serverInfo?: McpServerInfo;
  instructions?: string;
  capabilities: Record<string, unknown>;
}

/** what tools/call returned, before normalization */
export interface McpCallResult {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpClientOptions {
  clientInfo: { name: string; version: string };
  now?: () => number;
  requestTimeoutMs?: number;
  discoverTimeoutMs?: number;
  /** the server said its tool list changed */
  onToolsChanged?: () => void;
  /** the process ended (after connect resolved or not) */
  onExit?: (e: Extract<McpHostEvent, { t: 'exit' }>) => void;
  onTraffic?: (t: McpTraffic) => void;
  onStderr?: (line: string) => void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class McpClient {
  private pending = new Map<number | string, Pending>();
  private nextId = 1;
  private era: McpEra | undefined;
  private version: string | undefined;
  private closed = false;
  private started: { pid: number; executable: string } | undefined;
  private startWaiters: { resolve: () => void; reject: (e: McpError) => void } | undefined;
  exit: Extract<McpHostEvent, { t: 'exit' }> | undefined;

  constructor(
    readonly serverId: string,
    private host: McpTransportHost,
    private opts: McpClientOptions,
  ) {}

  get process() {
    return this.started;
  }
  get protocolVersion() {
    return this.version;
  }
  get isOpen() {
    return !this.closed && !this.exit;
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  // ── lifecycle ────────────────────────────────────────────
  /** Start the process and agree on a protocol. Rejects with a readable reason. */
  async connect(launch: McpLaunch): Promise<McpHandshake> {
    const started = new Promise<void>((resolve, reject) => (this.startWaiters = { resolve, reject }));
    await this.host.start(launch, (e) => this.onHostEvent(e));
    await started;
    return this.handshake();
  }

  private async handshake(): Promise<McpHandshake> {
    // 1. the modern probe
    try {
      const r = await this.request('server/discover', {}, { timeoutMs: this.opts.discoverTimeoutMs ?? MCP_LIMITS.discoverTimeoutMs, meta: MODERN_VERSIONS[0], probe: true });
      const supported = Array.isArray(r.supportedVersions) ? r.supportedVersions.filter((v): v is string => typeof v === 'string') : [];
      const mutual = MODERN_VERSIONS.find((v) => supported.includes(v));
      if (mutual) {
        this.era = 'modern';
        this.version = mutual;
        const meta = isObject(r._meta) ? r._meta : {};
        return {
          era: 'modern',
          protocolVersion: mutual,
          serverInfo: info(meta[`${META}/serverInfo`]),
          instructions: typeof r.instructions === 'string' ? r.instructions.slice(0, 4_000) : undefined,
          capabilities: isObject(r.capabilities) ? r.capabilities : {},
        };
      }
      // a modern server without a modern version in common: it may still speak a legacy one
      if (LEGACY_VERSIONS.some((v) => supported.includes(v))) return this.legacy();
      throw new McpError(`The server speaks MCP ${supported.join(', ') || '(no versions)'}; RealmNest speaks ${[...MODERN_VERSIONS, ...LEGACY_VERSIONS].join(', ')}.`, undefined, 'protocol');
    } catch (err) {
      const e = err as McpError;
      if (e.kind === 'closed') throw e;
      if (e.code === UNSUPPORTED_VERSION) {
        // a recognized modern error: never fall back to initialize (spec)
        throw new McpError(`The server does not support MCP ${MODERN_VERSIONS.join(', ')}.`, e.code, 'protocol');
      }
      if (e.kind === 'protocol') throw e;
      // any other error, or no answer: a legacy server
      return this.legacy();
    }
  }

  private async legacy(): Promise<McpHandshake> {
    const r = await this.request('initialize', { protocolVersion: LEGACY_VERSIONS[0], capabilities: {}, clientInfo: this.opts.clientInfo });
    const version = typeof r.protocolVersion === 'string' ? r.protocolVersion : '';
    if (!LEGACY_VERSIONS.includes(version)) throw new McpError(`The server answered with MCP ${version || '(no version)'}, which RealmNest does not speak.`, undefined, 'protocol');
    this.era = 'legacy';
    this.version = version;
    await this.notify('notifications/initialized');
    return {
      era: 'legacy',
      protocolVersion: version,
      serverInfo: info(r.serverInfo),
      instructions: typeof r.instructions === 'string' ? r.instructions.slice(0, 4_000) : undefined,
      capabilities: isObject(r.capabilities) ? r.capabilities : {},
    };
  }

  /** stop the server (close its input, then kill); pending calls fail */
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.failAll(new McpError('The MCP server was stopped.', undefined, 'closed'));
    await this.host.stop(this.serverId).catch(() => undefined);
  }

  // ── tools ────────────────────────────────────────────────
  async listTools(): Promise<McpToolInfo[]> {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MCP_LIMITS.maxPages; page++) {
      const r = await this.request('tools/list', cursor ? { cursor } : {});
      const list = Array.isArray(r.tools) ? r.tools : [];
      for (const t of list) {
        if (!isObject(t) || typeof t.name !== 'string') continue;
        tools.push({
          name: t.name,
          ...(typeof t.title === 'string' && { title: t.title }),
          ...(typeof t.description === 'string' && { description: t.description }),
          inputSchema: isObject(t.inputSchema) ? t.inputSchema : {},
          ...(isObject(t.outputSchema) && { outputSchema: t.outputSchema }),
          ...(isObject(t.annotations) && { annotations: t.annotations as McpToolInfo['annotations'] }),
        });
        if (tools.length >= MCP_LIMITS.maxTools) return tools;
      }
      cursor = typeof r.nextCursor === 'string' && r.nextCursor ? r.nextCursor : undefined;
      if (!cursor) break;
    }
    return tools;
  }

  /** tools/call; `signal` aborts it (notifications/cancelled is sent) */
  async callTool(name: string, args: Record<string, unknown>, signal: AbortSignal, timeoutMs: number): Promise<McpCallResult> {
    const r = await this.request('tools/call', { name, arguments: args }, { timeoutMs, signal });
    return { content: Array.isArray(r.content) ? r.content : [], structuredContent: r.structuredContent, isError: r.isError === true };
  }

  // ── JSON-RPC ─────────────────────────────────────────────
  private params(params: Record<string, unknown>, metaVersion?: string): Record<string, unknown> {
    const version = metaVersion ?? (this.era === 'modern' ? this.version : undefined);
    if (!version) return params;
    return {
      ...params,
      _meta: { [`${META}/protocolVersion`]: version, [`${META}/clientInfo`]: this.opts.clientInfo, [`${META}/clientCapabilities`]: {} },
    };
  }

  request(method: string, params: Record<string, unknown> = {}, o: { timeoutMs?: number; signal?: AbortSignal; meta?: string; probe?: boolean } = {}): Promise<Record<string, unknown>> {
    if (this.closed || this.exit) return Promise.reject(new McpError('The MCP server is not running.', undefined, 'closed'));
    if (o.signal?.aborted) return Promise.reject(new McpError('Cancelled.', undefined, 'cancelled'));
    const id = this.nextId++;
    const message = { jsonrpc: '2.0', id, method, params: this.params(params, o.meta) };
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(entry.timer);
        this.pending.delete(id);
        o.signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        done();
        // tell the server; its late answer (if any) is dropped: the id is gone
        void this.notify('notifications/cancelled', { requestId: id, reason: 'Cancelled in RealmNest.' });
        reject(new McpError('Cancelled.', undefined, 'cancelled'));
      };
      const entry: Pending = {
        method,
        resolve: (v) => (done(), resolve(v)),
        reject: (e) => (done(), reject(e)),
        timer: setTimeout(() => {
          // a legacy server gets nothing before initialize, not even a cancellation
          if (!o.probe) void this.notify('notifications/cancelled', { requestId: id, reason: 'Timed out in RealmNest.' });
          entry.reject(new McpError(`${method} did not answer in time.`, undefined, 'timeout'));
        }, o.timeoutMs ?? this.opts.requestTimeoutMs ?? MCP_LIMITS.requestTimeoutMs),
      };
      this.pending.set(id, entry);
      o.signal?.addEventListener('abort', onAbort, { once: true });
      this.traffic('out', method, message);
      this.host.send(this.serverId, message).catch((err) => entry.reject(new McpError(`Could not write to the server: ${String(err)}`, undefined, 'closed')));
    });
  }

  private async notify(method: string, params?: Record<string, unknown>) {
    if (this.closed || this.exit) return;
    const message = { jsonrpc: '2.0', method, ...(params && { params }) };
    this.traffic('out', method, message);
    await this.host.send(this.serverId, message).catch(() => undefined);
  }

  private respond(id: unknown, body: { result: unknown } | { error: { code: number; message: string } }) {
    if (this.closed || this.exit || (typeof id !== 'string' && typeof id !== 'number')) return;
    void this.host.send(this.serverId, { jsonrpc: '2.0', id, ...body }).catch(() => undefined);
  }

  private onHostEvent(e: McpHostEvent) {
    switch (e.t) {
      case 'started':
        this.started = { pid: e.pid, executable: e.executable };
        this.startWaiters?.resolve();
        this.startWaiters = undefined;
        return;
      case 'stderr':
        this.opts.onStderr?.(e.line);
        return;
      case 'invalid':
        // a line that is not JSON-RPC: the spec forbids it; note it and go on
        this.opts.onTraffic?.({ at: this.now(), dir: 'in', what: `invalid (${e.reason})`, bytes: e.bytes });
        return;
      case 'message':
        this.onMessage(e.message, e.bytes);
        return;
      case 'exit':
        this.exit = e;
        this.startWaiters?.reject(new McpError(e.message ?? exitText(e), undefined, 'closed'));
        this.startWaiters = undefined;
        this.failAll(new McpError(e.message ?? exitText(e), undefined, 'closed'));
        this.opts.onExit?.(e);
        return;
    }
  }

  private onMessage(m: unknown, bytes: number) {
    if (!isObject(m) || m.jsonrpc !== '2.0') {
      this.opts.onTraffic?.({ at: this.now(), dir: 'in', what: 'invalid (not JSON-RPC 2.0)', bytes });
      return;
    }
    // a response to one of our requests
    if ('id' in m && (m.result !== undefined || m.error !== undefined) && m.method === undefined) {
      const p = this.pending.get(m.id as number);
      this.opts.onTraffic?.({ at: this.now(), dir: 'in', what: `${m.error ? 'error' : 'result'} ${p?.method ?? '(late or unknown)'} #${String(m.id)}`, bytes });
      if (!p) return; // late (cancelled / timed out) or unknown: ignored
      if (isObject(m.error)) {
        p.reject(new McpError(typeof m.error.message === 'string' ? m.error.message.slice(0, 500) : 'The server reported an error.', typeof m.error.code === 'number' ? m.error.code : undefined));
        return;
      }
      if (!isObject(m.result)) return p.reject(new McpError('The server sent a result that is not an object.', undefined, 'protocol'));
      const type = m.result.resultType;
      if (type === undefined || type === 'complete') return p.resolve(m.result);
      if (type === 'input_required') return p.reject(new McpError('The server needs more input from the user (elicitation), which RealmNest does not support yet.', undefined, 'protocol'));
      return p.reject(new McpError(`The server sent an unknown result type "${String(type)}".`, undefined, 'protocol'));
    }
    const method = typeof m.method === 'string' ? m.method : '(no method)';
    this.opts.onTraffic?.({ at: this.now(), dir: 'in', what: method, bytes });
    // a request from the server (legacy servers may ping)
    if ('id' in m && m.id !== null && m.id !== undefined) {
      if (method === 'ping') this.respond(m.id, { result: {} });
      else this.respond(m.id, { error: { code: -32601, message: `RealmNest does not support ${method}.` } });
      return;
    }
    if (method === 'notifications/tools/list_changed') this.opts.onToolsChanged?.();
  }

  private failAll(e: McpError) {
    for (const p of [...this.pending.values()]) p.reject(e);
  }

  private traffic(dir: 'out' | 'in', what: string, message: object) {
    if (this.opts.onTraffic) this.opts.onTraffic({ at: this.now(), dir, what, bytes: JSON.stringify(message).length });
  }
}

const info = (v: unknown): McpServerInfo | undefined =>
  isObject(v) ? { ...(typeof v.name === 'string' && { name: v.name.slice(0, 100) }), ...(typeof v.version === 'string' && { version: v.version.slice(0, 50) }) } : undefined;

export function exitText(e: Extract<McpHostEvent, { t: 'exit' }>): string {
  switch (e.reason) {
    case 'not_found':
      return 'The executable was not found.';
    case 'declined':
      return 'Starting this server was not allowed.';
    case 'missing_secret':
      return 'A secret variable of this server has no value.';
    case 'auth_required':
      return e.message ?? 'The server asks you to sign in.';
    case 'refused':
      return 'The server could not be started.';
    case 'stopped':
      return 'The server was stopped.';
    case 'killed':
      return 'The server was killed.';
    case 'exited':
      return `The server exited${e.code !== undefined && e.code !== null ? ` (code ${e.code})` : ''}.`;
  }
}

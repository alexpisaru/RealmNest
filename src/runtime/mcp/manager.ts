// ─────────────────────────────────────────────────────────────
// McpClientManager: the user's MCP servers and their live connections.
//
//   config (persisted) ─connect─▶ McpClient (process + protocol)
//        │                            │ tools/list
//        ▼                            ▼
//   status from the real process  normalizeTools ─▶ ToolRegistry.upsert(def, executor)
//
// Tools the user turned on are registered as ordinary ToolDefinitions. When a
// server goes away they stay listed but lose their executor (unavailable), so
// agents keep their selections and history keeps its calls; a reconnect
// rediscovers them and replaces definitions whose schema changed. Calls come
// back here only through the executor, i.e. after ToolRuntime said yes.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import {
  DEFAULT_MCP_TOOL_TIMEOUT_MS,
  MCP_ENV_NAME,
  MCP_HEADER_NAME,
  MCP_RESERVED_HEADERS,
  mcpHeaderVar,
  mcpKeyFrom,
  mcpSecretRef,
  mcpUrlProblem,
  type McpServerConfig,
  type McpServerInfo,
  type McpServerState,
  type McpServerStatus,
  type McpToolInfo,
  type McpTraffic,
} from '../../domain/mcp';
import type { ToolResult } from '../../domain/tool';
import type { StorageAdapter } from '../../persistence/storage';
import type { SecretStore } from '../connections/secrets';
import type { ToolExecutor, ToolRegistry } from '../tools/registry';
import { exitText, McpClient, MCP_LIMITS, McpError } from './client';
import { normalizeResult, normalizeTools } from './normalize';
import type { McpTransportHost } from './transport';

const KEY = 'mcp-servers';
const CACHE_KEY = 'mcp-tools-cache';
export const MAX_MCP_SERVERS = 32;

/** what the add / edit form sends; secret values go to the credential store only */
export interface McpServerInput {
  name: string;
  /** default stdio */
  transport?: McpServerConfig['transport'];
  /** http */
  url?: string;
  headers?: Record<string, string>;
  /** http: names of headers whose values are secret */
  secretHeaders?: string[];
  /** http: new values of secret headers (a header left out keeps its stored value) */
  secretHeaderValues?: Record<string, string>;
  oauth?: boolean;
  command: string;
  args: string[];
  workingDirectory?: string;
  env: Record<string, string>;
  /** names of secret variables */
  secretEnv: string[];
  /** new values for secret variables (a variable left out keeps its stored value) */
  secretValues?: Record<string, string>;
  startup?: McpServerConfig['startup'];
  toolTimeoutMs?: number;
  source?: McpServerConfig['source'];
}

export class McpConfigError extends Error {}

const noControl = (s: string) => !/[\u0000-\u001f]/.test(s);

/** checks the form; Rust checks everything again before starting anything */
export function validateServerInput(i: McpServerInput): string | undefined {
  if (!i.name.trim() || i.name.length > 60) return 'A name of 1–60 characters is required.';
  if (i.transport === 'http') {
    const bad = mcpUrlProblem(i.url ?? '');
    if (bad) return bad;
    const names = [...Object.keys(i.headers ?? {}), ...(i.secretHeaders ?? [])];
    if (names.length > 16) return 'At most 16 headers.';
    for (const n of names) if (!MCP_HEADER_NAME.test(n) || MCP_RESERVED_HEADERS.includes(n.toLowerCase())) return `"${n}" cannot be used as a header.`;
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return 'A header is listed twice.';
    for (const v of Object.values(i.headers ?? {})) if (!v || v.length > 8192 || /[\r\n\0]/.test(v)) return 'A header value is empty or not valid.';
    if (i.toolTimeoutMs !== undefined && !(i.toolTimeoutMs >= 1_000 && i.toolTimeoutMs <= 30 * 60_000)) return 'The tool timeout must be between 1 second and 30 minutes.';
    return undefined;
  }
  const cmd = i.command.trim();
  if (!cmd || cmd.length > 1024 || !noControl(cmd)) return 'The executable is required (a path or a program name, without arguments).';
  if (/\s--?\w/.test(cmd) && !/[\\/]/.test(cmd)) return 'Put the arguments in the Arguments field, one per line.';
  if (i.args.length > 64) return 'At most 64 arguments.';
  if (i.args.some((a) => a.length > 4096 || !noControl(a))) return 'Arguments must be single lines of at most 4096 characters.';
  if (i.workingDirectory && (i.workingDirectory.length > 1024 || !noControl(i.workingDirectory))) return 'The working folder is not valid.';
  const names = [...Object.keys(i.env), ...i.secretEnv];
  if (names.length > 64) return 'At most 64 environment variables.';
  for (const n of names) if (!MCP_ENV_NAME.test(n)) return `"${n}" is not a valid variable name.`;
  if (new Set(names.map((n) => n.toUpperCase())).size !== names.length) return 'A variable is listed twice.';
  for (const v of Object.values(i.env)) if (v.length > 8192 || v.includes('\u0000')) return 'A variable value is too long.';
  if (i.toolTimeoutMs !== undefined && !(i.toolTimeoutMs >= 1_000 && i.toolTimeoutMs <= 30 * 60_000)) return 'The tool timeout must be between 1 second and 30 minutes.';
  return undefined;
}

const cleanConfig = (v: unknown): McpServerConfig | undefined => {
  const c = v as Partial<McpServerConfig>;
  if (!c || typeof c.id !== 'string' || typeof c.key !== 'string' || typeof c.name !== 'string' || typeof c.command !== 'string') return undefined;
  const http = c.transport === 'http' && typeof c.url === 'string';
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    transport: http ? 'http' : 'stdio',
    ...(http && {
      url: c.url,
      headers: c.headers && typeof c.headers === 'object' ? Object.fromEntries(Object.entries(c.headers).filter(([k, v]) => MCP_HEADER_NAME.test(k) && typeof v === 'string')) : {},
      secretHeaders: Array.isArray(c.secretHeaders) ? c.secretHeaders.filter((n): n is string => typeof n === 'string' && MCP_HEADER_NAME.test(n)) : [],
      ...(c.oauth === true && { oauth: true }),
    }),
    command: c.command,
    args: Array.isArray(c.args) ? c.args.filter((a): a is string => typeof a === 'string') : [],
    ...(typeof c.workingDirectory === 'string' && c.workingDirectory && { workingDirectory: c.workingDirectory }),
    env: c.env && typeof c.env === 'object' ? Object.fromEntries(Object.entries(c.env).filter(([k, val]) => MCP_ENV_NAME.test(k) && typeof val === 'string')) : {},
    secretEnv: Array.isArray(c.secretEnv) ? c.secretEnv.filter((n): n is string => typeof n === 'string' && MCP_ENV_NAME.test(n)) : [],
    enabled: c.enabled !== false,
    startup: c.startup === 'auto' ? 'auto' : 'manual',
    enabledTools: Array.isArray(c.enabledTools) ? c.enabledTools.filter((n): n is string => typeof n === 'string') : [],
    toolTimeoutMs: typeof c.toolTimeoutMs === 'number' ? c.toolTimeoutMs : DEFAULT_MCP_TOOL_TIMEOUT_MS,
    origin: c.origin === 'bundled' ? 'bundled' : 'user',
    ...(c.source && typeof c.source === 'object' && { source: c.source }),
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
    ...(typeof c.lastConnectedAt === 'number' && { lastConnectedAt: c.lastConnectedAt }),
  };
};

interface Cached {
  tools: McpToolInfo[];
  serverInfo?: McpServerInfo;
}

export class McpClientManager {
  private configs: McpServerConfig[] = [];
  private states = new Map<string, McpServerState>();
  private clients = new Map<string, McpClient>();
  private cache: Record<string, Cached> = {};
  private trafficLog = new Map<string, McpTraffic[]>();
  private stderrLog = new Map<string, string[]>();
  private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;

  constructor(
    private host: McpTransportHost,
    private registry: ToolRegistry,
    private storage: StorageAdapter,
    private secrets: SecretStore,
    private bus?: EventBus,
    private opts: { now?: () => number; newId?: () => string; clientInfo?: { name: string; version: string }; requestTimeoutMs?: number; discoverTimeoutMs?: number } = {},
  ) {}

  get available() {
    return this.host.available;
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  /** `autostart: false` (Start safely) loads everything but starts no server */
  async init(opts: { autostart?: boolean } = {}) {
    const raw = await this.storage.get<{ servers?: unknown[] }>(KEY);
    this.configs = (Array.isArray(raw?.servers) ? raw.servers : []).map(cleanConfig).filter((c): c is McpServerConfig => !!c);
    const cache = await this.storage.get<Record<string, Cached>>(CACHE_KEY);
    this.cache = cache && typeof cache === 'object' && !Array.isArray(cache) ? cache : {};
    // a cached list is only a hint: a broken one is dropped (I-22)
    for (const [id, entry] of Object.entries(this.cache)) if (!entry || typeof entry !== 'object' || !Array.isArray(entry.tools)) delete this.cache[id];
    // the tools the user turned on are listed at once (unavailable until connected)
    for (const c of this.configs) {
      this.states.set(c.id, { status: 'disconnected', tools: this.cache[c.id]?.tools ?? [], skipped: [], serverInfo: this.cache[c.id]?.serverInfo });
      this.sync(c.id);
    }
    this.changed();
    // auto-start only what the user explicitly set to start with RealmNest
    if (opts.autostart !== false) for (const c of this.configs) if (c.enabled && c.startup === 'auto') void this.connect(c.id);
  }

  // ── reading ──────────────────────────────────────────────
  list(): McpServerConfig[] {
    return this.configs;
  }
  get(id: string) {
    return this.configs.find((c) => c.id === id);
  }
  state(id: string): McpServerState {
    return this.states.get(id) ?? { status: 'disconnected', tools: [], skipped: [] };
  }
  traffic(id: string): McpTraffic[] {
    return this.trafficLog.get(id) ?? [];
  }
  stderr(id: string): string[] {
    return this.stderrLog.get(id) ?? [];
  }

  // ── configuration ────────────────────────────────────────
  async add(input: McpServerInput): Promise<McpServerConfig> {
    const problem = validateServerInput(input);
    if (problem) throw new McpConfigError(problem);
    if (this.configs.length >= MAX_MCP_SERVERS) throw new McpConfigError(`At most ${MAX_MCP_SERVERS} MCP servers.`);
    const now = this.now();
    const id = this.opts.newId?.() ?? `mcp-${now.toString(36)}-${(++this.counter).toString(36)}`;
    const config: McpServerConfig = {
      id,
      key: mcpKeyFrom(input.name, this.configs.map((c) => c.key)),
      name: input.name.trim(),
      transport: input.transport === 'http' ? 'http' : 'stdio',
      ...(input.transport === 'http' && { url: input.url!.trim(), headers: input.headers ?? {}, secretHeaders: input.secretHeaders ?? [], ...(input.oauth && { oauth: true }) }),
      command: input.transport === 'http' ? '' : input.command.trim(),
      args: input.args,
      ...(input.workingDirectory?.trim() && { workingDirectory: input.workingDirectory.trim() }),
      env: input.env,
      secretEnv: input.secretEnv,
      enabled: true,
      startup: input.startup ?? 'manual',
      enabledTools: [],
      toolTimeoutMs: input.toolTimeoutMs ?? DEFAULT_MCP_TOOL_TIMEOUT_MS,
      origin: 'user',
      ...(input.source && { source: input.source }),
      createdAt: now,
      updatedAt: now,
    };
    await this.storeSecrets(config, input.secretValues, input.secretHeaderValues);
    this.configs = [...this.configs, config];
    this.states.set(id, { status: 'disconnected', tools: [], skipped: [] });
    await this.save();
    this.bus?.emit('mcp.server.added', { serverId: id, name: config.name });
    this.changed();
    return config;
  }

  /** change how a server starts; a running server is restarted to apply it */
  async update(id: string, input: McpServerInput) {
    const c = this.get(id);
    if (!c) return;
    const problem = validateServerInput(input);
    if (problem) throw new McpConfigError(problem);
    const removedSecrets = c.secretEnv.filter((n) => !input.secretEnv.includes(n));
    await Promise.all(removedSecrets.map((n) => this.secrets.delete(mcpSecretRef(id, n)).catch(() => undefined)));
    const removedHeaders = (c.secretHeaders ?? []).filter((h) => !(input.secretHeaders ?? []).includes(h));
    await Promise.all(removedHeaders.map((h) => this.secrets.delete(mcpSecretRef(id, mcpHeaderVar(h))).catch(() => undefined)));
    const http = c.transport === 'http';
    const next: McpServerConfig = {
      ...c,
      name: input.name.trim(),
      ...(http && { url: (input.url ?? c.url ?? '').trim(), headers: input.headers ?? {}, secretHeaders: input.secretHeaders ?? [] }),
      command: http ? '' : input.command.trim(),
      args: input.args,
      env: input.env,
      secretEnv: input.secretEnv,
      startup: input.startup ?? c.startup,
      toolTimeoutMs: input.toolTimeoutMs ?? c.toolTimeoutMs,
      updatedAt: this.now(),
    };
    if (input.workingDirectory?.trim()) next.workingDirectory = input.workingDirectory.trim();
    else delete next.workingDirectory;
    if (http) {
      if (input.oauth) next.oauth = true;
      else delete next.oauth;
    }
    await this.storeSecrets(next, input.secretValues, input.secretHeaderValues);
    this.replace(next);
    await this.save();
    this.bus?.emit('mcp.server.updated', { serverId: id, fields: ['launch'] });
    this.sync(id);
    if (this.clients.has(id)) await this.restart(id);
    this.changed();
  }

  async setStartup(id: string, startup: McpServerConfig['startup']) {
    const c = this.get(id);
    if (!c || c.startup === startup) return;
    this.replace({ ...c, startup, updatedAt: this.now() });
    await this.save();
    this.bus?.emit('mcp.server.updated', { serverId: id, fields: ['startup'] });
    this.changed();
  }

  /** turn tools of a server on or off (on: offered to agents and chats that allow them) */
  async setTools(id: string, names: string[], on: boolean) {
    const c = this.get(id);
    if (!c) return;
    const set = new Set(c.enabledTools);
    for (const n of names) on ? set.add(n) : set.delete(n);
    this.replace({ ...c, enabledTools: [...set].sort(), updatedAt: this.now() });
    await this.save();
    this.bus?.emit('mcp.server.updated', { serverId: id, fields: ['enabledTools'] });
    this.sync(id);
    this.changed();
  }

  /** delete a server: stop it, drop its tools and secrets; call history stays */
  async remove(id: string) {
    const c = this.get(id);
    if (!c) return;
    await this.disconnect(id);
    for (const t of this.registry.list({ source: 'mcp' })) if (t.metadata?.mcpServerId === id) this.registry.unregister(t.id);
    await Promise.all(c.secretEnv.map((n) => this.secrets.delete(mcpSecretRef(id, n)).catch(() => undefined)));
    await Promise.all((c.secretHeaders ?? []).map((h) => this.secrets.delete(mcpSecretRef(id, mcpHeaderVar(h))).catch(() => undefined)));
    if (c.oauth) await this.host.oauthLogout?.(id).catch(() => undefined);
    this.configs = this.configs.filter((x) => x.id !== id);
    this.states.delete(id);
    delete this.cache[id];
    await this.save();
    await this.storage.set(CACHE_KEY, this.cache);
    this.bus?.emit('mcp.server.removed', { serverId: id });
    this.changed();
  }

  /** which secret variables have a stored value (values are never read back) */
  async secretStatus(id: string): Promise<Record<string, boolean>> {
    const c = this.get(id);
    if (!c) return {};
    const out: Record<string, boolean> = {};
    for (const n of c.secretEnv) out[n] = await this.secrets.has(mcpSecretRef(id, n)).catch(() => false);
    for (const h of c.secretHeaders ?? []) out[h] = await this.secrets.has(mcpSecretRef(id, mcpHeaderVar(h))).catch(() => false);
    return out;
  }

  /** online servers with OAuth: signed in? (tokens never leave the native host) */
  async signedIn(id: string): Promise<boolean> {
    return (await this.host.oauthStatus?.(id).catch(() => false)) ?? false;
  }

  /** OAuth sign-in in the browser, then connect */
  async signIn(id: string): Promise<McpServerState> {
    const c = this.get(id);
    if (!c || c.transport !== 'http' || !c.url) throw new McpConfigError('Only online servers have a sign-in.');
    if (!this.host.oauthLogin) throw new McpConfigError('Signing in needs the RealmNest desktop app.');
    this.setState(id, { status: 'starting', error: undefined });
    try {
      await this.host.oauthLogin(id, c.url);
    } catch (err) {
      return this.setState(id, { status: 'auth_required', error: err instanceof Error ? err.message : String(err) });
    }
    if (!c.oauth) {
      this.replace({ ...c, oauth: true, updatedAt: this.now() });
      await this.save();
    }
    return this.connect(id);
  }

  async signOut(id: string) {
    await this.disconnect(id);
    await this.host.oauthLogout?.(id).catch(() => undefined);
    this.setState(id, { status: 'auth_required', error: undefined });
    this.changed();
  }

  private async storeSecrets(c: McpServerConfig, values: Record<string, string> | undefined, headerValues?: Record<string, string>) {
    for (const [name, value] of Object.entries(values ?? {})) {
      if (!c.secretEnv.includes(name)) continue;
      if (value) await this.secrets.set(mcpSecretRef(c.id, name), value);
    }
    for (const [header, value] of Object.entries(headerValues ?? {})) {
      if (!(c.secretHeaders ?? []).includes(header)) continue;
      if (value) await this.secrets.set(mcpSecretRef(c.id, mcpHeaderVar(header)), value);
    }
  }

  // ── lifecycle ────────────────────────────────────────────
  async connect(id: string): Promise<McpServerState> {
    const c = this.get(id);
    if (!c) throw new McpConfigError('Unknown MCP server.');
    const current = this.state(id);
    if (this.clients.has(id) && (current.status === 'starting' || current.status === 'connected')) return current;
    if (!this.host.available) return this.setState(id, { status: 'unavailable', error: 'MCP servers run only in the RealmNest desktop app.' });
    // a secret variable without a value: the server would start without its credentials
    for (const n of c.secretEnv)
      if (!(await this.secrets.has(mcpSecretRef(id, n)).catch(() => false))) return this.setState(id, { status: 'auth_required', error: `The secret variable ${n} has no value.` });
    for (const h of c.secretHeaders ?? [])
      if (!(await this.secrets.has(mcpSecretRef(id, mcpHeaderVar(h))).catch(() => false))) return this.setState(id, { status: 'auth_required', error: `The header ${h} has no value.` });
    if (c.transport === 'http' && c.oauth && !(await this.signedIn(id))) return this.setState(id, { status: 'auth_required', error: 'Sign in to this server.' });

    this.trafficLog.set(id, []);
    this.stderrLog.set(id, []);
    this.setState(id, { status: 'starting', error: undefined });
    const client: McpClient = new McpClient(id, this.host, {
      clientInfo: this.opts.clientInfo ?? { name: 'RealmNest', version: '0.6' },
      ...(this.opts.requestTimeoutMs && { requestTimeoutMs: this.opts.requestTimeoutMs }),
      ...(this.opts.discoverTimeoutMs && { discoverTimeoutMs: this.opts.discoverTimeoutMs }),
      now: () => this.now(),
      onTraffic: (t) => this.log(this.trafficLog, id, t, MCP_LIMITS.traffic),
      onStderr: (line) => this.log(this.stderrLog, id, line.slice(0, 500), MCP_LIMITS.stderr),
      onToolsChanged: () => this.scheduleRefresh(id),
      onExit: (e) => this.onExit(id, client, e.message ?? exitText(e), e.reason),
    });
    this.clients.set(id, client);
    try {
      const secretEnv = Object.fromEntries(c.secretEnv.map((n) => [n, mcpSecretRef(id, n)]));
      const online =
        c.transport === 'http' && c.url
          ? { url: c.url, headers: c.headers ?? {}, secretHeaders: Object.fromEntries((c.secretHeaders ?? []).map((h) => [h, mcpSecretRef(id, mcpHeaderVar(h))])), oauth: !!c.oauth }
          : {};
      const hs = await client.connect({ serverId: id, command: c.command, args: c.args, ...(c.workingDirectory && { cwd: c.workingDirectory }), env: c.env, secretEnv, ...online });
      const tools = await client.listTools();
      if (this.clients.get(id) !== client) return this.state(id); // stopped meanwhile
      const now = this.now();
      this.cache[id] = { tools, ...(hs.serverInfo && { serverInfo: hs.serverInfo }) };
      void this.storage.set(CACHE_KEY, this.cache);
      this.replace({ ...this.get(id)!, lastConnectedAt: now });
      void this.save();
      this.setState(id, {
        status: 'connected',
        era: hs.era,
        protocolVersion: hs.protocolVersion,
        serverInfo: hs.serverInfo,
        instructions: hs.instructions,
        tools,
        executable: client.process?.executable,
        pid: client.process?.pid,
        connectedAt: now,
        error: undefined,
      });
      this.sync(id);
      return this.state(id);
    } catch (err) {
      if (this.clients.get(id) !== client) return this.state(id);
      this.clients.delete(id);
      const reason = client.exit?.reason;
      await client.close();
      const status: McpServerStatus = reason === 'not_found' || reason === 'refused' || reason === 'declined' ? 'unavailable' : reason === 'missing_secret' || reason === 'auth_required' ? 'auth_required' : 'failed';
      this.setState(id, { status, error: err instanceof Error ? err.message : String(err), pid: undefined });
      this.sync(id);
      return this.state(id);
    }
  }

  async disconnect(id: string) {
    const client = this.clients.get(id);
    this.clients.delete(id);
    clearTimeout(this.refreshTimers.get(id));
    if (client) await client.close();
    if (this.states.has(id)) {
      this.setState(id, { status: client ? 'stopped' : this.state(id).status === 'connected' ? 'stopped' : this.state(id).status, pid: undefined });
      this.sync(id);
    }
  }

  async restart(id: string) {
    await this.disconnect(id);
    return this.connect(id);
  }

  /** stop every server (app exit; Rust also kills them on exit) */
  async stopAll() {
    await Promise.all([...this.clients.keys()].map((id) => this.disconnect(id)));
  }

  private onExit(id: string, client: McpClient, message: string, reason: string) {
    if (this.clients.get(id) !== client) return; // an old process, or a stop we asked for
    if (this.state(id).status === 'starting') return; // connect() reports it, with the real reason
    this.clients.delete(id);
    const wasConnected = this.state(id).status === 'connected';
    // a missing secret or a sign-in the server asks for is the user's to fix, as in connect() (I-10)
    const status: McpServerStatus = reason === 'missing_secret' || reason === 'auth_required' ? 'auth_required' : 'failed';
    this.setState(id, { status, error: wasConnected ? `The server stopped unexpectedly. ${message}` : message, pid: undefined });
    if (reason) this.log(this.stderrLog, id, `[realmnest] exit: ${reason}`, MCP_LIMITS.stderr);
    this.sync(id);
  }

  /** the server says its tools changed (or a call hit an unknown tool): list again */
  private scheduleRefresh(id: string) {
    clearTimeout(this.refreshTimers.get(id));
    this.refreshTimers.set(
      id,
      setTimeout(() => void this.refresh(id), 300),
    );
  }

  async refresh(id: string) {
    const client = this.clients.get(id);
    if (!client || this.state(id).status !== 'connected') return;
    try {
      const tools = await client.listTools();
      if (this.clients.get(id) !== client) return;
      this.cache[id] = { ...this.cache[id], tools };
      void this.storage.set(CACHE_KEY, this.cache);
      this.setState(id, { tools });
      this.sync(id);
    } catch {
      // a failing refresh keeps the last list; a dead server is reported by onExit
    }
  }

  // ── calls (only through the executor, after ToolRuntime) ─
  private executor(id: string, toolName: string): ToolExecutor {
    return async ({ input, signal }) => this.call(id, toolName, input, signal);
  }

  async call(id: string, toolName: string, input: Record<string, unknown>, signal: AbortSignal): Promise<Omit<ToolResult, 'toolCallId'>> {
    const c = this.get(id);
    const client = this.clients.get(id);
    if (!c || !client || this.state(id).status !== 'connected') return { success: false, error: { code: 'TOOL_UNAVAILABLE', message: `${c?.name ?? 'The MCP server'} is not connected.` } };
    try {
      // ToolRuntime enforces the tool timeout; this one only guards the protocol
      return normalizeResult(await client.callTool(toolName, input, signal, c.toolTimeoutMs + 5_000));
    } catch (err) {
      const e = err as McpError;
      if (e.kind === 'cancelled') return { success: false, error: { code: 'TOOL_CANCELLED', message: 'The call was cancelled.' } };
      if (e.kind === 'timeout') return { success: false, error: { code: 'TOOL_TIMEOUT', message: `${c.name} did not answer in time.` } };
      if (e.kind === 'closed') return { success: false, error: { code: 'TOOL_UNAVAILABLE', message: `${c.name} stopped during the call.` } };
      // an unknown tool means our list is stale: refresh it, never retry blindly
      if (e.code === -32602 || e.code === -32601) this.scheduleRefresh(id);
      return { success: false, error: { code: 'MCP_ERROR', message: `${c.name}: ${e.message}` } };
    }
  }

  // ── registry ─────────────────────────────────────────────
  /** make the registry match this server: enabled tools listed, runnable only while connected */
  private sync(id: string) {
    const c = this.get(id);
    const st = this.state(id);
    const mine = this.registry.list({ source: 'mcp' }).filter((t) => t.metadata?.mcpServerId === id);
    if (!c) {
      for (const t of mine) this.registry.unregister(t.id);
      return;
    }
    const connected = st.status === 'connected' && this.clients.has(id);
    const taken = new Set(this.registry.list().filter((t) => t.metadata?.mcpServerId !== id).map((t) => t.name));
    const { defs, skipped } = normalizeTools(c, st.serverInfo, st.tools, taken);
    const wanted = new Set(c.enabledTools);
    const keep = new Set<string>();
    let added = 0;
    let updated = 0;
    for (const def of defs) {
      const toolName = def.metadata!.mcpToolName;
      if (!wanted.has(toolName)) continue;
      const before = this.registry.get(def.id);
      try {
        this.registry.upsert(def, connected ? this.executor(id, toolName) : undefined);
        keep.add(def.id);
        if (!before) added++;
        else if (JSON.stringify(before.inputSchema) !== JSON.stringify(def.inputSchema) || before.description !== def.description) updated++;
      } catch (err) {
        skipped.push({ name: toolName, reason: String((err as Error).message ?? err) });
      }
    }
    let removed = 0;
    for (const t of mine)
      if (!keep.has(t.id)) {
        this.registry.unregister(t.id);
        removed++;
      }
    this.states.set(id, { ...this.state(id), skipped });
    if (added || removed || updated) this.bus?.emit('mcp.tools.changed', { serverId: id, added, removed, updated });
  }

  // ── plumbing ─────────────────────────────────────────────
  private setState(id: string, patch: Partial<McpServerState>): McpServerState {
    const next = { ...this.state(id), ...patch };
    const before = this.states.get(id)?.status;
    this.states.set(id, next);
    if (before !== next.status) this.bus?.emit('mcp.server.status', { serverId: id, status: next.status, tools: next.tools.length, ...(next.error && { error: next.error.slice(0, 200) }) });
    this.changed();
    return next;
  }

  private replace(c: McpServerConfig) {
    this.configs = this.configs.map((x) => (x.id === c.id ? c : x));
  }

  private save() {
    return this.storage.set(KEY, { version: 1, servers: this.configs });
  }

  private log<T>(map: Map<string, T[]>, id: string, item: T, max: number) {
    const list = map.get(id) ?? [];
    list.push(item);
    if (list.length > max) list.splice(0, list.length - max);
    map.set(id, list);
    this.changed();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

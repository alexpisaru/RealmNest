import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { McpToolInfo } from '../domain/mcp';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import type { SecretStore } from '../runtime/connections/secrets';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { McpClient, MCP_LIMITS } from '../runtime/mcp/client';
import { McpClientManager, validateServerInput, type McpServerInput } from '../runtime/mcp/manager';
import { mcpModelName, normalizeResult, normalizeTools } from '../runtime/mcp/normalize';
import type { McpHostEvent, McpLaunch, McpTransportHost } from '../runtime/mcp/transport';
import { OpenRouterProvider } from '../runtime/providers/openrouter/provider';
import type { OpenRouterTransport, OrChatRequest, OrStreamEvent } from '../runtime/providers/openrouter/transport';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import { ToolLoop } from '../runtime/tools/loop';
import { registerNativeTools, UnavailableToolHost } from '../runtime/tools/native';
import { ToolPolicyStore } from '../runtime/tools/policy';
import { ToolRegistry } from '../runtime/tools/registry';
import { ToolRuntime } from '../runtime/tools/runtime';
import { MAX_OFFERED_TOOLS, ToolService } from '../runtime/tools/service';

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean, n = 600) => {
  for (let i = 0; i < n && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

const SCHEMA = (props: Record<string, unknown> = {}, required: string[] = []) => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: props, required, additionalProperties: false });

const PHOTO_TOOLS: McpToolInfo[] = [
  { name: 'doc_open', description: 'Open an image.', inputSchema: SCHEMA({ path: { type: 'string' } }, ['path']), annotations: { readOnlyHint: false, destructiveHint: false } },
  { name: 'doc_inspect', description: 'Document state.', inputSchema: SCHEMA({ index: { type: ['integer', 'null'], minimum: 0, default: null, format: 'uint' } }), annotations: { readOnlyHint: true, destructiveHint: false } },
  { name: 'render_preview', description: 'A PNG preview.', inputSchema: SCHEMA({ max_side: { type: ['integer', 'null'] } }), annotations: { readOnlyHint: true } },
  { name: 'slow', description: 'Never answers.', inputSchema: SCHEMA() },
  { name: 'boom', description: 'Fails.', inputSchema: SCHEMA() },
];

interface Behaviour {
  era: 'modern' | 'legacy' | 'silent-legacy' | 'modern-only-other';
  tools: McpToolInfo[];
  /** page size for tools/list */
  page?: number;
}

/** one fake server process: answers like a real MCP server would */
class FakeServer {
  received: Record<string, unknown>[] = [];
  initialized = false;
  cancelled: unknown[] = [];
  constructor(
    public b: Behaviour,
    private emit: (e: McpHostEvent) => void,
  ) {}
  reply(id: unknown, body: object) {
    const message = { jsonrpc: '2.0', id, ...body };
    setTimeout(() => this.emit({ t: 'message', message, bytes: JSON.stringify(message).length }), 0);
  }
  handle(m: Record<string, unknown>) {
    this.received.push(m);
    const params = (m.params ?? {}) as Record<string, unknown>;
    const meta = (params._meta ?? {}) as Record<string, unknown>;
    const modernCall = meta['io.modelcontextprotocol/protocolVersion'] === '2026-07-28';
    switch (m.method) {
      case 'server/discover':
        if (this.b.era === 'silent-legacy') return; // a legacy server that ignores unknown methods
        if (this.b.era === 'legacy') return this.reply(m.id, { error: { code: -32601, message: 'Method not found' } });
        if (this.b.era === 'modern-only-other') return this.reply(m.id, { error: { code: -32022, message: 'Unsupported protocol version', data: { supported: ['2099-01-01'] } } });
        return this.reply(m.id, { result: { resultType: 'complete', supportedVersions: ['2025-11-25', '2026-07-28'], capabilities: { tools: {} }, _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'fakecraft', version: '1.2.3' } }, instructions: 'Use doc_open first.' } });
      case 'initialize':
        return this.reply(m.id, { result: { protocolVersion: '2025-11-25', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'legacycraft', version: '0.1' } } });
      case 'notifications/initialized':
        this.initialized = true;
        return;
      case 'notifications/cancelled':
        this.cancelled.push(params.requestId);
        return;
      case 'tools/list': {
        if (this.b.era === 'modern' && !modernCall) return this.reply(m.id, { error: { code: -32602, message: 'missing _meta' } });
        const page = this.b.page ?? 1000;
        const start = Number(params.cursor ?? 0);
        const slice = this.b.tools.slice(start, start + page);
        const next = start + page < this.b.tools.length ? String(start + page) : undefined;
        return this.reply(m.id, { result: { resultType: 'complete', tools: slice, ...(next && { nextCursor: next }) } });
      }
      case 'tools/call': {
        const name = params.name as string;
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        if (name === 'slow') return;
        if (name === 'boom') return this.reply(m.id, { result: { content: [{ type: 'text', text: 'Layer not found' }], isError: true } });
        if (!this.b.tools.some((t) => t.name === name)) return this.reply(m.id, { error: { code: -32602, message: `Unknown tool: ${name}` } });
        if (name === 'render_preview') return this.reply(m.id, { result: { content: [{ type: 'image', data: 'iVBORw0KGgo'.repeat(100), mimeType: 'image/png' }] } });
        if (name === 'doc_inspect') return this.reply(m.id, { result: { resultType: 'complete', content: [{ type: 'text', text: '{"layers":["Background","Logo"]}' }], structuredContent: { layers: ['Background', 'Logo'] } } });
        return this.reply(m.id, { result: { content: [{ type: 'text', text: `opened ${String(args.path)}` }] } });
      }
      default:
        if (m.id !== undefined) this.reply(m.id, { error: { code: -32601, message: 'Method not found' } });
    }
  }
}

/** the native host, faked: servers by id, launch checks like Rust's */
class FakeHost implements McpTransportHost {
  readonly available = true;
  servers = new Map<string, FakeServer>();
  launches: McpLaunch[] = [];
  behaviours = new Map<string, Behaviour>();
  starts = 0;
  emitters = new Map<string, (e: McpHostEvent) => void>();
  async start(l: McpLaunch, onEvent: (e: McpHostEvent) => void) {
    this.launches.push(l);
    this.starts++;
    const b = this.behaviours.get(l.command);
    setTimeout(() => {
      if (!b) return onEvent({ t: 'exit', reason: 'not_found', message: `${l.command} was not found` });
      this.emitters.set(l.serverId, onEvent);
      this.servers.set(l.serverId, new FakeServer(b, onEvent));
      onEvent({ t: 'started', pid: 1000 + this.starts, executable: `C:\\Program Files\\Fake\\${l.command}.exe` });
    }, 0);
  }
  async send(id: string, message: object) {
    const s = this.servers.get(id);
    if (!s) throw new Error('this server is not running');
    s.handle(message as Record<string, unknown>);
  }
  async stop(id: string) {
    const emit = this.emitters.get(id);
    this.servers.delete(id);
    this.emitters.delete(id);
    emit?.({ t: 'exit', reason: 'stopped', code: 0 });
  }
  /** the process dies by itself */
  crash(id: string) {
    const emit = this.emitters.get(id);
    this.servers.delete(id);
    this.emitters.delete(id);
    emit?.({ t: 'exit', reason: 'exited', code: 3 });
  }
}

class Vault implements SecretStore {
  readonly available = true;
  values = new Map<string, string>();
  async set(n: string, v: string) {
    this.values.set(n, v);
  }
  async delete(n: string) {
    this.values.delete(n);
  }
  async has(n: string) {
    return this.values.has(n);
  }
}

const input = (over: Partial<McpServerInput> = {}): McpServerInput => ({ name: 'PhotoCraft', command: 'photocraft', args: ['mcp'], env: {}, secretEnv: [], ...over });

async function rig(storage = new MemoryAdapter(), host = new FakeHost(), vault = new Vault()) {
  host.behaviours.set('photocraft', { era: 'modern', tools: PHOTO_TOOLS });
  host.behaviours.set('effectcraft', { era: 'modern', tools: [{ name: 'get_project', description: 'Project overview.', inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false }, annotations: { readOnlyHint: true } }, { name: 'doc_open', description: 'Same name, other server.', inputSchema: SCHEMA() }] });
  host.behaviours.set('legacy', { era: 'legacy', tools: [{ name: 'echo', inputSchema: SCHEMA({ text: { type: 'string' } }) }] });
  host.behaviours.set('silent', { era: 'silent-legacy', tools: [{ name: 'echo', inputSchema: SCHEMA({ text: { type: 'string' } }) }] });
  host.behaviours.set('future', { era: 'modern-only-other', tools: [] });
  const bus = new EventBus(3000);
  const registry = registerNativeTools(new ToolRegistry(), new UnavailableToolHost());
  const policy = new ToolPolicyStore(storage, bus);
  await policy.init();
  const runtime = new ToolRuntime(registry, policy, bus, storage);
  await runtime.init();
  let n = 0;
  const mcp = new McpClientManager(host, registry, storage, vault, bus, { newId: () => `srv${++n}`, discoverTimeoutMs: 40, requestTimeoutMs: 2_000 });
  await mcp.init();
  return { bus, storage, host, vault, registry, policy, runtime, mcp };
}
const live = () => new AbortController().signal;

// ── normalization ────────────────────────────────────────────

describe('MCP tool normalization', () => {
  const server = { id: 'srv1', key: 'photocraft', name: 'PhotoCraft', toolTimeoutMs: 60_000 };
  it('turns discovered tools into namespaced ToolDefinitions that ask by default', () => {
    const { defs, skipped } = normalizeTools(server, { name: 'photocraft', version: '0.7.0' }, PHOTO_TOOLS, new Set());
    expect(skipped).toEqual([]);
    const open = defs.find((d) => d.id === 'mcp.photocraft.doc_open')!;
    expect(open).toMatchObject({ name: 'photocraft__doc_open', source: 'mcp', risk: 'high', permissions: {}, timeoutMs: 60_000, version: '0.7.0', metadata: { mcpServerId: 'srv1', mcpServerName: 'PhotoCraft', mcpToolName: 'doc_open' } });
    // a read-only claim lowers the risk to medium, never to low (low would run without asking)
    expect(defs.find((d) => d.id === 'mcp.photocraft.doc_inspect')!.risk).toBe('medium');
  });

  it('skips tools it cannot offer, with the reason', () => {
    const bad: McpToolInfo[] = [
      { name: 'has space', inputSchema: SCHEMA() },
      { name: 'not_object', inputSchema: { type: 'string' } },
      { name: 'huge', inputSchema: SCHEMA(Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`p${i}`, { type: 'string', description: 'x'.repeat(40) }]))) },
      { name: 'remote_ref', inputSchema: { type: 'object', properties: { a: { $ref: 'https://evil.example/schema.json' } } } },
      { name: 'dup', inputSchema: SCHEMA() },
      { name: 'dup', inputSchema: SCHEMA() },
    ];
    const { defs, skipped } = normalizeTools(server, undefined, bad, new Set());
    expect(defs.map((d) => d.id)).toEqual(['mcp.photocraft.dup']);
    expect(skipped.map((s) => s.name)).toEqual(['has space', 'not_object', 'huge', 'remote_ref', 'dup']);
    expect(skipped.find((s) => s.name === 'huge')!.reason).toMatch(/KB/);
    expect(skipped.find((s) => s.name === 'remote_ref')!.reason).toMatch(/external \$ref/);
  });

  it('model names are provider-safe, ≤ 64 and stable', () => {
    expect(mcpModelName('pc', 'doc_open', new Set())).toBe('pc__doc_open');
    const dotted = mcpModelName('pc', 'admin.tools.list', new Set());
    expect(dotted).toMatch(/^pc__admin_tools_list_[a-z0-9]+$/);
    expect(mcpModelName('pc', 'admin.tools.list', new Set())).toBe(dotted);
    const long = mcpModelName('photocraft', 'x'.repeat(120), new Set());
    expect(long.length).toBeLessThanOrEqual(64);
    expect(mcpModelName('pc', 'doc_open', new Set(['pc__doc_open']))).not.toBe('pc__doc_open');
  });

  it('results keep their structure; binary content is described for the model', () => {
    const r = normalizeResult({
      content: [
        { type: 'text', text: 'Two layers.' },
        { type: 'image', data: 'AAAA'.repeat(1000), mimeType: 'image/png' },
        { type: 'resource_link', uri: 'file:///out.png', name: 'out.png', mimeType: 'image/png' },
        { type: 'resource', resource: { uri: 'mem://doc', mimeType: 'text/plain', text: 'inline text' } },
        { type: 'something_new' },
      ],
      structuredContent: { layers: 2 },
    });
    expect(r.success).toBe(true);
    expect(r.content).toBe('Two layers.\n[image image/png, 3 KB]\n[resource out.png file:///out.png]\n[resource mem://doc]\ninline text\n[something_new content]');
    expect(r.structuredData).toEqual({ layers: 2 });
    expect(r.parts![1]).toMatchObject({ type: 'image', mimeType: 'image/png', bytes: 3000, data: expect.any(String) });
    expect(normalizeResult({ content: [{ type: 'text', text: 'Layer not found' }], isError: true })).toMatchObject({ success: false, error: { code: 'TOOL_EXECUTION_FAILED', message: 'Layer not found' } });
    expect(normalizeResult({ content: [], structuredContent: [1, 2] }).content).toBe('[1,2]');
  });
});

// ── client & protocol ────────────────────────────────────────

describe('McpClient', () => {
  const connect = async (command: string, page?: number) => {
    const host = new FakeHost();
    host.behaviours.set(command, { era: command === 'legacy' ? 'legacy' : command === 'silent' ? 'silent-legacy' : command === 'future' ? 'modern-only-other' : 'modern', tools: PHOTO_TOOLS, page });
    const client = new McpClient('s', host, { clientInfo: { name: 'RealmNest', version: 't' }, discoverTimeoutMs: 40, requestTimeoutMs: 500 });
    return { host, client, hs: client.connect({ serverId: 's', command, args: [], env: {}, secretEnv: {} }) };
  };

  it('modern servers: discover, then _meta on every request, paginated tools/list', async () => {
    const { host, client, hs } = await connect('modern', 2);
    expect(await hs).toEqual({ era: 'modern', protocolVersion: '2026-07-28', serverInfo: { name: 'fakecraft', version: '1.2.3' }, instructions: 'Use doc_open first.', capabilities: { tools: {} } });
    expect((await client.listTools()).map((t) => t.name)).toEqual(PHOTO_TOOLS.map((t) => t.name));
    const sent = host.servers.get('s')!.received;
    expect(sent.map((m) => m.method)).toEqual(['server/discover', 'tools/list', 'tools/list', 'tools/list']);
    expect(sent.every((m) => (m.params as { _meta: Record<string, unknown> })._meta['io.modelcontextprotocol/protocolVersion'] === '2026-07-28')).toBe(true);
    expect(sent.some((m) => m.method === 'initialize')).toBe(false);
  });

  it('legacy servers: an error or silence on discover falls back to initialize', async () => {
    for (const cmd of ['legacy', 'silent']) {
      const { host, client, hs } = await connect(cmd);
      expect(await hs).toMatchObject({ era: 'legacy', protocolVersion: '2025-11-25', serverInfo: { name: 'legacycraft' } });
      const s = host.servers.get('s')!;
      expect(s.initialized).toBe(true);
      expect(s.received.map((m) => m.method)).toEqual(['server/discover', 'initialize', 'notifications/initialized']);
      await client.listTools();
      // no modern _meta once legacy
      expect((s.received.at(-1)!.params as Record<string, unknown>)._meta).toBeUndefined();
    }
  });

  it('a modern server without a common version is an error, never a fallback to initialize', async () => {
    const { host, hs } = await connect('future');
    await expect(hs).rejects.toThrow(/does not support MCP 2026-07-28/);
    expect(host.servers.get('s')!.received.some((m) => m.method === 'initialize')).toBe(false);
  });

  it('cancel sends notifications/cancelled and drops the late answer; requests time out', async () => {
    const { host, client, hs } = await connect('modern');
    await hs;
    const ac = new AbortController();
    const call = client.callTool('slow', {}, ac.signal, 10_000);
    await tick();
    ac.abort();
    await expect(call).rejects.toMatchObject({ kind: 'cancelled' });
    const s = host.servers.get('s')!;
    const id = s.received.find((m) => m.method === 'tools/call')!.id;
    expect(s.cancelled).toEqual([id]);
    // the answer arriving afterwards is ignored
    s.reply(id, { result: { content: [] } });
    await tick();
    await expect(client.callTool('slow', {}, live(), 30)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('answers a legacy ping, refuses other server requests, ignores junk', async () => {
    const { host, client, hs } = await connect('legacy');
    await hs;
    const sent: unknown[] = [];
    const s = host.servers.get('s')!;
    const orig = host.send.bind(host);
    host.send = async (id, m) => (sent.push(m), orig(id, m));
    const emit = host.emitters.get('s')!;
    emit({ t: 'message', message: { jsonrpc: '2.0', id: 'p1', method: 'ping' }, bytes: 10 });
    emit({ t: 'message', message: { jsonrpc: '2.0', id: 'p2', method: 'sampling/createMessage', params: {} }, bytes: 10 });
    emit({ t: 'message', message: [1, 2, 3], bytes: 7 });
    emit({ t: 'invalid', reason: 'not JSON', bytes: 5 });
    await tick();
    expect(sent).toEqual([
      { jsonrpc: '2.0', id: 'p1', result: {} },
      { jsonrpc: '2.0', id: 'p2', error: { code: -32601, message: 'RealmNest does not support sampling/createMessage.' } },
    ]);
    expect(client.isOpen).toBe(true);
    expect(s).toBeTruthy();
  });

  it('a crash fails pending requests at once', async () => {
    const { host, client, hs } = await connect('modern');
    await hs;
    const call = client.callTool('slow', {}, live(), 10_000);
    await tick();
    host.crash('s');
    await expect(call).rejects.toMatchObject({ kind: 'closed' });
    await expect(client.listTools()).rejects.toMatchObject({ kind: 'closed' });
  });

  it('caps the number of tools and pages', async () => {
    const many = Array.from({ length: MCP_LIMITS.maxTools + 50 }, (_, i) => ({ name: `t${i}`, inputSchema: SCHEMA() }));
    const host = new FakeHost();
    host.behaviours.set('big', { era: 'modern', tools: many, page: 100 });
    const client = new McpClient('s', host, { clientInfo: { name: 'N', version: '1' } });
    await client.connect({ serverId: 's', command: 'big', args: [], env: {}, secretEnv: {} });
    expect(await client.listTools()).toHaveLength(MCP_LIMITS.maxTools);
  });
});

// ── manager: lifecycle, registry, runtime ────────────────────

describe('McpClientManager', () => {
  it('validates the form like the native host will', () => {
    expect(validateServerInput(input())).toBeUndefined();
    expect(validateServerInput(input({ command: '' }))).toMatch(/executable/);
    expect(validateServerInput(input({ command: 'npx -y server' }))).toMatch(/Arguments field/);
    expect(validateServerInput(input({ args: ['a\nb'] }))).toMatch(/single lines/);
    expect(validateServerInput(input({ env: { 'BAD-NAME': 'x' } }))).toMatch(/not a valid variable/);
    expect(validateServerInput(input({ env: { TOKEN: 'x' }, secretEnv: ['TOKEN'] }))).toMatch(/twice/);
  });

  it('persists configs, never secret values; status comes from the real connection', async () => {
    const s = await rig();
    const c = await s.mcp.add(input({ secretEnv: ['API_TOKEN'], secretValues: { API_TOKEN: 'tok-123' }, env: { MODE: 'headless' } }));
    expect(c).toMatchObject({ key: 'photocraft', transport: 'stdio', startup: 'manual', enabledTools: [], origin: 'user' });
    expect(s.mcp.state(c.id).status).toBe('disconnected');
    expect(s.vault.values.get(`mcp.${c.id}.API_TOKEN`)).toBe('tok-123');
    const stored = JSON.stringify(await s.storage.get('mcp-servers'));
    expect(stored).toContain('API_TOKEN');
    expect(stored).not.toContain('tok-123');
    expect(await s.mcp.secretStatus(c.id)).toEqual({ API_TOKEN: true });

    // restart: configs come back disconnected (never assumed connected), manual ones are not started
    const again = await rig(s.storage, new FakeHost(), s.vault);
    expect(again.mcp.list().map((x) => x.name)).toEqual(['PhotoCraft']);
    expect(again.mcp.state(c.id).status).toBe('disconnected');
    expect(again.host.starts).toBe(0);
  });

  it('a missing secret is auth_required; a missing executable is unavailable', async () => {
    const s = await rig();
    const a = await s.mcp.add(input({ secretEnv: ['API_TOKEN'] }));
    expect((await s.mcp.connect(a.id)).status).toBe('auth_required');
    expect(s.host.starts).toBe(0);
    const b = await s.mcp.add(input({ name: 'Ghost', command: 'ghost' }));
    expect(await s.mcp.connect(b.id)).toMatchObject({ status: 'unavailable', error: expect.stringContaining('not found') });
  });

  it('connects, discovers, and registers only the tools the user turned on', async () => {
    const s = await rig();
    const c = await s.mcp.add(input());
    const st = await s.mcp.connect(c.id);
    expect(st).toMatchObject({ status: 'connected', era: 'modern', protocolVersion: '2026-07-28', serverInfo: { name: 'fakecraft' } });
    expect(st.tools).toHaveLength(PHOTO_TOOLS.length);
    expect(s.registry.list({ source: 'mcp' })).toEqual([]);
    await s.mcp.setTools(c.id, ['doc_open', 'doc_inspect'], true);
    expect(s.registry.list({ source: 'mcp' }).map((t) => t.id)).toEqual(['mcp.photocraft.doc_inspect', 'mcp.photocraft.doc_open']);
    expect(s.registry.available('mcp.photocraft.doc_open')).toBe(true);
    await s.mcp.setTools(c.id, ['doc_inspect'], false);
    expect(s.registry.get('mcp.photocraft.doc_inspect')).toBeUndefined();
  });

  it('MCP tools run through the same ToolRuntime: ask → approve → tools/call; deny never reaches the server', async () => {
    const s = await rig();
    const c = await s.mcp.add(input());
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['doc_open', 'doc_inspect'], true);
    const scope = { runId: 'r1', agentId: 'victor', allowedToolIds: ['mcp.photocraft.doc_open', 'mcp.photocraft.doc_inspect'], requester: 'Victor' };
    const server = () => s.host.servers.get(c.id)!;
    const calls = () => server().received.filter((m) => m.method === 'tools/call');

    // ask by default: nothing is sent before the user answers
    const p = s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 'in/photo.png' } }, scope, live());
    await until(() => s.runtime.approvals().length === 1);
    expect(s.runtime.approvals()[0].call.toolId).toBe('mcp.photocraft.doc_open');
    expect(calls()).toHaveLength(0);
    s.runtime.decide(s.runtime.approvals()[0].call.id, 'once');
    const { call, result } = await p;
    expect(call.status).toBe('completed');
    expect(result.content).toBe('opened in/photo.png');
    expect(calls()).toHaveLength(1);
    expect((calls()[0].params as Record<string, unknown>).arguments).toEqual({ path: 'in/photo.png' });

    // invalid input is refused by RealmNest's schema check before the server sees it
    expect((await s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 1 } }, scope, live())).result.error?.code).toBe('INVALID_TOOL_INPUT');
    // deny: refused in RealmNest
    await s.policy.setGlobal('mcp.photocraft.doc_open', 'deny');
    expect((await s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 'x' } }, scope, live())).call.status).toBe('denied');
    // a denied approval: refused in RealmNest too
    const q = s.runtime.execute({ name: 'photocraft__doc_inspect', input: { index: null } }, scope, live());
    await until(() => s.runtime.approvals().length === 1);
    s.runtime.decide(s.runtime.approvals()[0].call.id, 'deny');
    expect((await q).result.error?.code).toBe('APPROVAL_DENIED');
    expect(calls()).toHaveLength(1);

    // allowed: runs at once, structured content comes back
    await s.policy.setGlobal('mcp.photocraft.doc_inspect', 'allow');
    const r = await s.runtime.execute({ name: 'photocraft__doc_inspect', input: {} }, scope, live());
    expect(r.result).toMatchObject({ success: true, structuredData: { layers: ['Background', 'Logo'] } });
    // the call history is the ordinary one
    expect(s.runtime.list({ runId: 'r1' }).map((x) => x.toolId)).toContain('mcp.photocraft.doc_inspect');
  });

  it('cancellation reaches the server; a crash marks the server failed and its tools unavailable', async () => {
    const s = await rig();
    const c = await s.mcp.add(input());
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['slow', 'doc_open'], true);
    await s.policy.setGlobal('mcp.photocraft.slow', 'allow');
    await s.policy.setGlobal('mcp.photocraft.doc_open', 'allow');
    const scope = { runId: 'r1', allowedToolIds: ['mcp.photocraft.slow', 'mcp.photocraft.doc_open'], requester: 'Chat' };
    const ac = new AbortController();
    const p = s.runtime.execute({ name: 'photocraft__slow', input: {} }, scope, ac.signal);
    await until(() => (s.host.servers.get(c.id)?.received ?? []).some((m) => m.method === 'tools/call'));
    ac.abort();
    expect((await p).call.status).toBe('cancelled');
    await until(() => s.host.servers.get(c.id)!.cancelled.length === 1);

    // a call in flight when the process dies fails cleanly
    const q = s.runtime.execute({ name: 'photocraft__slow', input: {} }, scope, live());
    await until(() => s.host.servers.get(c.id)!.received.filter((m) => m.method === 'tools/call').length === 2);
    s.host.crash(c.id);
    expect((await q).result.error).toMatchObject({ code: 'TOOL_UNAVAILABLE' });
    expect(s.mcp.state(c.id)).toMatchObject({ status: 'failed', error: expect.stringContaining('stopped unexpectedly') });
    // still listed (agents keep their ticks), not runnable
    expect(s.registry.get('mcp.photocraft.doc_open')).toBeDefined();
    expect(s.registry.available('mcp.photocraft.doc_open')).toBe(false);
    expect((await s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 'x' } }, scope, live())).result.error?.code).toBe('TOOL_UNAVAILABLE');
    // reconnect: runnable again
    expect((await s.mcp.connect(c.id)).status).toBe('connected');
    expect(s.registry.available('mcp.photocraft.doc_open')).toBe(true);
  });

  it('reconnect rediscovers: removed tools go, changed schemas are replaced, never called with the old one', async () => {
    const s = await rig();
    const c = await s.mcp.add(input());
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['doc_open', 'boom'], true);
    await s.mcp.disconnect(c.id);
    expect(s.mcp.state(c.id).status).toBe('stopped');
    expect(s.registry.available('mcp.photocraft.doc_open')).toBe(false);
    // the server changes: doc_open takes `file` now, boom is gone
    s.host.behaviours.set('photocraft', { era: 'modern', tools: [{ name: 'doc_open', description: 'Open v2.', inputSchema: SCHEMA({ file: { type: 'string' } }, ['file']) }] });
    await s.mcp.connect(c.id);
    expect(s.registry.get('mcp.photocraft.boom')).toBeUndefined();
    expect(s.registry.get('mcp.photocraft.doc_open')!.inputSchema.required).toEqual(['file']);
    await s.policy.setGlobal('mcp.photocraft.doc_open', 'allow');
    const scope = { runId: 'r', allowedToolIds: ['mcp.photocraft.doc_open'], requester: 'Chat' };
    // the old shape is refused by the new schema before reaching the server
    expect((await s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 'a.png' } }, scope, live())).result.error?.code).toBe('INVALID_TOOL_INPUT');
    expect((await s.runtime.execute({ name: 'photocraft__doc_open', input: { file: 'a.png' } }, scope, live())).call.status).toBe('completed');
  });

  it('a list_changed notification refreshes the tools', async () => {
    const s = await rig();
    const c = await s.mcp.add(input({ name: 'Legacy', command: 'legacy' }));
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['echo', 'echo2'], true);
    expect(s.registry.get('mcp.legacy.echo2')).toBeUndefined();
    s.host.servers.get(c.id)!.b.tools.push({ name: 'echo2', inputSchema: SCHEMA() });
    s.host.emitters.get(c.id)!({ t: 'message', message: { jsonrpc: '2.0', method: 'notifications/tools/list_changed' }, bytes: 50 });
    await until(() => !!s.registry.get('mcp.legacy.echo2'));
  });

  it('several servers coexist; stopping one leaves the other working', async () => {
    const s = await rig();
    const a = await s.mcp.add(input());
    const b = await s.mcp.add(input({ name: 'EffectCraft', command: 'effectcraft' }));
    await s.mcp.connect(a.id);
    await s.mcp.connect(b.id);
    await s.mcp.setTools(a.id, ['doc_open'], true);
    await s.mcp.setTools(b.id, ['doc_open', 'get_project'], true);
    // same MCP name on two servers: different ids and model names
    expect(s.registry.get('mcp.photocraft.doc_open')!.name).toBe('photocraft__doc_open');
    expect(s.registry.get('mcp.effectcraft.doc_open')!.name).toBe('effectcraft__doc_open');
    await s.mcp.disconnect(a.id);
    expect(s.registry.available('mcp.photocraft.doc_open')).toBe(false);
    expect(s.registry.available('mcp.effectcraft.get_project')).toBe(true);
    await s.policy.setGlobal('mcp.effectcraft.get_project', 'allow');
    const r = await s.runtime.execute({ name: 'effectcraft__get_project', input: {} }, { runId: 'r', allowedToolIds: ['mcp.effectcraft.get_project'], requester: 'Chat' }, live());
    expect(r.call.status).toBe('completed');
  });

  it('enabled tools are listed after a restart (unavailable until connected); remove keeps history', async () => {
    const s = await rig();
    const c = await s.mcp.add(input());
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['doc_open'], true);
    const again = await rig(s.storage, new FakeHost(), s.vault);
    expect(again.registry.get('mcp.photocraft.doc_open')).toBeDefined();
    expect(again.registry.available('mcp.photocraft.doc_open')).toBe(false);
    await again.mcp.remove(c.id);
    expect(again.registry.get('mcp.photocraft.doc_open')).toBeUndefined();
    expect(again.mcp.list()).toEqual([]);
  });

  it('auto-start servers start with RealmNest; manual ones never do', async () => {
    const s = await rig();
    const a = await s.mcp.add(input({ startup: 'auto' }));
    await s.mcp.add(input({ name: 'Manual', command: 'effectcraft' }));
    const again = await rig(s.storage, new FakeHost(), s.vault);
    await until(() => again.mcp.state(a.id).status === 'connected');
    expect(again.host.launches.map((l) => l.command)).toEqual(['photocraft']);
  });

  it('events and traffic carry no payloads or secrets', async () => {
    const s = await rig();
    const c = await s.mcp.add(input({ secretEnv: ['API_TOKEN'], secretValues: { API_TOKEN: 'tok-secret-999' }, env: { MODE: 'x' } }));
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['doc_open'], true);
    await s.policy.setGlobal('mcp.photocraft.doc_open', 'allow');
    await s.runtime.execute({ name: 'photocraft__doc_open', input: { path: 'private/photo.png' } }, { runId: 'r', allowedToolIds: ['mcp.photocraft.doc_open'], requester: 'Chat' }, live());
    expect(s.host.launches[0].secretEnv).toEqual({ API_TOKEN: `mcp.${c.id}.API_TOKEN` });
    const log = JSON.stringify(s.bus.log) + JSON.stringify(s.mcp.traffic(c.id));
    expect(log).not.toContain('tok-secret-999');
    expect(log).not.toContain('private/photo.png');
    expect(s.mcp.traffic(c.id).map((t) => t.what)).toEqual(expect.arrayContaining(['server/discover', 'tools/list', 'tools/call', 'result tools/call #3']));
  });
});

// ── agents and chat through OpenRouter ───────────────────────

class OrHost implements OpenRouterTransport {
  readonly available = true;
  requests: OrChatRequest[] = [];
  constructor(private turn: (req: OrChatRequest) => OrStreamEvent[]) {}
  async validate() {
    return { status: 'connected' as const, message: 'ok' };
  }
  async models() {
    return [];
  }
  async chat(_c: string, request: OrChatRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push(structuredClone(request));
    const events = this.turn(request);
    setTimeout(() => events.forEach(onEvent), 0);
    return `or${this.requests.length}`;
  }
  async cancel() {
    return true;
  }
}

describe('MCP tools for agents and chat (OpenRouter)', () => {
  const inspectTurn = (req: OrChatRequest): OrStreamEvent[] => {
    const tool = req.messages.find((m) => m.role === 'tool');
    if (!req.tools?.length) return [{ t: 'start', model: req.model }, { t: 'delta', d: 'no tools' }, { t: 'done', finishReason: 'stop' }];
    if (!tool) return [{ t: 'start', model: req.model }, { t: 'tool', id: 'c1', name: 'photocraft__doc_inspect', args: '{}' }, { t: 'done', finishReason: 'tool_calls' }];
    return [{ t: 'start', model: req.model }, { t: 'delta', d: `Layers: ${JSON.parse(String(tool.content)).content}` }, { t: 'done', finishReason: 'stop' }];
  };

  async function app() {
    const s = await rig();
    const or = new OrHost(inspectTurn);
    const providers = new ProviderService(new ProviderRegistry(), s.bus, (id) => (id === 'or' ? new OpenRouterProvider('or', or) : undefined));
    const tools = new ToolService(s.registry, s.runtime, s.policy, new ToolLoop(providers, s.runtime, s.registry), () => true);
    const live2 = new LiveRuntime(s.bus, providers, new RuntimeRepository(s.storage, 5), { identity: () => ({ name: 'Victor', role: 'Designer' }), defaultConnection: () => 'or', tools });
    const chat = new ConversationRuntime(s.bus, providers, new ConversationRepository(s.storage, 5), { agent: (id) => live2.agent(id), identity: () => ({ name: 'Victor', role: 'Designer' }), tools });
    await live2.init();
    await chat.init();
    const c = await s.mcp.add(input());
    await s.mcp.connect(c.id);
    await s.mcp.setTools(c.id, ['doc_open', 'doc_inspect'], true);
    return { ...s, or, tools, live: live2, chat, server: c };
  }

  it('an agent uses an MCP tool exactly like a native one (approval, then tools/call)', async () => {
    const s = await app();
    s.live.updateAgent('alex', { connectionId: 'or', model: 'vendor/tools:free', allowedToolIds: ['mcp.photocraft.doc_inspect'] });
    const { run } = s.live.startTask('alex', { prompt: 'Inspect the layers.' });
    await until(() => s.runtime.approvals().length === 1);
    expect(s.runtime.approvals()[0]).toMatchObject({ call: { toolId: 'mcp.photocraft.doc_inspect' } });
    s.runtime.decide(s.runtime.approvals()[0].call.id, 'once');
    await until(() => s.live.getRun(run.id)!.status === 'completed');
    expect(s.live.getRun(run.id)!.result).toBe('Layers: {"layers":["Background","Logo"]}');
    expect(s.or.requests[0].tools!.map((t) => t.function.name)).toEqual(['photocraft__doc_inspect']);
    // `$schema` is not sent to the provider
    expect(JSON.stringify(s.or.requests[0].tools)).not.toContain('$schema');
  });

  it('a chat with tools on offers the enabled MCP tools; off offers none', async () => {
    const s = await app();
    await s.policy.setGlobal('mcp.photocraft.doc_inspect', 'allow');
    const conv = s.chat.create({ connectionId: 'or', model: 'vendor/tools:free' });
    s.chat.send(conv.id, 'layers?');
    await until(() => !s.chat.isBusy(conv.id));
    expect(s.or.requests[0].tools).toBeUndefined();
    s.chat.setTools(conv.id, true);
    s.chat.send(conv.id, 'layers now?');
    await until(() => !s.chat.isBusy(conv.id));
    expect(s.or.requests[1].tools!.map((t) => t.function.name)).toEqual(['get_current_time', 'photocraft__doc_inspect', 'photocraft__doc_open']);
    expect(s.chat.get(conv.id)!.messages.at(-1)!.content).toBe('Layers: {"layers":["Background","Logo"]}');
  });

  it(`never offers more than ${MAX_OFFERED_TOOLS} tools, and says how many were left out`, async () => {
    const s = await app();
    const many = Array.from({ length: 50 }, (_, i) => ({ name: `op_${i}`, inputSchema: SCHEMA() }));
    s.host.behaviours.set('bulk', { era: 'modern', tools: many });
    const b = await s.mcp.add(input({ name: 'Bulk', command: 'bulk' }));
    await s.mcp.connect(b.id);
    await s.mcp.setTools(b.id, many.map((t) => t.name), true);
    const offer = s.tools.offer('or', 'm', undefined);
    expect(offer.ids).toHaveLength(MAX_OFFERED_TOOLS);
    expect(offer.ids[0]).toBe('get_current_time');
    expect(offer.capped).toBe(1 + 2 + 50 - MAX_OFFERED_TOOLS);
  });
});

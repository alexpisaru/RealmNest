import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { ToolDefinition } from '../domain/tool';
import { MemoryAdapter } from '../persistence/storage';
import { bridgeAlias, BRIDGE_PREFIX, McpBridge, toCallToolResult, type BridgeEvent, type BridgeTransport } from '../runtime/mcp/bridge';
import { BRIDGE_PROMPT, checkClaudeArgs, turnArgs } from '../runtime/providers/claude-code/args';
import { CLAUDE_CODE_CAPABILITIES } from '../runtime/providers/claude-code/provider';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';
import { realmnestReadiness } from '../runtime/capabilities/readiness';
import { ToolLoop } from '../runtime/tools/loop';
import { ToolPolicyStore } from '../runtime/tools/policy';
import { ToolRegistry, type ToolExecutor } from '../runtime/tools/registry';
import { ToolRuntime, type ToolScope } from '../runtime/tools/runtime';
import { ToolService } from '../runtime/tools/service';

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean, n = 600) => {
  for (let i = 0; i < n && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};
const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };

/** the Rust relay, faked: plays Claude's side of the connection */
class FakeRelay implements BridgeTransport {
  readonly available = true;
  sessions = new Map<string, (e: BridgeEvent) => void>();
  replies = new Map<string, Record<string, unknown>[]>();
  closed: string[] = [];
  async open(id: string, onEvent: (e: BridgeEvent) => void) {
    this.sessions.set(id, onEvent);
    this.replies.set(id, []);
    return { configPath: `C:\\RealmNest\\realmnest-bridge\\${id}.json` };
  }
  async send(id: string, message: object) {
    this.replies.get(id)!.push(message as Record<string, unknown>);
  }
  async close(id: string) {
    this.closed.push(id);
    this.sessions.get(id)?.({ t: 'closed' });
    this.sessions.delete(id);
  }
  /** Claude sends a request; resolves with RealmNest's answer */
  async request(id: string, rid: number, method: string, params: Record<string, unknown> = {}) {
    this.sessions.get(id)!({ t: 'message', message: { jsonrpc: '2.0', id: rid, method, params: { ...params, _meta: META } } });
    await until(() => this.replies.get(id)!.some((r) => r.id === rid));
    return this.replies.get(id)!.find((r) => r.id === rid)!;
  }
  notify(id: string, method: string, params: Record<string, unknown>) {
    this.sessions.get(id)!({ t: 'message', message: { jsonrpc: '2.0', method, params } });
  }
}

const def = (id: string, over: Partial<ToolDefinition> = {}): ToolDefinition => ({
  id,
  name: id,
  description: `The ${id} tool.`,
  source: 'native',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, additionalProperties: false },
  risk: 'low',
  permissions: {},
  cancellable: true,
  timeoutMs: 2_000,
  ...over,
});

async function rig() {
  const bus = new EventBus(2000);
  const storage = new MemoryAdapter();
  const registry = new ToolRegistry();
  const ran: string[] = [];
  const exec: ToolExecutor = async ({ input, callId }) => (ran.push(callId), { success: true, content: `echo ${String(input.text)}` });
  const hang: ToolExecutor = ({ signal }) => new Promise((r) => signal.addEventListener('abort', () => r({ success: false })));
  registry.register(def('echo'), exec);
  registry.register(def('write_note', { risk: 'medium' }), exec);
  registry.register(def('slow'), hang);
  registry.register(def('secret'), exec);
  registry.register(
    def('mcp.photocraft.render_preview', { name: 'photocraft__render_preview', source: 'mcp', risk: 'medium', permissions: { default: 'allow' } }),
    async () => ({ success: true, content: '[image image/png, 1 KB]', parts: [{ type: 'image', mimeType: 'image/png', bytes: 3, data: 'AAAA' }] }),
  );
  const policy = new ToolPolicyStore(storage, bus);
  await policy.init();
  const runtime = new ToolRuntime(registry, policy, bus, storage);
  await runtime.init();
  const relay = new FakeRelay();
  const bridge = new McpBridge(relay, runtime, registry, { name: 'realmnest', version: 't' });
  return { bus, registry, policy, runtime, relay, bridge, ran };
}
const scope = (over: Partial<ToolScope> = {}): ToolScope => ({ runId: 'run-1', agentId: 'alex', allowedToolIds: ['echo', 'write_note', 'slow', 'mcp.photocraft.render_preview'], requester: 'Alex', ...over });

describe('RealmNest MCP bridge (Claude Code)', () => {
  it('answers like a modern MCP server and lists only the run’s tools', async () => {
    const s = await rig();
    const session = await s.bridge.open(scope());
    expect(session.toolNames).toEqual(['mcp__realmnest__echo', 'mcp__realmnest__write_note', 'mcp__realmnest__slow', 'mcp__realmnest__photocraft__render_preview']);
    const discover = await s.relay.request(session.id, 1, 'server/discover');
    expect(discover.result).toMatchObject({ resultType: 'complete', supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']), capabilities: { tools: {} } });
    const list = (await s.relay.request(session.id, 2, 'tools/list')).result as { tools: { name: string }[]; ttlMs: number; resultType: string };
    // Claude Code requires ttlMs on tools/list
    expect(list).toMatchObject({ resultType: 'complete', ttlMs: 0, cacheScope: 'private' });
    expect(list.tools.map((t) => t.name)).toEqual(['echo', 'write_note', 'slow', 'photocraft__render_preview']);
    // a tool outside the run does not exist for Claude
    expect((await s.relay.request(session.id, 3, 'tools/call', { name: 'secret', arguments: {} })).error).toMatchObject({ code: -32602 });
    expect(s.ran).toEqual([]);
  });

  it('every call goes through ToolRuntime: allowed runs, ask waits for the user, deny never runs', async () => {
    const s = await rig();
    const session = await s.bridge.open(scope());
    const ok = await s.relay.request(session.id, 1, 'tools/call', { name: 'echo', arguments: { text: 'hi' } });
    expect(ok.result).toMatchObject({ resultType: 'complete', isError: false, content: [{ type: 'text', text: 'echo hi' }] });

    // medium risk: asks; nothing runs until the user answers
    const pending = s.relay.request(session.id, 2, 'tools/call', { name: 'write_note', arguments: { text: 'note' } });
    await until(() => s.runtime.approvals().length === 1);
    expect(s.runtime.approvals()[0]).toMatchObject({ requester: 'Alex', call: { toolId: 'write_note', providerCallId: 'bridge-2' } });
    expect(s.ran).toHaveLength(1);
    s.runtime.decide(s.runtime.approvals()[0].call.id, 'deny');
    expect((await pending).result).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('APPROVAL_DENIED') }] });
    expect(s.ran).toHaveLength(1);

    // never: refused in RealmNest
    await s.policy.setGlobal('echo', 'deny');
    expect((await s.relay.request(session.id, 3, 'tools/call', { name: 'echo', arguments: { text: 'x' } })).result).toMatchObject({ isError: true });
    // bad input: refused by the schema
    expect(((await s.relay.request(session.id, 4, 'tools/call', { name: 'write_note', arguments: { text: 1 } })).result as { content: { text: string }[] }).content[0].text).toMatch(/INVALID_TOOL_INPUT/);
    expect(s.ran).toHaveLength(1);
    // the calls are in the ordinary history
    expect(s.runtime.list({ runId: 'run-1' }).map((c) => c.status)).toEqual(expect.arrayContaining(['completed', 'denied']));
  });

  it('images from tools go to Claude as image content', async () => {
    const s = await rig();
    const session = await s.bridge.open(scope());
    const r = await s.relay.request(session.id, 1, 'tools/call', { name: 'photocraft__render_preview', arguments: {} });
    expect((r.result as { content: unknown[] }).content).toEqual([{ type: 'text', text: '[image image/png, 1 KB]' }, { type: 'image', data: 'AAAA', mimeType: 'image/png' }]);
  });

  it('Claude’s cancellation and the end of the run stop the call', async () => {
    const s = await rig();
    const session = await s.bridge.open(scope());
    s.relay.sessions.get(session.id)!({ t: 'message', message: { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'slow', arguments: {}, _meta: META } } });
    await until(() => s.runtime.list().some((c) => c.toolId === 'slow' && c.status === 'running'));
    s.relay.notify(session.id, 'notifications/cancelled', { requestId: 9 });
    await until(() => s.runtime.list().some((c) => c.toolId === 'slow' && c.status === 'cancelled'));
    // no answer is sent for a cancelled request
    expect(s.relay.replies.get(session.id)!.some((r) => r.id === 9)).toBe(false);
    // a call waiting for approval ends when the session closes
    s.relay.sessions.get(session.id)!({ t: 'message', message: { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'write_note', arguments: {}, _meta: META } } });
    await until(() => s.runtime.approvals().length === 1);
    await session.close();
    await until(() => s.runtime.approvals().length === 0);
    expect(s.relay.closed).toEqual([session.id]);
  });

  it('long tool names stay within Claude’s 64 characters', () => {
    const t = def('mcp.photocraft.x', { name: `photocraft__${'a'.repeat(52)}` });
    expect((BRIDGE_PREFIX + bridgeAlias(t)).length).toBeLessThanOrEqual(64);
    expect(bridgeAlias(def('echo'))).toBe('echo');
    expect(toCallToolResult({ toolCallId: 'x', success: false, error: { code: 'TOOL_TIMEOUT', message: 'slow' } })).toEqual({ content: [{ type: 'text', text: 'RealmNest: slow (TOOL_TIMEOUT)' }], isError: true });
  });
});

describe('Claude Code with the bridge', () => {
  it('builds allowlisted arguments: RealmNest’s config, only its tools, built-ins off', () => {
    const args = turnArgs({ tools: [], bridge: { configPath: 'C:\\Users\\me\\AppData\\Local\\app.nestra.desktop\\realmnest-bridge\\br-run-1.json', tools: ['mcp__realmnest__echo'] } });
    expect(checkClaudeArgs(args)).toBeNull();
    expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config', '--permission-prompts', 'none', '--mcp-config', '--allowedTools', 'mcp__realmnest__echo']));
    expect(args.slice(-2)).toEqual(['--tools', '']);
    expect(args[args.indexOf('--system-prompt') + 1]).toContain(BRIDGE_PROMPT);
    // Claude's own MCP sources or other tools are never allowed
    expect(checkClaudeArgs(args.map((a) => (a === 'mcp__realmnest__echo' ? 'Bash' : a)))).toMatch(/invalid value/);
    expect(checkClaudeArgs(args.filter((a) => a !== '--strict-mcp-config'))).toMatch(/strict-mcp-config/);
  });

  it('tools.calling is ready for Claude through the bridge (desktop only)', () => {
    expect(realmnestReadiness('tools.calling', CLAUDE_CODE_CAPABILITIES)).toMatchObject({ ready: true, note: expect.stringContaining('bridge') });
  });

  it('a bridged run opens a session for exactly that run and closes it at the end', async () => {
    const s = await rig();
    // a provider that, like Claude Code, runs its own loop and calls the bridge
    const seen: ProviderTurnRequest[] = [];
    const claude: AIProvider = {
      id: 'claude-code',
      name: 'Claude Code',
      capabilities: { ...CLAUDE_CODE_CAPABILITIES },
      getStatus: async () => ({ state: 'available', message: 'ok', checkedAt: 0 }),
      async *runTurn(req) {
        seen.push(req);
        const sid = [...s.relay.sessions.keys()][0];
        const r = await s.relay.request(sid, 1, 'tools/call', { name: 'echo', arguments: { text: 'from claude' } });
        const text = ((r.result as { content: { text: string }[] }).content[0].text);
        yield { type: 'run.completed', text: `Claude says: ${text}`, runId: req.runId, providerId: 'claude-code', seq: 1, at: 0 } as ProviderEvent;
      },
    };
    const providers = new ProviderService(new ProviderRegistry().register(claude), s.bus);
    const service = new ToolService(s.registry, s.runtime, s.policy, new ToolLoop(providers, s.runtime, s.registry), () => 'bridge', { bridge: s.bridge, providers });
    expect(service.modeFor('claude-code')).toBe('bridge');
    expect(service.offer('claude-code', undefined, ['echo']).ids).toEqual(['echo']);
    const run = service.run('claude-code', { runId: 'run-7', messages: [{ role: 'user', content: 'go' }] }, scope({ runId: 'run-7', allowedToolIds: ['echo'] }), () => undefined);
    const end = await run.done;
    expect(end).toMatchObject({ type: 'run.completed', text: 'Claude says: echo from claude' });
    expect(seen[0].realmnestBridge).toEqual({ configPath: expect.stringContaining('realmnest-bridge'), tools: ['mcp__realmnest__echo'] });
    expect(s.relay.closed).toHaveLength(1);
    expect(s.runtime.list({ runId: 'run-7' })[0]).toMatchObject({ toolId: 'echo', status: 'completed', providerCallId: 'bridge-1' });
  });

  it('without the desktop bridge Claude gets no tools (honest "model" reason)', async () => {
    const s = await rig();
    const providers = new ProviderService(new ProviderRegistry(), s.bus);
    const offline = new McpBridge({ available: false, open: async () => ({ configPath: '' }), send: async () => {}, close: async () => {} }, s.runtime, s.registry);
    const service = new ToolService(s.registry, s.runtime, s.policy, new ToolLoop(providers, s.runtime, s.registry), () => 'bridge', { bridge: offline, providers });
    expect(service.offer('claude-code', undefined, ['echo'])).toMatchObject({ ids: [], reason: 'model' });
  });
});

describe('bridge results', () => {
  it('Claude gets the whole text; a structured summary goes along only with an output schema', () => {
    const r = { toolCallId: 'x', success: true, content: 'RealmNest skill runtime successful.', structuredData: { path: 'a.txt', bytes: 31 } };
    expect(toCallToolResult(r)).toEqual({ content: [{ type: 'text', text: 'RealmNest skill runtime successful.' }], isError: false });
    expect(toCallToolResult(r, true)).toMatchObject({ structuredContent: { path: 'a.txt', bytes: 31 } });
  });
});

// docs/HARDENING.md R-5: the bridge keeps the ToolLoop's limits
describe('bridge limits', () => {
  const call = async (s: Awaited<ReturnType<typeof rig>>, sid: string, rid: number, name: string, text: string) =>
    (await s.relay.request(sid, rid, 'tools/call', { name, arguments: { text } })).result as { isError: boolean; content: { text: string }[] };

  it('the same call a third time, an 11th call, three failures in a row: refused, and the run is told to stop', async () => {
    const s = await rig();
    s.registry.register(def('boom'), async () => ({ success: false, error: { code: 'TOOL_EXECUTION_FAILED', message: 'boom' } }));
    const limits: string[] = [];
    const a = await s.bridge.open(scope(), (m) => limits.push(m));
    expect((await call(s, a.id, 1, 'echo', 'same')).isError).toBe(false);
    expect((await call(s, a.id, 2, 'echo', 'same')).isError).toBe(false);
    const third = await call(s, a.id, 3, 'echo', 'same');
    expect(third).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('TOOL_CALL_LIMIT_REACHED') }] });
    // every later call is refused too; nothing more runs
    expect((await call(s, a.id, 4, 'echo', 'other')).isError).toBe(true);
    expect(s.ran).toHaveLength(2);
    expect(limits).toHaveLength(1);
    const b = await s.bridge.open(scope({ runId: 'run-2' }), (m) => limits.push(m));
    for (let i = 1; i <= 10; i++) expect((await call(s, b.id, i, 'echo', `n${i}`)).isError).toBe(false);
    expect((await call(s, b.id, 11, 'echo', 'n11')).content[0].text).toContain('more than 10 tool calls');
    const c = await s.bridge.open(scope({ runId: 'run-3', allowedToolIds: ['boom', 'echo'] }), (m) => limits.push(m));
    for (let i = 1; i <= 3; i++) await call(s, c.id, i, 'boom', `x${i}`);
    expect(limits.at(-1)).toContain('3 tool calls in a row failed');
    expect((await call(s, c.id, 4, 'echo', 'fine')).isError).toBe(true);
    expect(limits).toHaveLength(3);
  });

  it('a bridged run over the limit is stopped and ends failed (tool_call_limit), not cancelled', async () => {
    const s = await rig();
    const claude: AIProvider = {
      id: 'claude-code',
      name: 'Claude Code',
      capabilities: { ...CLAUDE_CODE_CAPABILITIES },
      getStatus: async () => ({ state: 'available', message: 'ok', checkedAt: 0 }),
      async *runTurn(req) {
        const sid = [...s.relay.sessions.keys()][0];
        for (let i = 1; i <= 3 && !req.abortSignal?.aborted; i++) await s.relay.request(sid, i, 'tools/call', { name: 'echo', arguments: { text: 'again' } });
        await tick();
        yield { type: req.abortSignal?.aborted ? 'run.cancelled' : 'run.completed', text: 'went on', reason: 'Cancelled.', runId: req.runId, providerId: 'claude-code', seq: 1, at: 0 } as ProviderEvent;
      },
    };
    const providers = new ProviderService(new ProviderRegistry().register(claude), s.bus);
    const service = new ToolService(s.registry, s.runtime, s.policy, new ToolLoop(providers, s.runtime, s.registry), () => 'bridge', { bridge: s.bridge, providers });
    const events: ProviderEvent[] = [];
    const end = await service.run('claude-code', { runId: 'run-9', messages: [{ role: 'user', content: 'go' }] }, scope({ runId: 'run-9', allowedToolIds: ['echo'] }), (e) => events.push(e)).done;
    expect(end).toMatchObject({ type: 'run.failed', error: { code: 'tool_call_limit' } });
    expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'tool_call_limit' } });
    expect(s.ran).toHaveLength(2);
  });
});

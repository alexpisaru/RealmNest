import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { ToolDefinition, ToolPermission } from '../domain/tool';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { OpenRouterProvider } from '../runtime/providers/openrouter/provider';
import type { OpenRouterTransport, OrChatRequest, OrStreamEvent } from '../runtime/providers/openrouter/transport';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';
import { DEFAULT_TOOL_LIMITS, resultForModel, ToolLoop } from '../runtime/tools/loop';
import { FS_LIMITS, NATIVE_TOOLS, nativeExecutors, registerNativeTools, UnavailableToolHost, type DirEntry, type NativeOutcome, type NativeToolHost } from '../runtime/tools/native';
import { resolvePermission, ToolPolicyStore } from '../runtime/tools/policy';
import { ToolRegistry, ToolRegistryError, type ToolExecutor } from '../runtime/tools/registry';
import { MAX_KEPT_CHARS, ToolRuntime, type ToolScope } from '../runtime/tools/runtime';
import { checkSchema, validateInput } from '../runtime/tools/schema';
import { ToolService } from '../runtime/tools/service';

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean, n = 400) => {
  for (let i = 0; i < n && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};
const WS = 'C:\\RealmNest\\ws';

/** a workspace in memory, answering like the Rust commands do */
class MemoryFs implements NativeToolHost {
  readonly available = true;
  files = new Map<string, string>();
  calls: string[] = [];
  private bad(path: string): NativeOutcome<never> | undefined {
    if (/(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[a-z]:/i.test(path)) return { ok: false, error: { code: 'PATH_OUTSIDE_WORKSPACE', message: 'outside' } };
    return undefined;
  }
  async listDirectory(_ws: string, path: string) {
    this.calls.push(`list ${path}`);
    const no = this.bad(path);
    if (no) return no;
    const entries: DirEntry[] = [...this.files.keys()].map((name) => ({ name, kind: 'file' as const, size: this.files.get(name)!.length }));
    return { ok: true as const, value: { path, entries, truncated: false } };
  }
  async readText(_ws: string, path: string) {
    this.calls.push(`read ${path}`);
    const no = this.bad(path);
    if (no) return no;
    const content = this.files.get(path);
    if (content === undefined) return { ok: false as const, error: { code: 'FILE_NOT_FOUND' as const, message: `${path} does not exist.` } };
    return { ok: true as const, value: { path, content, bytes: content.length } };
  }
  async writeText(_ws: string, path: string, content: string) {
    this.calls.push(`write ${path}`);
    const no = this.bad(path);
    if (no) return no;
    const created = !this.files.has(path);
    this.files.set(path, content);
    return { ok: true as const, value: { path, bytes: content.length, created } };
  }
}

const tool = (over: Partial<ToolDefinition> = {}): ToolDefinition => ({
  id: 'echo',
  name: 'echo',
  description: 'Echoes text.',
  source: 'native',
  inputSchema: { type: 'object', properties: { text: { type: 'string', maxLength: 50 } }, required: ['text'], additionalProperties: false },
  risk: 'low',
  permissions: {},
  cancellable: true,
  timeoutMs: 1_000,
  ...over,
});
const echo: ToolExecutor = async ({ input }) => ({ success: true, content: String(input.text) });

async function rig(opts: { tools?: [ToolDefinition, ToolExecutor?][]; global?: Record<string, ToolPermission>; storage?: MemoryAdapter } = {}) {
  const bus = new EventBus(3000);
  const storage = opts.storage ?? new MemoryAdapter();
  const registry = new ToolRegistry();
  for (const [t, ex] of opts.tools ?? [[tool(), echo]]) registry.register(t, ex);
  const policy = new ToolPolicyStore(storage, bus);
  await policy.init();
  for (const [id, p] of Object.entries(opts.global ?? {})) await policy.setGlobal(id, p);
  const always: string[] = [];
  const runtime = new ToolRuntime(registry, policy, bus, storage, { onAlwaysAllow: (a, t) => always.push(`${a}:${t}`) });
  await runtime.init();
  return { bus, storage, registry, policy, runtime, always };
}
const scope = (over: Partial<ToolScope> = {}): ToolScope => ({ runId: 'run-1', agentId: 'alex', allowedToolIds: ['echo'], requester: 'Alex', ...over });
const live = () => new AbortController().signal;

// ── registry & schemas ───────────────────────────────────────

describe('ToolRegistry', () => {
  it('registers, finds and lists tools; refuses duplicates and bad definitions', () => {
    const r = new ToolRegistry().register(tool(), echo).register(tool({ id: 'plain', name: 'plain' }));
    expect(r.size).toBe(2);
    expect(r.byName('echo')?.id).toBe('echo');
    expect(r.available('echo')).toBe(true);
    expect(r.available('plain')).toBe(false); // listed, but nothing runs it here
    expect(r.list().map((t) => t.id)).toEqual(['echo', 'plain']);
    expect(r.list({ source: 'mcp' })).toEqual([]);
    expect(() => r.register(tool())).toThrow(ToolRegistryError);
    expect(() => r.register(tool({ id: 'other' }))).toThrow(/named "echo"/);
    expect(() => r.register(tool({ id: 'Bad-Id', name: 'x' }))).toThrow(/not a valid tool id/);
    expect(() => r.register(tool({ id: 'nots', name: 'nots', inputSchema: { type: 'string' } }))).toThrow(/must be an object/);
    expect(() => r.register(tool({ id: 'notime', name: 'notime', timeoutMs: 0 }))).toThrow(/timeout/);
    expect(r.unregister('plain')).toBe(true);
    expect(r.unregister('plain')).toBe(false);
  });

  it('gives providers only name, description and parameters', () => {
    const r = new ToolRegistry().register(tool({ metadata: { secret: 'x' } }), echo);
    expect(r.schemas(['echo', 'missing'])).toEqual([{ name: 'echo', description: 'Echoes text.', parameters: tool().inputSchema }]);
  });

  it('registers the native tools; file tools cannot run without the desktop host', () => {
    const r = registerNativeTools(new ToolRegistry(), new UnavailableToolHost());
    expect(r.list().map((t) => t.id)).toEqual(['get_current_time', 'list_directory', 'read_text_file', 'write_text_file']);
    expect(r.available('get_current_time')).toBe(true);
    expect(r.available('write_text_file')).toBe(false);
    expect(registerNativeTools(new ToolRegistry(), new MemoryFs()).available('write_text_file')).toBe(true);
    expect(NATIVE_TOOLS.find((t) => t.id === 'write_text_file')!.risk).toBe('medium');
  });
});

describe('input validation', () => {
  const schema = NATIVE_TOOLS.find((t) => t.id === 'write_text_file')!.inputSchema;
  it('accepts valid input and names the first problem otherwise', () => {
    expect(validateInput(schema, { path: 'a.txt', content: 'x' })).toBeUndefined();
    expect(validateInput(schema, { path: 'a.txt' })).toMatch(/content is required/);
    expect(validateInput(schema, { path: 1, content: 'x' })).toMatch(/path must be a string/);
    expect(validateInput(schema, { path: 'a', content: 'x', mode: 'append' })).toMatch(/mode is not a known parameter/);
    expect(validateInput(schema, { path: 'x'.repeat(FS_LIMITS.pathChars + 1), content: '' })).toMatch(/at most 512/);
    expect(validateInput(schema, [])).toMatch(/must be an object/);
    expect(validateInput({ type: 'object', properties: { n: { type: 'integer', minimum: 1 } } }, { n: 1.5 })).toMatch(/whole number/);
    expect(validateInput({ type: 'object', properties: { l: { type: 'array', maxItems: 1, items: { type: 'boolean' } } } }, { l: [true, 'x'] })).toMatch(/at most 1/);
  });
  it('checks schemas before a tool is registered', () => {
    expect(checkSchema({ type: 'object', properties: { 'bad name': { type: 'string' } } })).toMatch(/bad property/);
    expect(checkSchema({ type: 'object', required: ['x'] })).toMatch(/required x/);
    expect(checkSchema({ type: 'object', properties: {} })).toBeUndefined();
  });
});

describe('permissions', () => {
  it('agent beats global beats tool default beats risk; the ceiling and a global "never" cap everything', () => {
    const low = tool();
    const medium = tool({ risk: 'medium' });
    expect(resolvePermission(low, {})).toBe('allow');
    expect(resolvePermission(medium, {})).toBe('ask');
    expect(resolvePermission(tool({ risk: 'high' }), {})).toBe('ask');
    expect(resolvePermission(tool({ permissions: { default: 'deny' } }), {})).toBe('deny');
    expect(resolvePermission(medium, { global: 'allow' })).toBe('allow');
    expect(resolvePermission(medium, { global: 'allow', agent: 'deny' })).toBe('deny');
    // a global "never" is a ceiling: an agent's own "allow" cannot lift it (docs/HARDENING.md I-20)
    expect(resolvePermission(medium, { global: 'deny', agent: 'allow' })).toBe('deny');
    expect(resolvePermission(medium, { global: 'ask', agent: 'allow' })).toBe('allow');

    expect(resolvePermission(tool({ permissions: { ceiling: 'ask' } }), { agent: 'allow' })).toBe('ask');
    expect(resolvePermission(tool({ permissions: { ceiling: 'deny' } }), { agent: 'allow' })).toBe('deny');
  });

  it('keeps the workspace and global choices, without anything else', async () => {
    const storage = new MemoryAdapter();
    const p = new ToolPolicyStore(storage);
    await p.setWorkspace(`  ${WS}  `);
    await p.setGlobal('write_text_file', 'allow');
    await storage.set('tool-policy', { ...(await storage.get<object>('tool-policy')), global: { write_text_file: 'allow', junk: 'sudo' } });
    const again = new ToolPolicyStore(storage);
    await again.init();
    expect(again.get()).toEqual({ version: 1, workspace: WS, global: { write_text_file: 'allow' } });
    await again.setGlobal('write_text_file', undefined);
    await again.setWorkspace('');
    expect(again.get()).toEqual({ version: 1, global: {} });
  });
});

// ── runtime ─────────────────────────────────────────────────

describe('ToolRuntime', () => {
  it('runs an allowed call: requested → approved → running → completed', async () => {
    const { runtime, bus } = await rig();
    const types: string[] = [];
    bus.on('*', (_p, e) => e.type.startsWith('tool.') && types.push(e.type));
    const { call, result } = await runtime.execute({ providerCallId: 'p1', name: 'echo', input: { text: 'hi' } }, scope(), live());
    expect(result).toMatchObject({ success: true, content: 'hi', toolCallId: call.id });
    expect(call).toMatchObject({ status: 'completed', permission: 'allow', providerCallId: 'p1', agentId: 'alex', runId: 'run-1' });
    expect(types).toEqual(['tool.requested', 'tool.approved', 'tool.started', 'tool.completed']);
  });

  it('refuses unknown, not enabled and badly formed calls before anything runs', async () => {
    let ran = 0;
    const { runtime } = await rig({ tools: [[tool(), async (x) => (ran++, echo(x))], [tool({ id: 'other', name: 'other' }), echo]] });
    expect((await runtime.execute({ name: 'nope', input: {} }, scope(), live())).result.error?.code).toBe('TOOL_NOT_FOUND');
    expect((await runtime.execute({ name: 'other', input: { text: 'x' } }, scope(), live())).call.status).toBe('denied');
    expect((await runtime.execute({ name: 'echo', input: 'text' }, scope(), live())).result.error?.code).toBe('INVALID_TOOL_INPUT');
    expect((await runtime.execute({ name: 'echo', input: { text: 'x', extra: 1 } }, scope(), live())).result.error).toMatchObject({ code: 'INVALID_TOOL_INPUT', message: expect.stringContaining('extra') });
    expect(ran).toBe(0);
  });

  it('a tool set to never is denied without asking', async () => {
    const { runtime } = await rig({ global: { echo: 'deny' } });
    const { call, result } = await runtime.execute({ name: 'echo', input: { text: 'x' } }, scope(), live());
    expect(call.status).toBe('denied');
    expect(result.error?.code).toBe('TOOL_NOT_ALLOWED');
    expect(runtime.approvals()).toEqual([]);
  });

  it('asks, and waits for the user: allow once asks again next time', async () => {
    const { runtime } = await rig({ global: { echo: 'ask' } });
    const p = runtime.execute({ name: 'echo', input: { text: 'one' } }, scope(), live());
    await until(() => runtime.approvals().length === 1);
    expect(runtime.approvals()[0]).toMatchObject({ requester: 'Alex', call: { status: 'awaiting_approval', input: { text: 'one' } } });
    runtime.decide(runtime.approvals()[0].call.id, 'once');
    expect((await p).result.content).toBe('one');
    const q = runtime.execute({ name: 'echo', input: { text: 'two' } }, scope(), live());
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'once');
    expect((await q).call.status).toBe('completed');
  });

  it('"allow for this run" lasts until the run ends; "always" is remembered on the agent', async () => {
    const { runtime, always } = await rig({ global: { echo: 'ask' } });
    const p = runtime.execute({ name: 'echo', input: { text: 'a' } }, scope(), live());
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'run');
    await p;
    expect((await runtime.execute({ name: 'echo', input: { text: 'b' } }, scope(), live())).call.status).toBe('completed');
    runtime.endRun('run-1');
    const q = runtime.execute({ name: 'echo', input: { text: 'c' } }, scope(), live());
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'always');
    await q;
    expect(always).toEqual(['alex:echo']);
  });

  it('a refused approval is denied and nothing runs', async () => {
    let ran = 0;
    const { runtime } = await rig({ tools: [[tool(), async (x) => (ran++, echo(x))]], global: { echo: 'ask' } });
    const p = runtime.execute({ name: 'echo', input: { text: 'x' } }, scope(), live());
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'deny');
    const { call, result } = await p;
    expect(call.status).toBe('denied');
    expect(result.error?.code).toBe('APPROVAL_DENIED');
    expect(ran).toBe(0);
  });

  it('stopping the run while it waits for approval cancels the call', async () => {
    const { runtime } = await rig({ global: { echo: 'ask' } });
    const ac = new AbortController();
    const p = runtime.execute({ name: 'echo', input: { text: 'x' } }, scope(), ac.signal);
    await until(() => runtime.approvals().length === 1);
    ac.abort();
    expect((await p).call.status).toBe('cancelled');
    expect(runtime.approvals()).toEqual([]);
  });

  it('times out, cancels a running call, and turns a throw into a failure', async () => {
    const hang: ToolExecutor = ({ signal }) => new Promise((r) => signal.addEventListener('abort', () => r({ success: false })));
    const { runtime } = await rig({
      tools: [
        [tool({ id: 'slow', name: 'slow', timeoutMs: 20, inputSchema: { type: 'object' } }), hang],
        [tool({ id: 'stuck', name: 'stuck', inputSchema: { type: 'object' } }), hang],
        [tool({ id: 'boom', name: 'boom', inputSchema: { type: 'object' } }), async () => Promise.reject(new Error('kaput'))],
      ],
    });
    const s = scope({ allowedToolIds: ['slow', 'stuck', 'boom'] });
    expect((await runtime.execute({ name: 'slow', input: {} }, s, live())).result.error?.code).toBe('TOOL_TIMEOUT');
    const ac = new AbortController();
    const p = runtime.execute({ name: 'stuck', input: {} }, s, ac.signal);
    await until(() => runtime.list().some((c) => c.toolId === 'stuck' && c.status === 'running'));
    ac.abort();
    expect((await p).call.status).toBe('cancelled');
    expect((await runtime.execute({ name: 'boom', input: {} }, s, live())).result.error).toMatchObject({ code: 'TOOL_EXECUTION_FAILED', message: expect.stringContaining('kaput') });
  });

  it('file tools need a workspace and report what the host refuses', async () => {
    const fs = new MemoryFs();
    const { runtime, registry } = await rig({ tools: [] });
    registerNativeTools(registry, fs);
    const s = scope({ allowedToolIds: ['read_text_file', 'write_text_file'], workspace: WS, agentPermissions: { write_text_file: 'allow' } });
    expect((await runtime.execute({ name: 'read_text_file', input: { path: 'a.txt' } }, { ...s, workspace: undefined }, live())).result.error?.code).toBe('WORKSPACE_REQUIRED');
    expect((await runtime.execute({ name: 'read_text_file', input: { path: '../x' } }, s, live())).result.error?.code).toBe('PATH_OUTSIDE_WORKSPACE');
    expect((await runtime.execute({ name: 'read_text_file', input: { path: 'a.txt' } }, s, live())).result.error?.code).toBe('FILE_NOT_FOUND');
    const w = await runtime.execute({ name: 'write_text_file', input: { path: 'a.txt', content: 'hey' } }, s, live());
    expect(w.result.artifacts).toEqual([{ kind: 'file', path: 'a.txt', action: 'created', bytes: 3 }]);
    expect((await runtime.execute({ name: 'read_text_file', input: { path: 'a.txt' } }, s, live())).result.content).toBe('hey');
  });

  it('events carry ids and outcome only, never inputs or outputs', async () => {
    const { runtime, bus } = await rig();
    await runtime.execute({ name: 'echo', input: { text: 'private words' } }, scope(), live());
    const tools = bus.log.filter((e) => e.type.startsWith('tool.'));
    expect(tools.length).toBeGreaterThan(0);
    expect(JSON.stringify(tools)).not.toContain('private words');
    expect(Object.keys(tools[0].payload).sort()).toEqual(['agentId', 'runId', 'toolCallId', 'toolId']);
  });

  it('keeps call history across a restart, cut to size; open calls become cancelled', async () => {
    const storage = new MemoryAdapter();
    const a = await rig({ storage, global: { echo: 'ask' }, tools: [[tool({ inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }), echo]] });
    await a.runtime.execute({ name: 'echo', input: { text: 'x'.repeat(MAX_KEPT_CHARS * 2) } }, scope({ agentPermissions: { echo: 'allow' } }), live());
    void a.runtime.execute({ name: 'echo', input: { text: 'waiting' } }, scope(), live());
    await until(() => a.runtime.approvals().length === 1);
    await a.runtime.flush();
    const b = await rig({ storage, tools: [[tool(), echo]] });
    const waiting = b.runtime.list().find((c) => c.status !== 'completed')!;
    const done = b.runtime.list().find((c) => c.status === 'completed')!;
    expect(waiting).toMatchObject({ status: 'cancelled', error: { code: 'TOOL_CANCELLED' } });
    expect(done.status).toBe('completed');
    expect(String(done.input).length).toBeLessThan(MAX_KEPT_CHARS + 50);
    expect(String(done.input)).toContain('[truncated]');
  });
});

describe('native tools', () => {
  it('get_current_time gives local ISO time with the zone', async () => {
    const run = nativeExecutors(new UnavailableToolHost(), () => new Date('2026-10-13T10:00:00Z'));
    const r = await run.get_current_time({ callId: 'c', input: {}, signal: live() });
    expect(r.success).toBe(true);
    expect(r.content).toMatch(/^2026-10-13T\d\d:00:00[+-]\d\d:\d\d \(.+\)$/);
  });
  it('write reports created, then updated', async () => {
    const run = nativeExecutors(new MemoryFs());
    const x = { callId: 'c', input: { path: 'n.md', content: 'a' }, workspace: WS, signal: live() };
    expect((await run.write_text_file(x)).artifacts?.[0].action).toBe('created');
    expect((await run.write_text_file(x)).artifacts?.[0].action).toBe('updated');
  });
});

// ── loop ────────────────────────────────────────────────────

const CAPS: ProviderCapabilities = { streaming: true, tools: false, toolCalling: true, vision: false, sessions: false, local: false, usage: true, cost: false, cancellation: true, modelListing: false, systemPrompt: true };

/** a model: each turn answers from what it was sent */
class ScriptedModel implements AIProvider {
  readonly name = 'Scripted';
  readonly capabilities = CAPS;
  requests: ProviderTurnRequest[] = [];
  constructor(
    readonly id: string,
    private turn: (req: ProviderTurnRequest, n: number) => ProviderEventBody[],
  ) {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(structuredClone({ ...req, abortSignal: undefined }));
    let seq = 0;
    for (const b of this.turn(req, this.requests.length)) {
      await tick();
      if (req.abortSignal?.aborted) {
        yield { type: 'run.cancelled', reason: 'Cancelled.', runId: req.runId, providerId: this.id, seq: ++seq, at: 0 };
        return;
      }
      yield { ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 } as ProviderEvent;
    }
  }
}
const ask = (calls: { id: string; name: string; input: unknown }[], text = ''): ProviderEventBody[] => [
  { type: 'provider.started', model: 'm' },
  ...(text ? [{ type: 'text.delta' as const, messageId: 'm', index: 0, text }] : []),
  ...calls.map((c) => ({ type: 'tool.requested' as const, messageId: 'm', toolCallId: c.id, name: c.name, input: c.input })),
  { type: 'usage.updated', usage: { inputTokens: 10, outputTokens: 2 }, cumulative: true },
  { type: 'run.completed', text, stopReason: calls.length ? 'tool_calls' : 'stop' },
];
const say = (text: string) => ask([], text);

async function loopRig(model: ScriptedModel, opts: { global?: Record<string, ToolPermission> } = {}) {
  const r = await rig({ tools: [], global: opts.global });
  const fs = new MemoryFs();
  registerNativeTools(r.registry, fs);
  const providers = new ProviderService(new ProviderRegistry().register(model), r.bus);
  const loop = new ToolLoop(providers, r.runtime, r.registry);
  const run = (allowed: string[], over: Partial<ToolScope> = {}) => {
    const events: ProviderEvent[] = [];
    const handle = loop.run(model.id, { runId: 'run-1', messages: [{ role: 'user', content: 'go' }] }, scope({ allowedToolIds: allowed, workspace: WS, ...over }), (e) => events.push(e));
    return { handle, events, done: handle.done };
  };
  return { ...r, fs, run };
}

describe('ToolLoop', () => {
  it('writes, reads back and answers: tool results go back as tool messages', async () => {
    const model = new ScriptedModel('m', (req, n) => {
      if (n === 1) return ask([{ id: 'c1', name: 'write_text_file', input: { path: 'hello.txt', content: 'RealmNest tool runtime successful.' } }], 'Writing.');
      if (n === 2) return ask([{ id: 'c2', name: 'read_text_file', input: { path: 'hello.txt' } }]);
      const last = req.messages.at(-1)!;
      return say(`It says: ${JSON.parse(last.content).content}`);
    });
    const r = await loopRig(model, { global: { write_text_file: 'allow' } });
    const { done, events } = r.run(['write_text_file', 'read_text_file']);
    const end = await done;
    expect(end).toMatchObject({ type: 'run.completed', text: 'Writing.\n\nIt says: RealmNest tool runtime successful.', usage: { inputTokens: 30, outputTokens: 6 } });
    expect(r.fs.files.get('hello.txt')).toBe('RealmNest tool runtime successful.');
    expect(events.filter((e) => e.type === 'provider.started')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'run.completed')).toHaveLength(1);
    // the model saw only the schemas of the tools it may use, and its own calls answered by id
    expect(model.requests[0].toolSchemas?.map((s) => s.name)).toEqual(['write_text_file', 'read_text_file']);
    expect(model.requests[1].messages.slice(1)).toEqual([
      { role: 'assistant', content: 'Writing.', toolCalls: [{ id: 'c1', name: 'write_text_file', input: { path: 'hello.txt', content: 'RealmNest tool runtime successful.' } }] },
      { role: 'tool', toolCallId: 'c1', content: expect.stringContaining('"ok":true') },
    ]);
    expect(r.runtime.list({ runId: 'run-1' }).map((c) => c.status)).toEqual(['completed', 'completed']);
  });

  it('a denied write goes back to the model as an error, and nothing is written', async () => {
    const model = new ScriptedModel('m', (req, n) => (n === 1 ? ask([{ id: 'c1', name: 'write_text_file', input: { path: 'x.txt', content: 'x' } }]) : say(req.messages.at(-1)!.content)));
    const r = await loopRig(model);
    const { done } = r.run(['write_text_file']);
    await until(() => r.runtime.approvals().length === 1);
    r.runtime.decide(r.runtime.approvals()[0].call.id, 'deny');
    const end = await done;
    expect(end.type).toBe('run.completed');
    expect(JSON.parse((end as { text: string }).text)).toEqual({ ok: false, error: { code: 'APPROVAL_DENIED', message: expect.any(String) } });
    expect(r.fs.files.size).toBe(0);
  });

  it('stops a model that keeps calling: total, identical and failing calls', async () => {
    let i = 0;
    const many = await loopRig(new ScriptedModel('m', () => ask([{ id: `c${++i}`, name: 'get_current_time', input: { n: undefined } }].map((c) => ({ ...c, input: {} })))));
    // identical calls: the third identical one ends the run
    expect(await many.run(['get_current_time']).done).toMatchObject({ type: 'run.failed', error: { code: 'tool_call_limit', message: expect.stringContaining('same get_current_time') } });
    expect(many.runtime.list().length).toBe(DEFAULT_TOOL_LIMITS.maxSameCall);

    let j = 0;
    const total = await loopRig(new ScriptedModel('m', () => ask([{ id: `c${++j}`, name: 'list_directory', input: { path: `d${j}` } }])));
    expect(await total.run(['list_directory']).done).toMatchObject({ type: 'run.failed', error: { code: 'tool_call_limit', message: expect.stringContaining(`more than ${DEFAULT_TOOL_LIMITS.maxCalls}`) } });
    expect(total.fs.calls).toHaveLength(DEFAULT_TOOL_LIMITS.maxCalls);

    let k = 0;
    const failing = await loopRig(new ScriptedModel('m', () => ask([{ id: `c${++k}`, name: 'read_text_file', input: { path: `missing${k}.txt` } }])));
    expect(await failing.run(['read_text_file']).done).toMatchObject({ type: 'run.failed', error: { code: 'tool_call_limit', detail: 'FILE_NOT_FOUND' } });
    expect(failing.runtime.list()).toHaveLength(DEFAULT_TOOL_LIMITS.maxFailuresInRow);
  });

  it('cancel while a call waits for approval ends the run as cancelled', async () => {
    const model = new ScriptedModel('m', () => ask([{ id: 'c1', name: 'write_text_file', input: { path: 'x.txt', content: 'x' } }]));
    const r = await loopRig(model);
    const { handle, done, events } = r.run(['write_text_file']);
    await until(() => r.runtime.approvals().length === 1);
    await handle.cancel();
    expect((await done).type).toBe('run.cancelled');
    expect(r.runtime.list()[0].status).toBe('cancelled');
    expect(events.filter((e) => e.type === 'run.cancelled' || e.type === 'run.completed' || e.type === 'run.failed')).toHaveLength(1);
    expect(r.fs.files.size).toBe(0);
  });

  it('a provider failure ends the loop with that error', async () => {
    const model = new ScriptedModel('m', () => [{ type: 'run.failed', error: { code: 'rate_limited', message: 'slow down' } }]);
    const r = await loopRig(model);
    expect(await r.run(['get_current_time']).done).toMatchObject({ type: 'run.failed', error: { code: 'rate_limited' } });
  });

  it('resultForModel keeps success and errors distinguishable', () => {
    expect(JSON.parse(resultForModel({ toolCallId: 'x', success: true, content: 'hi', artifacts: [{ kind: 'file', path: 'a', action: 'created', bytes: 1 }] }))).toEqual({ ok: true, content: 'hi', artifacts: [{ kind: 'file', path: 'a', action: 'created', bytes: 1 }] });
    expect(JSON.parse(resultForModel({ toolCallId: 'x', success: false, error: { code: 'FILE_TOO_LARGE', message: 'big' } }))).toEqual({ ok: false, error: { code: 'FILE_TOO_LARGE', message: 'big' } });
  });
});

// ── OpenRouter, agents and chat ─────────────────────────────

/** the native OpenRouter host, scripted: asks for tools while it has none of their results */
class ToolHost implements OpenRouterTransport {
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
const helloTurn = (req: OrChatRequest): OrStreamEvent[] => {
  const tools = req.messages.filter((m) => m.role === 'tool');
  if (!req.tools?.length) return [{ t: 'start', model: req.model }, { t: 'delta', d: 'No tools here.' }, { t: 'done', finishReason: 'stop' }];
  if (tools.length === 0) return [{ t: 'start', model: req.model }, { t: 'tool', id: 'call_w', name: 'write_text_file', args: JSON.stringify({ path: 'hello.txt', content: 'RealmNest tool runtime successful.' }) }, { t: 'done', finishReason: 'tool_calls' }];
  if (tools.length === 1) return [{ t: 'start', model: req.model }, { t: 'tool', id: 'call_r', name: 'read_text_file', args: '{"path":"hello.txt"}' }, { t: 'done', finishReason: 'tool_calls' }];
  return [{ t: 'start', model: req.model }, { t: 'delta', d: JSON.parse(String(tools[1].content)).content }, { t: 'done', finishReason: 'stop' }];
};

async function appRig(turn: (req: OrChatRequest) => OrStreamEvent[], canCall = true) {
  const r = await rig({ tools: [] });
  const fs = new MemoryFs();
  registerNativeTools(r.registry, fs);
  await r.policy.setWorkspace(WS);
  const host = new ToolHost(turn);
  const providers = new ProviderService(new ProviderRegistry(), r.bus, (id) => (id === 'or' ? new OpenRouterProvider('or', host) : undefined));
  const service = new ToolService(r.registry, r.runtime, r.policy, new ToolLoop(providers, r.runtime, r.registry), () => canCall);
  const liveRt = new LiveRuntime(r.bus, providers, new RuntimeRepository(r.storage, 5), { identity: () => ({ name: 'Alex', role: 'Developer' }), defaultConnection: () => 'or', tools: service });
  const chat = new ConversationRuntime(r.bus, providers, new ConversationRepository(r.storage, 5), { agent: (id) => liveRt.agent(id), identity: () => ({ name: 'Alex', role: 'Developer' }), tools: service });
  await liveRt.init();
  await chat.init();
  return { ...r, fs, host, service, live: liveRt, chat };
}

describe('tools through OpenRouter', () => {
  it('Alex writes hello.txt (write asks, read allowed) and reads it back', async () => {
    const s = await appRig(helloTurn);
    s.live.updateAgent('alex', { connectionId: 'or', model: 'vendor/tool-model:free', allowedToolIds: ['write_text_file', 'read_text_file'], toolPermissions: { write_text_file: 'ask', read_text_file: 'allow' } });
    const { run } = s.live.startTask('alex', { prompt: 'Create hello.txt and read it back.' });
    await until(() => s.runtime.approvals().length === 1);
    expect(s.runtime.approvals()[0]).toMatchObject({ requester: 'Alex', call: { toolId: 'write_text_file', input: { path: 'hello.txt' } } });
    s.runtime.decide(s.runtime.approvals()[0].call.id, 'once');
    await until(() => s.live.getRun(run.id)!.status === 'completed');
    expect(s.fs.files.get('hello.txt')).toBe('RealmNest tool runtime successful.');
    expect(s.live.getRun(run.id)!.result).toBe('RealmNest tool runtime successful.');
    // OpenAI-style tools and tool messages on the wire
    expect(s.host.requests[0].tools?.map((t) => t.function.name)).toEqual(['write_text_file', 'read_text_file']);
    expect(s.host.requests[1].messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_w', type: 'function', function: { name: 'write_text_file', arguments: JSON.stringify({ path: 'hello.txt', content: 'RealmNest tool runtime successful.' }) } }] },
      { role: 'tool', tool_call_id: 'call_w', content: expect.stringContaining('"ok":true') },
    ]);
    expect(s.runtime.list({ runId: run.id }).map((c) => [c.toolId, c.permission, c.status])).toEqual([
      ['read_text_file', 'allow', 'completed'],
      ['write_text_file', 'ask', 'completed'],
    ]);
  });

  it('an agent without allowed tools, or on a model without tool calling, runs an ordinary turn', async () => {
    const s = await appRig(helloTurn, false);
    s.live.updateAgent('alex', { connectionId: 'or', model: 'vendor/no-tools', allowedToolIds: ['write_text_file'] });
    expect(s.service.offer('or', 'vendor/no-tools', ['write_text_file'])).toMatchObject({ ids: [], reason: 'model' });
    const { run } = s.live.startTask('alex', { prompt: 'hi' });
    await until(() => s.live.getRun(run.id)!.status === 'completed');
    expect(s.host.requests[0].tools).toBeUndefined();
    expect(s.runtime.list()).toEqual([]);
  });

  it('chat: tools off sends none; tools on lists the workspace', async () => {
    const s = await appRig((req) =>
      !req.tools?.length
        ? [{ t: 'start', model: req.model }, { t: 'delta', d: 'I cannot look at files.' }, { t: 'done', finishReason: 'stop' }]
        : req.messages.at(-1)!.role === 'tool'
          ? [{ t: 'start', model: req.model }, { t: 'delta', d: `Files: ${JSON.parse(String(req.messages.at(-1)!.content)).content}` }, { t: 'done', finishReason: 'stop' }]
          : [{ t: 'start', model: req.model }, { t: 'tool', id: 'call_l', name: 'list_directory', args: '{"path":"."}' }, { t: 'done', finishReason: 'tool_calls' }],
    );
    s.fs.files.set('hello.txt', 'x');
    const off = s.chat.create({ connectionId: 'or', model: 'vendor/tool-model:free' });
    s.chat.send(off.id, 'What is in the workspace?');
    await until(() => !s.chat.isBusy(off.id));
    expect(s.host.requests[0].tools).toBeUndefined();
    expect(s.chat.get(off.id)!.messages.at(-1)!.content).toBe('I cannot look at files.');

    s.chat.setTools(off.id, true);
    s.chat.send(off.id, 'And now?');
    await until(() => !s.chat.isBusy(off.id));
    expect(s.host.requests[1].tools?.map((t) => t.function.name)).toEqual(['get_current_time', 'list_directory', 'read_text_file', 'write_text_file']);
    expect(s.chat.get(off.id)!.messages.at(-1)!.content).toBe('Files: hello.txt (1 B)');
    expect(s.runtime.list({ conversationId: off.id })[0]).toMatchObject({ toolId: 'list_directory', status: 'completed', permission: 'allow' });
  });

  it('a chat leaves out tools the user set to never', async () => {
    const s = await appRig(helloTurn);
    await s.policy.setGlobal('write_text_file', 'deny');
    expect(s.service.offer('or', 'm', undefined).ids).toEqual(['get_current_time', 'list_directory', 'read_text_file']);
  });

  it('the OpenRouter adapter turns streamed tool calls into tool.requested, and bad JSON into no input', async () => {
    const host = new ToolHost(() => [
      { t: 'start', model: 'm' },
      { t: 'tool', id: 'a', name: 'read_text_file', args: '{"path":"x"}' },
      { t: 'tool', id: 'b', name: 'read_text_file', args: '{oops' },
      { t: 'done', finishReason: 'tool_calls' },
    ]);
    const out: ProviderEvent[] = [];
    for await (const e of new OpenRouterProvider('or', host).runTurn({ runId: 'r', model: 'm', messages: [{ role: 'user', content: 'x' }], toolSchemas: [{ name: 'read_text_file', description: 'd', parameters: { type: 'object' } }] })) out.push(e);
    expect(out.filter((e) => e.type === 'tool.requested')).toEqual([expect.objectContaining({ toolCallId: 'a', name: 'read_text_file', input: { path: 'x' } }), expect.objectContaining({ toolCallId: 'b', input: undefined })]);
    expect(host.requests[0].tools).toEqual([{ type: 'function', function: { name: 'read_text_file', description: 'd', parameters: { type: 'object' } } }]);
    expect(out.at(-1)?.type).toBe('run.completed');
  });
});

describe('ToolRuntime: an escalated call always asks (docs/HARDENING.md R-16)', () => {
  it('"allow for this run" covers the tool, but a call to an address nobody saw is still asked about', async () => {
    const bus = new EventBus(500);
    const storage = new MemoryAdapter();
    const registry = new ToolRegistry();
    const peek: ToolDefinition = { id: 'peek', name: 'peek', description: 'x', source: 'native', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, additionalProperties: false }, risk: 'medium', permissions: {}, cancellable: false, timeoutMs: 1000 };
    registry.register(peek, async () => ({ success: true, content: 'ok' }));
    const policy = new ToolPolicyStore(storage, bus);
    await policy.init();
    const runtime = new ToolRuntime(registry, policy, bus, storage, { escalate: (_t, input) => ((input as { url?: string }).url?.includes('evil') ? 'unseen address' : undefined) });
    await runtime.init();
    const scope: ToolScope = { runId: 'r', allowedToolIds: ['peek'], requester: 'Chat' };
    // asked once, allowed for the run
    const first = runtime.execute({ name: 'peek', input: { url: 'https://ok.example' } }, scope, new AbortController().signal);
    await until(() => runtime.approvals().length === 1);
    runtime.decide(runtime.approvals()[0].call.id, 'run');
    expect((await first).call.status).toBe('completed');
    expect((await runtime.execute({ name: 'peek', input: { url: 'https://ok.example/2' } }, scope, new AbortController().signal)).call.status).toBe('completed');
    // with global allow the escalation still asks as well
    await policy.setGlobal('peek', 'allow');
    const unseen = runtime.execute({ name: 'peek', input: { url: 'https://evil.example' } }, scope, new AbortController().signal);
    await until(() => runtime.approvals().length === 1);
    expect(runtime.approvals()[0].call).toMatchObject({ approvalReason: 'unseen address' });
    runtime.decide(runtime.approvals()[0].call.id, 'deny');
    expect((await unseen).call.status).toBe('denied');
  });
});

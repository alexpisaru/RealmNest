import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRIDGE_WEB_PROMPT, checkClaudeArgs, PLAIN_PROMPT, turnArgs, WEB_PROMPT } from '../runtime/providers/claude-code/args';
import { BRIDGED_TURN_TIMEOUT_MS, CLAUDE_CODE_CAPABILITIES, ClaudeCodeProvider } from '../runtime/providers/claude-code/provider';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec, ProgramLocation } from '../runtime/process/types';
import { UnavailableProcessRunner } from '../runtime/process/types';
import type { AIProvider, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';

// The CLI is mocked here only. The real Claude Code is exercised from the
// Debug › Providers panel (see docs/PROVIDERS.md).

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'claude-code', name), 'utf8');

type Script = (spec: ProcessSpec, cb: ProcessCallbacks) => Promise<ProcessEnd>;

/** a ProcessRunner that plays scripted answers per command */
class FakeRunner implements ProcessRunner {
  readonly available = true;
  calls: ProcessSpec[] = [];
  constructor(
    private scripts: { version?: Script; auth?: Script; turn?: Script },
    private location: ProgramLocation = { found: true, path: '/usr/local/bin/claude', source: 'path' },
  ) {}
  async locate() {
    return this.location;
  }
  run(spec: ProcessSpec, cb: ProcessCallbacks = {}) {
    this.calls.push(spec);
    const which = spec.args[0] === '--version' ? 'version' : spec.args[0] === 'auth' ? 'auth' : 'turn';
    const s = this.scripts[which];
    return s ? s(spec, cb) : Promise.resolve<ProcessEnd>({ kind: 'exit', code: 0, signal: null });
  }
}

const exit = (code: number | null, signal: string | null = null): ProcessEnd => ({ kind: 'exit', code, signal });
const prints =
  (stdout: string, end: ProcessEnd = exit(0), stderr = ''): Script =>
  async (_spec, cb) => {
    cb.onSpawn?.();
    // deliver in awkward chunks to exercise line splitting
    for (let i = 0; i < stdout.length; i += 37) cb.onStdout?.(stdout.slice(i, i + 37));
    if (stderr) cb.onStderr?.(stderr);
    return end;
  };

const signedIn: Script = prints('{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty"}');
const version: Script = prints('2.1.293 (Claude Code)\n');

const req = (over: Partial<ProviderTurnRequest> = {}): ProviderTurnRequest => ({ runId: 'r1', messages: [{ role: 'user', content: 'Reply exactly with: RealmNest provider test successful.' }], ...over });

async function collect(it: AsyncIterable<ProviderEvent>) {
  const out: ProviderEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}
const terminalOf = (events: ProviderEvent[]) => events.filter((e) => e.type.startsWith('run.'));

describe('ClaudeCodeProvider status', () => {
  it('is AVAILABLE when installed and signed in', async () => {
    const s = await new ClaudeCodeProvider(new FakeRunner({ version, auth: signedIn })).getStatus();
    expect(s).toMatchObject({ state: 'available', message: 'Claude Code detected.', version: '2.1.293' });
    expect(s.details).toMatchObject({ path: '/usr/local/bin/claude', source: 'path', auth: 'claude.ai' });
  });

  it('is NOT_INSTALLED when the CLI cannot be found', async () => {
    const missing: Script = async () => ({ kind: 'spawn_error', code: 'not_found', message: 'claude was not found' });
    const s = await new ClaudeCodeProvider(new FakeRunner({ version: missing }, { found: false })).getStatus();
    expect(s.state).toBe('not_installed');
    expect(s.message).toBe('Claude Code not installed.');
    expect(s.hint).toMatch(/install/i);
  });

  it('is NOT_AUTHENTICATED when auth status says so (exit 1 with JSON)', async () => {
    const out: Script = prints('{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}', exit(1));
    const loc = { found: true, path: 'C:\\Users\\me\\AppData\\Roaming\\Claude\\claude-code\\2.1.293\\x\\claude.exe', source: 'desktop-app' };
    const s = await new ClaudeCodeProvider(new FakeRunner({ version, auth: out }, loc)).getStatus();
    expect(s.state).toBe('not_authenticated');
    expect(s.message).toBe('Claude Code installed but not authenticated.');
    // not on PATH: the hint carries the full executable path
    expect(s.hint).toContain(`${loc.path} auth login`);
  });

  it('is UNAVAILABLE without a process host, and never throws', async () => {
    const s = await new ClaudeCodeProvider(new UnavailableProcessRunner()).getStatus();
    expect(s.state).toBe('unavailable');
  });

  it('is ERROR when the sign-in status cannot be read', async () => {
    const s = await new ClaudeCodeProvider(new FakeRunner({ version, auth: prints('garbage', exit(2), 'boom') })).getStatus();
    expect(s.state).toBe('error');
    expect(s.version).toBe('2.1.293');
  });

  it('declares honest capabilities', async () => {
    expect(CLAUDE_CODE_CAPABILITIES).toMatchObject({ streaming: true, sessions: true, cancellation: true, usage: true, local: false, vision: true, files: true, modelListing: true });
    const asContract: AIProvider = new ClaudeCodeProvider(new UnavailableProcessRunner());
    // the CLI cannot list models: the catalogue is RealmNest's, each id run with the CLI
    expect((await asContract.listModels!()).map((m) => m.id)).toEqual(['claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
  });
});

describe('ClaudeCodeProvider turns', () => {
  it('streams a successful turn as normalized events', async () => {
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    const events = await collect(new ClaudeCodeProvider(runner).runTurn(req()));
    expect(events[0].type).toBe('provider.started');
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events.every((e) => e.runId === 'r1' && e.providerId === 'claude-code')).toBe(true);
    const text = events.flatMap((e) => (e.type === 'text.delta' ? [e.text] : [])).join('');
    expect(text).toBe('RealmNest provider test successful.');
    expect(terminalOf(events).map((e) => e.type)).toEqual(['run.completed']);
    expect(events[events.length - 1].type).toBe('run.completed');
    // the prompt goes to stdin, never into argv
    const call = runner.calls[0];
    expect(call.stdin).toBe('Reply exactly with: RealmNest provider test successful.');
    expect(call.args).not.toContain('Reply exactly with: RealmNest provider test successful.');
    expect(checkClaudeArgs(call.args)).toBeNull();
  });

  it('fails clearly when the CLI is missing', async () => {
    const missing: Script = async () => ({ kind: 'spawn_error', code: 'not_found', message: 'claude was not found' });
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: missing })).runTurn(req()));
    expect(events.map((e) => e.type)).toEqual(['run.failed']);
    expect(events[0]).toMatchObject({ error: { code: 'not_installed' } });
  });

  it('fails as not_authenticated on the real signed-out output', async () => {
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: prints(fixture('not-logged-in.jsonl'), exit(1)) })).runTurn(req()));
    const t = terminalOf(events);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ type: 'run.failed', error: { code: 'not_authenticated' } });
  });

  it('keeps going past malformed lines', async () => {
    const out = `garbage line\n${fixture('success-partial.sample.jsonl')}`;
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: prints(out) })).runTurn(req()));
    expect(events.find((e) => e.type === 'provider.error')).toMatchObject({ error: { code: 'malformed_event' } });
    expect(terminalOf(events).map((e) => e.type)).toEqual(['run.completed']);
  });

  it('reports a crash (killed by a signal)', async () => {
    const half = fixture('success-partial.sample.jsonl').split('\n').slice(0, 5).join('\n');
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: prints(half, exit(null, 'SIGSEGV')) })).runTurn(req()));
    expect(terminalOf(events)[0]).toMatchObject({ type: 'run.failed', error: { code: 'process_crashed' } });
    // what streamed before the crash was still delivered
    expect(events.some((e) => e.type === 'text.delta')).toBe(true);
  });

  it('reports a non-zero exit with the (redacted) stderr tail', async () => {
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: prints('', exit(2), 'fatal: bad config ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijkl') })).runTurn(req()));
    const t = terminalOf(events)[0];
    expect(t).toMatchObject({ type: 'run.failed', error: { code: 'process_exit', message: 'Claude Code exited with code 2.' } });
    const detail = t.type === 'run.failed' ? t.error.detail : '';
    expect(detail).toContain('fatal: bad config');
    expect(detail).not.toContain('abcdefghijkl');
  });

  it('reports an exit without a result as an incomplete stream', async () => {
    const events = await collect(new ClaudeCodeProvider(new FakeRunner({ turn: prints('{"type":"system","subtype":"init","session_id":"s"}\n') })).runTurn(req()));
    expect(terminalOf(events)[0]).toMatchObject({ type: 'run.failed', error: { code: 'incomplete_stream' } });
  });

  it("runs in RealmNest's own folder, never the agent's workspace", async () => {
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    await collect(new ClaudeCodeProvider(runner).runTurn(req({ workspace: 'C:\\Users\\me\\cloned-repo' })));
    expect(runner.calls[0].cwd).toBeUndefined();
    expect(runner.calls[0].args).toEqual(expect.arrayContaining(['--setting-sources', 'user']));
    expect(checkClaudeArgs(runner.calls[0].args)).toBeNull();
  });

  it('gives a turn with RealmNest tools the longest wall clock (approvals and slow tools count)', async () => {
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    const p = new ClaudeCodeProvider(runner);
    await collect(p.runTurn(req()));
    const bridge = { configPath: 'C:\\Users\\me\\AppData\\Local\\app.nestra.desktop\\realmnest-bridge\\run-1.json', tools: ['mcp__realmnest__echo'] };
    await collect(p.runTurn(req({ runId: 'r2', realmnestBridge: bridge })));
    await collect(p.runTurn(req({ runId: 'r3', realmnestBridge: bridge, timeoutMs: 60_000 })));
    expect(runner.calls.map((c) => c.timeoutMs)).toEqual([5 * 60_000, BRIDGED_TURN_TIMEOUT_MS, 60_000]);
    expect(BRIDGED_TURN_TIMEOUT_MS).toBe(30 * 60_000);
  });

  it('reports a timeout', async () => {
    const slow: Script = async (spec, cb) => {
      cb.onSpawn?.();
      return { kind: 'timeout', timeoutMs: spec.timeoutMs ?? 0 };
    };
    const runner = new FakeRunner({ turn: slow });
    const events = await collect(new ClaudeCodeProvider(runner).runTurn(req({ timeoutMs: 3_000 })));
    expect(runner.calls[0].timeoutMs).toBe(3_000);
    expect(terminalOf(events)[0]).toMatchObject({ type: 'run.failed', error: { code: 'timeout' } });
  });

  /** a turn that streams one delta, then waits until its signal aborts */
  const hanging: Script = (spec, cb) =>
    new Promise((resolve) => {
      cb.onSpawn?.();
      cb.onStdout?.(fixture('success-partial.sample.jsonl').split('\n').slice(0, 5).join('\n') + '\n');
      spec.signal?.addEventListener('abort', () => resolve({ kind: 'cancelled' }));
    });

  it('cancels through cancel(runId)', async () => {
    const provider = new ClaudeCodeProvider(new FakeRunner({ turn: hanging }));
    const events: ProviderEvent[] = [];
    for await (const e of provider.runTurn(req())) {
      events.push(e);
      if (e.type === 'text.delta') await provider.cancel('r1');
    }
    expect(terminalOf(events).map((e) => e.type)).toEqual(['run.cancelled']);
  });

  it('cancels through the request abortSignal', async () => {
    const ac = new AbortController();
    const events: ProviderEvent[] = [];
    for await (const e of new ClaudeCodeProvider(new FakeRunner({ turn: hanging })).runTurn(req({ abortSignal: ac.signal }))) {
      events.push(e);
      if (e.type === 'text.delta') ac.abort();
    }
    expect(events[events.length - 1].type).toBe('run.cancelled');
  });

  it('stops the process when the consumer breaks out early', async () => {
    let aborted = false;
    const watch: Script = (spec, cb) =>
      hanging(spec, cb).then((end) => {
        aborted = true;
        return end;
      });
    for await (const e of new ClaudeCodeProvider(new FakeRunner({ turn: watch })).runTurn(req())) if (e.type === 'text.delta') break;
    await new Promise((r) => setTimeout(r, 0));
    expect(aborted).toBe(true);
  });

  it('rejects empty prompts and history without a session, without spawning', async () => {
    const runner = new FakeRunner({});
    const p = new ClaudeCodeProvider(runner);
    const a = await collect(p.runTurn(req({ messages: [{ role: 'user', content: '  ' }] })));
    const b = await collect(p.runTurn(req({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] })));
    expect(a[0]).toMatchObject({ type: 'run.failed', error: { code: 'invalid_request' } });
    expect(b[0]).toMatchObject({ type: 'run.failed', error: { code: 'invalid_request' } });
    expect(runner.calls).toHaveLength(0);
  });

  it('opens a kept session, resumes it by id, and keeps one-off turns unpersisted', async () => {
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    const p = new ClaudeCodeProvider(runner);
    const first = await collect(p.runTurn(req({ session: { mode: 'new' } })));
    const id = first.find((e) => e.type === 'session.started')!;
    expect(id).toMatchObject({ resumed: false, sessionId: '0b8f3c2e-5d4a-4c1e-9f7b-2a6d8e1c3f50' });
    const second = await collect(p.runTurn(req({ runId: 'r2', session: { mode: 'resume', id: '0b8f3c2e-5d4a-4c1e-9f7b-2a6d8e1c3f50' } })));
    await collect(p.runTurn(req({ runId: 'r3' })));
    // new: Claude keeps it under its own id; resume: --resume <id>; none: not kept
    expect(runner.calls[0].args).not.toContain('--no-session-persistence');
    expect(runner.calls[0].args).not.toContain('--resume');
    expect(runner.calls[1].args).toEqual(expect.arrayContaining(['--resume', '0b8f3c2e-5d4a-4c1e-9f7b-2a6d8e1c3f50']));
    expect(runner.calls[2].args).toContain('--no-session-persistence');
    expect(second.find((e) => e.type === 'session.started')).toMatchObject({ resumed: true });
    runner.calls.forEach((c) => expect(checkClaudeArgs(c.args)).toBeNull());
  });

  it('reports a session Claude no longer has as session_not_found (real output)', async () => {
    const stderr = readFileSync(join(__dirname, 'fixtures', 'claude-code', 'session-not-found.stderr.txt'), 'utf8');
    const runner = new FakeRunner({ turn: prints(fixture('session-not-found.jsonl'), exit(1), stderr) });
    const events = await collect(new ClaudeCodeProvider(runner).runTurn(req({ session: { mode: 'resume', id: '11111111-2222-4333-8444-555555555555' } })));
    const t = terminalOf(events);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ type: 'run.failed', error: { code: 'session_not_found' } });
  });

  it('sends --effort only for a level the model lists', async () => {
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    const p = new ClaudeCodeProvider(runner);
    await collect(p.runTurn(req({ model: 'claude-haiku-5-5', effort: 'max' })));
    await collect(p.runTurn(req({ runId: 'r2', effort: 'xhigh' })));
    await collect(p.runTurn(req({ runId: 'r3', model: 'claude-sonnet-5-5', effort: 'ultra' })));
    await collect(p.runTurn(req({ runId: 'r4', model: 'some-custom-model', effort: 'high' })));
    const effortOf = (args: readonly string[]) => (args.includes('--effort') ? args[args.indexOf('--effort') + 1] : undefined);
    expect(runner.calls.map((c) => effortOf(c.args))).toEqual(['max', 'xhigh', undefined, undefined]);
    runner.calls.forEach((c) => expect(checkClaudeArgs(c.args)).toBeNull());
    // the variadic --tools stays last
    expect(runner.calls[0].args.at(-2)).toBe('--tools');
    expect((await p.listModels()).every((m) => m.reasoning?.efforts?.join() === 'low,medium,high,xhigh,max')).toBe(true);
  });

  it('a failed resume for another reason keeps its own error', async () => {
    const runner = new FakeRunner({ turn: prints(fixture('not-logged-in.jsonl'), exit(1)) });
    const events = await collect(new ClaudeCodeProvider(runner).runTurn(req({ session: { mode: 'resume', id: '0b8f3c2e-5d4a-4c1e-9f7b-2a6d8e1c3f50' } })));
    expect(terminalOf(events)).toEqual([expect.objectContaining({ type: 'run.failed', error: expect.objectContaining({ code: 'not_authenticated' }) })]);
  });
});

describe('Claude Code argument allowlist', () => {
  it('accepts what the adapter builds', () => {
    expect(checkClaudeArgs(turnArgs({ tools: [] }))).toBeNull();
    expect(checkClaudeArgs(turnArgs({ tools: [], model: 'sonnet', systemPrompt: 'Be brief.', session: { mode: 'resume', id: crypto.randomUUID() } }))).toBeNull();
    expect(checkClaudeArgs(turnArgs({ tools: [], webSearch: true }))).toBeNull();
    expect(checkClaudeArgs(turnArgs({ tools: [], session: { mode: 'new' } }))).toBeNull();
    expect(checkClaudeArgs(['--version'])).toBeNull();
    expect(checkClaudeArgs(['auth', 'status', '--json'])).toBeNull();
  });

  it('with Web on, a turn gets WebSearch (alone, or next to the RealmNest tools) and a prompt that says so', async () => {
    const alone = turnArgs({ tools: [], web: true, systemPrompt: 'You are Alex.' });
    expect(alone[alone.indexOf('--system-prompt') + 1]).toBe(`${WEB_PROMPT}\n\nYou are Alex.`);
    expect(alone.slice(-2)).toEqual(['--tools', 'WebSearch']);
    expect(alone[alone.indexOf('--allowedTools') + 1]).toBe('WebSearch');
    expect(checkClaudeArgs(alone)).toBeNull();
    const bridge = { configPath: 'C:\\Users\\me\\AppData\\Local\\app.nestra.desktop\\realmnest-bridge\\run-1.json', tools: ['mcp__realmnest__web_fetch'] };
    const both = turnArgs({ tools: [], web: true, bridge });
    expect(both[both.indexOf('--allowedTools') + 1]).toBe('mcp__realmnest__web_fetch,WebSearch');
    expect(both[both.indexOf('--system-prompt') + 1]).toBe(BRIDGE_WEB_PROMPT);
    expect(both.slice(-2)).toEqual(['--tools', 'WebSearch']);
    expect(checkClaudeArgs(both)).toBeNull();
    // Web off: nothing of Claude's own
    expect(turnArgs({ tools: [], bridge }).slice(-2)).toEqual(['--tools', '']);
    // the provider: providerWeb on a chat turn, never on a search turn (that one is WebSearch alone already)
    expect(CLAUDE_CODE_CAPABILITIES.nativeWebInTurns).toBe(true);
    const runner = new FakeRunner({ turn: prints(fixture('success-partial.sample.jsonl')) });
    await collect(new ClaudeCodeProvider(runner).runTurn(req({ providerWeb: true })));
    expect(runner.calls[0].args.slice(-2)).toEqual(['--tools', 'WebSearch']);
    expect(runner.calls[0].args).toContain(WEB_PROMPT);
  });

  it("replaces Claude Code's agentic system prompt when no tools are enabled", () => {
    const plain = turnArgs({ tools: [], systemPrompt: 'You are Alex.' });
    const i = plain.indexOf('--system-prompt');
    expect(plain[i + 1]).toBe(`${PLAIN_PROMPT}\n\nYou are Alex.`);
    expect(plain).not.toContain('--append-system-prompt');
    expect(turnArgs({ tools: [] })[turnArgs({ tools: [] }).indexOf('--system-prompt') + 1]).toBe(PLAIN_PROMPT);
    const withTools = turnArgs({ tools: ['Read'], systemPrompt: 'You are Alex.' });
    expect(withTools).toEqual(expect.arrayContaining(['--append-system-prompt', 'You are Alex.']));
    expect(withTools).not.toContain('--system-prompt');
  });

  it("never loads a project's settings, hooks or CLAUDE.md, and never Claude's own file or shell tools", () => {
    const base = turnArgs({ tools: [] });
    expect(base[base.indexOf('--setting-sources') + 1]).toBe('user');
    const without = base.filter((_, i) => i !== base.indexOf('--setting-sources') && i !== base.indexOf('--setting-sources') + 1);
    expect(checkClaudeArgs(without)).toMatch(/--setting-sources user is required/);
    for (const v of ['project', 'user,project', 'local', '', 'User']) {
      const args = [...base];
      args[args.indexOf('--setting-sources') + 1] = v;
      expect(checkClaudeArgs(args)).toMatch(/invalid value for --setting-sources/);
    }
    // I-17: --tools takes nothing, or WebSearch alone
    expect(checkClaudeArgs(turnArgs({ tools: ['Read', 'Grep'] }))).toMatch(/invalid value for --tools/);
    expect(checkClaudeArgs(turnArgs({ tools: ['Bash'] }))).toMatch(/invalid value for --tools/);
  });

  it('refuses anything else', () => {
    const base = turnArgs({ tools: [] });
    expect(checkClaudeArgs([...base, '--dangerously-skip-permissions'])).toMatch(/not allowed/);
    expect(checkClaudeArgs([...base, '--mcp-config', 'x.json'])).toMatch(/invalid value for --mcp-config/);
    expect(checkClaudeArgs([...base, 'a positional prompt'])).toMatch(/not allowed/);
    expect(checkClaudeArgs(['auth', 'login'])).not.toBeNull();
    expect(checkClaudeArgs(['-p', '--output-format', 'text'])).toMatch(/invalid value/);
    expect(checkClaudeArgs(['-p', '--output-format', 'stream-json', '--resume', 'not-a-uuid'])).toMatch(/invalid value/);
    expect(checkClaudeArgs(['-p', '--output-format', 'stream-json', '--model', '--settings'])).toMatch(/invalid value/);
    expect(checkClaudeArgs(['-p', '--output-format', 'stream-json', '--verbose', '--verbose'])).toMatch(/duplicate/);
    expect(checkClaudeArgs(['-p', '--output-format', 'stream-json', '--effort', 'ultra'])).toMatch(/invalid value for --effort/);
  });
});

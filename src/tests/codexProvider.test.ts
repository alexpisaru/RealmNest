import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCodexArgs, checkCodexEnv, DISABLED_FEATURES, MAX_INSTRUCTIONS, PLAIN_PROMPT, tomlString, turnArgs, WEB_SEARCH_OFF } from '../runtime/providers/codex/args';
import { createCodexDefinition } from '../runtime/providers/codex/definition';
import { CODEX_FALLBACK_MODELS, modelInfo, modelsFromCache, type CodexModelSource } from '../runtime/providers/codex/models';
import { classifyError, CodexJsonParser, usageOf } from '../runtime/providers/codex/parser';
import { BRIDGED_TURN_TIMEOUT_MS, CODEX_CAPABILITIES, CodexProvider } from '../runtime/providers/codex/provider';
import type { CodexModelEntry } from '../runtime/providers/codex/types';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec, ProgramLocation } from '../runtime/process/types';
import { UnavailableProcessRunner } from '../runtime/process/types';
import type { ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';

// The CLI is mocked here only; its real output (Codex CLI 0.162.1) is what these fixtures copy.

const THREAD = '01a13f45-d486-7b82-91ce-b622e62aa89a';
const NOTICE =
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`."}}';
const USAGE = '{"type":"turn.completed","usage":{"input_tokens":22436,"cached_input_tokens":12544,"cache_write_input_tokens":0,"output_tokens":6,"reasoning_output_tokens":0}}';
const OK_TURN = [`{"type":"thread.started","thread_id":"${THREAD}"}`, NOTICE, '{"type":"turn.started"}', '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"PONG"}}', USAGE].join('\n') + '\n';
const TWO_MESSAGES =
  [
    `{"type":"thread.started","thread_id":"${THREAD}"}`,
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I\'ll list the files first."}}',
    '{"type":"item.completed","item":{"id":"item_1","type":"reasoning","text":"thinking"}}',
    '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"There are three files."}}',
    USAGE,
  ].join('\n') + '\n';
const MODEL_FAILURE =
  [
    '{"type":"thread.started","thread_id":"01a13f46-aaa1-70f1-b8cd-50bf9602cea1"}',
    '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `gpt-nope-1` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}',
    '{"type":"turn.started"}',
    '{"type":"error","message":"{\\"type\\":\\"error\\",\\"status\\":400,\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"The \'gpt-nope-1\' model is not supported when using Codex with a ChatGPT account.\\"}}"}',
    '{"type":"turn.failed","error":{"message":"{\\"type\\":\\"error\\",\\"status\\":400,\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"The \'gpt-nope-1\' model is not supported when using Codex with a ChatGPT account.\\"}}"}}',
  ].join('\n') + '\n';
const SIGNED_OUT_TURN =
  [
    '{"type":"thread.started","thread_id":"01a13f46-3eb1-7bb1-84ca-d300689bbe6c"}',
    '{"type":"turn.started"}',
    '{"type":"error","message":"Reconnecting... 2/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: wss://api.openai.com/v1/responses)"}',
    '{"type":"item.completed","item":{"id":"item_1","type":"error","message":"Falling back from WebSockets to HTTPS transport. unexpected status 401 Unauthorized"}}',
    '{"type":"turn.failed","error":{"message":"unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses"}}',
  ].join('\n') + '\n';

const parse = (text: string, opts = {}) => {
  const p = new CodexJsonParser(opts);
  return text.split('\n').flatMap((l) => p.push(l).map((e) => e.body));
};

describe('Codex JSONL parser', () => {
  it('reads a real turn: notices are not failures, the answer and usage are reported', () => {
    const events = parse(OK_TURN, { session: true });
    expect(events.map((e) => e.type)).toEqual(['session.started', 'message.started', 'text.completed', 'usage.updated', 'run.completed']);
    expect(events[0]).toMatchObject({ sessionId: THREAD, resumed: false });
    // RealmNest's convention: uncached input apart from cache reads
    expect(events[3]).toMatchObject({ usage: { inputTokens: 22436 - 12544, cacheReadTokens: 12544, outputTokens: 6 }, cumulative: true });
    expect(events[4]).toMatchObject({ text: 'PONG', sessionId: THREAD });
    expect(events.some((e) => e.type === 'provider.error')).toBe(false);
  });

  it('several agent messages: each is reported, the last one is the answer', () => {
    const events = parse(TWO_MESSAGES, { session: true, resumed: true });
    expect(events.filter((e) => e.type === 'text.completed').map((e) => (e as { text: string }).text)).toEqual(["I'll list the files first.", 'There are three files.']);
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'There are three files.' });
    expect(events[0]).toMatchObject({ type: 'session.started', resumed: true });
  });

  it('a one-off (ephemeral) turn reports no session', () => {
    const events = parse(OK_TURN);
    expect(events.some((e) => e.type === 'session.started')).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'PONG' });
    expect((events.at(-1) as { sessionId?: string }).sessionId).toBeUndefined();
  });

  it('turn.failed: the API error inside is classified', () => {
    expect(parse(MODEL_FAILURE).at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'model_unavailable', detail: expect.stringContaining("'gpt-nope-1' model is not supported") } });
    expect(parse(SIGNED_OUT_TURN).at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'not_authenticated' } });
    expect(classifyError("You've hit your usage limit. Upgrade to Pro").code).toBe('rate_limited');
    expect(classifyError('stream disconnected').code).toBe('api_error');
    expect(classifyError('Authorization: Bearer abcdefghijklmnop sk-proj-ABCDEFGHIJKLMNOPQRST').detail).not.toMatch(/abcdefghijklmnop|ABCDEFGHIJKLMNOPQRST/);
  });

  it('a finished turn without any message is not an answer', () => {
    const events = parse([`{"type":"thread.started","thread_id":"${THREAD}"}`, NOTICE, USAGE].join('\n'));
    expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'incomplete_stream' } });
  });

  it('skips lines it cannot read, and nothing counts after the end', () => {
    const p = new CodexJsonParser();
    expect(p.push('not json')[0].body).toMatchObject({ type: 'provider.error', error: { code: 'malformed_event' } });
    expect(p.push('{"no":"type"}')[0].body).toMatchObject({ type: 'provider.error' });
    expect(p.push('   ')).toEqual([]);
    p.push(USAGE);
    expect(p.finished).toBe(true);
    expect(p.push('{"type":"item.completed","item":{"id":"x","type":"agent_message","text":"late"}}')).toEqual([]);
  });

  it('usage tolerates odd numbers', () => {
    expect(usageOf({ input_tokens: 5, cached_input_tokens: 9, output_tokens: -1 })).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 9 });
    expect(usageOf(undefined)).toBeUndefined();
  });
});

// ── arguments ────────────────────────────────────────────────

const cases = JSON.parse(readFileSync(join(__dirname, '..', 'runtime', 'providers', 'codex', 'args.cases.json'), 'utf8')) as { allow: string[][]; deny: string[][] };

describe('Codex arguments', () => {
  it('the allowlist matches the shared cases (Rust checks the same file)', () => {
    for (const args of cases.allow) expect(checkCodexArgs(args), JSON.stringify(args).slice(0, 200)).toBeNull();
    for (const args of cases.deny) expect(checkCodexArgs(args), JSON.stringify(args).slice(0, 200)).not.toBeNull();
  });

  it('every built command line is allowed, with every Codex tool off', () => {
    const variants = [
      turnArgs({}),
      turnArgs({ model: 'gpt-5.6-luna', systemPrompt: 'Sei "Hana".\nRispondi in italiano.\t\\ \u0001 \0 è 🎉', session: { mode: 'new' } }),
      turnArgs({ model: 'gpt-6-sol', session: { mode: 'resume', id: THREAD } }),
    ];
    for (const args of variants) {
      expect(checkCodexArgs(args)).toBeNull();
      expect(args.at(-1)).toBe('-');
      expect(args).toContain(WEB_SEARCH_OFF);
      for (const f of DISABLED_FEATURES) expect(args.join(' ')).toContain(`--disable ${f}`);
    }
    expect(variants[0]).toContain('--ephemeral');
    expect(variants[1]).not.toContain('--ephemeral');
    expect(variants[2].slice(-3)).toEqual(['resume', THREAD, '-']);
  });

  it('the system prompt travels as one escaped TOML string after RealmNest’s plain-text prompt', () => {
    const args = turnArgs({ systemPrompt: 'Line "one"\nC:\\path' });
    const value = args.find((a) => a.startsWith('developer_instructions='))!.slice('developer_instructions='.length);
    expect(value).not.toMatch(/[\n\r]/);
    // the escapes used are a subset of JSON's
    expect(JSON.parse(value)).toBe(`${PLAIN_PROMPT}\n\nLine "one"\nC:\\path\n`);
    expect(JSON.parse(tomlString('a\u0001b\u007fc\0d'))).toBe('a\u0001b\u007fcd');
    expect(tomlString('\uD800x')).toBe('"\uFFFDx"');
  });

  it('a system prompt too long for a command line is refused before spawning', () => {
    expect(() => turnArgs({ systemPrompt: 'a'.repeat(MAX_INSTRUCTIONS) })).toThrow();
  });

  it('only an absolute CODEX_HOME may be set', () => {
    expect(checkCodexEnv({ CODEX_HOME: 'D:\\Codex\\work' })).toBeNull();
    expect(checkCodexEnv({ CODEX_HOME: 'relative' })).not.toBeNull();
    expect(checkCodexEnv({ OPENAI_API_KEY: 'x' })).not.toBeNull();
  });
});

// ── models ───────────────────────────────────────────────────

const ENTRIES: CodexModelEntry[] = [
  { slug: 'gpt-6-sol', displayName: 'GPT-6-Sol', reasoningLevels: ['low', 'medium', 'high'], priority: 3, contextWindow: 272000, inputModalities: ['text', 'image'] },
  { slug: 'gpt-6.1-sol', displayName: 'GPT-6.1-Sol', reasoningLevels: ['low'], priority: 1, inputModalities: ['text', 'image'] },
  { slug: 'bad id; x', reasoningLevels: [], inputModalities: [] },
  { slug: 'gpt-6-sol', reasoningLevels: [], inputModalities: [] },
];

const source = (load: () => Promise<CodexModelEntry[]>, available = true): CodexModelSource & { dirs: (string | undefined)[] } => {
  const dirs: (string | undefined)[] = [];
  return {
    available,
    dirs,
    load: (d) => {
      dirs.push(d);
      return load();
    },
  };
};

describe('Codex models', () => {
  it('come from the account cache, in Codex’s order', () => {
    const models = modelsFromCache(ENTRIES);
    expect(models.map((m) => m.id)).toEqual(['gpt-6.1-sol', 'gpt-6-sol']);
    expect(models[1]).toMatchObject({ label: 'GPT-6-Sol', providerLabel: 'openai', contextLength: 272000, inputModalities: ['text', 'image'], outputModalities: ['text'], reasoning: { efforts: ['low', 'medium', 'high'] } });
  });

  it('the provider asks its own Codex folder, and falls back to the catalogue', async () => {
    const s = source(async () => ENTRIES);
    const p = new CodexProvider(new FakeRunner({}), { models: s, configDir: 'D:\\Codex\\work' });
    expect((await p.listModels()).map((m) => m.id)).toEqual(['gpt-6.1-sol', 'gpt-6-sol']);
    expect(s.dirs).toEqual(['D:\\Codex\\work']);
    expect(await new CodexProvider(new FakeRunner({}), { models: source(async () => Promise.reject(new Error('no cache'))) }).listModels()).toBe(CODEX_FALLBACK_MODELS);
    expect(await new CodexProvider(new FakeRunner({}), { models: source(async () => []) }).listModels()).toBe(CODEX_FALLBACK_MODELS);
    expect(await new CodexProvider(new FakeRunner({})).listModels()).toBe(CODEX_FALLBACK_MODELS);
    expect(CODEX_FALLBACK_MODELS.map((m) => m.id)).not.toContain('codex-auto-review');
  });

  it('effort levels: never "ultra" (Codex delegation, off here), with the model’s default', () => {
    const all = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
    expect(modelInfo({ slug: 'gpt-6-sol', reasoningLevels: all, defaultReasoningLevel: 'medium', inputModalities: [] }).reasoning).toEqual({ efforts: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'medium' });
    expect(modelInfo({ slug: 'x', reasoningLevels: all, defaultReasoningLevel: 'ultra', inputModalities: [] }).reasoning).toEqual({ efforts: ['low', 'medium', 'high', 'xhigh', 'max'] });
    expect(modelInfo({ slug: 'x', reasoningLevels: ['ultra', 'turbo'], inputModalities: [] }).reasoning).toBeUndefined();
    for (const m of CODEX_FALLBACK_MODELS) {
      expect(m.reasoning?.efforts).not.toContain('ultra');
      expect(m.reasoning?.efforts).toContain(m.reasoning?.default);
    }
  });
});

// ── provider ─────────────────────────────────────────────────

type Script = (spec: ProcessSpec, cb: ProcessCallbacks) => Promise<ProcessEnd>;

class FakeRunner implements ProcessRunner {
  readonly available = true;
  calls: ProcessSpec[] = [];
  constructor(
    private scripts: { version?: Script; login?: Script; turn?: Script },
    private location: ProgramLocation = { found: true, path: 'C:\\Tools\\codex\\…\\codex.exe', source: 'npm' },
  ) {}
  async locate() {
    return this.location;
  }
  run(spec: ProcessSpec, cb: ProcessCallbacks = {}) {
    this.calls.push(spec);
    const which = spec.args[0] === '--version' ? 'version' : spec.args[0] === 'login' ? 'login' : 'turn';
    const s = this.scripts[which];
    return s ? s(spec, cb) : Promise.resolve<ProcessEnd>({ kind: 'exit', code: 0, signal: null });
  }
}

const exit = (code: number | null, signal: string | null = null): ProcessEnd => ({ kind: 'exit', code, signal });
const prints =
  (stdout: string, end: ProcessEnd = exit(0), stderr = ''): Script =>
  async (_spec, cb) => {
    cb.onSpawn?.();
    for (let i = 0; i < stdout.length; i += 37) cb.onStdout?.(stdout.slice(i, i + 37));
    if (stderr) cb.onStderr?.(stderr);
    return end;
  };
const version: Script = prints('codex-cli 0.162.1\n');
const signedIn: Script = prints('Logged in using ChatGPT\n');

const req = (over: Partial<ProviderTurnRequest> = {}): ProviderTurnRequest => ({ runId: 'r1', messages: [{ role: 'user', content: 'Reply with: PONG' }], ...over });

async function collect(it: AsyncIterable<ProviderEvent>) {
  const out: ProviderEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('CodexProvider status', () => {
  it('is AVAILABLE when installed and signed in with ChatGPT', async () => {
    const s = await new CodexProvider(new FakeRunner({ version, login: signedIn })).getStatus();
    expect(s).toMatchObject({ state: 'available', version: '0.162.1', details: { auth: 'ChatGPT', source: 'npm' } });
  });

  it('is NOT_AUTHENTICATED when signed out (exit 1, message on stderr)', async () => {
    const out: Script = prints('', exit(1), 'WARNING: proceeding, even though we could not create PATH aliases\nNot logged in\n');
    const s = await new CodexProvider(new FakeRunner({ version, login: out }), { configDir: 'D:\\Codex\\work' }).getStatus();
    expect(s.state).toBe('not_authenticated');
    expect(s.hint).toContain('CODEX_HOME="D:\\Codex\\work"');
  });

  it('an API-key sign-in is not a ChatGPT account (and the key is never shown)', async () => {
    const s = await new CodexProvider(new FakeRunner({ version, login: prints('Logged in using an API key - sk-proj-***ABCDE\n') })).getStatus();
    expect(s).toMatchObject({ state: 'not_authenticated', details: { auth: 'API key' } });
    expect(JSON.stringify(s)).not.toContain('ABCDE');
  });

  it('is NOT_INSTALLED / UNAVAILABLE when the CLI or the host is missing', async () => {
    const missing: Script = async () => ({ kind: 'spawn_error', code: 'not_found', message: 'codex was not found' });
    const s = await new CodexProvider(new FakeRunner({ version: missing }, { found: false })).getStatus();
    expect(s.state).toBe('not_installed');
    // a clean PC has no Node: the standalone CLI comes first, npm only as an alternative
    expect(s.hint).toMatch(/^Download the standalone Codex CLI/);
    expect(s.hint).toContain('REALMNEST_CODEX_PATH');
    expect((await new CodexProvider(new UnavailableProcessRunner()).getStatus()).state).toBe('unavailable');
  });
});

describe('CodexProvider turns', () => {
  it('a new session: allowlisted args, prompt on stdin, the thread id as session', async () => {
    const runner = new FakeRunner({ turn: prints(OK_TURN) });
    const events = await collect(new CodexProvider(runner).runTurn(req({ session: { mode: 'new' }, model: 'gpt-5.6-luna', systemPrompt: 'Sei "Hana".' })));
    const call = runner.calls[0];
    expect(call.program).toBe('codex');
    expect(checkCodexArgs(call.args)).toBeNull();
    expect(call.args).not.toContain('--ephemeral');
    expect(call.args).toContain('gpt-5.6-luna');
    expect(call.stdin).toBe('Reply with: PONG');
    expect(call.cwd).toBeUndefined();
    expect(events.map((e) => e.type)).toEqual(['provider.started', 'session.started', 'message.started', 'text.completed', 'usage.updated', 'run.completed']);
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'PONG', sessionId: THREAD, runId: 'r1', providerId: 'codex' });
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gives a turn with RealmNest tools the longest wall clock (approvals and slow tools count)', async () => {
    const runner = new FakeRunner({ turn: prints(OK_TURN) });
    const p = new CodexProvider(runner);
    await collect(p.runTurn(req()));
    await collect(p.runTurn(req({ runId: 'r2', realmnestBridge: { configPath: 'C:/x/realmnest-bridge/run-1.json', tools: ['mcp__realmnest__echo'] } })));
    expect(runner.calls.map((c) => c.timeoutMs)).toEqual([5 * 60_000, BRIDGED_TURN_TIMEOUT_MS]);
    expect(BRIDGED_TURN_TIMEOUT_MS).toBe(30 * 60_000);
  });

  it('resumes the session with codex exec resume and only the new message', async () => {
    const runner = new FakeRunner({ turn: prints(TWO_MESSAGES) });
    const events = await collect(
      new CodexProvider(runner, { configDir: 'D:\\Codex\\work' }).runTurn(
        req({ session: { mode: 'resume', id: THREAD }, messages: [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'ok' }, { role: 'user', content: 'and now?' }] }),
      ),
    );
    const call = runner.calls[0];
    expect(call.args.slice(-3)).toEqual(['resume', THREAD, '-']);
    expect(checkCodexArgs(call.args)).toBeNull();
    expect(call.stdin).toBe('and now?');
    expect(call.env).toEqual({ CODEX_HOME: 'D:\\Codex\\work' });
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'There are three files.' });
  });

  it('sends model_reasoning_effort only for a level the model lists', async () => {
    const runner = new FakeRunner({ turn: prints(OK_TURN) });
    const p = new CodexProvider(runner, { models: source(async () => ENTRIES) });
    const turn = (n: number, over: Partial<ProviderTurnRequest>) => collect(p.runTurn(req({ runId: `r${n}`, ...over })));
    await turn(1, { model: 'gpt-6-sol', effort: 'high' });
    await turn(2, { model: 'gpt-6.1-sol', effort: 'high' });
    await turn(3, { model: 'gpt-6-sol', effort: 'ultra' });
    await turn(4, { model: 'gpt-6-sol' });
    const effortOf = (args: readonly string[]) => args.find((a) => a.startsWith('model_reasoning_effort='));
    expect(runner.calls.map((c) => effortOf(c.args))).toEqual(['model_reasoning_effort="high"', undefined, undefined, undefined]);
    runner.calls.forEach((c) => expect(checkCodexArgs(c.args)).toBeNull());
    // even asked directly, the command line never carries "ultra"
    expect(turnArgs({ effort: 'ultra' }).join(' ')).not.toContain('model_reasoning_effort');
    expect(checkCodexArgs(turnArgs({ effort: 'max', model: 'gpt-6-sol' }))).toBeNull();
  });

  it('a session Codex no longer has is session_not_found', async () => {
    const runner = new FakeRunner({ turn: prints('', exit(1), 'Error: thread/resume: thread/resume failed: no rollout found for thread id 01a13f45-0000-7b82-91ce-b622e62aa89a (code -32600)\n') });
    const events = await collect(new CodexProvider(runner).runTurn(req({ session: { mode: 'resume', id: THREAD } })));
    expect(events.at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'session_not_found' } });
  });

  it('a one-off turn is ephemeral and reports no session', async () => {
    const runner = new FakeRunner({ turn: prints(OK_TURN) });
    const events = await collect(new CodexProvider(runner).runTurn(req()));
    expect(runner.calls[0].args).toContain('--ephemeral');
    expect(events.some((e) => e.type === 'session.started')).toBe(false);
    expect((events.at(-1) as { sessionId?: string }).sessionId).toBeUndefined();
  });

  it('failures: the API error, signed out, a process that ends early, a timeout', async () => {
    const run = async (turn: Script) => (await collect(new CodexProvider(new FakeRunner({ turn })).runTurn(req()))).at(-1);
    expect(await run(prints(MODEL_FAILURE, exit(1)))).toMatchObject({ type: 'run.failed', error: { code: 'model_unavailable' } });
    expect(await run(prints(SIGNED_OUT_TURN, exit(1)))).toMatchObject({ type: 'run.failed', error: { code: 'not_authenticated' } });
    // retries only, then the process gives up without a turn.failed
    expect(await run(prints('{"type":"error","message":"Reconnecting... 5/5 (unexpected status 401 Unauthorized)"}\n', exit(1)))).toMatchObject({ error: { code: 'not_authenticated' } });
    expect(await run(prints(`{"type":"thread.started","thread_id":"${THREAD}"}\n`, exit(0)))).toMatchObject({ error: { code: 'incomplete_stream' } });
    expect(await run(prints('', exit(2), 'boom'))).toMatchObject({ error: { code: 'process_exit', detail: 'boom' } });
    expect(await run(async () => ({ kind: 'timeout', timeoutMs: 1000 }))).toMatchObject({ error: { code: 'timeout' } });
    expect(await run(async () => ({ kind: 'spawn_error', code: 'denied', message: 'argument not allowed' }))).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('refuses what it cannot send: history without a session, attachments, an empty prompt', async () => {
    const runner = new FakeRunner({ turn: prints(OK_TURN) });
    const p = new CodexProvider(runner);
    const history = await collect(p.runTurn(req({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] })));
    expect(history).toMatchObject([{ type: 'run.failed', error: { code: 'invalid_request' } }]);
    const image = await collect(p.runTurn(req({ messages: [{ role: 'user', content: 'look', attachments: [{ kind: 'image', name: 'a.png', mime: 'image/png', data: 'AAAA' }] }] })));
    expect(image).toMatchObject([{ type: 'run.failed', error: { code: 'invalid_request' } }]);
    const long = await collect(p.runTurn(req({ systemPrompt: 'x'.repeat(MAX_INSTRUCTIONS) })));
    expect(long).toMatchObject([{ type: 'run.failed', error: { code: 'invalid_request' } }]);
    expect(await collect(p.runTurn(req({ messages: [{ role: 'user', content: '  ' }] })))).toMatchObject([{ type: 'run.failed' }]);
    expect(runner.calls).toHaveLength(0);
  });

  it('cancelling stops the process and ends with run.cancelled', async () => {
    const turn: Script = (spec, cb) =>
      new Promise((resolve) => {
        cb.onSpawn?.();
        spec.signal?.addEventListener('abort', () => resolve({ kind: 'cancelled' }));
      });
    const p = new CodexProvider(new FakeRunner({ turn }));
    const ac = new AbortController();
    const events: ProviderEvent[] = [];
    for await (const e of p.runTurn(req({ abortSignal: ac.signal }))) {
      events.push(e);
      if (e.type === 'provider.started') ac.abort();
    }
    expect(events.at(-1)).toMatchObject({ type: 'run.cancelled' });
  });
});

describe('Codex definition', () => {
  it('is ChatGPT by OpenAI, one ChatGPT-account method with an optional Codex folder', () => {
    const def = createCodexDefinition();
    expect(def).toMatchObject({ id: 'codex', name: 'ChatGPT', vendor: 'OpenAI', availability: 'available' });
    expect(def.methods.map((m) => m.id)).toEqual(['cli-session']);
    expect(def.checkConfig?.('cli-session', { configDir: 'relative' })).toBeTruthy();
    expect(def.checkConfig?.('cli-session', { configDir: 'D:\\Codex\\work' })).toBeNull();
    const caps = def.capabilities!({} as never, CODEX_CAPABILITIES);
    expect(caps['sessions.native']?.support).toBe('supported');
    expect(caps['tools.calling']?.support).toBe('supported');
    expect(CODEX_CAPABILITIES).toMatchObject({ sessions: true, tools: false, toolCalling: false, vision: false, cost: false, usage: true });
  });
});

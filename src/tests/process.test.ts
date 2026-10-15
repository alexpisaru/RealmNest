import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BridgeProcessRunner } from '../runtime/process/bridge';
import { checkRequest, createBridgeHandler } from '../runtime/process/node/bridge';
import { NodeProcessRunner, type HostProgram } from '../runtime/process/node/runner';
import { checkClaudeEnv } from '../runtime/providers/claude-code/args';
import { claudeEnv, claudeHostProgram } from '../runtime/providers/claude-code/host';

// Real child processes (node itself stands in for a CLI).

/** `node -e <script>`; only scripts from SCRIPTS may run, like a real allowlist */
const SCRIPTS: Record<string, string> = {
  echo: `process.stdin.setEncoding('utf8'); let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ process.stdout.write('got:'+s+'\\n'); process.stderr.write('warn\\n'); process.exit(3); });`,
  stream: `let i=0; const t=setInterval(()=>{ process.stdout.write('line'+(i++)+'\\n'); if(i===3){ clearInterval(t); } },20);`,
  hang: `process.stdout.write('started\\n'); setInterval(()=>{},1000);`,
  tree: `const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); process.stdout.write('child:'+c.pid+'\\n'); setInterval(()=>{},1000);`,
  env: `process.stdout.write('var:'+process.env.REALMNEST_TEST_VAR);`,
};

const nodeProgram = (overrides: Partial<HostProgram> = {}): HostProgram => ({
  id: 'node-test',
  locate: async () => ({ command: process.execPath, prefixArgs: [], path: process.execPath, source: 'test' }),
  checkArgs: (args) => (args.length === 2 && args[0] === '-e' && Object.values(SCRIPTS).includes(args[1]) ? null : 'script not allowed'),
  defaultCwd: () => mkdtempSync(join(tmpdir(), 'realmnest-test-')),
  ...overrides,
});

const runner = new NodeProcessRunner([nodeProgram(), nodeProgram({ id: 'missing', locate: async () => null })]);

async function capture(r: { run: NodeProcessRunner['run'] }, spec: Parameters<NodeProcessRunner['run']>[0]) {
  let out = '';
  let err = '';
  let spawned = false;
  const end = await r.run(spec, { onSpawn: () => (spawned = true), onStdout: (d) => (out += d), onStderr: (d) => (err += d) });
  return { end, out, err, spawned };
}

describe('NodeProcessRunner', () => {
  it('passes stdin, streams stdout/stderr and reports the exit code', async () => {
    const r = await capture(runner, { program: 'node-test', args: ['-e', SCRIPTS.echo], stdin: 'hello' });
    expect(r.spawned).toBe(true);
    expect(r.out).toBe('got:hello\n');
    expect(r.err).toBe('warn\n');
    expect(r.end).toEqual({ kind: 'exit', code: 3, signal: null });
  });

  it('delivers output while the process is still running', async () => {
    const chunks: string[] = [];
    await runner.run({ program: 'node-test', args: ['-e', SCRIPTS.stream] }, { onStdout: (d) => chunks.push(d) });
    expect(chunks.join('')).toBe('line0\nline1\nline2\n');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('kills the process tree on timeout', async () => {
    const t0 = Date.now();
    const r = await capture(runner, { program: 'node-test', args: ['-e', SCRIPTS.hang], timeoutMs: 1_000 });
    expect(r.end).toEqual({ kind: 'timeout', timeoutMs: 1_000 });
    expect(r.out).toContain('started');
    expect(Date.now() - t0).toBeLessThan(8_000);
  });

  it('kills grandchildren too (the whole tree)', async () => {
    const r = await capture(runner, { program: 'node-test', args: ['-e', SCRIPTS.tree], timeoutMs: 1_500 });
    expect(r.end.kind).toBe('timeout');
    const pid = Number(/child:(\d+)/.exec(r.out)?.[1]);
    expect(pid).toBeGreaterThan(0);
    const alive = () => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    for (let i = 0; i < 40 && alive(); i++) await new Promise((res) => setTimeout(res, 100));
    expect(alive()).toBe(false);
  });

  it('kills the process on abort', async () => {
    const ac = new AbortController();
    const end = await runner.run({ program: 'node-test', args: ['-e', SCRIPTS.hang], signal: ac.signal }, { onStdout: () => ac.abort() });
    expect(end).toEqual({ kind: 'cancelled' });
  });

  it('refuses unknown programs, unlisted arguments and bad working directories', async () => {
    expect((await runner.run({ program: 'bash', args: [] })).kind).toBe('spawn_error');
    expect(await runner.run({ program: 'node-test', args: ['-e', 'require("fs").rmSync("/")'] })).toMatchObject({ kind: 'spawn_error', code: 'denied' });
    expect(await runner.run({ program: 'node-test', args: ['-e', SCRIPTS.echo], cwd: 'relative/dir' })).toMatchObject({ kind: 'spawn_error', code: 'denied' });
    expect(await runner.run({ program: 'node-test', args: ['-e', SCRIPTS.echo], cwd: join(tmpdir(), 'does-not-exist-realmnest') })).toMatchObject({ kind: 'spawn_error', code: 'denied' });
  });

  it('reports a program that is not installed', async () => {
    expect(await runner.run({ program: 'missing', args: ['-e', SCRIPTS.echo] })).toMatchObject({ kind: 'spawn_error', code: 'not_found' });
    expect(await runner.locate('missing')).toEqual({ found: false });
    expect(await runner.locate('node-test')).toMatchObject({ found: true, source: 'test' });
  });
});

describe('per-run environment', () => {
  const withEnv = new NodeProcessRunner([nodeProgram({ id: 'env-test', checkEnv: (env) => (Object.keys(env).every((k) => k === 'REALMNEST_TEST_VAR') ? null : 'not allowed') }), nodeProgram()]);

  it('passes only the variables a program allows', async () => {
    const ok = await capture(withEnv, { program: 'env-test', args: ['-e', SCRIPTS.env], env: { REALMNEST_TEST_VAR: 'hello' } });
    expect(ok.out).toBe('var:hello');
    expect(await withEnv.run({ program: 'env-test', args: ['-e', SCRIPTS.env], env: { PATH: 'x' } })).toMatchObject({ kind: 'spawn_error', code: 'denied' });
    // a program without checkEnv accepts none
    expect(await withEnv.run({ program: 'node-test', args: ['-e', SCRIPTS.env], env: { REALMNEST_TEST_VAR: 'x' } })).toMatchObject({ kind: 'spawn_error', code: 'denied' });
  });

  it('Claude accepts only its config folder, as an absolute existing path', () => {
    const host = claudeHostProgram();
    expect(host.checkEnv!({ CLAUDE_CONFIG_DIR: tmpdir() })).toBeNull();
    expect(host.checkEnv!({ CLAUDE_CONFIG_DIR: join(tmpdir(), 'realmnest-no-such-folder') })).toMatch(/does not exist/);
    expect(host.checkEnv!({ CLAUDE_CONFIG_DIR: 'relative/dir' })).toMatch(/absolute/);
    expect(host.checkEnv!({ ANTHROPIC_API_KEY: 'x' })).toMatch(/not allowed/);
    expect(checkClaudeEnv({ CLAUDE_CONFIG_DIR: 'C:\\Users\\me\\claude-work' })).toBeNull();
  });
});

describe('Claude Code host environment', () => {
  it('drops variables that bind a child to a running Claude Code session, keeps user config', () => {
    const env = claudeEnv({
      PATH: '/bin',
      CLAUDECODE: '1',
      CLAUDE_CODE_SESSION_ID: 'x',
      CLAUDE_CODE_MESSAGING_TOKEN: 'secret',
      CLAUDE_AGENT_SDK_VERSION: '1',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'user-token',
      ANTHROPIC_API_KEY: 'k',
    });
    expect(Object.keys(env).sort()).toEqual(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'PATH']);
  });
});

describe('dev-server process bridge', () => {
  const token = 'a'.repeat(48);
  let server: Server;
  let base: string;
  let host: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (!req.url?.startsWith('/__realmnest/process')) return void res.end();
      req.url = req.url.slice('/__realmnest/process'.length);
      void createBridgeHandler(runner, token)(req, res);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    base = `http://${host}/__realmnest/process`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('checks host, origin and token', () => {
    const ok = { method: 'POST', headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'x-realmnest-bridge': token } };
    expect(checkRequest(ok, token)).toBeNull();
    expect(checkRequest({ ...ok, method: 'GET' }, token)).toMatch(/method/);
    expect(checkRequest({ ...ok, headers: { ...ok.headers, host: 'evil.example:5173' } }, token)).toMatch(/host/);
    expect(checkRequest({ ...ok, headers: { ...ok.headers, origin: 'https://evil.example' } }, token)).toMatch(/origin/);
    expect(checkRequest({ ...ok, headers: { ...ok.headers, 'x-realmnest-bridge': 'b'.repeat(48) } }, token)).toMatch(/token/);
    expect(checkRequest({ ...ok, headers: { host: 'localhost:5173' } }, token)).toMatch(/token/);
  });

  it('streams a real process to the browser runner', async () => {
    const r = await capture(new BridgeProcessRunner(token, base), { program: 'node-test', args: ['-e', SCRIPTS.echo], stdin: 'via bridge' });
    expect(r).toMatchObject({ spawned: true, out: 'got:via bridge\n', err: 'warn\n', end: { kind: 'exit', code: 3 } });
  });

  it('kills the process when the page aborts', async () => {
    const ac = new AbortController();
    const end = await new BridgeProcessRunner(token, base).run({ program: 'node-test', args: ['-e', SCRIPTS.hang], signal: ac.signal }, { onStdout: () => ac.abort() });
    expect(end).toEqual({ kind: 'cancelled' });
  });

  it('refuses requests with a wrong token, and arguments outside the allowlist', async () => {
    const bad = await new BridgeProcessRunner('x'.repeat(48), base).run({ program: 'node-test', args: ['-e', SCRIPTS.echo] });
    expect(bad).toMatchObject({ kind: 'spawn_error', code: 'denied' });
    const evil = await new BridgeProcessRunner(token, base).run({ program: 'node-test', args: ['-e', 'process.exit(0)'] });
    expect(evil).toMatchObject({ kind: 'spawn_error', code: 'denied' });
  });

  it('answers locate', async () => {
    expect(await new BridgeProcessRunner(token, base).locate('node-test')).toMatchObject({ found: true });
  });

  it('is unavailable without a token (production build)', async () => {
    const r = new BridgeProcessRunner(null, base);
    expect(r.available).toBe(false);
    expect(await r.run({ program: 'node-test', args: [] })).toMatchObject({ kind: 'spawn_error', code: 'host_unavailable' });
  });
});

// ─────────────────────────────────────────────────────────────
// NodeProcessRunner: runs allowlisted programs with child_process (Node only:
// the Vite dev server, tests, a future Node sidecar). Never imported by the
// browser bundle.
//
// Safety: no shell, explicit argv, programs resolved by the host (callers
// cannot pass paths), per-program argument allowlists, validated cwd,
// timeouts, and the whole process tree is killed on cancel/timeout/exit.
// ─────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';
import type { ProcessCallbacks, ProcessEnd, ProcessRunner, ProcessSpec, ProgramLocation } from '../types';

export interface ResolvedProgram {
  /** executable to spawn */
  command: string;
  /** arguments placed before the caller's (e.g. a script path for node) */
  prefixArgs: string[];
  /** what to show the user */
  path: string;
  source: string;
}

/** A program the host is willing to run, with its own rules. */
export interface HostProgram {
  id: string;
  /** find the executable; null when it is not installed */
  locate(): Promise<ResolvedProgram | null>;
  /** null when the arguments are allowed, otherwise the reason */
  checkArgs(args: readonly string[]): string | null;
  /** environment for the child, derived from the host's */
  env?(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  /** null when the request's extra variables are allowed; without it, none are */
  checkEnv?(env: Readonly<Record<string, string>>): string | null;
  /** working directory when the request does not give one (created if missing) */
  defaultCwd?(): string;
}

export interface NodeRunnerOptions {
  /** upper bound for any timeout a caller asks for */
  maxTimeoutMs?: number;
  /** used when the caller gives no timeout */
  defaultTimeoutMs?: number;
  maxStdinBytes?: number;
}

const live = new Set<ChildProcess>();
let exitHookInstalled = false;

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  // do not leave orphans behind when the host (dev server) stops
  process.once('exit', () => live.forEach((c) => killTree(c)));
}

/** Kill a child and everything it started. */
export function killTree(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') {
    const k = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    k.on('error', () => child.kill());
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM'); // its own process group (detached)
    } catch {
      child.kill('SIGTERM');
    }
    const pid = child.pid;
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, 3_000).unref();
  }
}

export class NodeProcessRunner implements ProcessRunner {
  readonly available = true;
  private programs = new Map<string, HostProgram>();
  private maxTimeoutMs: number;
  private defaultTimeoutMs: number;
  private maxStdinBytes: number;

  constructor(programs: HostProgram[], opts: NodeRunnerOptions = {}) {
    programs.forEach((p) => this.programs.set(p.id, p));
    this.maxTimeoutMs = opts.maxTimeoutMs ?? 30 * 60_000;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 5 * 60_000;
    this.maxStdinBytes = opts.maxStdinBytes ?? 24_000_000;
    installExitHook();
  }

  async locate(id: string): Promise<ProgramLocation> {
    const program = this.programs.get(id);
    const found = program ? await program.locate() : null;
    return found ? { found: true, path: found.path, source: found.source } : { found: false };
  }

  async run(spec: ProcessSpec, cb: ProcessCallbacks = {}): Promise<ProcessEnd> {
    const denied = (message: string): ProcessEnd => ({ kind: 'spawn_error', code: 'denied', message });
    const program = this.programs.get(spec.program);
    if (!program) return denied(`program "${String(spec.program).slice(0, 40)}" is not allowed`);
    if (!Array.isArray(spec.args) || spec.args.some((a) => typeof a !== 'string')) return denied('arguments must be strings');
    const why = program.checkArgs(spec.args);
    if (why) return denied(why);
    if (spec.stdin !== undefined && (typeof spec.stdin !== 'string' || Buffer.byteLength(spec.stdin) > this.maxStdinBytes)) return denied('stdin too large');
    const extraEnv = spec.env ?? {};
    if (Object.keys(extraEnv).length) {
      if (Object.values(extraEnv).some((v) => typeof v !== 'string')) return denied('environment values must be strings');
      const envWhy = program.checkEnv ? program.checkEnv(extraEnv) : 'no environment variables are allowed for this program';
      if (envWhy) return denied(envWhy);
    }

    let cwd: string;
    if (spec.cwd !== undefined) {
      if (typeof spec.cwd !== 'string' || !isAbsolute(spec.cwd) || !isDir(spec.cwd)) return denied('workspace must be an existing absolute directory');
      cwd = spec.cwd;
    } else {
      cwd = program.defaultCwd?.() ?? homedir();
      try {
        mkdirSync(cwd, { recursive: true });
      } catch (err) {
        return { kind: 'spawn_error', code: 'failed', message: `cannot create workspace: ${(err as Error).message}` };
      }
    }

    const resolved = await program.locate();
    if (!resolved) return { kind: 'spawn_error', code: 'not_found', message: `${program.id} was not found on this computer` };
    if (spec.signal?.aborted) return { kind: 'cancelled' };

    const timeoutMs = Math.min(Math.max(spec.timeoutMs ?? this.defaultTimeoutMs, 1_000), this.maxTimeoutMs);

    return new Promise<ProcessEnd>((resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(resolved.command, [...resolved.prefixArgs, ...spec.args], {
          cwd,
          env: { ...(program.env ? program.env(process.env) : process.env), ...extraEnv },
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          windowsHide: true,
          detached: process.platform !== 'win32',
        });
      } catch (err) {
        resolve({ kind: 'spawn_error', code: 'failed', message: (err as Error).message });
        return;
      }
      let spawned = false;
      let reason: 'timeout' | 'cancelled' | null = null;
      let settled = false;
      const finish = (end: ProcessEnd) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        spec.signal?.removeEventListener('abort', onAbort);
        live.delete(child);
        resolve(end);
      };
      const stop = (why: 'timeout' | 'cancelled') => {
        if (reason || settled) return;
        reason = why;
        killTree(child);
      };
      const onAbort = () => stop('cancelled');
      const timer = setTimeout(() => stop('timeout'), timeoutMs);
      spec.signal?.addEventListener('abort', onAbort);

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (spawned) return; // reported through 'close'
        finish({ kind: 'spawn_error', code: err.code === 'ENOENT' ? 'not_found' : err.code === 'EACCES' ? 'denied' : 'failed', message: err.message });
      });
      child.on('spawn', () => {
        spawned = true;
        live.add(child);
        cb.onSpawn?.();
        child.stdin?.on('error', () => {}); // the child may exit before reading stdin
        child.stdin?.end(spec.stdin ?? '');
      });
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (d: string) => cb.onStdout?.(d));
      child.stderr?.on('data', (d: string) => cb.onStderr?.(d));
      child.on('close', (code, signal) => {
        if (!spawned) return;
        if (reason === 'timeout') finish({ kind: 'timeout', timeoutMs });
        else if (reason === 'cancelled') finish({ kind: 'cancelled' });
        else finish({ kind: 'exit', code, signal });
      });
    });
  }
}

function isDir(p: string) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

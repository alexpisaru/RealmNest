// ─────────────────────────────────────────────────────────────
// Host side of the Codex adapter (Node only, the dev bridge): where the native `codex`
// binary lives, which arguments may reach it, and its environment. The Rust twin is
// src-tauri/src/programs/codex.rs. Register it with the process bridge in vite.config.ts
// next to claudeHostProgram().
// ─────────────────────────────────────────────────────────────

import { readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, extname, join } from 'node:path';
import type { HostProgram, ResolvedProgram } from '../../process/node/runner';
import { CODEX_PROGRAM, checkCodexArgs, checkCodexEnv } from './args';

const WIN = process.platform === 'win32';
const EXE = WIN ? 'codex.exe' : 'codex';

/**
 * Never passed on: what ties a process to a running Codex session or sandbox, and API keys
 * (a turn always uses the ChatGPT sign-in, never bills a key by surprise). Same list as Rust.
 */
const DROPPED = /^(OPENAI_API_KEY|CODEX_API_KEY|CODEX_SANDBOX|CODEX_SANDBOX_NETWORK_DISABLED|CODEX_THREAD_ID|CODEX_SESSION_ID|CODEX_MANAGED_PACKAGE_ROOT|CODEX_INTERNAL_ORIGINATOR_OVERRIDE|CODEX_MANAGED_BY_.*)$/;

/**
 * Codex's log filter, always exactly this: a rate-limited request (429) and Codex's silent wait
 * before retrying (often minutes) appear only in its log, never in the JSON events. This puts that
 * one warning on stderr, where the provider stops the turn (parser.ts `retryWait`). Same as Rust.
 */
export const RETRY_LOG = 'codex_core::responses_retry=warn';

export function codexEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) if (!DROPPED.test(k) && k !== 'RUST_LOG') env[k] = v;
  env.RUST_LOG = RETRY_LOG;
  return env;
}

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

const isDir = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** the npm platform package and target triple of this machine (as codex.js picks them) */
const TARGETS: Record<string, [string, string]> = {
  'win32-x64': ['codex-win32-x64', 'x86_64-pc-windows-msvc'],
  'win32-arm64': ['codex-win32-arm64', 'aarch64-pc-windows-msvc'],
  'darwin-x64': ['codex-darwin-x64', 'x86_64-apple-darwin'],
  'darwin-arm64': ['codex-darwin-arm64', 'aarch64-apple-darwin'],
  'linux-x64': ['codex-linux-x64', 'x86_64-unknown-linux-musl'],
  'linux-arm64': ['codex-linux-arm64', 'aarch64-unknown-linux-musl'],
};

/** the native binary inside an npm install of @openai/codex (its package folder) */
export function nativeInPackage(pkgDir: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name !== '@openai/codex') return null;
  } catch {
    return null;
  }
  const target = TARGETS[`${process.platform}-${process.arch}`];
  if (!target) return null;
  const [platform, triple] = target;
  for (const dir of [join(pkgDir, 'node_modules', '@openai', platform), join(dirname(pkgDir), platform), pkgDir]) {
    const exe = join(dir, 'vendor', triple, 'bin', EXE);
    if (isFile(exe)) return exe;
  }
  return null;
}

/** an npm global prefix on Windows: <prefix>\codex.cmd + <prefix>\node_modules\@openai\codex */
const fromPrefix = (prefix: string) => nativeInPackage(join(prefix, 'node_modules', '@openai', 'codex'));

/** Discovery order: REALMNEST_CODEX_PATH (executable or npm prefix), PATH, %APPDATA%\npm. No machine-specific folders: a Codex anywhere else is named with REALMNEST_CODEX_PATH. */
export function locateCodex(env: NodeJS.ProcessEnv = process.env): ResolvedProgram | null {
  const direct = (path: string, source: string): ResolvedProgram => ({ command: path, prefixArgs: [], path, source });

  const explicit = env.REALMNEST_CODEX_PATH;
  if (explicit) {
    const shim = /\.cmd$/i.test(explicit);
    if (isFile(explicit) && !shim) return direct(explicit, 'env');
    const native = fromPrefix(shim ? dirname(explicit) : explicit);
    if (native) return direct(native, 'env');
  }

  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)) {
    const exe = join(dir, EXE);
    if (WIN) {
      if (isFile(join(dir, 'codex.cmd'))) {
        const native = fromPrefix(dir);
        if (native) return direct(native, 'path');
      }
      if (isFile(exe)) return direct(exe, 'path');
    } else if (isFile(exe)) {
      // an npm install links bin/codex to the package's codex.js
      let real = exe;
      try {
        real = realpathSync(exe);
      } catch {
        // keep the link
      }
      if (extname(real) === '.js') {
        const native = nativeInPackage(dirname(dirname(real)));
        if (native) return direct(native, 'path');
        continue;
      }
      return direct(exe, 'path');
    }
  }

  if (WIN) {
    for (const prefix of [join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm')]) {
      if (!isDir(prefix)) continue;
      const native = fromPrefix(prefix);
      if (native) return direct(native, 'npm');
    }
  }
  return null;
}

/** RealmNest's empty folder for Codex turns: no project AGENTS.md or git repository by accident */
export const codexWorkspace = () => join(homedir(), '.nestra', 'codex');

export function codexHostProgram(): HostProgram {
  let cache: { at: number; value: ResolvedProgram | null } | null = null;
  return {
    id: CODEX_PROGRAM,
    async locate() {
      if (!cache || Date.now() - cache.at > 10_000) cache = { at: Date.now(), value: locateCodex() };
      return cache.value;
    },
    checkArgs: checkCodexArgs,
    checkEnv: (env) => {
      const why = checkCodexEnv(env);
      if (why) return why;
      for (const v of Object.values(env)) if (!isDir(v)) return 'the Codex folder does not exist';
      return null;
    },
    env: codexEnv,
    defaultCwd: codexWorkspace,
  };
}

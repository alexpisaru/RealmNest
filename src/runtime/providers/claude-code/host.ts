// ─────────────────────────────────────────────────────────────
// Host side of the Claude Code adapter (Node only): where the `claude`
// executable lives, which arguments may reach it, and its environment.
// Registered with the process host in vite.config.ts.
// ─────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import type { HostProgram, ResolvedProgram } from '../../process/node/runner';
import { CLAUDE_PROGRAM, checkClaudeArgs, checkClaudeEnv } from './args';

const WIN = process.platform === 'win32';
const EXE = WIN ? 'claude.exe' : 'claude';

/**
 * Variables that tie a process to a *running* Claude Code session (set when
 * RealmNest itself is started from inside Claude Code). Passing them on would
 * make the child talk to that session instead of acting on its own.
 * User configuration (CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_OAUTH_TOKEN, …) is kept.
 */
const SESSION_VARS = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_AGENT_SDK_.*|CLAUDE_CODE_(ENTRYPOINT|SESSION_.*|HOST_.*|CHILD_SESSION|MESSAGING_.*|SDK_.*|EAGER_FLUSH|EMIT_.*|ENABLE_(ASK_USER_QUESTION_TOOL|SDK_FILE_CHECKPOINTING)|DESKTOP_APP_VERSION|ACCOUNT_UUID|ORGANIZATION_UUID|USER_EMAIL|OAUTH_SCOPES|REPORT_FINDINGS|TERMINAL_MCP_TOOLS|DISABLE_TERMINAL_TITLE|DISABLE_CRON|AUTOUPDATER_DISABLED_BY_HOST|SIMPLE))$/;

export function claudeEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) if (!SESSION_VARS.test(k)) env[k] = v;
  return env;
}

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/** an npm global install on Windows is a .cmd shim; run its JS entry with node instead of a shell */
function fromNpmShim(shim: string): ResolvedProgram | null {
  const pkgDir = join(dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code');
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { bin?: string | Record<string, string> };
    const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.claude;
    if (!rel) return null;
    const entry = join(pkgDir, rel);
    if (!isFile(entry)) return null;
    return /\.(c|m)?js$/.test(entry)
      ? { command: process.execPath, prefixArgs: [entry], path: entry, source: 'path' }
      : { command: entry, prefixArgs: [], path: entry, source: 'path' };
  } catch {
    return null;
  }
}

const semverKey = (v: string) => v.split(/[.-]/).map((n) => n.padStart(6, '0')).join('.');

/**
 * The Store (MSIX) build of the Claude desktop app keeps its AppData in the
 * package's own folder. Processes started by the app see it under %APPDATA%
 * (virtualized); everything else, including the user's terminal, only finds it
 * here. Listed first so the path we show works in any shell.
 */
function msixRoots(): string[] {
  const packages = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Packages');
  try {
    return readdirSync(packages)
      .filter((d) => /^Claude_[a-z0-9]+$/i.test(d))
      .map((d) => join(packages, d, 'LocalCache', 'Roaming', 'Claude', 'claude-code'));
  } catch {
    return [];
  }
}

/** the copy of Claude Code that ships with the Claude desktop app */
function desktopBundle(): string | null {
  const roots = WIN
    ? [...msixRoots(), join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude-code')]
    : process.platform === 'darwin'
      ? [join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code')]
      : [join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Claude', 'claude-code')];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root).filter((d) => /^\d+\.\d+\.\d+/.test(d)).sort((a, b) => semverKey(b).localeCompare(semverKey(a)));
    for (const v of versions) {
      for (const build of readdirSync(join(root, v))) {
        const exe = join(root, v, build, EXE);
        if (isFile(exe)) return exe;
      }
    }
  }
  return null;
}

export function locateClaude(env: NodeJS.ProcessEnv = process.env): ResolvedProgram | null {
  const direct = (path: string, source: string): ResolvedProgram => ({ command: path, prefixArgs: [], path, source });

  // NESTRA_CLAUDE_PATH: the name before the RealmNest rebrand, still honoured
  const explicit = env.REALMNEST_CLAUDE_PATH ?? env.NESTRA_CLAUDE_PATH;
  if (explicit && isFile(explicit)) return direct(explicit, 'env');

  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)) {
    const exe = join(dir, EXE);
    if (isFile(exe)) return direct(exe, 'path');
    if (WIN) {
      const shim = join(dir, 'claude.cmd');
      if (isFile(shim)) {
        const r = fromNpmShim(shim);
        if (r) return r;
      }
    }
  }

  for (const p of [join(homedir(), '.local', 'bin', EXE), join(homedir(), '.claude', 'local', EXE)]) if (isFile(p)) return direct(p, 'native');

  const bundled = desktopBundle();
  return bundled ? direct(bundled, 'desktop-app') : null;
}

export function claudeHostProgram(): HostProgram {
  let cache: { at: number; value: ResolvedProgram | null } | null = null;
  return {
    id: CLAUDE_PROGRAM,
    async locate() {
      // cheap filesystem checks, cached briefly so a status check + a turn do not repeat them
      if (!cache || Date.now() - cache.at > 10_000) cache = { at: Date.now(), value: locateClaude() };
      return cache.value;
    },
    checkArgs: checkClaudeArgs,
    checkEnv: (env) => {
      const why = checkClaudeEnv(env);
      if (why) return why;
      for (const v of Object.values(env)) {
        try {
          if (!statSync(v).isDirectory()) return 'the Claude config folder does not exist';
        } catch {
          return 'the Claude config folder does not exist';
        }
      }
      return null;
    },
    env: claudeEnv,
    // a neutral folder: no project CLAUDE.md, settings or MCP servers get picked up by accident
    defaultCwd: () => join(homedir(), '.nestra', 'workspace'),
  };
}

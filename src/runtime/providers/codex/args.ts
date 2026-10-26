// ─────────────────────────────────────────────────────────────
// Codex CLI command lines (the ChatGPT provider): how RealmNest builds them, and the
// allowlist the process hosts enforce before anything is spawned. The Rust twin is
// src-tauri/src/programs/codex.rs; args.cases.json keeps the two identical.
// Flags were checked against `codex exec --help` (Codex CLI 0.162.1).
//
// Every turn is `codex exec --json … -`: the prompt goes to stdin, read-only, without the
// user's config.toml, and with all of Codex's own tools off (RealmNest has its own tools
// and approvals); a one-off search turn may use OpenAI's web search and nothing else. The
// allowlist requires those switches, it does not merely permit them.
// ─────────────────────────────────────────────────────────────

import type { ProviderSessionRef } from '../types';

export const CODEX_PROGRAM = 'codex';

/** Codex features switched off on every turn: shell, apps, browser, computer use, plugins, sub-agents, image tools, hooks… */
export const DISABLED_FEATURES = [
  'shell_tool',
  'apps',
  'browser_use',
  'browser_use_external',
  'computer_use',
  'in_app_browser',
  'plugins',
  'remote_plugin',
  'sleep_tool',
  'goals',
  'code_mode_host',
  'image_generation',
  'unified_exec',
  'multi_agent',
  'view_image',
  'hooks',
  'tool_suggest',
  'skill_search',
  'skill_mcp_dependency_install',
] as const;

/** Codex's own web search: off on every turn but a search turn */
export const WEB_SEARCH_OFF = 'web_search="disabled"';
/**
 * A search turn (ProviderTurnRequest.webSearch, e.g. Deep Research): OpenAI's live search and nothing
 * else. Only one-off turns, without a session and without RealmNest tools; the results come back as
 * structured `web_search` items (URLs from the search, never written by the model).
 */
export const WEB_SEARCH_LIVE = 'web_search="live"';
/** the system prompt travels as `-c developer_instructions=<TOML string>` */
export const INSTRUCTIONS_KEY = 'developer_instructions';
/** UTF-16 code units of the whole TOML string, quotes and escapes included */
export const MAX_INSTRUCTIONS = 20_000;
/** the reasoning effort travels as `-c model_reasoning_effort="<level>"` */
export const EFFORT_KEY = 'model_reasoning_effort';
/**
 * The levels RealmNest may ask Codex for. Not "ultra": it means reasoning plus Codex's own
 * task delegation (multi-agent), which every turn switches off.
 */
export const CODEX_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Codex's own (agentic, coding) instructions assume tools; with every tool off, this tells
 * the model what it is here. The caller's system prompt follows it.
 */
export const PLAIN_PROMPT = 'You are an assistant in RealmNest. In this conversation you have no tools and no access to files, commands, the web or memory: answer in plain text.';
/** a turn with RealmNest tools (the RealmNest MCP bridge): only those tools exist */
export const BRIDGE_PROMPT = 'You are an assistant in RealmNest. Your only tools are the RealmNest tools offered here (MCP server "realmnest"); you have no other tools, files, commands, web or memory. Use a tool when it helps, wait for its result (RealmNest may ask the user first), then answer in plain text.';
/** a search turn: web search is the only tool */
export const SEARCH_PROMPT = 'You are a search assistant in RealmNest. Your only tool is web search. Search as asked, then reply in one short line; never invent results.';

/** RealmNest tools: `--realmnest-bridge <config>`, expanded by the hosts into Codex's MCP settings */
export const BRIDGE_FLAG = '--realmnest-bridge';
/** Codex calls MCP tools and its web search through its code-mode host: on only on bridge and search turns, every other tool stays off */
export const BRIDGE_NEEDS = 'code_mode_host';
/** RealmNest's bridge configs: <absolute>/realmnest-bridge/<session>.json (Rust also checks it is RealmNest's own folder) */
const BRIDGE_CONFIG = /^(?:[A-Za-z]:[\\/]|\/)(?:(?!\.\.)[^\0])*[\\/]realmnest-bridge[\\/][A-Za-z0-9_-]{1,64}\.json$/;

export interface TurnArgsOptions {
  model?: string;
  systemPrompt?: string;
  /** none: a one-off turn that Codex does not keep (--ephemeral) */
  session?: ProviderSessionRef;
  /** RealmNest tools through the RealmNest MCP bridge (its session config) */
  bridge?: { configPath: string };
  /** reasoning effort (one of CODEX_EFFORTS; the provider drops anything else) */
  effort?: string;
  /** a search turn (WEB_SEARCH_LIVE): honoured only for a one-off turn without the bridge */
  webSearch?: boolean;
}

export const versionArgs = (): string[] => ['--version'];
export const loginStatusArgs = (): string[] => ['login', 'status'];

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** A TOML basic string: quotes, backslashes and control characters escaped, nothing raw. */
export function tomlString(text: string): string {
  let out = '"';
  for (const ch of text.replace(/\0/g, '').replace(LONE_SURROGATE, '�')) {
    const code = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

/** the instructions argument for a system prompt; null when it does not fit on a command line */
export function instructionsArg(systemPrompt: string | undefined, mode: 'plain' | 'bridge' | 'search' = 'plain'): string | null {
  const base = mode === 'bridge' ? BRIDGE_PROMPT : mode === 'search' ? SEARCH_PROMPT : PLAIN_PROMPT;
  // Codex appends its own blocks (e.g. <skills_instructions>) right after: end on a line break
  const value = tomlString(`${[base, systemPrompt?.trim()].filter(Boolean).join('\n\n')}\n`);
  return value.length > MAX_INSTRUCTIONS ? null : `${INSTRUCTIONS_KEY}=${value}`;
}

/** a search turn is one-off and has no RealmNest tools; otherwise the search stays off */
export const isSearchTurn = (o: TurnArgsOptions) => !!o.webSearch && !o.bridge && !o.session;

/** Throws when the system prompt is too long for a command line (the provider checks first). */
export function turnArgs(o: TurnArgsOptions): string[] {
  const search = isSearchTurn(o);
  const instructions = instructionsArg(o.systemPrompt, o.bridge ? 'bridge' : search ? 'search' : 'plain');
  if (!instructions) throw new Error('system prompt too long');
  const args = ['exec', '--json', '--skip-git-repo-check', '-s', 'read-only', '--ignore-user-config'];
  // a one-off turn leaves nothing behind; a session is kept by Codex under the thread id it reports
  if (!o.session) args.push('--ephemeral');
  // Codex calls tools (MCP tools, its web search) through the code-mode host: on only for bridge and search turns
  for (const f of DISABLED_FEATURES) if (!((o.bridge || search) && f === BRIDGE_NEEDS)) args.push('--disable', f);
  args.push('-c', search ? WEB_SEARCH_LIVE : WEB_SEARCH_OFF, '-c', instructions);
  if (o.effort && CODEX_EFFORTS.includes(o.effort)) args.push('-c', `${EFFORT_KEY}="${o.effort}"`);
  if (o.bridge) args.push(BRIDGE_FLAG, o.bridge.configPath);
  if (o.model) args.push('-m', o.model);
  if (o.session?.mode === 'resume') args.push('resume', o.session.id);
  args.push('-');
  return args;
}

// ── allowlist ────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

/** the shape tomlString writes: escapes only, no raw quotes or control characters */
function isTomlString(v: string): boolean {
  if (v.length < 3 || v.length > MAX_INSTRUCTIONS || !v.startsWith('"') || !v.endsWith('"')) return false;
  const inner = v.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    const code = c.charCodeAt(0);
    if (c === '"') return false;
    if (c === '\\') {
      const e = inner[++i];
      if (e === 'u') {
        const hex = inner.slice(i + 1, i + 5);
        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) return false;
        const n = parseInt(hex, 16);
        if (n >= 0xd800 && n <= 0xdfff) return false;
        i += 4;
      } else if (e === undefined || !'btnfr"\\'.includes(e)) return false;
    } else if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

const SWITCHES = new Set(['--json', '--skip-git-repo-check', '--ignore-user-config', '--ephemeral']);

/** environment variables a connection may set: a separate Codex folder (= a separate account) */
export const CODEX_HOME_ENV = 'CODEX_HOME';

const isAbsolutePath = (p: string) => /^([A-Za-z]:[\\/]|\\\\|\/)/.test(p);

/** Shape check for the per-run environment (the hosts also check the folder exists). Null when allowed. */
export function checkCodexEnv(env: Readonly<Record<string, string>>): string | null {
  for (const [k, v] of Object.entries(env)) {
    if (k !== CODEX_HOME_ENV) return `environment variable not allowed: ${k.slice(0, 40)}`;
    if (typeof v !== 'string' || !v || v.length > 1024 || v.includes('\0') || !isAbsolutePath(v)) return `${CODEX_HOME_ENV} must be an absolute folder path`;
  }
  return null;
}

/** whole command lines allowed verbatim */
const EXACT: string[][] = [versionArgs(), loginStatusArgs()];

/**
 * Returns null when the arguments are allowed, otherwise the reason. Anything not listed is
 * refused: other sandboxes, --dangerously-*, --add-dir, -C, --profile, --oss, images, other
 * -c keys, enabling features, a prompt on the command line…
 */
export function checkCodexArgs(args: readonly string[]): string | null {
  if (EXACT.some((e) => e.length === args.length && e.every((a, i) => a === args[i]))) return null;
  if (args[0] !== 'exec') return 'only codex exec is allowed';
  const n = args.length;
  if (n < 2 || args[n - 1] !== '-') return 'the prompt must come from stdin (-)';
  // `exec <options> resume <session id> -` continues a session
  const resume = n >= 4 && args[n - 3] === 'resume';
  if (resume && !UUID.test(args[n - 2])) return 'invalid session id';
  const opts = args.slice(1, resume ? n - 3 : n - 1);
  const seen = new Set<string>();
  const disabled = new Set<string>();
  const config = new Set<string>();
  let liveSearch = false;
  for (let i = 0; i < opts.length; i++) {
    const name = opts[i];
    if (SWITCHES.has(name)) {
      if (seen.has(name)) return `duplicate flag: ${name}`;
      seen.add(name);
      continue;
    }
    const value = opts[++i];
    if (name === '-s' || name === '-m') {
      if (seen.has(name)) return `duplicate flag: ${name}`;
      seen.add(name);
      const ok = name === '-s' ? value === 'read-only' : value !== undefined && MODEL.test(value);
      if (!ok) return `invalid value for ${name}`;
    } else if (name === BRIDGE_FLAG) {
      if (seen.has(name)) return `duplicate flag: ${name}`;
      seen.add(name);
      if (value === undefined || value.length > 1024 || !BRIDGE_CONFIG.test(value)) return 'invalid value for --realmnest-bridge';
    } else if (name === '--disable') {
      if (value === undefined || !(DISABLED_FEATURES as readonly string[]).includes(value)) return 'invalid value for --disable';
      if (disabled.has(value)) return `duplicate --disable ${value}`;
      disabled.add(value);
    } else if (name === '-c') {
      if (value === WEB_SEARCH_LIVE) liveSearch = true;
      const key =
        value === WEB_SEARCH_OFF || value === WEB_SEARCH_LIVE
          ? 'web_search'
          : value?.startsWith(`${INSTRUCTIONS_KEY}=`) && isTomlString(value.slice(INSTRUCTIONS_KEY.length + 1))
            ? INSTRUCTIONS_KEY
            : CODEX_EFFORTS.some((e) => value === `${EFFORT_KEY}="${e}"`)
              ? EFFORT_KEY
              : null;
      if (!key) return 'invalid value for -c';
      if (config.has(key)) return `duplicate -c ${key}`;
      config.add(key);
    } else return `argument not allowed: ${name.slice(0, 40)}`;
  }
  for (const required of ['--json', '--skip-git-repo-check', '--ignore-user-config', '-s']) if (!seen.has(required)) return `${required} is required`;
  if (!config.has('web_search')) return 'the web search setting is required';
  // a bridge turn keeps the code-mode host (Codex calls MCP tools through it); every other tool is off
  const bridge = seen.has(BRIDGE_FLAG);
  // live search only on a one-off search turn: no session, no RealmNest tools
  if (liveSearch && (bridge || resume || !seen.has('--ephemeral'))) return 'web search is only for a one-off turn without RealmNest tools';
  if (bridge && disabled.has(BRIDGE_NEEDS)) return 'a bridge turn needs the code-mode host';
  // Codex's web search runs through the code-mode host too (with it off, a search turn hangs)
  if (liveSearch && disabled.has(BRIDGE_NEEDS)) return 'a search turn needs the code-mode host';
  const on = DISABLED_FEATURES.find((f) => !disabled.has(f) && !((bridge || liveSearch) && f === BRIDGE_NEEDS));
  if (on) return `Codex's own tools must be off (--disable ${on})`;
  if (resume && seen.has('--ephemeral')) return 'a resumed session cannot be ephemeral';
  return null;
}

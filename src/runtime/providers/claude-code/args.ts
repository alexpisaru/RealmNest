// ─────────────────────────────────────────────────────────────
// Claude Code command lines: how RealmNest builds them, and the allowlist the
// process host enforces before anything is spawned. Both live here so they
// cannot drift apart. Flags were checked against `claude --help` (2.1.293; --effort: 2.1.295).
//
// The prompt never goes on the command line: it is written to stdin, so it
// needs no quoting and cannot be mistaken for a flag.
// ─────────────────────────────────────────────────────────────

import type { ProviderSessionRef } from '../types';
import { CLAUDE_EFFORTS } from './models';

export const CLAUDE_PROGRAM = 'claude';

export interface TurnArgsOptions {
  model?: string;
  /** the caller's system prompt (see turnArgs for how it reaches Claude Code) */
  systemPrompt?: string;
  /** built-in tools allowed this turn; [] disables every tool */
  tools: string[];
  /** none: a one-off turn that Claude Code does not keep */
  session?: ProviderSessionRef;
  /** stdin is one stream-json user message (used for images and PDFs) instead of plain text */
  jsonInput?: boolean;
  /** RealmNest tools through the RealmNest MCP bridge: its config file and the names Claude may call (`mcp__realmnest__…`) */
  bridge?: { configPath: string; tools: string[] };
  /** a web search turn: only the WebSearch tool, allowed without a prompt */
  webSearch?: boolean;
  /** Web on for this chat or agent (ProviderTurnRequest.providerWeb): WebSearch next to the turn's other tools */
  web?: boolean;
  /** `--effort` level (one of CLAUDE_EFFORTS; the provider drops anything else) */
  effort?: string;
}

/**
 * With no tools enabled, Claude Code's own (agentic) system prompt makes the model
 * act out tool calls and memory lookups as text. Such turns replace it with this.
 */
export const PLAIN_PROMPT = 'You are an assistant in RealmNest. In this conversation you have no tools and no access to files, the web or memory: answer in plain text.';

/** a turn with RealmNest tools (bridge): only those tools exist, Claude's own are off */
export const BRIDGE_PROMPT =
  'You are an assistant in RealmNest. Your only tools are the RealmNest tools offered here (their names start with mcp__realmnest__); you have no other tools, files, web or memory. Use a tool when it helps, wait for its result (RealmNest may ask the user first), then answer in plain text.';

/** a turn with Web on and no RealmNest tools: Claude's own WebSearch only */
export const WEB_PROMPT = 'You are an assistant in RealmNest. Your only tool is WebSearch, your own web search: use it when the answer needs current or outside information. You have no files, commands or memory. Answer in plain text and name the pages you used (title and address).';

/** a turn with RealmNest tools and Web on: those tools plus Claude's own WebSearch */
export const BRIDGE_WEB_PROMPT =
  'You are an assistant in RealmNest. Your tools are the RealmNest tools offered here (their names start with mcp__realmnest__) and WebSearch, your own web search; you have no other tools, files or memory. Use a tool when it helps, wait for its result (RealmNest may ask the user first), then answer in plain text and name the web pages you used (title and address).';

/** Claude Code's own web search tool (Anthropic's search) */
export const WEB_SEARCH_TOOL = 'WebSearch';

/** `--setting-sources`: required on every turn (checkClaudeArgs) */
export const SETTING_SOURCES = 'user';

/** a search turn: the only tool is WebSearch */
export const SEARCH_PROMPT = 'You are a search assistant in RealmNest. Your only tool is WebSearch. Search as asked, then reply in one short line; never invent results.';

export const versionArgs = (): string[] => ['--version'];
export const authStatusArgs = (): string[] => ['auth', 'status', '--json'];

export function turnArgs(o: TurnArgsOptions): string[] {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    ...(o.jsonInput ? ['--input-format', 'stream-json'] : []),
    // stream-json in print mode needs --verbose; partial messages give text deltas
    '--verbose',
    '--include-partial-messages',
    // nobody can answer a permission prompt here: anything that would ask is denied
    '--permission-prompts', 'none',
    // no MCP servers from the user's or the account's configuration (claude.ai connectors, local servers)
    '--strict-mcp-config',
    // the user's own settings only: never a project's .claude/settings*.json (hooks, env, apiKeyHelper) or CLAUDE.md
    '--setting-sources', SETTING_SOURCES,
  ];
  // a new session is kept by Claude Code under an id it picks (reported in its init message)
  if (o.session?.mode === 'resume') args.push('--resume', o.session.id);
  else if (!o.session) args.push('--no-session-persistence');
  if (o.model) args.push('--model', o.model);
  if (o.effort) args.push('--effort', o.effort);
  if (o.bridge) {
    // RealmNest's own MCP server (with --strict-mcp-config: nothing else), and only its tools (and WebSearch with Web on) may run without a prompt
    args.push('--mcp-config', o.bridge.configPath, '--allowedTools', [...o.bridge.tools, ...(o.web ? [WEB_SEARCH_TOOL] : [])].join(','));
    args.push('--system-prompt', [o.web ? BRIDGE_WEB_PROMPT : BRIDGE_PROMPT, o.systemPrompt].filter(Boolean).join('\n\n'));
  } else if (o.webSearch) {
    // a search turn: Claude's own WebSearch (Anthropic's search) and nothing else, allowed without a prompt
    args.push('--system-prompt', [SEARCH_PROMPT, o.systemPrompt].filter(Boolean).join('\n\n'), '--allowedTools', WEB_SEARCH_TOOL);
  } else if (o.web) {
    // Web on, no RealmNest tools: WebSearch alone, allowed without a prompt
    args.push('--system-prompt', [WEB_PROMPT, o.systemPrompt].filter(Boolean).join('\n\n'), '--allowedTools', WEB_SEARCH_TOOL);
  } else if (!o.tools.length) args.push('--system-prompt', [PLAIN_PROMPT, o.systemPrompt].filter(Boolean).join('\n\n'));
  else if (o.systemPrompt) args.push('--append-system-prompt', o.systemPrompt);
  // last, so this variadic flag can never swallow anything after it
  args.push('--tools', o.web || (o.webSearch && !o.bridge) ? WEB_SEARCH_TOOL : o.tools.join(','));
  return args;
}

// ── allowlist ────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:\-[\]]{0,79}$/;
/** RealmNest's bridge configs: <absolute>/realmnest-bridge/<session>.json (Rust also checks it is RealmNest's own folder) */
const BRIDGE_CONFIG = /^(?:[A-Za-z]:[\\/]|\/)(?:(?!\.\.)[^\0])*[\\/]realmnest-bridge[\\/][A-Za-z0-9_-]{1,64}\.json$/;
const BRIDGE_TOOL = /^mcp__realmnest__[A-Za-z0-9_-]{1,64}$/;

/** --allowedTools: RealmNest bridge tools (at most 32) and WebSearch (at most once), nothing else */
function isAllowedToolList(v: string): boolean {
  const list = v.split(',');
  const bridge = list.filter((t) => BRIDGE_TOOL.test(t)).length;
  const web = list.filter((t) => t === WEB_SEARCH_TOOL).length;
  return !!v && bridge <= 32 && web <= 1 && bridge + web === list.length;
}

/** flag → null (no value) or a check for its value */
const FLAGS: Record<string, ((v: string) => boolean) | null> = {
  '-p': null,
  '--verbose': null,
  '--include-partial-messages': null,
  '--no-session-persistence': null,
  '--strict-mcp-config': null,
  '--output-format': (v) => v === 'stream-json',
  '--input-format': (v) => v === 'stream-json',
  '--permission-prompts': (v) => v === 'none',
  '--setting-sources': (v) => v === SETTING_SOURCES,
  '--session-id': (v) => UUID.test(v),
  '--resume': (v) => UUID.test(v),
  '--model': (v) => MODEL.test(v),
  '--effort': (v) => CLAUDE_EFFORTS.includes(v),
  '--append-system-prompt': (v) => v.length > 0 && v.length <= 20_000 && !v.includes('\0'),
  '--system-prompt': (v) => v.length > 0 && v.length <= 20_000 && !v.includes('\0'),
  // Claude's own tools: none, or WebSearch alone (a search turn, or Web on) — never Bash, Read, Edit…
  '--tools': (v) => v === '' || v === WEB_SEARCH_TOOL,
  '--mcp-config': (v) => v.length <= 1024 && BRIDGE_CONFIG.test(v),
  '--allowedTools': isAllowedToolList,
};


/** environment variables a connection may set: a separate Claude config folder (= a separate account) */
export const CLAUDE_CONFIG_ENV = 'CLAUDE_CONFIG_DIR';

const isAbsolutePath = (p: string) => /^([A-Za-z]:[\\/]|\\\\|\/)/.test(p);

/**
 * Shape check for the per-run environment (the host also checks the folder exists).
 * Returns null when allowed, otherwise the reason.
 */
export function checkClaudeEnv(env: Readonly<Record<string, string>>): string | null {
  for (const [k, v] of Object.entries(env)) {
    if (k !== CLAUDE_CONFIG_ENV) return `environment variable not allowed: ${k.slice(0, 40)}`;
    if (typeof v !== 'string' || !v || v.length > 1024 || v.includes('\0') || !isAbsolutePath(v)) return `${CLAUDE_CONFIG_ENV} must be an absolute folder path`;
  }
  return null;
}

/** whole command lines allowed verbatim */
const EXACT: string[][] = [versionArgs(), authStatusArgs()];

/**
 * Returns null when the arguments are allowed, otherwise the reason.
 * Anything not listed is refused: --dangerously-skip-permissions, --mcp-config,
 * --settings, --add-dir, --plugin-url, positional prompts…
 */
export function checkClaudeArgs(args: readonly string[]): string | null {
  if (EXACT.some((e) => e.length === args.length && e.every((a, i) => a === args[i]))) return null;
  if (args[0] !== '-p') return 'only print mode (-p) is allowed';
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!(flag in FLAGS)) return `argument not allowed: ${flag.slice(0, 40)}`;
    if (seen.has(flag)) return `duplicate flag: ${flag}`;
    seen.add(flag);
    const check = FLAGS[flag];
    if (check) {
      const value = args[++i];
      if (value === undefined || !check(value)) return `invalid value for ${flag}`;
    }
  }
  if (seen.has('--session-id') && seen.has('--resume')) return '--session-id and --resume are exclusive';
  if (seen.has('--system-prompt') && seen.has('--append-system-prompt')) return '--system-prompt and --append-system-prompt are exclusive';
  // the bridge only with RealmNest's own config, and never Claude's own MCP sources
  if (seen.has('--mcp-config') && !seen.has('--strict-mcp-config')) return '--mcp-config needs --strict-mcp-config';
  // --allowedTools: the RealmNest bridge's tools (with --mcp-config) and/or WebSearch, which needs --tools WebSearch
  if (seen.has('--allowedTools')) {
    const allowed = args[args.indexOf('--allowedTools') + 1].split(',');
    const tools = seen.has('--tools') ? args[args.indexOf('--tools') + 1] : undefined;
    if (!seen.has('--mcp-config') && (allowed.length !== 1 || allowed[0] !== WEB_SEARCH_TOOL)) return '--allowedTools is only for the RealmNest bridge or a WebSearch turn';
    if (allowed.includes(WEB_SEARCH_TOOL) && tools !== WEB_SEARCH_TOOL) return 'WebSearch in --allowedTools needs --tools WebSearch';
  }
  if (!seen.has('--output-format')) return '--output-format stream-json is required';
  if (!seen.has('--setting-sources')) return '--setting-sources user is required';
  return null;
}

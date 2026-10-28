// ─────────────────────────────────────────────────────────────
// ClaudeCodeProvider: RealmNest's adapter for the user's local Claude Code.
//
// It uses the CLI's own sign-in (subscription or API key configured in Claude
// Code), so RealmNest never handles Anthropic credentials. Each turn is one
// `claude -p --output-format stream-json` process; its output is translated
// into normalized provider events by ClaudeStreamParser.
// ─────────────────────────────────────────────────────────────

import { AsyncQueue } from '../../../core/asyncQueue';
import type { ProcessEnd, ProcessRunner, ProgramLocation } from '../../process/types';
import { LineBuffer, TailBuffer, clip, redact } from '../../process/text';
import type {
  ProviderAttachment,
  ModelInfo,
  AIProvider,
  ProviderCapabilities,
  ProviderErrorInfo,
  ProviderEvent,
  ProviderEventBody,
  ProviderStatus,
  ProviderTurnRequest,
} from '../types';
import { isTerminal } from '../types';
import { authStatusArgs, CLAUDE_CONFIG_ENV, CLAUDE_PROGRAM, turnArgs, versionArgs } from './args';
import { ClaudeStreamParser } from './parser';
import { CLAUDE_MODELS } from './models';
import { acceptedEffort } from '../effort';
import type { ClaudeAuthStatus } from './types';

export const CLAUDE_CODE_ID = 'claude-code';

export const CLAUDE_CODE_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  // Claude Code runs its own built-in tools and reports them; RealmNest enables none by default
  tools: true,
  // images and PDFs go as content blocks on stream-json input
  vision: true,
  files: true,
  sessions: true,
  // the CLI runs locally, inference happens on Anthropic's servers
  local: false,
  usage: true,
  // total_cost_usd; an estimate for subscription users
  cost: true,
  cancellation: true,
  // the CLI cannot list models: RealmNest keeps the catalogue (models.ts)
  modelListing: true,
  systemPrompt: true,
  // RealmNest tools reach it as an MCP server owned by RealmNest (docs/MCP.md, "Claude bridge")
  toolBridge: true,
  // its own WebSearch tool (Anthropic's search), structured results in the stream
  webSearch: true,
  // and a chat or agent turn with Web on may use it too (ProviderTurnRequest.providerWeb)
  nativeWebInTurns: true,
};

export interface ClaudeCodeOptions {
  /** default turn timeout */
  turnTimeoutMs?: number;
  /** timeout of a turn with RealmNest tools (it may wait for approvals, delegated tasks, deep research) */
  bridgedTurnTimeoutMs?: number;
  /** timeout for `--version` / `auth status` */
  probeTimeoutMs?: number;
  /** a separate Claude config folder (CLAUDE_CONFIG_DIR): its own sign-in, i.e. another account */
  configDir?: string;
}

/** a turn with RealmNest tools: the process host's longest wall clock (process/mod.rs MAX_TIMEOUT_MS), since approvals and slow tools count too */
export const BRIDGED_TURN_TIMEOUT_MS = 30 * 60_000;

const LOGIN_HINT = 'Use Sign in on this connection (or run claude auth login in a terminal).';

export class ClaudeCodeProvider implements AIProvider {
  readonly id = CLAUDE_CODE_ID;
  readonly name = 'Claude';
  readonly capabilities = CLAUDE_CODE_CAPABILITIES;

  private runs = new Map<string, AbortController>();
  private turnTimeoutMs: number;
  private bridgedTurnTimeoutMs: number;
  private probeTimeoutMs: number;
  /** per-connection environment: only the config folder, allowlisted by the hosts */
  private env: Record<string, string> | undefined;
  private configDir: string | undefined;

  constructor(
    private runner: ProcessRunner,
    opts: ClaudeCodeOptions = {},
  ) {
    this.turnTimeoutMs = opts.turnTimeoutMs ?? 5 * 60_000;
    this.bridgedTurnTimeoutMs = opts.bridgedTurnTimeoutMs ?? BRIDGED_TURN_TIMEOUT_MS;
    this.probeTimeoutMs = opts.probeTimeoutMs ?? 20_000;
    this.configDir = opts.configDir?.trim() || undefined;
    this.env = this.configDir ? { [CLAUDE_CONFIG_ENV]: this.configDir } : undefined;
  }

  async listModels(): Promise<ModelInfo[]> {
    return CLAUDE_MODELS;
  }

  // ── status ───────────────────────────────────────────────

  async getStatus(): Promise<ProviderStatus> {
    const checkedAt = Date.now();
    const status = (s: Omit<ProviderStatus, 'checkedAt'>): ProviderStatus => ({ ...s, checkedAt });
    if (!this.runner.available) {
      return status({ state: 'unavailable', message: 'Claude Code cannot be reached from this build.', hint: 'Run RealmNest with `npm run dev` (or the desktop app) to use local providers.' });
    }
    const location = (await this.runner.locate?.(CLAUDE_PROGRAM).catch(() => undefined)) ?? undefined;
    const details: Record<string, string> = {};
    if (location?.path) details.path = location.path;
    if (location?.source) details.source = location.source;

    const version = await this.capture(versionArgs());
    if (version.end.kind === 'spawn_error') {
      if (version.end.code === 'not_found')
        return status({ state: 'not_installed', message: 'Claude Code not installed.', hint: 'Install it from https://claude.com/claude-code, or set REALMNEST_CLAUDE_PATH to its executable.' });
      if (version.end.code === 'host_unavailable') return status({ state: 'unavailable', message: 'Claude Code cannot be reached from this build.', hint: version.end.message });
      return status({ state: 'error', message: 'Claude Code could not be started.', details: { ...details, error: version.end.message } });
    }
    if (version.end.kind !== 'exit' || version.end.code !== 0) {
      return status({ state: 'error', message: 'Claude Code did not answer the version check.', details: { ...details, error: endText(version.end), stderr: clip(redact(version.stderr), 500) } });
    }
    const v = /(\d+\.\d+\.\d+[\w.-]*)/.exec(version.stdout)?.[1];

    const auth = await this.capture(authStatusArgs());
    // `auth status` exits 1 when signed out but still prints its JSON
    let parsed: ClaudeAuthStatus | null = null;
    try {
      parsed = JSON.parse(auth.stdout) as ClaudeAuthStatus;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed.loggedIn !== 'boolean') {
      return status({ state: 'error', message: 'Claude Code detected, but its sign-in status could not be read.', version: v, details: { ...details, error: endText(auth.end), stderr: clip(redact(auth.stderr), 500) } });
    }
    if (parsed.authMethod) details.auth = parsed.authMethod;
    if (parsed.apiProvider) details.apiProvider = parsed.apiProvider;
    // the plan, never the e-mail address or organisation
    if (parsed.subscriptionType) details.plan = parsed.subscriptionType;
    if (this.configDir) details.configDir = this.configDir;
    if (!parsed.loggedIn) {
      return status({ state: 'not_authenticated', message: 'Claude Code installed but not authenticated.', hint: loginHint(location, this.configDir), version: v, details });
    }
    return status({ state: 'available', message: 'Claude Code detected.', version: v, details });
  }

  async cancel(runId: string) {
    this.runs.get(runId)?.abort();
  }

  // ── turns ────────────────────────────────────────────────

  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    let seq = 0;
    const stamp = (body: ProviderEventBody, raw?: unknown): ProviderEvent =>
      ({ ...body, runId: req.runId, providerId: this.id, seq: ++seq, at: Date.now(), ...(raw !== undefined && { raw }) }) as ProviderEvent;

    const prompt = this.promptOf(req);
    if (typeof prompt !== 'string') {
      yield stamp({ type: 'run.failed', error: prompt });
      return;
    }

    const ac = new AbortController();
    const onAbort = () => ac.abort();
    req.abortSignal?.addEventListener('abort', onAbort);
    if (req.abortSignal?.aborted) ac.abort();
    this.runs.set(req.runId, ac);

    const files = req.messages.at(-1)?.attachments;
    const resume = req.session?.mode === 'resume';
    const parser = new ClaudeStreamParser({ resumed: resume });
    const lines = new LineBuffer();
    const stderr = new TailBuffer();
    const queue = new AsyncQueue<ProviderEvent>();
    let terminal = false;
    let settled = false;
    let sessionSeen = false;
    // a resume that fails before any session opens may be an unknown session: Claude only
    // says so on stderr, so that failure waits for the process to end
    let held: { body: ProviderEventBody; raw?: unknown } | null = null;
    const emit = (body: ProviderEventBody, raw?: unknown) => {
      if (terminal) return;
      if (body.type === 'session.started') sessionSeen = true;
      if (body.type === 'run.failed' && resume && !sessionSeen && !held) {
        held = { body, raw };
        return;
      }
      if (isTerminal(body)) terminal = true;
      queue.push(stamp(body, raw));
    };
    const feed = (batch: string[]) => batch.forEach((line) => parser.push(line).forEach((e) => emit(e.body, e.raw)));
    const timeoutMs = req.timeoutMs ?? (req.realmnestBridge ? this.bridgedTurnTimeoutMs : this.turnTimeoutMs);

    const finished = this.runner
      .run(
        {
          program: CLAUDE_PROGRAM,
          args: turnArgs({ model: req.model, systemPrompt: req.systemPrompt, tools: req.tools ?? [], session: req.session, jsonInput: !!files?.length, ...(req.realmnestBridge && { bridge: req.realmnestBridge }), ...(req.webSearch && !req.realmnestBridge && { webSearch: true }), ...(req.providerWeb && !req.webSearch && { web: true }), effort: acceptedEffort(CLAUDE_MODELS, req.model, req.effort) }),
          stdin: files?.length ? userLine(prompt, files) : prompt,
          // always RealmNest's own folder (the host's default), never the agent's workspace: a project's
          // CLAUDE.md, settings and hooks must not load; RealmNest tools get the workspace from their scope
          ...(this.env && { env: this.env }),
          timeoutMs,
          signal: ac.signal,
        },
        {
          onSpawn: () => emit({ type: 'provider.started', model: req.model }),
          onStdout: (chunk) => feed(lines.push(chunk)),
          onStderr: (chunk) => stderr.push(chunk),
        },
      )
      .then(
        (end) => {
          feed(lines.end());
          const missing = /No conversation found with session ID/i.test(stderr.toString());
          if (missing && req.session?.mode === 'resume')
            emit({ type: 'run.failed', error: { code: 'session_not_found', message: 'Claude Code no longer has this conversation’s session.', detail: clip(redact(stderr.toString().trim()), 500) } });
          else if (held) {
            const h: { body: ProviderEventBody; raw?: unknown } = held;
            held = null;
            sessionSeen = true; // let it through
            emit(h.body, h.raw);
          }
          if (!terminal) emit(this.endToTerminal(end, stderr.toString(), parser.lastApiError, timeoutMs));
        },
        (err) => emit({ type: 'run.failed', error: { code: 'unknown', message: 'Claude Code could not be run.', detail: redact(String(err)) } }),
      )
      .finally(() => {
        settled = true;
        queue.end();
      });

    try {
      for await (const e of queue) yield e;
      await finished;
    } finally {
      // the consumer stopped early: stop the process too
      if (!settled) ac.abort();
      req.abortSignal?.removeEventListener('abort', onAbort);
      this.runs.delete(req.runId);
    }
  }

  /** Claude Code -p takes one prompt; earlier history lives in its session. */
  private promptOf(req: ProviderTurnRequest): string | ProviderErrorInfo {
    const last = req.messages[req.messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) return { code: 'invalid_request', message: 'Write a prompt first.' };
    if (req.messages.length > 1 && req.session?.mode !== 'resume')
      return { code: 'invalid_request', message: 'Claude Code keeps conversation history in its session: resume it and send only the new user message.' };
    return last.content;
  }

  private endToTerminal(end: ProcessEnd, stderr: string, apiError: ProviderErrorInfo | null, timeoutMs: number): ProviderEventBody {
    const tail = clip(redact(stderr.trim()), 1_500) || undefined;
    switch (end.kind) {
      case 'cancelled':
        return { type: 'run.cancelled', reason: 'Cancelled.' };
      case 'timeout':
        return { type: 'run.failed', error: { code: 'timeout', message: `Claude Code did not finish within ${Math.round(timeoutMs / 1000)} s; it was stopped.` } };
      case 'spawn_error': {
        const map = {
          not_found: { code: 'not_installed', message: 'Claude Code not installed.' },
          host_unavailable: { code: 'unavailable', message: 'Claude Code cannot be reached from this build.' },
          denied: { code: 'invalid_request', message: 'RealmNest refused to start Claude Code with these settings.' },
          failed: { code: 'process_crashed', message: 'Claude Code could not be started.' },
        } as const;
        return { type: 'run.failed', error: { ...map[end.code], detail: end.message } };
      }
      case 'exit': {
        if (apiError) return { type: 'run.failed', error: apiError };
        if (end.code === 0) return { type: 'run.failed', error: { code: 'incomplete_stream', message: 'Claude Code exited without finishing its answer.', detail: tail } };
        if (end.code === null) return { type: 'run.failed', error: { code: 'process_crashed', message: `Claude Code stopped unexpectedly${end.signal ? ` (${end.signal})` : ''}.`, detail: tail } };
        if (tail && /not logged in|\/login|auth login/i.test(tail)) return { type: 'run.failed', error: { code: 'not_authenticated', message: 'Claude Code is not signed in.', detail: tail } };
        return { type: 'run.failed', error: { code: 'process_exit', message: `Claude Code exited with code ${end.code}.`, detail: tail } };
      }
    }
  }

  private async capture(args: string[]) {
    let stdout = '';
    const stderr = new TailBuffer(4_000);
    const end = await this.runner.run(
      { program: CLAUDE_PROGRAM, args, timeoutMs: this.probeTimeoutMs, ...(this.env && { env: this.env }) },
      { onStdout: (c) => (stdout += c), onStderr: (c) => stderr.push(c) },
    );
    return { end, stdout, stderr: stderr.toString() };
  }
}

function endText(end: ProcessEnd): string {
  switch (end.kind) {
    case 'exit':
      return end.code === null ? `killed (${end.signal})` : `exit code ${end.code}`;
    case 'timeout':
      return `timed out after ${end.timeoutMs} ms`;
    case 'cancelled':
      return 'cancelled';
    case 'spawn_error':
      return end.message;
  }
}

function loginHint(location: ProgramLocation | undefined, configDir?: string): string {
  // not on PATH (e.g. the copy bundled with the Claude desktop app): give the full command
  const exe = !location?.path || location.source === 'path' ? 'claude' : location.path.includes(' ') ? `& "${location.path}"` : location.path;
  if (configDir) return `Open PowerShell and run: $env:${CLAUDE_CONFIG_ENV}="${configDir}"; ${exe} auth login`;
  return exe === 'claude' ? LOGIN_HINT : `Open a terminal and run: ${exe} auth login`;
}

/** one stream-json user message: the prompt, then images / PDFs as base64 content blocks */
export function userLine(prompt: string, files: ProviderAttachment[]): string {
  const content: unknown[] = [{ type: 'text', text: prompt }];
  for (const f of files) {
    const source = { type: 'base64', media_type: f.kind === 'pdf' ? 'application/pdf' : f.mime, data: f.data };
    content.push({ type: f.kind === 'pdf' ? 'document' : 'image', source });
  }
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`;
}

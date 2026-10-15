// ─────────────────────────────────────────────────────────────
// CodexProvider: ChatGPT through the user's local Codex CLI, on the user's ChatGPT plan.
//
// It uses Codex's own sign-in (`codex login`), so RealmNest never handles OpenAI credentials.
// Each turn is one `codex exec --json … -` process with every Codex tool off; its JSONL is
// translated into normalized provider events by CodexJsonParser. Conversations live in Codex's
// own sessions (threads): a new one is kept under the thread id Codex reports, and continued
// with `codex exec resume <id>`.
// ─────────────────────────────────────────────────────────────

import { AsyncQueue } from '../../../core/asyncQueue';
import type { ProcessEnd, ProcessRunner } from '../../process/types';
import { LineBuffer, TailBuffer, clip } from '../../process/text';
import type { AIProvider, ModelInfo, ProviderCapabilities, ProviderErrorInfo, ProviderEvent, ProviderEventBody, ProviderStatus, ProviderTurnRequest } from '../types';
import { isTerminal } from '../types';
import { CODEX_HOME_ENV, CODEX_PROGRAM, MAX_INSTRUCTIONS, instructionsArg, loginStatusArgs, turnArgs, versionArgs } from './args';
import { CODEX_FALLBACK_MODELS, modelsFromCache, type CodexModelSource } from './models';
import { acceptedEffort } from '../effort';
import { CodexJsonParser, classifyError, redactCodex } from './parser';

export const CODEX_ID = 'codex';

export const CODEX_CAPABILITIES: ProviderCapabilities = {
  // Codex sends whole messages, not text deltas
  streaming: false,
  // Codex's own tools are switched off on every turn; RealmNest tools do not reach it yet
  tools: false,
  toolCalling: false,
  // RealmNest tools through the RealmNest MCP bridge (Codex calls them, RealmNest checks permissions and runs them)
  toolBridge: true,
  // not wired yet (`codex exec -i <file>` needs the attachment as a file)
  vision: false,
  files: false,
  sessions: true,
  // the CLI runs locally, inference happens on OpenAI's servers
  local: false,
  usage: true,
  // a subscription: no per-turn price
  cost: false,
  cancellation: true,
  modelListing: true,
  systemPrompt: true,
  webSearch: false,
};

export interface CodexOptions {
  /** where the account's model list comes from (the desktop host); the catalogue otherwise */
  models?: CodexModelSource;
  /** default turn timeout */
  turnTimeoutMs?: number;
  /** timeout of a turn with RealmNest tools (it may wait for approvals, delegated tasks, deep research) */
  bridgedTurnTimeoutMs?: number;
  /** timeout for `--version` / `login status` */
  probeTimeoutMs?: number;
  /** a separate Codex folder (CODEX_HOME): its own sign-in, i.e. another ChatGPT account */
  configDir?: string;
}

/** a turn with RealmNest tools: the process host's longest wall clock (process/mod.rs MAX_TIMEOUT_MS), since approvals and slow tools count too */
export const BRIDGED_TURN_TIMEOUT_MS = 30 * 60_000;

const LOGIN_HINT = 'Use Sign in on this connection (or run codex login in a terminal).';

export class CodexProvider implements AIProvider {
  readonly id = CODEX_ID;
  readonly name = 'ChatGPT';
  readonly capabilities = CODEX_CAPABILITIES;

  private runs = new Map<string, AbortController>();
  private turnTimeoutMs: number;
  private bridgedTurnTimeoutMs: number;
  private probeTimeoutMs: number;
  private env: Record<string, string> | undefined;
  private configDir: string | undefined;

  constructor(
    private runner: ProcessRunner,
    private opts: CodexOptions = {},
  ) {
    this.turnTimeoutMs = opts.turnTimeoutMs ?? 5 * 60_000;
    this.bridgedTurnTimeoutMs = opts.bridgedTurnTimeoutMs ?? BRIDGED_TURN_TIMEOUT_MS;
    this.probeTimeoutMs = opts.probeTimeoutMs ?? 20_000;
    this.configDir = opts.configDir?.trim() || undefined;
    this.env = this.configDir ? { [CODEX_HOME_ENV]: this.configDir } : undefined;
  }

  /** the account's models from Codex's cache; the catalogue when that cannot be read */
  async listModels(): Promise<ModelInfo[]> {
    const source = this.opts.models;
    if (!source?.available) return CODEX_FALLBACK_MODELS;
    try {
      const models = modelsFromCache(await source.load(this.configDir));
      return models.length ? models : CODEX_FALLBACK_MODELS;
    } catch {
      return CODEX_FALLBACK_MODELS;
    }
  }

  // ── status ───────────────────────────────────────────────

  async getStatus(): Promise<ProviderStatus> {
    const checkedAt = Date.now();
    const status = (s: Omit<ProviderStatus, 'checkedAt'>): ProviderStatus => ({ ...s, checkedAt });
    if (!this.runner.available) {
      return status({ state: 'unavailable', message: 'Codex cannot be reached from this build.', hint: 'Run RealmNest with `npm run dev` (or the desktop app) to use local providers.' });
    }
    const location = (await this.runner.locate?.(CODEX_PROGRAM).catch(() => undefined)) ?? undefined;
    const details: Record<string, string> = {};
    if (location?.path) details.path = location.path;
    if (location?.source) details.source = location.source;

    const version = await this.capture(versionArgs());
    if (version.end.kind === 'spawn_error') {
      if (version.end.code === 'not_found') return status({ state: 'not_installed', message: 'Codex not installed.', hint: 'Download the standalone Codex CLI from its official releases (github.com/openai/codex/releases), save it as codex.exe in a folder on PATH or set REALMNEST_CODEX_PATH to it. With Node.js, npm install -g @openai/codex also works.' });
      if (version.end.code === 'host_unavailable') return status({ state: 'unavailable', message: 'Codex cannot be reached from this build.', hint: version.end.message });
      return status({ state: 'error', message: 'Codex could not be started.', details: { ...details, error: version.end.message } });
    }
    if (version.end.kind !== 'exit' || version.end.code !== 0) {
      return status({ state: 'error', message: 'Codex did not answer the version check.', details: { ...details, error: endText(version.end), stderr: clip(redactCodex(version.stderr), 500) } });
    }
    const v = /(\d+\.\d+\.\d+[\w.-]*)/.exec(version.stdout)?.[1];
    if (this.configDir) details.configDir = this.configDir;

    // `login status` prints one line (on stdout or stderr) and exits 1 when signed out
    const login = await this.capture(loginStatusArgs());
    const said = `${login.stdout}\n${login.stderr}`;
    if (/Logged in using ChatGPT/i.test(said)) {
      details.auth = 'ChatGPT';
      return status({ state: 'available', message: 'Codex detected, signed in with ChatGPT.', version: v, details });
    }
    if (/Logged in using an API key/i.test(said)) {
      // never the key itself (Codex prints a masked one)
      details.auth = 'API key';
      return status({ state: 'not_authenticated', message: 'Codex is signed in with an API key, not a ChatGPT account.', hint: LOGIN_HINT, version: v, details });
    }
    if (/Not logged in/i.test(said)) return status({ state: 'not_authenticated', message: 'Codex installed but not signed in.', hint: loginHint(this.configDir), version: v, details });
    return status({ state: 'error', message: 'Codex detected, but its sign-in status could not be read.', version: v, details: { ...details, error: endText(login.end), stderr: clip(redactCodex(login.stderr), 500) } });
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

    const resume = req.session?.mode === 'resume';
    const parser = new CodexJsonParser({ session: !!req.session, resumed: resume });
    const lines = new LineBuffer();
    const stderr = new TailBuffer();
    const queue = new AsyncQueue<ProviderEvent>();
    let terminal = false;
    let settled = false;
    const emit = (body: ProviderEventBody, raw?: unknown) => {
      if (terminal) return;
      if (isTerminal(body)) terminal = true;
      queue.push(stamp(body, raw));
    };
    const feed = (batch: string[]) => batch.forEach((line) => parser.push(line).forEach((e) => emit(e.body, e.raw)));
    const timeoutMs = req.timeoutMs ?? (req.realmnestBridge ? this.bridgedTurnTimeoutMs : this.turnTimeoutMs);
    // a level only when this model lists it (the account's list, read only for turns that ask for one)
    const effort = req.effort ? acceptedEffort(await this.listModels(), req.model, req.effort) : undefined;

    const finished = this.runner
      .run(
        {
          program: CODEX_PROGRAM,
          args: turnArgs({ model: req.model, systemPrompt: req.systemPrompt, session: req.session, ...(req.realmnestBridge && { bridge: { configPath: req.realmnestBridge.configPath } }), effort }),
          stdin: prompt,
          // always RealmNest's empty Codex folder (the host's default), never a project
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
          if (!terminal) emit(this.endToTerminal(end, stderr.toString(), parser, resume, timeoutMs));
        },
        (err) => emit({ type: 'run.failed', error: { code: 'unknown', message: 'Codex could not be run.', detail: redactCodex(String(err)) } }),
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

  /** `codex exec` takes one prompt; earlier history lives in its session. */
  private promptOf(req: ProviderTurnRequest): string | ProviderErrorInfo {
    const last = req.messages[req.messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) return { code: 'invalid_request', message: 'Write a prompt first.' };
    if (req.messages.length > 1 && req.session?.mode !== 'resume')
      return { code: 'invalid_request', message: 'Codex keeps conversation history in its session: resume it and send only the new user message.' };
    if (last.attachments?.length) return { code: 'invalid_request', message: 'ChatGPT through Codex cannot read attached images or PDFs in RealmNest yet.' };
    if (!instructionsArg(req.systemPrompt)) return { code: 'invalid_request', message: `The instructions for this chat are too long for Codex (at most about ${MAX_INSTRUCTIONS.toLocaleString('en')} characters).` };
    return last.content;
  }

  private endToTerminal(end: ProcessEnd, stderr: string, parser: CodexJsonParser, resume: boolean, timeoutMs: number): ProviderEventBody {
    const tail = clip(redactCodex(stderr.trim()), 1_500) || undefined;
    switch (end.kind) {
      case 'cancelled':
        return { type: 'run.cancelled', reason: 'Cancelled.' };
      case 'timeout':
        return { type: 'run.failed', error: { code: 'timeout', message: `Codex did not finish within ${Math.round(timeoutMs / 1000)} s; it was stopped.` } };
      case 'spawn_error': {
        const map = {
          not_found: { code: 'not_installed', message: 'Codex not installed.' },
          host_unavailable: { code: 'unavailable', message: 'Codex cannot be reached from this build.' },
          denied: { code: 'invalid_request', message: 'RealmNest refused to start Codex with these settings.' },
          failed: { code: 'process_crashed', message: 'Codex could not be started.' },
        } as const;
        return { type: 'run.failed', error: { ...map[end.code], detail: end.message } };
      }
      case 'exit': {
        // `resume` of a thread Codex no longer has: "thread/resume failed: no rollout found for thread id …"
        if (resume && /no rollout found|thread\/resume failed/i.test(stderr))
          return { type: 'run.failed', error: { code: 'session_not_found', message: 'Codex no longer has this conversation’s session.', detail: tail } };
        if (end.code === 0) return { type: 'run.failed', error: { code: 'incomplete_stream', message: 'Codex exited without finishing its answer.', detail: tail } };
        if (end.code === null) return { type: 'run.failed', error: { code: 'process_crashed', message: `Codex stopped unexpectedly${end.signal ? ` (${end.signal})` : ''}.`, detail: tail } };
        const said = parser.lastErrorText ?? (tail && /not logged in|codex login|401/i.test(tail) ? tail : undefined);
        if (said) return { type: 'run.failed', error: classifyError(said) };
        return { type: 'run.failed', error: { code: 'process_exit', message: `Codex exited with code ${end.code}.`, detail: tail } };
      }
    }
  }

  private async capture(args: string[]) {
    let stdout = '';
    const stderr = new TailBuffer(4_000);
    const end = await this.runner.run({ program: CODEX_PROGRAM, args, timeoutMs: this.probeTimeoutMs, ...(this.env && { env: this.env }) }, { onStdout: (c) => (stdout += c), onStderr: (c) => stderr.push(c) });
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

function loginHint(configDir?: string): string {
  if (configDir) return `Use Sign in on this connection, or open PowerShell and run: $env:${CODEX_HOME_ENV}="${configDir}"; codex login`;
  return LOGIN_HINT;
}

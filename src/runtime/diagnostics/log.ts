// RealmNest's log (docs/DIAGNOSTICS.md): errors and a few key moments, written to a file in the app's
// data folder (src-tauri/src/applog.rs) so a problem can be looked at after the fact and sent along.
// Only codes and short messages: never prompts, answers, file contents or secrets. Every message is
// redacted here before it leaves the page. The last entries are also kept in memory (browser build).

import { invoke } from '@tauri-apps/api/core';
import type { EventBus } from '../../core/events';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  at: number;
  level: LogLevel;
  /** a short name: chat, agent, tool, mcp, page… */
  source: string;
  message: string;
}

export interface LogTransport {
  readonly available: boolean;
  write(entries: LogEntry[]): Promise<void>;
  /** the newest part of the log file */
  read(): Promise<string>;
  /** the log folder in Explorer */
  reveal(): Promise<void>;
}

export class TauriLogTransport implements LogTransport {
  readonly available = true;
  async write(entries: LogEntry[]) {
    await invoke('log_write', { entries });
  }
  async read() {
    return invoke<string>('log_read');
  }
  async reveal() {
    await invoke('log_reveal');
  }
}

export class UnavailableLogTransport implements LogTransport {
  readonly available = false;
  async write() {}
  async read() {
    return '';
  }
  async reveal() {}
}

const MESSAGE_MAX = 600;

/**
 * Secrets and personal paths out of a log message: API keys (sk-…, AIza…, ghp_…), bearer tokens,
 * Telegram bot tokens, key=value secrets, e-mail addresses, the user's own folder name.
 */
export function redact(text: string): string {
  return text
    .replace(/\b(sk|rk|pk)-[A-Za-z0-9_-]{8,}/g, '$1-[redacted]')
    .replace(/\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{10,}/g, '$1_[redacted]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, 'AIza[redacted]')
    .replace(/\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]')
    .replace(/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, '[redacted bot token]')
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|authorization)(["']?\s*[:=]\s*["']?)[^\s"',;&]{4,}/gi, '$1$2[redacted]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s"']+/gi, '$1[user]')
    .replace(/(\/(?:home|Users)\/)[^/\s"']+/g, '$1[user]');
}

const clip = (s: string) => (s.length > MESSAGE_MAX ? `${s.slice(0, MESSAGE_MAX - 1)}…` : s);

export class AppLog {
  private recentList: LogEntry[] = [];
  private queue: LogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private transport: LogTransport,
    private opts: { now?: () => number; flushMs?: number; keep?: number } = {},
  ) {}

  get available() {
    return this.transport.available;
  }

  info(source: string, message: string) {
    this.add('info', source, message);
  }
  warn(source: string, message: string) {
    this.add('warn', source, message);
  }
  error(source: string, message: string) {
    this.add('error', source, message);
  }

  /** the last entries of this session (newest last) */
  recent(): LogEntry[] {
    return this.recentList;
  }

  private add(level: LogLevel, source: string, message: string) {
    const e: LogEntry = { at: this.opts.now?.() ?? Date.now(), level, source: source.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'app', message: clip(redact(message.replace(/\s+/g, ' ').trim())) };
    this.recentList.push(e);
    if (this.recentList.length > (this.opts.keep ?? 300)) this.recentList.shift();
    if (!this.transport.available) return;
    this.queue.push(e);
    // written in batches: an error storm is one write a second, not hundreds
    this.timer ??= setTimeout(() => void this.flush(), this.opts.flushMs ?? 1000);
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const batch = this.queue.splice(0, 200);
    this.queue = [];
    if (batch.length) await this.transport.write(batch).catch(() => undefined);
  }

  read() {
    return this.transport.read();
  }
  reveal() {
    return this.transport.reveal();
  }
}

/** what goes to the log: page errors, console errors, and failures the runtime reports on the bus */
export function wireLog(log: AppLog, bus: EventBus, target: Pick<Window, 'addEventListener'> & { console: Console }) {
  target.addEventListener('error', (e: Event) => {
    const ev = e as ErrorEvent;
    log.error('page', `${ev.message ?? 'error'}${ev.filename ? ` (${ev.filename.split('/').pop()}:${ev.lineno})` : ''}`);
  });
  target.addEventListener('unhandledrejection', (e: Event) => {
    const r = (e as PromiseRejectionEvent).reason;
    log.error('page', `unhandled: ${r instanceof Error ? `${r.name}: ${r.message}` : String(r)}`);
  });
  // console.error is where services report what did not start (main.tsx); it still prints
  const original = target.console.error.bind(target.console);
  target.console.error = (...args: unknown[]) => {
    original(...args);
    log.error('console', args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : safeJson(a))).join(' '));
  };
  const offs = [
    bus.on('agent.run.failed', (p) => log.error('agent', `${p.agentId} run ${p.runId}: ${p.error.code}: ${p.error.message}`)),
    bus.on('conversation.run.failed', (p) => log.error('chat', `run ${p.runId}: ${p.error.code}: ${p.error.message}`)),
    bus.on('tool.failed', (p) => log.warn('tool', `${p.toolId} (${p.toolCallId}): ${p.code ?? 'failed'}`)),
    bus.on('mcp.server.status', (p) => (p.status === 'failed' || p.status === 'unavailable' ? log.warn('mcp', `${p.serverId}: ${p.status}${p.error ? `: ${p.error}` : ''}`) : undefined)),
    bus.on('connection.status.changed', (p) => (p.to === 'error' || p.to === 'unavailable' || p.to === 'invalid_credentials' ? log.warn('connection', `${p.connectionId}: ${p.from} → ${p.to}`) : undefined)),
    bus.on('knowledge.index.failed', (p) => log.warn('knowledge', `${p.documentId}: ${p.code}`)),
    bus.on('artifact.failed', (p) => log.warn('files', `artifact: ${p.code}`)),
    bus.on('crew.event', (p) => (p.kind === 'fail' || p.kind === 'warning' ? log[p.kind === 'fail' ? 'error' : 'warn']('crew', `${p.runId}: ${p.message}`) : undefined)),
    bus.on('workflow.event', (p) => (p.kind === 'fail' || p.kind === 'timeout' || p.kind === 'budget' ? log[p.kind === 'fail' ? 'error' : 'warn']('workflow', `${p.runId}: ${p.message}`) : undefined)),
  ];
  return () => {
    offs.forEach((off) => off());
    target.console.error = original;
  };
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v)?.slice(0, 300) ?? String(v);
  } catch {
    return String(v);
  }
}

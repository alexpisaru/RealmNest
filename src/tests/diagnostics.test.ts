import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { AppLog, redact, wireLog, type LogEntry, type LogTransport } from '../runtime/diagnostics/log';
import { diagnosticsName, diagnosticsReport } from '../runtime/diagnostics/report';

function rig() {
  const written: LogEntry[][] = [];
  const transport: LogTransport = { available: true, write: async (e) => void written.push(e), read: async () => '', reveal: async () => undefined };
  const log = new AppLog(transport, { now: () => 0, flushMs: 5 });
  return { log, written };
}

describe('diagnostics log', () => {
  it('redacts keys, tokens, e-mails and the user folder', () => {
    const text = redact(
      'sk-ant-api03-abcdefghijklmnop and sk-or-v1-1234567890abcdef, Bearer eyJhbGciOiJIUzI1NiJ9.x, 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw, api_key=supersecret1 token: "abcd1234", alex@example.com, C:\\Users\\alexp\\Documents\\x, /home/alex/x, ghp_abcdefghijklmnopqrst',
    );
    expect(text).not.toMatch(/abcdefghijklmnop|1234567890abcdef|eyJhbGci|AAHdqTcv|supersecret1|abcd1234|alex@example|alexp|\/alex\/|ghp_abcdefghij/);
    expect(text).toContain('sk-[redacted]');
    expect(text).toContain('C:\\Users\\[user]\\Documents');
    // ordinary messages stay as they are
    expect(redact('rate_limited: ChatGPT is limiting requests (429)')).toBe('rate_limited: ChatGPT is limiting requests (429)');
  });

  it('batches entries, one line each, short; the last ones stay in memory', async () => {
    const { log, written } = rig();
    log.error('chat', 'first\nline');
    log.warn('tool bad!', 'x'.repeat(2000));
    expect(written).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));
    expect(written).toHaveLength(1);
    expect(written[0][0]).toEqual({ at: 0, level: 'error', source: 'chat', message: 'first line' });
    expect(written[0][1].source).toBe('toolbad');
    expect(written[0][1].message.length).toBe(600);
    expect(log.recent()).toHaveLength(2);
  });

  it('page errors, console errors and runtime failures reach the log; console.error still prints', async () => {
    const { log } = rig();
    const bus = new EventBus(100);
    const listeners = new Map<string, (e: Event) => void>();
    const printed: unknown[][] = [];
    const target = { addEventListener: (type: string, fn: (e: Event) => void) => void listeners.set(type, fn), console: { error: (...a: unknown[]) => void printed.push(a) } as unknown as Console };
    const off = wireLog(log, bus, target as unknown as Window & { console: Console });
    listeners.get('error')!({ message: 'boom', filename: 'http://x/assets/index.js', lineno: 3 } as unknown as Event);
    listeners.get('unhandledrejection')!({ reason: new TypeError('nope') } as unknown as Event);
    target.console.error('[realmnest] mcp did not start', new Error('spawn failed'));
    bus.emit('conversation.run.failed', { conversationId: 'c', runId: 'r1', error: { code: 'timeout', message: 'no answer' } });
    bus.emit('agent.run.failed', { agentId: 'maya', runId: 'r2', taskId: 't', error: { code: 'not_authenticated', message: 'Sign in' } });
    bus.emit('tool.failed', { toolCallId: 'c1', runId: 'r', toolId: 'web_fetch', code: 'FETCH_TIMEOUT' });
    bus.emit('crew.event', { runId: 'cr', crewId: 'c', kind: 'fail', message: 'T2 failed' });
    bus.emit('crew.event', { runId: 'cr', crewId: 'c', kind: 'output', message: 'never logged' });
    expect(printed).toHaveLength(1);
    expect(log.recent().map((e) => `${e.level} ${e.source}: ${e.message}`)).toEqual([
      'error page: boom (index.js:3)',
      'error page: unhandled: TypeError: nope',
      'error console: [realmnest] mcp did not start Error: spawn failed',
      'error chat: run r1: timeout: no answer',
      'error agent: maya run r2: not_authenticated: Sign in',
      'warn tool: web_fetch (c1): FETCH_TIMEOUT',
      'error crew: cr: T2 failed',
    ]);
    off();
    target.console.error('after');
    expect(log.recent()).toHaveLength(7);
  });
});

describe('diagnostics report', () => {
  it('has the state and the log, without names or secrets', () => {
    const text = diagnosticsReport({
      app: 'RealmNest OS',
      version: '0.13.0',
      at: 0,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      language: 'it',
      desktop: true,
      connections: [{ providerId: 'claude-code', status: 'connected' }],
      mcp: [{ status: 'connected', tools: 3 }],
      storage: { writeFailures: 0, unreadable: [], previousSessionWriteFailure: false, startupIssues: ['mcp'] },
      counts: { agents: 12 },
      logFile: '1970-01-01T00:00:00.000Z error chat: token=abcdef123456\n',
      recent: [],
    });
    expect(text).toContain('version: 0.13.0');
    expect(text).toContain('- claude-code: connected');
    expect(text).toContain('- services that did not start: mcp');
    expect(text).toContain('error chat: token=[redacted]');
    expect(diagnosticsName(new Date(2026, 9, 28, 9, 5).getTime())).toBe('RealmNest diagnostics 2026-10-28 09.05.txt');
  });
});

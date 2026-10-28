// A diagnostics report (docs/DIAGNOSTICS.md): one text file the user saves and sends along with a
// problem. Version, system, the state of connections, MCP servers and storage, then the log. Nothing
// that identifies the user or their work: connection and server names, prompts, chats, files and
// secrets are left out, and every line is redacted again.

import { redact, type LogEntry } from './log';

export interface ReportInput {
  app: string;
  version: string;
  at: number;
  userAgent: string;
  language: string;
  desktop: boolean;
  /** kind and status only (names are the user's) */
  connections: { providerId: string; status: string }[];
  mcp: { status: string; tools: number }[];
  storage: { writeFailures: number; unreadable: string[]; previousSessionWriteFailure: boolean; startupIssues: string[] };
  counts: Record<string, number>;
  /** the log file's newest part (desktop), or this session's entries (browser) */
  logFile: string;
  recent: LogEntry[];
}

const iso = (ms: number) => new Date(ms).toISOString();

export function diagnosticsReport(r: ReportInput): string {
  const lines = [
    `# ${r.app} diagnostics`,
    '',
    `version: ${r.version}`,
    `created: ${iso(r.at)}`,
    `build: ${r.desktop ? 'desktop' : 'browser'}`,
    `system: ${r.userAgent}`,
    `language: ${r.language}`,
    '',
    '## Connections (kind: status)',
    ...(r.connections.length ? r.connections.map((c) => `- ${c.providerId}: ${c.status}`) : ['- none']),
    '',
    '## MCP servers (status, tools)',
    ...(r.mcp.length ? r.mcp.map((m) => `- ${m.status}, ${m.tools} tools`) : ['- none']),
    '',
    '## Storage',
    `- failed writes this session: ${r.storage.writeFailures}`,
    `- unreadable keys: ${r.storage.unreadable.join(', ') || 'none'}`,
    `- a write failed in the previous session: ${r.storage.previousSessionWriteFailure ? 'yes' : 'no'}`,
    `- services that did not start: ${r.storage.startupIssues.join(', ') || 'none'}`,
    '',
    '## Counts',
    ...Object.entries(r.counts).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Log',
    r.logFile.trim() || (r.recent.length ? r.recent.map((e) => `${iso(e.at)} ${e.level.padEnd(5)} ${e.source}: ${e.message}`).join('\n') : '(empty)'),
    '',
  ];
  return lines.map((l) => redact(l)).join('\n');
}

export function diagnosticsName(now = Date.now()) {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `RealmNest diagnostics ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.txt`;
}

// Tool calls of one run, compact: tool, what it touched, status, error.
// Used under chat replies, in the agent's run panel and in Debug.

import { Ban, CheckCircle2, CircleDashed, Hourglass, Loader2, Wrench, XCircle } from 'lucide-react';
import type { ToolCall, ToolCallStatus, ToolPermission } from '../../domain/tool';
import type { TKey } from '../../i18n';
import { useT, useTools } from '../context';

const ICON: Record<ToolCallStatus, typeof Wrench> = {
  requested: CircleDashed,
  awaiting_approval: Hourglass,
  approved: CircleDashed,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
  denied: Ban,
};

/** what a call was about, in a few words (a path, usually) */
export function callSummary(c: ToolCall): string {
  const input = (c.input ?? {}) as Record<string, unknown>;
  if (typeof input.path === 'string') return input.path;
  if (c.toolId === 'delegate_task' && typeof input.agent === 'string') return `→ ${input.agent}${typeof input.task === 'string' ? ` · ${input.task.slice(0, 60)}` : ''}`;
  if (c.toolId === 'deep_research' && typeof input.question === 'string') return `“${input.question.slice(0, 80)}”`;
  if (c.toolId === 'web_fetch' && typeof input.url === 'string') return input.url.replace(/^https?:\/\//, '').slice(0, 90);
  if ((c.toolId === 'web_search' || c.toolId === 'search_knowledge' || c.toolId === 'search_memory') && typeof input.query === 'string') return `“${input.query.slice(0, 80)}”`;
  return '';
}

export function ToolCallList({ runId }: { runId: string | undefined }) {
  const tools = useTools();
  if (!runId) return null;
  const calls = tools.runtime.list({ runId }).reverse();
  if (!calls.length) return null;
  return (
    <ul className="tool-calls">
      {calls.map((c) => (
        <ToolCallRow key={c.id} c={c} />
      ))}
    </ul>
  );
}

function ToolCallRow({ c }: { c: ToolCall }) {
  const t = useT();
  const Icon = ICON[c.status];
  const summary = callSummary(c);
  return (
    <li className={`tool-call ${c.status}`} title={c.error ? `${c.error.code}: ${c.error.message}` : undefined}>
      <Icon size={13} className={c.status === 'running' ? 'spin' : undefined} />
      <code>{c.toolId}</code>
      {summary && <span className="tool-call-what">{summary}</span>}
      <span className="tool-call-status">{t(`tools.status.${c.status}` as TKey)}</span>
      {c.error && c.status !== 'denied' && <span className="tool-call-error">{c.error.message}</span>}
    </li>
  );
}

/** "Default (Ask)" / Allow / Ask / Never */
export function PermissionSelect({ value, fallback, onChange, label }: { value: ToolPermission | undefined; fallback: ToolPermission; onChange: (p: ToolPermission | undefined) => void; label: string }) {
  const t = useT();
  return (
    <select className="perm-select" value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as ToolPermission | undefined)} aria-label={label}>
      <option value="">{t('tools.perm.default', { value: t(`tools.perm.${fallback}` as TKey) })}</option>
      <option value="allow">{t('tools.perm.allow')}</option>
      <option value="ask">{t('tools.perm.ask')}</option>
      <option value="deny">{t('tools.perm.deny')}</option>
    </select>
  );
}

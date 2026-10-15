// Debug › Tools: what is registered (source, risk, permission, schema, whether
// it can run here), the recent calls with their normalized input/output, and
// the tool events. Inputs and outputs are the stored (size-capped) copies.

import { useEffect, useState } from 'react';
import type { ToolCall } from '../../domain/tool';
import type { TKey } from '../../i18n';
import { useServices, useT, useTools } from '../context';
import { callSummary } from './ToolCalls';

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');

export function ToolsDebug() {
  const tools = useTools();
  const t = useT();
  const { bus } = useServices();
  const [, bump] = useState(0);
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('tool.') && bump((n) => n + 1)), [bus]);
  const [open, setOpen] = useState<string | null>(null);
  const calls = tools.runtime.list().slice(0, 40);
  const events = bus.log.filter((e) => e.type.startsWith('tool.')).slice(0, 30);
  const who = (c: ToolCall) => c.agentId ?? (c.conversationId ? t('s.tdbg.chat', { id: c.conversationId }) : '—');

  return (
    <div className="tools-debug">
      <h4>{t('s.tdbg.registry', { n: tools.registry.size })}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>id</th>
            <th>{t('s.tdbg.source')}</th>
            <th>{t('s.tdbg.risk')}</th>
            <th>{t('s.tdbg.perm')}</th>
            <th>{t('s.tdbg.runs')}</th>
          </tr>
        </thead>
        <tbody>
          {tools.registry.list().map((x) => (
            <tr key={x.id} title={JSON.stringify(x.inputSchema, null, 1)}>
              <td>{x.id}</td>
              <td>{x.source}</td>
              <td>{t(`s.tdbg.risk.${x.risk}` as TKey)}</td>
              <td>{t(`tools.perm.${tools.runtime.permissionFor(x.id, {})}` as TKey)}</td>
              <td>{tools.registry.available(x.id) ? t('s.yes') : t('s.no')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small mono">{t('s.tdbg.workspace', { path: tools.policy.get().workspace ?? t('s.tdbg.none') })}</p>

      <h4>{t('s.tdbg.calls', { n: calls.length })}</h4>
      {calls.length === 0 && <p className="muted small">{t('s.tdbg.noCalls')}</p>}
      <ul className="dbg-calls">
        {calls.map((c) => (
          <li key={c.id} className={c.status}>
            <button className="dbg-call-head" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
              <span className="mono">{time(c.requestedAt)}</span>
              <code>{c.toolId}</code>
              <span>{callSummary(c)}</span>
              <span className="dbg-call-status">{t(`tools.status.${c.status}` as TKey)}</span>
            </button>
            {open === c.id && (
              <pre className="mono dbg-call-body">
                {JSON.stringify(
                  {
                    id: c.id,
                    runId: c.runId,
                    by: who(c),
                    permission: c.permission,
                    providerCallId: c.providerCallId,
                    input: c.input,
                    output: c.output,
                    error: c.error,
                    ms: c.completedAt && c.startedAt ? c.completedAt - c.startedAt : undefined,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </li>
        ))}
      </ul>

      <h4>{t('s.prov.events')}</h4>
      <ul className="dbg-events mono">
        {events.map((e) => {
          const p = e.payload as { toolId?: string; code?: string };
          return (
            <li key={e.seq}>
              {new Date(e.at).toLocaleTimeString()} {e.type} {p.toolId}
              {p.code ? ` · ${p.code}` : ''}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

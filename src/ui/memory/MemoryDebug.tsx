// Debug › Memory: per agent the mode, counts, pending proposals and index version; recent
// extractions (status, connection, model, structured or not, real usage); recent memory
// events. Ids, counts and decisions only: memory text appears only when a row is expanded.

import { useEffect, useState } from 'react';
import { useConnectionLabel } from '../connections';
import { useApp, useMemory, useServices, useT } from '../context';

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');

export function MemoryDebug() {
  const t = useT();
  const memory = useMemory();
  const st = useApp();
  const { bus } = useServices();
  const [, bump] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const labelOf = useConnectionLabel();
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('memory.') && bump((n) => n + 1)), [bus]);
  const agents = [...new Set([...st.characters.map((c) => c.id), ...memory.agents()])];
  const events = bus.log.filter((e) => e.type.startsWith('memory.')).slice(0, 30);
  const nameOf = (id: string) => st.characters.find((c) => c.id === id)?.name ?? t('p.mem.dbg.agentDeleted', { id });
  return (
    <div className="tools-debug">
      <h4>{t('p.mem.dbg.agents')}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>{t('p.mem.dbg.agent')}</th>
            <th>{t('p.dbg.mode')}</th>
            <th>{t('p.mem.dbg.index')}</th>
            <th>{t('p.mem.dbg.active')}</th>
            <th>{t('p.mem.dbg.pending')}</th>
            <th>{t('p.mem.dbg.others')}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((id) => {
            const c = memory.counts(id);
            const s = memory.settings(id);
            return (
              <tr key={id} onClick={() => setOpen(open === id ? null : id)} style={{ cursor: 'pointer' }}>
                <td className="mono small">{nameOf(id)}</td>
                <td>{s.mode}</td>
                <td className="small">
                  v{memory.indexVersion(id)} · {s.useEmbeddings ? t('p.mem.dbg.lexicalEmb') : t('p.mem.dbg.lexical')}
                </td>
                <td>{c.active}</td>
                <td>{c.pending}</td>
                <td>
                  {c.superseded} / {c.expired} / {c.deleted}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open && (
        <ul className="mono small">
          {memory.list({ agentId: open }).map((e) => (
            <li key={e.id}>
              {e.id} {e.status} {e.type} {e.importance} {e.lastUsedAt ? t('p.mem.dbg.used', { time: time(e.lastUsedAt) }) : ''} — {e.content || t('p.mem.dbg.contentDeleted')}
            </li>
          ))}
        </ul>
      )}
      <h4>{t('p.mem.dbg.extractions')}</h4>
      {!memory.recentExtractions().length && <p className="muted small">{t('p.mem.dbg.noExtractions')}</p>}
      <table className="dbg-table">
        <tbody>
          {memory.recentExtractions().slice(0, 30).map((x) => (
            <tr key={x.runId}>
              <td className="mono small">{x.runId}</td>
              <td className="small">{nameOf(x.agentId)}</td>
              <td>
                {x.status}
                {x.reason ? ` · ${x.reason}` : ''}
              </td>
              <td className="small">
                {t('p.mem.dbg.proposed', { n: x.proposals })}
                {x.dropped ? `, ${t('p.mem.dbg.dropped', { n: x.dropped })}` : ''}
              </td>
              <td className="small">
                {x.connectionId ? labelOf(x.connectionId) : ''}
                {x.model ? ` · ${x.model}` : ''}
                {x.structured ? ` · ${t('p.mem.dbg.structured')}` : x.status === 'done' ? ` · ${t('p.mem.dbg.jsonText')}` : ''}
              </td>
              <td className="small">
                {x.usage ? `${x.usage.inputTokens}+${x.usage.outputTokens} tok` : ''}
                {x.costUsd !== undefined ? ` · $${x.costUsd.toFixed(6)}` : ''}
              </td>
              <td className="small">{time(x.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>{t('p.dbg.recentEvents')}</h4>
      <ul className="mono small">
        {events.map((e) => (
          <li key={e.seq}>
            {time(e.at)} {e.type} {JSON.stringify(e.payload)}
          </li>
        ))}
      </ul>
    </div>
  );
}

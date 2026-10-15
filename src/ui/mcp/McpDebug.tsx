// Debug › MCP: what each server is really doing. Protocol traffic is shown as
// method, direction and size only (never payloads); stderr is the server's own
// log with secret values already replaced by the native host.

import { useState } from 'react';
import { useMcp, useT } from '../context';
import type { TKey } from '../../i18n';
import { McpStatusBadge } from './McpSettings';

const time = (t: number) => new Date(t).toLocaleTimeString();
const size = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function McpDebug() {
  const mcp = useMcp();
  const t = useT();
  const servers = mcp.list();
  const [open, setOpen] = useState<string | null>(servers[0]?.id ?? null);
  if (!servers.length) return <p className="muted small">{t('s.mcpdbg.none')}</p>;
  return (
    <div className="tools-debug mcp-debug">
      {servers.map((c) => {
        const st = mcp.state(c.id);
        const traffic = mcp.traffic(c.id).slice(-25).reverse();
        const stderr = mcp.stderr(c.id).slice(-15);
        return (
          <section key={c.id}>
            <button className="dbg-call-head" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
              <b>{c.name}</b>
              <span className="mono">mcp.{c.key}.*</span>
              <span className="dbg-call-status">
                <McpStatusBadge status={st.status} error={st.error} />
              </span>
            </button>
            {open === c.id && (
              <div className="mcp-debug-body">
                <table className="dbg-table">
                  <tbody>
                    <tr>
                      <td>{t('s.mcpdbg.transport')}</td>
                      <td>stdio</td>
                    </tr>
                    <tr>
                      <td>{t('s.mcpdbg.protocol')}</td>
                      <td>{st.protocolVersion ? `${st.protocolVersion} (${st.era})` : '—'}</td>
                    </tr>
                    <tr>
                      <td>{t('s.mcpdbg.server')}</td>
                      <td>{st.serverInfo ? `${st.serverInfo.name ?? '?'} ${st.serverInfo.version ?? ''}` : '—'}</td>
                    </tr>
                    <tr>
                      <td>{t('s.mcpdbg.process')}</td>
                      <td className="mono">{st.pid ? `pid ${st.pid} · ${st.executable}` : '—'}</td>
                    </tr>
                    <tr>
                      <td>{t('s.mcpdbg.tools')}</td>
                      <td>{t('s.mcpdbg.toolsCount', { found: st.tools.length, on: c.enabledTools.length, skipped: st.skipped.length })}</td>
                    </tr>
                    <tr>
                      <td>{t('s.mcpdbg.startup')}</td>
                      <td>{t(`mcp.startup.${c.startup}` as TKey)}</td>
                    </tr>
                    {st.error && (
                      <tr>
                        <td>{t('s.mcpdbg.error')}</td>
                        <td>{st.error}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <h4>{t('s.mcpdbg.lastMessages')}</h4>
                <ul className="dbg-events mono">
                  {traffic.length === 0 && <li>—</li>}
                  {traffic.map((m, i) => (
                    <li key={i}>
                      {time(m.at)} {m.dir === 'out' ? '→' : '←'} {m.what} · {size(m.bytes)}
                    </li>
                  ))}
                </ul>
                <h4>stderr</h4>
                <ul className="dbg-events mono">
                  {stderr.length === 0 && <li>—</li>}
                  {stderr.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

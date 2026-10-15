// Debug › Web: transport and settings, the engine slot, the cache, and the recent web log
// (fetches, renders, searches, blocked addresses, errors) with status, type, size, timing and
// run. Addresses and codes only: page text is never shown here.

import { useEffect, useState } from 'react';
import type { WebLogEntry } from '../../runtime/web/service';
import { useServices, useT, useWeb } from '../context';

const time = (t: number) => new Date(t).toLocaleTimeString();

const outcome = (t: ReturnType<typeof useT>, l: WebLogEntry) =>
  l.code
    ? `${l.code}${l.message ? ` · ${l.message.slice(0, 160)}` : ''}`
    : [l.status, l.method, l.contentType?.split(';')[0], l.cache, l.bytes !== undefined ? `${Math.round(l.bytes / 1024)} KB` : undefined, l.chars !== undefined ? t('s.wdbg.chars', { n: l.chars }) : undefined, l.results !== undefined ? t('s.wdbg.results', { n: l.results, of: l.rawCount ?? '?' }) : undefined]
        .filter((x) => x !== undefined && x !== '')
        .join(' · ');

export function WebDebug() {
  const web = useWeb();
  const t = useT();
  const { bus } = useServices();
  const [, bump] = useState(0);
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('web.') && bump((n) => n + 1)), [bus]);
  const s = web.settings();
  const log = web.log();
  return (
    <div className="tools-debug">
      <h4>Web</h4>
      <ul className="mono small">
        <li>
          {t('s.wdbg.transport')}: {web.available ? t('s.wdbg.rust') : t('s.wdbg.unavailableBrowser')}
        </li>
        <li>
          {t('s.wdbg.reader')}: {web.canRender ? (s.renderFallback ? t('s.wdbg.on') : t('s.wdbg.off')) : t('s.wdbg.unavailable')}
        </li>
        <li>
          {t('s.wdbg.engine')}: {s.searchEngine ?? t('s.wdbg.engineNone')}
        </li>
        <li>
          {t('s.wdbg.engines')}: {web.engineList().map((e) => e.id).join(', ') || t('s.wdbg.none')}
        </li>
        <li>{t('s.wdbg.cache', { n: web.cacheSize() })}</li>
      </ul>
      <h4>{t('s.wdbg.log')}</h4>
      {!log.length && <p className="muted small">{t('s.wdbg.nothing')}</p>}
      <ul className="web-dbg-log">
        {log.slice(0, 80).map((l, i) => (
          <li key={i} className={l.code ? 'bad' : ''}>
            <div className="small">
              <b>{l.kind}</b> {time(l.at)}
              {l.ms !== undefined ? ` · ${l.ms} ms` : ''}
              {l.runId ? <span className="mono"> · {l.runId}</span> : null}
            </div>
            <div className="mono small web-dbg-url" title={l.finalUrl && l.finalUrl !== l.url ? `→ ${l.finalUrl}` : l.url}>
              {l.query ? `“${l.query}” (${l.engine ?? '—'})` : l.url}
              {l.redirects ? ` ↪${l.redirects}` : ''}
            </div>
            <div className="small muted">{outcome(t, l)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

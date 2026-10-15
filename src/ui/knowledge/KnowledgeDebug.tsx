// Debug › Knowledge: every base with its index state and embedding identity, the
// indexing jobs (stages, chunks, embedded / reused, real provider usage), the
// embeddings route, and recent Knowledge events. Ids, counts and codes only:
// never document text.

import { useEffect, useState } from 'react';
import { useCapabilities, useKnowledge, useServices, useT } from '../context';

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');

export function KnowledgeDebug() {
  const t = useT();
  const knowledge = useKnowledge();
  const capabilities = useCapabilities();
  const { bus } = useServices();
  const [, bump] = useState(0);
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('knowledge.') && bump((n) => n + 1)), [bus]);
  const route = capabilities.resolveRoute('embeddings.create');
  const events = bus.log.filter((e) => e.type.startsWith('knowledge.')).slice(0, 30);
  return (
    <div className="tools-debug">
      <h4>{t('p.kn.dbg.route')}</h4>
      <p className="mono small">{route.ok ? `${route.target!.connectionId} · ${route.target!.modelId ?? '—'} (${route.source})` : `${route.failure}: ${route.reason}`}</p>
      <h4>{t('p.kn.dbg.bases')}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>{t('p.kn.dbg.base')}</th>
            <th>{t('p.dbg.mode')}</th>
            <th>{t('p.kn.dbg.identity')}</th>
            <th>{t('p.kn.dbg.docs')}</th>
            <th>{t('p.kn.dbg.chunks')}</th>
            <th>{t('p.kn.dbg.states')}</th>
            <th>{t('kn.wordsOnly')}</th>
          </tr>
        </thead>
        <tbody>
          {knowledge.listBases().map((b) => {
            const s = knowledge.stats(b.id);
            return (
              <tr key={b.id}>
                <td className="mono small" title={b.id}>
                  {b.name}
                  {b.builtIn ? ` ${t('p.kn.dbg.builtIn')}` : ''}
                </td>
                <td>{b.settings.retrievalMode}</td>
                <td className="mono small">{b.embeddingIdentity ? `${b.embeddingIdentity.model} ${b.embeddingIdentity.dimensions}d` : b.settings.embedding ? `${b.settings.embedding.connectionId}${b.settings.embedding.model ? ` ${b.settings.embedding.model}` : ''} ${t('p.kn.dbg.notBuilt')}` : '—'}</td>
                <td>{s.documents}</td>
                <td>{s.chunks}</td>
                <td>
                  {s.ready} / {s.busy} / {s.failed} / {s.stale}
                </td>
                <td>{b.settings.retrievalMode === 'hybrid' ? s.lexicalOnly : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h4>{t('p.kn.dbg.jobs')}</h4>
      {!knowledge.jobs().length && <p className="muted small">{t('p.kn.dbg.noJobs')}</p>}
      <table className="dbg-table">
        <tbody>
          {knowledge.jobs().slice(0, 40).map((j) => (
            <tr key={j.id}>
              <td className="mono small">{j.id}</td>
              <td className="mono small" title={j.documentId}>
                {knowledge.document(j.documentId)?.name ?? j.documentId}
              </td>
              <td>
                {j.status}
                {j.stage ? ` · ${j.stage}` : ''}
              </td>
              <td className="small">
                {j.chunks !== undefined ? t('kn.chunksCount', { n: j.chunks }) : ''}
                {j.embedded !== undefined ? ` · ${t('p.kn.dbg.embedded', { embedded: j.embedded, reused: j.reused ?? 0 })}` : ''}
                {j.usage ? ` · ${j.usage.requests} req${j.usage.tokens !== undefined ? `, ${j.usage.tokens} tok` : ''}${j.usage.costUsd !== undefined ? `, $${j.usage.costUsd.toFixed(6)}` : ''}` : ''}
              </td>
              <td className="small">{j.error ? `${j.error.code}` : ''}</td>
              <td className="small">
                {time(j.startedAt)} → {time(j.finishedAt)}
              </td>
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

// Debug › Research: every run's state machine at a glance — status, round, budget use, queries,
// sources (read, irrelevant), evidence, dropped quotes, verification and model usage — and the
// latest run's queries and warnings. Ids, counts and queries only: page text is never shown here.

import { useEffect, useState } from 'react';
import type { ResearchRun } from '../../domain/research';
import type { TKey } from '../../i18n';
import { useResearch, useServices, useT } from '../context';

type T = (k: TKey, vars?: Record<string, string | number>) => string;

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');

const dropped = (r: ResearchRun) => r.events.reduce((n, e) => n + Number(/\((\d+) quotes? not found/.exec(e.message)?.[1] ?? 0), 0);

function line(r: ResearchRun, t: T) {
  const v = r.verification;
  const flagged = v ? v.checks.filter((c) => c.status !== 'supported').length : undefined;
  return [
    t('p.rs.dbg.round', { n: r.round, max: r.budget.rounds }),
    t('p.rs.dbg.searches', { n: r.queries.length, max: r.budget.searches }),
    t('p.rs.dbg.pages', { n: r.sources.filter((s) => s.kind === 'web').length, max: r.budget.pages }),
    t('p.rs.dbg.irrelevant', { n: r.sources.filter((s) => s.irrelevant).length }),
    t('p.rs.dbg.knowledge', { n: r.sources.filter((s) => s.kind === 'knowledge').length }),
    t('p.rs.dbg.evidence', { n: r.evidence.length, context: r.evidence.filter((e) => e.context).length, dropped: dropped(r) }),
    v ? t('p.rs.dbg.check', { ok: v.lexical.lexicallySupported, cited: v.lexical.cited, flagged: flagged ?? 0, invalid: v.invalidMarkers.length }) : t('p.rs.dbg.notVerified'),
    `${t('p.rs.dbg.usage', { calls: r.usage.calls, tokens: r.usage.inputTokens + r.usage.outputTokens, max: r.budget.tokens })}${r.usage.costUsd !== undefined ? ` · $${r.usage.costUsd.toFixed(3)}` : ''}`,
  ].join(' · ');
}

export function ResearchDebug() {
  const t = useT();
  const research = useResearch();
  const { bus } = useServices();
  const [, bump] = useState(0);
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('research.') && bump((n) => n + 1)), [bus]);
  const runs = research.list();
  const last = runs[0];
  return (
    <div className="tools-debug">
      <h4>{t('rs.title')}</h4>
      {!runs.length && <p className="muted small">{t('p.rs.dbg.noRuns')}</p>}
      <ul className="web-dbg-log">
        {runs.slice(0, 30).map((r) => (
          <li key={r.id} className={r.status === 'failed' ? 'bad' : ''}>
            <div className="small">
              <b>{r.status}</b> {time(r.updatedAt)} · <span className="mono">{r.id}</span> · {r.owner.kind === 'agent' ? t('p.rs.dbg.agent', { id: r.owner.agentId }) : t('p.rs.dbg.user')} · {r.preset}
              {r.stopReason ? ` · ${t('p.rs.dbg.stop', { why: r.stopReason })}` : ''}
            </div>
            <div className="mono small web-dbg-url" title={r.question}>
              {r.plan?.title ?? r.question}
            </div>
            <div className="small muted">{line(r, t)}</div>
            {r.error && <div className="small">{r.error}</div>}
          </li>
        ))}
      </ul>
      {last && (
        <>
          <h4>{t('p.rs.dbg.queries')}</h4>
          <ul className="mono small">
            {last.queries.map((q, i) => (
              <li key={i}>
                {q.round} · {q.subQuestionId ?? '—'} · “{q.text}” → {q.results}
                {q.error ? ` · ${q.error}` : ''}
              </li>
            ))}
          </ul>
          <h4>{t('p.rs.dbg.warnings')}</h4>
          <ul className="small">
            {last.events
              .filter((e) => e.phase === 'warning' || e.phase === 'error')
              .slice(-20)
              .map((e, i) => (
                <li key={i}>
                  {time(e.at)} · {e.message}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

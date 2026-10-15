// One research run: clarifying questions → the plan to approve → live progress → the report, with
// the sources, the evidence ledger, the event log and the citation check.

import { CirclePlay, PenLine, Plus, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isActive, REPORT_KINDS, type ReportKind, type ResearchPlan, type ResearchRun } from '../../domain/research';
import type { TKey } from '../../i18n';
import { useConnections, useResearch, useT } from '../context';
import { Button, Segmented } from '../kit';
import { ReportView, SourcesList } from './ReportView';

type Tab = 'report' | 'progress' | 'sources' | 'evidence' | 'log';

export function RunView({ run, onDeleted }: { run: ResearchRun; onDeleted: () => void }) {
  const t = useT();
  const research = useResearch();
  const connections = useConnections();
  const [tab, setTab] = useState<Tab>(run.report ? 'report' : 'progress');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (run.status === 'done') setTab('report');
  }, [run.status]);
  const act = (fn: () => unknown) => {
    setError('');
    try {
      const r = fn();
      if (r instanceof Promise) r.catch((e) => setError(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const active = isActive(run.status);
  const title = run.report?.title ?? run.plan?.title ?? run.question;

  return (
    <div className="rs-run">
      <header className="rs-run-head">
        <div>
          <small className={`rs-status ${run.status}`}>{t(`rs.status.${run.status}` as TKey)}</small>
          <h2>{title}</h2>
          {title !== run.question && <p className="muted rs-q">{run.question}</p>}
          <small className="muted">
            {connections.get(run.connectionId)?.name ?? run.connectionId}
            {run.model ? ` · ${run.model}` : ''}
            {run.readerModel && run.readerModel !== run.model ? ` · ${t('rs.readerShort')} ${run.readerModel}` : ''} · {t(`rs.preset.${run.preset}` as TKey)}
            {run.web ? '' : ` · ${t('rs.noWeb')}`}
          </small>
        </div>
        <div className="rs-actions">
          {active && run.status !== 'clarifying' && (
            <>
              {run.evidence.length > 0 && run.status === 'running' && (
                <Button size="sm" icon={<PenLine size={14} />} onClick={() => act(() => research.writeNow(run.id))}>
                  {t('rs.writeNow')}
                </Button>
              )}
              <Button size="sm" tone="ghost" icon={<Square size={14} />} onClick={() => act(() => research.cancel(run.id))}>
                {t('rs.cancel')}
              </Button>
            </>
          )}
          {(run.status === 'interrupted' || run.status === 'cancelled' || run.status === 'failed') && (
            <>
              <Button size="sm" tone="primary" icon={<RotateCcw size={14} />} onClick={() => act(() => research.resume(run.id))}>
                {t('rs.resume')}
              </Button>
              {run.evidence.length > 0 && run.plan && (
                <Button size="sm" icon={<PenLine size={14} />} onClick={() => act(() => research.writeNow(run.id))}>
                  {t('rs.writeNow')}
                </Button>
              )}
            </>
          )}
          {!active &&
            (confirmDelete ? (
              <span className="row">
                <Button size="sm" tone="danger" onClick={() => act(() => research.remove(run.id).then(onDeleted))}>
                  {t('rs.delete')}
                </Button>
                <Button size="sm" tone="ghost" onClick={() => setConfirmDelete(false)}>
                  {t('creator.cancel')}
                </Button>
              </span>
            ) : (
              <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} aria-label={t('rs.delete')} />
            ))}
        </div>
      </header>
      {error && <p className="chat-error">{error}</p>}
      {run.error && run.status === 'failed' && <p className="chat-error">{run.error}</p>}

      {run.status === 'clarifying' && run.clarifyingQuestions?.length ? <Clarify run={run} /> : null}
      {run.status === 'awaiting_plan' && run.plan && <PlanEditor run={run} />}

      {(run.plan || run.evidence.length > 0) && run.status !== 'awaiting_plan' && (
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            label={t('rs.view')}
            options={[
              ...(run.report ? [{ value: 'report' as Tab, label: t('rs.tab.report') }] : []),
              { value: 'progress' as Tab, label: t('rs.tab.progress') },
              { value: 'sources' as Tab, label: t('rs.tab.sources', { n: run.sources.filter((s) => !s.irrelevant).length }) },
              { value: 'evidence' as Tab, label: t('rs.tab.evidence', { n: run.evidence.length }) },
              { value: 'log' as Tab, label: t('rs.tab.log') },
            ]}
          />
          {tab === 'report' && run.report && <ReportView run={run} />}
          {tab === 'progress' && <Progress run={run} />}
          {tab === 'sources' && <SourcesList run={run} />}
          {tab === 'evidence' && <EvidenceList run={run} />}
          {tab === 'log' && <EventLog run={run} />}
        </>
      )}
      {!run.plan && active && <Progress run={run} />}
    </div>
  );
}

function Clarify({ run }: { run: ResearchRun }) {
  const t = useT();
  const research = useResearch();
  const [answers, setAnswers] = useState<string[]>(run.clarifyingQuestions!.map(() => ''));
  return (
    <section className="rs-card">
      <h3>{t('rs.clarifyTitle')}</h3>
      <p className="muted small">{t('rs.clarifySub')}</p>
      {run.clarifyingQuestions!.map((q, i) => (
        <label key={i} className="field-stack">
          <span>{q}</span>
          <input value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
        </label>
      ))}
      <div className="row">
        <Button tone="primary" onClick={() => void research.answer(run.id, answers)}>
          {t('rs.continue')}
        </Button>
        <Button tone="ghost" onClick={() => void research.answer(run.id, [])}>
          {t('rs.skip')}
        </Button>
      </div>
    </section>
  );
}

function PlanEditor({ run }: { run: ResearchRun }) {
  const t = useT();
  const research = useResearch();
  const [plan, setPlan] = useState<ResearchPlan>(() => structuredClone(run.plan!));
  const [error, setError] = useState('');
  const set = (i: number, text: string) => setPlan({ ...plan, subQuestions: plan.subQuestions.map((q, j) => (j === i ? { ...q, text } : q)) });
  return (
    <section className="rs-card rs-plan">
      <h3>{t('rs.planTitle')}</h3>
      <p className="muted small">{t('rs.planSub')}</p>
      <label className="field-stack">
        <span>{t('rs.reportTitle')}</span>
        <input value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
      </label>
      <label className="field-stack">
        <span>{t('rs.reportKind')}</span>
        <select value={plan.kind} onChange={(e) => setPlan({ ...plan, kind: e.target.value as ReportKind })}>
          {REPORT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`rs.kind.${k}` as TKey)}
            </option>
          ))}
        </select>
      </label>
      <span className="field-label">{t('rs.subQuestions')}</span>
      <ol className="rs-subqs">
        {plan.subQuestions.map((q, i) => (
          <li key={i}>
            <input value={q.text} onChange={(e) => set(i, e.target.value)} aria-label={`${t('rs.subQuestion')} ${i + 1}`} />
            {q.lookFor && <small className="muted">{q.lookFor}</small>}
            <button type="button" className="icon-btn" aria-label={t('rs.removeSub')} onClick={() => setPlan({ ...plan, subQuestions: plan.subQuestions.filter((_, j) => j !== i) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      {plan.subQuestions.length < 9 && (
        <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setPlan({ ...plan, subQuestions: [...plan.subQuestions, { id: '', text: '', coverage: 'open' }] })}>
          {t('rs.addSub')}
        </Button>
      )}
      {error && <p className="chat-error">{error}</p>}
      <div className="row">
        <Button tone="primary" icon={<CirclePlay size={15} />} onClick={() => research.approve(run.id, plan).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
          {t('rs.startRounds')}
        </Button>
        <Button tone="ghost" onClick={() => research.cancel(run.id)}>
          {t('rs.cancel')}
        </Button>
      </div>
    </section>
  );
}

const fmtTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

function Progress({ run }: { run: ResearchRun }) {
  const t = useT();
  const active = isActive(run.status);
  const now = useNow(active);
  const last = [...run.events].reverse().find((e) => e.phase !== 'warning') ?? run.events.at(-1);
  const elapsed = Math.round(((run.finishedAt ?? (active ? now : run.updatedAt)) - (run.startedAt ?? run.createdAt)) / 1000);
  const pages = run.sources.filter((s) => s.kind === 'web').length;
  const tokens = run.usage.inputTokens + run.usage.outputTokens;
  const meters: [string, number, number][] = [
    [t('rs.m.rounds'), run.round, run.budget.rounds],
    [t('rs.m.searches'), run.queries.length, run.budget.searches],
    [t('rs.m.pages'), pages, run.budget.pages],
    [t('rs.m.minutes'), Math.round(elapsed / 60), run.budget.minutes],
    [t('rs.m.tokens'), tokens, run.budget.tokens],
  ];
  return (
    <section className="rs-progress">
      {last && (
        <p className={`rs-phase ${active ? 'live' : ''}`}>
          {active && <span className="rs-pulse" />}
          {last.message}
        </p>
      )}
      <div className="rs-meters">
        {meters.map(([label, v, max]) => (
          <div key={label} className="rs-meter">
            <small>{label}</small>
            <b>{label === t('rs.m.tokens') ? `${fmtTokens(v)} / ${fmtTokens(max)}` : `${v} / ${max}`}</b>
            <i style={{ width: `${Math.min(100, (v / Math.max(1, max)) * 100)}%` }} />
          </div>
        ))}
        <div className="rs-meter">
          <small>{t('rs.m.evidence')}</small>
          <b>{run.evidence.length}</b>
        </div>
        {run.usage.costUsd !== undefined && (
          <div className="rs-meter">
            <small>{t('rs.m.cost')}</small>
            <b>${run.usage.costUsd.toFixed(2)}</b>
          </div>
        )}
      </div>
      {run.plan && <CoverageMap run={run} />}
      {run.stopReason && <p className="muted small">{t('rs.stopped', { why: run.stopReason })}</p>}
    </section>
  );
}

/** the question → its sub-questions → the sources that answer each (dots by type) */
function CoverageMap({ run }: { run: ResearchRun }) {
  const t = useT();
  return (
    <div className="rs-coverage">
      {run.plan!.subQuestions.map((q) => {
        const ids = [...new Set(run.evidence.filter((e) => e.subQuestionIds.includes(q.id)).map((e) => e.sourceId))];
        return (
          <div key={q.id} className={`rs-cov ${q.coverage}`}>
            <span className="rs-cov-q">
              <b>{q.id}</b> {q.text}
            </span>
            <span className="rs-cov-dots">
              {ids.map((id) => {
                const s = run.sources.find((x) => x.id === id);
                return <i key={id} className={`rs-src-dot ${s?.kind === 'knowledge' ? 'kn' : (s?.type ?? 'unknown')}`} title={`${id} · ${s?.title ?? s?.domain ?? ''}`} />;
              })}
              <small>{t(`rs.cov.${q.coverage}` as TKey)}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EvidenceList({ run }: { run: ResearchRun }) {
  const t = useT();
  if (!run.evidence.length) return <p className="muted small">{t('rs.noEvidence')}</p>;
  return (
    <ul className="rs-evidence">
      {run.evidence.map((e) => (
        <li key={e.id}>
          <small className="mono">
            {e.id} · {e.sourceId} · {e.subQuestionIds.join(', ')}
          </small>
          <b>{e.claim}</b>
          <blockquote>{e.quote}</blockquote>
          {e.context && (
            <blockquote className="rs-context" title={t('rs.contextHint')}>
              {e.context}
            </blockquote>
          )}
        </li>
      ))}
    </ul>
  );
}

function EventLog({ run }: { run: ResearchRun }) {
  return (
    <ol className="rs-log">
      {[...run.events].reverse().map((e, i) => (
        <li key={i} className={e.phase}>
          <time>{new Date(e.at).toLocaleTimeString()}</time> <span>{e.message}</span>
        </li>
      ))}
    </ol>
  );
}

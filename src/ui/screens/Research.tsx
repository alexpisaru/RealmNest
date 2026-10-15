// Research (Deep Research): the library of runs on the left; on the right a new research, or a
// run — its clarifying questions, its plan to approve, its live progress, its report.

import { Plus, Telescope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isActive, type ResearchRun } from '../../domain/research';
import type { TKey } from '../../i18n';
import { useApp, useResearch, useT } from '../context';
import { Button } from '../kit';
import { NewResearch } from '../research/NewResearch';
import { RunView } from '../research/RunView';

export function ResearchScreen() {
  const t = useT();
  const st = useApp();
  const research = useResearch();
  const runs = research.list();
  const [selected, setSelected] = useState<string | 'new'>(() => st.researchFocus.id ?? runs[0]?.id ?? 'new');
  const [question, setQuestion] = useState(st.researchFocus.question ?? '');
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!st.researchFocus.at) return;
    if (st.researchFocus.id) setSelected(st.researchFocus.id);
    else {
      setQuestion(st.researchFocus.question ?? '');
      setSelected('new');
    }
  }, [st.researchFocus.at]);
  const shown = useMemo(() => runs.filter((r) => !q.trim() || `${r.plan?.title ?? ''} ${r.question}`.toLowerCase().includes(q.trim().toLowerCase())), [runs, q]);
  const run = selected !== 'new' ? research.get(selected) : undefined;

  return (
    <div className="research-screen">
      <aside className="rs-library panel-glass">
        <header>
          <h1 className="display">
            <Telescope size={20} /> {t('rs.title')}
          </h1>
          <Button size="sm" tone="primary" icon={<Plus size={14} />} onClick={() => (setQuestion(''), setSelected('new'))}>
            {t('rs.new')}
          </Button>
        </header>
        {runs.length > 4 && <input className="rs-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('rs.searchLibrary')} aria-label={t('rs.searchLibrary')} />}
        {!runs.length && <p className="muted small">{t('rs.empty')}</p>}
        <ul>
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className={`rs-item ${selected === r.id ? 'on' : ''}`} onClick={() => setSelected(r.id)}>
                <b>{r.report?.title ?? r.plan?.title ?? r.question.slice(0, 80)}</b>
                <small>
                  <StatusDot run={r} /> {t(`rs.status.${r.status}` as TKey)} · {new Date(r.createdAt).toLocaleDateString()}
                  {r.owner.kind === 'agent' && ` · ${t('rs.byAgent')}`}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="rs-main panel-glass">{run ? <RunView key={run.id} run={run} onDeleted={() => setSelected(runs.find((x) => x.id !== run.id)?.id ?? 'new')} /> : <NewResearch initialQuestion={question} onStarted={(id) => setSelected(id)} />}</main>
    </div>
  );
}

export function StatusDot({ run }: { run: ResearchRun }) {
  const cls = run.status === 'done' ? 'ok' : run.status === 'failed' ? 'bad' : isActive(run.status) ? 'busy' : run.status === 'awaiting_plan' ? 'wait' : 'idle';
  return <i className={`rs-dot ${cls}`} />;
}

// The Crew screen (docs/CREW.md): crews on the left with their work; on the right a crew (members,
// roles, goal), its editor, or one run — the task graph (columns by dependency, arrows), each
// task's details, the plan to approve, the final result to approve, and the history.

import { Check, Network, Pencil, Play, Plus, RotateCcw, SkipForward, Square, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WORLD_BY_ID, WORLDS } from '../../data/worlds';
import { depthOf, type Crew, type CrewMember, type CrewRun, type CrewTask } from '../../domain/crew';
import type { TKey } from '../../i18n';
import { CREW_TEMPLATES } from '../../runtime/crew/service';
import { useApp, useCrews, useServices, useT, useTD } from '../context';
import { useArtifacts } from '../files/FileViews';
import { Button, Portrait } from '../kit';
import { lookOf } from '../sessionManager';

/** new: n changes on every "New", so the form starts empty again */
type View = { kind: 'crew'; id: string } | { kind: 'run'; id: string } | { kind: 'new'; n?: number } | { kind: 'edit'; id: string };

export function CrewsScreen() {
  const t = useT();
  const td = useTD();
  const st = useApp();
  const crews = useCrews();
  const list = crews.list();
  const [view, setView] = useState<View>(() => (st.crewFocus.runId ? { kind: 'run', id: st.crewFocus.runId } : list[0] ? { kind: 'crew', id: list[0].id } : { kind: 'new' }));
  useEffect(() => {
    if (!st.crewFocus.at) return;
    if (st.crewFocus.runId) setView({ kind: 'run', id: st.crewFocus.runId });
    else if (st.crewFocus.crewId) setView({ kind: 'crew', id: st.crewFocus.crewId });
  }, [st.crewFocus.at]);
  const run = view.kind === 'run' ? crews.run(view.id) : undefined;
  const crew = view.kind === 'crew' || view.kind === 'edit' ? crews.get(view.id) : run ? crews.get(run.crewId) : undefined;

  return (
    <div className="research-screen crew-screen">
      <aside className="rs-library panel-glass">
        <header>
          <h1 className="display">
            <Network size={20} /> {t('cw.title')}
          </h1>
          <Button size="sm" tone="primary" icon={<Plus size={14} />} onClick={() => setView({ kind: 'new', n: Date.now() })}>
            {t('cw.new')}
          </Button>
        </header>
        {!list.length && <p className="muted small">{t('cw.empty')}</p>}
        <ul>
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" className={`rs-item ${(view.kind === 'crew' || view.kind === 'edit') && view.id === c.id ? 'on' : ''}`} onClick={() => setView({ kind: 'crew', id: c.id })}>
                <b>{c.name}</b>
                <small>
                  {td(WORLD_BY_ID[c.worldId]?.name) || c.worldId} · {c.members.length} · {c.members.map((m) => st.characters.find((x) => x.id === m.agentId)?.name).filter(Boolean).join(', ')}
                </small>
              </button>
              <ul className="cw-runs-mini">
                {crews
                  .runsOf(c.id)
                  .slice(0, 4)
                  .map((r) => (
                    <li key={r.id}>
                      <button type="button" className={`rs-item sub ${view.kind === 'run' && view.id === r.id ? 'on' : ''}`} onClick={() => setView({ kind: 'run', id: r.id })}>
                        <span>{r.goal.slice(0, 60)}</span>
                        <small className={`cw-rs ${r.status}`}>{t(`cw.rs.${r.status}` as TKey)}</small>
                      </button>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
      <main className="rs-main">
        {view.kind === 'new' && <CrewEditor key={view.n ?? 0} onDone={(c) => setView(c ? { kind: 'crew', id: c.id } : list[0] ? { kind: 'crew', id: list[0].id } : { kind: 'new', n: Date.now() })} />}
        {view.kind === 'edit' && crew && <CrewEditor crew={crew} onDone={() => setView({ kind: 'crew', id: crew.id })} />}
        {view.kind === 'crew' && crew && <CrewHome crew={crew} onEdit={() => setView({ kind: 'edit', id: crew.id })} onRun={(id) => setView({ kind: 'run', id })} onDeleted={() => setView({ kind: 'new' })} />}
        {view.kind === 'run' && run && <RunView run={run} onDeleted={() => setView(crew ? { kind: 'crew', id: crew.id } : { kind: 'new' })} />}
      </main>
    </div>
  );
}

// ── people ────────────────────────────────────────────────
function usePeople() {
  const st = useApp();
  return useMemo(() => {
    const by = new Map(st.characters.map((c) => [c.id, c]));
    return { name: (id: string | undefined) => (id && by.get(id)?.name) || id || '?', char: (id: string) => by.get(id), inWorld: (w: string) => st.characters.filter((c) => c.worldId === w) };
  }, [st.characters]);
}

export function Face({ agentId, size = 2 }: { agentId: string; size?: number }) {
  const p = usePeople();
  const c = p.char(agentId);
  const look = useMemo(() => (c ? lookOf(c) : undefined), [c]);
  if (!look) return <span className="cw-face empty" />;
  return (
    <span className="cw-face" title={c?.name}>
      <Portrait look={look} scale={size} bust />
    </span>
  );
}

// ── a crew ────────────────────────────────────────────────
function CrewEditor({ crew, onDone }: { crew?: Crew; onDone: (c?: Crew) => void }) {
  const t = useT();
  const td = useTD();
  const crews = useCrews();
  const people = usePeople();
  const { sessions } = useServices();
  const firstWorld = crew?.worldId ?? sessions.getSession()?.world.id ?? WORLDS.find((w) => people.inWorld(w.id).length)?.id ?? WORLDS[0].id;
  const [worldId, setWorldId] = useState(firstWorld);
  const [name, setName] = useState(crew?.name ?? '');
  const [goal, setGoal] = useState(crew?.goal ?? '');
  const [brief, setBrief] = useState(crew?.brief ?? '');
  const [workspace, setWorkspace] = useState(crew?.workspace ?? '');
  const [members, setMembers] = useState<CrewMember[]>(crew?.members ?? []);
  const [coordinatorId, setCoordinator] = useState(crew?.coordinatorId ?? '');
  const [reviewerId, setReviewer] = useState(crew?.reviewerId ?? '');
  const [error, setError] = useState('');
  const agents = people.inWorld(worldId);
  const set = (id: string, patch: Partial<CrewMember>) => setMembers((ms) => ms.map((m) => (m.agentId === id ? { ...m, ...patch } : m)));
  const toggle = (id: string) => setMembers((ms) => (ms.some((m) => m.agentId === id) ? ms.filter((m) => m.agentId !== id) : [...ms, { agentId: id, role: '' }]));
  /** a template's text in the user's language (its own text when there is no translation) */
  const tplText = (key: string, own: string) => {
    const v = t(key as TKey);
    return v === key ? own : v;
  };
  /** a template: its roles on the world's agents, in order (the coordinator first) */
  const applyTemplate = (id: string) => {
    const tpl = CREW_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    setName(tplText(`p.cw.tpl.${tpl.id}`, tpl.name));
    setGoal(tplText(`p.cw.tpl.${tpl.id}.goal`, tpl.goal));
    const pool = agents.map((a) => a.id);
    const coord = pool[0];
    const ms: CrewMember[] = coord ? [{ agentId: coord, role: t('cw.coordinator'), duty: t('p.cw.coordDuty') }] : [];
    tpl.roles.forEach((r, i) => {
      const a = pool[i + 1];
      if (a) ms.push({ agentId: a, role: tplText(`p.cw.tpl.${tpl.id}.r${i}`, r.role), duty: tplText(`p.cw.tpl.${tpl.id}.d${i}`, r.duty) });
    });
    setMembers(ms);
    if (coord) setCoordinator(coord);
    const rev = tpl.roles.findIndex((r) => r.reviewer);
    setReviewer(rev >= 0 && pool[rev + 1] ? pool[rev + 1] : '');
  };
  const save = () => {
    setError('');
    try {
      const input = { name, worldId, goal, brief, members, coordinatorId, ...(reviewerId && { reviewerId }), ...(workspace.trim() && { workspace }) };
      onDone(crew ? crews.update(crew.id, { ...input, ...(reviewerId ? {} : { reviewerId: undefined }), ...(workspace.trim() ? {} : { workspace: undefined }) }) : crews.create(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="rs-new cw-editor">
      <h2>
        <Network size={18} /> {crew ? crew.name : t('cw.new')}
      </h2>
      {!crew && (
        <div className="cw-templates">
          <span className="muted small">{t('cw.template')}</span>
          {CREW_TEMPLATES.map((x) => (
            <Button key={x.id} size="sm" tone="ghost" onClick={() => applyTemplate(x.id)}>
              {tplText(`p.cw.tpl.${x.id}`, x.name)}
            </Button>
          ))}
        </div>
      )}
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('cw.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field-stack">
          <span>{t('cw.world')}</span>
          <select
            value={worldId}
            onChange={(e) => {
              setWorldId(e.target.value);
              setMembers([]);
              setCoordinator('');
              setReviewer('');
            }}
          >
            {WORLDS.map((w) => (
              <option key={w.id} value={w.id}>
                {td(w.name)} ({people.inWorld(w.id).length})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-stack">
        <span>{t('cw.members')}</span>
        {!agents.length && <p className="muted small">{t('cw.noAgents')}</p>}
        <ul className="cw-member-list">
          {agents.map((a) => {
            const m = members.find((x) => x.agentId === a.id);
            return (
              <li key={a.id} className={m ? 'on' : ''}>
                <label className="cw-member-pick">
                  <input type="checkbox" checked={!!m} onChange={() => toggle(a.id)} />
                  <Face agentId={a.id} />
                  <b>{a.name}</b>
                  <small className="muted">{a.role}</small>
                </label>
                {m && (
                  <>
                    <input value={m.role} placeholder={t('cw.role')} aria-label={`${a.name}: ${t('cw.role')}`} onChange={(e) => set(a.id, { role: e.target.value })} />
                    <input value={m.duty ?? ''} placeholder={t('cw.duty')} aria-label={`${a.name}: ${t('cw.duty')}`} onChange={(e) => set(a.id, { duty: e.target.value })} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('cw.coordinator')}</span>
          <select value={coordinatorId} onChange={(e) => setCoordinator(e.target.value)}>
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.agentId} value={m.agentId}>
                {people.name(m.agentId)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span>{t('cw.reviewer')}</span>
          <select value={reviewerId} onChange={(e) => setReviewer(e.target.value)}>
            <option value="">{t('cw.noReviewer')}</option>
            {members.map((m) => (
              <option key={m.agentId} value={m.agentId}>
                {people.name(m.agentId)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field-stack">
        <span>{t('cw.goal')}</span>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t('cw.goalPh')} />
      </label>
      <label className="field-stack">
        <span>{t('cw.brief')}</span>
        <textarea rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t('cw.briefPh')} />
      </label>
      <label className="field-stack">
        <span>{t('cw.folder')}</span>
        <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder={t('cw.folderPh')} spellCheck={false} />
        <small className="muted">{t('cw.folderSub')}</small>
      </label>
      {error && <p className="chat-error">{error}</p>}
      <div className="row">
        <Button tone="primary" icon={<Check size={15} />} onClick={save} disabled={!agents.length}>
          {t('cw.save')}
        </Button>
        <Button tone="ghost" onClick={() => onDone(crew)}>
          {t('cw.cancel')}
        </Button>
      </div>
    </div>
  );
}

function CrewHome({ crew, onEdit, onRun, onDeleted }: { crew: Crew; onEdit: () => void; onRun: (id: string) => void; onDeleted: () => void }) {
  const t = useT();
  const td = useTD();
  const crews = useCrews();
  const people = usePeople();
  const [goal, setGoal] = useState(crew.goal);
  const [error, setError] = useState('');
  useEffect(() => setGoal(crew.goal), [crew.id]);
  const runs = crews.runsOf(crew.id);
  return (
    <div className="rs-run cw-home">
      <header className="cw-head">
        <div>
          <h2>{crew.name}</h2>
          <small className="muted">{td(WORLD_BY_ID[crew.worldId]?.name) || crew.worldId}</small>
        </div>
        <div className="row">
          <Button size="sm" tone="ghost" icon={<Pencil size={14} />} onClick={onEdit}>
            {t('cw.edit')}
          </Button>
          <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => (crews.remove(crew.id), onDeleted())}>
            {t('cw.delete')}
          </Button>
        </div>
      </header>
      <ul className="cw-team">
        {crew.members.map((m) => (
          <li key={m.agentId}>
            <Face agentId={m.agentId} size={3} />
            <b>{people.name(m.agentId)}</b>
            <span>{m.role}</span>
            {m.duty && <small className="muted">{m.duty}</small>}
            <span className="cw-tags">
              {m.agentId === crew.coordinatorId && <em>{t('cw.coordinator')}</em>}
              {m.agentId === crew.reviewerId && <em>{t('cw.reviewer')}</em>}
            </span>
          </li>
        ))}
      </ul>
      {crew.brief && <p className="cw-brief">{crew.brief}</p>}
      {crew.workspace && (
        <p className="muted small">
          {t('cw.folder')}: <code>{crew.workspace}</code>
        </p>
      )}
      <div className="cw-start">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t('cw.goalPh')} aria-label={t('cw.goal')} />
        <Button
          tone="primary"
          icon={<Play size={15} />}
          disabled={!goal.trim()}
          onClick={() => {
            setError('');
            try {
              onRun(crews.start(crew.id, goal).id);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          {t('cw.start')}
        </Button>
      </div>
      {error && <p className="chat-error">{error}</p>}
      <h3>{t('cw.runs')}</h3>
      {!runs.length && <p className="muted small">{t('cw.noRuns')}</p>}
      <ul className="cw-run-list">
        {runs.map((r) => (
          <li key={r.id}>
            <button type="button" className="link-btn" onClick={() => onRun(r.id)}>
              {r.goal}
            </button>
            <small className={`cw-rs ${r.status}`}>{t(`cw.rs.${r.status}` as TKey)}</small>
            <small className="muted">{new Date(r.createdAt).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── a run ─────────────────────────────────────────────────
function RunView({ run, onDeleted }: { run: CrewRun; onDeleted: () => void }) {
  const t = useT();
  const td = useTD();
  const crews = useCrews();
  const people = usePeople();
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<CrewTask[]>(run.plan);
  const [error, setError] = useState('');
  const editing = run.status === 'awaiting_plan';
  useEffect(() => setDraft(run.plan), [run.id, run.status, run.plan.length]);
  const act = (fn: () => unknown) => {
    setError('');
    try {
      const r = fn();
      if (r instanceof Promise) r.catch((e) => setError(e instanceof Error ? e.message : String(e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const tasks = editing ? draft : run.plan;
  const task = tasks.find((x) => x.id === selected);
  const coord = people.name(run.crew.coordinatorId);
  return (
    <div className="rs-run cw-run">
      <header className="cw-head">
        <div>
          <small className={`cw-rs ${run.status}`}>{t(`cw.rs.${run.status}` as TKey)}</small>
          <h2>{run.goal}</h2>
          <small className="muted">
            {run.crew.name} · {td(WORLD_BY_ID[run.crew.worldId]?.name)}
          </small>
        </div>
        <div className="row">
          {(run.status === 'running' || run.status === 'planning' || run.status === 'assembling') && (
            <Button size="sm" tone="danger" icon={<Square size={14} />} onClick={() => act(() => crews.cancel(run.id))}>
              {t('cw.stop')}
            </Button>
          )}
          {run.status === 'interrupted' && (
            <Button size="sm" tone="primary" icon={<RotateCcw size={14} />} onClick={() => act(() => crews.resume(run.id))}>
              {t('cw.resume')}
            </Button>
          )}
          {(run.status === 'awaiting_plan' || run.status === 'failed') && (
            <Button size="sm" tone="ghost" icon={<RotateCcw size={14} />} onClick={() => act(() => crews.replan(run.id))}>
              {t('cw.replan')}
            </Button>
          )}
          {!(run.status === 'running' || run.status === 'planning' || run.status === 'assembling') && (
            <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => act(() => (crews.removeRun(run.id), onDeleted()))}>
              {t('cw.remove')}
            </Button>
          )}
        </div>
      </header>
      {run.status === 'planning' && <p className="cw-banner">{t('cw.planning', { name: coord })}</p>}
      {run.status === 'assembling' && <p className="cw-banner">{t('cw.assembling', { name: coord })}</p>}
      {run.error && <p className="chat-error">{run.error}</p>}
      {error && <p className="chat-error">{error}</p>}
      {run.status === 'running' &&
        run.plan
          .filter((x) => x.status === 'needs_input')
          .map((x) => (
            <div key={x.id} className="cw-banner cw-ask-banner">
              <span>{t('cw.ask.banner', { name: people.name(x.assigneeId), id: x.id })}</span>
              <Button size="sm" tone="primary" onClick={() => setSelected(x.id)}>
                {t('cw.ask.open')}
              </Button>
            </div>
          ))}
      {editing && (
        <div className="cw-plan-bar">
          <span className="muted small">{t('cw.planHint')}</span>
          <Button
            size="sm"
            tone="ghost"
            icon={<Plus size={14} />}
            onClick={() => {
              const n = Math.max(0, ...draft.map((x) => Number(x.id.replace(/\D/g, '')) || 0)) + 1;
              const id = `T${n}`;
              setDraft([...draft, { id, title: '', assigneeId: run.crew.members[0].agentId, instructions: '', dependsOn: [], review: false, status: 'waiting', attempts: [], revisions: 0 }]);
              setSelected(id);
            }}
          >
            {t('cw.addTask')}
          </Button>
          <Button size="sm" tone="primary" icon={<Play size={14} />} onClick={() => act(() => (crews.setPlan(run.id, draft), crews.approvePlan(run.id)))}>
            {t('cw.approvePlan')}
          </Button>
        </div>
      )}
      {tasks.length > 0 && <Graph tasks={tasks} selected={selected} onSelect={(id) => setSelected(id === selected ? undefined : id)} />}
      {task &&
        (editing ? (
          <TaskEditor
            task={task}
            all={draft}
            members={run.crew.members}
            reviewer={!!run.crew.reviewerId}
            onChange={(next) => setDraft(draft.map((x) => (x.id === task.id ? next : x)))}
            onRemove={() => (setDraft(draft.filter((x) => x.id !== task.id).map((x) => ({ ...x, dependsOn: x.dependsOn.filter((d) => d !== task.id) }))), setSelected(undefined))}
            onClose={() => setSelected(undefined)}
          />
        ) : (
          <TaskDetails run={run} task={task} onClose={() => setSelected(undefined)} act={act} />
        ))}
      {run.final && (run.status === 'awaiting_approval' || run.status === 'done' || run.final.text) && <FinalPanel run={run} act={act} />}
      <Outputs run={run} />
      <History run={run} />
    </div>
  );
}

/** the task graph: a column per dependency depth, arrows from each dependency */
function Graph({ tasks, selected, onSelect }: { tasks: CrewTask[]; selected?: string; onSelect: (id: string) => void }) {
  const t = useT();
  const people = usePeople();
  const box = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<{ d: string; done: boolean }[]>([]);
  const depth = useMemo(() => depthOf(tasks), [tasks]);
  const columns = useMemo(() => {
    const max = Math.max(0, ...depth.values());
    return Array.from({ length: max + 1 }, (_, i) => tasks.filter((x) => (depth.get(x.id) ?? 0) === i));
  }, [tasks, depth]);
  useLayoutEffect(() => {
    const measure = () => {
      const b = box.current?.getBoundingClientRect();
      if (!b) return;
      const out: { d: string; done: boolean }[] = [];
      for (const x of tasks)
        for (const dep of x.dependsOn) {
          const from = cards.current.get(dep)?.getBoundingClientRect();
          const to = cards.current.get(x.id)?.getBoundingClientRect();
          if (!from || !to) continue;
          const x1 = from.right - b.left;
          const y1 = from.top + from.height / 2 - b.top;
          const x2 = to.left - b.left;
          const y2 = to.top + to.height / 2 - b.top;
          const mid = (x1 + x2) / 2;
          out.push({ d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`, done: tasks.find((y) => y.id === dep)?.status === 'done' });
        }
      setPaths(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [tasks, columns]);
  return (
    <div className="cw-graph" ref={box}>
      <svg className="cw-arrows" aria-hidden>
        {paths.map((p, i) => (
          <path key={i} d={p.d} className={p.done ? 'done' : ''} />
        ))}
      </svg>
      {columns.map((col, i) => (
        <div className="cw-col" key={i}>
          {col.map((x) => (
            <button
              key={x.id}
              type="button"
              ref={(el) => {
                if (el) cards.current.set(x.id, el);
                else cards.current.delete(x.id);
              }}
              className={`cw-card st-${x.status} ${selected === x.id ? 'on' : ''}`}
              onClick={() => onSelect(x.id)}
            >
              <span className="cw-card-top">
                <code>{x.id}</code>
                <span className={`cw-st st-${x.status}`}>{t(`cw.st.${x.status}` as TKey)}</span>
              </span>
              <b>{x.title || '…'}</b>
              <span className="cw-card-who">
                <Face agentId={x.assigneeId} />
                {people.name(x.assigneeId)}
                {x.review && <em>{t('cw.review')}</em>}
              </span>
              {x.note && <small className="muted">{x.noteKey ? t(`cw.note.${x.noteKey}` as TKey, x.noteVars ?? {}) : x.note}</small>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function TaskEditor({ task, all, members, reviewer, onChange, onRemove, onClose }: { task: CrewTask; all: CrewTask[]; members: CrewMember[]; reviewer: boolean; onChange: (t: CrewTask) => void; onRemove: () => void; onClose: () => void }) {
  const t = useT();
  const people = usePeople();
  return (
    <section className="cw-drawer">
      <header>
        <code>{task.id}</code>
        <input value={task.title} onChange={(e) => onChange({ ...task, title: e.target.value })} aria-label={t('p.cw.taskTitle')} />
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('cw.cancel')}>
          <X size={15} />
        </button>
      </header>
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('cw.assignee')}</span>
          <select value={task.assigneeId} onChange={(e) => onChange({ ...task, assigneeId: e.target.value })}>
            {members.map((m) => (
              <option key={m.agentId} value={m.agentId}>
                {people.name(m.agentId)} · {m.role}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span>{t('cw.deliverable')}</span>
          <input value={task.deliverable ?? ''} onChange={(e) => onChange({ ...task, deliverable: e.target.value })} />
        </label>
      </div>
      <label className="field-stack">
        <span>{t('cw.instructions')}</span>
        <textarea rows={3} value={task.instructions} onChange={(e) => onChange({ ...task, instructions: e.target.value })} />
      </label>
      <div className="cw-deps">
        <span className="muted small">{t('cw.dependsOn')}</span>
        {all
          .filter((x) => x.id !== task.id)
          .map((x) => (
            <label key={x.id} className="cw-chip">
              <input type="checkbox" checked={task.dependsOn.includes(x.id)} onChange={(e) => onChange({ ...task, dependsOn: e.target.checked ? [...task.dependsOn, x.id] : task.dependsOn.filter((d) => d !== x.id) })} />
              {x.id}
            </label>
          ))}
        {reviewer && (
          <label className="cw-chip">
            <input type="checkbox" checked={task.review} onChange={(e) => onChange({ ...task, review: e.target.checked })} />
            {t('cw.review')}
          </label>
        )}
        <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} onClick={onRemove}>
          {t('cw.removeTask')}
        </Button>
      </div>
    </section>
  );
}

function TaskDetails({ run, task, onClose, act }: { run: CrewRun; task: CrewTask; onClose: () => void; act: (fn: () => unknown) => void }) {
  const t = useT();
  const crews = useCrews();
  const people = usePeople();
  const canRetry = run.status === 'running' || run.status === 'failed';
  return (
    <section className="cw-drawer">
      <header>
        <code>{task.id}</code>
        <b>{task.title}</b>
        <span className={`cw-st st-${task.status}`}>{t(`cw.st.${task.status}` as TKey)}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('cw.cancel')}>
          <X size={15} />
        </button>
      </header>
      <p className="small">
        <Face agentId={task.assigneeId} /> {people.name(task.assigneeId)} · {task.instructions}
        {task.deliverable && <span className="muted"> · {t('cw.deliverable')}: {task.deliverable}</span>}
      </p>
      {task.error && <p className="chat-error">{task.error}</p>}
      {task.status === 'needs_input' && <AnswerBox run={run} task={task} act={act} />}
      {!!task.answers?.length && (
        <>
          <h4>{t('cw.answers')}</h4>
          <ul className="cw-answers">
            {task.answers.map((a, i) => (
              <li key={i}>
                <small className="muted">{a.question}</small>
                <span>{a.answer}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {canRetry && (task.status === 'failed' || task.status === 'cancelled' || task.status === 'blocked') && (
        <div className="row">
          {task.status !== 'blocked' && (
            <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => act(() => crews.retryTask(run.id, task.id))}>
              {t('cw.retry')}
            </Button>
          )}
          <Button size="sm" tone="ghost" icon={<SkipForward size={14} />} onClick={() => act(() => crews.skipTask(run.id, task.id))}>
            {t('cw.skip')}
          </Button>
        </div>
      )}
      {task.attempts.length > 0 && (
        <>
          <h4>{t('cw.attempts')}</h4>
          <ul className="cw-attempts">
            {task.attempts.map((a, i) => (
              <li key={i}>
                <Face agentId={a.agentId} /> {people.name(a.agentId)} · {t(`cw.kind.${a.kind}` as TKey)}
                {a.verdict && <em className={`verdict ${a.verdict}`}>{t(`cw.verdict.${a.verdict}` as TKey)}</em>}
                <small className="muted">{new Date(a.at).toLocaleTimeString()}</small>
                {a.notes && <small className="cw-notes">{a.notes}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
      {task.reviewNotes && (
        <p className="cw-notes">
          <b>{t('cw.reviewNotes')}:</b> {task.reviewNotes}
        </p>
      )}
      {task.output && (
        <>
          <h4>{t('cw.output')}</h4>
          <Doc text={task.output} />
        </>
      )}
    </section>
  );
}

/** an agent asked for something it cannot get itself (BLOCKED): the user answers, or skips the task */
function AnswerBox({ run, task, act }: { run: CrewRun; task: CrewTask; act: (fn: () => unknown) => void }) {
  const t = useT();
  const crews = useCrews();
  const people = usePeople();
  const [answer, setAnswer] = useState('');
  return (
    <div className="cw-ask">
      <b>{t('cw.ask.title', { name: people.name(task.assigneeId) })}</b>
      <p>{task.question}</p>
      <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('cw.ask.ph')} aria-label={t('cw.ask.ph')} />
      <div className="row">
        <Button size="sm" tone="primary" icon={<Play size={14} />} disabled={!answer.trim()} onClick={() => act(() => (crews.answerTask(run.id, task.id, answer), setAnswer('')))}>
          {t('cw.ask.send')}
        </Button>
        <Button size="sm" tone="ghost" icon={<SkipForward size={14} />} onClick={() => act(() => crews.skipTask(run.id, task.id))}>
          {t('cw.skip')}
        </Button>
      </div>
    </div>
  );
}

function FinalPanel({ run, act }: { run: CrewRun; act: (fn: () => unknown) => void }) {
  const t = useT();
  const crews = useCrews();
  const artifacts = useArtifacts();
  const [changes, setChanges] = useState('');
  const [asking, setAsking] = useState(false);
  if (!run.final?.text) return null;
  return (
    <section className="cw-final">
      <header>
        <h3>{t('cw.final')}</h3>
        {run.final.artifactId && (
          <Button size="sm" tone="ghost" onClick={() => act(() => artifacts.open(run.final!.artifactId!))}>
            {t('cw.openArtifact')}
          </Button>
        )}
      </header>
      <Doc text={run.final.text} />
      {run.status === 'awaiting_approval' && (
        <div className="cw-approve">
          {!asking ? (
            <>
              <Button tone="primary" icon={<Check size={15} />} onClick={() => act(() => crews.approveFinal(run.id))}>
                {t('cw.approve')}
              </Button>
              <Button tone="ghost" onClick={() => setAsking(true)}>
                {t('cw.changes')}
              </Button>
            </>
          ) : (
            <>
              <textarea rows={2} value={changes} onChange={(e) => setChanges(e.target.value)} placeholder={t('cw.changesPh')} autoFocus />
              <Button tone="primary" disabled={!changes.trim()} onClick={() => act(() => (crews.requestChanges(run.id, changes), setAsking(false), setChanges('')))}>
                {t('cw.send')}
              </Button>
              <Button tone="ghost" onClick={() => setAsking(false)}>
                {t('cw.cancel')}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Outputs({ run }: { run: CrewRun }) {
  const t = useT();
  const artifacts = useArtifacts();
  const list = run.plan.filter((x) => x.artifactId);
  if (!list.length) return null;
  return (
    <section>
      <h3>{t('cw.outputs')}</h3>
      <ul className="cw-outputs">
        {list.map((x) => (
          <li key={x.id}>
            <button type="button" className="link-btn" onClick={() => void artifacts.open(x.artifactId!).catch(() => undefined)}>
              {x.id} · {x.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ run }: { run: CrewRun }) {
  const t = useT();
  if (!run.history.length) return null;
  return (
    <section>
      <h3>{t('cw.history')}</h3>
      <ol className="cw-history">
        {[...run.history].reverse().map((h, i) => (
          <li key={i} className={`k-${h.kind}`}>
            <small className="muted">{new Date(h.at).toLocaleTimeString()}</small>
            {h.agentId ? <Face agentId={h.agentId} /> : <span className="cw-face empty" />}
            <span>
              {h.taskId && <code>{h.taskId}</code>} {h.key ? t(`cw.ev.${h.key}` as TKey, h.vars ?? {}) : h.message}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Markdown-ish text as React elements (headings, bullets, rules, bold, italics, code): never HTML */
export function Doc({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g).map((p, i) =>
      p.length > 4 && p.startsWith('**') && p.endsWith('**') ? (
        <strong key={i}>{p.slice(2, -2)}</strong>
      ) : p.length > 2 && p.startsWith('`') && p.endsWith('`') ? (
        <code key={i}>{p.slice(1, -1)}</code>
      ) : p.length > 2 && ((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) ? (
        <em key={i}>{p.slice(1, -1)}</em>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`l${out.length}`}>{list.map((x, i) => <li key={i}>{inline(x)}</li>)}</ul>);
    list = [];
  };
  for (const line of text.split('\n')) {
    const h = /^(#{1,4})\s+(.*)/.exec(line);
    const b = /^\s*(?:[-*]|\d+\.)\s+(.*)/.exec(line);
    if (b) {
      list.push(b[1]);
      continue;
    }
    flush();
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (h) out.push(h[1].length <= 2 ? <h4 key={out.length}>{inline(h[2])}</h4> : <h5 key={out.length}>{inline(h[2])}</h5>);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="cw-doc">{out}</div>;
}

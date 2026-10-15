// The Workflow screen (docs/WORKFLOWS.md), in four tabs: the workflows (what: a form editor in tabs
// with a read-only graph), their runs (how they go: the live graph, approvals, retries, history), the
// schedules (when) and To do (what needs you). Definitions and runs stay apart: a run shows the
// copy of the definition it started from.

import { Bot, CalendarClock, Check, Copy, Diamond, FileOutput, Hand, Hourglass, Inbox, Merge, Network, Pencil, Play, Plus, RotateCcw, SkipForward, Split, Square, Trash2, Workflow, Wrench, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WORLDS } from '../../data/worlds';
import type { JsonSchema } from '../../domain/tool';
import { isOpenRun, NODE_KINDS, workflowOrder, type EdgeWhen, type NodeConfig, type NodeKind, type NodePolicy, type NodeRun, type Schedule, type ScheduleTrigger, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode, type WorkflowRun } from '../../domain/workflow';
import type { TKey } from '../../i18n';
import { checkDefinition, WORKFLOW_TEMPLATES, WorkflowError } from '../../runtime/workflow/library';
import { checkTrigger, nextTime } from '../../runtime/workflow/scheduler';
import { useApp, useCrews, useOrchestrator, useScheduler, useServices, useT, useTD, useTools, useWorkflows } from '../context';
import { useArtifacts } from '../files/FileViews';
import { Button } from '../kit';
import { Doc, Face } from './Crews';

type Tab = 'defs' | 'runs' | 'schedules' | 'inbox';
type Draft = Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
type Sel = { kind: 'run'; id: string } | { kind: 'schedule'; id: string };

const KIND_ICON: Record<NodeKind, typeof Bot> = { agent: Bot, tool: Wrench, crew: Network, wait: Hourglass, approval: Hand, condition: Diamond, parallel: Split, merge: Merge, output: FileOutput };
/** a workflow error in the user's language (its key), anything else as it is */
function useErr() {
  const t = useT();
  return (e: unknown) => {
    if (e instanceof WorkflowError && e.key) {
      const vars = { ...e.vars };
      if (vars.what) vars.what = t(`wf.err.what.${vars.what}` as TKey);
      return t(`wf.err.${e.key}` as TKey, vars);
    }
    return e instanceof Error ? e.message : String(e);
  };
}
const draftOf = (d: WorkflowDefinition): Draft => structuredClone({ name: d.name, ...(d.description && { description: d.description }), inputs: d.inputs, nodes: d.nodes, edges: d.edges, policies: d.policies, ...(d.templateId && { templateId: d.templateId }) });
const when = (iso: number | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '');

export function WorkflowsScreen() {
  const t = useT();
  const st = useApp();
  const workflows = useWorkflows();
  const orch = useOrchestrator();
  const scheduler = useScheduler();
  const defs = workflows.all();
  const runs = orch.list();
  const schedules = scheduler.all();
  const inbox = orch.inbox();
  const missed = scheduler.missedUnseen();
  const todo = inbox.length + missed.length;
  const [tab, setTab] = useState<Tab>(() => st.workflowFocus.tab ?? (st.workflowFocus.runId ? 'runs' : todo ? 'inbox' : 'defs'));
  const [defId, setDefId] = useState<string | undefined>(() => st.workflowFocus.workflowId ?? defs[0]?.id);
  const [editing, setEditing] = useState<{ id?: string; draft: Draft }>();
  const [runId, setRunId] = useState<string | undefined>(() => st.workflowFocus.runId ?? runs[0]?.id);
  const [scheduleId, setScheduleId] = useState<string | undefined>(() => st.workflowFocus.scheduleId ?? schedules[0]?.id);
  const [newSchedule, setNewSchedule] = useState<{ workflowId?: string }>();
  const [inboxSel, setInboxSel] = useState<Sel | undefined>(() => (inbox[0] ? { kind: 'run', id: inbox[0].id } : missed[0] ? { kind: 'schedule', id: missed[0].id } : undefined));
  useEffect(() => {
    const f = st.workflowFocus;
    if (!f.at) return;
    if (f.runId) (setRunId(f.runId), setTab('runs'));
    else if (f.scheduleId) (setScheduleId(f.scheduleId), setNewSchedule(undefined), setTab('schedules'));
    else if (f.workflowId) (setDefId(f.workflowId), setEditing(undefined), setTab('defs'));
    else if (f.tab) setTab(f.tab);
  }, [st.workflowFocus.at]);
  const openRun = (id: string) => (setRunId(id), setTab('runs'));
  const openSchedule = (id?: string, workflowId?: string) => {
    setTab('schedules');
    if (id) (setScheduleId(id), setNewSchedule(undefined));
    else setNewSchedule({ ...(workflowId && { workflowId }) });
  };
  const def = defId ? workflows.get(defId) : undefined;
  const run = runId ? orch.get(runId) : undefined;
  const schedule = scheduleId ? scheduler.get(scheduleId) : undefined;
  const tabs: { id: Tab; icon: typeof Bot; key: TKey; badge?: number }[] = [
    { id: 'defs', icon: Workflow, key: 'wf.tab.defs' },
    { id: 'runs', icon: Play, key: 'wf.tab.runs' },
    { id: 'schedules', icon: CalendarClock, key: 'wf.tab.schedules' },
    { id: 'inbox', icon: Inbox, key: 'wf.tab.inbox', badge: todo },
  ];

  return (
    <div className="research-screen crew-screen wf-screen">
      <aside className="rs-library panel-glass">
        <header>
          <h1 className="display">
            <Workflow size={20} /> {t('wf.title')}
          </h1>
        </header>
        <div className="wf-tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
              <x.icon size={14} /> {t(x.key)}
              {!!x.badge && <span className="wf-badge">{x.badge}</span>}
            </button>
          ))}
        </div>
        {tab === 'defs' && (
          <>
            <Button size="sm" tone="primary" icon={<Plus size={14} />} onClick={() => (setEditing(undefined), setDefId(undefined))}>
              {t('wf.new')}
            </Button>
            {!defs.length && <p className="muted small">{t('wf.empty')}</p>}
            <ul>
              {defs.map((d) => (
                <li key={d.id}>
                  <button type="button" className={`rs-item ${defId === d.id ? 'on' : ''}`} onClick={() => (setDefId(d.id), setEditing(undefined))}>
                    <b>{d.name}</b>
                    <small>
                      v{d.version} · {t('wf.nodesCount', { n: String(d.nodes.length) })} · {scheduler.all().filter((s) => s.workflowId === d.id && s.enabled && s.nextAt).length ? t('wf.scheduled') : t('wf.manual')}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === 'runs' && (
          <>
            {!runs.length && <p className="muted small">{t('wf.noRuns')}</p>}
            <ul>
              {runs.map((r) => (
                <li key={r.id}>
                  <RunItem run={r} on={runId === r.id} onClick={() => setRunId(r.id)} />
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === 'schedules' && (
          <>
            <Button size="sm" tone="primary" icon={<Plus size={14} />} disabled={!defs.length} onClick={() => openSchedule(undefined, defId)}>
              {t('wf.sc.new')}
            </Button>
            {!schedules.length && <p className="muted small">{t('wf.noSchedules')}</p>}
            <ul>
              {schedules.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`rs-item ${!newSchedule && scheduleId === s.id ? 'on' : ''}`} onClick={() => openSchedule(s.id)}>
                    <b>{s.name}</b>
                    <small>
                      {s.enabled ? <TriggerText trigger={s.trigger} /> : t('wf.sc.off')}
                      {s.enabled && s.nextAt && s.trigger.kind !== 'once' ? ` · ${when(s.nextAt)}` : ''}
                    </small>
                    {s.missed && <small className="cw-rs awaiting_approval">{t('wf.in.missed')}</small>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === 'inbox' && (
          <>
            {!todo && <p className="muted small">{t('wf.inboxEmpty')}</p>}
            <ul>
              {inbox.map((r) => (
                <li key={r.id}>
                  <RunItem run={r} on={inboxSel?.kind === 'run' && inboxSel.id === r.id} onClick={() => setInboxSel({ kind: 'run', id: r.id })} reason />
                </li>
              ))}
              {missed.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`rs-item ${inboxSel?.kind === 'schedule' && inboxSel.id === s.id ? 'on' : ''}`} onClick={() => setInboxSel({ kind: 'schedule', id: s.id })}>
                    <b>{s.name}</b>
                    <small className="cw-rs awaiting_approval">{t('wf.in.missedN', { n: String(s.missed?.count ?? 0) })}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
      <main className="rs-main">
        {tab === 'defs' &&
          (editing ? (
            <Editor key={editing.id ?? 'new'} id={editing.id} initial={editing.draft} onDone={(saved) => (setEditing(undefined), saved && setDefId(saved.id))} />
          ) : def ? (
            <WorkflowHome
              def={def}
              onEdit={() => setEditing({ id: def.id, draft: draftOf(def) })}
              onDuplicate={() => setEditing({ draft: { ...draftOf(def), name: t('wf.copyOf', { name: def.name }) } })}
              onRun={openRun}
              onSchedule={(id) => openSchedule(id, def.id)}
              onDeleted={() => setDefId(undefined)}
            />
          ) : (
            <NewWorkflow onPick={(draft) => setEditing({ draft })} />
          ))}
        {tab === 'runs' && (run ? <RunView run={run} onOpenWorkflow={(id) => (setDefId(id), setEditing(undefined), setTab('defs'))} onDeleted={() => setRunId(undefined)} /> : <p className="muted">{t('wf.noRuns')}</p>)}
        {tab === 'schedules' &&
          (newSchedule ? (
            <ScheduleView key={`new-${newSchedule.workflowId ?? ''}`} workflowId={newSchedule.workflowId} onSaved={(id) => openSchedule(id)} onRun={openRun} onDeleted={() => setNewSchedule(undefined)} />
          ) : schedule ? (
            <ScheduleView key={schedule.id} schedule={schedule} onSaved={(id) => openSchedule(id)} onRun={openRun} onDeleted={() => setScheduleId(undefined)} />
          ) : (
            <p className="muted">{defs.length ? t('wf.noSchedules') : t('wf.sc.needWorkflow')}</p>
          ))}
        {tab === 'inbox' &&
          (inboxSel?.kind === 'run' && orch.get(inboxSel.id) ? (
            <RunView run={orch.get(inboxSel.id)!} onOpenWorkflow={(id) => (setDefId(id), setEditing(undefined), setTab('defs'))} onDeleted={() => setInboxSel(undefined)} />
          ) : inboxSel?.kind === 'schedule' && scheduler.get(inboxSel.id) ? (
            <ScheduleView key={inboxSel.id} schedule={scheduler.get(inboxSel.id)!} onSaved={() => undefined} onRun={openRun} onDeleted={() => setInboxSel(undefined)} />
          ) : (
            <p className="muted">{todo ? t('wf.in.pick') : t('wf.inboxEmpty')}</p>
          ))}
      </main>
    </div>
  );
}

function RunItem({ run, on, onClick, reason }: { run: WorkflowRun; on: boolean; onClick: () => void; reason?: boolean }) {
  const t = useT();
  const waiting = Object.values(run.nodes).find((n) => n.status === 'awaiting_approval');
  return (
    <button type="button" className={`rs-item ${on ? 'on' : ''}`} onClick={onClick}>
      <b>
        {run.seen === false && <span className="wf-dot" aria-hidden />}
        {run.definition.name}
      </b>
      <small>
        <span className={`cw-rs ${run.status === 'completed' ? 'done' : run.status}`}>{t(`wf.rs.${run.status}` as TKey)}</span>
        {reason && waiting ? ` · ${run.definition.nodes.find((x) => x.id === waiting.nodeId)?.title ?? ''}` : ''} · {when(run.createdAt)}
      </small>
    </button>
  );
}

// ── people, tools, crews ──────────────────────────────────
function useNames() {
  const st = useApp();
  const crews = useCrews();
  const tools = useTools();
  return useMemo(
    () => ({
      agent: (id: string) => st.characters.find((c) => c.id === id)?.name,
      crew: (id: string) => crews.get(id)?.name,
      tool: (id: string) => tools.registry.get(id)?.name,
    }),
    [st.characters, crews, tools],
  );
}

// ── the graph (read-only) ─────────────────────────────────
/** live: followed · dead: never will be · open: not known yet (as the orchestrator sees it) */
function edgeState(run: WorkflowRun, def: Pick<WorkflowDefinition, 'nodes'>, e: WorkflowEdge): 'live' | 'dead' | 'open' {
  const src = run.nodes[e.from];
  if (!src) return 'open';
  const onFail = def.nodes.find((n) => n.id === e.from)?.policy?.onFail;
  if (src.status === 'completed') return !e.when || src.value === e.when ? 'live' : 'dead';
  if (src.status === 'failed' && onFail === 'continue') return e.when ? 'dead' : 'live';
  if (src.status === 'skipped' || src.status === 'cancelled' || src.status === 'failed') return 'dead';
  return 'open';
}

function Graph({ def, run, selected, onSelect }: { def: Pick<WorkflowDefinition, 'nodes' | 'edges'>; run?: WorkflowRun; selected?: string; onSelect?: (id: string) => void }) {
  const t = useT();
  const names = useNames();
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<{ d: string; state: string; label?: string; x: number; y: number }[]>([]);
  // a wide graph shrinks to the space it has (down to 60%), then scrolls
  const [fit, setFit] = useState({ zoom: 1, height: 0, cut: 0 });
  const columns = useMemo(() => {
    const ids = new Set(def.nodes.map((n) => n.id));
    const edges = def.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    const order = workflowOrder(def.nodes, edges);
    const depth = new Map<string, number>();
    for (const id of order ?? def.nodes.map((n) => n.id)) depth.set(id, order ? Math.max(0, ...edges.filter((e) => e.to === id).map((e) => (depth.get(e.from) ?? 0) + 1)) : 0);
    const max = Math.max(0, ...depth.values());
    return Array.from({ length: max + 1 }, (_, i) => def.nodes.filter((n) => (depth.get(n.id) ?? 0) === i));
  }, [def.nodes, def.edges]);
  useLayoutEffect(() => {
    const measure = () => {
      const g = box.current;
      if (!g) return;
      // layout positions inside the graph (not affected by the zoom)
      const at = (el: HTMLElement) => {
        let x = 0;
        let y = 0;
        for (let n: HTMLElement | null = el; n && n !== g; n = n.offsetParent as HTMLElement | null) {
          x += n.offsetLeft;
          y += n.offsetTop;
        }
        return { x, y, w: el.offsetWidth, h: el.offsetHeight };
      };
      const out: typeof paths = [];
      for (const e of def.edges) {
        const fromEl = cards.current.get(e.from);
        const toEl = cards.current.get(e.to);
        if (!fromEl || !toEl) continue;
        const from = at(fromEl);
        const to = at(toEl);
        const x1 = from.x + from.w;
        const y1 = from.y + from.h / 2;
        const x2 = to.x;
        const y2 = to.y + to.h / 2;
        const mid = (x1 + x2) / 2;
        out.push({ d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`, state: run ? edgeState(run, def, e) : 'open', ...(e.when && { label: t(`wf.when.${e.when}` as TKey) }), x: mid, y: (y1 + y2) / 2 });
      }
      setPaths(out);
      const room = frame.current?.clientWidth ?? g.scrollWidth;
      const zoom = Math.min(1, Math.max(0.6, room / Math.max(1, g.scrollWidth)));
      // a transform keeps the layout size: the width it no longer takes is given back
      setFit({ zoom, height: g.offsetHeight * zoom, cut: g.scrollWidth * (1 - zoom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (frame.current) ro.observe(frame.current);
    return () => ro.disconnect();
  }, [def, run, columns, t]);
  if (!def.nodes.length) return <p className="muted small">{t('wf.ed.noNodes')}</p>;
  return (
    <div className="wf-graph-frame" ref={frame} style={{ height: fit.height || undefined }}>
    <div className="cw-graph wf-graph" ref={box} style={fit.zoom < 1 ? { transform: `scale(${fit.zoom})`, marginRight: -fit.cut } : undefined}>
      <svg className="cw-arrows" aria-hidden>
        <defs>
          <marker id="wf-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>
        {paths.map((p, i) => (
          <path key={i} d={p.d} className={`wf-edge ${p.state}`} markerEnd="url(#wf-head)" />
        ))}
        {paths
          .filter((p) => p.label)
          .map((p, i) => (
            <text key={`l${i}`} x={p.x} y={p.y - 6} className={`wf-edge-label ${p.state}`} textAnchor="middle">
              {p.label}
            </text>
          ))}
      </svg>
      {columns.map((col, i) => (
        <div className="cw-col" key={i}>
          {col.map((n) => {
            const nr = run?.nodes[n.id];
            const Icon = KIND_ICON[n.config.kind];
            return (
              <button
                key={n.id}
                type="button"
                ref={(el) => {
                  if (el) cards.current.set(n.id, el);
                  else cards.current.delete(n.id);
                }}
                className={`cw-card wf-card k-${n.config.kind} ${nr ? `wst-${nr.status}` : ''} ${selected === n.id ? 'on' : ''}`}
                onClick={() => onSelect?.(n.id)}
              >
                <span className="cw-card-top">
                  <span className="wf-kind">
                    <Icon size={13} /> {t(`wf.kind.${n.config.kind}` as TKey)}
                  </span>
                  {nr ? <span className={`wf-st wst-${nr.status}`}>{t(`wf.ns.${nr.status}` as TKey)}</span> : <code>{n.id}</code>}
                </span>
                <b>{n.title || n.id}</b>
                <NodeSummary node={n} names={names} />
                {nr && nr.attempts > 1 && <small className="muted">{t('wf.node.attempts', { n: String(nr.attempts) })}</small>}
                {nr?.wakeAt && (nr.status === 'waiting' || nr.status === 'ready') && <small className="muted">{t('wf.node.wakeAt', { time: when(nr.wakeAt) })}</small>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
    </div>
  );
}

function NodeSummary({ node, names }: { node: WorkflowNode; names: ReturnType<typeof useNames> }) {
  const t = useT();
  const c = node.config;
  let body: ReactNode;
  switch (c.kind) {
    case 'agent':
      body = c.agentId ? (
        <>
          <Face agentId={c.agentId} /> {names.agent(c.agentId) ?? c.agentId}
        </>
      ) : (
        <em className="wf-warn">{t('wf.ed.pickAgent')}</em>
      );
      break;
    case 'tool':
      body = c.toolId ? <code>{names.tool(c.toolId) ?? c.toolId}</code> : <em className="wf-warn">{t('wf.ed.pickTool')}</em>;
      break;
    case 'crew':
      body = c.crewId ? names.crew(c.crewId) ?? c.crewId : <em className="wf-warn">{t('wf.ed.pickCrew')}</em>;
      break;
    case 'wait':
      body = c.mode === 'duration' ? t('wf.sum.waitFor', { n: String(c.minutes) }) : t('wf.sum.waitUntil', { time: Number.isFinite(Date.parse(c.at)) ? when(Date.parse(c.at)) : c.at });
      break;
    case 'approval':
      body = t('wf.sum.approval');
      break;
    case 'condition':
      body =
        c.test === 'agent' ? (
          <>
            <Face agentId={c.agentId} /> {c.question.slice(0, 50)}
          </>
        ) : (
          `${t(`wf.ed.test.${c.test}` as TKey)}${c.test !== 'notEmpty' ? ` "${(c.value ?? '').slice(0, 30)}"` : ''}`
        );
      break;
    case 'merge':
      body = t(`wf.ed.merge.${c.mode}` as TKey);
      break;
    case 'output':
      body = c.name;
      break;
    default:
      body = t('wf.sum.parallel');
  }
  return <span className="cw-card-who">{body}</span>;
}

// ── a new workflow ────────────────────────────────────────
function NewWorkflow({ onPick }: { onPick: (d: Draft) => void }) {
  const t = useT();
  const lang = useApp().settings.language;
  return (
    <div className="rs-new cw-editor">
      <h2>
        <Workflow size={18} /> {t('wf.new')}
      </h2>
      <p className="muted">{t('wf.intro')}</p>
      <ul className="wf-templates">
        {WORKFLOW_TEMPLATES.map((x) => (
          <li key={x.id}>
            <button type="button" className="wf-template" onClick={() => onPick(x.build(lang))}>
              <b>{t(`wf.tpl.${x.id}` as TKey)}</b>
              <small className="muted">{t(`wf.tpl.${x.id}.d` as TKey)}</small>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="wf-template" onClick={() => onPick({ name: '', inputs: [], nodes: [], edges: [], policies: {} })}>
            <b>{t('wf.blank')}</b>
            <small className="muted">{t('wf.blank.d')}</small>
          </button>
        </li>
      </ul>
    </div>
  );
}

// ── a workflow ────────────────────────────────────────────
function WorkflowHome({ def, onEdit, onDuplicate, onRun, onSchedule, onDeleted }: { def: WorkflowDefinition; onEdit: () => void; onDuplicate: () => void; onRun: (id: string) => void; onSchedule: (scheduleId?: string) => void; onDeleted: () => void }) {
  const t = useT();
  const workflows = useWorkflows();
  const orch = useOrchestrator();
  const scheduler = useScheduler();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<string>();
  const errText = useErr();
  useEffect(() => (setInputs({}), setError(''), setConfirm(false), setSelected(undefined)), [def.id]);
  const runs = orch.list(def.id);
  const schedules = scheduler.all().filter((s) => s.workflowId === def.id);
  const node = def.nodes.find((n) => n.id === selected);
  const start = () => {
    setError('');
    try {
      onRun(orch.create(def, inputs).id);
    } catch (e) {
      setError(errText(e));
    }
  };
  return (
    <div className="rs-run cw-run">
      <header className="cw-head">
        <div>
          <small className="muted">{t('wf.definition', { v: String(def.version) })}</small>
          <h2>{def.name}</h2>
          {def.description && <p className="muted small">{def.description}</p>}
        </div>
        <div className="row">
          <Button size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
            {t('wf.edit')}
          </Button>
          <Button size="sm" tone="ghost" icon={<Copy size={14} />} onClick={onDuplicate}>
            {t('wf.duplicate')}
          </Button>
          <Button size="sm" tone="ghost" icon={<CalendarClock size={14} />} onClick={() => onSchedule()}>
            {t('wf.schedule')}
          </Button>
          {!confirm ? (
            <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
              {t('wf.delete')}
            </Button>
          ) : (
            <Button
              size="sm"
              tone="danger"
              icon={<Trash2 size={14} />}
              onClick={() => {
                try {
                  for (const s of schedules) scheduler.remove(s.id);
                  workflows.remove(def.id);
                  onDeleted();
                } catch (e) {
                  setError(errText(e));
                }
              }}
            >
              {t('wf.deleteConfirm')}
            </Button>
          )}
        </div>
      </header>
      {confirm && <p className="cw-banner">{t('wf.deleteNote', { n: String(schedules.length) })}</p>}
      <Graph def={def} selected={selected} onSelect={(id) => setSelected(id === selected ? undefined : id)} />
      {node && <NodeInfo node={node} onClose={() => setSelected(undefined)} />}
      <section className="wf-start">
        <h3>{t('wf.run')}</h3>
        {def.inputs.map((i) => (
          <label key={i.name} className="field-stack">
            <span>
              {i.label || i.name}
              {i.required && ' *'}
            </span>
            <input value={inputs[i.name] ?? ''} placeholder={i.default ?? ''} onChange={(e) => setInputs({ ...inputs, [i.name]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && start()} />
          </label>
        ))}
        <div className="row">
          <Button tone="primary" icon={<Play size={15} />} onClick={start}>
            {t('wf.runNow')}
          </Button>
        </div>
        {error && <p className="chat-error">{error}</p>}
      </section>
      {schedules.length > 0 && (
        <section>
          <h3>{t('wf.tab.schedules')}</h3>
          <ul className="cw-run-list">
            {schedules.map((s) => (
              <li key={s.id}>
                <button type="button" className="link-btn" onClick={() => onSchedule(s.id)}>
                  {s.name}
                </button>
                <small className="muted">{s.enabled ? <TriggerText trigger={s.trigger} /> : t('wf.sc.off')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3>{t('wf.recentRuns')}</h3>
        {!runs.length && <p className="muted small">{t('wf.noRuns')}</p>}
        <ul className="cw-run-list">
          {runs.slice(0, 10).map((r) => (
            <li key={r.id}>
              <button type="button" className="link-btn" onClick={() => onRun(r.id)}>
                {when(r.createdAt)}
              </button>
              <small className={`cw-rs ${r.status}`}>{t(`wf.rs.${r.status}` as TKey)}</small>
              <small className="muted">
                v{r.definition.version} · <TriggerLabel run={r} />
              </small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** a node of the definition, read-only */
function NodeInfo({ node, onClose }: { node: WorkflowNode; onClose: () => void }) {
  const t = useT();
  const c = node.config;
  const text = c.kind === 'agent' ? c.prompt : c.kind === 'approval' ? c.prompt : c.kind === 'crew' ? c.goal : c.kind === 'output' ? c.content : c.kind === 'condition' ? (c.test === 'agent' ? `${c.question}\n\n${c.source}` : c.source) : c.kind === 'tool' ? Object.entries(c.input).map(([k, v]) => `${k}: ${v}`).join('\n') : '';
  return (
    <section className="cw-drawer">
      <header>
        <code>{node.id}</code>
        <b>{node.title}</b>
        <span className="cw-st">{t(`wf.kind.${c.kind}` as TKey)}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('wf.close')}>
          <X size={15} />
        </button>
      </header>
      {text && <pre className="wf-pre">{text}</pre>}
      <PolicyText policy={node.policy} />
    </section>
  );
}

function PolicyText({ policy }: { policy?: NodePolicy }) {
  const t = useT();
  if (!policy || (!policy.retries && !policy.timeoutMinutes && !policy.onFail)) return null;
  const parts = [policy.retries ? t('wf.pol.retries', { n: String(policy.retries), m: String(policy.backoffMinutes ?? 1) }) : '', policy.timeoutMinutes ? t('wf.pol.timeout', { n: String(policy.timeoutMinutes) }) : '', policy.onFail && policy.onFail !== 'fail' ? t(`wf.ed.onFail.${policy.onFail}` as TKey) : ''].filter(Boolean);
  return <p className="muted small">{parts.join(' · ')}</p>;
}

// ── the editor: tabs of forms over a read-only graph ──────
type EdTab = 'general' | 'nodes' | 'links' | 'rules';

const NEW_CONFIG: Record<NodeKind, NodeConfig> = {
  agent: { kind: 'agent', agentId: '', prompt: '' },
  tool: { kind: 'tool', toolId: '', input: {} },
  crew: { kind: 'crew', crewId: '', goal: '' },
  wait: { kind: 'wait', mode: 'duration', minutes: 10 },
  approval: { kind: 'approval', prompt: '' },
  condition: { kind: 'condition', test: 'contains', source: '', value: '' },
  parallel: { kind: 'parallel' },
  merge: { kind: 'merge', mode: 'all' },
  output: { kind: 'output', name: 'Result {{date}}.md', content: '' },
};

function Editor({ id, initial, onDone }: { id?: string; initial: Draft; onDone: (saved?: WorkflowDefinition) => void }) {
  const t = useT();
  const workflows = useWorkflows();
  const [d, setD] = useState<Draft>(initial);
  const [tab, setTab] = useState<EdTab>(initial.nodes.length ? 'nodes' : 'general');
  const [selected, setSelected] = useState<string | undefined>(initial.nodes.find((n) => n.config.kind === 'agent' && !n.config.agentId)?.id ?? initial.nodes[0]?.id);
  const [newKind, setNewKind] = useState<NodeKind>('agent');
  const [error, setError] = useState('');
  const errText = useErr();
  const problem = useMemo(() => {
    try {
      checkDefinition(d);
      return '';
    } catch (e) {
      return errText(e);
    }
  }, [d]);
  const node = d.nodes.find((n) => n.id === selected);
  const setNode = (nid: string, next: WorkflowNode) => {
    setD((x) => ({
      ...x,
      nodes: x.nodes.map((n) => (n.id === nid ? next : n)),
      // a renamed node keeps its links
      edges: next.id !== nid ? x.edges.map((e) => ({ ...e, from: e.from === nid ? next.id : e.from, to: e.to === nid ? next.id : e.to })) : x.edges,
    }));
    if (next.id !== nid) setSelected(next.id);
  };
  const addNode = () => {
    let n = 1;
    while (d.nodes.some((x) => x.id === `${newKind}${n}`)) n++;
    const nid = `${newKind}${n}`;
    const after = node?.id;
    setD((x) => ({ ...x, nodes: [...x.nodes, { id: nid, title: t(`wf.kind.${newKind}` as TKey), config: structuredClone(NEW_CONFIG[newKind]) }], edges: after ? [...x.edges, { from: after, to: nid }] : x.edges }));
    setSelected(nid);
    setTab('nodes');
  };
  const removeNode = (nid: string) => {
    setD((x) => ({ ...x, nodes: x.nodes.filter((n) => n.id !== nid), edges: x.edges.filter((e) => e.from !== nid && e.to !== nid) }));
    setSelected(undefined);
  };
  const save = () => {
    setError('');
    try {
      onDone(id ? workflows.update(id, d) : workflows.create(d));
    } catch (e) {
      setError(errText(e));
    }
  };
  const tabs: { id: EdTab; key: TKey; n?: number }[] = [
    { id: 'general', key: 'wf.ed.general' },
    { id: 'nodes', key: 'wf.ed.nodes', n: d.nodes.length },
    { id: 'links', key: 'wf.ed.links', n: d.edges.length },
    { id: 'rules', key: 'wf.ed.rules' },
  ];
  return (
    <div className="rs-new cw-editor wf-editor">
      <header className="cw-head">
        <h2>
          <Workflow size={18} /> {d.name || t('wf.new')}
        </h2>
        <div className="row">
          <Button tone="ghost" onClick={() => onDone()}>
            {t('wf.ed.cancel')}
          </Button>
          <Button tone="primary" icon={<Check size={15} />} onClick={save}>
            {t('wf.ed.save')}
          </Button>
        </div>
      </header>
      {error && <p className="chat-error">{error}</p>}
      <div className="wf-preview">
        <small className="muted">{t('wf.ed.preview')}</small>
        <Graph def={d} selected={selected} onSelect={(nid) => (setSelected(nid), setTab('nodes'))} />
        {problem && <p className="wf-problem">{t('wf.ed.problem', { msg: problem })}</p>}
      </div>
      <div className="wf-subtabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            {t(x.key)}
            {x.n !== undefined && <small>{x.n}</small>}
          </button>
        ))}
      </div>
      {tab === 'general' && <GeneralForm d={d} setD={setD} />}
      {tab === 'nodes' && (
        <div className="wf-nodes">
          <div className="wf-node-bar">
            <div className="wf-node-chips">
              {d.nodes.map((n) => {
                const Icon = KIND_ICON[n.config.kind];
                return (
                  <button key={n.id} type="button" className={`wf-chip ${selected === n.id ? 'on' : ''}`} onClick={() => setSelected(n.id)}>
                    <Icon size={13} /> {n.title || n.id}
                  </button>
                );
              })}
            </div>
            <div className="wf-add">
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as NodeKind)} aria-label={t('wf.ed.kind')}>
                {NODE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`wf.kind.${k}` as TKey)}
                  </option>
                ))}
              </select>
              <Button size="sm" icon={<Plus size={14} />} onClick={addNode} title={node ? t('wf.ed.addAfter', { node: node.title }) : undefined}>
                {t('wf.ed.addNode')}
              </Button>
            </div>
          </div>
          {node ? <NodeForm key={node.id} node={node} d={d} onChange={(next) => setNode(node.id, next)} onRemove={() => removeNode(node.id)} /> : <p className="muted small">{t('wf.ed.pickNode')}</p>}
        </div>
      )}
      {tab === 'links' && <LinksForm d={d} setD={setD} />}
      {tab === 'rules' && <RulesForm d={d} setD={setD} />}
    </div>
  );
}

function GeneralForm({ d, setD }: { d: Draft; setD: (f: (x: Draft) => Draft) => void }) {
  const t = useT();
  const setInput = (i: number, patch: Partial<Draft['inputs'][number]>) => setD((x) => ({ ...x, inputs: x.inputs.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
  return (
    <div className="wf-form">
      <label className="field-stack">
        <span>{t('wf.ed.name')}</span>
        <input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} />
      </label>
      <label className="field-stack">
        <span>{t('wf.ed.description')}</span>
        <textarea rows={2} value={d.description ?? ''} onChange={(e) => setD((x) => ({ ...x, description: e.target.value }))} />
      </label>
      <div className="field-stack">
        <span>{t('wf.ed.inputs')}</span>
        <p className="muted small">{t('wf.ed.inputsHint')}</p>
        {d.inputs.map((i, j) => (
          <div key={j} className="wf-input-row">
            <input value={i.name} placeholder={t('wf.ed.inputName')} onChange={(e) => setInput(j, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} />
            <input value={i.label ?? ''} placeholder={t('wf.ed.inputLabel')} onChange={(e) => setInput(j, { label: e.target.value })} />
            <input value={i.default ?? ''} placeholder={t('wf.ed.inputDefault')} onChange={(e) => setInput(j, { default: e.target.value })} />
            <label className="cw-chip">
              <input type="checkbox" checked={!!i.required} onChange={(e) => setInput(j, { required: e.target.checked })} />
              {t('wf.ed.required')}
            </label>
            <button type="button" className="icon-btn" aria-label={t('wf.ed.remove')} onClick={() => setD((x) => ({ ...x, inputs: x.inputs.filter((_, k) => k !== j) }))}>
              <X size={14} />
            </button>
          </div>
        ))}
        <div>
          <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setD((x) => ({ ...x, inputs: [...x.inputs, { name: `input${x.inputs.length + 1}` }] }))}>
            {t('wf.ed.addInput')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** the agents, grouped by world */
function AgentSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  const td = useTD();
  const st = useApp();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('wf.ed.pickAgent')}</option>
      {WORLDS.map((w) => {
        const list = st.characters.filter((c) => c.worldId === w.id);
        return list.length ? (
          <optgroup key={w.id} label={td(w.name)}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.role ? ` · ${c.role}` : ''}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

function NodeForm({ node, d, onChange, onRemove }: { node: WorkflowNode; d: Draft; onChange: (n: WorkflowNode) => void; onRemove: () => void }) {
  const t = useT();
  const crews = useCrews();
  const tools = useTools();
  const [idText, setIdText] = useState(node.id);
  const c = node.config;
  const set = (patch: Partial<NodeConfig>) => onChange({ ...node, config: { ...c, ...patch } as NodeConfig });
  // what a text field can use: the inputs and the nodes that come before this one
  const before = useMemo(() => {
    const seen = new Set<string>();
    const walk = (id: string) => {
      for (const e of d.edges.filter((x) => x.to === id))
        if (!seen.has(e.from)) {
          seen.add(e.from);
          walk(e.from);
        }
    };
    walk(node.id);
    return d.nodes.filter((n) => seen.has(n.id));
  }, [d, node.id]);
  const chips = [...d.inputs.filter((i) => i.name).map((i) => `{{input.${i.name}}}`), ...before.filter((n) => n.config.kind !== 'parallel').map((n) => `{{node.${n.id}.${n.config.kind === 'condition' || n.config.kind === 'approval' ? 'value' : 'output'}}}`), '{{date}}', '{{time}}'];
  const text = (key: 'prompt' | 'goal' | 'content' | 'source' | 'question', rows = 4, label: TKey = 'wf.ed.prompt') => (
    <label className="field-stack">
      <span>{t(label)}</span>
      <textarea rows={rows} value={(c as Record<string, string>)[key] ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<NodeConfig>)} />
      <span className="wf-insert">
        <small className="muted">{t('wf.ed.insert')}</small>
        {chips.map((x) => (
          <button key={x} type="button" className="wf-token" onClick={() => set({ [key]: `${(c as Record<string, string>)[key] ?? ''}${x}` } as Partial<NodeConfig>)}>
            {x}
          </button>
        ))}
      </span>
    </label>
  );
  const tool = c.kind === 'tool' && c.toolId ? tools.registry.get(c.toolId) : undefined;
  const props = (tool?.inputSchema.properties ?? {}) as Record<string, JsonSchema>;
  const hasPolicy = c.kind === 'agent' || c.kind === 'tool' || c.kind === 'crew' || (c.kind === 'condition' && c.test === 'agent');
  const pol = node.policy ?? {};
  const setPol = (patch: Partial<NodePolicy>) => onChange({ ...node, policy: { ...pol, ...patch } });
  const num = (s: string) => (s.trim() === '' ? undefined : Math.max(0, Number(s)));
  return (
    <section className="cw-drawer wf-node-form">
      <header>
        {(() => {
          const Icon = KIND_ICON[c.kind];
          return <Icon size={16} />;
        })()}
        <span className="cw-st">{t(`wf.kind.${c.kind}` as TKey)}</span>
        <input value={node.title} onChange={(e) => onChange({ ...node, title: e.target.value })} aria-label={t('wf.ed.nodeTitle')} />
        <label className="wf-id">
          <small className="muted">id</small>
          <input
            value={idText}
            onChange={(e) => setIdText(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24))}
            onBlur={() => (idText && idText !== node.id && !d.nodes.some((n) => n.id === idText) ? onChange({ ...node, id: idText }) : setIdText(node.id))}
          />
        </label>
        <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} onClick={onRemove}>
          {t('wf.ed.removeNode')}
        </Button>
      </header>
      {c.kind === 'agent' && (
        <>
          <label className="field-stack">
            <span>{t('wf.ed.agent')}</span>
            <AgentSelect value={c.agentId} onChange={(agentId) => set({ agentId })} />
          </label>
          {text('prompt', 5)}
        </>
      )}
      {c.kind === 'tool' && (
        <>
          <label className="field-stack">
            <span>{t('wf.ed.tool')}</span>
            <select value={c.toolId} onChange={(e) => set({ toolId: e.target.value, input: {} })}>
              <option value="">{t('wf.ed.pickTool')}</option>
              {tools.registry
                .list()
                .filter((x) => tools.registry.available(x.id))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          {tool && <p className="muted small">{tool.description}</p>}
          {Object.entries(props).map(([k, p]) => (
            <label key={k} className="field-stack">
              <span>
                {k}
                {tool?.inputSchema.required?.includes(k) && ' *'}
                {p.type && p.type !== 'string' && <small className="muted"> ({String(p.type)})</small>}
              </span>
              <input value={c.input[k] ?? ''} placeholder={p.description?.slice(0, 120) ?? ''} onChange={(e) => set({ input: { ...c.input, [k]: e.target.value } })} />
            </label>
          ))}
          {tool && <p className="muted small">{t('wf.ed.toolNote')}</p>}
        </>
      )}
      {c.kind === 'crew' && (
        <>
          <label className="field-stack">
            <span>{t('wf.ed.crew')}</span>
            <select value={c.crewId} onChange={(e) => set({ crewId: e.target.value })}>
              <option value="">{t('wf.ed.pickCrew')}</option>
              {crews.list().map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {text('goal', 3, 'wf.ed.goal')}
          <label className="cw-chip">
            <input type="checkbox" checked={c.autoApprovePlan !== false} onChange={(e) => set({ autoApprovePlan: e.target.checked })} />
            {t('wf.ed.autoPlan')}
          </label>
          <label className="cw-chip">
            <input type="checkbox" checked={!!c.autoApproveFinal} onChange={(e) => set({ autoApproveFinal: e.target.checked })} />
            {t('wf.ed.autoFinal')}
          </label>
        </>
      )}
      {c.kind === 'wait' && (
        <div className="cw-row2">
          <label className="field-stack">
            <span>{t('wf.ed.waitMode')}</span>
            <select value={c.mode} onChange={(e) => onChange({ ...node, config: e.target.value === 'duration' ? { kind: 'wait', mode: 'duration', minutes: 10 } : { kind: 'wait', mode: 'until', at: '' } })}>
              <option value="duration">{t('wf.ed.waitDuration')}</option>
              <option value="until">{t('wf.ed.waitUntil')}</option>
            </select>
          </label>
          {c.mode === 'duration' ? (
            <label className="field-stack">
              <span>{t('wf.ed.minutes')}</span>
              <input type="number" min={1} value={c.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} />
            </label>
          ) : (
            <label className="field-stack">
              <span>{t('wf.ed.at')}</span>
              <input type="datetime-local" value={c.at} onChange={(e) => set({ at: e.target.value })} />
            </label>
          )}
        </div>
      )}
      {c.kind === 'approval' && (
        <>
          {text('prompt', 4, 'wf.ed.question')}
          <p className="muted small">{t('wf.ed.approvalHint')}</p>
        </>
      )}
      {c.kind === 'condition' && (
        <>
          <label className="field-stack">
            <span>{t('wf.ed.test')}</span>
            <select
              value={c.test}
              onChange={(e) => {
                const test = e.target.value as 'contains' | 'equals' | 'notEmpty' | 'agent';
                onChange({ ...node, config: test === 'agent' ? { kind: 'condition', test, source: c.source, agentId: '', question: '' } : { kind: 'condition', test, source: c.source, value: c.test !== 'agent' ? c.value ?? '' : '' } });
              }}
            >
              {(['contains', 'equals', 'notEmpty', 'agent'] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`wf.ed.test.${x}` as TKey)}
                </option>
              ))}
            </select>
          </label>
          {c.test === 'agent' && (
            <>
              <label className="field-stack">
                <span>{t('wf.ed.judge')}</span>
                <AgentSelect value={c.agentId} onChange={(agentId) => set({ agentId })} />
              </label>
              {text('question', 2, 'wf.ed.question')}
            </>
          )}
          {text('source', 2, 'wf.ed.source')}
          {(c.test === 'contains' || c.test === 'equals') && (
            <label className="field-stack">
              <span>{t('wf.ed.value')}</span>
              <input value={c.value ?? ''} onChange={(e) => set({ value: e.target.value })} />
            </label>
          )}
          <p className="muted small">{t('wf.ed.conditionHint')}</p>
        </>
      )}
      {c.kind === 'parallel' && <p className="muted small">{t('wf.ed.parallelHint')}</p>}
      {c.kind === 'merge' && (
        <label className="field-stack">
          <span>{t('wf.ed.mergeMode')}</span>
          <select value={c.mode} onChange={(e) => set({ mode: e.target.value as 'all' | 'any' })}>
            <option value="all">{t('wf.ed.merge.all')}</option>
            <option value="any">{t('wf.ed.merge.any')}</option>
          </select>
        </label>
      )}
      {c.kind === 'output' && (
        <>
          <label className="field-stack">
            <span>{t('wf.ed.outName')}</span>
            <input value={c.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          {text('content', 4, 'wf.ed.outContent')}
        </>
      )}
      {hasPolicy && (
        <fieldset className="wf-policy">
          <legend>{t('wf.ed.policy')}</legend>
          <label className="field-stack">
            <span>{t('wf.ed.retries')}</span>
            <input type="number" min={0} max={3} value={pol.retries ?? ''} placeholder="0" onChange={(e) => setPol({ retries: num(e.target.value) })} />
          </label>
          <label className="field-stack">
            <span>{t('wf.ed.backoff')}</span>
            <input type="number" min={0} value={pol.backoffMinutes ?? ''} placeholder="1" onChange={(e) => setPol({ backoffMinutes: num(e.target.value) })} />
          </label>
          <label className="field-stack">
            <span>{t('wf.ed.timeout')}</span>
            <input type="number" min={0} value={pol.timeoutMinutes ?? ''} placeholder="—" onChange={(e) => setPol({ timeoutMinutes: num(e.target.value) })} />
          </label>
          <label className="field-stack">
            <span>{t('wf.ed.onFail')}</span>
            <select value={pol.onFail ?? 'fail'} onChange={(e) => setPol({ onFail: e.target.value as NodePolicy['onFail'] })}>
              {(['fail', 'continue', 'skip'] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`wf.ed.onFail.${x}` as TKey)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}
    </section>
  );
}

function LinksForm({ d, setD }: { d: Draft; setD: (f: (x: Draft) => Draft) => void }) {
  const t = useT();
  const kindOf = (id: string) => d.nodes.find((n) => n.id === id)?.config.kind;
  const branches = (from: string): EdgeWhen[] => (kindOf(from) === 'condition' ? ['true', 'false'] : kindOf(from) === 'approval' ? ['approved', 'rejected'] : []);
  const setEdge = (i: number, e: WorkflowEdge) => setD((x) => ({ ...x, edges: x.edges.map((y, j) => (j === i ? e : y)) }));
  const label = (id: string) => `${d.nodes.find((n) => n.id === id)?.title ?? id} (${id})`;
  return (
    <div className="wf-form">
      <p className="muted small">{t('wf.ed.linksHint')}</p>
      {!d.edges.length && <p className="muted small">{t('wf.ed.noLinks')}</p>}
      {d.edges.map((e, i) => (
        <div key={i} className="wf-link-row">
          <select value={e.from} onChange={(ev) => setEdge(i, { from: ev.target.value, to: e.to })} aria-label={t('wf.ed.from')}>
            {d.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {label(n.id)}
              </option>
            ))}
          </select>
          <span className="muted">→</span>
          <select value={e.to} onChange={(ev) => setEdge(i, { ...e, to: ev.target.value })} aria-label={t('wf.ed.to')}>
            {d.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {label(n.id)}
              </option>
            ))}
          </select>
          {branches(e.from).length > 0 ? (
            <select value={e.when ?? ''} onChange={(ev) => setEdge(i, { from: e.from, to: e.to, ...(ev.target.value && { when: ev.target.value as EdgeWhen }) })} aria-label={t('wf.ed.when')}>
              <option value="">{t('wf.ed.always')}</option>
              {branches(e.from).map((b) => (
                <option key={b} value={b}>
                  {t(`wf.when.${b}` as TKey)}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}
          <button type="button" className="icon-btn" aria-label={t('wf.ed.remove')} onClick={() => setD((x) => ({ ...x, edges: x.edges.filter((_, j) => j !== i) }))}>
            <X size={14} />
          </button>
        </div>
      ))}
      {d.nodes.length > 1 && (
        <div>
          <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setD((x) => ({ ...x, edges: [...x.edges, { from: x.nodes[0].id, to: x.nodes[1].id }] }))}>
            {t('wf.ed.addLink')}
          </Button>
        </div>
      )}
    </div>
  );
}

function RulesForm({ d, setD }: { d: Draft; setD: (f: (x: Draft) => Draft) => void }) {
  const t = useT();
  const p = d.policies;
  const set = (k: keyof Draft['policies'], v: string) =>
    setD((x) => {
      const next = { ...x.policies };
      if (v.trim() === '' || !(Number(v) > 0)) delete next[k];
      else next[k] = Number(v);
      return { ...x, policies: next };
    });
  const field = (k: keyof Draft['policies'], key: TKey, step = 1) => (
    <label className="field-stack">
      <span>{t(key)}</span>
      <input type="number" min={0} step={step} value={p[k] ?? ''} placeholder={t('wf.ed.noLimit')} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  return (
    <div className="wf-form">
      <p className="muted small">{t('wf.ed.rulesHint')}</p>
      <div className="cw-row2">
        {field('budgetTokens', 'wf.ed.budgetTokens', 1000)}
        {field('budgetUsd', 'wf.ed.budgetUsd', 0.1)}
        {field('maxMinutes', 'wf.ed.maxMinutes')}
        {field('maxConcurrency', 'wf.ed.maxConcurrency')}
      </div>
    </div>
  );
}

// ── a run ─────────────────────────────────────────────────
function TriggerLabel({ run }: { run: WorkflowRun }) {
  const t = useT();
  const scheduler = useScheduler();
  const tr = run.trigger;
  if (tr.kind === 'manual') return <>{t('wf.trigger.manual')}</>;
  const name = (tr.scheduleId && scheduler.get(tr.scheduleId)?.name) || '';
  return <>{tr.kind === 'catchup' ? t('wf.trigger.catchup', { name, n: String(tr.missed ?? 1) }) : t('wf.trigger.schedule', { name })}</>;
}

function RunView({ run, onOpenWorkflow, onDeleted }: { run: WorkflowRun; onOpenWorkflow: (id: string) => void; onDeleted: () => void }) {
  const t = useT();
  const orch = useOrchestrator();
  const workflows = useWorkflows();
  const artifacts = useArtifacts();
  const { store } = useServices();
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const errText = useErr();
  useEffect(() => (setSelected(undefined), setError('')), [run.id]);
  // looking at a run that ended (or needed you) clears its notice
  useEffect(() => {
    if (run.seen === false && !isOpenRun(run.status)) orch.markSeen(run.id);
  }, [run.id, run.status, run.seen]);
  const act = (fn: () => unknown) => {
    setError('');
    try {
      fn();
    } catch (e) {
      setError(errText(e));
    }
  };
  const def = run.definition;
  const p = def.policies;
  const waiting = Object.values(run.nodes).filter((n) => n.status === 'awaiting_approval');
  const node = def.nodes.find((n) => n.id === selected);
  const open = isOpenRun(run.status);
  // working time: waiting for you and being suspended do not count (as for the time limit)
  const minutes = Math.round(orch.activeMs(run) / 60_000);
  return (
    <div className="rs-run cw-run">
      <header className="cw-head">
        <div>
          <small className={`cw-rs ${run.status === 'completed' ? 'done' : run.status}`}>{t(`wf.rs.${run.status}` as TKey)}</small>
          <h2>{def.name}</h2>
          <small className="muted">
            {when(run.createdAt)} · <TriggerLabel run={run} /> · {t('wf.definition', { v: String(def.version) })}
            {workflows.get(run.workflowId) && (
              <>
                {' · '}
                <button type="button" className="link-btn" onClick={() => onOpenWorkflow(run.workflowId)}>
                  {t('wf.openWorkflow')}
                </button>
              </>
            )}
          </small>
        </div>
        <div className="row">
          {run.status === 'suspended' && (
            <Button size="sm" tone="primary" icon={<RotateCcw size={14} />} onClick={() => act(() => orch.resume(run.id))}>
              {t('wf.resume')}
            </Button>
          )}
          {open && (
            <Button size="sm" tone="danger" icon={<Square size={14} />} onClick={() => act(() => orch.cancel(run.id))}>
              {t('wf.stop')}
            </Button>
          )}
          {!open && (
            <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => act(() => (orch.remove(run.id), onDeleted()))}>
              {t('wf.remove')}
            </Button>
          )}
        </div>
      </header>
      {run.status === 'suspended' && <p className="cw-banner">{t('wf.suspendedBanner')}</p>}
      {run.error && <p className="chat-error">{run.errorKey ? t(`wf.err.run.${run.errorKey}` as TKey, run.errorVars ?? {}) : run.error}</p>}
      {error && <p className="chat-error">{error}</p>}
      <div className="wf-meta">
        <span>
          {t('wf.used')}: <b>{run.budget.tokens.toLocaleString()}</b> {t('wf.tokens')}
          {p.budgetTokens ? ` / ${p.budgetTokens.toLocaleString()}` : ''}
        </span>
        {(run.budget.usd > 0 || p.budgetUsd) && (
          <span>
            <b>${run.budget.usd.toFixed(2)}</b>
            {p.budgetUsd ? ` / $${p.budgetUsd}` : ''}
          </span>
        )}
        <span>
          {t('wf.duration', { n: String(minutes) })}
          {p.maxMinutes ? ` / ${p.maxMinutes}` : ''}
        </span>
        {Object.entries(run.inputs)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <span key={k} className="wf-input-chip">
              {def.inputs.find((i) => i.name === k)?.label ?? k}: <b>{v.slice(0, 60)}</b>
            </span>
          ))}
      </div>
      {waiting.map((n) => (
        <NeedsYou key={n.nodeId} run={run} n={n} act={act} />
      ))}
      <Graph def={def} run={run} selected={selected} onSelect={(id) => setSelected(id === selected ? undefined : id)} />
      {node && <NodeRunDetails run={run} node={node} onClose={() => setSelected(undefined)} act={act} />}
      {run.artifacts.length > 0 && (
        <section>
          <h3>{t('wf.artifacts')}</h3>
          <ul className="cw-outputs">
            {run.artifacts.map((id) => (
              <li key={id}>
                <button type="button" className="link-btn" onClick={() => void artifacts.open(id).catch(() => store.toast(t('wf.artifactGone')))}>
                  {artifacts.get(id)?.name ?? id}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <History run={run} />
    </div>
  );
}

/** what waits for the user: an approval node (decide here), a crew's final result, a tool's approval */
function NeedsYou({ run, n, act }: { run: WorkflowRun; n: NodeRun; act: (fn: () => unknown) => void }) {
  const t = useT();
  const orch = useOrchestrator();
  const { store } = useServices();
  const node = run.definition.nodes.find((x) => x.id === n.nodeId);
  if (!node) return null;
  return (
    <section className="cw-final wf-needs">
      <header>
        <Hand size={16} />
        <h3>{t('wf.needsYou', { node: node.title })}</h3>
      </header>
      {node.config.kind === 'approval' && (
        <>
          <Doc text={n.prompt ?? ''} />
          <div className="cw-approve">
            <Button tone="primary" icon={<Check size={15} />} onClick={() => act(() => orch.decide(run.id, n.nodeId, 'approved'))}>
              {t('wf.approve')}
            </Button>
            <Button tone="ghost" icon={<X size={15} />} onClick={() => act(() => orch.decide(run.id, n.nodeId, 'rejected'))}>
              {t('wf.reject')}
            </Button>
          </div>
        </>
      )}
      {node.config.kind === 'crew' && n.crewRunId && (
        <p className="small">
          {t('wf.crewWaits')}{' '}
          <button type="button" className="link-btn" onClick={() => store.openCrew({ runId: n.crewRunId })}>
            {t('wf.openCrew')}
          </button>
        </p>
      )}
      {node.config.kind === 'tool' && <p className="small">{t('wf.toolWaits')}</p>}
    </section>
  );
}

function NodeRunDetails({ run, node, onClose, act }: { run: WorkflowRun; node: WorkflowNode; onClose: () => void; act: (fn: () => unknown) => void }) {
  const t = useT();
  const orch = useOrchestrator();
  const artifacts = useArtifacts();
  const { store } = useServices();
  const n = run.nodes[node.id];
  if (!n) return null;
  const canRetry = (n.status === 'failed' || n.status === 'cancelled') && run.status !== 'suspended';
  return (
    <section className="cw-drawer">
      <header>
        <code>{node.id}</code>
        <b>{node.title}</b>
        <span className={`wf-st wst-${n.status}`}>{t(`wf.ns.${n.status}` as TKey)}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('wf.close')}>
          <X size={15} />
        </button>
      </header>
      <p className="muted small">
        {t(`wf.kind.${node.config.kind}` as TKey)}
        {n.attempts > 0 && ` · ${t('wf.node.attempts', { n: String(n.attempts) })}`}
        {n.startedAt && ` · ${t('wf.node.started', { time: when(n.startedAt) })}`}
        {n.finishedAt && ` · ${t('wf.node.finished', { time: when(n.finishedAt) })}`}
        {n.wakeAt && (n.status === 'waiting' || n.status === 'ready') && ` · ${t('wf.node.wakeAt', { time: when(n.wakeAt) })}`}
        {n.value && ` · ${t(`wf.when.${n.value}` as TKey)}`}
      </p>
      <PolicyText policy={node.policy} />
      {n.error && <p className="chat-error">{n.error}</p>}
      <div className="row">
        {canRetry && (
          <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => act(() => orch.retryNode(run.id, node.id))}>
            {t('wf.retry')}
          </Button>
        )}
        {(n.status === 'failed' || n.status === 'cancelled' || n.status === 'interrupted') && (
          <Button size="sm" tone="ghost" icon={<SkipForward size={14} />} onClick={() => act(() => orch.skipNode(run.id, node.id))}>
            {t('wf.skip')}
          </Button>
        )}
        {n.crewRunId && (
          <Button size="sm" tone="ghost" icon={<Network size={14} />} onClick={() => store.openCrew({ runId: n.crewRunId })}>
            {t('wf.openCrew')}
          </Button>
        )}
        {n.artifactId && (
          <Button size="sm" tone="ghost" icon={<FileOutput size={14} />} onClick={() => void artifacts.open(n.artifactId!).catch(() => store.toast(t('wf.artifactGone')))}>
            {t('wf.openArtifact')}
          </Button>
        )}
      </div>
      {n.prompt && n.status !== 'awaiting_approval' && <Doc text={n.prompt} />}
      {n.output && (
        <>
          <h4>{t('wf.node.output')}</h4>
          <Doc text={n.output} />
        </>
      )}
    </section>
  );
}

function History({ run }: { run: WorkflowRun }) {
  const t = useT();
  if (!run.history.length) return null;
  const say = (vars: Record<string, string> = {}) => {
    const v = { ...vars };
    if (v.until && Number.isFinite(Date.parse(v.until))) v.until = when(Date.parse(v.until));
    if (v.errorKey) v.error = t(`wf.err.run.${v.errorKey}` as TKey, v);
    if (v.value && ['true', 'false', 'approved', 'rejected'].includes(v.value)) v.value = t(`wf.when.${v.value}` as TKey);
    return v;
  };
  return (
    <section>
      <h3>{t('wf.history')}</h3>
      <ol className="cw-history">
        {[...run.history].reverse().map((h, i) => (
          <li key={i} className={`k-${h.kind}`}>
            <small className="muted">{new Date(h.at).toLocaleTimeString()}</small>
            {h.agentId ? <Face agentId={h.agentId} /> : <span className="cw-face empty" />}
            <span>{h.key ? t(`wf.ev.${h.key}` as TKey, say(h.vars)) : h.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── schedules ─────────────────────────────────────────────
function TriggerText({ trigger }: { trigger: ScheduleTrigger }) {
  const t = useT();
  switch (trigger.kind) {
    case 'once':
      return <>{t('wf.sc.sum.once', { time: when(trigger.at) })}</>;
    case 'interval':
      return <>{t('wf.sc.sum.interval', { n: String(trigger.everyMinutes) })}</>;
    case 'daily':
      return <>{t('wf.sc.sum.daily', { time: trigger.time })}</>;
    case 'weekly':
      return <>{t('wf.sc.sum.weekly', { days: trigger.days.map(dayName).join(', '), time: trigger.time })}</>;
    default:
      return <>{t('wf.sc.sum.cron', { expr: trigger.expr })}</>;
  }
}

/** 0 = Sunday, in the user's language */
const dayName = (d: number) => new Date(2026, 0, 4 + d).toLocaleDateString(undefined, { weekday: 'short' });
const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (ms: number) => {
  const x = new Date(ms);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

function ScheduleView({ schedule, workflowId, onSaved, onRun, onDeleted }: { schedule?: Schedule; workflowId?: string; onSaved: (id: string) => void; onRun: (runId: string) => void; onDeleted: () => void }) {
  const t = useT();
  const workflows = useWorkflows();
  const scheduler = useScheduler();
  const defs = workflows.all();
  const tr = schedule?.trigger;
  const [name, setName] = useState(schedule?.name ?? '');
  const [wf, setWf] = useState(schedule?.workflowId ?? workflowId ?? defs[0]?.id ?? '');
  const [inputs, setInputs] = useState<Record<string, string>>(schedule?.inputs ?? {});
  const [kind, setKind] = useState<ScheduleTrigger['kind']>(tr?.kind ?? 'daily');
  const [at, setAt] = useState(tr?.kind === 'once' ? localInput(tr.at) : localInput(Date.now() + 3_600_000));
  const [every, setEvery] = useState(tr?.kind === 'interval' ? String(tr.everyMinutes) : '60');
  const [time, setTime] = useState(tr?.kind === 'daily' || tr?.kind === 'weekly' ? tr.time : '09:00');
  const [days, setDays] = useState<number[]>(tr?.kind === 'weekly' ? tr.days : [1]);
  const [expr, setExpr] = useState(tr?.kind === 'cron' ? tr.expr : '0 9 * * 1-5');
  const [catchUp, setCatchUp] = useState<Schedule['catchUp']>(schedule?.catchUp ?? 'once');
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const errText = useErr();
  const def = workflows.get(wf);
  const trigger: ScheduleTrigger = kind === 'once' ? { kind, at: Date.parse(at) } : kind === 'interval' ? { kind, everyMinutes: Number(every) } : kind === 'daily' ? { kind, time } : kind === 'weekly' ? { kind, days, time } : { kind, expr };
  const problem = checkTrigger(trigger);
  const upcoming = useMemo(() => {
    if (problem) return [];
    const out: number[] = [];
    let from = Date.now();
    const anchor = schedule?.lastFiredAt ?? Date.now();
    for (let i = 0; i < 3; i++) {
      const n = nextTime(trigger, from, anchor);
      if (n === undefined) break;
      out.push(n);
      from = n;
    }
    return out;
  }, [kind, at, every, time, days.join(','), expr, problem]);
  const save = () => {
    setError('');
    try {
      const input = { name: name.trim() || def?.name || t('wf.sc.new'), workflowId: wf, inputs, trigger, enabled, catchUp };
      const s = schedule ? scheduler.update(schedule.id, input) : scheduler.create(input);
      onSaved(s.id);
    } catch (e) {
      setError(errText(e));
    }
  };
  const lastError = schedule ? scheduler.errors.get(schedule.id) : undefined;
  return (
    <div className="rs-new cw-editor wf-schedule">
      <header className="cw-head">
        <h2>
          <CalendarClock size={18} /> {schedule ? schedule.name : t('wf.sc.new')}
        </h2>
        <div className="row">
          {schedule && (
            <Button size="sm" icon={<Play size={14} />} onClick={() => {
              setError('');
              try {
                const r = scheduler.runNow(schedule.id);
                if (r) onRun(r.id);
              } catch (e) {
                setError(errText(e));
              }
            }}>
              {t('wf.sc.runNow')}
            </Button>
          )}
          {schedule &&
            (!confirm ? (
              <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                {t('wf.delete')}
              </Button>
            ) : (
              <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => (scheduler.remove(schedule.id), onDeleted())}>
                {t('wf.deleteConfirm')}
              </Button>
            ))}
        </div>
      </header>
      {schedule?.missed && (
        <div className="cw-banner wf-missed">
          <span>{t(schedule.missed.created ? 'wf.sc.missed' : 'wf.sc.missedSkip', { n: String(schedule.missed.count), time: when(schedule.missed.at), created: String(schedule.missed.created) })}</span>
          <Button size="sm" tone="ghost" icon={<Check size={14} />} onClick={() => scheduler.seenMissed(schedule.id)}>
            {t('wf.sc.ok')}
          </Button>
        </div>
      )}
      {lastError && <p className="chat-error">{t('wf.sc.error', { msg: lastError })}</p>}
      {schedule && (
        <p className="muted small">
          {schedule.enabled && schedule.nextAt ? t('wf.sc.nextAt', { time: when(schedule.nextAt) }) : t('wf.sc.off')} · {t('wf.sc.last', { time: schedule.lastFiredAt ? when(schedule.lastFiredAt) : t('wf.sc.never') })}
        </p>
      )}
      <p className="muted small">{t('wf.sc.onlyCreates')}</p>
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('wf.sc.name')}</span>
          <input value={name} placeholder={def?.name ?? ''} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field-stack">
          <span>{t('wf.sc.workflow')}</span>
          <select value={wf} onChange={(e) => (setWf(e.target.value), setInputs({}))}>
            {!wf && <option value="">{t('wf.sc.pickWorkflow')}</option>}
            {defs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {def?.inputs.map((i) => (
        <label key={i.name} className="field-stack">
          <span>
            {i.label || i.name}
            {i.required && ' *'}
          </span>
          <input value={inputs[i.name] ?? ''} placeholder={i.default ?? ''} onChange={(e) => setInputs({ ...inputs, [i.name]: e.target.value })} />
        </label>
      ))}
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('wf.sc.when')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ScheduleTrigger['kind'])}>
            {(['once', 'interval', 'daily', 'weekly', 'cron'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`wf.sc.kind.${k}` as TKey)}
              </option>
            ))}
          </select>
        </label>
        {kind === 'once' && (
          <label className="field-stack">
            <span>{t('wf.sc.at')}</span>
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
        )}
        {kind === 'interval' && (
          <label className="field-stack">
            <span>{t('wf.sc.every')}</span>
            <input type="number" min={5} value={every} onChange={(e) => setEvery(e.target.value)} />
          </label>
        )}
        {(kind === 'daily' || kind === 'weekly') && (
          <label className="field-stack">
            <span>{t('wf.sc.time')}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
        {kind === 'cron' && (
          <label className="field-stack">
            <span>{t('wf.sc.cron')}</span>
            <input value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} />
          </label>
        )}
      </div>
      {kind === 'weekly' && (
        <div className="cw-deps">
          <span className="muted small">{t('wf.sc.days')}</span>
          {[1, 2, 3, 4, 5, 6, 0].map((x) => (
            <label key={x} className="cw-chip">
              <input type="checkbox" checked={days.includes(x)} onChange={(e) => setDays(e.target.checked ? [...days, x].sort() : days.filter((y) => y !== x))} />
              {dayName(x)}
            </label>
          ))}
        </div>
      )}
      {problem ? <p className="wf-problem">{t(`wf.err.trigger.${problem}` as TKey)}</p> : upcoming.length > 0 && <p className="muted small">{t('wf.sc.next', { list: upcoming.map(when).join(' · ') })}</p>}
      <div className="cw-row2">
        <label className="field-stack">
          <span>{t('wf.sc.catchUp')}</span>
          <select value={catchUp} onChange={(e) => setCatchUp(e.target.value as Schedule['catchUp'])}>
            {(['once', 'skip', 'all'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`wf.sc.catch.${k}` as TKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="cw-chip wf-enabled">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('wf.sc.enabled')}
        </label>
      </div>
      {error && <p className="chat-error">{error}</p>}
      <div className="row">
        <Button tone="primary" icon={<Check size={15} />} disabled={!wf || !!problem} onClick={save}>
          {t('wf.ed.save')}
        </Button>
      </div>
    </div>
  );
}

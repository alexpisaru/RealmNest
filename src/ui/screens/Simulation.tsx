import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Hand,
  Maximize2,
  Moon,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  ScrollText,
  Send,
  Shuffle,
  Snowflake,
  Star,
  StepForward,
  Sun,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WorldIcon } from '../worldIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LoggedEvent } from '../../core/events';
import { OUTFIT_BY_ID, outfitsForWorld } from '../../data/outfits';
import { WORLDS } from '../../data/worlds';
import { AGENT_STATES, type AgentState, type CommandType } from '../../domain/sim';
import type { WorldSession } from '../../engine/session';
import type { VisualAgent } from '../../engine/worldSim';
import { STATE_COLORS, type TKey } from '../../i18n';
import { useMoveAgent } from '../agentMove';
import { useApp, useServices, useSession, useT, useTD } from '../context';
import { Button, Empty, Portrait, Segmented, Slider, StateBadge, Toggle } from '../kit';
import { CapabilitiesDebug } from '../CapabilitiesDebug';
import { ToolsDebug } from '../tools/ToolsDebug';
import { McpDebug } from '../mcp/McpDebug';
import { FilesDebug } from '../files/FilesDebug';
import { KnowledgeDebug } from '../knowledge/KnowledgeDebug';
import { MemoryDebug } from '../memory/MemoryDebug';
import { WebDebug } from '../web/WebDebug';
import { ResearchDebug } from '../research/ResearchDebug';
import { LiveTaskPanel } from '../LiveTaskPanel';
import { ProvidersPanel } from '../ProvidersPanel';
import { Guide } from './HelpModals';
import { WorldViewport, type ViewportControls } from '../WorldViewport';

type Tab = 'controls' | 'debug' | 'events';

export function SimulationScreen() {
  const st = useApp();
  const t = useT();
  const td = useTD();
  const { store } = useServices();
  const session = useSession();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>(st.settings.debug ? 'debug' : 'controls');
  const [sendMode, setSendMode] = useState(false);
  const [debugView, setDebugView] = useState<'world' | 'providers' | 'capabilities' | 'tools' | 'mcp' | 'files' | 'knowledge' | 'memory' | 'web' | 'research'>('world');
  const [guide, setGuide] = useState(false);
  const cam = useRef<ViewportControls>(null);
  // Send to Agent (Artifacts): open that agent's inspector, where its task panel takes the file
  useEffect(() => {
    const id = st.taskHandoff?.agentId;
    if (id && session?.sim.agents.some((a) => a.id === id)) session.select(id);
  }, [st.taskHandoff, session]);

  const run = (type: CommandType, extra: Partial<Parameters<WorldSession['dispatch']>[0]> = {}) =>
    session?.dispatch({ type, targets: session.targetsOrSelection(), source: 'user', ...extra });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (!session || st.creator || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const map: Record<string, CommandType> = { w: 'startWork', b: 'break', p: 'pause', r: 'resume', x: 'randomize', h: 'huddle', i: 'idle' };
      if (map[k]) run(map[k]);
      else if (k === 'a') session.selectAll();
      else if (k === ' ') session.setFrozen(!session.frozen);
      else if (k === '.') session.step();
      else if (k === 'l') store.updateSettings({ showLabels: !st.settings.showLabels });
      else if (k === 'n') store.updateSettings({ night: !st.settings.night });
      else if (k === 'd') (store.updateSettings({ debug: !st.settings.debug }), setTab('debug'), setOpen(true));
      else if (k === '+' || k === '=') cam.current?.zoom(1);
      else if (k === '-') cam.current?.zoom(-1);
      else if (k === '0') cam.current?.reset();
      else if (k === '[' || k === ']') setOpen((v) => !v);
      else if (k === 'escape') (session.select(null), setSendMode(false));
      else if (k === '?') setGuide(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!session) return null;
  const counts = session.counts();
  const agents = session.sim.agents;
  const selected = agents.filter((a) => session.selected.has(a.id));
  const w = session.world;
  const clock = simClock(session.sim.time, t);

  return (
    <div className={`sim ${open ? 'drawer-open' : ''}`}>
      <WorldViewport
        controls={cam}
        insetRight={open ? 372 : 0}
        onTile={
          sendMode && selected.length
            ? (tile) => {
                session.dispatch({ type: 'goto', targets: selected.map((a) => a.id), tile, source: 'debug' });
              }
            : undefined
        }
      />

      <header className="hud">
        <div className="hud-title">
          <span className="emoji">
            <WorldIcon id={w.id} size={20} />
          </span>
          <div>
            <b>{td(w.name)}</b>
            <small>
              {agents.length === 1 ? t('island.agent') : t('island.agents', { n: agents.length })} · {clock}
            </small>
          </div>
        </div>
        <div className="hud-stats">
          {(['working', 'walking', 'on_break', 'waiting', 'paused', 'error'] as AgentState[]).map((s) => (
            <span key={s} className="hud-stat" title={t(`state.${s}` as TKey)}>
              <i style={{ background: STATE_COLORS[s] }} />
              {t(`state.${s}` as TKey)} <b>{s === 'on_break' ? counts.on_break + counts.interacting : counts[s]}</b>
            </span>
          ))}
        </div>
        <div className="hud-tools">
          <Segmented value={session.speed} onChange={(v) => session.setSpeed(v)} label={t('sim.speed')} options={[0.5, 1, 2, 4].map((v) => ({ value: v, label: `${v}×` }))} />
          <button className={`icon-btn ${session.frozen ? 'on' : ''}`} onClick={() => session.setFrozen(!session.frozen)} title={`${t('sim.freeze')} (Space)`}>
            <Snowflake size={16} />
          </button>
          <button className="icon-btn" onClick={() => session.step()} title={`${t('sim.step')} (.)`}>
            <StepForward size={16} />
          </button>
          <span className="sep" />
          <button className="icon-btn" onClick={() => cam.current?.zoom(-1)} title={t('w.sim.zoomOut')}>
            <ZoomOut size={16} />
          </button>
          <button className="icon-btn" onClick={() => cam.current?.zoom(1)} title={t('w.sim.zoomIn')}>
            <ZoomIn size={16} />
          </button>
          <button className="icon-btn" onClick={() => cam.current?.reset()} title={t('w.sim.resetCamera')}>
            <Maximize2 size={16} />
          </button>
          <button className={`icon-btn ${st.settings.night ? 'on' : ''}`} onClick={() => store.updateSettings({ night: !st.settings.night })} title={`${t(st.settings.night ? 'sim.day' : 'sim.night')} (N)`} aria-pressed={st.settings.night}>
            {st.settings.night ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setGuide(true)} title={t('w.sim.shortcuts')}>
            ?
          </button>
        </div>
      </header>

      {session.frozen && (
        <div className="frozen">
          <Snowflake size={14} /> {t('w.frozen')} — {t('w.frozenKey')}
        </div>
      )}
      {sendMode && <div className="mode-banner">{t('w.sim.sendBanner', { names: selected.map((a) => a.look.name).join(', ') || t('w.sim.sendBannerNone') })}</div>}

      {agents.length === 0 && (
        <div className="sim-empty">
          <Empty title={t('sim.empty')} sub={t('sim.emptySub')}>
            <div className="row">
              <Button tone="primary" icon={<UserPlus size={16} />} onClick={() => store.openCreator({ worldId: w.id })}>
                {t('crew.new')}
              </Button>
              <Button icon={<Users size={16} />} onClick={() => (store.focusWorld(w.id), store.navigate('worlds'))}>
                {t('worlds.assign')}
              </Button>
            </div>
          </Empty>
        </div>
      )}

      {selected.length > 0 && <Inspector session={session} agents={selected} />}

      <aside className={`drawer ${open ? '' : 'closed'}`}>
        <button className="drawer-toggle" onClick={() => setOpen((v) => !v)} aria-label={t('w.sim.toggleDrawer')} title={`${t('w.sim.toggleDrawer')} ([)`}>
          {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        {open && (
          <>
            <div className="drawer-tabs" role="tablist">
              {(
                [
                  ['controls', t('sim.controls'), Hand],
                  ['debug', t('sim.debug'), Bug],
                  ['events', t('sim.events'), ScrollText],
                ] as const
              ).map(([id, label, Icon]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            <div className="drawer-body">
              {tab === 'controls' && <Controls session={session} run={run} />}
              {tab === 'debug' && (
                <>
                  <Segmented value={debugView} onChange={setDebugView} label={t('w.sim.debugView')} options={[{ value: 'world', label: t('w.dbg.world') }, { value: 'providers', label: t('w.dbg.providers') }, { value: 'capabilities', label: t('w.dbg.capabilities') }, { value: 'tools', label: t('w.dbg.tools') }, { value: 'mcp', label: 'MCP' }, { value: 'files', label: t('w.dbg.files') }, { value: 'knowledge', label: 'Knowledge' }, { value: 'memory', label: t('w.dbg.memory') }, { value: 'web', label: t('w.dbg.web') }, { value: 'research', label: t('w.dbg.research') }]} />
                  {debugView === 'world' && <Debug session={session} sendMode={sendMode} setSendMode={setSendMode} />}
                  {debugView === 'providers' && <ProvidersPanel />}
                  {debugView === 'capabilities' && <CapabilitiesDebug />}
                  {debugView === 'tools' && <ToolsDebug />}
                  {debugView === 'mcp' && <McpDebug />}
                  {debugView === 'files' && <FilesDebug />}
                  {debugView === 'knowledge' && <KnowledgeDebug />}
                  {debugView === 'memory' && <MemoryDebug />}
                  {debugView === 'web' && <WebDebug />}
                  {debugView === 'research' && <ResearchDebug />}
                </>
              )}
              {tab === 'events' && <EventLog limit={200} />}
            </div>
          </>
        )}
      </aside>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </div>
  );
}

function simClock(time: number, t: (k: TKey, vars?: Record<string, string | number>) => string) {
  const mins = Math.floor(time) + 9 * 60;
  return t('w.sim.clock', { day: Math.floor(mins / 1440) + 1, time: `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` });
}

// ── controls ─────────────────────────────────────────────────

function RuntimeMode() {
  const t = useT();
  const { store } = useServices();
  const mode = useApp().settings.runtimeMode;
  return (
    <div className="runtime-mode">
      <Segmented
        value={mode}
        onChange={(v) => store.updateSettings({ runtimeMode: v })}
        label={t('w.sim.runtime')}
        options={[
          { value: 'mock', label: 'Mock' },
          { value: 'live', label: 'Live' },
        ]}
      />
      <small className="muted">{mode === 'live' ? t('w.sim.liveHint') : t('w.sim.mockHint')}</small>
    </div>
  );
}

function Controls({ session, run }: { session: WorldSession; run: (t: CommandType, extra?: object) => void }) {
  const t = useT();
  const [task, setTask] = useState('');
  if (session.runtime.kind === 'live')
    return (
      <div className="controls">
        <RuntimeMode />
        <h4>{t('w.sim.liveTitle')}</h4>
        <p className="muted small">{t('w.sim.liveText')}</p>
        <Toggle on={session.frozen} onChange={(v) => session.setFrozen(v)} label={t('sim.freeze')} sub={t('w.sim.freezeLiveSub')} k="Space" />
      </div>
    );
  const sel = session.selected.size;
  const target = sel ? t('w.sim.targetSelected', { n: sel }) : t('w.sim.targetAll', { n: session.sim.agents.length });
  const route = () => {
    const pool = session.sim.agents.filter((a) => a.spawnIn <= 0);
    const free = pool.find((a) => session.runtime.status(a.id) === 'idle') ?? pool[0];
    if (!free) return;
    session.dispatch({ type: 'assign', targets: [free.id], task: task.trim() || undefined, source: 'user' });
    setTask('');
  };
  return (
    <div className="controls">
      <RuntimeMode />
      <div className="target-line">
        {t('w.sim.target')} <b>{target}</b>
        {sel > 0 && (
          <button className="link-btn" onClick={() => session.select(null)}>
            {t('w.sim.clear')}
          </button>
        )}
      </div>
      <button className="btn btn-primary btn-lg start" onClick={() => run('startWork')}>
        <Play size={18} fill="currentColor" /> {t('sim.startWork')} <kbd>W</kbd>
      </button>
      <div className="cmd-grid">
        <Cmd icon={<Pause size={16} />} label={t('sim.pause')} k="P" onClick={() => run('pause')} />
        <Cmd icon={<Coffee size={16} />} label={t('sim.break')} k="B" onClick={() => run('break')} />
        <Cmd icon={<StepForward size={16} />} label={t('sim.resume')} k="R" onClick={() => run('resume')} />
        <Cmd icon={<Users size={16} />} label={t('sim.huddle')} k="H" onClick={() => run('huddle')} />
        <Cmd icon={<Shuffle size={16} />} label={t('sim.randomize')} k="X" onClick={() => run('randomize')} />
        <Cmd icon={<Hand size={16} />} label={t('sim.idle')} k="I" onClick={() => run('idle')} />
        <Cmd icon={<MousePointer2 size={16} />} label={t('sim.selectAll')} k="A" onClick={() => session.selectAll()} />
        <Cmd icon={<RotateCcw size={16} />} label={t('sim.reset')} danger onClick={() => run('reset')} />
      </div>

      <h4>{t('w.sim.assignTitle')}</h4>
      <div className="row">
        <input value={task} onChange={(e) => setTask(e.target.value)} placeholder={t('w.sim.taskPlaceholder')} onKeyDown={(e) => e.key === 'Enter' && route()} />
      </div>
      <div className="row">
        <Button size="sm" onClick={() => (run('assign', { task: task.trim() || undefined }), setTask(''))}>
          {t('w.sim.assignTarget')}
        </Button>
        <Button size="sm" tone="soft" icon={<Send size={14} />} onClick={route} title={t('w.sim.routeHint')}>
          {t('w.sim.route')}
        </Button>
      </div>

      <h4>{t('w.sim.simulation')}</h4>
      <Toggle on={session.runtime.autopilot} onChange={(v) => session.setAutopilot(v)} label={t('w.sim.autopilot')} sub={t('w.sim.autopilotSub')} />
      <Toggle on={session.frozen} onChange={(v) => session.setFrozen(v)} label={t('sim.freeze')} sub={t('w.sim.freezeSub')} k="Space" />
      <p className="muted small">
        {t('w.sim.runtimeLabel')} <b>MockRuntime</b>. {t('w.sim.mockNote')}
      </p>
    </div>
  );
}

function Cmd({ icon, label, k, onClick, danger }: { icon: React.ReactNode; label: string; k?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`cmd ${danger ? 'danger' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {k && <kbd>{k}</kbd>}
    </button>
  );
}

// ── inspector ────────────────────────────────────────────────

function Inspector({ session, agents }: { session: WorldSession; agents: VisualAgent[] }) {
  const { store } = useServices();
  const st = useApp();
  const t = useT();
  const td = useTD();
  const move = useMoveAgent();
  const send = (type: CommandType, extra: object = {}) => session.dispatch({ type, targets: agents.map((a) => a.id), source: 'user', ...extra });

  if (agents.length > 1)
    return (
      <div className="inspector">
        <header>
          <b>{t('w.ins.selected', { n: agents.length })}</b>
          <button className="icon-btn" onClick={() => session.select(null)} aria-label={t('w.ins.clearSelection')}>
            <X size={16} />
          </button>
        </header>
        <div className="multi">
          {agents.map((a) => (
            <Portrait key={a.id} look={a.look} scale={2} bust />
          ))}
        </div>
        {session.runtime.kind !== 'live' && <QuickRow send={send} />}
      </div>
    );

  const a = agents[0];
  const c = st.characters.find((x) => x.id === a.id);
  const station = session.sim.point(a.stationId);
  const others = session.sim.agents.filter((x) => x.id !== a.id);
  const live = session.runtime.kind === 'live';
  return (
    <div className="inspector">
      <header>
        <Portrait look={a.look} scale={3} bust animate mode={a.state === 'interacting' ? 'talk' : 'stand'} className="ins-portrait" />
        <div className="ins-id">
          <b>
            {a.look.name} {a.look.founder && <Star size={12} className="star" fill="currentColor" aria-label={t('w.ins.founder')} />}
          </b>
          <span>{td(a.look.role)}</span>
          <StateBadge state={a.state} />
        </div>
        <button className="icon-btn" onClick={() => session.select(null)} aria-label={t('w.ins.close')}>
          <X size={16} />
        </button>
      </header>
      <h4 className="ins-section">{t('w.ins.identity')}</h4>
      <dl className="kv">
        <dt>{t('agent.world')}</dt>
        <dd>
          {c ? (
            <select className="move-world" value={c.worldId} onChange={(e) => move(c.id, e.target.value)} aria-label={`${t('agent.move')} ${c.name}`} title={t('agent.move')}>
              {WORLDS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id === c.worldId ? td(w.name) : `→ ${td(w.name)}`}
                </option>
              ))}
            </select>
          ) : (
            td(session.world.name)
          )}
        </dd>
        <dt>{t('w.ins.activity')}</dt>
        <dd title={td(a.activity)}>{td(a.activity)}</dd>
        <dt>{t('w.ins.station')}</dt>
        <dd>{station ? td(station.label) : '—'}</dd>
        {!live && <dt>{t('w.ins.task')}</dt>}
        {!live && (
          <dd>
            {a.task ? (
              <>
                {td(a.task.title)}
                {a.task.from && <small className="muted"> · {t('w.ins.from', { name: session.sim.get(a.task.from)?.look.name ?? '' })}</small>}
                <div className="bar">
                  <i style={{ width: `${Math.min(100, (session.runtime.task(a.id)?.progress ?? a.task.progress) * 100)}%` }} />
                </div>
              </>
            ) : (
              <span className="muted">{t('w.ins.none')}</span>
            )}
            <small className="ins-mock-note">{t('w.ins.mockNote')}</small>
          </dd>
        )}
        <dt>{t('w.ins.outfit')}</dt>
        <dd>
          <select value={a.look.outfitId} onChange={(e) => store.setOutfit(a.id, e.target.value)} aria-label={t('w.ins.outfit')}>
            {outfitsForWorld(session.world.outfitCategory).map((o) => (
              <option key={o.id} value={o.id}>
                {td(o.name)}
              </option>
            ))}
          </select>
        </dd>
      </dl>
      {live ? <LiveTaskPanel agentId={a.id} /> : <QuickRow send={send} />}
      <div className="row">
        {!live && (
          <select defaultValue="" onChange={(e) => e.target.value && (send('delegate', { to: e.target.value }), (e.target.value = ''))} aria-label={t('w.ins.delegate')}>
            <option value="">{t('w.ins.delegateTo')}</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.look.name} · {td(o.look.role)}
              </option>
            ))}
          </select>
        )}
        {c && (
          <Button size="sm" icon={<Pencil size={14} />} onClick={() => store.openCreator({ editingId: c.id })}>
            {t('crew.edit')}
          </Button>
        )}
      </div>
      <small className="muted">{t('w.ins.outfitLine', { name: td(OUTFIT_BY_ID[a.look.outfitId]?.name) })}</small>
    </div>
  );
}

function QuickRow({ send }: { send: (t: CommandType) => void }) {
  const t = useT();
  return (
    <div className="quick-row">
      <Button size="sm" tone="primary" onClick={() => send('startWork')}>
        {t('w.quick.work')}
      </Button>
      <Button size="sm" onClick={() => send('break')}>
        {t('sim.break')}
      </Button>
      <Button size="sm" onClick={() => send('idle')}>
        {t('w.quick.idle')}
      </Button>
      <Button size="sm" onClick={() => send('pause')}>
        {t('sim.pause')}
      </Button>
      <Button size="sm" onClick={() => send('resume')}>
        {t('sim.resume')}
      </Button>
    </div>
  );
}

// ── debug ────────────────────────────────────────────────────

function Debug({ session, sendMode, setSendMode }: { session: WorldSession; sendMode: boolean; setSendMode: (v: boolean) => void }) {
  const { store } = useServices();
  const st = useApp();
  const t = useT();
  const td = useTD();
  const s = st.settings;
  const agents = session.sim.agents;
  const selId = [...session.selected][0] ?? '';
  const [force, setForce] = useState<AgentState>('working');
  const [pointId, setPointId] = useState('');
  const sel = session.sim.get(selId);
  const cmd = (type: CommandType, extra: object = {}) => session.dispatch({ type, targets: session.targetsOrSelection(), source: 'debug', ...extra });

  return (
    <div className="debug">
      <h4>{t('w.dbg.agent')}</h4>
      <select value={selId} onChange={(e) => session.select(e.target.value || null)} aria-label={t('w.dbg.agentPick')}>
        <option value="">{t('w.dbg.noAgent')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.look.name}
          </option>
        ))}
      </select>
      {sel && (
        <dl className="kv mono">
          <dt>{t('w.dbg.state')}</dt>
          <dd style={{ color: STATE_COLORS[sel.state] }}>{sel.state}</dd>
          <dt>{t('w.dbg.runtime')}</dt>
          <dd>{session.runtime.status(sel.id)}</dd>
          <dt>{t('w.dbg.pos')}</dt>
          <dd>
            {sel.x.toFixed(2)}, {sel.y.toFixed(2)} · {sel.facing}
          </dd>
          <dt>{t('w.dbg.target')}</dt>
          <dd>{sel.target ? `${sel.target.purpose} → ${td(sel.target.label)}` : '—'}</dd>
          <dt>{t('w.dbg.path')}</dt>
          <dd>{t('w.dbg.waypoints', { n: sel.path.length })}</dd>
          <dt>{t('w.dbg.station')}</dt>
          <dd>{td(session.sim.point(sel.stationId)?.label) || '—'}</dd>
        </dl>
      )}
      <div className="row">
        <select value={force} onChange={(e) => setForce(e.target.value as AgentState)} aria-label={t('w.dbg.forceState')}>
          {AGENT_STATES.map((x) => (
            <option key={x} value={x}>
              {t(`state.${x}` as TKey)}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => cmd('forceState', { state: force })}>
          {t('w.dbg.forceState')}
        </Button>
      </div>
      <div className="row">
        <select value={pointId} onChange={(e) => setPointId(e.target.value)} aria-label={t('w.dbg.point')}>
          <option value="">{t('w.dbg.pointPick')}</option>
          {session.world.points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.type} · {td(p.label)}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={!pointId || !selId} onClick={() => cmd('goto', { pointId })}>
          {t('w.dbg.send')}
        </Button>
      </div>
      <Toggle on={sendMode} onChange={setSendMode} label={t('w.dbg.clickSend')} sub={t('w.dbg.clickSendSub')} />

      <h4>{t('w.sim.simulation')}</h4>
      {session.runtime.kind === 'live' && <p className="muted small">{t('w.dbg.liveNote')}</p>}
      <div className="cmd-grid tight">
        <Cmd icon={<Play size={14} />} label={t('w.dbg.start')} onClick={() => cmd('startWork')} />
        <Cmd icon={<Coffee size={14} />} label={t('sim.break')} onClick={() => cmd('break')} />
        <Cmd icon={<StepForward size={14} />} label={t('sim.resume')} onClick={() => cmd('resume')} />
        <Cmd icon={<Pause size={14} />} label={t('sim.pause')} onClick={() => cmd('pause')} />
        <Cmd icon={<Shuffle size={14} />} label={t('sim.randomize')} onClick={() => cmd('randomize')} />
        <Cmd icon={<RotateCcw size={14} />} label={t('sim.reset')} danger onClick={() => cmd('reset')} />
        <Cmd icon={<StepForward size={14} />} label={t('sim.step')} k="." onClick={() => session.step()} />
        <Cmd icon={<Snowflake size={14} />} label={session.frozen ? t('w.dbg.unfreeze') : t('sim.freeze')} k="␣" onClick={() => session.setFrozen(!session.frozen)} />
      </div>
      <Slider label={t('w.dbg.failureRate')} min={0} max={0.5} step={0.05} value={session.runtime.failureRate} onChange={(v) => session.setFailureRate(v)} />

      <h4>{t('w.dbg.overlays')}</h4>
      <Toggle on={s.showPaths} onChange={(v) => store.updateSettings({ showPaths: v })} label={t('w.dbg.paths')} />
      <Toggle on={s.showPoints} onChange={(v) => store.updateSettings({ showPoints: v })} label={t('w.dbg.points')} />
      <Toggle on={s.showTargets} onChange={(v) => store.updateSettings({ showTargets: v })} label={t('w.dbg.targets')} />
      <Toggle on={s.showLabels} onChange={(v) => store.updateSettings({ showLabels: v })} label={t('w.dbg.labels')} k="L" />
      <Toggle on={s.showGrid} onChange={(v) => store.updateSettings({ showGrid: v })} label={t('w.dbg.grid')} />

      <h4>{t('w.dbg.agents')}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>{t('w.dbg.colName')}</th>
            <th>{t('w.dbg.colVisual')}</th>
            <th>{t('w.dbg.colRuntime')}</th>
            <th>{t('w.dbg.colTask')}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} onClick={() => session.select(a.id)} className={session.selected.has(a.id) ? 'on' : ''}>
              <td>{a.look.name}</td>
              <td style={{ color: STATE_COLORS[a.state] }}>{a.state}</td>
              <td>{session.runtime.status(a.id)}</td>
              <td>{a.task ? `${Math.round((session.runtime.task(a.id)?.progress ?? 0) * 100)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>{t('w.dbg.recent')}</h4>
      <EventLog limit={25} compact />
    </div>
  );
}

// ── event log ────────────────────────────────────────────────

function EventLog({ limit, compact }: { limit: number; compact?: boolean }) {
  const { bus } = useServices();
  const t = useT();
  useSession(); // re-render with the sim
  const [filter, setFilter] = useState('');
  const names = useNames();
  const rows = bus.log.filter((e) => !filter || e.type.includes(filter)).slice(0, limit);
  return (
    <div className={`event-log ${compact ? 'compact' : ''}`}>
      {!compact && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('w.ev.filter')} aria-label={t('w.ev.filterLabel')} />
      )}
      <ul>
        {rows.map((e) => (
          <li key={e.seq} className={`ev ev-${e.type.split('.')[0]}`}>
            <time>{e.simTime !== undefined ? e.simTime.toFixed(1) : '—'}</time>
            <code>
              {e.origin === 'live' && <i className="ev-live">live</i>}
              {e.type}
            </code>
            <span>{describe(e, names, t('w.ev.all'))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useNames() {
  const st = useApp();
  return useMemo(() => new Map(st.characters.map((c) => [c.id, c.name])), [st.characters]);
}

function describe(e: LoggedEvent, names: Map<string, string>, all: string): string {
  const p = e.payload as Record<string, unknown>;
  const n = (id: unknown) => names.get(String(id)) ?? String(id ?? '');
  if (e.type === 'agent.run.started') return `${n(p.agentId)} “${p.title}” · ${p.providerId}`;
  if (e.type === 'agent.run.failed') return `${n(p.agentId)} ${(p.error as { message: string }).message}`;
  if (e.type === 'agent.status.changed' || e.type === 'agent.run.status' || e.type === 'task.status.changed') return `${n(p.agentId)} ${p.from ?? '—'} → ${p.to}`;
  if ('agentId' in p) {
    const extra = p.task ? `“${(p.task as { title: string }).title}”` : p.to ? `→ ${String(p.to).length > 20 ? '' : p.to}` : p.at ? `@ ${p.at}` : p.reason ? String(p.reason) : p.pointId ? String(p.pointId) : '';
    const tr = p.from && p.to && e.type === 'agent.state.changed' ? `${p.from} → ${p.to}` : '';
    return `${n(p.agentId)} ${tr || extra}`;
  }
  if (e.type === 'provider.event') return `${p.providerId} ${p.type}`;
  if (e.type === 'provider.status') return `${p.providerId}: ${(p.status as { state: string }).state}`;
  if (e.type === 'agent.delegation') return `${n(p.from)} → ${n(p.to)}: ${p.title}`;
  if (e.type === 'command.issued') return `${p.type}${Array.isArray(p.targets) && p.targets.length ? ` · ${p.targets.map(n).join(', ')}` : ` · ${all}`}`;
  if ('name' in p) return String(p.name);
  if ('worldId' in p) return String(p.worldId);
  return '';
}

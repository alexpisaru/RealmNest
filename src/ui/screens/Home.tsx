// Home, which is also the main menu (the app opens here): the map of all the
// worlds, with a tag wherever agents live (agents, active tasks, state), what
// happened recently, and an overview. Everything else is in the sidebar.

import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Lightbulb, ListChecks, MessagesSquare, Play, UserPlus, Users } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WORLDS } from '../../data/worlds';
import type { TKey } from '../../i18n';
import { useApp, useChat, useLive, useServices, useT, useTD } from '../context';
import { overview, placeTags, recentActivity, summarize, timeAgo, type ActivityItem, type HomeSources, type TagPlace, type WorldSummary } from '../homeData';
import { Portrait } from '../kit';
import { lookOf } from '../sessionManager';
import { MAP_ZONES, WORLD_MAP_H, WORLD_MAP_IMAGE, WORLD_MAP_W } from '../worldMapZones';
import { WorldIcon } from '../worldIcons';
import { Guide, News } from './HelpModals';

export function HomeScreen() {
  const st = useApp();
  const t = useT();
  const live = useLive();
  const chat = useChat();
  const { store } = useServices();
  const [help, setHelp] = useState<null | 'news' | 'guide'>(null);

  const sources: HomeSources = {
    characters: st.characters,
    tasksOf: (id) => live.tasksOf(id),
    working: (id) => !!live.activeRun(id),
    conversations: chat.list(),
  };
  const v = `${live.getVersion()}-${chat.getVersion()}-${st.characters.length}`;
  const summaries = useMemo(() => WORLDS.filter((w) => MAP_ZONES[w.id]).map((w) => summarize(w, sources)), [v, st.characters]);
  const activity = useMemo(() => recentActivity(sources, 30), [v, st.characters]);
  const stats = useMemo(() => overview(sources), [v, st.characters]);
  const enter = (id: string) => (store.markIntroSeen(), store.setWorld(id), store.navigate('simulation'));

  return (
    <div className="home">
      <section className="world-map panel-glass" aria-label={t('home.map')}>
        <header className="map-head">
          <span>{t('home.map')}</span>
          <span className="map-head-tools">
            <button className="icon-btn" onClick={() => setHelp('news')} aria-label={t('menu.news')} title={t('menu.news')}>
              <Lightbulb size={16} />
            </button>
            <button className="icon-btn" onClick={() => setHelp('guide')} aria-label={t('menu.guide')} title={t('menu.guide')}>
              <BookOpen size={16} />
            </button>
            <button className="link-btn" onClick={() => store.navigate('worlds')}>
              {t('home.allWorlds')} <ArrowRight size={14} />
            </button>
          </span>
        </header>
        <WorldMap summaries={summaries} currentId={st.currentWorldId} onOpen={enter} />
        <button type="button" className="map-sound" role="switch" aria-checked={st.settings.sound} onClick={() => store.updateSettings({ sound: !st.settings.sound })} title={t('home.soundHint')}>
          <span>{t('home.sound')}</span>
          <span className={`switch ${st.settings.sound ? 'on' : ''}`} />
        </button>
      </section>

      <aside className="home-side">
        <section className="panel-glass home-card home-recent">
          <header className="home-card-head">{t('home.recent')}</header>
          {activity.length === 0 ? <p className="muted small">{t('home.noActivity')}</p> : <ul className="activity-list">{activity.map((a) => <ActivityRow key={a.key} a={a} />)}</ul>}
        </section>
        <section className="panel-glass home-card home-stats">
          <header className="home-card-head">{t('home.overview')}</header>
          <div className="stat-grid">
            <Stat value={stats.agents} label={t('home.statAgents')} icon={<Users size={18} />} tone="accent" />
            <Stat value={stats.working} label={t('home.statWorking')} icon={<Play size={18} />} tone="ok" />
            <Stat value={stats.doneToday} label={t('home.statDone')} icon={<CheckCircle2 size={18} />} tone="info" />
            <Stat value={stats.failedWeek} label={t('home.statFailed')} icon={<AlertTriangle size={18} />} tone="bad" />
          </div>
        </section>
      </aside>
      {help === 'news' && <News onClose={() => setHelp(null)} />}
      {help === 'guide' && <Guide onClose={() => setHelp(null)} />}
    </div>
  );
}

const stateOf = (s: WorldSummary) => (s.working > 0 ? 'working' : s.agents > 0 ? 'idle' : 'empty');

/** the illustration fitted inside the panel; a tag on each world with agents (and the current one) opens it */
function WorldMap({ summaries, currentId, onOpen }: { summaries: WorldSummary[]; currentId: string; onOpen: (id: string) => void }) {
  const sea = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, vw: 0, vh: 0 });
  useLayoutEffect(() => {
    const el = sea.current;
    if (!el) return;
    const fit = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      // fill the whole panel: only open sea and sky at the edges get cropped
      const k = Math.max(vw / WORLD_MAP_W, vh / WORLD_MAP_H);
      setSize({ w: WORLD_MAP_W * k, h: WORLD_MAP_H * k, vw, vh });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // tags only where agents live (an empty world just visited gets none)
  const tagged = summaries.filter((s) => s.agents > 0);
  const places = useMemo(() => {
    // the part of the map on screen, in map pixels (it may be cropped to fill the panel)
    const ox = Math.max(0, (size.w - size.vw) / 2);
    const oy = Math.max(0, (size.h - size.vh) / 2);
    const view = { x0: ox + 8, y0: oy + 44, x1: size.w - ox - 8, y1: size.h - oy - 8 };
    return placeTags(tagged.map((s) => ({ id: s.world.id, ...MAP_ZONES[s.world.id] })), size.w, size.h, view);
  }, [tagged.map((s) => s.world.id).join(), size.w, size.h, size.vw, size.vh]);

  return (
    <div className="map-sea" ref={sea}>
      {size.w > 0 && (
        <div className="map-frame" style={{ width: size.w, height: size.h }}>
          <img className="map-img" src={WORLD_MAP_IMAGE} alt="" draggable={false} />
          {tagged.map((s) => {
            const p = places[s.world.id];
            return p ? <MapTag key={s.world.id} s={s} current={s.world.id === currentId} at={p} onOpen={() => onOpen(s.world.id)} /> : null;
          })}
        </div>
      )}
    </div>
  );
}

function MapTag({ s, current, at, onOpen }: { s: WorldSummary; current: boolean; at: TagPlace; onOpen: () => void }) {
  const t = useT();
  const td = useTD();
  const state = stateOf(s);
  return (
    <button
      className={`map-tag side-${at.side} ${current ? 'current' : ''} st-${state}`}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
      onClick={onOpen}
      aria-label={`${td(s.world.name)} · ${s.agents === 1 ? t('island.agent') : t('island.agents', { n: s.agents })} · ${t(`island.${state}` as TKey)}`}
    >
      <b>
        <WorldIcon id={s.world.id} size={13} /> {td(s.world.name)}
      </b>
      <small>
        <Users size={11} /> {s.agents === 1 ? t('island.agent') : t('island.agents', { n: s.agents })}
        {s.tasks > 0 && (
          <>
            <span className="dotsep">·</span>
            <ListChecks size={11} /> {t('island.tasks', { n: s.tasks })}
          </>
        )}
        <span className="dotsep">·</span>
        <i className={`dot st-${state}`} /> {t(`island.${state}` as TKey)}
      </small>
    </button>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const st = useApp();
  const t = useT();
  const td = useTD();
  const c = a.agentId ? st.characters.find((x) => x.id === a.agentId) : undefined;
  const look = useMemo(() => (c ? lookOf(c) : undefined), [c]);
  const head =
    a.kind === 'chat'
      ? a.who
        ? t('act.chatAgent', { name: a.who })
        : t('act.chat')
      : a.kind === 'agent'
        ? t('act.agent', { name: a.who ?? '' })
        : t(`act.${a.kind}` as TKey, { name: a.who ?? '' });
  return (
    <li className={`activity-row ${a.kind}`}>
      <span className="act-avatar">{look ? <Portrait look={look} scale={1} bust /> : a.kind === 'chat' ? <MessagesSquare size={16} /> : <UserPlus size={16} />}</span>
      <span className="act-text">
        <b>{head}</b>
        <small title={td(a.what)}>{td(a.what)}</small>
      </span>
      <time dateTime={new Date(a.at).toISOString()}>{timeAgo(a.at, st.settings.language)}</time>
    </li>
  );
}

function Stat({ value, label, icon, tone }: { value: number; label: string; icon: ReactNode; tone: 'accent' | 'ok' | 'info' | 'bad' }) {
  return (
    <div className={`stat ${tone}`}>
      <b>{value}</b>
      <span>{label}</span>
      <i aria-hidden>{icon}</i>
    </div>
  );
}

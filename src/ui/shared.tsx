// Shared composite widgets (world cards, crew cards, sim controls, activity).
import { Coffee, Pause, Play, RotateCcw, Shuffle, Star, StepForward } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Character } from '../domain/character';
import type { AgentState } from '../domain/sim';
import type { WorldDef } from '../domain/world';
import { OUTFIT_BY_ID } from '../data/outfits';
import { PRESETS } from '../data/presets';
import { WORLD_BY_ID } from '../data/worlds';
import type { WorldSession } from '../engine/session';
import { STATE_COLORS, type TKey } from '../i18n';
import { onRendererReady, rendererReadyVersion, worldThumbnail, type StaticFigure } from '../render/worldRenderer';
import { useT, useTD } from './context';
import { Portrait, StateBadge } from './kit';
import { lookOf } from './sessionManager';

/** A few preset characters posed at work, used in world thumbnails. */
export function worldFigures(w: WorldDef): StaticFigure[] {
  const pts = w.points.filter((p) => ['WORKSTATION', 'MACHINE', 'LAB_BENCH', 'SERVER', 'CROP', 'CONTROL_PANEL'].includes(p.type)).slice(0, 3);
  return pts.map((p, i) => ({
    look: { profile: PRESETS[i * 3 + 1].profile, outfitId: w.defaultOutfitId, signature: PRESETS[i * 3 + 1].signature },
    x: p.x,
    y: p.y,
    dir: p.facing,
    mode: 'work',
  }));
}

/** Re-render when a world's scene finishes building (128×64 worlds build in workers). */
export function useRendererReady() {
  return useSyncExternalStore(onRendererReady, rendererReadyVersion);
}

export function WorldThumb({ w, width = 360, className }: { w: WorldDef; width?: number; className?: string }) {
  const v = useRendererReady();
  const src = useMemo(() => worldThumbnail(w, worldFigures(w), width), [w, width, v]);
  return src ? <img className={`world-thumb ${className ?? ''}`} src={src} alt="" draggable={false} /> : <span className={`world-thumb loading ${className ?? ''}`} style={{ background: `linear-gradient(${w.theme.sky[0]}, ${w.theme.sky[1]})` }} />;
}

export function WorldCard({ w, active, onClick, crew }: { w: WorldDef; active?: boolean; onClick: () => void; crew?: number }) {
  const t = useT();
  const td = useTD();
  return (
    <button className={`world-card ${active ? 'active' : ''}`} onClick={onClick}>
      <WorldThumb w={w} />
      <span className="wc-body">
        <b>{td(w.name)}</b>
        <span>{td(w.tagline)}</span>
        {crew !== undefined && <small>{t('a.sh.worldCount', { n: crew, m: w.points.filter((p) => ['WORKSTATION', 'MACHINE', 'LAB_BENCH', 'SERVER', 'CROP', 'CONTROL_PANEL'].includes(p.type)).length })}</small>}
      </span>
    </button>
  );
}

export function CrewCard({ c, state, onClick, compact }: { c: Character; state?: AgentState; onClick?: () => void; compact?: boolean }) {
  const t = useT();
  const td = useTD();
  const look = useMemo(() => lookOf(c), [c]);
  const w = WORLD_BY_ID[c.worldId];
  return (
    <button className={`crew-card ${compact ? 'compact' : ''}`} onClick={onClick} style={{ ['--sig' as string]: c.signature }}>
      <span className="cc-art">
        <Portrait look={look} scale={compact ? 3 : 4} bust />
      </span>
      <span className="cc-body">
        <b>
          {c.name} {c.metadata.founder && <Star size={11} className="star" fill="currentColor" aria-label={t('a.cc.founder')} />}
        </b>
        <span className="role">{td(c.role)}</span>
        {!compact && (
          <span className="cc-meta">
            <span>{td(w?.name)}</span>
            <span>{td(OUTFIT_BY_ID[c.outfitId]?.name)}</span>
          </span>
        )}
        {state && <StateBadge state={state} />}
      </span>
    </button>
  );
}

export function QuickControls({ session, compact }: { session: WorldSession; compact?: boolean }) {
  const t = useT();
  const run = (type: 'startWork' | 'pause' | 'break' | 'resume' | 'reset' | 'randomize') => session.dispatch({ type, targets: session.targetsOrSelection(), source: 'user' });
  return (
    <div className={`quick ${compact ? 'compact' : ''}`}>
      <button className="btn btn-primary btn-lg start" onClick={() => run('startWork')}>
        <Play size={18} fill="currentColor" /> {t('sim.startWork')}
      </button>
      <div className="quick-grid">
        <button className="qbtn" onClick={() => run('pause')}>
          <Pause size={18} />
          <span>{t('sim.pause')}</span>
        </button>
        <button className="qbtn" onClick={() => run('break')}>
          <Coffee size={18} />
          <span>{t('sim.break')}</span>
        </button>
        <button className="qbtn" onClick={() => run('resume')}>
          <StepForward size={18} />
          <span>{t('sim.resume')}</span>
        </button>
        {compact ? (
          <button className="qbtn danger" onClick={() => run('reset')}>
            <RotateCcw size={18} />
            <span>{t('sim.reset')}</span>
          </button>
        ) : (
          <button className="qbtn" onClick={() => run('randomize')}>
            <Shuffle size={18} />
            <span>{t('sim.randomize')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function Activity({ session }: { session: WorldSession }) {
  const t = useT();
  const c = session.counts();
  const total = session.sim.agents.length || 1;
  const active = c.working + c.walking + c.interacting + c.waiting;
  const rows: AgentState[] = ['idle', 'walking', 'working', 'on_break', 'waiting', 'paused', 'error'];
  let acc = 0;
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="activity">
      <ul>
        {rows.map((s) => (
          <li key={s}>
            <i style={{ background: STATE_COLORS[s] }} />
            <span>{t(`state.${s}` as TKey)}</span>
            <b>{s === 'on_break' ? c.on_break + c.interacting : c[s]}</b>
          </li>
        ))}
      </ul>
      <svg viewBox="0 0 120 120" className="donut" aria-label={`${active} ${t('home.active')}`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,240,225,0.08)" strokeWidth="12" />
        {(['working', 'walking', 'interacting', 'on_break', 'waiting', 'paused', 'error', 'idle'] as AgentState[]).map((s) => {
          const frac = c[s] / total;
          const el = (
            <circle key={s} cx="60" cy="60" r={R} fill="none" stroke={STATE_COLORS[s]} strokeWidth="12" strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 60 60)" />
          );
          acc += frac;
          return el;
        })}
        <text x="60" y="58" textAnchor="middle" className="donut-n">
          {active}
        </text>
        <text x="60" y="76" textAnchor="middle" className="donut-l">
          {t('home.active')}
        </text>
      </svg>
    </div>
  );
}

/** whether a CSS media query matches, kept in sync with the window */
export function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setOn(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return on;
}

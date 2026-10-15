import { LogIn, UserPlus } from 'lucide-react';
import { WorldIcon } from '../worldIcons';
import { useMemo, useState } from 'react';
import { outfitsForWorld } from '../../data/outfits';
import { PRESETS } from '../../data/presets';
import { WORLD_BY_ID, WORLDS } from '../../data/worlds';
import type { InteractionType } from '../../domain/world';
import type { TKey } from '../../i18n';
import { useMoveAgent } from '../agentMove';
import { useApp, useServices, useT, useTD } from '../context';
import { Button, Portrait } from '../kit';
import { CrewCard, WorldCard, WorldThumb } from '../shared';

const ZONE_LABEL: Record<InteractionType, TKey> = {
  WORKSTATION: 'w.zone.workstation',
  MACHINE: 'w.zone.machine',
  LAB_BENCH: 'w.zone.labBench',
  SERVER: 'w.zone.server',
  CROP: 'w.zone.crop',
  CONTROL_PANEL: 'w.zone.controlPanel',
  COFFEE: 'w.zone.coffee',
  BREAK: 'w.zone.break',
  LOUNGE: 'w.zone.lounge',
  MEETING: 'w.zone.meeting',
  STORAGE: 'w.zone.storage',
  DECORATIVE: 'w.zone.decorative',
};

export function WorldsScreen() {
  const st = useApp();
  const t = useT();
  const td = useTD();
  const { store } = useServices();
  const w = WORLD_BY_ID[st.focusWorldId] ?? WORLD_BY_ID[st.currentWorldId];
  const crewHere = st.characters.filter((c) => c.worldId === w.id);
  const others = st.characters.filter((c) => c.worldId !== w.id);
  const [assign, setAssign] = useState('');
  const move = useMoveAgent();
  const zones = useMemo(() => {
    const m = new Map<InteractionType, number>();
    for (const p of w.points) m.set(p.type, (m.get(p.type) ?? 0) + 1);
    return [...m.entries()];
  }, [w]);
  const sampleLook = useMemo(() => ({ profile: PRESETS[0].profile, signature: PRESETS[0].signature }), []);

  const enter = () => {
    store.setWorld(w.id);
    store.navigate('simulation');
  };

  return (
    <div className="worlds">
      <section className="panel-glass worlds-main">
        <header className="section-head">
          <div>
            <h1 className="display">{t('worlds.title')}</h1>
            <p className="sub">{t('worlds.sub')}</p>
          </div>
        </header>
        <div className="world-grid big">
          {WORLDS.map((x) => (
            <WorldCard key={x.id} w={x} active={x.id === w.id} crew={st.characters.filter((c) => c.worldId === x.id).length} onClick={() => store.focusWorld(x.id)} />
          ))}
        </div>
      </section>
      <aside className="panel-glass world-detail" key={w.id}>
        <WorldThumb w={w} width={640} className="hero" />
        <div className="wd-body">
          <div className="wd-title">
            <h2 className="display small">
              <WorldIcon id={w.id} size={20} /> {td(w.name)}
            </h2>
            {w.id === st.currentWorldId && <span className="pill-live">{t('w.worlds.current')}</span>}
          </div>
          <p>{td(w.description)}</p>
          <div className="wd-actions">
            <Button tone="primary" icon={<LogIn size={16} />} onClick={enter}>
              {t('worlds.enter')}
            </Button>
            {w.id !== st.currentWorldId && <Button onClick={() => store.setWorld(w.id)}>{t('worlds.setCurrent')}</Button>}
          </div>

          <h3>{t('worlds.zones')}</h3>
          <div className="zones">
            {zones.map(([type, n]) => (
              <span key={type} className="zone">
                {t(ZONE_LABEL[type])} <b>{n}</b>
              </span>
            ))}
          </div>

          <h3>{t('worlds.collection')}</h3>
          <div className="mini-outfits">
            {outfitsForWorld(w.outfitCategory)
              .filter((o) => o.worldCategory === w.outfitCategory)
              .map((o) => (
                <span key={o.id} title={td(o.name)}>
                  <Portrait look={{ ...sampleLook, outfitId: o.id }} scale={2} />
                </span>
              ))}
          </div>

          <h3>
            {t('worlds.crewHere')} <small>({crewHere.length})</small>
          </h3>
          {crewHere.length === 0 && <p className="muted">{t('worlds.noCrew')}</p>}
          <div className="crew-list">
            {crewHere.map((c) => (
              <div key={c.id} className="crew-line">
                <CrewCard c={c} compact onClick={() => store.openCreator({ editingId: c.id })} />
                <select aria-label={`${t('agent.move')} ${c.name}`} value={c.worldId} onChange={(e) => move(c.id, e.target.value)}>
                  {WORLDS.map((x) => (
                    <option key={x.id} value={x.id}>
                      → {td(x.name)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="assign-row">
            <select value={assign} onChange={(e) => setAssign(e.target.value)} aria-label={t('w.worlds.assignLabel')}>
              <option value="">{t('w.worlds.bring')}</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.role} ({td(WORLD_BY_ID[c.worldId]?.name)})
                </option>
              ))}
            </select>
            <Button disabled={!assign} onClick={() => (move(assign, w.id), setAssign(''))}>
              {t('worlds.assign')}
            </Button>
            <Button tone="soft" icon={<UserPlus size={16} />} onClick={() => store.openCreator({ worldId: w.id })}>
              {t('crew.new')}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

import { Copy, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Character } from '../../domain/character';
import { outfitsForWorld } from '../../data/outfits';
import { WORLD_BY_ID, WORLDS } from '../../data/worlds';
import { useMoveAgent } from '../agentMove';
import { useApp, useServices, useSession, useT, useTD } from '../context';
import { Button, Empty, Portrait, StateBadge } from '../kit';
import { lookOf } from '../sessionManager';

/** the Agents screen: every character, its world and outfit ("crew" is a Crew, src/ui/screens/Crews.tsx) */
export function AgentsScreen() {
  const st = useApp();
  const t = useT();
  const td = useTD();
  const { store } = useServices();
  const [q, setQ] = useState('');
  const [world, setWorld] = useState('');
  const [role, setRole] = useState('');
  const roles = useMemo(() => [...new Set(st.characters.map((c) => c.role))].sort(), [st.characters]);
  const list = st.characters.filter(
    (c) =>
      (!q || `${c.name} ${c.role}`.toLowerCase().includes(q.toLowerCase())) && (!world || c.worldId === world) && (!role || c.role === role),
  );

  return (
    <div className="crew panel-glass">
      <header className="section-head">
        <div>
          <h1 className="display">{t('crew.title')}</h1>
          <p className="sub">
            {t('crew.sub')} <b>{st.characters.length}</b> {st.characters.length === 1 ? t('w.crew.agentOne') : t('w.crew.agentMany')}.
          </p>
        </div>
        <Button tone="primary" icon={<Plus size={16} />} onClick={() => store.openCreator({ worldId: world || st.currentWorldId })}>
          {t('crew.new')}
        </Button>
      </header>
      <div className="toolbar">
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('crew.search')} aria-label={t('crew.search')} />
        </label>
        <select value={world} onChange={(e) => setWorld(e.target.value)} aria-label={t('w.crew.filterWorld')}>
          <option value="">{t('crew.allWorlds')}</option>
          {WORLDS.map((w) => (
            <option key={w.id} value={w.id}>
              {td(w.name)}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('w.crew.filterRole')}>
          <option value="">{t('crew.allRoles')}</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 ? (
        <Empty title={t('crew.empty')}>
          <Button tone="primary" icon={<Plus size={16} />} onClick={() => store.openCreator({ worldId: world || st.currentWorldId })}>
            {t('crew.new')}
          </Button>
        </Empty>
      ) : (
        <div className="crew-grid">
          {list.map((c) => (
            <CrewTile key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CrewTile({ c }: { c: Character }) {
  const t = useT();
  const td = useTD();
  const { store } = useServices();
  const session = useSession();
  const look = useMemo(() => lookOf(c), [c]);
  const live = session?.world.id === c.worldId ? session.sim.get(c.id) : undefined;
  const [hot, setHot] = useState(false);
  const outfits = outfitsForWorld(WORLD_BY_ID[c.worldId].outfitCategory);
  const move = useMoveAgent();

  return (
    <article className="crew-tile" style={{ ['--sig' as string]: c.signature }} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}>
      <div className="ct-art">
        <Portrait look={look} scale={5} mode={hot ? 'walk' : 'stand'} dir={hot ? 'se' : 's'} animate={hot} />
      </div>
      <div className="ct-body">
        <div className="ct-name">
          <b>{c.name}</b>
          {c.metadata.founder && (
            <span className="founder-tag">
              <Star size={10} fill="currentColor" /> {t('w.crew.founder')}
            </span>
          )}
        </div>
        <span className="role">{td(c.role)}</span>
        <div className="ct-row">
          {live ? <StateBadge state={live.state} /> : <span className="muted small">{t('w.crew.notActive')}</span>}
        </div>
        {live && <span className="activity-line">{td(live.activity)}</span>}
        <label className="field-inline">
          <span>{t('agent.world')}</span>
          <select value={c.worldId} onChange={(e) => move(c.id, e.target.value)} aria-label={t('agent.move')}>
            {WORLDS.map((w) => (
              <option key={w.id} value={w.id}>
                {td(w.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span>{t('w.ins.outfit')}</span>
          <select value={c.outfitId} onChange={(e) => store.setOutfit(c.id, e.target.value)}>
            {outfits.map((o) => (
              <option key={o.id} value={o.id}>
                {td(o.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="ct-actions">
          <Button size="sm" icon={<Pencil size={14} />} onClick={() => store.openCreator({ editingId: c.id })}>
            {t('crew.edit')}
          </Button>
          <Button size="sm" tone="ghost" icon={<Copy size={14} />} onClick={() => store.duplicateCharacter(c.id)}>
            {t('crew.duplicate')}
          </Button>
          <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => window.confirm(t('crew.confirmDelete')) && store.deleteCharacter(c.id)} title={t('crew.delete')} />
        </div>
      </div>
    </article>
  );
}

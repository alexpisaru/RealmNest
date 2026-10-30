import { BookMarked, BookOpenCheck, Brain, ChartColumn, Globe, House, Layers, MessagesSquare, Power, Settings, Network, Telescope, Users, Workflow } from 'lucide-react';
import type { TKey } from '../i18n';
import { exitApp } from '../platform';
import type { Screen } from '../store/appStore';
import { useApp, useOrchestrator, useScheduler, useServices, useSkills, useT } from './context';
import { Logo } from './kit';
import { Avatar } from './profile';
import { useMediaQuery } from './shared';

const NAV: { id: Screen; icon: typeof House; key: TKey }[] = [
  { id: 'home', icon: House, key: 'nav.home' },
  { id: 'worlds', icon: Globe, key: 'nav.worlds' },
  { id: 'simulation', icon: ChartColumn, key: 'nav.simulation' },
  { id: 'chat', icon: MessagesSquare, key: 'nav.chat' },
  { id: 'agents', icon: Users, key: 'nav.agents' },
  { id: 'crews', icon: Network, key: 'nav.crews' },
  { id: 'workflows', icon: Workflow, key: 'nav.workflows' },
  { id: 'skills', icon: BookOpenCheck, key: 'nav.skills' },
  { id: 'artifacts', icon: Layers, key: 'nav.artifacts' },
  { id: 'knowledge', icon: BookMarked, key: 'nav.knowledge' },
  { id: 'memory', icon: Brain, key: 'nav.memory' },
  { id: 'research', icon: Telescope, key: 'nav.research' },
];

/**
 * The main navigation. In Chat and the World it is a compact icon rail that
 * opens over the page, with its labels, while the pointer (or focus) is on it.
 */
export function Sidebar({ compact: wanted }: { compact?: boolean }) {
  // narrow windows get the rail everywhere
  const compact = useMediaQuery('(max-width: 1240px)') || wanted;
  const { store } = useServices();
  const st = useApp();
  const t = useT();
  const name = st.settings.displayName.trim();
  // To do on the Workflow screen: approvals, suspended runs, finished runs not seen yet, missed schedules
  const orchestrator = useOrchestrator();
  const scheduler = useScheduler();
  const todo = orchestrator.inbox().length + scheduler.missedUnseen().length;
  // Skills from GitHub with an update waiting
  const skillUpdates = useSkills().withUpdates().length;
  const item = (id: Screen, Icon: typeof House, key: TKey) => (
    <button key={id} className={`nav-item ${st.screen === id ? 'on' : ''}`} onClick={() => store.navigate(id)} aria-label={t(key)} aria-current={st.screen === id ? 'page' : undefined}>
      <Icon size={19} strokeWidth={1.8} />
      <span className="nav-label">{t(key)}</span>
      {id === 'workflows' && todo > 0 && (
        <span className="nav-badge" title={t('wf.badge', { n: String(todo) })}>
          {todo > 99 ? '99+' : todo}
        </span>
      )}
      {id === 'skills' && skillUpdates > 0 && (
        <span className="nav-badge" title={t('skills.upd.badge', { n: skillUpdates })}>
          {skillUpdates}
        </span>
      )}
    </button>
  );
  return (
    <div className={`nav-slot ${compact ? 'compact' : ''}`}>
      <nav className={`sidebar ${compact ? 'compact' : ''}`} aria-label={t('a.nav.main')}>
        <button className="brand" onClick={() => store.navigate('home')} aria-label={t('nav.home')}>
          <Logo size={compact ? 30 : 34} />
          <span className="nav-label brand-text">
            <b>RealmNest</b>
            <small>{t('a.nav.tagline')}</small>
          </span>
        </button>
        <div className="nav-list">{NAV.map(({ id, icon, key }) => item(id, icon, key))}</div>
        <div className="nav-sep" />
        <div className="nav-list">{item('settings', Settings, 'nav.settings')}</div>
        <div className="nav-foot">
          <button className="nav-user" onClick={() => store.openSettings('general')} aria-label={name || t('settings.profile')} title={t('settings.profileEdit')}>
            <Avatar name={name} photo={st.settings.avatar} size={32} />
            <span className="nav-label">
              <b>{name || t('settings.profile')}</b>
              <small>{st.settings.profileRole || (name ? '' : t('settings.profileSet'))}</small>
            </span>
          </button>
          <button className="nav-item" onClick={() => void exitApp().then((ok) => !ok && store.toast(t('menu.exitBrowser')))} aria-label={t('menu.exit')}>
            <Power size={19} strokeWidth={1.8} />
            <span className="nav-label">{t('menu.exit')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

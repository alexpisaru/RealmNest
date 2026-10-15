// The help windows: what's new in each version, and the guide (Home and the World open them).

import { X } from 'lucide-react';
import type { TKey } from '../../i18n';
import { Modal } from '../kit';
import { useT } from '../context';
import { NEWS } from '../news';

/** a translated line where **text** is bold */
function bold(s: string) {
  return s.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

export function News({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t('menu.news')} onClose={onClose}>
      <header className="modal-head">
        <h2>{t('menu.news')}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t('w.close')}>
          <X size={18} />
        </button>
      </header>
      <div className="modal-body news">
        {NEWS.map((n) => (
          <section key={n.version}>
            <h3>
              {n.version} <small>{n.date}</small>
            </h3>
            <ul>
              {n.items.map((i) => (
                <li key={i}>{bold(t(i))}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

export function Guide({ onClose }: { onClose: () => void }) {
  const t = useT();
  const keys: [string, TKey][] = [
    ['W', 'sim.startWork'],
    ['B', 'sim.break'],
    ['P', 'sim.pause'],
    ['R', 'sim.resume'],
    ['I', 'sim.idle'],
    ['H', 'sim.huddle'],
    ['X', 'sim.randomize'],
    ['A', 'sim.selectAll'],
    ['Space', 'w.guide.freeze'],
    ['.', 'sim.step'],
    ['+ / −', 'w.guide.zoom'],
    ['0', 'w.guide.resetCamera'],
    ['N', 'w.guide.dayNight'],
    ['L', 'w.guide.labels'],
    ['D', 'w.guide.debug'],
    ['[', 'w.guide.drawer'],
    ['Esc', 'w.guide.deselect'],
  ];
  return (
    <Modal title={t('menu.guide')} onClose={onClose}>
      <header className="modal-head">
        <h2>{t('menu.guide')}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t('w.close')}>
          <X size={18} />
        </button>
      </header>
      <div className="modal-body guide">
        <ol>
          {(['w.guide.s1', 'w.guide.s2', 'w.guide.s3', 'w.guide.s4', 'w.guide.s5'] as const).map((k) => (
            <li key={k}>{bold(t(k))}</li>
          ))}
        </ol>
        <h3>{t('w.guide.keys')}</h3>
        <div className="keys-grid">
          {keys.map(([k, v]) => (
            <span key={k}>
              <kbd>{k}</kbd> {t(v)}
            </span>
          ))}
        </div>
        <p className="muted">{t('w.guide.mouse')}</p>
      </div>
    </Modal>
  );
}

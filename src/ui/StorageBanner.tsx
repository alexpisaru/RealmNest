// The app shell's banner for data problems (docs/HARDENING.md D-1, D-2, D-3): saving failed,
// a store could not be read, a service did not start, or this is a safe start. Hiding it lasts
// until a new problem arrives (or ten minutes pass while a save still fails).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { storageHealth } from '../persistence/health';
import { useServices, useT } from './context';

const COME_BACK_MS = 10 * 60_000;

export function StorageBanner() {
  const t = useT();
  const { store } = useServices();
  const h = useSyncExternalStore(storageHealth.subscribe, storageHealth.getSnapshot);
  const [hidden, setHidden] = useState<{ revision: number; at: number } | null>(null);
  const [, tick] = useState(0);

  // a hidden banner about failing saves comes back after a while
  useEffect(() => {
    if (!hidden || !h.writeFailures.length) return;
    const id = setTimeout(() => tick((n) => n + 1), Math.max(1_000, hidden.at + COME_BACK_MS - Date.now()));
    return () => clearTimeout(id);
  }, [hidden, h.writeFailures.length]);

  if (!storageHealth.hasProblems(h)) return null;
  if (hidden && hidden.revision === h.revision && !(h.writeFailures.length && Date.now() - hidden.at >= COME_BACK_MS)) return null;

  const lines: string[] = [];
  if (h.writeFailures.length) lines.push(t('s.health.writeFailed', { keys: h.writeFailures.map((f) => f.key).join(', ') }), t('s.health.writeWhat'));
  const copied = h.unreadable.filter((u) => u.copied).map((u) => u.key);
  const lost = h.unreadable.filter((u) => !u.copied).map((u) => u.key);
  if (copied.length) lines.push(t('s.health.unreadable', { keys: copied.join(', ') }));
  if (lost.length) lines.push(t('s.health.unreadableNoCopy', { keys: lost.join(', ') }));
  if (h.startupIssues.length) lines.push(t('s.health.startup', { list: [...new Set(h.startupIssues.map((i) => i.service))].join(', ') }));
  if (h.safeMode) lines.push(t('s.health.safe'));

  return (
    <div role="alert" style={bannerStyle}>
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => store.openSettings('general')}>
          {t('s.health.openData')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHidden({ revision: h.revision, at: Date.now() })}>
          {t('s.health.dismiss')}
        </button>
      </div>
    </div>
  );
}

const bannerStyle = {
  position: 'fixed',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 59,
  width: 'min(720px, calc(100vw - 32px))',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--warning) 45%, transparent)',
  background: 'var(--panel-solid)',
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.45,
} as const;

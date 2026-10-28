// Updates in the UI (docs/UPDATES.md): the shell's notice when a new version is out (install, what's
// new, later; then the download and the install), and the Updates part of Settings › General.
import { useState } from 'react';
import { useApp, useT, useUpdates } from '../context';
import { Button, Toggle } from '../kit';
import { Markdown } from '../chat/Markdown';

export function UpdateNotice() {
  const t = useT();
  const updates = useUpdates();
  const [notes, setNotes] = useState(false);
  const s = updates.notice();
  const update = s && 'update' in s ? s.update : undefined;
  if (!s || !update) return null;
  return (
    <div className="update-notice" role="status">
      {s.kind === 'available' && (
        <>
          <b>{t('up.available', { version: update.version })}</b>
          <span className="muted small">{t('up.availableSub', { current: update.current })}</span>
          {notes && update.notes && <Markdown text={update.notes} className="update-notes" />}
          <div className="row">
            <Button size="sm" tone="primary" onClick={() => void updates.install()}>
              {t('up.install')}
            </Button>
            {update.notes && (
              <Button size="sm" tone="ghost" onClick={() => setNotes((v) => !v)}>
                {notes ? t('up.hideNotes') : t('up.notes')}
              </Button>
            )}
            <Button size="sm" tone="ghost" onClick={() => updates.dismiss()}>
              {t('up.later')}
            </Button>
          </div>
        </>
      )}
      {s.kind === 'downloading' && (
        <>
          <span>{t('up.downloading', { version: update.version, pct: s.total ? `${Math.round((s.downloaded / s.total) * 100)}%` : '' })}</span>
          <progress max={s.total ?? 1} value={s.total ? s.downloaded : undefined} />
        </>
      )}
      {s.kind === 'installing' && <span>{t('up.installing', { version: update.version })}</span>}
      {s.kind === 'error' && (
        <>
          <span>{t('up.failed', { error: s.message })}</span>
          <div className="row">
            <Button size="sm" onClick={() => void updates.install()}>
              {t('up.retry')}
            </Button>
            <Button size="sm" tone="ghost" onClick={() => updates.dismiss()}>
              {t('up.later')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Settings › General: check now, the automatic check, and what the last check said */
export function UpdateSettings() {
  const t = useT();
  const updates = useUpdates();
  const lang = useApp().settings.language;
  if (!updates.available) return <p className="muted small">{t('up.unavailable')}</p>;
  const s = updates.state();
  const line =
    s.kind === 'checking'
      ? t('up.checking')
      : s.kind === 'current'
        ? t('up.current', { time: new Date(s.at).toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })
        : s.kind === 'available' || s.kind === 'downloading' || s.kind === 'installing'
          ? t('up.found', { version: s.update.version })
          : s.kind === 'error'
            ? s.during === 'check'
              ? t('up.checkFailed', { error: s.message })
              : t('up.failed', { error: s.message })
            : '';
  return (
    <>
      <Toggle on={updates.settings().autoCheck} onChange={(autoCheck) => void updates.setSettings({ autoCheck })} label={t('up.auto')} sub={t('up.autoSub')} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" disabled={s.kind === 'checking' || s.kind === 'downloading' || s.kind === 'installing'} onClick={() => void updates.check(true)}>
          {t('up.check')}
        </Button>
        {s.kind === 'available' && (
          <Button size="sm" tone="primary" onClick={() => void updates.install()}>
            {t('up.install')}
          </Button>
        )}
      </div>
      {line && <p className="muted small">{line}</p>}
    </>
  );
}

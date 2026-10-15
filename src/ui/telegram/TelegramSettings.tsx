// Settings › Integrations › Telegram (docs/TELEGRAM.md): the bot token (write-only), pairing,
// linked accounts, start / stop, and which notifications reach the phone.

import { Check, Link2, Play, Send, Square, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TelegramSettings as Settings } from '../../runtime/telegram/bridge';
import { useT, useTelegram } from '../context';
import { Button, Toggle } from '../kit';

export function TelegramSettings() {
  const t = useT();
  const tg = useTelegram();
  const st = tg.getStatus();
  const s = tg.getSettings();
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState<{ code: string; expiresAt: number }>();
  const [confirm, setConfirm] = useState(false);
  const available = tg.available;

  useEffect(() => {
    void tg.refresh();
  }, []);
  // while a code is open, look for the new account every few seconds
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      void tg.refresh();
      if (Date.now() > code.expiresAt) setCode(undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [code]);
  useEffect(() => {
    if (code && !st.pairingUntil && st.users.length) setCode(undefined);
  }, [st.pairingUntil, st.users.length]);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (patch: Partial<Settings>) => void tg.setSettings({ ...s, ...patch });
  const setNotify = (k: keyof Settings['notify'], v: boolean) => set({ notify: { ...s.notify, [k]: v } });

  return (
    <div className="ai-conns tg-settings">
      <h3>
        <Send size={16} /> {t('tg.ui.title')}
      </h3>
      <p className="muted">{t('tg.ui.sub')}</p>
      {!available && <p className="conn-msg">{t('tg.ui.desktopOnly')}</p>}
      {error && <p className="chat-error">{error}</p>}

      <section className="tg-step">
        <p className="small">{t('tg.ui.step1')}</p>
        {st.hasToken && !replacing ? (
          <div className="tg-row">
            <span className="tg-ok">
              <Check size={14} /> {t('tg.ui.tokenSaved')}
              {st.bot && <b> · {t('tg.ui.bot', { name: st.bot })}</b>}
            </span>
            <Button size="sm" tone="ghost" onClick={() => setReplacing(true)} disabled={!available}>
              {t('tg.ui.replaceToken')}
            </Button>
          </div>
        ) : (
          <div className="tg-row">
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…" aria-label={t('tg.ui.token')} autoComplete="off" spellCheck={false} disabled={!available} />
            <Button
              size="sm"
              tone="primary"
              disabled={!available || busy || !token.trim()}
              onClick={() =>
                act(async () => {
                  await tg.setToken(token);
                  setToken('');
                  setReplacing(false);
                })
              }
            >
              {t('tg.ui.saveToken')}
            </Button>
            {replacing && (
              <Button size="sm" tone="ghost" onClick={() => (setReplacing(false), setToken(''))}>
                {t('tg.ui.pairCancel')}
              </Button>
            )}
          </div>
        )}
      </section>

      {st.hasToken && (
        <>
          <section className="tg-step">
            <div className="tg-row">
              <span className={`tg-dot ${st.running ? 'on' : ''}`} />
              <b>{st.running ? t('tg.ui.running') : t('tg.ui.stopped')}</b>
              {st.error && <span className="chat-error small">{st.error}</span>}
              {st.running ? (
                <Button size="sm" tone="ghost" icon={<Square size={13} />} onClick={() => act(() => tg.stop())}>
                  {t('tg.ui.stop')}
                </Button>
              ) : (
                <Button size="sm" icon={<Play size={13} />} onClick={() => act(() => tg.start())} disabled={busy}>
                  {t('tg.ui.start')}
                </Button>
              )}
            </div>
            <Toggle on={s.autostart} onChange={(v) => set({ autostart: v })} label={t('tg.ui.autostart')} />
          </section>

          <section className="tg-step">
            <p className="small">{t('tg.ui.step2')}</p>
            {code ? (
              <div className="tg-row">
                <code className="tg-code">/start {code.code}</code>
                <span className="muted small">{t('tg.ui.pairHint', { code: code.code })}</span>
                <Button size="sm" tone="ghost" icon={<X size={13} />} onClick={() => act(async () => (await tg.pairCancel(), setCode(undefined)))}>
                  {t('tg.ui.pairCancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" icon={<Link2 size={13} />} onClick={() => act(async () => setCode(await tg.pairBegin()))} disabled={busy}>
                {t('tg.ui.pair')}
              </Button>
            )}
            <h4>{t('tg.ui.users')}</h4>
            {!st.users.length && <p className="muted small">{t('tg.ui.noUsers')}</p>}
            <ul className="tg-users">
              {st.users.map((u) => (
                <li key={u.userId}>
                  <b>{u.name}</b>
                  <code>{u.userId}</code>
                  <span className="muted small">{u.role === 'owner' ? t('tg.ui.owner') : t('tg.ui.user')}</span>
                  <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} onClick={() => act(() => tg.removeUser(u.userId))}>
                    {t('tg.ui.remove')}
                  </Button>
                </li>
              ))}
            </ul>
            <p className="muted small">{t('tg.ui.security')}</p>
          </section>

          <section className="tg-step">
            <h4>{t('tg.ui.notify')}</h4>
            {(['approvals', 'mine', 'runs', 'missed', 'progress'] as const).map((k) => (
              <Toggle key={k} on={s.notify[k]} onChange={(v) => setNotify(k, v)} label={t(`tg.ui.n.${k}`)} />
            ))}
            <div className="tg-row">
              <Toggle on={!!s.quiet} onChange={(v) => set({ quiet: v ? { from: '23:00', to: '07:00' } : undefined })} label={t('tg.ui.quiet')} />
              {s.quiet && (
                <>
                  <span className="muted small">{t('tg.ui.quietFrom')}</span>
                  <input type="time" value={s.quiet.from} onChange={(e) => set({ quiet: { ...s.quiet!, from: e.target.value } })} />
                  <span className="muted small">{t('tg.ui.quietTo')}</span>
                  <input type="time" value={s.quiet.to} onChange={(e) => set({ quiet: { ...s.quiet!, to: e.target.value } })} />
                </>
              )}
            </div>
          </section>

          <div className="tg-row">
            {!confirm ? (
              <Button size="sm" tone="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirm(true)}>
                {t('tg.ui.disconnect')}
              </Button>
            ) : (
              <Button size="sm" tone="danger" icon={<Trash2 size={13} />} onClick={() => act(async () => (await tg.disconnect(), setConfirm(false)))}>
                {t('tg.ui.disconnectConfirm')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// An account connection's Sign in and Sign out: Claude (Claude Code opens the browser, the user
// pastes back the code it shows) or ChatGPT (Codex opens the browser; the sign-in ends there).
// The credentials stay in the CLI's own config folder.

import { LogIn, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AIConnection } from '../domain/connection';
import { claudeLogin, codexLogin } from '../platform';
import type { ClaudeLoginEvent } from '../runtime/providers/claude-code/login';
import { useConnections, useT, useWeb } from './context';
import { Button, Modal } from './kit';

const LOGINS = { Claude: claudeLogin(), ChatGPT: codexLogin() };
type Brand = keyof typeof LOGINS;

export function ClaudeAccountActions({ c, onError, brand = 'Claude' }: { c: AIConnection; onError: (m: string) => void; brand?: Brand }) {
  const t = useT();
  const login = LOGINS[brand];
  const connections = useConnections();
  const [signingIn, setSigningIn] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const configDir = c.config.configDir?.trim() || undefined;
  const signOut = async () => {
    setConfirmOut(false);
    try {
      await login.logout(configDir);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
    await connections.validate(c.id).catch(() => undefined);
  };
  return (
    <>
      {c.status !== 'connected' ? (
        <Button size="sm" tone="primary" icon={<LogIn size={14} />} onClick={() => setSigningIn(true)} disabled={!login.available || c.status === 'checking'}>
          {t('claude.signIn')}
        </Button>
      ) : confirmOut ? (
        <span className="row">
          <small>{brand === 'Claude' ? t('claude.signOutAsk') : t('a.acct.signOutAsk', { name: brand })}</small>
          <Button size="sm" tone="danger" onClick={() => void signOut()}>
            {t('claude.signOut')}
          </Button>
          <Button size="sm" tone="ghost" onClick={() => setConfirmOut(false)}>
            {t('creator.cancel')}
          </Button>
        </span>
      ) : (
        <Button size="sm" tone="ghost" icon={<LogOut size={14} />} onClick={() => setConfirmOut(true)} disabled={!login.available}>
          {t('claude.signOut')}
        </Button>
      )}
      {signingIn && <ClaudeSignIn c={c} brand={brand} onClose={() => setSigningIn(false)} />}
    </>
  );
}

type Step = { k: 'starting' } | { k: 'browser'; url?: string; prompt: boolean } | { k: 'checking' } | { k: 'done'; ok: boolean; message: string };

function ClaudeSignIn({ c, brand, onClose }: { c: AIConnection; brand: Brand; onClose: () => void }) {
  const t = useT();
  const login = LOGINS[brand];
  const title = brand === 'Claude' ? t('claude.signInTitle') : t('a.acct.signInTitle', { name: brand });
  const web = useWeb();
  const connections = useConnections();
  const [step, setStep] = useState<Step>({ k: 'starting' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const id = useRef<string | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    let url: string | undefined;
    let prompt = false;
    const onEvent = (e: ClaudeLoginEvent) => {
      if (e.t === 'url') url = e.url;
      if (e.t === 'prompt') prompt = true;
      if (e.t === 'end') {
        ended.current = true;
        id.current = null;
        if (!e.ok) return setStep({ k: 'done', ok: false, message: e.message });
        setStep({ k: 'checking' });
        // the new sign-in: status, account and models again
        void connections
          .validate(c.id)
          .catch(() => undefined)
          .then(() => connections.refreshModels(c.id).catch(() => undefined))
          .then(() => setStep({ k: 'done', ok: true, message: e.message }));
        return;
      }
      setStep({ k: 'browser', url, prompt });
    };
    login
      .start(c.config.configDir?.trim() || undefined, onEvent)
      .then((sid) => {
        if (ended.current) return;
        id.current = sid;
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        // the CLI is missing (a new computer): say what to install, in the user's language
        setStep({ k: 'done', ok: false, message: /was not found on this computer/.test(message) ? t(`a.acct.missing.${brand}`) : message });
      });
    return () => {
      // closing the window while the CLI waits ends that sign-in
      if (id.current) void login.cancel(id.current);
    };
  }, []);

  const send = async () => {
    if (!id.current || !code.trim()) return;
    setError('');
    try {
      await login.code(id.current, code.trim());
      setCode('');
      setStep({ k: 'checking' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal onClose={onClose} title={title}>
      <div className="modal-head">
        <h2>{title}</h2>
      </div>
      <div className="modal-body claude-signin">
        {step.k === 'starting' && <p className="muted">{t('claude.starting')}</p>}
        {step.k === 'browser' && (
          <>
            <p>{brand === 'Claude' ? t('claude.browserOpened') : t('a.acct.browserOpenedNoCode')}</p>
            {step.url && (
              <Button size="sm" tone="ghost" onClick={() => void web.open(step.url!).catch((e) => setError(String(e?.message ?? e)))}>
                {t('claude.openAgain')}
              </Button>
            )}
            {(brand === 'Claude' || step.prompt) && (
            <label className="field-stack">
              <span>{t('claude.code')}</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} placeholder={t('claude.codePlaceholder')} spellCheck={false} autoComplete="off" autoFocus />
              <small className="muted">{t('claude.codeSub')}</small>
            </label>
            )}
          </>
        )}
        {step.k === 'checking' && <p className="muted">{t('claude.checking')}</p>}
        {step.k === 'done' && (step.ok ? <p className="claude-ok">{t('claude.signedIn', { account: connections.list().find((x) => x.id === c.id)?.account ?? c.name })}</p> : <p className="chat-error">{step.message || t('claude.failed')}</p>)}
        {error && <p className="chat-error">{error}</p>}
      </div>
      <div className="modal-foot">
        {step.k === 'browser' && (brand === 'Claude' || step.prompt) && (
          <Button tone="primary" onClick={() => void send()} disabled={!code.trim()}>
            {t('claude.confirm')}
          </Button>
        )}
        <Button tone="ghost" onClick={onClose}>
          {step.k === 'done' ? t('claude.close') : t('creator.cancel')}
        </Button>
      </div>
    </Modal>
  );
}

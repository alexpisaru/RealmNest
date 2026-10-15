// What the user sees when something breaks (docs/HARDENING.md D-2/E-1): a screen that fails
// keeps the sidebar alive, a failed start shows a recovery page instead of a blank window.
// Both say the data is still on disk and offer Retry and "Start safely".

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translator } from '../i18n';

type Lang = 'it' | 'en';

/** sessionStorage flag read once by main.tsx: this launch skips MCP autostart, Telegram and the scheduler */
export const SAFE_LAUNCH_FLAG = 'realmnest:safe-launch';

export function restartSafely() {
  try {
    window.sessionStorage.setItem(SAFE_LAUNCH_FLAG, '1');
  } catch {
    /* the query flag below still works */
  }
  window.location.replace(`${window.location.pathname}?safe=1`);
}

/** this launch was asked to start safely (the flag is used once) */
export function takeSafeLaunch(): boolean {
  let safe = false;
  try {
    safe = window.sessionStorage.getItem(SAFE_LAUNCH_FLAG) === '1';
    window.sessionStorage.removeItem(SAFE_LAUNCH_FLAG);
  } catch {
    /* no session storage */
  }
  try {
    if (new URLSearchParams(window.location.search).get('safe') === '1') {
      safe = true;
      // a later reload starts normally
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch {
    /* ignore */
  }
  return safe;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message || e.name : String(e)).slice(0, 400);

interface BoundaryProps {
  children: ReactNode;
  fallback: (error: unknown, retry: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<BoundaryProps, { error: unknown; failed: boolean; attempt: number }> {
  state = { error: undefined as unknown, failed: false, attempt: 0 };
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[realmnest] a screen failed', error, info.componentStack);
  }
  retry = () => this.setState((s) => ({ error: undefined, failed: false, attempt: s.attempt + 1 }));
  render() {
    if (this.state.failed) return this.props.fallback(this.state.error, this.retry);
    // a new key remounts the children on Retry
    return <ErrorBoundaryChild key={this.state.attempt}>{this.props.children}</ErrorBoundaryChild>;
  }
}
const ErrorBoundaryChild = ({ children }: { children: ReactNode }) => <>{children}</>;

/** a screen's own failure: the rest of the app keeps working */
export function ScreenCrash({ error, lang, onRetry, onHome }: { error: unknown; lang: Lang; onRetry: () => void; onHome: () => void }) {
  const t = translator(lang);
  return (
    <div className="empty" role="alert" style={{ margin: 32 }}>
      <b>{t('s.recovery.screenTitle')}</b>
      <span>{t('s.recovery.data')}</span>
      <span className="muted small">{t('s.recovery.what', { error: errorText(error) })}</span>
      <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 8 }}>
        <button type="button" className="btn btn-primary btn-md" onClick={onRetry}>
          {t('s.recovery.retry')}
        </button>
        <button type="button" className="btn btn-default btn-md" onClick={onHome}>
          {t('s.recovery.home')}
        </button>
      </div>
    </div>
  );
}

/** the whole app could not render */
export function RecoveryScreen({ error, lang }: { error: unknown; lang: Lang }) {
  const t = translator(lang);
  return (
    <div role="alert" style={recoveryStyle}>
      <h1 style={{ margin: 0, fontSize: 22 }}>{t('s.recovery.title')}</h1>
      <p style={{ margin: 0 }}>{t('s.recovery.data')}</p>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{t('s.recovery.what', { error: errorText(error) })}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-md" onClick={() => window.location.reload()}>
          {t('s.recovery.retry')}
        </button>
        <button type="button" className="btn btn-default btn-md" onClick={restartSafely} title={t('s.recovery.safeSub')}>
          {t('s.recovery.safe')}
        </button>
      </div>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{t('s.recovery.safeSub')}</p>
    </div>
  );
}

const recoveryStyle = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 14,
  padding: '0 max(24px, calc(50vw - 280px))',
  background: 'var(--background, #0c1011)',
  color: 'var(--text-primary, #e8f2ee)',
  fontFamily: 'system-ui, sans-serif',
} as const;

/**
 * The same page without React (the start failed, React may be what broke): plain DOM into #root.
 */
export function showRecovery(root: HTMLElement, error: unknown, lang: Lang) {
  let t: ReturnType<typeof translator>;
  try {
    t = translator(lang);
  } catch {
    t = ((k: string) => k) as ReturnType<typeof translator>;
  }
  root.replaceChildren();
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  Object.assign(box.style, { ...recoveryStyle, gap: '14px' });
  const line = (tag: string, text: string, muted = false) => {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.margin = '0';
    if (muted) Object.assign(el.style, { opacity: '0.7', fontSize: '13px' });
    box.append(el);
  };
  line('h1', t('s.recovery.title'));
  line('p', t('s.recovery.data'));
  line('p', t('s.recovery.what', { error: errorText(error) }), true);
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });
  const button = (text: string, cls: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls} btn-md`;
    b.textContent = text;
    b.onclick = onClick;
    row.append(b);
  };
  button(t('s.recovery.retry'), 'btn-primary', () => window.location.reload());
  button(t('s.recovery.safe'), 'btn-default', restartSafely);
  box.append(row);
  line('p', t('s.recovery.safeSub'), true);
  root.append(box);
}

// The usage ring: next to the model in the chat and in an agent's AI panel. Its fill is the most
// telling gauge of the connection — a subscription's 5-hour session, an OpenRouter key's spending
// cap, or the month against the user's own budget — and a click opens the details: the plan's
// windows with their reset times, the key's credits, and what this chat, this agent, today and the
// last 30 days consumed (recorded locally from every turn).

import { useEffect, useRef, useState } from 'react';
import { useApp, useConnections, useT, useUsage } from '../context';
import { openRouterCredits, type KeyCredits } from '../../runtime/usage/credits';
import type { UsageTotals } from '../../runtime/usage/service';

export const fmtTokens = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));
export const fmtUsd = (n: number) => (n === 0 ? '$0' : n < 0.001 ? '<$0.001' : n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n >= 0.01 ? 2 : 3)}`);
const tone = (v: number) => (v >= 0.85 ? 'bad' : v >= 0.6 ? 'warn' : 'ok');

/** an account (plan with usage windows) or a key that pays per token */
export function useUsageGauge(connectionId: string | undefined) {
  const usage = useUsage();
  const connections = useConnections();
  const c = connectionId ? connections.get(connectionId) : undefined;
  // a subscription: usage windows, no dollar budget
  const plan = c?.providerId === 'claude-code' || c?.providerId === 'codex';
  // free local models: nothing to budget either
  const free = c?.providerId === 'ollama';
  const limits = connectionId ? usage.limits(connectionId) : undefined;
  const [credits, setCredits] = useState<KeyCredits | null>(null);
  useEffect(() => {
    setCredits(null);
    if (!connectionId || c?.providerId !== 'openrouter') return;
    let live = true;
    openRouterCredits(connectionId)
      .then((k) => live && setCredits(k))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [connectionId, c?.providerId]);
  const budget = connectionId ? usage.budget(connectionId) : undefined;
  const month = connectionId ? usage.month(connectionId) : undefined;
  // the ring: the fullest plan window (session or week), the key's cap, or the month against the budget
  const fullest = limits?.windows.length ? Math.max(...limits.windows.map((w) => w.utilization)) : undefined;
  let value: number | undefined;
  if (plan && fullest !== undefined) value = fullest;
  else if (credits?.limit && credits.limitRemaining !== undefined) value = Math.min(1, Math.max(0, 1 - credits.limitRemaining / credits.limit));
  else if (budget && month?.cost !== undefined) value = Math.min(1, month.cost / budget);
  return { c, plan, free, limits, credits, budget, month, value };
}

function Ring({ value, size = 18 }: { value: number | undefined; size?: number }) {
  const r = size / 2 - 2.2;
  const len = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className={`usage-ring-svg ${value === undefined ? 'idle' : tone(value)}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="track" />
      {value !== undefined && <circle cx={size / 2} cy={size / 2} r={r} className="arc" strokeDasharray={`${Math.max(0.02, value) * len} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
    </svg>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className={`usage-bar ${tone(value)}`}>
      <span style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </span>
  );
}

export function UsageRing({ connectionId, conversationId, agentId, agentName, up, summary }: { connectionId: string | undefined; conversationId?: string; agentId?: string; agentName?: string; up?: boolean; /** a short line beside the ring (the agent panel) */ summary?: boolean }) {
  const t = useT();
  const lang = useApp().settings.language;
  const usage = useUsage();
  const g = useUsageGauge(connectionId);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 8 });
  const box = useRef<HTMLDivElement>(null);
  // placed against the window: panels that scroll or clip (the agent inspector) never cut it
  const toggle = () => {
    const r = box.current?.getBoundingClientRect();
    if (r) {
      // in the right half it opens leftwards (its right edge on the ring), else rightwards
      const left = Math.min(Math.max(8, r.left + r.width / 2 > window.innerWidth / 2 ? r.right - 290 : r.left - 6), window.innerWidth - 298);
      const room = window.innerHeight - r.bottom;
      setPos(up || room < 320 ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 6 });
    }
    setOpen((v) => !v);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    // Escape closes the details only (not the panel behind them)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  if (!connectionId || !g.c) return null;
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';
  const when = (ms: number) => {
    const d = new Date(ms);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const ago = (ms: number) => {
    const m = Math.round((Date.now() - ms) / 60_000);
    return m < 1 ? t('use.now') : m < 60 ? t('use.minAgo', { n: m }) : t('use.hAgo', { n: Math.round(m / 60) });
  };
  const line = (u: UsageTotals) => `${fmtTokens(u.input + u.output)} ${t('use.tokens')}${u.cost !== undefined ? ` · ${fmtUsd(u.cost)}` : ''}`;
  const today = usage.totals({ connectionId, days: 1 });
  const d30 = usage.totals({ connectionId, days: 30 });
  const label = g.value !== undefined ? `${t('use.title')}: ${Math.round(g.value * 100)}%` : t('use.title');
  // beside the ring: this agent's last 30 days, and under it the plan's session (once a reply told it)
  const summaryText = () => {
    const session = g.plan ? g.limits?.windows.find((w) => w.id === 'five_hour') : undefined;
    const mine = agentId ? usage.totals({ connectionId, agentId, days: 30 }) : d30;
    const used = mine.input + mine.output;
    return (
      <>
        <span>{used > 0 ? t('a.use.tokens30', { n: fmtTokens(used) }) : t('a.use.none')}</span>
        {session && <small>{`${t('use.session')}: ${Math.round(session.utilization * 100)}%`}</small>}
      </>
    );
  };
  const winName = (id: string) => (id === 'five_hour' ? t('use.session') : id === 'seven_day' ? t('use.week') : id.replace(/_/g, ' '));
  return (
    <div className="usage-ring" ref={box}>
      <button type="button" className="usage-ring-btn" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}>
        <Ring value={g.value} />
        {summary && <span className="usage-ring-text">{summaryText()}</span>}
      </button>
      {open && (
        <div className="usage-pop" style={pos} role="dialog" aria-label={t('use.title')}>
          <div className="usage-head">
            <b>{g.c.name}</b>
            <small className="muted">{g.plan ? t('use.plan') : t('use.metered')}</small>
          </div>
          {g.plan &&
            (g.limits ? (
              <>
                {g.limits.windows.map((w) => (
                  <div key={w.id} className="usage-win">
                    <div className="usage-row">
                      <span>{winName(w.id)}</span>
                      <b>{Math.round(w.utilization * 100)}%</b>
                    </div>
                    <Bar value={w.utilization} />
                    {w.resetsAt && <small className="muted">{t('use.resets', { when: when(w.resetsAt) })}</small>}
                  </div>
                ))}
                <small className="muted">{t('use.updated', { ago: ago(g.limits.at) })}</small>
              </>
            ) : (
              <p className="muted small">{t('use.noLimitsYet')}</p>
            ))}
          {g.c.providerId === 'openrouter' &&
            (g.credits ? (
              <div className="usage-win">
                {g.credits.limit !== undefined && g.credits.limitRemaining !== undefined ? (
                  <>
                    <div className="usage-row">
                      <span>{t('use.credits')}</span>
                      <b>{t('use.left', { left: fmtUsd(g.credits.limitRemaining), of: fmtUsd(g.credits.limit) })}</b>
                    </div>
                    <Bar value={1 - g.credits.limitRemaining / g.credits.limit} />
                  </>
                ) : (
                  <div className="usage-row">
                    <span>{t('use.credits')}</span>
                    <b>{g.credits.isFreeTier ? t('use.freeTier') : t('use.noCap')}</b>
                  </div>
                )}
                <small className="muted">
                  {[g.credits.usageDaily !== undefined && `${t('use.today')} ${fmtUsd(g.credits.usageDaily)}`, g.credits.usageWeekly !== undefined && `${t('use.week7')} ${fmtUsd(g.credits.usageWeekly)}`, g.credits.usageMonthly !== undefined && `${t('use.month')} ${fmtUsd(g.credits.usageMonthly)}`].filter(Boolean).join(' · ') || (g.credits.usage !== undefined ? `${t('use.total')} ${fmtUsd(g.credits.usage)}` : '')}
                </small>
              </div>
            ) : (
              <p className="muted small">{t('use.creditsLoading')}</p>
            ))}
          {!g.plan && g.budget && g.month && (
            <div className="usage-win">
              <div className="usage-row">
                <span>{t('use.budget')}</span>
                <b>
                  {fmtUsd(g.month.cost ?? 0)} / {fmtUsd(g.budget)}
                </b>
              </div>
              <Bar value={(g.month.cost ?? 0) / g.budget} />
            </div>
          )}
          <dl className="usage-kv">
            {conversationId && (
              <>
                <dt>{t('use.thisChat')}</dt>
                <dd>{line(usage.chat(conversationId))}</dd>
              </>
            )}
            {agentId && (
              <>
                <dt>{agentName ?? t('use.agent')}</dt>
                <dd>
                  {t('use.today')} {line(usage.totals({ connectionId, agentId, days: 1 }))}
                  <br />
                  {t('use.d30')} {line(usage.totals({ connectionId, agentId, days: 30 }))}
                </dd>
              </>
            )}
            <dt>{t('use.today')}</dt>
            <dd>{line(today)}</dd>
            <dt>{t('use.d30')}</dt>
            <dd>{line(d30)}</dd>
          </dl>
          {g.plan && (today.cost !== undefined || d30.cost !== undefined) && <small className="muted">{t('use.listPrice')}</small>}
        </div>
      )}
    </div>
  );
}

/** Settings › Connections: a connection's usage — today, 7 and 30 days, by agent — and its budget */
export function ConnectionUsage({ connectionId }: { connectionId: string }) {
  const t = useT();
  const usage = useUsage();
  const st = useApp();
  const g = useUsageGauge(connectionId);
  const span = (days: number) => usage.totals({ connectionId, days });
  const agents = usage.byAgent({ connectionId, days: 30 }).slice(0, 6);
  const line = (u: UsageTotals) => `${fmtTokens(u.input + u.output)} ${t('use.tokens')}${u.cost !== undefined ? ` · ${fmtUsd(u.cost)}` : ''}`;
  return (
    <div className="conn-usage">
      <div className="conn-usage-head">
        <UsageRing connectionId={connectionId} />
        <b>{t('use.summary')}</b>
        <span className="muted">
          {t('use.today')} {line(span(1))} · {t('use.d7')} {line(span(7))} · {t('use.d30')} {line(span(30))}
        </span>
      </div>
      {agents.length > 0 && (
        <div className="conn-usage-agents">
          <small className="muted">{t('use.byAgent')} · {t('use.d30')}</small>
          {agents.map((a) => (
            <span key={a.agentId}>
              {st.characters.find((c) => c.id === a.agentId)?.name ?? a.agentId} <b>{line(a.totals)}</b>
            </span>
          ))}
        </div>
      )}
      {!g.plan && !g.free && (
        <label className="conn-usage-budget">
          <span>{t('use.budgetSet')}</span>
          <input type="number" min={0} step={1} placeholder={t('use.budgetNone')} defaultValue={g.budget ?? ''} onBlur={(e) => usage.setBudget(connectionId, e.target.value ? Number(e.target.value) : undefined)} />
        </label>
      )}
      <small className="muted">{t('use.summaryHint')}</small>
    </div>
  );
}

// Web in the UI (docs/WEB.md): the composer switch, the agent's "Web access", and under an
// answer the pages the run actually read (title, site, dates, which step read them) with
// "Save to Knowledge". Opening a page goes to the system browser through Rust (public
// http(s) only); nothing here renders web HTML.

import { Globe, TriangleAlert } from 'lucide-react';
import type { WebRunRecord, WebSource } from '../../domain/web';
import type { TKey } from '../../i18n';
import { useServices, useT, useWeb } from '../context';
import { AddToKnowledge } from '../knowledge/common';

const day = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString();
};
const when = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

/** the composer's globe: Web for this chat (or for the chat about to start) */
export function WebToggle({ on, onChange, disabled, strict }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean; strict?: boolean }) {
  const t = useT();
  const web = useWeb();
  const usable = web.available && !strict;
  return (
    <button
      type="button"
      className={`composer-tools composer-web ${on && usable ? 'on' : ''}`}
      aria-label={t('web.chatToggle')}
      aria-pressed={on && usable}
      disabled={disabled || !web.available}
      onClick={() => onChange(!on)}
      title={!web.available ? t('web.unavailable') : strict ? t('web.strictOff') : on ? t('web.chatOn') : t('web.chatOff')}
    >
      <Globe size={15} />
    </button>
  );
}

/** the agent inspector: may this agent read the web (off unless switched on) */
export function AgentWeb({ agentId, disabled }: { agentId: string; disabled?: boolean }) {
  const t = useT();
  const web = useWeb();
  const { live } = useServices();
  const on = !!live.agent(agentId)?.webAccess;
  return (
    <div className="agent-tools agent-web">
      <label className="tool-check">
        <input type="checkbox" checked={on} disabled={disabled || !web.available} onChange={(e) => live.updateAgent(agentId, { webAccess: e.target.checked })} />
        <span>{t('web.agentAccess')}</span>
      </label>
      <p className="muted small">{web.available ? t('web.agentHint') : t('web.unavailable')}</p>
      {on && !web.searchConfigured && <p className="muted small">{t('web.searchNoneShort')}</p>}
    </div>
  );
}

/** the pages an answer's run read, cited or not; failures and why the Web was not used */
export function WebSources({ record }: { record?: WebRunRecord }) {
  const t = useT();
  if (!record) return null;
  if (record.skipped)
    return (
      <p className="web-skipped muted small">
        <Globe size={12} /> {/STRICT/.test(record.skipped) ? t('web.skippedStrict') : t('web.skipped', { reason: record.skipped })}
      </p>
    );
  const failed = record.fetches.filter((f) => f.error);
  const searchErrors = record.searches.filter((s) => s.error);
  if (!record.sources.length && !failed.length && !searchErrors.length && !record.invalidLabels.length) return null;
  const cited = new Map(record.citations.map((c) => [c.label, c.n]));
  const v = record.verification;
  return (
    <div className="kn-cites web-cites">
      <div className="kn-cites-head">
        <Globe size={13} />
        <span>{t('web.sources', { n: record.sources.length })}</span>
        {v && record.citations.length > 0 && <span className={`kn-verdict ${v.verdict}`}>{t(`kn.verdict.${v.verdict}` as TKey)}</span>}
      </div>
      {record.sources.length > 0 && (
        <ul className="web-sources">
          {record.sources.map((s) => (
            <SourceRow key={s.label} s={s} n={cited.get(s.label)} />
          ))}
        </ul>
      )}
      {failed.map((f, i) => (
        <p key={`f${i}`} className="kn-warn">
          <TriangleAlert size={12} /> {t('web.notRead', { url: f.url, error: f.error ?? '' })}
        </p>
      ))}
      {searchErrors.map((s, i) => (
        <p key={`s${i}`} className="muted small">
          {t('web.searchFailed', { query: s.query, error: s.error === 'SEARCH_PROVIDER_NOT_CONFIGURED' ? t('web.searchNone') : (s.error ?? '') })}
        </p>
      ))}
      {record.invalidLabels.length > 0 && (
        <p className="kn-warn">
          <TriangleAlert size={12} /> {t('web.invalidLabels', { labels: record.invalidLabels.join(', ') })}
        </p>
      )}
      {v && (v.verdict === 'unsupported' || v.verdict === 'partially-supported') && (
        <p className="kn-warn">
          <TriangleAlert size={12} /> {t('kn.verifyNote', { mismatch: v.lexicalMismatch, uncited: v.uncitedFactual })}
        </p>
      )}
    </div>
  );
}

function SourceRow({ s, n }: { s: WebSource; n?: number }) {
  const t = useT();
  const web = useWeb();
  const { knowledge } = useServices();
  const facts = [
    s.domain,
    s.publishedAt && t('web.published', { date: day(s.publishedAt)! }),
    s.updatedAt && t('web.updated', { date: day(s.updatedAt)! }),
    s.author,
    t('web.readAt', { time: when(s.fetchedAt) }),
    s.via === 'prefetch' ? t('web.viaPrefetch') : 'web_fetch',
    s.retrievalMethod === 'rendered' ? t('web.rendered') : s.retrievalMethod === 'pdf' ? 'PDF' : undefined,
    s.cache === 'hit' ? t('web.fromCache') : undefined,
  ].filter(Boolean);
  // saving: the text read in this session, or the page read again (an explicit action, never automatic)
  const save = async (baseId: string) => {
    const page = web.cached(s.finalUrl) ?? (await web.fetchPage(s.finalUrl)).page;
    return knowledge.addWebPage(baseId, page);
  };
  return (
    <li className="web-source">
      <span className="web-n">{n ?? '·'}</span>
      <span className="web-source-main">
        <button type="button" className="link-btn" title={`${t('web.open')}: ${s.finalUrl}`} onClick={() => void web.open(s.finalUrl).catch(() => undefined)}>
          {s.title || s.finalUrl}
        </button>
        <small className="muted">{facts.join(' · ')}</small>
        <AddToKnowledge add={save} label={t('web.saveTo')} />
      </span>
    </li>
  );
}

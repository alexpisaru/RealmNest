// Shared Knowledge UI: privacy line, document status, mode switch, base picker,
// citations (labels → numbered chips, sources list with tombstones) and the
// grounding badge. Everything shown comes from KnowledgeService and the run's
// KnowledgeRunRecord; document text is shown only where the user opened it.

import { BookMarked, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { locationLabel, type Citation, type KnowledgeBase, type KnowledgeDocument, type KnowledgeMode, type KnowledgeRunRecord, type KnowledgeSelection } from '../../domain/knowledge';
import type { WebRunRecord } from '../../domain/web';
import type { TKey } from '../../i18n';
import { CITATION_LABELS } from '../../runtime/knowledge/grounding';
import { useConnectionLabel } from '../connections';
import { useCapabilities, useKnowledge, useServices, useT, useWeb } from '../context';
import { Button, Segmented } from '../kit';

export const MODES: KnowledgeMode[] = ['open', 'grounded', 'strict'];

/** where a base's text goes: nowhere (lexical) or to an embedding connection */
export function usePrivacyLine() {
  const t = useT();
  const labelOf = useConnectionLabel();
  const capabilities = useCapabilities();
  return (b: KnowledgeBase): { local: boolean; text: string } => {
    if (b.builtIn || b.settings.retrievalMode === 'lexical') return { local: true, text: '' };
    const id = b.embeddingIdentity;
    if (id) return { local: false, text: t('kn.viaEmbeddings', { connection: labelOf(id.connectionId), model: id.model }) };
    const choice = b.settings.embedding;
    const r = !choice || choice.connectionId === 'auto' ? capabilities.resolveRoute('embeddings.create') : undefined;
    const conn = choice && choice.connectionId !== 'auto' ? choice.connectionId : r?.target?.connectionId;
    const model = choice?.model ?? r?.target?.modelId;
    return { local: false, text: conn ? t('kn.viaEmbeddings', { connection: labelOf(conn), model: model ?? '?' }) : t('kn.noEmbeddingRoute') };
  };
}

export function DocStatus({ d }: { d: KnowledgeDocument }) {
  const t = useT();
  const tone = d.status === 'ready' ? (d.warning ? 'warn' : 'ok') : d.status === 'failed' ? 'bad' : d.status === 'stale' ? 'warn' : d.status === 'removed' ? 'off' : 'busy';
  const title = d.error?.message ?? d.staleReason ?? d.warning?.message;
  return (
    <span className={`kn-status ${tone}`} title={title}>
      {t(`kn.status.${d.status}` as TKey)}
      {d.status === 'ready' && d.warning ? ` · ${t('kn.wordsOnly')}` : ''}
    </span>
  );
}

export function ModeSwitch({ value, onChange, disabled }: { value: KnowledgeMode; onChange: (m: KnowledgeMode) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <div className={`kn-mode ${disabled ? 'disabled' : ''}`}>
      <Segmented value={value} onChange={(m) => !disabled && onChange(m)} label={t('kn.mode')} options={MODES.map((m) => ({ value: m, label: t(`kn.mode.${m}` as TKey) }))} />
      <small className="muted">{t(`kn.modeHint.${value}` as TKey)}</small>
    </div>
  );
}

/** tick bases (built-in first) */
export function BasePicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const t = useT();
  const knowledge = useKnowledge();
  const privacy = usePrivacyLine();
  const bases = knowledge.listBases();
  const gone = value.filter((id) => !knowledge.base(id));
  if (!bases.length) return <p className="muted small">{t('kn.noBases')}</p>;
  return (
    <ul className="tool-list compact kn-pick">
      {bases.map((b) => {
        const on = value.includes(b.id);
        const s = knowledge.stats(b.id);
        return (
          <li key={b.id} className={on ? 'on' : ''}>
            <label className="tool-check" title={b.description}>
              <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [...new Set([...value, b.id])] : value.filter((x) => x !== b.id))} />
              <span className="kn-pick-text">
                <span>{b.name}</span>
                <small className="muted">
                  {s.documents === 1 ? t('w.oneDoc') : t('kn.docsCount', { n: s.documents })}{privacy(b).text ? ` · ${privacy(b).text}` : ''}
                </small>
              </span>
            </label>
          </li>
        );
      })}
      {gone.map((id) => (
        <li key={id} className="on off">
          <label className="tool-check">
            <input type="checkbox" checked disabled={disabled} onChange={() => onChange(value.filter((x) => x !== id))} />
            <span className="muted">{t('kn.baseGone')}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** the chat composer's Knowledge control: which bases, which mode (compact; opens a small panel) */
export function KnowledgeControl({ value, onChange, disabled }: { value?: KnowledgeSelection; onChange: (v: KnowledgeSelection | undefined) => void; disabled?: boolean }) {
  const t = useT();
  const { store } = useServices();
  const knowledge = useKnowledge();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const ids = value?.baseIds.filter((id) => knowledge.base(id)) ?? [];
  const mode = value?.mode ?? 'grounded';
  const set = (baseIds: string[], m: KnowledgeMode = mode) => onChange(baseIds.length ? { baseIds, mode: m } : undefined);
  const label = ids.length ? (ids.length === 1 ? knowledge.base(ids[0])!.name : t('kn.basesN', { n: ids.length })) : '';
  return (
    <span className="kn-control" ref={box}>
      <button
        type="button"
        className={`composer-tools kn-btn ${ids.length ? 'on' : ''}`}
        aria-label={t('kn.control')}
        aria-expanded={open}
        aria-pressed={ids.length > 0}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={ids.length ? `${t('kn.control')}: ${label} · ${t(`kn.mode.${mode}` as TKey)}` : t('kn.controlOff')}
      >
        <BookMarked size={15} />
        {ids.length > 0 && <span className="kn-btn-label">{label}</span>}
      </button>
      {open && (
        <div className="kn-pop" role="dialog" aria-label={t('kn.control')}>
          <b>{t('kn.control')}</b>
          <BasePicker value={ids} onChange={(next) => set(next)} disabled={disabled} />
          {ids.length > 0 && <ModeSwitch value={mode} onChange={(m) => set(ids, m)} disabled={disabled} />}
          <button type="button" className="link-btn" onClick={() => (setOpen(false), store.openKnowledge())}>
            {t('kn.manage')}
          </button>
        </div>
      )}
    </span>
  );
}


/** the answer with [K3] / [W2] turned into citation chips (documents open in Knowledge, pages in the browser) */
export function CitedText({ text, record, web, render }: { text: string; record?: KnowledgeRunRecord; web?: WebRunRecord; render: (plain: string) => ReactNode }) {
  const { store } = useServices();
  const webService = useWeb();
  const webOn = !!web && !web.skipped;
  if (!record && !webOn) return <>{render(text)}</>;
  const by = new Map(record?.citations.map((c) => [c.label, c]));
  const pages = new Map(web?.citations.map((c) => [c.label, c]));
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(CITATION_LABELS)) {
    out.push(<span key={k++}>{render(text.slice(last, m.index))}</span>);
    for (const label of m[1].split(/[,;，、]/).map((l) => l.trim().toUpperCase())) {
      if (label.startsWith('W')) {
        const w = pages.get(label);
        out.push(
          w ? (
            <button key={k++} type="button" className="cite web" onClick={() => void webService.open(w.finalUrl).catch(() => undefined)} title={`${w.title ? `${w.title} · ` : ''}${w.domain}`}>
              {w.n}
            </button>
          ) : webOn ? (
            <span key={k++} className="cite bad" title={label}>
              ?
            </span>
          ) : (
            <span key={k++}>[{label}]</span>
          ),
        );
        continue;
      }
      if (!record) {
        out.push(<span key={k++}>[{label}]</span>);
        continue;
      }
      const c = by.get(label);
      out.push(
        c ? (
          <button key={k++} type="button" className="cite" onClick={() => store.openKnowledge({ baseId: c.knowledgeBaseId, documentId: c.documentId, chunkId: c.chunkId })} title={`${c.documentName}${locationLabel(c.location) ? ` · ${locationLabel(c.location)}` : ''}`}>
            {c.n}
          </button>
        ) : (
          <span key={k++} className="cite bad" title={label}>
            ?
          </span>
        ),
      );
    }
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(<span key={k++}>{render(text.slice(last))}</span>);
  return <>{out}</>;
}

/** the sources an answer cited (tombstones when the document or base is gone) and the grounding check */
export function CitationPanel({ record }: { record?: KnowledgeRunRecord }) {
  const t = useT();
  const knowledge = useKnowledge();
  const { store } = useServices();
  if (!record) return null;
  const v = record.verification;
  const lexicalOnly = record.queries.some((q) => q.lexicalOnly);
  const names = record.baseIds.map((id) => knowledge.base(id)?.name ?? t('kn.baseGone'));
  return (
    <div className="kn-cites">
      <div className="kn-cites-head">
        <BookMarked size={13} />
        <span>
          {names.join(', ')} · {t(`kn.mode.${record.mode}` as TKey)}
        </span>
        {v && <span className={`kn-verdict ${v.verdict}`}>{t(`kn.verdict.${v.verdict}` as TKey)}</span>}
        {lexicalOnly && <span className="kn-verdict partially-supported">{t('kn.wordsOnly')}</span>}
      </div>
      {record.citations.length > 0 && (
        <ol className="kn-sources">
          {record.citations.map((c) => (
            <SourceItem key={c.label} c={c} gone={!knowledge.document(c.documentId) || !!knowledge.document(c.documentId)!.removedAt} onOpen={() => store.openKnowledge({ baseId: c.knowledgeBaseId, documentId: c.documentId, chunkId: c.chunkId })} />
          ))}
        </ol>
      )}
      {record.invalidLabels.length > 0 && (
        <p className="kn-warn">
          <TriangleAlert size={12} /> {t('kn.invalidLabels', { labels: record.invalidLabels.join(', ') })}
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

function SourceItem({ c, gone, onOpen }: { c: Citation; gone: boolean; onOpen: () => void }) {
  const t = useT();
  const where = locationLabel(c.location);
  return (
    <li value={c.n} className={gone ? 'gone' : ''} title={c.excerpt}>
      {gone ? (
        <span>
          {c.documentName}
          {where ? ` · ${where}` : ''} <small className="muted">({t('kn.sourceRemoved')})</small>
        </span>
      ) : (
        <button type="button" className="link-btn" onClick={onOpen}>
          {c.documentName}
          {where ? ` · ${where}` : ''}
        </button>
      )}
      <small className="kn-excerpt">{c.excerpt}</small>
    </li>
  );
}

/** "Add to Knowledge": pick a base (or make one) and add a stored file to it */
export function AddToKnowledge({ add, disabled, label, tone }: { add: (baseId: string) => Promise<unknown>; disabled?: boolean; label?: string; tone?: 'ghost' }) {
  const t = useT();
  const knowledge = useKnowledge();
  const { store } = useServices();
  const bases = knowledge.listBases().filter((b) => !b.builtIn);
  const [open, setOpen] = useState(false);
  const [baseId, setBaseId] = useState('');
  const [msg, setMsg] = useState('');
  if (!open)
    return (
      <Button size="sm" {...(tone && { tone })} icon={<BookMarked size={14} />} disabled={disabled} onClick={() => (setOpen(true), setBaseId(bases[0]?.id ?? ''), setMsg(''))}>
        {label ?? t('kn.addTo')}
      </Button>
    );
  return (
    <span className="kn-addto">
      {bases.length ? (
        <>
          <select aria-label={t('kn.pickBase')} value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            tone="primary"
            disabled={!baseId}
            onClick={() =>
              add(baseId)
                .then(() => setMsg(t('kn.added', { base: knowledge.base(baseId)?.name ?? '' })))
                .catch((e) => setMsg(e instanceof Error ? e.message : String(e)))
            }
          >
            {t('kn.add')}
          </Button>
        </>
      ) : (
        <button type="button" className="link-btn" onClick={() => store.openKnowledge()}>
          {t('kn.createFirst')}
        </button>
      )}
      <button type="button" className="link-btn" onClick={() => setOpen(false)}>
        {t('creator.cancel')}
      </button>
      {msg && <small className="muted">{msg}</small>}
    </span>
  );
}

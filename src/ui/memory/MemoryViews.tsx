// Memory UI pieces shared by Chat, the agent panel and the Memory screen: what a run used
// ("Used 2 memories"), what it proposed ("2 memories proposed · Review"), the review
// surface (Remember / Edit / Reject; existing vs proposed for updates and conflicts),
// and the agent inspector's Memory section. Nothing here saves a memory on its own.

import { Brain, Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { MEMORY_TYPES, type MemoryEntry, type MemoryMode, type MemoryProposal, type MemoryRunRecord, type MemoryType } from '../../domain/memory';
import type { TKey } from '../../i18n';
import { useConnectionLabel } from '../connections';
import { useMemory, useServices, useT } from '../context';
import { Button, Modal } from '../kit';

export const typeLabel = (t: (k: TKey) => string, type: MemoryType) => t(`mem.type.${type}` as TKey);

/** "Used 2 memories" under a reply or a task result, expandable */
export function MemoryUsed({ record }: { record?: MemoryRunRecord }) {
  const t = useT();
  const memory = useMemory();
  const { store } = useServices();
  const [open, setOpen] = useState(false);
  if (!record?.retrieved.length) return null;
  return (
    <div className="mem-used">
      <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Brain size={13} /> {t(record.retrieved.length === 1 ? 'mem.used1' : 'mem.used', { n: record.retrieved.length })}
        {record.searches.some((x) => x.semantic) ? ` · ${t('mem.byMeaning')}${record.embeddingModel ? ` (${record.embeddingModel})` : ''}` : ''}
      </button>
      {open && (
        <ul>
          {record.retrieved.map((r) => {
            const e = memory.get(r.entryId);
            const gone = !e || e.status === 'deleted';
            return (
              <li key={r.entryId}>
                <b>{r.label}</b> <small className="muted">{typeLabel(t, r.type)}</small>{' '}
                {gone ? (
                  <span className="muted">{t('mem.deletedSince')}</span>
                ) : (
                  <button type="button" className="link-btn" onClick={() => store.openMemory({ agentId: record.agentId, entryId: r.entryId })}>
                    {e.content}
                  </button>
                )}
                {e && e.status !== 'active' && !gone && <small className="muted"> ({t(`mem.status.${e.status}` as TKey)})</small>}
                {!r.proactive && <small className="muted"> · search_memory</small>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "2 memories proposed · Review" after a run (never a blocking modal) */
export function MemoryProposed({ runId }: { runId?: string }) {
  const t = useT();
  const memory = useMemory();
  const [open, setOpen] = useState(false);
  if (!runId) return null;
  const x = memory.extraction(runId);
  const pending = memory.proposalsForRun(runId).filter((p) => p.status === 'pending');
  if (x?.status === 'running') return <div className="mem-proposed muted small">{t('mem.extracting')}</div>;
  if (!pending.length) return null;
  return (
    <div className="mem-proposed">
      <Brain size={13} />
      <span>{t(pending.length === 1 ? 'mem.proposed1' : 'mem.proposedN', { n: pending.length })}</span>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        {t('mem.review')}
      </button>
      {open && <ReviewModal proposals={pending} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function ReviewModal({ proposals, onClose }: { proposals: MemoryProposal[]; onClose: () => void }) {
  const t = useT();
  const memory = useMemory();
  const [error, setError] = useState('');
  const live = proposals.map((p) => memory.proposal(p.id) ?? p).filter((p) => p.status === 'pending');
  const run = (f: () => Promise<unknown>) => {
    setError('');
    f().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  return (
    <Modal onClose={onClose} title={t('mem.reviewTitle')} wide>
      <div className="modal-head">
        <h2>{t('mem.reviewTitle')}</h2>
      </div>
      <div className="modal-body mem-review">
        <p className="muted small">{t('mem.reviewHint')}</p>
        {!live.length && <p className="muted">{t('mem.nothingPending')}</p>}
        {live.map((p) => (
          <ProposalCard key={p.id} p={p} onError={setError} />
        ))}
        {error && <p className="live-error">{error}</p>}
        {live.length > 1 && (
          <div className="row end">
            <Button size="sm" tone="ghost" onClick={() => run(() => memory.rejectAll(live.map((p) => p.id)))}>
              {t('mem.rejectAll')}
            </Button>
            <Button size="sm" tone="primary" onClick={() => run(() => memory.approveAll(live.map((p) => p.id)))} title={t('mem.rememberAllHint')}>
              {t('mem.rememberAll')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ProposalCard({ p, onError }: { p: MemoryProposal; onError: (m: string) => void }) {
  const t = useT();
  const memory = useMemory();
  const labelOf = useConnectionLabel();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(p.content);
  const [type, setType] = useState<MemoryType>(p.type);
  const existing = p.existingId ? memory.get(p.existingId) : undefined;
  const run = (f: () => Promise<unknown>) => {
    onError('');
    f().catch((e) => onError(e instanceof Error ? e.message : String(e)));
  };
  const edit = editing ? { content, type } : undefined;
  const change = (p.relation === 'update' || p.relation === 'conflict') && existing?.status === 'active';
  return (
    <section className={`mem-card ${p.relation}`}>
      <header>
        <span className="mem-type">{typeLabel(t, p.type)}</span>
        {p.relation !== 'new' && <span className={`mem-rel ${p.relation}`}>{t(`mem.rel.${p.relation}` as TKey)}</span>}
        <small className="muted">
          {t(`mem.src.${p.source.sourceType}` as TKey)} · {new Date(p.createdAt).toLocaleString()}
          {p.source.connectionId ? ` · ${labelOf(p.source.connectionId)}${p.source.modelId ? ` ${p.source.modelId}` : ''}` : ''}
        </small>
      </header>
      {change && (
        <div className="mem-compare">
          <div>
            <small className="muted">{t('mem.existing')}</small>
            <p>{existing!.content}</p>
          </div>
          <div>
            <small className="muted">{t('mem.proposed')}</small>
            <p>{p.content}</p>
          </div>
        </div>
      )}
      {editing ? (
        <div className="mem-edit">
          <select value={type} onChange={(e) => setType(e.target.value as MemoryType)} aria-label={t('mem.typeLabel')}>
            {MEMORY_TYPES.map((x) => (
              <option key={x} value={x}>
                {typeLabel(t, x)}
              </option>
            ))}
          </select>
          <textarea value={content} rows={2} maxLength={400} onChange={(e) => setContent(e.target.value)} aria-label={t('mem.content')} />
        </div>
      ) : (
        !change && <p className="mem-content">{p.content}</p>
      )}
      {p.reason && <small className="muted">{t('mem.why')}: {p.reason}</small>}
      {p.source.quote && <small className="mem-quote">“{p.source.quote}”</small>}
      <div className="row mem-actions">
        <Button size="sm" tone="ghost" icon={<X size={13} />} onClick={() => run(() => memory.reject(p.id))}>
          {t('mem.reject')}
        </Button>
        {!editing && (
          <Button size="sm" tone="ghost" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>
            {t('mem.edit')}
          </Button>
        )}
        {change ? (
          <>
            <Button size="sm" onClick={() => run(() => memory.approve(p.id, { resolution: 'keep-existing' }))}>
              {t('mem.keepExisting')}
            </Button>
            <Button size="sm" onClick={() => run(() => memory.approve(p.id, { resolution: 'keep-both', ...(edit && { edit }) }))}>
              {t('mem.keepBoth')}
            </Button>
            <Button size="sm" tone="primary" onClick={() => run(() => memory.approve(p.id, { resolution: 'replace', ...(edit && { edit }) }))}>
              {t('mem.replace')}
            </Button>
          </>
        ) : (
          <Button size="sm" tone="primary" icon={<Check size={13} />} onClick={() => run(() => memory.approve(p.id, edit ? { edit } : {}))}>
            {t('mem.remember')}
          </Button>
        )}
      </div>
    </section>
  );
}

/** the agent inspector's Memory section: mode, counts, Manage (contents stay on the Memory screen) */
export function AgentMemory({ agentId, disabled }: { agentId: string; disabled?: boolean }) {
  const t = useT();
  const memory = useMemory();
  const { live, store } = useServices();
  const settings = memory.settings(agentId);
  const c = memory.counts(agentId);
  const [review, setReview] = useState(false);
  const set = (patch: Partial<typeof settings>) => live.updateAgent(agentId, { memory: { ...settings, ...patch } });
  return (
    <div className="agent-tools agent-memory">
      <label className="mem-mode">
        <span>{t('mem.mode')}</span>
        <select value={settings.mode} disabled={disabled} onChange={(e) => set({ mode: e.target.value as MemoryMode })} aria-label={t('mem.mode')}>
          <option value="off">{t('mem.mode.off')}</option>
          <option value="review">{t('mem.mode.review')}</option>
          <option value="automatic">{t('mem.mode.automatic')}</option>
        </select>
      </label>
      {settings.mode === 'automatic' && <p className="kn-warn">{t('mem.autoWarning')}</p>}
      {settings.mode !== 'off' && (
        <label className="tool-check" title={t('mem.embeddingsHint')}>
          <input type="checkbox" checked={!!settings.useEmbeddings} disabled={disabled} onChange={(e) => set({ useEmbeddings: e.target.checked })} />
          <span>{t('mem.useEmbeddings')}</span>
        </label>
      )}
      {settings.useEmbeddings && settings.mode !== 'off' && <p className="kn-privacy remote">{t('mem.embeddingsHint')}</p>}
      <p className="muted small">
        {t('mem.activeN', { n: c.active })} · {t('mem.pendingN', { n: c.pending })}
      </p>
      <div className="row">
        {c.pending > 0 && (
          <Button size="sm" tone="primary" onClick={() => setReview(true)}>
            {t('mem.review')}
          </Button>
        )}
        <Button size="sm" onClick={() => store.openMemory({ agentId })}>
          {t('mem.manage')}
        </Button>
      </div>
      {review && <ReviewModal proposals={memory.pending(agentId)} onClose={() => setReview(false)} />}
    </div>
  );
}

export function entrySource(t: (k: TKey, v?: Record<string, string | number>) => string, e: MemoryEntry): string {
  return `${t(`mem.src.${e.source.sourceType}` as TKey)}${e.source.proposedByModel ? ` · ${t('mem.approvedByYou')}` : ''} · ${new Date(e.createdAt).toLocaleDateString()}`;
}

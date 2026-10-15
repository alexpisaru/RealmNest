// Memory (docs/MEMORY.md): what each agent remembers, and what it proposed. Per agent: the
// memory mode, Active / Pending / Superseded / Expired views, search and filters, a memory's
// source ("why does RealmNest remember this?"), edit (provenance kept), expire, delete, add by
// hand, export (Markdown / JSON) and import (as proposals to review).

import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MEMORY_TYPES, type MemoryEntry, type MemoryImportance, type MemoryType } from '../../domain/memory';
import type { TKey } from '../../i18n';
import { MemoryError } from '../../runtime/memory/service';
import { useConnectionLabel } from '../connections';
import { useApp, useMemory, useServices, useT } from '../context';
import { Button, Modal, Segmented } from '../kit';
import { AgentMemory, entrySource, ProposalCard, typeLabel } from '../memory/MemoryViews';

type View = 'active' | 'pending' | 'superseded' | 'expired';
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dateInput = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : '');

export function MemoryScreen() {
  const t = useT();
  const st = useApp();
  const memory = useMemory();
  const { files, store } = useServices();
  const agents = st.characters;
  const [agentId, setAgentId] = useState(st.memoryFocus.agentId ?? agents[0]?.id ?? '');
  const [view, setView] = useState<View>(st.memoryFocus.view ?? 'active');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<MemoryType | ''>('');
  const [tag, setTag] = useState('');
  const [since, setSince] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (st.memoryFocus.agentId) setAgentId(st.memoryFocus.agentId);
    if (st.memoryFocus.view) setView(st.memoryFocus.view);
  }, [st.memoryFocus]);
  const name = agents.find((a) => a.id === agentId)?.name ?? agentId;
  const counts = agentId ? memory.counts(agentId) : undefined;
  const list = agentId && view !== 'pending' ? memory.list({ agentId, status: view, ...(type && { type }), ...(tag && { tag }), ...(query && { query }), ...(since && { since: new Date(since).getTime() }) }) : [];
  const pending = agentId && view === 'pending' ? memory.pending(agentId) : [];
  const tags = agentId ? [...new Set(memory.list({ agentId }).flatMap((e) => e.tags))].sort() : [];
  const run = (f: () => Promise<unknown>) => {
    setError('');
    setNote('');
    f().catch((e) => setError(message(e)));
  };
  const exportAs = (format: 'markdown' | 'json') =>
    run(async () => {
      const text = memory.exportMemories(agentId, format, name);
      const stored = await files.put(new TextEncoder().encode(text));
      const path = await files.exportCopy(stored.storageRef, `${t('p.mem.exportName', { name })}.${format === 'json' ? 'json' : 'md'}`);
      if (path) setNote(t('mem.exported', { path }));
    });

  return (
    <div className="memory-screen panel-glass">
      <header className="section-head">
        <div>
          <h1 className="display">{t('mem.title')}</h1>
          <p className="muted">{t('mem.sub')}</p>
        </div>
        <div className="row">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label={t('mem.agent')}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button tone="primary" icon={<Plus size={15} />} disabled={!agentId} onClick={() => setAdding(true)}>
            {t('mem.add')}
          </Button>
        </div>
      </header>
      {agentId && (
        <>
          <div className="mem-agent-bar">
            <AgentMemory agentId={agentId} />
            <div className="row">
              <Button size="sm" icon={<Download size={14} />} disabled={!counts?.active} onClick={() => exportAs('markdown')}>
                {t('mem.exportMd')}
              </Button>
              <Button size="sm" icon={<Download size={14} />} disabled={!counts?.active} onClick={() => exportAs('json')}>
                {t('mem.exportJson')}
              </Button>
              <Button size="sm" icon={<Upload size={14} />} onClick={() => picker.current?.click()} title={t('mem.importHint')}>
                {t('mem.import')}
              </Button>
              <input
                ref={picker}
                type="file"
                hidden
                accept=".json,application/json"
                aria-label={t('mem.import')}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) run(async () => {
                    const r = await memory.importMemories(agentId, await f.text());
                    setNote(t('mem.imported', { n: r.proposals, refused: r.refused }));
                    setView('pending');
                  });
                }}
              />
            </div>
          </div>
          <Segmented
            value={view}
            onChange={setView}
            label={t('mem.view')}
            options={[
              { value: 'active', label: `${t('mem.view.active')} · ${counts?.active ?? 0}` },
              { value: 'pending', label: `${t('mem.view.pending')} · ${counts?.pending ?? 0}` },
              { value: 'superseded', label: `${t('mem.view.superseded')} · ${counts?.superseded ?? 0}` },
              { value: 'expired', label: `${t('mem.view.expired')} · ${counts?.expired ?? 0}` },
            ]}
          />
          {view !== 'pending' && (
            <div className="row mem-filters">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mem.search')} aria-label={t('mem.search')} />
              <select value={type} onChange={(e) => setType(e.target.value as MemoryType | '')} aria-label={t('mem.typeLabel')}>
                <option value="">{t('mem.allTypes')}</option>
                {MEMORY_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {typeLabel(t, x)}
                  </option>
                ))}
              </select>
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t('mem.tag')}>
                <option value="">{t('mem.allTags')}</option>
                {tags.map((x) => (
                  <option key={x} value={x}>
                    #{x}
                  </option>
                ))}
              </select>
              <label className="mem-since">
                <span>{t('mem.since')}</span>
                <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </label>
            </div>
          )}
          {error && <p className="live-error">{error}</p>}
          {note && <p className="muted small">{note}</p>}
          {view === 'pending' ? (
            <div className="mem-review">
              {!pending.length && <p className="muted">{t('mem.nothingPending')}</p>}
              {pending.map((p) => (
                <ProposalCard key={p.id} p={p} onError={setError} />
              ))}
            </div>
          ) : (
            <ul className="mem-list">
              {!list.length && <li className="muted">{t('mem.empty')}</li>}
              {list.map((e) => (
                <EntryRow key={e.id} e={e} focus={st.memoryFocus.entryId === e.id} onEdit={() => setEditing(e)} onError={setError} onSource={() => e.source.conversationId && store.openChat(e.source.conversationId)} />
              ))}
            </ul>
          )}
        </>
      )}
      {!agents.length && <p className="muted">{t('mem.noAgents')}</p>}
      {(adding || editing) && <EntryForm agentId={agentId} entry={editing ?? undefined} onClose={() => (setAdding(false), setEditing(null))} />}
    </div>
  );
}

function EntryRow({ e, focus, onEdit, onError, onSource }: { e: MemoryEntry; focus: boolean; onEdit: () => void; onError: (m: string) => void; onSource: () => void }) {
  const t = useT();
  const memory = useMemory();
  const labelOf = useConnectionLabel();
  const [confirm, setConfirm] = useState(false);
  const [why, setWhy] = useState(focus);
  const run = (f: () => Promise<unknown>) => {
    onError('');
    f().catch((x) => onError(message(x)));
  };
  const replaced = e.supersededById ? memory.get(e.supersededById) : undefined;
  const replaces = e.supersedesId ? memory.get(e.supersedesId) : undefined;
  return (
    <li className={`mem-row ${focus ? 'focus' : ''}`}>
      <div className="mem-row-main">
        <span className="mem-type">{typeLabel(t, e.type)}</span>
        {e.importance !== 'normal' && <span className="mem-rel">{t(`mem.importance.${e.importance}` as TKey)}</span>}
        <p className="mem-content">{e.content}</p>
        <small className="muted">
          {entrySource(t, e)}
          {e.tags.length ? ` · ${e.tags.map((x) => `#${x}`).join(' ')}` : ''}
          {e.expiresAt ? ` · ${t('mem.expires', { date: new Date(e.expiresAt).toLocaleDateString() })}` : ''}
          {e.lastUsedAt ? ` · ${t('mem.lastUsed', { date: new Date(e.lastUsedAt).toLocaleString() })}` : ''}
        </small>
        {replaced && <small className="muted">{t('mem.replacedBy', { text: replaced.content })}</small>}
        {replaces && <small className="muted">{t('mem.replaces', { text: replaces.content || t('mem.deletedSince') })}</small>}
        {why && (
          <dl className="kv mem-why">
            <dt>{t('mem.source')}</dt>
            <dd>
              {t(`mem.src.${e.source.sourceType}` as TKey)}
              {e.source.conversationId && (
                <>
                  {' · '}
                  <button type="button" className="link-btn" onClick={onSource}>
                    {t('mem.openChat')}
                  </button>
                </>
              )}
              {e.source.taskId ? ` · task ${e.source.taskId}` : ''}
            </dd>
            {e.source.runId && (
              <>
                <dt>{t('mem.run')}</dt>
                <dd className="mono small">{e.source.runId}</dd>
              </>
            )}
            {e.source.proposedByModel && (
              <>
                <dt>{t('mem.proposedBy')}</dt>
                <dd>
                  {e.source.connectionId ? labelOf(e.source.connectionId) : ''} {e.source.modelId ?? ''} · {t('mem.approvedByYou')}
                </dd>
              </>
            )}
            {e.source.quote && (
              <>
                <dt>{t('mem.said')}</dt>
                <dd>“{e.source.quote}”</dd>
              </>
            )}
            {e.revisions?.length ? (
              <>
                <dt>{t('mem.original')}</dt>
                <dd>
                  {e.revisions[0].content} <small className="muted">({t('mem.editedOn', { date: new Date(e.revisions[e.revisions.length - 1].editedAt).toLocaleString() })})</small>
                </dd>
              </>
            ) : null}
          </dl>
        )}
      </div>
      <div className="mem-row-actions">
        <button type="button" className="link-btn" onClick={() => setWhy((v) => !v)}>
          {t('mem.viewSource')}
        </button>
        {e.status === 'active' && (
          <>
            <button type="button" className="link-btn" onClick={onEdit}>
              {t('mem.edit')}
            </button>
            <button type="button" className="link-btn" onClick={() => run(() => memory.expire(e.id))}>
              {t('mem.expire')}
            </button>
          </>
        )}
        {confirm ? (
          <span className="history-confirm">
            <button type="button" className="link-btn danger" onClick={() => run(() => memory.delete(e.id))}>
              {t('mem.delete')}
            </button>
            <button type="button" className="link-btn" onClick={() => setConfirm(false)}>
              {t('creator.cancel')}
            </button>
          </span>
        ) : (
          <button type="button" className="icon-btn" aria-label={t('mem.delete')} title={t('mem.delete')} onClick={() => setConfirm(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

/** add a memory by hand (active at once), or edit one (its source is kept) */
function EntryForm({ agentId, entry, onClose }: { agentId: string; entry?: MemoryEntry; onClose: () => void }) {
  const t = useT();
  const memory = useMemory();
  const [type, setType] = useState<MemoryType>(entry?.type ?? 'preference');
  const [content, setContent] = useState(entry?.content ?? '');
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '');
  const [importance, setImportance] = useState<MemoryImportance>(entry?.importance ?? 'normal');
  const [expires, setExpires] = useState(dateInput(entry?.expiresAt));
  const [error, setError] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const save = async () => {
    setError('');
    const base = { type, content, tags: tags.split(',').map((x) => x.trim()).filter(Boolean), importance, confirmSensitive: sensitive };
    const expiresAt = expires ? new Date(`${expires}T23:59:59`).getTime() : undefined;
    try {
      if (entry) await memory.edit(entry.id, { ...base, expiresAt: expiresAt ?? null });
      else await memory.add(agentId, { ...base, ...(expiresAt && { expiresAt }) });
      onClose();
    } catch (e) {
      // sensitive personal data: saved only after an explicit tick
      if (e instanceof MemoryError && e.code === 'SENSITIVE_NEEDS_CONFIRMATION') setNeedsConfirm(true);
      setError(message(e));
    }
  };
  return (
    <Modal onClose={onClose} title={entry ? t('mem.editTitle') : t('mem.addTitle')}>
      <div className="modal-head">
        <h2>{entry ? t('mem.editTitle') : t('mem.addTitle')}</h2>
      </div>
      <div className="modal-body kn-form">
        <label>
          <span>{t('mem.typeLabel')}</span>
          <select value={type} onChange={(e) => setType(e.target.value as MemoryType)}>
            {MEMORY_TYPES.map((x) => (
              <option key={x} value={x}>
                {typeLabel(t, x)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('mem.content')}</span>
          <textarea value={content} rows={3} maxLength={400} onChange={(e) => setContent(e.target.value)} autoFocus placeholder={t('p.mem.contentPh')} />
        </label>
        <label>
          <span>{t('mem.tags')}</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('p.mem.tagsPh')} />
        </label>
        <div className="row">
          <label>
            <span>{t('mem.importance')}</span>
            <select value={importance} onChange={(e) => setImportance(e.target.value as MemoryImportance)}>
              {(['low', 'normal', 'high'] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`mem.importance.${x}` as TKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('mem.expiresOn')}</span>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
        </div>
        <p className="muted small">{t('mem.manualNote')}</p>
        {error && <p className="live-error">{error}</p>}
        {needsConfirm && (
          <label className="tool-check">
            <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
            <span>{t('mem.sensitiveYes')}</span>
          </label>
        )}
        <div className="row end">
          <Button tone="ghost" onClick={onClose}>
            {t('creator.cancel')}
          </Button>
          <Button tone="primary" disabled={!content.trim() || (needsConfirm && !sensitive)} onClick={() => void save()}>
            {t('kn.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

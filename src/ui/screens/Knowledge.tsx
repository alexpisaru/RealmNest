// Knowledge (docs/KNOWLEDGE.md): bases of documents the user indexed on purpose. Cards with
// what each base holds and where its text goes (local only, or an embedding connection);
// a base's documents with their status and actions; a document's chunks with their
// locations (a citation opens here, on its chunk). Sources are never deleted from here:
// removing a document drops it from the base, the file stays where it came from.

import { ArrowLeft, BookMarked, FilePlus2, Layers, Paperclip, Plus, RefreshCw, Search, Settings2, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes } from '../../domain/attachment';
import { locationLabel, type EmbeddingChoice, type KnowledgeBase, type KnowledgeChunk, type KnowledgeDocument, type RetrievalMode } from '../../domain/knowledge';
import type { TKey } from '../../i18n';
import { KNOWLEDGE_LIMITS, type SearchResult } from '../../runtime/knowledge/service';
import { useConnectionLabel } from '../connections';
import { useApp, useCapabilities, useKnowledge, useServices, useT } from '../context';
import { useArtifacts } from '../files/FileViews';
import { DocStatus, usePrivacyLine } from '../knowledge/common';
import { Button, Modal, Segmented } from '../kit';

const ACCEPT = '.pdf,.md,.markdown,.txt,.csv,.tsv,.json,.jsonl,.docx,.log,.yaml,.yml,text/*,application/pdf';
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** a picked file's bytes, refused by its size BEFORE it is read into memory */
const readPicked = async (f: File, tooLarge: string) => {
  if (f.size > KNOWLEDGE_LIMITS.documentBytes) throw new Error(tooLarge);
  return new Uint8Array(await f.arrayBuffer());
};

export function KnowledgeScreen() {
  const t = useT();
  const st = useApp();
  const knowledge = useKnowledge();
  const privacy = usePrivacyLine();
  const [open, setOpen] = useState<string | null>(st.knowledgeFocus.baseId ?? null);
  const [creating, setCreating] = useState(false);
  useEffect(() => setOpen(st.knowledgeFocus.baseId ?? null), [st.knowledgeFocus]);
  const base = open ? knowledge.base(open) : undefined;
  if (base) return <BaseDetail base={base} onBack={() => setOpen(null)} />;
  const bases = knowledge.listBases();
  return (
    <div className="knowledge-screen panel-glass">
      <header className="section-head">
        <div>
          <h1 className="display">{t('kn.title')}</h1>
          <p className="muted">{t('kn.sub')}</p>
        </div>
        <Button tone="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          {t('kn.new')}
        </Button>
      </header>
      <div className="kn-grid">
        {bases.map((b) => {
          const s = knowledge.stats(b.id);
          const p = privacy(b);
          return (
            <button key={b.id} className="kn-card" onClick={() => setOpen(b.id)}>
              <span className="kn-card-head">
                <BookMarked size={18} />
                <b>{b.name}</b>
                {b.builtIn && <span className="skill-origin">{t('kn.builtIn')}</span>}
              </span>
              {(b.builtIn || b.description) && <small className="kn-card-desc">{b.builtIn ? t('kn.docsDesc') : b.description}</small>}
              <small className="muted">
                {s.documents === 1 ? t('w.oneDoc') : t('kn.docsCount', { n: s.documents })} · {t('kn.chunksCount', { n: s.chunks })}
                {s.bytes ? ` · ${formatBytes(s.bytes)}` : ''}
              </small>
              {p.text && <small className="kn-privacy remote">{p.text}</small>}
              <span className="kn-card-states">
                {s.busy > 0 && <span className="kn-status busy">{t('kn.indexingN', { n: s.busy })}</span>}
                {s.failed > 0 && <span className="kn-status bad">{t('kn.failedN', { n: s.failed })}</span>}
                {s.stale > 0 && <span className="kn-status warn">{t('kn.staleN', { n: s.stale })}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {bases.filter((b) => !b.builtIn).length === 0 && <p className="muted">{t('kn.empty')}</p>}
      {creating && <BaseSettings onClose={() => setCreating(false)} onSaved={(id) => (setCreating(false), setOpen(id))} />}
    </div>
  );
}

/** create a base, or change one (a different retrieval or embedding model needs a re-index) */
function BaseSettings({ base, onClose, onSaved }: { base?: KnowledgeBase; onClose: () => void; onSaved: (id: string) => void }) {
  const t = useT();
  const knowledge = useKnowledge();
  const capabilities = useCapabilities();
  const labelOf = useConnectionLabel();
  const { embeddings } = useServices();
  const [name, setName] = useState(base?.name ?? '');
  const [description, setDescription] = useState(base?.description ?? '');
  const [mode, setMode] = useState<RetrievalMode>(base?.settings.retrievalMode ?? 'lexical');
  const [conn, setConn] = useState<string>(base?.settings.embedding?.connectionId ?? 'auto');
  const [model, setModel] = useState(base?.settings.embedding?.model ?? '');
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const options = capabilities.connectionsFor('embeddings.create');
  const route = capabilities.resolveRoute('embeddings.create');
  useEffect(() => {
    if (mode !== 'hybrid' || conn === 'auto') return;
    let live = true;
    embeddings
      .models(conn)
      .then((m) => live && setModels(m))
      .catch(() => live && setModels([]));
    return () => {
      live = false;
    };
  }, [mode, conn, embeddings]);
  const choice: EmbeddingChoice = conn === 'auto' ? { connectionId: 'auto' } : { connectionId: conn, ...(model && { model }) };
  const changesIndex = !!base && (mode !== base.settings.retrievalMode || (mode === 'hybrid' && JSON.stringify(choice) !== JSON.stringify(base.settings.embedding ?? null)));
  const save = async () => {
    setError('');
    try {
      if (base) {
        await knowledge.updateBase(base.id, { name, description, retrievalMode: mode, ...(mode === 'hybrid' && { embedding: choice }) });
        onSaved(base.id);
      } else onSaved((await knowledge.createBase({ name, description, retrievalMode: mode, ...(mode === 'hybrid' && { embedding: choice }) })).id);
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <Modal onClose={onClose} title={base ? t('kn.settings') : t('kn.new')}>
      <div className="modal-head">
        <h2>{base ? t('kn.settings') : t('kn.new')}</h2>
      </div>
      <div className="modal-body kn-form">
        <label>
          <span>{t('kn.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder={t('p.kn.namePh')} />
        </label>
        <label>
          <span>{t('kn.description')}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />
        </label>
        <span className="kn-form-label">{t('kn.retrieval')}</span>
        <Segmented value={mode} onChange={setMode} label={t('kn.retrieval')} options={[{ value: 'lexical', label: t('kn.lexical') }, { value: 'hybrid', label: t('kn.hybrid') }]} />
        {mode === 'hybrid' && <p className="kn-privacy remote">{t('kn.hybridNote')}</p>}
        {mode === 'hybrid' && (
          <div className="kn-embed">
            <select value={conn} onChange={(e) => (setConn(e.target.value), setModel(''))} aria-label={t('kn.embeddingConnection')}>
              <option value="auto">{route.ok ? t('kn.embedAuto', { target: `${labelOf(route.target!.connectionId)} · ${route.target!.modelId ?? ''}` }) : t('kn.embedAutoNone')}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {labelOf(c.id)}
                </option>
              ))}
            </select>
            {conn !== 'auto' && (
              <select value={model} onChange={(e) => setModel(e.target.value)} aria-label={t('kn.embeddingModel')}>
                <option value="">{models.length ? t('kn.chooseModel') : t('kn.loadingModels')}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {changesIndex && <p className="kn-warn">{t('kn.reindexWarning')}</p>}
        {error && <p className="live-error">{error}</p>}
        <div className="row end">
          <Button tone="ghost" onClick={onClose}>
            {t('creator.cancel')}
          </Button>
          <Button tone="primary" disabled={!name.trim() || (mode === 'hybrid' && conn !== 'auto' && !model)} onClick={() => void save()}>
            {base ? t('kn.save') : t('kn.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BaseDetail({ base, onBack }: { base: KnowledgeBase; onBack: () => void }) {
  const t = useT();
  const st = useApp();
  const knowledge = useKnowledge();
  const privacy = usePrivacyLine();
  const p = privacy(base);
  const docs = knowledge.documents(base.id);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState<null | 'artifact' | 'attachment'>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(st.knowledgeFocus.documentId ?? null);
  useEffect(() => setOpenDoc(st.knowledgeFocus.documentId ?? null), [st.knowledgeFocus]);
  const picker = useRef<HTMLInputElement>(null);
  const run = (f: () => Promise<unknown>) => {
    setError('');
    f().catch((e) => setError(message(e)));
  };
  const addFiles = (files: File[]) =>
    run(async () => {
      const errors: string[] = [];
      for (const f of files)
        await readPicked(f, t('a.kn.fileTooLarge', { mb: KNOWLEDGE_LIMITS.documentBytes / 1024 / 1024 }))
          .then((bytes) => knowledge.addFile(base.id, { name: f.name, mime: f.type, bytes }))
          .catch((e) => errors.push(`${f.name}: ${message(e)}`));
      if (errors.length) throw new Error(errors.join(' · '));
    });
  const ro = !!base.builtIn;
  const shown = openDoc ? knowledge.document(openDoc) : undefined;

  return (
    <div className="knowledge-screen panel-glass">
      <header className="section-head">
        <div>
          <button className="link-btn" onClick={onBack}>
            <ArrowLeft size={14} /> {t('kn.title')}
          </button>
          <h1 className="display">{base.name}</h1>
          {(base.builtIn || base.description) && <p className="muted">{base.builtIn ? t('kn.docsDesc') : base.description}</p>}
          {p.text && <p className="kn-privacy remote">{p.text}</p>}
        </div>
        {!ro && (
          <div className="row">
            <Button size="sm" icon={<Settings2 size={14} />} onClick={() => setSettings(true)}>
              {t('kn.settings')}
            </Button>
            <Button size="sm" icon={<RefreshCw size={14} />} disabled={!docs.length} onClick={() => run(() => knowledge.reindex({ baseId: base.id }))}>
              {t('kn.reindexAll')}
            </Button>
            {confirm ? (
              <span className="history-confirm">
                <span>{t('kn.deleteConfirm')}</span>
                <button className="link-btn danger" onClick={() => run(() => knowledge.deleteBase(base.id).then(onBack))}>
                  {t('kn.delete')}
                </button>
                <button className="link-btn" onClick={() => setConfirm(false)}>
                  {t('creator.cancel')}
                </button>
              </span>
            ) : (
              <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                {t('kn.delete')}
              </Button>
            )}
          </div>
        )}
      </header>

      {!ro && (
        <div className="kn-add row">
          <Button size="sm" tone="primary" icon={<Upload size={14} />} onClick={() => picker.current?.click()}>
            {t('kn.addFile')}
          </Button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={ACCEPT}
            onChange={(e) => {
              if (e.target.files?.length) addFiles([...e.target.files]);
              e.target.value = '';
            }}
            aria-label={t('kn.addFile')}
          />
          <Button size="sm" icon={<Layers size={14} />} onClick={() => setAdding('artifact')}>
            {t('kn.addArtifact')}
          </Button>
          <Button size="sm" icon={<Paperclip size={14} />} onClick={() => setAdding('attachment')}>
            {t('kn.addAttachment')}
          </Button>
          <small className="muted">{t('kn.formats')}</small>
        </div>
      )}
      {error && <p className="live-error">{error}</p>}

      <TrySearch base={base} />

      {docs.length === 0 ? (
        <p className="muted">{t('kn.noDocs')}</p>
      ) : (
        <table className="kn-docs">
          <thead>
            <tr>
              <th>{t('kn.doc')}</th>
              <th>{t('kn.statusCol')}</th>
              <th>{t('kn.chunks')}</th>
              <th>{t('kn.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <DocRow key={d.id} d={d} ro={ro} onOpen={() => setOpenDoc(d.id)} onError={setError} />
            ))}
          </tbody>
        </table>
      )}
      {settings && <BaseSettings base={base} onClose={() => setSettings(false)} onSaved={() => setSettings(false)} />}
      {adding && <AddStored base={base} kind={adding} onClose={() => setAdding(null)} />}
      {shown && <DocumentDetail d={shown} focusChunk={st.knowledgeFocus.documentId === shown.id ? st.knowledgeFocus.chunkId : undefined} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}

function DocRow({ d, ro, onOpen, onError }: { d: KnowledgeDocument; ro: boolean; onOpen: () => void; onError: (m: string) => void }) {
  const t = useT();
  const knowledge = useKnowledge();
  const [confirm, setConfirm] = useState(false);
  const replace = useRef<HTMLInputElement>(null);
  const busy = ['pending', 'extracting', 'embedding', 'indexing'].includes(d.status);
  const run = (f: () => Promise<unknown> | void) => {
    onError('');
    Promise.resolve()
      .then(f)
      .catch((e) => onError(message(e)));
  };
  return (
    <tr>
      <td>
        <button className="link-btn" onClick={onOpen} title={d.name}>
          {d.name}
        </button>
        <small className="muted">
          {' '}
          {formatBytes(d.size)}
          {d.extraction?.pages ? ` · ${t('kn.pages', { n: d.extraction.pages })}` : ''}
          {d.extraction?.rows ? ` · ${t('kn.rows', { n: d.extraction.rows })}` : ''}
        </small>
      </td>
      <td>
        <DocStatus d={d} />
      </td>
      <td>{d.index?.chunkCount ?? '—'}</td>
      <td>
        <small>{t(`kn.src.${d.sourceType}` as TKey)}</small>
      </td>
      <td>
        <div className="kn-doc-actions">
        {!ro && busy && (
          <button className="icon-btn" title={t('kn.cancel')} aria-label={t('kn.cancel')} onClick={() => knowledge.cancel(d.id)}>
            <Square size={13} />
          </button>
        )}
        {!ro && !busy && (
          <button className="icon-btn" title={t('kn.reindex')} aria-label={t('kn.reindex')} onClick={() => run(() => knowledge.reindex({ documentId: d.id }))}>
            <RefreshCw size={13} />
          </button>
        )}
        {!ro && d.sourceType === 'local-file' && !busy && (
          <>
            <button className="icon-btn" title={t('kn.replaceFile')} aria-label={t('kn.replaceFile')} onClick={() => replace.current?.click()}>
              <FilePlus2 size={13} />
            </button>
            <input
              ref={replace}
              type="file"
              hidden
              accept={ACCEPT}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) run(async () => knowledge.updateFile(d.id, await readPicked(f, t('a.kn.fileTooLarge', { mb: KNOWLEDGE_LIMITS.documentBytes / 1024 / 1024 }))));
              }}
            />
          </>
        )}
        {!ro &&
          (confirm ? (
            <span className="history-confirm">
              <button className="link-btn danger" onClick={() => run(() => knowledge.removeDocument(d.id))}>
                {t('kn.remove')}
              </button>
              <button className="link-btn" onClick={() => setConfirm(false)}>
                {t('creator.cancel')}
              </button>
            </span>
          ) : (
            <button className="icon-btn" title={t('kn.removeHint')} aria-label={t('kn.remove')} onClick={() => setConfirm(true)}>
              <Trash2 size={13} />
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

/** a search the user runs by hand: what a run would retrieve, with scores (no model involved) */
function TrySearch({ base }: { base: KnowledgeBase }) {
  const t = useT();
  const knowledge = useKnowledge();
  const { store } = useServices();
  const [q, setQ] = useState('');
  const [r, setR] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setR(await knowledge.search([base.id], q, 6));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="kn-try">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('kn.tryPlaceholder')} aria-label={t('kn.try')} />
        <Button size="sm" type="submit" icon={<Search size={14} />} disabled={busy || !q.trim()}>
          {t('kn.try')}
        </Button>
      </form>
      {r && (
        <ol className="kn-results">
          {r.notes.map((n, i) => (
            <li key={`n${i}`} className="kn-note">
              {n}
            </li>
          ))}
          {!r.hits.length && <li className="muted">{t('kn.noResults')}</li>}
          {r.hits.map((h) => (
            <li key={h.chunk.id}>
              <button className="link-btn" onClick={() => store.openKnowledge({ baseId: base.id, documentId: h.chunk.documentId, chunkId: h.chunk.id })}>
                {h.documentName}
                {locationLabel(h.chunk.location) ? ` · ${locationLabel(h.chunk.location)}` : ''}
              </button>
              <small className="muted">
                {' '}
                {t('kn.score')} {h.score.toFixed(3)}
                {h.lexical !== undefined ? ` · BM25 ${h.lexical.toFixed(2)}` : ''}
                {h.semantic !== undefined ? ` · cos ${h.semantic.toFixed(3)}` : ''}
              </small>
              <p className="kn-snippet">{h.chunk.text.slice(0, 280)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** add an Artifact or a chat / task attachment (its bytes are shared, not copied) */
function AddStored({ base, kind, onClose }: { base: KnowledgeBase; kind: 'artifact' | 'attachment'; onClose: () => void }) {
  const t = useT();
  const knowledge = useKnowledge();
  const artifacts = useArtifacts();
  const { chat, live } = useServices();
  const [error, setError] = useState('');
  const [done, setDone] = useState<string[]>([]);
  const items = useMemo(() => {
    if (kind === 'artifact') return artifacts.list('documents').map((a) => ({ id: a.id, name: a.name, sub: `${formatBytes(a.size)} · ${new Date(a.createdAt).toLocaleDateString()}`, add: () => knowledge.addArtifact(base.id, a.id) }));
    const fromChats = chat.list().flatMap((c) => c.messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.storageRef && a.kind !== 'image').map((a) => ({ a, from: { conversationId: c.id, ...(m.runId && { runId: m.runId }) }, where: c.title }))));
    const fromTasks = live.allAttachments().filter((x) => x.attachment.storageRef && x.attachment.kind !== 'image').map((x) => ({ a: x.attachment, from: { taskId: x.taskId }, where: x.taskId }));
    const seen = new Set<string>();
    return [...fromChats, ...fromTasks]
      .filter((x) => (seen.has(x.a.sha256 ?? x.a.id) ? false : (seen.add(x.a.sha256 ?? x.a.id), true)))
      .map((x) => ({ id: x.a.id, name: x.a.name, sub: `${formatBytes(x.a.size)} · ${x.where}`, add: () => knowledge.addAttachment(base.id, x.a, x.from) }));
  }, [kind, artifacts, chat, live, knowledge, base.id]);
  return (
    <Modal onClose={onClose} title={kind === 'artifact' ? t('kn.addArtifact') : t('kn.addAttachment')}>
      <div className="modal-head">
        <h2>{kind === 'artifact' ? t('kn.addArtifact') : t('kn.addAttachment')}</h2>
      </div>
      <div className="modal-body">
        {!items.length && <p className="muted">{kind === 'artifact' ? t('kn.noArtifacts') : t('kn.noAttachments')}</p>}
        <ul className="kn-pick-list">
          {items.map((it) => (
            <li key={it.id}>
              <span>
                <b>{it.name}</b> <small className="muted">{it.sub}</small>
              </span>
              <Button
                size="sm"
                disabled={done.includes(it.id)}
                onClick={() => {
                  setError('');
                  it.add()
                    .then(() => setDone((d) => [...d, it.id]))
                    .catch((e) => setError(`${it.name}: ${message(e)}`));
                }}
              >
                {done.includes(it.id) ? t('kn.addedShort') : t('kn.add')}
              </Button>
            </li>
          ))}
        </ul>
        {error && <p className="live-error">{error}</p>}
      </div>
    </Modal>
  );
}

function DocumentDetail({ d, focusChunk, onClose }: { d: KnowledgeDocument; focusChunk?: string; onClose: () => void }) {
  const t = useT();
  const knowledge = useKnowledge();
  const labelOf = useConnectionLabel();
  const [chunks, setChunks] = useState<KnowledgeChunk[] | null>(null);
  const focused = useRef<HTMLLIElement>(null);
  const [limit, setLimit] = useState(60);
  useEffect(() => {
    let live = true;
    knowledge
      .chunks(d.id)
      .then((c) => live && setChunks(c))
      .catch(() => live && setChunks([]));
    return () => {
      live = false;
    };
  }, [d.id, d.index?.generation, knowledge]);
  // a citation: show its chunk (also when it is past the first page of chunks)
  const focusAt = chunks?.findIndex((c) => c.id === focusChunk) ?? -1;
  useEffect(() => {
    if (focusAt >= limit) setLimit(focusAt + 10);
    focused.current?.scrollIntoView({ block: 'center' });
  }, [focusAt, limit]);
  const cited = focusChunk && chunks && focusAt < 0;
  return (
    <Modal onClose={onClose} title={d.name} wide>
      <div className="modal-head">
        <h2>{d.name}</h2>
        <DocStatus d={d} />
      </div>
      <div className="modal-body kn-doc-detail">
        <dl className="kv art-kv">
          <dt>{t('kn.source')}</dt>
          <dd>{t(`kn.src.${d.sourceType}` as TKey)}</dd>
          <dt>{t('art.mime')}</dt>
          <dd className="mono">
            {d.mimeType}
            {d.extraction ? ` · ${d.extraction.format}` : ''}
          </dd>
          <dt>{t('art.size')}</dt>
          <dd>
            {formatBytes(d.size)}
            {d.extraction?.pages ? ` · ${t('kn.pages', { n: d.extraction.pages })}` : ''}
            {d.extraction?.rows ? ` · ${t('kn.rows', { n: d.extraction.rows })}` : ''}
            {d.extraction?.lines ? ` · ${t('kn.lines', { n: d.extraction.lines })}` : ''}
          </dd>
          {d.sha256 && (
            <>
              <dt>{t('art.hash')}</dt>
              <dd className="mono small hash">{d.sha256}</dd>
            </>
          )}
          {d.index && (
            <>
              <dt>{t('kn.index')}</dt>
              <dd>
                {t('kn.generation', { n: d.index.generation })} · {t('kn.chunksCount', { n: d.index.chunkCount })} · {new Date(d.index.builtAt).toLocaleString()}
                {d.index.embedding ? ` · ${labelOf(d.index.embedding.connectionId)} ${d.index.embedding.model} (${d.index.embedding.dimensions}d)` : ` · ${t('kn.lexicalShort')}`}
              </dd>
            </>
          )}
          {(d.error || d.warning || d.staleReason) && (
            <>
              <dt>{t('kn.problem')}</dt>
              <dd className="kn-warn">
                {d.error && `${d.error.code}: ${d.error.message}`}
                {d.staleReason}
                {d.warning && `${d.warning.code}: ${d.warning.message}`}
              </dd>
            </>
          )}
          {d.extraction?.warnings?.length ? (
            <>
              <dt>{t('kn.notes')}</dt>
              <dd className="small">{d.extraction.warnings.join(' · ')}</dd>
            </>
          ) : null}
        </dl>
        {cited && <p className="kn-warn">{t('kn.citedOld')}</p>}
        {chunks === null ? (
          <p className="muted">…</p>
        ) : (
          <ol className="kn-chunks">
            {chunks.slice(0, limit).map((c) => (
              <li key={c.id} ref={c.id === focusChunk ? focused : undefined} className={c.id === focusChunk ? 'focus' : ''}>
                <small className="muted">
                  #{c.ordinal + 1}
                  {locationLabel(c.location) ? ` · ${locationLabel(c.location)}` : ''}
                </small>
                <pre>{c.text}</pre>
              </li>
            ))}
          </ol>
        )}
        {chunks && chunks.length > limit && (
          <Button size="sm" tone="ghost" onClick={() => setLimit((n) => n + 100)}>
            {t('kn.more', { n: chunks.length - limit })}
          </Button>
        )}
      </div>
    </Modal>
  );
}

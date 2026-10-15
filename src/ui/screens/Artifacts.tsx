// Artifacts: the files RealmNest's runs produced (docs/FILES.md). A grid by kind, and a detail view
// with a safe preview (images as images, text as text: HTML and SVG never render as markup,
// programs never open), everything known about where the file came from, and what to do with it.
// Exports are copies; the managed original never moves.

import { Download, ExternalLink, FolderOpen, MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Artifact, ArtifactView } from '../../domain/artifact';
import { formatBytes } from '../../domain/attachment';
import type { TKey } from '../../i18n';
import { PROGRAM_MIMES } from '../../runtime/files/mime';
import { useApp, useServices, useT } from '../context';
import { ArtifactThumb, useArtifacts } from '../files/FileViews';
import { fileMessage } from '../files/importFiles';
import { Button, Modal, Segmented } from '../kit';
import { AddToKnowledge } from '../knowledge/common';
import { useKnowledge } from '../context';

export function ArtifactsScreen() {
  const t = useT();
  const st = useApp();
  const artifacts = useArtifacts();
  const [view, setView] = useState<ArtifactView>('all');
  const [open, setOpen] = useState<string | null>(st.artifactFocus.id ?? null);
  useEffect(() => setOpen(st.artifactFocus.id ?? null), [st.artifactFocus]);
  const all = artifacts.list();
  const list = artifacts.list(view);
  const shown = open ? artifacts.get(open) : undefined;

  return (
    <div className="artifacts-screen panel-glass">
      <header className="section-head">
        <div>
          <h1 className="display">{t('art.title')}</h1>
          <p className="muted">{t('art.sub')}</p>
        </div>
      </header>
      <Segmented
        value={view}
        onChange={setView}
        label={t('p.art.view')}
        options={[
          { value: 'all', label: `${t('art.all')} · ${all.length}` },
          { value: 'images', label: t('art.images') },
          { value: 'documents', label: t('art.documents') },
          { value: 'other', label: t('art.other') },
        ]}
      />
      {all.length === 0 ? <p className="muted">{t('art.empty')}</p> : list.length === 0 && <p className="muted">{t('art.emptyView')}</p>}
      <div className={`art-grid ${view === 'images' ? 'images' : ''}`}>
        {list.map((a) => (
          <button key={a.id} className="art-tile" onClick={() => setOpen(a.id)} title={a.name}>
            <ArtifactThumb a={a} size="lg" />
            <span className="art-meta">
              <b>{a.name}</b>
              <small>
                {t(`art.kind.${a.kind}` as TKey)} · {formatBytes(a.size)} · {new Date(a.createdAt).toLocaleDateString()}
              </small>
            </span>
          </button>
        ))}
      </div>
      {shown && <ArtifactDetail a={shown} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

function Preview({ a }: { a: Artifact }) {
  const t = useT();
  const artifacts = useArtifacts();
  const [data, setData] = useState<string>();
  const [text, setText] = useState<string>();
  // the file could not be read (gone from the store): say so instead of waiting forever
  const [missing, setMissing] = useState(false);
  const asText = a.mimeType === 'image/svg+xml' || a.mimeType === 'text/html' || a.kind === 'text' || a.kind === 'code' || a.kind === 'data' || a.mimeType === 'text/csv';
  useEffect(() => {
    let live = true;
    setMissing(false);
    if (a.deletedAt) return;
    if (a.kind === 'image' && a.mimeType !== 'image/svg+xml')
      void artifacts.bytes(a.id).then((d) => {
        if (!live) return;
        setData(d);
        setMissing(!d);
      });
    else if (asText)
      void artifacts.text(a.id).then((x) => {
        if (!live) return;
        setText(x);
        setMissing(x === undefined);
      });
    return () => {
      live = false;
    };
  }, [a.id, a.storageRef, a.deletedAt, a.kind, a.mimeType, asText, artifacts]);
  if (a.deletedAt) return <div className="art-preview empty">{t('art.deleted')}</div>;
  if (PROGRAM_MIMES.has(a.mimeType)) return <div className="art-preview empty">{t('art.program')}</div>;
  if (missing) return <div className="art-preview empty">{t('a.art.fileMissing')}</div>;
  if (data) return <div className="art-preview image"><img src={`data:${a.mimeType};base64,${data}`} alt={a.name} /></div>;
  if (text !== undefined)
    return (
      <div className="art-preview text">
        {(a.mimeType === 'text/html' || a.mimeType === 'image/svg+xml') && <small className="muted">{t('art.asText')}</small>}
        <pre>{text}</pre>
      </div>
    );
  return <div className="art-preview empty">{a.kind === 'image' ? '…' : t('art.noPreview')}</div>;
}

function ArtifactDetail({ a, onClose, onOpen }: { a: Artifact; onClose: () => void; onOpen: (id: string) => void }) {
  const t = useT();
  const st = useApp();
  const { store, chat, live } = useServices();
  const artifacts = useArtifacts();
  const knowledge = useKnowledge();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [agentFor, setAgentFor] = useState<string | null>(null);
  const p = a.provenance;
  const nameOf = (id?: string) => (id ? (st.characters.find((c) => c.id === id)?.name ?? id) : undefined);
  const lineage = useMemo(() => artifacts.lineage(a.id), [artifacts, a.id, artifacts.getVersion()]);
  const conv = p.conversationId ? chat.get(p.conversationId) : undefined;
  const task = p.taskId ? live.getTask(p.taskId) : undefined;
  // the run's attachments by name (their records live on the message or the task)
  const inputs = useMemo(() => {
    const all = [...chat.list().flatMap((c) => c.messages.flatMap((m) => m.attachments ?? [])), ...live.allAttachments().map((x) => x.attachment)];
    return p.sourceAttachmentIds.map((id) => all.find((x) => x.id === id)?.name ?? id);
  }, [chat, live, p.sourceAttachmentIds]);
  const run = (f: () => Promise<unknown>) => {
    setError('');
    f().catch((e) => setError(fileMessage(e)));
  };
  const gone = !!a.deletedAt;
  const program = PROGRAM_MIMES.has(a.mimeType);
  const modelReady = !gone && !program && (a.kind === 'image' || a.mimeType === 'application/pdf' || a.kind === 'text' || a.kind === 'code' || a.kind === 'data' || a.mimeType.startsWith('text/'));

  return (
    <Modal onClose={onClose} title={a.name} wide>
      <div className="modal-head">
        <h2>{a.name}</h2>
        <span className="skill-origin">{t(`art.kind.${a.kind}` as TKey)}</span>
      </div>
      <div className="modal-body art-detail">
        <Preview a={a} />
        <dl className="kv art-kv">
          <dt>{t('art.mime')}</dt>
          <dd className="mono">{a.mimeType}</dd>
          <dt>{t('art.size')}</dt>
          <dd>{formatBytes(a.size)}</dd>
          {a.sha256 && (
            <>
              <dt>{t('art.hash')}</dt>
              <dd className="mono small hash">{a.sha256}</dd>
            </>
          )}
          <dt>{t('art.created')}</dt>
          <dd>{new Date(a.createdAt).toLocaleString()}</dd>
          <dt>{t('art.creator')}</dt>
          <dd>{nameOf(p.createdByAgentId) ?? t('art.you')}</dd>
          <dt>{t('art.where')}</dt>
          <dd>
            {conv ? (
              <button className="link-btn" onClick={() => store.openChat(conv.id)}>
                {t('art.inChat')} · {conv.title}
              </button>
            ) : task ? (
              <span>
                {t('art.inTask', { name: nameOf(task.agentId) ?? '' })} · {task.title}
              </span>
            ) : (
              <span className="muted">{t('art.unknown')}</span>
            )}
          </dd>
          {p.toolId && (
            <>
              <dt>{t('art.tool')}</dt>
              <dd className="mono">{p.toolId}</dd>
            </>
          )}
          {p.runId && (
            <>
              <dt>{t('art.run')}</dt>
              <dd className="mono small">
                {p.runId}
                {p.toolCallId ? ` · ${p.toolCallId}` : ''}
              </dd>
            </>
          )}
          {p.workspacePath && (
            <>
              <dt>{t('art.path')}</dt>
              <dd className="mono">{p.workspacePath}</dd>
            </>
          )}
          {p.skills?.length ? (
            <>
              <dt>{t('art.skills')}</dt>
              <dd>{p.skills.map((s) => `${s.name} ${s.version} (${t(`skills.activation.${s.activation}` as TKey)})`).join(', ')}</dd>
            </>
          ) : null}
          <dt>{t('art.inputs')}</dt>
          <dd>
            {!p.sourceAttachmentIds.length && !p.sourceArtifactIds.length && <span className="muted">{t('art.noInputs')}</span>}
            {inputs.map((n, i) => (
              <span key={i} className="mono">
                {n} <small className="muted">({t('art.attachment')})</small>
              </span>
            ))}
            {lineage.sources.map((s) => (
              <button key={s.id} className="link-btn" onClick={() => onOpen(s.id)}>
                {s.name}
                {s.deletedAt ? ` (${t('art.deleted')})` : ''}
              </button>
            ))}
            {lineage.missingSourceIds.map((id) => (
              <span key={id} className="muted">
                {t('art.sourceGone')}
              </span>
            ))}
          </dd>
          {lineage.derived.length > 0 && (
            <>
              <dt>{t('art.derived')}</dt>
              <dd>
                {lineage.derived.map((d) => (
                  <button key={d.id} className="link-btn" onClick={() => onOpen(d.id)}>
                    {d.name}
                  </button>
                ))}
              </dd>
            </>
          )}
        </dl>
        {error && <p className="live-error">{error}</p>}
        {!gone && (
          <div className="art-actions">
            <Button size="sm" icon={<ExternalLink size={14} />} disabled={program} onClick={() => run(() => artifacts.open(a.id))}>
              {t('art.open')}
            </Button>
            <Button size="sm" icon={<FolderOpen size={14} />} onClick={() => run(() => artifacts.reveal(a.id))}>
              {t('art.reveal')}
            </Button>
            <Button size="sm" icon={<MessageSquarePlus size={14} />} disabled={!modelReady} onClick={() => store.chatWithArtifact(a.id)} title={modelReady ? undefined : t('art.chatOnly')}>
              {t('art.useInChat')}
            </Button>
            <span className="art-agent">
              <Button size="sm" icon={<Send size={14} />} disabled={!modelReady || !st.characters.length} onClick={() => setAgentFor((v) => (v === null ? '' : null))} title={modelReady ? undefined : t('art.chatOnly')}>
                {t('art.sendToAgent')}
              </Button>
              {agentFor !== null && (
                <>
                  <select aria-label={t('art.pickAgent')} value={agentFor} onChange={(e) => setAgentFor(e.target.value)}>
                    <option value="" disabled>
                      {t('art.pickAgent')}
                    </option>
                    {st.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" disabled={!agentFor} onClick={() => store.taskWithArtifact(a.id, agentFor)}>
                    {t('art.asTask')}
                  </Button>
                  <Button size="sm" disabled={!agentFor} onClick={() => store.chatWithArtifact(a.id, agentFor)}>
                    {t('art.asChat')}
                  </Button>
                </>
              )}
            </span>
            <AddToKnowledge disabled={program || a.kind === 'image'} add={(baseId) => knowledge.addArtifact(baseId, a.id)} />
            <Button
              size="sm"
              icon={<Download size={14} />}
              onClick={() => run(() => artifacts.exportCopy(a.id).then((path) => path && store.toast(t('art.exported', { path }))))}
            >
              {t('art.export')}
            </Button>
            <span className="gap" />
            {confirm ? (
              <span className="history-confirm">
                <span>{t('art.deleteConfirm')}</span>
                <button className="link-btn danger" onClick={() => run(() => artifacts.delete(a.id).then(onClose))}>
                  {t('art.delete')}
                </button>
                <button className="link-btn" onClick={() => setConfirm(false)}>
                  {t('creator.cancel')}
                </button>
              </span>
            ) : (
              <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                {t('art.delete')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

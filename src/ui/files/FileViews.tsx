// Shared file UI: pending attachments (loading / error states), attachment chips with
// thumbnails that load from the FileStore, an image lightbox, and the Artifacts shown under a
// chat reply or an agent run. Images are shown as <img> from data: URLs; SVG and HTML never
// render as markup (they are text here), and nothing is ever executed.

import { Archive, Database, Download, ExternalLink, File, FileCode, FileSpreadsheet, FileText, Film, FolderOpen, Image as ImageIcon, LoaderCircle, Music, Paperclip, Presentation, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { attachmentProblem, formatBytes, type Attachment, type AttachmentInput, type AttachmentKind, type AttachmentSource } from '../../domain/attachment';
import type { Artifact } from '../../domain/artifact';
import type { SkillRunRef } from '../../domain/skill';
import type { SkillCatalogEntry } from '../../runtime/skills/mentions';
import { useServices, useT } from '../context';
import { fileMessage, importAttachment } from './importFiles';

/** an attachment in a composer, before it is sent */
export interface PendingAttachment extends AttachmentInput {
  key: string;
  status?: 'loading' | 'error';
  error?: string;
}

let seq = 0;
const guessKind = (f: File): AttachmentKind => (f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'pdf' : 'text');

/** the composer's files: each one reads and stores on its own, with its own error */
export function usePendingFiles(refuse?: (kind: AttachmentKind) => string | undefined) {
  const t = useT();
  const { files } = useServices();
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const current = useRef(items);
  current.current = items;
  const add = useCallback(
    (picked: File[], source: AttachmentSource) => {
      const fresh = picked.map((f) => ({ f, item: { key: `f${++seq}`, name: f.name || t('p.files.pastedFile'), mime: f.type, size: f.size, kind: guessKind(f), status: 'loading' as const } }));
      const ok = current.current.filter((x) => x.status !== 'error');
      // too many files: the extra ones are shown as refused, the others still load
      const room = Math.max(0, 4 - ok.length);
      setItems((l) => [...l, ...fresh.map((x, i) => (i < room ? x.item : { ...x.item, status: 'error' as const, error: attachmentProblem([...ok, ...fresh.map((y) => y.item)]) ?? t('p.files.tooMany') }))]);
      fresh.slice(0, room).forEach(({ f, item }) => {
        importAttachment(files, f, { source, refuse, t })
          .then((a) =>
            // removed while it was loading: forget it
            setItems((l) => {
              if (!l.some((x) => x.key === item.key)) return l;
              const next = l.map((x) => (x.key === item.key ? { ...a, key: item.key } : x));
              const problem = attachmentProblem(next.filter((x) => !x.status));
              return problem ? next.map((x) => (x.key === item.key ? { ...x, status: 'error' as const, error: problem } : x)) : next;
            }),
          )
          .catch((e) => setItems((l) => l.map((x) => (x.key === item.key ? { ...x, status: 'error' as const, error: fileMessage(e) } : x))));
      });
    },
    [files, refuse, t],
  );
  return {
    items,
    add,
    set: setItems,
    remove: (key: string) => setItems((l) => l.filter((x) => x.key !== key)),
    clear: () => setItems([]),
    /** the files ready to send (refused ones stay visible until removed, but are not sent) */
    ready: items.filter((x) => !x.status).map(({ key: _k, status: _s, error: _e, ...a }) => a as AttachmentInput),
    loading: items.some((x) => x.status === 'loading'),
    failed: items.some((x) => x.status === 'error'),
  };
}

const KindIcon = ({ kind, size = 15 }: { kind: AttachmentKind | string; size?: number }) => (kind === 'pdf' || kind === 'document' ? <FileText size={size} /> : kind === 'image' ? <ImageIcon size={size} /> : <Paperclip size={size} />);

/** a pending or stored attachment as a chip; images show their thumbnail */
export function FileChip({ a, data, onRemove, onOpen }: { a: PendingAttachment | Attachment; data?: string; onRemove?: () => void; onOpen?: () => void }) {
  const t = useT();
  const p = a as PendingAttachment;
  const state = p.status;
  const thumb = a.kind === 'image' && (data ?? (a as AttachmentInput).data);
  const kindLabel = a.kind === 'text' ? t('chat.kindText') : a.kind === 'pdf' ? 'PDF' : t('chat.kindImage');
  return (
    <li className={`file-chip ${a.kind} ${state ?? ''}`} title={p.error ?? `${a.name} · ${formatBytes(a.size)}`}>
      {state === 'loading' ? (
        <span className="file-icon">
          <LoaderCircle size={15} className="spin" />
        </span>
      ) : state === 'error' ? (
        <span className="file-icon">
          <TriangleAlert size={15} />
        </span>
      ) : thumb ? (
        <button type="button" className="file-thumb" onClick={onOpen} aria-label={`${t('files.preview')} ${a.name}`} disabled={!onOpen}>
          <img src={`data:${a.mime};base64,${thumb}`} alt="" />
        </button>
      ) : (
        <span className="file-icon">
          <KindIcon kind={a.kind} />
        </span>
      )}
      <span className="file-meta">
        <b>{a.name}</b>
        <small>{state === 'loading' ? t('files.loading') : state === 'error' ? p.error : `${kindLabel} · ${formatBytes(a.size)}`}</small>
      </span>
      {onRemove && (
        <button type="button" className="file-remove" onClick={onRemove} aria-label={`${t('chat.remove')} ${a.name}`} title={t('chat.remove')}>
          <X size={13} />
        </button>
      )}
    </li>
  );
}

/** a stored attachment in a message or task: its image loads from the FileStore (missing: said so) */
export function StoredAttachment({ a, load, big }: { a: Attachment; load: (a: Attachment) => Promise<string | undefined>; big?: boolean }) {
  const t = useT();
  const [data, setData] = useState<string | undefined | null>(a.kind === 'image' ? undefined : null);
  const [open, setOpen] = useState(false);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    if (a.kind !== 'image') return;
    let live = true;
    void loader.current(a).then((d) => live && setData(d ?? null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, a.storageRef, a.kind]);
  if (a.kind === 'image' && data && big)
    return (
      <li className="msg-image">
        <button type="button" onClick={() => setOpen(true)} aria-label={`${t('files.preview')} ${a.name}`}>
          <img src={`data:${a.mime};base64,${data}`} alt={a.name} title={a.name} />
        </button>
        {open && <Lightbox name={a.name} src={`data:${a.mime};base64,${data}`} onClose={() => setOpen(false)} />}
      </li>
    );
  const missing = a.kind === 'image' && data === null && !!a.storageRef;
  return (
    <>
      <FileChip a={missing ? { ...a, key: a.id, status: 'error', error: t('files.missing') } : a} data={data ?? undefined} onOpen={data ? () => setOpen(true) : undefined} />
      {open && data && <Lightbox name={a.name} src={`data:${a.mime};base64,${data}`} onClose={() => setOpen(false)} />}
    </>
  );
}

export function Lightbox({ name, src, onClose }: { name: string; src: string; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="lightbox" role="dialog" aria-label={name} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={name} />
        <figcaption>
          {name}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('files.close')}>
            <X size={16} />
          </button>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}

/** Skills chosen for a message or task: compact removable chips */
export function SkillChips({ ids, catalog, onRemove }: { ids: string[]; catalog: SkillCatalogEntry[]; onRemove?: (id: string) => void }) {
  const t = useT();
  if (!ids.length) return null;
  return (
    <div className="skill-chips" aria-label={t('skills.chosen')}>
      {ids.map((id) => {
        const s = catalog.find((x) => x.id === id);
        return (
          <span key={id} className="skill-tag" title={s?.description ?? id}>
            <Sparkles size={12} /> {s?.name ?? id}
            {onRemove && (
              <button type="button" onClick={() => onRemove(id)} aria-label={`${t('skills.remove')} ${s?.name ?? id}`}>
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** "Using: Workspace Note (explicit)": the Skills a run used and how they were chosen */
export function SkillsUsed({ refs }: { refs?: SkillRunRef[] }) {
  const t = useT();
  if (!refs?.length) return null;
  return (
    <p className="skills-used">
      <Sparkles size={12} />
      {t('skills.using', { list: refs.map((r) => r.name).join(', ') })}
      {refs[0].activation && <small title={refs[0].reason}> · {t(`skills.activation.${refs[0].activation}`)}</small>}
    </p>
  );
}

// ── artifacts ───────────────────────────────────────────────

export function useArtifacts() {
  const { artifacts } = useServices();
  useSyncExternalStore(artifacts.subscribe, artifacts.getVersion);
  return artifacts;
}

const ART_ICON: Record<string, typeof File> = { image: ImageIcon, document: FileText, text: FileText, spreadsheet: FileSpreadsheet, presentation: Presentation, audio: Music, video: Film, archive: Archive, data: Database, code: FileCode, other: File };

/** a small preview of an artifact: an image, or its kind's icon */
export function ArtifactThumb({ a, size = 'sm' }: { a: Artifact; size?: 'sm' | 'lg' }) {
  const artifacts = useArtifacts();
  const [data, setData] = useState<string>();
  useEffect(() => {
    if (a.kind !== 'image' || a.deletedAt || a.mimeType === 'image/svg+xml') return;
    let live = true;
    void artifacts.bytes(a.id).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [a.id, a.kind, a.deletedAt, a.mimeType, a.storageRef, artifacts]);
  const Icon = ART_ICON[a.kind] ?? File;
  return <span className={`art-thumb ${size} ${a.kind}`}>{data ? <img src={`data:${a.mimeType};base64,${data}`} alt="" /> : <Icon size={size === 'lg' ? 28 : 16} />}</span>;
}

/** what a reply or a run produced, under it */
export function ArtifactStrip({ list }: { list: Artifact[] }) {
  const t = useT();
  const { store } = useServices();
  const artifacts = useArtifacts();
  const [msg, setMsg] = useState('');
  if (!list.length) return null;
  const run = (p: Promise<unknown>) => p.then(() => setMsg('')).catch((e) => setMsg(fileMessage(e)));
  return (
    <div className="art-strip">
      <ul>
        {list.map((a) =>
          a.deletedAt ? (
            <li key={a.id} className="art-card deleted">
              <span className="art-thumb sm" />
              <span className="art-meta">
                <b>{a.name}</b>
                <small>{t('art.deleted')}</small>
              </span>
            </li>
          ) : (
            <li key={a.id} className="art-card">
              <button type="button" className="art-main" onClick={() => store.openArtifact(a.id)} title={t('art.details')}>
                <ArtifactThumb a={a} />
                <span className="art-meta">
                  <b>{a.name}</b>
                  <small>
                    {t(`art.kind.${a.kind}`)} · {formatBytes(a.size)}
                  </small>
                </span>
              </button>
              <span className="art-acts">
                <button type="button" className="icon-btn" onClick={() => void run(artifacts.open(a.id))} aria-label={t('art.open')} title={t('art.open')}>
                  <ExternalLink size={14} />
                </button>
                <button type="button" className="icon-btn" onClick={() => void run(artifacts.reveal(a.id))} aria-label={t('art.reveal')} title={t('art.reveal')}>
                  <FolderOpen size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void artifacts.exportCopy(a.id).then((p) => (p ? store.toast(t('art.exported', { path: p })) : undefined), (e) => setMsg(fileMessage(e)))}
                  aria-label={t('art.export')}
                  title={t('art.export')}
                >
                  <Download size={14} />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {msg && <p className="art-error">{msg}</p>}
    </div>
  );
}

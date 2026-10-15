// A file the user gives RealmNest (picker, drop, paste) → a stored attachment, or a structured error.
// The same steps for the chat composer and agent tasks:
//   size (before reading) → bytes → what the content really is (magic bytes) → kind limits → FileStore
// Nothing is kept for a file that is refused, and nothing is run or rendered as HTML.

import { attachmentKind, contentKind, formatBytes, sizeLimit, type AttachmentInput, type AttachmentKind, type AttachmentSource } from '../../domain/attachment';
import { translator } from '../../i18n';
import { looksLikeText, sniffMime, toBase64 } from '../../runtime/files/mime';
import { FileError, MAX_FILE_BYTES, type FileStore } from '../../runtime/files/store';

export interface ImportOptions {
  source: AttachmentSource;
  /** why the chosen AI cannot take this kind (undefined: it can) */
  refuse?: (kind: AttachmentKind) => string | undefined;
  /** the UI's translator, for the messages and the name of a pasted picture (default: English) */
  t?: ReturnType<typeof translator>;
}

/** a pasted screenshot has no useful name ("image.png"): give it one */
function nameOf(f: File, source: AttachmentSource, t: ReturnType<typeof translator>): string {
  const n = f.name?.trim();
  if (n && !(source === 'paste' && /^image\.(png|jpe?g|gif|webp)$/i.test(n))) return n;
  const ext = (f.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${t('p.files.pasted', { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}` })}.${ext}`;
}

export async function importAttachment(files: FileStore, f: File, o: ImportOptions): Promise<AttachmentInput> {
  const t = o.t ?? translator('en');
  const name = nameOf(f, o.source, t);
  if (f.size > MAX_FILE_BYTES) throw new FileError('FILE_TOO_LARGE', t('p.files.tooLarge', { name, max: formatBytes(MAX_FILE_BYTES) }));
  if (f.size === 0) throw new FileError('INVALID_FILE', t('p.files.empty', { name }));
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await f.arrayBuffer());
  } catch {
    throw new FileError('IMPORT_FAILED', t('p.files.unreadable', { name }));
  }
  const declared = attachmentKind(name, f.type);
  const what = contentKind(name, declared, sniffMime(bytes), looksLikeText(bytes));
  if ('error' in what) throw new FileError(what.code, what.error);
  const no = o.refuse?.(what.kind);
  if (no) throw new FileError('UNSUPPORTED_FILE_TYPE', no);
  if (bytes.length > sizeLimit(what.kind)) throw new FileError('FILE_TOO_LARGE', t('p.files.tooLarge', { name, max: formatBytes(sizeLimit(what.kind)) }));
  const stored = await files.put(bytes);
  // text keeps its declared flavour (markdown, csv…) when the content is text
  const mime = what.kind === 'text' ? (f.type && f.type.startsWith('text/') ? f.type : what.mime) : what.mime;
  return {
    name,
    mime,
    size: stored.size,
    kind: what.kind,
    storageRef: stored.storageRef,
    sha256: stored.sha256,
    source: o.source,
    createdAt: Date.now(),
    ...(what.kind === 'text' ? { text: new TextDecoder().decode(bytes) } : { data: toBase64(bytes) }),
  };
}

/** a FileError's message, or a plain one */
export const fileMessage = (e: unknown) => (e instanceof FileError ? e.message : e instanceof Error ? e.message : String(e));

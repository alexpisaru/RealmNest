// ─────────────────────────────────────────────────────────────
// Attachments: files the user gives RealmNest (a chat message, an agent task).
//
//   text  (code, markdown, csv, json…)  → written into the message for every provider
//   image (png, jpeg, webp, gif)         → sent as an image to models that take one
//   pdf                                  → sent as a document to models that take one
//
// The bytes live in the FileStore (runtime/files/store.ts), by storageRef; the record never holds
// a host path. What a file IS comes from its content (magic bytes), not its name.
// docs/CHAT.md › Attachments and docs/FILES.md have the rules and limits.
// ─────────────────────────────────────────────────────────────

export type AttachmentKind = 'text' | 'image' | 'pdf';

/** how the file arrived */
export type AttachmentSource = 'picker' | 'drop' | 'paste' | 'artifact' | 'external';

/** stored on a ChatMessage or an AgentTask (no binary data, no host path) */
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  /** bytes of the original file */
  size: number;
  kind: AttachmentKind;
  /** the bytes in the FileStore (`sha256:<hex>`) */
  storageRef?: string;
  sha256?: string;
  source?: AttachmentSource;
  createdAt?: number;
  /** the Artifact it was made from (Use in Chat, Send to Agent) */
  artifactId?: string;
  /** the file's text, saved inside the message: only messages from before the FileStore */
  text?: string;
}

/** what a send carries: a stored file (storageRef), plus its bytes or text when the caller has them */
export interface AttachmentInput extends Omit<Attachment, 'id'> {
  /** base64 without a data: prefix (image / pdf): a cache, the FileStore has the file */
  data?: string;
}

export const ATTACHMENT_LIMITS = {
  files: 4,
  textBytes: 100_000,
  imageBytes: 5_000_000,
  pdfBytes: 10_000_000,
  totalBytes: 15_000_000,
} as const;

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

const TEXT_EXT = new Set(
  'txt md markdown csv tsv json jsonl yaml yml toml ini xml html htm css scss js mjs cjs jsx ts tsx py rb go rs java kt c h cpp hpp cs php sh ps1 bat sql log env gitignore svg r lua swift dart vue'.split(' '),
);

/** what kind of attachment a file is, or undefined when RealmNest cannot send it */
export function attachmentKind(name: string, mime: string): AttachmentKind | undefined {
  const m = mime.toLowerCase();
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if ((IMAGE_MIMES as readonly string[]).includes(m)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('text/') || m === 'application/json' || TEXT_EXT.has(ext)) return 'text';
  return undefined;
}

export function sizeLimit(kind: AttachmentKind): number {
  return kind === 'text' ? ATTACHMENT_LIMITS.textBytes : kind === 'image' ? ATTACHMENT_LIMITS.imageBytes : ATTACHMENT_LIMITS.pdfBytes;
}

/** why a set of attachments cannot be sent (undefined: it can) */
export function attachmentProblem(list: Pick<AttachmentInput, 'name' | 'size' | 'kind'>[]): string | undefined {
  if (list.length > ATTACHMENT_LIMITS.files) return `At most ${ATTACHMENT_LIMITS.files} attachments per message.`;
  for (const a of list) if (a.size > sizeLimit(a.kind)) return `${a.name} is larger than ${formatBytes(sizeLimit(a.kind))}.`;
  if (list.reduce((n, a) => n + a.size, 0) > ATTACHMENT_LIMITS.totalBytes) return `Attachments may add up to ${formatBytes(ATTACHMENT_LIMITS.totalBytes)} per message.`;
  return undefined;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * What kind an attachment really is, from its content: `sniffed` is the type its first bytes show
 * (runtime/files/mime.ts), `text` whether it is UTF-8 text. A file whose content contradicts its
 * name (a program renamed .pdf, a binary renamed .txt) is refused with a reason.
 */
export function contentKind(
  name: string,
  declaredKind: AttachmentKind | undefined,
  sniffed: string | undefined,
  text: boolean,
): { kind: AttachmentKind; mime: string } | { error: string; code: 'UNSUPPORTED_FILE_TYPE' | 'INVALID_FILE' } {
  if (sniffed && (IMAGE_MIMES as readonly string[]).includes(sniffed)) return { kind: 'image', mime: sniffed };
  if (sniffed === 'application/pdf') return { kind: 'pdf', mime: sniffed };
  if (sniffed === 'application/x-msdownload' || sniffed === 'application/x-elf') return { error: `${name} is a program: RealmNest never sends or runs programs.`, code: 'UNSUPPORTED_FILE_TYPE' };
  if (sniffed && sniffed !== 'image/svg+xml' && sniffed !== 'text/html') return { error: `${name} is not text, an image or a PDF (its content is ${sniffed}).`, code: 'UNSUPPORTED_FILE_TYPE' };
  if (declaredKind === 'image' || declaredKind === 'pdf') return { error: `${name} is not a real ${declaredKind === 'pdf' ? 'PDF' : 'image'} (its content does not match its name).`, code: 'INVALID_FILE' };
  if (text) return { kind: 'text', mime: sniffed ?? 'text/plain' };
  return { error: `${name} is not text, an image or a PDF.`, code: 'UNSUPPORTED_FILE_TYPE' };
}

/**
 * Text attachments written into a message, each in its own block. The text comes from the record
 * (older messages) or from `texts` (by attachment id); a file cannot close its block early.
 */
export function withTextAttachments(text: string, attachments: (Pick<Attachment, 'name' | 'kind' | 'text'> & { id?: string })[] = [], texts?: Map<string, string>): string {
  const files = attachments.flatMap((a) => {
    const body = a.text ?? (a.id ? texts?.get(a.id) : undefined);
    return a.kind === 'text' && body !== undefined ? [{ name: a.name, body }] : [];
  });
  if (!files.length) return text;
  const safe = (s: string) => s.replace(/<\/attachment/gi, '<\\/attachment');
  const blocks = files.map((a) => `<attachment name="${a.name.replace(/["<>\n]/g, "'")}">\n${safe(a.body)}\n</attachment>`);
  return [text.trim() || 'See the attached files.', ...blocks].join('\n\n');
}

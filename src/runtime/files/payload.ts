// Attachments as a provider gets them: text written into the message, images and PDFs as files.
// One implementation for chat turns and agent tasks; bytes come from a cache, else the FileStore.

import { withTextAttachments, type Attachment } from '../../domain/attachment';
import type { ProviderAttachment, ProviderMessage } from '../providers/types';
import { toBase64 } from './mime';
import type { FileStore } from './store';

export class AttachmentUnavailable extends Error {}

/** loads attachment contents, caching them by attachment id */
export class AttachmentReader {
  /** image / PDF bytes (base64) */
  readonly blobs = new Map<string, string>();
  /** text attachments' text */
  readonly texts = new Map<string, string>();
  constructor(private files?: FileStore) {}

  async text(a: Attachment): Promise<string | undefined> {
    if (a.text !== undefined) return a.text;
    const hit = this.texts.get(a.id);
    if (hit !== undefined) return hit;
    if (!a.storageRef || !this.files) return undefined;
    try {
      const t = new TextDecoder().decode(await this.files.get(a.storageRef));
      this.texts.set(a.id, t);
      return t;
    } catch {
      return undefined;
    }
  }

  async bytes(a: Attachment): Promise<string | undefined> {
    const hit = this.blobs.get(a.id);
    if (hit) return hit;
    if (!a.storageRef || !this.files) return undefined;
    try {
      const b64 = toBase64(await this.files.get(a.storageRef));
      this.blobs.set(a.id, b64);
      return b64;
    } catch {
      return undefined;
    }
  }

  forget(ids: Iterable<string>) {
    for (const id of ids) {
      this.blobs.delete(id);
      this.texts.delete(id);
    }
  }

  /**
   * A user message with its attachments. `strict`: a file that cannot be read throws
   * (AttachmentUnavailable) instead of becoming a note.
   */
  async message(content: string, attachments: Attachment[] = [], strict = true): Promise<ProviderMessage> {
    const files: ProviderAttachment[] = [];
    const notes: string[] = [];
    const texts = new Map<string, string>();
    for (const a of attachments) {
      if (a.kind === 'text') {
        const t = await this.text(a);
        if (t !== undefined) texts.set(a.id, t);
        else if (strict) throw new AttachmentUnavailable(`${a.name} is no longer available (its file is missing).`);
        else notes.push(`[${a.name} (text): its contents are no longer available]`);
        continue;
      }
      const data = await this.bytes(a);
      if (data) files.push({ kind: a.kind, name: a.name, mime: a.mime, data });
      else if (strict) throw new AttachmentUnavailable(`${a.name} is no longer available (its file is missing).`);
      else notes.push(`[${a.name} (${a.kind}): its contents are no longer available]`);
    }
    const body = [withTextAttachments(content, attachments, texts), ...notes].filter(Boolean).join('\n\n') || (files.length ? 'See the attached files.' : content);
    return { role: 'user', content: body, ...(files.length && { attachments: files }) };
  }
}

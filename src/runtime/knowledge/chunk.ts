// Chunking that follows the document: segments (headings, paragraphs, rows,
// PDF paragraphs) are packed up to a target size, never across a boundary
// (a page, a top-level section, the table), and a segment too long on its own
// is cut at sentence ends, then at spaces. A short overlap (same boundary
// only) keeps a sentence that straddles two chunks findable from both.
// Defaults: ~1,200 characters per chunk, hard maximum 2,000, overlap 150.

import { DEFAULT_CHUNKING, type ChunkingSettings, type KnowledgeChunk, type SourceLocation } from '../../domain/knowledge';
import type { ExtractedDocument, Segment } from './extract';

export const MAX_CHUNKS_PER_DOCUMENT = 6_000;

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** a long piece cut at sentence ends, then at spaces, each part ≤ max */
export function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.split(/(?<=[.!?…;:])\s+(?=\S)/);
  const out: string[] = [];
  let cur = '';
  const push = (s: string) => {
    if (s.length <= max) {
      if (cur && cur.length + 1 + s.length > max) {
        out.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
      return;
    }
    // one sentence longer than max: cut at the last space before the limit
    let rest = s;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(' ', max);
      const at = cut > max * 0.5 ? cut : max;
      push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) push(rest);
  };
  for (const s of sentences) push(s.trim());
  if (cur) out.push(cur);
  return out;
}

/** the tail of a chunk to repeat: whole sentences or words, at most `n` characters */
function tail(text: string, n: number): string {
  if (n <= 0 || text.length <= n) return '';
  const t = text.slice(-n);
  const sentence = t.search(/(?<=[.!?…])\s+\S/);
  if (sentence >= 0) return t.slice(sentence).trim();
  const space = t.indexOf(' ');
  return space >= 0 ? t.slice(space + 1) : '';
}

function merge(a: SourceLocation | undefined, b: SourceLocation): SourceLocation {
  if (!a) return { ...b };
  const out: SourceLocation = { ...a };
  if (b.page && !a.page) out.page = b.page;
  if (b.endLine) out.endLine = Math.max(a.endLine ?? 0, b.endLine);
  if (b.startLine && !a.startLine) out.startLine = b.startLine;
  if (b.rowEnd) out.rowEnd = Math.max(a.rowEnd ?? 0, b.rowEnd);
  if (b.rowStart && !a.rowStart) out.rowStart = b.rowStart;
  if (b.section && !a.section) out.section = b.section;
  return out;
}

export interface ChunkIds {
  documentId: string;
  knowledgeBaseId: string;
  generation: number;
}

export async function chunkDocument(doc: ExtractedDocument, ids: ChunkIds, settings: ChunkingSettings = DEFAULT_CHUNKING): Promise<KnowledgeChunk[]> {
  const target = Math.max(200, settings.targetChars);
  const max = Math.max(target, settings.maxChars);
  // segments too long on their own become several
  const pieces: Segment[] = doc.segments.flatMap((s) => splitLong(s.text, max).map((text) => ({ ...s, text })));
  const raw: { text: string; location: SourceLocation; boundary: string; overlap: string }[] = [];
  // body: the chunk has more than headings (a heading always stays with the text after it)
  let cur: { parts: string[]; location?: SourceLocation; boundary: string; size: number; body: boolean } | undefined;
  let prevText = '';
  let prevBoundary = '';
  const flush = () => {
    if (!cur?.parts.length) return;
    // a heading with nothing under it is not a source (the section path is on the next chunk)
    if (!cur.body) {
      cur = undefined;
      return;
    }
    const text = cur.parts.join(cur.boundary === 'table' ? '\n' : '\n\n');
    raw.push({ text, location: cur.location ?? {}, boundary: cur.boundary, overlap: cur.boundary === prevBoundary ? tail(prevText, settings.overlapChars) : '' });
    prevText = text;
    prevBoundary = cur.boundary;
    cur = undefined;
  };
  for (const s of pieces) {
    if (cur && (cur.boundary !== s.boundary || (cur.body && cur.size + s.text.length > target) || (s.heading && cur.body && cur.size > target * 0.3))) flush();
    if (!cur) cur = { parts: [], boundary: s.boundary, size: 0, body: false };
    cur.parts.push(s.text);
    cur.size += s.text.length + 2;
    if (!s.heading) cur.body = true;
    cur.location = merge(cur.location, s.location);
  }
  flush();
  if (raw.length > MAX_CHUNKS_PER_DOCUMENT) throw Object.assign(new Error(`This document makes ${raw.length} chunks; the limit is ${MAX_CHUNKS_PER_DOCUMENT}.`), { code: 'DOCUMENT_TOO_LARGE' });

  const chunks: KnowledgeChunk[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    // the section as a first line, when the chunk does not start with its heading
    const context = r.location.section && !r.text.startsWith('#') && !r.text.startsWith(r.location.section.split(' › ').pop()!) ? `[${r.location.section}]\n` : '';
    const text = `${context}${r.overlap ? `${r.overlap}\n` : ''}${r.text}`.slice(0, max + 400);
    const hash = await sha256(text);
    chunks.push({
      id: `${ids.documentId}:${ids.generation}:${i}:${hash.slice(0, 8)}`,
      documentId: ids.documentId,
      knowledgeBaseId: ids.knowledgeBaseId,
      ordinal: i,
      text,
      location: r.location,
      hash,
      tokenEstimate: Math.ceil(text.length / 4),
    });
  }
  return chunks;
}

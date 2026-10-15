// DocumentExtractor: one entry point from a stored file to text segments that
// keep their place in the original (page, lines, section, rows) — citations
// depend on it. Formats: plain text, Markdown, CSV / TSV, JSON, PDF with
// selectable text, DOCX. No OCR: a PDF without text is NO_EXTRACTABLE_TEXT.
// HTML and SVG are not indexed (markup, scripts): convert them to text first.

import type { KnowledgeErrorCode, SourceLocation } from '../../../domain/knowledge';
import { ExtractStop, InflateLimit, inflateCapped, WorkBudget, type ExtractOptions } from './budget';
import { extractPdfText } from './pdf';

export type { ExtractOptions } from './budget';

/** inflated bytes of word/document.xml (whatever size the zip declares) */
const MAX_DOCX_XML_BYTES = 64 * 1024 * 1024;

export const EXTRACT_LIMITS = {
  /** characters of text per document */
  chars: 4 * 1024 * 1024,
  segments: 60_000,
};

export type ExtractFormat = 'text' | 'markdown' | 'csv' | 'json' | 'pdf' | 'docx';

/** a piece of text with its place; chunks never cross a `boundary` (a page, a top-level section) */
export interface Segment {
  text: string;
  location: SourceLocation;
  boundary: string;
  heading?: boolean;
}

export interface ExtractedDocument {
  format: ExtractFormat;
  segments: Segment[];
  pages?: number;
  rows?: number;
  lines?: number;
  warnings: string[];
}

export class ExtractionError extends Error {
  constructor(
    readonly code: KnowledgeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** what a file is, from its bytes first and its name for text formats */
export function formatOf(name: string, mime: string, bytes: Uint8Array): ExtractFormat | undefined {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  const ext = extOf(name);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return ext === 'docx' ? 'docx' : undefined;
  if (mime === 'image/svg+xml' || mime === 'text/html' || ['svg', 'html', 'htm', 'xhtml'].includes(ext)) return undefined;
  if (['md', 'markdown', 'mdx'].includes(ext) || mime === 'text/markdown') return 'markdown';
  if (['csv', 'tsv'].includes(ext) || mime === 'text/csv') return 'csv';
  if (['json', 'jsonl'].includes(ext) || mime === 'application/json') return 'json';
  if (mime.startsWith('text/') || ['txt', 'text', 'log', 'yaml', 'yml', 'ini', 'toml', 'rst', 'adoc'].includes(ext)) return 'text';
  // an unknown name with text inside: plain text
  try {
    const t = decoder.decode(bytes.subarray(0, 4096));
    return /[\u0000-\u0008\u000e-\u001f]/.test(t) ? undefined : 'text';
  } catch {
    return undefined;
  }
}

/**
 * `o.signal` cancels and `o.deadline` bounds the time: PDF and DOCX extraction checks both while it
 * works (and yields to the UI), so a hostile file cannot hold the app.
 */
export async function extractDocument(name: string, mime: string, bytes: Uint8Array, o: ExtractOptions = {}): Promise<ExtractedDocument> {
  const format = formatOf(name, mime, bytes);
  if (!format) throw new ExtractionError('UNSUPPORTED_DOCUMENT', `${name}: this kind of file is not indexed (text, Markdown, CSV, JSON, PDF with text and DOCX are).`);
  let doc: ExtractedDocument;
  try {
    if (format === 'pdf') doc = await pdf(bytes, o);
    else if (format === 'docx') doc = await docx(bytes, o);
    else doc = text(name, format, bytes);
  } catch (e) {
    if (e instanceof ExtractStop) {
      if (e.kind === 'aborted') throw new ExtractionError('CANCELLED', 'Indexing was cancelled.');
      throw new ExtractionError('EXTRACTION_FAILED', `${name} could not be read safely: ${e.kind === 'timeout' ? 'it took too long' : 'it needs too much work'} (it may be damaged or built to stall readers).`);
    }
    if (e instanceof InflateLimit) throw new ExtractionError('DOCUMENT_TOO_LARGE', `${name}: ${e.message}.`);
    throw e;
  }
  doc.segments = doc.segments.filter((s) => s.text.trim());
  if (doc.segments.length > EXTRACT_LIMITS.segments) throw new ExtractionError('DOCUMENT_TOO_LARGE', `${name} is too large to index (${doc.segments.length} pieces).`);
  if (!doc.segments.length) throw new ExtractionError('NO_EXTRACTABLE_TEXT', format === 'pdf' ? `${name} has no selectable text (a scan or images only). RealmNest does not do OCR.` : `${name} has no text.`);
  return doc;
}

function text(name: string, format: Exclude<ExtractFormat, 'pdf' | 'docx'>, bytes: Uint8Array): ExtractedDocument {
  let text: string;
  try {
    text = decoder.decode(bytes).replace(/^﻿/, '');
  } catch {
    throw new ExtractionError('UNSUPPORTED_DOCUMENT', `${name} is not UTF-8 text.`);
  }
  if (text.length > EXTRACT_LIMITS.chars) throw new ExtractionError('DOCUMENT_TOO_LARGE', `${name} has ${Math.round(text.length / 1e6)}M characters; the limit is ${EXTRACT_LIMITS.chars / 1024 / 1024}M.`);
  return format === 'markdown' ? markdown(text) : format === 'csv' ? csv(text, extOf(name) === 'tsv' ? '\t' : undefined) : format === 'json' ? json(text) : plain(text, 'text');
}

// ── text and Markdown ──────────────────────────────────────

/** paragraphs (blank-line separated) with their line numbers */
function paragraphs(lines: string[], from = 1): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let buf: string[] = [];
  let start = 0;
  lines.forEach((l, i) => {
    if (!l.trim()) {
      if (buf.length) out.push({ text: buf.join('\n'), start, end: from + i - 1 });
      buf = [];
      return;
    }
    if (!buf.length) start = from + i;
    buf.push(l);
  });
  if (buf.length) out.push({ text: buf.join('\n'), start, end: from + lines.length - 1 });
  return out;
}

function plain(text: string, format: 'text'): ExtractedDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return { format, lines: lines.length, warnings: [], segments: paragraphs(lines).map((p) => ({ text: p.text, location: { startLine: p.start, endLine: p.end }, boundary: 'doc' })) };
}

function markdown(text: string): ExtractedDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const segments: Segment[] = [];
  // open headings, outermost first (a skipped level is simply absent)
  const stack: { level: number; title: string }[] = [];
  const path = () => stack.map((h) => h.title);
  // chunks never cross a second-level section: a citation names the section it came from
  const boundary = () => stack.slice(0, 2).map((h) => h.title).join(' / ') || 'doc';
  let buf: string[] = [];
  let start = 0;
  let fence = false;
  // frontmatter is metadata, not content
  let i0 = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i0 = end + 1;
  }
  const flush = (end: number) => {
    if (buf.length) segments.push({ text: buf.join('\n'), location: { startLine: start, endLine: end, ...(stack.length && { section: path().join(' › ') }) }, boundary: boundary() });
    buf = [];
  };
  for (let i = i0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      if (!buf.length) start = n;
      buf.push(line);
      fence = !fence;
      if (!fence) flush(n);
      continue;
    }
    if (fence) {
      buf.push(line);
      continue;
    }
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      flush(n - 1);
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title: h[2].trim() });
      segments.push({ text: line, location: { startLine: n, endLine: n, section: path().join(' › ') }, boundary: boundary(), heading: true });
      continue;
    }
    if (!line.trim()) {
      flush(n - 1);
      continue;
    }
    if (!buf.length) start = n;
    buf.push(line);
  }
  flush(lines.length);
  return { format: 'markdown', lines: lines.length, warnings: [], segments };
}

// ── CSV ────────────────────────────────────────────────────

/** RFC 4180 rows (quoted fields, doubled quotes, newlines inside quotes) */
export function parseCsv(text: string, sep?: string): string[][] {
  const delim = sep ?? (text.split('\n', 1)[0].split(';').length > text.split('\n', 1)[0].split(',').length ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && !field) quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function csv(text: string, sep?: string): ExtractedDocument {
  const rows = parseCsv(text, sep);
  if (!rows.length) return { format: 'csv', rows: 0, warnings: [], segments: [] };
  const header = rows[0].map((h, i) => h.trim() || `column ${i + 1}`);
  // each data row as "column: value" lines, so exact values and their meaning stay together
  const segments: Segment[] = rows.slice(1).map((r, i) => ({
    text: header.map((h, j) => (r[j]?.trim() ? `${h}: ${r[j].trim()}` : '')).filter(Boolean).join('; '),
    location: { rowStart: i + 2, rowEnd: i + 2 },
    boundary: 'table',
  }));
  return { format: 'csv', rows: rows.length - 1, warnings: rows.length > 1 ? [] : ['only a header row'], segments };
}

function json(text: string): ExtractedDocument {
  try {
    const v = JSON.parse(text);
    // one line: format it so it can be split; line numbers then refer to the formatted text
    if (!text.includes('\n')) {
      const doc = plain(JSON.stringify(v, null, 2), 'text');
      return { ...doc, format: 'json', warnings: ['line numbers refer to the formatted JSON'] };
    }
  } catch {
    // JSON Lines or invalid JSON: still text
  }
  return { ...plain(text, 'text'), format: 'json' };
}

// ── PDF ────────────────────────────────────────────────────

async function pdf(bytes: Uint8Array, o: ExtractOptions): Promise<ExtractedDocument> {
  const r = await extractPdfText(bytes, o);
  if (r.encrypted) throw new ExtractionError('UNSUPPORTED_DOCUMENT', 'This PDF is encrypted; RealmNest cannot read it.');
  const segments: Segment[] = [];
  let chars = 0;
  for (const page of r.pages) {
    for (const para of page.text.split(/\n{2,}/)) {
      const text = para.replace(/[ \t]*\n[ \t]*/g, ' ').trim();
      if (!text) continue;
      chars += text.length;
      segments.push({ text, location: { page: page.number }, boundary: `p${page.number}` });
    }
  }
  if (chars > EXTRACT_LIMITS.chars) throw new ExtractionError('DOCUMENT_TOO_LARGE', 'This PDF has too much text to index.');
  const empty = r.pages.filter((p) => !p.text.trim()).length;
  const warnings = [...r.warnings];
  if (empty && empty < r.pages.length) warnings.push(`${empty} of ${r.pages.length} pages have no selectable text (scans are not read: no OCR)`);
  return { format: 'pdf', pages: r.pages.length, warnings, segments };
}

// ── DOCX (a zip with word/document.xml) ─────────────────────

/** one entry of a zip, by name (central directory; stored or deflated); its declared size is not trusted */
async function zipEntry(b: Uint8Array, wanted: string, signal?: AbortSignal): Promise<Uint8Array | undefined> {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66_000); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return undefined;
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count && p + 46 <= b.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
    if (name !== wanted) continue;
    if (usize > MAX_DOCX_XML_BYTES || local + 30 > b.length) return undefined;
    const ln = view.getUint16(local + 26, true);
    const le = view.getUint16(local + 28, true);
    const data = b.subarray(local + 30 + ln + le, local + 30 + ln + le + csize);
    if (method === 0) return data;
    // the cap holds while inflating: a bomb declaring a small size stops at MAX_DOCX_XML_BYTES
    if (method === 8) return inflateCapped(data, 'deflate-raw', MAX_DOCX_XML_BYTES, signal);
    return undefined;
  }
  return undefined;
}

const xmlText = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d{1,7});/g, (_, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** a character reference that is not a code point is dropped (never a RangeError for the whole file) */
const codePoint = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

/** each `<w:p …>…</w:p>` in order, found with indexOf (linear: no regex rescanning to the end per paragraph) */
function* paragraphsOf(xml: string): Generator<string> {
  let at = 0;
  for (;;) {
    const open = xml.indexOf('<w:p', at);
    if (open < 0) return;
    const c = xml[open + 4];
    if (c !== ' ' && c !== '>') {
      at = open + 4;
      continue;
    }
    const close = xml.indexOf('</w:p>', open);
    // no closing tag anywhere after this one: none of the later openings has one either
    if (close < 0) return;
    yield xml.slice(open, close + 6);
    at = close + 6;
  }
}

async function docx(bytes: Uint8Array, o: ExtractOptions): Promise<ExtractedDocument> {
  const budget = new WorkBudget({ ...o, maxOps: Number.MAX_SAFE_INTEGER });
  const xml = await zipEntry(bytes, 'word/document.xml', o.signal);
  if (!xml) throw new ExtractionError('UNSUPPORTED_DOCUMENT', 'This is not a Word document RealmNest can read (word/document.xml is missing).');
  const text = new TextDecoder().decode(xml);
  const segments: Segment[] = [];
  const path: string[] = [];
  for (const p of paragraphsOf(text)) {
    if (budget.step()) await budget.pause();
    const body = xmlText(p.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:t>/g, '</w:t>'));
    if (!body.trim()) continue;
    // headings: Heading1…, Titolo1… (localized style ids end with the level)
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
    const lvl = /^(heading|titolo|berschrift|titre|ttulo)\s*(\d)$/i.exec(style)?.[2] ?? (/^title$/i.test(style) ? '1' : undefined);
    if (lvl) {
      path.length = Math.min(path.length, Number(lvl) - 1);
      path.push(body.trim());
      segments.push({ text: body.trim(), location: { section: path.join(' › ') }, boundary: path[0], heading: true });
      continue;
    }
    segments.push({ text: body.trim(), location: path.length ? { section: path.join(' › ') } : {}, boundary: path[0] ?? 'doc' });
  }
  return { format: 'docx', warnings: [], segments };
}

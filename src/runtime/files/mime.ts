// What a file is, from its content: magic bytes first (the same table as the native store,
// src-tauri/src/files/sniff.rs), the declared MIME and the name only to tell text formats apart.
// Pure, so the chat, the artifact service and the tests share it.

import type { ArtifactKind } from '../../domain/artifact';

/** the MIME type the first bytes show, or undefined (text, or nothing recognisable) */
export function sniffMime(b: Uint8Array): string | undefined {
  const starts = (...m: number[]) => m.every((v, i) => b[i] === v);
  const at = (i: number, s: string) => [...s].every((c, j) => b[i + j] === c.charCodeAt(0));
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 'GIF87a') || at(0, 'GIF89a')) return 'image/gif';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (at(0, 'RIFF') && at(8, 'WAVE')) return 'audio/wav';
  if (at(0, '%PDF-')) return 'application/pdf';
  if (starts(0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
  if (starts(0x1f, 0x8b)) return 'application/gzip';
  if (at(0, 'ID3')) return 'audio/mpeg';
  if (at(0, 'OggS')) return 'audio/ogg';
  if (at(0, 'fLaC')) return 'audio/flac';
  if (at(4, 'ftyp')) return 'video/mp4';
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  if (at(0, 'MZ')) return 'application/x-msdownload';
  if (starts(0x7f, 0x45, 0x4c, 0x46)) return 'application/x-elf';
  if (at(0, 'SQLite format 3')) return 'application/vnd.sqlite3';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 512)).replace(/^﻿/, '').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'text/html';
  return undefined;
}

/** UTF-8 text: no NUL byte and valid UTF-8 in the first 8 KB (a character cut at the edge is fine) */
export function looksLikeText(b: Uint8Array): boolean {
  const head = b.subarray(0, 8192);
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head.length === 8192 ? head.subarray(0, trimToBoundary(head)) : head);
    return true;
  } catch {
    return false;
  }
}
/** the length of `b` without a UTF-8 character cut off at its end */
function trimToBoundary(b: Uint8Array): number {
  let i = b.length - 1;
  let n = 0;
  while (i >= 0 && n < 4 && (b[i] & 0xc0) === 0x80) (i--, n++);
  if (i < 0) return b.length;
  const lead = b[i];
  const need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
  return need > n + 1 ? i : b.length;
}

/** kinds that would run something: never opened, never sent as text */
export const PROGRAM_MIMES = new Set(['application/x-msdownload', 'application/x-elf']);

const EXT_MIME: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', jsonl: 'application/jsonl',
  yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml', xml: 'application/xml', html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript',
  ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/javascript', py: 'text/x-python', svg: 'image/svg+xml', log: 'text/plain', sql: 'application/sql',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation', epub: 'application/epub+zip',
};
export const extOf = (name: string) => (name.includes('.') ? name.toLowerCase().split('.').pop()! : '');

/**
 * The MIME type to record: the content's when it shows one (a zip that is a .docx keeps the Office
 * type), else the extension's for text, else what was declared, else application/octet-stream.
 */
export function normalizeMime(name: string, declared: string | undefined, sniffed: string | undefined, text: boolean): string {
  const byExt = EXT_MIME[extOf(name)];
  if (sniffed === 'application/zip' && byExt && /officedocument|opendocument|epub/.test(byExt)) return byExt;
  if (sniffed) return sniffed;
  if (text) return byExt && !byExt.startsWith('image/') ? byExt : declared?.startsWith('text/') ? declared.toLowerCase() : 'text/plain';
  const d = declared?.toLowerCase().split(';')[0].trim();
  // a declared type that would need magic bytes we did not find is not trusted
  if (d && !/^(image|audio|video)\//.test(d) && d !== 'application/pdf' && d !== 'application/zip') return d;
  return 'application/octet-stream';
}

const CODE_EXT = new Set('js mjs cjs jsx ts tsx py rb go rs java kt c h cpp hpp cs php sh ps1 bat swift dart lua r sql vue scss css'.split(' '));

/** the Artifact kind a file belongs to (MIME first, the name only for text formats) */
export function artifactKind(mime: string, name: string): ArtifactKind {
  const m = mime.toLowerCase();
  const ext = extOf(name);
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf' || /wordprocessingml|opendocument\.text|msword|epub|rtf/.test(m)) return 'document';
  if (/spreadsheetml|opendocument\.spreadsheet|ms-excel/.test(m) || m === 'text/csv' || m === 'text/tab-separated-values') return 'spreadsheet';
  if (/presentationml|opendocument\.presentation|ms-powerpoint/.test(m)) return 'presentation';
  if (/zip|gzip|x-tar|x-7z|x-rar/.test(m)) return 'archive';
  if (/json|yaml|toml|xml|sqlite|jsonl/.test(m)) return 'data';
  if (m.startsWith('text/')) return CODE_EXT.has(ext) || /javascript|typescript|x-python/.test(m) ? 'code' : m === 'text/markdown' || m === 'text/plain' ? 'text' : 'text';
  return 'other';
}

/** lowercase hex SHA-256 of some bytes (Web Crypto) */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const toBase64 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

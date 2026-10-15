// Retrieval, provider-free:
//
//   lexical   BM25 over words, with codes kept whole (NX-74291, v2.3.1, ERR_FILE_CHANGED)
//             and also split, accents folded, a few stop words dropped
//   semantic  cosine similarity over embeddings (when the base has them)
//   fusion    reciprocal rank fusion of the two lists (k = 60)
//   rerank    deterministic: exact codes / phrases and heading matches (a Reranker,
//             so a model-based reranker can replace it later)
//
// Everything runs in memory over the base's chunks; the index is rebuilt from
// the stored chunk blobs when a base is first searched or changes.

import type { KnowledgeChunk } from '../../domain/knowledge';

const STOP = new Set(
  'a an and are as at be by for from has have in is it its of on or that the this to was were what when where which who why will with how di da del della delle dei degli il lo la le gli un una uno e ed o in su per con tra fra che chi cosa come quando dove perché è sono al alla alle ai agli nel nella nelle nei negli'.split(' '),
);

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** a token looks like an identifier (has a digit, or joins parts with - _ . / :) */
export const isCode = (t: string) => /\d/.test(t) || /[-_./:]/.test(t);

/**
 * a light, symmetric stem for plain words (never codes): English plurals ("reports" → "report")
 * and Italian endings ("progetti" / "progetto" → "progett", "italiano" → "italian"). Applied to
 * the index and the query alike, so it only ever widens matches between word forms.
 */
export function stem(w: string): string {
  if (w.length >= 5 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.length >= 6 && /[aeio]$/.test(w)) w = w.slice(0, -1);
  return w;
}

/** words and codes; a code is kept whole and its parts are added too */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of fold(text).matchAll(/[\p{L}\p{N}]+(?:[-_./:][\p{L}\p{N}]+)*/gu)) {
    const t = m[0];
    if (t.length > 64) continue;
    if (isCode(t) && /[-_./:]/.test(t)) {
      out.push(t);
      for (const p of t.split(/[-_./:]/)) if (p && !STOP.has(p)) out.push(p);
    } else if (!STOP.has(t)) out.push(isCode(t) ? t : stem(t));
  }
  return out;
}

/** anything that can be searched: Knowledge chunks, Memory entries */
export interface Indexed {
  id: string;
  text: string;
}

export interface Hit<T extends Indexed = KnowledgeChunk> {
  chunk: T;
  score: number;
  lexical?: number;
  semantic?: number;
}

/** BM25 over a set of chunks (or any Indexed items) */
export class LexicalIndex<T extends Indexed = KnowledgeChunk> {
  private docs: { chunk: T; len: number; tf: Map<string, number>; folded: string }[] = [];
  private df = new Map<string, number>();
  private avg = 1;

  constructor(chunks: T[]) {
    for (const chunk of chunks) {
      const toks = tokenize(chunk.text);
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ chunk, len: toks.length, tf, folded: fold(chunk.text) });
    }
    this.avg = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length) || 1;
  }

  get size() {
    return this.docs.length;
  }

  search(query: string, k: number): Hit<T>[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const N = this.docs.length;
    const k1 = 1.2;
    const b = 0.75;
    const hits: Hit<T>[] = [];
    for (const d of this.docs) {
      let s = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        // a code (NX-74291) found whole counts double: it is what the user is after
        const weight = isCode(t) && /[-_./:]/.test(t) ? 2 : 1;
        s += weight * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / this.avg)));
      }
      if (s > 0) hits.push({ chunk: d.chunk, score: s, lexical: s });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** chunks whose folded text contains `needle` exactly (codes, quoted phrases) */
  contains(needle: string): Set<string> {
    const n = fold(needle);
    return new Set(this.docs.filter((d) => d.folded.includes(n)).map((d) => d.chunk.id));
  }
}

/** cosine over unit vectors (vectors are normalized when stored) */
export function semanticSearch<T extends Indexed>(query: Float32Array, chunks: T[], vectors: Map<string, Float32Array>, k: number): Hit<T>[] {
  const hits: Hit<T>[] = [];
  for (const c of chunks) {
    const v = vectors.get(c.id);
    if (!v || v.length !== query.length) continue;
    let dot = 0;
    for (let i = 0; i < v.length; i++) dot += v[i] * query[i];
    hits.push({ chunk: c, score: dot, semantic: dot });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

/** reciprocal rank fusion: robust to the two scores living on different scales */
export function fuse<T extends Indexed>(lists: Hit<T>[][], k = 60): Hit<T>[] {
  const byId = new Map<string, Hit<T>>();
  for (const list of lists)
    list.forEach((h, rank) => {
      const prev = byId.get(h.chunk.id);
      const add = 1 / (k + rank + 1);
      if (prev) {
        prev.score += add;
        prev.lexical ??= h.lexical;
        prev.semantic ??= h.semantic;
      } else byId.set(h.chunk.id, { ...h, score: add });
    });
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

/** reorders fused hits; a model-based (cross-encoder) reranker can implement this later */
export interface Reranker {
  readonly name: string;
  rerank(query: string, hits: Hit[], ctx: { exact: (needle: string) => Set<string> }): Hit[];
}

/** deterministic: an exact code or quoted phrase outranks anything without it (+ the top score), then heading matches */
export const deterministicReranker: Reranker = {
  name: 'deterministic-v1',
  rerank(query, hits, ctx) {
    const codes = [...fold(query).matchAll(/[\p{L}\p{N}]+(?:[-_./:][\p{L}\p{N}]+)+|\b\w*\d\w*\b/gu)].map((m) => m[0]).filter((c) => c.length >= 3);
    const phrases = [...query.matchAll(/"([^"]{3,80})"/g)].map((m) => m[1]);
    const exact = [...codes, ...phrases].map((c) => ctx.exact(c));
    const words = tokenize(query).filter((t) => !isCode(t));
    const top = hits[0]?.score ?? 1;
    return hits
      .map((h) => {
        let bonus = 0;
        for (const set of exact) if (set.has(h.chunk.id)) bonus += top;
        const section = fold(h.chunk.location.section ?? '');
        if (section && words.some((w) => section.includes(w))) bonus += 0.1 * top;
        return { ...h, score: h.score + bonus };
      })
      .sort((a, b) => b.score - a.score);
  },
};

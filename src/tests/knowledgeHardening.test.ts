import { once } from 'node:events';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { MemoryFileStore } from '../runtime/files/store';
import { EmbeddingService, type EmbeddingProvider } from '../runtime/knowledge/embeddings';
import { extractDocument } from '../runtime/knowledge/extract';
import { InflateLimit, inflateCapped } from '../runtime/knowledge/extract/budget';
import { extractPdfText } from '../runtime/knowledge/extract/pdf';
import { KnowledgeService } from '../runtime/knowledge/service';

// Hardening (docs/HARDENING.md K-1…K-5, D-2): hostile PDFs and DOCX files finish fast or fail
// cleanly, extraction cannot crash-loop the app, a document replaced while indexing ends up
// indexed, stored records that do not parse do not stop the app, and caches stay bounded.

const utf8 = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: (string | Uint8Array)[]) => {
  const bs = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : p));
  const out = new Uint8Array(bs.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of bs) (out.set(b, o), (o += b.length));
  return out;
};
const timed = async <T>(f: () => Promise<T>) => {
  const t = Date.now();
  const r = await f();
  return { r, ms: Date.now() - t };
};

/** `mb` megabytes of zeros, deflated as they stream (the test never holds them uncompressed) */
async function zeros(mb: number, raw = false): Promise<Uint8Array> {
  const z = raw ? zlib.createDeflateRaw() : zlib.createDeflate();
  const out: Buffer[] = [];
  z.on('data', (c: Buffer) => out.push(c));
  const done = once(z, 'end');
  const chunk = Buffer.alloc(1 << 20);
  for (let i = 0; i < mb; i++) if (!z.write(chunk)) await once(z, 'drain');
  z.end();
  await done;
  return new Uint8Array(Buffer.concat(out));
}

/** a PDF from object bodies (object n is bodies[n - 1]); `extra` goes after them verbatim */
function pdf(bodies: (string | Uint8Array | { dict: string; stream: Uint8Array | string })[], extra: string | Uint8Array = ''): Uint8Array {
  const parts: (string | Uint8Array)[] = ['%PDF-1.4\n'];
  bodies.forEach((b, i) => {
    parts.push(`${i + 1} 0 obj\n`);
    if (typeof b === 'object' && 'dict' in b) {
      const data = typeof b.stream === 'string' ? utf8(b.stream) : b.stream;
      parts.push(`<< ${b.dict} /Length ${data.length} >>\nstream\n`, data, '\nendstream');
    } else parts.push(b);
    parts.push('\nendobj\n');
  });
  parts.push(extra, '\ntrailer << /Root 1 0 R >>\n%%EOF');
  return concat(...parts);
}

const catalog = '<< /Type /Catalog /Pages 2 0 R >>';
const onePage = (res = '') => `<< /Type /Page /Parent 2 0 R ${res} /Contents 4 0 R >>`;

describe('hostile PDFs', () => {
  it('a flate bomb stops at the cap while inflating (nothing collected first)', async () => {
    const bomb = await zeros(256);
    expect(bomb.length).toBeLessThan(2 * 1024 * 1024);
    const before = process.memoryUsage().arrayBuffers;
    const { ms } = await timed(() => expect(inflateCapped(bomb, 'deflate', 16 * 1024 * 1024)).rejects.toBeInstanceOf(InflateLimit));
    expect(ms).toBeLessThan(5_000);
    // far below the 256 MB the stream expands to
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(128 * 1024 * 1024);
  });

  it('a page whose content is a bomb: that stream is skipped, the rest of the page is read', async () => {
    const bomb = await zeros(64);
    const file = pdf([catalog, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /Contents [5 0 R 6 0 R] >>', '<< >>', { dict: '/Filter /FlateDecode', stream: bomb }, { dict: '', stream: 'BT 1 0 0 1 72 700 Tm (Hello after the bomb) Tj ET' }]);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(5_000);
    expect(r.pages[0].text).toContain('Hello after the bomb');
    expect(r.warnings.join(' ')).toMatch(/larger than 16 MB/);
  });

  it('thousands of unclosed arrays and dictionaries: each object is read only up to the next one', async () => {
    const junk = Array.from({ length: 20_000 }, (_, i) => `${i + 10} 0 obj\n[ /a /b (x) << /K [ 1 2 3 \n`).join('');
    const file = pdf([catalog, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', onePage(), { dict: '', stream: 'BT 1 0 0 1 72 700 Tm (Still readable) Tj ET' }], junk);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(3_000);
    expect(r.pages[0].text).toContain('Still readable');
  });

  it('forms fanning out into forms stop at the form budget', async () => {
    const dos = '/X Do '.repeat(300);
    const form = (next: number | undefined, body: string) => ({ dict: `/Type /XObject /Subtype /Form${next ? ` /Resources << /XObject << /X ${next} 0 R >> >>` : ''}`, stream: body });
    const file = pdf([
      catalog,
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      onePage('/Resources << /XObject << /X 5 0 R >> >>'),
      { dict: '', stream: `BT 1 0 0 1 72 700 Tm (Top text) Tj ET ${dos}` },
      form(6, dos),
      form(7, dos),
      form(undefined, 'BT 1 0 0 1 72 600 Tm (deep) Tj ET'),
    ]);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(5_000);
    expect(r.pages[0].text).toContain('Top text');
    expect(r.pages[0].text).toContain('deep');
    expect(r.warnings.join(' ')).toMatch(/too many forms/);
  });

  it('a ToUnicode CMap with thousands of full ranges (and absurd codes) is capped', async () => {
    const ranges = '<0000> <FFFF> <0041>\n'.repeat(5_000) + '<00> <FFFFFFFFFFFFFFFFFFFFFFFF> <0041>\n';
    const cmap = `begincmap\n1 begincodespacerange <0000> <FFFF> endcodespacerange\n5001 beginbfrange\n${ranges}endbfrange\nendcmap`;
    const file = pdf([
      catalog,
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      onePage('/Resources << /Font << /F1 5 0 R >> >>'),
      { dict: '', stream: 'BT /F1 12 Tf 1 0 0 1 72 700 Tm <0001> Tj ET' },
      '<< /Type /Font /Subtype /Type0 /ToUnicode 6 0 R >>',
      { dict: '', stream: cmap },
    ]);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(5_000);
    expect(r.pages[0].text).toBe('B');
  });

  it('many inline images are skipped in place (no copy of the rest of the stream per image)', async () => {
    const img = `BI /W 1 /H 1 ID ${'x'.repeat(2_000)} EI\n`;
    const file = pdf([catalog, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', onePage(), { dict: '', stream: `${img.repeat(4_000)}BT 1 0 0 1 72 700 Tm (after the images) Tj ET` }]);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(5_000);
    expect(r.pages[0].text).toContain('after the images');
  });

  it('a page tree whose kids point back at itself is walked once', async () => {
    const kids = Array.from({ length: 200 }, () => '2 0 R').join(' ');
    const file = pdf([catalog, `<< /Type /Pages /Kids [${kids} 3 0 R] >>`, onePage(), { dict: '', stream: 'BT 1 0 0 1 72 700 Tm (one page) Tj ET' }]);
    const { r, ms } = await timed(() => extractPdfText(file));
    expect(ms).toBeLessThan(2_000);
    expect(r.pages).toHaveLength(1);
  });

  it('extraction honours the AbortSignal and the deadline', async () => {
    const file = pdf([catalog, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', onePage(), { dict: '', stream: 'BT (x) Tj ET' }]);
    const ac = new AbortController();
    ac.abort();
    await expect(extractDocument('a.pdf', 'application/pdf', file, { signal: ac.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(extractDocument('a.pdf', 'application/pdf', file, { deadline: Date.now() - 1 })).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', message: expect.stringMatching(/could not be read safely/) });
  });
});

/** a zip with one entry (stored or deflated), declaring `usize` as its size */
function zip(name: string, data: Uint8Array, method: 0 | 8, usize = data.length): Uint8Array {
  const nm = utf8(name);
  const local = new Uint8Array(30 + nm.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, method, true);
  lv.setUint32(18, data.length, true);
  lv.setUint32(22, usize, true);
  lv.setUint16(26, nm.length, true);
  local.set(nm, 30);
  const cd = new Uint8Array(46 + nm.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, method, true);
  cv.setUint32(20, data.length, true);
  cv.setUint32(24, usize, true);
  cv.setUint16(28, nm.length, true);
  cd.set(nm, 46);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, local.length + data.length, true);
  return concat(local, data, cd, eocd);
}

describe('hostile DOCX files', () => {
  it('paragraphs without an end are found in linear time', async () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p>${'<w:p><w:r><w:t>x</w:t></w:r>'.repeat(150_000)}</w:body></w:document>`;
    const { r, ms } = await timed(() => extractDocument('a.docx', '', zip('word/document.xml', utf8(xml), 0)));
    expect(ms).toBeLessThan(3_000);
    expect(r.segments.map((s) => s.text)).toEqual(['Hello Word']);
  });

  it('a deflate bomb that declares a small size stops at the cap', async () => {
    const bomb = await zeros(200, true);
    const { ms } = await timed(() => expect(extractDocument('a.docx', '', zip('word/document.xml', bomb, 8, 1_000))).rejects.toMatchObject({ code: 'DOCUMENT_TOO_LARGE' }));
    expect(ms).toBeLessThan(5_000);
  });
});

// ── the service ──────────────────────────────────────────────

const SHA = (c: string) => `sha256:${c.repeat(64)}`;

/** a FileStore whose reads of one ref wait for `release()` */
class GatedStore extends MemoryFileStore {
  gate?: { ref: string; open: Promise<void> };
  private release_?: () => void;
  hold(ref: string) {
    this.gate = { ref, open: new Promise((r) => (this.release_ = r)) };
  }
  release() {
    this.release_?.();
  }
  override async get(ref: string) {
    if (this.gate?.ref === ref) await this.gate.open;
    return super.get(ref);
  }
}

async function service(storage = new MemoryAdapter(), files: MemoryFileStore = new MemoryFileStore()) {
  let n = 0;
  const k = new KnowledgeService(storage, files, new EventBus(500), undefined, { newId: (kind) => `${kind}-${++n}-${Math.random().toString(36).slice(2, 6)}` });
  await k.init();
  return { k, storage, files };
}

const baseRecord = { id: 'kb-1', name: 'Base', createdAt: 1, updatedAt: 1, settings: { retrievalMode: 'lexical' } };
const docRecord = (o: Record<string, unknown> = {}) => ({ id: 'kdoc-1', knowledgeBaseId: 'kb-1', name: 'bomb.pdf', mimeType: 'application/pdf', sourceType: 'local-file', storageRef: SHA('a'), sha256: 'a'.repeat(64), size: 10, status: 'extracting', createdAt: 1, updatedAt: 1, provenance: { addedBy: 'user' }, ...o });

describe('KnowledgeService hardening', () => {
  it('the attempt counter is saved before extracting; two interrupted attempts mark the document failed, not re-queued', async () => {
    // a read that never returns, like an extraction that takes the app down
    const files = new GatedStore();
    const storage = new MemoryAdapter();
    const { k } = await service(storage, files);
    const base = await k.createBase({ name: 'B' });
    const bytes = utf8('# Notes\n\nSome text worth keeping.');
    const stored = await files.put(bytes);
    files.hold(stored.storageRef);
    const doc = await k.addFile(base.id, { name: 'n.md', bytes });
    await new Promise((r) => setTimeout(r, 20));
    const saved = await storage.get<{ documents: { id: string; status: string; extractAttempts?: number }[] }>('knowledge');
    expect(saved!.documents.find((d) => d.id === doc.id)).toMatchObject({ status: 'extracting', extractAttempts: 1 });

    // restart once: tried again (attempt 2), still stuck
    const again = await service(storage, files);
    expect(again.k.jobs()).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 20));
    expect((await storage.get<{ documents: { extractAttempts?: number }[] }>('knowledge'))!.documents[0].extractAttempts).toBe(2);

    // restart twice: given up, not queued
    const third = await service(storage, files);
    expect(third.k.jobs()).toHaveLength(0);
    expect(third.k.document(doc.id)).toMatchObject({ status: 'failed', error: { code: 'EXTRACTION_FAILED', message: expect.stringMatching(/could not be read safely/) } });
    expect(JSON.stringify(await storage.get('knowledge'))).not.toContain('extractAttempts');
    files.release();
  });

  it('a finished extraction clears the counter', async () => {
    const { k, storage } = await service();
    const base = await k.createBase({ name: 'B' });
    await k.addFile(base.id, { name: 'n.md', bytes: utf8('# Notes\n\nSome text worth keeping.') });
    await k.idle();
    expect(JSON.stringify(await storage.get('knowledge'))).not.toContain('extractAttempts');
  });

  it('a document replaced while it is being indexed is indexed again with the new bytes; the stale index blob is dropped', async () => {
    const files = new GatedStore();
    const { k } = await service(new MemoryAdapter(), files);
    const base = await k.createBase({ name: 'B' });
    const v1 = utf8('# Old\n\nThe launch code is ALPHA-1.');
    const v2 = utf8('# New\n\nThe launch code is BRAVO-2.');
    const s1 = await files.put(v1);
    files.hold(s1.storageRef);
    const doc = await k.addFile(base.id, { name: 'code.md', bytes: v1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(k.document(doc.id)!.status).toBe('extracting');
    await k.updateFile(doc.id, v2);
    files.release();
    await k.idle();
    const d = k.document(doc.id)!;
    expect(d.status).toBe('ready');
    expect(d.index!.sourceSha256).toBe(d.sha256);
    expect((await k.search([base.id], 'BRAVO-2')).hits[0].chunk.text).toContain('BRAVO-2');
    expect((await k.search([base.id], 'ALPHA-1')).hits).toHaveLength(0);
    // the old source, the new source, the new index: the old run's chunks are gone
    expect(files.blobs.size).toBe(3);
  });

  it('cancel works while a replaced document waits: it settles, nothing stays queued', async () => {
    const files = new GatedStore();
    const { k } = await service(new MemoryAdapter(), files);
    const base = await k.createBase({ name: 'B' });
    const v1 = utf8('# Old\n\nText one.');
    const s1 = await files.put(v1);
    files.hold(s1.storageRef);
    const doc = await k.addFile(base.id, { name: 'c.md', bytes: v1 });
    await new Promise((r) => setTimeout(r, 10));
    await k.updateFile(doc.id, utf8('# New\n\nText two.'));
    k.cancel(doc.id);
    files.release();
    await k.idle();
    expect(k.document(doc.id)).toMatchObject({ status: 'failed', error: { code: 'CANCELLED' } });
    expect(k.jobs().some((j) => j.status === 'queued' || j.status === 'running')).toBe(false);
  });

  it('malformed stored values do not stop init (D-2)', async () => {
    for (const raw of [
      { bases: 'nope', documents: { a: 1 } },
      { bases: [null, 5, 'x', { id: 7 }, baseRecord], documents: [null, 3, { id: 'd0' }, docRecord({ id: 'd1', status: 'ready', index: 'broken' }), docRecord({ id: 'd2', status: 'ready', storageRef: 12 })] },
      'garbage',
      null,
    ]) {
      const storage = new MemoryAdapter();
      await storage.set('knowledge', raw);
      const { k } = await service(storage);
      expect(() => (k.listBases(), k.storageRefs(), k.jobs())).not.toThrow();
      if (typeof raw === 'object' && raw && Array.isArray(raw.bases)) {
        expect(k.base('kb-1')).toBeTruthy();
        expect(k.documents('kb-1').map((d) => d.id)).toEqual(['d1']);
        expect(k.document('d1')!.index).toBeUndefined();
        expect(k.stats('kb-1').documents).toBe(1);
      }
    }
  });

  it('old and surplus tombstones are purged at start', async () => {
    const day = 86_400_000;
    const now = Date.now();
    const docs = [docRecord({ id: 'old', status: 'removed', removedAt: now - 400 * day }), ...Array.from({ length: 1_005 }, (_, i) => docRecord({ id: `t${i}`, status: 'removed', removedAt: now - i * 1000 })), docRecord({ id: 'live', status: 'failed' })];
    const storage = new MemoryAdapter();
    await storage.set('knowledge', { version: 1, bases: [baseRecord], documents: docs });
    const { k } = await service(storage);
    const all = k.documents('kb-1', { removed: true });
    expect(all.filter((d) => d.removedAt)).toHaveLength(1_000);
    expect(k.document('old')).toBeUndefined();
    expect(k.document('t1004')).toBeUndefined();
    expect(k.document('t0')).toBeTruthy();
    expect(k.document('live')).toBeTruthy();
  });
});

describe('EmbeddingService hardening', () => {
  const rig = (embed: EmbeddingProvider['embed']) => {
    const calls: string[][] = [];
    const provider: EmbeddingProvider = { providerId: 'p', maxInputs: 64, maxChars: 1e6, models: async () => [], embed: (c, m, texts) => (calls.push(texts), embed(c, m, texts)) };
    const service = new EmbeddingService(() => ({ provider, providerId: 'p', available: true, name: 'P' }), () => ({ connectionId: 'c', modelId: 'm' }));
    return { service, calls, target: service.resolve({ connectionId: 'auto' }) };
  };
  const vec = async (_c: string, _m: string, texts: string[]) => ({ vectors: texts.map(() => new Float32Array([1, 0])), dimensions: 2, model: 'm', usage: { requests: 1 } });

  it('a hung embedding request stops blocking as soon as the job is cancelled', async () => {
    const { service, target } = rig(() => new Promise(() => undefined));
    const ac = new AbortController();
    const p = service.embedAll(target, [{ text: 'a', hash: 'a' }], { signal: ac.signal });
    setTimeout(() => ac.abort(), 10);
    await expect(p).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('the session cache is bounded (least recently used goes first)', async () => {
    const { service, target, calls } = rig(vec);
    const items = Array.from({ length: 5_001 }, (_, i) => ({ text: `t${i}`, hash: `h${i}` }));
    await service.embedAll(target, items);
    const before = calls.flat().length;
    // the newest is still cached, the oldest was evicted
    await service.embedAll(target, [items[5_000]]);
    expect(calls.flat().length).toBe(before);
    await service.embedAll(target, [items[0]]);
    expect(calls.flat().length).toBe(before + 1);
  });
});

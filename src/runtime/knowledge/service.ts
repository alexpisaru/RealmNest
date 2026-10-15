// ─────────────────────────────────────────────────────────────
// KnowledgeService: bases, documents, indexing jobs, search, and what a run
// retrieved and cited.
//
//   add (file / Attachment / Artifact) → KnowledgeDocument (a reference to FileStore bytes)
//        → job: extract → chunk → (embed) → store generation blobs → swap atomically
//   search(bases, query) → lexical BM25 (+ cosine when the base is hybrid) → RRF → rerank
//   a run: beginRun → sources labelled K1…Kn (unique per run) → finishRun → citations
//          resolved and validated, grounding checked, KnowledgeRunRecord
//
// Metadata lives in storage (key "knowledge"); chunk text and vectors are
// FileStore blobs referenced from each document's current index generation.
// A failed or cancelled reindex keeps the previous generation searchable.
// Sources are never deleted by Knowledge: removing a document drops the
// reference (the bytes go when nothing else uses them).
// docs/KNOWLEDGE.md.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import {
  DEFAULT_CHUNKING,
  DOCS_BASE_ID,
  type DocumentIndex,
  type EmbeddingChoice,
  type EmbeddingIdentity,
  type KnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type KnowledgeErrorCode,
  type KnowledgeMode,
  type KnowledgeRunRecord,
  type KnowledgeSelection,
  type KnowledgeSourceType,
  type RetrievalMode,
  type RetrievedSource,
} from '../../domain/knowledge';
import type { StorageAdapter } from '../../persistence/storage';
import { FileError, MAX_FILE_BYTES, type FileStore } from '../files/store';
import { chunkDocument } from './chunk';
import { EmbeddingError, type EmbeddingService, type EmbeddingUsage } from './embeddings';
import { ExtractionError, extractDocument, formatOf } from './extract';
import { resolveCitations, verifyGrounding } from './grounding';
import { knowledgeRules, sourcesBlock } from './prompt';
import { deterministicReranker, fuse, LexicalIndex, normalize, semanticSearch, type Hit, type Reranker } from './search';

const KEY = 'knowledge';
export const KNOWLEDGE_SCHEMA = 1;

export const KNOWLEDGE_LIMITS = {
  bases: 100,
  documentsPerBase: 500,
  /** one source file */
  documentBytes: 25 * 1024 * 1024,
  /** results one search returns to a model */
  resultsDefault: 6,
  resultsMax: 12,
  /** characters of source text one search hands to a model */
  resultChars: 14_000,
  /** distinct sources one run may be given (labels K1…) */
  sourcesPerRun: 60,
  /** searches one run may make */
  searchesPerRun: 12,
  queryChars: 500,
} as const;

/** a vectors blob holds whole vectors, at most this many bytes */
const VECTOR_PART_BYTES = 16 * 1024 * 1024;
/** extraction attempts that never finished (the app closed or crashed meanwhile) before a document is given up */
const MAX_EXTRACT_ATTEMPTS = 2;
/** how long one document's text extraction may take */
const EXTRACT_TIME_MS = 120_000;
/** removed documents kept as tombstones (for old citations): this many, for this long */
const MAX_TOMBSTONES = 1_000;
const TOMBSTONE_DAYS = 180;
/** bases whose search index stays in memory (the least recently searched goes first) */
const LOADED_BASES = 8;

/** the stored record, plus the extraction attempts started and not finished (crash-loop guard) */
type StoredDocument = KnowledgeDocument & { extractAttempts?: number };

export class KnowledgeError extends Error {
  constructor(
    readonly code: KnowledgeErrorCode | 'BASE_NOT_FOUND' | 'DOCUMENT_NOT_FOUND' | 'DUPLICATE_DOCUMENT' | 'LIMIT_REACHED' | 'READ_ONLY' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
  }
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface IndexJob {
  id: string;
  documentId: string;
  baseId: string;
  status: JobStatus;
  stage?: 'extracting' | 'embedding' | 'indexing';
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: { code: string; message: string };
  chunks?: number;
  embedded?: number;
  reused?: number;
  /** what the provider reported for this job's embeddings (never estimated) */
  usage?: EmbeddingUsage;
}

/** an artifact as Knowledge needs to see it (stale detection, add from Artifact) */
export interface ArtifactView {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageRef?: string;
  sha256?: string;
  deletedAt?: number;
}

export interface KnowledgeServiceOptions {
  now?: () => number;
  newId?: (kind: 'kb' | 'kdoc' | 'job') => string;
  /** RealmNest Docs: product documentation shipped with the build (lexical, in memory) */
  builtIn?: () => { name: string; text: string }[];
  artifact?: (id: string) => ArtifactView | undefined;
  /** the reranker after fusion (deterministic by default) */
  reranker?: Reranker;
}

interface KnowledgeSnapshot {
  version: number;
  bases: KnowledgeBase[];
  documents: KnowledgeDocument[];
}

/** a base's searchable index, rebuilt from the blobs when its documents change */
interface LoadedBase {
  key: string;
  chunks: KnowledgeChunk[];
  lexical: LexicalIndex;
  vectors: Map<string, Float32Array>;
  /** the identity the vectors in `vectors` share (hybrid bases) */
  identity?: EmbeddingIdentity;
  /** documents with chunks but no vectors of that identity (searched by words only) */
  lexicalOnlyDocs: number;
}

export interface SearchResult {
  hits: (Hit & { generation: number; documentName: string })[];
  /** some base that should search by meaning searched by words only */
  lexicalOnly: boolean;
  notes: string[];
}

/** what a run knows about Knowledge while it runs */
interface RunSession {
  runId: string;
  baseIds: string[];
  mode: KnowledgeMode;
  labels: Map<string, string>;
  retrieved: Map<string, RetrievedSource>;
  queries: KnowledgeRunRecord['queries'];
  embeddings: KnowledgeRunRecord['embeddings'];
  searches: number;
}

let counter = 0;
const defaultId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
const utf8 = new TextEncoder();
const decoder = new TextDecoder();
const BUSY: KnowledgeDocument['status'][] = ['pending', 'extracting', 'embedding', 'indexing'];

export class KnowledgeService {
  private bases = new Map<string, KnowledgeBase>();
  private docs = new Map<string, KnowledgeDocument>();
  private loaded = new Map<string, LoadedBase>();
  private builtInChunks = new Map<string, KnowledgeChunk[]>();
  private jobsList: IndexJob[] = [];
  private queue: string[] = [];
  private running?: { job: IndexJob; ac: AbortController };
  private sessions = new Map<string, RunSession>();
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;
  private newId: (kind: 'kb' | 'kdoc' | 'job') => string;
  private reranker: Reranker;
  private ready = false;

  constructor(
    private storage: StorageAdapter,
    private files: FileStore,
    private bus: EventBus,
    private embeddings?: EmbeddingService,
    private opts: KnowledgeServiceOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
    this.reranker = opts.reranker ?? deterministicReranker;
  }

  async init() {
    const raw = await this.storage.get<Partial<KnowledgeSnapshot>>(KEY);
    // a damaged record is skipped, never a reason for the app not to start
    for (const b of Array.isArray(raw?.bases) ? raw.bases : [])
      if (b && typeof b === 'object' && typeof b.id === 'string' && typeof b.name === 'string' && !b.builtIn)
        this.bases.set(b.id, { ...b, settings: { retrievalMode: b.settings?.retrievalMode === 'hybrid' ? 'hybrid' : 'lexical', chunking: b.settings?.chunking ?? DEFAULT_CHUNKING, ...(b.settings?.embedding && { embedding: b.settings.embedding }) } });
    for (const d of Array.isArray(raw?.documents) ? raw.documents : []) if (validDocument(d) && this.bases.has(d.knowledgeBaseId)) this.docs.set(d.id, d);
    await this.loadBuiltIn();
    this.ready = true;
    this.checkStale();
    let gaveUp = false;
    for (const d of this.docs.values() as Iterable<StoredDocument>) {
      if (!BUSY.includes(d.status) || d.removedAt) continue;
      // extraction started and never finished, twice: the file likely crashes or stalls the reader
      if ((d.extractAttempts ?? 0) >= MAX_EXTRACT_ATTEMPTS) {
        d.status = 'failed';
        d.error = { code: 'EXTRACTION_FAILED', message: `${d.name} could not be read safely: reading it stopped RealmNest twice. Replace the file to try again.` };
        delete d.extractAttempts;
        gaveUp = true;
        continue;
      }
      // work interrupted by a restart starts again (a previous generation stays searchable meanwhile)
      this.enqueue(d);
    }
    if (this.purgeTombstones() || gaveUp) await this.persist();
    this.changed();
  }

  /** old tombstones go: older than TOMBSTONE_DAYS, or beyond MAX_TOMBSTONES (the oldest first) */
  private purgeTombstones(): boolean {
    const removed = [...this.docs.values()].filter((d) => d.removedAt).sort((a, b) => b.removedAt! - a.removedAt!);
    const cutoff = this.now() - TOMBSTONE_DAYS * 86_400_000;
    let any = false;
    removed.forEach((d, i) => {
      if (i >= MAX_TOMBSTONES || d.removedAt! < cutoff) {
        this.docs.delete(d.id);
        any = true;
      }
    });
    return any;
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private async persist() {
    const snap: KnowledgeSnapshot = { version: KNOWLEDGE_SCHEMA, bases: [...this.bases.values()].filter((b) => !b.builtIn), documents: [...this.docs.values()].filter((d) => this.bases.get(d.knowledgeBaseId) && !this.bases.get(d.knowledgeBaseId)!.builtIn) };
    await this.storage.set(KEY, snap);
  }

  // ── reading ──────────────────────────────────────────────
  listBases(): KnowledgeBase[] {
    return [...this.bases.values()].sort((a, b) => Number(!!b.builtIn) - Number(!!a.builtIn) || b.updatedAt - a.updatedAt);
  }
  base(id: string) {
    return this.bases.get(id);
  }
  /** a base's documents (tombstones only when asked) */
  documents(baseId: string, o: { removed?: boolean } = {}): KnowledgeDocument[] {
    return [...this.docs.values()].filter((d) => d.knowledgeBaseId === baseId && (o.removed || !d.removedAt)).sort((a, b) => b.createdAt - a.createdAt);
  }
  document(id: string) {
    return this.docs.get(id);
  }
  jobs(): IndexJob[] {
    return this.jobsList;
  }
  /** what a base holds, for cards and Debug */
  stats(baseId: string) {
    const docs = this.documents(baseId);
    return {
      documents: docs.length,
      ready: docs.filter((d) => d.status === 'ready').length,
      failed: docs.filter((d) => d.status === 'failed').length,
      stale: docs.filter((d) => d.status === 'stale').length,
      busy: docs.filter((d) => BUSY.includes(d.status)).length,
      chunks: docs.reduce((n, d) => n + (d.index?.chunkCount ?? 0), 0),
      bytes: docs.reduce((n, d) => n + d.size, 0),
      lexicalOnly: docs.filter((d) => d.index && !d.index.vectorRefs?.length).length,
    };
  }
  /** every stored file Knowledge references: sources and index blobs (the FileStore keeps these) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const d of this.docs.values()) {
      if (this.bases.get(d.knowledgeBaseId)?.builtIn) continue;
      if (!d.removedAt && d.storageRef.startsWith('sha256:')) out.add(d.storageRef);
      if (d.index) {
        out.add(d.index.chunksRef);
        d.index.vectorRefs?.forEach((r) => out.add(r));
      }
    }
    return out;
  }
  /** chunks of a document's current generation (detail view, "open at source") */
  async chunks(documentId: string): Promise<KnowledgeChunk[]> {
    const d = this.docs.get(documentId);
    if (!d?.index) return [];
    return this.readChunks(d);
  }

  // ── bases ────────────────────────────────────────────────
  async createBase(input: { name: string; description?: string; retrievalMode?: RetrievalMode; embedding?: EmbeddingChoice }): Promise<KnowledgeBase> {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new KnowledgeError('INVALID_INPUT', 'Give the knowledge base a name.');
    if ([...this.bases.values()].filter((b) => !b.builtIn).length >= KNOWLEDGE_LIMITS.bases) throw new KnowledgeError('LIMIT_REACHED', `At most ${KNOWLEDGE_LIMITS.bases} knowledge bases.`);
    const t = this.now();
    const base: KnowledgeBase = {
      id: this.newId('kb'),
      name,
      ...(input.description?.trim() && { description: input.description.trim().slice(0, 400) }),
      createdAt: t,
      updatedAt: t,
      settings: { retrievalMode: input.retrievalMode ?? 'lexical', chunking: { ...DEFAULT_CHUNKING }, ...(input.retrievalMode === 'hybrid' && { embedding: input.embedding ?? { connectionId: 'auto' } }) },
    };
    this.bases.set(base.id, base);
    await this.persist();
    this.bus.emit('knowledge.base.created', { baseId: base.id, retrievalMode: base.settings.retrievalMode });
    this.changed();
    return base;
  }

  /**
   * Change a base. A different retrieval mode or embedding model makes every document stale
   * (its vectors no longer match); nothing is re-embedded until the user re-indexes.
   */
  async updateBase(id: string, patch: { name?: string; description?: string; retrievalMode?: RetrievalMode; embedding?: EmbeddingChoice }) {
    const b = this.requireBase(id, true);
    const fields: string[] = [];
    if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== b.name) ((b.name = patch.name.trim().slice(0, 80)), fields.push('name'));
    if (patch.description !== undefined && patch.description.trim() !== (b.description ?? '')) {
      if (patch.description.trim()) b.description = patch.description.trim().slice(0, 400);
      else delete b.description;
      fields.push('description');
    }
    const mode = patch.retrievalMode ?? b.settings.retrievalMode;
    const emb = mode === 'hybrid' ? (patch.embedding ?? b.settings.embedding ?? { connectionId: 'auto' }) : undefined;
    const embChanged = JSON.stringify(emb ?? null) !== JSON.stringify(b.settings.embedding ?? null);
    if (mode !== b.settings.retrievalMode || embChanged) {
      fields.push(mode !== b.settings.retrievalMode ? 'retrievalMode' : 'embedding');
      b.settings = { ...b.settings, retrievalMode: mode, ...(emb ? { embedding: emb } : {}) };
      if (!emb) delete b.settings.embedding;
      // a different model: the old vectors can never be compared with new queries
      if (mode === 'lexical' || embChanged) delete b.embeddingIdentity;
      for (const d of this.documents(id)) if (d.index && (d.status === 'ready' || d.status === 'stale')) this.markStale(d, mode === 'hybrid' ? 'The embedding settings changed: re-index to search by meaning.' : 'The base is now lexical: re-index to drop its vectors.');
    }
    if (!fields.length) return b;
    b.updatedAt = this.now();
    this.loaded.delete(id);
    await this.persist();
    this.bus.emit('knowledge.base.updated', { baseId: id, fields });
    this.changed();
    return b;
  }

  /** delete a base and its documents and index blobs (never the source files themselves) */
  async deleteBase(id: string) {
    this.requireBase(id, true);
    const docs = [...this.docs.values()].filter((d) => d.knowledgeBaseId === id);
    for (const d of docs) this.cancelJobs(d.id);
    const blobs = docs.flatMap((d) => indexRefs(d.index));
    docs.forEach((d) => this.docs.delete(d.id));
    this.bases.delete(id);
    this.loaded.delete(id);
    await this.persist();
    await this.dropBlobs(blobs);
    this.bus.emit('knowledge.base.deleted', { baseId: id, documents: docs.length });
    this.changed();
  }

  // ── documents ────────────────────────────────────────────
  /** a file the user picked: its bytes go into the FileStore */
  async addFile(baseId: string, file: { name: string; mime?: string; bytes: Uint8Array }): Promise<KnowledgeDocument> {
    this.requireBase(baseId, true);
    if (file.bytes.length > KNOWLEDGE_LIMITS.documentBytes) throw new KnowledgeError('DOCUMENT_TOO_LARGE', `${file.name} is larger than ${KNOWLEDGE_LIMITS.documentBytes / 1024 / 1024} MB.`);
    this.checkFormat(file.name, file.mime ?? '', file.bytes);
    const stored = await this.files.put(file.bytes);
    return this.addStored(baseId, { name: file.name, mimeType: file.mime || stored.mime || guessMime(file.name), storageRef: stored.storageRef, sha256: stored.sha256, size: stored.size, sourceType: 'local-file', provenance: { addedBy: 'user' } });
  }

  /** an Attachment of a chat or task (its bytes are shared, not copied) */
  async addAttachment(baseId: string, a: { id: string; name: string; mime: string; size: number; storageRef?: string; sha256?: string }, from: { conversationId?: string; taskId?: string; runId?: string } = {}) {
    if (!a.storageRef || !a.sha256) throw new KnowledgeError('SOURCE_MISSING', `${a.name} has no stored file (attachments from before the file store cannot be indexed).`);
    await this.checkStored(a.name, a.mime, a.storageRef);
    return this.addStored(baseId, { name: a.name, mimeType: a.mime, storageRef: a.storageRef, sha256: a.sha256, size: a.size, sourceType: 'attachment', sourceId: a.id, provenance: { addedBy: 'user', attachmentId: a.id, ...from } });
  }

  /**
   * A web page the user chose to keep (never automatic): its readable text as a Markdown
   * document that says where and when it was read. The page stays untrusted content.
   */
  async addWebPage(baseId: string, p: { finalUrl: string; domain: string; title?: string; text: string; fetchedAt: number; publishedAt?: string; author?: string }): Promise<KnowledgeDocument> {
    this.requireBase(baseId, true);
    const title = (p.title ?? p.domain).replace(/\s+/g, ' ').trim().slice(0, 160);
    const body = p.text.replace(/^#\s[^\n]*\n+/, '');
    const md = [`# ${title}`, '', `Source: ${p.finalUrl}`, `Read on: ${new Date(p.fetchedAt).toISOString()}`, ...(p.publishedAt ? [`Published: ${p.publishedAt}`] : []), ...(p.author ? [`Author: ${p.author}`] : []), '', body].join('\n');
    const bytes = utf8.encode(md);
    if (bytes.length > KNOWLEDGE_LIMITS.documentBytes) throw new KnowledgeError('DOCUMENT_TOO_LARGE', 'This page is too large to keep.');
    const stored = await this.files.put(bytes);
    const name = `${(title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || p.domain).slice(0, 80)}.md`;
    return this.addStored(baseId, { name, mimeType: 'text/markdown', storageRef: stored.storageRef, sha256: stored.sha256, size: stored.size, sourceType: 'web', provenance: { addedBy: 'user', url: p.finalUrl, fetchedAt: p.fetchedAt } });
  }

  /** an Artifact (its bytes are shared; a newer version of it makes the document stale) */
  async addArtifact(baseId: string, artifactId: string) {
    const a = this.opts.artifact?.(artifactId);
    if (!a || a.deletedAt || !a.storageRef || !a.sha256) throw new KnowledgeError('SOURCE_MISSING', 'That artifact no longer has its file.');
    await this.checkStored(a.name, a.mimeType, a.storageRef);
    return this.addStored(baseId, { name: a.name, mimeType: a.mimeType, storageRef: a.storageRef, sha256: a.sha256, size: a.size, sourceType: 'artifact', sourceId: a.id, provenance: { addedBy: 'user', artifactId: a.id } });
  }

  private async checkStored(name: string, mime: string, ref: string) {
    let bytes: Uint8Array;
    try {
      bytes = await this.files.get(ref);
    } catch {
      throw new KnowledgeError('SOURCE_MISSING', `${name}: its file is missing.`);
    }
    if (bytes.length > KNOWLEDGE_LIMITS.documentBytes) throw new KnowledgeError('DOCUMENT_TOO_LARGE', `${name} is larger than ${KNOWLEDGE_LIMITS.documentBytes / 1024 / 1024} MB.`);
    this.checkFormat(name, mime, bytes);
  }

  private checkFormat(name: string, mime: string, bytes: Uint8Array) {
    const f = formatOf(name, mime, bytes);
    if (!f) throw new KnowledgeError('UNSUPPORTED_DOCUMENT', `${name}: Knowledge reads text, Markdown, CSV, JSON, PDF (with a text layer) and DOCX.`);
  }

  private async addStored(baseId: string, input: { name: string; mimeType: string; storageRef: string; sha256: string; size: number; sourceType: KnowledgeSourceType; sourceId?: string; provenance: KnowledgeDocument['provenance'] }): Promise<KnowledgeDocument> {
    this.requireBase(baseId, true);
    const live = this.documents(baseId);
    if (live.length >= KNOWLEDGE_LIMITS.documentsPerBase) throw new KnowledgeError('LIMIT_REACHED', `At most ${KNOWLEDGE_LIMITS.documentsPerBase} documents per base.`);
    const dup = live.find((d) => d.sha256 === input.sha256);
    if (dup) throw new KnowledgeError('DUPLICATE_DOCUMENT', `This file is already in the base (${dup.name}).`);
    const t = this.now();
    const doc: KnowledgeDocument = {
      id: this.newId('kdoc'),
      knowledgeBaseId: baseId,
      name: input.name.slice(0, 200),
      mimeType: input.mimeType,
      sourceType: input.sourceType,
      ...(input.sourceId && { sourceId: input.sourceId }),
      storageRef: input.storageRef,
      sha256: input.sha256,
      size: input.size,
      status: 'pending',
      createdAt: t,
      updatedAt: t,
      provenance: input.provenance,
    };
    this.docs.set(doc.id, doc);
    this.touchBase(baseId);
    await this.persist();
    this.bus.emit('knowledge.document.added', { baseId, documentId: doc.id, sourceType: doc.sourceType, size: doc.size });
    this.enqueue(doc);
    this.changed();
    return doc;
  }

  /** a newer version of a local file: replaces the source and re-indexes (same bytes: nothing to do) */
  async updateFile(documentId: string, bytes: Uint8Array) {
    const d = this.requireDoc(documentId);
    if (d.sourceType !== 'local-file') throw new KnowledgeError('INVALID_INPUT', 'Only documents added from a file can be replaced by a file.');
    if (bytes.length > KNOWLEDGE_LIMITS.documentBytes) throw new KnowledgeError('DOCUMENT_TOO_LARGE', `The file is larger than ${KNOWLEDGE_LIMITS.documentBytes / 1024 / 1024} MB.`);
    this.checkFormat(d.name, d.mimeType, bytes);
    const stored = await this.files.put(bytes);
    if (stored.sha256 === d.sha256) return { changed: false };
    Object.assign(d, { storageRef: stored.storageRef, sha256: stored.sha256, size: stored.size, updatedAt: this.now() });
    delete (d as StoredDocument).extractAttempts;
    this.markStale(d, 'The file was replaced.');
    this.enqueue(d);
    await this.persist();
    this.changed();
    return { changed: true };
  }

  /** an Artifact source that changed: take its current bytes, then re-index */
  private refreshFromArtifact(d: KnowledgeDocument): boolean {
    if (d.sourceType !== 'artifact' || !d.sourceId) return false;
    const a = this.opts.artifact?.(d.sourceId);
    if (!a || a.deletedAt || !a.storageRef || !a.sha256 || a.sha256 === d.sha256) return false;
    Object.assign(d, { storageRef: a.storageRef, sha256: a.sha256, size: a.size, updatedAt: this.now() });
    return true;
  }

  /** re-index one document, or every document of a base */
  async reindex(target: { documentId?: string; baseId?: string }) {
    const docs = target.documentId ? [this.requireDoc(target.documentId)] : this.documents(target.baseId!);
    for (const d of docs) {
      if (d.removedAt || this.bases.get(d.knowledgeBaseId)?.builtIn) continue;
      this.refreshFromArtifact(d);
      this.enqueue(d);
    }
    await this.persist();
    this.changed();
  }

  /** take a document out of a base: its index goes, its record stays as a tombstone (old citations) */
  async removeDocument(documentId: string) {
    const d = this.requireDoc(documentId);
    this.cancelJobs(d.id);
    const blobs = indexRefs(d.index);
    d.removedAt = this.now();
    d.status = 'removed';
    delete d.index;
    delete d.error;
    delete d.warning;
    delete d.staleReason;
    d.updatedAt = d.removedAt;
    this.loaded.delete(d.knowledgeBaseId);
    this.touchBase(d.knowledgeBaseId);
    this.purgeTombstones();
    await this.persist();
    await this.dropBlobs(blobs);
    this.bus.emit('knowledge.document.removed', { baseId: d.knowledgeBaseId, documentId: d.id });
    this.changed();
  }

  /** Artifact sources with newer bytes (call when artifacts change) */
  checkStale() {
    if (!this.ready) return;
    let any = false;
    for (const d of this.docs.values()) {
      if (d.removedAt || d.sourceType !== 'artifact' || !d.sourceId || d.status === 'stale') continue;
      const a = this.opts.artifact?.(d.sourceId);
      if (a && !a.deletedAt && a.sha256 && a.sha256 !== d.sha256) {
        this.markStale(d, 'The artifact has a newer version.');
        any = true;
      }
    }
    if (any) {
      void this.persist();
      this.changed();
    }
  }

  private markStale(d: KnowledgeDocument, reason: string) {
    if (BUSY.includes(d.status)) return;
    d.status = 'stale';
    d.staleReason = reason;
    d.updatedAt = this.now();
    this.bus.emit('knowledge.document.stale', { baseId: d.knowledgeBaseId, documentId: d.id, reason });
  }

  // ── indexing jobs ────────────────────────────────────────
  private enqueue(d: KnowledgeDocument) {
    if (this.jobsList.some((j) => j.documentId === d.id && (j.status === 'queued' || j.status === 'running'))) return;
    const job: IndexJob = { id: this.newId('job'), documentId: d.id, baseId: d.knowledgeBaseId, status: 'queued', queuedAt: this.now() };
    this.jobsList = [job, ...this.jobsList].slice(0, 200);
    d.status = 'pending';
    this.queue.push(job.id);
    void this.pump();
  }

  /** cancel a document's queued or running job */
  cancel(documentId: string) {
    this.cancelJobs(documentId);
    this.changed();
  }

  private cancelJobs(documentId: string) {
    for (const j of this.jobsList)
      if (j.documentId === documentId && j.status === 'queued') {
        j.status = 'cancelled';
        j.finishedAt = this.now();
        this.queue = this.queue.filter((id) => id !== j.id);
        const d = this.docs.get(documentId);
        if (d && !d.removedAt) this.settleCancelled(d);
      }
    if (this.running?.job.documentId === documentId) this.running.ac.abort();
  }

  private settleCancelled(d: KnowledgeDocument) {
    if (d.index) {
      d.status = d.index.sourceSha256 === d.sha256 ? 'ready' : 'stale';
    } else {
      d.status = 'failed';
      d.error = { code: 'CANCELLED', message: 'Indexing was cancelled.' };
    }
    void this.persist();
  }

  /** wait for queued jobs (tests, Debug) */
  async idle() {
    while (this.running || this.queue.length) await new Promise((r) => setTimeout(r, 5));
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const id = this.queue.shift();
    if (!id) return;
    const job = this.jobsList.find((j) => j.id === id);
    if (!job || job.status !== 'queued') return this.pump();
    const ac = new AbortController();
    this.running = { job, ac };
    try {
      await this.runJob(job, ac.signal);
    } finally {
      this.running = undefined;
      this.changed();
      void this.pump();
    }
  }

  private async runJob(job: IndexJob, signal: AbortSignal) {
    const d = this.docs.get(job.documentId);
    const base = d && this.bases.get(d.knowledgeBaseId);
    if (!d || !base || d.removedAt) {
      job.status = 'cancelled';
      return;
    }
    job.status = 'running';
    job.startedAt = this.now();
    this.bus.emit('knowledge.index.started', { baseId: base.id, documentId: d.id, jobId: job.id });
    const stage = (s: NonNullable<IndexJob['stage']>) => {
      if (signal.aborted) throw new EmbeddingError('CANCELLED', 'Indexing was cancelled.');
      job.stage = s;
      d.status = s;
      this.changed();
    };
    // blobs this job wrote: removed again when the job does not swap them in
    const written: string[] = [];
    try {
      stage('extracting');
      // counted (and saved) BEFORE reading: if reading the file takes the app down, the next start knows
      const sd = d as StoredDocument;
      sd.extractAttempts = (sd.extractAttempts ?? 0) + 1;
      await this.persist();
      // the hash of the bytes about to be read (taken before the read: a replacement may land meanwhile)
      const sha = d.sha256;
      let bytes: Uint8Array;
      try {
        bytes = await this.files.get(d.storageRef);
      } catch (e) {
        delete sd.extractAttempts;
        throw new KnowledgeError('SOURCE_MISSING', e instanceof FileError && e.code !== 'FILE_NOT_FOUND' ? e.message : `${d.name}: its file is missing.`);
      }
      let doc: Awaited<ReturnType<typeof extractDocument>>;
      try {
        doc = await extractDocument(d.name, d.mimeType, bytes, { signal, deadline: Date.now() + EXTRACT_TIME_MS });
      } finally {
        // the reader came back (with text or an error): this attempt did not crash
        delete sd.extractAttempts;
      }
      await this.persist();
      const generation = (d.index?.generation ?? 0) + 1;
      const chunks = await chunkDocument(doc, { documentId: d.id, knowledgeBaseId: base.id, generation }, base.settings.chunking);
      if (!chunks.length) throw new KnowledgeError('NO_EXTRACTABLE_TEXT', `${d.name} has no text RealmNest can read.`);
      d.extraction = { format: doc.format, ...(doc.pages && { pages: doc.pages }), ...(doc.rows && { rows: doc.rows }), ...(doc.lines && { lines: doc.lines }), ...(doc.warnings.length && { warnings: doc.warnings.slice(0, 8) }) };
      job.chunks = chunks.length;

      let vectors: Float32Array[] | undefined;
      let identity: EmbeddingIdentity | undefined;
      let warning: KnowledgeDocument['warning'];
      if (base.settings.retrievalMode === 'hybrid') {
        stage('embedding');
        try {
          if (!this.embeddings) throw new EmbeddingError('EMBEDDINGS_UNAVAILABLE', 'Embeddings are not available in this build.');
          const target = this.embeddings.resolve(base.settings.embedding);
          const same = (i?: EmbeddingIdentity) => !!i && i.providerId === target.providerId && i.model === target.model;
          // dimension safety: every vector of a base has the size its identity says
          const expect = same(base.embeddingIdentity) ? base.embeddingIdentity!.dimensions : undefined;
          const known = new Map<string, Float32Array>();
          if (d.index?.vectorRefs?.length && same(d.index.embedding)) {
            const old = await this.readChunks(d).catch(() => []);
            const vs = await this.readVectors(d.index).catch(() => []);
            old.forEach((c, i) => vs[i] && known.set(c.hash, vs[i]));
          }
          const r = await this.embeddings.embedAll(target, chunks, { known, ...(expect && { expectDimensions: expect }), signal });
          vectors = r.vectors.map(normalize);
          identity = { connectionId: target.connectionId, providerId: target.providerId, model: target.model, dimensions: r.dimensions };
          job.embedded = chunks.length - r.reused;
          job.reused = r.reused;
          job.usage = r.usage;
        } catch (e) {
          if (e instanceof EmbeddingError && (e.code === 'CANCELLED' || e.code === 'EMBEDDING_MISMATCH')) throw e;
          // the connection is not there: index by words now, by meaning after a re-index
          const code: KnowledgeErrorCode = e instanceof EmbeddingError && e.code === 'EMBEDDINGS_UNAVAILABLE' ? 'EMBEDDINGS_UNAVAILABLE' : 'EMBEDDING_FAILED';
          warning = { code, message: `${e instanceof Error ? e.message : String(e)} Searchable by words only; re-index when embeddings work.` };
        }
      }

      stage('indexing');
      const json = utf8.encode(JSON.stringify(chunks));
      // a stored file is at most MAX_FILE_BYTES: say what is too large, not "the file"
      if (json.length > MAX_FILE_BYTES) throw new KnowledgeError('DOCUMENT_TOO_LARGE', `${d.name}: its index would be ${Math.ceil(json.length / 1024 / 1024)} MB, more than the ${MAX_FILE_BYTES / 1024 / 1024} MB one stored part may hold. Split the document into smaller files.`);
      const chunksRef = (await this.files.put(json)).storageRef;
      written.push(chunksRef);
      const vectorRefs = vectors && identity ? await this.writeVectors(vectors, identity.dimensions, written) : undefined;
      if (signal.aborted) throw new EmbeddingError('CANCELLED', 'Indexing was cancelled.');
      // the document may have been removed or replaced meanwhile
      if (!this.docs.has(d.id) || d.removedAt) {
        job.status = 'cancelled';
        await this.dropBlobs(written);
        return;
      }
      if (d.sha256 !== sha) {
        // replaced while this job ran: index the new bytes next (this result is for the old ones)
        job.status = 'cancelled';
        await this.dropBlobs(written);
        this.enqueue(d);
        await this.persist();
        return;
      }
      // atomic swap: search sees the old generation until here, the new one after
      const old = d.index;
      const index: DocumentIndex = { generation, chunksRef, chunkCount: chunks.length, ...(vectorRefs && { vectorRefs }), ...(identity && { embedding: identity }), sourceSha256: sha, builtAt: this.now(), chars: chunks.reduce((n, c) => n + c.text.length, 0) };
      d.index = index;
      d.status = 'ready';
      d.indexedAt = index.builtAt;
      d.updatedAt = index.builtAt;
      delete d.error;
      delete d.staleReason;
      if (warning) d.warning = warning;
      else delete d.warning;
      if (identity && !base.embeddingIdentity) base.embeddingIdentity = identity;
      this.loaded.delete(base.id);
      job.status = 'completed';
      await this.persist();
      const keep = new Set(indexRefs(index));
      await this.dropBlobs(indexRefs(old).filter((r) => !keep.has(r)));
      this.bus.emit('knowledge.index.completed', { baseId: base.id, documentId: d.id, jobId: job.id, chunks: chunks.length, generation, embedded: job.embedded ?? 0, reused: job.reused ?? 0, lexicalOnly: !vectorRefs });
    } catch (e) {
      await this.dropBlobs(written);
      const code = e instanceof EmbeddingError ? e.code : e instanceof ExtractionError ? e.code : e instanceof KnowledgeError ? e.code : (e as { code?: string })?.code === 'DOCUMENT_TOO_LARGE' ? 'DOCUMENT_TOO_LARGE' : 'INDEX_FAILED';
      const message = e instanceof Error ? e.message : String(e);
      job.status = code === 'CANCELLED' ? 'cancelled' : 'failed';
      job.error = { code, message };
      if (this.docs.has(d.id) && !d.removedAt) {
        if (code === 'CANCELLED') this.settleCancelled(d);
        else {
          // the previous generation (if any) stays searchable; the error says why the new one is not there
          d.status = 'failed';
          d.error = { code: code as KnowledgeErrorCode, message };
          d.updatedAt = this.now();
          await this.persist();
        }
      }
      this.bus.emit('knowledge.index.failed', { baseId: base.id, documentId: d.id, jobId: job.id, code });
    } finally {
      delete job.stage;
      job.finishedAt = this.now();
    }
  }

  private async writeVectors(vectors: Float32Array[], dims: number, written: string[]): Promise<string[]> {
    const perPart = Math.max(1, Math.floor(VECTOR_PART_BYTES / (dims * 4)));
    const refs: string[] = [];
    for (let i = 0; i < vectors.length; i += perPart) {
      const slice = vectors.slice(i, i + perPart);
      const flat = new Float32Array(slice.length * dims);
      slice.forEach((v, k) => flat.set(v, k * dims));
      // little-endian on every platform RealmNest runs on (x86-64, arm64); checked in readVectors
      const ref = (await this.files.put(new Uint8Array(flat.buffer))).storageRef;
      refs.push(ref);
      written.push(ref);
    }
    return refs;
  }

  private async readVectors(index: DocumentIndex): Promise<Float32Array[]> {
    const dims = index.embedding?.dimensions ?? 0;
    if (!dims || !index.vectorRefs?.length) return [];
    const out: Float32Array[] = [];
    for (const ref of index.vectorRefs) {
      const bytes = await this.files.get(ref);
      if (bytes.length % (dims * 4)) throw new KnowledgeError('EMBEDDING_MISMATCH', 'A vectors file does not match its dimensions.');
      const flat = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
      for (let i = 0; i < flat.length; i += dims) out.push(flat.slice(i, i + dims));
    }
    if (out.length !== index.chunkCount) throw new KnowledgeError('EMBEDDING_MISMATCH', 'The vectors do not match the chunks.');
    return out;
  }

  private async readChunks(d: KnowledgeDocument): Promise<KnowledgeChunk[]> {
    const builtIn = this.builtInChunks.get(d.id);
    if (builtIn) return builtIn;
    if (!d.index) return [];
    return JSON.parse(decoder.decode(await this.files.get(d.index.chunksRef))) as KnowledgeChunk[];
  }

  /** delete index blobs nothing else references (content-addressed: two documents can share one) */
  private async dropBlobs(refs: string[]) {
    if (!refs.length) return;
    const used = this.storageRefs();
    for (const r of new Set(refs)) if (!used.has(r)) await this.files.delete(r).catch(() => false);
  }

  // ── search ───────────────────────────────────────────────
  private async load(baseId: string): Promise<LoadedBase> {
    const base = this.requireBase(baseId);
    const docs = [...this.docs.values()].filter((d) => d.knowledgeBaseId === baseId && !d.removedAt && (d.index || this.builtInChunks.has(d.id)));
    const identity = base.settings.retrievalMode === 'hybrid' ? base.embeddingIdentity : undefined;
    const key = `${docs.map((d) => `${d.id}:${d.index?.generation ?? 0}`).join('|')}#${identity ? `${identity.model}:${identity.dimensions}` : ''}`;
    const cached = this.loaded.get(baseId);
    if (cached?.key === key) {
      // most recently used last (Map order)
      this.loaded.delete(baseId);
      this.loaded.set(baseId, cached);
      return cached;
    }
    const chunks: KnowledgeChunk[] = [];
    const vectors = new Map<string, Float32Array>();
    let lexicalOnlyDocs = 0;
    for (const d of docs) {
      let cs: KnowledgeChunk[];
      try {
        cs = await this.readChunks(d);
      } catch {
        continue; // a missing blob: the document is not searchable until re-indexed
      }
      chunks.push(...cs);
      const same = identity && d.index?.embedding && d.index.embedding.model === identity.model && d.index.embedding.dimensions === identity.dimensions;
      if (same) {
        const vs = await this.readVectors(d.index!).catch(() => []);
        if (vs.length === cs.length) cs.forEach((c, i) => vectors.set(c.id, vs[i]));
        else lexicalOnlyDocs++;
      } else if (identity) lexicalOnlyDocs++;
    }
    const loaded: LoadedBase = { key, chunks, lexical: new LexicalIndex(chunks), vectors, ...(identity && { identity }), lexicalOnlyDocs };
    this.loaded.delete(baseId);
    this.loaded.set(baseId, loaded);
    // bounded: the least recently searched bases are rebuilt from their blobs when needed again
    for (const id of this.loaded.keys()) {
      if (this.loaded.size <= LOADED_BASES) break;
      this.loaded.delete(id);
    }
    return loaded;
  }

  /**
   * Search bases: lexical always; by meaning too for hybrid bases whose embeddings work now
   * (otherwise by words only, and `lexicalOnly` says so).
   */
  async search(baseIds: string[], query: string, k: number = KNOWLEDGE_LIMITS.resultsDefault): Promise<SearchResult> {
    const q = query.trim().slice(0, KNOWLEDGE_LIMITS.queryChars);
    const notes: string[] = [];
    let lexicalOnly = false;
    const lists: Hit[][] = [];
    const exactSets: ((needle: string) => Set<string>)[] = [];
    const docInfo = new Map<string, { generation: number; name: string }>();
    for (const id of baseIds) {
      const base = this.bases.get(id);
      if (!base) {
        notes.push(`A selected knowledge base no longer exists.`);
        continue;
      }
      const lb = await this.load(id);
      for (const d of this.documents(id)) docInfo.set(d.id, { generation: d.index?.generation ?? 1, name: d.name });
      exactSets.push((n) => lb.lexical.contains(n));
      const want = Math.max(k * 4, 20);
      lists.push(lb.lexical.search(q, want));
      if (base.settings.retrievalMode === 'hybrid') {
        if (!lb.identity || !lb.vectors.size) {
          lexicalOnly = true;
          notes.push(`${base.name}: no embeddings yet, searched by words only.`);
        } else {
          try {
            const qv = normalize(await this.embeddings!.embedQuery(lb.identity, q));
            lists.push(semanticSearch(qv, lb.chunks, lb.vectors, want));
            if (lb.lexicalOnlyDocs) notes.push(`${base.name}: ${lb.lexicalOnlyDocs} document(s) searched by words only.`);
          } catch (e) {
            lexicalOnly = true;
            notes.push(`${base.name}: ${e instanceof Error ? e.message : 'embeddings unavailable'} Searched by words only.`);
          }
        }
      }
    }
    const fused = lists.length > 1 ? fuse(lists) : (lists[0] ?? []);
    const ranked = this.reranker.rerank(q, fused, { exact: (n) => new Set(exactSets.flatMap((f) => [...f(n)])) });
    const hits = ranked.slice(0, Math.min(k, KNOWLEDGE_LIMITS.resultsMax)).map((h) => ({ ...h, generation: docInfo.get(h.chunk.documentId)?.generation ?? 1, documentName: docInfo.get(h.chunk.documentId)?.name ?? 'document' }));
    return { hits, lexicalOnly, notes };
  }

  // ── runs ─────────────────────────────────────────────────
  /** the bases of a selection that exist (deleted ones are dropped, with their names unknown) */
  validSelection(sel: KnowledgeSelection | undefined): KnowledgeSelection | undefined {
    if (!sel?.baseIds.length) return undefined;
    const baseIds = sel.baseIds.filter((id) => this.bases.has(id));
    return baseIds.length ? { baseIds, mode: sel.mode } : undefined;
  }

  /**
   * Start a run's Knowledge: retrieve for its message now (every model gets these sources, with
   * or without tools), and remember the labels so later searches and the citations line up.
   */
  async beginRun(runId: string, sel: KnowledgeSelection, message: string, o: { canSearch: boolean }): Promise<{ context: string; sources: number; lexicalOnly: boolean }> {
    const s: RunSession = { runId, baseIds: sel.baseIds, mode: sel.mode, labels: new Map(), retrieved: new Map(), queries: [], embeddings: [], searches: 0 };
    for (const id of sel.baseIds) {
      const b = this.bases.get(id);
      if (b) s.embeddings.push({ baseId: id, ...(b.settings.retrievalMode === 'hybrid' && b.embeddingIdentity && { model: b.embeddingIdentity.model, dimensions: b.embeddingIdentity.dimensions }) });
    }
    this.sessions.set(runId, s);
    const names = sel.baseIds.map((id) => this.bases.get(id)?.name).filter(Boolean) as string[];
    const first = message.trim() ? await this.searchForRun(s, message, KNOWLEDGE_LIMITS.resultsDefault) : { block: '', count: 0, lexicalOnly: false };
    return { context: [knowledgeRules({ mode: sel.mode, bases: names, canSearch: o.canSearch }), first.block].filter(Boolean).join('\n\n'), sources: first.count, lexicalOnly: first.lexicalOnly };
  }

  hasRun(runId: string) {
    return this.sessions.has(runId);
  }

  /** search_knowledge, inside a run: only that run's bases; new sources get the next labels */
  async searchForRun(s: RunSession | string, query: string, k: number): Promise<{ block: string; count: number; lexicalOnly: boolean }> {
    const session = typeof s === 'string' ? this.sessions.get(s) : s;
    if (!session) throw new KnowledgeError('BASE_NOT_FOUND', 'No knowledge base is selected for this run.');
    if (session.searches >= KNOWLEDGE_LIMITS.searchesPerRun) return { block: sourcesBlock([], { query, note: `The search limit for this answer (${KNOWLEDGE_LIMITS.searchesPerRun}) was reached; answer with the sources you have.` }), count: 0, lexicalOnly: false };
    session.searches++;
    const r = await this.search(session.baseIds, query, Math.min(Math.max(1, k), KNOWLEDGE_LIMITS.resultsMax));
    const sources: RetrievedSource[] = [];
    let chars = 0;
    for (const h of r.hits) {
      if (chars + h.chunk.text.length > KNOWLEDGE_LIMITS.resultChars && sources.length) break;
      let label = session.labels.get(h.chunk.id);
      if (!label) {
        if (session.labels.size >= KNOWLEDGE_LIMITS.sourcesPerRun) break;
        label = `K${session.labels.size + 1}`;
        session.labels.set(h.chunk.id, label);
      }
      const src: RetrievedSource = { label, chunkId: h.chunk.id, documentId: h.chunk.documentId, knowledgeBaseId: h.chunk.knowledgeBaseId, generation: h.generation, documentName: h.documentName, location: h.chunk.location, score: Math.round(h.score * 1e4) / 1e4, text: h.chunk.text };
      session.retrieved.set(label, src);
      sources.push(src);
      chars += h.chunk.text.length;
    }
    session.queries.push({ query: query.slice(0, 200), results: sources.length, lexicalOnly: r.lexicalOnly, at: this.now() });
    this.bus.emit('knowledge.searched', { runId: session.runId, bases: session.baseIds.length, results: sources.length, lexicalOnly: r.lexicalOnly });
    const note = r.lexicalOnly ? 'Some sources were searched by words only (embeddings unavailable).' : undefined;
    return { block: sourcesBlock(sources, { query, ...(note && { note }) }), count: sources.length, lexicalOnly: r.lexicalOnly };
  }

  /** the run's answer: citations resolved and validated, grounding checked; the session ends */
  finishRun(runId: string, answer: string | undefined): KnowledgeRunRecord | undefined {
    const s = this.sessions.get(runId);
    if (!s) return undefined;
    this.sessions.delete(runId);
    const text = answer ?? '';
    const { citations, invalidLabels } = resolveCitations(text, s.retrieved);
    const record: KnowledgeRunRecord = {
      baseIds: s.baseIds,
      mode: s.mode,
      queries: s.queries,
      retrieved: [...s.retrieved.values()].map(({ label, chunkId, documentId, knowledgeBaseId, generation, score }) => ({ label, chunkId, documentId, knowledgeBaseId, generation, score })),
      citations,
      invalidLabels,
      embeddings: s.embeddings,
      ...(answer !== undefined && { verification: verifyGrounding(text, s.retrieved, s.mode) }),
    };
    this.bus.emit('knowledge.run.verified', { runId, citations: citations.length, invalid: invalidLabels.length, verdict: record.verification?.verdict ?? 'not-checked' });
    return record;
  }

  // ── built-in: RealmNest Docs ────────────────────────────────
  private async loadBuiltIn() {
    const files = this.opts.builtIn?.() ?? [];
    if (!files.length) return;
    const t = 0;
    const base: KnowledgeBase = { id: DOCS_BASE_ID, name: 'RealmNest Docs', description: 'How RealmNest works: the product documentation shipped with this version. Local, searched by words.', createdAt: t, updatedAt: t, builtIn: true, settings: { retrievalMode: 'lexical', chunking: { ...DEFAULT_CHUNKING } } };
    this.bases.set(base.id, base);
    for (const f of files) {
      const id = `kdoc-nestra-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const bytes = utf8.encode(f.text);
      try {
        const doc = await extractDocument(f.name, 'text/markdown', bytes);
        const chunks = await chunkDocument(doc, { documentId: id, knowledgeBaseId: base.id, generation: 1 });
        this.builtInChunks.set(id, chunks);
        this.docs.set(id, {
          id,
          knowledgeBaseId: base.id,
          name: f.name,
          mimeType: 'text/markdown',
          sourceType: 'built-in',
          storageRef: `builtin:${f.name}`,
          sha256: '',
          size: bytes.length,
          status: 'ready',
          // in memory: the chunks never become blobs (storageRefs skips built-in bases)
          index: { generation: 1, chunksRef: 'builtin:', chunkCount: chunks.length, sourceSha256: '', builtAt: t, chars: chunks.reduce((n, c) => n + c.text.length, 0) },
          createdAt: t,
          updatedAt: t,
          indexedAt: t,
          extraction: { format: doc.format, ...(doc.lines && { lines: doc.lines }) },
          provenance: { addedBy: 'built-in' },
        });
      } catch {
        /* a doc that cannot be read is left out */
      }
    }
  }

  // ── helpers ──────────────────────────────────────────────
  private requireBase(id: string, writable = false): KnowledgeBase {
    const b = this.bases.get(id);
    if (!b) throw new KnowledgeError('BASE_NOT_FOUND', 'That knowledge base no longer exists.');
    if (writable && b.builtIn) throw new KnowledgeError('READ_ONLY', `${b.name} is built in and cannot be changed.`);
    return b;
  }
  private requireDoc(id: string): KnowledgeDocument {
    const d = this.docs.get(id);
    if (!d || d.removedAt) throw new KnowledgeError('DOCUMENT_NOT_FOUND', 'That document is no longer in the base.');
    this.requireBase(d.knowledgeBaseId, true);
    return d;
  }
  private touchBase(id: string) {
    const b = this.bases.get(id);
    if (b) b.updatedAt = this.now();
  }
}

/** a stored document record the service can work with (anything else is skipped at load) */
function validDocument(d: unknown): d is StoredDocument {
  const x = d as Partial<StoredDocument> | null;
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || typeof x.knowledgeBaseId !== 'string' || typeof x.name !== 'string' || typeof x.storageRef !== 'string' || typeof x.status !== 'string') return false;
  if (typeof x.sha256 !== 'string') x.sha256 = '';
  if (typeof x.size !== 'number') x.size = 0;
  if (typeof x.createdAt !== 'number') x.createdAt = 0;
  if (typeof x.updatedAt !== 'number') x.updatedAt = x.createdAt;
  if (!x.provenance || typeof x.provenance !== 'object') x.provenance = { addedBy: 'user' };
  // an index without its blob reference cannot be searched: the document is re-indexed by hand
  if (x.index && (typeof x.index !== 'object' || typeof x.index.chunksRef !== 'string' || (x.index.vectorRefs !== undefined && !Array.isArray(x.index.vectorRefs)))) delete x.index;
  return true;
}

function indexRefs(index: DocumentIndex | undefined): string[] {
  return index ? [index.chunksRef, ...(index.vectorRefs ?? [])] : [];
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return (
    { pdf: 'application/pdf', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', json: 'application/json', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as Record<string, string>
  )[ext] ?? 'text/plain';
}

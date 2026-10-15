// ─────────────────────────────────────────────────────────────
// Knowledge: sources the user indexed on purpose, so runs can retrieve
// facts from them — with citations RealmNest checks.
//
//   Attachment / Artifact / local file      (the bytes stay in the FileStore)
//        ↓  KnowledgeDocument (a reference + status + provenance)
//   extraction (text + source locations) → chunks → lexical (+ semantic) index
//        ↓  search_knowledge (a normal tool, scoped to the run's bases)
//   [K1] citations → validated → shown with their source
//
// Not Memory (learned interaction context, later), not chat history, not a
// Skill resource, not an Attachment or an Artifact. docs/KNOWLEDGE.md.
// ─────────────────────────────────────────────────────────────

/** how answers may use what was retrieved */
export type KnowledgeMode = 'open' | 'grounded' | 'strict';

/**
 * how a base is indexed:
 *   lexical   local only, BM25 over words and exact codes (no text leaves the machine)
 *   hybrid    lexical + embeddings from an AI connection (document text is sent to that provider)
 */
export type RetrievalMode = 'lexical' | 'hybrid';

export interface EmbeddingChoice {
  /** 'auto': the routing policy's embeddings.create target, resolved when indexing starts */
  connectionId: string | 'auto';
  model?: string;
}

/** what an index generation was built with (never changed silently) */
export interface EmbeddingIdentity {
  connectionId: string;
  providerId: string;
  model: string;
  dimensions: number;
}

export interface ChunkingSettings {
  /** target and hard maximum size, in characters */
  targetChars: number;
  maxChars: number;
  /** characters of the previous chunk repeated at the start of the next (same section only) */
  overlapChars: number;
}

export const DEFAULT_CHUNKING: ChunkingSettings = { targetChars: 1_200, maxChars: 2_000, overlapChars: 150 };

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  settings: {
    retrievalMode: RetrievalMode;
    embedding?: EmbeddingChoice;
    chunking: ChunkingSettings;
  };
  /** the embedding model the current vectors were made with (hybrid bases, once indexed) */
  embeddingIdentity?: EmbeddingIdentity;
  /** shipped with RealmNest (RealmNest Docs): rebuilt from the build, not editable */
  builtIn?: boolean;
  metadata?: Record<string, string>;
}

export type KnowledgeSourceType = 'attachment' | 'artifact' | 'local-file' | 'skill-resource' | 'built-in' | 'web';

export const DOCUMENT_STATUSES = ['pending', 'extracting', 'embedding', 'indexing', 'ready', 'failed', 'stale', 'removed'] as const;
export type KnowledgeDocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type KnowledgeErrorCode =
  | 'NO_EXTRACTABLE_TEXT'
  | 'UNSUPPORTED_DOCUMENT'
  | 'DOCUMENT_TOO_LARGE'
  | 'EXTRACTION_FAILED'
  | 'SOURCE_MISSING'
  | 'EMBEDDINGS_UNAVAILABLE'
  | 'EMBEDDING_FAILED'
  | 'EMBEDDING_MISMATCH'
  | 'INDEX_FAILED'
  | 'CANCELLED';

/** where a piece of text came from in the original file (for citations) */
export interface SourceLocation {
  page?: number;
  startLine?: number;
  endLine?: number;
  /** the heading path, e.g. "Launch › Dates" */
  section?: string;
  rowStart?: number;
  rowEnd?: number;
}

/** one index generation of a document: its chunks (and vectors) as FileStore blobs */
export interface DocumentIndex {
  generation: number;
  /** JSON list of chunks (text + locations) */
  chunksRef: string;
  chunkCount: number;
  /** float32 little-endian, chunkCount × dimensions, in parts of whole vectors (hybrid only) */
  vectorRefs?: string[];
  embedding?: EmbeddingIdentity;
  /** the source bytes this generation was built from */
  sourceSha256: string;
  builtAt: number;
  /** characters extracted */
  chars: number;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  sourceType: KnowledgeSourceType;
  /** the Attachment / Artifact / Skill it came from */
  sourceId?: string;
  /** the bytes (shared with the source when it has them) */
  storageRef: string;
  sha256: string;
  size: number;
  status: KnowledgeDocumentStatus;
  error?: { code: KnowledgeErrorCode; message: string };
  /** indexed, with a limitation (e.g. EMBEDDINGS_UNAVAILABLE: searchable by words only) */
  warning?: { code: KnowledgeErrorCode; message: string };
  /** why the index is out of date (status stale) */
  staleReason?: string;
  /** removed from the base: the record stays as a tombstone so old citations still name it */
  removedAt?: number;
  /** the generation search uses (kept while a reindex runs or after it fails) */
  index?: DocumentIndex;
  indexedAt?: number;
  createdAt: number;
  updatedAt: number;
  extraction?: { pages?: number; rows?: number; lines?: number; format: string; warnings?: string[] };
  provenance: {
    addedBy: 'user' | 'built-in';
    /** the run / chat the source came from */
    conversationId?: string;
    taskId?: string;
    runId?: string;
    artifactId?: string;
    attachmentId?: string;
    /** a web page saved by the user: where and when it was read */
    url?: string;
    fetchedAt?: number;
  };
}

/** a chunk as stored in its generation blob */
export interface KnowledgeChunk {
  /** stable: document + generation + ordinal + content hash */
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  ordinal: number;
  text: string;
  location: SourceLocation;
  /** sha256 of the text (the embedding cache key, with the model) */
  hash: string;
  tokenEstimate: number;
}

/** what the model is given for one retrieved chunk, and what a citation resolves to */
export interface RetrievedSource {
  /** K1, K2…: unique within one run */
  label: string;
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  generation: number;
  documentName: string;
  location: SourceLocation;
  score: number;
  /** the text the model saw (also the citation's snapshot) */
  text: string;
}

/** a citation RealmNest resolved from the answer ([K3] → a retrieved source) */
export interface Citation {
  /** display number in this answer: [1], [2]… */
  n: number;
  label: string;
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  documentName: string;
  location: SourceLocation;
  /** a short excerpt, kept if the source is removed later (tombstone) */
  excerpt: string;
}

/** what a run remembers about Knowledge (audit, reproducibility) */
export interface KnowledgeRunRecord {
  baseIds: string[];
  mode: KnowledgeMode;
  queries: { query: string; results: number; lexicalOnly: boolean; at: number }[];
  retrieved: Pick<RetrievedSource, 'label' | 'chunkId' | 'documentId' | 'knowledgeBaseId' | 'generation' | 'score'>[];
  citations: Citation[];
  /** labels the model wrote that it was never given ([K9] when only K1–K3 exist) */
  invalidLabels: string[];
  verification?: GroundingReport;
  embeddings: { baseId: string; model?: string; dimensions?: number }[];
}

/** a conservative, deterministic check of the answer against what was retrieved (not semantic proof) */
export interface GroundingReport {
  sentences: number;
  cited: number;
  /** sentences with facts (numbers, codes, dates) and no citation */
  uncitedFactual: number;
  /** cited sentences whose numbers / codes appear in the cited sources */
  lexicallySupported: number;
  /** cited sentences with numbers / codes that the cited sources do not contain */
  lexicalMismatch: number;
  /** said explicitly that the sources do not contain the answer */
  declaredUnsupported: boolean;
  /** declined: the answer says the sources do not contain it (and claims nothing else) */
  verdict: 'supported' | 'partially-supported' | 'unsupported' | 'declined' | 'no-sources' | 'not-checked';
}

/** the Knowledge a chat or an agent uses */
export interface KnowledgeSelection {
  baseIds: string[];
  mode: KnowledgeMode;
}

export const DOCS_BASE_ID = 'kb-nestra-docs';

export function locationLabel(l: SourceLocation): string {
  const parts: string[] = [];
  if (l.page) parts.push(`p. ${l.page}`);
  if (l.section) parts.push(l.section);
  if (l.rowStart) parts.push(l.rowEnd && l.rowEnd !== l.rowStart ? `rows ${l.rowStart}–${l.rowEnd}` : `row ${l.rowStart}`);
  else if (l.startLine) parts.push(l.endLine && l.endLine !== l.startLine ? `lines ${l.startLine}–${l.endLine}` : `line ${l.startLine}`);
  return parts.join(' · ');
}

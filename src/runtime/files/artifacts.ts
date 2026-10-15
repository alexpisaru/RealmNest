// ArtifactService: what RealmNest's runs produce, registered as Artifacts (domain/artifact.ts).
//
//   ToolRuntime ─onCompleted(call, result, scope)─▶ fromToolResult
//       result.artifacts  (a file a tool wrote in its workspace) ─▶ FileStore.importWorkspace
//       result.parts      (an image / audio / resource an MCP tool returned) ─▶ FileStore.put
//   ─▶ Artifact { storageRef, sha256, kind, provenance (who, which run, which tool, which Skills),
//                 lineage (the run's attachments and the artifacts they came from) }
//
// Records are saved under "artifacts"; bytes stay in the FileStore. Deleting keeps the record as a
// tombstone (history says "Artifact deleted") and drops the bytes when nothing else uses them.
// A Skill's own bundled files are not Artifacts: only what a run produces is.

import type { EventBus } from '../../core/events';
import { contentKind, type AttachmentInput } from '../../domain/attachment';
import { inView, type Artifact, type ArtifactProvenance, type ArtifactView } from '../../domain/artifact';
import type { ToolCall, ToolContentPart, ToolResult } from '../../domain/tool';
import { CoalescedWriter } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';
import type { ToolScope } from '../tools/runtime';
import { artifactKind, extOf, fromBase64, normalizeMime, PROGRAM_MIMES, toBase64 } from './mime';
import { FileError, type FileStore } from './store';

export const ARTIFACT_SCHEMA = 1;
const KEY = 'artifacts';
/** records kept: tombstones fill what live artifacts leave (live ones are never dropped) */
export const MAX_ARTIFACTS = 2_000;
/** image previews (base64) kept in memory */
const PREVIEW_CACHE = 20;

export interface ArtifactSnapshot {
  version: number;
  artifacts: Artifact[];
}

/** something that went wrong while registering an output (Debug › Files) */
export interface ArtifactIssue {
  at: number;
  toolCallId?: string;
  name: string;
  code: string;
  message: string;
}

export interface RegisterInput {
  name: string;
  bytes: Uint8Array;
  /** what the producer said it is (the content decides) */
  mimeType?: string;
  provenance: Omit<ArtifactProvenance, 'createdAt' | 'sourceAttachmentIds' | 'sourceArtifactIds'> & Partial<Pick<ArtifactProvenance, 'sourceAttachmentIds' | 'sourceArtifactIds'>>;
  metadata?: Artifact['metadata'];
}

export interface ArtifactServiceOptions {
  now?: () => number;
  newId?: () => string;
  /** storage refs other records still use (attachments): their bytes survive an Artifact's deletion */
  inUse?: () => Set<string>;
  /** an attachment id → the artifact it came from (lineage through "Use in Chat") */
  attachmentArtifact?: (attachmentId: string) => string | undefined;
}

let counter = 0;
const defaultId = () => `art-${Date.now().toString(36)}-${(++counter).toString(36)}`;

/** Windows device names: "CON.md" or "nul" cannot be a file there (and some open a device) */
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)$/i;

/**
 * A file name safe to show and to export: no folders, no control characters, no bidi controls (a
 * name must read as it is: "photo‮gpj.exe"), no trailing dots or spaces (Windows drops them, so
 * "x.bat." would become x.bat), and never a device name.
 */
export function artifactName(raw: string, fallback = 'output'): string {
  const base = raw.replace(/\\/g, '/').split('/').pop() ?? '';
  let clean = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  if (RESERVED.test(clean.split('.')[0].trim())) clean = `_${clean}`;
  return clean || fallback;
}

const EXT_FOR: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'application/pdf': 'pdf', 'text/plain': 'txt', 'application/json': 'json' };

export class ArtifactService {
  private items = new Map<string, Artifact>();
  private writer: CoalescedWriter<ArtifactSnapshot>;
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;
  private newId: () => string;
  /** previews: base64 by artifact id, this session only (the least recently shown go first) */
  private cache = new Map<string, string>();
  readonly issues: ArtifactIssue[] = [];

  constructor(
    private bus: EventBus,
    private storage: StorageAdapter,
    readonly files: FileStore,
    private opts: ArtifactServiceOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
    this.writer = new CoalescedWriter(storage, KEY, 300, pruneArtifacts);
  }

  async init() {
    const raw = await this.storage.get<Partial<ArtifactSnapshot>>(KEY);
    for (const a of Array.isArray(raw?.artifacts) ? raw.artifacts : []) if (a && typeof a.id === 'string') this.items.set(a.id, a);
    this.changed();
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
  snapshot = (): ArtifactSnapshot => ({ version: ARTIFACT_SCHEMA, artifacts: [...this.items.values()] });
  flush() {
    return this.writer.flush(this.snapshot);
  }

  // ── lookup ───────────────────────────────────────────────
  get(id: string) {
    return this.items.get(id);
  }
  /** newest first; deleted ones only when asked */
  list(view: ArtifactView = 'all', o: { deleted?: boolean } = {}): Artifact[] {
    return [...this.items.values()].filter((a) => (o.deleted || !a.deletedAt) && inView(a, view)).sort((a, b) => b.createdAt - a.createdAt);
  }
  /** what a run, a chat message or a task produced (tombstones included: history shows them) */
  forRun(runId: string) {
    return this.where((a) => a.provenance.runId === runId);
  }
  forMessage(messageId: string) {
    return this.where((a) => a.provenance.messageId === messageId);
  }
  forTask(taskId: string) {
    return this.where((a) => a.provenance.taskId === taskId);
  }
  private where(f: (a: Artifact) => boolean) {
    return [...this.items.values()].filter(f).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** what an artifact was made from, and what was made from it */
  lineage(id: string): { sourceAttachmentIds: string[]; sources: Artifact[]; missingSourceIds: string[]; derived: Artifact[] } {
    const a = this.items.get(id);
    if (!a) return { sourceAttachmentIds: [], sources: [], missingSourceIds: [], derived: [] };
    const ids = a.provenance.sourceArtifactIds;
    return {
      sourceAttachmentIds: a.provenance.sourceAttachmentIds,
      sources: ids.map((s) => this.items.get(s)).filter((x): x is Artifact => !!x),
      missingSourceIds: ids.filter((s) => !this.items.has(s)),
      derived: this.where((x) => x.provenance.sourceArtifactIds.includes(id)),
    };
  }

  /** every stored file an artifact uses (the file store keeps these) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const a of this.items.values()) if (a.storageRef && !a.deletedAt) out.add(a.storageRef);
    return out;
  }

  // ── register ─────────────────────────────────────────────
  /** keep some bytes as an Artifact (the content decides its type, never the name alone) */
  async register(input: RegisterInput): Promise<Artifact> {
    const stored = await this.files.put(input.bytes);
    return this.record(input, stored);
  }

  private record(input: Omit<RegisterInput, 'bytes'>, stored: { storageRef: string; sha256: string; size: number; mime?: string; text: boolean }, replace?: Artifact): Artifact {
    let name = artifactName(input.name);
    const mimeType = normalizeMime(name, input.mimeType, stored.mime, stored.text);
    if (!extOf(name) && EXT_FOR[mimeType]) name = `${name}.${EXT_FOR[mimeType]}`;
    const t = this.now();
    const p = input.provenance;
    const provenance: ArtifactProvenance = { ...p, sourceAttachmentIds: p.sourceAttachmentIds ?? [], sourceArtifactIds: p.sourceArtifactIds ?? [], createdAt: replace?.provenance.createdAt ?? t };
    const a: Artifact = {
      id: replace?.id ?? this.newId(),
      name,
      mimeType,
      size: stored.size,
      kind: artifactKind(mimeType, name),
      storageRef: stored.storageRef,
      sha256: stored.sha256,
      createdAt: replace?.createdAt ?? t,
      ...(replace && { updatedAt: t }),
      provenance,
      ...(input.metadata && { metadata: input.metadata }),
      ...(PROGRAM_MIMES.has(mimeType) && { metadata: { ...input.metadata, executable: true } }),
    };
    this.items.set(a.id, a);
    this.cache.delete(a.id);
    this.bus.emit(replace ? 'artifact.updated' : 'artifact.created', { artifactId: a.id, kind: a.kind, size: a.size, ...(p.runId && { runId: p.runId }) });
    void this.flush();
    this.changed();
    return a;
  }

  /** what a completed tool call produced: files it wrote, binary parts it returned */
  async fromToolResult(call: ToolCall, result: ToolResult, scope: ToolScope & { serverId?: string }): Promise<Artifact[]> {
    const sources = (scope.attachments ?? []).map((f) => f.id);
    const base = {
      ...(scope.agentId && { createdByAgentId: scope.agentId }),
      ...(scope.conversationId && { conversationId: scope.conversationId }),
      ...(scope.messageId && { messageId: scope.messageId }),
      ...(scope.taskId && { taskId: scope.taskId }),
      runId: scope.runId,
      toolId: call.toolId,
      toolCallId: call.id,
      ...(scope.serverId && { serverId: scope.serverId }),
      ...(scope.skills?.length && { skills: scope.skills.map((s) => ({ id: s.id, version: s.version, name: s.name, activation: s.activation ?? 'assigned' })) }),
      sourceAttachmentIds: sources,
      sourceArtifactIds: [...new Set(sources.map((id) => this.opts.attachmentArtifact?.(id)).filter((x): x is string => !!x))],
    };
    const out: Artifact[] = [];
    const attempt = async (name: string, f: () => Promise<Artifact | undefined>) => {
      try {
        const a = await f();
        if (a) out.push(a);
      } catch (e) {
        const err = e instanceof FileError ? e : new FileError('IMPORT_FAILED', e instanceof Error ? e.message : String(e));
        this.issues.unshift({ at: this.now(), toolCallId: call.id, name, code: err.code, message: err.message });
        this.issues.splice(50);
        this.bus.emit('artifact.failed', { toolCallId: call.id, code: err.code });
        this.changed();
      }
    };
    // files written in the workspace: a copy is kept (the workspace file can change later)
    for (const f of result.artifacts ?? []) {
      if (f.kind !== 'file' || !scope.workspace) continue;
      await attempt(f.path, async () => {
        const { stored, path } = await this.files.importWorkspace(scope.workspace!, f.path);
        // the same file written again in the same run is one artifact, updated
        const prev = [...this.items.values()].find((a) => !a.deletedAt && a.provenance.runId === scope.runId && a.provenance.workspacePath === path);
        if (prev?.sha256 === stored.sha256) return undefined;
        return this.record({ name: path, provenance: { ...base, origin: 'tool-file', workspacePath: path } }, stored, prev);
      });
    }
    // binary parts of an MCP result (images, audio, embedded resources)
    let n = 0;
    for (const p of result.parts ?? []) {
      const bin = partBytes(p);
      if (!bin) {
        // a link to a file inside the run's workspace is kept like a written file; anything else is not read
        if (p.type !== 'resource_link' && p.type !== 'resource') continue;
        const rel = workspaceRelative(p.uri, scope.workspace);
        const mimeType = p.mimeType;
        if (rel) await attempt(rel, async () => {
          const { stored, path } = await this.files.importWorkspace(scope.workspace!, rel);
          return this.record({ name: path, mimeType, provenance: { ...base, origin: 'tool-part', workspacePath: path } }, stored);
        });
        continue;
      }
      n++;
      const name = bin.name ?? `${call.toolId.split('.').pop()}-${n}`;
      await attempt(name, async () => this.register({ name, bytes: bin.bytes, mimeType: bin.mime, provenance: { ...base, origin: 'tool-part' } }));
    }
    return out;
  }

  // ── actions ──────────────────────────────────────────────
  rename(id: string, name: string) {
    const a = this.live(id);
    const next = artifactName(name, a.name);
    if (next === a.name) return;
    a.name = next;
    a.updatedAt = this.now();
    void this.flush();
    this.changed();
  }

  /** remove the bytes (unless something else uses them); the record stays as a tombstone */
  async delete(id: string) {
    const a = this.items.get(id);
    if (!a || a.deletedAt) return;
    const ref = a.storageRef;
    a.deletedAt = this.now();
    delete a.storageRef;
    this.cache.delete(id);
    if (ref && !this.storageRefs().has(ref) && !this.opts.inUse?.().has(ref)) {
      try {
        await this.files.delete(ref);
      } catch {
        // the record is what matters; an orphan blob is collected later
      }
    }
    this.bus.emit('artifact.deleted', { artifactId: id });
    void this.flush();
    this.changed();
  }

  /** a copy where the user chooses (the original never moves); the path, or null when cancelled */
  async exportCopy(id: string) {
    const a = this.live(id);
    return this.files.exportCopy(a.storageRef!, a.name);
  }
  /** open with the system's app (refused for programs: RealmNest never runs a file) */
  async open(id: string) {
    const a = this.live(id);
    if (PROGRAM_MIMES.has(a.mimeType)) throw new FileError('UNSUPPORTED_FILE_TYPE', `${a.name} is a program: RealmNest does not open it.`);
    return this.files.open(a.storageRef!, a.name, a.mimeType);
  }
  async reveal(id: string) {
    const a = this.live(id);
    return this.files.reveal(a.storageRef!, a.name);
  }

  /** bytes (base64) for previews; undefined when the artifact or its file is gone */
  async bytes(id: string): Promise<string | undefined> {
    const hit = this.cache.get(id);
    if (hit) {
      this.cache.delete(id);
      this.cache.set(id, hit);
      return hit;
    }
    const a = this.items.get(id);
    if (!a?.storageRef) return undefined;
    try {
      const b64 = toBase64(await this.files.get(a.storageRef));
      this.cache.set(id, b64);
      for (const k of this.cache.keys()) {
        if (this.cache.size <= PREVIEW_CACHE) break;
        this.cache.delete(k);
      }
      return b64;
    } catch {
      return undefined;
    }
  }

  /** live and deleted records, and whether the live ones alone are over the cap (the UI may warn) */
  counts() {
    let live = 0;
    for (const a of this.items.values()) if (!a.deletedAt) live++;
    return { live, deleted: this.items.size - live, cap: MAX_ARTIFACTS, overCap: live > MAX_ARTIFACTS };
  }
  /** the start of a text artifact, for previews (shown as plain text, never as HTML) */
  async text(id: string, max = 20_000): Promise<string | undefined> {
    const a = this.items.get(id);
    if (!a?.storageRef) return undefined;
    try {
      const b = await this.files.get(a.storageRef);
      return new TextDecoder().decode(b.subarray(0, max));
    } catch {
      return undefined;
    }
  }

  /**
   * The artifact as an attachment (Use in Chat, Send to Agent): the same stored file, by
   * reference. Throws when a model could not take it (only text, images and PDFs go to models).
   */
  async asAttachment(id: string): Promise<AttachmentInput> {
    const a = this.live(id);
    const bytes = await this.files.get(a.storageRef!);
    const sniffed = a.mimeType.startsWith('text/') ? undefined : a.mimeType === 'application/octet-stream' ? undefined : a.mimeType;
    const k = contentKind(a.name, undefined, sniffed, a.kind === 'text' || a.kind === 'code' || a.kind === 'data' || a.mimeType.startsWith('text/'));
    if ('error' in k) throw new FileError(k.code, k.error);
    return {
      name: a.name,
      mime: k.kind === 'text' ? a.mimeType : k.mime,
      size: a.size,
      kind: k.kind,
      storageRef: a.storageRef,
      ...(a.sha256 && { sha256: a.sha256 }),
      source: 'artifact',
      artifactId: a.id,
      createdAt: this.now(),
      ...(k.kind === 'text' ? { text: new TextDecoder().decode(bytes) } : { data: toBase64(bytes) }),
    };
  }

  private live(id: string): Artifact {
    const a = this.items.get(id);
    if (!a) throw new FileError('FILE_NOT_FOUND', 'This artifact does not exist.');
    if (a.deletedAt || !a.storageRef) throw new FileError('FILE_NOT_FOUND', `${a.name} was deleted.`);
    return a;
  }
}

/** the bytes of a binary result part, when it carries them */
function partBytes(p: ToolContentPart): { bytes: Uint8Array; mime?: string; name?: string } | undefined {
  if ((p.type === 'image' || p.type === 'audio') && p.data) return { bytes: fromBase64(p.data), mime: p.mimeType };
  if (p.type === 'resource' && p.data) return { bytes: fromBase64(p.data), mime: p.mimeType, name: uriName(p.uri) };
  if (p.type === 'resource' && p.text !== undefined && p.text.length > 2_000) return { bytes: new TextEncoder().encode(p.text), mime: p.mimeType, name: uriName(p.uri) };
  return undefined;
}

const uriName = (uri: string) => {
  try {
    const u = new URL(uri);
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '') || undefined;
  } catch {
    return undefined;
  }
};

/** a file: URI inside `workspace`, as a path relative to it (anything else: undefined) */
export function workspaceRelative(uri: string, workspace: string | undefined): string | undefined {
  if (!workspace || !uri.toLowerCase().startsWith('file:')) return undefined;
  let path: string;
  try {
    path = decodeURIComponent(new URL(uri).pathname);
  } catch {
    return undefined;
  }
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/^\/([a-z]:)/i, '$1').replace(/\/+$/, '');
  const file = norm(path);
  const root = norm(workspace);
  const windows = /^[a-z]:/i.test(root);
  const same = windows ? file.toLowerCase().startsWith(`${root.toLowerCase()}/`) : file.startsWith(`${root}/`);
  if (!same) return undefined;
  const rel = file.slice(root.length + 1);
  return rel && !rel.split('/').includes('..') ? rel : undefined;
}

/**
 * Bounded save: only tombstones are dropped (the oldest first). A live artifact is never dropped,
 * even past the cap: its record is what keeps its file from being collected.
 */
export function pruneArtifacts(s: ArtifactSnapshot): ArtifactSnapshot {
  if (s.artifacts.length <= MAX_ARTIFACTS) return s;
  const live = s.artifacts.filter((a) => !a.deletedAt);
  const room = Math.max(0, MAX_ARTIFACTS - live.length);
  const keep = new Set(
    s.artifacts
      .filter((a) => a.deletedAt)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0) || b.createdAt - a.createdAt)
      .slice(0, room),
  );
  return { version: ARTIFACT_SCHEMA, artifacts: s.artifacts.filter((a) => !a.deletedAt || keep.has(a)) };
}

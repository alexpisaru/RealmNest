import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { contentKind, type AttachmentInput } from '../domain/attachment';
import { inView } from '../domain/artifact';
import type { ToolDefinition } from '../domain/tool';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { ArtifactService, artifactName, pruneArtifacts, workspaceRelative, MAX_ARTIFACTS } from '../runtime/files/artifacts';
import { artifactKind, fromBase64, looksLikeText, normalizeMime, sha256Hex, sniffMime, toBase64 } from '../runtime/files/mime';
import { AttachmentReader, AttachmentUnavailable } from '../runtime/files/payload';
import { FileError, MAX_FILE_BYTES, MemoryFileStore, isStorageRef } from '../runtime/files/store';
import { LiveRuntime } from '../runtime/live/liveRuntime';
import { RuntimeRepository } from '../runtime/live/repository';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';
import { registerFileTools } from '../runtime/tools/fileTools';
import { ToolPolicyStore } from '../runtime/tools/policy';
import { ToolRegistry, type ToolExecutor } from '../runtime/tools/registry';
import { ToolRuntime, type ToolScope } from '../runtime/tools/runtime';

// The file foundation (docs/FILES.md): one FileStore for attachments and artifacts, content-sniffed
// types, run-scoped access, artifacts with provenance, lineage and tombstones.

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 300 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};
const utf8 = (s: string) => new TextEncoder().encode(s);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const PDF = utf8('%PDF-1.7\n%âãÏÓ\n1 0 obj\n');
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);

class Recorder implements AIProvider {
  readonly name: string;
  requests: ProviderTurnRequest[] = [];
  constructor(
    readonly id: string,
    readonly capabilities: ProviderCapabilities,
  ) {
    this.name = id;
  }
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    await tick();
    yield { type: 'run.completed', text: 'done', runId: req.runId, providerId: this.id, seq: 1, at: 0 };
  }
}
const BASE: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: false, usage: false, cost: false, cancellation: true, modelListing: false, systemPrompt: true };

/** an attachment as the composer makes it: bytes stored first, then sent by reference */
async function stored(files: MemoryFileStore, name: string, bytes: Uint8Array, kind: AttachmentInput['kind'], mime: string): Promise<AttachmentInput> {
  const s = await files.put(bytes);
  return { name, mime, size: s.size, kind, storageRef: s.storageRef, sha256: s.sha256, source: 'picker', ...(kind === 'text' ? { text: new TextDecoder().decode(bytes) } : {}) };
}

describe('content types and hashes', () => {
  it('sniffs by magic bytes, not by name', () => {
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(PDF)).toBe('application/pdf');
    expect(sniffMime(EXE)).toBe('application/x-msdownload');
    expect(sniffMime(utf8('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml');
    expect(sniffMime(utf8('<!DOCTYPE html><p>x'))).toBe('text/html');
    expect(sniffMime(utf8('just text'))).toBeUndefined();
    expect(looksLikeText(utf8('ciao è già'))).toBe(true);
    expect(looksLikeText(Uint8Array.from([0x68, 0, 0x69]))).toBe(false);
  });

  it('refuses spoofed attachments: a program named .pdf, text named .png', () => {
    expect(contentKind('report.pdf', 'pdf', 'application/x-msdownload', false)).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    expect(contentKind('photo.png', 'image', undefined, true)).toMatchObject({ code: 'INVALID_FILE' });
    expect(contentKind('notes.png', 'image', 'image/png', false)).toEqual({ kind: 'image', mime: 'image/png' });
    expect(contentKind('page.html', 'text', 'text/html', true)).toEqual({ kind: 'text', mime: 'text/html' });
  });

  it('records a MIME type the content supports, and a kind for the Artifacts views', () => {
    expect(normalizeMime('a.png', 'image/png', undefined, false)).toBe('application/octet-stream'); // claims an image, is not one
    expect(normalizeMime('a.txt', 'image/png', 'image/png', false)).toBe('image/png');
    expect(normalizeMime('notes.md', undefined, undefined, true)).toBe('text/markdown');
    expect(normalizeMime('deck.pptx', undefined, 'application/zip', false)).toMatch(/presentationml/);
    expect(artifactKind('image/png', 'a.png')).toBe('image');
    expect(artifactKind('text/markdown', 'a.md')).toBe('text');
    expect(artifactKind('text/typescript', 'a.ts')).toBe('code');
    expect(artifactKind('application/zip', 'a.zip')).toBe('archive');
    expect(inView({ kind: 'spreadsheet' }, 'documents')).toBe(true);
    expect(inView({ kind: 'audio' }, 'other')).toBe(true);
  });

  it('hashes with SHA-256 and round-trips base64', async () => {
    expect(await sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(fromBase64(toBase64(PNG))).toEqual(PNG);
  });
});

describe('FileStore (memory)', () => {
  it('stores by content, verifies refs, refuses huge files and paths outside the workspace', async () => {
    const files = new MemoryFileStore();
    const a = await files.put(PNG);
    const b = await files.put(PNG.slice());
    expect(a.storageRef).toBe(b.storageRef); // same bytes, one blob
    expect(isStorageRef(a.storageRef)).toBe(true);
    expect(a).toMatchObject({ size: PNG.length, mime: 'image/png', text: false });
    expect(await files.get(a.storageRef)).toEqual(PNG);
    await expect(files.get('C:/Windows/win.ini')).rejects.toMatchObject({ code: 'INVALID_FILE' });
    await expect(files.get(`sha256:${'0'.repeat(64)}`)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    await expect(files.put(new Uint8Array(MAX_FILE_BYTES + 1))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    await expect(files.toWorkspace(a.storageRef, 'W', '../escape.png')).rejects.toMatchObject({ code: 'INVALID_FILE' });
    await expect(files.importWorkspace('W', 'C:/secret.txt')).rejects.toBeInstanceOf(FileError);
    expect(await files.delete(a.storageRef)).toBe(true);
    expect(await files.exists(a.storageRef)).toBe(false);
  });

  it('a missing stored file fails a new message clearly, and becomes a note in history', async () => {
    const files = new MemoryFileStore();
    const reader = new AttachmentReader(files);
    const gone = { id: 'att-1', name: 'gone.png', mime: 'image/png', size: 9, kind: 'image' as const, storageRef: `sha256:${'1'.repeat(64)}` };
    await expect(reader.message('look', [gone])).rejects.toBeInstanceOf(AttachmentUnavailable);
    expect((await reader.message('look', [gone], false)).content).toMatch(/gone.png \(image\): its contents are no longer available/);
  });
});

describe('chat attachments through the FileStore', () => {
  it('keeps no bytes in the conversation record; a restart reads them back from the store', async () => {
    const storage = new MemoryAdapter();
    const files = new MemoryFileStore();
    const bus = new EventBus(500);
    const visual = new Recorder('visual', { ...BASE, vision: true, files: true });
    const providers = new ProviderService(new ProviderRegistry().register(visual), bus);
    const make = () => new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), { files });
    const chat = make();
    const c = chat.create({ connectionId: 'visual' });
    const img = await stored(files, 'red.png', PNG, 'image', 'image/png');
    chat.send(c.id, 'what is it?', [img]);
    await until(() => !chat.isBusy(c.id));
    expect(visual.requests[0].messages[0].attachments?.[0].data).toBe(toBase64(PNG));
    await chat['repo'].flush(chat.snapshot);
    const saved = JSON.stringify(await storage.get('conversations'));
    expect(saved).not.toContain(toBase64(PNG));
    expect(saved).toContain(img.storageRef!);
    expect(saved).not.toMatch(/[A-Z]:\\\\|\/Users\//); // no host paths

    const again = make();
    await again.init();
    again.send(c.id, 'and now?');
    await until(() => !again.isBusy(c.id));
    expect(visual.requests[1].messages[0].attachments?.[0].data).toBe(toBase64(PNG)); // history keeps its image
    expect(again.storageRefs().has(img.storageRef!)).toBe(true);
  });

  it('never claims a model saw a file it cannot read (capability gating)', async () => {
    const files = new MemoryFileStore();
    const bus = new EventBus(500);
    const visual = new Recorder('visual', { ...BASE, vision: true, files: true });
    const providers = new ProviderService(new ProviderRegistry().register(visual), bus);
    const chat = new ConversationRuntime(bus, providers, new ConversationRepository(new MemoryAdapter(), 5), {
      files,
      consumes: (_c, model, kind) => (model === 'text-only' && kind === 'image' ? 'this model does not read images.' : undefined),
    });
    const c = chat.create({ connectionId: 'visual', model: 'text-only' });
    expect(() => chat.send(c.id, 'look', [{ name: 'red.png', mime: 'image/png', size: 16, kind: 'image', data: toBase64(PNG) }])).toThrow(/does not read images/);
    expect(visual.requests).toEqual([]);
  });
});

function taskRig(caps: Partial<ProviderCapabilities> = { vision: true, files: true }) {
  const bus = new EventBus(500);
  const files = new MemoryFileStore();
  const provider = new Recorder('claude-code', { ...BASE, ...caps });
  const providers = new ProviderService(new ProviderRegistry().register(provider), bus);
  let n = 0;
  const skills = {
    activate: (ids: string[]) => ({ ok: true as const, context: `# Skills\n${ids.join(', ')}`, toolIds: [], refs: ids.map((id) => ({ id, version: '1.0.0', name: id })) }),
    catalog: () => [
      { id: 'nestra.workspace-note', name: 'Workspace Note', description: 'Write a note' },
      { id: 'community.inspect-image', name: 'Inspect Image', description: 'Look at an image' },
    ],
  };
  const live = new LiveRuntime(bus, providers, new RuntimeRepository(new MemoryAdapter()), { files, skills, newId: (k) => `${k}-${++n}` });
  return { live, provider, files, bus };
}

describe('task attachments (the same Attachment domain)', () => {
  it('a task carries its files by reference; the provider gets them, the record keeps no bytes', async () => {
    const { live, provider, files } = taskRig();
    const img = await stored(files, 'gradient.png', PNG, 'image', 'image/png');
    const note = await stored(files, 'brief.md', utf8('# Brief\nmake it blue'), 'text', 'text/markdown');
    const { task } = live.startTask('alex', { prompt: 'Use these', attachments: [img, note] });
    await until(() => provider.requests.length === 1);
    const msg = provider.requests[0].messages[0];
    expect(msg.attachments).toEqual([{ kind: 'image', name: 'gradient.png', mime: 'image/png', data: toBase64(PNG) }]);
    expect(msg.content).toContain('<attachment name="brief.md">');
    expect(task.attachments!.map((a) => [a.name, a.storageRef])).toEqual([
      ['gradient.png', img.storageRef],
      ['brief.md', note.storageRef],
    ]);
    expect(JSON.stringify(live.snapshot())).not.toContain(toBase64(PNG));
    expect(JSON.stringify(live.snapshot())).not.toContain('make it blue');
    expect(live.storageRefs()).toEqual(new Set([img.storageRef, note.storageRef]));
  });

  it('refuses before starting: an image for a model without vision, too many files', async () => {
    const { live, provider, files } = taskRig({});
    const img = await stored(files, 'gradient.png', PNG, 'image', 'image/png');
    expect(() => live.startTask('alex', { prompt: 'look', attachments: [img] })).toThrow(/cannot take images/);
    const t = await stored(files, 'a.txt', utf8('a'), 'text', 'text/plain');
    expect(() => live.startTask('alex', { prompt: 'x', attachments: [t, t, t, t, t] })).toThrow(/At most 4/);
    expect(live.tasksOf('alex')).toEqual([]);
    expect(provider.requests).toEqual([]);
  });

  it('a task file deleted from the store fails the run with a reason, never a blind prompt', async () => {
    const { live, provider, files } = taskRig();
    const img = await stored(files, 'gradient.png', PNG, 'image', 'image/png');
    await files.delete(img.storageRef!);
    const { run } = live.startTask('alex', { prompt: 'edit it', attachments: [{ ...img, data: undefined }] });
    await until(() => live.getRun(run.id)!.status === 'failed');
    expect(live.getRun(run.id)!.error?.message).toMatch(/gradient.png is no longer available/);
    expect(provider.requests).toEqual([]);
    expect(live.agentStatus('alex')).toBe('idle');
  });

  it('@skill in a task wins over the agent’s own Skills, and leaves the prompt', async () => {
    const { live, provider } = taskRig();
    live.updateAgent('alex', { skillIds: ['nestra.workspace-note'] });
    const { task, run } = live.startTask('alex', { prompt: '@inspect-image what colours?' });
    expect(task.prompt).toBe('what colours?');
    expect(task.skillIds).toEqual(['community.inspect-image']);
    expect(run.skills).toEqual([{ id: 'community.inspect-image', version: '1.0.0', name: 'community.inspect-image', activation: 'explicit' }]);
    await until(() => provider.requests.length === 1);
    expect(provider.requests[0].messages[0].content).toBe('what colours?');
    const plain = live.startTask('bea', { prompt: 'hello' });
    expect(plain.run.skills).toBeUndefined();
  });
});

// ── artifacts ───────────────────────────────────────────────

const writer: ToolDefinition = {
  id: 'write_text_file',
  name: 'write_text_file',
  description: 'Writes a file.',
  source: 'native',
  inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false },
  risk: 'low',
  permissions: {},
  needsWorkspace: true,
  cancellable: true,
  timeoutMs: 1_000,
};
const picture: ToolDefinition = { ...writer, id: 'mcp.photocraft.doc_export', name: 'photocraft__doc_export', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, needsWorkspace: false, metadata: { mcpServerId: 'srv-photocraft' } };

async function artifactRig(storage = new MemoryAdapter(), files = new MemoryFileStore()) {
  const bus = new EventBus(1000);
  let n = 0;
  const inUse = new Set<string>();
  const fromAttachment = new Map<string, string>();
  const artifacts = new ArtifactService(bus, storage, files, { now: () => 1_000 + n, newId: () => `art-${++n}`, inUse: () => inUse, attachmentArtifact: (id) => fromAttachment.get(id) });
  await artifacts.init();
  const registry = new ToolRegistry();
  const write: ToolExecutor = async ({ input, workspace }) => {
    const path = String(input.path);
    const ws = files.workspaces.get(workspace!) ?? new Map();
    files.workspaces.set(workspace!, ws);
    const created = !ws.has(path);
    ws.set(path, utf8(String(input.content)));
    return { success: true, content: `wrote ${path}`, artifacts: [{ kind: 'file', path, action: created ? 'created' : 'updated' }] };
  };
  const exportPng: ToolExecutor = async () => ({ success: true, content: 'exported', parts: [{ type: 'image', mimeType: 'image/png', bytes: PNG.length, data: toBase64(PNG) }] });
  registry.register(writer, write).register(picture, exportPng);
  registerFileTools(registry, files, true);
  const policy = new ToolPolicyStore(storage, bus);
  await policy.init();
  await policy.setGlobal('save_attachment', 'allow');
  const done: Promise<unknown>[] = [];
  const runtime = new ToolRuntime(registry, policy, bus, storage, {
    onCompleted: (call, result, scope) => {
      const serverId = registry.get(call.toolId)?.metadata?.mcpServerId;
      done.push(artifacts.fromToolResult(call, result, { ...scope, ...(serverId && { serverId }) }));
    },
  });
  await runtime.init();
  const settle = () => Promise.all(done);
  return { bus, storage, files, artifacts, runtime, settle, inUse, fromAttachment };
}
const signal = () => new AbortController().signal;
const chatScope = (over: Partial<ToolScope> = {}): ToolScope => ({
  runId: 'run-7',
  conversationId: 'conv-1',
  messageId: 'msg-2',
  agentId: 'alex',
  allowedToolIds: ['write_text_file', 'mcp.photocraft.doc_export', 'save_attachment'],
  requester: 'Alex',
  workspace: 'W',
  skills: [{ id: 'nestra.workspace-note', version: '1.0.0', name: 'Workspace Note', activation: 'explicit' }],
  ...over,
});

describe('ArtifactService', () => {
  it('write_text_file → an Artifact with full provenance (acceptance: artifact-test.txt)', async () => {
    const { artifacts, runtime, settle, files, bus } = await artifactRig();
    await runtime.execute({ name: 'write_text_file', input: { path: 'artifact-test.txt', content: 'RealmNest artifact runtime successful.' } }, chatScope(), signal());
    await settle();
    const [a] = artifacts.list();
    expect(a).toMatchObject({ name: 'artifact-test.txt', mimeType: 'text/plain', kind: 'text', size: 38 });
    expect(a.provenance).toMatchObject({
      origin: 'tool-file',
      createdByAgentId: 'alex',
      conversationId: 'conv-1',
      messageId: 'msg-2',
      runId: 'run-7',
      toolId: 'write_text_file',
      workspacePath: 'artifact-test.txt',
      skills: [{ id: 'nestra.workspace-note', version: '1.0.0', name: 'Workspace Note', activation: 'explicit' }],
    });
    expect(a.provenance.toolCallId).toBeTruthy();
    expect(new TextDecoder().decode(await files.get(a.storageRef!))).toBe('RealmNest artifact runtime successful.');
    expect(a.sha256).toBe(await sha256Hex(utf8('RealmNest artifact runtime successful.')));
    expect(artifacts.forMessage('msg-2').map((x) => x.id)).toEqual([a.id]);
    expect(artifacts.forRun('run-7')).toHaveLength(1);
    expect(bus.log.some((e) => e.type === 'artifact.created')).toBe(true);
  });

  it('the same file written twice in a run is one artifact, updated; unchanged content adds nothing', async () => {
    const { artifacts, runtime, settle } = await artifactRig();
    const w = (content: string) => runtime.execute({ name: 'write_text_file', input: { path: 'notes/out.md', content } }, chatScope(), signal());
    await w('one');
    await w('one');
    await w('two');
    await settle();
    const list = artifacts.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'out.md', mimeType: 'text/markdown', size: 3 });
    expect(list[0].updatedAt).toBeDefined();
  });

  it('an MCP image result → an image Artifact with its server (PhotoCraft-style export)', async () => {
    const { artifacts, runtime, settle } = await artifactRig();
    await runtime.execute({ name: 'photocraft__doc_export', input: {} }, chatScope({ taskId: 'task-3', conversationId: undefined, messageId: undefined }), signal());
    await settle();
    const [a] = artifacts.list('images');
    expect(a).toMatchObject({ name: 'doc_export-1.png', mimeType: 'image/png', kind: 'image' });
    expect(a.provenance).toMatchObject({ origin: 'tool-part', toolId: 'mcp.photocraft.doc_export', serverId: 'srv-photocraft', taskId: 'task-3' });
    expect(artifacts.forTask('task-3')).toHaveLength(1);
  });

  it('lineage: made from the run’s attachments, and from the artifact one of them came from', async () => {
    const { artifacts, runtime, settle, files, fromAttachment } = await artifactRig();
    await runtime.execute({ name: 'photocraft__doc_export', input: {} }, chatScope({ runId: 'run-1' }), signal());
    await settle();
    const first = artifacts.list()[0];
    // Use in Chat: the same stored bytes become an attachment of the next run
    const input = await artifacts.asAttachment(first.id);
    expect(input).toMatchObject({ kind: 'image', storageRef: first.storageRef, source: 'artifact', artifactId: first.id });
    fromAttachment.set('att-9', first.id);
    const attachments = [{ id: 'att-9', name: input.name, mime: input.mime, storageRef: input.storageRef! }];
    await runtime.execute({ name: 'write_text_file', input: { path: 'caption.txt', content: 'a gradient' } }, chatScope({ runId: 'run-2', attachments }), signal());
    await settle();
    const second = artifacts.forRun('run-2')[0];
    expect(second.provenance.sourceAttachmentIds).toEqual(['att-9']);
    expect(second.provenance.sourceArtifactIds).toEqual([first.id]);
    expect(artifacts.lineage(second.id).sources.map((s) => s.id)).toEqual([first.id]);
    expect(artifacts.lineage(first.id).derived.map((s) => s.id)).toEqual([second.id]);
    expect(await files.exists(first.storageRef!)).toBe(true);
  });

  it('delete: a tombstone stays for history; bytes go unless an attachment still uses them', async () => {
    const { artifacts, runtime, settle, files, inUse } = await artifactRig();
    await runtime.execute({ name: 'write_text_file', input: { path: 'a.txt', content: 'alpha' } }, chatScope(), signal());
    await runtime.execute({ name: 'write_text_file', input: { path: 'b.txt', content: 'beta' } }, chatScope(), signal());
    await settle();
    const [b, a] = artifacts.list();
    const refA = a.storageRef!;
    const refB = b.storageRef!;
    inUse.add(refB);
    await artifacts.delete(a.id);
    await artifacts.delete(b.id);
    expect(artifacts.list()).toEqual([]);
    expect(artifacts.forMessage('msg-2').every((x) => x.deletedAt)).toBe(true); // history: "Artifact deleted"
    expect(await files.exists(refA)).toBe(false);
    expect(await files.exists(refB)).toBe(true); // still attached somewhere
    await expect(artifacts.exportCopy(a.id)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    await expect(artifacts.asAttachment(a.id)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    expect(await artifacts.bytes(a.id)).toBeUndefined();
  });

  it('export copies, never moves; programs are never opened; names cannot carry folders', async () => {
    const { artifacts, files } = await artifactRig();
    const a = await artifacts.register({ name: '..\\..\\evil/run.exe', bytes: EXE, provenance: { origin: 'manual' } });
    expect(a.name).toBe('run.exe');
    expect(a.mimeType).toBe('application/x-msdownload');
    expect(a.metadata?.executable).toBe(true);
    await expect(artifacts.open(a.id)).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    await expect(artifacts.asAttachment(a.id)).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    expect(await artifacts.exportCopy(a.id)).toBe('exports/run.exe');
    expect(files.exported).toEqual([{ storageRef: a.storageRef, name: 'run.exe' }]);
    expect(await files.exists(a.storageRef!)).toBe(true);
    expect(artifactName('a\u0000b:c?.txt')).toBe('a_b_c_.txt');
    expect(artifactName('...')).toBe('output');
  });

  it('survives a restart: records from storage, bytes from the store', async () => {
    const storage = new MemoryAdapter();
    const files = new MemoryFileStore();
    const one = await artifactRig(storage, files);
    await one.runtime.execute({ name: 'write_text_file', input: { path: 'keep.txt', content: 'kept' } }, chatScope(), signal());
    await one.settle();
    await one.artifacts.flush();
    const two = await artifactRig(storage, files);
    const [a] = two.artifacts.list();
    expect(a.name).toBe('keep.txt');
    expect(await two.artifacts.text(a.id)).toBe('kept');
    expect(JSON.stringify(await storage.get('artifacts'))).not.toContain('kept');
  });

  it('a failed import is recorded for Debug › Files, not thrown at the tool', async () => {
    const { artifacts } = await artifactRig();
    const out = await artifacts.fromToolResult(
      { id: 'call-1', runId: 'r', toolId: 'write_text_file', input: {}, status: 'completed', requestedAt: 0 },
      { toolCallId: 'call-1', success: true, artifacts: [{ kind: 'file', path: 'missing.txt', action: 'created' }] },
      chatScope(),
    );
    expect(out).toEqual([]);
    expect(artifacts.issues[0]).toMatchObject({ toolCallId: 'call-1', code: 'FILE_NOT_FOUND' });
  });

  it('file: links count only inside the run’s workspace', () => {
    expect(workspaceRelative('file:///C:/Work/out/a.png', 'C:\\Work')).toBe('out/a.png');
    expect(workspaceRelative('file:///c:/work/a.png', 'C:\\Work\\')).toBe('a.png');
    expect(workspaceRelative('file:///C:/Other/a.png', 'C:\\Work')).toBeUndefined();
    expect(workspaceRelative('file:///C:/Work/../Windows/a.png', 'C:\\Work')).toBeUndefined();
    expect(workspaceRelative('https://x.test/a.png', 'C:\\Work')).toBeUndefined();
    expect(workspaceRelative('file:///home/me/w/a.txt', '/home/me/w')).toBe('a.txt');
  });

  it('keeps a bounded history, dropping tombstones first', () => {
    const many = Array.from({ length: MAX_ARTIFACTS + 2 }, (_, i) => ({ id: `a${i}`, name: 'x', mimeType: 'text/plain', size: 1, kind: 'text' as const, createdAt: i, provenance: { origin: 'manual' as const, sourceAttachmentIds: [], sourceArtifactIds: [], createdAt: i }, ...(i < 3 && { deletedAt: 5 }) }));
    const kept = pruneArtifacts({ version: 1, artifacts: many }).artifacts;
    expect(kept).toHaveLength(MAX_ARTIFACTS);
    expect(kept.some((a) => a.id === 'a0' || a.id === 'a1')).toBe(false);
  });
});

describe('save_attachment (run-scoped)', () => {
  it('copies only the run’s own attachments into the workspace', async () => {
    const { runtime, files } = await artifactRig();
    const s = await files.put(PNG);
    const mine = [{ id: 'att-1', name: 'gradient.png', mime: 'image/png', storageRef: s.storageRef }];
    const ok = await runtime.execute({ name: 'save_attachment', input: { attachment: 'gradient.png', path: 'in/gradient.png' } }, chatScope({ attachments: mine }), signal());
    expect(ok.result).toMatchObject({ success: true });
    expect(files.workspaces.get('W')!.get('in/gradient.png')).toEqual(PNG);
    // another run: it has no such attachment, whatever the model says
    const other = await runtime.execute({ name: 'save_attachment', input: { attachment: 'gradient.png' } }, chatScope({ runId: 'run-8', attachments: [] }), signal());
    expect(other.result.error).toMatchObject({ code: 'FILE_NOT_FOUND', message: 'This run has no attachments.' });
    const ref = await runtime.execute({ name: 'save_attachment', input: { attachment: s.storageRef } }, chatScope({ runId: 'run-9', attachments: mine }), signal());
    expect(ref.result.error?.code).toBe('FILE_NOT_FOUND');
    const escape = await runtime.execute({ name: 'save_attachment', input: { attachment: 'gradient.png', path: '../../x.png' } }, chatScope({ attachments: mine }), signal());
    expect(escape.result.error?.code).toBe('PATH_OUTSIDE_WORKSPACE');
  });
});

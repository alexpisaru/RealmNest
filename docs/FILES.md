# Files: attachments, artifacts and the FileStore

RealmNest handles three kinds of files. They are kept apart on purpose:

| | what it is | where it comes from | where it lives |
| --- | --- | --- | --- |
| **Attachment** | a file the user gives a run | the chat composer, an agent task, "Use in Chat" | a record on the message or task (`domain/attachment.ts`), its bytes in the FileStore |
| **Artifact** | a file a run **produced** | a tool wrote it in the workspace, or an MCP tool returned it | a record in `artifacts` (`domain/artifact.ts`), its bytes in the FileStore |
| **Skill resource** | a file bundled inside a Skill | the Skill package | the Skill store (`docs/SKILLS.md`); read with `read_skill_resource`, never listed as an Artifact |

The audit that came before this work is in [FILES_AUDIT.md](FILES_AUDIT.md).

## Code map

| | |
| --- | --- |
| `src-tauri/src/files/` | the native FileStore: `mod.rs` (put, get, exists, delete, import from a workspace, write into a workspace, named copies, export, collect), `sha256.rs`, `sniff.rs` (magic bytes), `dialog.rs` (Windows save dialog, open, reveal) |
| `src/runtime/files/store.ts` | the `FileStore` port: `TauriFileStore` (desktop), `MemoryFileStore` (browser beta, tests), `FileError` codes |
| `src/runtime/files/mime.ts` | the same sniffing table in TypeScript, MIME normalisation, Artifact kinds, SHA-256 (Web Crypto), base64 |
| `src/runtime/files/payload.ts` | `AttachmentReader`: attachment contents for a provider message, cached, from the FileStore |
| `src/runtime/files/artifacts.ts` | `ArtifactService` |
| `src/runtime/tools/fileTools.ts` | the `save_attachment` tool |
| `src/ui/files/` | import (`importFiles.ts`), shared chips, thumbnails, lightbox and artifact strip (`FileViews.tsx`), Debug › Files |
| `src/ui/screens/Artifacts.tsx` | the Artifacts screen |

## The FileStore

- **References, never paths.** A record holds `storageRef: "sha256:<64 hex>"`. Neither the model nor the webview ever gets a host path. Bytes go in as a raw IPC body (`files_put`), not JSON or base64, and come back as an `ArrayBuffer`.
- **Content-addressed.** Blobs live in `%LOCALAPPDATA%\app.nestra.desktop\files\blobs\<2 hex>\<64 hex>`, written to a temporary file and then renamed, so a blob is never half written. The same bytes are stored once; records stay separate.
- **Integrity.** `get` hashes the bytes again. A blob changed outside RealmNest fails with `FILE_CHANGED`.
- **Types come from the content.** Magic bytes decide (PNG, JPEG, GIF, WebP, PDF, ZIP, GZIP, WAV, MP3, OGG, FLAC, MP4, WebM, EXE/MZ, ELF, SQLite, SVG, HTML). The name only tells text formats apart. A declared type that needs magic bytes that are not there is not trusted.
- **Limits.** 32 MB per managed file. Attachments also keep their per-kind limits (text 100 KB, image 5 MB, PDF 10 MB, 4 files and 15 MB per message).
- **Errors** are structured: `FILE_TOO_LARGE`, `INVALID_FILE`, `UNSUPPORTED_FILE_TYPE`, `FILE_NOT_FOUND`, `FILE_CHANGED`, `IMPORT_FAILED`.
- **Clean-up.** At start, `files_collect` moves to `files/trash/<date>/` the blobs that no conversation, task, artifact, Knowledge document, research report or crew references and that are **older than a day**, and deletes trash folders older than 30 days. A trashed blob a record asks for again is moved back. The clean-up runs only when every store loaded cleanly, no saved record was unreadable and no save failed in this or the previous session (docs/HARDENING.md D-4). Debug › Files can run it by hand.
- **Browser beta.** The store is in memory, so files last until the page reloads.

## Attachments

What changed in this milestone (it was not rebuilt):

- **Import** (`ui/files/importFiles.ts`), the same for the chat composer and agent tasks:
  1. size, before reading;
  2. bytes;
  3. what the content really is (`contentKind`), which catches a program renamed `.pdf` or text renamed `.png`;
  4. whether the chosen model can take that kind;
  5. the per-kind limit;
  6. `FileStore.put`.

  A refused file stores nothing.
- **Each file on its own.** Every file shows its own chip: loading, then ready (with a thumbnail) or an error that explains why. A file removed while it loads is forgotten. Send waits for files that are still loading. Pasted screenshots get a dated name.
- **Records** carry `storageRef`, `sha256`, `source` (`picker`, `drop`, `paste`, `artifact`), `createdAt` and, for "Use in Chat", `artifactId`. Text and bytes are no longer saved in the message. They come back from the store after a restart, so images and PDFs are **kept across restarts** (before, they were lost). Messages from before keep their inline text.
- **History.** Providers without sessions get earlier files again, within an 8 MB budget and only for kinds the model takes. Otherwise a note stands in: "was attached earlier; not sent again", "this model cannot take it", or "no longer available".
- **Capability gating.** A model gets an image or a PDF only when its adapter declares it and the Capability System does not say the model cannot read it (`consumes` in `main.tsx`). Otherwise the send is refused before anything starts. A model is never sent just the file name and left to pretend it saw the file.
- **Task attachments.** `LiveRuntime.startTask(agentId, {prompt, attachments, skillIds})` uses the same domain and the same `AttachmentReader`. The task panel has an attach button, drop and paste.
- **Run scoping.** A run's tools get `attachments`, which holds only that chat's or task's own files. `save_attachment` copies one into the workspace by its **name** (never a storage ref or a path from the model), so other tools, such as an image editor's MCP server, can open it there.

## Artifacts

`ArtifactService` registers what tools produce. `ToolRuntime` calls `onCompleted(call, result, scope)` for every completed call:

- **A file a tool wrote** (`result.artifacts`, e.g. `write_text_file`): the workspace file is copied into the store, so the workspace can change later. When the same path is written again in the same run, it stays one artifact and is updated; identical content adds nothing.
- **A binary MCP result** (`result.parts`: image, audio, or an embedded resource with bytes or long text) is stored as it is.
- **A `file:` link** in an MCP result is imported only when it points **inside the run's workspace**. Nothing else is read.

**Provenance** records `origin` (`tool-file`, `tool-part`, `manual`), `createdByAgentId`, `conversationId`, `messageId` (the assistant reply), `taskId`, `runId`, `toolId`, `toolCallId`, `serverId` (MCP), `workspacePath` (relative), `skills` (id, version, name and **activation**) and `createdAt`.

**Lineage:**
- `sourceAttachmentIds` are the run's attachments;
- `sourceArtifactIds` are the artifacts those attachments came from (through "Use in Chat");
- `lineage(id)` gives the sources, the missing ones, and what was derived from it.

**Delete:**
- the record stays as a **tombstone** (`deletedAt`), so chat history shows "Artifact deleted";
- the bytes go unless an attachment still uses them;
- open, export and reuse then fail with `FILE_NOT_FOUND`.

**Export, open and reveal:**
- **Export** goes through the Windows save dialog, or into `Documents\RealmNest Exports` without overwriting. It is always a **copy**: the managed original never moves.
- **Open and reveal** work on a named copy in `files\open\`.
- **Open** works only for documents and media on an allowlist (PDF, images, text, Office and OpenDocument files, RTF, MP3/WAV/MP4/WebM) and only when the bytes match the name (a PDF must start with `%PDF`, an image must be an image, text must be plain text). The name is normalised first (trailing dots and spaces, reserved Windows names), and the copy carries the "downloaded from the internet" mark, so Office and SmartScreen treat it with care. Everything else (programs, scripts, HTML, SVG, disk images, shortcuts…) is refused with `UNSUPPORTED_FILE_TYPE`: export a copy instead.

**Reuse.** `asAttachment(id)` gives an attachment of the same stored bytes (`source: 'artifact'`, `artifactId`). Only text, images and PDFs can go to a model.

**Persistence.** Records are saved under `artifacts` (at most 2,000; tombstones are dropped first). Events are `artifact.created`, `artifact.updated`, `artifact.deleted` and `artifact.failed`; they carry ids and sizes only. An import that fails is kept for Debug › Files, and the tool call itself is not affected.

### UI

- **Chat.** Under an assistant reply: what it produced (thumbnail, name, kind and size; Open, Show in folder, Export a copy). A deleted one shows "Artifact deleted".
- **Agent task panel.** The run's files and an **Outputs** section.
- **Artifacts screen** (sidebar):
  - All, Images, Documents and Other;
  - a detail view with a safe preview: images as images; text, code, HTML and SVG **as text**; programs not at all;
  - MIME type, size, SHA-256, date, creator, where it was made (link to the chat), tool, workspace path, Skills, inputs and "used for";
  - actions: Open, Show in folder, Use in Chat, Send to Agent, Export a copy, Delete (confirmed in place).
  - **Send to Agent** asks which agent, then **New task** (that agent's inspector opens with the file attached to its next task) or **New chat**.
- **Debug › Files** (Simulation drawer):
  - the store kind and the reference counts;
  - a check that every referenced file is present;
  - "Remove unused files";
  - the artifact table, import problems and artifact events.

## Security

| risk | what RealmNest does |
| --- | --- |
| path traversal | workspace paths go through the same checks as the file tools (`tools::existing_file`, `write_bytes`): relative only, no `..`, no drive or UNC, inside the canonical workspace |
| symlinks | a symlink at a temporary write path is removed, not followed; writes use `create_new`; clean-up does not follow links |
| MIME spoofing | magic bytes decide; a mismatch is refused with a reason |
| huge files | size checked before reading (UI) and again natively; 32 MB cap; per-kind attachment limits |
| SVG / HTML | stored and shown as text, never rendered as markup, never opened |
| executables | stored only as artifacts a tool produced (flagged `executable`); never opened, never sent to a model, never run |
| archives | stored as bytes; never extracted (no archive bombs) |
| WebView file URLs | none: previews are `data:` URLs from bytes; no `file://`, no asset protocol |
| IPC | file bytes travel as raw IPC bodies; the CSP allows only `ipc:` and `http://ipc.localhost` besides `'self'` (`connect-src`) |
| cross-run access | a tool sees only its run's attachments; the model names files by name, never by ref or path |
| secret leakage | records, events and Debug › Files carry ids, sizes and hashes, never contents or host paths |

## Acceptance (desktop release, 13 October 2026)

These tests ran on the native release (`realmnest-os.exe`), driven through WebView2's DevTools port and the real Windows dialogs.

- **A. Existing attachment workflow.**
  - The file picker added `gradient.png` and `brief.md`; each got its own chip and thumbnail.
  - A file dropped on the composer was added; removing it before sending dropped it.
  - Claude Code read both: "magenta/pink, purple-blue, cyan and green … under 64 px tall".
- **B. `@skill`.**
  - `@work` listed Workspace Note, and Enter turned it into the chip `[ Workspace Note × ]`.
  - The text kept no `@`. The model got only `write_text_file` and `read_text_file`, with the Tools switch off.
  - It wrote and read back `artifact-test.txt` = `RealmNest artifact runtime successful.`
  - The reply shows "In uso: Workspace Note · scelta da te".
  - Without `@`, nothing was activated. Naming "Workspace Note" in full activated it automatically, shown as "· automatica" with its reason.
- **C. Attachment + `@skill`.** `brief.md` and Workspace Note together wrote `brief-line.txt`. The artifact's `sourceAttachmentIds` point to that attachment.
- **D. Native artifact.** `artifact-test.txt` (35 B) appeared under the reply with its full provenance: `activation: explicit`.
- **E. PhotoCraft.**
  - Alex's task got `gradient.png` from the task panel.
  - `save_attachment` → `doc_open` → `render_preview` ran, with three approvals.
  - The output `render_preview-1.png` (64 × 48, a real render of the gradient) records the input attachment, the tool, the tool call, the run, the task, the agent and the MCP server.
- **F–G. Artifacts screen.** The grid, the detail view, the preview, the hash and all provenance fields were checked.
- **H. Use in Chat.** A new chat started with the stored file (`source: artifact`, `artifactId`, same `storageRef`); Claude described it.
- **I. Send to Agent → New task.** Alex's inspector opened with the file attached; the task ran on it.
- **J. Restart.**
  - The image in a chat came back from the store; before this work it was lost.
  - Artifacts, previews and provenance were kept.
  - Debug › Files reported "Every referenced file is present".
- **K. Export.**
  - The Windows "Esporta una copia" dialog saved a copy byte-identical to the blob.
  - The original stayed, and a toast showed the path.
- **L. Delete.**
  - Delete was confirmed in place.
  - The blob was removed and the record became a tombstone.
  - The chat shows "Artifact eliminato".
- **M. Unsupported provider.** With Auto on Nemotron 3 Super (free), `gradient.png` was refused on its chip: "Nemotron 3 Super (free) non accetta immagini". Nothing was sent.

**Fixed during acceptance:**
- **CSP.** It did not allow the IPC channel, so Tauri fell back to `postMessage`, which serializes everything to JSON. Binary bodies never reached Rust ("Send the file as raw bytes").
- **Save dialog.** It ran on a pool thread without COM and without an owner window, so it failed silently and looked like a cancel. It now runs on its own STA thread, modal to the RealmNest window, and reports a real failure as an error.

## Knowledge

Knowledge documents ([KNOWLEDGE.md](KNOWLEDGE.md)) reference stored files: an attachment or an artifact shares its `storageRef` (no copy), a file added from disk is `put` into the FileStore. Each index generation is stored as FileStore blobs too (a JSON list of chunks, float32 vectors in parts of at most 16 MB). `KnowledgeService.storageRefs()` joins the clean-up keep list and the artifacts' "still in use" check, so deleting an artifact never removes bytes a Knowledge document still uses, and removing a document never deletes its source. A newer version of an artifact makes the documents made from it *Out of date*. No OCR: a PDF without a text layer is `NO_EXTRACTABLE_TEXT`.

## Known limitations

- **Claude Code's own tools** (Write, Edit…) are off in RealmNest. Only RealmNest tools (through the bridge) produce artifacts.
- **Remote URLs.** An MCP result that only links a file outside the workspace (`https:`, another folder) is not imported.
- **Open and reveal** need the desktop app; the browser beta says so.
- **Skill selection in tasks** is by `@id` in the task text; the task panel has no chip picker yet.

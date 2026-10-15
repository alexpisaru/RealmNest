# File system foundation: audit (before the milestone)

This is the state of attachments, `@skill` invocation, and the places Artifacts plug into. Each item gets one verdict:

| Verdict | Meaning |
|---|---|
| WORKS | correct as is |
| PARTIAL | right idea, with gaps |
| BROKEN | does not do what it claims |
| UNSAFE | a security or data-loss risk |
| DUPLICATED | the same logic in two places |
| MISSING | not there at all |

The milestone's changes are in [FILES.md](FILES.md).

## Attachments: what already existed

| Area | Verdict | What is there |
|---|---|---|
| Domain type | PARTIAL | `Attachment {id, name, mime, size, kind, text?}` in `src/domain/attachment.ts`. Kinds are text, image and pdf. There is no storage reference, hash, source or creation time. |
| Limits | WORKS | 4 files per message. Text up to 100 KB, images up to 5 MB, PDFs up to 10 MB, 15 MB in total. Sizes are checked before a file is read. |
| Type detection | PARTIAL | Browser MIME plus the extension; there is no magic-byte check. A renamed binary passes as PDF (`.pdf` alone is enough) or as text. |
| Text blocks | PARTIAL | `withTextAttachments` wraps each file in `<attachment name="…">`. File text containing `</attachment>` can close the block early (delimiter injection). |
| "+" file picker, drag and drop, paste | WORKS | All three feed one `onAttach`. Paste takes files from `clipboardData.files`, so screenshots arrive as images. |
| Reading a batch | PARTIAL | One bad file stops the whole batch. A stale closure (`[...files, ...next]`) can drop files when two attaches overlap. There is no loading state. |
| Chips and remove before send | WORKS | Image thumbnails, or an icon with kind and size; × removes. |
| Model capability check | PARTIAL | When a file is added and again at send, the UI checks `vision.input` / `files.input` for the chosen model. The runtime checks only the adapter's flags. After switching to a model without vision, older history images are still sent. |
| Persistence | UNSAFE / PARTIAL | Image and PDF bytes live only in an in-memory map and are lost at restart (by design: "no longer available"). Text attachments are saved in full inside the message, and `pruneChat` does not cap them. The localStorage adapter swallows quota errors, so one large text file can make every later chat save fail silently. The in-memory blobs are never evicted. |
| Restart and retry | PARTIAL | History shows a name chip and the model gets a note. Retrying silently drops image and PDF bytes that are gone. |
| Absolute paths | WORKS (attachments) | Only `File.name` is kept. Separately, `Conversation.workspace` saves an absolute path. |
| Claude Code | WORKS | `--input-format stream-json` with `image` and `document` blocks, files of the newest message only (the session remembers earlier ones). |
| OpenRouter | WORKS / PARTIAL | Data-URL `image_url` and `file` parts. With no sessions, every earlier image or PDF is re-sent on every turn, until the request reaches Rust's 24 MB limit and each later turn fails. |
| Rust allowlists | WORKS | Data URLs only (png/jpeg/webp/gif/pdf), 16 parts, 24 MB request and stdin limits. There is no base64 or magic-byte validation. |
| Agent task attachments | MISSING | `startTask` takes only a prompt, and the task panel has no picker. |
| File store, hashing, managed folder | MISSING | No store for attachment bytes. SHA-256 is used only for Skill packages. |
| Debug › Files | MISSING | |
| Tests | WORKS | 11 attachment tests in TS, plus the Rust tests for data-URL parts and process stdin. Not covered: UI races, quota, history growth, spoofed types. |
| Docs | PARTIAL | `docs/CHAT.md` matches the code. `providers/OPENROUTER.md` and `PROVIDERS.md` still say "text only", and `UI_UX.md` says "Artifacts are not built". |

## Tools and MCP: where Artifacts plug in

| Area | Verdict | What is there |
|---|---|---|
| `write_text_file` / `read_text_file` | WORKS | Narrow Rust commands. The workspace must be canonical and not a drive root; relative paths only; no `..`, device names or ADS. Writes never go through a link and are atomic. |
| Temp file used by a write | UNSAFE (low) | `.{name}.realmnest-tmp` is written with `fs::write`, which follows a symlink already planted at that name. |
| `ToolArtifact` / `ToolResult.artifacts` | PARTIAL | `{kind: 'file', path, action, bytes}` is set by `write_text_file` only. It is forwarded to the model and saved with the tool call, but nothing registers or shows it. |
| MCP parts | PARTIAL | `image`, `audio` and `resource` blobs (up to 8 MB per part) are kept in memory only, and their `data` is stripped from saved calls. The model gets descriptions. No UI renders parts. |
| Tool-call records | PARTIAL | Saved under `tool-calls` (the last 300). No `taskId`, no workspace and no Skill refs on the call. |
| Provenance ids | PARTIAL | Runs, tasks, messages and tool calls all have ids. Chat and agent run ids come from separate counters with the same shape, so key Artifacts by tool call. |

## `@skill` invocation

| Area | Verdict | What is there |
|---|---|---|
| Syntax | WORKS (strict) | `@` plus a full id (`publisher.name`), at the start or after a space or a bracket. E-mail addresses are ignored. Lowercase only. |
| Short names | MISSING | `@workspace-note` (no publisher) does nothing and gives no feedback. |
| Autocomplete | WORKS | Matches the short id or the name; arrows, Enter or Tab, Esc. It inserts the full id, and tags under the text show what was recognised. |
| `@` text sent to the model | PARTIAL | The mention stays in the prompt and in history; for providers without sessions it is re-sent with old messages. |
| Activation in chat | PARTIAL | Mentions plus the old per-chat Skill. An agent's assigned Skills are only listed in the catalog, not activated. The agent's tool permissions are not passed. No `skill.activated` event. |
| Activation in agent tasks | PARTIAL | The assigned Skills only; no mentions and no catalog. |
| Precedence | MISSING | Explicit, assigned and automatic are not distinguished. |
| Provenance | PARTIAL | `run.skills = [{id, version, name}]` with no activation mode. Messages do not record Skills. |
| Visibility | PARTIAL | Agent runs show "Skill: …". Chat messages never show which Skills were used. |
| Automatic selection | MISSING | Only the catalog text exists. |
| Readiness, conflicts, limits, tool subset, Claude bridge | WORKS | Checked before the provider: 3 Skills, 32 tools, 14k context. Only the Skill's tools reach Claude through the bridge. |

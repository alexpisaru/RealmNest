# V1 hardening

| | |
| --- | --- |
| scope | the whole RealmNest OS repository before a public beta: reliability, safety, security, data integrity, compatibility and release blockers. No new product features |
| date | 15 October 2026, version 0.11.0-beta |
| method | six read-only audit passes (data and startup; runtime state machines; Rust and IPC; integrations; content, rendering and frontend; release readiness), every finding with file and line; fixes in five tracks with a regression test for each; acceptance on the native release exe |
| status | **hardening complete for this pass: every P0 and P1 fixed; P2s fixed except the ones listed under Deferred** |
| verdict | **ready for a public beta on Windows**, with the known limitations below (see [Verdict](#verdict)) |

## 1. Architecture reviewed

| layer | what | where |
| --- | --- | --- |
| shell | Tauri 2, one window `main` (+ hidden reader and PDF windows without IPC), WebView2; 83 IPC commands registered in `lib.rs`, `build.rs` and `capabilities/default.json` (window `main` only) | `src-tauri/src/lib.rs`, `commands*.rs` |
| state | almost all user data in WebView2 localStorage, prefix `nestra:`, one JSON snapshot per key, one quota per origin | `src/persistence/*`, every `*Repository` |
| files | content-addressed blobs (`sha256:` refs, temp + rename, hash checked on read, 32 MB, trash kept 30 days), Skills, MCP trust, Telegram pairing, bridge configs, hidden reader profile | `%LOCALAPPDATA%\app.nestra.desktop\…` |
| secrets | Windows Credential Manager, write-only from the page, names restricted | `src-tauri/src/secrets.rs` |
| runtimes | Live agents, Chat, ToolRuntime + ToolLoop, Delegation, Crew, Workflow orchestrator + Scheduler, Deep Research, Knowledge, Memory, Web, Usage; one event bus | `src/runtime/*`, `src/core/events.ts` |
| providers | Claude Code and Codex CLIs (process host, twin argument allowlists, Job Objects), OpenRouter / Anthropic / OpenAI / Ollama over Rust HTTP hosts | `src/runtime/providers`, `src-tauri/src/{process,programs,openrouter,anthropic}` |
| integrations | MCP (stdio, HTTP, OAuth) + the RealmNest MCP bridge for the CLIs, Skills (local, package, GitHub), Telegram (long polling) | `src/runtime/{mcp,skills,telegram}`, `src-tauri/src/{mcp,skills,telegram}` |
| startup | `connections.init` → every service init, each isolated → orchestrator → scheduler → render; Telegram after the scheduler, not awaited; file clean-up only after clean loads | `src/main.tsx` |
| shutdown | closing the main window exits the app; `RunEvent::Exit` kills processes, logins, streams, MCP servers, the bridge and the `ollama serve` RealmNest started; children in kill-on-close Job Objects; delayed saves flushed on `pagehide` | `src-tauri/src/lib.rs`, `src/persistence/coalesced.ts` |

Lifecycles after a restart: live runs and tasks become failed/interrupted; streaming chat replies keep their text and are marked interrupted; open tool calls are cancelled (pending approvals live in memory); crew and research runs become interrupted (resume by hand); workflow running nodes, and tool/agent nodes that were waiting for a tool approval, become interrupted and the run is suspended; crew nodes follow their crew run; Knowledge re-queues interrupted indexing but gives up after two interrupted attempts.

## 2. Findings and fixes

IDs keep the audit pass they came from: D data/startup, R runtime, S Rust/IPC, I integrations, C/K/M/E/W content and frontend, L release. Duplicates are merged under the first ID.

### P0 — release blockers (all fixed)

| ID | finding | fix | test |
| --- | --- | --- | --- |
| S-1 (= C-3) | Open file could run an executable: `Invoice.exe.` passed the check and was opened; denylist incomplete; no Mark-of-the-Web | Open only an allowlist of document/media kinds, decided on the normalised name **and** the sniffed bytes; copies carry `Zone.Identifier` (ZoneId=3); the page's MIME is ignored; refusals `UNSUPPORTED_FILE_TYPE`. `artifactName` strips trailing dots/spaces, device names, bidi controls | `files::opens_only_documents_whose_bytes_match_their_name`, `names_and_openable_kinds`; `contentHardening` names |
| I-1 (= S-13) | Claude Code loaded `<workspace>/.claude/settings.json`: a hook ran a command on every turn outside ToolRuntime (**reproduced on this PC**) | `--setting-sources user` required by both allowlists; Claude Code always runs in RealmNest's own folder (the host refuses a cwd for it); `--tools` only `""` or `WebSearch` | `claudeProvider` ("never loads a project's settings…", "runs in RealmNest's own folder"), args cases, `process::claude_runs_only_in_realmnests_own_folder` |
| D-1 (= C-1, L-9) | Write failures at the storage quota were swallowed: silent rollback at next start, scheduler re-firing | Failures recorded (`src/persistence/health.ts`), banner in the app, marker for the next launch, usage per key in Settings › Data; the clean-up is skipped after any failure; the scheduler saves before it fires | `dataSafety` (quota adapter, marker), workflow R-13 |
| D-2 (= E-1) | One bad record or failing init → blank window on every launch | Every init isolated; record guards in every loader; root and per-screen error boundaries; recovery page with Retry and **Start safely** (no MCP autostart, scheduler or Telegram for that launch) | `dataSafety` loaders, `knowledgeHardening`/`contentHardening` seeds; **verified on the release** (below) |
| D-4 (+ C-2) | Startup clean-up deleted files that lost or capped records still pointed to | Clean-up only after every store loaded cleanly and no write failed (this or the previous session); blobs go to `files/trash/<date>/` for 30 days and come back if asked for; live artifacts never pruned; pinned/active chats and open tasks never pruned; crew files in the keep list | `dataSafety` `shouldCollect`, `files::collects_only_unreferenced_old_blobs`, `contentHardening` 2,001 artifacts |
| D-5 | No single instance: two windows overwrote each other, schedules fired twice | Named mutex `Local\app.nestra.desktop.single`; a second start focuses the first window and exits | **verified on the release** |

### P1 — must fix before V1 (all fixed)

| ID | fix |
| --- | --- |
| D-3 | Unreadable keys are copied to `nestra:corrupt:<key>` and never overwritten at startup; banner says so |
| D-6 | Reset demo data emits `character.deleted`; LiveRuntime drops the definitions and cancels runs; memory scrubbed; the confirm text says exactly what is reset |
| D-7 | **Full backup**: Settings › General › Data exports every `nestra:*` record to one file (native Save dialog); Import validates strictly, asks, freezes writes, restores, rolls back on failure, reloads. Secrets are never included |
| I-4 | Telegram no longer delays the first render |
| R-1 | Workflow tool-node attempts carry their own controller; stale settlements ignored |
| R-2 | A finished/cancelled workflow stops every busy node, pending tool approvals included |
| R-3 | Tool/agent nodes waiting for an approval at shutdown become interrupted; the run is suspended and resumable |
| R-4 | Deep Research cancel always lands; no second writer; stopping the parent never starts the writer |
| R-5 (= I-14) | The MCP bridge counts calls per session with ToolLoop's limits and ends the run with `tool_call_limit` |
| R-6 (= I-3) | Claude Code / Codex turns with RealmNest tools get 30 minutes (approvals, delegation, research) |
| R-7 | Only ended workflow/crew/research runs are pruned; when all slots are open a new run is refused with a clear error |
| R-10, R-11 | Bus handlers isolated; a throw in `launch`/`dispatch` ends the run failed instead of stuck |
| R-13 | Scheduler saves `nextAt` before creating a run, never creates two runs for the same planned time, skips a firing while the previous run is open ("Run now" may overlap) |
| R-15 | Unknown/deleted agents refused (`UNKNOWN_AGENT`); deleting a character cancels its run |
| S-2 | Workspace roots and write targets refused when they are, contain or sit in protected folders (app data, AppData incl. Startup, Windows, Program Files, ProgramData, the profile root, `.ssh`, `.claude`, `.codex`, `.aws`, `.config`, `.gnupg`) |
| S-3 | `secret_set` accepts only `conn.*`, `mcp.<id>.<VAR>` (not `OAUTH*`), `telegram.botToken`; a header secret is bound to the address it was first sent to; an OAuth sign-in must belong to the server's address |
| S-4 (= I-2) | Blocking commands moved off the main thread; per-server MCP writer thread with a bounded queue and 10 s timeout; bridge write timeout |
| S-5 (= I-11) | Consent dialog shows every argument and env value (credentials masked), escapes control/bidi characters, warns on `NODE_OPTIONS`, `PATH`, `PYTHON*`…, refuses risky ones as hidden secrets |
| S-6, I-7, I-9 | OAuth: guarded client (public addresses, https, no redirects, 1 MB), `resource` and `issuer` checked, one refresh at a time, wrong `state` ignored |
| S-7 | The hidden reader goes through a local guard proxy that resolves and checks every destination (blocks private networks and DNS rebinding), WebRTC limited, filter on every request source; fails closed |
| S-8, I-15, I-16 | Capped line reader and bounded joins in the process host; MCP HTTP total/idle timeouts; provider error bodies read within deadline and Stop |
| I-5 | A Skill never grants a tool the agent wasn't given (`SKILL_NOT_READY` lists what to allow); `@mentions` only from user-typed text |
| I-6 | Telegram crew buttons bound to the plan/final revision; stale presses refused |
| K-1 | PDF/DOCX extraction with decompression and work budgets, cooperative yielding, abort and a 120 s deadline; a document that crashed two attempts is marked failed instead of looping at startup |
| K-2 | A document replaced while indexing is re-indexed (also fixed: the old bytes were indexed under the new hash) |
| M-1 | Deleting a memory or an agent scrubs the text from proposals and superseded entries |
| M-2 | No memory extraction (and no unasked web fetches) from model-written prompts: delegated, crew, workflow and concierge tasks |
| L-1 | One version: package.json `0.11.0-beta`; exe/Cargo `0.11.0`; MCP clientInfo and bridge from `src/version.ts`; a test keeps them in step |
| L-2, L-3, L-4 | `LICENSE` (GNU AGPL v3 or later), `THIRD_PARTY_NOTICES.md` (generated offline by `tools/third-party-notices.mjs`: 10 npm packages, 281 crates, no incompatible licence), `SECURITY.md`, `docs/PRIVACY.md` (endpoints, data locations, backup, uninstall), `ASSETS.md`, README install/requirements/licence |
| L-5 | Minimum window 1024×640; the rail tightens below 820 px height and its list scrolls, so Settings, profile and Exit stay reachable (**verified at 1024×640**) |

### P2 — should fix (fixed unless listed under Deferred)

Fixed: D-8 (flush on close) · D-9 part (pinned/active chats and open tasks kept) · D-11 (= S-11, I-12) atomic Skill updates with rollback and startup sweep · D-12 (= S-9) `ollama serve` stopped on exit when RealmNest started it, minimal environment (**verified**) · R-8, R-9, R-12 (no retry after a denial; tool retries only for low-risk tools), R-14, R-16, R-17 · S-10 (= L-7) no developer path in the release · S-12 strict report shell · I-10 · I-13 part (messages closed on cancel/fail, "already decided", `/approve` shows instead of deciding, owner-only approvals) · I-17 · I-18 · I-20 (global "never" is a ceiling) · I-22 Rust parts (protocol header, JSON-escaped redaction, bridge connection cap) · K-3, K-4, K-5 · W-1 (one neutraliser for every prompt tag) · W-2 (cross-site links on a fetched page need approval) · C-4 · E-2 · E-3 (modal stack, focus) · M-3 · L-6 (first run follows the system language) · L-8 · L-12 (ASSETS.md) · interrupted chat/task messages translated.

## 3. Tests added

Vitest 722 → **814** (46 files), Rust 138 → **170**. New suites: `dataSafety` (17), `knowledgeHardening` (18), `contentHardening` (14), `version` (1); hardening blocks in `workflow`, `liveRuntime`, `chat`, `crew`, `research`, `mcpBridge`, `tools`, `telegram`, `claudeProvider`, `codexProvider`; Rust tests in `files`, `tools`, `process`, `compat` (Ollama), `mcp` (send blocking, consent text, redaction, origin binding, OAuth discovery against a mock server, refresh gate, callback), `bridge`, `secrets`, `skills` (failed update, sweep, device names), `web::proxy`, providers (error body that never ends, Stop during it). The hostile-PDF tests hang on the old extractor and pass on the new one; the new workflow tests fail on the old orchestrator.

## 4. Real acceptance on the release exe (this PC, Windows 11, 15 October)

| | test | result |
| --- | --- | --- |
| A | clean install | **not verified**: no clean machine; requirements documented (WebView2 Runtime required, everything else optional) |
| B | first launch / startup | PASS: Home in 1.2–1.4 s; exe Properties show 0.11.0, RealmNest OS, AGPL copyright |
| C | provider setup | PASS: Claude (account) chat; ChatGPT via Codex "connected" after `REALMNEST_CODEX_PATH` (see below); Ollama started by the startup check; OpenRouter not re-tested in this pass |
| D–G | agent, chat, tool execution | PASS: Claude Haiku with RealmNest tools through the bridge (`get_current_time`), under the new `--setting-sources user` and own folder |
| H, I | MCP local / remote | not re-run live (unit and Rust tests only) |
| J, K | Skills local / GitHub | not re-run live (unit and Rust tests) |
| L, M | Knowledge, Memory | unit tests only in this pass |
| N | Web fetch + hidden reader | PASS: crates.io (JavaScript page) read through the new guard proxy ("lettore nascosto"), cited; no reader process left afterwards |
| O–S | Crew, delegation, workflow, scheduler, orchestration | deterministic tests; not re-run live in this pass |
| T | Telegram | PASS: listening after the restart (owner's bot) |
| U | restart | PASS: data intact after several restarts |
| V | crash recovery | PASS: app killed mid-reply → after restart the partial text is kept, marked interrupted, with Retry; no RealmNest process left |
| — | corrupted data | PASS: unreadable `web` key → app opens, banner, copy kept, not overwritten; malformed `research-index` → app opens, Research marked "not started", rest works; both restored |
| — | single instance | PASS: second launch → same single process |
| — | shutdown | PASS: closing the window ends the app, its WebView2 processes and the `ollama serve` it started |
| W | offline mode | **not verified** live (network not cut on this PC); startup no longer waits on the network |
| X | provider failure | unit tests; ChatGPT shown "not available" with an install hint while Codex was not found |
| Y | backup / recovery | unit tests (round-trip, rejection, rollback); the native Save dialog path not clicked through |
| Z | uninstall | documented in PRIVACY.md; no installer yet |
| — | minimum window 1024×640 | PASS after the rail fix (Home, Simulation, Settings, Chat usable) |
| — | DPI 125/150/200 %, Windows 10, multiple monitors, non-ASCII user, OneDrive Documents | **not verified** (one PC at 100 %) |

## 5. Security summary

Trust model in [SECURITY.md](../SECURITY.md). After this pass: no path runs a program from a file the user opens; the CLIs cannot pick up project settings or hooks; secrets cannot be read by the page, can only be written under known names, and travel only to the address they belong to; the file tools cannot reach system, account or RealmNest's own folders; MCP launches show exactly what runs; OAuth and the hidden reader cannot reach the private network; every tool call (loop or bridge) is limited and goes through ToolRuntime; Skills cannot widen tools; Telegram approvals are owner-only and revision-bound. No telemetry, no updater, no crash reporter.

## 6. Data safety and recovery

Nothing is silently lost any more at the storage quota (banner, marker, skipped clean-up), unreadable data is kept aside and not overwritten, a failing service no longer blanks the app, removed files wait 30 days in a trash, caps never drop live records, a full backup exists, and delayed saves are flushed when the window closes. **This PC's local storage holds about 3 million characters** (largest: the MCP tools cache 0.96 M, runtime 0.77 M); WebView2 allows roughly 5 million, so the banner will warn before anything is lost — moving the largest stores to files is the next step (Deferred).

## 7. Performance baseline (release, this PC)

| | before | after |
| --- | --- | --- |
| window shown | 0.63 s | 0.42–0.61 s |
| Home on screen | 1.6 s | 1.2–1.4 s |
| app process | 7 MB | 7–8 MB |
| WebView2 (6 processes, private) | ~410 MB | 457–495 MB (varies run to run; JS heap 58 MB) |
| audio thread (sound on) | — | 15–20 % of the render budget |

## 8. Changes the owner should know

- **Codex location**: the built-in developer path to Codex is gone (binary-planting risk on other PCs). A Codex installed outside PATH is named with the user variable `REALMNEST_CODEX_PATH` (its exe or its npm folder); the maintainer's PC uses it.
- Claude Code conversations started in an agent's workspace may need a new session once (Claude keeps sessions per folder; RealmNest handles `session_not_found`).
- An agent with a Skill whose required tools it is not allowed now gets `SKILL_NOT_READY` until those tools are allowed.
- Workflow tool nodes retry only low-risk tools.
- OAuth MCP servers whose sign-in server is on a private network are refused; old tokens with an http token endpoint need a new sign-in.

## Known limitations

- Windows 10/11 only; needs the WebView2 Runtime; per-user installer, updates from GitHub releases (signed, installed only when you agree; [UPDATES.md](UPDATES.md)), not code-signed (SmartScreen warns on a manual install).
- An abrupt stop can lose the last few seconds of changes (WebView2 commits local storage with a delay; seen in the 0.11.0 release test).
- A new Claude connection needs a model chosen before the first chat (no Chat route by default).
- Skills with more than 14,000 characters of instructions install but cannot run.
- Very large tool results through Claude Code are stored by Claude Code where the model cannot read them.
- Most data lives in WebView2 local storage (about 5 million characters per app); the app warns when a save fails. Back up from Settings › General › Data.
- No OCR: scanned PDFs have no text. Very large PDFs may be read partially (with a warning).
- Web: public pages only, no logins or cookies, web search goes through an AI connection that can search (Claude, ChatGPT, the Anthropic API, OpenRouter).
- Claude, ChatGPT and Ollama need their own programs installed; ChatGPT through Codex has no images or streaming.
- Telegram works only while RealmNest is open; voice messages are not transcribed.
- Some provider hints and error details from programs are in English.
- The log file holds errors and starts only (redacted, about 3 MB at most); see [DIAGNOSTICS.md](DIAGNOSTICS.md).

## Deferred (P2/P3, not release blockers)

D-10 newer-data guard per store (backup import already refuses newer files) · D-13 a one-click "delete all my data" (manual steps documented) · moving the largest stores out of localStorage · I-8 MCP grants tied to a tool's description/schema hash · I-13 full tool input as a Telegram document · I-19 bridge reconnect · I-21 pinning GitHub Skills to a commit · L-10 opt-in local log and panic dialog · L-11 repository hygiene before publishing (large media at the root, `.gitignore`) · L-13 screenshots with personal paths in `docs/archive` and `docs/screens` · L-14 visible `.nestra` folder names · L-15 label the Debug surfaces "Developer" · L-16 English install hints · L-17 duplicate Rust HTTP stacks · S-15 narrower `core:default`, provider-bound connection ids · R-18…R-23 · C-5 · W-3 · the Home world tags overlap at the minimum window size.

## Release blockers remaining

None known. Items marked **not verified** above (clean machine, Windows 10, DPI scaling, offline, MCP/Skills/crew/workflow live re-runs) should be run once on a second PC before announcing the beta.

## Verdict

**READY FOR PUBLIC BETA** on Windows 10/11, as a beta: every P0 and P1 found is fixed and covered by tests, the release exe passes the native checks above, and the remaining items are documented limitations or deferred P2/P3. The verification gaps (clean machine, scaling, offline) are a checklist for the first public build, not known defects.

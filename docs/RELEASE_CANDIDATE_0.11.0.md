# RealmNest OS 0.11.0 Public Beta — release candidate

| | |
| --- | --- |
| date | 15 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.11.0`, branch `main`; **build commit `f858a98e19ba5f9c0d13051bc90d42d244787cd4`** (1,189 files); a second commit adds only this report and other docs not built into the app |
| installer | `RealmNest-OS_0.11.0_x64-setup.exe`, 86,742,488 bytes (82.7 MiB), NSIS, x64, per-user |
| SHA-256 | `1dcfc963c3db72001db082a8d96a08ea581cfc2a6aa8dbd8eec8b8f7ac8d14f3` |
| verdict | **READY TO PUBLISH AS PUBLIC BETA** (see [Verdict](#verdict)) |

Nothing was pushed or published.

## 1. Method

1. **Audit first** (no changes): repository map, build and run-time dependencies, Nestra references, personal paths, secrets, large and generated files (section 2).
2. **Source preparation** in the development folder (single source of truth): copyright holder, Public Beta label, installer configuration, `.gitignore`, `.gitattributes`, README for strangers, CONTRIBUTING, docs index, release notes, GitHub templates, genericised personal paths.
3. **Public tree generated, not copied**: `node tools/release-files.mjs release-staging/RealmNest-OS-0.11.0` copies an explicit allowlist (root files, `src/`, `public/`, `src-tauri/` without `target/` and `gen/`, `tools/`, `examples/`, `.github/`, `docs/*.md` + `docs/providers/`, and the 14 small `art/charpipe` data files the character tools and tests read). `.gitattributes` (`* -text`) keeps every byte as built; a fresh `git clone` of the tree is byte-identical to the working tree.
4. **Everything validated from that tree only** with a fresh dependency install from the lockfile (`npm ci --offline`, from the local npm cache) and a **new, empty Rust target folder**.
5. **Installed and tested as a new user**: the installer and the app were run outside the developer session's sandbox, on an empty data folder; the owner's data was backed up, set aside and restored byte for byte afterwards (section 6).

The first validation found a real problem: `src/tests/charpipe.test.ts` read files from `art/charpipe/` that the public tree lacked; the 14 small data files (rig, animations, character sheets, one reference sprite; 32 KB) were added to the allowlist.

## 2. Cleanup and contents

**Public repository (top level):**

| path | why |
| --- | --- |
| `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `ASSETS.md`, `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md` | what it is, licence, security reporting, how to contribute, asset provenance, third-party licences, history |
| `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | front-end build |
| `src/` | the app (TypeScript/React) and its tests |
| `src-tauri/` | the native side (Rust/Tauri 2), icons, capabilities, `Cargo.lock` |
| `public/` | baked world pictures and the Home map (run-time assets, 77 MB) |
| `tools/` | character pipeline (`charpipe/cast` is imported by the app), world bake helpers, `third-party-notices.mjs`, `release-files.mjs` |
| `art/charpipe/` (14 files) | data read by the character tools and their tests |
| `examples/skills/` | sample Skills |
| `docs/` | feature, architecture and release docs |
| `.github/` | issue and pull-request templates (no CI) |
| `charpipe.html` | dev page for the character pipeline |

**Kept out of the public repository (development only, nothing deleted):** `art/` (2 GB) except the 14 data files, `assets_3d/` (326 MB, unused CC0 kits), `promo/` and the five root `.mp4` files (233 MB), three root Farm renders (23 MB), `docs/` art working folders (≈675 MB), `docs/screens/` and `docs/archive/` (screenshots with personal data and old branding), `.claude/`, `.mcp.json`, and generated `dist/`, `node_modules/`, `*.tsbuildinfo`, `src-tauri/gen/`. `render_preview-1.png` (149 B, broken) is excluded. The maintainer-specific "what the machine is left with" table moved from STATUS.md to `docs/archive/DEV_MACHINE_STATE.md` (dev only).

**Renamed / moved:** nothing in the code. Docs only: STATUS section moved as above; new `docs/README.md`, `docs/RELEASE_NOTES_0.11.0.md`.

## 3. Legacy "Nestra" references retained (compatibility)

The `app.nestra.desktop` identifier (data folder, Credential Manager service, single-instance mutex), the `nestra:` storage prefix and its backup/corrupt-copy keys, `.nestra-skill` / `nestra-package` / `nestra-bundle`, the built-in Skill id `nestra.workspace-note` (shown as its id in the Skills list), Knowledge ids `kb-nestra-docs` / `kdoc-nestra-*`, the memory export format, `x-nestra-open`, capability level `nestra`, the theme migration, `%USERPROFILE%\.nestra\{workspace,codex}`, `NESTRA_CLAUDE_PATH`, the character rig id, `charpipe` dev ids; history in README, REBRAND.md and CHANGELOG. No user-facing branding says Nestra. ("finestra" matches are the Italian word.)

## 4. Scans

| scan | result |
| --- | --- |
| secrets (Anthropic, OpenAI, OpenRouter, GitHub, Telegram, Slack, AWS, JWT, private keys, Bearer, `.env`/credential files) | **none real**; 14 fake fixtures in tests (kept: they test redaction). No Git history existed, so nothing was ever committed. The exported backup file was also checked: no secret |
| personal paths in code | none required at run time; test fixtures use fake paths; one fixture genericised |
| personal paths in docs | `D:\DevTools\…` and `C:\Users\<owner>\odysseus` genericised in TAURI, STATUS, HARDENING, REBRAND, DEEP_RESEARCH(_PLAN) |
| release exe strings | no secrets, no project or user paths, no stale branding; the only machine path is the cargo registry (`<drive>\…\rust\cargo\registry`) in dependency panic messages (standard for Rust; could be remapped later); `localhost:5173` is Tauri's `devUrl`, unused in release |
| Windows Defender (MpCmdRun custom scan) | installer and exe: **no threats** |
| code signing | exe and installer **not signed** (SmartScreen will warn; see section 8) |

## 5. Licence

LICENSE is the GNU AGPL v3 text; the project is **AGPL-3.0-or-later**, copyright **Marius Alexandru Pisaru** (README, `tauri.conf.json` publisher/copyright, `package.json` author, `Cargo.toml` authors, ASSETS.md, release notes; the Windows Apps entry shows the publisher). SPDX `AGPL-3.0-or-later` in package.json, Cargo.toml and the bundle. THIRD_PARTY_NOTICES.md (generated offline): 10 bundled npm packages, 281 Rust crates; licences MIT, Apache-2.0, ISC, BSD, OFL-1.1 (bundled fonts: their licence text travels in the notices), MPL-2.0 (cssparser, selectors…), Unicode-3.0, CDLA-Permissive-2.0 (webpki-roots), Zlib. Nothing found incompatible with AGPL distribution; this is not a legal opinion. **Open items:** art is AI-assisted (mainly Claude and ChatGPT, per the owner; ASSETS.md says so) — whether such images carry copyright varies by country; the NSIS installer shows the AGPL text on a licence page.

## 6. Validation from the clean tree

| check | command | result |
| --- | --- | --- |
| install | `npm ci --offline` | 107 packages from the lockfile |
| typecheck | `npx tsc --noEmit -p .`, `npx tsc -b --noEmit` | clean |
| tests | `npx vitest run` | **814 passed, 46 files** |
| Rust format | `cargo fmt --check` | clean |
| Rust lint | `cargo clippy --offline --locked --all-targets -- -D warnings` | clean (`--locked`: Cargo.lock consistent) |
| Rust tests | `cargo test --offline --locked` | **170 passed** |
| build + installer | `npm run tauri build -- --bundles nsis` with a new `CARGO_TARGET_DIR` | frontend built, release exe built in 3 m 47 s (15 Oct 2026, 15:00–15:05 UTC), NSIS 3.11 downloaded by Tauri (hash validated), installer produced; the build changed no tracked file |
| exe | `realmnest-os.exe`, x64, 0.11.0 | SHA-256 in the build folder `c7ced986…b9ed`; installed copy `30f12dc4…74f9` (Tauri patches the bundled copy with its bundle type) |
| lint script | — | the project has no lint script |

## 7. Installed-release acceptance (Windows 11, this PC, 15 Oct)

Environment note: the developer session runs inside the Claude desktop app's MSIX container, whose writes to `%LOCALAPPDATA%` are virtualised. A first install attempt from inside it landed in the container's private store; it was removed and **every install, launch and uninstall below ran outside the container** (as a normal user's process), verified from outside. Clean profile: the owner's data folder (1,563 files, 148,219,605 bytes) was copied to `D:` first, set aside, and **restored byte for byte** at the end.

| | test | result |
| --- | --- | --- |
| installer | silent install `/S` | PASS: `%LOCALAPPDATA%\RealmNest OS\` (exe + uninstall.exe), Start-menu shortcut, Apps entry "RealmNest OS 0.11.0, Marius Alexandru Pisaru"; no admin, no Node/Git/Rust/Python |
| first launch | from the Start-menu shortcut, empty profile | PASS: no terminal window, no missing runtime; demo crew (intended), empty profile, Italian (system language), sound off, only the built-in "RealmNest Docs" Knowledge base, no chats/MCP/Skills; the Claude connection is seeded and connected because Claude Code is signed in on this PC |
| found | first chat with a new Claude connection | note: "choose a model first" (no Chat route by default) — clear message, model list right there |
| found | Telegram on the empty profile shows "token saved" | by design: Credential Manager entries of the same Windows user survive profiles and uninstalls (documented) |
| chat | Claude Haiku | PASS |
| tool + approval | `write_text_file` in a test folder | PASS: prompt with file, folder and input; "Consenti una volta"; file written |
| cancellation | long reply, Stop | PASS: partial text kept, marked "interrupted" |
| restart | close + reopen | PASS: chat and work folder kept |
| ChatGPT / Codex | without `REALMNEST_CODEX_PATH` | PASS: "Not available" with install instructions (English), no error |
| ChatGPT / Codex | with `REALMNEST_CODEX_PATH` = npm folder | PASS: connected (Codex 0.162.1), answered |
| Claude | tools via the bridge, own folder, `--setting-sources user` | PASS (tool calls above and MCP below); project-hook protection verified in the hardening pass |
| OpenRouter | saved key after reinstall + restart, free model | PASS ("router"); invalid-key and rate-limit cases **not run** (typing keys is the owner's) |
| Web | example.com, http→https redirect (github.com), JS page (crates.io via the hidden reader through the guard proxy), citations | PASS; `127.0.0.1` request refused (the model declined before calling the tool; the guard is unit-tested) |
| MCP local (PhotoCraft) | add, native consent (owner clicked Yes), 21 tools, 0 active by default, enable `command_list`, call with approval, disconnect, tools gone, restart keeps config | PASS. A wrong argument showed "The server exited (code 2)" (English, clear). Found: a very large result is stored by Claude Code in its own folder where the model can't read it (documented) |
| MCP remote | — | not run |
| GitHub Skill | `github.com/anthropics/skills`: 20 Skills listed, review (origin, package hash, instructions, tools chosen by the user), install `doc-coauthoring`, persists after restart | PASS. Found: its instructions (16k chars) exceed the 14k run limit, so it cannot run (message in English; documented). No "check for update" button: update = install again from the same address |
| Crew | 2 Live agents (Claude Haiku), plan → approve → task → review → final → approve; Artifact; navigate away; second run cancelled | PASS (plan came with review off: user ticks it) |
| Workflow | agent → approval → output; To do badge; completed + Artifact + history; second run cancelled | PASS (To-do detail pane first showed an older run) |
| Scheduler | one-time schedule at 17:29 | PASS: exactly one run at 17:29:00, schedule turned itself off; a disabled schedule never fired |
| Telegram | pairing code, owner as owner (numeric id), `/agent Maya` + message → answer on the phone; polling resumed after restart | PASS (owner) |
| backup / restore | export through the real Save dialog (83 KB, no secrets), change the profile name, import → restored after reload; a foreign file refused with "no data was changed" | PASS |
| safe mode + corrupt data | corrupt `routing` + safe-launch flag | PASS: banner, copy kept, MCP/Telegram/schedules off for that launch |
| crash | process killed 3 s into a reply | **found**: crew, workflow and schedules intact; the new chat started 3 s before the kill was not saved (WebView2 commits storage with a delay) — documented limitation; no corruption |
| network at idle | established connections | only WebView2's own network service to a Microsoft address; RealmNest listens on two loopback ports (MCP bridge, token-protected; hidden-reader guard proxy); the CDP port was the test's own |
| uninstall | silent uninstall | PASS: program, shortcut and Apps entry removed; data kept; Credential Manager entries kept; no process left |
| reinstall | same installer | PASS: one Apps entry, version 0.11.0, data found, About "RealmNest OS 0.11.0 Public Beta" |
| upgrade | owner's previous data + installed 0.11.0 | PASS: no banner; Claude, OpenRouter, ChatGPT, Ollama connected; Telegram listening with the original pairing; both MCP servers; profile intact |
| window sizes / scaling | 1024×640, 1366×728, 1920×1040, and 1080p at 125/150 %, 1440p at 200 % **emulated** (7 screens each, 42 combinations) | PASS: no horizontal scroll, rail bottom (Settings, profile, Exit) reachable, no unreachable control |
| interactive installer / uninstaller pages | — | not run (silent mode used) |
| **offline** | — | **NOT VERIFIED** (the owner could not cut the network during the session) |
| **Windows 10** | — | **NOT VERIFIED — WINDOWS 10** |
| **real display scaling** | — | **MANUAL REQUIRED** (only emulated) |

## 8. Code signing and SmartScreen

Neither the exe nor the installer is signed. Windows SmartScreen will show "Windows protected your PC" for a new unsigned download; users choose *More info › Run anyway*. The README and release notes say so and tell users to compare the SHA-256. Signing later needs a code-signing certificate (OV/EV, or Azure Trusted Signing) and `bundle.windows.certificateThumbprint`/`signCommand` in `tauri.conf.json`; nothing was bought or configured.

## 9. User data footprint

Program: `%LOCALAPPDATA%\RealmNest OS\`. Data: `%LOCALAPPDATA%\app.nestra.desktop\` (WebView2 local storage, files with a 30-day trash, Skills, MCP consent, Telegram pairing, bridge configs, hidden-reader profile). Secrets: Windows Credential Manager (`app.nestra.desktop`). CLI folders: `%USERPROFILE%\.nestra\`. Exports: `Documents\RealmNest Exports`, `Documents\RealmNest Skills`. Claude Code's own data: `%USERPROFILE%\.claude`. No logs, no temp files of RealmNest's own. Details and uninstall: [PRIVACY.md](PRIVACY.md).

## 10. GitHub release (prepared, not published)

| | |
| --- | --- |
| tag | `v0.11.0` |
| title | RealmNest OS 0.11.0 Public Beta |
| assets | `RealmNest-OS_0.11.0_x64-setup.exe`, `SHA256SUMS.txt` (folder `release-artifacts/RealmNest-OS-0.11.0-Public-Beta/`) |
| body | `docs/RELEASE_NOTES_0.11.0.md` (also copied as `RELEASE_NOTES.md` in the artifact folder) |
| repository settings to turn on when publishing | Security › Private vulnerability reporting (SECURITY.md points to it) |

## 11. Known limitations and manual tests still required

Known limitations: [RELEASE_NOTES_0.11.0.md](RELEASE_NOTES_0.11.0.md#known-limitations) and [HARDENING.md](HARDENING.md#known-limitations). New from this phase: last seconds lost on an abrupt stop; model choice needed on a new Claude connection; Skills over 14k characters cannot run; very large tool results through Claude Code; some English messages (program install hints, MCP exit text, Skill size limit, tool descriptions); small UI points (To-do detail pane, crew plan review default, "Result {{date}}.md" default name, schedule preview of a disabled one-time schedule, unlabelled form fields, the data banner covering the title).

Manual tests still required before or right after publishing: Windows 10; offline start and recovery; real display scaling (125–200 %) on a laptop; the interactive installer and uninstaller pages (including "delete app data"); a remote MCP server; OpenRouter with an invalid key.

## Release blockers

None.

## Verdict

**READY TO PUBLISH AS PUBLIC BETA** — the exact source builds and tests clean from a separate tree, the installer installs, launches, upgrades, uninstalls and reinstalls correctly as a normal user, the core features passed live on the installed release, no secrets or personal paths ship, and the licensing files are in place. The items not verified (Windows 10, offline, real scaling) are stated in the release notes as known limitations, not hidden.

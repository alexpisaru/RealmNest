# RealmNest OS 0.13.0 Public Beta — release candidate

| | |
| --- | --- |
| date | 29 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.13.0`, branch `main`, 1,239 files; a clone of the development repository, so its history continues from what is on GitHub (`72b0c96`, fast-forward). **Build commit `7b97302`**; later commits change only `tools/updater-manifest.mjs` (`ee87028`, not in the build), this report and STATUS |
| installer | `RealmNest-OS_0.13.0_x64-setup.exe`, 87,134,589 bytes (83.1 MiB), NSIS, x64, per-user |
| SHA-256 | `bef4e65f96209d9a08cc8a5ea54c5baab694c044b6de33a1f1847cc79c30a7fa` |
| updater | signed with the key in `D:\RealmNest-keys` (`.sig` next to the installer); `latest.json` points at `https://github.com/alexpisaru/RealmNest/releases/download/v0.13.0/RealmNest-OS_0.13.0_x64-setup.exe` |
| artifacts | `release-artifacts/RealmNest-OS-0.13.0-Public-Beta/`: the installer, its `.sig`, `latest.json`, `SHA256SUMS.txt` (installer and latest.json), `RELEASE_NOTES.md` |
| verdict | **READY FOR 0.13.0 PUBLIC BETA** |

Nothing was pushed, tagged or published.

## Changes since 0.12.0

| commit | change |
| --- | --- |
| `9aad3ee` | chat answers and agent results drawn from Markdown (never HTML); links open in the browser; Copy on code blocks |
| `84cacba` | Claude (account) uses Claude Code's own WebSearch in chats and agent tasks with Web on; allowlist (TS and Rust) accepts WebSearch only with `--tools WebSearch` |
| `21212f8` | `web_search` gets an engine for every provider: the web search of an AI connection (Auto with fallback, one connection, or None) |
| `d9c169a` | Windows notifications in the background (approvals, finished work); `research.status` bus event |
| `c5948ef` | a redacted log file (`logs\realmnest.log`, rotated) and Export diagnostics |
| `a8ef69b` | updates from signed GitHub releases (tauri-plugin-updater), the notice, Settings › Updates, `tools/updater-manifest.mjs`; the installer restarts RealmNest with `Exec` after an update |
| `7b97302` | version 0.13.0, News, CHANGELOG, README, SECURITY, release notes |

## Checks (from the release tree)

| check | result |
| --- | --- |
| release tree | `git clone` of the development repository: 1,239 files, byte-identical to the public set (`tools/release-files.mjs`) |
| no secrets | the private signing key is in none of the trees; only the public key is in `tauri.conf.json` |
| dependencies | `npm ci --offline` from the lockfile |
| TypeScript | clean |
| Vitest | 860 tests in 51 files, all passing |
| Rust (new, empty target folder) | `cargo fmt --check` and `clippy --all-targets -D warnings` clean; 177 tests passing |
| build | `npm run tauri build -- --bundles nsis` with `TAURI_SIGNING_PRIVATE_KEY`; the rendered installer script has the three RealmNest template changes (install over, `Exec` on the finish page and after an update) |
| no test data | the built page and exe hold none of the test addresses, test strings, showcase names or personal data; the update endpoint in the exe is GitHub's |

## Acceptance (the release installer, on the owner's PC)

The owner's data was backed up first: 1,772 files, 232,041,690 bytes, to `D:\RealmNest-backup-0130`.

| test | result |
| --- | --- |
| **clean install** | 0.12.0 uninstalled (silent, data kept) and the owner's data moved aside; `/S` install of 0.13.0: Apps and the exe say 0.13.0, Start menu shortcut. First start: 0 agents, 0 connections, 0 conversations, no banner, Italian UI; all 14 screens open without errors; the log has the start line; Settings › Updates shows the automatic check (the check itself fails quietly until a release with `latest.json` exists: today's latest release, 0.12.0, has none) |
| **updater** | a signed test build 0.12.99 (RealmNest OS identity, update address on a local server serving the real 0.13.0 installer and the real signature) installed over the clean profile. 17 s after start it showed "È disponibile RealmNest OS 0.13.0" with the notes; **Aggiorna ora** downloaded the installer, verified it, installed it in passive mode and started 0.13.0 again 13 s later. The installed exe differs from the build folder's exe only in Tauri's 3-byte bundle-type marker (`UNK` → `NSS`), as expected for an exe taken from the installer |
| **manual upgrade 0.12.0 → 0.13.0** | the owner's data put back and compared with the backup: 1,772 files, 0 differences (SHA-256 of every file). Official 0.12.0 installed and started: 4 agents, 83 conversations, 2 connections (ChatGPT connected; Claude unavailable because the Claude Code CLI is not on this PC's PATH, as before). Then the 0.13.0 installer `/S` over it: 8 s, Apps says 0.13.0, data files 1,772 before and after. Started: the same 4 agents, 83 conversations, 2 connections, 55 storage keys, no banner; an old chat is drawn with the Markdown view |

Not covered: the graphical installer pages (the installs ran silent), a click on a Windows notification, the Export diagnostics Save dialog. The test app's profile from the clean install is kept aside as `%LOCALAPPDATA%\app.nestra.desktop.cleantest-0130` (test data only; it can be deleted).

## Verdict

**READY FOR 0.13.0 PUBLIC BETA.**

Next steps for the owner:

1. Push `release-staging/RealmNest-OS-0.13.0` (`main`).
2. Create release `v0.13.0` on GitHub (not a pre-release), with `RELEASE_NOTES.md` as the description, and attach **`RealmNest-OS_0.13.0_x64-setup.exe`, `latest.json` and `SHA256SUMS.txt`** (the `.sig` may be attached too).
3. From then on, installed copies of 0.13.0 find later versions by themselves.

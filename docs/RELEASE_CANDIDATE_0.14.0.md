# RealmNest OS 0.14.0 Public Beta — release candidate

| | |
| --- | --- |
| date | 30 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.14.0`, branch `main`, 1,246 files; a clone of the development repository, so its history continues from what is on GitHub (`64c5190`, fast-forward). **Build commit `72d9103`**; the later commit adds only this report and STATUS |
| installer | `RealmNest-OS_0.14.0_x64-setup.exe`, 87,189,353 bytes (83.2 MiB), NSIS, x64, per-user |
| SHA-256 | `17407158d575f633ba8e1fb2338acca9f90351aa42c6021c9a6e48602b40a1bb` |
| updater | signed with the key in `D:\RealmNest-keys` (`.sig` next to the installer); `latest.json` points at `https://github.com/alexpisaru/RealmNest/releases/download/v0.14.0/RealmNest-OS_0.14.0_x64-setup.exe` |
| artifacts | `release-artifacts/RealmNest-OS-0.14.0-Public-Beta/`: the installer, its `.sig`, `latest.json`, `SHA256SUMS.txt` (installer and latest.json), `RELEASE_NOTES.md` |
| verdict | **READY FOR 0.14.0 PUBLIC BETA** |

Nothing was pushed, tagged or published.

## Changes since 0.13.0

| commit | change |
| --- | --- |
| `accd24b` | tasks for a busy agent wait in its queue (up to 20; Telegram says so; they survive a restart) |
| `d783302` | messages written while a reply goes wait in the chat's queue |
| `c6a6191` | model menus show prices, with API reference prices for ChatGPT and Claude (OpenRouter's public list) |
| `d531614` | the single-instance lock follows the app identifier |
| `e42ccd9` | a crew agent that lacks something asks the user (`BLOCKED`, needs you, answers as confirmed facts) |
| `484061f` | a crew can share a working folder |
| `e4a53b8` | a crew task can run for each entry of a list; crew and workflow outputs use the chat's Markdown |
| `b803a0c` | the log path in the 0.13.0 notes and the privacy page |
| `2ea7a17` | Skills from GitHub can be updated (provenance, checks, review of changes, atomic install); `allowed-tools` lists with commas |
| `72d9103` | version 0.14.0, News, CHANGELOG, README, SECURITY, release notes |

## Checks (from the release tree)

| check | result |
| --- | --- |
| release tree | `git clone` of the development repository: 1,246 files, the same list as the public set (`tools/release-files.mjs`) |
| no secrets | the private signing key is in none of the trees; only the public key is in `tauri.conf.json` |
| dependencies | `npm ci --offline` from the lockfile |
| TypeScript | clean |
| Vitest | 888 tests in 53 files, all passing |
| Rust (new, empty target folder) | `cargo fmt --check` and `clippy --all-targets -D warnings` clean; tests: 177 passing in four runs; the first run, made while another build and test run used the machine, had one failure that did not come back (not identified) |
| build | `npm run tauri build -- --bundles nsis` with `TAURI_SIGNING_PRIVATE_KEY`; the rendered installer script has the RealmNest template changes |
| no test data | the built page and exe hold none of the test addresses, test strings, showcase names or personal data; the update endpoint in the exe is GitHub's |

## Acceptance (the release installer, on the owner's PC)

The owner's data was backed up first: 1,792 files, 236,722,317 bytes, to `D:\RealmNest-backup-0140`, with a SHA-256 of every file (`D:\RealmNest-backup-0140.sha256`).

| test | result |
| --- | --- |
| **clean install** | 0.13.0 uninstalled (silent, data kept) and the owner's data moved aside; `/S` install of 0.14.0 in 9 s: Apps and the exe say 0.14.0, Start menu shortcut. First start: "0.14.0 Public Beta. 0 agenti salvati.", 0 conversations, 0 connections, no banner, Italian UI; all 13 screens of the menu open without errors |
| **updater** | a signed test build 0.13.99 made from the 0.13.0 tree (its updater code, update address on a local server serving the real 0.14.0 installer, the real signature and the real `latest.json` notes) installed over the clean profile. About 20 s after start it showed "È disponibile RealmNest OS 0.14.0"; **Aggiorna ora** downloaded the installer (16:33:07), verified it, installed it in passive mode and started 0.14.0 again at 16:33:20; the profile kept its files |
| **manual upgrade 0.13.0 → 0.14.0** | the owner's data put back and compared with the backup: 1,792 files, 0 differences (SHA-256 of every file). Official 0.13.0 installed and started: 4 agents, 83 conversations, 54 storage keys, 1 crew, no banner. Then the 0.14.0 installer `/S` over it: 8 s, Apps says 0.14.0, data files 1,792 before and after. Started: the same 4 agents, 83 conversations, 54 storage keys; Skills and Crews open with the owner's data |

Not covered: the graphical installer pages (the installs ran silent), the updater from the published 0.13.0 itself (it reads GitHub's latest release, so it can be seen only once 0.14.0 is published). The test profile from the clean install and the updater test is kept aside as `%LOCALAPPDATA%\app.nestra.desktop.cleantest-0140` (test data only; it can be deleted). The owner's PC is left on 0.14.0 with the owner's data.

## Verdict

**READY FOR 0.14.0 PUBLIC BETA.**

Next steps for the owner:

1. Push `release-staging/RealmNest-OS-0.14.0` (`main`).
2. Create release `v0.14.0` on GitHub (not a pre-release), with `RELEASE_NOTES.md` as the description, and attach **`RealmNest-OS_0.14.0_x64-setup.exe`, `latest.json` and `SHA256SUMS.txt`** (the `.sig` may be attached too).
3. Installed copies of 0.13.0 then offer 0.14.0 by themselves.

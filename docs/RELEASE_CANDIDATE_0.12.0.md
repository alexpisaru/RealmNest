# RealmNest OS 0.12.0 Public Beta — release candidate

| | |
| --- | --- |
| date | 26 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.12.0`, branch `main`, 1,200 files; its history continues from 0.11.2 (`6aaffd7`). **Build commit `9d4ff6a`**; a later commit adds only this report and STATUS |
| installer | `RealmNest-OS_0.12.0_x64-setup.exe`, 86,764,895 bytes (82.7 MiB), NSIS, x64, per-user |
| SHA-256 | `7f672b06664730d9b9ddd6197276710337dbc45ff0d56d390a62c9e4bc0bdda3` |
| artifacts | `release-artifacts/RealmNest-OS-0.12.0-Public-Beta/`: the installer, `SHA256SUMS.txt`, `RELEASE_NOTES.md` |
| verdict | **READY FOR 0.12.0 PUBLIC BETA** |

Nothing was pushed, tagged or published.

## Changes since 0.11.2

| commit | change |
| --- | --- |
| `e8a1f57` | Deep Research with ChatGPT uses OpenAI's live web search: one-off search turns, results from Codex's `web_search` items (`search.results`), each page read by RealmNest's Web layer |
| `95aa104` | Search turns keep Codex's code-mode host on: Codex runs its web search through it, and with it off the turn hung without searching |
| `d71521b`, `b53a8cc` | Deep Research runs ChatGPT searches one at a time; a search with no results after 60 s is tried once more |
| `3374380` | ChatGPT rate limits (429): Codex announces its silent retry wait only in its log, so the hosts set `RUST_LOG=codex_core::responses_retry=warn`. The provider stops a turn whose announced wait is over 30 s, as `rate_limited`. Research runs every ChatGPT model turn one at a time, page reads included |
| `cd7e32c` | A WM_CLOSE sent to tao's hidden event-target window (e.g. by `CloseMainWindow()`) used to destroy that window and leave the app unclosable; now it closes the main window normally (fixed in a separate session) |
| `3615056` | ChatGPT in chats and agent tasks with Web on: capability `nativeWebInTurns`, request `providerWeb`. The web rules tell the model it has its own search, and Codex gets `web_search="live"` next to the session and the RealmNest bridge. The allowlist accepts live search in any turn with the code-mode host on |
| `9d4ff6a` | version 0.12.0, News, CHANGELOG, release notes |

## Checks (from the release tree)

| check | result |
| --- | --- |
| release tree | fresh `git clone` of the development repository: 1,200 files, byte-identical to the public set (`tools/release-files.mjs`) |
| dependencies | `npm ci --offline` from the lockfile |
| TypeScript | clean |
| Vitest | 836 tests in 47 files, all passing |
| Rust (new, empty target folder) | `cargo fmt --check` and `clippy --all-targets -D warnings` clean; 171 tests passing |
| build | `npm run tauri build -- --bundles nsis`; the rendered installer script carries both RealmNest template changes |

## Acceptance

The features were verified in the app on the development build of the same code, with the owner's data and a ChatGPT (account) connection:

- **Deep Research:** ChatGPT searches returned 8, 3 and 7 results, and RealmNest read 6 real pages.
- **Rate limits:** when ChatGPT answered 429, each turn stopped within seconds with the rate-limit message, instead of hanging for 120 s.
- **Chat with Web on:**
  - The Codex command line had `web_search="live"`, the code-mode host on and the bridge.
  - A Rust question was answered correctly from blog.rust-lang.org.
  - A news question found pages with OpenAI's search and had RealmNest read 4 of them (JPL, NASA, ScienceDaily, DTU). The answer was dated and cited.

The release installer itself:

| test | result |
| --- | --- |
| upgrade over 0.11.2 | the owner's data was backed up first (1,752 files, 225,740,333 bytes). The silent install took 11 s and Apps shows 0.12.0. Data files after install: 1,752 |
| launch (Start menu) | <ul><li>`plugin:app|version` = 0.12.0;</li><li>4 agents, 83 conversations, 2 connections;</li><li>ChatGPT "Connessa".</li></ul>Claude shows "Non disponibile" because the Claude Code CLI is not on this PC's PATH; it already did before the upgrade, so this is not a release issue |
| close from outside | `CloseMainWindow()` ends the release in 1.1 s (the `cd7e32c` fix on the owner identity) |
| normal start | started again from the Start menu, debugging port closed |

## Verdict

**READY FOR 0.12.0 PUBLIC BETA.**

Next step for the owner:

1. Push `release-staging/RealmNest-OS-0.12.0` (`main`).
2. Create release `v0.12.0` on GitHub with the installer and `SHA256SUMS.txt`, using `RELEASE_NOTES.md` as the description.

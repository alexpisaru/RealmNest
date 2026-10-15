# RealmNest OS 0.11.1 Public Beta — release candidate (hotfix)

| | |
| --- | --- |
| date | 15 October 2026 |
| source | local Git repository `release-staging/RealmNest-OS-0.11.1` (a clone of the 0.11.0 repository, no remote), branch `main`, 1,192 files; **build commit `8b87650f183a291d566f8d005791115499edebf1`**. The hotfix is three commits on top of 0.11.0: `04c9e9f` *fix: start new installations with a clean workspace*, `8dd2768` *fix: start new installations without an AI connection*, `8b87650` *fix: say where to add an AI connection when there is none*; a later commit adds only this report and other docs not built into the app |
| installer | `RealmNest-OS_0.11.1_x64-setup.exe`, 86,751,963 bytes (82.7 MiB), NSIS, x64, per-user |
| SHA-256 | `b6a88d5e36279553b551b9b2d09a30c1603012a060a88f9d48bd8d0f38ab078b` |
| artifacts | `release-artifacts/RealmNest-OS-0.11.1-Public-Beta/`: the installer, `SHA256SUMS.txt`, `RELEASE_NOTES.md` |
| verdict | **READY FOR 0.11.1 PUBLIC BETA** |

Nothing was pushed, tagged or published.

## 1. The problem

A fresh installation of 0.11.0 opened with the 12-agent demo team (Alex, Maya, Zoe, Theo, Kenji, Lena, Priya, Hana, Bruno, Omar, Sam, Grace). On a PC where the Claude Code CLI was signed in, it also had a **Claude** connection that the user never added.

## 2. Root cause

Both came from runtime initialisation, not from packaging and not from copied development data. The installer contains only the program and its uninstaller and creates no data folder, which was checked on the installed tree.

- **Agents.** `AppStore.init()` (`src/store/appStore.ts`) created the bundled demo team (`demoCrew()` from `src/data/seed.ts`, compiled into the app) in three cases:
  - when there was no save, which is every new profile;
  - when the save had zero agents, so the demo team came back after the user deleted every agent;
  - in memory, when loading the save threw an error.
- **Connection.** `ConnectionManager.init()` (`src/runtime/connections/manager.ts`) was given `seedProviderId: 'claude-code'` by `src/main.tsx`. It created a Claude connection once (flag `seeded`) for any profile. That was meant as the migration from the provider ids used before connections existed, but it also ran on every new installation.

## 3. The fix

These changes only stop automatic creation. Nothing is matched by name or id and nothing is deleted: no existing agent, connection or other data is removed, reset or rewritten.

- **New profile.** `AppStore.init()` writes a clean save: no agents, default settings and the system language. Because the save now exists, the next start opens it as is.
- **Existing save.** It opens exactly as saved, also with zero agents. An empty workspace is a valid state.
- **Save that cannot be used.**
  - An unreadable or malformed save opens empty, without writing over it. `RealmNestRepository.load()` now treats readable JSON that is not a save object (an array or a scalar) like an unreadable one: it is kept, copied to `nestra:corrupt:save`, and never replaced at startup.
  - A load that throws opens with no agents instead of the demo team.
- **Demo team.** It is loaded only on the user's request: Settings › General › Data › **Load the demo team** (formerly "Reset demo data"). The confirmation says it holds 12 sample agents and replaces the current ones. `data/seed` is now imported dynamically, only by that action.
- **Connections.**
  - The seed connection is created only for a **legacy profile**, meaning a save exists but no connections record does: a profile from before connections existed.
  - A new installation gets none, and the decision is stored (`seeded: true`), so no later start creates one either.
  - Existing connections are loaded as they are.
- **No connection yet.** With no AI connection, Chat, a Live task and Deep Research show "Nessuna connessione AI ancora: aggiungine una in Impostazioni › Connessioni AI." / "No AI connection yet: add one in Settings › AI connections." Before, Chat and Live tasks showed an English error, and Deep Research showed an empty warning.
- **Version.** 0.11.1 / 0.11.1-beta in `package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock` and `src/version.ts`, plus an in-app News entry.
- **Docs.**
  - README: first run now opens on an empty workspace.
  - `docs/CONNECTIONS.md` (migration only), `docs/PRIVACY.md`, SECURITY and CHANGELOG updated.
  - New release notes in `docs/RELEASE_NOTES_0.11.1.md`.

### What a new installation contains

- **No user data:**
  - no agents, AI connections, crews, workflows, schedules or chats;
  - no memories, user Knowledge bases, artifacts, MCP servers or user Skills;
  - no Telegram pairing.
- **Ships with the app:**
  - the ten worlds;
  - the built-in **RealmNest Docs** Knowledge base;
  - the built-in **Workspace Note** Skill;
  - the crew and workflow **templates**, which are offered when you create one and not instantiated.
- **On first launch, the app writes only:**
  - an empty save (`nestra:save`);
  - an empty connections record (`nestra:connections`, `seeded: true`);
  - an empty schedules record.

## 4. Files changed

| file | change |
| --- | --- |
| `src/store/appStore.ts` | no demo seeding at startup; `resetDemo()` imports the demo team on demand |
| `src/persistence/repository.ts` | readable-but-not-a-save JSON is kept aside, never replaced |
| `src/main.tsx`, `src/runtime/connections/manager.ts` | the seed connection only for a legacy profile; the decision is stored |
| `src/ui/screens/Chat.tsx`, `src/ui/LiveTaskPanel.tsx`, `src/ui/research/NewResearch.tsx`, `src/i18n.ts` | localised "no AI connection yet" message |
| `src/data/seed.ts`, `src/locales/settings.ts`, `src/locales/world.ts`, `src/ui/news.ts`, `src/version.ts` | comments, copy ("Load the demo team"), News entry, version |
| `src/tests/firstRun.test.ts` (new); `store`, `dataSafety`, `uiFoundation` tests | regression tests (section 5) |
| `package.json`, `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf.json` | 0.11.1 |
| `README.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/PRIVACY.md`, `docs/CONNECTIONS.md`, `docs/RELEASE_NOTES_0.11.1.md` | docs |
| `tools/release-sync.mjs` (new) | brings an existing release tree in line with the public set |

## 5. Automated checks (from the release tree)

| check | result |
| --- | --- |
| TypeScript (`tsc -b --noEmit`) | clean |
| Vitest | **827 tests in 47 files, all passing** |
| Rust | 170 tests passing; `cargo fmt` and `clippy -D warnings` clean (no Rust code changed in 0.11.1) |
| release build | `npm run tauri build -- --bundles nsis` from the release tree, empty Rust target folder |

`src/tests/firstRun.test.ts` covers:

- **New profile.**
  - It has zero agents, is saved once, and stays empty after reload.
  - The first agent survives a restart; deleting the last agent leaves zero, also after a restart.
  - A malformed save is kept and copied aside.
  - Every user store starts empty: chats, crews, workflows, schedules, memories, user Knowledge bases and MCP servers.
  - It has zero connections, also on the next starts.
  - A connection the user adds persists, and removing it is not undone.
- **Existing profile.**
  - It keeps every agent, including demo-like ids and names.
  - A 0-agent profile stays empty.
  - A 0.11.0 profile's connections are kept as they are, and none is added to one that has none.
  - A legacy profile still migrates its Claude Code sign-in.
- **Source checks.**
  - No production module imports tests or fixtures.
  - `data/seed` is not statically imported outside tests and dev tools.
  - `main.tsx` wires the legacy-only connection seed.

## 6. Installed-release acceptance

The installer and the app were run outside the developer session's sandbox (see `docs/RELEASE_CANDIDATE_0.11.0.md` §1), from the Start-menu shortcut. Before the tests, the owner's data was copied to a backup and set aside; afterwards it was restored and compared.

| test | how | result |
| --- | --- | --- |
| clean install | data folder absent; silent install of the 0.11.1 installer; first launch | PASS: <ul><li>no data folder before launch;</li><li>after launch, three keys: an empty save, connections `[]` with `seeded: true`, empty schedules;</li><li>**0 agents, 0 connections**;</li><li>Italian (system language);</li><li>Home overview all zeros, no activity.</li></ul> |
| every screen, empty | Home, Worlds, Simulation, Chat, Agents, Crew, Workflow (+ Schedules, To do), Skills, Artifacts, Knowledge, Memory, Research, Settings (+ Integrations, AI connections) | PASS: <ul><li>every screen shows its empty state, with no errors in the console;</li><li>MCP: none;</li><li>AI connections: "Ancora nessuna connessione AI";</li><li>Knowledge: only the built-in RealmNest Docs;</li><li>Skills: only the built-in Workspace Note.</li></ul> |
| no connection | send a chat message; open Deep Research | PASS: the Italian message says where to add a connection (Chat and Research); Research's Start button is disabled |
| first agent | create "Collaudo Uno" (Tester, Farm), change its outfit, close and reopen the app | PASS: exactly that agent, with that outfit; no demo agent; 0 connections |
| delete last agent | delete it (confirmation), close and reopen | PASS: 0 agents, "0 agenti", Home overview zero |
| backup / restore | <ol><li>export a backup (native Save dialog);</li><li>change the data (Load the demo team: 12 agents);</li><li>import the backup;</li><li>restart.</li></ol> | PASS: <ul><li>the backup (1,292 bytes) has the agent and no secret;</li><li>after import and after restart: exactly "Collaudo Uno", 0 connections.</li></ul> |
| upgrade over 0.11.0 data | a copy of the representative 0.11.0 test profile (463 files): <ul><li>12 agents with Maya/Theo settings;</li><li>Claude and ChatGPT connections;</li><li>a crew with runs;</li><li>a workflow with runs and 2 schedules;</li><li>chats, artifacts, Skills, MCP servers, a deliberately corrupt `routing` record.</li></ul> | PASS: <ul><li>everything preserved: 12 agents (same names; definitions still on `claude-haiku-5-5`);</li><li>2 connections, both connected;</li><li>crew `crew-mv9orznb-1`, workflow `wf-mv9owzjs-1`, 2 schedules, runs, chats;</li><li>every screen loads with no errors.</li></ul> |
| owner's data | the owner's real profile put back; 0.11.1 launched on it, read only | PASS: <ul><li>restored byte for byte: 1,574 files, 152,216,862 bytes, **0 files differing** from the untouched backup (SHA-256 per file);</li><li>12 agents, 4 connections (Claude, OpenRouter, ChatGPT, Ollama) all connected, 82 conversations;</li><li>Telegram listening with the owner paired.</li></ul> |
| normal start | the app was started again from the Start menu without the debugging flag | PASS: running; debugging port closed |

### Notes

- **Telegram token.** On the clean profile, Settings › Integrations showed "Token salvato nel portachiavi del sistema". It is the owner's bot token in this Windows user's Credential Manager, from earlier installs. Credentials stay there after an uninstall (as `docs/PRIVACY.md` says), and the bot is not paired on a new profile. A real new user has no such entry. It is not in the installer.
- **Installed program bytes.** The installed `realmnest-os.exe` differs from the built one by 3 bytes: the bundle-type marker Tauri writes when it packages the program. The sizes are identical.
- **Lockfile version.** `package-lock.json` still names the package version `0.6.0-beta`. That was already so in 0.11.0. It is not used by the build, and the dependency entries are the ones the build installed.

## 7. Verdict

**READY FOR 0.11.1 PUBLIC BETA.**

- A new installation starts with a clean workspace: no agents, no AI connections, no user data.
- Existing users keep all their data: tested on a representative 0.11.0 profile and on the owner's real profile.
- No destructive migration was needed or written.

**Next step for the owner:**

1. Review `release-staging/RealmNest-OS-0.11.1` and `release-artifacts/RealmNest-OS-0.11.1-Public-Beta/`.
2. Push the repository.
3. Tag `v0.11.1`.
4. Publish the release with the installer, `SHA256SUMS.txt` and the release notes.

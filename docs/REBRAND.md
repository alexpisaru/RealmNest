# Rebrand: Nestra → RealmNest OS

The product was renamed on 14 October 2026.

| | name |
| --- | --- |
| Product | **RealmNest OS** |
| Brand | **RealmNest** |
| Technical slug | `realmnest` |
| Project slug | `realmnest-os` |

This was a naming change only. Behaviour, design and architecture are unchanged.

## What changed

- **User-facing text.** Every visible "Nestra" now reads "RealmNest":
  - all Italian and English UI strings;
  - sidebar brand, chat placeholder, Skills, MCP, Tools, Artifacts, Knowledge and Memory text;
  - error messages and the MCP consent dialog;
  - the built-in **RealmNest Docs** knowledge base;
  - the theme's display name.

  The full name **RealmNest OS** appears in the window title, Tauri `productName`, the page `<title>` and description, the boot screen, the README title, the identity prompt models read, the OpenRouter `X-Title` and the MCP `clientInfo` name.
- **Packages.**
  - npm: `realmnest-os`.
  - Rust crate: `realmnest-os` (library `realmnest_lib`). The desktop binary is now `realmnest-os.exe`, built at `<cargo target dir>\release\realmnest-os.exe`.
- **Internal identifiers renamed** (nothing stored depends on them):
  - `RealmNestRepository`, `realmnestReadiness`, `realmnestProcessBridge`, `REALMNEST_IDENTITY`, `REALMNEST_DOCS`, `DOCS_BASE_ID`;
  - `ProviderTurnRequest.realmnestBridge`;
  - the i18n key `chat.assistantHint`;
  - dev globals `window.realmnest` and `__realmnestRenderers`.
- **The MCP bridge for Claude Code.** These are generated for every run, so nothing old remains:
  - server `realmnest`;
  - tools `mcp__realmnest__…`;
  - config folder `realmnest-bridge`.

  The argument allowlists in TypeScript and in Rust were changed together.
- **The dev process bridge** (Vite only): `/__realmnest/process`, header `x-realmnest-bridge`.
- **New names that still read the old ones:**

  | new | old name, still accepted |
  | --- | --- |
  | Skill bundles `.realmnest-skill` (format `realmnest-skill`), exported to `Documents\RealmNest Skills` | `.nestra-skill` (format `nestra-skill`), which still installs |
  | the SKILL.md metadata key `realmnest-id` | `nestra-id`, never read, so old files are fine |
  | memory export format `realmnest-memory` | `nestra-memory`, which still imports |
  | environment variable `REALMNEST_CLAUDE_PATH` | `NESTRA_CLAUDE_PATH`, still honoured |
  | tool schema marker `x-realmnest-open` | `x-nestra-open`, still honoured |

  File exports without a dialog go to `Documents\RealmNest Exports`.
- **In-world signs.** A container logo in the Port world and the station name in the Space world now read `REALMNEST` / `REALMNEST-1`. Two letters, L and M, were added to the stencil font.
- **Example skill.** Its id is now `realmnest-examples.inspect-image`.
- **Docs, comments and tests.** Docs, CHANGELOG, comments, tests and test fixtures use the new name.

## Legacy "nestra" identifiers kept on purpose

Renaming any of these would lose user data or break saved references. They are internal and never shown as the product name.

| identifier | where | why it stays |
| --- | --- | --- |
| `app.nestra.desktop` | Tauri `identifier`, credential-store service | It names the app data folder (skills, files, MCP trust, the WebView2 profile that holds all saved data) and the Windows Credential Manager entries (API keys). Changing it would start from an empty app and lose every stored key. |
| `nestra:` | localStorage key prefix (`persistence/storage.ts`) | Every saved crew, chat, setting, connection, Knowledge base and memory lives under it. |
| `nestra.mcp.warningSeen` | localStorage flag | A saved user choice. |
| `~/.nestra/workspace` | default working folder for Claude Code / tools | It holds the user's existing workspace files. |
| `nestra.workspace-note` | built-in Skill id | It is stored on agents (`skillIds`), in run and artifact provenance, and typed as `@nestra.workspace-note`. |
| `nestra-package`, `nestra-bundle` | `SkillPackageFormat` values | They are stored on every installed Skill. |
| `via: 'nestra'`, level `'nestra'` | capability provenance values | They can be stored with connection capabilities. The UI shows "via RealmNest". |
| `nestra` | theme id | It is saved in settings. Its name shows as "RealmNest". |
| `kb-nestra-docs`, `kdoc-nestra-…` | built-in docs base and document ids | They are stored in chat and agent Knowledge selections and in past citations. |
| `.nestra-skill`, `nestra-skill`, `nestra-memory`, `NESTRA_CLAUDE_PATH`, `x-nestra-open` | readers only | Read for backward compatibility; never written. |
| `nestra-humanoid-3q`, `nestra-character-template`, `nestra-*` MCP client names, `nestra-cast` / `nestra-studio` localStorage | art pipeline (`tools/charpipe`, `art/charpipe`, character assets) | These are rig and template ids cross-referenced by about 2,650 generated art-pipeline files (`.ecproj`, sheets, logs). They are not user-facing. |
| `msg_01NESTRA` | a recorded Claude Code message id in test fixtures | Opaque recorded data. |

## Assets that still show the old name

These are images and recorded files that a text change cannot update:

| asset | what it needs |
| --- | --- |
| `public/baked/port/*`, `public/baked/space/*` | Re-baked on 15 October: the ship, the containers and the landing pad now say REALMNEST / REALMNEST-1 (layout and masks unchanged). |
| `docs/archive/acceptance-2026-10-12/*.png` | The screenshots of the 12 October acceptance runs, with the old UI and name. Kept as a record; the current screens are in `docs/screens/`. |
| `docs/characters/Nestra_catalogo-001.zip`, `docs/characters/cast/cast_nestra.html`, `docs/characters/studio/studio_nestra.html`, `docs/characters/studio/nestra_gen.js` | Art-pipeline documents whose file names contain the old name. They are kept because other files link to them. |
| `art/charpipe/**` | Generated art-pipeline outputs, regenerated by the pipeline. |

The app icon (`src-tauri/icons`, `public/favicon.svg`) and the in-app `Logo` component contain no text and are unchanged.

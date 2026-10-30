# Skills

A **Skill** is a reusable procedure an agent can follow:
- instructions;
- optional examples and resource files;
- the capabilities and tools it needs.

**A Skill is content, never code.** It cannot run anything by itself. At run time it can only use tools and capabilities RealmNest already governs (ToolRuntime: permissions, approval, history).

| term | meaning |
| --- | --- |
| Tool | an executable action ([TOOLS.md](TOOLS.md)) |
| Capability | something a model or RealmNest can do ([CAPABILITIES.md](CAPABILITIES.md)) |
| **Skill** | instructions + what they need (this document) |
| Plugin | a future package that may add code, UI, tools or Skills. A different, executable system. |
| MCP | a source of tools ([MCP.md](MCP.md)) |

## Code map

| file | what |
| --- | --- |
| `src/domain/skill.ts` | `SkillManifest`, `InstalledSkill`, `ToolRequirement`, states, `SkillRunRef`, id/semver rules |
| `src/runtime/skills/frontmatter.ts` | the SKILL.md frontmatter reader (a bounded YAML subset) and writer |
| `src/runtime/skills/package.ts` | review, adapters, safety checks, hash, bundle export |
| `src/runtime/skills/resolver.ts` | `SkillDependencyResolver` |
| `src/runtime/skills/service.ts` | `SkillService`: install, create, edit, export, uninstall, **activate** |
| `src/runtime/skills/store.ts` | the native package store (Tauri) and an in-memory one |
| `src/runtime/skills/builtin.ts` | Skills that ship with RealmNest (Workspace Note) |
| `src-tauri/src/skills/` | the on-disk store, export and HTTPS download, checked again in Rust |
| `src/ui/screens/Skills.tsx`, `src/ui/skills/` | Skills screen, detail, editor, installer, the agent's Skills section |
| `examples/skills/` | example packages ([README](../examples/skills/README.md)) |

## The domain

**`SkillManifest`** (the `skill.json`):

| field | |
| --- | --- |
| `schemaVersion` | `1` |
| `id` | **stable and portable**: `publisher.skill-name` (lowercase, digits, single hyphens, at least one dot), e.g. `nestra.workspace-note`. It is the identity, never a random install id. |
| `name`, `description` | shown everywhere; the description says what it does and when to use it |
| `version` | semver (`1.2.0`) |
| `author`, `homepage`, `repository`, `license` | optional |
| `requiresCapabilities` | e.g. `vision.input` |
| `requiresTools`, `optionalTools` | see Tool requirements |
| `conflicts` | Skill ids it must not run with (a declared conflict) |
| `permissions` | what using it may do, in plain words, shown before install |
| `tags`, `compatibility` | |
| `examples` | `{title?, input, procedure}` |

**`InstalledSkill`** is how RealmNest keeps one. It holds:
- the manifest and the SKILL.md body (instructions);
- `origin`: `built_in`, `user_created` or `imported`;
- `source`: kind (`built_in`, `created`, `local_file`, `local_directory`, `url`, `git`, `registry`), label, URL without credentials, `registryId` / `publisher` / `repository` / `homepage` for a future gallery, and the format;
- `enabled`, `installedAt`, `updatedAt`;
- `packageHash` (SHA-256);
- `modified` (edited in RealmNest after import);
- file list, import notes, and `availableVersion` (future).

**Agents** reference Skills by id (`AgentDefinition.skillIds`); the instructions stay in the Skill. **Runs** remember what they used (`AgentRun.skills`, `ConversationRun.skills`: id, version and name as they were).

## Package format

```
my-skill/
├── SKILL.md       instructions, with Agent Skills-compatible frontmatter
├── skill.json     the RealmNest manifest (id, version, requirements…)
├── resources/     read-only reference files (templates, guides, schemas)
└── examples/      worked examples
```

- **`SKILL.md`** is for people and models. The frontmatter RealmNest writes (`name`, `description`, `license`, `metadata: {realmnest-id, version, display-name}`) follows the [Agent Skills](https://agentskills.io/specification) convention, so other tools can read it. The body after the frontmatter is the instructions.
- **`skill.json`** is for machines. It holds no long text: the instructions live in SKILL.md only.
- **`.nestra-skill`** is one portable file: a JSON bundle `{format: "nestra-skill", formatVersion: 1, files: [{path, encoding: utf8|base64, content}]}`. RealmNest exports this way, and it needs no zip library.

**Allowed file types:**
- text: `md`, `markdown`, `txt`, `json`, `yaml`, `yml`, `csv`, `tsv`, and `LICENSE` / `README` / `NOTICE` without an extension;
- images: `png`, `jpg`, `webp`, `gif`.

**Limits:**
- 200 files;
- 1 MB per file;
- 5 MB per package;
- SKILL.md at most 128 KB;
- instructions at most 64k characters;
- paths at most 200 characters and 6 levels deep.

## Importing other formats

`reviewPackage()` detects the format and adapts it. **Nothing is invented.**

| input | how it is read |
| --- | --- |
| RealmNest package (folder with `skill.json`) | the manifest decides; SKILL.md gives the instructions |
| `.nestra-skill` bundle | unpacked, then as above |
| **Agent Skills folder** (SKILL.md + `references/` / `assets/` / `scripts/`) | adapter (below) |
| a single SKILL.md | adapter, without resources |

**The Agent Skills adapter:**
- **Id:** `name` and `description` are required. The proposed id is `<author>.<name>` (author from `metadata.author`), or `imported.<name>`, and the user can edit it.
- **Version:** read from `metadata.version`, or from the non-standard top-level `version` some Skills use. `1.0` becomes `1.0.0`; with no version it is set to `0.0.0`, and the review says so.
- **Display name:** taken from the first heading.
- **`allowed-tools`:** names another product's tools (`Read`, `Bash(git:*)`). They are **reported as not mapped**. The review screen offers a tool picker, so the user chooses which RealmNest tools the Skill needs. RealmNest never guesses.
- **Other frontmatter fields** (e.g. `argument-hint`) are listed as ignored.
- **Links outside the package** (`../../CONNECTORS.md`) are reported: those files are not included.

**Tested with real external Skills.** Folders from the owner's local Claude plugin cache: `data-context-extractor` (references and a Python script) and `ticket-triage`. Their quirks were all handled: a YAML list in `allowed-tools`, multi-line descriptions, a top-level `version`, and a 55 KB SKILL.md. A public online registry has **not** been tested.

## Safety (content only)

`reviewPackage()` checks everything, and Rust checks it all again before writing.

**Executables are never installed.** That covers `scripts/`, executable or script types (`exe`, `dll`, `ps1`, `bat`, `cmd`, `sh`, `py`, `js`, `html`, `svg`…), and files that *start* like executables (`MZ`, ELF, `#!`) whatever their name. They are listed as "left out" on the review screen. When the instructions mention scripts, the review warns that that part will not work.

**Blocking problems:**
- unsafe paths (`..`, absolute, drive letters, invalid names) and duplicate paths (case-insensitive);
- a package that is too large;
- an invalid manifest (schema version, id, semver, unknown capabilities, unreadable requirements);
- **secrets**: API keys or tokens in any text file (OpenRouter, Anthropic, `sk-…`, GitHub, AWS, Slack, Google, private keys), and credential-like manifest fields with values. The review shows the kind, never the value.

**Storage.** Packages live in `%LOCALAPPDATA%\app.nestra.desktop\skills\<id>\`, written only by Rust:
- atomically (staging folder, then rename);
- links and junctions are never followed (tested);
- a package is replaced as a whole, and uninstall deletes its folder.

**The page never names a filesystem path:**
- imports come from the system file picker (a file or a folder);
- exports go to `Documents\RealmNest Skills\<id>-<version>.nestra-skill` only.

**URL install:**
- `https://` only, and redirects must stay on https (at most 3);
- no user name or password in the URL;
- 20 s and 8 MB;
- downloaded into memory and reviewed like a file; nothing is kept until the user installs it;
- a single `SKILL.md` or `.nestra-skill`.

**Git** is not implemented: it would need a git binary or a zip reader. The source kind exists, and the installer says: clone or download the repository, then use From folder.

**Hash.** A SHA-256 over the sorted package files (path and bytes) is stored at install. It detects changes and supports safe updates. It is **not** a signature and claims no trust.

**Instructions can be malicious.** A Skill has no code, but its instructions steer an agent (prompt injection). So:
- imported Skills show a warning ("This Skill can influence how an AI agent behaves");
- the review screen shows the instructions, requirements, permissions and files **before** install;
- Skills never bypass ToolRuntime: a tool still asks or is refused according to the user's policy.

**Secrets at runtime.** Skills cannot read RealmNest's credential store. No Skill field or tool gives access to it.

## Tool requirements and portability

A requirement can be written in two ways:
- **an exact RealmNest tool id:** `write_text_file`, `mcp.photocraft.doc_open`;
- **portable:** `{ "mcpServer": "photocraft", "tool": "doc_open" }`. It matches any configured MCP server whose **key, name or self-reported name** is `photocraft`, so a Skill written on one machine works with another user's server whatever its local key. The Skill editor stores MCP tools in this form.

There is no semantic tool router yet. Capability-style aliases (e.g. "image.document.open") are a later step; the requirement type is ready for more forms.

## Dependencies (`SkillDependencyResolver`)

Every requirement gets its own state, never one boolean:

| state | meaning |
| --- | --- |
| `READY` | usable now |
| `MISSING_CAPABILITY` | the agent's or chat's model does not support it (or RealmNest cannot use it yet) |
| `MISSING_TOOL` | no such tool here (no MCP server by that name, or the server never offered it) |
| `TOOL_DISABLED` | set to "never", or discovered on the MCP server but turned off |
| `TOOL_UNAVAILABLE` | registered but cannot run now (e.g. its MCP server is disconnected) |
| `CONNECTION_UNAVAILABLE` | the AI connection is not connected |

**Readiness of the Skill:**
- `READY` when all requirements are ready;
- `PARTIALLY_READY` when the required ones are ready but some optional ones are not;
- `NOT_READY` when a required one is not.

The UI also shows `DISABLED` and `UNAVAILABLE` (not installed, e.g. after an uninstall).

**Capabilities** are checked against the connection and model of the agent or chat. On the Skills page, without one, they are marked "checked when it runs". RealmNest never installs a missing MCP server itself: the requirement says which server is missing.

## Activation (`SkillService.activate`)

LiveRuntime (an agent's `skillIds`) and ConversationRuntime (the Skills a chat message mentions with `@id`, plus an older chat's `skillId`) call `activate()` before the provider runs. **There is no parallel runtime**: the result is used like any other run input.

1. **Resolve each Skill.**
   - At most **3** active Skills (`SKILL_TOO_MANY`).
   - Each must be installed (`SKILL_NOT_FOUND`) and enabled (`SKILL_DISABLED`).
   - Its required dependencies must be ready (`SKILL_NOT_READY`, with every failing requirement listed).
   - A declared conflict between active Skills gives `SKILL_CONFLICT`.
2. **The tool subset.**
   - The tools offered are the Skills' **required** tools, `read_skill_resource` (when a Skill has files), the ready **optional** tools, and then the agent's own tools, at most 32.
   - Required tools are **never truncated**: more than 32 is `SKILL_TOOL_LIMIT_EXCEEDED`.
   - A model that cannot call tools while the Skill needs them gives `SKILL_MODEL_NO_TOOLS`.
   - The rest of an MCP server is **not** exposed.
3. **Context.** The system prompt is layered and separate from the user's message:
   - the agent (who it is, its standing instructions);
   - then `# Active Skills`, and for each one `## Skill: name (id version)` with the description, the instructions, up to 2k characters of examples, and its resource list.

   The adapter adds its own layer (e.g. Claude's bridge prompt). The total Skill context is at most 14k characters (`SKILL_CONTEXT_TOO_LARGE`), because Claude Code takes at most 20k of system prompt in all.
4. **Provenance.** `run.skills = [{id, version, name}]`, plus a `skill.activated` event (ids and versions only).

Every refusal happens **before** any provider call, as a structured error: for agents a `LiveRuntimeError.code`, and in chat a message with the details.

**Resources** are read-only. They are read with the `read_skill_resource` tool:
- `{skill, path}`, limited to files of an **enabled** installed Skill;
- text only, at most 64 KB;
- low risk, so allowed by default;
- marked `skillOnly`, so it is never offered by a chat's general Tools switch.

## Using Skills

- **Agents:** the inspector's Skills section, with ticks and readiness on the agent's own model. A Skill that was uninstalled stays listed as "non disponibile": the agent keeps the reference, and its tasks refuse to start until the user removes it.
- **Chat: `@` mentions** (`runtime/skills/mentions.ts`).
  - Typing `@` in the composer lists the enabled Skills (by short id or name; arrows, Enter or Tab, Esc). Picking one turns what was typed into a chip, `[ Workspace Note × ]`. The text keeps no `@` syntax, and the chip goes with the message as `skillIds`.
  - An `@publisher.skill-name` (or unique short id) typed out in full also counts. It is shown as a chip and **removed from what the model reads**: the Skill itself is active.
  - A mentioned Skill is active **for that message only**: with the Tools switch off it brings only `read_skill_resource`; with the switch on, its tools are offered if the chat or agent allows them. A Skill never gives a tool the agent wasn't given: if a required tool is missing the Skill doesn't start (`SKILL_NOT_READY`, listing the tools to allow). `@mentions` count only in what the user typed, not in prompts written by a model (delegation, crews, workflows, the Telegram concierge). An unknown `@name` or an e-mail address is just text.
  - Every chat turn also carries a short catalog in the system prompt (`# Skills in RealmNest`): every enabled Skill with id, name and description, the agent's own Skills listed apart, and how to activate one. So "which Skills do you have?" gets a true answer.
  - A resumed provider session (Claude Code) keeps its first turn's system prompt, so a Skill mentioned later travels inside the message itself.
  - Chats from before mentions keep their per-chat Skill; the composer shows it as a removable `@name` tag. The Tools switch is now an icon-only button.
- **Claude Code:** a Skill's tools reach Claude through the [RealmNest MCP bridge](MCP.md#the-claude-code-bridge) (`mcp__realmnest__…` only, built-ins off). RealmNest's approval still applies.

## Precedence (`runtime/skills/precedence.ts`)

Which Skills a run uses follows one deterministic rule, the same for chat turns and agent tasks:

1. **explicit**: the user named them for this message or task (a chip or `@`). Only those are used; nothing else is added.
2. **assigned**: the agent's own Skills (or an older chat's per-chat Skill).
3. **automatic**: RealmNest picks one only when the message names exactly one Skill by its full name. An automatic pick that cannot run is skipped quietly.
4. **none**.

An explicit or assigned Skill that cannot run refuses the run before any provider call, with the reason.

**Visibility.**
- Every run records the mode on its Skill refs: `activation: 'explicit' | 'assigned' | 'automatic'`, and for automatic, the `reason`.
- Chat shows the user's chips on the message and "In uso: Workspace Note · scelta da te" on the reply. The task panel shows the same.
- Artifacts keep the Skills, with their activation, in their provenance.

## Creating, exporting, updating, uninstalling

- **Create** (Skills › Create skill): name, id (default `user.<name>`), version, description, instructions, required capabilities, required and optional tools, tags. It is not a workflow editor.
- **Export:** writes `Documents\RealmNest Skills\<id>-<version>.nestra-skill`. It contains `skill.json`, a SKILL.md and the resources, and no absolute paths, connection ids or secrets: an export with a local path or a credential is **refused**, with the reason.
- **Install the same id again:**
  - the review shows `existing → incoming` versions;
  - the user must choose **Replace**; nothing is silently overwritten;
  - a modified import or a user-created Skill gets an explicit warning;
  - built-in Skills cannot be replaced.
- **Versions:** the installed version is in the manifest. Skills installed from GitHub can be updated (see **Updates** below).
- **Uninstall** deletes the package and the index entry. Agents, tasks and run history stay, and runs keep their Skill snapshot (shown in the agent's earlier tasks, e.g. "· Inspect Image 1.0.0").
- **Built-in** Skills ship with the build (Workspace Note): they can be disabled, not changed or uninstalled.

## From GitHub

Install Skill › **From GitHub**: the address of a public repository (or one of its folders, or a SKILL.md in it). RealmNest asks GitHub for the repository's file list (`api.github.com`, default branch when the address names none), shows every folder that has a SKILL.md, and for the one the user picks downloads only the files a Skill may contain (text and images; never `scripts/`, executables or other types) from `raw.githubusercontent.com`, through the same native download as *From URL* (https, public addresses, size limits). The files are then reviewed exactly like a picked folder. Tested on the release with `https://github.com/anthropics/skills` (20 Skills found, `pdf` reviewed).

The ref is resolved first (`resolveRef`: a branch, a tag or a commit, and the commit it points at now), and the tree and every file are read at that commit, so a branch that moves during the download cannot mix two versions. The review and the installed Skill keep where it came from (`SkillSource.github`): owner, repo, ref and its kind, the folder, the commit, and for a branch the folder's newest commit (`dirCommit`). The review says what that means: *follows the branch* or *pinned to a tag / commit*.

## Updates (GitHub Skills)

- **What is checked.** Only Skills installed from GitHub. A **branch** → the newest commit that changed the Skill's folder (`/commits?sha=<branch>&path=<folder>`, one request) against `dirCommit`: commits elsewhere in the repo are not updates. A **tag** is pinned: it never updates by itself; a newer *version* tag (`v1.2.0` > `v1.1.0`; other tags are ignored) is reported and can be installed the same way. A **commit** is pinned: nothing is asked.
- **When.** **Check for updates** on the Skills screen (all) and in a Skill's details (that one). Automatically at most once a day (`UPDATE_EVERY_MS`): a few minutes after start, then hourly ticks that check only when 24 hours have passed since the last full check; **Check once a day** turns it off; never in safe mode or the browser build. A check downloads nothing and changes nothing but the Skill's `update` state (`checkedAt`, `available`, `error`).
- **Shown.** A chip on the Skill's card (*Update available* / *New tag*), the count next to **Skills** in the sidebar, and a Windows notification when a check finds a new commit or tag (once per commit or tag; Settings › Windows notifications › *Skill updates*). GitHub's limit for requests without an account (60 an hour) and missing repos are said in words; the error stays on the Skill.
- **Before installing** (`prepareUpdate`): the new version is downloaded and reviewed like a new install, then compared with the installed one:
  - **what it may use**, first and highlighted: capabilities, required and optional tools, MCP tools, network and file access (from the tool names, `toolArea`), declared permissions, conflicts, and the other product's `allowed-tools` (kept as `declaredTools`), each *added* or *dropped*. A Skill still grants nothing: the agent's own tools decide;
  - the commits that changed the folder since the installed one (first line of each message, up to 10, *more* when there are others);
  - the files: SKILL.md by its instructions, the others by content, with lines added and removed;
  - **local changes**: the Skill was edited in RealmNest (`modified`) or its stored files no longer match `storeHash` (changed outside RealmNest). Then the update needs a second yes (*Replace my changes*).
- **Installing** (`applyUpdate`) only on the user's yes, never silently. It is atomic: the native store writes the new folder aside and swaps it in (the old one comes back if the swap fails), and if the index cannot be saved the old files are written back; on any failure the installed version stays and the downloaded update can be tried again. The Skill keeps its id, its on/off state and the agents it is assigned to; a package without a RealmNest manifest keeps the requirements the user mapped at install.
- **Installed before RealmNest kept the commit** (0.13.0 and older: a `git` source with its address, no commit): the first check resolves the address and, on a branch, compares the files on GitHub with the installed ones (`packageHash`); equal → it follows the folder from there; different → an update is offered.
- No automatic installs in V1.

## Sources and the future gallery

Every way of getting a Skill produces the same thing: package files plus a `SkillSource`, then one review.

| source | status |
| --- | --- |
| local file (SKILL.md, `.nestra-skill`) | done |
| local folder (RealmNest package, Agent Skills folder) | done |
| URL (https, one file) | done |
| GitHub repository (public) | done, with updates |
| registry / gallery | not built. It will be one more source, with the same review. The source metadata already has `registryId`, `publisher`, `repository` and `homepage`; a signature can be added next to the hash. |

No catalogue is hardcoded in the Skill domain.

## Acceptance (desktop release, 13 October 2026)

- **A–D.** Created "Daily Log" in the editor, then exported it (`alex.daily-log-1.0.0.nestra-skill`, 1 KB), uninstalled it (its folder was removed) and imported the export through the review screen. The id, version, instructions and requirements were the same.
- **E–F.** Workspace Note was assigned to Alex (OpenRouter, Nemotron free), with no tools of his own.
  - The `write_text_file` approval appeared per policy.
  - `skill-test.txt` was written and read back: `RealmNest skill runtime successful.`
  - The run shows "Skill: Workspace Note 1.0.0".
- **G.** Inspect Image (from `examples/skills`, installed from the folder) on Alex.
  - The model listed its tools as **only** `read_skill_resource`, `photocraft__doc_open` and `photocraft__doc_inspect`, although `session_list` and `render_preview` were turned on in PhotoCraft.
  - It read the template resource, `doc_open` asked for approval, and the report followed the template (64 × 48, RGB 8-bit, one Background layer).
- **H.** Alex on **Claude Code** with Workspace Note.
  - Claude listed only `mcp__realmnest__read_text_file` and `mcp__realmnest__write_text_file`; no built-in tools.
  - RealmNest's approval appeared.
  - The file was written and verified character by character.
  - This test found and fixed a bridge bug: structured summaries hid the text from Claude.
- **I.** With PhotoCraft disconnected, Inspect Image showed "Mancano dipendenze", with each tool "unavailable — its MCP server is not connected". The task was refused before starting, with the details.
- **J.** A disabled Skill showed "Disattivata" in the card and the inspector, and the task was refused ("The Skill Workspace Note is disabled.").
- **K.** Uninstalling an assigned Skill kept the agent, which shows the Skill as "non disponibile". The 19 earlier tasks stayed, and the run keeps "Inspect Image 1.0.0".
- **L.** After a restart:
  - the Skills, the disabled state, the assignments and the hash were all kept;
  - the run snapshots were still shown.
- **Chat.** With the Tools switch **off** and "Workspace Note" chosen, the model got only `write_text_file` and `read_text_file`; it wrote and verified `chat-skill.txt`. (Changed in the V1 hardening: with the switch off a Skill now brings only `read_skill_resource`.)
- **External import.** `data-context-extractor`, a real third-party Agent Skills folder, was reviewed and installed:
  - its 4 references were kept;
  - the Python script was left out and never written to disk;
  - the mapping notes were kept.

## Skills and Knowledge

A Skill is a procedure; Knowledge is facts. They meet in a run: a Skill's tools stay available in a STRICT Knowledge run (only `search_knowledge` and the active Skills' tools are offered), and the Knowledge rules come after the Skill context. `KnowledgeSourceType` already includes `skill-resource`, so a later version can index a Skill's reference files as a Knowledge document without new plumbing. See [KNOWLEDGE.md](KNOWLEDGE.md).

## Skills and Memory

A Skill sees the memories given to the run as runtime context, and only the run's own agent's memories. A Skill cannot write memory. A future Skill that asks to remember something must create a proposal the user reviews. See [MEMORY.md](MEMORY.md).

## Limitations and next steps

- Git and registry sources; zip archives (only folders, single files and `.nestra-skill`).
- Updates only for Skills from GitHub (public repos, no account); no signatures (the hash is ready).
- **Conflicts** are declared ones only: RealmNest does not detect contradictory instructions by itself.
- At most 3 active Skills, a 14k-character context budget and 32 tools per turn.
- **Claude Code sessions** keep the system prompt of their first turn: a Skill mentioned later is sent inside the message, and the catalog the model saw is the one from the session's start.
- **External formats:** only Agent Skills-style SKILL.md. Other conventions would be new adapters in `package.ts`.

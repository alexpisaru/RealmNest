# Changelog

## Unreleased

- **Every provider can search the web.** The `web_search` tool now has an engine: the web search of one of your AI connections that can search (Claude or ChatGPT by account, the Anthropic API, OpenRouter). With the Web on, agents and chats on OpenRouter, the OpenAI API, Ollama or any provider added later search through it, then read pages with `web_fetch` as before. Settings › Web › Search engine: **Automatic** (default: Claude first, then ChatGPT, the Anthropic API, OpenRouter; the next one tries when one fails), one connection, or **None**. Claude and ChatGPT keep their own search and no longer get `web_search` on top of it.
- **Claude searches the web in chats and agent tasks with Web on.** Like ChatGPT since 0.12.0: with the Web switch on (and Knowledge not STRICT) a Claude (account) connection gets Claude Code's own WebSearch next to RealmNest's tools, and the model is told so. Every other Claude Code tool stays off; the allowlist (TypeScript and Rust) accepts WebSearch only with `--tools WebSearch`.
- **Chat answers and agent results show their formatting.** Markdown is drawn instead of shown as text: headings, lists (nested, numbered, tasks), tables, quotes, code blocks with a Copy button, rules, bold, italics, strikethrough, inline code and links. Links (http and https only) open in your browser; [K]/[W] citations still become chips. Nothing is rendered as HTML (src/ui/chat/Markdown.tsx, mdParse.ts; tests in src/tests/markdown.test.ts).

## 0.12.0 Public Beta (2026-10-26)

ChatGPT on the web, and fixes. Release notes: [docs/RELEASE_NOTES_0.12.0.md](docs/RELEASE_NOTES_0.12.0.md).

- **Deep Research with ChatGPT searches the web.** A ChatGPT (account) connection now uses OpenAI's live web search for Deep Research, like Claude does: one-off search turns with every other Codex tool still off, the search's own results (never URLs the model writes), each page then read by RealmNest's Web layer. Normal ChatGPT turns keep the search off. About 40,000 input tokens of the plan per search, mostly cached. Research turns with ChatGPT run one at a time, since ChatGPT answers bursts with 429.
- **ChatGPT can search the web in chats and agent tasks with Web on.** With the Web switch on (and Knowledge not STRICT), a ChatGPT connection uses OpenAI's own web search during the turn, next to RealmNest's tools; the model is told so and names the pages it used. Those pages are read by OpenAI, not by RealmNest's Web layer, so they have no [W] labels or citation checks. With Web off nothing changes.
- **ChatGPT rate limits no longer look like a hang.** When ChatGPT answers 429, Codex waits silently for minutes before retrying; RealmNest now reads Codex's retry warning and stops the turn at once with "ChatGPT is limiting requests from this account for now… Try again later", in chats, agent tasks and research.
- **RealmNest can always be closed.** A tool that closes "the main window" of a program (PowerShell's `CloseMainWindow()`, `taskkill` without /F, scripts) could hit the hidden window RealmNest's event loop runs on and destroy it: from then on the window's buttons, Exit and every window command did nothing ("failed to send message to the webview") and the app had to be killed. A close sent to that window now closes RealmNest like the window's X, and the hidden window stays.

## 0.11.2 Public Beta (2026-10-16)

Installer and small fixes. Release notes: [docs/RELEASE_NOTES_0.11.2.md](docs/RELEASE_NOTES_0.11.2.md).

- **Upgrading installs over the old version.** The installer no longer defaults to "uninstall before installing" when it finds an older RealmNest: that hid the installer window, opened the old uninstaller (with its "delete app data" box) and looked like a crash. An upgrade now installs over the old version, like a silent install; your data stays. RealmNest uses Tauri's NSIS template with this one change (`src-tauri/installer/installer.nsi`).
- "Run RealmNest OS" on the installer's last page starts the app directly; before, it went through Explorer and could leave the installer hidden for a long time without starting the app.
- The installer shows the RealmNest logo (welcome and finish sidebar, page header, icon).
- The **Exit** button closes RealmNest; before, it left an empty white window and only the window's X closed the app.
- Claude and ChatGPT connection forms no longer say "the account already signed in on this computer": the folder field says "Default", and the help says Claude Code or the Codex CLI must be installed. Signing in without the CLI says what to install, in the interface language. The connection name example no longer names a person.

## 0.11.1 Public Beta (2026-10-15)

Hotfix. Release notes: [docs/RELEASE_NOTES_0.11.1.md](docs/RELEASE_NOTES_0.11.1.md).

- **A new installation starts with a clean workspace.** The app no longer creates the 12-agent demo team when a profile is new, when a profile has no agents (it came back after deleting every agent) or when the saved profile could not be read. An existing profile opens exactly as saved. The demo team is loaded only on request: Settings › General › Data › Load the demo team (was "Reset demo data").
- **No AI connection is created for you.** A new installation no longer adds a Claude connection on its own when the Claude Code CLI is signed in on the PC: you add every connection in Settings › AI connections. Existing connections are kept as they are; only a profile from before connections existed still migrates its Claude Code sign-in.
- With no AI connection, Chat, a Live task and Deep Research say in the interface language to add one in Settings › AI connections (before: an English error, or an empty warning in Deep Research).
- A saved profile that is readable JSON but not a profile is kept aside (`nestra:corrupt:save`) like an unreadable one, never replaced at startup.
- Tests: `src/tests/firstRun.test.ts` (new profile empty and stays empty, first agent persists, deleting the last agent leaves zero, no connection created on a new profile or on its next starts, every user store starts empty, existing profiles kept as they are, no production import of demo or test data).

## 0.11.0 Public Beta (2026-10-15)

The first public beta: everything built since 0.6.0-beta, listed below by milestone (newest first), plus the V1 hardening. Release notes for users: [docs/RELEASE_NOTES_0.11.0.md](docs/RELEASE_NOTES_0.11.0.md).

## 0.11.0 · V1 hardening (0.11.0-beta)

A pre-release audit of the whole app and the fixes it called for: see [docs/HARDENING.md](docs/HARDENING.md).

- **Data safety.** Failed saves are shown (banner, Settings › Data with the space used) instead of being lost silently; unreadable data is kept aside and never overwritten; one broken record or service no longer leaves a blank window (error boundaries, recovery page, **Start safely**); the file clean-up runs only after clean loads and moves files to a trash kept 30 days; caps never drop live artifacts, pinned or active chats, open tasks or open runs; **full backup and restore** in Settings › General › Data; one RealmNest at a time; pending saves written when the window closes; Reset demo data really resets the demo agents.
- **Security.** Only documents and media open with their app (checked on the name and the bytes, marked as downloaded); Claude Code ignores project settings and hooks and runs in RealmNest's own folder; file tools refuse system, account and RealmNest folders; secrets only under known names and only to their own address; the MCP consent shows everything that runs; OAuth and the hidden web reader cannot reach the private network; MCP and secret calls no longer block the window; atomic Skill updates; no developer path in the release; `ollama serve` started by RealmNest stops with it.
- **Runtime.** Workflow retries, cancellations and restarts can no longer run a tool twice or leave approvals alive or nodes stuck; schedules never fire twice for the same time and skip while the previous run is open; Deep Research cancels cleanly; bridged CLI turns have tool-call limits and 30 minutes; deleted agents stop working; Skills cannot grant tools; Telegram approvals are owner-only and bound to the plan they show; model-written prompts don't feed memory.
- **Content.** Hostile PDF/DOCX files are read within budgets (no hang, no crash loop); deleting memories removes their text everywhere; one prompt-injection neutraliser for every tag; links on a fetched page to other sites need approval.
- **Release.** One version everywhere (0.11.0-beta; exe 0.11.0); LICENSE (GNU AGPL v3 or later), THIRD_PARTY_NOTICES.md, SECURITY.md, docs/PRIVACY.md, ASSETS.md; minimum window 1024×640 with a rail that fits; first run in the system's language.

## 0.11.0 · sound, and the owner's batch of 15 October (0.11.0-beta)

- **Sound**, all synthesised by RealmNest while it plays (no audio files, nothing downloaded): generative music in each world's key and mood, the sound of each world by day and by night (wind, sea, streams, birds, crickets, gulls, machines, fans, lab bubbles…) and soft effects for live tasks, approvals, chat replies, completed workflows, dusk and dawn, and buttons. Off by default: the **Audio** switch at the bottom right of the world map turns it on (also in Settings › General › Audio, with the volumes); it sleeps while the window is minimised. See [docs/AUDIO.md](docs/AUDIO.md).
- **What's new** on Home lists every version up to 0.11.0-beta (it had stopped at the Farm's first playable part); the app's version in Settings › About comes from it.
- **Settings.** General: cards keep their own height (no more tall empty Profile and Chat cards); the profile's "used in the chat greeting" note is gone. Integrations: no search-engine card while there is no engine.
- **Telegram** uses a few emoji, at most one at the start of a message.
- **Agent panel.** The model field looks like the connection's drop-down (same marker and background) and fits its column; the usage line shows the agent's tokens, with the plan's session under it.

## 0.11.0 · more providers, and Telegram

- **ChatGPT** (your ChatGPT subscription) through OpenAI's Codex CLI, like Claude through Claude Code: sign in with your account, the GPT models of your plan, conversations that remember (native sessions), and RealmNest tools through the RealmNest MCP bridge (with the same permissions and approvals). Codex's own tools are forced off; images and streaming are not in this version.
- **OpenAI API** with your API key (credential store): GPT models with RealmNest tools, images, PDFs, structured output and embeddings; tokens reported (OpenAI does not report cost).
- **Ollama**: the open models on this PC (Gemma, Qwen…), free, nothing leaves the computer; RealmNest starts Ollama when it is not running. Embeddings too.
- The OpenAI API and Ollama share the OpenRouter host through a fixed "flavor" (no URL from the page).
- **Effort** ("Impegno") beside the model, only for models that support it and with the levels they list: a pill in the chat composer (kept per chat) and a select in the agent panel (kept per agent, used by every task). Claude: low to max (`--effort`); ChatGPT: the model's own levels without "ultra", with its default shown (`model_reasoning_effort`); OpenRouter: reasoning models (`reasoning.effort`). "Predefinito" sends nothing. Both allowlists (TS and Rust) check the level against an exact list. See docs/PROVIDERS.md › Effort.
- **Telegram** (Settings › Integrations): a bot you pair with a code; talk to agents, crews and workflows, approve with buttons, get and send files, configurable notifications and quiet hours. Answers are formatted (agent name and role, bold, lists, code, quotes) and `/agents` shows the agents' pixel-art portraits. Long polling: no server, no open port. See [docs/TELEGRAM.md](docs/TELEGRAM.md).
- AI connections: an account provider already connected (Claude, ChatGPT, Ollama) leaves the list of the ones to add; API-key providers stay, for more keys.
- Connection cards: account labels in your language; no dollar budget for subscriptions or free local models. Logs also mask OpenAI keys and Telegram bot tokens.

## 0.11.0 · the owner's review of 15 October

- **Model per agent.** The agent panel's Model list was cut off by its row and never showed: it now opens over the page (every model picker does). Without a search it lists 5 models, the chosen and recently used ones first, then "Show N more"; the search stays on top. Escape closes the list only.
- **Usage in the agent panel.** A line beside the ring: the plan's session (once a reply told it) and the agent's tokens in 30 days, or "nothing used yet". In Mock the task row says it is a pretend task with no model and no tokens.
- **Crew.** "New" always starts an empty form (after a template it kept the old one).
- **Agents.** Wider cards; drop-downs never wrap their text (every themed drop-down cuts with an ellipsis); roles shown in the user's language.
- **Workflows.** The graph shrinks to fit (down to 60%) before it scrolls. The time limit counts work only: waiting for the user's approval or being suspended no longer makes a run fail (a run waiting 11 hours for its approval had failed). Retry / Skip on a failed run restart the clock. Run errors are translated.
- **World.** The "Frozen" notice is a readable pill; Escape in a menu no longer closes the agent panel.
- **Re-baked** Port and Space: their signs say REALMNEST (layout and masks unchanged). The bake receiver is now in the repo: `tools/bake-receiver.mjs`.
- **Docs.** Current screenshots in `docs/screens/`; the 12 October ones moved to `docs/archive/acceptance-2026-10-12/`.
- **Internals.** The Agents screen is `agents` (`AgentsScreen`, `nav.agents`), no longer `crew`. Screens other than Home load when first opened.
- **Memory.** With embeddings on, a proposal that says an existing memory again in other words is a duplicate (similarity 0.92).
- **Deep Research.** The model check judges meaning: a summary, a translation or a rounded number is supported; "partial" only when a specific claim is missing.

## 0.11.0 · the whole UI in Italian and English

- Every screen, panel, Debug panel, hint and toast now has Italian and English texts. Larger areas keep them in `src/locales/{world,agent,settings,panels}.ts`, merged into `src/i18n.ts`.
- World data (world names and descriptions, stations, mock tasks, outfits, body presets, demo roles, activities) is shown through `useTD()` / `dataText` (`src/locales/data.ts`, English → Italian), including the activities the simulation composes ("Al lavoro su “…” · Scrivania 3").
- Rail: Crew and Workflow right under Agents. Home: recent activity takes the column's height (scrolling), the overview sits at the bottom.

## 0.11.0 · Workflows, Scheduler, Orchestrator

- **Three parts kept apart.** A **workflow** says what happens and in what order (a versioned, declarative graph). A **schedule** says when: it only creates a run. The **orchestrator** says how: who executes each node, failures, retries, timeouts, branches, approvals, budget and concurrency. A run keeps a copy of the definition it started from.
- **Nodes**: agent task, tool call, Crew run, wait (for a while or until a time), approval, condition (contains, equals, not empty, or an agent decides), parallel, merge (all or the first), output (an Artifact, `origin: 'workflow'`). Text fields are templates: `{{input.x}}`, `{{node.id.output}}`, `{{date}}`.
- **Policies**: per node, retries with a growing wait, a time limit, and what to do on failure (fail, continue, skip); per run, a token and dollar budget, a longest duration and a limit on nodes at once.
- **Durable**: every change is saved. After a restart, waits, retries and approvals carry on; a node that was working is *interrupted* and its run *suspended* until Resume. An "Ask" tool or an approval node makes the run wait for you.
- **Schedules**: once, every N minutes, every day, every week, cron. Times missed while RealmNest was closed are caught up once and reported (or only reported, or caught up each time, up to 10). "Run now" also only creates a run.
- **To do**: a badge in the rail and a To do tab list approvals waiting, suspended runs, finished runs not seen yet and missed schedules.
- **UI**: a Workflow screen with four tabs. *Workflow*: templates in your language, a form editor in tabs, a read-only graph, Run with inputs. *Esecuzioni*: the live graph, approve or reject, retry, skip, resume, stop, budget, history. *Pianificazioni* and *Da fare*. Agent panels link to the workflow run of their task.
- Fixed: the empty face placeholder in Crew and workflow histories took the global `.empty` padding (tall rows).
- See [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

## 0.11.0 · Crew

- **Crews** are a first-level object: agents of one world on one goal, with roles and duties, a Coordinator, a Reviewer and a shared brief and files. They have a screen of their own in the rail, with templates (Product launch, Article, Analysis).
- **A run**:
  - the Coordinator plans a task graph (assignees, dependencies, deliverables, review), which the user edits and approves;
  - a kickoff at the meeting table;
  - tasks run as ordinary agent tasks, in dependency order and in parallel when they can. Each task receives the goal, the brief and the outputs it depends on; a busy agent means the task waits;
  - the Reviewer approves or asks for changes, with at most 2 revisions;
  - a failed task blocks its dependents, and the user can retry or skip it;
  - the Coordinator assembles the final deliverable, the user approves it or asks for changes, and the crew meets again.
- **States and history**:
  - task states: waiting / blocked / running / in review / done / failed / cancelled / skipped;
  - every output and the final result are Artifacts (`origin: 'crew'`);
  - a translated history of who did what;
  - runs survive a restart (Interrupted, then Resume) and can be stopped.
- **World**: kickoff and final meetings, and hand-off walks from author to colleague and between author and reviewer.
- **UI**: the graph (columns by dependency, arrows), a task drawer (attempts, verdicts, notes, output, retry and skip), the plan editor, the final approval, Artifacts and history. Agent panels link to their crew run.
- Agent runs that end are handled once the runtime has set the agent free: a crew can give a just-finished agent its next task.
- See [docs/CREW.md](docs/CREW.md).

## 0.11.0 · Delegation

- **`delegate_task`**: an agent inside a task, or a chat, hands part of the work to a colleague. The colleague works as themself: their instructions, Skills, Knowledge, Memory, Web and connection. Their answer comes back as the tool result. Like every tool, it asks for approval by default.
- **Rules**:
  - agents delegate within their own world; a chat delegates to any agent;
  - never to oneself, never back into the chain, at most 2 levels deep;
  - a busy colleague: the hand-over waits in line (15 minutes at most);
  - stopping the delegating run stops the colleague's run;
  - files are passed on by name, only the caller's own.
- The team (world-mates, or every agent for a chat) goes into the system prompt when `delegate_task` is offered.
- **Links**: `AgentTask.delegatedBy` and `AgentRun.parentRunId`. Panels show "From Alex" and "Delegated: Maya · done" with clickable names; the tool row shows "→ Maya · task".
- **World**: the delegating agent walks to the colleague, talks, waits ("Waiting for Maya") and goes back to the desk when the answer arrives.
- See [docs/DELEGATION.md](docs/DELEGATION.md).

## 0.11.0 · Usage

- **The usage ring** sits next to the model in the chat and in an agent's AI panel.
  - On a Claude account it shows the plan's **5-hour session** and **week** (fill, percentage, reset time), read from the `rate_limit_event` of every reply.
  - On OpenRouter it shows the key's **credits** left of its cap, and today / week / month spent (`GET /key`, from Rust).
  - On other connections it shows this month against an optional budget.
  - The popup adds this chat, the agent, today and 30 days in tokens and cost.
- **Settings › AI Connections**: each card shows today, 7 and 30 days, the agents that used the connection, and a monthly budget for connections without a plan.
- A local ledger (`usage-ledger`) records every provider turn once, by connection, day, agent and chat. It is attributed through the turn's run id (chats, agent tasks, Deep Research and its searches). It makes no extra calls and never estimates prices.
- See [docs/USAGE.md](docs/USAGE.md).

## 0.11.0 · Deep Research

A question becomes a report in which every fact cites a numbered source the run actually read, with the exact quote that proves it. The design comes from Odysseus's Deep Research; the ideas were reimplemented and no code was copied. See [docs/DEEP_RESEARCH.md](docs/DEEP_RESEARCH.md).

- **Search through the chosen connection**:
  - Claude's `WebSearch` (one allowlisted tool, for search turns only);
  - Anthropic's `web_search` server tool;
  - OpenRouter's `web` plugin.

  Results come from the search event, never from model text.
- **The engine**:
  - optional clarifying questions;
  - a plan the user edits and approves (sub-questions, report kind, search phrases in two languages);
  - rounds of natural queries spread over the budget;
  - a reader model choosing what to read, primary sources first;
  - Knowledge passages as K sources;
  - coverage counted on independent origins;
  - Quick / Standard / Deep budgets for rounds, searches, pages, minutes and tokens.
- **Evidence ledger**:
  - every quote must really be in the page;
  - numbers a claim takes from elsewhere on the page get a verbatim context cut by RealmNest;
  - the writer takes numbers only from quotes and contexts.
- **Checks**:
  - markers that point nowhere;
  - a lexical check (decimal comma, scores, the source's title and date);
  - a model check of every cited sentence against its most relevant quotes.

  Flagged sentences are marked in the report.
- **Persistence**: runs are saved as they go. After a restart a run is Interrupted and can be resumed. Cancel keeps the findings, and Write now writes from them.
- **Research screen**:
  - a library;
  - a live run with meters, coverage, evidence and log;
  - a report rendered from JSON, never model HTML, with a contents column on the left that follows the reading;
  - citation chips with quotes;
  - tables, timeline, charts drawn from cited numbers, disagreements, open questions, sources.
- **Pictures**: the preview pictures (og:image) of the relevant pages.
  - The cover comes from the most cited source, and each section gets its own most cited source's picture.
  - RealmNest fetches them under the web rules (raster only, 4 MB, checked bytes), re-encodes them as WebP and keeps them, so opening a report contacts nobody.
  - Another / Hide / Show hidden.
- **Exports**:
  - Open in browser (`DocumentsRealmNest ExportsReports`);
  - Export PDF (WebView2 `PrintToPdf`, A4);
  - Export HTML (Artifact + copy);
  - Save to Knowledge, Discuss in chat, Dig deeper, Copy Markdown.

  The page has a contents column that follows the scroll through one script allowed by its hash. The native side locks every page it opens: no connections, no other script.
- **Agents**: the `deep_research` tool (asks for approval; runs on the task's connection and model). In the world the agent shows the research step, with a magnifier bubble.
- **Debug › Research** shows runs, budgets, evidence, checks and usage.
- **Fixes along the way**:
  - bubbles above the Cast figures' heads (they covered the face);
  - Debug › Files collect now keeps Knowledge documents and report pictures;
  - an OpenRouter connection without a model cannot start a research.

## 0.11.0 · the Cast in the app

- Every person in the worlds and every portrait in the UI is now drawn from the approved Cast pack (`src/assets/characters/cast`): layered atlases recoloured per material, band order per animation, height offset, SW mirrored from SE. Idle, walk, work and sit animations; seated agents use the real sit pose. The previous figures remain only as the fallback while the atlases load. See docs/charpipe/CAST.md.

## 0.11.0 · owner's review (14 October 2026)

- **Claude account**: the provider is now *Claude* (not "Claude Code"): Sign in / Sign out from the connection card (the browser opens, the code is pasted back into RealmNest), and a model list to choose from: Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5.
- **Anthropic API**: a new provider with an API key (credential store, calls from Rust): streaming, tools, images and PDFs, the key's model list.
- **MCP servers online**: Streamable HTTP servers by URL, with API-key headers (kept in the credential store) or OAuth sign-in (discovery, dynamic registration, PKCE, refresh). The local-programs warning is gone; local servers keep the Windows confirmation.
- **Skills from GitHub**: paste a repository (or folder) address, pick one of the Skills found, review, install. Only text and images are downloaded.
- **Skill editor**: capabilities as chips with readable names; one tool list with No / Optional / Required (the checkboxes no longer stretch across the row).
- **Look**: drop-down lists drawn by the page (themed list, scrollbar and highlight); no coloured halo around focused fields, primary buttons, the active menu item or the composer; text areas, URL, number and date fields styled like the other fields; three new light themes (Mint, Lilac, Paper). RealmNest Dark was removed (Forest is its near twin; a saved RealmNest Dark becomes Forest, also the default): 12 themes, the 6 light ones first, then the 6 dark ones.
- **Model lists** in Settings open towards the side with room (in AI Capabilities the list was cut off on the left).
- **Texts removed**: "Local only: no text leaves this computer" and the lexical note in Knowledge (where text goes depends on the connection; the embeddings line stays), the photo hint in the profile, the theme caption, the MCP warning.
- **Home**: an empty world you only visited no longer gets a tag on the map (the grey circle was a CSS class clash, fixed too).

## 0.11.0 · Web (fetch foundation)

- **Safe fetch in Rust** (`src-tauri/src/web/`): http(s) only, no credentials, ports 80/443/8080/8443; local, private, link-local, metadata, CGNAT and other non-public addresses refused in every notation (IPv4, IPv6, mapped, NAT64); local host names refused; a DNS resolver that checks every answer and pins the connection (anti-rebinding); manual redirects (max 5) checked at every hop; no proxy, no cookies; 20 s / 10 s connect; 5 MB (10 MB PDF) cut while streaming; only readable content types downloaded; HTTP statuses mapped to error codes.
- **Hidden page reader** (Windows, WebView2) for pages that need JavaScript: incognito, own data folder, every navigation and sub-request checked, downloads / new windows / permissions denied, one at a time, destroyed after use. Can be switched off.
- **Skill install from URL** now uses the same guard (SSRF fix): https only, guarded DNS, at most 3 checked redirects, no proxy.
- **`web_fetch`** tool: HTML (own extractor: article / main / density, junk removed, headings, lists, tables, code), text, Markdown, JSON, PDF (existing reader); metadata only when the page states it; 15-minute in-memory cache; tracking parameters removed.
- **`web_search`** contract, normalized results, de-duplication, domain filters, error model and **engine slots** (`WebSearchEngine`). **No engine in v1**: `SEARCH_PROVIDER_NOT_CONFIGURED`. No scraping of search engines.
- **Runs**: `[W1]` labels only for pages read; citations resolved against what the run read, invalid labels reported, lexical grounding check per family (`[K]` and `[W]` apart); `WebRunRecord` provenance on `ConversationRun.web` / `AgentRun.web`; budgets (6 pages, 4 searches per answer); prefetch of the user's links for models without tools.
- **Prompt-injection isolation**: `<web_page>` blocks marked UNTRUSTED, neutralized so a page cannot close or forge a block; rules forbid acting on page text; `web_fetch` of an unseen address asks for approval (new `ToolRuntime` `escalate` hook, `ToolCall.approvalReason`).
- **Permissions**: Web off by default; the chat globe (`Conversation.web`) and the agent's **Web access** (`AgentDefinition.webAccess`); run-scoped tools refused outside a Web run; Strict Knowledge keeps it off.
- **UI**: composer globe, agent inspector › Web, green `[W]` chips that open the page in the system browser, **Pages read** with **Save to Knowledge** (`KnowledgeService.addWebPage`, `sourceType: 'web'`), tool rows show the address, Settings › Integrations › Web, Simulation › Debug › Web. Italian and English.
- Skill install from URL says which rule stopped a download (redirect blocked, non-https redirect, too many redirects, private address behind the name).
- Memory extraction never proposes document or web page contents.
- Docs: [docs/WEB.md](docs/WEB.md); RUNTIME, TOOLS, KNOWLEDGE, MEMORY, CHAT, CAPABILITIES and README updated.

## 0.11.0 · Rebrand to RealmNest OS

- The product is now **RealmNest OS** (brand **RealmNest**, slugs `realmnest` / `realmnest-os`). It covers every UI string (it, en), the window title, Tauri productName, the page title, the boot screen, the README, docs, comments and tests.
- npm package and Rust crate `realmnest-os` (library `realmnest_lib`); the desktop binary is `realmnest-os.exe`.
- MCP bridge for Claude Code: `mcp__realmnest__…` tools, `realmnest-bridge` configs.
- Skill bundles are exported as `.realmnest-skill`, and old `.nestra-skill` bundles still install. Memory exports are `realmnest-memory` (`nestra-memory` still imports). `REALMNEST_CLAUDE_PATH` replaces `NESTRA_CLAUDE_PATH`, which is still honoured.
- Data identifiers keep the old name so nothing is lost: the app identifier `app.nestra.desktop`, the storage prefix `nestra:`, `~/.nestra/workspace`, the built-in Skill `nestra.workspace-note` and others. See [docs/REBRAND.md](docs/REBRAND.md).

## 0.11.0 · Agent Memory

- **Memory, separate from Knowledge** (`domain/memory.ts`, `runtime/memory/`, [docs/MEMORY.md](docs/MEMORY.md)):
  - `MemoryEntry` with type (8 types, no "system instruction"), scope, provenance, status, importance, expiry, supersedes / supersededBy, tags and user revisions;
  - scopes are explicit: only agent is used today, while user, project, team and organization are reserved;
  - stored under its own key, with a separate per-agent index.
- **Proposals, never silent saves:**
  - after an agent chat turn or task, a deterministic eligibility check runs first, then one short extraction on the run's own connection (or one chosen per agent);
  - the extraction answer must match a strict JSON schema, sent as OpenRouter structured output when the model supports it;
  - secrets are redacted, and sensitive personal data, instruction-like text and model guesses are refused;
  - each proposal is classified as new, duplicate, update or conflict.
- **Review:**
  - "N memories proposed · Review" under the reply;
  - Remember, Edit or Reject, and Keep existing / Keep both / Replace for changes;
  - Remember all and Reject all;
  - modes Off, Review before saving (default) and Automatic (opt-in, still asks about changes).
- **Memory screen:**
  - Active, Pending, Superseded and Expired views, with search and filters by type, tag and date;
  - Source ("why does RealmNest remember this?"), Edit (provenance kept), Expire, Delete (tombstone);
  - Add memory by hand;
  - export to Markdown or JSON, and import as proposals.
  - The agent inspector has a Memory section; there is also Debug › Memory.
- **Retrieval:**
  - BM25, with a light stemmer that now helps Knowledge too, plus optional embeddings through the existing route;
  - importance and recency nudge the ranking;
  - a relevance threshold and a budget of 6 memories / 1,800 characters;
  - standing preferences are included.
- **In runs:**
  - memory is given before the provider call as `<memory>` context, framed below the current user message, never as instructions;
  - `search_memory` is a run-scoped tool that reaches only the run's own agent;
  - memory is off in Strict Knowledge runs, and never cited as a `[K]` source;
  - `ConversationRun.memory` and `AgentRun.memory` record ids, labels, scores and searches;
  - `lastUsedAt` is set only for memories given to a completed run.
- **Agents:** deleting an agent deletes its memories (tombstones). Duplicating one does not copy them. Switching an agent's provider keeps them.
- **Structured output:** `ProviderTurnRequest.responseSchema` → OpenRouter `response_format: json_schema` (validated in Rust). `structured.output` is now ready on OpenRouter.
- **Knowledge:** a successful real embedding was confirmed on the release (hybrid base, search by meaning).
- **Tests:** `src/tests/memory.test.ts` covers the domain, policy, extractor, lifecycle, retrieval, runs, and chat and agents end to end, with Strict and Grounded Knowledge, isolation, provider switch and injection.

## 0.11.0 · Knowledge + local RAG

- **Knowledge bases and documents** (`domain/knowledge.ts`, `runtime/knowledge/service.ts`, [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md)):
  - documents reference FileStore bytes: a file from disk, an Attachment or an Artifact (shared, never copied);
  - indexing jobs (queued → extracting → embedding → indexing → ready) with cancel, restart recovery and an atomic swap of index generations: a failed or cancelled re-index keeps the previous one searchable;
  - stale detection (a newer artifact version, a replaced file, changed embedding settings), re-index, remove with tombstones, delete base; sources are never deleted;
  - Knowledge blobs join the FileStore keep list and the artifacts' "still in use" check.
- **Extraction** with source locations: RealmNest's own PDF text reader (page numbers, ToUnicode, widths, object streams; no OCR → `NO_EXTRACTABLE_TEXT`), Markdown heading paths and lines, CSV rows as `column: value`, JSON, text, DOCX. HTML, SVG, programs and archives are refused.
- **Chunking** that follows the document: never across a page or a second-level section, sentence-aware splitting, overlap only within a section, stable ids and content hashes.
- **Search:** BM25 with codes kept whole and split, accent folding, Italian and English stop words; cosine over normalized embeddings; reciprocal rank fusion; a deterministic `Reranker` (exact codes and quoted phrases first).
- **Embeddings:** the new routable capability `embeddings.create`, an `EmbeddingProvider` / `EmbeddingService` abstraction, OpenRouter `/embeddings` through Rust (key never in the page; inputs and answers validated; real usage and cost only). Batches, a cache by content hash + model, one embedding identity per base (a model change makes documents stale), dimension checks, and a words-only fallback when the provider is unavailable. Local (words) is the default: nothing leaves the computer.
- **Runs:** `search_knowledge` (a low-risk, run-scoped native tool), sources retrieved for every message or task before the provider call and labelled K1… per run, OPEN / GROUNDED / STRICT modes (STRICT offers only `search_knowledge` and Skill tools, and answers "not in the Knowledge" itself when nothing matches and the model cannot search), prompt-injection framing (`<knowledge_sources>`, evidence not instructions, forged tags neutralised).
- **Citations and grounding:** `[K3]` resolved and validated against what the run retrieved (invalid labels recorded), a deterministic GroundingVerifier (numbers and codes of cited sentences must be in the cited sources; uncited factual sentences counted), provenance on `ConversationRun.knowledge` and `AgentRun.knowledge`.
- **UI:** a Knowledge screen (base cards with a privacy line, documents with status and actions, a "Try a search" box, a document view with chunks and locations), the composer's Knowledge control (bases + mode), the agent inspector's Knowledge section, numbered citation chips with sources and verdict under replies and task results, "Add to Knowledge" on artifacts, an embedding model picker in AI Capabilities, **Debug › Knowledge**.
- **RealmNest Docs:** a built-in, read-only, local base with this version's product documentation.
- **Fixes:** Markdown heading paths no longer lose their hierarchy when a level is skipped. Found in the release acceptance: full-width citations (【K1】), heading-only chunks, the missing ACL permissions for the embedding commands, AI Capabilities calling embeddings and vision "not ready", the documents table layout, and a long answer misread as a decline.
- **Tests:** `src/tests/knowledge.test.ts` (extraction on real PDFs, chunking, search, embeddings, the service, runs, citations, grounding, injection, chat and agents end to end).

## 0.11.0 · File system foundation (attachments, artifacts)

- **Audit first** ([docs/FILES_AUDIT.md](docs/FILES_AUDIT.md)): attachments and `@skill` were extended, not rebuilt.
- **FileStore** (native, `src-tauri/src/files/`; port in `runtime/files/store.ts`):
  - content-addressed blobs (`sha256:<hex>`), SHA-256, magic-byte sniffing, 32 MB cap, atomic writes, integrity check (`FILE_CHANGED`);
  - structured errors;
  - export copies through the Windows save dialog, open and reveal on named copies (never programs, HTML or SVG);
  - clean-up of unreferenced blobs older than a day;
  - binary IPC: raw request bodies and `ArrayBuffer` responses.
- **Attachments:**
  - stored by reference: images and PDFs now survive a restart;
  - one import path that refuses spoofed files;
  - a chip per file, with its own loading or error state and a thumbnail; a lightbox; dated names for pasted screenshots;
  - provider capability gating at add time, at send time and in the runtime;
  - **task attachments** on the same domain;
  - run-scoped access for tools;
  - `save_attachment` copies a run's own attachment into the workspace.
- **Skills precedence:** explicit (chip or `@`) > assigned > automatic (confident only) > none. Provenance is on each run (`activation`); `@` syntax is stripped from what the model reads; chips are `[ Workspace Note × ]`; replies show "In uso: …".
- **Artifacts** (`domain/artifact.ts`, `runtime/files/artifacts.ts`):
  - tool-written files and MCP binary results become Artifacts with full provenance and lineage;
  - tombstones on delete; export copies; Use in Chat and Send to Agent;
  - inline under chat replies, Outputs on agent runs;
  - an **Artifacts** screen and **Debug › Files**.
- **Fixes:**
  - modals render on `document.body`, so a glass panel no longer clips them;
  - the CSP now allows the IPC channel, so raw binary IPC no longer falls back to JSON;
  - the export dialog runs on an STA thread, modal to RealmNest.
- **Send to Agent** gives the choice of a new task or a new chat.

## 0.11.0 · Skills and the Skill installer

- **Skills** (`domain/skill.ts`, `runtime/skills/`):
  - portable procedures with a stable id (`publisher.skill-name`), semver, instructions (SKILL.md), examples and resources;
  - declared capability and tool requirements: exact ids, or the portable MCP form `{mcpServer, tool}`;
  - content only, never code.
- **Package format:** SKILL.md (Agent Skills-compatible frontmatter) + `skill.json` + `resources/` and `examples/`; one-file export as `.nestra-skill`.
- **Import adapters:**
  - RealmNest package, bundle, Agent Skills folder, single SKILL.md;
  - the adapter shows what it mapped and invents no dependencies;
  - another product's `allowed-tools` are reported as unmapped, and the user picks the RealmNest tools.
- **Safety:**
  - executables and scripts are never installed (by type and by content);
  - paths, sizes, duplicates and the manifest are validated, and refused when invalid;
  - secrets are refused;
  - SHA-256 package hash;
  - everything is checked again in Rust;
  - an atomic native store (`%LOCALAPPDATA%\app.nestra.desktop\skills`) that follows no links;
  - exports only to `Documents\RealmNest Skills`;
  - URL install is HTTPS only, size- and time-limited, and reviewed before anything is kept.
- **Review before install:**
  - instructions, requirements with their state, permissions, files, left-out files, mapping and warnings;
  - existing → incoming versions, with Replace;
  - a prompt-injection warning for imported Skills.
- **SkillDependencyResolver:** READY / MISSING_CAPABILITY / MISSING_TOOL / TOOL_DISABLED / TOOL_UNAVAILABLE / CONNECTION_UNAVAILABLE per requirement, and READY / PARTIALLY_READY / NOT_READY for the Skill.
- **Activation in LiveRuntime and ConversationRuntime** (no parallel runtime):
  - layered system-prompt context;
  - **only the Skills' tools** (then the agent's), with required tools never truncated;
  - structured refusals before the provider: SKILL_NOT_FOUND, DISABLED, NOT_READY, CONFLICT, TOO_MANY, TOOL_LIMIT_EXCEEDED, CONTEXT_TOO_LARGE, MODEL_NO_TOOLS;
  - the read-only `read_skill_resource` tool;
  - run provenance (`skills: [{id, version, name}]`), kept after an uninstall.
- **UI:**
  - a Skills screen (cards, detail, editor, export, enable/disable, uninstall, assign to agents) and the installer (file, folder, URL; Git and a gallery shown as later);
  - a Skills section in the agent inspector;
  - a Skill picker in the chat composer;
  - the Skills used on runs and in earlier tasks.
- **Built-in:** Workspace Note (`nestra.workspace-note`). **Examples:** `examples/skills/` (a RealmNest package with PhotoCraft, and an Agent Skills-format sample).
- **Bridge fix:** Claude Code now gets the full text of a tool result (structured summaries go along only with an output schema).
- **Verified in the desktop release:**
  - create, export, uninstall, reimport;
  - an agent with native tools, an MCP Skill (only its 2 PhotoCraft tools seen), a Claude Code Skill (only `mcp__realmnest__…`) and chat;
  - missing dependency, disabled and uninstalled Skills, and a restart;
  - a real external Agent Skills package.
- **Tests:** 469 TS (32 new: Skills and the bridge fix) and 66 Rust (6 new for the Skill store).

## 0.11.0 · MCP integration

- **MCP servers as a tool source.** Local stdio servers register their tools in the one ToolRegistry, as `mcp.<server>.<tool>`. After the registry they are ordinary tools: the same ToolRuntime, permissions, approval, history, limits and cancellation.
- **Dual-era client** (`runtime/mcp/client.ts`):
  - MCP **2026-07-28**: `server/discover` probe and per-request `_meta`;
  - legacy `initialize` (2025-11-25 back to 2024-11-05) as the fallback;
  - paginated tools/list, tools/call, timeouts, `notifications/cancelled`, legacy ping and list_changed.
- **Native host** (`src-tauri/src/mcp`):
  - only an `.exe` with argv: no shell, PATH lookup, validated folder and variables;
  - secret variables read from the credential store, limited to `mcp.<server>.*`, and redacted in output;
  - a kill-on-close Job Object per server; capped JSON lines;
  - **native consent**: a Windows dialog the first time a launch configuration runs, remembered in a file only Rust writes.
- **Statuses from the real process:** disconnected, starting, connected, unavailable, failed, auth_required, stopped. Configs persist; servers start manually unless set to start with RealmNest.
- **Tools:**
  - off until turned on per server, then ask by default; risk is never low, because annotations are untrusted;
  - full JSON Schema validation (type unions, null, anyOf, oneOf, allOf, const);
  - results keep text, structured, image, audio and resource parts; binary data stays in memory only;
  - at most 32 tools per turn, with a warning.
- **Disconnect, crash and reconnect:**
  - tools stay listed but unavailable;
  - a reconnect rediscovers them and replaces changed schemas;
  - calls in flight fail cleanly;
  - no orphan processes.
- **Claude Code bridge:**
  - RealmNest is an MCP server for Claude Code: `realmnest-os.exe --mcp-bridge` relays stdio to a loopback-only, one-time-token session;
  - Claude sees only the run's tools (`--tools ""`, `--strict-mcp-config`, `--allowedTools mcp__realmnest__…`);
  - every call goes through ToolRuntime and RealmNest's approval;
  - `tools.calling` is now ready for Claude Code in the desktop app.
- **UI:**
  - Settings › Integrations › MCP (servers, add/edit form with secret variables, Manage with search, on/off and permissions, warning);
  - approval shows the MCP server;
  - agent tools grouped by source;
  - Debug › MCP (status, protocol, process, message log without payloads, redacted stderr).
- **Verified in the desktop release:**
  - PhotoCraft 0.7.0 (modern) and EffectCraft 0.8.0 (legacy 2025-06-18) together;
  - chat and agent calls on OpenRouter and on Claude Code via the bridge;
  - approval and denial (a denied call never reaches the server);
  - crash, restart and auto-start.
- **Tests:** 437 TS (26 MCP and 9 bridge tests) and 60 Rust (8 MCP host and 3 bridge tests).

## 0.11.0 · Tool Runtime and Tool Registry

- **One tool registry** (`runtime/tools/registry.ts`):
  - `ToolDefinition` with source (native today; mcp, cli, http and plugin reserved), JSON input schema, risk, permissions, timeout;
  - strict input validation.
- **ToolRuntime:** the only way a tool runs:
  - checks the tool is known and enabled, the input and the permission;
  - shows the approval prompt when needed;
  - applies timeout and cancellation;
  - emits `tool.*` events (ids and codes only);
  - keeps a bounded history (300 calls, 4000 characters per input/output in storage).
- **Permissions:** allow / ask / deny.
  - The agent's choice beats the global choice, which beats the tool default and then the risk default (low → allow, medium and high → ask).
  - A tool's ceiling caps the result.
- **Approval prompt:** shows who asks, the tool, risk, path, workspace and the full input, with Nega / Consenti una volta / Consenti per questo task / Consenti sempre per l'agente.
- **ToolLoop:** an explicit model ⇄ tools loop that looks like one provider run to agents and chat. Limits: 10 calls, 2 identical calls, 3 failures in a row and 12 turns; past them the run fails with `tool_call_limit`.
- **Native tools:** `get_current_time`, `list_directory`, `read_text_file`, `write_text_file`.
  - The workspace sandbox is enforced in Rust by three narrow Tauri commands. Traversal, absolute, UNC, `\\?\`, alternate data streams, device names, links and junctions are refused, and writes are atomic.
  - Limits: 256 KB per read or write, 500 entries per listing.
- **Providers:**
  - neutral `toolSchemas`, `toolCalls` / `tool` messages and `tool.requested`;
  - **OpenRouter** sends OpenAI-style tools and assembles streamed tool calls in Rust;
  - **Claude Code** stays without RealmNest tools (it would need MCP); `tools.calling` is not ready there, and the UI says so.
- **UI:**
  - Settings › General › Strumenti (workspace, permissions);
  - the agent inspector's Tools section;
  - the chat composer's Strumenti switch;
  - tool calls under replies and in the run panel;
  - Simulation › Debug › Tools.
- **Verified in the desktop release** on OpenRouter with Nemotron 3 Super (free):
  - Alex wrote `hello.txt` after approval and read it back;
  - denial, cancellation during approval, and the sandbox refusing `..\..` and `C:\Windows` paths;
  - chat with tools off and on;
  - history after a restart;
  - Claude Code chat unchanged.
- **Tests:** 402 TS (31 new tool tests) and 49 Rust.

## 0.11.0 · Home is the main menu

- **One window:** the sidebar is a full-height column and the page fills the rest, on the theme's own background (no floating cards, no blurred world behind them). Chat and the World run edge to edge.
- **Home replaces the main menu:**
  - the app opens on Home;
  - the current world is shown alive, with its agents, plus Continue, New chat and Create agents;
  - every world is a card cut from its real baked map (`public/baked/<world>/preview.webp`, `python tools/bake_previews.py`); a click shows that world alive, a click on the current card enters it;
  - What's new and the Guide are buttons on the scene; Quit is at the bottom of the sidebar.
- The island map drawn in code (`render/worldMap.ts`) is gone.

## 0.11.0 · profile and world map

- **Profile in the sidebar:**
  - photo, or the initial until there is one, plus name and role;
  - edited in Settings › General (upload, change or remove the photo; square-cropped, stored locally).
- **Home world map:**
  - one pixel-art island drawn in code, with each world in its own place (port on the bay, launch pad and observatory on the peaks, farm fields, lab in the forest, town, factory by the river);
  - tags with agents, tasks and state where agents live, placed so they never overlap.

## 0.11.0 · Home map, attachments, navigation rail

- **Home redesigned:**
  - a world map (islands drawn from the real worlds, with agents, active tasks and state);
  - Recent activity (tasks, chats, new agents) on top, then an Overview (agents, working now, done today, failed in 7 days);
  - no greeting, composer or buttons on Home;
  - no emoji: worlds use Lucide icons.
- **Navigation rail:**
  - in Chat, the World and narrow windows the sidebar is an icon rail that opens over the page, with labels, on hover or keyboard focus (the old tooltips slipped under the chat);
  - the sidebar now shows the user;
  - Settings has its own group.
- **Chat attachments:**
  - "+" in the composer, drag and drop, and pasting images;
  - text files work with every provider; images and PDFs go to Claude Code (stream-json content blocks, verified with the CLI) and to OpenRouter (inline data URL parts);
  - checked against the chosen model's capabilities;
  - retry re-sends the files;
  - image and PDF bytes are never saved.
- **Claude Code** now declares `vision.input` and `files.input` as supported (verified).
- **Tests:** 366 TS (11 attachment tests and 3 Home tests) and 39 Rust (inline parts accepted; remote URLs and odd parts refused).

## 0.11.0 · UI/UX foundation

RealmNest now looks and behaves like a desktop AI product. See [docs/UI_UX.md](docs/UI_UX.md).
- **Chat redesigned:**
  - icon rail instead of the full sidebar;
  - a greeting from the local time (plus your name, if set) over a centred composer with a theme glow;
  - the same composer docks at the bottom once the chat starts;
  - a centred reading column whose text fades out behind the composer (no divider);
  - smart scrolling with "Jump to latest".
- **AI picker:** one compact CONNECTION → MODEL selector in the composer (Auto route, statuses, catalogue search, recent models, "Manage AI connections"). Header selectors removed.
- **History drawer:**
  - Pinned / Today / Yesterday / Previous 7 days / Older, with search;
  - rename, pin/unpin and delete, persisted;
  - pinned chats are never pruned.
- **Titles:** the first-message title stays the immediate fallback. Optional AI titles (Settings › General, off by default) are asked for once, never awaited, and never replace a title you chose.
- **Themes:**
  - token-based theme system (`src/themes.ts`) with 10 curated light and dark themes, picked in Settings › Appearance and persisted;
  - every colour in the stylesheet is a token;
  - old `dusk`/`night` saves migrate to Ember.
- **Typography:** Inter everywhere (the serif display face was removed); mono only for technical data; a type scale.
- **Navigation:**
  - Crew → **Agents** in the product;
  - Outfit is no longer a destination;
  - "Your crew" removed from Home;
  - Chat added to Home and the main menu.
- **Agents in worlds:**
  - "Move to world" in the World inspector, Agents and Worlds, with a confirmation toast;
  - an agent with a live run is not moved;
  - each agent remembers its outfit per world, so a round trip no longer resets it.
- **AI Connections:** cards rebuilt so actions always stay inside and wrap at any width.
- **Tests:** 352 TS (18 new UI-foundation tests, including theme contrast) and 37 Rust.

## 0.11.0 · Capabilities and routing

One capability vocabulary and a user-controlled routing policy. See [docs/CAPABILITIES.md](docs/CAPABILITIES.md).
- **Vocabulary:**
  - 12 capabilities: `text.chat`, `text.streaming`, `text.reasoning`, `vision.input`, `files.input`, `coding`, `tools.calling`, `web.search`, `image.generate`, `image.edit`, `structured.output`, `sessions.native`;
  - support is supported, unsupported or unknown, with provenance (provider/connection/model level, origin, evidence, native or via RealmNest).
- **CapabilityService:**
  - one resolver keeping supported, available, ready and routed apart;
  - effective support (the model claim wins over the provider claim);
  - per-capability model lists; `canSatisfy(requirements)`.
- **Model claims from OpenRouter metadata only:** modalities, accepted parameters, and the reasoning object (now parsed by the Rust host). Unknown stays unknown.
- **Claude Code claims rewritten honestly:** vision is unknown, image generation unsupported.
- **Routing policy:**
  - capability → ordered targets (primary + explicit fallbacks), persisted under `routing`, `routing.updated` event;
  - never changed automatically; removed connections, vanished models and failing keys are reported with structured failures (`NO_ROUTE_CONFIGURED`, `CONNECTION_REMOVED`, `CONNECTION_UNAVAILABLE`, `CONNECTION_CHECKING`, `MODEL_UNAVAILABLE`, `MODEL_REQUIRED`, `CAPABILITY_UNSUPPORTED`, `NOT_READY`).
- **UI:**
  - Settings › AI Capabilities (routes, reordering, live state);
  - Chat **Auto** (resolves `text.chat` once, manual choice wins, `routedBy` recorded);
  - agents' optional **Default chat route**;
  - capability-aware model picker (unknown models badged);
  - Debug › Capabilities (connection/model/effective claims, provenance, availability, readiness).
- **Tests:** 29 new capability and routing tests (330 TS in all) and 37 Rust.

## 0.11.0 · OpenRouter

OpenRouter is the second real provider: API key, a live model catalogue, streamed chat, and agent tasks. See [docs/providers/OPENROUTER.md](docs/providers/OPENROUTER.md).
- **Native HTTP host** (`src-tauri/src/openrouter`):
  - `reqwest` + rustls, HTTPS only, one fixed origin, redirects never followed;
  - size limits, timeouts, cancellation by run id that closes the connection;
  - SSE parsed in Rust, errors normalized and redacted;
  - four narrow commands, and no generic HTTP proxy.
- **API key:** in the OS credential store only, read by Rust; the webview never receives it.
- **`OpenRouterProvider`:** stateless, history replayed by `ConversationRuntime`, system prompt as a system message; usage and authoritative cost on runs.
- **Models:**
  - catalogue fetched after a successful check, cached apart from the record (24 h TTL, Refresh models);
  - searchable model picker (context, price, modalities; `openrouter/auto` listed explicitly).
- **Connections:**
  - new `invalid_credentials` status;
  - the preferred model now applies to every turn without a model (Claude too);
  - capabilities and catalogues only for working connections;
  - switching an agent or a chat to another connection clears the old model.
- **Tests:** 295 TS and 37 Rust (mock HTTP server: streaming, errors, redirects, cancellation, timeouts).

## 0.11.0 · AI connections

Providers and connections are now separate: Chat and agents use **AI connections** (Settings › AI Connections), and a provider can have several. See [docs/CONNECTIONS.md](docs/CONNECTIONS.md).
- **Domain and catalogue:**
  - `AIConnection` (method, non-secret config, secret names, status, capabilities, models);
  - `ProviderCatalog` with `ProviderDefinition`s that declare connection methods and fields;
  - Claude Code implemented; OpenAI, Anthropic API, OpenRouter, Ollama and Gemini listed as coming soon.
- **`ConnectionManager`:**
  - one adapter per connection;
  - status only from real checks, rechecked at every start;
  - capability snapshot, models when the provider can list them;
  - soft delete with a usage warning;
  - `connection.*` events.
- **Claude migration:**
  - the existing CLI sign-in becomes the "Claude Code" connection;
  - agents and conversations saved with `providerId` move to `connectionId`, written back with tasks, runs, messages and sessions intact.
- **Multiple Claude accounts:** a connection can use its own Claude config folder (`CLAUDE_CONFIG_DIR`), allowlisted and checked by both process hosts.
- **Secrets:**
  - OS credential store through write-only Tauri commands (`secret_set`, `secret_delete`, `secret_exists`; no read);
  - refused in browser builds;
  - never in storage, logs or events.
- **Runtimes:** `ProviderService` runs on connection ids and stamps `connectionId` on provider events. `LiveRuntime` and `ConversationRuntime` use connections.
- **UI:**
  - Settings › AI Connections (cards, Test connection, Manage, Remove; add flow generated from the catalogue);
  - connection selectors in Chat and in the agent panel;
  - the debug Providers panel lists connections.
- **Tests:** 278 TS, 19 Rust, including a real Credential Manager round trip and env allowlists on both hosts.

## 0.11.0 · universal chat

RealmNest has a real, persistent, provider-independent chat (sidebar › **Chat**). See [docs/CHAT.md](docs/CHAT.md).
- **Domain** (`src/domain/conversation.ts`): `Conversation` (agent chat or direct chat), `ChatMessage`, `ConversationRun`, `ProviderSessionInfo`, deterministic titles.
- **`ConversationRuntime`** (`src/runtime/chat/`), separate from `LiveRuntime`:
  - creates conversations, sends, streams, stops, recovers from failures;
  - one provider session per conversation, resumed after restarts;
  - an explicit "new session" when the provider lost one;
  - full history for providers without sessions.
- **Provider contract:**
  - `ProviderSessionRef` (`new` / `resume`) replaces `sessionId` + `createSession`. The Claude adapter is now stateless, so sessions survive restarts.
  - New neutral error `session_not_found`, mapped from the real CLI output.
- **Claude adapter:** turns without tools replace Claude Code's agentic system prompt with a plain one, so the model no longer acts out tool calls as text. `--system-prompt` is allowlisted in both hosts.
- **Chat screen:**
  - history, agent / provider (from the registry) / model, live status;
  - streaming bubbles, Stop, retry, the lost-session banner;
  - minimal safe formatting (bold, inline code).
- **Events:** `conversation.created`, `conversation.message.added`, `conversation.run.*`; deltas are not logged.
- **Shared code:** `CoalescedWriter` (coalesced saves) and `agentSystemPrompt`, used by both runtimes.

## 0.11.0 · live agent runtime

Characters can now do real AI work. In **Live** mode you give an agent a task, and a real Claude Code run executes it. The character walks to its desk and works only while that run is going. See [docs/RUNTIME.md](docs/RUNTIME.md).
- **Models** (`src/domain/agent.ts`):
  - `AgentDefinition`: provider, model, instructions, workspace; its id is the character's.
  - `AgentTask` and `AgentRun`, kept separate (a task can have several runs).
  - Code-enforced state machines for agent (`idle → starting → working → idle`), task and run.
- **`LiveRuntime`** (`src/runtime/live/`):
  - implements `AgentRuntime` and runs tasks through `ProviderService`;
  - translates provider events into domain events (`agent.status.changed`, `task.status.changed`, `agent.run.*`) and into the world events `WorldSim` already understands;
  - streams output, cancels, recovers from failures;
  - allows one run per agent and isolates runs between agents.
- **`RuntimeRepository`:** agents, tasks and runs on the existing storage, with coalesced writes during streaming, bounded history, and interrupted runs marked failed on start.
- **Runtime choice:** `Settings.runtimeMode`, picked in Simulation › Controls (Mock | Live) and applied in one place (`SessionManager`). `MockRuntime` is unchanged and still the default.
- **Inspector (live):** provider, model, instructions, task box, Run task / Cancel, streamed output, result or error, history.
- **Events tab:** live runtime events are tagged.
- **Fix:** a character whose work ended during its walk to the desk now arrives idle instead of "working".

## 0.11.0 · native process runner for the desktop app

The provider layer now works in the Tauri desktop app with the same `ProviderService` / `ClaudeCodeProvider` code as in `npm run dev`. See [docs/PROVIDERS.md](docs/PROVIDERS.md) and [docs/TAURI.md](docs/TAURI.md).
- **Rust process host** (`src-tauri/src/process`, `src-tauri/src/programs`):
  - three narrow commands: `process_run`, `process_cancel`, `process_locate`;
  - a run registry with ids;
  - independent validation of program, arguments, stdin and cwd;
  - spawn without a shell, line streaming over a Tauri channel, timeouts, cancel by id;
  - a Windows Job Object per run, so the whole process tree dies on cancel, timeout, app exit or crash.
- **Claude discovery in Rust:** the same order as the dev host, including the Store build of the Claude desktop app, and the newest bundled version.
- **`TauriProcessRunner`:** the platform layer picks it in the desktop app (also under `tauri dev`).
- **Permissions:** `allow-process-run`, `allow-process-cancel` and `allow-process-locate`, generated from the app manifest and granted only to the main window. No shell or fs plugin.
- **Shared JSON cases** (`args.cases.json`, `protocol.cases.json`) keep the TS and Rust allowlists and wire format identical.
- **Claude turns now pass `--strict-mcp-config`:** no MCP servers or claude.ai connectors are loaded.
- **Real fixture:** a captured signed-in stream replaces guesswork in the parser tests.
- **Housekeeping:**
  - icons generated for the desktop build;
  - the Debug › Providers panel shows which process host is in use.

## 0.11.0 · universal provider layer (phase 1)

RealmNest can now talk to AI backends through one contract, and the first real adapter runs the user's local Claude Code. See [docs/PROVIDERS.md](docs/PROVIDERS.md).
- **Contract** (`src/runtime/providers/`): `AIProvider`, capabilities, status states, provider-independent requests, normalized events, `ProviderRegistry`, and `ProviderService`, which publishes `provider.event` / `provider.status` on the existing bus (text deltas stay out of the log).
- **Claude Code adapter** (`providers/claude-code/`):
  - finds the CLI (`REALMNEST_CLAUDE_PATH`, PATH, native install, or the copy bundled with the Claude desktop app);
  - checks `--version` and `auth status`;
  - runs `claude -p --output-format stream-json` with the prompt on stdin;
  - translates the stream into normalized events;
  - supports sessions, cancel and timeouts.
- **Process layer** (`src/runtime/process/`):
  - `ProcessRunner` contract;
  - `NodeProcessRunner`: no shell, per-program argument allowlists, validated cwd, timeouts, process-tree kill;
  - `BridgeProcessRunner` plus a dev-only Vite plugin with host, origin and token checks.
- **Debug › Providers:** status, version, capabilities, test prompt, streamed output and event log.
- The placeholder `ProviderAdapter` type in `src/domain/agent.ts` is replaced by the new contract.
- **Tests:** 56 new (registry, capabilities, parser on a real captured stream, provider errors, process runner, bridge security). `@types/node` is added as a dev dependency.

## 0.11.0 · the Office, a modern city plaza (baked)

The Office now follows the owner's retouch: a bright, modern city plaza in the engine's own 128×64 pixel art, baked into a picture (`public/baked/office/`).
- **Props:**
  - `city_blocks.ts`: cream-stone blocks with blue glass, timber slats, roof gardens and pergolas, and the clock tower.
  - `city_towers.ts`: glass towers with pool decks, the monorail guideway and train, the canal edge and a bridge.
  - `city_plaza.ts`: palms, planters, light poles, a square fountain with animated jets, striped stalls, bus shelters, a bidirectional tram, a kiosk, café tables, benches and bocce lawns.
- **Floors:** light granite plaza, cream promenades, travertine bands, new asphalt with lane markings, and a turquoise canal.
- **Life:** 7 passers-by on 5 routes, the tram on the boulevard (stopping at both shelters) and the monorail over the canal. Measured, they add no visible cost to a frame (about 2.2–2.4 ms).
- **Room fixes:** the blue armchair (low arms flush with the seat), the bookshelf (shelves inside its sides) and the laptops on the meeting table (smaller, isometric).
- **Bake:** stencils are trimmed to where movers can pass behind them, so the Office's atlas is 2048×5806 instead of 2048×18596.

## 0.11.0 · city life (passers-by and vehicles)

A world can now have decorative passers-by and vehicles, declared in its scene (`src/render/ambient.ts`). Like the critters they are pure functions of time, with no simulation impact, no labels, and no clicks.
- **Passers-by** (`b.walkers(path, count, { loop, speed })`):
  - They walk polyline routes outside the playable grid: round a loop, or there and back with the turnarounds best left off the frame.
  - They wear the world's own outfits on the presets' faces and builds, with natural hair colours.
  - Each keeps to one side of the path and is out of step with the others.
- **Vehicles** (`b.vehicle({ type, x, y, axis, length, w, speed, stops, dwell, endWait })`):
  - They run back and forth along a straight line and stop at their stops, easing in and out.
  - They wait at the ends of the line, best placed off the frame.
  - Their art is a prop type, rasterised once, and they sort in depth in half-tile columns like long props.
- **Wall animations:** the walls' animations (clocks, sconces) now live in the props' animation pass, so baked scenes keep them too.
- **Baked scenes:**
  - Movers have their own boxes.
  - A prop's animation is drawn once, after the last mover it covers, so glows don't double up.
  - `bake.ts` leaves passers-by and vehicles out of the plates, and cuts out the props in front of their routes and lines.
- `tools/routes.ts <world>` checks routes and lines against solid props and the frame.
- `tools/sheet.ts` draws any prop into a PNG with the engine's CPU raster, without a browser.

## 0.11.0 · day and night

A sun and moon button in the simulation toolbar switches every world between day and night; `N` does the same. The choice is saved in the settings (`night`), and the change fades over about 1.5 s.
- **How the night is drawn:**
  - The finished frame is multiplied by a light map: blue ambient light with a little less saturation, warm pools of light round lamps, lit windows, and a warm glow inside indoor rooms.
  - A little bloom on the lights.
  - The day's warm tint fades out.
  - Because the light is drawn over the composited frame, baked pictures and painted scenes look the same, and people and animals are lit with the rest. Labels stay readable on top.
- **Where the light comes from:**
  - Props can declare their lights (`PropArt.lights`, in local coordinates): the Farm's street lamps, and the farmhouse windows on both floors.
  - The lamp types of the other worlds' packs are lit near their top from a table in `src/render/night.ts`. This covers the piazza lampioni, the lighthouse and the beacons, among others.
- Buildings in the surroundings have no lit windows yet; they can declare them the same way when each world is redrawn.

## 0.11.0 · the Farm in its own pixel art, baked into a picture

The Farm now follows the owner's AI retouch, drawn in the engine's own 128×64 pixel art. It ships as a baked picture, so the app no longer paints it when it loads: it loads in about 0.35 s instead of 4.5 s. Nothing else changes in the app.

- **Plates for the other worlds:** plates and guides for the other nine worlds are in `docs/worlds-bake/`, made with `plate()`. The guides name every world's animals in Italian and leave flying ones out.

**Colours**
- The Farm's scene has a colour grade measured against the retouch. Greens are 40% more saturated, turned 9° toward yellow-green, with deeper shade; earth and wood are lighter and warmer.
- The grade is applied to the ground and the sprites when the scene is built (`scene.grade`, `src/render/hd/grade.ts`). People and animals keep their own colours.
- The warm tint the app lays over the scene drops from 0.5 to 0.3.

**Density**
- **Countryside options:** the countryside generator (only the Farm uses it) gains four:
  - `orchard: 'dense'`: trees on every other tile, with blossoming cherries among the fruit;
  - `copse`: more copses;
  - `daisies`: drifts of white daisies;
  - `meadowTrees`: more lone trees in the meadows.
- **Parcel mix:** orchards and woods lead, both near the yard and further out.
- **Orchards round the yard:** the orchard behind the house and the one to the west are dense lattices, built round the cart, baskets and beehives.
- **South and in the yard:** the south meadow gains trees, shrubs and daisies, and the yard's grass gains daisies.
- The Farm has about 3,600 props, up from about 2,600.

**Details: the courtyard, from the retouch**
- **Courtyard:** rounded cobbles with moss in the joints, one row larger. These cobbles are only for worlds without a pack, so other worlds keep their paving.
- **Street lamps:** Victorian iron street lamps with lit lanterns and a soft glow, `farmLamp`, a Farm-only prop. They stand round the courtyard, by the house and down the lane.
- **Flower boxes:** the raised beds are plank boxes heaped with flowers and big open blooms; the lettuce and herb beds are heaped too.
- **New pieces:** a flower box at the courtyard's foot, a bench against the greenhouse, and more flowers in the garden.
- **Pond edge:** a mossy stone wall replaces the hedges.

**Baking**
- `bakePixel('farm')` in `src/dev/bake.ts` renders the still scene (no animals, animations or glints) at full and half resolution. It stores both as lossless WebP: 5.4 MB and 1.4 MB, identical to the engine's pixels.
- The 378 props that people or animals can pass behind keep their exact silhouettes in a stencil atlas. The 27 props with animations are listed so the app animates them on top: lamp glow, chimney smoke, fountain drops, bees and the pergola's lights.
- In the app the baked Farm matches the engine to within 0.02% of the pixels. The only difference is a lamp's glow under a repainted flower box.
- People and animals on a baked scene are drawn back to front, and each one gets the props in front of it repainted over it.
- **What the loader accepts** (`src/render/baked.ts`):
  - pixel scenes, never smoothed;
  - a half-resolution picture;
  - props that only bring an animation.
- Add `?procedural` to the URL to see the scene painted live instead.
- **Staleness guard:** the bake stores a fingerprint of the Farm's layout and colour grade. If the layout changes, the app refuses the old picture and paints the scene live, and a test fails until it is re-baked. Changes to the art code itself are not detected, so re-bake after those too.
- **Tests:** 150, with the new `baked.test.ts` covering the bake's fingerprint and stencils and the colour grade.

**The retouch test**
- The owner's retouch was upscaled 4× with Real-ESRGAN and cut out by hand with 23 outlines. It is kept in `docs/farm-bake/`: the picture, its bake in `ritocco-bake/`, and the recipe `farmRitocco` in `src/dev/bakeRecipes.ts`. The app no longer ships it.

## 0.6.0-beta: every world at 128×64, each in its own place (2026-10-07)

All ten worlds now use the Farm's 128×64 art direction. Every world has its own art pack and its own surroundings: no asset is shared between worlds, and none of them sits in the old generic city block. There are no new features, and the app shell, panels and controls are unchanged. Characters are still the 64×96 composer and are the next iteration. The authoring guide for packs is `docs/PACK_GUIDE.md`; reference renders are in `docs/worlds-2x/`.

**Farm fixes (from review)**
- **Greenhouse:**
  - The glass roof ends exactly on the frame (it used to overrun the white edge on the north-west).
  - Far walls, glazing and bars are visible through the glass.
  - Climbers: a grapevine with bunches, morning glory, clematis, and ivy on the plinth.
  - Inside: hanging baskets and slatted staging with seed trays. Outside: a potting bench and a water butt on a straight downpipe.
- **Roofs on the farmhouse, barn, shed and coop now sit on their walls:**
  - The gable infill reaches the underside of both slopes.
  - The verge and back overhangs are small.
  - Barge boards hang under both rakes.
  - The shed's side wall rises with its roof.
- **Farmhouse:**
  - The dormer grows out of the slope: its cheek follows the roof and its little roof runs back into the main one.
  - The chimney rises from the slope with lead flashing, a cap stone and two clay pots.
  - More climbers: wisteria on the gable, roses round the upper windows.
  - Window boxes upstairs, potted geraniums and box balls by the steps, a doormat.
- **Barn:** taller, with a steeper roof, and a louvred cupola with a rooster weathervane.
- **Courtyard fountain (new, 3×3):** a moulded basin, coins on the bottom, two tazze and a pinecone finial. Water spills from bowl to bowl, with drops and rings.
- **Small fixes:**
  - Picnic table: the benches and the table are drawn in the right order, so the top no longer covers the benches.
  - The bench on the pond now faces the water (new 'back' bench variant).
  - Long props (walls, fences, hedges, benches, crop rows) are cut into half-tile columns for depth sorting, so the sunflowers stand in front of the dry-stone wall.

**Ten worlds, ten places**

| World | Surroundings | Interior |
| --- | --- | --- |
| Office | a palazzo on an Italian piazza: church with dome and bell tower, café terrace, market, Triton fountain, plane trees, newsstand, tram | herringbone parquet, panelled walls, arched windows, oak desks |
| Factory | the Albion Works on a red-brick canal estate: mill with clock tower, chimney, sawtooth shed with lorries, water tower, rail spur, barge and swing bridge | press, CNC, oven and robot arm, all animated; safety paint |
| Space Station | the hull deck of an orbital station: modules, docked shuttle, robotic arm, landing pad, solar arrays to the frame corners, the planet below | animated consoles, glovebox, hydroponics, holo-table, docking hatch |
| Chemical Lab | a science-park campus: chemistry building, green-roofed wing, solar car park, hazmat yard, red cycle path, reed pond with boardwalk | fume hoods (titration, distillation), resin benches, HPLC, flammables cabinet, eyewash |
| Creative Studio | an arts district on a boardwalk: painted beach houses and a mural gallery, dunes, a beach with parasols, the pier, the sea with breaking waves | photo set with paper sweep, edit bays, podcast booth with ON AIR, easels, tiled coffee bar |
| Robotics | a hangar at an airfield: arch hangar, control tower, terminal, three planes, fuel truck, runway 36 with lights and windsock, drone pads | workbenches, 3D printer, humanoid on its gantry, live oscilloscope, pegboards |
| Data Center | a snowy site by a fjord: rooftop coolers steaming, timber wing, substation and pylons, generator yard, red cabins with a sauna, frozen fjord, reindeer | rack rows with blinking LEDs, NOC console, cooling unit, network core |
| Research Hub | a mountain observatory: chalet lodge, domes (one open), radio dish, weather station, chapel, cable car, ibex and marmots, peaks and a sea of fog | stone-pine library, star-chart table, globe, brass telescope, terraria, samovar |
| Logistics Port | a working harbour: fish market, harbour office, container terminal with gantry cranes and a ship, marina, lighthouse on the breakwater, car ferry, coaster at sea | quay, rail, crane and dispatch on wet concrete |

- Each world has its own floors, walls and wall props, floor patches, the cut front walls of its own building, and its own animals or robots: pigeons, gulls, rats, drones, astronauts, herons, rabbits, crabs, hares, foxes, reindeer, ravens, marmots, ibex, eagles, cormorants and seals.

**Engine**
- **World packs** (`src/render/hd4/packs/<world>/`): per-world props, `Floor4` ground shaders, ruler-straight borders (`crisp`), back walls with wall props (rasterised once), floor patches, critters (`CritterArt`), sprite sharing (`reuse`) and `groundFx`. Per-world prop metadata lives in `src/data/worldProps/`.
- **Building:**
  - **Build workers:** 128×64 scenes build in Web Workers and arrive as transferable pixel buffers. The UI shows a dusk gradient in the world's colours until a scene is ready.
  - **Memory:** at most three scenes stay in memory, and the current world is pinned.
- **Shared drawing fixes:**
  - **Textured faces** (`texPara`) visit only each row's covered span. Output is identical to the pixel, and builds are about 5% faster.
  - **Sprite margins:** the raster box reaches as far left as right, so wide crowns are no longer clipped.
  - **Ramp lookup:** `kit4.at()` now rounds before clamping, which fixes an `undefined` colour on 6-tone ramps.
- **Ground effects:**
  - Cloud shadows no longer fall on a walled room's floor.
  - `groundFx` turns clouds or wet banks off per world: Space and the Data Center.
- `decorateWalls` accepts wide kinds. The Farm's fountain is sized to its footprint.

**Tests:** 146 (new `packs.test.ts`: every 128×64 world has art for each prop, scenic prop, wall prop and critter it uses, cut front walls when indoor, and dense surroundings).

## 0.5.0-beta: Farm at 2× fidelity, 128×64 (2026-10-06)

A one-shot quality iteration on the Farm only. There are no new features, the app shell, panels and controls are unchanged, and the other nine worlds are untouched. The art bible is `docs/FARM_ART_BIBLE.md`, scene renders are in `docs/farm-2x/`, and the library sheets are in `docs/farm-2x/library/`.

**Scale (128×64, same framing)**
- The Farm runs at 128×64 tiles (`environment.tile: 128`, k = 4). The scene margin scales with k, so world proportions and camera framing match 0.4: the art gains pixels, not size.
- Zoom ≥ 1 (HiDPI and close-ups) shows the art 1:1. Below 1× the renderer draws a crisp half-resolution copy: the 2×2 mode, with ties going to the darker colour so outlines survive. A 1080p screen keeps the 0.4 framing with no blur.
- Characters: a 64×96 frame over the same crew system (Scale2x plus native eyes, brows, mouth, hair strands, fabric folds, rim light, 1-px warm outline). The 32×48 sprite is the level of detail.

**Asset library (built first, then used to dress the world)**
- **Trees, 11 species:** oak, birch, pine, willow, poplar, cherry in blossom, apple, pear, plum, orange, staked sapling. Each is a per-pixel lit leaf volume with its own silhouette and trunk. Oaks, fruit trees and cherries have broader, lower crowns, and birches fuller canopies.
- **Plants:** 7 bushes, 10 flowers, 4 grasses, hedgerows, sunflowers.
- **Boundaries:** fences (rail, a low weathered picket, wattle, broken) and a gate. Walls: dry stone, cut stone, mossy, ruin, brick.
- **Ground decals, 19 flat and baked into the ground:**
  - 6 path edges.
  - 6 transitions: the worn and mud patches are now lighter bare earth, not dark holes.
  - 6 clutter.
  - Stepping stones.
- **Crops, 10 families:** each plant has its own growth stage, with gaps and weeds; corn and beans are tall; wheat comes ripe or green.
- **Props and decor, 30:** the farm kit plus storytelling pieces (laundry, rain barrel, milk cans, ladder, tarp, chopping block, apple cart, baskets, seed bags, pot stack, birdhouse, broom, picnic blanket, mailbox). The trough now holds still water.
- **Pond set:** 4 rocks, 4 reeds (cattail, reed grass, yellow iris, rush), lilies, a jetty, a rowboat.
- **Animals:** hens, a rooster, ducks, frogs, cats, a dog, sheep and a holstein cow. The cow is now drawn at a believable size next to the sheep, with a bell.

**Ground at 128×64**
- The ground is painted with marks instead of dithered noise:
  - Grass: short blades with a shadow on their right, tufts with dark roots and lit tips, clover, five-pixel blossoms, and warm and cool patches.
  - Paths: pebbles, grit and bleached crowns, with grass creeping over the verges.
- Borders are resolved per 2×2 block with a ragged extra octave on land and smooth shores on water. The pond has a thin foam line, and the noise lattices are rotated (no diamond patches).

**World**
- **Authored ring:**
  - North: farmhouse with washing line, woodpile, rain barrel, bicycle and the dog; barn yard; mixed-fruit orchard.
  - West: orchard at harvest, beehives in lavender, fenced wheat.
  - East: the farm gate and mailbox; a poplar road; ripe and green wheat; a rail paddock with sheep and a cow; picket-fenced kitchen plots.
  - South: duck pond with jetty, rowboat, reeds, irises and frogs; a willow; wildflower drifts; a picnic under the cherry.
- **Countryside generator:**
  - Each wood has its own species mix, and each orchard its own fruit.
  - Fenced paddocks have animals.
  - There is a hedgerow and wall patchwork, and copses grow where the land is left alone.
  - Flowers grow in drifts of one kind, and verges have worn edges.
  - Density drifts between lush and quiet patches.

**Performance**
- Layers only visit the box they drew into, foliage solves its volumes once per crown, the ground rasterises its marks per row, and crop rows share one layer.
- The first 128×64 build took 8.3 s; the scene now builds in about 3.5 s (0.4 took 1.8 s), and a frame takes 5–20 ms.

**Tests:** 91 (new: the Farm runs at 128×64 with the same framing, the library minimums are met, the scene is dressed in variants, the animals are present, the jetty and water plants are the only things on water, flat decals never block, and `SoftCtx` box tracking and the half-resolution reduction work).

## 0.4.0-beta: Farm art vertical slice (2026-10-06)

Visual iteration on the Farm only. No new features, and the other nine worlds are unchanged. The local art bible is `docs/FARM_ART_BIBLE.md`; reference renders are in `docs/farm-slice/`.

**Scale (64×32)**
- The Farm runs at 64×32 tiles (`environment.tile: 64`). The renderer, camera, picking, labels, debug overlays and the title screen are all scale-aware.
- New 32×48 character composer: a ~36 px body, the head about a quarter of the height (not chibi). It covers every preset, hairstyle, outfit layer, headgear and accessory, and every pose and facing.
- HD critters: hens, ducks, butterflies, a cat and birds.

**Assets**
- An HD art kit: 5–6-tone hue-shifted ramps, per-pixel textured faces, and these materials: boards, siding, plaster, stone blocks, shingles, glass, brick.
- About 45 Farm props redrawn at 64×32:
  - **Buildings:** timber-framed farmhouse with porch, shutters, flower boxes, climbing roses and chimney smoke; red barn; glass greenhouse with plants inside; shed; coop; well; rose-covered pergola with string lights.
  - **Vegetation:** leaf-cluster trees in four foliage families, flowering hedges and bushes, sunflowers, tufts, reeds, lilies.
  - **Fields:** crops (carrot, tomato, cabbage, pumpkin, lettuce, herbs, wheat), raised beds, hay, scarecrows.
  - **Small props and furniture:** stone walls, fences, beehives, rocks, barrels, furniture, lamps and small props.
- Cast shadows fall to the lower right under a single sun from the upper left. Outlines are warm brown, never black.

**Ground**
- Organic borders between materials (domain-warped at 1/16 tile). Grass is drawn as tufts. Irregular terracotta flagstones with grout and moss. Pebbled dirt lanes with damp edges. Tilled soil. A pond with a shallow rim and wet banks. A shaded forest floor (new `forest` material).

**Composition and density**
- Decoration you can walk through on every free yard edge, plus decorative crop rows that complete the vegetable field.
- An authored ring around the yard: orchard rows, a barn yard, a fenced wheat plot, kitchen plots, and a pond with rocks, reeds and lilies.
- The countryside generator fills out to the frame edge with copses, orchards, flower meadows and small fenced plots. It respects authored props and grounds; there are no flat empty fields.

**Performance**
- HD sprites are rasterised on the CPU (`SoftCtx`) and uploaded once, and repeated scenery shares sprite variations. Building the scene went from ~9 s to ~1.5 s, and a frame takes a few milliseconds.

**Tests:** 84 (new: the Farm runs at 64×32 while the others stay at 32×16, every Farm prop has HD art, the frame is filled densely, no decoration sits on water, and the CPU raster fills and blends correctly).

## 0.3.0-beta: art direction & world composition (2026-10-06)

This release has no new features. It is a visual and layout revision against the cozy-isometric reference.

**Layout**
- Home: the right column now opens with the current world plus Enter/Change. Preview and controls are merged into one card, activity is compact, and the crew sits in a fixed row (two rows on tall screens). Nothing scrolls at 1920x1080.
- Worlds: the detail panel is compact and only its crew list scrolls. Thumbnails resize to fill the height.

**Worlds are places, not islands**
- Every world now has three layers: the playable area, an extended environment (scenic props, buildings, vegetation) and scenic ground that fills the whole camera range. The floating slab, island underside and gradient sky are gone.
- The camera explores inside the scene. It is clamped to the painted area and can't zoom out past it.
- Back walls are depth-sorted, so trees and buildings behind them are hidden properly. Indoor rooms get low cutaway front walls.
- `building()` generator: sidewalks, a plaza with trees, lamps, benches, planters, bike racks, a fountain, a road with parked cars, and neighbouring facades.
- `station()` generator: a hull ring, external modules, trusses and solar wings over a starfield.
- The Logistics Port is now a harbour: quay, warehouses, container stacks, two cranes, trucks, open water with boats.
- Empty wall spans are filled automatically with frames, shelves, sconces and hanging plants.

**Pixel-art fidelity**
- Per-pixel ground materials (25) with 4-6-tone palettes and Bayer dithering: paving stones with grout and moss, planks with grain and seams, grass tufts, tilled soil, water with crests and shore foam, cobbles, asphalt, sidewalks, hull plates, a starfield.
- Indoor light: window light pools and wall ambient occlusion, both dithered.
- A warm soft-light colour grade, sun bloom and vignette unify characters and environment.
- Selective (tinted) outlines on sprites, boxes and foliage. Foliage gets three tones plus leaf texture.
- Characters: 2x2 eyes with a catch-light, a shadow under the fringe, and lit clothing edges.

**Vertical slice: Farm**
- Rebuilt as a homestead (22x18 playable) inside a countryside. The farmhouse has a green tiled roof, timber frame, shutters, flower boxes, door lanterns and chimney smoke. Around it: wooden greenhouse, red barn, pergola lounge with string lights, raised flower and vegetable beds, crop rows (carrot, tomato, cabbage, pumpkin), chicken coop, tool shed, picnic table, apple tree with a bench, birdbath, lanterns, pots, gnomes, wheelbarrow, red bicycle.
- Surroundings: a stone-walled orchard with beehives, wheat and cabbage fields with scarecrows, a country road, flowering hedges, a duck pond, a meadow full of wildflowers.
- Ambient life: chickens, ducks, butterflies, birds and a cat, all purely visual.
- Countryside out to the frame edge (`countryside()` generator): the roads continue, and the land between them becomes fields, meadows, copses, orchards, pastures, two or three far-off farmsteads and ponds. It is calmer near the homestead so the homestead stays the focus.

**Framing**
- The playable area sits exactly in the centre of the scene, with the same 600 px margin on all four sides (`SCENE_MARGIN_PX`).
- The camera limits account for the side panel, so panning gives equal room on the left and right.
- Only the part of the scene the camera shows is redrawn each frame (culling).
- The Farm is the starting world, with 4 demo agents in it.

**Tests:** 76 (new: scenery stays outside the playable grid; non-solid decor is excluded from collision).

## 0.2.0-beta — RealmNest (2026-10-06)

Realigns the "Agent Worlds" prototype to the RealmNest product vision. The stack, sprite composer, A* and frame loop are reused. The rest is restructured into layers.

**Brand & UX**
- Renamed to **RealmNest**, with a new logo (isometric nest-box + star), dark premium chrome and Fraunces/Inter type, bundled locally.
- Game-style **main menu** (Continua, Scegli il mondo, Crea agenti, La tua crew, Outfit, Simulazione, Impostazioni, Esci) over a live floating-island scene. Keyboard navigation, guide (H) and what's new (F).
- App shell with sidebar: Home, Worlds, Crew, Outfits, Simulation, Settings. Italian/English UI.

**Worlds**
- New **isometric renderer**: 2:1 pixel rasterizer, walls/fences, diorama slab, depth-sorted props and agents, camera pan/zoom/reset, picking.
- 10 worlds as data (`src/data/worlds/*`): Office, Factory, Farm, Space Station, Chemical Lab, Creative Studio, Robotics Workshop, Data Center, **Research Hub** (new), **Logistics Port** (replaces Logistics Hub). Mission Control was retired.
- Typed **interaction points** (WORKSTATION, MACHINE, LAB_BENCH, SERVER, CROP, CONTROL_PANEL, COFFEE, BREAK, LOUNGE, MEETING, STORAGE, DECORATIVE) with capacity, tags and facing, plus spawn points, navigation nodes and camera hints.
- About 70 procedural props with cached static art and animated overlays.

**Characters & outfits**
- Unlimited crew: create, edit, duplicate, delete, move between worlds. **Names and roles are free text.**
- Character creator with live rotating preview: 12 visual presets (founder preset from reference C) plus body type, skin, 13 hair styles, hair and eye colour, facial hair, glasses, build, height, accessory and signature colour.
- Sprite composer upgraded to 20×30 with 3/4 isometric facings, body types, the founder's wavy mane, afro, long hair, smiles and brows.
- **75 outfits**: 7–9 per world collection plus 2 universal. New layers: apron, skirt, stripe, suspenders, boots, scarf, and bandana/beret/visor/raincap headgear. Colour variants. Outfit compatibility is enforced per world.

**Simulation**
- **MockRuntime** (truth) → event bus → **WorldSim** (visuals): truthful visualization.
- States: idle, walking, working, on_break, interacting, waiting, paused, error.
- Commands: Start work, Pause, Break, Resume, Reset, Randomize, Return to idle, Huddle, Assign/Route, Delegate, Select all, Step, Freeze, speed ×0.5–×4, Autopilot.
- Cozy idle behaviours: look around, stroll, coffee, sit on sofas/benches, chat, look at things.
- Workstation reservations, a waiting queue when stations run out, seated poses.
- Debug panel: force state, send to point or tile, overlays (paths, points, targets, grid), failure rate, agent table, event log.

**Platform**
- Persistence port (`StorageAdapter`) with localStorage and in-memory adapters, plus a versioned repository with migration.
- Central typed event bus with log.
- Future Agent-OS contracts as types only: `ProviderAdapter`, `AgentDefinition`, `AgentRun`, `ToolDefinition`, `WorkflowDefinition`, `ScheduleDefinition`, `RuntimeEvent`.
- Tauri 2 scaffold (`src-tauri/`), relative asset base, local fonts, prop art override registry.
- 66 Vitest tests: world integrity, pathfinding, state transitions, assignment, persistence, character creation, outfit compatibility.

## 0.1.0-beta — Agent Worlds

- First top-down prototype: 10 fixed characters, 10 scenarios, control panel and simulated commands.

# RealmNest OS: status checkpoint (15 October 2026)

This is a snapshot of where the project stands. Every milestone below was accepted on the native release build, driven through its own UI.

**V1 hardening: complete for this pass** ([HARDENING.md](HARDENING.md)). Every P0 and P1 from the audit is fixed with regression tests; the release exe passed the native checks (startup, single instance, Claude with RealmNest tools, hidden reader through the guard proxy, corrupted data, crash mid-reply, clean shutdown incl. Ollama, minimum window). Verdict: **ready for a public beta** on Windows, with the known limitations listed there. Not verified yet: a clean machine, Windows 10, display scaling, offline mode.

## Build state

| check | result |
| --- | --- |
| TypeScript (`tsc -b --noEmit`) | clean |
| Vitest | 814 tests in 46 files, all passing |
| Rust | 170 tests passing; `cargo fmt` and `clippy -D warnings` clean |
| Release | `realmnest-os.exe` 0.11.0 (0.11.0-beta), built 15 October after the V1 hardening, and the binary tested |
| Lint | the project has no lint script |

## Milestones done

1. **Universal provider layer:** one contract with normalized events; Claude Code adapter ([PROVIDERS.md](PROVIDERS.md)).
2. **Live agent runtime:** real tasks and runs; Mock and Live modes ([RUNTIME.md](RUNTIME.md)).
3. **Universal chat:** persistent conversations, provider sessions, history ([CHAT.md](CHAT.md)).
4. **AI connections:** several accounts per provider; secrets kept in the OS credential store ([CONNECTIONS.md](CONNECTIONS.md)).
5. **OpenRouter:** API key kept in Rust, live model catalogue, tool calling.
6. **Capabilities and routing:** supported, available, ready and routed are tracked separately; a user routing policy ([CAPABILITIES.md](CAPABILITIES.md)).
7. **UI/UX foundation:** 12 themes (6 light, 6 dark), Chat layout, the illustrated Home map ([UI_UX.md](UI_UX.md)).
8. **Tool runtime and registry:** native tools, allow / ask / deny permissions, approval, the tool loop ([TOOLS.md](TOOLS.md)).
9. **MCP integration:** MCP 2026-07-28 with a legacy fallback, and the RealmNest MCP bridge for Claude Code ([MCP.md](MCP.md)).
10. **Skills and the Skill installer:** SKILL.md plus a manifest, Agent Skills import, bundles, `@skill`, precedence ([SKILLS.md](SKILLS.md)).
11. **Attachments and Artifacts:** a content-addressed FileStore, provenance, lineage ([FILES.md](FILES.md)).
12. **Knowledge and local RAG:**
    - extraction, including a text-PDF reader written in-house;
    - BM25 search, plus optional embeddings, combined by fusion with a reranker;
    - `search_knowledge` and the Open / Grounded / Strict modes;
    - checked citations and the grounding verifier ([KNOWLEDGE.md](KNOWLEDGE.md)).
13. **Agent Memory:**
    - per-agent memory, isolated between agents;
    - memories are proposals the user reviews, and nothing is saved silently;
    - new / duplicate / update / conflict handling;
    - `search_memory`;
    - memory is off in Strict Knowledge runs ([MEMORY.md](MEMORY.md)).
14. **Rebrand Nestra → RealmNest OS:** a naming change only; the legacy data identifiers are kept ([REBRAND.md](REBRAND.md)).
15. **Web (fetch foundation):**
    - `web_fetch` through Rust with full SSRF protection (addresses, DNS, redirects), limits and error codes;
    - HTML / text / JSON / PDF extraction, and a hidden WebView2 reader for JavaScript pages;
    - untrusted framing, `[W]` citations of pages actually read, provenance, budgets, approval for unseen addresses;
    - Web off by default, per chat and per agent; off in Strict Knowledge; Save to Knowledge; Debug › Web;
    - `web_search` contract and engine slots, **no engine** in v1 (`SEARCH_PROVIDER_NOT_CONFIGURED`, no scraping);
    - the Skill install-from-URL SSRF fix ([WEB.md](WEB.md)).
16. **Owner's review:**
    - Claude by account (sign in, model list), and Anthropic API by key;
    - MCP servers online (HTTP, headers, OAuth) and Skills from GitHub;
    - themes (6 light, 6 dark) and drop-downs, and the Cast figures in the worlds ([CHANGELOG](../CHANGELOG.md)).
17. **Deep Research:**
    - search through the chosen connection's own web search;
    - an approved plan, then rounds;
    - an evidence ledger of verbatim quotes, with contexts cut from the page;
    - lexical and model checks;
    - a report rendered by RealmNest, with a contents column, charts and the sources' preview pictures kept locally;
    - Open in browser, PDF, HTML, Knowledge, Discuss, Dig deeper;
    - the `deep_research` tool for agents, Debug › Research, and the world bubble ([DEEP_RESEARCH.md](DEEP_RESEARCH.md)).
18. **Usage:**
    - the ring in chat and in the agent panel (Claude's 5-hour session and week, OpenRouter's credits, a budget for the others);
    - the per-connection summary in Settings;
    - a local ledger of every turn by connection, agent and chat ([USAGE.md](USAGE.md)).
19. **Delegation:**
    - `delegate_task` from agents (within their world) and chats (to any agent), with approval;
    - a queue for busy colleagues, no loops, depth 2, cancellation passed down;
    - the team in the prompt, the From / Delegated links in the panels, and the hand-over walk in the world ([DELEGATION.md](DELEGATION.md)).
20. **Crew:**
    - crews of one world (roles, coordinator, reviewer, brief), with templates;
    - a planned task graph the user approves, run with dependencies, parallel work and a queue for busy agents;
    - review with revisions, blocked tasks with retry and skip, and a final deliverable the user approves;
    - Artifacts, a translated history, restart and resume, and meetings and hand-offs in the world ([CREW.md](CREW.md)).
21. **Workflows, Scheduler, Orchestrator:**
    - versioned workflow definitions (9 node kinds, branches, merges, policies) with templates and a form editor over a read-only graph;
    - an orchestrator with retries, time limits, budgets, concurrency, approvals, durable waits, and suspend and resume after a restart;
    - schedules (once, interval, daily, weekly, cron) that only create runs, with catch-up and a report of missed times;
    - To do and a badge in the rail ([WORKFLOWS.md](WORKFLOWS.md)).
22. **More providers:**
    - ChatGPT via the Codex CLI (the user's subscription, native sessions, RealmNest tools through the MCP bridge, Codex's own tools off), the OpenAI API (key), Ollama (local, started by RealmNest);
    - the OpenRouter host shared through fixed flavors; embeddings for all three API kinds ([PROVIDERS.md](PROVIDERS.md)).
23. **Telegram:**
    - a paired bot by long polling: agents, crews, workflows, approvals with buttons, files in and out, a concierge on the Chat route;
    - configurable notifications and quiet hours ([TELEGRAM.md](TELEGRAM.md)).
24. **Effort and sound:**
    - the effort level beside the model for Claude, ChatGPT and OpenRouter reasoning models, per chat and per agent ([PROVIDERS.md](PROVIDERS.md));
    - generated music, world ambience and effects ([AUDIO.md](AUDIO.md)).
25. **V1 hardening:**
    - audit of the whole repository (six passes), P0/P1/P2 fixes in data safety, startup, runtime state machines, Rust/IPC security, MCP/OAuth/Skills/Telegram, content and release;
    - full backup / restore, storage health banner, safe start, single instance, file trash, LICENSE (AGPL v3 or later), notices, SECURITY.md, PRIVACY.md ([HARDENING.md](HARDENING.md)).

The art and worlds work happens in parallel, in a separate session: 10 worlds, character pipeline, baked Farm.

## Known open points

- **Bundle.** Screens load on demand, but the main bundle is still about 4 MB: 3.5 MB of it is the world art packs (`src/render/hd4/packs`), read synchronously by the renderer and its workers. Loading them per world means changing the render pipeline: to plan with the art session.
- **Memory:**
  - *Automatic* mode, and Memory export / import, are unit-tested only, not run on the release;
  - duplicate detection is by meaning only when the agent has embeddings on (else words and subject + key); conflicts are still found on words;
  - there is no compaction of similar memories;
  - Claude Code extraction uses JSON text validated against the schema (structured output is used only on OpenRouter).
- **Knowledge:**
  - adding a DOCX file, or adding from an attachment, was not run on the release;
  - the grounding check is lexical only;
  - no model-based reranker.
- **Web:**
  - the `web_search` tool of chats and agents has no engine yet (Deep Research searches through its own connection);
  - the hidden reader now goes through RealmNest's guard proxy (public addresses only, no DNS rebinding); it stays a fallback that can be switched off;
  - lists styled as menus are dropped with navigation (some home-page news lists);
  - no logins, cookies, OCR or compressed transfer.
- **Installers:** none built yet. MSI and NSIS would download WiX / NSIS, so ask the owner first.

- **Deep Research:**
  - "Discuss in chat" opens the chat on the report, but an answer from it was not checked on the release;
  - "Save to Knowledge" was not run on the release, so as not to touch the owner's bases;
  - the model check can mark genuine syntheses as partial;
  - sites that refuse automated reading stay unread;
  - runs from before the pictures existed have none.

## Recommended next milestone

**Workflow follow-ups**: the drag-and-drop canvas, event triggers (a file arrives, a webhook), workflows calling workflows, Windows notifications. Or **Crew follow-ups**: crews across worlds, a shared working folder, crew Knowledge bases. Alternatively, the **installers** (MSI or NSIS; they download WiX or NSIS, so the owner decides first).

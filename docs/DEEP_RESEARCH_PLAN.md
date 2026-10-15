# Deep Research: plan

Status: **built** (14 October 2026). What exists, and where it differs from this plan, is in
[DEEP_RESEARCH.md](DEEP_RESEARCH.md). Kept as the design record. Proposal of 14 October 2026. Studied: Odysseus' Deep Research
(AGPL-3.0, itself adapted from Alibaba's Tongyi DeepResearch, Apache-2.0).
**No code is copied**: RealmNest reimplements the ideas on its own layers (Web, Knowledge, Memory,
providers, tools, FileStore). Owner's decisions: search through **the provider and model chosen for the
research**; first version = **the whole package**.

## What Odysseus does, and what we keep or fix

Odysseus runs a fixed loop (IterResearch): plan → 3–4 queries → search → read ≤ 12 pages → one LLM
extraction per page `{rational, evidence, summary}` → rewrite the whole report → "stop?" → final long
Markdown report, which code wraps in a styled HTML page (TOC, hero/section images from og:image, stats,
category themes: product, comparison, how-to, fact-check; print to PDF; "Discuss" spin-off chat).

Kept (as ideas): bounded memory between rounds (plan + evolving report + dedupe sets, never the chat
history); goal-conditioned extraction with pages framed as untrusted data; category-driven report
structure and look; date grounding for "latest" questions; robust JSON recovery; graceful degradation;
live progress with a source graph and an ETA; clarifying questions before starting; Discuss.

Fixed: citations are free links the model writes and nothing checks them (summary of summary of
summary; evidence quotes are dropped); "Auto" never reaches its stop judge (runs end on the 5-minute
limit); timeouts and cancels lose the work; the report is padded on purpose (≥ 1500 words, "expand"
retry); one model does everything with no token or cost budget; progress keeps only the latest event;
search depends on scraping (SearXNG, DuckDuckGo); model-written HTML on the app origin.

## Search: the chosen provider's own web search

The research runs on one connection + model (like a chat). Its **native** web search finds pages; RealmNest
reads them itself through the Web layer (docs/WEB.md: SSRF guard, limits, JS pages, PDF, provenance).

| connection | search | notes |
| --- | --- | --- |
| Claude (account) | Claude Code's `WebSearch` tool, a headless turn with `--tools WebSearch` returning JSON results | verified 14 Oct 2026 (Haiku 5.5: 5 real results, 2 turns); uses the Max plan quota; the args allowlist (TS + Rust) gains this one tool for search turns only |
| Anthropic API | the server tool `web_search` in the Messages API (results as `web_search_tool_result` blocks) | billed per search on the key; the Rust Anthropic host passes this one server tool and parses the result blocks |
| OpenRouter | the `web` plugin / `web_search_options` (results as `url_citation` annotations) | paid per search; on a free account it fails and RealmNest says so |
| others / no search | none | the run uses only the addresses the user gives and the selected Knowledge bases, and says so up front |

Each is a `WebSearchEngine` behind the existing slot (`src/runtime/web/service.ts`), so `web_search` in
chats and agents gains the same engines for free, and every result keeps the engine's name in provenance.

## The engine (`src/runtime/research/`)

1. **Clarify (optional).** Up to 3 short questions in a chat-like step; the answers are folded into one
   research brief (affirmations like "go ahead" do not overwrite the brief).
2. **Plan, approved by the user.** Sub-questions (3–7), each with what would answer it, plus the report
   type (general, product, comparison, how-to, fact-check, timeline, landscape). Shown as an editable
   checklist before anything runs; "Start" accepts it.
3. **Rounds.** Per round: queries per open sub-question (deduped after URL/query normalization) →
   search with the chosen provider → URL selection with a per-query allocation, domain diversity,
   tracking-parameter-free dedupe → read through the Web layer (cache, budgets, approval rules) →
   **extraction** with a small model: `{relevant, sub_question_ids, claims[{text, quote, numbers}],
   published, kind: primary|secondary|opinion}`. Every quote is checked to exist verbatim in the page
   text (otherwise dropped), and stored with the page hash: the **evidence ledger**.
4. **Coverage, not a yes/no.** Each sub-question is "covered" when it has ≥ 2 independent sources (or 1
   primary source); rounds continue on uncovered ones until coverage, the budget, or two empty rounds.
   The working report is saved after every round.
5. **Knowledge as sources.** Selected bases are searched per sub-question (hybrid or lexical) and their
   passages enter the ledger as [K] sources next to [W] ones.
6. **Write from the ledger.** The writer gets the plan and the ledger (claims + quotes + source ids), not
   summaries of summaries, and returns **structured JSON**: title, summary, key findings, sections
   (paragraphs with `[n]` markers), comparison tables, a timeline, numeric series for charts (each value
   with its source), disagreements, open questions. No minimum length.
7. **Verify.** Every `[n]` must point to a ledger entry; numbers and names in a cited sentence must
   appear in its quotes (the lexical check of docs/KNOWLEDGE.md) and a short LLM pass marks claims as
   supported / partly / not supported. Unsupported sentences are flagged in the report, never silently kept.

**Roles and budgets.** Planner/writer = the chosen model (e.g. Opus 5.5 or Fable 5.1); reader/extractor =
a fast model of the same connection (e.g. Haiku 5.5), changeable. Presets Quick / Standard / Deep set
rounds, pages, time and a token or cost ceiling enforced on every call. Usage and cost are recorded.

**Never lose work.** Runs are persisted (plan, ledger, working report, event log) and resume after a
restart; Cancel keeps what was found and can still write the report.

**Security.** Pages, search results and Knowledge passages are untrusted data (same framing as the Web
layer); the model never writes HTML; Discuss seeds a chat with the report as data (not as a system
message); the run is owned by its user/agent; no prompt or page can start another research.

## The report

Rendered by RealmNest from the JSON (never model HTML), in a sandboxed page (no network access, no
model-controlled scripts):

- header: title, question, date, model(s), duration, sources read, coverage per sub-question;
- summary and key-findings cards; sections with numbered citation chips (hover: the quote, the source,
  when it was read); "Where sources disagree"; "What is still open";
- tables (comparison cells coloured from typed values, not regex), a timeline, charts drawn by code from
  the cited numbers (bar, line, ranking), each chart with its sources;
- category looks (product spec cards, comparison picks, how-to steps, fact-check verdict) on top of the
  app themes;
- images: og:images of read pages, downloaded through the Web layer and embedded, so opening a report
  contacts nobody; reroll / hide like Odysseus;
- sources list with type (primary / secondary / opinion), date, domain, what each supported;
- export: self-contained HTML, PDF (print), Markdown; save as an Artifact (FileStore) or into a
  Knowledge base; "Discuss" (a chat seeded with the report); "Dig deeper" (a new run that continues
  from the ledger).

## The screen and the world

- **Research** in the rail: new research (question, connection + model, reader model, preset, Knowledge
  bases, clarify on/off), the plan checklist, the live run (phase line, timeline of every event, source
  graph: question → sub-questions → sources, coverage bars, budget meters, ETA from past runs), Cancel /
  Write now, and the **library** (search, sort, archive, delete, reopen).
- **Agents.** `deep_research` becomes a tool (approval required, budgeted) so an agent can research inside
  a task; the run belongs to the agent and its record links to the task. In the world the agent walks to a
  bookshelf / desk and works while the run lasts; a bubble shows the phase.
- **Chat.** A research toggle in the composer starts a run from the conversation (clarify first); the
  reply is a report card with Open / Discuss / Dig deeper.
- Debug › Research: runs, events, calls, usage.

## Order of work and acceptance

1. Search engines (Claude account, Anthropic API, OpenRouter) in the web slot + allowlists; tests.
2. Engine: plan, rounds, ledger with verbatim quotes, coverage, Knowledge sources, roles, budgets,
   persistence and resume; tests with fake providers and pages.
3. Writer + verifier + report JSON; renderer, sandbox, charts, tables, category looks, exports.
4. Research screen + library + live run UI; chat toggle; Discuss / Dig deeper.
5. Agent tool, world animation, Debug › Research; docs (docs/DEEP_RESEARCH.md), CHANGELOG.
6. Acceptance on the release with the owner's Claude account: a product comparison, a fact-check, a
   how-to, a run with Knowledge + web, a cancelled and resumed run, an agent task, an OpenRouter run
   (expected to report no search credits), a page with prompt injection, export and Discuss.

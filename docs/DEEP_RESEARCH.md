# Deep Research

A question goes in, and RealmNest returns a report. Every fact in the report cites a numbered source that the run actually read. The report also carries the exact quote that proves the fact, and RealmNest checks the quote before it is shown.

RealmNest runs every step itself: the plan, the search, the reading, the evidence ledger, the writing, the check, and the report display. The models only answer the questions RealmNest asks them, in JSON that RealmNest checks.

The ideas come from Odysseus's Deep Research (an AGPL-3.0 project), which was studied but not copied. What changed and why is in [DEEP_RESEARCH_PLAN.md](DEEP_RESEARCH_PLAN.md).

## Where it lives

| | |
| --- | --- |
| domain | `src/domain/research.ts`: run, plan, sources (W1…, K1…), evidence (E1…), report, checks, presets, limits |
| engine | `src/runtime/research/service.ts`: the state machine, rounds, reading, writing, checking, persistence |
| prompts | `src/runtime/research/prompts.ts`: clarify, plan, queries, select, read, write, verify |
| checks | `src/runtime/research/report.ts`: report cleaning, `quoteIn`, `claimContext`, `lexicalCheck` |
| pictures | `src/runtime/research/pictures.ts`: layout, keeper, data for exports |
| exports | `src/runtime/research/export.ts`: Markdown and a self-contained HTML page; `report-toc.js` is the page's one script |
| tool | `src/runtime/research/tool.ts`: `deep_research` for chats and agents |
| search | `src/runtime/web/providerSearch.ts`: the connection's own web search as a search engine |
| native | `src-tauri/src/web` (`fetch_image`), `src-tauri/src/files` (`report_page`, `report_copy`, `pdf.rs`) |
| UI | `src/ui/screens/Research.tsx`, `src/ui/research/*` (new run, live run, report, Debug › Research) |
| tests | `src/tests/research.test.ts`; Rust tests in `files/tests.rs` and `web/tests.rs` |

## Search: the connection's own web search

A research runs on one AI connection and one model, the same way a chat does. Pages are found by that provider's native web search. RealmNest then reads each page itself through the Web layer ([WEB.md](WEB.md)), which applies the SSRF guard, the size limits, the JavaScript reader, and PDF and provenance handling.

| connection | search | notes |
| --- | --- | --- |
| Claude (account) | Claude Code's `WebSearch` in a headless turn (`--tools WebSearch --allowedTools WebSearch`) | Uses the plan's quota. The argument allowlist (TS and Rust) admits this one tool, only for search turns. |
| ChatGPT (account) | Codex's live web search in a one-off turn (`-c web_search="live"`; only the code-mode host it searches through stays on, every other Codex tool off), results from the `web_search` item's `results` | Uses the plan's limits: about 40,000 input tokens per search, most of them cached. The argument allowlist (TS and Rust) admits `live` only on a one-off turn without a session or RealmNest tools. ChatGPT answers bursts of requests with 429, after which Codex waits minutes before retrying: with ChatGPT every model turn of a research (searches and page reads) runs one at a time, a search with no results after 60 s is tried once more, and a turn Codex would hold for a long retry ends as rate-limited (see PROVIDERS.md). |
| Anthropic API | the server tool `web_search_20250305` | Billed per search on the key. |
| OpenRouter | the `web` plugin (`url_citation` annotations) | Paid. Without credits the run fails and says so. A connection that needs a model cannot start a research without one. |
| no search | none | The run uses only the selected Knowledge bases and says so up front. Without bases, it does not start. |

The results arrive as a `search.results` provider event, so they come from the search itself and never from text the model wrote.

The chat and agent `web_search` tool still has no engine (`SEARCH_PROVIDER_NOT_CONFIGURED`). Deep Research uses the engine through `WebService.searchWith`.

## A run, step by step

1. **Clarify** (optional; agents skip it). Up to 3 short questions. The answers are folded into the brief.
2. **Plan.** 3–7 sub-questions, each with:
   - what would answer it;
   - 2–4 search phrases in English and in the user's language (for Knowledge in another language).

   It also picks the report kind: general, product, comparison, howto, factcheck, timeline or landscape. The user edits the plan (removes, adds, rewords) and approves it. Agents' runs are approved automatically.
3. **Rounds**, until every sub-question is covered or the budget runs out:
   - **Knowledge**: each open sub-question, then its search phrases, are searched in the selected bases, up to a cap per round. Passages become K sources (type primary).
   - **Queries**: natural queries of 3–8 words, aimed at open sub-questions. The search budget is spread over the rounds.
   - **Search**: through the provider. Results are normalized and deduped, and addresses already read are skipped.
   - **Selection**: the reader model picks what to read, primary sources first. When it cannot, a fair share per query is taken, new domains first.
   - **Reading**: each page goes through the Web layer. The reader returns `{relevant, type, published, evidence[{subQuestions, claim, quote}]}`.
     - A quote that is not really in the page text is **dropped** (`quoteIn`: spacing, quote marks, dashes and accents aside).
     - The claim's numbers that the quote lacks get a **context**: a verbatim snippet RealmNest finds in the page around them (`claimContext`), never written by the model.
     - The page's preview picture is kept (see Pictures).
   - **Coverage**: a sub-question is covered with ≥ 2 independent origins (sites or documents; two pages of one site count once), or with 1 primary source.
4. **Write.** The writer sees the plan and the ledger: claims, quotes, contexts and source ids. It never sees summaries of summaries. It returns structured JSON:
   - title, summary, key findings, sections;
   - tables (cells with a typed tone), timeline, charts (every point with its source);
   - disagreements, open questions, verdict.

   Rules: every number comes from a quote or a context; there is no padding.
5. **Check.**
   - **Markers**: every `[W3]` or `[K1]` must be a source of the run; others are listed as invalid.
   - **Lexical check**: the numbers and codes in a cited sentence must appear in its sources. That means the quotes, the contexts, or the source's title, date or document name. The check treats 4,57 and 4.57 as the same, and "65/100" as the same as "65 points out of 100".
   - **Model check**: the reader model judges every cited sentence (in batches of 25, up to 100) against the quotes that matter most for that sentence. It answers supported, partial or unsupported. When it finds a sentence supported, a lexical flag on that sentence is a matter of form and is dropped.

   Flagged sentences are marked in the report with the reason. They are never silently kept or removed.

**Roles.** The planner and writer is the chosen model. The reader (selection, reading, checking) is a faster model of the same connection, by default Haiku 5.5 on Claude, and the user can change it.

**Budgets.** The presets Quick / Standard / Deep set rounds, searches, pages per round, pages, minutes and tokens. The tokens counted are input plus output, including new text written to a prompt cache. Every call is counted. Writing and checking always run, even after the budget is spent. Usage and cost are recorded on the run.

**Never lose work.**
- Runs are saved as they go: `research-index` and `research-run.<id>`, at most 60 runs.
- A run that was working when RealmNest closed comes back as **interrupted**, and Resume continues it.
- Cancel keeps what was found, and Write now writes the report from it.

## The report

RealmNest renders the report from the JSON. The model never writes HTML.

- **Contents on the left.** It follows the reading: the part whose heading is in the upper third of the view is lit, and the last part when the page is at its end. A click scrolls there. The contents column is hidden when the report column is narrow.
- **Citation chips.** Numbered in order of first use. Hovering shows the source and its quotes (and contexts). A click opens the page in the system browser, or the document in Knowledge.
- **Flagged sentences** are underlined, with the reason on hover. A line above the report says how many there are.
- **Other parts:** summary, verdict, key findings, sections, tables (coloured by typed tone), timeline, charts drawn by RealmNest from cited numbers, "where sources disagree", "still open", and sources (type, date, domain, quotes, the query that found it).
- **Pictures.** See the next section.
- **Actions** (borderless; the outline appears on hover):
  - **Open in browser**: the page is written to `Documents\RealmNest Exports\Reports` and opened in the default browser.
  - **Export PDF**: a save dialog, then a PDF printed by WebView2.
  - **Export HTML**: kept as an Artifact, plus a copy where the user chooses.
  - **Save to Knowledge**: the report as Markdown in a chosen base.
  - **Discuss in chat**: the report becomes a document in a "Deep Research" base, and a new chat answers from it in Grounded mode.
  - **Dig deeper**: a new research seeded with the open questions.
  - **Copy Markdown**.

### Pictures

Report pictures are the **preview pictures (og:image / twitter:image) of the relevant pages the run read**. They are not generated. This is the same idea as Odysseus, with these differences:

- **Placement by what the report cites.**
  - The cover comes from the most cited source.
  - A section gets the picture of the source that section cites most.
  - A picture is never shown twice (pictures are deduplicated by content).
  - Two sections in a row never both get an automatic picture.
- **Kept, not hot-linked.**
  - The Web layer fetches the picture under the same rules as pages (`web_fetch_image`), then checks it:
    - raster formats only (PNG, JPEG, WebP, GIF, AVIF); never SVG, which can hold script;
    - at most 4 MB;
    - the first bytes must match the format, because the declared type alone is not trusted.
  - RealmNest decodes it and refuses icons, logos and strips. A preview is landscape, at least 360×180, with an aspect ratio between 1.1 and 3.2.
  - It is re-encoded as WebP at most 1200 px wide, so no metadata and nothing active is left, and stored in the FileStore. At most 16 pictures are kept per run.
  - Opening a report never contacts the sites again. The file store's cleanup knows these files (`ResearchService.storageRefs`).
- **The user's choices.**
  - **Another picture** swaps in an unused one.
  - **Hide** removes it from this report; it does not come back in another place.
  - **Show hidden pictures (n)** restores the defaults.

  The choices are saved on the run (`pictures`, `picturesHidden`).
- **Captions** credit the source ("Picture from <title> · domain") and link to it. The pictures belong to their sites: they are fine for a private report and need care before publishing.

### The page outside the app (Open in browser, Export HTML, PDF)

The HTML page is self-contained:
- the text is escaped;
- the pictures are carried inside the page as `data:` addresses;
- charts are SVG drawn by RealmNest;
- the contents column is sticky;
- print styles are always light, without the contents column, and avoid breaks inside pictures and tables.

It contains **one script**, `report-toc.js`: the contents follow the reading. The page's policy allows that script by its SHA-256 hash and nothing else.

When the native side opens or prints a page (`report_page`), it puts its own policy first in `<head>`. That policy allows:
- no connections;
- inline pictures only;
- no frames, forms or base URL;
- no script except the one with the same hash. The hash is computed from the same file through `include_str!`, and a test on each side checks the shared value.

Because both policies apply, nothing in a page can loosen them. Only RealmNest's export is accepted: a page must start with `<!doctype html>` and have a `<head>`.

The PDF comes from a hidden, short-lived, InPrivate WebView2 window:
- It may show that one file and nothing else. Other navigations, sub-requests (`data:` aside), downloads, pop-ups and permissions are refused.
- WebView2's `PrintToPdf` writes the file: A4, backgrounds on, no browser header or footer.

## Agents and chat

`deep_research` is a native tool:
- **Inputs**: `question`, `depth` (quick / standard / deep).
- **Settings**: risk medium; it **asks for approval** by default; timeout 40 minutes.

It runs on the same connection and model as the chat turn or agent task that called it. It skips clarification and plan approval, and returns the report as Markdown with numbered sources, framed as information from the web and not as instructions.

The run belongs to the agent (`owner`) and appears in the library as "by an agent".

In the world, the agent shows `Research · <step>` as its activity, with a magnifier bubble while it searches and reads, and an idea bubble while it writes. Bubbles now sit above the head of the Cast figures.

**Debug › Research** shows, for each run:
- status, round, searches, pages, irrelevant pages and Knowledge passages;
- evidence (with contexts and dropped quotes);
- the lexical and model checks;
- calls, tokens and cost.

It also lists the latest run's queries and warnings.

## Security

- Pages, search results, snippets and Knowledge passages are **untrusted data**, framed and neutralized as in the Web layer. A page that tells the model to do something is ignored. The acceptance test used `injection.md`: "reply PWNED…" was ignored, and its contract number was still used as evidence.
- The model never writes HTML. Charts are SVG built by RealmNest. Every text in the report and the exports is escaped.
- Quotes must be in what was read. Contexts are cut by RealmNest from the page. Numbers come only from quotes and contexts.
- The only network the report ever needs is the reading: pictures are kept copies.
- No prompt or page can start a research. The tool asks the user first.

## Acceptance on the release (14 October 2026, Claude account)

| scenario | result |
| --- | --- |
| product comparison (robot vacuums for a flat with a cat, Quick) | before the check fixes: 22–24 flags, mostly format; after: 0 unsupported, 13 partial (real nuances: a quote that does not name the model) |
| fact-check by an agent (JWST mirror) | Hana, `deep_research` approved once: 4 sources, verdict "Supported, with wording caveat"; NASA's 20 kg vs Big Think's 21 kg listed as a disagreement |
| how-to (Home Assistant on a Pi 5, Standard) | 15 sources, 84 evidence entries, report in 8 steps |
| Knowledge + web + prompt injection (Project Aurora) | 12 Feb vs 20 Mar 2027 recognized as a disagreement; VC-3310 found in `injection.md` (once the search phrases existed), with the note that the document does not tie it to Aurora; PWNED ignored |
| closed mid-run, then reopened | both running runs came back as Interrupted; Resume finished them |
| editing the plan | removed sub-questions, renumbered, run as edited |
| OpenRouter | without a model: refused in the form; with `openrouter/auto`: "This OpenRouter key has no credits left" |
| agent's comparison (USB4 v2 vs Thunderbolt 5) | 10 sources, 53 evidence entries; the agent answered in 5 lines with numbered sources |
| pictures (mirrorless cameras) | 4 of 4 pictures kept (1200 px WebP); cover and two section pictures placed by citations; Another / Hide / Show hidden tested |
| exports | Open in browser in Firefox (owner) and Edge; contents follow the scroll in the browser (checked by driving Edge and Firefox; an unknown CSS selector had voided the highlight rule in Firefox); PDF of 9 A4 pages with cover, light colours, no contents column |

## Known limits

- Some sites refuse automated reading (login, paywall, bot protection). RealmNest does not get around that, and the run says which ones.
- Model checks can flag genuine syntheses (for example "the most complete option") as partial. That is the intended strictness.
- A site that uses one generic preview picture for all its pages gives that picture once.
- Runs made before 14 October evening have no pictures, because pictures did not exist yet.
- The PDF is larger than the HTML, because WebView2 stores pictures decoded.
- The chat and agent `web_search` tool still has no engine. Deep Research does its own searching.

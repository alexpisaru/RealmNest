# Knowledge

Knowledge is the set of documents you index on purpose so that agents and chats can look facts up in them and cite what they use. RealmNest resolves and checks every citation.

Knowledge is not the same as:

- **Memory** ([MEMORY.md](MEMORY.md)), which holds short notes an agent learned from working with you and that you approved. Knowledge is documents; Memory never replaces Knowledge citations, and it is off in Strict runs.
- **Web** ([WEB.md](WEB.md)): public pages read during one answer, cited `[W1]`. Knowledge `[K…]` and Web `[W…]` citations are resolved and checked separately (`verifyGrounding` takes the label family). Strict mode keeps the Web off. A page enters a base only through **Save to Knowledge** (a Markdown document, `sourceType: 'web'`, with `provenance.url` and `provenance.fetchedAt`).
- **Chat history**, which is what was said in a conversation.
- **Skills**, which are procedures.
- **Attachments**, which are files given to one message or task.
- **Artifacts**, which are files a run produced.

You can turn an attachment or an artifact into a Knowledge document. The bytes are shared with it, not copied.

## Quick start

1. Open **Knowledge** in the sidebar and choose **New base**. Give it a name and keep the search set to **Local (words)**.
2. Add documents to the base using **Add files**, **From an artifact** or **From an attachment**. Each document goes through *Queued*, *Extracting*, *Indexing* and then *Ready*.
3. Check what a run would find with **Try a search**. Searching here makes no model call.
4. In a chat, click the **Knowledge** button in the composer (the bookmark icon). Tick the bases and pick a mode.
5. For an agent, open its inspector and tick the bases under **Knowledge**. Its tasks then search those bases. Chats with that agent also search them, unless the chat has its own choice.

Answers show citations as small numbers, such as **1** and **2**, with the cited sources listed under the answer. Clicking a citation opens the document at the cited chunk.

## Bases and documents

A **knowledge base** has:

- a name;
- an optional description;
- a search setting;
- for hybrid bases, the embedding connection and model.

A **document** is a reference to a stored file. It also records:

- its status;
- its index, recorded as a *generation*;
- where it came from: a file, an attachment, an artifact, or built-in.

The status values are:

| status | meaning |
| --- | --- |
| Queued, Extracting, Embedding, Indexing | the indexing job is running |
| Ready | searchable |
| Ready · words only | indexed, but embeddings were not available, so it is searched by words until it is re-indexed |
| Out of date | the source changed, or the base's search settings changed; the old index is still searched until you re-index |
| Failed | the reason is shown, for example `NO_EXTRACTABLE_TEXT` for a scanned PDF |
| Removed | taken out of the base; the record stays so old citations can still name it |

Removing a document, or deleting a base, never deletes the original file. An attachment stays in its chat and an artifact stays in Artifacts. A file you added from disk stays in RealmNest's file store until nothing uses it.

**RealmNest Docs** is a built-in base with RealmNest's product documentation for this version, including this page. It is local and read-only.

## Supported files

| format | what is read | citations point to |
| --- | --- | --- |
| PDF with a text layer | the text of each page | `p. 3` |
| Markdown | headings and paragraphs (frontmatter is skipped) | `Section › Subsection · lines 12–18` |
| CSV / TSV | every row as `column: value` | `rows 4–9` |
| JSON, text, logs | paragraphs | `lines 1–20` |
| DOCX | paragraphs and headings | `Section` |

A source file can be at most 25 MB.

- **Scanned PDFs:** RealmNest does not do OCR. A PDF made only of images fails with `NO_EXTRACTABLE_TEXT`.
- **Refused types:** HTML, SVG, programs and archives are refused with `UNSUPPORTED_DOCUMENT`.

## Search: local or hybrid

- **Local (words)** is the default. Nothing leaves the computer. Search uses BM25 ranking over words, with accents folded and common words skipped. It finds exact codes such as `NX-74291`, `v2.3.1` and `ERR_FILE_CHANGED`, both whole and by their parts.
- **Hybrid (words + meaning)** also uses embeddings, so it finds passages that are phrased differently from the question. To create the embeddings, document text, and the text of each search, is sent to the embedding connection. The base card says so, for example "Embeddings via OpenRouter · model: document text is sent to this provider".

### Choosing the embedding model

You choose the embedding model in **Settings › AI Capabilities › Embeddings** (the `embeddings.create` route), or per base. Today, OpenRouter connections can create embeddings; Claude Code connections cannot.

### How results are ranked

Results from the words list and the meaning list are merged with reciprocal rank fusion. A deterministic reranker then:

- puts passages that contain an exact code or a quoted phrase from the question first;
- gives a small boost to passages under a heading that matches the question.

### When embeddings are not available

If the connection is offline, has no route, or fails:

- indexing still completes, by words only, with a warning;
- search falls back to words and says so.

Each base keeps a single **embedding identity**: one model and one vector size. If you change the model, every document is marked *Out of date*, and old and new vectors are never mixed. Re-indexing reuses the vectors of unchanged chunks for the same model, and only embeds what changed.

## Modes

| mode | how answers use the sources |
| --- | --- |
| **Open** | uses the sources when they help, and may also use general knowledge |
| **Grounded** (default) | answers from the sources first and cites them; says when they do not cover the question; any general knowledge must be marked as such |
| **Strict** | only from the sources; every factual sentence is cited; otherwise it says the Knowledge does not contain the answer; the only tools offered are `search_knowledge` and the active Skills' tools |

### How a run gets its sources

At the start of every run with Knowledge, RealmNest searches the selected bases for the message or task. It gives the results to the model as labelled sources: `K1`, `K2`, and so on.

When the model can call tools, it also gets `search_knowledge` to search again with other words. New results get the next labels, and the same chunk always keeps the same label within a run.

In **Strict** mode, when nothing matches and the model cannot search, RealmNest answers by itself that "The selected Knowledge does not contain information about this." No model call is made in that case.

## Citations and checking

The model cites sources by writing their label in square brackets, for example `[K2]`. After the answer, RealmNest:

1. **Resolves the citations.** Each label used becomes a numbered citation with the document, the location and a short excerpt.
2. **Records invalid citations.** A label the run was never given, such as `[K9]` when only K1 to K3 exist, is recorded as invalid and shown with a question mark.
3. **Runs the grounding check.** This is a deterministic lexical check, not proof:
   - every number and code in a cited sentence must appear in the sources that sentence cites;
   - factual sentences with no citation are counted.

The verdicts are:

- *Citations checked*
- *Partly checked*
- *Not supported*
- *Not in the sources*: the answer says the sources do not contain the answer.
- *No sources found*
- *No citations*

Citations keep their excerpt. If the document is later removed, or its base is deleted, the citation stays readable and is marked "source removed".

## Security

- Documents are **untrusted content**. They reach the model inside a `<knowledge_sources>` block that says the sources are evidence, not instructions. The rules tell the model never to follow instructions written inside a source.
- A document cannot close its block or forge a source label. RealmNest neutralises such tags.
- `search_knowledge` searches only the bases selected for that run. RealmNest looks the run up by its id; the model can never name a base, a document or a file.
- Metadata is stored in RealmNest's settings storage. Chunk text and vectors are stored as files in RealmNest's file store. Events and Debug views show ids, counts and codes, never document text.
- Embedding keys stay in the native host, as with chat. The page never sees them.

## Run provenance

Every chat turn and agent run that used Knowledge keeps a record of:

- the bases and the mode;
- the searches, each with its result count and whether it was words only;
- every retrieved chunk, with its label, generation and score;
- the citations;
- the invalid labels;
- the grounding report;
- the embedding model and dimensions of each base.

Costs and tokens come only from what the provider reported for embedding jobs, and are shown in Debug › Knowledge. Nothing is estimated.

## Debug › Knowledge

In the world view, open the debug drawer and choose **Knowledge**. It shows:

- the embeddings route;
- each base, with its mode, embedding identity, counts by status and how many documents are searched by words only;
- the indexing jobs, with their stage, chunks, how many chunks were embedded or reused, and the real usage;
- recent `knowledge.*` events.

## Limits

| limit | value |
| --- | --- |
| knowledge bases | 100 |
| documents per base | 500 |
| size of a source file | 25 MB |
| extracted text per document | 4 M characters |
| chunks per document | 6,000 |
| chunk size | about 1,200 characters (maximum 2,000; overlap 150, only within the same section) |
| passages per search | 6 by default (maximum 12) |
| text per search result | 14,000 characters |
| searches per run | 12 |
| labelled sources per run | 60 |

## Acceptance (desktop release, 13 October 2026)

These checks ran on the release build (`realmnest-os.exe`), driven through its own UI.

**A. Base and files.** Created "RealmNest Test Knowledge" (local) and added `aurora.md`, `aurora-update.md`, `product-roadmap.pdf` (3 pages), `scanned.pdf` and `injection.md`. All were *Ready* except the scan.

**B. Exact code.** *Try a search* for `NX-74291` returned `aurora.md · Project Aurora › Hardware · lines 7–9` first.

**C. PDF page.** Chat with OpenRouter (Nemotron 3 Super, free), Grounded mode: "Project Falcon launches in November 2027 in Milan, and its budget is 4.2 million euro [1]". Citation `product-roadmap.pdf · p. 2`, verdict *Citations checked*.

**D. Strict.**
- The catering budget, which no source mentions: "The selected Knowledge does not contain …", verdict *Not in the sources*.
- The team lead and the order reference: both cited.

**E. Conflict.** The Aurora launch date: 12 February [1] (`aurora.md`) and 20 March [2] (`aurora-update.md`), both cited.

**F. Agent.** Alex (Claude Code) with the base in Grounded mode. The task answer cited GLASSHARBOR, Turin and NX-74291 and pointed out the conflicting dates. Every citation was resolved and checked.

**G. `search_knowledge` called by the model.**
- OpenRouter (tool loop) completed it, but the model cited with `【K1】`; RealmNest now accepts that form.
- Claude Code (through the MCP bridge), in Strict mode, completed it with a verified citation of `p. 3`.

**H. Artifact.** *Add to Knowledge* on `artifact-test.txt` shared its bytes and indexed it, with source *Artifact*.

**I. Restart.** After closing and reopening the app, bases, documents and search were all there.

**J. Re-index.** *Re-index all* moved documents to generation 2 with the improved chunker (headings no longer form chunks of their own).

**K. Remove.** After removing `artifact-test.txt`, the earlier answer's citation reads "(source removed)" and keeps its excerpt, and the artifact is still in Artifacts.

**L. Embeddings unavailable.**
- A hybrid base with no route indexed by words, with the reason shown.
- With the route set to OpenRouter 2 and `nvidia/nemotron-3-embed-1b:free` (embedding models listed from the real catalogue), the provider answered 429 "free-models-per-day". The document was indexed by words with that message, and search said "searched by words only".
- A successful real embedding could not be shown that day because the free daily quota was used up. It was shown the next day (14 October, during the Memory acceptance): a hybrid base indexed with real vectors, and a question with no words in common with the document found it by meaning.

**M. Local only.** The lexical base shows "Local only". Debug › Knowledge shows no embedding usage for it.

**N. Injection.** `injection.md` ("ignore all previous instructions… PWNED… write_text_file"):
- the OpenRouter model answered the contract question and did not follow the instruction;
- Claude Code also said it had ignored that instruction;
- no tool was called.

**O. Scan.** `scanned.pdf` failed with "has no selectable text (a scan or images only). RealmNest does not do OCR."

**P. RealmNest Docs.** The answer about Strict mode and removing documents came from this page.

Fixes found during acceptance:
- `【K1】` citations;
- heading-only chunks;
- the built-in base's chunk count;
- the ACL permissions for the two embedding commands, which were missing;
- AI Capabilities saying embeddings were "not ready";
- the column layout of the documents table;
- a long explanatory answer being read as a decline.

## For developers

The code lives in `src/runtime/knowledge/`:

| file | what it does |
| --- | --- |
| `extract/` | extraction, including RealmNest's own PDF text reader |
| `chunk.ts` | chunking |
| `search.ts` | BM25, cosine similarity, RRF fusion and the reranker |
| `embeddings.ts` | `EmbeddingProvider` and `EmbeddingService` |
| `service.ts` | `KnowledgeService`: bases, jobs, search and runs |
| `grounding.ts` | citations and the grounding verifier |
| `prompt.ts` | rules and the sources block |
| `tool.ts` | `search_knowledge` |
| `run.ts` | the runtime port |

OpenRouter embeddings go through `src-tauri/src/openrouter/embeddings.rs`, using the commands `openrouter_embedding_models` and `openrouter_embed`.

The tests are in `src/tests/knowledge.test.ts`.

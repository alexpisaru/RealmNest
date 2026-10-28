# Chat

Persistent text conversations with an agent or directly with a provider. The chat layer is provider-independent. Only Claude Code is wired today: OpenAI, Ollama, Gemini and others plug in through the same provider contract, and Chat does not change.

```
 ChatScreen (src/ui/screens/Chat.tsx)          only shows state and forwards actions
      │ create / send / stop / configure / startNewSession
      ▼
 ConversationRuntime (src/runtime/chat)  ──▶ ConversationRepository (StorageAdapter, key "conversations")
      │ run({ messages, session, systemPrompt, model, workspace })
      ▼
 ProviderService ──▶ AIProvider (Claude Code: --resume inside the adapter) ──▶ ProcessRunner
      │
 EventBus: conversation.created · conversation.message.added · conversation.run.started/completed/failed/cancelled
           conversation.output.delta (delivered, never logged)
```

## Concepts (`src/domain/conversation.ts`)

| concept | what it is |
| --- | --- |
| **Conversation** | a persistent thread. Fields:<br>• `title`<br>• `agentId?`<br>• `connectionId` (the AI connection; `providerId` = its kind, kept for history), `model?`<br>• `workspace?` (fixed at creation)<br>• `providerSession?`<br>• `messages` |
| **ChatMessage** | one entry. Fields:<br>• `role`: `user`, `assistant` or `system`<br>• `content`: plain text, never the provider's raw payload<br>• `status`: `complete`, `streaming`, `failed` or `cancelled`<br>• `runId`<br>• `error?` |
| **ConversationRun** | one provider turn. Fields:<br>• the user and assistant message ids<br>• `status` (same state machine as task runs)<br>• `resumed`<br>• timestamps, error, usage, cost |
| **ProviderSessionInfo** | the provider's own memory of the thread: `{ providerId, id (opaque), state: 'active' \| 'lost' }` |

**Chat is not work.** A chat turn is a `ConversationRun`, not an `AgentTask`. It never makes a character walk to a desk; that stays `LiveRuntime`'s job (see [RUNTIME.md](RUNTIME.md)). Later, a conversation may spawn tasks.

## Agent chat and direct chat

- **Agent chat** (`agentId` set):
  - provider, model and workspace come from the agent when the conversation is created;
  - every turn carries the agent's system prompt: who it is (from its Character) plus its instructions. They are runtime configuration, never stored as messages.
- **Direct chat** (no agent): a saved AI connection and a model, chosen in the header. There is no agent prompt. See [CONNECTIONS.md](CONNECTIONS.md).

The provider list in the header is built from the `ProviderRegistry`. The provider is fixed once the conversation has started, because a session belongs to one provider. The model can change between turns.

## Provider sessions

The provider contract has one neutral concept, `ProviderSessionRef` (`src/runtime/providers/types.ts`):
- `{ mode: 'new' }`: open a session the provider keeps. Its id arrives in `session.started` / `run.completed`.
- `{ mode: 'resume', id }`: continue that session. Only the new user message is sent.
- no ref: a one-off turn, nothing kept. Task runs use this.

`ConversationRuntime` decides from the provider's capabilities:
- **`capabilities.sessions`** (Claude Code): `new` for the first turn, then `resume` with the stored id. The provider does the remembering.
- **No sessions** (future stateless APIs): the whole history of completed user and assistant messages is sent each turn.

**Inside the Claude adapter:**
- `new` → no `--no-session-persistence`, so Claude Code keeps the session under an id it reports.
- `resume` → `--resume <id>`. The id stays the same, as checked with the real CLI.
- The adapter keeps no state, so a session can be resumed after a restart.

Claude Code stores sessions per working directory, so a conversation keeps the workspace it started with.

### A session the provider lost

If Claude Code cannot resume (for example its history was deleted):
1. It prints `No conversation found with session ID`.
2. The adapter reports `run.failed` with the neutral code `session_not_found`.
3. `ConversationRuntime` marks the session `lost` and refuses further turns, so the model never answers without its context as if nothing happened.
4. The UI offers **Continue with a new session**. That adds a system note ("the model does not remember the messages above") and the next turn opens a new session. Nothing is merged silently.

## Streaming

`text.delta` makes the assistant message (status `streaming`) grow live. `run.completed` finalizes it, using the provider's final text. Storage writes are coalesced: one write per second while streaming, plus an immediate write at every status change (`src/persistence/coalesced.ts`, shared with `LiveRuntime`).

## Stop, failures, retry

- **Stop:** `ConversationRuntime.stop(id)` → `ProviderRun.cancel()` → `AbortSignal` → process runner → the native process tree is killed.
  - The partial reply stays, marked `cancelled`.
  - The run is `cancelled`, and nothing completes after it.
  - The next turn works, in the same session.
- **Failure:**
  - The user message is kept; the assistant message becomes `failed`, with the provider's message and detail.
  - The run is `failed`.
  - The session stays `active` unless the provider said it lost it.
  - **retry** sends the same text again as a new turn.
- **Restart during a reply:** on load, the message comes back `failed` / `interrupted`.

## Isolation and concurrency

- **Isolation:** each conversation has its own provider session; there is no global session. Two conversations with the same agent do not share context, which was checked with the real CLI.
- **Concurrency:** one turn at a time per conversation; different conversations can run at once.

## Persistence (`src/runtime/chat/repository.ts`)

- **What:** conversations (messages, provider and model, session reference, timestamps) and runs, under the storage key `conversations`.
- **Bounds:** the 200 most recently used conversations are kept, and messages are capped at 100k characters.
- After a restart, conversations come back and continue in the same provider session.

## UI (`src/ui/screens/Chat.tsx`)

The layout, the composer, the AI picker and the history drawer are described in [UI_UX.md](UI_UX.md#chat-srcuiscreenschattsx-srcuichat).
- **Messages.** `**bold**` and `` `code` `` are rendered as React elements (never HTML); everything else is plain text.
- **Composer.** Enter sends, Shift+Enter adds a new line. Send becomes **Stop** while a reply is written.
- **Titles.** The first user message, cut at a word boundary; optionally a short AI title after the first reply (Settings › General, off by default). A renamed title is never replaced.
- **Conversations** can be renamed, pinned and deleted from the header or the history drawer.

**Auto:**
- When the user has set a chat route (Settings › AI Capabilities), the composer's AI picker defaults to **Auto** and shows where it resolves ("Auto · Nemotron 3 Super"). The new conversation resolves `text.chat` once and records `routedBy`.
- The conversation header then says "Auto · default chat route" (or "fallback route").
- A connection chosen by hand always wins.
- A failing route blocks the chat with its reason and never falls back silently. See [CAPABILITIES.md](CAPABILITIES.md).

**Capabilities:** features appear only when RealmNest can run them (`ready`); no fake buttons are shown.

**Skills:** the composer's **Skill** picker (optional, per conversation) activates a Skill for the next messages. Its instructions join the system prompt, its tools are offered even with the Tools switch off, and each turn records the Skill and version. See [SKILLS.md](SKILLS.md).

**Tools:** the composer's **Strumenti** switch offers RealmNest tools (workspace files, time) to the model from the next message on. It is off by default, stored per conversation, and disabled when the model cannot call tools (Claude Code today). Each call shows under the reply with its status; `ask` tools open the approval prompt. See [TOOLS.md](TOOLS.md).

## Attachments

The composer's **+** (or drag and drop, or pasting an image) adds files to a message. The domain lives in `src/domain/attachment.ts`; storage, import, limits and security are in [FILES.md](FILES.md).

| kind | files | how it reaches the model |
| --- | --- | --- |
| text | text and code (`.md`, `.csv`, `.json`, `.ts`, `.py`…), up to 100 KB | written into the message as `<attachment name="…">` blocks, for every provider |
| image | PNG, JPEG, WebP, GIF, up to 5 MB | Claude Code: an `image` content block; OpenRouter: an `image_url` part with a data URL |
| pdf | PDF, up to 10 MB | Claude Code: a `document` block; OpenRouter: a `file` part with a data URL |

**Limits.** At most 4 files and 15 MB per message.

**Content decides.** A file whose content contradicts its name is refused with the reason, for example a program renamed `.pdf` or text renamed `.png`.

**Per-file states.** Every file reads and is stored on its own, with its own loading or error chip. Send waits for the files still loading.

**Who can take what.**
- **Adapters.** The adapter must declare it: `capabilities.vision` for images, `capabilities.files` for PDFs.
- **The chosen model.** The composer and the runtime refuse a file the model cannot take, using the Capability System: "Nemotron 3 Super non accetta immagini". PDFs go only to models whose catalogue says they read files themselves.
- **When.** The check runs when files are added and again when sending.

**Kept across restarts.** Bytes live in the FileStore, and the message keeps only a reference (`storageRef`).
- **History replay** to providers without sessions sends earlier files again within an 8 MB budget. Over the budget, a note stands in.
- **Retry** sends the same stored files again.
- **A file deleted from the store** fails the new message with a clear reason.

**Claude Code transport.** A turn with images or PDFs uses `--input-format stream-json` (allowlisted in both hosts). stdin is one JSON user message with base64 content blocks.

**OpenRouter transport.** The Rust host accepts content parts only on user messages. It takes only inline `data:image/(png|jpeg|webp|gif)` and `data:application/pdf` URLs, so it never fetches a URL for the page.

**What a reply produced** appears under it as [Artifacts](FILES.md#artifacts).

## Claude Code and its own prompt

With no tools enabled, Claude Code's default agentic prompt made the model act out tool calls and memory lookups as text (`<invoke name="Bash">…`). Turns without tools therefore **replace** that prompt (`--system-prompt`) with a short plain-assistant prompt plus the caller's system prompt. Turns with tools (later) will append to Claude Code's own prompt instead. This lives in `claude-code/args.ts` and is allowlisted in both hosts.

## Knowledge

The composer's **Knowledge** button (bookmark icon) picks the bases a chat searches and the mode (Open, Grounded, Strict). A chat without its own choice uses its agent's bases. Each turn retrieves passages for the message before the provider call; they travel with the message (never stored in it) as a `<knowledge_sources>` block with labels K1…, and `search_knowledge` is offered when the model calls tools. The answer's `[K2]` become numbered citation chips with a sources list and the grounding verdict under the reply; the record is `ConversationRun.knowledge`. See [KNOWLEDGE.md](KNOWLEDGE.md).

## Memory

Chats with an agent use that agent's memory ([MEMORY.md](MEMORY.md)):
- its approved memories relevant to the message travel with the message, never stored in it, as `<memory>` context below the current user message;
- after the reply, a line may say **N memories proposed · Review**, and nothing is saved until you choose Remember;
- replies show **Used N memories**, which you can open.

Direct chats (RealmNest, without an agent) have no memory. `ConversationRun.memory` keeps what was given.

## Web

The composer's **globe** switches the Web on or off for a chat (`Conversation.web`); a chat about to start keeps the choice and applies it when created. Unset, an agent chat follows the agent's **Web access**, and a direct chat is off. With the Web on:
- the turn gets the **# Web** rules and `web_fetch` (+ `web_search`) when the model calls tools; otherwise the addresses in the message (up to 2) are read for the model;
- the answer's `[W2]` become green citation chips that open the page in the system browser, and **Pages read** under the reply lists every page read, with **Save to Knowledge**;
- tool rows show the address read (`web_fetch`) or the query (`web_search`).

Strict Knowledge keeps the Web off for that chat. `ConversationRun.web` keeps the record. See [WEB.md](WEB.md).

## Next steps this foundation is ready for

Provider-native tools, image generation, Telegram (attachments, artifacts, RealmNest tools, memory and web reading are built; web search waits for a compliant engine):
- **Messages** can gain parts or attachments without changing runs.
- **Capabilities** drive which UI appears.
- **The runtime** only hands requests to `ProviderService`.

## Known limitations

- Text only (no images in answers). Answers are drawn from Markdown (`src/ui/chat/Markdown.tsx`): headings, lists, tables, quotes, code blocks with Copy, links that open in the browser. Never HTML; raw HTML in an answer stays text.
- One turn at a time per conversation; there is no message queue.
- No renaming of conversations. Titles are not generated by a model.
- **Agent edits:** Claude Code records a session's system prompt on its first turn. Editing an agent's instructions later affects new conversations, not resumed ones.
- **Separate histories:** chat history lives in the WebView's storage, so dev and the desktop app keep separate conversations.

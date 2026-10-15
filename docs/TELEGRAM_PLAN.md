# Telegram: plan

Status: design of 15 October 2026, **built** the same day (how it works now: [TELEGRAM.md](TELEGRAM.md)). From the owner's outline, with these decisions:
- a **remote control and messaging bridge** to RealmNest, not a bot that holds the intelligence;
- **long polling** (`getUpdates`), no webhook: no domain, HTTPS, port forwarding or cloud; the bot works while RealmNest is open on the PC;
- it lives in **Settings › Integrations › Telegram**, not among the AI connections;
- free text with no agent chosen goes to a **concierge on the Chat route**;
- **notifications are configurable** (default: only the important ones).

```
Telegram ──▶ Bot API ◀── long polling ── RealmNest Telegram bridge (Rust: token, polling, sending)
                                              │ updates from paired users only
                                              ▼
                                   TelegramBridge (TS): commands, context, concierge
                                              │
                         Agents (LiveRuntime) · Crews · Workflows · ToolRuntime approvals · Artifacts
```

## Setup (the user)

Settings › Integrations › Telegram:
1. Create a bot with **BotFather** (Telegram) and paste its token once. It goes to the OS credential store (`telegram.botToken`); the webview never gets it back.
2. **Verify**: `getMe` shows the bot's name (`@RealmNestAlexBot`).
3. **Start** polling. Status: running · stopped · error (with the reason).
4. **Pair**: RealmNest shows a code (6 digits, valid 10 minutes). In Telegram: `/start 483921`. RealmNest stores the **numeric** user id and chat id (never the username, which can change) as an authorized user: `Alex — 12345678 — Owner`. Users can be removed.
5. **Notifications**: one switch per kind (below).

Creating the bot is not automated in v1.

## Security

- Only paired user ids are served. Every other update is dropped in Rust before it reaches the app (a `/start <code>` is accepted only while a pairing code is open, and only with the right code; wrong codes are counted and the code is closed after 5).
- Telegram is **not a shortcut**: a message becomes ordinary user input. An agent's tools go through the same ToolRuntime, with the same permissions and approvals as the desktop. The requester shown in approvals is "Telegram".
- Rust talks only to `https://api.telegram.org/bot<token>/<method>` for a fixed list of methods (`getMe`, `getUpdates`, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `sendDocument`, `getFile`) and to `https://api.telegram.org/file/bot<token>/<path>` for a file the bot was sent. No redirects, size limits, timeouts; the token never appears in logs, events or errors.
- Incoming files are untrusted data: size-limited (20 MB, Telegram's own limit for bots), checked by content like every attachment, stored in the FileStore.

## Talking to RealmNest

Per chat, a **context**: none, an agent, or a crew.

**Commands**

| command | does |
| --- | --- |
| `/help` | the list |
| `/status` | who is working on what, open runs, what waits for you |
| `/agents`, `/crews`, `/workflows` | lists (with buttons to pick one) |
| `/agent Kenji` | from now on, messages go to Kenji |
| `/crew Marketing` | messages go to the crew's coordinator (a new run with the message as goal, or feedback on the open run) |
| `/run <workflow>` | starts a workflow (asks for its inputs one by one) |
| `/tasks` | the current tasks and runs |
| `/cancel` | stops what this chat started last |
| `/approve`, `/reject` | the oldest thing waiting for you |
| `/end` | back to no context |

**Free text**
- with a context: it goes to that agent (an ordinary agent task, its connection and model) or to the crew;
- without one: the **concierge** reads it with the Chat route's model and answers with a structured choice (ask an agent, start a crew, run a workflow, status, or a direct short answer). "Chiedi a Kenji di controllare lo stato del progetto" becomes a task for Kenji. The concierge never runs tools itself.

The answer comes back as a message when the task ends (long answers split, Markdown kept simple). While it works: a "typing" action.

## Approvals from Telegram

Anything that waits for the user also arrives with buttons (`callback_query`), and the desktop stays in sync (deciding on one side closes the other):
- a tool approval: "Kenji vuole eseguire: scrivere `report.md`" · [Approva] [Rifiuta];
- a crew plan: the coordinator's tasks · [Approva piano] [Rifiuta];
- a crew's final result · [Approva] [Chiedi modifiche] (the next message is the feedback);
- a workflow approval node · [Approva] [Rifiuta].

## Files

- **Out**: "Mandami il report finale" or the [Scarica] button sends an Artifact as a document (`sendDocument`).
- **In**: a PDF, image, DOCX, TXT or CSV sent to the bot becomes an attachment of the next task in this chat, through the existing attachment pipeline (no second file system).
- **Voice**: v1 answers "Messaggio vocale ricevuto: la trascrizione non è ancora supportata." The bridge keeps the file id so speech-to-text can be added later.

## Notifications (configurable)

One switch per kind; the defaults are on for the important ones:

| kind | default |
| --- | --- |
| something waits for your approval | on |
| a task, crew or workflow started from Telegram finished or failed | on |
| any crew or workflow finished or failed | on |
| a schedule was missed while RealmNest was closed | on |
| progress: a crew task or workflow node started or finished | off |

Quiet hours (optional): no notifications between two times, except approvals.

## Native side (Rust, `src-tauri/src/telegram/`)

- `telegram_set_token` (write-only), `telegram_verify` (getMe), `telegram_start` / `telegram_stop` (the polling loop: `getUpdates` with a 50 s timeout and a saved offset; backoff on errors), `telegram_status`;
- pairing: `telegram_pair_begin` (a code) / `telegram_users` / `telegram_remove_user`; the authorized ids live in the app data (not secret) and are checked in Rust;
- sending: `telegram_send` (text, optional inline buttons), `telegram_edit`, `telegram_answer_callback`, `telegram_send_document` (bytes from the FileStore by storage ref), `telegram_fetch_file` (a file the paired user sent → FileStore);
- updates reach the webview as events (`telegram.update`): message text, command, callback data, file metadata. Never the token.

## TypeScript

- `src/runtime/telegram/bridge.ts`: `TelegramBridge` (per-chat context, commands, concierge, dispatch, approvals, notifications, files);
- `src/runtime/telegram/concierge.ts`: the structured prompt and its parser;
- `src/ui/telegram/TelegramSettings.tsx` in Settings › Integrations;
- events: the bridge listens to `tool.awaiting_approval`, `crew.event`, `workflow.event`, `agent.run.*`, `schedule` misses.

## Not in v1

Webhooks (a future RealmNest Server), speech-to-text, groups (private chats only), several bots, creating the bot automatically.

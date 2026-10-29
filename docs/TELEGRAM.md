# Telegram

RealmNest as a remote control from your phone: a Telegram bot you pair with RealmNest. You talk to agents, start crews and workflows, approve what waits for you and get files. It works while RealmNest is open on the PC (long polling: no server, no domain, no open port). The design record is [TELEGRAM_PLAN.md](TELEGRAM_PLAN.md).

## Setup

Settings › Integrations › Telegram:
1. In Telegram, **@BotFather** → `/newbot` → paste the token in RealmNest (**Save and verify**). It goes to the OS credential store (`telegram.botToken`); the page never gets it back.
2. **Make a code**, then write `/start <code>` to your bot (valid 10 minutes; 5 wrong tries close it). Your numeric Telegram id is linked as owner.
3. **Start** (or let it start with RealmNest), and choose the **notifications**.

## Use

| | |
| --- | --- |
| free text | the **concierge** (the Chat route's model) passes it to an agent, a crew or a workflow, answers status questions, or sends a file |
| `/agent Name`, `/agents` | talk to that agent: every message is a task for it (its own connection, model, tools and approvals); the answer comes back when it ends. A busy agent puts the task in its queue (RUNTIME.md "Queue"): the chat is told its place, and the answer comes when it has run, or a note if it was taken out of the queue or could not start |
| `/crew Name`, `/crews` | the next message is the crew's goal; its plan and final result come with buttons |
| `/run Name`, `/workflows` | starts a workflow, asking its inputs one by one |
| `/status`, `/tasks` | who works on what, open runs, what waits for you |
| `/approve`, `/reject` | show the oldest thing waiting for you, with its buttons (nothing is decided blind); only the owner may approve |
| `/cancel`, `/end`, `/help` | stop the last thing started here · back to the concierge · the list |
| files | PDFs, images and text files become attachments of your next message; voice messages are not transcribed yet |

Approvals (tools, crew plans and results, workflow approval nodes) arrive with buttons; deciding on the PC updates the Telegram message.

Messages use Telegram HTML: an answer starts with the agent's name and role, and its Markdown becomes bold, italics, lists, quotes, code and links (`src/runtime/telegram/format.ts`; values are escaped, long answers are split without breaking tags, and Rust resends as plain text if Telegram refuses the markup). `/agents` sends a picture of the agents (each one's pixel-art bust, name and role, `src/ui/telegram/agentSheet.ts`) with the buttons under it; the picture is cached until a character changes. Emoji in moderation, at most one at the start of a message (🔐 an approval, ✅ / ❌ decided, ⏳ working, ⚠️ a failure, 📋 a plan…), never in the agents' own answers.

## Notifications

One switch each: approvals · what you started from Telegram · any crew or workflow finishing or failing · schedules missed while RealmNest was closed · progress (off by default). Optional quiet hours (approvals still come through).

## Security

- Only linked accounts (numeric ids) are served; everything else is dropped in Rust before the app sees it. Messages and files go only to linked chats.
- Telegram is not a shortcut: a message is ordinary user input, and agents' tools go through the same permissions and approvals as on the PC.
- Rust calls only `api.telegram.org` with a fixed list of methods (`getMe`, `getUpdates`, `sendMessage`, `editMessageText`, `answerCallbackQuery`, `sendChatAction`, `sendDocument`, `sendPhoto`, `getFile`) and the file download path; no redirects, size limits, timeouts; errors never carry the token (logs mask `<id>:<token>` strings too).

## Where it lives

| | |
| --- | --- |
| native | `src-tauri/src/telegram/mod.rs` (polling, pairing, sending, files), `src-tauri/src/commands_telegram.rs` |
| bridge | `src/runtime/telegram/bridge.ts` (`TelegramBridge`: commands, context per chat, concierge, approvals, notifications), `transport.ts`, `format.ts` (Markdown → Telegram HTML) |
| UI | `src/ui/telegram/TelegramSettings.tsx`, `agentSheet.ts` (the agents' picture) |
| texts | `src/locales/telegram.ts` (`tg.*`, it / en) |
| tests | `telegram::tests` (Rust: pairing, strangers, groups, buttons, multipart), `src/tests/telegram.test.ts`, `src/tests/telegramFormat.test.ts` |

## Not yet

Speech-to-text for voice messages, groups, several bots, webhooks (a future RealmNest Server). The end-to-end run with a real bot needs the owner's token.

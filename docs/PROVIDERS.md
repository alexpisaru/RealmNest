# Model providers

RealmNest talks to AI backends through one contract. No code outside an adapter's own folder knows which backend it is using.

```
RealmNest runtime / UI
      ↓  ProviderService (runs turns, publishes events on the bus)
ProviderRegistry  →  AIProvider (contract: src/runtime/providers/types.ts)
      ↓
Adapter: claude-code/ · openrouter/   (later: ollama/, openai/, anthropic/, openai-compatible/)
      ↓
ProcessRunner (CLI adapters) or a native HTTP host (API adapters: src-tauri/src/openrouter)
```

A provider is a **model backend**, not an agent. Agents, tools, memory, permissions and routing belong to the future Agent Runtime, which uses providers through this contract.

## The contract (`src/runtime/providers/types.ts`)

```ts
interface AIProvider {
  id: string; name: string;
  capabilities: ProviderCapabilities;
  getStatus(): Promise<ProviderStatus>;
  listModels?(): Promise<ModelInfo[]>;      // only if capabilities.modelListing
  runTurn(req: ProviderTurnRequest): AsyncIterable<ProviderEvent>;
  cancel?(runId: string): Promise<void>;    // only if capabilities.cancellation
}
```

**`runTurn`** follows these rules:
- It never throws.
- Failures arrive as events.
- Every stream ends with exactly one terminal event: `run.completed`, `run.failed` or `run.cancelled`.
- Breaking out of the `for await` cancels the turn.

**Request.** A `ProviderTurnRequest` carries:
- `runId`
- `session?`: a `ProviderSessionRef`, either `{ mode: 'new' }` or `{ mode: 'resume', id }`; none for a one-off turn (see [CHAT.md](CHAT.md#provider-sessions))
- `model?`
- `messages`
- `systemPrompt?`
- `tools?` (none when omitted)
- `workspace?`
- `timeoutMs?`
- `abortSignal?`

**Status.** `ProviderStatus.state` is one of:
- `available`
- `not_installed`
- `not_authenticated`
- `unavailable` (this build cannot reach it)
- `error`

It also carries a user-facing `message`, an optional `hint` (what to do), `version` and `details`.

## Capabilities

The adapter's capabilities are static flags. They say what the **adapter** wires up; the user-facing vocabulary, with provenance and per-model claims, lives in [CAPABILITIES.md](CAPABILITIES.md). There, `realmnestReadiness()` reads these flags to decide whether RealmNest can use a capability today:

| flag | meaning |
| --- | --- |
| `streaming` | text arrives as `text.delta` |
| `tools` | the backend can use tools and reports them as `tool.*` events |
| `vision` | the adapter accepts image input |
| `sessions` | the provider keeps conversations itself (`ProviderSessionRef`) |
| `local` | inference runs on this machine; no prompt leaves it |
| `usage` / `cost` | reports token usage / a USD cost |
| `cancellation` | a running turn can be stopped |
| `modelListing` | `listModels()` works |
| `systemPrompt` | honours `systemPrompt` |

Declare only what the adapter really does. If the backend can do something the adapter does not wire up, the flag stays `false`.

## Normalized events

Each event has `type`, `runId`, `providerId`, `seq` (order within the run), `at`, and optionally `raw` (the original payload, for debugging only).

| event | when |
| --- | --- |
| `provider.started` | the backend accepted the turn (process spawned, request sent) |
| `session.started` | a conversation opened or resumed (`sessionId`, `model`, `tools`) |
| `message.started` | a model message begins |
| `text.delta` / `text.completed` | streamed text / the full text of a block |
| `tool.requested` | the model asked for a tool (complete input) |
| `tool.started` | a tool began running (only if the backend reports it) |
| `tool.completed` | a tool result came back |
| `usage.updated` | tokens per message (`cumulative: false`) or per turn (`true`), plus `costUsd` |
| `provider.error` | something went wrong; non-fatal unless a terminal event follows |
| `run.completed` / `run.failed` / `run.cancelled` | terminal, exactly one per turn |

Adapters emit only the events their backend really produces. Claude Code reports no tool start, so `tool.started` never appears for it.

Error codes (`ProviderErrorInfo.code`):
- `not_installed`
- `not_authenticated`
- `unavailable`
- `invalid_request`
- `session_not_found`
- `rate_limited`
- `api_error`
- `max_turns`
- `budget_exceeded`
- `execution_error`
- `malformed_event`
- `incomplete_stream`
- `process_exit`
- `process_crashed`
- `timeout`
- `unknown`

Every error has a user-facing `message`. It can also carry a `detail` for developers, which is already redacted.

## Registry and service

```ts
const registry = new ProviderRegistry().register(new ClaudeCodeProvider(processRunner()));
const providers = new ProviderService(registry, bus);   // src/main.tsx, the only place adapters are created

await providers.status('claude-code');
const run = providers.run('claude-code', { messages: [{ role: 'user', content: 'Hi' }] }, onEvent);
await run.done;     // the terminal event
run.cancel();
```

`ProviderService` publishes every event on the app bus:
- `provider.event`: one key carrying the whole `ProviderEvent` union.
- `provider.status`: emitted after each status check.
- `text.delta` events reach listeners but stay out of the bus log, so they don't flood it.

The visual world does not react to these events yet. When it does, it will subscribe to `provider.event`.

## Running local programs (`src/runtime/process/`)

CLI adapters describe a process as a `ProcessSpec`:
- `program`: an id, never a path;
- `args`: an argv array;
- `stdin`;
- `cwd`;
- `timeoutMs`;
- `signal`.

A `ProcessRunner` runs it. Every runner implements the same contract, so `ClaudeCodeProvider` never knows which one it has:

```
                    ProcessRunner (src/runtime/process/types.ts)
                         │
      ┌──────────────────┼──────────────────────┐
BridgeProcessRunner   TauriProcessRunner    UnavailableProcessRunner
  (npm run dev)         (desktop app)         (plain browser build)
      │ fetch + NDJSON       │ invoke + Channel
NodeProcessRunner      Rust ProcessHost
 (Vite plugin)         (src-tauri/src/process)
```

| runner | where | host side |
| --- | --- | --- |
| `BridgeProcessRunner` | the page in `npm run dev` (browser) | `NodeProcessRunner` in the Vite plugin `realmnestProcessBridge` |
| `TauriProcessRunner` | the desktop app (also under `tauri dev`) | Rust `ProcessHost`, through three Tauri commands |
| `NodeProcessRunner` | Node directly (tests, a future sidecar) | itself |
| `UnavailableProcessRunner` | plain browser build | none: providers report `unavailable` |

`src/platform/index.ts → processRunner()` picks one, once, at startup:
1. Tauri → `TauriProcessRunner`, even under `tauri dev` where Vite serves the page.
2. Dev-bridge token present → `BridgeProcessRunner`.
3. Otherwise → `UnavailableProcessRunner`.

The Debug › Providers panel shows which host is in use (`host:` row).

### Streaming

Both hosts send the same messages (`src/runtime/process/protocol.ts`), in order:
- `{t:'spawn'}`;
- then `{t:'out', d}` / `{t:'err', d}` chunks;
- then exactly one `{t:'end', end: ProcessEnd}`.

The transports differ:
- **Dev bridge:** NDJSON over one fetch.
- **Desktop:** a Tauri `Channel` passed to `process_run`. Rust forwards stdout **line by line** as it arrives (stream-json is line based).

The hosts only carry bytes. Claude's JSON is interpreted by the TypeScript parser, so there is no second parser in Rust. `src/runtime/process/protocol.cases.json` pins the wire format: `cargo test` checks that Rust serializes exactly those shapes, and the TS tests check that the runners understand them.

### Process identifiers, cancellation, timeouts

- **Run ids.** Every desktop run gets an id (`process_run` returns it immediately). The Rust host keeps a registry of live runs, so several can run at once.
- **Cancellation, desktop:** `AbortSignal` → `TauriProcessRunner` → `process_cancel(id)` → Rust kills the run's process tree → `end: cancelled` → the provider emits `run.cancelled`. The provider never emits `run.completed` after a terminal event.
- **Cancellation, dev:** aborting the fetch closes the connection, and the Node host kills the tree.
- **Timeouts.** Enforced by the host: default 5 min, clamped to 1 s – 30 min. A Claude Code or Codex turn with RealmNest tools (the bridge) gets 30 min, because it may wait for your approval, a colleague or a deep research. The host kills the tree and returns `end: timeout`, which becomes `run.failed` (`timeout`). The bridge client also has its own guard.
- **Tree cleanup, desktop (Windows):** each child goes into its own Job Object with `KILL_ON_JOB_CLOSE`.
  - On cancel or timeout, or when the main process exits on its own, the host terminates the job: no orphan `claude.exe` and no leftover grandchildren.
  - If RealmNest itself crashes, Windows closes the handle and kills them anyway.
  - When the app quits, `RunEvent::Exit` kills every live run.
- **Tree cleanup, dev:** `taskkill /T /F` on Windows, process-group kill elsewhere.

### Security model (enforced in code, never by prompts)

- **No generic command API.** The webview can call only three Tauri commands:
  - `process_run`: a typed request with `program` (an id), `args`, `stdin`, `cwd`, `timeoutMs`;
  - `process_cancel`: a run id;
  - `process_locate`: a program id.
- **Narrow permissions.** Each command needs its own permission (`allow-process-run`, `allow-process-cancel`, `allow-process-locate`), generated from the app manifest in `src-tauri/build.rs` and granted only to the `main` window in `src-tauri/capabilities/default.json`. No `shell` plugin, no `fs` plugin.
- **The host validates everything again.** Rust (desktop) and Node (dev) each check, whatever the frontend did:
  - the program id against their allowlist, and they resolve the executable themselves (the page can never name a path);
  - every argument against that program's allowlist (Claude: `args.ts` / `programs/claude.rs`, kept identical by `args.cases.json`);
  - stdin size ≤ 1 MB, at most 64 args;
  - `cwd`: absolute and existing. The default is a neutral `~/.nestra/workspace`.
- **No shell.** `std::process::Command` / `child_process.spawn` get explicit argv. An npm `claude.cmd` shim is run as `node cli.js`, never through `cmd.exe`. On Windows the child gets `CREATE_NO_WINDOW`.
- **Clean environment.** The child gets the host's environment minus variables that would tie it to a running Claude Code session.
- **Dev bridge checks.** Requests need a local `Host`, a same-host `Origin`, and a random per-start token found only in the served `index.html`. The bridge is serve-only and absent from builds.
- **No secrets in logs.** Neither host logs arguments, stdin or environment. stderr tails and debug details are redacted before display. RealmNest never reads Claude credentials.

### A future CLI provider

Give its host program both halves:
- `HostProgram` in Node (`src/runtime/process/node/runner.ts` interface; register in `vite.config.ts`);
- `HostProgram` in Rust (`src-tauri/src/programs/`; register in `lib.rs`).

Each half needs its own `locate`, argument allowlist, environment and default cwd. Share the allowlist cases as a JSON file like `args.cases.json` so both are tested against the same vectors. The provider itself only builds a `ProcessSpec` and calls `ProcessRunner.run`.

## The Claude Code adapter (`src/runtime/providers/claude-code/`)

| file | role |
| --- | --- |
| `provider.ts` | `ClaudeCodeProvider`: status, sessions, turns, error mapping |
| `parser.ts` | stream-json → normalized events (pure, unit-tested) |
| `args.ts` | command lines + the allowlist the host enforces |
| `types.ts` | the raw stream-json shapes RealmNest reads |
| `host.ts` | Node only (dev bridge): finds `claude`, cleans its environment |
| `args.cases.json` | allow/deny vectors checked by both the TS and the Rust allowlist |

The desktop twin of `host.ts` is `src-tauri/src/programs/claude.rs` (same discovery order, same allowlist, same environment rules).

**Detection.** Both hosts look for the executable in the same order:
1. `REALMNEST_CLAUDE_PATH`.
2. `PATH`. An npm `claude.cmd` shim is run as `node cli.js`, never through a shell.
3. The native installer: `~/.local/bin`, `~/.claude/local`.
4. The copy bundled with the Claude desktop app. On Windows it is checked in two places:
   - **first** the Store/MSIX package folder, `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude-code`, which is the only place a normal shell can see;
   - then `%APPDATA%\Claude\claude-code`.

   The newest `<version>/<build>/claude.exe` is picked, so Claude updates need no change.
5. Not found → `not_installed`.

Status uses `claude --version` and `claude auth status --json`. The second exits with code 1 when signed out but still prints its JSON.

**A turn** runs this command line, with the prompt sent on **stdin**:

```
claude -p --output-format stream-json --verbose --include-partial-messages
       --permission-prompts none --strict-mcp-config
       (--no-session-persistence | (session new: nothing) | --resume <id>)
       [--model <m>] [--effort <level>] (--system-prompt <plain + caller> when no tools | --append-system-prompt <s>) --tools <list>
```

- **Tools.** Every built-in tool is off unless the request lists some (`--tools ""`).
- **Web on in a chat or agent task:** with `providerWeb` the turn gets `--tools WebSearch` (Claude Code's own search, Anthropic's side) and WebSearch in `--allowedTools`, alone (`WEB_PROMPT`) or after the RealmNest bridge tools (`BRIDGE_WEB_PROMPT`). The allowlist accepts WebSearch in `--allowedTools` only with `--tools WebSearch`, at most once, and next to nothing but `mcp__realmnest__…` tools. A resumed session keeps the system prompt of its first turn, so turning Web on later in a Claude chat gives the tool without the prompt line about it.
- **System prompt.** With no tools, Claude Code's agentic prompt is replaced (`--system-prompt`) by a short plain-assistant prompt plus the caller's; otherwise the caller's prompt is appended. Without this, a tool-less model acted out tool calls as text.
- **Sessions.** `session: new` lets Claude Code keep the session under its own id; `resume` passes `--resume <id>`. The adapter is stateless, so sessions survive a restart. A resume that Claude cannot find (`No conversation found…` on stderr) becomes `run.failed` with `session_not_found`.
- **Permission prompts.** Nobody can answer one in print mode, so `--permission-prompts none` denies anything that would ask.
- **No MCP servers.** `--strict-mcp-config` stops Claude Code from loading the user's MCP servers and the account's claude.ai connectors. Without it, those tools were available even with `--tools ""`, and local MCP servers started extra processes.
- **Partial streaming.** Text comes from the raw stream events. The complete `assistant` message that follows adds only tool calls, so text is never duplicated.
- **Sign-in errors.** A signed-out CLI sends a synthetic assistant message with `error: "authentication_failed"`. It becomes `provider.error` and `run.failed` (`not_authenticated`), not model text.
- **History.** Claude Code keeps conversation history in its sessions. A request with earlier messages that does not resume a session is rejected rather than flattened.
- **Environment.** Variables that tie a process to a running Claude Code session (`CLAUDECODE`, `CLAUDE_CODE_SESSION_*`, messaging sockets…) are removed. User configuration such as `CLAUDE_CODE_OAUTH_TOKEN` or `CLAUDE_CODE_USE_BEDROCK` is kept.

**Sign-in.** RealmNest uses the CLI's own login and never asks for an Anthropic key. To sign in, run `claude auth login`. If the CLI is not on `PATH`, the status hint gives the full path.

## The OpenRouter adapter (`src/runtime/providers/openrouter/`)

| file | role |
| --- | --- |
| `provider.ts` | `OpenRouterProvider`: stateless turns (`sessions: false`), the system prompt as a `system` message, native events mapped to `ProviderEvent`s, cancel by native run id |
| `transport.ts` | the four Tauri commands (`openrouter_validate`, `openrouter_models`, `openrouter_chat`, `openrouter_cancel`); unavailable in browser builds |
| `definition.ts` | catalogue entry: method `api-key`, a secret field, capability snapshot |

HTTP, SSE parsing, limits and errors live in Rust (`src-tauri/src/openrouter`). The API key is read there and never sent to the webview. Details are in [providers/OPENROUTER.md](providers/OPENROUTER.md).

## The OpenAI API and Ollama adapters (`src/runtime/providers/openai/`, `ollama/`)

Both speak the OpenAI chat-completions protocol, so they share OpenRouter's code: `ChatCompletionsProvider` (TS, parametrized by id, name, capabilities and hints; `OpenRouterProvider` extends it unchanged) and the Rust host in `src-tauri/src/openrouter/`, now with a **flavor** (`Flavor::OpenRouter | OpenAi | Ollama`) that fixes the base URL, the paths, whether a key is sent, the body rules and the names in messages. The frontend picks a flavor from a typed enum (`'openai' | 'ollama'`), never a URL.

| | OpenAI API (`openai-api`) | Ollama (`ollama`) |
| --- | --- | --- |
| reached at | `https://api.openai.com/v1` | `http://127.0.0.1:11434` (the only plain-http base allowed, loopback, no proxy) |
| method | `api-key` (credential store, read in Rust) | `local-endpoint` (no fields, no key) |
| models | `GET /models` with the key, filtered to chat models | `GET /api/tags` + `POST /api/show` per model (tools, vision, thinking, embedding, context length; price 0) |
| body | `max_completion_tokens`, `stream_options.include_usage`, no web plugin | `stream_options.include_usage`; no PDF parts |
| embeddings | `POST /embeddings` (`openAiEmbeddings()`) | `ollamaEmbeddings()` |
| cost | not reported by OpenAI: tokens only | free (0) |
| status | the key checked against `/models` | `ollama_ensure`: when `/api/version` does not answer, RealmNest starts `ollama serve` itself (the exe only from `%LOCALAPPDATA%\Programs\Ollama` or PATH, no window), then waits up to 20 s |

Commands: `compat_validate`, `compat_models`, `compat_chat`, `compat_cancel`, `compat_embedding_models`, `compat_embed`, `ollama_ensure` (`src-tauri/src/commands_compat.rs`). Tests: `src-tauri/src/openrouter/tests/flavors.rs`, `src/tests/openaiProvider.test.ts`, `ollamaProvider.test.ts`.

Limits: OpenAI's `/models` says nothing per model, so the connection's claims (tools, vision, files, structured output) apply to every model; Ollama's default context window can cut long prompts (the compat endpoint cannot set `num_ctx`).

## The ChatGPT adapter (`src/runtime/providers/codex/`)

"ChatGPT" (`codex`) runs OpenAI's **Codex CLI** with the user's ChatGPT subscription, the way the Claude Code adapter runs `claude`. The CLI is the standalone `codex.exe` from OpenAI's releases or the npm package `@openai/codex`; the adapter finds it on PATH, behind the npm shim, or at `REALMNEST_CODEX_PATH` (a folder or the exe), and never runs a `.cmd` or a shell. No developer path is built in.

- **Turn:** `codex exec --json --skip-git-repo-check -s read-only --ignore-user-config [--ephemeral] --disable … -c web_search="disabled" -c developer_instructions="…" [-c model_reasoning_effort="…"] [-m model] [resume <thread>] -`, the prompt on stdin. Codex's own tools (shell, apps, browser, computer use, plugins, images, goals…) are switched off by 19 `--disable` flags, and the Rust allowlist (`src-tauri/src/programs/codex.rs`, mirrored by `args.ts`, both tested against `args.cases.json`) refuses any command line that leaves one out.
- **Web search (Deep Research):** a search turn (`ProviderTurnRequest.webSearch`) is a one-off turn with `-c web_search="live"` instead of `disabled` and a search-only system prompt. It keeps `code_mode_host` on, like a bridge turn: Codex runs its web search through it, and with it off the turn hangs without searching. Every other Codex tool stays off. The completed `web_search` item carries the search's own `results` (`url`, `title`, `domain`), which become a `search.results` event (http(s) only, no duplicates, at most 20). The allowlist refuses `live` with a session, `resume`, the bridge, or `code_mode_host` off. One search costs about 40,000 input tokens of the plan, most of them cached.
- **Web on in a chat or agent task:** with `providerWeb` (the chat or agent has Web on; see WEB.md) a turn also gets `-c web_search="live"` with the code-mode host on, next to its session and RealmNest tools, and a prompt that says it has its own web search (`WEB_PROMPT`, `BRIDGE_WEB_PROMPT`). The allowlist accepts `live` in any turn as long as the code-mode host is on; whether the user turned Web on is decided in the page.
- **Rate limits (429):** when ChatGPT refuses a request with 429, Codex waits silently before retrying (often minutes) and says so only in its log, never in the JSON events. The hosts (`codex.rs`, `host.ts`) therefore always set `RUST_LOG=codex_core::responses_retry=warn` (replacing any of the user's), which puts just that warning on stderr; the provider reads it (`retryWait` in `parser.ts`) and, when the announced wait is over 30 s, stops the turn with `rate_limited` ("Codex would wait about N min") instead of hanging until the timeout.
- **RealmNest tools:** when the request has tools, the page passes `--realmnest-bridge <bridge config>` (the same bridge file Claude Code uses) and leaves `code_mode_host` on, which Codex needs to call MCP tools; it is the only one of the 19 that may stay on, and only with the bridge. Rust reads the bridge file (it must name this exe with `--mcp-bridge`, a loopback address and an alphanumeric token) and turns the flag into `-c mcp_servers.realmnest.*` settings with `default_tools_approval_mode="approve"`: Codex never asks, because RealmNest's own permissions and approvals decide every call. With shell, exec and image viewing off, code mode cannot run commands or read files (checked with a canary file).
- **Events:** JSONL `thread.started` → session id; every `agent_message` → a message, the last one is the answer; `turn.completed` → usage (input, cached, output); `turn.failed` classified (not signed in, usage limit, model not available).
- **Sessions:** native (`resume <thread_id>`); one-off turns are `--ephemeral`. A thread Codex no longer knows → `session_not_found`.
- **Models:** `codex_models` reads only `models_cache.json` in the Codex folder (size-limited, a few fields); hidden models are skipped.
- **Account:** the default Codex folder (`~/.codex`, the account already signed in) or another folder (`CODEX_HOME`) = another account. Sign in / out from the connection (`codex login` opens the browser; no code to paste). Only `CODEX_HOME` may be set; API-key variables are dropped, so a turn always uses the ChatGPT sign-in.
- **Not in v1:** images and PDFs, streaming (Codex sends whole messages), structured output. Sessions appear in the user's own Codex history.

## Prices in the model menus

Each model row shows, next to its context, its price per 1M tokens as **in $x · out $y /1M** (`priceSummary`), when the catalogue has one: OpenRouter, the OpenAI API, the Anthropic API.

**Reference prices** (`src/runtime/providers/priceList.ts`). Models sold by subscription (ChatGPT through Codex, Claude by account) have no price in their catalogues, so their rows show **API in $x · out $y /1M**: the API price of the same model from OpenRouter's public catalogue.
- It is read through the native `openrouter_models` (no key, nothing about the user) at most once a day, and only when a model menu opens. Offline, it tries again after an hour.
- Only the `openai/…` and `anthropic/…` entries are kept (under `price-list`), without variants (`:free`…).
- A model matches when the ids agree without the maker and with dots as dashes (`anthropic/claude-opus-5.5` = `claude-opus-5-5`). No match: no price.
- It is not what the subscription costs: it shows how heavy each model is next to the others.

## Effort

The reasoning effort ("Impegno") says how much a model reasons before it answers. `ModelInfo.reasoning.efforts` lists the levels a model takes (lowest first) and is what the UI offers; `reasoning.default` is the level the backend uses when none is asked for, when the provider states it. `ProviderTurnRequest.effort` asks for one level; every adapter sends it only when the turn's model lists it (`acceptedEffort` in `effort.ts`) and otherwise sends nothing, so the backend's own default applies. Without a model id only the levels every listed model takes count.

| adapter | levels | sent as | checked by |
| --- | --- | --- | --- |
| Claude (`claude-code`) | `low medium high xhigh max`, every model (Claude Code 2.1.295) | `--effort <level>` | the allowlist: `args.ts` `FLAGS` and Rust `claude.rs` `flag()`, both against `args.cases.json` |
| ChatGPT (`codex`) | the model's `supported_reasoning_levels` from `models_cache.json`, without `ultra`; its `default_reasoning_level` as the default | `-c model_reasoning_effort="<level>"` | `checkCodexArgs` and Rust `codex.rs`: an exact enum (`minimal low medium high xhigh max`), against `args.cases.json` |
| OpenRouter | models whose `supported_parameters` include `reasoning`: the levels the catalogue states (`minimal low medium high xhigh`), else `low medium high` | `reasoning: { effort }` in the body | Rust `build_body_for`: the same enum, OpenRouter flavor only |
| OpenAI API, Ollama, Anthropic API | none | never | the OpenAI and Ollama flavors refuse a body with an effort |

`ultra` is left out on purpose: in Codex it means reasoning plus Codex's own task delegation (multi-agent), which RealmNest switches off on every turn. Claude Code's "ultracode" is not a CLI effort.

Where it is chosen: the chat composer shows an "Impegno" pill beside the model when the model has levels (stored on the conversation, `Conversation.effort`; an agent chat starts with the agent's); the agent panel has an "Impegno" select under the model (`AgentDefinition.effort`, sent with every task run). "Predefinito" sends nothing. A level the new model does not list stays stored but is not sent, and the control shows "Predefinito"; changing the connection clears it.

## Trying it

`npm run dev` (browser, dev bridge) or `npm run tauri dev` (desktop, native host), then go to Simulation › drawer **Debug** › **Providers**. The panel shows:
- status, version, path and capabilities;
- a test prompt, with a model and a "keep session" toggle (opens, then resumes, a provider session);
- the streamed output;
- the event log.

## Adding a provider

1. Create `src/runtime/providers/<id>/` with a class implementing `AIProvider`. Keep every backend-specific type and string inside that folder.
2. Translate the backend's stream into `ProviderEventBody` in a pure parser, so it can be tested with recorded output.
3. Guarantee one terminal event: map timeouts, aborts, crashes and HTTP errors to `run.failed` / `run.cancelled`.
4. Fill `capabilities` honestly.
5. Register it in `src/main.tsx`. Nothing else changes: the debug panel lists every registered provider.
6. If it runs a local program, add its host program in Node and in Rust (see "A future CLI provider" above).
7. Add tests next to `src/tests/claudeParser.test.ts` and `claudeProvider.test.ts`.

## Known limitations

- **Desktop tree kill:** only Windows uses Job Objects. On macOS/Linux the desktop host kills the child alone; process groups are still to do.
- **Input:** text prompts only (no images).
- **Models:** Claude Code has no command that lists them, so `listModels` is not offered.
- **Cost:** for subscription users it is Claude Code's estimate.

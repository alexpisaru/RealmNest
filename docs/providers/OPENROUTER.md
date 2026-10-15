# OpenRouter

OpenRouter is RealmNest's second real provider. One API key gives access to hundreds of models from many vendors. It is a normal provider in the Provider → Connection → Model architecture ([CONNECTIONS.md](../CONNECTIONS.md)).

```
 Chat / LiveRuntime ──▶ ProviderService ──▶ OpenRouterProvider (TS, per connection)
                                                  │ invoke + Channel (connection id, model, messages)
                                                  ▼
                                   src-tauri/src/openrouter (Rust)
                                     key from OS credential store ──▶ https://openrouter.ai/api/v1
                                     SSE parsed in Rust ──▶ typed stream events ──▶ ProviderEvents
```

## Authentication and the key

- **Saving the key.** Settings › AI Connections › OpenRouter › Connect. The **API key** field is a password field, generated from the provider definition (method `api-key`, one `secret` field). The key goes to the write-only `secret_set` command and is stored as `conn.<connectionId>.apiKey` in the **OS credential store**.
- **Where it never goes.** It is never in localStorage, the connection record, events, logs or exports. The add form clears its state after saving.
- **Who reads it.** Only Rust (`openrouter::api_key`). The webview has no command that returns a secret: `secret_get` is not allowed by the ACL.
- **Browser builds.** There is no secure store and no native host, so OpenRouter connections are refused there. Claude in the browser is unchanged.

## Native commands (narrow, typed)

There is **no generic HTTP proxy**. There are four commands, each granted explicitly in `capabilities/default.json`:

| command | does |
| --- | --- |
| `openrouter_validate(connectionId)` | `GET /key` with the stored key: a cheap check, no generation |
| `openrouter_models()` | `GET /models` (public; no key is sent) → normalized descriptors |
| `openrouter_chat(connectionId, {model, messages, maxTokens?, temperature?, timeoutMs?}, channel)` | `POST /chat/completions` with `stream: true`; returns a run id |
| `openrouter_cancel(id)` | stops that stream |

**HTTP safety** (`src-tauri/src/openrouter/mod.rs`):
- **One origin.** The base is fixed (`https://openrouter.ai/api/v1`) and so are the paths. The client is `https_only`.
- **No redirects.** Redirects are never followed, so `Authorization` cannot reach another host. This is tested with a redirect to a second mock server, which receives nothing.
- **Typed requests.** Roles must be `system`, `user` or `assistant`. Model ids are restricted to `[A-Za-z0-9._:/~-]`. At most 1000 messages and 2 MB.
- **Limits:**
  - error bodies 64 KB, catalogue 20 MB, stream 16 MB, SSE line 1 MB;
  - connect timeout 15 s, idle timeout 120 s, total timeout (default 5 min, at most 30 min).
- **Redaction.** Errors are normalized and redacted (`sk-…` keys and `Bearer` tokens are masked). Headers and bodies are never logged.

## Model discovery

**Fetching.** `GET /models` is called **only after a successful validation**, and only when the cached catalogue is missing or older than 24 h. It can also be refreshed by hand with **Refresh models**, but only on a connected connection. On 12 Oct 2026 the live catalogue had 458 models.

**What is kept per model.** These fields come from the live catalogue, and nothing is guessed from names:
- `id` (raw, used in requests) and `label`;
- `providerLabel`;
- `contextLength`;
- `inputModalities` and `outputModalities`;
- `supportedParameters` (e.g. `tools`, `structured_outputs`, `reasoning`);
- `pricing` (USD per token, as given; `-1` means variable);
- `reasoning` (`mandatory`, supported efforts), when OpenRouter sends a reasoning object.

### What the catalogue tells reliably, and what it does not

These fields become model-level capabilities with provenance; [CAPABILITIES.md](../CAPABILITIES.md) has the full mapping.

**Reliable:**
- input and output modalities (text, image, file, audio, video);
- the accepted request parameters (`tools`, `structured_outputs` / `response_format`, `web_search_options`, `reasoning`);
- the reasoning object;
- context length and price.

**Not reliable, or not stated:**
- **Image editing:** image output does not mean it can edit.
- **Web search without `web_search_options`:** OpenRouter's own web plugin works on any model, so absence is "unknown", not "no".
- **Quality** of tools or vision.
- **Models with an empty parameter list:** 4 in the live catalogue. Their parameter-based capabilities stay unknown.

Supported is not usable: RealmNest sends text only today, so vision, files, tools, web search and image output are shown as supported but **not ready**.

**Cache.** The catalogue is stored under the storage key `model-catalogs`, apart from the connection record, which keeps only `{count, fetchedAt}`. A cached catalogue never counts as proof that the connection works: the status is always rechecked.

## Model picker

`src/ui/ModelPicker.tsx` is used in Chat, the agent panel, Settings (preferred model) and Debug › Providers:
- **Search.** It searches by name, id and vendor; every word must match, and at most 80 results are shown.
- **Rows.** Each row shows the id, context length, a price summary per 1M tokens, and non-text input badges.
- **Per capability.** The picker takes a capability (`text.chat` for Chat and agents) and lists the models that support it, then those whose support is unknown, with a "support not stated" badge. Models that cannot chat (image-only) are left out. The catalogue itself is never trimmed: Debug › Capabilities and the AI Capabilities routes see all of it.
- **Auto Router.** `openrouter/auto` is a real model in OpenRouter's catalogue and is listed first. RealmNest never invents an "auto" id.
- **No model chosen.** That means the connection's preferred model. OpenRouter has no default of its own, so a turn without any model fails with "Choose a model…", and Chat asks before sending.
- **Switching connection.** It clears a model chosen for the previous connection, for agents and chats alike.

## Chat and agents: stateless by design

`capabilities.sessions = false`: OpenRouter keeps no conversation, and RealmNest does not invent a session id. `ConversationRuntime` replays the conversation's **completed** messages on every turn, and failed or stopped replies are left out.

**Consequences:**
- Memory survives a restart, because the history is RealmNest's.
- Conversations are isolated, because each one sends only its own history.
- The model can even change between turns.
- Claude Code keeps its native resume. Both give the same Chat experience.

**System prompt.** Agent instructions (who the agent is, plus its instructions) travel as a real `system` message, never inside user text.

## Streaming, usage, cancellation

- **Streaming.** Rust parses SSE (`data:` lines, `: OPENROUTER PROCESSING` keep-alives, `[DONE]`, errors mid-stream) into typed events: `start`, `delta`, `usage`, `done`, `error`, `cancelled`. `OpenRouterProvider` maps them to `provider.started`, `message.started`, `text.delta`, `text.completed`, `usage.updated`, `run.completed`, `run.failed` and `run.cancelled`.
- **Usage.** Token counts and the authoritative `cost` from OpenRouter's final usage chunk are stored on the run (`usage`, `costUsd`). Nothing is computed from prices.
- **Stop.** Cancelling goes `AbortSignal` → `openrouter_cancel(id)` → the request future is dropped, which **closes the HTTP connection**. This was checked against the live service: the streaming TCP connection closed and the text stopped growing. A completion that arrives afterwards is ignored.

## Errors

| HTTP / stream | RealmNest code | message |
| --- | --- | --- |
| 401 | `invalid_credentials` (connection status `invalid_credentials`) | OpenRouter rejected the API key |
| 402 | `payment_required` | This OpenRouter key has no credits left |
| 403 | `api_error` | refused (permissions, limits or moderation) |
| 404 | `model_unavailable` | This model is not available |
| 408 / idle / total | `timeout` | did not answer in time / stopped sending data |
| 429 | `rate_limited` | rate limiting this key; try again shortly |
| 502 / 503 / `finish_reason: error` | `unavailable` | no provider available for this model |
| network | `unavailable` | could not reach OpenRouter |
| bad SSE / unfinished stream | `malformed_event` | reply ended before it was complete |

The user sees OpenRouter's own short explanation where it is safe, e.g. "Insufficient credits…". Messages are redacted and capped at 400 characters.

## Future: images

Image generation and editing (and the Gallery) will be separate commands and parsers next to `chat` in `src-tauri/src/openrouter`, with their own provider methods. The text chat transport stays untouched. The catalogue already records `outputModalities`, so image-capable models can be offered when that exists.

## Limitations

- **Text only:** no tools, no image input or output, no structured output yet.
- **Desktop only.** Key-based connections need the OS credential store.
- **Shared catalogue.** The model catalogue is the public one: models that need provider-specific keys (BYOK) are not marked.
- **Free models.** `:free` models are often rate-limited upstream (HTTP 429). RealmNest reports it; retry or pick another model.

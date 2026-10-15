# Capabilities and routing

RealmNest answers four separate questions about every connection and model. One service answers all four, `CapabilityService` (`src/runtime/capabilities/service.ts`):

| question | name | source |
| --- | --- | --- |
| Can this provider/model do it, and who says so? | **supported** | provider definitions and the model catalogue, with provenance |
| Does the connection work right now? | **available** | the connection's last real check (`status === 'connected'`, not removed) |
| Can RealmNest itself use it today? | **ready** | `realmnestReadiness()` (`runtime/capabilities/readiness.ts`) |
| Which connection/model does the user want for it? | **routed** | the user's `RoutingPolicy` |

These four are never merged. For example, a model can accept images (supported) on a working key (available) even though RealmNest cannot send images yet (not ready). Chat, agents, Settings and Debug all ask the service, and no other component decides.

## Vocabulary (`src/domain/capability.ts`)

| id | meaning | routable |
| --- | --- | --- |
| `text.chat` | a text conversation | yes |
| `text.streaming` | text arrives as it is written | |
| `text.reasoning` | the model can think before answering | yes |
| `vision.input` | accepts images as input | yes |
| `files.input` | accepts files (e.g. PDF) as input | |
| `coding` | a coding agent working in a folder | yes |
| `tools.calling` | function / tool calls | |
| `web.search` | searches the web itself | yes |
| `image.generate` | produces images | yes |
| `image.edit` | edits a given image | |
| `structured.output` | answers in a given JSON schema | |
| `sessions.native` | the provider keeps the conversation | |

**Not capabilities.** Cost, context window and speed are model facts. The picker shows them, but they are not capabilities.

**Support.** Support is `supported`, `unsupported` or `unknown`. A capability missing from a `CapabilitySet` means unknown, and unknown is allowed: RealmNest never turns "not stated" into "no".

## Provenance

Every claim is a `CapabilityDescriptor` carrying `source: { level, origin, evidence?, via }`:
- `level` is `provider`, `connection` or `model`;
- `origin` is who says it, e.g. "Claude Code" or "OpenRouter model catalogue";
- `evidence` is why, e.g. `input modalities: text, image` or `accepts "web_search_options"`;
- `via` is `native` (the provider does it) or `nestra` (RealmNest adds it).

**Effective support.** `effective(connectionId, modelId?)` resolves support for every capability. The most specific claim wins: a model claim beats a connection claim, so a text-only model on a vision-capable provider is `unsupported`. The resolution keeps every claim in `provenance`, most specific first. Debug › Capabilities shows them in a table.

## Where claims come from

**Claude Code (provider level, `providers/claude-code/definition.ts`)**

| status | capabilities |
| --- | --- |
| supported | text.chat, text.streaming, sessions.native, coding, text.reasoning (`--effort`), tools.calling, files.input and vision.input (document / image blocks on stream-json input, verified), web.search (built-in tools), structured.output (`--json-schema`) |
| unsupported | image.generate, image.edit |

**OpenRouter, connection level.** Supported: text.chat and text.streaming. Unsupported: sessions.native. Everything else is decided per model.

**OpenRouter, model level (`capabilities/model.ts`).** Claims come from catalogue metadata only, never from model names:

| capability | metadata | when the metadata is silent |
| --- | --- | --- |
| text.chat | input and output modalities both include `text` | unknown if there are no modalities |
| vision.input / files.input | input modality `image` / `file` | unknown if there are no input modalities |
| image.generate | output modality `image` | unknown if there are no output modalities |
| image.edit | `unsupported` only when there is no image output | otherwise unknown: the catalogue does not say |
| tools.calling | parameter `tools` | unknown if the model lists no parameters |
| structured.output | `structured_outputs` or `response_format` | unknown if there are no parameters |
| web.search | parameter `web_search_options` → supported | absent → unknown, never "no" |
| text.reasoning | a `reasoning` object, or `reasoning` / `include_reasoning` parameters | absent → unknown |

Live catalogue (October 2026, 458 models):
- input image 296, file 188;
- output image 12;
- tools 390;
- a reasoning object on 327;
- `web_search_options` on 19;
- 4 models with no parameters at all, whose parameter-based capabilities stay unknown.

## Ready in RealmNest today

| ready | not ready, with the reason shown in the UI |
| --- | --- |
| text.chat, coding, text.reasoning (the model reasons on its own; effort is not set); **embeddings.create** (OpenRouter: Knowledge hybrid bases) | web.search, image.generate, image.edit, structured.output; embeddings.create on Claude Code (the CLI has no embeddings API) |
| depends on the adapter: text.streaming; sessions.native (otherwise history replay); vision.input and files.input (chat attachments: Claude Code and OpenRouter send them); **tools.calling** (RealmNest tools: OpenRouter yes, Claude Code no, see below) | |

**tools.calling.** It is ready when at least one tool can run here and the adapter takes RealmNest tools in one of two ways:
- **`toolCalling`:** the model asks between turns and RealmNest runs the calls (OpenRouter, for models whose catalogue lists `tools`);
- **`toolBridge`:** the model runs its own loop and calls RealmNest's MCP server (Claude Code). This needs the desktop app; elsewhere it says "the RealmNest MCP bridge runs only in the desktop app".

See [TOOLS.md](TOOLS.md) and [MCP.md](MCP.md). Skills declare capability requirements (`requiresCapabilities`), and the Skill resolver checks them against the agent's or chat's model through `effective()` ([SKILLS.md](SKILLS.md)).

**embeddings.create.** A routable capability used by Knowledge bases set to hybrid search ([KNOWLEDGE.md](KNOWLEDGE.md)). Its models are a catalogue of their own (OpenRouter `GET /embeddings/models`), never the chat models: a route needs an explicit embedding model, `MODEL_UNAVAILABLE` checks that catalogue once it is loaded, and Settings › AI Capabilities › Embeddings picks from it. Only connections that claim it (`supported`) are offered. The key stays in Rust (`openrouter_embed`).

**Web.** Reading pages adds no capability: `web_fetch` is a RealmNest tool run in Rust, so any model that calls tools can use it, and models that cannot get the pages the user linked read for them. Web search is a separate **engine slot** in the web layer (`WebSearchEngine`), not a model capability; v1 ships none ([WEB.md](WEB.md)).

**structured.output.** This is now ready on OpenRouter: `ProviderTurnRequest.responseSchema` becomes a strict `response_format: json_schema`, sent from Rust. Memory extraction uses it when the model's catalogue lists `structured_outputs`; otherwise it asks for JSON text and validates the answer just as strictly ([MEMORY.md](MEMORY.md)). Memory adds no capability of its own: extraction runs on the run's connection and model, or on one chosen for the agent, and embeddings use the existing `embeddings.create` route.

## Routing policy

**What the user sets.** The user maps a capability to an **ordered list of targets** in Settings › AI Capabilities. A target is a connection plus an optional model. The first target is the primary and the others are explicit fallbacks.

**Storage.** The policy is stored under the key `routing` as `{ version, routes, updatedAt }`, apart from connections. Every change emits `routing.updated`. On load, unknown capabilities and malformed targets are dropped.

**Never automatic.** Nothing rewrites the policy:
- a removed connection, a vanished model or a revoked key is **reported** in place;
- the route is never edited or replaced.

**Evaluating a target.** `checkTarget()` tests each target now, in this order:

| failure | when |
| --- | --- |
| `CONNECTION_REMOVED` | connection deleted or soft-deleted |
| `CONNECTION_UNAVAILABLE` | the last check failed (invalid key, signed out, offline…) |
| `MODEL_UNAVAILABLE` | the model is no longer in the connection's catalogue |
| `MODEL_REQUIRED` | no model and the provider has no default (OpenRouter) |
| `CAPABILITY_UNSUPPORTED` | effective support is `unsupported` |
| `CONNECTION_CHECKING` | status not checked yet (e.g. right after a restart): never assumed to work |
| `NOT_READY` | supported, but RealmNest cannot use it yet |
| ok | usable. Unknown support is allowed, with the note "support not stated by the provider" |

**Resolving a route.** `resolveRoute(cap)` returns the first ok target:
- `source: 'policy'` for the primary;
- `'fallback'` for a later target.

Fallbacks are used **only if the user listed them**. When nothing works, the result carries the primary's failure, or `NO_ROUTE_CONFIGURED` when no route is set.

**Requirements.** `canSatisfy(requirements)` checks several routes together, e.g. a future Deep Research needing `text.chat` + `web.search`.

## Who uses the routes

**Chat.** "Auto" is the default when a chat route exists:
- a new conversation resolves `text.chat` **once, when it is created** and stores `routedBy`;
- later route changes do not move existing chats;
- picking a connection by hand always wins.

If the route fails, the chat is not created and the reason is shown. RealmNest never silently falls back to another connection.

**Agents.** Agents keep their own explicit connection. An agent can instead opt into the default chat route (`useDefaultRoute`), which resolves `text.chat` at each task start. A failure blocks the task with the reason.

**Model picker.** Given a capability, the picker lists supported models first, then models whose support is unknown (with a "support not stated" badge). The catalogue itself is never trimmed; Debug uses the whole catalogue.

## Not built (by design for this milestone)

- No image generation, web search, MCP or skills: they can be routed, but they show "not in RealmNest yet". RealmNest tools work on OpenRouter models with tool calling ([TOOLS.md](TOOLS.md)); tools are not routed, they follow the agent's or chat's own connection.
- No automatic, AI-based or cost-based routing.
- No automatic retries or failover beyond the fallbacks the user configured.
- No per-request effort or reasoning settings.

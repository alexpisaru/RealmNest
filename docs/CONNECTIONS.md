# AI connections

RealmNest separates the kind of AI backend from the account it is reached with:

```
Provider (catalogue)        e.g. Claude Code · OpenAI · OpenRouter · Ollama
   └─ AIConnection          e.g. "Alex Claude", "Work Claude", "OpenRouter personal"   (many per provider)
         ├─ adapter          one AIProvider instance per connection (no shared auth state)
         ├─ models           preferred model; a catalogue only if the provider can list one
         └─ capabilities     provider/connection-level claims with provenance (models add their own)
              ▲
   Chat conversations and agents reference a connectionId, never a provider
```

| concept | where | what |
| --- | --- | --- |
| **ProviderDefinition** | `runtime/connections/catalog.ts`, plus a module per provider (e.g. `providers/claude-code/definition.ts`) | name and vendor, availability, connection methods and their fields, `create(connection)` → adapter, capability snapshot, config checks |
| **AIConnection** | `domain/connection.ts` | `providerId`, `name`, `method`, non-secret `config`, `secretNames`, `preferredModel`, `modelCatalog` (count, fetchedAt), `capabilities` (a `CapabilitySet`), `status`, `account`, timestamps, `removedAt` |
| **ConnectionManager** | `runtime/connections/manager.ts` | CRUD, one adapter per connection, real validation, persistence, events, migration seed |
| **SecretStore** | `runtime/connections/secrets.ts`, plus `src-tauri/src/secrets.rs` | where secrets go (see below) |

`ProviderService` runs turns on a **connection id**: it asks the `ConnectionManager` for that connection's adapter and stamps `connectionId` on every provider event. `LiveRuntime` and `ConversationRuntime` only know connection ids.

## Connection methods

`subscription`, `oauth`, `cli-session`, `api-key`, `local-endpoint`, `remote-endpoint`.

A provider declares only the methods it really supports. Each method declares its fields (`text`, `folder`, `url`, `secret`), and the settings UI is generated from them, so there are no provider-specific forms in React.

**Claude Code** (`cli-session`):
- **Authentication.** It uses the Claude Code sign-in on this computer; RealmNest never sees a password or token.
- **Config folder.** The optional **Claude config folder** (`CLAUDE_CONFIG_DIR`) gives the connection its own sign-in. Two connections with two folders are two Claude accounts.
- **Allowlist.** It is the only environment variable a connection may set. Both process hosts (Node and Rust) check it: it must be an absolute path to an existing folder.

**OpenRouter** (`api-key`): one secret field, kept in the OS credential store. Requests run in Rust with the key read there; the webview never holds it. See [providers/OPENROUTER.md](providers/OPENROUTER.md).

**Other providers** (OpenAI, Anthropic API, Ollama, Gemini) are listed as **Coming soon**, with no fake sign-in flow.

### Claude (your account)

The **Claude** provider is your Claude account (Pro, Max, Team), run through Claude Code underneath (the old name of the connection, "Claude Code", becomes "Claude" on load). Its model list is RealmNest's catalogue, because the CLI cannot list models: Claude Opus 5.5, Claude Fable 5.1, Claude Sonnet 5.5, Claude Haiku 5.5 (each id was run with the CLI on 14 October 2026); chats and agents pick one, or use the account default.

**Sign in / Sign out** on the connection card: RealmNest starts `claude auth login --claudeai` (the CLI opens the browser on Claude's sign-in page), the user signs in, copies the code Claude shows and pastes it into RealmNest, which hands it to the waiting CLI (`src-tauri/src/programs/claude_login.rs`). The credentials stay in the connection's Claude config folder; RealmNest never sees the password or the tokens. Only two command lines are run (`auth login --claudeai`, `auth logout`), with at most `CLAUDE_CONFIG_DIR`; the code must look like a code (letters, digits, `-_.~#=+/`).

### Anthropic API

The **Anthropic API** provider takes an API key from the Anthropic Console (billed per use). Like OpenRouter, the key stays in the credential store and the Messages API is called from Rust only (`src-tauri/src/anthropic`): one origin, no redirects, typed and size-checked content blocks (text, base64 image / PDF, tool_use, tool_result), streaming with tool calls, the key's own model list (`GET /v1/models`). Without a model choice it uses Claude Sonnet 5.5.

## Status

The status is always the result of a real check: `adapter.getStatus()`, which for Claude means detect the CLI and read `auth status`. There is no paid model call.

| status | when |
| --- | --- |
| `unknown` | not checked since RealmNest started (saved states are never trusted) |
| `checking` | a check is running |
| `connected` | the provider answered and is signed in |
| `auth_required` | installed or reachable, but not signed in. The hint gives the exact command; for a config folder that is `$env:CLAUDE_CONFIG_DIR="…"; claude auth login` |
| `invalid_credentials` | the stored key was rejected (e.g. OpenRouter 401) |
| `unavailable` | not installed, offline, or no process host |
| `error` | the check itself failed |
| `disconnected` | removed by the user |

On startup every connection is loaded as `unknown` and checked again (`validateAll`). **Test connection** checks one on demand.

**Account.** It shows the sign-in kind and plan (e.g. "Claude account · max"). The e-mail address and organisation that `claude auth status` prints are never stored.

## Capabilities and models

**Capability snapshot.** A connection stores a `CapabilitySet`, the claims of its provider definition (`ProviderDefinition.capabilities`).
- Each claim uses the shared vocabulary (`text.chat`, `vision.input`, `web.search`…) and carries provenance.
- A connection gets a snapshot only while it works; an invalid connection has none.
- Old boolean snapshots are dropped on load.

**Model-level claims.** They come from `ProviderDefinition.modelCapabilities(model)`, computed from the cached catalogue.

**Supported is not usable.** What RealmNest can actually run, and which connection is used for what, are separate questions; see [CAPABILITIES.md](CAPABILITIES.md). Nothing is claimed from names, and unknown stays unknown.

**Models:**
- A model catalogue exists only when the provider can list models (`modelListing`). It is fetched after a successful check, cached apart from the record (`model-catalogs`, 24 h TTL, **Refresh models**), and never counts as proof that the connection works. Claude Code cannot list models, so it gets no invented catalogue.
- `preferredModel` is optional. It applies to every turn that does not choose a model (the adapter is wrapped by the manager). Empty means the provider's default; OpenRouter has none, so it then asks for a model.
- Chats and agents can still set their own model.

## Secrets

API keys and tokens never go to localStorage, JSON saves, logs or events.
- **Desktop.** `TauriSecretStore` writes to the **OS credential store** (Windows Credential Manager, macOS Keychain) through three narrow commands: `secret_set`, `secret_delete`, `secret_exists`.
- **No read command.** There is deliberately no command to read a secret back: the webview can never read one (`secret_get` → *not allowed by ACL*). Provider code that needs a value will run in Rust (`secrets::read`).
- **Names.** Secrets are stored as `conn.<connectionId>.<field>` and validated in Rust. The connection record keeps only the names.
- **Browser builds.** There is no secure store (`UnavailableSecretStore`), so connections that need a secret are refused there rather than stored insecurely.
- **What may leave the app.** Events, `summaries()` and logs carry ids, names, provider, status and capabilities only. Provider errors are redacted (`process/text.ts redact`).

## Lifecycle

```
choose provider → choose method → fill fields (secrets → credential store) → save
      → adapter created → validate (real) → connected / auth_required / …
update name / preferred model / config → adapter rebuilt if config changed → revalidated
remove → soft delete: removedAt, adapter and secrets dropped, record kept for history
```

**Removing:**
- **Warning first.** The UI says which agents and how many conversations use the connection.
- **No cascade.** Conversations and tasks are never deleted: their history still names the removed connection.
- **No further turns.** A conversation on a removed connection shows a banner, and an agent on it cannot start a task until it picks another connection.

## Events

The bus carries these events, with no secrets in them:
- `connection.created`, `connection.updated` (field names only), `connection.deleted`;
- `connection.status.changed`, `connection.connected`, `connection.disconnected`.

## Chat and agents

- **Conversation.** It has a `connectionId`, plus the `providerId` kind kept for history. The connection is fixed once the conversation has started, because the provider session belongs to it. The model can change.
- **Agent** (`AgentDefinition`). It has a `connectionId`. A new agent uses the default connection: the first connected one, otherwise the first.
- **Agent chat.** It uses the agent's connection. The architecture allows overriding it later.
- **Direct chat.** The user picks a saved connection in the chat header.
- **Selectors.** They show connection names ("Alex Claude · Claude Code"), never raw ids.

## Migration from provider ids

The first start creates a **Claude Code** connection from the existing CLI sign-in. It is done once (`seeded`), so a connection the user deletes is not recreated.

Agents and conversations saved with `providerId: 'claude-code'` are mapped to that connection when loaded, and written back right away. Tasks, runs, messages and provider sessions are preserved, and resumed conversations keep their Claude session.

## Adding a provider

1. Write the adapter (`AIProvider`) in `src/runtime/providers/<id>/`.
2. Add a `ProviderDefinition` next to it, with:
   - `methods` and their fields;
   - `create(connection, { runner, secrets })`;
   - `capabilities()`;
   - `checkConfig()`.
3. Register it in `main.tsx` (`catalog.register(...)`) in place of its "coming soon" entry. The settings UI, selectors, chat and agents need no change.
4. A provider that needs a secret calls the network from Rust with `secrets::read`. The webview never holds the key.

### OpenRouter, implemented

OpenRouter is the reference for key-based providers: a Rust HTTP host with narrow commands, a TS adapter over a transport, and a definition built with `createOpenRouterDefinition(transport)`. See [providers/OPENROUTER.md](providers/OPENROUTER.md).

## Known limitations

- **Implemented providers:** Claude Code and OpenRouter; the others are catalogue entries.
- **Browser dev builds:** no secure secret storage, so key-based connections are desktop-only.
- **Second Claude account:** signing it in happens in a terminal, with the command shown in the hint. RealmNest does not run `claude auth login` itself.
- **Capabilities:** a connection-level snapshot, plus model-level claims computed from the catalogue. See [CAPABILITIES.md](CAPABILITIES.md).

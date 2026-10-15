# MCP

RealmNest uses the [Model Context Protocol](https://modelcontextprotocol.io) in two directions:

1. **MCP servers as a tool source.** A local MCP server, such as PhotoCraft or EffectCraft, offers tools. RealmNest discovers them, and they become ordinary `ToolDefinition`s in the one `ToolRegistry`.
2. **RealmNest as an MCP server for Claude Code (the bridge).** Claude Code calls RealmNest's tools through MCP, and every call still goes through RealmNest's `ToolRuntime`.

**There is no parallel MCP runtime.** After the registry, an MCP tool is the same as a native one. It goes through the same:
- `ToolRuntime`, permissions (allow / ask / deny) and approval prompt;
- call history, events, limits and cancellation;
- Debug › Tools view.

```
MCP server ─discover─▶ normalize ─▶ ToolRegistry ─▶ ToolRuntime ─▶ permissions / approval ─▶ agents, chat
                                                       │
Claude Code ─MCP─▶ RealmNest bridge ──────────────────────┘
```

See [TOOLS.md](TOOLS.md) for the tool runtime itself.

## Code map

| file | what |
| --- | --- |
| `src/domain/mcp.ts` | `McpServerConfig`, `McpServerStatus`, `McpServerState`, ids and keys |
| `src/runtime/mcp/client.ts` | `McpClient`: JSON-RPC, protocol eras, tools/list, tools/call, timeouts, cancellation |
| `src/runtime/mcp/normalize.ts` | MCP tool → `ToolDefinition`, tools/call result → `ToolResult` |
| `src/runtime/mcp/manager.ts` | `McpClientManager`: configs, lifecycle, statuses, registry sync, the executor |
| `src/runtime/mcp/transport.ts` | the native transport interface (Tauri) |
| `src/runtime/mcp/bridge.ts` | `McpBridge`: RealmNest's MCP server for Claude Code |
| `src-tauri/src/mcp/mod.rs` | stdio host: launch checks, consent, process tree, line reader, redaction |
| `src-tauri/src/mcp/bridge.rs` | the bridge host (loopback TCP, one-time tokens) and the `--mcp-bridge` relay |
| `src/ui/mcp/` | Settings › Integrations › MCP, Debug › MCP |

## Protocol

**Versions.** MCP 2026-07-28 has no handshake. Each request carries its protocol version, client info and client capabilities in `_meta` (`io.modelcontextprotocol/*`). Older servers use the `initialize` handshake (2025-11-25 and earlier). RealmNest's client is **dual-era**, as the spec asks of stdio clients:

| the server answers `server/discover` with | RealmNest |
| --- | --- |
| a `DiscoverResult` that includes 2026-07-28 | modern: `_meta` on every request |
| `UnsupportedProtocolVersion` (-32022), or no version in common | fails with a clear message; never falls back to `initialize` |
| any other error, or nothing within 5 s | legacy: `initialize` (asks for 2025-11-25; accepts 2025-06-18, 2025-03-26, 2024-11-05), then `notifications/initialized` |

**What the client handles:**
- `tools/list`: paginated, at most 20 pages and 1000 tools.
- `tools/call`: results whose `resultType` is missing or `complete`.
- `input_required` (elicitation) is refused with a clear error, because RealmNest does not support it yet.
- Legacy `ping` gets an answer; other server requests get -32601.
- `notifications/tools/list_changed` triggers a new `tools/list`.
- Resources and prompts are not used yet. The server's `instructions` are shown in Manage.

**Timeouts:**
- `server/discover`: 5 s;
- other requests: 30 s;
- `tools/call`: the server's tool timeout (default 120 s, set per server). `ToolRuntime` enforces it.

**Cancellation.** Cancelling sends `notifications/cancelled {requestId}`. A late answer to that request is ignored: its id is gone. A timed-out request is cancelled the same way.

## Local stdio servers

**The configuration** (`McpServerConfig`, stored under `mcp-servers`):
- a name, and a key that becomes the namespace of tool ids;
- an **executable** plus an **argument list**, never a command string;
- an optional working folder;
- plain environment variables;
- **secret variables**: only their names are stored. Their values live in the Windows credential store under `mcp.<server id>.<VAR>`; the page can set them, never read them back.
- startup: `manual` (the default) or `auto`;
- the tools the user turned on;
- the tool timeout, the origin (user-added or bundled), and an optional publisher/URL for a future hub.

**What Rust checks before starting** (`src-tauri/src/mcp/mod.rs`):
- **Executable:** an absolute path, or a bare name found on `PATH` and resolved to an absolute path. On Windows only `.exe` is accepted: a `.cmd`, `.bat` or `.ps1` would run through a shell.
- **Arguments:** at most 64, single lines, at most 4096 characters each.
- **Working folder:** an existing absolute folder; the default is the executable's folder.
- **Variables:** valid names. Secret variables may only reference `mcp.<this server>.<VAR>`, so a page can never pour another secret (such as an OpenRouter key) into a process.
- **Consent:** the first time a launch (executable, arguments, folder, plain variables, secret names) is seen, **a native Windows dialog asks the user**. "No" is the default button. Only "Yes" adds the launch to `mcp-trust.json` in RealmNest's own data folder, which the page cannot write. Changing any part of the launch asks again.

So even a compromised page cannot start an arbitrary program on its own.

**The running process:**
- It runs without a shell or console window, in its own kill-on-close **Job Object**. Stopping it, killing it, or RealmNest exiting or crashing ends the server and everything it started. Tested: no orphans.
- **stdout** is read one line at a time, at most 16 MB per message. A line that is not JSON is reported as invalid and does not stop the server.
- **Secret values** are replaced by `[secret]` in stdout and stderr before anything reaches the page.
- **stderr** goes to Debug, line by line, at most 2000 characters per line.
- **Writes** must be JSON-RPC 2.0 requests, notifications or responses, serialized on one line, at most 8 MB.
- **Stop:** close stdin, wait 2 s, then kill the tree.

**Statuses** come from the real process and protocol, never from the configuration alone:

| status | when |
| --- | --- |
| `disconnected` | configured, not started (after every RealmNest start, unless set to auto) |
| `starting` | process starting, protocol probe, tools/list |
| `connected` | the handshake succeeded and the tools are discovered |
| `unavailable` | the executable was not found or refused, or the user said "No" |
| `auth_required` | a secret variable has no stored value; nothing is started |
| `failed` | the handshake failed, or the server stopped unexpectedly |
| `stopped` | the user disconnected it |

## Online servers (Streamable HTTP)

Settings › Integrations › MCP › **Add** › *Online server (URL)*: a name and the server's MCP address. The same McpClient speaks to it; only the transport differs (`src-tauri/src/mcp/http.rs`, commands `mcp_http_start` / `mcp_http_send` / `mcp_http_stop`).

- **Addresses**: https only; http only for a server on this computer (127.0.0.1, localhost, ::1). No credentials in the address, no redirects.
- **Transport**: each JSON-RPC message is POSTed (`Accept: application/json, text/event-stream`); a JSON answer or a short event stream comes back and every message in it reaches the client. The server's `Mcp-Session-Id` is sent back on later requests, and `MCP-Protocol-Version` once the handshake agreed one. Disconnecting sends `DELETE` with the session.
- **API keys**: *Authentication headers* (e.g. `Authorization: Bearer …`). Values go to the OS credential store as `mcp.<id>.HDR_<NAME>` and are added in Rust; the page never reads them back. Reserved headers (Host, Content-Type, Accept, Mcp-Session-Id…) are refused.
- **OAuth** (*Sign in with an account*): discovery of the protected-resource metadata (RFC 9728) and of the authorization server (RFC 8414 / OpenID), dynamic client registration (RFC 7591), authorization code with PKCE S256 in the user's browser, the answer received once on `http://127.0.0.1:<random port>/callback`, the `resource` parameter (RFC 8707). Tokens live in the credential store (`mcp.<id>.OAUTH*`, split in pieces) and in Rust memory; they are refreshed when they expire. A 401 ends the connection as *Sign in required*. Servers that accept only pre-registered apps (no registration endpoint, or registration refused) cannot be signed in to; the message says so.
- No local process, so no Windows consent dialog: the tools still go through RealmNest's permissions and approval.
- Tested on the release with DeepWiki (`https://mcp.deepwiki.com/mcp`, public, no sign-in): connected, 3 tools, `read_wiki_structure` called from a Claude chat after approval.

## Tools from MCP servers

| | |
| --- | --- |
| id | `mcp.<server key>.<tool name>`: stable, collision-free across servers, for agents, policies and future Skills |
| model name | `<server key>__<tool>`, provider-safe (`[A-Za-z0-9_-]`, ≤ 64), with a stable hash suffix when needed |
| risk | `high`; `medium` when the server claims `readOnlyHint` without `destructiveHint`; **never low**, because low would mean allowed without asking. The MCP spec says annotations are untrusted. |
| default permission | **ask** for every MCP tool. The user can set allow / ask / never per tool (Manage, or an agent's own setting). |
| metadata | server id, key, name, the MCP tool name, the server's hints |

**Turned off by default.** A new server's tools are discovered but not offered. The user turns on the ones agents and chats may use, in Manage (search, Turn all on / off). An agent still ticks its own tools in its inspector.

**Schemas.** MCP schemas are full JSON Schema, and the validator handles:
- type unions, `null`, `anyOf`, `oneOf`, `allOf`, `const`, `enum`, ranges, lengths and items;
- unknown keywords (`format`, `default`…), which are kept and passed to the model.

Some tools are skipped, with the reason shown in Manage:
- tools with an invalid name;
- tools whose input is not an object schema;
- tools with an external `$ref` (never fetched);
- tools whose schema is over 16 KB, which providers refuse.

**Disconnect, crash and reconnect:**
- When a server stops, its tools stay listed but unavailable (no executor), so agents keep their ticks and history keeps its calls. A call in flight fails with `TOOL_UNAVAILABLE`.
- On reconnect the tools are rediscovered: new ones are added, removed ones unregistered, and changed schemas replaced. A call is always validated against the **current** schema, never a cached one.
- A server error for an unknown tool also triggers a refresh.
- After a restart, the last discovered list (`mcp-tools-cache`) lists the turned-on tools as unavailable until the server connects again.

**Results** become `ToolResult`s:
- text parts are joined for the model, at most 64 KB;
- `structuredContent` becomes `structuredData`;
- `isError: true` becomes a failure (`TOOL_EXECUTION_FAILED`), with the server's text;
- JSON-RPC errors become `MCP_ERROR`.

Every part is kept in `parts` (`text`, `image`, `audio`, `resource_link`, `resource`) for future Artifacts and attachments:
- binary data is kept in memory only, up to 8 MB per part, and is never stored;
- the model gets a description such as `[image image/png, 23 KB]`.

**At scale:**
- A model turn gets at most **32 tools** (`MAX_OFFERED_TOOLS`): RealmNest's own first, then the agent's ticks in order.
- When more are on, the chat's Tools button and the agent panel say how many were left out, and Manage warns above 32.
- There is no semantic tool search yet; Skills or a tool router will handle large catalogues later.

## The Claude Code bridge

Claude Code runs its own agent loop, so RealmNest cannot run its tools between turns as it does for OpenRouter. Instead, **RealmNest is an MCP server that Claude connects to**, and it serves only the tools allowed for that run:

```
claude.exe ─stdio─▶ realmnest-os.exe --mcp-bridge ─TCP 127.0.0.1─▶ BridgeHost ─▶ McpBridge (page)
                    (relay, no window)        one-time token                 tools/call → ToolRuntime
```

**A run with tools on Claude Code:**

1. `ToolService` sees that the adapter declares `toolBridge` and opens a bridge session.
2. Rust writes an MCP config to `%LOCALAPPDATA%\app.nestra.desktop\realmnest-bridge\<session>.json`. It names this executable with `--mcp-bridge`, the loopback address and a random 256-bit token.
3. Claude is started with:
   - `--mcp-config <that file> --strict-mcp-config`: no other MCP source;
   - `--allowedTools mcp__realmnest__…`: only the run's tools, so Claude does not ask on its own;
   - `--tools ""`: Claude's built-in tools (Bash, Read…) are off; verified, only `mcp__realmnest__*` remain;
   - `--permission-prompts none`: anything else that would ask is denied.
4. The relay connects and sends the token. Rust pairs it with the session: loopback only, one connection per token.
5. Every `tools/call` goes to `ToolRuntime.execute` with the run's scope. That means the same checks, permission, **approval prompt** and history.
6. When the run ends or is cancelled, the session closes: the relay exits, calls waiting for approval are cancelled, and the config file is deleted.

**No double approval.** Claude does not ask, because the run's tools are pre-allowed in Claude. RealmNest's policy decides: allow runs, ask shows RealmNest's prompt, deny refuses.

**What Claude sees:**
- tools named `mcp__realmnest__<name>`, with the name kept under 64 characters;
- images from tools, as MCP image content;
- refusals and errors as `isError` results such as `RealmNest: … (APPROVAL_DENIED)`.

**Protocol details.** Claude Code 2.1.295 is a modern client: it probes `server/discover` and sends `_meta`. It **requires `ttlMs`** on `tools/list`; the bridge sends `ttlMs: 0` and `cacheScope: private`. Legacy `initialize` is answered too.

**Allowlist.** In Rust (`programs/claude.rs`) and in TS (`args.ts`), with shared cases in `args.cases.json`:
- `--mcp-config` must be a `realmnest-bridge\<id>.json` file, and in the app it must be inside RealmNest's own folder;
- `--allowedTools` may contain only `mcp__realmnest__…` names;
- both require `--strict-mcp-config`.

**Readiness.** For Claude Code, `tools.calling` is now **ready in the desktop app**, through the bridge. In the browser build there is no bridge, and the UI says so.

## UI

**Settings › Integrations › MCP:**
- the list of servers, each with name, transport, real status, tools (discovered and on), server version, protocol, startup and last connection;
- actions: Connect / Disconnect / Restart / Manage;
- **Manage:** tools with search, on/off, per-tool permission and the server's claim (read-only / changes data), skipped tools with reasons, program, origin, server instructions, Edit configuration, Delete;
- **Add / Edit form:** name, executable, arguments (one per line), working folder, `NAME=value` variables, secret variables (password fields, "saved" when a value exists), startup, tool timeout;
- a short warning about third-party software, until the user dismisses it.

**Approval prompt:** for MCP tools it also shows the server and the MCP tool name.

**Agent inspector › Tools:** tools are grouped as "RealmNest" and one group per server. Unavailable tools are struck through but can still be ticked.

**Debug › MCP:** per server, it shows:
- status, protocol and era, server info, pid and executable, tool counts, startup and error;
- the last messages, with direction, method and size only, never payloads;
- stderr (redacted).

## Security

| risk | what RealmNest does | what it cannot do |
| --- | --- | --- |
| the page starts an arbitrary program | Rust starts only `.exe` with argv, no shell, and only launches the user approved in a native dialog | — |
| a server is malicious | RealmNest decides **whether to call** its tools (permissions, approval, input shown) | **RealmNest does not sandbox the server process.** Once started it runs with the user's rights and can read files, use the network or start programs. Only install servers you trust. |
| arguments smuggled to a tool | strict schema validation before any call | — |
| secrets | values only in the credential store, given to the process by Rust, redacted in stdout and stderr, never in storage, events or Debug | a server can still misuse a secret it was given |
| another connection's key | secret variables can only reference `mcp.<this server>.*` | — |
| a runaway server | per-call timeout, size caps, loop limits, kill of the whole tree | — |
| auto-start | manual by default; auto only by the user's choice, and still only an approved launch | — |
| the bridge port | loopback only, a 256-bit one-time token per run, closed with the run | another program of the same user could connect while a run is open if it read the token from the config file, but that program already runs with the user's rights |
| Claude's own tools | `--tools ""`, `--strict-mcp-config`, `--allowedTools` limited to `mcp__realmnest__…`, `--permission-prompts none` | — |

**Annotations** (`readOnlyHint`…) are shown and only *raise* caution: an MCP tool is never treated as low risk.

**Double confirmation.** A server with its own confirmation flow would ask after RealmNest's approval. RealmNest stays authoritative for whether the call happens at all.

## Acceptance (desktop release, 13 October 2026)

- **PhotoCraft 0.7.0** (`photocraft-cli.exe mcp --automation-read-root … --automation-write-root …`):
  - added with executable + arguments; "Non connesso" until connected;
  - native consent: "No" leaves it unavailable and starts no process; "Sì" connects;
  - modern 2026-07-28, **21 tools** discovered;
  - turned on `doc_open` (ask), `doc_inspect` and `session_list` (allow), `render_preview` (ask).
- **Chat** on OpenRouter Nemotron 3 Super (free), tools on:
  - "open gradient.png and inspect it": `doc_open` showed the approval prompt with server and input, then ran after "Allow once";
  - `doc_inspect` then reported 64×48, one Background layer.
- **Agent** Alex on OpenRouter:
  - an approved `doc_open` ran;
  - a denied `doc_open` was refused, and Debug › MCP shows it never reached PhotoCraft.
- **EffectCraft 0.8.0**:
  - connected as a **legacy** server: protocol **2025-06-18** via `initialize`, 27 tools;
  - one chat turn used EffectCraft `get_project` and PhotoCraft `session_list`;
  - with PhotoCraft disconnected, EffectCraft `get_state` still worked.
- **Crash:**
  - killing EffectCraft's process gave status "Errore: the server stopped unexpectedly (code 1)" and made its tools unavailable;
  - PhotoCraft kept working and the app stayed responsive.
- **Restart:**
  - configs survived;
  - PhotoCraft (set to auto) connected by itself, EffectCraft (manual) stayed "Non connesso";
  - no orphan server processes from the killed instance.
- **Claude bridge:**
  - a Claude Code chat used `get_current_time` (native) and PhotoCraft `session_list` through RealmNest;
  - "open gradient.png" showed **RealmNest's approval prompt**, waited 12 s, ran after approval, and Claude answered with the real size and layers;
  - Alex on Claude Code with `doc_open` denied: refused in RealmNest, never reached PhotoCraft.
- **The free model** sometimes wrote a tool call as text, or invented an answer without calling. RealmNest shows no tool call in that case. That is the model, not RealmNest.

## Limitations and next steps

- **Transport:** only stdio. The client is transport-agnostic (`McpTransportHost`); Streamable HTTP can reuse it.
- **Not supported yet:** elicitation (`input_required`), sampling, roots, resources and prompts, and `subscriptions/listen` (modern list-change notifications). The tool list refreshes on reconnect, on unknown-tool errors, and on legacy `list_changed`.
- **No automatic restart** of a crashed server: the user restarts it.
- **MCP tools are not sandboxed**, see Security.
- **Claude bridge:**
  - desktop app only;
  - Claude's own MCP timeouts apply while a call waits for approval;
  - the bridge's own traffic is not yet shown in Debug.
- **Large catalogues:** Skills ([SKILLS.md](SKILLS.md)) now offer only the MCP tools they need; their portable form `{mcpServer, tool}` matches a server by key, name or reported name.

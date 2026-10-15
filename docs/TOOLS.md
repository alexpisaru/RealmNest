# Tools

A **tool** is a real action a model can ask RealmNest to perform: read a file, write a file, tell the time. The model only *asks*. RealmNest decides whether the call may run, asks the user when needed, runs it and sends the result back. The model never executes anything itself.

```
model ──tool.requested──▶ ToolLoop ──▶ ToolRuntime ──▶ executor (native / later MCP, CLI…)
  ▲                                     │ known? enabled? valid input?
  │                                     │ permission: allow / ask (prompt) / deny
  └──────── tool message (result) ◀─────┘ timeout, cancel, events, history
```

**Kept separate:**

| term | meaning |
| --- | --- |
| Capability | what a provider/model can do (`tools.calling` = it accepts tool schemas). See [CAPABILITIES.md](CAPABILITIES.md). |
| Tool | one action RealmNest can run, with a schema and a risk (this document). |
| Skill / Plugin | a package of instructions and/or tools. Not built yet. |
| MCP / CLI / HTTP | future *sources* of tools. They register in the same registry. |

## Code map

| file | what |
| --- | --- |
| `src/domain/tool.ts` | `ToolDefinition`, `ToolCall` (+ statuses), `ToolResult`, `ToolError` codes, `ToolSchema` |
| `src/runtime/tools/registry.ts` | `ToolRegistry`: the one list of tools and their executors |
| `src/runtime/tools/schema.ts` | input validation (a strict JSON Schema subset) |
| `src/runtime/tools/policy.ts` | `ToolPolicyStore` (workspace, global permissions) and `resolvePermission` |
| `src/runtime/tools/runtime.ts` | `ToolRuntime`: the only way a tool runs |
| `src/runtime/tools/loop.ts` | `ToolLoop`: the explicit model ⇄ tools loop, with limits |
| `src/runtime/tools/service.ts` | `ToolService`: which tools a run is offered; used by agents and chat |
| `src/runtime/tools/native.ts` | the four native tools and the Tauri host |
| `src-tauri/src/tools/` | the filesystem sandbox, in Rust (`mod.rs`, `tests.rs`) |
| `src/ui/tools/` | approval prompt, call list, settings, agent tools, Debug › Tools |
| `src/runtime/mcp/` | MCP servers as a tool source, and the Claude bridge ([MCP.md](MCP.md)) |

## ToolDefinition

| field | |
| --- | --- |
| `id`, `name` | `^[a-z][a-z0-9_]{1,63}$`; the name is what the model sees |
| `description` | sent to the model |
| `source` | `native` and `mcp` work; `cli`, `http`, `plugin` are reserved |
| `inputSchema` | object schema; unknown properties are refused unless `additionalProperties: true` |
| `outputSchema?` | documentation only for now |
| `risk` | `low`, `medium`, `high` |
| `permissions` | `default?` (allow/ask/deny) and `ceiling?` (`ask` or `deny`: the most a user can loosen it) |
| `needsWorkspace?` | the tool works inside the workspace folder |
| `cancellable`, `timeoutMs` | every tool has a timeout |
| `version?`, `metadata?` | never sent to providers |

The registry refuses duplicate ids or names, bad ids, schemas that are not objects or name a required property that does not exist, and tools without a timeout. A tool can be registered without an executor: it is listed, but marked unavailable and never offered.

## Native tools

| tool | risk | default | what |
| --- | --- | --- | --- |
| `get_current_time` | low | allow | local ISO time with offset and time zone |
| `list_directory` | low | allow | entries of a workspace folder (`[dir]`, `[link]`, size), max 500 |
| `read_text_file` | low | allow | a UTF-8 file of at most 256 KB |
| `write_text_file` | medium | ask | creates or replaces a UTF-8 file of at most 256 KB, creating folders |
| `search_knowledge` | low | allow | searches the Knowledge bases selected for this run and returns labelled passages (K1…); see [KNOWLEDGE.md](KNOWLEDGE.md) |
| `web_fetch` | low | allow (ask for unseen addresses) | reads one public http(s) page through Rust (SSRF guard, limits) and returns its readable text as an untrusted `<web_page label="W1">` block; see [WEB.md](WEB.md) |
| `web_search` | low | allow | searches through the configured compliant engine; **none in v1**: answers `SEARCH_PROVIDER_NOT_CONFIGURED`; results are discovery only (R1…), never cited |

`search_knowledge` is **run-scoped** (`metadata.runScoped`): it is never in the general tool pool, the Tools switch or a Skill picker. RealmNest adds it to a run that has Knowledge (when the model can call tools), and in STRICT mode it is the only tool besides the active Skills' tools. The executor finds the run by `runId` and searches only that run's bases; the model cannot name a base or a file.

`web_fetch` and `web_search` are run-scoped the same way: they exist only in runs where the Web is on (chat globe or agent **Web access**), and outside one they answer `TOOL_NOT_ALLOWED`. `ToolRuntime` has an `escalate(toolId, input, scope)` hook: it can turn an *allow* into *ask* for one call, never the reverse; `web_fetch` uses it for addresses that did not come from the user, a search result or a page read in the run (`ToolCall.approvalReason`, shown on the approval card). Budgets per answer: 6 pages, 4 searches.

The file tools need the desktop app. In the browser build they are listed as unavailable.

## Workspace sandbox (Rust)

The page never gets a generic filesystem command. Only three narrow commands exist (`tool_list_directory`, `tool_read_text`, `tool_write_text`), each with its own Tauri permission. All path checks run natively in `src-tauri/src/tools/mod.rs`:

- **Workspace root:** must be absolute, must exist, and must be a folder. It is canonicalized and may not be a drive root. It may not be, contain or sit inside a protected folder: RealmNest's own app data, `AppData` (Roaming and Local, so also the Startup folder), Windows, Program Files, ProgramData, the user profile folder itself, `.ssh`, `.claude`, `.codex`, `.aws`, `.config`, `.gnupg`. Reads and every write target are checked against the same list again.
- **Relative path:** split into parts. Absolute paths, drive letters, UNC and `\\?\` paths are refused, and so are `..`, `:` (alternate data streams), device names (`CON`, `NUL`, `COM1`…), names ending in a dot or space, and control or reserved characters. The maximum length is 512 characters.
- **Reads and listings:** the target is canonicalized and must still be inside the canonical root, so symlinks and junctions that lead out are refused.
- **Writes:**
  - never through a link: every existing part is checked for symlinks and reparse points (junctions), and the final file as well;
  - missing folders are created one at a time and checked again;
  - the content goes to a temporary file in the same folder, then replaces the target atomically.
- **Content:**
  - only valid UTF-8 is read (`NOT_A_TEXT_FILE` otherwise);
  - files over the limit get `FILE_TOO_LARGE` and are not read;
  - the size limits apply in Rust too, so the page cannot raise them.

Covered by `cargo test`: traversal, absolute, drive, UNC, `\\?\`, ADS, device names, sizes, non-UTF-8, listing cut-off, escape through a junction (`mklink /J`), drive root.

**Workspace folder:**
- Settings › General › Tools sets the general folder.
- An agent can set its own folder in its Tools section.
- A chat with an agent uses that agent's folder (taken when the chat is created); otherwise it uses the general folder.

## Permissions

**Three values:**
- `allow` runs without asking;
- `ask` shows the approval prompt;
- `deny` never runs, and the model is told so.

**Precedence (`resolvePermission`).** The first value that is set wins:

1. the agent's choice (`AgentDefinition.toolPermissions`);
2. the user's global choice (Settings › General › Tools);
3. the tool's own default;
4. the risk default: low means allow, medium and high mean ask.

After that, the tool's **ceiling** caps the result: a tool with ceiling `ask` can never be set to allow. A global **never** is a ceiling too: an agent's "always allow" cannot override it. A call that is escalated (for example `web_fetch` to an address nobody gave) always asks, even after "allow for this run".

**Which tools a run sees:**
- An **agent** uses only the tools ticked in its Tools section (`allowedToolIds`).
- A **chat** with Tools on uses every runnable tool the user has not set to `deny`.
- A tool set to `deny`, or one that cannot run here, is never offered to the model.

## Approval prompt

A modal shows:
- who is asking ("Alex", "Chat");
- the tool, its risk and description;
- the path and the workspace folder;
- the **complete input** as formatted JSON.

**Choices:**

| button | effect |
| --- | --- |
| Nega | the call is `denied` (`APPROVAL_DENIED`); the model gets the error and may answer without it |
| Consenti una volta | runs this call only |
| Consenti per questo task / risposta | no more prompts for this tool until the run ends |
| Consenti sempre per *agente* | (agents only) stores `allow` on the agent for this tool |

Several pending calls queue up, oldest first. Stopping the run while a prompt is open cancels the call (`TOOL_CANCELLED`). The decision goes to `ToolRuntime.decide()`; the UI never runs anything.

## Call lifecycle

```
requested ─▶ awaiting_approval ─▶ approved ─▶ running ─▶ completed
     │               │                            ├──▶ failed (error, timeout)
     │               ├──▶ denied                  └──▶ cancelled
     └──▶ denied / failed (not found, not enabled, invalid input, workspace missing)
```

Each step is an event: `tool.requested`, `tool.awaiting_approval`, `tool.approved`, `tool.denied`, `tool.started`, `tool.completed`, `tool.failed`, `tool.cancelled`. Changing settings emits `tool.policy.updated`. **Events carry ids and the error code only.** Inputs and outputs stay in the call record, never in the event log.

**Results.** A `ToolResult` holds `success`, `content` (text for the model), `structuredData`, `artifacts` (e.g. `{kind:'file', path, action:'created'|'updated', bytes}`) and `error {code, message}`. The model receives `{"ok":true,"content":…}` or `{"ok":false,"error":{code,message}}`.

**Error codes:** `TOOL_NOT_FOUND`, `TOOL_NOT_ALLOWED`, `APPROVAL_DENIED`, `INVALID_TOOL_INPUT`, `TOOL_TIMEOUT`, `TOOL_CANCELLED`, `WORKSPACE_REQUIRED`, `PATH_OUTSIDE_WORKSPACE`, `FILE_NOT_FOUND`, `FILE_TOO_LARGE`, `NOT_A_TEXT_FILE`, `TOOL_UNAVAILABLE`, `TOOL_EXECUTION_FAILED`, `TOOL_CALL_LIMIT_REACHED` (the run fails with provider code `tool_call_limit`).

## ToolLoop and limits

To its caller (`LiveRuntime`, `ConversationRuntime`), a tool run looks like one ordinary provider run: a single `provider.started`, the text deltas, cumulative usage and exactly one terminal event.

**Each turn:**
1. The loop sends the messages and the offered `toolSchemas`.
2. It collects every `tool.requested` from the model.
3. It runs the calls in order through `ToolRuntime`.
4. It appends an assistant message (`toolCalls`) and one `tool` message per call (`toolCallId`).
5. It sends the next turn.

| limit | default | when exceeded |
| --- | --- | --- |
| tool calls per run | 10 | run fails, `tool_call_limit` |
| the same tool with the same input | 2 | run fails, `tool_call_limit` |
| failed or refused calls in a row | 3 | run fails, `tool_call_limit` |
| model turns per run | 12 | run fails, `tool_call_limit` |

**Cancel:**
- stops the current provider turn;
- aborts a waiting approval or a running tool;
- ends the run as `cancelled`.

## Providers

**Neutral contract (`providers/types.ts`):**
- `ProviderTurnRequest.toolSchemas` lists the tools on offer;
- `ProviderMessage` can be `assistant` with `toolCalls`, or a `tool` message with `toolCallId`;
- the model asks through the normalized event `tool.requested {toolCallId, name, input}`;
- an adapter that supports this declares `capabilities.toolCalling`.

Tool calls are always native function calling. RealmNest never parses natural language.

**OpenRouter: yes.**
- The page sends OpenAI-style `tools` (with `tool_choice: "auto"`). Tool calls stream in fragments by index, and the Rust host assembles them before `done`.
- **Rust limits:**
  - at most 32 tools;
  - each schema at most 16 KB;
  - at most 16 calls per answer;
  - arguments are size-capped;
  - `tool_calls` is accepted only on assistant messages, and `tool_call_id` only on tool messages.
- **Which models get tools:** only those whose catalogue lists the `tools` parameter (effective `tools.calling` = supported). Any other model runs an ordinary turn, and the agent panel says so.
- **Credits:** the owner's account has no credits. `nvidia/nemotron-3-super-120b-a12b:free` works with tools and was used for acceptance. Paid models need credits.

**Claude Code: yes, through the RealmNest MCP bridge (desktop app).**
- Claude Code runs its own agent loop, so RealmNest serves the run's tools to it as an MCP server. The adapter declares `toolBridge`, and `ToolService` uses the bridge instead of the ToolLoop.
- Every call still goes through `ToolRuntime`: the same permission, approval prompt and history. Claude's own tools stay off (`--tools ""`), and only `mcp__realmnest__…` are allowed.
- RealmNest never parses tool-like text and never exposes Claude's built-in shell or filesystem.
- See [MCP.md](MCP.md#the-claude-code-bridge).

**Capabilities.** `tools.calling` is ready when:
- the adapter declares `toolCalling`, or `toolBridge` and the bridge is available (desktop);
- at least one tool can run here (`CapabilityService.useToolCount`).

The flags `supported`, `available`, `ready` and `routed` stay separate, as everywhere else.

## Persistence

**Call history:**
- stored under `tool-calls`, written through `CoalescedWriter`;
- the last **300** calls are kept, and inputs and outputs are cut to **4000 characters** each in storage (the model always gets the full result);
- calls that were still open when RealmNest closed come back as `cancelled`.

**Settings:**
- the workspace and global permissions are stored under `tool-policy`;
- agent tools and permissions are stored with the agent;
- the chat's Tools switch is stored with the conversation (`toolsEnabled`).

**Never stored:** no secrets, and no file content beyond the 4000-character excerpt in history.

## UI

- **Settings › General › Strumenti:** the workspace folder and the permission of each tool.
- **World › agent inspector › Tools:**
  - tick the tools the agent may use;
  - set a permission per tool and the agent's own folder;
  - a warning appears when the chosen model cannot call tools.
- **Run panel and chat replies:** each call shows its tool, path, status and error.
- **Chat composer:** the **Strumenti** switch, disabled when the model cannot call tools.
- **Simulation › Debug › Tools:**
  - the registry (source, risk, effective permission, whether it runs here, schema on hover) and the workspace;
  - recent calls, which expand to the full stored record;
  - `tool.*` events.

## Adding tools later

- **MCP:** done. Local stdio servers register their tools as `source: 'mcp'`, with ids `mcp.<server>.<tool>`. See [MCP.md](MCP.md).
- **CLI / plugins:**
  - register `ToolDefinition`s with their own `source` and an executor that calls the process;
  - permissions, approval, history and UI work unchanged; the bridge counts calls per session with the same limits as the loop (total, the same call repeated, failures in a row) and ends the run with `tool_call_limit` past them.
- **Skills:** done ([SKILLS.md](SKILLS.md)). A Skill declares the tools it needs; when it is active, only those (plus the agent's own) are offered, and `read_skill_resource` reads its files. The registry stays the only list of tools.
- **Artifacts:** `ToolResult.artifacts` already records files a tool created or changed. A future Artifacts view can collect them per run.

## Security review

| risk | mitigation |
| --- | --- |
| a model escapes the workspace | Rust-only path resolution, canonicalization, link and junction checks, no generic FS command; tested |
| a model runs arbitrary commands | no shell, process or HTTP tool exists; the frontend has no command that runs programs or fetches URLs |
| a model invents arguments | strict schema validation; unknown properties refused |
| a model writes without consent | `write_text_file` is medium risk and asks by default; the prompt shows the full content |
| a call or tool loop runs away | per-tool timeout; limits on total, identical and failed calls and on turns |
| leaking data through logs | events carry ids and codes only; stored inputs/outputs truncated |
| secrets | tools never receive API keys; nothing in tools touches the credential store |
| Claude Code's own tools posing as RealmNest tools | never exposed: Claude runs with `--tools ""`, `--strict-mcp-config` and `--allowedTools mcp__realmnest__…`, and every bridged call goes through ToolRuntime |
| MCP servers | see [MCP.md](MCP.md#security): native consent before a launch, no shell, Job Object, redaction; servers themselves are not sandboxed |

## Known limitations

- **Hard links:** a hard link inside the workspace to a file outside it cannot be told apart from a normal file, and would be read or written. Do not use a folder with hard links to sensitive files as the workspace.
- **Native file operations are not interruptible.** They are short and atomic. A timeout or cancel ends the call in RealmNest right away, but an operation already started in Rust finishes.
- **The approval prompt is modal.** While it is open, the run panel's Cancel cannot be reached; Nega stops that call.
- **Tool order:** a turn's calls run one after another, not in parallel.
- **Claude Code gets tools only in the desktop app**, through the bridge. Claude's own MCP timeouts apply while a call waits for approval.
- **At most 32 tools per model turn** (`MAX_OFFERED_TOOLS`). The UI says how many were left out.

# Agent runtime

The provider layer ([PROVIDERS.md](PROVIDERS.md)) answers **"how do I talk to a model?"**. The runtime answers **"what is this agent doing right now?"**. The world only draws what the runtime says.

```
 User ──task──▶ LiveTaskPanel (inspector)
                     │ startTask / cancel
                     ▼
               ┌──────────────┐  records   ┌───────────────────┐
               │ LiveRuntime  │──────────▶ │ RuntimeRepository │ (StorageAdapter, key "runtime")
               └──────────────┘            └───────────────────┘
                 │   ▲  normalized ProviderEvents
            run  ▼   │
               ProviderService ──▶ ClaudeCodeProvider ──▶ ProcessRunner ──▶ claude (Node bridge | Tauri native)
                     │
   EventBus ◀────────┘ domain events: agent.status.changed, task.status.changed, agent.run.*
       │              world events:  agent.work.started / completed / failed, agent.idle
       ▼
   WorldSim (visual) ──▶ character walks to its desk, works, returns to idle
```

## Concepts (`src/domain/agent.ts`)

| concept | what it is | lives in |
| --- | --- | --- |
| **Character** | visual identity: name, role, look, world | `domain/character.ts`, AppStore save |
| **AgentDefinition** | how the agent executes. `id` is the character's id (one agent per character); also `connectionId` (an AI connection, see [CONNECTIONS.md](CONNECTIONS.md)), `model?`, `instructions?`, `workspace?` | LiveRuntime + repository |
| **AgentTask** | what the user asked: `prompt`, `title`, `status`, `runIds` | LiveRuntime + repository |
| **AgentRun** | one attempt at a task. It holds:<br>• `connectionId` and `providerId` (its kind, kept for history), `model`, `status`<br>• timestamps<br>• `output` (streamed), `result` (final), `error`<br>• `sessionId`, `usage`, `costUsd` | LiveRuntime + repository |
| **Provider turn** | the model execution inside a run: `ProviderService.run(…, { runId: run.id })` | provider layer |

A task holds a list of runs, so retries and fallbacks can add attempts later. Name and role are never copied onto the agent: they are read from the Character and put into the system prompt as "You are Alex, Developer…", followed by the agent's instructions.

The sim's `Task` (`domain/sim.ts`: title, progress) is only what the world displays. `LiveRuntime` builds one from an `AgentTask` for the world events. A live task has no measurable progress, so its progress stays 0.

## State machines

All three are code-enforced: an illegal transition throws.

```
agent:  idle ──▶ starting ──▶ working ──▶ idle
                    └──────────────────────▶ idle   (failed or cancelled before the provider started)

task:   queued ──▶ running ──▶ completed | failed | cancelled

run:    starting ──▶ running ──▶ completed | failed | cancelled
             └──────────────────▶ completed | failed | cancelled
```

Outcomes (completed, failed, cancelled) are stored on the **run and the task**. The agent itself only goes back to `idle`, so it can take the next task. `status(agentId)`, from the `AgentRuntime` contract, reports `working` for `starting` and `working`.

## Event flow

| provider event | LiveRuntime does | events it emits |
| --- | --- | --- |
| (task started) | creates the task (`queued`, then `running`) and the run (`starting`); agent `idle` → `starting` | `task.status.changed` ×2, `agent.status.changed`, `agent.run.started`, `agent.work.started` (the character heads to its desk) |
| `provider.started` | run `running`; agent → `working` | `agent.run.status`, `agent.status.changed` |
| `session.started` | stores `sessionId` | none |
| `text.delta` | appends to `run.output`; schedules a coalesced save | `agent.run.output.delta`, delivered to listeners but **not logged** |
| `usage.updated` (cumulative) | stores usage and cost | none |
| `run.completed` | run and task `completed`; stores `result`; agent → `idle` | `agent.run.completed`, `agent.work.completed`, `agent.idle` |
| `run.failed` | run and task `failed`; stores `error {code, message, detail}`; agent → `idle` | `agent.run.failed`, `agent.work.failed` (alert bubble), `agent.idle` |
| `run.cancelled` | run and task `cancelled`; agent → `idle` | `agent.run.cancelled`, `agent.idle` |
| anything after a terminal event | ignored, so there is never a completion after a cancel | none |

Every runtime event is emitted with `origin: 'live'`. The Events tab marks those rows with a **live** tag; mock events carry no origin.

## Runtime truth

- **The world never decides that an agent works.** `WorldSim` only reacts to the world events above, and `LiveRuntime` emits them only from real run transitions.
- **Simulation commands do nothing to live agents.** In live mode, `LiveRuntime.dispatch`, `tick` and `reset` are no-ops, so Start work, Break, Huddle, Randomize and Force state cannot make a live agent look busy. The debug "send to tile" still moves a character, but it is a visual tool and changes no state.
- **A run that ends during the walk to the desk.** The character arrives `idle`, never `working` (`WorldSim.arrive`; regression test in `liveRuntime.test.ts`).
- **A world opened during a run.** `attach()` replays `agent.work.started` (`resumed: true`), so the character shows the work that is really going on.

## Mock or live

`Settings.runtimeMode` (`'mock' | 'live'`) is switched in Simulation › Controls (Mock | Live). `SessionManager.syncFromStore` is the one place that chooses:
- **mock:** each world session creates its own `MockRuntime`, as before. Demos, visual work, offline.
- **live:** the world session uses the app's single `LiveRuntime` (created in `main.tsx`). Live agents stay idle until they get a task.

The two never mix: a session has exactly one runtime, and runs exist only in the live one. Runs keep going if you switch world or mode. They show up again when their agent's world is opened in live mode.

## Concurrency

- **Per agent.** There is no global "current run". `LiveRuntime` keeps a map from agent to active run: at most one per agent, refused with a clear error if busy.
- **Many agents at once.** Each run has its own id in the provider layer and in the native process host. A test covers two agents running at once with isolated outputs.
- **Orchestration** (queues, delegation, scheduling) is not implemented.

## Cancellation

The Cancel button in the inspector follows this chain:
1. `LiveRuntime.cancel(agentId)`
2. `ProviderRun.cancel()`
3. `AbortSignal`
4. `TauriProcessRunner`
5. `process_cancel(id)`, or in dev the Node bridge connection closes
6. the Job Object kills `claude.exe` and its descendants
7. `run.cancelled` → run and task `cancelled`, agent `idle`

## Persistence (`src/runtime/live/repository.ts`)

- **Storage.** Under the `runtime` key of the existing `StorageAdapter` (localStorage today), separate from the main save: `{ version, agents, tasks, runs }`.
- **Writes.**
  - Saved immediately at every status change and every agent edit.
  - Streaming only schedules a save (coalesced, 1 s), so tokens are not written one by one.
- **Bounds.** The newest 200 tasks (and their runs) are kept, and outputs are capped at 200k characters.
- **On start.** Runs that were still going when RealmNest closed are marked `failed` / `interrupted` (their process died with the app), with their task.
- SQLite can replace the adapter later without touching the runtime.

## UI

- **Simulation › Controls:** Mock | Live switch. In live mode the mock commands are hidden.
- **Agent inspector (live mode):** provider, model, runtime status and instructions, plus:
  - the task box with **Run task**, which becomes **Cancel** while a run is going;
  - the streamed output, then the final result or error;
  - earlier tasks with their outcome.
- **Events tab:** live runtime events tagged **live**. Text deltas are not logged.

## Default route

Agents keep an explicit connection. **Default chat route** in the agent's AI select sets `useDefaultRoute`:
- each task start resolves `text.chat` from the routing policy and runs on that connection and model;
- a failing route blocks the task with its reason.

See [CAPABILITIES.md](CAPABILITIES.md).

## Knowledge

An agent's `knowledgeBaseIds` and `knowledgeMode` (inspector › Knowledge) apply to its tasks: the task text is searched before the provider call, the sources travel with the task message, and `search_knowledge` is added to the agent's tools when its model calls tools (STRICT keeps only it and the active Skills' tools). `AgentRun.knowledge` keeps the bases, mode, searches, retrieved chunks (label, generation, score), citations, invalid labels, the grounding report and the embedding model of each base. In STRICT mode with nothing found and no tools, the run completes with RealmNest's own answer and no provider call. See [KNOWLEDGE.md](KNOWLEDGE.md).

## Memory

An agent's `memory` setting (inspector › Memory: Off, Review before saving (the default), or Automatic) applies to its tasks and to its chats:
- before the provider call, its approved memories relevant to the task are searched and travel with the task message, framed as context below the user;
- `search_memory` is added when its model calls tools;
- after a completed task, a short extraction may **propose** memories for the user to review.

`AgentRun.memory` records the memory ids, labels, scores and searches. Memory belongs to the agent, not to its connection, so switching provider keeps it. In Strict Knowledge runs memory is off. See [MEMORY.md](MEMORY.md).

## Web

An agent's **Web access** (inspector › Web, `AgentDefinition.webAccess`, off by default) applies to its tasks and to its chats:
- the task gets the **# Web** rules (web content is untrusted, cite pages read as `[W1]`…), and `web_fetch` / `web_search` are added when its model calls tools;
- with a model that cannot call tools, the addresses in the task (up to 2) are read before the provider call and travel with the task, framed as `<web_page>`;
- a `web_fetch` of an address that came from nowhere the user can see (not in the task, not a search result, not a link on a page read in this run) asks for approval first.

`AgentRun.web` records the pages read (URL, final URL, title, site, dates, method, cache, hash, which tool call), searches, citations, invalid labels and the grounding check. In Strict Knowledge runs the Web is off (`web.skipped`). With no search engine configured (v1), `web_search` answers `SEARCH_PROVIDER_NOT_CONFIGURED`. See [WEB.md](WEB.md).

## Known limitations

- **One run per agent**, no queue: a new task is refused while the agent is busy.
- **Single-turn tasks.** The run uses no session, so a new task does not see earlier ones (Chat is the next milestone).
- **Tools.** An agent can use RealmNest tools, native and MCP (the Tools section of its inspector, grouped by source). There are two paths:
  - OpenRouter models with tool calling run through the ToolLoop;
  - Claude Code runs through the RealmNest MCP bridge (desktop app) and sees only the agent's ticked tools.

  Either way every call goes through ToolRuntime: permissions, approval, history. Claude's own built-in tools stay off. See [TOOLS.md](TOOLS.md) and [MCP.md](MCP.md).
- **Skills.** An agent's Skills (inspector › Skills) are activated before each task. The steps:
  - the Skill context joins the system prompt after the agent's own;
  - only the Skills' tools (then the agent's) are offered;
  - the run records the Skills and versions it used;
  - a Skill that cannot run refuses the task before the provider, with a code.

  See [SKILLS.md](SKILLS.md).
- **No progress.** A live task has no measurable progress, so the inspector shows status, not a progress bar.
- **localStorage.** Runtime data lives in the WebView's localStorage: dev (`localhost:5173`) and the desktop app (`tauri.localhost`) have separate histories.

# Workflow, Scheduler, Orchestrator: plan

Status: design of 15 October 2026, **built** in the same session; how it works now is in [WORKFLOWS.md](WORKFLOWS.md). Differences from this plan: links are edited in their own tab (not as "after" on each node), and a node can also be skipped by the user.

The owner's decisions:
- a run missed while RealmNest was closed is caught up **once** and reported;
- an "Ask" tool or an Approval node **suspends** the run durably;
- notices are a badge and a "To do" list in the app;
- the editor is form-based with a read-only graph; the drag-and-drop canvas comes later.

## Three things, three places

| | decides | never does |
| --- | --- | --- |
| **Workflow** (definition) | *what* happens and in what order: nodes, edges, inputs, outputs, policies. A versioned template, pure data. | run anything, keep state |
| **Scheduler** | *when* something starts: once at a time, every N minutes, every day or week at a time, a 5-field cron expression | execute: it only **creates a WorkflowRun** and hands it to the orchestrator |
| **Orchestrator** | *how* a run is carried out: which node is ready, who executes it (agent, tool, crew), what happens on failure, timeout or retry, branches and merges, approvals, budget and concurrency | decide when runs start |

```
Scheduler ──creates──▶ WorkflowRun ──▶ Orchestrator ──executes──▶ Agents · Tools · Crew
   (when)               (durable state)      (how)
```

**Definition is not the run.** A run carries a **snapshot** of the definition it started from (version included), its inputs, the state of every node, its artifacts, its approvals, its budget and its timestamps. Editing a workflow never changes a run in progress.

## Model

```
WorkflowDefinition   id · name · version · inputs[] · nodes[] · edges[] · outputs · policies
  node               id · kind · title · config · policy (retries, backoff, timeout, onFail)
  edge               from → to (· when: true | false | approved | rejected)
  policies           budget (tokens, USD) · max minutes · max nodes at once

WorkflowRun          status · trigger (manual | schedule | catch-up) · inputs · snapshot
  nodes[id]          pending · ready · running · waiting · awaiting_approval · completed · failed · skipped · cancelled
                     attempts · output · value · agent task / tool call / crew run · artifact · wakeAt · error
  budget             tokens and USD used against the limits
  history            what happened, when, by whom
```

### Nodes

- **agent**: a task for one agent, as an ordinary agent task.
- **tool**: one tool call. Permissions and approval work as everywhere else.
- **crew**: a Crew run on a goal. The plan is approved automatically by default; the final result is approved by the user, or automatically when set.
- **wait**: a duration, or until a time. The wait is durable.
- **approval**: the user approves or rejects.
- **condition**: contains, equals, not empty, or an agent answers yes/no.
- **parallel**: fan-out.
- **merge**: all or any.
- **output**: an Artifact.

Text fields are **templates**: `{{input.topic}}`, `{{node.draft.output}}`, `{{node.check.value}}`, `{{date}}`.

### Graph semantics

- A node with no incoming edge is ready when the run starts.
- An edge becomes **live** when its source completed and its `when` matches the source's value (condition true or false, approval approved or rejected). It becomes **dead** when the source completed with another value, or was skipped.
- A node runs when all its incoming edges are resolved and at least one is live (a merge set to *any*: as soon as one is live). When all of them are dead, the node is **skipped**, and so are its outgoing edges.
- The run completes when no node can still run. It fails when a node fails and its policy says fail.

### Policies

- **Node**: `retries` (0–3) with `backoff` (durable: the next attempt has a time); `timeout` (the agent task or tool call is stopped); `onFail` is `fail` (the run fails), `continue` (outgoing edges stay live, with the error as the output) or `skip`.
- **Run**: a budget in tokens and USD, counted from its agents' runs. Going over it stops the run. There is also a maximum duration, and a maximum number of nodes running at once.

### Durability

- Every change is saved: `workflow-runs` and `workflow-run.<id>`.
- **Restart, idle waits.** Waits and approvals survive a restart as they are: timers are re-armed, and a wait whose time has passed completes.
- **Restart, running work.** A node that was running an agent task or a tool call becomes **interrupted**, and the run becomes **suspended**. Resume runs those nodes again.
- **Crew nodes** follow their Crew run, which is durable on its own.

## Scheduler

- **Schedules**: a name, a workflow, inputs, a trigger (once, interval, daily, weekly, cron), on or off, the catch-up policy, the last time it fired and the next time it fires.
- **Timer**: one timer for the earliest due time, plus a check every 30 seconds.
- **On start**: the missed times since the last firing are counted. With *once*, a single catch-up run is created and the miss is reported. With *skip*, the miss is only reported. With *all*, one run is created per missed time, up to 10.

## Notices

- A **badge** in the rail counts the runs that need the user: an approval waiting, a suspended run, an unread failure, an unread missed time.
- A **To do** list in the Workflow screen shows those runs, plus finished runs not yet seen.

## UI (this milestone)

The Workflow screen has four tabs: **Workflows**, **Runs**, **Schedules** and **To do**.
- **Workflows**: the list, templates, the form editor (inputs, nodes and their fields, "after" with the branch, policies), the read-only graph, and Run with inputs.
- **Runs**: the live graph (node states, edge states), node details (output, attempts, error; retry, skip, approve, reject), budget, history, Stop and Resume.
- **Schedules**: the list and the editor (trigger, inputs, catch-up), next and last firing, and a "Run now" button that also only creates a run.

Agent panels link to the workflow run of a task.

## Not in this milestone

- The drag-and-drop canvas.
- Event triggers (a file arrives, a webhook).
- Workflows calling workflows.
- Windows notifications.
- Firing while RealmNest is closed (it is a desktop app: missed times are caught up on start).

# Workflows, Scheduler, Orchestrator

Three things kept apart (design record: [WORKFLOW_PLAN.md](WORKFLOW_PLAN.md)):

| | decides | never does |
| --- | --- | --- |
| **Workflow** (definition) | *what* happens and in what order: nodes, edges, inputs, outputs, policies. Versioned, pure data. | run anything |
| **Scheduler** | *when* a run starts: once, every N minutes, every day, every week, cron | execute: it only **creates a WorkflowRun** |
| **Orchestrator** | *how* a run is carried out: ready nodes, who executes them (agent, tool, crew), failures, retries, timeouts, branches, merges, approvals, budget, concurrency | decide when runs start |

```
Scheduler ──creates──▶ WorkflowRun ──▶ Orchestrator ──executes──▶ Agents · Tools · Crew
   (when)              (durable state)       (how)
```

**A definition is not a run.** A run keeps a copy of the definition it started from (`run.definition`, version included). Editing a workflow never changes a run in progress; the run page says "Definizione v3".

## Where it lives

| | |
| --- | --- |
| domain | `src/domain/workflow.ts`: `WorkflowDefinition`, `WorkflowNode` (`NodeConfig` per kind, `NodePolicy`), `WorkflowEdge`, `WorkflowRun`, `NodeRun`, `WorkflowTrigger`, `Schedule`, `ScheduleTrigger`, `WORKFLOW_LIMITS`, `workflowOrder` |
| what | `src/runtime/workflow/library.ts`: `WorkflowLibrary` (saved definitions, version + 1 on every save), `checkDefinition`, `renderTemplate`, `WORKFLOW_TEMPLATES`, `WorkflowError` (English message + `wf.err.*` key) |
| how | `src/runtime/workflow/orchestrator.ts`: `Orchestrator` |
| when | `src/runtime/workflow/scheduler.ts`: `Scheduler`, `parseCron`, `nextTime`, `dueTimes`, `checkTrigger` |
| wiring | `src/main.tsx`: the library checks that agents, tools and crews exist; a tool node runs through the tool runtime (`ToolRunner`); an output node becomes an Artifact (`origin: 'workflow'`, `workflowRunId`) |
| agent tasks | `AgentTask.workflow` ({workflowId, runId, nodeId}); the agent panel shows "Nel workflow X · Bozza", which opens the run |
| UI | `src/ui/screens/Workflows.tsx` (screen `workflows`), `store.openWorkflow({runId \| workflowId \| scheduleId \| tab})`, the rail badge |
| tests | `src/tests/workflow.test.ts` |

## Nodes

| kind | does | value / output |
| --- | --- | --- |
| **agent** | a task for one agent, an ordinary agent task (the agent walks to the desk, its tools and approvals as always; a busy agent: the node waits) | the answer |
| **tool** | one tool call through the tool runtime: its permission and, for "Ask" tools, the approval prompt (the run waits for you meanwhile). Text fields become the types the tool's schema wants | the result text |
| **crew** | a Crew run on a goal ([CREW.md](CREW.md)). The coordinator's plan is approved for you (unless turned off); the final result waits for your approval on the Crew screen, or is approved for you when set | the final deliverable |
| **wait** | for N minutes, or until a date and time; a durable timer | |
| **approval** | the run waits for you (To do); you approve or reject | `approved` / `rejected` |
| **condition** | contains, equals, not empty, or an agent answers yes or no | `true` / `false` |
| **parallel** | splits the flow: the linked nodes start together | |
| **merge** | waits for all branches, or the first | the branches' outputs |
| **output** | saves its content as an Artifact (Markdown) | the content |

Text fields are templates: `{{input.topic}}`, `{{node.draft.output}}`, `{{node.check.value}}`, `{{date}}` (local `YYYY-MM-DD`), `{{time}}`. The editor offers the inputs and the nodes before this one as chips.

### Graph

- A node with no incoming link starts with the run.
- A link is **live** when its source completed and its branch matches the source's value (`if yes`, `if no`, `if approved`, `if rejected`, or always); **dead** when the source completed with another value or was skipped.
- A node starts when all its incoming links are known and one is live (a merge set to *the first*: as soon as one is live). All dead: the node is **skipped**, and so is what follows it.
- Checked on save: unique ids, links between existing nodes, branches only after a condition or an approval, no loops, required fields, the agents, tools and crews still exist.

### Policies

- **Node** (agent, tool, crew, agent condition): `retries` 0–3 with `backoffMinutes` (doubling; the next attempt is a durable timer), `timeoutMinutes` (the agent task or tool call is stopped), `onFail`: `fail` (the run fails), `continue` (goes on with "ERROR: …" as the output), `skip` (the nodes after it are skipped). A denied approval or a tool the run may not use is never retried, and a tool node is retried only when the tool is low-risk (read-only): a write that timed out may still have happened.
- **Run**: a token budget and a dollar budget (from the agents' reported usage), a maximum duration, at most N nodes running at once. Past a limit the run stops.

## Runs and durability

`workflow-runs` (the index, 80 at most: only ended runs are pruned; with 80 open runs a new one is refused, and a schedule records the error) and `workflow-run.<id>`; every change is saved, and a new run at once.

| status | |
| --- | --- |
| running | something is working |
| waiting | only timers left (a wait, a retry later) |
| awaiting_approval | a person is needed: an approval node, a tool's approval, a crew's final result |
| suspended | RealmNest was closed while a node worked: that node is **interrupted**. **Riprendi** runs it again |
| completed · failed · cancelled | finished |

After a restart, waits and approval nodes are kept as they were: a wait whose time passed completes, retries come back on time. A tool or agent node that was waiting for a tool approval becomes interrupted (the approval itself lives in memory) and the run is suspended until Resume. A crew node whose Crew run was interrupted is interrupted too, and the run suspended. Schedules save their next time before they create a run, never create two runs for the same planned time, and skip a firing while the previous run of the same schedule is still open.

On a run: **Ferma**, **Riprendi** (suspended), **Rimuovi** (finished); on a node: **Riprova** and **Salta** (failed, stopped or interrupted), **Approva** / **Rifiuta** (approval), "Apri la crew", "Apri l'artifact". The history is translated (`wf.ev.*`).

## Schedules

A name, a workflow, its inputs, a trigger, on or off, and what to do with times missed while RealmNest was closed:

| trigger | |
| --- | --- |
| once | a date and time; the schedule turns itself off after firing |
| interval | every N minutes (anchored on the last firing) |
| daily | every day at HH:MM |
| weekly | on chosen days at HH:MM |
| cron | 5 fields: minute hour day month weekday (`*`, ranges, lists, steps; Sunday is 0 or 7) |

- One timer for the earliest due time, plus a check every 30 seconds. When it is due, the scheduler **creates the run** and the orchestrator carries it out.
- **Missed while closed** (on start): *recupera una volta e segnala* (one catch-up run, the default), *non recuperare, segnala soltanto*, *recupera ogni volta* (one run per missed time, 10 at most). The miss is reported on the schedule and in To do until "Ok, visto".
- **Esegui ora** also only creates a run.

## To do and the badge

The rail badge and the **Da fare** tab count: runs waiting for an approval, suspended runs, finished runs not seen yet, missed schedules not seen yet. Opening a finished run marks it seen.

## UI

**Workflow** · **Esecuzioni** · **Pianificazioni** · **Da fare**.
- *Workflow*: the list, three templates in the user's language (Ricerca → Bozza → Revisione → Pubblica, Report settimanale, Due punti di vista) and a blank one; the read-only graph (columns by dependency, arrows, branch labels); the form editor in tabs (Generale: name, description, inputs · Nodi: one form per node, with its policy · Collegamenti: from, to, branch · Regole: budgets and limits); Avvia with the inputs; recent runs; Duplica, Pianifica, Elimina.
- *Esecuzioni*: the live graph (node states, live and dead links), "Aspetta te" with the approval text, node details (attempts, times, error, output), consumption against the budget, inputs, Artifacts, history.
- *Pianificazioni*: the editor with the next three times, last and next firing, the missed notice.

## Not yet

The drag-and-drop canvas; event triggers (a file arrives, a webhook); workflows calling workflows; firing while RealmNest is closed (missed times are caught up on start).

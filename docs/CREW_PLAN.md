# Crew: plan

Status: **built** (14–15 October 2026): see [CREW.md](CREW.md). Kept as the design record.

The owner's decisions:
- the Coordinator proposes the task graph and the user approves it;
- a Reviewer agent checks the tasks, plus the user's approval of the final result;
- every member comes from the crew's own world;
- work moves between agents as Artifacts, together with a shared brief.

## What a Crew is

A first-level object of RealmNest, next to agents, chats and research. It is not message passing between agents.

```
Crew: Product Launch          world: Office
Goal (default): Prepare the launch of the product
Coordinator: Hana   ·   Reviewer: Lena
Members: Priya (Research: competitors and market) · Kenji (Copy) · Lena (Design brief, Review)
Brief: shared notes and files every task receives
```

A **Crew run** is one goal pursued by the crew. It holds:
- a small **task graph**, where each task has an assignee, instructions, dependencies, review on/off and the expected deliverable;
- the task states: waiting · blocked · running · review · done (also failed and cancelled);
- the outputs, as Artifacts of the run;
- the final deliverable;
- the history of who did what and when.

## The flow

1. **Plan.** The Coordinator, with its own connection and identity, turns the goal, the members' roles and the brief into a task graph (JSON).
   - RealmNest checks the graph: only members are assignees, dependencies exist, there are no cycles, and there are at most 12 tasks.
   - The user sees it as a graph, edits it (title, instructions, assignee, dependencies, review) and starts it.
   - Templates such as "Product launch" give a ready-made starting point.
2. **Kickoff.** In the world, the members meet at the meeting table.
3. **Run.**
   - A task whose dependencies are done goes to its agent as a normal agent task, marked "Crew Product Launch · T2". It carries the goal, the brief, its instructions, the deliverable and the **outputs of the tasks it depends on**. A task that depends on nothing (or on fewer than all) does not see the others' outputs.
   - Independent tasks run in parallel, one task per agent at a time. A busy agent means the task waits, with the reason shown.
   - In the world, when one agent's output feeds another agent's task, the producer walks over to hand it off.
4. **Review.**
   - A task marked for review goes to the Reviewer, who answers `approve` or `changes` with notes, in JSON.
   - On `changes` the author redoes the task with the notes. After at most 2 revisions the output is accepted, with the notes shown.
   - In the world, the reviewer walks to the author.
5. **Failure.** A failed task is shown; the tasks that depend on it become **blocked**. The user can retry it or skip it.
6. **Assemble.** When every task is done, the Coordinator assembles the final deliverable from all outputs. It becomes an Artifact, the run moves to *awaiting approval*, and the crew meets again.
7. **Approve.** The user approves (the run is done) or asks for changes. With changes, the Coordinator re-assembles with the feedback.
8. **Never lose work.** Runs are saved as they go. After a restart, a task that was running becomes interrupted and Resume restarts it. Cancel stops the agents' crew tasks; whatever is done stays.

## Where it lives

| | |
| --- | --- |
| domain | `src/domain/crew.ts`: Crew, CrewMember, CrewRun, CrewTask, statuses, limits |
| engine | `src/runtime/crew/service.ts`: crews (CRUD), runs (plan, approve, schedule, review, assemble, approve, retry, skip, cancel, resume), persistence |
| prompts | `src/runtime/crew/prompts.ts`: plan, task, review, assemble |
| agent tasks | `AgentTask.crew` ({crewId, runId, taskId, kind: work · review · assemble}) via `LiveRuntime.startTask` |
| Artifacts | `origin: 'crew'`, `crewRunId`: every task output and the final deliverable |
| world | the kickoff and final meetings (`agent.meeting.started` / `.ended`), and the walks for hand-offs and reviews (`agent.handoff`) |
| UI | the Crew screen: a list with templates, an editor, and a run view (graph, task drawer, outputs, history, final approval). Agent panels show "Crew · T2". |
| tests | `src/tests/crew.test.ts` |

## Not in this milestone

- Crews spanning worlds.
- A shared working folder.
- Crew-level Knowledge bases: the brief, plus files, is the shared context.
- Schedules.

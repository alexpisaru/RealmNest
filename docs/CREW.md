# Crew

A **Crew** is a first-level object of RealmNest: agents of one world working on one goal. It has roles, a small task graph, hand-offs between agents, review, and a final deliverable the user approves. It is not message passing between agents (that is delegation, [DELEGATION.md](DELEGATION.md)). The design record is [CREW_PLAN.md](CREW_PLAN.md).

```
Crew: Lancio Vocella          world: Office
Coordinator: Hana (and Copy)  ·  Reviewer: Lena
Members: Priya (Research) · Kenji (Tech) · Lena (Design)
Brief: the product, the audience, the price, the tone
```

## Where it lives

| | |
| --- | --- |
| domain | `src/domain/crew.ts`: `Crew`, `CrewMember`, `CrewRun`, `CrewTask` (statuses, attempts), `CrewEvent`, `CREW_LIMITS`, `topoOrder`, `depthOf` |
| engine | `src/runtime/crew/service.ts`: `CrewService` and `CREW_TEMPLATES` (Product launch, Article, Analysis) |
| prompts | `src/runtime/crew/prompts.ts`: plan (JSON), task, review (JSON), assemble |
| agent tasks | `AgentTask.crew` ({crewId, runId, taskId, kind: plan · work · review · assemble}); the agent panel shows "Crew Lancio Vocella · T2", which opens the run |
| Artifacts | `origin: 'crew'`, `crewRunId`: every task output and the final deliverable (Markdown) |
| world | `agent.meeting.started` / `agent.meeting.ended` (kickoff and final meeting at the meeting table), `agent.handoff` (the author walks over with their output; the reviewer walks to the author) |
| UI | the **Crew** screen in the rail (`src/ui/screens/Crews.tsx`): the crews with their work, the editor (templates, members of a world, roles, duties, coordinator, reviewer, goal, brief), a crew page, and the run view (graph, task drawer, plan editing, final approval, Artifacts, history) |
| storage | `crews`, and `crew-runs` + `crew-run.<id>` (at most 40 runs) |
| tests | `src/tests/crew.test.ts` |

## A run

1. **Plan.** The Coordinator turns the goal, the members (name, role, duty) and the brief into a task graph, as an agent task of theirs. Each task has an assignee, instructions, a deliverable, dependencies and a review flag. RealmNest checks the graph:
   - assignees are members (names matched loosely);
   - dependencies exist;
   - there are no cycles;
   - there are at most 12 tasks;
   - review is on only when the crew has a reviewer.

   The run then waits: **Plan to approve**.
2. **Approve.** The user sees the graph and can edit it before starting: titles, assignee, instructions, deliverable, dependencies, review, add or remove a task. **Approve and start** saves the edits and starts the run. **Plan again** asks for a new plan.
3. **Kickoff.** The members who are free walk to the meeting table. Work starts after a few seconds; whoever has no task yet goes back to idle.
4. **Work.**
   - A task whose dependencies are done (or skipped) starts as an ordinary agent task, with the agent's own instructions, Skills, Knowledge, Memory, Web and connection.
   - Its prompt carries the crew's goal, the brief, the member's role, the task, the deliverable, and **the outputs of the tasks it depends on**. Each output is capped at 8,000 characters and framed as a colleague's work, not as instructions.
   - The crew's files go with every task.
   - **Shared working folder** (optional, `Crew.workspace`, an absolute path set in the editor): every step of the run (plan, work, review, final) runs with it as the task's folder (`AgentTask.workspace`, over the agent's own), so the agents' file tools read and write there and each member sees what the others saved. The prompts say so (save files with clear names, name them in the answer, do not overwrite colleagues' files). The agents need their file tools on (their panel), and writing asks for approval as usual; the native sandbox checks the folder at every call.
   - Independent tasks run in parallel. An agent does one task at a time, so a task whose agent is busy waits, with the reason shown ("Hana is busy").
   - In the world, the author of the last input walks over to hand it off.
5. **Review.**
   - A task with review on goes to the Reviewer (not when the Reviewer is its author). The Reviewer answers `approve` or `changes` with notes in JSON, in the goal's language.
   - On `changes`, the author redoes the task with the notes and their previous version, and the Reviewer checks it again. After 2 revisions the output is accepted, with the notes kept.
   - A review that does not come back does not hold the crew up: the output stands.
6. **Failure.** A failed or stopped task shows its error, and the tasks that depend on it become **blocked**. **Retry** runs it again. **Skip** lets the next tasks go on without its output.
7. **An agent needs the user.** Every task is told: if something only the user can give is missing (an account or access, a file, a decision, a fact it must not guess), do not invent it and do not hand in half: answer with one line `BLOCKED: what I need` (`blockedQuestion` also takes BLOCCATO).
   - The task becomes **needs you** (`needs_input`, `question`); its output is not kept and it is not reviewed. The tasks after it wait; the other tasks go on. When nothing else can move, the history says the crew waits for the user.
   - The run view shows a banner per question; the task's drawer has the question, an answer box (**Answer and resume**) and **Skip**. A Windows notification (approvals) and a Telegram message tell the user; the answer is given in RealmNest.
   - **Answer** (`answerTask`) runs the task again. Every answer is kept on the task (`answers`, the last 5) and becomes a **fact confirmed by the user** for that task, every task built on it, their reviewer and the final assembly: without it, the reviewer took the answered values for invented ones and the next agent asked again (seen on a live run).
8. **Assemble.** When every task is done or skipped, the Coordinator assembles the final deliverable from all the outputs and the reviewer's notes. It is one Markdown document in the goal's language, kept as an Artifact. The crew meets again, and the run waits: **To approve**.
9. **Approve the result.** **Approve** ends the run. **Ask for changes** sends the feedback: the Coordinator re-assembles with it and the previous version, and the run comes back to approval.
10. **Never lose work.** Runs are saved as they go.
   - **Restart.** After a restart a working run is **Interrupted**, and its running tasks wait again. **Resume** continues from there: it plans again if there was no plan yet, re-assembles if every task was done, and otherwise runs the graph on.
   - **Stop.** It stops the agents' crew tasks and marks the open ones cancelled; what is done stays.

**Task states:** waiting · blocked · running · in review · needs you · done · failed · cancelled · skipped.

**Run states:** planning · plan to approve · working · assembling · to approve · done · failed · stopped · interrupted.

**History:** every step, with the agent who did it and when. It is stored with a translation key (`cw.ev.*`), so the UI shows it in the user's language. The notes on the cards work the same way (`cw.note.*`).

## Rules

- A crew lives in **one world**. Every member is an agent of that world, so meetings and hand-offs can be seen. The Coordinator and the Reviewer are members.
- At most 8 members per crew and 12 tasks per run.
- Every step is a normal agent task, so it appears in that agent's panel, counts in their usage (docs/USAGE.md), and follows their tool permissions.
- Outputs and the final result are Artifacts: open them, export them, or use them in a chat.

## Acceptance on the release (14–15 October 2026, Claude account)

**Setup.** The crew "Lancio Vocella" in the Office:
- Hana: Coordinator and Copy;
- Priya: Research;
- Kenji: Tech;
- Lena: Design and Reviewer;
- a brief about Vocella (a voice-notes app, its audience, its price, its tone).

**Plan.** Hana proposed 7 tasks. T1 (Priya) and T2 (Kenji) ran in parallel. Then came T3 (Hana), then T4 and T6 (Hana), then T5 and T7 (Lena). The graph was drawn with its arrows.

**Run.**
- **Kickoff:** the members met and went to their desks.
- **Hand-offs:** "Priya passes T1 to Hana", and "Hana passes T4 to Lena" twice.
- **Queue:** while Hana worked on T4, T6 waited with "Hana is busy".
- **Reviews:** Lena approved T2, T3 and T6. She asked for changes to T1 (a contradiction about a competitor) and to T4. The revised versions were approved.
- **Restart:** RealmNest was closed while T4 was running. The run came back Interrupted with T4 marked "interrupted", and Resume continued it.

**Final.** Hana assembled the "Vocella: kit di lancio", about 39,000 characters in Italian. It comes with the 7 task Artifacts and the history. The crew met again at the meeting table, and the run waits for the owner's approval.

**Tests.** The unit tests also cover the rest:
- the crew rules (world, coordinator);
- cycle detection and the graph columns;
- review with changes, then approval;
- feedback on the final;
- a failed task blocking, then retry;
- cancellation;
- restart and resume.

## Limits

- No crews across worlds, crew Knowledge bases or schedules yet. The brief, the files and the shared folder are the shared context.
- The Coordinator may add its own "quality review" task on top of the automatic review. The user can remove it before starting.
- Long outputs reach the next task capped at 8,000 characters each. The Artifact keeps the whole of them.
- History lines written before the translation existed stay in English.

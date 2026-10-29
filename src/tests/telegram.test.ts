import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { translator } from '../i18n';
import { MemoryAdapter } from '../persistence/storage';
import { TelegramBridge, type TelegramDeps } from '../runtime/telegram/bridge';
import type { TelegramTransport, TgButton, TgUser } from '../runtime/telegram/transport';
import { crewRevision, type CrewRun } from '../domain/crew';

// Telegram as a remote control (docs/TELEGRAM.md): commands, context, the concierge, answers when
// an agent finishes, approvals with buttons that stay in sync with the desktop.

const tick = () => new Promise((r) => setImmediate(r));
const CHAT = 42;

function rig(o: { concierge?: string; crews?: TelegramDeps['crews']; users?: TgUser[]; queue?: boolean } = {}) {
  const sent: { chatId: number; text: string; buttons?: TgButton[][] }[] = [];
  const edits: string[] = [];
  const transport: TelegramTransport = {
    available: true,
    setToken: async () => undefined,
    status: async () => ({ hasToken: true, running: true, users: o.users ?? [{ userId: CHAT, chatId: CHAT, name: 'Alex', role: 'owner', pairedAt: 0 }] }),
    verify: async () => '@bot',
    start: async () => undefined,
    stop: async () => undefined,
    pairBegin: async () => ({ code: '123456', expiresAt: 0 }),
    pairCancel: async () => undefined,
    removeUser: async () => true,
    disconnect: async () => undefined,
    send: async (chatId, text, buttons) => (sent.push({ chatId, text, ...(buttons && { buttons }) }), sent.length),
    edit: async (_c, _m, text) => void edits.push(text),
    answer: async () => undefined,
    typing: async () => undefined,
    sendDocument: async (chatId, _ref, name) => (sent.push({ chatId, text: `[document ${name}]` }), sent.length),
    sendPhoto: async (chatId, _ref, caption, buttons) => (sent.push({ chatId, text: `[photo] ${caption ?? ''}`, ...(buttons && { buttons }) }), sent.length),
    fetchFile: async () => ({ storageRef: 'sha256:' + 'a'.repeat(64), sha256: 'a'.repeat(64), size: 10, mime: 'application/pdf', text: false }),
  };
  const bus = new EventBus(1000);
  const tasks: { agentId: string; prompt: string; attachments?: unknown[]; modelWritten?: boolean }[] = [];
  let busy = '';
  const decided: string[] = [];
  const pending = [{ call: { id: 'call-1', toolId: 'write_text_file', agentId: 'kenji', input: { path: 'report.md' }, runId: 'r', status: 'awaiting_approval', requestedAt: 1 }, requester: 'Kenji' }];
  const deps: TelegramDeps = {
    transport,
    storage: new MemoryAdapter(),
    bus,
    t: () => translator('it'),
    agents: () => [
      { id: 'kenji', name: 'Kenji', role: 'Engineer' },
      { id: 'maya', name: 'Maya', role: 'Research lead' },
    ],
    live: {
      startTask: (agentId, i) => (tasks.push({ agentId, prompt: i.prompt, ...(i.attachments && { attachments: i.attachments }), ...(i.modelWritten && { modelWritten: true }) }), { run: { id: `run-${tasks.length}` } }),
      activeRun: (id) => (id === busy ? { id: 'x' } : undefined),
      cancel: () => undefined,
      // with the runtime's queue: a busy agent takes the task in its queue (docs/RUNTIME.md "Queue")
      ...(o.queue && {
        giveTask: (agentId: string, i: { prompt: string }) => {
          tasks.push({ agentId, prompt: i.prompt });
          return agentId === busy ? { task: { id: `task-${tasks.length}` }, queued: true } : { task: { id: `task-${tasks.length}` }, run: { id: `run-${tasks.length}` }, queued: false };
        },
        queueLength: () => 1,
        queuedEnd: (id: string) => (id === 'task-gone' ? { started: false } : { started: true }),
      }),
    },
    crews: o.crews ?? { list: () => [], runsOf: () => [], run: () => undefined, start: () => { throw new Error('no'); }, approvePlan: () => undefined, replan: () => undefined, approveFinal: () => undefined, requestChanges: () => undefined, cancel: () => undefined },
    workflows: { all: () => [], get: () => undefined },
    orchestrator: { list: () => [], get: () => undefined, create: () => { throw new Error('no'); }, decide: () => undefined, cancel: () => undefined },
    missedSchedules: () => [],
    approvals: { list: () => pending as never, decide: (id, d) => void decided.push(`${id}:${d}`) },
    artifacts: { get: () => undefined, find: () => undefined },
    complete: async () => o.concierge ?? '{"action":"reply","target":"","message":"Ciao!"}',
  };
  const tg = new TelegramBridge(deps);
  return { tg, sent, edits, tasks, bus, decided, pending, setBusy: (id: string) => (busy = id) };
}

describe('Telegram bridge', () => {
  it('/agent sets the context; the next message is a task for that agent; the answer comes back', async () => {
    const { tg, sent, tasks, bus } = rig();
    await tg.init();
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 1, text: '/agent kenji' });
    expect(sent.at(-1)!.text).toContain('Ora parli con <b>Kenji</b>');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 2, text: 'Controlla lo stato del progetto' });
    expect(tasks).toEqual([{ agentId: 'kenji', prompt: 'Controlla lo stato del progetto' }]);
    bus.emit('agent.run.completed', { agentId: 'kenji', runId: 'run-1', taskId: 't', result: 'Tutto in ordine.' });
    await tick();
    await tick();
    expect(sent.at(-1)!.text).toBe('<b>Kenji</b> · <i>Engineer</i>\n\nTutto in ordine.');
  });

  it('free text goes to the concierge, which routes it to the agent it names', async () => {
    const { tg, tasks } = rig({ concierge: 'Ecco: {"action":"agent","target":"Maya","message":"una ricerca su X"}' });
    await tg.init();
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 1, text: 'Fai fare a Maya una ricerca su X' });
    // the concierge reworded it: the agent gets it marked as written by a model (no @Skills, no memories from it)
    expect(tasks).toEqual([{ agentId: 'maya', prompt: 'una ricerca su X', modelWritten: true }]);

  });

  it('a busy agent is reported; a file waits for the next message as an attachment; voice is not supported yet', async () => {
    const { tg, sent, tasks, setBusy } = rig();
    await tg.init();
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 1, text: '/agent Maya' });
    setBusy('maya');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 2, text: 'ciao' });
    expect(sent.at(-1)!.text).toContain('sta già lavorando');
    setBusy('');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 3, file: { fileId: 'f1', kind: 'document', name: 'brief.pdf', mime: 'application/pdf' } });
    expect(sent.at(-1)!.text).toContain('brief.pdf');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 4, text: 'Riassumilo' });
    expect(tasks[0]).toMatchObject({ agentId: 'maya', prompt: 'Riassumilo', attachments: [{ name: 'brief.pdf', kind: 'pdf', source: 'external' }] });
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 5, file: { fileId: 'v', kind: 'voice' } });
    expect(sent.at(-1)!.text).toContain('vocale');
  });

  it('with the queue, a busy agent takes the task; the answer comes when the queued task has run', async () => {
    const { tg, sent, tasks, bus, setBusy } = rig({ queue: true });
    await tg.init();
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 1, text: '/agent Maya' });
    setBusy('maya');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 2, text: 'Prepara il report' });
    expect(tasks).toEqual([{ agentId: 'maya', prompt: 'Prepara il report' }]);
    expect(sent.at(-1)!.text).toContain('in coda (1°)');
    // later the queued task gets a run and ends: the answer comes back to this chat
    bus.emit('agent.run.completed', { agentId: 'maya', runId: 'run-later', taskId: 'task-1', result: 'Report pronto.' });
    await tick();
    await tick();
    expect(sent.at(-1)!.text).toBe('<b>Maya</b> · <i>Research lead</i>\n\nReport pronto.');
  });

  it('a tool approval arrives with buttons; pressing one decides it; deciding on the desktop updates the message', async () => {
    const { tg, sent, edits, bus, decided } = rig();
    await tg.init();
    bus.emit('tool.awaiting_approval', { toolCallId: 'call-1', runId: 'r', toolId: 'write_text_file', agentId: 'kenji' });
    await tick();
    const msg = sent.at(-1)!;
    expect(msg.text).toContain('<b>Kenji</b> vuole usare <code>write_text_file</code>');
    expect(msg.text).toContain('<pre>{&quot;path&quot;:&quot;report.md&quot;}</pre>'.replace(/&quot;/g, '"'));
    const approve = msg.buttons![0][0];
    await tg.onEvent({ t: 'callback', id: 'cb', chatId: CHAT, userId: CHAT, messageId: 9, data: approve.data });
    expect(decided).toEqual(['call-1:once']);
    // a used button no longer works
    await tg.onEvent({ t: 'callback', id: 'cb2', chatId: CHAT, userId: CHAT, messageId: 9, data: approve.data });
    expect(decided).toHaveLength(1);
    bus.emit('tool.approved', { toolCallId: 'call-1', runId: 'r', toolId: 'write_text_file' });
    await tick();
    expect(edits.at(-1)).toContain('Approvato');
  });

  it('long answers are split under Telegram\'s limit; unknown commands get a hint', async () => {
    const { tg, sent } = rig();
    await tg.init();
    await tg.say(CHAT, 'x'.repeat(9000));
    expect(sent.map((s) => s.text.length)).toEqual([3900, 3900, 1200]);
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 1, text: '/boh' });
    expect(sent.at(-1)!.text).toContain('/help');
  });
});

// docs/HARDENING.md I-6, I-13
describe('Telegram bridge: hardening', () => {
  const press = (tg: TelegramBridge, b: TgButton, userId = CHAT) => tg.onEvent({ t: 'callback', id: 'cb', chatId: CHAT, userId, messageId: 9, data: b.data });

  it('I-13: /approve shows the call with buttons (it decides nothing by itself); only the owner can approve', async () => {
    const { tg, sent, decided } = rig({ users: [{ userId: CHAT, chatId: CHAT, name: 'Alex', role: 'owner', pairedAt: 0 }, { userId: 7, chatId: 7, name: 'Guest', role: 'user', pairedAt: 0 }] });
    await tg.init();
    await tg.onEvent({ t: 'message', chatId: 7, userId: 7, messageId: 1, text: '/approve' });
    expect(sent.at(-1)!.text).toContain('proprietario');
    await tg.onEvent({ t: 'message', chatId: CHAT, userId: CHAT, messageId: 2, text: '/approve' });
    expect(decided).toEqual([]);
    const msg = sent.at(-1)!;
    expect(msg.text).toContain('<code>write_text_file</code>');
    // another paired user pressing the owner's button: nothing happens
    await press(tg, msg.buttons![0][0], 7);
    expect(decided).toEqual([]);
    await press(tg, msg.buttons![0][0]);
    expect(decided).toEqual(['call-1:once']);
  });

  it('I-13: a stopped call closes its message; a button of a call no longer waiting says so', async () => {
    const { tg, sent, edits, bus, decided, pending } = rig();
    await tg.init();
    bus.emit('tool.awaiting_approval', { toolCallId: 'call-1', runId: 'r', toolId: 'write_text_file', agentId: 'kenji' });
    await tick();
    const msg = sent.at(-1)!;
    pending.length = 0;
    bus.emit('tool.cancelled', { toolCallId: 'call-1', runId: 'r', toolId: 'write_text_file' });
    await tick();
    expect(edits.at(-1)).toContain('Non serve più');
    await press(tg, msg.buttons![0][1]);
    expect(decided).toEqual([]);
    expect(sent.at(-1)!.text).toContain('Già deciso');
  });

  it('I-6: a crew plan button is bound to the plan it showed; a changed plan is shown again instead of approved', async () => {
    const plan = (title: string) => [{ id: 'T1', title, assigneeId: 'kenji', instructions: 'x', dependsOn: [], review: false, status: 'waiting' as const, attempts: [], revisions: 0 }];
    const run: CrewRun = { id: 'cr-1', crewId: 'c', crew: { name: 'Launch', worldId: 'office', coordinatorId: 'kenji', members: [{ agentId: 'kenji', role: 'Lead' }] }, goal: 'g', status: 'planning', plan: [], history: [], createdAt: 0, updatedAt: 0 };
    const approved: (string | undefined)[] = [];
    const crews: TelegramDeps['crews'] = {
      list: () => [],
      runsOf: () => [run],
      run: () => run,
      start: () => run,
      approvePlan: (_id, rev) => void approved.push(rev),
      replan: () => undefined,
      approveFinal: () => undefined,
      requestChanges: () => undefined,
      cancel: () => undefined,
    };
    const { tg, sent, edits, bus } = rig({ crews });
    await tg.init();
    run.status = 'awaiting_plan';
    run.plan = plan('Scan v1');
    bus.emit('crew.event', { runId: run.id, crewId: 'c', kind: 'plan', message: 'proposed' });
    await tick();
    await tick();
    const v1 = sent.at(-1)!;
    expect(v1.text).toContain('Scan v1');
    // the plan changes (edited on the desktop) before the old button is pressed
    run.plan = plan('Scan v2');
    await press(tg, v1.buttons![0][0]);
    expect(approved).toEqual([]);
    expect(sent.at(-2)!.text).toContain('Il piano è cambiato');
    const v2 = sent.at(-1)!;
    expect(v2.text).toContain('Scan v2');
    await press(tg, v2.buttons![0][0]);
    expect(approved).toEqual([crewRevision(run, 'plan')]);
    // once the crew runs, the plan messages close
    run.status = 'running';
    bus.emit('crew.event', { runId: run.id, crewId: 'c', kind: 'approve', message: 'approved' });
    await tick();
    await tick();
    expect(edits.filter((e) => e.includes('Scan'))).toHaveLength(2);
    expect(edits.at(-1)).toContain('Approvato');
  });
});

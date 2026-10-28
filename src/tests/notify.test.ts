import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { translator } from '../i18n';
import { MemoryAdapter } from '../persistence/storage';
import { DesktopNotifier, type NotifierDeps, type NotifyTransport } from '../runtime/notify/service';

const tick = () => new Promise((r) => setTimeout(r, 0));

function rig(over: Partial<NotifierDeps> = {}) {
  const shown: { title: string; body: string; tag: string }[] = [];
  let click: (tag: string) => void = () => undefined;
  const transport: NotifyTransport = {
    available: true,
    show: async (title, body, tag) => void shown.push({ title, body, tag }),
    onClick: (fn) => void (click = fn),
  };
  const bus = new EventBus(100);
  const state = { focused: false, crew: { status: 'planning', name: 'Lancio', error: undefined as string | undefined }, wf: { status: 'running', name: 'Report' }, research: { status: 'running', question: 'Pompe di calore?', agent: false } };
  const opened: string[] = [];
  let now = 1_000_000;
  const storage = new MemoryAdapter();
  const n = new DesktopNotifier({
    bus,
    storage,
    transport,
    t: () => translator('it'),
    focused: () => state.focused,
    agentName: (id) => ({ maya: 'Maya' })[id],
    task: (taskId) => ({ t1: { title: 'Scrivi il post', step: false }, crewStep: { title: 'T2', step: true } })[taskId],
    approval: (id) => (id === 'c1' ? { who: 'Maya', tool: 'Scrivi file' } : undefined),
    crew: () => ({ ...state.crew }),
    workflow: () => ({ ...state.wf }),
    research: () => ({ ...state.research }),
    open: (tag) => void opened.push(tag),
    now: () => now,
    ...over,
  });
  return { n, bus, shown, state, opened, storage, click: (tag: string) => click(tag), advance: (ms: number) => (now += ms) };
}

const run = (agentId: string, taskId: string) => ({ agentId, runId: `r-${taskId}`, taskId });

describe('Windows notifications', () => {
  it('a task that ends while RealmNest is in the background: one notification; steps of a crew are not announced', async () => {
    const r = rig();
    await r.n.init();
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    r.bus.emit('agent.run.completed', { ...run('maya', 'crewStep'), result: 'ok' });
    r.bus.emit('agent.run.failed', { ...run('maya', 't1'), error: { code: 'x', message: 'limite raggiunto' } });
    await tick();
    expect(r.shown).toEqual([
      { title: 'Maya ha finito', body: 'Scrivi il post', tag: 'agent:maya' },
      { title: 'Maya: il task non è riuscito', body: 'Scrivi il post: limite raggiunto', tag: 'agent:maya' },
    ]);
  });

  it('nothing while the user is looking at RealmNest', async () => {
    const r = rig();
    await r.n.init();
    r.state.focused = true;
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    r.bus.emit('tool.awaiting_approval', { toolCallId: 'c1', runId: 'r1', toolId: 'write_text_file' });
    await tick();
    expect(r.shown).toEqual([]);
  });

  it('approvals: a tool call, a crew plan and result, a workflow step, a research plan', async () => {
    const r = rig();
    await r.n.init();
    r.bus.emit('tool.awaiting_approval', { toolCallId: 'c1', runId: 'r1', toolId: 'write_text_file' });
    r.state.crew.status = 'awaiting_plan';
    r.bus.emit('crew.event', { runId: 'cr1', crewId: 'c', kind: 'plan', message: '' });
    // the same status again: not announced twice
    r.bus.emit('crew.event', { runId: 'cr1', crewId: 'c', kind: 'plan', message: '' });
    r.state.wf.status = 'awaiting_approval';
    r.bus.emit('workflow.event', { runId: 'w1', workflowId: 'w', kind: 'approval', message: '' });
    r.state.research.status = 'awaiting_plan';
    r.bus.emit('research.status', { id: 'rs1', status: 'awaiting_plan' });
    await tick();
    expect(r.shown.map((s) => [s.title, s.tag]).sort()).toEqual(
      [
        ['Serve la tua approvazione', 'tool:c1'],
        ['Crew Lancio: piano da approvare', 'crew:cr1'],
        ['Workflow Report: serve la tua approvazione', 'wf:w1'],
        ['Ricerca: piano da approvare', 'research:rs1'],
      ].sort(),
    );
    expect(r.shown.find((s) => s.tag === 'tool:c1')!.body).toBe('Maya vuole usare Scrivi file');
  });

  it('results: crew, workflow and research that end; the settings turn each kind off and persist', async () => {
    const r = rig();
    await r.n.init();
    r.state.crew.status = 'done';
    r.bus.emit('crew.event', { runId: 'cr1', crewId: 'c', kind: 'done', message: '' });
    r.state.wf.status = 'failed';
    r.bus.emit('workflow.event', { runId: 'w1', workflowId: 'w', kind: 'failed', message: '' });
    r.state.research.status = 'done';
    r.bus.emit('research.status', { id: 'rs1', status: 'done' });
    await tick();
    expect(r.shown.map((s) => s.title).sort()).toEqual(['Crew Lancio: lavoro concluso', 'Ricerca pronta', 'Workflow Report: non riuscito']);
    await r.n.setSettings({ results: false });
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    await tick();
    expect(r.shown).toHaveLength(3);
    const again = rig({ storage: r.storage });
    await again.n.init();
    expect(again.n.settings()).toEqual({ enabled: true, approvals: true, results: false });
  });

  it('an agent\'s own research is a step of its task; the same notice twice in a few seconds shows once', async () => {
    const r = rig();
    await r.n.init();
    r.state.research = { status: 'done', question: 'x', agent: true };
    r.bus.emit('research.status', { id: 'rs2', status: 'done', agentId: 'maya' });
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    await tick();
    expect(r.shown.map((s) => s.tag)).toEqual(['agent:maya']);
    r.advance(11_000);
    r.bus.emit('agent.run.completed', { ...run('maya', 't1'), result: 'ok' });
    await tick();
    expect(r.shown).toHaveLength(2);
  });

  it('a click opens what the notification was about', async () => {
    const r = rig();
    await r.n.init();
    r.click('crew:cr1');
    expect(r.opened).toEqual(['crew:cr1']);
  });
});

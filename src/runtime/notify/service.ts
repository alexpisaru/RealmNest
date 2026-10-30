// Windows notifications (docs/NOTIFICATIONS.md). While RealmNest is in the background, an approval to
// give and work that ended (an agent's task, a crew, a workflow, a deep research) show as a Windows
// notification; a click brings the window back on that screen. Nothing shows while you are looking at
// RealmNest. Steps of a bigger job (a crew's or a workflow's tasks, delegated tasks) are not announced
// one by one: the job is.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { EventBus } from '../../core/events';
import type { TKey } from '../../i18n';
import type { StorageAdapter } from '../../persistence/storage';

export interface NotifySettings {
  enabled: boolean;
  /** a tool call, a crew plan or result, a workflow step or a research plan waits for you */
  approvals: boolean;
  /** a task, crew, workflow or research ended (done or failed) */
  results: boolean;
}

export const DEFAULT_NOTIFY: NotifySettings = { enabled: true, approvals: true, results: true };

const KEY = 'notifications';

export interface NotifyTransport {
  readonly available: boolean;
  /** backgroundOnly: shown only while RealmNest's window is minimized or another window has the focus */
  show(title: string, body: string, tag: string, backgroundOnly: boolean): Promise<void>;
  /** a click on one of RealmNest's notifications, with its tag */
  onClick(fn: (tag: string) => void): void;
}

/** the desktop app: a Windows toast under RealmNest's name (src-tauri/src/notify.rs) */
export class TauriNotifyTransport implements NotifyTransport {
  readonly available = true;
  async show(title: string, body: string, tag: string, backgroundOnly: boolean) {
    // the native side decides "in the background": a minimized WebView2 page still says it has the focus
    await invoke('notify_show', { title, body, tag, backgroundOnly });
  }
  onClick(fn: (tag: string) => void) {
    void listen<string>('notification-clicked', (e) => fn(e.payload));
  }
}

export class UnavailableNotifyTransport implements NotifyTransport {
  readonly available = false;
  async show() {}
  onClick() {}
}

type T = (k: TKey, vars?: Record<string, string | number>) => string;

export interface NotifierDeps {
  bus: EventBus;
  storage: StorageAdapter;
  transport: NotifyTransport;
  t: () => T;
  /** the user is surely looking at RealmNest (a quick check before asking the transport, which checks again) */
  focused?: () => boolean;
  agentName: (agentId: string) => string | undefined;
  /** a task's title, and whether it is a step of a bigger job (crew, workflow, delegation) */
  task: (taskId: string, runId: string) => { title: string; step: boolean } | undefined;
  /** who asks for a tool call, and which tool */
  approval: (callId: string) => { who: string; tool: string } | undefined;
  /** `asking`: the question of a task waiting for the user (BLOCKED), the newest */
  crew: (runId: string) => { status: string; name: string; error?: string; asking?: string } | undefined;
  workflow: (runId: string) => { status: string; name: string; error?: string } | undefined;
  research: (id: string) => { status: string; question: string; agent?: boolean; error?: string } | undefined;
  /** a click: show what the notification was about */
  open: (tag: string) => void;
  now?: () => number;
}

export class DesktopNotifier {
  private state: NotifySettings = { ...DEFAULT_NOTIFY };
  private seen = new Map<string, string>();
  private recent = new Map<string, number>();
  private listeners = new Set<() => void>();
  private version = 0;
  private offs: (() => void)[] = [];

  constructor(private deps: NotifierDeps) {}

  async init() {
    const s = await this.deps.storage.get<Partial<NotifySettings>>(KEY);
    this.state = { ...DEFAULT_NOTIFY, ...(s && typeof s === 'object' ? pickBooleans(s) : {}) };
    this.deps.transport.onClick((tag) => this.deps.open(tag));
    this.listen();
    this.changed();
  }

  dispose() {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  get available() {
    return this.deps.transport.available;
  }
  settings(): NotifySettings {
    return this.state;
  }
  async setSettings(patch: Partial<NotifySettings>) {
    this.state = { ...this.state, ...pickBooleans(patch) };
    await this.deps.storage.set(KEY, this.state);
    this.changed();
  }
  /** a sample, so the user sees what one looks like (shown even while RealmNest has the focus) */
  async test() {
    const t = this.deps.t();
    await this.deps.transport.show(t('nt.testTitle'), t('nt.testBody'), 'test', false);
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ── what happens in RealmNest ───────────────────────────
  private listen() {
    const bus = this.deps.bus;
    this.offs.push(
      bus.on('agent.run.completed', (p) => this.taskEnded(p.agentId, p.taskId, p.runId)),
      bus.on('agent.run.failed', (p) => this.taskEnded(p.agentId, p.taskId, p.runId, p.error.message)),
      bus.on('tool.awaiting_approval', (p) => queueMicrotask(() => this.toolWaits(p.toolCallId))),
      // a step changes the run first: read it after the emitter is done
      bus.on('crew.event', (p) => queueMicrotask(() => (p.kind === 'ask' ? this.crewAsks(p.runId) : this.crewChanged(p.runId)))),
      bus.on('workflow.event', (p) => queueMicrotask(() => this.workflowChanged(p.runId, p.kind))),
      bus.on('research.status', (p) => this.researchChanged(p.id)),
    );
  }

  private taskEnded(agentId: string, taskId: string, runId: string, error?: string) {
    const task = this.deps.task(taskId, runId);
    if (!task || task.step) return;
    const t = this.deps.t();
    const name = this.deps.agentName(agentId) ?? agentId;
    if (error) this.send('results', `agent:${agentId}`, t('nt.taskFailed', { name }), `${task.title}: ${error}`);
    else this.send('results', `agent:${agentId}`, t('nt.taskDone', { name }), task.title);
  }

  private toolWaits(callId: string) {
    const a = this.deps.approval(callId);
    if (!a) return;
    const t = this.deps.t();
    this.send('approvals', `tool:${callId}`, t('nt.approval'), t('nt.approvalBody', { who: a.who, tool: a.tool }));
  }

  /** a run's status changed since we last looked (each status is announced once) */
  private changedStatus(key: string, status: string) {
    if (this.seen.get(key) === status) return false;
    this.seen.set(key, status);
    if (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value!);
    return true;
  }

  private crewChanged(runId: string) {
    const run = this.deps.crew(runId);
    if (!run || !this.changedStatus(`crew:${runId}`, run.status)) return;
    const t = this.deps.t();
    const tag = `crew:${runId}`;
    if (run.status === 'awaiting_plan') this.send('approvals', tag, t('nt.crewPlan', { name: run.name }), t('nt.crewPlanBody'));
    else if (run.status === 'awaiting_approval') this.send('approvals', tag, t('nt.crewFinal', { name: run.name }), t('nt.crewFinalBody'));
    else if (run.status === 'done') this.send('results', tag, t('nt.crewDone', { name: run.name }), '');
    else if (run.status === 'failed') this.send('results', tag, t('nt.crewFailed', { name: run.name }), run.error ?? '');
  }

  /** an agent of the crew cannot go on without the user (its task waits for an answer) */
  private crewAsks(runId: string) {
    const run = this.deps.crew(runId);
    if (!run?.asking) return;
    this.send('approvals', `crew:${runId}`, this.deps.t()('nt.crewAsk', { name: run.name }), run.asking);
  }

  private workflowChanged(runId: string, kind: string) {
    const run = this.deps.workflow(runId);
    if (!run) return;
    const t = this.deps.t();
    const tag = `wf:${runId}`;
    // every approval step is announced (a workflow can wait more than once)
    if (kind === 'approval' && run.status === 'awaiting_approval') {
      this.seen.set(tag, run.status);
      this.send('approvals', tag, t('nt.wfApproval', { name: run.name }), t('nt.wfApprovalBody'));
      return;
    }
    if (!this.changedStatus(tag, run.status)) return;
    if (run.status === 'completed') this.send('results', tag, t('nt.wfDone', { name: run.name }), '');
    else if (run.status === 'failed') this.send('results', tag, t('nt.wfFailed', { name: run.name }), run.error ?? '');
  }

  private researchChanged(id: string) {
    const r = this.deps.research(id);
    if (!r || !this.changedStatus(`research:${id}`, r.status)) return;
    const t = this.deps.t();
    const tag = `research:${id}`;
    // an agent's research is a step of its task
    if (r.agent) return;
    if (r.status === 'awaiting_plan') this.send('approvals', tag, t('nt.researchPlan'), r.question);
    else if (r.status === 'done') this.send('results', tag, t('nt.researchDone'), r.question);
    else if (r.status === 'failed') this.send('results', tag, t('nt.researchFailed'), r.error ? `${r.question}: ${r.error}` : r.question);
  }

  private send(kind: 'approvals' | 'results', tag: string, title: string, body: string) {
    if (!this.deps.transport.available || !this.state.enabled || !this.state[kind] || this.deps.focused?.()) return;
    // the same notice twice in a few seconds (a run that flips back and forth) is shown once
    const now = this.deps.now?.() ?? Date.now();
    const key = `${tag}|${title}`;
    if (now - (this.recent.get(key) ?? -Infinity) < 10_000) return;
    this.recent.set(key, now);
    if (this.recent.size > 200) for (const [k, at] of this.recent) if (now - at > 60_000) this.recent.delete(k);
    void this.deps.transport.show(title, body, tag, true).catch(() => undefined);
  }
}

function pickBooleans(s: Partial<NotifySettings>): Partial<NotifySettings> {
  const out: Partial<NotifySettings> = {};
  for (const k of ['enabled', 'approvals', 'results'] as const) if (typeof s[k] === 'boolean') out[k] = s[k];
  return out;
}

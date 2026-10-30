// TelegramBridge (docs/TELEGRAM.md): Telegram as a remote control of RealmNest. A paired user's
// message becomes ordinary user input: a task for an agent (its own connection, tools and
// approvals), a crew run, a workflow run, or a question the concierge routes. Things that wait
// for the user arrive with buttons; notifications follow the user's settings. Telegram never
// bypasses the ToolRuntime: approvals are the same ones the desktop shows.

import type { EventBus } from '../../core/events';
import type { AttachmentInput, AttachmentKind } from '../../domain/attachment';
import { crewRevision, type CrewRun } from '../../domain/crew';
import { isOpenRun, type WorkflowDefinition, type WorkflowRun } from '../../domain/workflow';
import type { TKey } from '../../i18n';
import type { StorageAdapter } from '../../persistence/storage';
import { parseJsonObject } from '../research/json';
import { esc, markdownParts, markdownToHtml } from './format';
import type { ApprovalDecision, PendingApproval } from '../tools/runtime';
import type { TelegramTransport, TgButton, TgEvent, TgStatus, TgUser } from './transport';

const KEY = 'telegram';
/** Telegram's message limit, with a margin */
const CHUNK = 3900;
const BUTTON_TTL = 24 * 3_600_000;
/** a tool's input shown on an approval message (longer ones are cut, and say so) */
const INPUT_SHOWN = 600;

export interface TelegramSettings {
  /** start polling when RealmNest starts */
  autostart: boolean;
  notify: {
    /** something waits for your approval */
    approvals: boolean;
    /** what you started from Telegram finished or failed */
    mine: boolean;
    /** any crew or workflow finished or failed */
    runs: boolean;
    /** a schedule was missed while RealmNest was closed */
    missed: boolean;
    /** a crew task or workflow node started or finished */
    progress: boolean;
  };
  /** no notifications between these times (HH:MM), except approvals */
  quiet?: { from: string; to: string };
}

export const DEFAULT_TELEGRAM: TelegramSettings = { autostart: true, notify: { approvals: true, mine: true, runs: true, missed: true, progress: false } };

type Tr = (k: TKey, vars?: Record<string, string | number>) => string;

interface AgentRef {
  id: string;
  name: string;
  role?: string;
  worldId?: string;
}

/** what the bridge needs from RealmNest (main.tsx passes the real services) */
export interface TelegramDeps {
  transport: TelegramTransport;
  storage: StorageAdapter;
  bus: EventBus;
  t: () => Tr;
  agents: () => AgentRef[];
  worldName?: (id: string) => string;
  live: {
    /** `modelWritten`: the concierge's model wrote the prompt (not the user's own words) */
    startTask(agentId: string, input: { prompt: string; title?: string; attachments?: AttachmentInput[]; modelWritten?: boolean }): { run: { id: string } };
    activeRun(agentId: string): { id: string; taskId?: string } | undefined;
    cancel(agentId: string): Promise<unknown> | unknown;
    taskTitle?(taskId: string): string | undefined;
    /** a task for a busy agent waits in its queue (docs/RUNTIME.md "Queue"); without it, a busy agent says so */
    giveTask?(agentId: string, input: { prompt: string; title?: string; attachments?: AttachmentInput[]; modelWritten?: boolean }): { task: { id: string }; run?: { id: string }; queued: boolean };
    /** how many tasks wait for this agent */
    queueLength?(agentId: string): number;
    /** why a queued task ended without running (removed, or it could not start) */
    queuedEnd?(taskId: string): { started: boolean; error?: string } | undefined;
  };
  crews: {
    list(): { id: string; name: string; worldId: string; members: { agentId: string }[]; coordinatorId: string }[];
    runsOf(crewId?: string): CrewRun[];
    run(id: string): CrewRun | undefined;
    start(crewId: string, goal?: string): CrewRun;
    /** `revision`: the plan / final result the user saw (crewRevision); another one is refused */
    approvePlan(runId: string, revision?: string): void;
    replan(runId: string): void;
    approveFinal(runId: string, revision?: string): void;
    requestChanges(runId: string, feedback: string): void;
    cancel(runId: string): Promise<unknown> | unknown;
  };
  workflows: { all(): WorkflowDefinition[]; get(id: string): WorkflowDefinition | undefined };
  orchestrator: {
    list(): WorkflowRun[];
    get(id: string): WorkflowRun | undefined;
    create(d: WorkflowDefinition, inputs: Record<string, string>): WorkflowRun;
    decide(runId: string, nodeId: string, d: 'approved' | 'rejected'): void;
    cancel(runId: string): void;
  };
  missedSchedules: () => { id: string; name: string; missed?: { count: number; at: number } }[];
  approvals: { list(): PendingApproval[]; decide(callId: string, d: ApprovalDecision): void };
  artifacts: { get(id: string): { id: string; name: string; storageRef?: string } | undefined; find(text: string): { id: string; name: string; storageRef?: string } | undefined };
  /** the concierge's model: the Chat route; answers the system + user prompt with text */
  complete: (system: string, user: string) => Promise<string>;
  /** the agents' portraits as one picture (PNG), kept in the file store; none in tests */
  agentSheet?: () => Promise<{ storageRef: string } | undefined>;
  now?: () => number;
}

/** what a chat is talking to */
type Context = { kind: 'none' } | { kind: 'agent'; agentId: string } | { kind: 'crew'; crewId: string };

interface ChatState {
  context: Context;
  /** files sent before the message they go with */
  pending: AttachmentInput[];
  /** a workflow being started: its inputs, asked one by one */
  asking?: { workflowId: string; values: Record<string, string>; left: string[] };
  /** waiting for the feedback on a crew's final result */
  feedbackFor?: string;
  /** what this chat started last (for /cancel) */
  last?: { kind: 'agent' | 'crew' | 'workflow'; id: string; agentId?: string };
}

type Action = () => unknown;

/** how an approval message is closed: approved · rejected · no longer needed (cancelled, failed, changed) */
type Outcome = 'yes' | 'no' | 'gone';

export class TelegramBridge {
  private settings: TelegramSettings = DEFAULT_TELEGRAM;
  private chats = new Map<number, ChatState>();
  /** short button ids → what they do; `approval`: only the owner may press it */
  private buttons = new Map<string, { at: number; run: Action; approval?: boolean }>();
  /** agent runs started from Telegram → the chat that waits for the answer */
  private runs = new Map<string, number>();
  /** tasks queued from Telegram (their run starts later) → the chat that waits for the answer */
  private queuedTasks = new Map<string, number>();
  /** crew and workflow runs started from Telegram → their chat */
  private started = new Map<string, number>();
  /** the last status seen per crew / workflow run (to notice transitions) */
  private seen = new Map<string, string>();
  /** approval messages sent, to update them when the decision is taken elsewhere */
  private sentApprovals = new Map<string, { chatId: number; messageId: number; text: string }[]>();
  private status: TgStatus = { hasToken: false, running: false, users: [] };
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;
  private offs: (() => void)[] = [];

  constructor(private deps: TelegramDeps) {}

  /** a translated text for Telegram HTML: the texts carry their own tags, the values are escaped */
  private get t(): Tr {
    const tr = this.deps.t();
    return (k, vars) => tr(k, vars && Object.fromEntries(Object.entries(vars).map(([n, v]) => [n, typeof v === 'string' ? esc(v) : v])));
  }
  /** plain text (buttons and pop-ups show no HTML) */
  private get tp(): Tr {
    return this.deps.t();
  }
  private now() {
    return this.deps.now?.() ?? Date.now();
  }

  // ── lifecycle ───────────────────────────────────────────
  async init() {
    const s = await this.deps.storage.get<TelegramSettings>(KEY);
    if (s) this.settings = { ...DEFAULT_TELEGRAM, ...s, notify: { ...DEFAULT_TELEGRAM.notify, ...s.notify } };
    this.listen();
    await this.refresh();
    if (this.settings.autostart && this.status.hasToken && this.status.users.length) await this.start().catch(() => undefined);
  }
  dispose() {
    for (const off of this.offs) off();
    this.offs = [];
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    for (const l of this.listeners) l();
  }

  getStatus() {
    return this.status;
  }
  getSettings() {
    return this.settings;
  }
  async setSettings(next: TelegramSettings) {
    this.settings = next;
    await this.deps.storage.set(KEY, next);
    this.changed();
  }
  async refresh() {
    if (!this.deps.transport.available) return;
    this.status = await this.deps.transport.status().catch(() => this.status);
    this.changed();
  }

  async setToken(token: string) {
    await this.deps.transport.setToken(token);
    const bot = await this.deps.transport.verify();
    await this.refresh();
    return bot;
  }
  async start() {
    await this.deps.transport.start((e) => void this.onEvent(e));
    await this.refresh();
    // what was missed while RealmNest was closed
    if (this.settings.notify.missed) for (const s of this.deps.missedSchedules()) if (s.missed) await this.notify('missed', this.t('tg.missed', { name: s.name, n: s.missed.count }));
  }
  async stop() {
    await this.deps.transport.stop();
    await this.refresh();
  }
  get available() {
    return this.deps.transport.available;
  }
  pairBegin() {
    return this.deps.transport.pairBegin();
  }
  async pairCancel() {
    await this.deps.transport.pairCancel();
    await this.refresh();
  }
  async removeUser(userId: number) {
    await this.deps.transport.removeUser(userId);
    await this.refresh();
  }
  /** stop, forget the linked accounts, delete the token */
  async disconnect() {
    await this.deps.transport.disconnect();
    this.chats.clear();
    await this.refresh();
  }

  // ── events from Telegram ────────────────────────────────
  async onEvent(e: TgEvent) {
    if (e.t === 'status') {
      this.status = { ...this.status, running: e.running, ...(e.error ? { error: e.error } : { error: undefined }) };
      return this.changed();
    }
    if (e.t === 'paired') return this.refresh();
    if (e.t === 'callback') return this.onButton(e.id, e.chatId, e.data, e.userId);
    try {
      await this.onMessage(e.chatId, e.text?.trim() ?? '', e.file, e.userId);
    } catch (err) {
      await this.say(e.chatId, this.t('tg.error', { msg: err instanceof Error ? err.message : String(err) }));
    }
  }

  private chat(chatId: number): ChatState {
    let c = this.chats.get(chatId);
    if (!c) this.chats.set(chatId, (c = { context: { kind: 'none' }, pending: [] }));
    return c;
  }

  private async onMessage(chatId: number, text: string, file?: { fileId: string; kind: string; name?: string; mime?: string; size?: number }, userId?: number) {
    const c = this.chat(chatId);
    if (file) {
      if (file.kind === 'voice' || file.kind === 'audio') return this.say(chatId, this.t('tg.voice'));
      const got = await this.receive(file);
      if (!got) return this.say(chatId, this.t('tg.fileRefused', { name: file.name ?? file.kind }));
      c.pending.push(got);
      if (!text) return this.say(chatId, this.t('tg.fileKept', { name: got.name }));
    }
    if (!text) return;
    if (text.startsWith('/')) return this.command(chatId, text, userId);
    // a workflow waiting for its inputs
    if (c.asking) return this.answerInput(chatId, text);
    // feedback on a crew's final result
    if (c.feedbackFor) {
      const runId = c.feedbackFor;
      delete c.feedbackFor;
      this.deps.crews.requestChanges(runId, text);
      return this.say(chatId, this.t('tg.feedbackSent'));
    }
    if (c.context.kind === 'agent') return this.askAgent(chatId, c.context.agentId, text);
    if (c.context.kind === 'crew') return this.toCrew(chatId, c.context.crewId, text);
    return this.concierge(chatId, text);
  }

  /** a file the user sent → an attachment of the next task (the usual pipeline: FileStore, content checks) */
  private async receive(file: { fileId: string; kind: string; name?: string; mime?: string }): Promise<AttachmentInput | undefined> {
    const stored = await this.deps.transport.fetchFile(file.fileId);
    const mime = stored.mime ?? file.mime ?? (stored.text ? 'text/plain' : 'application/octet-stream');
    const kind: AttachmentKind | undefined = /^image\/(png|jpeg|webp|gif)$/.test(mime) ? 'image' : mime === 'application/pdf' ? 'pdf' : stored.text ? 'text' : undefined;
    if (!kind) return undefined;
    const name = file.name ?? (kind === 'image' ? 'foto.jpg' : kind === 'pdf' ? 'documento.pdf' : 'file.txt');
    return { name, mime, size: stored.size, kind, storageRef: stored.storageRef, sha256: stored.sha256, source: 'external', createdAt: this.now() };
  }

  // ── commands ────────────────────────────────────────────
  private async command(chatId: number, line: string, userId?: number) {
    const [head, ...rest] = line.split(/\s+/);
    const cmd = head.replace(/@.*$/, '').toLowerCase();
    const arg = rest.join(' ').trim();
    const c = this.chat(chatId);
    switch (cmd) {
      case '/start':
      case '/help':
        return this.say(chatId, this.t('tg.help'));
      case '/status':
        return this.say(chatId, this.statusText());
      case '/agents':
        return this.pickAgent(chatId);
      case '/agent': {
        if (!arg) return this.pickAgent(chatId);
        const a = this.findAgent(arg);
        if (!a) return this.say(chatId, this.t('tg.noAgent', { name: arg }));
        c.context = { kind: 'agent', agentId: a.id };
        return this.say(chatId, this.t('tg.nowAgent', { name: a.name }));
      }
      case '/crews':
        return this.say(chatId, this.deps.crews.list().length ? this.t('tg.pickCrew') : this.t('tg.noCrews'), this.crewButtons(chatId));
      case '/crew': {
        if (!arg) return this.say(chatId, this.t('tg.pickCrew'), this.crewButtons(chatId));
        const cr = this.findCrew(arg);
        if (!cr) return this.say(chatId, this.t('tg.noCrew', { name: arg }));
        c.context = { kind: 'crew', crewId: cr.id };
        return this.say(chatId, this.t('tg.nowCrew', { name: cr.name }));
      }
      case '/workflows':
        return this.say(chatId, this.deps.workflows.all().length ? this.t('tg.pickWorkflow') : this.t('tg.noWorkflows'), this.workflowButtons(chatId));
      case '/run': {
        if (!arg) return this.say(chatId, this.t('tg.pickWorkflow'), this.workflowButtons(chatId));
        const w = this.findWorkflow(arg);
        if (!w) return this.say(chatId, this.t('tg.noWorkflow', { name: arg }));
        return this.runWorkflow(chatId, w);
      }
      case '/tasks':
        return this.say(chatId, this.tasksText(chatId));
      case '/cancel':
        return this.cancelLast(chatId);
      case '/approve':
      case '/reject':
        // never decided blind: the oldest thing waiting is shown, and a button confirms (docs/HARDENING.md I-13)
        if (!this.isOwner(userId)) return this.say(chatId, this.t('tg.ownerOnly'));
        return this.showOldest(chatId);
      case '/end':
        c.context = { kind: 'none' };
        delete c.asking;
        delete c.feedbackFor;
        return this.say(chatId, this.t('tg.ended'));
      default:
        return this.say(chatId, this.t('tg.unknownCommand'));
    }
  }

  private findAgent(name: string) {
    const n = name.toLowerCase();
    const all = this.deps.agents();
    return all.find((a) => a.name.toLowerCase() === n) ?? all.find((a) => a.name.toLowerCase().startsWith(n));
  }
  private findCrew(name: string) {
    const n = name.toLowerCase();
    const all = this.deps.crews.list();
    return all.find((c) => c.name.toLowerCase() === n) ?? all.find((c) => c.name.toLowerCase().includes(n));
  }
  private findWorkflow(name: string) {
    const n = name.toLowerCase();
    const all = this.deps.workflows.all();
    return all.find((w) => w.name.toLowerCase() === n) ?? all.find((w) => w.name.toLowerCase().includes(n));
  }

  /** "who do you want to talk to?": the agents' portraits with a button each (text only when no picture) */
  private async pickAgent(chatId: number) {
    const buttons = this.agentButtons(chatId);
    const sheet = await this.deps.agentSheet?.().catch(() => undefined);
    if (sheet) {
      const id = await this.deps.transport.sendPhoto(chatId, sheet.storageRef, this.t('tg.pickAgent'), buttons, true).catch(() => 0);
      if (id) return id;
    }
    return this.say(chatId, this.t('tg.pickAgent'), buttons);
  }

  private agentButtons(chatId: number): TgButton[][] {
    const rows: TgButton[][] = [];
    for (const a of this.deps.agents().slice(0, 24)) {
      const b = this.button(a.name, () => {
        this.chat(chatId).context = { kind: 'agent', agentId: a.id };
        return this.say(chatId, this.t('tg.nowAgent', { name: a.name }));
      });
      if (!rows.length || rows[rows.length - 1].length >= 4) rows.push([b]);
      else rows[rows.length - 1].push(b);
    }
    return rows.slice(0, 8);
  }
  private crewButtons(chatId: number): TgButton[][] {
    return this.deps.crews
      .list()
      .slice(0, 8)
      .map((cr) => [
        this.button(cr.name, () => {
          this.chat(chatId).context = { kind: 'crew', crewId: cr.id };
          return this.say(chatId, this.t('tg.nowCrew', { name: cr.name }));
        }),
      ]);
  }
  private workflowButtons(chatId: number): TgButton[][] {
    return this.deps.workflows
      .all()
      .slice(0, 8)
      .map((w) => [this.button(w.name, () => this.runWorkflow(chatId, w))]);
  }

  // ── doing things ────────────────────────────────────────
  /** a task for an agent: an ordinary agent task; the answer comes back when it ends. `byModel`: the
   *  concierge reworded the request (its @mentions and memories are not the user's) */
  async askAgent(chatId: number, agentId: string, text: string, byModel = false) {
    const a = this.deps.agents().find((x) => x.id === agentId);
    if (!a) return this.say(chatId, this.t('tg.noAgent', { name: agentId }));
    const live = this.deps.live;
    if (live.activeRun(agentId) && !live.giveTask) return this.say(chatId, this.t('tg.busy', { name: a.name }));
    const c = this.chat(chatId);
    const attachments = c.pending.splice(0);
    const input = { prompt: text, title: text.slice(0, 80), ...(attachments.length && { attachments }), ...(byModel && { modelWritten: true }) };
    let run: { id: string };
    if (live.giveTask) {
      const given = live.giveTask(agentId, input);
      if (given.queued || !given.run) {
        // a busy agent: the task waits its turn, and the answer comes here when it is done
        this.queuedTasks.set(given.task.id, chatId);
        return this.say(chatId, this.t('tg.queued', { name: a.name, n: live.queueLength?.(agentId) ?? 1 }));
      }
      run = given.run;
    } else run = live.startTask(agentId, input).run;
    this.runs.set(run.id, chatId);
    c.last = { kind: 'agent', id: run.id, agentId };
    await this.deps.transport.typing(chatId).catch(() => undefined);
    return this.say(chatId, this.t('tg.working', { name: a.name }));
  }

  private async toCrew(chatId: number, crewId: string, text: string) {
    const cr = this.deps.crews.list().find((x) => x.id === crewId);
    if (!cr) return this.say(chatId, this.t('tg.noCrew', { name: crewId }));
    const open = this.deps.crews.runsOf(crewId).find((r) => r.status === 'awaiting_approval');
    if (open && this.started.get(open.id) === chatId) {
      this.deps.crews.requestChanges(open.id, text);
      return this.say(chatId, this.t('tg.feedbackSent'));
    }
    const run = this.deps.crews.start(crewId, text);
    this.started.set(run.id, chatId);
    this.seen.set(run.id, run.status);
    this.chat(chatId).last = { kind: 'crew', id: run.id };
    return this.say(chatId, this.t('tg.crewStarted', { name: cr.name }));
  }

  private async runWorkflow(chatId: number, w: WorkflowDefinition) {
    const left = w.inputs.filter((i) => i.required || !i.default).map((i) => i.name);
    if (left.length) {
      this.chat(chatId).asking = { workflowId: w.id, values: {}, left };
      const first = w.inputs.find((i) => i.name === left[0])!;
      return this.say(chatId, this.t('tg.askInput', { name: w.name, input: first.label ?? first.name }));
    }
    return this.launch(chatId, w, {});
  }
  private async answerInput(chatId: number, text: string) {
    const c = this.chat(chatId);
    const a = c.asking!;
    const w = this.deps.workflows.get(a.workflowId);
    if (!w) {
      delete c.asking;
      return this.say(chatId, this.t('tg.noWorkflow', { name: a.workflowId }));
    }
    a.values[a.left.shift()!] = text;
    if (a.left.length) {
      const next = w.inputs.find((i) => i.name === a.left[0])!;
      return this.say(chatId, this.t('tg.askInput', { name: w.name, input: next.label ?? next.name }));
    }
    delete c.asking;
    return this.launch(chatId, w, a.values);
  }
  private async launch(chatId: number, w: WorkflowDefinition, inputs: Record<string, string>) {
    const run = this.deps.orchestrator.create(w, inputs);
    this.started.set(run.id, chatId);
    this.seen.set(run.id, run.status);
    this.chat(chatId).last = { kind: 'workflow', id: run.id };
    return this.say(chatId, this.t('tg.workflowStarted', { name: w.name }));
  }

  private async cancelLast(chatId: number) {
    const last = this.chat(chatId).last;
    if (!last) return this.say(chatId, this.t('tg.nothingToCancel'));
    if (last.kind === 'agent' && last.agentId && this.deps.live.activeRun(last.agentId)?.id === last.id) await this.deps.live.cancel(last.agentId);
    else if (last.kind === 'crew') await this.deps.crews.cancel(last.id);
    else if (last.kind === 'workflow') this.deps.orchestrator.cancel(last.id);
    else return this.say(chatId, this.t('tg.nothingToCancel'));
    return this.say(chatId, this.t('tg.cancelled'));
  }

  /** the concierge: the Chat route's model picks who should get the request */
  private async concierge(chatId: number, text: string) {
    const agents = this.deps.agents();
    const crews = this.deps.crews.list();
    const flows = this.deps.workflows.all();
    const system = [
      'You route a request from the owner of RealmNest (an app where AI agents work in small worlds) to the right place. You never do the work yourself.',
      'Agents:',
      ...agents.map((a) => `- ${a.name}${a.role ? ` (${a.role})` : ''}${a.worldId ? `, world ${this.deps.worldName?.(a.worldId) ?? a.worldId}` : ''}`),
      'Crews (teams of agents):',
      ...(crews.length ? crews.map((c) => `- ${c.name}`) : ['- none']),
      'Workflows:',
      ...(flows.length ? flows.map((w) => `- ${w.name}`) : ['- none']),
      'Answer with JSON only: {"action": "agent" | "crew" | "workflow" | "status" | "file" | "reply", "target": "the exact name, or empty", "message": "for agent/crew: the request to pass on, in the user\'s own words and language; for file: what file they want; for reply: your short answer in the user\'s language"}.',
      'Use "agent" when they name an agent or the request clearly fits one; "crew" for a crew; "workflow" to run a workflow; "status" when they ask what is going on; "file" when they want a document or report sent; "reply" when you only need to answer or ask which agent they mean.',
    ].join('\n');
    await this.deps.transport.typing(chatId).catch(() => undefined);
    let raw: string;
    try {
      raw = await this.deps.complete(system, text);
    } catch (err) {
      return this.say(chatId, this.t('tg.conciergeDown', { msg: err instanceof Error ? err.message : String(err) }));
    }
    const o = parseJsonObject<{ action?: string; target?: string; message?: string }>(raw) ?? {};
    const message = (o.message ?? '').trim() || text;
    switch (o.action) {
      case 'agent': {
        const a = this.findAgent(o.target ?? '');
        return a ? this.askAgent(chatId, a.id, message, message !== text) : this.pickAgent(chatId);
      }
      case 'crew': {
        const cr = this.findCrew(o.target ?? '');
        return cr ? this.toCrew(chatId, cr.id, message) : this.say(chatId, this.t('tg.pickCrew'), this.crewButtons(chatId));
      }
      case 'workflow': {
        const w = this.findWorkflow(o.target ?? '');
        return w ? this.runWorkflow(chatId, w) : this.say(chatId, this.t('tg.pickWorkflow'), this.workflowButtons(chatId));
      }
      case 'status':
        return this.say(chatId, this.statusText());
      case 'file':
        return this.sendArtifactLike(chatId, message);
      default:
        return this.say(chatId, markdownToHtml(o.message?.trim() || raw.trim().slice(0, CHUNK)) || this.t('tg.didNotUnderstand'));
    }
  }

  private async sendArtifactLike(chatId: number, what: string) {
    const a = this.deps.artifacts.find(what);
    if (!a?.storageRef) return this.say(chatId, this.t('tg.noFile', { what }));
    await this.deps.transport.sendDocument(chatId, a.storageRef, a.name);
  }
  private async sendArtifact(chatId: number, id: string) {
    const a = this.deps.artifacts.get(id);
    if (!a?.storageRef) return this.say(chatId, this.t('tg.noFile', { what: id }));
    await this.deps.transport.sendDocument(chatId, a.storageRef, a.name);
  }

  // ── status ──────────────────────────────────────────────
  statusText() {
    const t = this.t;
    const lines: string[] = [];
    for (const a of this.deps.agents()) {
      const r = this.deps.live.activeRun(a.id);
      if (r) lines.push(t('tg.st.agent', { name: a.name, task: (r.taskId && this.deps.live.taskTitle?.(r.taskId)) || '…' }));
    }
    for (const c of this.deps.crews.list())
      for (const r of this.deps.crews.runsOf(c.id).filter((x) => !['done', 'failed', 'cancelled'].includes(x.status))) lines.push(t('tg.st.crew', { name: c.name, status: t(`cw.rs.${r.status}` as TKey) }));
    for (const r of this.deps.orchestrator.list().filter((x) => isOpenRun(x.status))) lines.push(t('tg.st.workflow', { name: r.definition.name, status: t(`wf.rs.${r.status}` as TKey) }));
    const waiting = this.deps.approvals.list().length;
    if (waiting) lines.push(t('tg.st.approvals', { n: waiting }));
    return lines.length ? `${t('tg.st.head')}\n${lines.join('\n')}` : t('tg.st.quiet');
  }
  private tasksText(chatId: number) {
    const mine = [...this.runs.entries()].filter(([, c]) => c === chatId).length + [...this.started.values()].filter((c) => c === chatId).length;
    return `${this.statusText()}\n\n${this.t('tg.fromHere', { n: mine })}`;
  }

  // ── approvals ───────────────────────────────────────────
  /** the paired user is the owner (the first one paired): only they decide approvals (docs/HARDENING.md I-13) */
  private isOwner(userId: number | undefined) {
    return userId !== undefined && this.users().some((u) => u.userId === userId && u.role === 'owner');
  }

  /** /approve, /reject: the oldest thing waiting, shown with its buttons (nothing is decided without one) */
  private async showOldest(chatId: number) {
    const tool = this.deps.approvals.list()[0];
    if (tool) return this.sendApproval(`tool:${tool.call.id}`, [chatId], this.toolMessage(tool));
    const wf = this.deps.orchestrator.list().find((r) => r.status === 'awaiting_approval' && Object.values(r.nodes).some((n) => n.status === 'awaiting_approval' && r.definition.nodes.find((x) => x.id === n.nodeId)?.config.kind === 'approval'));
    if (wf) {
      const n = Object.values(wf.nodes).find((x) => x.status === 'awaiting_approval' && wf.definition.nodes.find((d) => d.id === x.nodeId)?.config.kind === 'approval')!;
      return this.sendApproval(`wf:${wf.id}:${n.nodeId}`, [chatId], this.workflowMessage(wf, n.nodeId));
    }
    const crew = this.deps.crews.runsOf().find((r) => r.status === 'awaiting_plan') ?? this.deps.crews.runsOf().find((r) => r.status === 'awaiting_approval');
    if (crew) return this.sendApproval(`crew:${crew.id}`, [chatId], crew.status === 'awaiting_plan' ? this.planMessage(crew) : this.finalMessage(crew));
    return this.say(chatId, this.t('tg.nothingWaits'));
  }

  /** sends an approval message to these chats and keeps it, to close it when decided anywhere */
  private async sendApproval(key: string, chats: number[], m: { text: string; buttons: (chatId: number) => TgButton[][] }) {
    const sent: { chatId: number; messageId: number }[] = [];
    for (const chatId of chats) {
      const messageId = await this.say(chatId, m.text, m.buttons(chatId)).catch(() => 0);
      if (messageId) sent.push({ chatId, messageId });
    }
    this.sentApprovals.set(key, [...(this.sentApprovals.get(key) ?? []), ...sent.map((s) => ({ ...s, text: m.text }))]);
  }

  private toolMessage(p: PendingApproval) {
    const callId = p.call.id;
    const who = this.deps.agents().find((a) => a.id === p.call.agentId)?.name ?? p.requester;
    const input = JSON.stringify(p.call.input ?? {});
    const cut = input.length > INPUT_SHOWN;
    const text = `${this.t('tg.toolWaits', { who, tool: p.call.toolId })}\n<pre>${esc(cut ? `${input.slice(0, INPUT_SHOWN)}…` : input)}</pre>${cut ? `\n${this.t('tg.inputCut', { n: input.length })}` : ''}`;
    // a call no longer waiting (decided, cancelled, failed) answers so instead of doing nothing
    const decide = (d: ApprovalDecision) => () => {
      if (!this.deps.approvals.list().some((x) => x.call.id === callId)) return this.tp('tg.alreadyDecided');
      this.deps.approvals.decide(callId, d);
    };
    return {
      text,
      buttons: () => [
        [this.button(this.tp('tg.btn.approve'), decide('once'), true), this.button(this.tp('tg.btn.reject'), decide('deny'), true)],
        [this.button(this.tp('tg.btn.allowRun'), decide('run'), true)],
      ],
    };
  }

  private workflowMessage(run: WorkflowRun, nodeId: string) {
    const def = run.definition.nodes.find((d) => d.id === nodeId);
    const text = `${this.t('tg.workflowWaits', { name: run.definition.name, node: def?.title ?? nodeId })}\n\n${markdownToHtml((run.nodes[nodeId]?.prompt ?? '').slice(0, 1500))}`;
    const decide = (d: 'approved' | 'rejected') => () => {
      if (this.deps.orchestrator.get(run.id)?.nodes[nodeId]?.status !== 'awaiting_approval') return this.tp('tg.alreadyDecided');
      this.deps.orchestrator.decide(run.id, nodeId, d);
    };
    return { text, buttons: () => [[this.button(this.tp('tg.btn.approve'), decide('approved'), true), this.button(this.tp('tg.btn.reject'), decide('rejected'), true)]] };
  }

  /** a crew's plan, its buttons bound to this version of it: an older Approve never starts a newer plan (I-6) */
  private planMessage(run: CrewRun) {
    const runId = run.id;
    const rev = crewRevision(run, 'plan');
    const plan = run.plan.map((t, i) => `<b>${i + 1}.</b> <b>${esc(this.deps.agents().find((a) => a.id === t.assigneeId)?.name ?? t.assigneeId)}</b> → ${esc(t.title)}`).join('\n');
    const text = `${this.t('tg.crewPlan', { name: run.crew.name })}\n\n${plan}`;
    const approve = (chatId: number) => async () => {
      const cur = this.deps.crews.run(runId);
      if (cur?.status !== 'awaiting_plan') return this.tp('tg.alreadyDecided');
      if (crewRevision(cur, 'plan') !== rev) {
        await this.say(chatId, this.t('tg.planChanged'));
        return this.sendApproval(`crew:${runId}`, [chatId], this.planMessage(cur));
      }
      this.deps.crews.approvePlan(runId, rev);
    };
    const replan = () => {
      if (this.deps.crews.run(runId)?.status !== 'awaiting_plan') return this.tp('tg.alreadyDecided');
      this.deps.crews.replan(runId);
    };
    return { text, buttons: (chatId: number) => [[this.button(this.tp('tg.btn.approvePlan'), approve(chatId), true), this.button(this.tp('tg.btn.replan'), replan, true)]] };
  }

  /** a crew's final result, its Approve bound to this version of it (I-6) */
  private finalMessage(run: CrewRun) {
    const runId = run.id;
    const rev = crewRevision(run, 'final');
    const text = `${this.t('tg.crewFinal', { name: run.crew.name })}\n\n${markdownToHtml((run.final?.text ?? '').slice(0, 1500))}`;
    const waiting = () => this.deps.crews.run(runId)?.status === 'awaiting_approval';
    const approve = (chatId: number) => async () => {
      const cur = this.deps.crews.run(runId);
      if (cur?.status !== 'awaiting_approval') return this.tp('tg.alreadyDecided');
      if (crewRevision(cur, 'final') !== rev) {
        await this.say(chatId, this.t('tg.finalChanged'));
        return this.sendApproval(`crew:${runId}`, [chatId], this.finalMessage(cur));
      }
      this.deps.crews.approveFinal(runId, rev);
    };
    const changes = (chatId: number) => () => {
      if (!waiting()) return this.tp('tg.alreadyDecided');
      this.chat(chatId).feedbackFor = runId;
      return this.say(chatId, this.t('tg.askFeedback'));
    };
    return {
      text,
      buttons: (chatId: number) => [
        [this.button(this.tp('tg.btn.approve'), approve(chatId), true), this.button(this.tp('tg.btn.changes'), changes(chatId), true)],
        ...(run.final?.artifactId ? [[this.button(this.tp('tg.btn.download'), () => this.sendArtifact(chatId, run.final!.artifactId!))]] : []),
      ],
    };
  }

  /** a tool call waits: to every paired chat, with buttons; updated when decided anywhere */
  private async toolWaits(callId: string) {
    if (!this.settings.notify.approvals) return;
    const p = this.deps.approvals.list().find((x) => x.call.id === callId);
    if (!p) return;
    await this.sendApproval(`tool:${callId}`, this.users().map((u) => u.chatId), this.toolMessage(p));
  }
  /** the approval message loses its buttons and says how it ended */
  private async closeApproval(key: string, outcome: Outcome) {
    const sent = this.sentApprovals.get(key);
    if (!sent) return;
    this.sentApprovals.delete(key);
    const note = outcome === 'yes' ? this.t('tg.decidedYes') : outcome === 'no' ? this.t('tg.decidedNo') : this.t('tg.decidedGone');
    for (const s of sent) await this.deps.transport.edit(s.chatId, s.messageId, `${s.text}\n\n${note}`, undefined, true).catch(() => undefined);
  }

  // ── what happens in RealmNest ───────────────────────────
  private listen() {
    const bus = this.deps.bus;
    // the runtime frees the agent right after emitting: handle the end in a microtask
    this.offs.push(
      bus.on('agent.run.completed', (p) => queueMicrotask(() => void this.runEnded(p.runId, p.agentId, p.result, undefined, p.taskId))),
      bus.on('agent.run.failed', (p) => queueMicrotask(() => void this.runEnded(p.runId, p.agentId, undefined, p.error.message, p.taskId))),
      bus.on('agent.run.cancelled', (p) => queueMicrotask(() => void this.runEnded(p.runId, p.agentId, undefined, this.t('tg.stopped'), p.taskId))),
      // a queued task that ended without running (taken out of the queue, or it could not start)
      bus.on('task.status.changed', (p) => (p.to === 'cancelled' || p.to === 'failed') && this.queuedTasks.has(p.taskId) && queueMicrotask(() => void this.queuedEnded(p.taskId, p.agentId))),
      bus.on('tool.awaiting_approval', (p) => void this.toolWaits(p.toolCallId)),
      bus.on('tool.approved', (p) => void this.closeApproval(`tool:${p.toolCallId}`, 'yes')),
      bus.on('tool.denied', (p) => void this.closeApproval(`tool:${p.toolCallId}`, 'no')),
      // stopped or failed while waiting: the message closes, its buttons go (I-13)
      bus.on('tool.cancelled', (p) => void this.closeApproval(`tool:${p.toolCallId}`, 'gone')),
      bus.on('tool.failed', (p) => void this.closeApproval(`tool:${p.toolCallId}`, 'gone')),
      bus.on('crew.event', (p) => queueMicrotask(() => void this.crewChanged(p.runId, p.kind, p.message))),
      bus.on('workflow.event', (p) => queueMicrotask(() => void this.workflowChanged(p.runId, p.kind, p.message))),
    );
  }

  private async queuedEnded(taskId: string, agentId: string) {
    const end = this.deps.live.queuedEnd?.(taskId);
    const chatId = this.queuedTasks.get(taskId);
    // it ran: its run's end answers (runEnded)
    if (chatId === undefined || !end || end.started) return;
    this.queuedTasks.delete(taskId);
    const name = this.deps.agents().find((x) => x.id === agentId)?.name ?? agentId;
    return this.say(chatId, end.error ? this.t('tg.agentFailed', { name, msg: end.error }) : this.t('tg.unqueued', { name }));
  }

  private async runEnded(runId: string, agentId: string, result?: string, error?: string, taskId?: string) {
    const chatId = this.runs.get(runId) ?? (taskId !== undefined ? this.queuedTasks.get(taskId) : undefined);
    if (chatId === undefined) return;
    this.runs.delete(runId);
    if (taskId !== undefined) this.queuedTasks.delete(taskId);
    const a = this.deps.agents().find((x) => x.id === agentId);
    const name = a?.name ?? agentId;
    if (error) return this.say(chatId, this.t('tg.agentFailed', { name, msg: error }));
    const head = `<b>${esc(name)}</b>${a?.role ? ` · <i>${esc(a.role)}</i>` : ''}`;
    return this.sayMarkdown(chatId, head, (result ?? '').trim() || this.tp('tg.emptyAnswer'));
  }

  private async crewChanged(runId: string, kind: string, message: string) {
    const run = this.deps.crews.run(runId);
    if (!run) return;
    // an agent cannot go on without the user (BLOCKED): the paired users hear it, the answer is given in RealmNest
    if (kind === 'ask') {
      const asking = [...run.plan.flatMap((x) => [x, ...(x.items ?? [])])].reverse().find((x) => x.status === 'needs_input');
      if (asking && this.settings.notify.approvals) for (const u of this.users()) await this.say(u.chatId, this.t('tg.crewAsk', { name: esc(run.crew.name), id: asking.id, q: esc(asking.question ?? '') }));
      return;
    }
    const before = this.seen.get(runId);
    this.seen.set(runId, run.status);
    const mine = this.started.has(runId);
    if (run.status !== before) {
      // what was asked before (a plan, a final result) is answered or gone: its message closes (I-6)
      await this.closeApproval(`crew:${runId}`, run.status === 'running' || run.status === 'done' ? 'yes' : run.status === 'planning' || run.status === 'assembling' ? 'no' : 'gone');
      if (run.status === 'awaiting_plan' && this.settings.notify.approvals) return this.sendApproval(`crew:${runId}`, this.users().map((u) => u.chatId), this.planMessage(run));
      if (run.status === 'awaiting_approval' && this.settings.notify.approvals) return this.sendApproval(`crew:${runId}`, this.users().map((u) => u.chatId), this.finalMessage(run));
      if (run.status === 'done' || run.status === 'failed') {
        if (!(mine ? this.settings.notify.mine : this.settings.notify.runs)) return;
        const text = run.status === 'done' ? this.t('tg.crewDone', { name: run.crew.name }) : this.t('tg.crewFailed', { name: run.crew.name, msg: run.error ?? '' });
        await this.notify('runs', text, run.status === 'done' && run.final?.artifactId ? (chatId) => [[this.button(this.tp('tg.btn.download'), () => this.sendArtifact(chatId, run.final!.artifactId!))]] : undefined);
        return;
      }
    }
    if (this.settings.notify.progress && ['start', 'output', 'review', 'handoff'].includes(kind)) await this.notify('progress', `<b>${esc(run.crew.name)}</b> · ${esc(message)}`);
  }

  private async workflowChanged(runId: string, kind: string, message: string) {
    const run = this.deps.orchestrator.get(runId);
    if (!run) return;
    const before = this.seen.get(runId);
    this.seen.set(runId, run.status);
    const mine = this.started.has(runId);
    if (run.status === 'awaiting_approval' && kind === 'approval' && this.settings.notify.approvals) {
      for (const n of Object.values(run.nodes)) {
        const def = run.definition.nodes.find((d) => d.id === n.nodeId);
        if (n.status !== 'awaiting_approval' || def?.config.kind !== 'approval' || this.sentApprovals.has(`wf:${runId}:${n.nodeId}`)) continue;
        await this.sendApproval(`wf:${runId}:${n.nodeId}`, this.users().map((u) => u.chatId), this.workflowMessage(run, n.nodeId));
      }
      return;
    }
    // an approval decided on the desktop closes the Telegram one
    for (const key of [...this.sentApprovals.keys()].filter((k) => k.startsWith(`wf:${runId}:`))) {
      const node = run.nodes[key.split(':')[2]];
      if (node && node.status !== 'awaiting_approval') await this.closeApproval(key, node.value === 'approved' ? 'yes' : node.value === 'rejected' ? 'no' : 'gone');
    }
    if (run.status !== before && (run.status === 'completed' || run.status === 'failed')) {
      if (!(mine ? this.settings.notify.mine : this.settings.notify.runs)) return;
      const text = run.status === 'completed' ? this.t('tg.workflowDone', { name: run.definition.name }) : this.t('tg.workflowFailed', { name: run.definition.name, msg: run.error ?? '' });
      await this.notify('runs', text, run.artifacts.length ? (chatId) => run.artifacts.slice(0, 3).map((id) => [this.button(this.tp('tg.btn.downloadNamed', { name: (this.deps.artifacts.get(id)?.name ?? id).slice(0, 40) }), () => this.sendArtifact(chatId, id))]) : undefined);
      return;
    }
    if (this.settings.notify.progress && (kind === 'node' || kind === 'done')) await this.notify('progress', `<b>${esc(run.definition.name)}</b> · ${esc(message)}`);
  }

  // ── buttons ─────────────────────────────────────────────
  private button(text: string, run: Action, approval = false): TgButton {
    const id = `${(++this.counter).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    this.buttons.set(id, { at: this.now(), run, ...(approval && { approval }) });
    // old buttons go
    if (this.buttons.size > 500) for (const [k, v] of this.buttons) if (this.now() - v.at > BUTTON_TTL) this.buttons.delete(k);
    return { text, data: `b:${id}` };
  }
  private async onButton(callbackId: string, chatId: number, data: string, userId?: number) {
    const b = data.startsWith('b:') ? this.buttons.get(data.slice(2)) : undefined;
    if (!b || this.now() - b.at > BUTTON_TTL) {
      await this.deps.transport.answer(callbackId, this.tp('tg.buttonOld')).catch(() => undefined);
      return;
    }
    // approvals are the owner's: another paired user's press does nothing (the button stays for the owner)
    if (b.approval && !this.isOwner(userId)) {
      await this.deps.transport.answer(callbackId, this.tp('tg.ownerOnly')).catch(() => undefined);
      return;
    }

    this.buttons.delete(data.slice(2));
    await this.deps.transport.answer(callbackId).catch(() => undefined);
    try {
      const out = await b.run();
      if (typeof out === 'string' && out) await this.say(chatId, out);
    } catch (err) {
      await this.say(chatId, this.t('tg.error', { msg: err instanceof Error ? err.message : String(err) }));
    }
  }

  // ── sending ─────────────────────────────────────────────
  private users(): TgUser[] {
    return this.status.users;
  }
  /** a message, split at Telegram's limit; buttons on the last part */
  async say(chatId: number, text: string, buttons?: TgButton[][]): Promise<number> {
    const parts: string[] = [];
    let rest = text;
    while (rest.length > CHUNK) {
      const cut = rest.lastIndexOf('\n', CHUNK) > CHUNK / 2 ? rest.lastIndexOf('\n', CHUNK) : CHUNK;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^\n/, '');
    }
    parts.push(rest);
    let id = 0;
    for (let i = 0; i < parts.length; i++) id = await this.deps.transport.send(chatId, parts[i], i === parts.length - 1 && buttons?.length ? buttons : undefined, true);
    return id;
  }
  /** Markdown (an agent's answer) as Telegram HTML, under a header, in whole parts */
  async sayMarkdown(chatId: number, headHtml: string, md: string, buttons?: TgButton[][]): Promise<number> {
    const parts = markdownParts(md, CHUNK - headHtml.length - 2);
    let id = 0;
    for (let i = 0; i < parts.length; i++) id = await this.deps.transport.send(chatId, i === 0 ? `${headHtml}\n\n${parts[i]}` : parts[i], i === parts.length - 1 && buttons?.length ? buttons : undefined, true);
    return id;
  }
  private async broadcast(text: string, buttons?: (chatId: number) => TgButton[][]) {
    const out: { chatId: number; messageId: number }[] = [];
    for (const u of this.users()) {
      const messageId = await this.say(u.chatId, text, buttons?.(u.chatId)).catch(() => 0);
      if (messageId) out.push({ chatId: u.chatId, messageId });
    }
    return out;
  }
  /** a notification, unless it is quiet time (approvals always go) */
  private async notify(_kind: 'runs' | 'progress' | 'missed', text: string, buttons?: (chatId: number) => TgButton[][]) {
    if (!this.status.running || this.quiet()) return;
    await this.broadcast(text, buttons);
  }
  private quiet() {
    const q = this.settings.quiet;
    if (!q) return false;
    const d = new Date(this.now());
    const m = d.getHours() * 60 + d.getMinutes();
    const at = (s: string) => {
      const [h, mm] = s.split(':').map(Number);
      return h * 60 + (mm || 0);
    };
    const from = at(q.from);
    const to = at(q.to);
    return from <= to ? m >= from && m < to : m >= from || m < to;
  }
}

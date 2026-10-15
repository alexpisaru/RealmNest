// The WORKFLOW part (docs/WORKFLOWS.md): definitions only — what happens and in what order. A
// definition is checked (ids, edges, branches, cycles, required fields) and versioned on every
// save; it never runs anything. Plus the text templates its fields use, and ready-made workflows.

import { NODE_KINDS, WORKFLOW_LIMITS, workflowOrder, type NodeConfig, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode } from '../../domain/workflow';
import type { StorageAdapter } from '../../persistence/storage';

const KEY = 'workflows';

/** an English message (logs, tests) and, for the UI, a translation key wf.err.<key> with its values */
export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly key?: string,
    readonly vars: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** what a definition may refer to (checked on save) */
export interface WorkflowRefs {
  agent?: (id: string) => boolean;
  tool?: (id: string) => boolean;
  crew?: (id: string) => boolean;
}

/** a definition's shape and references; the cleaned definition, or a WorkflowError saying what is wrong */
export function checkDefinition(d: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>, refs: WorkflowRefs = {}): Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
  const name = String(d.name ?? '').trim().slice(0, 80);
  if (!name) throw new WorkflowError('Give the workflow a name.', 'name');
  if (!d.nodes?.length) throw new WorkflowError('Add at least one node.', 'noNodes');
  if (d.nodes.length > WORKFLOW_LIMITS.nodes) throw new WorkflowError(`At most ${WORKFLOW_LIMITS.nodes} nodes.`, 'tooMany', { n: String(WORKFLOW_LIMITS.nodes) });
  const ids = new Set<string>();
  const nodes: WorkflowNode[] = d.nodes.map((n) => {
    const id = String(n.id ?? '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,23}$/i.test(id)) throw new WorkflowError(`"${id}" is not a valid node id (letters, digits, - and _).`, 'badId', { id });
    if (ids.has(id)) throw new WorkflowError(`Two nodes are called "${id}".`, 'dupId', { id });
    ids.add(id);
    const title = String(n.title ?? '').trim().slice(0, 100) || id;
    const config = checkConfig(id, n.config, refs);
    const p = n.policy ?? {};
    const policy = {
      ...(p.retries && { retries: Math.max(0, Math.min(WORKFLOW_LIMITS.retries, Math.round(p.retries))) }),
      ...(p.backoffMinutes && { backoffMinutes: Math.max(0, Math.min(1440, p.backoffMinutes)) }),
      ...(p.timeoutMinutes && { timeoutMinutes: Math.max(1, Math.min(24 * 60, p.timeoutMinutes)) }),
      ...(p.onFail && p.onFail !== 'fail' && { onFail: p.onFail }),
    };
    return { id, title, config, ...(Object.keys(policy).length && { policy }) };
  });
  const kindOf = new Map(nodes.map((n) => [n.id, n.config.kind]));
  const seen = new Set<string>();
  const edges: WorkflowEdge[] = (d.edges ?? []).map((e) => {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new WorkflowError(`An edge links "${e.from}" to "${e.to}", which do not both exist.`, 'edgeMissing', { from: e.from, to: e.to });
    const from = kindOf.get(e.from);
    if (e.when && (((e.when === 'true' || e.when === 'false') && from !== 'condition') || ((e.when === 'approved' || e.when === 'rejected') && from !== 'approval')))
      throw new WorkflowError(`"${e.from}" → "${e.to}": a "${e.when}" branch needs a ${e.when === 'true' || e.when === 'false' ? 'condition' : 'approval'} before it.`, e.when === 'true' || e.when === 'false' ? 'branchCondition' : 'branchApproval', { from: e.from, to: e.to });
    const key = `${e.from}>${e.to}>${e.when ?? ''}`;
    if (seen.has(key)) throw new WorkflowError(`The edge "${e.from}" → "${e.to}" is there twice.`, 'dupEdge', { from: e.from, to: e.to });
    seen.add(key);
    return { from: e.from, to: e.to, ...(e.when && { when: e.when }) };
  });
  if (!workflowOrder(nodes, edges)) throw new WorkflowError('The edges make a loop: a workflow goes one way.', 'loop');
  const inputs = (d.inputs ?? [])
    .filter((i) => i.name?.trim())
    .map((i) => ({ name: i.name.trim().replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40), ...(i.label?.trim() && { label: i.label.trim().slice(0, 80) }), ...(i.default !== undefined && i.default !== '' && { default: String(i.default).slice(0, 2000) }), ...(i.required && { required: true }) }));
  const p = d.policies ?? {};
  const policies = {
    ...(p.budgetTokens && p.budgetTokens > 0 && { budgetTokens: Math.round(p.budgetTokens) }),
    ...(p.budgetUsd && p.budgetUsd > 0 && { budgetUsd: p.budgetUsd }),
    ...(p.maxMinutes && p.maxMinutes > 0 && { maxMinutes: Math.round(p.maxMinutes) }),
    ...(p.maxConcurrency && p.maxConcurrency > 0 && { maxConcurrency: Math.min(10, Math.round(p.maxConcurrency)) }),
  };
  return { name, ...(d.description?.trim() && { description: d.description.trim().slice(0, 500) }), inputs, nodes, edges, policies, ...(d.templateId && { templateId: d.templateId }) };
}

function checkConfig(id: string, c: NodeConfig | undefined, refs: WorkflowRefs): NodeConfig {
  if (!c || !NODE_KINDS.includes(c.kind)) throw new WorkflowError(`"${id}": choose what the node does.`, 'kind', { id });
  const need = (v: string | undefined, what: string) => {
    if (!String(v ?? '').trim()) throw new WorkflowError(`"${id}": ${what} is missing.`, 'missing', { id, what: what.replace(/^the /, '').replace(/ /g, '_') });
    return String(v).trim();
  };
  switch (c.kind) {
    case 'agent': {
      const agentId = need(c.agentId, 'the agent');
      if (refs.agent && !refs.agent(agentId)) throw new WorkflowError(`"${id}": that agent no longer exists.`, 'agentGone', { id });
      return { kind: 'agent', agentId, prompt: need(c.prompt, 'the task').slice(0, 8000) };
    }
    case 'tool': {
      const toolId = need(c.toolId, 'the tool');
      if (refs.tool && !refs.tool(toolId)) throw new WorkflowError(`"${id}": the tool "${toolId}" is not available.`, 'toolGone', { id, tool: toolId });
      return { kind: 'tool', toolId, input: Object.fromEntries(Object.entries(c.input ?? {}).map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 4000)])) };
    }
    case 'crew': {
      const crewId = need(c.crewId, 'the crew');
      if (refs.crew && !refs.crew(crewId)) throw new WorkflowError(`"${id}": that crew no longer exists.`, 'crewGone', { id });
      return { kind: 'crew', crewId, goal: need(c.goal, 'the goal').slice(0, 2000), autoApprovePlan: c.autoApprovePlan !== false, ...(c.autoApproveFinal && { autoApproveFinal: true }) };
    }
    case 'wait':
      if (c.mode === 'until') return { kind: 'wait', mode: 'until', at: need(c.at, 'the time') };
      if (!(c.minutes > 0)) throw new WorkflowError(`"${id}": how many minutes to wait?`, 'minutes', { id });
      return { kind: 'wait', mode: 'duration', minutes: Math.min(60 * 24 * 60, c.minutes) };
    case 'approval':
      return { kind: 'approval', prompt: need(c.prompt, 'the question').slice(0, 2000) };
    case 'condition':
      if (c.test === 'agent') {
        const agentId = need(c.agentId, 'the agent');
        // a judging agent must exist too, like an agent node's (docs/HARDENING.md R-15)
        if (refs.agent && !refs.agent(agentId)) throw new WorkflowError(`"${id}": that agent no longer exists.`, 'agentGone', { id });
        return { kind: 'condition', test: 'agent', source: need(c.source, 'what to judge'), agentId, question: need(c.question, 'the question').slice(0, 1000) };
      }
      if (c.test !== 'notEmpty') need(c.value, 'the value to compare');
      return { kind: 'condition', test: c.test, source: need(c.source, 'what to test'), ...(c.value !== undefined && { value: String(c.value).slice(0, 500) }) };
    case 'parallel':
      return { kind: 'parallel' };
    case 'merge':
      return { kind: 'merge', mode: c.mode === 'any' ? 'any' : 'all' };
    case 'output':
      return { kind: 'output', name: need(c.name, 'the file name').slice(0, 120), content: need(c.content, 'the content').slice(0, 20_000) };
  }
}

/** {{input.x}} · {{node.<id>.output}} · {{node.<id>.value}} · {{date}} · {{time}}; unknown names stay empty */
export function renderTemplate(text: string, ctx: { inputs: Record<string, string>; node: (id: string) => { output?: string; value?: string } | undefined; now: number; cap?: number }): string {
  const cap = ctx.cap ?? 12_000;
  return text.replace(/\{\{\s*([a-z]+)(?:\.([A-Za-z0-9_-]+))?(?:\.([a-z]+))?\s*\}\}/g, (_m, a: string, b?: string, c?: string) => {
    if (a === 'input' && b) return ctx.inputs[b] ?? '';
    if (a === 'node' && b) {
      const n = ctx.node(b);
      const v = c === 'value' ? n?.value : n?.output;
      return (v ?? '').slice(0, cap);
    }
    if (a === 'date') {
      // the local date, like {{time}}
      const d = new Date(ctx.now);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (a === 'time') return new Date(ctx.now).toTimeString().slice(0, 5);
    return '';
  });
}

export interface WorkflowTemplate {
  id: string;
  /** in the user's language ('it' or anything else: English); agent nodes have no agent yet: the user picks them */
  build: (lang?: string) => Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'publish',
    build: (lang) => {
      const it = lang === 'it';
      return {
        name: it ? 'Ricerca, bozza, revisione, pubblicazione' : 'Research, draft, review, publish',
        inputs: [{ name: 'topic', label: it ? 'Argomento' : 'Topic', required: true }],
        nodes: [
          { id: 'research', title: it ? 'Ricerca' : 'Research', config: { kind: 'agent', agentId: '', prompt: it ? 'Fai una ricerca su {{input.topic}}: fatti chiave, numeri e fonti, in un brief strutturato.' : 'Research {{input.topic}}: the key facts, numbers and sources, as a structured brief.' } },
          { id: 'draft', title: it ? 'Bozza' : 'Draft', config: { kind: 'agent', agentId: '', prompt: it ? 'Scrivi un articolo su {{input.topic}} a partire da questa ricerca:\n\n{{node.research.output}}' : 'Write an article about {{input.topic}} from this research:\n\n{{node.research.output}}' }, policy: { retries: 1 } },
          { id: 'review', title: it ? 'La tua revisione' : 'Your review', config: { kind: 'approval', prompt: it ? 'Pubblico questa bozza su {{input.topic}}?\n\n{{node.draft.output}}' : 'Publish this draft about {{input.topic}}?\n\n{{node.draft.output}}' } },
          { id: 'publish', title: it ? 'Pubblica' : 'Publish', config: { kind: 'output', name: '{{input.topic}} {{date}}.md', content: '{{node.draft.output}}' } },
        ],
        edges: [
          { from: 'research', to: 'draft' },
          { from: 'draft', to: 'review' },
          { from: 'review', to: 'publish', when: 'approved' },
        ],
        policies: { budgetTokens: 400_000, maxMinutes: 60 },
        templateId: 'publish',
      };
    },
  },
  {
    id: 'weekly',
    build: (lang) => {
      const it = lang === 'it';
      return {
        name: it ? 'Report settimanale' : 'Weekly report',
        inputs: [{ name: 'subject', label: it ? 'Argomento' : 'Subject', default: it ? 'la settimana' : 'the week' }],
        nodes: [
          { id: 'report', title: 'Report', config: { kind: 'agent', agentId: '', prompt: it ? 'Scrivi un breve report su {{input.subject}} per il {{date}}. Chiudi con una riga "ATTENZIONE: sì" oppure "ATTENZIONE: no".' : 'Write a short report on {{input.subject}} for {{date}}. End with a line "ATTENTION: yes" or "ATTENTION: no".' }, policy: { retries: 2, backoffMinutes: 5, timeoutMinutes: 20 } },
          { id: 'check', title: it ? 'Serve attenzione?' : 'Needs attention?', config: { kind: 'condition', test: 'contains', source: '{{node.report.output}}', value: it ? 'ATTENZIONE: sì' : 'ATTENTION: yes' } },
          { id: 'ask', title: it ? 'Dai un\'occhiata' : 'Look at it', config: { kind: 'approval', prompt: it ? 'Il report su {{input.subject}} segnala qualcosa:\n\n{{node.report.output}}' : 'The report on {{input.subject}} needs attention:\n\n{{node.report.output}}' } },
          { id: 'keep', title: it ? 'Salva il report' : 'Keep the report', config: { kind: 'output', name: 'Report {{date}}.md', content: '{{node.report.output}}' } },
        ],
        edges: [
          { from: 'report', to: 'check' },
          { from: 'check', to: 'ask', when: 'true' },
          { from: 'report', to: 'keep' },
        ],
        policies: { budgetTokens: 200_000 },
        templateId: 'weekly',
      };
    },
  },
  {
    id: 'fanout',
    build: (lang) => {
      const it = lang === 'it';
      return {
        name: it ? 'Due punti di vista, una sintesi' : 'Two views, one summary',
        inputs: [{ name: 'question', label: it ? 'Domanda' : 'Question', required: true }],
        nodes: [
          { id: 'split', title: it ? 'Dividi' : 'Split', config: { kind: 'parallel' } },
          { id: 'pro', title: it ? 'Argomenti a favore' : 'Arguments for', config: { kind: 'agent', agentId: '', prompt: it ? 'Dai gli argomenti più forti A FAVORE di: {{input.question}}' : 'Give the strongest arguments FOR: {{input.question}}' } },
          { id: 'con', title: it ? 'Argomenti contro' : 'Arguments against', config: { kind: 'agent', agentId: '', prompt: it ? 'Dai gli argomenti più forti CONTRO: {{input.question}}' : 'Give the strongest arguments AGAINST: {{input.question}}' } },
          { id: 'join', title: it ? 'Entrambi pronti' : 'Both done', config: { kind: 'merge', mode: 'all' } },
          { id: 'summary', title: it ? 'Sintesi' : 'Summary', config: { kind: 'agent', agentId: '', prompt: it ? 'Valuta i due lati di "{{input.question}}" e concludi.\n\nA FAVORE:\n{{node.pro.output}}\n\nCONTRO:\n{{node.con.output}}' : 'Weigh both sides of "{{input.question}}" and conclude.\n\nFOR:\n{{node.pro.output}}\n\nAGAINST:\n{{node.con.output}}' } },
          { id: 'save', title: it ? 'Salva' : 'Save', config: { kind: 'output', name: (it ? 'Due punti di vista' : 'Two views') + ' {{date}}.md', content: '{{node.summary.output}}' } },
        ],
        edges: [
          { from: 'split', to: 'pro' },
          { from: 'split', to: 'con' },
          { from: 'pro', to: 'join' },
          { from: 'con', to: 'join' },
          { from: 'join', to: 'summary' },
          { from: 'summary', to: 'save' },
        ],
        policies: { maxConcurrency: 2 },
        templateId: 'fanout',
      };
    },
  },
];

/** the saved definitions; every save checks the definition and raises its version */
export class WorkflowLibrary {
  private list: WorkflowDefinition[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;

  constructor(
    private storage: StorageAdapter,
    private opts: { refs?: WorkflowRefs; now?: () => number } = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private now = () => (this.opts.now ?? Date.now)();

  async init() {
    const s = await this.storage.get<{ version: 1; workflows: WorkflowDefinition[] }>(KEY);
    this.list = s?.workflows ?? [];
    this.changed(false);
  }
  all(): WorkflowDefinition[] {
    return [...this.list];
  }
  get(id: string): WorkflowDefinition | undefined {
    return this.list.find((w) => w.id === id);
  }
  create(d: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>): WorkflowDefinition {
    const clean = checkDefinition(d, this.opts.refs);
    const t = this.now();
    const w: WorkflowDefinition = { ...clean, id: `wf-${t.toString(36)}-${(++this.counter).toString(36)}`, version: 1, createdAt: t, updatedAt: t };
    this.list.push(w);
    this.changed();
    return w;
  }
  update(id: string, d: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>): WorkflowDefinition {
    const i = this.list.findIndex((w) => w.id === id);
    if (i < 0) throw new WorkflowError('Unknown workflow.');
    const clean = checkDefinition(d, this.opts.refs);
    const w: WorkflowDefinition = { ...clean, id, version: this.list[i].version + 1, createdAt: this.list[i].createdAt, updatedAt: this.now() };
    this.list[i] = w;
    this.changed();
    return w;
  }
  remove(id: string) {
    this.list = this.list.filter((w) => w.id !== id);
    this.changed();
  }
  private changed(save = true) {
    this.version++;
    for (const l of this.listeners) l();
    if (save) void this.storage.set(KEY, { version: 1, workflows: this.list });
  }
}

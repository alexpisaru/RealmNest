// ─────────────────────────────────────────────────────────────
// ResearchService: Deep Research runs (docs/DEEP_RESEARCH.md).
//
//   create ─▶ clarify? ─▶ plan (the user approves or edits it) ─▶ rounds:
//     queries for the open sub-questions ─▶ the connection's own web search ─▶ read pages
//     (Web layer) and Knowledge passages ─▶ evidence with verbatim quotes ─▶ coverage
//   ─▶ write (structured report from the ledger) ─▶ verify (markers, quotes, a model check)
//
// One connection + model plans and writes; a reader model (fast) reads and extracts. Budgets are
// enforced between calls; every step is saved, so a run survives a restart (it resumes) and a
// cancel keeps what was found. Pages and passages are untrusted data throughout.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import {
  isActive,
  RESEARCH_LIMITS,
  RESEARCH_PRESETS,
  REPORT_KINDS,
  type Evidence,
  type ReportKind,
  type ResearchBudget,
  type ResearchEvent,
  type ResearchPlan,
  type ResearchPreset,
  type ResearchRun,
  type ResearchSource,
  type SentenceCheck,
  type SourceType,
  type SubQuestion,
} from '../../domain/research';
import { onFlushAll } from '../../persistence/coalesced';
import type { StorageAdapter } from '../../persistence/storage';
import type { KnowledgeService } from '../knowledge/service';
import type { ProviderService } from '../providers/service';
import type { ProviderEvent } from '../providers/types';
import { providerSearchEngine } from '../web/providerSearch';
import type { WebService } from '../web/service';
import { domainOf, normalizeUrl } from '../web/url';
import { arr, parseJsonObject, str } from './json';
import { CLARIFY_SYSTEM, clarifyUser, PLAN_SYSTEM, planUser, QUERIES_SYSTEM, queriesUser, READER_SYSTEM, readerUser, SELECT_SYSTEM, selectUser, VERIFY_SYSTEM, verifyUser, WRITER_SYSTEM, writerUser } from './prompts';
import { claimContext, cleanReport, lexicalCheck, quoteIn } from './report';

const INDEX_KEY = 'research-index';
/** a run that will not go on by itself or by the user's Resume (only these are pruned) */
const isEnded = (s: ResearchRun['status'] | undefined) => s === undefined || s === 'done' || s === 'failed' || s === 'cancelled';
const runKey = (id: string) => `research-run.${id}`;

export interface ResearchInput {
  question: string;
  connectionId: string;
  model?: string;
  readerModel?: string;
  preset?: ResearchPreset;
  knowledgeBaseIds?: string[];
  web?: boolean;
  /** ask clarifying questions first (users); agents skip it */
  clarify?: boolean;
  /** start the rounds without waiting for the user to approve the plan (agents) */
  autoApprove?: boolean;
  owner?: ResearchRun['owner'];
}

export class ResearchError extends Error {}
class Stop extends Error {}

/** what the service needs to know about a connection */
export interface ConnectionInfo {
  providerId: string;
  name: string;
  /** the connection's own web search exists */
  webSearch: boolean;
  /** it works only with a model chosen (no preferred model set) */
  needsModel?: boolean;
}

export class ResearchService {
  private runs = new Map<string, ResearchRun>();
  private order: string[] = [];
  private controllers = new Map<string, AbortController>();
  /** a cancel that should still write what was found */
  private writeAfterStop = new Set<string>();
  private listeners = new Set<() => void>();
  private version = 0;
  private counter = 0;
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private waiters = new Map<string, ((r: ResearchRun) => void)[]>();
  // delayed saves are written when the window closes (docs/HARDENING.md D-8)
  readonly stopFlush = onFlushAll(() => this.flushSaves());

  constructor(
    private storage: StorageAdapter,
    private bus: EventBus,
    private providers: ProviderService,
    private web: WebService,
    private knowledge: KnowledgeService | undefined,
    private connection: (id: string) => ConnectionInfo | undefined,
    private opts: {
      now?: () => number;
      searchConcurrency?: number;
      readConcurrency?: number;
      /** keeps a page's preview picture (fetch, check, shrink, store); its file reference, or
       *  undefined when it is unusable (an icon, a logo, too small) */
      keepPicture?: (url: string, runId: string) => Promise<{ ref: string; w: number; h: number } | undefined>;
    } = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    for (const fn of this.listeners) fn();
  }
  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  async init() {
    const ids = (await this.storage.get<string[]>(INDEX_KEY)) ?? [];
    for (const id of ids) {
      const r = await this.storage.get<ResearchRun>(runKey(id));
      if (!r) continue;
      // a run that was working when RealmNest closed: it can resume
      if (isActive(r.status)) r.status = 'interrupted';
      this.runs.set(id, r);
      this.order.push(id);
    }
    this.changed();
  }

  list(): ResearchRun[] {
    return this.order.map((id) => this.runs.get(id)!).filter(Boolean);
  }
  get(id: string): ResearchRun | undefined {
    return this.runs.get(id);
  }

  /** the reader model a connection uses by default (a fast one of the same family) */
  defaultReader(connectionId: string, model?: string): string | undefined {
    const p = this.connection(connectionId)?.providerId;
    if (p === 'claude-code' || p === 'anthropic-api') return 'claude-haiku-5-5';
    return model;
  }

  // ── lifecycle ────────────────────────────────────────────
  async create(input: ResearchInput): Promise<ResearchRun> {
    const question = input.question.trim().slice(0, 4000);
    if (!question) throw new ResearchError('Write what you want to research.');
    const info = this.connection(input.connectionId);
    if (!info) throw new ResearchError('Choose an AI connection for the research.');
    if (info.needsModel && !input.model) throw new ResearchError(`Choose a model for ${info.name}.`);
    const preset = input.preset ?? 'standard';
    const t = this.now();
    const id = `rs-${t.toString(36)}-${(++this.counter).toString(36)}`;
    const web = input.web !== false && info.webSearch;
    const run: ResearchRun = {
      id,
      question,
      brief: question,
      owner: input.owner ?? { kind: 'user' },
      connectionId: input.connectionId,
      ...(input.model && { model: input.model }),
      ...((input.readerModel ?? this.defaultReader(input.connectionId, input.model)) && { readerModel: input.readerModel ?? this.defaultReader(input.connectionId, input.model) }),
      preset,
      budget: { ...RESEARCH_PRESETS[preset] },
      knowledgeBaseIds: input.knowledgeBaseIds ?? [],
      web,
      status: input.clarify ? 'clarifying' : 'planning',
      round: 0,
      queries: [],
      sources: [],
      evidence: [],
      usage: { calls: 0, inputTokens: 0, outputTokens: 0 },
      events: [],
      createdAt: t,
      updatedAt: t,
    };
    if (!web && !run.knowledgeBaseIds.length) throw new ResearchError(`${info.name} cannot search the web: choose a connection with web search, or Knowledge bases to research in.`);
    // only ended runs make room: one still open is never dropped (docs/HARDENING.md R-7)
    if (this.order.length >= RESEARCH_LIMITS.runs && !this.order.some((x) => isEnded(this.runs.get(x)?.status)))
      throw new ResearchError(`There are already ${RESEARCH_LIMITS.runs} research runs open: stop or delete one first.`);
    this.runs.set(id, run);
    this.order.unshift(id);
    this.trim();
    if (input.web !== false && !info.webSearch) this.event(run, 'warning', `${info.name} has no web search: only the Knowledge bases are used.`);
    await this.persist(run, true);
    this.bus.emit('research.created', { id, question: question.slice(0, 120) });
    void this.drive(run, input.autoApprove === true);
    return run;
  }

  /** the user's answers to the clarifying questions (empty: skip) */
  async answer(id: string, answers: string[]) {
    const run = this.require(id);
    if (run.status !== 'clarifying') return;
    const qa = (run.clarifyingQuestions ?? []).map((q, i) => (answers[i]?.trim() ? `- ${q} ${answers[i].trim()}` : '')).filter(Boolean);
    if (qa.length) run.brief = `${run.question}\n\nDetails from the user:\n${qa.join('\n')}`.slice(0, 6000);
    run.status = 'planning';
    this.touch(run);
    void this.drive(run, false);
  }

  /** the user accepts the plan (possibly edited) and the rounds start */
  async approve(id: string, plan?: ResearchPlan) {
    const run = this.require(id);
    if (run.status !== 'awaiting_plan') return;
    if (plan) run.plan = this.cleanPlan(plan, run.plan!);
    run.status = 'running';
    run.startedAt = run.startedAt ?? this.now();
    this.touch(run);
    void this.drive(run, true);
  }

  /** stop: rounds end; `write` still writes the report from what was found */
  cancel(id: string, write = false) {
    const run = this.runs.get(id);
    if (!run) return;
    // a plain stop wins over an earlier "write now" still on its way
    if (write && run.evidence.length) this.writeAfterStop.add(id);
    else this.writeAfterStop.delete(id);
    this.controllers.get(id)?.abort();
    if (!this.controllers.has(id) && (run.status === 'awaiting_plan' || run.status === 'clarifying' || run.status === 'interrupted')) {
      run.status = 'cancelled';
      this.event(run, 'cancel', 'Cancelled.');
      this.touch(run);
    }
  }

  /** go on after a restart (or after "write now" was not chosen) */
  resume(id: string) {
    const run = this.require(id);
    if (run.status !== 'interrupted' && run.status !== 'cancelled' && run.status !== 'failed') return;
    run.status = run.plan ? (run.report ? 'writing' : 'running') : 'planning';
    run.error = undefined;
    this.event(run, 'resume', 'Resumed.');
    this.touch(run);
    void this.drive(run, true);
  }

  /** write (or rewrite) the report now from the evidence found so far */
  writeNow(id: string) {
    const run = this.require(id);
    if (this.controllers.has(id)) return this.cancel(id, true);
    if (!run.evidence.length) throw new ResearchError('Nothing was found yet to write about.');
    run.status = 'writing';
    this.touch(run);
    void this.drive(run, true);
  }

  async remove(id: string) {
    this.controllers.get(id)?.abort();
    this.runs.delete(id);
    this.order = this.order.filter((x) => x !== id);
    await this.storage.remove(runKey(id));
    await this.storage.set(INDEX_KEY, this.order);
    this.changed();
  }

  /** resolves when the run reaches done / failed / cancelled */
  whenSettled(id: string): Promise<ResearchRun> {
    const run = this.require(id);
    if (!isActive(run.status) && run.status !== 'awaiting_plan') return Promise.resolve(run);
    return new Promise((resolve) => this.waiters.set(id, [...(this.waiters.get(id) ?? []), resolve]));
  }

  /** the user's choice for one picture place of the report ("hero", "s2"): a source, or none;
   *  `hide`: the source whose picture was there, never placed again */
  setPicture(id: string, slot: string, sourceId: string | null, hide?: string) {
    const run = this.require(id);
    if (!/^(hero|s\d{1,2})$/.test(slot) || (sourceId && !run.sources.some((s) => s.id === sourceId && s.image?.ref))) return;
    run.pictures = { ...run.pictures, [slot]: sourceId };
    if (hide && run.sources.some((s) => s.id === hide)) run.picturesHidden = [...new Set([...(run.picturesHidden ?? []), hide])];
    this.touch(run, true);
  }

  /** the report's pictures back to their default places */
  resetPictures(id: string) {
    const run = this.require(id);
    delete run.pictures;
    delete run.picturesHidden;
    this.touch(run, true);
  }

  /** every kept picture (the file store must not collect them) */
  storageRefs(): Set<string> {
    const out = new Set<string>();
    for (const r of this.runs.values()) for (const s of r.sources ?? []) if (s.image?.ref) out.add(s.image.ref);
    return out;
  }

  markSaved(id: string, to: { kind: 'knowledge' | 'artifact'; id: string }) {
    const run = this.require(id);
    run.savedTo = [...(run.savedTo ?? []), { ...to, at: this.now() }];
    this.touch(run);
  }

  // ── the state machine ───────────────────────────────────
  private async drive(run: ResearchRun, approved: boolean) {
    if (this.controllers.has(run.id)) return;
    const ac = new AbortController();
    this.controllers.set(run.id, ac);
    try {
      if (run.status === 'clarifying') {
        await this.clarify(run, ac.signal);
        if (run.clarifyingQuestions?.length) return; // waits for the user's answers
        run.status = 'planning';
      }
      if (run.status === 'planning') {
        await this.planRun(run, ac.signal);
        run.status = approved ? 'running' : 'awaiting_plan';
        this.touch(run);
        if (!approved) return;
      }
      if (run.status === 'running') {
        run.startedAt = run.startedAt ?? this.now();
        await this.rounds(run, ac.signal);
        run.status = 'writing';
        this.touch(run);
      }
      if (run.status === 'writing') {
        if (!run.evidence.length) throw new ResearchError('No usable evidence was found: try another question, more rounds, or other sources.');
        await this.write(run, ac.signal);
        run.status = 'verifying';
        this.touch(run);
      }
      if (run.status === 'verifying') {
        await this.verify(run, ac.signal);
        run.status = 'done';
        run.finishedAt = this.now();
        this.event(run, 'done', `Done: ${run.sources.filter((s) => !s.irrelevant).length} sources, ${run.evidence.length} pieces of evidence.`);
        this.bus.emit('research.done', { id: run.id });
      }
    } catch (err) {
      if (ac.signal.aborted || err instanceof Stop) {
        if (this.writeAfterStop.delete(run.id) && run.evidence.length && run.plan) {
          // "write now": the rounds stopped, the report is still written (the new drive owns its own controller)
          if (this.controllers.get(run.id) === ac) this.controllers.delete(run.id);
          run.status = 'writing';
          run.stopReason = 'stopped by the user';
          this.touch(run);
          return void this.drive(run, true);
        }
        run.status = 'cancelled';
        this.event(run, 'cancel', 'Cancelled: what was found is kept; Resume or Write now continue from here.');
      } else {
        run.status = 'failed';
        run.error = err instanceof Error ? err.message : String(err);
        this.event(run, 'error', run.error);
      }
    } finally {
      // only its own controller: a drive started after it (write now) keeps its own, so Stop still reaches it
      if (this.controllers.get(run.id) === ac) this.controllers.delete(run.id);
      this.touch(run, true);
      if (!isActive(run.status) && run.status !== 'awaiting_plan') {
        for (const w of this.waiters.get(run.id) ?? []) w(run);
        this.waiters.delete(run.id);
      }
    }
  }

  private async clarify(run: ResearchRun, signal: AbortSignal) {
    this.event(run, 'clarify', 'Checking whether a few details would help.');
    const raw = await this.llm(run, 'planner', CLARIFY_SYSTEM, clarifyUser(run.question), signal, 60_000);
    const q = arr(parseJsonObject(raw)?.questions, 3)
      .map((x) => str(x, 300))
      .filter(Boolean);
    run.clarifyingQuestions = q;
    if (q.length) this.event(run, 'clarify', `${q.length} question${q.length > 1 ? 's' : ''} for you.`);
    this.touch(run);
  }

  private async planRun(run: ResearchRun, signal: AbortSignal) {
    this.event(run, 'plan', 'Planning the research.');
    const raw = await this.llm(run, 'planner', PLAN_SYSTEM(this.now()), planUser(run.brief), signal, 120_000);
    const o = parseJsonObject(raw);
    const subs = arr(o?.subQuestions, 7)
      .map((s, i) => {
        const x = (s ?? {}) as Record<string, unknown>;
        const terms = arr(x.terms, 4)
          .map((t) => str(t, 80))
          .filter(Boolean);
        return { id: `Q${i + 1}`, text: str(x.text ?? s, 300), lookFor: str(x.lookFor, 300), ...(terms.length && { terms }), coverage: 'open' as const };
      })
      .filter((s) => s.text);
    if (!subs.length) throw new ResearchError('The model did not return a plan. Try again or choose another model.');
    const kind = REPORT_KINDS.includes(o?.kind as ReportKind) ? (o!.kind as ReportKind) : 'general';
    run.plan = {
      title: str(o?.title, 160) || run.question.slice(0, 100),
      kind,
      language: /^[a-z]{2}$/i.test(str(o?.language, 5)) ? str(o?.language, 2).toLowerCase() : 'en',
      subQuestions: subs.map((s) => ({ ...s, ...(s.lookFor ? {} : { lookFor: undefined }) })),
    };
    this.event(run, 'plan', `Plan: ${subs.length} sub-questions, a ${kind} report.`);
    this.touch(run);
  }

  private cleanPlan(p: ResearchPlan, prev: ResearchPlan): ResearchPlan {
    const subs = (p.subQuestions ?? [])
      .map((s) => ({
        text: String(s.text ?? '')
          .trim()
          .slice(0, 300),
        lookFor: String(s.lookFor ?? '')
          .trim()
          .slice(0, 300),
      }))
      .filter((s) => s.text)
      .slice(0, 9)
      .map((s, i): SubQuestion => {
        // the search phrases of an unchanged sub-question stay
        const terms = prev.subQuestions.find((q) => q.text === s.text)?.terms;
        return { id: `Q${i + 1}`, text: s.text, ...(s.lookFor && { lookFor: s.lookFor }), ...(terms && { terms }), coverage: 'open' };
      });
    if (!subs.length) throw new ResearchError('The plan needs at least one sub-question.');
    return {
      title:
        String(p.title ?? '')
          .trim()
          .slice(0, 160) || prev.title,
      kind: REPORT_KINDS.includes(p.kind) ? p.kind : prev.kind,
      language: prev.language,
      subQuestions: subs,
    };
  }

  // ── rounds ──────────────────────────────────────────────
  private budgetLeft(run: ResearchRun): string | undefined {
    const b = run.budget;
    const read = run.sources.filter((s) => s.kind === 'web').length;
    if (run.round >= b.rounds) return 'all rounds done';
    if (read >= b.pages) return 'page budget reached';
    if (run.queries.length >= b.searches && !run.knowledgeBaseIds.length) return 'search budget reached';
    if (run.startedAt && this.now() - run.startedAt > b.minutes * 60_000) return 'time budget reached';
    if (run.usage.inputTokens + run.usage.outputTokens > b.tokens) return 'token budget reached';
    return undefined;
  }

  private coverage(run: ResearchRun) {
    for (const q of run.plan!.subQuestions) {
      const srcs = [...new Set(run.evidence.filter((e) => e.subQuestionIds.includes(q.id)).map((e) => e.sourceId))].map((id) => run.sources.find((s) => s.id === id)).filter((s): s is ResearchSource => !!s);
      const primary = srcs.some((s) => s.type === 'primary');
      // two pages of one site are one voice: independent origins count (the site, the document)
      const origins = new Set(srcs.map((s) => (s.kind === 'web' ? (s.domain ?? s.id) : (s.documentId ?? s.id)))).size;
      q.coverage = origins >= 2 || primary ? 'covered' : srcs.length ? 'thin' : 'open';
    }
  }

  private async rounds(run: ResearchRun, signal: AbortSignal) {
    let empty = 0;
    for (;;) {
      if (signal.aborted) throw new Stop();
      this.coverage(run);
      const open = run.plan!.subQuestions.filter((q) => q.coverage !== 'covered');
      if (!open.length) {
        run.stopReason = 'every sub-question is covered';
        break;
      }
      const left = this.budgetLeft(run);
      if (left) {
        run.stopReason = left;
        break;
      }
      run.round++;
      const before = run.evidence.length;
      this.event(run, 'search', `Round ${run.round}: ${open.length} open sub-question${open.length > 1 ? 's' : ''}.`, { round: run.round });
      if (run.knowledgeBaseIds.length) await this.knowledgeRound(run, open, signal);
      if (run.web) await this.webRound(run, open, signal);
      this.coverage(run);
      const covered = run.plan!.subQuestions.filter((q) => q.coverage === 'covered').length;
      this.event(run, 'coverage', `Round ${run.round}: ${run.evidence.length - before} new pieces of evidence; ${covered}/${run.plan!.subQuestions.length} sub-questions covered.`, { round: run.round, covered });
      this.touch(run, true);
      empty = run.evidence.length === before ? empty + 1 : 0;
      if (empty >= 2) {
        run.stopReason = 'two rounds found nothing new';
        break;
      }
    }
    this.event(run, 'coverage', `Rounds stopped: ${run.stopReason}.`);
  }

  private async knowledgeRound(run: ResearchRun, open: SubQuestion[], signal: AbortSignal) {
    if (!this.knowledge) return;
    const passages: { text: string; source: Omit<ResearchSource, 'id'> }[] = [];
    // the sub-questions first, then their search phrases (documents in another language), up to a cap
    const searches = [...open.map((q) => ({ text: q.text, n: 4 })), ...open.flatMap((q) => (q.terms ?? []).slice(0, 4).map((text) => ({ text, n: 2 })))];
    const cap = run.budget.pagesPerRound * 2;
    for (const { text, n } of searches) {
      if (passages.length >= cap) break;
      const r = await this.knowledge.search(run.knowledgeBaseIds, text, n).catch(() => undefined);
      for (const h of r?.hits ?? []) {
        if (passages.length >= cap) break;
        if (run.sources.some((s) => s.chunkId === h.chunk.id) || passages.some((p) => p.source.chunkId === h.chunk.id)) continue;
        passages.push({
          text: h.chunk.text,
          source: { kind: 'knowledge', title: h.documentName, baseId: h.chunk.knowledgeBaseId, documentId: h.chunk.documentId, documentName: h.documentName, chunkId: h.chunk.id, hash: h.chunk.hash, type: 'primary' },
        });
      }
    }
    if (!passages.length) return;
    this.event(run, 'knowledge', `Reading ${passages.length} passage${passages.length > 1 ? 's' : ''} from your Knowledge.`, { round: run.round });
    await pool(passages, this.opts.readConcurrency ?? 3, async (p) => {
      if (signal.aborted) return;
      const src = this.addSource(run, p.source);
      await this.extract(run, src, p.text, signal);
    });
  }

  private async webRound(run: ResearchRun, open: SubQuestion[], signal: AbortSignal) {
    const info = this.connection(run.connectionId);
    const remaining = run.budget.searches - run.queries.length;
    if (remaining <= 0) return;
    // the search budget is spread over the rounds (later rounds may use what earlier ones left)
    const roundsLeft = Math.max(1, run.budget.rounds - run.round + 1);
    const max = Math.min(remaining, open.length * 2, Math.max(2, Math.ceil(remaining / roundsLeft)));
    const raw = await this.llm(
      run,
      'planner',
      QUERIES_SYSTEM(this.now()),
      queriesUser(
        run.brief,
        open,
        run.queries.map((q) => q.text),
        max,
        run.round,
      ),
      signal,
      90_000,
    );
    const used = new Set(run.queries.map((q) => q.text.toLowerCase()));
    const queries = arr(parseJsonObject(raw)?.queries, max)
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return { text: str(o.query ?? x, 200), subQuestionId: str(o.subQuestion, 4).toUpperCase() };
      })
      .filter((q) => q.text && !used.has(q.text.toLowerCase()));
    if (!queries.length) {
      this.event(run, 'warning', 'No new queries this round.');
      return;
    }
    const engine = providerSearchEngine({ providers: this.providers, connectionId: run.connectionId, ...((run.readerModel ?? run.model) && { model: run.readerModel ?? run.model }), name: `${info?.name ?? 'AI'} · web search`, runTag: run.id });
    const found: { q: (typeof queries)[number]; urls: { url: string; title: string; snippet?: string }[] }[] = [];
    // ChatGPT (Codex) searches one at a time: bursts of Codex searches stall for minutes
    await pool(queries, info?.providerId === 'codex' ? 1 : (this.opts.searchConcurrency ?? 2), async (q) => {
      if (signal.aborted) return;
      this.event(run, 'search', `Searching: ${q.text}`, { round: run.round, query: q.text });
      try {
        const r = await this.web.searchWith(engine, q.text, { count: 8 }, run.id, signal);
        run.queries.push({ round: run.round, text: q.text, ...(q.subQuestionId && { subQuestionId: q.subQuestionId }), results: r.results.length });
        found.push({ q, urls: r.results.map((x) => ({ url: x.url, title: x.title, ...(x.snippet && { snippet: x.snippet }) })) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        run.queries.push({ round: run.round, text: q.text, results: 0, error: msg.slice(0, 200) });
        this.event(run, 'warning', `Search failed: ${msg.slice(0, 160)}`);
      }
      this.touch(run);
    });
    if (signal.aborted) throw new Stop();
    // pages: the candidates (new, normalized), then the reader picks the most promising ones
    const readSoFar = run.sources.filter((s) => s.kind === 'web').length;
    const cap = Math.min(run.budget.pagesPerRound, run.budget.pages - readSoFar);
    const seen = new Set(run.sources.map((s) => normalizeUrl(s.finalUrl ?? s.url ?? '') ?? ''));
    const candidates: { n: number; url: string; title: string; snippet?: string; query: string }[] = [];
    for (const f of found)
      for (const u of f.urls) {
        const n = normalizeUrl(u.url);
        if (!n || seen.has(n) || candidates.some((c) => c.url === n)) continue;
        candidates.push({ n: candidates.length + 1, url: n, title: u.title, ...(u.snippet && { snippet: u.snippet }), query: f.q.text });
      }
    const picks = await this.select(run, open, candidates, cap, signal);
    if (!picks.length) return;
    this.event(run, 'read', `Reading ${picks.length} page${picks.length > 1 ? 's' : ''}.`, { round: run.round });
    await pool(picks, this.opts.readConcurrency ?? 3, async (p) => {
      if (signal.aborted) return;
      let page;
      try {
        page = (await this.web.fetchPage(p.url, { runId: run.id })).page;
      } catch (e) {
        this.event(run, 'warning', `Not read: ${domainOf(p.url)} (${e instanceof Error ? e.message.slice(0, 100) : 'error'})`, { url: p.url });
        return;
      }
      const src = this.addSource(run, {
        kind: 'web',
        title: page.title ?? p.title,
        url: p.url,
        finalUrl: page.finalUrl,
        domain: page.domain,
        ...(page.publishedAt && { publishedAt: page.publishedAt }),
        fetchedAt: page.fetchedAt,
        method: page.method,
        query: p.query,
        engine: engine.name,
        hash: page.hash,
        type: 'unknown',
      });
      this.event(run, 'read', `Read ${page.domain}: ${(page.title ?? '').slice(0, 80)}`, { url: page.finalUrl, source: src.id });
      await this.extract(run, src, page.text, signal);
      if (page.image && !src.irrelevant) await this.picture(run, src, page.image, signal);
    });
  }

  /** which results to read: the reader model chooses (primary sources first); a fair share per query when it cannot */
  private async select(run: ResearchRun, open: SubQuestion[], candidates: { n: number; url: string; title: string; snippet?: string; query: string }[], cap: number, signal: AbortSignal) {
    if (cap <= 0 || !candidates.length) return [];
    if (candidates.length > cap) {
      try {
        const raw = await this.llm(run, 'reader', SELECT_SYSTEM, selectUser(run.brief, open, candidates.slice(0, 60), cap), signal, 90_000);
        const chosen = arr(parseJsonObject(raw)?.read, cap)
          .map((x) => candidates.find((c) => c.n === Number(x)))
          .filter((c): c is (typeof candidates)[number] => !!c);
        const unique = chosen.filter((c, i) => chosen.indexOf(c) === i);
        if (unique.length) {
          this.event(run, 'read', `Chose ${unique.length} of ${candidates.length} results to read.`, { round: run.round });
          return unique;
        }
      } catch (e) {
        if (signal.aborted || e instanceof Stop) throw e;
      }
    }
    // fallback: round-robin over the queries, new domains first
    const domains = new Map<string, number>();
    for (const s of run.sources) if (s.domain) domains.set(s.domain, (domains.get(s.domain) ?? 0) + 1);
    const byQuery = new Map<string, typeof candidates>();
    for (const c of candidates) byQuery.set(c.query, [...(byQuery.get(c.query) ?? []), c]);
    const picks: typeof candidates = [];
    while (picks.length < cap && [...byQuery.values()].some((l) => l.length))
      for (const list of byQuery.values()) {
        if (picks.length >= cap || !list.length) continue;
        list.sort((a, b) => (domains.get(domainOf(a.url)) ?? 0) - (domains.get(domainOf(b.url)) ?? 0));
        const c = list.shift()!;
        domains.set(domainOf(c.url), (domains.get(domainOf(c.url)) ?? 0) + 1);
        picks.push(c);
      }
    return picks;
  }

  /** a relevant page's preview picture, kept for the report (a failure only means no picture) */
  private async picture(run: ResearchRun, src: ResearchSource, url: string, signal: AbortSignal) {
    if (!this.opts.keepPicture || signal.aborted) return;
    if (run.sources.filter((s) => s.image?.ref).length >= RESEARCH_LIMITS.pictures) return;
    src.image = { url };
    try {
      const kept = await this.opts.keepPicture(url, run.id);
      if (kept) src.image = { url, ...kept };
    } catch {
      /* no picture */
    }
    this.touch(run);
  }

  private addSource(run: ResearchRun, s: Omit<ResearchSource, 'id'>): ResearchSource {
    const n = run.sources.filter((x) => x.kind === s.kind).length + 1;
    const src: ResearchSource = { ...s, id: `${s.kind === 'web' ? 'W' : 'K'}${n}` };
    run.sources.push(src);
    return src;
  }

  /** the reader extracts evidence; only quotes really in the text are kept */
  private async extract(run: ResearchRun, src: ResearchSource, text: string, signal: AbortSignal) {
    const body = text.slice(0, RESEARCH_LIMITS.pageChars);
    let raw: string;
    try {
      raw = await this.llm(
        run,
        'reader',
        READER_SYSTEM,
        readerUser(run.brief, run.plan!.subQuestions, { ...(src.title && { title: src.title }), ...((src.finalUrl ?? src.url) && { url: src.finalUrl ?? src.url }), text: body }),
        signal,
        120_000,
      );
    } catch (e) {
      if (signal.aborted || e instanceof Stop) throw e;
      this.event(run, 'warning', `Could not read ${src.id}: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`);
      return;
    }
    const o = parseJsonObject(raw);
    const type = str(o?.type, 12);
    if (src.kind === 'web') src.type = (['primary', 'secondary', 'opinion'].includes(type) ? type : 'unknown') as SourceType;
    const pub = str(o?.published, 10);
    if (!src.publishedAt && /^\d{4}(-\d{2}){0,2}$/.test(pub)) src.publishedAt = pub;
    const ids = new Set(run.plan!.subQuestions.map((q) => q.id));
    let kept = 0;
    let dropped = 0;
    for (const e of arr(o?.evidence, RESEARCH_LIMITS.evidencePerSource)) {
      const x = (e ?? {}) as Record<string, unknown>;
      const quote = str(x.quote, RESEARCH_LIMITS.quoteChars);
      const claim = str(x.claim, RESEARCH_LIMITS.claimChars);
      const subs = arr(x.subQuestions, 7)
        .map((s) => str(s, 4).toUpperCase())
        .filter((s) => ids.has(s));
      if (!quote || !claim || !subs.length) continue;
      // the anti-hallucination rule: the quote must be in what was read
      if (!quoteIn(quote, body)) {
        dropped++;
        continue;
      }
      // numbers the claim states but the quote lacks: the page around them, verbatim
      const context = claimContext(claim, quote, body);
      const ev: Evidence = { id: `E${run.evidence.length + 1}`, sourceId: src.id, subQuestionIds: subs, claim, quote, ...(context && { context }) };
      run.evidence.push(ev);
      kept++;
    }
    if (!kept) src.irrelevant = true;
    this.event(run, 'extract', `${src.id}: ${kept} piece${kept === 1 ? '' : 's'} of evidence${dropped ? ` (${dropped} quote${dropped > 1 ? 's' : ''} not found in the text, dropped)` : ''}.`, { source: src.id });
    this.touch(run);
  }

  // ── writing and checking ────────────────────────────────
  private async write(run: ResearchRun, signal: AbortSignal) {
    this.coverage(run);
    this.event(run, 'write', 'Writing the report from the evidence.');
    // the evidence the writer sees: every sub-question gets its share
    const per = Math.max(4, Math.floor(RESEARCH_LIMITS.writerEvidence / run.plan!.subQuestions.length));
    const chosen: Evidence[] = [];
    for (const q of run.plan!.subQuestions) for (const e of run.evidence.filter((x) => x.subQuestionIds[0] === q.id).slice(0, per)) chosen.push(e);
    for (const e of run.evidence) if (chosen.length < RESEARCH_LIMITS.writerEvidence && !chosen.includes(e)) chosen.push(e);
    const raw = await this.llm(run, 'writer', WRITER_SYSTEM(this.now(), run.plan!.kind, run.plan!.language), writerUser(run.brief, run.plan!, run.sources, chosen), signal, 600_000, true);
    const report = cleanReport(parseJsonObject(raw), run.plan!.title, new Set(run.sources.map((s) => s.id)));
    if (!report) throw new ResearchError('The model did not return a usable report. Write now tries again; another model may do better.');
    run.report = report;
    this.touch(run, true);
  }

  private async verify(run: ResearchRun, signal: AbortSignal) {
    this.event(run, 'verify', 'Checking every citation against the quotes.');
    const lex = lexicalCheck(run.report!, run.sources, run.evidence);
    const checks: SentenceCheck[] = [...lex.checks];
    const items = lex.toJudge.slice(0, 100).map((x, i) => ({ n: i + 1, ...x }));
    const batches: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25));
    let failed = 0;
    // checking always runs, whatever the token budget (it is part of writing the report)
    await pool(batches, 2, async (batch) => {
      try {
        const raw = await this.llm(run, 'reader', VERIFY_SYSTEM, verifyUser(batch), signal, 180_000, true);
        for (const r of arr(parseJsonObject(raw)?.results, 40)) {
          const o = (r ?? {}) as Record<string, unknown>;
          const item = items.find((i) => i.n === Number(o.n));
          const status = str(o.status, 12);
          if (!item) continue;
          // the model read the quotes and found the sentence supported: a lexical mismatch was a matter of form
          if (status === 'supported') {
            const i = checks.findIndex((c) => c.sentence === item.sentence && c.status === 'partial');
            if (i >= 0) checks.splice(i, 1);
            continue;
          }
          if (status !== 'partial' && status !== 'unsupported') continue;
          // keep the lexical note when both flagged it
          if (!checks.some((c) => c.sentence === item.sentence)) checks.push({ where: item.where, sentence: item.sentence, status, ...(str(o.note, 200) && { note: str(o.note, 200) }) });
          else if (status === 'unsupported') checks.find((c) => c.sentence === item.sentence)!.status = 'unsupported';
        }
      } catch (e) {
        if (signal.aborted || e instanceof Stop) throw e;
        failed++;
      }
    });
    if (signal.aborted) throw new Stop();
    if (failed) this.event(run, 'warning', `The model check of ${failed === batches.length ? 'the' : 'some'} citations did not run; the lexical check stands.`);
    if (lex.toJudge.length > items.length) this.event(run, 'warning', `${lex.toJudge.length - items.length} cited sentences were checked lexically only.`);
    run.verification = { lexical: lex.report, checks, invalidMarkers: lex.invalidMarkers };
    const bad = checks.filter((c) => c.status !== 'supported').length;
    this.event(run, 'verify', bad ? `${bad} sentence${bad > 1 ? 's' : ''} flagged in the report.` : 'Every checked citation is supported by its quotes.');
  }

  // ── model calls ─────────────────────────────────────────
  /** one stateless turn on the run's connection; usage counted; the token budget guards non-writing calls */
  private async llm(run: ResearchRun, role: 'planner' | 'reader' | 'writer', system: string, user: string, signal: AbortSignal, timeoutMs: number, writing = false): Promise<string> {
    if (signal.aborted) throw new Stop();
    if (!writing && run.usage.inputTokens + run.usage.outputTokens > run.budget.tokens * 1.1) throw new Stop();
    const model = role === 'reader' ? (run.readerModel ?? run.model) : run.model;
    let usage = { input: 0, output: 0, cost: undefined as number | undefined };
    // the run's id in every call: usage is counted for this research (and its agent)
    const p = this.providers.run(run.connectionId, { runId: `${run.id}~${++this.counter}`, ...(model && { model }), systemPrompt: system, messages: [{ role: 'user', content: user }], timeoutMs }, (e: ProviderEvent) => {
      // new prompt text written to a cache is input too (Claude reports the page text there); cache reads are the repeated prefix
      if (e.type === 'usage.updated' && e.cumulative) usage = { input: e.usage.inputTokens + (e.usage.cacheWriteTokens ?? 0), output: e.usage.outputTokens, cost: e.costUsd };
    });
    const stop = () => void p.cancel();
    signal.addEventListener('abort', stop, { once: true });
    let end: ProviderEvent;
    try {
      end = await p.done;
    } finally {
      signal.removeEventListener('abort', stop);
    }
    run.usage.calls++;
    run.usage.inputTokens += usage.input;
    run.usage.outputTokens += usage.output;
    if (usage.cost !== undefined) run.usage.costUsd = (run.usage.costUsd ?? 0) + usage.cost;
    if (signal.aborted) throw new Stop();
    if (end.type === 'run.failed') throw new ResearchError(end.error.message);
    if (end.type !== 'run.completed') throw new Stop();
    return end.text;
  }

  // ── bookkeeping ─────────────────────────────────────────
  private event(run: ResearchRun, phase: ResearchEvent['phase'], message: string, data?: ResearchEvent['data']) {
    run.events.push({ at: this.now(), phase, message: message.slice(0, 400), ...(data && { data }) });
    if (run.events.length > RESEARCH_LIMITS.events) run.events.splice(0, run.events.length - RESEARCH_LIMITS.events);
    this.bus.emit('research.event', { id: run.id, phase, message: message.slice(0, 160), ...(run.owner.kind === 'agent' && { agentId: run.owner.agentId }) }, { log: phase !== 'read' && phase !== 'extract' });
    this.touch(run);
  }

  private touch(run: ResearchRun, now = false) {
    run.updatedAt = this.now();
    this.changed();
    void this.persist(run, now);
  }

  private async persist(run: ResearchRun, now = false) {
    clearTimeout(this.saveTimers.get(run.id));
    const save = async () => {
      this.saveTimers.delete(run.id);
      if (!this.runs.has(run.id)) return;
      await this.storage.set(runKey(run.id), run);
      await this.storage.set(INDEX_KEY, this.order);
    };
    if (now) return save();
    this.saveTimers.set(
      run.id,
      setTimeout(() => void save(), 400),
    );
  }

  /** write every delayed save now */
  async flushSaves() {
    for (const id of [...this.saveTimers.keys()]) {
      const r = this.runs.get(id);
      if (r) await this.persist(r, true);
    }
  }

  /** the oldest ended runs go; open ones (working, waiting, interrupted) stay */
  private trim() {
    for (let i = this.order.length - 1; i >= 0 && this.order.length > RESEARCH_LIMITS.runs; i--) {
      const id = this.order[i];
      if (!isEnded(this.runs.get(id)?.status)) continue;
      this.order.splice(i, 1);
      this.runs.delete(id);
      void this.storage.remove(runKey(id));
    }
  }

  private require(id: string): ResearchRun {
    const r = this.runs.get(id);
    if (!r) throw new ResearchError('Unknown research.');
    return r;
  }

  /** a budget override for this run (before or during the rounds) */
  setBudget(id: string, b: Partial<ResearchBudget>) {
    const run = this.require(id);
    run.budget = { ...run.budget, ...b };
    this.touch(run);
  }
}

/** run fn over items with at most n at a time */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const x = items[i++];
      await fn(x);
    }
  });
  await Promise.all(workers);
}

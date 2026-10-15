// Usage: what the AI connections consumed, recorded locally from the provider events every turn
// already emits (no extra calls): tokens and, when the provider says it, cost — per day, per
// connection, per agent, per chat. Subscription limits (Claude's 5-hour session and week) are kept
// as last reported. Nothing here leaves the computer; nothing is estimated from price lists.

import type { EventBus } from '../../core/events';
import type { StorageAdapter } from '../../persistence/storage';
import type { PlanLimits, ProviderEvent, TokenUsage } from '../providers/types';

const KEY = 'usage-ledger';
const KEEP_DAYS = 120;
const KEEP_CHATS = 400;

/** who a provider turn worked for */
export type UsageOwner = { kind: 'chat'; conversationId: string; agentId?: string } | { kind: 'agent'; agentId: string } | { kind: 'research'; researchId: string; agentId?: string } | { kind: 'other' };

export interface UsageTotals {
  /** prompt tokens (new input, and new text written to a prompt cache) */
  input: number;
  output: number;
  /** prompt tokens read back from a cache (cheap, repeated context) */
  cacheRead: number;
  /** what the provider reported (undefined: it reports no cost) */
  cost?: number;
  turns: number;
}

interface Row extends UsageTotals {
  day: string;
  connectionId: string;
  kind: UsageOwner['kind'];
  agentId?: string;
}

export interface KnownLimits extends PlanLimits {
  at: number;
}

interface Saved {
  version: 1;
  rows: Row[];
  chats: Record<string, UsageTotals & { at: number }>;
  limits: Record<string, KnownLimits>;
  /** a spending budget per connection, US dollars a month (the ring's scale where there is no plan) */
  budgets: Record<string, number>;
}

const empty = (): UsageTotals => ({ input: 0, output: 0, cacheRead: 0, turns: 0 });
const add = (into: UsageTotals, u: TokenUsage, cost: number | undefined) => {
  into.input += u.inputTokens + (u.cacheWriteTokens ?? 0);
  into.output += u.outputTokens;
  into.cacheRead += u.cacheReadTokens ?? 0;
  if (cost !== undefined && Number.isFinite(cost)) into.cost = (into.cost ?? 0) + cost;
  into.turns++;
};
const merge = (a: UsageTotals, b: UsageTotals): UsageTotals => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  ...((a.cost !== undefined || b.cost !== undefined) && { cost: (a.cost ?? 0) + (b.cost ?? 0) }),
  turns: a.turns + b.turns,
});

export class UsageService {
  private data: Saved = { version: 1, rows: [], chats: {}, limits: {}, budgets: {} };
  /** per provider turn: the last cumulative usage seen before the terminal event */
  private pending = new Map<string, { usage?: TokenUsage; cost?: number }>();
  private listeners = new Set<() => void>();
  private version = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private storage: StorageAdapter,
    private bus: EventBus,
    private owner: (runId: string) => UsageOwner,
    private opts: { now?: () => number } = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private now = () => (this.opts.now ?? Date.now)();
  private day = (t = this.now()) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  async init() {
    const s = await this.storage.get<Saved>(KEY);
    if (s && s.version === 1) this.data = { version: 1, rows: s.rows ?? [], chats: s.chats ?? {}, limits: s.limits ?? {}, budgets: s.budgets ?? {} };
    this.bus.on('provider.event', (e) => this.onEvent(e as ProviderEvent & { connectionId?: string }));
    this.changed(false);
  }

  private onEvent(e: ProviderEvent & { connectionId?: string }) {
    const connectionId = e.connectionId;
    if (!connectionId) return;
    if (e.type === 'limits.updated') {
      this.data.limits[connectionId] = { ...e.limits, at: this.now() };
      return this.changed();
    }
    const key = `${connectionId}|${e.runId}`;
    if (e.type === 'usage.updated' && e.cumulative) {
      this.pending.set(key, { usage: e.usage, ...(e.costUsd !== undefined && { cost: e.costUsd }) });
      return;
    }
    if (e.type !== 'run.completed' && e.type !== 'run.failed' && e.type !== 'run.cancelled') return;
    const p = this.pending.get(key);
    this.pending.delete(key);
    const usage = (e.type === 'run.completed' && e.usage) || p?.usage;
    if (!usage) return;
    const cost = (e.type === 'run.completed' ? e.costUsd : undefined) ?? p?.cost;
    this.record(connectionId, this.owner(e.runId), usage, cost);
  }

  /** one provider turn's consumption */
  record(connectionId: string, owner: UsageOwner, usage: TokenUsage, cost?: number) {
    const day = this.day();
    const agentId = owner.kind === 'agent' ? owner.agentId : owner.kind === 'chat' || owner.kind === 'research' ? owner.agentId : undefined;
    let row = this.data.rows.find((r) => r.day === day && r.connectionId === connectionId && r.kind === owner.kind && r.agentId === agentId);
    if (!row) {
      row = { day, connectionId, kind: owner.kind, ...(agentId && { agentId }), ...empty() };
      this.data.rows.push(row);
    }
    add(row, usage, cost);
    if (owner.kind === 'chat') {
      const c = (this.data.chats[owner.conversationId] ??= { ...empty(), at: 0 });
      add(c, usage, cost);
      c.at = this.now();
    }
    this.changed();
  }

  // ── reading ───────────────────────────────────────────
  /** totals over the last `days` days (1 = today), for a connection and/or an agent */
  totals(o: { connectionId?: string; agentId?: string; days: number }): UsageTotals {
    const from = this.day(this.now() - (o.days - 1) * 86_400_000);
    return this.data.rows.filter((r) => r.day >= from && (!o.connectionId || r.connectionId === o.connectionId) && (!o.agentId || r.agentId === o.agentId)).reduce(merge, empty());
  }
  /** this calendar month */
  month(connectionId: string): UsageTotals {
    const m = this.day().slice(0, 7);
    return this.data.rows.filter((r) => r.connectionId === connectionId && r.day.startsWith(m)).reduce(merge, empty());
  }
  /** per agent over the last `days` days, most used first */
  byAgent(o: { connectionId?: string; days: number }): { agentId: string; totals: UsageTotals }[] {
    const from = this.day(this.now() - (o.days - 1) * 86_400_000);
    const m = new Map<string, UsageTotals>();
    for (const r of this.data.rows) if (r.agentId && r.day >= from && (!o.connectionId || r.connectionId === o.connectionId)) m.set(r.agentId, merge(m.get(r.agentId) ?? empty(), r));
    return [...m.entries()].map(([agentId, totals]) => ({ agentId, totals })).sort((a, b) => b.totals.input + b.totals.output - (a.totals.input + a.totals.output));
  }
  /** one conversation, all time */
  chat(conversationId: string): UsageTotals {
    return this.data.chats[conversationId] ?? empty();
  }
  /** the plan limits last reported for a connection */
  limits(connectionId: string): KnownLimits | undefined {
    return this.data.limits[connectionId];
  }
  budget(connectionId: string): number | undefined {
    return this.data.budgets[connectionId];
  }
  setBudget(connectionId: string, usd: number | undefined) {
    if (usd === undefined || !Number.isFinite(usd) || usd <= 0) delete this.data.budgets[connectionId];
    else this.data.budgets[connectionId] = Math.round(usd * 100) / 100;
    this.changed();
  }
  /** forget a connection's records (when the connection is removed) */
  forget(connectionId: string) {
    this.data.rows = this.data.rows.filter((r) => r.connectionId !== connectionId);
    delete this.data.limits[connectionId];
    delete this.data.budgets[connectionId];
    this.changed();
  }

  private changed(save = true) {
    this.version++;
    for (const l of this.listeners) l();
    if (!save) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 400);
  }

  async persist() {
    const from = this.day(this.now() - KEEP_DAYS * 86_400_000);
    this.data.rows = this.data.rows.filter((r) => r.day >= from);
    const chats = Object.entries(this.data.chats).sort((a, b) => b[1].at - a[1].at);
    if (chats.length > KEEP_CHATS) this.data.chats = Object.fromEntries(chats.slice(0, KEEP_CHATS));
    await this.storage.set(KEY, this.data);
  }
}

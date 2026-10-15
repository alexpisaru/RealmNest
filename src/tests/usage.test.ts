import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { MemoryAdapter } from '../persistence/storage';
import { ClaudeStreamParser } from '../runtime/providers/claude-code/parser';
import type { ProviderEvent, ProviderEventBody } from '../runtime/providers/types';
import { UsageService, type UsageOwner } from '../runtime/usage/service';

// Usage: every provider turn's tokens and cost are recorded from the events the turn already
// emits, attributed to its chat, agent or research; plan limits are kept as last reported.

const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).getTime();

function rig(owners: Record<string, UsageOwner> = {}, storage = new MemoryAdapter()) {
  const bus = new EventBus(500);
  let now = at(14);
  const usage = new UsageService(storage, bus, (runId) => owners[runId.split('~')[0]] ?? { kind: 'other' }, { now: () => now });
  let seq = 0;
  const emit = (connectionId: string, runId: string, body: ProviderEventBody) => bus.emit('provider.event', { ...body, runId, providerId: 'p', seq: ++seq, at: now, connectionId } as ProviderEvent);
  return { usage, bus, emit, storage, setNow: (t: number) => (now = t) };
}

describe('usage ledger', () => {
  it('counts a turn once, from its last cumulative usage or its completion, by chat and agent', async () => {
    const { usage, emit } = rig({ r1: { kind: 'chat', conversationId: 'c1' }, r2: { kind: 'agent', agentId: 'hana' }, rs: { kind: 'research', researchId: 'rs', agentId: 'hana' } });
    await usage.init();
    // a chat turn: cumulative usage, then a completion without usage
    emit('claude', 'r1', { type: 'usage.updated', usage: { inputTokens: 10, outputTokens: 5 }, cumulative: false });
    emit('claude', 'r1', { type: 'usage.updated', usage: { inputTokens: 100, outputTokens: 50, cacheWriteTokens: 20, cacheReadTokens: 900 }, cumulative: true, costUsd: 0.01 });
    emit('claude', 'r1', { type: 'run.completed', text: 'ok' });
    // an agent's task, usage on the completion
    emit('claude', 'r2', { type: 'run.completed', text: 'ok', usage: { inputTokens: 1000, outputTokens: 200 }, costUsd: 0.05 });
    // a research call made for the same agent (run ids carry the research id)
    emit('claude', 'rs~3', { type: 'run.completed', text: 'ok', usage: { inputTokens: 300, outputTokens: 100 } });
    // another connection; a failed turn with no usage counts nothing
    emit('or', 'r9', { type: 'run.completed', text: 'ok', usage: { inputTokens: 7, outputTokens: 3 }, costUsd: 0.002 });
    emit('or', 'r8', { type: 'run.failed', error: { code: 'unknown', message: 'x' } });

    expect(usage.chat('c1')).toMatchObject({ input: 120, output: 50, cacheRead: 900, turns: 1 });
    expect(usage.chat('c1').cost).toBeCloseTo(0.01);
    const claude = usage.totals({ connectionId: 'claude', days: 1 });
    expect([claude.input, claude.output, claude.turns]).toEqual([1420, 350, 3]);
    expect(claude.cost).toBeCloseTo(0.06);
    expect(usage.totals({ agentId: 'hana', days: 30 })).toMatchObject({ input: 1300, output: 300, turns: 2 });
    expect(usage.byAgent({ connectionId: 'claude', days: 30 }).map((a) => a.agentId)).toEqual(['hana']);
    expect(usage.totals({ connectionId: 'or', days: 1 })).toMatchObject({ input: 7, output: 3, turns: 1 });
  });

  it('days, month, budget and the plan limits; everything survives a restart', async () => {
    const storage = new MemoryAdapter();
    const a = rig({}, storage);
    await a.usage.init();
    a.setNow(at(1));
    a.emit('or', 'x1', { type: 'run.completed', text: '', usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 1 });
    a.setNow(at(10));
    a.emit('or', 'x2', { type: 'run.completed', text: '', usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 2 });
    a.setNow(at(14));
    a.emit('or', 'x3', { type: 'run.completed', text: '', usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 4 });
    a.emit('claude', 'x4', { type: 'limits.updated', limits: { windows: [{ id: 'five_hour', utilization: 0.42, resetsAt: at(14, 23) }] } });
    expect(a.usage.totals({ connectionId: 'or', days: 1 }).cost).toBe(4);
    expect(a.usage.totals({ connectionId: 'or', days: 7 }).cost).toBe(6);
    expect(a.usage.month('or').cost).toBe(7);
    a.usage.setBudget('or', 25);
    a.usage.setBudget('claude', -3);
    expect([a.usage.budget('or'), a.usage.budget('claude')]).toEqual([25, undefined]);
    expect(a.usage.limits('claude')).toMatchObject({ windows: [{ id: 'five_hour', utilization: 0.42 }], at: at(14) });
    await a.usage.persist();

    const b = rig({}, storage);
    await b.usage.init();
    expect(b.usage.month('or').cost).toBe(7);
    expect(b.usage.budget('or')).toBe(25);
    expect(b.usage.limits('claude')?.windows[0].utilization).toBe(0.42);
    b.usage.forget('or');
    expect(b.usage.totals({ connectionId: 'or', days: 30 }).turns).toBe(0);
  });
});

describe("Claude's plan limits", () => {
  it('rate_limit_event becomes limits.updated (the 5-hour session and the week, reset times in ms)', () => {
    const p = new ClaudeStreamParser({});
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'allowed', resetsAt: 1792011600, rateLimitType: 'five_hour', unifiedWindows: { five_hour: { utilization: 0.04, resetsAt: 1792011600 }, seven_day: { utilization: 0.31, resetsAt: 1792076400 }, odd: { utilization: 'x' } } },
    });
    const events = p.push(line).map((e) => e.body);
    expect(events).toEqual([
      {
        type: 'limits.updated',
        limits: {
          windows: [
            { id: 'five_hour', utilization: 0.04, resetsAt: 1792011600_000 },
            { id: 'seven_day', utilization: 0.31, resetsAt: 1792076400_000 },
          ],
          status: 'allowed',
        },
      },
    ]);
    // nothing usable: no event
    expect(p.push(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {} })).map((e) => e.body)).toEqual([]);
  });
});

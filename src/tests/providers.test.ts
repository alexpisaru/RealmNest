import { describe, expect, it } from 'vitest';
import { AsyncQueue } from '../core/asyncQueue';
import { EventBus } from '../core/events';
import { LineBuffer, redact } from '../runtime/process/text';
import { UnavailableProcessRunner } from '../runtime/process/types';
import { ClaudeCodeProvider } from '../runtime/providers/claude-code/provider';
import { acceptedEffort, defaultEffort, modelEfforts } from '../runtime/providers/effort';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderEventBody, ProviderTurnRequest } from '../runtime/providers/types';

const CAPS: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: true, usage: false, cost: false, cancellation: true, modelListing: false, systemPrompt: false };

/** a provider that replays fixed events (tests the contract, not a backend) */
class ScriptedProvider implements AIProvider {
  readonly name = 'Scripted';
  readonly capabilities = CAPS;
  constructor(
    readonly id: string,
    private bodies: ProviderEventBody[],
    private opts: { throwAfter?: number; hangUntilAbort?: boolean } = {},
  ) {}
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    let seq = 0;
    for (const b of this.bodies) {
      if (this.opts.throwAfter !== undefined && seq >= this.opts.throwAfter) throw new Error('adapter bug');
      yield { ...b, runId: req.runId, providerId: this.id, seq: ++seq, at: 0 } as ProviderEvent;
    }
    if (this.opts.hangUntilAbort) {
      if (!req.abortSignal?.aborted) await new Promise<void>((r) => req.abortSignal?.addEventListener('abort', () => r()));
      yield { type: 'run.cancelled', reason: 'Cancelled.', runId: req.runId, providerId: this.id, seq: ++seq, at: 0 };
    }
  }
}

describe('ProviderRegistry', () => {
  it('registers, looks up and lists providers in order', () => {
    const r = new ProviderRegistry();
    const a = new ScriptedProvider('a', []);
    const b = new ScriptedProvider('b', []);
    r.register(a).register(b);
    expect(r.get('a')).toBe(a);
    expect(r.has('b')).toBe(true);
    expect(r.get('zzz')).toBeUndefined();
    expect(r.list().map((p) => p.id)).toEqual(['a', 'b']);
    expect(() => r.require('zzz')).toThrow(/Unknown provider/);
  });

  it('refuses duplicate ids', () => {
    const r = new ProviderRegistry().register(new ScriptedProvider('a', []));
    expect(() => r.register(new ScriptedProvider('a', []))).toThrow(/already registered/);
    expect(r.unregister('a')).toBe(true);
    expect(r.list()).toHaveLength(0);
  });

  it('holds the Claude Code adapter behind the generic contract', () => {
    const r = new ProviderRegistry().register(new ClaudeCodeProvider(new UnavailableProcessRunner()));
    const p = r.require('claude-code');
    expect(p.name).toBe('Claude');
    // every required flag is declared (optional ones such as `files` may be added)
    expect(Object.keys(p.capabilities)).toEqual(expect.arrayContaining(Object.keys(CAPS)));
  });
});

describe('ProviderService', () => {
  const turn: ProviderEventBody[] = [
    { type: 'provider.started' },
    { type: 'text.delta', messageId: 'm', index: 0, text: 'hi' },
    { type: 'text.delta', messageId: 'm', index: 0, text: '!' },
    { type: 'run.completed', text: 'hi!' },
  ];

  it('publishes normalized events on the bus, keeping text deltas out of the log', async () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on('provider.event', (e) => seen.push(e.type));
    const svc = new ProviderService(new ProviderRegistry().register(new ScriptedProvider('p', turn)), bus);
    const got: ProviderEvent[] = [];
    const run = svc.run('p', { messages: [{ role: 'user', content: 'x' }] }, (e) => got.push(e));
    const done = await run.done;
    expect(done.type).toBe('run.completed');
    expect(seen).toEqual(['provider.started', 'text.delta', 'text.delta', 'run.completed']);
    expect(got.map((e) => e.runId)).toEqual(Array(4).fill(run.runId));
    expect(bus.log.map((e) => (e.payload as ProviderEvent).type)).toEqual(['run.completed', 'provider.started']);
    expect(svc.activeRuns).toEqual([]);
  });

  it('closes a stream that ends without a terminal event', async () => {
    const svc = new ProviderService(new ProviderRegistry().register(new ScriptedProvider('p', turn.slice(0, 2))), new EventBus());
    const done = await svc.run('p', { messages: [{ role: 'user', content: 'x' }] }).done;
    expect(done).toMatchObject({ type: 'run.failed', error: { code: 'incomplete_stream' } });
  });

  it('survives an adapter that throws', async () => {
    const svc = new ProviderService(new ProviderRegistry().register(new ScriptedProvider('p', turn, { throwAfter: 1 })), new EventBus());
    const got: string[] = [];
    const done = await svc.run('p', { messages: [{ role: 'user', content: 'x' }] }, (e) => got.push(e.type)).done;
    expect(got).toEqual(['provider.started', 'provider.error', 'run.failed']);
    expect(done.type).toBe('run.failed');
  });

  it('cancels a running turn', async () => {
    const svc = new ProviderService(new ProviderRegistry().register(new ScriptedProvider('p', turn.slice(0, 1), { hangUntilAbort: true })), new EventBus());
    const run = svc.run('p', { messages: [{ role: 'user', content: 'x' }] });
    expect(svc.activeRuns).toEqual([run.runId]);
    await run.cancel();
    expect((await run.done).type).toBe('run.cancelled');
  });

  it('reports status on the bus and never throws for a broken getStatus', async () => {
    const bus = new EventBus();
    const broken = new ScriptedProvider('p', []);
    broken.getStatus = () => Promise.reject(new Error('nope'));
    const svc = new ProviderService(new ProviderRegistry().register(broken), bus);
    const s = await svc.status('p');
    expect(s.state).toBe('error');
    expect(bus.log[0].type).toBe('provider.status');
  });
});

describe('stream helpers', () => {
  it('AsyncQueue delivers pushed items in order and ends', async () => {
    const q = new AsyncQueue<number>();
    setTimeout(() => (q.push(1), q.push(2), q.end()), 0);
    const out: number[] = [];
    for await (const n of q) out.push(n);
    expect(out).toEqual([1, 2]);
  });

  it('LineBuffer joins chunks into lines, handling CRLF and a trailing line', () => {
    const lb = new LineBuffer();
    expect(lb.push('{"a"')).toEqual([]);
    expect(lb.push(':1}\r\n{"b":2}\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
    expect(lb.end()).toEqual(['{"c"']);
  });

  it('redact masks credentials', () => {
    const s = redact('key sk-ant-oat01-ABCDEFGHIJKL and Bearer eyJhbGciOiJIUzI1 and GITHUB_TOKEN=ghp_123456 and "accessToken":"xyz123"');
    expect(s).not.toMatch(/ABCDEFGHIJKL|eyJhbGciOiJIUzI1|ghp_123456|xyz123/);
  });
});

describe('reasoning effort', () => {
  const models = [
    { id: 'a', reasoning: { efforts: ['low', 'medium', 'high', 'max'], default: 'medium' } },
    { id: 'b', reasoning: { efforts: ['low', 'high'] } },
    { id: 'c' },
  ];
  it('a model offers only its own levels; without a model, those every model has', () => {
    expect(modelEfforts(models, 'a')).toEqual(['low', 'medium', 'high', 'max']);
    expect(modelEfforts(models, 'c')).toEqual([]);
    expect(modelEfforts(models, 'unknown')).toEqual([]);
    expect(modelEfforts(models.slice(0, 2), undefined)).toEqual(['low', 'high']);
    expect(modelEfforts(models, undefined)).toEqual([]);
    expect(modelEfforts([], undefined)).toEqual([]);
    expect(defaultEffort(models, 'a')).toBe('medium');
    expect(defaultEffort(models, undefined)).toBeUndefined();
  });
  it('an unlisted level is dropped, never guessed', () => {
    expect(acceptedEffort(models, 'a', 'max')).toBe('max');
    expect(acceptedEffort(models, 'b', 'max')).toBeUndefined();
    expect(acceptedEffort(models, 'c', 'low')).toBeUndefined();
    expect(acceptedEffort(models, 'a', undefined)).toBeUndefined();
  });
});

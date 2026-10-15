// ─────────────────────────────────────────────────────────────
// ProviderService: runs provider turns for the rest of RealmNest and publishes
// their normalized events on the app event bus ('provider.event').
//
// It knows nothing about any specific backend. The visual world can subscribe
// to the bus later; for now only the debug panel listens.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import type { ProviderRegistry } from './registry';
import { isTerminal, type AIProvider, type ProviderEvent, type ProviderStatus, type ProviderTurnRequest } from './types';

export interface ProviderRun {
  runId: string;
  providerId: string;
  /** set when the turn ran on an AI connection */
  connectionId?: string;
  /** stop the turn; resolves once the request is passed on */
  cancel(): Promise<void>;
  /** the turn's terminal event (run.completed / run.failed / run.cancelled) */
  done: Promise<ProviderEvent>;
}

export type RunRequest = Omit<ProviderTurnRequest, 'runId' | 'abortSignal'> & { runId?: string };

let runCounter = 0;
export const newRunId = () => `run-${Date.now().toString(36)}-${(++runCounter).toString(36)}`;

export class ProviderService {
  private active = new Map<string, AbortController>();

  constructor(
    readonly registry: ProviderRegistry,
    private bus: EventBus,
    /** finds the adapter of an AI connection by id (ConnectionManager.provider) */
    private connections?: (connectionId: string) => AIProvider | undefined,
  ) {}

  /** The adapter for a connection id, or (without connections) for a registered provider id. */
  resolve(target: string): AIProvider | undefined {
    return this.connections?.(target) ?? this.registry.get(target);
  }

  has(target: string): boolean {
    return !!this.resolve(target);
  }

  private require(target: string): AIProvider {
    const p = this.resolve(target);
    if (!p) throw new Error(`Unknown AI connection or provider "${target}"`);
    return p;
  }

  async status(providerId: string): Promise<ProviderStatus> {
    const provider = this.require(providerId);
    let status: ProviderStatus;
    try {
      status = await provider.getStatus();
    } catch (err) {
      // getStatus should not throw; if it does, report instead of crashing the UI
      status = { state: 'error', message: `Could not check ${provider.name}.`, details: { error: String(err) }, checkedAt: Date.now() };
    }
    this.bus.emit('provider.status', { providerId, status });
    return status;
  }

  /** Start a turn on a connection (or provider) id. Events go to the bus and to `onEvent`. */
  run(target: string, request: RunRequest, onEvent?: (e: ProviderEvent) => void): ProviderRun {
    const provider = this.require(target);
    const providerId = provider.id;
    const connectionId = this.connections?.(target) ? target : undefined;
    const runId = request.runId ?? newRunId();
    const ac = new AbortController();
    this.active.set(runId, ac);

    const publish = (raw: ProviderEvent) => {
      const e = connectionId ? { ...raw, connectionId } : raw;
      this.bus.emit('provider.event', e, { log: e.type !== 'text.delta' });
      onEvent?.(e);
    };

    const done = (async () => {
      let terminal: ProviderEvent | null = null;
      let seq = 0;
      try {
        for await (const e of provider.runTurn({ ...request, runId, abortSignal: ac.signal })) {
          seq = e.seq;
          publish(e);
          if (isTerminal(e)) terminal = e;
        }
      } catch (err) {
        // contract violation by an adapter: still end the run cleanly
        terminal = null;
        publish({ type: 'provider.error', error: { code: 'unknown', message: `${provider.name} failed unexpectedly.`, detail: String(err) }, runId, providerId, seq: ++seq, at: Date.now() });
      } finally {
        this.active.delete(runId);
      }
      if (!terminal) {
        terminal = { type: 'run.failed', error: { code: 'incomplete_stream', message: `${provider.name} stopped without finishing the turn.` }, runId, providerId, seq: seq + 1, at: Date.now() };
        publish(terminal);
      }
      return terminal;
    })();

    return {
      runId,
      providerId,
      connectionId,
      done,
      cancel: async () => {
        ac.abort();
        await provider.cancel?.(runId);
      },
    };
  }

  cancel(runId: string) {
    this.active.get(runId)?.abort();
  }

  get activeRuns(): string[] {
    return [...this.active.keys()];
  }
}

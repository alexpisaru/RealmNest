// ToolService: what LiveRuntime and ConversationRuntime use. It decides which
// tools a run may be offered (only when the adapter and the model really take
// tool calls, only tools that can run here and are not set to "never") and
// runs the turn the way the adapter takes tools:
//
//   loop    the model asks between turns, RealmNest runs the calls (ToolLoop; OpenRouter)
//   bridge  the model runs its own loop and calls RealmNest's MCP server, which
//           hands every call to ToolRuntime (McpBridge; Claude Code)
//
// Either way the calls go through the same ToolRuntime: permissions, approval,
// history, cancellation.

import type { ToolPermission } from '../../domain/tool';
import type { McpBridge } from '../mcp/bridge';
import type { ProviderRun, ProviderService, RunRequest } from '../providers/service';
import type { ProviderEvent } from '../providers/types';
import type { ToolLoop } from './loop';
import type { ToolPolicyStore } from './policy';
import type { ToolRegistry } from './registry';
import type { ToolRuntime, ToolScope } from './runtime';

/** tools one model turn may see: providers cap it (OpenRouter host: 32), and every schema costs context */
export const MAX_OFFERED_TOOLS = 32;

export type ToolMode = 'loop' | 'bridge';

export interface ToolOffer {
  /** tool ids the model will see (empty: run without tools) */
  ids: string[];
  workspace?: string;
  /** why tools were wanted but none are offered (shown in the UI) */
  reason?: 'model' | 'none-enabled';
  /** how many runnable tools were left out by MAX_OFFERED_TOOLS (shown as a warning) */
  capped?: number;
}

export class ToolService {
  constructor(
    readonly registry: ToolRegistry,
    readonly runtime: ToolRuntime,
    readonly policy: ToolPolicyStore,
    private loop: ToolLoop,
    /** how this connection/model takes RealmNest tools, if at all (`true` = loop) */
    private mode: (connectionId: string, model?: string) => ToolMode | boolean | undefined,
    /** the RealmNest MCP bridge, for adapters that run their own loop (Claude Code) */
    private bridged?: { bridge: McpBridge; providers: ProviderService },
  ) {}

  /** how a run on this connection/model would get its tools */
  modeFor(connectionId: string, model?: string): ToolMode | undefined {
    const m = this.mode(connectionId, model);
    if (m === true || m === 'loop') return 'loop';
    if (m === 'bridge' && this.bridged?.bridge.available) return 'bridge';
    return undefined;
  }

  /**
   * Tools for a run. `wanted`: an agent's allowed tools, or undefined for a
   * chat with tools on (every runnable tool the user has not set to never).
   */
  offer(connectionId: string, model: string | undefined, wanted: string[] | undefined, perms?: Record<string, ToolPermission>, workspace?: string): ToolOffer {
    // native tools first, then the others in the order given (an agent's ticks) or by id
    // tools meant for Skills only (read_skill_resource) are offered only when asked for by id
    const pool = wanted ?? this.registry.list().filter((t) => t.metadata?.skillOnly !== 'true' && t.metadata?.runScoped !== 'true').map((t) => t.id);
    const all = pool.filter((id) => this.registry.available(id) && this.runtime.permissionFor(id, { agentPermissions: perms }) !== 'deny');
    const native = all.filter((id) => this.registry.get(id)?.source === 'native');
    const ordered = [...native, ...all.filter((id) => !native.includes(id))];
    const candidates = ordered.slice(0, MAX_OFFERED_TOOLS);
    const capped = ordered.length - candidates.length;
    const ws = workspace?.trim() || this.policy.get().workspace;
    if (!candidates.length) return { ids: [], ...(ws && { workspace: ws }), reason: 'none-enabled' };
    if (!this.modeFor(connectionId, model)) return { ids: [], ...(ws && { workspace: ws }), reason: 'model' };
    return { ids: candidates, ...(ws && { workspace: ws }), ...(capped > 0 && { capped }) };
  }

  run(target: string, request: RunRequest & { runId: string }, scope: ToolScope, onEvent: (e: ProviderEvent) => void): ProviderRun {
    if (this.modeFor(target, request.model) === 'bridge' && this.bridged) return this.runBridged(target, request, scope, onEvent);
    return this.loop.run(target, request, scope, onEvent);
  }

  /** a turn whose model calls RealmNest's MCP server; the session lives exactly as long as the run */
  private runBridged(target: string, request: RunRequest & { runId: string }, scope: ToolScope, onEvent: (e: ProviderEvent) => void): ProviderRun {
    const { bridge, providers } = this.bridged!;
    const providerId = providers.resolve(target)?.id ?? target;
    let inner: ProviderRun | undefined;
    let cancelled = false;
    let close: (() => Promise<void>) | undefined;
    // over a tool-call limit (as the ToolLoop's): the run is stopped and ends failed, not cancelled (docs/HARDENING.md R-5)
    let limit: string | undefined;
    const asLimit = (e: ProviderEvent): ProviderEvent => (limit && e.type === 'run.cancelled' ? ({ ...e, type: 'run.failed', error: { code: 'tool_call_limit', message: limit } } as ProviderEvent) : e);
    const done = (async (): Promise<ProviderEvent> => {
      try {
        const session = await bridge.open(scope, (message) => {
          limit = message;
          void inner?.cancel();
        });
        close = session.close;
        if (cancelled) {
          const e: ProviderEvent = { type: 'run.cancelled', reason: 'Cancelled.', runId: request.runId, providerId, seq: 1, at: Date.now() };
          onEvent(e);
          return e;
        }
        inner = providers.run(target, { ...request, realmnestBridge: { configPath: session.configPath, tools: session.toolNames } }, (e) => onEvent(asLimit(e)));
        return asLimit(await inner.done);

      } catch (err) {
        const e: ProviderEvent = { type: 'run.failed', error: { code: 'unknown', message: 'The RealmNest MCP bridge could not start.', detail: String(err) }, runId: request.runId, providerId, seq: 1, at: Date.now() };
        onEvent(e);
        return e;
      } finally {
        await close?.();
        this.runtime.endRun(request.runId);
      }
    })();
    return {
      runId: request.runId,
      providerId,
      connectionId: target,
      done,
      cancel: async () => {
        cancelled = true;
        await inner?.cancel();
        // calls waiting for approval end with the run
        await close?.();
      },
    };
  }
}

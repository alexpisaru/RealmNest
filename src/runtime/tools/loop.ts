// ─────────────────────────────────────────────────────────────
// ToolLoop: a provider turn that may use RealmNest tools, as an explicit loop.
//
//   turn ─▶ model asks for tools? ─no─▶ done
//              │ yes
//              ▼
//      ToolRuntime runs each call (permissions, approval, executor)
//              │ results go back as `tool` messages
//              └──────────▶ next turn
//
// To its caller it looks like one ordinary provider run (the same events,
// one terminal event), so LiveRuntime and ConversationRuntime stay simple.
// Limits stop a model that keeps calling: total calls, identical calls and
// failures in a row end the run with `tool_call_limit`.
// ─────────────────────────────────────────────────────────────

import type { ToolResult } from '../../domain/tool';
import type { ProviderRun, ProviderService, RunRequest } from '../providers/service';
import type { ProviderEvent, ProviderEventBody, ProviderMessage, TokenUsage } from '../providers/types';
import type { ToolRegistry } from './registry';
import type { ToolRuntime, ToolScope } from './runtime';

export interface ToolLoopLimits {
  /** tool calls in one run */
  maxCalls: number;
  /** the same tool with the same input */
  maxSameCall: number;
  /** calls that failed or were refused, one after the other */
  maxFailuresInRow: number;
  /** model turns in one run (each answer to tool results is a turn) */
  maxTurns: number;
}

export const DEFAULT_TOOL_LIMITS: ToolLoopLimits = { maxCalls: 10, maxSameCall: 2, maxFailuresInRow: 3, maxTurns: 12 };

/** structured data larger than this is left out when there is text */
const MAX_DATA_FOR_MODEL = 16 * 1024;

/** what the model gets back for one call */
export function resultForModel(r: ToolResult): string {
  if (r.success) {
    // structured data goes along when small; large data is already in `content` (MCP sends both)
    const data = r.structuredData === undefined ? undefined : JSON.stringify(r.structuredData);
    const withData = data !== undefined && (data.length <= MAX_DATA_FOR_MODEL || !r.content);
    return JSON.stringify({ ok: true, content: r.content ?? '', ...(withData && { data: r.structuredData }), ...(r.artifacts?.length && { artifacts: r.artifacts }) });
  }
  return JSON.stringify({ ok: false, error: r.error ?? { code: 'TOOL_EXECUTION_FAILED', message: 'The tool failed.' } });
}

export class ToolLoop {
  constructor(
    private providers: ProviderService,
    private tools: ToolRuntime,
    private registry: ToolRegistry,
    private limits: ToolLoopLimits = DEFAULT_TOOL_LIMITS,
  ) {}

  /** Run a turn with these tools on offer (`scope.allowedToolIds`); same contract as ProviderService.run. */
  run(target: string, request: RunRequest & { runId: string }, scope: ToolScope, onEvent: (e: ProviderEvent) => void): ProviderRun {
    const provider = this.providers.resolve(target);
    const providerId = provider?.id ?? target;
    const ac = new AbortController();
    let current: ProviderRun | null = null;
    let seq = 0;
    const stamp = (b: ProviderEventBody): ProviderEvent => ({ ...b, runId: request.runId, providerId, seq: ++seq, at: Date.now() }) as ProviderEvent;
    let finished: ProviderEvent | null = null;
    const finish = (b: ProviderEventBody) => {
      if (finished) return finished;
      finished = stamp(b);
      onEvent(finished);
      this.tools.endRun(request.runId);
      return finished;
    };

    const done = (async (): Promise<ProviderEvent> => {
      const schemas = this.registry.schemas(scope.allowedToolIds);
      const messages: ProviderMessage[] = [...request.messages];
      const texts: string[] = [];
      let startedOnce = false;
      let usage: TokenUsage | undefined;
      let costUsd: number | undefined;
      let calls = 0;
      let failuresInRow = 0;
      const seen = new Map<string, number>();

      for (let turn = 0; ; turn++) {
        if (ac.signal.aborted) return finish({ type: 'run.cancelled', reason: 'Cancelled.' });
        if (turn >= this.limits.maxTurns) return finish({ type: 'run.failed', error: { code: 'tool_call_limit', message: `The model kept using tools for ${this.limits.maxTurns} turns; the run was stopped (TOOL_CALL_LIMIT_REACHED).` } });

        const requests: { id: string; name: string; input: unknown }[] = [];
        let turnText = '';
        let lastUsage: TokenUsage | undefined;
        let lastCost: number | undefined;
        const before = texts.join('\n\n');
        current = this.providers.run(target, { ...request, messages, toolSchemas: schemas }, (e) => {
          if (ac.signal.aborted || finished) return;
          switch (e.type) {
            case 'provider.started':
              if (!startedOnce) (startedOnce = true), onEvent(stamp({ type: 'provider.started', model: e.model }));
              return;
            case 'text.delta':
              // a blank line between what the model wrote before and after using tools
              if (!turnText && before) onEvent(stamp({ type: 'text.delta', messageId: e.messageId, index: e.index, text: '\n\n' }));
              turnText += e.text;
              onEvent(stamp({ type: 'text.delta', messageId: e.messageId, index: e.index, text: e.text }));
              return;
            case 'usage.updated':
              lastUsage = e.usage;
              lastCost = e.costUsd;
              return;
            case 'tool.requested':
              requests.push({ id: e.toolCallId, name: e.name, input: e.input });
              return;
            case 'run.completed':
            case 'run.failed':
            case 'run.cancelled':
            case 'provider.error':
              return; // the loop decides what ends the run
            default:
              return;
          }
        });
        if (ac.signal.aborted) current.cancel();
        const end = await current.done;
        current = null;
        if (lastUsage) usage = { inputTokens: (usage?.inputTokens ?? 0) + lastUsage.inputTokens, outputTokens: (usage?.outputTokens ?? 0) + lastUsage.outputTokens };
        if (lastCost !== undefined) costUsd = (costUsd ?? 0) + lastCost;
        if (usage) onEvent(stamp({ type: 'usage.updated', usage, cumulative: true, ...(costUsd !== undefined && { costUsd }) }));

        if (ac.signal.aborted || end.type === 'run.cancelled') return finish({ type: 'run.cancelled', reason: 'Cancelled.' });
        if (end.type === 'run.failed') return finish({ type: 'run.failed', error: end.error });
        if (end.type !== 'run.completed') return finish({ type: 'run.failed', error: { code: 'incomplete_stream', message: 'The model stopped without finishing the turn.' } });
        const text = end.text || turnText;
        if (text) texts.push(text);
        if (!requests.length) return finish({ type: 'run.completed', text: texts.join('\n\n'), ...(usage && { usage }), ...(costUsd !== undefined && { costUsd }), stopReason: end.stopReason });

        // the model asked for tools: run them in order and answer each call
        messages.push({ role: 'assistant', content: text, toolCalls: requests });
        for (const r of requests) {
          const key = `${r.name}:${JSON.stringify(r.input)}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
          if (calls >= this.limits.maxCalls || (seen.get(key) ?? 0) > this.limits.maxSameCall) {
            const why = calls >= this.limits.maxCalls ? `more than ${this.limits.maxCalls} tool calls` : `the same ${r.name} call again`;
            return finish({ type: 'run.failed', error: { code: 'tool_call_limit', message: `The model asked for ${why}; the run was stopped (TOOL_CALL_LIMIT_REACHED).` } });
          }
          calls++;
          const { result } = await this.tools.execute({ providerCallId: r.id, name: r.name, input: r.input }, scope, ac.signal);
          if (ac.signal.aborted) return finish({ type: 'run.cancelled', reason: 'Cancelled.' });
          failuresInRow = result.success ? 0 : failuresInRow + 1;
          messages.push({ role: 'tool', toolCallId: r.id, content: resultForModel(result) });
          if (failuresInRow >= this.limits.maxFailuresInRow)
            return finish({ type: 'run.failed', error: { code: 'tool_call_limit', message: `${failuresInRow} tool calls in a row failed or were refused; the run was stopped (TOOL_CALL_LIMIT_REACHED).`, detail: result.error?.code } });
        }
      }
    })().catch((err) => finish({ type: 'run.failed', error: { code: 'unknown', message: 'The tool loop failed unexpectedly.', detail: String(err) } }));

    return {
      runId: request.runId,
      providerId,
      connectionId: target,
      done,
      cancel: async () => {
        ac.abort();
        await current?.cancel();
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// AgentRuntime — the "truth" about what each agent is doing.
//
// The beta ships MockRuntime. Phase 2 implements the same interface on top
// of real providers (Claude Code, Anthropic, OpenAI, Ollama…). The visual
// world never asks the runtime what to draw: it listens to the events the
// runtime publishes on the bus ("runtime event → visual state").
// ─────────────────────────────────────────────────────────────

import type { RuntimeStatus, SimCommand, Task } from '../domain/sim';

export interface AgentRuntime {
  readonly kind: 'mock' | 'live';
  /** register the agents (character ids) this runtime drives */
  attach(agentIds: string[]): void;
  detach(agentId: string): void;
  /** control plane: start/pause/break/resume/assign/delegate… */
  dispatch(cmd: SimCommand): void;
  /** advance simulated time (mock only; a live runtime ignores it) */
  tick(dt: number): void;
  reset(): void;
  status(agentId: string): RuntimeStatus;
  task(agentId: string): Task | null;
  /** mock scheduler that cycles work / breaks on its own */
  autopilot: boolean;
  /** chance (0..1) that a mock task fails, to exercise the `error` state */
  failureRate: number;
}

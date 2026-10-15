// ─────────────────────────────────────────────────────────────
// Simulation vocabulary shared by runtime, visual sim and UI.
// ─────────────────────────────────────────────────────────────

/** Visual state of a character in the world. */
export const AGENT_STATES = ['idle', 'walking', 'working', 'on_break', 'interacting', 'waiting', 'paused', 'error'] as const;
export type AgentState = (typeof AGENT_STATES)[number];

/** What the (mock) runtime says the agent is doing. The visual state is derived from this. */
export type RuntimeStatus = 'idle' | 'working' | 'paused' | 'break' | 'waiting' | 'error' | 'meeting';

export type CommandType =
  | 'startWork'
  | 'pause'
  | 'break'
  | 'resume'
  | 'reset'
  | 'randomize'
  | 'idle'
  | 'assign'
  | 'huddle'
  | 'delegate'
  | 'forceState'
  | 'goto';

export interface SimCommand {
  type: CommandType;
  /** character ids; empty/undefined = everyone in the world */
  targets?: string[];
  /** optional task title (assign / delegate) */
  task?: string;
  /** delegate: who receives the task */
  to?: string;
  /** forceState */
  state?: AgentState;
  /** goto: an interaction point id or a tile */
  pointId?: string;
  tile?: { x: number; y: number };
  source?: 'user' | 'autopilot' | 'debug' | 'bridge';
}

export interface Task {
  id: string;
  title: string;
  progress: number; // 0..1
  duration: number; // simulated seconds
  from?: string; // delegated by
}

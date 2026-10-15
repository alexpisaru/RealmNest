// Tool permissions: allow / ask / deny, decided in one place.
//
//   1. the tool's own ceiling      (a tool can be "always asks" or "never")
//   2. the agent's choice          (AgentDefinition.toolPermissions)
//   3. the user's global choice    (this store: Settings › General › Tools)
//   4. the default from the risk   (low → allow, medium / high → ask)
//
// The first of 2–4 that is set wins; the ceiling then caps it, and so does the user's global
// "never" (an agent's own "allow" cannot lift it). An agent can
// only use tools it lists in `allowedToolIds`; a chat with tools on uses the
// tools the user has not set to deny.

import type { EventBus } from '../../core/events';
import { riskDefault, type ToolDefinition, type ToolPermission } from '../../domain/tool';
import type { StorageAdapter } from '../../persistence/storage';

const KEY = 'tool-policy';
const ORDER: Record<ToolPermission, number> = { allow: 0, ask: 1, deny: 2 };

export interface ToolPolicyState {
  version: 1;
  /** absolute folder the file tools work in (agents may set their own) */
  workspace?: string;
  /** the user's per-tool choice, for every agent and chat */
  global: Record<string, ToolPermission>;
}

/** the stricter of two permissions */
export const stricter = (a: ToolPermission, b: ToolPermission): ToolPermission => (ORDER[a] >= ORDER[b] ? a : b);

export function resolvePermission(tool: ToolDefinition, layers: { agent?: ToolPermission; global?: ToolPermission }): ToolPermission {
  // the user's global "never" is a ceiling too: no agent setting lifts it (docs/HARDENING.md I-20)
  const chosen = layers.global === 'deny' ? 'deny' : (layers.agent ?? layers.global ?? tool.permissions.default ?? riskDefault(tool.risk));

  return tool.permissions.ceiling ? stricter(chosen, tool.permissions.ceiling) : chosen;
}

export class ToolPolicyStore {
  private state: ToolPolicyState = { version: 1, global: {} };
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private storage: StorageAdapter,
    private bus?: EventBus,
  ) {}

  async init() {
    const raw = await this.storage.get<Partial<ToolPolicyState>>(KEY);
    const global: Record<string, ToolPermission> = {};
    for (const [k, v] of Object.entries(raw?.global ?? {})) if (v === 'allow' || v === 'ask' || v === 'deny') global[k] = v;
    this.state = { version: 1, global, ...(typeof raw?.workspace === 'string' && raw.workspace.trim() && { workspace: raw.workspace.trim() }) };
    this.changed();
  }

  get(): ToolPolicyState {
    return this.state;
  }

  async setWorkspace(path: string) {
    const p = path.trim();
    const next = { ...this.state };
    if (p) next.workspace = p;
    else delete next.workspace;
    await this.save(next);
  }

  /** undefined: back to the default */
  async setGlobal(toolId: string, permission: ToolPermission | undefined) {
    const global = { ...this.state.global };
    if (permission) global[toolId] = permission;
    else delete global[toolId];
    await this.save({ ...this.state, global });
  }

  private async save(next: ToolPolicyState) {
    this.state = next;
    await this.storage.set(KEY, next);
    this.bus?.emit('tool.policy.updated', { workspace: !!next.workspace, tools: Object.keys(next.global).length });
    this.changed();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

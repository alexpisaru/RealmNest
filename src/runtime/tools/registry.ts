// The one authoritative list of tools. Native tools register at startup;
// later MCP servers, CLI adapters and plugins register theirs the same way
// (as ToolDefinitions with their own `source`). Nothing else keeps a tool list.

import { isToolId, isToolName, toolSchema, type ToolDefinition, type ToolResult, type ToolSchema, type ToolSource } from '../../domain/tool';
import { checkSchema } from './schema';

export class ToolRegistryError extends Error {}

export interface ToolExecution {
  callId: string;
  /** already validated against the tool's input schema */
  input: Record<string, unknown>;
  /** absolute workspace folder for filesystem tools */
  workspace?: string;
  signal: AbortSignal;
  /** the run's own attachments (the only stored files a tool may read) */
  attachments?: { id: string; name: string; mime: string; storageRef: string }[];
  runId?: string;
}

/** runs one tool call; failures come back as a ToolResult with an error, never as a throw the model sees */
export type ToolExecutor = (exec: ToolExecution) => Promise<Omit<ToolResult, 'toolCallId'>>;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private executors = new Map<string, ToolExecutor>();
  private listeners = new Set<() => void>();
  private version = 0;

  /** A tool and (for sources that run here) how to run it; without an executor it is listed but unavailable. */
  register(tool: ToolDefinition, executor?: ToolExecutor): this {
    if (this.tools.has(tool.id)) throw new ToolRegistryError(`A tool with id "${tool.id}" is already registered.`);
    this.check(tool);
    this.tools.set(tool.id, Object.freeze({ ...tool }));
    if (executor) this.executors.set(tool.id, executor);
    this.changed();
    return this;
  }

  /**
   * Add or update a tool under the same id (a source that rediscovered it,
   * e.g. an MCP server after a reconnect, possibly with a changed schema).
   * The id, and so every agent's selection and the call history, stays.
   */
  upsert(tool: ToolDefinition, executor?: ToolExecutor): this {
    this.check(tool);
    this.tools.set(tool.id, Object.freeze({ ...tool }));
    if (executor) this.executors.set(tool.id, executor);
    else this.executors.delete(tool.id);
    this.changed();
    return this;
  }

  /** Keep a tool listed but make it unavailable (its source went away), or runnable again. */
  setExecutor(id: string, executor: ToolExecutor | undefined) {
    if (!this.tools.has(id)) return;
    if (executor) this.executors.set(id, executor);
    else if (!this.executors.delete(id)) return;
    this.changed();
  }

  private check(tool: ToolDefinition) {
    if (!isToolId(tool.id)) throw new ToolRegistryError(`"${tool.id}" is not a valid tool id (lowercase letters, digits and _, or mcp.<server>.<tool>).`);
    if (!isToolName(tool.name)) throw new ToolRegistryError(`"${tool.name}" is not a valid tool name (letters, digits, _ and -, at most 64).`);
    if ([...this.tools.values()].some((t) => t.name === tool.name && t.id !== tool.id)) throw new ToolRegistryError(`A tool named "${tool.name}" is already registered.`);
    const problem = checkSchema(tool.inputSchema);
    if (problem) throw new ToolRegistryError(`${tool.id}: ${problem}.`);
    if (!(tool.timeoutMs > 0)) throw new ToolRegistryError(`${tool.id}: a timeout is required.`);
  }

  unregister(id: string): boolean {
    const had = this.tools.delete(id);
    this.executors.delete(id);
    if (had) this.changed();
    return had;
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  executor(id: string): ToolExecutor | undefined {
    return this.executors.get(id);
  }

  /** registered and runnable here */
  available(id: string): boolean {
    return this.tools.has(id) && this.executors.has(id);
  }

  /** by the name a model used */
  byName(name: string): ToolDefinition | undefined {
    return [...this.tools.values()].find((t) => t.name === name);
  }

  list(filter: { source?: ToolSource; ids?: string[] } = {}): ToolDefinition[] {
    return [...this.tools.values()].filter((t) => (!filter.source || t.source === filter.source) && (!filter.ids || filter.ids.includes(t.id))).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** what a provider may see of these tools (never executors or metadata) */
  schemas(ids: string[]): ToolSchema[] {
    return ids.map((id) => this.tools.get(id)).filter((t): t is ToolDefinition => !!t).map(toolSchema);
  }

  get size() {
    return this.tools.size;
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

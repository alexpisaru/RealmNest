// SkillDependencyResolver: what a Skill needs, checked against what this
// RealmNest has right now — per requirement, never as one boolean.
//
//   tool  'write_text_file' / {id}       → the registry (runnable? not set to never?)
//   tool  {mcpServer: 'photocraft', …}   → any configured MCP server with that key,
//                                           name or reported name (portable across machines)
//   capability 'vision.input'            → the agent's / chat's connection and model

import type { CapabilityId } from '../../domain/capability';
import { requirementLabel, type SkillManifest, type SkillReadiness, type SkillRequirementState, type ToolRequirement } from '../../domain/skill';
import type { ToolPermission } from '../../domain/tool';
import type { ToolRegistry } from '../tools/registry';

export interface RequirementStatus {
  kind: 'capability' | 'tool';
  /** what the Skill asked for, readable */
  requirement: string;
  required: boolean;
  state: SkillRequirementState;
  /** the local tool it resolved to */
  toolId?: string;
  note?: string;
}

export interface SkillResolution {
  readiness: Exclude<SkillReadiness, 'DISABLED' | 'UNAVAILABLE'>;
  items: RequirementStatus[];
  /** local tool ids that satisfy the requirements (only READY ones) */
  requiredToolIds: string[];
  optionalToolIds: string[];
}

/** what the resolver may look at (all read-only) */
export interface ResolverDeps {
  registry: ToolRegistry;
  /** allow / ask / deny for a tool, with the agent's own choices */
  permission: (toolId: string, agentPermissions?: Record<string, ToolPermission>) => ToolPermission;
  /** configured MCP servers: their key, names, discovered and turned-on tools */
  mcpServers?: () => { key: string; name: string; reportedName?: string; discovered: string[]; enabled: string[] }[];
  /** a capability on a connection/model (CapabilityService.effective) */
  capability?: (cap: CapabilityId, connectionId: string, model?: string) => { ready: boolean; available: boolean; support: string; note?: string };
}

export interface ResolveContext {
  connectionId?: string;
  model?: string;
  agentPermissions?: Record<string, ToolPermission>;
}

export class SkillDependencyResolver {
  constructor(private deps: ResolverDeps) {}

  private toolState(toolId: string, ctx: ResolveContext): { state: SkillRequirementState; note?: string } {
    const { registry } = this.deps;
    if (registry.get(toolId)) {
      if (!registry.available(toolId)) return { state: 'TOOL_UNAVAILABLE', note: toolId.startsWith('mcp.') ? 'its MCP server is not connected' : 'it cannot run in this build' };
      if (this.deps.permission(toolId, ctx.agentPermissions) === 'deny') return { state: 'TOOL_DISABLED', note: 'set to never' };
      return { state: 'READY' };
    }
    const m = /^mcp\.([a-z][a-z0-9_]*)\.(.+)$/.exec(toolId);
    if (m) {
      const server = this.deps.mcpServers?.().find((s) => s.key === m[1]);
      if (server?.discovered.includes(m[2])) return { state: 'TOOL_DISABLED', note: `turned off in ${server.name} (Settings › Integrations › MCP)` };
      if (server) return { state: 'MISSING_TOOL', note: `${server.name} has not offered this tool (connect it once to discover its tools)` };
      return { state: 'MISSING_TOOL', note: `no MCP server "${m[1]}" is configured` };
    }
    return { state: 'MISSING_TOOL', note: 'not a tool of this RealmNest' };
  }

  private resolveTool(r: ToolRequirement, required: boolean, ctx: ResolveContext): RequirementStatus {
    const base = { kind: 'tool' as const, requirement: requirementLabel(r), required };
    if (typeof r === 'string' || 'id' in r) {
      const id = typeof r === 'string' ? r : r.id;
      return { ...base, toolId: id, ...this.toolState(id, ctx) };
    }
    // portable: an MCP tool by server and tool name, whatever the local key is
    const want = r.mcpServer.toLowerCase();
    const servers = (this.deps.mcpServers?.() ?? []).filter((s) => s.key === want || s.name.toLowerCase() === want || s.reportedName?.toLowerCase() === want);
    if (!servers.length) return { ...base, state: 'MISSING_TOOL', note: `no MCP server named "${r.mcpServer}" is configured (Settings › Integrations)` };
    const candidates = servers.map((s) => {
      const id = `mcp.${s.key}.${r.tool}`;
      return { id, ...this.toolState(id, ctx) };
    });
    const best = candidates.find((c) => c.state === 'READY') ?? candidates[0];
    return { ...base, toolId: best.id, state: best.state, ...(best.note && { note: best.note }) };
  }

  resolve(m: SkillManifest, ctx: ResolveContext = {}): SkillResolution {
    const items: RequirementStatus[] = [];
    for (const cap of m.requiresCapabilities) {
      if (!ctx.connectionId || !this.deps.capability) {
        items.push({ kind: 'capability', requirement: cap, required: true, state: 'READY', note: 'checked against the agent or chat model when it runs' });
        continue;
      }
      const e = this.deps.capability(cap, ctx.connectionId, ctx.model);
      const state: SkillRequirementState = !e.available ? 'CONNECTION_UNAVAILABLE' : e.support === 'unsupported' || !e.ready ? 'MISSING_CAPABILITY' : 'READY';
      items.push({ kind: 'capability', requirement: cap, required: true, state, ...(state !== 'READY' && { note: !e.available ? 'the AI connection is not connected' : e.note ?? 'this model does not support it' }) });
    }
    for (const r of m.requiresTools) items.push(this.resolveTool(r, true, ctx));
    for (const r of m.optionalTools) items.push(this.resolveTool(r, false, ctx));
    const requiredOk = items.filter((i) => i.required).every((i) => i.state === 'READY');
    const optionalOk = items.filter((i) => !i.required).every((i) => i.state === 'READY');
    const ids = (required: boolean) => [...new Set(items.filter((i) => i.kind === 'tool' && i.required === required && i.state === 'READY' && i.toolId).map((i) => i.toolId!))];
    return { readiness: !requiredOk ? 'NOT_READY' : optionalOk ? 'READY' : 'PARTIALLY_READY', items, requiredToolIds: ids(true), optionalToolIds: ids(false) };
  }
}

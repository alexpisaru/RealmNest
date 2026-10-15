// Tool settings: the workspace folder and the user's global permission per
// tool (Settings › General), and an agent's own tools (World inspector).

import type { TKey } from '../../i18n';
import { resolvePermission } from '../../runtime/tools/policy';
import { useServices, useT, useTools } from '../context';
import type { ToolDefinition } from '../../domain/tool';
import { MAX_OFFERED_TOOLS } from '../../runtime/tools/service';
import { PermissionSelect } from './ToolCalls';

/** [group label, tools]: native first, then each MCP server by name */
export function groupTools(list: ToolDefinition[], nativeLabel: string): [string, ToolDefinition[]][] {
  const groups = new Map<string, ToolDefinition[]>();
  for (const tool of list) {
    const label = tool.source === 'native' ? nativeLabel : (tool.metadata?.mcpServerName ?? tool.source);
    groups.set(label, [...(groups.get(label) ?? []), tool]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === nativeLabel ? -1 : b === nativeLabel ? 1 : a.localeCompare(b)));
}

/** Settings › General › Tools */
export function ToolSettings() {
  const t = useT();
  const tools = useTools();
  const policy = tools.policy.get();
  return (
    <div className="tool-settings">
      <p className="muted small">{t('tools.sub')}</p>
      <label className="field-stack">
        <span>{t('tools.workspace')}</span>
        <input
          key={policy.workspace ?? ''}
          defaultValue={policy.workspace ?? ''}
          placeholder="C:\\Users\\…\\Documents\\RealmNest"
          onBlur={(e) => e.target.value.trim() !== (policy.workspace ?? '') && void tools.policy.setWorkspace(e.target.value)}
          aria-label={t('tools.workspace')}
          spellCheck={false}
        />
        <small className="muted">{t('tools.workspaceSub')}</small>
      </label>
      <ul className="tool-list">
        {tools.registry.list({ source: 'native' }).map((tool) => (
          <li key={tool.id}>
            <span className="tool-name">
              <code>{tool.name}</code>
              <small>
                {t(`tools.risk.${tool.risk}` as TKey)}
                {!tools.registry.available(tool.id) && ` · ${t('tools.unavailable')}`}
              </small>
            </span>
            <PermissionSelect value={policy.global[tool.id]} fallback={resolvePermission(tool, {})} onChange={(p) => void tools.policy.setGlobal(tool.id, p)} label={`${t('tools.permission')} ${tool.name}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** the agent's tools: which ones it may use, its own permissions, its folder */
export function AgentTools({ agentId, connectionId, model, name, disabled }: { agentId: string; connectionId: string; model?: string; name: string; disabled?: boolean }) {
  const t = useT();
  const tools = useTools();
  const { live } = useServices();
  const def = live.agent(agentId);
  const allowed = def.allowedToolIds ?? [];
  const perms = def.toolPermissions ?? {};
  const general = tools.policy.get().workspace;
  const offer = allowed.length ? tools.offer(connectionId, model, allowed, perms, def.workspace) : undefined;

  // RealmNest's tools first, then one group per MCP server
  const groups = groupTools(tools.registry.list(), t('tools.groupNative'));
  const toggle = (id: string, on: boolean) =>
    live.updateAgent(agentId, {
      allowedToolIds: on ? [...new Set([...allowed, id])] : allowed.filter((x) => x !== id),
    });
  const setPerm = (id: string, p: string | undefined) => {
    const next = { ...perms };
    if (p) next[id] = p as never;
    else delete next[id];
    live.updateAgent(agentId, { toolPermissions: next });
  };

  return (
    <div className="agent-tools">
      <span className="agent-tools-head">{t('tools.enabledFor', { name })}</span>
      {groups.map(([group, list]) => (
        <div key={group} className="tool-group">
          {groups.length > 1 && <span className="tool-group-head">{group}</span>}
          <ul className="tool-list compact">
            {list.map((tool) => {
              const on = allowed.includes(tool.id);
              const runnable = tools.registry.available(tool.id);
              return (
                <li key={tool.id} className={`${on ? 'on' : ''} ${runnable ? '' : 'off'}`}>
                  <label className="tool-check" title={tool.description}>
                    <input type="checkbox" checked={on} disabled={disabled || (!runnable && tool.source === 'native')} onChange={(e) => toggle(tool.id, e.target.checked)} />
                    <code>{tool.metadata?.mcpToolName ?? tool.name}</code>
                  </label>
                  {on && (
                    <PermissionSelect
                      value={perms[tool.id]}
                      fallback={resolvePermission(tool, {
                        global: tools.policy.get().global[tool.id],
                      })}
                      onChange={(p) => setPerm(tool.id, p)}
                      label={`${t('tools.permission')} ${tool.name}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {allowed.length > 0 && (
        <label className="field-stack">
          <span>{t('tools.workspaceAgent')}</span>
          <input
            key={def.workspace ?? ''}
            defaultValue={def.workspace ?? ''}
            disabled={disabled}
            placeholder={general ?? ''}
            onBlur={(e) => e.target.value.trim() !== (def.workspace ?? '') && live.updateAgent(agentId, { workspace: e.target.value })}
            aria-label={t('tools.workspaceAgent')}
            spellCheck={false}
          />
          <small className="muted">{def.workspace ? '' : general ? t('tools.workspaceDefault', { path: general }) : t('tools.workspaceNone')}</small>
        </label>
      )}
      {offer?.reason === 'model' && <p className="live-error">{t('tools.modelNo')}</p>}
      {!!offer?.capped && <p className="live-error">{t('tools.capped', { n: offer.capped, max: MAX_OFFERED_TOOLS })}</p>}
    </div>
  );
}

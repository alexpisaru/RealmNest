// The agent inspector's Skills section: tick the Skills this agent follows,
// with their readiness on the agent's own connection and model. A Skill that
// was uninstalled stays listed as unavailable (the agent keeps the reference).

import type { TKey } from '../../i18n';
import { useServices, useSkills, useT } from '../context';
import { SkillStateBadge, useSkillText } from './common';

export function AgentSkills({ agentId, name, connectionId, model, disabled }: { agentId: string; name: string; connectionId?: string; model?: string; disabled?: boolean }) {
  const t = useT();
  const skills = useSkills();
  const text = useSkillText();
  const { live } = useServices();
  const def = live.agent(agentId);
  const assigned = def.skillIds ?? [];
  const installed = skills.list();
  const gone = assigned.filter((id) => !skills.get(id));
  const toggle = (id: string, on: boolean) => live.updateAgent(agentId, { skillIds: on ? [...new Set([...assigned, id])] : assigned.filter((x) => x !== id) });

  return (
    <div className="agent-tools agent-skills">
      <span className="agent-tools-head">{t('skills.agentHead', { name })}</span>
      {!installed.length && <p className="muted small">{t('skills.agentNone')}</p>}
      <ul className="tool-list compact">
        {installed.map((s) => {
          const on = assigned.includes(s.manifest.id);
          const state = skills.readiness(s.manifest.id, { connectionId, model, agentPermissions: def.toolPermissions });
          return (
            <li key={s.manifest.id} className={on ? 'on' : ''}>
              <label className="tool-check" title={text(s, 'description')}>
                <input type="checkbox" checked={on} disabled={disabled || (!s.enabled && !on)} onChange={(e) => toggle(s.manifest.id, e.target.checked)} />
                <span>{text(s, 'name')}</span>
                <small className="muted">{s.manifest.version}</small>
              </label>
              {on && <SkillStateBadge state={state} />}
            </li>
          );
        })}
        {gone.map((id) => (
          <li key={id} className="on off">
            <label className="tool-check">
              <input type="checkbox" checked disabled={disabled} onChange={() => toggle(id, false)} />
              <code>{id}</code>
            </label>
            <span className="skill-state bad">{t('skills.unavailable' as TKey)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Small pieces the Skill screens share: readiness badges, the requirement
// list (per requirement, never one boolean) and a picker for RealmNest tools.

import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import { CAPABILITY_IDS, type CapabilityId } from '../../domain/capability';
import { requirementLabel, type InstalledSkill, type SkillReadiness, type ToolRequirement } from '../../domain/skill';
import type { TKey } from '../../i18n';
import type { RequirementStatus } from '../../runtime/skills/resolver';
import { groupTools } from '../tools/ToolSettings';
import { useT, useTools } from '../context';

const READY_CLASS: Record<SkillReadiness, string> = { READY: 'ok', PARTIALLY_READY: 'partial', NOT_READY: 'bad', DISABLED: 'off', UNAVAILABLE: 'bad' };

export function SkillStateBadge({ state }: { state: SkillReadiness }) {
  const t = useT();
  const Icon = state === 'READY' ? CheckCircle2 : state === 'PARTIALLY_READY' ? AlertTriangle : state === 'DISABLED' ? CircleSlash : XCircle;
  return (
    <span className={`skill-state ${READY_CLASS[state]}`}>
      <Icon size={13} /> {t(`skills.state.${state}` as TKey)}
    </span>
  );
}

/** a Skill's name and description; RealmNest's own Skills in the user's language (the instructions stay as written) */
export function useSkillText() {
  const t = useT();
  return (s: InstalledSkill, field: 'name' | 'description') => {
    const key = `s.skillb.${s.manifest.id}.${field}`;
    const v = s.origin === 'built_in' ? t(key as TKey) : key;
    return v === key ? s.manifest[field] : v;
  };
}

/** "PhotoCraft › doc_open" for an MCP tool id, the id otherwise */
export function useToolLabel() {
  const tools = useTools();
  return (r: ToolRequirement | string) => {
    const id = typeof r === 'string' ? r : 'id' in r ? r.id : undefined;
    if (!id) return requirementLabel(r as ToolRequirement);
    const def = tools.registry.get(id);
    return def?.metadata?.mcpServerName ? `${def.metadata.mcpServerName} › ${def.metadata.mcpToolName}` : id;
  };
}

export function RequirementList({ items }: { items: RequirementStatus[] }) {
  const t = useT();
  const label = useToolLabel();
  if (!items.length) return <p className="muted small">{t('skills.noReq')}</p>;
  return (
    <ul className="skill-reqs">
      {items.map((i, n) => (
        <li key={n} className={i.state === 'READY' ? 'ok' : i.required ? 'bad' : 'partial'}>
          {i.state === 'READY' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          <span className="skill-req-name">
            {i.kind === 'tool' && i.toolId && i.requirement === i.toolId ? label(i.toolId) : i.requirement}
          </span>
          <small>
            {i.kind === 'capability' ? t('s.skill.capability') : t('s.skill.tool')} · {i.required ? t('skills.required') : t('skills.optional')}
            {i.state !== 'READY' && ` · ${t(`skills.req.${i.state}` as TKey)}`}
            {i.note && ` — ${i.note}`}
          </small>
        </li>
      ))}
    </ul>
  );
}

/**
 * Pick RealmNest tools (native, and MCP tools the user turned on). MCP tools are
 * stored in the portable form {mcpServer, tool}, so the Skill works with
 * another user's server whatever its local key.
 */
export function ToolPicker({ value, onChange, label }: { value: ToolRequirement[]; onChange: (v: ToolRequirement[]) => void; label: string }) {
  const t = useT();
  const tools = useTools();
  const keyOf = (r: ToolRequirement) => (typeof r === 'string' ? r : 'id' in r ? r.id : `mcp.${r.mcpServer}.${r.tool}`);
  const chosen = new Set(value.map(keyOf));
  const groups = groupTools(
    tools.registry.list().filter((d) => d.metadata?.skillOnly !== 'true' && d.metadata?.runScoped !== 'true'),
    t('tools.groupNative'),
  );
  const toggle = (id: string, on: boolean) => {
    const def = tools.registry.get(id);
    const req: ToolRequirement = def?.source === 'mcp' && def.metadata?.mcpServerKey && def.metadata.mcpToolName ? { mcpServer: def.metadata.mcpServerKey, tool: def.metadata.mcpToolName } : id;
    onChange(on ? [...value, req] : value.filter((r) => keyOf(r) !== keyOf(req)));
  };
  // requirements that are not tools of this RealmNest (kept, shown, removable)
  const foreign = value.filter((r) => !tools.registry.get(keyOf(r)));
  return (
    <fieldset className="skill-toolpicker">
      <legend>{label}</legend>
      {groups.map(([group, list]) => (
        <div key={group} className="tool-group">
          <span className="tool-group-head">{group}</span>
          <div className="skill-toolpicker-grid">
            {list.map((d) => (
              <label key={d.id} className="tool-check" title={d.description}>
                <input type="checkbox" checked={chosen.has(keyOf(d.source === 'mcp' && d.metadata?.mcpServerKey ? { mcpServer: d.metadata.mcpServerKey, tool: d.metadata.mcpToolName! } : d.id))} onChange={(e) => toggle(d.id, e.target.checked)} />
                <code>{d.metadata?.mcpToolName ?? d.name}</code>
              </label>
            ))}
          </div>
        </div>
      ))}
      {foreign.length > 0 && (
        <ul className="skill-foreign">
          {foreign.map((r) => (
            <li key={keyOf(r)}>
              <code>{requirementLabel(r)}</code>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('s.remove')} title={t('s.remove')} onClick={() => onChange(value.filter((x) => keyOf(x) !== keyOf(r)))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/** capabilities as toggle chips with readable names (the id stays in the tooltip) */
export function CapabilityChips({ value, onChange }: { value: CapabilityId[]; onChange: (v: CapabilityId[]) => void }) {
  const t = useT();
  return (
    <div className="chip-toggles">
      {CAPABILITY_IDS.map((c) => {
        const on = value.includes(c);
        return (
          <button key={c} type="button" className={`chip-toggle ${on ? 'on' : ''}`} aria-pressed={on} title={`${t(`s.capd.${c}` as TKey)} (${c})`} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}>
            {t(`s.cap.${c}` as TKey)}
          </button>
        );
      })}
    </div>
  );
}

type Need = 'none' | 'optional' | 'required';

/** one list of tools, each one not used, optional or required (instead of two pickers) */
export function ToolRequirements({ required, optional, onChange }: { required: ToolRequirement[]; optional: ToolRequirement[]; onChange: (required: ToolRequirement[], optional: ToolRequirement[]) => void }) {
  const t = useT();
  const tools = useTools();
  const keyOf = (r: ToolRequirement) => (typeof r === 'string' ? r : 'id' in r ? r.id : `mcp.${r.mcpServer}.${r.tool}`);
  const reqOf = (id: string): ToolRequirement => {
    const def = tools.registry.get(id);
    return def?.source === 'mcp' && def.metadata?.mcpServerKey && def.metadata.mcpToolName ? { mcpServer: def.metadata.mcpServerKey, tool: def.metadata.mcpToolName } : id;
  };
  const req = new Set(required.map(keyOf));
  const opt = new Set(optional.map(keyOf));
  const groups = groupTools(
    tools.registry.list().filter((d) => d.metadata?.skillOnly !== 'true' && d.metadata?.runScoped !== 'true'),
    t('tools.groupNative'),
  );
  const set = (id: string, need: Need) => {
    const r = reqOf(id);
    const k = keyOf(r);
    const nextReq = required.filter((x) => keyOf(x) !== k);
    const nextOpt = optional.filter((x) => keyOf(x) !== k);
    onChange(need === 'required' ? [...nextReq, r] : nextReq, need === 'optional' ? [...nextOpt, r] : nextOpt);
  };
  const foreign = [...required, ...optional].filter((r) => !tools.registry.get(keyOf(r)));
  const NEEDS: Need[] = ['none', 'optional', 'required'];
  return (
    <div className="tool-reqs">
      {groups.map(([group, list]) => (
        <div key={group} className="tool-reqs-group">
          <span className="tool-group-head">{group}</span>
          <ul>
            {list.map((d) => {
              const k = keyOf(reqOf(d.id));
              const need: Need = req.has(k) ? 'required' : opt.has(k) ? 'optional' : 'none';
              return (
                <li key={d.id} className={need !== 'none' ? 'on' : ''}>
                  <span className="tool-reqs-name">
                    <code>{d.metadata?.mcpToolName ?? d.name}</code>
                    {d.description && <small>{d.description}</small>}
                  </span>
                  <span className="need-switch" role="radiogroup" aria-label={d.metadata?.mcpToolName ?? d.name}>
                    {NEEDS.map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={need === n} className={need === n ? `on ${n}` : ''} onClick={() => set(d.id, n)}>
                        {t(`skills.need.${n}` as TKey)}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {foreign.length > 0 && (
        <ul className="skill-foreign">
          {foreign.map((r) => (
            <li key={keyOf(r)}>
              <code>{requirementLabel(r)}</code>
              <small className="muted">{required.some((x) => keyOf(x) === keyOf(r)) ? t('skills.need.required') : t('skills.need.optional')}</small>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('s.remove')} title={t('s.remove')} onClick={() => onChange(required.filter((x) => keyOf(x) !== keyOf(r)), optional.filter((x) => keyOf(x) !== keyOf(r)))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

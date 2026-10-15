// Which Skills a run uses, by one deterministic rule (docs/SKILLS.md › Precedence):
//
//   1. explicit   the user named them for this message or task (@ or a chip): only those
//   2. assigned   the agent's own Skills (or an older chat's per-chat Skill)
//   3. automatic  RealmNest picks one, only when the message names it outright (mentions.autoSkills)
//   4. none
//
// An explicit choice always wins: nothing else is added to it. An automatic pick that cannot
// run (not ready, no tools on this model…) is dropped quietly; explicit and assigned ones fail
// the run with their reason, before any provider call.

import type { SkillRunRef } from '../../domain/skill';
import type { SkillActivationResult, SkillActivator } from '../live/liveRuntime';
import { autoSkills, type SkillCatalogEntry } from './mentions';

export type SkillActivationMode = NonNullable<SkillRunRef['activation']>;

export interface SkillPick {
  ids: string[];
  mode?: SkillActivationMode;
  /** why an automatic pick was made */
  reason?: string;
}

export function pickSkills(input: { explicit: string[]; assigned: string[]; text: string; catalog: SkillCatalogEntry[]; automatic?: boolean }): SkillPick {
  const known = new Set(input.catalog.map((s) => s.id));
  if (input.explicit.length) return { ids: [...new Set(input.explicit)], mode: 'explicit' };
  const assigned = [...new Set(input.assigned)];
  if (assigned.length) return { ids: assigned, mode: 'assigned' };
  if (input.automatic !== false) {
    const auto = autoSkills(input.text, input.catalog).filter((a) => known.has(a.id));
    if (auto.length) return { ids: auto.map((a) => a.id), mode: 'automatic', reason: auto[0].reason };
  }
  return { ids: [] };
}

/** activate a pick; refs carry their mode. `skipped`: an automatic pick that could not run. */
export function activatePick(
  activator: SkillActivator | undefined,
  pick: SkillPick,
  ctx: Parameters<SkillActivator['activate']>[1],
): { ok: true; active?: Extract<SkillActivationResult, { ok: true }>; skipped?: string } | { ok: false; error: { code: string; message: string; details?: string[] } } {
  if (!pick.ids.length || !activator) return { ok: true };
  const a = activator.activate(pick.ids, ctx);
  if (!a.ok) return pick.mode === 'automatic' ? { ok: true, skipped: a.error.message } : a;
  const refs: SkillRunRef[] = a.refs.map((r) => ({ ...r, ...(pick.mode && { activation: pick.mode }), ...(pick.mode === 'automatic' && pick.reason && { reason: pick.reason }) }));
  return { ok: true, active: { ...a, refs } };
}

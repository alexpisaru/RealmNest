// Character factory: the CharacterSpec every route (a form, an AI designer, a hand-written file)
// should produce. Drawing modules turn it into PhotoCraft tool calls.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { charDir } from '../spec';

export interface Ramp {
  hl: string;
  base: string;
  shade: string;
  deep?: string;
  accent?: string;
}
export interface CharacterSpec {
  id: string;
  name: string;
  role: string;
  /** body template; only "standard" (the RealmNest cast proportions) exists */
  body: 'standard';
  view: 'se';
  outline: string;
  skin: Ramp;
  eyes: string;
  mouth: string;
  hair: { style: string; colors: Ramp };
  outfit: {
    id: string;
    top: { style: string; colors: Ramp };
    shirt: { colors: Ramp };
    trousers: { colors: Ramp };
    shoes: { colors: Ramp };
  };
  accessory?: { style: string; color: string };
  /** alternative outfits: only the pieces given replace the default outfit's */
  outfits?: Record<string, Partial<CharacterSpec['outfit']> & { note?: string }>;
}

export const loadSpec = (id: string) => JSON.parse(readFileSync(join(charDir(id), `${id}.spec.json`), 'utf8')) as CharacterSpec;

/** the spec with an alternative outfit applied */
export function withOutfit(spec: CharacterSpec, outfit: string): CharacterSpec {
  if (outfit === spec.outfit.id) return spec;
  const alt = spec.outfits?.[outfit];
  if (!alt) throw new Error(`${spec.id}: no outfit ${outfit}`);
  const { note: _note, ...pieces } = alt;
  return { ...spec, outfit: { ...spec.outfit, ...pieces, id: outfit } };
}

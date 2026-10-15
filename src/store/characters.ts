// Pure character logic (creation, validation, outfit compatibility). Unit tested.

import { uid } from '../core/rng';
import type { Character, VisualProfile } from '../domain/character';
import { isOutfitCompatible } from '../data/outfits';
import { PRESET_BY_ID, PRESETS } from '../data/presets';
import { WORLD_BY_ID } from '../data/worlds';

export interface CharacterInput {
  name: string;
  role: string;
  visualPresetId: string;
  profile?: Partial<VisualProfile>;
  signature?: string;
  worldId: string;
  outfitId?: string;
  outfitVariant?: string;
  notes?: string;
}

export class ValidationError extends Error {}

export function validateInput(i: CharacterInput) {
  if (!i.name.trim()) throw new ValidationError('Name is required');
  if (i.name.trim().length > 40) throw new ValidationError('Name is too long (max 40)');
  if (i.role.trim().length > 60) throw new ValidationError('Role is too long (max 60)');
  if (!WORLD_BY_ID[i.worldId]) throw new ValidationError(`Unknown world "${i.worldId}"`);
}

/** Pick a compatible outfit: the requested one if it fits the world, else the world default. */
export function resolveOutfit(worldId: string, outfitId?: string, body?: string) {
  const w = WORLD_BY_ID[worldId];
  if (outfitId && isOutfitCompatible(outfitId, w.outfitCategory, body)) return outfitId;
  return w.defaultOutfitId;
}

export function createCharacter(i: CharacterInput, now = Date.now()): Character {
  validateInput(i);
  const preset = PRESET_BY_ID[i.visualPresetId] ?? PRESETS[0];
  const profile: VisualProfile = { ...preset.profile, ...(i.profile ?? {}) };
  return {
    id: uid('chr'),
    name: i.name.trim(),
    role: i.role.trim() || 'Crew member',
    visualPresetId: preset.id,
    profile,
    signature: i.signature ?? preset.signature,
    worldId: i.worldId,
    outfitId: resolveOutfit(i.worldId, i.outfitId, profile.body),
    outfitVariant: i.outfitVariant,
    metadata: { createdAt: now, updatedAt: now, founder: !!preset.founderPreset, notes: i.notes },
  };
}

export function duplicate(c: Character, now = Date.now()): Character {
  return {
    ...structuredClone(c),
    id: uid('chr'),
    name: `${c.name} (copy)`.slice(0, 40),
    metadata: { ...c.metadata, createdAt: now, updatedAt: now, founder: false },
  };
}

/** Moving to another world keeps the outfit only if it belongs to that world's collection. */
/** Another world: remember what it wore here, wear what it last wore there (or that world's default). */
export function moveToWorld(c: Character, worldId: string): Character {
  const worldOutfits = { ...c.worldOutfits, [c.worldId]: { outfitId: c.outfitId, ...(c.outfitVariant && { outfitVariant: c.outfitVariant }) } };
  const back = worldOutfits[worldId];
  const outfitId = resolveOutfit(worldId, back?.outfitId ?? c.outfitId, c.profile.body);
  const outfitVariant = back && back.outfitId === outfitId ? back.outfitVariant : undefined;
  const { outfitVariant: _old, ...rest } = c;
  return { ...rest, worldId, outfitId, ...(outfitVariant && { outfitVariant }), worldOutfits, metadata: { ...c.metadata, updatedAt: Date.now() } };
}

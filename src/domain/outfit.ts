// ─────────────────────────────────────────────────────────────
// OUTFIT = layered clothing, independent of any character.
// Rendered on top of the base body at runtime (sprite composition).
// ─────────────────────────────────────────────────────────────

import type { BodyType } from './character';

/** Which collection the outfit belongs to: a world id, or 'universal'. */
export type OutfitCategory = string;

export type Headgear =
  | 'hardhat'
  | 'strawhat'
  | 'cap'
  | 'hairnet'
  | 'headset'
  | 'beanie'
  | 'goggles'
  | 'bandana'
  | 'beret'
  | 'visor'
  | 'raincap';

/** A colour, or 'signature' to use the wearer's signature colour. */
export type Paint = string;

/** The clothing layers the sprite composer knows how to draw. */
export interface OutfitLayers {
  top: Paint;
  pants: Paint;
  shoes: Paint;
  neck?: 'collar' | 'tie' | 'hood' | 'turtle' | 'ring' | 'vneck' | 'scarf' | 'henley';
  neckColor?: Paint;
  coat?: Paint;
  longCoat?: boolean;
  overalls?: Paint;
  vest?: { color: Paint; stripe: Paint };
  apron?: Paint;
  skirt?: Paint;
  stripe?: Paint; // horizontal band across the top
  suspenders?: Paint;
  belt?: Paint;
  boots?: Paint;
  headgear?: Headgear;
  headgearColor?: Paint;
  gloves?: Paint;
  badge?: Paint;
  patch?: Paint;
  // ── details drawn by the 64×96 characters (older composers ignore them) ──
  /** sleeves rolled up to the forearm with a turn-up in the top's colour */
  rolledSleeves?: boolean;
  /** short sleeves (ignored under a coat) */
  shortSleeves?: boolean;
  /** buttons down the coat's opening and on its pockets */
  buttons?: Paint;
  /** chest pockets on the coat */
  pockets?: boolean;
  /** the belt buckle */
  buckle?: Paint;
  /** a crossbody strap with a ring and a hip pouch */
  strap?: Paint;
  /** loose cargo trousers bunched over the boots, thigh pockets */
  cargo?: boolean;
  /** boot / shoe laces */
  laces?: Paint;
}

export interface OutfitVariant {
  id: string;
  name: string;
  /** layer overrides */
  layers: Partial<OutfitLayers>;
}

export interface OutfitDef {
  id: string;
  worldCategory: OutfitCategory;
  name: string;
  description?: string;
  layers: OutfitLayers;
  variants?: OutfitVariant[];
  /** undefined = every body type */
  compatibleCharacterTypes?: BodyType[];
  /**
   * Optional hand-drawn assets that replace the procedural layer later
   * (see src/assets/README.md). Empty in this beta.
   */
  spriteAssets?: { sheet?: string };
}

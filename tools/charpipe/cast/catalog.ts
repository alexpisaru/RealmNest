// Cast factory: what an asset is. Every hair style, garment piece, headgear and accessory is an
// AssetDef: drawn once per body (from its masks), animated band by band, recoloured at runtime.
import type { BodyGeometry } from './body';
import type { Piece } from './draw';

/**
 * Compositing order inside a band, back to front. Within the torso band, for example, the body
 * is under the trousers' waist, the top over them, a belt over the top, a coat over the belt.
 */
export const SLOTS = [
  'body',
  'shoes',
  'pants',
  'top',
  'skirt',
  'stripe',
  'overalls',
  // over the trousers' (and the overalls') legs: tucked in
  'boots',
  'suspenders',
  'strap',
  'belt',
  'vest',
  'apron',
  'coat',
  'neck',
  'badge',
  'patch',
  'gloves',
  'face',
  'hair',
  'glasses',
  'headgear',
  'accessory',
] as const;
export type Slot = (typeof SLOTS)[number];

/** slots whose outline follows only the outer edge (holes stay clear: lenses, a hoop) */
export const EXTERIOR_ONLY: Slot[] = ['glasses', 'headgear', 'accessory', 'face'];
/**
 * Drawn with no outline at all, by slot or asset id: a thin frame is its own line (Maya's
 * glasses); freckles and stubble are marks on the skin, not shapes.
 */
export const NO_OUTLINE: string[] = ['glasses', 'face:freckles', 'face:stubble'];
export const outlined = (asset: string, slot: string) => !NO_OUTLINE.includes(slot) && !NO_OUTLINE.includes(asset);

/** recolourable materials (palette.ts CANON); anything else an asset uses is a fixed colour */
export type Material = 'skin' | 'hair' | 'eyes' | 'main' | 'second' | 'accent' | 'metal';

export interface AssetDef {
  id: string;
  slot: Slot;
  label: string;
  /** the materials the art uses, in the order a picker offers them (the first is the asset's colour) */
  materials: Material[];
  pieces(g: BodyGeometry): Piece[];
}

/** asset ids are `<family>:<name>`; pieces carry the asset id */
export const asset = (def: Omit<AssetDef, 'pieces'> & { pieces: (g: BodyGeometry, id: string) => Piece[] }): AssetDef => ({
  ...def,
  pieces: (g) => def.pieces(g, def.id).map((p) => ({ ...p, asset: def.id })),
});

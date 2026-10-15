// ─────────────────────────────────────────────────────────────
// World packs: every world at 128×64 owns its art. A pack holds the
// world's props (furniture, machines, scenery, buildings), its floor
// and outdoor ground shaders, its back walls with their wall props, and
// its floor patches (rugs, lanes…). Packs never share assets: a desk in
// the Office and a desk in the Data Center are two different drawings.
// Primitives (kit4, materials4, plane4) are shared; designs are not.
// ─────────────────────────────────────────────────────────────

import type { FloorPatch, MaterialId, WallPropPlacement, WorldDef, WorldTheme } from '../../../domain/world';
import type { Painter, PropPainter } from '../../iso';
import type { PropArt } from '../../props';
import type { CritterArt } from '../animals';

/**
 * Per-pixel context for a ground shader (solved per border cell by the bake).
 * near: 0 touching another material, 1 close to one, 2 none · other: that material
 * nA: broad tone noise · nB: patch noise · nC: very broad noise · depth: water depth.
 */
export interface FloorCell {
  near: number;
  other: MaterialId | null;
  nA: number;
  nB: number;
  nC: number;
  depth: number;
  og: boolean;
  ow: boolean;
}

/**
 * Ground shader at 128×64: (x, y) tile coordinates (continuous), (px, py) frame
 * pixels. Returns a packed 0xRRGGBB colour.
 */
export type Floor4 = (x: number, y: number, px: number, py: number, e: FloorCell) => number;

export interface WallCtx4 {
  /** placement on the wall (tiles along the wall) */
  wp: WallPropPlacement;
  th: WorldTheme;
  t: number;
  seed: number;
}

/** A wall prop drawn on a room's back wall: static part, optional live part. */
export interface WallArt4 {
  draw: (p: PropPainter, side: 'ne' | 'nw', k: WallCtx4) => void;
  anim?: (p: PropPainter, side: 'ne' | 'nw', k: WallCtx4) => void;
}

export interface WallPack {
  /** wall height in base units (z), default 64 */
  height?: number;
  /** the bare wall (both sides call this once each), before its wall props */
  draw: (p: PropPainter, side: 'ne' | 'nw', w: WorldDef) => void;
  /** wall props by type */
  art: Record<string, WallArt4>;
}

export interface WorldPack {
  props: Record<string, PropArt>;
  /** ground shaders by material (override the shared ones for this world) */
  floors?: Partial<Record<MaterialId, Floor4>>;
  /** materials whose borders stay ruler-straight (floors, kerbs, roads) */
  crisp?: MaterialId[];
  walls?: WallPack;
  /** floor patches (rugs, lanes, test pads…) painted into the ground */
  patch?: (P: Painter, s: FloorPatch, w: WorldDef) => void;
  /** this world's own ambient life (kinds used in scene.critters) */
  critters?: Record<string, CritterArt>;
  /**
   * Repeated scenery that may share sprites: type → number of variations
   * (e.g. { fac_birch: 6 }). Instances of a shared type reuse one of N
   * rasterised sprites instead of each being drawn — much faster builds.
   */
  reuse?: Record<string, number>;
  /**
   * The ground bake's shared post effects: drifting cloud shadows (never on the
   * floor inside a room with walls) and a dark wet bank on land next to water.
   * Both default to on; a world turns off what does not belong to its place
   * (no clouds in orbit) or what it shades itself.
   */
  groundFx?: { clouds?: boolean; bank?: boolean };
}

/** Packed colour helpers for floor shaders. */
export const rgb = (hex: string) => parseInt(hex.slice(1), 16);
export const pal = (...hex: string[]) => hex.map(rgb);

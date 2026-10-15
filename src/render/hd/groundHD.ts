// ─────────────────────────────────────────────────────────────
// HD ground (64×32 tiles) — the Farm vertical slice.
//
// • Organic borders: the material lookup is domain-warped, so paths,
//   ponds and beds get irregular natural edges instead of tile steps.
// • Grass is built from tufts (dark roots, lit tips) in screen space,
//   clover and small flower patches; never plain noise.
// • Flagstones are irregular (Voronoi) with grout, bevels and moss.
// • Edge bands: damp darker dirt along grass, grass blades overhanging
//   paths, wet banks and a shallow rim around water.
// Every tone comes from a 5–6 step ramp with ordered dithering.
//
// Performance: materials, edges and the slow noise fields are solved once
// per border cell (1/16 tile ≈ 4 px); the pixel pass only hashes.
// ─────────────────────────────────────────────────────────────

import type { MaterialId, WorldDef } from '../../domain/world';
import type { Floor4, WorldPack } from '../hd4/packs/types';
import { dith, h2, pack, type Packed, SHADERS, vnoise } from '../materials';

const pal = (...hex: string[]) => hex.map(pack);

const GRASS = pal('#3d6e2e', '#4b8235', '#5a953c', '#6aa843', '#7fbb4c', '#9ccd5c');
const FOREST = pal('#2c4e24', '#355a29', '#3f662e', '#4a7334', '#57813a', '#668f42');
const LITTER = pal('#6a5430', '#7c6236', '#8e7040');
const MEADOW = pal('#476f2c', '#557f33', '#64903a', '#75a242', '#89b34c', '#a4c75a');
const DIRT = pal('#6e4a30', '#83593a', '#9a6b45', '#ad7d52', '#c0905f', '#d2a771');
const STONE = pal('#7d5a48', '#95694f', '#ad7c5c', '#c08d68', '#d0a07a', '#ddb58e');
const STONE_COOL = pal('#7a6a5e', '#917e70', '#a69282', '#b9a694', '#cab8a4');
const GROUT = pal('#4a3428', '#56402f');
const SOIL = pal('#2f1d14', '#3f281b', '#523422', '#64412a', '#775034', '#8a6040');
const WATER = pal('#1b4a72', '#215c88', '#2a729d', '#3889b2', '#4fa1c4', '#78bfd6');
const FOAM = pal('#8fd0dc', '#b8e6ea');
const GRAVEL = pal('#7b7064', '#91857a', '#a69a8d', '#bbb0a2', '#cfc5b8');
const FLOWERS = pal('#fbf4e4', '#f6d860', '#ef9ac0', '#c49cf2', '#ffffff', '#f08a5a');
const SHADE = 0x2a1a2a;
const BANK = 0x2e3a24;

const clampI = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);
const q = (v: number, n: number, px: number, py: number) => clampI(Math.floor(v * n + dith(px, py) - 0.5), n);

function mixPacked(c: Packed, t: Packed, a: number): Packed {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return (Math.round(r + (((t >> 16) & 255) - r) * a) << 16) | (Math.round(g + (((t >> 8) & 255) - g) * a) << 8) | Math.round(b + ((t & 255) - b) * a);
}

const SOFT = new Set<MaterialId>(['grass', 'meadow', 'dirt', 'soil', 'gravel', 'water', 'sand', 'forest']);
const GREEN = new Set<MaterialId>(['grass', 'meadow', 'forest']);

/**
 * Per-pixel context, solved per border cell.
 * near: 0 = touching another material, 1 = close to one, 2 = none.
 * nA: macro tone noise, nB: patch noise (flowers / streaks / crests).
 */
interface Cell {
  near: number;
  other: MaterialId | null;
  nA: number;
  nB: number;
  /** 128×64: broad warm / cool grass patches */
  nC: number;
  depth: number;
  /** the other material is grass-like / water */
  og: boolean;
  ow: boolean;
}

// ── shaders ─────────────────────────────────────────────────

function grass(P: Packed[], px: number, py: number, seed: number, flowers: number, e: Cell): Packed {
  let i = 1 + q(e.nA * 0.85 + 0.1, 4, px, py);
  // tufts: cells of 8×6 screen px, each with 3 blades
  const cx = Math.floor(px / 8);
  const cy = Math.floor(py / 6);
  const tx = cx * 8 + 2 + Math.floor(h2(cx, cy, seed + 2) * 4);
  const ty = cy * 6 + 4 + Math.floor(h2(cx, cy, seed + 3) * 2);
  const dx = px - tx;
  const dy = ty - py;
  if (dy >= 0 && dy <= 4 && dx >= -3 && dx <= 3 && h2(cx, cy, seed + 4) < 0.78) {
    for (const b of [-2, 0, 2]) {
      const hgt = 2 + Math.floor(h2(cx * 3 + b, cy, seed + 5) * 3);
      const lean = dy >= hgt - 1 ? Math.sign(b) : 0;
      if (dx === b + lean && dy < hgt) {
        if (dy === 0) return P[clampI(i - 2, P.length)];
        return P[clampI(i + (dy >= hgt - 1 ? 2 : 1), P.length)];
      }
    }
  }
  // clover / flowers in clustered patches
  if (flowers > 0 && e.nB > 0.62) {
    const fx = Math.floor(px / 5);
    const fy = Math.floor(py / 4);
    if (h2(fx, fy, seed + 7) < flowers) {
      const ox = fx * 5 + 2;
      const oy = fy * 4 + 2;
      if ((px === ox && Math.abs(py - oy) <= 1) || (py === oy && Math.abs(px - ox) <= 1)) return px === ox && py === oy ? FLOWERS[1] : FLOWERS[Math.floor(h2(fx, fy, seed + 8) * FLOWERS.length)];
    }
  }
  // grass overhanging a path or bed edge: darker blades along the border
  if (e.near === 0 && e.other !== 'water' && ((px + py * 3) & 3) !== 0) i = clampI(i - 1, P.length);
  const g = h2(px, py, seed + 9);
  if (g < 0.03) i = clampI(i - 1, P.length);
  else if (g > 0.985) i = clampI(i + 1, P.length);
  return P[i];
}

function dirt(px: number, py: number, e: Cell): Packed {
  let i = 1 + q(e.nA * 0.75 + 0.12, 4, px, py);
  // pebbles: cells 9×7, a small stone with a lit top and dark underside
  const cx = Math.floor(px / 9);
  const cy = Math.floor(py / 7);
  if (h2(cx, cy, 61) < 0.3) {
    const ox = cx * 9 + 2 + Math.floor(h2(cx, cy, 62) * 5);
    const oy = cy * 7 + 2 + Math.floor(h2(cx, cy, 63) * 3);
    const w = 2 + (h2(cx, cy, 64) > 0.6 ? 1 : 0);
    if (py === oy && px >= ox && px < ox + w) return DIRT[5];
    if (py === oy + 1 && px >= ox && px < ox + w) return DIRT[1];
  }
  // worn darker patches
  if (e.nB > 0.7 && dith(px, py) > 0.4) i--;
  // damp dark edge where grass begins, with blades poking in
  if (e.near === 0 && e.other && GREEN.has(e.other)) {
    i -= 1;
    if ((px * 7 + py * 3) % 5 === 0) return GRASS[2];
  } else if (e.near === 1 && dith(px, py) > 0.5) i -= 1;
  const g = h2(px, py, 66);
  if (g < 0.02) i -= 2;
  else if (g > 0.985) i += 1;
  return DIRT[clampI(i, DIRT.length)];
}

/** Irregular flagstones: Voronoi cells in tile space, ~2.4 stones per tile edge. */
function flagstones(x: number, y: number, px: number, py: number, e: Cell): Packed {
  const S = 2.4;
  const X = x * S;
  const Y = y * S;
  const ix = Math.floor(X);
  const iy = Math.floor(Y);
  let f1 = 9;
  let f2 = 9;
  let cid = 0;
  let ccx = 0;
  let ccy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = ix + i;
      const gy = iy + j;
      const fx = gx + 0.15 + h2(gx, gy, 71) * 0.7;
      const fy = gy + 0.15 + h2(gx, gy, 72) * 0.7;
      const d = Math.hypot(X - fx, Y - fy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cid = gx * 7919 + gy * 104729;
        ccx = fx;
        ccy = fy;
      } else if (d < f2) f2 = d;
    }
  const gap = f2 - f1;
  if (gap < (BIG ? 0.05 : 0.075)) {
    // joints: grout, moss in the damp corners
    if (e.nB > 0.76) return GRASS[((px + py) & 1) + (e.nB > 0.84 ? 2 : 1)];
    return GROUT[(px + py) & 1];
  }
  const R = h2(cid, 1, 74) < 0.1 ? STONE_COOL : STONE;
  let i = 1 + Math.floor(h2(cid, 2, 75) * 3);
  // bevel: lit toward the upper left (−x in tile space), shaded toward +x / +y
  if (gap < (BIG ? 0.11 : 0.16)) i += X - ccx + (Y - ccy) * 0.3 < 0 ? 1 : -1;
  if (BIG && h2(cid, 3, 78) < 0.3 && h2(px >> 1, py >> 1, 79) < 0.06) i -= 1; // pitting
  if (e.nA > 0.68 && dith(px, py) > 0.5) i -= 1; // worn patches
  const g = h2(px, py, 77);
  if (g < 0.04) i -= 1;
  else if (g > 0.99) i += 1;
  return R[clampI(i, R.length)];
}

/** The Farm courtyard at 128×64 (worlds without a pack): rounded cobbles in loose rows. */
let COBBLES = false;
function cobbles(x: number, y: number, px: number, py: number, e: Cell): Packed {
  const S = 4.4;
  const X = x * S;
  const Y = y * S;
  const ix = Math.floor(X);
  const iy = Math.floor(Y);
  let f1 = 9;
  let f2 = 9;
  let cid = 0;
  let ccx = 0;
  let ccy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = ix + i;
      const gy = iy + j;
      // rows offset by half a stone with a little jitter: laid cobbles, not crazy paving
      const fx = gx + 0.5 + (gy & 1 ? 0.25 : -0.25) + (h2(gx, gy, 81) - 0.5) * 0.3;
      const fy = gy + 0.5 + (h2(gx, gy, 82) - 0.5) * 0.3;
      const d = Math.hypot(X - fx, (Y - fy) * 1.1);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cid = gx * 7919 + gy * 104729;
        ccx = fx;
        ccy = fy;
      } else if (d < f2) f2 = d;
    }
  const gap = f2 - f1;
  // joints between stones and in the corners their round edges leave; moss in the damp ones
  if (gap < 0.11 || f1 > 0.56) {
    if (e.nB > 0.74) return GRASS[((px + py) & 1) + (e.nB > 0.84 ? 2 : 1)];
    return GROUT[(px + py) & 1];
  }
  const R = h2(cid, 1, 74) < 0.12 ? STONE_COOL : STONE;
  let i = 3 + Math.floor(h2(cid, 2, 75) * 2.6);
  // domed tops: lit toward the upper left, a shaded rim on the lower right
  const lx = X - ccx;
  const ly = Y - ccy;
  if (f1 > 0.38 || gap < 0.2) i += lx + ly * 0.5 < 0 ? 1 : -1;
  else if (lx + ly < -0.15) i += 1;
  if (e.nA > 0.7 && dith(px, py) > 0.5) i -= 1;
  const g = h2(px, py, 77);
  if (g < 0.03) i -= 1;
  else if (g > 0.99) i += 1;
  return R[clampI(i, R.length)];
}

function soil(y: number, px: number, py: number, e: Cell): Packed {
  const f = (y * 4) % 1;
  let i = 2 + q(e.nA * 0.6 + 0.2, 2, px, py);
  if (f < 0.28) i = 1; // furrow shadow
  else if (f > 0.62 && f < 0.8) i += 1; // lit ridge
  // clods
  const cx = Math.floor(px / 6);
  const cy = Math.floor(py / 4);
  if (h2(cx, cy, 17) < 0.25) {
    const ox = cx * 6 + 2;
    const oy = cy * 4 + 1;
    if (py === oy && (px === ox || px === ox + 1)) i = 5;
    if (py === oy + 1 && (px === ox || px === ox + 1)) i = 1;
  }
  if (e.near === 0) i -= 1;
  if (h2(px, py, 18) < 0.03) i -= 1;
  return SOIL[clampI(i, SOIL.length)];
}

function water(px: number, py: number, e: Cell): Packed {
  if (e.near === 0) return FOAM[(px + py) & 1 ? 0 : 1];
  if (e.near === 1) return WATER[5 - ((px + py) & 1)];
  let i = 5 - (2 + q(Math.min(1, e.depth) * 0.9 + e.nA * 0.25, 3, px, py)); // deeper → darker
  // crests: short horizontal dashes
  if (e.nB > 0.8 && (BIG ? ((px >> 2) + (py >> 3)) % 4 !== 0 : ((px >> 1) + (py >> 2)) % 4 !== 0)) i = 5;
  else if (e.nB > 0.72) i = Math.min(4, i + 1);
  return WATER[clampI(i, WATER.length)];
}

function gravel(px: number, py: number, e: Cell): Packed {
  let i = 1 + q(e.nA * 0.6 + 0.2, 3, px, py);
  const cx = Math.floor(px / 3);
  const cy = Math.floor(py / 2);
  if (h2(cx, cy, 91) < 0.35) i = py === cy * 2 ? 4 : 1;
  return GRAVEL[clampI(i, GRAVEL.length)];
}

// ── 128×64 painting ─────────────────────────────────────────
// Twice the pixel density, so the ground is painted with marks instead of
// dithered noise: short grass blades with a shadow on their right, V-shaped
// tufts with dark roots and sunlit tips, clover and five-pixel blossoms in
// patches, pebbles with a lit top and a dark underside, grit and bleached
// crowns on paths, blades creeping over the verges, and broad warm / cool
// patches of grass whose borders follow the blades.
//
// Performance: marks live on small hash grids. Each grid is solved once per
// cell and cached per band of rows (the bake paints top to bottom); before a
// row is shaded its marks are rasterised into row buffers, so the pixel loop
// only reads arrays. The material skeleton is solved per 2×2 block.

const GRASS_WARM = pal('#4a6e2c', '#5a8234', '#6c953a', '#7fa742', '#95b84c', '#b3ca5e');
const GRASS_COOL = pal('#356a33', '#417d3b', '#4e9043', '#5ca34c', '#70b558', '#8cc86a');
const MEADOW_WARM = pal('#56702c', '#668233', '#779339', '#8aa541', '#9fb54a', '#bac85a');
const MEADOW_COOL = pal('#3e6c30', '#4a7c37', '#578d3f', '#669f48', '#79b052', '#93c362');
const BLOSSOM = [FLOWERS[0], FLOWERS[2], FLOWERS[3], FLOWERS[4], FLOWERS[0], FLOWERS[5]];

/** 128×64 bake in progress (flagstones and water adapt their marks) */
let BIG = false;

// material codes
const M_GRASS = 0;
const M_MEADOW = 1;
const M_FOREST = 2;
const M_DIRT = 3;
const M_PAVING = 4;
const M_SOIL = 5;
const M_WATER = 6;
const M_GRAVEL = 7;
const M_OTHER = 8;
const MCODE: Partial<Record<MaterialId, number>> = { grass: M_GRASS, meadow: M_MEADOW, forest: M_FOREST, dirt: M_DIRT, paving: M_PAVING, soil: M_SOIL, water: M_WATER, gravel: M_GRAVEL };
/** tuft and blossom density per grass family (grass, meadow, forest) */
const TUFTS = [0.32, 0.5, 0.42];
const BLOOMS = [0.08, 0.2, 0.02];

/**
 * Grass mark codes (row buffer): tone offsets from the local base tone, or a fixed colour.
 *  1 tuft root · 2 left blade · 3 left tip · 4 right blade · 5 right tip ·
 *  6 short blade · 7 its tip · 8 shadow / stem · 9 lit clover leaf · 10 clover ·
 *  12 / 13 blossom centre · 14–19 petals
 */
const MK_OFF = [0, -2, 1, 3, 0, 2, 1, 2, -1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MK_ABS = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, FLOWERS[1], FLOWERS[4], ...BLOSSOM];

/** The cell grid of a bake, shared with the mark grids (activity is decided at each mark's root). */
interface Grid4 {
  W: number;
  H: number;
  ox: number;
  oy: number;
  ty8: number;
  tx16: number;
  tx0: number;
  ty0: number;
  G: number;
  gw: number;
  gh: number;
  OUT: number;
  outerId: number;
  waterId: number;
  mat: Uint8Array;
  near: Uint8Array;
  other: Uint8Array;
  nA: Float32Array;
  nB: Float32Array;
  nC: Float32Array;
  cloud: Float32Array;
  depth: Float32Array;
  ids: MaterialId[];
  codeOf: Uint8Array;
  green: Uint8Array;
  idFor: (m: MaterialId) => number;
  warped: (x: number, y: number, fine: boolean) => MaterialId;
  at: (ix: number, iy: number) => MaterialId;
  /** this world's own shader for a material id, if its pack has one */
  customOf: (id: number) => Floor4 | undefined;
  /** post effects: cloud shadows, wet banks; `roofed` keeps clouds off a walled room's floor (0..cols × 0..rows) */
  clouds: boolean;
  bank: boolean;
  roofed: boolean;
  cols: number;
  rows: number;
}

/** Cell index under a frame pixel (−1 off the grid). */
function cellAtPx(g: Grid4, px: number, py: number): number {
  const Y = (py + 0.5 - g.oy) / g.ty8;
  const X = (px + 0.5 - g.ox) / g.tx16;
  const ci = Math.floor(((Y + X) * 0.5 - g.tx0) * g.G);
  const cj = Math.floor(((Y - X) * 0.5 - g.ty0) * g.G);
  return ci < 0 || cj < 0 || ci >= g.gw || cj >= g.gh ? -1 : cj * g.gw + ci;
}
/** Grass family (0 grass, 1 meadow, 2 forest, else ≥ 3) and the patch noise under a pixel. */
function familyAt(g: Grid4, px: number, py: number): [number, number, number] {
  const ci = cellAtPx(g, px, py);
  const id = ci < 0 || g.mat[ci] === g.OUT ? g.outerId : g.mat[ci];
  return [g.codeOf[id], ci < 0 ? 0 : g.nB[ci], ci < 0 ? 2 : g.near[ci]];
}

class Field {
  band = -1;
  readonly done: Uint8Array;
  constructor(W: number, cw: number) {
    this.done = new Uint8Array(Math.ceil(W / cw) + 3);
  }
}

// short blades: 5×4 px cells (odd rows staggered by 2 px), one 2–4 px stroke each
let SB = new Field(0, 5);
let sbOn = new Uint8Array(0);
let sbLit = new Uint8Array(0);
let sbX = new Int32Array(0);
let sbTop = new Int32Array(0);
let sbBot = new Int32Array(0);
let sbJ = new Float32Array(0);
// tufts: 16×10 px cells, three or five blades, pre-painted into 13×9 masks
let TU = new Field(0, 16);
let tuOn = new Uint8Array(0);
let tuX = new Int32Array(0);
let tuY = new Int32Array(0);
let tuM = new Uint8Array(0);
// clover and blossoms: 10×8 px cells
let CL = new Field(0, 10);
let clK = new Uint8Array(0);
let clX = new Int32Array(0);
let clY = new Int32Array(0);
let clC = new Uint8Array(0);
// pebbles on paths: 16×10 px cells
let PB = new Field(0, 16);
let pbOn = new Uint8Array(0);
let pbX = new Int32Array(0);
let pbY = new Int32Array(0);
let pbW = new Uint8Array(0);
let pbC = new Uint8Array(0);

function initFields(W: number) {
  SB = new Field(W, 5);
  const ns = SB.done.length;
  sbOn = new Uint8Array(ns);
  sbLit = new Uint8Array(ns);
  sbX = new Int32Array(ns);
  sbTop = new Int32Array(ns);
  sbBot = new Int32Array(ns);
  sbJ = new Float32Array(ns);
  TU = new Field(W, 16);
  const nt = TU.done.length;
  tuOn = new Uint8Array(nt);
  tuX = new Int32Array(nt);
  tuY = new Int32Array(nt);
  tuM = new Uint8Array(nt * 117);
  CL = new Field(W, 10);
  const nc = CL.done.length;
  clK = new Uint8Array(nc);
  clX = new Int32Array(nc);
  clY = new Int32Array(nc);
  clC = new Uint8Array(nc);
  PB = new Field(W, 16);
  const np = PB.done.length;
  pbOn = new Uint8Array(np);
  pbX = new Int32Array(np);
  pbY = new Int32Array(np);
  pbW = new Uint8Array(np);
  pbC = new Uint8Array(np);
}

function sbFill(cx: number, cy: number, off: number) {
  SB.done[cx] = 1;
  sbOn[cx] = h2(cx, cy, 501) < 0.74 ? 1 : 0;
  sbX[cx] = cx * 5 - off + Math.floor(h2(cx, cy, 502) * 4);
  const bot = cy * 4 + 3 - (h2(cx, cy, 503) < 0.3 ? 1 : 0);
  sbBot[cx] = bot;
  sbTop[cx] = bot - 1 - Math.floor(h2(cx, cy, 504) * 2.6);
  sbLit[cx] = h2(cx, cy, 505) < 0.6 ? 1 : 0;
  sbJ[cx] = h2(cx, cy, 506) - 0.5;
}

function tuFill(g: Grid4, cx: number, cy: number) {
  TU.done[cx] = 1;
  const x = cx * 16 + 6 + Math.floor(h2(cx, cy, 512) * 4);
  const y = cy * 10 + 9 - (h2(cx, cy, 513) < 0.5 ? 1 : 0);
  tuX[cx] = x;
  tuY[cx] = y;
  // only where the root stands on grass-like ground, denser in lush patches
  const [fam, nb] = familyAt(g, x, y);
  tuOn[cx] = fam <= M_FOREST && h2(cx, cy, 511) < TUFTS[fam] * (0.55 + nb * 0.9) ? 1 : 0;
  if (!tuOn[cx]) return;
  // paint the tuft into its 13×9 mask: a dark root clump, blades leaning outward
  const n = h2(cx, cy, 514) < 0.55 ? 5 : 3;
  const base = cx * 117;
  tuM.fill(0, base, base + 117);
  for (let d = 1 - n; d <= n - 1; d++) tuM[base + d + 6] = 1;
  for (let b = 0; b < n; b++) {
    const off = 2 * b - (n - 1);
    const hgt = 4 + Math.floor(h2(cx * 5 + b, cy, 515) * 4) + (Math.abs(off) <= 2 ? 1 : 0);
    for (let dy = 1; dy < hgt; dy++) {
      const lean = dy * 2 >= hgt ? (off < 0 ? -1 : off > 0 ? 1 : 0) * (dy >= hgt - 1 ? 2 : 1) : 0;
      const tip = dy >= hgt - 2;
      tuM[base + dy * 13 + off + lean + 6] = off <= 0 ? (tip ? 3 : 2) : tip ? 5 : 4;
    }
  }
}

function clFill(g: Grid4, cx: number, cy: number) {
  CL.done[cx] = 1;
  const x = cx * 10 + 2 + Math.floor(h2(cx, cy, 522) * 6);
  const y = cy * 8 + 2 + Math.floor(h2(cx, cy, 523) * 3);
  clX[cx] = x;
  clY[cx] = y;
  clC[cx] = Math.floor(h2(cx, cy, 524) * BLOSSOM.length);
  // in patches only: 1 = a blossom, 2 = a clover sprig
  const [fam, nb] = familyAt(g, x, y);
  const r = h2(cx, cy, 521);
  clK[cx] = fam <= M_FOREST && nb > 0.55 ? (r < BLOOMS[fam] ? 1 : r < BLOOMS[fam] + 0.3 ? 2 : 0) : 0;
}

function pbFill(g: Grid4, cx: number, cy: number) {
  PB.done[cx] = 1;
  const w = 3 + Math.floor(h2(cx, cy, 532) * 4);
  pbW[cx] = w;
  pbX[cx] = cx * 16 + 1 + Math.floor(h2(cx, cy, 533) * (14 - w));
  pbY[cx] = cy * 10 + 1 + Math.floor(h2(cx, cy, 534) * 6);
  pbC[cx] = h2(cx, cy, 535) < 0.5 ? 8 : 0;
  // thicker toward the verges
  const [, , nr] = familyAt(g, pbX[cx] + (w >> 1), pbY[cx] + 1);
  pbOn[cx] = h2(cx, cy, 531) < (nr <= 1 ? 0.5 : 0.18) ? 1 : 0;
}

/** Rasterise the marks of one pixel row into the row buffers. */
function rowMarks(g: Grid4, py: number, mk: Uint8Array, pk: Uint8Array) {
  const W = g.W;
  mk.fill(0);
  pk.fill(0);
  // short blades (their cells also carry the jitter that breaks up tone borders)
  {
    const cy = py >> 2;
    if (cy !== SB.band) {
      SB.band = cy;
      SB.done.fill(0);
    }
    const off = (cy & 1) << 1;
    const n = Math.ceil((W + off) / 5);
    for (let cx = 0; cx < n; cx++) {
      if (!SB.done[cx]) sbFill(cx, cy, off);
      if (sbOn[cx] && py >= sbTop[cx] && py <= sbBot[cx]) {
        const sx = sbX[cx];
        if (sbLit[cx]) {
          mk[sx] = py === sbTop[cx] ? 7 : 6;
          if (py >= sbBot[cx] - 1) mk[sx + 1] = 8;
        } else mk[sx] = 8;
      }
    }
  }
  // clover and blossoms
  {
    const cy = py >> 3;
    if (cy !== CL.band) {
      CL.band = cy;
      CL.done.fill(0);
    }
    const n = Math.ceil(W / 10);
    for (let cx = 0; cx < n; cx++) {
      if (!CL.done[cx]) clFill(g, cx, cy);
      const kind = clK[cx];
      if (!kind) continue;
      const dy = py - clY[cx];
      if (dy < -1 || dy > 2) continue;
      const x = clX[cx];
      if (kind === 1) {
        const c = clC[cx];
        if (dy === -1) mk[x] = 14 + c;
        else if (dy === 0) {
          mk[x - 1] = 14 + c;
          mk[x] = c === 5 ? 13 : 12;
          mk[x + 1] = 14 + c;
        } else mk[x] = 8;
      } else if (dy === -1) mk[x] = 9;
      else if (dy === 0) {
        mk[x - 1] = 9;
        mk[x] = 10;
        mk[x + 1] = 10;
      } else if (dy === 1) mk[x] = 8;
    }
  }
  // tufts (drawn last among the grass marks: they sit on top)
  {
    const cy = (py / 10) | 0;
    if (cy !== TU.band) {
      TU.band = cy;
      TU.done.fill(0);
    }
    const n = Math.ceil(W / 16);
    for (let cx = 0; cx < n; cx++) {
      if (!TU.done[cx]) tuFill(g, cx, cy);
      if (!tuOn[cx]) continue;
      const dy = tuY[cx] - py;
      if (dy < 0 || dy > 8) continue;
      const base = cx * 117 + dy * 13;
      const x0 = tuX[cx] - 6;
      for (let d = 0; d < 13; d++) {
        const v = tuM[base + d];
        if (v) mk[x0 + d] = v;
      }
    }
  }
  // pebbles: 1 lit top · 2 left · 3 body · 4 right (+8: cool stone) · 5 underside · 6 cast shadow
  {
    const cy = (py / 10) | 0;
    if (cy !== PB.band) {
      PB.band = cy;
      PB.done.fill(0);
    }
    const n = Math.ceil(W / 16);
    for (let cx = 0; cx < n; cx++) {
      if (!PB.done[cx]) pbFill(g, cx, cy);
      if (!pbOn[cx]) continue;
      const dy = py - pbY[cx];
      if (dy < 0 || dy > 2) continue;
      const x0 = pbX[cx];
      const w = pbW[cx];
      const s = pbC[cx];
      if (dy === 0) for (let d = 1; d < w - 1; d++) pk[x0 + d] = 1 + s;
      else if (dy === 1) {
        pk[x0] = 2 + s;
        for (let d = 1; d < w - 1; d++) pk[x0 + d] = 3 + s;
        pk[x0 + w - 1] = 4 + s;
        pk[x0 + w] = 6;
      } else {
        for (let d = 1; d < w - 1; d++) pk[x0 + d] = 5;
        pk[x0 + w] = 6;
      }
    }
  }
}

function soil4(y: number, px: number, py: number, e: Cell): Packed {
  const f = (y * 4) % 1;
  let i = 2 + q(e.nA * 0.6 + 0.2, 2, px, py);
  if (f < 0.24) i = 1;
  else if (f > 0.6 && f < 0.78) i += 1;
  else if (f >= 0.78 && f < 0.84) i += 2;
  // clods with a lit top, small stones
  const cx = Math.floor(px / 8);
  const cy = Math.floor(py / 6);
  if (h2(cx, cy, 17) < 0.3) {
    const ox = cx * 8 + 2 + Math.floor(h2(cx, cy, 18) * 3);
    const oy = cy * 6 + 1;
    if (py === oy && px >= ox && px < ox + 3) return SOIL[5];
    if (py === oy + 1 && px >= ox && px < ox + 3) return SOIL[3];
    if (py === oy + 2 && px >= ox && px < ox + 3) return SOIL[0];
  }
  if (e.near === 0) i -= 1;
  if (h2(px, py, 19) < 0.03) i -= 1;
  return SOIL[clampI(i, SOIL.length)];
}

function gravel4(px: number, py: number, e: Cell): Packed {
  let i = 1 + q(e.nA * 0.6 + 0.2, 3, px, py);
  const cx = Math.floor(px / 4);
  const cy = Math.floor(py / 3);
  const h = h2(cx, cy, 91);
  if (h < 0.55) {
    const fy = py - cy * 3;
    const fx = px - cx * 4;
    if (fx < 3) i = fy === 0 ? 4 : fy === 1 ? 2 + (h < 0.2 ? 1 : 0) : 0;
  }
  return GRAVEL[clampI(i, GRAVEL.length)];
}

const PEB = [0, 4, 3, 2, 1];

/** Paint the frame at 128×64: skeleton per 2×2 block, marks per row, pixels from arrays. */
function paint4(g: Grid4, out: Uint32Array) {
  const { W, H, ox, oy, ty8, tx16, tx0, ty0, G, gw, gh, OUT, outerId, waterId, mat, near, other, nA, nB, nC, cloud, depth, ids, codeOf, green } = g;
  initFields(W);
  const hw = (W + 1) >> 1;
  const bId = new Uint8Array(hw);
  const bNear = new Uint8Array(hw);
  const bOth = new Uint8Array(hw);
  const bA = new Float32Array(hw);
  const bB = new Float32Array(hw);
  const bC = new Float32Array(hw);
  const bD = new Float32Array(hw);
  const bCl = new Float32Array(hw);
  const bF: (Floor4 | undefined)[] = new Array(hw);
  const mk = new Uint8Array(W);
  const pk = new Uint8Array(W);
  const e: Cell = { near: 2, other: null, nA: 0.5, nB: 0, nC: 0.5, depth: 0, og: false, ow: false };
  const sctx = { at: g.at };
  const inv = 1 / tx16;
  for (let py = 0; py < H; py++) {
    if (!(py & 1)) {
      // the material skeleton for this row of 2×2 blocks (borders refined per block)
      const Yr = (py + 1 - oy) / ty8;
      let last = -2;
      let lId = outerId;
      let lNear = 2;
      let lOth = OUT;
      let lA = 0.5;
      let lB = 0;
      let lC = 0.5;
      let lD = 0;
      let lCl = 0.5;
      for (let bx = 0; bx < hw; bx++) {
        const Xr = (bx * 2 + 1 - ox) * inv;
        const x = (Yr + Xr) * 0.5;
        const y = (Yr - Xr) * 0.5;
        const ci = Math.floor((x - tx0) * G);
        const cj = Math.floor((y - ty0) * G);
        const idx = ci < 0 || cj < 0 || ci >= gw || cj >= gh ? -1 : cj * gw + ci;
        if (idx !== last) {
          last = idx;
          const id = idx < 0 ? OUT : mat[idx];
          if (id === OUT) {
            lId = outerId;
            lNear = 2;
            lOth = OUT;
            lA = 0.5;
            lB = 0;
            lC = 0.5;
            lD = 0;
            lCl = 0.5;
          } else {
            lId = id;
            lNear = near[idx];
            lOth = other[idx];
            lA = nA[idx];
            lB = nB[idx];
            lC = nC[idx];
            lD = depth[idx];
            lCl = cloud[idx];
          }
        }
        let id = lId;
        let oth = lOth;
        if (lNear === 0) {
          // ragged pixel-scale borders on land; smooth shores
          const pid = g.idFor(g.warped(x, y, lId !== waterId && lOth !== waterId));
          if (pid !== lId) {
            oth = lId;
            id = pid;
          }
        }
        bId[bx] = id;
        bF[bx] = g.customOf(id);
        bNear[bx] = lNear;
        bOth[bx] = oth;
        bA[bx] = lA;
        bB[bx] = lB;
        bC[bx] = lC;
        bD[bx] = lD;
        bCl[bx] = lCl;
      }
    }
    rowMarks(g, py, mk, pk);
    const off = ((py >> 2) & 1) << 1;
    const Yp = (py + 0.5 - oy) / ty8;
    let Xp = (0.5 - ox) * inv;
    const row = py * W;
    for (let px = 0; px < W; px++, Xp += inv) {
      const b = px >> 1;
      const code = codeOf[bId[b]];
      const oth = bOth[b];
      const ow = oth === waterId;
      const nr = bNear[b];
      let c: number;
      const cf = bF[b];
      if (cf) {
        e.near = nr;
        e.other = oth === OUT ? null : ids[oth];
        e.og = green[oth] === 1;
        e.ow = ow;
        e.nA = bA[b];
        e.nB = bB[b];
        e.nC = bC[b];
        e.depth = bD[b];
        c = cf((Yp + Xp) * 0.5, (Yp - Xp) * 0.5, px, py, e);
      } else if (code <= M_FOREST) {
        // grass, meadow and woodland floor: patchy base, then the marks
        const j = sbJ[((px + off) / 5) | 0];
        const lc = code === M_FOREST ? h2(px >> 1, py >> 1, 130) : 1;
        if (lc < 0.035) c = LITTER[Math.floor(lc * 85) % 3];
        else {
          const hue = bC[b] + j * 0.06;
          const P = code === M_GRASS ? (hue > 0.64 ? GRASS_WARM : hue < 0.32 ? GRASS_COOL : GRASS) : code === M_MEADOW ? (hue > 0.62 ? MEADOW_WARM : hue < 0.34 ? MEADOW_COOL : MEADOW) : FOREST;
          const t = bA[b] * 0.92 + 0.04 + j * 0.2;
          let i = t <= 0 ? 1 : t >= 1 ? 4 : 1 + Math.floor(t * 4);
          if (nr === 0 && !ow) i -= 1; // grass along a path or bed sits in the shade of its own overhang
          const m = mk[px];
          if (m) {
            const a = MK_ABS[m];
            if (a >= 0) c = a;
            else {
              const v = i + MK_OFF[m];
              c = P[v < 0 ? 0 : v > 5 ? 5 : v];
            }
          } else c = P[i];
        }
      } else if (code === M_DIRT) {
        const j = sbJ[((px + off) / 5) | 0];
        const t = bA[b] * 0.8 + 0.1 + j * 0.16;
        let i = t <= 0 ? 1 : t >= 1 ? 4 : 1 + Math.floor(t * 4);
        if (bB[b] + j * 0.1 > 0.7) i += 1; // a worn, sun-bleached crown
        c = -1;
        if (green[oth]) {
          const m = mk[px];
          if (nr === 0) {
            // the verge: damp darker earth, grass blades and tufts reaching over it
            i -= 1;
            if (m >= 2 && m <= 5) c = GRASS[m === 3 || m === 5 ? 4 : m === 2 ? 3 : 2];
            else if (j < 0.15 && m >= 6 && m <= 8) c = GRASS[m === 8 ? 1 : 3];
          } else if (nr === 1 && j > 0.25) i -= 1;
        }
        if (c < 0) {
          const p = pk[px];
          if (p === 5) c = DIRT[0];
          else if (p === 6) c = DIRT[i < 2 ? 0 : i - 2];
          else if (p) c = p > 8 ? STONE_COOL[PEB[p - 8]] : GRAVEL[PEB[p]];
          else {
            const gr = h2(px, py, 67);
            if (gr < 0.045) i += 1;
            else if (gr > 0.955) i -= 1;
            c = DIRT[i < 0 ? 0 : i > 5 ? 5 : i];
          }
        }
      } else {
        e.near = nr;
        e.other = oth === OUT ? null : ids[oth];
        e.og = green[oth] === 1;
        e.ow = ow;
        e.nA = bA[b];
        e.nB = bB[b];
        e.nC = bC[b];
        e.depth = bD[b];
        const x = (Yp + Xp) * 0.5;
        const y = (Yp - Xp) * 0.5;
        switch (code) {
          case M_PAVING:
            c = COBBLES ? cobbles(x, y, px, py, e) : flagstones(x, y, px, py, e);
            break;
          case M_SOIL:
            c = soil4(y, px, py, e);
            break;
          case M_WATER:
            c = water(px, py, e);
            break;
          case M_GRAVEL:
            c = gravel4(px, py, e);
            break;
          default:
            c = SHADERS[ids[bId[b]]](x, y, px, py, sctx);
        }
      }
      // wet dark bank just outside water
      if (g.bank && ow && code !== M_WATER) c = mixPacked(c, BANK, nr === 0 ? 0.45 : 0.22);
      // drifting cloud shadows, dithered in 2×2 clusters (a room's floor is under its roof)
      const cl = bCl[b];
      if (g.clouds && cl < 0.3 && (0.3 - cl) * 2.4 > dith(px >> 1, py >> 1)) {
        let under = false;
        if (g.roofed) {
          const tx = (Yp + Xp) * 0.5;
          const ty = (Yp - Xp) * 0.5;
          under = tx >= 0 && ty >= 0 && tx < g.cols && ty < g.rows;
        }
        if (!under) c = mixPacked(c, SHADE, 0.1);
      }
      out[row + px] = (0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
    }
  }
}

// ── bake ────────────────────────────────────────────────────

/**
 * Paint the whole frame for an HD (64×32 / 128×64) world. `at` is the per-tile
 * material lookup; borders are warped here at 1/16-tile resolution (and per
 * 2×2 block along the borders at 128×64).
 */
export function bakeGroundHDInto(out: Uint32Array, W: number, H: number, w: WorldDef, ox: number, oy: number, at: (ix: number, iy: number) => MaterialId, k = 2, pack?: WorldPack) {
  const crisp = new Set<MaterialId>(pack?.crisp ?? []);
  // pixel → tile: x = (Y/(8k) + X/(16k))/2, y = (Y/(8k) − X/(16k))/2
  const ty8 = 8 * k;
  const tx16 = 16 * k;
  const big = k >= 4;
  const tileX = (px: number, py: number) => ((py - oy) / ty8 + (px - ox) / tx16) / 2;
  const tileY = (px: number, py: number) => ((py - oy) / ty8 - (px - ox) / tx16) / 2;
  const cxs = [tileX(0, 0), tileX(W, 0), tileX(0, H), tileX(W, H)];
  const cys = [tileY(0, 0), tileY(W, 0), tileY(0, H), tileY(W, H)];
  const tx0 = Math.floor(Math.min(...cxs)) - 1;
  const ty0 = Math.floor(Math.min(...cys)) - 1;
  const tx1 = Math.ceil(Math.max(...cxs)) + 1;
  const ty1 = Math.ceil(Math.max(...cys)) + 1;
  const G = 16;
  const gw = (tx1 - tx0) * G;
  const gh = (ty1 - ty0) * G;
  const N = gw * gh;
  const OUT = 255;
  const ids: MaterialId[] = [];
  const idOf = new Map<MaterialId, number>();
  const codeOf = new Uint8Array(256).fill(M_OTHER);
  const green = new Uint8Array(256);
  const idFor = (m: MaterialId) => {
    let id = idOf.get(m);
    if (id === undefined) {
      id = ids.length;
      ids.push(m);
      idOf.set(m, id);
      codeOf[id] = MCODE[m] ?? M_OTHER;
      green[id] = GREEN.has(m) ? 1 : 0;
    }
    return id;
  };
  const outer = w.scene.outer;
  const outerId = idFor(outer);
  const mat = new Uint8Array(N).fill(OUT);

  /** Domain-warped material at a point (organic borders; `fine` adds a ragged pixel-scale octave). */
  const warped = (x: number, y: number, fine: boolean): MaterialId => {
    const m0 = at(Math.floor(x), Math.floor(y));
    if (crisp.has(m0)) return m0;
    let wx = vnoise(x * 0.9, y * 0.9, 201) - 0.5 + (vnoise(x * 3, y * 3, 203) - 0.5) * 0.3;
    let wy = vnoise(x * 0.9, y * 0.9, 202) - 0.5 + (vnoise(x * 3, y * 3, 204) - 0.5) * 0.3;
    if (fine) {
      wx += (vnoise(x * 9, y * 9, 205) - 0.5) * 0.12;
      wy += (vnoise(x * 9, y * 9, 206) - 0.5) * 0.12;
    }
    const wet = m0 === 'water' || at(Math.floor(x + wx), Math.floor(y + wy)) === 'water';
    const amp = wet ? 0.9 : 0.55;
    let m = at(Math.floor(x + wx * amp), Math.floor(y + wy * amp));
    if (!(SOFT.has(m) && SOFT.has(m0))) m = at(Math.floor(x + wx * 0.16), Math.floor(y + wy * 0.16));
    return crisp.has(m) ? m0 : m;
  };

  // pass 1: warped material per cell (only cells that land on the canvas)
  for (let j = 0; j < gh; j++) {
    const y = ty0 + (j + 0.5) / G;
    for (let i = 0; i < gw; i++) {
      const x = tx0 + (i + 0.5) / G;
      const sx = (x - y) * tx16 + ox;
      const sy = (x + y) * ty8 + oy;
      if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;
      mat[j * gw + i] = idFor(warped(x, y, false));
    }
  }

  // pass 2: edges, noise fields, water depth per cell
  const near = new Uint8Array(N).fill(2);
  const other = new Uint8Array(N).fill(OUT);
  const nA = new Float32Array(N);
  const nB = new Float32Array(N);
  const nC = new Float32Array(N);
  const cloud = new Float32Array(N);
  const depth = new Float32Array(N);
  const look = (i: number, j: number) => (i < 0 || j < 0 || i >= gw || j >= gh ? OUT : mat[j * gw + i]);
  const waterId = idOf.get('water') ?? -1;
  const pavingId = idOf.get('paving') ?? -1;
  for (let j = 0; j < gh; j++) {
    const y = ty0 + (j + 0.5) / G;
    for (let i = 0; i < gw; i++) {
      const idx = j * gw + i;
      const id = mat[idx];
      if (id === OUT) continue;
      const x = tx0 + (i + 0.5) / G;
      // water at 128×64 keeps a thin foam line (1 cell) and shallow band (3 cells)
      const wet = big && id === waterId;
      for (let c = 0; c < 2 && near[idx] === 2; c++) {
        const r = c === 0 ? (wet ? 1 : 2) : wet ? 3 : 5;
        let n = look(i + r, j);
        if (n === OUT || n === id) n = look(i - r, j);
        if (n === OUT || n === id) n = look(i, j + r);
        if (n === OUT || n === id) n = look(i, j - r);
        if (n !== OUT && n !== id) {
          near[idx] = c;
          other[idx] = n;
        }
      }
      if (id === waterId) {
        nA[idx] = vnoise(x * 0.4, y * 0.4, 18);
        nB[idx] = vnoise(x * 2, y * 4, 19);
        let d = 0;
        for (let s = 0; s < 3; s++) {
          const r = s === 0 ? 6 : s === 1 ? 11 : 18;
          if (look(i + r, j) === id && look(i - r, j) === id && look(i, j + r) === id && look(i, j - r) === id) d += 0.34;
        }
        depth[idx] = d;
      } else if (big) {
        // rotated lattices: no diamond-shaped patches from a tile-aligned noise grid
        const ru = x * 0.8 - y * 0.6;
        const rv = x * 0.6 + y * 0.8;
        const su = x * 0.28 + y * 0.96;
        const sv = y * 0.28 - x * 0.96;
        nA[idx] = vnoise(ru * 0.3, rv * 0.3, 40) * 0.55 + vnoise(su * 1.1, sv * 1.1, 41) * 0.45;
        nB[idx] = id === pavingId ? vnoise(x * 2.5, y * 2.5, 73) : vnoise(su * 0.7, sv * 0.7, 46);
        nC[idx] = vnoise(ru * 0.16, rv * 0.16, 47);
      } else {
        nA[idx] = vnoise(x * 0.3, y * 0.3, 40) * 0.55 + vnoise(x * 1.1, y * 1.1, 41) * 0.45;
        nB[idx] = id === pavingId ? vnoise(x * 2.5, y * 2.5, 73) : vnoise(x * 0.7, y * 0.7, 46);
      }
      cloud[idx] = vnoise(x * 0.07, y * 0.07, 77);
    }
  }

  if (big) {
    BIG = true;
    COBBLES = !pack;
    const floors = pack?.floors ?? {};
    const custom = new Map<number, Floor4 | undefined>();
    // looked up lazily: border refinement can meet materials late
    const customOf = (id: number) => {
      if (!custom.has(id)) custom.set(id, floors[ids[id]]);
      return custom.get(id);
    };
    const fx = pack?.groundFx ?? {};
    paint4(
      { W, H, ox, oy, ty8, tx16, tx0, ty0, G, gw, gh, OUT, outerId, waterId, mat, near, other, nA, nB, nC, cloud, depth, ids, codeOf, green, idFor, warped, at, customOf, clouds: fx.clouds !== false, bank: fx.bank !== false, roofed: w.environment.backdrop === 'walls', cols: w.cols, rows: w.rows },
      out,
    );
    BIG = false;
    COBBLES = false;
    return;
  }

  // pass 3 (64×32): pixels
  BIG = false;
  const e: Cell = { near: 2, other: null, nA: 0.5, nB: 0, nC: 0.5, depth: 0, og: false, ow: false };
  const sctx = { at };
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = tileX(px + 0.5, py + 0.5);
      const y = tileY(px + 0.5, py + 0.5);
      const ci = Math.floor((x - tx0) * G);
      const cj = Math.floor((y - ty0) * G);
      const idx = ci < 0 || cj < 0 || ci >= gw || cj >= gh ? -1 : cj * gw + ci;
      const id = idx < 0 ? OUT : mat[idx];
      let m: MaterialId;
      let cl = 0.5;
      if (id === OUT) {
        m = outer;
        e.near = 2;
        e.other = null;
        e.nA = 0.5;
        e.nB = 0;
        e.depth = 0;
      } else {
        m = ids[id];
        e.near = near[idx];
        e.other = other[idx] === OUT ? null : ids[other[idx]];
        e.nA = nA[idx];
        e.nB = nB[idx];
        e.depth = depth[idx];
        cl = cloud[idx];
      }
      let c: Packed;
      switch (m) {
        case 'grass':
          c = grass(GRASS, px, py, 40, 0.1, e);
          break;
        case 'meadow':
          c = grass(MEADOW, px, py, 50, 0.22, e);
          break;
        case 'forest': {
          // woodland floor: darker tufts, leaf litter and moss
          const lc = h2(px >> 1, py >> 1, 130);
          c = lc < 0.035 ? LITTER[Math.floor(lc * 85) % 3] : grass(FOREST, px, py, 60, 0.02, e);
          break;
        }
        case 'dirt':
          c = dirt(px, py, e);
          break;
        case 'paving':
          c = flagstones(x, y, px, py, e);
          break;
        case 'soil':
          c = soil(y, px, py, e);
          break;
        case 'water':
          c = water(px, py, e);
          break;
        case 'gravel':
          c = gravel(px, py, e);
          break;
        default:
          c = SHADERS[m](x, y, px, py, sctx);
      }
      // wet dark bank just outside water
      if (m !== 'water' && e.other === 'water') c = mixPacked(c, BANK, e.near === 0 ? 0.45 : 0.22);
      // drifting cloud shadows, dithered
      if (cl < 0.3 && (0.3 - cl) * 2.4 > dith(px, py)) c = mixPacked(c, SHADE, 0.1);
      out[py * W + px] = (0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
    }
  }
}

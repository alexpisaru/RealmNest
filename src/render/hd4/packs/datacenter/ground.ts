// Data Center — floors of the data hall and the ground of the snowy site at 128×64.
//   raised    raised-floor panels (0.5 tile, HPL laminate, black edge trim) under ceiling light pools
//   grate     perforated cold-aisle panels (and the odd louvred grille) breathing cold air
//   meadow    fresh snow: soft drifts, wind ripples (sastrugi), glints, heather tips
//   forest    snow in the shade of the spruces: blue, littered with needles and cones
//   grass     windswept heath: thin snow, heather and dry grass showing through
//   soil      trampled snow: paths and yards, boot dents, grit and slush
//   asphalt   ploughed roads (packed snow, dark wet wheel tracks, grit) and the car park
//   concrete  cleared and salted concrete aprons with sawn joints and a dusting of snow
//   gravel    the substation's crushed stone, snow in its hollows
//   sidewalk  shovelled concrete pavers by the entrance
//   sand      the frozen fjord: snow-covered ice, wind-polished black ice, white cracks
//   water     open fjord water: deep and dark, slush and brash ice at the ice edge
//   dirt      the rocky shore: rounded stones with snow caps, dark wet gaps
// Patches: grate (LED light spill on the cold-aisle floor), lane (yellow safety
// marking), pad (anti-static mat), rug (entrance mat).
import type { FloorPatch, MaterialId, WorldDef } from '../../../../domain/world';
import type { Painter } from '../../../iso';
import { dith, h2, vnoise } from '../../../materials';
import { type Floor4, pal } from '../types';
import { CONC, DEEP, HEATH, ICE, ROCK, SNOW } from './palette';

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);
const FR = (v: number) => v - Math.floor(v);

// ── the data hall ───────────────────────────────────────────
// the reference's light grey tiles: #b7bac4 / #bfc2cc, lit #d1d4db, shaded #6e7581 / #808691
const RAISED = pal('#5a616c', '#6e7581', '#808691', '#989ba3', '#adb1ba', '#b9bcc5', '#c8cbd2', '#dcdee3');
// the same tiles where the ceiling lamps pool warm light (#c2b7a6, #e6e0d5)
const RAISEDW = pal('#5e6068', '#74767c', '#8a8a8c', '#a3a19f', '#b8b4ad', '#c6c0b6', '#d6d0c5', '#e8e2d7');
const GAP = 0x3a3f48;
const TRIM_D = 0x5a606a;
// the cold aisles: the same tiles a step darker (#667181, #768090), finely perforated
const GRATE = pal('#3e4550', '#4e5662', '#5e6774', '#6c7584', '#7a8392', '#8a92a0', '#9ca3b0');
const HOLE = pal('#141a24', '#1c2430', '#26303e', '#32404f');

/** Raised-floor panel coordinates: 0.5-tile panels on the tile grid. */
function panel(x: number, y: number): [number, number, number, number] {
  const X = x * 2;
  const Y = y * 2;
  const col = Math.floor(X);
  const row = Math.floor(Y);
  return [col, row, X - col, Y - row];
}

/** Seams between panels: 1 px gap, 1 px black PVC trim, a lit bevel; -1 when inside the panel. */
function seam(fx: number, fy: number): number {
  // one screen pixel ≈ 0.031 of a panel across either seam
  if (fx < 0.031 || fy < 0.031) return GAP;
  if (fx < 0.0625 || fy < 0.0625 || fx > 0.969 || fy > 0.969) return TRIM_D;
  return -1;
}

/** Ceiling light pools: LED battens above the aisles every 3 tiles. */
const pool = (x: number, y: number) => {
  const a = 0.5 + 0.5 * Math.cos(((x - 1) / 3) * Math.PI * 2);
  const b = 0.5 + 0.5 * Math.cos(((y - 1.5) / 3) * Math.PI * 2);
  return a * a * b;
};

const raised: Floor4 = (x, y, px, py, e) => {
  const [col, row, fx, fy] = panel(x, y);
  const s = seam(fx, fy);
  if (s >= 0) return e.near === 0 ? GAP : s;
  const id = h2(col, row, 3);
  let t = 4.4 + (id - 0.5) * 0.8;
  // laminate: a fine mottle and the odd darker fleck
  const g = h2(px, py, 4);
  if (g < 0.07) t -= 0.7;
  else if (g > 0.95) t += 0.6;
  // a hair of bevel: the upper-left edges catch the light, the lower-right ones don't
  if (fx < 0.094 || fy < 0.094) t += 0.8;
  else if (fx > 0.92 || fy > 0.92) t -= 0.6;
  // replaced panels (a little darker), cable grommets, a stencilled grid reference
  if (id < 0.06) t -= 0.7;
  if (id > 0.93) {
    const dx = fx - 0.7;
    const dy = fy - 0.68;
    const d = dx * dx + dy * dy * 1.0;
    if (d < 0.012) return d < 0.007 ? 0x101318 : 0x2a2e36;
  }
  if (id > 0.4 && id < 0.47 && fx > 0.12 && fx < 0.3 && fy > 0.78 && fy < 0.86 && h2(px >> 1, py, col) < 0.6) t -= 1.6;
  // light pools under the ceiling battens, wear along the walkways
  const l = pool(x, y);
  t += l * 1.2;
  if (e.nA > 0.7 && dith(px, py) > 0.55) t -= 0.5;
  // ambient occlusion along the walls and the cut front walls
  if (e.near === 0) t -= 1.6;
  else if (e.near === 1) t -= 0.6;
  // the warm lamps' pools tint the tiles (dithered in toward their centres)
  const ramp = l > 0.18 && l * 1.6 > dith(px + 1, py + 2) ? RAISEDW : RAISED;
  return ramp[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 8)];
};

const grate: Floor4 = (x, y, px, py, e) => {
  const [col, row, fx, fy] = panel(x, y);
  const s = seam(fx, fy);
  if (s >= 0) return s;
  const id = h2(col, row, 13);
  let t = 3.4 + (id - 0.5) * 0.6 + pool(x, y) * 0.9;
  if (fx < 0.094 || fy < 0.094) t += 0.8;
  else if (fx > 0.92 || fy > 0.92) t -= 0.6;
  const margin = fx < 0.12 || fx > 0.88 || fy < 0.12 || fy > 0.88;
  if (!margin) {
    if (id < 0.22) {
      // a louvred grille: slots across the aisle, cold air pouring up
      const v = FR(fy * 11);
      if (v > 0.18 && v < 0.62) return HOLE[ci(Math.round(1 + (v < 0.3 ? 0 : 1) + (h2(col, row, 7) > 0.5 ? 1 : 0) - (fx > 0.8 ? 1 : 0)), 4)];
      if (v >= 0.62 && v < 0.74) t += 0.9;
    } else {
      // perforated panel: a staggered grid of round holes
      const hx = fx * 12;
      const hy = fy * 12 + (Math.floor(hx) & 1 ? 0.5 : 0);
      const ux = FR(hx);
      const uy = FR(hy);
      const dx = ux - 0.5;
      const dy = uy - 0.5;
      if (dx * dx + dy * dy < 0.045) {
        // inside the hole: the plenum lit faintly blue, darker toward the panel's lower right
        return HOLE[ci(Math.round(1.6 - dx * 2 - dy * 2 + (id > 0.8 ? 1 : 0)), 4)];
      }
      if (dx < -0.2 && dy < -0.2) t += 0.5;
    }
  }
  if (h2(px, py, 14) < 0.05) t -= 0.7;
  if (e.near === 0) t -= 1.2;
  return GRATE[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.6), 7)];
};

// ── soft cloud shadows ──────────────────────────────────────
// The pack turns the bake's dithered cloud blocks and wet-bank tint off
// (groundFx in index.ts): on bright snow those blocks survive the
// half-resolution reduction as dark specks. Clouds are shaded here instead,
// as a smooth tone shift (SHIFT) applied before each shader quantises into
// its ramp.
let SHIFT = 0;
const cloudCoarse = smooth((x, y) => vnoise(x * 0.07, y * 0.07, 77), 0.5);

/** Wrap a floor shader with smooth cloud shading (shade = strength, 0 indoors). */
function own(f: Floor4, o: { shade?: number; bank?: boolean } = {}): Floor4 {
  const shade = o.shade ?? 2.2;
  return (x, y, px, py, e) => {
    const cc = cloudCoarse(x, y);
    SHIFT = cc < 0.32 ? (0.32 - cc) * shade : 0;
    const c = f(x, y, px, py, e);
    SHIFT = 0;
    return c;
  };
}

// ── snow ────────────────────────────────────────────────────
const SN = pal(...SNOW);
const SPARK = 0xffffff;
const HEATHP = pal(...HEATH);
const HARD = new Set<MaterialId>(['asphalt', 'concrete', 'gravel', 'sidewalk']);

/**
 * A smooth field sampled once on a grid (tile units) and read back with bilinear
 * interpolation: the ground bake asks for tens of millions of pixels, and these
 * fields only change over many tiles.
 */
function smooth(fn: (x: number, y: number) => number, step: number) {
  const X0 = -64;
  const N = Math.ceil(148 / step) + 2;
  let lut: Float32Array | null = null;
  return (x: number, y: number) => {
    if (!lut) {
      lut = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) lut[j * N + i] = fn(X0 + i * step, X0 + j * step);
    }
    let gx = (x - X0) / step;
    let gy = (y - X0) / step;
    if (gx < 0) gx = 0;
    else if (gx > N - 2) gx = N - 2;
    if (gy < 0) gy = 0;
    else if (gy > N - 2) gy = N - 2;
    const ix = gx | 0;
    const iy = gy | 0;
    const fx = gx - ix;
    const fy = gy - iy;
    const k = iy * N + ix;
    const a = lut[k] + (lut[k + 1] - lut[k]) * fx;
    const b = lut[k + N] + (lut[k + N + 1] - lut[k + N]) * fx;
    return a + (b - a) * fy;
  };
}

/** 1-D tables (1/16 tile) for the functions of x alone. */
const table = (fn: (x: number) => number) => Float32Array.from({ length: 148 * 16 + 1 }, (_, i) => fn(i / 16 - 64));
const SIN23 = table((x) => Math.sin(x * 2.3) * 0.4);

/** How much the wind has scoured the snow here (smooth, 0 … 1). */
const scour = smooth((x, y) => {
  const s = Math.sin(x * 0.23 + 0.7) * Math.sin(y * 0.19 - 1.3) + Math.sin((x - y) * 0.11 + 2) * 0.5;
  return s < 0.1 ? 0 : s > 0.6 ? 1 : (s - 0.1) * 2;
}, 0.5);
const rippleWob = smooth((x, y) => Math.sin(x * 1.9 + y * 0.6) * 0.32 + Math.sin(y * 2.7 - x * 0.9) * 0.2, 0.125);
const driftWob = smooth((x, y) => Math.sin(x * 0.61 + y * 0.23) * 0.9 + Math.sin(y * 0.83 - x * 0.37 + 1.3) * 0.6, 0.25);
const heathWob = smooth((x, y) => Math.sin(x * 1.3 + y * 0.8) * 0.12, 0.25);
const rutWob = smooth((x, y) => Math.sin(y * 1.7 + x * 0.2) * 0.12, 0.25);
const streakWob = (x: number, _y: number) => SIN23[Math.max(0, Math.min(SIN23.length - 1, Math.round((x + 64) * 16)))];
const waveWob = smooth((x, y) => Math.sin(x * 2.9 - y * 1.1) * 2, 0.25);
const swellWob = smooth((_x, y) => Math.sin(y * 0.4) * 0.3, 0.5);

/** Wind ripples (sastrugi): fine wavy crests across the prevailing wind; returns a tone offset. */
function ripples(x: number, y: number, k: number): number {
  if (k <= 0) return 0;
  const r = x * 1.45 + y * 1.05 + rippleWob(x, y);
  const f = FR(r);
  if (f > 0.05 + 0.06 * k) return 0;
  // only some crests, fading in and out along their length
  const n = Math.floor(r);
  if (Math.sin(x * 0.9 - y * 0.7 + n * 2.3) < 0.1) return 0;
  return f < 0.02 + 0.03 * k ? 0.6 : -0.9; // the lit crest, then its shadowed lee
}

/**
 * Drift edges: sparse, long, gently curving ledges in the snow, each a lit lip
 * over a soft blue shadow fading downwind. Returns a tone offset.
 */
function drifts(x: number, y: number): number {
  const r = x * 0.55 + y * 0.42 + driftWob(x, y);
  const n = Math.floor(r);
  const f = r - n;
  if (f > 0.116) return 0;
  const s = Math.sin(x * 0.37 - y * 0.29 + n * 2.1) + Math.sin(x * 0.13 + n * 1.7) * 0.6;
  if (s < 0.25) return 0;
  const k = s > 0.85 ? 1 : (s - 0.25) / 0.6;
  if (f < 0.026 * k) return 1.1;
  const sh = 0.026 * k + 0.09 * k;
  if (f < sh) return -1.5 * k * (1 - (f - 0.026 * k) / (0.09 * k));
  return 0;
}

/** A sprig of heather or dry grass poking through: 16×8 px cells, one stalk each at most. */
function sprig(px: number, py: number, chance: number): number {
  const cx = px >> 4;
  const cy = py >> 3;
  const h = h2(cx, cy, 31);
  if (h > chance) return -1;
  const sx = (cx << 4) + 3 + Math.floor(h2(cx, cy, 32) * 10);
  const sy = (cy << 3) + 6;
  const len = 2 + Math.floor(h2(cx, cy, 33) * 4);
  const dx = px - sx;
  const dy = sy - py;
  if (dy < 0 || dy > len) return -1;
  // two or three stalks leaning apart
  if (dx === 0 || (dx === -2 && dy < len - 1 && dy > 0) || (dx === 2 && dy < len - 2 && dy > 0) || (dx === 1 && dy === len)) return HEATHP[ci(1 + (dy > len - 2 ? 3 : dy > 1 ? 2 : 0) - (dx > 0 ? 1 : 0), 6)];
  return -1;
}

const snow: Floor4 = (x, y, px, py, e) => {
  // calm, bright fresh snow on a broad swell
  let t = 5.0 + (e.nC - 0.5) * 1.0 + (e.nA - 0.5) * 0.45;
  t += drifts(x, y);
  const sc = scour(x, y);
  t += ripples(x, y, sc);
  // the odd crystal shadow and glint
  const g = h2(px, py, 5);
  if (g < 0.012) t -= 0.8;
  else if (g > 0.9965) return SPARK;
  // the cut edge where the snow meets a cleared surface: a bright lip, then its shadow
  if (e.other !== null && HARD.has(e.other)) {
    if (e.near === 0) t += 0.9;
    else if (e.near === 1) t -= 0.4;
  }
  return SN[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.6), 7)];
};

const FOREST_LITTER = pal('#5a5e5a', '#4e5a52', '#6a6258');
const forestSnow: Floor4 = (x, y, px, py, e) => {
  // snow under the spruces: in shade, bluer, pocked by drips from the branches, a needle here and there
  let t = 4.3 + (e.nA - 0.5) * 1.0 + (e.nC - 0.5) * 0.7 + drifts(x, y) * 0.6;
  const g = h2(px, py, 41);
  if (g < 0.02) t -= 0.6;
  else if (g > 0.998) return SPARK;
  // dapples where light falls through
  if (e.nB > 0.66) t += (e.nB - 0.66) * 3;
  // drip pocks: small soft blue dents with a lit lower rim
  const cx = px >> 3;
  const cy = py >> 2;
  const hc = h2(cx, cy, 42);
  if (hc < 0.05 && (px & 7) > 2 && (px & 7) < 6) {
    if ((py & 3) === 1) t -= 0.9;
    else if ((py & 3) === 2) t += 0.5;
  }
  // the odd fallen needle
  if (h2(px >> 1, py, 43) < 0.0015) return FOREST_LITTER[Math.floor(g * 3) % 3];
  if (e.near === 0) t -= 0.4;
  return SN[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.8), 7)];
};

const heath: Floor4 = (x, y, px, py, e) => {
  // windswept ground: thin crusty snow with heather, grass and lichen showing through
  const bare = e.nA * 0.7 + e.nB * 0.5 + heathWob(x, y);
  const s = sprig(px, py, 0.12 + bare * 0.2);
  if (s >= 0) return s;
  if (bare > 0.82) {
    // a bare patch: tussocks of brown heather and grey lichen
    const hh = h2(px >> 1, py >> 1, 51);
    if (hh < 0.2) return 0x8e9a86; // lichen
    if (hh > 0.7) return SN[ci(Math.round(3.6 + (dith(px, py) - 0.5) * 1.2), 7)];
    let t = 2.6 + (hh - 0.5) * 2 + (bare - 0.82) * 2;
    if ((px + py) % 5 === 0) t += 0.8;
    if (e.near === 0) t -= 0.6;
    return HEATHP[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.8), 6)];
  }
  let t = 4.1 + (e.nC - 0.5) * 1.2 - (bare > 0.6 ? (bare - 0.6) * 4 : 0);
  t += ripples(x, y, 0.8);
  const g = h2(px, py, 52);
  if (g < 0.06) t -= 0.6;
  else if (g > 0.997) return SPARK;
  return SN[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.85), 7)];
};

const TRAMP = pal('#5e6680', '#76809a', '#8e98b0', '#a6b0c4', '#bcc5d6', '#d0d8e4', '#e2e8f0');
const SLUSH = 0x6e6a66;
const trampled: Floor4 = (_x, _y, px, py, e) => {
  // trodden snow: compacted, greyer, boot dents and a little grit and slush
  let t = 3.7 + (e.nA - 0.5) * 1.2;
  // boot dents: little ovals scattered in 12×6 px cells
  const cx = Math.floor(px / 12);
  const cy = Math.floor(py / 6);
  const hc = h2(cx, cy, 61);
  if (hc < 0.45) {
    const bx = cx * 12 + 2 + Math.floor(h2(cx, cy, 62) * 7);
    const by = cy * 6 + 1 + Math.floor(h2(cx, cy, 63) * 3);
    const dx = px - bx;
    const dy = py - by;
    if (dx >= 0 && dx < 4 && dy >= 0 && dy < 2) t -= dy === 0 ? 1.5 : 0.8;
    else if (dx >= 0 && dx < 4 && dy === 2) t += 0.6;
  }
  const g = h2(px, py, 64);
  if (g < 0.015) return g < 0.006 ? 0x4a4038 : SLUSH;
  if (g > 0.96) t -= 0.7;
  if (e.nB > 0.72) t -= 0.7; // grey slush where it was walked most
  if (e.near === 0 && e.other === 'meadow') t += 0.4;
  return TRAMP[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.8), 7)];
};

// ── roads, yards ────────────────────────────────────────────
const PACK = pal('#56606c', '#6a7480', '#7e8894', '#949ca7', '#a9b1ba', '#bec4cc', '#d2d7dd');
const TAR = pal('#1c1f23', '#2a2d31', '#363a3e', '#45484d', '#55585d', '#6b6f71');
const GRIT = pal('#3a3028', '#5a4a3a', '#6e5e4a');

/**
 * The site's roads (see src/data/worlds/datacenter.ts): the south road runs
 * along x over y 17–20, the east road along y over x 19–22. Returns the
 * position along the road and across it (0 … 3), or null in the car park.
 */
function roadFrame(x: number, y: number): [number, number] | null {
  if (y >= 17 && y < 20) return [x, y - 17];
  if (x >= 19 && x < 22) return [y, x - 19];
  return null;
}

const asphalt: Floor4 = (x, y, px, py, e) => {
  const rf = roadFrame(x, y);
  const g = h2(px, py, 71);
  if (g < 0.02) return GRIT[Math.floor(g * 150) % 3];
  if (!rf) {
    // the car park: packed snow, grey slush ruts where the cars turn in, gritted
    const rut = Math.abs(FR(x * 0.5 + rutWob(x, y)) - 0.5);
    let t = 4.1 + (e.nC - 0.5) * 1.0 + (e.nA - 0.5) * 0.6;
    if (rut < 0.05 && y > 20.4 && y < 21.6) t -= 0.9;
    if (g > 0.94) t -= 0.8;
    if (e.near === 0) t += 0.6;
    return PACK[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.8), 7)];
  }
  const [along, across] = rf;
  // ploughed asphalt, dark and wet (#363a3a … #6b6f71): snow thrown to the verges,
  // compacted snow streaks running with the road between the wheel tracks, a dashed centre line
  const streak = h2(Math.floor(across * 46), Math.floor(along * 2.2 + h2(Math.floor(across * 46), 3, 72) * 9), 73);
  // (no verge across the mouths: the east road joining from the north, the car park's entrance to the south)
  const south = y >= 17 && y < 20;
  const mouthN = south && x >= 19 && x < 22;
  const mouthS = south && x >= 3 && x < 14;
  const edge = (!mouthN && across < 0.34 + rutWob(x, y) * 0.6) || (!mouthS && across > 2.66 + rutWob(y, x) * 0.6);
  if (edge) {
    // the verge: ploughed snow, lumpy, grey with spray toward the road
    const inner = across < 1.5 ? across : 3 - across;
    let t = 4.6 + (h2(px >> 1, py >> 1, 74) - 0.5) * 1.2 - (inner > 0.2 ? 1.4 : 0);
    if (g > 0.93) t -= 1;
    return SN[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 7)];
  }
  const d0 = Math.abs(across - 0.85);
  const d1 = Math.abs(across - 2.15);
  const dt = d0 < d1 ? d0 : d1;
  let t = 3.1 + (e.nA - 0.5) * 1.0;
  if (dt < 0.24) {
    // the wheel tracks: bare wet tar, darker, a glint of wet here and there
    t -= 1.0;
    if (streak > 0.92) t += 2.2;
  } else if (streak < 0.24 + (dt > 0.45 ? 0.2 : 0)) {
    // packed snow and slush streaks between and beside the tracks
    return PACK[ci(Math.round(3.4 + (streak < 0.08 ? 1.5 : 0) + (e.nC - 0.5) - SHIFT + (dith(px, py) - 0.5) * 0.9), 7)];
  }
  // the centre line, dashed, worn and half under slush
  if (Math.abs(across - 1.5) < 0.05 && FR(along * 0.5) < 0.45 && h2(px >> 2, py, 75) < 0.7) return 0xd8d2b8;
  if (g > 0.95) t += 0.9;
  else if (g < 0.06) t -= 0.7;
  return TAR[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.8), 6)];
};

const CO = pal(...CONC);
const JOINT = 0x3a3e45;
const concrete: Floor4 = (x, y, px, py, e) => {
  // 2×2-tile slabs with sawn joints; cleared and salted, a dusting of snow blowing in
  const sx = x / 2;
  const sy = y / 2;
  const col = Math.floor(sx);
  const row = Math.floor(sy);
  const fx = sx - col;
  const fy = sy - row;
  if (fx < 0.008 || fy < 0.008) return JOINT;
  let t = 3.4 + (h2(col, row, 81) - 0.5) * 0.9;
  if (fx < 0.016 || fy < 0.016) t += 0.9;
  const g = h2(px, py, 82);
  if (g < 0.09) t -= 0.7;
  else if (g > 0.94) t += 0.6;
  // salt-whitened patches and damp ones
  if (e.nB > 0.74) t += 0.5;
  if (e.nA < 0.2) t -= 0.5;
  // snow dust drifting in from the edge and lying in the joints' lee
  const dust = (e.near === 0 ? 0.55 : e.near === 1 ? 0.25 : 0) + (e.nC > 0.66 ? (e.nC - 0.66) * 2.5 : 0);
  if (dust > 0 && h2(px >> 1, py, 83) < dust) return SN[ci(Math.round(4.6 + (dith(px, py) - 0.5) * 1.4), 7)];
  return CO[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 7)];
};

const PEBBLE = pal('#3e424a', '#50555e', '#636872', '#777c86', '#8c919a', '#a2a6ae');
const gravel: Floor4 = (_x, _y, px, py, e) => {
  // crushed stone in 3×2 px chips, each lit on its upper left; snow lies in the hollows
  const cx = Math.floor(px / 3);
  const cy = py >> 1;
  const id = h2(cx, cy, 91);
  let t = 2.3 + (id - 0.5) * 2.6;
  if (px % 3 === 0 && (py & 1) === 0) t += 1;
  if (px % 3 === 2 || (py & 1) === 1) t -= 0.6;
  const snowy = e.nA * 0.8 + e.nC * 0.5 + (e.near === 0 ? 0.25 : 0);
  if (snowy > 0.78 && id < (snowy - 0.78) * 4 + 0.15) return SN[ci(Math.round(4.2 + (dith(px, py) - 0.5) * 1.6), 7)];
  if (e.near === 0) t -= 0.6;
  return PEBBLE[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.5), 6)];
};

const sidewalk: Floor4 = (x, y, px, py, e) => {
  // shovelled pavers 0.5 tile, gritted, snow packed into the joints
  const [col, row, fx, fy] = panel(x, y);
  if (fx < 0.031 || fy < 0.031) return SN[3];
  let t = 3.6 + (h2(col, row, 95) - 0.5) * 1.0;
  if (fx < 0.0625 || fy < 0.0625) t += 0.8;
  else if (fx > 0.95 || fy > 0.95) t -= 0.6;
  const g = h2(px, py, 96);
  if (g < 0.02) return GRIT[1];
  if (g < 0.1) t -= 0.6;
  if (e.near === 0 && h2(px >> 1, py, 97) < 0.5) return SN[ci(Math.round(4.8 + (dith(px, py) - 0.5)), 7)];
  return CO[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 7)];
};

// ── the fjord ───────────────────────────────────────────────
const IC = pal(...ICE);
const DP = pal(...DEEP);

// The fjord's shores (the same curves as in src/data/worlds/datacenter.ts): the near
// shore by the car park, turning south at the east end, and the far shore's forest.
export const nearShore = (x: number) => {
  const s = 24.6 + 1.3 * Math.sin(x * 0.33 + 0.4) + 0.8 * Math.sin(x * 0.12 + 2.3);
  return x > 27 ? Math.max(s, 24.6 + (x - 27) * 1.2) : s;
};
export const farShore = (x: number) => 37.5 + 1.2 * Math.sin(x * 0.17 + 0.8) + 0.8 * Math.sin(x * 0.41);

/**
 * Ice plates from a Voronoi pattern of `cell` tiles: every cell whose hash passes
 * `dens` (read at its seed, so plates are never cut by a density change) carries a
 * plate, shrunk from the cell's edges by `gap(sx, sy)` (cell units) so open water
 * shows between plates. Returns the plate's margin (> 0 inside, in cell units) or -1.
 */
function voronoi(cell: number, seed: number, dens: (sx: number, sy: number) => number, gap: (sx: number, sy: number) => number) {
  // the 3×3 seeds round the last cell asked for (neighbouring pixels ask for the same cell)
  let lx = 1e9;
  let ly = 1e9;
  const SX = new Float64Array(9);
  const SY = new Float64Array(9);
  return (x: number, y: number): number => {
    const gx = x / cell;
    const gy = y / cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix !== lx || iy !== ly) {
      lx = ix;
      ly = iy;
      let n = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++, n++) {
          SX[n] = ix + i + 0.15 + h2(ix + i, iy + j, seed) * 0.7;
          SY[n] = iy + j + 0.15 + h2(ix + i, iy + j, seed + 1) * 0.7;
        }
    }
    let d1 = 9;
    let d2 = 9;
    let best = 0;
    for (let n = 0; n < 9; n++) {
      const dx = gx - SX[n];
      const dy = (gy - SY[n]) * 1.12;
      const d = dx * dx + dy * dy;
      if (d < d1) {
        d2 = d1;
        d1 = d;
        best = n;
      } else if (d < d2) d2 = d;
    }
    const bx = ix + (best % 3) - 1;
    const by = iy + Math.floor(best / 3) - 1;
    const wx = (bx + 0.5) * cell;
    const wy = (by + 0.5) * cell;
    if (h2(bx, by, seed + 2) > dens(wx, wy)) return -1;
    const m = (Math.sqrt(d2) - Math.sqrt(d1)) * 0.5 - gap(wx, wy) - h2(bx, by, seed + 3) * 0.05;
    return m > 0 ? m : -1;
  };
}

/** 1 px up the screen in tile units (both x and y shrink by 1/64). */
const UP = 1 / 64;
type PlateFn = (x: number, y: number) => number;

/**
 * A floating slab of ice `H` px thick: its top (snow, or pale blue ice, lit along its
 * upper-left rim), a blue-white flank, a dark line of shadow on the water under it.
 * Returns a colour, or -1 where there is no slab.
 */
function slab(x: number, y: number, px: number, py: number, f: PlateFn, H: number, snowy: number): number {
  const d = H * UP;
  const top = f(x + d, y + d);
  if (top > 0) {
    if (top < 0.035) return f(x + d - 3 * UP, y + d - 3 * UP) > 0 ? IC[4] : SN[6];
    // snow lying in drifts on the plate, pale blue ice where the wind swept it bare
    const bare = vnoise(x * 1.7, y * 1.7, 191) > snowy;
    if (h2(px, py, 152) > 0.996) return SPARK;
    if (bare) return IC[ci(Math.round(4.6 + top * 2 + (h2(px >> 1, py, 151) - 0.5) * 0.8 + (dith(px, py) - 0.5) * 0.8), 7)];
    return SN[ci(Math.round(5 + top * 2 + (h2(px >> 1, py, 151) - 0.5) * 0.8 + (dith(px, py) - 0.5) * 0.7), 7)];
  }
  if (f(x, y) > 0) return f(x + d * 0.5, y + d * 0.5) > 0 ? IC[4] : IC[2];
  // the shadow on the water just under the slab
  if (f(x - 2 * UP, y - 2 * UP) > 0) return DP[0];
  return -1;
}

/** Floes thick along the near shore and in the bay, thinning out offshore, a fringe by the far shore. */
const floeDens = (x: number, y: number) => {
  const dn = y - nearShore(x);
  const df = farShore(x) - y;
  if (dn < 0.4 || df < 0.4) return 0;
  const bay = Math.exp(-(((x - 12) / 6) ** 2) - (((y - 30.5) / 2.6) ** 2));
  return Math.min(0.95, Math.max(dn < 4 ? 0.85 - dn * 0.1 : 0.3 - (dn - 4) * 0.05, df < 1.8 ? 0.5 : 0.08) + bay * 0.6);
};
const floeGap = (x: number, y: number) => {
  const dn = y - nearShore(x);
  return 0.04 + Math.min(0.2, Math.max(0, dn - 1.5) * 0.04);
};
const floeVor = voronoi(1.5, 161, floeDens, floeGap);
const floes: PlateFn = (x, y) => {
  // the big floe in the bay where the fishing hut stands
  const dx = Math.abs(x - 13.4);
  const dy = Math.abs(y - 30.6);
  const bigOne = 1 - Math.max(dx * 0.95, dy * 1.15, (dx + dy) * 0.66) / 1.9;
  if (bigOne > 0) return bigOne * 0.3;
  return floeVor(x, y);
};
const brash: PlateFn = voronoi(0.5, 171, (sx, sy) => (sy - nearShore(sx) < 5 || farShore(sx) - sy < 2 ? floeDens(sx, sy) * 0.55 : 0), () => 0.12);

const water: Floor4 = (x, y, px, py, e) => {
  const fl = slab(x, y, px, py, floes, 5, 0.42);
  if (fl >= 0) return fl;
  // brash ice only within a few tiles of either shore
  if (y - nearShore(x) < 5.5 || farShore(x) - y < 2.5) {
    const br = slab(x, y, px, py, brash, 2, 0.55);
    if (br >= 0) return br;
  }
  // open water: deep navy, lighter along the ice edge, wind ripples, a slow swell
  let t = 3.0 - e.depth * 1.1 + (e.nA - 0.5) * 1.0 + (e.near === 0 ? 1.2 : e.near === 1 ? 0.6 : 0);
  const row = (py + Math.floor(waveWob(x, y))) >> 2;
  const dash = h2(px >> 3, row, 111);
  if ((py & 3) === 0 && dash < 0.2) t += dash < 0.05 ? 2.6 : 1.3;
  if ((py & 3) === 1 && dash < 0.08) t -= 0.8;
  if (FR((x * 0.6 + y * 0.9) * 0.5 + swellWob(x, y)) < 0.12) t += 0.6;
  // slush at the shore
  if (e.near === 0 && h2(px >> 1, py >> 1, 112) < 0.3) return IC[2];
  return DP[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 8)];
};

// the pond up in the forest: pale clear ice (#507597 … #86abce) broken into plates, some under snow
const pondPlates: PlateFn = voronoi(1.3, 181, () => 0.82, () => 0.05);
const ice: Floor4 = (x, y, px, py, e) => {
  if (e.near === 0 && e.other !== 'water') {
    // the snowy bank round the pond: a bright lip
    return SN[ci(Math.round(5.2 + (dith(px, py) - 0.5) * 0.8 - SHIFT), 7)];
  }
  const fl = slab(x, y, px, py, pondPlates, 3, 0.5);
  if (fl >= 0) return fl;
  // the clear ice between the plates: streaks polished by the wind, trapped bubbles
  let t = 2.1 + (e.nA - 0.5) * 1.2 + (e.near === 1 ? 0.8 : 0);
  const streak = FR((x + y) * 3.1 + streakWob(x, y));
  if (streak < 0.08) t += 1.2;
  const g = h2(px, py, 103);
  if (g < 0.012) return IC[5];
  return IC[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 7)];
};

const RK = pal(...ROCK);
const shore: Floor4 = (x, y, px, py, e) => {
  // the shore: low granite boulders scattered in the snow, capped with snow, dark and wet at the waterline
  const S = 1.7;
  const u = x * S + y * 0.5;
  const v = y * S - x * 0.5;
  const gu = Math.floor(u);
  const gv = Math.floor(v);
  let best = 9;
  let fu = 0;
  let fv = 0;
  let rad = 0;
  let id = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cu = gu + i;
      const cv = gv + j;
      const hid = h2(cu, cv, 120);
      if (hid > 0.72) continue;
      const r = 0.24 + hid * 0.32;
      const du = u - (cu + 0.2 + h2(cu, cv, 121) * 0.6);
      const dv = v - (cv + 0.2 + h2(cu, cv, 122) * 0.6);
      const d = Math.sqrt(du * du + dv * dv) / r;
      if (d < best) {
        best = d;
        fu = du / r;
        fv = dv / r;
        rad = r;
        id = cu * 7349 + cv * 1913;
      }
    }
  let c: number;
  const wet = e.ow && e.near === 0;
  if (best < 1) {
    // a boulder: a rounded hump lit on its upper left, its crown capped with snow
    const nz = Math.sqrt(Math.max(0, 1 - best * best));
    const lit = -fu * 0.55 - fv * 0.75 + nz * 0.55;
    const cap = !wet && fv + fu * 0.3 < -0.15 + h2(id, 1, 123) * 0.35 && nz > 0.3;
    if (cap) c = SN[ci(Math.round(3.9 + lit * 2 + (dith(px, py) - 0.5) * 0.8), 7)];
    else {
      let t = 1.6 + (h2(id, 2, 124) - 0.5) * 1.4 + lit * 3;
      if (best > 0.86) t -= 0.8;
      if (h2(px, py, 125) < 0.05) t -= 0.7;
      c = RK[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.6), 7)];
    }
  } else {
    // snow between the stones, a contact shadow on each stone's lower right; wet shingle at the waterline
    if (wet) c = h2(px >> 1, py, 126) < 0.5 ? RK[1] : RK[2];
    else {
      let t = 4.3 + (e.nC - 0.5) * 0.8;
      if (best < 1.25 && fu + fv > 0.4) t -= 1.6;
      if (h2(px, py, 127) > 0.997) return SPARK;
      c = SN[ci(Math.round(t - SHIFT + (dith(px, py) - 0.5) * 0.7), 7)];
    }
  }
  void rad;
  return c;
};

export const DC_FLOORS: Partial<Record<MaterialId, Floor4>> = {
  raised: own(raised, { shade: 0 }),
  grate: own(grate, { shade: 0 }),
  meadow: own(snow),
  forest: own(forestSnow),
  grass: own(heath),
  soil: own(trampled),
  asphalt: own(asphalt, { shade: 1.6 }),
  concrete: own(concrete, { shade: 1.6 }),
  gravel: own(gravel, { shade: 1.6 }),
  sidewalk: own(sidewalk, { shade: 1.6 }),
  sand: own(ice),
  water: own(water, { shade: 1.2, bank: false }),
  dirt: own(shore),
};

export const DC_CRISP: MaterialId[] = ['raised', 'grate', 'asphalt', 'concrete', 'gravel', 'sidewalk'];

// ── floor patches ───────────────────────────────────────────
const rgbS = (n: number) => `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;

/** Visit every pixel of a patch's diamond with its patch-local (u, v) in tiles. */
function eachPixel(P: Painter, s: FloorPatch, grow: number, fn: (u: number, v: number, px: number, py: number) => string | null) {
  const k = P.k;
  const corners = [P.P(s.x - grow, s.y - grow), P.P(s.x + s.w + grow, s.y - grow), P.P(s.x + s.w + grow, s.y + s.d + grow), P.P(s.x - grow, s.y + s.d + grow)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1])));
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const c = P.c;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const u = (Y + X) / 2 - s.x;
      const v = (Y - X) / 2 - s.y;
      if (u < -grow || v < -grow || u > s.w + grow || v > s.d + grow) continue;
      const col = fn(u, v, px, py);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    }
}

const MAT = ['#3e4a5a', '#4a586a', '#56667a', '#62748a', '#70829a'];
const COIR = ['#24221f', '#2e2b27', '#3a3631', '#47423b'];

export function dcPatch(P: Painter, s: FloorPatch, w: WorldDef) {
  if (s.style === 'grate') {
    // light spilling from the LED-studded rack fronts onto the cold-aisle floor, and its reflections
    const racks = w.props.filter((p) => p.type === 'servers' && p.rot === 0 && p.y + p.d === s.y);
    eachPixel(P, s, 0, (u, v, px, py) => {
      const ax = s.x + u;
      const onRack = racks.some((r) => ax > r.x + 0.08 && ax < r.x + r.w - 0.08);
      if (!onRack) return null;
      if (v < 0.6) {
        const k = 1 - v / 0.6;
        // the reflection of a column of LEDs: short coloured dashes under each rack slot
        const slot = Math.floor((ax - 0.08) / 0.63);
        const inSlot = FR((ax - 0.08) / 0.63);
        const hv = h2(slot, Math.floor(v * 30), 7);
        if (v < 0.28 && inSlot > 0.3 && inSlot < 0.62 && hv < 0.1 * k) return hv < 0.04 ? 'rgba(92,240,138,0.55)' : 'rgba(74,168,255,0.55)';
        return k * 0.55 > dith(px, py) ? 'rgba(80,170,255,0.22)' : null;
      }
      return null;
    });
    return;
  }
  if (s.style === 'lane') {
    // a yellow safety marking: a keep-clear box, hatched in its corners
    eachPixel(P, s, 0, (u, v) => {
      const e = Math.min(u, v, s.w - u, s.d - v);
      if (e > 0.12) return null;
      if (e < 0.03) return null;
      const hatch = FR((u + v) * 3.2) < 0.5;
      const corner = (u < 0.6 || u > s.w - 0.6) && (v < 0.6 || v > s.d - 0.6);
      if (corner && !hatch) return '#1e1e22';
      return e < 0.05 || e > 0.1 ? '#b08a1e' : '#eec238';
    });
    return;
  }
  if (s.style === 'pad') {
    // an anti-static mat: ribbed dark rubber, a moulded border, ESD earth stud in a corner
    eachPixel(P, s, 0, (u, v, px, py) => {
      const e = Math.min(u, v, s.w - u, s.d - v);
      if (e < 0.04) return e < 0.02 ? 'rgba(10,10,14,0.45)' : MAT[1];
      if (e < 0.1) return MAT[e < 0.06 ? 3 : 2];
      if (u > s.w - 0.3 && v > s.d - 0.3 && u < s.w - 0.18 && v < s.d - 0.18) return '#c8a040';
      const rib = FR(v * 22) < 0.35;
      return MAT[ci(Math.round((rib ? 1 : 2) + (h2(px, py, 131) < 0.05 ? 1 : 0)), 5)];
    });
    return;
  }
  if (s.style === 'rug') {
    // the entrance mat: charcoal coir, a blue stripe across it
    eachPixel(P, s, 0, (u, v, px, py) => {
      const e = Math.min(u, v, s.w - u, s.d - v);
      if (e < 0.04) return e < 0.02 ? 'rgba(10,10,14,0.4)' : COIR[3];
      if (Math.abs(v - s.d / 2) < 0.07) return '#3a66a8';
      return COIR[ci(Math.round(1 + (h2(px, py >> 1, 141) - 0.5) * 2.4), 4)];
    });
    return;
  }
  void rgbS;
}

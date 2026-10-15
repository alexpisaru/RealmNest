// Robotics — floors and the airfield's ground at 128×64.
//   concrete  the hangar workshop: power-floated slab, saw-cut joints, aggregate,
//             oil stains, wall shadow, window light, painted lane lines
//   hazard    yellow and black stripes painted on the slab, worn by trolleys
//   paving    the apron: big sun-bleached concrete slabs, tar joints, tyre marks
//   asphalt   runway, taxiways, roads and the car park: aggregate, sealed cracks, patches
//   grass     dry airfield grass: straw and olive blades, seed heads, wildflower drifts
//   meadow    green pasture beyond the fence
//   soil      a ploughed field (furrows)
//   sand      a harvested stubble field with straw windrows
//   dirt      farm and service tracks
//   gravel    the fuel farm yard and fence lines
//   sidewalk  landside concrete flags
// Test pad: a dark rubber mat, a border band in its colour, a grid, fiducials.
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import type { Painter } from '../../../iso';
import { dith, h2, vnoise } from '../../../materials';
import { type Floor4, pal } from '../types';

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);
const R = Math.round;

// ── palettes ────────────────────────────────────────────────
const FLOOR = pal('#5e564c', '#766e63', '#8c8479', '#9e968a', '#aea599', '#b8afa3', '#c4bbaf', '#d4ccc0');
const OIL = pal('#3e3c3a', '#4a4844', '#57544f');
const LANE = pal('#9a7a1e', '#c8a22a', '#e6be3a', '#f2d060');
const HAZY = pal('#a8841c', '#c89e26', '#e2b730', '#f0c840', '#f6d660');
const HAZB = pal('#1a191c', '#222125', '#2c2a2f', '#37353a');
const APRON = pal('#928a7e', '#aaa296', '#bcb3a7', '#c9c0b3', '#d3cabd', '#ddd4c7', '#eae2d6');
const TAR = pal('#3e3a36', '#4c4741', '#5e5850');
const ASPH = pal('#1e1f24', '#2a2b31', '#34353c', '#3d3e45', '#46474e', '#52535a', '#66676d');
const DRY = pal('#4e5a18', '#66701e', '#7e8a24', '#94a02a', '#a8ac34', '#bcbc46', '#d0cc64');
const MIX = pal('#2a4614', '#3a5c18', '#4e721c', '#648a22', '#7a9c28', '#90aa30', '#a8b840', '#c2ca62');
const LUSH = pal('#244212', '#325616', '#446c1a', '#58821e', '#6e9624', '#84a62c', '#9cb63c', '#b8c65a');
const SOILP = pal('#3e2810', '#523616', '#68461c', '#7e5826', '#966c32', '#ac8242', '#c09858');
const STUB = pal('#8a5c1a', '#a87424', '#c48e30', '#d8a03c', '#e6b04a', '#f0c060', '#f8d684');
const DIRT = pal('#5a4632', '#6c563e', '#7e664a', '#8e7656', '#9e8664', '#ae9674');
const GRAV = pal('#5a5852', '#6c6a63', '#7e7b73', '#908d84', '#a29e95', '#b4b0a6');
const FLAG = pal('#7c7a74', '#8e8c85', '#a09d95', '#b0ada4', '#bfbcb2', '#cdcac0');
const FLOWERS = pal('#d8402e', '#f2f0e4', '#5a7ad8', '#f2c83a', '#c86ab8', '#f6f2d8');

// ── marks: grass blades and wildflowers, solved one row at a time ──
// The bake paints row by row, so the marks crossing the current row are worked
// out once per row (blades grow up from their root; flowers are tiny plus-shapes).
const MW = 8190;
const bladeRow = new Uint8Array(MW);
const flowerRow = new Uint8Array(MW);
let markY = -99;
const hi = (a: number, b: number, s: number) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
// per cell row caches: a blade per 3×4 cell (packed root x, root y, height, seed head) and a
// flower per 7×6 cell (packed x, y, kind), each worked out once and reused for the rows it spans
const NB = Math.floor(MW / 3) - 1;
const NF = Math.floor(MW / 7) - 1;
const bladeCells = new Map<number, Int32Array>();
const flowerCells = new Map<number, { x: Int16Array; y: Int32Array; k: Int8Array }>();
function bladeCellRow(cy: number) {
  let r = bladeCells.get(cy);
  if (r) return r;
  r = new Int32Array(NB);
  for (let cx = 0; cx < NB; cx++) {
    const h = hi(cx, cy, 11);
    if ((h & 255) > 170) {
      r[cx] = -1;
      continue;
    }
    const bx = cx * 3 + ((h >>> 8) % 3);
    const by = cy * 4 + ((h >>> 10) & 3);
    const hg = 2 + ((h >>> 12) % 5);
    const head = hg >= 5 && ((h >>> 16) & 7) === 0 ? 1 : 0;
    r[cx] = bx | ((by & 0x3fff) << 13) | (hg << 27) | (head << 30);
  }
  if (bladeCells.size > 4) bladeCells.delete(bladeCells.keys().next().value as number);
  bladeCells.set(cy, r);
  return r;
}
function flowerCellRow(cy: number) {
  let r = flowerCells.get(cy);
  if (r) return r;
  r = { x: new Int16Array(NF), y: new Int32Array(NF), k: new Int8Array(NF) };
  for (let cx = 0; cx < NF; cx++) {
    const drift = vnoise(cx * 0.045, cy * 0.06, 29);
    const h = hi(cx, cy, 23);
    if (drift < 0.56 || (h & 1023) > (drift - 0.56) * 1600) {
      r.k[cx] = -1;
      continue;
    }
    r.x[cx] = cx * 7 + 1 + ((h >>> 10) % 5);
    r.y[cx] = cy * 6 + 1 + ((h >>> 13) % 4);
    r.k[cx] = 1 + (Math.floor(vnoise(cx * 0.02, cy * 0.03, 31) * 6) % 6);
  }
  if (flowerCells.size > 4) flowerCells.delete(flowerCells.keys().next().value as number);
  flowerCells.set(cy, r);
  return r;
}
function rowMarks(py: number) {
  if (py === markY) return;
  markY = py;
  bladeRow.fill(0);
  flowerRow.fill(0);
  // blades: root somewhere in the cell, 2–6 px tall, a 1 px shadow to the right
  const cy0 = py >> 2;
  for (let cy = cy0; cy <= cy0 + 1; cy++) {
    const r = bladeCellRow(cy);
    for (let cx = 0; cx < NB; cx++) {
      const v0 = r[cx];
      if (v0 < 0) continue;
      const by = (v0 >>> 13) & 0x3fff;
      const hg = (v0 >>> 27) & 7;
      if (py > by || py <= by - hg) continue;
      const bx = v0 & 0x1fff;
      const t = by - py;
      const v = t === 0 ? 2 : t >= hg - 1 ? 5 : t * 2 < hg ? 3 : 4;
      if (bladeRow[bx] < v) bladeRow[bx] = v;
      if (t < 2 && bladeRow[bx + 1] === 0) bladeRow[bx + 1] = 1;
      if ((v0 >>> 30) & 1 && t === hg - 1) bladeRow[bx] = 6;
    }
  }
  // flowers: tiny plus-shapes in drifts of one kind
  const fy0 = Math.floor((py - 1) / 6);
  for (let cy = fy0; cy <= fy0 + 1; cy++) {
    const r = flowerCellRow(cy);
    for (let cx = 0; cx < NF; cx++) {
      const kind = r.k[cx];
      if (kind < 0) continue;
      const fy = r.y[cx];
      if (py < fy - 1 || py > fy + 1) continue;
      const fx = r.x[cx];
      if (py === fy) {
        flowerRow[fx - 1] = kind;
        flowerRow[fx] = 7;
        flowerRow[fx + 1] = kind;
      } else flowerRow[fx] = py === fy + 1 ? 8 : kind;
    }
  }
}

// ── the workshop slab ───────────────────────────────────────
/** oil stains in the workshop (tile centre, radius) */
const STAINS: [number, number, number][] = [
  [12.3, 11.4, 0.42],
  [11.6, 4.7, 0.3],
  [15.4, 7.2, 0.36],
  [2.2, 3.6, 0.22],
  [13.4, 8.6, 0.26],
  [9.6, 6.2, 0.16],
];

const concrete: Floor4 = (x, y, px, py, e) => {
  let i = 4 + (e.nA - 0.5) * 1.1;
  // each 4×4 bay was a separate pour: a touch lighter or darker
  if (x > 0 && y > 0) i += (h2(Math.floor(x / 4), Math.floor(y / 4), 3) - 0.5) * 0.6;
  // power-floated sheen: broad soft polished clouds, and the odd faint float swirl
  if (e.nC > 0.6 && dith(px >> 1, py >> 1) < (e.nC - 0.6) * 2.4) i += 0.7;
  const sw = vnoise(x * 1.5 + y * 0.4, y * 1.5, 5);
  if (Math.abs(sw - 0.5) < 0.007 && e.nB > 0.45) i -= 0.5;
  // aggregate and pores
  const g = h2(px, py, 7);
  if (g < 0.035) i -= 0.9;
  else if (g > 0.982) i += 0.8;
  // saw-cut control joints every 4 tiles, a lit lip on their far side
  if (x > 0.2 && y > 0.2) {
    const jx = x - Math.round(x / 4) * 4;
    const jy = y - Math.round(y / 4) * 4;
    if ((jx > -0.006 && jx < 0.006) || (jy > -0.008 && jy < 0.008)) return FLOOR[1];
    if ((jx >= 0.006 && jx < 0.014) || (jy >= 0.008 && jy < 0.017)) i += 0.8;
    // anchor bolts left over from old machines
    const ax = x - Math.round(x * 2) / 2;
    const ay = y - Math.round(y * 2) / 2;
    if (h2(Math.round(x * 2), Math.round(y * 2), 9) < 0.025 && ax * ax * 4 + ay * ay * 9 < 0.0012) return FLOOR[0];
  }
  // oil stains: an irregular dark core, a soft rim
  for (const [sx, sy, sr] of STAINS) {
    const dx = x - sx;
    const dy = y - sy;
    if (dx * dx + dy * dy > sr * sr * 2) continue;
    const d = Math.sqrt(dx * dx * 1.2 + dy * dy) / sr + (vnoise(x * 9, y * 9, 13) - 0.5) * 0.5;
    if (d < 0.55) return OIL[d < 0.3 ? 0 : 1];
    if (d < 1) {
      if (dith(px, py) < 1 - d) return OIL[2];
      i -= 0.7;
    }
  }
  // tyre scuffs from carts and the bots
  const tr = vnoise(x * 0.8, y * 3.2, 15);
  if (Math.abs(tr - 0.52) < 0.006 && e.nB > 0.5) i -= 1;
  // painted lane: two yellow lines from the door down the east side of the room, and along the benches
  const lane = (v: number) => v > -0.035 && v < 0.035;
  if (y > 0.2 && y < 3.7 && (lane(x - 13.75) || lane(x - 15.55))) return LANE[(h2(px, py, 17) < 0.1 ? 1 : 2) + (x < 14 ? 0 : 1)];
  if (x > 0.2 && x < 9.6 && (lane(y - 5.25) || lane(y - 6.05)) && !(x > 0.6 && x < 3.4 && y > 5.8)) return LANE[h2(px, py, 18) < 0.12 ? 1 : 2];
  // shadow along the back walls, daylight from the windows and the open hangar door
  if (x < 0.5 && x >= 0) i -= (0.5 - x) * 4 * (dith(px, py) < 0.7 ? 1 : 0.4);
  if (y < 0.5 && y >= 0) i -= (0.5 - y) * 3.2 * (dith(px, py) < 0.7 ? 1 : 0.4);
  if (x > 1 && x < 4 && y < 2.8) i += Math.max(0, 1.6 - y * 0.6) * (dith(px >> 1, py >> 1) < 0.6 ? 1 : 0);
  if (y > 1 && y < 4 && x < 2.6) i += Math.max(0, 1.3 - x * 0.55) * (dith(px >> 1, py >> 1) < 0.6 ? 1 : 0);
  if (y > 12.2 && x > 3 && x < 13) i += (y - 12.2) * 0.7 * (dith(px >> 1, py >> 1) < 0.65 ? 1 : 0);
  return FLOOR[ci(R(i + (h2(px, py, 19) - 0.5) * 0.45), 8)];
};

/** Yellow and black stripes painted on the slab, scuffed where trolleys cross. */
const hazard: Floor4 = (x, y, px, py, e) => {
  const s = (x + y) * 2.6;
  const f = s - Math.floor(s);
  const band = Math.floor(s) & 1;
  if (vnoise(x * 4, y * 4, 41) > 0.72 && h2(px, py, 42) < 0.3) return FLOOR[3 + (h2(px, py, 45) < 0.5 ? 1 : 0)];
  let i = 2 + (e.nA - 0.5) * 0.8 + (h2(px, py, 44) < 0.05 ? -1 : 0);
  if (f < 0.06) i -= 1;
  return band ? HAZY[ci(R(i + 1), 5)] : HAZB[ci(R(i), 4)];
};

// ── the apron ───────────────────────────────────────────────
const paving: Floor4 = (x, y, px, py, e) => {
  const S = 4;
  const sx = Math.floor(x / S);
  const sy = Math.floor(y / S);
  const fx = x - sx * S;
  const fy = y - sy * S;
  // tar-sealed joints, a lit arris on the slab's upper-left edges
  if (fx < 0.022 || fy < 0.03) return TAR[h2(px, py, 51) < 0.2 ? 1 : 0];
  const sh = h2(sx, sy, 52);
  let i = 3.6 + (sh - 0.5) * 1.3 + (e.nA - 0.5) * 1.1;
  if (fx < 0.05 || fy < 0.07) i += 1.1;
  // a saw cut halfway across each slab, a thin dark line with a lit lip
  const hx = fx - 2;
  const hy = fy - 2;
  if ((hx > 0 && hx < 0.018) || (hy > 0 && hy < 0.026)) i -= 1.6;
  else if ((hx >= 0.018 && hx < 0.04) || (hy >= 0.026 && hy < 0.06)) i += 0.7;
  // broom finish: fine streaks across the slab, the direction alternating slab to slab
  const st = (sx + sy) & 1 ? x * 26 + y * 4 : y * 26 + x * 4;
  if (h2(Math.floor(st), sx * 31 + sy, 53) < 0.18) i -= 0.5;
  const g = h2(px, py, 54);
  if (g < 0.05) i -= 0.9;
  else if (g > 0.975) i += 0.8;
  // spalled corners patched with tar on a few slabs
  if (sh < 0.25) {
    const cc = Math.min(fx, S - fx) + Math.min(fy, S - fy);
    if (cc < 0.16 + h2(px >> 1, py >> 1, 56) * 0.08) return TAR[2];
  }
  // oil drips where aircraft and trucks stand
  if (h2(Math.floor(x * 1.5), Math.floor(y * 1.5), 60) < 0.02) {
    const dx = x * 1.5 - Math.floor(x * 1.5) - 0.5;
    const dy = y * 1.5 - Math.floor(y * 1.5) - 0.5;
    if (dx * dx + dy * dy * 2 < 0.04) return OIL[1];
  }
  // weathering: broad darker patches, weeds out of the joints at the grass edge
  if (e.nB > 0.7 && h2(px >> 1, py >> 1, 61) < (e.nB - 0.7) * 3) i -= 0.6;
  if (e.near === 0 && e.other === 'grass' && h2(px >> 1, py, 62) < 0.25) return MIX[2 + (h2(px, py, 63) < 0.5 ? 1 : 0)];
  if (e.near === 0) i -= 0.6;
  return APRON[ci(R(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── asphalt ─────────────────────────────────────────────────
const asphalt: Floor4 = (x, y, px, py, e) => {
  let i = 2.1 + (e.nA - 0.5) * 1.6;
  const g = h2(px, py, 71);
  if (g < 0.1) i -= 1.4;
  else if (g > 0.95) i += 2.2;
  else if (g > 0.91) i += 1.2;
  // repairs: rectangles of fresher, darker or greyer tarmac; a few cells with sealed cracks
  const rx = Math.floor(x / 3);
  const ry = Math.floor(y / 5);
  const rh = h2(rx, ry, 72);
  if (rh < 0.08) i += h2(rx, ry, 73) < 0.5 ? -0.8 : 0.6;
  else if (rh > 0.86) {
    const cr = vnoise(x * 0.9, y * 0.9, 74);
    if (cr > 0.49 && cr < 0.506) return ASPH[0];
  }
  // rubber laid down where tyres roll, broad and soft
  if (e.nB > 0.66 && h2(px >> 1, py >> 1, 78) < (e.nB - 0.66) * 2.5) i -= 0.7;
  // the crumbled edge at the grass, darker and greener
  if (e.near === 0 && e.other === 'grass') {
    if (h2(px >> 1, py >> 1, 76) < 0.3) return MIX[1 + (h2(px, py, 77) < 0.5 ? 1 : 0)];
    i -= 0.8;
  }
  return ASPH[ci(R(i + (dith(px, py) - 0.5) * 0.6), 7)];
};

// ── grass ───────────────────────────────────────────────────
function grassy(P: number[], px: number, py: number, e: Parameters<Floor4>[4], dryness: number) {
  rowMarks(py);
  let i = 3.35 + (e.nA - 0.5) * 2.4 + (dith(px, py) - 0.5) * 0.9;
  // mown and greener right along the pavements; dark at their very edge
  if (e.near === 0 && e.other !== 'grass') i -= 1.3;
  // clumps: darker tussocks and brighter sunlit swards, a few px across
  const cl = h2(px >> 2, py >> 1, 84);
  if (cl < 0.1) i -= 1.2;
  else if (cl > 0.93) i += 1;
  // bigger mottling: dark tussocks with a lit crown above them, ~8×4 px
  const mx = (px + ((py >> 2) & 1) * 4) >> 3;
  const my = py >> 2;
  const mt = h2(mx, my, 85);
  if (mt < 0.16) i -= (py & 3) > 1 ? 1.6 : 0.6;
  else if (mt > 0.86) i += (py & 3) < 2 ? 1.3 : 0.4;
  const m = bladeRow[px];
  const f = flowerRow[px];
  if (f && dryness > 0.2 && e.near !== 0) {
    if (f === 7) return 0xf2c83a;
    if (f === 8) return P[1];
    return FLOWERS[f - 1];
  }
  if (m === 1) i -= 2;
  else if (m === 2) i -= 1.2;
  else if (m === 3) i += 0.3;
  else if (m === 4) i += 0.9;
  else if (m === 5) i += 2;
  else if (m === 6) return 0xe8deb0;
  // bare earth patches in the driest grass, a few pebbles
  if (dryness > 0.7 && e.nB > 0.86 + h2(px, py, 83) * 0.05 && !m) return DIRT[2 + (h2(px, py, 81) < 0.3 ? 1 : 0)];
  if (!m && h2(px, py, 82) < 0.004) return GRAV[4];
  return P[ci(R(i), P.length)];
}

const grass: Floor4 = (_x, _y, px, py, e) => {
  // drier straw patches and greener hollows, from broad noise
  const d = e.nC * 0.8 + e.nB * 0.45;
  const P = d > 0.8 ? DRY : d > 0.66 ? (dith(px >> 1, py >> 1) < (d - 0.66) * 7 ? DRY : MIX) : MIX;
  return grassy(P, px, py, e, d);
};

const meadow: Floor4 = (_x, _y, px, py, e) => grassy(LUSH, px, py, e, 0.5);

// ── fields ──────────────────────────────────────────────────
const soil: Floor4 = (_x, y, px, py, e) => {
  // furrows along x: a lit ridge, a dark trough
  const f = (((y * 3.2) % 1) + 1) % 1;
  let i = 2.5 + (e.nA - 0.5) * 1.1;
  if (f < 0.18) i += 1.6;
  else if (f < 0.42) i += 0.6;
  else if (f > 0.74) i -= 1.6;
  else if (f > 0.62) i -= 0.6;
  if (h2(px, py, 91) < 0.08) i += 1;
  if (e.near === 0) i -= 0.6;
  return SOILP[ci(R(i + (dith(px, py) - 0.5) * 0.6), 6)];
};

const sand: Floor4 = (x, y, px, py, e) => {
  // stubble: rows of short pale stalks, straw windrows every few metres
  const row = (((x * 4) % 1) + 1) % 1;
  let i = 3 + (e.nA - 0.5) * 1.2;
  const w = (((y * 0.4) % 1) + 1) % 1;
  if (w < 0.1) i += 1.8 + (h2(px, py, 94) < 0.3 ? 1 : 0);
  else if (w < 0.14) i -= 1.4;
  else if (row < 0.22) i -= (py & 1) === 0 ? 1.6 : 0.8;
  else if (row > 0.55 && row < 0.7) i += 0.8;
  if (h2(px, py, 93) < 0.06) i += 1;
  if (e.near === 0) i -= 0.8;
  return STUB[ci(R(i + (dith(px, py) - 0.5) * 0.6), 7)];
};

const dirt: Floor4 = (x, y, px, py, e) => {
  let i = 2.8 + (e.nA - 0.5) * 1.6;
  const g = h2(px, py, 95);
  if (g < 0.06) i -= 1;
  else if (g > 0.95) return GRAV[4];
  if (e.nB > 0.66) i += 0.6;
  if (e.near === 0) {
    rowMarks(py);
    const m = bladeRow[px];
    if (m >= 3) return DRY[2 + (m - 3)];
    i -= 0.8;
  }
  void x;
  void y;
  return DIRT[ci(R(i + (dith(px, py) - 0.5) * 0.6), 6)];
};

const gravel: Floor4 = (x, y, px, py, e) => {
  const cx = Math.floor(px / 3);
  const cy = Math.floor(py / 2);
  const h = h2(cx, cy, 97);
  let i = 1.6 + h * 2.6 + (e.nA - 0.5);
  const fx = px - cx * 3;
  const fy = py - cy * 2;
  if (fy === 0 && fx < 2) i += 0.9;
  else if (fx === 2) i -= 1;
  if (e.near === 0) i -= 0.6;
  void x;
  void y;
  return GRAV[ci(R(i), 6)];
};

const sidewalk: Floor4 = (x, y, px, py, e) => {
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  if (fx < 0.02 || fy < 0.035) return FLAG[1];
  let i = 3 + (h2(Math.floor(x), Math.floor(y), 99) - 0.5) * 1.2 + (e.nA - 0.5);
  if (fx < 0.05 || fy < 0.08) i += 0.8;
  if (h2(px, py, 100) < 0.05) i -= 0.8;
  if (e.near === 0) i -= 0.7;
  return FLAG[ci(R(i + (dith(px, py) - 0.5) * 0.5), 6)];
};

// ── the pond: clear blue, ripples, a reedy dark margin ─────
const POND = pal('#163a52', '#1e4c68', '#2a6282', '#3a789c', '#4a8cb4', '#5a9ec4', '#7cb8d6', '#b4dcec');
const water: Floor4 = (x, y, px, py, e) => {
  if (e.near === 0) return (px + py) & 1 ? 0x3e5a2a : 0x2a3e1e;
  let i = 4.4 - Math.min(1, e.depth) * 2 + (e.nA - 0.5) * 1.2;
  // sky reflections in broad bands, short ripple crests
  const rip = vnoise(x * 1.6, y * 5, 61);
  if (rip > 0.64 && ((px >> 1) + py) % 5 !== 0) i += 1.6;
  else if (rip < 0.3) i -= 0.6;
  if (h2(px >> 1, py, 62) < 0.012) return POND[7];
  if (e.near === 1) i += 0.6;
  return POND[ci(R(i + (dith(px, py) - 0.5) * 0.7), 8)];
};

// ── sunflowers: rows of heads facing the sun, leaves between ─
const SUNP = pal('#7a4a08', '#c47a10', '#e2a018', '#f2c42a', '#fadc52', '#fff08c');
const SUNL = pal('#16300c', '#20420e', '#2e5812', '#3e6e16', '#52841c', '#6a9a26');
const forest: Floor4 = (x, y, px, py, e) => {
  // a staggered grid of heads, 10×8 px cells, in rows along x
  const cw = 10;
  const chh = 8;
  const cy = Math.floor(py / chh);
  const off = cy & 1 ? 5 : 0;
  const cx = Math.floor((px + off) / cw);
  const h = h2(cx, cy, 63);
  const hx = cx * cw - off + 4 + Math.floor(h * 3);
  const hy = cy * chh + 3 + Math.floor(h2(cx, cy, 64) * 2);
  const dx = px - hx;
  const dy = (py - hy) * 1.3;
  const r2 = dx * dx + dy * dy;
  if (h > 0.08 && e.near !== 0) {
    if (r2 < 2.2) return r2 < 0.8 ? 0x4a2a0c : 0x6a3e12;
    if (r2 < 11) {
      // petals: lit to the upper left
      const lit = dx + dy < -1 ? 2 : dx + dy > 2 ? -1 : 0;
      return SUNP[ci(3 + lit + (h2(px, py, 65) < 0.2 ? -1 : 0), 6)];
    }
  }
  // leaves: big dark-green hearts, deep shade under the heads
  let i = 2.6 + (vnoise(px * 0.18, py * 0.3, 66) - 0.5) * 2.6;
  if (py > hy + 2 && Math.abs(dx) < 4) i -= 1.4;
  if (h2(px, py, 67) < 0.08) i += 1;
  if (e.near === 0) i -= 1;
  void x;
  void y;
  return SUNL[ci(R(i), 6)];
};

export const ROBOTICS_FLOORS = { concrete, hazard, paving, asphalt, grass, meadow, soil, sand, dirt, gravel, sidewalk, water, forest };

// ── the test pad ─────────────────────────────────────────────
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/** The pads painted into the slab, pixel by pixel. */
export function roboticsPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  if (s.style === 'hazard') return hazardEdge(P, s);
  if (s.style !== 'pad') return;
  const k = P.k;
  const c = P.c;
  const col = s.color ?? '#f3c843';
  const band = [shade(col, 0.62), shade(col, 0.8), col, shade(col, 1.08)];
  const MAT = ['#232428', '#2a2b30', '#313238', '#383a40', '#41434a'];
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - 4;
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + 4;
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 4;
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + 4;
  // fiducial tags: a 4×4 code per corner
  const tagAt = (u: number, v: number, seed: number) => {
    const cu = Math.floor(u * 8);
    const cv = Math.floor(v * 8);
    if (cu < 0 || cv < 0 || cu > 5 || cv > 5) return -1;
    if (cu === 0 || cv === 0 || cu === 5 || cv === 5) return 0;
    return h2(cu, cv, seed) < 0.5 ? 0 : 1;
  };
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2 - s.x;
      const y = (Y - X) / 2 - s.y;
      if (x < 0 || y < 0 || x > s.w || y > s.d) continue;
      const d = Math.min(x, y, s.w - x, s.d - y);
      let colr: string;
      if (d < 0.025) colr = '#18181c';
      else if (d < 0.19) {
        // the border band: painted stripes with a worn dark lip
        const t = Math.floor((x + y) * 3) & 1;
        colr = d < 0.05 || d > 0.17 ? band[0] : t ? band[2] : band[1];
        if (h2(px, py, 3) < 0.06) colr = band[3];
        if (h2(px >> 1, py, 4) < 0.05) colr = MAT[2];
      } else {
        // the rubber mat: a fine grid of 0.5-tile squares, pebbled surface
        let i = 2 + (h2(px, py, 5) < 0.12 ? -1 : 0) + (h2(px, py, 6) > 0.95 ? 1 : 0);
        const gx = (x - 0.19) % 0.5;
        const gy = (y - 0.19) % 0.5;
        if (gx < 0.012 || gy < 0.016) i += 1.5;
        colr = MAT[ci(Math.round(i), 5)];
        // tyre arcs where the bot spins on the spot
        const cx = x - 2.4;
        const cy = y - 1.6;
        const rr = Math.sqrt(cx * cx + cy * cy * 1.1);
        if ((Math.abs(rr - 0.9) < 0.022 || Math.abs(rr - 1.25) < 0.018) && h2(px, py, 7) < 0.8) colr = '#16161a';
        // corner fiducials, a start box with an arrow
        for (const [tx, ty, sd] of [[0.35, 0.35, 1], [s.w - 1.1, 0.35, 2], [0.35, s.d - 1.1, 3], [s.w - 1.1, s.d - 1.1, 4]] as const) {
          const t = tagAt((x - tx) / 0.75, (y - ty) / 0.75, sd);
          if (t >= 0) colr = t ? '#f2f0ea' : '#121214';
        }
        const sx = x - (s.w - 1.5);
        const sy = y - 1.6;
        if (sx > 0 && sx < 0.9 && sy > 0 && sy < 0.9 && (sx < 0.04 || sy < 0.05 || sx > 0.86 || sy > 0.85)) colr = '#f2f0ea';
        if (sx > 0.2 && sx < 0.7 && Math.abs(sy - 0.45) < 0.05 + (sx > 0.5 ? (0.7 - sx) * 0.8 : 0) && sx > 0.2) colr = col;
      }
      c.fillStyle = colr;
      c.fillRect(px, py, 1, 1);
    }
}

/** A crisp dark lip round a painted hazard strip (its stripes are the 'hazard' floor). */
function hazardEdge(P: Painter, s: FloorPatch) {
  const k = P.k;
  const c = P.c;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - 2;
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + 2;
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 2;
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + 2;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2 - s.x;
      const y = (Y - X) / 2 - s.y;
      if (x < -0.02 || y < -0.02 || x > s.w + 0.02 || y > s.d + 0.02) continue;
      const d = Math.min(x, y, s.w - x, s.d - y);
      if (d < 0.03) {
        c.fillStyle = d < 0 ? 'rgba(30,22,34,0.35)' : '#1a191c';
        c.fillRect(px, py, 1, 1);
      }
    }
}

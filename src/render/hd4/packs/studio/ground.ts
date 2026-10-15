// Creative Studio — floors and the seaside ground at 128×64.
//   planks   wide honey pine boards, paint splatters, the sun pool from the NW window
//   deck     the boardwalk: weathered silver-grey boards across the walk, gaps, nails, sand
//   sand     warm beach sand with wind ripples, wet sand and a wrack line by the sea
//   water    the sea: turquoise shallows over sand, breaking wave lines, deep blue swell
//   meadow   dune grass on sand (dry blades, sparse at the edges)
//   gravel   crushed-shell lanes between the houses
// Patches: the Memphis rug (any colour) and the photo set's paper sweep (pad).
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import type { Painter } from '../../../iso';
import { dith, h2 } from '../../../materials';
import { type Floor4, pal } from '../types';

/**
 * The shore: the sea is everything with x ≥ coastX(y). Keep in step with the
 * same polyline in src/data/worlds/studio.ts (which lays the water areas).
 */
const COAST: [number, number][] = [
  [-80, 4],
  [-60, 10],
  [-40, 17],
  [-20, 23],
  [-6, 27],
  [4, 28],
  [14, 26],
  [22, 22],
  [32, 16],
  [44, 7],
  [60, -6],
  [80, -24],
];
function coastExact(y: number): number {
  if (y <= COAST[0][0]) return COAST[0][1];
  for (let i = 1; i < COAST.length; i++) {
    const [y1, x1] = COAST[i];
    if (y <= y1) {
      const [y0, x0] = COAST[i - 1];
      return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
    }
  }
  return COAST[COAST.length - 1][1];
}
/** The shore line, looked up from a table at 1/32 tile (shaders call it per pixel). */
const CL0 = -120;
const CLN = 260 * 32;
const COAST_LUT = new Float32Array(CLN + 1);
for (let i = 0; i <= CLN; i++) COAST_LUT[i] = coastExact(CL0 + i / 32);
export function coastX(y: number): number {
  const i = Math.floor((y - CL0) * 32);
  return COAST_LUT[i < 0 ? 0 : i > CLN ? CLN : i];
}
/** A cheap periodic wave in −1…1 (sine from a table). */
const SINT = new Float32Array(1024);
for (let i = 0; i < 1024; i++) SINT[i] = Math.sin((i / 1024) * Math.PI * 2);
const fsin = (t: number) => SINT[Math.floor(t * 162.974) & 1023];

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

// ── the studio floor ────────────────────────────────────────
const PINEF = pal('#7a4220', '#985428', '#b46a34', '#c88437', '#dc964f', '#e59e61', '#eeb276', '#f6c890');
const JOINT = 0x755028;
const SPLAT = pal('#e0603e', '#2a8a86', '#e8b03e', '#f4f0e6', '#5a7ac8', '#f0a6c0', '#7ac7bb');

const planks: Floor4 = (x, y, px, py, e) => {
  const BW = 0.22;
  const row = Math.floor(y / BW);
  const fy = y / BW - row;
  const off = h2(row, 1, 301) * 7;
  const L = 2.6 + h2(row, 2, 302) * 1.6;
  const along = x + off;
  const seg = Math.floor(along / L);
  const fa = along - seg * L;
  if (fy < 0.05) return JOINT;
  if (fa < 0.022) return JOINT;
  const id = seg * 7919 + row * 104729;
  let i = 3.3 + (h2(id, 3, 303) - 0.5) * 2.2;
  // grain streaks along the board, a knot now and then
  const g = h2(Math.floor(fa * 22), row * 13 + Math.floor(fy * 6), 304);
  if (g < 0.16) i -= 0.9;
  else if (g > 0.9) i += 0.6;
  const kx = h2(id, 4, 305) * L;
  if (h2(id, 5, 306) < 0.3 && Math.hypot((fa - kx) * 6, (fy - 0.5) * 1.4) < 0.5) i -= 1.6;
  // a lit edge on each board's upper lip, nail pairs on the joists
  if (fy < 0.16) i += 0.7;
  if (fy > 0.9) i -= 0.6;
  const jx = (x + 0.37) % 1.2;
  if (jx < 0.03 && h2(row, Math.floor((x + 0.37) / 1.2), 310) < 0.3 && (Math.abs(fy - 0.3) < 0.07 || Math.abs(fy - 0.72) < 0.07)) i -= 1.8;
  // varnish sheen in broad bands, scuffs in the walkways
  if (e.nC > 0.6 && dith(px >> 1, py >> 1) < (e.nC - 0.6) * 3) i += 0.8;
  if (e.nA > 0.72 && dith(px, py) > 0.55) i -= 0.6;
  // the sun pool from the NW window (y 2.2…4.8), mullion and transom shadows
  if (x > 0.7 && x < 2.5 && y > 2.22 && y < 4.78) {
    const m = (y - 2.22) / 0.64;
    const onBar = Math.abs(m - Math.round(m)) < 0.04 || Math.abs(x - 1.3) < 0.03 || Math.abs(x - 1.9) < 0.03;
    const soft = Math.min(x - 0.7, 2.5 - x, y - 2.22, 4.78 - y);
    if (!onBar && (soft > 0.06 || dith(px, py) < soft * 12)) i += 1.6;
  }
  // a soft glow under the NE window and by the door
  if (y < 1.1 && ((x > 1.2 && x < 3.8) || (x > 14 && x < 15))) {
    const t = (1.1 - y) * 0.9;
    if (dith(px, py) < t) i += 0.6;
  }
  // paint splatters: thick round the easels, rare elsewhere
  const easel = x > 0.4 && x < 4.8 && y > 8.6 && y < 12.2;
  const sc = 0.09;
  const cx = Math.floor(x / sc);
  const cy = Math.floor(y / sc);
  const hs = h2(cx, cy, 307);
  if (hs < (easel ? 0.06 : 0.0018)) {
    const dx = (x / sc - cx - 0.5) * 2;
    const dy = (y / sc - cy - 0.5) * 2;
    const r = 0.35 + h2(cx, cy, 308) * 0.6;
    if (dx * dx + dy * dy < r * r) return SPLAT[Math.floor(h2(cx, cy, 309) * 7)];
  }
  // the floor darkens toward the walls
  const d = Math.min(x, y);
  if (d < 0.4 && dith(px, py) * 0.4 > d) i -= 1;
  if (e.near === 0) i -= 0.6;
  return PINEF[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 8)];
};

// ── the boardwalk ───────────────────────────────────────────
const DECK = pal('#553822', '#6e4a2c', '#865c36', '#986d3e', '#ab8053', '#bc9263', '#cda674');
const HONEY = pal('#6a4220', '#8a5628', '#a86c34', '#c88437', '#d6984c', '#e2ac64', '#ecc080');
const GAP = 0x2a1a0e;
const SANDC = pal('#d8a466', '#eab670', '#f8c880', '#ffd48c', '#ffdc9c');

const deck: Floor4 = (x, y, px, py, e) => {
  // boards run across the walk: along x on the east boardwalk, along y elsewhere
  const east = x >= 16 && y < 14.2;
  const a = east ? x : y;
  const b = east ? y : x;
  const BW = 0.2;
  const row = Math.floor(b / BW);
  const fb = b / BW - row;
  if (fb < 0.17) return GAP;
  const L = 3.2;
  const off = h2(row, 7, 311) * L;
  const seg = Math.floor((a + off) / L);
  const fa = a + off - seg * L;
  if (fa < 0.035) return GAP;
  const id = seg * 31 + row * 977;
  const honey = h2(id, 1, 312) < 0.1;
  const R = honey ? HONEY : DECK;
  let i = 3.2 + (h2(id, 2, 313) - 0.5) * 2;
  if (fb < 0.3) i += 1;
  if (fb > 0.88) i -= 0.7;
  // deep weathering cracks along the grain
  const g = h2(Math.floor(fa * 16), row * 7 + Math.floor(fb * 5), 314);
  if (g < 0.14) i -= 1.1;
  else if (g > 0.93) i += 0.6;
  // nail pairs at the joists
  const j = (a + 0.2) % 0.8;
  if (j < 0.025 && (Math.abs(fb - 0.32) < 0.09 || Math.abs(fb - 0.72) < 0.09)) return 0x3a3430;
  // sand blown onto the boards, thicker at the edges
  const sandy = (e.other === 'sand' || e.other === 'meadow') && e.near <= 1 ? 0.35 : 0.02 + (e.nB > 0.7 ? 0.05 : 0);
  if (h2(px, py, 315) < sandy) return SANDC[ci(Math.floor(h2(px >> 1, py, 316) * 5), 5)];
  if (e.nA > 0.68 && dith(px, py) > 0.6) i += 0.5;
  return R[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 7)];
};

// ── the beach ───────────────────────────────────────────────
const SANDP = pal('#c88e4e', '#daa25e', '#eab670', '#f8c880', '#ffd48c', '#ffdc9c', '#ffe8b8');
const WET = pal('#a8804e', '#b8905c', '#c8a06a', '#d6b078', '#e2bc86');
const WRACK = pal('#4a5a22', '#5d742d', '#7a8934');
const SHELL = pal('#fbf4ea', '#f2d4c4', '#e8c0a8', '#d8d0c4');

const sand: Floor4 = (x, y, px, py, e) => {
  let i = 3.9 + (e.nA - 0.5) * 1.6 + (e.nC - 0.5) * 1.2;
  // wind ripples whose direction drifts across the beach; trampled smooth by the boardwalks
  const th = 0.36 + (e.nC - 0.5) * 0.36;
  const r = fsin((x * fsin(th + 1.5708) + y * fsin(th)) * 10.5 + e.nB * 7);
  const trampled = e.other === 'deck' ? (e.near === 0 ? 1 : e.near === 1 ? 0.6 : 0) : 0;
  if (e.nA < 0.66 && trampled < 0.5) {
    if (r > 0.82) i += 1.1;
    else if (r < -0.8) i -= 1.1;
  } else if (h2(px >> 1, py >> 1, 326) < 0.08) i -= 0.8;
  // drifts of finer, paler sand in the broad patches
  if (e.nB > 0.74 && dith(px >> 1, py >> 1) < (e.nB - 0.74) * 4) i += 0.7;
  // coarse grains, footprint dimples and bright quartz glints, readable when zoomed out
  const gq = h2(Math.floor(px / 3), Math.floor(py / 3), 321);
  if (gq < 0.1) i -= 1.3;
  else if (gq > 0.9) i += 1.1;
  else if (h2(px >> 1, py >> 1, 327) < 0.08) i -= 0.8;
  // shell bits and pebbles
  if (h2(px >> 1, py >> 1, 322) < 0.0035) return SHELL[Math.floor(h2(px, py, 323) * 4)];
  // the wet band and the wrack line by the sea
  const dist = coastX(y) - x;
  if (dist < 2.6 && dist > -1) {
    if (dist < 1.1) {
      const t = 1 - Math.max(0, dist) / 1.1;
      if (dith(px, py) < t * 1.1) {
        let w = 2.6 + (e.nB - 0.5) * 1.6 - t * 1.2;
        if (r > 0.92) w += 0.7;
        if (h2(px, py, 324) < 0.04) w += 1.2;
        return WET[ci(Math.round(w), 5)];
      }
    } else if (dist > 1.5 && dist < 2.1 && e.nB > 0.45) {
      const hw = h2(px >> 1, py, 325);
      if (hw < 0.12) return WRACK[Math.floor(hw * 25)];
      if (hw > 0.985) return SHELL[1];
    }
  }
  // shade under the boardwalk's edge, a little darker by the dune grass
  if (e.near === 0 && e.other === 'deck') i -= 1.1;
  else if (e.near === 0 && e.other === 'meadow') i -= 0.4;
  return SANDP[ci(Math.round(i + (dith(px, py) - 0.5) * 0.7), 7)];
};

// ── the sea ─────────────────────────────────────────────────
const SEA = pal('#094970', '#045c92', '#0773a5', '#078cb4', '#0fa6c4', '#2bbdd1', '#51cfdc', '#79dde1', '#bae9ee');
const FOAM = pal('#bae9ee', '#f0fafa', '#ffffff');

const fA0 = (px: number, py: number) => Math.floor((px + py * 2) / 23) * 977 + Math.floor((px - py * 2 + 8192) / 23);
const water: Floor4 = (x, y, px, py, e) => {
  const dist = x - coastX(y);
  if (e.near === 0) return FOAM[(px + py) & 1 ? 1 : 2];
  // the swash: a wide band of white froth running up the sand, laced with turquoise
  const lace = fsin(y * 2.3 + e.nB * 4) * 0.12 + fsin(y * 5.1) * 0.05;
  if (dist < 0.45 + lace) {
    const f = h2(px >> 1, py, 333);
    if (f < 0.72) return FOAM[f < 0.3 ? 2 : 1];
    return f < 0.86 ? FOAM[0] : SEA[8];
  }
  if (e.near === 1) return dith(px, py) < 0.5 ? FOAM[0] : SEA[8];
  // depth: turquoise shallows → blue → deep navy
  let i = dist < 0.8 ? 7.6 : dist < 2.2 ? 7 - (dist - 0.8) * 0.9 : dist < 6 ? 5.7 - (dist - 2.2) * 0.5 : 3.8 - Math.min(3.4, (dist - 6) * 0.26);
  i += (e.nA - 0.5) * 0.9;
  // the sandy bottom shows through the shallows: caustic ripples
  if (dist < 2.4) {
    const c = fsin(x * 9 + fsin(y * 7) * 1.5) + fsin(y * 11 + x * 3);
    if (c > 1.5) i += 0.9;
  }
  // dark reefs and weed beds out in the deep
  if (dist > 6 && e.nC > 0.62 && h2(fA0(px, py), 7, 341) < (e.nC - 0.62) * 4) i -= 1.8;
  // breaking wave lines parallel to the shore: thick curling white crests with a dark trough behind
  if (dist < 4)
  for (const wl of [0.62, 1.05, 1.5, 2.1, 2.8, 3.6]) {
    const d = dist - wl - fsin(y * 1.7 + wl * 4) * 0.14 - fsin(y * 4.3 + wl) * 0.05;
    const th = wl < 1.2 ? 0.17 : wl < 2.5 ? 0.12 : 0.08;
    const on = e.nB + h2(Math.floor(y * 5), Math.floor(wl * 3), 331) * 0.5 > 0.45;
    if (on && Math.abs(d) < th) return d < -th * 0.3 ? FOAM[2] : h2(px, py >> 1, 334) < 0.3 ? FOAM[0] : FOAM[1];
    if (on && d < -th && d > -th - 0.1 && h2(px >> 1, py, 335) < 0.35) return FOAM[0];
    if (d > th && d < th + 0.1) i -= 0.9;
  }
  // choppy water past the surf: a mosaic of diamond facets in neighbouring blues, big and small
  const chop = dist < 1 ? 1 : dist < 3 ? 1.8 : 2.6;
  const fA = Math.floor((px + py * 2) / 23);
  const fB = Math.floor((px - py * 2 + 8192) / 23);
  i += (h2(fA, fB, 336) - 0.5) * chop + (h2((px + py * 2) >> 3, (px - py * 2 + 8192) >> 3, 342) - 0.5) * 0.9;
  // wavelets: lit crests (many breaking white near the shore) over a dark trough, in 96×30 px cells
  {
    const sh = (py / 30) | 0;
    const cx = Math.floor((px + sh * 41) / 96);
    const hw = h2(cx, sh, 337);
    if (hw < (dist < 4 ? 0.85 : 0.75)) {
      const x0 = cx * 96 - sh * 41 + 4 + Math.floor(h2(cx, sh, 338) * 20);
      const len = 28 + Math.floor(h2(cx, sh, 339) * 46);
      const y0 = sh * 30 + 6 + Math.floor(h2(cx, sh, 340) * 14);
      const fx = px - x0;
      if (fx >= 0 && fx < len) {
        const t = fx / len;
        const arc = Math.round((t - 0.45) * (t - 0.45) * 22 + fsin(fx * 0.31 + cx) * 1.2);
        const dy = py - (y0 + arc);
        const white = hw < (dist < 4 ? 0.5 : 0.22);
        const thick = t > 0.12 && t < 0.85 ? 3 : 1;
        if (dy >= 0 && dy < thick) return white ? (dy === 0 ? FOAM[2] : h2(px, py, 343) < 0.4 ? FOAM[0] : FOAM[1]) : SEA[ci(Math.round(i + 3 - dy * 0.6), 9)];
        if (dy >= thick && dy < thick + 3) return SEA[ci(Math.round(i - 2), 9)];
      }
    }
  }
  // open water: a slow swell, glints of sun
  if (dist > 3) {
    const sw = fsin((x - y * 0.35) * 2.2 + e.nA * 3);
    if (sw > 0.85) i += 0.6;
    if (h2(px, py, 332) < 0.008) return FOAM[2];
  }
  return SEA[ci(Math.round(i + (dith(px, py) - 0.5) * 0.5), 9)];
};

// ── dune grass ──────────────────────────────────────────────
const ICE = pal('#2a5a1c', '#3a7424', '#4e8e2e', '#e0408a', '#f291b6');
const DUNEG = pal('#2a430d', '#455e15', '#5d742d', '#7a8934', '#a5ab34', '#b0b85f');

const meadow: Floor4 = (x, y, px, py, e) => {
  // marram blades in clumps over sand
  const dense = e.near === 0 ? 0.08 : e.near === 1 ? 0.22 : 0.3 + e.nB * 0.3;
  const band = Math.floor(py / 7);
  const h = h2(px >> 1, band, 341);
  if (h < dense) {
    const len = 3 + Math.floor(h2(px >> 1, band, 342) * 5);
    const fy = 7 - (py - band * 7);
    if (fy <= len) {
      const t = fy / len;
      return DUNEG[ci(Math.round(1 + t * 4 - ((px >> 1) & 1) * 0.6), 6)];
    }
  }
  if (h2(px, py, 343) < 0.05) return DUNEG[0];
  // mats of ice plant with pink flowers where the dune grass is thick
  if (e.nB > 0.62 && e.near === 2) {
    const cx = px >> 2;
    const cy = py >> 1;
    const hm = h2(cx, cy, 344);
    if (hm < 0.04) return ICE[3 + ((px + py) & 1)];
    if (hm < 0.6) return ICE[hm < 0.2 ? 2 : (px & 1) + (py & 1) ? 1 : 0];
  }
  return sand(x, y, px, py, e);
};

// ── crushed shell lanes ─────────────────────────────────────
const GRIT = pal('#8e8a84', '#a8a49c', '#bebab0', '#d0cbc0', '#dfd8cc', '#ece6dc');

const gravel: Floor4 = (_x, _y, px, py, e) => {
  let i = 3 + (e.nA - 0.5) * 1.4;
  const cx = px >> 1;
  const cy = py >> 1;
  const h = h2(cx, cy, 351);
  if (h < 0.18) {
    // a shell fragment: lit top-left pixel, shade bottom-right
    const fx = px & 1;
    const fy = py & 1;
    i = fx === 0 && fy === 0 ? 5 : fx === 1 && fy === 1 ? 1.4 : 4;
    if (h < 0.03) return SHELL[1 + Math.floor(h * 60)];
  } else if (h > 0.94) i -= 1.2;
  if (e.near === 0) i -= 0.8;
  return GRIT[ci(Math.round(i + (dith(px, py) - 0.5) * 0.6), 6)];
};

export const STUDIO_FLOORS = { planks, deck, sand, water, meadow, gravel };

// ── floor patches ───────────────────────────────────────────
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
};

/** Iterate the pixels over a patch: cb(local x, local y, px, py) returns a colour or null. */
function paintPatch(P: Painter, s: FloorPatch, cb: (lx: number, ly: number, px: number, py: number) => string | null) {
  const k = P.k;
  const corners = [P.P(s.x - 0.2, s.y - 0.2), P.P(s.x + s.w + 0.2, s.y - 0.2), P.P(s.x + s.w + 0.2, s.y + s.d + 0.2), P.P(s.x - 0.2, s.y + s.d + 0.2)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1])));
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const c = P.c;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const lx = (Y + X) / 2 - s.x;
      const ly = (Y - X) / 2 - s.y;
      const col = cb(lx, ly, px, py);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    }
}

/** A Memphis rug: a tufted field scattered with squiggles, triangles and dots, a striped border. */
function rug(P: Painter, s: FloorPatch) {
  const col = s.color ?? '#ef7aa8';
  const tones = [shade(col, 0.6), shade(col, 0.76), shade(col, 0.88), col, shade(col, 1.08), shade(col, 1.16)];
  const ink = ['#1e2a4a', '#2a8a86', '#f2c84a', '#fbf6ec'];
  const inset = 0.06;
  paintPatch(P, s, (x, y, px, py) => {
    const inX = x >= inset && x <= s.w - inset;
    const inY = y >= inset && y <= s.d - inset;
    if (!inX || !inY) {
      // the rug's thickness: a shade on its lower right edges
      const nearR = x > s.w - inset && x < s.w - inset + 0.03 && inY;
      const nearB = y > s.d - inset && y < s.d - inset + 0.03 && inX;
      return nearR || nearB ? 'rgba(40,20,30,0.38)' : null;
    }
    const d = Math.min(x - inset, s.w - inset - x, y - inset, s.d - inset - y);
    // pile: rows of tufts, a soft sheen
    let t = 3 + (h2(px, py >> 1, 361) < 0.2 ? -1 : 0) + (h2(px >> 1, py, 362) > 0.93 ? 1 : 0);
    if (d < 0.04) return tones[0];
    if (d < 0.2) {
      // the border: navy with white dashes
      const along = Math.abs(x - s.w / 2) > Math.abs(y - s.d / 2) * (s.w / s.d) ? y : x;
      if (d > 0.08 && d < 0.14 && Math.floor(along * 9) % 2 === 0) return ink[3];
      return h2(px, py, 363) < 0.15 ? '#2a3858' : ink[0];
    }
    if (d < 0.24) return tones[1];
    // confetti: one shape per cell
    const S = 0.42;
    const cx = Math.floor(x / S);
    const cy = Math.floor(y / S);
    const fx = x / S - cx - 0.5;
    const fy = y / S - cy - 0.5;
    const h = h2(cx, cy, 364);
    const ic = ink[Math.floor(h2(cx, cy, 365) * 4)];
    const kind = Math.floor(h * 5);
    if (kind === 0) {
      if (Math.abs(fy - Math.sin(fx * 9) * 0.12) < 0.05 && Math.abs(fx) < 0.36) return ic;
    } else if (kind === 1) {
      const tri = fy < 0.25 && fy > -0.25 + Math.abs(fx) * 1.4;
      const inner = fy < 0.17 && fy > -0.13 + Math.abs(fx) * 1.4;
      if (tri && !inner) return ic;
    } else if (kind === 2) {
      if (fx * fx + fy * fy < 0.012) return ic;
    } else if (kind === 3) {
      if ((Math.abs(fx) < 0.04 && Math.abs(fy) < 0.18) || (Math.abs(fy) < 0.04 && Math.abs(fx) < 0.18)) return ic;
    } else if (fx * fx + fy * fy < 0.05 && fx * fx + fy * fy > 0.028) return ic;
    if (h2(px >> 1, py >> 1, 366) > 0.97) t += 1;
    return tones[ci(t, 6)];
  });
}

/** The photo set's paper sweep on the floor: soft light, the cove at the wall, tape marks, scuffs. */
function pad(P: Painter, s: FloorPatch) {
  const col = s.color ?? '#f7d9a8';
  const tones = [shade(col, 0.72), shade(col, 0.84), shade(col, 0.93), col, shade(col, 1.04), shade(col, 1.08)];
  paintPatch(P, s, (x, y, px, py) => {
    const m0 = 0.32;
    if (x < m0 || x > s.w - m0 || y < 0 || y > s.d - 0.05) {
      const nearB = y > s.d - 0.05 && y < s.d - 0.02 && x > m0 && x < s.w - m0;
      return nearB ? 'rgba(60,40,30,0.25)' : null;
    }
    // light from the softboxes: brighter in the middle, the cove shadow along the wall
    const cxn = 1 - Math.abs(x - s.w / 2) / (s.w / 2);
    let t = 2.6 + cxn * 1.8 - (y < 0.35 ? (0.35 - y) * 5 : 0) - y * 0.35;
    t += (dith(px, py) - 0.5) * 0.7;
    // gaffer tape marks: a coral cross on the posing spot, T marks either side
    const mx = s.w / 2;
    const my = 1.05;
    const dx = x - mx;
    const dy = y - my;
    if ((Math.abs(dx - dy) < 0.035 || Math.abs(dx + dy) < 0.035) && Math.abs(dx) < 0.14) return '#e0603e';
    for (const tx of [mx - 1.1, mx + 1.1]) {
      if (Math.abs(y - 1.4) < 0.03 && Math.abs(x - tx) < 0.12) return '#2a8a86';
      if (Math.abs(x - tx) < 0.03 && y > 1.4 && y < 1.62) return '#2a8a86';
    }
    // scuffs of shoes on the paper
    if (h2(Math.floor(x * 14), Math.floor(y * 22), 371) < 0.03 && Math.abs(dx) < 0.9) t -= 1.2;
    return tones[ci(Math.round(t), 6)];
  });
}

/** A natural jute rug: a woven herringbone of fibre, a darker border, frayed ends. */
function jute(P: Painter, s: FloorPatch) {
  const J = ['#8a6a44', '#a07c52', '#b48e62', '#c6a274', '#d6b488', '#e2c49c'];
  paintPatch(P, s, (x, y, px, py) => {
    const fr = 0.06;
    if (x < -fr || x > s.w + fr || y < 0.04 || y > s.d - 0.04) return null;
    if (x < 0.04 || x > s.w - 0.04) return Math.floor(y * 40) % 2 ? J[4] : null;
    const d = Math.min(x, s.w - x, y, s.d - y);
    const weave = (Math.floor(px / 2) + Math.floor(py / 2) * 2 + (Math.floor(py / 6) % 2 ? 1 : 0)) % 4;
    let t = 3 + (weave === 0 ? -1 : weave === 2 ? 1 : 0) + (h2(px, py, 371) < 0.08 ? -1 : 0);
    if (d < 0.22 && d > 0.1) t -= 1.4;
    return J[ci(Math.round(t), 6)];
  });
}

/** A round braided rug: coloured rings of plaited rag, ellipse inside the patch. */
function braided(P: Painter, s: FloorPatch) {
  // the reference's rainbow, red outside: #ec4b39 #f2a871 #f7d760 #6db099 + blue and violet
  const cols = ['#ec4b39', '#f59a3a', '#f7d760', '#5cb87a', '#3a8ad8', '#8a5ac8'];
  paintPatch(P, s, (x, y, px, py) => {
    const dx = (x - s.w / 2) / (s.w / 2);
    const dy = (y - s.d / 2) / (s.d / 2);
    const r = Math.hypot(dx, dy);
    if (r > 1) return r < 1.04 && dx + dy > 0 ? 'rgba(40,20,30,0.3)' : null;
    const ring = Math.floor(r * 9);
    const base = cols[(8 - ring + 60) % cols.length];
    const plait = (Math.floor(Math.atan2(dy, dx) * 14 + ring * 0.5) & 1) === 0;
    return plait ? shade(base, 0.86) : h2(px, py, 372) < 0.06 ? shade(base, 1.12) : base;
  });
}

/** Floor patches of the Creative Studio. */
export function studioPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  const col = (s.color ?? '').toLowerCase();
  if (s.style === 'rug' && col === '#c8a878') jute(P, s);
  else if (s.style === 'rug' && col === '#2a8a86') braided(P, s);
  else if (s.style === 'rug') rug(P, s);
  else if (s.style === 'pad') pad(P, s);
}

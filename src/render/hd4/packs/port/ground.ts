// Logistics Port — the ground at 128×64.
//   concrete  the quay apron: 4 m slabs with sealed joints, broom finish,
//             tyre tracks, stains, broken cracks with weeds, crane rails sunk
//             in steel channels, a granite coping and a yellow line at the edge
//   paving    granite setts of the old harbour, rounded and lit on the left
//   asphalt   the terminal road and yard: aggregate, patches, sealed cracks
//   sidewalk  grey concrete pavers in running bond, a granite kerb
//   hazard    yellow-and-black striped concrete, worn
//   gravel    rail ballast, rust-stained
//   water     harbour water (green-teal) and open sea (blue): broken ripple
//             rows, swell, whitecaps, a few oil slicks, the quay walls with
//             their foam line and dark reflections, shallows at the shore —
//             and the far headland above the continuous coastline (beach,
//             wet sand, coastal turf), so no land cells meet the sea there
// Patches: lanes (green walkways with yellow edges and pictograms).
// Every shader runs on millions of pixels: noise comes from the bake's per-cell
// fields (e.nA, e.nB, e.nC) and the pack's fast lattice noise.
import type { FloorPatch, WorldDef } from '../../../../domain/world';
import type { Painter } from '../../../iso';
import { dith } from '../../../materials';
import { type Floor4, type FloorCell, rgb } from '../types';
import { fn, hh } from './fast';
import { COASTER, coastY, LADDERS, LAND, landAt, openness, QD, RAILS, TWALL, wallAt } from './layout';
import { ASPH, CONC, GRAN, OCEAN, PAVER, SEA, SETT, SETTR } from './palette';
import { wallPx } from './quaywall';

const pk = (r: readonly string[]) => r.map(rgb);
const C = pk(CONC);
const A = pk(ASPH);
const G = pk(GRAN);
const S = pk(SETT);
const SR = pk(SETTR);
const PV = pk(PAVER);
const SEAP = pk(SEA);
const OCP = pk(OCEAN);
const FOAMP = pk(['#f2f9fb', '#cfe6ee', '#a2cfde']);
const YEL = pk(['#8a5e0a', '#b8820e', '#dca418', '#f2c228', '#f9d64a']);
const BLK = pk(['#1e1d22', '#28272c', '#333237']);
const OIL = pk(['#6a5290', '#3e6a9a', '#3a8a74', '#a49c48', '#94587a']);
const BALLAST = pk(['#3e2e28', '#4e3b33', '#5e4a40', '#705a4e', '#84705f']);
const RUSTG = pk(['#4a3020', '#5e3c26', '#74492c']);
const SANDP = pk(['#a8966c', '#bead80', '#d0c094', '#dfd0a6', '#ecdeb6', '#f6eac6']);
const WETSAND = pk(['#6a5e46', '#7c6e52', '#8e7e5e', '#a2906c', '#b6a47c', '#c8b68c']);
const PATHP = pk(['#7a6a50', '#8c7a5e', '#9e8c6c', '#b09e7c', '#c4b28e']);
const TURF = pk(['#344a14', '#43601a', '#527420', '#628828', '#749a32', '#86aa40', '#9cbc52']);
const MOSS = pk(['#3e4a26', '#4c5a2c']);
const WEED = pk(['#36521e', '#4a6a26', '#5e8030']);

const ci = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : Math.round(i));
const tone = (P: number[], i: number, px: number, py: number, amp = 0.55) => P[ci(i + (dith(px, py) - 0.5) * amp, P.length)];
const frac = (v: number) => v - Math.floor(v);

/** Tiles where a quay wall, its waterline or its reflection can show (checked before the exact wall test). */
const NB = -110;
const NW = 300;
let NEAR: Uint8Array | null = null;
function nearLand(x: number, y: number) {
  if (!NEAR) {
    NEAR = new Uint8Array(NW * NW);
    const reach = TWALL + 0.36;
    for (const r of LAND) {
      const i0 = Math.max(0, Math.floor(r[0]) - NB);
      const i1 = Math.min(NW, Math.ceil(r[2] + reach) - NB);
      const j0 = Math.max(0, Math.floor(r[1]) - NB);
      const j1 = Math.min(NW, Math.ceil(r[3] + reach) - NB);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) NEAR[j * NW + i] = 1;
    }
  }
  const i = Math.floor(x) - NB;
  const j = Math.floor(y) - NB;
  return i >= 0 && j >= 0 && i < NW && j < NW && NEAR[j * NW + i] === 1;
}
const SIN = new Float32Array(1024);
for (let i = 0; i < 1024; i++) SIN[i] = Math.sin((i / 1024) * Math.PI * 2);
const sinT = (a: number) => SIN[((a * 162.97466) | 0) & 1023];

// ── the shared renderer darkens land next to water ("wet bank"): undo it on the quay ──
function unbank(c: number, e: FloorCell, k = 1): number {
  if (e.other !== 'water' || e.near > 1) return c;
  const a = (e.near === 0 ? 0.45 : 0.22) * k;
  const s = 1 / (1 - a);
  const r = Math.max(0, Math.min(255, Math.round((((c >> 16) & 255) - a * 0x2e) * s)));
  const g = Math.max(0, Math.min(255, Math.round((((c >> 8) & 255) - a * 0x3a) * s)));
  const b = Math.max(0, Math.min(255, Math.round(((c & 255) - a * 0x24) * s)));
  return (r << 16) | (g << 8) | b;
}

// ── the quay edge: distance (tiles) to the water and the coordinate along the edge ──
let ED = 1;
let EA = 0;
/** the wall's line (y of a front edge) when the nearest edge faces +y, else NaN */
let EW = NaN;
function quayEdge(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  ED = 1;
  EW = NaN;
  if (fy > 0.66 && !landAt(x, iy + 1.5) && 1 - fy < ED) (ED = 1 - fy), (EA = x), (EW = iy + 1);
  if (fx > 0.66 && !landAt(ix + 1.5, y) && 1 - fx < ED) (ED = 1 - fx), (EA = y), (EW = NaN);
  if (fy < 0.34 && !landAt(x, iy - 0.5) && fy < ED) (ED = fy), (EA = x), (EW = NaN);
  if (fx < 0.34 && !landAt(ix - 0.5, y) && fx < ED) (ED = fx), (EA = y), (EW = NaN);
}

/** Granite coping blocks along the edge (ED < 0.19), the joint to the deck behind them. */
function coping(px: number, py: number): number {
  // a ladder let into the wall: the coping is cut, its stiles and top rung show
  if (EW === EW) {
    for (const [lx, ly] of LADDERS) {
      if (ly !== EW) continue;
      const du = Math.abs(EA - lx);
      if (du > 0.12) continue;
      if (du > 0.07 && du < 0.1) return du < 0.085 ? 0xe2b432 : 0xa07a1e;
      if (ED > 0.05 && ED < 0.08) return 0xc89a26;
      return ED < 0.03 ? 0x2a2624 : 0x1a1818;
    }
  }
  const along = EA + 0.13;
  const blk = Math.floor(along * 2);
  if (frac(along * 2) < 0.03) return G[1];
  if (ED > 0.172) return G[1];
  let i = 4 + (hh(blk, 5, 211) - 0.5) * 1.1;
  if (ED < 0.022) i += 1.2; // the rounded outer arris catches the sun
  else if (ED > 0.15) i -= 0.6;
  const g = hh(px, py, 212);
  if (g < 0.1) i -= 1;
  else if (g > 0.94) i += 1;
  if (hh(px >> 1, py >> 1, 213) < 0.012) return 0xe8e4dc; // gull droppings
  return tone(G, i, px, py, 0.4);
}

/** Crane rails in steel channels: a bright rail head, dark grooves either side. */
function railPx(x: number, y: number): number {
  for (let k = 0; k < RAILS.length; k++) {
    const R = RAILS[k];
    const dy = y - R[0];
    if (dy < -0.06 || dy > 0.06 || x < R[1] || x > R[2]) continue;
    const s = dy * 64;
    if (s >= -1 && s < 0) return 0xd8dad8;
    if (s >= 0 && s < 1) return 0x9a9c9e;
    if ((s >= 1 && s < 2) || (s >= -2 && s < -1)) return 0x1c1c20;
    if (s >= -3.6 && s < 3.6) return frac(x * 1.7) < 0.5 ? 0x4c4642 : 0x56504a;
  }
  return -1;
}

// ── concrete: the quay apron ─────────────────────────────────
let slabX = 1e9;
let slabY = 1e9;
let slabT = 0;
let slabB = false;
const concrete: Floor4 = (x, y, px, py, e) => {
  if (e.other === 'water' && e.near < 2) {
    quayEdge(x, y);
    if (ED < 0.19) return unbank(coping(px, py), e);
    if (ED > 0.235 && ED < 0.292) {
      // the yellow safety line, chipped where feet and tyres wear it
      if (hh(px >> 1, py, 221) > 0.12 && fn(EA * 3, 1, 9) < 0.8) return unbank(tone(YEL, 3.2 + (hh(px, py, 223) < 0.08 ? -1 : 0), px, py, 0.4), e);
    }
  }
  const r = railPx(x, y);
  if (r >= 0) return unbank(r, e);
  // 2 m slabs (one tile), as in the reference: a dark sealed joint, a lit arris after it
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  const jx = x - sx;
  const jy = y - sy;
  // (second pass) wider, darker joints so the slab grid reads when zoomed out
  if (jx < 0.0157 || jy < 0.0313) return unbank(jx < 0.0078 || jy < 0.0156 ? 0x5a5448 : 0x6c655a, e);
  if (sx !== slabX || sy !== slabY) {
    slabX = sx;
    slabY = sy;
    slabT = (hh(sx, sy, 301) - 0.5) * 0.7;
    slabB = hh(sx, sy, 303) < 0.55;
  }
  let i = 3.2 + slabT;
  if (jx < 0.025 || jy < 0.047) i += 1.1;
  else if (jx > 0.985 || jy > 0.97) i -= 0.9;
  const g = hh(px, py, 302);
  if (g < 0.07) i -= 0.9;
  else if (g > 0.955) i += 1;
  if (slabB && (px + 2 * py) % 7 === 0) i -= 0.3;
  // broad soft stains, worn walkways, smaller dark stains
  if (e.nA > 0.62) i -= (e.nA - 0.62) * 3.4;
  if (e.nC > 0.62) i += 0.45;
  const cr = fn(x * 1.1 + 7, y * 1.1, 3);
  if (cr > 0.83) i -= 0.6;
  // cracks: broken hairlines (never closed loops), some with a weed
  if (Math.abs(cr - 0.5) < 0.006 && e.nB > 0.74) {
    if (hh(px >> 1, py >> 1, 308) < 0.1) return unbank(WEED[ci(hh(px, py, 309) * 3, 3)], e);
    return unbank(C[0], e);
  }
  return unbank(tone(C, i, px, py), e, 0.6);
};

// ── paving: granite setts of the old harbour ─────────────────
let setRow = 1e9;
let setL = 0.15;
let setOff = 0;
let setCol = 1e9;
let setRow2 = 1e9;
let setRed = false;
let setT = 0;
const paving: Floor4 = (x, y, px, py, e) => {
  if (e.other === 'water' && e.near < 2) {
    quayEdge(x, y);
    if (ED < 0.19) return unbank(coping(px, py), e);
  }
  const r = railPx(x, y);
  if (r >= 0) return unbank(r, e);
  const RW = 0.1;
  const row = Math.floor(y / RW);
  const fy = y / RW - row;
  if (row !== setRow) {
    setRow = row;
    setL = 0.14 + hh(row, 2, 311) * 0.03;
    setOff = hh(row, 3, 312) * 0.7 + (row & 1) * 0.5;
  }
  const cu = x / setL + setOff;
  const col = Math.floor(cu);
  const fx = cu - col;
  if (fy < 0.15 || fx < 0.09) {
    if (e.nB > 0.62 && (px & 3) < 2) return unbank(MOSS[(px + py) & 1], e, 0.6);
    return unbank((px + py) & 1 ? 0x353438 : 0x403e3e, e, 0.6);
  }
  if (col !== setCol || row !== setRow2) {
    setCol = col;
    setRow2 = row;
    const id = col * 7349 + row * 1913;
    setRed = hh(id, 1, 315) < 0.045;
    setT = (hh(id, 2, 316) - 0.5) * 1.5;
  }
  const red = setRed;
  const P = red ? SR : S;
  let i = (red ? 2.6 : 3) + setT;
  // rounded tops: lit toward −x and +y (the screen's left), dark toward the lower right
  const dx = fx - 0.55;
  const dy = (fy - 0.57) * 1.4;
  i += (-dx * 1.3 + dy * 1.2) * 1.6;
  if (fx > 0.9 || fy < 0.25) i -= 0.6;
  if (hh(px, py, 317) < 0.06) i -= 0.9;
  // polished in the walkways, dirt in the quiet corners
  if (e.nA > 0.62) i += 0.6;
  else if (e.nA < 0.3) i -= 0.5;
  return unbank(tone(P, i, px, py, 0.5), e, 0.6);
};

// ── asphalt ───────────────────────────────────────────────────
const asphalt: Floor4 = (x, y, px, py, e) => {
  let i = 2.5 + (e.nA - 0.5) * 0.9;
  const g = hh(px, py, 321);
  if (g < 0.09) i -= 1;
  else if (g > 0.945) i += 1.4;
  // repaired patches: a slightly different mix, a dark sealed seam round them
  const cx = Math.floor(x / 1.6);
  const cy = Math.floor(y / 1.6);
  const hp = hh(cx, cy, 322);
  if (hp < 0.07) {
    const fx = x / 1.6 - cx;
    const fy = y / 1.6 - cy;
    const a0 = 0.15 + hp * 2.8;
    const b0 = 0.12 + hp * 2;
    if (fx > a0 && fx < 0.88 && fy > b0 && fy < 0.86) {
      if (fx < a0 + 0.012 || fy < b0 + 0.012 || fx > 0.868 || fy > 0.848) return A[0];
      i += 0.7;
    }
  }
  // sealed cracks (tar lines)
  const cr = fn(x * 0.8, y * 0.8, 11);
  if (Math.abs(cr - 0.5) < 0.006 && e.nB > 0.62) return 0x1c1c20;
  // tyre-polished lanes along the road, oil drips in their middle
  if (e.nB > 0.64) i += 0.45;
  if (hh(Math.floor(x * 4), Math.floor(y * 6), 327) < 0.01) return A[0];
  // the gutter along a kerb
  if (e.near === 0 && e.other === 'sidewalk') i -= 1;
  return tone(A, i, px, py, 0.5);
};

// ── sidewalk: concrete pavers, a granite kerb at the road ─────
const sidewalk: Floor4 = (x, y, px, py, e) => {
  if (e.near === 0 && (e.other === 'asphalt' || e.other === 'gravel')) {
    let i = 4 + (hh(Math.floor(x * 1.5 + y * 1.5), 1, 331) - 0.5) * 0.8;
    if (hh(px, py, 332) < 0.1) i -= 1;
    return tone(G, i, px, py, 0.4);
  }
  const row = Math.floor(y * 8);
  const fy = y * 8 - row;
  const cu = x * 4 + (row & 1) * 0.5;
  const col = Math.floor(cu);
  const fx = cu - col;
  if (fy < 0.13 || fx < 0.065) return hh(px, py, 333) < 0.2 ? MOSS[0] : 0x5a544c;
  let i = 3 + (hh(col, row, 334) - 0.5) * 1.3;
  if (fx < 0.14 || fy > 0.85) i += 0.6;
  else if (fx > 0.93 || fy < 0.24) i -= 0.5;
  if (hh(px, py, 335) < 0.06) i -= 0.8;
  if (hh(col, row, 336) < 0.03) i -= 1.2; // a cracked or replaced paver
  return tone(PV, i, px, py, 0.4);
};

// ── hazard: yellow and black stripes painted on concrete ──────
const hazard: Floor4 = (x, y, px, py, e) => {
  const base = concrete(x, y, px, py, e);
  // worn: the concrete shows through in patches
  const worn = fn(x * 2.2, y * 2.2, 13) + (hh(px >> 1, py >> 1, 342) - 0.5) * 0.25;
  if (worn > 0.8) return base;
  const s = frac((x * 3 - y) * 0.8);
  if (Math.abs(s - 0.5) < 0.02 || s < 0.02) return base;
  const yellow = s < 0.5;
  let i = yellow ? 3.2 : 1.2;
  if (hh(px, py, 343) < 0.08) i -= 1;
  if (worn > 0.6) i -= 0.6;
  return yellow ? tone(YEL, i, px, py, 0.4) : tone(BLK, i, px, py, 0.4);
};

// ── gravel: rail ballast ─────────────────────────────────────
const gravel: Floor4 = (_x, _y, px, py, e) => {
  // crushed stone in 3×2 lumps: lit top-left pixel, dark lower right
  const sh = ((py >> 1) & 1) * 2;
  const cx = Math.floor((px + sh) / 3);
  const cy = py >> 1;
  const h = hh(cx, cy, 351);
  const fx = px + sh - cx * 3;
  const fy = py & 1;
  let i = 1.5 + h * 2.2 + (e.nA - 0.5);
  if (fx === 0 && fy === 0) i += 1;
  else if (fx === 2 || fy === 1) i -= 0.6;
  if (h < 0.08) return RUSTG[ci(h * 30, 3)];
  return BALLAST[ci(i, 5)];
};

// ── the far shore: beach and coastal turf ────────────────────
/** The beach and the turf above it, by the distance inland (dy, tiles) from the continuous waterline. */
function beach(x: number, y: number, px: number, py: number, dy: number): number {
  const nA = fn(x * 0.4, y * 0.4, 19);
  const edge = 2.3 + (nA - 0.5) * 0.9 + (fn(x * 0.9, 3.5, 18) - 0.5) * 0.5;
  if (dy > edge) {
    // a worn footpath along the top of the beach: trodden earth, pebbles, grass encroaching at its edges
    const pd = Math.abs(dy - edge - 0.62 - sinT(x * 0.7) * 0.14) - 0.12 - (hh(px >> 1, py >> 1, 374) - 0.5) * 0.05;
    if (pd < 0) {
      if (hh(px >> 1, py >> 1, 375) < 0.06) return PATHP[4];
      return tone(PATHP, 2.2 + (nA - 0.5) * 1.2 + (pd > -0.025 ? -0.8 : 0), px, py, 0.6);
    }
    // coastal turf: blades, a darker rim where it overhangs the sand
    let i = 3 + (nA - 0.5) * 2 + (fn(x * 0.16 + 7, y * 0.16, 20) - 0.5) * 1.2;
    if (pd < 0.04) i -= 0.8;
    const h = hh(px >> 1, py >> 2, 371);
    const fy = py & 3;
    if (h < 0.3) i += fy === 0 ? 1.2 : fy === 3 ? -1.2 : 0.3;
    if (hh(px, py, 372) < 0.04) i -= 1.5;
    if (dy < edge + 0.08) i -= 1.4;
    return tone(TURF, i, px, py, 0.6);
  }
  // wet sand above the swash, drying in a dithered gradient; a broken line of foam residue
  if (dy < 0.4) {
    const t = dy / 0.4 + (hh(px >> 1, py, 365) - 0.5) * 0.3;
    if (t < 1) {
      if (Math.abs(dy - 0.22 - (fn(x * 3, 1.5, 21) - 0.5) * 0.12) < 0.014 && hh(px >> 1, py, 366) < 0.55) return 0xd6d0bc;
      return tone(WETSAND, 0.3 + t * 4.2, px, py, 0.7);
    }
  }
  let i = 3 + (nA - 0.5) * 1.4;
  const rip = sinT(x * 9 + sinT(y * 3) * 1.6) + (hh(px >> 1, py, 361) - 0.5) * 0.6;
  if (rip > 0.82) i += 0.7;
  else if (rip < -0.9) i -= 0.6;
  if (hh(px, py, 362) < 0.05) i -= 1;
  if (hh(px >> 1, py >> 1, 363) < 0.01) return 0xece4d4; // shells
  if (dy > edge - 0.25 && hh(px, py >> 1, 364) < 0.25) i -= 0.8; // sand blown into the grass roots
  return tone(SANDP, i, px, py, 0.5);
}

// ── water ────────────────────────────────────────────────────
const water: Floor4 = (x, y, px, py, e) => {
  // the far shore above the continuous waterline
  const cd = y > 33 ? coastY(x) - y : 99;
  if (cd < 0) return beach(x, y, px, py, -cd);
  let shade = 0;
  const w = nearLand(x, y) ? wallAt(x, y, TWALL + 0.34) : null;
  if (w) {
    const z = w.t * 16;
    if (z < QD) return wallPx(w.u, z, w.face, w.edge, Math.round((x - y) * 64 - 0.5), Math.round((x + y) * 32 - 0.5));
    const dt = w.t - TWALL;
    // the waterline: a thin broken line of foam against the wall
    if (dt < 0.032) {
      const f = hh(px >> 1, py, 401) + fn(w.u * 6, 0, 14) * 0.5;
      if (f > 0.42) return FOAMP[f > 0.9 ? 0 : 1];
      shade -= 1.5;
    }
    // the wall's dark wobbly reflection, the quay's shadow beside side walls
    const wob = sinT(px * 0.31 + py * 0.7) * 0.022 + (hh(px >> 2, py, 403) - 0.5) * 0.03;
    if (dt < 0.12 + wob) shade -= 1.7;
    else if (dt < 0.2 + wob) shade -= dith(px, py) > 0.5 ? 1.1 : 0.5;
    if (w.face === 0) shade -= 1.2 * (1 - dt / 0.34);
  }
  const o = openness(x, y);
  const P = o > dith(px >> 1, py >> 1) ? OCP : SEAP;
  const n2 = fn(x * 0.45, y * 0.7, 15);
  let i = 3.4 + o * 0.25 + (e.nA - 0.5) * 0.3 + (n2 - 0.5) * 0.42 + shade;
  // the far shore: a broken line of foam at the beach, lighter shallows
  if (cd < 0.06 + (hh(px >> 2, py >> 1, 405) - 0.5) * 0.05) return FOAMP[hh(px >> 1, py, 404) < 0.6 ? 0 : 1];
  if (cd < 0.2 && hh(px >> 1, py, 406) < 0.35) return FOAMP[2];
  if (cd < 3.2) i += (3.2 - cd) * 0.9;
  // the coaster's wake astern (she steams west): crests slanting in from the two diverging arms, the churned wash on her track
  const wx = x - (COASTER.x + COASTER.w - 0.1);
  if (wx > -0.3 && wx < 10) {
    const cy = COASTER.y + COASTER.d / 2;
    const dy = Math.abs(y - cy);
    const ww = Math.max(0, wx);
    const arm = 1.45 + ww * 0.354;
    if (dy < arm + 0.1) {
      const fade = 1 - ww / 10;
      const inner = arm - dy;
      if (inner > -0.04 && inner < 0.06 + 0.32 * fade) {
        const st = ww * 2.6 - inner * 3.1 + (y > cy ? 0.5 : 0);
        if (frac(st) < 0.16 + 0.1 * fade && hh(Math.floor(st), y > cy ? 1 : 2, 431) < 0.35 + 0.6 * fade && hh(px >> 1, py, 435) < 0.9) return FOAMP[inner < 0.08 && hh(px, py, 432) < 0.6 * fade ? 0 : 1];
      }
      const wash = 0.7 + ww * 0.1;
      if (dy < wash) {
        const n = fn(x * 2.6, y * 4, 433) * 0.7 + hh(px >> 1, py >> 1, 434) * 0.3;
        const th = 0.38 + (1 - fade) * 0.45 + (dy / wash) * 0.2;
        if (n > th) return FOAMP[n > th + 0.25 ? 0 : n > th + 0.1 ? 1 : 2];
        i += 1.4 * fade;
      }
    }
  }
  // a few oil slicks along the quay: a calm glossy film, thin-film colours banded toward its rim
  let calm = false;
  if (o < 0.3 && y < 17.5 && y > 13.6) {
    const n = fn(x * 0.7, y * 1.5, 16);
    if (n > 0.78) {
      calm = true;
      const band = (n - 0.78) * 60;
      if (band < 4) {
        const t = OIL[Math.floor(band * 1.6 + hh(px >> 2, py >> 1, 409) * 0.5) % OIL.length];
        const c = P[ci(i + 0.4, P.length)];
        const a = 0.3 - band * 0.045;
        const k = 1 - a;
        return ((((c >> 16) & 255) * k + ((t >> 16) & 255) * a) << 16) | ((((c >> 8) & 255) * k + ((t >> 8) & 255) * a) << 8) | ((c & 255) * k + (t & 255) * a);
      }
      i += 0.3;
    }
  }
  // ripple rows: broken crest lines (two lit rows, then the trough's two dark rows) that survive the half-res copy
  if (!calm) {
    // (second pass) the reference's water is busy: rows of lit wavelets every ~3.5 px of the
    // picture, each with a dark trough under it, glints of sun on the crests, dark wobbly
    // patches between the rows — sized so they survive the half-res copy and the zoomed-out view
    const yy = py + Math.round(sinT(px * 0.045 + Math.floor(py / 12) * 1.7) * 2.2);
    const row = Math.floor(yy / 12);
    const ly = yy - row * 12;
    const L = 34;
    const sx = px + Math.floor(hh(row, 1, 421) * 90);
    const seg = Math.floor(sx / L);
    const h = hh(seg, row, 422);
    const dens = 0.6 + o * 0.15 + (e.nB - 0.5) * 0.4 + (cd < 5 ? 0.1 : 0);
    let hitSeg = false;
    if (h < dens) {
      const a = Math.floor(hh(seg, row, 423) * 8);
      const len = 9 + Math.floor(hh(seg, row, 424) * (16 + o * 8));
      const fx = sx - seg * L - a;
      if (fx >= 0 && fx < len) {
        hitSeg = true;
        // the wavelet tapers: shorter lit band toward its ends
        const end = fx < 2 || fx > len - 3;
        if (ly < 2) {
          if (!end && h < 0.07 + o * 0.04 && fx > 2 && fx < len - 4) return FOAMP[h < 0.03 ? 0 : 1];
          i += end ? 1.6 : o > 0.5 ? 3.4 : 3.1;
        } else if (ly < 4) i += end ? 0.6 : 1.7;
        else if (ly < 8 && fx > 1 && fx < len - 1) i -= ly < 6 ? 1.9 : 1.3;
      }
    }
    // dark wobbly troughs between the rows, and scattered sun glints
    if (!hitSeg) {
      const tq = fn(x * 1.6, y * 3.2, 22);
      if (ly >= 6 && ly < 10 && tq > 0.5) i -= 1.1 + (tq - 0.5) * 2;
      else if (tq < 0.22) i -= 0.7;
      if (hh(px >> 2, py >> 1, 427) < 0.006 + o * 0.004) return FOAMP[hh(px >> 2, py >> 1, 428) < 0.5 ? 0 : 1];
    }
    // long swell lines out at sea
    if (o > 0.25) {
      const sw = (py + Math.round(sinT(px * 0.021 + (py >> 4) * 1.3) * 3)) % 16;
      if (sw < 2 && n2 > 0.42) i += sw === 0 ? 0.9 : 0.5;
    }
  }
  // dithered in 2×2 cells: the half-resolution copy (a 2×2 mode) keeps the gradients instead of turning them into blotches
  return tone(P, i, px >> 1, py >> 1, 0.8);
};

export const PORT_FLOORS = { concrete, paving, asphalt, sidewalk, hazard, gravel, water };

// ── patches: walkway lanes ───────────────────────────────────
const LANE = ['#2f6a40', '#3b7c4c', '#4b8c5a'];
const LANE_EDGE = ['#c8920e', '#f0c030', '#f9d042'];

/** Paint floor patches straight into the ground (the walkways across the quay). */
export function portPatch(P: Painter, s: FloorPatch, _w: WorldDef) {
  if (s.style !== 'lane') return;
  const k = P.k;
  const c = P.c;
  const corners = [P.P(s.x, s.y), P.P(s.x + s.w, s.y), P.P(s.x + s.w, s.y + s.d), P.P(s.x, s.y + s.d)];
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1])));
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const alongX = s.w >= s.d;
  const len = alongX ? s.w : s.d;
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const X = (px + 0.5 - P.ox) / (16 * k);
      const Y = (py + 0.5 - P.oy) / (8 * k);
      const x = (Y + X) / 2;
      const y = (Y - X) / 2;
      const lu = alongX ? x - s.x : y - s.y;
      const lv = alongX ? y - s.y : x - s.x;
      if (lu < 0 || lu >= len || lv < 0 || lv >= 1) continue;
      const worn = fn(x * 2.4, y * 2.4, 17) + (hh(px >> 1, py >> 1, 452) - 0.5) * 0.3;
      let col: string | null = null;
      if (lv < 0.07 || lv > 0.93) col = LANE_EDGE[hh(px, py, 453) < 0.1 ? 0 : 1 + (lv < 0.035 || lv > 0.965 ? 0 : 1)];
      else if (lv > 0.12 && lv < 0.88) {
        col = LANE[hh(px, py, 454) < 0.07 ? 0 : worn > 0.78 ? 0 : hh(px, py, 456) < 0.05 ? 2 : 1];
        // a double arrow stencilled every 3 tiles, pointing along the lane
        const cell = Math.floor((lu + 0.6) / 3);
        const fu = lu + 0.6 - cell * 3;
        const dv = Math.abs(lv - 0.5);
        if (dv < 0.27 && fu > 0.15 && fu < 0.95) {
          const ch = fu - 0.15 - dv * 0.9;
          if ((ch > 0 && ch < 0.09) || (ch > 0.22 && ch < 0.31)) col = hh(px, py, 455) < 0.12 ? '#c8c6be' : '#ece8de';
        }
        // chevrons near the lane's ends
        if (lu < 0.5 || lu > len - 0.5) {
          const ch = frac((alongX ? lu : len - lu) * 3 + Math.abs(lv - 0.5) * 2);
          if (ch < 0.18) col = '#ece8de';
        }
      }
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(px, py, 1, 1);
    }
}

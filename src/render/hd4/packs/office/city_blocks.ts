// Office — the modern city round the plaza: cream-stone office blocks with
// deep-blue glass and roof gardens, and the clock-tower building.
//   blocco     variant 'ground-storeys-roof', e.g. 'archi-5-giardino':
//                ground   archi | negozi | vetro  (arcade · shops with awnings · glazed lobby)
//                storeys  upper storeys over the ground floor (2..6)
//                roof     giardino | pergola | piante | tecnico
//              any footprint (8×7.75, 17×7.75, 7.75×17, 6×6…): bays, roof cells and
//              planters are laid out from k.w × k.d
//   campanile  a two-storey stone building with a roof garden and palms, and the
//              clock tower at its north-east corner (8 × 11)
// Visible faces are the front (b = d, lit) and the side (a = w, shaded); a block
// placed with rot 1 is drawn mirrored so that the same two faces show.
// 1 z ≈ 10 cm (4 px), a tile ≈ 2 m: a storey is 32 z, the ground floor 38 z.
import type { PropMeta } from '../../../../data/props';
import { darken, lighten } from '../../../color';
import { type FaceTex, type Light, type Mat, texPara } from '../../../hd/kit';
import { poly, type PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, bayer, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, R, type Ramp, rng } from '../../kit4';
import { front3, type Plane, pq, pt, side3 } from '../../plane4';
import { grain, paint } from '../materials';
import { lbox } from '../util';

type V3 = [number, number, number];
type C = CanvasRenderingContext2D;
/** A facade plane: (u, z) on the face, and points pushed `d` tiles out of it. */
type Pl = Plane & { at: (u: number, z: number) => V3; out: (u: number, d: number, z: number) => V3 };
const F3 = (p: PropPainter, b: number): Pl => ({ ...front3(p, b), out: (u, d, z) => [u, b + d, z] });
const S3 = (p: PropPainter, a: number): Pl => ({ ...side3(p, a), out: (u, d, z) => [a + d, u, z] });

// ── palette ─────────────────────────────────────────────────
const IVORY: Ramp = ['#8a7a62', '#a8977c', '#c6b494', '#dccaa8', '#ead9ba', '#f4e7cd', '#fcf4e2'];
const GLASS: Ramp = ['#0a1630', '#0f2448', '#163665', '#1e4a84', '#2a61a2', '#3d7cbd', '#679fd6', '#a6cbee'];
const GREENGL: Ramp = ['#081e18', '#0c2e24', '#124032', '#1a5442', '#256a54', '#36846a', '#58a286', '#8cc4aa'];
const WARM: Ramp = ['#6e3c1c', '#9c5a26', '#c98636', '#e6a64a', '#f4c467', '#fddc8e', '#fff0c4'];
const BRONZE: Ramp = ['#3a2a20', '#54402e', '#6e553c', '#88694a', '#a2805c', '#bc9a72'];
const FRAME: Ramp = ['#5e6670', '#828b95', '#a6aeb6', '#c8ced3', '#e2e6e9', '#f6f8f9'];
const SLAT: Ramp = ['#3a1f0e', '#5a3016', '#7a4420', '#985a2a', '#b47236', '#cc8c4a', '#e0a866'];
const CHAR: Ramp = ['#121614', '#1c2420', '#26302b', '#323e38', '#404e47', '#566860'];
const AWN_G: Ramp = ['#0c3a24', '#125033', '#1a6842', '#238254', '#2f9c66', '#46b47c'];
const AWN_W: Ramp = ['#b8b2a4', '#d6d0c2', '#ebe6da', '#f8f5ee', '#ffffff'];
const WHITE: Ramp = ['#8f8b84', '#aeaaa2', '#cbc7bf', '#e2dfd8', '#f1efea', '#fbfaf7', '#ffffff'];
const TAUPE: Ramp = ['#5a5249', '#746b60', '#8f857a', '#a89f93', '#c1b9ad', '#d7cfc3'];
const TEAK: Ramp = ['#4a2c18', '#6a4024', '#8a5630', '#a66c3c', '#c0844c', '#d6a064', '#e8bc84'];
const METAL: Ramp = ['#4a5058', '#626a74', '#7e8792', '#9aa3ad', '#b8c0c8', '#d4dae0', '#eef1f4'];
const GRAVEL: Ramp = ['#7c7a74', '#94918a', '#aaa79f', '#bebbb3', '#d0cdc5', '#e0ddd6'];
const LEAF: Ramp = ['#173a1e', '#1f4c24', '#2a622c', '#3a7a34', '#4e923c', '#6aaa46', '#8cc254'];
const IVY: Ramp = ['#143220', '#1a4226', '#23562c', '#2e6a32', '#3c803a', '#529846', '#70ae52'];
const BLOOMS = ['#f06a9a', '#fbf7ee', '#f6d34a', '#b07ae0', '#ff8a4a', '#e8406a'];
const SHADOW = '#2a1a2a';

const GH = 38; // ground floor height
const SH = 32; // storey height
const SLAB = 7; // floor slab band at the foot of each storey
const PH = 8; // parapet above the roof deck
const PT = 0.2; // parapet thickness (tiles)
const PXU = 1 / 64; // one screen pixel along a facade, in tiles

// ── small helpers ───────────────────────────────────────────
function tone<T>(pl: Plane, lit: T, shade: T): T {
  return pl.light ? lit : shade;
}
const pts = (p: PropPainter, q: V3[]) => q.map((v) => p.P(v[0], v[1], v[2]));

/** A flat quad on the horizontal plane z. */
function hq(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, col: string) {
  poly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], col);
}
/** A textured quad on the horizontal plane z: u along +a, v from the front edge (b1) back. */
function ht(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, tex: FaceTex) {
  const o = p.P(a0, b1, z);
  const ua = p.P(a1, b1, z);
  const vb = p.P(a0, b0, z);
  texPara(p.c, o, [ua[0] - o[0], ua[1] - o[1]], [vb[0] - o[0], vb[1] - o[1]], tex);
}
/** A see-through quad on a plane (shadows, glows). */
function veil(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, col: string, a: number) {
  const g = p.c.globalAlpha;
  p.c.globalAlpha = a;
  pq(p, pl, u0, u1, z0, z1, col);
  p.c.globalAlpha = g;
}
function veilH(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, col: string, a: number) {
  const g = p.c.globalAlpha;
  p.c.globalAlpha = a;
  hq(p, a0, b0, a1, b1, z, col);
  p.c.globalAlpha = g;
}
/** Screen box of a set of 3D points, padded (for bounded layers). */
function box(p: PropPainter, q: V3[], pad: number): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const v of q) {
    const [x, y] = p.P(v[0], v[1], v[2]);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
/** A box from local faces with flat-ish painted materials. */
const solidBox = (r: Ramp, edge?: string) => ({ front: paint(r), side: paint(r), top: paint(r), edge: edge ?? r[0] });

/** The prop seen with its a axis flipped: a rot-1 placement then shows b = d and a = w like rot 0. */
class Mirror {
  constructor(readonly base: PropPainter) {}
  get c() {
    return this.base.c;
  }
  get k() {
    return this.base.k;
  }
  get rot() {
    return this.base.rot;
  }
  get w() {
    return this.base.w;
  }
  get pw() {
    return this.base.pw;
  }
  get pd() {
    return this.base.pd;
  }
  W(a: number, b: number) {
    return this.base.W(this.base.pw - a, b);
  }
  P(a: number, b: number, z = 0) {
    return this.base.P(this.base.pw - a, b, z);
  }
}
const upright = (p: PropPainter) => (p.rot ? (new Mirror(p) as unknown as PropPainter) : p);

// ── surfaces ────────────────────────────────────────────────
/** Fine stone courses of the ground floor (light, crisp joints). */
const fineStone =
  (light: Light): FaceTex =>
  (u, v, x, y) => {
    const row = Math.floor(v / 9);
    const fv = v - row * 9;
    const fu = (u + (row & 1 ? 13 : 0)) % 26;
    let i = light ? 5 : 3;
    if (fv < 1) i -= 1;
    else if (fu < 1 && (y & 1) === 0) i -= 1;
    else if (fv > 7.6) i += 0.6;
    if (hash(x, y, 71) < 0.025) i -= 1;
    return at(IVORY, i);
  };

/** Deep-blue (or green) glass: sky reflections in long diagonal streaks, the slab's shadow on top. */
function glassTex(light: Light, hpx: number, tint: Ramp, seed: number): FaceTex {
  const b = light ? 3 : 2;
  return (_u, v, x, y) => {
    let i = b;
    const d = (((x * 0.62 + y + seed * 41) % 170) + 170) % 170;
    if (d < 24) i += d < 9 ? 2.4 : 1.4;
    else if (d > 70 && d < 73) i += 2;
    else if (d > 104 && d < 126) i += 0.7;
    if (v > hpx - 9) i -= 1.4;
    else if (v < 3) i -= 0.7;
    return at(tint, i + (bayer(x, y) - 0.5) * 0.6);
  };
}

/** A lit office seen through the glass: a bright ceiling strip, a warm room, a faint reflection. */
function litTex(light: Light, hpx: number, seed: number): FaceTex {
  const b = light ? 4 : 3;
  return (_u, v, x, y) => {
    let i = b;
    if (v > hpx - 7) i = light ? 1 : 0;
    else if (v > hpx - 9) i = 6;
    else if (v > hpx - 24) i += 1;
    if (v < 4) i -= 1;
    const d = (((x * 0.62 + y + seed * 41) % 170) + 170) % 170;
    if (d < 7) i += 0.7;
    return at(WARM, i + (bayer(x, y) - 0.5) * 0.5);
  };
}

const bronzeTex =
  (light: Light, hpx: number): FaceTex =>
  (u, v) =>
    at(BRONZE, (light ? 3 : 2) + (u % 7 < 1 ? -1 : 0) + (v > hpx - 8 ? -1 : 0) + (v < 2 ? -1 : 0));

// ── the block's plan (shared by draw and lights) ────────────
type Ground = 'archi' | 'negozi' | 'vetro';
type Roof = 'giardino' | 'pergola' | 'piante' | 'tecnico';
type PaneKind = 'g' | 'e' | 'n';
interface Face {
  u0: number;
  u1: number;
  /** pilasters [u0, u1] (corners included) */
  piers: [number, number][];
  /** glass between pilasters */
  bays: [number, number][];
  /** bay columns covered by timber slats */
  slats: [number, number] | null;
}
interface Plan {
  seed: number;
  ground: Ground;
  storeys: number;
  roof: Roof;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  ze: number;
  faces: [Face, Face];
  /** planters along a floor slab: the face, the storey, the first bay and how many bays */
  balcony: { fi: number; s: number; c0: number; run: number }[];
  /** a setback penthouse on the roof: a0, b0, a1, b1 */
  pent: [number, number, number, number] | null;
  /** roof cells and what stands in each */
  cells: Cell[];
}
interface Cell {
  a0: number;
  b0: number;
  a1: number;
  b1: number;
  g: string;
}

function parseVariant(v?: string): { ground: Ground; storeys: number; roof: Roof } {
  const [g, s, r] = (v ?? '').split('-');
  const ground: Ground = g === 'negozi' || g === 'vetro' ? g : 'archi';
  const storeys = Math.max(1, Math.min(8, Math.round(Number(s)) || 4));
  const roof: Roof = r === 'pergola' || r === 'piante' || r === 'tecnico' ? r : 'giardino';
  return { ground, storeys, roof };
}

function facePlan(u0: number, u1: number): Face {
  const len = u1 - u0;
  const n = Math.max(1, Math.round(len / 1.45));
  const piers: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const c = u0 + (len * i) / n;
    piers.push(i === 0 ? [u0, u0 + 0.36] : i === n ? [u1 - 0.36, u1] : [c - 0.13, c + 0.13]);
  }
  const bays: [number, number][] = [];
  for (let i = 0; i < n; i++) bays.push([piers[i][1], piers[i + 1][0]]);
  return { u0, u1, piers, bays, slats: null };
}

function planBlock(k: PropCtx): Plan {
  const { ground, storeys, roof } = parseVariant(k.variant);
  const seed = (k.seed | 0) * 7919 + 13;
  const a0 = 0.05;
  const a1 = k.w - 0.05;
  const b0 = 0.05;
  const b1 = k.d - 0.05;
  const ze = GH + storeys * SH;
  const faces: [Face, Face] = [facePlan(a0, a1), facePlan(b0, b1)];
  // most blocks carry a run of timber slats with ivy on one face
  if (hash(seed, 1, 3) < 0.8) {
    const f = faces[hash(seed, 2, 3) < 0.5 ? 0 : 1];
    const n = f.bays.length;
    const span = n >= 7 ? 3 : 2;
    if (n >= 3) {
      const s0 = Math.floor(hash(seed, 3, 3) * (n - span + 1));
      f.slats = [s0, s0 + span - 1];
    }
  }
  // planters along one floor slab of each face
  const balcony: Plan['balcony'] = [];
  faces.forEach((f, fi) => {
    if (storeys < 2 || hash(seed, 4 + fi, 3) > 0.7) return;
    const s = 1 + Math.floor(hash(seed, 6 + fi, 3) * (storeys - 1));
    const n = f.bays.length;
    const run = Math.min(n, 2 + Math.floor(hash(seed, 8 + fi, 3) * 3));
    const c0 = Math.floor(hash(seed, 10 + fi, 3) * (n - run + 1));
    balcony.push({ fi, s, c0, run });
  });
  // the roof is cut into cells of about 3.3 tiles, each with its own group of things;
  // beds along the back parapets take the first strip
  const bed = roof === 'tecnico' ? 0 : 0.62;
  const A0 = a0 + PT + 0.08 + bed;
  const B0 = b0 + PT + 0.08 + bed;
  const A1 = a1 - PT - 0.1;
  const B1 = b1 - PT - 0.1;
  const nA = Math.max(1, Math.round((A1 - A0) / 3.3));
  const nB = Math.max(1, Math.round((B1 - B0) / 3.3));
  const cw = (A1 - A0) / nA;
  const cd = (B1 - B0) / nB;
  // a setback penthouse in a back cell of bigger roofs
  let pent: Plan['pent'] = null;
  let pi = -1;
  if (nA >= 2 && nB >= 2 && hash(seed, 12, 3) < 0.55) {
    pi = hash(seed, 13, 3) < 0.4 ? nA - 1 : 0;
    pent = [A0 + pi * cw + 0.15, B0 + 0.1, A0 + (pi + 1) * cw - 0.2, B0 + cd - 0.25];
  }
  const groups: Record<Roof, string[]> = {
    giardino: ['lounge', 'green', 'trees', 'loungers', 'green', 'lounge', 'trees'],
    pergola: ['pergola', 'green', 'trees', 'lounge', 'green', 'pergola'],
    piante: ['rows', 'rows', 'green', 'rows', 'trees', 'rows'],
    tecnico: ['ac', 'vents', 'ac', 'green', 'ac', 'vents'],
  };
  const list = groups[roof];
  const off = Math.floor(hash(seed, 14, 3) * list.length);
  const cells: Cell[] = [];
  let n = 0;
  for (let j = 0; j < nB; j++)
    for (let i = 0; i < nA; i++) {
      if (j === 0 && i === pi) continue;
      // the first group goes to the front row where it shows best
      const g = j === nB - 1 && i === Math.floor((nA - 1) / 2) ? list[0] : list[(off + n++) % list.length];
      cells.push({ a0: A0 + i * cw + 0.1, b0: B0 + j * cd + 0.1, a1: A0 + (i + 1) * cw - 0.1, b1: B0 + (j + 1) * cd - 0.1, g });
    }
  // a technical roof always has its stair housing (in the penthouse's place when there is none)
  if (roof === 'tecnico' && !pent && cells.length > 1) cells[0].g = 'stair';
  return { seed, ground, storeys, roof, a0, a1, b0, b1, ze, faces, balcony, pent, cells };
}

const inSlats = (f: Face, col: number) => !!f.slats && col >= f.slats[0] && col <= f.slats[1];
const patOf = (P: Plan, fi: number, col: number) => Math.floor(hash(fi * 31 + col, 5, P.seed) * 5);
function panesOf(g0: number, g1: number, pat: number): [number, number, PaneKind][] {
  const w = g1 - g0;
  const n = w * 0.2;
  const m = (w - n) / 2;
  switch (pat) {
    case 0:
      return [[g0, g0 + w / 2, 'g'], [g0 + w / 2, g1, 'g']];
    case 1:
      return [[g0, g0 + m, 'g'], [g0 + m, g1 - n, 'g'], [g1 - n, g1, 'n']];
    case 2:
      return [[g0, g0 + n, 'n'], [g0 + n, g0 + n + m, 'g'], [g0 + n + m, g1, 'g']];
    case 3:
      return [[g0, g0 + w / 3, 'g'], [g0 + w / 3, g0 + (2 * w) / 3, 'e'], [g0 + (2 * w) / 3, g1, 'g']];
    default:
      return [[g0, g0 + w * 0.42, 'e'], [g0 + w * 0.42, g1, 'g']];
  }
}
const paneLit = (P: Plan, fi: number, col: number, s: number, pi: number, kind: PaneKind) =>
  kind !== 'e' && hash(fi * 97 + col * 7 + pi, s * 13 + 1, P.seed) < (kind === 'n' ? 0.3 : 0.24);

// ── interiors glimpsed through lit panes ────────────────────
const SIL = ['#4a2c18', '#6a4226', '#865632'];
function interior(p: PropPainter, pl: Pl, ua: number, ub: number, za: number, zt: number, h: number) {
  const w = ub - ua;
  const kind = Math.floor(h * 8.6) % 9;
  const c = ua + w * (0.38 + hash(Math.floor(h * 1e6), 3, 5) * 0.24);
  const q = (u0: number, u1: number, z0: number, z1: number, col: string) => pq(p, pl, Math.max(ua, u0), Math.min(ub, u1), z0, Math.min(zt - 7, z1), col);
  // a pendant lamp
  if (kind !== 5) {
    q(c - 0.004, c + 0.012, zt - 7, zt - 3, SIL[0]);
    const [lx, ly] = pl.F(c, zt - 9.5);
    ell(p.c, lx, ly, 3, 1.5, '#fff6d6');
  }
  switch (kind) {
    case 0: // a desk with a monitor, a chair in front
    case 6:
      q(c - 0.16, c + 0.16, za + 6.6, za + 7.4, SIL[1]);
      q(c - 0.15, c - 0.13, za, za + 6.6, SIL[0]);
      q(c + 0.13, c + 0.15, za, za + 6.6, SIL[0]);
      q(c - 0.07, c + 0.04, za + 7.4, za + 11.6, '#2a2a30');
      q(c - 0.06, c + 0.03, za + 8, za + 11.1, kind ? '#9ad8f2' : '#bfe6c8');
      q(c + 0.05, c + 0.12, za + 2, za + 9.5, SIL[0]);
      q(c + 0.02, c + 0.14, za + 3.6, za + 4.6, SIL[0]);
      break;
    case 1: {
      // a big potted plant
      q(c - 0.05, c + 0.05, za, za + 4, '#ece2cc');
      const [x, y] = pl.F(c, za + 9);
      ell(p.c, x, y, 7, 7, '#3c6a2c');
      ell(p.c, x - 2, y - 2, 4, 4, '#5e9a3a');
      px(p.c, x + 2, y + 1, '#2c5222', 2, 2);
      break;
    }
    case 2: // a floor lamp and an armchair
      q(c - 0.004, c + 0.012, za, za + 14, SIL[0]);
      q(c - 0.05, c + 0.06, za + 14, za + 17, '#fff4d0');
      q(c + 0.08, c + 0.26, za, za + 4.4, SIL[1]);
      q(c + 0.08, c + 0.11, za, za + 8, SIL[0]);
      break;
    case 3: // a bookcase
      q(c - 0.17, c + 0.17, za, za + 17, SIL[0]);
      for (let r = 0; r < 4; r++)
        for (let i = 0; i < 6; i++) q(c - 0.15 + i * 0.05, c - 0.12 + i * 0.05, za + 1.2 + r * 4, za + 4 + r * 4 - (i % 3) * 0.4, ['#c8382a', '#2e5a8a', '#e8d8b8', '#3a6a3a', '#d8a040', '#7a3a5a'][(i + r * 2) % 6]);
      break;
    case 4: {
      // somebody standing by the window: legs, a jacket, arms, a head
      const sk = SIL[0];
      q(c - 0.036, c - 0.008, za, za + 7.6, sk);
      q(c + 0.008, c + 0.036, za, za + 7.6, sk);
      q(c - 0.058, c + 0.058, za + 7.2, za + 13.4, SIL[1]);
      q(c - 0.075, c - 0.058, za + 7.8, za + 13, sk);
      q(c + 0.058, c + 0.075, za + 7.8, za + 13, sk);
      q(c - 0.02, c + 0.02, za + 13.4, za + 14.2, sk);
      const [x, y] = pl.F(c, za + 15.6);
      ell(p.c, x, y, 2.6, 3, sk);
      break;
    }
    case 5: {
      // a meeting: a long table, two people seated across it, a screen on the wall
      q(c - 0.22, c + 0.22, za + 6.6, za + 7.4, SIL[1]);
      q(c - 0.2, c - 0.18, za, za + 6.6, SIL[0]);
      q(c + 0.18, c + 0.2, za, za + 6.6, SIL[0]);
      q(c - 0.1, c + 0.1, za + 12, za + 17, '#2a2a30');
      q(c - 0.09, c + 0.09, za + 12.5, za + 16.5, '#7ac8e8');
      for (const sd of [-0.13, 0.13]) {
        q(c + sd - 0.045, c + sd + 0.045, za + 7.4, za + 11.4, SIL[0]);
        const [x, y] = pl.F(c + sd, za + 12.8);
        ell(p.c, x, y, 2.6, 3, SIL[0]);
      }
      break;
    }
    case 7: {
      // two desks back to back with their screens
      for (const sd of [-0.12, 0.12]) {
        q(c + sd - 0.1, c + sd + 0.1, za + 6.6, za + 7.4, SIL[1]);
        q(c + sd - 0.09, c + sd - 0.07, za, za + 6.6, SIL[0]);
        q(c + sd - 0.04, c + sd + 0.04, za + 7.4, za + 10.8, '#2a2a30');
        q(c + sd - 0.03, c + sd + 0.03, za + 7.9, za + 10.4, '#a8dcf2');
      }
      break;
    }
    default:
      break;
  }
}

// ── a pane of the curtain wall ──────────────────────────────
function pane(p: PropPainter, pl: Pl, u0: number, u1: number, za: number, zt: number, kind: PaneKind, lit: boolean, seed: number) {
  const L = pl.light;
  const hpx = (zt - za) * 4;
  if (kind === 'n') pt(p, pl, u0, u1, za, zt, lit ? litTex(L, hpx, seed) : bronzeTex(L, hpx));
  else if (kind === 'e') pt(p, pl, u0, u1, za, zt, glassTex(L, hpx, GREENGL, seed));
  else if (lit) {
    pt(p, pl, u0, u1, za, zt, litTex(L, hpx, seed));
    interior(p, pl, u0 + 0.03, u1 - 0.03, za, zt, hash(Math.round(u0 * 100), Math.round(za), seed));
  } else {
    pt(p, pl, u0, u1, za, zt, glassTex(L, hpx, GLASS, seed));
    // blinds half down here and there
    const hb = hash(Math.round(u0 * 100), Math.round(za), seed + 7);
    if (hb < 0.14) {
      const zb = zt - 7 - (zt - za - 9) * (0.25 + hb * 4);
      pq(p, pl, u0, u1, zb, zt - 7, tone(pl, '#c9ccc8', '#a6aaa8'));
      for (let z = zb + 1.2; z < zt - 7; z += 1.5) pq(p, pl, u0, u1, z, z + 0.3, tone(pl, '#e8eae6', '#bcc0be'));
    }
  }
  // the frame: jambs, sill, a transom and a mullion
  const fc = FRAME[L ? 4 : 3];
  pq(p, pl, u0, u0 + 1.5 * PXU, za, zt, fc);
  pq(p, pl, u1 - 1.5 * PXU, u1, za, zt, fc);
  pq(p, pl, u0, u1, za, za + 0.5, fc);
  if (kind !== 'n') {
    pq(p, pl, u0, u1, zt - 7.5, zt - 7, fc);
    if (u1 - u0 > 0.42) pq(p, pl, (u0 + u1) / 2 - PXU, (u0 + u1) / 2 + 0.5 * PXU, za, zt - 7, fc);
  }
}

// ── stone frame: slabs, pilasters, parapet band ─────────────
function slab(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, h: number) {
  pq(p, pl, u0, u1, z0, z0 + h, IVORY[tone(pl, 5, 3)]);
  pq(p, pl, u0, u1, z0 + h - 0.6, z0 + h, IVORY[tone(pl, 6, 4)]);
  pq(p, pl, u0, u1, z0, z0 + 0.35, IVORY[tone(pl, 3, 2)]);
  // a joint now and then
  for (let u = u0 + 1.1; u < u1 - 0.3; u += 1.35) pq(p, pl, u, u + PXU, z0 + 0.35, z0 + h - 0.6, IVORY[tone(pl, 4, 2)]);
}
function pier(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, corner: boolean) {
  pq(p, pl, u0, u1, z0, z1, IVORY[tone(pl, 5, 3)]);
  // the visible flank of the pilaster faces the other way (shaded on the front, lit on the side)
  if (!corner) pq(p, pl, u1 - 3 * PXU, u1, z0, z1, IVORY[tone(pl, 3, 5)]);
  else pq(p, pl, u0, u0 + PXU, z0, z1, IVORY[tone(pl, 6, 4)]);
}

/** The upper storeys of one face: glass bays, slabs, pilasters, the parapet band, slats. */
function upperFace(p: PropPainter, P: Plan, f: Face, fi: number, pl: Pl) {
  const { storeys, ze } = P;
  for (let s = 0; s < storeys; s++) {
    const zb = GH + s * SH;
    const za = zb + SLAB + (s === 0 ? 1 : 0);
    const zt = zb + SH;
    f.bays.forEach(([g0, g1], col) => {
      if (inSlats(f, col)) return;
      panesOf(g0, g1, patOf(P, fi, col)).forEach(([u0, u1, kind], pi) => pane(p, pl, u0, u1, za, zt, kind, paneLit(P, fi, col, s, pi, kind), P.seed + fi));
      // the pilaster's shadow on the recessed glass (lit face)
      if (pl.light) veil(p, pl, g0, g0 + 5 * PXU, za, zt, SHADOW, 0.32);
    });
  }
  for (let s = 0; s < storeys; s++) slab(p, pl, f.u0, f.u1, GH + s * SH, s === 0 ? SLAB + 1 : SLAB);
  f.piers.forEach(([u0, u1], i) => pier(p, pl, u0, u1, GH, ze, i === f.piers.length - 1 || i === 0));
  // the parapet band, its lit lip and a shadow line under the coping
  pq(p, pl, f.u0, f.u1, ze, ze + PH, IVORY[tone(pl, 5, 3)]);
  pq(p, pl, f.u0, f.u1, ze + PH - 0.7, ze + PH, IVORY[tone(pl, 6, 4)]);
  pq(p, pl, f.u0, f.u1, ze + PH - 1.6, ze + PH - 1.2, IVORY[tone(pl, 4, 2)]);
  pq(p, pl, f.u0, f.u1, ze, ze + 0.4, IVORY[tone(pl, 3, 2)]);
  if (f.slats) slats(p, P, f, pl);
  // planters along one floor slab: a balcony of greenery over a run of bays
  for (const { fi: bfi, s, c0, run } of P.balcony) {
    if (bfi !== fi) continue;
    // one continuous trough over the run, broken only where the slats are
    let start = -1;
    for (let col = c0; col <= c0 + run && col <= f.bays.length; col++) {
      const ok = col < c0 + run && col < f.bays.length && !inSlats(f, col);
      if (ok && start < 0) start = col;
      if (!ok && start >= 0) {
        balconyPlanter(p, pl, f.bays[start][0] - 0.06, f.bays[col - 1][1] + 0.06, GH + s * SH + SLAB, P.seed + start * 7 + s);
        start = -1;
      }
    }
  }
}

/** A slim stone trough on a floor slab with shrubs, flowers and trailing stems. */
function balconyPlanter(p: PropPainter, pl: Pl, u0: number, u1: number, z: number, seed: number) {
  lbox(p, ...outBox(pl, u0, u1, 0.16), z - 0.6, 3.2, solidBox(IVORY, IVORY[1]));
  const Rn = rng(seed);
  const masses: Mass[] = [];
  for (let u = u0 + 0.05; u < u1 - 0.02; u += 0.09) {
    const [x, y] = p.P(...pl.out(u, 0.08, z + 2.6));
    const r = 7 + Rn() * 4;
    masses.push({ x, y: y - r * 0.45, rx: r, ry: r * 0.8, z: y });
  }
  for (let u = u0 + 0.1; u < u1 - 0.05; u += 0.2 + Rn() * 0.2) {
    const len = 2 + Rn() * 5;
    for (let zz = z + 1; zz > z - len; zz -= 1.2) {
      const [x, y] = p.P(...pl.out(u + (Rn() - 0.5) * 0.02, 0.18, zz));
      masses.push({ x, y, rx: 3.6, ry: 3.2, z: 1e4 });
    }
  }
  const set = BLOOM_SETS[Math.floor(Rn() * BLOOM_SETS.length)];
  layer(p.c, (l) => foliage(l, masses, LEAF, seed, { cell: 2.6, tilt: 0.2, dots: set, dotChance: 0.45, dotSize: 3 }), { outline: 0.55, rect: box(p, [pl.out(u0, 0, z + 6), pl.out(u1, 0.3, z - 12)], 22) });
}

/** A run of vertical timber fins from the first storey to the top, ivy hanging from the roof and climbing up. */
function slats(p: PropPainter, P: Plan, f: Face, pl: Pl) {
  const [s0, s1] = f.slats!;
  const u0 = f.bays[s0][0] - 0.02;
  const u1 = f.bays[s1][1] + 0.02;
  const z0 = GH + SLAB + 1;
  const z1 = P.ze + PH - 1.6;
  const L = pl.light;
  const period = 7;
  pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => {
    const fu = u % period;
    if (fu < 2) return v > (z1 - z0) * 4 - 10 ? '#140e0a' : '#21170f';
    let i = L ? 4 : 3;
    if (fu > period - 1.6) i += L ? -1.2 : 1.2;
    else if (fu < 3) i += L ? 0.8 : -0.4;
    const fin = Math.floor(u / period);
    if (hash(fin, Math.floor(v / 11), P.seed) < 0.22) i -= 0.6;
    if (hash(fin, 0, P.seed + 1) < 0.3) i -= 0.5;
    if (hash(x, y, 9) < 0.02) i -= 1;
    return at(SLAT, i);
  });
  // a top and bottom rail
  pq(p, pl, u0, u1, z0, z0 + 0.8, SLAT[tone(pl, 2, 1)]);
  // ivy: strands hanging from the roof, climbers from the foot, a thick fringe along the top
  // (each drawn on its own small layer: one big foliage box over the whole face is slow)
  const Rn = rng(P.seed + 17);
  const ivy = (masses: Mass[], q: V3[], seed: number) => layer(p.c, (l) => foliage(l, masses, IVY, seed, { cell: 3, tilt: 0.22, holes: 0.04, dots: ['#f4f0e4', '#b07ae0'], dotChance: 0.05, dotSize: 3 }), { outline: 0.55, rect: box(p, q, 20) });
  let n = 0;
  for (let u = u0 + 0.06; u < u1 - 0.04; u += 0.15 + Rn() * 0.14) {
    const len = 10 + Rn() * Math.min(84, (z1 - z0) * 0.7);
    let du = 0;
    const masses: Mass[] = [];
    for (let z = z1 - 3; z > z1 - len; z -= 1.8) {
      const t = (z1 - z) / len;
      du += (Rn() - 0.5) * 0.025;
      const [x, y] = pl.F(u + du, z);
      masses.push({ x: x + (Rn() - 0.5) * 3, y, rx: 6.5 - t * 2.6 + Rn() * 1.5, ry: 5.5 - t * 2 + Rn(), z: 50 - t * 10 });
    }
    ivy(masses, [pl.at(u - 0.1, z1), pl.at(u + 0.1, z1 - len)], P.seed + n++);
  }
  for (const uc of [u0 + 0.14, u1 - 0.2]) {
    if (Rn() < 0.3) continue;
    const top = z0 + 14 + Rn() * Math.min(70, z1 - z0 - 20);
    const masses: Mass[] = [];
    for (let z = z0 - 3; z < top; z += 2) {
      const t = (z - z0) / (top - z0);
      const [x, y] = pl.F(uc + Math.sin(z * 0.13) * 0.06, z);
      masses.push({ x, y, rx: 9 - t * 3.4 + Rn() * 1.5, ry: 7.5 - t * 2.4, z: 30 });
    }
    ivy(masses, [pl.at(uc - 0.15, z0 - 3), pl.at(uc + 0.15, top)], P.seed + n++);
  }
  for (let c = u0 + 0.02; c < u1 + 0.02; c += 0.72) {
    const masses: Mass[] = [];
    for (let u = c; u < Math.min(c + 0.72, u1 + 0.02); u += 0.09) {
      const [x, y] = pl.F(u, z1 - 1 - Rn() * 3);
      masses.push({ x, y: y + 3, rx: 9 + Rn() * 4, ry: 8 + Rn() * 3, z: 100 });
    }
    ivy(masses, [pl.at(c, z1), pl.at(c + 0.72, z1)], P.seed + n++);
  }
}

// ── ground floors ───────────────────────────────────────────
function archPts(c: number, hw: number, zs: number, rz: number): [number, number][] {
  const out: [number, number][] = [[c - hw, 0]];
  for (let j = 0; j <= 18; j++) {
    const t = Math.PI - (j / 18) * Math.PI;
    out.push([c + Math.cos(t) * hw, zs + Math.sin(t) * rz]);
  }
  out.push([c + hw, 0]);
  return out;
}
const fillOn = (p: PropPainter, pl: Pl, q: [number, number][], col: string) => fillPoly(p.c, q.map(([u, z]) => pl.F(u, z)), col);

/** The shop window glimpsed at the back of an arch or behind a shopfront: warm light, goods on shelves. */
function display(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, seed: number) {
  const L = pl.light;
  pt(p, pl, u0, u1, z0, z1, litTex(L, (z1 - z0) * 4, seed));
  const Rn = rng(seed);
  const w = u1 - u0;
  const kind = Math.floor(Rn() * 4);
  if (kind === 0) {
    // shelves of goods
    for (let s = 0; s < 3; s++) {
      const z = z0 + 2 + s * ((z1 - z0 - 5) / 3);
      pq(p, pl, u0, u1, z, z + 0.6, SIL[1]);
      for (let u = u0 + 0.02; u < u1 - 0.05; u += 0.045 + Rn() * 0.03) pq(p, pl, u, u + 0.03, z + 0.6, z + 2 + Rn() * 1.6, ['#c8382a', '#2e5a8a', '#f2ead8', '#3a7a4a', '#e8b030', '#8a3a6a'][Math.floor(Rn() * 6)]);
    }
  } else if (kind === 1) {
    // a mannequin in a dress on a plinth
    const c = u0 + w * 0.5;
    pq(p, pl, c - 0.09, c + 0.09, z0, z0 + 1.5, SIL[0]);
    fillOn(p, pl, [[c - 0.07, z0 + 1.5], [c + 0.07, z0 + 1.5], [c + 0.03, z0 + 10], [c - 0.03, z0 + 10]], ['#c8382a', '#1e4a6a', '#2e6a4a', '#e8577a'][Math.floor(Rn() * 4)]);
    pq(p, pl, c - 0.035, c + 0.035, z0 + 10, z0 + 12.5, '#e8d6c0');
    const [x, y] = pl.F(c, z0 + 13.6);
    ell(p.c, x, y, 2.5, 2.5, '#e8d6c0');
  } else if (kind === 2) {
    // bags and vases on stands
    for (let i = 0; i < 3; i++) {
      const c = u0 + w * (0.2 + i * 0.3);
      const z = z0 + 1 + (i % 2) * 4;
      pq(p, pl, c - 0.04, c + 0.04, z0, z, SIL[0]);
      const [x, y] = pl.F(c, z + 2.6);
      ell(p.c, x, y, 4, 3.5, ['#c8a050', '#8a2a3a', '#2e4a6a', '#e8e0d0'][(i + Math.floor(Rn() * 4)) % 4]);
      px(p.c, x - 2, y - 2, '#fff8e8', 1, 1);
    }
  } else {
    // a café counter with a coffee machine and cakes
    pq(p, pl, u0, u1, z0, z0 + 7, SIL[1]);
    pq(p, pl, u0, u1, z0 + 7, z0 + 7.6, '#e8dcc8');
    pq(p, pl, u0 + w * 0.15, u0 + w * 0.38, z0 + 7.6, z0 + 11.5, '#b8bcc4');
    for (let i = 0; i < 3; i++) {
      const [x, y] = pl.F(u0 + w * (0.55 + i * 0.13), z0 + 8.4);
      ell(p.c, x, y, 2.6, 1.8, ['#f2c0d0', '#8a5030', '#f8ecd0'][i]);
    }
  }
}

/** A round arch in the stone base: a moulded surround, the dark arcade, a shop or a door at the back. */
function arch(p: PropPainter, pl: Pl, c: number, hw: number, door: boolean, seed: number) {
  const L = pl.light;
  const zs = 21;
  const rz = hw * 19.6;
  // the surround: a band of voussoirs with a keystone
  fillOn(p, pl, archPts(c, hw + 0.08, zs, rz + 1.8), IVORY[tone(pl, 3, 2)]);
  for (let j = 1; j < 9; j++) {
    const t = Math.PI - (j / 9) * Math.PI;
    const [x0, y0] = pl.F(c + Math.cos(t) * hw, zs + Math.sin(t) * rz);
    const [x1, y1] = pl.F(c + Math.cos(t) * (hw + 0.08), zs + Math.sin(t) * (rz + 1.8));
    ln(p.c, x0, y0, x1, y1, IVORY[tone(pl, 2, 1)]);
  }
  fillOn(p, pl, [[c - 0.05, zs + rz - 0.4], [c + 0.05, zs + rz - 0.4], [c + 0.07, zs + rz + 2.4], [c - 0.07, zs + rz + 2.4]], IVORY[tone(pl, 6, 4)]);
  // the reveal (the jamb's face toward the viewer) then the shadowed depth of the arcade
  fillOn(p, pl, archPts(c, hw, zs, rz), IVORY[tone(pl, 2, 4)]);
  fillOn(p, pl, archPts(c + 0.04, hw - 0.04, zs, rz - 0.8), '#22180f');
  pq(p, pl, c - hw + 0.08, c + hw, 0, 9, '#2c2016');
  if (door) {
    // a glazed door, warm light behind it, a fanlight in the arch
    pq(p, pl, c - hw * 0.62, c + hw * 0.7, 0, zs + 1, '#16100c');
    pt(p, pl, c - hw * 0.55, c + hw * 0.63, 0, zs, litTex(L, zs * 4, seed));
    pq(p, pl, c + 0.04 - PXU, c + 0.04 + PXU, 0, zs, '#16100c');
    pq(p, pl, c - hw * 0.55, c + hw * 0.63, 10.5, 11, '#16100c');
    fillOn(p, pl, archPts(c + 0.04, hw * 0.58, zs + 1.4, rz * 0.62).slice(1, -1).concat([[c + 0.04 + hw * 0.58, zs + 1.4], [c + 0.04 - hw * 0.58, zs + 1.4]]), WARM[5]);
    for (let j = 1; j < 4; j++) {
      const t = Math.PI - (j / 4) * Math.PI;
      const [x0, y0] = pl.F(c + 0.04, zs + 1.4);
      const [x1, y1] = pl.F(c + 0.04 + Math.cos(t) * hw * 0.58, zs + 1.4 + Math.sin(t) * rz * 0.62);
      ln(p.c, x0, y0, x1, y1, '#16100c');
    }
  } else {
    pq(p, pl, c - hw * 0.62, c + hw * 0.7, 2.4, 18.6, '#16100c');
    display(p, pl, c - hw * 0.55, c + hw * 0.63, 3, 18, seed);
    // a lamp hanging in the vault
    const [lx, ly] = pl.F(c + 0.04, zs + rz * 0.55);
    px(p.c, lx, ly - 8, '#3a2a20', 1, 6);
    ell(p.c, lx, ly, 3, 2.4, '#ffe6a0');
    px(p.c, lx - 1, ly - 1, '#fffbe8', 2, 1);
  }
}

/** A shopfront: dark frame, warm windows full of goods, maybe a glass door, a sign. */
function shopfront(p: PropPainter, pl: Pl, c: number, hw: number, door: boolean, seed: number) {
  const L = pl.light;
  pq(p, pl, c - hw - 0.05, c + hw + 0.05, 0, 27, CHAR[tone(pl, 2, 1)]);
  const m = door ? c + hw * 0.18 : c;
  display(p, pl, c - hw, m - 0.03, 1.6, 25.4, seed);
  if (door) {
    pt(p, pl, m + 0.03, c + hw, 0, 24.6, litTex(L, 24.6 * 4, seed + 1));
    pq(p, pl, m + 0.03, c + hw, 0, 0.8, CHAR[1]);
    const [hx, hy] = pl.F(m + 0.09, 11);
    px(p.c, hx, hy - 6, '#d8b048', 1, 7);
  } else display(p, pl, m + 0.03, c + hw, 1.6, 25.4, seed + 1);
  pq(p, pl, m - 0.03, m + 0.03, 0, 27, CHAR[tone(pl, 3, 2)]);
  // the sign above the awning: a dark fascia with gold lettering
  pq(p, pl, c - hw - 0.05, c + hw + 0.05, 31.6, 35.6, CHAR[tone(pl, 3, 2)]);
  pq(p, pl, c - hw - 0.05, c + hw + 0.05, 35.2, 35.6, CHAR[tone(pl, 5, 4)]);
  const Rn = rng(seed + 3);
  const n = Math.max(3, Math.round(hw * 9));
  for (let i = 0; i < n; i++) {
    const u = c - hw * 0.7 + (i * hw * 1.4) / n;
    pq(p, pl, u, u + 0.035, 32.8, 34.4 + (Rn() < 0.3 ? 0.5 : 0), '#f0d078');
  }
}

/** A striped awning sloping out of the wall: green and white, a scalloped valance, its shadow below. */
function awning(p: PropPainter, pl: Pl, u0: number, u1: number, zw: number) {
  const out = 0.64;
  const drop = 4.2;
  const vh = 2.4;
  const sw = 0.13;
  // shadow on the shopfront and on the ground
  veil(p, pl, u0, u1, zw - 9, zw, SHADOW, 0.28);
  const g = p.c.globalAlpha;
  p.c.globalAlpha = 0.18;
  fillPoly(p.c, pts(p, [pl.out(u0 + 0.1, 0, 0), pl.out(u1 + 0.1, 0, 0), pl.out(u1 + 0.3, out + 0.15, 0), pl.out(u0 + 0.3, out + 0.15, 0)]), SHADOW);
  p.c.globalAlpha = g;
  const n = Math.max(2, Math.round((u1 - u0) / sw));
  const s = (u1 - u0) / n;
  for (let i = 0; i < n; i++) {
    const a = u0 + i * s;
    const b = a + s;
    const green = i % 2 === 0;
    const top = green ? AWN_G : AWN_W;
    // the sloping top, lighter near the wall where it bends
    fillPoly(p.c, pts(p, [pl.out(a, 0, zw), pl.out(b, 0, zw), pl.out(b, out, zw - drop), pl.out(a, out, zw - drop)]), top[green ? 3 : 3]);
    fillPoly(p.c, pts(p, [pl.out(a, 0, zw), pl.out(b, 0, zw), pl.out(b, 0.12, zw - 0.8), pl.out(a, 0.12, zw - 0.8)]), top[green ? 4 : 4]);
    fillPoly(p.c, pts(p, [pl.out(a, out - 0.1, zw - drop + 0.66), pl.out(b, out - 0.1, zw - drop + 0.66), pl.out(b, out, zw - drop), pl.out(a, out, zw - drop)]), top[green ? 2 : 2]);
    // the valance with a scalloped hem
    fillPoly(p.c, pts(p, [pl.out(a, out, zw - drop), pl.out(b, out, zw - drop), pl.out(b, out, zw - drop - vh), pl.out(a, out, zw - drop - vh)]), top[tone(pl, green ? 2 : 2, green ? 1 : 1)]);
    const [hx, hy] = p.P(...pl.out(a + s / 2, out, zw - drop - vh));
    ell(p.c, hx, hy, 3.2, 1.6, top[tone(pl, green ? 2 : 2, green ? 1 : 1)]);
  }
  // the end cheek and the iron arms
  const e = pl.light ? AWN_G[1] : AWN_G[3];
  fillPoly(p.c, pts(p, [pl.out(u1, 0, zw), pl.out(u1, out, zw - drop), pl.out(u1, out, zw - drop - vh), pl.out(u1, 0.06, zw - 1.4)]), e);
  for (const u of [u0 + 0.05, u1 - 0.05]) {
    const [x0, y0] = p.P(...pl.out(u, 0, zw - 7));
    const [x1, y1] = p.P(...pl.out(u, out - 0.04, zw - drop - 0.2));
    ln(p.c, x0, y0, x1, y1, CHAR[1]);
  }
}

/** The glazed lobby of a bay: a bright double-height hall seen through tall glass. */
function lobby(p: PropPainter, pl: Pl, g0: number, g1: number, seed: number) {
  const L = pl.light;
  const zt = GH - 3;
  pt(p, pl, g0, g1, 1, zt, (_u: number, v: number, x: number, y: number) => {
    let i = L ? 4 : 3;
    if (v > (zt - 1) * 4 - 6) i = L ? 2 : 1;
    else if (v > (zt - 1) * 4 - 9) i = 6;
    if (v < 26) i -= 1;
    const d = (((x * 0.62 + y + seed * 41) % 170) + 170) % 170;
    if (d < 20) return at(GLASS, (L ? 5 : 4) + (bayer(x, y) > 0.5 ? 1 : 0));
    return at(WARM, i + (bayer(x, y) - 0.5) * 0.5);
  });
  const Rn = rng(seed);
  const w = g1 - g0;
  // a marble reception desk or sofas, tall plants, pendant lights, people
  for (let i = 0; i < 2; i++) {
    const c = g0 + w * (0.25 + i * 0.5) + (Rn() - 0.5) * 0.1;
    const kind = Math.floor(Rn() * 3);
    if (kind === 0) {
      pq(p, pl, c - 0.22, c + 0.22, 1, 9, '#e8e0d0');
      pq(p, pl, c - 0.22, c + 0.22, 8.4, 9.2, '#fffaf0');
      pq(p, pl, c - 0.22, c + 0.22, 1, 2, '#a89c88');
    } else if (kind === 1) {
      pq(p, pl, c - 0.05, c + 0.05, 1, 5, '#2a2420');
      const [x, y] = pl.F(c, 13);
      ell(p.c, x, y, 7, 9, '#2e6a2e');
      ell(p.c, x - 2, y - 3, 4, 5, '#58a040');
    } else {
      // two people crossing the hall
      for (const [du, h] of [[0, 1], [0.16, 0.94]] as const) {
        const u = c + du;
        pq(p, pl, u - 0.036, u - 0.008, 1, 1 + 7.6 * h, SIL[0]);
        pq(p, pl, u + 0.008, u + 0.036, 1, 1 + 7.6 * h, SIL[0]);
        pq(p, pl, u - 0.058, u + 0.058, 1 + 7.2 * h, 1 + 13.4 * h, du ? '#2e4a6a' : SIL[1]);
        const [x, y] = pl.F(u, 1 + 15.6 * h);
        ell(p.c, x, y, 2.6, 3, SIL[0]);
      }
    }
    const [lx, ly] = pl.F(c, zt - 8);
    px(p.c, lx, ly - 10, '#3a2a20', 1, 10);
    ell(p.c, lx, ly, 4, 2.2, '#fff4d0');
  }
  // tall mullions and a transom
  const fc = FRAME[L ? 4 : 3];
  const n = Math.max(2, Math.round(w / 0.32));
  for (let i = 0; i <= n; i++) {
    const u = g0 + (w * i) / n;
    pq(p, pl, u - PXU, u + PXU, 1, zt, fc);
  }
  pq(p, pl, g0, g1, 26, 26.6, fc);
  pq(p, pl, g0, g1, 1, 1.6, fc);
  if (L) veil(p, pl, g0, g0 + 5 * PXU, 1, zt, SHADOW, 0.3);
}

/** A revolving door standing half out of the facade: a glass drum on a bronze ring, four wings, a bronze cap. */
function revolving(p: PropPainter, pl: Pl, c: number) {
  const [cx, cy] = p.P(...pl.out(c, 0.05, 0));
  const rx = 34;
  const ry = 17;
  const H = 88;
  layer(
    p.c,
    (l) => {
      ell(l, cx, cy, rx + 2, ry + 1, '#8a7a62');
      for (let i = -rx; i <= rx; i++) {
        const t = i / rx;
        const off = Math.sqrt(Math.max(0, 1 - t * t)) * ry;
        const yb = Math.round(cy + off);
        const yt = Math.round(cy - H + off);
        // the warm hall seen through curved glass: lit on the left, a pale reflection, a darker floor band
        const glint = Math.abs(t + 0.55) < 0.07 || Math.abs(t - 0.15) < 0.035;
        const body = glint ? '#e2f2fa' : t < -0.2 ? WARM[5] : t < 0.45 ? WARM[4] : WARM[3];
        px(l, cx + i, yt, body, 1, yb - yt - 7);
        px(l, cx + i, yb - 7, t < 0.3 ? WARM[2] : WARM[1], 1, 4);
        px(l, cx + i, yb - 3, '#5a4632', 1, 3);
        px(l, cx + i, yt + 3, glint ? '#ffffff' : t < 0.3 ? WARM[6] : WARM[5], 1, 2);
      }
      // the wings (seen through the glass) and the drum's frame
      for (const th of [0.35, 1.92, 3.49, 5.06]) {
        const t = Math.sin(th);
        const off = Math.sqrt(Math.max(0, 1 - t * t)) * ry * (Math.cos(th) > 0 ? 1 : -1) * 0.6;
        px(l, cx + Math.round(t * (rx - 3)), cy - H + 6 + off, '#6a5236', 1, H - 12);
      }
      for (const t of [-1, 0, 1]) {
        const i = Math.round(t * (rx - 1));
        const off = Math.sqrt(Math.max(0, 1 - t * t)) * ry;
        px(l, cx + i - 1, cy - H + off, '#4a3624', 2, H);
      }
      ell(l, cx, cy - H, rx + 3, ry + 2, '#6a4a2a');
      ell(l, cx, cy - H - 2, rx + 3, ry + 2, '#b8864a');
      ell(l, cx - 6, cy - H - 4, rx * 0.5, ry * 0.4, '#d8a866');
    },
    { outline: 0.5, rect: [cx - rx - 6, cy - H - ry - 8, cx + rx + 6, cy + ry + 4] },
  );
}

/** The footprint (a0, b0, aw, bd) of a slab sticking `d` tiles out of a plane between u0 and u1. */
function outBox(pl: Pl, u0: number, u1: number, d: number): [number, number, number, number] {
  const pa = pl.out(u0, 0, 0);
  const pb = pl.out(u1, d, 0);
  const a0 = Math.min(pa[0], pb[0]);
  const b0 = Math.min(pa[1], pb[1]);
  return [a0, b0, Math.max(pa[0], pb[0]) - a0, Math.max(pa[1], pb[1]) - b0];
}
function canopy(p: PropPainter, pl: Pl, c: number, hw: number, z: number) {
  lbox(p, ...outBox(pl, c - hw, c + hw, 1.1), z, 1.8, solidBox(IVORY, IVORY[1]));
}

function groundFace(p: PropPainter, P: Plan, f: Face, fi: number, pl: Pl) {
  const L = pl.light;
  // the stone base: coursed where the arcade shows much of it, plain where shops and glass cover it
  if (P.ground === 'archi') pt(p, pl, f.u0, f.u1, 0, GH, fineStone(L));
  else {
    pq(p, pl, f.u0, f.u1, 0, GH, IVORY[tone(pl, 5, 3)]);
    for (let z = 29.5; z < GH; z += 2.25) pq(p, pl, f.u0, f.u1, z, z + 0.25, IVORY[tone(pl, 4, 2)]);
  }
  pq(p, pl, f.u0, f.u1, 0, 2, IVORY[tone(pl, 3, 2)]);
  pq(p, pl, f.u0, f.u1, 2, 2.4, IVORY[tone(pl, 5, 3)]);
  const n = f.bays.length;
  const Rn = rng(P.seed + fi * 5 + 1);
  const doorAt = fi === 0 ? Math.floor(n / 2) : -1;
  f.bays.forEach(([g0, g1], col) => {
    const c = (g0 + g1) / 2;
    const w = g1 - g0;
    const seed = P.seed + fi * 100 + col * 7;
    if (P.ground === 'archi') arch(p, pl, c, Math.min(0.48, w * 0.4), col === doorAt || Rn() < 0.12, seed);
    else if (P.ground === 'negozi') {
      const hw = Math.min(0.62, w * 0.44);
      shopfront(p, pl, c, hw, Rn() < 0.5, seed);
    } else lobby(p, pl, g0 + 0.02, g1 - 0.02, seed);
  });
  // the ground-floor pilasters continue the ones above
  if (P.ground !== 'archi') f.piers.forEach(([u0, u1], i) => pier(p, pl, u0, u1, 2.4, GH, i === 0 || i === f.piers.length - 1));
  if (P.ground === 'negozi')
    f.bays.forEach(([g0, g1], col) => {
      const c = (g0 + g1) / 2;
      const hw = Math.min(0.62, (g1 - g0) * 0.44);
      if (hash(fi * 13 + col, 21, P.seed) < 0.62) awning(p, pl, c - hw - 0.08, c + hw + 0.08, 30.8);
      else lbox(p, ...outBox(pl, c - hw - 0.06, c + hw + 0.06, 0.34), 30, 0.9, solidBox(BRONZE, BRONZE[0]));
    });
  if (P.ground === 'vetro' && doorAt >= 0) {
    const [g0, g1] = f.bays[doorAt];
    canopy(p, pl, (g0 + g1) / 2, 0.75, GH - 2.6);
    revolving(p, pl, (g0 + g1) / 2);
  }
}

// ── the roof ────────────────────────────────────────────────
/** A deck of pale stone pavers: a flat fill, a few darker slabs, crisp joints (cheap on big roofs). */
function pavers(p: PropPainter, A0: number, B0: number, A1: number, B1: number, z: number, seed: number) {
  const S = 0.3;
  hq(p, A0, B0, A1, B1, z, IVORY[5]);
  for (let a = A0, i = 0; a < A1 - 0.02; a += S, i++)
    for (let b = B0, j = 0; b < B1 - 0.02; b += S, j++) if (hash(i, j, seed) < 0.16) hq(p, a, b, Math.min(A1, a + S), Math.min(B1, b + S), z, IVORY[4]);
  for (let a = A0 + S; a < A1 - 0.02; a += S) {
    const [x0, y0] = p.P(a, B0, z);
    const [x1, y1] = p.P(a, B1, z);
    ln(p.c, x0, y0, x1, y1, IVORY[3]);
  }
  for (let b = B0 + S; b < B1 - 0.02; b += S) {
    const [x0, y0] = p.P(A0, b, z);
    const [x1, y1] = p.P(A1, b, z);
    ln(p.c, x0, y0, x1, y1, IVORY[3]);
  }
}
/** A gravel-covered technical roof with a membrane seam now and then. */
const gravelTex: FaceTex = (u, _v, x, y) => {
  let i = 3 + (hash(x, y, 31) < 0.3 ? -1 : 0) + (hash(x, y, 32) > 0.93 ? 1 : 0);
  if (Math.floor(u / 60) !== Math.floor((u - 1) / 60)) i -= 1;
  return at(GRAVEL, i);
};

function roofDeck(p: PropPainter, P: Plan) {
  const { a0, a1, b0, b1, ze } = P;
  const A0 = a0 + PT;
  const A1 = a1 - PT;
  const B0 = b0 + PT;
  const B1 = b1 - PT;
  if (P.roof === 'tecnico') ht(p, A0, B0, A1, B1, ze, gravelTex);
  else pavers(p, A0, B0, A1, B1, ze, P.seed);
  // the inner faces of the back parapets, their copings
  pq(p, F3(p, B0), A0, A1, ze, ze + PH, IVORY[4]);
  pq(p, F3(p, B0), A0, A1, ze, ze + 1.2, IVORY[3]);
  pq(p, S3(p, A0), B0, B1, ze, ze + PH, IVORY[2]);
  pq(p, S3(p, A0), B0, B1, ze, ze + 1.2, IVORY[1]);
  hq(p, a0, b0, a1, B0, ze + PH, IVORY[6]);
  hq(p, a0, b0, A0, b1, ze + PH, IVORY[6]);
}
function roofCaps(p: PropPainter, P: Plan) {
  const { a0, a1, b0, b1, ze } = P;
  hq(p, a0, b1 - PT, a1, b1, ze + PH, IVORY[6]);
  hq(p, a1 - PT, b0, a1, b1, ze + PH, IVORY[6]);
  // a crisp outer edge line along the copings
  const e0 = p.P(a0, b1, ze + PH);
  const e1 = p.P(a1, b1, ze + PH);
  const e2 = p.P(a1, b0, ze + PH);
  ln(p.c, e0[0], e0[1], e1[0], e1[1], IVORY[6]);
  ln(p.c, e1[0], e1[1], e2[0], e2[1], IVORY[4]);
}

/** A row of shrubs and flowers along a line on the roof (or a parapet top). */
function hedgeRow(p: PropPainter, from: V3, to: V3, seed: number, o: { flowers?: number; size?: number } = {}) {
  const Rn = rng(seed);
  const size = o.size ?? 1;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const segs = Math.max(1, Math.ceil(len / 1.0));
  for (let s = 0; s < segs; s++) {
    const masses: Mass[] = [];
    const q: V3[] = [];
    const n = Math.max(2, Math.round((len / segs) * 5));
    for (let i = 0; i <= n; i++) {
      const t = (s + i / n) / segs;
      const a = from[0] + (to[0] - from[0]) * t;
      const b = from[1] + (to[1] - from[1]) * t;
      const z = from[2] + (to[2] - from[2]) * t;
      const [x, y] = p.P(a, b, z);
      const r = (10 + Rn() * 5) * size;
      masses.push({ x: x + (Rn() - 0.5) * 4, y: y - r * 0.55, rx: r, ry: r * 0.86, z: y });
      if (Rn() < 0.4) masses.push({ x: x + (Rn() - 0.5) * 8, y: y - r * 1.1, rx: r * 0.7, ry: r * 0.62, z: y - 1 });
      q.push([a, b, z]);
    }
    // mostly green, a run of one or two kinds of flowers here and there
    const fl = (o.flowers ?? 0.2) * (Rn() < 0.45 ? 1.6 : 0.4);
    const set = BLOOM_SETS[Math.floor(Rn() * BLOOM_SETS.length)];
    layer(p.c, (l) => foliage(l, masses, Rn() < 0.5 ? LEAF : R.hedge, seed + s * 7, { cell: 2.8, tilt: 0.2, dots: fl > 0 ? set : undefined, dotChance: fl, dotSize: 3 }), { outline: 0.55, rect: box(p, q, 24 * size) });
  }
}

// ── roof furniture and planting ─────────────────────────────
const POT: Ramp = ['#8e877c', '#aea79a', '#cbc5b8', '#e2ddd2', '#f1eee6', '#fcfbf7'];
const CUSHION: Ramp = ['#a29c92', '#bdb8ae', '#d6d2c9', '#e9e6df', '#f6f4ef', '#fffefb'];
const ACCENTS = ['#2f9c8a', '#e8873a', '#c8a050', '#3a6aa8', '#d85a6a'];
const BLOOM_SETS = [
  ['#f06a9a', '#fbf7ee'],
  ['#f6d34a', '#ff8a4a', '#fbf7ee'],
  ['#b07ae0', '#fbf7ee', '#f06a9a'],
  ['#e8406a', '#f6d34a'],
];

/** Shrubs and flowers heaped over a bed (a0..a1 × b0..b1 at height z). */
function shrubs(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, o: { flowers?: number; ramp?: Ramp; r?: number } = {}) {
  const Rn = rng(seed);
  const r0 = o.r ?? 1;
  const step = 0.2 * r0;
  const fl = o.flowers ?? 0.4;
  const set = BLOOM_SETS[Math.floor(Rn() * BLOOM_SETS.length)];
  const ramp = o.ramp ?? (Rn() < 0.5 ? LEAF : R.hedge);
  // a long bed is planted in short stretches, back to front (small foliage boxes are far cheaper than one long diagonal)
  const alongA = a1 - a0 >= b1 - b0;
  const na = Math.max(1, Math.floor((a1 + 0.02 - (a0 + 0.06)) / step) + 1);
  const nb = Math.max(1, Math.floor((b1 + 0.04 - (b0 + 0.06)) / step) + 1);
  const per = Math.max(2, Math.round(1.1 / step));
  const nLong = alongA ? na : nb;
  for (let c0 = 0; c0 < nLong; c0 += per) {
    const masses: Mass[] = [];
    const q: V3[] = [];
    for (let i = 0; i < na; i++)
      for (let j = 0; j < nb; j++) {
        const li = alongA ? i : j;
        if (li < c0 || li >= c0 + per) continue;
        const a = a0 + 0.06 + i * step;
        const b = b0 + 0.06 + j * step;
        const [x, y] = p.P(a + (Rn() - 0.5) * 0.08, b + (Rn() - 0.5) * 0.08, z);
        const r = (8 + Rn() * 5) * r0;
        masses.push({ x, y: y - r * 0.55, rx: r, ry: r * 0.85, z: y });
        if (Rn() < 0.25) masses.push({ x: x + (Rn() - 0.5) * 6, y: y - r * 1.25, rx: r * 0.7, ry: r * 0.62, z: y - 0.5 });
        q.push([a, b, z]);
      }
    if (!masses.length) continue;
    layer(p.c, (l) => foliage(l, masses, ramp, seed + c0, { cell: 2.8, tilt: 0.2, dots: fl > 0 ? set : undefined, dotChance: fl, dotSize: 3 }), { outline: 0.55, rect: box(p, q, 30 * r0) });
  }
}

/** A raised bed of cream stone, planted. */
function planter(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, h: number, seed: number, o: { flowers?: number; ramp?: Ramp; r?: number } = {}) {
  lbox(p, a0, b0, a1 - a0, b1 - b0, z, h, { front: paint(IVORY), side: paint(IVORY), top: paint(IVORY), edge: IVORY[1] });
  hq(p, a0 + 0.08, b0 + 0.08, a1 - 0.08, b1 - 0.08, z + h, '#6a4a32');
  shrubs(p, a0 + 0.04, b0 + 0.04, a1 - 0.04, b1 - 0.04, z + h, seed, o);
}

/** A round pot seen from above: a lit cylinder with a rim and soil. */
function pot(l: C, x: number, y: number, rx: number, H: number, r: Ramp = POT) {
  const ry = rx * 0.5;
  for (let i = -rx; i <= rx; i++) {
    const t = (i + rx) / (2 * rx);
    const off = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * ry;
    px(l, x + i, y - H + off, r[t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.82 ? 2 : 1], 1, H);
  }
  ell(l, x, y - H, rx + 1, ry + 0.5, r[5]);
  ell(l, x, y - H + 0.5, rx - 1.5, ry - 1, '#4a3424');
}

/** A clipped round tree (olive, bay, ficus) in a big white pot. */
function pottedTree(p: PropPainter, a: number, b: number, z: number, seed: number, s = 1) {
  const [x, y] = p.P(a, b, z);
  const Rn = rng(seed);
  const H = 14 * s;
  const top = y - H - 34 * s;
  layer(
    p.c,
    (l) => {
      pot(l, x, y, 11 * s, H);
      px(l, x - 1, top + 6, '#6a4a2e', 3, y - H - top - 6);
      px(l, x - 1, top + 6, '#8a6a46', 1, y - H - top - 6);
      const masses: Mass[] = [{ x, y: top, rx: 18 * s, ry: 16 * s, z: 2 }];
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Rn();
        masses.push({ x: x + Math.cos(ang) * 10 * s, y: top + Math.sin(ang) * 7 * s, rx: (10 + Rn() * 4) * s, ry: (9 + Rn() * 3) * s, z: 1 + Math.sin(ang) });
      }
      foliage(l, masses, Rn() < 0.5 ? LEAF : R.oak, seed, { cell: 3.2, tilt: 0.2, holes: 0.05, dots: Rn() < 0.3 ? ['#f6d34a'] : undefined, dotChance: 0.25, dotSize: 3 });
    },
    { outline: 0.58, rect: [x - 34 * s, top - 26 * s, x + 34 * s, y + 10] },
  );
}

/** A small pot of flowers or grasses. */
function flowerPot(p: PropPainter, a: number, b: number, z: number, seed: number) {
  const [x, y] = p.P(a, b, z);
  const Rn = rng(seed);
  layer(
    p.c,
    (l) => {
      pot(l, x, y, 6, 8, Rn() < 0.5 ? POT : ['#6a3220', '#8a432a', '#a85a38', '#c07448', '#d48e5e', '#e4a878']);
      foliage(l, [{ x, y: y - 14, rx: 8, ry: 7, z: 1 }, { x: x + 3, y: y - 18, rx: 5, ry: 5, z: 2 }], LEAF, seed, { cell: 2.4, dots: BLOOM_SETS[Math.floor(Rn() * 4)], dotChance: 0.7, dotSize: 3 });
    },
    { outline: 0.55, rect: [x - 14, y - 32, x + 14, y + 6] },
  );
}

/** A white outdoor sofa on a taupe frame, facing the viewer along +b ('b') or along +a ('a'). */
function sofa(p: PropPainter, a: number, b: number, len: number, facing: 'a' | 'b', z: number, accent: string) {
  const fr = solidBox(TAUPE, TAUPE[0]);
  const cu = solidBox(CUSHION, CUSHION[1]);
  const ac = solidBox([darken(accent, 0.5), darken(accent, 0.34), darken(accent, 0.18), accent, lighten(accent, 0.2), lighten(accent, 0.36)], darken(accent, 0.6));
  if (facing === 'b') {
    lbox(p, a, b, len, 0.16, z, 7.2, fr);
    lbox(p, a + 0.06, b + 0.12, len - 0.12, 0.14, z + 2.6, 4, cu);
    lbox(p, a, b + 0.12, len, 0.52, z, 2.6, fr);
    lbox(p, a + 0.06, b + 0.24, len - 0.12, 0.38, z + 2.6, 1.6, cu);
    lbox(p, a + 0.16, b + 0.2, 0.18, 0.06, z + 4.2, 2.4, ac);
    lbox(p, a + len - 0.36, b + 0.2, 0.18, 0.06, z + 4.2, 2.4, ac);
    lbox(p, a, b + 0.12, 0.1, 0.52, z + 2.6, 1.8, fr);
    lbox(p, a + len - 0.1, b + 0.12, 0.1, 0.52, z + 2.6, 1.8, fr);
  } else {
    lbox(p, a, b, 0.16, len, z, 7.2, fr);
    lbox(p, a + 0.12, b + 0.06, 0.14, len - 0.12, z + 2.6, 4, cu);
    lbox(p, a + 0.12, b, 0.52, len, z, 2.6, fr);
    lbox(p, a + 0.24, b + 0.06, 0.38, len - 0.12, z + 2.6, 1.6, cu);
    lbox(p, a + 0.2, b + 0.16, 0.06, 0.18, z + 4.2, 2.4, ac);
    lbox(p, a + 0.12, b, 0.52, 0.1, z + 2.6, 1.8, fr);
    lbox(p, a + 0.12, b + len - 0.1, 0.52, 0.1, z + 2.6, 1.8, fr);
  }
}

/** A low teak table with a vase or a tray. */
function lowTable(p: PropPainter, a: number, b: number, w: number, d: number, z: number, seed: number) {
  const t = { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK), edge: TEAK[0] };
  lbox(p, a, b, w, d, z, 3, t);
  const [x, y] = p.P(a + w * 0.4, b + d * 0.5, z + 3);
  px(p.c, x - 2, y - 6, '#e8eef2', 4, 6);
  dotFruit(p.c, x, y - 8, BLOOMS[seed % BLOOMS.length], 4);
  px(p.c, x + 8, y - 2, '#f6f2ea', 7, 2);
}

/** A sun parasol on a pole: an octagon of cream canvas, lit from the left. */
function parasol(p: PropPainter, a: number, b: number, z: number, s = 1, col = '#f4ecd8') {
  const [x, y] = p.P(a, b, z);
  const H = Math.round(96 * s);
  const R0 = 48 * s;
  const cy = y - H + 12 * s;
  layer(
    p.c,
    (l) => {
      ell(l, x, y, 6, 3, '#6a6458');
      px(l, x - 1, y - H, '#8a8072', 2, H);
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        const lit = Math.cos((a0 + a1) / 2 + 2.4) > 0;
        fillPoly(l, [[x, y - H - 4], [x + Math.cos(a0) * R0, cy + Math.sin(a0) * R0 * 0.48], [x + Math.cos(a1) * R0, cy + Math.sin(a1) * R0 * 0.48]], lit ? col : i % 2 ? '#d8ccb0' : '#cfc2a6');
      }
      for (let i = 0; i < 32; i++) {
        const an = (i / 32) * Math.PI * 2;
        if (Math.sin(an) < -0.2) continue;
        px(l, x + Math.cos(an) * R0 - 1, cy + Math.sin(an) * R0 * 0.48, '#c8b894', 3, 3);
      }
      px(l, x - 1, y - H - 7, '#8a8072', 2, 4);
    },
    { outline: 0.5, rect: [x - R0 - 4, y - H - 12, x + R0 + 4, y + 6] },
  );
}

/** A white sun lounger along b, its back raised toward low b. */
function lounger(p: PropPainter, a: number, b: number, z: number) {
  const fr = solidBox(WHITE, WHITE[1]);
  lbox(p, a, b + 0.1, 0.32, 0.9, z, 1.6, fr);
  lbox(p, a + 0.03, b + 0.38, 0.26, 0.6, z + 1.6, 0.8, solidBox(CUSHION, CUSHION[1]));
  const back: V3[] = [[a + 0.03, b + 0.4, z + 2.2], [a + 0.29, b + 0.4, z + 2.2], [a + 0.29, b + 0.12, z + 7], [a + 0.03, b + 0.12, z + 7]];
  poly(p.c, pts(p, back), CUSHION[5]);
  poly(p.c, pts(p, [[a + 0.29, b + 0.4, z + 2.2], [a + 0.29, b + 0.12, z + 7], [a + 0.29, b + 0.12, z + 5.6], [a + 0.29, b + 0.4, z + 1.6]]), WHITE[2]);
  const e = pts(p, [back[2], back[3]]);
  ln(p.c, e[0][0], e[0][1], e[1][0], e[1][1], WHITE[6]);
}

/** A condenser unit: louvred metal box, a fan grille on top. */
function acUnit(p: PropPainter, a: number, b: number, z: number) {
  const louvre: Mat = (light) => (_u, v, x, y) => at(METAL, (light === 1 ? 4 : light === 0 ? 2 : 5) + (v % 3 < 1 ? -1 : 0) - (hash(x, y, 3) < 0.03 ? 1 : 0));
  lbox(p, a - 0.02, b - 0.02, 0.76, 0.6, z, 0.8, solidBox(['#2a2e34', '#3a3f46', '#4a5058', '#5a616a', '#6a727c', '#7a838e']));
  lbox(p, a, b, 0.72, 0.56, z + 0.8, 7.2, { front: louvre, side: louvre, top: paint(METAL), edge: METAL[0] });
  const [x, y] = p.P(a + 0.36, b + 0.28, z + 8);
  ell(p.c, x, y, 14, 7, METAL[2]);
  ell(p.c, x, y, 12, 6, '#2a2e34');
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * Math.PI + 0.4;
    ln(p.c, x - Math.cos(an) * 10, y - Math.sin(an) * 5, x + Math.cos(an) * 10, y + Math.sin(an) * 5, '#4e555e');
  }
  ell(p.c, x, y, 3, 1.6, METAL[5]);
}

/** A roof vent: a short pipe with a mushroom cap. */
function vent(p: PropPainter, a: number, b: number, z: number, h = 14) {
  const [x, y] = p.P(a, b, z);
  layer(
    p.c,
    (l) => {
      for (let i = -3; i <= 3; i++) px(l, x + i, y - h + Math.abs(i) * 0.3, METAL[i < -1 ? 5 : i < 1 ? 4 : i < 3 ? 3 : 2], 1, h);
      ell(l, x, y - h, 8, 3.6, METAL[2]);
      ell(l, x - 1, y - h - 2, 7, 3, METAL[5]);
      px(l, x - 4, y - h - 3, METAL[6], 3, 1);
    },
    { outline: 0.5, rect: [x - 12, y - h - 10, x + 12, y + 4] },
  );
}

/** Timber fins over a face (stair housings, penthouses). */
const finTex =
  (light: Light): FaceTex =>
  (u, v, x, y) => {
    const fu = u % 6;
    if (fu < 1.6) return '#21170f';
    let i = light ? 4 : 3;
    if (fu > 4.6) i += light ? -1 : 1;
    if (hash(Math.floor(u / 6), Math.floor(v / 10), 5) < 0.2) i -= 0.6;
    if (hash(x, y, 9) < 0.02) i -= 1;
    return at(SLAT, i);
  };

/** The stair housing: a cream box with a glazed door, a lamp, timber fins on its side. */
function stairHouse(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number) {
  const H = 26;
  lbox(p, a0, b0, a1 - a0, b1 - b0, z, H, { front: paint(IVORY), side: paint(IVORY), top: paint(IVORY), edge: IVORY[1] });
  lbox(p, a0 - 0.08, b0 - 0.08, a1 - a0 + 0.16, b1 - b0 + 0.16, z + H, 1.6, solidBox(IVORY, IVORY[1]));
  const F = F3(p, b1);
  const S = S3(p, a1);
  pq(p, F, a0 + 0.25, a0 + 0.8, z, z + 21.5, CHAR[2]);
  pt(p, F, a0 + 0.29, a0 + 0.76, z, z + 20.6, glassTex(1, 82, GLASS, 3));
  pq(p, F, a0 + 0.52, a0 + 0.53, z, z + 20.6, CHAR[3]);
  const [lx, ly] = F.F(a0 + 0.52, z + 23.6);
  ell(p.c, lx, ly, 3, 1.6, '#fff0c0');
  pt(p, S, b0 + 0.15, b1 - 0.15, z + 2, z + H - 2, finTex(S.light));
}

/** A low duct crossing the roof. */
function duct(p: PropPainter, a0: number, b: number, a1: number, z: number) {
  lbox(p, a0, b, a1 - a0, 0.22, z, 3.6, { front: paint(METAL), side: paint(METAL), top: paint(METAL), edge: METAL[0] });
  for (let a = a0 + 0.4; a < a1; a += 0.9) lbox(p, a, b - 0.02, 0.04, 0.26, z, 3.9, solidBox(METAL, METAL[0]));
}

/** A timber pergola: posts, beams and slats, a vine spreading over it and hanging down. */
function pergola(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, under: () => void) {
  const H = 25;
  const wood = { front: grain(TEAK, 'v'), side: grain(TEAK, 'v'), top: grain(TEAK), edge: TEAK[0] };
  const post = (a: number, b: number) => lbox(p, a - 0.06, b - 0.06, 0.12, 0.12, z, H, wood);
  post(a0, b0);
  post(a1, b0);
  under();
  post(a0, b1);
  post(a1, b1);
  for (const a of [a0, a1]) lbox(p, a - 0.05, b0 - 0.25, 0.1, b1 - b0 + 0.5, z + H, 1.8, wood);
  for (let b = b0 - 0.1; b <= b1 + 0.12; b += 0.24) lbox(p, a0 - 0.3, b, a1 - a0 + 0.6, 0.06, z + H + 1.8, 1, wood);
  // the vine: a climber up the front post, a canopy over part of the top, strands hanging in front
  const Rn = rng(seed);
  const vine = (masses: Mass[], q: V3[], sd: number) => layer(p.c, (l) => foliage(l, masses, IVY, sd, { cell: 3, tilt: 0.22, holes: 0.06, dots: ['#b07ae0', '#f4f0e4', '#c8a0f0'], dotChance: 0.18, dotSize: 3 }), { outline: 0.55, rect: box(p, q, 24) });
  const side = Rn() < 0.5;
  const top: Mass[] = [];
  for (let i = 0; i < 40; i++) {
    const a = a0 - 0.2 + Rn() * (a1 - a0 + 0.4);
    const t = Rn();
    const b = side ? b0 + t * t * (b1 - b0) : b1 - t * t * (b1 - b0);
    if (Rn() < 0.25) continue;
    const [x, y] = p.P(a, b, z + H + 3.4);
    top.push({ x, y, rx: 10 + Rn() * 6, ry: 7 + Rn() * 3, z: y });
  }
  vine(top, [[a0 - 0.4, b0 - 0.4, z + H + 3.4], [a1 + 0.4, b1 + 0.4, z + H + 3.4], [a0 - 0.4, b1 + 0.4, z + H + 3.4], [a1 + 0.4, b0 - 0.4, z + H + 3.4]], seed);
  const hang: Mass[] = [];
  for (let a = a0; a < a1; a += 0.22 + Rn() * 0.2) {
    const len = 4 + Rn() * 12;
    for (let zz = z + H + 1; zz > z + H - len; zz -= 2.4) {
      const [x, y] = p.P(a, b1 + 0.05, zz);
      hang.push({ x, y, rx: 5 - ((z + H - zz) / len) * 1.5, ry: 4.5, z: 1e4 });
    }
  }
  vine(hang, [[a0 - 0.1, b1, z + H + 2], [a1 + 0.1, b1, z + H - 17]], seed + 1);
  const climb: Mass[] = [];
  for (let zz = z; zz < z + H; zz += 2.6) {
    const [x, y] = p.P(a1 + 0.06, b1 + 0.06, zz);
    climb.push({ x: x + Math.sin(zz) * 3, y, rx: 6, ry: 5, z: 2e4 });
  }
  vine(climb, [[a1, b1, z], [a1, b1, z + H]], seed + 2);
}

/** One storey of glass bays across a face (penthouse fronts). */
function glassStorey(p: PropPainter, pl: Pl, u0: number, u1: number, za: number, zt: number, seed: number) {
  const f = facePlan(u0, u1);
  f.bays.forEach(([g0, g1], col) => {
    panesOf(g0, g1, Math.floor(hash(col, 5, seed) * 5)).forEach(([b0, b1, kind], pi) => pane(p, pl, b0, b1, za, zt, kind, kind !== 'e' && hash(col * 7 + pi, 1, seed) < 0.35, seed));
    if (pl.light) veil(p, pl, g0, g0 + 5 * PXU, za, zt, SHADOW, 0.3);
  });
  f.piers.forEach(([a, b], i) => pier(p, pl, a, b, za, zt, i === 0 || i === f.piers.length - 1));
}

/** The setback penthouse: glass to the front, timber fins on the side, its own coping, a planter and a unit on top. */
function penthouse(p: PropPainter, P: Plan) {
  const [a0, b0, a1, b1] = P.pent!;
  const z = P.ze;
  const H = 30;
  lbox(p, a0, b0, a1 - a0, b1 - b0, z, H, { front: paint(IVORY), side: paint(IVORY), top: paint(IVORY), edge: IVORY[1] });
  const F = F3(p, b1);
  const S = S3(p, a1);
  glassStorey(p, F, a0, a1, z + 2, z + H - 4, P.seed + 77);
  pq(p, F, a0, a1, z + H - 4, z + H, IVORY[5]);
  pq(p, F, a0, a1, z + H - 0.6, z + H, IVORY[6]);
  pt(p, S, b0 + 0.05, b1 - 0.05, z + 1, z + H - 4, finTex(S.light));
  pq(p, S, b0, b1, z + H - 4, z + H, IVORY[3]);
  pq(p, S, b0, b1, z + H - 0.6, z + H, IVORY[4]);
  hq(p, a0 + 0.12, b0 + 0.12, a1 - 0.12, b1 - 0.12, z + H, IVORY[4]);
  acUnit(p, a0 + 0.4, b0 + 0.35, z + H);
  hedgeRow(p, [a0 + 0.3, b1 - 0.12, z + H], [a1 - 0.2, b1 - 0.12, z + H], P.seed + 61, { size: 0.85 });
  hedgeRow(p, [a1 - 0.12, b0 + 0.3, z + H], [a1 - 0.12, b1 - 0.3, z + H], P.seed + 63, { size: 0.85 });
}

/** The things standing in one roof cell, as depth-keyed draw calls. */
function cellItems(p: PropPainter, P: Plan, c: Cell, idx: number, out: { k: number; f: () => void }[]) {
  const z = P.ze;
  const w = c.a1 - c.a0;
  const d = c.b1 - c.b0;
  const s = P.seed + idx * 101;
  const Rn = rng(s);
  const add = (a: number, b: number, f: () => void) => out.push({ k: a + b, f });
  const acc = ACCENTS[Math.floor(Rn() * ACCENTS.length)];
  switch (c.g) {
    case 'lounge': {
      // a teak deck, an L of white sofas round a low table, a parasol, an olive tree
      const da0 = c.a0 + 0.1;
      const db0 = c.b0 + 0.1;
      const da1 = c.a1 - 0.1;
      const db1 = c.b1 - 0.1;
      add(c.a0, c.b0, () => lbox(p, da0, db0, da1 - da0, db1 - db0, z, 0.8, { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK, 'v'), edge: TEAK[0] }));
      const zd = z + 0.8;
      const len = Math.min(2.1, w - 0.9);
      add(da0 + 0.2, db0 + 0.2, () => sofa(p, da0 + 0.2, db0 + 0.15, len, 'b', zd, acc));
      add(da0 + 0.2, db0 + 0.9, () => sofa(p, da0 + 0.15, db0 + 0.82, Math.min(1.3, d - 1.3), 'a', zd, acc));
      add(da0 + 1.3, db0 + 1.3, () => lowTable(p, da0 + 1.0, db0 + 1.1, 0.7, 0.45, zd, s));
      add(da1 - 0.4, db0 + 0.4, () => pottedTree(p, da1 - 0.4, db0 + 0.4, zd, s + 3));
      add(da1 - 0.55, db1 - 0.5, () => parasol(p, da1 - 0.55, db1 - 0.5, zd, 0.95));
      add(da0 + 0.3, db1 - 0.25, () => flowerPot(p, da0 + 0.3, db1 - 0.25, zd, s + 5));
      break;
    }
    case 'green': {
      // an L of raised beds with a tree at the corner, a teak bench before it
      add(c.a0, c.b0, () => planter(p, c.a0, c.b0, c.a1, c.b0 + 0.6, z, 4, s + 1, { flowers: 0.5 }));
      add(c.a0, c.b0 + 0.6, () => planter(p, c.a0, c.b0 + 0.6, c.a0 + 0.6, c.b1 - 0.3, z, 4, s + 2, { flowers: 0.35 }));
      add(c.a0 + 0.35, c.b0 + 0.35, () => pottedTree(p, c.a0 + 0.32, c.b0 + 0.3, z + 4, s + 3, 1.15));
      add(c.a0 + 0.9, c.b0 + 1.6, () => lbox(p, c.a0 + 0.75, c.b0 + 1.0, 0.32, Math.min(1.3, d - 1.6), z, 3.6, { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK), edge: TEAK[0] }));
      add(c.a0 + w * 0.62, c.b0 + d * 0.55, () => pottedTree(p, c.a0 + w * 0.62, c.b0 + d * 0.55, z, s + 8, 1.2));
      add(c.a0 + w * 0.62 + 0.5, c.b0 + d * 0.55 + 0.1, () => flowerPot(p, c.a0 + w * 0.62 + 0.45, c.b0 + d * 0.55 + 0.15, z, s + 9));
      add(c.a1 - 0.4, c.b1 - 0.4, () => flowerPot(p, c.a1 - 0.4, c.b1 - 0.4, z, s + 4));
      add(c.a1 - 0.8, c.b1 - 0.3, () => flowerPot(p, c.a1 - 0.8, c.b1 - 0.3, z, s + 6));
      break;
    }
    case 'trees': {
      add(c.a0 + 0.5, c.b0 + 0.5, () => pottedTree(p, c.a0 + 0.5, c.b0 + 0.5, z, s + 1, 1.1));
      add(c.a1 - 0.6, c.b0 + 1.2, () => pottedTree(p, c.a1 - 0.6, c.b0 + 1.1, z, s + 2));
      add(c.a0 + 0.7, c.b1 - 0.6, () => pottedTree(p, c.a0 + 0.8, c.b1 - 0.7, z, s + 3, 0.9));
      for (let i = 0; i < 2; i++) add(c.a0 + 1.4 + i * 0.4, c.b0 + 1.6, () => lounger(p, c.a0 + 1.3 + i * 0.45, c.b0 + 1.2, z));
      add(c.a1 - 0.4, c.b1 - 0.3, () => flowerPot(p, c.a1 - 0.4, c.b1 - 0.3, z, s + 4));
      break;
    }
    case 'loungers': {
      const n = Math.max(2, Math.min(4, Math.floor((w - 0.6) / 0.55)));
      for (let i = 0; i < n; i++) add(c.a0 + 0.3 + i * 0.55, c.b0 + 1.2, () => lounger(p, c.a0 + 0.3 + i * 0.55, c.b0 + 0.6, z));
      add(c.a0 + 0.2 + n * 0.55, c.b0 + 0.6, () => parasol(p, c.a0 + 0.2 + n * 0.55, c.b0 + 0.6, z, 0.9));
      add(c.a0 + 0.4, c.b1 - 0.4, () => planter(p, c.a0, c.b1 - 0.6, c.a1, c.b1, z, 3.4, s + 7, { flowers: 0.6 }));
      break;
    }
    case 'pergola': {
      const pa0 = c.a0 + 0.3;
      const pb0 = c.b0 + 0.3;
      const pa1 = c.a1 - 0.3;
      const pb1 = c.b1 - 0.35;
      add(pa0, pb0, () =>
        pergola(p, pa0, pb0, pa1, pb1, z, s, () => {
          lbox(p, pa0 - 0.1, pb0 - 0.1, pa1 - pa0 + 0.2, pb1 - pb0 + 0.2, z, 0.6, { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK, 'v'), edge: TEAK[0] });
          sofa(p, pa0 + 0.15, pb0 + 0.1, Math.min(2, pa1 - pa0 - 0.4), 'b', z + 0.6, acc);
          sofa(p, pa0 + 0.1, pb0 + 0.78, Math.min(1.2, pb1 - pb0 - 1.0), 'a', z + 0.6, acc);
          lowTable(p, pa0 + 0.95, pb0 + 1.0, 0.7, 0.42, z + 0.6, s);
          if (pa1 - pa0 > 2.4) flowerPot(p, pa1 - 0.3, pb1 - 0.3, z + 0.6, s + 11);
        }),
      );
      add(c.a1 - 0.1, c.b1, () => planter(p, c.a0 + 0.2, c.b1 - 0.28, c.a1 - 0.2, c.b1 + 0.05, z, 3, s + 9, { flowers: 0.6, r: 0.85 }));
      break;
    }
    case 'rows': {
      // long beds with paths between, a small tree here and there
      const nb = Math.max(2, Math.floor(d / 1.05));
      for (let r = 0; r < nb; r++) {
        const bb = c.b0 + 0.1 + r * (d / nb);
        add(c.a0, bb, () => planter(p, c.a0 + 0.05, bb, c.a1 - 0.05, bb + 0.5, z, 3.6, s + r * 3, { flowers: 0.55 }));
        if (Rn() < 0.7) {
          const ta = c.a0 + 0.4 + Rn() * (w - 0.8);
          add(ta, bb + 0.25, () => pottedTree(p, ta, bb + 0.25, z + 3.6, s + r * 3 + 1, 0.85));
        }
      }
      break;
    }
    case 'ac': {
      const n = Math.max(1, Math.min(3, Math.floor((w - 0.4) / 0.95)));
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) add(c.a0 + 0.3 + i * 0.95, c.b0 + 0.3 + r * 1.1, () => acUnit(p, c.a0 + 0.3 + i * 0.95, c.b0 + 0.3 + r * 1.1, z));
      add(c.a0, c.b1 - 0.5, () => duct(p, c.a0 + 0.1, c.b1 - 0.6, c.a1 - 0.1, z));
      break;
    }
    case 'vents': {
      for (let i = 0; i < 5; i++) {
        const a = c.a0 + 0.3 + Rn() * (w - 0.6);
        const b = c.b0 + 0.3 + Rn() * (d - 0.6);
        add(a, b, () => vent(p, a, b, z, 10 + Rn() * 8));
      }
      add(c.a0 + 0.5, c.b1 - 0.5, () => planter(p, c.a0 + 0.2, c.b1 - 0.75, c.a0 + 1.4, c.b1 - 0.2, z, 3.4, s + 3));
      break;
    }
    case 'stair': {
      const a0 = c.a0 + 0.3;
      const b0 = c.b0 + 0.3;
      add(a0 + 0.8, b0 + 0.6, () => stairHouse(p, a0, b0, Math.min(c.a1 - 0.3, a0 + 1.7), Math.min(c.b1 - 0.4, b0 + 1.3), z));
      break;
    }
    default:
      break;
  }
}

function roofGarden(p: PropPainter, P: Plan) {
  const { a0, a1, b0, b1, ze } = P;
  const items: { k: number; f: () => void }[] = [];
  if (P.roof !== 'tecnico') {
    // beds along the inner side of the back parapets
    const A0 = a0 + PT;
    const B0 = b0 + PT;
    items.push({ k: A0 + B0, f: () => planter(p, A0 + 0.02, B0 + 0.02, a1 - PT - 0.05, B0 + 0.58, ze, 4.4, P.seed + 31, { flowers: 0.22 }) });
    items.push({ k: A0 + B0 + 0.1, f: () => planter(p, A0 + 0.02, B0 + 0.6, A0 + 0.58, b1 - PT - 0.05, ze, 4.4, P.seed + 33, { flowers: 0.22 }) });
  }
  if (P.pent) {
    const [pa0, pb0, pa1, pb1] = P.pent;
    items.push({ k: (pa0 + pa1) / 2 + (pb0 + pb1) / 2, f: () => penthouse(p, P) });
  }
  P.cells.forEach((c, i) => cellItems(p, P, c, i, items));
  items.sort((m, n) => m.k - n.k);
  for (const it of items) it.f();
}

// ── the block ───────────────────────────────────────────────
const blocco: PropArt = {
  draw(p0, k) {
    const p = upright(p0);
    const P = planBlock(k);
    const { a0, a1, b0, b1, ze } = P;
    // a soft dark foot along the two visible faces
    veilH(p, a0, b1, a1 + 0.35, b1 + 0.35, 0, SHADOW, 0.22);
    veilH(p, a1, b0, a1 + 0.6, b1 + 0.35, 0, SHADOW, 0.26);
    roofDeck(p, P);
    roofGarden(p, P);
    const Fp = F3(p, b1);
    const Sp = S3(p, a1);
    groundFace(p, P, P.faces[0], 0, Fp);
    upperFace(p, P, P.faces[0], 0, Fp);
    groundFace(p, P, P.faces[1], 1, Sp);
    upperFace(p, P, P.faces[1], 1, Sp);
    roofCaps(p, P);
    // shrubs along the parapet tops
    hedgeRow(p, [a0 + 0.3, b1 - PT / 2, ze + PH], [a1 - 0.25, b1 - PT / 2, ze + PH], P.seed + 21);
    hedgeRow(p, [a1 - PT / 2, b0 + 0.3, ze + PH], [a1 - PT / 2, b1 - 0.4, ze + PH], P.seed + 23);
  },
};

// ── palms ───────────────────────────────────────────────────
const TRUNK: Ramp = ['#4a2e16', '#6a4220', '#8a5a2c', '#a8743a', '#c4904c', '#dcae64', '#ecc684'];
const FROND: Ramp = ['#123418', '#1a4a20', '#246428', '#307e30', '#43983a', '#62b048', '#88c85c'];

/**
 * A date palm: a ringed golden trunk with a woven diamond pattern, a crown of
 * arching fronds (the ones behind darker), a knot of young leaves on top.
 * (x, y) is the foot of the trunk, h its height in px.
 */
function palm(c: C, x: number, y: number, h: number, seed: number, s = 1) {
  const Rn = rng(seed);
  const lean = (Rn() - 0.5) * 18 * s;
  const tx = x + lean;
  const ty = y - h;
  layer(
    c,
    (l) => {
      for (let j = 0; j < h; j++) {
        const t = j / h;
        const cx = x + lean * t * t;
        const w = (12 - t * 3.5) * s * (j < 6 ? 1 + (6 - j) * 0.05 : 1);
        const x0 = Math.round(cx - w / 2);
        const W = Math.max(3, Math.round(w));
        const ring = j % 5;
        for (let i = 0; i < W; i++) {
          const u = i / (W - 1);
          let k = u < 0.22 ? 5 : u < 0.5 ? 4 : u < 0.78 ? 3 : 2;
          if (ring === 0) k -= 2;
          else if (ring === 1) k -= 1;
          else if ((i + (Math.floor(j / 5) % 2) * 2) % 4 === 0) k -= 1;
          px(l, x0 + i, y - j, TRUNK[Math.max(0, Math.min(6, k))]);
        }
      }
    },
    { outline: 0.5, rect: [x - 20 * s - Math.abs(lean), ty - 4, x + 20 * s + Math.abs(lean), y + 3] },
  );
  // the crown: fronds arch up and out from the top and bend down toward their tips; each is a
  // spine with leaflets angled toward the tip. The ones behind are darker and drawn first.
  const fr: { ang: number; len: number; e: number }[] = [];
  const n = 15;
  for (let f = 0; f < n; f++) fr.push({ ang: (f / n) * Math.PI * 2 + (Rn() - 0.5) * 0.3, len: (58 + Rn() * 22) * s, e: 0.45 + Rn() * 0.75 });
  for (let f = 0; f < 4; f++) fr.push({ ang: Rn() * Math.PI * 2, len: (40 + Rn() * 12) * s, e: 1.3 + Rn() * 0.25 });
  fr.sort((m, q) => Math.sin(m.ang) - Math.sin(q.ang));
  const R0 = 92 * s;
  layer(
    c,
    (l) => {
      for (const f of fr) {
        const ca = Math.cos(f.ang);
        const sa = Math.sin(f.ang);
        const back = sa < -0.3;
        const base = back ? 2 : ca < 0.1 ? 4 : 3;
        const N = Math.ceil(f.len / 2.2);
        const at3 = (t: number): [number, number, number] => {
          const r = f.len * t * Math.cos(f.e * (1 - t * 0.5));
          const h = f.len * (Math.sin(f.e) * t - 0.62 * t * t);
          return [tx + ca * r, ty + sa * r * 0.5 - h, h];
        };
        let [x0, y0] = at3(0);
        const spine: [number, number][] = [[x0, y0]];
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const [x1, y1, h] = at3(t);
          spine.push([x1, y1]);
          const dl = Math.hypot(x1 - x0, y1 - y0) || 1;
          const ux = (x1 - x0) / dl;
          const uy = (y1 - y0) / dl;
          // the leaflets lie across the frond (horizontal, perpendicular to its heading), sweep toward the tip and droop
          const L = (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) * 0.8) * 13 * s;
          for (const sd of [-1, 1]) {
            const lx = x1 - sa * sd * L * 0.9 + ux * L * 0.5;
            const ly = y1 + ca * sd * L * 0.45 + uy * L * 0.5 + L * 0.42;
            const k = base + (sd * ca > 0 ? -1 : 0) + (h > f.len * 0.12 ? 1 : 0) - (t > 0.85 ? 1 : 0) + (i % 4 === 0 ? -1 : 0);
            ln(l, x1, y1, lx, ly, FROND[Math.max(0, Math.min(6, k))]);
          }
          x0 = x1;
          y0 = y1;
        }
        for (let i = 1; i < spine.length; i++) ln(l, spine[i - 1][0], spine[i - 1][1], spine[i][0], spine[i][1], FROND[Math.min(6, base + 2)]);
      }
      // the crown shaft and a tuft of young fronds pointing up
      ell(l, tx, ty + 2, 6 * s, 5 * s, TRUNK[2]);
      for (let i = -2; i <= 2; i++) curve(l, tx, ty, tx + i * 4 * s, ty - 14 * s, tx + i * 9 * s, ty - 20 * s, FROND[5 - Math.abs(i)], 2);
      // a few clusters of dates
      for (let i = 0; i < 3; i++) {
        const an = Rn() * Math.PI * 2;
        const [dx, dy] = [tx + Math.cos(an) * 7 * s, ty + 6 + Math.abs(Math.sin(an)) * 3];
        for (let q = 0; q < 5; q++) px(l, dx + (q % 3) - 1, dy + Math.floor(q / 2), q % 2 ? '#d88a2a' : '#b86a1e', 2, 2);
      }
    },
    { outline: 0.5, rect: [tx - R0 - 6, ty - R0 * 0.75, tx + R0 + 6, ty + R0 * 0.8] },
  );
}

/** A palm in a square stone planter (a, b local, z its foot). */
function palmPlanter(p: PropPainter, a: number, b: number, z: number, seed: number) {
  const w = 0.9;
  planter(p, a - w / 2, b - w / 2, a + w / 2, b + w / 2, z, 6, seed, { flowers: 0.25, r: 0.75 });
  const [x, y] = p.P(a, b, z + 6);
  palm(p.c, x, y + 2, 136, seed, 1.15);
}

// ── the clock tower ─────────────────────────────────────────
const COPPER: Ramp = ['#341a10', '#4e2818', '#6a3820', '#874a2a', '#a35f36', '#bd7b48', '#d49a62', '#e8bc86'];
const GOLD: Ramp = ['#6a4a10', '#94701c', '#c09a2c', '#e2c04a', '#f6e086'];
const OAK: Ramp = ['#2e1a0e', '#452814', '#5e381c', '#784826', '#925a30', '#ac6e3c'];

/** Cut-stone ashlar for the tower and the old building: big blocks, fine joints. */
const ashlar =
  (rowH: number, bw: number): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const fu = (u + (row & 1 ? bw / 2 : 0)) % bw;
    let i = light === 2 ? 6 : light ? 5 : 3;
    if (fv < 1 || fu < 1) i -= 1.4;
    else if (fv > rowH - 2) i += 0.6;
    else if (fu < 3 && light === 1) i += 0.4;
    if (hash(Math.floor((u + (row & 1 ? bw / 2 : 0)) / bw), row, 61) < 0.18) i -= 0.5;
    if (hash(x, y, 62) < 0.025) i -= 1;
    return at(IVORY, i);
  };

/**
 * A ribbed dome as an ellipsoid of radius R tiles and height H z, its base
 * centred at screen (cx, cy): every pixel finds the front-most point of the
 * surface and shades it from the upper left; ribs every 1/ribs of a turn.
 */
function dome(c: C, cx: number, cy: number, R: number, H: number, ribs: number, ramp: Ramp) {
  const RX = R * 90.6;
  const k2 = 2048 * R * R;
  const A = 16 / k2 + 1 / (H * H);
  const Lx = -0.42;
  const Ly = 0.5;
  const Lz = 0.76;
  const N = ramp.length;
  for (let Y = Math.floor(-H * 4 - 2); Y <= Math.ceil(R * 45.3); Y++)
    for (let X = Math.floor(-RX); X <= Math.ceil(RX); X++) {
      const s = (X + 0.5) / 64;
      const Yc = Y + 0.5;
      const B = (8 * Yc) / k2;
      const C0 = (Yc * Yc) / k2 + (s * s) / (2 * R * R) - 1;
      const disc = B * B - 4 * A * C0;
      if (disc < 0) continue;
      const z = (-B + Math.sqrt(disc)) / (2 * A);
      if (z < 0) continue;
      const q = (Yc + 4 * z) / 32;
      const x = (q + s) / 2;
      const y = (q - s) / 2;
      let nx = x / (R * R) / 2;
      let ny = y / (R * R) / 2;
      let nz = (z / (H * H)) * 10;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const lit = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      let t = 0.6 + lit * (N - 2.2) + (bayer(cx + X, cy + Y) - 0.5) * 0.7;
      const ph = (Math.atan2(y, x) / (Math.PI * 2)) * ribs;
      const fr = ph - Math.floor(ph);
      if (fr < 0.09) t += 1.4;
      else if (fr > 0.88) t -= 1.1;
      if (z / H < 0.07) t -= 1;
      px(c, cx + X, cy + Y, ramp[Math.max(0, Math.min(N - 1, Math.round(t)))]);
    }
}

/** A round drum of radius R tiles from z0 to z1 above (cx, cy), lit from the left. */
function drum(c: C, cx: number, cy: number, R: number, z0: number, z1: number, ramp: Ramp) {
  const RX = R * 90.6;
  for (let X = Math.floor(-RX); X <= Math.ceil(RX); X++) {
    const s = (X + 0.5) / 64;
    const q2 = 2 * R * R - s * s;
    if (q2 < 0) continue;
    const q = Math.sqrt(q2);
    const x = (q + s) / 2;
    const y = (q - s) / 2;
    const lit = Math.max(0, (-0.42 * x + 0.62 * y) / R);
    const k = Math.round(1.6 + lit * (ramp.length - 2.4));
    const yb = cy + q * 32 - z0 * 4;
    const yt = cy + q * 32 - z1 * 4;
    px(c, cx + X, yt, ramp[Math.min(ramp.length - 1, k)], 1, Math.max(1, yb - yt));
    px(c, cx + X, yt, ramp[Math.min(ramp.length - 1, k + 1)], 1, 1);
  }
}

/** A clock dial on a plane, centred at (uc, zc): stone ring, white face, hour marks, gold hands. */
function clockFace(p: PropPainter, pl: Pl, uc: number, zc: number, Rm: number, seed: number) {
  const ru = Rm / 2 + 0.06;
  const rz = Rm * 10 + 1.2;
  const L = pl.light;
  const hH = (seed % 12) / 12;
  const mH = ((seed * 7) % 60) / 60;
  const ha = Math.PI / 2 - hH * Math.PI * 2 - 0.3;
  const ma = Math.PI / 2 - mH * Math.PI * 2;
  // u runs to the screen left on the side plane: flip it so the clock turns clockwise
  const flip = pl.F(1, 0)[0] > pl.F(0, 0)[0] ? 1 : -1;
  pt(p, pl, uc - ru, uc + ru, zc - rz, zc + rz, (u: number, v: number, x: number, y: number) => {
    const dx = ((u - ru * 71.55) / 35.78) * flip;
    const dy = (v - rz * 4) / 40;
    const d = Math.hypot(dx, dy) / Rm;
    if (d > 1.14) return null;
    if (d > 1) return d > 1.1 ? IVORY[tone(pl, 2, 1)] : IVORY[tone(pl, 6, 4)];
    if (d > 0.9) return (Math.floor((Math.atan2(dy, dx) / Math.PI) * 30) & 1) === 0 ? GOLD[tone(pl, 3, 2)] : GOLD[tone(pl, 2, 1)];
    const an = Math.atan2(dy, dx);
    const hr = ((an / (Math.PI * 2)) * 12 + 12) % 1;
    const near = Math.min(hr, 1 - hr);
    if (d > 0.66 && d < 0.86 && near < (Math.abs(Math.round(((an / (Math.PI * 2)) * 12 + 12) % 12) % 3) === 0 ? 0.09 : 0.05)) return '#2a2420';
    if (d > 0.84 && d < 0.88) return '#5a5048';
    // the hands: hour (short, thick) and minute (long), gold with a dark edge
    // the hands: 0 outside, 1 on the gold, 2 on the dark rim
    const hand = (a: number, len: number, wd: number) => {
      const ax = Math.cos(a);
      const ay = Math.sin(a);
      const along = (dx * ax + dy * ay) / Rm;
      const across = Math.abs(-dx * ay + dy * ax) / Rm;
      const w = wd * (1 - along / (len * 1.3)) + 0.035;
      if (along < -0.12 || along > len + 0.04 || across > w) return 0;
      return across > w - 0.035 || along > len || along < -0.08 ? 2 : 1;
    };
    const hm = Math.max(hand(ma, 0.78, 0.07), hand(ha, 0.5, 0.1));
    if (hm === 1) return GOLD[L ? 3 : 2];
    if (hm === 2) return GOLD[0];
    if (d < 0.1) return '#2a2420';
    let i = L ? 5 : 4;
    if (d > 0.8) i -= 1;
    if (hash(x, y, 4) < 0.02) i -= 1;
    return at(['#8a8478', '#b0aa9e', '#d2ccbe', '#e8e2d6', '#f6f2e8', '#fffdf6'], i);
  });
}

/** A tall round-arched opening of the belfry: dark inside, a warm glow, a bronze bell. */
function belfryArch(p: PropPainter, pl: Pl, c: number, hw: number, z0: number, zs: number) {
  const rz = hw * 19.6;
  fillOn(p, pl, archPts(c, hw + 0.05, zs, rz + 1.1).map(([u, z]) => [u, Math.max(z0 - 0.6, z)] as [number, number]), IVORY[tone(pl, 3, 2)]);
  const q = archPts(c, hw, zs, rz).map(([u, z]) => [u, Math.max(z0, z)] as [number, number]);
  fillOn(p, pl, q, IVORY[tone(pl, 2, 4)]);
  fillOn(p, pl, archPts(c + 0.03, hw - 0.03, zs, rz - 0.6).map(([u, z]) => [u, Math.max(z0, z)] as [number, number]), '#1c130e');
  // the warm light inside, low, and the bell hanging in the middle
  pq(p, pl, c - hw + 0.06, c + hw, z0, z0 + 6, '#5a3416');
  pq(p, pl, c - hw + 0.08, c + hw - 0.02, z0, z0 + 3, '#8a5222');
  const [bx, by] = pl.F(c + 0.03, zs + rz * 0.2);
  fillPoly(p.c, [[bx - 3, by - 8], [bx + 3, by - 8], [bx + 6, by + 2], [bx - 6, by + 2]], '#8a6224');
  px(p.c, bx - 3, by - 7, '#c89a40', 2, 6);
  ell(p.c, bx, by + 2, 6, 2, '#6a4a1c');
  const [gx, gy] = pl.F(c + 0.03, z0 + 2.6);
  ell(p.c, gx, gy, 4, 2.4, '#ffd27a');
  px(p.c, gx - 1, gy - 1, '#fff2c4', 2, 1);
  // the sill
  pq(p, pl, c - hw - 0.06, c + hw + 0.06, z0 - 1.2, z0, IVORY[tone(pl, 6, 4)]);
}

/** A round-arched window of the stone building: surround, keystone, sill, glass or warm light, mullions. */
function archWindow(p: PropPainter, pl: Pl, c: number, hw: number, z0: number, zs: number, lit: boolean, seed: number) {
  const L = pl.light;
  const rz = hw * 19.6;
  fillOn(p, pl, archPts(c, hw + 0.07, zs, rz + 1.6).map(([u, z]) => [u, Math.max(z0 - 0.4, z)] as [number, number]), IVORY[tone(pl, 6, 4)]);
  for (let j = 1; j < 7; j++) {
    const t = Math.PI - (j / 7) * Math.PI;
    const [x0, y0] = pl.F(c + Math.cos(t) * hw, zs + Math.sin(t) * rz);
    const [x1, y1] = pl.F(c + Math.cos(t) * (hw + 0.07), zs + Math.sin(t) * (rz + 1.6));
    ln(p.c, x0, y0, x1, y1, IVORY[tone(pl, 4, 2)]);
  }
  const q = archPts(c, hw, zs, rz).map(([u, z]) => [u, Math.max(z0, z)] as [number, number]);
  fillOn(p, pl, q, IVORY[tone(pl, 2, 4)]);
  const inner = archPts(c + 0.025, hw - 0.025, zs, rz - 0.5).map(([u, z]) => pl.at(u, Math.max(z0, z)));
  const hpx = (zs + rz - z0) * 4;
  const tex = lit ? litTex(L, hpx, seed) : glassTex(L, hpx, GLASS, seed);
  const S = inner.map((v) => p.P(v[0], v[1], v[2]));
  // the glass: textured inside the arch outline (clip with the polygon's own scanlines)
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of S) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const [ox, oy] = pl.F(c, z0);
  const [sx1, sy1] = pl.F(c + 1, z0);
  const slope = (sy1 - oy) / (sx1 - ox);
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < S.length; i++) {
      const [ax, ay] = S[i];
      const [bx, by] = S[(i + 1) % S.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) {
        const col = tex(x - ox + 40, oy - y + (x - ox) * slope, x, y);
        if (col) px(p.c, x, y, col);
      }
  }
  if (lit) interior(p, pl, c - hw + 0.04, c + hw - 0.04, z0, zs + rz - 2, hash(Math.round(c * 50), Math.round(z0), seed));
  const fc = FRAME[L ? 5 : 4];
  pq(p, pl, c - PXU, c + PXU, z0, zs + rz - 0.6, fc);
  pq(p, pl, c - hw, c + hw, zs - 0.3, zs + 0.3, fc);
  for (let j = 1; j < 4; j++) {
    const t = Math.PI - (j / 4) * Math.PI;
    const [ax, ay] = pl.F(c, zs);
    const [bx, by] = pl.F(c + Math.cos(t) * hw, zs + Math.sin(t) * rz);
    ln(p.c, ax, ay, bx, by, fc);
  }
  // keystone and sill
  fillOn(p, pl, [[c - 0.05, zs + rz - 0.6], [c + 0.05, zs + rz - 0.6], [c + 0.07, zs + rz + 2.4], [c - 0.07, zs + rz + 2.4]], IVORY[tone(pl, 6, 5)]);
  pq(p, pl, c - hw - 0.1, c + hw + 0.1, z0 - 1.8, z0, IVORY[tone(pl, 6, 4)]);
  pq(p, pl, c - hw - 0.1, c + hw + 0.1, z0 - 2.2, z0 - 1.8, IVORY[tone(pl, 3, 2)]);
}

/** The arched oak double door with a glowing fanlight, steps and two lanterns. */
function archDoor(p: PropPainter, pl: Pl, c: number) {
  const hw = 0.5;
  const zs = 21;
  const rz = hw * 19.6;
  // the stone frame: a moulded archivolt on two pilasters
  fillOn(p, pl, archPts(c, hw + 0.16, zs, rz + 3.2), IVORY[tone(pl, 6, 4)]);
  fillOn(p, pl, archPts(c, hw + 0.1, zs, rz + 2), IVORY[tone(pl, 4, 3)]);
  fillOn(p, pl, archPts(c, hw, zs, rz), '#2a1a10');
  // the fanlight and the leaves
  fillOn(p, pl, archPts(c, hw - 0.04, zs + 0.6, rz - 0.8).slice(1, -1).concat([[c + hw - 0.04, zs + 0.6], [c - hw + 0.04, zs + 0.6]]), WARM[5]);
  for (let j = 1; j < 6; j++) {
    const t = Math.PI - (j / 6) * Math.PI;
    const [ax, ay] = pl.F(c, zs + 0.6);
    const [bx, by] = pl.F(c + Math.cos(t) * (hw - 0.04), zs + 0.6 + Math.sin(t) * (rz - 0.8));
    ln(p.c, ax, ay, bx, by, '#3a2414');
  }
  const leaf = (u0: number, u1: number) => {
    pt(p, pl, u0, u1, 0, zs, (u: number, v: number, x: number, y: number) => {
      let i = pl.light ? 3 : 2;
      const w = (u1 - u0) * 71.55;
      if (u < 2 || u > w - 2 || v < 2 || v > zs * 4 - 2) i -= 1;
      // raised panels
      const inP = (v > 8 && v < 36) || (v > 44 && v < zs * 4 - 8);
      if (inP && u > 5 && u < w - 5) i += (u < 7 || v < 10 || (v > 46 && v < 48)) ? 1 : 0;
      else if (inP && (u === 5 || u >= w - 5)) i -= 1;
      if (hash(x, y >> 2, 7) < 0.1) i -= 0.6;
      return at(OAK, i);
    });
  };
  leaf(c - hw + 0.04, c - 0.01);
  leaf(c + 0.01, c + hw - 0.04);
  pq(p, pl, c - 0.012, c + 0.012, 0, zs, WARM[4]);
  for (const s of [-1, 1]) {
    const [hx, hy] = pl.F(c + s * 0.06, 10);
    ell(p.c, hx, hy, 2, 2, GOLD[3]);
  }
  // the lanterns either side
  for (const s of [-1, 1]) {
    const [lx, ly] = pl.F(c + s * (hw + 0.34), 24);
    layer(
      p.c,
      (l) => {
        px(l, lx - 1, ly - 2, '#1e1a18', 2, 6);
        fillPoly(l, [[lx - 5, ly - 16], [lx + 5, ly - 16], [lx + 4, ly - 2], [lx - 4, ly - 2]], '#1e1a18');
        px(l, lx - 3, ly - 14, '#ffd77a', 6, 10);
        px(l, lx - 2, ly - 13, '#fff4c8', 2, 6);
        fillPoly(l, [[lx - 7, ly - 16], [lx + 7, ly - 16], [lx, ly - 22]], '#2a2420');
      },
      { outline: 0.5, rect: [lx - 10, ly - 26, lx + 10, ly + 6] },
    );
  }
}

interface Tower {
  a0: number;
  a1: number;
  b0: number;
  b1: number;
}
const towerOf = (W: number): Tower => ({ a0: W - 2.4, a1: W - 0.1, b0: 0.25, b1: 2.55 });
const ZB = 70; // the stone building's cornice
const ZCLOCK = 92;
const ZBEL = 112;

function tower(p: PropPainter, T: Tower, aWall: number, seed: number) {
  const { a0, a1, b0, b1 } = T;
  const tw = a1 - a0;
  const st = ashlar(28, 56);
  const F = F3(p, b1);
  const S = S3(p, a1);
  const top = ashlar(60, 90);
  // plinth and shaft: the east face from the ground, the south face only above the roof it rises from
  pt(p, S3(p, a1 + 0.08), b0 - 0.08, b1 + 0.08, 0, 4, ashlar(16, 40));
  hq(p, a1, b0, a1 + 0.08, b1 + 0.08, 4, IVORY[6]);
  pt(p, S, b0, b1, 4, ZBEL, st);
  pt(p, F, a0, a1, ZB, ZBEL, st);
  pt(p, F, aWall, a1, 0, ZB, st);
  // quoins on the corner
  for (let z = 6; z < ZBEL - 6; z += 7) {
    const w = Math.floor(z / 7) % 2 ? 0.16 : 0.26;
    pq(p, S, b1 - w, b1, z, z + 6.4, IVORY[4]);
    pq(p, S, b1 - w, b1, z, z + 0.5, IVORY[2]);
    if (z > ZB) {
      pq(p, F, a1 - w, a1, z, z + 6.4, IVORY[6]);
      pq(p, F, a1 - w, a1, z, z + 0.5, IVORY[4]);
    }
  }
  // a window lighting the stair at the foot of the tower, a narrow one above
  archWindow(p, S, (b0 + b1) / 2, 0.24, 9, 24, true, seed + 3);
  archWindow(p, S, (b0 + b1) / 2, 0.16, 44, 58, false, seed + 4);
  // projecting bands: a string course just above the roof, a cornice under the belfry
  const band = (z: number, h: number, o: number) => lbox(p, a0 - o, b0 - o, tw + 2 * o, b1 - b0 + 2 * o, z, h, { front: ashlar(40, 80), side: ashlar(40, 80), top, edge: IVORY[1] });
  band(ZB + 4, 3, 0.06);
  band(ZBEL - 4, 4, 0.1);
  for (const [pl, u0, u1] of [[F, a0, a1], [S, b0, b1]] as const) {
    const uc = (u0 + u1) / 2;
    // a sunk panel round the clock, then the dial
    pq(p, pl, u0 + 0.22, u1 - 0.22, ZB + 8, ZBEL - 6, IVORY[tone(pl, 4, 2)]);
    pq(p, pl, u0 + 0.26, u1 - 0.26, ZB + 8.6, ZBEL - 6.6, IVORY[tone(pl, 5, 3)]);
    clockFace(p, pl, uc, ZCLOCK, 1.2, seed + (pl === F ? 0 : 5));
  }
  // the belfry: three arches a side on piers, an impost band
  lbox(p, a0, b0, tw, b1 - b0, ZBEL, 30, { front: st, side: st, top, edge: IVORY[1] });
  for (const [pl, u0, u1] of [[F, a0, a1], [S, b0, b1]] as const) {
    const n = 3;
    const hw = ((u1 - u0) / n) * 0.3;
    for (let i = 0; i < n; i++) belfryArch(p, pl, u0 + ((u1 - u0) * (i + 0.5)) / n, hw, ZBEL + 3, ZBEL + 18);
    // impost blocks on the piers at the springing of the arches
    for (let i = 0; i <= n; i++) {
      const c = u0 + ((u1 - u0) * i) / n;
      pq(p, pl, Math.max(u0, c - (i % n ? 0.16 : 0.12)) + (i ? 0 : 0), Math.min(u1, c + (i % n ? 0.16 : 0.12)), ZBEL + 17.2, ZBEL + 18.6, IVORY[tone(pl, 6, 4)]);
    }
  }
  // the crowning cornice with dentils, a drum, the copper dome, the finial
  lbox(p, a0 - 0.16, b0 - 0.16, tw + 0.32, b1 - b0 + 0.32, ZBEL + 30, 2, { front: ashlar(40, 80), side: ashlar(40, 80), top, edge: IVORY[1] });
  lbox(p, a0 - 0.24, b0 - 0.24, tw + 0.48, b1 - b0 + 0.48, ZBEL + 32, 2.4, { front: ashlar(40, 80), side: ashlar(40, 80), top, edge: IVORY[1] });
  for (const [pl, u0, u1] of [[F3(p, b1 + 0.16), a0 - 0.16, a1 + 0.16], [S3(p, a1 + 0.16), b0 - 0.16, b1 + 0.16]] as const)
    for (let u = u0 + 0.06; u < u1 - 0.05; u += 0.16) pq(p, pl, u, u + 0.08, ZBEL + 30.4, ZBEL + 31.6, IVORY[tone(pl, 3, 2)]);
  const [cx, cy] = p.P((a0 + a1) / 2, (b0 + b1) / 2, ZBEL + 34.4);
  const R0 = tw * 0.43;
  layer(
    p.c,
    (l) => {
      drum(l, cx, cy, R0 + 0.06, 0, 4.4, IVORY);
      ell(l, cx, cy - 18, (R0 + 0.06) * 90.6, (R0 + 0.06) * 45.3, IVORY[5]);
      dome(l, cx, cy - 18, R0, R0 * 28, 16, COPPER);
      // the lantern and finial
      const ty = cy - 18 - R0 * 28 * 4;
      drum(l, cx, ty + 4, 0.12, 0, 3.5, COPPER);
      ell(l, cx, ty - 10, 11, 5, COPPER[5]);
      ell(l, cx - 2, ty - 11, 6, 3, COPPER[7]);
      px(l, cx - 1, ty - 34, GOLD[2], 3, 24);
      px(l, cx - 1, ty - 34, GOLD[4], 1, 24);
      ell(l, cx, ty - 22, 4, 4, GOLD[3]);
      ell(l, cx - 1, ty - 23, 2, 2, GOLD[4]);
    },
    { outline: 0.55, rect: [cx - R0 * 92 - 10, cy - 18 - R0 * 100 - 60, cx + R0 * 92 + 10, cy + R0 * 50 + 4] },
  );
}

/** The stone building's windows (shared by its drawing and its night lights). */
interface HouseWin {
  side: boolean;
  c: number;
  z0: number;
  zs: number;
  lit: boolean;
  seed: number;
}
function houseWindows(k: PropCtx, T: Tower, a0: number, a1: number, b1: number) {
  const Rn = rng(k.seed * 31 + 5);
  const doorB = T.b1 + (b1 - T.b1) * 0.46;
  const wins: HouseWin[] = [];
  const nF = Math.max(2, Math.round((a1 - a0) / 1.5));
  for (let i = 0; i < nF; i++) {
    const c = a0 + ((a1 - a0) * (i + 0.5)) / nF;
    wins.push({ side: false, c, z0: 8, zs: 24, lit: Rn() < 0.4, seed: k.seed + i });
    wins.push({ side: false, c, z0: 43, zs: 57, lit: Rn() < 0.35, seed: k.seed + i + 20 });
  }
  const nS = Math.max(2, Math.round((b1 - T.b1) / 1.45));
  for (let i = 0; i < nS; i++) {
    const c = T.b1 + ((b1 - T.b1) * (i + 0.5)) / nS;
    const low = Rn() < 0.45;
    if (Math.abs(c - doorB) > 0.9) wins.push({ side: true, c, z0: 8, zs: 24, lit: low, seed: k.seed + i + 40 });
    wins.push({ side: true, c, z0: 43, zs: 57, lit: Rn() < 0.35, seed: k.seed + i + 60 });
  }
  return { wins, doorB };
}

/** The two-storey stone building's two faces: arched windows, the door to the plaza, string course, cornice. */
function oldHouse(p: PropPainter, k: PropCtx, T: Tower, a0: number, a1: number, b1: number) {
  const F = F3(p, b1);
  const S = S3(p, a1);
  pt(p, F, a0, a1, 0, ZB, ashlar(26, 64));
  pt(p, S, T.b1, b1, 0, ZB, ashlar(26, 64));
  for (const [pl, u0, u1] of [[F, a0, a1], [S, T.b1, b1]] as const) {
    // plinth, the string course between the floors
    pq(p, pl, u0, u1, 0, 3.4, IVORY[tone(pl, 3, 2)]);
    pq(p, pl, u0, u1, 3, 3.4, IVORY[tone(pl, 5, 3)]);
    pq(p, pl, u0, u1, 35, 38, IVORY[tone(pl, 5, 3)]);
    pq(p, pl, u0, u1, 37.4, 38, IVORY[tone(pl, 6, 4)]);
    pq(p, pl, u0, u1, 35, 35.5, IVORY[tone(pl, 3, 2)]);
  }
  // tall arched windows on both floors, the door to the plaza on the east
  const { wins, doorB } = houseWindows(k, T, a0, a1, b1);
  for (const w of wins) archWindow(p, w.side ? S : F, w.c, 0.27, w.z0, w.zs, w.lit, w.seed);
  archDoor(p, S, doorB);
  for (let s = 0; s < 2; s++) lbox(p, a1 + s * 0.14, doorB - 0.7 + s * 0.06, 0.2 - s * 0.06, 1.4 - s * 0.12, 0, 2.4 - s * 1.2, { front: ashlar(10, 30), side: ashlar(10, 30), top: ashlar(30, 50), edge: IVORY[1] });
  // the cornice: two projecting mouldings along both faces
  ledge(p, a0, a1, b1, T.b1, ZB - 4, 2.4, 0.1);
  ledge(p, a0, a1, b1, T.b1, ZB - 1.6, 1.6, 0.16);
  return doorB;
}

/** A moulding projecting `o` tiles from the front (b = bF, a0..a1) and the side (a = a1, bS..bF): faces and top. */
function ledge(p: PropPainter, a0: number, a1: number, bF: number, bS: number, z: number, h: number, o: number) {
  const F = F3(p, bF + o);
  const S = S3(p, a1 + o);
  hq(p, a0 - o, bF, a1 + o, bF + o, z + h, IVORY[6]);
  hq(p, a1, bS, a1 + o, bF + o, z + h, IVORY[6]);
  pq(p, F, a0 - o, a1 + o, z, z + h, IVORY[5]);
  pq(p, F, a0 - o, a1 + o, z, z + 0.4, IVORY[3]);
  pq(p, S, bS, bF + o, z, z + h, IVORY[3]);
  pq(p, S, bS, bF + o, z, z + 0.4, IVORY[1]);
  const e = pts(p, [[a0 - o, bF + o, z + h], [a1 + o, bF + o, z + h], [a1 + o, bS, z + h]]);
  ln(p.c, e[0][0], e[0][1], e[1][0], e[1][1], '#fffaf0');
  ln(p.c, e[1][0], e[1][1], e[2][0], e[2][1], IVORY[5]);
}

const campanile: PropArt = {
  draw(p0, k) {
    const p = upright(p0);
    const W = k.w;
    const D = k.d;
    const T = towerOf(W);
    const a0 = 0.15;
    const a1 = W - 0.2;
    const b0 = 0.3;
    const b1 = D - 0.2;
    const zr = ZB;
    const PTc = 0.2;
    veilH(p, a0, b1, a1 + 0.35, b1 + 0.35, 0, SHADOW, 0.22);
    veilH(p, a1, b0, a1 + 0.6, b1 + 0.35, 0, SHADOW, 0.26);
    // the roof deck inside the parapet, the parapet's inner faces and copings at the back
    const A0 = a0 + PTc;
    const B0 = b0 + PTc;
    const A1 = a1 - PTc;
    const B1 = b1 - PTc;
    const top = ashlar(60, 90);
    lbox(p, a0 - 0.16, b0 - 0.16, T.a0 - a0 + 0.16, T.b1 - b0 + 0.16, ZB - 1.6, 1.6, { front: ashlar(40, 80), side: ashlar(40, 80), top, edge: IVORY[1] });
    pavers(p, A0, B0, A1, B1, zr, k.seed);
    pq(p, F3(p, B0), A0, T.a0, zr, zr + 5, IVORY[4]);
    pq(p, F3(p, B0), A0, T.a0, zr, zr + 1, IVORY[3]);
    pq(p, S3(p, A0), B0, B1, zr, zr + 5, IVORY[2]);
    pq(p, S3(p, A0), B0, B1, zr, zr + 1, IVORY[1]);
    hq(p, a0, b0, T.a0, B0, zr + 5, IVORY[6]);
    hq(p, a0, b0, A0, b1, zr + 5, IVORY[6]);
    planter(p, A0 + 0.02, B0 + 0.02, T.a0 - 0.1, B0 + 0.62, zr, 4.4, k.seed + 3, { flowers: 0.2 });
    // the tower at the north-east corner
    tower(p, T, a1, k.seed);
    // the garden in front of it: a bed along the west parapet, two palms in planters, flowers, a bench
    const items: { k: number; f: () => void }[] = [];
    items.push({ k: A0 + B0 + 1, f: () => planter(p, A0 + 0.02, B0 + 0.66, A0 + 0.62, B1 - 0.05, zr, 4.4, k.seed + 5, { flowers: 0.2 }) });
    items.push({ k: A0 + 1.3 + T.b1 + 0.7, f: () => planter(p, A0 + 1.3, T.b1 + 0.4, T.a0 + 0.3, T.b1 + 1.0, zr, 4.4, k.seed + 7, { flowers: 0.55 }) });
    const p1: [number, number] = [A0 + 1.6, B1 - 2.3];
    const p2: [number, number] = [A1 - 1.4, T.b1 + 2.4];
    items.push({ k: p1[0] + p1[1], f: () => palmPlanter(p, p1[0], p1[1], zr, k.seed + 11) });
    items.push({ k: p2[0] + p2[1], f: () => palmPlanter(p, p2[0], p2[1], zr, k.seed + 13) });
    items.push({ k: A1 - 1.3 + B1 - 0.9, f: () => planter(p, A1 - 2.4, B1 - 1.2, A1 - 0.3, B1 - 0.62, zr, 3.6, k.seed + 17, { flowers: 0.6 }) });
    items.push({ k: A0 + 0.9 + B1 - 4, f: () => lbox(p, A0 + 0.72, B1 - 4.6, 0.32, 1.3, zr, 3.6, { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK), edge: TEAK[0] }) });
    // an island bed in the middle with a small tree
    const ia = A0 + 2.3;
    const ib = T.b1 + 2.6;
    items.push({ k: ia + 0.7 + ib + 0.5, f: () => planter(p, ia, ib, ia + 1.5, ib + 0.9, zr, 4, k.seed + 41, { flowers: 0.5 }) });
    items.push({ k: ia + 0.75 + ib + 0.45 + 0.01, f: () => pottedTree(p, ia + 0.75, ib + 0.45, zr + 2, k.seed + 43, 1.05) });
    items.push({ k: A0 + 3 + B1 - 0.5, f: () => flowerPot(p, A0 + 3, B1 - 0.5, zr, k.seed + 19) });
    // a teak deck with two loungers and a parasol, an olive tree by the tower
    const la = A0 + 2.7;
    const lb = B1 - 3.3;
    items.push({ k: la + lb, f: () => lbox(p, la, lb, 1.9, 1.5, zr, 0.6, { front: grain(TEAK), side: grain(TEAK), top: grain(TEAK, 'v'), edge: TEAK[0] }) });
    items.push({ k: la + 0.3 + lb + 0.8, f: () => lounger(p, la + 0.2, lb + 0.25, zr + 0.6) });
    items.push({ k: la + 0.75 + lb + 0.8, f: () => lounger(p, la + 0.65, lb + 0.25, zr + 0.6) });
    items.push({ k: la + 1.5 + lb + 0.6, f: () => parasol(p, la + 1.45, lb + 0.5, zr + 0.6, 0.9) });
    items.push({ k: T.a0 - 0.7 + T.b1 + 1.6, f: () => pottedTree(p, T.a0 - 0.7, T.b1 + 1.6, zr, k.seed + 31, 1.1) });
    items.push({ k: A0 + 1.2 + B0 + 1.4, f: () => pottedTree(p, A0 + 1.2, B0 + 1.4, zr, k.seed + 37) });
    items.sort((m, n) => m.k - n.k);
    for (const it of items) it.f();
    // the building's faces, the parapet with shrubs along it
    oldHouse(p, k, T, a0, a1, b1);
    const Fp = F3(p, b1);
    const Sp = S3(p, a1);
    pq(p, Fp, a0, a1, zr, zr + 5, IVORY[5]);
    pq(p, Sp, T.b1, b1, zr, zr + 5, IVORY[3]);
    pq(p, Fp, a0, a1, zr + 4.4, zr + 5, IVORY[6]);
    pq(p, Sp, T.b1, b1, zr + 4.4, zr + 5, IVORY[4]);
    hq(p, a0, B1, a1, b1, zr + 5, IVORY[6]);
    hq(p, A1, T.b1, a1, b1, zr + 5, IVORY[6]);
    hedgeRow(p, [a0 + 0.25, b1 - 0.1, zr + 5], [a1 - 0.2, b1 - 0.1, zr + 5], k.seed + 23, { flowers: 0.2 });
    hedgeRow(p, [a1 - 0.1, T.b1 + 0.3, zr + 5], [a1 - 0.1, b1 - 0.3, zr + 5], k.seed + 29, { flowers: 0.2 });
  },
};

// ── night lights ────────────────────────────────────────────
const WINDOW = '#ffd49a';

/** Up to n items spread evenly through a list. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor(((i + 0.5) * list.length) / n)]);
  return out;
}

blocco.lights = (k) => {
  const P = planBlock(k);
  const wins: PropLight[][] = [[], []];
  P.faces.forEach((f, fi) => {
    for (let s = 0; s < P.storeys; s++) {
      const za = GH + s * SH + SLAB;
      const zt = GH + (s + 1) * SH;
      f.bays.forEach(([g0, g1], col) => {
        if (inSlats(f, col)) return;
        const panes = panesOf(g0, g1, patOf(P, fi, col));
        const pi = panes.findIndex(([, , kind], i) => kind === 'g' && paneLit(P, fi, col, s, i, kind));
        if (pi < 0) return;
        const u = (panes[pi][0] + panes[pi][1]) / 2;
        const z = (za + zt) / 2;
        wins[fi].push(fi === 0 ? { a: u, b: P.b1, z, r: 1.2, color: WINDOW, kind: 'window' } : { a: P.a1, b: u, z, r: 1.2, color: WINDOW, kind: 'window' });
      });
    }
  });
  const total = wins[0].length + wins[1].length;
  const N = Math.min(16, Math.max(10, Math.round(total * 0.7)));
  const out: PropLight[] = [];
  wins.forEach((w) => out.push(...spread(w, Math.max(1, Math.round((N * w.length) / Math.max(1, total))))));
  // the ground floor: arches, shop windows, the lobby
  P.faces.forEach((f, fi) => {
    const bays = spread(f.bays, 4);
    for (const [g0, g1] of bays) {
      const u = (g0 + g1) / 2;
      const r = P.ground === 'archi' ? 1.3 : 1.6;
      out.push(fi === 0 ? { a: u, b: P.b1 + 0.1, z: 12, r, color: '#ffcf8a', kind: 'window' } : { a: P.a1 + 0.1, b: u, z: 12, r, color: '#ffcf8a', kind: 'window' });
    }
  });
  if (P.pent) {
    const [a0, , a1, b1] = P.pent;
    out.push({ a: (a0 + a1) / 2, b: b1, z: P.ze + 14, r: 1.2, color: WINDOW, kind: 'window' });
  }
  return out;
};

campanile.lights = (k) => {
  const W = k.w;
  const D = k.d;
  const T = towerOf(W);
  const a1 = W - 0.2;
  const b1 = D - 0.2;
  const doorB = houseWindows(k, T, 0.15, a1, b1).doorB;
  const tc = (T.a0 + T.a1) / 2;
  const tb = (T.b0 + T.b1) / 2;
  const out: PropLight[] = [
    // the clock dials glow, the belfry is lit inside
    { a: tc, b: T.b1, z: ZCLOCK, r: 0.6, color: '#fff2d0', kind: 'lamp' },
    { a: T.a1, b: tb, z: ZCLOCK, r: 0.6, color: '#fff2d0', kind: 'lamp' },
    { a: tc, b: T.b1, z: ZBEL + 10, r: 0.9, color: '#ffc870', kind: 'lamp' },
    { a: T.a1, b: tb, z: ZBEL + 10, r: 0.9, color: '#ffc870', kind: 'lamp' },
    // the door and its lanterns
    { a: a1 + 0.05, b: doorB, z: 16, r: 1.8, color: '#ffcf8a', kind: 'window' },
    { a: a1 + 0.05, b: doorB - 0.84, z: 26, r: 1.2, color: '#ffd27a', kind: 'lamp' },
    { a: a1 + 0.05, b: doorB + 0.84, z: 26, r: 1.2, color: '#ffd27a', kind: 'lamp' },
    // the stair window at the foot of the tower
    { a: T.a1, b: tb, z: 17, r: 1.1, color: WINDOW, kind: 'window' },
  ];
  // the lit windows of both faces
  for (const w of houseWindows(k, T, 0.15, a1, b1).wins.filter((v) => v.lit).slice(0, 9)) {
    const z = (w.z0 + w.zs) / 2 + 2;
    out.push(w.side ? { a: a1, b: w.c, z, r: 1.2, color: WINDOW, kind: 'window' } : { a: w.c, b: b1, z, r: 1.2, color: WINDOW, kind: 'window' });
  }
  return out;
};

export const CITY_BLOCKS: Record<string, PropArt> = { blocco, campanile };
export const CITY_BLOCKS_META: Record<string, PropMeta> = {
  blocco: { w: 8, d: 7.75, h: 220 },
  campanile: { w: 8, d: 11, h: 190 },
};

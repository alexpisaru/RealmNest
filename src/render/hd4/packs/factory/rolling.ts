// Factory — rolling stock at true scale (1 z ≈ 10 cm; a tile ≈ 1.6 m ≈ 16 z; a person is 17.5 z).
//   fac_wagon   bogie freight wagons standing on the wharf siding:
//               'van' (a planked bauxite van) · 'open' (a ribbed coal wagon) · 'coil' (a flat with steel coils)
//               · 'tank' (a black fuel-oil tank) · 'loco' / 'loco-rev' (a Bo-Bo shunter, nose to +a / to −a)
//   fac_train   the trip working on the spur: a shunter at each end (top and tail), so whichever way it
//               runs a cab leads, nose first; between them a van, a coil flat, a coal wagon and a tank
//
// Every car is built the same way: two bogies (two axles each, wheels 0.83 m across sitting on the
// rails, axleboxes, side frames and spring nests), a solebar with the headstocks, buffers and screw
// couplings at both ends, then the body. The rails of fac_rail lie at b = d/2 ∓ 0.32: the near
// wheels ride the near rail, the far wheels the far one.
import { darken, mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { fillPoly, hash, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { footShadow, lbox } from '../util';
import { planeText } from './font';
import { at, BLUE, IRON, RUST, STEEL, YELLOW } from './palette';

type V3 = [number, number, number];
/** z units per tile */
const T = 16;
const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const poly = (p: PropPainter, pts: V3[], col: string) => fillPoly(p.c, pts.map(([a, b, z]) => p.P(a, b, z)), col);
const line3 = (p: PropPainter, A: V3, B: V3, col: string, w = 1) => {
  const [x0, y0] = p.P(...A);
  const [x1, y1] = p.P(...B);
  ln(p.c, x0, y0, x1, y1, col, w);
};
/** A circle in the a–z plane at depth b (a wheel, a coil's face): centre (a, z), radius r tiles. */
const ringA = (a: number, b: number, z: number, r: number, n = 26): V3[] => Array.from({ length: n }, (_, i) => [a + r * Math.cos((i / n) * Math.PI * 2), b, z + r * T * Math.sin((i / n) * Math.PI * 2)]);
/** A circle in the b–z plane at a (a buffer head, a barrel's end). */
const ringB = (a: number, b: number, z: number, r: number, n = 26): V3[] => Array.from({ length: n }, (_, i) => [a, b + r * Math.cos((i / n) * Math.PI * 2), z + r * T * Math.sin((i / n) * Math.PI * 2)]);

const hazardTex = (light: number) => (u: number, v: number) => (Math.floor((u + v) / 8) & 1 ? (light ? '#2a2a30' : '#1e1e24') : light ? '#f4c834' : '#c8a024');

/**
 * A cylinder lying along a (a tank barrel, a buffer): strips round its axis, shaded by their normal,
 * only the half facing the viewer drawn; its +a end is left to the caller. `paint` may recolour a strip.
 */
function cylA(p: PropPainter, a0: number, a1: number, bc: number, zc: number, r: number, R: Ramp, paint?: (th: number) => string | null, n = 28) {
  const strips: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    const depth = Math.cos(tm) + Math.sin(tm);
    if (depth > -0.2) strips.push([depth, t0, t1]);
  }
  strips.sort((m, o) => m[0] - o[0]);
  const mid = (R.length - 1) / 2;
  for (const [, t0, t1] of strips) {
    const tm = (t0 + t1) / 2;
    const s = Math.sin(tm);
    const c = Math.cos(tm);
    // the sky lights the crown, the front catches the sun, the underside falls dark; a glint near the top
    let i = mid + 1.9 * s + 0.5 * c - (s < -0.3 ? 0.8 : 0);
    if (Math.abs(tm - 1.25) < 0.16) i += 1.6;
    const col = paint?.(tm) ?? at(R, i);
    poly(p, [[a0, bc + r * Math.cos(t0), zc + r * T * Math.sin(t0)], [a1, bc + r * Math.cos(t0), zc + r * T * Math.sin(t0)], [a1, bc + r * Math.cos(t1), zc + r * T * Math.sin(t1)], [a0, bc + r * Math.cos(t1), zc + r * T * Math.sin(t1)]], col);
  }
}

/** A cylinder lying along b (a steel coil): the same, its +b face left to the caller. */
function cylB(p: PropPainter, ac: number, b0: number, b1: number, zc: number, r: number, R: Ramp, n = 28) {
  const strips: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    const depth = Math.cos(tm) + Math.sin(tm);
    if (depth > -0.2) strips.push([depth, t0, t1]);
  }
  strips.sort((m, o) => m[0] - o[0]);
  const mid = (R.length - 1) / 2;
  for (const [, t0, t1] of strips) {
    const tm = (t0 + t1) / 2;
    let i = mid + 1.9 * Math.sin(tm) - 0.9 * Math.cos(tm);
    if (Math.abs(tm - 1.9) < 0.16) i += 1.4;
    poly(p, [[ac + r * Math.cos(t0), b0, zc + r * T * Math.sin(t0)], [ac + r * Math.cos(t0), b1, zc + r * T * Math.sin(t0)], [ac + r * Math.cos(t1), b1, zc + r * T * Math.sin(t1)], [ac + r * Math.cos(t1), b0, zc + r * T * Math.sin(t1)]], at(R, i));
  }
}

// ── the running gear ────────────────────────────────────────
/** A wheel on its rail, seen side-on from +b: flange and tread, a rusty disc web lit at the top left, the hub. */
function wheel(p: PropPainter, a: number, b: number, r: number, far: boolean) {
  const z = r * T;
  const c = (col: string) => (far ? darken(col, 0.4) : col);
  poly(p, ringA(a, b, z, r), c('#141218'));
  poly(p, ringA(a, b + 0.01, z, r * 0.92), c('#2e2a30'));
  poly(p, ringA(a, b + 0.02, z, r * 0.8), c('#4c403c'));
  poly(p, ringA(a - r * 0.07, b + 0.02, z + r * T * 0.07, r * 0.66), c('#66544a'));
  poly(p, ringA(a + r * 0.03, b + 0.02, z - r * T * 0.03, r * 0.64), c('#463a38'));
  poly(p, ringA(a, b + 0.03, z, r * 0.3), c('#6e666c'));
  poly(p, ringA(a - r * 0.06, b + 0.03, z + r * T * 0.06, r * 0.15), c('#a8a0a6'));
  if (far) return;
  // the tread polished bright where it rides the rail, a rust bloom on the web
  const [x0, y0] = p.P(a - r * 0.45, b + 0.01, z - r * T * 0.82);
  px(p.c, x0, y0, '#b8b4b8', 6, 1);
  const [x1, y1] = p.P(a + r * 0.35, b + 0.02, z - r * T * 0.25);
  px(p.c, x1, y1, RUST[3], 2, 2);
}

interface Gear {
  /** wheel radius (tiles) */
  r: number;
  /** half the bogie's wheelbase */
  e: number;
  /** the bogies' centres along a */
  at: number[];
}

/** The far wheels and frames, the bolsters (drawn before the body and the near gear). */
function gearFar(p: PropPainter, D: number, g: Gear) {
  const rb0 = D / 2 - 0.32;
  const rb1 = D / 2 + 0.32;
  const zc = g.r * T;
  // rail contact shadows
  for (const ac of g.at)
    for (const s of [-1, 1]) {
      const [x, y] = p.P(ac + s * g.e, rb1, 0);
      px(p.c, x - 6, y - 1, '#1a1418', 12, 2);
    }
  for (const ac of g.at) {
    for (const s of [-1, 1]) wheel(p, ac + s * g.e, rb0, g.r, true);
    lbox(p, ac - g.e - 0.16, rb0 - 0.09, 2 * g.e + 0.32, 0.05, zc + 0.6, 2, mono(flat(IRON, 1, 1, 2), IRON[0]));
    // the bolster across the bogie and the brake rigging between the frames
    lbox(p, ac - 0.13, rb0 - 0.04, 0.26, rb1 - rb0 + 0.08, zc + 0.4, 2.8, mono(flat(IRON, 2, 1, 3), IRON[0]));
    lbox(p, ac - g.e + 0.12, rb0 + 0.06, 2 * g.e - 0.24, rb1 - rb0 - 0.12, zc - 0.6, 1, mono(flat(IRON, 1, 0, 2), IRON[0]));
  }
}

/** The near wheels on the near rail, the bogies' side frames with axleboxes and spring nests. */
function gearNear(p: PropPainter, D: number, g: Gear, frame: Ramp = IRON) {
  const rb1 = D / 2 + 0.32;
  const zc = g.r * T;
  for (const ac of g.at) {
    for (const s of [-1, 1]) wheel(p, ac + s * g.e, rb1, g.r, false);
    const fb = rb1 + 0.05;
    // the side frame: a deep beam over the axles, dipping between them to the spring nest
    lbox(p, ac - g.e - 0.2, fb, 2 * g.e + 0.4, 0.05, zc + 1.8, 1.2, mono(flat(frame, 3, 2, 4), frame[0]));
    lbox(p, ac - 0.18, fb, 0.36, 0.05, zc - 1.5, 3.3, mono(flat(frame, 2, 1, 3), frame[0]));
    // the spring nest: two coil springs in the window of the frame
    for (const ds of [-0.1, 0.1]) {
      const F = front(p, fb + 0.051);
      for (let z = zc - 1.1; z < zc + 1.6; z += 0.55) pq(p, F, ac + ds - 0.06, ac + ds + 0.06, z, z + 0.3, '#9a9aa2');
    }
    // axleboxes over the hubs, their yellow end caps, the frame's lit top edge
    for (const s of [-1, 1]) {
      const a = ac + s * g.e;
      lbox(p, a - 0.065, fb - 0.01, 0.13, 0.08, zc - 0.9, 1.8, mono(flat(frame, 3, 2, 5), frame[0]));
      poly(p, ringA(a, fb + 0.072, zc, 0.05), '#d8a828');
      poly(p, ringA(a - 0.01, fb + 0.073, zc + 0.15, 0.025), '#f4d060');
    }
    const F = front(p, fb + 0.051);
    pq(p, F, ac - g.e - 0.2, ac + g.e + 0.2, zc + 2.8, zc + 3, at(frame, 5));
  }
}

/** Buffers on their stocks and the screw coupling at one end (a = the headstock face, dir = outward). */
function buffers(p: PropPainter, D: number, a: number, dir: 1 | -1, zb: number, beam?: string) {
  void beam;
  const tip = a + dir * 0.17;
  for (const b of [D / 2 - 0.38, D / 2 + 0.38]) {
    // the stock (a short barrel) and the plunger, then the head: a disc facing outward
    const [s0, s1] = dir > 0 ? [a, tip - 0.04] : [tip + 0.04, a];
    cylA(p, s0, s1, b, zb, 0.07, ['#141418', '#1e1e24', '#2a2a32', '#3a3a44', '#4e4e5a', '#6a6a76'], undefined, 14);
    if (dir > 0) poly(p, ringB(s1, b, zb, 0.07, 14), '#2a2a32');
    const hc = dir > 0 ? '#8a8a94' : '#3a3a42';
    poly(p, ringB(tip, b, zb, 0.115, 18), dir > 0 ? '#4a4a54' : '#26262c');
    poly(p, ringB(tip + dir * 0.005, b - 0.012, zb + 0.2, 0.09, 18), hc);
    if (dir > 0) poly(p, ringB(tip + 0.006, b - 0.04, zb + 0.9, 0.03, 10), '#d8d8e0');
  }
  // the hook and the screw coupling drooping toward the next car
  const [hx, hy] = p.P(a + dir * 0.06, D / 2, zb);
  px(p.c, hx - 2, hy - 3, '#2a2a30', 5, 6);
  const [cx, cy] = p.P(tip + dir * 0.02, D / 2, zb - 1.2);
  ln(p.c, hx, hy + 1, cx, cy, '#3a3a42', 2);
  ln(p.c, hx, hy, cx, cy - 1, '#7a7a84', 1);
}

/** The solebar and headstocks at deck height: a dark steel frame, its number panel, the end beams. */
function solebar(p: PropPainter, W: number, D: number, z0: number, z1: number, end: Mat, num: string) {
  lbox(p, 0.13, SOLE_IN, W - 0.26, D - 2 * SOLE_IN, z0, z1 - z0, {
    front: (light) => (u, v, x, y) => at(IRON, (light ? 3 : 2) + (v > (z1 - z0) * 4 - 2 ? 1.4 : 0) + (u % 26 < 1.2 ? -1 : 0) + (u % 26 > 12 && u % 26 < 14 && v > 4 && v < 8 ? 1.6 : 0) - (hash(x >> 1, y >> 1, 9) < 0.08 ? 0.8 : 0)),
    side: end,
    top: flat(IRON, 3, 2, 3),
    edge: IRON[0],
  });
  const F = front(p, D - SOLE_IN + 0.002);
  pq(p, F, 0.42, 1.18, z0 + 0.7, z1 - 0.7, '#e8e2d0');
  pq(p, F, 0.45, 1.15, z0 + 1, z1 - 1, '#3a3a40');
  planeText(p.c, F, 0.8, (z0 + z1) / 2, num, '#e8e2d0', 1);
}

const plainEnd: Mat = (light) => (u, v) => at(IRON, (light ? 3 : 2) + (v > 7 ? 1 : 0) - (u % 20 < 1 ? 0.6 : 0));
const hazardEnd: Mat = (light) => hazardTex(light);

// ── the wagons ──────────────────────────────────────────────
const DECK = 12;
const SOLE0 = 9.2;
/** the solebar's near face, set back over the wheels so the bogies show under the body */
const SOLE_IN = 0.16;
const WAGON_GEAR = (W: number): Gear => ({ r: 0.28, e: 0.44, at: [0.98, W - 0.98] });

function wagonNumber(seed: number) {
  return String(940000 + Math.floor(hash(seed, 3, 7) * 9999));
}

/** Common under- and end-works of a wagon; the body is drawn between `under` and `ends`. */
function wagonChassis(p: PropPainter, W: number, D: number, seed: number) {
  footShadow(p, 0.15, 0.1, W - 0.15, D - 0.1, 30, 0.36);
  const g = WAGON_GEAR(W);
  // the back end's buffers stand behind everything else
  buffers(p, D, 0.13, -1, 10.6);
  gearFar(p, D, g);
  // brake cylinder and air reservoir hanging between the bogies
  const am = W / 2;
  lbox(p, am - 0.7, D / 2 - 0.3, 1.4, 0.6, 6.4, 2.8, mono(flat(IRON, 1, 0, 2), IRON[0]));
  cylA(p, am - 0.55, am + 0.35, D / 2 + 0.16, 7, 0.13, ['#1a1a20', '#24242c', '#30303a', '#3e3e4a', '#525260', '#6a6a78']);
  poly(p, ringB(am + 0.35, D / 2 + 0.16, 7, 0.13, 16), '#30303a');
  gearNear(p, D, g);
  solebar(p, W, D, SOLE0, DECK, plainEnd, wagonNumber(seed));
  // the brake lever along the solebar, white-tipped
  const [lx0, ly0] = p.P(W / 2 - 0.7, D - SOLE_IN + 0.02, 9);
  const [lx1, ly1] = p.P(W / 2 + 0.2, D - SOLE_IN + 0.02, 7.6);
  ln(p.c, lx0, ly0, lx1, ly1, '#2a2a30', 2);
  px(p.c, lx1 - 1, ly1 - 1, '#f2eee2', 4, 2);
}

/** The front buffers (they stand before the body's +a end) and the grab handles at the corner. */
function wagonEnds(p: PropPainter, W: number, D: number) {
  buffers(p, D, W - 0.13, 1, 10.6);
}

/** A planked bauxite van: steel framing outside, sliding doors, a curved roof, end vents. */
function van(p: PropPainter, W: number, D: number, seed: number) {
  const M: Ramp = ['#3a1612', '#56201a', '#722a20', '#8c3828', '#a64832', '#bc5c40', '#d07656'];
  const a0 = 0.2;
  const a1 = W - 0.2;
  const b0 = 0.03;
  const b1 = D - 0.03;
  const z0 = DECK;
  const z1 = 34.4;
  const H = (z1 - z0) * 4;
  const planksV: Mat = (light) => (u, v, x, y) => {
    const pl = Math.floor(u / 6);
    let i = (light ? 3.1 : 1.9) + (hash(pl, 3, 41 + seed) - 0.5) * 0.9;
    if (u % 6 < 1) i -= 1.5;
    if (v > H - 3) i -= 0.6;
    if (v < 12 && hash(x >> 1, y >> 1, 5) < (12 - v) / 24) i -= 0.9; // road dirt thrown up low
    if (hash(pl, Math.floor(v / 9), 44) < 0.04) i -= 0.7; // a patched plank
    return at(M, i);
  };
  // the end wall's curved top under the roof
  const crown = 4.4;
  const zr = (t: number) => z1 + crown * Math.sin(Math.PI * t);
  const prof = (a: number, t: number): V3 => [a, b0 + (b1 - b0) * t, zr(t)];
  lbox(p, a0, b0, a1 - a0, b1 - b0, z0, z1 - z0, { front: planksV, side: planksV, top: flat(M, 1, 1, 1), edge: M[0] });
  const endTop: V3[] = [];
  for (let i = 0; i <= 10; i++) endTop.push(prof(a1, 1 - i / 10));
  poly(p, [[a1, b1, z1], ...endTop, [a1, b0, z1]], M[2]);
  // the roof: a curved sheet in strips from the far eave to the near one, joints across it, gutters
  const ROOF: Ramp = ['#34343a', '#45454c', '#58585f', '#6c6c73', '#808087', '#96969c', '#aeaeb2', '#c6c6ca'];
  const ra0 = a0 - 0.06;
  const ra1 = a1 + 0.06;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const slope = Math.cos(Math.PI * (t0 + t1) / 2); // > 0 on the far half
    const idx = 5 - Math.max(0, slope) * 2.2 - Math.max(0, -slope) * 1.1 + (i === n / 2 - 1 ? 0.6 : 0);
    const B0 = b0 - 0.04 + (b1 - b0 + 0.08) * t0;
    const B1 = b0 - 0.04 + (b1 - b0 + 0.08) * t1;
    poly(p, [[ra0, B0, zr(t0)], [ra1, B0, zr(t0)], [ra1, B1, zr(t1)], [ra0, B1, zr(t1)]], at(ROOF, idx));
  }
  for (let a = ra0 + 0.5; a < ra1 - 0.2; a += 0.52)
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      line3(p, [a, b0 - 0.04 + (b1 - b0 + 0.08) * t0, zr(t0) + 0.15], [a, b0 - 0.04 + (b1 - b0 + 0.08) * t1, zr(t1) + 0.15], at(ROOF, 2));
    }
  // the near gutter and the roof's end edge, lit
  line3(p, [ra0, b1 + 0.04, z1 - 0.2], [ra1, b1 + 0.04, z1 - 0.2], '#26262c', 2);
  line3(p, [ra0, b1 + 0.04, z1 + 0.3], [ra1, b1 + 0.04, z1 + 0.3], ROOF[6], 1);
  for (let i = 0; i < n; i++) line3(p, [ra1, b0 - 0.04 + (b1 - b0 + 0.08) * (i / n), zr(i / n)], [ra1, b0 - 0.04 + (b1 - b0 + 0.08) * ((i + 1) / n), zr((i + 1) / n)], ROOF[1], 2);
  // the framing on the near side: corner pillars, door posts, panel stanchions, top and bottom rails, braces
  const F = front(p, b1 + 0.001);
  const am = W / 2;
  const posts = [a0, am - 0.72, am + 0.66, a1 - 0.06, (a0 + am - 0.72) / 2, (am + 0.72 + a1) / 2];
  for (const a of posts) lbox(p, a, b1, 0.06, 0.03, z0, z1 - z0, mono(flat(M, 4, 2.4, 5), M[0]));
  lbox(p, a0, b1, a1 - a0, 0.03, z0, 1.2, mono(flat(M, 3.4, 2, 4.6), M[0]));
  lbox(p, a0, b1, a1 - a0, 0.03, z1 - 1.1, 1.1, mono(flat(M, 4, 2.4, 5), M[0]));
  for (const [ua, ub] of [[a0 + 0.06, (a0 + am - 0.72) / 2], [(a0 + am - 0.72) / 2 + 0.06, am - 0.72], [am + 0.72, (am + 0.72 + a1) / 2], [(am + 0.72 + a1) / 2 + 0.06, a1 - 0.06]] as const) {
    const [x0, y0] = p.P(ua, b1 + 0.03, z0 + 1.2);
    const [x1, y1] = p.P(ub, b1 + 0.03, z1 - 1.1);
    ln(p.c, x0, y0 + 1, x1, y1 + 1, M[1], 2);
    ln(p.c, x0, y0, x1, y1, M[5], 2);
  }
  // the sliding doors: two leaves on a top rail, the seam, a handle and the cupboard-latch
  pt(p, F, am - 0.66, am + 0.6, z0 + 1.2, z1 - 1.1, (u: number, v: number, x: number, y: number) => {
    let i = (F.light ? 3.4 : 2) + (u % 6 < 1 ? -1.4 : 0) + (hash(Math.floor(u / 6), 5, 12) - 0.5) * 0.6;
    if (v < 10 && hash(x >> 1, y >> 1, 6) < 0.3) i -= 0.8;
    return at(M, i);
  }, F.light);
  pq(p, F, am - 0.04, am - 0.02, z0 + 1.2, z1 - 1.1, M[0]);
  lbox(p, am - 0.8, b1 + 0.03, 1.56, 0.03, z1 - 1.8, 0.7, mono(flat(IRON, 3, 2, 4), IRON[0]));
  for (const s of [-1, 1]) {
    const [x0, y0] = p.P(am + s * 0.3, b1 + 0.03, z0 + 2.5);
    const [x1, y1] = p.P(am + s * 0.05, b1 + 0.03, z1 - 2.5);
    ln(p.c, x0, y0, x1, y1, M[5], 2);
  }
  pq(p, F, am + 0.06, am + 0.16, z0 + 10, z0 + 11, '#c8c8cc');
  // lettering: the owner's initials, the data panel, a tare plate
  planeText(p.c, F, a0 + 0.62, z1 - 6.5, 'EW', '#efe8d6', 3);
  pq(p, F, a1 - 1.02, a1 - 0.3, z0 + 3, z0 + 8.4, '#2a1612');
  for (let k = 0; k < 3; k++) pq(p, F, a1 - 0.96, a1 - 0.42 - k * 0.1, z0 + 4 + k * 1.5, z0 + 4.6 + k * 1.5, '#e8e2d0');
  // the end: two stanchions, a hooded vent at the top, a grab rail and the end steps
  const S = side(p, a1 + 0.001);
  for (const b of [b0 + 0.32, b1 - 0.32]) lbox(p, a1, b - 0.03, 0.03, 0.06, z0, z1 - z0, mono(flat(M, 3, 1.6, 4), M[0]));
  for (const b of [b0 + 0.2, b1 - 0.36]) {
    lbox(p, a1, b, 0.04, 0.16, z1 - 4.6, 3, mono(flat(M, 3.4, 1.8, 4.4), M[0]));
    pq(p, S, b + 0.02, b + 0.14, z1 - 4.4, z1 - 3.4, '#1a0c0a');
  }
  const [gx0, gy0] = p.P(a1 + 0.03, b1 - 0.1, z0 + 3);
  const [gx1, gy1] = p.P(a1 + 0.03, b1 - 0.1, z0 + 15);
  ln(p.c, gx0, gy0, gx1, gy1, '#e8e2d0', 1);
  // rust weeping from the roof edge
  for (let i = 0; i < 7; i++) {
    const a = a0 + 0.2 + hash(i, 1, seed) * (a1 - a0 - 0.4);
    const [x, y] = F.F(a, z1 - 1.1);
    for (let j = 0; j < 3 + Math.floor(hash(i, 2, seed) * 6); j++) px(p.c, x, y + j * 2, RUST[2 + (j % 2)], 1, 2);
  }
}

/** A steel open wagon: ribbed sides, a capping rim, a drop door, a heap of coal. */
function openWagon(p: PropPainter, W: number, D: number, seed: number) {
  const G: Ramp = ['#2e3034', '#3e4146', '#52565c', '#686c72', '#7e8288', '#969a9e', '#b2b6b8'];
  const a0 = 0.2;
  const a1 = W - 0.2;
  const b0 = 0.03;
  const b1 = D - 0.03;
  const z0 = DECK;
  const z1 = 25;
  const plate: Mat = (light) => (u, v, x, y) => {
    let i = light ? 3.2 : 1.9;
    if (u % 40 < 1) i -= 1;
    const rn = hash(x >> 2, y >> 2, 31 + seed);
    if (rn < 0.07) return at(RUST, light ? 3 : 2);
    if (v < 10 && rn < 0.3) i -= 0.7;
    if (hash(Math.floor(u / 7), Math.floor(v / 5), 33) < 0.05) i += 0.9; // scraped bright
    return at(G, i);
  };
  const COAL: Ramp = ['#0e0d10', '#17161a', '#212026', '#2c2b32', '#3c3b44', '#56545e', '#7a7884'];
  lbox(p, a0, b0, a1 - a0, b1 - b0, z0, z1 - z0, { front: plate, side: plate, top: flat(COAL, 1, 1, 1), edge: G[0] });
  // the inside of the far wall, above the coal at its edges
  poly(p, [[a0 + 0.04, b0 + 0.05, z1], [a1 - 0.04, b0 + 0.05, z1], [a1 - 0.04, b0 + 0.05, z1 - 1.6], [a0 + 0.04, b0 + 0.05, z1 - 1.6]], G[2]);
  // the far and back rims
  lbox(p, a0 - 0.02, b0 - 0.02, a1 - a0 + 0.04, 0.07, z1, 0.8, mono(flat(G, 4, 2.4, 5), G[0]));
  lbox(p, a0 - 0.02, b0 - 0.02, 0.07, b1 - b0 + 0.04, z1, 0.8, mono(flat(G, 4, 2.4, 5), G[0]));
  // the coal: lumps heaped to a ridge, lit on their tops
  const R = rng(seed * 13 + 1);
  const lumps: [number, number, number, number][] = [];
  for (let a = a0 + 0.1; a < a1 - 0.08; a += 0.065)
    for (let b = b0 + 0.08; b < b1 - 0.06; b += 0.075) {
      const fa = (a - (a0 + a1) / 2) / ((a1 - a0) / 2);
      const fb = (b - (b0 + b1) / 2) / ((b1 - b0) / 2);
      const h = 3.4 * (1 - fa ** 6) * (1 - fb * fb) + R() * 0.8 - 0.6;
      lumps.push([a + (R() - 0.5) * 0.04, b + (R() - 0.5) * 0.04, z1 - 0.8 + Math.max(0, h), R()]);
    }
  lumps.sort((m, o) => m[0] + m[1] - (o[0] + o[1]));
  for (const [a, b, z, r] of lumps) {
    const [x, y] = p.P(a, b, z);
    px(p.c, x - 2, y - 1, at(COAL, 1 + r * 1.5), 4, 3);
    px(p.c, x - 2, y - 2, at(COAL, 3 + r * 3), r < 0.5 ? 2 : 3, 1);
  }
  // the near and front rims over the coal
  lbox(p, a0 - 0.02, b1 - 0.05, a1 - a0 + 0.04, 0.07, z1, 0.8, mono(flat(G, 4.4, 2.6, 5.4), G[0]));
  lbox(p, a1 - 0.05, b0 - 0.02, 0.07, b1 - b0 + 0.04, z1, 0.8, mono(flat(G, 4, 2.2, 5), G[0]));
  // outside ribs: pressed steel stanchions, lit on their faces
  const F = front(p, b1 + 0.001);
  for (let a = a0 + 0.02; a < a1; a += (a1 - a0 - 0.06) / 7) lbox(p, a, b1, 0.06, 0.035, z0, z1 - z0, mono(flat(G, 4.4, 2.2, 5.4), G[0]));
  const S = side(p, a1 + 0.001);
  for (const b of [b0 + 0.3, b1 - 0.3]) lbox(p, a1, b - 0.03, 0.035, 0.06, z0, z1 - z0, mono(flat(G, 3.4, 2, 4.4), G[0]));
  void S;
  // the drop door in the middle, its hinges and the cotter-pin lever
  const am = W / 2;
  pq(p, F, am - 0.55, am + 0.55, z0 + 0.8, z1 - 1.4, G[F.light ? 2 : 1]);
  pt(p, F, am - 0.52, am + 0.52, z0 + 1.1, z1 - 1.7, plate, F.light);
  for (const a of [am - 0.4, am, am + 0.4]) pq(p, F, a - 0.03, a + 0.03, z0 + 0.8, z0 + 2.2, IRON[1]);
  pq(p, F, am + 0.36, am + 0.5, z1 - 4, z1 - 3.2, '#e8d070');
  // lettering, a data panel, rust streaks from the rim
  planeText(p.c, F, a0 + 0.62, z1 - 5, 'NCB', '#efe8d6', 2);
  pq(p, F, a1 - 0.9, a1 - 0.32, z0 + 2.4, z0 + 6.4, '#26282c');
  for (let k = 0; k < 3; k++) pq(p, F, a1 - 0.86, a1 - 0.42 - k * 0.08, z0 + 3 + k * 1.2, z0 + 3.5 + k * 1.2, '#e8e2d0');
  for (let i = 0; i < 9; i++) {
    const a = a0 + 0.15 + hash(i, 4, seed) * (a1 - a0 - 0.3);
    const [x, y] = F.F(a, z1 - 0.2);
    for (let j = 0; j < 2 + Math.floor(hash(i, 5, seed) * 7); j++) px(p.c, x, y + j * 2, RUST[2 + (j % 3 === 0 ? 1 : 0)], 1, 2);
  }
}

/** A flat wagon with three steel coils, eye to the side, in timber cradles, strapped and chained. */
function coilWagon(p: PropPainter, W: number, D: number, seed: number) {
  const a0 = 0.18;
  const a1 = W - 0.18;
  const z0 = DECK;
  const z1 = DECK + 1.4;
  const DK: Ramp = ['#2e2018', '#46301e', '#5e4228', '#7a5834', '#946e42', '#ae8852'];
  lbox(p, a0, 0.03, a1 - a0, D - 0.06, z0, z1 - z0, {
    front: (light) => (u) => at(IRON, (light ? 3.4 : 2) - (u % 22 < 1 ? 1 : 0)),
    side: flat(IRON, 2.4, 1.6),
    top: (light) => (u, v, x, y) => at(DK, (light === 2 ? 3.6 : 3) + ((v % 7) < 1 ? -1.4 : 0) + (hash(Math.floor(v / 7), Math.floor(u / 40), 7) - 0.5) * 0.9 - (hash(x >> 1, y >> 1, 8) < 0.06 ? 1 : 0)),
    edge: IRON[0],
  });
  // stanchion pockets and posts along both edges (far ones first)
  const posts = (b: number) => {
    for (let a = a0 + 0.15; a < a1 - 0.1; a += (a1 - a0 - 0.3) / 5) lbox(p, a, b, 0.05, 0.05, z1, 4.6, mono(flat(IRON, 3.4, 2, 4.4), IRON[0]));
  };
  posts(0.05);
  const STEELC: Ramp = ['#2a3036', '#3c444c', '#525c66', '#6a7680', '#86929c', '#a4b0b8', '#c4ced4', '#e0e8ec'];
  const r = 0.36;
  const zc = z1 + 0.6 + r * T;
  const cb0 = 0.16;
  const cb1 = D - 0.16;
  for (const am of [W * 0.2 + 0.1, W / 2, W * 0.8 - 0.1]) {
    // the cradle: two timber chocks along b
    for (const s of [-1, 1]) lbox(p, am + s * 0.26 - 0.07, cb0 - 0.04, 0.14, cb1 - cb0 + 0.08, z1, 2.2, mono(flat(DK, 3.6, 2.4, 4.4), DK[0]));
    cylB(p, am, cb0, cb1, zc, r, STEELC);
    // the face: wound strip in rings, the eye, two straps through it
    const face = ringA(am, cb1, zc, r);
    poly(p, face, STEELC[4]);
    for (let k = 0; k < 6; k++) poly(p, ringA(am, cb1 + 0.001, zc, r * (0.92 - k * 0.1)), k % 2 ? STEELC[4] : STEELC[5]);
    poly(p, ringA(am, cb1 + 0.002, zc, r * 0.34), '#14161a');
    poly(p, ringA(am + r * 0.06, cb1 + 0.002, zc - r * T * 0.06, r * 0.26), '#3a4048');
    poly(p, ringA(am - r * 0.04, cb1 + 0.002, zc + r * T * 0.04, r * 0.24), '#101216');
    for (const ang of [Math.PI / 2, -Math.PI / 2]) {
      const [x0, y0] = p.P(am + Math.cos(ang) * r * 0.34, cb1 + 0.003, zc + Math.sin(ang) * r * 0.34 * T);
      const [x1, y1] = p.P(am + Math.cos(ang) * r, cb1 + 0.003, zc + Math.sin(ang) * r * T);
      ln(p.c, x0, y0, x1, y1, '#24486e', 2);
    }
    line3(p, [am, cb1, zc + r * T], [am, cb0 + 0.06, zc + r * T], '#24486e', 2);
    // the chain from the coil's top down to the deck's near edge, a tensioner on it
    const [tx, ty] = p.P(am - 0.12, cb1 - 0.15, zc + r * T * 0.9);
    const [bx, by] = p.P(am - 0.24, D - 0.04, z1);
    for (let t = 0; t <= 1; t += 0.08) px(p.c, tx + (bx - tx) * t, ty + (by - ty) * t, t * 12 % 2 < 1 ? '#8a8a92' : '#4a4a52', 2, 2);
    px(p.c, tx + (bx - tx) * 0.6 - 2, ty + (by - ty) * 0.6 - 2, '#d8a828', 4, 3);
  }
  posts(D - 0.1);
  const F = front(p, D - 0.03 + 0.002);
  planeText(p.c, F, a1 - 0.7, (z0 + z1) / 2 + 0.2, 'BOGIE COIL', '#e8e2d0', 1);
  void seed;
}

/** A fuel-oil tank wagon: a black barrel on saddles, an orange band, a dome, a ladder and platform. */
function tankWagon(p: PropPainter, W: number, D: number, seed: number) {
  const K: Ramp = ['#0c0c10', '#141419', '#1c1c23', '#25252e', '#30303b', '#3e3e4b', '#54546a', '#8a8aa0'];
  const r = 0.52;
  const zc = DECK + 0.9 + r * T;
  const bc = D / 2;
  const a0 = 0.34;
  const a1 = W - 0.34;
  // the saddles and the underframe walkway
  for (const a of [1.05, W - 1.05]) lbox(p, a - 0.16, bc - 0.42, 0.32, 0.84, DECK, 2.6, mono(flat(IRON, 2.4, 1.4, 3.4), IRON[0]));
  lbox(p, 0.2, 0.06, W - 0.4, D - 0.12, DECK, 0.5, mono(flat(IRON, 2.8, 1.8, 3.4), IRON[0]));
  // the barrel, its orange flammable-load band just above the waist
  cylA(p, a0, a1, bc, zc, r, K, (th) => (th > 0.18 && th < 0.42 ? (Math.abs(th - 1.25) < 0.16 ? '#f8a050' : th > 0.38 ? '#a84a14' : '#e07020') : null), 34);
  // hoops round the barrel
  for (const a of [a0 + 0.08, W / 2 - 1.05, W / 2 + 1.05, a1 - 0.12]) cylA(p, a, a + 0.04, bc, zc, r + 0.006, ['#08080a', '#0c0c10', '#121218', '#1a1a22', '#24242e', '#34343e', '#4a4a58']);
  // the dished end
  poly(p, ringB(a1, bc, zc, r, 32), K[3]);
  poly(p, ringB(a1 + 0.02, bc - 0.03, zc + 0.5, r * 0.86, 32), K[4]);
  poly(p, ringB(a1 + 0.03, bc - 0.08, zc + 2.2, r * 0.42, 24), K[5]);
  poly(p, ringB(a1 + 0.035, bc - 0.12, zc + 3.8, r * 0.14, 14), K[6]);
  // the platform round the dome: grating, then the dome, then the handrails
  const am = W / 2;
  const zt = zc + r * T;
  lbox(p, am - 0.4, bc - 0.36, 0.8, 0.72, zt - 0.6, 0.6, mono((light) => (u, v) => ((u + v) % 4 < 1.5 ? at(IRON, light ? 4 : 2) : at(IRON, 1)), IRON[0]));
  {
    const [x, y] = p.P(am, bc, zt);
    const [xt, yt] = p.P(am, bc, zt + 3.4);
    const rx = 0.22 * 90.5;
    const ry = 0.22 * 45.25;
    px(p.c, x - rx, yt, K[3], rx * 0.7, y - yt);
    px(p.c, x - rx * 0.3, yt, K[2], rx * 1.3, y - yt);
    px(p.c, x - rx * 0.75, yt, K[5], 3, y - yt);
    fillPoly(p.c, Array.from({ length: 20 }, (_, i) => [x + rx * Math.cos((i / 20) * Math.PI * 2), y + ry * Math.sin((i / 20) * Math.PI * 2)] as [number, number]).filter((q) => q[1] >= y - 0.01), K[2]);
    fillPoly(p.c, Array.from({ length: 24 }, (_, i) => [xt + rx * Math.cos((i / 24) * Math.PI * 2), yt + ry * Math.sin((i / 24) * Math.PI * 2)] as [number, number]), K[5]);
    fillPoly(p.c, Array.from({ length: 20 }, (_, i) => [xt - 2 + rx * 0.62 * Math.cos((i / 20) * Math.PI * 2), yt - 1 + ry * 0.62 * Math.sin((i / 20) * Math.PI * 2)] as [number, number]), K[6]);
    px(p.c, xt - 3, yt - 3, '#b8b8c8', 5, 2);
  }
  // handrails: posts at the platform's corners, a top rail, then the side ladder down to the solebar
  const rail = '#d8d4c8';
  const hr = 5.5;
  for (const [a, b] of [[am - 0.38, bc - 0.34], [am + 0.38, bc - 0.34], [am - 0.38, bc + 0.34], [am + 0.38, bc + 0.34]] as const) line3(p, [a, b, zt], [a, b, zt + hr], rail);
  for (const b of [bc - 0.34, bc + 0.34]) line3(p, [am - 0.38, b, zt + hr], [am + 0.38, b, zt + hr], rail);
  for (const a of [am - 0.38, am + 0.38]) line3(p, [a, bc - 0.34, zt + hr], [a, bc + 0.34, zt + hr], rail);
  const lb = bc + r + 0.05;
  for (const a of [am - 0.32, am - 0.14]) {
    line3(p, [a, lb, DECK - 1.5], [a, lb, zt + 1], rail);
    line3(p, [a, lb, zt + 1], [a, bc + 0.34, zt], rail);
  }
  for (let z = DECK; z < zt; z += 2.2) line3(p, [am - 0.32, lb, z], [am - 0.14, lb, z], '#a8a49a');
  // the hazard placard (UN number and diamond), the load in white
  const F = front(p, bc + r + 0.01);
  pq(p, F, a1 - 1.25, a1 - 0.45, zc - 2.8, zc + 2.8, '#f2eee2');
  pq(p, F, a1 - 1.22, a1 - 0.48, zc - 2.5, zc + 2.5, '#e8742a');
  planeText(p.c, F, a1 - 0.85, zc + 1.2, '30', '#1e1e22', 1);
  planeText(p.c, F, a1 - 0.85, zc - 1.2, '1202', '#1e1e22', 1);
  const [hx, hy] = F.F(a1 - 1.55, zc);
  fillPoly(p.c, [[hx, hy - 10], [hx + 10, hy], [hx, hy + 10], [hx - 10, hy]], '#f2eee2');
  fillPoly(p.c, [[hx, hy - 8], [hx + 8, hy], [hx, hy + 8], [hx - 8, hy]], '#d83a22');
  planeText(p.c, F, a0 + 1.1, zc + 4.6, 'FUEL OIL', '#efe8d6', 1);
  // drips of oil down the barrel under the dome
  for (let i = 0; i < 6; i++) {
    const a = am - 0.4 + hash(i, 6, seed) * 0.8;
    const [x, y] = F.F(a, zc + 6);
    for (let j = 0; j < 4 + Math.floor(hash(i, 7, seed) * 6); j++) px(p.c, x, y + j * 2, j % 3 ? '#0a0a0c' : '#3a3a48', 1, 2);
  }
}

// ── the shunter ─────────────────────────────────────────────
/** A Bo-Bo diesel shunter: long hood, cab, short nose; dir 1 has the nose at +a, −1 at a = 0. */
function loco(p: PropPainter, W: number, D: number, seed: number, dir: 1 | -1) {
  const B: Ramp = [BLUE[0], BLUE[1], BLUE[2], BLUE[3], BLUE[4], BLUE[5], '#9ab4e8'];
  const Y = YELLOW;
  const ROOF: Ramp = ['#26262c', '#34343c', '#44444e', '#56565f', '#6a6a74', '#80808a'];
  /** nose-forward position s → a */
  const A = (s: number) => (dir > 0 ? s : W - s);
  const box = (s0: number, s1: number, b0: number, d: number, z0: number, h: number, m: Parameters<typeof lbox>[7]) => lbox(p, Math.min(A(s0), A(s1)), b0, Math.abs(A(s1) - A(s0)), d, z0, h, m);
  footShadow(p, 0.15, 0.1, W - 0.15, D - 0.1, 34, 0.38);
  const g: Gear = { r: 0.29, e: 0.45, at: [1.08, W - 1.08] };
  buffers(p, D, 0.13, -1, 10.6);
  gearFar(p, D, g);
  // fuel tank and battery boxes between the bogies
  lbox(p, W / 2 - 0.62, 0.22, 1.24, D - 0.44, 5.4, 3.8, { front: (light) => (u, v) => at(IRON, (light ? 2.6 : 1.6) + (v > 9 ? 1 : 0) - (u % 18 < 1 ? 0.8 : 0)), side: flat(IRON, 1.6, 1), top: flat(IRON, 2, 1, 2), edge: IRON[0] });
  gearNear(p, D, g, ['#141418', '#1e1e24', '#2a2a32', '#383842', '#4a4a56', '#646474']);
  // the running plate: black with a lit edge; the buffer beams in wasp stripes
  const plateZ0 = 9.6;
  const plateZ1 = 12.2;
  lbox(p, 0.13, 0.03, W - 0.26, D - 0.06, plateZ0, plateZ1 - plateZ0, {
    front: (light) => (u, v) => (v > (plateZ1 - plateZ0) * 4 - 2 ? '#e8d070' : at(IRON, (light ? 2.6 : 1.6) + (u % 30 < 1 ? -0.8 : 0))),
    side: hazardEnd,
    top: flat(IRON, 3, 2, 3),
    edge: IRON[0],
  });
  // steps at both ends of the near side
  for (const s of [0.24, W - 0.24]) {
    const a = A(s);
    for (const z of [3.4, 6.4]) lbox(p, a - 0.12, D - 0.06, 0.24, 0.06, z, 0.5, mono(flat(STEEL, 4, 3, 5), STEEL[0]));
    line3(p, [a - 0.12, D - 0.03, 3.4], [a - 0.12, D - 0.03, plateZ0], STEEL[3]);
    line3(p, [a + 0.12, D - 0.03, 3.4], [a + 0.12, D - 0.03, plateZ0], STEEL[3]);
  }
  const body: Mat = (light, _w, h) => (u, v, x, y) => {
    let i = light === 2 ? 4.4 : light ? 3.2 : 1.9;
    if (u % 30 < 1) i -= 1; // panel joints
    if (v > h - 1.5) i += 0.9;
    if (v < 6 && hash(x >> 1, y >> 1, 4) < 0.25) i -= 0.7; // grime low down
    return at(B, i);
  };
  const roofM: Mat = (light) => (u, v, x, y) => at(ROOF, (light === 2 ? 3.4 : light ? 2.6 : 1.8) + (hash(x >> 1, y >> 1, 3) < 0.08 ? -1 : 0) + (u % 34 < 1 ? -0.8 : 0) + (v < 2 ? 0 : 0));
  const yellowEnd: Mat = (light, _w, h) => (u, v) => at(Y, (light ? 3.6 : 2.6) + (v > h - 1.5 ? 0.8 : 0) - (u % 40 < 1 ? 0.6 : 0));
  // segments in nose-forward order, drawn from the far end (a = 0) to the near one
  const cab0 = W - 1.85;
  const cab1 = W - 0.95;
  const hoodTop = 29;
  const cabTop = 37.6;
  const noseTop = 24;
  const hood = () => {
    box(0.3, cab0, 0.2, D - 0.4, plateZ1, hoodTop - plateZ1, { front: body, side: dir > 0 ? body : yellowEnd, top: roofM, edge: B[0] });
    const F = front(p, D - 0.2 + 0.001);
    // engine-room doors with louvres, their handles; the radiator grille at the hood's far end
    const s0 = 0.3;
    for (let s = s0 + 0.12; s < cab0 - 0.4; s += 0.58) {
      const u0 = Math.min(A(s), A(s + 0.48));
      const u1 = Math.max(A(s), A(s + 0.48));
      pq(p, F, u0, u0 + 0.02, plateZ1 + 1.4, hoodTop - 1.6, B[1]);
      pq(p, F, u1 - 0.02, u1, plateZ1 + 1.4, hoodTop - 1.6, B[1]);
      for (let z = hoodTop - 6; z < hoodTop - 2; z += 1) pq(p, F, u0 + 0.06, u1 - 0.06, z, z + 0.45, B[1]);
      pq(p, F, (u0 + u1) / 2 - 0.03, (u0 + u1) / 2 + 0.03, plateZ1 + 7, plateZ1 + 8.4, '#c8c8cc');
    }
    const g0 = Math.min(A(s0 + 0.06), A(s0 + 0.6));
    pq(p, F, g0, g0 + 0.54, plateZ1 + 2, hoodTop - 2, '#1a1e26');
    for (let z = plateZ1 + 2.6; z < hoodTop - 2.4; z += 1.1) pq(p, F, g0 + 0.04, g0 + 0.5, z, z + 0.4, '#5a6270');
    // on the hood's roof: the radiator fan and the exhaust stack near the cab
    const [fx, fy] = p.P(A(s0 + 0.55), D / 2, hoodTop);
    fillPoly(p.c, Array.from({ length: 20 }, (_, i) => [fx + 15 * Math.cos((i / 20) * Math.PI * 2), fy + 7.5 * Math.sin((i / 20) * Math.PI * 2)] as [number, number]), '#1a1a20');
    for (let k = 0; k < 4; k++) ln(p.c, fx - 13 + k * 8, fy - 3, fx - 9 + k * 8, fy + 3, '#5a5a64');
    const ex = A(cab0 - 0.45);
    lbox(p, ex - 0.08, D / 2 - 0.08, 0.16, 0.16, hoodTop, 3.2, mono(flat(IRON, 2.4, 1.4, 1), IRON[0]));
    const [sx, sy] = p.P(ex, D / 2, hoodTop + 3.2);
    px(p.c, sx - 4, sy - 2, '#141214', 8, 3);
    // the hood's end when it faces the viewer: grille, tail and head lamps
    if (dir < 0) {
      const S = side(p, A(0.3) + 0.001);
      pq(p, S, 0.36, D - 0.36, plateZ1 + 6, hoodTop - 3, '#1a1e26');
      for (let z = plateZ1 + 6.6; z < hoodTop - 3.4; z += 1.1) pq(p, S, 0.4, D - 0.4, z, z + 0.4, '#5a6270');
      for (const b of [0.34, D - 0.34]) {
        const [lx, ly] = S.F(b, plateZ1 + 3);
        px(p.c, lx - 3, ly - 3, '#2a1414', 6, 5);
        px(p.c, lx - 2, ly - 2, '#e8402a', 4, 3);
        px(p.c, lx - 2, ly - 2, '#ffb0a0', 1, 1);
      }
    }
  };
  const cab = () => {
    box(cab0, cab1, 0.05, D - 0.1, plateZ1, cabTop - plateZ1, { front: body, side: body, top: roofM, edge: B[0] });
    // the roof: overhanging, curved down at the eaves
    box(cab0 - 0.05, cab1 + 0.05, 0.01, D - 0.02, cabTop, 1.1, { front: flat(ROOF, 3, 2, 4), side: flat(ROOF, 2, 1, 3), top: flat(ROOF, 4, 3, 4.4), edge: ROOF[0] });
    const F = front(p, D - 0.05 + 0.002);
    const u0 = Math.min(A(cab0), A(cab1));
    const u1 = Math.max(A(cab0), A(cab1));
    // the door (on the hood side of the cab) and the side window by it, frames, handrails, the number
    const dA = dir > 0 ? u0 + 0.06 : u1 - 0.44;
    const wA = dir > 0 ? u0 + 0.54 : u0 + 0.06;
    pq(p, F, dA, dA + 0.38, plateZ1 + 0.4, cabTop - 2, B[1]);
    pq(p, F, dA + 0.02, dA + 0.36, plateZ1 + 0.6, cabTop - 2.2, B[3]);
    for (const [g0, g1] of [[dA + 0.05, dA + 0.33], [wA, wA + 0.3]] as const) {
      pq(p, F, g0 - 0.02, g1 + 0.02, 27.2, cabTop - 2.6, '#1e2228');
      pt(p, F, g0, g1, 27.6, cabTop - 3, (u: number, v: number) => ((u * 0.7 + v) % 26 < 4 ? '#c8dce4' : v > 18 ? '#5a7a8c' : '#3a5262'), F.light);
    }
    pq(p, F, dA + 0.3, dA + 0.34, plateZ1 + 9, plateZ1 + 10, '#d8d8dc');
    for (const a of [dA - 0.03, dA + 0.41]) line3(p, [a, D - 0.03, plateZ1 + 2], [a, D - 0.03, cabTop - 4], '#e8d070');
    planeText(p.c, F, wA + 0.15, 23.8, dir > 0 ? 'D2471' : 'D2468', '#efe8d6', 1);
    // the visible end of the cab: the windscreen over the nose, or the rear windows over the hood
    const S = side(p, u1 + 0.002);
    const zLow = dir > 0 ? noseTop + 1.4 : hoodTop + 0.8;
    for (const [b0, b1] of [[0.14, D / 2 - 0.05], [D / 2 + 0.05, D - 0.14]] as const) {
      pq(p, S, b0 - 0.02, b1 + 0.02, zLow, cabTop - 2.4, '#1e2228');
      pt(p, S, b0, b1, zLow + 0.4, cabTop - 2.8, (u: number, v: number) => ((u * 0.6 + v) % 22 < 4 ? '#b8ccd4' : v > 14 ? '#4c6a7a' : '#2e4452'), S.light);
    }
    if (dir > 0) {
      // wipers, a yellow band under the windscreen
      for (const b of [D / 2 - 0.25, D / 2 + 0.3]) {
        const [x0, y0] = S.F(b, zLow + 0.8);
        ln(p.c, x0, y0, x0 + 6, y0 - 12, '#141418', 1);
      }
      pq(p, S, 0.05, D - 0.05, noseTop, zLow, Y[3]);
    }
    // roof furniture: the beacon, twin horns, an aerial
    const [bx, by] = p.P(A(cab0 + 0.45), D / 2, cabTop + 1.1);
    px(p.c, bx - 3, by - 6, '#8a4a10', 6, 6);
    px(p.c, bx - 3, by - 6, '#f0902a', 5, 5);
    px(p.c, bx - 2, by - 6, '#ffd890', 2, 2);
    const [hx, hy] = p.P(A(cab1 - 0.12), D / 2 - 0.25, cabTop + 1.1);
    px(p.c, hx - 4, hy - 4, '#3a3a42', 8, 3);
    px(p.c, hx - 4, hy - 4, '#8a8a94', 8, 1);
    const [ax, ay] = p.P(A(cab0 + 0.15), D / 2 + 0.3, cabTop + 1.1);
    px(p.c, ax, ay - 14, '#2a2a30', 1, 14);
  };
  const nose = () => {
    box(cab1, W - 0.16, 0.24, D - 0.48, plateZ1, noseTop - plateZ1, { front: body, side: dir > 0 ? yellowEnd : body, top: roofM, edge: B[0] });
    const F = front(p, D - 0.24 + 0.001);
    const u0 = Math.min(A(cab1), A(W - 0.16));
    // a sand box hatch and a louvred door on the nose
    pq(p, F, u0 + 0.12, u0 + 0.62, plateZ1 + 1.4, noseTop - 1.6, B[2]);
    for (let z = noseTop - 5; z < noseTop - 2; z += 1) pq(p, F, u0 + 0.16, u0 + 0.58, z, z + 0.45, B[1]);
    if (dir > 0) {
      // the nose end facing the viewer: headlamps, marker lamps, the number
      const S = side(p, A(W - 0.16) + 0.002);
      for (const b of [0.4, D - 0.4]) {
        const [lx, ly] = S.F(b, plateZ1 + 4);
        px(p.c, lx - 4, ly - 4, '#2a2a30', 8, 7);
        px(p.c, lx - 3, ly - 3, '#fff6d0', 6, 5);
        px(p.c, lx - 3, ly - 3, '#ffffff', 2, 2);
      }
      const [mx, my] = S.F(D / 2, noseTop - 2);
      px(p.c, mx - 3, my - 3, '#2a2a30', 6, 5);
      px(p.c, mx - 2, my - 2, '#fff6d0', 4, 3);
      planeText(p.c, S, D / 2, plateZ1 + 7.4, '71', '#1e1e22', 1);
    }
  };
  // handrails along the running plate, on the near side of the hood and round the nose
  const rails = () => {
    const rb = D - 0.07;
    const z = plateZ1 + 8.6;
    const rs0 = 0.4;
    const rs1 = cab0 - 0.08;
    for (let s = rs0; s <= rs1 + 0.01; s += (rs1 - rs0) / 5) line3(p, [A(s), rb, plateZ1], [A(s), rb, z], '#e8d070');
    line3(p, [A(rs0), rb, z], [A(rs1), rb, z], '#e8d070');
    line3(p, [A(rs0), rb, z + 0.4], [A(rs1), rb, z + 0.4], '#fff0a8');
    const ns0 = cab1 + 0.08;
    const ns1 = W - 0.22;
    for (const s of [ns0, (ns0 + ns1) / 2, ns1]) line3(p, [A(s), rb, plateZ1], [A(s), rb, z], '#e8d070');
    line3(p, [A(ns0), rb, z], [A(ns1), rb, z], '#e8d070');
  };
  if (dir > 0) {
    hood();
    cab();
    nose();
  } else {
    nose();
    cab();
    hood();
  }
  rails();
  buffers(p, D, W - 0.13, 1, 10.6);
  void seed;
  void mix;
}

const WAGON_DRAW: Record<string, (p: PropPainter, W: number, D: number, seed: number) => void> = { van, open: openWagon, coil: coilWagon, tank: tankWagon };

const fac_wagon: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const v = k.variant ?? 'van';
    if (v === 'loco' || v === 'loco-rev') {
      loco(p, W, D, k.seed, v === 'loco' ? 1 : -1);
      return;
    }
    wagonChassis(p, W, D, k.seed);
    (WAGON_DRAW[v] ?? van)(p, W, D, k.seed);
    wagonEnds(p, W, D);
  },
};

// ── the trip working on the spur (a moving vehicle: see the world's b.vehicle) ──
/** The cars, west to east: [variant, length in tiles incl. buffers]. A shunter at each end, noses outward. */
const CONSIST: [string, number][] = [['loco-rev', 4.8], ['tank', 4.4], ['open', 4.4], ['coil', 4.4], ['van', 4.4], ['loco', 4.8]];
export const TRAIN_LEN = CONSIST.reduce((s, [, l]) => s + l, 0);
const fac_train: PropArt = {
  draw(p, k) {
    // each car drawn by the wagon's own art on a painter shifted along the line, buffer to buffer
    let a = 0;
    CONSIST.forEach(([variant, len], i) => {
      const sub = p.rot === 0 ? new PropPainter(p.w, p.x + a, p.y, len, p.pd, 0) : new PropPainter(p.w, p.x, p.y + (p.pw - a - len), len, p.pd, 1);
      fac_wagon.draw(sub, { ...k, w: len, d: k.d, variant, seed: k.seed * 7 + i });
      a += len;
    });
  },
};

export const FACTORY_ROLLING: Record<string, PropArt> = { fac_wagon, fac_train };

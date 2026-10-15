// 128×64 architectural sets: farmhouse · barn · greenhouse · shed · coop ·
// well · pergola · trellis arch · beehive · compost · raised beds · garden
// furniture (picnic table, armchair, café table).
import { darken, lighten, mix } from '../color';
import { type Mat, tbox, texPara } from '../hd/kit';
import { poly, type PropPainter, type V2 } from '../iso';
import type { PropArt } from '../props';
import { at, contactShadow, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, OUTL, px, R, type Ramp, rng } from './kit4';
import { boards4, bricks4, cutStone4, fieldStones4, glass4, plaster4, shingles4, siding4 } from './materials4';
import { beam, door4, front, front3, poly3, ppoly, pq, pt, side, side3, window4 } from './plane4';

type V3 = [number, number, number];
const ROSES = ['#c8283a', '#e8577a', '#f6b6d0', '#fbe6ee'];
const GERANIUM = ['#d8302a', '#e8577a', '#f08a5a'];
const DAISY = ['#fbf7ee', '#f6d860', '#c49cf2'];

/** Textured parallelogram from prop-local 3D points (any plane: walls, roof slopes). */
function quad3(p: PropPainter, O: V3, U: V3, V: V3, mat: Mat, light: 0 | 1 | 2) {
  const o = p.P(...O);
  const a = p.P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
  const b = p.P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
  const Us: V2 = [a[0] - o[0], a[1] - o[1]];
  const Vs: V2 = [b[0] - o[0], b[1] - o[1]];
  texPara(p.c, o, Us, Vs, mat(light, Math.hypot(...Us), Math.hypot(...Vs)));
}

function edgeLine(p: PropPainter, pts: V2[], col: string, w = 1) {
  for (let i = 0; i < pts.length - 1; i++) ln(p.c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w);
}

/**
 * Gable roof with the ridge along a: back slope, optional right gable end,
 * front slope (shingles with moss), fascia, barge boards, ridge cap, gutter.
 */
type Gable = (bm: number, fill: (mat: Mat) => void, zF: (b: number) => number, zB: (b: number) => number) => void;
function roof(p: PropPainter, a0: number, a1: number, b0: number, b1: number, ze: number, zr: number, ramp: Ramp, o: { oh?: number; ohA?: number; ohB?: number; gable?: Gable; moss?: boolean; gutter?: boolean; rowH?: number; sw?: number } = {}) {
  const oh = o.oh ?? 0.35;
  // the verge only just overhangs the gable, so the roof visibly sits on the wall
  const ohA = o.ohA ?? Math.min(oh, 0.07);
  const bm = (b0 + b1) / 2;
  const A0 = a0 - ohA;
  const A1 = a1 + ohA;
  const zF = (b: number) => ze - 2 + ((zr - ze + 2) * (b1 + oh - b)) / (b1 + oh - bm);
  const zB = (b: number) => ze - 2 + ((zr - ze + 2) * (b - (b0 - oh))) / (bm - (b0 - oh));
  const mat = shingles4(ramp, o.rowH ?? 9, o.sw ?? 13, o.moss ? R.oak : undefined);
  // the back slope keeps the pitch but stops just past the back wall (only its verge is ever seen)
  const ohB = o.ohB ?? Math.min(oh, 0.1);
  const zBk = zB(b0 - ohB);
  quad3(p, [A0, b0 - ohB, zBk], [A1 - A0, 0, 0], [0, bm - (b0 - ohB), zr - zBk], mat, 0);
  // the gable infill reaches the underside of both slopes (no daylight between wall and roof)
  const fill = (m: Mat) => ppoly(p, side3(p, a1), [[b0, ze - 1], [b1, ze - 1], [b1, zF(b1)], [bm, zr], [b0, zB(b0)]], m);
  o.gable?.(bm, fill, zF, zB);
  quad3(p, [A0, b1 + oh, ze - 2], [A1 - A0, 0, 0], [0, bm - (b1 + oh), zr - ze + 2], mat, 1);
  // fascia board under the front eave, barge boards on the visible gable
  const e0 = p.P(A0, b1 + oh, ze - 2);
  const e1 = p.P(A1, b1 + oh, ze - 2);
  poly(p.c, [[e0[0], e0[1]], [e1[0], e1[1]], [e1[0], e1[1] + 5], [e0[0], e0[1] + 5]], darken(ramp[0], 0.15));
  poly(p.c, [[e0[0], e0[1]], [e1[0], e1[1]], [e1[0], e1[1] + 1], [e0[0], e0[1] + 1]], ramp[2]);
  // barge boards hang under both rakes of the visible gable, so the roof sits on the wall
  const r0 = p.P(A1, b1 + oh, ze - 2);
  const r1 = p.P(A1, bm, zr);
  const r2 = p.P(A1, b0 - ohB, zBk);
  const bh = Math.max(3, Math.round(3.4 * p.k));
  const face = mix(R.wood[1], OUTL, 0.18);
  const board = (a: V2, b: V2) => {
    poly(p.c, [a, b, [b[0], b[1] + bh], [a[0], a[1] + bh]], face);
    poly(p.c, [a, b, [b[0], b[1] + 2], [a[0], a[1] + 2]], ramp[2]);
    poly(p.c, [[a[0], a[1] + bh - 1], [b[0], b[1] + bh - 1], [b[0], b[1] + bh], [a[0], a[1] + bh]], mix(face, OUTL, 0.55));
  };
  board(r1, r2);
  board(r0, r1);
  poly(p.c, [r0, r1, [r1[0] + 1, r1[1]], [r0[0] + 1, r0[1]]], R.wood[4]);
  // ridge cap tiles
  const c0 = p.P(A0, bm, zr);
  const c1 = p.P(A1, bm, zr);
  const n = Math.round(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 9);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const x = c0[0] + (c1[0] - c0[0]) * t0;
    const y = c0[1] + (c1[1] - c0[1]) * t0;
    ell(p.c, x + 4, y, 6, 3.5, ramp[1]);
    ell(p.c, x + 3, y - 1, 5, 2.6, ramp[4]);
    px(p.c, x + 1, y - 2, ramp[6] ?? ramp[5], 3, 1);
  }
  if (o.gutter !== false) {
    // half-round gutter along the front eave
    poly(p.c, [[e0[0], e0[1] + 4], [e1[0], e1[1] + 4], [e1[0], e1[1] + 8], [e0[0], e0[1] + 8]], R.metal[2]);
    poly(p.c, [[e0[0], e0[1] + 4], [e1[0], e1[1] + 4], [e1[0], e1[1] + 5], [e0[0], e0[1] + 5]], R.metal[5]);
  }
  edgeLine(p, [p.P(A0, b0 - ohB, zBk), c0, c1], mix(ramp[0], OUTL, 0.6));
  edgeLine(p, [c0, e0], mix(ramp[0], OUTL, 0.5));
}

/** Climbing roses: leaf clumps with blooms up a wall from z0 to z1 at (a, b). */
function climber(p: PropPainter, a: number, b: number, z0: number, z1: number, seed: number, blooms = ROSES, spread = 0.12) {
  const Rn = rng(seed);
  const masses: Mass[] = [];
  const n = Math.round((z1 - z0) / 3.2);
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const [x, y] = p.P(a + (Rn() - 0.5) * spread, b, z0 + (z1 - z0) * t);
    masses.push({ x: x + (Rn() - 0.5) * 6, y, rx: 7 + Rn() * 4, ry: 6 + Rn() * 3, z: i });
  }
  layer(p.c, (l) => foliage(l, masses, R.oak, seed, { cell: 3.2, tilt: 0.2, dots: blooms, dotChance: 0.55, dotSize: 4 }), { outline: 0.6 });
}

/** Low flowering plants along the foot of a wall (front plane b, from a0 to a1). */
function bedAlong(p: PropPainter, a0: number, a1: number, b: number, seed: number, blooms: string[]) {
  const Rn = rng(seed);
  const masses: Mass[] = [];
  const n = Math.max(2, Math.round((a1 - a0) * 5));
  for (let i = 0; i <= n; i++) {
    const [x, y] = p.P(a0 + ((a1 - a0) * i) / n, b + Rn() * 0.12, 0);
    masses.push({ x, y: y - 7, rx: 8 + Rn() * 4, ry: 7 + Rn() * 3, z: y });
  }
  layer(p.c, (l) => foliage(l, masses, R.apple, seed, { cell: 3, tilt: 0.2, dots: blooms, dotChance: 0.65, dotSize: 4 }), { outline: 0.6 });
}

function lantern(p: PropPainter, x: number, y: number) {
  layer(p.c, (l) => {
    px(l, x - 1, y - 18, OUTL, 2, 4);
    fillPoly(l, [[x - 5, y - 14], [x + 5, y - 14], [x + 4, y], [x - 4, y]], R.iron[1]);
    px(l, x - 3, y - 12, '#ffd77a', 6, 11);
    px(l, x - 2, y - 11, '#fff3c2', 2, 6);
    fillPoly(l, [[x - 7, y - 14], [x + 7, y - 14], [x, y - 20]], R.iron[2]);
  });
}

/**
 * A gable dormer on a front roof slope whose surface height is zAt(b): the cheek
 * follows the slope, the little roof runs back into the main roof, barge boards
 * and a ridge cap finish it.
 */
function dormer(p: PropPainter, zAt: (b: number) => number, da: number, w: number, bF: number, wallH: number, rise: number, wall: Mat, roofRamp: Ramp) {
  const a0 = da - w / 2;
  const a1 = da + w / 2;
  const z0 = zAt(bF);
  const zE = z0 + wallH;
  const zD = zE + rise;
  // where a height meets the main slope (zAt falls toward the front, so solve for b)
  const bAt = (z: number) => {
    let lo = 0;
    let hi = bF;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (zAt(m) > z) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const oh = 0.1;
  const bRidge = bAt(zD);
  const bEave = bAt(zE - 0.6);
  const shing = shingles4(roofRamp, 6, 9);
  // the far slope first (seen at a grazing angle), then the cheek, the front, the near slope
  poly3(p, [[a0 - oh, bF + 0.12, zE - 0.6], [da, bF + 0.12, zD], [da, bRidge, zD], [a0 - oh, bEave, zE - 0.6]], shing, 2);
  poly3(p, [[a1, bF, z0], [a1, bF, zE], [a1, bAt(zE), zE]], wall, 0, [[a1, bF, z0], [a1, bF - 1, z0], [a1, bF, zE]]);
  poly3(p, [[a0, bF, z0], [a1, bF, z0], [a1, bF, zE], [da, bF, zD], [a0, bF, zE]], wall, 1);
  const F = front3(p, bF);
  beam(p, F, a0 + 0.03, z0, a0 + 0.03, zE, 0.7, R.wood);
  beam(p, F, a1 - 0.03, z0, a1 - 0.03, zE, 0.7, R.wood);
  window4(p, F, da - w * 0.3, da + w * 0.3, z0 + 1.5, zE - 0.8, { curtains: '#f6efe2', panes: 4 });
  poly3(p, [[da, bF + 0.12, zD], [a1 + oh, bF + 0.12, zE - 0.6], [a1 + oh, bEave, zE - 0.6], [da, bRidge, zD]], shing, 0, [[da, bF + 0.12, zD], [da, bRidge, zD], [a1 + oh, bF + 0.12, zE - 0.6]]);
  // barge boards on the dormer gable and a ridge cap
  const e0 = p.P(a0 - oh, bF + 0.12, zE - 0.6);
  const ap = p.P(da, bF + 0.12, zD);
  const e1 = p.P(a1 + oh, bF + 0.12, zE - 0.6);
  const bh = Math.max(2, Math.round(2.2 * p.k));
  for (const [s, t] of [[e0, ap], [ap, e1]] as const) {
    poly(p.c, [s, t, [t[0], t[1] + bh], [s[0], s[1] + bh]], R.wood[2]);
    poly(p.c, [s, t, [t[0], t[1] + 1], [s[0], s[1] + 1]], R.wood[4]);
  }
  const r1 = p.P(da, bRidge, zD);
  ln(p.c, ap[0], ap[1] - 1, r1[0], r1[1] - 1, roofRamp[4], 2);
}

/**
 * A brick chimney rising out of a front roof slope zAt(b): faces cut along the
 * roof, lead flashing (apron in front, steps down the side), a stone cap with
 * two clay pots, soot on the top courses.
 */
function chimney(p: PropPainter, zAt: (b: number) => number, a0: number, a1: number, b0: number, b1: number, zT: number) {
  const zf1 = zAt(b1);
  const zf0 = zAt(b0);
  const brick: Mat = (light, w, h) => {
    const f = bricks4(R.brick)(light, w, h);
    return (u, v, x, y) => (v > h - 12 && hash(x, y, 9) < (v - (h - 12)) / 16 ? (light ? '#4a3430' : '#3a2826') : f(u, v, x, y));
  };
  poly3(p, [[a0, b1, zf1], [a1, b1, zf1], [a1, b1, zT], [a0, b1, zT]], brick, 1);
  poly3(p, [[a1, b1, zf1], [a1, b0, zf0], [a1, b0, zT], [a1, b1, zT]], brick, 0, [[a1, b1, zf1], [a1, b0, zf1], [a1, b1, zT]]);
  // flashing: an apron folded onto the roof in front, a stepped strip down the side
  const lead = ['#2e3038', '#3c3f4a', '#4c505c', '#5e6270', '#727788', '#8a8fa0'];
  const flash: Mat = (light) => (_u, v, x, y) => at(lead, (light ? 2 : 1) + (v < 1.5 ? 1 : 0) - (hash(x, y, 12) < 0.05 ? 1 : 0));
  poly3(p, [[a0 - 0.03, b1, zf1 + 1.6], [a1 + 0.03, b1, zf1 + 1.6], [a1 + 0.03, b1 + 0.08, zAt(b1 + 0.08)], [a0 - 0.03, b1 + 0.08, zAt(b1 + 0.08)]], flash, 2);
  poly3(p, [[a1, b1, zf1], [a1 + 0.05, b1, zAt(b1)], [a1 + 0.05, b0, zAt(b0)], [a1, b0, zf0]], flash, 2);
  poly3(p, [[a1, b1, zf1], [a1, b0, zf0], [a1, b0, zf0 + 1.6], [a1, b1, zf1 + 1.6]], flash, 0, [[a1, b1, zf1], [a1, b0, zf1], [a1, b1, zf1 + 1.6]]);
  for (let i = 0; i <= 6; i++) {
    const b = b1 + ((b0 - b1) * i) / 6;
    const [x, y] = p.P(a1, b, zAt(b) + 2.2);
    px(p.c, x - 4, y, lead[1], 6, 1);
  }
  // cap stone and two clay pots
  tbox(p, a0 - 0.06, b0 - 0.06, a1 - a0 + 0.12, b1 - b0 + 0.12, zT, 2.2, { left: cutStone4(R.stone, 40), right: cutStone4(R.stone, 40), top: cutStone4(R.stone, 40), edge: R.stone[0] });
  const pots: [number, number][] = [[a0 + (a1 - a0) * 0.3, (b0 + b1) / 2], [a0 + (a1 - a0) * 0.72, (b0 + b1) / 2 + 0.04]];
  layer(p.c, (l) => {
    for (const [pa, pb] of pots) {
      const [x, y] = p.P(pa, pb, zT + 2.2);
      const H = 3.4 * p.k;
      const rx = 1.6 * p.k;
      for (let i = -rx; i <= rx; i++) {
        const t = (i + rx) / (2 * rx);
        const tone = t < 0.3 ? 4 : t < 0.6 ? 3 : 2;
        const bottom = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * rx * 0.45;
        px(l, x + i, y + bottom - H, R.brick[tone], 1, H);
      }
      ell(l, x, y - H, rx + 1, (rx + 1) * 0.45, R.brick[5]);
      ell(l, x, y - H, rx - 1, (rx - 1) * 0.45, '#2a1e1c');
    }
  });
}

const zFront = (B1: number, oh: number, bm: number, ze: number, zr: number) => (b: number) => ze - 2 + ((zr - ze + 2) * (B1 + oh - b)) / (B1 + oh - bm);

// ── farmhouse (8 × 5) ───────────────────────────────────────
const farmhouse: PropArt = {
  draw(p, k) {
    const A0 = 0.3;
    const A1 = 7.7;
    const B0 = 0.5;
    const B1 = 4.5;
    const ZW = 46;
    const [sx, sy] = p.P(A1, B1, 0);
    contactShadow(p.c, sx + 40, sy - 60, 330, 120, 0.22);
    tbox(p, A0 - 0.06, B0, A1 - A0 + 0.12, B1 - B0 + 0.06, 0, 8, { left: fieldStones4(R.stoneWarm, 12, 0.3, R.oak), right: fieldStones4(R.stoneWarm, 12, 0.3, R.oak), top: cutStone4(R.stoneWarm, 20), edge: R.stoneWarm[0] });
    tbox(p, A0, B0, A1 - A0, B1 - B0, 8, ZW - 8, { left: plaster4(R.plaster), right: plaster4(R.plaster), edge: R.plaster[1] });
    const F = front(p, B1);
    const S = side(p, A1);
    const T = R.wood;
    // timber frame
    for (const a of [A0 + 0.06, 2.15, 4.0, 5.85, A1 - 0.06]) beam(p, F, a, 8, a, ZW, 1.1, T);
    for (const z of [8.6, 27, ZW - 0.8]) beam(p, F, A0, z, A1, z, z === 27 ? 0.8 : 1.1, T);
    beam(p, F, A0 + 0.1, 9.5, 2.1, 26, 0.7, T);
    beam(p, F, A1 - 0.1, 9.5, 5.9, 26, 0.7, T);
    for (const b of [B0 + 0.06, 2.5, B1 - 0.06]) beam(p, S, b, 8, b, ZW, 1.1, T);
    for (const z of [8.6, 27, ZW - 0.8]) beam(p, S, B0, z, B1, z, z === 27 ? 0.8 : 1.1, T);
    beam(p, S, B0 + 0.1, 28, 2.4, ZW - 1.5, 0.7, T);
    // windows: geraniums on the ground floor, lace curtains everywhere
    for (const a of [1.15, 6.9]) window4(p, F, a - 0.42, a + 0.42, 12.5, 24, { shutters: R.roof, box: GERANIUM, curtains: '#f6efe2' });
    for (const a of [3.05, 4.95, 6.9, 1.15]) window4(p, F, a - 0.3, a + 0.3, 30.5, 41, { curtains: '#f6efe2', panes: 4, box: a === 3.05 ? DAISY : a === 6.9 ? GERANIUM : null });
    window4(p, S, 1.15, 1.85, 12.5, 24, { shutters: R.roof, box: DAISY, curtains: '#f6efe2' });
    window4(p, S, 3.15, 3.85, 12.5, 24, { shutters: R.roof, box: GERANIUM, curtains: '#f6efe2' });
    window4(p, S, 1.25, 1.75, 30.5, 40, { curtains: '#f6efe2' });
    window4(p, S, 3.25, 3.75, 30.5, 40, { curtains: '#f6efe2' });
    // front door with steps, porch canopy, lanterns
    door4(p, F, 2.6, 3.45, 8, 31, R.roof);
    beam(p, F, 2.52, 31.5, 3.53, 31.5, 0.7, T);
    tbox(p, 2.42, B1, 1.15, 0.3, 0, 4.5, { left: cutStone4(R.stone, 4.5), right: cutStone4(R.stone, 10), top: cutStone4(R.stone, 30), edge: R.stone[1] });
    tbox(p, 2.5, B1 + 0.3, 0.98, 0.26, 0, 2.2, { left: cutStone4(R.stone, 3), right: cutStone4(R.stone, 10), top: cutStone4(R.stone, 30), edge: R.stone[1] });
    for (const a of [2.42, 3.6]) {
      const [lx, ly] = F.F(a, 26);
      lantern(p, lx, ly);
    }
    for (const a of [2.35, 3.65]) tbox(p, a - 0.04, B1 + 0.4, 0.08, 0.08, 0, 34, { left: siding4(T, 30), right: siding4(T, 30), top: siding4(T), edge: T[0] });
    quad3(p, [2.15, B1 + 0.62, 33], [1.7, 0, 0], [0, -0.64, 6.5], shingles4(R.roof, 7, 10), 1);
    const pe0 = p.P(2.15, B1 + 0.62, 33);
    const pe1 = p.P(3.85, B1 + 0.62, 33);
    poly(p.c, [[pe0[0], pe0[1]], [pe1[0], pe1[1]], [pe1[0], pe1[1] + 4], [pe0[0], pe0[1] + 4]], T[1]);
    // roof with moss, gutter, and the right gable end
    roof(p, A0, A1, B0, B1, ZW, ZW + 34, R.roof, {
      oh: 0.4,
      moss: true,
      gable: (bm, fill, zF, zB) => {
        fill(plaster4(R.plaster));
        beam(p, S, bm, ZW, bm, ZW + 33, 1.1, R.wood);
        beam(p, S, B0 + 0.12, zB(B0 + 0.12) - 1.4, bm, ZW + 33, 0.8, R.wood);
        beam(p, S, B1 - 0.12, zF(B1 - 0.12) - 1.4, bm, ZW + 33, 0.8, R.wood);
        beam(p, S, B0 + 0.1, ZW + 0.6, B1 - 0.1, ZW + 0.6, 0.9, R.wood);
        window4(p, S, bm - 0.3, bm + 0.3, ZW + 4, ZW + 15, { curtains: '#f6efe2', panes: 2 });
      },
    });
    // a gable dormer and a chimney that grow out of the front slope
    const zAt = zFront(B1, 0.4, (B0 + B1) / 2, ZW, ZW + 34);
    dormer(p, zAt, 4.95, 0.9, 3.75, 9.5, 6, plaster4(R.plaster), R.roof);
    chimney(p, zAt, 6.0, 6.7, 2.78, 3.38, ZW + 52);
    // downpipe on the right corner
    const [dx0, dy0] = p.P(A1 + 0.05, B1 + 0.05, ZW - 2);
    px(p.c, dx0 - 2, dy0, R.metal[2], 4, ZW * 4 - 10);
    px(p.c, dx0 - 2, dy0, R.metal[4], 1, ZW * 4 - 10);
    // roses up the left corner and over the door, beds along the front
    climber(p, A0 + 0.12, B1 + 0.04, 4, 42, k.seed * 7);
    climber(p, 2.4, B1 + 0.1, 6, 30, k.seed * 11, ['#fbf7ee', '#f6d860', '#f2b6c8']);
    climber(p, A1 - 0.06, B1 - 0.1, 4, 36, k.seed * 13);
    bedAlong(p, A0 + 0.3, 2.3, B1 + 0.22, k.seed + 3, ['#f6d860', '#e8577a', '#fbf7ee', '#c49cf2']);
    bedAlong(p, 3.8, A1 - 0.3, B1 + 0.22, k.seed + 7, ['#e8577a', '#f2b6c8', '#fbf7ee']);
    // wisteria up the gable side and along its beam, roses round the upstairs windows
    climber(p, A1 + 0.03, 3.95, 4, 46, k.seed * 17, ['#9a7ad8', '#b8a0ec', '#7a5ab8', '#c8b4f0'], 0.1);
    climber(p, A1 + 0.03, 1.05, 4, 30, k.seed * 19, ROSES, 0.08);
    climber(p, 4.05, B1 + 0.05, 25, 45, k.seed * 23, ROSES, 0.14);
    layer(p.c, (l) => {
      const Rw = rng(k.seed * 29);
      for (let i = 0; i < 16; i++) {
        const [x, y] = p.P(A1 + 0.04, 2.6 + i * 0.11, 26.6);
        const n = 8 + Math.floor(Rw() * 10);
        for (let j = 0; j < n; j++) px(l, x + (j % 3 === 1 ? 1 : 0), y + j, j < n * 0.35 ? '#c8b4f0' : j < n * 0.8 ? '#9a7ad8' : '#7a5ab8', 2, 1);
      }
    });
    // pots of geraniums and a clipped box ball either side of the steps, a doormat
    layer(p.c, (l) => {
      for (const [a, ball] of [[2.22, 1], [3.82, 0]] as const) {
        const [x, y] = p.P(a, B1 + 0.36, 0);
        fillPoly(l, [[x - 9, y - 14], [x + 9, y - 14], [x + 7, y], [x - 7, y]], '#b8693e');
        px(l, x - 9, y - 15, '#d48a5a', 18, 3);
        px(l, x + 3, y - 12, '#8a4a2a', 4, 12);
        if (ball) foliage(l, [{ x, y: y - 24, rx: 11, ry: 10, z: 1 }], R.hedge, k.seed + 41, { cell: 2.8 });
        else foliage(l, [{ x, y: y - 20, rx: 12, ry: 7, z: 1 }], R.apple, k.seed + 43, { cell: 2.8, dots: GERANIUM, dotChance: 0.8, dotSize: 4 });
      }
      const [mx, my] = p.P(3.0, B1 + 0.2, 4.6);
      fillPoly(l, [[mx - 16, my], [mx + 2, my - 9], [mx + 16, my - 2], [mx - 2, my + 7]], '#8a6a3a');
      fillPoly(l, [[mx - 12, my], [mx + 2, my - 7], [mx + 12, my - 2], [mx - 2, my + 5]], '#a8844a');
    });
  },
  anim(p, k) {
    const u = p.k / 4;
    const [x, y] = p.P(6.5, 3.12, 46 + 58);
    for (let i = 0; i < 5; i++) {
      const t = (k.t * 0.3 + i / 5) % 1;
      const r = (4 + t * 8) * u;
      p.c.globalAlpha = 0.5 * (1 - t);
      ell(p.c, x + (Math.sin(t * 5 + i) * 4 + t * 22) * u, y - t * 80 * u, r, r * 0.85, '#efe8e0');
      ell(p.c, x + (Math.sin(t * 5 + i) * 4 + t * 22 - 2) * u, y - (t * 80 + 2) * u, r * 0.6, r * 0.5, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── barn (4 × 3) ────────────────────────────────────────────
const barn: PropArt = {
  draw(p, k) {
    const A0 = 0.12;
    const A1 = 3.88;
    const B0 = 0.25;
    const B1 = 2.8;
    const ZW = 34;
    const RISE = 30;
    const [sx, sy] = p.P(A1, B1, 0);
    contactShadow(p.c, sx + 20, sy - 30, 176, 72, 0.22);
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, ZW, { left: boards4(R.woodRed, 10), right: boards4(R.woodRed, 10), edge: R.woodRed[0] });
    const F = front(p, B1);
    const S = side(p, A1);
    const trim = ['#9a958c', '#bab4a8', '#d6d0c2', '#ebe6da', '#f6f2ea', '#ffffff'];
    for (const a of [A0 + 0.05, A1 - 0.05]) beam(p, F, a, 0, a, ZW, 1, trim);
    beam(p, F, A0, ZW - 0.8, A1, ZW - 0.8, 1, trim);
    for (const b of [B0 + 0.05, B1 - 0.05]) beam(p, S, b, 0, b, ZW, 1, trim);
    beam(p, S, B0, ZW - 0.8, B1, ZW - 0.8, 1, trim);
    // sliding doors on a track with X braces
    const d0 = 1.05;
    const d1 = 2.95;
    pq(p, F, d0 - 0.05, d1 + 0.05, 0, 24, mix(R.woodRed[0], OUTL, 0.4));
    pt(p, F, d0, d1, 0, 23, boards4(R.woodRed, 8));
    beam(p, F, d0 - 0.1, 24.5, d1 + 0.1, 24.5, 0.6, R.iron);
    for (const [a, b] of [[d0, (d0 + d1) / 2], [(d0 + d1) / 2, d1]]) {
      for (const u of [a, b]) beam(p, F, u, 0.5, u, 23, 0.8, trim);
      beam(p, F, a, 1, b, 1, 0.8, trim);
      beam(p, F, a, 22.5, b, 22.5, 0.8, trim);
      beam(p, F, a + 0.05, 1.8, b - 0.05, 22, 0.6, trim);
      beam(p, F, b - 0.05, 1.8, a + 0.05, 22, 0.6, trim);
    }
    // hay loft door with hay spilling, a pulley beam
    window4(p, S, 1.1, 1.9, 12, 22, { frame: trim[3], panes: 4 });
    // gambrel-ish roof: steep lower slopes, shallow top
    const barnRoof: Ramp = ['#2a1c1c', '#3a2624', '#4e302c', '#643c34', '#7c4c3e', '#96604c', '#b07a5e'];
    roof(p, A0, A1, B0, B1, ZW, ZW + RISE, barnRoof, {
      oh: 0.3,
      gable: (bm, fill) => {
        fill(boards4(R.woodRed, 10));
        pt(p, S, bm - 0.4, bm + 0.4, ZW + 3, ZW + 17, boards4(['#2e1a14', '#4a2a1e', '#5e3826', '#704630', '#84563a', '#9a6a48'], 7), 0);
        for (const u of [bm - 0.42, bm + 0.42]) beam(p, S, u, ZW + 3, u, ZW + 17, 0.6, trim);
        beam(p, S, bm - 0.42, ZW + 17, bm + 0.42, ZW + 17, 0.6, trim);
        // hay tufts poking out of the loft
        const [hx, hy] = S.F(bm, ZW + 4);
        for (let i = 0; i < 14; i++) px(p.c, hx - 14 + hash(i, 1, k.seed) * 26, hy - hash(i, 2, k.seed) * 8, R.hay[3 + (i % 3)], 4, 1);
        const [px0, py0] = S.F(bm, ZW + 25);
        px(p.c, px0, py0, R.wood[2], 18, 4);
        ln(p.c, px0 + 16, py0 + 4, px0 + 16, py0 + 26, '#8a7a5a');
      },
    });
    // a louvred cupola on the ridge with a rooster weathervane
    {
      const bm = (B0 + B1) / 2;
      const zf = zFront(B1, 0.3, bm, ZW, ZW + RISE);
      const zb = (b: number) => ZW - 2 + ((RISE + 2) * (b - (B0 - 0.3))) / (bm - (B0 - 0.3));
      const c0 = 1.72;
      const c1 = 2.28;
      const q = 0.28;
      const zT = ZW + RISE + 9;
      const white = boards4(trim, 6, false);
      poly3(p, [[c1, bm + q, zf(bm + q)], [c1, bm, ZW + RISE], [c1, bm - q, zb(bm - q)], [c1, bm - q, zT], [c1, bm + q, zT]], white, 0, [[c1, bm + q, zf(bm + q)], [c1, bm - q, zf(bm + q)], [c1, bm + q, zT]]);
      poly3(p, [[c0, bm + q, zf(bm + q)], [c1, bm + q, zf(bm + q)], [c1, bm + q, zT], [c0, bm + q, zT]], white, 1);
      const CF = front3(p, bm + q);
      const CS = side3(p, c1);
      for (let i = 0; i < 4; i++) {
        const z = zT - 2.2 - i * 1.6;
        beam(p, CF, c0 + 0.07, z, c1 - 0.07, z, 0.35, ['#2a1e1a', '#3a2a24', '#4a3a30', '#5a4a3e', '#6a5a4e', '#7a6a5e']);
        beam(p, CS, bm + q - 0.07, z, bm - q + 0.07, z, 0.35, ['#1e1612', '#2a201a', '#3a2c24', '#4a3a30', '#5a4a3e', '#6a5a4e']);
      }
      const roofC = shingles4(barnRoof, 5, 8);
      const apex: [number, number, number] = [(c0 + c1) / 2, bm, zT + 7];
      poly3(p, [[c0 - 0.06, bm + q + 0.06, zT], [c1 + 0.06, bm + q + 0.06, zT], apex], roofC, 1);
      poly3(p, [[c1 + 0.06, bm + q + 0.06, zT], [c1 + 0.06, bm - q - 0.06, zT], apex], roofC, 0);
      const [vx, vy] = p.P(apex[0], apex[1], apex[2]);
      layer(p.c, (l) => {
        px(l, vx - 1, vy - 34, R.iron[2], 2, 34);
        ln(l, vx - 14, vy - 22, vx + 14, vy - 22, R.iron[1], 2);
        fillPoly(l, [[vx + 14, vy - 25], [vx + 19, vy - 22], [vx + 14, vy - 19]], R.iron[1]);
        fillPoly(l, [[vx - 16, vy - 25], [vx - 11, vy - 22], [vx - 16, vy - 19]], R.iron[1]);
        // the rooster: body, tail, comb
        fillPoly(l, [[vx - 6, vy - 30], [vx + 5, vy - 30], [vx + 7, vy - 36], [vx + 3, vy - 40], [vx - 2, vy - 35], [vx - 9, vy - 38], [vx - 8, vy - 32]], R.iron[2]);
        px(l, vx + 4, vy - 42, '#a8381e', 3, 2);
        px(l, vx + 7, vy - 38, R.iron[2], 2, 1);
      });
    }
    // spilled hay at the door, a lantern, weeds along the base
    const [hx, hy] = p.P(2, B1 + 0.3, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 70; i++) px(l, hx - 40 + hash(i, 3, k.seed) * 80, hy - 6 + hash(i, 4, k.seed) * 14, R.hay[2 + Math.floor(hash(i, 5, k.seed) * 4)], 4, 1);
    });
    const [lx, ly] = F.F(0.6, 22);
    lantern(p, lx, ly);
    bedAlong(p, A0 + 0.1, 0.9, B1 + 0.15, k.seed + 5, ['#fbf7ee', '#f6d860']);
  },
};

// ── greenhouse (4 × 3) ──────────────────────────────────────
const FRAME: Ramp = ['#9a958c', '#bab4a8', '#d6d0c2', '#ebe6da', '#f6f2ea', '#ffffff'];
const FRAME_DIM: Ramp = FRAME.map((c) => mix(c, '#5e7e7a', 0.32));
const gravel: Mat = () => (_u, _v, x, y) => at(R.stoneWarm, 2 + (hash(x >> 1, y, 5) < 0.3 ? 1 : 0) - (hash(x, y, 6) < 0.1 ? 1 : 0));

/** A small coopered barrel: staves, two iron hoops, water at the top. */
function barrelAt(c: CanvasRenderingContext2D, x: number, y: number, rx: number, h: number, water = true) {
  for (let i = -rx; i <= rx; i++) {
    const t = (i + rx) / (2 * rx);
    const bottom = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * rx * 0.45;
    const tone = t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1;
    const stave = (i + rx) % 5 === 0;
    for (let j = 0; j < h; j++) {
      const hoop = Math.abs(j - h * 0.22) < 1.5 || Math.abs(j - h * 0.78) < 1.5;
      px(c, x + i, y + bottom - j, hoop ? R.iron[Math.min(4, tone)] : R.wood[stave ? Math.max(0, tone - 1) : tone + 1]);
    }
  }
  ell(c, x, y - h, rx, rx * 0.45, R.wood[2]);
  if (water) {
    ell(c, x, y - h + 1, rx - 2, rx * 0.45 - 1.5, R.water[1]);
    ell(c, x - 2, y - h + 1, rx * 0.5, rx * 0.18, R.water[4]);
  } else ell(c, x, y - h + 1, rx - 2, rx * 0.45 - 1.5, R.wood[1]);
}

const greenhouse2: PropArt = {
  draw(p, k) {
    const A0 = 0.12;
    const A1 = 3.5;
    const B0 = 0.2;
    const B1 = 2.8;
    const ZB = 8;
    const ZW = 36;
    const ZR = ZW + 18;
    const bm = (B0 + B1) / 2;
    const NA = 7;
    const NB = 6;
    const Rn = rng(k.seed * 3 + 1);
    const [sx, sy] = p.P(A1, B1, 0);
    contactShadow(p.c, sx + 12, sy - 30, 156, 62, 0.16);
    // plinth of painted boards, a gravel floor inside
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, ZB, { left: siding4(R.wood, 7), right: siding4(R.wood, 7), top: gravel, edge: R.wood[0] });
    // the far walls seen through the glass: faint panes, dimmer frames, the back rafters
    const Bk = front3(p, B0);
    const Fw = side3(p, A0);
    p.c.globalAlpha = 0.24;
    pt(p, Bk, A0, A1, ZB, ZW, glass4(R.glass), 0);
    ppoly(p, Fw, [[B0, ZB], [B1, ZB], [B1, ZW], [bm, ZR], [B0, ZW]], glass4(R.glass), 0);
    p.c.globalAlpha = 1;
    for (let i = 0; i <= NA; i++) beam(p, Bk, A0 + ((A1 - A0) * i) / NA, ZB, A0 + ((A1 - A0) * i) / NA, ZW, 0.4, FRAME_DIM);
    for (let i = 0; i <= NB; i++) beam(p, Fw, B0 + ((B1 - B0) * i) / NB, ZB, B0 + ((B1 - B0) * i) / NB, ZW, 0.4, FRAME_DIM);
    for (const z of [ZB + 14, ZW]) {
      beam(p, Bk, A0, z, A1, z, 0.4, FRAME_DIM);
      beam(p, Fw, B0, z, B1, z, 0.4, FRAME_DIM);
    }
    beam(p, Fw, B0, ZW, bm, ZR, 0.4, FRAME_DIM);
    beam(p, Fw, B1, ZW, bm, ZR, 0.4, FRAME_DIM);
    for (let i = 0; i <= NA; i++) {
      const a = A0 + ((A1 - A0) * i) / NA;
      const e = p.P(a, B0, ZW);
      const r = p.P(a, bm, ZR);
      ln(p.c, e[0], e[1], r[0], r[1], FRAME_DIM[3], 2);
    }
    // slatted staging along the back wall with seed trays
    const wood6 = { left: siding4(R.woodPale, 30), right: siding4(R.woodPale, 30), top: siding4(R.woodPale), edge: R.woodPale[0] };
    for (const a of [A0 + 0.2, (A0 + A1) / 2, A1 - 0.2]) tbox(p, a - 0.03, B0 + 0.42, 0.06, 0.06, ZB, 6, wood6);
    tbox(p, A0 + 0.1, B0 + 0.08, A1 - A0 - 0.2, 0.42, ZB + 6, 1.2, { left: siding4(R.woodPale, 4), right: siding4(R.woodPale, 4), top: boards4(R.woodPale, 5, false), edge: R.woodPale[0] });
    layer(p.c, (l) => {
      for (let i = 0; i < 6; i++) {
        const [tx, ty] = p.P(A0 + 0.3 + i * 0.52, B0 + 0.3, ZB + 7.4);
        fillPoly(l, [[tx - 14, ty - 2], [tx + 8, ty - 13], [tx + 18, ty - 8], [tx - 4, ty + 3]], '#2e2a2e');
        for (let q = 0; q < 10; q++) {
          const fx = tx - 10 + (q % 5) * 5 + Math.floor(q / 5) * 3;
          const fy = ty - 1 - (q % 5) * 2.4 - Math.floor(q / 5) * 3.5;
          px(l, fx, fy - 2, R.birch[3 + (q & 1)], 2, 2);
          px(l, fx, fy - 3, R.birch[5]);
        }
      }
    });
    // tomatoes up their canes, pots of seedlings by the front, baskets hanging from the ridge
    layer(p.c, (l) => {
      for (let i = 0; i < 6; i++) {
        const [x, y] = p.P(A0 + 0.45 + i * 0.52, B0 + 1.05, ZB + 1);
        px(l, x + 6, y - 40, '#b8925a', 1, 40);
        foliage(l, [{ x, y: y - 14, rx: 10, ry: 14, z: 1 }, { x: x + 3, y: y - 30, rx: 8, ry: 9, z: 2 }], R.apple, k.seed + i, { cell: 3, dots: ['#d8302a', '#e8572a', '#f2b33a'], dotChance: 0.4, dotSize: 3 });
      }
      for (let i = 0; i < 8; i++) {
        const [x, y] = p.P(A0 + 0.35 + i * 0.41, B1 - 0.42, ZB + 1);
        fillPoly(l, [[x - 6, y - 8], [x + 6, y - 8], [x + 5, y], [x - 5, y]], '#c07448');
        px(l, x - 6, y - 9, '#dc9466', 12, 2);
        foliage(l, [{ x, y: y - 14, rx: 7, ry: 6, z: 1 }], R.birch, k.seed + 20 + i, { cell: 2.6, dots: [['#f08aa8', '#f6d860', '#c49cf2'][i % 3]], dotChance: 0.5, dotSize: 3 });
      }
      for (const a of [0.85, 1.85, 2.85]) {
        const [hx, hy] = p.P(a, bm, ZR - 13);
        const [tx, ty] = p.P(a, bm, ZR - 1);
        ln(l, tx, ty, hx, hy - 6, '#8a7a5a');
        ell(l, hx, hy - 3, 9, 4, '#8a5a2e');
        ell(l, hx, hy - 4, 8, 3, '#b07a44');
        foliage(l, [{ x: hx, y: hy - 7, rx: 10, ry: 5, z: 1 }], R.apple, k.seed + Math.round(a * 10), { cell: 2.6, dots: ['#e8577a', '#fbf7ee', '#c49cf2'], dotChance: 0.6, dotSize: 3 });
        for (let j = 0; j < 5; j++) {
          const sx2 = hx - 8 + j * 4;
          for (let q = 0; q < 6 + (j % 3) * 3; q++) px(l, sx2 + (q % 4 === 3 ? 1 : 0), hy + q, R.apple[2 + (q & 1)]);
        }
      }
    });
    // the near walls: glass, white glazing bars, the door
    const F = front3(p, B1);
    const S = side3(p, A1);
    p.c.globalAlpha = 0.42;
    pt(p, F, A0, A1, ZB, ZW, glass4(R.glass));
    pt(p, S, B0, B1, ZB, ZW, glass4(R.glass));
    p.c.globalAlpha = 1;
    // condensation beading in the lower corners of the panes
    for (let i = 0; i < 40; i++) {
      const [cx2, cy2] = F.F(A0 + Rn() * (A1 - A0), ZB + 0.6 + Rn() * 4);
      px(p.c, cx2, cy2, '#e4f6f0');
    }
    for (let i = 0; i <= NA; i++) beam(p, F, A0 + ((A1 - A0) * i) / NA, ZB, A0 + ((A1 - A0) * i) / NA, ZW, 0.45, FRAME);
    for (let i = 0; i <= NB; i++) beam(p, S, B0 + ((B1 - B0) * i) / NB, ZB, B0 + ((B1 - B0) * i) / NB, ZW, 0.45, FRAME);
    for (const z of [ZB + 14, ZW]) {
      beam(p, F, A0, z, A1, z, 0.45, FRAME);
      beam(p, S, B0, z, B1, z, 0.45, FRAME);
    }
    door4(p, F, 1.45, 2.15, ZB - 8, ZW - 6, FRAME, { glass: true });
    // glass roof, exactly as long as the frame: back slope, the near gable, front slope
    p.c.globalAlpha = 0.34;
    quad3(p, [A0, B0, ZW], [A1 - A0, 0, 0], [0, bm - B0, ZR - ZW], glass4(R.glass), 0);
    p.c.globalAlpha = 0.55;
    ppoly(p, S, [[B0, ZW], [B1, ZW], [bm, ZR]], glass4(R.glass), 0);
    p.c.globalAlpha = 0.66;
    quad3(p, [A0, B1, ZW], [A1 - A0, 0, 0], [0, bm - B1, ZR - ZW], glass4(R.glass), 1);
    p.c.globalAlpha = 1;
    for (let i = 0; i <= NA; i++) {
      const a = A0 + ((A1 - A0) * i) / NA;
      const e = p.P(a, B1, ZW);
      const r = p.P(a, bm, ZR);
      ln(p.c, e[0], e[1], r[0], r[1], FRAME[4], 2);
      ln(p.c, e[0] + 2, e[1], r[0] + 2, r[1], FRAME[2], 1);
    }
    beam(p, S, B0, ZW, bm, ZR, 0.45, FRAME);
    beam(p, S, B1, ZW, bm, ZR, 0.45, FRAME);
    const c0 = p.P(A0, bm, ZR);
    const c1 = p.P(A1, bm, ZR);
    poly(p.c, [[c0[0], c0[1] - 2], [c1[0], c1[1] - 2], [c1[0], c1[1] + 2], [c0[0], c0[1] + 2]], FRAME[4]);
    poly(p.c, [[c0[0], c0[1] - 2], [c1[0], c1[1] - 2], [c1[0], c1[1] - 1], [c0[0], c0[1] - 1]], FRAME[5]);
    // two roof vents propped open
    for (const a of [0.9, 2.45]) {
      p.c.globalAlpha = 0.7;
      quad3(p, [a, bm, ZR], [0.45, 0, 0], [0, 0.3, 4], glass4(R.glass), 1);
      p.c.globalAlpha = 1;
      edgeLine(p, [p.P(a, bm, ZR), p.P(a, bm + 0.3, ZR + 4), p.P(a + 0.45, bm + 0.3, ZR + 4), p.P(a + 0.45, bm, ZR)], FRAME[4], 2);
    }
    // a grapevine up the left corner and along the eave, bunches hanging under it
    layer(
      p.c,
      (l) => {
        const path: V2[] = [];
        for (let z = 1; z <= ZW; z += 2) path.push(p.P(A0 + 0.04 + Math.sin(z * 0.3) * 0.02, B1 + 0.05, z));
        for (let a = A0 + 0.1; a <= 1.35; a += 0.06) path.push(p.P(a, B1 + 0.05, ZW - 0.5 + Math.sin(a * 9) * 0.6));
        for (let i = 1; i < path.length; i++) {
          ln(l, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], R.bark[2], 3);
          ln(l, path[i - 1][0] - 1, path[i - 1][1], path[i][0] - 1, path[i][1], R.bark[4], 1);
        }
        const masses: Mass[] = [];
        for (let i = 4; i < path.length; i += 2) masses.push({ x: path[i][0] + (Rn() - 0.5) * 10, y: path[i][1] - 3 + (Rn() - 0.5) * 6, rx: 8 + Rn() * 4, ry: 6 + Rn() * 3, z: i });
        foliage(l, masses, R.birch, k.seed + 31, { cell: 3.4, tilt: 0.22 });
        for (let i = 0; i < 5; i++) {
          const [gx, gy] = p.P(A0 + 0.25 + i * 0.22, B1 + 0.06, ZW - 3);
          for (let q = 0; q < 9; q++) dotFruit(l, gx - 4 + (q % 3) * 3 + (Math.floor(q / 3) % 2), gy + Math.floor(q / 3) * 3, q % 4 ? '#5a2e6e' : '#7a4a8e', 3);
        }
      },
      { outline: 0.6 },
    );
    // morning glory up the front-right corner post and along the side's top rail
    layer(
      p.c,
      (l) => {
        const path: V2[] = [];
        for (let z = 1; z <= ZW; z += 2) path.push(p.P(A1 + 0.03, B1 + 0.02 + Math.sin(z * 0.4) * 0.015, z));
        for (let b = B1 - 0.05; b >= B0 + 0.9; b -= 0.06) path.push(p.P(A1 + 0.03, b, ZW - 0.4 + Math.sin(b * 11) * 0.5));
        for (let i = 1; i < path.length; i++) ln(l, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], R.birch[1], 2);
        const masses: Mass[] = [];
        for (let i = 2; i < path.length; i += 2) masses.push({ x: path[i][0] + (Rn() - 0.5) * 8, y: path[i][1] - 2 + (Rn() - 0.5) * 6, rx: 6 + Rn() * 3, ry: 5 + Rn() * 2, z: i });
        foliage(l, masses, R.apple, k.seed + 37, { cell: 3, tilt: 0.24, dots: ['#3a5ad8', '#6a7ae8', '#b04ac8', '#fbf7ee'], dotChance: 0.55, dotSize: 4 });
      },
      { outline: 0.6 },
    );
    // ivy creeping along the plinth
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let a = A0 + 0.1; a < 1.3; a += 0.12) {
        const [x, y] = p.P(a, B1 + 0.02, 2 + Rn() * 5);
        masses.push({ x, y, rx: 5 + Rn() * 3, ry: 4 + Rn() * 2, z: y });
      }
      foliage(l, masses, R.oak, k.seed + 47, { cell: 2.6, tilt: 0.2 });
    });
    // a clematis on the far corner, flowers and herbs along the plinth
    climber(p, A1 + 0.03, B0 + 0.12, 2, ZW - 2, k.seed * 5 + 3, ['#7a5ab8', '#9a7ad8', '#c49cf2', '#fbf7ee'], 0.05);
    bedAlong(p, A0 + 0.35, 1.3, B1 + 0.2, k.seed + 4, ['#f08aa8', '#f6d860', '#fbf7ee']);
    bedAlong(p, 2.3, A1 - 0.1, B1 + 0.2, k.seed + 9, ['#c49cf2', '#fbf7ee', '#e8577a']);
    // the sunny end: a potting bench with pots, trays and a trowel, a water butt under the downpipe
    const pb = { left: siding4(R.wood, 30), right: siding4(R.wood, 30), top: siding4(R.wood), edge: R.wood[0] };
    for (const [a, b] of [[3.62, 0.62], [3.92, 0.62], [3.62, 1.92], [3.92, 1.92]] as const) tbox(p, a - 0.03, b - 0.03, 0.06, 0.06, 0, 8.5, pb);
    tbox(p, 3.6, 0.6, 0.36, 1.36, 3, 0.8, { left: siding4(R.wood, 5), right: siding4(R.wood, 5), top: boards4(R.wood, 6, false), edge: R.wood[0] });
    tbox(p, 3.57, 0.56, 0.4, 1.42, 8.5, 1.1, { left: siding4(R.wood, 5), right: siding4(R.wood, 5), top: boards4(R.wood, 6, false), edge: R.wood[0] });
    layer(p.c, (l) => {
      for (const [b, tall] of [[0.78, 1], [1.02, 0], [1.6, 1]] as const) {
        const [x, y] = p.P(3.77, b, 9.6);
        fillPoly(l, [[x - 6, y - 9], [x + 6, y - 9], [x + 5, y], [x - 5, y]], '#c07448');
        px(l, x - 6, y - 10, '#dc9466', 12, 2);
        if (tall) foliage(l, [{ x, y: y - 16, rx: 7, ry: 8, z: 1 }], R.apple, k.seed + Math.round(b * 10), { cell: 2.6, dots: ['#e8577a'], dotChance: 0.35, dotSize: 3 });
      }
      const [tx, ty] = p.P(3.77, 1.3, 9.6);
      fillPoly(l, [[tx - 12, ty], [tx + 2, ty - 7], [tx + 12, ty - 2], [tx - 2, ty + 5]], '#2e2a2e');
      for (let q = 0; q < 6; q++) px(l, tx - 6 + q * 3, ty - 1 - q * 1.2, R.birch[4], 2, 2);
      const [wx, wy] = p.P(3.77, 1.82, 9.6);
      ln(l, wx - 6, wy - 1, wx + 4, wy - 4, R.wood[3], 2);
      fillPoly(l, [[wx + 3, wy - 6], [wx + 10, wy - 8], [wx + 9, wy - 3], [wx + 4, wy - 2]], R.metal[4]);
      // a sack of compost and a stack of pots on the lower shelf
      const [kx, ky] = p.P(3.77, 0.9, 3.8);
      ell(l, kx, ky - 6, 9, 7, '#8a7a5a');
      ell(l, kx - 2, ky - 8, 6, 4, '#a8987a');
      px(l, kx - 6, ky - 6, '#5a7a3a', 8, 2);
      const [qx, qy] = p.P(3.77, 1.55, 3.8);
      for (let q = 0; q < 4; q++) fillPoly(l, [[qx - 6, qy - 4 - q * 3], [qx + 6, qy - 4 - q * 3], [qx + 5, qy - q * 3], [qx - 5, qy - q * 3]], q & 1 ? '#c07448' : '#d48a5a');
    });
    // a water butt at the corner, fed by a downpipe that runs straight down the corner post
    const [bx, by] = p.P(A1 + 0.2, B1 - 0.12, 0);
    layer(p.c, (l) => barrelAt(l, bx, by, 10, 26));
    const [gx, gy] = p.P(A1 + 0.03, B1 + 0.02, ZW);
    const [kx, ky] = p.P(A1 + 0.03, B1 + 0.02, 15);
    layer(p.c, (l) => {
      px(l, gx - 1, gy, R.metal[3], 3, ky - gy);
      px(l, gx - 1, gy, R.metal[5], 1, ky - gy);
      ln(l, kx, ky, bx - 2, by - 28, R.metal[3], 3);
      ln(l, kx, ky - 1, bx - 2, by - 29, R.metal[5], 1);
    });
  },
};

// ── tool shed (2 × 2) ───────────────────────────────────────
const shed: PropArt = {
  draw(p, k) {
    const A0 = 0.15;
    const A1 = 1.85;
    const B0 = 0.2;
    const B1 = 1.8;
    const [sx, sy] = p.P(A1, B1, 0);
    contactShadow(p.c, sx + 10, sy - 12, 80, 30, 0.24);
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, 28, { left: boards4(R.woodGrey, 9), right: boards4(R.woodGrey, 9), edge: R.woodGrey[0] });
    const F = front(p, B1);
    const S = side(p, A1);
    door4(p, F, 0.7, 1.35, 0, 22, ['#1e3a3a', '#285050', '#346a66', '#448480', '#5aa098', '#7cbab0'], { glass: false });
    window4(p, S, 0.6, 1.3, 13, 22, { box: ['#f08a5a', '#f6d860'], panes: 4 });
    // the side wall rises with the roof: a wedge of boards up to the roof line
    const zr = (b: number) => 27 + (11 * (B1 + 0.22 - b)) / (B1 + 0.22 - (B0 - 0.18));
    const bBk = B0 - 0.08;
    poly3(p, [[A1, B1, 28], [A1, B0, 28], [A1, B0, zr(B0) - 0.2], [A1, B1, zr(B1) - 0.2]], boards4(R.woodGrey, 9), 0, [[A1, B1, 28], [A1, B0, 28], [A1, B1, 40]]);
    // mono-pitch roof sloping to the front, a barge board hanging under its edge
    const shRamp: Ramp = ['#2a3a2e', '#344a38', '#405c44', '#4e6e52', '#5e8262', '#729676'];
    quad3(p, [A0 - 0.08, B1 + 0.22, 27], [A1 - A0 + 0.16, 0, 0], [0, bBk - (B1 + 0.22), zr(bBk) - 27], shingles4(shRamp, 7, 10, R.oak), 1);
    const s0 = p.P(A1 + 0.08, B1 + 0.22, 27);
    const s1 = p.P(A1 + 0.08, bBk, zr(bBk));
    const bh = Math.round(3 * p.k);
    poly(p.c, [s0, s1, [s1[0], s1[1] + bh], [s0[0], s0[1] + bh]], mix(R.wood[1], OUTL, 0.15));
    poly(p.c, [s0, s1, [s1[0], s1[1] + 2], [s0[0], s0[1] + 2]], shRamp[3]);
    poly(p.c, [[s0[0], s0[1] + bh - 1], [s1[0], s1[1] + bh - 1], [s1[0], s1[1] + bh], [s0[0], s0[1] + bh]], OUTL);
    // tools hanging on the side wall
    layer(p.c, (l) => {
      const [tx, ty] = S.F(B1 - 0.3, 6);
      for (const [dx, h] of [[0, 46], [7, 40]] as const) ln(l, tx + dx, ty, tx + dx + 3, ty - h, R.wood[4], 2);
      px(l, tx - 4, ty - 2, R.metal[3], 9, 4);
      fillPoly(l, [[tx + 5, ty + 4], [tx + 11, ty + 4], [tx + 10, ty + 12], [tx + 6, ty + 12]], R.metal[3]);
      px(l, tx + 14, ty - 30, R.metal[2], 2, 10);
      ell(l, tx + 15, ty - 34, 5, 5, '#3a6a3a');
    });
    bedAlong(p, A0 + 0.05, 0.6, B1 + 0.15, k.seed + 2, ['#fbf7ee', '#c49cf2']);
  },
};

// ── chicken coop (2 × 2) ────────────────────────────────────
const coop: PropArt = {
  draw(p, k) {
    const [sx, sy] = p.P(1.8, 1.7, 0);
    contactShadow(p.c, sx + 6, sy - 12, 78, 30, 0.24);
    for (const [a, b] of [[0.3, 0.4], [1.7, 0.4], [0.3, 1.6], [1.7, 1.6]] as const) tbox(p, a - 0.06, b - 0.06, 0.12, 0.12, 0, 10, { left: siding4(R.wood, 30), right: siding4(R.wood, 30), top: siding4(R.wood), edge: R.wood[0] });
    tbox(p, 0.2, 0.3, 1.6, 1.4, 10, 20, { left: boards4(R.cream, 7), right: boards4(R.cream, 7), top: siding4(R.cream), edge: R.cream[0] });
    const F = front(p, 1.7);
    pq(p, F, 0.75, 1.15, 11, 21, OUTL);
    pq(p, F, 0.79, 1.11, 11, 20, '#2a1e1a');
    window4(p, side(p, 1.8), 0.7, 1.2, 20, 26, { panes: 4 });
    // nest box on the side with a lid
    tbox(p, 1.8, 0.5, 0.35, 0.7, 13, 8, { left: boards4(R.wood, 6), right: boards4(R.wood, 6), top: siding4(R.roofRed), edge: R.wood[0] });
    // ramp with slats
    const r0 = p.P(0.95, 1.7, 11);
    const r1 = p.P(0.95, 2.05, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[r0[0] - 7, r0[1]], [r0[0] + 7, r0[1]], [r1[0] + 7, r1[1]], [r1[0] - 7, r1[1]]], R.wood[3]);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        px(l, r0[0] - 7 + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t, R.wood[1], 14, 2);
      }
    });
    roof(p, 0.2, 1.8, 0.3, 1.7, 30, 42, R.roofRed, {
      oh: 0.18,
      gutter: false,
      rowH: 6,
      sw: 9,
      gable: (_bm, fill) => fill(boards4(R.cream, 7)),
    });
    // straw and a few feathers on the ground
    const [hx, hy] = p.P(1.0, 2.0, 0);
    for (let i = 0; i < 30; i++) px(p.c, hx - 24 + hash(i, 4, k.seed) * 48, hy - 3 + hash(i, 5, k.seed) * 9, R.hay[3 + (i % 3)], 3, 1);
    for (let i = 0; i < 4; i++) px(p.c, hx - 20 + hash(i, 6, k.seed) * 40, hy + hash(i, 7, k.seed) * 6, '#fbf7ee', 2, 1);
  },
};

// ── well (1 × 1) ────────────────────────────────────────────
const well: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x + 20, y + 4, 40, 14, 0.3);
    layer(p.c, (l) => {
      // round stone well: cylinder of field stones
      const rx = 34;
      const h = 30;
      for (let i = -rx; i <= rx; i++) {
        const t = (i + rx) / (2 * rx);
        const bottom = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * rx * 0.5;
        for (let j = 0; j < h; j++) {
          const yy = y + bottom - j;
          const row = Math.floor(j / 7);
          const col = Math.floor((i + 40 + (row & 1) * 5) / 10);
          const edge = (j % 7 === 0) || ((i + 40 + (row & 1) * 5) % 10 === 0);
          let tone = t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1;
          if (edge) tone = 0;
          else tone += hash(col, row, 3) > 0.6 ? 1 : 0;
          if (!edge && j < 6 && hash(col, row, 4) < 0.4) {
            px(l, x + i, yy, R.oak[2 + (tone > 2 ? 1 : 0)]);
            continue;
          }
          px(l, x + i, yy, R.stone[Math.max(0, Math.min(6, tone))]);
        }
      }
      ell(l, x, y - h, rx, rx * 0.5, R.stone[5]);
      ell(l, x, y - h + 1, rx - 5, rx * 0.5 - 3, R.water[0]);
      ell(l, x - 4, y - h + 2, rx - 14, rx * 0.5 - 8, R.water[2]);
    });
    // timber posts, crank and roof
    for (const a of [0.08, 0.92]) tbox(p, a - 0.05, 0.45, 0.1, 0.1, 7, 24, { left: siding4(R.wood, 30), right: siding4(R.wood, 30), top: siding4(R.wood), edge: R.wood[0] });
    const [cx, cy] = p.P(0.5, 0.5, 26);
    layer(p.c, (l) => {
      px(l, cx - 34, cy - 2, R.wood[2], 68, 4);
      ln(l, cx + 34, cy, cx + 42, cy + 8, R.iron[2], 2);
      ln(l, cx, cy, cx, cy + 22, '#8a7a5a');
      fillPoly(l, [[cx - 6, cy + 22], [cx + 6, cy + 22], [cx + 5, cy + 32], [cx - 5, cy + 32]], R.wood[3]);
      px(l, cx - 6, cy + 24, R.iron[2], 12, 2);
    });
    roof(p, -0.04, 1.04, 0.16, 0.84, 31, 41, R.roof, { oh: 0.1, gutter: false, rowH: 6, sw: 9, moss: true });
    void k;
  },
};

// ── pergola with roses, wisteria and string lights (4 × 3) ──
const pergola: PropArt = {
  draw(p, k) {
    const Z = 44;
    const posts: [number, number][] = [[0.15, 0.15], [3.85, 0.15], [0.15, 2.85], [3.85, 2.85]];
    for (const [a, b] of posts) tbox(p, a - 0.09, b - 0.09, 0.18, 0.18, 0, Z, { left: siding4(R.wood, 40), right: siding4(R.wood, 40), top: siding4(R.wood), edge: R.wood[0] });
    for (const b of [0.15, 2.85]) tbox(p, -0.12, b - 0.08, 4.24, 0.16, Z, 3, { left: siding4(R.wood, 40), right: siding4(R.wood, 40), top: siding4(R.wood, 40), edge: R.wood[0] });
    for (let i = 0; i < 8; i++) tbox(p, 0.05 + i * 0.55, -0.15, 0.11, 3.3, Z + 3, 2.6, { left: siding4(R.woodPale, 40), right: siding4(R.woodPale, 40), top: siding4(R.woodPale, 40), edge: R.wood[0] });
    for (const [a, b] of [[0.15, 2.85], [3.85, 2.85], [3.85, 0.15]] as const) climber(p, a, b, 2, Z - 2, k.seed * 3 + Math.round(a * 10 + b), ROSES, 0.06);
    // canopy of roses and wisteria clusters hanging between the rafters
    layer(p.c, (l) => {
      const Rn = rng(k.seed);
      const masses: Mass[] = [];
      for (let i = 0; i < 44; i++) {
        const [x, y] = p.P(0.15 + Rn() * 3.7, 0.15 + Rn() * 2.7, Z + 6);
        masses.push({ x, y, rx: 14 + Rn() * 8, ry: 8 + Rn() * 4, z: y });
      }
      foliage(l, masses, R.oak, k.seed, { cell: 3.4, dots: ROSES, dotChance: 0.45, dotSize: 4 });
      for (let i = 0; i < 14; i++) {
        const [x, y] = p.P(0.3 + Rn() * 3.4, 2.85, Z - 1);
        for (let j = 0; j < 10 + Rn() * 10; j++) px(l, x + (j % 3 === 1 ? 1 : 0), y + j, j < 4 ? '#b8a0ec' : j < 10 ? '#9a7ad8' : '#7a5ab8', 2, 1);
      }
    });
  },
  anim(p, k) {
    const u = p.k / 4;
    const Z = 40;
    for (const [a0, b0, a1, b1] of [[0.15, 2.85, 3.85, 2.85], [3.85, 2.85, 3.85, 0.15]] as const) {
      const n = 14;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const sag = Math.sin(t * Math.PI) * 7;
        const [x, y] = p.P(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, Z - sag);
        const on = Math.sin(k.t * 2 + i * 1.7) > -0.6;
        px(p.c, x, y, OUTL, Math.max(1, u), Math.max(1, u));
        px(p.c, x - u, y + u, on ? '#ffe9a8' : '#c9a55a', 3 * u, 3 * u);
        if (on) px(p.c, x, y + u, '#fffbe6', Math.max(1, u), Math.max(1, u));
      }
    }
  },
};

// ── trellis arch with roses (1 × 1) ─────────────────────────
const trellis: PropArt = {
  draw(p, k) {
    const [x0, y0] = p.P(0.1, 0.5, 0);
    const [x1, y1] = p.P(0.9, 0.5, 0);
    layer(p.c, (l) => {
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        px(l, x - 3, y - 90, R.white[4], 3, 90);
        px(l, x + 3, y - 90, R.white[3], 3, 90);
        for (let j = 6; j < 90; j += 10) px(l, x - 3, y - j, R.white[2], 9, 2);
      }
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const ax = x0 + (x1 - x0) * t;
        const ay = y0 + (y1 - y0) * t - 90 - Math.sin(t * Math.PI) * 26;
        px(l, ax - 1, ay, R.white[4], 3, 3);
      }
    });
    climber(p, 0.12, 0.5, 2, 26, k.seed * 5, ROSES, 0.05);
    climber(p, 0.88, 0.5, 2, 26, k.seed * 7, ROSES, 0.05);
    const Rn = rng(k.seed);
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9;
        masses.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - 92 - Math.sin(t * Math.PI) * 26, rx: 9 + Rn() * 4, ry: 8 + Rn() * 3, z: i });
      }
      foliage(l, masses, R.oak, k.seed, { cell: 3.2, dots: ROSES, dotChance: 0.6, dotSize: 4 });
    });
  },
};

// ── beehive, compost, raised beds ───────────────────────────
const beehive: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x + 14, y + 4, 26, 9, 0.28);
    tbox(p, 0.28, 0.28, 0.44, 0.44, 0, 2.5, { left: siding4(R.wood), right: siding4(R.wood), top: siding4(R.wood), edge: R.wood[0] });
    const ramps: Ramp[] = [R.cream, R.yellow, ['#3a5878', '#4a6a8e', '#5c80a6', '#7a9cbe', '#9ab6d2', '#c0d2e6'], ['#4a6a4a', '#5a805a', '#6e9a6e', '#88b088', '#a6c8a6', '#c8e0c8']];
    const pal = ramps[k.seed % ramps.length];
    for (let i = 0; i < 3; i++) tbox(p, 0.3, 0.3, 0.4, 0.4, 2.5 + i * 2.9, 2.8, { left: siding4(pal, 5), right: siding4(pal, 5), top: siding4(pal), edge: pal[0] });
    tbox(p, 0.26, 0.26, 0.48, 0.48, 11.2, 1.6, { left: siding4(R.roof), right: siding4(R.roof), top: siding4(R.roof, 30), edge: R.roof[0] });
    const F = front(p, 0.7);
    pq(p, F, 0.42, 0.58, 2.8, 3.6, '#1a120e');
    pq(p, F, 0.4, 0.6, 2.4, 2.8, R.wood[4]);
  },
  anim(p, k) {
    const u = p.k / 4;
    for (let i = 0; i < 6; i++) {
      const t = k.t * 2 + i * 1.7;
      const [x, y] = p.P(0.5 + Math.sin(t) * 0.6, 0.75 + Math.cos(t * 1.3) * 0.45, 12 + Math.sin(t * 2) * 8);
      px(p.c, x, y, '#2a2018', Math.max(1, 2 * u), Math.max(1, u));
      px(p.c, x, y - u, '#f2c84b', Math.max(1, u), Math.max(1, u));
    }
  },
};

const compost: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x + 14, y + 4, 30, 10, 0.28);
    tbox(p, 0.15, 0.15, 0.7, 0.7, 0, 12, { left: siding4(R.woodGrey, 5), right: siding4(R.woodGrey, 5), top: siding4(R.soil, 30), edge: R.woodGrey[0] });
    const [tx, ty] = p.P(0.5, 0.5, 12);
    layer(p.c, (l) => foliage(l, [{ x: tx, y: ty - 4, rx: 22, ry: 9, z: 1 }], ['#3a2a14', '#5a4020', '#6a7a2a', '#7a9a3a', '#98b44a', '#c8a050'], k.seed, { cell: 3, dots: ['#d8302a', '#f2b33a', '#8a5a3a'], dotChance: 0.3, dotSize: 3 }));
  },
};

const BED: Record<string, string[]> = {
  pink: ['#f29ab8', '#e8577a', '#fbf7ee', '#f6d34a'],
  yellow: ['#f6d34a', '#f08a1e', '#ffe680', '#e8577a'],
  purple: ['#a77ad8', '#c49cf2', '#fbf7ee'],
  mixed: ['#f6d34a', '#e8577a', '#fbf7ee', '#c49cf2', '#f08a1e'],
};
/** One bloom seen from above: four petals round an eye. */
function bloom(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  const hi = lighten(col, 0.22);
  const lo = darken(col, 0.18);
  px(c, x - 4, y - 1, col, 3, 3);
  px(c, x + 2, y - 1, lo, 3, 3);
  px(c, x - 1, y - 4, hi, 3, 3);
  px(c, x - 1, y + 2, lo, 3, 2);
  px(c, x - 1, y - 1, col === '#fbf7ee' ? '#f2c84b' : '#8a5a2a', 3, 3);
}
/** A plank flower box heaped with blooms (or with leafy greens and herbs). */
const raisedBed: PropArt = {
  draw(p, k) {
    const [sx, sy] = p.P(k.w, k.d / 2, 0);
    contactShadow(p.c, sx - 30, sy + 4, 60 * k.w * 0.6, 14, 0.26);
    tbox(p, 0.05, 0.08, k.w - 0.1, k.d - 0.16, 0, 10, { left: siding4(R.wood, 9), right: siding4(R.wood, 9), top: siding4(R.soil, 40), edge: R.wood[0] });
    for (const [a, b] of [[0.05, k.d - 0.08], [k.w - 0.05, k.d - 0.08], [k.w - 0.05, 0.08]] as const) {
      const [x, y] = p.P(a, b, 0);
      px(p.c, x - 2, y - 44, OUTL, 5, 44);
      px(p.c, x - 1, y - 43, R.wood[4], 3, 43);
    }
    const kind = k.variant ?? 'mixed';
    const greens = kind === 'lettuce' || kind === 'herbs';
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      const Rn = rng(k.seed);
      // heaped well above the rim, highest in the middle
      for (let i = 0; i < k.w * 22; i++) {
        const a = 0.14 + Rn() * (k.w - 0.28);
        const b = 0.18 + Rn() * (k.d - 0.36);
        const mid = 1 - Math.abs(a / k.w - 0.5) * 1.2;
        const [x, y] = p.P(a, b, 10);
        masses.push({ x, y: y - (greens ? 7 : 12) - mid * 6, rx: greens ? 12 : 13, ry: greens ? 8 : 11, z: y });
      }
      if (kind === 'lettuce') foliage(l, masses, ['#2e5a24', '#3e7a2e', '#58a03c', '#78c04c', '#a0dc68', '#c8f090'], k.seed, { cell: 4, tilt: 0.3 });
      else if (kind === 'herbs') foliage(l, masses, R.oak, k.seed, { cell: 2.6, dots: ['#c49cf2', '#fbf7ee'], dotChance: 0.35, dotSize: 3 });
      else {
        const cols = BED[kind] ?? BED.mixed;
        foliage(l, masses, R.apple, k.seed, { cell: 3, dots: cols, dotChance: 0.8, dotSize: 4 });
        // big open blooms on top of the heap
        for (let i = 0; i < k.w * 11; i++) {
          const a = 0.2 + Rn() * (k.w - 0.4);
          const b = 0.22 + Rn() * (k.d - 0.44);
          const mid = 1 - Math.abs(a / k.w - 0.5) * 1.2;
          const [x, y] = p.P(a, b, 10);
          bloom(l, Math.round(x), Math.round(y - 16 - mid * 7 - Rn() * 4), cols[i % cols.length]);
        }
      }
    });
  },
};

// ── garden furniture ────────────────────────────────────────
const armchair: PropArt = {
  draw(p, k) {
    const cush = k.color ?? '#d9a066';
    const cr: Ramp = [darken(cush, 0.45), darken(cush, 0.28), darken(cush, 0.12), cush, lighten(cush, 0.18), lighten(cush, 0.32)];
    const [x, y] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x + 12, y + 4, 26, 9, 0.24);
    const w = { left: siding4(R.woodPale, 5), right: siding4(R.woodPale, 5), top: siding4(R.woodPale, 5), edge: R.woodPale[0] };
    for (const [a, b] of [[0.22, 0.25], [0.72, 0.25], [0.22, 0.75], [0.72, 0.75]] as const) tbox(p, a, b - 0.05, 0.06, 0.06, 0, 4.5, w);
    tbox(p, 0.2, 0.2, 0.6, 0.6, 4.5, 1.6, w);
    tbox(p, 0.24, 0.26, 0.52, 0.5, 6.1, 1.6, { left: siding4(cr, 40), right: siding4(cr, 40), top: siding4(cr, 40), edge: cr[0] });
    tbox(p, 0.2, 0.14, 0.6, 0.1, 6, 10, w);
    tbox(p, 0.24, 0.24, 0.52, 0.07, 7.6, 7, { left: siding4(cr, 40), right: siding4(cr, 40), top: siding4(cr, 40), edge: cr[0] });
    for (const a of [0.13, 0.79]) tbox(p, a, 0.2, 0.08, 0.62, 9, 1.2, w);
  },
};

const cafeTable: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x + 12, y + 4, 28, 9, 0.24);
    layer(p.c, (l) => {
      px(l, x - 2, y - 30, R.iron[2], 4, 30);
      ell(l, x, y - 1, 12, 4, R.iron[1]);
      ell(l, x, y - 31, 28, 14, R.wood[1]);
      ell(l, x, y - 32, 27, 13, R.wood[3]);
      ell(l, x - 4, y - 34, 18, 8, R.wood[4]);
      for (let i = -20; i <= 20; i += 8) px(l, x + i, y - 40 + Math.abs(i) * 0.15, R.wood[2], 1, 14);
      // teapot, cups and a little vase
      ell(l, x + 4, y - 40, 7, 6, '#f2ead8');
      ell(l, x + 3, y - 41, 4, 3, '#ffffff');
      px(l, x + 10, y - 42, '#e8dcc8', 4, 2);
      px(l, x + 2, y - 47, '#c84e3e', 4, 2);
      for (const cxo of [-14, 16]) {
        px(l, x + cxo, y - 37, '#f2ead8', 5, 4);
        px(l, x + cxo + 1, y - 38, '#8a5a3a', 3, 1);
      }
      px(l, x - 6, y - 44, '#9ab8d8', 3, 6);
      dotFruit(l, x - 5, y - 47, '#f2b6c8', 4);
    });
    void k;
  },
};

const picnic: PropArt = {
  draw(p, k) {
    const [sx, sy] = p.P(1, 0.5, 0);
    contactShadow(p.c, sx + 16, sy + 4, 74, 18, 0.24);
    const w = { left: siding4(R.wood, 4), right: siding4(R.wood, 4), top: siding4(R.wood, 5), edge: R.wood[0] };
    const benchAt = (b: number) => {
      for (const a of [0.3, 1.7]) tbox(p, a - 0.03, b + 0.05, 0.06, 0.07, 0, 4.2, w);
      tbox(p, 0.18, b, 1.64, 0.17, 4.2, 1.2, w);
    };
    benchAt(0.03);
    // A-frame trestles with a rail that also carries the benches
    for (const a of [0.36, 1.64]) {
      tbox(p, a - 0.035, 0.05, 0.07, 0.9, 3.4, 0.8, w);
      for (const [b0, b1] of [[0.38, 0.15], [0.62, 0.85]] as const) {
        const t0 = p.P(a, b0, 8.6);
        const t1 = p.P(a, b1, 0);
        ln(p.c, t0[0], t0[1], t1[0], t1[1], R.wood[1], 5);
        ln(p.c, t0[0] - 2, t0[1], t1[0] - 2, t1[1], R.wood[3], 2);
      }
    }
    tbox(p, 0.06, 0.32, 1.88, 0.36, 8.6, 1.1, w);
    // gingham runner, a jug of lemonade, a bowl of plums
    layer(p.c, (l) => {
      for (let i = 0; i < 14; i++)
        for (let j = 0; j < 3; j++) {
          const [x, y] = p.P(0.45 + i * 0.075, 0.38 + j * 0.09, 9.75);
          px(l, x, y, (i + j) % 2 ? '#d84a3a' : '#fbf4e4', 4, 2);
        }
      const [jx, jy] = p.P(1.4, 0.48, 9.8);
      px(l, jx - 4, jy - 14, '#e8e2b8', 8, 14);
      px(l, jx - 3, jy - 8, '#f2d860', 6, 7);
      px(l, jx + 4, jy - 12, '#d8d2a8', 3, 6);
      const [bx, by] = p.P(0.8, 0.5, 9.8);
      ell(l, bx, by - 3, 9, 4, '#f2ead8');
      for (let i = 0; i < 6; i++) dotFruit(l, bx - 6 + i * 2.4, by - 5 - (i & 1), '#7e4aa0', 4);
    });
    benchAt(0.8);
    void k;
  },
};

// ── courtyard fountain (2 × 2) ──────────────────────────────
// A round stone basin with a moulded coping, clear water with a sky glint and
// coins on the bottom, a fluted pedestal carrying two tazze and a pinecone
// finial; water spills from bowl to bowl into the basin (animated).
const fountainGeom = (p: PropPainter) => {
  // sized to its footprint (designed for 2×2, drawn larger on a bigger square)
  const K = (p.k / 4) * (p.pw / 2);
  const [cx, cy] = p.P(p.pw / 2, p.pd / 2, 0);
  return {
    K,
    cx: Math.round(cx),
    cy: Math.round(cy),
    rxo: 98 * K,
    ryo: 49 * K,
    rxi: 82 * K,
    ryi: 41 * K,
    H: Math.round(22 * K),
    WL: Math.round(5 * K),
    h1: Math.round(54 * K),
    h2: Math.round(86 * K),
    r1: 36 * K,
    r2: 19 * K,
  };
};

const farmFountain: PropArt = {
  draw(p, k) {
    const g = fountainGeom(p);
    const { K, cx, cy, rxo, ryo, rxi, ryi, H, WL, h1, h2, r1, r2 } = g;
    const Rn = rng(k.seed * 7 + 3);
    contactShadow(p.c, cx + 28 * K, cy + 8 * K, rxo + 16 * K, ryo * 0.72, 0.3);
    layer(p.c, (l) => {
      const ct = cy - H; // centre of the coping ring
      const cw = cy - H + WL; // centre of the water surface
      // the far inner wall above the water line (wet stone, a dark water line)
      for (let y = Math.floor(ct - ryi - 2); y <= cw; y++)
        for (let x = Math.floor(cx - rxi); x <= cx + rxi; x++) {
          const dt = ((x - cx) / rxi) ** 2 + ((y - ct) / ryi) ** 2;
          const dw = ((x - cx) / rxi) ** 2 + ((y - cw) / ryi) ** 2;
          if (dt > 1 || dw <= 1 || y > cw) continue;
          const near = dw < 1.18;
          px(l, x, y, near ? R.stone[1] : R.stone[2 + (hash(x >> 2, y >> 1, 41) < 0.3 ? 1 : 0)]);
        }
      // water: deeper in the middle, the sky caught on the far side, ripples, coins
      for (let y = Math.floor(cw - ryi); y <= cw + ryi; y++)
        for (let x = Math.floor(cx - rxi); x <= cx + rxi; x++) {
          const dx = (x - cx) / rxi;
          const dy = (y - cw) / ryi;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          let i = d > 0.75 ? 3 : d > 0.35 ? 2 : 1;
          if (dy < -0.45 && dx > -0.6 && dx < 0.35 && (x + y * 2) % 7 < 3) i = 5;
          const ring = Math.sqrt(d) * 9 - 2.2;
          if (Math.abs(ring - Math.round(ring)) < 0.08 && hash(x >> 2, y, 43) < 0.7) i += 1;
          px(l, x, y, R.water[Math.min(6, i)]);
        }
      for (let n = 0; n < 9; n++) {
        const a = Rn() * Math.PI * 2;
        const r = 0.35 + Rn() * 0.5;
        const x = cx + Math.cos(a) * rxi * r;
        const y = cw + Math.sin(a) * ryi * r;
        px(l, x, y, '#c8962a', 2, 1);
        px(l, x, y - 1, '#f2d26a');
      }
      // the coping: a moulded ring of cut stones with joints and a lit inner lip
      for (let y = Math.floor(ct - ryo - 3); y <= ct + ryo + 3; y++)
        for (let x = Math.floor(cx - rxo - 3); x <= cx + rxo + 3; x++) {
          const dx = x - cx;
          const dy = y - ct;
          const dO = (dx / (rxo + 2)) ** 2 + (dy / (ryo + 1.5)) ** 2;
          const dI = (dx / rxi) ** 2 + (dy / ryi) ** 2;
          if (dO > 1 || dI <= 1) continue;
          const ang = Math.atan2(dy / ryo, dx / rxo);
          const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 18);
          const joint = Math.abs(((ang + Math.PI) / (Math.PI * 2)) * 18 - Math.round(((ang + Math.PI) / (Math.PI * 2)) * 18)) < 0.04;
          let t = 4 + (hash(seg, 1, 45) < 0.35 ? -1 : 0);
          if (dI < 1.12) t = dy < 0 ? 3 : 5;
          if (dO > 0.86) t -= 1;
          if (joint) t = 2;
          px(l, x, y, R.stoneWarm[Math.max(0, Math.min(6, t))]);
        }
      // the outer wall of the basin, block courses lit from the left, moss at the foot
      for (let x = Math.floor(cx - rxo - 2); x <= cx + rxo + 2; x++) {
        const u = (x - cx) / (rxo + 2);
        if (Math.abs(u) > 1) continue;
        const yb = cy + (ryo + 1.5) * Math.sqrt(1 - u * u);
        const yt = ct + (ryo + 1.5) * Math.sqrt(1 - u * u);
        for (let y = Math.round(yt); y <= yb; y++) {
          const j = yb - y;
          const row = Math.floor(j / (7 * K));
          const col = Math.floor((x - cx + rxo + (row & 1) * 6 * K) / (13 * K));
          const mortar = j % (7 * K) < 1 || (x - cx + rxo + (row & 1) * 6 * K) % (13 * K) < 1;
          let t = u < -0.45 ? 4 : u < 0.05 ? 3 : u < 0.55 ? 2 : 1;
          t += hash(col, row, 47) < 0.3 ? 1 : 0;
          if (mortar) t = Math.max(0, t - 2);
          if (j < 3 && hash(x, row, 48) < 0.5) {
            px(l, x, y, R.oak[2 + (t > 2 ? 1 : 0)]);
            continue;
          }
          if (y - yt < 2) t += 1;
          px(l, x, y, R.stoneWarm[Math.max(0, Math.min(6, t))]);
        }
      }
    });
    // pedestal: plinth in the water, a fluted column, the lower tazza, a slimmer stem, the upper tazza, a pinecone
    layer(
      p.c,
      (l) => {
        const base = cy - H + WL;
        const col = (x0: number, yb: number, yt: number, rx: number) => {
          for (let i = -rx; i <= rx; i++) {
            const t = (i + rx) / (2 * rx);
            const flute = Math.round(i + rx) % 4 === 0;
            const tone = (t < 0.3 ? 5 : t < 0.6 ? 4 : t < 0.85 ? 3 : 2) - (flute ? 1 : 0);
            const off = Math.sqrt(Math.max(0, 1 - (i / rx) ** 2)) * rx * 0.4;
            px(l, x0 + i, yt + off, R.stone[tone], 1, yb - yt);
          }
        };
        // plinth
        for (let i = -12 * K; i <= 12 * K; i++) {
          const off = Math.sqrt(Math.max(0, 1 - (i / (12 * K)) ** 2)) * 5 * K;
          px(l, cx + i, base - 6 * K + off, R.stone[i < -3 ? 5 : i < 5 ? 4 : 2], 1, 6 * K);
        }
        ell(l, cx, base - 6 * K, 12 * K, 5 * K, R.stone[5]);
        col(cx, base - 6 * K, cy - h1 + 6 * K, 5 * K);
        // lower tazza: a shallow dish (underside shaded), a rim, water inside
        const bowl = (yy: number, r: number, depth: number) => {
          for (let i = -r; i <= r; i++) {
            const u = i / r;
            const top = yy + Math.sqrt(Math.max(0, 1 - u * u)) * r * 0.45;
            const bot = yy + Math.sqrt(Math.max(0, 1 - u * u)) * (r * 0.45 + depth);
            const tone = u < -0.4 ? 5 : u < 0.2 ? 4 : u < 0.6 ? 3 : 2;
            px(l, cx + i, top, R.stone[tone], 1, Math.max(1, bot - top));
          }
          ell(l, cx, yy, r + 1, (r + 1) * 0.45, R.stone[5]);
          ell(l, cx, yy, r - 2 * K, (r - 2 * K) * 0.45, R.stone[3]);
          ell(l, cx, yy + 1, r - 3 * K, (r - 3 * K) * 0.45 - 1, R.water[3]);
          ell(l, cx - r * 0.25, yy, r * 0.35, r * 0.1, R.water[5]);
        };
        bowl(cy - h1, r1, 8 * K);
        col(cx, cy - h1 - 2, cy - h2 + 4 * K, 3 * K);
        bowl(cy - h2, r2, 5 * K);
        // pinecone finial
        const fy = cy - h2 - 8 * K;
        ell(l, cx, fy + 3 * K, 3 * K, 1.5 * K, R.stone[3]);
        for (let j = 0; j < 9 * K; j++) {
          const w = Math.max(1, Math.round((4.5 * K) * Math.sin((j / (9 * K)) * Math.PI) + 0.5));
          px(l, cx - w, fy - j, R.stone[4], w, 1);
          px(l, cx, fy - j, R.stone[j % 3 === 0 ? 2 : 3], w, 1);
          if (j % 3 === 1) px(l, cx - w + 1, fy - j, R.stone[6]);
        }
      },
      { outline: 0.62 },
    );
    // water spilling from the upper tazza into the lower one, and from the lower into the basin
    const spill = (yy: number, r: number, drop: number, n: number, alpha: number) => {
      p.c.globalAlpha = alpha;
      for (let q = 0; q < n; q++) {
        const ang = Math.PI * (0.08 + (0.84 * q) / Math.max(1, n - 1));
        const x0 = cx + Math.cos(ang) * r;
        const y0 = yy + Math.sin(ang) * r * 0.45;
        for (let j = 0; j < drop; j++) {
          const t = j / drop;
          px(p.c, x0 + Math.cos(ang) * t * t * 6 * K, y0 + j, j % 5 === 0 ? R.water[6] : R.water[5], 1, 1);
        }
      }
      p.c.globalAlpha = 1;
    };
    spill(cy - h2, r2 - 1, h2 - h1 - 4 * K, 7, 0.55);
    spill(cy - h1, r1 - 1, h1 - H + WL - 8 * K, 13, 0.45);
  },
  anim(p, k) {
    const g = fountainGeom(p);
    const { K, cx, cy, rxi, ryi, H, WL, h1, h2, r1, r2 } = g;
    // drops riding the spill and rings spreading where they land
    const drops = (yy: number, r: number, drop: number, n: number, off: number) => {
      for (let q = 0; q < n; q++) {
        const ang = Math.PI * (0.08 + (0.84 * q) / Math.max(1, n - 1));
        const t = (k.t * 1.6 + q * 0.37 + off) % 1;
        const x = cx + Math.cos(ang) * r + Math.cos(ang) * t * t * 6 * K;
        const y = yy + Math.sin(ang) * r * 0.45 + t * drop;
        px(p.c, x, y, '#ffffff', Math.max(1, K), Math.max(1, 2 * K));
      }
    };
    drops(cy - h2, r2 - 1, h2 - h1 - 4 * K, 7, 0);
    drops(cy - h1, r1 - 1, h1 - H + WL - 8 * K, 13, 0.5);
    const cw = cy - H + WL;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.5 + i / 3) % 1;
      const rr = 0.35 + t * 0.6;
      p.c.globalAlpha = 0.5 * (1 - t);
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        px(p.c, cx + Math.cos(ang) * rxi * rr, cw + Math.sin(ang) * ryi * rr, '#d8f2f8', Math.max(1, 2 * K), Math.max(1, K));
      }
    }
    p.c.globalAlpha = 1;
  },
};

// at night the farmhouse windows are lit: front and side, both floors (see its draw)
farmhouse.lights = () => [
  ...[1.15, 6.9].map((a) => ({ a, b: 4.5, z: 18, r: 1.4, kind: 'window' as const })),
  ...[1.15, 3.05, 4.95, 6.9].map((a) => ({ a, b: 4.5, z: 36, r: 1.2, kind: 'window' as const })),
  ...[1.5, 3.5].flatMap((b) => [
    { a: 7.7, b, z: 18, r: 1.4, kind: 'window' as const },
    { a: 7.7, b, z: 35, r: 1.2, kind: 'window' as const },
  ]),
];

export const BUILDINGS4: Record<string, PropArt> = { farmhouse, barn, greenhouse2, shed, coop, well, pergola, trellis, beehive, compost, raisedBed, armchair, cafeTable, picnic, farmFountain };

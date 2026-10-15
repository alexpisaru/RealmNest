// Factory — the works yard and the rail spur (1 z ≈ 10 cm; a person is ~17.5 z).
//   fac_lorry      an articulated lorry backed onto a dock: box trailer in the works' livery
//   fac_wagon      freight wagons on the spur: 'van' · 'open' (coal) · 'tank' · 'coil'
//   fac_rail       a length of track (flat: sleepers and rails over the ballast)
//   fac_buffer     the buffer stop at the end of the spur
//   fac_forklift   a counterbalance truck with a pallet up on its forks
//   fac_pallets    pallets: empty stacks, sacks of cement, strapped bricks, a broken one
//   fac_cylinders  a mesh cage of gas bottles · fac_skip  a steel builder's skip of rubble (drawSkip)
//   fac_ibc        a 1000-litre tote · fac_drums  oil drums on a pallet
//   fac_lamp       a yard floodlight on its column · fac_hut  the gatehouse
//   fac_van        a works van · fac_coal  the boiler house's coal heap
//   fac_sign       the estate's signboard · fac_tyres  a heap of old tyres
//   fac_car        an abandoned car on bricks, gone to rust
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { planeText } from './font';
import { at, BRICK, brick, CONC, corrugated, GLASS, IRON, OLDWOOD, planks, RED, RUST, SHEET, STEEL, TIMBER, visA, WEED, YELLOW } from './palette';

const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const ramp = (c: string): Ramp => [darken(c, 0.55), darken(c, 0.38), darken(c, 0.2), c, lighten(c, 0.16), lighten(c, 0.3)];
const TYRE: Ramp = ['#121014', '#1c1a20', '#26242c', '#323038', '#403e48'];

// ── track and the buffer stop ───────────────────────────────
const fac_rail: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const along = (b: number, z = 0) => [p.P(0, b, z), p.P(W, b, z)] as const;
    // sleepers across the track, the ballast shoulder between them is the ground
    for (let a = 0.12; a < W; a += 0.36) {
      const q = [p.P(a, 0.12, 0), p.P(a + 0.16, 0.12, 0), p.P(a + 0.16, D - 0.12, 0), p.P(a, D - 0.12, 0)];
      fillPoly(c, q, hash(Math.round(a * 10), 1, k.seed) < 0.2 ? '#4a3a2a' : '#3a2e24');
      const r = [p.P(a, 0.12, 0), p.P(a + 0.16, 0.12, 0), p.P(a + 0.16, 0.16, 0), p.P(a, 0.16, 0)];
      fillPoly(c, r, '#5a4834');
    }
    // the two rails: a dark web, a bright running top, chairs at the sleepers
    for (const b of [D * 0.3, D * 0.7]) {
      const [a0, a1] = along(b, 0.6);
      const [g0, g1] = along(b, 0);
      ln(c, g0[0], g0[1], g1[0], g1[1], '#2a2428', 2);
      ln(c, a0[0], a0[1] + 1, a1[0], a1[1] + 1, '#4a4448', 1);
      ln(c, a0[0], a0[1], a1[0], a1[1], '#c8c4c0', 1);
      for (let a = 0.12; a < W; a += 0.36) {
        const [x, y] = p.P(a + 0.08, b, 0);
        px(c, x - 2, y - 1, '#2a2428', 4, 3);
      }
    }
    // rust dust and weeds between the rails
    const Rn = rng(k.seed + 5);
    for (let i = 0; i < 6; i++) {
      const [x, y] = p.P(Rn() * W, D * (0.35 + Rn() * 0.3), 0);
      px(c, x, y - 2, WEED[3], 2, 2);
      px(c, x + 1, y - 4, WEED[4], 1, 2);
    }
  },
};

const fac_buffer: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, k.d - 0.1, 10, 0.28);
    const D = k.d;
    // the frame: bent rails rising to a cross beam, painted red and white, two buffers facing +a
    lbox(p, 0.2, 0.15, 0.25, D - 0.3, 0, 1.2, mono(flat(OLDWOOD, 2, 1, 3), OLDWOOD[0]));
    for (const b of [D * 0.3, D * 0.7]) {
      const [x0, y0] = p.P(0.1, b, 0);
      const [x1, y1] = p.P(0.75, b, 7);
      ln(p.c, x0, y0, x1, y1, '#4a4448', 3);
    }
    const beam: Mat = (light) => (u) => (Math.floor(u / 10) & 1 ? (light ? '#f2eee2' : '#c8c4b8') : RED[light ? 3 : 2]);
    lbox(p, 0.62, 0.1, 0.22, D - 0.2, 4.6, 3.6, { front: beam, side: beam, top: flat(RED, 4, 3, 4), edge: RED[0] });
    for (const b of [D * 0.3, D * 0.7]) {
      const [x, y] = p.P(0.9, b, 6.4);
      layer(p.c, (l) => {
        px(l, x - 4, y - 3, IRON[3], 8, 6);
        ell(l, x + 4, y, 4, 6, IRON[2]);
        ell(l, x + 4, y, 3, 5, '#5a5660');
      }, { outline: 0.6, rect: [x - 6, y - 8, x + 10, y + 8] });
    }
    const [lx, ly] = p.P(0.7, D / 2, 8.2);
    px(p.c, lx - 1, ly - 10, IRON[3], 2, 10);
    px(p.c, lx - 3, ly - 15, '#2a2a30', 6, 5);
    px(p.c, lx - 2, ly - 14, '#e2402e', 4, 3);
  },
};

// ── pallets and stock ───────────────────────────────────────
function palletBox(p: PropPainter, a0: number, b0: number, w: number, d: number, z: number) {
  const pl = planks(TIMBER, 3);
  lbox(p, a0, b0, w, d, z, 1.3, { front: (light) => (u, v) => ((u % 30 > 6 && u % 30 < 24 && v < 4) ? '#2a2018' : at(TIMBER, (light ? 3 : 2) + (v > 4 ? 0.6 : 0))), side: (light) => (u, v) => ((u % 30 > 6 && u % 30 < 24 && v < 4) ? '#2a2018' : at(TIMBER, (light ? 2.6 : 1.6) + (v > 4 ? 0.6 : 0))), top: pl, edge: TIMBER[0] });
}

const fac_pallets: PropArt = {
  draw(p, k) {
    const v = k.variant ?? ['stack', 'sacks', 'bricks', 'stack', 'broken'][k.seed % 5];
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 10, 0.28);
    if (v === 'stack') {
      const n = 6 + (k.seed % 5);
      for (let i = 0; i < n; i++) palletBox(p, 0.1 + ((i * 7 + k.seed) % 3) * 0.015, 0.1 + ((i * 5) % 3) * 0.012, 0.8, 0.8, i * 1.3);
      return;
    }
    palletBox(p, 0.1, 0.1, 0.8, 0.8, 0);
    if (v === 'sacks') {
      // bagged cement in layers, a torn one spilling
      for (let l = 0; l < 4; l++)
        for (let i = 0; i < 2; i++) {
          const rot = (l + i) % 2;
          const a0 = rot ? 0.14 + i * 0.37 : 0.14;
          const b0 = rot ? 0.14 : 0.14 + i * 0.37;
          lbox(p, a0, b0, rot ? 0.34 : 0.72, rot ? 0.72 : 0.34, 1.3 + l * 1.3, 1.3, mono((light) => (u, vv) => at(['#7a7468', '#948e80', '#aca698', '#c4beb0', '#d8d2c4'], (light === 2 ? 3.2 : light ? 2.6 : 1.8) + (vv < 1.5 ? -0.8 : 0) + (u % 22 < 1 ? -0.5 : 0)), '#5a5448'));
        }
      const F = front(p, 0.86);
      pq(p, F, 0.3, 0.6, 3.2, 4.2, '#c8382a');
      planeText(p.c, F, 0.45, 5.6, 'CEMENT', '#3a3a40', 1);
    } else if (v === 'bricks') {
      // strapped packs of red bricks
      const b: Mat = brick(BRICK, { course: 3 });
      lbox(p, 0.14, 0.14, 0.72, 0.72, 1.3, 5.4, mono(b, BRICK[0]));
      const F = front(p, 0.861);
      for (const a of [0.3, 0.7]) pq(p, F, a, a + 0.03, 1.3, 6.7, '#2a2a30');
    } else {
      // a broken pallet leaning on the stack, loose boards
      palletBox(p, 0.1, 0.1, 0.8, 0.8, 1.3);
      const [x, y] = anchor(p, 0.75, 0.9, 0);
      layer(p.c, (l) => {
        fillPoly(l, [[x - 18, y], [x - 6, y - 26], [x + 2, y - 24], [x - 10, y + 2]], TIMBER[3]);
        for (let i = 0; i < 4; i++) ln(l, x - 16 + i * 3, y - i * 7, x - 6 + i * 3, y - 4 - i * 7, TIMBER[1]);
        ln(l, x + 4, y + 2, x + 18, y - 4, TIMBER[4], 2);
      }, { outline: 0.6, rect: [x - 22, y - 30, x + 22, y + 6] });
    }
  },
};

const fac_cylinders: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.95, 16, 0.28);
    lbox(p, 0.05, 0.1, W - 0.1, 0.85, 0, 0.5, mono(flat(CONC, 3, 2, 4), CONC[0]));
    // the bottles chained to the back rail: black-shouldered oxygen, maroon acetylene, red propane
    const kinds = [['#1e1e22', '#e8e4dc'], ['#6a1e2a', '#6a1e2a'], ['#c8302a', '#c8302a'], ['#1e1e22', '#e8e4dc'], ['#2a5a3a', '#2a5a3a']];
    for (let i = 0; i < Math.round(W * 4); i++) {
      const a = 0.2 + i * ((W - 0.4) / Math.max(1, Math.round(W * 4) - 1));
      const b = 0.35 + (i % 2) * 0.22;
      const [x, y] = p.P(a, b, 0.5);
      const [body, shoulder] = kinds[(i + k.seed) % kinds.length];
      layer(p.c, (l) => {
        for (let j = 0; j < 58; j++) {
          const w = j > 54 ? 5 - (j - 54) : 5;
          for (let q = -w; q < w; q++) {
            const t = (q + w) / (2 * w);
            const col = j > 46 ? shoulder : body;
            px(l, x + q, y - j, t < 0.3 ? lighten(col, 0.25) : t < 0.7 ? col : darken(col, 0.3));
          }
        }
        px(l, x - 2, y - 62, STEEL[4], 4, 4);
      }, { outline: 0.6, rect: [x - 8, y - 66, x + 8, y + 2] });
    }
    // the mesh cage and its roof
    const F = front(p, 0.95);
    pt(p, F, 0.05, W - 0.05, 0.5, 17.5, (u: number, v: number) => ((u % 6 < 1 || v % 6 < 1) ? (F.light ? '#9a9ea2' : '#7a7e82') : null), F.light);
    const S = side(p, visA(p, 0.05, W - 0.05));
    pt(p, S, 0.1, 0.95, 0.5, 17.5, (u: number, v: number) => ((u % 6 < 1 || v % 6 < 1) ? (S.light ? '#9a9ea2' : '#7a7e82') : null), S.light);
    for (const a of [0.05, W - 0.05]) lbox(p, a - 0.03, 0.92, 0.06, 0.06, 0, 17.5, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
    lbox(p, 0, 0.05, W, 0.95, 17.5, 0.5, mono(corrugated(SHEET, 0.4, 5), SHEET[0]));
    pq(p, front(p, 0.96), W / 2 - 0.35, W / 2 + 0.35, 12, 15, '#f2eee2');
    const [hx, hy] = front(p, 0.97).F(W / 2 - 0.15, 13.5);
    fillPoly(p.c, [[hx, hy - 5], [hx + 5, hy], [hx, hy + 5], [hx - 5, hy]], '#2a8a4a');
    const [fx2, fy2] = front(p, 0.97).F(W / 2 + 0.15, 13.5);
    fillPoly(p.c, [[fx2, fy2 - 5], [fx2 + 5, fy2], [fx2, fy2 + 5], [fx2 - 5, fy2]], RED[3]);
  },
};

type V3 = [number, number, number];
const T16 = 16;
const quad3 = (p: PropPainter, pts: V3[], col: string) => fillPoly(p.c, pts.map(([a, b, z]) => p.P(a, b, z)), col);
function line3y(p: PropPainter, A: V3, B: V3, col: string, w = 1) {
  const [x0, y0] = p.P(...A);
  const [x1, y1] = p.P(...B);
  ln(p.c, x0, y0, x1, y1, col, w);
}

/**
 * A builder's skip (steel, about 3.6 m over the top) with its long sides along a, its corner at
 * (a0, b0): a trapezoid body, the ends sloping out to the rim, box-section ribs, a rolled rim, lifting
 * lugs on the long sides, tipping hooks on the end, a hazard band, rust and scrapes, rubble heaped inside.
 */
export function drawSkip(p: PropPainter, a0: number, b0: number, L: number, D: number, seed: number, paint = '#e4ae22', H = 13) {
  const Y: Ramp = [darken(paint, 0.62), darken(paint, 0.45), darken(paint, 0.28), darken(paint, 0.12), paint, lighten(paint, 0.2), lighten(paint, 0.42)];
  const R = rng(seed * 977 + 13);
  const at0 = a0 + 0.04;
  const at1 = a0 + L - 0.04;
  const ab0 = a0 + L * 0.19;
  const ab1 = a0 + L * 0.81;
  const bs0 = b0 + 0.08;
  const bs1 = b0 + D - 0.08;
  /** the ends' a at height z */
  const e0 = (z: number) => ab0 + (at0 - ab0) * (z / H);
  const e1 = (z: number) => ab1 + (at1 - ab1) * (z / H);
  // a dark contact shadow under the floor and the runners
  quad3(p, [[ab0 - 0.06, bs0 + 0.05, 0], [ab1 + 0.18, bs0 + 0.05, 0], [ab1 + 0.22, bs1 + 0.1, 0], [ab0 - 0.02, bs1 + 0.1, 0]], '#1a1216');
  // ── inside: the far wall's and the back end's inner faces, then the rubble
  const F0 = H - 4;
  quad3(p, [[at0, bs0, H], [at1, bs0, H], [at1, bs1, H], [at0, bs1, H]], '#2a2220');
  quad3(p, [[at0, bs0 + 0.03, H], [at1, bs0 + 0.03, H], [e1(F0), bs0 + 0.03, F0], [e0(F0), bs0 + 0.03, F0]], Y[1]);
  quad3(p, [[at0 + 0.03, bs0, H], [at0 + 0.03, bs1, H], [e0(F0) + 0.03, bs1, F0], [e0(F0) + 0.03, bs0, F0]], Y[3]);
  // weathering on the inner far wall: rust runs
  for (let i = 0; i < 10; i++) {
    const a = at0 + 0.2 + R() * (at1 - at0 - 0.4);
    const [x, y] = p.P(a, bs0 + 0.03, H - 0.6);
    for (let j = 0; j < 2 + Math.floor(R() * 5); j++) px(p.c, x, y + j * 2, RUST[2 + (j & 1)], 1, 2);
  }
  // the far rim and the back rim, lit along their tops
  line3y(p, [at0, bs0, H], [at1, bs0, H], Y[5], 2);
  line3y(p, [at0, bs0, H], [at0, bs1, H], Y[5], 2);
  // the rubble: a floor of grit, then broken brick, block, timber, a pipe, plasterboard, heaped to the middle
  quad3(p, [[e0(F0) + 0.04, bs0 + 0.04, F0], [e1(F0) - 0.02, bs0 + 0.04, F0], [e1(F0) - 0.02, bs1 - 0.02, F0], [e0(F0) + 0.04, bs1 - 0.02, F0]], '#4a3e36');
  const bits: [number, number, number, number, number][] = [];
  const am = (at0 + at1) / 2;
  for (let i = 0; i < 140; i++) {
    const a = e0(F0) + 0.08 + R() * (e1(F0) - e0(F0) - 0.14);
    const b = bs0 + 0.08 + R() * (bs1 - bs0 - 0.14);
    const fa = (a - am) / ((at1 - at0) / 2);
    const fb = (b - (bs0 + bs1) / 2) / ((bs1 - bs0) / 2);
    const h = F0 + 7.5 * (1 - fa * fa * 1.05) * (1 - fb * fb * 0.8) + (R() - 0.5) * 1.2;
    bits.push([a, b, Math.max(F0 + 0.4, h), R(), R()]);
  }
  bits.sort((m, o) => m[0] + m[1] + m[2] / T16 - (o[0] + o[1] + o[2] / T16));
  for (const [a, b, z, t, u] of bits) {
    const [x, y] = p.P(a, b, z);
    if (t < 0.36) {
      // a broken brick: a lit top, a darker face
      const c = at(BRICK, 2.6 + u * 2.4);
      px(p.c, x - 3, y - 2, darken(c, 0.25), 7, 4);
      px(p.c, x - 3, y - 3, c, 7, 2);
    } else if (t < 0.52) {
      // a lump of concrete block or plaster
      px(p.c, x - 4, y - 3, at(CONC, 2 + u * 2), 8, 5);
      px(p.c, x - 4, y - 4, at(CONC, 4.4 + u), 8, 2);
    } else if (t < 0.68) {
      // a length of timber
      const dx = u < 0.5 ? 12 : -12;
      ln(p.c, x, y, x + dx, y - 6, at(TIMBER, 1.6), 3);
      ln(p.c, x, y - 1, x + dx, y - 7, at(TIMBER, 4), 1);
    } else if (t < 0.78) {
      // a bent pipe or rebar
      ln(p.c, x - 8, y + 2, x + 8, y - 5, '#3a3a42', 2);
      ln(p.c, x - 8, y + 1, x + 8, y - 6, '#9a9aa2', 1);
    } else if (t < 0.88) {
      // a shard of plasterboard
      fillPoly(p.c, [[x - 6, y], [x + 5, y - 4], [x + 7, y - 1], [x - 4, y + 3]], '#e8e2d6');
      ln(p.c, x - 4, y + 3, x + 7, y - 1, '#b0a898');
    } else {
      // grit and soil
      px(p.c, x - 3, y - 1, '#5a4c40', 6, 3);
      px(p.c, x - 2, y - 2, '#7a6a58', 3, 1);
    }
  }
  if (R() < 0.7) {
    // a traffic cone thrown on top
    const [x, y] = p.P(am + 0.3, (bs0 + bs1) / 2, F0 + 6.4);
    fillPoly(p.c, [[x - 5, y], [x + 5, y], [x + 1, y - 18], [x - 1, y - 18]], '#e8642a');
    px(p.c, x - 3, y - 11, '#f2eee2', 6, 3);
    px(p.c, x - 7, y - 1, '#2a2a2e', 14, 2);
  }
  // ── outside: the +a end (sloping out over its foot, so in shade), then the near long side
  const endMat: Mat = (light) => (u, v, x, y) => {
    if (v > 26 && v < 40) return Math.floor((u + v) / 7) & 1 ? '#22201e' : light ? '#f6cc30' : Y[4];
    if (hash(x >> 1, y >> 1, seed + 4) < 0.06) return at(RUST, 2);
    return at(Y, 1.6 + (hash(x >> 2, y >> 2, seed + 3) < 0.1 ? -0.8 : 0));
  };
  poly3(p, [[ab1, bs1, 0], [ab1, bs0, 0], [at1, bs0, H], [at1, bs1, H]], endMat, 0, [[ab1, bs1, 0], [ab1, bs0, 0], [at1, bs1, H]]);
  // two box ribs down the end, the tipping hooks at its foot
  for (const b of [bs0 + (bs1 - bs0) * 0.28, bs0 + (bs1 - bs0) * 0.72]) {
    quad3(p, [[ab1, b - 0.04, 0.4], [ab1, b + 0.04, 0.4], [at1 + 0.02, b + 0.04, H - 1.2], [at1 + 0.02, b - 0.04, H - 1.2]], Y[2]);
    line3y(p, [ab1 + 0.005, b + 0.04, 0.4], [at1 + 0.025, b + 0.04, H - 1.2], Y[3]);
    const [hx, hy] = p.P(ab1 + 0.04, b, 2);
    px(p.c, hx - 2, hy - 4, IRON[2], 5, 5);
    px(p.c, hx - 1, hy - 1, IRON[4], 3, 1);
  }
  // the near side: a plate, rust bleeding at the foot, dents in shadow, bright gouges to bare steel
  const sideMat: Mat = (light) => (u, v, x, y) => {
    let i = light ? 3.6 : 2.4;
    const n = hash(x >> 2, y >> 2, seed + 7);
    if (v < 8 && hash(x >> 1, y >> 1, seed + 8) < (8 - v) / 12) return at(RUST, 2 + (n < 0.5 ? 1 : 0));
    if (n < 0.03) return at(RUST, 3);
    if (hash(Math.floor((u + v * 0.6) / 4), Math.floor(v / 3), seed + 9) < 0.025) return '#c8c4bc';
    if (hash(Math.floor(u / 14), Math.floor(v / 10), seed + 10) < 0.12) i -= 0.9;
    if (v > 46) i += 0.6;
    return at(Y, i);
  };
  poly3(p, [[ab0, bs1, 0], [ab1, bs1, 0], [at1, bs1, H], [at0, bs1, H]], sideMat, 1, [[at0, bs1, 0], [at1, bs1, 0], [at0, bs1, H]]);
  // the runners under the floor, showing at the foot
  lbox(p, ab0 - 0.04, bs1 - 0.14, ab1 - ab0 + 0.08, 0.1, 0, 0.9, mono(flat(IRON, 2, 1, 3), IRON[0]));
  // vertical box ribs, lit on their faces, dark on their right flanks
  const nr = 4;
  for (let i = 1; i <= nr; i++) {
    const t = i / (nr + 1);
    const a = ab0 + (ab1 - ab0) * t;
    const aT = at0 + (at1 - at0) * t;
    quad3(p, [[a - 0.05, bs1 + 0.04, 0.6], [a + 0.05, bs1 + 0.04, 0.6], [aT + 0.05, bs1 + 0.04, H - 1.4], [aT - 0.05, bs1 + 0.04, H - 1.4]], Y[4]);
    quad3(p, [[a + 0.05, bs1 + 0.04, 0.6], [a + 0.08, bs1, 0.6], [aT + 0.08, bs1, H - 1.4], [aT + 0.05, bs1 + 0.04, H - 1.4]], Y[1]);
    line3y(p, [a - 0.05, bs1 + 0.04, 0.6], [aT - 0.05, bs1 + 0.04, H - 1.4], Y[5]);
  }
  // the rolled rim round the top, its edges lit
  quad3(p, [[at0 - 0.03, bs1 + 0.05, H - 1.6], [at1 + 0.03, bs1 + 0.05, H - 1.6], [at1 + 0.03, bs1 + 0.05, H], [at0 - 0.03, bs1 + 0.05, H]], Y[3]);
  line3y(p, [at0 - 0.03, bs1 + 0.05, H], [at1 + 0.03, bs1 + 0.05, H], Y[6], 2);
  line3y(p, [at0 - 0.03, bs1 + 0.05, H - 1.6], [at1 + 0.03, bs1 + 0.05, H - 1.6], Y[1]);
  line3y(p, [at1 + 0.03, bs0, H], [at1 + 0.03, bs1 + 0.05, H], Y[5], 2);
  // the lifting lugs: a trunnion near each end of the long side
  for (const a of [e0(H * 0.62) + 0.22, e1(H * 0.62) - 0.22]) {
    lbox(p, a - 0.07, bs1 + 0.04, 0.14, 0.06, H * 0.62 - 1.4, 2.8, mono(flat(IRON, 3, 2, 4), IRON[0]));
    const [x, y] = p.P(a, bs1 + 0.12, H * 0.62);
    px(p.c, x - 3, y - 3, IRON[1], 6, 6);
    px(p.c, x - 2, y - 2, '#8a8a92', 4, 4);
    px(p.c, x - 1, y - 2, '#d0d0d6', 2, 1);
  }
  // the hire firm's stencil and phone number, hazard strips at the near corners
  const F = front(p, bs1 + 0.06);
  planeText(p.c, F, am, H * 0.55, 'SKIP HIRE', '#22201e', 1);
  planeText(p.c, F, am, H * 0.55 - 2.4, 'TEL 4471', '#22201e', 1);
  for (const [u0, u1] of [[at0 + 0.02, at0 + 0.3], [at1 - 0.3, at1 - 0.02]] as const) pt(p, F, u0, u1, H - 4.4, H - 1.7, (u: number, v: number) => (Math.floor((u + v) / 6) & 1 ? '#22201e' : '#f6cc30'), 1);
}

const fac_skip: PropArt = {
  draw(p, k) {
    drawSkip(p, 0, 0, k.w, k.d, k.seed, k.color ?? '#e4ae22', 15);
  },
};

const fac_ibc: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.12, 0.88, 0.88, 12, 0.28);
    const one = (z: number, level: number) => {
      palletBox(p, 0.12, 0.12, 0.76, 0.76, z);
      const tank: Mat = (light, _w, h) => (u, v, x, y) => {
        const lv = v < h * level;
        let col = lv ? (light ? '#c8c0a0' : '#a8a084') : light ? '#e8e8e2' : '#c4c4be';
        if (Math.abs(v - h * level) < 1) col = '#8a8468';
        if (u % 24 < 1.5 || v % 22 < 1.5) col = light ? '#9aa0a6' : '#7a8086';
        if (hash(x, y, 4) < 0.03) col = darken(col, 0.15);
        return col;
      };
      lbox(p, 0.14, 0.14, 0.72, 0.72, z + 1.3, 9.6, { front: tank, side: tank, top: (light) => (u, v) => ((u % 24 < 1.5 || v % 24 < 1.5) ? '#8a9096' : light ? '#f2f2ec' : '#d8d8d2'), edge: '#6a7076' });
      const [cx, cy] = anchor(p, 0.5, 0.5, z + 10.9);
      px(p.c, cx - 4, cy - 2, '#e8e8e2', 8, 3);
      px(p.c, cx - 3, cy - 4, '#3a7ac8', 6, 2);
      const [vx, vy] = front(p, 0.861).F(0.5, z + 2.4);
      px(p.c, vx - 3, vy - 2, '#2a2a30', 6, 4);
      px(p.c, vx - 1, vy - 4, '#e8b830', 2, 2);
    };
    one(0, 0.3 + (k.seed % 3) * 0.2);
    if (k.seed % 3 === 1) one(10.9, 0.15);
  },
};

const fac_drums: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.08, 0.92, 0.92, 10, 0.28);
    palletBox(p, 0.08, 0.08, 0.84, 0.84, 0);
    const cols = ['#2a5a9a', '#b8302a', '#2a2a2e', '#3a7a4a', '#e8a830'];
    for (const [i, [a, b]] of ([[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]] as const).entries()) {
      if ((i + k.seed) % 5 === 4) continue;
      const col = cols[(i * 3 + k.seed) % cols.length];
      const r = ramp(col);
      const [x, y] = p.P(a, b, 1.3);
      layer(p.c, (l) => {
        for (let j = 0; j < 34; j++)
          for (let q = -11; q <= 11; q++) {
            const u = (q + 11) / 22;
            let t = u < 0.2 ? 4.4 : u < 0.45 ? 3.6 : u < 0.7 ? 2.8 : u < 0.88 ? 2 : 1.3;
            if (j === 11 || j === 22) t -= 1;
            const yb = Math.sqrt(Math.max(0, 1 - (q / 11) ** 2)) * 5.5;
            px(l, x + q, y + yb - j, at(r, t));
          }
        ell(l, x, y - 34, 11, 5.5, r[2]);
        ell(l, x, y - 34, 9, 4.5, r[4]);
        px(l, x - 4, y - 35, IRON[2], 3, 2);
      }, { outline: 0.6, rect: [x - 14, y - 42, x + 14, y + 8] });
    }
  },
};

// ── lamps, the gatehouse, vehicles ──────────────────────────
const fac_lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 16, 6, 0.3);
    layer(p.c, (l) => {
      // a concrete base, a tapering galvanised column, a bracket with two floodlights angled down
      px(l, x - 9, y - 12, CONC[2], 18, 12);
      px(l, x - 9, y - 12, CONC[4], 6, 12);
      px(l, x - 10, y - 13, CONC[5], 20, 2);
      for (let j = 12; j < 240; j++) {
        const w = Math.round(5 - (j / 240) * 2);
        px(l, x - w, y - j, '#9a9ea2', w * 2, 1);
        px(l, x - w, y - j, '#c8ccce', Math.max(1, Math.round(w * 0.6)), 1);
        px(l, x + w - 2, y - j, '#6e7276', 2, 1);
      }
      px(l, x - 20, y - 244, '#5a5e62', 40, 4);
      for (const s2 of [-1, 1]) {
        const fx = x + s2 * 15;
        fillPoly(l, [[fx - 9, y - 246], [fx + 9, y - 246], [fx + 11, y - 230], [fx - 11, y - 230]], '#3e4248');
        fillPoly(l, [[fx - 9, y - 246], [fx - 3, y - 246], [fx - 6, y - 230], [fx - 11, y - 230]], '#5a5e66');
        fillPoly(l, [[fx - 10, y - 233], [fx + 10, y - 233], [fx + 11, y - 230], [fx - 11, y - 230]], '#fff2c0');
      }
      // a junction box at the foot with a hazard sticker
      px(l, x + 4, y - 34, '#6a6e72', 8, 12);
      px(l, x + 6, y - 31, '#e8b830', 4, 4);
    }, { outline: 0.6, rect: [x - 30, y - 254, x + 30, y + 4] });
    void k;
  },
};

const fac_hut: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 22, 0.3);
    // a portable cabin on blocks: ribbed walls, windows with blinds, a door with steps
    const BL: Ramp = ['#2a3a4a', '#344a5c', '#405a6e', '#4e6c82', '#5e7e94', '#7292a8'];
    const wall: Mat = (light) => (u, v, x, y) => at(BL, (light ? 3 : 2) + (u % 12 < 1.4 ? -1 : 0) + (v < 2 ? -0.6 : 0) - (hash(x, y, 4) < 0.03 ? 0.8 : 0));
    for (const a of [0.2, W - 0.4]) for (const b of [0.2, D - 0.4]) lbox(p, a, b, 0.2, 0.2, 0, 1.6, mono(flat(CONC, 3, 2, 4), CONC[0]));
    lbox(p, 0.05, 0.05, W - 0.1, D - 0.1, 1.6, 15, { front: wall, side: wall, top: flat(['#4a4e54', '#5a5e64', '#6a6e74', '#7a7e84'], 2, 1, 3), edge: BL[0] });
    const F = front(p, D - 0.049);
    pt(p, F, 0.3, W * 0.55, 7, 13, (u: number, v: number) => ((v % 3 < 1) ? '#c8ccc8' : (u * 0.7 + v) % 30 < 5 ? at(GLASS, 5) : at(GLASS, 2)), F.light);
    pq(p, F, 0.26, W * 0.55 + 0.04, 6.6, 7, '#e8e8e4');
    pq(p, F, W - 0.75, W - 0.2, 1.6, 13.6, BL[1]);
    pq(p, F, W - 0.71, W - 0.24, 2, 13.2, BL[2]);
    const [kx, ky] = F.F(W - 0.3, 8);
    px(p.c, kx - 1, ky, '#c8ccd0', 2, 2);
    lbox(p, W - 0.8, D - 0.05, 0.6, 0.4, 0, 1.6, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
    lbox(p, W - 0.8, D - 0.05, 0.6, 0.2, 0, 0.8, mono(flat(STEEL, 4, 3, 5), STEEL[0]));
    pq(p, F, 0.3, 1.3, 14, 16, '#f2eee2');
    planeText(p.c, F, 0.8, 15, 'GATEHOUSE', '#1e3a6a', 1);
    // a CCTV camera on a bracket at the corner, an AC unit on the side
    const [cx, cy] = p.P(W - 0.05, D - 0.05, 16.6);
    layer(p.c, (l) => {
      ln(l, cx, cy, cx + 6, cy - 4, '#8a8e92', 2);
      px(l, cx + 4, cy - 9, '#e8e8e4', 10, 5);
      px(l, cx + 12, cy - 8, '#2a2a30', 2, 3);
    }, { outline: 0.6, rect: [cx - 4, cy - 14, cx + 18, cy + 4] });
    const S = side(p, visA(p, 0.05, W - 0.05));
    pq(p, S, 0.3, 0.9, 9, 13, '#c8ccc8');
    for (let i = 0; i < 4; i++) pq(p, S, 0.36 + i * 0.13, 0.42 + i * 0.13, 9.5, 12.5, '#8a8e92');
  },
};

const fac_coal: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 10, 0.32);
    const [x, y] = p.P(W / 2, D / 2, 0);
    const rx = (W + D) * 19;
    const ry = rx * 0.45;
    const H = 58;
    const COAL = ['#100e14', '#1a1820', '#25232c', '#32303b', '#43414f', '#5c5a6c', '#8a889c'];
    layer(p.c, (l) => {
      // a shaded mound: lit on its upper left, lumps catching the light, dust round the foot
      for (let i = -rx; i <= rx; i++) {
        const f = i / rx;
        const q = Math.max(0, 1 - f * f);
        const base = y + Math.sqrt(q) * ry;
        const top = y - (1 - Math.pow(Math.abs(f), 1.4)) * H - Math.sqrt(q) * ry * 0.4 - (hash(Math.round(i / 3), 1, k.seed) - 0.5) * 4;
        for (let yy = Math.floor(top); yy <= base; yy++) {
          const down = (yy - top) / Math.max(1, base - top);
          let t = 3.6 - f * 2.2 - down * 1.4 + (down < 0.12 ? 0.6 : 0);
          const cell = hash(Math.floor((x + i) / 3), Math.floor(yy / 2), k.seed);
          if (cell < 0.12) t += 1.6;
          else if (cell > 0.85) t -= 1;
          px(l, x + i, yy, COAL[Math.max(0, Math.min(6, Math.round(t)))]);
        }
      }
      for (let i = 0; i < 40; i++) {
        const ox = (hash(i, 7, k.seed) - 0.5) * rx * 2.3;
        const oy = ry * 0.9 + (hash(i, 8, k.seed) - 0.5) * 8;
        if (Math.abs(ox) < rx * 0.7) continue;
        px(l, x + ox, y + oy, COAL[2 + (i % 3)], 2, 1);
      }
      // a shovel stuck in and a barrow beside
      ln(l, x + 10, y - 26, x + 26, y - 52, '#8a5a30', 2);
      fillPoly(l, [[x + 5, y - 24], [x + 13, y - 28], [x + 11, y - 16], [x + 5, y - 16]], '#5a5e66');
      const bx = x + rx * 0.85;
      const by = y + 8;
      fillPoly(l, [[bx - 14, by - 12], [bx + 10, by - 14], [bx + 8, by - 4], [bx - 10, by - 2]], '#3a5a8a');
      fillPoly(l, [[bx - 12, by - 12], [bx + 8, by - 14], [bx + 6, by - 11], [bx - 10, by - 9]], '#1e1c24');
      ell(l, bx + 12, by - 2, 4, 4, TYRE[2]);
      ln(l, bx - 14, by - 10, bx - 26, by - 6, '#6a4a2a', 2);
    }, { outline: 0.6, rect: [x - rx - 30, y - H - 30, x + rx + 30, y + ry + 12] });
  },
};

/** A stack of sawn timber on bearers, a tarpaulin half off. */
const fac_timber: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.1, 10, 0.28);
    for (const a of [0.2, W / 2, W - 0.3]) lbox(p, a, 0.12, 0.12, D - 0.24, 0, 0.8, mono(flat(OLDWOOD, 2, 1, 3), OLDWOOD[0]));
    const end: Mat = (light) => (u, v, x, y) => (u % 9 < 1 || v % 5 < 1 ? at(TIMBER, light ? 1 : 0) : at(TIMBER, (light ? 4 : 3) - (hash(Math.floor(u / 9), Math.floor(v / 5), 3) < 0.3 ? 1 : 0) - (hash(x, y, 4) < 0.05 ? 1 : 0)));
    lbox(p, 0.06, 0.14, W - 0.12, D - 0.28, 0.8, 6.4, { front: planks(TIMBER, 5), side: end, top: planks(TIMBER, 5), edge: TIMBER[0] });
    // a green tarp over the back half, tied down
    const T: Ramp = ['#1e3a2a', '#28483a', '#325646', '#3e6654', '#4c7662'];
    lbox(p, 0.04, 0.12, W * 0.55, D - 0.24, 7.2, 0.3, mono(flat(T, 3, 2, 4), T[0]));
    lbox(p, 0.04, D - 0.14, W * 0.55, 0.04, 2.4, 4.8, mono(flat(T, 3, 2, 3), T[0]));
    const [rx, ry] = p.P(W * 0.3, D - 0.1, 2.4);
    ln(p.c, rx, ry, rx + 6, ry + 12, '#c8b890');
    void k;
  },
};

/** A wooden cable drum on its rim, a few turns of black cable left on it. */
const fac_reel: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 10, y + 3, 24, 8, 0.3);
    layer(p.c, (l) => {
      // the far flange, the cable on the barrel, the near flange with its bolts and stencil
      ell(l, x + 8, y - 26, 16, 24, TIMBER[1]);
      for (let i = -12; i <= 12; i++) px(l, x + i * 0.4 + 2, y - 44 + Math.abs(i) * 0.2, '#1e1e22', 8, 36);
      for (let j = 0; j < 9; j++) ln(l, x - 2, y - 42 + j * 4, x + 8, y - 44 + j * 4, '#34343a');
      ell(l, x - 4, y - 24, 16, 24, TIMBER[3]);
      ell(l, x - 5, y - 25, 14, 22, TIMBER[4]);
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        px(l, x - 4 + Math.cos(ang) * 10, y - 24 + Math.sin(ang) * 15, IRON[2], 2, 2);
      }
      ell(l, x - 4, y - 24, 4, 6, '#2a2018');
      for (let i = 0; i < 4; i++) ln(l, x - 16 + i * 3, y - 36 + i * 5, x - 12 + i * 3, y - 36 + i * 5, TIMBER[1]);
    }, { outline: 0.6, rect: [x - 24, y - 54, x + 28, y + 4] });
    void k;
  },
};

/** Hessian sacks slumped in a heap. */
const fac_sacks: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 22, 7, 0.28);
    const H: Ramp = ['#5a4a32', '#6e5c3e', '#82704c', '#968458', '#aa9866', '#bcaa76'];
    const Rn = rng(k.seed * 3 + 7);
    layer(p.c, (l) => {
      const n = 4 + (k.seed % 3);
      for (let i = 0; i < n; i++) {
        const ox = i < 3 ? (i - 1) * 13 : (Rn() - 0.5) * 14;
        const oy = i < 3 ? 0 : -9 * (i - 2);
        for (let j = 0; j < 12; j++) {
          const w = 9 - Math.abs(j - 6) * 0.5;
          for (let q = -w; q < w; q++) {
            const t = (q + w) / (2 * w);
            px(l, x + ox + q, y + oy - j, at(H, (t < 0.3 ? 4 : t < 0.65 ? 3 : 2) - (j < 2 ? 1 : 0) + (j > 9 ? 1 : 0)));
          }
        }
        px(l, x + ox - 3, y + oy - 13, H[1], 6, 2);
        if (i === 1) px(l, x + ox - 4, y + oy - 7, '#2a2a30', 8, 2);
      }
    }, { outline: 0.6, rect: [x - 28, y - 46, x + 28, y + 4] });
  },
};

/** A two-wheeled sack truck propped against the wall. */
const fac_cart: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 3, 12, 4, 0.28);
    layer(p.c, (l) => {
      ln(l, x - 6, y - 2, x - 2, y - 44, RED[2], 2);
      ln(l, x + 6, y - 2, x + 10, y - 44, RED[3], 2);
      for (let i = 1; i < 5; i++) ln(l, x - 6 + i * 0.8, y - 2 - i * 9, x + 6 + i * 0.8, y - 2 - i * 9, RED[2]);
      px(l, x - 7, y - 2, STEEL[4], 15, 2);
      ell(l, x - 7, y, 5, 5, TYRE[2]);
      ell(l, x + 8, y, 5, 5, TYRE[1]);
      ell(l, x + 8, y, 2, 2, STEEL[4]);
      px(l, x - 3, y - 48, '#2a2a30', 4, 4);
      px(l, x + 9, y - 48, '#2a2a30', 4, 4);
    }, { outline: 0.6, rect: [x - 14, y - 54, x + 16, y + 8] });
    void k;
  },
};

const fac_sign: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.3, W - 0.1, 0.7, 14, 0.26);
    for (const a of [0.25, W - 0.3]) lbox(p, a, 0.45, 0.06, 0.06, 0, 20, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
    const F = front(p, 0.52);
    lbox(p, 0.1, 0.42, W - 0.2, 0.08, 9, 11, { front: flat(['#1e2a4a', '#24345a', '#2c3e6a', '#36487a'], 2, 1), side: flat(['#1e2a4a', '#24345a', '#2c3e6a'], 1, 0), top: flat(['#1e2a4a', '#24345a', '#2c3e6a', '#36487a'], 3, 3), edge: '#141c30' });
    planeText(p.c, F, W / 2, 17.6, 'ALBION WORKS', '#f2eee2', 2);
    pq(p, F, 0.25, W - 0.25, 15.3, 15.6, YELLOW[4]);
    planeText(p.c, F, W / 2, 13.6, 'UNIT 1 PRESS SHOP', '#c8d0e0', 1);
    planeText(p.c, F, W / 2, 11.4, 'DELIVERIES - DOCK 1', '#c8d0e0', 1);
    void k;
  },
};

const fac_tyres: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 22, 7, 0.28);
    const Rn = rng(k.seed * 3 + 1);
    layer(p.c, (l) => {
      const n = 4 + (k.seed % 4);
      for (let i = 0; i < n; i++) {
        const ox = i < 3 ? (i - 1) * 12 : (Rn() - 0.5) * 16;
        const oy = i < 3 ? 0 : -8 * (i - 2);
        ell(l, x + ox, y + oy - 4, 11, 5, TYRE[1]);
        ell(l, x + ox, y + oy - 6, 11, 5, TYRE[3]);
        ell(l, x + ox, y + oy - 6, 5, 2, '#141216');
        px(l, x + ox - 8, y + oy - 8, TYRE[4], 4, 1);
      }
      // a weed growing through the stack
      px(l, x + 2, y - 30, WEED[4], 2, 10);
      px(l, x - 2, y - 26, WEED[3], 2, 6);
    }, { outline: 0.6, rect: [x - 30, y - 48, x + 30, y + 6] });
  },
};

/** A heap of scrap: offcuts of sheet, pipe, a buckled drum, a wheel, the odd bright edge. */
const fac_scrap: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 12, 0.3);
    const [x, y] = p.P(W / 2, D / 2, 0);
    const rx = (W + D) * 22;
    const Rn = rng(k.seed * 9 + 4);
    layer(p.c, (l) => {
      // the heap's body: rusty, dark, a pile of jagged plates
      for (let i = 0; i < 140; i++) {
        const ox = (Rn() - 0.5) * rx * 1.8;
        const hgt = Math.max(0, 1 - Math.abs(ox) / rx) * 40;
        const oy = -Rn() * hgt + (Rn() - 0.5) * 8;
        const w = 6 + Rn() * 12;
        const h = 3 + Rn() * 5;
        const ang = (Rn() - 0.5) * 0.9;
        const col = Rn() < 0.55 ? at(RUST, 1 + Rn() * 4) : at(STEEL, 1 + Rn() * 4);
        fillPoly(l, [[x + ox - w / 2, y + oy], [x + ox + w / 2, y + oy + ang * w], [x + ox + w / 2, y + oy + ang * w - h], [x + ox - w / 2, y + oy - h]], col);
        if (Rn() < 0.3) ln(l, x + ox - w / 2, y + oy - h, x + ox + w / 2, y + oy + ang * w - h, STEEL[5]);
      }
      // pipes poking out, a buckled drum on its side, a cart wheel
      for (let i = 0; i < 4; i++) {
        const ox = (Rn() - 0.5) * rx;
        ln(l, x + ox, y - 10 - Rn() * 20, x + ox + 22 * (Rn() - 0.3), y - 24 - Rn() * 20, STEEL[3], 3);
      }
      ell(l, x + rx * 0.45, y - 8, 9, 7, '#3a5a8a');
      ell(l, x + rx * 0.45, y - 8, 4, 3, '#1e2a3a');
      ell(l, x - rx * 0.5, y - 6, 10, 10, '#1e1e22');
      ell(l, x - rx * 0.5, y - 6, 6, 6, RUST[2]);
    }, { outline: 0.6, rect: [x - rx - 20, y - 60, x + rx + 20, y + 16] });
  },
};

/** A bicycle leaning on its stand: a frame in faded paint, a basket, a lock. */
const fac_bike: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 22, 5, 0.26);
    const col = ['#2a5aa8', '#c8382a', '#3a6a3a', '#1e1e22'][k.seed % 4];
    layer(p.c, (l) => {
      for (const wx of [-13, 13]) {
        for (let a = 0; a < Math.PI * 2; a += 0.08) px(l, x + wx + Math.cos(a) * 9, y - 9 + Math.sin(a) * 9, '#2a2630');
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          ln(l, x + wx, y - 9, x + wx + Math.cos(ang) * 8, y - 9 + Math.sin(ang) * 8, '#8a8e96');
        }
      }
      ln(l, x - 13, y - 9, x - 1, y - 20, col, 2);
      ln(l, x - 1, y - 20, x + 11, y - 18, col, 2);
      ln(l, x + 11, y - 18, x + 13, y - 9, col, 2);
      ln(l, x - 13, y - 9, x, y - 8, col, 2);
      ln(l, x, y - 8, x - 1, y - 20, col, 2);
      px(l, x - 5, y - 23, '#3a2a26', 8, 2);
      ln(l, x + 11, y - 18, x + 10, y - 25, col, 2);
      px(l, x + 5, y - 26, '#3a3640', 9, 2);
      px(l, x + 12, y - 30, '#b8925a', 9, 6);
      for (let i = 0; i < 9; i += 2) px(l, x + 12 + i, y - 30, '#8a6a3a', 1, 6);
    }, { outline: 0.5, rect: [x - 26, y - 36, x + 26, y + 4] });
  },
};

/** A steel site container used as a store: corrugated sides, the door end with its locking bars, rust and stencils. */
const fac_store: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 18, 0.3);
    const col = k.color ?? ['#2e5a46', '#7a3a2e', '#2e4a6a', '#8a6a2e'][k.seed % 4];
    const r: Ramp = [darken(col, 0.55), darken(col, 0.38), darken(col, 0.2), col, lighten(col, 0.16), lighten(col, 0.3)];
    // timber bearers under it, the box, its corner castings
    for (const a of [0.3, W - 0.5]) lbox(p, a, 0.05, 0.2, D - 0.1, 0, 0.8, mono(flat(OLDWOOD, 2, 1, 3), OLDWOOD[0]));
    lbox(p, 0.05, 0.1, W - 0.1, D - 0.2, 0.8, 25, { front: corrugated(r, 0.35, 7), side: (light) => (u, v) => at(r, (light ? 3 : 2) - (u % 20 < 1.2 ? 1 : 0) - (v < 2 ? 1 : 0)), top: (light) => (u) => at(r, (light === 2 ? 4 : 3) - (u % 14 < 1.4 ? 1 : 0)), edge: r[0] });
    const S = side(p, visA(p, 0.05, W - 0.05));
    const F = front(p, D - 0.1 + 0.001);
    // the door end: two leaves, four locking bars with their handles
    pq(p, S, 0.1 + D * 0.5 - 0.02, 0.1 + D * 0.5 + 0.02, 1, 25.6, r[0]);
    for (let i = 0; i < 4; i++) {
      const b = 0.22 + i * ((D - 0.44) / 3);
      pq(p, S, b - 0.02, b + 0.02, 1.2, 25.2, STEEL[S.light ? 4 : 3]);
      const [hx, hy] = S.F(b, 12);
      px(p.c, hx - 1, hy - 3, STEEL[2], 3, 6);
    }
    // stencils and rust on the long side
    planeText(p.c, F, W * 0.3, 20, 'ALBION', lighten(col, 0.45), 2);
    planeText(p.c, F, W * 0.3, 15.4, 'STORES NO.' + (2 + (k.seed % 5)), lighten(col, 0.4), 1);
    for (let i = 0; i < 6; i++) {
      const [x, y] = F.F(0.4 + hash(i, 1, k.seed) * (W - 0.8), 4 + hash(i, 2, k.seed) * 18);
      for (let j = 0; j < 6; j++) px(p.c, x, y + j * 2, RUST[2 + (j % 2)], 1, 2);
    }
    // corner castings
    for (const a of [0.05, W - 0.17]) for (const z of [0.8, 24.6]) lbox(p, a, D - 0.22, 0.12, 0.12, z, 1.2, mono(flat(r, 1, 0, 2), r[0]));
  },
};

export const FACTORY_YARD: Record<string, PropArt> = {
  fac_rail,
  fac_buffer,
  fac_pallets,
  fac_cylinders,
  fac_skip,
  fac_ibc,
  fac_drums,
  fac_lamp,
  fac_hut,
  fac_coal,
  fac_timber,
  fac_reel,
  fac_sacks,
  fac_cart,
  fac_sign,
  fac_tyres,
  fac_scrap,
  fac_bike,
  fac_store,
};


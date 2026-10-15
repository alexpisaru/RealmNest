// HD Farm buildings: farmhouse, barn, greenhouse, shed, coop, pergola, well.
import { darken, lighten, mix } from '../color';
import { poly, type PropPainter } from '../iso';
import type { PropArt } from '../props';
import { boards, canopy, ellipse, flowers, hh, OUTL, plaster, px, RAMP, type Ramp, shingles, siding, solid, stones, tbox, texPara, tuft } from './kit';
import { beam, castShadow, doorOn, front, pq, pt, side, windowOn } from './plane';

const ROSES = ['#e8577a', '#f08aa8', '#fbd0dc', '#c43a5c'];
const MIXED = ['#f6d860', '#f08aa8', '#fbf4e4', '#c49cf2', '#f08a5a'];

/** Gable roof along a (ridge parallel to the prop width), shingled, with fascia and ridge cap. */
function gableRoof(p: PropPainter, a0: number, a1: number, b0: number, b1: number, ze: number, zr: number, ramp: Ramp, oh = 0.35, gable?: (bm: number) => void) {
  const bm = (b0 + b1) / 2;
  const A0 = a0 - oh;
  const A1 = a1 + oh;
  // back slope (mostly hidden, gives the silhouette behind the ridge)
  texParaQ(p, [A0, b0 - oh, ze - 2], [A1 - A0, 0, 0], [0, bm - (b0 - oh), zr - ze + 2], shingles(ramp), 0);
  gable?.(bm);
  // front slope
  texParaQ(p, [A0, b1 + oh, ze - 2], [A1 - A0, 0, 0], [0, bm - (b1 + oh), zr - ze + 2], shingles(ramp), 1);
  // fascia along the eave + barge board on the right end
  const k = p.k;
  const e0 = p.P(A0, b1 + oh, ze - 2);
  const e1 = p.P(A1, b1 + oh, ze - 2);
  poly(p.c, [[e0[0], e0[1]], [e1[0], e1[1]], [e1[0], e1[1] + 2 * k], [e0[0], e0[1] + 2 * k]], darken(ramp[0], 0.2));
  const r0 = p.P(A1, b1 + oh, ze - 2);
  const r1 = p.P(A1, bm, zr);
  const r2 = p.P(A1, b0 - oh, ze - 2);
  poly(p.c, [[r0[0], r0[1]], [r1[0], r1[1]], [r1[0] + 2 * k, r1[1] + 1], [r0[0] + 2 * k, r0[1] + 1]], mix(ramp[1], OUTL, 0.3));
  poly(p.c, [[r1[0], r1[1]], [r2[0], r2[1]], [r2[0] + 2 * k, r2[1] + 1], [r1[0] + 2 * k, r1[1] + 1]], mix(ramp[0], OUTL, 0.4));
  // ridge cap with highlight
  const c0 = p.P(A0, bm, zr);
  const c1 = p.P(A1, bm, zr);
  poly(p.c, [[c0[0], c0[1] - 2], [c1[0], c1[1] - 2], [c1[0], c1[1] + 1], [c0[0], c0[1] + 1]], ramp[1]);
  poly(p.c, [[c0[0], c0[1] - 2], [c1[0], c1[1] - 2], [c1[0], c1[1] - 1], [c0[0], c0[1] - 1]], lighten(ramp[ramp.length - 1], 0.1));
  // outline around the roof silhouette
  const tl = p.P(A0, b0 - oh, ze - 2);
  edge(p, [tl, c0, c1, r2], OUTL);
  edge(p, [e0, e1], mix(ramp[0], OUTL, 0.6));
  edge(p, [c0, e0], mix(ramp[0], OUTL, 0.6));
}

function texParaQ(p: PropPainter, O: [number, number, number], U: [number, number, number], V: [number, number, number], mat: ReturnType<typeof shingles>, light: 0 | 1 | 2) {
  const o = p.P(...O);
  const a = p.P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
  const b = p.P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
  const Us: [number, number] = [a[0] - o[0], a[1] - o[1]];
  const Vs: [number, number] = [b[0] - o[0], b[1] - o[1]];
  texPara(p.c, o, Us, Vs, mat(light, Math.hypot(...Us), Math.hypot(...Vs)));
}

function edge(p: PropPainter, pts: [number, number][], col: string) {
  p.c.fillStyle = col;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) p.c.fillRect(Math.round(x0 + ((x1 - x0) * s) / n), Math.round(y0 + ((y1 - y0) * s) / n) - 1, 1, 1);
  }
}

/** Climbing roses: a strip of small leaf clusters with blossoms up a wall. */
function climber(p: PropPainter, pts: [number, number][], seed: number, blossoms = ROSES) {
  pts.forEach(([x, y], i) => canopy(p.c, x, y, 5, 4.5, seed + i * 17, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 3, dots: blossoms, dotChance: 0.55 }));
}

/** Low flowering plants along a wall base, from (a0..a1) on the front plane b. */
function bedAlong(p: PropPainter, a0: number, a1: number, b: number, seed: number, cols = MIXED) {
  const n = Math.max(2, Math.round((a1 - a0) * 3));
  for (let i = 0; i <= n; i++) {
    const [x, y] = p.P(a0 + ((a1 - a0) * i) / n, b, 0);
    canopy(p.c, x, y - 4, 5, 4, seed + i * 29, { ramp: RAMP.leaf, rmin: 2, rmax: 3.2, dots: cols, dotChance: 0.7, flatBottom: true });
  }
}

// ── farmhouse ───────────────────────────────────────────────
const farmhouse: PropArt = {
  draw(p, k) {
    const A0 = 0.3;
    const A1 = 7.7;
    const B0 = 0.5;
    const B1 = 4.5;
    const ZW = 44;
    castShadow(p, A0, B0, A1 - A0, B1 - B0, 80, 0.24);
    // stone plinth + plastered walls
    tbox(p, A0 - 0.05, B0, A1 - A0 + 0.1, B1 - B0 + 0.05, 0, 7, { left: stones(RAMP.stoneWarm, 5, 0.3), right: stones(RAMP.stoneWarm, 5, 0.3), top: solid(RAMP.stoneWarm), edge: RAMP.stoneWarm[1] });
    tbox(p, A0, B0, A1 - A0, B1 - B0, 7, ZW - 7, { left: plaster(RAMP.plaster), right: plaster(RAMP.plaster), edge: RAMP.plaster[1] });
    const F = front(p, B1);
    const S = side(p, A1);
    const timber = RAMP.wood[1];
    const timberS = RAMP.wood[0];
    // timber frame — front
    for (const a of [A0, 2.15, 4.0, 5.85, A1]) beam(p, F, a + (a === A1 ? -0.06 : 0.06), 7, a + (a === A1 ? -0.06 : 0.06), ZW, 2.2, timber);
    for (const z of [7.5, 26, ZW - 1]) beam(p, F, A0, z, A1, z, z === 26 ? 1.6 : 2.2, timber);
    beam(p, F, A0 + 0.1, 8, 2.1, 25, 1.4, timber);
    beam(p, F, A1 - 0.1, 8, 5.9, 25, 1.4, timber);
    // timber frame — side (shaded)
    for (const b of [B0 + 0.06, 2.5, B1 - 0.06]) beam(p, S, b, 7, b, ZW, 2.2, timberS);
    for (const z of [7.5, 26, ZW - 1]) beam(p, S, B0, z, B1, z, z === 26 ? 1.6 : 2.2, timberS);
    beam(p, S, B0 + 0.1, 27, 2.4, ZW - 2, 1.4, timberS);
    // windows with shutters and flower boxes
    for (const a of [1.15, 6.9]) windowOn(p, F, a - 0.42, a + 0.42, 12, 23, { shutters: RAMP.teal, box: ROSES });
    windowOn(p, F, 2.75, 3.4, 29, 39, { shutters: RAMP.teal });
    windowOn(p, F, 4.6, 5.25, 29, 39, { shutters: RAMP.teal });
    windowOn(p, F, 6.62, 7.18, 29, 39, {});
    windowOn(p, F, 0.9, 1.42, 29, 39, {});
    windowOn(p, S, 1.15, 1.85, 12, 23, { shutters: RAMP.teal, box: MIXED });
    windowOn(p, S, 3.15, 3.85, 12, 23, { shutters: RAMP.teal, box: ROSES });
    windowOn(p, S, 1.25, 1.75, 29, 38, {});
    windowOn(p, S, 3.25, 3.75, 29, 38, {});
    // door, stone steps, lanterns
    doorOn(p, F, 4.55, 5.3, 7, 24);
    pq(p, F, 4.5, 5.35, 24, 25.5, timber);
    tbox(p, 4.35, B1, 1.15, 0.28, 0, 4, { left: stones(RAMP.stone, 4, 0), right: solid(RAMP.stone), top: solid(RAMP.stone), edge: RAMP.stone[1] });
    tbox(p, 4.45, B1 + 0.28, 0.95, 0.24, 0, 2, { left: stones(RAMP.stone, 4, 0), right: solid(RAMP.stone), top: solid(RAMP.stone), edge: RAMP.stone[1] });
    for (const a of [4.35, 5.5]) {
      const [x, y] = F.F(a, 21);
      px(p.c, x - 1, y - 7, OUTL, 5, 9);
      px(p.c, x, y - 6, '#ffd77a', 3, 6);
      px(p.c, x, y - 6, '#fff3c2', 1, 2);
      px(p.c, x - 1, y - 8, RAMP.iron[1], 5, 1);
    }
    // porch: a little shingled canopy over the door on two posts
    for (const a of [4.3, 5.55]) tbox(p, a - 0.05, B1 + 0.42, 0.1, 0.1, 0, 27, { left: siding(RAMP.wood, 5), right: solid(RAMP.wood), top: solid(RAMP.wood), edge: RAMP.wood[0] });
    texParaQ(p, [4.15, B1 + 0.62, 26], [1.55, 0, 0], [0, -0.64, 6], shingles(RAMP.roof, 4, 6), 1);
    const pe0 = p.P(4.15, B1 + 0.62, 26);
    const pe1 = p.P(5.7, B1 + 0.62, 26);
    poly(p.c, [[pe0[0], pe0[1]], [pe1[0], pe1[1]], [pe1[0], pe1[1] + 3], [pe0[0], pe0[1] + 3]], RAMP.wood[1]);
    const ps0 = p.P(5.7, B1 + 0.62, 26);
    const ps1 = p.P(5.7, B1 - 0.02, 32);
    poly(p.c, [[ps0[0], ps0[1]], [ps1[0], ps1[1]], [ps1[0], ps1[1] + 3], [ps0[0], ps0[1] + 3]], RAMP.roof[0]);
    // hanging flower baskets on the porch posts
    for (const a of [4.3, 5.55]) {
      const [x, y] = p.P(a, B1 + 0.47, 22);
      canopy(p.c, x, y, 5, 4, Math.floor(a * 97), { ramp: RAMP.leaf, rmin: 1.8, rmax: 2.8, dots: ['#e8577a', '#fbd0dc', '#f6d860'], dotChance: 0.9 });
    }

    // roof
    gableRoof(p, A0, A1, B0, B1, ZW, ZW + 32, RAMP.roof, 0.38, (bm) => {
      // right gable end: plaster + timber, shaded
      const g0 = S.F(B0 - 0.02, ZW);
      const g1 = S.F(B1 + 0.02, ZW);
      const g2 = S.F(bm, ZW + 32);
      poly(p.c, [g0, g1, g2], darken(RAMP.plaster[2], 0.18));
      for (let i = 0; i < 40; i++) {
        const x = g0[0] + hh(i, 1, 3) * (g1[0] - g0[0]);
        const y = g0[1] + hh(i, 2, 3) * (g1[1] - g0[1]) - hh(i, 3, 3) * 18;
        px(p.c, x, y, darken(RAMP.plaster[1], 0.2));
      }
      beam(p, S, bm, ZW, bm, ZW + 30, 2, timberS);
      beam(p, S, B0 + 0.1, ZW, bm, ZW + 30, 1.6, timberS);
      beam(p, S, B1 - 0.1, ZW, bm, ZW + 30, 1.6, timberS);
      windowOn(p, S, bm - 0.28, bm + 0.28, ZW + 4, ZW + 14, { muntins: false });
    });
    // brick chimney through the back slope
    tbox(p, 6.0, 1.4, 0.7, 0.7, ZW + 12, 34, { left: stones(RAMP.brick, 3, 0), right: stones(RAMP.brick, 3, 0), top: solid(RAMP.iron), edge: RAMP.brick[0] });
    tbox(p, 5.95, 1.35, 0.8, 0.8, ZW + 44, 3, { left: solid(RAMP.stone), right: solid(RAMP.stone), top: solid(RAMP.iron), edge: RAMP.stone[0] });
    // climbing roses on the corners and around the door
    const cl = (a: number, b: number, z0: number, z1: number, n: number) => Array.from({ length: n }, (_, i) => p.P(a, b, z0 + ((z1 - z0) * i) / (n - 1)) as [number, number]);
    climber(p, cl(A0 + 0.15, B1 + 0.05, 4, 40, 7), k.seed * 7);
    climber(p, cl(4.2, B1 + 0.05, 4, 27, 5), k.seed * 11);
    climber(p, [...cl(A1 - 0.05, B1 - 0.1, 4, 34, 6), ...cl(A1, 3.6, 30, 42, 3)], k.seed * 13, ['#fbf4e4', '#f6d860', '#f2a8c2']);
    // flower beds and pots along the front
    bedAlong(p, A0 + 0.4, 4.15, B1 + 0.25, 3);
    bedAlong(p, 5.75, A1 - 0.3, B1 + 0.25, 7, ROSES);
    for (const [a, b] of [[A1 + 0.08, 2.0], [A1 + 0.08, 3.1]] as const) {
      const [x, y] = p.P(a, b, 0);
      canopy(p.c, x + 4, y - 4, 6, 5, a * 31 + b, { ramp: RAMP.leaf, rmin: 2, rmax: 3, dots: MIXED, dotChance: 0.7, flatBottom: true });
    }
  },
  anim(p, k) {
    // chimney smoke
    const [x, y] = p.P(6.35, 1.75, 44 + 48);
    for (let i = 0; i < 4; i++) {
      const t = (k.t * 0.35 + i / 4) % 1;
      const r = 3 + t * 5;
      p.c.globalAlpha = 0.55 * (1 - t);
      ellipse(p.c, x + Math.sin(t * 5 + i) * 3 + t * 12, y - t * 46, r, r * 0.85, '#efe8e0');
      ellipse(p.c, x + Math.sin(t * 5 + i) * 3 + t * 12 - 1, y - t * 46 - 1, r * 0.6, r * 0.5, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── barn ────────────────────────────────────────────────────
const barn: PropArt = {
  draw(p) {
    const A0 = 0.15;
    const A1 = 3.85;
    const B0 = 0.3;
    const B1 = 2.8;
    const ZW = 30;
    castShadow(p, A0, B0, A1 - A0, B1 - B0, 64);
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, ZW, { left: boards(RAMP.barn, 5), right: boards(RAMP.barn, 5), edge: RAMP.barn[0] });
    const F = front(p, B1);
    const S = side(p, A1);
    // white trim
    const trim = '#efe6d2';
    const trimS = '#c9bfab';
    for (const a of [A0 + 0.05, A1 - 0.05]) beam(p, F, a, 0, a, ZW, 1.8, trim);
    beam(p, F, A0, ZW - 1, A1, ZW - 1, 1.8, trim);
    for (const b of [B0 + 0.05, B1 - 0.05]) beam(p, S, b, 0, b, ZW, 1.8, trimS);
    beam(p, S, B0, ZW - 1, B1, ZW - 1, 1.8, trimS);
    // big sliding doors with X braces
    const d0 = 1.15;
    const d1 = 2.85;
    pq(p, F, d0 - 0.05, d1 + 0.05, 0, 22, mix(RAMP.barn[0], OUTL, 0.4));
    pt(p, F, d0, d1, 0, 21, boards(RAMP.barn, 4));
    for (const [a, b] of [[d0, (d0 + d1) / 2], [(d0 + d1) / 2, d1]]) {
      beam(p, F, a, 0.5, a, 21, 1.5, trim);
      beam(p, F, b, 0.5, b, 21, 1.5, trim);
      beam(p, F, a, 0.8, b, 0.8, 1.5, trim);
      beam(p, F, a, 20.5, b, 20.5, 1.5, trim);
      beam(p, F, a + 0.05, 1.5, b - 0.05, 20, 1.2, trim);
      beam(p, F, b - 0.05, 1.5, a + 0.05, 20, 1.2, trim);
    }
    // hay loft door on the gable + side window
    windowOn(p, S, 1.2, 1.9, 10, 19, { frame: trimS, muntins: true });
    // roof (darker red-brown shingles) with the gable end on the right
    gableRoof(p, A0, A1, B0, B1, ZW, ZW + 22, ['#2e1c1c', '#422625', '#58302c', '#6e3c33', '#86503e', '#a0654a'], 0.3, (bm) => {
      const g0 = S.F(B0, ZW);
      const g1 = S.F(B1, ZW);
      const g2 = S.F(bm, ZW + 22);
      poly(p.c, [g0, g1, g2], darken(RAMP.barn[2], 0.15));
      pt(p, S, bm - 0.35, bm + 0.35, ZW + 2, ZW + 13, boards(['#2e1a14', '#4a2a1e', '#5e3826', '#704630', '#84563a'], 4), 0);
      beam(p, S, bm - 0.37, ZW + 2, bm - 0.37, ZW + 13, 1.2, trimS);
      beam(p, S, bm + 0.37, ZW + 2, bm + 0.37, ZW + 13, 1.2, trimS);
      beam(p, S, bm - 0.37, ZW + 13, bm + 0.37, ZW + 13, 1.2, trimS);
    });
    // hay spilling at the door, a lantern, weeds along the base
    const [hx, hy] = p.P(2, B1 + 0.25, 0);
    ellipse(p.c, hx, hy, 18, 4, RAMP.hay[2]);
    for (let i = 0; i < 30; i++) px(p.c, hx - 16 + hh(i, 1) * 32, hy - 3 + hh(i, 2) * 6, RAMP.hay[hh(i, 3) > 0.5 ? 4 : 1], 2, 1);
    for (let i = 0; i < 6; i++) {
      const [x, y] = p.P(A0 + 0.2 + i * 0.6, B1 + 0.05, 0);
      if (i === 2 || i === 3) continue;
      tuft(p.c, x, y, RAMP.leafWarm, i * 7 + 3);
    }
  },
};

// ── greenhouse ──────────────────────────────────────────────
const greenhouse2: PropArt = {
  draw(p) {
    const A0 = 0.1;
    const A1 = 3.9;
    const B0 = 0.15;
    const B1 = 2.85;
    const ZB = 8;
    const ZW = 34;
    castShadow(p, A0, B0, A1 - A0, B1 - B0, 40, 0.16);
    // wooden base
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, ZB, { left: siding(RAMP.wood, 4), right: siding(RAMP.wood, 4), top: solid(RAMP.soil), edge: RAMP.wood[0] });
    // plants inside: benches with pots and leafy seedlings
    for (let i = 0; i < 7; i++) {
      const [x, y] = p.P(A0 + 0.4 + i * 0.5, B0 + 0.9, ZB + 2);
      canopy(p.c, x, y - 4, 6, 5, i * 13 + 5, { ramp: RAMP.leaf, rmin: 2, rmax: 3.3, dots: i % 2 ? ['#e2553b', '#f6d860'] : ['#f08aa8'], dotChance: 0.5 });
    }
    for (let i = 0; i < 6; i++) {
      const [x, y] = p.P(A0 + 0.6 + i * 0.55, B1 - 0.6, ZB);
      px(p.c, x - 3, y - 4, RAMP.terracotta[1], 7, 5);
      px(p.c, x - 3, y - 4, RAMP.terracotta[3], 7, 1);
      canopy(p.c, x, y - 8, 5, 4.5, i * 7 + 2, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 3, dots: ['#e2553b'], dotChance: 0.4 });
    }
    // glass walls (semi-transparent) and roof
    const F = front(p, B1);
    const S = side(p, A1);
    const glassTex = (light: 0 | 1) => (u: number, v: number) => {
      const d = (u * 0.7 + v) % 30;
      const base = light ? 3 : 2;
      return RAMP.glass[d > 5 && d < 9 ? 4 : d > 13 && d < 14.5 ? base + 1 : base];
    };
    p.c.globalAlpha = 0.5;
    pt(p, F, A0, A1, ZB, ZW, glassTex(1));
    pt(p, S, B0, B1, ZB, ZW, glassTex(0));
    p.c.globalAlpha = 1;
    const frame = '#f2ead8';
    const frameS = '#c8bea8';
    for (let a = A0; a <= A1 + 0.01; a += (A1 - A0) / 6) beam(p, F, a, ZB, a, ZW, 1.4, frame);
    for (let b = B0; b <= B1 + 0.01; b += (B1 - B0) / 4) beam(p, S, b, ZB, b, ZW, 1.4, frameS);
    beam(p, F, A0, ZB + 13, A1, ZB + 13, 1, frame);
    beam(p, S, B0, ZB + 13, B1, ZB + 13, 1, frameS);
    beam(p, F, A0, ZW, A1, ZW, 1.6, frame);
    // door
    pq(p, F, 1.7, 2.3, ZB - 8, ZW - 4, mix(RAMP.glass[0], OUTL, 0.3));
    pt(p, F, 1.75, 2.25, ZB - 7.5, ZW - 4.5, glassTex(1));
    beam(p, F, 2.0, ZB - 7, 2.0, ZW - 5, 1, frame);
    // glass gable roof
    const ZR = ZW + 16;
    const bm = (B0 + B1) / 2;
    const roofTex = (light: 0 | 1 | 2) => (u: number, v: number) => {
      const d = (u + v * 1.4) % 34;
      return RAMP.glass[d > 6 && d < 10 ? 4 : light === 1 ? 3 : 2];
    };
    p.c.globalAlpha = 0.75;
    texParaQ(p, [A0 - 0.08, B0, ZW], [A1 - A0 + 0.16, 0, 0], [0, bm - B0, ZR - ZW], ((l: 0 | 1 | 2) => roofTex(l)) as never, 0);
    const g0 = S.F(B0, ZW);
    const g1 = S.F(B1, ZW);
    const g2 = S.F(bm, ZR);
    poly(p.c, [g0, g1, g2], RAMP.glass[2]);
    texParaQ(p, [A0 - 0.08, B1, ZW], [A1 - A0 + 0.16, 0, 0], [0, bm - B1, ZR - ZW], ((l: 0 | 1 | 2) => roofTex(l)) as never, 1);
    p.c.globalAlpha = 1;
    for (let a = A0; a <= A1 + 0.01; a += (A1 - A0) / 6) {
      const e = p.P(a, B1, ZW);
      const r = p.P(a, bm, ZR);
      p.c.fillStyle = frame;
      const n = Math.max(Math.abs(r[0] - e[0]), Math.abs(r[1] - e[1]));
      for (let s = 0; s <= n; s++) p.c.fillRect(Math.round(e[0] + ((r[0] - e[0]) * s) / n), Math.round(e[1] + ((r[1] - e[1]) * s) / n), 2, 1);
    }
    beam(p, S, B0, ZW, bm, ZR, 1.4, frameS);
    beam(p, S, B1, ZW, bm, ZR, 1.4, frameS);
    const c0 = p.P(A0 - 0.08, bm, ZR);
    const c1 = p.P(A1 + 0.08, bm, ZR);
    poly(p.c, [[c0[0], c0[1] - 1], [c1[0], c1[1] - 1], [c1[0], c1[1] + 1], [c0[0], c0[1] + 1]], frame);
    // pots and a watering can at the door
    for (const [a, col] of [[0.6, '#f08aa8'], [1.1, '#f6d860'], [3.2, '#c49cf2']] as const) potHD(p, a, B1 + 0.18, col);
  },
};

export function potHD(p: PropPainter, a: number, b: number, bloom: string, size = 1) {
  const [x, y] = p.P(a, b, 0);
  const w = Math.round(8 * size);
  const h = Math.round(7 * size);
  ellipse(p.c, x + 3, y + 1, w * 0.7, 2.5, 'rgba(42,26,42,0.3)');
  px(p.c, x - w / 2 - 1, y - h - 1, OUTL, w + 2, h + 2);
  px(p.c, x - w / 2, y - h, RAMP.terracotta[3], w, h);
  px(p.c, x - w / 2, y - h, RAMP.terracotta[4], 2, h);
  px(p.c, x + w / 2 - 2, y - h, RAMP.terracotta[2], 2, h);
  px(p.c, x - w / 2 - 1, y - h - 2, RAMP.terracotta[4], w + 2, 2);
  canopy(p.c, x, y - h - 4 * size, 5 * size, 4 * size, Math.floor(x * 7 + y), { ramp: RAMP.leaf, rmin: 1.8, rmax: 2.8 * size, dots: [bloom, lighten(bloom, 0.3)], dotChance: 0.85 });
}

// ── tool shed ───────────────────────────────────────────────
const shed: PropArt = {
  draw(p) {
    const A0 = 0.15;
    const A1 = 1.85;
    const B0 = 0.2;
    const B1 = 1.8;
    castShadow(p, A0, B0, A1 - A0, B1 - B0, 44);
    tbox(p, A0, B0, A1 - A0, B1 - B0, 0, 26, { left: boards(RAMP.woodPale, 5), right: boards(RAMP.woodPale, 5), edge: RAMP.woodPale[0] });
    const F = front(p, B1);
    const S = side(p, A1);
    doorOn(p, F, 0.7, 1.35, 0, 19, RAMP.teal);
    windowOn(p, S, 0.6, 1.3, 11, 19, { muntins: true });
    // mono-pitch roof sloping to the front
    texParaQ(p, [A0 - 0.15, B1 + 0.2, 25], [A1 - A0 + 0.3, 0, 0], [0, -(B1 - B0) - 0.35, 10], shingles(RAMP.roof, 4, 6), 1);
    const s0 = p.P(A1 + 0.15, B1 + 0.2, 25);
    const s1 = p.P(A1 + 0.15, B0 - 0.15, 35);
    poly(p.c, [[s0[0], s0[1]], [s1[0], s1[1]], [s1[0], s1[1] + 3], [s0[0], s0[1] + 3]], RAMP.roof[0]);
    // tools leaning on the side: rake and spade
    const [tx, ty] = S.F(B1 - 0.25, 0);
    for (const [dx, col] of [[0, RAMP.wood[3]], [5, RAMP.wood[2]]] as const) {
      for (let i = 0; i < 26; i++) px(p.c, tx + dx + 4 + i * 0.15, ty - i, col);
    }
    px(p.c, tx + 6, ty - 30, RAMP.metal[3], 6, 2);
    for (let i = 0; i < 3; i++) px(p.c, tx + 6 + i * 2, ty - 28, RAMP.metal[1], 1, 2);
    px(p.c, tx + 9, ty - 4, RAMP.metal[2], 4, 5);
    // weeds
    for (let i = 0; i < 3; i++) {
      const [x, y] = p.P(A0 + 0.1 + i * 0.25, B1 + 0.05, 0);
      tuft(p.c, x, y, RAMP.leafWarm, i * 3 + 9);
    }
  },
};

// ── chicken coop ────────────────────────────────────────────
const coop: PropArt = {
  draw(p) {
    castShadow(p, 0.2, 0.25, 1.6, 1.5, 40);
    // stilts
    for (const [a, b] of [[0.3, 0.4], [1.7, 0.4], [0.3, 1.6], [1.7, 1.6]] as const) tbox(p, a - 0.06, b - 0.06, 0.12, 0.12, 0, 9, { left: solid(RAMP.wood), right: solid(RAMP.wood), top: solid(RAMP.wood) });
    tbox(p, 0.2, 0.3, 1.6, 1.4, 9, 20, { left: boards(RAMP.woodPale, 4), right: boards(RAMP.woodPale, 4), top: solid(RAMP.woodPale), edge: RAMP.woodPale[0] });
    const F = front(p, 1.7);
    pq(p, F, 0.75, 1.15, 10, 19, OUTL);
    pq(p, F, 0.8, 1.1, 10, 18, '#2e2020');
    windowOn(p, side(p, 1.8), 0.7, 1.2, 18, 25, { muntins: false });
    // little ramp with slats
    const r0 = p.P(0.95, 1.7, 10);
    const r1 = p.P(0.95, 2.0, 0);
    p.c.fillStyle = RAMP.wood[3];
    for (let i = 0; i < 10; i++) p.c.fillRect(Math.round(r0[0] + ((r1[0] - r0[0]) * i) / 10) - 3, Math.round(r0[1] + ((r1[1] - r0[1]) * i) / 10), 7, 2);
    gableRoof(p, 0.2, 1.8, 0.3, 1.7, 29, 40, RAMP.red, 0.18, (bm) => {
      const S = side(p, 1.8);
      poly(p.c, [S.F(0.3, 29), S.F(1.7, 29), S.F(bm, 40)], darken(RAMP.woodPale[2], 0.15));
    });
    // straw on the ground
    const [hx, hy] = p.P(1.0, 1.95, 0);
    for (let i = 0; i < 18; i++) px(p.c, hx - 10 + hh(i, 4) * 20, hy - 2 + hh(i, 5) * 5, RAMP.hay[hh(i, 6) > 0.5 ? 4 : 2], 2, 1);
  },
};

// ── pergola with climbing roses and string lights ─────────
const pergola: PropArt = {
  draw(p, k) {
    const Z = 42;
    const posts: [number, number][] = [[0.15, 0.15], [3.85, 0.15], [0.15, 2.85], [3.85, 2.85]];
    for (const [a, b] of posts) tbox(p, a - 0.08, b - 0.08, 0.16, 0.16, 0, Z, { left: siding(RAMP.wood, 6), right: siding(RAMP.wood, 6), top: solid(RAMP.wood), edge: RAMP.wood[0] });
    // beams along a and rafters along b
    for (const b of [0.15, 2.85]) tbox(p, -0.1, b - 0.07, 4.2, 0.14, Z, 3, { left: solid(RAMP.wood), right: solid(RAMP.wood), top: solid(RAMP.wood), edge: RAMP.wood[0] });
    for (let i = 0; i < 7; i++) tbox(p, 0.1 + i * 0.63, -0.1, 0.1, 3.2, Z + 3, 2.5, { left: solid(RAMP.woodPale), right: solid(RAMP.woodPale), top: solid(RAMP.woodPale), edge: RAMP.wood[0] });
    // roses climbing the front posts and spreading over the top
    for (const [a, b] of [[0.15, 2.85], [3.85, 2.85], [3.85, 0.15]] as const) {
      const pts = Array.from({ length: 6 }, (_, i) => p.P(a, b, 4 + i * 7.5) as [number, number]);
      climber(p, pts, k.seed * 3 + a * 10 + b);
    }
    for (let i = 0; i < 24; i++) {
      const [x, y] = p.P(0.2 + (i % 6) * 0.72 + hh(i, 1) * 0.4, 0.15 + Math.floor(i / 6) * 0.72 + hh(i, 2) * 0.3, Z + 5);
      canopy(p.c, x, y, 11, 7, i * 31 + k.seed, { ramp: RAMP.leafWarm, rmin: 2.4, rmax: 3.8, dots: ROSES, dotChance: 0.7 });
    }
    // hanging tendrils between the rafters
    for (let i = 0; i < 10; i++) {
      const [x, y] = p.P(0.3 + hh(i, 4) * 3.4, 2.85, Z);
      for (let j = 0; j < 4 + hh(i, 5) * 8; j++) px(p.c, x + (j % 3 === 2 ? 1 : 0), y + j, RAMP.leafWarm[2 + (j & 1)]);
    }
  },
  anim(p, k) {
    // string lights sagging between the front posts, gently twinkling
    const Z = 39;
    for (const [a0, b0, a1, b1] of [[0.15, 2.85, 3.85, 2.85], [3.85, 2.85, 3.85, 0.15]] as const) {
      const n = 10;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const sag = Math.sin(t * Math.PI) * 6;
        const [x, y] = p.P(a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, Z - sag);
        const on = Math.sin(k.t * 2 + i * 1.7) > -0.6;
        px(p.c, x, y, OUTL, 1, 1);
        px(p.c, x - 1, y + 1, on ? '#ffe9a8' : '#c9a55a', 3, 2);
        if (on) px(p.c, x, y + 1, '#fffbe6');
      }
    }
  },
};

// ── stone well with a little roof ──────────────────────────
const well: PropArt = {
  draw(p) {
    castShadow(p, 0.15, 0.15, 0.7, 0.7, 40);
    tbox(p, 0.12, 0.12, 0.76, 0.76, 0, 12, { left: stones(RAMP.stone, 4, 0.3), right: stones(RAMP.stone, 4, 0.3), top: solid(RAMP.stone), edge: RAMP.stone[0] });
    const [x, y] = p.P(0.5, 0.5, 12);
    ellipse(p.c, x, y, 9, 4.5, RAMP.water[0]);
    ellipse(p.c, x - 1, y - 1, 5, 2, RAMP.water[2]);
    for (const a of [0.18, 0.82]) tbox(p, a - 0.04, 0.46, 0.08, 0.08, 12, 20, { left: solid(RAMP.wood), right: solid(RAMP.wood), top: solid(RAMP.wood) });
    gableRoof(p, 0.05, 0.95, 0.15, 0.85, 32, 40, RAMP.roof, 0.08);
    const [bx, by] = p.P(0.5, 0.5, 22);
    px(p.c, bx - 3, by - 4, OUTL, 7, 6);
    px(p.c, bx - 2, by - 3, RAMP.wood[3], 5, 4);
    px(p.c, bx, by - 12, RAMP.iron[2], 1, 8);
  },
};

export const FARM_BUILDINGS: Record<string, PropArt> = { farmhouse, barn, greenhouse2, shed, coop, pergola, well };
export { climber, bedAlong, ROSES, MIXED, flowers };

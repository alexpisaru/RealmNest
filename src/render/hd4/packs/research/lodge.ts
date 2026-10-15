// Research Hub — the buildings of the summit (1 z ≈ 10 cm; a storey ≈ 30–40 z).
//   res_lodge    the observatory lodge's chalet block: a gneiss ground floor,
//                a larch-log upper storey with a carved balcony and flamed
//                shutters, a stone-slab roof with chimneys, the front door
//   res_chapel   a little whitewashed chapel with a shingled bell turret
//   res_station  the cable car's top station: concrete hall, bull wheel, cabin
//   res_pylon    a lattice pylon; its live part strings the cables down into
//                the valley and runs the cabins
//   res_cross    the summit cross on its knoll of rocks
// Visible faces are the front (b = d) and the side (a = w); roofs are drawn
// with poly3 so every slope, gable and eave is exactly clipped.
import { darken, lighten } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp } from '../../kit4';
import { glass4 } from '../../materials4';
import { front3, poly3, pq, pt, side3 } from '../../plane4';
import { grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { grassSkirt, limewash, logs, rockMass, rubble } from './kit';
import { CONCRETE, GNEISS, IRONK, LARCHF, MORTAR, PIODE, RED, ROCK, STEEL, TERRA, TIMBER } from './palette';

type V3 = [number, number, number];
type Pl = ReturnType<typeof front3>;

const GRANITE: Ramp = ['#4a4a4e', '#5e5e62', '#747476', '#8a8a8a', '#a09e9a', '#b6b2ac', '#cac6be'];
const SHUT: Ramp = ['#14281c', '#1c3826', '#264a32', '#305c3e', '#3e704c', '#4e845c'];
const WHITE: Ramp = ['#8a8a86', '#a6a6a0', '#c4c2ba', '#dcdad2', '#ecebe4', '#f8f7f2'];
const GLASS: Ramp = ['#1c2c34', '#24404a', '#30545e', '#466e76', '#6a9096', '#9ab8ba', '#d0e2e0'];

/** Masonry with a dressed plinth course. */
const stoneWall =
  (plinth = 10): Mat =>
  (light, w, h) => {
    const r = rubble(GNEISS, MORTAR, 15)(light, w, h);
    return (u, v, x, y) => {
      if (v < plinth) return at(GRANITE, (light ? 3.4 : 2) + ((u % 46) < 1.3 ? -2 : 0) + (v > plinth - 1.4 ? 1 : 0) - (v < 2 ? 1 : 0) + (hash(x, y, 3) < 0.06 ? -1 : 0));
      return r(u, v, x, y);
    };
  };

/** Vertical larch boards, sun-burnt almost black at the top, for gables. */
const gableBoards: Mat = (light, _w, h) => (u, v, x, y) => {
  const b = Math.floor(u / 10);
  const fu = u - b * 10;
  if (fu < 1.2) return TIMBER[0];
  let i = (light ? 3.6 : 2.2) + (hash(b, 2, 9) - 0.5) * 1.2 - (v / Math.max(1, h)) * 0.9;
  if (noise2(fu * 0.5 + b * 9, v * 0.05, 10) > 0.66) i -= 1;
  if (hash(x, y, 11) < 0.03) i -= 1;
  return at(TIMBER, i);
};

/** A window with a granite or timber surround, glass, glazing bars and two shutters. */
function chaletWindow(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, o: { stone?: boolean; flamed?: boolean; box?: boolean; bars?: boolean; lit?: boolean; seed: number }) {
  const L = pl.light;
  const sw = (u1 - u0) * 0.5;
  // surround
  if (o.stone) pq(p, pl, u0 - 0.09, u1 + 0.09, z0 - 1.1, z1 + 1.1, at(GRANITE, L ? 5 : 3));
  else pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 0.6, z1 + 0.8, at(LARCHF, L ? 4 : 2));
  pq(p, pl, u0 - 0.09, u1 + 0.09, z0 - 1.1, z0 - 0.6, darken(GRANITE[2], 0.25));
  // glass with a curtain and a reflection
  pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => {
    if ((u * 0.8 + v) % 34 < 4) return GLASS[5];
    if (o.lit) return v > (z1 - z0) * 4 - 6 ? '#c88a3a' : (u + v) % 19 < 3 ? '#fff0b8' : hash(x, y, 2) < 0.5 ? '#f6cc6a' : '#eab452';
    if (u < 5 || u > (u1 - u0) * 64 - 5) return '#e8dcc4';
    return v > (z1 - z0) * 4 - 5 ? GLASS[0] : GLASS[1];
  }, L);
  const um = (u0 + u1) / 2;
  const zm = (z0 + z1) / 2;
  const fr = L ? '#e8e2d4' : '#b8b2a6';
  const bar = (ua: number, za: number, ub: number, zb: number) => {
    const [x0, y0] = pl.F(ua, za);
    const [x1, y1] = pl.F(ub, zb);
    ln(p.c, x0, y0, x1, y1, fr, 2);
  };
  bar(um, z0, um, z1);
  bar(u0, zm, u1, zm);
  // iron grilles on ground-floor windows
  if (o.bars) for (let u = u0 + 0.08; u < u1; u += 0.12) {
    const [x0, y0] = pl.F(u, z0);
    const [x1, y1] = pl.F(u, z1);
    ln(p.c, x0, y0, x1, y1, IRONK[2]);
  }
  // shutters: green, louvred on the ground floor; flamed green and white above
  for (const [a, b] of [[u0 - sw - 0.05, u0 - 0.05], [u1 + 0.05, u1 + sw + 0.05]] as const) {
    pq(p, pl, a - 0.015, b + 0.015, z0 - 0.3, z1 + 0.3, SHUT[0]);
    pt(p, pl, a, b, z0, z1, (u: number, v: number) => {
      if (o.flamed) {
        const s = Math.floor((u + v * 0.8) / 4.5) % 2;
        if (u < 1.4 || u > sw * 64 - 1.4) return SHUT[L ? 3 : 2];
        return s ? SHUT[L ? 4 : 3] : L ? '#e8e4d8' : '#c0bcb0';
      }
      return at(SHUT, (L ? 3.4 : 2.2) + (v % 2.6 < 0.9 ? -1.2 : 0.3));
    }, L);
  }
  // a box of red geraniums under the sill
  if (o.box) {
    pq(p, pl, u0 - 0.1, u1 + 0.1, z0 - 3.4, z0 - 1.2, TIMBER[2]);
    pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 3.2, z0 - 1.4, L ? TIMBER[4] : TIMBER[3]);
    const [ax, ay] = pl.F(u0 - 0.08, z0 - 1.2);
    const [bx, by] = pl.F(u1 + 0.08, z0 - 1.2);
    const masses: Mass[] = [];
    const n = 5;
    for (let i = 0; i <= n; i++) masses.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n - 5, rx: 7, ry: 6, z: i });
    layer(p.c, (l) => {
      foliage(l, masses, ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042', '#86b852'], o.seed, { cell: 2.4, dots: ['#d8302a', '#e84a3a', '#f0604a', '#ff7a6a'], dotChance: 0.95, dotSize: 3 });
      for (let i = 0; i < n; i += 2) for (let q = 0; q < 9; q++) px(l, ax + ((bx - ax) * (i + 0.5)) / n + (q % 3 === 2 ? 1 : 0), ay + ((by - ay) * (i + 0.5)) / n + 2 + q, ['#2e5a24', '#3c702c'][q & 1]);
    }, { outline: 0.6 });
  }
}

/** Slate shingles: small overlapping rows, each slate with a lit lip and a dark seam under it. */
const slates =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / 7);
    const fv = v - row * 7;
    const off = row & 1 ? 6 : 0;
    const col = Math.floor((u + off) / 12);
    const fu = u + off - col * 12;
    let i = (light === 2 ? 3.6 : light ? 2.8 : 1.6) + (hash(col, row, 111) - 0.5) * 1.9;
    if (fv < 1.3) return at(r, i - 2.6);
    if (fv > 5.4) i += 1.3;
    if (fu < 1) i -= 1.3;
    if (hash(x, y, 112) < 0.04) i -= 0.8;
    // lichen on a few old slates
    if (hash(col, row, 113) < 0.015 && fv > 2) return '#7a8466';
    return at(r, i);
  };

/** Old snow lying in patches on a roof: drifts against the ridge, blue on their lower edges. */
const snowy =
  (m: Mat, seed: number, amt = 0.3): Mat =>
  (light, w, h) => {
    const r = m(light, w, h);
    return (u, v, x, y) => {
      const n = noise2(u * 0.016 + seed, v * 0.034, 120) * 0.75 + noise2(u * 0.06, v * 0.12, 121) * 0.25;
      const t = 0.84 - amt * 0.2;
      if (n > t) {
        const under = noise2(u * 0.016 + seed, (v + 4) * 0.034, 120) * 0.75 + noise2(u * 0.06, (v + 4) * 0.12, 121) * 0.25;
        if (n < t + 0.025 || under < t) return light === 2 ? '#c8d8ec' : '#a8bcd6';
        return light === 2 ? (hash(x, y, 7) < 0.1 ? '#e2ecf8' : '#f4f9fe') : hash(x, y, 7) < 0.1 ? '#c6d6ea' : '#d8e4f4';
      }
      return r(u, v, x, y);
    };
  };

/** A chimney of stone with a slab cap on four little posts. */
function chimney(p: PropPainter, a: number, b: number, z0: number, h: number) {
  const st = rubble(GNEISS, MORTAR, 9);
  lbox(p, a, b, 0.5, 0.5, z0, h, { front: st, side: st, top: () => () => '#1e1a18', edge: GNEISS[0] });
  for (const [da, db] of [[0, 0], [0.42, 0], [0, 0.42], [0.42, 0.42]] as const) lbox(p, a + da, b + db, 0.08, 0.08, z0 + h, 2.6, mono(paint(GRANITE), GRANITE[1]));
  lbox(p, a - 0.1, b - 0.1, 0.7, 0.7, z0 + h + 2.6, 1.1, { front: paint(PIODE), side: paint(PIODE), top: paint(PIODE), edge: PIODE[0] });
}

// ── the lodge ───────────────────────────────────────────────
const res_lodge: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const A0 = 0.4;
    const A1 = W - 0.3;
    const B0 = 0.5;
    const B1 = D - 0.7;
    const GF = 40;
    const UF = 70;
    const am = (A0 + A1) / 2;
    const hw = (A1 - A0) / 2;
    const slope = 0.44 * 16; // z per tile across the roof
    const RID = UF + hw * slope;
    footShadow(p, 0.2, 0.3, W - 0.1, D - 0.4, 90, 0.34);
    const F = front3(p, B1);
    const S = side3(p, A1);
    // ── the walls: gneiss below, logs above, a timber sill beam between
    // (the east ground floor stands behind the library's wall: only its north end shows)
    pt(p, S, B0, Math.min(B1, 3.6), 0, GF, stoneWall(), S.light);
    pt(p, F, A0, A1, 0, GF, stoneWall(), F.light);
    pt(p, S, B0, B1, GF, UF, logs(TIMBER, 9), S.light);
    pt(p, F, A0, A1, GF, UF, logs(TIMBER, 9), F.light);
    for (const pl of [F, S]) {
      const [u0, u1] = pl === F ? [A0, A1] : [B0, B1];
      pq(p, pl, u0, u1, GF - 0.6, GF + 1.2, at(TIMBER, pl.light ? 4 : 2));
      pq(p, pl, u0, u1, GF - 0.9, GF - 0.6, darken(TIMBER[0], 0.3));
    }
    // dressed quoins at the front corners of the ground floor
    for (const [pl, u, dir] of [[F, A0, 1], [F, A1, -1], [S, B1, -1]] as const)
      for (let z = 10; z < GF - 2; z += 4) {
        const big = Math.floor(z / 4) % 2 === 0;
        const w0 = big ? 0.45 : 0.28;
        const ua = dir > 0 ? u : u - w0;
        const ub = dir > 0 ? u + w0 : u;
        pq(p, pl, ua, ub, z, z + 3.6, at(GRANITE, pl.light ? 4.4 : 2.4));
        pq(p, pl, ua, ub, z, z + 0.4, GRANITE[1]);
      }
    // ── the gable over the front: vertical boards, a pair of attic windows
    poly3(p, [[A0, B1, UF], [A1, B1, UF], [am, B1, RID]], gableBoards, 1, [[A0, B1, UF], [A1, B1, UF], [A0, B1, RID]]);
    chaletWindow(p, F, am - 0.75, am - 0.15, UF + 6, UF + 15, { flamed: true, lit: true, seed: k.seed + 9 });
    chaletWindow(p, F, am + 0.15, am + 0.75, UF + 6, UF + 15, { flamed: true, seed: k.seed + 10 });
    // a carved plank with the year under the attic windows
    pq(p, F, am - 1.2, am + 1.2, UF + 2.2, UF + 4.2, TIMBER[4]);
    for (let i = 0; i < 4; i++) {
      const [x, y] = F.F(am - 0.5 + i * 0.32, UF + 3.2);
      px(p.c, x - 1, y - 2, '#e8d8b0', 2, 4);
    }
    // ── the front: door, windows, the name board, lanterns
    const door = (pl: Pl, c: number) => {
      // a round-arched granite surround, the larch door with iron studs
      const pts: [number, number][] = [[c - 0.62, 0]];
      for (let j = 0; j <= 12; j++) {
        const t = Math.PI - (j / 12) * Math.PI;
        pts.push([c + Math.cos(t) * 0.62, 21 + Math.sin(t) * 9]);
      }
      pts.push([c + 0.62, 0]);
      poly3(p, pts.map(([u, z]) => pl.at(u, z)), (_u: number, _v: number, x: number, y: number) => at(GRANITE, (pl.light ? 4.4 : 2.6) - (hash(x, y, 13) < 0.08 ? 1 : 0)), pl.light);
      const inner: [number, number][] = [[c - 0.48, 0]];
      for (let j = 0; j <= 12; j++) {
        const t = Math.PI - (j / 12) * Math.PI;
        inner.push([c + Math.cos(t) * 0.48, 21 + Math.sin(t) * 7]);
      }
      inner.push([c + 0.48, 0]);
      poly3(p, inner.map(([u, z]) => pl.at(u, z)), (u: number, v: number, x: number, y: number) => {
        const b = Math.floor(u / 9);
        if (u - b * 9 < 1.1) return TIMBER[0];
        if (Math.abs(v - 28) < 1.5 || Math.abs(v - 72) < 1.5) return IRONK[2];
        if ((Math.abs(v - 28) < 4 || Math.abs(v - 72) < 4) && (u % 9) > 4 && (u % 9) < 5.5) return IRONK[4];
        return at(TIMBER, (pl.light ? 4 : 3) + (hash(b, 3, 14) - 0.5) + (hash(x, y, 15) < 0.04 ? -1 : 0));
      }, pl.light);
      const [rx, ry] = pl.F(c + 0.3, 10);
      ell(p.c, rx, ry, 3, 3, IRONK[3]);
      px(p.c, rx - 1, ry - 1, IRONK[5], 1, 1);
      // granite steps
      for (let s = 0; s < 2; s++) lbox(p, c - 0.8 + s * 0.1, B1 + 0.02, 1.6 - s * 0.2, 0.45 - s * 0.2, s * 1.6, 1.6, mono(paint(GRANITE), GRANITE[1]));
      // lanterns either side
      for (const du of [-0.95, 0.95]) {
        const [lx, ly] = pl.F(c + du, 24);
        layer(p.c, (l) => {
          px(l, lx - 1, ly - 2, IRONK[3], 3, 4);
          fillPoly(l, [[lx - 5, ly + 2], [lx + 5, ly + 2], [lx + 4, ly + 13], [lx - 4, ly + 13]], IRONK[2]);
          fillPoly(l, [[lx - 4, ly + 4], [lx + 4, ly + 4], [lx + 3, ly + 12], [lx - 3, ly + 12]], '#f6d890');
          fillPoly(l, [[lx - 6, ly + 2], [lx + 6, ly + 2], [lx, ly - 4]], IRONK[3]);
        });
      }
    };
    door(F, am);
    // the name board over the door
    pq(p, F, am - 1.5, am + 1.5, 31.5, 36.5, TIMBER[1]);
    pq(p, F, am - 1.42, am + 1.42, 31.9, 36.1, '#e8dcbc');
    for (let i = 0; i < 11; i++) {
      const [x, y] = F.F(am - 1.15 + i * 0.23, 34.2);
      px(p.c, x - 1, y - 3, i === 5 ? '#c8382a' : '#3a2a20', 2 + (i % 3 === 0 ? 1 : 0), 5);
    }
    const gw: [number, number][] = [[1.25, 2.15], [2.85, 3.75], [6.05, 6.95], [7.65, 8.55]];
    gw.forEach(([u0, u1], i) => chaletWindow(p, F, A0 + u0 - 0.4, A0 + u1 - 0.4, 13, 28, { stone: true, bars: true, box: true, lit: i !== 1, seed: k.seed + i }));
    chaletWindow(p, S, B0 + 1.4, B0 + 2.25, 13, 28, { stone: true, bars: true, seed: k.seed + 20 });
    // the upper storey windows (behind the balcony on the front)
    gw.forEach(([u0, u1], i) => chaletWindow(p, F, A0 + u0 - 0.35, A0 + u1 - 0.45, 47, 60, { flamed: true, box: i > 1, lit: i !== 2, seed: k.seed + 30 + i }));
    for (let i = 0; i < 6; i++) {
      const b0 = B0 + 1.4 + i * 2.65;
      chaletWindow(p, S, b0, b0 + 0.75, 47, 60, { flamed: true, box: true, lit: i % 3 !== 1, seed: k.seed + 40 + i });
    }
    // ── the balcony across the front: brackets, deck, a balustrade with cut-outs, flowers
    const bz = GF + 1.4;
    const bd = 0.78;
    // the balcony wraps the west end of the front only; the porch stands under the east half
    const BA1 = am - 1.2;
    for (let a = A0 + 0.5; a < BA1 - 0.2; a += 1.1) {
      const [x0, y0] = p.P(a, B1, bz - 5);
      const [x1, y1] = p.P(a, B1 + bd - 0.05, bz);
      const [x2, y2] = p.P(a, B1, bz);
      fillPoly(p.c, [[x0, y0], [x1, y1], [x2, y2]], TIMBER[3]);
      ln(p.c, x0, y0, x1, y1, TIMBER[5]);
    }
    lbox(p, A0 + 0.15, B1, BA1 - A0 - 0.15, bd, bz, 1.2, { front: paint(TIMBER), side: paint(TIMBER), top: grain(LARCHF), edge: TIMBER[0] });
    const BF = front3(p, B1 + bd - 0.04);
    const BS = side3(p, BA1);
    const balTex: FaceTex = (u, v) => {
      const b = Math.floor(u / 9);
      const fu = u - b * 9;
      if (fu < 1) return TIMBER[0];
      // a heart cut through every other board, showing the dark behind
      if (b % 2 === 0) {
        const hu = (fu - 4.5) / 2.2;
        const hv = (v - 18) / 2.2;
        if (Math.pow(hu * hu + hv * hv - 1, 3) - hu * hu * hv * hv * hv < 0) return '#1a120c';
      }
      return at(TIMBER, 4 + (hash(b, 5, 16) - 0.5) - (v < 3 ? 1 : 0));
    };
    pt(p, BF, A0 + 0.15, BA1, bz + 1.2, bz + 10, balTex, 1);
    pt(p, BS, B1, B1 + bd - 0.04, bz + 1.2, bz + 10, balTex, 0);
    lbox(p, A0 + 0.1, B1 + bd - 0.12, BA1 - A0 - 0.05, 0.12, bz + 10, 0.9, { front: paint(TIMBER), side: paint(TIMBER), top: grain(LARCHF), edge: TIMBER[0] });
    // flower boxes hung on the balustrade
    for (let i = 0; i < 2; i++) {
      const a0 = A0 + 0.45 + i * 1.75;
      const [ax, ay] = p.P(a0, B1 + bd, bz + 10);
      const [bx, by] = p.P(a0 + 1.6, B1 + bd, bz + 10);
      const masses: Mass[] = [];
      for (let j = 0; j <= 8; j++) masses.push({ x: ax + ((bx - ax) * j) / 8, y: ay + ((by - ay) * j) / 8 - 3, rx: 6, ry: 5, z: j });
      layer(p.c, (l) => {
        fillPoly(l, [[ax, ay - 1], [bx, by - 1], [bx, by + 5], [ax, ay + 5]], TIMBER[3]);
        foliage(l, masses, ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042', '#86b852'], k.seed + i * 7, { cell: 2.6, dots: ['#d8302a', '#e84a3a', '#f05a6a', '#f2eee2'], dotChance: 0.9, dotSize: 3 });
        for (let j = 0; j < 8; j += 2) for (let q = 0; q < 12 + (j % 3) * 4; q++) px(l, ax + ((bx - ax) * (j + 0.5)) / 8 + (q % 4 === 3 ? 1 : 0), ay + ((by - ay) * (j + 0.5)) / 8 + 4 + q, ['#2e5a24', '#3c702c'][q & 1]);
      }, { outline: 0.6 });
    }
    // ── the entrance porch: two larch posts, a beam, a little gable roof of slates over the door
    {
      const pb1 = B1 + 0.62;
      const pz = 30;
      const pr = 38.5;
      const pe = 1.2;
      for (const da of [-0.85, 0.85]) {
        lbox(p, am + da - 0.1, pb1 - 0.2, 0.2, 0.2, 0, 1.6, mono(paint(GRANITE), GRANITE[1]));
        lbox(p, am + da - 0.07, pb1 - 0.17, 0.14, 0.14, 1.6, pz - 1.6, mono(grain(LARCHF), LARCHF[0]));
      }
      lbox(p, am - 1.05, pb1 - 0.2, 2.1, 0.2, pz - 2.2, 2.2, mono(paint(TIMBER), TIMBER[0]));
      poly3(p, [[am - 1.05, pb1, pz], [am + 1.05, pb1, pz], [am, pb1, pr - 1]], gableBoards, 1, [[am - 1.05, pb1, pz], [am + 1.05, pb1, pz], [am - 1.05, pb1, pr]]);
      const Bf2 = pb1 + 0.16;
      const pRoof = snowy(slates(PIODE), 5, 0.28);
      poly3(p, [[am - pe, B1, pz - 1.2], [am - pe, Bf2, pz - 1.2], [am, Bf2, pr], [am, B1, pr]], pRoof, 2, [[am - pe, Bf2, pz - 1.2], [am - pe, B1, pz - 1.2], [am, Bf2, pr]]);
      poly3(p, [[am, B1, pr], [am, Bf2, pr], [am + pe, Bf2, pz - 1.2], [am + pe, B1, pz - 1.2]], pRoof, 1, [[am + pe, Bf2, pz - 1.2], [am + pe, B1, pz - 1.2], [am, Bf2, pr]]);
      const q0 = p.P(am - pe, Bf2, pz - 1.2);
      const q1 = p.P(am, Bf2, pr);
      const q2 = p.P(am + pe, Bf2, pz - 1.2);
      ln(p.c, q0[0], q0[1], q1[0], q1[1], TIMBER[4], 3);
      ln(p.c, q1[0], q1[1], q2[0], q2[1], TIMBER[2], 3);
      ln(p.c, q0[0], q0[1] + 3, q1[0], q1[1] + 3, TIMBER[1], 1);
      // a lantern hanging under the gable, geraniums in tubs either side of the steps
      const [hx, hy] = p.P(am, pb1, pz - 3);
      layer(p.c, (l) => {
        px(l, hx, hy - 4, IRONK[2], 1, 4);
        fillPoly(l, [[hx - 4, hy], [hx + 5, hy], [hx + 4, hy + 9], [hx - 3, hy + 9]], IRONK[2]);
        fillPoly(l, [[hx - 3, hy + 2], [hx + 4, hy + 2], [hx + 3, hy + 8], [hx - 2, hy + 8]], '#f6d890');
      });
      for (const da of [-1.25, 1.25]) {
        lbox(p, am + da - 0.18, pb1 - 0.3, 0.36, 0.36, 0, 4, mono(paint(TERRA), TERRA[0]));
        const [tx, ty] = p.P(am + da, pb1 - 0.12, 4);
        layer(p.c, (l) => foliage(l, [{ x: tx, y: ty - 5, rx: 12, ry: 8, z: 0 }, { x: tx - 6, y: ty - 2, rx: 7, ry: 5, z: 1 }, { x: tx + 7, y: ty - 3, rx: 7, ry: 5, z: 2 }], ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042', '#86b852'], k.seed + Math.round(da * 10), { cell: 2.4, dots: ['#d8302a', '#e84a3a', '#f0604a'], dotChance: 0.9, dotSize: 3 }), { outline: 0.6 });
      }
    }
    // ── the roof: two stone-slab slopes, deep eaves at the gable
    const oh = 0.9;
    const Ae = A0 - 0.5;
    const Ae2 = A1 + 0.22;
    const Ze = UF - 0.5 * slope;
    const Ze2 = UF - 0.22 * slope;
    const Bb = B0 - 0.4;
    const Bf = B1 + oh;
    const roofW = snowy(slates(PIODE), 3, 0.32);
    poly3(p, [[Ae, Bb, Ze], [Ae, Bf, Ze], [am, Bf, RID], [am, Bb, RID]], roofW, 2, [[Ae, Bf, Ze], [Ae, Bb, Ze], [am, Bf, RID]]);
    poly3(p, [[am, Bb, RID], [am, Bf, RID], [Ae2, Bf, Ze2], [Ae2, Bb, Ze2]], roofW, 1, [[Ae2, Bf, Ze2], [Ae2, Bb, Ze2], [am, Bf, RID]]);
    // purlin ends under the front eave, the carved bargeboards, the ridge, the eaves
    for (const t of [0.18, 0.5, 0.82]) {
      for (const sgn of [-1, 1]) {
        const a = am + sgn * hw * t;
        const z = RID - hw * t * slope - 2.2;
        lbox(p, a - 0.1, B1, 0.2, oh - 0.05, z - 1.6, 1.6, { front: paint(TIMBER), side: paint(TIMBER), top: paint(TIMBER), edge: TIMBER[0] });
      }
    }
    lbox(p, am - 0.1, B1, 0.2, oh - 0.05, RID - 3.6, 1.6, { front: paint(TIMBER), side: paint(TIMBER), top: paint(TIMBER), edge: TIMBER[0] });
    const bb = (a0: number, z0: number, a1: number, z1: number) => {
      const [x0, y0] = p.P(a0, Bf, z0);
      const [x1, y1] = p.P(a1, Bf, z1);
      ln(p.c, x0, y0, x1, y1, TIMBER[4], 3);
      ln(p.c, x0, y0 + 3, x1, y1 + 3, TIMBER[2], 3);
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        ell(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 6, 2.5, 1.6, TIMBER[2]);
      }
    };
    bb(Ae, Ze, am, RID);
    bb(am, RID, Ae2, Ze2);
    const r0 = p.P(am, Bb, RID);
    const r1 = p.P(am, Bf, RID);
    ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, PIODE[5], 3);
    ln(p.c, r0[0], r0[1] + 2, r1[0], r1[1] + 2, PIODE[1], 1);
    const e0 = p.P(Ae2, Bb, Ze2);
    const e1 = p.P(Ae2, Bf, Ze2);
    ln(p.c, e0[0], e0[1] + 1, e1[0], e1[1] + 1, TIMBER[2], 3);
    // the chimney sweep's catwalk along the ridge: planks on little brackets, a roof ladder up to it
    const cw0 = am - 0.62;
    const cw1 = am - 0.3;
    const zAt = (a: number) => Ze + ((a - Ae) / (am - Ae)) * (RID - Ze);
    poly3(p, [[cw0, 2, zAt(cw0) + 1.2], [cw0, D - 4, zAt(cw0) + 1.2], [cw1, D - 4, zAt(cw1) + 1.2], [cw1, 2, zAt(cw1) + 1.2]], (u: number, v: number, x: number, y: number) => at(LARCHF, 3.2 + ((u % 9) < 1 ? -1.6 : 0) + (v < 1.5 ? 1 : 0) + (hash(x, y, 31) < 0.05 ? -1 : 0)), 2, [[cw0, D - 4, zAt(cw0) + 1.2], [cw0, 2, zAt(cw0) + 1.2], [cw1, D - 4, zAt(cw1) + 1.2]]);
    for (let b = 2.3; b < D - 4; b += 1.6) {
      const [x0, y0] = p.P(cw0, b, zAt(cw0) + 1.2);
      const [x1, y1] = p.P(cw0, b, zAt(cw0));
      ln(p.c, x0, y0, x1, y1, TIMBER[1], 2);
    }
    const la = Ae + 0.6;
    for (const off of [0, 0.32]) {
      const [x0, y0] = p.P(la, 9 + off, zAt(la) + 0.6);
      const [x1, y1] = p.P(cw0, 9 + off, zAt(cw0) + 0.8);
      ln(p.c, x0, y0, x1, y1, LARCHF[4], 2);
    }
    for (let t = 0.1; t < 1; t += 0.12) {
      const a = la + (cw0 - la) * t;
      const [x0, y0] = p.P(a, 9, zAt(a) + 0.7);
      const [x1, y1] = p.P(a, 9.32, zAt(a) + 0.7);
      ln(p.c, x0, y0, x1, y1, LARCHF[3]);
    }
    // two skylights in the east slope
    for (const b of [6.2, 11.4]) {
      const a0 = am + 1.4;
      const a1 = am + 2.05;
      const zr = (a: number) => Ze2 + ((Ae2 - a) / (Ae2 - am)) * (RID - Ze2) + 0.8;
      poly3(p, [[a0, b, zr(a0)], [a0, b + 0.7, zr(a0)], [a1, b + 0.7, zr(a1)], [a1, b, zr(a1)]], (u: number, v: number) => (u < 2 || v < 2 || u > 26 || v > 34 ? '#5a4a3a' : (u + v) % 14 < 3 ? '#a8c8d4' : '#3a5a6a'), 1, [[a1, b + 0.7, zr(a1)], [a1, b, zr(a1)], [a0, b + 0.7, zr(a0)]]);
    }
    // a snow-guard log along the east slope
    const sgA = Ae2 - 0.7;
    const sgZ = Ze2 + 0.7 * slope + 1.2;
    const s0 = p.P(sgA, Bb + 0.3, sgZ);
    const s1 = p.P(sgA, Bf - 0.3, sgZ);
    ln(p.c, s0[0], s0[1], s1[0], s1[1], TIMBER[3], 4);
    ln(p.c, s0[0], s0[1] - 1, s1[0], s1[1] - 1, TIMBER[5], 1);
    // a dormer in the east slope: a log front with two lit windows and geraniums under a little gable
    {
      const zr = (a: number) => Ze2 + ((Ae2 - a) / (Ae2 - am)) * (RID - Ze2);
      const aAt = (z: number) => Ae2 - ((z - Ze2) / (RID - Ze2)) * (Ae2 - am);
      const db0 = 8.2;
      const db1 = 10.2;
      const dbm = (db0 + db1) / 2;
      const af = am + 2.75;
      const zf = zr(af) - 0.5;
      const zt = zf + 10;
      const zap = zt + 4.5;
      const aJ = aAt(zt);
      const S2 = side3(p, af);
      poly3(p, [[af, db1, zf], [af, db1, zt], [aJ, db1, zt]], logs(TIMBER, 7), 1, [[af, db1, zf], [aJ, db1, zf], [af, db1, zt]]);
      pt(p, S2, db0, db1, zf, zt, logs(TIMBER, 7), S2.light);
      poly3(p, [[af, db0, zt], [af, db1, zt], [af, dbm, zap]], gableBoards, 0, [[af, db0, zt], [af, db1, zt], [af, db0, zap]]);
      chaletWindow(p, S2, db0 + 0.32, db0 + 0.85, zf + 3.6, zf + 9, { flamed: true, box: true, lit: true, seed: k.seed + 61 });
      chaletWindow(p, S2, db1 - 0.85, db1 - 0.32, zf + 3.6, zf + 9, { flamed: true, box: true, lit: true, seed: k.seed + 62 });
      const aR = aAt(zap + 0.6);
      poly3(p, [[af + 0.25, db1 + 0.25, zt - 0.8], [af + 0.25, dbm, zap + 0.6], [aR, dbm, zap + 0.6], [aJ - 0.1, db1 + 0.25, zt - 0.8]], snowy(slates(PIODE), 7, 0.6), 2, [[af + 0.25, db1 + 0.25, zt - 0.8], [aJ, db1 + 0.25, zt - 0.8], [af + 0.25, dbm, zap + 0.6]]);
      const g0 = p.P(af + 0.25, db1 + 0.25, zt - 0.8);
      const g1 = p.P(af + 0.25, dbm, zap + 0.6);
      const g2 = p.P(af + 0.25, db0 - 0.25, zt - 0.8);
      ln(p.c, g0[0], g0[1], g1[0], g1[1], TIMBER[4], 3);
      ln(p.c, g1[0], g1[1], g2[0], g2[1], TIMBER[2], 3);
    }
    // chimneys through the roof
    const roofZ = (a: number) => (a < am ? Ze + ((a - Ae) / (am - Ae)) * (RID - Ze) : Ze2 + ((Ae2 - a) / (Ae2 - am)) * (RID - Ze2));
    chimney(p, am + 1.4, 4.5, roofZ(am + 1.9) - 1, 14);
    chimney(p, am + 2.2, 12.5, roofZ(am + 2.7) - 1, 12);
    chimney(p, am - 2.4, 8, roofZ(am - 1.9) + 1, 13);
  },
};

/** The lodge's plan: chimney tops (a, b, z) and the lit windows (for the smoke and the night lights). */
function lodgePlan(W: number, D: number) {
  const A0 = 0.4;
  const A1 = W - 0.3;
  const B0 = 0.5;
  const B1 = D - 0.7;
  const UF = 70;
  const am = (A0 + A1) / 2;
  const hw = (A1 - A0) / 2;
  const slope = 0.44 * 16;
  const RID = UF + hw * slope;
  const Ae = A0 - 0.5;
  const Ae2 = A1 + 0.22;
  const Ze = UF - 0.5 * slope;
  const Ze2 = UF - 0.22 * slope;
  const roofZ = (a: number) => (a < am ? Ze + ((a - Ae) / (am - Ae)) * (RID - Ze) : Ze2 + ((Ae2 - a) / (Ae2 - am)) * (RID - Ze2));
  const chimneys: [number, number, number][] = [
    [am + 1.65, 4.75, roofZ(am + 1.9) - 1 + 14 + 3.7],
    [am + 2.45, 12.75, roofZ(am + 2.7) - 1 + 12 + 3.7],
    [am - 2.15, 8.25, roofZ(am - 1.9) + 1 + 13 + 3.7],
  ];
  const gw: [number, number][] = [[1.25, 2.15], [2.85, 3.75], [6.05, 6.95], [7.65, 8.55]];
  const lights: PropLight[] = [];
  const WIN = '#ffd08a';
  gw.forEach(([u0, u1], i) => {
    if (i !== 1) lights.push({ a: A0 + (u0 + u1) / 2 - 0.4, b: B1, z: 20, r: 1.3, color: WIN, kind: 'window' });
    if (i !== 2) lights.push({ a: A0 + (u0 + u1) / 2 - 0.4, b: B1, z: 53, r: 1.2, color: WIN, kind: 'window' });
  });
  for (let i = 0; i < 6; i++) if (i % 3 !== 1) lights.push({ a: A1, b: B0 + 1.4 + i * 2.65 + 0.38, z: 53, r: 1.2, color: WIN, kind: 'window' });
  lights.push({ a: am - 0.45, b: B1, z: UF + 10, r: 0.8, color: WIN, kind: 'window' });
  lights.push({ a: am + 2.75, b: 9.2, z: RID - 12, r: 0.9, color: WIN, kind: 'window' });
  for (const du of [-0.95, 0.95]) lights.push({ a: am + du, b: B1 + 0.1, z: 22, r: 1.4, color: '#ffd27a', kind: 'lamp' });
  return { chimneys, lights };
}

res_lodge.anim = (p, k) => {
  // wood smoke curling up from the chimneys and drifting east
  const u = p.k / 4;
  lodgePlan(k.w, k.d).chimneys.forEach(([a, b, z], i) => {
    const [x, y] = p.P(a, b, z);
    for (let j = 0; j < 7; j++) {
      const t = (k.t * 0.16 + j / 7 + i * 0.37) % 1;
      const r = (3 + t * 10) * u;
      const cx = x + (Math.sin(k.t * 0.8 + j * 1.7 + i) * 2.5 + t * t * 26) * u;
      const cy = y - (3 + t * 58) * u;
      p.c.globalAlpha = 0.7 * (1 - t);
      ell(p.c, cx, cy, r, r * 0.86, '#f6f8fa');
      p.c.globalAlpha = 0.35 * (1 - t);
      ell(p.c, cx + r * 0.35, cy + r * 0.3, r * 0.65, r * 0.55, '#b4bcc8');
    }
  });
  p.c.globalAlpha = 1;
};
res_lodge.lights = (k) => lodgePlan(k.w, k.d).lights;


// ── the chapel ──────────────────────────────────────────────
const res_chapel: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const A0 = 0.35;
    const A1 = W - 0.35;
    const B0 = 0.9;
    const B1 = D - 0.35;
    const H = 24;
    const am = (A0 + A1) / 2;
    const hw = (A1 - A0) / 2;
    const RID = H + hw * 14;
    footShadow(p, 0.2, 0.4, W - 0.1, D - 0.1, 40, 0.3);
    const F = front3(p, B1);
    const S = side3(p, A1);
    const lime = limewash(WHITE);
    // whitewashed walls over a stone plinth
    const st = stoneWall(5);
    // pale fieldstone, roughly coursed, a darker plinth
    const pale = rubble(['#7e7a72', '#9a958c', '#b4afa4', '#cac5ba', '#dcd8ce', '#ebe8e0', '#f6f4ee'], MORTAR, 10);
    const wall: Mat = (light, w, h) => {
      const l = pale(light, w, h);
      const s = st(light, w, h);
      return (u, v, x, y) => (v < 5 ? s(u, v, x, y) : l(u, v, x, y));
    };
    pt(p, S, B0, B1, 0, H, wall, S.light);
    pt(p, F, A0, A1, 0, H, wall, F.light);
    // corner pilasters in grey render
    for (const [pl, u0, u1] of [[F, A0, A0 + 0.14], [F, A1 - 0.14, A1], [S, B1 - 0.14, B1]] as const) pq(p, pl, u0, u1, 5, H, pl.light ? '#c8c4b8' : '#9a968c');
    // the gable: whitewashed, a round window, a fresco over the door
    poly3(p, [[A0, B1, H], [A1, B1, H], [am, B1, RID]], lime, 1, [[A0, B1, H], [A1, B1, H], [A0, B1, RID]]);
    const [ox, oy] = F.F(am, H + 7);
    layer(p.c, (l) => {
      ell(l, ox, oy, 7, 7, GRANITE[3]);
      ell(l, ox, oy, 5, 5, '#2a3848');
      ln(l, ox - 5, oy, ox + 5, oy, GRANITE[4]);
      ln(l, ox, oy - 5, ox, oy + 5, GRANITE[4]);
    });
    // the arched door in a stone frame, two steps
    const pts: [number, number][] = [[am - 0.4, 0]];
    for (let j = 0; j <= 10; j++) {
      const t = Math.PI - (j / 10) * Math.PI;
      pts.push([am + Math.cos(t) * 0.4, 11 + Math.sin(t) * 5.6]);
    }
    pts.push([am + 0.4, 0]);
    poly3(p, pts.map(([u, z]) => F.at(u, z)), () => GRANITE[4], 1);
    const inner = pts.map(([u, z]) => [am + (u - am) * 0.78, z * 0.92] as [number, number]);
    poly3(p, inner.map(([u, z]) => F.at(u, z)), (u: number, _v: number, x: number, y: number) => ((u % 8) < 1 ? TIMBER[0] : at(TIMBER, 3.4 + (hash(x, y, 4) < 0.05 ? -1 : 0))), 1);
    pq(p, F, am - 0.5, am + 0.5, 18.4, 21.6, '#c8b88a');
    pq(p, F, am - 0.44, am + 0.44, 18.8, 21.2, '#5a7aa8');
    const [fx, fy] = F.F(am, 20);
    ell(p.c, fx, fy - 1, 3, 3, '#f2d27a');
    px(p.c, fx - 1, fy, '#c8382a', 3, 4);
    for (let s = 0; s < 2; s++) lbox(p, am - 0.6 + s * 0.08, B1 + 0.02, 1.2 - s * 0.16, 0.35 - s * 0.15, s * 1.4, 1.4, mono(paint(GRANITE), GRANITE[1]));
    // two arched windows on the side
    for (const b0 of [B0 + 0.6, B0 + 1.7]) {
      const wp: [number, number][] = [[b0, 9]];
      for (let j = 0; j <= 8; j++) {
        const t = Math.PI - (j / 8) * Math.PI;
        wp.push([b0 + 0.22 + Math.cos(t) * 0.22, 17 + Math.sin(t) * 3]);
      }
      wp.push([b0 + 0.44, 9]);
      poly3(p, wp.map(([u, z]) => S.at(u, z)), (u: number, v: number) => ((u + v) % 12 < 2 ? '#7a9aa8' : '#2a3848'), 0);
    }
    // the roof: larch shingles gone silver
    const oh = 0.32;
    const sh: Mat = (light) => (u, v, x, y) => {
      const row = Math.floor(v / 5);
      const off = row & 1 ? 3 : 0;
      const fu = (u + off) % 6;
      let i = (light === 2 ? 3.6 : light ? 3 : 1.8) + (hash(Math.floor((u + off) / 6), row, 3) - 0.5) * 1.2;
      if (v - row * 5 < 1.2) i -= 1.6;
      if (fu < 0.9) i -= 0.8;
      if (hash(x, y, 4) < 0.04) i -= 1;
      return at(['#24262e', '#323540', '#41454f', '#51555f', '#636772', '#787c86'], i);
    };
    const Ze = H - oh * 14;
    poly3(p, [[A0 - oh, B0 - 0.3, Ze], [A0 - oh, B1 + oh, Ze], [am, B1 + oh, RID], [am, B0 - 0.3, RID]], sh, 2, [[A0 - oh, B1 + oh, Ze], [A0 - oh, B0 - 0.3, Ze], [am, B1 + oh, RID]]);
    poly3(p, [[am, B0 - 0.3, RID], [am, B1 + oh, RID], [A1 + oh, B1 + oh, Ze], [A1 + oh, B0 - 0.3, Ze]], sh, 1, [[A1 + oh, B1 + oh, Ze], [A1 + oh, B0 - 0.3, Ze], [am, B1 + oh, RID]]);
    const g0 = p.P(A0 - oh, B1 + oh, Ze);
    const g1 = p.P(am, B1 + oh, RID);
    const g2 = p.P(A1 + oh, B1 + oh, Ze);
    ln(p.c, g0[0], g0[1], g1[0], g1[1], '#5a4a3a', 2);
    ln(p.c, g1[0], g1[1], g2[0], g2[1], '#4a3a2e', 2);
    const r0 = p.P(am, B0 - 0.3, RID);
    ln(p.c, r0[0], r0[1] - 1, g1[0], g1[1] - 1, '#c4beb4', 2);
    // the bell turret on the ridge at the front: an open belfry, a bell, a shingled spire, a cross
    const tb = B1 - 0.6;
    const tz = RID - 1;
    const tw = 0.26;
    lbox(p, am - tw, tb - tw, tw * 2, tw * 2, tz, 6, mono(lime, '#8a8a86'));
    const TF = front3(p, tb + tw);
    const TS = side3(p, am + tw);
    for (const [pl, u0] of [[TF, am - tw], [TS, tb - tw]] as const) {
      pq(p, pl, u0, u0 + tw * 2, tz + 6, tz + 13, pl.light ? '#3a2e24' : '#2a201a');
      pq(p, pl, u0 + 0.06, u0 + tw * 2 - 0.06, tz + 6.4, tz + 12.4, '#120e0c');
      for (const u of [u0, u0 + tw * 2 - 0.05]) pq(p, pl, u, u + 0.05, tz + 6, tz + 13, pl.light ? TIMBER[4] : TIMBER[3]);
    }
    const [bx, by] = TF.F(am, tz + 10);
    ell(p.c, bx + 2, by, 4, 4, '#8a6a2a');
    ell(p.c, bx + 1, by - 1, 2, 2, '#c8a050');
    lbox(p, am - tw - 0.05, tb - tw - 0.05, tw * 2 + 0.1, tw * 2 + 0.1, tz + 13, 0.8, mono(paint(TIMBER), TIMBER[0]));
    const apex: V3 = [am, tb, tz + 30];
    poly3(p, [[am - tw - 0.08, tb + tw + 0.08, tz + 13.8], [am + tw + 0.08, tb + tw + 0.08, tz + 13.8], apex], sh, 1);
    poly3(p, [[am + tw + 0.08, tb + tw + 0.08, tz + 13.8], [am + tw + 0.08, tb - tw - 0.08, tz + 13.8], apex], sh, 0);
    const [ax, ay] = p.P(...apex);
    layer(p.c, (l) => {
      px(l, ax - 1, ay - 14, '#c8a050', 2, 14);
      px(l, ax - 5, ay - 10, '#c8a050', 10, 2);
      ell(l, ax, ay - 1, 2, 2, '#c8a050');
    });
    // a little bench against the wall
    const [sx, sy] = p.P(A1 + 0.1, B1 - 1.2, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[sx - 2, sy - 8], [sx + 14, sy - 16], [sx + 16, sy - 14], [sx, sy - 6]], TIMBER[4]);
      ln(l, sx, sy - 6, sx, sy, TIMBER[2], 2);
      ln(l, sx + 14, sy - 14, sx + 14, sy - 8, TIMBER[2], 2);
    });
  },
};

// the chapel: a candle-lit glow in its side windows, a lamp over the door
res_chapel.lights = (k) => [
  { a: k.w - 0.35, b: 1.72, z: 13, r: 0.8, color: '#ffc870', kind: 'window' },
  { a: k.w - 0.35, b: 2.82, z: 13, r: 0.8, color: '#ffc870', kind: 'window' },
  { a: k.w / 2, b: k.d - 0.3, z: 17, r: 1.3, color: '#ffd890', kind: 'lamp' },
];

// ── the cable car: top station and pylon ───────────────────
// the pylon stands well clear of the spruce crowns (≈ 110–125 z); past it the line runs out over the brink
// and the frozen lake, sinking gently, and ends far outside the frame
const CABLE = { exitZ: 18, pylonZ: 150, runA: 13, runB: 40, endZ: 30 };
const res_station: PropArt = {
  draw(p, k) {
    // the cable car's top station, now mostly the summit's garage: block walls, the bay open on a red
    // quad and supply crates, a low pitched roof of corrugated steel over a brown fascia
    const W = k.w;
    const D = k.d;
    const A0 = 0.2;
    const A1 = W - 0.2;
    const B0 = 0.3;
    const B1 = D - 0.25;
    const H = 20;
    footShadow(p, 0.1, 0.2, W, D, 34, 0.34);
    const blocks: Mat = (light) => (u, v, x, y) => {
      const row = Math.floor(v / 5);
      const off = row & 1 ? 9 : 0;
      const fu = (u + off) % 18;
      if (v - row * 5 < 0.9 || fu < 0.9) return light ? '#878a90' : '#666a70';
      let i = (light ? 4.1 : 2.5) + (hash(Math.floor((u + off) / 18), row, 3) - 0.5) * 0.9 + (hash(x, y, 4) < 0.06 ? -0.8 : 0);
      if (v < 4) i -= 0.7;
      return at(CONCRETE, i);
    };
    lbox(p, A0, B0, A1 - A0, B1 - B0, 0, H, { front: blocks, side: blocks, top: blocks, edge: CONCRETE[0] });
    const F = front3(p, B1);
    const S = side3(p, A1);
    // the open bay: the dark inside, shelves on the back wall, the rolled-up door
    const o0 = A0 + 0.35;
    const o1 = A1 - 0.85;
    pq(p, F, o0 - 0.06, o1 + 0.06, 0, 15.8, CONCRETE[1]);
    pt(p, F, o0, o1, 0, 15, (u: number, v: number) => (v < 3 ? '#34363a' : (v % 15) < 1.2 && v < 50 ? '#3a3e46' : (u % 40) < 1.5 ? '#2a2c32' : '#1a1c20'), 1);
    pq(p, F, o0, o1, 13.4, 15, '#c4c8ce');
    for (let z = 13.6; z < 15; z += 0.45) pq(p, F, o0, o1, z, z + 0.12, '#8a9098');
    // a red quad parked inside and a stack of crates (green, mustard)
    const [qx, qy] = F.F(o0 + 0.55, 0.6);
    layer(p.c, (l) => {
      for (const dx of [0, 26]) {
        ell(l, qx + dx, qy - 5, 6, 6, '#141416');
        ell(l, qx + dx - 1, qy - 6, 2.5, 2.5, '#5a5a60');
      }
      fillPoly(l, [[qx - 6, qy - 12], [qx + 32, qy - 12], [qx + 30, qy - 20], [qx + 4, qy - 22]], RED[3]);
      fillPoly(l, [[qx - 6, qy - 12], [qx + 32, qy - 12], [qx + 32, qy - 10], [qx - 6, qy - 10]], RED[1]);
      fillPoly(l, [[qx + 2, qy - 21], [qx + 14, qy - 22], [qx + 14, qy - 19], [qx + 2, qy - 18]], RED[5]);
      px(l, qx + 8, qy - 27, '#2a2a2e', 2, 6);
      px(l, qx + 4, qy - 28, '#2a2a2e', 10, 2);
      px(l, qx + 28, qy - 17, '#fff4c8', 3, 2);
    });
    lbox(p, o1 - 0.62, B1 - 0.62, 0.42, 0.42, 0, 4.4, mono(paint(['#16301e', '#1e4028', '#285234', '#326440', '#40784e', '#548c5e']), '#0e1e12'));
    lbox(p, o1 - 0.52, B1 - 0.56, 0.34, 0.34, 4.4, 3.2, mono(paint(['#5a4416', '#7a5c1e', '#9a7628', '#b89034', '#d0a844', '#e2c060']), '#3a2a0e'));
    // a door with a little window and a lamp on the side
    pq(p, S, B1 - 0.9, B1 - 0.35, 0, 12.5, '#3a3e44');
    pq(p, S, B1 - 0.86, B1 - 0.39, 0, 12.1, '#5a2a20');
    pq(p, S, B1 - 0.78, B1 - 0.47, 8, 11, '#9ab8c8');
    pt(p, S, B0 + 0.5, B0 + 1.1, 8, 13, glass4(GLASS), S.light);
    const [lx, ly] = S.F(B1 - 1.05, 14);
    px(p.c, lx - 2, ly - 3, IRONK[2], 4, 5);
    px(p.c, lx - 1, ly - 2, '#ffe6a0', 2, 3);
    // the cable sign over the bay
    pq(p, F, A1 - 0.75, A1 - 0.1, 12, 16, '#f2eee4');
    const [sx, sy] = F.F(A1 - 0.42, 14);
    ell(p.c, sx, sy, 4, 4, RED[3]);
    px(p.c, sx - 1, sy - 3, '#ffffff', 2, 6);
    px(p.c, sx - 3, sy - 1, '#ffffff', 6, 2);
    // the roof: a low gable along the front, corrugated steel, the eaves on a brown fascia
    const oh = 0.28;
    const Bm = (B0 + B1) / 2;
    const Hr = H + 7;
    const corr: Mat = (light) => (u: number, v: number, x: number, y: number) => {
      const f = u % 5;
      let i = light === 2 ? 4 : light ? 3 : 1.8;
      if (f < 1.2) i -= 1.4;
      else if (f < 2.2) i += 0.8;
      if (hash(x, y, 9) < 0.03) i -= 1;
      if (v < 2) i -= 1;
      return at(['#6a7180', '#828a98', '#9ba2b0', '#adb4c1', '#bdc3d1', '#c9d0de', '#dfe4ec'], i + 1);
    };
    // the gable wall on the side, then the two slopes (the back one first), the bargeboards, the ridge
    poly3(p, [[A1, B0, H], [A1, B1, H], [A1, Bm, Hr]], blocks, S.light, [[A1, B0, H], [A1, B1, H], [A1, B0, Hr]]);
    const Ze = H - (oh / (Bm - B0)) * (Hr - H);
    poly3(p, [[A0 - oh, B0 - oh, Ze], [A1 + oh, B0 - oh, Ze], [A1 + oh, Bm, Hr], [A0 - oh, Bm, Hr]], corr, 1, [[A0 - oh, B0 - oh, Ze], [A1 + oh, B0 - oh, Ze], [A0 - oh, Bm, Hr]]);
    poly3(p, [[A0 - oh, B1 + oh, Ze], [A1 + oh, B1 + oh, Ze], [A1 + oh, Bm, Hr], [A0 - oh, Bm, Hr]], corr, 2, [[A0 - oh, B1 + oh, Ze], [A1 + oh, B1 + oh, Ze], [A0 - oh, Bm, Hr]]);
    const g0 = p.P(A1 + oh, B0 - oh, Ze);
    const g1 = p.P(A1 + oh, Bm, Hr);
    const g2 = p.P(A1 + oh, B1 + oh, Ze);
    ln(p.c, g0[0], g0[1], g1[0], g1[1], TIMBER[3], 3);
    ln(p.c, g1[0], g1[1], g2[0], g2[1], TIMBER[3], 3);
    ln(p.c, g0[0], g0[1] + 2, g1[0], g1[1] + 2, TIMBER[1], 1);
    ln(p.c, g1[0], g1[1] + 2, g2[0], g2[1] + 2, TIMBER[1], 1);
    const e0 = p.P(A0 - oh, B1 + oh, Ze);
    ln(p.c, e0[0], e0[1], g2[0], g2[1], TIMBER[3], 3);
    ln(p.c, e0[0], e0[1] + 3, g2[0], g2[1] + 3, TIMBER[1], 2);
    const r0 = p.P(A0 - oh, Bm, Hr);
    ln(p.c, r0[0], r0[1] - 1, g1[0], g1[1] - 1, '#e8ecf2', 2);
    // a vent pipe and old snow on the roof
    const [vx, vy] = p.P(A0 + 0.8, Bm + 0.3, Hr - 1);
    px(p.c, vx - 2, vy - 12, '#5a5e66', 5, 12);
    px(p.c, vx - 3, vy - 14, '#3a3e44', 7, 3);
    void k;
  },
  lights: (k) => [
    { a: k.w - 0.2, b: k.d - 1.3, z: 14, r: 1.4, color: '#ffd890', kind: 'lamp' },
    { a: 1.4, b: k.d - 0.25, z: 8, r: 1.6, color: '#ffcf8a', kind: 'window' },
  ],
};

/** The two cables' ends: from the station's exit to the pylon's sheaves, then down into the valley. */
function cablePoints(p: PropPainter, k: PropCtx) {
  // the station stands at (−1, −7) from the pylon's corner (see the world file)
  const [dx, dy] = (k.variant ?? '-1,-7').split(',').map(Number);
  const out: { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] }[] = [];
  for (const off of [0.42, 1.58]) {
    const a: [number, number, number] = [dx + 1.3 + off, dy + 3, CABLE.exitZ];
    const b: [number, number, number] = [off, 1, CABLE.pylonZ];
    const c: [number, number, number] = [off + CABLE.runA, 1 + CABLE.runB, CABLE.endZ];
    out.push({ a, b, c });
  }
  void p;
  return out;
}

/**
 * A cable car cabin hanging from the cable at screen (x, y) (u: px per base px): the grip and hanger,
 * a red box with a lit front and a shaded side, a band of windows with frames all round, a white
 * roof with the grip housing, a dark skirt. Drawn every frame, so only polygons and rectangles.
 */
function cabin(c: CanvasRenderingContext2D, x: number, y: number, u: number) {
  const hw = 0.34;
  const hd = 0.28;
  const H = 13;
  const hang = 10;
  const V = (a: number, b: number, z: number): [number, number] => [x + (a - b) * 64 * u, y + (hang + H) * 4 * u + (a + b) * 32 * u - z * 4 * u];
  const quad = (pts: [number, number][], col: string) => fillPoly(c, pts, col);
  const face = (a0: number, b0: number, a1: number, b1: number, z0: number, z1: number, col: string) => quad([V(a0, b0, z0), V(a1, b1, z0), V(a1, b1, z1), V(a0, b0, z1)], col);
  // the grip on the cable and the hanger down to the roof
  c.fillStyle = '#2a2e34';
  c.fillRect(Math.round(x - 4 * u), Math.round(y - 2 * u), Math.round(8 * u), Math.max(1, Math.round(4 * u)));
  c.fillStyle = '#5a606a';
  c.fillRect(Math.round(x - 1 * u), Math.round(y), Math.max(1, Math.round(3 * u)), Math.round(hang * 4 * u + 2 * u));
  c.fillStyle = '#9aa2ac';
  c.fillRect(Math.round(x - 1 * u), Math.round(y), Math.max(1, Math.round(1 * u)), Math.round(hang * 4 * u));
  // the box: front (+b, lit) and side (+a, shade)
  face(-hw, hd, hw, hd, 0, H, RED[4]);
  face(hw, hd, hw, -hd, 0, H, RED[2]);
  // a dark skirt and a pale stripe
  face(-hw, hd, hw, hd, 0, 1.6, RED[1]);
  face(hw, hd, hw, -hd, 0, 1.6, RED[0]);
  face(-hw, hd, hw, hd, 3.2, 3.9, '#f4f0e8');
  face(hw, hd, hw, -hd, 3.2, 3.9, '#c8c4bc');
  // windows all round: frames and glass with a reflection
  for (let i = 0; i < 3; i++) {
    const a0 = -hw + 0.04 + i * ((2 * hw - 0.08) / 3);
    const a1 = a0 + (2 * hw - 0.08) / 3 - 0.04;
    face(a0, hd, a1, hd, 5.2, 11, '#a8d0e4');
    face(a0, hd, a0 + (a1 - a0) * 0.35, hd, 7.5, 11, '#e6f4fa');
  }
  for (let i = 0; i < 2; i++) {
    const b0 = hd - 0.04 - i * ((2 * hd - 0.08) / 2);
    const b1 = b0 - (2 * hd - 0.08) / 2 + 0.04;
    face(hw, b0, hw, b1, 5.2, 11, '#6e98b0');
  }
  // the roof: a white lid, the grip housing on it
  quad([V(-hw, -hd, H), V(hw, -hd, H), V(hw, hd, H), V(-hw, hd, H)], '#f2f4f6');
  quad([V(-hw, hd, H), V(hw, hd, H), V(hw, hd, H + 0.6), V(-hw, hd, H + 0.6)], '#c8ccd2');
  face(-0.1, 0.08, 0.1, 0.08, H, H + 2.2, '#8a9098');
  face(0.1, 0.08, 0.1, -0.08, H, H + 2.2, '#5a606a');
  quad([V(-0.1, -0.08, H + 2.2), V(0.1, -0.08, H + 2.2), V(0.1, 0.08, H + 2.2), V(-0.1, 0.08, H + 2.2)], '#b8bec6');
  // the near corner post
  face(hw - 0.02, hd, hw, hd, 1.6, H, RED[5]);
}

const res_pylon: PropArt = {
  draw(p, k) {
    const W = k.w;
    const H = CABLE.pylonZ;
    const [cx, cy] = anchor(p, W / 2, W / 2, 0);
    contactShadow(p.c, cx + 22, cy + 6, 40, 12, 0.28);
    // concrete footings, four tapering legs, cross bracing, the crossarm and sheave trains
    const legs: [number, number][] = [[0.3, 0.3], [W - 0.3, 0.3], [0.3, W - 0.3], [W - 0.3, W - 0.3]];
    const top = (a: number, b: number): [number, number] => [W / 2 + (a - W / 2) * 0.32, W / 2 + (b - W / 2) * 0.32];
    for (const [a, b] of legs) lbox(p, a - 0.12, b - 0.12, 0.24, 0.24, 0, 2, mono(paint(CONCRETE), CONCRETE[0]));
    layer(p.c, (l) => {
      const seg = 10;
      for (let s = 0; s < seg; s++) {
        const z0 = 2 + ((H - 2) * s) / seg;
        const z1 = 2 + ((H - 2) * (s + 1)) / seg;
        const lerp = (a: number, b: number, z: number): [number, number] => {
          const t = (z - 2) / (H - 2);
          const [ta, tb] = top(a, b);
          return [a + (ta - a) * t, b + (tb - b) * t];
        };
        // the two faces we see: front (b high) and side (a high)
        for (const [[a0, b0], [a1, b1], col] of [[legs[2], legs[3], STEEL[4]], [legs[1], legs[3], STEEL[2]], [legs[0], legs[2], STEEL[3]], [legs[0], legs[1], STEEL[3]]] as const) {
          const p00 = lerp(a0, b0, z0);
          const p10 = lerp(a1, b1, z0);
          const p01 = lerp(a0, b0, z1);
          const p11 = lerp(a1, b1, z1);
          const A = p.P(p00[0], p00[1], z0);
          const B = p.P(p11[0], p11[1], z1);
          const C = p.P(p10[0], p10[1], z0);
          const Dd = p.P(p01[0], p01[1], z1);
          ln(l, A[0], A[1], B[0], B[1], col);
          ln(l, C[0], C[1], Dd[0], Dd[1], col);
          ln(l, Dd[0], Dd[1], B[0], B[1], col);
        }
      }
      for (const [a, b] of legs) {
        const [ta, tb] = top(a, b);
        const A = p.P(a, b, 2);
        const B = p.P(ta, tb, H);
        ln(l, A[0], A[1], B[0], B[1], b > W / 2 && a > W / 2 ? STEEL[2] : STEEL[4], 3);
      }
      // the crossarm and two sheave trains
      const c0 = p.P(0.1, W / 2, H);
      const c1 = p.P(W - 0.1, W / 2, H);
      ln(l, c0[0], c0[1], c1[0], c1[1], STEEL[3], 4);
      ln(l, c0[0], c0[1] - 2, c1[0], c1[1] - 2, STEEL[5], 1);
      for (const a of [0.42, 1.58]) {
        const s0 = p.P(a, W / 2 - 0.5, H + 1.5);
        const s1 = p.P(a, W / 2 + 0.5, H + 1.5);
        ln(l, s0[0], s0[1], s1[0], s1[1], STEEL[2], 4);
        for (let i = 0; i < 4; i++) {
          const t = (i + 0.5) / 4;
          ell(l, s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t - 2, 2.5, 2.5, '#2a2e34');
        }
      }
      // the maintenance ladder
      const lb0 = p.P(W / 2, W - 0.3, 2);
      const lb1 = p.P(W / 2, W / 2 + 0.2, H);
      ln(l, lb0[0] - 3, lb0[1], lb1[0] - 3, lb1[1], STEEL[5]);
      ln(l, lb0[0] + 3, lb0[1], lb1[0] + 3, lb1[1], STEEL[5]);
    });
    // a red warning disc on top
    const [wx, wy] = p.P(W / 2, W / 2, H + 6);
    ell(p.c, wx, wy, 4, 4, RED[3]);
    ell(p.c, wx - 1, wy - 1, 2, 2, RED[5]);
  },
  anim(p, k) {
    const u = p.k / 4;
    const lines = cablePoints(p, k);
    const P3 = (q: [number, number, number]) => p.P(q[0], q[1], q[2]);
    const sagLine = (q0: [number, number, number], q1: [number, number, number], sag: number) => {
      const A = P3(q0);
      const B = P3(q1);
      const n = Math.max(8, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 6));
      let prev = A;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const s = Math.sin(t * Math.PI) * sag * u;
        const q: [number, number] = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + s];
        ln(p.c, prev[0], prev[1], q[0], q[1], '#24242a', Math.max(1, Math.round(2 * u)));
        ln(p.c, prev[0], prev[1] - u, q[0], q[1] - u, '#8a8e96');
        prev = q;
      }
      return (t: number): [number, number] => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * sag * u];
    };
    lines.forEach((ln0, i) => {
      sagLine(ln0.a, ln0.b, 6);
      const down = sagLine(ln0.b, ln0.c, 40);
      // a cabin on each cable, one going down, one coming up
      const t = i === 0 ? (k.t * 0.012) % 1 : 1 - ((k.t * 0.012 + 0.5) % 1);
      const [x, y] = down(Math.max(0.03, t));
      cabin(p.c, x, y, u);
    });
  },
};

// ── the summit cross on its knoll ───────────────────────────
const res_cross: PropArt = {
  draw(p, k) {
    const W = k.w;
    const [cx, cy] = anchor(p, W / 2, W / 2, 0);
    contactShadow(p.c, cx + 26, cy + 6, 70, 22, 0.3);
    // the knoll: a pile of granite blocks
    const blocks: [number, number, number, number][] = [[-46, -10, 34, 22], [40, -6, 32, 20], [-10, 8, 40, 22], [8, -22, 36, 26], [-28, -30, 26, 18], [30, -30, 24, 16]];
    blocks.sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, rx, ry] of blocks) layer(p.c, (l) => rockMass(l, cx + dx, cy + dy - ry * 0.4, rx, ry, k.seed * 7 + dx, ROCK, { lichen: 0.07, moss: 0.4 }), { outline: 0.6 });
    layer(p.c, (l) => grassSkirt(l, cx, cy + 8, 60, 18, k.seed, 26), { outline: false });
    // the cross: larch beams with iron straps, a little roof, the summit register
    const base = cy - 46;
    layer(p.c, (l) => {
      const hgt = 150;
      px(l, cx - 3, base - hgt, TIMBER[4], 7, hgt);
      px(l, cx - 3, base - hgt, TIMBER[5], 2, hgt);
      px(l, cx + 3, base - hgt, TIMBER[2], 1, hgt);
      const arm = base - hgt + 38;
      px(l, cx - 30, arm, TIMBER[4], 60, 7);
      px(l, cx - 30, arm, TIMBER[5], 60, 2);
      px(l, cx - 30, arm + 6, TIMBER[2], 60, 1);
      for (const [x, y] of [[cx - 3, arm - 2], [cx - 3, arm + 7], [cx - 30, arm], [cx + 27, arm]] as const) px(l, x, y, IRONK[3], 7, 2);
      // the little gable roof over the top
      fillPoly(l, [[cx - 11, base - hgt + 4], [cx, base - hgt - 6], [cx + 11, base - hgt + 4], [cx + 9, base - hgt + 6], [cx, base - hgt - 2], [cx - 9, base - hgt + 6]], TIMBER[3]);
      ln(l, cx - 11, base - hgt + 4, cx, base - hgt - 6, TIMBER[5]);
      // the register box and a ribbon of faded prayer cloth tied by a climber
      px(l, cx - 6, base - 70, '#8a9098', 12, 10);
      px(l, cx - 6, base - 70, '#b8bec6', 12, 2);
      px(l, cx - 1, base - 66, '#2a2a30', 3, 2);
      curve(l, cx + 3, arm + 3, cx + 12, arm + 12, cx + 16, arm + 28, '#c8382a', 1);
      curve(l, cx - 3, arm + 3, cx - 10, arm + 14, cx - 12, arm + 26, '#e8c040', 1);
      // a wreath of edelweiss at the foot
      for (let i = 0; i < 6; i++) dotFruit(l, cx - 9 + i * 3.5, base - 2 - (i % 2), '#f2eee2', 3);
    });
  },
};

export const RESEARCH_LODGE: Record<string, PropArt> = { res_lodge, res_chapel, res_station, res_pylon, res_cross };
export { stoneWall, chaletWindow, GRANITE, WHITE, SHUT, lighten, curve, contactShadow };

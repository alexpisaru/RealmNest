// Office — the buildings round the piazza (1 z ≈ 10 cm; a storey is ~36 z).
//   palazzo   variants: home (the studio's own palazzo, ochre), rosa (café on the
//             ground floor), crema (an arcade and a bookshop), verde (a narrow
//             house with a gelateria), roofs (distant roofscape)
//   chiesa    a baroque church front with a bell tower
// Visible faces are the +y front (b = d) and the +x side (a = w).
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, bayer, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, OUTL, px, R, type Ramp, rng } from '../../kit4';
import { cutStone4, glass4, shingles4 } from '../../materials4';
import { beam, door4, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import { lbox } from '../util';

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };

const STUCCO: Record<string, Ramp> = {
  home: ['#9a6a3a', '#b47e46', '#c99456', '#d8a868', '#e4bc80', '#eed09a'],
  rosa: ['#8e4a3e', '#a85c4c', '#c0705e', '#d08674', '#de9c8a', '#eab4a2'],
  crema: ['#9a8a6a', '#b4a482', '#cabb98', '#dacdac', '#e6dcc0', '#f0e8d4'],
  verde: ['#5a6a52', '#6e8064', '#829478', '#98a88c', '#adbca0', '#c4d0b6'],
  gialla: ['#9a7a2a', '#b89238', '#d0a848', '#e0bc5c', '#ecce76', '#f4dc94'],
  bianca: ['#9a948a', '#b4aea2', '#cac4b8', '#dcd6ca', '#e8e4da', '#f4f1ea'],
  ocra: ['#8a5226', '#a4642e', '#bc7838', '#d08c46', '#dea058', '#e8b470'],
};
const STONE: Ramp = ['#7a6e5e', '#958874', '#ada08a', '#c2b59e', '#d4c8b2', '#e4dac6'];
const TILE: Ramp = ['#5a2418', '#74301e', '#8e3e26', '#a84e30', '#bc623c', '#cc7a4e', '#da9466'];
const IRON: Ramp = ['#14141a', '#1e1e26', '#2a2a34', '#383844', '#484856'];

/** Weathered stucco: soft blotches, rising damp, a few patches where the render fell off. */
const stucco =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = light ? 3.2 : 1.9;
    const n = noise2(u * 0.03, v * 0.045, 3) + (hash(Math.floor(u / 5), Math.floor(v / 4), 4) - 0.5) * 0.3;
    if (n > 0.66 && bayer(x, y) > 0.45) i += 0.9;
    else if (n < 0.3 && bayer(x, y) > 0.5) i -= 0.9;
    if (v < 18 && bayer(x, y) * 18 > v) i -= 0.8;
    const h = hash(x, y, 5);
    if (h < 0.025) i -= 1;
    // a bald patch showing brick
    const pcx = Math.floor(u / 90);
    const pcy = Math.floor(v / 70);
    if (hash(pcx, pcy, 6) < 0.1) {
      // an irregular patch where the render has fallen, showing courses of brick
      const dx = u - pcx * 90 - 45;
      const dy = v - pcy * 70 - 35;
      const rr = 5 + hash(pcx, pcy, 7) * 6 + (hash(Math.floor(u / 2), Math.floor(v / 2), 8) - 0.5) * 3;
      if (dx * dx * 0.6 + dy * dy * 2 < rr * rr) {
        const row = Math.floor(v / 2.4);
        const joint = v % 2.4 < 0.7 || (u + (row % 2) * 3) % 6 < 0.8;
        return joint ? at(r, light ? 1 : 0) : at(['#7a4a3a', '#8e5846', '#a26a54', '#b47c62'], light ? 2.5 : 1.5);
      }
    }
    return at(r, i);
  };

/** Rusticated stone (bugnato): deep horizontal joints, slightly bulging blocks. */
const bugnato: Mat = (light) => (u, v, x, y) => {
  const rowH = 7;
  const row = Math.floor(v / rowH);
  const fv = v - row * rowH;
  const off = row % 2 ? 9 : 0;
  const fu = (u + off) % 18;
  if (fv < 1.2) return at(STONE, 0);
  if (fu < 0.9) return at(STONE, 1);
  let i = (light ? 3.4 : 2) + (fv > rowH - 2 ? 0.8 : 0) + (hash(Math.floor((u + off) / 18), row, 9) - 0.5) * 0.8;
  if (hash(x, y, 10) < 0.05) i -= 0.8;
  return at(STONE, i);
};

/** Terracotta roof tiles (coppi): rows of half-round tiles, lichen. */
const coppi = shingles4(TILE, 6, 7, ['#5a6a3a', '#6a7a42', '#7a8a4a', '#8a9a52', '#9aaa5c', '#aaba68']);

/** Window with a stone frame, green shutters (some closed), a sill and maybe a balcony. */
function finestra(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, o: { shutters: Ramp; closed?: number; balcony?: boolean; pediment?: boolean; flowers?: boolean; seed: number; lit?: boolean }) {
  const light = pl.light;
  // stone surround
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.2, z1 + 1.4, at(STONE, light ? 4 : 2));
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.2, z0 - 0.6, at(STONE, light ? 1 : 0));
  // the glass, dark inside with a pale reflection and a curtain
  pt(p, pl, u0, u1, z0, z1, (u, v, x, y) => {
    if ((u * 0.9 + v) % 30 < 4) return '#9ab8c4';
    if (o.lit && v < 14 && v > 3) return hash(x, y, 2) < 0.5 ? '#f2d48a' : '#e8c070';
    return v > (z1 - z0) * 4 - 6 ? '#1a2228' : '#2e3e48';
  }, light);
  beam(p, pl, (u0 + u1) / 2, z0, (u0 + u1) / 2, z1, 0.35, ['#cfc6b4', '#ddd4c2', '#e8e0d0', '#f2ebdc', '#faf5ea', '#ffffff']);
  beam(p, pl, u0, z0 + (z1 - z0) * 0.62, u1, z0 + (z1 - z0) * 0.62, 0.3, ['#cfc6b4', '#ddd4c2', '#e8e0d0', '#f2ebdc', '#faf5ea', '#ffffff']);
  // shutters: louvred, one or both closed now and then
  const sw = (u1 - u0) / 2;
  const closed = o.closed ?? 0;
  const louvre = (light2: 0 | 1 | 2): FaceTex => (_u, v) => at(o.shutters, (light2 ? 3 : 1.6) + (v % 2.4 < 0.8 ? -1 : 0.3));
  if (closed === 2) pt(p, pl, u0, u1, z0, z1, louvre(light), light);
  else {
    pt(p, pl, u0 - sw - 0.04, u0 - 0.04, z0, z1, louvre(light), light);
    if (closed === 1) pt(p, pl, (u0 + u1) / 2, u1, z0, z1, louvre(light), light);
    else pt(p, pl, u1 + 0.04, u1 + sw + 0.04, z0, z1, louvre(light), light);
  }
  if (o.pediment) {
    // a small triangular pediment on brackets
    const um = (u0 + u1) / 2;
    poly3(p, [pl.at(u0 - 0.14, z1 + 1.6), pl.at(u1 + 0.14, z1 + 1.6), pl.at(um, z1 + 4.6)], (_u: number, _v: number) => at(STONE, light ? 4 : 2), light);
    pq(p, pl, u0 - 0.14, u1 + 0.14, z1 + 1.2, z1 + 1.8, at(STONE, light ? 1 : 0));
  }
  if (o.balcony) {
    // a stone slab on brackets, a wrought iron railing, geraniums
    pq(p, pl, u0 - 0.3, u1 + 0.3, z0 - 1.8, z0 - 0.6, at(STONE, light ? 3 : 1));
    for (let u = u0 - 0.26; u <= u1 + 0.26; u += 0.07) beam(p, pl, u, z0 - 0.6, u, z0 + 3.2, 0.12, IRON);
    beam(p, pl, u0 - 0.3, z0 + 3.2, u1 + 0.3, z0 + 3.2, 0.3, IRON);
    beam(p, pl, u0 - 0.3, z0 + 1.2, u1 + 0.3, z0 + 1.2, 0.15, IRON);
  }
  if (o.flowers) {
    const [ax, ay] = pl.F(u0 - 0.1, z0 - 0.4);
    const [bx, by] = pl.F(u1 + 0.1, z0 - 0.4);
    const masses: Mass[] = [];
    const n = 5;
    for (let i = 0; i <= n; i++) masses.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n - 4, rx: 5, ry: 4.5, z: i });
    layer(p.c, (l) => {
      foliage(l, masses, R.apple, o.seed, { cell: 2.4, dots: ['#d8302a', '#e8577a', '#f08a5a'], dotChance: 0.8, dotSize: 3 });
      for (let i = 0; i < n; i += 2) for (let q = 0; q < 8; q++) px(l, ax + ((bx - ax) * (i + 0.5)) / n + (q % 3 === 2 ? 1 : 0), ay + ((by - ay) * (i + 0.5)) / n + q, R.apple[2 + (q & 1)]);
    }, { outline: 0.6 });
  }
}

/** A run of windows across a facade plane: bays, storeys, a cornice between. */
function facade(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, storeys: number, sh: number, o: { r: Ramp; shutters: Ramp; seed: number; nobile?: boolean; bays?: number }) {
  const light = pl.light;
  const len = u1 - u0;
  const bays = o.bays ?? Math.max(1, Math.round(len / 1.7));
  const Rn = rng(o.seed);
  pt(p, pl, u0, u1, z0, z0 + storeys * sh, stucco(o.r), light);
  for (let s = 0; s < storeys; s++) {
    const zb = z0 + s * sh;
    // string course under each storey
    pq(p, pl, u0, u1, zb - 0.4, zb + 1.1, at(STONE, light ? 4 : 2));
    pq(p, pl, u0, u1, zb - 0.6, zb - 0.4, at(STONE, light ? 1 : 0));
    for (let b = 0; b < bays; b++) {
      const c = u0 + (len * (b + 0.5)) / bays;
      const ww = Math.min(0.5, (len / bays) * 0.3);
      const nob = o.nobile && s === 0;
      finestra(p, pl, c - ww, c + ww, zb + 7, zb + (nob ? 29 : 25), {
        shutters: o.shutters,
        closed: Rn() < 0.25 ? (Rn() < 0.5 ? 1 : 2) : 0,
        balcony: nob && b % 2 === 0,
        pediment: nob,
        flowers: !nob && Rn() < 0.35,
        seed: o.seed * 31 + s * 7 + b,
        lit: Rn() < 0.15,
      });
    }
  }
  // lived-in details: washing strung between windows, an air conditioner, a satellite dish
  for (let s2 = 0; s2 < storeys; s2++) {
    const zb = z0 + s2 * sh;
    if (Rn() < 0.45 && len > 3) {
      const ua = u0 + len * (0.15 + Rn() * 0.3);
      const ub = Math.min(u1 - 0.3, ua + 1.4 + Rn() * 1.4);
      const za = zb + 6;
      const [x0, y0] = pl.F(ua, za);
      const [x1, y1] = pl.F(ub, za);
      ln(p.c, x0, y0, x1, y1, '#d8d0c0');
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 9);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const sag = Math.sin(t * Math.PI) * 3;
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 + (y1 - y0) * t + sag;
        const col = ['#f6f2e8', '#e2553b', '#5b8def', '#f2c42a', '#ffffff', '#ef9ac0', '#3fb68b'][Math.floor(Rn() * 7)];
        const h = 6 + Math.floor(Rn() * 6);
        px(p.c, cx - 3, cy, col, 6, h);
        px(p.c, cx - 3, cy, lighten(col, 0.2), 2, h);
        px(p.c, cx - 3, cy + h - 1, darken(col, 0.2), 6, 1);
      }
    }
    if (Rn() < 0.3) {
      const u = u0 + 0.4 + Rn() * (len - 0.8);
      const [ax, ay] = pl.F(u, zb + 4.5);
      px(p.c, ax - 6, ay - 8, '#d8d8d4', 12, 8);
      px(p.c, ax - 6, ay - 8, '#f0f0ec', 12, 1);
      for (let i = 0; i < 4; i++) px(p.c, ax - 4 + i * 2, ay - 6, '#9a9a96', 1, 5);
    }
  }
  if (Rn() < 0.5) {
    const [dx, dy] = pl.F(u0 + len * (0.2 + Rn() * 0.6), z0 + storeys * sh - 6);
    ell(p.c, dx, dy, 6, 6, '#e8e8e4');
    ell(p.c, dx + 1, dy, 4, 5, '#c8c8c4');
    ln(p.c, dx, dy, dx + 6, dy - 2, '#5a5a60');
  }
  // the corner quoins
  for (const u of [u0, u1 - 0.18])
    for (let z = z0; z < z0 + storeys * sh - 2; z += 4) pq(p, pl, u, u + (Math.floor(z / 4) % 2 ? 0.18 : 0.26) * (u === u0 ? 1 : 1), z, z + 3.6, at(STONE, light ? 4 : 2) as string);
}

/** A hipped roof of coppi over a box, a cornice, chimneys and a dormer or a roof terrace. */
function tetto(p: PropPainter, a0: number, a1: number, b0: number, b1: number, ze: number, rise: number, seed: number) {
  const oh = 0.35;
  const A0 = a0 - oh;
  const A1 = a1 + oh;
  const B0 = b0 - oh;
  const B1 = b1 + oh;
  const bm = (b0 + b1) / 2;
  const inset = Math.min((B1 - B0) / 2, 2.4);
  const zr = ze + rise;
  // the cornice: a heavy moulded band
  lbox(p, a0 - 0.2, b0 - 0.2, a1 - a0 + 0.4, b1 - b0 + 0.4, ze - 2.2, 2.2, { front: cutStone4(STONE, 2.2), side: cutStone4(STONE, 2.2), top: cutStone4(STONE, 20), edge: STONE[0] });
  // hip: front slope, right hip, (back slope hidden), ridge
  poly3(p, [[A0, B1, ze], [A1, B1, ze], [A1 - inset, bm, zr], [A0 + inset, bm, zr]], coppi, 1);
  poly3(p, [[A1, B1, ze], [A1, B0, ze], [A1 - inset, bm, zr]], coppi, 0, [[A1, B1, ze], [A1, B0, ze], [A1 - inset, bm, zr]]);
  const r0 = p.P(A0 + inset, bm, zr);
  const r1 = p.P(A1 - inset, bm, zr);
  ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, TILE[5], 3);
  const h0 = p.P(A1, B1, ze);
  ln(p.c, h0[0], h0[1] - 1, r1[0], r1[1] - 1, TILE[5], 3);
  // eaves shadow line
  const e0 = p.P(A0, B1, ze);
  ln(p.c, e0[0], e0[1] + 1, h0[0], h0[1] + 1, mix(TILE[0], OUTL, 0.4), 2);
  const Rn = rng(seed);
  // skylights in the front slope
  for (let i = 0; i < Math.floor((A1 - A0) / 3); i++) {
    if (Rn() < 0.5) continue;
    const a = A0 + inset + 0.6 + Rn() * Math.max(0.2, A1 - A0 - 2 * inset - 1.4);
    const b = B1 - 0.6 - Rn() * 0.5;
    const zs = ze + ((B1 - b) / (B1 - bm)) * rise;
    poly3(p, [[a, b, zs], [a + 0.4, b, zs], [a + 0.4, b - 0.35, zs + rise * (0.35 / (B1 - bm))], [a, b - 0.35, zs + rise * (0.35 / (B1 - bm))]], glass4(R.glass), 2);
  }
  // a roof terrace (altana): a timber platform on posts, a railing, potted plants
  if (A1 - A0 > 7 && Rn() < 0.8) {
    const ta = A0 + inset + 1 + Rn() * (A1 - A0 - 2 * inset - 3.5);
    const tz = zr - 1;
    const wood = ['#3d2617', '#5a3a22', '#7a5230', '#9a6b40', '#b88752', '#d2a46a'];
    for (const [a, b] of [[ta, bm - 0.6], [ta + 1.8, bm - 0.6], [ta, bm + 0.6], [ta + 1.8, bm + 0.6]] as const) lbox(p, a, b, 0.08, 0.08, tz - 4, 6, { front: (_l) => () => wood[3], side: (_l) => () => wood[1], top: (_l) => () => wood[4], edge: wood[0] });
    lbox(p, ta - 0.1, bm - 0.7, 2.06, 1.48, tz + 2, 0.6, { front: (_l) => () => wood[3], side: (_l) => () => wood[2], top: (_l) => (u: number) => (u % 6 < 1 ? wood[2] : wood[4]), edge: wood[0] });
    for (let a = ta - 0.1; a <= ta + 1.96; a += 0.12) {
      const [x0, y0] = p.P(a, bm + 0.78, tz + 2.6);
      px(p.c, x0, y0 - 9, IRON[2], 1, 9);
    }
    const r0 = p.P(ta - 0.1, bm + 0.78, tz + 6);
    const r1 = p.P(ta + 1.96, bm + 0.78, tz + 6);
    ln(p.c, r0[0], r0[1], r1[0], r1[1], IRON[2], 2);
    // pots of geraniums and a lemon tree on the terrace
    for (let i = 0; i < 3; i++) {
      const [px0, py0] = p.P(ta + 0.3 + i * 0.6, bm + 0.4, tz + 2.6);
      const masses: Mass[] = [{ x: px0, y: py0 - 10, rx: 7, ry: 6, z: 1 }];
      layer(p.c, (l) => {
        fillPoly(l, [[px0 - 5, py0 - 6], [px0 + 5, py0 - 6], [px0 + 4, py0], [px0 - 4, py0]], '#b8693e');
        foliage(l, masses, R.apple, seed + i, { cell: 2.6, dots: i === 1 ? ['#f2d240'] : ['#d8302a', '#e8577a'], dotChance: 0.7, dotSize: 3 });
      }, { outline: 0.55 });
    }
  }
  // chimneys with little tiled hats
  for (let i = 0; i < 2 + Math.floor(Rn() * 3); i++) {
    const a = A0 + inset + 0.4 + Rn() * Math.max(0.5, A1 - A0 - 2 * inset - 1);
    const b = bm + 0.3 + Rn() * 0.6;
    const zs = ze + rise * (1 - (b - bm) / (B1 - bm));
    lbox(p, a, b, 0.32, 0.32, zs - 2, 10, { front: stucco(STUCCO.crema), side: stucco(STUCCO.crema), top: (_l) => () => '#2a2420', edge: '#6a5a4a' });
    lbox(p, a - 0.06, b - 0.06, 0.44, 0.44, zs + 8, 1.2, { front: (_l) => () => TILE[3], side: (_l) => () => TILE[1], top: (_l) => () => TILE[4], edge: TILE[0] });
  }
  // a TV antenna on the ridge
  if (Rn() < 0.7) {
    const [ax, ay] = p.P(A0 + inset + Rn() * Math.max(0.5, A1 - A0 - 2 * inset), bm, zr);
    ln(p.c, ax, ay, ax, ay - 34, IRON[3]);
    for (let i = 0; i < 4; i++) ln(p.c, ax - 8 + i, ay - 30 + i * 5, ax + 8 - i, ay - 30 + i * 5, IRON[3]);
  }
}

// ── the palazzi ─────────────────────────────────────────────
function palazzo(p: PropPainter, k: PropCtx) {
  const v = k.variant ?? 'home';
  const W = k.w;
  const D = k.d;
  if (v === 'fila') return fila(p, k);
  const r = STUCCO[v] ?? STUCCO.home;
  const shutters: Ramp =
    v === 'rosa' ? ['#2a3a2a', '#344a34', '#3e5a3e', '#4a6a4a', '#5a7a5a', '#6a8a6a'] : v === 'crema' ? ['#4a3020', '#5e3e2a', '#724e34', '#865e3e', '#9a6e48', '#ae7e52'] : ['#1e3a2e', '#28483a', '#325646', '#3e6654', '#4c7662', '#5c8670'];
  const storeys = v === 'verde' || v === 'home' ? 3 : v === 'bianca' ? 5 : 4;
  const GH = v === 'home' ? 40 : 34; // ground floor height (the studio's hall is 40)
  const SH = 32;
  const ze = GH + (storeys - 1) * SH;
  const a0 = 0.05;
  const a1 = W - 0.05;
  const b0 = 0.05;
  const b1 = D - 0.05;
  const F = front3(p, b1);
  const S = side3(p, a1);
  // ground floor: rusticated stone, then the upper storeys
  pt(p, F, a0, a1, 0, GH, bugnato, F.light);
  pt(p, S, b0, b1, 0, GH, bugnato, S.light);
  facade(p, F, a0, a1, GH, storeys - 1, SH, { r, shutters, seed: k.seed * 7 + 1, nobile: v !== 'verde', bays: Math.max(1, Math.round((a1 - a0) / 1.9)) });
  facade(p, S, b0, b1, GH, storeys - 1, SH, { r, shutters, seed: k.seed * 7 + 2, nobile: v !== 'verde', bays: Math.max(1, Math.round((b1 - b0) / 1.9)) });
  // the ground floor openings
  const Rn = rng(k.seed * 11 + 3);
  const ground = (pl: Pl, u0: number, u1: number, kind: string) => {
    const len = u1 - u0;
    if (kind === 'arcade') {
      // a portico: round arches on piers, deep shadow behind, a bookshop window inside
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i < n; i++) {
        const c = u0 + (len * (i + 0.5)) / n;
        const hw = (len / n) * 0.36;
        const pts: [number, number][] = [[c - hw, 0]];
        for (let j = 0; j <= 12; j++) {
          const t = Math.PI - (j / 12) * Math.PI;
          pts.push([c + Math.cos(t) * hw, 22 + Math.sin(t) * hw * 14]);
        }
        pts.push([c + hw, 0]);
        poly3(p, pts.map(([u, z]) => pl.at(u, z)), (_u, v2, x, y) => (v2 < 10 && hash(x, y, 3) < 0.4 ? '#4a3a30' : bayer(x, y) > 0.8 ? '#2a221e' : '#1e1814'), pl.light);
        // the shop window glimpsed inside, warm light
        pq(p, pl, c - hw * 0.6, c + hw * 0.6, 4, 15, '#3a2e24');
        pq(p, pl, c - hw * 0.5, c + hw * 0.5, 5, 14, i % 2 ? '#e8b860' : '#d89a48');
        for (let q = 0; q < 4; q++) pq(p, pl, c - hw * 0.5 + q * hw * 0.25, c - hw * 0.5 + q * hw * 0.25 + hw * 0.18, 5, 7 + (q % 3) * 2, ['#7a3a2a', '#2e4a6a', '#e8dcc6', '#3a5a3a'][q]);
      }
    } else if (kind === 'cafe') {
      // a bar: big windows, a striped awning, a sign board, a door
      for (let i = 0; i < Math.max(2, Math.round(len / 2)); i++) {
        const n = Math.max(2, Math.round(len / 2));
        const c = u0 + (len * (i + 0.5)) / n;
        const hw = (len / n) * 0.4;
        pq(p, pl, c - hw - 0.06, c + hw + 0.06, 2, 25, '#3a2a20');
        if (i === 1) door4(p, pl, c - hw * 0.6, c + hw * 0.6, 0, 22, ['#1e2a22', '#2a3a30', '#364a3e', '#425a4c', '#4e6a5a', '#5c7a68'], { glass: true });
        else pt(p, pl, c - hw, c + hw, 3, 24, (u, v2, x, y) => ((u + v2 * 0.6) % 34 < 4 ? '#c8dce2' : v2 < 30 ? (hash(x >> 1, y >> 1, 4) < 0.2 ? '#c88a40' : '#e8b860') : '#5a4636'), pl.light);
      }
      // the awning: green and cream stripes, scalloped hem
      const az = 27;
      for (let u = u0 + 0.1; u < u1 - 0.1; u += 0.18) {
        const stripe = Math.floor((u - u0) / 0.18) % 2;
        const top = pl.at(u, az + 5);
        const top2 = pl.at(u + 0.18, az + 5);
        const p0 = p.P(top[0], top[1], top[2]);
        const p1 = p.P(top2[0], top2[1], top2[2]);
        const out = 0.9;
        const q0 = pl === F ? p.P(u, b1 + out, az) : p.P(a1 + out, u, az);
        const q1 = pl === F ? p.P(u + 0.18, b1 + out, az) : p.P(a1 + out, u + 0.18, az);
        fillPoly(p.c, [p0, p1, q1, q0], stripe ? '#2e6a4a' : '#f2ead6');
        fillPoly(p.c, [q0, q1, [q1[0], q1[1] + 6], [q0[0] + (q1[0] - q0[0]) / 2, q0[1] + 9], [q0[0], q0[1] + 6]], stripe ? '#22543a' : '#e2d8c0');
      }
      // sign board
      pq(p, pl, u0 + len * 0.25, u0 + len * 0.75, 34, 38, '#1e2a22');
      for (let q = 0; q < 6; q++) pq(p, pl, u0 + len * 0.3 + q * len * 0.07, u0 + len * 0.3 + q * len * 0.07 + len * 0.04, 35, 37, '#e8c870');
    } else if (kind === 'gelato') {
      pq(p, pl, u0 + 0.2, u1 - 0.2, 2, 26, '#2a3a4a');
      pt(p, pl, u0 + 0.3, u1 - 0.3, 3, 25, (u: number, v2: number) => ((u + v2 * 0.6) % 34 < 4 ? '#d8eef2' : v2 < 34 ? ['#f2b6c8', '#f6e6a8', '#b8e2c8', '#e8c8a0'][Math.floor(u / 12) % 4] : '#4a5a6a'), pl.light);
      pq(p, pl, u0 + 0.2, u1 - 0.2, 28, 32, '#f2b6c8');
      for (let q = 0; q < 5; q++) pq(p, pl, u0 + 0.4 + q * 0.3, u0 + 0.55 + q * 0.3, 29, 31, '#ffffff');
    } else {
      // a grand portone in a stone frame and two barred windows
      const c = (u0 + u1) / 2;
      pq(p, pl, c - 0.75, c + 0.75, 0, 30, at(STONE, pl.light ? 5 : 3));
      door4(p, pl, c - 0.6, c + 0.6, 0, 27, ['#2a1a10', '#3e2818', '#523620', '#664428', '#7a5432', '#8e643c'], { glass: false });
      for (const s of [-1, 1]) {
        const wc = c + s * (len * 0.3);
        if (wc - 0.4 < u0 || wc + 0.4 > u1) continue;
        pq(p, pl, wc - 0.42, wc + 0.42, 9, 25, at(STONE, pl.light ? 4 : 2));
        pq(p, pl, wc - 0.34, wc + 0.34, 10, 24, '#2e3e48');
        for (let u = wc - 0.3; u <= wc + 0.3; u += 0.1) beam(p, pl, u, 10, u, 24, 0.15, IRON);
      }
    }
  };
  const gf: Record<string, [string, string]> = { home: ['door', 'door'], rosa: ['cafe', 'door'], crema: ['arcade', 'arcade'], verde: ['gelato', 'door'], gialla: ['door', 'cafe'] };
  const [gfF, gfS] = gf[v] ?? ['door', 'door'];
  ground(F, a0 + 0.3, a1 - 0.3, gfF);
  ground(S, b0 + 0.3, b1 - 0.3, gfS);
  void Rn;
  tetto(p, a0, a1, b0, b1, ze, Math.min(26, (b1 - b0) * 5), k.seed);
  // climbers on the home palazzo: a wisteria up the corner, ivy on the plinth
  if (v === 'home' || v === 'verde') {
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let z = 4; z < GH + SH; z += 3) {
        const [x, y] = p.P(a1 - 0.02, b1 - 0.02, z);
        masses.push({ x: x + (hash(z, 1, k.seed) - 0.5) * 18, y, rx: 8 + hash(z, 2, k.seed) * 5, ry: 7, z });
      }
      foliage(l, masses, R.oak, k.seed + 9, { cell: 3, dots: ['#9a7ad8', '#b8a0ec', '#7a5ab8'], dotChance: 0.5, dotSize: 4 });
    }, { outline: 0.6 });
  }
}

/** A row of houses sharing one long footprint: each its own colour, height and roof. */
function fila(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const Rn = rng(k.seed * 17 + 3);
  const parts: [number, number, string][] = [];
  const order = ['home', 'bianca', 'ocra', 'home', 'gialla', 'crema'];
  let a = 0;
  let i = 0;
  while (a < W - 0.5) {
    const w = Math.min(W - a, 5 + Rn() * 4);
    parts.push([a, w, order[(i + k.seed) % order.length]]);
    a += w;
    i++;
  }
  // back to front so each house overlaps the one behind
  for (const [a0, w, col] of parts) {
    const sub = new SubPainter(p, a0, w, D);
    palazzo(sub as unknown as PropPainter, { ...k, w, d: D, variant: col, seed: k.seed * 7 + Math.round(a0 * 13) });
  }
}

/** A window onto part of a prop: local a shifted by a0 (same depth, same rotation). */
class SubPainter {
  constructor(
    readonly base: PropPainter,
    readonly a0: number,
    readonly pw: number,
    readonly pd: number,
  ) {}
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
  W(a: number, b: number) {
    return this.base.W(a + this.a0, b);
  }
  P(a: number, b: number, z = 0) {
    return this.base.P(a + this.a0, b, z);
  }
}

const palazzoArt: PropArt = { draw: palazzo };

// ── the church ──────────────────────────────────────────────
// A baroque front facing the piazza to the east (+x, the prop's side plane a = w):
// two orders joined by volutes, pilasters, a portal on steps, niches with
// saints, a pediment with a cross; a ribbed dome on a drum rising behind, and
// the bell tower at the north-west corner.
const TRAVc: Ramp = ['#9a8a6e', '#b0a084', '#c4b598', '#d4c6aa', '#e2d6bc', '#eee4ce'];
const travertine: Mat = (light) => (u, v, x, y) => {
  let i = light ? 3.3 : 2.2;
  if ((v % 9) < 0.8) i -= 0.9;
  if (hash(Math.floor(u / 3), Math.floor(v / 9), 3) < 0.25) i -= 0.5;
  if (hash(x, y, 4) < 0.04) i -= 1;
  return at(TRAVc, i);
};

/** A ribbed dome on a drum, centred on (a, b) in the prop, from z0. */
function cupola(p: PropPainter, a: number, b: number, z0: number, r: number) {
  const [cx, cy] = p.P(a, b, z0);
  const K = p.k;
  const R0 = r * 16 * K * 1.15; // screen radius of the drum
  const drumH = 22 * K;
  const domeH = R0 * 0.95;
  const lead: Ramp = ['#2e3e44', '#3a4e56', '#486068', '#58747c', '#6c8a90', '#86a4a8'];
  layer(p.c, (l) => {
    // drum: a cylinder with pilasters and arched windows
    for (let i = -R0; i <= R0; i++) {
      const u = i / R0;
      const t = (u + 1) / 2;
      const yb = Math.sqrt(Math.max(0, 1 - u * u)) * R0 * 0.45;
      const tone = t < 0.25 ? 5 : t < 0.5 ? 4 : t < 0.78 ? 3 : 2;
      const pil = Math.abs(((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI) * 16) % 1) < 0.12;
      for (let j = 0; j < drumH; j++) {
        const win = !pil && j > drumH * 0.25 && j < drumH * 0.8 && Math.abs(((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI) * 16 + 0.5) % 1 - 0.5) < 0.18;
        px(l, cx + i, cy + yb - j, win ? '#2a2e34' : TRAVc[Math.max(0, tone - (pil ? 0 : 1))]);
      }
    }
    ell(l, cx, cy - drumH, R0 + 3, (R0 + 3) * 0.45, TRAVc[4]);
    // the dome: a half ellipsoid of lead with ribs, lit from the upper left
    for (let j = 0; j < domeH; j++) {
      const t = j / domeH;
      const w = R0 * Math.sqrt(Math.max(0, 1 - t * t));
      for (let i = -w; i <= w; i++) {
        const u = i / Math.max(1, w);
        const lit = -u * 0.6 + 0.4 - t * 0.2;
        let tone = Math.round(2.6 + lit * 2.4);
        const rib = Math.abs(((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI) * 12) % 1) < 0.08;
        if (rib) tone += 1;
        px(l, cx + i, cy - drumH - j, lead[Math.max(0, Math.min(5, tone))]);
      }
    }
    // the lantern on top with a little cupola and a cross
    const ly = cy - drumH - domeH;
    px(l, cx - 7, ly - 18, TRAVc[4], 14, 18);
    px(l, cx - 3, ly - 14, '#2a2e34', 3, 10);
    px(l, cx + 2, ly - 14, '#2a2e34', 3, 10);
    ell(l, cx, ly - 19, 9, 5, lead[3]);
    ell(l, cx - 2, ly - 21, 5, 3, lead[5]);
    px(l, cx - 1, ly - 34, '#3a3a40', 2, 12);
    px(l, cx - 5, ly - 30, '#3a3a40', 10, 2);
  });
}

const chiesa: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const fA = W - 0.1;
    const b0 = 0.8;
    const b1 = D - 0.8;
    const bm = (b0 + b1) / 2;
    // the nave behind the front with its tiled roof, and the dome over the crossing
    lbox(p, 0.4, b0 + 1, W - 1.4, b1 - b0 - 2, 0, 56, { front: stucco(STUCCO.crema), side: stucco(STUCCO.crema), top: (_l) => () => '#6a5a4a', edge: '#6a5a4a' });
    poly3(p, [[0.3, b1 - 0.9, 56], [W - 1, b1 - 0.9, 56], [W - 1, bm, 72], [0.3, bm, 72]], coppi, 1);
    cupola(p, W - 4.2, bm, 66, 1.7);
    const S = side3(p, fA);
    const light = S.light;
    // lower order: full width; upper order: narrower; volutes between
    lbox(p, fA - 0.5, b0, 0.5, b1 - b0, 0, 40, { front: travertine, side: travertine, top: travertine, edge: TRAVc[0] });
    const u0 = b0 + 1.35;
    const u1 = b1 - 1.35;
    lbox(p, fA - 0.4, u0, 0.4, u1 - u0, 40, 30, { front: travertine, side: travertine, top: travertine, edge: TRAVc[0] });
    for (const [ua, ub, dir] of [[b0 + 0.3, u0, 1], [u1, b1 - 0.3, -1]] as const) {
      const pts: [number, number][] = [];
      for (let j = 0; j <= 12; j++) {
        const t = j / 12;
        const u = dir > 0 ? ua + (ub - ua) * t : ub - (ub - ua) * t;
        pts.push([u, 41.4 + Math.pow(t, 1.8) * 16]);
      }
      pts.push([dir > 0 ? ub : ua, 41.4]);
      poly3(p, pts.map(([u, z]) => S.at(u, z)), travertine, light);
      // the scroll's curl
      const [vx, vy] = S.F(dir > 0 ? ua + 0.2 : ub - 0.2, 44);
      ell(p.c, vx, vy, 5, 5, TRAVc[1]);
      ell(p.c, vx, vy, 3, 3, TRAVc[4]);
    }
    // cornices: a lit top lip, a body, a deep shadow underneath
    pq(p, S, b0, b1, 38.2, 41.4, TRAVc[4]);
    pq(p, S, b0, b1, 40.6, 41.4, TRAVc[5]);
    pq(p, S, b0, b1, 36.8, 38.2, TRAVc[0]);
    pq(p, S, u0 - 0.1, u1 + 0.1, 68.6, 71.4, TRAVc[4]);
    pq(p, S, u0 - 0.1, u1 + 0.1, 70.6, 71.4, TRAVc[5]);
    pq(p, S, u0 - 0.1, u1 + 0.1, 67.4, 68.6, TRAVc[0]);
    // a slate-grey tympanum inside the portal's pediment and a coat of arms over the door
    const [sx2, sy2] = S.F(bm, 33.5);
    layer(p.c, (l) => {
      fillPoly(l, [[sx2 - 8, sy2 - 10], [sx2 + 8, sy2 - 10], [sx2 + 8, sy2 + 2], [sx2, sy2 + 8], [sx2 - 8, sy2 + 2]], '#c8a050');
      fillPoly(l, [[sx2 - 6, sy2 - 8], [sx2 + 6, sy2 - 8], [sx2 + 6, sy2 + 1], [sx2, sy2 + 6], [sx2 - 6, sy2 + 1]], '#8a2a2a');
      px(l, sx2 - 1, sy2 - 6, '#f2d26a', 2, 10);
      px(l, sx2 - 4, sy2 - 2, '#f2d26a', 8, 2);
      ell(l, sx2, sy2 - 13, 6, 3, '#c8a050');
    });
    // the pediment
    poly3(p, [S.at(u0 - 0.15, 71.4), S.at(u1 + 0.15, 71.4), S.at(bm, 86)], travertine, light);
    poly3(p, [S.at(u0 + 0.25, 72.6), S.at(u1 - 0.25, 72.6), S.at(bm, 83.6)], (_u: number, _v: number) => at(TRAVc, light ? 2 : 1), light);
    // pilasters with capitals on both orders
    const pil = (u: number, z0: number, z1: number) => {
      // a pilaster stands proud of the wall: a lit flank, a body, a shadow flank, capital and base
      pq(p, S, u, u + 0.24, z0, z1, at(TRAVc, light ? 5 : 3.4));
      pq(p, S, u, u + 0.04, z0, z1, TRAVc[5]);
      pq(p, S, u + 0.2, u + 0.24, z0, z1, TRAVc[1]);
      pq(p, S, u + 0.24, u + 0.29, z0, z1, 'rgba(40,30,30,0.28)');
      pq(p, S, u - 0.06, u + 0.3, z1 - 2.6, z1, TRAVc[4]);
      pq(p, S, u - 0.06, u + 0.3, z1 - 2.8, z1 - 2.6, TRAVc[0]);
      pq(p, S, u - 0.04, u + 0.28, z0, z0 + 1.6, TRAVc[3]);
    };
    for (const u of [b0 + 0.25, b0 + 1.45, b1 - 1.67, b1 - 0.47]) pil(u, 0, 37.6);
    for (const u of [u0 + 0.1, u1 - 0.32]) pil(u, 41.4, 68.6);
    // portal: steps, door frame, a curved pediment, the doors
    for (let s2 = 0; s2 < 3; s2++) lbox(p, fA + 0.05 + s2 * 0.24, bm - 1.4 + s2 * 0.12, 0.27, 2.8 - s2 * 0.24, 0, 2.4 - s2 * 0.8, { front: cutStone4(TRAVc, 2.4), side: cutStone4(TRAVc, 2.4), top: cutStone4(TRAVc, 30), edge: TRAVc[0] });
    pq(p, S, bm - 0.95, bm + 0.95, 2.4, 29, at(TRAVc, light ? 5 : 3));
    door4(p, S, bm - 0.62, bm + 0.62, 2.4, 25, ['#3a2214', '#4e2e1a', '#643c22', '#7a4a2a', '#905a34', '#a66a3e'], { glass: false });
    const arc: [number, number][] = [];
    for (let j = 0; j <= 14; j++) {
      const t = Math.PI - (j / 14) * Math.PI;
      arc.push([bm + Math.cos(t) * 1.05, 29 + Math.sin(t) * 6]);
    }
    poly3(p, arc.map(([u, z]) => S.at(u, z)), travertine, light);
    // the rose window in the upper order
    const [rx, ry] = S.F(bm, 54);
    layer(p.c, (l) => {
      ell(l, rx, ry, 22, 24, TRAVc[1]);
      ell(l, rx, ry, 19, 21, '#2e3e5e');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ln(l, rx, ry, rx + Math.cos(a) * 18, ry + Math.sin(a) * 20, TRAVc[4], 2);
        ell(l, rx + Math.cos(a + 0.26) * 12, ry + Math.sin(a + 0.26) * 13, 3, 3, ['#c8382a', '#2a5aa8', '#e2b23a'][i % 3]);
      }
      ell(l, rx, ry, 5, 5, TRAVc[4]);
    });
    // niches with saints either side of the portal, and on the pediment's ends
    for (const u of [b0 + 0.82, b1 - 1.08]) {
      const [nx, ny] = S.F(u + 0.12, 10);
      layer(p.c, (l) => {
        fillPoly(l, [[nx - 9, ny], [nx + 9, ny], [nx + 9, ny - 34], [nx, ny - 42], [nx - 9, ny - 34]], '#7a6e5a');
        fillPoly(l, [[nx - 6, ny], [nx + 6, ny], [nx + 6, ny - 30], [nx - 6, ny - 30]], '#5a5040');
        fillPoly(l, [[nx - 5, ny], [nx + 5, ny], [nx + 3, ny - 24], [nx - 3, ny - 24]], TRAVc[4]);
        ell(l, nx, ny - 27, 3, 3.5, TRAVc[5]);
        px(l, nx + 2, ny - 22, TRAVc[2], 1, 18);
      });
    }
    const [tx, ty] = S.F(bm, 86);
    layer(p.c, (l) => {
      px(l, tx - 1, ty - 22, '#4a4a50', 3, 22);
      px(l, tx - 7, ty - 16, '#4a4a50', 15, 3);
      for (const du of [-1.15, 1.15]) {
        const [sx, sy] = S.F(bm + du, 71.4);
        fillPoly(l, [[sx - 5, sy], [sx + 5, sy], [sx + 3, sy - 20], [sx - 3, sy - 20]], TRAVc[4]);
        ell(l, sx, sy - 23, 3, 3.5, TRAVc[5]);
      }
    });
    // the bell tower at the north-west corner
    const ta = W - 2.6;
    const tb = b0 + 0.1;
    lbox(p, ta, tb - 1.7, 1.7, 1.7, 0, 108, { front: stucco(STUCCO.crema), side: stucco(STUCCO.crema), top: (_l) => () => '#6a5a4a', edge: '#6a5a4a' });
    const TF = front3(p, tb);
    const TS = side3(p, ta + 1.7);
    for (const [pl, uA] of [[TF, ta], [TS, tb - 1.7]] as const) {
      for (const z of [38, 72]) pq(p, pl, uA, uA + 1.7, z, z + 1.8, at(TRAVc, pl.light ? 4 : 2));
      // a clock face on the middle storey
      const [ccx, ccy] = pl.F(uA + 0.85, 55);
      layer(p.c, (l) => {
        ell(l, ccx, ccy, 11, 12, TRAVc[1]);
        ell(l, ccx, ccy, 9, 10, '#f2ead6');
        ln(l, ccx, ccy, ccx, ccy - 7, '#2a2a30', 2);
        ln(l, ccx, ccy, ccx + 5, ccy + 2, '#2a2a30', 2);
      });
      // the belfry: two arched openings, each with a bell
      for (const off of [0.44, 1.26]) {
        const c2 = uA + off;
        const pts: [number, number][] = [[c2 - 0.25, 80]];
        for (let j = 0; j <= 10; j++) {
          const t = Math.PI - (j / 10) * Math.PI;
          pts.push([c2 + Math.cos(t) * 0.25, 98 + Math.sin(t) * 4]);
        }
        pts.push([c2 + 0.25, 80]);
        poly3(p, pts.map(([u, z]) => pl.at(u, z)), (_u: number, _v: number) => '#1e1a18', pl.light);
        const [bx, by] = pl.F(c2, 93);
        ell(p.c, bx, by, 6, 7, '#8a6a2a');
        ell(p.c, bx - 2, by - 2, 2, 3, '#c8a050');
      }
    }
    const apex: [number, number, number] = [ta + 0.85, tb - 0.85, 130];
    poly3(p, [[ta - 0.1, tb + 0.1, 108], [ta + 1.8, tb + 0.1, 108], apex], coppi, 1);
    poly3(p, [[ta + 1.8, tb + 0.1, 108], [ta + 1.8, tb - 1.8, 108], apex], coppi, 0);
    const [ax, ay] = p.P(...apex);
    px(p.c, ax - 1, ay - 16, '#3a3a40', 2, 16);
    px(p.c, ax - 5, ay - 12, '#3a3a40', 10, 2);
  },
};

// ── a distant roofscape (fills the frame's far corners) ─────
const tetti: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 3 + 7);
    const W = k.w;
    const D = k.d;
    const keys = Object.keys(STUCCO);
    // blocks of different heights and colours, back to front; each a flat-shaded box with window rows and a roof
    const blocks: [number, number, number, number, number, string][] = [];
    for (let a = 0; a < W - 1; a += 2.6 + Rn() * 2)
      for (let b = 0; b < D - 1; b += 2.6 + Rn() * 2) {
        const w = Math.min(W - a, 2.4 + Rn() * 2);
        const d = Math.min(D - b, 2.4 + Rn() * 2);
        blocks.push([a, b, w, d, 64 + Math.floor(Rn() * 4) * 30, keys[Math.floor(Rn() * keys.length)]]);
      }
    blocks.sort((m, n) => m[0] + m[1] - (n[0] + n[1]));
    for (const [a, b, w, d, h, ck] of blocks) {
      const r = STUCCO[ck];
      const f0 = p.P(a, b + d, 0);
      const f1 = p.P(a + w, b + d, 0);
      const f2 = p.P(a + w, b + d, h);
      const f3 = p.P(a, b + d, h);
      const s1 = p.P(a + w, b, 0);
      const s2 = p.P(a + w, b, h);
      fillPoly(p.c, [f0, f1, f2, f3], r[3]);
      fillPoly(p.c, [f1, s1, s2, f2], r[1]);
      // a damp band at the foot and a cornice line
      fillPoly(p.c, [f0, f1, [f1[0], f1[1] - 24], [f0[0], f0[1] - 24]], r[2]);
      const F = front3(p, b + d);
      const S = side3(p, a + w);
      pq(p, F, a, a + w, h - 2, h, r[5]);
      pq(p, S, b, b + d, h - 2, h, r[3]);
      const shut = ['#2e4a3a', '#5a3e2a', '#3a4a5a'][Math.floor(Rn() * 3)];
      for (let z = 12; z < h - 12; z += 30) {
        for (let u = a + 0.35; u < a + w - 0.3; u += 0.85) {
          const open = Rn() < 0.6;
          pq(p, F, u, u + 0.3, z, z + 15, open ? '#2e3a44' : shut);
          if (open) pq(p, F, u - 0.12, u, z, z + 15, shut);
        }
        for (let u = b + 0.35; u < b + d - 0.3; u += 0.85) pq(p, S, u, u + 0.3, z, z + 15, Rn() < 0.6 ? '#26323a' : darken(shut, 0.2));
      }
      // the roof: two flat-shaded planes, a hip, a ridge and a chimney
      const oh = 0.25;
      const rise = Math.min(18, d * 4);
      const bm = b + d / 2;
      const ins = Math.min(d / 2, 1.6);
      const A = p.P(a - oh, b + d + oh, h);
      const B = p.P(a + w + oh, b + d + oh, h);
      const Cc = p.P(a + w + oh - ins, bm, h + rise);
      const Dd = p.P(a - oh + ins, bm, h + rise);
      const E = p.P(a + w + oh, b - oh, h);
      fillPoly(p.c, [A, B, Cc, Dd], TILE[4]);
      fillPoly(p.c, [B, E, Cc], TILE[2]);
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        ln(p.c, A[0] + (Dd[0] - A[0]) * t, A[1] + (Dd[1] - A[1]) * t, B[0] + (Cc[0] - B[0]) * t, B[1] + (Cc[1] - B[1]) * t, TILE[3]);
      }
      ln(p.c, Dd[0], Dd[1], Cc[0], Cc[1], TILE[6], 2);
      ln(p.c, A[0], A[1] + 1, B[0], B[1] + 1, mix(TILE[0], OUTL, 0.4), 2);
      if (Rn() < 0.7) {
        const [cx, cy] = p.P(a + w * (0.3 + Rn() * 0.4), bm + 0.3, h + rise * 0.6);
        px(p.c, cx - 4, cy - 16, r[2], 8, 16);
        px(p.c, cx - 5, cy - 18, TILE[3], 10, 3);
      }
    }
  },
};

export const OFFICE_PALAZZI: Record<string, PropArt> = { palazzo: palazzoArt, chiesa, tetti };
export { STUCCO, STONE, TILE, IRON, stucco, coppi };

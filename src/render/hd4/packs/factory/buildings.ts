// Factory — the Albion Works and its neighbours (1 z ≈ 10 cm; a mill storey ≈ 32 z).
//   fac_shed        the north-light weaving shed behind the press shop: a brick front
//                   with a zig-zag parapet, glazed teeth facing away from the sun, slate
//                   slopes, valley gutters and downpipes, dock doors on its yard end
//   fac_mill        the three-storey spinning mill: English-bond brick, segmental windows
//                   in long rows, stone string courses, a stair tower with the works clock
//   fac_boiler      the boiler house: tall round-arched windows, a ridge ventilator
//   fac_chimney     the mill chimney: a stone-capped pedestal, a tapering round shaft,
//                   iron bands, a corbelled crown, a thread of smoke
//   fac_watertower  a riveted steel tank on a braced lattice of four legs
//   fac_derelict    a roofless shed across the canal, buddleia in its gutters
//   fac_unit        a little corrugated workshop with a roller door
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { bayer, contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, OUTL, px, type Ramp, rng } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import { lbox } from '../util';
import { acUnit, cowl } from './estate';
import { planeText } from './font';
import { at, BLUEBRICK, brick, BRICK, BUDDLEIA, CONC, corrugated, face3, frontLong, glazing, GLASS, IRON, massRect, sideLong, OLDWOOD, SHEET, slate, SLATE, SOOT, STEEL, STONE, TIMBER, WEED, YELLOW } from './palette';

type V3 = [number, number, number];

const stoneMat: Mat = (light) => (u, v, x, y) => at(STONE, (light === 2 ? 4 : light ? 3.4 : 2) - (hash(x, y, 3) < 0.05 ? 1 : 0) - (u % 40 < 1 ? 1 : 0) + (v < 1.5 ? -0.6 : 0));
const flatMat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });

/** A line along a plane between two (u, z) points. */
function pline(p: PropPainter, pl: Plane, u0: number, z0: number, u1: number, z1: number, col: string, w = 1) {
  const [x0, y0] = pl.F(u0, z0);
  const [x1, y1] = pl.F(u1, z1);
  ln(p.c, x0, y0, x1, y1, col, w);
}

/** Segmental brick arch over an opening. */
function arch(p: PropPainter, pl: Plane, u0: number, u1: number, z: number, rise: number, depth = 2.2, r: Ramp = BRICK) {
  const n = Math.max(5, Math.round((u1 - u0) * 10));
  const um = (u0 + u1) / 2;
  const half = (u1 - u0) / 2 + 0.06;
  const zAt = (u: number, d: number) => z + rise * Math.max(0, 1 - ((u - um) / half) ** 2) + d;
  for (let i = 0; i < n; i++) {
    const a = um - half + (2 * half * i) / n;
    const b = um - half + (2 * half * (i + 1)) / n;
    fillPoly(p.c, [pl.F(a, zAt(a, 0)), pl.F(b, zAt(b, 0)), pl.F(b, zAt(b, depth)), pl.F(a, zAt(a, depth))], at(r, (pl.light ? 3.6 : 2.2) + (i % 2 ? -0.7 : 0)));
  }
}

/**
 * A mill window: dark reveal, cast-iron glazing in small panes (a few lit warm,
 * a few broken), a segmental arch, a stone sill.
 */
function millWindow(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, seed: number, o: { lit?: number; rise?: number; round?: boolean } = {}) {
  const L = pl.light;
  pq(p, pl, u0 - 0.03, u1 + 0.03, z0 - 0.3, z1, L ? '#3a3234' : '#2a2426');
  // the whole window glows warm (o.lit is the chance of that), its panes in a few shades
  const lit = windowLit(seed, o.lit ?? 0.3);
  const pane: FaceTex = (u, v, x, y) => {
    const cu = Math.floor(u / 6);
    const cv = Math.floor(v / 7);
    if (u % 6 < 1 || v % 7 < 1) return L ? '#2e2a2c' : '#221e20';
    const h = hash(cu, cv, seed);
    if (h < 0.04) return '#121014';
    if (lit) return h > 0.85 ? '#ffe6a0' : h < 0.14 ? '#c8923a' : hash(x, y, 3) < 0.2 ? '#e8b850' : '#f4c858';
    const d = (u * 0.8 + v) % 30;
    return at(GLASS, (L ? 2.2 : 1.4) + (d > 4 && d < 8 ? 1.8 : 0) + (h - 0.5) * 0.8);
  };
  pt(p, pl, u0 + 0.04, u1 - 0.04, z0, z1 - 0.4, pane, L);
  if (o.round) {
    // a round head: voussoirs in a half circle
    const um = (u0 + u1) / 2;
    const r = (u1 - u0) / 2;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI - (i / n) * Math.PI;
      const a1 = Math.PI - ((i + 1) / n) * Math.PI;
      const q = [pl.F(um + Math.cos(a0) * r, z1 + Math.sin(a0) * r * 14), pl.F(um + Math.cos(a1) * r, z1 + Math.sin(a1) * r * 14), pl.F(um + Math.cos(a1) * (r + 0.1), z1 + Math.sin(a1) * (r + 0.1) * 14), pl.F(um + Math.cos(a0) * (r + 0.1), z1 + Math.sin(a0) * (r + 0.1) * 14)];
      const inner = [pl.F(um, z1), pl.F(um + Math.cos(a0) * r, z1 + Math.sin(a0) * r * 14), pl.F(um + Math.cos(a1) * r, z1 + Math.sin(a1) * r * 14)];
      fillPoly(p.c, inner, i % 3 === 1 ? at(GLASS, L ? 3 : 2) : L ? '#2e2a2c' : '#221e20');
      fillPoly(p.c, q, at(BRICK, (L ? 3.6 : 2.2) + (i % 2 ? -0.7 : 0)));
    }
  } else arch(p, pl, u0, u1, z1 - 0.4, o.rise ?? 0.8);
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 0.9, z0, at(STONE, L ? 4 : 2.4));
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.2, z0 - 0.9, mix(STONE[0], OUTL, 0.4));
}

/** Is this mill window lit (shared by the drawing and the night lights)? */
const windowLit = (seed: number, chance: number) => hash(seed, 77, 5) < chance;

/** A downpipe with its hopper head down a facade plane. */
function downpipe(p: PropPainter, pl: Plane, u: number, z0: number, z1: number) {
  const w = 0.035;
  pq(p, pl, u - w, u + w, z0, z1, IRON[2]);
  pq(p, pl, u - w, u - w * 0.2, z0, z1, IRON[4]);
  pq(p, pl, u - w * 2.2, u + w * 2.2, z1 - 2, z1, IRON[3]);
  pq(p, pl, u - w * 2.2, u + w * 2.2, z1 - 0.5, z1, IRON[5]);
  for (let z = z0 + 6; z < z1 - 3; z += 8) pq(p, pl, u - w * 1.5, u + w * 1.5, z, z + 0.4, IRON[1]);
  pq(p, pl, u - w * 1.6, u + w * 2.6, z0, z0 + 0.8, IRON[3]);
}

// ── the north-light weaving shed ────────────────────────────
const fac_shed: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const E = 46;
    const rise = 21;
    const nT = Math.max(2, Math.round(W / 3));
    const tw = W / nT;
    const F = front3(p, D);
    const S = side3(p, W);
    const brk = brick(BRICK, { soot: 0.12 });
    // the teeth, back to front along a: slate slope rising to the ridge, then the glazing facing +a (away from the sun)
    for (let i = 0; i < nT; i++) {
      const x0 = i * tw;
      const x1 = x0 + tw;
      face3(p, [x0, D, E], [0, -D, 0], [tw, 0, rise], slate(SLATE, 0.03), 2, Math.ceil(D / 2));
      // a strip of patent glazing near the ridge of each slope
      face3(p, [x1 - tw * 0.22, D - 0.2, E + rise * 0.78], [0, -(D - 0.6), 0], [tw * 0.22 - 0.06, 0, rise * 0.22 - 0.4], glazing({ pw: 10, ph: 7, seed: i, dark: true }), 2, Math.ceil(D / 2));
      // roof plant on the slope: cowl ventilators and air handlers in a row
      for (let b = 1.2, j = 0; b < D - 0.8; b += 1.9, j++) {
        const t = 0.32;
        const a = x0 + tw * t;
        const z = E + rise * t;
        if ((i + j) % 3 === 1) acUnit(p, a - 0.3, b - 0.25, z, (i + j) % 2 === 0);
        else cowl(p, a, b, z);
      }
      // the north light: a tall glazed face
      const G = side3(p, x1);
      sideLong(p, x1, 0, D, E, E + rise, glazing({ pw: 17, ph: 14, seed: i + 7, sky: true, bar: '#3a4048' }), 0);
      for (let b = 0.9; b < D; b += 2.2) pq(p, G, b, b + 0.06, E, E + rise, '#1e2024');
      // the ridge cap and the lead-lined valley gutter
      const r0 = p.P(x1, 0, E + rise);
      const r1 = p.P(x1, D, E + rise);
      ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, SLATE[6], 2);
      const v0 = p.P(x0, 0, E);
      const v1 = p.P(x0, D, E);
      ln(p.c, v0[0], v0[1], v1[0], v1[1], '#2a2a32', 3);
      ln(p.c, v0[0], v0[1] - 1, v1[0], v1[1] - 1, '#6a6e78', 1);
    }
    // the yard end (+a): brick up to the eaves under the last glazed tooth, dock doors with a platform
    sideLong(p, W, 0, D, 0, E, brk, 0);
    pq(p, S, 0, D, 0, 4, BLUEBRICK[1]);
    pq(p, S, 0, D, E - 1.6, E, at(STONE, 2));
    pq(p, S, 0, D, E - 2, E - 1.6, mix(STONE[0], OUTL, 0.4));
    const docks = Math.max(1, Math.floor((D - 1.5) / 3.6));
    for (let i = 0; i < docks; i++) {
      const c = D - 2.2 - i * 3.6;
      // a roller door over the dock, its hood, bumpers, the yellow edge of the dock
      pq(p, S, c - 1.15, c + 1.15, 12, 36, '#2a2628');
      pt(p, S, c - 1.05, c + 1.05, 12, 35, (_u: number, v: number) => at(SHEET, (v % 5 < 1 ? 0.6 : v % 5 < 2 ? 2.6 : 1.8)), 0);
      pq(p, S, c - 1.25, c + 1.25, 35, 37.5, at(SHEET, 1));
      pq(p, S, c - 1.25, c + 1.25, 37, 37.5, at(SHEET, 3));
      planeText(p.c, S, c, 39.5, 'DOCK ' + (i + 1), '#e8e2d0', 2);
    }
    // the dock platform: a concrete loading bank along the end wall, yellow edge, steps
    lbox(p, W, 0.6, 1.4, D - 0.6, 0, 12, { front: flatMat(CONC, 3, 2), side: (light) => (u, v, x, y) => (v > 44 ? at(YELLOW, 3) : at(CONC, (light ? 3 : 2) - (hash(x, y, 5) < 0.06 ? 1 : 0) - (u % 72 < 1.2 ? 1 : 0))), top: (light) => (u, _v, x, y) => at(CONC, (light === 2 ? 4 : 3) - (hash(x >> 1, y >> 1, 6) < 0.08 ? 1 : 0) - (u % 64 < 1 ? 1 : 0)), edge: CONC[0] });
    for (let i = 0; i < docks; i++) {
      const c = D - 2.2 - i * 3.6;
      const B = side3(p, W + 1.401);
      for (const s of [-0.85, 0.75]) pq(p, B, c + s, c + s + 0.12, 7, 11, '#1e1e22');
    }
    // windows high in the yard end between the docks
    for (let b = 1.1; b < D - 1; b += 3.6) millWindow(p, S, b, b + 0.7, 17, 33, k.seed + Math.round(b * 7), { lit: 0.5 });
    // the front: brick to the eaves, a gable over each tooth with a bullseye window, a stone coping following the teeth
    frontLong(p, D, 0, W, 0, E, brk, 1);
    pq(p, F, 0, W, 0, 4, BLUEBRICK[3]);
    pq(p, F, 0, W, 3.6, 4.2, mix(BLUEBRICK[0], OUTL, 0.3));
    for (let i = 0; i < nT; i++) {
      const x0 = i * tw;
      const x1 = x0 + tw;
      poly3(p, [[x0, D, E], [x1, D, E], [x1, D, E + rise]], brk, 1, [[x0, D, 0], [x1, D, 0], [x0, D, E + rise]]);
      // coping along the rake and down the vertical end of each tooth
      const a = F.F(x0, E);
      const b = F.F(x1, E + rise);
      const c = F.F(x1, E);
      fillPoly(p.c, [[a[0], a[1] - 4], [b[0], b[1] - 4], [b[0], b[1] + 1], [a[0], a[1] + 1]], at(STONE, 4));
      ln(p.c, a[0], a[1] - 4, b[0], b[1] - 4, STONE[5]);
      ln(p.c, a[0], a[1] + 2, b[0], b[1] + 2, mix(STONE[0], OUTL, 0.4));
      fillPoly(p.c, [[b[0] - 3, b[1] - 4], [b[0] + 3, b[1] - 4], [c[0] + 3, c[1]], [c[0] - 3, c[1]]], at(STONE, 3));
      // the bullseye window in the gable
      const [ox, oy] = F.F(x0 + tw * 0.66, E + rise * 0.42);
      layer(p.c, (l) => {
        ell(l, ox, oy, 15, 15, at(STONE, 4));
        ell(l, ox, oy, 12, 12, '#2a2628');
        for (let q = 0; q < 8; q++) {
          const ang = (q / 8) * Math.PI * 2;
          ln(l, ox, oy, ox + Math.cos(ang) * 11, oy + Math.sin(ang) * 11, '#4a4a52');
        }
        ell(l, ox - 3, oy - 3, 4, 3, at(GLASS, 4));
      }, { outline: false, rect: [ox - 17, oy - 17, ox + 17, oy + 17] });
      // a downpipe from each valley
      if (i > 0) downpipe(p, F, x0 + 0.06, 0.5, E - 0.6);
      // two tall windows per bay
      for (const f of [0.22, 0.6]) millWindow(p, F, x0 + tw * f, x0 + tw * f + 0.75, 9, 34, k.seed * 13 + i * 3 + Math.round(f * 10), { lit: 0.4 });
    }
    // the eaves band with the works' name painted across it in white
    pq(p, F, 0, W, E - 1.4, E, at(STONE, 3.6));
    pq(p, F, 0, W, E - 1.8, E - 1.4, mix(STONE[0], OUTL, 0.4));
    const um = W * 0.5;
    pq(p, F, um - 3.4, um + 3.4, 36.2, 43.6, '#2a2224');
    pq(p, F, um - 3.3, um + 3.3, 36.6, 43.2, '#3a2c2c');
    planeText(p.c, F, um, 39.9, 'ALBION WORKS', '#ece6d6', 3);
    // ivy and buddleia have found the corner and a gutter
    // ivy climbing the corner: a carpet of small leaves spreading up and along the front wall
    const IVY = ['#1e2e18', '#2a4020', '#36522a', '#466634', '#5a7c40', '#72944e'];
    const [ix0, iy0] = F.F(W - 1.5, 34);
    const [ix1, iy1] = F.F(W, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 5; i++) {
        const [x0, y0] = F.F(W - 0.08 - i * 0.22, 0);
        const [x1, y1] = F.F(W - 0.1 - i * 0.3, 24 - i * 3.5);
        ln(l, x0, y0, x1, y1, '#4a3e2e');
      }
      for (let i = 0; i < 900; i++) {
        const t = Math.pow(hash(i, 1, k.seed), 1.6);
        const zMax = 33 - t * 26;
        const z = hash(i, 2, k.seed) * zMax;
        if (hash(i, 5, k.seed) > 1 - z / zMax + 0.35) continue; // thinner toward the top
        const [x, y] = F.F(W - 0.04 - t * 1.4, z);
        const lit = hash(i, 3, k.seed);
        const c = lit < 0.3 ? 1 : lit < 0.65 ? 2 : lit < 0.9 ? 3 : 4;
        px(l, x, y, IVY[c + 1], 2, 1);
        px(l, x, y + 1, IVY[c], 3, 1);
        px(l, x + 2, y + 1, IVY[c - 1]);
      }
    }, { outline: 0.6, rect: [Math.min(ix0, ix1) - 6, Math.min(iy0, iy1) - 6, Math.max(ix0, ix1) + 6, Math.max(iy0, iy1) + 6] });
  },
};

// ── the spinning mill ───────────────────────────────────────
const fac_mill: PropArt = {
  draw(p, k) {
    const W = k.w - 1; // the main block; the stair tower stands proud on the +a side
    const D = k.d;
    const GH = 38;
    const SH = 32;
    const n = 3;
    const ze = GH + (n - 1) * SH;
    const zr = ze + 26;
    const S = side3(p, W);
    const F = front3(p, D);
    const brk = brick(BRICK, { soot: 0.15 });
    // the roof first: a pitched slate roof, ridge along b, its visible +a slope, the +b gable
    const bm = W / 2;
    face3(p, [W + 0.3, -0.3, ze - 1], [0, D + 0.6, 0], [bm - W - 0.3, 0, zr - ze + 1], slate(SLATE, 0.035), 0, Math.ceil((D + 0.6) / 2));
    const R0 = p.P(bm, -0.3, zr);
    const R1 = p.P(bm, D + 0.3, zr);
    ln(p.c, R0[0], R0[1] - 1, R1[0], R1[1] - 1, SLATE[6], 3);
    // roof lights and two ventilators along the slope
    for (let b = 1.2; b < D - 1; b += 2.6) {
      const a = W - 1.6;
      const z = ze - 1 + ((W + 0.3 - a) / (W + 0.3 - bm)) * (zr - ze + 1);
      const z2 = ze - 1 + ((W + 0.3 - (a - 0.9)) / (W + 0.3 - bm)) * (zr - ze + 1);
      poly3(p, [[a, b + 0.8, z], [a, b, z], [a - 0.9, b, z2], [a - 0.9, b + 0.8, z2]], glazing({ pw: 8, ph: 7, seed: Math.round(b * 3) }), 0);
    }
    // the visible gable end (+b): brick with taking-in doors and a hoist beam (cathead)
    poly3(p, [[0, D, ze - 1], [W, D, ze - 1], [bm, D, zr]], brk, 1, [[0, D, 0], [W, D, 0], [0, D, zr]]);
    // walls
    frontLong(p, D, 0, W, 0, ze, brk, 1);
    sideLong(p, W, 0, D, 0, ze, brk, 0);
    for (const pl of [F, S]) {
      const len = pl === F ? W : D;
      pq(p, pl, 0, len, 0, 4.5, BLUEBRICK[pl.light ? 3 : 1]);
      for (let s = 1; s < n; s++) {
        const z = GH + (s - 1) * SH;
        pq(p, pl, 0, len, z - 0.6, z + 0.9, at(STONE, pl.light ? 4 : 2.4));
        pq(p, pl, 0, len, z - 0.9, z - 0.6, mix(STONE[0], OUTL, 0.4));
      }
      // the cornice
      pq(p, pl, 0, len, ze - 2.4, ze, at(STONE, pl.light ? 4.4 : 2.6));
      pq(p, pl, 0, len, ze - 2.8, ze - 2.4, mix(STONE[0], OUTL, 0.5));
    }
    // the near (−a) slope, facing the sky: drawn over the walls and the gable, so its eaves and its
    // verge overhang them; roof lights along it and a lead-capped ridge
    face3(p, [-0.3, -0.3, ze - 1], [0, D + 0.6, 0], [bm + 0.3, 0, zr - ze + 1], slate(SLATE, 0.035), 1, Math.ceil((D + 0.6) / 2));
    for (let b = 2.1; b < D - 1.5; b += 3.4) {
      const a = 1.5;
      const z = ze - 1 + ((a + 0.3) / (bm + 0.3)) * (zr - ze + 1);
      const z2 = ze - 1 + ((a + 0.3 + 0.9) / (bm + 0.3)) * (zr - ze + 1);
      poly3(p, [[a, b + 0.8, z], [a, b, z], [a + 0.9, b, z2], [a + 0.9, b + 0.8, z2]], glazing({ pw: 8, ph: 7, seed: Math.round(b * 5) + 1 }), 2);
    }
    {
      const [vx0, vy0] = p.P(-0.3, D + 0.3, ze - 1);
      const [vx1, vy1] = p.P(bm, D + 0.3, zr);
      ln(p.c, vx0, vy0 + 1, vx1, vy1 + 1, SLATE[0], 2);
      ln(p.c, vx0, vy0 - 1, vx1, vy1 - 1, SLATE[6]);
      const [ex0, ey0] = p.P(-0.3, -0.3, ze - 1);
      const [ex1, ey1] = p.P(-0.3, D + 0.3, ze - 1);
      ln(p.c, ex0, ey0, ex1, ey1, SLATE[0], 2);
      const Q0 = p.P(bm, -0.3, zr);
      const Q1 = p.P(bm, D + 0.3, zr);
      ln(p.c, Q0[0], Q0[1] - 1, Q1[0], Q1[1] - 1, SLATE[6], 3);
      ln(p.c, Q0[0], Q0[1] - 3, Q1[0], Q1[1] - 3, '#9aa0ae');
    }
    // rows of windows: every 1.45 tiles, three storeys
    const bay = 1.45;
    for (let s = 0; s < n; s++) {
      const z0 = s === 0 ? 10 : GH + (s - 1) * SH + 6;
      const z1 = s === 0 ? 32 : z0 + 20;
      for (let b = 0.55; b < D - 0.6; b += bay) {
        if (b > D - 6.6 && b < D - 3.4) continue; // the tower covers this stretch
        millWindow(p, S, b, b + 0.62, z0, z1, k.seed * 31 + s * 101 + Math.round(b * 7), { lit: 0.5 });
      }
    }
    // the gable end: a column of loading doors, the cathead and chain
    const gc = W / 2;
    for (let s = 0; s < n; s++) {
      const z0 = s === 0 ? 0 : GH + (s - 1) * SH + 2;
      const z1 = s === 0 ? 26 : z0 + 22;
      pq(p, F, gc - 0.62, gc + 0.62, z0, z1, '#2a2224');
      pt(p, F, gc - 0.56, gc + 0.56, z0 + 0.4, z1 - 0.6, (u: number, v: number) => at(OLDWOOD, (u % 9 < 1 ? 0.6 : 2.4) + (v % 30 < 1 ? -1 : 0) + (Math.abs(u - 40) < 1 ? -1 : 0)), 1);
      arch(p, F, gc - 0.62, gc + 0.62, z1, 0.6, 2.2);
      for (const side of [-1, 1]) if (s > 0) millWindow(p, F, gc + side * 2.6 - 0.32, gc + side * 2.6 + 0.32, z0 + 4, z0 + 20, k.seed + s * 9 + side, { lit: 0.5 });
    }
    for (const side of [-1, 1]) millWindow(p, F, gc + side * 2.6 - 0.32, gc + side * 2.6 + 0.32, 10, 30, k.seed + side * 5, { lit: 0.5 });
    // the cathead: a timber beam out of the gable, a pulley, a chain to a hook
    const [cx, cy] = F.F(gc, ze + 6);
    const [hx, hy] = p.P(gc, D + 0.9, ze + 6);
    layer(p.c, (l) => {
      ln(l, cx, cy, hx, hy, TIMBER[2], 5);
      ln(l, cx, cy - 2, hx, hy - 2, TIMBER[4], 1);
      ell(l, hx, hy + 3, 3, 3, IRON[3]);
      for (let j = 0; j < 46; j += 3) px(l, hx - 1 + (j % 6 ? 0 : 1), hy + 5 + j, IRON[4], 2, 2);
      ln(l, hx, hy + 52, hx + 3, hy + 56, IRON[4], 2);
    }, { outline: 0.6, rect: [Math.min(cx, hx) - 6, cy - 6, Math.max(cx, hx) + 8, hy + 60] });
    // the stair tower on the +a side, rising past the eaves: the clock, the name, a pyramid roof
    const tb0 = D - 6.4;
    const tb1 = D - 3.6;
    const tz = ze + 44;
    lbox(p, W, tb0, 1, tb1 - tb0, 0, tz, { front: brk, side: brk, top: () => () => '#3a3034', edge: BRICK[0] });
    const TS = side3(p, W + 1);
    const TF = front3(p, tb1);
    for (const pl of [TS, TF]) {
      const u0 = pl === TS ? tb0 : W;
      const u1 = pl === TS ? tb1 : W + 1;
      pq(p, pl, u0, u1, 0, 4.5, BLUEBRICK[pl.light ? 3 : 1]);
      pq(p, pl, u0, u1, tz - 2.6, tz, at(STONE, pl.light ? 4.4 : 2.6));
      pq(p, pl, u0, u1, tz - 3, tz - 2.6, mix(STONE[0], OUTL, 0.5));
    }
    // tall stair windows climbing the tower
    for (let s = 0; s < 3; s++) millWindow(p, TS, (tb0 + tb1) / 2 - 0.3, (tb0 + tb1) / 2 + 0.3, 8 + s * 30, 26 + s * 30, k.seed + 40 + s, { round: true, lit: 0.6 });
    // the belfry stage above the eaves: louvred openings on both faces
    for (const [pl, u0] of [[TS, tb0], [TF, W]] as const) {
      const um = u0 + (pl === TS ? (tb1 - tb0) / 2 : 0.5);
      pq(p, pl, um - 0.28, um + 0.28, ze + 6, ze + 22, '#1a1416');
      for (let z = ze + 7; z < ze + 21; z += 2) pq(p, pl, um - 0.26, um + 0.26, z, z + 0.8, at(OLDWOOD, pl.light ? 3 : 2));
      arch(p, pl, um - 0.28, um + 0.28, ze + 22, 0.5, 2);
    }
    // the clock face and the painted name
    const [kx, ky] = TS.F((tb0 + tb1) / 2, tz - 12);
    layer(p.c, (l) => {
      ell(l, kx, ky, 17, 19, at(STONE, 3));
      ell(l, kx, ky, 14, 16, '#f2eee0');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        px(l, kx + Math.cos(a) * 12, ky + Math.sin(a) * 13.5, '#2a2a2e', 2, 2);
      }
      ln(l, kx, ky, kx - 2, ky - 10, '#1e1e22', 2);
      ln(l, kx, ky, kx + 8, ky + 3, '#1e1e22', 2);
      px(l, kx - 1, ky - 1, '#c8382a', 2, 2);
    }, { outline: 0.6, rect: [kx - 20, ky - 22, kx + 20, ky + 22] });
    pq(p, TS, tb0 + 0.12, tb1 - 0.12, 4.8, 7.2, '#2a2224');
    planeText(p.c, TS, (tb0 + tb1) / 2, 6, 'ALBION MILL 1874', '#ece6d6', 1);
    // pyramid roof with a finial
    const apex: V3 = [W + 0.5, (tb0 + tb1) / 2, tz + 18];
    // a copper pyramid gone green, with standing seams, and a weather vane
    const CU: Ramp = ['#24423a', '#2e5248', '#3a6456', '#487866', '#5a8e7a', '#74a690', '#92bea6'];
    const seams = (light: number) => (u: number, v: number, x: number, y: number) => at(CU, (light ? 4 : 2.4) + (u % 12 < 1.4 ? -1.2 : 0) + (v < 3 ? -0.6 : 0) + (hash(x, y, 5) < 0.05 ? 1 : 0));
    poly3(p, [[W - 0.15, tb1 + 0.15, tz], [W + 1.15, tb1 + 0.15, tz], apex], seams(1), 1);
    poly3(p, [[W + 1.15, tb1 + 0.15, tz], [W + 1.15, tb0 - 0.15, tz], apex], seams(0), 0);
    const [ax, ay] = p.P(...apex);
    layer(p.c, (l) => {
      px(l, ax - 1, ay - 26, IRON[3], 2, 26);
      ell(l, ax, ay - 4, 3, 3, '#c8a040');
      px(l, ax - 8, ay - 18, IRON[4], 16, 1);
      px(l, ax - 1, ay - 24, IRON[4], 3, 1);
      fillPoly(l, [[ax + 2, ay - 22], [ax + 14, ay - 24], [ax + 12, ay - 20], [ax + 2, ay - 20]], '#2a2a30');
      fillPoly(l, [[ax - 2, ay - 22], [ax - 10, ay - 25], [ax - 10, ay - 19]], '#2a2a30');
    }, { outline: 0.5, rect: [ax - 14, ay - 30, ax + 18, ay + 2] });
    // downpipes, a ghost sign on the long side, a fire escape ladder
    for (const b of [0.2, D - 0.3]) downpipe(p, S, b, 0.5, ze - 2.4);
    pq(p, S, 2, 7.4, ze - 16, ze - 7, mix(BRICK[2], '#d8d0c0', 0.22));
    planeText(p.c, S, 4.7, ze - 11.5, 'COTTON SPINNERS', mix('#e8e0d0', BRICK[3], 0.35), 2);
  },
};

// ── the boiler house ────────────────────────────────────────
const fac_boiler: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const ze = 34;
    const zr = ze + 18;
    const F = front3(p, D);
    const S = side3(p, W);
    const brk = brick(BRICK, { soot: 0.25 });
    // the roof: ridge along a, the +b slope visible, a gable at +a
    const bm = D / 2;
    face3(p, [-0.2, D + 0.3, ze - 1], [W + 0.4, 0, 0], [0, bm - D - 0.3, zr - ze + 1], slate(SLATE, 0.03), 2, Math.ceil(W / 2));
    // the ridge ventilator: a louvred lantern with its own little roof
    // (it sits astride the ridge: its front face starts exactly on the slope)
    const lh = 0.32;
    const slopeAt = (b: number) => zr - ((b - bm) * (zr - ze + 1)) / (D + 0.3 - bm);
    const lz0 = slopeAt(bm + lh);
    const lz1 = zr + 6;
    const louvre: Mat = (light) => (_u, v) => (v % 4 < 1.6 ? '#1a1416' : at(OLDWOOD, (light ? 4 : 2.6) + (v % 4 > 3.2 ? 1 : 0)));
    lbox(p, 1.2, bm - lh, W - 2.4, lh * 2, lz0, lz1 - lz0, { front: louvre, side: louvre, top: flatMat(SLATE, 4, 3), edge: OLDWOOD[0] });
    for (let a = 1.2; a <= W - 1.2 + 0.01; a += (W - 2.4) / 4) lbox(p, a - 0.04, bm + lh - 0.02, 0.08, 0.04, lz0, lz1 - lz0, mono(flatMat(OLDWOOD, 3, 2), OLDWOOD[0]));
    const LEAD: Ramp = ['#3a4448', '#4a565a', '#5c686c', '#6e7a7c', '#84908e', '#9eaaa6'];
    poly3(p, [[1.05, bm + lh + 0.16, lz1 - 0.6], [W - 1.05, bm + lh + 0.16, lz1 - 0.6], [W - 1.05, bm, lz1 + 3], [1.05, bm, lz1 + 3]], (u: number, v: number) => at(LEAD, (u % 26 < 1.5 ? 2 : 3.6) + (v < 2 ? 1 : 0)), 2);
    const le0 = p.P(1.05, bm + lh + 0.16, lz1 - 0.6);
    const le1 = p.P(W - 1.05, bm + lh + 0.16, lz1 - 0.6);
    ln(p.c, le0[0], le0[1] + 1, le1[0], le1[1] + 1, '#1e1a1c', 2);
    poly3(p, [[W - 1.05, bm + lh + 0.16, lz1 - 0.6], [W - 1.05, bm - lh - 0.16, lz1 - 0.6], [W - 1.05, bm, lz1 + 3]], flatMat(OLDWOOD, 2, 1), 0);
    const lr0 = p.P(1.05, bm, lz1 + 3);
    const lr1 = p.P(W - 1.05, bm, lz1 + 3);
    ln(p.c, lr0[0], lr0[1] - 1, lr1[0], lr1[1] - 1, SLATE[6], 2);
    // walls and the +a gable
    frontLong(p, D, 0, W, 0, ze, brk, 1);
    sideLong(p, W, 0, D, 0, ze, brk, 0);
    poly3(p, [[W, D, ze - 1], [W, 0, ze - 1], [W, bm, zr]], brk, 0, [[W, D, 0], [W, 0, 0], [W, D, zr]]);
    for (const pl of [F, S]) {
      const len = pl === F ? W : D;
      pq(p, pl, 0, len, 0, 4, BLUEBRICK[pl.light ? 3 : 1]);
      pq(p, pl, 0, len, ze - 1.6, ze, at(STONE, pl.light ? 4 : 2.4));
    }
    // tall round-arched windows, the coal doors
    for (let a = 0.6; a < W - 1.6; a += 1.7) millWindow(p, F, a, a + 0.75, 8, 26, k.seed + Math.round(a * 5), { round: true, lit: 0.45 });
    const dc = W - 1.1;
    pq(p, F, dc - 0.75, dc + 0.75, 0, 24, '#2a2224');
    pt(p, F, dc - 0.68, dc + 0.68, 0, 23, (u: number, v: number) => at(['#2a3a30', '#34483a', '#3e5644', '#4a6450', '#56725c'], (u % 10 < 1.2 ? 0.6 : 2.6) + (Math.abs(u - 49) < 1.4 ? -2 : 0) + (v % 30 < 1 ? -1 : 0)), 1);
    arch(p, F, dc - 0.75, dc + 0.75, 24, 0.7, 2.4);
    for (let b = 0.7; b < D - 1; b += 1.6) millWindow(p, S, b, b + 0.7, 9, 26, k.seed * 3 + Math.round(b * 5), { round: true, lit: 0.45 });
    // soot over the door, a painted sign
    pq(p, F, 0.5, 3.6, 28, 31.6, '#2a2224');
    planeText(p.c, F, 2.05, 29.8, k.variant === 'stores' ? 'GENERAL STORES' : 'BOILER HOUSE', '#e8e0d0', 1);
  },
};

// ── the chimney ─────────────────────────────────────────────
const fac_chimney: PropArt = {
  draw(p, k) {
    const W = k.w;
    const [x, y] = p.P(W / 2, W / 2, 0);
    const K = p.k;
    const H = 172 * K;
    contactShadow(p.c, x + 40, y + 10, 70, 22, 0.3);
    // the pedestal: a square stone-capped base
    const pb = W / 2 - 0.62;
    lbox(p, pb, pb, 1.24, 1.24, 0, 3, { front: stoneMat, side: stoneMat, top: stoneMat, edge: STONE[0] });
    lbox(p, pb + 0.06, pb + 0.06, 1.12, 1.12, 3, 20, { front: brick(BRICK, { soot: 0.3 }), side: brick(BRICK, { soot: 0.3 }), top: () => () => BRICK[2], edge: BRICK[0] });
    lbox(p, pb - 0.02, pb - 0.02, 1.28, 1.28, 23, 2, { front: stoneMat, side: stoneMat, top: stoneMat, edge: STONE[0] });
    // the flue door on the pedestal
    const F = front3(p, pb + 1.18);
    pq(p, F, W / 2 - 0.2, W / 2 + 0.2, 3.5, 11, IRON[2]);
    pq(p, F, W / 2 - 0.16, W / 2 + 0.16, 4, 10.4, IRON[3]);
    const [bx, by] = F.F(W / 2 + 0.1, 7.2);
    px(p.c, bx - 1, by - 1, STEEL[4], 2, 3);
    // the shaft: tapering round, brick courses, iron bands, soot thickening toward the top
    const z0 = 25 * K;
    const r0 = 0.5 * 90.5;
    const r1 = 0.34 * 90.5;
    layer(p.c, (l) => {
      for (let j = 0; j < H - z0; j++) {
        const t = j / (H - z0);
        const r = r0 + (r1 - r0) * t;
        const yy = y - z0 - j;
        const band = j % 64 > 58;
        const course = Math.floor(j / 5);
        for (let i = -r; i <= r; i++) {
          const u = (i + r) / (2 * r);
          let tone = u < 0.18 ? 4.6 : u < 0.42 ? 3.8 : u < 0.68 ? 3 : u < 0.88 ? 2.2 : 1.5;
          const off = course & 1 ? 3 : 0;
          if (j % 5 === 0 || (Math.floor(i + r + off) % 7 === 0 && !band)) tone -= 0.9;
          if (hash(Math.floor((i + r + off) / 7), course, 4) < 0.25) tone -= 0.5;
          if (t > 0.6 && bayer(x + i, yy) < (t - 0.6) * 1.8) tone -= 1.2;
          if (band) {
            px(l, x + i, yy, at(IRON, tone * 0.9));
            continue;
          }
          px(l, x + i, yy, at(BRICK, tone));
        }
      }
      // the corbelled crown: stepped courses, a stone cap, a sooty lip
      const ytop = y - H;
      for (let s = 0; s < 6; s++) {
        const r = r1 + 2 + s * 2.6;
        const yy = ytop - s * 5;
        for (let j = 0; j < 6; j++)
          for (let i = -r; i <= r; i++) {
            const u = (i + r) / (2 * r);
            const tone = (u < 0.2 ? 4.4 : u < 0.5 ? 3.6 : u < 0.8 ? 2.6 : 1.7) - (j === 0 ? 1 : 0) - (s > 2 && s < 5 ? 1 : 0);
            px(l, x + i, yy - j, at(s === 5 ? STONE : s === 1 ? IRON : BRICK, s === 1 ? tone * 0.9 : tone));
          }
      }
      ell(l, x, ytop - 30, r1 + 14, 5, '#1a1416');
      ell(l, x, ytop - 31, r1 + 10, 3.4, '#0e0a0c');
      // the lightning conductor: a copper strip up the shaft and a spike over the crown
      ln(l, x + r0 * 0.72, y - z0, x + r1 * 0.72, ytop, '#6a8a6a');
      ln(l, x + r1 * 0.72 + 4, ytop - 30, x + r1 * 0.72 + 4, ytop - 52, '#6a8a6a');
    }, { outline: 0.62, rect: [x - r0 - 20, y - H - 70, x + r0 + 20, y] });
    void SOOT;
  },
  anim(p, k) {
    // a slow thread of smoke from the crown, drifting to the right
    const [x, y] = p.P(k.w / 2, k.w / 2, 0);
    const u = p.k / 4;
    const top = y - (172 * 4 + 34) * u;
    for (let i = 0; i < 9; i++) {
      const t = (k.t * 0.07 + i / 9) % 1;
      p.c.globalAlpha = 0.5 * (1 - t);
      ell(p.c, x + (t * 120 + Math.sin(t * 5 + i) * 8) * u, top - t * 80 * u, (12 + t * 30) * u, (8 + t * 16) * u, t < 0.25 ? '#6a6466' : t < 0.6 ? '#8a8486' : '#a8a4a4');
    }
    p.c.globalAlpha = 1;
  },
};

// ── the water tower ─────────────────────────────────────────
const fac_watertower: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = W / 2;
    const zt = 74;
    const rt = 1.05;
    const leg = (a: number, b: number) => p.P(a, b, 0);
    const top = (a: number, b: number) => p.P(a, b, zt);
    const A = 0.25;
    const B = W - 0.25;
    const corners: [number, number][] = [[A, A], [B, A], [B, B], [A, B]];
    const tc: [number, number][] = [[c - 0.62, c - 0.62], [c + 0.62, c - 0.62], [c + 0.62, c + 0.62], [c - 0.62, c + 0.62]];
    const [gx, gy] = p.P(c, c, 0);
    contactShadow(p.c, gx + 60, gy + 14, 120, 34, 0.26);
    // concrete pads
    for (const [a, b] of corners) lbox(p, a - 0.18, b - 0.18, 0.36, 0.36, 0, 2, { front: flatMat(CONC, 3, 2), side: flatMat(CONC, 3, 2), top: flatMat(CONC, 4, 4), edge: CONC[0] });
    const steel = (i: number) => at(STEEL, i);
    // the back legs and their bracing, then the tank, then the front legs over it
    const braceSet = (i0: number, i1: number) => {
      const [a0, b0] = corners[i0];
      const [a1, b1] = corners[i1];
      const [ta0, tb0] = tc[i0];
      const [ta1, tb1] = tc[i1];
      for (let s = 0; s < 3; s++) {
        const f0 = s / 3;
        const f1 = (s + 1) / 3;
        const L0 = [a0 + (ta0 - a0) * f0, b0 + (tb0 - b0) * f0, zt * f0] as const;
        const R0 = [a1 + (ta1 - a1) * f0, b1 + (tb1 - b1) * f0, zt * f0] as const;
        const L1 = [a0 + (ta0 - a0) * f1, b0 + (tb0 - b0) * f1, zt * f1] as const;
        const R1 = [a1 + (ta1 - a1) * f1, b1 + (tb1 - b1) * f1, zt * f1] as const;
        const p0 = p.P(...L0);
        const p1 = p.P(...R1);
        const p2 = p.P(...R0);
        const p3 = p.P(...L1);
        ln(p.c, p0[0], p0[1], p1[0], p1[1], steel(2), 2);
        ln(p.c, p2[0], p2[1], p3[0], p3[1], steel(2), 2);
        ln(p.c, p3[0], p3[1], p.P(...R1)[0], p.P(...R1)[1], steel(3), 3);
      }
    };
    const legLine = (i: number, front: boolean) => {
      const [a, b] = corners[i];
      const g = leg(a, b);
      const t = top(...tc[i]);
      layer(p.c, (l) => {
        ln(l, g[0], g[1], t[0], t[1], steel(front ? 3 : 2), 8);
        ln(l, g[0] - 1, g[1], t[0] - 1, t[1], steel(front ? 5 : 4), 2);
        ln(l, g[0] + 6, g[1], t[0] + 6, t[1], steel(1), 1);
        for (let s = 1; s < 8; s++) {
          const f = s / 8;
          px(l, g[0] + (t[0] - g[0]) * f - 3, g[1] + (t[1] - g[1]) * f, steel(1), 7, 2);
        }
      }, { outline: 0.6, rect: [Math.min(g[0], t[0]) - 6, t[1] - 4, Math.max(g[0], t[0]) + 6, g[1] + 2] });
    };
    legLine(0, false);
    braceSet(0, 1);
    braceSet(3, 0);
    legLine(1, false);
    legLine(3, false);
    braceSet(1, 2);
    braceSet(2, 3);
    // the ladder up the front-right leg
    const lg = leg(B + 0.05, B - 0.3);
    const lt = top(c + 0.7, c + 0.4);
    for (const dx of [-3, 3]) ln(p.c, lg[0] + dx, lg[1], lt[0] + dx, lt[1], IRON[4]);
    for (let s = 0; s < 30; s++) {
      const f = s / 30;
      const xx = lg[0] + (lt[0] - lg[0]) * f;
      const yy = lg[1] + (lt[1] - lg[1]) * f;
      px(p.c, xx - 3, yy, IRON[3], 7, 1);
    }
    legLine(2, true);
    // the tank: a riveted cylinder with a conical roof, a catwalk round its foot
    const [tx, ty] = p.P(c, c, zt);
    const R = rt * 90.5;
    const ry = rt * 45;
    const Ht = 26 * 4;
    layer(p.c, (l) => {
      // catwalk floor and its railing
      ell(l, tx, ty + 2, R + 14, ry + 7, IRON[2]);
      ell(l, tx, ty, R + 14, ry + 7, IRON[4]);
      for (let j = 0; j < Ht; j++) {
        for (let i = -R; i <= R; i++) {
          const u = (i + R) / (2 * R);
          let tone = u < 0.16 ? 4.4 : u < 0.4 ? 3.6 : u < 0.65 ? 2.8 : u < 0.86 ? 2 : 1.4;
          const yb = Math.sqrt(Math.max(0, 1 - (i / R) ** 2)) * ry;
          const yy = ty + yb - j;
          // plate seams and rivet rows
          if (j % 26 === 0 || Math.floor(u * 24) !== Math.floor(((i + R + 1) / (2 * R)) * 24)) tone -= 1;
          else if (j % 26 === 2 && Math.round(i) % 4 === 0) tone += 1;
          // rust bleeding down from the seams
          if (hash(Math.floor(u * 24), Math.floor(j / 26), 7) < 0.3 && j % 26 > 3 && j % 26 < 14 && Math.round(i) % 9 === 0) tone -= 1.4;
          px(l, tx + i, yy, at(['#2c464e', '#38585f', '#46696f', '#557b80', '#6a9298', '#85aaae'], tone));
        }
      }
      // conical roof: flanks from the apex to the rim's ends, the front half of the rim below
      const roofH = 50;
      const RR = R + 3;
      const rimY = ty - Ht;
      const apY = rimY - roofH;
      const CONE = ['#2e2c30', '#3c393c', '#4c4848', '#5c5654', '#6e6662', '#827872'];
      for (let i = -RR; i <= RR; i++) {
        const f = i / RR;
        const top = apY + roofH * Math.abs(f) - (1 - Math.abs(f)) * 0;
        const bot = rimY + Math.sqrt(Math.max(0, 1 - f * f)) * (ry + 1.5);
        const u = (f + 1) / 2;
        const ang = Math.atan2(bot - apY, i);
        const seam = Math.abs(((ang * 18) / Math.PI) % 1) < 0.12;
        let t = u < 0.22 ? 4 : u < 0.45 ? 3.2 : u < 0.7 ? 2.4 : 1.6;
        if (seam) t -= 0.9;
        for (let yy = Math.floor(top); yy <= bot; yy++) {
          const dn = (yy - top) / Math.max(1, bot - top);
          px(l, tx + i, yy, at(CONE, t + (dn > 0.92 ? -1 : 0)));
        }
      }
      // the eaves lip round the front of the rim
      for (let i = -RR; i <= RR; i++) {
        const f = i / RR;
        px(l, tx + i, rimY + Math.sqrt(Math.max(0, 1 - f * f)) * (ry + 1.5), CONE[0], 1, 2);
      }
      px(l, tx - 2, apY - 12, IRON[3], 4, 13);
      ell(l, tx, apY - 13, 3, 2, IRON[4]);
      // the railing posts and top rail at the front of the catwalk
      for (let a = 0.15; a < Math.PI - 0.1; a += 0.22) {
        const xx = tx + Math.cos(a) * (R + 12);
        const yy = ty + Math.sin(a) * (ry + 6);
        px(l, xx, yy - 14, IRON[4], 1, 14);
      }
      for (let a = 0; a < Math.PI; a += 0.02) px(l, tx + Math.cos(a) * (R + 12), ty + Math.sin(a) * (ry + 6) - 14, IRON[5]);
      // the name painted round the tank
      void 0;
    }, { outline: 0.62, rect: [tx - R - 20, ty - Ht - 76, tx + R + 20, ty + ry + 12] });
    const TF = front3(p, c + rt * 0.7);
    planeText(p.c, TF, c - 0.15, zt + 14, 'ALBION', '#e8e2d0', 2);
  },
};

// ── a derelict shed across the canal ────────────────────────
const fac_derelict: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const ze = 30;
    const F = front3(p, D);
    const S = side3(p, W);
    const brk = brick(BRICK, { soot: 0.3, damp: 18 });
    const Rn = rng(k.seed * 7 + 3);
    // broken walls: the brick is ragged at the top
    const wallTop = (u: number) => ze - (hash(Math.floor(u * 3), 1, k.seed) < 0.3 ? 3 + hash(Math.floor(u * 3), 2, k.seed) * 6 : 0);
    // the broken top band: one textured strip, cut away above each third-tile's ragged top
    const band = (pl: Plane, len: number, mat: Mat, light: 0 | 1) => {
      const tex = mat(light, len * 71.55, ze * 4);
      const z0 = ze - 10;
      pt(p, pl, 0, len, z0, ze, (uu: number, vv: number, x: number, y: number) => (z0 + vv / 4 > wallTop(uu / 71.55) ? null : tex(uu, vv + z0 * 4, x, y)), light);
    };
    // the back walls' inner faces (the roof is gone, so we see into the shell)
    const BW = front3(p, 0.32);
    const LW = side3(p, 0.32);
    const inner = brick(BRICK, { soot: 0.5, damp: 24 });
    frontLong(p, 0.32, 0.32, W, 0, ze - 9.5, inner, 1);
    sideLong(p, 0.32, 0.32, D, 0, ze - 9.5, inner, 0);
    band(BW, W, inner, 1);
    band(LW, D, inner, 0);
    for (let a = 1.2; a < W - 0.8; a += 1.5) pq(p, BW, a, a + 0.6, 9, 21, '#1a1416');
    for (let b = 1.2; b < D - 0.8; b += 1.6) pq(p, LW, b, b + 0.6, 9, 21, '#141012');
    // what is left of the roof: purlins and a few sagging sheets over the back half
    for (let b = 0.4; b < D * 0.55; b += 0.9) {
      const r0 = p.P(0, b, ze - 1);
      const r1 = p.P(W, b, ze - 1);
      ln(p.c, r0[0], r0[1], r1[0], r1[1], TIMBER[1], 3);
    }
    for (let a = 0.2; a < W - 1; a += 1.1) {
      if (Rn() < 0.35) continue;
      poly3(p, [[a, D * 0.55, ze - 1.4], [a + 1, D * 0.55, ze - 1.4], [a + 1, 0.1, ze + 1], [a, 0.1, ze + 1]], corrugated(SHEET, 1.25), 2);
    }
    frontLong(p, D, 0, W, 0, ze - 9.5, brk, 1);
    sideLong(p, W, 0, D, 0, ze - 9.5, brk, 0);
    band(F, W, brk, 1);
    band(S, D, brk, 0);
    // empty windows, a boarded door with a tag sprayed over it
    for (let a = 0.6; a < W - 0.8; a += 1.5) {
      pq(p, F, a, a + 0.7, 9, 22, '#1a1416');
      arch(p, F, a, a + 0.7, 22, 0.6);
      if (Rn() < 0.5) for (let i = 0; i < 3; i++) pline(p, F, a + 0.08 + i * 0.25, 9, a + 0.12 + i * 0.25, 21, '#4a3a2e');
    }
    for (let b = 0.6; b < D - 0.8; b += 1.6) {
      pq(p, S, b, b + 0.7, 9, 22, '#141012');
      arch(p, S, b, b + 0.7, 22, 0.6);
    }
    const dc = W - 1.2;
    pt(p, F, dc - 0.6, dc + 0.6, 0, 20, (u: number, v: number) => at(OLDWOOD, (u % 11 < 1.2 ? 0.6 : 2.2) + (Math.abs(v - 30) < 2 || Math.abs(v - 60) < 2 ? 1 : 0)), 1);
    const [gx, gy] = F.F(dc - 0.2, 10);
    layer(p.c, (l) => {
      for (let i = 0; i < 26; i++) px(l, gx - 14 + i + Math.sin(i * 0.7) * 2, gy - 4 + Math.sin(i * 0.5) * 4, i % 9 < 5 ? '#3a8ad8' : '#e83a8a', 2, 2);
    }, { outline: false, rect: [gx - 18, gy - 12, gx + 16, gy + 10] });
    // buddleia from the wall tops, ivy up a corner
    for (let i = 0; i < 3; i++) {
      const a = 0.8 + i * (W - 1.6) / 2;
      const [x, y] = F.F(a, wallTop(a));
      layer(p.c, (l) => {
        const masses: Mass[] = [];
        for (let j = 0; j < 5; j++) masses.push({ x: x - 8 + j * 4 + (Rn() - 0.5) * 6, y: y - 6 - Rn() * 10, rx: 7, ry: 6, z: j });
        foliage(l, masses, WEED, k.seed + i, { cell: 2.6, dots: [BUDDLEIA[3], BUDDLEIA[4], BUDDLEIA[2]], dotChance: 0.6, dotSize: 4 });
      }, { outline: 0.6, rect: [x - 30, y - 34, x + 30, y + 4] });
    }
    const ivy: Mass[] = [];
    for (let z = 1; z < 22; z += 2.4) {
      const [x, y] = p.P(W, D, z);
      ivy.push({ x: x + (Rn() - 0.5) * 14, y, rx: 7, ry: 6, z });
    }
    layer(p.c, (l) => foliage(l, ivy, WEED, k.seed + 9, { cell: 2.8 }), { outline: 0.6, rect: massRect(ivy) });
  },
};

// ── a little corrugated workshop ────────────────────────────
const fac_unit: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const ze = 26;
    const F = front3(p, D);
    const S = side3(p, W);
    const colr = k.color ?? ['#4a6a8a', '#7a3a2e', '#3e5a46', '#8a7a4a'][k.seed % 4];
    const r: Ramp = [darken(colr, 0.55), darken(colr, 0.38), darken(colr, 0.2), colr, lighten(colr, 0.16), lighten(colr, 0.3)];
    const bm = W / 2;
    // the walls and the front gable
    pt(p, F, 0, W, 0, ze, corrugated(r, 0.3), 1);
    poly3(p, [[0, D, ze], [W, D, ze], [bm, D, ze + 7]], corrugated(r, 0.3), 1);
    pt(p, S, 0, D, 0, ze, corrugated(r, 0.3), 0);
    pq(p, F, 0, W, 0, 2.5, CONC[2]);
    // a shallow corrugated roof over them, ridge along b: both slopes overhanging the eaves and the
    // gable, the near (−a) slope catching the sky, the far (+a) one in shade; a ridge cap, barge boards
    const rise = 7;
    const ov = 0.18;
    const zo = ze - (rise * ov) / bm;
    const b0r = -0.12;
    const b1r = D + 0.16;
    poly3(p, [[-ov, b0r, zo], [-ov, b1r, zo], [bm, b1r, ze + rise], [bm, b0r, ze + rise]], corrugated(SHEET, 0.35, 6), 2, [[-ov, b0r, zo], [-ov, b1r, zo], [bm, b0r, ze + rise]]);
    poly3(p, [[W + ov, b0r, zo], [W + ov, b1r, zo], [bm, b1r, ze + rise], [bm, b0r, ze + rise]], corrugated(SHEET, 0.35, 6), 0, [[W + ov, b0r, zo], [W + ov, b1r, zo], [bm, b0r, ze + rise]]);
    // the ridge cap: a rolled sheet along the top, lit on its near side
    poly3(p, [[bm - 0.14, b0r - 0.02, ze + rise - 0.6], [bm - 0.14, b1r + 0.02, ze + rise - 0.6], [bm, b1r + 0.02, ze + rise + 0.5], [bm, b0r - 0.02, ze + rise + 0.5]], (_u: number, v: number) => at(SHEET, v < 1.5 ? 2 : 5), 2);
    poly3(p, [[bm, b0r - 0.02, ze + rise + 0.5], [bm, b1r + 0.02, ze + rise + 0.5], [bm + 0.14, b1r + 0.02, ze + rise - 0.6], [bm + 0.14, b0r - 0.02, ze + rise - 0.6]], () => at(SHEET, 2.4), 0);
    // barge boards on the gable's overhang, the gutter along the +a eave with its downpipe
    const [g0x, g0y] = p.P(-ov, b1r, zo);
    const [g1x, g1y] = p.P(bm, b1r, ze + rise + 0.5);
    const [g2x, g2y] = p.P(W + ov, b1r, zo);
    ln(p.c, g0x, g0y + 1, g1x, g1y + 1, r[0], 2);
    ln(p.c, g1x, g1y + 1, g2x, g2y + 1, r[0], 2);
    ln(p.c, g0x, g0y - 1, g1x, g1y - 1, r[4]);
    ln(p.c, g1x, g1y - 1, g2x, g2y - 1, r[3]);
    const [e0x, e0y] = p.P(W + ov, b0r, zo - 0.4);
    const [e1x, e1y] = p.P(W + ov, b1r, zo - 0.4);
    ln(p.c, e0x, e0y, e1x, e1y, '#2a2a30', 2);
    const [dx, dy] = p.P(W + 0.02, D - 0.25, zo - 0.6);
    px(p.c, dx - 1, dy, '#3a3a42', 3, ze * 4 - 4);
    // a roller door and a personnel door, the unit number
    pq(p, F, 0.4, W * 0.62, 0, 19, '#2a2628');
    pt(p, F, 0.45, W * 0.62 - 0.05, 0, 18.4, (_u: number, v: number) => at(SHEET, v % 5 < 1 ? 0.6 : v % 5 < 2 ? 3 : 2), 1);
    pq(p, F, W * 0.72, W * 0.72 + 0.55, 0, 20, IRON[2]);
    pq(p, F, W * 0.72 + 0.04, W * 0.72 + 0.51, 0.4, 19.6, r[2]);
    pq(p, F, W - 1, W - 0.25, ze - 5, ze - 1.4, '#f2eee0');
    planeText(p.c, F, W - 0.62, ze - 3.2, 'U' + (3 + (k.seed % 6)), '#2a2a2e', 1);
    void S;
  },
};

/** A gasholder's guide frame and bell (distant). */
const fac_gasholder: PropArt = {
  draw(p, k) {
    const c = k.w / 2;
    const [x, y] = p.P(c, c, 0);
    const R = (k.w / 2 - 0.3) * 90.5;
    const ry = R / 2;
    const H = 110 * 4;
    const bellH = H * 0.72;
    const BELL = ['#22362a', '#2e4434', '#3a5642', '#46684e', '#55785c', '#66896c', '#7f9a7e', '#9cb89a'];
    const FR = ['#1e2622', '#34423a', '#4e5e54', '#6e8072', '#9aac9c', '#c4d2c2'];
    const col = (a: number, r = R) => [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5] as const;
    // contact shadow on the ground, to the lower right
    p.c.globalAlpha = 0.45;
    ell(p.c, x + 30, y + 10, R * 1.02, ry * 1.0, '#120c16');
    p.c.globalAlpha = 1;
    // the back columns of the guide frame (they show above the bell)
    for (let i = 1; i < 8; i++) {
      const [cx, cy] = col(Math.PI + (i / 8) * Math.PI);
      px(p.c, cx - 2, cy - H, FR[1], 5, H);
      px(p.c, cx - 2, cy - H, FR[3], 1, H);
    }
    for (let z = 0; z < 4; z++) {
      const zz = H * (0.25 + z * 0.25);
      for (let a = Math.PI; a < Math.PI * 2; a += 0.01) {
        const [cx, cy] = col(a);
        px(p.c, cx, cy - zz, FR[2], 1, 3);
      }
    }
    // the bell: a green drum shaded across, riveted plate seams, a domed crown with ribs
    const r9 = R * 0.92;
    for (let i = -r9; i <= r9; i++) {
      const u = (i + r9) / (r9 * 2);
      const yb = Math.sqrt(Math.max(0, 1 - (i / r9) ** 2)) * ry * 0.92;
      const sh = u < 0.1 ? 6 : u < 0.25 ? 5 : u < 0.5 ? 4 : u < 0.72 ? 3 : u < 0.9 ? 2 : 1;
      px(p.c, x + i, y + yb - bellH, at(BELL, sh), 1, bellH);
      // vertical plate seams
      if (Math.round(i) % 22 === 0) px(p.c, x + i, y + yb - bellH, at(BELL, sh - 1.5), 1, bellH);
      if (Math.round(i) % 22 === 1) px(p.c, x + i, y + yb - bellH, at(BELL, sh + 0.8), 1, bellH);
      // horizontal plate courses: a dark seam with a lit lip under it
      for (let j = 16; j < bellH - 4; j += 16) {
        px(p.c, x + i, y + yb - j, at(BELL, sh - 1.6), 1, 1);
        px(p.c, x + i, y + yb - j + 1, at(BELL, sh + 0.7), 1, 1);
      }
      // grime and rust weeping toward the foot
      if (hash(Math.round(i), 3, 41) < 0.12) px(p.c, x + i, y + yb - 30 - hash(Math.round(i), 4, 41) * 60, '#5a4a2e', 1, 20 + hash(Math.round(i), 5, 41) * 30);
    }
    ell(p.c, x, y - bellH, r9, ry * 0.92, BELL[5]);
    ell(p.c, x - 8, y - bellH - 4, R * 0.74, ry * 0.68, BELL[6]);
    ell(p.c, x - 18, y - bellH - 8, R * 0.42, ry * 0.36, BELL[7]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ln(p.c, x, y - bellH - 6, x + Math.cos(a) * r9, y - bellH + Math.sin(a) * ry * 0.92, i < 8 ? BELL[4] : BELL[4]);
    }
    ell(p.c, x, y - bellH - 6, 10, 5, BELL[3]);
    ell(p.c, x - 2, y - bellH - 8, 5, 2, BELL[7]);
    // the crown's rim: a lit kerb all round its front
    for (let a = 0; a < Math.PI; a += 0.008) {
      const [cx, cy] = col(a, r9);
      px(p.c, cx, cy - bellH, BELL[7], 1, 2);
      px(p.c, cx, cy - bellH + 2, BELL[1], 1, 2);
    }
    // the base: a dark plinth ring, doors, a valve pit
    for (let a = 0; a < Math.PI; a += 0.008) {
      const [cx, cy] = col(a, r9);
      px(p.c, cx, cy - 10, '#2a2a2e', 1, 10);
      px(p.c, cx, cy - 11, '#6a6a70', 1, 1);
    }
    for (const a of [0.9, 1.35, 2.2]) {
      const [cx, cy] = col(a, r9);
      px(p.c, cx - 9, cy - 40, '#d8a830', 18, 34);
      px(p.c, cx - 7, cy - 38, '#1e1a1a', 14, 30);
      px(p.c, cx - 7, cy - 38, '#3a2a22', 6, 30);
    }
    // a ladder up the bell's face, a yellow cage round it
    const lx = x - R * 0.35;
    const ly = y + Math.sqrt(1 - 0.35 ** 2) * ry * 0.92;
    for (const d of [-6, 6]) px(p.c, lx + d, ly - bellH, '#e0b030', 2, bellH);
    for (let j = 4; j < bellH; j += 6) px(p.c, lx - 6, ly - j, '#f0c848', 14, 1);
    for (let j = 40; j < bellH; j += 24) px(p.c, lx - 9, ly - j, '#b88a20', 20, 2);
    // the front columns and the lattice girders
    for (let z = 0; z < 4; z++) {
      const zz = H * (0.25 + z * 0.25);
      for (let a = 0; a < Math.PI; a += 0.006) {
        const [cx, cy] = col(a);
        px(p.c, cx, cy - zz - 2, FR[4], 1, 1);
        px(p.c, cx, cy - zz - 1, FR[3], 1, 2);
        px(p.c, cx, cy - zz + 1, FR[0], 1, 1);
        px(p.c, cx, cy - zz + 12, FR[2], 1, 2);
      }
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI;
        const a1 = ((i + 1) / 24) * Math.PI;
        const [ax, ay] = col(a0);
        const [bx, by] = col(a1);
        ln(p.c, ax, ay - zz, bx, by - zz + 12, FR[2]);
        ln(p.c, ax, ay - zz + 12, bx, by - zz, FR[1]);
      }
    }
    for (let i = 0; i <= 8; i++) {
      const [cx, cy] = col((i / 8) * Math.PI);
      px(p.c, cx - 3, cy - H, FR[1], 7, H);
      px(p.c, cx - 3, cy - H, FR[4], 2, H);
      px(p.c, cx + 3, cy - H, FR[0], 1, H);
      px(p.c, cx - 5, cy - H - 3, FR[3], 11, 4);
      px(p.c, cx - 6, cy - 6, '#3a3a40', 13, 6);
    }
    void k;
  },
};

// ── night lights: the lit windows of the works (same seeds as their drawing) ──
const WIN_LIGHT = '#ffd49a';
/** Up to n items spread evenly through a list. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.floor(((i + 0.5) * list.length) / n)]);
}
fac_mill.lights = (k) => {
  const W = k.w - 1;
  const D = k.d;
  const out: PropLight[] = [];
  for (let s = 0; s < 3; s++) {
    const z0 = s === 0 ? 10 : 38 + (s - 1) * 32 + 6;
    const z1 = s === 0 ? 32 : z0 + 20;
    for (let b = 0.55; b < D - 0.6; b += 1.45) {
      if (b > D - 6.6 && b < D - 3.4) continue;
      if (windowLit(k.seed * 31 + s * 101 + Math.round(b * 7), 0.5)) out.push({ a: W, b: b + 0.31, z: (z0 + z1) / 2, r: 1.3, color: WIN_LIGHT, kind: 'window' });
    }
  }
  return spread(out, 14);
};
fac_shed.lights = (k) => {
  const W = k.w;
  const D = k.d;
  const nT = Math.max(2, Math.round(W / 3));
  const tw = W / nT;
  const out: PropLight[] = [];
  for (let i = 0; i < nT; i++)
    for (const f of [0.22, 0.6]) if (windowLit(k.seed * 13 + i * 3 + Math.round(f * 10), 0.4)) out.push({ a: i * tw + tw * f + 0.37, b: D, z: 21, r: 1.4, color: WIN_LIGHT, kind: 'window' });
  for (let b = 1.1; b < D - 1; b += 3.6) if (windowLit(k.seed + Math.round(b * 7), 0.5)) out.push({ a: W, b: b + 0.35, z: 25, r: 1.3, color: WIN_LIGHT, kind: 'window' });
  return spread(out, 12);
};
fac_boiler.lights = (k) => {
  const out: PropLight[] = [];
  for (let a = 0.6; a < k.w - 1.6; a += 1.7) if (windowLit(k.seed + Math.round(a * 5), 0.45)) out.push({ a: a + 0.37, b: k.d, z: 17, r: 1.4, color: WIN_LIGHT, kind: 'window' });
  return out;
};

export const FACTORY_BUILDINGS: Record<string, PropArt> = {
  fac_shed,
  fac_mill,
  fac_boiler,
  fac_chimney,
  fac_watertower,
  fac_derelict,
  fac_unit,
  fac_gasholder,
};

export { pline, millWindow, arch, downpipe, stoneMat, flatMat };

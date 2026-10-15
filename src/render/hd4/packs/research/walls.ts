// Research Hub — the back walls of the library: a granite plinth, honeyed
// stone-pine panelling with a chip-carved frieze, and above it a midnight-blue
// plaster sky with gilt stars and constellations under a larch cornice. The
// cut top shows the lodge's thick rubble walls.
// Wall props: deep-set windows onto the peaks with folded heart-cut shutters,
// the briefing screen in a walnut frame, a survey-map board, a larch door in
// a granite surround, star and moon charts, a Vienna regulator, a banjo
// barometer, specimen shelves, brass lamps and a rail of mountaineering gear.
import { darken, lighten } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';
import { pineBoards, rubble } from './kit';
import { BRASS, GILT, GNEISS, IRONK, LARCHF, MORTAR, NIGHT, PAINTBLUE, PARCH, TERRA, TIMBER, WALNUT, ZIRBE } from './palette';

// a tall library hall: 4.2 m next to a 1.75 m person (17.5 z)
const H = 42;
const T = 0.3;

type V3 = [number, number, number];
type Pl = Plane & { at: (u: number, z: number) => V3 };
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Pl => (side === 'ne' ? front3(p, 0) : side3(p, 0));
/** A point d tiles deep into the wall (d < 0 stands out into the room). */
const W3 = (side: 'ne' | 'nw', u: number, d: number, z: number): V3 => (side === 'ne' ? [u, -d, z] : [-d, u, z]);

const GRANITE: Ramp = ['#4a4a4e', '#5e5e62', '#747476', '#8a8a8a', '#a09e9a', '#b6b2ac', '#cac6be'];
const LIME: Ramp = ['#9a9282', '#b4ac9a', '#cbc3b0', '#ddd6c4', '#ebe5d6', '#f6f2e6'];

/** Cut granite courses (the plinth and the door surround). */
const granite: Mat = (light) => (u, v, x, y) => {
  const row = Math.floor(v / 9);
  const fv = v - row * 9;
  const off = row & 1 ? 17 : 0;
  const bw = 34;
  const fu = (u + off) % bw;
  if (fv < 1 || fu < 1) return GRANITE[1];
  let i = (light ? 3.4 : 2.2) + (hash(Math.floor((u + off) / bw), row, 5) - 0.5) * 1.2;
  if (fv > 7.4) i += 0.8;
  const g = hash(x, y, 6);
  if (g < 0.12) i -= 1.2;
  else if (g > 0.93) i += 1;
  return at(GRANITE, i);
};

/** The chip-carved frieze: a dark band with a row of six-petal rosettes. */
const frieze: Mat = (light, _w, h) => (u, v) => {
  const b = light ? 3 : 2;
  if (v < 0.9 || v > h - 0.9) return at(ZIRBE, b - 1.6);
  const cu = (u % 22) - 11;
  const cv = v - h / 2;
  const r = Math.hypot(cu, cv * 1.3);
  if (r < 5.5) {
    const ang = Math.atan2(cv, cu);
    const petal = Math.cos(ang * 6) > 0.2;
    if (r < 1.3) return at(ZIRBE, b + 2);
    return petal ? at(ZIRBE, b + (cv < 0 ? 1.6 : 0.6)) : at(ZIRBE, b - 1.4);
  }
  if (Math.abs(cu) > 9.5 && Math.abs(cv) < 1.2) return at(ZIRBE, b + 1);
  return at(WALNUT, b + 0.6);
};

/** The midnight star frieze: dithered night-blue plaster, gilt stars. */
const starfield =
  (seed: number): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = light ? 2.6 : 1.8;
    const n = noise2(u * 0.03, v * 0.06, 300 + seed);
    if (n > 0.66 && bayer(x, y) > 0.5) i += 0.7;
    if (n < 0.3 && bayer(x, y) > 0.55) i -= 0.7;
    if (v > h - 3) i -= 0.6;
    // stencilled gilt stars: little four-point crosses on a loose grid
    const cx = Math.floor(u / 15);
    const cy = Math.floor(v / 11);
    if (hash(cx, cy, 301 + seed) < 0.55) {
      const sx = cx * 15 + 3 + Math.floor(hash(cx, cy, 302 + seed) * 9);
      const sy = cy * 11 + 2 + Math.floor(hash(cx, cy, 303 + seed) * 7);
      const dx = Math.abs(Math.floor(u) - sx);
      const dy = Math.abs(Math.floor(v) - sy);
      const big = hash(cx, cy, 304 + seed) < 0.25;
      if (dx + dy === 0) return GILT[4];
      if (big && ((dx === 1 && dy === 0) || (dy === 1 && dx === 0))) return GILT[3];
      if (big && ((dx === 2 && dy === 0) || (dy === 2 && dx === 0))) return GILT[1];
    }
    return at(NIGHT, i);
  };

/** Larch with grain (cornice, trims, frames). */
const larch: Mat = (light) => (u, v, x, y) => {
  let i = light ? 3.4 : 2.2;
  if (noise2(u * 0.05 + v * 0.7, v * 0.1, 21) > 0.64) i -= 0.9;
  if (hash(x, y, 22) < 0.04) i -= 1;
  return at(LARCHF, i);
};

/** The bare wall: plinth, panelling, frieze, star sky, cornice; the cut top and the open end. */
function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  pt(p, pl, 0, len, 0, 2.4, granite, light);
  pt(p, pl, 0, len, 2.4, 25, pineBoards(ZIRBE, 12), light);
  // a shadow line where the panelling meets the plinth, a skirting bead
  pq(p, pl, 0, len, 2.4, 2.8, darken(ZIRBE[0], 0.2));
  pt(p, pl, 0, len, 25, 27.6, frieze, light);
  pq(p, pl, 0, len, 27.6, 28.3, at(LARCHF, light ? 6 : 4));
  pq(p, pl, 0, len, 28.3, 28.6, darken(LARCHF[0], 0.3));
  pt(p, pl, 0, len, 28.6, 39.2, starfield(side === 'ne' ? 0 : 7), light);
  // constellations in gilt over the star sky
  const stars = side === 'ne'
    ? // Orion and its belt near the middle of the long wall, the Pleiades further on
      [[[2.2, 37], [2.6, 34.5], [3.0, 32.5], [3.3, 32.6], [3.6, 32.7], [3.9, 35], [4.2, 37.6]], [[3.0, 32.5], [2.7, 30], [3.6, 32.7], [3.95, 30.2]], [[11.2, 35], [11.6, 36.2], [12.1, 35.6], [12.5, 37], [12.9, 35.4], [13.3, 36.4]]]
    : // Cassiopeia's W, and the Plough
      [[[1.5, 34], [2.0, 36.8], [2.6, 34.6], [3.2, 37.2], [3.7, 34.4]], [[8.0, 35.5], [8.6, 36.4], [9.2, 36.1], [9.7, 35.2], [10.2, 33.8], [11.0, 34.4], [11.2, 35.8], [10.3, 35.6]]];
  for (const line of stars) {
    for (let i = 0; i < line.length - 1; i++) {
      if (line[i][0] > len - 0.2 || line[i + 1][0] > len - 0.2) continue;
      const [x0, y0] = pl.F(line[i][0], line[i][1]);
      const [x1, y1] = pl.F(line[i + 1][0], line[i + 1][1]);
      ln(p.c, x0, y0, x1, y1, '#8a7a4a');
    }
    for (const [u, z] of line) {
      if (u > len - 0.2) continue;
      const [x, y] = pl.F(u, z);
      px(p.c, x - 1, y, GILT[4], 3, 1);
      px(p.c, x, y - 1, GILT[4], 1, 3);
      px(p.c, x, y, '#fff6d0');
    }
  }
  // the cornice: a dentil row and a larch beam with a lit lower lip
  pq(p, pl, 0, len, 39.2, 39.5, darken(NIGHT[0], 0.2));
  for (let u = 0.04; u < len; u += 0.16) pq(p, pl, u, Math.min(len, u + 0.09), 39.5, 40.4, at(LARCHF, light ? 4 : 3));
  pq(p, pl, 0, len, 39.5, 39.7, darken(LARCHF[1], 0.2));
  pt(p, pl, 0, len, 40.4, H, larch, light);
  pq(p, pl, 0, len, 40.4, 40.7, at(LARCHF, light ? 6 : 5));
  // the cut top: the pine lining, then the rubble core of the lodge's wall
  const rub = rubble(GNEISS, MORTAR, 13)(2, 0, 0);
  const top: FaceTex = (u, v, x, y) => {
    if (v < 2.6) return at(ZIRBE, 4 - (v < 1 ? 1 : 0));
    return rub(u, v, x, y);
  };
  const cap: Mat = (lt) => {
    const rb = rubble(GNEISS, MORTAR, 13)(lt ? 1 : 0, 0, 0);
    return (u, v, x, y) => {
      if (u < 2.6) return at(ZIRBE, lt ? 4 : 2);
      if (v < 9) return at(GRANITE, lt ? 4 : 2);
      return rb(u, v, x, y);
    };
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], top, 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], cap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], top, 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], cap, 1);
  }
}

// ── the view from the windows ───────────────────────────────
/** Peaks, a blue sky, larches; north windows also catch a white dome. */
const view =
  (seed: number, north: boolean): FaceTex =>
  (u, v, x, y) => {
    const sky = ['#4e86c8', '#6298d2', '#78aada', '#92bce2', '#b0d0ea', '#cce2f0'];
    let col = sky[Math.max(0, Math.min(5, Math.floor(5.4 - v / 14 + (bayer(x, y) - 0.5) * 0.9)))];
    // a little cloud
    const cd = Math.hypot((u - 20 - seed * 7) / 2.2, v - 58);
    if (cd < 5 + noise2(u * 0.4, v * 0.4, seed) * 3) col = cd < 3 ? '#ffffff' : '#e6f0f6';
    // the range: a sharp silhouette, snow above a ragged line, shaded facets
    const uu = u + seed * 31;
    const ridge = 26 + Math.abs(((uu * 0.06) % 2) - 1) * 18 + Math.sin(uu * 0.21) * 4 + Math.sin(uu * 0.05 + seed) * 6;
    if (v < ridge) {
      const slope = Math.cos(uu * 0.21) * 0.84 + (((uu * 0.06) % 2) < 1 ? 1 : -1) * 1.08;
      const lit = slope > 0;
      const snow = v > ridge - 9 - Math.sin(uu * 0.7) * 3 || (v > 20 && hash(Math.floor(uu / 3), Math.floor(v / 5), seed) < 0.3);
      col = snow ? (lit ? '#f4f8fc' : '#b8c8dc') : lit ? '#8a8ea0' : '#5e6478';
      if (v < 18) col = v < 10 ? '#3e6a3a' : '#5e7e5a';
    }
    // a north window sees the big dome over the meadow
    if (north) {
      const dx = (u - 34 + seed * 4) / 1.15;
      const dy = v - 12;
      if (dy > 0 && dx * dx + dy * dy < 220) col = dx < -3 ? '#ffffff' : dx < 6 ? '#e2e8ee' : '#b8c2cc';
      if (dy <= 0 && dy > -9 && Math.abs(dx) < 15) col = Math.abs(dx) < 13 ? '#c8c0b0' : '#8a8478';
      if (dy > 0 && Math.abs(dx - 1) < 1.5 && dx * dx + dy * dy < 220) col = '#2a2e38';
    }
    // a larch in front, its tiers lit from the left
    const lx = u - 6 - (seed % 3) * 22;
    if (lx > -12 && lx < 12) {
      const tier = Math.floor(v / 6);
      const w = Math.max(0, 11 - v * 0.17) * (0.75 + 0.25 * Math.sin(tier * 1.7));
      if (Math.abs(lx) < w && v < 62) col = lx < -w * 0.3 ? '#8ab450' : (v % 6) < 2 ? '#3e6a2e' : '#5e8e3c';
      if (Math.abs(lx) < 1 && v < 60) col = '#5a3a26';
    }
    return col;
  };

/** A deep-set window: splayed plaster reveal, larch cross-frame, folded heart shutters, a sill. */
function deepWindow(p: PropPainter, side: 'ne' | 'nw', c: number, hw: number, z0: number, z1: number, seed: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  const D = 0.22;
  const sp = 0.07;
  const uo0 = c - hw - sp;
  const uo1 = c + hw + sp;
  const ui0 = c - hw;
  const ui1 = c + hw;
  const P3 = (u: number, d: number, z: number) => W3(side, u, d, z);
  // the opening on the wall face: plaster, then the reveal in 3D
  poly3(p, [P3(uo0, 0, z0), P3(uo1, 0, z0), P3(uo1, 0, z1 + 0.8), P3(uo0, 0, z1 + 0.8)], (_u: number, _v: number, x: number, y: number) => at(LIME, (light ? 3 : 2) - (hash(x, y, 3) < 0.05 ? 1 : 0)), light);
  // the frame and glass at the back of the reveal
  const glassL: 0 | 1 = light ? 1 : 0;
  poly3(p, [P3(ui0, D, z0), P3(ui1, D, z0), P3(ui1, D, z1), P3(ui0, D, z1)], view(seed, side === 'ne'), glassL, [P3(ui0, D, z0), P3(ui1, D, z0), P3(ui0, D, z1)]);
  // the soffit shadow under the lintel and on the glass top
  poly3(p, [P3(ui0, D, z1 - 1.2), P3(ui1, D, z1 - 1.2), P3(ui1, D, z1), P3(ui0, D, z1)], () => 'rgba(30,24,40,0.35)', glassL);
  // the visible jamb (always the one at the smaller u), with a folded painted shutter
  const jl: 0 | 1 = side === 'ne' ? 0 : 1;
  poly3(p, [P3(uo0, 0, z0), P3(ui0, D, z0), P3(ui0, D, z1), P3(uo0, 0, z1 + 0.8)], (_u: number, _v: number, x: number, y: number) => at(LIME, (jl ? 2.6 : 1.2) - (hash(x, y, 4) < 0.06 ? 1 : 0)), jl, [P3(uo0, 0, z0), P3(ui0, D, z0), P3(uo0, 0, z1)]);
  const sh0 = z0 + 1.2;
  const sh1 = z1 - 1;
  poly3(p, [P3(uo0 + 0.01, 0.02, sh0), P3(ui0 - 0.005, D - 0.03, sh0), P3(ui0 - 0.005, D - 0.03, sh1), P3(uo0 + 0.01, 0.02, sh1)], (u: number, v: number, _x: number, _y: number) => {
    // painted panel: a frame, a field, a heart cut through it
    const fw = 1.6;
    if (u < fw || v < fw) return PAINTBLUE[jl ? 2 : 1];
    const hv = v - (sh1 - sh0) * 2.6;
    const hu = u - 6;
    const heart = Math.pow(hu * hu + hv * hv - 9, 3) - hu * hu * hv * hv * hv < 0 ? 1 : 0;
    if (heart && Math.abs(hu) < 5 && Math.abs(hv) < 5) return '#1a1418';
    return PAINTBLUE[jl ? 4 : 3];
  }, jl, [P3(uo0 + 0.01, 0.02, sh0), P3(ui0 - 0.005, D - 0.03, sh0), P3(uo0 + 0.01, 0.02, sh1)]);
  // larch frame: outer frame, mullion, transom, glazing bars in the upper lights
  const F = { ...pl, F: (u: number, z: number) => p.P(...P3(u, D, z)) };
  const bar = (ua: number, za: number, ub: number, zb: number, wpx: number, col: string) => {
    const [x0, y0] = F.F(ua, za);
    const [x1, y1] = F.F(ub, zb);
    ln(p.c, x0, y0, x1, y1, col, wpx);
  };
  const fc = at(LARCHF, light ? 4 : 3);
  const fd = at(LARCHF, light ? 2 : 1);
  const zt = z0 + (z1 - z0) * 0.7;
  bar(ui0, z0, ui1, z0, 3, fd);
  bar(ui0, z1, ui1, z1, 3, fd);
  bar(ui0, z0, ui0, z1, 3, fc);
  bar(ui1, z0, ui1, z1, 3, fd);
  bar(c, z0, c, z1, 3, fc);
  bar(ui0, zt, ui1, zt, 3, fc);
  for (const f of [1 / 3, 2 / 3]) {
    bar(ui0 + (c - ui0) * f, zt, ui0 + (c - ui0) * f, z1, 1, fc);
    bar(c + (ui1 - c) * f, zt, c + (ui1 - c) * f, z1, 1, fc);
  }
  // two brass turn-buttons, two reflections across the glass
  for (const u of [c - 0.04, c + 0.04]) {
    const [bx, by] = F.F(u, z0 + (zt - z0) * 0.5);
    px(p.c, bx - 1, by - 1, BRASS[4], 2, 3);
  }
  p.c.globalAlpha = 0.3;
  poly3(p, [P3(ui0, D, z0), P3(ui1, D, z0), P3(ui1, D, z1), P3(ui0, D, z1)], (u: number, v: number) => ((u * 0.8 + v) % 44 < 5 ? '#ffffff' : null), glassL);
  p.c.globalAlpha = 1;
  // the deep sill: a pine board standing a little proud of the wall
  poly3(p, [P3(uo0 - 0.06, -0.08, z0), P3(uo1 + 0.06, -0.08, z0), P3(uo1, D, z0), P3(uo0, D, z0)], (u: number, v: number, x: number, y: number) => at(ZIRBE, 4.6 - (hash(x, y, 7) < 0.06 ? 1 : 0) + (v < 1.2 ? 1 : 0) - (u % 40 < 0.8 ? 1 : 0)), 2);
  poly3(p, [P3(uo0 - 0.06, -0.08, z0), P3(uo1 + 0.06, -0.08, z0), P3(uo1 + 0.06, -0.08, z0 - 0.9), P3(uo0 - 0.06, -0.08, z0 - 0.9)], () => at(ZIRBE, light ? 3 : 1), light);
  // a pine architrave round the opening on the panelling
  for (const [ua, ub] of [[uo0 - 0.07, uo0], [uo1, uo1 + 0.07]] as const) pq(p, pl, ua, ub, z0 - 0.9, z1 + 1.5, at(ZIRBE, light ? 4 : 2));
  pq(p, pl, uo0 - 0.07, uo1 + 0.07, z1 + 0.8, z1 + 1.5, at(ZIRBE, light ? 5 : 3));
  pq(p, pl, uo0 - 0.07, uo1 + 0.07, z1 + 1.5, z1 + 1.8, darken(ZIRBE[0], 0.2));
  // on the sill: a potted edelweiss, books, a brass hand telescope or a barometer
  const kind = seed % 4;
  const [sx, sy] = p.P(...P3(c - hw * 0.4, 0.05, z0));
  layer(p.c, (l) => {
    if (kind === 0) {
      fillPoly(l, [[sx - 6, sy - 9], [sx + 6, sy - 9], [sx + 5, sy], [sx - 5, sy]], TERRA[3]);
      px(l, sx - 6, sy - 10, TERRA[5], 12, 2);
      foliage(l, [{ x: sx, y: sy - 15, rx: 8, ry: 6, z: 1 }], ['#3a4a3a', '#4e604c', '#64786a', '#7c9284', '#98aca0', '#b8c8bc'], seed + 3, { cell: 2.2, dots: ['#f2eee2', '#f6f2e8'], dotChance: 0.9, dotSize: 4 });
    } else if (kind === 1) {
      for (let i = 0; i < 3; i++) {
        const col = ['#6a1e1c', '#2a3e5a', '#2e4a30'][i];
        fillPoly(l, [[sx - 10, sy - i * 3], [sx, sy - 5 - i * 3], [sx + 10, sy - i * 3], [sx, sy + 5 - i * 3]], col);
        fillPoly(l, [[sx - 10, sy - i * 3], [sx, sy + 5 - i * 3], [sx, sy + 7 - i * 3], [sx - 10, sy + 2 - i * 3]], '#ece2c8');
      }
    } else if (kind === 2) {
      ln(l, sx - 8, sy - 2, sx + 14, sy - 10, BRASS[2], 4);
      ln(l, sx - 8, sy - 3, sx + 14, sy - 11, BRASS[5], 1);
      px(l, sx + 4, sy - 9, BRASS[1], 2, 4);
      ell(l, sx + 15, sy - 11, 2, 2, '#9ab8c4');
    } else {
      fillPoly(l, [[sx - 6, sy - 10], [sx + 6, sy - 10], [sx + 5, sy], [sx - 5, sy]], TERRA[2]);
      px(l, sx - 6, sy - 11, TERRA[4], 12, 2);
      const masses: Mass[] = [];
      for (let i = 0; i < 4; i++) masses.push({ x: sx - 6 + i * 4, y: sy - 15 - (i % 2) * 3, rx: 5, ry: 4, z: i });
      foliage(l, masses, ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042'], seed, { cell: 2.4, dots: ['#d8302a', '#e84a3a'], dotChance: 0.85, dotSize: 3 });
    }
  }, { outline: 0.55 });
}

const window: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    const n = Math.max(1, Math.round(w / 1.5));
    const span = w / n;
    for (let i = 0; i < n; i++) deepWindow(p, side, a0 + span * (i + 0.5), Math.min(0.42, span * 0.3), 9.6, 27, k.seed * 5 + i);
  },
};

// ── the briefing screen in a carved walnut frame ────────────
const SCR = { z0: 13.6, z1: 29.4 };
const screen: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + k.wp.w - 0.22;
    const L = pl.light;
    // its shadow on the panelling, the frame, an inner gilt slip, the dark glass
    pq(p, pl, u0 + 0.06, u1 + 0.06, SCR.z0 - 1.6, SCR.z1 + 0.4, 'rgba(30,18,24,0.3)');
    pq(p, pl, u0 - 0.14, u1 + 0.14, SCR.z0 - 1.4, SCR.z1 + 1.4, WALNUT[1]);
    pt(p, pl, u0 - 0.12, u1 + 0.12, SCR.z0 - 1.2, SCR.z1 + 1.2, (u: number, v: number, x: number, y: number) => at(WALNUT, (L ? 4 : 3) + (noise2(u * 0.05, v * 0.4, 5) > 0.66 ? -1 : 0) + (hash(x, y, 6) < 0.04 ? -1 : 0)), L);
    // carved corner rosettes
    for (const [u, z] of [[u0 - 0.06, SCR.z0 - 0.6], [u1 + 0.06, SCR.z0 - 0.6], [u0 - 0.06, SCR.z1 + 0.6], [u1 + 0.06, SCR.z1 + 0.6]] as const) {
      const [x, y] = pl.F(u, z);
      ell(p.c, x, y, 3, 3, WALNUT[5]);
      px(p.c, x, y, WALNUT[2]);
    }
    pq(p, pl, u0 - 0.02, u1 + 0.02, SCR.z0 - 0.3, SCR.z1 + 0.3, GILT[2]);
    pq(p, pl, u0, u1, SCR.z0, SCR.z1, '#0a0e1a');
    // a brass picture light above and a small plaque below
    pq(p, pl, (u0 + u1) / 2 - 0.5, (u0 + u1) / 2 + 0.5, SCR.z1 + 2.2, SCR.z1 + 2.9, BRASS[3]);
    pq(p, pl, (u0 + u1) / 2 - 0.5, (u0 + u1) / 2 + 0.5, SCR.z1 + 2.2, SCR.z1 + 2.4, BRASS[1]);
    const [bx, by] = pl.F((u0 + u1) / 2, SCR.z1 + 1.4);
    px(p.c, bx - 1, by - 6, BRASS[2], 2, 6);
    pq(p, pl, (u0 + u1) / 2 - 0.2, (u0 + u1) / 2 + 0.2, SCR.z0 - 2.6, SCR.z0 - 1.8, BRASS[4]);
    pq(p, pl, (u0 + u1) / 2 - 0.16, (u0 + u1) / 2 + 0.16, SCR.z0 - 2.4, SCR.z0 - 2.0, BRASS[2]);
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.22;
    const u1 = k.wp.at + k.wp.w - 0.22;
    const t = k.t;
    const slide = Math.floor(t / 7) % 4;
    const w = u1 - u0;
    const z0 = SCR.z0;
    const z1 = SCR.z1;
    const kk = p.k / 4;
    const Q = (ua: number, ub: number, za: number, zb: number, col: string) => pq(p, pl, ua, ub, za, zb, col);
    Q(u0 + 0.03, u1 - 0.03, z0 + 0.4, z1 - 0.4, '#101830');
    // a title bar on every slide
    Q(u0 + 0.12, u0 + w * 0.55, z1 - 2.4, z1 - 1.2, '#e8dcb8');
    Q(u1 - 0.5, u1 - 0.14, z1 - 2.4, z1 - 1.2, '#c8a050');
    if (slide === 0) {
      // the observatory's sky tonight: a star field and a slowly drawn constellation
      for (let i = 0; i < 70; i++) {
        const u = u0 + 0.1 + hash(i, 1, 9) * (w - 0.2);
        const z = z0 + 0.8 + hash(i, 2, 9) * (z1 - z0 - 4);
        const [x, y] = pl.F(u, z);
        const tw = Math.sin(t * 3 + i) > 0.6;
        p.c.fillStyle = hash(i, 3, 9) < 0.15 ? '#fff0c0' : tw ? '#ffffff' : '#9ab0e0';
        p.c.fillRect(Math.round(x), Math.round(y), Math.max(1, kk), Math.max(1, kk));
      }
      const pts: [number, number][] = [[0.2, 0.3], [0.32, 0.55], [0.46, 0.5], [0.58, 0.62], [0.7, 0.45], [0.8, 0.7]];
      const upto = Math.min(pts.length - 1, Math.floor((t % 7) * 1.2));
      for (let i = 0; i < upto; i++) {
        const [xa, ya] = pl.F(u0 + pts[i][0] * w, z0 + pts[i][1] * (z1 - z0 - 3));
        const [xb, yb] = pl.F(u0 + pts[i + 1][0] * w, z0 + pts[i + 1][1] * (z1 - z0 - 3));
        p.c.fillStyle = '#5fe08a';
        const n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya)));
        for (let s = 0; s <= n; s += 2) p.c.fillRect(Math.round(xa + ((xb - xa) * s) / n), Math.round(ya + ((yb - ya) * s) / n), Math.max(1, kk), Math.max(1, kk));
      }
    } else if (slide === 1) {
      // the weather on the summit: a temperature curve and wind bars
      for (let i = 0; i < 12; i++) {
        const h = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(i * 0.9 + t * 0.3))) * (z1 - z0 - 6);
        Q(u0 + 0.15 + i * (w - 0.3) / 12, u0 + 0.15 + i * (w - 0.3) / 12 + (w - 0.3) / 18, z0 + 1, z0 + 1 + h * 0.5, i % 4 === 3 ? '#f2b84b' : '#5fa8e0');
      }
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 20; i++) {
        const q = pl.F(u0 + 0.15 + (i / 20) * (w - 0.3), z0 + (z1 - z0) * (0.55 + 0.18 * Math.sin(i * 0.5 + t * 0.4)));
        if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#f06a4a', Math.max(1, kk));
        prev = q;
      }
    } else if (slide === 2) {
      // a slide of text: bullet lines and a pie chart
      for (let i = 0; i < 5; i++) {
        Q(u0 + 0.16, u0 + 0.22, z1 - 4.6 - i * 2, z1 - 4 - i * 2, '#c8a050');
        Q(u0 + 0.3, u0 + 0.3 + w * (0.25 + hash(i, 5, 2) * 0.2), z1 - 4.6 - i * 2, z1 - 4 - i * 2, '#d8d0bc');
      }
      const [cx, cy] = pl.F(u1 - w * 0.22, z0 + (z1 - z0) * 0.42);
      const R0 = 18 * kk;
      for (let y = -R0; y <= R0; y++)
        for (let x = -R0 * 1.1; x <= R0 * 1.1; x++) {
          if ((x / 1.1) ** 2 + y * y > R0 * R0) continue;
          const a = (Math.atan2(y, x) + Math.PI + t * 0.2) % (Math.PI * 2);
          p.c.fillStyle = a < 2.4 ? '#5fa8e0' : a < 4.2 ? '#f2b84b' : a < 5.4 ? '#5fe08a' : '#e86a8a';
          p.c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
        }
    } else {
      // the survey map with a pulsing field site
      for (let i = 0; i < 7; i++) {
        let prev: [number, number] | null = null;
        for (let j = 0; j <= 24; j++) {
          const f = j / 24;
          const q = pl.F(u0 + 0.12 + f * (w - 0.24), z0 + 1.4 + i * 1.8 + Math.sin(f * 7 + i) * 1.1);
          if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], i % 3 === 0 ? '#a88a5a' : '#6a7a5a');
          prev = q;
        }
      }
      const [mx, my] = pl.F(u0 + w * 0.62, z0 + (z1 - z0) * 0.45);
      const r = (3 + ((t * 2) % 1) * 6) * kk;
      p.c.globalAlpha = 1 - ((t * 2) % 1);
      ell(p.c, mx, my, r, r * 0.8, '#f06a4a');
      p.c.globalAlpha = 1;
      ell(p.c, mx, my, 2 * kk, 2 * kk, '#ffe0a0');
    }
  },
};

// ── the survey-map board above the archive ──────────────────
const pinboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    const z0 = 23.2;
    const z1 = 37.4;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(20,12,24,0.3)');
    pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => at(LARCHF, (pl.light ? 3.4 : 2.4) + (noise2(u * 0.05 + v * 0.6, v * 0.1, 9) > 0.66 ? -1 : 0) + (hash(x, y, 4) < 0.04 ? -1 : 0)), pl.light);
    pt(p, pl, u0 + 0.06, u1 - 0.06, z0 + 0.8, z1 - 0.8, (_u: number, _v: number, x: number, y: number) => at(['#7a5430', '#90643a', '#a67646', '#b88852', '#c89a62'], 2.4 + (hash(x, y, 51) - 0.5) * 2.4), pl.light);
    // the topographic map pinned in the middle: contours, a lake, a red route
    const mu0 = u0 + 0.3;
    const mu1 = u1 - 0.55;
    pt(p, pl, mu0, mu1, z0 + 2, z1 - 1.6, (u: number, v: number) => {
      const h = Math.sin(u * 0.08) * 6 + Math.cos(v * 0.12 + u * 0.03) * 6 + v * 0.25;
      if (Math.abs((h % 4 + 4) % 4) < 0.45) return '#a8845a';
      const lake = (u - 30) ** 2 / 90 + (v - 14) ** 2 / 20 < 1;
      if (lake) return '#7aa8c8';
      return h > 9 ? '#f4f2ea' : h > 4 ? '#e8e2c8' : '#d6e0b4';
    }, pl.light);
    // the route and field sites joined by red string
    const sites: [number, number][] = [[mu0 + 0.2, z0 + 4], [mu0 + 0.6, z0 + 7.5], [mu0 + 1.1, z0 + 6], [mu0 + 1.5, z0 + 10]];
    for (let i = 0; i < sites.length - 1; i++) {
      const [x0, y0] = pl.F(...sites[i]);
      const [x1, y1] = pl.F(...sites[i + 1]);
      ln(p.c, x0, y0, x1, y1, '#c82a2a');
    }
    for (const [u, z] of sites) {
      const [x, y] = pl.F(u, z);
      px(p.c, x - 1, y - 1, '#e8382a', 3, 3);
      px(p.c, x - 1, y - 1, '#ff9a8a');
    }
    // index cards, a polaroid of a marmot, a calendar page
    const cards: [number, number, string][] = [[u1 - 0.48, z1 - 5, '#fbf6e8'], [u1 - 0.42, z1 - 9.6, '#f6e8a0'], [u0 + 0.1, z0 + 1.6, '#e8f0f6']];
    for (const [u, z, col] of cards) {
      pq(p, pl, u, u + 0.32, z, z + 3.4, col);
      for (let j = 0; j < 3; j++) {
        const [x0, y0] = pl.F(u + 0.04, z + 0.8 + j * 0.8);
        const [x1, y1] = pl.F(u + 0.26, z + 0.8 + j * 0.8);
        ln(p.c, x0, y0, x1, y1, '#8a8070');
      }
      const [xp, yp] = pl.F(u + 0.16, z + 3);
      px(p.c, xp - 1, yp - 1, '#2a5aa8', 3, 3);
    }
    pq(p, pl, u1 - 0.5, u1 - 0.14, z0 + 1.2, z0 + 5, '#fbfbf6');
    pq(p, pl, u1 - 0.47, u1 - 0.17, z0 + 2, z0 + 4.7, '#7a9a52');
    const [mx, my] = pl.F(u1 - 0.32, z0 + 3.2);
    ell(p.c, mx, my, 2.5, 3, '#8a6a42');
    ell(p.c, mx, my - 3, 1.6, 1.6, '#a07a4e');
  },
};

// ── the door: larch planks in a granite surround ────────────
const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.16;
    const u1 = k.wp.at + k.wp.w - 0.16;
    const L = pl.light;
    // the granite surround: jambs and a lintel with a carved year
    pt(p, pl, u0 - 0.13, u1 + 0.13, 0, 24.6, granite, L);
    pq(p, pl, u0 - 0.13, u1 + 0.13, 24.2, 24.6, at(GRANITE, L ? 5 : 3));
    for (let i = 0; i < 4; i++) {
      const [x, y] = pl.F(u0 + 0.12 + i * ((u1 - u0 - 0.24) / 3), 23);
      px(p.c, x - 1, y - 2, GRANITE[1], 3, 4);
    }
    // the plank door: vertical larch boards, iron strap hinges with curled ends, a ring latch
    pt(p, pl, u0, u1, 0, 21.6, (u: number, v: number, x: number, y: number) => {
      const b = Math.floor(u / 10);
      const fu = u - b * 10;
      if (fu < 1) return TIMBER[0];
      let i = (L ? 4 : 3) + (hash(b, 1, 61) - 0.5) * 1.2;
      if (noise2(fu * 0.5 + b * 7, v * 0.05, 62) > 0.66) i -= 1;
      if (hash(x, y, 63) < 0.03) i -= 1;
      return at(TIMBER, i);
    }, L);
    for (const z of [4.5, 17]) {
      const [x0, y0] = pl.F(u0, z);
      const [x1, y1] = pl.F(u1 - 0.12, z);
      ln(p.c, x0, y0, x1, y1, IRONK[2], 3);
      ln(p.c, x0, y0 - 1, x1, y1 - 1, IRONK[4], 1);
      curve(p.c, x1, y1, x1 + 4, y1 - 4, x1 + 2, y1 - 7, IRONK[2], 2);
      curve(p.c, x1, y1, x1 + 4, y1 + 4, x1 + 1, y1 + 6, IRONK[2], 2);
      for (let i = 0; i < 4; i++) {
        const [nx, ny] = pl.F(u0 + 0.08 + i * 0.12, z);
        px(p.c, nx, ny - 1, IRONK[5], 1, 1);
      }
    }
    const [rx, ry] = pl.F(u1 - 0.14, 10.5);
    ell(p.c, rx, ry, 4, 4, IRONK[2]);
    ell(p.c, rx, ry, 2.5, 2.5, 'rgba(0,0,0,0)');
    px(p.c, rx - 1, ry - 5, IRONK[4], 3, 2);
    // a small barred window in the door
    pq(p, pl, u0 + 0.2, u1 - 0.2, 16.4, 19.6, '#1e2228');
    pt(p, pl, u0 + 0.22, u1 - 0.22, 16.6, 19.4, view(k.seed + 2, true), L);
    for (let i = 1; i < 3; i++) {
      const u = u0 + 0.22 + (i * (u1 - u0 - 0.44)) / 3;
      const [x0, y0] = pl.F(u, 16.6);
      const [x1, y1] = pl.F(u, 19.4);
      ln(p.c, x0, y0, x1, y1, IRONK[2], 2);
    }
    // the threshold stone and a mat
    pq(p, pl, u0 - 0.1, u1 + 0.1, 0, 0.5, at(GRANITE, 5));
    // a lantern on a bracket beside the door
    const [lx, ly] = pl.F(u1 + 0.3, 19);
    layer(p.c, (l) => {
      px(l, lx - 6, ly - 1, IRONK[3], 8, 2);
      px(l, lx - 1, ly, IRONK[3], 2, 4);
      fillPoly(l, [[lx - 5, ly + 4], [lx + 5, ly + 4], [lx + 4, ly + 16], [lx - 4, ly + 16]], IRONK[2]);
      fillPoly(l, [[lx - 4, ly + 6], [lx + 4, ly + 6], [lx + 3, ly + 15], [lx - 3, ly + 15]], '#f6d890');
      px(l, lx - 1, ly + 8, '#fff6d8', 2, 5);
      fillPoly(l, [[lx - 7, ly + 4], [lx + 7, ly + 4], [lx, ly - 2]], IRONK[3]);
    });
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [lx, ly] = pl.F(k.wp.at + k.wp.w - 0.16 + 0.3, 19);
    const u = p.k / 4;
    p.c.globalAlpha = 0.12 + Math.sin(k.t * 5 + k.seed) * 0.02;
    ell(p.c, lx, ly + 10 * u, 18 * u, 18 * u, '#ffd890');
    p.c.globalAlpha = 1;
  },
};

// ── framed charts: a planisphere, a moon map, Orion on parchment ──
const res_starchart: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const wide = k.wp.w >= 2;
    const u0 = k.wp.at + (wide ? 0.18 : 0.14);
    const u1 = k.wp.at + k.wp.w - (wide ? 0.18 : 0.14);
    const z0 = wide ? 24.4 : 23.6;
    const z1 = wide ? 37.6 : 35.6;
    const kind = k.seed % 3;
    pq(p, pl, u0 + 0.05, u1 + 0.05, z0 - 0.6, z1 - 0.6, 'rgba(10,8,20,0.4)');
    pq(p, pl, u0, u1, z0, z1, GILT[0]);
    pt(p, pl, u0 + 0.02, u1 - 0.02, z0 + 0.2, z1 - 0.2, (u: number, v: number) => at(GILT, (pl.light ? 3 : 2) + ((u + v) % 7 < 1.2 ? 1 : 0)), pl.light);
    pq(p, pl, u0 + 0.06, u1 - 0.06, z0 + 0.7, z1 - 0.7, GILT[0]);
    const iu0 = u0 + 0.08;
    const iu1 = u1 - 0.08;
    const iz0 = z0 + 0.9;
    const iz1 = z1 - 0.9;
    if (kind === 0) {
      // a planisphere: navy disc, a zodiac ring, stars, parchment spandrels
      pt(p, pl, iu0, iu1, iz0, iz1, (u: number, v: number, x: number, y: number) => {
        const cu = (iu1 - iu0) * 32 - 0;
        void cu;
        const W2 = (iu1 - iu0) * 64 * 0.5;
        const H2 = (iz1 - iz0) * 4 * 0.5;
        const du = (u - W2) / Math.min(W2, H2 * 1.1);
        const dv = (v - H2) / Math.min(W2, H2 * 1.1);
        const r = Math.hypot(du, dv);
        if (r > 0.98) return hash(x, y, 9) < 0.05 ? PARCH[2] : PARCH[4];
        if (r > 0.86) return Math.floor(Math.atan2(dv, du) * 1.9) % 2 ? '#c8a050' : '#e8d8a8';
        if (r > 0.84) return '#1a1a2a';
        const h = hash(Math.floor(u), Math.floor(v), 13 + k.seed);
        if (h < 0.025) return '#fff6d8';
        if (Math.abs(r - 0.45) < 0.012 || Math.abs(du) < 0.006 || Math.abs(dv) < 0.006) return '#3a4a7a';
        return NIGHT[2];
      }, pl.light);
    } else if (kind === 1) {
      // the Moon: grey maria and bright highlands on black, a crater ray
      pt(p, pl, iu0, iu1, iz0, iz1, (u: number, v: number, x: number, y: number) => {
        const W2 = (iu1 - iu0) * 32;
        const H2 = (iz1 - iz0) * 2;
        const R0 = Math.min(W2, H2 * 1.1) * 0.86;
        const du = (u - W2) / R0;
        const dv = (v - H2) / R0;
        const r = Math.hypot(du, dv);
        if (r > 1) return hash(x, y, 10) < 0.01 ? '#e8e8f0' : '#0e0e14';
        const mare = noise2(du * 3 + 4, dv * 3 + 2, 77) > 0.58;
        const crater = hash(Math.floor(du * 9 + 20), Math.floor(dv * 9 + 20), 78) < 0.12;
        const lit = -du * 0.4 + dv * 0.3;
        let i = 3 + lit * 2 - (mare ? 1.6 : 0) - (crater ? 1 : 0);
        if (bayer(x, y) > 0.5) i += 0.3;
        return at(['#3a3a40', '#56565c', '#76767a', '#98989a', '#bcbcba', '#dededa'], i);
      }, pl.light);
    } else {
      // Orion on old parchment: the figure, the stars, a little cartouche
      pt(p, pl, iu0, iu1, iz0, iz1, (u: number, v: number, x: number, y: number) => {
        const n = noise2(u * 0.06, v * 0.08, 81);
        return at(PARCH, 3.6 + (n > 0.62 ? -0.8 : 0) + (hash(x, y, 82) < 0.04 ? -1 : 0) - (u < 3 || v < 3 ? 1 : 0));
      }, pl.light);
      const fig: [number, number][] = [[0.3, 0.86], [0.42, 0.66], [0.5, 0.52], [0.58, 0.52], [0.66, 0.5], [0.72, 0.68], [0.8, 0.86]];
      const arm: [number, number][] = [[0.42, 0.66], [0.3, 0.42], [0.22, 0.24]];
      const bow: [number, number][] = [[0.72, 0.68], [0.86, 0.6], [0.9, 0.4]];
      for (const line of [fig, arm, bow])
        for (let i = 0; i < line.length - 1; i++) {
          const [x0, y0] = pl.F(iu0 + line[i][0] * (iu1 - iu0), iz0 + line[i][1] * (iz1 - iz0));
          const [x1, y1] = pl.F(iu0 + line[i + 1][0] * (iu1 - iu0), iz0 + line[i + 1][1] * (iz1 - iz0));
          ln(p.c, x0, y0, x1, y1, '#8a6a4a');
        }
      for (const [a, b] of [...fig, ...arm, ...bow]) {
        const [sx, sy] = pl.F(iu0 + a * (iu1 - iu0), iz0 + b * (iz1 - iz0));
        px(p.c, sx - 1, sy, '#a8382a', 3, 1);
        px(p.c, sx, sy - 1, '#a8382a', 1, 3);
      }
      pq(p, pl, iu0 + (iu1 - iu0) * 0.18, iu0 + (iu1 - iu0) * 0.82, iz0 + 0.6, iz0 + 1.8, '#c8b088');
    }
  },
};

// ── a Vienna regulator with a swinging pendulum ─────────────
const res_clock: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const c = k.wp.at + 0.5;
    const hw = 0.19;
    const L = pl.light;
    pq(p, pl, c - hw + 0.04, c + hw + 0.06, 13.2, 33.6, 'rgba(20,12,24,0.3)');
    // the case: a crest, the dial box, the long glazed body, a turned drop
    pq(p, pl, c - hw, c + hw, 14, 33.4, WALNUT[1]);
    pt(p, pl, c - hw + 0.02, c + hw - 0.02, 14.2, 33.2, (u: number, v: number, x: number, y: number) => at(WALNUT, (L ? 4 : 3) + (noise2(u * 0.3, v * 0.05, 3) > 0.64 ? -1 : 0) + (hash(x, y, 4) < 0.04 ? -1 : 0)), L);
    pq(p, pl, c - hw - 0.05, c + hw + 0.05, 33.4, 34.4, WALNUT[3]);
    const [tx, ty] = pl.F(c, 34.4);
    fillPoly(p.c, [[tx - 9, ty], [tx + 9, ty], [tx, ty - 7]], WALNUT[4]);
    px(p.c, tx - 1, ty - 9, BRASS[4], 3, 3);
    // the enamel dial with Roman hours
    const [dx, dy] = pl.F(c, 30);
    layer(p.c, (l) => {
      ell(l, dx, dy, 10, 10, BRASS[3]);
      ell(l, dx, dy, 9, 9, '#f6f2e6');
      ell(l, dx - 2, dy - 2, 5, 5, '#fffdf6');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        px(l, dx + Math.cos(a) * 7, dy + Math.sin(a) * 7, '#2a2a2e', i % 3 === 0 ? 2 : 1, 1);
      }
      ln(l, dx, dy, dx + 3, dy - 5, '#1e1e22', 1);
      ln(l, dx, dy, dx - 5, dy + 1, '#1e1e22', 1);
    });
    // the glazed body, dark inside, with the brass weights
    pq(p, pl, c - hw + 0.05, c + hw - 0.05, 15.4, 27, '#2a1a12');
    for (const u of [c - 0.08, c + 0.08]) {
      const [wx, wy] = pl.F(u, 23);
      px(p.c, wx - 2, wy - 8, BRASS[3], 4, 9);
      px(p.c, wx - 2, wy - 8, BRASS[5], 1, 9);
      ln(p.c, wx, wy - 8, wx, wy - 22, '#c8c0a8');
    }
    const [bx, by] = pl.F(c, 13.6);
    px(p.c, bx - 2, by - 2, WALNUT[3], 5, 5);
    px(p.c, bx - 1, by + 3, WALNUT[4], 3, 3);
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const c = k.wp.at + 0.5;
    const [ax, ay] = pl.F(c, 26.6);
    const u = p.k / 4;
    const sw = Math.sin(k.t * Math.PI) * 0.22;
    const len = 34 * u;
    const ex = ax + Math.sin(sw) * len;
    const ey = ay + Math.cos(sw) * len;
    ln(p.c, ax, ay, ex, ey, '#c8a040');
    ell(p.c, ex, ey, 4 * u, 4 * u, '#d8b048');
    ell(p.c, ex - u, ey - u, 1.5 * u, 1.5 * u, '#fff0b8');
  },
};

// ── a banjo barometer ───────────────────────────────────────
const res_barometer: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const c = k.wp.at + 0.5;
    const [x, y] = pl.F(c, 21);
    layer(p.c, (l) => {
      // the banjo case: a long neck with a thermometer, a big dial below, a swan-neck crest
      fillPoly(l, [[x - 5, y - 28], [x + 5, y - 28], [x + 5, y - 6], [x - 5, y - 6]], WALNUT[3]);
      px(l, x - 5, y - 28, WALNUT[5], 2, 22);
      ell(l, x, y + 8, 15, 15, WALNUT[2]);
      ell(l, x - 1, y + 7, 14, 14, WALNUT[4]);
      ell(l, x, y + 8, 11, 11, BRASS[3]);
      ell(l, x, y + 8, 10, 10, '#f4eedc');
      ell(l, x - 3, y + 5, 5, 5, '#fffaee');
      for (let i = 0; i < 20; i++) {
        const a = Math.PI * 0.8 + (i / 19) * Math.PI * 1.4;
        px(l, x + Math.cos(a) * 8, y + 8 + Math.sin(a) * 8, '#3a3a40');
      }
      ln(l, x, y + 8, x + 5, y + 2, '#1e1e22', 1);
      ln(l, x, y + 8, x - 4, y + 3, BRASS[2], 1);
      px(l, x - 1, y + 7, BRASS[5], 3, 3);
      // the thermometer in the neck
      px(l, x - 1, y - 26, '#f2ecdc', 3, 18);
      px(l, x, y - 16, '#c8382a', 1, 8);
      ell(l, x, y - 7, 2, 2, '#c8382a');
      // the crest
      curve(l, x - 7, y - 28, x - 6, y - 36, x - 1, y - 33, WALNUT[3], 2);
      curve(l, x + 7, y - 28, x + 6, y - 36, x + 1, y - 33, WALNUT[3], 2);
      ell(l, x, y - 35, 2, 2, BRASS[4]);
    });
  },
};

// ── specimen shelves ────────────────────────────────────────
const res_shelf: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    const P3 = (u: number, d: number, z: number) => p.P(...W3(side, u, -d, z));
    const shelf = (z: number) => {
      const a = P3(u0, 0, z);
      const b = P3(u1, 0, z);
      const c = P3(u1, 0.3, z);
      const d = P3(u0, 0.3, z);
      fillPoly(p.c, [a, b, c, d], LARCHF[4]);
      const e = P3(u0, 0.3, z - 1.4);
      const f = P3(u1, 0.3, z - 1.4);
      fillPoly(p.c, [d, c, f, e], LARCHF[2]);
      ln(p.c, e[0], e[1], f[0], f[1], LARCHF[0]);
      // iron brackets
      for (const u of [u0 + 0.12, u1 - 0.12]) {
        const q0 = P3(u, 0, z - 1.4);
        const q1 = P3(u, 0.26, z - 1.4);
        const q2 = P3(u, 0, z - 5);
        ln(p.c, q0[0], q0[1], q1[0], q1[1], IRONK[2], 2);
        ln(p.c, q1[0], q1[1], q2[0], q2[1], IRONK[2], 1);
      }
    };
    const R = (i: number, s: number) => hash(i, s, k.seed * 7 + 3);
    for (const z of [16.5, 22.5]) {
      shelf(z);
      layer(p.c, (l) => {
        let u = u0 + 0.08;
        let i = 0;
        while (u < u1 - 0.12) {
          const [x, y] = P3(u, 0.15, z);
          const what = Math.floor(R(i, Math.round(z)) * 5);
          if (what === 0) {
            // a specimen jar
            px(l, x - 4, y - 14, '#d8ecf0', 8, 14);
            px(l, x - 3, y - 11, ['#c8d890', '#d8c890', '#c0d4dc'][i % 3], 6, 11);
            for (let q = 0; q < 3; q++) ln(l, x, y - 2, x - 2 + q * 2, y - 9, ['#5a8a3a', '#3050c8', '#8a5a3a'][i % 3]);
            px(l, x - 5, y - 16, WALNUT[3], 10, 2);
            px(l, x - 4, y - 14, '#ffffff', 1, 13);
            u += 0.2;
          } else if (what === 1) {
            // a geode split open
            ell(l, x, y - 5, 6, 5, '#8a8070');
            ell(l, x, y - 5, 4, 3, '#8a5ab8');
            ell(l, x - 1, y - 6, 2, 1.5, '#d8c8f0');
            u += 0.2;
          } else if (what === 2) {
            // a stuffed alpine owl on a perch
            px(l, x - 1, y - 4, WALNUT[3], 2, 4);
            ell(l, x, y - 11, 5, 7, '#8a6a4a');
            ell(l, x - 1, y - 12, 3, 5, '#a8865e');
            ell(l, x, y - 18, 4, 4, '#8a6a4a');
            px(l, x - 3, y - 19, '#f0c830', 2, 2);
            px(l, x + 1, y - 19, '#f0c830', 2, 2);
            px(l, x - 3, y - 19, '#1a1418');
            px(l, x + 1, y - 19, '#1a1418');
            u += 0.24;
          } else if (what === 3) {
            // field books leaning
            for (let q = 0; q < 4; q++) {
              const col = ['#6a1e1c', '#2e4a30', '#2a3e5a', '#7a5a2a'][(q + i) % 4];
              px(l, x - 6 + q * 3, y - 12 + (q % 2), col, 3, 12 - (q % 2));
              px(l, x - 6 + q * 3, y - 10, '#c8a04a', 3, 1);
            }
            u += 0.22;
          } else {
            // an ammonite and a crystal
            ell(l, x, y - 4, 5, 4, '#b4a488');
            ell(l, x, y - 4, 3, 2.5, '#8a7a62');
            fillPoly(l, [[x + 5, y], [x + 7, y - 9], [x + 9, y]], '#e8eef4');
            u += 0.2;
          }
          i++;
        }
      });
    }
  },
};

// ── a brass lamp bracket with a frosted tulip shade ─────────
const res_sconce: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 21);
    layer(p.c, (l) => {
      ell(l, x, y + 2, 4, 5, BRASS[2]);
      ell(l, x - 1, y + 1, 2, 3, BRASS[5]);
      curve(l, x, y, x + 9, y - 2, x + 7, y - 10, BRASS[3], 2);
      curve(l, x, y - 1, x + 9, y - 3, x + 7, y - 11, BRASS[5], 1);
      // the gallery and the frosted glass tulip, opening upward
      px(l, x + 3, y - 12, BRASS[3], 9, 2);
      fillPoly(l, [[x + 2, y - 13], [x + 12, y - 13], [x + 15, y - 25], [x + 12, y - 27], [x + 2, y - 27], [x - 1, y - 25]], '#efe6d2');
      fillPoly(l, [[x + 2, y - 13], [x + 6, y - 13], [x + 4, y - 25], [x - 1, y - 25]], '#fbf6ea');
      fillPoly(l, [[x + 9, y - 13], [x + 12, y - 13], [x + 15, y - 25], [x + 12, y - 25]], '#d8ccb4');
      ell(l, x + 7, y - 26, 7, 2, '#fff8e0');
    });
    void k;
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 21);
    const u = p.k / 4;
    p.c.globalAlpha = 0.11 + Math.sin(k.t * 1.3 + k.seed) * 0.015;
    ell(p.c, x + 7 * u, y - 26 * u, 28 * u, 30 * u, '#ffe2a0');
    p.c.globalAlpha = 0.18;
    ell(p.c, x + 7 * u, y - 22 * u, 8 * u, 7 * u, '#fff6d8');
    p.c.globalAlpha = 1;
  },
};

// ── a rail of pegs with mountaineering gear ─────────────────
const res_pegs: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + k.wp.w - 0.08;
    pt(p, pl, u0, u1, 19, 20.2, (_u: number, v: number, x: number, y: number) => at(LARCHF, (pl.light ? 4 : 3) + (v > 0.8 * 4 ? 1 : 0) + (hash(x, y, 4) < 0.05 ? -1 : 0)), pl.light);
    const pegs = [u0 + 0.12, (u0 + u1) / 2, u1 - 0.12];
    for (const u of pegs) {
      const [x, y] = pl.F(u, 19.6);
      px(p.c, x - 1, y - 1, LARCHF[5], 3, 3);
    }
    const [ax, ay] = pl.F(pegs[0], 19.4);
    const [bx, by] = pl.F(pegs[1], 19.4);
    const [cx, cy] = pl.F(pegs[2], 19.4);
    layer(p.c, (l) => {
      // a red shell jacket on the first peg
      fillPoly(l, [[ax - 9, ay + 2], [ax + 9, ay + 2], [ax + 12, ay + 30], [ax - 12, ay + 30]], '#b8282a');
      fillPoly(l, [[ax - 9, ay + 2], [ax - 2, ay + 2], [ax - 4, ay + 30], [ax - 12, ay + 30]], '#d84a3a');
      ln(l, ax, ay + 4, ax, ay + 30, '#7a1a1c');
      fillPoly(l, [[ax - 14, ay + 6], [ax - 9, ay + 3], [ax - 12, ay + 24], [ax - 16, ay + 22]], '#a8222a');
      // a coil of orange rope
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2;
          px(l, bx + Math.cos(a) * (8 - r * 0.8), by + 12 + Math.sin(a) * (10 - r), r % 2 ? '#e88a2a' : '#c8661e', 2, 2);
        }
      }
      ln(l, bx, by, bx, by + 3, '#c8661e', 2);
      // an ice axe and a felt hat
      ln(l, cx, cy + 2, cx + 2, cy + 34, WALNUT[4], 2);
      fillPoly(l, [[cx - 8, cy + 2], [cx + 9, cy], [cx + 9, cy + 3], [cx - 8, cy + 4]], '#a8aeb8');
      px(l, cx - 8, cy + 2, '#d8dce2', 6, 1);
      px(l, cx + 1, cy + 34, '#a8aeb8', 2, 4);
      ell(l, cx + 4, cy - 2, 9, 3, '#4a3e2e');
      ell(l, cx + 4, cy - 5, 5, 4, '#5a4c38');
      px(l, cx - 1, cy - 4, '#2e5a3a', 10, 1);
      dotFruit(l, cx + 7, cy - 6, '#f2eee2', 3);
    });
  },
};

export const RESEARCH_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: { window, screen, pinboard, door, res_starchart, res_clock, res_barometer, res_shelf, res_sconce, res_pegs },
};

export { view, granite, GRANITE, LIME };
void lighten;

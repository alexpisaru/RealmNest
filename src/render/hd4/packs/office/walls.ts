// Office — the back walls of the studio: a historic interior. Warm lime
// plaster over a sage-green panelled wainscot with an oak cap rail, a
// white crown moulding, and the cut top of the wall showing its brick core.
// Wall props: tall arched windows onto the piazza, a glass whiteboard,
// framed prints, a station clock, a cork board, an oak door with a transom,
// floating shelves, brass sconces and a macramé planter.
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, OUTL, px, R, type Ramp } from '../../kit4';
import { bricks4, glass4 } from '../../materials4';
import { beam, door4, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import type { WallArt4, WallPack } from '../types';

// 1 z unit = 10 cm next to a 1.75 m person (17.5 z): a 4 m historic ceiling
const H = 40;
const T = 0.3;

const LIME: Ramp = ['#9c8f7c', '#b9ab95', '#d2c4ab', '#e3d7c0', '#eee5d2', '#f7f1e3'];
const SAGE: Ramp = ['#3e4c3e', '#4f5f4c', '#62735d', '#768a70', '#8da285', '#a7b99e'];
const OAK: Ramp = ['#3d2617', '#5a3a22', '#7a5230', '#9a6b40', '#b88752', '#d2a46a', '#e6c08a'];
const WHITE: Ramp = ['#a9a294', '#c6bfb0', '#ddd6c6', '#ebe5d7', '#f5f0e5', '#fdfaf2'];
const BRASS: Ramp = ['#5a4218', '#7e5e22', '#a47c30', '#c89c42', '#e2bc5e', '#f4da8c'];

/** Lime plaster: soft trowel clouds, fine speckle, a few hairline cracks. */
const lime: Mat = (light) => (u, v, x, y) => {
  let i = light ? 3.2 : 2.1;
  const n = noise2(u * 0.03, v * 0.05, 3) + noise2(u * 0.11, v * 0.13, 4) * 0.5;
  if (n > 1.0 && bayer(x, y) > 0.5) i += 1;
  else if (n < 0.45 && bayer(x, y) > 0.55) i -= 1;
  const h = hash(x, y, 7);
  if (h < 0.03) i -= 1;
  else if (h > 0.985) i += 1;
  const cx = Math.floor(u / 47);
  if (hash(cx, 1, 9) < 0.25 && Math.abs(u - cx * 47 - 20 - Math.sin(v * 0.2 + cx) * 4) < 0.5 && v > 30 && v < 70) i -= 1.4;
  return at(LIME, i);
};

/** Raised panels: stile and rail frame, a bevel lit from the upper left, a flat field. */
const wainscot =
  (pw: number): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const base = light ? 3 : 2;
    const pu = u % pw;
    const m = 7;
    if (pu < m || pu > pw - m || v < m || v > h - m) {
      // the frame: a little grain, a shadow line along the panel edge
      let i = base + (hash(Math.floor(u / 3), Math.floor(v / 9), 11) < 0.15 ? -0.6 : 0);
      if ((pu >= m - 1.5 && pu < m) || (v >= h - m && v < h - m + 1.5)) i -= 1.2;
      return at(SAGE, i);
    }
    // bevel
    if (pu < m + 3) return at(SAGE, base + 1);
    if (v > h - m - 3) return at(SAGE, base + 1);
    if (pu > pw - m - 3 || v < m + 3) return at(SAGE, base - 1);
    return at(SAGE, base + (hash(x, y, 12) < 0.04 ? -1 : 0));
  };

/** Painted wood (mouldings, frames): flat colour, a lit lip and a shadow lip. */
const painted =
  (r: Ramp, step = 6): Mat =>
  (light, _w, h) =>
  (_u, v) => {
    const b = light ? 3 : 2;
    const f = v % step;
    if (v > h - 1.2) return at(r, b + 2);
    if (f < 1) return at(r, b - 1);
    if (f > step - 1.5) return at(r, b + 1);
    return at(r, b);
  };

/** Oak with grain (rails, frames, doors). */
const oak: Mat = (light) => (u, v, x, y) => {
  let i = light ? 3.2 : 2;
  if (noise2(u * 0.05 + v * 0.6, v * 0.08, 21) > 0.62) i -= 0.8;
  if (hash(x, y, 22) < 0.04) i -= 1;
  return at(OAK, i);
};

/** The bare wall: plaster, wainscot, rail, baseboard, crown; the cut top shows the brick core. */
function drawWall(p: PropPainter, side: 'ne' | 'nw', len: number) {
  const pl = side === 'ne' ? front3(p, 0) : side3(p, 0);
  const light = pl.light;
  pt(p, pl, 0, len, 0, H, lime, light);
  // wainscot with panels a little under one tile wide, up to a metre
  pt(p, pl, 0, len, 1.6, 9.6, wainscot(46), light);
  // oak cap rail with a shadow under its nose
  pq(p, pl, 0, len, 9.3, 9.7, darken(SAGE[0], 0.2));
  pt(p, pl, 0, len, 9.6, 10.8, oak, light);
  pq(p, pl, 0, len, 10.8, 11.1, mix(LIME[1], OUTL, 0.3));
  // baseboard
  pt(p, pl, 0, len, 0, 1.8, painted(['#2e2218', '#3e2e20', '#52402c', '#665238', '#7a6446', '#8e7656'], 9), light);
  // a picture rail high up and the crown moulding
  pq(p, pl, 0, len, 31, 31.5, at(LIME, light ? 1 : 0));
  pq(p, pl, 0, len, 31.5, 31.9, at(LIME, light ? 5 : 3));
  pt(p, pl, 0, len, 36.4, H, painted(WHITE, 2), light);
  pq(p, pl, 0, len, 36.1, 36.4, mix(LIME[0], OUTL, 0.3));
  // the cut top: plaster skins either side of a brick core
  const top: FaceTex = (u, v, x, y) => {
    if (v < 3 || v > 12) return at(LIME, 4);
    return bricks4(R.brick)(2, 0, 0)(u, v, x, y);
  };
  if (side === 'ne') {
    poly3(p, [[-T, -T, H], [len, -T, H], [len, 0, H], [-T, 0, H]], top, 2, [[-T, 0, H], [len, 0, H], [-T, -T, H]]);
    // the open end of the wall, facing the street
    poly3(p, [[len, 0, 0], [len, -T, 0], [len, -T, H], [len, 0, H]], endCap, 0);
  } else {
    poly3(p, [[-T, 0, H], [0, 0, H], [0, len, H], [-T, len, H]], top, 2, [[0, 0, H], [0, len, H], [-T, 0, H]]);
    poly3(p, [[0, len, 0], [-T, len, 0], [-T, len, H], [0, len, H]], endCap, 1);
  }
}

/** The end of a cut wall: lime render over brick, a stone plinth. */
const endCap: Mat = (light, w) => (u, v, x, y) => {
  if (v < 7) return at(R.stoneWarm, light ? 4 : 2);
  if (u < 2 || u > w - 2) return at(LIME, light ? 4 : 2);
  return bricks4(R.brick)(light ? 1 : 0, 0, 0)(u, v, x, y);
};

// ── wall props ──────────────────────────────────────────────
const planeOf = (p: PropPainter, side: 'ne' | 'nw'): Plane & { at: (u: number, z: number) => [number, number, number] } => (side === 'ne' ? front3(p, 0) : side3(p, 0));

/** The view through a window: sky, the palazzi across, a plane tree, all slightly hazy. */
const view =
  (seed: number): FaceTex =>
  (u, v, x, y) => {
    // sky: banded, dithered toward the horizon
    const sky = ['#6ea6d2', '#86b8dc', '#9ec8e2', '#bad8e8', '#d6e6ea'];
    let col = sky[Math.max(0, Math.min(4, Math.floor(4.6 - v / 22 + (bayer(x, y) - 0.5) * 0.8)))];
    // a roofline across the piazza, with chimneys
    const roof = 34 + Math.floor(hash(Math.floor((u + seed * 13) / 26), 2, seed) * 14);
    const chim = hash(Math.floor((u + seed * 13) / 9), 3, seed) < 0.12 ? 6 : 0;
    if (v < roof + chim) {
      const wall = ['#c98d58', '#d7a56a', '#e2bf8e', '#caa07a'][Math.floor(hash(Math.floor((u + seed * 13) / 26), 4, seed) * 4)];
      col = v > roof - 3 ? '#a44e34' : (Math.floor(u / 7) + Math.floor(v / 9)) % 3 === 0 && v < roof - 6 && v > 8 ? '#5a6a74' : wall;
    }
    // the plane tree in front, its crown lit from the left
    const tx = u - 8 - seed * 5;
    const d = Math.hypot(tx / 1.25, v - 38);
    if (d < 20 + noise2(u * 0.3, v * 0.3, seed) * 6) col = d < 12 && tx > 0 ? '#4c6e3a' : bayer(x, y) > 0.6 ? '#7a9a52' : '#62844a';
    return col;
  };

/** A tall arched window with a deep reveal, glazing bars, linen curtains and a stone sill. */
function archWindow(p: PropPainter, side: 'ne' | 'nw', u0: number, u1: number, z0: number, z1: number, seed: number) {
  const pl = planeOf(p, side);
  const light = pl.light;
  const um = (u0 + u1) / 2;
  const R0 = (u1 - u0) / 2;
  // a round arch: its rise in z matches its half width (one tile is about 16 z)
  const rise = R0 * 15;
  const arch = (r: number, n = 18): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.PI - (i / n) * Math.PI;
      pts.push([um + Math.cos(t) * r, z1 - rise + Math.sin(t) * (r / R0) * rise]);
    }
    return pts;
  };
  // reveal (the thickness of the wall, in shadow), then the frame and the glass
  const ring = (r: number, zb: number) => [[um - r, zb] as [number, number], ...arch(r), [um + r, zb] as [number, number]];
  poly3(p, ring(R0 + 0.08, z0 - 1.5).map(([u, z]) => pl.at(u, z)), (_u, _v, x, y) => (hash(x, y, 31) < 0.05 ? LIME[0] : at(LIME, light ? 1.4 : 0.6)), light);
  poly3(p, ring(R0 - 0.02, z0).map(([u, z]) => pl.at(u, z)), (_u: number, _v: number) => (light ? WHITE[3] : WHITE[2]), light);
  poly3(p, ring(R0 - 0.1, z0 + 1.2).map(([u, z]) => pl.at(u, z)), view(seed), light);
  // glass reflections over the view, drawn as two pale diagonals
  p.c.globalAlpha = 0.35;
  poly3(p, ring(R0 - 0.1, z0 + 1.2).map(([u, z]) => pl.at(u, z)), (u: number, v: number) => ((u * 0.8 + v) % 40 < 5 ? '#ffffff' : null), light);
  p.c.globalAlpha = 1;
  // glazing bars: mullion, transoms, and the fan of the arch
  const bar: Ramp = WHITE;
  beam(p, pl, um, z0 + 1, um, z1 - rise * 0.05, 0.55, bar);
  for (const f of [0.33, 0.66]) beam(p, pl, u0 + 0.06, z0 + (z1 - rise - z0) * f, u1 - 0.06, z0 + (z1 - rise - z0) * f, 0.5, bar);
  beam(p, pl, u0 + 0.06, z1 - rise, u1 - 0.06, z1 - rise, 0.6, bar);
  for (const a of [Math.PI * 0.25, Math.PI * 0.75]) beam(p, pl, um, z1 - rise, um + Math.cos(a) * (R0 - 0.1), z1 - rise + Math.sin(a) * rise * 0.92, 0.45, bar);
  // stone sill with a lip
  pq(p, pl, u0 - 0.14, u1 + 0.14, z0 - 1.2, z0, at(R.stoneWarm, light ? 5 : 3));
  pq(p, pl, u0 - 0.14, u1 + 0.14, z0 - 1.6, z0 - 1.2, mix(R.stoneWarm[1], OUTL, 0.3));
  // linen curtains gathered on a brass rod
  const rod = z1 + 1.2;
  beam(p, pl, u0 - 0.3, rod, u1 + 0.3, rod, 0.5, BRASS);
  for (const [a, b] of [[u0 - 0.28, u0 + 0.06], [u1 - 0.06, u1 + 0.28]] as const) {
    pt(
      p,
      pl,
      a,
      b,
      z0 - 2.5,
      rod - 0.3,
      (u: number, v: number) => {
        // folds: alternating light and shade columns, a tie-back pinch two thirds down
        const f = Math.floor((u / 3.2 + (v < 26 ? 0.5 : 0)) % 2);
        const lin: Ramp = ['#a8987c', '#c4b496', '#d8cab0', '#e8dcc6', '#f4ecdc'];
        return at(lin, (light ? 3 : 2) + (f ? 0.6 : -0.6) - (Math.abs(v - 30) < 1.5 ? 1 : 0));
      },
      light,
    );
  }
  // a pot of basil and a small cactus on the sill
  const [sx, sy] = pl.F(u0 + 0.35, z0);
  layer(p.c, (l) => {
    fillPoly(l, [[sx - 7, sy - 10], [sx + 7, sy - 10], [sx + 6, sy], [sx - 6, sy]], '#b8693e');
    px(l, sx - 7, sy - 11, '#d48a5a', 14, 2);
    foliage(l, [{ x: sx, y: sy - 17, rx: 9, ry: 7, z: 1 }], R.apple, seed + 3, { cell: 2.6 });
  });
}

const window: WallArt4 = {
  draw(p, side, k) {
    const { at: a0, w } = k.wp;
    // one tall window per two tiles, centred in the span
    const n = Math.max(1, Math.round(w / 2.2));
    const span = w / n;
    for (let i = 0; i < n; i++) {
      const c = a0 + span * (i + 0.5);
      archWindow(p, side, c - 0.62, c + 0.62, 8.4, 33, k.seed * 7 + i);
    }
  },
};

const whiteboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.15;
    const u1 = k.wp.at + k.wp.w - 0.15;
    // a sheet of pale green glass on four steel standoffs, its shadow on the plaster
    // the sketches are laid out on a 26..52 grid, mapped onto z 12..26
    const Z = (z: number) => 12 + (z - 26) * 0.54;
    pq(p, pl, u0 + 0.06, u1 + 0.06, Z(25), Z(51), 'rgba(60,50,40,0.18)');
    pt(p, pl, u0, u1, Z(26), Z(52), (u, v, x, y) => (u < 1.5 || v > 54 || v < 1.5 ? '#c4d8d0' : (u * 0.7 + v) % 52 < 4 ? '#f6fbf8' : hash(x, y, 41) < 0.02 ? '#d8e6e0' : '#e8f2ee'), pl.light);
    for (const [u, z] of [[u0 + 0.12, 50], [u1 - 0.12, 50], [u0 + 0.12, 28], [u1 - 0.12, 28]] as const) {
      const [x, y] = pl.F(u, Z(z));
      ell(p.c, x, y, 2.5, 2.5, R.metal[2]);
      px(p.c, x - 1, y - 1, R.metal[5]);
    }
    // a wireframe sketch, arrows, a bar chart, sticky notes and a marker tray
    const L = (ua: number, za: number, ub: number, zb: number, col: string) => {
      const [x0, y0] = pl.F(ua, Z(za));
      const [x1, y1] = pl.F(ub, Z(zb));
      ln(p.c, x0, y0, x1, y1, col, 1);
    };
    const ink = '#2a5aa8';
    const red = '#c8382a';
    const box = (ua: number, za: number, ub: number, zb: number, col: string) => {
      L(ua, za, ub, za, col);
      L(ub, za, ub, zb, col);
      L(ub, zb, ua, zb, col);
      L(ua, zb, ua, za, col);
    };
    box(u0 + 0.25, 47, u0 + 1.1, 36, ink);
    L(u0 + 0.3, 44, u0 + 1.05, 44, ink);
    box(u0 + 0.35, 42, u0 + 0.7, 38, ink);
    for (let i = 0; i < 3; i++) L(u0 + 0.78, 41.5 - i * 1.6, u0 + 1.02, 41.5 - i * 1.6, ink);
    L(u0 + 1.2, 42, u0 + 1.55, 42, red);
    L(u0 + 1.48, 43, u0 + 1.55, 42, red);
    L(u0 + 1.48, 41, u0 + 1.55, 42, red);
    for (let i = 0; i < 5; i++) {
      const hgt = 3 + hash(i, 3, k.seed) * 8;
      pq(p, pl, u0 + 1.7 + i * 0.14, u0 + 1.79 + i * 0.14, Z(36), Z(36 + hgt), i === 3 ? '#e2553b' : '#3fb68b');
    }
    L(u0 + 1.65, 36, u1 - 0.2, 36, '#3a3a40');
    const notes = ['#f6d860', '#f2a0c0', '#9fe3b8', '#9fc8f2', '#f6d860'];
    for (let i = 0; i < 6; i++) {
      const u = u0 + 0.3 + (i % 3) * 0.36 + (i > 2 ? 0.1 : 0);
      const z = 29 + (i > 2 ? 0 : 0) + (i % 2) * 0.6;
      const uu = i > 2 ? u + 1.2 : u;
      pq(p, pl, uu, uu + 0.26, Z(z), Z(z + 5), notes[i % notes.length]);
      pq(p, pl, uu, uu + 0.26, Z(z + 4.4), Z(z + 5), lighten(notes[i % notes.length], 0.3));
      L(uu + 0.05, z + 3, uu + 0.2, z + 3, '#5a5040');
    }
    pq(p, pl, u0 + 0.2, u1 - 0.2, Z(24.6), Z(25.6), R.metal[3]);
    for (const [i, c] of [[0, '#2a5aa8'], [1, '#c8382a'], [2, '#2a2a30'], [3, '#3fb68b']] as const) pq(p, pl, u0 + 0.4 + i * 0.25, u0 + 0.6 + i * 0.25, Z(25.6), Z(26.3), c);
  },
};

const poster: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const col = k.wp.color ?? '#e2553b';
    const u0 = k.wp.at + 0.18;
    const u1 = k.wp.at + 0.82;
    pq(p, pl, u0 + 0.04, u1 + 0.04, 13.4, 27.4, 'rgba(60,50,40,0.2)');
    pt(p, pl, u0, u1, 14, 28, oak, pl.light);
    pq(p, pl, u0 + 0.06, u1 - 0.06, 14.8, 27.2, '#f6f0e2');
    // a mid-century print: sun, hills, a single bold shape
    const [cx, cy] = pl.F((u0 + u1) / 2, 23.5);
    ell(p.c, cx + 2, cy, 9, 9, col);
    ell(p.c, cx, cy - 2, 5, 5, lighten(col, 0.25));
    pq(p, pl, u0 + 0.1, u1 - 0.1, 16, 19.5, '#2e4a5a');
    pq(p, pl, u0 + 0.1, (u0 + u1) / 2, 16, 20.5, '#e8b86a');
    pq(p, pl, u0 + 0.1, u1 - 0.1, 15.5, 15.9, '#3a3030');
  },
};

const clock: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 27);
    layer(p.c, (l) => {
      ell(l, x + 3, y + 2, 21, 21, 'rgba(40,30,30,0.25)');
      ell(l, x, y, 21, 21, '#2a2a2e');
      ell(l, x, y, 19, 19, '#3a3a40');
      ell(l, x, y, 17, 17, '#f6f2e8');
      ell(l, x - 4, y - 4, 9, 9, '#fbf9f2');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = i % 3 === 0 ? 11 : 13;
        ln(l, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * 15, y + Math.sin(a) * 15, '#2a2a2e', i % 3 === 0 ? 2 : 1);
      }
    });
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 27);
    const u = p.k / 4;
    const t = k.t;
    const hr = (t / 600) * Math.PI * 2 - Math.PI / 2;
    const mn = (t / 50) * Math.PI * 2 - Math.PI / 2;
    const sc = t * Math.PI * 2 * 0.2 - Math.PI / 2;
    ln(p.c, x, y, x + Math.cos(hr) * 8 * u, y + Math.sin(hr) * 8 * u, '#2a2a2e', Math.max(1, 2 * u));
    ln(p.c, x, y, x + Math.cos(mn) * 12 * u, y + Math.sin(mn) * 12 * u, '#2a2a2e', Math.max(1, Math.round(1.5 * u)));
    ln(p.c, x, y, x + Math.cos(sc) * 13 * u, y + Math.sin(sc) * 13 * u, '#c8382a', 1);
    px(p.c, x - u, y - u, '#c8382a', Math.max(1, 2 * u), Math.max(1, 2 * u));
  },
};

const pinboard: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.12;
    const u1 = k.wp.at + k.wp.w - 0.12;
    pq(p, pl, u0 + 0.05, u1 + 0.05, 12.4, 26.4, 'rgba(60,50,40,0.2)');
    pt(p, pl, u0, u1, 13, 27, oak, pl.light);
    pt(p, pl, u0 + 0.07, u1 - 0.07, 13.8, 26.2, (_u, _v, x, y) => at(['#8a5e34', '#a07040', '#b6844e', '#c8975e', '#d6a86e'], 2.6 + (hash(x, y, 51) - 0.5) * 2.4), pl.light);
    const cols = ['#fbf6e8', '#f6d860', '#9fc8f2', '#f2a0c0', '#fbf6e8', '#c4e0a8'];
    for (let i = 0; i < k.wp.w * 5; i++) {
      const u = u0 + 0.15 + hash(i, 1, k.seed) * (u1 - u0 - 0.45);
      const z = 14.8 + hash(i, 2, k.seed) * 6.5;
      const big = hash(i, 3, k.seed) < 0.3;
      const c = cols[i % cols.length];
      pq(p, pl, u, u + (big ? 0.32 : 0.22), z, z + (big ? 4.4 : 2.8), c);
      pq(p, pl, u, u + (big ? 0.32 : 0.22), z, z + 0.4, darken(c, 0.15));
      for (let j = 0; j < (big ? 3 : 1); j++) {
        const [x0, y0] = pl.F(u + 0.04, z + 1.2 + j * 0.9);
        const [x1, y1] = pl.F(u + (big ? 0.26 : 0.16), z + 1.2 + j * 0.9);
        ln(p.c, x0, y0, x1, y1, '#8a8070');
      }
      const [px0, py0] = pl.F(u + 0.11, z + (big ? 4 : 2.4));
      px(p.c, px0 - 1, py0 - 1, ['#c8382a', '#2a5aa8', '#3fb68b'][i % 3], 3, 3);
    }
    // a photo and a calendar page
    pq(p, pl, u1 - 0.55, u1 - 0.2, 20, 24.5, '#fbfbf6');
    pq(p, pl, u1 - 0.52, u1 - 0.23, 20.8, 24.2, '#6a9ac2');
    pq(p, pl, u1 - 0.52, u1 - 0.23, 20.8, 22, '#7a9a52');
  },
};

const door: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const u0 = k.wp.at + 0.08;
    const u1 = k.wp.at + k.wp.w - 0.08;
    // architrave, a glazed transom with a fan, the panelled oak door
    pt(p, pl, u0 - 0.1, u1 + 0.1, 0, 28, painted(WHITE, 28), pl.light);
    pt(p, pl, u0 + 0.02, u1 - 0.02, 23, 27, glass4(R.glass), pl.light);
    for (let i = 1; i < 4; i++) beam(p, pl, u0 + ((u1 - u0) * i) / 4, 23, u0 + ((u1 - u0) * i) / 4, 27, 0.3, WHITE);
    door4(p, pl, u0 + 0.02, u1 - 0.02, 0, 22.4, OAK, { glass: true });
    // a brass push plate and a little "exit" lamp over the transom
    const [lx, ly] = pl.F((u0 + u1) / 2, 30.5);
    px(p.c, lx - 6, ly - 4, '#2a4a2a', 12, 5);
    px(p.c, lx - 5, ly - 3, '#5ac87a', 10, 3);
    px(p.c, lx - 1, ly - 3, '#e8fff0', 3, 1);
  },
};

const frames: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const n = Math.max(1, Math.round(k.wp.w * 2));
    const palettes = [
      ['#2e4a5a', '#e8b86a', '#c8664a'],
      ['#3a5a3a', '#f2e8d0', '#c8a050'],
      ['#4a3a5a', '#e2a0b0', '#f6f0e2'],
      ['#c8664a', '#2e4a5a', '#f6f0e2'],
    ];
    for (let i = 0; i < n; i++) {
      const u0 = k.wp.at + 0.12 + (i * (k.wp.w - 0.24)) / n;
      const wdt = (k.wp.w - 0.24) / n - 0.1;
      const tall = (i + k.seed) % 3 !== 1;
      const z0 = tall ? 15 + (i % 2) * 1.5 : 19;
      const z1 = tall ? z0 + 10 : z0 + 6;
      const pal = palettes[(i + k.seed) % palettes.length];
      pq(p, pl, u0 + 0.04, u0 + wdt + 0.04, z0 - 0.5, z1 - 0.5, 'rgba(60,50,40,0.2)');
      pq(p, pl, u0, u0 + wdt, z0, z1, i % 2 ? '#2a2a2e' : OAK[3]);
      pq(p, pl, u0 + 0.04, u0 + wdt - 0.04, z0 + 0.6, z1 - 0.6, '#f6f0e2');
      pq(p, pl, u0 + 0.07, u0 + wdt - 0.07, z0 + 1.3, z1 - 1.3, pal[0]);
      pq(p, pl, u0 + 0.07, u0 + wdt * 0.6, z0 + 1.3, z0 + (z1 - z0) * 0.45, pal[1]);
      const [cx, cy] = pl.F(u0 + wdt * 0.66, z0 + (z1 - z0) * 0.62);
      ell(p.c, cx, cy, 3, 3, pal[2]);
    }
  },
};

const shelfPlant: WallArt4 = {
  draw(p, side, k) {
    const u0 = k.wp.at + 0.1;
    const u1 = k.wp.at + k.wp.w - 0.1;
    // a floating oak shelf seen from a little above: its top as a thin band, its front edge
    const P3 = (u: number, d: number, z: number) => (side === 'ne' ? p.P(u, d, z) : p.P(d, u, z));
    const top = (z: number) => {
      const a = P3(u0, 0, z);
      const b = P3(u1, 0, z);
      const c = P3(u1, 0.32, z);
      const d = P3(u0, 0.32, z);
      fillPoly(p.c, [a, b, c, d], OAK[4]);
      const e = P3(u0, 0.32, z - 2.2);
      const f = P3(u1, 0.32, z - 2.2);
      fillPoly(p.c, [d, c, f, e], OAK[2]);
    };
    for (const z of [17, 23.5]) {
      top(z);
      // books, a vase, a trailing plant
      layer(p.c, (l) => {
        let u = u0 + 0.06;
        let i = 0;
        while (u < u1 - 0.45) {
          const zi = Math.round(z * 2);
          const wdt = 0.06 + hash(i, zi, k.seed) * 0.05;
          const hgt = 2.2 + hash(i, zi + 1, k.seed) * 1.4;
          const col = ['#7a3a2a', '#2e4a6a', '#c8a050', '#3a5a3a', '#e8dcc6', '#8a2a3a'][Math.floor(hash(i, zi + 2, k.seed) * 6)];
          const [x0, y0] = P3(u, 0.16, z);
          const [x1] = P3(u + wdt, 0.16, z);
          px(l, Math.min(x0, x1), y0 - hgt * 4, col, Math.max(2, Math.abs(x1 - x0)), hgt * 4);
          px(l, Math.min(x0, x1), y0 - hgt * 4 + 4, lighten(col, 0.25), Math.max(2, Math.abs(x1 - x0)), 1);
          u += wdt + 0.01;
          i++;
        }
        const [vx, vy] = P3(u1 - 0.22, 0.16, z);
        if (z === 17) {
          fillPoly(l, [[vx - 6, vy - 14], [vx + 6, vy - 14], [vx + 5, vy], [vx - 5, vy]], '#e8e0d0');
          px(l, vx - 6, vy - 15, '#f6f0e2', 12, 2);
          const masses: Mass[] = [];
          for (let j = 0; j < 6; j++) masses.push({ x: vx - 10 + j * 4, y: vy - 18 + (j % 2) * 3, rx: 5, ry: 4, z: j });
          foliage(l, masses, R.apple, k.seed + Math.round(z), { cell: 2.4 });
          for (let j = 0; j < 4; j++) for (let q = 0; q < 10 + j * 5; q++) px(l, vx - 8 + j * 5 + (q % 4 === 3 ? 1 : 0), vy + q, R.apple[2 + (q & 1)]);
        } else {
          ell(l, vx, vy - 7, 6, 7, '#5a7a9a');
          ell(l, vx - 2, vy - 9, 3, 3, '#7a9aba');
          px(l, vx - 1, vy - 20, '#3a5a3a', 2, 7);
          dotFruit(l, vx, vy - 21, '#f2b6c8', 4);
        }
      });
    }
  },
};

const sconce: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 21);
    layer(p.c, (l) => {
      px(l, x - 3, y - 2, BRASS[2], 6, 10);
      px(l, x - 3, y - 2, BRASS[4], 2, 10);
      ln(l, x, y + 2, x, y - 10, BRASS[3], 2);
      // a pleated linen shade
      fillPoly(l, [[x - 9, y - 10], [x + 9, y - 10], [x + 12, y - 24], [x - 12, y - 24]], '#f2e6cc');
      for (let i = -10; i <= 10; i += 3) ln(l, x + i * 0.8, y - 10, x + i, y - 24, '#e0d0b0');
      fillPoly(l, [[x - 9, y - 10], [x + 9, y - 10], [x + 9, y - 12], [x - 9, y - 12]], '#fff3d0');
    });
    void k;
  },
  anim(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 20);
    const u = p.k / 4;
    p.c.globalAlpha = 0.12 + Math.sin(k.t * 1.3 + k.seed) * 0.015;
    ell(p.c, x, y - 4 * u, 26 * u, 34 * u, '#ffe7a8');
    p.c.globalAlpha = 0.16;
    ell(p.c, x, y + 4 * u, 12 * u, 14 * u, '#fff3d0');
    p.c.globalAlpha = 1;
  },
};

const hangingPlant: WallArt4 = {
  draw(p, side, k) {
    const pl = planeOf(p, side);
    const [x, y] = pl.F(k.wp.at + 0.5, 25);
    const [hx, hy] = pl.F(k.wp.at + 0.5, 35);
    layer(p.c, (l) => {
      px(l, hx - 2, hy - 2, BRASS[3], 4, 3);
      // macramé cords and knots
      for (const dx of [-8, -3, 3, 8]) ln(l, hx, hy, x + dx, y - 6, '#e8dcc0');
      for (const dx of [-5, 5]) ell(l, x + dx * 0.7, y - 20, 2, 2, '#d8c8a8');
      ell(l, x, y, 11, 8, '#c8a07a');
      ell(l, x - 2, y - 2, 7, 4, '#dab894');
      const masses: Mass[] = [];
      for (let j = 0; j < 7; j++) masses.push({ x: x - 12 + j * 4, y: y - 9 + (j % 2) * 2, rx: 6, ry: 4, z: j });
      foliage(l, masses, R.apple, k.seed + 5, { cell: 2.6 });
      for (let j = 0; j < 6; j++) for (let q = 0; q < 12 + (j % 3) * 9; q++) px(l, x - 11 + j * 4 + (q % 5 === 4 ? 1 : 0), y + 4 + q, R.apple[2 + ((q >> 1) & 1)], 2, 1);
    });
  },
};

export const OFFICE_WALLS: WallPack = {
  height: H,
  draw(p, side, w) {
    drawWall(p, side, side === 'ne' ? w.cols : w.rows);
  },
  art: { window, whiteboard, poster, clock, pinboard, door, frames, shelfPlant, sconce, hangingPlant },
};

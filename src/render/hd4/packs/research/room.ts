// Research Hub — the library's furniture at 128×64 (1 z ≈ 10 cm; a person is ~17.5 z).
// An old alpine observatory library: walnut partners' desks with green leather
// tops, a natural-history specimen bench with a brass microscope, Wardian
// glass cases of ferns and alpine plants, a seedling bench under grow lights,
// a walnut map table spread with a star chart, a floor globe on a tripod,
// archive cases of ledgers and boxes, a plum Chesterfield, a cognac club
// chair, a painted dresser with a brass samovar — and the lodge's stone
// facade, cut low.
import { darken, lighten, mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { bookRow, cylinder, leather, lightOf, rubble, sphere, toneOf } from './kit';
import { BRASS, CERAMIC, COPPER, GILT, GLASSG, GNEISS, GREENL, IRONK, LARCHF, LINEN, MORTAR, NIGHT, PAINTBLUE, PARCH, SLATE, TERRA, WALNUT, ZIRBE } from './palette';

const walnut = grain(WALNUT);
const walnutV = grain(WALNUT, 'v');
const brass = paint(BRASS);

/** A leather / fabric ramp round a colour. */
const around = (col: string): Ramp => [darken(col, 0.56), darken(col, 0.4), darken(col, 0.22), col, lighten(col, 0.14), lighten(col, 0.28)];

/** Raised drawer front on a plane: a dark reveal, a lit field, a brass bail pull. */
function drawer(p: PropPainter, F: ReturnType<typeof front>, a0: number, a1: number, z0: number, z1: number, r: Ramp) {
  pq(p, F, a0, a1, z0, z1, r[1]);
  pq(p, F, a0 + 0.02, a1 - 0.01, z0 + 0.18, z1 - 0.08, F.light ? r[4] : r[3]);
  pq(p, F, a0 + 0.02, a1 - 0.01, z1 - 0.3, z1 - 0.08, F.light ? r[5] : r[4]);
  const [hx, hy] = F.F((a0 + a1) / 2, (z0 + z1) / 2 + 0.1);
  px(p.c, hx - 4, hy - 2, BRASS[2], 9, 1);
  px(p.c, hx - 4, hy - 1, BRASS[5], 2, 2);
  px(p.c, hx + 3, hy - 1, BRASS[5], 2, 2);
  px(p.c, hx - 3, hy + 1, BRASS[4], 7, 1);
}

// ── the banker's chair (oak, on a swivel base), turned toward its desk ──
function bankersChair(p: PropPainter, a: number, b: number, seed: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 7, y + 3, 15, 5, 0.26);
  const W = WALNUT;
  layer(p.c, (l) => {
    // four curved iron legs with castors, the column
    for (const [dx, dy] of [[-12, 2], [11, 3], [-6, -4], [7, -3]] as const) {
      curve(l, x, y - 6, x + dx * 0.6, y - 4 + dy * 0.3, x + dx, y + dy - 1, IRONK[2], 2);
      px(l, x + dx - 1, y + dy - 1, IRONK[0], 3, 3);
    }
    px(l, x - 1, y - 16, IRONK[3], 3, 11);
    px(l, x - 1, y - 16, IRONK[5], 1, 11);
    // the saddle seat
    ell(l, x, y - 18, 14, 6, W[2]);
    ell(l, x - 1, y - 19, 13, 5, W[4]);
    ell(l, x - 4, y - 20, 7, 2, W[5]);
    // the back seen from behind: a curved crest rail on spindles, the arms
    const top = y - 38 - (seed % 2);
    for (let i = 0; i < 7; i++) {
      const sx = x - 11 + i * 3.6;
      const sag = Math.abs(i - 3) * 0.8;
      ln(l, sx, y - 20, sx + (i - 3) * 0.4, top + sag + 3, i % 2 ? W[3] : W[4], 2);
    }
    curve(l, x - 15, top + 6, x, top - 3, x + 15, top + 6, W[3], 4);
    curve(l, x - 15, top + 5, x, top - 4, x + 15, top + 5, W[5], 1);
    for (const s of [-1, 1]) {
      ln(l, x + s * 14, y - 20, x + s * 15, top + 7, W[2], 3);
      px(l, x + s * 15 - 3, y - 27, W[4], 6, 2);
    }
  });
}

/** A brass student lamp with a white opal glass globe. */
function studentLamp(p: PropPainter, a: number, b: number, z: number) {
  const [x, y] = anchor(p, a, b, z);
  layer(p.c, (l) => {
    ell(l, x, y, 8, 3.5, BRASS[2]);
    ell(l, x - 1, y - 1, 7, 2.5, BRASS[4]);
    px(l, x - 1, y - 30, BRASS[3], 3, 30);
    px(l, x - 1, y - 30, BRASS[6], 1, 30);
    // the oil font and the arm, the opal globe
    ell(l, x - 7, y - 30, 6, 4, BRASS[3]);
    ell(l, x - 8, y - 31, 3, 2, BRASS[6]);
    ln(l, x - 3, y - 30, x + 6, y - 30, BRASS[3], 2);
    ell(l, x + 9, y - 36, 8, 8, '#e8e2d2');
    ell(l, x + 7, y - 38, 5, 5, '#fbf8ee');
    ell(l, x + 6, y - 39, 2, 2, '#ffffff');
    px(l, x + 3, y - 29, BRASS[4], 12, 2);
  });
}

/** The live part of a lamp: a soft warm pool. */
function lampGlow(p: PropPainter, a: number, b: number, z: number, t: number, seed: number) {
  const [x, y] = anchor(p, a, b, z);
  const u = p.k / 4;
  p.c.globalAlpha = 0.1 + Math.sin(t * 1.3 + seed) * 0.012;
  ell(p.c, x + 9 * u, y - 30 * u, 26 * u, 20 * u, '#ffe6a6');
  p.c.globalAlpha = 0.16;
  ell(p.c, x + 9 * u, y - 36 * u, 10 * u, 9 * u, '#fff4d0');
  p.c.globalAlpha = 1;
}

/** Live screen: star fields, light curves, spectra, a slowly scrolling table. */
function screenContent(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number, t: number, seed: number, kind: number) {
  const F = front(p, b);
  const w = a1 - a0;
  const h = z1 - z0;
  if (kind === 0) {
    // a star field with a crosshair drifting onto a target
    for (let i = 0; i < 26; i++) {
      const u = a0 + 0.03 + hash(i, 1, seed) * (w - 0.06);
      const z = z0 + 0.3 + hash(i, 2, seed) * (h - 0.6);
      const [x, y] = F.F(u, z);
      px(p.c, x, y, hash(i, 3, seed) < 0.2 ? '#fff2c0' : '#c8d8ff');
    }
    const cu = a0 + w * (0.4 + 0.2 * Math.sin(t * 0.4 + seed));
    const cz = z0 + h * (0.5 + 0.2 * Math.cos(t * 0.33 + seed));
    const [cx, cy] = F.F(cu, cz);
    const k = p.k / 4;
    ln(p.c, cx - 6 * k, cy, cx - 2 * k, cy, '#5fe08a');
    ln(p.c, cx + 2 * k, cy, cx + 6 * k, cy, '#5fe08a');
    ln(p.c, cx, cy - 4 * k, cx, cy - 2 * k, '#5fe08a');
    ln(p.c, cx, cy + 2 * k, cx, cy + 4 * k, '#5fe08a');
  } else if (kind === 1) {
    // a light curve being plotted: dots and a fitted dip
    const n = 22;
    const done = Math.floor(((t * 0.25 + seed * 0.1) % 1) * n) + 2;
    let prev: [number, number] | null = null;
    for (let i = 0; i < Math.min(n, done); i++) {
      const f = i / (n - 1);
      const dip = Math.exp(-Math.pow((f - 0.55) * 6, 2)) * 0.35;
      const z = z0 + h * (0.68 - dip + (hash(i, 4, seed) - 0.5) * 0.08);
      const q = F.F(a0 + 0.05 + f * (w - 0.1), z);
      px(p.c, q[0], q[1], '#f2c86a', 2, 1);
      const zf = z0 + h * (0.68 - dip);
      const qf = F.F(a0 + 0.05 + f * (w - 0.1), zf);
      if (prev) ln(p.c, prev[0], prev[1], qf[0], qf[1], '#7ec8f2');
      prev = qf;
    }
  } else {
    // a spectrum: a rainbow band with absorption lines and a trace above
    for (let i = 0; i < 12; i++) {
      const col = ['#4a2a8a', '#3a4ab8', '#2a7ad0', '#2aa8a8', '#4ac04a', '#a8d040', '#f0d040', '#f0a030', '#e86a2a', '#d0402a', '#a02a2a', '#6a1a1a'][i];
      pq(p, F, a0 + 0.04 + (i * (w - 0.08)) / 12, a0 + 0.04 + ((i + 1) * (w - 0.08)) / 12, z0 + 0.4, z0 + h * 0.32, col);
    }
    for (const f of [0.22, 0.47, 0.61, 0.83]) pq(p, F, a0 + 0.04 + f * (w - 0.08), a0 + 0.055 + f * (w - 0.08), z0 + 0.4, z0 + h * 0.32, '#141018');
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      const z = z0 + h * (0.55 + 0.25 * Math.sin(f * 7 + t * 0.6 + seed) * Math.sin(f * 3));
      const q = F.F(a0 + 0.05 + f * (w - 0.1), z);
      if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#9ae0a4');
      prev = q;
    }
  }
}

// ── desks: walnut partners' desks with tooled green leather tops ──
const desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? 'books';
    const Z = 7.4;
    const R = rng(k.seed * 17 + 3);
    footShadow(p, 0.12, 0.14, W - 0.12, 0.92, 8, 0.26);
    const F = front(p, 0.86);
    // two pedestals of three drawers, a plinth, the kneehole's back panel
    for (const a of [0.14, W - 0.62]) {
      lbox(p, a + 0.02, 0.18, 0.44, 0.66, 0, 0.7, mono(paint(WALNUT), WALNUT[0]));
      lbox(p, a, 0.16, 0.48, 0.7, 0.7, Z - 1.3, { front: walnutV, side: walnutV, top: walnut, edge: WALNUT[0] });
      for (const [z0, z1] of [[0.9, 2.6], [2.8, 4.4], [4.6, 6.0]] as const) drawer(p, F, a + 0.04, a + 0.44, z0, z1, WALNUT);
    }
    lbox(p, 0.62, 0.2, W - 1.24, 0.06, 1.2, Z - 2, mono(walnutV, WALNUT[0]));
    // the middle drawer over the kneehole
    lbox(p, 0.62, 0.22, W - 1.24, 0.64, Z - 1.6, 0.9, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    drawer(p, F, 0.66, W - 0.66, Z - 1.5, Z - 0.75, WALNUT);
    // the top: a moulded walnut edge round a green leather writing surface with gilt tooling
    lbox(p, 0.08, 0.1, W - 0.16, 0.82, Z - 0.7, 0.7, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    const tz = Z;
    poly3(p, [[0.2, 0.2, tz], [W - 0.2, 0.2, tz], [W - 0.2, 0.82, tz], [0.2, 0.82, tz]], (u: number, vv: number, x: number, y: number) => {
      if (u < 3 || vv < 2) return GILT[2];
      const g = hash(x, y, 9) < 0.06 ? 1 : 0;
      return at(GREENL, 3 + g - (hash(x >> 1, y, 7) < 0.12 ? 1 : 0));
    }, 2);
    if (v === 'dual') {
      // two slim screens on a brass twin arm, the star field and the light curve
      lbox(p, W / 2 - 0.08, 0.26, 0.16, 0.1, tz, 0.3, mono(brass, BRASS[1]));
      lbox(p, W / 2 - 0.025, 0.28, 0.05, 0.05, tz + 0.3, 3, mono(brass, BRASS[1]));
      for (const [a0, a1] of [[0.34, 0.98], [1.02, 1.66]] as const) {
        lbox(p, a0, 0.27, a1 - a0, 0.04, tz + 2.2, 4.6, mono(paint(IRONK), IRONK[0]));
        pq(p, front(p, 0.31), a0 + 0.03, a1 - 0.03, tz + 2.6, tz + 6.5, '#0c1222');
      }
      // keyboard, mouse, a printout of a plot, a mug, a brass desk clock, a little cactus
      const [kx, ky] = anchor(p, W / 2, 0.6, tz);
      layer(p.c, (l) => {
        fillPoly(l, [[kx - 18, ky + 2], [kx + 4, ky - 9], [kx + 18, ky - 2], [kx - 4, ky + 9]], '#3a3632');
        fillPoly(l, [[kx - 16, ky + 2], [kx + 4, ky - 8], [kx + 16, ky - 2], [kx - 4, ky + 8]], '#5a544c');
        for (let i = 0; i < 5; i++) ln(l, kx - 13 + i * 3, ky + 3 - i * 1.5, kx + 1 + i * 3, ky + 3 - i * 1.5 - 7, '#7a726a');
        ell(l, kx + 22, ky - 2, 3, 2, '#3a3632');
        const [sx, sy] = anchor(p, 0.4, 0.62, tz);
        fillPoly(l, [[sx - 12, sy], [sx, sy - 6], [sx + 12, sy], [sx, sy + 6]], '#f2ecdc');
        for (let i = 0; i < 6; i++) px(l, sx - 8 + i * 3, sy - 1 - Math.round(Math.sin(i) * 2), '#2a5aa8');
        ln(l, sx - 9, sy + 2, sx + 6, sy - 5, '#c8382a');
      });
      const [cx, cy] = anchor(p, W - 0.3, 0.42, tz);
      layer(p.c, (l) => {
        fillPoly(l, [[cx - 6, cy], [cx + 6, cy], [cx + 4, cy - 12], [cx - 4, cy - 12]], BRASS[3]);
        ell(l, cx, cy - 8, 4, 4, '#f6f0e0');
        px(l, cx, cy - 11, '#2a2a2a', 1, 3);
        px(l, cx, cy - 8, '#2a2a2a', 3, 1);
        const [mx, my] = anchor(p, W - 0.32, 0.72, tz);
        px(l, mx - 4, my - 9, '#2e4a6a', 8, 9);
        px(l, mx - 4, my - 9, '#4a6a8a', 2, 9);
        px(l, mx + 4, my - 7, '#2e4a6a', 3, 5);
        ell(l, mx, my - 9, 4, 1.5, '#4a2e1e');
      });
    } else {
      // a book rack along the back with leaning volumes held by brass ends
      lbox(p, 0.5, 0.18, 0.9, 0.18, tz, 0.4, mono(walnut, WALNUT[0]));
      bookRow(p, front(p, 0.3), 0.54, 1.36, tz + 0.4, 3.0, R);
      for (const a of [0.5, 1.38]) lbox(p, a, 0.2, 0.03, 0.12, tz + 0.4, 2.6, mono(brass, BRASS[1]));
      studentLamp(p, 0.26, 0.3, tz);
      // an open folio on a reading slope, a stack of books, inkwell and quill, a lens, tea
      const [fx, fy] = anchor(p, W * 0.55, 0.62, tz);
      layer(p.c, (l) => {
        fillPoly(l, [[fx - 20, fy + 3], [fx + 2, fy - 8], [fx + 22, fy + 1], [fx, fy + 12]], WALNUT[2]);
        fillPoly(l, [[fx - 19, fy], [fx + 1, fy - 10], [fx + 2, fy - 8], [fx - 18, fy + 2]], PARCH[4]);
        fillPoly(l, [[fx - 19, fy], [fx + 1, fy - 10], [fx + 21, fy - 1], [fx + 1, fy + 9]], PARCH[5]);
        ln(l, fx + 1, fy - 10, fx + 1, fy + 9, PARCH[2]);
        for (let i = 0; i < 5; i++) {
          ln(l, fx - 15 + i * 2, fy - 1 - i, fx - 5 + i * 2, fy - 6 - i, '#8a7a62');
          ln(l, fx + 4 + i * 2, fy - 4 + i, fx + 13 + i * 2, fy + i * 0.6, '#8a7a62');
        }
        // a little engraving of a comet on the right page
        ell(l, fx + 12, fy - 2, 2, 2, '#5a4a3a');
        ln(l, fx + 12, fy - 2, fx + 6, fy + 2, '#8a7a62');
      });
      const [bx, by] = anchor(p, W - 0.34, 0.36, tz);
      layer(p.c, (l) => {
        for (let i = 0; i < 4; i++) {
          const c = ['#6a1e1c', '#2e4a30', '#2a3e5a', '#7a5a2a'][(i + k.seed) % 4];
          const o = (i % 2) * 2 - 1;
          fillPoly(l, [[bx - 12 + o, by - i * 4], [bx + o, by - 6 - i * 4], [bx + 12 + o, by - i * 4], [bx + o, by + 6 - i * 4]], c);
          fillPoly(l, [[bx - 12 + o, by - i * 4], [bx + o, by + 6 - i * 4], [bx + o, by + 8 - i * 4], [bx - 12 + o, by + 2 - i * 4]], '#ece2c8');
          fillPoly(l, [[bx + o, by + 6 - i * 4], [bx + 12 + o, by - i * 4], [bx + 12 + o, by + 2 - i * 4], [bx + o, by + 8 - i * 4]], darken(c, 0.25));
        }
      });
      const [ix, iy] = anchor(p, 0.42, 0.66, tz);
      layer(p.c, (l) => {
        px(l, ix - 3, iy - 5, '#1e2430', 7, 5);
        px(l, ix - 2, iy - 6, '#3a4250', 5, 1);
        ln(l, ix + 1, iy - 6, ix + 8, iy - 20, '#f2ece0', 2);
        ln(l, ix + 5, iy - 13, ix + 9, iy - 21, '#d8d0c0', 1);
        // the magnifier
        ell(l, ix + 14, iy + 3, 4, 3, BRASS[3]);
        ell(l, ix + 14, iy + 3, 3, 2, '#cfe4ea');
        ln(l, ix + 17, iy + 5, ix + 22, iy + 8, WALNUT[3], 2);
      });
      const [tx, ty] = anchor(p, W - 0.3, 0.74, tz);
      layer(p.c, (l) => {
        ell(l, tx, ty, 6, 2.5, '#e8e2d4');
        px(l, tx - 3, ty - 6, '#f6f2e8', 7, 6);
        px(l, tx - 3, ty - 6, '#ffffff', 2, 6);
        px(l, tx + 4, ty - 5, '#e2dac8', 2, 3);
        ell(l, tx + 0.5, ty - 6, 3, 1.2, '#a8602a');
      });
    }
    // loose papers with a sketched mountain profile
    const [px0, py0] = anchor(p, 0.42, 0.42, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[px0 - 9, py0 + 1], [px0 + 1, py0 - 4], [px0 + 9, py0 + 1], [px0 - 1, py0 + 6]], '#f4eedd');
      ln(l, px0 - 6, py0 + 2, px0 - 2, py0 - 1, '#6a5a4a');
      ln(l, px0 - 2, py0 - 1, px0 + 1, py0 + 1, '#6a5a4a');
      ln(l, px0 + 1, py0 + 1, px0 + 5, py0 - 1, '#6a5a4a');
    });
    bankersChair(p, 0.6, 1.14, k.seed);
  },
  anim(p, k) {
    const v = k.variant ?? 'books';
    if (v === 'dual') {
      const kind = k.seed % 3;
      screenContent(p, 0.37, 0.95, 0.31, 7.4 + 2.6, 7.4 + 6.5, k.t, k.seed, kind);
      screenContent(p, 1.05, 1.63, 0.31, 7.4 + 2.6, 7.4 + 6.5, k.t, k.seed + 5, (kind + 1) % 3);
    } else lampGlow(p, 0.26, 0.3, 7.4, k.t, k.seed);
  },
};

// ── the natural-history specimen bench ──────────────────────
function microscope(p: PropPainter, a: number, b: number, z: number) {
  const [x, y] = anchor(p, a, b, z);
  layer(p.c, (l) => {
    // horseshoe foot, pillar, the curved arm, the stage, the tube with eyepiece, a mirror
    fillPoly(l, [[x - 9, y], [x - 4, y - 4], [x + 6, y - 4], [x + 10, y], [x + 2, y + 3]], IRONK[2]);
    fillPoly(l, [[x - 8, y - 1], [x - 4, y - 4], [x + 6, y - 4], [x + 8, y - 1]], IRONK[4]);
    px(l, x - 1, y - 12, BRASS[3], 4, 9);
    px(l, x - 1, y - 12, BRASS[6], 1, 9);
    ell(l, x + 2, y - 7, 3, 2.5, '#d8e4e8');
    ell(l, x + 1, y - 8, 1.5, 1, '#ffffff');
    fillPoly(l, [[x - 5, y - 13], [x + 7, y - 13], [x + 9, y - 15], [x - 3, y - 15]], IRONK[3]);
    curve(l, x - 2, y - 13, x - 9, y - 22, x - 3, y - 30, BRASS[3], 3);
    curve(l, x - 3, y - 13, x - 10, y - 22, x - 4, y - 30, BRASS[5], 1);
    // the tube leaning toward the user
    ln(l, x + 1, y - 17, x + 6, y - 34, BRASS[2], 5);
    ln(l, x, y - 17, x + 5, y - 34, BRASS[5], 1);
    px(l, x + 3, y - 39, IRONK[3], 5, 5);
    px(l, x + 4, y - 40, IRONK[5], 3, 1);
    // objectives on the nosepiece
    px(l, x - 1, y - 18, BRASS[4], 6, 2);
    px(l, x, y - 16, '#c8ccd0', 2, 3);
  });
}

const labbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7.1;
    footShadow(p, 0.06, 0.14, W - 0.06, 0.9, 8, 0.26);
    // the carcass: a long oak cabinet of many small specimen drawers on a plinth
    const oak = grain(ZIRBE);
    lbox(p, 0.1, 0.18, W - 0.2, 0.68, 0, 0.8, mono(paint(WALNUT), WALNUT[0]));
    lbox(p, 0.06, 0.14, W - 0.12, 0.74, 0.8, Z - 1.3, { front: oak, side: oak, top: oak, edge: ZIRBE[0] });
    const F = front(p, 0.88);
    const S = side(p, W - 0.06);
    const cols = Math.round(W * 4);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < cols; c++) {
        const a0 = 0.1 + ((W - 0.2) * c) / cols;
        const a1 = 0.1 + ((W - 0.2) * (c + 1)) / cols - 0.02;
        const z0 = 1.0 + r * 1.65;
        const z1 = z0 + 1.5;
        pq(p, F, a0, a1, z0, z1, ZIRBE[1]);
        pq(p, F, a0 + 0.015, a1 - 0.005, z0 + 0.12, z1 - 0.06, F.light ? ZIRBE[4] : ZIRBE[3]);
        // a brass card frame with a written label, a little knob
        pq(p, F, a0 + (a1 - a0) * 0.22, a0 + (a1 - a0) * 0.78, z0 + 0.8, z0 + 1.25, BRASS[3]);
        pq(p, F, a0 + (a1 - a0) * 0.27, a0 + (a1 - a0) * 0.73, z0 + 0.86, z0 + 1.18, '#f2ead6');
        const [kx, ky] = F.F((a0 + a1) / 2, z0 + 0.45);
        px(p.c, kx - 1, ky - 1, BRASS[2], 3, 2);
        px(p.c, kx - 1, ky - 1, BRASS[5], 1, 1);
      }
    // the side panel: a frame and a field
    pq(p, S, 0.24, 0.8, 1.2, Z - 0.8, darken(ZIRBE[2], 0.12));
    pt(p, S, 0.28, 0.76, 1.4, Z - 1, grain(ZIRBE, 'v'), S.light);
    // the worktop: black slate in an oak frame
    lbox(p, 0.02, 0.1, W - 0.04, 0.82, Z - 0.5, 0.5, { front: oak, side: oak, top: paint(SLATE), edge: ZIRBE[0] });
    const tz = Z;
    // slot 1: the brass microscope, a slide box, petri dishes
    microscope(p, 0.72, 0.42, tz);
    const [sx, sy] = anchor(p, 0.42, 0.66, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[sx - 9, sy], [sx, sy - 5], [sx + 9, sy], [sx, sy + 5]], WALNUT[4]);
      fillPoly(l, [[sx - 9, sy], [sx, sy + 5], [sx, sy + 8], [sx - 9, sy + 3]], WALNUT[2]);
      fillPoly(l, [[sx, sy + 5], [sx + 9, sy], [sx + 9, sy + 3], [sx, sy + 8]], WALNUT[1]);
      for (let i = 0; i < 4; i++) ln(l, sx - 6 + i * 3, sy + 1 - i * 1.5, sx - 2 + i * 3, sy - 1 - i * 1.5, '#d8e8ec');
      for (const [dx, dy] of [[16, 6], [24, 2]] as const) {
        ell(l, sx + dx, sy + dy, 6, 2.5, '#b8d4dc');
        ell(l, sx + dx, sy + dy - 1, 5, 1.8, '#e2f0f2');
        ell(l, sx + dx + 1, sy + dy - 1, 2, 1, '#8aa84a');
      }
    });
    // the middle: tall specimen jars (a fern, a salamander, gentians) and a brass balance
    const jars: [number, string, string][] = [[1.2, '#c8d890', '#5a8a3a'], [1.42, '#d8c890', '#3a3a30'], [1.62, '#c0d4dc', '#3050c8']];
    for (const [a, liq, spec] of jars) {
      const [jx, jy] = anchor(p, a, 0.3, tz);
      layer(p.c, (l) => {
        px(l, jx - 5, jy - 20, '#d8ecf0', 10, 20);
        px(l, jx - 4, jy - 16, liq, 8, 16);
        px(l, jx - 5, jy - 20, '#ffffff', 1, 19);
        if (spec === '#3a3a30') {
          curve(l, jx - 2, jy - 4, jx + 2, jy - 10, jx - 1, jy - 14, '#2a2a22', 2);
          px(l, jx - 2, jy - 14, '#e8b030', 2, 1);
        } else for (let i = 0; i < 4; i++) ln(l, jx, jy - 2, jx - 3 + i * 2, jy - 12 + (i % 2) * 2, spec);
        px(l, jx - 6, jy - 23, WALNUT[3], 12, 3);
        px(l, jx - 4, jy - 10, '#f2ead6', 8, 3);
      });
    }
    const [gx, gy] = anchor(p, 1.95, 0.4, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[gx - 7, gy], [gx + 7, gy], [gx + 5, gy - 3], [gx - 5, gy - 3]], WALNUT[3]);
      px(l, gx - 1, gy - 22, BRASS[3], 2, 19);
      ln(l, gx - 12, gy - 21, gx + 12, gy - 23, BRASS[4], 2);
      for (const s of [-1, 1]) {
        ln(l, gx + s * 12, gy - 21, gx + s * 10, gy - 12, BRASS[2]);
        ln(l, gx + s * 12, gy - 21, gx + s * 14, gy - 12, BRASS[2]);
        ell(l, gx + s * 12, gy - 11, 5, 2, BRASS[3]);
        ell(l, gx + s * 12, gy - 12, 4, 1, BRASS[5]);
      }
      ell(l, gx - 12, gy - 13, 2, 1.5, '#8a6a4a');
    });
    // slot 2: a tray of labelled minerals, a hand lens, a field notebook with a sketch
    const [mx, my] = anchor(p, 2.32, 0.6, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[mx - 20, my], [mx, my - 10], [mx + 20, my], [mx, my + 10]], WALNUT[4]);
      fillPoly(l, [[mx - 20, my], [mx, my + 10], [mx, my + 13], [mx - 20, my + 3]], WALNUT[2]);
      fillPoly(l, [[mx, my + 10], [mx + 20, my], [mx + 20, my + 3], [mx, my + 13]], WALNUT[1]);
      const minerals = ['#e8e0f0', '#8a5ab8', '#3a8a5a', '#c8a040', '#a8382a', '#e8e8e0', '#4a6a9a', '#d8b0a0', '#2a2a2a', '#c06a3a', '#7ab0c0', '#f0d870'];
      for (let i = 0; i < 12; i++) {
        const c = i % 4;
        const r = Math.floor(i / 4);
        const cx = mx - 13 + c * 6.5 + r * 2.5;
        const cy = my - 3 + r * 3.2 - c * 2.5;
        fillPoly(l, [[cx - 3, cy], [cx, cy - 2], [cx + 3, cy], [cx, cy + 2]], '#f4ecd8');
        dotFruit(l, cx, cy - 1, minerals[i], 3);
      }
    });
    const [nx, ny] = anchor(p, 2.62, 0.3, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[nx - 10, ny], [nx, ny - 5], [nx + 10, ny], [nx, ny + 5]], '#3a5a3a');
      fillPoly(l, [[nx - 9, ny], [nx, ny - 4], [nx + 9, ny], [nx, ny + 4]], '#f2ead6');
      ln(l, nx - 5, ny + 1, nx + 2, ny - 3, '#5a4a3a');
      ell(l, nx + 1, ny + 1, 2, 1, '#3050c8');
      ln(l, nx + 6, ny - 6, nx + 13, ny - 2, '#c8a040', 1);
    });
  },
};

// ── the Wardian cases (experimental greenhouses) ───────────
const IRONG: Ramp = ['#0e1a14', '#16261e', '#1e3428', '#284434', '#345642', '#466a52'];

/** Ferns: arching fronds with leaflets. */
function fern(l: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, ramp: Ramp) {
  const R = rng(seed);
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI / 2 + (i - 4) * 0.34 + (R() - 0.5) * 0.2;
    const len = (14 + R() * 8) * s;
    const ex = x + Math.cos(ang) * len * 1.3;
    const ey = y + Math.sin(ang) * len * 0.8 + len * 0.25;
    const mx = x + Math.cos(ang) * len * 0.7;
    const my = y + Math.sin(ang) * len * 0.9 - 2;
    curve(l, x, y, mx, my, ex, ey, ramp[2], 1);
    for (let j = 1; j < 7; j++) {
      const t = j / 7;
      const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
      const qy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
      const w = Math.round((1 - t) * 4 * s) + 1;
      px(l, qx - w, qy, ramp[3 + (j % 2)], w, 1);
      px(l, qx + 1, qy - 1, ramp[4 + (j % 2)], w, 1);
    }
  }
}

const terrarium: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const alpine = k.seed % 2 === 1;
    footShadow(p, 0.15, 0.2, W - 0.15, D - 0.15, 24, 0.26);
    const g = paint(IRONG);
    // the stand: four cast-iron legs, a stretcher shelf with stacked pots
    for (const [a, b] of [[0.24, 0.3], [W - 0.32, 0.3], [0.24, D - 0.36], [W - 0.32, D - 0.36]] as const) lbox(p, a, b, 0.08, 0.08, 0, 6, mono(g, IRONG[0]));
    lbox(p, 0.26, 0.32, W - 0.56, D - 0.66, 1.4, 0.3, mono(g, IRONG[0]));
    for (let i = 0; i < 3; i++) {
      const [qx, qy] = anchor(p, 0.6 + i * 0.36, D - 0.55, 1.7);
      layer(p.c, (l) => {
        for (let j = 0; j < 3 - (i % 2); j++) {
          fillPoly(l, [[qx - 7, qy - j * 4], [qx + 7, qy - j * 4], [qx + 6, qy - j * 4 - 7], [qx - 6, qy - j * 4 - 7]], TERRA[3 - (j % 2)]);
          px(l, qx - 7, qy - j * 4 - 8, TERRA[4], 14, 2);
        }
      });
    }
    // the planting tray: a zinc-lined larch box of soil and moss
    const tray = grain(LARCHF);
    lbox(p, 0.18, 0.24, W - 0.36, D - 0.48, 6, 2.6, { front: tray, side: tray, top: (light) => (u: number, v: number, x: number, y: number) => at(['#2a2014', '#3a2c1c', '#4a5a2a', '#5a6e30', '#6e8238'], (light ? 2 : 1) + (hash(x >> 1, y, 3) < 0.4 ? 1 : 0) + (hash(x, y, 4) < 0.08 ? 1 : 0) - (u + v < 0 ? 1 : 0)), edge: LARCHF[0] });
    const tz = 8.6;
    const zr = 20;
    const zp = 27;
    const a0 = 0.22;
    const a1 = W - 0.22;
    const b0 = 0.28;
    const b1 = D - 0.28;
    const bm = (b0 + b1) / 2;
    // the back bars (seen through the glass)
    const bar = (pts: [number, number, number][]) => {
      const [x0, y0] = p.P(...pts[0]);
      const [x1, y1] = p.P(...pts[1]);
      ln(p.c, x0, y0, x1, y1, IRONG[2], 2);
    };
    for (let i = 0; i <= 4; i++) bar([[a0 + ((a1 - a0) * i) / 4, b0, tz], [a0 + ((a1 - a0) * i) / 4, b0, zr]]);
    for (let i = 0; i <= 4; i++) bar([[a0, b0 + ((b1 - b0) * i) / 4, tz], [a0, b0 + ((b1 - b0) * i) / 4, zr]]);
    bar([[a0, b0, zr], [a1, b0, zr]]);
    bar([[a0, b0, zr], [a0, b1, zr]]);
    // the plants inside
    const R = rng(k.seed * 5 + 11);
    if (alpine) {
      // an alpine garden: rocks, cushions of saxifrage, gentians, edelweiss, a dwarf pine
      for (let i = 0; i < 6; i++) {
        const [rx, ry] = anchor(p, a0 + 0.2 + R() * (a1 - a0 - 0.4), b0 + 0.2 + R() * (b1 - b0 - 0.4), tz);
        layer(p.c, (l) => {
          ell(l, rx, ry - 3, 7 + R() * 5, 4 + R() * 3, '#7c7a76');
          ell(l, rx - 2, ry - 5, 4, 2, '#a8a49c');
        });
      }
      for (let i = 0; i < 12; i++) {
        const [cx, cy] = anchor(p, a0 + 0.12 + R() * (a1 - a0 - 0.24), b0 + 0.12 + R() * (b1 - b0 - 0.24), tz);
        const flower = ['#3050c8', '#f2eee2', '#e86a9a', '#f0c830'][i % 4];
        layer(p.c, (l) => {
          foliage(l, [{ x: cx, y: cy - 3, rx: 6, ry: 4, z: 1 }], ['#1e3a22', '#284a28', '#33602e', '#457a38', '#5a9442', '#78ae50'], k.seed + i, { cell: 2, dots: [flower], dotChance: 0.9, dotSize: 3 });
        }, { outline: 0.5 });
      }
      const [px0, py0] = anchor(p, a0 + 0.5, bm, tz);
      layer(p.c, (l) => {
        ln(l, px0, py0, px0 + 2, py0 - 18, '#4a3222', 3);
        foliage(l, [{ x: px0 + 2, y: py0 - 22, rx: 11, ry: 7, z: 1 }, { x: px0 - 6, y: py0 - 14, rx: 7, ry: 5, z: 0 }, { x: px0 + 9, y: py0 - 15, rx: 7, ry: 5, z: 0 }], ['#0c201c', '#122c24', '#1a3a2c', '#234a34', '#2e5c3e', '#3e6e48', '#548258'], k.seed + 7, { cell: 2.4 });
      });
    } else {
      // a fernery: big ferns, mosses, a tiny tree fern, a few fruiting bodies
      for (let i = 0; i < 5; i++) {
        const [fx, fy] = anchor(p, a0 + 0.3 + (i % 3) * ((a1 - a0 - 0.6) / 2) + (R() - 0.5) * 0.2, b0 + 0.35 + Math.floor(i / 3) * 0.6 + R() * 0.2, tz);
        layer(p.c, (l) => fern(l, fx, fy, 1 + R() * 0.4, k.seed * 3 + i, ['#14301a', '#1e4222', '#2a5a2a', '#3a7432', '#4e8c3a', '#6aa448', '#8cbc5a']), { outline: 0.45 });
      }
      for (let i = 0; i < 10; i++) {
        const [mx, my] = anchor(p, a0 + 0.1 + R() * (a1 - a0 - 0.2), b0 + 0.1 + R() * (b1 - b0 - 0.2), tz);
        layer(p.c, (l) => foliage(l, [{ x: mx, y: my - 2, rx: 5, ry: 3, z: 1 }], ['#2a4a1a', '#3a5e22', '#4a742a', '#5e8a32', '#78a43e', '#96bc50'], k.seed + i * 3, { cell: 1.8 }));
      }
    }
    // glass walls (front and side) over the plants: a pale tint, reflections, iron bars
    const F = front(p, b1);
    const S = side(p, a1);
    p.c.globalAlpha = 0.28;
    pt(p, F, a0, a1, tz, zr, (u: number, v: number) => ((u * 0.7 + v) % 46 < 7 ? '#ffffff' : GLASSG[5]), F.light);
    pt(p, S, b0, b1, tz, zr, (u: number, v: number) => ((u * 0.7 + v) % 46 < 7 ? '#ffffff' : GLASSG[4]), S.light);
    p.c.globalAlpha = 0.5;
    pt(p, F, a0, a1, tz, zr, (u: number, v: number) => ((u * 0.7 + v) % 46 < 3 ? '#ffffff' : null), F.light);
    p.c.globalAlpha = 1;
    // the roof: two glazed slopes, a ridge with a cresting, finials, an open vent
    const roofTex = (light: number) => (u: number, v: number) => ((u * 0.6 + v) % 40 < 5 ? '#f4fbf8' : light ? GLASSG[5] : GLASSG[4]);
    p.c.globalAlpha = 0.4;
    poly3(p, [[a0, b1, zr], [a1, b1, zr], [a1, bm, zp], [a0, bm, zp]], roofTex(1), 1);
    poly3(p, [[a1, b1, zr], [a1, b0, zr], [a1, bm, zp]], roofTex(0), 0);
    p.c.globalAlpha = 1;
    const B = (q0: [number, number, number], q1: [number, number, number], col = IRONG[3], w = 2) => {
      const [x0, y0] = p.P(...q0);
      const [x1, y1] = p.P(...q1);
      ln(p.c, x0, y0, x1, y1, col, w);
    };
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4;
      B([a, b1, tz], [a, b1, zr]);
      B([a, b1, zr], [a, bm, zp], IRONG[4], 1);
    }
    for (let i = 0; i <= 3; i++) B([a1, b0 + ((b1 - b0) * i) / 3, tz], [a1, b0 + ((b1 - b0) * i) / 3, zr]);
    B([a0, b1, tz], [a1, b1, tz], IRONG[2], 3);
    B([a1, b1, tz], [a1, b0, tz], IRONG[1], 3);
    B([a0, b1, zr], [a1, b1, zr], IRONG[4], 2);
    B([a1, b1, zr], [a1, b0, zr], IRONG[3], 2);
    B([a1, b1, zr], [a1, bm, zp], IRONG[3], 2);
    B([a1, b0, zr], [a1, bm, zp], IRONG[3], 2);
    B([a0, bm, zp], [a1, bm, zp], IRONG[4], 2);
    // the ridge cresting and finials
    for (let i = 0; i <= 8; i++) {
      const [cx, cy] = p.P(a0 + ((a1 - a0) * i) / 8, bm, zp);
      px(p.c, cx, cy - 4, IRONG[3], 1, 4);
      if (i % 2 === 0) px(p.c, cx - 1, cy - 5, IRONG[4], 3, 1);
    }
    for (const a of [a0, a1]) {
      const [fx, fy] = p.P(a, bm, zp);
      layer(p.c, (l) => {
        px(l, fx - 1, fy - 10, IRONG[3], 3, 10);
        ell(l, fx, fy - 11, 2.5, 2.5, BRASS[4]);
        px(l, fx - 1, fy - 12, BRASS[6], 1, 1);
      });
    }
    // the open roof vent, propped on a stay
    const v0 = a0 + (a1 - a0) * 0.55;
    const v1 = v0 + (a1 - a0) * 0.22;
    poly3(p, [[v0, b1 - 0.35, zr + 3.6], [v1, b1 - 0.35, zr + 3.6], [v1, bm + 0.05, zp + 2.6], [v0, bm + 0.05, zp + 2.6]], (u: number, v: number) => ((u + v) % 18 < 3 ? '#ffffff' : GLASSG[5]), 1);
    B([v0, b1 - 0.35, zr + 3.6], [v1, b1 - 0.35, zr + 3.6], IRONG[4], 2);
    // a brass thermometer on the front post and an enamel label on the tray
    const [tx, ty] = p.P(a1 - 0.02, b1, tz + 6);
    px(p.c, tx - 2, ty - 10, BRASS[3], 4, 12);
    px(p.c, tx - 1, ty - 9, '#f6f2e8', 2, 9);
    px(p.c, tx - 1, ty - 4, '#c8382a', 2, 5);
    const LF = front(p, D - 0.24);
    pq(p, LF, W / 2 - 0.22, W / 2 + 0.22, 6.8, 8, '#f2ead6');
    pq(p, LF, W / 2 - 0.16, W / 2 + 0.16, 7.2, 7.5, '#2a3a4a');
  },
};

// ── the seedling bench under grow lights ────────────────────
const hydro: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.14, W - 0.08, 0.9, 10, 0.24);
    const wood = grain(LARCHF);
    const woodV = grain(LARCHF, 'v');
    // legs, a slatted lower shelf with a stack of trays and a sack of compost
    for (const [a, b] of [[0.1, 0.18], [W - 0.18, 0.18], [0.1, 0.78], [W - 0.18, 0.78]] as const) lbox(p, a, b, 0.08, 0.08, 0, 7, mono(woodV, LARCHF[0]));
    for (let i = 0; i < 4; i++) lbox(p, 0.12, 0.2 + i * 0.16, W - 0.24, 0.12, 2, 0.3, mono(wood, LARCHF[0]));
    lbox(p, 0.3, 0.3, 0.5, 0.42, 2.3, 1.6, mono(paint(['#1e1a16', '#2a2420', '#36302a', '#423a32', '#4e463c', '#5a5248']), '#141210'));
    lbox(p, W - 0.8, 0.32, 0.44, 0.4, 2.3, 2.6, { front: (light) => (_u: number, v: number, x: number, y: number) => at(['#6a5a3a', '#86744e', '#a28e62', '#bca678', '#d0bc8e'], (light ? 2.6 : 1.6) + (hash(x, y, 5) < 0.08 ? -1 : 0) + (v > 6 && v < 8 ? 1 : 0)), side: (light) => () => (light ? '#a28e62' : '#86744e'), top: (_l) => () => '#bca678', edge: '#4a3e2a' });
    // the bench top and the raised back tier
    lbox(p, 0.06, 0.14, W - 0.12, 0.78, 7, 0.5, { front: wood, side: wood, top: wood, edge: LARCHF[0] });
    lbox(p, 0.1, 0.16, W - 0.2, 0.26, 7.5, 3.4, { front: woodV, side: woodV, top: wood, edge: LARCHF[0] });
    // seed trays: soil, rows of sprouts at different stages, white labels
    const R = rng(k.seed * 7 + 1);
    const sprout = (x: number, y: number, h: number) => {
      ln(p.c, x, y, x, y - h, '#4a7a2a');
      px(p.c, x - 2, y - h - 1, '#6aa83a', 2, 1);
      px(p.c, x + 1, y - h - 1, '#8cc44a', 2, 1);
      if (h > 4) {
        px(p.c, x - 3, y - h + 2, '#5a9a32', 2, 1);
        px(p.c, x + 1, y - h + 1, '#7ab83e', 3, 1);
      }
    };
    for (let t = 0; t < 2; t++) {
      const ta = 0.16 + t * ((W - 0.32) / 2);
      const tw = (W - 0.32) / 2 - 0.04;
      lbox(p, ta, 0.46, tw, 0.4, 7.5, 0.9, { front: paint(['#1e1a16', '#2a2420', '#36302a', '#423a32', '#4e463c', '#5a5248']), side: paint(['#1e1a16', '#2a2420', '#36302a', '#423a32', '#4e463c', '#5a5248']), top: (_l) => (_u: number, _v: number, x: number, y: number) => (hash(x, y, 8) < 0.3 ? '#4a3420' : '#3a2818'), edge: '#141210' });
      const stage = (k.seed + t) % 3;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 5; c++) {
          const [sx, sy] = anchor(p, ta + 0.08 + c * (tw - 0.12) / 4, 0.52 + r * 0.13, 8.4);
          if (R() < 0.1) continue;
          sprout(sx, sy, 2 + stage * 2 + Math.floor(R() * 3));
        }
      const [lx, ly] = anchor(p, ta + tw - 0.05, 0.84, 8.4);
      px(p.c, lx, ly - 7, '#f6f2e8', 2, 7);
      px(p.c, lx - 1, ly - 8, '#f6f2e8', 4, 2);
    }
    // little pots on the back tier with young plants
    for (let i = 0; i < 6; i++) {
      const [qx, qy] = anchor(p, 0.24 + i * ((W - 0.48) / 5), 0.28, 10.9);
      layer(p.c, (l) => {
        fillPoly(l, [[qx - 5, qy - 7], [qx + 5, qy - 7], [qx + 4, qy], [qx - 4, qy]], TERRA[3]);
        px(l, qx - 5, qy - 8, TERRA[5], 10, 2);
        foliage(l, [{ x: qx, y: qy - 12, rx: 4 + (i % 3), ry: 4, z: 1 }], ['#1e3a1a', '#2a4e22', '#3a682a', '#4e8434', '#6aa040', '#8cbc52'], k.seed + i * 5, { cell: 2, dots: i % 3 === 1 ? ['#f2eee2'] : i % 3 === 2 ? ['#3050c8'] : undefined, dotChance: 0.6, dotSize: 2 });
      }, { outline: 0.5 });
    }
    // the frame and the grow-light bar
    for (const a of [0.1, W - 0.18]) lbox(p, a, 0.16, 0.08, 0.08, 10.9, 13.4, mono(woodV, LARCHF[0]));
    lbox(p, 0.06, 0.14, W - 0.12, 0.1, 23.8, 0.6, mono(wood, LARCHF[0]));
    for (const a of [0.5, W - 0.5]) {
      const [x0, y0] = p.P(a, 0.2, 23.8);
      const [x1, y1] = p.P(a, 0.5, 21.6);
      ln(p.c, x0, y0, x1, y1, '#2a2a2e');
    }
    lbox(p, 0.22, 0.3, W - 0.44, 0.4, 21, 0.6, { front: paint(['#1e1e24', '#2a2a32', '#36363e', '#44444c', '#54545c', '#64646c']), side: paint(['#1e1e24', '#2a2a32', '#36363e', '#44444c', '#54545c', '#64646c']), top: paint(['#2a2a32', '#36363e', '#44444c', '#54545c', '#64646c', '#74747c']), edge: '#141418' });
    // a copper watering can and a mister on the floor at the end
    const [cx, cy] = anchor(p, W - 0.22, 0.98, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[cx - 6, cy], [cx + 6, cy], [cx + 5, cy - 11], [cx - 5, cy - 11]], COPPER[3]);
      px(l, cx - 6, cy - 11, COPPER[1], 2, 11);
      px(l, cx - 4, cy - 10, COPPER[5], 2, 9);
      ln(l, cx + 5, cy - 4, cx + 14, cy - 13, COPPER[3], 2);
      ell(l, cx + 15, cy - 14, 2, 2, COPPER[4]);
      curve(l, cx - 4, cy - 11, cx, cy - 18, cx + 4, cy - 11, COPPER[2], 2);
    });
  },
  anim(p, k) {
    // the grow lights: a magenta pool over the trays, softly pulsing
    const W = k.w;
    const [x0, y0] = anchor(p, 0.3, 0.5, 21);
    const [x1, y1] = anchor(p, W - 0.3, 0.5, 21);
    const u = p.k / 4;
    const pulse = 0.85 + Math.sin(k.t * 2 + k.seed) * 0.15;
    // the lit underside of the bar
    ln(p.c, x0, y0 + u, x1, y1 + u, '#f2a8f0', Math.max(1, Math.round(u)));
    p.c.globalAlpha = 0.06 * pulse;
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      ell(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 22 * u, 16 * u, 22 * u, '#e878e8');
    }
    p.c.globalAlpha = 1;
  },
};

// ── the briefing table: walnut, turned legs, a star chart spread out ──
const table: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 7.4;
    footShadow(p, 0.15, 0.2, W - 0.15, D - 0.15, 8, 0.26);
    // six turned legs: a foot, a bulbous melon, a neck
    for (const a of [0.28, W / 2 - 0.06, W - 0.4])
      for (const b of [0.3, D - 0.42]) {
        const [lx, ly] = anchor(p, a + 0.06, b + 0.06, 0);
        layer(p.c, (l) => {
          for (let j = 0; j < 23; j++) {
            const t = j / 23;
            const w = t < 0.08 ? 5 : t < 0.2 ? 3 : t < 0.55 ? 3 + Math.sin(((t - 0.2) / 0.35) * Math.PI) * 5 : t < 0.7 ? 3 : 4;
            for (let i = -w; i < w; i++) {
              const tt = (i + w) / (2 * w);
              px(l, lx + i, ly - j, WALNUT[tt < 0.25 ? 5 : tt < 0.55 ? 4 : tt < 0.8 ? 3 : 2]);
            }
          }
        }, { rect: [lx - 12, ly - 26, lx + 12, ly + 2] });
      }
    // the apron with a carved bead, the thick moulded top
    lbox(p, 0.22, 0.24, W - 0.44, D - 0.48, Z - 1.6, 1.1, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    const AF = front(p, D - 0.24);
    for (let a = 0.4; a < W - 0.4; a += 0.18) {
      const [bx, by] = AF.F(a, Z - 1.05);
      px(p.c, bx - 1, by - 1, WALNUT[5], 3, 2);
    }
    lbox(p, 0.08, 0.12, W - 0.16, D - 0.24, Z - 0.6, 0.6, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    const tz = Z;
    // the star chart: navy paper, a grid, stars, constellation lines, the ecliptic
    const c0 = 0.36;
    const c1 = W - 0.75;
    const d0 = 0.3;
    const d1 = D - 0.34;
    poly3(p, [[c0, d1, tz], [c1, d1, tz], [c1, d0, tz], [c0, d0, tz]], (u: number, v: number, x: number, y: number) => {
      if (u < 2.5 || v < 2.5) return '#d8cca8';
      const gx = u % 34;
      const gy = v % 20;
      if (gx < 0.8 || gy < 0.8) return '#2e3e6a';
      const h = hash(Math.floor(u), Math.floor(v), 31);
      if (h < 0.012) return '#fff6d8';
      if (h < 0.03) return '#a8b8e0';
      if (Math.abs(v - (28 + Math.sin(u * 0.03) * 16)) < 0.7) return '#c8a050';
      return hash(x, y, 32) < 0.04 ? '#1e2a52' : '#18224a';
    }, 2);
    // a constellation drawn over it (the Plough)
    const st: [number, number][] = [[0.6, 0.6], [0.85, 0.52], [1.08, 0.58], [1.3, 0.7], [1.36, 1.0], [1.65, 1.06], [1.62, 0.78]];
    for (let i = 0; i < st.length - 1; i++) {
      const [x0, y0] = anchor(p, st[i][0], st[i][1], tz);
      const [x1, y1] = anchor(p, st[i + 1][0], st[i + 1][1], tz);
      ln(p.c, x0, y0, x1, y1, '#7a8ac8');
    }
    for (const [a, b] of st) {
      const [sx, sy] = anchor(p, a, b, tz);
      px(p.c, sx - 1, sy, '#fff6d8', 3, 1);
      px(p.c, sx, sy - 1, '#fff6d8', 1, 3);
    }
    // brass weights on the corners, dividers, a lying telescope, rolled maps, a notebook, tea
    for (const [a, b] of [[c0 + 0.06, d1 - 0.06], [c1 - 0.06, d1 - 0.06], [c0 + 0.06, d0 + 0.06], [c1 - 0.06, d0 + 0.06]] as const) {
      const [wx, wy] = anchor(p, a, b, tz);
      layer(p.c, (l) => {
        ell(l, wx, wy - 1, 4, 2, BRASS[2]);
        px(l, wx - 4, wy - 5, BRASS[3], 8, 4);
        ell(l, wx, wy - 5, 4, 2, BRASS[5]);
        px(l, wx - 1, wy - 8, BRASS[4], 2, 3);
      }, { rect: [wx - 8, wy - 12, wx + 8, wy + 4] });
    }
    const [dx, dy] = anchor(p, 1.25, 0.95, tz);
    ln(p.c, dx, dy - 1, dx - 9, dy + 6, '#c8ccd2');
    ln(p.c, dx, dy - 1, dx + 3, dy + 8, '#c8ccd2');
    px(p.c, dx - 1, dy - 3, BRASS[4], 3, 3);
    const [tx0, ty0] = anchor(p, 0.55, D - 0.5, tz + 0.8);
    const [tx1, ty1] = anchor(p, 1.25, D - 0.68, tz + 0.8);
    layer(p.c, (l) => {
      ln(l, tx0, ty0, tx1, ty1, BRASS[2], 6);
      ln(l, tx0, ty0 - 2, tx1, ty1 - 2, BRASS[5], 2);
      ln(l, tx0 + (tx1 - tx0) * 0.4, ty0 + (ty1 - ty0) * 0.4 - 3, tx0 + (tx1 - tx0) * 0.4, ty0 + (ty1 - ty0) * 0.4 + 3, BRASS[1], 1);
      ln(l, tx0 + (tx1 - tx0) * 0.7, ty0 + (ty1 - ty0) * 0.7 - 3, tx0 + (tx1 - tx0) * 0.7, ty0 + (ty1 - ty0) * 0.7 + 3, BRASS[1], 1);
      ell(l, tx1 + 1, ty1, 3, 3, BRASS[1]);
      ell(l, tx1 + 1, ty1, 2, 2, '#9ab8c4');
    });
    for (let i = 0; i < 3; i++) {
      const [rx0, ry0] = anchor(p, W - 0.62, 0.42 + i * 0.36, tz + 0.7 + (i === 1 ? 1.2 : 0));
      const [rx1, ry1] = anchor(p, W - 0.2, 0.36 + i * 0.36, tz + 0.7 + (i === 1 ? 1.2 : 0));
      const col = ['#e8dcbc', '#d8c8a0', '#f0e6cc'][i];
      layer(p.c, (l) => {
        ln(l, rx0, ry0, rx1, ry1, darken(col, 0.2), 6);
        ln(l, rx0, ry0 - 2, rx1, ry1 - 2, col, 3);
        ell(l, rx1 + 1, ry1 - 1, 3, 3, darken(col, 0.15));
        ell(l, rx1 + 1, ry1 - 1, 1.5, 1.5, darken(col, 0.35));
        px(l, rx0 + (rx1 - rx0) / 2, ry0 + (ry1 - ry0) / 2 - 3, '#a8382a', 2, 6);
      });
    }
    for (const [a, b] of [[0.32, 0.3], [W - 0.95, D - 0.25]] as const) {
      const [cx, cy] = anchor(p, a, b, tz);
      layer(p.c, (l) => {
        ell(l, cx, cy, 6, 2.5, '#e8e2d4');
        px(l, cx - 3, cy - 5, '#f6f2e8', 7, 5);
        px(l, cx - 3, cy - 5, '#ffffff', 2, 5);
        ell(l, cx + 0.5, cy - 5, 3, 1.2, '#a8602a');
        px(l, cx + 4, cy - 4, '#e2dac8', 2, 2);
      });
    }
    const [nx, ny] = anchor(p, W - 0.95, 0.4, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[nx - 10, ny], [nx, ny - 5], [nx + 10, ny], [nx, ny + 5]], '#6a1e1c');
      fillPoly(l, [[nx - 9, ny], [nx, ny - 4], [nx + 9, ny], [nx, ny + 4]], '#f2ead6');
      for (let i = 0; i < 3; i++) ln(l, nx - 6 + i * 2, ny + 1 - i, nx + 1 + i * 2, ny - 2 - i, '#7a6a5a');
      ln(l, nx + 3, ny + 4, nx + 12, ny, '#2a2a30');
    });
    void k;
  },
};

// ── the floor globe ─────────────────────────────────────────
const globe: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 3, 22, 7, 0.28);
    const K = p.k;
    const r = 0.25;
    const cz = 8.6;
    const cy = y - cz * K;
    // the tripod: three curved walnut legs, a stretcher with a compass, the horizon ring
    layer(p.c, (l) => {
      for (const [dx, dy] of [[-20, 4], [18, 6], [2, -6]] as const) {
        curve(l, x + dx * 0.25, y - 24, x + dx * 0.9, y - 16 + dy * 0.2, x + dx, y + dy, WALNUT[2], 4);
        curve(l, x + dx * 0.25 - 1, y - 24, x + dx * 0.9 - 1, y - 16 + dy * 0.2, x + dx - 1, y + dy, WALNUT[5], 1);
        ell(l, x + dx, y + dy, 3, 1.5, WALNUT[1]);
      }
      ell(l, x, y - 10, 9, 4, WALNUT[3]);
      ell(l, x, y - 11, 7, 3, PARCH[4]);
      ln(l, x - 5, y - 11, x + 5, y - 11, '#8a3a2a');
      ln(l, x, y - 13, x, y - 9, '#2a2a30');
      px(l, x - 1, y - 30, WALNUT[3], 3, 20);
    });
    // the back half of the horizon ring and the meridian
    const ring = (front2: boolean) => {
      const R0 = r * 1.45;
      for (let i = 0; i < 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        const ax = Math.cos(a) * R0;
        const ay = Math.sin(a) * R0;
        const fr = ax + ay > 0;
        if (fr !== front2) continue;
        const sx = x + (ax - ay) * 16 * K;
        const sy = cy + (ax + ay) * 8 * K;
        px(p.c, sx - 1, sy - 1, fr ? PARCH[4] : PARCH[2], 3, 2);
        px(p.c, sx - 1, sy + 1, WALNUT[fr ? 3 : 1], 3, 2);
        if (i % 5 === 0 && fr) px(p.c, sx, sy - 1, '#5a4a3a', 1, 1);
      }
    };
    const meridian = (front2: boolean) => {
      // a vertical brass circle in the plane through the tilted axis (along a − b)
      const R0 = r * 1.18;
      const tilt = 0.41;
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        const u = Math.cos(a) * R0;
        const zz = Math.sin(a) * R0 * 16;
        // rotate by the tilt in the u–z plane
        const ur = u * Math.cos(tilt) - (zz / 16) * Math.sin(tilt);
        const zr = (u * Math.sin(tilt) + (zz / 16) * Math.cos(tilt)) * 16;
        const ax = ur * 0.7071;
        const ay = -ur * 0.7071;
        const fr = Math.sin(a + 0.5) > -0.2;
        if (fr !== front2) continue;
        const sx = x + (ax - ay) * 16 * K;
        const sy = cy + (ax + ay) * 8 * K - zr * K;
        px(p.c, sx - 1, sy - 1, front2 ? BRASS[4] : BRASS[2], 2, 2);
      }
    };
    ring(false);
    meridian(false);
    // the sphere: aged parchment oceans, continents, a graticule, varnish sheen
    const tilt = 0.41;
    sphere(p.c, K, x, cy, r, (nx, ny, nz, px2, py2) => {
      // into the globe's frame: rotate about the a+b axis by the tilt
      const ux = (nx - ny) * 0.7071;
      const uy = (nx + ny) * 0.7071;
      const ex = ux * Math.cos(tilt) + nz * Math.sin(tilt);
      const ez = -ux * Math.sin(tilt) + nz * Math.cos(tilt);
      const lat = Math.asin(Math.max(-1, Math.min(1, ez)));
      const lon = Math.atan2(uy, ex) + k.seed * 0.7;
      const land = Math.sin(lon * 2.1 + Math.sin(lat * 3) * 1.4) + Math.sin(lat * 3.6 + lon) * 0.7 + Math.sin(lon * 5 - lat * 2) * 0.3 > 0.55;
      const l = lightOf(nx, ny, nz);
      const grid = Math.abs((lat / 0.5236) % 1) < 0.06 || Math.abs(((lon / 0.5236) % 1 + 1) % 1) < 0.05;
      const ramp: Ramp = land ? ['#6a4a26', '#8a6432', '#a8803e', '#c49c50', '#d8b466', '#e8cc84'] : ['#3a5650', '#4e6e62', '#668876', '#82a28a', '#9cb89e', '#b8ccb0'];
      let t = toneOf(ramp, l, px2, py2, 0.3, 0.75);
      if (grid) t = Math.max(0, t - 1);
      if (land && Math.abs(lat) > 1.15) return '#e8e6dc';
      if (l > 0.82 && (px2 + py2) % 3 === 0) return '#fff6dc';
      return ramp[t];
    });
    meridian(true);
    ring(true);
    // the brass pivot at the north pole
    const top = p.P(0.5, 0.5, cz + r * 16 + 1);
    px(p.c, top[0] - 1, top[1] - 1, BRASS[5], 3, 3);
  },
};

// ── archive cases: ledgers, archive boxes, map drawers, scroll cubbies ──
const bookshelf: PropArt = {
  draw(p, k) {
    const W = k.w;
    const H = 22;
    footShadow(p, 0.04, 0.06, W - 0.04, 0.74, 16, 0.26);
    const kind = k.seed % 3;
    const R = rng(k.seed * 13 + 7);
    // the carcass: back, thick sides, a plinth and a projecting cornice
    lbox(p, 0.06, 0.06, W - 0.12, 0.08, 0, H, mono(walnutV, WALNUT[0]));
    for (const a of [0.04, W - 0.16]) lbox(p, a, 0.06, 0.12, 0.66, 0, H, { front: walnutV, side: walnutV, top: walnut, edge: WALNUT[0] });
    lbox(p, 0.16, 0.12, W - 0.32, 0.6, 0, 1.2, { front: paint(WALNUT), side: paint(WALNUT), top: walnut, edge: WALNUT[0] });
    // the lower part: plan-chest drawers or panelled cupboard doors
    const F = front(p, 0.72);
    lbox(p, 0.16, 0.12, W - 0.32, 0.6, 1.2, 6.2, { front: walnutV, side: walnutV, top: walnut, edge: WALNUT[0] });
    if (kind === 1) {
      const n = 2;
      for (let i = 0; i < n; i++) {
        const a0 = 0.2 + ((W - 0.4) * i) / n;
        const a1 = 0.2 + ((W - 0.4) * (i + 1)) / n - 0.03;
        pq(p, F, a0, a1, 1.5, 7.1, WALNUT[1]);
        pq(p, F, a0 + 0.03, a1 - 0.02, 1.7, 6.9, F.light ? WALNUT[4] : WALNUT[3]);
        pq(p, F, a0 + 0.1, a1 - 0.09, 2.3, 6.3, WALNUT[2]);
        pq(p, F, a0 + 0.12, a1 - 0.09, 2.5, 6.3, F.light ? WALNUT[5] : WALNUT[4]);
        const [kx, ky] = F.F(i === 0 ? a1 - 0.06 : a0 + 0.06, 4.6);
        px(p.c, kx - 1, ky - 3, BRASS[3], 3, 5);
        px(p.c, kx, ky - 2, BRASS[0], 1, 2);
      }
    } else
      for (let i = 0; i < 4; i++) {
        const z0 = 1.45 + i * 1.42;
        drawer(p, F, 0.2, W - 0.2, z0, z0 + 1.3, WALNUT);
        // label frames at both ends of the wide map drawers
        for (const a of [0.42, W - 0.42]) {
          pq(p, F, a - 0.1, a + 0.1, z0 + 0.75, z0 + 1.1, BRASS[3]);
          pq(p, F, a - 0.08, a + 0.08, z0 + 0.8, z0 + 1.05, '#f2ead6');
        }
      }
    // the shelves and what they hold
    const shelves = [7.4, 11.8, 16.2];
    for (let s = 0; s < shelves.length; s++) {
      const z = shelves[s];
      lbox(p, 0.16, 0.12, W - 0.32, 0.6, z, 0.4, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
      const SF = front(p, 0.6);
      const what = (kind + s) % 4;
      if (what === 2 && s < 2) {
        // a lattice of cubbies with rolled maps and charts
        const cols = Math.round((W - 0.36) / 0.3);
        for (let c = 0; c < cols; c++)
          for (let r = 0; r < 2; r++) {
            const a0 = 0.18 + ((W - 0.36) * c) / cols;
            const a1 = a0 + (W - 0.36) / cols;
            const z0 = z + 0.4 + r * 2;
            pq(p, SF, a0, a1, z0, z0 + 2, WALNUT[1]);
            pq(p, SF, a0 + 0.02, a1 - 0.02, z0 + 0.12, z0 + 1.9, '#1a0e08');
            for (let q = 0; q < 3; q++) {
              if (R() < 0.2) continue;
              const [qx, qy] = SF.F(a0 + 0.07 + q * 0.08, z0 + 0.55 + (q % 2) * 0.6);
              const col = ['#efe4c8', '#e2d2ac', '#f6ecd6', '#d8c49a'][Math.floor(R() * 4)];
              ell(p.c, qx, qy, 3.5, 3.5, darken(col, 0.2));
              ell(p.c, qx, qy, 2.5, 2.5, col);
              px(p.c, qx, qy, darken(col, 0.4));
            }
          }
      } else {
        bookRow(p, SF, 0.2, W - 0.2, z + 0.4, 4.0, R, { tall: what === 0 || s === 0, boxes: what === 1 ? 0.75 : what === 3 ? 0.35 : 0.05 });
      }
    }
    // the top shelf: a few boxes, a brass hourglass, an ammonite
    lbox(p, 0.16, 0.12, W - 0.32, 0.6, 20.6, 0.3, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    // the cornice with a little enamel plaque
    lbox(p, 0.0, 0.02, W, 0.78, H - 0.2, 1.4, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    pq(p, front(p, 0.8), W / 2 - 0.22, W / 2 + 0.22, H + 0.25, H + 0.95, BRASS[3]);
    pq(p, front(p, 0.8), W / 2 - 0.18, W / 2 + 0.18, H + 0.35, H + 0.85, '#f2ead6');
    pq(p, front(p, 0.8), W / 2 - 0.12, W / 2 + 0.12, H + 0.55, H + 0.65, '#2a2a30');
    const [ox, oy] = anchor(p, 0.4, 0.4, H + 1.2);
    layer(p.c, (l) => {
      if (kind === 0) {
        // an hourglass and a rolled chart
        px(l, ox - 5, oy - 2, BRASS[3], 10, 2);
        px(l, ox - 5, oy - 16, BRASS[3], 10, 2);
        fillPoly(l, [[ox - 4, oy - 14], [ox + 4, oy - 14], [ox, oy - 8], [ox + 4, oy - 2], [ox - 4, oy - 2], [ox, oy - 8]], '#d8ecf0');
        fillPoly(l, [[ox - 3, oy - 3], [ox + 3, oy - 3], [ox, oy - 6]], '#e8c870');
        ln(l, ox + 12, oy, ox + 30, oy - 9, '#e2d2ac', 4);
      } else if (kind === 1) {
        // an ammonite and a stack of boxes
        ell(l, ox, oy - 6, 7, 6, '#a89880');
        ell(l, ox, oy - 6, 4, 3.5, '#8a7a62');
        ell(l, ox, oy - 6, 1.5, 1.5, '#6a5a4a');
        fillPoly(l, [[ox + 10, oy - 2], [ox + 20, oy - 7], [ox + 30, oy - 2], [ox + 20, oy + 3]], '#a48c6c');
        fillPoly(l, [[ox + 10, oy - 2], [ox + 20, oy + 3], [ox + 20, oy + 9], [ox + 10, oy + 4]], '#8a7458');
      } else {
        // a stuffed alpine chough under a glass dome
        ell(l, ox, oy - 1, 8, 3, WALNUT[3]);
        px(l, ox - 7, oy - 18, '#d8ecf0', 14, 17);
        ell(l, ox, oy - 18, 7, 4, '#e8f4f6');
        ell(l, ox, oy - 8, 4, 4, '#1a1a20');
        ell(l, ox + 2, oy - 12, 2.5, 2.5, '#1a1a20');
        px(l, ox + 4, oy - 12, '#f0c830', 3, 1);
        px(l, ox - 6, oy - 17, '#ffffff', 1, 14);
      }
    });
    // a rolling library ladder on one case
    if (k.seed % 4 === 1) {
      const [lx0, ly0] = anchor(p, W * 0.7, 1.05, 0);
      const [lx1, ly1] = anchor(p, W * 0.7, 0.66, H);
      layer(p.c, (l) => {
        for (const s of [-7, 7]) ln(l, lx0 + s, ly0, lx1 + s, ly1, WALNUT[3], 2);
        for (let i = 1; i < 9; i++) {
          const t = i / 9;
          ln(l, lx0 - 7 + (lx1 - lx0) * t, ly0 + (ly1 - ly0) * t, lx0 + 7 + (lx1 - lx0) * t, ly0 + (ly1 - ly0) * t, WALNUT[4], 2);
        }
        ell(l, lx1, ly1 - 2, 3, 2, BRASS[4]);
      });
    }
  },
};

// ── the plum Chesterfield ───────────────────────────────────
/** Diamond button tufting across a face of a plane: a dimple and its creases. */
function tufting(p: PropPainter, F: ReturnType<typeof front>, a0: number, a1: number, z0: number, z1: number, r: Ramp, pitch = 0.2) {
  // a darker welt between the buttons gives the diamond pattern its depth
  const rows = Math.max(1, Math.round((z1 - z0) / 1.6));
  for (let j = 0; j < rows; j++) {
    const z = z0 + ((z1 - z0) * (j + 0.5)) / rows;
    const off = j % 2 ? pitch / 2 : 0;
    for (let a = a0 + pitch / 2 + off; a < a1 - 0.05; a += pitch) {
      const [x, y] = F.F(a, z);
      px(p.c, x - 1, y, r[0], 2, 2);
      px(p.c, x - 4, y - 2, r[1], 2, 1);
      px(p.c, x + 3, y + 2, r[1], 2, 1);
      px(p.c, x + 2, y - 3, r[4], 2, 1);
    }
  }
}

const sofa: PropArt = {
  draw(p, k) {
    const W = k.w;
    const col = k.color ?? '#9b7bea';
    const fr = around(mix(col, '#2a0c2e', 0.55));
    const L = leather(fr);
    const lm = { front: L, side: L, top: L, edge: fr[0] };
    footShadow(p, 0.06, 0.14, W - 0.06, 0.94, 6, 0.3);
    // bun feet in walnut
    for (const a of [0.14, W - 0.24])
      for (const b of [0.2, 0.8]) {
        const [fx, fy] = anchor(p, a + 0.05, b + 0.05, 0);
        ell(p.c, fx, fy - 2, 4, 3, WALNUT[2]);
        ell(p.c, fx - 1, fy - 3, 2, 1.5, WALNUT[4]);
      }
    // the base, the back as high as the arms, deep buttoned
    lbox(p, 0.08, 0.14, W - 0.16, 0.78, 1.0, 2.8, lm);
    lbox(p, 0.08, 0.14, W - 0.16, 0.26, 3.8, 4.0, lm);
    const BF = front(p, 0.4);
    tufting(p, BF, 0.38, W - 0.38, 4.0, 7.4, fr, 0.17);
    // the back's rolled top: a lit roll along its length
    const r0 = p.P(0.1, 0.27, 7.8);
    const r1 = p.P(W - 0.1, 0.27, 7.8);
    ln(p.c, r0[0], r0[1], r1[0], r1[1], fr[5], 2);
    ln(p.c, r0[0], r0[1] + 2, r1[0], r1[1] + 2, fr[4]);
    // seat cushions: a crease where they meet the back, gaps between them, a lit front edge
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a0 = 0.36 + ((W - 0.72) * i) / n;
      lbox(p, a0 + 0.015, 0.4, (W - 0.72) / n - 0.03, 0.5, 3.8, 1.1, lm);
      const cf = front(p, 0.9);
      const [x0, y0] = cf.F(a0 + 0.04, 4.8);
      const [x1, y1] = cf.F(a0 + (W - 0.72) / n - 0.05, 4.8);
      ln(p.c, x0, y0, x1, y1, fr[5]);
    }
    const c0 = p.P(0.36, 0.41, 4.9);
    const c1 = p.P(W - 0.36, 0.41, 4.9);
    ln(p.c, c0[0], c0[1], c1[0], c1[1], fr[0], 2);
    // the rolled arms: a box, a lit roll on top, the scroll and pleats on the front, a crease inside
    for (const a of [0.08, W - 0.36]) {
      lbox(p, a, 0.14, 0.28, 0.78, 3.8, 3.4, lm);
      const t0 = p.P(a + 0.14, 0.16, 7.4);
      const t1 = p.P(a + 0.14, 0.9, 7.4);
      ln(p.c, t0[0], t0[1], t1[0], t1[1], fr[5], 2);
      const inner = a < W / 2 ? a + 0.28 : a;
      const i0 = p.P(inner, 0.42, 4.9);
      const i1 = p.P(inner, 0.9, 4.9);
      ln(p.c, i0[0], i0[1], i1[0], i1[1], fr[0]);
      const AF = front(p, 0.92);
      const [cx, cy] = AF.F(a + 0.14, 6.2);
      layer(p.c, (l) => {
        ell(l, cx, cy, 8, 7, fr[1]);
        ell(l, cx - 1, cy - 1, 6, 5, fr[3]);
        for (let i = 0; i < 7; i++) {
          const ang = Math.PI * (0.1 + i * 0.13);
          ln(l, cx, cy, cx + Math.cos(ang) * 7, cy + Math.sin(ang) * 6, fr[1]);
        }
        ell(l, cx - 2, cy - 3, 2, 1.5, fr[5]);
        px(l, cx - 1, cy - 1, fr[0], 2, 2);
      }, { rect: [cx - 12, cy - 10, cx + 12, cy + 10] });
    }
    // brass nailheads along the base and up the arm fronts
    const NF = front(p, 0.92);
    for (let a = 0.12; a < W - 0.1; a += 0.06) {
      const [x, y] = NF.F(a, 1.4);
      px(p.c, x, y, BRASS[5], 1, 1);
      px(p.c, x, y + 1, BRASS[2], 1, 1);
    }
    for (const a of [0.1, W - 0.1])
      for (let z = 4; z < 7; z += 0.5) {
        const [x, y] = NF.F(a, z);
        px(p.c, x, y, BRASS[4], 1, 1);
      }
    // a tartan blanket over the left arm, an open book on the seat, a cushion
    const [tx, ty] = anchor(p, 0.22, 0.56, 7.4);
    layer(p.c, (l) => {
      fillPoly(l, [[tx - 10, ty - 6], [tx + 8, ty - 12], [tx + 12, ty + 12], [tx - 6, ty + 20]], '#7a1e1e');
      for (let i = 0; i < 5; i++) ln(l, tx - 8 + i * 4, ty - 6 - i * 1.4, tx - 4 + i * 4, ty + 18 - i * 1.6, '#2e4a30', 1);
      for (let i = 0; i < 4; i++) ln(l, tx - 9, ty - 2 + i * 5, tx + 10, ty - 8 + i * 5, '#c8a040', 1);
      for (let i = 0; i < 5; i++) px(l, tx - 4 + i * 4, ty + 20 - i * 1.8, '#7a1e1e', 1, 4);
    });
    const [qx, qy] = anchor(p, W - 0.62, 0.46, 5.2);
    layer(p.c, (l) => {
      fillPoly(l, [[qx - 9, qy + 2], [qx + 7, qy - 6], [qx + 9, qy - 17], [qx - 7, qy - 10]], '#a88a3a');
      fillPoly(l, [[qx - 8, qy + 1], [qx + 6, qy - 6], [qx + 8, qy - 16], [qx - 6, qy - 9]], '#d8b84a');
      ell(l, qx, qy - 7, 2, 2, '#a88a3a');
    });
    const [bx, by] = anchor(p, W * 0.55, 0.64, 4.9);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 10, by + 1], [bx, by - 5], [bx, by + 5]], '#f4ecd8');
      fillPoly(l, [[bx, by - 5], [bx + 10, by + 1], [bx, by + 5]], '#ece2c8');
      ln(l, bx, by - 5, bx, by + 5, '#8a7a62');
      fillPoly(l, [[bx - 11, by + 2], [bx, by + 6], [bx + 11, by + 2], [bx, by + 7]], '#2a3e5a');
    });
  },
};

// ── the cognac club chair ───────────────────────────────────
const armchair: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#c98a5a';
    const fr = around(mix(col, '#6a3418', 0.25));
    const L = leather(fr);
    const lm = { front: L, side: L, top: L, edge: fr[0] };
    footShadow(p, 0.12, 0.16, 0.88, 0.92, 7, 0.28);
    lbox(p, 0.16, 0.2, 0.68, 0.64, 0, 0.9, mono(paint(WALNUT), WALNUT[0]));
    lbox(p, 0.12, 0.16, 0.76, 0.72, 0.9, 3.2, lm);
    lbox(p, 0.28, 0.36, 0.44, 0.52, 4.1, 1.0, lm);
    // a deep rounded back and fat rolled arms
    lbox(p, 0.12, 0.16, 0.76, 0.22, 4.1, 4.6, lm);
    const BF = front(p, 0.38);
    const [rx, ry] = BF.F(0.5, 8.7);
    layer(p.c, (l) => {
      // the back's rounded top roll
      for (let i = -24; i <= 24; i++) {
        const h = Math.sqrt(Math.max(0, 1 - (i / 25) ** 2)) * 4;
        px(l, rx + i, ry - h, i < -6 ? fr[5] : i < 10 ? fr[4] : fr[3], 1, Math.ceil(h) + 1);
      }
    });
    for (const a of [0.12, 0.66]) {
      lbox(p, a, 0.16, 0.22, 0.72, 4.1, 2.6, lm);
      const AF = front(p, 0.88);
      const [cx, cy] = AF.F(a + 0.11, 5.6);
      layer(p.c, (l) => {
        ell(l, cx, cy, 6, 5, fr[2]);
        ell(l, cx - 1, cy - 1, 4, 3, fr[4]);
        ell(l, cx, cy, 1.5, 1.5, fr[1]);
      });
    }
    // creases in the old leather of the seat, a folded newspaper
    const [sx, sy] = anchor(p, 0.5, 0.62, 5.1);
    ln(p.c, sx - 8, sy, sx - 2, sy + 2, fr[1]);
    ln(p.c, sx + 2, sy - 3, sx + 7, sy - 1, fr[1]);
    const [nx, ny] = anchor(p, 0.78, 0.5, 6.7);
    layer(p.c, (l) => {
      fillPoly(l, [[nx - 6, ny], [nx + 2, ny - 4], [nx + 6, ny - 1], [nx - 2, ny + 3]], '#e8e2d2');
      ln(l, nx - 4, ny, nx + 2, ny - 3, '#5a5a60');
    });
  },
};

// ── the tea station: a painted alpine dresser and a brass samovar ──
/** A little painted bouquet (folk art) on a plane. */
function bouquet(p: PropPainter, F: ReturnType<typeof front>, a: number, z: number) {
  const [x, y] = F.F(a, z);
  const c = p.c;
  ln(c, x, y + 6, x, y - 2, '#3a6a3a');
  ln(c, x, y + 4, x - 4, y, '#3a6a3a');
  ln(c, x, y + 4, x + 4, y + 1, '#3a6a3a');
  for (const [dx, dy, col] of [[0, -4, '#c8382a'], [-5, -1, '#f2eee2'], [5, 0, '#c8382a'], [-2, 2, '#e8b030'], [3, -6, '#f2eee2']] as const) {
    px(c, x + dx - 1, y + dy, col, 3, 1);
    px(c, x + dx, y + dy - 1, col, 1, 3);
  }
}

const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.04, 0.1, W - 0.04, 0.92, 9, 0.26);
    const pb = paint(PAINTBLUE);
    lbox(p, 0.08, 0.16, W - 0.16, 0.7, 0, 0.8, mono(paint(WALNUT), WALNUT[0]));
    lbox(p, 0.06, 0.14, W - 0.12, 0.74, 0.8, Z - 1.4, { front: pb, side: pb, top: pb, edge: PAINTBLUE[0] });
    const F = front(p, 0.88);
    const S = side(p, W - 0.06);
    // two doors with painted panels and a row of drawers
    const n = Math.round(W);
    for (let i = 0; i < n; i++) {
      const a0 = 0.1 + ((W - 0.2) * i) / n;
      const a1 = 0.1 + ((W - 0.2) * (i + 1)) / n - 0.03;
      pq(p, F, a0, a1, 1.1, 5.9, PAINTBLUE[1]);
      pq(p, F, a0 + 0.03, a1 - 0.02, 1.3, 5.7, F.light ? PAINTBLUE[4] : PAINTBLUE[3]);
      pq(p, F, a0 + 0.09, a1 - 0.08, 1.8, 5.2, '#d8c8a0');
      pq(p, F, a0 + 0.11, a1 - 0.1, 2.0, 5.0, '#e8dcbc');
      bouquet(p, F, (a0 + a1) / 2, 3.6);
      const [kx, ky] = F.F(i % 2 ? a0 + 0.07 : a1 - 0.07, 3.6);
      px(p.c, kx - 1, ky - 1, WALNUT[2], 3, 3);
      px(p.c, kx - 1, ky - 1, WALNUT[5], 1, 1);
      pq(p, F, a0, a1, 6.1, 7.4, PAINTBLUE[1]);
      pq(p, F, a0 + 0.03, a1 - 0.02, 6.25, 7.25, F.light ? PAINTBLUE[4] : PAINTBLUE[3]);
      const [dx, dy] = F.F((a0 + a1) / 2, 6.8);
      px(p.c, dx - 1, dy - 1, WALNUT[2], 3, 2);
    }
    pq(p, S, 0.22, 0.8, 1.2, 7.2, PAINTBLUE[0]);
    pq(p, S, 0.26, 0.76, 1.4, 7.0, PAINTBLUE[2]);
    // a speckled granite top
    const granite: Mat = (light) => (_u, _v, x, y) => {
      const h = hash(x, y, 41);
      return h < 0.18 ? '#4a4a4e' : h < 0.3 ? '#e8e4dc' : light === 2 ? '#a8a49c' : light === 1 ? '#96928a' : '#7c7872';
    };
    lbox(p, 0.02, 0.1, W - 0.04, 0.82, Z - 0.6, 0.6, { front: granite, side: granite, top: granite, edge: '#3a3a3e' });
    const tz = Z;
    // the samovar: a footed brass urn, a teapot on the crown, the tap, wooden handles
    const [sx, sy] = anchor(p, 0.55, 0.42, tz);
    const K = p.k;
    layer(p.c, (l) => {
      fillPoly(l, [[sx - 8, sy], [sx + 8, sy], [sx + 5, sy - 5], [sx - 5, sy - 5]], BRASS[2]);
      px(l, sx - 3, sy - 8, BRASS[3], 6, 3);
    });
    cylinder(p.c, K, sx, sy - 8 * 1, 0.13, 0, 6.2, (nx, ny, _a, z, x, y) => {
      const bulge = z > 1.2 && z < 5 ? 1 : 0;
      const l = lightOf(nx, ny, bulge ? 0.1 : 0);
      if (Math.abs(z - 1.2) < 0.25 || Math.abs(z - 5.2) < 0.25) return BRASS[1];
      return BRASS[toneOf(BRASS, l, x, y, 0.25, 0.85)];
    });
    const [ux, uy] = anchor(p, 0.55, 0.42, tz + 8 / 4 + 6.2);
    layer(p.c, (l) => {
      ell(l, ux, uy, 9, 3.5, BRASS[3]);
      ell(l, ux - 1, uy - 1, 7, 2.5, BRASS[5]);
      // the teapot (porcelain with a blue band)
      ell(l, ux, uy - 7, 7, 6, '#f2eee4');
      px(l, ux - 7, uy - 7, '#3a5aa8', 14, 2);
      ell(l, ux - 2, uy - 9, 3, 2, '#ffffff');
      ln(l, ux + 6, uy - 7, ux + 11, uy - 11, '#e8e2d4', 2);
      ell(l, ux, uy - 13, 3, 1.5, '#e8e2d4');
      px(l, ux - 1, uy - 15, '#3a5aa8', 2, 2);
      // the tap and the handles
      const [tx, ty] = anchor(p, 0.55, 0.56, tz + 3.2);
      px(l, tx - 1, ty - 1, BRASS[2], 6, 2);
      px(l, tx + 4, ty, '#1e1a16', 2, 4);
      for (const s of [-1, 1]) {
        px(l, sx + s * 12 - 1, sy - 30, '#2a1c14', 3, 7);
        px(l, sx + s * 10 - 1, sy - 30, BRASS[3], 2 * s > 0 ? 3 : 3, 2);
      }
    });
    // tea tins, a tray of cups, a honey jar, biscuits, lemons
    for (let i = 0; i < 3; i++) {
      const [cx, cy] = anchor(p, 1.02 + i * 0.16, 0.3, tz);
      const col = ['#a8282a', '#1e2a22', '#2a5a3a'][i];
      layer(p.c, (l) => {
        px(l, cx - 4, cy - 12 - (i % 2) * 2, col, 8, 12 + (i % 2) * 2);
        px(l, cx - 4, cy - 12 - (i % 2) * 2, lighten(col, 0.2), 2, 12 + (i % 2) * 2);
        px(l, cx - 3, cy - 8, '#e8c060', 6, 3);
        ell(l, cx, cy - 12 - (i % 2) * 2, 4, 1.5, darken(col, 0.3));
      });
    }
    const [rx, ry] = anchor(p, 1.32, 0.66, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[rx - 18, ry], [rx, ry - 9], [rx + 18, ry], [rx, ry + 9]], WALNUT[3]);
      fillPoly(l, [[rx - 16, ry], [rx, ry - 8], [rx + 16, ry], [rx, ry + 8]], WALNUT[5]);
      for (const [dx, dy] of [[-8, 0], [0, -4], [6, 1], [-1, 4]] as const) {
        ell(l, rx + dx, ry + dy, 4, 2, '#e8e2d4');
        px(l, rx + dx - 2, ry + dy - 4, '#f6f2e8', 5, 4);
        px(l, rx + dx - 2, ry + dy - 4, '#3a5aa8', 5, 1);
      }
    });
    const [hx, hy] = anchor(p, W - 0.22, 0.42, tz);
    layer(p.c, (l) => {
      px(l, hx - 4, hy - 10, '#e8a828', 8, 10);
      px(l, hx - 4, hy - 10, '#f8d060', 2, 10);
      px(l, hx - 5, hy - 12, '#c8b090', 10, 3);
      ln(l, hx + 1, hy - 12, hx + 4, hy - 18, WALNUT[4], 1);
      const [bx2, by2] = anchor(p, W - 0.3, 0.74, tz);
      ell(l, bx2, by2, 9, 3.5, '#e8e2d4');
      for (let i = 0; i < 5; i++) ell(l, bx2 - 5 + (i % 3) * 4, by2 - 1 - Math.floor(i / 3) * 2, 2.5, 1.5, '#c89048');
      dotFruit(l, bx2 + 10, by2 - 1, '#f2d240', 5);
    });
  },
  anim(p, k) {
    // steam from the samovar's chimney and the teapot spout
    const [x, y] = anchor(p, 0.55, 0.42, 9 + 2 + 6.2);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.45 + i / 3) % 1;
      p.c.globalAlpha = 0.32 * (1 - t);
      ell(p.c, x + 11 * u + Math.sin(t * 6 + i) * 3 * u, y - 12 * u - t * 26 * u, (2 + t * 4) * u, (2 + t * 3) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── plants ──────────────────────────────────────────────────
function potCylinder(l: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Ramp, taper = 0.12) {
  for (let j = 0; j < h; j++) {
    const ww = w - j * taper;
    for (let i = -ww; i < ww; i++) {
      const t = (i + ww) / (2 * ww);
      px(l, x + i, y - j, r[t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.82 ? 2 : 1]);
    }
  }
  px(l, x - w - 1, y - h - 1, r[5], w * 2 + 2, 3);
  px(l, x - w - 1, y - h + 2, r[1], w * 2 + 2, 1);
}

function pottedPlant(p: PropPainter, k: PropCtx, tall: boolean) {
  const [x, y] = anchor(p, 0.5, 0.5, 0);
  contactShadow(p.c, x + 8, y + 3, 18, 6, 0.26);
  const R = rng(k.seed * 9 + 4);
  const kind = tall ? 4 : k.seed % 4;
  layer(p.c, (l) => {
    if (kind === 0) {
      // a Boston fern on a turned plant stand
      for (const dx of [-7, 0, 7]) ln(l, x + dx * 0.5, y - 26, x + dx, y + (dx === 0 ? 2 : 0), WALNUT[3], 2);
      ell(l, x, y - 26, 9, 3.5, WALNUT[4]);
      ell(l, x, y - 27, 8, 2.5, WALNUT[5]);
      potCylinder(l, x, y - 27, 8, 12, CERAMIC);
      const top = y - 40;
      for (let i = 0; i < 16; i++) {
        const ang = -Math.PI + (i / 15) * Math.PI + (R() - 0.5) * 0.15;
        const len = 18 + R() * 10;
        const ex = x + Math.cos(ang) * len * 1.2;
        const ey = top + Math.sin(ang) * len * 0.5 + 18 + R() * 10;
        const mx = x + Math.cos(ang) * len * 0.6;
        const my = top + Math.sin(ang) * len * 0.7 - 4;
        curve(l, x, top, mx, my, ex, ey, '#2a5a2a', 1);
        for (let j = 1; j < 8; j++) {
          const t = j / 8;
          const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
          const qy = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * my + t * t * ey;
          px(l, qx - 2, qy, j % 2 ? '#4e8c3a' : '#6aa448', 2, 1);
          px(l, qx + 1, qy - 1, '#8cbc5a', 2, 1);
        }
      }
    } else if (kind === 1) {
      // red geraniums in a terracotta pot
      potCylinder(l, x, y, 10, 15, TERRA);
      const masses: Mass[] = [];
      for (let i = 0; i < 7; i++) masses.push({ x: x + (R() - 0.5) * 20, y: y - 22 - R() * 10, rx: 8, ry: 6, z: i });
      foliage(l, masses, ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042', '#86b852'], k.seed, { cell: 3 });
      for (let i = 0; i < 6; i++) {
        const fx = x + (R() - 0.5) * 22;
        const fy = y - 32 - R() * 12;
        ln(l, fx, fy + 6, fx + (R() - 0.5) * 3, fy, '#3c702c');
        for (let q = 0; q < 6; q++) dotFruit(l, fx + (q % 3) * 3 - 3, fy - Math.floor(q / 3) * 3, q % 2 ? '#d8302a' : '#e84a3a', 3);
      }
    } else if (kind === 2) {
      // an agave in a glazed blue pot
      potCylinder(l, x, y, 11, 14, CERAMIC, 0.2);
      for (let i = 0; i < 13; i++) {
        const ang = -Math.PI + (i / 12) * Math.PI;
        const len = 18 + R() * 12 - Math.abs(i - 6) * 0.8;
        const ex = x + Math.cos(ang) * len;
        const ey = y - 16 + Math.sin(ang) * len * 1.1;
        for (let w = 0; w < 3; w++) ln(l, x - 1 + w, y - 16, ex, ey, ['#4a7a6a', '#6a9a88', '#8ab8a4'][w]);
        px(l, ex, ey, '#c8a060');
      }
    } else if (kind === 3) {
      // a yucca in a coopered larch tub
      for (let j = 0; j < 14; j++) {
        const ww = 11;
        for (let i = -ww; i < ww; i++) px(l, x + i, y - j, (i + ww) % 5 === 0 ? LARCHF[1] : LARCHF[i < -4 ? 5 : i < 3 ? 4 : 3]);
      }
      px(l, x - 11, y - 4, IRONK[3], 22, 2);
      px(l, x - 11, y - 11, IRONK[3], 22, 2);
      ln(l, x, y - 14, x + 2, y - 44, '#7a6a4a', 4);
      for (let h = 0; h < 2; h++) {
        const cy = y - 44 + h * 10;
        for (let i = 0; i < 12; i++) {
          const ang = -Math.PI + (i / 11) * Math.PI;
          ln(l, x + 2, cy, x + 2 + Math.cos(ang) * 20, cy + Math.sin(ang) * 16, i % 2 ? '#3a6a3a' : '#5a8a4a', 2);
        }
      }
    } else {
      // a kentia palm in a brass jardinière
      for (let j = 0; j < 20; j++) {
        const ww = 13 - Math.abs(j - 9) * 0.25;
        for (let i = -ww; i < ww; i++) {
          const t = (i + ww) / (2 * ww);
          px(l, x + i, y - j, BRASS[t < 0.2 ? 5 : t < 0.5 ? 4 : t < 0.8 ? 3 : 2]);
        }
      }
      px(l, x - 14, y - 21, BRASS[5], 28, 2);
      for (let i = -12; i < 12; i += 4) ell(l, x + i + 2, y - 10, 1.5, 1.5, BRASS[1]);
      for (let i = 0; i < 9; i++) {
        const ang = -Math.PI / 2 + (i - 4) * 0.36 + (R() - 0.5) * 0.15;
        const len = 46 + R() * 26;
        const ex = x + Math.cos(ang) * len * 1.3;
        const ey = y - 24 + Math.sin(ang) * len * 0.75 + len * 0.45;
        const mx = x + Math.cos(ang) * len * 0.5;
        const my = y - 24 - len * 0.95;
        curve(l, x, y - 22, mx, my, ex, ey, '#3a5a2a', 2);
        for (let j = 2; j < 14; j++) {
          const t = j / 14;
          const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
          const qy = (1 - t) * (1 - t) * (y - 22) + 2 * (1 - t) * t * my + t * t * ey;
          const lw = Math.round(10 * Math.sin(t * Math.PI)) + 2;
          ln(l, qx, qy, qx - lw * 0.7, qy + lw * 0.8, j % 2 ? '#3e7a34' : '#4e8c3a');
          ln(l, qx, qy, qx + lw * 0.7, qy + lw * 0.7, j % 2 ? '#5e9c44' : '#78b052');
        }
      }
    }
  });
}
const plant: PropArt = { draw: (p, k) => pottedPlant(p, k, false) };
const plantTall: PropArt = { draw: (p, k) => pottedPlant(p, k, true) };

// ── the lodge's front walls: gneiss rubble, cut low ─────────
const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7;
    const T = 0.3;
    // which end meets the other cut wall at the front corner
    const cornerAtStart = p.rot === 1;
    const rub = rubble(GNEISS, MORTAR, 14);
    const fac: Mat = (light, w, h) => {
      const r = rub(light, w, h);
      return (u, v, x, y) => {
        // a dressed granite plinth course
        if (v < 7) return at(['#5a5a5e', '#6e6e70', '#848482', '#9a9894', '#b0aca6', '#c4c0b8'], (light ? 3.4 : 2) + (u % 40 < 1.2 ? -2 : 0) + (v > 5.8 ? 1 : 0) - (v < 1.5 ? 1 : 0));
        return r(u, v, x, y);
      };
    };
    const core = rub(2, 0, 0);
    const top: Mat = () => (u, v, x, y) => {
      // the cut through the wall: the pine lining on the inside, the rubble core
      if (v > 13.5) return at(ZIRBE, 4 - (u % 12 < 1 ? 2 : 0));
      if (v > 12.4) return ZIRBE[1];
      return core(u, v, x, y);
    };
    lbox(p, 0, 0, W, T, 0, Z, { front: fac, side: fac, top, edge: GNEISS[0] });
    // dressed quoins at the corner end
    const F = front(p, T);
    const qa = cornerAtStart ? 0 : W - 0.34;
    for (let z = 1.8; z < Z - 0.2; z += 2.6) {
      const big = Math.floor(z / 2.6) % 2 === 0;
      const a0 = cornerAtStart ? qa : big ? qa : qa + 0.12;
      const a1 = cornerAtStart ? (big ? qa + 0.34 : qa + 0.22) : qa + 0.34;
      pq(p, F, a0, a1, z, Math.min(Z, z + 2.4), F.light ? '#b4b0a8' : '#8e8a84');
      pq(p, F, a0, a1, z, z + 0.3, '#5e5a56');
    }
    // the window stubs: a granite sill and a box of red geraniums under each window
    const Rn = rng(k.seed * 7 + 5);
    for (let a = 1.6; a < W - 1; a += 3) {
      pq(p, F, a - 0.55, a + 0.55, Z - 0.5, Z, F.light ? '#c4c0b8' : '#9a9690');
      pq(p, F, a - 0.55, a + 0.55, Z - 0.9, Z - 0.5, '#4e4c4a');
      // the box hangs under the sill outside
      pq(p, F, a - 0.42, a + 0.42, Z - 2.9, Z - 1.1, TIMBER(0));
      pq(p, F, a - 0.4, a + 0.4, Z - 2.7, Z - 1.3, F.light ? '#5e3c28' : '#46291a');
      const [ax, ay] = F.F(a - 0.4, Z - 1.1);
      const [bx, by] = F.F(a + 0.4, Z - 1.1);
      const masses: Mass[] = [];
      for (let i = 0; i <= 5; i++) masses.push({ x: ax + ((bx - ax) * i) / 5, y: ay + ((by - ay) * i) / 5 - 4, rx: 5, ry: 4, z: i });
      layer(p.c, (l) => {
        foliage(l, masses, ['#1a3418', '#24461e', '#2e5a24', '#3c702c', '#4e8836', '#68a042', '#86b852'], Math.floor(a * 13) + k.seed, { cell: 2.4, dots: ['#d8302a', '#e84a3a', '#f05a4a'], dotChance: 0.85, dotSize: 3 });
        for (let i = 0; i < 5; i += 2) for (let q = 0; q < 7; q++) px(l, ax + ((bx - ax) * (i + 0.5)) / 5 + (q % 3 === 2 ? 1 : 0), ay + ((by - ay) * (i + 0.5)) / 5 + 2 + q, ['#2e5a24', '#3c702c'][q & 1]);
      }, { outline: 0.6 });
    }
    // houseleeks and grass at the foot of the wall
    layer(p.c, (l) => {
      for (let a = 0.3; a < W - 0.2; a += 0.5 + Rn() * 0.9) {
        const [x, y] = p.P(a, T + 0.04, 0);
        if (Rn() < 0.5) {
          for (let i = 0; i < 5; i++) ln(l, x + i * 2 - 4, y, x + i * 2 - 5 + Rn() * 3, y - 4 - Rn() * 5, ['#4a6a2a', '#5e7e32', '#7a9a3e'][i % 3]);
        } else {
          ell(l, x, y - 2, 4, 2.5, '#5a7a4a');
          ell(l, x - 1, y - 3, 2, 1, '#8aa86a');
          px(l, x + 2, y - 3, '#a8483a', 1, 1);
        }
      }
    }, { outline: 0.5 });
  },
};

/** Flat-colour Mat helper for small timber faces (a texture would be lost at this size). */
function TIMBER(light: 0 | 1 | 2): string {
  return light ? '#46291a' : '#331f14';
}

export const RESEARCH_ROOM: Record<string, PropArt> = {
  desk,
  labbench,
  terrarium,
  hydro,
  table,
  globe,
  bookshelf,
  sofa,
  armchair,
  counter,
  plant,
  plantTall,
  lowWall,
};

export { around, bankersChair, studentLamp, lampGlow, potCylinder, microscope, fern, LINEN, NIGHT, IRONG };

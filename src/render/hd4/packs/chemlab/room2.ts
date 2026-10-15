// Chemical Lab — safety kit, the clean-zone corner and the cut façade.
//   drum        HDPE / steel drums on yellow spill pallets
//   cabinet     the yellow flammables safety cabinet (variant 'flammable')
//   shower      emergency shower and eyewash on a yellow riser
//   counter     the clean-zone coffee island in birch ply and white solid surface
//   cafeTable   a standing table for the coffee break
//   plant       kentia palm, bird of paradise, candelabra spurge
//   lowWall     the lab building's white-concrete and glass façade, cut low
//   lab_cart · lab_waste · lab_gas · lab_freezer · lab_fridge  (lab clutter)
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, bayer, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { handle } from './room';
import { ANTH, bottle, coat, CONC, cyl, DCONC, erlen, ghs, GRN, hcyl, LIQ, LW, P, planeText, RED, sign, STEEL, steelMat, TEAL, YEL } from './lk';

const lwCoat = coat(LW);
const steel = steelMat();
const anth = coat(ANTH);
const yel = coat(YEL);


/** A tiny tube rack (for the glove box interior). */
function tubeRackSmall(l: CanvasRenderingContext2D, x: number, y: number) {
  fillPoly(l, [[x - 8, y], [x, y - 4], [x + 8, y], [x, y + 4]], '#d8e2e4');
  for (let i = 0; i < 4; i++) {
    px(l, x - 5 + i * 3, y - 9 - (i % 2), '#e8f4f6', 2, 8);
    px(l, x - 5 + i * 3, y - 4 - (i % 2), ['#f2d23a', '#ea5aa2', '#2ab0c8', '#cfe9ef'][i], 2, 3);
  }
}
/** A tiny beaker (for the glove box interior). */
function beakerSmall(l: CanvasRenderingContext2D, x: number, y: number) {
  px(l, x - 4, y - 9, '#9fc3cb', 8, 9);
  px(l, x - 3, y - 8, '#e6f4f6', 6, 8);
  px(l, x - 3, y - 4, '#8e46c8', 6, 4);
  px(l, x - 3, y - 8, '#ffffff', 1, 3);
}

// ── drums on spill pallets ──────────────────────────────────
/** A yellow spill pallet: a sump with a black steel grating on top. */
function spillPallet(p: PropPainter, a0: number, b0: number, w: number, d: number) {
  const grate: Mat = (light) => (u, v) => {
    if (light !== 2) return at(YEL, light ? 3 : 2) as string;
    return u % 5 < 1.4 || v % 5 < 1.4 ? '#2a2c30' : '#151619';
  };
  lbox(p, a0, b0, w, d, 0, 1.7, { front: yel, side: yel, top: grate, edge: YEL[0] });
  const F = front(p, b0 + d);
  pq(p, F, a0 + 0.08, a0 + w - 0.08, 0.5, 1.2, YEL[F.light ? 2 : 1]);
}

const DRUMS: { body: Ramp; cap: string; label: string; kind: number }[] = [
  { body: ['#14306a', '#1c4288', '#2656a8', '#3268c0', '#4a82d4', '#78a6e4'], cap: '#e8e8e2', label: '#f4f2ea', kind: 2 },
  { body: ['#3a3f45', '#50565d', '#677078', '#828b94', '#a2aab2', '#c4cad0'], cap: '#c8382a', label: YEL[4], kind: 0 },
  { body: ['#7a8478', '#9aa496', '#b8c2b2', '#d0d8c8', '#e2e8da', '#f2f6ec'], cap: GRN[3], label: '#f4f2ea', kind: 1 },
];

const drum: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.9, 0.9, 10, 0.26);
    spillPallet(p, 0.08, 0.08, 0.84, 0.84);
    const dd = DRUMS[k.seed % DRUMS.length];
    const [x, y] = P(p, 0.5, 0.5, 1.7);
    layer(p.c, (l) => {
      cyl(l, x, y, 24, 34, dd.body, { ribs: [11, 23], top: dd.body[4] });
      // the lid: a raised rim, two bungs, a scuff
      ell(l, x, y - 34, 22, 11, dd.body[3]);
      ell(l, x - 2, y - 35, 18, 8.5, dd.body[5]);
      ell(l, x - 9, y - 35, 3.5, 2, darken(dd.cap, 0.3));
      ell(l, x - 9, y - 36, 3, 1.6, dd.cap);
      ell(l, x + 8, y - 37, 2.5, 1.5, darken(dd.cap, 0.3));
      ell(l, x + 8, y - 38, 2, 1.2, dd.cap);
      // the label with a hazard diamond and a few lines of "text"
      px(l, x - 15, y - 20, dd.label, 13, 12);
      px(l, x - 15, y - 20, lighten(dd.label, 0.2), 13, 1);
      ghs(l, x - 9, y - 14, 4, dd.kind);
      px(l, x - 3, y - 18, '#2a2a30', 6, 1);
      px(l, x - 3, y - 15, '#2a2a30', 5, 1);
      px(l, x - 3, y - 12, '#2a2a30', 4, 1);
      if (k.seed % 2) {
        // a drum pump with its hose looped over the rim
        px(l, x + 6, y - 58, STEEL[3], 3, 22);
        px(l, x + 6, y - 58, STEEL[5], 1, 22);
        px(l, x + 2, y - 62, ANTH[2], 11, 5);
        curve(l, x + 12, y - 58, x + 22, y - 52, x + 20, y - 36, '#2a2c30', 2);
      }
    }, { outline: 0.6 });
  },
};

// ── the flammables safety cabinet ───────────────────────────
const cabinet: PropArt = {
  draw(p, k) {
    const flam = (k.variant ?? 'flammable') === 'flammable';
    const body = flam ? YEL : (['#4a5058', '#5e656e', '#7a828b', '#979fa8', '#b5bcc4', '#d4dadf'] as Ramp);
    const mat = coat(body);
    footShadow(p, 0.06, 0.24, 0.94, 0.84, 16, 0.28);
    // levelling feet, the double-walled body, a raised top lip
    for (const [a, b] of [[0.1, 0.3], [0.86, 0.3], [0.1, 0.78], [0.86, 0.78]] as const) lbox(p, a, b, 0.04, 0.04, 0, 0.5, mono(anth, ANTH[0]));
    lbox(p, 0.06, 0.26, 0.88, 0.56, 0.5, 16.2, { front: mat, side: mat, top: mat, edge: body[0] });
    const F = front(p, 0.82);
    // doors: a centre seam, beads round the edges, the sill
    pq(p, F, 0.08, 0.92, 1.0, 16.0, body[F.light ? 2 : 1]);
    pq(p, F, 0.1, 0.495, 1.1, 15.9, body[F.light ? 4 : 2]);
    pq(p, F, 0.505, 0.9, 1.1, 15.9, body[F.light ? 4 : 2]);
    pq(p, F, 0.1, 0.9, 15.6, 15.9, body[F.light ? 5 : 3]);
    if (flam) {
      // the warning: red letters on the yellow, a flame diamond each side
      pq(p, F, 0.12, 0.88, 13.9, 14.2, RED[2]);
      planeText(p, F, 0.1, 0.9, 12.0, 13.7, 'FLAMMABLE', RED[2]);
      pq(p, F, 0.12, 0.88, 11.5, 11.8, RED[2]);
      const [ax, ay] = F.F(0.3, 7.6);
      const [bx, by] = F.F(0.7, 7.6);
      ghs(p.c, ax, ay, 7, 0);
      ghs(p.c, bx, by, 7, 0);
    }
    // the paddle handle and key lock, a self-closing hinge mark
    pq(p, F, 0.44, 0.56, 8.6, 9.6, '#1e1e22');
    pq(p, F, 0.46, 0.54, 8.8, 9.3, '#3a3a40');
    const [kx, ky] = F.F(0.5, 10.1);
    px(p.c, kx - 1, ky - 1, STEEL[5], 2, 2);
    // a flame-arrester vent bung on the side, and the earthing cable
    const S = side(p, p.rot === 0 ? 0.94 : 0.06);
    const [vx, vy] = S.F(0.5, 13.2);
    ell(p.c, vx, vy, 3, 4, '#8a6a20');
    ell(p.c, vx, vy, 2, 3, STEEL[4]);
    const [ex, ey] = S.F(0.7, 2.2);
    curve(p.c, ex, ey, ex + 6, ey + 6, ex + 10, ey + 12, '#3a8a3a', 1);
    void k;
  },
};

// ── the emergency shower and eyewash ────────────────────────
const shower: PropArt = {
  draw(p, k) {
    const c = p.c;
    // a stainless floor drain under the shower
    const [gx, gy] = P(p, 0.48, 0.62, 0);
    ell(c, gx, gy, 15, 7.5, STEEL[2]);
    ell(c, gx, gy, 13, 6.5, STEEL[4]);
    for (let i = -10; i <= 10; i += 3) px(c, gx + i, gy - 5 + Math.abs(i) * 0.1, '#2a2e34', 1, 10 - Math.abs(i) * 0.5);
    const [x, y] = P(p, 0.66, 0.24, 0);
    contactShadow(c, x + 8, y + 3, 12, 4, 0.28);
    layer(c, (l) => {
      // floor flange, the riser pipe, a ball valve and the top elbow
      ell(l, x, y, 7, 3.5, YEL[1]);
      ell(l, x, y - 1, 6, 3, YEL[3]);
      cyl(l, x, y - 1, 3, 92, YEL, { top: null });
      // the arm forward to the head
      const [hx, hy] = P(p, 0.42, 0.62, 23.4);
      ln(l, x, y - 93, hx, hy - 1, YEL[1], 4);
      ln(l, x, y - 94, hx, hy - 2, YEL[4], 2);
      ell(l, x, y - 93, 4, 2.5, YEL[3]);
      // the big ABS shower head
      ell(l, hx, hy + 6, 15, 7, YEL[1]);
      fillPoly(l, [[hx - 15, hy + 6], [hx + 15, hy + 6], [hx + 8, hy - 2], [hx - 8, hy - 2]], YEL[3]);
      fillPoly(l, [[hx - 15, hy + 6], [hx - 6, hy + 6], [hx - 3, hy - 2], [hx - 8, hy - 2]], YEL[5]);
      ell(l, hx, hy + 6, 13, 5.5, YEL[0]);
      for (let i = -9; i <= 9; i += 4) px(l, hx + i, hy + 6 + Math.round(Math.abs(i) * 0.1), '#3a2a10', 1, 1);
      px(l, hx - 2, hy - 4, YEL[2], 4, 3);
      // the pull rod and its triangle handle, with a test tag
      const [rx, ry] = P(p, 0.52, 0.48, 23.4);
      px(l, rx, ry, STEEL[3], 1, 30);
      fillPoly(l, [[rx - 5, ry + 40], [rx + 5, ry + 40], [rx, ry + 30]], YEL[1]);
      fillPoly(l, [[rx - 3, ry + 39], [rx + 3, ry + 39], [rx, ry + 33]], '#f0f0e8');
      px(l, rx + 2, ry + 18, '#f6e6a0', 4, 6);
      px(l, rx + 2, ry + 18, GRN[3], 4, 1);
      // the eyewash bowl on its own arm with two green-capped heads and a push flag
      const [ex, ey] = P(p, 0.44, 0.58, 9.4);
      ln(l, x, y - 38, ex + 4, ey - 1, YEL[1], 3);
      ln(l, x, y - 39, ex + 4, ey - 2, YEL[4], 1);
      ell(l, ex, ey, 11, 5.5, STEEL[2]);
      ell(l, ex, ey - 1, 10, 4.5, STEEL[5]);
      ell(l, ex, ey, 7, 3, STEEL[1]);
      for (const dx of [-4, 4]) {
        px(l, ex + dx - 1, ey - 4, GRN[4], 3, 3);
        px(l, ex + dx - 1, ey - 4, GRN[5], 3, 1);
      }
      fillPoly(l, [[ex + 8, ey + 2], [ex + 14, ey - 1], [ex + 14, ey - 6], [ex + 8, ey - 3]], GRN[3]);
      // the sign on top of the riser
      px(l, x - 1, y - 112, STEEL[3], 2, 18);
    }, { outline: 0.6 });
    // the sign panel, facing the room
    const F = front(p, 0.3);
    sign(p, F, 0.5, 0.86, 25.2, 29.6, 'shower');
    sign(p, F, 0.86, 1.08, 25.6, 28.2, 'eyewash');
    void k;
  },
  anim(p, k) {
    // the indicator lamp on the riser blinks green (water supply OK)
    const u = p.k / 4;
    const [x, y] = P(p, 0.66, 0.24, 0);
    if (Math.sin(k.t * 2) > 0) px(p.c, x + 3 * u, y - 60 * u, '#6af08a', Math.max(1, 2 * u), Math.max(1, 2 * u));
  },
};

// ── the clean-zone coffee island ────────────────────────────
const BIRCH: Ramp = ['#7a6248', '#98805e', '#b49c76', '#ccb68e', '#dfcba6', '#eedfc0'];
const ply: Mat = (light, _w, h) => (u, v, x, y) => {
  let i = light === 2 ? 4 : light === 1 ? 3 : 1.8;
  // long, straight birch grain running along the panel
  const g = noise2(u * 0.025, v * 0.55, 15);
  if (g > 0.68) i -= 0.7;
  else if (g < 0.28) i += 0.35;
  if (hash(x, y, 13) < 0.02) i -= 0.6;
  if (v > h - 1.2) i += 0.8;
  return at(BIRCH, i);
};
const corian: Mat = (light) => (_u, _v, x, y) => {
  const s = hash(x, y, 14);
  return at(['#b6bcbc', '#cfd4d2', '#e2e6e4', '#eef1ef', '#f7f9f8', '#ffffff'], (light === 2 ? 4 : light === 1 ? 3 : 2) + (s < 0.05 ? -1 : s > 0.97 ? 1 : 0));
};

const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.05, 0.12, W - 0.05, 0.9, 10, 0.26);
    lbox(p, 0.1, 0.2, W - 0.2, 0.62, 0, 0.7, mono(coat(TEAL), TEAL[0]));
    lbox(p, 0.05, 0.14, W - 0.1, 0.72, 0.7, Z - 1.2, { front: ply, side: ply, top: ply, edge: BIRCH[0] });
    const F = front(p, 0.86);
    // four ply doors with round finger pulls, the layered edge of the ply showing
    for (let i = 0; i < 4; i++) {
      const u0 = 0.08 + ((W - 0.16) * i) / 4;
      const u1 = 0.08 + ((W - 0.16) * (i + 1)) / 4 - 0.02;
      pq(p, F, u0, u1, 0.9, Z - 0.7, BIRCH[F.light ? 2 : 1]);
      pt(p, F, u0 + 0.015, u1 - 0.015, 1.0, Z - 0.8, ply, F.light);
      const [hx, hy] = F.F(i % 2 ? u0 + 0.07 : u1 - 0.07, Z - 1.6);
      ell(p.c, hx, hy, 2, 2, BIRCH[0]);
      ell(p.c, hx, hy - 0.5, 1, 1, darken(BIRCH[0], 0.3));
    }
    lbox(p, 0.02, 0.1, W - 0.04, 0.8, Z - 0.5, 0.5, { front: corian, side: corian, top: corian, edge: '#a8aeae' });
    const T = (a: number, b: number) => P(p, a, b, Z);
    const c = p.c;
    layer(
      c,
      (l) => {
        // bean-to-cup machine: black body, a chrome front, a little screen, a cup under the spout
        const [mx, my] = T(0.42, 0.42);
        fillPoly(l, [[mx - 14, my], [mx + 2, my - 8], [mx + 14, my - 2], [mx - 2, my + 6]], '#1e2024');
        px(l, mx - 14, my - 30, '#26282e', 16, 30);
        fillPoly(l, [[mx + 2, my - 8], [mx + 14, my - 2], [mx + 14, my - 32], [mx + 2, my - 38]], '#16181c');
        fillPoly(l, [[mx - 14, my - 30], [mx + 2, my - 38], [mx + 14, my - 32], [mx - 2, my - 24]], '#3a3e44');
        fillPoly(l, [[mx - 12, my - 4], [mx - 2, my - 9], [mx - 2, my - 26], [mx - 12, my - 21]], '#b8c0c8');
        fillPoly(l, [[mx - 11, my - 5], [mx - 6, my - 7.5], [mx - 6, my - 24], [mx - 11, my - 21.5]], '#dfe5ea');
        px(l, mx - 10, my - 19, '#1a3a5a', 6, 4);
        px(l, mx - 9, my - 18, '#6ab0e8', 3, 1);
        px(l, mx - 9, my - 13, '#16181c', 4, 2);
        px(l, mx - 8, my - 8, '#f6f2ea', 4, 4);
        // a stack of paper cups, the kettle, a tray of mugs, the biscuit jar, a fruit bowl
        const [cx, cy] = T(0.85, 0.36);
        for (let i = 0; i < 5; i++) px(l, cx - 3, cy - 4 - i * 2, i % 2 ? '#e8e2d4' : '#f6f2e8', 6, 2);
        const [kx, ky] = T(1.1, 0.4);
        ell(l, kx, ky, 6, 3, '#c8ccd0');
        fillPoly(l, [[kx - 5, ky - 1], [kx + 5, ky - 1], [kx + 4, ky - 13], [kx - 4, ky - 13]], '#f4f6f6');
        fillPoly(l, [[kx - 5, ky - 1], [kx - 2, ky - 1], [kx - 2, ky - 13], [kx - 4, ky - 13]], '#ffffff');
        px(l, kx + 4, ky - 11, '#d8dcde', 3, 8);
        px(l, kx - 4, ky - 15, '#2a2e34', 8, 2);
        const mugs = ['#e2553b', TEAL[4], '#f2c43a', '#5b8def', '#f4f2ea'];
        const [tx, ty] = T(1.45, 0.62);
        fillPoly(l, [[tx - 16, ty], [tx, ty - 8], [tx + 16, ty], [tx, ty + 8]], '#3a3e44');
        fillPoly(l, [[tx - 14, ty], [tx, ty - 7], [tx + 14, ty], [tx, ty + 7]], '#5a6068');
        mugs.forEach((m, i) => {
          const mx2 = tx - 9 + (i % 3) * 8 + Math.floor(i / 3) * 4;
          const my2 = ty - 2 + Math.floor(i / 3) * 4 - (i % 3) * 2;
          px(l, mx2 - 3, my2 - 7, m, 6, 7);
          px(l, mx2 - 3, my2 - 7, lighten(m, 0.3), 1, 7);
          px(l, mx2 + 3, my2 - 6, m, 2, 4);
          ell(l, mx2, my2 - 7, 3, 1, darken(m, 0.35));
        });
        const [jx, jy] = T(1.78, 0.36);
        px(l, jx - 5, jy - 14, '#d8eef2', 10, 14);
        px(l, jx - 4, jy - 9, '#c8945a', 8, 8);
        for (let i = 0; i < 4; i++) px(l, jx - 3 + (i % 2) * 4, jy - 8 + Math.floor(i / 2) * 3, '#a8743a', 2, 2);
        px(l, jx - 5, jy - 16, '#8a6a46', 10, 3);
        px(l, jx - 5, jy - 14, '#ffffff', 1, 12);
        const [fx, fy] = T(0.62, 0.72);
        ell(l, fx, fy - 2, 10, 4.5, '#f2f2ee');
        ell(l, fx, fy - 3, 9, 3.5, '#d8dcd8');
        for (let i = 0; i < 4; i++) dotFruit(l, fx - 5 + i * 3.4, fy - 5 - (i & 1), ['#d23a30', '#7ab03a', '#f2c43a', '#d23a30'][i], 5);
        fillPoly(l, [[fx + 1, fy - 8], [fx + 9, fy - 12], [fx + 10, fy - 10], [fx + 2, fy - 6]], '#f2d24a');
      },
      { outline: 0.55 },
    );
    // a "clean zone" sign card on the front edge
    pq(p, F, W - 0.62, W - 0.12, Z - 2.6, Z - 1.0, '#fbfaf4');
    planeText(p, F, W - 0.62, W - 0.12, Z - 2.6, Z - 1.0, 'CLEAN', TEAL[2]);
    void k;
  },
  anim(p, k) {
    // steam from the cup under the spout
    const u = p.k / 4;
    const [mx, my] = P(p, 0.42, 0.42, 9);
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.45 + i / 3) % 1;
      p.c.globalAlpha = 0.4 * (1 - t);
      ell(p.c, mx - 6 * u + Math.sin(t * 6 + i) * 2 * u, my - 10 * u - t * 20 * u, (1.5 + t * 3) * u, (1.5 + t * 2) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── a standing table ────────────────────────────────────────
const cafeTable: PropArt = {
  draw(p, k) {
    const [x, y] = P(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 3, 22, 8, 0.24);
    layer(p.c, (l) => {
      // a heavy round foot, a brushed column, the white round top with a dark edge
      ell(l, x, y, 15, 7.5, '#2a2c30');
      ell(l, x - 1, y - 1, 13, 6, '#4a4e54');
      px(l, x - 2, y - 42, STEEL[3], 4, 42);
      px(l, x - 2, y - 42, STEEL[5], 1, 42);
      ell(l, x, y - 43, 26, 13, '#8a9294');
      ell(l, x, y - 45, 26, 13, '#f2f4f2');
      ell(l, x - 6, y - 47, 15, 7, '#ffffff');
      // two mugs, a plate with a croissant, a phone
      for (const [dx, dy, col] of [[-10, -4, TEAL[4]], [9, -1, '#e2553b']] as const) {
        px(l, x + dx - 3, y - 45 + dy - 6, col, 6, 7);
        px(l, x + dx - 3, y - 45 + dy - 6, lighten(col, 0.3), 1, 7);
        px(l, x + dx + 3, y - 45 + dy - 5, col, 2, 4);
        ell(l, x + dx, y - 45 + dy - 6, 3, 1, '#4a2e1e');
      }
      ell(l, x + 4, y - 50, 7, 3, '#e8e8e4');
      fillPoly(l, [[x, y - 51], [x + 4, y - 54], [x + 9, y - 52], [x + 6, y - 50]], '#d89a4a');
      fillPoly(l, [[x - 18, y - 46], [x - 12, y - 49], [x - 8, y - 47], [x - 14, y - 44]], '#1e2026');
    }, { outline: 0.55 });
    void k;
  },
};

// ── plants ──────────────────────────────────────────────────
const FROND: Ramp = ['#1c3a22', '#24492a', '#2e5c32', '#3a703a', '#4a8642', '#5e9c4c', '#7ab45a'];

/** A palm frond: an arching rib with paired leaflets drooping off it. */
function frond(l: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, seed: number) {
  const n = 18;
  let px0 = x0;
  let py0 = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    ln(l, px0, py0, x, y, FROND[2], 1);
    if (i > 2) {
      const len = 9 * (1 - t * 0.6);
      const dir = x1 > x0 ? 1 : -1;
      for (const s of [-1, 1]) {
        const ex = x + s * 2 + dir * len * 0.3;
        const ey = y + len * (0.7 + s * 0.15);
        ln(l, x, y, ex, ey, FROND[s > 0 ? 3 + ((i + seed) % 2) : 4 + ((i + seed) % 3)], 1);
      }
    }
    px0 = x;
    py0 = y;
  }
}

function pottedPlant(p: PropPainter, k: PropCtx) {
  const kind = k.seed % 3;
  const [x, y] = P(p, 0.5, 0.5, 0);
  contactShadow(p.c, x + 8, y + 3, 18, 6, 0.26);
  const Rn = rng(k.seed * 11 + 5);
  layer(p.c, (l) => {
    // pots: a tall white cylinder, a pale concrete bowl, a teal glazed pot
    if (kind === 0) cyl(l, x, y, 12, 30, ['#9aa2a2', '#b8c0bf', '#d2d8d6', '#e4e8e6', '#f2f4f2', '#ffffff'], { top: '#5a4a3a' });
    else if (kind === 1) {
      cyl(l, x, y, 15, 18, DCONC.map((c) => lighten(c, 0.35)), { top: '#4a3a2c' });
      ell(l, x, y - 18, 15, 7.5, '#8a8682');
      ell(l, x, y - 18, 13, 6, '#4a3a2c');
    } else cyl(l, x, y, 11, 20, TEAL, { top: '#4a3a2c' });
    const top = y - (kind === 0 ? 30 : kind === 1 ? 18 : 20);
    if (kind === 0) {
      // kentia palm: slim stems and arching fronds fanning out
      const fronds = 9;
      for (let i = 0; i < fronds; i++) {
        const a = -1.35 + (i / (fronds - 1)) * 2.7 + (Rn() - 0.5) * 0.2;
        const len = 46 + Rn() * 20;
        const ex = x + Math.sin(a) * len;
        const ey = top - Math.cos(a) * len * 0.55 - 30 + Math.abs(a) * 26;
        frond(l, x + (Rn() - 0.5) * 4, top, ex, ey, x + Math.sin(a) * len * 0.45, top - 64 + Math.abs(a) * 10, k.seed + i);
      }
    } else if (kind === 1) {
      // bird of paradise: big paddle leaves on long stalks, split by the wind, one orange flower
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + (i / 6) * 1.8 + (Rn() - 0.5) * 0.15;
        const len = 34 + Rn() * 24;
        const sx = x + (i - 3) * 1.5;
        const ex = sx + Math.sin(a) * len * 0.7;
        const ey = top - len;
        ln(l, sx, top, ex, ey + 12, '#4a7a3a', 2);
        const lw = 7;
        fillPoly(l, [[ex - lw, ey + 14], [ex, ey - 8], [ex + lw, ey + 12], [ex + 1, ey + 20]], FROND[3]);
        fillPoly(l, [[ex - lw, ey + 14], [ex, ey - 8], [ex, ey + 18]], FROND[5]);
        ln(l, ex, ey - 7, ex + 1, ey + 18, FROND[1]);
        if (Rn() < 0.6) ln(l, ex + 2, ey + 4, ex + lw, ey + 2, FROND[0]);
      }
      const [fx, fy] = [x + 10, top - 40];
      fillPoly(l, [[fx - 8, fy + 3], [fx + 6, fy], [fx + 8, fy + 3]], '#3a6a5a');
      fillPoly(l, [[fx - 2, fy], [fx + 2, fy - 9], [fx + 4, fy]], '#f08a2a');
      fillPoly(l, [[fx + 1, fy], [fx + 6, fy - 7], [fx + 6, fy]], '#f2b03a');
      px(l, fx + 4, fy - 4, '#4a3ab8', 2, 3);
    } else {
      // candelabra spurge: upright ribbed green arms branching from a trunk
      const arms = [[0, 64], [-9, 48], [9, 52], [-15, 34], [15, 38]] as const;
      for (const [dx, h] of arms) {
        const ax = x + dx;
        if (dx !== 0) {
          ln(l, x, top - h * 0.4, ax, top - h * 0.45, '#3a6a3a', 5);
        }
        for (let j = 0; j < h - (dx === 0 ? 0 : h * 0.45); j++) {
          const yy = top - (dx === 0 ? 0 : h * 0.45) - j;
          for (let i = -3; i <= 3; i++) {
            const t = (i + 3) / 6;
            let col = t < 0.3 ? '#6a9e52' : t < 0.6 ? '#4e8442' : t < 0.85 ? '#3a6a36' : '#2a522c';
            if (i === -1 || i === 2) col = '#2e5a30';
            px(l, ax + i, yy, col);
          }
          if (j % 5 === 0) {
            px(l, ax - 4, yy, '#c8c098');
            px(l, ax + 4, yy, '#a8a080');
          }
        }
        ell(l, ax, top - h, 3, 2, '#7ab05a');
      }
    }
  }, { outline: 0.6 });
}
const plant: PropArt = { draw: pottedPlant };

// ── the front walls: the lab building's façade, cut low ────
const T = 0.34;
const ZU = 4.8; // top of the precast upstand
const Z = 7.4; // the cut line through the curtain wall
/** White precast upstand over an anthracite plinth; panel joints every two and a half metres. */
const facade: Mat = (light) => (u, v, x, y) => {
  if (v < 4.8) {
    let i = light ? 2.4 : 1.4;
    if (v > 4) i += 1;
    if (hash(x, y, 31) < 0.06) i -= 1;
    return at(DCONC, i);
  }
  let i = light ? 4 : 2.6;
  const s = hash(x, y, 32);
  if (s < 0.05) i -= 1;
  else if (s > 0.975) i += 1;
  if (u % 178 < 1.2) i -= 2;
  if (v < 8 && bayer(x, y) * 8 > v - 4.8) i -= 0.7;
  return at(CONC, i);
};
/** The precast coping on top of the upstand, seen inside the glazing line. */
const coping: Mat = () => (u, _v, x, y) => (u % 178 < 1.2 ? CONC[2] : hash(x, y, 34) < 0.05 ? CONC[3] : CONC[5]);
/** The curtain wall's glass, cut: a dark reflective strip with a pale streak. */
const glassStrip: Mat = (light) => (u, v, x, y) => {
  const d = (u * 0.7 + v * 2) % 46;
  let i = light ? 2.4 : 1.6;
  if (d < 5) i += 2.4;
  else if (d > 9 && d < 11) i += 1.2;
  if (hash(x, y, 35) < 0.03) i += 1;
  return at(['#1a2c34', '#22404a', '#2c5560', '#3c6c78', '#5a8e98', '#8ab8c0', '#c4e2e6'], i);
};
/** The cut edge of the glass: a pale green-cyan line (the glass seen end-on). */
const glassCut: Mat = () => () => '#8fd0cc';

const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    // reach into the corners where the walls meet (front-west / front-east)
    const a0 = p.rot === 0 ? -0.3 : 0;
    const a1 = p.rot === 0 ? W + T : W + 0.3;
    const L = a1 - a0;
    lbox(p, a0, 0, L, T, 0, ZU, { front: facade, side: facade, top: coping, edge: '#6a6660' });
    // the curtain wall standing on the upstand: a bottom transom, the glass cut at the cut line, mullions every 1.25 m
    const G0 = T - 0.11;
    lbox(p, a0, G0 - 0.03, L, 0.12, ZU, 0.55, mono(anth, ANTH[0]));
    lbox(p, a0, G0, L, 0.05, ZU + 0.55, Z - ZU - 0.55, { front: glassStrip, side: glassStrip, top: glassCut, edge: '#1a2c34' });
    for (let a = Math.ceil((a0 + 0.2) / 1.25) * 1.25; a < a1 - 0.1; a += 1.25) {
      lbox(p, a - 0.045, G0 - 0.05, 0.09, 0.16, ZU + 0.55, Z - ZU - 0.55, { front: anth, side: anth, top: coat(['#3a4048', '#4a525a', '#5a646c', '#6a747c', '#7a848c', '#8a949c']), edge: ANTH[0] });
    }
    // gravel strip at the foot, sedges and an uplight now and then
    const Rn = rng(k.seed * 7 + 3);
    layer(p.c, (l) => {
      for (let a = a0 + 0.05; a < a1 - 0.05; a += 0.06) {
        const [gx, gy] = P(p, a, T + 0.08 + Rn() * 0.16, 0);
        px(l, gx, gy, ['#b8b4ac', '#d4d0c8', '#9a968e', '#e6e2da'][Math.floor(Rn() * 4)], 2, 1);
      }
    }, { outline: false });
    layer(p.c, (l) => {
      for (let a = 0.6; a < W - 0.3; a += 1.6 + Rn() * 1.4) {
        if (Rn() < 0.35) {
          const [ux, uy] = P(p, a, T + 0.14, 0);
          px(l, ux - 2, uy - 3, '#2a2c30', 4, 3);
          px(l, ux - 1, uy - 4, '#f6eec8', 2, 1);
          continue;
        }
        const masses: Mass[] = [];
        for (let i = 0; i < 3; i++) {
          const [mx, my] = P(p, a + i * 0.1, T + 0.12, 1.2 + Rn() * 1.2);
          masses.push({ x: mx, y: my, rx: 4 + Rn() * 2, ry: 3.5 + Rn() * 1.5, z: i });
        }
        foliage(l, masses, ['#2c4024', '#3a5229', '#4a662f', '#5c7a36', '#72903e', '#8ca64c', '#a8bc62'], Math.floor(a * 31), { cell: 2.2, tilt: 0.3 });
        // a few blades sticking up
        const [bx, by] = P(p, a + 0.1, T + 0.12, 0);
        for (let i = 0; i < 5; i++) ln(l, bx - 4 + i * 2, by - 2, bx - 6 + i * 3, by - 14 - (i % 2) * 4, '#8ca64c');
      }
    }, { outline: 0.55 });
    void k;
  },
};

// ── lab clutter ─────────────────────────────────────────────
/** A stainless lab trolley with glassware, a box of samples and a dewar. */
const lab_cart: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.2, 0.85, 0.8, 10, 0.24);
    for (const [a, b] of [[0.18, 0.24], [0.78, 0.24], [0.18, 0.74], [0.78, 0.74]] as const) {
      lbox(p, a, b, 0.04, 0.04, 0.8, 8.2, mono(steel, STEEL[1]));
      const [cx, cy] = P(p, a + 0.02, b + 0.02, 0);
      ell(p.c, cx, cy - 2, 3, 2, '#2a2c30');
    }
    for (const z of [1.6, 8.4]) {
      lbox(p, 0.16, 0.22, 0.68, 0.56, z, 0.4, mono(steel, STEEL[1]));
      lbox(p, 0.16, 0.76, 0.68, 0.02, z + 0.4, 0.6, mono(steel, STEEL[1]));
    }
    layer(p.c, (l) => {
      // lower shelf: a box of sample tubes, a waste beaker
      const [bx, by] = P(p, 0.4, 0.5, 2);
      fillPoly(l, [[bx - 12, by], [bx, by - 6], [bx + 12, by], [bx, by + 6]], '#e8e2d2');
      px(l, bx - 12, by - 7, '#d6ccb4', 24, 7);
      fillPoly(l, [[bx - 12, by - 7], [bx, by - 13], [bx + 12, by - 7], [bx, by - 1]], '#f2ecdc');
      const [dx, dy] = P(p, 0.66, 0.5, 2);
      cyl(l, dx, dy, 6, 14, STEEL, { top: '#2a2e34' });
      // top shelf: flasks and a beaker, a clipboard
      const T2 = (a: number, b: number) => P(p, a, b, 8.8);
      erlen(l, T2(0.32, 0.4)[0], T2(0.32, 0.4)[1], 13, LIQ.green, 0.4);
      erlen(l, T2(0.48, 0.56)[0], T2(0.48, 0.56)[1], 11, LIQ.blue, 0.5);
      bottle(l, T2(0.66, 0.38)[0], T2(0.66, 0.38)[1], 3, 12, '#7a3e12', '#2a2a30', '#f4f1e6', RED[3]);
      const [cx, cy] = T2(0.62, 0.64);
      fillPoly(l, [[cx - 9, cy], [cx, cy - 4.5], [cx + 9, cy], [cx, cy + 4.5]], '#8a6a46');
      fillPoly(l, [[cx - 7, cy], [cx, cy - 3.5], [cx + 7, cy], [cx, cy + 3.5]], '#fbfaf2');
    }, { outline: 0.5 });
    void k;
  },
};

/** Waste: a yellow chemical-waste bin, a broken-glass box, a solvent waste can. */
const lab_waste: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.15, 0.9, 0.85, 8, 0.24);
    layer(p.c, (l) => {
      const [x, y] = P(p, 0.32, 0.4, 0);
      // the broken-glass box: a cardboard carton with a red band
      fillPoly(l, [[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6]], '#c8a878');
      px(l, x - 12, y - 18, '#b89462', 12, 18);
      px(l, x, y - 18, '#9a7a4e', 12, 18);
      fillPoly(l, [[x - 12, y - 18], [x, y - 24], [x + 12, y - 18], [x, y - 12]], '#d8bc8c');
      fillPoly(l, [[x - 12, y - 10], [x, y - 4], [x, y - 1], [x - 12, y - 7]], RED[3]);
      fillPoly(l, [[x, y - 4], [x + 12, y - 10], [x + 12, y - 7], [x, y - 1]], RED[2]);
      const [bx, by] = P(p, 0.68, 0.62, 0);
      // a pedal bin, yellow with a black lid
      cyl(l, bx, by, 10, 26, YEL, { top: '#2a2c30' });
      ell(l, bx, by - 26, 10, 5, '#3a3c40');
      ell(l, bx - 2, by - 27, 6, 3, '#4a4c52');
      px(l, bx - 4, by - 18, '#1a1a1e', 8, 6);
      px(l, bx - 3, by - 17, YEL[4], 6, 4);
      px(l, bx - 1, by - 16, '#1a1a1e', 2, 2);
      px(l, bx + 4, by - 1, '#2a2c30', 6, 2);
      // a small solvent waste can with a funnel
      const [sx, sy] = P(p, 0.7, 0.22, 0);
      bottle(l, sx, sy, 6, 18, '#eef2ee', '#e0b030', '#f6d860', '#1a1a1e');
    }, { outline: 0.55 });
    void k;
  },
};

/** Gas cylinders chained to a floor stand: nitrogen and argon, with regulators. */
const lab_gas: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.15, 0.88, 0.85, 18, 0.26);
    lbox(p, 0.14, 0.18, 0.72, 0.5, 0, 0.5, mono(anth, ANTH[0]));
    lbox(p, 0.14, 0.18, 0.05, 0.05, 0.5, 13, mono(anth, ANTH[0]));
    lbox(p, 0.81, 0.18, 0.05, 0.05, 0.5, 13, mono(anth, ANTH[0]));
    const cols: [Ramp, string][] = [
      [['#1a1c1e', '#24272a', '#30343a', '#3e434a', '#50565e', '#6a7078'], '#2a2c30'],
      [['#4a5a3a', '#5e7048', '#728656', '#889c66', '#a0b27a', '#bcc896'], '#f4f4ee'],
    ];
    layer(p.c, (l) => {
      cols.forEach(([r, shoulder], i) => {
        const [x, y] = P(p, 0.32 + i * 0.36, 0.42, 0.5);
        cyl(l, x, y, 10, 60, r, { top: null });
        // shoulder band, valve, regulator with two gauges
        ell(l, x, y - 60, 10, 5, shoulder);
        ell(l, x, y - 63, 7, 3.5, shoulder);
        px(l, x - 2, y - 72, '#b8a050', 4, 8);
        px(l, x + 2, y - 70, '#c8b060', 6, 3);
        ell(l, x + 9, y - 71, 3.5, 3.5, '#e8e8e2');
        ell(l, x + 9, y - 71, 1.5, 1.5, '#2a2a30');
        ell(l, x - 5, y - 75, 3, 3, '#e8e8e2');
        ln(l, x + 9, y - 70, x + 18 - i * 6, y - 40, '#3a6ac8');
        // the label collar
        px(l, x - 8, y - 48, '#f4f2e6', 9, 6);
        px(l, x - 8, y - 48, GRN[3], 9, 1);
      });
      // the safety chain
      const [c0x, c0y] = P(p, 0.16, 0.66, 9.4);
      const [c1x, c1y] = P(p, 0.84, 0.66, 9.4);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        px(l, c0x + (c1x - c0x) * t, c0y + (c1y - c0y) * t + Math.sin(t * Math.PI) * 3, i % 2 ? STEEL[2] : STEEL[4], 2, 1);
      }
    }, { outline: 0.55 });
    void k;
  },
};

/** An ultra-low freezer (−80 °C): white, a big handle, a little display. */
const lab_freezer: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.92, 0.88, 18, 0.28);
    lbox(p, 0.08, 0.14, 0.84, 0.72, 0, 0.8, mono(anth, ANTH[0]));
    lbox(p, 0.06, 0.12, 0.88, 0.76, 0.8, 18.2, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const F = front(p, 0.88);
    pq(p, F, 0.1, 0.9, 2.6, 17.4, LW[F.light ? 2 : 1]);
    pq(p, F, 0.12, 0.88, 2.8, 17.2, LW[F.light ? 4 : 2]);
    // a vent grille at the foot, the handle, the display and alarm lamp, a teal brand stripe
    for (let i = 0; i < 4; i++) pq(p, F, 0.2, 0.8, 1.0 + i * 0.35, 1.18 + i * 0.35, ANTH[2]);
    pq(p, F, 0.74, 0.82, 7.4, 13.4, STEEL[F.light ? 3 : 2]);
    pq(p, F, 0.74, 0.76, 7.4, 13.4, STEEL[5]);
    pq(p, F, 0.22, 0.56, 14.6, 16.2, '#14201a');
    pq(p, F, 0.12, 0.88, 17.6, 18.2, TEAL[F.light ? 4 : 3]);
    // a sample log on a clipboard and a biohazard sticker
    pq(p, F, 0.24, 0.5, 8, 11.6, '#fbfaf2');
    for (let i = 0; i < 5; i++) pq(p, F, 0.27, 0.46 - (i % 2) * 0.05, 8.4 + i * 0.6, 8.6 + i * 0.6, '#8a90a0');
    sign(p, F, 0.54, 0.7, 9.2, 11.4, 'biohaz');
    void k;
  },
  anim(p, k) {
    const u = p.k / 4;
    const F = front(p, 0.88);
    const [x, y] = F.F(0.26, 15.8);
    const n = Math.floor(k.t * 0.5 + k.seed) % 2;
    // "-80" in red digits, the second digit flickering between 0 and 1
    for (const [i, on] of [[0, 1], [1, 1], [2, n]] as const) if (on) px(p.c, x + i * 3 * u, y + (i * 1.5) * u, '#f05a4a', Math.max(1, 2 * u), Math.max(1, 3 * u));
    if (Math.sin(k.t * 1.5) > 0.4) px(p.c, x + 10 * u, y + 5 * u, '#6af08a', Math.max(1, u), Math.max(1, u));
  },
};

/** The staff fridge in the clean zone: tall, white, covered in notes. */
const lab_fridge: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.86, 18, 0.28);
    const body = coat(['#9aa4a4', '#b8c2c0', '#d2dad8', '#e4eae8', '#f2f6f4', '#ffffff']);
    lbox(p, 0.12, 0.16, 0.76, 0.68, 0, 19.4, { front: body, side: body, top: body, edge: '#8a9494' });
    const F = front(p, 0.84);
    pq(p, F, 0.14, 0.86, 12.6, 12.9, '#a8b2b0');
    pq(p, F, 0.76, 0.8, 13.8, 17.6, STEEL[3]);
    pq(p, F, 0.76, 0.8, 7.6, 11.8, STEEL[3]);
    // notes, a drawing, magnets, the "no lab samples" sign
    const notes: [number, number, string][] = [[0.2, 15.6, '#f6e07a'], [0.4, 16.4, '#f6b0c8'], [0.24, 13.6, '#a8e0f2'], [0.5, 14.2, '#fbfaf2']];
    for (const [a, z, col] of notes) {
      pq(p, F, a, a + 0.16, z, z + 1.7, col);
      pq(p, F, a + 0.03, a + 0.13, z + 0.9, z + 1.1, '#6a6a72');
    }
    sign(p, F, 0.22, 0.46, 8.4, 11.2, 'nofood');
    pq(p, F, 0.5, 0.68, 8.2, 10.6, '#fbfaf2');
    const [dx, dy] = F.F(0.59, 9.6);
    ell(p.c, dx, dy, 3, 3, '#f2c42a');
    px(p.c, dx - 4, dy + 3, '#3fb68b', 8, 1);
    void k;
  },
};

/** A lab sink unit: white cupboards, a stainless top with a deep bowl, wrist-action taps, a drench hose, a drainer. */
const lab_sink: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.05, 0.12, W - 0.05, 0.9, 10, 0.26);
    lbox(p, 0.1, 0.2, W - 0.2, 0.62, 0, 0.8, mono(anth, ANTH[0]));
    lbox(p, 0.05, 0.14, W - 0.1, 0.72, 0.8, Z - 1.4, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const F = front(p, 0.86);
    for (let i = 0; i < 3; i++) {
      const u0 = 0.08 + ((W - 0.16) * i) / 3;
      const u1 = 0.08 + ((W - 0.16) * (i + 1)) / 3 - 0.02;
      pq(p, F, u0, u1, 1.0, Z - 0.9, LW[F.light ? 2 : 1]);
      pq(p, F, u0 + 0.02, u1 - 0.02, 1.1, Z - 1.0, LW[F.light ? 4 : 2]);
      handle(p, F, u1 - 0.18, u1 - 0.08, Z - 2.2, TEAL);
    }
    // the stainless top with an upstand, the bowl sunk into it
    lbox(p, 0.02, 0.1, W - 0.04, 0.8, Z - 0.6, 0.6, mono(steel, STEEL[1]));
    lbox(p, 0.02, 0.1, W - 0.04, 0.08, Z, 1.6, mono(steel, STEEL[1]));
    const [bx, by] = P(p, 0.62, 0.5, Z);
    fillPoly(p.c, [[bx - 18, by], [bx, by - 9], [bx + 18, by], [bx, by + 9]], STEEL[1]);
    fillPoly(p.c, [[bx - 15, by], [bx, by - 7.5], [bx + 15, by], [bx, by + 7.5]], '#3a4048');
    fillPoly(p.c, [[bx - 15, by], [bx, by - 7.5], [bx + 2, by - 6.5], [bx - 13, by + 1]], '#5a626a');
    ell(p.c, bx + 2, by + 2, 2.5, 1.2, '#1a1c20');
    // drainer grooves on the right
    for (let i = 0; i < 5; i++) {
      const [g0x, g0y] = P(p, 1.2 + i * 0.1, 0.25, Z);
      const [g1x, g1y] = P(p, 1.2 + i * 0.1, 0.75, Z);
      ln(p.c, g0x, g0y, g1x, g1y, STEEL[3]);
    }
    layer(p.c, (l) => {
      // gooseneck tap with wrist-action levers, a drench hose on the left, a soap pump
      const [tx, ty] = P(p, 0.62, 0.2, Z + 1.6);
      px(l, tx - 1, ty - 16, STEEL[5], 2, 16);
      curve(l, tx, ty - 16, tx + 2, ty - 24, tx + 9, ty - 18, STEEL[5], 2);
      px(l, tx + 8, ty - 18, STEEL[4], 2, 4);
      ln(l, tx - 2, ty - 6, tx - 9, ty - 9, STEEL[4], 2);
      ln(l, tx + 2, ty - 6, tx + 9, ty - 4, STEEL[4], 2);
      const [hx, hy] = P(p, 0.24, 0.24, Z + 1.6);
      px(l, hx - 2, hy - 10, GRN[3], 4, 10);
      px(l, hx - 3, hy - 13, GRN[4], 6, 3);
      curve(l, hx + 2, hy - 2, hx + 10, hy + 4, hx + 4, hy + 8, '#c8ccd0', 1);
      const [sx, sy] = P(p, 0.95, 0.24, Z + 1.6);
      px(l, sx - 2, sy - 8, '#e8eeee', 4, 8);
      px(l, sx - 1, sy - 11, '#3a3e44', 2, 3);
      px(l, sx - 1, sy - 6, TEAL[4], 2, 3);
      // glassware drying upside down on the drainer
      const [dx, dy] = P(p, 1.45, 0.5, Z);
      fillPoly(l, [[dx - 6, dy - 12], [dx - 2, dy - 12], [dx + 2, dy], [dx - 10, dy]], '#a8c8d0');
      fillPoly(l, [[dx - 5, dy - 11], [dx - 3, dy - 11], [dx + 1, dy - 1], [dx - 9, dy - 1]], '#e8f6f8');
      px(l, dx + 6, dy - 12, '#a8c8d0', 7, 12);
      px(l, dx + 7, dy - 11, '#e8f6f8', 5, 10);
      px(l, dx + 7, dy - 11, '#ffffff', 1, 8);
      const [ex, ey] = P(p, 1.72, 0.62, Z);
      fillPoly(l, [[ex - 4, ey - 9], [ex + 4, ey - 9], [ex + 6, ey], [ex - 6, ey]], '#a8c8d0');
      fillPoly(l, [[ex - 3, ey - 8], [ex + 3, ey - 8], [ex + 5, ey - 1], [ex - 5, ey - 1]], '#e8f6f8');
      // a bottle brush and a wash bottle
      ln(l, ex - 14, ey + 2, ex - 4, ey - 2, '#c89a5a', 1);
      px(l, ex - 4, ey - 4, '#f2f2ee', 5, 3);
    }, { outline: 0.5 });
    void k;
  },
};

/** A mobile whiteboard on castors with reaction schemes and a plot. */
const lab_board: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.3, 0.85, 0.7, 14, 0.22);
    // H-frame legs with castors
    for (const a of [0.14, 0.82]) {
      lbox(p, a, 0.3, 0.04, 0.4, 0.4, 0.3, mono(steel, STEEL[1]));
      lbox(p, a, 0.48, 0.04, 0.04, 0.7, 19.6, mono(steel, STEEL[1]));
      for (const b of [0.32, 0.66]) {
        const [cx, cy] = P(p, a + 0.02, b, 0);
        ell(p.c, cx, cy - 2, 2.5, 1.5, '#2a2c30');
      }
    }
    // the board (white enamel in an aluminium frame), facing the room
    lbox(p, 0.16, 0.5, 0.68, 0.03, 8, 11.6, { front: coat(['#c4cac8', '#d8dedc', '#e8eeec', '#f4f8f6', '#fbfdfc', '#ffffff']), side: steel, top: steel, edge: STEEL[1] });
    const F = front(p, 0.53);
    pq(p, F, 0.16, 0.84, 8, 8.3, STEEL[3]);
    pq(p, F, 0.16, 0.84, 19.3, 19.6, STEEL[4]);
    pq(p, F, 0.16, 0.84, 8.3, 8.8, STEEL[2]);
    // marker drawings: a benzene ring, an arrow, a second ring, a curve, a note
    const L = (ua: number, za: number, ub: number, zb: number, col: string) => {
      const [x0, y0] = F.F(ua, za);
      const [x1, y1] = F.F(ub, zb);
      ln(p.c, x0, y0, x1, y1, col);
    };
    const hex = (uc: number, zc: number, r: number, col: string) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([uc + Math.cos(a) * r * 0.16, zc + Math.sin(a) * r * 2.4]);
      }
      for (let i = 0; i < 6; i++) L(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], col);
      L(uc + r * 0.07, zc + r * 1.2, uc + r * 0.13, zc - r * 0.2, col);
    };
    hex(0.32, 16.4, 0.9, '#2a5aa8');
    L(0.3, 18.5, 0.3, 19.0, '#2a5aa8');
    L(0.42, 16.4, 0.56, 16.4, '#c8382a');
    L(0.53, 16.8, 0.56, 16.4, '#c8382a');
    L(0.53, 16.0, 0.56, 16.4, '#c8382a');
    hex(0.68, 16.4, 0.8, '#2a5aa8');
    L(0.72, 18.2, 0.78, 18.8, '#2a5aa8');
    // a titration curve and its axes
    L(0.24, 10.2, 0.24, 13.6, '#2a2a30');
    L(0.24, 10.2, 0.56, 10.2, '#2a2a30');
    for (let i = 0; i < 8; i++) {
      const f0 = i / 8;
      const f1 = (i + 1) / 8;
      const z0 = 10.6 + 2.6 / (1 + Math.exp(-(f0 - 0.6) * 18));
      const z1 = 10.6 + 2.6 / (1 + Math.exp(-(f1 - 0.6) * 18));
      L(0.26 + f0 * 0.28, z0, 0.26 + f1 * 0.28, z1, '#3fb68b');
    }
    pq(p, F, 0.62, 0.76, 10.6, 12.6, '#f6e07a');
    pq(p, F, 0.64, 0.74, 11.6, 11.8, '#6a6a72');
    // the marker tray with markers
    const [mx, my] = F.F(0.34, 8.6);
    px(p.c, mx, my, '#2a5aa8', 5, 1);
    px(p.c, mx + 7, my + 3, '#c8382a', 5, 1);
    px(p.c, mx + 14, my + 7, '#2a2a30', 5, 1);
    void k;
  },
};

/** The spill response station: a yellow spill-kit bin and a folded caution sign. */
const lab_spill: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.16, 0.88, 0.86, 10, 0.24);
    const [x, y] = P(p, 0.44, 0.48, 0);
    layer(p.c, (l) => {
      // the bin: a yellow wheelie body, black lid, the label band
      fillPoly(l, [[x - 14, y - 2], [x, y - 9], [x + 14, y - 2], [x, y + 5]], YEL[1]);
      fillPoly(l, [[x - 14, y - 2], [x, y + 5], [x, y - 28], [x - 14, y - 35]], YEL[4]);
      fillPoly(l, [[x, y + 5], [x + 14, y - 2], [x + 14, y - 35], [x, y - 28]], YEL[2]);
      fillPoly(l, [[x - 15, y - 35], [x, y - 43], [x + 15, y - 35], [x, y - 27]], '#2a2c30');
      fillPoly(l, [[x - 15, y - 35], [x, y - 27], [x, y - 25], [x - 15, y - 33]], '#3a3c42');
      fillPoly(l, [[x - 13, y - 22], [x - 1, y - 16], [x - 1, y - 10], [x - 13, y - 16]], '#1e1e22');
      px(l, x - 12, y - 19, YEL[5], 2, 3);
      px(l, x - 9, y - 18, YEL[5], 2, 3);
      px(l, x - 6, y - 16, YEL[5], 2, 3);
      ell(l, x + 11, y - 1, 3, 3, '#1e1e22');
      // the folded caution sign leaning on the bin
      const [sx, sy] = P(p, 0.84, 0.7, 0);
      fillPoly(l, [[sx - 4, sy], [sx, sy - 22], [sx + 4, sy - 22], [sx + 6, sy]], YEL[3]);
      fillPoly(l, [[sx - 3, sy - 2], [sx + 0.5, sy - 20], [sx + 3, sy - 20], [sx + 4.5, sy - 2]], YEL[4]);
      fillPoly(l, [[sx - 1, sy - 8], [sx + 1, sy - 14], [sx + 3, sy - 8]], '#1e1e22');
    }, { outline: 0.55 });
    void k;
  },
};

/** A write-up desk: a monitor with a molecule, papers, lab notebooks, a teal task chair. */
const lab_desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7.4;
    footShadow(p, 0.08, 0.12, W - 0.08, 0.9, 8, 0.24);
    // white top on steel frame legs, a cable tray, a drawer unit
    for (const a of [0.12, W - 0.18]) {
      lbox(p, a, 0.18, 0.06, 0.64, 0, 0.4, mono(steel, STEEL[1]));
      lbox(p, a, 0.48, 0.06, 0.06, 0.4, Z - 0.9, mono(steel, STEEL[1]));
    }
    lbox(p, 0.3, 0.22, 0.42, 0.58, 0, Z - 0.6, { front: lwCoat, side: lwCoat, top: lwCoat, edge: LW[0] });
    const F = front(p, 0.8);
    for (const z of [1.4, 3.6, 5.4]) handle(p, F, 0.42, 0.6, z, TEAL);
    lbox(p, 0.08, 0.12, W - 0.16, 0.76, Z - 0.5, 0.5, { front: lwCoat, side: lwCoat, top: coat(['#c8d0d0', '#dae0e0', '#e8eeee', '#f2f6f6', '#fafcfc', '#ffffff']), edge: LW[0] });
    const T2 = (a: number, b: number) => P(p, a, b, Z);
    layer(p.c, (l) => {
      // monitor on a stand
      const [mx, my] = T2(0.9, 0.34);
      px(l, mx - 2, my - 12, ANTH[2], 4, 12);
      fillPoly(l, [[mx - 9, my + 2], [mx + 3, my - 4], [mx + 9, my - 1], [mx - 3, my + 5]], ANTH[1]);
      fillPoly(l, [[mx - 20, my - 10], [mx + 18, my - 29], [mx + 18, my - 54], [mx - 20, my - 35]], ANTH[0]);
      fillPoly(l, [[mx - 18, my - 12], [mx + 16, my - 29], [mx + 16, my - 52], [mx - 18, my - 35]], '#122030');
      // keyboard and mouse, a stack of papers, two lab notebooks
      const [kx, ky] = T2(1.0, 0.66);
      fillPoly(l, [[kx - 16, ky + 2], [kx + 4, ky - 8], [kx + 16, ky - 2], [kx - 4, ky + 8]], '#d8dcdc');
      fillPoly(l, [[kx - 14, ky + 2], [kx + 4, ky - 7], [kx + 14, ky - 2], [kx - 4, ky + 7]], '#eef0f0');
      ell(l, kx + 20, ky - 2, 3, 2, '#e8eaea');
      const [px0, py0] = T2(0.4, 0.55);
      for (let i = 0; i < 3; i++) fillPoly(l, [[px0 - 11, py0 - i], [px0, py0 - 5.5 - i], [px0 + 11, py0 - i], [px0, py0 + 5.5 - i]], i === 2 ? '#fbfbf6' : '#e8e6de');
      const [nx, ny] = T2(1.62, 0.5);
      fillPoly(l, [[nx - 11, ny], [nx, ny - 5.5], [nx + 11, ny], [nx, ny + 5.5]], '#2a3a5a');
      fillPoly(l, [[nx - 11, ny - 3], [nx, ny - 8.5], [nx + 11, ny - 3], [nx, ny + 2.5]], '#7a2a2a');
      px(l, nx - 2, ny - 5, '#f4f1e6', 5, 2);
      // a tube rack of samples waiting to be logged
      const [rx, ry] = T2(1.75, 0.28);
      fillPoly(l, [[rx - 8, ry], [rx, ry - 4], [rx + 8, ry], [rx, ry + 4]], '#5a8ae8');
      for (let i = 0; i < 4; i++) px(l, rx - 6 + i * 3, ry - 8 - (i % 2), [LIQ.yellow, LIQ.pink, LIQ.blue, LIQ.clear][i], 2, 7);
    }, { outline: 0.5 });
    // the task chair, rolled back a little
    const [cx, cy] = P(p, 0.95, 1.05, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.4;
        const ex = cx + Math.cos(ang) * 10;
        const ey = cy + Math.sin(ang) * 4.5;
        ln(l, cx, cy - 3, ex, ey - 2, '#3a3e44', 2);
        px(l, ex - 1, ey - 2, '#1e2024', 3, 3);
      }
      px(l, cx - 1, cy - 15, STEEL[4], 3, 12);
      ell(l, cx, cy - 17, 12, 5, TEAL[1]);
      ell(l, cx - 1, cy - 18, 11, 4, TEAL[3]);
      fillPoly(l, [[cx - 9, cy - 21], [cx + 8, cy - 24], [cx + 9, cy - 40], [cx - 8, cy - 37]], TEAL[2]);
      fillPoly(l, [[cx - 7, cy - 23], [cx + 6, cy - 25], [cx + 7, cy - 38], [cx - 6, cy - 36]], TEAL[3]);
    }, { outline: 0.55 });
    void k;
  },
  anim(p, k) {
    // the molecule on the screen turns slowly: atoms on a ring with bonds
    const u = p.k / 4;
    const [mx, my] = P(p, 0.9, 0.34, 7.4);
    const cx = mx;
    const cy = my - 33 * u;
    const c = p.c;
    const pts: [number, number, string][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k.t * 0.6;
      pts.push([cx + Math.cos(a) * 9 * u, cy + Math.sin(a) * 4 * u + Math.cos(a) * 2 * u, i === 2 ? '#e84a3a' : i === 5 ? '#4a8ae8' : '#c8ccd0']);
    }
    for (let i = 0; i < 6; i++) ln(c, pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], '#6a8aa8');
    for (const [x, y, col] of pts) px(c, x - u, y - u, col, Math.max(1, 3 * u), Math.max(1, 3 * u));
  },
};

/** An inert-atmosphere glove box: a stainless chamber on a cabinet, a sloped acrylic window with glove ports, an antechamber. */
const lab_glovebox: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = 0.86;
    footShadow(p, 0.05, 0.1, W - 0.05, D, 16, 0.26);
    // the base cabinet
    lbox(p, 0.12, 0.16, W - 0.24, D - 0.2, 0, 0.7, mono(anth, ANTH[0]));
    lbox(p, 0.08, 0.12, W - 0.16, D - 0.12, 0.7, 7.6, { front: steel, side: steel, top: steel, edge: STEEL[1] });
    const F = front(p, D);
    for (const [u0, u1] of [[0.12, W / 2 - 0.02], [W / 2 + 0.02, W - 0.12]] as const) {
      pq(p, F, u0, u1, 1, 8, STEEL[F.light ? 2 : 1]);
      pq(p, F, u0 + 0.02, u1 - 0.02, 1.1, 7.9, STEEL[F.light ? 4 : 2]);
      handle(p, F, (u0 + u1) / 2 - 0.08, (u0 + u1) / 2 + 0.08, 7, STEEL);
    }
    // the chamber: floor, back wall and end walls in brushed steel
    const Z0 = 8.3;
    const Z1 = 18.2;
    const BW = 0.5; // the back wall's front face
    lbox(p, 0.06, 0.12, W - 0.12, D - 0.12, Z0, 0.9, { front: steel, side: steel, top: coat(['#8e969c', '#a6aeb4', '#bcc4ca', '#d0d6da', '#e0e4e8', '#eef0f2']), edge: STEEL[1] });
    lbox(p, 0.06, 0.12, W - 0.12, BW - 0.12, Z0, Z1 - Z0, { front: coat(['#7e868c', '#949ca2', '#aab2b8', '#c0c6cc', '#d2d8dc', '#e2e6ea']), side: steel, top: steel, edge: STEEL[1] });
    // the interior: a balance, a tube rack, a beaker of purple solution, two dangling gloves
    const T = (a: number, b: number) => P(p, a, b, Z0 + 0.9);
    layer(p.c, (l) => {
      const [bx, by] = T(0.55, 0.64);
      fillPoly(l, [[bx - 9, by], [bx, by - 4.5], [bx + 9, by], [bx, by + 4.5]], '#e4e8e8');
      px(l, bx - 9, by - 5, '#c8ced0', 18, 5);
      fillPoly(l, [[bx - 9, by - 5], [bx, by - 9.5], [bx + 9, by - 5], [bx, by - 0.5]], '#f4f6f6');
      ell(l, bx, by - 6, 5, 2.2, STEEL[4]);
      px(l, bx - 6, by - 2, '#1e3a2a', 5, 2);
      tubeRackSmall(l, T(1.05, 0.62)[0], T(1.05, 0.62)[1]);
      beakerSmall(l, T(1.48, 0.68)[0], T(1.48, 0.68)[1]);
      for (const a of [W * 0.3, W * 0.7]) {
        // a black butyl glove hanging from its port into the chamber
        const [gx, gy] = P(p, a, D - 0.12, Z0 + 4.6);
        fillPoly(l, [[gx - 5, gy - 2], [gx + 5, gy - 2], [gx + 3, gy + 11], [gx - 4, gy + 12]], '#22242a');
        fillPoly(l, [[gx - 4, gy + 11], [gx + 3, gy + 10], [gx + 4, gy + 15], [gx - 5, gy + 16]], '#2a2c32');
        px(l, gx - 3, gy, '#3c4048', 2, 10);
      }
    }, { outline: 0.4 });
    // the sloped window: tinted acrylic with two reflection bands
    const WIN: [number, number, number][] = [[0.08, D - 0.02, Z0 + 0.9], [W - 0.08, D - 0.02, Z0 + 0.9], [W - 0.08, BW + 0.02, Z1 - 0.6], [0.08, BW + 0.02, Z1 - 0.6]];
    p.c.globalAlpha = 0.34;
    poly3(p, WIN, () => '#9cc8d4', 2);
    p.c.globalAlpha = 0.7;
    poly3(p, WIN, (u: number, v: number) => {
      const d = (u * 0.55 + v) % 64;
      return d < 5 ? '#ffffff' : d > 9 && d < 11 ? '#e8f8fa' : null;
    }, 2);
    p.c.globalAlpha = 1;
    // the glove ports: steel rings on the window
    for (const a of [W * 0.3, W * 0.7]) {
      const [gx, gy] = P(p, a, D - 0.18, Z0 + 4.6);
      layer(p.c, (l) => {
        ell(l, gx, gy, 8, 6.5, STEEL[2]);
        ell(l, gx, gy, 6.5, 5, 'rgba(0,0,0,0)');
        ell(l, gx - 1, gy - 1, 7, 5.5, STEEL[5]);
        ell(l, gx, gy, 5.5, 4.2, '#1a1c20');
        px(l, gx - 3, gy - 2, '#3a3e46', 3, 2);
      }, { outline: 0.5, rect: [gx - 11, gy - 9, gx + 11, gy + 9] });
    }
    // the frame round the window and the chamber's roof with its light strip and controls
    const edge = (a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, col: string, w = 2) => {
      const [x0, y0] = P(p, a0, b0, z0);
      const [x1, y1] = P(p, a1, b1, z1);
      ln(p.c, x0, y0, x1, y1, col, w);
    };
    edge(0.08, D - 0.02, Z0 + 0.9, W - 0.08, D - 0.02, Z0 + 0.9, STEEL[5], 3);
    edge(0.08, D - 0.02, Z0 + 0.9, 0.08, BW + 0.02, Z1 - 0.6, STEEL[4], 3);
    edge(W - 0.08, D - 0.02, Z0 + 0.9, W - 0.08, BW + 0.02, Z1 - 0.6, STEEL[2], 3);
    lbox(p, 0.04, 0.1, W - 0.08, BW + 0.08 - 0.1, Z1 - 0.6, 1.2, { front: steel, side: steel, top: coat(['#9aa2a8', '#b2bac0', '#c8ced4', '#dce0e4', '#eceef0', '#fafbfc']), edge: STEEL[1] });
    const RF = front(p, BW + 0.08);
    pq(p, RF, 0.2, W - 0.7, Z1 - 0.45, Z1 + 0.1, '#fff8de');
    pq(p, RF, W - 0.62, W - 0.2, Z1 - 0.5, Z1 + 0.4, '#2a2e34');
    pq(p, RF, W - 0.58, W - 0.4, Z1 - 0.35, Z1 + 0.25, '#10221a');
    // the antechamber: a horizontal steel cylinder out of the right end, a round door with a clamp wheel
    if (p.rot === 0) {
      hcyl(p, W - 0.08, W + 0.06, 0.48, Z0 + 4.4, 0.24, STEEL);
      const [dx, dy] = P(p, W + 0.07, 0.48, Z0 + 4.4);
      ell(p.c, dx, dy, 4, 3, '#3a3e44');
      ell(p.c, dx, dy, 1.5, 1.2, STEEL[5]);
    }
    // a pressure gauge on the end wall
    const SV = side(p, p.rot === 0 ? W - 0.06 : 0.06);
    const [ox2, oy2] = SV.F(0.3, Z1 - 2.4);
    ell(p.c, ox2, oy2, 4, 4, '#e8ecec');
    ell(p.c, ox2, oy2, 3, 3, '#f6f6f2');
    ln(p.c, ox2, oy2, ox2 + 2, oy2 - 2, '#c8382a');
    void k;
  },
  anim(p, k) {
    // the O2 / H2O readout on the roof panel blinks
    const u = p.k / 4;
    const RF = front(p, 0.58);
    const [cx, cy] = RF.F(k.w - 0.5, 17.9);
    if (Math.floor(k.t * 0.8) % 2) px(p.c, cx, cy, '#5ae08a', Math.max(1, 3 * u), Math.max(1, u));
  },
};

/** A rotary evaporator on a small trolley: the heated bath, the tilted spinning flask, the coil condenser, the receiver. */
const lab_rotavap: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.18, 0.88, 0.84, 14, 0.24);
    const Z = 6.6;
    for (const [a, b] of [[0.16, 0.22], [0.8, 0.22], [0.16, 0.76], [0.8, 0.76]] as const) {
      lbox(p, a, b, 0.04, 0.04, 0.8, Z - 0.8, mono(steel, STEEL[1]));
      const [wx, wy] = P(p, a + 0.02, b + 0.02, 0);
      ell(p.c, wx, wy - 2, 3, 2, '#2a2c30');
    }
    lbox(p, 0.14, 0.2, 0.72, 0.6, 1.6, 0.3, mono(steel, STEEL[1]));
    lbox(p, 0.12, 0.18, 0.76, 0.64, Z, 0.4, { front: steel, side: steel, top: coat(['#c4ccd0', '#d6dde0', '#e4eaec', '#eef2f4', '#f6f9fa', '#ffffff']), edge: STEEL[1] });
    // the lower shelf: the vacuum controller and a diaphragm pump
    layer(p.c, (l) => {
      const [vx, vy] = P(p, 0.36, 0.5, 1.9);
      px(l, vx - 9, vy - 10, '#e8eeee', 18, 10);
      px(l, vx - 9, vy - 10, '#ffffff', 5, 10);
      px(l, vx - 6, vy - 8, '#10221a', 8, 3);
      px(l, vx - 5, vy - 7, '#5ae08a', 5, 1);
      const [px0, py0] = P(p, 0.66, 0.5, 1.9);
      ell(l, px0, py0 - 3, 8, 4, '#3a3e44');
      px(l, px0 - 8, py0 - 11, '#4a5058', 16, 8);
      px(l, px0 - 8, py0 - 11, '#6a7078', 4, 8);
      ell(l, px0, py0 - 11, 8, 4, '#2a2e34');
    }, { outline: 0.5 });
    const T = (a: number, b: number, z = 0) => P(p, a, b, Z + 0.4 + z);
    layer(p.c, (l) => {
      // the column and the motor drive at the back right
      const [mx, my] = T(0.66, 0.32);
      px(l, mx - 3, my - 56, STEEL[3], 6, 56);
      px(l, mx - 3, my - 56, STEEL[5], 2, 56);
      fillPoly(l, [[mx - 12, my - 30], [mx + 6, my - 36], [mx + 8, my - 24], [mx - 10, my - 18]], '#e2e8ea');
      fillPoly(l, [[mx - 12, my - 30], [mx - 10, my - 18], [mx - 12, my - 16], [mx - 14, my - 28]], '#b8c2c4');
      px(l, mx - 6, my - 27, '#1e3a2a', 6, 3);
      px(l, mx - 5, my - 26, '#5ae08a', 3, 1);
      // the heating bath at the front left: a round steel pot with blue water
      const [bx, by] = T(0.36, 0.62);
      ell(l, bx, by, 16, 8, STEEL[2]);
      px(l, bx - 16, by - 10, STEEL[3], 32, 10);
      px(l, bx - 16, by - 10, STEEL[5], 6, 10);
      px(l, bx + 10, by - 10, STEEL[1], 6, 10);
      ell(l, bx, by - 10, 16, 8, STEEL[4]);
      ell(l, bx, by - 10, 14, 6.5, '#3a8ab8');
      ell(l, bx - 4, by - 11, 6, 2.2, '#7ac0e0');
      // the vapour duct from the drive down to the flask, the evaporation flask half in the bath
      ln(l, mx - 10, my - 24, bx + 2, by - 16, '#cfe4ea', 3);
      ln(l, mx - 10, my - 25, bx + 2, by - 17, '#f6fcfd', 1);
      ell(l, bx + 1, by - 15, 9, 8, '#9fc3cb');
      ell(l, bx + 1, by - 15, 8, 7, '#e6f4f6');
      ell(l, bx + 1, by - 12, 7, 3.5, '#e8a83a');
      px(l, bx - 4, by - 19, '#ffffff', 2, 2);
      // the coil condenser rising above the drive, a receiving flask hanging below it
      const cx = mx + 2;
      const cy = my - 58;
      px(l, cx - 5, cy - 34, '#9fc3cb', 10, 36);
      px(l, cx - 4, cy - 33, '#e8f6f8', 8, 34);
      for (let i = 0; i < 9; i++) ln(l, cx - 3, cy - 30 + i * 3.6, cx + 3, cy - 28 + i * 3.6, '#7ab0c0');
      px(l, cx - 2, cy - 38, '#9fc3cb', 4, 4);
      ln(l, cx + 5, cy - 6, cx + 12, cy - 2, '#3a6ac8', 2);
      ln(l, cx + 5, cy - 26, cx + 12, cy - 30, '#cfdfe4', 2);
      const [rx, ry] = T(0.76, 0.5, 9.5);
      ell(l, rx, ry, 7, 6, '#9fc3cb');
      ell(l, rx, ry, 6, 5, '#e6f4f6');
      ell(l, rx, ry + 2, 5, 2.4, '#f2e8b8');
      ln(l, cx, my - 36, rx, ry - 6, '#cfe4ea', 2);
    }, { outline: 0.5 });
    void k;
  },
  anim(p, k) {
    // the flask turns: a highlight runs round it; the bath's display blinks
    const u = p.k / 4;
    const [bx, by] = P(p, 0.36, 0.62, 7);
    const t = k.t * 3;
    px(p.c, bx + 1 * u + Math.cos(t) * 5 * u, by - 15 * u + Math.sin(t) * 2 * u, '#ffffff', Math.max(1, 2 * u), Math.max(1, u));
  },
};

/** Supply cartons: pipette tips, gloves, wipes, a carton opened, a hand truck behind. */
const lab_boxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.14, 0.88, 0.88, 8, 0.24);
    const KR: Ramp = ['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70', '#e6c48c'];
    const box: Mat = (light) => (u, v, x, y) => {
      let i = light === 2 ? 4 : light === 1 ? 3 : 2;
      if (u % 3 < 0.7) i -= 0.4;
      if (hash(x, y, 4) < 0.04) i -= 0.6;
      if (Math.abs(v - 6) < 0.8 && light !== 2) i += 0.6;
      return at(KR, i);
    };
    // the hand truck leaning behind
    const [hx, hy] = P(p, 0.82, 0.22, 0);
    layer(p.c, (l) => {
      ln(l, hx - 6, hy, hx - 2, hy - 46, '#3a3e44', 2);
      ln(l, hx + 6, hy - 2, hx + 10, hy - 48, '#3a3e44', 2);
      ln(l, hx - 2, hy - 46, hx + 10, hy - 48, '#5a6068', 2);
      ell(l, hx - 6, hy - 2, 3, 3, '#1e1e22');
      ell(l, hx + 7, hy - 4, 3, 3, '#1e1e22');
    }, { outline: 0.5 });
    const stack: [number, number, number, number, number, string][] = [
      [0.16, 0.22, 0.56, 0.5, 0, 'TIPS'],
      [0.2, 0.26, 0.48, 0.42, 3.4, 'NITRILE'],
      [0.56, 0.6, 0.32, 0.3, 0, ''],
    ];
    for (const [a, b, w, d, z, lab] of stack) {
      lbox(p, a, b, w, d, z, 3.4, mono(box, '#5a3e22'));
      const F = front(p, b + d);
      if (lab) {
        pq(p, F, a + w * 0.15, a + w * 0.85, z + 1.2, z + 2.6, '#f6f0e2');
        planeText(p, F, a + w * 0.15, a + w * 0.85, z + 1.2, z + 2.6, lab, '#2a5aa8');
      }
      pq(p, F, a, a + w, z + 2.9, z + 3.2, '#c8b080');
    }
    // the open carton on top shows a box of blue gloves
    const [ox, oy] = P(p, 0.44, 0.47, 6.8);
    px(p.c, ox - 6, oy - 5, '#5a8ae8', 12, 5);
    px(p.c, ox - 6, oy - 5, '#8ab0f4', 12, 1);
    px(p.c, ox - 2, oy - 7, '#a8c8f8', 4, 2);
    void k;
  },
};

export const CHEMLAB_ROOM2: Record<string, PropArt> = { drum, cabinet, shower, counter, cafeTable, plant, lowWall, lab_cart, lab_waste, lab_gas, lab_freezer, lab_fridge, lab_sink, lab_board, lab_spill, lab_desk, lab_glovebox, lab_rotavap, lab_boxes };

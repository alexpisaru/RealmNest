// Logistics Port — the playable quay at 128×64 (1 z ≈ 10 cm; a person ≈ 17.5 z).
//   container  10-ft boxes in corrugated steel: corner posts and castings,
//              stencilled codes, rust runs, a door end with locking bars; the
//              loading bays stand open with cargo inside
//   desk       the dispatch post: a steel standing desk under a canopy
//   booth      the control room: a glazed cabin on stilts with a stair
//   kiosk      the tracking terminal: a rugged screen on a yellow pedestal
//   crane      a rail-mounted portal crane with a luffing lattice jib
//   rack       outdoor pallet racking under a lean-to roof
//   forklift   a yellow counterbalance truck carrying a pallet
//   boat       a blue fishing boat moored at the wall (water lies QD below)
//   bollard · vending · bench · crate · barrel
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, front3, type Plane, poly3, pq, pt, side } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { archOn, coil, corr, deckFill, gullStand, planks, plate, rope, stencil, text, wheelOn } from './kit';
import { QD } from './layout';
import { GALV, GLASS, IRON, P, type PaintName, ROPE, RUST, STEEL, TIMBERW } from './palette';

const KRAFT: Ramp = ['#5a3e22', '#76522c', '#92683a', '#ac7e4a', '#c4945c', '#d8ac72'];
const WRAP: Ramp = ['#7a7e86', '#9a9ea4', '#b8bcc0', '#d4d6d8', '#eceeee', '#ffffff'];
const PINE: Ramp = ['#5e4228', '#7a5834', '#967042', '#b08852', '#c6a066', '#d8b67e'];
const GREY = P.grey;
const WHITE = P.white;

const glass: Mat = (light, w) => (u, v, x, y) => {
  const d = (u * 0.8 + v) % 30;
  let i = light === 0 ? 1.6 : 2.4;
  if (d > 4 && d < 8) i += 2;
  else if (d > 12 && d < 13.5) i += 1.2;
  if (v < 3) i -= 0.8;
  if (hash(x, y, 91) < 0.02) i += 1;
  void w;
  return at(GLASS, i);
};

// ── containers ───────────────────────────────────────────────
const CODES = ['PRTU', 'NSTU', 'HLXU', 'MSKU', 'TGHU', 'CAIU', 'OOLU', 'SEGU', 'TCNU', 'GESU', 'MRKU', 'BMOU'];
export const boxCode = (seed: number) => `${CODES[seed % CODES.length]} ${String(100000 + Math.floor(hash(seed, 3, 7) * 899999))}`;
const LOGOS = ['REALMNEST', 'OCEANA', 'NORDLINE', 'HANSA', 'MARLIN', 'POLARIS'];
export const boxLogo = (seed: number) => LOGOS[seed % LOGOS.length];

/** The door end of a box: two leaves with horizontal flutes, four locking bars, a gap between. */
const doorMat =
  (r: Ramp, seed: number): Mat =>
  (light, w, h) =>
  (u, v, x, y) => {
    const m = w / 2;
    if (Math.abs(u - m) < 0.9) return r[0];
    for (const bu of [m * 0.3, m * 0.72, m * 1.28, m * 1.7]) if (Math.abs(u - bu) < 1) return at(GALV, (light === 0 ? 2.4 : 4) + (u < bu ? 0.8 : 0) - (hash(Math.floor(v / 3), seed, 92) < 0.25 ? 1.2 : 0));
    let i = (light === 0 ? 1.4 : 3) + 0.2;
    const f = ((v / h) * 5) % 1;
    if (f < 0.12) i += 0.7;
    else if (f > 0.86) i -= 0.6;
    if (v < 7 && hash(Math.floor(u / 2), Math.floor(v / 2), seed) < 0.35) return at(RUST, 2 + (light === 0 ? -0.6 : 0.5));
    if (hash(x, y, 93) < 0.025) i -= 0.8;
    return at(r, i);
  };

/** The box roof: shallow transverse ribs, grime, a few rust spots. */
const roofMat =
  (r: Ramp, seed: number): Mat =>
  () =>
  (u, v, x, y) => {
    let i = r.length - 2.3;
    if (u % 9 < 1.2) i -= 0.8;
    if (hash(Math.floor(u / 6), Math.floor(v / 5), seed + 94) < 0.015) return at(RUST, 3);
    if (hash(x, y, 95) < 0.05) i -= 0.7;
    return at(r, i);
  };

export interface BoxOpts {
  seed: number;
  rust?: number;
  doors?: 'closed' | 'open' | 'blank';
  cargo?: 'loading' | 'unloading';
  code?: boolean;
  logo?: boolean;
  /** draw only what shows (stacks): the front face, the side face, the roof */
  faces?: { front?: boolean; side?: boolean; top?: boolean };
  /** distant boxes: castings as plain blocks */
  cheap?: boolean;
}

/**
 * A shipping container standing on its corner castings, from local (a0, b0)
 * with length L along a, depth D along b, z0 … z0 + H. Front = long side.
 */
export function drawBox(p: PropPainter, a0: number, b0: number, L: number, D: number, z0: number, H: number, r: Ramp, o: BoxOpts) {
  const s = o.seed;
  const fc = o.faces ?? { front: true, side: true, top: true };
  const ef = r[0];
  const body = corr(r, 10, o.rust ?? 0.5, s);
  const end = o.doors === 'blank' ? corr(r, 10, o.rust ?? 0.5, s + 1) : doorMat(r, s);
  lbox(p, a0, b0, L, D, z0, H, { front: fc.front ? body : undefined, side: fc.side ? end : undefined, top: fc.top ? roofMat(r, s) : undefined, edge: ef });
  const F = front(p, b0 + D);
  const S = side(p, a0 + L);
  const post = darken(r[2], 0.12);
  const postL = r[3];
  if (fc.front) {
    // top and bottom rails, the corner posts, two forklift pockets
    pq(p, F, a0, a0 + L, z0 + H - 1.1, z0 + H, r[F.light ? 4 : 2]);
    pq(p, F, a0, a0 + L, z0 + H - 1.25, z0 + H - 1.1, r[1]);
    pq(p, F, a0, a0 + L, z0, z0 + 1.3, darken(r[2], 0.2));
    // (second pass) the dark seam under the box (the gap to the box or the ground below)
    pq(p, F, a0, a0 + L, z0, z0 + 0.45, '#141218');
    pq(p, F, a0, a0 + L, z0 + H - 0.35, z0 + H, r[r.length - 1]);
    pq(p, F, a0, a0 + 0.05, z0, z0 + H, postL);
    pq(p, F, a0 + L - 0.05, a0 + L, z0, z0 + H, post);
    if (L < 2.6) for (const fa of [0.32, 0.62]) pq(p, F, a0 + L * fa - 0.1, a0 + L * fa + 0.1, z0 + 0.2, z0 + 1.1, '#18161a');
    if (o.code !== false) {
      stencil(p, F, a0 + 0.1, z0 + H - 1.9, boxCode(s), '#f0ece2');
      stencil(p, F, a0 + 0.1, z0 + H - 3.9, s % 2 ? '22G1' : '45G1', '#e4ded0');
    }
    if (o.logo && L > 2.6) {
      const lg = boxLogo(s);
      stencil(p, F, a0 + L * 0.5 - lg.length * 0.065, z0 + H * 0.66, lg, '#f4f0e6', 2);
    }
  }
  if (fc.side) {
    pq(p, S, b0, b0 + D, z0 + H - 1.5, z0 + H, r[S.light ? 4 : 2]);
    pq(p, S, b0, b0 + D, z0, z0 + 1.4, darken(r[1], 0.2));
    pq(p, S, b0, b0 + D, z0, z0 + 0.45, '#100e14');
    pq(p, S, b0, b0 + 0.05, z0, z0 + H, post);
    pq(p, S, b0 + D - 0.05, b0 + D, z0, z0 + H, S.light ? postL : post);
    if (o.doors === 'open') openEnd(p, S, a0, b0, L, D, z0, H, r, o);
    else if (o.doors !== 'blank') {
      // handles across the two middle bars, a yellow seal, the CSC plate
      const m = b0 + D / 2;
      for (const hu of [m - D * 0.14, m + D * 0.14]) {
        const [hx, hy] = S.F(hu, z0 + H * 0.45);
        px(p.c, hx - 3, hy, GALV[5], 6, 1);
        px(p.c, hx - 3, hy + 1, GALV[2], 6, 1);
      }
      const [sx, sy] = S.F(m + D * 0.14, z0 + H * 0.45);
      px(p.c, sx + 1, sy + 1, '#f2c43a', 2, 3);
      pq(p, S, b0 + D * 0.12, b0 + D * 0.3, z0 + H * 0.62, z0 + H * 0.72, '#b8b4aa');
      pq(p, S, b0 + D * 0.13, b0 + D * 0.29, z0 + H * 0.64, z0 + H * 0.66, '#6a665e');
    }
  }
  // corner castings: grey steel blocks with an oval hole
  const cast = (a: number, b: number, z: number) => {
    if (o.cheap) {
      const [x, y] = p.P(a + 0.035, b + 0.07, z + 1.3);
      px(p.c, x - 2, y, GREY[3], 4, 5);
      px(p.c, x - 1, y + 2, '#121014', 2, 2);
      return;
    }
    lbox(p, a, b, 0.07, 0.07, z, 1.3, mono(plate(GREY), GREY[0]));
    const [x, y] = p.P(a + 0.035, b + 0.07, z + 0.65);
    px(p.c, x - 1, y - 1, '#121014', 2, 2);
  };
  if (fc.front || fc.side) {
    cast(a0 + L - 0.07, b0 + D - 0.07, z0 + H - 1.3);
    cast(a0 + L - 0.07, b0 + D - 0.07, z0);
  }
  if (fc.front) {
    cast(a0, b0 + D - 0.07, z0 + H - 1.3);
    cast(a0, b0 + D - 0.07, z0);
  }
  if (fc.side) {
    cast(a0 + L - 0.07, b0, z0 + H - 1.3);
    cast(a0 + L - 0.07, b0, z0);
  }
  if (fc.top) cast(a0, b0, z0 + H - 1.3);
}

/** An open door end: the leaf swung back against the long side, the dark inside with cargo. */
function openEnd(p: PropPainter, S: Plane, a0: number, b0: number, L: number, D: number, z0: number, H: number, r: Ramp, o: BoxOpts) {
  const u0 = b0 + 0.06;
  const u1 = b0 + D - 0.06;
  const zb = z0 + 1.4;
  const zt = z0 + H - 1.5;
  pt(p, S, u0, u1, zb, zt, (u: number, v: number, x: number, y: number) => {
    // the interior: dark, the far end darker, corrugated inner walls catching a little light
    let i = 1.2 - v / 120;
    if (u % 9 < 2) i += 0.4;
    if (hash(x, y, 96) < 0.04) i += 0.5;
    return at(['#0e0c10', '#18151a', '#221e24', '#2e2930', '#3c363e'], i);
  });
  // the timber floor running in
  pq(p, S, u0, u1, zb, zb + 0.9, '#5a4430');
  pq(p, S, u0, u1, zb + 0.9, zb + 1.1, '#3a2c22');
  const box = (ua: number, ub: number, za: number, zz: number, k: number) => {
    const lit = k > 0.5;
    pq(p, S, ua, ub, za, zz, lit ? KRAFT[3] : KRAFT[1]);
    pq(p, S, ua, ub, zz - 0.45, zz, lit ? KRAFT[5] : KRAFT[2]);
    pq(p, S, ua, ua + (ub - ua) * 0.1, za, zz, lit ? KRAFT[4] : KRAFT[2]);
    pq(p, S, (ua + ub) / 2 - 0.02, (ua + ub) / 2 + 0.02, za, zz, '#d8c8a2');
  };
  const W = u1 - u0;
  if (o.cargo === 'unloading') {
    // half unloaded: a wrapped pallet left at the back, a slack strap
    box(u0 + W * 0.08, u0 + W * 0.5, zb + 1.1, zb + 9, 0.3);
    pt(p, S, u0 + W * 0.52, u0 + W * 0.92, zb + 1.1, zb + 7, (_u: number, v: number) => at(WRAP, 1.6 + (v % 5 < 1 ? 0.8 : 0)));
    const [ax, ay] = S.F(u0 + W * 0.2, zt - 1);
    const [bx, by] = S.F(u0 + W * 0.8, zt - 1);
    rope(p.c, ax, ay, bx, by, 9, '#d07a2a');
  } else {
    // being loaded: cartons stacked to the roof at the back, more by the door
    const cols = 3;
    for (let c = 0; c < cols; c++)
      for (let k = 0; k < 4; k++) {
        const ua = u0 + (W * c) / cols + 0.01;
        const ub = u0 + (W * (c + 1)) / cols - 0.01;
        const za = zb + 1.1 + k * 4.6;
        if (za + 4.4 > zt) break;
        box(ua, ub, za, za + 4.4, hash(c, k, o.seed) * 0.6);
      }
    box(u0 + W * 0.5, u0 + W * 0.95, zb + 1.1, zb + 6.2, 0.9);
  }
  // the door leaf folded back flat against the long side
  const lw = D / 2 - 0.02;
  lbox(p, a0 + L - lw, b0 + D, lw, 0.03, z0 + 0.7, H - 1.4, {
    front: (light) => (u: number, v: number, x: number, y: number) => {
      let i = (light === 0 ? 1.4 : 3) + 0.4;
      if (((v / 100) * 5) % 1 < 0.12) i += 0.6;
      if (u < 2 || u > lw * 64 * 1.1 - 2) return '#1a181c';
      if (hash(x, y, 97) < 0.03) i -= 0.8;
      return at(r, i);
    },
    side: plate(r),
    top: plate(r),
    edge: r[0],
  });
  // two hinge blocks on the corner post
  const [hx, hy] = p.P(a0 + L, b0 + D, z0 + H * 0.3);
  px(p.c, hx - 2, hy - 2, GREY[1], 3, 4);
  const [hx2, hy2] = p.P(a0 + L, b0 + D, z0 + H * 0.75);
  px(p.c, hx2 - 2, hy2 - 2, GREY[1], 3, 4);
}

const container: PropArt = {
  draw(p, k) {
    const v = (k.variant ?? 'red') as PaintName;
    const r = P[v] ?? P.red;
    const station = v === 'red' || v === 'blue';
    footShadow(p, 0.06, 0.1, k.w - 0.02, k.d - 0.02, 26, 0.32);
    drawBox(p, 0.05, 0.07, k.w - 0.1, k.d - 0.14, 0.35, 25.9, r, {
      seed: k.seed * 7 + v.length,
      rust: v === 'teal' ? 0.9 : 0.55,
      doors: station ? 'open' : 'closed',
      cargo: v === 'red' ? 'loading' : 'unloading',
    });
    // a placard on the station boxes (the bay number), a hazmat diamond on the yellow one
    const F = front(p, k.d - 0.07);
    if (station) {
      pq(p, F, 0.62, 1.0, 13, 17.4, '#f4f0e6');
      pq(p, F, 0.64, 0.98, 13.2, 17.2, '#2a2a30');
      stencil(p, F, 0.68, 16.6, v === 'red' ? 'B1' : 'B2', '#f2c43a', 2);
    }
    if (v === 'yellow') {
      const S = side(p, k.w - 0.05);
      const [dx, dy] = S.F(0.3, 16);
      layer(p.c, (l) => {
        fillPoly(l, [[dx, dy - 7], [dx + 7, dy], [dx, dy + 7], [dx - 7, dy]], '#f4f0e6');
        fillPoly(l, [[dx, dy - 5], [dx + 5, dy], [dx, dy + 5], [dx - 5, dy]], '#d8402a');
        text(l, dx - 1, dy - 2, '3', '#f4f0e6');
      }, { outline: false, rect: [dx - 9, dy - 9, dx + 9, dy + 9] });
    }
    // life on the roofs: a gull on the green box, a lashing bar left on the teal one
    const [rx, ry] = anchor(p, 0.4, 0.3, 26.25);
    if (v === 'green') gullStand(p.c, rx + 18, ry + 2, -1, 1);
    if (v === 'teal') {
      ln(p.c, rx - 6, ry + 4, rx + 22, ry - 8, GALV[2], 2);
      ln(p.c, rx - 6, ry + 3, rx + 22, ry - 9, GALV[5], 1);
    }
  },
};

// ── the dispatch post ────────────────────────────────────────
const dispatch: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.05, W - 0.05, 1.0, 24, 0.26);
    const steel = plate(['#2a3442', '#36424f', '#43515e', '#52616e', '#647380', '#7a8894']);
    const navy = plate(P.navy);
    // the canopy posts and the board between them
    for (const a of [0.08, W - 0.16]) lbox(p, a, 0.1, 0.08, 0.08, 0, 26.4, mono(plate(GALV), GALV[0]));
    lbox(p, 0.16, 0.12, W - 0.32, 0.04, 11, 11.5, { front: plate(['#2a2620', '#3e382e', '#5a5244', '#c8c0ae', '#e2dccc', '#f2ede2']), side: steel, top: steel, edge: '#2a2620' });
    // the berth plan pinned on the board: sheets, coloured magnets, a chart
    const B = front(p, 0.16);
    const Rn = rng(k.seed * 5 + 3);
    for (let i = 0; i < 5; i++) {
      const a = 0.24 + i * 0.32;
      pq(p, B, a, a + 0.24, 14 + (i % 2), 20.5 + (i % 2), i === 2 ? '#f6e6a8' : '#f4f2ea');
      for (let j = 0; j < 4; j++) pq(p, B, a + 0.03, a + 0.03 + 0.08 + Rn() * 0.1, 19 - j * 1.3, 19.3 - j * 1.3, '#7a7a80');
      const [mx, my] = B.F(a + 0.12, 20.6 + (i % 2));
      px(p.c, mx - 1, my - 1, ['#d8402a', '#2e6ac8', '#3a9a5a', '#f2c43a', '#d8402a'][i], 3, 3);
    }
    // the desk: a steel cabinet, a leg frame, a standing-height top
    lbox(p, 0.18, 0.28, 0.52, 0.6, 0, 9.4, { front: steel, side: steel, top: steel, edge: '#1e2630' });
    const D0 = front(p, 0.88);
    for (const z of [1.2, 4.6]) {
      pq(p, D0, 0.22, 0.66, z, z + 3, '#3a4654');
      pq(p, D0, 0.38, 0.5, z + 2.2, z + 2.6, GALV[5]);
    }
    lbox(p, W - 0.3, 0.3, 0.07, 0.07, 0, 9.4, mono(steel, '#1e2630'));
    lbox(p, W - 0.3, 0.78, 0.07, 0.07, 0, 9.4, mono(steel, '#1e2630'));
    lbox(p, 0.12, 0.24, W - 0.24, 0.7, 9.4, 0.6, { front: navy, side: navy, top: plate(['#3a3e44', '#4a4e54', '#5a5e64', '#6e7278', '#82868c', '#9a9ea2']), edge: '#141c2a' });
    // two monitors on a bar, a radio in its charger, papers, the thermos and a hard hat
    lbox(p, 0.5, 0.36, 1.2, 0.05, 11.2, 0.4, mono(plate(STEEL), STEEL[0]));
    lbox(p, 1.06, 0.36, 0.06, 0.05, 10, 1.4, mono(plate(STEEL), STEEL[0]));
    for (const a of [0.5, 1.12]) {
      lbox(p, a, 0.4, 0.56, 0.05, 11.4, 4.4, mono(plate(STEEL), STEEL[0]));
      pq(p, front(p, 0.45), a + 0.03, a + 0.53, 11.7, 15.5, '#0c1218');
    }
    const [tx, ty] = anchor(p, 0.5, 0.62, 10);
    layer(p.c, (l) => {
      // a clipboard with a manifest
      fillPoly(l, [[tx - 16, ty + 2], [tx - 4, ty - 4], [tx + 6, ty + 1], [tx - 6, ty + 7]], '#8a6a46');
      fillPoly(l, [[tx - 14, ty + 2], [tx - 4, ty - 3], [tx + 4, ty + 1], [tx - 6, ty + 6]], '#f4f2ea');
      for (let i = 0; i < 3; i++) ln(l, tx - 10 + i * 2, ty + 2 + i, tx - 2 + i * 2, ty - 2 + i, '#8a8a90');
      px(l, tx - 6, ty - 3, '#c8ccd2', 3, 2);
    }, { rect: [tx - 18, ty - 6, tx + 8, ty + 9] });
    const [rx, ry] = anchor(p, 1.78, 0.55, 10);
    layer(p.c, (l) => {
      // the VHF radio in its charger
      px(l, rx - 4, ry - 3, '#24262c', 8, 4);
      px(l, rx - 2, ry - 14, '#1a1c22', 5, 12);
      px(l, rx - 2, ry - 14, '#3a3c44', 1, 12);
      px(l, rx + 1, ry - 19, '#1a1c22', 1, 5);
      px(l, rx - 1, ry - 11, '#5fd38d', 1, 1);
      // the thermos and a mug
      const [mx, my] = anchor(p, 1.5, 0.75, 10);
      px(l, mx - 3, my - 12, '#2e6a4a', 6, 12);
      px(l, mx - 3, my - 12, '#4a8a66', 2, 12);
      px(l, mx - 3, my - 14, '#c8ccd2', 6, 2);
      px(l, mx + 7, my - 6, '#f4f0e6', 5, 6);
      px(l, mx + 7, my - 6, '#ffffff', 1, 6);
    }, { rect: [rx - 12, ry - 22, rx + 16, ry + 6] });
    // a yellow hard hat on the cabinet corner
    const [hx, hy] = anchor(p, 0.32, 0.72, 10);
    layer(p.c, (l) => {
      ell(l, hx, hy - 3, 8, 3, '#b88418');
      ell(l, hx, hy - 6, 6, 5, '#e8b42a');
      ell(l, hx - 2, hy - 8, 3, 2, '#f6d870');
      px(l, hx - 1, hy - 11, '#c8941c', 2, 6);
    }, { rect: [hx - 10, hy - 13, hx + 10, hy + 2] });
    // the canopy: a corrugated sheet sloping to the front, a sign on its fascia
    const roof = corr(['#3a4048', '#4a525a', '#5c646c', '#707880', '#868e94', '#9ea4a8'], 7, 0.3, k.seed);
    poly3(p, [[-0.06, 1.08, 24.6], [W + 0.06, 1.08, 24.6], [W + 0.06, 0.02, 27.2], [-0.06, 0.02, 27.2]], roof, 2);
    const Fc = front3(p, 1.08);
    pq(p, Fc, -0.06, W + 0.06, 23.6, 24.6, '#2c5aa0');
    pq(p, Fc, -0.06, W + 0.06, 23.4, 23.6, '#1a3060');
    stencil(p, Fc, W / 2 - 0.42, 24.45, 'DISPATCH', '#f4f0e6');
    pq(p, side(p, W + 0.06), 0.02, 1.08, 23.6, 24.6, '#1e4278');
  },
  anim(p, k) {
    const t = k.t;
    const F = front(p, 0.45);
    // screen 1: the berth schedule, coloured bars sliding; screen 2: the harbour map with ships
    pq(p, F, 0.53, 1.03, 11.7, 15.5, '#10202c');
    for (let i = 0; i < 5; i++) {
      const off = ((t * 0.08 + i * 0.13) % 1) * 0.2;
      pq(p, F, 0.56 + off, 0.56 + off + 0.12 + (i % 3) * 0.06, 14.9 - i * 0.7, 15.2 - i * 0.7, ['#5fd38d', '#f2b84b', '#7ec8f2', '#e86a5a', '#5fd38d'][i]);
    }
    pq(p, F, 1.15, 1.65, 11.7, 15.5, '#0e2a3a');
    pq(p, F, 1.15, 1.65, 11.7, 12.9, '#4a5a3a');
    const sx = 1.2 + ((t * 0.05) % 1) * 0.4;
    const [x1, y1] = F.F(sx, 14);
    px(p.c, x1, y1, '#f4f0e6', 2, 1);
    const [x2, y2] = F.F(1.58 - ((t * 0.03) % 1) * 0.3, 13.4);
    px(p.c, x2, y2, '#f2b84b', 2, 1);
    void k;
  },
};

// ── the control room ─────────────────────────────────────────
const booth: PropArt = {
  draw(p, k) {
    footShadow(p, 0.0, 0.0, 2.0, 2.0, 40, 0.3);
    const legs = mono(plate(GREY), GREY[0]);
    // four steel legs braced with crosses, a stair up the right side
    for (const [a, b] of [[0.14, 0.14], [1.4, 0.14], [0.14, 1.72], [1.4, 1.72]] as const) lbox(p, a, b, 0.1, 0.1, 0, 16.2, legs);
    const brace = (pl: Plane, u0: number, u1: number) => {
      const [x0, y0] = pl.F(u0, 1);
      const [x1, y1] = pl.F(u1, 15);
      const [x2, y2] = pl.F(u0, 15);
      const [x3, y3] = pl.F(u1, 1);
      ln(p.c, x0, y0, x1, y1, GREY[2], 2);
      ln(p.c, x2, y2, x3, y3, GREY[2], 2);
    };
    brace(front(p, 1.77), 0.2, 1.45);
    brace(side(p, 1.45), 0.2, 1.75);
    // stores under the cabin: a pallet of drums, a coiled hose
    const [ux, uy] = anchor(p, 0.8, 1.1, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) {
        const dx = ux - 14 + i * 12;
        const dy = uy - 2 + i * 2;
        ell(l, dx, dy, 6, 3, '#1e4a8a');
        for (let j = 0; j < 14; j++) px(l, dx - 6, dy - j, j % 6 === 0 ? '#163a6e' : '#2e62a8', 12, 1);
        px(l, dx - 6, dy - 14, '#2a5aa0', 12, 1);
        ell(l, dx, dy - 14, 6, 3, '#3a72b8');
        ell(l, dx + 2, dy - 15, 1, 1, '#163a6e');
      }
      coil(l, ux + 30, uy + 10, 9, ['#2a3e2a', '#3a5a3a', '#4a6e4a', '#5e8a5e', '#74a274', '#8eba8e']);
    }, { rect: [ux - 24, uy - 20, ux + 42, uy + 16] });
    // the stair: steel treads rising along the right side to a landing
    const s0 = 1.55;
    const s1 = 1.95;
    for (let i = 0; i < 11; i++) {
      const b = 1.9 - i * 0.12;
      const z = i * 1.45;
      lbox(p, s0, b - 0.12, s1 - s0, 0.12, z + 1.0, 0.45, mono(plate(GALV), GALV[0]));
    }
    lbox(p, s0 - 0.05, 0.12, s1 - s0 + 0.05, 0.5, 15.6, 0.6, mono(plate(GALV), GALV[0]));
    for (const a of [s1 - 0.03]) {
      const [x0, y0] = p.P(a, 1.95, 4.5);
      const [x1, y1] = p.P(a, 0.55, 20.2);
      ln(p.c, x0, y0, x1, y1, '#e8b42a', 2);
      ln(p.c, x0, y0 + 9, x1, y1 + 9, '#c8941c', 1);
      const [x2, y2] = p.P(a, 0.12, 20.2);
      ln(p.c, x1, y1, x2, y2, '#e8b42a', 2);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const [vx, vy] = p.P(a, 1.95 - t * 1.4, 0.8 + t * 15.6);
        ln(p.c, vx, vy - 15, vx, vy, '#c8941c', 1);
      }
    }
    // the cabin: clad lower band, a slanting glazed band, a roof with a visor
    // a blue clad cabin with a white band and roof (the reference's control room)
    const clad = plate(P.blue);
    const white = plate(['#7a7e84', '#9a9ea2', '#babdc0', '#d4d6d6', '#e6e6e4', '#f4f4f0']);
    lbox(p, 0.06, 0.06, 1.46, 1.8, 16.2, 4.4, { front: clad, side: clad, top: clad, edge: P.blue[0] });
    const F = front(p, 1.86);
    const Sd = side(p, 1.52);
    pq(p, F, 0.06, 1.52, 18.4, 19.2, '#f4f0e6');
    pq(p, Sd, 0.06, 1.86, 18.4, 19.2, '#c8c6c0');
    // the glazed band leans out: front and side windows as planar slants
    poly3(p, [[0.06, 1.86, 20.6], [1.52, 1.86, 20.6], [1.52, 2.0, 31.2], [0.06, 2.0, 31.2]], glass, 1);
    poly3(p, [[1.52, 1.86, 20.6], [1.52, 0.06, 20.6], [1.66, 0.06, 31.2], [1.66, 2.0, 31.2]], glass, 0, [[1.52, 1.86, 20.6], [1.52, 0.06, 20.6], [1.66, 1.86, 31.2]]);
    // mullions
    for (let i = 0; i <= 4; i++) {
      const a = 0.06 + (i * 1.46) / 4;
      const [x0, y0] = p.P(a, 1.86, 20.6);
      const [x1, y1] = p.P(a, 2.0, 31.2);
      ln(p.c, x0, y0, x1, y1, '#3a3e44', 2);
    }
    for (let i = 0; i <= 4; i++) {
      const b = 1.86 - (i * 1.8) / 4;
      const [x0, y0] = p.P(1.52, b, 20.6);
      const [x1, y1] = p.P(1.66, b + (1.86 - b) * 0.08, 31.2);
      ln(p.c, x0, y0, x1, y1, '#2e3238', 2);
    }
    // the roof slab and its sun visor, a parapet line
    lbox(p, 0.0, 0.0, 1.72, 2.06, 31.2, 1.6, { front: white, side: white, top: plate(['#5a606c', '#6a707c', '#7a808c', '#8c929c', '#9ea4ac', '#b2b8be']), edge: '#4a4e54' });
    pq(p, front(p, 2.06), 0.0, 1.72, 31.2, 31.6, '#1c449c');
    // on the roof: an air-conditioner, the antenna mast, a radar scanner, a beacon
    lbox(p, 0.2, 0.3, 0.42, 0.36, 32.8, 2.6, { front: plate(WHITE), side: plate(WHITE), top: plate(WHITE), edge: WHITE[0] });
    const [gx, gy] = front(p, 0.66).F(0.41, 34.1);
    ell(p.c, gx, gy, 5, 4, '#5a5e64');
    ell(p.c, gx, gy, 3, 2, '#2a2c30');
    const [mx, my] = anchor(p, 1.25, 0.5, 32.8);
    layer(p.c, (l) => {
      px(l, mx - 1, my - 46, '#c8ccd0', 2, 46);
      px(l, mx - 1, my - 46, '#f0f2f4', 1, 46);
      for (const z of [14, 26, 38]) px(l, mx - 5, my - z, '#c8ccd0', 10, 1);
      px(l, mx - 2, my - 49, '#d8402a', 4, 3);
      px(l, mx + 7, my - 30, '#3a3e44', 1, 30);
    }, { rect: [mx - 8, my - 52, mx + 10, my + 2] });
    // the stencilled name on the visor
    stencil(p, front3(p, 2.06), 0.32, 33.0, 'PORT CONTROL', '#2c5aa0');
    void k;
  },
  anim(p, k) {
    const t = k.t;
    // screens glowing through the glass, the radar sweeping, the beacon pulsing
    const F = front(p, 1.93);
    for (let i = 0; i < 3; i++) {
      const a = 0.2 + i * 0.44;
      const on = Math.sin(t * 1.3 + i * 2) > -0.6;
      pq(p, F, a, a + 0.28, 22.2, 24.6, on ? ['#5fb8e6', '#7ae0a4', '#f2c86a'][i] : '#2a4a5a');
      pq(p, F, a + 0.03, a + 0.25, 22.6, 23, '#e8f6ff');
    }
    const [rx, ry] = anchor(p, 0.86, 1.2, 33.4);
    const ang = t * 2.2;
    const dx = Math.cos(ang) * 10;
    const dy = Math.sin(ang) * 5;
    px(p.c, rx - 1, ry - 4, '#3a3e44', 2, 4);
    ln(p.c, rx - dx, ry - 5 - dy, rx + dx, ry - 5 + dy, '#e8eaec', 2);
    const [bx, by] = anchor(p, 1.25, 0.5, 32.8);
    if (Math.sin(t * 4) > 0.3) px(p.c, bx - 2, by - 49, '#ff7a5a', 4, 3);
    void k;
  },
};

// ── the tracking terminal ────────────────────────────────────
const kiosk: PropArt = {
  draw(p, k) {
    footShadow(p, 0.25, 0.25, 0.75, 0.8, 18, 0.26);
    const yel = plate(P.yellow);
    lbox(p, 0.28, 0.32, 0.44, 0.42, 0, 0.6, mono(plate(GREY), GREY[0]));
    lbox(p, 0.4, 0.42, 0.2, 0.2, 0.6, 9, { front: yel, side: yel, top: yel, edge: P.yellow[0] });
    // hazard band at the foot of the column
    const Fc = front(p, 0.62);
    for (let i = 0; i < 4; i++) pq(p, Fc, 0.4 + i * 0.05, 0.42 + i * 0.05, 0.8, 2.6, '#1e1e24');
    // the head: a slanted screen housing, a keyboard shelf, a hood
    lbox(p, 0.26, 0.36, 0.48, 0.36, 9.6, 6.4, { front: plate(GREY), side: plate(GREY), top: plate(GREY), edge: GREY[0] });
    lbox(p, 0.26, 0.68, 0.48, 0.16, 9.4, 0.6, mono(plate(STEEL), STEEL[0]));
    const [kx, ky] = anchor(p, 0.5, 0.78, 10);
    for (let i = 0; i < 4; i++) ln(p.c, kx - 10 + i * 2, ky + 2 - i, kx + 4 + i * 2, ky - 5 - i, '#5a5e64');
    pq(p, front(p, 0.72), 0.3, 0.7, 10.8, 15.4, '#0c1218');
    lbox(p, 0.2, 0.3, 0.6, 0.5, 16.2, 0.7, { front: yel, side: yel, top: yel, edge: P.yellow[0] });
    // the status light, a barcode scanner on its coiled cable, the asset sticker
    const [lx, ly] = anchor(p, 0.7, 0.4, 16.9);
    px(p.c, lx - 1, ly - 3, '#2a5a3a', 3, 3);
    const S = side(p, 0.74);
    const [sx, sy] = S.F(0.5, 12);
    layer(p.c, (l) => {
      px(l, sx + 1, sy - 2, '#24262c', 5, 4);
      px(l, sx + 2, sy + 2, '#24262c', 3, 6);
      for (let i = 0; i < 6; i++) px(l, sx + 3 + (i % 2), sy + 8 + i * 2, '#3a3c44', 2, 1);
    }, { rect: [sx - 2, sy - 4, sx + 9, sy + 22] });
    stencil(p, Fc, 0.43, 7.6, 'T7', '#2a2a30');
    void k;
  },
  anim(p, k) {
    const t = k.t;
    const F = front(p, 0.72);
    // the yard map: blocks of slots, one blinking, a moving straddle carrier
    pq(p, F, 0.31, 0.69, 10.9, 15.3, '#0e2030');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) pq(p, F, 0.33 + c * 0.09, 0.4 + c * 0.09, 14.4 - r * 1.2, 15 - r * 1.2, (r + c + Math.floor(t * 2)) % 7 === 0 ? '#f2c86a' : '#3a7ab0');
    const mx = 0.33 + ((t * 0.12) % 1) * 0.32;
    pq(p, F, mx, mx + 0.04, 11.2, 11.7, '#5fd38d');
    const [lx, ly] = anchor(p, 0.7, 0.4, 16.9);
    px(p.c, lx - 1, ly - 3, Math.sin(t * 3) > 0 ? '#7af0a0' : '#3a8a5a', 3, 3);
    void k;
  },
};

// ── the portal crane ─────────────────────────────────────────
const CR: Ramp = P.yellow;
/** A lattice member between two 3D points: two chords offset along a, zigzag diagonals. */
function lattice(p: PropPainter, A: [number, number, number], B: [number, number, number], w0: number, w1: number, n: number, col: Ramp) {
  const c = p.c;
  const L0 = p.P(A[0] - w0, A[1], A[2]);
  const R0 = p.P(A[0] + w0, A[1], A[2]);
  const L1 = p.P(B[0] - w1, B[1], B[2]);
  const R1 = p.P(B[0] + w1, B[1], B[2]);
  ln(c, L0[0], L0[1], L1[0], L1[1], col[4], 3);
  ln(c, R0[0], R0[1], R1[0], R1[1], col[2], 3);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const a = [L0[0] + (L1[0] - L0[0]) * t0, L0[1] + (L1[1] - L0[1]) * t0];
    const b = [R0[0] + (R1[0] - R0[0]) * (t0 + t1) / 2, R0[1] + (R1[1] - R0[1]) * (t0 + t1) / 2];
    const cc = [L0[0] + (L1[0] - L0[0]) * t1, L0[1] + (L1[1] - L0[1]) * t1];
    ln(c, a[0], a[1], b[0], b[1], col[3], 2);
    ln(c, b[0], b[1], cc[0], cc[1], col[3], 2);
  }
}

const crane: PropArt = {
  draw(p, k) {
    footShadow(p, 0.0, 0.1, 2.0, 1.9, 60, 0.3);
    const yel = plate(CR);
    const blk = mono(plate(IRON), IRON[0]);
    // bogies on the two rails, each with wheels and a buffer
    for (const b of [0.25, 1.75]) {
      for (const a0 of [0.06, 1.38]) {
        lbox(p, a0, b - 0.09, 0.56, 0.18, 0.2, 2.2, { front: yel, side: yel, top: yel, edge: CR[0] });
        const F = front(p, b + 0.09);
        for (const wa of [a0 + 0.12, a0 + 0.44]) {
          const [wx, wy] = F.F(wa, 0.9);
          ell(p.c, wx, wy, 5, 4, '#2a2a30');
          ell(p.c, wx - 1, wy - 1, 2, 2, '#6a6a72');
        }
        for (let i = 0; i < 5; i++) pq(p, F, a0 + i * 0.11, a0 + i * 0.11 + 0.055, 1.6, 2.3, '#1e1e24');
      }
    }
    // the portal legs and beams
    for (const [a, b] of [[0.26, 0.18], [1.6, 0.18], [0.26, 1.68], [1.6, 1.68]] as const) lbox(p, a, b, 0.14, 0.14, 2.4, 34, { front: yel, side: yel, top: yel, edge: CR[0] });
    for (const b of [0.18, 1.68]) lbox(p, 0.2, b - 0.02, 1.6, 0.18, 34, 3.2, { front: yel, side: yel, top: yel, edge: CR[0] });
    for (const a of [0.24, 1.58]) lbox(p, a - 0.02, 0.18, 0.2, 1.62, 34.4, 2.8, { front: yel, side: yel, top: yel, edge: CR[0] });
    // hazard stripes at the foot of the front legs, the crane's number
    for (const a of [0.26, 1.6]) {
      const F = front(p, 1.82);
      for (let i = 0; i < 3; i++) pq(p, F, a, a + 0.14, 3 + i * 2.2, 4 + i * 2.2, '#1e1e24');
    }
    stencil(p, front(p, 1.84), 0.72, 36.6, 'KRAN 3', '#1e1e24', 1);
    // the slewing ring, the machinery house, the counterweight, the cab
    lbox(p, 0.62, 0.62, 0.76, 0.76, 37.2, 1.4, blk);
    const house = plate(['#7a5410', '#9c7016', '#bf8c1c', '#d8a424', '#e8bc3c', '#f2d064']);
    lbox(p, 0.5, 0.36, 1.0, 0.98, 38.6, 13.4, { front: house, side: house, top: plate(CR), edge: CR[0] });
    const H = front(p, 1.34);
    for (let i = 0; i < 5; i++) pq(p, H, 0.58 + i * 0.07, 0.62 + i * 0.07, 43, 47, '#7a5410');
    pq(p, side(p, 1.5), 0.5, 0.82, 39.4, 47.4, '#5a4010');
    lbox(p, 0.56, 0.18, 0.88, 0.2, 38.6, 9, mono(plate(GREY), GREY[0]));
    lbox(p, 1.12, 1.34, 0.42, 0.36, 39.4, 10.6, { front: yel, side: yel, top: yel, edge: CR[0] });
    pt(p, front(p, 1.7), 1.16, 1.5, 42.4, 49.2, glass, 1);
    pt(p, side(p, 1.54), 1.38, 1.66, 42.4, 49.2, glass, 0);
    // the A-frame over the house
    const A1 = p.P(0.62, 0.5, 52);
    const A2 = p.P(1.38, 0.5, 52);
    const Ap = p.P(1.0, 0.7, 76);
    ln(p.c, A1[0], A1[1], Ap[0], Ap[1], CR[4], 3);
    ln(p.c, A2[0], A2[1], Ap[0], Ap[1], CR[2], 3);
    // the jib: a lattice boom luffed up steeply over the quay edge, the hoist rope, the load
    const base: [number, number, number] = [1.0, 1.3, 49];
    const tip: [number, number, number] = [1.0, 2.55, 128];
    layer(p.c, () => {
      lattice(p, base, tip, 0.26, 0.07, 12, CR);
    }, { outline: 0.55 });
    const Tp = p.P(...tip);
    ln(p.c, Ap[0], Ap[1], Tp[0], Tp[1], '#3a3a40', 1);
    px(p.c, Tp[0] - 3, Tp[1] - 2, CR[2], 6, 4);
    // the hook block on its ropes, a cargo net of sacks swinging below
    const hook = p.P(1.0, 2.55, 40);
    ln(p.c, Tp[0] - 1, Tp[1] + 2, hook[0] - 1, hook[1] - 4, '#2a2a30');
    ln(p.c, Tp[0] + 1, Tp[1] + 2, hook[0] + 1, hook[1] - 4, '#2a2a30');
    layer(p.c, (l) => {
      px(l, hook[0] - 4, hook[1] - 6, '#e8b42a', 8, 6);
      px(l, hook[0] - 4, hook[1] - 6, '#f6d870', 2, 6);
      ln(l, hook[0], hook[1], hook[0] - 10, hook[1] + 12, '#3a3a40');
      ln(l, hook[0], hook[1], hook[0] + 10, hook[1] + 12, '#3a3a40');
      // the net: sacks bulging in a mesh
      for (let i = 0; i < 6; i++) {
        const sx = hook[0] - 11 + (i % 3) * 8;
        const sy = hook[1] + 14 + Math.floor(i / 3) * 6;
        ell(l, sx + 3, sy + 3, 5, 4, i % 2 ? '#c8b48a' : '#b8a074');
        ell(l, sx + 2, sy + 2, 3, 2, '#e0d0aa');
      }
      for (let i = 0; i < 5; i++) ln(l, hook[0] - 12 + i * 6, hook[1] + 12, hook[0] - 12 + i * 6 + 3, hook[1] + 28, '#5a4a30');
      ln(l, hook[0] - 13, hook[1] + 20, hook[0] + 13, hook[1] + 20, '#5a4a30');
    }, { rect: [hook[0] - 16, hook[1] - 8, hook[0] + 16, hook[1] + 32] });
    void k;
  },
  anim(p, k) {
    // the warning light at the jib tip
    const tip = p.P(1.0, 2.55, 128);
    if (Math.sin(k.t * 3.1 + k.seed) > 0.2) px(p.c, tip[0] - 1, tip[1] - 5, '#ff5a3a', 3, 3);
  },
};

// ── pallet loads (racks, forklift, the quay's clutter) ────────
export type Load = 'cartons' | 'sacks' | 'drums' | 'crate' | 'empty' | 'wrapped' | 'pipes';
/** A pallet with its load at local (a, b) (centre) on z, w × d in tiles. */
export function pallet(p: PropPainter, a: number, b: number, z: number, w: number, d: number, kind: Load, seed: number) {
  const pine = plate(PINE, 0);
  lbox(p, a - w / 2, b - d / 2, w, d, z, 1.3, { front: pine, side: pine, top: planks(PINE, 5), edge: PINE[0] });
  const F = front(p, b + d / 2);
  for (const t of [0.15, 0.5, 0.85]) pq(p, F, a - w / 2 + w * t - 0.05, a - w / 2 + w * t + 0.05, z, z + 1.3, PINE[1]);
  pq(p, F, a - w / 2, a + w / 2, z + 0.35, z + 0.95, '#2a2018');
  const z1 = z + 1.3;
  const Rn = rng(seed * 13 + 1);
  if (kind === 'empty') return;
  if (kind === 'cartons' || kind === 'wrapped') {
    const h = 6 + Rn() * 4;
    const film = kind === 'wrapped';
    lbox(p, a - w / 2 + 0.03, b - d / 2 + 0.03, w - 0.06, d - 0.06, z1, h, {
      front: (light) => (u: number, v: number, x: number, y: number) => {
        const row = Math.floor(v / 9);
        const col = Math.floor((u + (row & 1) * 7) / 14);
        let i = (light === 0 ? 1.6 : 3) + (hash(col, row, seed) - 0.5) * 0.8;
        if (v % 9 < 1 || (u + (row & 1) * 7) % 14 < 1) i -= 1.2;
        if (film && (u * 0.6 + v) % 23 < 3) return at(WRAP, light === 0 ? 2 : 4);
        if (hash(x, y, 98) < 0.03) i -= 0.6;
        return at(KRAFT, i);
      },
      side: (light) => (u: number, v: number) => {
        let i = (light === 0 ? 1.6 : 3) - (v % 9 < 1 || u % 14 < 1 ? 1.2 : 0);
        if (film && (u * 0.6 + v) % 23 < 3) return at(WRAP, 2);
        return at(KRAFT, i);
      },
      top: (light) => (u: number, v: number) => at(KRAFT, (light === 2 ? 4 : 3) - (u % 14 < 1 || v % 12 < 1 ? 1 : 0) + (film && (u + v) % 19 < 2 ? 1 : 0)),
      edge: KRAFT[0],
    });
    // a shipping label
    pq(p, front(p, b + d / 2 - 0.03), a - 0.08, a + 0.06, z1 + h * 0.5, z1 + h * 0.5 + 1.4, '#f4f2ea');
  } else if (kind === 'sacks') {
    const [x, y] = anchor(p, a, b, z1);
    layer(p.c, (l) => {
      for (let r2 = 0; r2 < 3; r2++)
        for (let i = 0; i < 3; i++) {
          const sx = x - 14 + i * 10 + (r2 % 2) * 4;
          const sy = y - 3 - r2 * 6 + i * 2;
          ell(l, sx, sy, 8, 4, '#a89878');
          ell(l, sx - 1, sy - 1, 7, 3, '#d8ccb0');
          px(l, sx - 4, sy - 2, '#ece4d0', 4, 1);
          if ((i + r2) % 2) px(l, sx - 2, sy, '#2e6a4a', 4, 1);
        }
    }, { rect: [x - 26, y - 22, x + 26, y + 6] });
  } else if (kind === 'drums') {
    const cols = ['#2e62a8', '#2e62a8', '#c8382a', '#2e62a8'];
    for (const [da, db, i] of [[-0.14, -0.15, 0], [0.14, -0.15, 1], [-0.14, 0.15, 2], [0.14, 0.15, 3]] as const) {
      const [x, y] = anchor(p, a + da, b + db, z1);
      const c = cols[(i + seed) % 4];
      layer(p.c, (l) => {
        for (let j = 0; j < 22; j++) px(l, x - 7, y - j, j % 7 === 3 ? darken(c, 0.3) : c, 14, 1);
        for (let j = 0; j < 22; j++) px(l, x - 7, y - j, lighten(c, 0.25), 3, 1);
        ell(l, x, y - 22, 7, 3.5, lighten(c, 0.15));
        ell(l, x + 2, y - 23, 1.5, 1, darken(c, 0.4));
      }, { rect: [x - 9, y - 27, x + 9, y + 2] });
    }
  } else if (kind === 'crate') {
    const pn = planks(PINE, 6);
    lbox(p, a - w / 2 + 0.04, b - d / 2 + 0.04, w - 0.08, d - 0.08, z1, 7.5, { front: pn, side: pn, top: planks(PINE, 6, 'v'), edge: PINE[0] });
    stencil(p, front(p, b + d / 2 - 0.04), a - 0.16, z1 + 5, 'FRAGILE', '#7a2a1a');
  } else if (kind === 'pipes') {
    const [x, y] = anchor(p, a, b, z1);
    layer(p.c, (l) => {
      for (let r2 = 0; r2 < 3; r2++)
        for (let i = 0; i < 4 - r2; i++) {
          const cx = x - 12 + i * 7 + r2 * 3.5;
          const cy = y - 3 - r2 * 6;
          ln(l, cx - 10, cy + 5, cx + 18, cy - 9, '#5a5e64', 5);
          ln(l, cx - 10, cy + 3, cx + 18, cy - 11, '#9a9ea4', 1);
          ell(l, cx - 10, cy + 5, 3, 3, '#3a3c40');
          ell(l, cx - 10, cy + 5, 1.5, 1.5, '#1a1a1e');
        }
    }, { rect: [x - 26, y - 34, x + 30, y + 10] });
  }
}

// ── pallet racking under a lean-to ───────────────────────────
const rack: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.0, 0.05, W, 1.0, 40, 0.28);
    const blue = plate(['#14284a', '#1c3660', '#264878', '#305c92', '#3e70aa', '#5288c0']);
    const org = plate(P.orange);
    const ups = [0.06, W / 2 - 0.03, W - 0.12];
    const levels = [0, 13.6, 27.2];
    const Rn = rng(k.seed * 31 + 7);
    const kinds: Load[] = ['cartons', 'wrapped', 'sacks', 'drums', 'crate', 'cartons', 'wrapped', 'empty', 'pipes'];
    // back uprights first, then the loads (back to front), then the front frame and beams
    for (const a of ups) lbox(p, a, 0.12, 0.06, 0.06, 0, 42, mono(blue, '#14284a'));
    for (let li = 0; li < levels.length; li++) {
      const z = levels[li];
      if (li > 0) for (let bay = 0; bay < 2; bay++) lbox(p, ups[bay] + 0.06, 0.12, ups[bay + 1] - ups[bay] - 0.06, 0.05, z - 1.2, 1.2, mono(org, P.orange[0]));
      for (let bay = 0; bay < 2; bay++) {
        const a0 = ups[bay] + 0.1;
        const a1 = ups[bay + 1] - 0.04;
        const pw = (a1 - a0) / 2 - 0.04;
        for (let j = 0; j < 2; j++) {
          const kind = kinds[Math.floor(Rn() * kinds.length)];
          if (li === 2 && Rn() < 0.25) continue;
          pallet(p, a0 + pw / 2 + j * (pw + 0.08), 0.5, z, pw, 0.6, kind, k.seed * 9 + li * 4 + bay * 2 + j);
        }
      }
    }
    for (const a of ups) {
      lbox(p, a, 0.82, 0.06, 0.06, 0, 42, mono(blue, '#14284a'));
      // the side frame's bracing (seen on the end upright that faces the camera)
      if (a === (p.rot === 0 ? ups[2] : ups[0])) {
        const S = side(p, p.rot === 0 ? a + 0.06 : a);
        for (let i = 0; i < 5; i++) {
          const [x0, y0] = S.F(0.18, 2 + i * 8);
          const [x1, y1] = S.F(0.82, 6 + i * 8);
          ln(p.c, x0, y0, x1, y1, '#305c92', 1);
        }
      }
      // a yellow guard at the foot
      lbox(p, a - 0.02, 0.86, 0.1, 0.06, 0, 2.6, mono(plate(P.yellow), P.yellow[0]));
    }
    for (let li = 1; li < levels.length; li++) {
      const z = levels[li];
      for (let bay = 0; bay < 2; bay++) {
        lbox(p, ups[bay] + 0.06, 0.82, ups[bay + 1] - ups[bay] - 0.06, 0.05, z - 1.2, 1.2, mono(org, P.orange[0]));
        const F = front(p, 0.87);
        const am = (ups[bay] + ups[bay + 1]) / 2;
        pq(p, F, am - 0.07, am + 0.07, z - 1.0, z - 0.3, '#f4f2ea');
        stencil(p, F, am - 0.05, z - 0.4, `${String.fromCharCode(65 + bay)}${li}`, '#2a2a30');
      }
    }
    // the lean-to roof on extended uprights
    const roof = corr(['#3a4048', '#4a525a', '#5c646c', '#707880', '#868e94', '#9ea4a8'], 7, 0.4, k.seed);
    poly3(p, [[-0.1, 1.14, 44], [W + 0.1, 1.14, 44], [W + 0.1, 0.0, 47.5], [-0.1, 0.0, 47.5]], roof, 2);
    const Fr = front3(p, 1.14);
    pq(p, Fr, -0.1, W + 0.1, 43.2, 44, '#4a525a');
    pq(p, side(p, p.rot === 0 ? W + 0.1 : -0.1), 0.0, 1.14, 43.2, 44, '#3a4048');
    // a gutter drip and a sign
    pq(p, Fr, 0.2, 0.62, 40.4, 42.6, '#2c5aa0');
    stencil(p, Fr, 0.24, 42.2, k.seed % 2 ? 'WH-A' : 'WH-B', '#f4f0e6');
  },
};

// ── the forklift ─────────────────────────────────────────────
const forklift: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.15, 0.92, 2.0, 20, 0.3);
    const yel = plate(P.yellow);
    const blk = plate(['#16161a', '#202024', '#2a2a30', '#36363e', '#44444c', '#54545e']);
    // (second pass) round tyres in the side plane, with a rim and a hub (the near ones in their arches)
    const wheel = (a: number, b: number, r: number) => {
      const S = side(p, a);
      if (a > 0.5) archOn(p, side(p, a - 0.02), b, r * 1.25, r * 0.065);
      wheelOn(p, S, b, r * 1.25, r * 0.065, ['#6a5410', '#8c6e14', '#b88e1c', '#dcae2a', '#f0c43c', '#fcdc6c']);
    };
    // far wheels, chassis, near wheels
    wheel(0.14, 0.42, 2.2);
    wheel(0.14, 1.2, 2.8);
    lbox(p, 0.16, 0.22, 0.68, 1.16, 1.4, 6.2, { front: yel, side: yel, top: yel, edge: P.yellow[0] });
    // the counterweight with hazard chevrons, the LPG bottle
    lbox(p, 0.14, 0.12, 0.72, 0.36, 1.2, 9.4, { front: blk, side: blk, top: blk, edge: '#101014' });
    for (let i = 0; i < 4; i++) pq(p, side(p, 0.86), 0.14 + i * 0.08, 0.18 + i * 0.08, 2, 4.4, i % 2 ? '#1e1e24' : '#e8b42a');
    const [gx, gy] = anchor(p, 0.5, 0.3, 10.6);
    layer(p.c, (l) => {
      ln(l, gx - 12, gy + 4, gx + 12, gy - 8, '#8a8e94', 7);
      ln(l, gx - 12, gy + 2, gx + 12, gy - 10, '#c8ccd0', 2);
      ell(l, gx + 12, gy - 8, 3, 3.5, '#6a6e74');
    }, { rect: [gx - 18, gy - 16, gx + 18, gy + 10] });
    // the seat and the hood, the steering wheel
    lbox(p, 0.26, 0.5, 0.48, 0.5, 7.6, 1.2, { front: yel, side: yel, top: yel, edge: P.yellow[0] });
    lbox(p, 0.32, 0.56, 0.36, 0.3, 8.8, 1.6, mono(plate(['#141416', '#1e1e22', '#2a2a2e', '#36363c', '#44444a', '#52525a']), '#101012'));
    lbox(p, 0.32, 0.5, 0.36, 0.08, 8.8, 5.6, mono(plate(['#141416', '#1e1e22', '#2a2a2e', '#36363c', '#44444a', '#52525a']), '#101012'));
    const [sx, sy] = anchor(p, 0.5, 1.12, 13.4);
    ell(p.c, sx, sy, 5, 2.4, '#1e1e22');
    ell(p.c, sx, sy, 3, 1.4, '#3a3a40');
    ln(p.c, sx, sy, sx - 2, sy + 9, '#2a2a30', 2);
    // the overhead guard
    for (const [a, b] of [[0.18, 0.5], [0.76, 0.5], [0.18, 1.22], [0.76, 1.22]] as const) lbox(p, a, b, 0.06, 0.06, 7.6, 14.2, mono(blk, '#101014'));
    lbox(p, 0.16, 0.46, 0.68, 0.82, 21.8, 0.7, mono(blk, '#101014'));
    for (let i = 1; i < 5; i++) pq(p, front(p, 0.46 + i * 0.16), 0.2, 0.8, 22.5, 22.5, '#3a3a40');
    // the mast, its chains, the carriage and the forks
    for (const a of [0.2, 0.72]) lbox(p, a, 1.36, 0.08, 0.1, 0.6, 23.4, mono(plate(GREY), GREY[0]));
    lbox(p, 0.2, 1.36, 0.6, 0.1, 22.8, 0.8, mono(plate(GREY), GREY[0]));
    lbox(p, 0.24, 1.46, 0.52, 0.06, 2.2, 5.2, mono(plate(GREY), GREY[0]));
    for (const a of [0.36, 0.6]) {
      const [x0, y0] = p.P(a, 1.44, 23);
      const [x1, y1] = p.P(a, 1.44, 7.4);
      ln(p.c, x0, y0, x1, y1, '#4a4a52');
    }
    for (const a of [0.3, 0.64]) lbox(p, a, 1.5, 0.07, 0.5, 2.2, 0.5, mono(plate(GREY), GREY[0]));
    // the load: a wrapped pallet of cartons on the forks
    pallet(p, 0.5, 1.74, 2.7, 0.62, 0.5, 'wrapped', k.seed);
    // near wheels, mirror, the beacon
    wheel(0.86, 0.42, 2.2);
    wheel(0.86, 1.2, 2.8);
    const [mx, my] = anchor(p, 0.82, 1.24, 18);
    px(p.c, mx + 2, my - 2, '#1e1e22', 1, 4);
    px(p.c, mx + 2, my - 5, '#8a9aa8', 3, 3);
    const [bx, by] = anchor(p, 0.5, 0.86, 22.5);
    px(p.c, bx - 2, by - 4, '#8a3a10', 4, 4);
    stencil(p, front(p, 1.38), 0.28, 6.8, '2.5T', '#1e1e24');
  },
  anim(p, k) {
    const [bx, by] = anchor(p, 0.5, 0.86, 22.5);
    const on = Math.sin(k.t * 6) > 0;
    px(p.c, bx - 2, by - 4, on ? '#ffb84a' : '#c86a1a', 4, 4);
    if (on) px(p.c, bx - 1, by - 4, '#fff0c0', 2, 1);
  },
};

// ── the fishing boat at the quay ─────────────────────────────
const HULL: Ramp = ['#0e1e3a', '#16294e', '#203764', '#2c4a80', '#3a5e98', '#4e74ae', '#6890c2'];

/** Hull outline at the deck: half-beam at a fraction t from bow (0) to stern (1). */
const beamAt = (t: number) => (t < 0.35 ? Math.sqrt(t / 0.35) * 0.98 : t > 0.9 ? 1 - (t - 0.9) * 1.2 : 1);

const boat: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const ZW = -QD; // the waterline
    const ZD = ZW + 8.4; // the deck edge (the gunwale a little higher)
    const bm = 0.92; // centreline (local b)
    const hb = 0.68; // half-beam
    const a0 = 0.15;
    const a1 = W - 0.2;
    const N = 28;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([a0 + (a1 - a0) * t, beamAt(t) * hb]);
    }
    // the water around the hull: a dark wet shadow, ripples
    const wl = pts.map(([a, h]) => p.P(a, bm + h * 0.9 + 0.06, ZW));
    layer(c, (l) => {
      for (let i = 0; i < wl.length - 1; i++) {
        const [x0, y0] = wl[i];
        const [x1, y1] = wl[i + 1];
        ln(l, x0 + 2, y0 + 3, x1 + 2, y1 + 3, '#163a44', 3);
        if (i % 3 === 0) px(l, x0, y0 + 6, '#5a9a94', 6, 1);
      }
    }, { outline: false });
    // starboard side: facets from the deck edge down to the waterline, lit by their normal
    for (let i = 0; i < N; i++) {
      const [aA, hA] = pts[i];
      const [aB, hB] = pts[i + 1];
      const nx = -(hB - hA);
      const ny = aB - aA;
      const lit = (-0.5 * nx + 1 * ny) / Math.hypot(nx, ny);
      const tone = Math.round(2.4 + lit * 2.2);
      const q = [p.P(aA, bm + hA, ZD), p.P(aB, bm + hB, ZD), p.P(aB, bm + hB * 0.88, ZW), p.P(aA, bm + hA * 0.88, ZW)];
      fillPoly(c, q, at(HULL, tone));
      // the white sheer strake and the red boot-top at the waterline
      const s0 = p.P(aA, bm + hA, ZD);
      const s1 = p.P(aB, bm + hB, ZD);
      fillPoly(c, [s0, s1, [s1[0], s1[1] + 4], [s0[0], s0[1] + 4]], at(WHITE, 3 + lit * 2));
      const w0 = p.P(aA, bm + hA * 0.88, ZW);
      const w1 = p.P(aB, bm + hB * 0.88, ZW);
      fillPoly(c, [[w0[0], w0[1] - 3], [w1[0], w1[1] - 3], w1, w0], at(P.red, 2.6 + lit * 1.5));
    }
    // the transom (the flat stern, shaded) with her name
    const tS = pts[N];
    const tr = [p.P(a1, bm - tS[1], ZD), p.P(a1, bm + tS[1], ZD), p.P(a1, bm + tS[1] * 0.88, ZW), p.P(a1, bm - tS[1] * 0.88, ZW)];
    fillPoly(c, tr, HULL[1]);
    fillPoly(c, [tr[0], tr[1], [tr[1][0], tr[1][1] + 4], [tr[0][0], tr[0][1] + 4]], WHITE[1]);
    const S = side(p, a1);
    stencil(p, S, bm + 0.4, ZD - 2.2, 'MARIE', '#f4f0e6');
    stencil(p, S, bm + 0.22, ZD - 4.4, 'HL 42', '#d8d4cc');
    // the deck inside the bulwark: weathered planks, a hatch, fish boxes, nets, buoys
    deckFill(p, pts, bm, ZD - 0.8, TIMBERW, 0.86);
    // the bulwark's inner face (the far side, seen over the deck) and the rail
    const far = pts.map(([a, h]) => p.P(a, bm - h * 0.95, ZD + 1.6));
    const farB = pts.map(([a, h]) => p.P(a, bm - h * 0.86, ZD - 0.8));
    for (let i = 0; i < N; i++) fillPoly(c, [far[i], far[i + 1], farB[i + 1], farB[i]], WHITE[2]);
    for (let i = 0; i < N; i++) ln(c, far[i][0], far[i][1], far[i + 1][0], far[i + 1][1], '#3a5e98', 2);
    const near = pts.map(([a, h]) => p.P(a, bm + h, ZD + 1.6));
    const nearB = pts.map(([a, h]) => p.P(a, bm + h, ZD));
    for (let i = 0; i < N; i++) fillPoly(c, [near[i], near[i + 1], nearB[i + 1], nearB[i]], WHITE[4]);
    for (let i = 0; i < N; i++) ln(c, near[i][0], near[i][1] - 1, near[i + 1][0], near[i + 1][1] - 1, '#2c4a80', 2);
    // fish boxes stacked forward, a coil, buoys, a net heap aft
    const zd = ZD - 0.8;
    for (const [a, b, n] of [[0.9, 0.78, 3], [1.2, 1.0, 2], [0.95, 1.1, 1]] as const)
      for (let j = 0; j < n; j++) lbox(p, a, b, 0.24, 0.2, zd + j * 1.6, 1.6, mono(plate(j % 2 ? P.blue : P.red), '#1a1a2a'));
    const [cx, cy] = anchor(p, 0.62, 0.95, zd);
    coil(c, cx, cy, 8, ROPE);
    const [nx, ny] = anchor(p, 3.2, 0.9, zd);
    layer(c, (l) => {
      // the net heap: green mesh with orange floats
      for (let i = 0; i < 26; i++) {
        const hx = nx - 16 + hash(i, 1, k.seed) * 30;
        const hy = ny - 4 - hash(i, 2, k.seed) * 10;
        ell(l, hx, hy, 6, 3.5, i % 3 ? '#2e5a3a' : '#3a6e46');
      }
      for (let i = 0; i < 40; i++) px(l, nx - 18 + hash(i, 3, k.seed) * 34, ny - 12 + hash(i, 4, k.seed) * 12, '#1e3a26');
      for (let i = 0; i < 6; i++) ell(l, nx - 14 + i * 5, ny - 8 - (i % 2) * 4, 2, 2, '#f28a2a');
    }, { rect: [nx - 24, ny - 22, nx + 22, ny + 6] });
    // the wheelhouse aft of midships: white, windows all round, a mast with lights and radar
    const wa = 2.1;
    const wb = 0.62;
    const whit = plate(WHITE);
    lbox(p, wa, wb, 0.72, 0.62, zd, 20, { front: whit, side: whit, top: plate(['#5a5e64', '#6a6e74', '#7c8086', '#8e9296', '#a2a6aa', '#b6babc']), edge: WHITE[0] });
    const WF = front(p, wb + 0.62);
    const WS = side(p, wa + 0.72);
    pt(p, WF, wa + 0.06, wa + 0.66, zd + 11.5, zd + 17, glass, 1);
    pt(p, WS, wb + 0.06, wb + 0.56, zd + 11.5, zd + 17, glass, 0);
    for (const u of [wa + 0.26, wa + 0.46]) pq(p, WF, u, u + 0.03, zd + 11.5, zd + 17, WHITE[2]);
    pq(p, WF, wa + 0.24, wa + 0.44, zd, zd + 10.5, '#3a5e98');
    lbox(p, wa - 0.04, wb - 0.04, 0.8, 0.7, zd + 20, 0.6, mono(plate(P.blue), P.blue[0]));
    const [mx, my] = anchor(p, wa + 0.4, wb + 0.3, zd + 20.6);
    layer(c, (l) => {
      px(l, mx - 1, my - 48, '#d8dcdc', 2, 48);
      px(l, mx - 1, my - 48, '#f4f6f6', 1, 48);
      px(l, mx - 9, my - 32, '#d8dcdc', 18, 2);
      px(l, mx - 3, my - 18, '#2a2a30', 6, 3);
      ln(l, mx - 8, my - 19, mx + 8, my - 17, '#e8eaec', 2);
      px(l, mx - 2, my - 52, '#f4f0e6', 3, 4);
      px(l, mx + 8, my - 33, '#3ac85a', 2, 2);
      px(l, mx - 10, my - 33, '#d8402a', 2, 2);
      // a pennant
      fillPoly(l, [[mx + 1, my - 48], [mx + 12, my - 45], [mx + 1, my - 42]], '#d8402a');
    }, { rect: [mx - 12, my - 56, mx + 14, my + 2] });
    // the stern gantry for the nets
    const g0 = p.P(a1 - 0.12, bm - 0.5, zd);
    const g1 = p.P(a1 - 0.12, bm + 0.5, zd);
    const g2 = p.P(a1 - 0.12, bm - 0.5, zd + 24);
    const g3 = p.P(a1 - 0.12, bm + 0.5, zd + 24);
    ln(c, g0[0], g0[1], g2[0], g2[1], '#e8b42a', 2);
    ln(c, g1[0], g1[1], g3[0], g3[1], '#c8941c', 2);
    ln(c, g2[0], g2[1], g3[0], g3[1], '#e8b42a', 3);
    // mooring lines to the bollards on the quay (at local a = −1.5 and 4.5, the edge at b = 0)
    const lines: [number, number, number, number][] = [[0.55, 0.42, -1.5, -0.32], [a1 - 0.25, 0.42, 4.5, -0.32]];
    for (const [la, lb, ba, bb] of lines) {
      const [x0, y0] = p.P(la, lb, ZD + 1.6);
      const [x1, y1] = p.P(ba, bb, 5.2);
      rope(c, x0, y0, x1, y1, 5, ROPE[2], ROPE[4]);
      // the eye round the bollard's neck
      ell(c, x1, y1 + 1, 7, 2.5, ROPE[1]);
      ell(c, x1, y1, 6, 2, ROPE[3]);
    }
    // the fenders between hull and wall (just showing above the rail), cleats
    for (const a of [0.9, 1.9, 2.9]) {
      const [fx, fy] = p.P(a, 0.3, ZD + 1);
      px(c, fx - 2, fy - 2, '#f4f0e6', 4, 7);
      px(c, fx - 2, fy - 2, '#ffffff', 1, 7);
      px(c, fx - 1, fy - 5, '#3a3a40', 1, 3);
    }
  },
};

// ── a mooring bollard ────────────────────────────────────────
/** A cast-iron bollard on its base plate at local (a, b); `gull` puts one on the cap. */
export function bollardAt(p: PropPainter, a: number, b: number, o: { gull?: boolean; worn?: number } = {}) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 7, y + 2, 13, 4.5, 0.3);
  layer(p.c, (l) => {
    // the base plate with four bolts
    fillPoly(l, [[x - 13, y], [x, y - 6], [x + 13, y], [x, y + 6]], IRON[1]);
    fillPoly(l, [[x - 11, y - 1], [x, y - 6], [x + 11, y - 1], [x, y + 4]], IRON[3]);
    for (const [dx, dy] of [[-8, 0], [8, 0], [0, -4], [0, 4]] as const) px(l, x + dx - 1, y + dy - 1, IRON[5], 2, 1);
    // the post: a waisted iron cylinder, lit on its left
    for (let j = 0; j < 20; j++) {
      const w = 7 - (j > 4 && j < 14 ? 1 : 0);
      for (let i = -w; i < w; i++) {
        const t = (i + w) / (2 * w);
        px(l, x + i, y - 1 - j, IRON[t < 0.22 ? 5 : t < 0.5 ? 4 : t < 0.8 ? 2 : 1]);
      }
    }
    // the flared cap, painted yellow on top
    ell(l, x, y - 22, 10, 4.2, IRON[2]);
    ell(l, x, y - 23, 10, 4, '#b88a1c');
    ell(l, x - 1, y - 24, 8.5, 3.2, '#e2b02e');
    ell(l, x - 3, y - 25, 4, 1.6, '#f4d266');
    // rust weeping from the foot
    for (let i = 0; i < 5; i++) px(l, x - 6 + i * 3, y - 2 - (i % 2), RUST[3], 2, 2);
  }, { outline: 0.62, rect: [x - 15, y - 30, x + 15, y + 8] });
  if (o.gull) gullStand(p.c, x - 1, y - 25, -1);
}

const bollard: PropArt = {
  draw(p, k) {
    bollardAt(p, 0.5, 0.68, { gull: k.seed % 6 === 5 });
  },
};

// ── the coffee machine ───────────────────────────────────────
const vending: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.2, 0.9, 0.9, 22, 0.28);
    const red = plate(['#4a0c10', '#6e1418', '#941c20', '#b42628', '#d03430', '#e44e44']);
    lbox(p, 0.14, 0.26, 0.72, 0.58, 0, 0.8, mono(plate(GREY), GREY[0]));
    lbox(p, 0.16, 0.28, 0.68, 0.54, 0.8, 18.4, { front: red, side: red, top: red, edge: '#2a0a0c' });
    const F = front(p, 0.82);
    // the lit panel (a cup of coffee, steam), the keypad, the slot, the dispensing alcove
    pq(p, F, 0.2, 0.62, 7.6, 16.8, '#2a1a12');
    pq(p, F, 0.22, 0.6, 7.8, 16.6, '#6a3a1e');
    pq(p, F, 0.66, 0.8, 9.4, 16.4, '#1e1e24');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) pq(p, F, 0.68 + c * 0.06, 0.72 + c * 0.06, 15.4 - r * 1.4, 16 - r * 1.4, '#c8ccd0');
    pq(p, F, 0.68, 0.78, 10, 10.8, '#5fd38d');
    pq(p, F, 0.3, 0.56, 2.2, 6, '#0e0c10');
    pq(p, F, 0.38, 0.46, 2.4, 3.8, '#f4f0e6');
    // the header sign
    pq(p, F, 0.18, 0.82, 17.2, 18.8, '#f4f0e6');
    stencil(p, F, 0.27, 18.5, 'COFFEE', '#9a2a26');
    const [cx, cy] = F.F(0.41, 11.4);
    layer(p.c, (l) => {
      // the cup on the panel
      fillPoly(l, [[cx - 8, cy - 4], [cx + 8, cy - 4], [cx + 6, cy + 8], [cx - 6, cy + 8]], '#f4f0e6');
      ell(l, cx, cy - 4, 8, 2.5, '#3a1a0c');
      px(l, cx + 8, cy - 1, '#f4f0e6', 3, 5);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) px(l, cx - 4 + i * 4 + (j % 2), cy - 8 - j * 3, '#d8c8b0', 1, 2);
    }, { outline: false, rect: [cx - 10, cy - 22, cx + 12, cy + 10] });
    // the side: a stripe and the bin for cups beside it
    const S = p.rot === 0 ? side(p, 0.84) : side(p, 0.16);
    pq(p, S, 0.28, 0.82, 12, 13, '#f4f0e6');
    const [bx, by] = anchor(p, 0.24, 0.94, 0);
    layer(p.c, (l) => {
      for (let j = 0; j < 14; j++) px(l, bx - 6, by - j, j === 13 ? '#5a5e64' : '#3a3e44', 12, 1);
      px(l, bx - 6, by - 14, '#7a7e84', 12, 2);
      px(l, bx - 2, by - 16, '#f4f0e6', 4, 2);
    }, { rect: [bx - 8, by - 18, bx + 8, by + 2] });
    // a small weather hood
    lbox(p, 0.1, 0.22, 0.8, 0.7, 19.2, 0.8, mono(plate(GALV), GALV[0]));
    void k;
  },
  anim(p, k) {
    const F = front(p, 0.82);
    const g = 0.5 + 0.5 * Math.sin(k.t * 1.7);
    pq(p, F, 0.66, 0.8, 9.4, 9.8, g > 0.5 ? '#ff7a5a' : '#8a2a1a');
  },
};

// ── the harbour bench ────────────────────────────────────────
const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.25, W - 0.1, 0.85, 8, 0.26);
    const iron = mono(plate(['#14241c', '#1c3226', '#264232', '#30523e', '#3e644c', '#4e765c']), '#101c16');
    const teak = planks(['#4a3020', '#5e3e28', '#745032', '#8a623e', '#9e744a', '#b2885a'], 4);
    // cast-iron end frames, a middle support
    for (const a of [0.14, W / 2 - 0.04, W - 0.22]) {
      lbox(p, a, 0.34, 0.08, 0.46, 0, 4.2, iron);
      lbox(p, a, 0.28, 0.08, 0.08, 4.2, 5.4, iron);
    }
    // armrests at the two ends
    for (const a of [0.12, W - 0.24]) lbox(p, a, 0.3, 0.12, 0.5, 6.6, 0.6, iron);
    // the seat slats and the backrest
    for (let i = 0; i < 4; i++) lbox(p, 0.1, 0.36 + i * 0.11, W - 0.2, 0.09, 4.2, 0.6, mono(teak, '#3a2618'));
    for (let i = 0; i < 3; i++) lbox(p, 0.1, 0.27, W - 0.2, 0.04, 5.6 + i * 1.3, 1.0, mono(teak, '#3a2618'));
    // a brass plaque, a paper cup left behind, gull droppings
    const B = front(p, 0.31);
    pq(p, B, W / 2 - 0.12, W / 2 + 0.12, 7.2, 7.9, '#c89c42');
    const [cx, cy] = anchor(p, W - 0.45, 0.55, 4.8);
    px(p.c, cx - 2, cy - 6, '#f4f0e6', 5, 6);
    px(p.c, cx - 2, cy - 4, '#9a2a26', 5, 1);
    px(p.c, cx - 2, cy - 7, '#2a1a12', 5, 1);
    const Rn = rng(k.seed + 9);
    for (let i = 0; i < 4; i++) {
      const [gx, gy] = anchor(p, 0.3 + Rn() * (W - 0.6), 0.45 + Rn() * 0.3, 4.8);
      px(p.c, gx, gy, '#f2f0ea', 2, 1);
    }
  },
};

// ── crates ───────────────────────────────────────────────────
const crate: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.92, 0.92, 12, 0.28);
    const pn = planks(PINE, 6);
    const pv = planks(PINE, 6, 'v');
    // a big crate with diagonal braces, stencils, steel strapping
    lbox(p, 0.12, 0.14, 0.76, 0.72, 0, 7.6, { front: pn, side: pn, top: pv, edge: PINE[0] });
    const F = front(p, 0.86);
    const S = side(p, 0.88);
    for (const pl of [F, S] as const) {
      const [u0, u1] = pl === F ? [0.12, 0.88] : [0.14, 0.86];
      const [x0, y0] = pl.F(u0 + 0.04, 0.6);
      const [x1, y1] = pl.F(u1 - 0.04, 7);
      ln(p.c, x0, y0, x1, y1, PINE[2], 3);
      ln(p.c, x0, y0 - 1, x1, y1 - 1, PINE[4], 1);
      for (const u of [u0 + 0.03, u1 - 0.06]) pq(p, pl, u, u + 0.03, 0, 7.6, PINE[1]);
    }
    stencil(p, F, 0.2, 6.2, k.seed % 2 ? 'NSTR 23' : 'FRAGILE', '#3a2a1a');
    pq(p, F, 0.6, 0.78, 2.2, 4.8, '#c8382a');
    pq(p, F, 0.62, 0.76, 2.5, 4.5, '#f4ece0');
    if (k.seed % 2) {
      // a smaller crate on top, a coil of rope beside it
      lbox(p, 0.22, 0.24, 0.42, 0.4, 7.6, 4.6, { front: pn, side: pn, top: pv, edge: PINE[0] });
      const [cx, cy] = anchor(p, 0.72, 0.62, 7.6);
      coil(p.c, cx, cy, 9, ROPE);
    } else {
      // stacked fish boxes in blue plastic, ice showing on top
      for (let j = 0; j < 3; j++) {
        lbox(p, 0.2, 0.22, 0.6, 0.56, 7.6 + j * 2.2, 2.2, mono(plate(P.blue), P.blue[0]));
        pq(p, front(p, 0.78), 0.3, 0.7, 8.6 + j * 2.2, 9.2 + j * 2.2, P.blue[1]);
      }
      const [ix, iy] = anchor(p, 0.5, 0.5, 14.2);
      for (let i = 0; i < 12; i++) px(p.c, ix - 12 + hash(i, 1, k.seed) * 22, iy - 4 + hash(i, 2, k.seed) * 8, i % 3 ? '#e8f4f6' : '#b8dce4', 2, 1);
    }
  },
};

// ── oil drums ────────────────────────────────────────────────
function drum(c: CanvasRenderingContext2D, x: number, y: number, col: Ramp, rusty: number, seed: number) {
  for (let j = 0; j < 30; j++) {
    for (let i = -9; i < 9; i++) {
      const t = (i + 9) / 18;
      let tone = t < 0.18 ? 5 : t < 0.45 ? 4 : t < 0.78 ? 3 : 2;
      if (j % 10 === 4 || j % 10 === 5) tone -= j % 10 === 4 ? -1 : 1;
      if (rusty && hash(i + 9, j, seed) < rusty * (j < 8 ? 2 : 0.6)) {
        px(c, x + i, y - j, RUST[Math.max(1, tone - 1)]);
        continue;
      }
      px(c, x + i, y - j, col[Math.max(0, Math.min(col.length - 1, tone))]);
    }
  }
  ell(c, x, y - 30, 9, 4, col[4]);
  ell(c, x, y - 30, 7.5, 3, col[2]);
  ell(c, x + 3, y - 31, 1.6, 1, '#1a1a1e');
  ell(c, x - 3, y - 29, 1.2, 0.8, '#3a3a40');
}

const barrel: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.42, 0.6);
    contactShadow(p.c, x + 12, y + 2, 22, 7, 0.3);
    layer(p.c, (l) => {
      drum(l, x + 14, y - 6, P.blue, 0, k.seed);
      drum(l, x, y, P.red, 0.12, k.seed + 1);
      // a hazard label and a funnel on the red drum
      fillPoly(l, [[x - 2, y - 20], [x + 3, y - 15], [x - 2, y - 10], [x - 7, y - 15]], '#f2c43a');
      text(l, x - 3, y - 17, '3', '#1e1e24');
      fillPoly(l, [[x - 5, y - 36], [x + 5, y - 36], [x + 1, y - 31], [x - 1, y - 31]], '#7a7e84');
      ell(l, x, y - 36, 5, 1.6, '#a8acb0');
      // a yellow jerrycan in front
      px(l, x + 10, y - 9, '#c8941c', 8, 10);
      px(l, x + 10, y - 9, '#e8b42a', 3, 10);
      px(l, x + 12, y - 12, '#c8941c', 4, 3);
    }, { outline: 0.62, rect: [x - 12, y - 44, x + 26, y + 4] });
  },
};

// ── night lights in the room ─────────────────────────────────
booth.lights = () => [{ a: 0.8, b: 1.95, z: 26, r: 1.8, color: '#cfe8ff', kind: 'window' }];
kiosk.lights = () => [{ a: 0.5, b: 0.8, z: 12, r: 1.1, color: '#9ad8ff', kind: 'window' }];
vending.lights = () => [{ a: 0.5, b: 0.85, z: 12, r: 1.4, color: '#fff0d0', kind: 'window' }];
dispatch.lights = (k) => [{ a: k.w / 2, b: 0.5, z: 25, r: 2.4, color: '#ffe2b0', kind: 'lamp' }];
crane.lights = (k) => [{ a: k.w / 2, b: k.d / 2, z: 60, r: 3, color: '#f2f6ff', kind: 'lamp' }];

export const PORT_QUAY: Record<string, PropArt> = {
  container,
  desk: dispatch,
  booth,
  kiosk,
  crane,
  rack,
  forklift,
  boat,
  bollard,
  vending,
  bench,
  crate,
  barrel,
};

export { glass, KRAFT, PINE, WRAP };
export type { PropCtx };

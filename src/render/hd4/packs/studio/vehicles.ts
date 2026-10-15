// Creative Studio — vehicles and boats as real 3D objects (1 z ≈ 10 cm, a tile ≈ 1.6 m = 16 z).
//   std_camper     'bus'    a bay-window surf bus: two-tone, rounded roof, roof rack with boards
//                  'camper' a coach-built motorhome: cab, Luton bunk, tall box, roll-out awning,
//                           chairs under it, solar panel, rear ladder
//   std_foodTruck  a mint step-van selling gelato: serving hatch, striped flap, counter, cone sign
//   std_bikes      beach cruisers parked side by side (each in its own plane); 'rack' adds a
//                  galvanised hoop rack and a rental sign
//   std_boat       'sail' (furled) / 'sailUp' a sloop · 'motor' a speedboat · 'row' a clinker rowing
//                  boat · 'dinghy' an inflatable tender · 'kayaks' three sit-on-tops · 'pedalo'
// Wheels are drawn in the plane of the vehicle's side (an oblique ellipse in isometric), with
// tyre, sidewall, rim, hub, an arch over each and a contact shadow under it.
import type { FaceTex, Light, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, fillPoly, foliage, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { footShadow, lbox } from '../util';
import { coastX } from './ground';
import { ALU, CORAL, darken, GEAR, LEAF, lighten, MINT, PINE, pmod, solidFaces, TEAL } from './kit';

type V3 = [number, number, number];
type V2 = [number, number];
const TYRE: Ramp = ['#0e0d12', '#18171c', '#222128', '#2e2d34', '#3c3b44', '#4c4b54'];
const YEL: Ramp = ['#7a5a0a', '#9a7410', '#c09218', '#e0b024', '#f4c63a', '#f8d860', '#fce890'];
const WHITE: Ramp = ['#8a8680', '#a8a49c', '#c4c0b6', '#dad6cc', '#eae6dc', '#f6f2ea', '#fffcf6'];

/** Glossy paint: lit / mid / dark faces, a soft gradient upward and a bright lip at the top edge. */
const paint =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = light === 2 ? 4.7 : light === 1 ? 3.5 : 2.1;
    i += (v / Math.max(1, h)) * 0.5;
    if (v > h - 1.4) i += 0.9;
    if (v < 1.2) i -= 0.8;
    if (hash(x, y, 811) < 0.012) i += 0.8;
    return at(r, i);
  };
const flatM =
  (r: Ramp, d = 0): Mat =>
  (light) =>
  () =>
    at(r, (light === 2 ? 4.6 : light === 1 ? 3.4 : 2) + d);
const box3 = (r: Ramp) => ({ front: paint(r), side: paint(r), top: paint(r), edge: darken(r[0], 0.25) });
/** Dark tinted glass with diagonal reflections and a pale top band. */
const glass =
  (tint = '#2a3e4c'): Mat =>
  (light, _w, h) =>
  (u, v) => {
    if (v > h - 1.4) return '#8aa8b4';
    if ((u * 0.8 + v * 1.4) % 34 < 6) return '#a8c8d2';
    return light ? tint : darken(tint, 0.18);
  };
/** A visible side plane: the end at a1 for rot 0, at a0 for rot 1. */
const visEnd = (p: PropPainter, a0: number, a1: number) => (p.rot === 0 ? a1 : a0);

/** A wheel in the plane b = const: tyre, sidewall, rim, hub and lug nuts, with its arch and shadow. */
function wheel(p: PropPainter, a: number, b: number, R: number, rim: string, arch?: string) {
  const c = p.c;
  const zc = R * 16;
  const ring = (r: number, dz = 0, da = 0): V2[] => {
    const out: V2[] = [];
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      out.push(p.P(a + da + Math.cos(t) * r, b, zc + dz + Math.sin(t) * r * 16));
    }
    return out;
  };
  if (arch) {
    // the wheel arch: the dark well in the body side over the tyre
    const pts: V2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * Math.PI;
      pts.push(p.P(a + Math.cos(t) * R * 1.22, b, zc + Math.sin(t) * R * 16 * 1.22));
    }
    fillPoly(c, pts, arch);
  }
  const [gx, gy] = p.P(a, b, 0);
  contactShadow(c, gx + 3, gy + 1, R * 64 + 4, 4, 0.55);
  fillPoly(c, ring(R), TYRE[1]);
  fillPoly(c, ring(R * 0.9, 0.3, -0.006), TYRE[3]);
  fillPoly(c, ring(R * 0.62), darken(rim, 0.35));
  fillPoly(c, ring(R * 0.55, 0.2, -0.004), rim);
  fillPoly(c, ring(R * 0.22), lighten(rim, 0.3));
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2 + 0.3;
    const [x, y] = p.P(a + Math.cos(t) * R * 0.36, b, zc + Math.sin(t) * R * 0.36 * 16);
    px(c, x - 1, y - 1, darken(rim, 0.45), 2, 2);
  }
  // a glint on the tyre's upper shoulder
  const [hx, hy] = p.P(a - R * 0.55, b, zc + R * 0.8 * 16);
  px(c, hx - 1, hy, TYRE[5], 3, 1);
}

/** A rounded roof over a box: strips across b rising to a crown. */
function roundRoof(p: PropPainter, a0: number, a1: number, b0: number, b1: number, z: number, rise: number, r: Ramp) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const z0 = z + Math.sin(t0 * Math.PI) * rise;
    const z1 = z + Math.sin(t1 * Math.PI) * rise;
    const q = [p.P(a0, b0 + (b1 - b0) * t0, z0), p.P(a1, b0 + (b1 - b0) * t0, z0), p.P(a1, b0 + (b1 - b0) * t1, z1), p.P(a0, b0 + (b1 - b0) * t1, z1)];
    fillPoly(p.c, q, at(r, [5.6, 5.2, 4.6, 3.8, 3.2][i]));
  }
  // the end caps of the curve on the visible end
  const ae = visEnd(p, a0, a1);
  const cap: V2[] = [];
  for (let i = 0; i <= n; i++) cap.push(p.P(ae, b0 + ((b1 - b0) * i) / n, z + Math.sin((i / n) * Math.PI) * rise));
  fillPoly(p.c, cap, at(r, p.rot === 0 ? 2.6 : 3.6));
}

/** A surfboard lying along a on a roof rack. */
function board(c: CanvasRenderingContext2D, p: PropPainter, a0: number, a1: number, b: number, z: number, col: string) {
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.round(Math.sqrt(Math.max(0, Math.sin(Math.min(1, t * 1.08 + 0.03) * Math.PI))) * 5) + 1;
    const [x, y] = p.P(a0 + (a1 - a0) * t, b, z);
    px(c, x - w, y - 1, col, w * 2, 3);
    px(c, x - w, y - 1, lighten(col, 0.3), w * 2, 1);
    if (Math.abs(t - 0.5) < 0.015) px(c, x - w, y - 1, darken(col, 0.35), w * 2, 3);
  }
}

/** A white number plate with dark characters on a plane. */
function plate(p: PropPainter, pl: ReturnType<typeof front>, u: number, z: number, w = 0.22) {
  pq(p, pl, u - w / 2, u + w / 2, z, z + 1.5, '#f6f2ea');
  for (let i = 0; i < 4; i++) pq(p, pl, u - w / 2 + 0.03 + i * (w - 0.06) / 4, u - w / 2 + 0.06 + i * (w - 0.06) / 4, z + 0.4, z + 1.1, '#2a2a34');
}

// ── the surf bus and the motorhome ──────────────────────────
function bus(p: PropPainter, k: { w: number; d: number; seed: number; color?: string }) {
  const W = k.w;
  const D = k.d;
  const c = p.c;
  const low = k.color === 'teal' ? TEAL : YEL;
  const a0 = 0.15;
  const a1 = W - 0.15;
  const b0 = D / 2 - 0.58;
  const b1 = D / 2 + 0.58;
  const zl = 4;
  const zw = 11.6;
  const zr = 19.4;
  const wa = [a0 + 0.62, a1 - 0.6];
  const R = 0.21;
  footShadow(p, a0, b0 + 0.1, a1 + 0.1, b1 + 0.15, 22, 0.5);
  // the far wheels under the body, the floor pan and running gear
  for (const a of wa) {
    const [x, y] = p.P(a, b0 + 0.12, R * 16);
    ell(c, x, y, 12, 13, TYRE[0]);
  }
  lbox(p, a0 + 0.3, b0 + 0.12, a1 - a0 - 0.6, b1 - b0 - 0.24, 1.6, zl - 1.6, box3(GEAR));
  // two-tone body: colour below the waist, white above, a rounded roof
  lbox(p, a0, b0, a1 - a0, b1 - b0, zl, zw - zl, box3(low));
  lbox(p, a0, b0, a1 - a0, b1 - b0, zw, zr - zw, box3(WHITE));
  roundRoof(p, a0, a1, b0, b1, zr, 1.6, WHITE);
  const F = front(p, b1);
  // the windows: the cab door's, then three along the side, in white frames
  const wins: [number, number][] = [[a1 - 0.72, a1 - 0.12]];
  const sw0 = a0 + 0.18;
  const sw1 = a1 - 0.84;
  for (let i = 0; i < 3; i++) wins.push([sw0 + (i * (sw1 - sw0)) / 3 + 0.03, sw0 + ((i + 1) * (sw1 - sw0)) / 3 - 0.03]);
  for (const [u0, u1] of wins) {
    pq(p, F, u0 - 0.03, u1 + 0.03, zw + 1.4, zr - 1, WHITE[2]);
    pt(p, F, u0, u1, zw + 1.8, zr - 1.4, glass(), F.light);
  }
  // waist chrome, the door seams, handles, a sun-and-wave decal, the fuel flap
  pq(p, F, a0, a1, zw - 0.3, zw + 0.3, '#eef2f4');
  for (const u of [a1 - 0.76, sw0 + (sw1 - sw0) / 3, sw0 + (2 * (sw1 - sw0)) / 3 + 0.18]) pq(p, F, u - 0.008, u + 0.008, zl + 0.6, zr - 0.6, darken(low[2], 0.2));
  for (const u of [a1 - 0.7, sw0 + (sw1 - sw0) / 3 + 0.08]) pq(p, F, u, u + 0.09, zw - 1.6, zw - 1.0, ALU[5]);
  const [dx, dy] = F.F(a0 + 0.45, zl + 4.2);
  ell(c, dx, dy, 7, 7, '#f6f2ea');
  ell(c, dx, dy, 5, 5, CORAL[3]);
  for (let i = -6; i <= 6; i += 3) px(c, dx + i, dy + 3 + (i % 2 ? 1 : 0), '#2a8ab8', 3, 2);
  pq(p, F, a0 + 0.9, a0 + 1.0, zw - 3.4, zw - 2.2, darken(low[3], 0.12));
  for (const a of wa) wheel(p, a, b1, R, '#f2f0e8', '#1a1418');
  // the mirror on its arm by the cab door
  const [mx, my] = F.F(a1 - 0.08, zw + 3.4);
  ln(c, mx, my, mx + 6, my + 1, GEAR[3], 2);
  px(c, mx + 5, my - 4, GEAR[2], 4, 7);
  px(c, mx + 5, my - 4, GEAR[5], 1, 6);
  const ae = visEnd(p, a0, a1);
  const S = side(p, ae);
  if (ae === a1) {
    // the nose: a wide windscreen, the white V and the round badge, headlamps, indicators, bumper, plate
    pq(p, S, b0 + 0.05, b1 - 0.05, zw + 1.2, zr - 0.8, WHITE[3]);
    pt(p, S, b0 + 0.1, b1 - 0.1, zw + 1.6, zr - 1.2, glass('#2e4654'), S.light);
    pq(p, S, (b0 + b1) / 2 - 0.01, (b0 + b1) / 2 + 0.01, zw + 1.6, zr - 1.2, WHITE[2]);
    const cb = (b0 + b1) / 2;
    const [vx, vy] = S.F(cb, zw - 0.6);
    const [lx0, ly0] = S.F(b0 + 0.06, zw - 0.2);
    const [lx1, ly1] = S.F(b1 - 0.06, zw - 0.2);
    fillPoly(c, [[lx0, ly0], [vx, vy + 12], [lx1, ly1], [lx1, ly1 - 4], [vx, vy + 7], [lx0, ly0 - 4]], WHITE[5]);
    ell(c, vx, vy + 6, 5, 5, WHITE[6]);
    ell(c, vx, vy + 6, 3.5, 3.5, low[3]);
    px(c, vx - 1, vy + 4, WHITE[6], 2, 4);
    for (const b of [b0 + 0.2, b1 - 0.2]) {
      const [hx, hy] = S.F(b, zl + 3.6);
      ell(c, hx, hy, 6, 6, ALU[4]);
      ell(c, hx, hy, 4.6, 4.6, '#fff6d0');
      px(c, hx - 2, hy - 3, '#ffffff', 2, 2);
      const [ix, iy] = S.F(b, zl + 6.2);
      px(c, ix - 2, iy - 1, '#f2902a', 4, 2);
    }
    lbox(p, a1, b0 + 0.02, 0.1, b1 - b0 - 0.04, zl - 1, 1.6, box3(WHITE));
    plate(p, side(p, a1 + 0.1), cb, zl - 0.8);
    pq(p, S, b0 + 0.08, b1 - 0.08, zl + 0.6, zl + 1.4, low[1]);
  } else {
    // the tail: the engine lid with its louvres, tail lamps, the rear window, bumper and plate
    pq(p, S, b0 + 0.06, b1 - 0.06, zw + 1.6, zr - 1.2, WHITE[2]);
    pt(p, S, b0 + 0.12, b1 - 0.12, zw + 2, zr - 1.6, glass('#2e4654'), S.light);
    pq(p, S, b0 + 0.2, b1 - 0.2, zl + 1.6, zw - 1, darken(low[3], 0.1));
    for (let z = zw - 2.6; z > zl + 2.6; z -= 1.1) pq(p, S, b0 + 0.3, b1 - 0.3, z, z + 0.45, low[1]);
    for (const b of [b0 + 0.08, b1 - 0.14]) pq(p, S, b, b + 0.06, zl + 3.4, zw - 1, '#d8302a');
    lbox(p, a0 - 0.1, b0 + 0.02, 0.1, b1 - b0 - 0.04, zl - 1, 1.6, box3(WHITE));
    plate(p, side(p, a0 - 0.1), (b0 + b1) / 2, zl - 0.8);
  }
  // the roof rack: two rails on posts, cross bars, two boards and a cool box strapped on
  const rz = zr + 2.6;
  layer(c, (l) => {
    for (const b of [b0 + 0.1, b1 - 0.1]) {
      const q0 = p.P(a0 + 0.2, b, rz);
      const q1 = p.P(a1 - 0.3, b, rz);
      ln(l, q0[0], q0[1], q1[0], q1[1], GEAR[2], 2);
      for (const a of [a0 + 0.2, (a0 + a1) / 2, a1 - 0.3]) {
        const [x, y] = p.P(a, b, rz);
        px(l, x - 1, y, GEAR[3], 2, 6);
      }
    }
    for (const a of [a0 + 0.5, a1 - 0.6]) {
      const q0 = p.P(a, b0 + 0.1, rz);
      const q1 = p.P(a, b1 - 0.1, rz);
      ln(l, q0[0], q0[1], q1[0], q1[1], GEAR[3], 2);
    }
    board(l, p, a0 + 0.1, a1 - 0.5, (b0 + b1) / 2 - 0.2, rz + 0.8, '#f6eedc');
    board(l, p, a0 + 0.3, a1 - 0.7, (b0 + b1) / 2 + 0.18, rz + 0.8, ['#2a8ab8', '#e06a4a', '#7ac7bb'][pmod(k.seed, 3)]);
  }, { outline: 0.55 });
}

function motorhome(p: PropPainter, k: { w: number; d: number; seed: number }) {
  const W = k.w;
  const D = k.d;
  const c = p.c;
  const b0 = 0.18;
  const b1 = 1.36;
  const a0 = 0.1;
  const ac = W - 0.78; // where the box ends and the cab begins
  const a1 = W - 0.12;
  const zl = 4;
  const zt = 25;
  const R = 0.22;
  const wa = [a0 + 0.55, a1 - 0.36];
  footShadow(p, a0, b0, a1 + 0.1, b1 + 0.1, 28, 0.5);
  for (const a of wa) {
    const [x, y] = p.P(a, b0 + 0.12, R * 16);
    ell(c, x, y, 13, 14, TYRE[0]);
  }
  lbox(p, a0 + 0.2, b0 + 0.12, a1 - a0 - 0.4, b1 - b0 - 0.24, 1.6, zl - 1.6, box3(GEAR));
  // the cab: a white van front, a bonnet, the sloping windscreen
  lbox(p, ac, b0 + 0.04, a1 - 0.3 - ac, b1 - b0 - 0.08, zl, 15, box3(WHITE));
  lbox(p, a1 - 0.3, b0 + 0.06, 0.3, b1 - b0 - 0.12, zl, 6.4, box3(WHITE));
  solidFaces(p, [[[a1 - 0.3, b0 + 0.06, zl + 15], [a1 - 0.3, b1 - 0.06, zl + 15], [a1, b1 - 0.06, zl + 6.4], [a1, b0 + 0.06, zl + 6.4]]], () => glass('#2e4654'), true);
  // the box: tall, white, a teal band with a coral pinstripe, the Luton bunk over the cab
  const livery: Mat = (light, _w, h) => (u, v, x, y) => {
    if (v > 1 && v < 5.5) return at(TEAL, light === 1 ? 3.6 : 2.2);
    if (v > 6 && v < 6.8) return at(CORAL, light === 1 ? 3.6 : 2.4);
    if (v > 7.4 && v < 9 + Math.sin(u / 26) * 1.2) return at(MINT, light === 1 ? 4 : 2.6);
    return paint(WHITE)(light, _w, h)(u, v, x, y);
  };
  lbox(p, a0, b0, ac - a0, b1 - b0, zl, zt - zl, { front: livery, side: livery, top: paint(WHITE), edge: WHITE[0] });
  lbox(p, ac, b0 + 0.02, a1 - 0.36 - ac, b1 - b0 - 0.04, zl + 15.6, zt - zl - 15.6, box3(WHITE));
  roundRoof(p, a0, a1 - 0.36, b0, b1, zt, 0.8, WHITE);
  const F = front(p, b1);
  const Fc = front(p, b1 - 0.04);
  // the cab door, its window, the mirror; the Luton's wrap-round window
  pt(p, Fc, ac + 0.08, a1 - 0.38, zl + 9, zl + 14.4, glass(), Fc.light);
  pq(p, Fc, ac + 0.04, ac + 0.05, zl + 0.6, zl + 14.6, WHITE[1]);
  pq(p, Fc, ac + 0.2, ac + 0.3, zl + 7.4, zl + 8, ALU[4]);
  pt(p, F, ac + 0.1, a1 - 0.5, zt - 4.4, zt - 1.6, glass('#38505c'), F.light);
  const [mx, my] = Fc.F(a1 - 0.32, zl + 13);
  ln(c, mx, my, mx + 7, my + 1, GEAR[3], 2);
  px(c, mx + 6, my - 5, GEAR[2], 4, 8);
  // habitation windows with curtains, the door with its window and step, a vent, the awning cassette
  const curt = ['#f0a6c0', '#f2da74', '#9ad0e8'];
  for (const [u0, u1, i] of [[a0 + 0.2, a0 + 0.78, 0], [ac - 0.62, ac - 0.12, 2]] as const) {
    pq(p, F, u0 - 0.03, u1 + 0.03, zl + 9.6, zl + 16.4, GEAR[3]);
    pt(p, F, u0, u1, zl + 10, zl + 16, glass('#34505e'), F.light);
    pq(p, F, u0, u0 + 0.1, zl + 10, zl + 16, curt[i]);
    pq(p, F, u1 - 0.1, u1, zl + 10, zl + 16, curt[i]);
  }
  const d0 = a0 + 0.95;
  const d1 = a0 + 1.35;
  pq(p, F, d0 - 0.02, d1 + 0.02, zl + 0.4, zl + 17.2, WHITE[1]);
  pq(p, F, d0, d1, zl + 0.6, zl + 17, WHITE[F.light ? 5 : 3]);
  pt(p, F, d0 + 0.08, d1 - 0.08, zl + 11, zl + 15.6, glass(), F.light);
  pq(p, F, d1 - 0.1, d1 - 0.05, zl + 8, zl + 9, ALU[3]);
  lbox(p, d0 - 0.02, b1, d1 - d0 + 0.04, 0.16, 1.6, 0.8, box3(ALU));
  for (const a of wa) wheel(p, a, b1, R, ALU[5], '#1a1418');
  // the awning: a striped canvas out from its cassette on two legs, a mat, two chairs, a table
  const az = zt - 2.6;
  const aOut = D - 0.12;
  lbox(p, a0 + 0.15, b1, ac - a0 - 0.3, 0.12, az, 1.6, box3(ALU));
  const legs = [a0 + 0.2, ac - 0.2];
  layer(c, (l) => {
    fillPoly(l, [p.P(legs[0] + 0.1, b1 + 0.12, 0.1), p.P(legs[1] - 0.1, b1 + 0.12, 0.1), p.P(legs[1] - 0.1, aOut - 0.06, 0.1), p.P(legs[0] + 0.1, aOut - 0.06, 0.1)], '#2a8ab8');
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const q0 = p.P(legs[0] + 0.12 + (legs[1] - legs[0] - 0.24) * t, b1 + 0.14, 0.15);
      const q1 = p.P(legs[0] + 0.12 + (legs[1] - legs[0] - 0.24) * t, aOut - 0.08, 0.15);
      ln(l, q0[0], q0[1], q1[0], q1[1], '#f2c84a');
    }
  }, { outline: false });
  // folding chairs and a little table on the mat
  layer(c, (l) => {
    for (const [a, col] of [[legs[0] + 0.45, '#e0402a'], [legs[0] + 1.05, '#2a8a86']] as const) {
      const [x, y] = p.P(a, (b1 + aOut) / 2 + 0.05, 0);
      ln(l, x - 6, y, x + 4, y - 14, ALU[3], 2);
      ln(l, x + 5, y, x - 3, y - 12, ALU[3], 2);
      fillPoly(l, [[x - 7, y - 10], [x + 6, y - 10], [x + 4, y - 7], [x - 7, y - 7]], col);
      fillPoly(l, [[x + 2, y - 22], [x + 7, y - 20], [x + 6, y - 9], [x + 1, y - 11]], darken(col, 0.15));
    }
    const [tx, ty] = p.P(legs[0] + 0.75, (b1 + aOut) / 2 - 0.1, 0);
    ln(l, tx - 5, ty, tx - 5, ty - 11, ALU[3], 2);
    ln(l, tx + 5, ty, tx + 5, ty - 11, ALU[3], 2);
    fillPoly(l, [[tx - 9, ty - 12], [tx, ty - 16], [tx + 9, ty - 12], [tx, ty - 8]], '#f6f2ea');
    px(l, tx - 2, ty - 18, '#e8f4f8', 3, 5);
    px(l, tx + 2, ty - 17, '#e0402a', 3, 4);
  }, { outline: 0.5 });
  // the canvas: stripes, a scalloped valance, legs to the ground
  const canvas: FaceTex = (u) => (Math.floor(u / 10) % 2 ? '#f6f2ea' : '#1e8a90');
  solidFaces(p, [[[legs[0] - 0.1, b1 + 0.12, az + 0.6], [legs[1] + 0.1, b1 + 0.12, az + 0.6], [legs[1] + 0.1, aOut, az - 2.2], [legs[0] - 0.1, aOut, az - 2.2]]], () => canvas, true);
  layer(c, (l) => {
    for (let a = legs[0] - 0.1; a < legs[1] + 0.1; a += 0.14) {
      const [x, y] = p.P(a, aOut, az - 2.2);
      fillPoly(l, [[x, y], [x + 9, y + 4], [x + 4, y + 7]], Math.floor((a - legs[0]) / 0.14) % 2 ? '#1e8a90' : '#f6f2ea');
    }
    for (const a of legs) {
      const [x, y] = p.P(a, aOut - 0.02, 0);
      const [, yt] = p.P(a, aOut - 0.02, az - 2.2);
      contactShadow(l, x + 2, y + 1, 3, 1.5, 0.45);
      px(l, x - 1, yt, ALU[4], 2, y - yt);
    }
  }, { outline: 0.5 });
  // on the roof: an air conditioner, a skylight, a solar panel, the TV dome
  lbox(p, a0 + 0.3, (b0 + b1) / 2 - 0.25, 0.5, 0.5, zt + 0.8, 2, box3(WHITE));
  lbox(p, a0 + 1.0, b0 + 0.25, 0.7, 0.62, zt + 0.8, 0.4, { front: flatM(GEAR), side: flatM(GEAR), top: (light: Light) => (u: number, v: number) => (u % 14 < 1 || v % 12 < 1 ? '#8aa4c8' : light ? '#24386a' : '#1c2c58'), edge: GEAR[0] });
  lbox(p, a0 + 1.8, (b0 + b1) / 2 - 0.15, 0.3, 0.3, zt + 0.8, 0.9, { front: flatM(WHITE), side: flatM(WHITE), top: (light: Light) => () => (light ? '#c8e0e8' : '#a8c4cc'), edge: WHITE[0] });
  const ae = visEnd(p, a0, a1);
  const S = side(p, ae);
  if (ae === a1) {
    for (const b of [b0 + 0.22, b1 - 0.22]) {
      const [hx, hy] = S.F(b, zl + 4.6);
      px(c, hx - 6, hy - 3, ALU[4], 12, 6);
      px(c, hx - 5, hy - 2, '#fff6d0', 10, 4);
    }
    pq(p, S, b0 + 0.36, b1 - 0.36, zl + 2.6, zl + 5.6, GEAR[2]);
    for (let z = zl + 3; z < zl + 5.4; z += 0.8) pq(p, S, b0 + 0.38, b1 - 0.38, z, z + 0.3, ALU[3]);
    lbox(p, a1, b0 + 0.06, 0.08, b1 - b0 - 0.12, zl - 1, 1.8, box3(GEAR));
    plate(p, side(p, a1 + 0.08), (b0 + b1) / 2, zl - 0.6);
  } else {
    // the back: a window, tail-light clusters, the ladder to the roof, a bike rack with two bikes
    pq(p, S, b0 + 0.3, b1 - 0.3, zl + 12, zl + 17, GEAR[3]);
    pt(p, S, b0 + 0.33, b1 - 0.33, zl + 12.3, zl + 16.7, glass('#34505e'), S.light);
    for (const b of [b0 + 0.06, b1 - 0.14]) {
      pq(p, S, b, b + 0.08, zl + 2, zl + 6, '#d8302a');
      pq(p, S, b, b + 0.08, zl + 4.6, zl + 5.4, '#f2902a');
    }
    lbox(p, a0 - 0.1, b0 + 0.04, 0.1, b1 - b0 - 0.08, zl - 1, 1.8, box3(GEAR));
    plate(p, side(p, a0 - 0.1), (b0 + b1) / 2, zl - 0.6);
    layer(c, (l) => {
      for (const b of [b0 + 0.12, b0 + 0.32]) {
        const [x0, y0] = p.P(a0 - 0.04, b, zl + 6);
        const [, y1] = p.P(a0 - 0.04, b, zt + 1);
        px(l, x0 - 1, y1, ALU[4], 2, y0 - y1);
      }
      for (let z = zl + 7; z < zt; z += 2.2) {
        const q0 = p.P(a0 - 0.04, b0 + 0.12, z);
        const q1 = p.P(a0 - 0.04, b0 + 0.32, z);
        ln(l, q0[0], q0[1], q1[0], q1[1], ALU[5]);
      }
    }, { outline: 0.5 });
    for (const [b, col] of [[b0 + 0.6, '#e0402a'], [b0 + 0.85, '#2a8ab8']] as const) bike(p, a0 - 0.22, b, 0, col, 'a', 0.75, k.seed);
  }
}

const camper: PropArt = {
  draw(p, k) {
    if (k.variant === 'camper') motorhome(p, k);
    else bus(p, k);
  },
};

// ── the gelato step-van ─────────────────────────────────────
const foodTruck: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const b0 = 0.28;
    const b1 = 1.5;
    const a0 = 0.12;
    const ac = W - 0.72;
    const a1 = W - 0.1;
    const zl = 4.4;
    const zt = 24;
    const R = 0.24;
    const wa = [a0 + 0.62, a1 - 0.36];
    footShadow(p, a0, b0, a1 + 0.1, b1 + 0.1, 26, 0.5);
    for (const a of wa) {
      const [x, y] = p.P(a, b0 + 0.12, R * 16);
      ell(c, x, y, 14, 15, TYRE[0]);
    }
    lbox(p, a0 + 0.2, b0 + 0.12, a1 - a0 - 0.4, b1 - b0 - 0.24, 1.6, zl - 1.6, box3(GEAR));
    // the body: ribbed mint panels, a cream roof, the cab a step lower with a big windscreen
    const ribbed: Mat = (light, _w, h) => (u, v, x, y) => {
      let i = (light === 2 ? 4.7 : light === 1 ? 3.6 : 2.2) + (v / h) * 0.4;
      if (u % 18 < 1.2) i -= 0.7;
      else if (u % 18 < 2.2) i += 0.4;
      if (v > h - 1.4) i += 0.9;
      if (hash(x, y, 812) < 0.01) i += 0.8;
      return at(MINT, i);
    };
    lbox(p, a0, b0, ac - a0, b1 - b0, zl, zt - zl, { front: ribbed, side: ribbed, top: paint(WHITE), edge: MINT[0] });
    lbox(p, ac, b0 + 0.02, a1 - ac - 0.24, b1 - b0 - 0.04, zl, zt - zl - 1.4, box3(MINT));
    lbox(p, a1 - 0.24, b0 + 0.05, 0.22, b1 - b0 - 0.1, zl, 6.4, box3(MINT));
    if (p.rot === 0) {
      // the step-van's upright windscreen in two panes over a short bonnet
      const Sw = side(p, a1 - 0.24);
      pq(p, Sw, b0 + 0.06, b1 - 0.06, zl + 8.6, zt - 3, MINT[4]);
      pt(p, Sw, b0 + 0.1, (b0 + b1) / 2 - 0.03, zl + 9, zt - 3.4, glass('#2e4654'), Sw.light);
      pt(p, Sw, (b0 + b1) / 2 + 0.03, b1 - 0.1, zl + 9, zt - 3.4, glass('#2e4654'), Sw.light);
    }
    const F = front(p, b1);
    const Fc = front(p, b1 - 0.02);
    // the cab's sliding door window, a mirror; the coral band and the name along the body
    pt(p, Fc, ac + 0.1, a1 - 0.36, zl + 9, zt - 3.4, glass(), Fc.light);
    pq(p, Fc, ac + 0.04, ac + 0.055, zl + 0.6, zt - 2.6, MINT[1]);
    const [mx, my] = Fc.F(a1 - 0.3, zl + 13);
    ln(c, mx, my, mx + 7, my + 1, GEAR[3], 2);
    px(c, mx + 6, my - 5, GEAR[2], 4, 8);
    pq(p, F, a0, ac, zl + 1.6, zl + 4.4, CORAL[F.light ? 3 : 2]);
    pq(p, F, a0, ac, zl + 4.4, zl + 4.8, '#fbf6ee');
    for (let i = 0; i < 6; i++) {
      const u = a0 + 0.35 + i * 0.22;
      pq(p, F, u, u + 0.12, zl + 2.2, zl + 3.8, '#fbf6ee');
      pq(p, F, u + 0.03, u + 0.09, zl + 2.6, zl + 3.4, CORAL[F.light ? 3 : 2]);
    }
    // the serving hatch: the dark inside with a menu, a fridge's glow, the counter with cones and sauces
    const h0 = a0 + 0.3;
    const h1 = ac - 0.16;
    const hz0 = zl + 8;
    const hz1 = zt - 6;
    pq(p, F, h0 - 0.05, h1 + 0.05, hz0 - 0.5, hz1 + 0.5, '#f6f2ea');
    pq(p, F, h0, h1, hz0, hz1, '#3a2a2e');
    pq(p, F, h0, h1, hz1 - 0.6, hz1, '#24181c');
    for (let i = 0; i < 4; i++) {
      const u = h0 + 0.1 + i * ((h1 - h0 - 0.2) / 4);
      pq(p, F, u, u + 0.24, hz1 - 4.4, hz1 - 1.2, ['#f0a6c0', '#b8e2c8', '#f6d8a0', '#9ad0e8'][i]);
      pq(p, F, u + 0.04, u + 0.2, hz1 - 2.2, hz1 - 1.8, '#3a2a2a');
    }
    pq(p, F, h0 + 0.1, h1 - 0.1, hz0 + 0.6, hz0 + 2.6, '#7ad0d8');
    for (let i = 0; i < 6; i++) {
      const u = h0 + 0.15 + i * ((h1 - h0 - 0.3) / 6);
      pq(p, F, u, u + 0.12, hz0 + 0.8, hz0 + 2.2, ['#f6d8a0', '#f0a6c0', '#b8e2c8', '#7a4a2a', '#f6f2ea', '#e8c0a0'][i]);
    }
    lbox(p, h0 - 0.05, b1, h1 - h0 + 0.1, 0.22, hz0 - 0.6, 0.7, { front: flatM(PINE), side: flatM(PINE), top: flatM(PINE, 1), edge: PINE[0] });
    layer(c, (l) => {
      const [nx, ny] = p.P(h0 + 0.2, b1 + 0.11, hz0 + 0.1);
      px(l, nx - 3, ny - 6, ALU[4], 6, 6);
      px(l, nx - 2, ny - 8, '#f6f2ea', 4, 3);
      for (let i = 0; i < 3; i++) {
        const [sx, sy] = p.P(h1 - 0.42 + i * 0.12, b1 + 0.12, hz0 + 0.1);
        px(l, sx - 1, sy - 8, ['#e0402a', '#f2c84a', '#7a4a2a'][i], 3, 8);
        px(l, sx - 1, sy - 8, '#ffffff', 1, 3);
      }
      const [cx, cy] = p.P((h0 + h1) / 2, b1 + 0.12, hz0 + 0.1);
      for (let i = -1; i <= 1; i++) {
        fillPoly(l, [[cx + i * 8 - 3, cy - 6], [cx + i * 8 + 3, cy - 6], [cx + i * 8, cy + 1]], '#d8a868');
        ell(l, cx + i * 8, cy - 8, 3.5, 3, ['#f0a6c0', '#b8e2c8', '#f6e0a8'][i + 1]);
      }
    }, { outline: 0.5 });
    // the hatch flap held up as an awning: coral and cream stripes, a row of bulbs
    const awZ = hz1 + 0.6;
    const flap: FaceTex = (u) => (Math.floor(u / 9) % 2 ? '#fbf6ee' : '#f0743c');
    solidFaces(p, [[[h0 - 0.12, b1, awZ + 2.4], [h1 + 0.12, b1, awZ + 2.4], [h1 + 0.12, b1 + 0.28, awZ + 0.4], [h0 - 0.12, b1 + 0.28, awZ + 0.4]]], () => flap, true);
    layer(c, (l) => {
      for (let u = h0 - 0.12; u < h1 + 0.1; u += 0.14) {
        const [x, y] = p.P(u, b1 + 0.28, awZ + 0.4);
        fillPoly(l, [[x, y], [x + 9, y + 4], [x + 4, y + 7]], Math.floor((u - h0) / 0.14) % 2 ? '#fbf6ee' : '#f0743c');
      }
    }, { outline: 0.4 });
    for (let i = 0; i < 10; i++) {
      const u = h0 + (i / 9) * (h1 - h0);
      const [bx, by] = p.P(u, b1 + 0.26, awZ - 0.6 - Math.sin((i / 9) * Math.PI) * 0.8);
      px(c, bx - 1, by, '#ffe8a0', 2, 2);
    }
    for (const a of wa) wheel(p, a, b1, R, ALU[5], '#1a1418');
    // the nose (or the tail): lamps, grille, bumper, plate
    const ae = visEnd(p, a0, a1);
    const S = side(p, ae);
    if (ae === a1) {
      for (const b of [b0 + 0.2, b1 - 0.2]) {
        const [hx, hy] = S.F(b, zl + 3.6);
        ell(c, hx, hy, 6, 6, ALU[4]);
        ell(c, hx, hy, 4.4, 4.4, '#fff6d0');
        px(c, hx - 2, hy - 3, '#ffffff', 2, 2);
      }
      pq(p, S, b0 + 0.4, b1 - 0.4, zl + 1.6, zl + 5.4, ALU[3]);
      for (let z = zl + 2; z < zl + 5.2; z += 0.8) pq(p, S, b0 + 0.42, b1 - 0.42, z, z + 0.35, GEAR[2]);
      lbox(p, a1, b0 + 0.04, 0.08, b1 - b0 - 0.08, zl - 1.2, 1.8, box3(ALU));
      plate(p, side(p, a1 + 0.08), (b0 + b1) / 2, zl - 0.9);
    } else {
      pq(p, S, b0 + 0.2, b1 - 0.2, zl + 1, zt - 2, MINT[2]);
      pq(p, S, (b0 + b1) / 2 - 0.01, (b0 + b1) / 2 + 0.01, zl + 1, zt - 2, MINT[0]);
      for (const b of [b0 + 0.06, b1 - 0.14]) pq(p, S, b, b + 0.08, zl + 2, zl + 5, '#d8302a');
      lbox(p, a0 - 0.08, b0 + 0.04, 0.08, b1 - b0 - 0.08, zl - 1.2, 1.8, box3(ALU));
      plate(p, side(p, a0 - 0.08), (b0 + b1) / 2, zl - 0.9);
    }
    // the roof sign: a giant cone of gelato on a post, a roof vent
    lbox(p, a0 + 0.3, (b0 + b1) / 2 - 0.15, 0.3, 0.3, zt, 1.2, box3(ALU));
    const [rx, ry] = p.P((a0 + ac) / 2 + 0.2, (b0 + b1) / 2, zt);
    layer(c, (l) => {
      px(l, rx - 1, ry - 8, GEAR[3], 3, 8);
      fillPoly(l, [[rx - 11, ry - 24], [rx + 11, ry - 24], [rx, ry - 4]], '#d8a868');
      for (let i = -9; i < 10; i += 4) ln(l, rx + i, ry - 24, rx + i * 0.3, ry - 8, '#b88848');
      ell(l, rx - 5, ry - 29, 8, 7, '#f0a6c0');
      ell(l, rx + 5, ry - 29, 8, 7, '#b8e2c8');
      ell(l, rx, ry - 37, 8, 7, '#f6e0a8');
      px(l, rx - 3, ry - 41, '#ffffff', 3, 2);
      ell(l, rx + 1, ry - 45, 3.5, 3.5, '#d8302a');
    }, { outline: 0.6 });
  },
};

// ── bikes ───────────────────────────────────────────────────
/**
 * A beach cruiser in a vertical plane: along b (dir 'b', parked across a rack that runs along a)
 * or along a (dir 'a'). (a, b) is the front wheel's ground point; s scales it.
 */
function bike(p: PropPainter, a: number, b: number, z0: number, col: string, dir: 'a' | 'b', s: number, seed: number) {
  const Rn = rng(seed * 7 + Math.round(a * 31) + Math.round(b * 17));
  const wb = 0.58 * s;
  const r = 0.17 * s;
  const rz = r * 16;
  const P = (t: number, z: number): V2 => (dir === 'b' ? p.P(a, b + t, z0 + z) : p.P(a + t, b, z0 + z));
  const across = (t: number, z: number, d: number): V2 => (dir === 'b' ? p.P(a + d, b + t, z0 + z) : p.P(a + t, b + d, z0 + z));
  const frame = col;
  const hi = lighten(col, 0.35);
  layer(p.c, (l) => {
    const [gx, gy] = P(wb / 2, 0);
    contactShadow(l, gx + 4, gy + 1, 22 * s, 4, 0.35);
    // the wheels: tyre, rim, spokes, hub, a fender over each
    for (const t0 of [0, wb]) {
      const pts: V2[] = [];
      for (let i = 0; i <= 24; i++) {
        const th = (i / 24) * Math.PI * 2;
        pts.push(P(t0 + Math.cos(th) * r, rz + Math.sin(th) * rz));
      }
      for (let i = 0; i < 24; i++) ln(l, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#1e1c22', 2);
      for (let i = 0; i < 24; i += 2) {
        const th = (i / 24) * Math.PI * 2;
        const q = P(t0 + Math.cos(th) * r * 0.86, rz + Math.sin(th) * rz * 0.86);
        px(l, q[0], q[1], '#c8ccd2');
      }
      const hub = P(t0, rz);
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2 + 0.2;
        const q = P(t0 + Math.cos(th) * r * 0.82, rz + Math.sin(th) * rz * 0.82);
        ln(l, hub[0], hub[1], q[0], q[1], '#9ca2aa');
      }
      px(l, hub[0] - 1, hub[1] - 1, '#e0e4e8', 3, 3);
      for (let i = 2; i <= 10; i++) {
        const th = (i / 24) * Math.PI * 2;
        const q0 = P(t0 + Math.cos(th) * r * 1.12, rz + Math.sin(th) * rz * 1.12);
        const th1 = ((i + 1) / 24) * Math.PI * 2;
        const q1 = P(t0 + Math.cos(th1) * r * 1.12, rz + Math.sin(th1) * rz * 1.12);
        ln(l, q0[0], q0[1], q1[0], q1[1], hi, 2);
      }
    }
    // the frame: a curved step-through down tube, seat tube, stays, the fork, a chainring
    const BB: [number, number] = [wb * 0.6, rz - 0.4];
    const ST: [number, number] = [wb * 0.7, rz + 5.6 * s];
    const HT: [number, number] = [wb * 0.14, rz + 6.4 * s];
    const HB: [number, number] = [wb * 0.1, rz + 4 * s];
    const seg = (q0: [number, number], q1: [number, number], w = 2, cc = frame) => {
      const A = P(q0[0], q0[1]);
      const B = P(q1[0], q1[1]);
      ln(l, A[0], A[1], B[0], B[1], cc, w);
    };
    let prev = P(HB[0], HB[1]);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const q = P(HB[0] + (BB[0] - HB[0]) * t, HB[1] + (BB[1] - HB[1]) * t - Math.sin(t * Math.PI) * 1.6 * s);
      ln(l, prev[0], prev[1], q[0], q[1], frame, 3);
      prev = q;
    }
    seg(BB, ST, 2);
    seg(BB, [wb, rz], 2);
    seg([ST[0] - 0.01, ST[1] - 1], [wb, rz], 2);
    seg(HB, HT, 3);
    seg(HB, [0, rz], 2, darken(frame, 0.2));
    const cr = P(BB[0], BB[1]);
    ell(l, cr[0], cr[1], 3, 3, '#8a8e96');
    seg([BB[0] - 0.05, BB[1] - 1.2], [BB[0] + 0.05, BB[1] + 1.2], 1, '#2a2a30');
    // the saddle, the swept-back bars across the bike, a basket in front
    const sd = P(ST[0] + 0.02, ST[1] + 0.6);
    px(l, sd[0] - 5, sd[1] - 2, '#4a2e22', 10, 3);
    px(l, sd[0] - 5, sd[1] - 2, '#7a5040', 10, 1);
    const st = P(HT[0] + 0.02, HT[1] + 1.4);
    const ht = P(HT[0], HT[1]);
    ln(l, ht[0], ht[1], st[0], st[1], '#c8ccd2', 2);
    const g0 = across(HT[0] + 0.06, HT[1] + 1.6, -0.12 * s);
    const g1 = across(HT[0] + 0.06, HT[1] + 1.6, 0.12 * s);
    ln(l, g0[0], g0[1], st[0], st[1], '#c8ccd2', 2);
    ln(l, st[0], st[1], g1[0], g1[1], '#c8ccd2', 2);
    px(l, g0[0] - 1, g0[1] - 1, '#2a2a30', 3, 3);
    px(l, g1[0] - 1, g1[1] - 1, '#2a2a30', 3, 3);
    if (Rn() < 0.7) {
      const q = [P(-0.06 * s, rz + 4.2 * s), P(0.08 * s, rz + 4.2 * s), P(0.08 * s, rz + 6.4 * s), P(-0.06 * s, rz + 6.4 * s)];
      fillPoly(l, q, '#c8a060');
      for (let i = 0; i < 4; i++) {
        const A = P(-0.06 * s + i * 0.045 * s, rz + 4.2 * s);
        const B = P(-0.06 * s + i * 0.045 * s, rz + 6.4 * s);
        ln(l, A[0], A[1], B[0], B[1], '#9a7840');
      }
      if (Rn() < 0.5) {
        const [fx, fy] = P(0.01, rz + 6.8 * s);
        foliage(l, [{ x: fx, y: fy - 2, rx: 5, ry: 3, z: 1 }], LEAF, seed + 3, { cell: 2, dots: ['#f06aa0', '#f2c84a'], dotChance: 0.8, dotSize: 3 });
      }
    }
  }, { outline: 0.55 });
}

const BIKECOL = ['#7ac7bb', '#f0a6c0', '#f2c84a', '#9ad0e8', '#e06a4a', '#f6eedc', '#e0402a', '#2a8ab8', '#a68ad8'];
const NAVY: Ramp = ['#0e1424', '#162036', '#1e2c4a', '#2a3c60', '#3c5280', '#5a72a0'];
const bikes: PropArt = {
  draw(p, k) {
    const W = k.w;
    const full = k.variant === 'rack';
    const Rn = rng(k.seed + 11);
    footShadow(p, 0.05, 0.15, W - 0.05, 0.9, 8, 0.28);
    const step = full ? 0.3 : 0.42;
    const n = Math.max(1, Math.floor((W - 0.2) / step));
    const off = (W - (n - 1) * step) / 2;
    if (full) {
      // the hoops behind the bikes' front wheels, joined by a rail on the ground
      layer(p.c, (l) => {
        const q0 = p.P(0.08, 0.2, 0);
        const q1 = p.P(W - 0.08, 0.2, 0);
        ln(l, q0[0], q0[1], q1[0], q1[1], ALU[2], 2);
        for (let i = 0; i < n; i++) {
          const a = off + i * step + 0.07;
          let prev: V2 | null = null;
          for (let j = 0; j <= 10; j++) {
            const t = (j / 10) * Math.PI;
            const q = p.P(a, 0.2 + Math.cos(t) * 0.12, Math.sin(t) * 6);
            if (prev) ln(l, prev[0], prev[1], q[0], q[1], ALU[4], 2);
            prev = q;
          }
        }
      }, { outline: 0.5 });
    }
    for (let i = 0; i < n; i++) {
      const a = off + i * step;
      bike(p, a, 0.12 + (full ? 0 : Rn() * 0.1), 0, BIKECOL[Math.floor(Rn() * BIKECOL.length)], 'b', 1, k.seed + i);
    }
    if (full) {
      layer(p.c, (l) => {
        const [sx, sy] = p.P(W - 0.06, 0.12, 0);
        px(l, sx - 1, sy - 44, NAVY[2], 3, 44);
        px(l, sx - 11, sy - 58, '#1e8a90', 22, 15);
        px(l, sx - 11, sy - 58, '#46bcba', 22, 1);
        for (let i = 0; i < 3; i++) px(l, sx - 7 + i * 6, sy - 53, '#fbf6ee', 3, 4);
        px(l, sx - 8, sy - 47, '#f2c84a', 16, 2);
      }, { outline: 0.5 });
    }
  },
};

// ── boats ───────────────────────────────────────────────────
const HULLS: Ramp[] = [
  WHITE,
  ['#1e2c4a', '#283a5e', '#344a74', '#425c8a', '#5470a0', '#6c88b6', '#8aa2c8'],
  ['#5a1e18', '#7a2a20', '#9a382a', '#b84a36', '#cc6248', '#de7e62', '#ec9c80'],
  ['#1e4a44', '#28605a', '#347a70', '#469286', '#5eaa9c', '#7cc2b2', '#a0d8c8'],
];
const VARNISH: Ramp = ['#5a3418', '#7a4a22', '#9a5e2c', '#b87638', '#cc8c48', '#dea462', '#ecbc80'];
const teak: Mat = () => (u, v, x, y) => {
  if (v % 5 < 0.9) return '#7a5a3a';
  return hash(Math.floor(u / 16), Math.floor(v / 5), 3) < 0.3 ? '#b07a44' : hash(x, y, 4) < 0.05 ? '#8a5e34' : '#c4925a';
};
const gelcoat: Mat = (light) => (_u, _v, x, y) => (hash(x, y, 5) < 0.04 ? '#e2ddd2' : light ? '#fbf8f2' : '#e8e4da');

interface HullOpts {
  sheer?: number;
  double?: boolean;
  clinker?: boolean;
  stripe?: string | null;
  boot?: string | null;
  open?: boolean;
  draft?: number;
}
/**
 * A hull along a (stern at a0, bow at a1): side panels from the waterline up to a sheer that
 * rises to the bow, a transom (or a second point), the deck; a lit rubbing strake on top.
 */
function hull(p: PropPainter, a0: number, a1: number, bc: number, beam: number, fb: number, col: Ramp, deck: Mat, o: HullOpts = {}) {
  const L = a1 - a0;
  const sheer = o.sheer ?? fb * 0.3;
  const hb = o.double
    ? (t: number) => (beam / 2) * Math.max(0.06, Math.pow(Math.sin(Math.PI * t), 0.6))
    : (t: number) => (beam / 2) * (t < 0.45 ? 0.78 + 0.22 * Math.sin((t / 0.45) * Math.PI * 0.5) : Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2.1)));
  const zt = (t: number) => fb + sheer * (o.double ? 4 * (t - 0.5) ** 2 : t * t);
  const N = 16;
  const Dk: [V3, V3][] = [];
  const Wl: [V3, V3][] = [];
  const dr = o.draft ?? 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const tw = (o.double ? 0.05 : 0.03) + t * (o.double ? 0.9 : 0.9);
    Dk.push([[a0 + t * L, bc + hb(t), zt(t)], [a0 + t * L, bc - hb(t), zt(t)]]);
    Wl.push([[a0 + tw * L, bc + hb(tw) * 0.74, dr], [a0 + tw * L, bc - hb(tw) * 0.74, dr]]);
  }
  const faces: V3[][] = [];
  for (let i = 0; i < N; i++) {
    faces.push([Wl[i][0], Wl[i + 1][0], Dk[i + 1][0], Dk[i][0]]);
    faces.push([Wl[i][1], Wl[i + 1][1], Dk[i + 1][1], Dk[i][1]]);
  }
  if (!o.double) faces.push([Wl[0][1], Wl[0][0], Dk[0][0], Dk[0][1]]);
  const deckPoly: V3[] = [...Dk.map((q) => q[0]), ...Dk.slice().reverse().map((q) => q[1])];
  faces.push(deckPoly);
  solidFaces(p, faces, (s, fi) => {
    if (fi === faces.length - 1) return o.open ? (_l: Light, w: number, h: number) => deck(2, w, h) : deck;
    const base = col[Math.round(Math.min(6, Math.max(0, s + 0.4)))];
    const dark = col[Math.round(Math.min(6, Math.max(0, s - 0.8)))];
    return (_l: Light, _w: number, h: number) => (_u: number, v: number) => {
      const f = v / Math.max(1, h);
      if (o.boot !== null && v < 1.6) return o.boot ?? '#b8302a';
      if (o.stripe && f > 0.6 && f < 0.78) return o.stripe;
      if (o.clinker && (v % 2.6) < 0.7) return dark;
      return base;
    };
  }, false);
  // the rubbing strake: a lit line along the near sheer and a shadow line under it
  for (let i = 0; i < N; i++) {
    const q0 = p.P(...Dk[i][0]);
    const q1 = p.P(...Dk[i + 1][0]);
    ln(p.c, q0[0], q0[1] + 1, q1[0], q1[1] + 1, col[1]);
    ln(p.c, q0[0], q0[1], q1[0], q1[1], lighten(col[6], 0.2));
  }
  return { Dk, hb, zt, L };
}

/** The boat's shadow and reflection on the sea, a ring of foam at the waterline. */
function onSea(p: PropPainter, a0: number, a1: number, bc: number, beam: number, col: string) {
  const c = p.c;
  const pts: V2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(p.P(a0 + t * (a1 - a0), bc + (beam / 2) * 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), 0));
  }
  for (let i = 16; i >= 0; i--) {
    const t = i / 16;
    pts.push(p.P(a0 + t * (a1 - a0), bc - (beam / 2) * 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), 0));
  }
  c.globalAlpha = 0.38;
  fillPoly(c, pts.map(([x, y]) => [x + 10, y + 6] as V2), '#06304e');
  c.globalAlpha = 0.22;
  fillPoly(c, pts.map(([x, y]) => [x, y + 5] as V2), col);
  c.globalAlpha = 0.8;
  for (let i = 0; i < 16; i++) ln(c, pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, '#e8f8fa', 2);
  c.globalAlpha = 1;
}

/** A wake of foam behind the stern (toward a < a0): two diverging lines and churned water. */
function wake(p: PropPainter, a0: number, bc: number) {
  const c = p.c;
  c.globalAlpha = 0.7;
  for (const s of [-1, 1]) {
    let prev = p.P(a0, bc + s * 0.15, 0);
    for (let i = 1; i <= 8; i++) {
      const q = p.P(a0 - i * 0.16, bc + s * (0.15 + i * 0.07), 0);
      ln(c, prev[0], prev[1], q[0], q[1], '#f4fcfc', Math.max(1, 3 - Math.floor(i / 3)));
      prev = q;
    }
  }
  for (let i = 0; i < 14; i++) {
    const [x, y] = p.P(a0 - 0.1 - hash(i, 1, 9) * 1.1, bc + (hash(i, 2, 9) - 0.5) * 0.3, 0);
    px(c, x, y, '#e0f4f6', 3, 1);
  }
  c.globalAlpha = 1;
}

/** Stanchions and a lifeline along both sides of a deck between t0 and t1 (hull fractions). */
function rails(p: PropPainter, h: ReturnType<typeof hull>, t0: number, t1: number, ht: number) {
  layer(p.c, (l) => {
    for (const side of [1, 0]) {
      const tops: V2[] = [];
      for (let i = Math.ceil(t0 * 16); i <= Math.floor(t1 * 16); i += 2) {
        const q = h.Dk[i][side];
        const [x, y] = p.P(q[0], q[1], q[2]);
        const [, yt] = p.P(q[0], q[1], q[2] + ht);
        px(l, x, yt, ALU[4], 1, y - yt);
        tops.push([x, yt]);
      }
      for (let i = 0; i + 1 < tops.length; i++) ln(l, tops[i][0], tops[i][1], tops[i + 1][0], tops[i + 1][1], ALU[5]);
    }
  }, { outline: false });
}

const boat: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'sail';
    const W = k.w;
    const D = k.d;
    const Rn = rng(k.seed * 13 + 7);
    const c = p.c;
    const water = p.x + W / 2 > coastX(p.y + D / 2);
    const bc = D / 2;
    if (v === 'kayaks') {
      // three sit-on-top kayaks side by side on the sand, a paddle across them
      if (!water) footShadow(p, 0.1, 0.05, W - 0.1, D - 0.05, 4, 0.35);
      const cols: Ramp[] = [HULLS[2], YEL, HULLS[3]];
      for (let i = 0; i < 3; i++) {
        const b = 0.2 + i * ((D - 0.4) / 2);
        const kc = cols[(i + k.seed) % 3];
        const h = hull(p, 0.08, W - 0.08, b, 0.27, 1.8, kc, (light) => (u, vv) => at(kc, (light ? 4.4 : 3.6) + (vv % 7 < 1 ? -0.6 : 0) + (u % 40 < 1 ? -0.5 : 0)), { double: true, sheer: 0.8, boot: null });
        void h;
        // the seat well and the foot wells, a carry handle at each end, a bungee X on the bow deck
        for (const [t, rx, ry] of [[0.42, 7, 3], [0.6, 5, 2.4]] as const) {
          const [cx, cy] = p.P(0.08 + t * (W - 0.16), b, 1.6);
          ell(c, cx, cy, rx, ry, darken(kc[2], 0.3));
          ell(c, cx - 1, cy - 1, rx - 2, ry - 1, kc[2]);
        }
        const q0 = p.P(0.08 + 0.74 * (W - 0.16), b - 0.06, 2);
        const q1 = p.P(0.08 + 0.86 * (W - 0.16), b + 0.06, 2);
        const q2 = p.P(0.08 + 0.74 * (W - 0.16), b + 0.06, 2);
        const q3 = p.P(0.08 + 0.86 * (W - 0.16), b - 0.06, 2);
        ln(c, q0[0], q0[1], q1[0], q1[1], '#1e1e24');
        ln(c, q2[0], q2[1], q3[0], q3[1], '#1e1e24');
        for (const a of [0.12, W - 0.12]) {
          const [hx, hy] = p.P(a, b, 2.4);
          px(c, hx - 2, hy - 1, '#1e1e24', 4, 2);
        }
      }
      layer(c, (l) => {
        const q0 = p.P(0.5, D - 0.05, 2.4);
        const q1 = p.P(W - 0.6, 0.05, 2.4);
        ln(l, q0[0], q0[1], q1[0], q1[1], '#2a2a30', 2);
        ell(l, q0[0], q0[1], 6, 2.5, '#f2c84a');
        ell(l, q1[0], q1[1], 6, 2.5, '#f2c84a');
      }, { outline: 0.5 });
      return;
    }
    if (v === 'pedalo') {
      // a pedal boat: twin pointed floats, a moulded seat deck between them, a slide off the stern
      const PED: Ramp[] = [YEL, HULLS[3], ['#1e3c7a', '#2a5298', '#3a6ab6', '#5286cc', '#6d98d1', '#90b6e6', '#bcd6f4']];
      const pc = PED[pmod(k.seed + p.x + p.y * 3, 3)];
      if (water) onSea(p, 0.1, W - 0.1, bc, D * 0.9, '#f6f2ea');
      else footShadow(p, 0.1, 0.05, W - 0.1, D - 0.05, 8, 0.4);
      for (const b of [0.2, D - 0.2]) hull(p, 0.06, W - 0.06, b, 0.3, 2.6, WHITE, gelcoat, { double: true, sheer: 1, stripe: pc[3], boot: water ? undefined : null });
      lbox(p, 0.42, 0.22, W - 0.9, D - 0.44, 2.6, 1.4, box3(pc));
      lbox(p, 0.42, 0.22, 0.2, D - 0.44, 4, 3.8, box3(pc));
      lbox(p, 0.95, 0.22, 0.16, D - 0.44, 4, 2.6, box3(pc));
      const [wx, wy] = p.P(0.75, bc, 4.2);
      ell(c, wx, wy, 6, 3, GEAR[2]);
      layer(c, (l) => {
        let prev: V2 | null = null;
        for (let t = 0; t <= 1.001; t += 0.1) {
          const a = 0.3 + t * (W - 0.42);
          const z = 14 - 11 * Math.sin(t * Math.PI * 0.5);
          const q = p.P(a, bc, z);
          if (prev) {
            ln(l, prev[0], prev[1], q[0], q[1], pc[3], 6);
            ln(l, prev[0], prev[1] - 3, q[0], q[1] - 3, pc[5], 1);
          }
          prev = q;
        }
        for (const db of [-0.08, 0.08]) {
          const [lx, ly] = p.P(0.26, bc + db, 2.6);
          const [, ty] = p.P(0.26, bc + db, 14);
          px(l, lx, ty, ALU[4], 2, ly - ty);
        }
        for (let z = 4; z < 14; z += 2.4) {
          const q0 = p.P(0.26, bc - 0.08, z);
          const q1 = p.P(0.26, bc + 0.08, z);
          ln(l, q0[0], q0[1], q1[0], q1[1], ALU[5]);
        }
      }, { outline: 0.5 });
      return;
    }
    if (v === 'row' || v === 'dinghy') {
      const beam = D * 0.66;
      if (water) onSea(p, 0.15, W - 0.15, bc, beam, '#c8a070');
      else footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 6, 0.4);
      if (v === 'dinghy') {
        // an inflatable tender: grey floor, orange tubes all round, a small outboard
        const floor: Mat = () => (u) => (u % 12 < 1 ? '#5a5e66' : '#7a7e86');
        const h = hull(p, 0.15, W - 0.15, bc, beam, 2.2, ALU, floor, { sheer: 0.8, open: true, boot: null });
        layer(c, (l) => {
          for (const side of [0, 1]) {
            for (let i = 0; i < 16; i++) {
              const q0 = p.P(...h.Dk[i][side]);
              const q1 = p.P(...h.Dk[i + 1][side]);
              ln(l, q0[0], q0[1] - 3, q1[0], q1[1] - 3, '#e0602a', 7);
              ln(l, q0[0], q0[1] - 6, q1[0], q1[1] - 6, '#f6a070', 2);
            }
          }
          const [ox, oy] = p.P(0.12, bc, 3);
          px(l, ox - 4, oy - 12, '#f6f2ea', 8, 10);
          px(l, ox - 4, oy - 12, '#ffffff', 8, 2);
          px(l, ox - 1, oy - 2, GEAR[2], 3, 9);
        }, { outline: 0.5 });
        return;
      }
      // a clinker-built rowing boat: varnished or painted planks, thwarts, oars shipped
      const col = Rn() < 0.4 ? VARNISH : HULLS[1 + Math.floor(Rn() * 3)];
      const inside: Mat = () => (u, vv) => (u % 18 < 2 ? '#7a5a38' : vv % 6 < 1 ? '#8a6a44' : '#b08a5a');
      const h = hull(p, 0.12, W - 0.12, bc, beam, 3.4, col, inside, { sheer: 1.6, clinker: true, open: true, stripe: col === VARNISH ? null : '#f6f2ea', boot: col === VARNISH ? null : undefined });
      for (const t of [0.3, 0.6]) {
        const a = 0.12 + t * (W - 0.24);
        const hw = h.hb(t) * 0.9;
        lbox(p, a - 0.05, bc - hw, 0.1, hw * 2, h.zt(t) - 1.4, 0.6, { front: flatM(PINE), side: flatM(PINE), top: flatM(PINE, 1.2), edge: PINE[0] });
      }
      layer(c, (l) => {
        for (const db of [-0.1, 0.1]) {
          const q0 = p.P(0.22, bc + db, 3.6);
          const q1 = p.P(W - 0.3, bc + db * 0.5, 4);
          ln(l, q0[0], q0[1], q1[0], q1[1], PINE[3], 2);
          ln(l, q0[0], q0[1] - 1, q1[0], q1[1] - 1, PINE[5], 1);
          fillPoly(l, [[q0[0] - 6, q0[1] - 1], [q0[0] + 4, q0[1] - 3], [q0[0] + 6, q0[1] + 1], [q0[0] - 4, q0[1] + 3]], PINE[4]);
        }
        const [rx, ry] = p.P(W - 0.12, bc, h.zt(1) - 0.4);
        ell(l, rx, ry, 2, 2, ALU[3]);
      }, { outline: 0.5 });
      return;
    }
    if (v === 'motor') {
      // a runabout: white hull with red and navy stripes, a cream deck, windscreen, seats, outboard
      const beam = D * 0.56;
      const a0 = 0.25;
      const a1 = W - 0.12;
      if (water) {
        onSea(p, a0, a1, bc, beam, '#f6f2ea');
        wake(p, a0, bc);
      } else footShadow(p, 0.1, 0.2, W - 0.1, D - 0.2, 8, 0.4);
      const stripe = Rn() < 0.6 ? '#d8302a' : '#2a4a8a';
      const h = hull(p, a0, a1, bc, beam, 4.6, WHITE, gelcoat, { sheer: 1.4, stripe });
      const L = h.L;
      // a navy pinstripe over the main stripe
      for (let i = 2; i < 15; i++) {
        const q0 = p.P(h.Dk[i][0][0], h.Dk[i][0][1], h.Dk[i][0][2] - 0.6);
        const q1 = p.P(h.Dk[i + 1][0][0], h.Dk[i + 1][0][1], h.Dk[i + 1][0][2] - 0.6);
        ln(c, q0[0], q0[1], q1[0], q1[1], '#1e2c4a');
      }
      // the cockpit well, the seats, the console with its windscreen
      const ca = a0 + L * 0.48;
      fillPoly(c, [p.P(a0 + 0.12, bc - beam * 0.36, 4.7), p.P(ca + 0.2, bc - beam * 0.38, 4.8), p.P(ca + 0.2, bc + beam * 0.38, 4.8), p.P(a0 + 0.12, bc + beam * 0.36, 4.7)], '#c8bca8');
      lbox(p, a0 + 0.1, bc - beam * 0.34, 0.26, beam * 0.68, 4.6, 2.4, box3(['#1e2c4a', '#283a5e', '#344a74', '#425c8a', '#5470a0', '#6c88b6', '#8aa2c8']));
      lbox(p, a0 + 0.1, bc - beam * 0.34, 0.08, beam * 0.68, 7, 2.6, box3(['#1e2c4a', '#283a5e', '#344a74', '#425c8a', '#5470a0', '#6c88b6', '#8aa2c8']));
      for (const db of [-0.15, 0.15]) lbox(p, ca - 0.3, bc + db - 0.1, 0.22, 0.2, 4.8, 2.6, box3(WHITE));
      lbox(p, ca, bc - beam * 0.3, 0.22, beam * 0.6, 4.8, 3.6, box3(WHITE));
      solidFaces(p, [[[ca + 0.22, bc - beam * 0.34, 8.4], [ca + 0.22, bc + beam * 0.34, 8.4], [ca + 0.38, bc + beam * 0.3, 11], [ca + 0.38, bc - beam * 0.3, 11]]], () => glass('#3a6a80'), true);
      const [dx, dy] = p.P(ca + 0.05, bc + 0.05, 8.5);
      ell(c, dx, dy, 3, 2, GEAR[1]);
      px(c, dx - 1, dy - 2, '#c8ccd2', 2, 1);
      // the bow rail, a cleat, the outboard engine on the transom
      layer(c, (l) => {
        for (const side of [0, 1]) {
          const pts: V2[] = [];
          for (let i = 11; i <= 16; i++) {
            const q = h.Dk[i][side];
            const [x, y] = p.P(q[0], q[1], q[2]);
            const [, yt] = p.P(q[0], q[1], q[2] + 2.4);
            px(l, x, yt, ALU[5], 1, y - yt);
            pts.push([x, yt]);
          }
          for (let i = 0; i + 1 < pts.length; i++) ln(l, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ALU[6]);
        }
      }, { outline: false });
      lbox(p, a0 - 0.2, bc - 0.1, 0.2, 0.2, 4.4, 4.4, { front: flatM(WHITE), side: flatM(WHITE), top: flatM(GEAR, 1), edge: GEAR[0] });
      lbox(p, a0 - 0.14, bc - 0.04, 0.08, 0.08, 0, 4.4, box3(GEAR));
      return;
    }
    // the sloop: white hull, a stripe, a teak deck with a cabin, a cockpit, a mast, sails
    const beam = D * 0.56;
    const a0 = 0.2;
    const a1 = W - 0.15;
    if (water) onSea(p, a0, a1, bc, beam, '#f6f2ea');
    else footShadow(p, 0.1, 0.2, W - 0.1, D - 0.2, 8, 0.4);
    const stripe = ['#2a5ab8', '#e0402a', '#1e8a90', '#1e2a4a'][Math.floor(Rn() * 4)];
    const fb = 4.4;
    const h = hull(p, a0, a1, bc, beam, fb, WHITE, teak, { sheer: 1.6, stripe });
    const L = h.L;
    // the cockpit well with a tiller, the coachroof with portholes and a hatch
    fillPoly(c, [p.P(a0 + 0.08, bc - beam * 0.28, fb + 0.1), p.P(a0 + L * 0.3, bc - beam * 0.3, fb + 0.2), p.P(a0 + L * 0.3, bc + beam * 0.3, fb + 0.2), p.P(a0 + 0.08, bc + beam * 0.28, fb + 0.1)], '#6a4a2c');
    fillPoly(c, [p.P(a0 + 0.12, bc - beam * 0.22, fb + 0.1), p.P(a0 + L * 0.28, bc - beam * 0.24, fb + 0.2), p.P(a0 + L * 0.28, bc + beam * 0.24, fb + 0.2), p.P(a0 + 0.12, bc + beam * 0.22, fb + 0.1)], '#4e3420');
    const tl0 = p.P(a0 + 0.05, bc, fb + 1.4);
    const tl1 = p.P(a0 + L * 0.2, bc + 0.06, fb + 2.6);
    ln(c, tl0[0], tl0[1], tl1[0], tl1[1], VARNISH[4], 2);
    const ca0 = a0 + L * 0.32;
    const ca1 = a0 + L * 0.62;
    lbox(p, ca0, bc - beam * 0.28, ca1 - ca0, beam * 0.56, fb + 0.2, 3.6, { front: gelcoat, side: gelcoat, top: paint(WHITE), edge: WHITE[1] });
    const CF = front(p, bc + beam * 0.28);
    for (let i = 0; i < 3; i++) {
      const [ox, oy] = CF.F(ca0 + 0.12 + i * ((ca1 - ca0 - 0.24) / 2), fb + 2.2);
      ell(c, ox, oy, 3, 2.4, '#5a6a72');
      ell(c, ox, oy, 2, 1.6, '#24343e');
      px(c, ox - 1, oy - 1, '#a8c8d2');
    }
    lbox(p, ca0 + 0.15, bc - 0.12, 0.25, 0.24, fb + 3.8, 0.5, { front: flatM(VARNISH), side: flatM(VARNISH), top: teak, edge: VARNISH[0] });
    rails(p, h, 0.3, 0.92, 2.6);
    const ma = a0 + L * 0.66;
    const mastH = 46 + Rn() * 10;
    const up = k.variant === 'sailUp';
    const sailC = '#fbf8f2';
    const main: V3[] = [[ma - 0.03, bc, fb + 5], [a0 + L * 0.1, bc, fb + 5.6], [ma - 0.03, bc, fb + mastH - 2]];
    if (up) {
      // the mainsail with red bands (the reference's), the white jib
      const sr = ['#e0402a', '#e0402a', '#2a5ab8'][Math.floor(Rn() * 3)];
      const mainC: Mat = (light) => (u, vv) => {
        const band = Math.floor(vv / 13);
        if (band >= 1 && band <= 3 && vv % 13 < 5) return light ? sr : darken(sr, 0.15);
        return (vv + u * 0.2) % 26 < 1 ? '#d8d2c6' : light ? sailC : darken(sailC, 0.1);
      };
      const jibC: Mat = (light) => (u, vv) => ((vv + u * 0.2) % 26 < 1 ? '#d8d2c6' : light ? sailC : darken(sailC, 0.12));
      const jib: V3[] = [[ma + 0.05, bc, fb + 4], [a0 + L * 0.98, bc, h.zt(1) + 0.6], [ma + 0.05, bc, fb + mastH - 6]];
      layer(c, (l) => {
        const q = Object.create(p, { c: { value: l } }) as PropPainter;
        solidFaces(q, [jib], () => jibC);
        solidFaces(q, [main], () => mainC);
      }, { outline: 0.5 });
    }
    layer(c, (l) => {
      const [mx, my] = p.P(ma, bc, fb);
      px(l, mx - 1, my - mastH * 4, ALU[4], 3, mastH * 4);
      px(l, mx - 1, my - mastH * 4, ALU[6], 1, mastH * 4);
      const top: V2 = [mx, my - mastH * 4];
      const bow = p.P(a1 - 0.02, bc, h.zt(1));
      const stern = p.P(a0 + 0.02, bc, fb);
      ln(l, top[0], top[1], bow[0], bow[1], '#5a5e66');
      ln(l, top[0], top[1], stern[0], stern[1], '#5a5e66');
      for (const s of [-1, 1]) {
        const ch = p.P(ma - 0.05, bc + s * h.hb(0.66) * 0.95, h.zt(0.66));
        ln(l, top[0], top[1] + 8, ch[0], ch[1], '#7a7e86');
      }
      const [bmx, bmy] = p.P(a0 + L * 0.1, bc, fb + 5.6);
      const [gmx, gmy] = p.P(ma, bc, fb + 5);
      ln(l, gmx, gmy, bmx, bmy, ALU[3], 3);
      if (!up) {
        ln(l, gmx - 1, gmy - 4, bmx + 2, bmy - 4, '#2a4a7a', 6);
        ln(l, gmx - 1, gmy - 7, bmx + 2, bmy - 7, '#3a6aa8', 1);
      }
      const [fx, fy] = p.P(a0 + 0.02, bc, fb + 2);
      px(l, fx, fy - 14, GEAR[3], 1, 14);
      fillPoly(l, [[fx + 1, fy - 14], [fx + 10, fy - 12], [fx + 1, fy - 9]], '#2a5ab8');
    }, { outline: 0.5 });
  },
  anim(p, k) {
    const W = k.w;
    const D = k.d;
    if (!(p.x + W / 2 > coastX(p.y + D / 2))) return;
    const u = p.k / 4;
    const [x, y] = p.P(W / 2, D / 2, 0);
    const t = (k.t * 0.35 + k.seed * 0.21) % 1;
    p.c.globalAlpha = 0.45 * (1 - t);
    for (let a = 0; a < 28; a++) {
      const ang = (a / 28) * Math.PI * 2;
      px(p.c, x + Math.cos(ang) * (W * 36 + t * 18) * u, y + Math.sin(ang) * (D * 16 + t * 8) * u, '#e8f8fa', Math.max(1, 2 * u), Math.max(1, u));
    }
    p.c.globalAlpha = 1;
  },
};

export const STUDIO_VEHICLES: Record<string, PropArt> = { std_camper: camper, std_foodTruck: foodTruck, std_bikes: bikes, std_boat: boat };

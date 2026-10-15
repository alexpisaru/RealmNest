// Chemical Lab — the vehicles, modelled as solids at true scale (≈ 2 m a tile, 19.6 z to a
// tile of length, so wheels and drums come out round): wheels are projected discs on the
// visible side with tyre, rim, spokes and hub, set in dark arches, with contact shadows.
//   car3      a parked car along local b: 'hatch' or 'estate' (a tall SUV with roof rails)
//   van3      the supplier's box van along local b, cab at the low-b end
//   bike3     a bicycle along local b (for the racks and the bike-share dock)
//   lab_shuttle   the driverless campus pod, along local a, alike at both ends (it moves)
//   lab_car       placed cars: 'hatch' | 'estate' | 'van'
import { darken, lighten } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, fillPoly, hash, ln, px, type Ramp } from '../../kit4';
import { front, poly3, pq, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { coat, planeText, rampAround, TEAL } from './lk';

/** z units per tile of horizontal length: a vertical circle drawn with it looks round. */
export const ZT = 19.6;
type V2 = [number, number];
type V3 = [number, number, number];

const fl = (c: string): FaceTex => () => c;
const PLASTIC: Ramp = ['#141518', '#1c1e22', '#26282e', '#30333a', '#3c4048', '#4a4e56'];
const plastic = coat(PLASTIC);

/** Points round a vertical disc: axis 'b' → the disc lies in the b–z plane at a (a vehicle along b). */
function disc(p: PropPainter, axis: 'a' | 'b', a: number, b: number, zc: number, rz: number, s = 1, t0 = 0, t1 = Math.PI * 2, n = 28): V2[] {
  const rb = (rz * s) / ZT;
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const h = rb * Math.cos(t);
    const z = zc + rz * s * Math.sin(t);
    out.push(axis === 'b' ? p.P(a, b + h, z) : p.P(a + h, b, z));
  }
  return out;
}
const discPt = (p: PropPainter, axis: 'a' | 'b', a: number, b: number, zc: number, r: number, t: number): V2 =>
  axis === 'b' ? p.P(a, b + (r / ZT) * Math.cos(t), zc + r * Math.sin(t)) : p.P(a + (r / ZT) * Math.cos(t), b, zc + r * Math.sin(t));

/**
 * A wheel standing on the ground: the tread (a second disc set `inward` towards the body),
 * the tyre with a lit upper sidewall, the rim with five spokes, the hub and a glint.
 * `inward` is a signed offset across the wheel (along a for axis 'b', along b for axis 'a').
 */
export function wheel(p: PropPainter, axis: 'a' | 'b', a: number, b: number, rz: number, inward: number, rim = '#c4cad0') {
  const c = p.c;
  const ia = axis === 'b' ? a + inward : a;
  const ib = axis === 'b' ? b : b + inward;
  fillPoly(c, disc(p, axis, ia, ib, rz, rz), '#0c0d10');
  fillPoly(c, disc(p, axis, a, b, rz, rz), '#17181c');
  fillPoly(c, disc(p, axis, a, b, rz + rz * 0.06, rz, 0.86), '#24262b');
  fillPoly(c, disc(p, axis, a, b, rz, rz, 0.8), '#1a1b1f');
  fillPoly(c, disc(p, axis, a, b, rz, rz, 0.6), darken(rim, 0.42));
  fillPoly(c, disc(p, axis, a, b, rz + rz * 0.04, rz, 0.52), rim);
  for (let i = 0; i < 5; i++) {
    const t = 0.4 + (i * Math.PI * 2) / 5;
    const [x0, y0] = discPt(p, axis, a, b, rz, rz * 0.16, t);
    const [x1, y1] = discPt(p, axis, a, b, rz, rz * 0.5, t);
    ln(c, x0, y0, x1, y1, darken(rim, 0.3));
  }
  fillPoly(c, disc(p, axis, a, b, rz, rz, 0.17, 0, Math.PI * 2, 12), '#3a3e44');
  const [gx, gy] = discPt(p, axis, a, b, rz, rz * 0.36, 1.2);
  px(c, gx - 1, gy - 1, lighten(rim, 0.5), 2, 1);
  // the tyre's lit shoulder on the upper rim
  for (let t = 0.9; t < 2.3; t += 0.12) {
    const [x, y] = discPt(p, axis, a, b, rz, rz * 0.94, t);
    px(c, x, y, '#3a3c42');
  }
}

/** The wheel arch: a dark half disc above the axle running down to the body's bottom edge zBot. */
export function arch(p: PropPainter, axis: 'a' | 'b', a: number, b: number, rz: number, s: number, zBot: number, col = '#0e0f12') {
  const pts = disc(p, axis, a, b, rz, rz, s, 0, Math.PI, 16);
  const rb = (rz * s) / ZT;
  if (axis === 'b') pts.push(p.P(a, b - rb, zBot), p.P(a, b + rb, zBot));
  else pts.push(p.P(a - rb, b, zBot), p.P(a + rb, b, zBot));
  fillPoly(p.c, pts, col);
}

/** A painted body: lit top, mid front, dark side, a lit shoulder near the top, a dark foot. */
const paint = (body: Ramp, seed: number): Mat => (light, _w, h) => (_u, v, x, y) => {
  let i = light === 2 ? 4.3 : light === 1 ? 3.1 : 1.9;
  if (light !== 2 && v > h - 1.6) i += 1.2;
  else if (light !== 2 && v > h - 3.6) i += 0.4;
  if (light !== 2 && v < 2.4) i -= 0.9;
  if (hash(x, y, seed) < 0.006) i += 1;
  return at(body, i);
};

/** Glass with a light tint, a sky band along the top and a diagonal reflection. */
const glassTex = (light: number): FaceTex => (u, v) => {
  const d = (u * 0.7 + v) % 34;
  if (d < 3) return '#c8e2ea';
  if (d < 5) return '#8ab4c4';
  return light === 2 ? '#4a7486' : light === 1 ? '#3a5e70' : '#2c4a5a';
};

/** Bilinear point inside a quad given as four corners (00, 10, 11, 01). */
const quadPt = (q: V3[], u: number, v: number): V3 => {
  const l = (A: V3, B: V3, t: number): V3 => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  return l(l(q[0], q[1], u), l(q[3], q[2], u), v);
};

// ── cars ────────────────────────────────────────────────────
/**
 * A car along local b: (a0, b0) its corner, wid × len tiles, the front at the high-b end if
 * fwd, else at the low-b end. 'hatch' (1.4 m) or 'estate' (a 1.55 m SUV with roof rails).
 */
export function car3(p: PropPainter, a0: number, b0: number, wid: number, len: number, col: string, fwd: boolean, kind = 'hatch', seed = 0) {
  const c = p.c;
  const body = rampAround(col);
  const rot0 = p.rot === 0;
  const aN = rot0 ? a0 + wid : a0; // the visible long side
  const aF = rot0 ? a0 : a0 + wid;
  const out = rot0 ? 1 : -1;
  const suv = kind === 'estate';
  const H0 = 1.9;
  const H1 = suv ? 8.0 : 7.4; // beltline
  const H2 = suv ? 15.2 : 13.9; // roof
  const rz = suv ? 3.3 : 3.0;
  const bF = fwd ? b0 + len : b0;
  const bR = fwd ? b0 : b0 + len;
  const dir = fwd ? -1 : 1; // from the front towards the rear
  const axles = [bF + dir * 0.5, bR - dir * 0.48];
  const shell = paint(body, 97 + seed);
  const edge = darken(col, 0.62);
  // contact shadows under the four wheels, then the far wheels peeking under the sills
  for (const bb of axles)
    for (const aa of [a0 + 0.14, a0 + wid - 0.14]) {
      const [x, y] = p.P(aa, bb, 0);
      contactShadow(c, x, y + 1, 12, 4, 0.5);
    }
  for (const bb of axles) wheel(p, 'b', aF + out * 0.1, bb, rz, out * 0.1);
  // bumpers and the lower body
  lbox(p, a0 + 0.03, b0, wid - 0.06, 0.12, 1.5, 2.8, mono(plastic, '#0c0d10'));
  lbox(p, a0, b0 + 0.08, wid, len - 0.16, H0, H1 - H0, { front: shell, side: shell, top: shell, edge });
  lbox(p, a0 + 0.03, b0 + len - 0.12, wid - 0.06, 0.12, 1.5, 2.8, mono(plastic, '#0c0d10'));
  const SN = side(p, aN);
  // the sill in black, a lit character line, the arches and the near wheels
  pq(p, SN, b0 + 0.12, b0 + len - 0.12, H0, H0 + 0.9, suv ? '#1c1d20' : darken(col, 0.5));
  pq(p, SN, b0 + 0.14, b0 + len - 0.14, H1 - 2.2, H1 - 1.9, at(body, 4.6));
  for (const bb of axles) {
    arch(p, 'b', aN, bb, rz, 1.32, H0 - 0.4, suv ? '#121316' : '#0e0f12');
    wheel(p, 'b', aN - out * 0.02, bb, rz, -out * 0.12);
  }
  // the glasshouse: a frustum with tumblehome, faces drawn back to front
  const wsF = bF + dir * (suv ? 0.6 : 0.68);
  const wsT = bF + dir * (suv ? 0.98 : 1.1);
  const rwT = bR - dir * (suv ? 0.14 : 0.4);
  const rwF = bR - dir * (suv ? 0.05 : 0.14);
  const lo0 = Math.min(wsF, rwF);
  const hi0 = Math.max(wsF, rwF);
  const lo1 = Math.min(wsT, rwT);
  const hi1 = Math.max(wsT, rwT);
  const ins = 0.08;
  const aL0 = a0 + 0.04;
  const aR0 = a0 + wid - 0.04;
  const aL1 = aL0 + ins;
  const aR1 = aR0 - ins;
  const aN0 = rot0 ? aR0 : aL0;
  const aN1 = rot0 ? aR1 : aL1;
  const aF0 = rot0 ? aL0 : aR0;
  const aF1 = rot0 ? aL1 : aR1;
  const frame = at(body, 3);
  const frameS = at(body, SN.light ? 3.2 : 2.2);
  poly3(p, [[aL0, lo0, H1], [aR0, lo0, H1], [aR1, lo1, H2], [aL1, lo1, H2]], fl('#2c4a5a'), 2);
  poly3(p, [[aF0, lo0, H1], [aF0, hi0, H1], [aF1, hi1, H2], [aF1, lo1, H2]], fl(frame), 2);
  const sideQ: V3[] = [[aN0, lo0, H1], [aN0, hi0, H1], [aN1, hi1, H2], [aN1, lo1, H2]];
  poly3(p, sideQ, fl(frameS), SN.light);
  // the side glass in two panes split by the B pillar, a black rubber edge round them
  const gq = (u0: number, u1: number, v0: number, v1: number): V3[] => [quadPt(sideQ, u0, v0), quadPt(sideQ, u1, v0), quadPt(sideQ, u1, v1), quadPt(sideQ, u0, v1)];
  const fA = fwd ? 1 : 0; // the u of the front end on the side quad (u runs low b → high b)
  const uF = (q: number) => (fA ? 1 - q : q);
  const panes: [number, number][] = suv ? [[0.08, 0.47], [0.53, 0.9]] : [[0.1, 0.48], [0.54, 0.86]];
  for (const [q0, q1] of panes) {
    const u0 = Math.min(uF(q0), uF(q1));
    const u1 = Math.max(uF(q0), uF(q1));
    poly3(p, gq(u0 - 0.012, u1 + 0.012, 0.08, 0.9), fl('#16181c'), SN.light);
    poly3(p, gq(u0, u1, 0.12, 0.86), glassTex(SN.light), SN.light);
  }
  if (suv) {
    // a small quarter light behind the rear door
    const u0 = Math.min(uF(0.92), uF(0.98));
    poly3(p, gq(u0, u0 + 0.05, 0.16, 0.8), glassTex(SN.light), SN.light);
  }
  // the rear (or front) slope facing us, framed in body colour, its glass inset
  const endQ: V3[] = [[aL0, hi0, H1], [aR0, hi0, H1], [aR1, hi1, H2], [aL1, hi1, H2]];
  poly3(p, endQ, fl(at(body, 3.6)), 2);
  const eq: V3[] = [quadPt(endQ, 0.08, 0.1), quadPt(endQ, 0.92, 0.1), quadPt(endQ, 0.92, 0.88), quadPt(endQ, 0.08, 0.88)];
  poly3(p, eq, glassTex(2), 2);
  if (!fwd) {
    // the third brake light and the rear wiper on the back screen
    const [x0, y0] = p.P(...quadPt(endQ, 0.4, 0.92));
    const [x1, y1] = p.P(...quadPt(endQ, 0.6, 0.92));
    ln(c, x0, y0, x1, y1, '#d83a30', 1);
    const [w0x, w0y] = p.P(...quadPt(endQ, 0.5, 0.14));
    const [w1x, w1y] = p.P(...quadPt(endQ, 0.24, 0.5));
    ln(c, w0x, w0y, w1x, w1y, '#1a1c20', 1);
  }
  // the roof with a sky sheen, roof rails or a shark-fin aerial
  const roofQ: V3[] = [[aL1, lo1, H2], [aR1, lo1, H2], [aR1, hi1, H2], [aL1, hi1, H2]];
  poly3(p, roofQ, (u: number, v: number) => (Math.abs(u * 0.45 - v + 4) < 1.6 ? at(body, 5.6) : at(body, 4.4)), 2);
  if (suv) {
    for (const ra of [aL1 + 0.05, aR1 - 0.09]) lbox(p, ra, lo1 + 0.08, 0.04, hi1 - lo1 - 0.16, H2, 0.7, mono(coat(['#3a3e44', '#4a4e56', '#5a606a', '#8a9098', '#b4bac2', '#d4d8de']), '#202226'));
  } else {
    const [fx, fy] = p.P((aL1 + aR1) / 2, bR - dir * 0.5, H2);
    px(c, fx - 2, fy - 2, '#1e2024', 4, 2);
    px(c, fx - 1, fy - 3, '#1e2024', 2, 1);
    px(c, fx - 2, fy - 2, at(body, 5), 1, 1);
  }
  // the side mirror on the door's front corner: a black arm, a body-coloured cap
  lbox(p, rot0 ? aN0 - 0.02 : aN0 - 0.06, wsF + dir * 0.08 - 0.04, 0.08, 0.08, H1 + 0.2, 1.4, { front: plastic, side: plastic, top: shell, edge: '#0c0d10' });
  // door seams, handles and the fuel flap on the near side
  const bMid = (lo0 + hi0) / 2;
  const dF = wsF + dir * 0.04;
  const dR = rwF - dir * (suv ? 0.28 : 0.3);
  for (const bb of [dF, bMid, dR]) pq(p, SN, bb - 0.007, bb + 0.007, H0 + 0.9, H1 - 0.1, darken(col, 0.42));
  for (const bb of [bMid - dir * 0.24, dR - dir * 0.24]) {
    pq(p, SN, bb - 0.05, bb + 0.05, H1 - 1.3, H1 - 0.9, darken(col, 0.45));
    pq(p, SN, bb - 0.05, bb + 0.05, H1 - 0.9, H1 - 0.8, lighten(col, 0.3));
  }
  pq(p, SN, bR - dir * 0.42 - 0.05, bR - dir * 0.42 + 0.05, H1 - 2.0, H1 - 1.2, darken(col, 0.25));
  // the end facing us: lights wrapping round the corner, the plate, the bumper's lip
  const E = front(p, b0 + len);
  const lz0 = H1 - 2.4;
  const lz1 = H1 - 0.8;
  if (fwd) {
    pq(p, E, a0 + 0.07, a0 + 0.3, lz0, lz1, '#f6f2d8');
    pq(p, E, a0 + wid - 0.3, a0 + wid - 0.07, lz0, lz1, '#f6f2d8');
    pq(p, E, a0 + 0.1, a0 + 0.18, lz0 + 0.4, lz1 - 0.4, '#ffffff');
    pq(p, E, a0 + wid - 0.18, a0 + wid - 0.1, lz0 + 0.4, lz1 - 0.4, '#ffffff');
    pq(p, E, a0 + 0.34, a0 + wid - 0.34, 2.6, lz1 - 0.6, '#1c1e22');
    for (let q = 0; q < 3; q++) pq(p, E, a0 + 0.37, a0 + wid - 0.37, 3.0 + q * 0.9, 3.3 + q * 0.9, '#3a3e44');
    pq(p, SN, b0 + len - 0.16, b0 + len - 0.06, lz0 + 0.2, lz1, '#f0a838');
  } else {
    pq(p, E, a0 + 0.05, a0 + 0.32, lz0, lz1, '#a8222a');
    pq(p, E, a0 + wid - 0.32, a0 + wid - 0.05, lz0, lz1, '#a8222a');
    pq(p, E, a0 + 0.08, a0 + 0.28, lz0 + 0.5, lz1 - 0.3, '#f05a48');
    pq(p, E, a0 + wid - 0.28, a0 + wid - 0.08, lz0 + 0.5, lz1 - 0.3, '#f05a48');
    pq(p, E, a0 + 0.3, a0 + wid - 0.3, lz1 - 0.5, lz1 - 0.2, at(body, 2));
    pq(p, SN, b0 + len - 0.18, b0 + len - 0.06, lz0, lz1, '#c8303a');
  }
  pq(p, E, a0 + wid / 2 - 0.2, a0 + wid / 2 + 0.2, 2.1, 3.5, '#f4f2e8');
  pq(p, E, a0 + wid / 2 - 0.2, a0 + wid / 2 - 0.15, 2.1, 3.5, '#2a5aa8');
  for (let q = 0; q < 4; q++) pq(p, E, a0 + wid / 2 - 0.12 + q * 0.07, a0 + wid / 2 - 0.09 + q * 0.07, 2.5, 3.1, '#3a3c42');
  pq(p, E, a0 + 0.06, a0 + wid - 0.06, 4.0, 4.3, '#3a3e46');
  // a badge in the middle of the end
  const [bx, by] = E.F(a0 + wid / 2, H1 - 1.2);
  px(c, bx - 1, by - 1, '#d8dce0', 3, 2);
}

/**
 * The supplier's box van along local b, cab at the low-b end (the rear doors face us):
 * a cab with its bonnet and a sloping windscreen, a tall box behind it on the chassis,
 * twin rear doors with lock bars, the supplier's livery.
 */
export function van3(p: PropPainter, a0: number, b0: number, wid: number, len: number, col: string) {
  const c = p.c;
  const body = rampAround(col);
  const rot0 = p.rot === 0;
  const aN = rot0 ? a0 + wid : a0;
  const aF = rot0 ? a0 : a0 + wid;
  const out = rot0 ? 1 : -1;
  const rz = 3.4;
  const H0 = 2.2;
  const bonZ = 9.6; // the bonnet's top
  const cabZ = 20.6; // the cab roof
  const boxZ0 = 3.8;
  const boxZ1 = 25;
  const bnE = b0 + 0.44; // windscreen foot
  const wsT = b0 + 0.74; // windscreen top
  const cabE = b0 + 1.1; // the cab's back
  const bEnd = b0 + len - 0.1;
  const axles = [b0 + 0.58, b0 + len - 0.66];
  const shell = paint(body, 98);
  const edge = darken(col, 0.6);
  for (const bb of axles)
    for (const aa of [a0 + 0.14, a0 + wid - 0.14]) {
      const [x, y] = p.P(aa, bb, 0);
      contactShadow(c, x, y + 1, 13, 4, 0.55);
    }
  for (const bb of axles) wheel(p, 'b', aF + out * 0.1, bb, rz, out * 0.12);
  // the chassis under the box, the front bumper, the cab's lower body with the bonnet
  lbox(p, a0 + 0.14, cabE - 0.1, wid - 0.28, bEnd - cabE + 0.1, H0, boxZ0 - H0, mono(plastic, '#0c0d10'));
  lbox(p, a0 + 0.03, b0, wid - 0.06, 0.12, 1.5, 3.2, mono(plastic, '#0c0d10'));
  lbox(p, a0, b0 + 0.08, wid, cabE - b0 - 0.08, H0, bonZ - H0, { front: shell, side: shell, top: shell, edge });
  // the cab's upper half: the windscreen (back-facing, drawn first), the far side, the near side, the roof
  const ins = 0.04;
  const aL = a0 + ins;
  const aR = a0 + wid - ins;
  const aNc = rot0 ? aR : aL;
  const aFc = rot0 ? aL : aR;
  poly3(p, [[aL, bnE, bonZ], [aR, bnE, bonZ], [aR, wsT, cabZ], [aL, wsT, cabZ]], fl('#2c4a5a'), 2);
  poly3(p, [[aFc, bnE, bonZ], [aFc, cabE, bonZ], [aFc, cabE, cabZ], [aFc, wsT, cabZ]], fl(at(body, 2)), 2);
  const SN = side(p, aN);
  const cabQ: V3[] = [[aNc, bnE, bonZ], [aNc, cabE, bonZ], [aNc, cabE, cabZ], [aNc, wsT, cabZ]];
  poly3(p, cabQ, (_u: number, v: number) => at(body, (SN.light ? 3.1 : 1.9) + (v > 38 ? 1 : 0)), SN.light);
  poly3(p, [[aL, wsT, cabZ], [aR, wsT, cabZ], [aR, cabE, cabZ], [aL, cabE, cabZ]], fl(at(body, 4.4)), 2);
  // the cab's side window (the A pillar follows the windscreen), its rubber edge, the quarter vent
  const SC = side(p, aNc);
  const win: [number, number][] = [[bnE + 0.1, bonZ + 1.0], [cabE - 0.1, bonZ + 1.0], [cabE - 0.1, cabZ - 1.4], [wsT + 0.06, cabZ - 1.4]];
  fillPoly(c, win.map(([b, z]) => SC.F(b, z)), '#16181c');
  poly3(p, win.map(([b, z]): V3 => [aNc, b + (b < (bnE + cabE) / 2 ? 0.014 : -0.014), z + (z < 15 ? 0.3 : -0.3)]), glassTex(SN.light), SN.light);
  const [v0x, v0y] = SC.F(bnE + 0.32, bonZ + 1);
  const [v1x, v1y] = SC.F(bnE + 0.32, cabZ - 1.6);
  ln(c, v0x, v0y, v1x, v1y, '#16181c', 1);
  // the cab door's seams, its handle, a step under it; the headlamp and indicator wrapping round the nose
  pq(p, SN, cabE - 0.06, cabE - 0.05, H0 + 0.4, cabZ - 0.4, darken(col, 0.4));
  pq(p, SN, bnE + 0.02, bnE + 0.03, H0 + 0.4, bonZ, darken(col, 0.4));
  pq(p, SN, cabE - 0.26, cabE - 0.14, bonZ - 0.8, bonZ - 0.3, '#2a2c30');
  lbox(p, rot0 ? aN - 0.02 : aN - 0.08, bnE + 0.12, 0.1, 0.42, 1.4, 0.5, mono(plastic, '#0c0d10'));
  pq(p, SN, b0 + 0.08, b0 + 0.24, 6.6, 8.2, '#f6f2d8');
  pq(p, SN, b0 + 0.1, b0 + 0.16, 7.0, 7.8, '#ffffff');
  pq(p, SN, b0 + 0.24, b0 + 0.31, 6.8, 7.8, '#f0a030');
  pq(p, SN, b0 + 0.1, b0 + 0.4, H0, H0 + 1.0, '#1c1d20');
  // the box: white panels with faint seams, aluminium corner posts and top rail
  const boxM: Mat = (light, _w, h) => (u, v, x, y) => {
    let i = light === 2 ? 4.4 : light === 1 ? 3.3 : 2.0;
    if (light !== 2 && v > h - 1.6) i += 0.9;
    if (light !== 2 && v < 1.8) i -= 0.8;
    if (light !== 2 && u % 46 < 1) i -= 0.4;
    if (hash(x, y, 99) < 0.006) i -= 0.8;
    return at(body, i);
  };
  lbox(p, a0, cabE + 0.02, wid, bEnd - cabE - 0.02, boxZ0, boxZ1 - boxZ0, { front: boxM, side: boxM, top: boxM, edge });
  const SB = side(p, aN);
  pq(p, SB, cabE + 0.02, cabE + 0.07, boxZ0, boxZ1, '#c8ced2');
  pq(p, SB, bEnd - 0.06, bEnd, boxZ0, boxZ1, '#aab0b6');
  pq(p, SB, cabE + 0.02, bEnd, boxZ1 - 0.6, boxZ1, '#dfe4e8');
  pq(p, SB, cabE + 0.02, bEnd, boxZ0, boxZ0 + 0.5, '#8a9096');
  // a roof vent and the box's lit top edge
  lbox(p, a0 + wid / 2 - 0.16, cabE + 0.5, 0.32, 0.32, boxZ1, 0.8, mono(coat(['#8a9096', '#a8aeb4', '#c4cacf', '#dde2e6', '#eef2f4', '#ffffff']), '#6a7076'));
  // the livery: a teal band and pinstripe, the supplier's leaf logo and name, side markers
  pq(p, SB, cabE + 0.1, bEnd - 0.1, boxZ0 + 2.2, boxZ0 + 3.4, TEAL[4]);
  pq(p, SB, cabE + 0.1, bEnd - 0.1, boxZ0 + 3.8, boxZ0 + 4.2, TEAL[3]);
  const mid = (cabE + bEnd) / 2;
  const [lx, ly] = SB.F(mid, boxZ0 + 12.4);
  ell(c, lx, ly, 11, 11, TEAL[3]);
  ell(c, lx, ly, 9, 9, '#f6faf8');
  fillPoly(c, [[lx - 2, ly + 6], [lx - 6, ly - 1], [lx - 1, ly - 7], [lx + 5, ly - 3], [lx + 3, ly + 4]], '#3fb68b');
  ln(c, lx - 2, ly + 6, lx + 2, ly - 4, '#1f6a50', 1);
  px(c, lx - 4, ly - 4, '#a2dccf', 2, 2);
  planeText(p, SB, mid - 1, mid + 1, boxZ0 + 6.2, boxZ0 + 7.6, 'LABSUPPLY', TEAL[1]);
  for (let bb = cabE + 0.3; bb < bEnd - 0.2; bb += 0.6) pq(p, SB, bb - 0.03, bb + 0.03, boxZ0 + 0.8, boxZ0 + 1.4, '#f0a030');
  // the arches and the near wheels, the rear bumper with its step
  arch(p, 'b', aN, axles[0], rz, 1.3, H0 - 0.4);
  arch(p, 'b', aN, axles[1], rz, 1.3, H0 - 0.4);
  for (const bb of axles) wheel(p, 'b', aN - out * 0.02, bb, rz, -out * 0.14);
  lbox(p, a0 + 0.03, bEnd - 0.02, wid - 0.06, 0.12, 1.4, 2.6, mono(plastic, '#0c0d10'));
  // the rear doors: centre seam, lock bars with handles, hinges, lights low in the corners, plate, logo
  const E = front(p, bEnd);
  const am = a0 + wid / 2;
  pq(p, E, am - 0.008, am + 0.008, boxZ0 + 0.3, boxZ1 - 0.3, darken(col, 0.45));
  pq(p, E, a0 + 0.03, a0 + 0.06, boxZ0, boxZ1, '#c8ced2');
  pq(p, E, a0 + wid - 0.06, a0 + wid - 0.03, boxZ0, boxZ1, '#aab0b6');
  pq(p, E, a0, a0 + wid, boxZ1 - 0.6, boxZ1, '#e6eaee');
  for (const la of [a0 + 0.22, am - 0.1, am + 0.1, a0 + wid - 0.22]) {
    pq(p, E, la - 0.012, la + 0.012, boxZ0 + 0.6, boxZ1 - 0.8, '#8a9298');
    pq(p, E, la - 0.03, la + 0.03, boxZ0 + 6.8, boxZ0 + 7.6, '#4a5056');
  }
  for (const z of [boxZ0 + 2, boxZ0 + 10.5, boxZ1 - 2.4]) {
    pq(p, E, a0 + 0.06, a0 + 0.12, z, z + 0.8, '#5a6066');
    pq(p, E, a0 + wid - 0.12, a0 + wid - 0.06, z, z + 0.8, '#5a6066');
  }
  for (const [la, lb] of [[a0 + 0.04, a0 + 0.2], [a0 + wid - 0.2, a0 + wid - 0.04]] as const) {
    pq(p, E, la, lb, 2.0, 3.0, '#c8282a');
    pq(p, E, la, lb, 3.0, 3.6, '#f0a030');
    pq(p, E, la, lb, 3.6, 4.0, '#f4f2ea');
  }
  pq(p, E, am - 0.2, am + 0.2, 1.8, 3.2, '#f4f2e8');
  pq(p, E, am - 0.2, am - 0.15, 1.8, 3.2, '#2a5aa8');
  const [rx, ry] = E.F(am + 0.26, boxZ0 + 13);
  ell(c, rx, ry, 6, 6, TEAL[3]);
  ell(c, rx, ry, 4.5, 4.5, '#f6faf8');
  fillPoly(c, [[rx - 1, ry + 3], [rx - 3, ry - 1], [rx, ry - 4], [rx + 3, ry - 1], [rx + 1, ry + 3]], '#3fb68b');
  pq(p, E, a0 + 0.06, a0 + wid - 0.06, boxZ0 + 2.2, boxZ0 + 3.4, TEAL[4]);
  pq(p, E, a0 + 0.06, a0 + wid - 0.06, boxZ0 + 3.8, boxZ0 + 4.2, TEAL[3]);
  // the mirror on its arm at the windscreen's foot, reaching out past the body
  const ma = aN + out * 0.08;
  const [m0x, m0y] = p.P(aN, bnE + 0.04, bonZ + 3.2);
  const [m1x, m1y] = p.P(ma, bnE + 0.04, bonZ + 3.6);
  ln(c, m0x, m0y, m1x, m1y, '#1c1d20', 2);
  lbox(p, rot0 ? ma - 0.03 : ma - 0.03, bnE, 0.06, 0.08, bonZ + 1.4, 3.2, mono(plastic, '#0c0d10'));
}

// ── bicycles ────────────────────────────────────────────────
/**
 * A bicycle standing along local b at (a, bc), drawn onto `l` (a layer): two wheels as
 * projected discs (tyre ring, spokes, hub), a diamond frame, saddle, bars; front towards
 * +b unless flipped.
 */
export function bike3(p: PropPainter, l: CanvasRenderingContext2D, a: number, bc: number, col: string, o: { basket?: boolean; child?: boolean; flip?: boolean } = {}) {
  const f = o.flip ? -1 : 1;
  const rz = 3.2;
  const wb = 0.26;
  const Q = (db: number, z: number, da = 0): V2 => p.P(a + da, bc + db * f, z);
  for (const hb of [-wb, wb]) {
    const ring = disc(p, 'b', a, bc + hb * f, rz, rz, 1, 0, Math.PI * 2, 24);
    for (let i = 0; i < ring.length - 1; i++) ln(l, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1], '#1e1c22', 2);
    const [hx, hy] = Q(hb, rz);
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = discPt(p, 'b', a, bc + hb * f, rz, rz * 0.82, (i * Math.PI) / 3 + 0.3);
      ln(l, hx, hy, sx, sy, '#a8aeb8');
    }
    px(l, hx - 1, hy - 1, '#d8dce2', 2, 2);
  }
  const R = Q(-wb, rz);
  const F = Q(wb, rz);
  const B = Q(-0.03, rz - 0.5);
  const S = Q(-0.1, rz + 5.4);
  const H = Q(0.18, rz + 5.2);
  const seg = (A: V2, C: V2, cc: string, w = 2) => ln(l, A[0], A[1], C[0], C[1], cc, w);
  seg(R, B, darken(col, 0.2), 1);
  seg(R, S, darken(col, 0.2), 1);
  seg(B, S, col);
  seg(S, H, col);
  seg(B, H, lighten(col, 0.12));
  seg(H, F, '#5a5e66');
  ell(l, B[0], B[1], 2, 2, '#4a4e56');
  seg(S, Q(-0.12, rz + 6.6), '#5a5e66', 1);
  seg(Q(-0.19, rz + 6.8), Q(-0.06, rz + 6.8), '#2a2420', 2);
  seg(H, Q(0.17, rz + 7.0), '#5a5e66', 1);
  seg(Q(0.17, rz + 7.2, -0.09), Q(0.17, rz + 7.2, 0.09), '#2e2a34', 2);
  if (o.basket) {
    const [x, y] = Q(0.26, rz + 7.2);
    px(l, x - 4, y - 6, '#b8925a', 8, 6);
    for (let i = 0; i < 8; i += 2) px(l, x - 4 + i, y - 6, '#8a6a3a', 1, 6);
    px(l, x - 4, y - 6, '#d4b07a', 8, 1);
  }
  if (o.child) {
    const [x, y] = Q(-0.3, rz + 6.4);
    px(l, x - 4, y - 7, '#e2553b', 8, 7);
    px(l, x - 4, y - 7, '#f27a5a', 8, 2);
  }
}

// ── the campus shuttle ──────────────────────────────────────
/** The driverless electric pod: along local a, both ends alike (it drives both ways). */
const lab_shuttle: PropArt = {
  draw(p, k) {
    const c = p.c;
    const W = k.w;
    const rot0 = p.rot === 0;
    const S6: Ramp = ['#8a9898', '#aebaba', '#ccd6d5', '#e2eaea', '#f2f6f5', '#ffffff'];
    const shell = coat(S6);
    const rz = 3.4;
    const b0 = 0.08;
    const b1 = 0.92;
    const axles = [0.62, W - 0.62];
    footShadow(p, 0.05, 0.08, W - 0.05, 0.92, 22, 0.32);
    for (const aa of axles)
      for (const bb of [b0 + 0.12, b1 - 0.12]) {
        const [x, y] = p.P(aa, bb, 0);
        contactShadow(c, x, y + 1, 13, 4, 0.5);
      }
    for (const aa of axles) wheel(p, 'a', aa, b0 + 0.1, rz, 0.1);
    // a dark skirt, the white body, the glass band all round, the roof and its sensor pod
    const glass: Mat = (light) => (u, v) => ((u * 0.6 + v) % 34 < 4 ? '#c8e6ec' : v > 34 ? (light === 0 ? '#3a5e70' : '#4a7486') : light === 0 ? '#22404e' : '#2c4e5e');
    lbox(p, 0.12, b0 + 0.04, W - 0.24, b1 - b0 - 0.08, 1.4, 1.6, mono(coat(['#1e2226', '#2a2f34', '#363c42', '#444b52', '#555d65', '#6a737b']), '#121416'));
    lbox(p, 0.06, b0, W - 0.12, b1 - b0, 2.8, 7.4, { front: shell, side: shell, top: shell, edge: '#6a7a7a' });
    lbox(p, 0.08, b0 + 0.02, W - 0.16, b1 - b0 - 0.04, 10.2, 10.2, { front: glass, side: glass, top: shell, edge: '#1e2a30' });
    lbox(p, 0.06, b0, W - 0.12, b1 - b0, 20.4, 2.4, { front: shell, side: shell, top: shell, edge: '#6a7a7a' });
    lbox(p, 0.5, 0.26, W - 1.0, 0.48, 22.8, 1.4, mono(shell, '#6a7a7a'));
    const F = front(p, b1);
    // the teal stripe, the window mullions, the sliding doors in the middle with their glass
    pq(p, F, 0.06, W - 0.06, 8.4, 9.6, TEAL[4]);
    pq(p, F, 0.06, W - 0.06, 9.6, 10.0, TEAL[2]);
    for (let a = 0.6; a < W - 0.4; a += 0.7) if (Math.abs(a - W / 2) > 0.45) pq(p, F, a - 0.02, a + 0.02, 10.2, 20.4, '#e8f0f0');
    pq(p, F, W / 2 - 0.4, W / 2 + 0.4, 2.9, 20.3, '#cfd8d8');
    pq(p, F, W / 2 - 0.36, W / 2 + 0.36, 3.2, 20.0, '#2c4e5e');
    pq(p, F, W / 2 - 0.34, W / 2 - 0.3, 3.2, 20.0, '#c8e6ec');
    pq(p, F, W / 2 - 0.012, W / 2 + 0.012, 3.2, 20.0, '#9ab0b8');
    pq(p, F, W / 2 - 0.4, W / 2 + 0.4, 2.6, 3.0, '#3a4048');
    // the campus leaf roundel between each wheel and the doors
    for (const aa of [1.0, W - 1.0]) {
      const [lx, ly] = F.F(aa, 5.6);
      ell(c, lx, ly, 5, 5, TEAL[3]);
      ell(c, lx, ly, 3.6, 3.6, '#f6faf8');
      fillPoly(c, [[lx - 1, ly + 3], [lx - 3, ly - 1], [lx, ly - 3], [lx + 3, ly - 1], [lx + 1, ly + 3]], '#3fb68b');
    }
    // the arches and the near wheels
    for (const aa of axles) {
      arch(p, 'a', aa, b1, rz, 1.3, 1.4, '#14181c');
      wheel(p, 'a', aa, b1 - 0.02, rz, -0.12);
    }
    // the visible end (the same at the other end): a big screen, lamps in the corners, the bumper, the destination
    const aE = rot0 ? W - 0.06 : 0.06;
    const E = side(p, aE);
    pq(p, E, b0 + 0.1, b1 - 0.1, 11, 19.6, '#22404e');
    pq(p, E, b0 + 0.14, b0 + 0.22, 11, 19.6, '#c8e6ec');
    pq(p, E, b0 + 0.18, b1 - 0.18, 18.4, 19.4, '#1a1a1e');
    planeText(p, E, b0 + 0.2, b1 - 0.2, 18.4, 19.4, 'LABS', '#f2a83a');
    pq(p, E, b0 + 0.06, b0 + 0.24, 5.2, 6.6, '#fff6d8');
    pq(p, E, b1 - 0.24, b1 - 0.06, 5.2, 6.6, '#fff6d8');
    pq(p, E, b0 + 0.08, b0 + 0.14, 5.5, 6.3, '#ffffff');
    pq(p, E, b1 - 0.14, b1 - 0.08, 5.5, 6.3, '#ffffff');
    pq(p, E, b0 + 0.28, b1 - 0.28, 5.4, 6.4, '#1e2a30');
    pq(p, E, b0 + 0.02, b1 - 0.02, 2.8, 4.2, '#2a2f34');
    pq(p, E, b0 + 0.02, b1 - 0.02, 4.0, 4.2, '#555d65');
    // lidar pucks on the roof's corners
    for (const aa of [0.22, W - 0.22])
      for (const bb of [b0 + 0.14, b1 - 0.14]) {
        const [x, y] = p.P(aa, bb, 22.8);
        px(c, x - 3, y - 5, '#1e2226', 6, 5);
        px(c, x - 3, y - 5, '#4a5058', 6, 1);
        px(c, x - 2, y - 3, '#3a8ae8', 2, 1);
      }
    void k;
  },
  lights: (k) => [{ a: k.w / 2, b: 0.5, z: 16, r: 1.6, color: '#e8f6ff', kind: 'window' }],
};

// ── placed cars ─────────────────────────────────────────────
export const CARCOLS = ['#e8eaea', '#b8bec4', '#2a3a5a', '#a82828', '#2a6a64', '#1e2024', '#5a6a7a', '#d8c8a8'];

/** A placed car, centred in its footprint along local b ('van' fills its footprint). */
const lab_car: PropArt = {
  draw(p, k) {
    const kind = k.variant ?? (k.seed % 3 === 0 ? 'estate' : 'hatch');
    if (kind === 'van') {
      footShadow(p, 0.05, 0.05, k.w - 0.05, k.d - 0.05, 24, 0.3);
      van3(p, 0.05, 0.05, k.w - 0.1, k.d - 0.1, k.color ?? '#f2f2ee');
      return;
    }
    const col = k.color ?? CARCOLS[k.seed % CARCOLS.length];
    const wid = kind === 'estate' ? 1.02 : 0.96;
    const len = Math.min(k.d - 0.1, kind === 'estate' ? 2.45 : 2.3);
    const a0 = (k.w - wid) / 2;
    const b0 = (k.d - len) / 2;
    footShadow(p, a0, b0, a0 + wid, b0 + len, 15, 0.3);
    car3(p, a0, b0, wid, len, col, k.seed % 2 === 0, kind, k.seed);
  },
};

export const CHEMLAB_VEHICLES: Record<string, PropArt> = { lab_shuttle, lab_car };

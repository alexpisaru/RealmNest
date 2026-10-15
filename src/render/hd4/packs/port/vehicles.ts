// Logistics Port — the road and yard vehicles as solid 3-D models at 128×64
// (1 tile ≈ 2 m ≈ 20 z): a cab-over tractor coupled to a container trailer
// (its fifth wheel under the trailer's nose), a straddle carrier on eight
// wheels, parked cars. Every wheel is a tyre drawn in its own plane (an
// isometric ellipse), with a rim, a hub and bolts, an arch over it and a
// contact shadow under it.
//   prt_truck     variants: (default) cab toward +a · west (cab toward −a);
//                 color 'empty' = a skeletal chassis without a box
//   prt_straddle  a straddle carrier lifting a box (along b)
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { ell, fillPoly, hash, ln, px, type Ramp } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { anchor, lbox, mono } from '../util';
import { archOn, CHROME, plate, shadowBand, stencil, TYRE, wheelOn } from './kit';
import { BOX_COLOURS, GALV, IRON, P, STEEL } from './palette';
import { drawBox, glass } from './quay';

const BOXH = 25.9;
const pickColour = (h: number) => P[BOX_COLOURS[Math.floor(h * BOX_COLOURS.length) % BOX_COLOURS.length]];

/** A solid dark shadow under a vehicle's footprint (a little to the lower right). */
function underShadow(p: PropPainter, a0: number, b0: number, a1: number, b1: number) {
  fillPoly(p.c, [p.P(a0 + 0.05, b1 + 0.08, 0), p.P(a1 + 0.12, b1 + 0.08, 0), p.P(a1 + 0.12, b0 + 0.05, 0), p.P(a0 + 0.05, b0 + 0.05, 0)], '#24202a');
}

/**
 * A parked car along a (a0 … a0 + L), b0 … b0 + D: a body with wheel arches, a narrower cabin with
 * glass all round, pillars, lights, bumpers, a plate, mirrors. Faces +a (its nose at a0 + L).
 */
export function car(p: PropPainter, a0: number, b0: number, L: number, D: number, col: Ramp, seed = 0) {
  const c = p.c;
  const body = plate(col, 0.2);
  underShadow(p, a0, b0, a0 + L, b0 + D);
  const F = front(p, b0 + D);
  const S = side(p, a0 + L);
  const R = 0.15;
  // far wheels peep under the sill
  for (const u of [a0 + L * 0.2, a0 + L * 0.8]) {
    const [x, y] = p.P(u, b0 + 0.06, 3);
    ell(c, x, y, 7, 6, TYRE);
  }
  // the body: a sill, the lower body, a bonnet and boot line
  lbox(p, a0, b0, L, D, 1.4, 5.8, { front: body, side: body, top: plate(col, 0), edge: col[0] });
  for (const u of [a0 + L * 0.2, a0 + L * 0.8]) archOn(p, F, u, 3, R);
  pq(p, F, a0 + 0.04, a0 + L - 0.04, 4.6, 5.0, col[col.length - 1]);
  // the cabin: a slightly narrower, sloping glasshouse
  const ca0 = a0 + L * 0.24;
  const ca1 = a0 + L * 0.76;
  const cb0 = b0 + 0.05;
  const cb1 = b0 + D - 0.05;
  const z0 = 7.2;
  const z1 = 13.2;
  const G1 = '#3c6a8e';
  const G2 = '#9cc4dc';
  // side glass (front face) as a trapezoid, the windscreen (side face), the roof
  fillPoly(c, [p.P(ca0 - 0.12, cb1, z0), p.P(ca1 + 0.16, cb1, z0), p.P(ca1, cb1, z1), p.P(ca0, cb1, z1)], G1);
  fillPoly(c, [p.P(ca0 - 0.04, cb1, z0 + 1), p.P(ca0 + (ca1 - ca0) * 0.4, cb1, z0 + 1), p.P(ca0 + (ca1 - ca0) * 0.3, cb1, z1 - 1), p.P(ca0 + 0.04, cb1, z1 - 1)], G2);
  fillPoly(c, [p.P(ca1 + 0.16, cb1, z0), p.P(ca1 + 0.16, cb0, z0), p.P(ca1, cb0, z1), p.P(ca1, cb1, z1)], '#2a4a66');
  fillPoly(c, [p.P(ca1 + 0.14, cb1 - 0.08, z0 + 0.6), p.P(ca1 + 0.14, cb1 - 0.3, z0 + 0.6), p.P(ca1 + 0.04, cb1 - 0.3, z1 - 1.2), p.P(ca1 + 0.04, cb1 - 0.08, z1 - 1.2)], '#7aa8c8');
  fillPoly(c, [p.P(ca0, cb1, z1), p.P(ca1, cb1, z1), p.P(ca1, cb0, z1), p.P(ca0, cb0, z1)], col[col.length - 2]);
  ln(c, ...p.P(ca0, cb1, z1), ...p.P(ca1, cb1, z1), col[col.length - 1]);
  // the B-pillar and the door line, a handle
  const um = (ca0 + ca1) / 2 + 0.02;
  fillPoly(c, [p.P(um - 0.025, cb1, z0), p.P(um + 0.025, cb1, z0), p.P(um + 0.025, cb1, z1), p.P(um - 0.025, cb1, z1)], col[1]);
  ln(c, ...F.F(um, 1.8), ...F.F(um, z0), col[1]);
  px(c, ...F.F(um - 0.12, 5.6), '#e8eaec', 2, 1);
  // lights, bumpers, the plate, a mirror
  for (const b of [b0 + 0.1, b0 + D - 0.2]) pq(p, S, b, b + 0.1, 4.2, 5.4, '#fff4c8');
  pq(p, S, b0 + 0.04, b0 + D - 0.04, 1.4, 2.6, '#2a2a30');
  pq(p, S, b0 + D * 0.35, b0 + D * 0.65, 2.6, 3.8, '#f2f2ea');
  pq(p, F, a0 + 0.02, a0 + 0.08, 4, 5.4, '#c8281e');
  pq(p, F, a0, a0 + L, 1.4, 2.2, col[0]);
  const [mx, my] = p.P(ca1 + 0.1, b0 + D + 0.05, 8);
  px(c, mx - 1, my - 2, col[1], 3, 3);
  for (const u of [a0 + L * 0.2, a0 + L * 0.8]) wheelOn(p, front(p, b0 + D + 0.01), u, 3, R);
  void seed;
}

// ── the container truck ──────────────────────────────────────
const CABS: Ramp[] = [P.red, P.blue, P.white, P.green, P.orange, P.navy];

const truck: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const west = k.variant === 'west';
    // f runs from the trailer's tail (0) to the cab's nose (W); a is mirrored for the west-facing truck
    const A = (f: number) => (west ? W - f : f);
    const span = (f0: number, f1: number): [number, number] => (west ? [W - f1, f1 - f0] : [f0, f1 - f0]);
    const box = (f0: number, f1: number, b0: number, bd: number, z0: number, h: number, m: Parameters<typeof lbox>[7]) => {
      const [a, w] = span(f0, f1);
      lbox(p, a, b0, w, bd, z0, h, m);
    };
    const cabR = CABS[k.seed % CABS.length];
    const cm = plate(cabR, 0.3);
    const steel = mono(plate(STEEL), STEEL[0]);
    const B0 = 0.42;
    const B1 = 1.58;
    const Fb = front(p, B1 + 0.01);
    const R = 0.22;
    const ZC = 4.4;
    const empty = k.color === 'empty';
    shadowBand(p, 0.05, B0, W - 0.05, B1, 0.4, 0.3);
    underShadow(p, 0.1, B0, W - 0.1, B1);
    const trailWheels = [0.9, 1.42, 1.94];
    const cabWheels = [W - 1.95, W - 0.62];
    // the far wheels under the chassis
    for (const f of [...trailWheels, ...cabWheels]) {
      const [x, y] = p.P(A(f), B0 + 0.1, ZC);
      ell(c, x, y, 13, 14, TYRE);
    }
    const drawTrailer = () => {
      // the chassis: two main rails, the deck, mudguards, landing legs, the underrun guard, the light bar
      box(0.05, W - 1.7, 0.62, 0.76, 5.2, 2.6, steel);
      if (empty) {
        for (const b of [0.5, 1.38]) box(0.05, W - 1.7, b, 0.12, 7.6, 1.6, steel);
        for (let f = 0.15; f < W - 1.8; f += 1.1) box(f, f + 0.12, 0.5, 1.0, 7.8, 1.2, steel);
        for (const f of [0.08, W - 1.95]) for (const b of [0.48, 1.4]) box(f, f + 0.12, b, 0.12, 9.2, 1, mono(plate(P.yellow), P.yellow[0]));
      } else {
        box(0.05, W - 1.7, 0.4, 1.2, 7.8, 2, { front: plate(STEEL), side: plate(STEEL), top: plate(GALV), edge: STEEL[0] });
      }
      // landing legs (vertical, with feet) just behind the cab
      for (const b of [0.52, 1.42]) box(W - 3.0, W - 2.88, b, 0.08, 0.6, 5.2, mono(plate(GALV), GALV[0]));
      box(W - 3.05, W - 2.83, 1.38, 0.18, 0, 0.8, steel);
      // the side underrun guard between the legs and the wheels
      const [g0, gw] = span(2.4, W - 3.1);
      for (const z of [5.2, 6.8]) pq(p, Fb, g0, g0 + gw, z, z + 0.6, '#c8ccd0');
      // the tail: a bumper with red lights (shows on the west-facing truck's visible end)
      box(0.04, 0.14, 0.45, 1.1, 3.2, 2.2, mono(plate(IRON), IRON[0]));
      if (west) for (const b of [0.5, 1.32]) pq(p, side(p, W - 0.04), b, b + 0.16, 3.8, 5, '#e8301e');
      // mudguards over the axle group
      box(0.6, 2.24, 1.5, 0.1, 8.6, 0.8, mono(plate(IRON), IRON[0]));
      // the box on its twistlocks
      if (!empty) {
        const sd = hash(k.seed, 7, 3);
        const [a, w] = span(0.1, W - 1.75);
        drawBox(p, a, 0.4, w, 1.2, 9.8, BOXH, pickColour(sd), { seed: Math.floor(sd * 9999), rust: 0.45, doors: west ? 'closed' : 'blank', logo: w > 4 });
      }
    };
    const drawTractor = () => {
      // the tractor's chassis, the fifth wheel (under the trailer's nose: the coupling), air hoses
      box(W - 2.45, W - 0.3, 0.6, 0.8, 4, 3, steel);
      box(W - 2.35, W - 1.6, 0.52, 0.96, 7, 1, { front: plate(STEEL), side: plate(STEEL), top: plate(['#1a1a1e', '#26262c', '#33333a', '#40404a', '#50505a', '#62626c']), edge: STEEL[0] });
      const [hx0, hy0] = p.P(A(W - 1.5), 1.2, 22);
      const [hx1, hy1] = p.P(A(W - 1.75), 1.2, 12);
      ln(c, hx0, hy0, hx1, hy1, '#d8302a', 2);
      ln(c, hx0 + 3, hy0, hx1 + 3, hy1 + 2, '#f2c43a', 2);
      // the fuel tank and steps under the door
      box(W - 1.42, W - 0.95, 1.46, 0.18, 4.4, 4, mono(plate(CHROME), CHROME[0]));
      // the cab: lower body, glasshouse, roof fairing
      box(W - 1.45, W - 0.08, B0, B1 - B0, 6.4, 23.6, { front: cm, side: cm, top: plate(cabR, 0), edge: cabR[0] });
      box(W - 1.35, W - 0.2, B0 + 0.1, B1 - B0 - 0.2, 30, 4.2, { front: plate(cabR, 0), side: plate(cabR, 0), top: plate(cabR, 0), edge: cabR[0] });
      const [ua, uw] = span(W - 1.45, W - 0.08);
      // a livery stripe, the door line and handle, the side window, the step
      pq(p, Fb, ua, ua + uw, 13.2, 14.6, '#f4f2ec');
      pq(p, Fb, ua, ua + uw, 12.6, 13.2, cabR[0]);
      const [wa] = span(W - 0.95, W - 0.3);
      pt(p, Fb, wa, wa + 0.65, 19.5, 27.5, glass, 1);
      pq(p, Fb, wa - 0.03, wa + 0.68, 18.9, 19.5, cabR[1]);
      const dl = west ? ua + uw - 0.02 : ua + 0.02;
      pq(p, Fb, dl, dl + 0.03, 7, 28, cabR[1]);
      px(c, ...Fb.F(west ? wa + 0.55 : wa + 0.08, 17.4), '#e8eaec', 3, 1);
      pq(p, Fb, wa, wa + 0.5, 6.4, 7.4, '#2a2a30');
      // the nose (+x face) on the east-facing truck: windscreen, wipers, grille, lights, bumper
      if (!west) {
        const N = side(p, W - 0.07);
        pq(p, N, B0 + 0.05, B1 - 0.05, 18.4, 29, '#1c1c22');
        pt(p, N, B0 + 0.1, B1 - 0.1, 19, 28.4, glass, 0);
        const [w0x, w0y] = N.F(B0 + 0.3, 19.2);
        ln(c, w0x, w0y, ...N.F(B0 + 0.55, 24), '#1a1a1e', 2);
        ln(c, ...N.F(B1 - 0.5, 19.2), ...N.F(B1 - 0.25, 24), '#1a1a1e', 2);
        pq(p, N, B0 + 0.25, B1 - 0.25, 9, 16.5, '#26262c');
        for (let z = 9.8; z < 16; z += 1.4) pq(p, N, B0 + 0.28, B1 - 0.28, z, z + 0.5, CHROME[3]);
        for (const b of [B0 + 0.05, B1 - 0.22]) {
          pq(p, N, b, b + 0.17, 9.6, 11.6, '#fff6d0');
          pq(p, N, b, b + 0.17, 9.2, 9.6, '#e8901e');
        }
        pq(p, N, B0, B1, 6.4, 8.8, '#3a3a42');
        pq(p, N, B0 + 0.4, B1 - 0.4, 7, 8.2, '#f2f2ea');
        // the mirror on its arm
        const [mx, my] = p.P(W - 0.02, B1 + 0.12, 24);
        ln(c, ...p.P(W - 0.1, B1, 25), mx, my, '#1e1e22', 2);
        px(c, mx - 1, my - 1, '#1e1e22', 4, 9);
        px(c, mx, my, '#8ab0c8', 2, 6);
      } else {
        // the cab's back wall (visible on the west-facing truck): a small window, the exhaust
        const Bk = side(p, 1.45 + 0.0);
        pq(p, Bk, B0 + 0.4, B1 - 0.4, 22, 26, '#1c2a38');
      }
      // the exhaust stack and an air horn behind the cab, a beacon on the roof
      const [ex, ey] = p.P(A(W - 1.52), 1.42, 8);
      px(c, ex - 2, ey - 32, CHROME[3], 4, 32);
      px(c, ex - 2, ey - 32, CHROME[5], 1, 32);
      px(c, ex - 3, ey - 34, '#1e1e22', 6, 3);
      const [bx, by] = anchor(p, A(W - 0.8), 1.0, 34.2);
      px(c, bx - 3, by - 4, '#f29a1a', 6, 4);
      px(c, bx - 2, by - 4, '#ffe0a0', 2, 1);
      for (const f of cabWheels) archOn(p, Fb, A(f), ZC, R);
    };
    if (west) {
      drawTractor();
      drawTrailer();
    } else {
      drawTrailer();
      drawTractor();
    }
    // the near wheels: twin tyres on the trailer's three axles, the tractor's drive and steer axles
    for (const f of [...trailWheels, ...cabWheels]) wheelOn(p, front(p, B1 + 0.03), A(f), ZC, R);
  },
};

// ── the straddle carrier ─────────────────────────────────────
const straddle: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const red = plate(P.red, 0.3);
    const redM = { front: red, side: red, top: plate(P.red, 0), edge: P.red[0] };
    const H = 86;
    const R = 0.22;
    underShadow(p, 0, 0.05, W, D - 0.05);
    // the far side frame: wheels, the sill, two vertical legs
    const frame = (a0: number) => {
      lbox(p, a0, 0.05, 0.3, D - 0.1, 7, 4.5, redM);
      for (const b of [0.1, D - 0.4]) lbox(p, a0 + 0.04, b, 0.22, 0.3, 11.5, H - 11.5, redM);
      // a diagonal-free tie half way up, a ladder on the near frame
      lbox(p, a0 + 0.06, 0.4, 0.18, D - 0.8, 48, 2.4, redM);
    };
    for (const b of [0.4, D - 0.4]) {
      const [x, y] = p.P(0.42, b, 4.4);
      ell(c, x, y, 12, 14, TYRE);
    }
    frame(0.05);
    // the box on its spreader, hanging from four cables between the frames
    const sd = hash(k.seed, 3, 5);
    drawBox(p, 0.45, 0.2, W - 0.9, D - 0.4, 14, BOXH, pickColour(sd), { seed: Math.floor(sd * 9999), rust: 0.4, doors: 'blank' });
    lbox(p, 0.4, 0.15, W - 0.8, D - 0.3, 14 + BOXH, 2.4, mono(plate(P.yellow), P.yellow[0]));
    for (const [a, b] of [[0.6, 0.4], [W - 0.6, 0.4], [0.6, D - 0.4], [W - 0.6, D - 0.4]] as const) ln(c, ...p.P(a, b, H), ...p.P(a, b, 16.3 + BOXH), '#26262c');
    // the near side frame (sill with its wheels, legs, a ladder up the front leg)
    frame(W - 0.35);
    const Sx = side(p, W - 0.04);
    for (const b of [0.4, D - 0.4]) {
      archOn(p, Sx, b, 4.4, R);
      wheelOn(p, Sx, b, 4.4, R);
    }
    for (let z = 14; z < H - 4; z += 4) pq(p, side(p, W - 0.02), D - 0.42, D - 0.12, z, z + 0.5, '#f2c43a');
    // the top: two longitudinal girders, cross girders at both ends, the engine house
    lbox(p, 0, 0.05, W, 0.4, H, 7, redM);
    lbox(p, 0, 0.05, 0.36, D - 0.1, H, 7, redM);
    lbox(p, W - 0.36, 0.05, 0.36, D - 0.1, H, 7, redM);
    lbox(p, 0, D - 0.45, W, 0.4, H, 7, redM);
    lbox(p, 0.3, 0.6, W - 0.6, D * 0.42, H + 7, 10, { front: plate(P.white), side: plate(P.white), top: plate(['#5a5e64', '#6c7076', '#7e8288', '#92969a', '#a6aaae', '#bcc0c2']), edge: P.white[0] });
    for (let b = 0.75; b < 0.6 + D * 0.42 - 0.1; b += 0.12) pq(p, side(p, W - 0.3), b, b + 0.05, H + 9, H + 15, '#5a5e64');
    pq(p, front(p, D - 0.05), 0, W, H + 3, H + 4.4, '#f4f0e6');
    // the driver's cab hanging under the front corner: glass round three sides, a frame
    lbox(p, W - 0.95, D - 0.75, 0.62, 0.62, H - 18, 18, { front: plate(P.white), side: plate(P.white), top: plate(P.white), edge: P.white[0] });
    pt(p, front(p, D - 0.13), W - 0.9, W - 0.38, H - 15, H - 3, glass, 1);
    pt(p, side(p, W - 0.33), D - 0.7, D - 0.18, H - 15, H - 3, glass, 0);
    pq(p, front(p, D - 0.13), W - 0.95, W - 0.33, H - 18, H - 16.5, '#2a2a30');
    const [bx, by] = anchor(p, W / 2, D / 2, H + 18);
    px(c, bx - 2, by - 4, '#e8622a', 4, 4);
    stencil(p, side(p, W), D * 0.55, H + 5.6, `SC ${10 + (k.seed % 30)}`, '#f4f0e6');
  },
  anim(p, k) {
    const [bx, by] = anchor(p, k.w / 2, k.d / 2, 104);
    if (Math.sin(k.t * 5 + k.seed) > 0) px(p.c, bx - 2, by - 4, '#ffb84a', 4, 4);
  },
};

straddle.lights = (k) => [{ a: k.w / 2, b: k.d / 2, z: 90, r: 2.4, color: '#f2f6ff', kind: 'lamp' }];
truck.lights = (k) => [{ a: k.variant === 'west' ? 0.1 : k.w - 0.1, b: 1, z: 10, r: 1.6, color: '#fff2c8', kind: 'lamp' }];

// a parked car on a 2 × 1 footprint (variants: the paint)
const parked: PropArt = {
  draw(p, k) {
    const col = (P as Record<string, Ramp>)[k.variant ?? 'red'] ?? P.red;
    car(p, 0.35, 0.22, 1.3, 0.64, col, k.seed);
  },
};

export const PORT_VEHICLES: Record<string, PropArt> = { prt_truck: truck, prt_straddle: straddle, prt_car: parked };

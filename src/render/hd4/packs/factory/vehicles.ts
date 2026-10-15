// Factory — road and rail vehicles at true scale (1 z ≈ 10 cm; a tile ≈ 1.6 m; a person is 17.5 z).
//   fac_lorry     an articulated lorry on a dock: the trailer's deck at dock height (1.2 m),
//                 its box 4 m to the roof, a cab-over tractor in the haulier's colour
//   fac_wagon, fac_train  the rolling stock: see rolling.ts
//   fac_van       the works' van (1.9 m) · fac_parked  a staff car (1.4 m)
//   fac_car       an abandoned car gone to rust on bricks · fac_forklift  a counterbalance truck
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { ell, fillPoly, hash, layer, ln, px, type Ramp } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { planeText } from './font';
import { FACTORY_ROLLING } from './rolling';
import { at, BRICK, brick, enamel, GLASS, IRON, planks, RUST, STEEL, TIMBER, visA, WEED, YELLOW } from './palette';

const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const ramp = (c: string): Ramp => [darken(c, 0.55), darken(c, 0.38), darken(c, 0.2), c, lighten(c, 0.16), lighten(c, 0.3)];
const TYRE: Ramp = ['#121014', '#1c1a20', '#26242c', '#323038', '#403e48'];

/** A wheel seen side-on (a slightly squashed disc on the +y face): tyre, sidewall, rim, hub. */
function wheel(c: CanvasRenderingContext2D, x: number, y: number, r: number, rim: string = STEEL[4]) {
  ell(c, x + 1, y + 1, r, r * 1.04, TYRE[0]);
  ell(c, x, y, r, r * 1.04, TYRE[2]);
  ell(c, x - 1, y - 1, r - 1.5, r - 1.2, TYRE[3]);
  ell(c, x, y, r * 0.58, r * 0.6, darken(rim, 0.2));
  ell(c, x - 0.5, y - 0.5, r * 0.5, r * 0.52, rim);
  ell(c, x - r * 0.15, y - r * 0.15, r * 0.2, r * 0.2, lighten(rim, 0.35));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    px(c, x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, darken(rim, 0.35));
  }
}

/** Dark glass with a pale diagonal reflection (FaceTex). */
const glassTex = (light: number) => (u: number, v: number) => ((u * 0.7 + v) % 30 < 5 ? '#8aa4ac' : light ? '#33444e' : '#283842');

// ── the articulated lorry ───────────────────────────────────
const fac_lorry: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const cab = k.color ?? (k.variant === 'blue' ? '#2f5eaa' : k.variant === 'red' ? '#c43028' : ['#2f5eaa', '#c43028', '#2e6a4a', '#e8e4dc'][k.seed % 4]);
    const CR = ramp(cab);
    footShadow(p, 0, 0.05, W, D, 30, 0.34);
    const tl = W - 2.1; // the trailer's length
    const b0 = 0.06;
    const b1 = D - 0.06;
    const deck = 12;
    const roof = 39;
    // the tractor's chassis and the fifth wheel first: the trailer's nose rests on them
    {
      const ca0 = tl + 0.08;
      lbox(p, ca0 - 0.6, b0 + 0.2, W - ca0 + 0.55, b1 - b0 - 0.4, 6, 4, mono(flat(IRON, 2, 1, 3), IRON[0]));
      lbox(p, ca0 - 0.6, b0 + 0.3, 0.62, b1 - b0 - 0.6, 10, 2, mono(flat(IRON, 3, 2, 4), IRON[0]));
      // the exhaust stack behind the cab (the cab hides its foot)
      const [ex, ey] = p.P(W - 1.42 - 0.1, b0 + 0.28, 8);
      px(p.c, ex - 3, ey - 120, '#8a8e96', 6, 120);
      px(p.c, ex - 3, ey - 120, '#d8dce0', 2, 120);
      px(p.c, ex - 4, ey - 123, '#4a4e56', 8, 4);
    }
    // under the trailer: the chassis rails, the landing legs, the rear bogie with three axles, a light bar
    lbox(p, 0.25, b0 + 0.2, tl - 0.3, b1 - b0 - 0.4, deck - 3, 3, mono(flat(IRON, 2, 1, 3), IRON[0]));
    for (const b of [b0 + 0.25, b1 - 0.3]) lbox(p, tl - 1.8, b, 0.1, 0.06, 0, deck - 3, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
    lbox(p, 0.3, b0 + 0.15, 2.2, b1 - b0 - 0.3, 4, deck - 4 - 3, mono(flat(IRON, 1, 1, 2), IRON[0]));
    // the box: ribbed white panels, aluminium corner posts, a livery band and the name
    const WHITE: Ramp = ['#7e7c7a', '#9e9c98', '#bebcb6', '#d8d6ce', '#eae8e0', '#f6f4ec'];
    const box: Mat = (light) => (u, v, x, y) => {
      let i = light === 2 ? 4 : light ? 3.4 : 2.2;
      if (u % 30 < 1.4) i -= 1.2;
      if (v < 4) i -= 0.6;
      if (hash(x, y, 7) < 0.03) i -= 0.7;
      // the haulier's livery: a broad band low down and a pinstripe over it
      if (light === 1 && v > 8 && v < 15) return at(CR, 3 + (v > 13 ? 1 : 0));
      if (light === 1 && v > 17 && v < 19) return at(CR, 2);
      if (light === 1 && v < 10 && hash(Math.floor(u / 3), Math.floor(v / 2), 8) < 0.3) i -= 0.6; // road grime
      return at(WHITE, i);
    };
    lbox(p, 0.05, b0, tl - 0.05, b1 - b0, deck, roof - deck, { front: box, side: box, top: (light) => (u) => at(WHITE, (light === 2 ? 4 : 3) - (u % 30 < 1.4 ? 1 : 0)), edge: WHITE[0] });
    const F = front(p, b1 + 0.001);
    pq(p, F, 0.05, 0.1, deck, roof, STEEL[4]);
    pq(p, F, tl - 0.05, tl, deck, roof, STEEL[3]);
    planeText(p.c, F, tl * 0.5, 28.5, 'HILSON', '#24489a', 4);
    planeText(p.c, F, tl * 0.5, 22.5, 'HAULAGE', '#24489a', 2);
    // the rear doors at the dock end (a = 0) are hidden against the dock; marker lights along the side
    for (let a = 0.6; a < tl - 0.3; a += 1.2) {
      const [x, y] = F.F(a, deck + 0.6);
      px(p.c, x - 1, y - 1, '#e8902a', 3, 2);
    }
    // the trailer's wheels: three axles, a mudflap behind
    for (const a of [0.75, 1.42, 2.09]) {
      const [x, y] = p.P(a, b1, 5);
      wheel(p.c, x, y, 18);
    }
    const [fx, fy] = F.F(0.32, 5);
    px(p.c, fx - 3, fy - 14, '#1e1e22', 7, 20);
    // the tractor unit: chassis, fuel tank, the cab (a tall cab-over), deflector, stack, mirrors
    const ca = tl + 0.08;
    // the chassis between the trailer's nose and the cab, seen in the gap
    lbox(p, tl, b0 + 0.2, W - 1.42 - tl, b1 - b0 - 0.4, 6, 4, mono(flat(IRON, 2, 1, 3), IRON[0]));
    lbox(p, ca, b1 - 0.42, 0.62, 0.32, 5, 6, { front: (light) => (u, v) => at(STEEL, (light ? 4 : 3) + (v > 20 ? 1 : 0) - (u % 22 < 1 ? 1 : 0)), side: flat(STEEL, 3, 2), top: flat(STEEL, 5, 4), edge: STEEL[0] });
    const cabA = W - 1.42;
    const cz0 = 9;
    const cz1 = 33;
    lbox(p, cabA, b0 + 0.02, W - cabA - 0.05, b1 - b0 - 0.04, cz0, cz1 - cz0, { front: enamel(CR, 0.05), side: enamel(CR, 0.05), top: flat(CR, 4, 3, 5), edge: CR[0] });
    lbox(p, cabA + 0.05, b0 + 0.1, 0.8, b1 - b0 - 0.2, cz1, 3, mono(flat(CR, 3, 2, 4), CR[0]));
    fillPoly(p.c, [p.P(cabA + 0.85, b0 + 0.1, cz1 + 3), p.P(cabA + 0.85, b1 - 0.1, cz1 + 3), p.P(W - 0.12, b1 - 0.1, cz1), p.P(W - 0.12, b0 + 0.1, cz1)], CR[4]);
    const S = side(p, visA(p, cabA - 0.001, W - 0.049));
    const Fc = front(p, b1 - 0.02 + 0.001);
    // the cab's face: a big two-piece windscreen, a grille with the badge, headlamps, a bumper, steps
    pt(p, S, b0 + 0.1, b1 - 0.1, 21, 31, glassTex(S.light), S.light);
    pq(p, S, (b0 + b1) / 2 - 0.015, (b0 + b1) / 2 + 0.015, 21, 31, CR[0]);
    pq(p, S, b0 + 0.08, b1 - 0.08, 20.4, 21, CR[0]);
    pq(p, S, b0 + 0.18, b1 - 0.18, 12.4, 19.4, '#24242a');
    for (let z = 13; z < 19; z += 1.2) pq(p, S, b0 + 0.2, b1 - 0.2, z, z + 0.5, '#5a5e66');
    planeText(p.c, S, (b0 + b1) / 2, 17.6, 'H', '#c8ccd0', 1);
    for (const b of [b0 + 0.17, b1 - 0.17]) {
      const [x, y] = S.F(b, 11);
      px(p.c, x - 4, y - 3, '#fff2c0', 8, 4);
      px(p.c, x - 4, y - 3, '#ffffff', 3, 1);
    }
    pq(p, S, b0 + 0.02, b1 - 0.02, 7.6, 10, '#1e1e22');
    // the door: its window, the handle, two steps below, the haulier's name
    pq(p, Fc, cabA + 0.12, W - 0.22, 10, 31, CR[Fc.light ? 2 : 1]);
    pq(p, Fc, cabA + 0.14, W - 0.24, 10.4, 30.6, CR[Fc.light ? 3 : 2]);
    pt(p, Fc, cabA + 0.2, W - 0.3, 22, 30, glassTex(Fc.light), Fc.light);
    pq(p, Fc, W - 0.42, W - 0.3, 19.6, 20.4, STEEL[5]);
    for (const z of [5.6, 8.2]) pq(p, Fc, cabA + 0.22, W - 0.34, z, z + 0.7, STEEL[3]);
    planeText(p.c, Fc, (cabA + W) / 2 - 0.05, 15, 'HILSON', CR[0], 1);
    // mirrors on arms, the exhaust stack behind the cab, an amber beacon
    const [mx, my] = p.P(W - 0.12, b1 + 0.1, 27);
    px(p.c, mx - 1, my - 1, '#2a2a30', 5, 2);
    px(p.c, mx + 3, my - 9, '#2a2a30', 4, 14);
    const [bx, by] = p.P(cabA + 0.5, (b0 + b1) / 2, cz1 + 3);
    px(p.c, bx - 3, by - 5, '#e8902a', 6, 5);
    px(p.c, bx - 2, by - 5, '#ffd070', 2, 2);
    // the tractor's wheels
    for (const a of [cabA + 0.45, ca - 0.15]) {
      const [x, y] = p.P(a, b1, 5);
      wheel(p.c, x, y, 18, CR[4]);
    }
  },
};

// ── the works van and a staff car ───────────────────────────
const fac_van: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const col = k.color ?? ['#e8e4dc', '#2a5aa8', '#c8302a', '#3a6a4a'][k.seed % 4];
    const R = ramp(col);
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.1, 20, 0.32);
    const b0 = 0.1;
    const b1 = D - 0.1;
    const nose = W - 0.6;
    // the load body up to 1.9 m, the bonnet, the windscreen sloping back
    lbox(p, 0.06, b0, nose - 0.06, b1 - b0, 2.4, 16.6, { front: enamel(R, 0.05), side: enamel(R, 0.05), top: flat(R, 4, 3, 5), edge: R[0] });
    lbox(p, nose, b0 + 0.02, W - nose - 0.08, b1 - b0 - 0.04, 2.4, 6.6, { front: enamel(R, 0.05), side: enamel(R, 0.05), top: flat(R, 4, 3, 5), edge: R[0] });
    fillPoly(p.c, [p.P(nose, b0 + 0.05, 18.4), p.P(nose, b1 - 0.05, 18.4), p.P(nose + 0.42, b1 - 0.05, 9.2), p.P(nose + 0.42, b0 + 0.05, 9.2)], '#2e3e48');
    fillPoly(p.c, [p.P(nose + 0.05, b0 + 0.12, 17.6), p.P(nose + 0.05, b0 + 0.3, 17.6), p.P(nose + 0.35, b0 + 0.3, 10), p.P(nose + 0.35, b0 + 0.12, 10)], '#8aa4ac');
    const F = front(p, b1 + 0.001);
    // the cab door and its window, the sliding side door, the name, a ladder on the roof rack
    pt(p, F, nose - 0.62, nose - 0.04, 11, 17.4, glassTex(F.light), F.light);
    pq(p, F, nose - 0.66, nose - 0.64, 3, 17.6, R[1]);
    // the sliding door's rear seam and its handle, on the body whatever the van's length
    const sd = Math.max(0.22, nose - 1.6);
    pq(p, F, sd, sd + 0.02, 3, 17.6, R[1]);
    pq(p, F, sd + 0.1, sd + 0.2, 9, 9.4, STEEL[4]);
    planeText(p.c, F, (nose - 0.7) / 2 + 0.05, 12, 'ALBION', R[0], 1);
    planeText(p.c, F, (nose - 0.7) / 2 + 0.05, 9.6, 'WORKS', R[1], 1);
    lbox(p, 0.2, b0 + 0.1, nose - 0.4, b1 - b0 - 0.2, 19, 0.5, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
    lbox(p, 0.3, b0 + 0.3, nose - 0.6, 0.2, 19.5, 0.8, mono(flat(['#8a6a3a', '#a07a46', '#b88c54', '#c89c62'], 2, 1, 3), '#5a4224'));
    for (const a of [0.55, W - 0.5]) {
      const [x, y] = p.P(a, b1, 3.2);
      wheel(p.c, x, y, 13);
    }
    const S = side(p, visA(p, 0.06, W - 0.08));
    for (const b of [b0 + 0.14, b1 - 0.14]) {
      const [x, y] = S.F(b, 6.6);
      px(p.c, x - 3, y - 2, '#fff2c0', 6, 3);
    }
    pq(p, S, b0 + 0.05, b1 - 0.05, 2.4, 3.6, '#2a2a30');
  },
};

const fac_parked: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.1, 0.12, W - 0.1, D - 0.12, 14, 0.32);
    const col = k.color ?? ['#c8382a', '#2a5aa8', '#d8d4c8', '#3a3a40', '#5a7a4a'][k.seed % 5];
    const r = ramp(col);
    const b0 = 0.16;
    const b1 = D - 0.16;
    // the body to the waist (0.85 m), the glasshouse to the roof (1.4 m), pillars, wheels
    lbox(p, 0.08, b0, W - 0.16, b1 - b0, 2.4, 6.2, { front: enamel(r, 0.04), side: enamel(r, 0.04), top: flat(r, 4, 3, 5), edge: r[0] });
    const g0 = 0.55;
    const g1 = W - 0.75;
    const zt = 13.8;
    // the windscreen and rear screen slope; the side windows between the pillars
    fillPoly(p.c, [p.P(g1, b0 + 0.06, zt), p.P(g1, b1 - 0.06, zt), p.P(g1 + 0.42, b1 - 0.06, 8.6), p.P(g1 + 0.42, b0 + 0.06, 8.6)], '#2e3e48');
    fillPoly(p.c, [p.P(g1 + 0.06, b0 + 0.14, zt - 0.6), p.P(g1 + 0.06, b0 + 0.34, zt - 0.6), p.P(g1 + 0.34, b0 + 0.34, 9.4), p.P(g1 + 0.34, b0 + 0.14, 9.4)], '#8aa4ac');
    lbox(p, g0, b0 + 0.04, g1 - g0, b1 - b0 - 0.08, 8.6, zt - 8.6, { front: (light) => (u, v) => (u % 34 < 3 || v > 18 ? at(r, light ? 3 : 2) : (u * 0.8 + v) % 26 < 4 ? '#9ab0b8' : light ? '#3a4a54' : '#2e3e48'), side: (light) => (u, v) => (v > 18 ? at(r, light ? 3 : 2) : (u * 0.8 + v) % 26 < 4 ? '#9ab0b8' : '#2e3e48'), top: flat(r, 4, 3, 5), edge: r[0] });
    fillPoly(p.c, [p.P(g0, b0 + 0.06, zt), p.P(g0, b1 - 0.06, zt), p.P(g0 - 0.3, b1 - 0.06, 8.6), p.P(g0 - 0.3, b0 + 0.06, 8.6)], r[2]);
    const S = side(p, visA(p, 0.08, W - 0.08));
    for (const b of [b0 + 0.12, b1 - 0.12]) {
      const [x, y] = S.F(b, 6);
      px(p.c, x - 3, y - 2, '#fff2c0', 6, 3);
    }
    pq(p, S, b0 + 0.04, b1 - 0.04, 2.4, 3.6, '#2a2a30');
    const F = front(p, b1 + 0.001);
    pq(p, F, 0.1, W - 0.1, 2.4, 3.2, '#2a2a30');
    pq(p, F, W * 0.42, W * 0.48, 6.8, 7.2, STEEL[5]);
    for (const a of [0.42, W - 0.48]) {
      const [x, y] = p.P(a, b1, 3);
      wheel(p.c, x, y, 12);
    }
  },
};

const fac_car: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.05, 0.1, W - 0.05, D - 0.1, 14, 0.3);
    const b0 = 0.16;
    const b1 = D - 0.16;
    const C: Ramp = ['#2a3a3a', '#34484a', '#40585a', '#4e6a6a', '#5e7c7a', '#709090'];
    const rusty: Mat = (light) => (u, v, x, y) => (hash(x >> 1, y >> 1, 4) < 0.22 || (v < 6 && hash(x, y, 5) < 0.6) ? at(RUST, light ? 3 : 2) : at(C, (light === 2 ? 4 : light ? 3 : 2) - (u % 60 < 1 ? 1 : 0)));
    // on bricks where its wheels were, the body sagging, the glass long gone
    for (const a of [0.45, W - 0.5]) for (const b of [b0 + 0.1, b1 - 0.1]) lbox(p, a - 0.12, b - 0.1, 0.24, 0.2, 0, 2.6, mono(brick(BRICK, { course: 3 }), BRICK[0]));
    lbox(p, 0.08, b0, W - 0.16, b1 - b0, 2.6, 5.8, mono(rusty, RUST[0]));
    lbox(p, 0.55, b0 + 0.05, W - 1.3, b1 - b0 - 0.1, 8.4, 5, { front: (light) => (u, v) => (v > 3 && v < 18 && u % 40 > 4 ? '#1a1c1e' : at(C, light ? 3 : 2)), side: (light) => (u, v) => (v > 3 && v < 18 && u > 6 ? '#1a1c1e' : at(C, light ? 2 : 1)), top: rusty, edge: C[0] });
    const S = side(p, visA(p, 0.55, W - 0.75));
    const [wx, wy] = S.F((b0 + b1) / 2, 11);
    for (let i = 0; i < 6; i++) ln(p.c, wx, wy, wx + Math.cos(i) * 9, wy + Math.sin(i) * 6, '#c8d8d8');
    // weeds and a buddleia sprig growing up through the bonnet
    const [bx, by] = p.P(W - 0.35, (b0 + b1) / 2, 8.4);
    layer(p.c, (l) => {
      for (let i = 0; i < 9; i++) ln(l, bx - 7 + i * 2, by, bx - 9 + i * 2.4, by - 12 - (i % 3) * 5, i % 2 ? WEED[3] : WEED[4]);
      px(l, bx - 3, by - 24, '#a266b0', 3, 6);
      px(l, bx + 4, by - 20, '#bf8ccb', 3, 5);
    }, { outline: 0.55, rect: [bx - 14, by - 30, bx + 14, by + 2] });
    void k;
  },
};

// ── the forklift ────────────────────────────────────────────
const fac_forklift: PropArt = {
  draw(p, k) {
    const D = k.d;
    footShadow(p, 0.1, 0.1, 0.9, D - 0.05, 22, 0.32);
    const Y = YELLOW;
    // counterweight and body at the back, the overhead guard (2.1 m), seat, steering wheel
    lbox(p, 0.14, 0.08, 0.72, 0.6, 1.6, 9.6, { front: enamel(Y, 0.15), side: enamel(Y, 0.15), top: flat(Y, 4, 3, 5), edge: Y[0] });
    lbox(p, 0.16, 0.66, 0.68, 0.6, 1.6, 5.4, { front: enamel(Y, 0.15), side: enamel(Y, 0.15), top: flat(IRON, 3, 2, 3), edge: Y[0] });
    const [sx, sy] = anchor(p, 0.5, 0.62, 7);
    layer(p.c, (l) => {
      px(l, sx - 7, sy - 14, '#2a2a30', 14, 14);
      px(l, sx - 7, sy - 5, '#3a3a42', 14, 5);
      px(l, sx - 6, sy - 13, '#44444c', 3, 8);
    }, { outline: 0.6, rect: [sx - 10, sy - 18, sx + 10, sy + 4] });
    const [wx, wy] = anchor(p, 0.5, 1.05, 10);
    ell(p.c, wx, wy - 2, 6, 2.5, '#1e1e22');
    ln(p.c, wx, wy, wx + 1, wy + 10, '#2a2a30', 2);
    for (const [a, b] of [[0.16, 0.12], [0.78, 0.12], [0.16, 1.18], [0.78, 1.18]] as const) lbox(p, a, b, 0.06, 0.06, 7, 14, mono(flat(IRON, 3, 2, 4), IRON[0]));
    lbox(p, 0.12, 0.08, 0.76, 1.18, 21, 0.5, mono((light) => (u, v) => ((u % 9 < 1.8 || v % 9 < 1.8) ? at(IRON, light === 2 ? 4 : 3) : 'rgba(0,0,0,0)'), IRON[0]));
    for (const [a, b, r] of [[0.85, 0.32, 9], [0.85, 1.08, 11]] as const) {
      const [x, y] = p.P(a, b, 2.4);
      wheel(p.c, x, y, r, '#c8b048');
    }
    // the mast at the front, the carriage, forks with a pallet of boxes lifted a little
    for (const a of [0.22, 0.7]) lbox(p, a, 1.24, 0.1, 0.08, 0.6, 22, mono(flat(IRON, 3, 2, 4), IRON[0]));
    lbox(p, 0.2, 1.3, 0.62, 0.06, 23, 0.8, mono(flat(IRON, 3, 2, 4), IRON[0]));
    const zf = 5;
    lbox(p, 0.2, 1.34, 0.62, 0.06, zf, 5, mono(flat(IRON, 3, 2, 4), IRON[0]));
    lbox(p, 0.1, 1.38, 0.8, D - 1.42, zf, 1.4, mono(planks(TIMBER, 3), TIMBER[0]));
    const kraft: Mat = (light) => (u, v, x, y) => at(['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70'], (light === 2 ? 3.4 : light ? 2.8 : 1.8) + (Math.abs(v - 14) < 1 ? 0.8 : 0) - (hash(x, y, 4) < 0.05 ? 0.8 : 0) - (u % 30 < 1 ? 0.6 : 0));
    lbox(p, 0.14, 1.42, 0.72, D - 1.52, zf + 1.4, 8, mono(kraft, '#4a3220'));
    // the amber beacon on the guard
    const [bx, by] = anchor(p, 0.2, 0.14, 21.5);
    px(p.c, bx - 3, by - 6, '#e8902a', 6, 6);
    px(p.c, bx - 2, by - 6, '#ffd070', 2, 3);
    void GLASS;
  },
};

export const FACTORY_VEHICLES: Record<string, PropArt> = { fac_lorry, fac_van, fac_parked, fac_car, fac_forklift, ...FACTORY_ROLLING };
export type { PropPainter };

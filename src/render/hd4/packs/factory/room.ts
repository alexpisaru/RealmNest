// Factory — the press shop's furniture at 128×64 (1 z ≈ 10 cm; a person is ~17.5 z).
// Riveted grey-green machines with yellow guards and red stops, an orange robot
// on its pedestal, a long belt conveyor with an inspection lamp, a grey control
// desk, a beech-topped workbench mid-repair, blue-and-orange pallet racking, a
// red snack machine, a water cooler, a bench knocked up from pallets, crates and
// drums — and the brick front walls of the shop, cut low.
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, type Plane, poly3, pq, pt, side } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { planeText } from './font';
import { at, BLUE, BLUEBRICK, brick, BRICK, brickCut, CREAM, enamel, hazard, HAZ_BLACK, IRON, massRect, MGREEN, OLDWOOD, ORANGE, planks, RED, riveted, RUST, STEEL, STONE, TIMBER, visA, WEED, YELLOW } from './palette';

const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const GREYB: Ramp = ['#2c3038', '#3a404a', '#4a525e', '#5c6672', '#717c88', '#8a96a0'];
const DIE: Ramp = ['#2e3036', '#40444c', '#555a62', '#6e737a', '#8c9196', '#b0b4b6'];

/** The visible side plane (shaded +x for rot 0, lit +y for rot 1). */
const vside = (p: PropPainter, a0: number, a1: number): Plane => side(p, visA(p, a0, a1));

/** A small red mushroom e-stop on a yellow collar at a screen point. */
function estop(c: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  layer(c, (l) => {
    ell(l, x, y + 1, 5 * s, 3 * s, YELLOW[3]);
    ell(l, x, y - 1, 4 * s, 3 * s, RED[2]);
    ell(l, x - 1, y - 2, 2.4 * s, 1.6 * s, RED[4]);
  }, { outline: 0.6, rect: [x - 7, y - 6, x + 7, y + 5] });
}

/** A yellow danger triangle sticker on a plane. */
function warnSticker(p: PropPainter, pl: Plane, u: number, z: number) {
  const [x, y] = pl.F(u, z);
  fillPoly(p.c, [[x, y - 5], [x + 5, y + 4], [x - 5, y + 4]], HAZ_BLACK);
  fillPoly(p.c, [[x, y - 3], [x + 3, y + 3], [x - 3, y + 3]], YELLOW[4]);
  px(p.c, x, y - 1, HAZ_BLACK, 1, 2);
  px(p.c, x, y + 2, HAZ_BLACK, 1, 1);
}

/** A light-curtain post: black, a yellow cap, a column of red emitter dots. */
function curtainPost(p: PropPainter, a: number, b: number, z1: number) {
  lbox(p, a - 0.04, b - 0.04, 0.08, 0.08, 0, z1, mono(flat(IRON, 2, 1, 3), IRON[0]));
  lbox(p, a - 0.05, b - 0.05, 0.1, 0.1, z1, 0.8, mono(flat(YELLOW, 4, 3, 5), YELLOW[0]));
  const F = front(p, b + 0.04);
  for (let z = 4; z < z1 - 1; z += 2.2) {
    const [x, y] = F.F(a, z);
    px(p.c, x, y, '#e2402e');
  }
}

// ── machines ────────────────────────────────────────────────
function press(p: PropPainter, k: PropCtx) {
  footShadow(p, 0.1, 0.15, 1.95, 1.95, 32, 0.32);
  const g = riveted(MGREEN, 34, 24, 0.25);
  const ge = enamel(MGREEN, 0.25);
  // the skid and the bed
  lbox(p, 0.15, 0.2, 1.7, 1.65, 0, 0.8, mono(flat(IRON, 2, 1, 3), IRON[0]));
  lbox(p, 0.3, 0.25, 1.4, 1.5, 0.8, 9.2, { front: g, side: g, top: ge, edge: MGREEN[0] });
  // bolster plate and the lower die on it
  lbox(p, 0.38, 0.8, 1.24, 0.9, 10, 1, mono(flat(DIE, 3, 2, 4), DIE[0]));
  lbox(p, 0.56, 0.98, 0.88, 0.56, 11, 1.4, { front: flat(DIE, 3, 2), side: flat(DIE, 3, 2), top: (light) => (u, v) => at(DIE, (light === 2 ? 4 : 3) - ((u + v) % 9 < 1 ? 1 : 0)), edge: DIE[0] });
  // a blank waiting on the die
  lbox(p, 0.72, 1.08, 0.5, 0.36, 12.4, 0.3, mono(flat(STEEL, 5, 4, 6), STEEL[2]));
  // the spine of the C and the crown over the gap
  lbox(p, 0.35, 0.25, 1.3, 0.6, 10, 16.5, { front: g, side: g, top: ge, edge: MGREEN[0] });
  // right cheek plate in a C profile, standing proud of the frame
  const ca = visA(p, 0.3, 1.7);
  const C = side(p, ca);
  poly3(p, [[ca, 0.25, 0.8], [ca, 1.7, 0.8], [ca, 1.7, 10.2], [ca, 0.9, 10.2], [ca, 0.9, 26], [ca, 1.66, 26], [ca, 1.66, 34], [ca, 0.25, 34]], (u: number, v: number, x: number, y: number) => at(MGREEN, (C.light ? 3 : 1.8) + ((u % 30 < 1 || v % 24 < 1) ? -1.2 : 0) - (hash(x, y, 4) < 0.03 ? 0.7 : 0)), C.light, [[ca, 0.25, 0.8], [ca, 1.7, 0.8], [ca, 0.25, 34]]);
  lbox(p, 0.3, 0.25, 1.4, 1.42, 26, 8, { front: g, side: g, top: ge, edge: MGREEN[0] });
  // the back of the gap lies in the crown's shadow; a shadow line under the crown's lip
  const Gb = front(p, 0.851);
  pq(p, Gb, 0.36, 1.64, 12.4, 26, MGREEN[1]);
  pq(p, Gb, 0.36, 1.64, 23.6, 26, MGREEN[0]);
  for (const a of [0.55, 1.45]) pq(p, Gb, a - 0.04, a + 0.04, 12.4, 26, DIE[3]);
  pq(p, front(p, 1.671), 0.3, 1.7, 25.4, 26.2, MGREEN[0]);
  // the flywheel on the side under a yellow half-guard, the motor and belt beneath it
  const S = vside(p, 0.3, 1.7);
  const [fx, fy] = S.F(0.62, 29.5);
  layer(p.c, (l) => {
    ell(l, fx, fy, 17, 19, IRON[2]);
    ell(l, fx - 1, fy - 1, 15, 17, IRON[3]);
    ell(l, fx, fy, 10, 11, IRON[1]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      ln(l, fx, fy, fx + Math.cos(a) * 13, fy + Math.sin(a) * 15, IRON[4], 2);
    }
    ell(l, fx, fy, 3, 3, STEEL[5]);
    // the guard over the top half
    for (let a = Math.PI; a < Math.PI * 2; a += 0.03) {
      px(l, fx + Math.cos(a) * 19, fy + Math.sin(a) * 21, YELLOW[3], 3, 3);
    }
  }, { outline: 0.6, rect: [fx - 24, fy - 26, fx + 24, fy + 44] });
  lbox(p, 0.5, 0.34, 0.66, 0.4, 34, 4.6, { front: (light) => (u, v) => at(BLUE, (light ? 3 : 2) - (u % 6 < 1.5 && v > 3 && v < 15 ? 1 : 0)), side: flat(BLUE, 3, 2), top: flat(BLUE, 4, 4), edge: BLUE[0] });
  lbox(p, 0.44, 0.3, 0.1, 0.48, 34, 5.2, mono(flat(BLUE, 2, 1, 3), BLUE[0]));
  const [px1, py1] = anchor(p, 1.2, 0.54, 36.4);
  ell(p.c, px1, py1, 4, 5, IRON[2]);
  ln(p.c, px1 + 2, py1 - 4, fx - 2, fy - 18, '#1e1e22', 2);
  ln(p.c, px1 + 3, py1 + 4, fx + 6, fy - 14, '#1e1e22', 2);
  // the crown front: a counter window, a plate, stickers
  const Fc = front(p, 1.67);
  pq(p, Fc, 0.45, 0.85, 30.2, 32.6, '#141418');
  pq(p, Fc, 1.05, 1.55, 29.4, 32.8, '#c8c2b0');
  planeText(p.c, Fc, 1.3, 31.1, '200T', '#2a2a2e', 1);
  warnSticker(p, Fc, 0.95, 27.6);
  // the yellow fixed guards either side of the die space with mesh
  const Fg = front(p, 1.72);
  for (const [a0, a1] of [[0.32, 0.54], [1.46, 1.68]] as const) {
    pq(p, Fg, a0, a1, 11, 26, YELLOW[Fg.light ? 3 : 2]);
    pt(p, Fg, a0 + 0.03, a1 - 0.03, 12, 25, (u: number, v: number) => ((u % 4 < 1 || v % 4 < 1) ? YELLOW[2] : '#2a282c'), Fg.light);
  }
  // hazard stripes on the bed's front edge
  pt(p, front(p, 1.751), 0.32, 1.68, 7.6, 9.6, hazard(6, 0.2), Fg.light);
  // light curtain posts and the two-hand station on its pedestal
  curtainPost(p, 0.24, 1.84, 22);
  lbox(p, 0.04, 1.62, 0.16, 0.16, 0, 9, mono(flat(STEEL, 3, 2, 4), STEEL[0]));
  lbox(p, -0.02, 1.56, 0.3, 0.3, 9, 2.2, mono(flat(YELLOW, 4, 3, 5), YELLOW[0]));
  const [sx, sy] = anchor(p, 0.13, 1.71, 11.2);
  px(p.c, sx - 6, sy - 2, '#3fae5a', 3, 2);
  px(p.c, sx + 3, sy - 4, '#3fae5a', 3, 2);
  estop(p.c, sx, sy - 6, 0.8);
  // a wire stillage of pressings at the back-left corner
  const [bx, by] = anchor(p, 0.12, 0.6, 0);
  layer(p.c, (l) => {
    px(l, bx - 8, by - 14, '#4a4e56', 16, 14);
    for (let i = 0; i < 6; i++) px(l, bx - 7 + i * 3, by - 14, '#7a7e86', 1, 14);
    for (let i = 0; i < 5; i++) ell(l, bx - 4 + (i % 3) * 4, by - 13 - Math.floor(i / 3) * 3, 3, 1.5, STEEL[5]);
  }, { outline: 0.6, rect: [bx - 12, by - 20, bx + 12, by + 2] });
  void k;
}

function cnc(p: PropPainter, k: PropCtx) {
  footShadow(p, 0.12, 0.25, 1.95, 1.9, 26, 0.3);
  const body = enamel(CREAM, 0.12);
  lbox(p, 0.2, 0.35, 1.6, 1.4, 0, 3, mono(flat(GREYB, 2, 1, 3), GREYB[0]));
  lbox(p, 0.2, 0.35, 1.6, 1.4, 3, 19.5, { front: body, side: body, top: flat(CREAM, 4, 3, 5), edge: CREAM[0] });
  lbox(p, 0.24, 0.39, 1.52, 1.32, 22.5, 1.6, mono(flat(GREYB, 3, 2, 4), GREYB[0]));
  const F = front(p, 1.751);
  const L = F.light;
  // the blue stripe and the maker's plate
  pq(p, F, 0.2, 1.8, 18.6, 20.4, BLUE[L ? 3 : 2]);
  planeText(p.c, F, 0.75, 19.5, 'ALBION', '#e8eef4', 1);
  // the sliding door: frame, the window into the cell
  pq(p, F, 0.3, 1.28, 4.5, 17.6, GREYB[L ? 3 : 2]);
  pq(p, F, 0.38, 1.2, 7.4, 16.6, '#141a1e');
  // inside: the spindle head coming down, the vice on the table, coolant splashes
  pq(p, F, 0.6, 0.98, 12.6, 16.6, GREYB[1]);
  pq(p, F, 0.72, 0.86, 10.4, 12.6, STEEL[3]);
  pq(p, F, 0.76, 0.82, 9.4, 10.4, STEEL[5]);
  pq(p, F, 0.5, 1.08, 7.6, 8.8, STEEL[2]);
  pq(p, F, 0.62, 0.96, 8.8, 9.4, BLUE[3]);
  // glass reflection over the window
  p.c.globalAlpha = 0.3;
  pt(p, F, 0.38, 1.2, 7.4, 16.6, (u: number, v: number) => ((u * 0.8 + v) % 36 < 6 ? '#e8f4f6' : null), L);
  p.c.globalAlpha = 1;
  const [hx, hy] = F.F(1.22, 11);
  px(p.c, hx - 1, hy - 14, STEEL[5], 2, 22);
  // oily handprints and a chip-strewn foot
  for (let i = 0; i < 5; i++) {
    const [x, y] = F.F(0.4 + hash(i, 1, k.seed) * 0.8, 4 + hash(i, 2, k.seed) * 4);
    px(p.c, x, y, '#6a6458', 2, 1);
  }
  // the control pendant on its arm at the front right
  lbox(p, 1.36, 1.62, 0.42, 0.14, 7.5, 12.5, mono(flat(GREYB, 3, 2, 4), GREYB[0]));
  const Pn = front(p, 1.761);
  pq(p, Pn, 1.4, 1.74, 15.2, 19.4, '#0e1418');
  for (let i = 0; i < 12; i++) {
    const [x, y] = Pn.F(1.42 + (i % 4) * 0.08, 13.6 - Math.floor(i / 4) * 1.3);
    px(p.c, x, y, i === 3 ? '#3fae5a' : '#c8ccd0', 2, 2);
  }
  const [ex, ey] = Pn.F(1.7, 9.4);
  estop(p.c, ex, ey, 0.7);
  // the chip conveyor out of the side and a swarf bin under its lip
  const S = vside(p, 0.2, 1.8);
  pq(p, S, 0.5, 1.1, 3, 9, GREYB[S.light ? 3 : 1]);
  lbox(p, p.rot === 0 ? 1.8 : 0.02, 0.6, 0.18, 0.55, 0, 5, { front: flat(GREYB, 2, 1), side: flat(GREYB, 2, 1), top: (light) => (_u, _v, x, y) => (hash(x, y, 9) < 0.6 ? at(STEEL, light ? 5 : 4) : at(RUST, 3)), edge: GREYB[0] });
  for (let i = 0; i < 3; i++) warnSticker(p, S, 0.65 + i * 0.3, 15);
  // the stack light on its pole at the back-right corner
  lbox(p, 1.64, 0.46, 0.06, 0.06, 24.1, 5, mono(flat(STEEL, 4, 3, 5), STEEL[0]));
  // on the roof: a vent grille, lifting eyes, an oil can and a rag
  const roofZ = 24.1;
  const vg = [anchor(p, 0.5, 0.7, roofZ), anchor(p, 1.1, 0.7, roofZ), anchor(p, 1.1, 1.2, roofZ), anchor(p, 0.5, 1.2, roofZ)];
  fillPoly(p.c, vg, GREYB[1]);
  for (let i = 1; i < 6; i++) {
    const [ax, ay] = anchor(p, 0.5 + i * 0.1, 0.72, roofZ);
    const [bx2, by2] = anchor(p, 0.5 + i * 0.1, 1.18, roofZ);
    ln(p.c, ax, ay, bx2, by2, GREYB[3]);
  }
  for (const [a, b] of [[0.32, 0.5], [1.68, 1.6]] as const) {
    const [ex2, ey2] = anchor(p, a, b, roofZ);
    ell(p.c, ex2, ey2 - 2, 3, 3, STEEL[4]);
    ell(p.c, ex2, ey2 - 2, 1.5, 1.5, GREYB[1]);
  }
  const [ox, oy] = anchor(p, 1.35, 1.25, roofZ);
  px(p.c, ox - 3, oy - 9, '#b8302a', 6, 9);
  px(p.c, ox - 3, oy - 9, '#d84a3a', 2, 9);
  ln(p.c, ox + 2, oy - 8, ox + 8, oy - 14, '#c8ccd0');
  fillPoly(p.c, [anchor(p, 0.4, 1.4, roofZ), anchor(p, 0.75, 1.32, roofZ), anchor(p, 0.8, 1.6, roofZ), anchor(p, 0.42, 1.62, roofZ)], '#4a6a9a');
}

function cncAnim(p: PropPainter, k: PropCtx) {
  const u = p.k / 4;
  // the stack light: green steady, amber blinking now and then
  const [x, y] = anchor(p, 1.67, 0.49, 29.1);
  const amber = Math.sin(k.t * 2.4 + k.seed) > 0.75;
  const seg = (dy: number, on: boolean, col: string, off: string) => {
    p.c.fillStyle = on ? col : off;
    p.c.fillRect(Math.round(x - 3 * u), Math.round(y - dy * u), Math.max(1, Math.round(6 * u)), Math.max(1, Math.round(4 * u)));
  };
  seg(4, true, '#5fe08a', '#2a5a3a');
  seg(8, amber, '#ffc040', '#6a4a1a');
  seg(12, false, '#ff5040', '#5a2a24');
  // the pendant screen: a scrolling program
  const F = front(p, 1.762);
  p.c.fillStyle = '#0e2a22';
  for (let i = 0; i < 4; i++) {
    const t = (k.t * 2 + i) % 4;
    const [lx, ly] = F.F(1.44, 18.6 - t * 0.8);
    p.c.fillStyle = i === 0 ? '#9af2c0' : '#4ac88a';
    p.c.fillRect(Math.round(lx), Math.round(ly), Math.max(1, Math.round((6 + (i * 5) % 9) * u)), Math.max(1, Math.round(u)));
  }
  // coolant spray and a spark at the tool inside the window
  const [sx, sy] = F.F(0.79, 9.1);
  for (let i = 0; i < 4; i++) {
    const t = (k.t * 3 + i / 4) % 1;
    p.c.fillStyle = i % 2 ? '#bfe8f2' : '#ffffff';
    p.c.fillRect(Math.round(sx + (i - 1.5) * 4 * u * t), Math.round(sy + t * 6 * u), Math.max(1, Math.round(u)), Math.max(1, Math.round(u)));
  }
}

function oven(p: PropPainter, k: PropCtx) {
  footShadow(p, 0.12, 0.25, 1.95, 1.9, 28, 0.3);
  const ALU: Ramp = ['#4e5256', '#686c70', '#84888a', '#a0a3a4', '#babcbc', '#d4d6d2'];
  const skin = riveted(ALU, 26, 20, 0.35);
  lbox(p, 0.15, 0.3, 1.7, 1.4, 0, 1.2, mono(flat(IRON, 2, 1, 3), IRON[0]));
  lbox(p, 0.15, 0.3, 1.7, 1.4, 1.2, 25, { front: skin, side: skin, top: flat(ALU, 4, 3, 5), edge: ALU[0] });
  const F = front(p, 1.701);
  const L = F.light;
  // the big door: quilted insulated panel, heavy latches, the glowing spy window
  pq(p, F, 0.26, 1.42, 2.2, 24.2, ALU[L ? 2 : 1]);
  pt(p, F, 0.3, 1.38, 2.6, 23.8, (u: number, v: number) => at(ALU, (L ? 3 : 2) + (((Math.floor(u / 10) + Math.floor(v / 10)) & 1) ? 0.6 : -0.3) + (u % 10 < 1 || v % 10 < 1 ? -1 : 0)), L);
  for (const z of [7, 18]) {
    const [lx, ly] = F.F(1.32, z);
    layer(p.c, (l) => {
      px(l, lx - 4, ly - 3, IRON[3], 8, 6);
      ln(l, lx - 2, ly, lx - 16, ly + 6, IRON[2], 3);
      ln(l, lx - 2, ly - 1, lx - 16, ly + 5, IRON[5], 1);
    }, { outline: 0.6, rect: [lx - 20, ly - 6, lx + 6, ly + 10] });
  }
  pq(p, F, 0.62, 1.02, 13.4, 17.4, IRON[1]);
  pq(p, F, 0.66, 0.98, 13.8, 17, '#5a2a10');
  // the control panel: a temperature controller, lamps, a chart recorder
  pq(p, F, 1.48, 1.82, 9, 22, GREYB[L ? 3 : 2]);
  pq(p, F, 1.52, 1.78, 18, 21, '#141418');
  pq(p, F, 1.52, 1.78, 11, 16.6, '#f2eee2');
  for (let i = 0; i < 10; i++) {
    const [x0, y0] = F.F(1.53 + i * 0.024, 13 + Math.sin(i * 1.3 + k.seed) * 1.6);
    px(p.c, x0, y0, '#3a5ac8');
  }
  for (const [i, c] of ['#3fae5a', '#e8b830', '#d8402e'].entries()) {
    const [x, y] = F.F(1.56 + i * 0.09, 10);
    px(p.c, x - 1, y - 1, c, 3, 2);
  }
  const S = vside(p, 0.15, 1.85);
  warnSticker(p, F, 0.42, 21.5);
  planeText(p.c, F, 0.84, 21.5, 'HOT', HAZ_BLACK, 1);
  pq(p, S, 0.4, 1.6, 6, 7, ALU[1]);
  for (let i = 0; i < 5; i++) pq(p, S, 0.5 + i * 0.22, 0.62 + i * 0.22, 9, 16, '#2a2c30');
  // on the roof: a louvred vent box, heat gloves, a probe thermometer
  lbox(p, 0.62, 0.42, 0.42, 0.42, 26.2, 2.4, { front: (light) => (_u, v) => at(ALU, (light ? 3 : 2) - (v % 3 < 1.2 ? 1.4 : 0)), side: (light) => (_u, v) => at(ALU, (light ? 3 : 1.6) - (v % 3 < 1.2 ? 1.2 : 0)), top: flat(ALU, 4, 3, 4), edge: ALU[0] });
  const [gx, gy] = anchor(p, 0.6, 1.35, 26.2);
  fillPoly(p.c, [[gx - 8, gy], [gx, gy - 4], [gx + 6, gy - 2], [gx - 2, gy + 2]], '#e8902a');
  fillPoly(p.c, [[gx - 4, gy + 3], [gx + 4, gy - 1], [gx + 9, gy + 1], [gx + 1, gy + 5]], '#d07a20');
  const [tx2, ty2] = anchor(p, 1.5, 1.3, 26.2);
  px(p.c, tx2 - 3, ty2 - 3, '#2a2a30', 6, 3);
  ln(p.c, tx2, ty2 - 3, tx2 - 4, ty2 - 12, '#c8ccd0');
  // the flue: up from the roof, a damper, an elbow, and away back to the wall
  // the flue: a stack rising from the back of the roof to the (cut-away) roof line, a
  // damper with its red handle, flanged joints, a conical rain cowl on three stays
  const fa = 1.5;
  const fb = 0.62;
  const zt = 44;
  const STK: Ramp = ['#3a3c40', '#4e5156', '#666a6e', '#808488', '#9ca0a2', '#bfc2c2', '#e2e4e2'];
  // its base collar on the roof, then the stack rising out of it
  lbox(p, fa - 0.2, fb - 0.2, 0.4, 0.4, 26.2, 0.8, mono(flat(ALU, 2, 1, 3), ALU[0]));
  const [, by] = anchor(p, fa, fb, 27);
  const [tx, ty] = anchor(p, fa, fb, zt);
  layer(p.c, (l) => {
    // a round galvanised stack: lit down its left, a bright streak, dark on the right
    const r = 12;
    for (let y = ty; y <= by; y++) {
      const z = 27 + ((by - y) / (by - ty)) * (zt - 27);
      const band = [28.6, 34.6, 40.6].some((f) => Math.abs(z - f) < 0.35);
      for (let i = -r; i <= r; i++) {
        const u = (i + r) / (2 * r);
        let t = u < 0.12 ? 3 : u < 0.3 ? 5 : u < 0.4 ? 6 : u < 0.62 ? 4 : u < 0.85 ? 2.6 : 1.4;
        if (band) t -= 1.5;
        px(l, tx + i, y, STK[Math.max(0, Math.min(6, Math.round(t)))]);
      }
    }
    // flanged joints: rings a little wider than the pipe
    for (const z of [28.6, 34.6, 40.6]) {
      const [fx, fy] = anchor(p, fa, fb, z);
      for (let i = -r - 2; i <= r + 2; i++) {
        const u = (i + r + 2) / (2 * r + 4);
        px(l, fx + i, fy - 1 + Math.round(Math.sqrt(Math.max(0, 1 - (i / (r + 2)) ** 2)) * 4), STK[u < 0.4 ? 5 : u < 0.7 ? 3 : 1], 1, 2);
      }
    }
    // the damper's red handle and a rain cowl on three stays
    const [dx, dy] = anchor(p, fa, fb, 31);
    px(l, dx + r - 1, dy - 1, RED[3], 9, 2);
    px(l, dx + r + 7, dy - 2, RED[4], 2, 3);
    for (const ox of [-8, 0, 8]) px(l, tx + ox, ty - 7, STK[2], 1, 7);
    fillPoly(l, [[tx - 18, ty - 6], [tx + 18, ty - 6], [tx, ty - 16]], STK[3]);
    fillPoly(l, [[tx - 18, ty - 6], [tx - 4, ty - 6], [tx, ty - 16]], STK[5]);
    px(l, tx - 18, ty - 6, STK[1], 36, 2);
    ell(l, tx, ty, r, 5, '#1e1e22');
  }, { outline: 0.6, rect: [tx - 24, ty - 20, tx + 24, by + 8] });
}

function ovenAnim(p: PropPainter, k: PropCtx) {
  const u = p.k / 4;
  const F = front(p, 1.702);
  // the spy window flickers orange
  const fl = 0.55 + 0.45 * Math.sin(k.t * 7 + Math.sin(k.t * 3.1) * 2);
  pq(p, F, 0.66, 0.98, 13.8, 17, fl > 0.6 ? '#e8902a' : '#c0601a');
  pq(p, F, 0.72, 0.92, 14.4, 16.2, fl > 0.6 ? '#ffd070' : '#f0a040');
  // the controller's red digits
  const [dx, dy] = F.F(1.54, 20.4);
  const n = String(180 + Math.round(Math.sin(k.t * 0.3 + k.seed) * 4));
  p.c.fillStyle = '#ff4a30';
  for (let i = 0; i < n.length; i++) {
    const d = +n[i];
    const seg = [d !== 1 && d !== 4, d !== 5 && d !== 6, d !== 2, d !== 1 && d !== 4 && d !== 7, d % 2 === 0 && d !== 4, d !== 1 && d !== 2 && d !== 3 && d !== 7, d > 1 && d !== 7];
    const ox = dx + i * 5 * u;
    const oy = dy + i * 2.5 * u * 0.5;
    const r = (sx: number, sy: number, sw: number, sh: number) => p.c.fillRect(Math.round(ox + sx * u), Math.round(oy + sy * u), Math.max(1, Math.round(sw * u)), Math.max(1, Math.round(sh * u)));
    if (seg[0]) r(0, 0, 3, 1);
    if (seg[1]) r(3, 0, 1, 3);
    if (seg[2]) r(3, 3, 1, 3);
    if (seg[3]) r(0, 6, 3, 1);
    if (seg[4]) r(-1, 3, 1, 3);
    if (seg[5]) r(-1, 0, 1, 3);
    if (seg[6]) r(0, 3, 3, 1);
  }
}

function pressAnim(p: PropPainter, k: PropCtx) {
  // the ram strokes down onto the die and back
  const ph = (k.t * 0.55 + k.seed * 0.37) % 1;
  const dz = ph < 0.18 ? (ph / 0.18) * 4.2 : ph < 0.3 ? 4.2 : ph < 0.6 ? 4.2 * (1 - (ph - 0.3) / 0.3) : 0;
  const zb = 17 - dz;
  const F = front(p, 1.55);
  const S = side(p, visA(p, 0.58, 1.42));
  pq(p, S, 0.95, 1.55, zb, 26, DIE[1]);
  pq(p, F, 0.58, 1.42, zb, 26, DIE[3]);
  pq(p, F, 0.58, 0.64, zb, 26, DIE[4]);
  pq(p, F, 0.62, 1.38, zb, zb + 1.6, DIE[1]);
  pq(p, F, 0.7, 1.3, zb + 4, zb + 4.4, DIE[2]);
  pq(p, F, 1.36, 1.42, zb, 26, DIE[1]);
  pq(p, F, 0.64, 1.36, zb + 1.6, zb + 2.1, DIE[5]);
  pq(p, F, 0.66, 0.7, zb + 6, 26, DIE[4]);
  // the beacon on the crown turns amber while the ram is down
  const [bx, by] = anchor(p, 0.5, 0.6, 34);
  const u = p.k / 4;
  p.c.fillStyle = dz > 0.5 ? '#ffb030' : '#6a4a1a';
  p.c.fillRect(Math.round(bx - 2 * u), Math.round(by - 5 * u), Math.max(1, Math.round(4 * u)), Math.max(1, Math.round(5 * u)));
}

const machine: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'press';
    if (v === 'cnc') cnc(p, k);
    else if (v === 'oven') oven(p, k);
    else press(p, k);
  },
  anim(p, k) {
    const v = k.variant ?? 'press';
    if (v === 'cnc') cncAnim(p, k);
    else if (v === 'oven') ovenAnim(p, k);
    else pressAnim(p, k);
  },
};

// ── the robot cell ──────────────────────────────────────────
const robotArm: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.2, 1.85, 1.85, 18, 0.28);
    // the floor plate with a hazard border, the pedestal
    lbox(p, 0.22, 0.22, 1.56, 1.56, 0, 0.5, { front: hazard(6, 0.2), side: hazard(6, 0.2), top: (light) => (u, v, x, y) => (u < 6 || v < 6 || u > 92 || v > 92 ? (Math.floor((u + v) / 6) & 1 ? HAZ_BLACK : YELLOW[4]) : at(STEEL, (light === 2 ? 4 : 3) - ((u + v * 2) % 10 < 1 ? 1 : 0) - (hash(x, y, 5) < 0.04 ? 1 : 0))), edge: IRON[0] });
    lbox(p, 0.66, 0.66, 0.68, 0.68, 0.5, 7.5, { front: enamel(GREYB, 0.2), side: enamel(GREYB, 0.2), top: flat(GREYB, 4, 3, 5), edge: GREYB[0] });
    for (const [a, b] of [[0.7, 1.34], [1.3, 1.34], [1.34, 0.7]] as const) {
      const [x, y] = anchor(p, a, b, 0.6);
      px(p.c, x - 1, y - 1, STEEL[5], 2, 2);
    }
    // the controller cabinet at the back corner, the teach pendant hung on it
    lbox(p, 0.04, 0.04, 0.5, 0.42, 0, 17, { front: enamel(GREYB, 0.1), side: enamel(GREYB, 0.1), top: flat(GREYB, 4, 3, 5), edge: GREYB[0] });
    const F = front(p, 0.461);
    pq(p, F, 0.08, 0.5, 1, 16, GREYB[F.light ? 3 : 2]);
    pq(p, F, 0.1, 0.48, 1.2, 15.8, GREYB[F.light ? 4 : 3]);
    const [hx, hy] = F.F(0.42, 11);
    px(p.c, hx - 2, hy - 5, RED[3], 4, 9);
    px(p.c, hx - 3, hy - 1, YELLOW[3], 6, 2);
    const [tx, ty] = F.F(0.2, 9);
    layer(p.c, (l) => {
      px(l, tx - 5, ty - 6, '#3a3e46', 10, 12);
      px(l, tx - 4, ty - 5, '#1e3a4a', 8, 6);
      estop(l, tx + 3, ty + 4, 0.5);
      curve(l, tx, ty + 6, tx - 6, ty + 30, tx + 10, ty + 34, '#1e1e22', 2);
    }, { outline: 0.6, rect: [tx - 12, ty - 10, tx + 14, ty + 38] });
    // the fixture table with a workpiece at the front-right
    lbox(p, 1.42, 1.38, 0.46, 0.44, 0, 8, { front: enamel(GREYB, 0.2), side: enamel(GREYB, 0.2), top: flat(STEEL, 5, 4, 5), edge: GREYB[0] });
    lbox(p, 1.52, 1.48, 0.26, 0.22, 8, 1.6, mono(flat(STEEL, 4, 3, 6), STEEL[1]));
    // light-curtain posts guarding the front
    curtainPost(p, 0.18, 1.9, 18);
    curtainPost(p, 1.92, 1.06, 18);
    // the robot's base: a turntable on the pedestal
    const [cx, cy] = anchor(p, 1, 1, 8);
    layer(p.c, (l) => {
      ell(l, cx, cy + 2, 22, 11, ORANGE[1]);
      for (let j = 0; j < 14; j++) ell(l, cx, cy - j, 21, 10, ORANGE[j > 11 ? 4 : 2]);
      ell(l, cx - 6, cy - 15, 9, 3, ORANGE[5]);
      px(l, cx + 10, cy - 8, '#1e1e22', 6, 4);
    }, { outline: 0.6, rect: [cx - 26, cy - 22, cx + 26, cy + 16] });
    void k;
  },
  anim(p, k) {
    // the arm working: base yaw, shoulder and elbow swinging in a slow cycle
    const u = p.k / 4;
    const t = k.t * 0.55 + k.seed;
    const yaw = Math.sin(t) * 0.65 + 0.75;
    const sh = 0.95 + Math.sin(t * 1.3 + 1) * 0.16;
    const el = -1.55 + Math.sin(t * 1.3) * 0.22;
    const base: [number, number, number] = [1, 1, 16.5];
    const dir = (len: number, ang: number) => [Math.cos(yaw) * Math.cos(ang) * len, Math.sin(yaw) * Math.cos(ang) * len, Math.sin(ang) * len * 16] as const;
    const d1 = dir(0.78, sh);
    const E: [number, number, number] = [base[0] + d1[0], base[1] + d1[1], base[2] + d1[2]];
    const d2 = dir(0.66, sh + el);
    const Wr: [number, number, number] = [E[0] + d2[0], E[1] + d2[1], E[2] + d2[2]];
    const P = (q: readonly [number, number, number]) => p.P(q[0], q[1], q[2]);
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      p.c.fillStyle = col;
      p.c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    };
    /** A thick arm segment: dark rim, body, a lit flank toward the sun, a shaded flank. */
    const seg = (a: readonly [number, number, number], b: readonly [number, number, number], w: number, r: Ramp) => {
      const [x0, y0] = P(a);
      const [x1, y1] = P(b);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const l = Math.hypot(dx, dy) || 1;
      let nx = (-dy / l) * w * u;
      let ny = (dx / l) * w * u;
      if (nx > 0) {
        nx = -nx;
        ny = -ny;
      }
      const o = 1 + 1.6 / Math.max(1, w);
      fillPoly(p.c, [[x0 + nx * o, y0 + ny * o], [x1 + nx * o, y1 + ny * o], [x1 - nx * o, y1 - ny * o], [x0 - nx * o, y0 - ny * o]], r[0]);
      fillPoly(p.c, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], r[3]);
      fillPoly(p.c, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 + nx * 0.2, y1 + ny * 0.2], [x0 + nx * 0.2, y0 + ny * 0.2]], r[4]);
      fillPoly(p.c, [[x0 + nx * 0.85, y0 + ny * 0.85], [x1 + nx * 0.85, y1 + ny * 0.85], [x1 + nx * 0.6, y1 + ny * 0.6], [x0 + nx * 0.6, y0 + ny * 0.6]], r[5]);
      fillPoly(p.c, [[x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 - nx * 0.55, y1 - ny * 0.55], [x0 - nx * 0.55, y0 - ny * 0.55]], r[2]);
    };
    const joint = (q: readonly [number, number, number], r: number, ramp: Ramp) => {
      const [x, y] = P(q);
      ell(p.c, x, y, (r + 1.5) * u, (r + 1.5) * u, ramp[0]);
      ell(p.c, x, y, r * u, r * u, ramp[3]);
      ell(p.c, x - r * 0.25 * u, y - r * 0.25 * u, r * 0.62 * u, r * 0.62 * u, ramp[4]);
      ell(p.c, x - r * 0.4 * u, y - r * 0.4 * u, r * 0.25 * u, r * 0.25 * u, ramp[5]);
    };
    // the shoulder housing on the turntable: a chunky orange block, its grey axis-2 motor
    const [bx, by] = P([1, 1, 9.5]);
    R(bx - 17 * u, by - 30 * u, 34 * u, 30 * u, ORANGE[0]);
    R(bx - 16 * u, by - 29 * u, 32 * u, 28 * u, ORANGE[3]);
    R(bx - 16 * u, by - 29 * u, 10 * u, 28 * u, ORANGE[4]);
    R(bx - 16 * u, by - 29 * u, 32 * u, 3 * u, ORANGE[5]);
    R(bx + 8 * u, by - 29 * u, 8 * u, 28 * u, ORANGE[2]);
    R(bx - 6 * u, by - 12 * u, 12 * u, 3 * u, '#1e1e22');
    // the counterbalance cylinder behind the lower arm
    const [cbx, cby] = P([1 - Math.cos(yaw) * 0.2, 1 - Math.sin(yaw) * 0.2, 13]);
    const [cex, cey] = P([base[0] + d1[0] * 0.55, base[1] + d1[1] * 0.55, base[2] + d1[2] * 0.55]);
    ln(p.c, cbx, cby, cex, cey, '#2a2a30', Math.max(1, Math.round(5 * u)));
    ln(p.c, cbx - u, cby - u, cex - u, cey - u, STEEL[5], Math.max(1, Math.round(u)));
    joint(base, 13, GREYB);
    seg(base, E, 11, ORANGE);
    // the cable dress along the arm
    const [ax, ay] = P(base);
    const [ex, ey] = P(E);
    const [wx, wy] = P(Wr);
    p.c.fillStyle = '#1e1e22';
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      p.c.fillRect(Math.round(ax + (ex - ax) * f + Math.sin(f * Math.PI) * 13 * u), Math.round(ay + (ey - ay) * f - 2 * u), Math.max(1, Math.round(3 * u)), Math.max(1, Math.round(3 * u)));
    }
    joint(E, 10, ORANGE);
    seg(E, Wr, 7.5, ORANGE);
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      p.c.fillRect(Math.round(ex + (wx - ex) * f), Math.round(ey + (wy - ey) * f - 9 * u + Math.sin(f * Math.PI) * -3 * u), Math.max(1, Math.round(2 * u)), Math.max(1, Math.round(2 * u)));
    }
    // the elbow motor cap, the wrist, the tool flange and the gripper with its part
    const [mx, my] = P(E);
    ell(p.c, mx + 3 * u, my - 2 * u, 6 * u, 6 * u, GREYB[1]);
    ell(p.c, mx + 2 * u, my - 3 * u, 4 * u, 4 * u, GREYB[3]);
    joint(Wr, 6.5, GREYB);
    R(wx - 5 * u, wy + 2 * u, 10 * u, 6 * u, STEEL[2]);
    R(wx - 5 * u, wy + 2 * u, 4 * u, 6 * u, STEEL[4]);
    R(wx - 7 * u, wy + 8 * u, 3 * u, 8 * u, STEEL[3]);
    R(wx + 4 * u, wy + 8 * u, 3 * u, 8 * u, STEEL[3]);
    R(wx - 4 * u, wy + 11 * u, 8 * u, 4 * u, STEEL[5]);
    R(wx - 4 * u, wy + 14 * u, 8 * u, 1 * u, STEEL[2]);
    // a status lamp on the shoulder
    const on = Math.sin(k.t * 4) > 0;
    R(bx + 9 * u, by - 26 * u, 4 * u, 4 * u, on ? '#6ac8ff' : '#2a4a6a');
  },
};

// ── the conveyor ────────────────────────────────────────────
const BELT_Z = 8.4;
const conveyor: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.2, W - 0.1, 0.9, 10, 0.26);
    const fr = enamel(GREYB, 0.25);
    // legs with cross braces and feet, every 1.6 tiles
    for (let a = 0.3; a < W - 0.1; a += 1.6) {
      for (const b of [0.2, 0.74]) lbox(p, a, b, 0.07, 0.07, 0, 7, mono(fr, GREYB[0]));
      const F = front(p, 0.81);
      const [x0, y0] = F.F(a + 0.03, 1.5);
      const [x1, y1] = p.P(a + 0.03, 0.24, 6);
      ln(p.c, x0, y0, x1, y1, GREYB[1]);
      lbox(p, a - 0.04, 0.16, 0.15, 0.7, 0, 0.3, mono(flat(IRON, 2, 1, 3), IRON[0]));
    }
    // the side channels and the belt's underside
    lbox(p, 0.05, 0.14, W - 0.1, 0.1, 6.4, 2.2, mono(fr, GREYB[0]));
    lbox(p, 0.3, 0.24, W - 0.6, 0.5, 7, 1.3, mono(flat(IRON, 1, 1, 1), IRON[0]));
    // the belt: dark rubber with cleats
    lbox(p, 0.12, 0.24, W - 0.24, 0.52, 8.1, 0.3, { front: flat(IRON, 2, 1), side: flat(IRON, 2, 1), top: (light) => (u, _v, x, y) => at(['#1c1c20', '#26262b', '#303036', '#3a3a41', '#46464e'], (light === 2 ? 2.6 : 2) + (u % 14 < 1.4 ? -1.4 : 0) + (hash(x, y, 7) < 0.05 ? 1 : 0)), edge: IRON[0] });
    // end drums
    for (const a of [0.12, W - 0.12]) {
      const [x, y] = anchor(p, a, 0.5, BELT_Z - 0.6);
      ell(p.c, x, y, 5, 6, STEEL[3]);
      ell(p.c, x - 1, y - 1, 3, 4, STEEL[5]);
    }
    // the drive at the right end: motor, gearbox, a yellow belt guard
    lbox(p, W - 1.0, 0.78, 0.7, 0.18, 1.2, 4.6, { front: enamel(BLUE, 0.1), side: enamel(BLUE, 0.1), top: flat(BLUE, 4, 3, 5), edge: BLUE[0] });
    lbox(p, W - 0.28, 0.7, 0.24, 0.28, 3.6, 4.4, mono(flat(YELLOW, 4, 3, 5), YELLOW[0]));
    const Fd = front(p, 0.961);
    for (let i = 0; i < 5; i++) pq(p, Fd, W - 0.95 + i * 0.12, W - 0.9 + i * 0.12, 2, 5.2, BLUE[1]);
    // the infeed hopper at the left end, its parts heaped
    lbox(p, 0.02, 0.18, 0.5, 0.64, 9.4, 4.6, { front: riveted(GREYB, 24, 20, 0.3), side: riveted(GREYB, 24, 20, 0.3), top: flat(GREYB, 1, 1, 1), edge: GREYB[0] });
    const [hx, hy] = anchor(p, 0.27, 0.5, 14);
    layer(p.c, (l) => {
      for (let i = 0; i < 14; i++) ell(l, hx - 10 + hash(i, 1, k.seed) * 20, hy - 1 - hash(i, 2, k.seed) * 4, 3, 1.6, STEEL[4 + (i % 2)]);
    }, { outline: 0.55, rect: [hx - 16, hy - 10, hx + 16, hy + 4] });
    // the inspection arch over the middle slot: two posts, a lamp hood, a magnifier
    const am = W / 2;
    for (const b of [0.12, 0.88]) lbox(p, am - 0.05, b - 0.04, 0.08, 0.08, 8.6, 9, mono(flat(YELLOW, 3, 2, 4), YELLOW[0]));
    lbox(p, am - 0.12, 0.06, 0.24, 0.88, 17.6, 1.2, mono(flat(YELLOW, 4, 3, 5), YELLOW[0]));
    const [lx, ly] = anchor(p, am, 0.5, 17.6);
    px(p.c, lx - 8, ly, '#fff2c0', 16, 2);
    // pull-cord switches along the front, a photo-eye, labels
    for (let a = 1.2; a < W - 1; a += 2.4) {
      const F = front(p, 0.86);
      pq(p, F, a - 0.08, a + 0.08, 6.6, 8.3, YELLOW[F.light ? 4 : 3]);
      const [x, y] = F.F(a, 7.4);
      px(p.c, x - 2, y - 1, RED[3], 4, 2);
    }
    // a tote of rejects at the far end, on the floor under the belt
    lbox(p, W - 2.0, 0.3, 0.5, 0.42, 0, 3.4, { front: flat(BLUE, 3, 2), side: flat(BLUE, 3, 2), top: (light) => (_u, _v, x, y) => (hash(x, y, 3) < 0.5 ? at(STEEL, light ? 4 : 3) : '#2a2a30'), edge: BLUE[0] });
  },
  anim(p, k) {
    const W = k.w;
    const u = p.k / 4;
    // cleats creeping along the belt
    const off = (k.t * 0.5) % 0.25;
    for (let a = 0.2 + off; a < W - 0.2; a += 0.25) {
      const [x0, y0] = p.P(a, 0.26, BELT_Z + 0.4);
      const [x1, y1] = p.P(a, 0.74, BELT_Z + 0.4);
      ln(p.c, x0, y0, x1, y1, '#18181c');
    }
    // parts riding the belt: boxes and castings
    for (let i = 0; i < 5; i++) {
      const f = (k.t * 0.05 + i / 5) % 1;
      const a = 0.6 + f * (W - 1.4);
      const box = i % 2 === 0;
      const h = box ? 2.6 : 1.4;
      const w = box ? 0.34 : 0.26;
      const T = (aa: number, bb: number, z: number) => p.P(aa, bb, z);
      const z = BELT_Z + 0.4;
      const col = box ? ['#8a6236', '#a87a46', '#c29458'] : ['#4a4e56', '#6e737a', '#9aa0a6'];
      const f0 = [T(a, 0.66, z), T(a + w, 0.66, z), T(a + w, 0.66, z + h), T(a, 0.66, z + h)] as [number, number][];
      const s0 = [T(a + w, 0.66, z), T(a + w, 0.34, z), T(a + w, 0.34, z + h), T(a + w, 0.66, z + h)] as [number, number][];
      const t0 = [T(a, 0.66, z + h), T(a + w, 0.66, z + h), T(a + w, 0.34, z + h), T(a, 0.34, z + h)] as [number, number][];
      fillPoly(p.c, s0, col[0]);
      fillPoly(p.c, f0, col[1]);
      fillPoly(p.c, t0, col[2]);
      if (box) {
        const [tx, ty] = T(a + w / 2, 0.5, z + h);
        p.c.fillStyle = '#d8c8a0';
        p.c.fillRect(Math.round(tx - 4 * u), Math.round(ty - u), Math.max(1, Math.round(8 * u)), Math.max(1, Math.round(2 * u)));
      }
    }
    // the front guide rail, in front of the parts
    const F = front(p, 0.8);
    pq(p, F, 0.1, W - 0.1, BELT_Z, BELT_Z + 1.3, GREYB[F.light ? 3 : 2]);
    pq(p, F, 0.1, W - 0.1, BELT_Z + 1, BELT_Z + 1.3, GREYB[F.light ? 5 : 4]);
  },
};

// ── the control desk ────────────────────────────────────────
const controlDesk: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.15, W - 0.1, 0.95, 14, 0.26);
    const body = enamel(GREYB, 0.15);
    lbox(p, 0.1, 0.2, W - 0.2, 0.58, 0, 9, { front: body, side: body, top: flat(GREYB, 4, 3, 5), edge: GREYB[0] });
    // the sloped panel: switches, lamps, a mimic of the line
    const lt = p.rot === 0 ? 1 : 0;
    poly3(p, [[0.12, 0.8, 9], [W - 0.12, 0.8, 9], [W - 0.12, 0.42, 13], [0.12, 0.42, 13]], (u: number, v: number) => at(GREYB, (lt ? 3.6 : 2.6) + (u % 50 < 1 ? -1 : 0) + (v < 2 ? 1 : 0)), 2);
    const sp = (a: number, f: number) => p.P(a, 0.8 - 0.38 * f, 9 + 4 * f);
    // the mimic: a line diagram with lamps
    const [m0x, m0y] = sp(0.25, 0.55);
    const [m1x, m1y] = sp(W - 0.6, 0.55);
    ln(p.c, m0x, m0y, m1x, m1y, '#e8e4d8');
    for (let i = 0; i < 6; i++) {
      const [x, y] = sp(0.3 + i * 0.22, 0.55);
      px(p.c, x - 1, y - 1, i % 3 === 1 ? '#e8b830' : '#3fae5a', 3, 3);
    }
    for (let i = 0; i < 8; i++) {
      const [x, y] = sp(0.25 + i * 0.17, 0.2);
      px(p.c, x - 1, y - 2, '#1e1e22', 3, 4);
      px(p.c, x, y - 2 - (i % 2 ? 1 : 0), '#c8ccd0', 1, 2);
    }
    const [ex, ey] = sp(W - 0.3, 0.4);
    estop(p.c, ex, ey, 1);
    // two monitors on top at the back
    for (const a0 of [0.2, W / 2 + 0.05]) {
      lbox(p, a0 + 0.3, 0.3, 0.12, 0.1, 13, 1.4, mono(flat(IRON, 2, 1, 3), IRON[0]));
      lbox(p, a0, 0.26, W / 2 - 0.25, 0.08, 14.2, 5.4, mono(flat(IRON, 2, 1, 3), IRON[0]));
    }
    // a phone, a clipboard with the shift log, a mug
    const [px0, py0] = anchor(p, 0.35, 0.5, 9);
    layer(p.c, (l) => {
      px(l, px0 - 6, py0 - 4, '#d8d4c8', 12, 5);
      px(l, px0 - 5, py0 - 7, '#e8e4d8', 10, 3);
      curve(l, px0 + 6, py0 - 2, px0 + 10, py0 + 6, px0 + 4, py0 + 8, '#2a2a2e');
    }, { outline: 0.55, rect: [px0 - 10, py0 - 10, px0 + 14, py0 + 10] });
    const [mx, my] = anchor(p, W - 0.25, 0.4, 9);
    px(p.c, mx - 3, my - 7, '#c8382a', 6, 7);
    px(p.c, mx - 3, my - 7, '#e85a4a', 2, 7);
    px(p.c, mx + 3, my - 6, '#a82a20', 2, 4);
    // the operator's stool pushed aside
    const [sx, sy] = anchor(p, W - 0.25, 0.92, 0);
    layer(p.c, (l) => {
      for (const dx of [-6, 6]) ln(l, sx + dx, sy, sx + dx * 0.4, sy - 18, STEEL[3], 2);
      ln(l, sx, sy + 2, sx, sy - 18, STEEL[2], 2);
      ell(l, sx, sy - 20, 9, 4, '#2a2c32');
      ell(l, sx - 1, sy - 21, 7, 3, '#44464e');
    }, { outline: 0.6, rect: [sx - 12, sy - 26, sx + 12, sy + 4] });
    void k;
  },
  anim(p, k) {
    const W = k.w;
    const u = p.k / 4;
    // the screens: a trend line and a mimic of the press line
    for (const [i, a0] of [0.2, W / 2 + 0.05].entries()) {
      const F = front(p, 0.341);
      const a1 = a0 + W / 2 - 0.25;
      pq(p, F, a0 + 0.04, a1 - 0.04, 14.8, 19.2, i ? '#0e1e2a' : '#101a14');
      if (i === 0) {
        let prev: [number, number] | null = null;
        for (let j = 0; j <= 10; j++) {
          const a = a0 + 0.08 + (j / 10) * (a1 - a0 - 0.16);
          const z = 16.8 + Math.sin(j * 0.9 + k.t * 1.2 + k.seed) * 1.2;
          const q = F.F(a, z);
          if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#5fe08a');
          prev = q;
        }
      } else {
        for (let j = 0; j < 4; j++) {
          const a = a0 + 0.14 + j * ((a1 - a0 - 0.28) / 3);
          const on = Math.sin(k.t * 2 + j) > -0.3;
          const [x, y] = F.F(a, 17);
          p.c.fillStyle = on ? '#6ac8ff' : '#2a4a6a';
          p.c.fillRect(Math.round(x - 3 * u), Math.round(y - 2 * u), Math.max(1, Math.round(6 * u)), Math.max(1, Math.round(4 * u)));
        }
        const [x0, y0] = F.F(a0 + 0.1, 15.8);
        const [x1, y1] = F.F(a1 - 0.1, 15.8);
        ln(p.c, x0, y0, x1, y1, '#3a8ac8');
      }
    }
  },
};

// ── the workbench, mid-repair ───────────────────────────────
const BEECH: Ramp = ['#6a4a2a', '#86603a', '#a27a4c', '#ba9260', '#cea874', '#dfbe8e'];
const workbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.15, W - 0.05, 0.95, 12, 0.26);
    const fr = enamel(GREYB, 0.3);
    // steel legs and a low shelf
    for (const a of [0.12, W - 0.2]) for (const b of [0.18, 0.82]) lbox(p, a, b, 0.07, 0.07, 0, 8.4, mono(fr, GREYB[0]));
    lbox(p, 0.12, 0.18, W - 0.24, 0.7, 1.6, 0.4, mono(flat(GREYB, 3, 2, 4), GREYB[0]));
    // the red tool chest under the right end
    lbox(p, W - 0.85, 0.24, 0.65, 0.6, 0.4, 7.6, { front: enamel(RED, 0.15), side: enamel(RED, 0.15), top: flat(RED, 4, 3, 5), edge: RED[0] });
    const Fd = front(p, 0.841);
    for (let i = 0; i < 4; i++) {
      pq(p, Fd, W - 0.82, W - 0.23, 1 + i * 1.7, 2.5 + i * 1.7, RED[Fd.light ? 3 : 2]);
      pq(p, Fd, W - 0.62, W - 0.43, 2 + i * 1.7, 2.3 + i * 1.7, STEEL[5]);
    }
    // a toolbox and a coil of wire on the shelf
    lbox(p, 0.3, 0.3, 0.42, 0.3, 2, 2.4, { front: flat(BLUE, 3, 2), side: flat(BLUE, 3, 2), top: flat(BLUE, 4, 4), edge: BLUE[0] });
    const [cx, cy] = anchor(p, 0.95, 0.6, 2);
    ell(p.c, cx, cy - 2, 8, 4, '#b8742a');
    ell(p.c, cx, cy - 2, 4, 2, '#3a3a40');
    // the beech top
    const top = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => at(BEECH, (light === 2 ? 4 : light ? 3 : 2) + (v % 10 < 1 ? -1 : 0) + (hash(x, y, 4) < 0.04 ? -1 : 0) + (hash(Math.floor(u / 30), Math.floor(v / 10), 5) - 0.5) * 0.8);
    lbox(p, 0.06, 0.1, W - 0.12, 0.84, 8.4, 0.9, { front: top, side: top, top, edge: BEECH[0] });
    const z = 9.3;
    // the back panel: steel with louvres, a shelf of tins, a strip light under its hood
    lbox(p, 0.08, 0.06, W - 0.16, 0.06, z, 10, { front: (light) => (u, v) => at(GREYB, (light ? 3 : 2) - ((u % 6 < 1.2 && v % 8 < 4) ? 1 : 0)), side: fr, top: flat(GREYB, 4, 3, 5), edge: GREYB[0] });
    lbox(p, 0.08, 0.06, W - 0.16, 0.26, z + 6, 0.4, mono(flat(GREYB, 4, 3, 5), GREYB[0]));
    for (let i = 0; i < 6; i++) {
      const [tx, ty] = anchor(p, 0.25 + i * 0.28, 0.2, z + 6.4);
      const c = ['#c8382a', '#3a7ac8', '#e8b830', '#3fae5a', '#8a8e96', '#e8e4d8'][i];
      px(p.c, tx - 3, ty - 7, c, 6, 7);
      px(p.c, tx - 3, ty - 7, lighten(c, 0.25), 2, 7);
      px(p.c, tx - 3, ty - 8, '#c8ccd0', 6, 1);
    }
    lbox(p, 0.1, 0.06, W - 0.2, 0.3, z + 9.6, 0.5, mono(flat(GREYB, 3, 2, 4), GREYB[0]));
    // the vice at the front-left corner, a casting clamped in it
    lbox(p, 0.14, 0.62, 0.34, 0.24, z, 1.8, mono(enamel(BLUE, 0.2), BLUE[0]));
    lbox(p, 0.2, 0.66, 0.22, 0.16, z + 1.8, 1, mono(flat(STEEL, 4, 3, 5), STEEL[0]));
    const [vx, vy] = anchor(p, 0.31, 0.95, z + 0.8);
    ln(p.c, vx - 8, vy + 2, vx + 6, vy - 3, STEEL[5], 2);
    // a gearbox with its cover off: gears showing, bolts in a tray
    const [gx, gy] = anchor(p, 1.05, 0.5, z);
    layer(p.c, (l) => {
      px(l, gx - 14, gy - 12, '#4a5a4e', 20, 12);
      px(l, gx - 14, gy - 12, '#5e7262', 20, 2);
      ell(l, gx - 6, gy - 13, 6, 3, '#9a8a5a');
      ell(l, gx + 2, gy - 12, 4, 2, '#b8a46a');
      for (let i = 0; i < 8; i++) px(l, gx - 6 + Math.cos(i * 0.8) * 6, gy - 13 + Math.sin(i * 0.8) * 3, '#6a5a3a');
      // its cover set aside, the bolts in a lid
      ell(l, gx + 14, gy - 2, 7, 3, '#4a5a4e');
      ell(l, gx + 14, gy - 3, 5, 2, '#3a4a3e');
      for (let i = 0; i < 4; i++) px(l, gx + 11 + i * 2, gy - 3, STEEL[5]);
    }, { outline: 0.6, rect: [gx - 18, gy - 18, gx + 24, gy + 4] });
    // a hammer, a spanner, a rag, a mug of tea, the manual open
    const [hx, hy] = anchor(p, 0.6, 0.75, z);
    ln(p.c, hx - 10, hy + 2, hx + 4, hy - 4, '#8a5a30', 2);
    px(p.c, hx + 3, hy - 7, STEEL[3], 5, 4);
    ln(p.c, hx + 10, hy, hx + 22, hy - 5, STEEL[4], 2);
    const [rx, ry] = anchor(p, W - 0.55, 0.7, z);
    fillPoly(p.c, [[rx - 6, ry], [rx + 2, ry - 4], [rx + 8, ry - 1], [rx, ry + 3]], '#c86a3a');
    const [mx, my] = anchor(p, W - 0.25, 0.4, z);
    px(p.c, mx - 3, my - 7, '#f2eee2', 6, 7);
    px(p.c, mx - 2, my - 7, '#6a3a1a', 4, 1);
    px(p.c, mx + 3, my - 6, '#d8d4c8', 2, 4);
    const [bx, by] = anchor(p, W - 0.75, 0.35, z);
    fillPoly(p.c, [[bx - 10, by], [bx, by - 5], [bx + 10, by], [bx, by + 5]], '#f2eee2');
    ln(p.c, bx, by - 5, bx, by + 5, '#b8b4a8');
    for (let i = 0; i < 3; i++) ln(p.c, bx - 8 + i * 2, by - 1 + i, bx - 2 + i * 2, by - 4 + i, '#8a8a8e');
    // a lamp on an arm clamped to the back panel
    const [lx, ly] = anchor(p, 0.3, 0.1, z + 10);
    layer(p.c, (l) => {
      ln(l, lx, ly, lx + 10, ly - 10, GREYB[2], 2);
      ln(l, lx + 10, ly - 10, lx + 22, ly - 2, GREYB[2], 2);
      fillPoly(l, [[lx + 18, ly - 6], [lx + 28, ly - 2], [lx + 24, ly + 4], [lx + 16, ly]], '#2e4a3a');
      px(l, lx + 19, ly + 1, '#fff2c0', 4, 2);
    }, { outline: 0.6, rect: [lx - 4, ly - 14, lx + 32, ly + 8] });
    void k;
  },
};

// ── pallet racking ──────────────────────────────────────────
const rack: PropArt = {
  draw(p, k) {
    const W = k.w;
    const H = 23;
    footShadow(p, 0.05, 0.05, W - 0.05, 0.98, 20, 0.26);
    const up = enamel(BLUE, 0.1);
    const beam = flat(ORANGE, 4, 3, 5);
    const levels = [0.4, 8.2, 15.8];
    const ups = [0.04, W / 2 - 0.04, W - 0.12];
    const Rn = rng(k.seed * 11 + 4);
    // back uprights, then the loads level by level, then the front uprights and beams
    for (const a of ups) lbox(p, a, 0.06, 0.08, 0.08, 0, H, mono(up, BLUE[0]));
    for (const z of levels) {
      lbox(p, 0.04, 0.06, W - 0.08, 0.08, z, 1, mono(beam, ORANGE[0]));
      // decking: wire mesh panels
      lbox(p, 0.08, 0.1, W - 0.16, 0.82, z + 0.9, 0.15, { front: flat(STEEL, 3, 2), side: flat(STEEL, 3, 2), top: (light) => (u, v) => ((u % 5 < 1 || v % 5 < 1) ? at(STEEL, light ? 5 : 4) : '#2a2a30'), edge: STEEL[0] });
      // the loads on this level, one bay at a time
      for (let bay = 0; bay < 2; bay++) {
        const a0 = 0.16 + bay * (W / 2);
        const a1 = a0 + W / 2 - 0.3;
        const r = Rn();
        const zb = z + 1.05;
        if (r < 0.35) {
          // cardboard boxes stacked, labels and tape
          let a = a0;
          while (a < a1 - 0.25) {
            const w = 0.3 + Rn() * 0.25;
            const h = 2.4 + Rn() * 2.4;
            const kraft: Mat = (light) => (u, v, x, y) => at(['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70'], (light === 2 ? 3.4 : light ? 2.8 : 1.8) + (Math.abs(v - 10) < 1 ? 0.8 : 0) - (hash(x, y, 4) < 0.05 ? 0.8 : 0) - (u % 40 < 1 ? 0.6 : 0));
            lbox(p, a, 0.24, Math.min(w, a1 - a), 0.6, zb, h, mono(kraft, '#4a3220'));
            const F = front(p, 0.84);
            pq(p, F, a + 0.06, a + 0.18, zb + h * 0.4, zb + h * 0.4 + 1.2, '#f2eee2');
            a += w + 0.03;
          }
        } else if (r < 0.6) {
          // blue plastic bins with parts
          for (let a = a0; a < a1 - 0.2; a += 0.34) {
            lbox(p, a, 0.3, 0.3, 0.55, zb, 2.2, { front: (light) => (u, v) => at(BLUE, (light ? 3 : 2) + (v > 6 ? 0.8 : 0) - (u < 2 ? 0.6 : 0)), side: flat(BLUE, 3, 2), top: (light) => (_u, _v, x, y) => (hash(x, y, 8) < 0.6 ? at(STEEL, light === 2 ? 5 : 4) : '#26262c'), edge: BLUE[0] });
            const F = front(p, 0.85);
            pq(p, F, a + 0.05, a + 0.2, zb + 0.8, zb + 1.6, '#f2eee2');
          }
        } else if (r < 0.82) {
          // a pallet with a shrink-wrapped load
          lbox(p, a0, 0.2, a1 - a0, 0.66, zb, 1, mono(planks(TIMBER, 4), TIMBER[0]));
          const wrap: Mat = (light) => (u, v, x, y) => (((u * 0.6 + v) % 30 < 3) ? '#e8eef0' : at(['#5a6a7a', '#6e7e8e', '#8494a2', '#9aa8b4', '#b4c0ca'], (light === 2 ? 3.4 : light ? 2.6 : 1.6) - (hash(x, y, 5) < 0.04 ? 1 : 0)));
          lbox(p, a0 + 0.04, 0.24, a1 - a0 - 0.08, 0.58, zb + 1, 4.4, mono(wrap, '#3a4a5a'));
        } else {
          // steel bar stock lying along the bay
          for (let i = 0; i < 6; i++) {
            const b = 0.3 + (i % 3) * 0.17;
            const zz = zb + Math.floor(i / 3) * 0.8;
            lbox(p, a0, b, a1 - a0, 0.14, zz, 0.7, { front: (light) => (_u, v) => at(STEEL, (light ? 4 : 3) + (v > 1.5 ? 1 : 0)), side: (light) => () => at(RUST, light ? 3 : 2), top: flat(STEEL, 5, 4, 6), edge: STEEL[1] });
          }
        }
      }
    }
    // front frames: uprights with base plates and bracing on the end, beams with location labels
    for (const a of ups) {
      lbox(p, a, 0.86, 0.08, 0.08, 0, H, mono(up, BLUE[0]));
      lbox(p, a - 0.02, 0.84, 0.12, 0.12, 0, 0.3, mono(flat(IRON, 2, 1, 3), IRON[0]));
    }
    // the end frame's bracing
    const E = side(p, visA(p, 0.04, W - 0.04));
    for (let z = 1; z < H - 3; z += 5) {
      const [x0, y0] = E.F(0.12, z);
      const [x1, y1] = E.F(0.86, z + 5);
      ln(p.c, x0, y0, x1, y1, BLUE[2]);
    }
    for (const [li, z] of levels.entries()) {
      lbox(p, 0.04, 0.86, W - 0.08, 0.08, z, 1, mono(beam, ORANGE[0]));
      const F = front(p, 0.941);
      for (let bay = 0; bay < 2; bay++) {
        const a = 0.4 + bay * (W / 2);
        pq(p, F, a, a + 0.32, z + 0.15, z + 0.85, '#f2eee2');
        planeText(p.c, F, a + 0.16, z + 0.5, 'A' + (li * 2 + bay + 1), '#1e1e22', 1);
      }
    }
    // the load notice on the end
    const N = side(p, visA(p, -0.001, W + 0.001));
    pq(p, N, 0.2, 0.75, 9.5, 14, '#f2eee2');
    pq(p, N, 0.2, 0.75, 13, 14, RED[3]);
    planeText(p.c, N, 0.47, 11.2, '1000KG', '#2a2a2e', 1);
  },
};

// ── the break corner ────────────────────────────────────────
const vending: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 18, 0.28);
    const col = k.color ?? '#b8302a';
    const r: Ramp = [darken(col, 0.55), darken(col, 0.38), darken(col, 0.2), col, lighten(col, 0.15), lighten(col, 0.3)];
    lbox(p, 0.12, 0.14, 0.76, 0.66, 0, 19.5, { front: enamel(r, 0.08), side: enamel(r, 0.08), top: flat(r, 4, 3, 5), edge: r[0] });
    const F = front(p, 0.801);
    const L = F.light;
    // the window: rows of snacks on spirals, a pale light inside
    pq(p, F, 0.16, 0.6, 5.6, 17.4, '#202428');
    pq(p, F, 0.18, 0.58, 5.9, 17.1, '#3a4448');
    const snacks = ['#e8b830', '#c8382a', '#3a7ac8', '#3fae5a', '#e87a2a', '#8a3a9a', '#f2eee2'];
    for (let row = 0; row < 5; row++) {
      const z = 6.6 + row * 2.1;
      pq(p, F, 0.19, 0.57, z - 0.3, z - 0.1, '#8a9096');
      for (let i = 0; i < 4; i++) {
        const c = snacks[Math.floor(hash(row, i, k.seed) * snacks.length)];
        pq(p, F, 0.2 + i * 0.095, 0.27 + i * 0.095, z, z + 1.5, c);
        pq(p, F, 0.2 + i * 0.095, 0.22 + i * 0.095, z, z + 1.5, lighten(c, 0.3));
      }
    }
    p.c.globalAlpha = 0.3;
    pt(p, F, 0.18, 0.58, 5.9, 17.1, (u: number, v: number) => ((u * 0.7 + v) % 40 < 7 ? '#ffffff' : null), L);
    p.c.globalAlpha = 1;
    // the keypad column, coin slot, the delivery flap, the header
    pq(p, F, 0.63, 0.84, 9, 16, r[L ? 2 : 1]);
    pq(p, F, 0.66, 0.81, 14, 15.4, '#101418');
    for (let i = 0; i < 9; i++) {
      const [x, y] = F.F(0.67 + (i % 3) * 0.05, 13 - Math.floor(i / 3) * 0.9);
      px(p.c, x, y, '#c8ccd0', 2, 1);
    }
    const [cx, cy] = F.F(0.74, 10);
    px(p.c, cx - 1, cy - 2, '#1a1a1e', 2, 4);
    pq(p, F, 0.2, 0.56, 1.6, 4.4, '#141418');
    pq(p, F, 0.22, 0.54, 1.8, 2.8, r[1]);
    pq(p, F, 0.14, 0.86, 17.8, 19.4, '#f2eee2');
    planeText(p.c, F, 0.5, 18.6, 'SNACKS', col, 1);
    // a sticker on the side and a bin beside it
    const S = vside(p, 0.12, 0.88);
    pq(p, S, 0.25, 0.65, 8, 15, r[S.light ? 4 : 2]);
    planeText(p.c, S, 0.45, 11.5, 'COLD', '#f6f2e8', 1);
  },
  anim(p, k) {
    // the display ticks over a price
    const F = front(p, 0.802);
    const on = Math.sin(k.t * 1.5 + k.seed) > -0.6;
    pq(p, F, 0.67, 0.8, 14.3, 15.1, on ? '#6af28a' : '#1e3a24');
  },
};

const watercooler: PropArt = {
  draw(p, k) {
    footShadow(p, 0.25, 0.25, 0.75, 0.75, 14, 0.26);
    const W: Ramp = ['#7a7c80', '#9a9ca0', '#b8babc', '#d2d4d4', '#e6e6e4', '#f6f6f2'];
    lbox(p, 0.3, 0.3, 0.42, 0.42, 0, 10.5, { front: enamel(W, 0.05), side: enamel(W, 0.05), top: flat(W, 4, 3, 5), edge: W[0] });
    const F = front(p, 0.721);
    pq(p, F, 0.36, 0.66, 6.6, 9.2, '#c8cccc');
    for (const [a, c] of [[0.44, '#3a7ac8'], [0.58, '#d8402e']] as const) {
      const [x, y] = F.F(a, 8.6);
      px(p.c, x - 1, y - 2, c, 3, 3);
      px(p.c, x, y + 1, '#c8ccd0', 1, 2);
    }
    pq(p, F, 0.38, 0.64, 5.2, 5.8, '#7a7e84');
    // the bottle: translucent blue, a level line, highlights
    const [bx, by] = anchor(p, 0.51, 0.51, 10.5);
    layer(p.c, (l) => {
      for (let j = 0; j < 26; j++) {
        const w = j < 3 ? 4 : j > 20 ? 11 - (j - 20) * 1.2 : 11;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          const water = j < 18;
          px(l, bx + i, by - j, water ? (t < 0.25 ? '#a8d8f2' : t < 0.6 ? '#78b8e2' : '#5a98c8') : t < 0.3 ? '#d8eef8' : '#b8daf0');
        }
      }
      px(l, bx - 8, by - 22, '#ffffff', 2, 16);
      px(l, bx - 11, by - 18, '#5a98c8', 22, 1);
    }, { outline: 0.55, rect: [bx - 14, by - 30, bx + 14, by + 2] });
    // a cup dispenser on the side, a pedal bin
    const S = vside(p, 0.3, 0.72);
    pq(p, S, 0.36, 0.48, 4, 10, '#d8dcdc');
    pq(p, S, 0.37, 0.47, 3, 4, '#f6f6f2');
    const [tx, ty] = anchor(p, 0.18, 0.82, 0);
    layer(p.c, (l) => {
      px(l, tx - 4, ty - 9, '#5a5e66', 8, 9);
      px(l, tx - 4, ty - 9, '#7a7e86', 2, 9);
      px(l, tx - 5, ty - 10, '#8a8e96', 10, 2);
      px(l, tx - 2, ty - 13, '#f2eee2', 4, 3);
    }, { outline: 0.6, rect: [tx - 8, ty - 16, tx + 8, ty + 2] });
    void k;
  },
};

/** A bench knocked up from pallets: two pallets for a seat, one on edge for a back, old cushions. */
const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.08, 0.18, W - 0.08, 0.92, 8, 0.26);
    const wood = planks(TIMBER, 5);
    const pallet = (a0: number, a1: number, z: number) => {
      // deck boards on three stringers
      for (const b of [0.22, 0.48, 0.74]) lbox(p, a0 + 0.04, b, a1 - a0 - 0.08, 0.1, z, 0.9, mono(wood, TIMBER[0]));
      for (let a = a0; a < a1 - 0.05; a += (a1 - a0) / 6) lbox(p, a, 0.18, (a1 - a0) / 6 - 0.04, 0.68, z + 0.9, 0.5, mono(wood, TIMBER[0]));
    };
    const half = W / 2;
    pallet(0.08, half, 0);
    pallet(half, W - 0.08, 0);
    pallet(0.08, half, 1.4);
    pallet(half, W - 0.08, 1.4);
    // the backrest: a pallet on its edge, boards vertical
    for (let a = 0.12; a < W - 0.12; a += 0.22) lbox(p, a, 0.12, 0.16, 0.06, 2.8, 8.6, mono(planks(OLDWOOD, 6), OLDWOOD[0]));
    lbox(p, 0.08, 0.1, W - 0.16, 0.1, 9.6, 0.7, mono(wood, TIMBER[0]));
    // cushions: faded, mismatched
    const cols = ['#3e6a8a', '#8a5a3a', '#5a7a4a'];
    for (let i = 0; i < 3; i++) {
      const a0 = 0.2 + i * ((W - 0.4) / 3);
      const c = cols[(i + k.seed) % 3];
      const r: Ramp = [darken(c, 0.5), darken(c, 0.32), darken(c, 0.15), c, lighten(c, 0.15), lighten(c, 0.28)];
      lbox(p, a0 + 0.03, 0.26, (W - 0.4) / 3 - 0.06, 0.6, 2.8, 1.4, { front: flat(r, 3, 2), side: flat(r, 3, 2), top: (light) => (u, v) => at(r, (light === 2 ? 4 : 3) - (Math.abs(u - 30) < 1.5 || Math.abs(v - 20) < 1.5 ? 1 : 0)), edge: r[0] });
    }
    // a lunchbox and a flask on the end
    const [lx, ly] = anchor(p, W - 0.3, 0.5, 4.2);
    layer(p.c, (l) => {
      px(l, lx - 6, ly - 5, '#d8402e', 10, 5);
      px(l, lx - 6, ly - 6, '#e85a4a', 10, 1);
      px(l, lx + 6, ly - 12, '#3a7ac8', 4, 12);
      px(l, lx + 6, ly - 13, '#c8ccd0', 4, 2);
    }, { outline: 0.55, rect: [lx - 10, ly - 16, lx + 12, ly + 2] });
  },
};

// ── crates and drums ────────────────────────────────────────
const crate: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.12, 0.88, 0.88, 10, 0.28);
    const wood = planks(TIMBER, 7);
    const one = (a0: number, b0: number, s: number, z: number, open: boolean, seed: number) => {
      const h = 6.6 * s;
      lbox(p, a0, b0, s * 0.7, s * 0.7, z, h, { front: wood, side: wood, top: open ? flat(OLDWOOD, 1, 1, 1) : planks(TIMBER, 7), edge: TIMBER[0] });
      // battens round the edges, stencils
      const F = front(p, b0 + s * 0.7 + 0.001);
      const S = side(p, visA(p, a0 - 0.001, a0 + s * 0.7 + 0.001));
      for (const pl of [F, S]) {
        const u0 = pl === F ? a0 : b0;
        const u1 = u0 + s * 0.7;
        const bat = TIMBER[pl.light ? 2 : 1];
        pq(p, pl, u0, u0 + 0.06, z, z + h, bat);
        pq(p, pl, u1 - 0.06, u1, z, z + h, bat);
        pq(p, pl, u0, u1, z + h - 0.7, z + h, bat);
        pq(p, pl, u0, u1, z, z + 0.7, bat);
      }
      planeText(p.c, F, a0 + s * 0.35, z + h * 0.55, seed % 2 ? 'FRAGILE' : 'A-404', seed % 2 ? '#a82a20' : '#2a2a2e', 1);
      if (open) {
        // straw spilling out of the open top
        const [x, y] = anchor(p, a0 + s * 0.35, b0 + s * 0.35, z + h);
        layer(p.c, (l) => {
          for (let i = 0; i < 18; i++) ln(l, x - 12 + hash(i, 1, seed) * 24, y + hash(i, 2, seed) * 4, x - 12 + hash(i, 3, seed) * 24, y - 3 - hash(i, 4, seed) * 6, ['#d8b860', '#c8a048', '#e8cc78'][i % 3]);
        }, { outline: false, rect: [x - 16, y - 12, x + 16, y + 6] });
      }
    };
    const v = k.seed % 3;
    if (v === 0) one(0.15, 0.15, 1, 0, true, k.seed);
    else if (v === 1) {
      one(0.15, 0.15, 1, 0, false, k.seed);
      one(0.25, 0.25, 0.75, 6.6, true, k.seed + 1);
    } else {
      one(0.15, 0.15, 1, 0, false, k.seed);
      // a sack of sweepings slumped against it
      const [x, y] = anchor(p, 0.86, 0.9, 0);
      layer(p.c, (l) => {
        ell(l, x, y - 6, 8, 7, '#b8a07a');
        ell(l, x - 2, y - 8, 5, 4, '#cdb48c');
        px(l, x - 2, y - 15, '#8a7452', 4, 3);
      }, { outline: 0.6, rect: [x - 10, y - 18, x + 10, y + 2] });
    }
  },
};

const barrel: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 10, 0.3);
    const cols = ['#2a5a9a', '#b8302a', '#2a2a2e', '#3a7a4a'];
    const col = k.color ?? cols[k.seed % cols.length];
    const r: Ramp = [darken(col, 0.55), darken(col, 0.38), darken(col, 0.2), col, lighten(col, 0.18), lighten(col, 0.34)];
    // a yellow spill tray under it
    lbox(p, 0.12, 0.12, 0.76, 0.76, 0, 1, mono(flat(YELLOW, 4, 3, 5), YELLOW[0]));
    const [x, y] = anchor(p, 0.5, 0.5, 1);
    layer(p.c, (l) => {
      const R = 24;
      const ry = 12;
      const H = 36;
      for (let j = 0; j < H; j++)
        for (let i = -R; i <= R; i++) {
          const u = (i + R) / (2 * R);
          let t = u < 0.15 ? 4.6 : u < 0.4 ? 3.8 : u < 0.68 ? 3 : u < 0.88 ? 2 : 1.3;
          if (j === 10 || j === 11 || j === 24 || j === 25) t += j % 2 ? -1 : 1;
          if (hash(Math.floor(i / 3), Math.floor(j / 3), k.seed) < 0.04) t -= 1;
          const yb = Math.sqrt(Math.max(0, 1 - (i / R) ** 2)) * ry;
          px(l, x + i, y + yb - j, at(r, t));
        }
      ell(l, x, y - H, R, ry, r[2]);
      ell(l, x, y - H, R - 2, ry - 1, r[4]);
      ell(l, x - 8, y - H - 2, 4, 2, r[1]);
      px(l, x - 9, y - H - 3, STEEL[5], 2, 1);
      ell(l, x + 9, y - H + 1, 2.4, 1.4, r[1]);
      // the hazard diamond label and a rust run
      const lx = x - 6;
      const ly = y - 18;
      fillPoly(l, [[lx, ly - 6], [lx + 6, ly], [lx, ly + 6], [lx - 6, ly]], '#f2eee2');
      fillPoly(l, [[lx, ly - 4], [lx + 4, ly], [lx, ly + 4], [lx - 4, ly]], '#e8742a');
      for (let j = 0; j < 9; j++) px(l, x + 12, y - 30 + j * 2, RUST[3], 1, 2);
    }, { outline: 0.6, rect: [x - 28, y - 54, x + 28, y + 16] });
  },
};

// ── the shop floor's clutter ────────────────────────────────
/** A pair of steel lockers: louvred doors, name tags, a padlock, boots and a hard hat on top. */
const fac_lockers: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 16, 0.26);
    const G: Ramp = ['#2e3a46', '#3a4856', '#485868', '#586a7c', '#6c7e90', '#8496a8'];
    lbox(p, 0.12, 0.2, 0.76, 0.6, 0, 19, { front: enamel(G, 0.2), side: enamel(G, 0.2), top: flat(G, 4, 3, 5), edge: G[0] });
    const F = front(p, 0.801);
    const L = F.light;
    for (let i = 0; i < 2; i++) {
      const a0 = 0.15 + i * 0.37;
      const a1 = a0 + 0.33;
      pq(p, F, a0, a1, 0.6, 18.4, G[L ? 3 : 2]);
      pq(p, F, a0, a0 + 0.015, 0.6, 18.4, G[L ? 5 : 4]);
      for (let z = 15.4; z < 17.8; z += 0.6) pq(p, F, a0 + 0.06, a1 - 0.06, z, z + 0.25, G[1]);
      for (let z = 1.4; z < 3.6; z += 0.6) pq(p, F, a0 + 0.06, a1 - 0.06, z, z + 0.25, G[1]);
      pq(p, F, a0 + 0.08, a0 + 0.24, 13.2, 14.2, '#f2eee2');
      const [hx, hy] = F.F(a1 - 0.05, 9);
      px(p.c, hx - 1, hy - 3, '#1e1e22', 2, 6);
      if (i === 0) {
        px(p.c, hx - 3, hy + 3, '#c8a040', 4, 4);
        px(p.c, hx - 2, hy + 1, '#8a8e96', 2, 2);
      }
    }
    // a work calendar taped to the door, boots and a yellow hard hat on top
    pq(p, F, 0.53, 0.8, 6, 10.4, '#fbfaf4');
    pq(p, F, 0.53, 0.8, 9.6, 10.4, RED[3]);
    const [tx, ty] = anchor(p, 0.4, 0.45, 19);
    layer(p.c, (l) => {
      ell(l, tx + 7, ty - 1, 11, 4, YELLOW[2]);
      ell(l, tx + 7, ty - 4, 8, 6, YELLOW[3]);
      ell(l, tx + 5, ty - 6, 5, 3, YELLOW[5]);
      px(l, tx + 6, ty - 10, YELLOW[2], 2, 6);
      px(l, tx - 10, ty - 7, '#2a2420', 6, 7);
      px(l, tx - 4, ty - 6, '#3a3028', 6, 6);
      px(l, tx - 10, ty - 1, '#1a1614', 12, 2);
    }, { outline: 0.6, rect: [tx - 14, ty - 12, tx + 16, ty + 4] });
    void k;
  },
};

/** A hand pallet truck parked in the corner, its handle tipped back. */
const fac_pallettruck: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 6, 0.26);
    const R2 = RED;
    // the two fork tines and the hydraulic unit
    for (const b of [0.3, 0.62]) lbox(p, 0.22, b, 0.66, 0.12, 0.2, 0.8, mono(flat(R2, 3, 2, 4), R2[0]));
    lbox(p, 0.12, 0.26, 0.16, 0.52, 0.2, 3.4, mono(enamel(R2, 0.2), R2[0]));
    const [x, y] = anchor(p, 0.2, 0.52, 3.6);
    layer(p.c, (l) => {
      ln(l, x, y, x - 8, y - 30, IRON[3], 2);
      ln(l, x - 1, y, x - 9, y - 30, IRON[5], 1);
      px(l, x - 14, y - 34, '#1e1e22', 12, 4);
      px(l, x - 11, y - 34, R2[3], 6, 2);
      ell(l, x + 2, y + 10, 4, 3, '#1e1e22');
    }, { outline: 0.6, rect: [x - 18, y - 40, x + 8, y + 16] });
    void k;
  },
};

/** A grey wheelie bin, its lid propped on cardboard. */
const fac_bin: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 12, 0.26);
    const col = k.seed % 2 ? '#3a5a3a' : '#4a4e56';
    const r: Ramp = [darken(col, 0.5), darken(col, 0.32), darken(col, 0.15), col, lighten(col, 0.15), lighten(col, 0.3)];
    lbox(p, 0.24, 0.26, 0.52, 0.5, 0.6, 10.4, { front: enamel(r, 0.05), side: enamel(r, 0.05), top: flat(['#2a2428', '#3a3034', '#4a3c40'], 1, 1, 1), edge: r[0] });
    lbox(p, 0.2, 0.22, 0.6, 0.56, 11, 0.8, mono(flat(r, 4, 3, 5), r[0]));
    const [x, y] = anchor(p, 0.5, 0.5, 11.8);
    layer(p.c, (l) => {
      fillPoly(l, [[x - 10, y - 2], [x + 2, y - 8], [x + 12, y - 4], [x, y + 2]], '#a87a46');
      px(l, x - 4, y - 4, '#c29458', 6, 2);
    }, { outline: 0.55, rect: [x - 14, y - 12, x + 14, y + 6] });
    for (const a of [0.3, 0.7]) {
      const [wx, wy] = anchor(p, a, 0.8, 0.6);
      ell(p.c, wx, wy, 3, 3, '#1e1e22');
    }
    planeText(p.c, front(p, 0.761), 0.5, 7, 'SWARF', '#e8e4d8', 1);
  },
};

/** A pillar drill on its stand: base, column, the green head with belt cover, feed handles, a vice on the table. */
const fac_drill: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 20, 0.28);
    const G = MGREEN;
    lbox(p, 0.18, 0.2, 0.64, 0.6, 0, 1.2, mono(enamel(G, 0.2), G[0]));
    lbox(p, 0.44, 0.26, 0.12, 0.12, 1.2, 18, mono(flat(STEEL, 5, 4, 6), STEEL[1]));
    // the table on its collar, a vice and a part
    lbox(p, 0.3, 0.36, 0.44, 0.38, 8, 0.6, mono(flat(G, 3, 2, 4), G[0]));
    lbox(p, 0.4, 0.44, 0.2, 0.16, 8.6, 0.9, mono(flat(BLUE, 3, 2, 4), BLUE[0]));
    // the head, the motor behind, the belt cover on top, the spindle and chuck
    lbox(p, 0.34, 0.24, 0.36, 0.5, 15.4, 4, { front: enamel(G, 0.1), side: enamel(G, 0.1), top: flat(G, 4, 3, 5), edge: G[0] });
    lbox(p, 0.38, 0.1, 0.28, 0.16, 15.8, 3.4, mono(flat(GREYB, 3, 2, 4), GREYB[0]));
    lbox(p, 0.32, 0.18, 0.4, 0.58, 19.4, 1.8, mono(flat(G, 4, 3, 5), G[0]));
    const [cx, cy] = anchor(p, 0.52, 0.62, 15.4);
    px(p.c, cx - 1, cy, STEEL[4], 3, 10);
    px(p.c, cx - 2, cy + 10, STEEL[2], 5, 3);
    px(p.c, cx, cy + 13, STEEL[5], 1, 4);
    // three feed handles with red knobs
    const [hx, hy] = anchor(p, 0.7, 0.5, 16.6);
    for (const [dx, dy] of [[10, -2], [4, 8], [12, 6]] as const) {
      ln(p.c, hx, hy, hx + dx, hy + dy, STEEL[3]);
      px(p.c, hx + dx - 1, hy + dy - 1, RED[3], 3, 3);
    }
    warnSticker(p, front(p, 0.741), 0.44, 17.6);
    // swarf curls on the floor
    const Rn = rng(k.seed + 3);
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = anchor(p, 0.2 + Rn() * 0.6, 0.85 + Rn() * 0.1, 0);
      px(p.c, sx, sy, STEEL[5], 2, 1);
      px(p.c, sx + 1, sy - 1, STEEL[4]);
    }
  },
};

/** An oxy-acetylene welding set on its trolley: two bottles chained on, the hoses coiled on the handle. */
const fac_trolley: PropArt = {
  draw(p, k) {
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 14, 0.26);
    const [x, y] = anchor(p, 0.5, 0.55, 0);
    layer(p.c, (l) => {
      // the trolley frame and wheels
      ln(l, x - 12, y - 2, x - 10, y - 46, IRON[3], 2);
      ln(l, x + 12, y - 4, x + 14, y - 46, IRON[3], 2);
      px(l, x - 14, y - 2, IRON[2], 28, 3);
      ell(l, x - 12, y + 2, 5, 5, '#1e1e22');
      ell(l, x + 12, y, 5, 5, '#1e1e22');
      // the bottles: oxygen black with a white shoulder, acetylene maroon
      for (const [ox, body, sh] of [[-5, '#1e1e22', '#e8e4dc'], [6, '#6a1e2a', '#6a1e2a']] as const) {
        for (let j = 0; j < 40; j++) {
          const w = j > 36 ? 4 - (j - 36) : 5;
          for (let q = -w; q < w; q++) {
            const t = (q + w) / (2 * w);
            const col = j > 31 ? sh : body;
            px(l, x + ox + q, y - 3 - j, t < 0.3 ? lighten(col, 0.2) : t < 0.7 ? col : darken(col, 0.3));
          }
        }
        px(l, x + ox - 2, y - 46, STEEL[4], 4, 4);
      }
      // the chain, the hoses (red and blue) coiled on the handle, the torch
      ln(l, x - 11, y - 26, x + 13, y - 28, '#8a8e96');
      for (let i = 0; i < 3; i++) {
        ell(l, x + 16, y - 30 + i * 2, 6, 8, i % 2 ? '#2a5aa8' : '#c8302a');
        ell(l, x + 16, y - 30 + i * 2, 4, 6, 'rgba(0,0,0,0)');
      }
      for (let a = 0; a < Math.PI * 2; a += 0.12) {
        px(l, x + 16 + Math.cos(a) * 6, y - 28 + Math.sin(a) * 8, a < Math.PI ? '#c8302a' : '#2a5aa8');
      }
      ln(l, x + 20, y - 22, x + 26, y - 12, '#3a3a40', 2);
    }, { outline: 0.6, rect: [x - 18, y - 52, x + 30, y + 8] });
    void k;
  },
};

/** An empty cable drum stood on end as a tea table: mugs, a radio, a biscuit tin, the paper. */
const fac_drumtable: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 8, 0.26);
    layer(p.c, (l) => {
      // the drum: two flanges and the barrel between
      ell(l, x, y - 2, 26, 13, TIMBER[1]);
      for (let j = 0; j < 4; j++) ell(l, x, y - 2 - j, 26, 13, TIMBER[2]);
      for (let j = 0; j < 22; j++) {
        for (let i = -14; i <= 14; i++) {
          const t = (i + 14) / 28;
          px(l, x + i, y - 6 - j + Math.sqrt(Math.max(0, 1 - (i / 14) ** 2)) * 7, TIMBER[t < 0.3 ? 4 : t < 0.65 ? 3 : 2]);
        }
      }
      ell(l, x, y - 30, 26, 13, TIMBER[2]);
      ell(l, x, y - 32, 26, 13, TIMBER[4]);
      ell(l, x - 4, y - 34, 14, 6, TIMBER[5]);
      ell(l, x, y - 32, 5, 2.5, TIMBER[1]);
      // on it: two mugs, a transistor radio, a biscuit tin, the folded paper
      px(l, x - 14, y - 41, '#f2eee2', 5, 6);
      px(l, x - 14, y - 41, '#ffffff', 1, 6);
      px(l, x - 13, y - 41, '#4a2e1e', 3, 1);
      px(l, x - 4, y - 44, '#c8382a', 5, 6);
      px(l, x - 3, y - 44, '#4a2e1e', 3, 1);
      px(l, x + 4, y - 44, '#2a2a30', 12, 8);
      px(l, x + 5, y - 43, '#8a8e96', 5, 5);
      px(l, x + 12, y - 42, '#c8a040', 3, 2);
      ln(l, x + 14, y - 44, x + 18, y - 52, '#a8acb4');
      ell(l, x + 6, y - 34, 6, 3, '#3a6a9a');
      ell(l, x + 6, y - 35, 5, 2, '#5a8aba');
      fillPoly(l, [[x - 18, y - 33], [x - 8, y - 37], [x + 2, y - 33], [x - 8, y - 29]], '#e8e4d8');
      ln(l, x - 14, y - 33, x - 4, y - 36, '#8a8a8e');
    }, { outline: 0.6, rect: [x - 30, y - 56, x + 30, y + 14] });
    void k;
  },
};

// ── the front walls: the shop's brick facade, cut low ───────
const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7;
    const T = 0.3;
    const fac: Mat = (light, w, h) => {
      const b = brick(BRICK, { soot: 0.1, damp: 10 })(light, w, h);
      return (u, v, x, y) => (v < 12 ? at(BLUEBRICK, (light ? 3 : 1.8) + (v % 4 < 1 ? -1 : 0) + ((u + (Math.floor(v / 4) & 1) * 6) % 13 < 1 ? -1 : 0)) : v < 13.5 ? at(STONE, light ? 4 : 2.4) : b(u, v, x, y));
    };
    lbox(p, -0.3, 0, W + 0.3, T, 0, Z, { front: fac, side: fac, top: brickCut(BRICK), edge: BRICK[0] });
    // the building's corner: a brick pier with a stone cap where the two cut walls meet
    if (p.rot === 1) {
      lbox(p, -0.38, -0.06, 0.44, 0.44, 0, Z + 0.8, { front: fac, side: fac, top: brickCut(BRICK), edge: BRICK[0] });
      lbox(p, -0.42, -0.1, 0.52, 0.52, Z + 0.8, 0.7, { front: (light) => () => at(STONE, light ? 4 : 2.4), side: (light) => () => at(STONE, light ? 4 : 2.4), top: (light) => (_u, _v, x, y) => at(STONE, (light === 2 ? 5 : 4) - (hash(x, y, 9) < 0.08 ? 1 : 0)), edge: STONE[0] });
    }
    const F = front(p, T);
    // the stumps of the tall windows: stone sills, the cast-iron frames' feet
    for (let a = 1.5; a < W - 0.8; a += 3) {
      pq(p, F, a - 0.55, a + 0.55, Z - 1.6, Z - 0.6, F.light ? '#d8d0bc' : '#a8a08c');
      pq(p, F, a - 0.55, a + 0.55, Z - 1.9, Z - 1.6, '#5a5048');
      pq(p, F, a - 0.45, a + 0.45, Z - 0.6, Z, '#2a2a30');
      for (let i = 0; i < 5; i++) pq(p, F, a - 0.45 + i * 0.22, a - 0.43 + i * 0.22, Z - 0.6, Z, '#4a4e56');
    }
    // air bricks and a downpipe shoe now and then
    for (let a = 0.5; a < W - 0.4; a += 3) {
      pq(p, F, a, a + 0.18, 1.2, 2.4, '#3a3438');
      for (let i = 0; i < 3; i++) pq(p, F, a + 0.02, a + 0.16, 1.4 + i * 0.35, 1.55 + i * 0.35, '#1e1a1e');
    }
    // weeds at the foot of the wall: dandelions, a buddleia seedling, moss
    const Rn = rng(k.seed * 7 + 5);
    for (let a = 0.3; a < W - 0.2; a += 0.9 + Rn() * 1.6) {
      if (Rn() < 0.4) continue;
      const [x, y] = p.P(a, T + 0.08, 0);
      const masses: Mass[] = [];
      for (let i = 0; i < 3; i++) masses.push({ x: x - 4 + i * 4, y: y - 3 - Rn() * 3, rx: 4 + Rn() * 2, ry: 3, z: i });
      const flowers = Rn() < 0.4 ? ['#f2c83a'] : undefined;
      layer(p.c, (l) => foliage(l, masses, WEED, Math.floor(a * 13), { cell: 2.2, dots: flowers, dotChance: 0.5, dotSize: 3 }), { outline: 0.6, rect: massRect(masses) });
    }
    void k;
  },
};

export const FACTORY_ROOM: Record<string, PropArt> = {
  machine,
  robotArm,
  conveyor,
  console: controlDesk,
  workbench,
  rack,
  vending,
  watercooler,
  bench,
  crate,
  barrel,
  lowWall,
  fac_lockers,
  fac_pallettruck,
  fac_bin,
  fac_drill,
  fac_trolley,
  fac_drumtable,
};

export { GREYB, flat, mono, estop, warnSticker, curtainPost };

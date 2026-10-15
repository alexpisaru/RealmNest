// Robotics — the workshop's machines and benches at 128×64 (1 z ≈ 10 cm, a
// person ≈ 17.5 z). Heavy steel-framed workbenches with beech tops and ply
// backboards, an ESD electronics station with instruments, a gantry stand
// with a half-built humanoid, an enclosed 3D printer mid-print, a battery
// charging cabinet with a docked rover, and the eager little test bot.
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { ALU, base, BEECH, BIRCH, enamel, extrusion, GALV, GLASS, glassMat, HAZK, LED, noise2, ORANGE, PCB, plyEdge, plyFace, RED, RUBBER, SHELL, SLATE, STEEL, TEAL, YEL } from './rkit';

type C = CanvasRenderingContext2D;

// ── shared bits ─────────────────────────────────────────────
/** Laminated beech: strips along the bench, a darker glue line, burns and scratches. */
export const butcher: Mat = (light) => (u, v, x, y) => {
  const strip = Math.floor(v / 5);
  let i = base(light, BEECH.length) + 0.3 + (hash(strip, 1, 7) - 0.5) * 1.3;
  if (v % 5 < 0.8) i -= 0.7;
  if (noise2(u * 0.05 + strip * 3, v * 0.3, 8) > 0.66) i -= 0.5;
  const g = hash(x, y, 9);
  if (g < 0.025) i -= 1;
  else if (g > 0.99) return '#3a2414';
  return at(BEECH, i);
};
/** End grain on the front edge of a butcher block. */
export const endGrain: Mat = (light) => (u, v, x, y) => {
  let i = base(light, BEECH.length) + (hash(Math.floor(u / 4), 2, 11) - 0.5) * 1.4;
  if (u % 4 < 0.7) i -= 0.8;
  if (v < 0.8) i -= 0.6;
  if (hash(x, y, 12) < 0.04) i -= 0.6;
  return at(BEECH, i);
};

const steel = enamel(SLATE, 0.012);
const dark = enamel(STEEL, 0.008);

/** A flat quad lying at height z (mats, papers, boards). */
function flatQuad(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, col: string) {
  fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], col);
}

/** A mug: body, lit edge, handle, coffee. */
function mug(l: C, x: number, y: number, col: string) {
  px(l, x - 3, y - 7, col, 6, 7);
  px(l, x - 3, y - 7, '#ffffff', 1, 7);
  px(l, x + 3, y - 6, col, 2, 1);
  px(l, x + 4, y - 6, col, 1, 4);
  px(l, x + 3, y - 3, col, 2, 1);
  px(l, x - 2, y - 7, '#3a2418', 4, 1);
}

/** A cable spool seen three-quarter: two flanges and the winding. */
function spool(l: C, x: number, y: number, r: number, col: string, flange = '#2a2a30') {
  ell(l, x + 2, y, r * 0.55, r, flange);
  for (let i = 0; i < 4; i++) ell(l, x + 1 - i * 0.2, y, r * 0.5, r * 0.82, i & 1 ? col : col);
  for (let j = -r + 2; j < r - 1; j += 2) px(l, x - r * 0.45, y + j, '#ffffff', 1, 1);
  ell(l, x - 2, y, r * 0.55, r, flange);
  ell(l, x - 2, y, r * 0.22, r * 0.4, '#1a1a1e');
}

/** A shop stool: a round black seat on a gas column, a foot ring, five castors. */
function stool(p: PropPainter, a: number, b: number, seat: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 6, y + 2, 13, 4, 0.24);
  layer(
    p.c,
    (l) => {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.4;
        const ex = x + Math.cos(ang) * 10;
        const ey = y + Math.sin(ang) * 4.5;
        ln(l, x, y - 3, ex, ey - 2, STEEL[2], 2);
        px(l, ex - 1, ey - 2, STEEL[0], 3, 3);
      }
      px(l, x - 1, y - seat * 4, GALV[3], 3, seat * 4 - 2);
      px(l, x - 1, y - seat * 4, GALV[5], 1, seat * 4 - 2);
      ell(l, x, y - 12, 8, 3, GALV[2]);
      ell(l, x, y - 12, 6, 2, 'rgba(0,0,0,0)');
      ell(l, x, y - seat * 4 - 1, 10, 4.5, '#202228');
      ell(l, x - 1, y - seat * 4 - 2, 9, 3.6, '#30333a');
      ell(l, x - 3, y - seat * 4 - 3, 4, 1.4, '#464a54');
    },
    { rect: [x - 16, y - seat * 4 - 10, x + 16, y + 6] },
  );
}

// ── workbenches ─────────────────────────────────────────────
type BenchKind = 'solder' | 'wire' | 'repair';

function benchFrame(p: PropPainter, W: number, Z: number, kind: BenchKind, seed: number) {
  footShadow(p, 0.08, 0.12, W - 0.08, 0.95, 11, 0.26);
  // legs in square tube, levelling feet
  for (const a of [0.12, W - 0.2])
    for (const b of [0.14, 0.82]) {
      lbox(p, a, b, 0.08, 0.08, 0.3, Z - 1, mono(steel, SLATE[0]));
      lbox(p, a - 0.02, b - 0.02, 0.12, 0.12, 0, 0.3, mono(dark, STEEL[0]));
    }
  // the lower shelf with plastic bins, and a drawer block under the top
  lbox(p, 0.12, 0.14, W - 0.24, 0.76, 1.6, 0.35, mono(steel, SLATE[0]));
  const bins: Ramp[] = [
    ['#162c58', '#1e3c78', '#264a90', '#2c58a8', '#3a6ac0', '#5a86d4'],
    [YEL[1], YEL[2], YEL[3], YEL[4], YEL[5], YEL[6]],
    [RED[1], RED[2], RED[3], RED[4], RED[5], RED[6]],
    [TEAL[1], TEAL[2], TEAL[3], TEAL[4], TEAL[5], TEAL[6]],
  ];
  const nb = kind === 'repair' ? 2 : 3;
  for (let i = 0; i < nb; i++) {
    const a = 0.24 + i * 0.5;
    const r = bins[(i + seed) % 4];
    lbox(p, a, 0.3, 0.42, 0.56, 1.95, 2.1, { front: enamel(r), side: enamel(r), top: (_l) => () => r[1], edge: r[0] });
    const F = front(p, 0.86);
    pq(p, F, a + 0.1, a + 0.3, 2.7, 3.4, '#f2f0ea');
    pq(p, F, a + 0.12, a + 0.24, 3, 3.1, '#3a3a40');
  }
  if (kind === 'repair') {
    // an old rubber tyre and a coiled air hose under the repair bench
    const [tx, ty] = anchor(p, 1.5, 0.55, 2);
    layer(
      p.c,
      (l) => {
        ell(l, tx, ty - 6, 15, 9, RUBBER[1]);
        ell(l, tx - 1, ty - 7, 13, 7, RUBBER[3]);
        ell(l, tx - 1, ty - 7, 6, 3.4, RUBBER[0]);
        for (let a = 0; a < 14; a++) px(l, tx + Math.cos(a * 0.45) * 12, ty - 7 + Math.sin(a * 0.45) * 6.4, RUBBER[4]);
      },
      { rect: [tx - 18, ty - 18, tx + 18, ty + 4] },
    );
  }
  // drawer block hanging under the top on the right
  const dA = W - 0.86;
  lbox(p, dA, 0.18, 0.66, 0.66, Z - 3.6, 2.9, { front: steel, side: steel, top: steel, edge: SLATE[0] });
  const F = front(p, 0.84);
  for (const z of [Z - 3.3, Z - 1.85]) {
    pq(p, F, dA + 0.05, dA + 0.61, z, z + 1.25, SLATE[F.light ? 2 : 1]);
    pq(p, F, dA + 0.24, dA + 0.42, z + 0.75, z + 1, GALV[5]);
  }
  // the beech top, end grain on the edge
  lbox(p, 0.04, 0.08, W - 0.08, 0.86, Z - 0.75, 0.75, { front: endGrain, side: endGrain, top: butcher, edge: BEECH[0] });
  // backboard: two uprights, a ply panel, a shelf with an LED bar under it
  for (const a of [0.1, W - 0.16]) lbox(p, a, 0.08, 0.06, 0.06, Z, 11, mono(steel, SLATE[0]));
  lbox(p, 0.16, 0.08, W - 0.32, 0.04, Z, 9, { front: plyFace(BIRCH), side: plyEdge(BIRCH), top: plyEdge(BIRCH), edge: BIRCH[0] });
  lbox(p, 0.1, 0.08, W - 0.2, 0.3, Z + 7.2, 0.4, { front: plyEdge(BIRCH), side: plyEdge(BIRCH), top: plyFace(BIRCH), edge: BIRCH[0] });
  const Fs = front(p, 0.38);
  pq(p, Fs, 0.2, W - 0.2, Z + 6.85, Z + 7.2, '#e8f2f4');
  // a power strip on the backboard: sockets and a glowing switch
  const Fb = front(p, 0.12);
  pq(p, Fb, 0.3, 1.25, Z + 1.2, Z + 2.2, '#e8e6e0');
  for (let i = 0; i < 4; i++) pq(p, Fb, 0.36 + i * 0.2, 0.48 + i * 0.2, Z + 1.4, Z + 2, '#9a9890');
  pq(p, Fb, 1.12, 1.2, Z + 1.45, Z + 1.95, '#ff6a3a');
}

/** Clutter on the soldering bench. */
function solderTop(p: PropPainter, W: number, Z: number) {
  // the ESD mat
  flatQuad(p, 0.12, 0.3, W - 0.62, 0.86, Z + 0.02, '#3c5a6e');
  flatQuad(p, 0.16, 0.34, W - 0.66, 0.82, Z + 0.03, '#4a6c82');
  const [gx, gy] = anchor(p, 0.2, 0.84, Z);
  px(p.c, gx, gy - 1, '#2a2a30', 4, 2);
  // soldering station: a dark box with a red readout, the iron in its coil
  lbox(p, 0.22, 0.3, 0.42, 0.3, Z, 1.6, { front: dark, side: dark, top: dark, edge: STEEL[0] });
  const F1 = front(p, 0.6);
  pq(p, F1, 0.28, 0.48, Z + 0.7, Z + 1.3, '#1a0a0a');
  pq(p, F1, 0.3, 0.46, Z + 0.8, Z + 1.2, '#ff4a32');
  const [kx, ky] = F1.F(0.56, Z + 0.9);
  ell(p.c, kx, ky, 2, 2, GALV[4]);
  const [sx, sy] = anchor(p, 0.82, 0.48, Z);
  const [hx, hy] = anchor(p, 0.98, 0.6, Z);
  const [px0, py0] = anchor(p, 0.18, 0.4, Z + 1.6);
  layer(
    p.c,
    (l) => {
      // the coiled holder with the iron resting in it
      for (let i = 0; i < 6; i++) ell(l, sx + i * 1.4, sy - 4 - i * 0.8, 3, 2, GALV[3 + (i & 1)]);
      ln(l, sx - 2, sy - 3, sx + 12, sy - 12, '#2a3a8a', 3);
      ln(l, sx + 12, sy - 12, sx + 18, sy - 15, GALV[5], 1);
      // brass sponge cup
      ell(l, sx - 8, sy + 2, 4, 2, '#c89a3a');
      ell(l, sx - 8, sy + 1, 3, 1.4, '#e8c24a');
      // the cable back to the station
      ln(l, sx - 2, sy - 3, px0 + 4, py0 + 6, '#1e1e24');
      // helping hands with a magnifier holding a PCB
      px(l, hx - 4, hy - 2, '#2a2a30', 9, 3);
      ln(l, hx, hy - 2, hx - 4, hy - 16, GALV[4]);
      ln(l, hx, hy - 2, hx + 7, hy - 13, GALV[4]);
      ell(l, hx - 5, hy - 20, 6, 6, '#2a2a30');
      ell(l, hx - 5, hy - 20, 4.6, 4.6, '#bfe0ee');
      px(l, hx - 8, hy - 23, '#ffffff', 2, 2);
      fillPoly(l, [[hx + 2, hy - 14], [hx + 14, hy - 17], [hx + 16, hy - 12], [hx + 4, hy - 9]], PCB[3]);
      px(l, hx + 6, hy - 14, '#1a1a1e', 4, 2);
      px(l, hx + 11, hy - 15, '#1a1a1e', 2, 2);
      px(l, hx + 9, hy - 12, '#c8a050', 2, 1);
      px(l, hx + 5, hy - 11, '#d8402e', 1, 2);
    },
    { rect: [sx - 14, Math.min(sy, hy) - 28, hx + 20, Math.max(sy, hy) + 6] },
  );
  // a fume extractor and a solder spool, a board with chips on the mat
  lbox(p, W - 0.58, 0.24, 0.36, 0.28, Z, 2.2, { front: dark, side: dark, top: dark, edge: STEEL[0] });
  const F2 = front(p, 0.52);
  const [fx, fy] = F2.F(W - 0.4, Z + 1.1);
  ell(p.c, fx, fy, 4, 4, '#121216');
  for (let a = 0; a < 6; a++) ln(p.c, fx, fy, fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, '#3a3a44');
  const [bx, by] = anchor(p, 0.62, 0.72, Z + 0.05);
  layer(
    p.c,
    (l) => {
      fillPoly(l, [[bx - 12, by], [bx + 2, by - 6], [bx + 14, by - 1], [bx, by + 5]], PCB[2]);
      fillPoly(l, [[bx - 10, by], [bx + 2, by - 5], [bx + 12, by - 1], [bx, by + 4]], PCB[3]);
      px(l, bx - 4, by - 2, '#1a1a1e', 5, 2);
      px(l, bx + 3, by - 2, '#1a1a1e', 3, 2);
      px(l, bx - 1, by + 1, '#c8c8c8', 2, 1);
      px(l, bx + 6, by, '#2c62c8', 2, 2);
      px(l, bx - 7, by, '#d8402e', 1, 2);
      // a solder spool
      ell(l, bx + 20, by - 8, 4, 3, '#2a2a30');
      ell(l, bx + 20, by - 10, 3, 2, '#b8bcc4');
      px(l, bx + 19, by - 11, '#e8ecf0', 2, 1);
    },
    { rect: [bx - 16, by - 16, bx + 26, by + 8] },
  );
  // on the shelf: a small-parts organiser of tiny drawers
  lbox(p, 0.24, 0.12, 0.8, 0.22, Z + 7.6, 2.4, { front: enamel(SHELL), side: enamel(SHELL), top: enamel(SHELL), edge: SHELL[0] });
  const F3 = front(p, 0.34);
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 6; i++) {
      const a = 0.27 + i * 0.125;
      pq(p, F3, a, a + 0.1, Z + 7.8 + r * 0.72, Z + 8.35 + r * 0.72, ['#d8402e', '#2c62c8', YEL[4], '#3aa058', '#c86ab8', '#e8e4dc'][(i + r * 2) % 6]);
      pq(p, F3, a + 0.03, a + 0.07, Z + 7.9 + r * 0.72, Z + 8.0 + r * 0.72, '#ffffff');
    }
}

/** Clutter on the wiring bench. */
function wireTop(p: PropPainter, W: number, Z: number) {
  // wire spools on a dowel across the backboard
  const [dx0, dy0] = anchor(p, 0.2, 0.18, Z + 5);
  const [dx1, dy1] = anchor(p, W - 0.25, 0.18, Z + 5);
  ln(p.c, dx0, dy0, dx1, dy1, BIRCH[2], 2);
  layer(
    p.c,
    (l) => {
      const cols = ['#d8402e', '#1e1e24', '#2c62c8', YEL[4], '#3aa058'];
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        spool(l, dx0 + (dx1 - dx0) * t, dy0 + (dy1 - dy0) * t + 1, 7, cols[i]);
      }
    },
    { outline: 0.55, rect: [Math.min(dx0, dx1) - 12, Math.min(dy0, dy1) - 12, Math.max(dx0, dx1) + 12, Math.max(dy0, dy1) + 12] },
  );
  // a robot arm segment on the bench: aluminium brackets and two servos, wires spilling
  const [ax, ay] = anchor(p, 0.75, 0.55, Z);
  layer(
    p.c,
    (l) => {
      fillPoly(l, [[ax - 20, ay - 2], [ax + 8, ay - 14], [ax + 12, ay - 10], [ax - 16, ay + 2]], ALU[3]);
      fillPoly(l, [[ax - 20, ay - 2], [ax - 16, ay + 2], [ax - 16, ay + 4], [ax - 20, ay]], ALU[1]);
      fillPoly(l, [[ax - 26, ay - 8], [ax - 14, ay - 13], [ax - 10, ay - 5], [ax - 22, ay]], '#1e1e24');
      fillPoly(l, [[ax - 26, ay - 8], [ax - 22, ay], [ax - 22, ay - 4], [ax - 26, ay - 12]], '#2a2a30');
      ell(l, ax - 18, ay - 9, 3, 2, ORANGE[4]);
      fillPoly(l, [[ax + 4, ay - 18], [ax + 16, ay - 23], [ax + 20, ay - 15], [ax + 8, ay - 10]], '#1e1e24');
      ell(l, ax + 12, ay - 19, 3, 2, ORANGE[4]);
      // a little gripper at the end
      ln(l, ax + 18, ay - 19, ax + 24, ay - 24, ALU[4], 2);
      ln(l, ax + 19, ay - 16, ax + 26, ay - 18, ALU[4], 2);
      // wires spilling over the bench
      ln(l, ax - 10, ay - 4, ax - 2, ay + 6, '#d8402e');
      ln(l, ax - 9, ay - 3, ax, ay + 6, '#1e1e24');
      ln(l, ax - 2, ay + 6, ax + 10, ay + 4, '#d8402e');
      ln(l, ax, ay + 6, ax + 11, ay + 5, '#1e1e24');
    },
    { rect: [ax - 30, ay - 28, ax + 30, ay + 10] },
  );
  // a multimeter with its probes, strippers and a crimper, a mug, a laptop
  const [mx, my] = anchor(p, 1.32, 0.66, Z);
  const [lx, ly] = anchor(p, W - 0.42, 0.4, Z);
  layer(
    p.c,
    (l) => {
      fillPoly(l, [[mx - 6, my - 2], [mx + 4, my - 7], [mx + 10, my - 3], [mx, my + 2]], YEL[3]);
      fillPoly(l, [[mx - 4, my - 3], [mx + 2, my - 6], [mx + 5, my - 4.5], [mx - 1, my - 1.5]], '#9ac88a');
      ln(l, mx + 8, my - 2, mx + 16, my + 3, '#d8402e');
      ln(l, mx + 9, my - 1, mx + 14, my + 6, '#1e1e24');
      ln(l, mx - 14, my - 4, mx - 6, my + 2, '#d8402e', 2);
      ln(l, mx - 12, my - 6, mx - 4, my, GALV[4]);
      mug(l, mx + 22, my - 6, '#3fb6c8');
      // laptop with a terminal open
      fillPoly(l, [[lx - 12, ly + 2], [lx + 2, ly - 5], [lx + 12, ly], [lx - 2, ly + 7]], '#3a3c44');
      fillPoly(l, [[lx - 11, ly + 2], [lx + 2, ly - 4], [lx + 11, ly], [lx - 2, ly + 6]], '#4a4c56');
      fillPoly(l, [[lx + 2, ly - 5], [lx + 12, ly], [lx + 12, ly - 15], [lx + 2, ly - 20]], '#2a2c32');
      fillPoly(l, [[lx + 3, ly - 6], [lx + 11, ly - 2], [lx + 11, ly - 14], [lx + 3, ly - 18]], '#0e1a14');
    },
    { rect: [mx - 18, Math.min(my, ly) - 24, Math.max(mx, lx) + 28, Math.max(my, ly) + 10] },
  );
}

/** Clutter on the repair bench: a robot dog on its side, a vice, a drill. */
function repairTop(p: PropPainter, W: number, Z: number) {
  // the bench vice bolted at the front right corner
  lbox(p, W - 0.52, 0.56, 0.3, 0.3, Z, 0.8, mono(enamel(['#1c2a44', '#243656', '#2c4268', '#36507a', '#42608e', '#5a78a6']), '#1c2a44'));
  lbox(p, W - 0.54, 0.62, 0.34, 0.14, Z + 0.8, 1.4, mono(enamel(GALV), GALV[0]));
  lbox(p, W - 0.54, 0.84, 0.34, 0.14, Z + 0.8, 1.4, mono(enamel(GALV), GALV[0]));
  const [vx, vy] = anchor(p, W - 0.37, 1.02, Z + 1.4);
  ln(p.c, vx - 8, vy + 2, vx + 6, vy - 4, GALV[5], 2);
  // a robot dog on its side, one leg off for a new actuator
  const [dx, dy] = anchor(p, 0.75, 0.55, Z);
  layer(
    p.c,
    (l) => {
      fillPoly(l, [[dx - 26, dy - 4], [dx + 6, dy - 18], [dx + 16, dy - 12], [dx - 16, dy + 2]], YEL[3]);
      fillPoly(l, [[dx - 26, dy - 4], [dx - 16, dy + 2], [dx - 16, dy - 6], [dx - 26, dy - 12]], YEL[2]);
      fillPoly(l, [[dx - 26, dy - 12], [dx + 6, dy - 26], [dx + 6, dy - 18], [dx - 26, dy - 4]], YEL[4]);
      px(l, dx - 22, dy - 14, '#1e1e24', 24, 2);
      // the head with its sensor cluster
      fillPoly(l, [[dx + 6, dy - 26], [dx + 16, dy - 30], [dx + 22, dy - 22], [dx + 16, dy - 12], [dx + 6, dy - 18]], '#2a2a30');
      px(l, dx + 12, dy - 25, LED.cyan, 2, 2);
      px(l, dx + 16, dy - 23, LED.cyan, 2, 2);
      // two legs sticking out, the open joint, the detached leg beside it
      ln(l, dx - 18, dy - 2, dx - 22, dy + 8, '#1e1e24', 3);
      ln(l, dx - 22, dy + 8, dx - 14, dy + 12, '#2a2a30', 3);
      ln(l, dx - 2, dy - 9, dx + 2, dy + 2, '#1e1e24', 3);
      ln(l, dx + 2, dy + 2, dx + 10, dy + 4, '#2a2a30', 3);
      ell(l, dx - 6, dy - 12, 3, 2.4, '#5a5e66');
      px(l, dx - 7, dy - 13, '#d8402e', 1, 2);
      px(l, dx - 5, dy - 12, '#2c62c8', 1, 2);
      ln(l, dx + 18, dy + 2, dx + 30, dy - 4, '#1e1e24', 3);
      ln(l, dx + 30, dy - 4, dx + 36, dy + 2, '#2a2a30', 3);
      ell(l, dx + 18, dy + 2, 2.6, 2, YEL[3]);
    },
    { rect: [dx - 32, dy - 36, dx + 42, dy + 16] },
  );
  // a cordless drill standing, a magnetic tray of screws, a tablet with diagnostics
  const [rx, ry] = anchor(p, 1.38, 0.32, Z);
  const [tx, ty] = anchor(p, 1.18, 0.72, Z);
  layer(
    p.c,
    (l) => {
      px(l, rx - 3, ry - 6, '#1e1e24', 7, 6);
      px(l, rx - 2, ry - 16, ORANGE[3], 4, 10);
      px(l, rx - 2, ry - 16, ORANGE[5], 1, 10);
      px(l, rx - 3, ry - 20, '#1e1e24', 11, 5);
      px(l, rx + 8, ry - 19, GALV[4], 4, 2);
      ell(l, tx - 8, ty, 5, 2.4, GALV[2]);
      ell(l, tx - 8, ty - 1, 4, 1.6, GALV[4]);
      for (let i = 0; i < 4; i++) px(l, tx - 11 + i * 2, ty - 1, '#5a5e66');
      fillPoly(l, [[tx, ty + 1], [tx + 10, ty - 4], [tx + 16, ty - 1], [tx + 6, ty + 4]], '#1e1e24');
      fillPoly(l, [[tx + 1, ty + 1], [tx + 10, ty - 3], [tx + 14, ty - 1], [tx + 6, ty + 3]], '#163a4a');
    },
    { rect: [tx - 16, ry - 24, rx + 16, ty + 8] },
  );
  // on the shelf: a box of spare actuators and a small radio
  lbox(p, 0.3, 0.14, 0.5, 0.22, Z + 7.6, 1.6, mono(enamel(['#5e4224', '#7c5a32', '#9a7442', '#b48c54', '#c8a46a', '#dabc86']), '#5e4224'));
  lbox(p, W - 0.8, 0.14, 0.42, 0.2, Z + 7.6, 1.8, { front: dark, side: dark, top: dark, edge: STEEL[0] });
  const Fr = front(p, 0.34);
  pq(p, Fr, W - 0.74, W - 0.56, Z + 8, Z + 9, '#f2a03a');
  const [ax, ay] = Fr.F(W - 0.44, Z + 9.4);
  ln(p.c, ax, ay, ax + 6, ay - 14, GALV[4]);
}

const workbench: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    const kind: BenchKind = p.y >= 8 ? 'repair' : p.x < 3 ? 'solder' : 'wire';
    benchFrame(p, W, Z, kind, k.seed);
    if (kind === 'solder') solderTop(p, W, Z);
    else if (kind === 'wire') wireTop(p, W, Z);
    else repairTop(p, W, Z);
    if (kind !== 'repair') stool(p, W - 0.38, 1.18, 6.6);
  },
  anim(p, k) {
    const kind: BenchKind = p.y >= 8 ? 'repair' : p.x < 3 ? 'solder' : 'wire';
    const u = p.k / 4;
    if (kind === 'solder') {
      // a wisp of flux smoke off the iron tip
      const [x, y] = anchor(p, 0.98, 0.42, 9 + 3);
      for (let i = 0; i < 3; i++) {
        const t = (k.t * 0.6 + i / 3) % 1;
        p.c.globalAlpha = 0.3 * (1 - t);
        ell(p.c, x + Math.sin(t * 5 + i) * 2 * u, y - t * 18 * u, (1.5 + t * 2.5) * u, (1.5 + t * 2) * u, '#f2f2f2');
      }
      p.c.globalAlpha = 1;
    } else if (kind === 'wire') {
      // text scrolling on the laptop
      const W = 2;
      const [lx, ly] = anchor(p, W - 0.42, 0.4, 9);
      for (let i = 0; i < 4; i++) {
        const len = 2 + Math.floor(hash(i + Math.floor(k.t * 1.5), 3, k.seed) * 5);
        px(p.c, lx + 4 * u, ly + (-16 + i * 3) * u + i * u, i === 3 && Math.sin(k.t * 6) > 0 ? '#ffffff' : '#5ae08a', Math.max(1, len * u), Math.max(1, u));
      }
    } else {
      const [tx, ty] = anchor(p, 1.18, 0.72, 9);
      px(p.c, tx + 4 * u, ty - 2 * u, Math.sin(k.t * 3) > 0 ? LED.green : LED.amber, Math.max(1, 3 * u), Math.max(1, u));
    }
  },
};

// ── the electronics station ─────────────────────────────────
const desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 8;
    footShadow(p, 0.1, 0.12, W - 0.1, 0.92, 9, 0.26);
    // steel frame, a cable tray, a drawer pedestal
    for (const a of [0.14, W - 0.2]) {
      lbox(p, a, 0.18, 0.06, 0.64, 0, 0.45, mono(dark, STEEL[0]));
      lbox(p, a, 0.18, 0.06, 0.06, 0, Z, mono(dark, STEEL[0]));
      lbox(p, a, 0.76, 0.06, 0.06, 0, Z, mono(dark, STEEL[0]));
    }
    lbox(p, 0.24, 0.22, W - 0.48, 0.14, 5, 0.8, mono(dark, STEEL[0]));
    lbox(p, 0.28, 0.24, 0.52, 0.6, 0, Z - 0.5, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    const F = front(p, 0.84);
    for (let i = 0; i < 3; i++) {
      const z0 = 0.6 + i * 2.4;
      pq(p, F, 0.32, 0.76, z0, z0 + 2.1, SLATE[F.light ? 2 : 1]);
      pq(p, F, 0.46, 0.62, z0 + 1.5, z0 + 1.75, GALV[5]);
      pq(p, F, 0.42, 0.66, z0 + 0.4, z0 + 0.9, '#f2f0ea');
    }
    // the grey ESD laminate top with a blue mat
    const lam: Mat = (light) => (_u, _v, x, y) => at(['#6a7078', '#7e848c', '#929aa2', '#a4aab2', '#b4bac0', '#c4c8cc'], base(light, 6) + (hash(x, y, 21) < 0.04 ? -1 : 0));
    lbox(p, 0.06, 0.1, W - 0.12, 0.82, Z - 0.5, 0.5, { front: lam, side: lam, top: lam, edge: '#4a5058' });
    flatQuad(p, 0.16, 0.48, W - 0.18, 0.88, Z + 0.02, '#2e5a78');
    flatQuad(p, 0.2, 0.52, W - 0.22, 0.85, Z + 0.03, '#3a6c8c');
    // the instrument riser along the back
    lbox(p, 0.1, 0.12, W - 0.2, 0.42, Z, 0.25, mono(dark, STEEL[0]));
    for (const a of [0.12, W - 0.18]) lbox(p, a, 0.14, 0.06, 0.38, Z, 3.2, mono(dark, STEEL[0]));
    lbox(p, 0.1, 0.12, W - 0.2, 0.42, Z + 3.2, 0.3, mono(dark, STEEL[0]));
    // under the riser: a bench power supply and a function generator
    const psu: Mat = (light) => (_u, v) => at(['#1c1d22', '#24262c', '#2e3038', '#3a3d46', '#484c56', '#5a5e6a'], base(light, 6) + (v > 9 ? 1 : 0));
    lbox(p, 0.22, 0.18, 0.62, 0.34, Z + 0.25, 2.7, { front: psu, side: psu, top: psu, edge: '#141418' });
    lbox(p, 0.94, 0.18, 0.5, 0.34, Z + 0.25, 2, { front: enamel(SHELL), side: enamel(SHELL), top: enamel(SHELL), edge: SHELL[0] });
    const Fp = front(p, 0.52);
    pq(p, Fp, 0.27, 0.5, Z + 1.7, Z + 2.6, '#1a0808');
    pq(p, Fp, 0.54, 0.78, Z + 1.7, Z + 2.6, '#081a0c');
    for (const a of [0.34, 0.62]) {
      const [kx, ky] = Fp.F(a, Z + 0.9);
      ell(p.c, kx, ky, 2.2, 2.2, GALV[4]);
      px(p.c, kx - 1, ky - 1, '#ffffff');
    }
    for (const [a, c] of [[0.3, '#d8402e'], [0.42, '#1e1e24'], [0.7, '#d8402e'], [0.78, '#1e1e24']] as const) {
      const [jx, jy] = Fp.F(a, Z + 0.6);
      px(p.c, jx - 1, jy - 1, c, 2, 2);
    }
    pq(p, Fp, 0.98, 1.2, Z + 1.2, Z + 1.9, '#1a1408');
    // the oscilloscope on top of the riser
    const scope: Mat = (light) => (_u, v, x, y) => at(['#5a5c62', '#74767c', '#8e9096', '#a6a8ac', '#bcbec0', '#d0d2d2'], base(light, 6) + (v < 2 ? -1 : 0) + (hash(x, y, 23) < 0.02 ? -1 : 0));
    lbox(p, 0.26, 0.14, 1.14, 0.4, Z + 3.5, 3.6, { front: scope, side: scope, top: scope, edge: '#3a3c42' });
    const Fs = front(p, 0.54);
    pq(p, Fs, 0.3, 0.98, Z + 3.85, Z + 6.85, '#1a1c20');
    pq(p, Fs, 0.33, 0.95, Z + 4.05, Z + 6.65, '#0a1a14');
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const [kx, ky] = Fs.F(1.08 + j * 0.18, Z + 4.4 + i * 0.85);
        ell(p.c, kx, ky, 2, 2, '#2a2c30');
        px(p.c, kx - 1, ky - 1, '#9a9ca0');
      }
    for (const [i, c] of [[0, YEL[4]], [1, '#3fd6e6'], [2, '#e86ad8'], [3, '#5a8aff']] as const) pq(p, Fs, 1.04 + i * 0.08, 1.1 + i * 0.08, Z + 3.75, Z + 3.95, c);
    // probes coiled on the mat, a breadboard with jumpers and a dev board, a magnifier lamp
    const [bx, by] = anchor(p, 0.62, 0.7, Z);
    const [cx, cy] = anchor(p, 1.32, 0.72, Z);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[bx - 14, by + 1], [bx + 2, by - 7], [bx + 14, by - 1], [bx - 2, by + 7]], '#e8e6e0');
        fillPoly(l, [[bx - 12, by + 1], [bx + 2, by - 6], [bx + 12, by - 1], [bx - 2, by + 6]], '#f6f4ee');
        for (let i = 0; i < 6; i++) {
          const c = ['#d8402e', '#2c62c8', YEL[4], '#3aa058', '#e86ad8', '#f6f6f6'][i];
          ln(l, bx - 8 + i * 3, by + 2 - i * 1.4, bx - 4 + i * 3, by - 4 - i * 1.4, c);
        }
        fillPoly(l, [[bx + 4, by - 3], [bx + 10, by - 6], [bx + 14, by - 4], [bx + 8, by - 1]], TEAL[3]);
        px(l, bx + 8, by - 4, '#1a1a1e', 2, 1);
        // coiled probe leads
        for (let i = 0; i < 3; i++) ell(l, cx - 4 + i, cy - 1 + i * 0.4, 5, 2.4, i & 1 ? '#d8402e' : '#1e1e24');
        ell(l, cx - 3, cy, 3, 1.2, '#3a6c8c');
        ln(l, cx + 2, cy - 2, cx + 10, cy - 8, '#1e1e24');
      },
      { rect: [bx - 18, by - 14, cx + 14, Math.max(by, cy) + 10] },
    );
    const [mx, my] = anchor(p, W - 0.22, 0.5, Z);
    layer(
      p.c,
      (l) => {
        px(l, mx - 2, my - 4, '#2a2a30', 5, 4);
        ln(l, mx, my - 4, mx - 4, my - 26, '#e8e6e0', 2);
        ln(l, mx - 4, my - 26, mx - 18, my - 30, '#e8e6e0', 2);
        ell(l, mx - 22, my - 28, 8, 5, '#e8e6e0');
        ell(l, mx - 22, my - 27, 6, 3.4, '#bfe0ee');
        px(l, mx - 25, my - 29, '#ffffff', 2, 1);
      },
      { rect: [mx - 34, my - 36, mx + 6, my + 2] },
    );
    stool(p, W - 0.4, 1.2, 6);
  },
  anim(p, k) {
    const F = front(p, 0.54);
    const Z = 8;
    const u = p.k / 4;
    // two traces on the scope: a sine and a PWM square wave
    const z0 = Z + 4.1;
    const z1 = Z + 6.6;
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 24; i++) {
      const a = 0.35 + (i / 24) * 0.58;
      const z = (z0 + z1) / 2 + 0.55 + Math.sin(i * 0.55 - k.t * 4) * 0.55;
      const q = F.F(a, z);
      if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], YEL[5]);
      prev = q;
    }
    prev = null;
    for (let i = 0; i <= 24; i++) {
      const a = 0.35 + (i / 24) * 0.58;
      const hiz = Math.floor((i + k.t * 6) / 4) % 2 === 0;
      const z = (z0 + z1) / 2 - 0.75 + (hiz ? 0.45 : -0.2);
      const q = F.F(a, z);
      if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#3fd6e6');
      prev = q;
    }
    // the supply's readouts flickering
    const Fp = front(p, 0.52);
    const [ax, ay] = Fp.F(0.29, Z + 2.4);
    const [bx, by] = Fp.F(0.56, Z + 2.4);
    const flick = Math.floor(k.t * 2) % 2;
    for (let i = 0; i < 3; i++) {
      px(p.c, ax + i * 3 * u, ay, '#ff5a3a', Math.max(1, 2 * u), Math.max(1, 3 * u));
      px(p.c, bx + i * 3 * u, by, i === 2 && flick ? '#2a8a4a' : '#5ae08a', Math.max(1, 2 * u), Math.max(1, 3 * u));
    }
    const [gx, gy] = Fp.F(1.0, Z + 1.75);
    px(p.c, gx, gy, '#ffb03a', Math.max(1, 5 * u), Math.max(1, 2 * u));
  },
};

// ── the robot assembly stand ────────────────────────────────
const assembly: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 30, 0.28);
    // the platform: a steel deck with hazard edges and a turntable
    const deck: Mat = (light, w, h) => (u, v, x, y) => {
      if (light !== 2) return Math.floor((u + v) / 5) & 1 ? (light ? YEL[4] : YEL[3]) : HAZK;
      let i = base(2, STEEL.length) - 1;
      const cu = Math.floor(u / 5);
      const cv = Math.floor(v / 4);
      if ((cu + cv) & 1 ? u % 5 > 1 && u % 5 < 4 && v % 4 > 1.4 && v % 4 < 2.4 : u % 5 > 1.6 && u % 5 < 2.6 && v % 4 > 0.6 && v % 4 < 3.2) i += 1;
      if (hash(x, y, 31) < 0.03) i -= 1;
      void w;
      void h;
      return at(STEEL, i);
    };
    lbox(p, 0.12, 0.12, W - 0.24, D - 0.24, 0, 1.2, { front: deck, side: deck, top: deck, edge: STEEL[0] });
    const [tcx, tcy] = anchor(p, W / 2 - 0.1, D / 2 + 0.15, 1.2);
    ell(p.c, tcx, tcy, 40, 20, STEEL[1]);
    ell(p.c, tcx, tcy - 1, 38, 19, '#3a4a58');
    ell(p.c, tcx - 4, tcy - 3, 26, 12, '#465a6a');
    for (let a = 0; a < 16; a++) px(p.c, tcx + Math.cos((a / 16) * Math.PI * 2) * 34, tcy - 1 + Math.sin((a / 16) * Math.PI * 2) * 17, '#2a3440', 2, 1);
    // the gantry: two extrusion posts at the back, a beam across, a chain hoist
    const ext = extrusion(ALU);
    for (const a of [0.2, W - 0.32]) {
      lbox(p, a - 0.06, 0.2, 0.24, 0.24, 1.2, 0.4, mono(dark, STEEL[0]));
      lbox(p, a, 0.26, 0.12, 0.12, 1.6, 31, { front: ext, side: ext, top: ext, edge: ALU[0] });
    }
    lbox(p, 0.16, 0.24, W - 0.32, 0.16, 32.6, 1.5, { front: ext, side: ext, top: ext, edge: ALU[0] });
    // hoist trolley and its chain to the detached arm
    lbox(p, 1.28, 0.2, 0.3, 0.26, 30, 2.6, mono(enamel(YEL), YEL[1]));
    const [hx, hy] = anchor(p, 1.43, 0.36, 30);
    const [ex, ey] = anchor(p, 1.5, 0.5, 18);
    for (let y = hy; y < ey; y += 3) px(p.c, hx + ((y - hy) / (ey - hy)) * (ex - hx) - 1, y, (y / 3) & 1 ? GALV[5] : GALV[3], 3, 2);
    // the humanoid on the turntable (1.8 m), chest open, right arm off
    const [rx, ry] = anchor(p, 0.86, 1.08, 1.2);
    layer(
      p.c,
      (l) => {
        const S = SHELL;
        const J = '#2a2c32';
        // legs: foot, shin, knee, thigh (the far leg a step darker)
        const leg = (ox: number, sh: number) => {
          fillPoly(l, [[rx + ox - 4, ry - 2], [rx + ox + 4, ry - 2], [rx + ox + 5, ry + 1], [rx + ox - 4, ry + 1]], J);
          fillPoly(l, [[rx + ox - 3, ry - 2], [rx + ox + 3, ry - 2], [rx + ox + 2, ry - 16], [rx + ox - 3, ry - 16]], S[3 - sh]);
          px(l, rx + ox - 3, ry - 16, S[5 - sh], 1, 14);
          ell(l, rx + ox, ry - 17.5, 3.2, 2.4, J);
          fillPoly(l, [[rx + ox - 3.5, ry - 19], [rx + ox + 3.5, ry - 19], [rx + ox + 4, ry - 31], [rx + ox - 3.5, ry - 31]], S[4 - sh]);
          px(l, rx + ox - 3, ry - 31, S[6 - sh], 1, 12);
        };
        leg(5, 1);
        leg(-4, 0);
        // pelvis and the torso shell
        fillPoly(l, [[rx - 9, ry - 30], [rx + 9, ry - 30], [rx + 8, ry - 36], [rx - 8, ry - 36]], J);
        fillPoly(l, [[rx - 9, ry - 36], [rx + 10, ry - 36], [rx + 12, ry - 55], [rx - 11, ry - 55]], S[4]);
        fillPoly(l, [[rx - 9, ry - 36], [rx - 6, ry - 36], [rx - 7, ry - 55], [rx - 11, ry - 55]], S[6]);
        fillPoly(l, [[rx + 7, ry - 36], [rx + 10, ry - 36], [rx + 12, ry - 55], [rx + 9, ry - 55]], S[2]);
        px(l, rx - 10, ry - 45, TEAL[4], 21, 1);
        // the open chest: wiring loom, a battery block, the core
        fillPoly(l, [[rx - 5, ry - 39], [rx + 6, ry - 39], [rx + 6, ry - 52], [rx - 5, ry - 52]], '#14161c');
        for (let i = 0; i < 5; i++) ln(l, rx - 4 + i * 2, ry - 51, rx - 4 + i * 2 + (i % 2), ry - 40, ['#d8402e', YEL[4], '#2c62c8', '#3aa058', ORANGE[4]][i]);
        px(l, rx - 3, ry - 50, '#3a3d46', 7, 4);
        px(l, rx - 2, ry - 49, '#5a6070', 5, 2);
        // the chest panel taken off, leaning on the shin
        fillPoly(l, [[rx + 12, ry], [rx + 19, ry - 3], [rx + 18, ry - 17], [rx + 11, ry - 14]], S[3]);
        fillPoly(l, [[rx + 12, ry], [rx + 13, ry - 1], [rx + 12, ry - 15], [rx + 11, ry - 14]], S[5]);
        px(l, rx + 13, ry - 9, TEAL[4], 5, 1);
        // the left arm attached, hanging, a two-finger gripper
        ell(l, rx - 12, ry - 53, 3.5, 3, J);
        fillPoly(l, [[rx - 15, ry - 52], [rx - 10, ry - 52], [rx - 10, ry - 42], [rx - 15, ry - 42]], S[4]);
        px(l, rx - 15, ry - 52, S[6], 1, 10);
        ell(l, rx - 12.5, ry - 41, 2.6, 2, J);
        fillPoly(l, [[rx - 15, ry - 40], [rx - 10, ry - 40], [rx - 10, ry - 30], [rx - 15, ry - 30]], S[3]);
        ln(l, rx - 14, ry - 29, rx - 15, ry - 25, J, 2);
        ln(l, rx - 11, ry - 29, rx - 11, ry - 25, J, 2);
        // the bare right shoulder actuator
        ell(l, rx + 13, ry - 52, 3.6, 3.4, '#3a3d46');
        ell(l, rx + 13, ry - 52, 2, 2, ORANGE[4]);
        // neck and head: a helmet, a dark visor
        px(l, rx - 2, ry - 59, J, 5, 4);
        fillPoly(l, [[rx - 8, ry - 59], [rx + 8, ry - 59], [rx + 9, ry - 68], [rx + 5, ry - 72], [rx - 5, ry - 72], [rx - 9, ry - 68]], S[4]);
        fillPoly(l, [[rx - 8, ry - 59], [rx - 5, ry - 59], [rx - 6, ry - 70], [rx - 9, ry - 68]], S[6]);
        fillPoly(l, [[rx - 6, ry - 62], [rx + 8, ry - 62], [rx + 8, ry - 68], [rx - 6, ry - 68]], '#141820');
        px(l, rx + 9, ry - 66, J, 2, 3);
      },
      { rect: [rx - 22, ry - 78, rx + 24, ry + 4] },
    );
    // the detached right arm hanging from the hoist hook
    layer(
      p.c,
      (l) => {
        ln(l, ex - 3, ey - 2, ex + 3, ey - 2, GALV[4], 2);
        ell(l, ex, ey + 1, 3.2, 2.6, '#3a3d46');
        fillPoly(l, [[ex - 3, ey + 3], [ex + 3, ey + 3], [ex + 3, ey + 14], [ex - 3, ey + 14]], SHELL[3]);
        px(l, ex - 3, ey + 3, SHELL[5], 1, 11);
        ell(l, ex, ey + 15, 2.6, 2, '#2a2c32');
        fillPoly(l, [[ex - 3, ey + 16], [ex + 2, ey + 16], [ex + 2, ey + 26], [ex - 3, ey + 26]], SHELL[2]);
        ln(l, ex - 2, ey + 27, ex - 3, ey + 31, '#2a2c32', 2);
        ln(l, ex + 1, ey + 27, ex + 1, ey + 31, '#2a2c32', 2);
        // its wiring loom hanging out of the shoulder
        ln(l, ex + 2, ey + 2, ex + 7, ey + 10, '#d8402e');
        ln(l, ex + 1, ey + 3, ex + 5, ey + 12, YEL[4]);
      },
      { rect: [ex - 8, ey - 6, ex + 10, ey + 34] },
    );
    // a tablet on a stand at the front with the joint diagnostics, a tool tray
    const [sx, sy] = anchor(p, W - 0.3, D - 0.22, 1.2);
    layer(
      p.c,
      (l) => {
        px(l, sx - 1, sy - 22, STEEL[3], 2, 22);
        ell(l, sx, sy, 5, 2, STEEL[2]);
        fillPoly(l, [[sx - 9, sy - 34], [sx + 9, sy - 38], [sx + 9, sy - 24], [sx - 9, sy - 20]], '#1e1e24');
        fillPoly(l, [[sx - 8, sy - 33], [sx + 8, sy - 37], [sx + 8, sy - 25], [sx - 8, sy - 21]], '#0c1c2a');
      },
      { rect: [sx - 12, sy - 42, sx + 12, sy + 4] },
    );
    lbox(p, 0.22, D - 0.5, 0.5, 0.3, 1.2, 0.8, mono(enamel(RED), RED[1]));
    const [ttx, tty] = anchor(p, 0.47, D - 0.35, 2);
    px(p.c, ttx - 6, tty - 2, GALV[4], 4, 1);
    px(p.c, ttx - 1, tty - 3, '#2c62c8', 5, 2);
    px(p.c, ttx + 3, tty - 1, YEL[4], 4, 1);
    void k;
  },
  anim(p, k) {
    const u = p.k / 4;
    const [rx, ry] = anchor(p, 0.86, 1.08, 1.2);
    // the eye strip breathing, a scanner dot sweeping
    const s = 0.5 + 0.5 * Math.sin(k.t * 2);
    const sweep = Math.round((Math.sin(k.t * 1.6) * 0.5 + 0.5) * 14);
    px(p.c, rx - 5 * u, ry - 66 * u, s > 0.5 ? '#3fe6f2' : '#1e8a96', Math.max(1, 12 * u), Math.max(1, 2 * u));
    px(p.c, rx + (-5 + Math.round(sweep * 0.75)) * u, ry - 66 * u, '#c8fbff', Math.max(1, 2 * u), Math.max(1, 2 * u));
    // the chest core
    px(p.c, rx - 1 * u, ry - 44 * u, s > 0.3 ? '#62e6f0' : '#2a8a96', Math.max(1, 3 * u), Math.max(1, 2 * u));
    // the tablet: joint bars
    const [sx, sy] = anchor(p, 2 - 0.3, 2 - 0.22, 1.2);
    for (let i = 0; i < 5; i++) {
      const h = Math.round((3 + 5 * (0.5 + 0.5 * Math.sin(k.t * 1.3 + i))) * u);
      px(p.c, sx + (-6 + i * 3) * u, sy - 24 * u - h + (i * 0.8 - 2) * u, i === 3 ? '#ffb03a' : '#3fd68a', Math.max(1, 2 * u), Math.max(1, h));
    }
    // the odd spark from the shoulder being fitted
    if (Math.sin(k.t * 5.3) > 0.82) {
      for (let i = 0; i < 4; i++) px(p.c, rx + (13 + Math.cos(i * 1.7 + k.t * 9) * (3 + i)) * u, ry + (-52 + Math.sin(i * 2.1 + k.t * 7) * (2 + i)) * u, i ? '#ffd86a' : '#ffffff', Math.max(1, u), Math.max(1, u));
    }
  },
};

// ── the 3D printer ──────────────────────────────────────────
const printer3d: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.1, 0.92, 0.92, 22, 0.28);
    // the cabinet: slate steel with a glazed door showing the filament store
    lbox(p, 0.1, 0.12, 0.8, 0.78, 0, 7.6, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    const F = front(p, 0.9);
    const S = side(p, 0.9);
    pq(p, F, 0.14, 0.86, 0.6, 7.1, SLATE[F.light ? 2 : 1]);
    pt(p, F, 0.18, 0.66, 1, 6.7, glassMat(GLASS), F.light);
    for (let i = 0; i < 3; i++) {
      const [sx, sy] = F.F(0.28 + i * 0.13, 4.3 - (i % 2) * 2);
      const col = [ORANGE[4], TEAL[5], '#f2f0ea'][i];
      layer(
        p.c,
        (l) => {
          ell(l, sx, sy, 5, 6, '#2a2a30');
          ell(l, sx, sy, 4, 5, col);
          ell(l, sx, sy, 1.6, 2, '#2a2a30');
        },
        { outline: false, rect: [sx - 7, sy - 8, sx + 7, sy + 8] },
      );
    }
    pq(p, F, 0.72, 0.8, 3.2, 4.6, GALV[5]);
    pq(p, S, 0.2, 0.8, 1, 6.6, SLATE[S.light ? 2 : 1]);
    for (let i = 0; i < 6; i++) pq(p, S, 0.3, 0.7, 2 + i * 0.7, 2.25 + i * 0.7, SLATE[0]);
    // the enclosure: black extrusion frame, smoked acrylic panels
    const ext = extrusion(STEEL, false);
    const z0 = 7.6;
    const z1 = 19.2;
    lbox(p, 0.12, 0.14, 0.76, 0.74, z0, 1, mono(dark, STEEL[0]));
    // inside first: the build plate, a gear half printed on its brim, the rails
    const [bx, by] = anchor(p, 0.5, 0.54, z0 + 2.45);
    lbox(p, 0.22, 0.24, 0.56, 0.54, z0 + 2.2, 0.25, { front: dark, side: dark, top: (_l) => (u: number, v: number) => (Math.floor(u) % 9 === 0 || Math.floor(v) % 9 === 0 ? '#34343c' : '#202026'), edge: STEEL[0] });
    layer(
      p.c,
      (l) => {
        ell(l, bx, by, 15, 7.5, '#c86a30');
        ell(l, bx, by, 13, 6.4, '#202026');
        const H = 6;
        for (let j = 0; j < H; j++) ell(l, bx, by - j, 11, 5.5, j % 2 ? ORANGE[2] : ORANGE[3]);
        for (let t = 0; t < 16; t++) {
          const ang = (t / 16) * Math.PI * 2;
          const tx = bx + Math.cos(ang) * 12;
          const ty = by + Math.sin(ang) * 6;
          if (Math.sin(ang) > -0.2) px(l, tx - 1, ty - H, Math.cos(ang) < -0.3 ? ORANGE[4] : ORANGE[2], 3, H);
          else px(l, tx - 1, ty - H, ORANGE[3], 3, 2);
        }
        ell(l, bx, by - H, 11, 5.5, ORANGE[4]);
        ell(l, bx - 2, by - H - 1, 7, 3, ORANGE[5]);
        for (let i = -9; i <= 9; i += 3) ln(l, bx + i - 2, by - H + 2, bx + i + 2, by - H - 2, ORANGE[3]);
        ell(l, bx, by - H, 3.4, 1.8, '#202026');
      },
      { outline: 0.6, rect: [bx - 18, by - 16, bx + 18, by + 10] },
    );
    // the Y rails along both sides
    for (const a of [0.2, 0.78]) lbox(p, a, 0.2, 0.04, 0.62, z0 + 8.4, 0.35, mono(enamel(ALU), ALU[0]));
    for (const a of [0.14, 0.82]) lbox(p, a, 0.16, 0.05, 0.05, z0 + 1, z1 - z0 - 1, { front: ext, side: ext, top: ext, edge: STEEL[0] });
    lbox(p, 0.14, 0.16, 0.72, 0.05, z0 + 8.6, 0.5, mono(enamel(ALU), ALU[0]));
    // smoked acrylic: front and side, see-through with reflections
    p.c.globalAlpha = 0.32;
    pt(p, front(p, 0.88), 0.12, 0.88, z0 + 1, z1, glassMat(['#141c22', '#1c2830', '#24343e', '#2e4450', '#466272', '#6a8a96', '#a8c4cc'], 40), 1);
    pt(p, side(p, 0.88), 0.14, 0.88, z0 + 1, z1, glassMat(['#141c22', '#1c2830', '#24343e', '#2e4450', '#466272', '#6a8a96', '#a8c4cc'], 40), 0);
    p.c.globalAlpha = 1;
    for (const [a, b] of [[0.12, 0.86], [0.84, 0.86], [0.84, 0.14]] as const) lbox(p, a, b - 0.02, 0.05, 0.05, z0 + 1, z1 - z0 - 1, { front: ext, side: ext, top: ext, edge: STEEL[0] });
    lbox(p, 0.12, 0.14, 0.76, 0.74, z1, 0.6, { front: dark, side: dark, top: dark, edge: STEEL[0] });
    // the touch screen and a stack light
    const Ft = front(p, 0.89);
    pq(p, Ft, 0.5, 0.82, z0 + 0.2, z0 + 0.95, '#121418');
    lbox(p, 0.74, 0.22, 0.08, 0.08, z1 + 0.6, 2.6, mono(dark, STEEL[0]));
    // the spool on top feeding the PTFE tube
    const [sx, sy] = anchor(p, 0.38, 0.5, z1 + 0.6);
    layer(
      p.c,
      (l) => {
        px(l, sx - 1, sy - 8, STEEL[3], 2, 8);
        ell(l, sx + 2, sy - 12, 5, 9, '#2a2a30');
        ell(l, sx, sy - 12, 5, 9, ORANGE[3]);
        for (let j = -7; j <= 7; j += 2) px(l, sx - 4, sy - 12 + j, ORANGE[4], 8, 1);
        ell(l, sx - 2, sy - 12, 5, 9, '#2a2a30');
        ell(l, sx - 2, sy - 12, 2, 3.4, '#121214');
      },
      { rect: [sx - 10, sy - 24, sx + 10, sy + 2] },
    );
    void k;
  },
  anim(p, k) {
    const u = p.k / 4;
    const z0 = 7.6;
    // the print head shuttling along its gantry
    const a = 0.3 + (0.5 + 0.5 * Math.sin(k.t * 2.4)) * 0.38;
    const [hx, hy] = anchor(p, a, 0.5, z0 + 8.2);
    px(p.c, hx - 4 * u, hy - 3 * u, '#1e1e24', Math.max(1, 8 * u), Math.max(1, 6 * u));
    px(p.c, hx - 3 * u, hy - 2 * u, ORANGE[4], Math.max(1, 3 * u), Math.max(1, 3 * u));
    px(p.c, hx - u, hy + 3 * u, '#c8c8c8', Math.max(1, 2 * u), Math.max(1, 2 * u));
    // progress on the screen, a green stack light
    const F = front(p, 0.89);
    const [sx, sy] = F.F(0.53, z0 + 0.55);
    const prog = (k.t * 0.04) % 1;
    px(p.c, sx, sy, '#3a6a4a', Math.max(1, 14 * u), Math.max(1, u));
    px(p.c, sx, sy, '#5ae08a', Math.max(1, Math.round(14 * prog) * u), Math.max(1, u));
    const [lx, ly] = anchor(p, 0.78, 0.26, 19.8 + 2.6);
    px(p.c, lx - u, ly - 3 * u, '#3a3a40', Math.max(1, 3 * u), Math.max(1, 3 * u));
    px(p.c, lx - u, ly - 6 * u, Math.sin(k.t * 2) > -0.7 ? LED.green : '#2a6a3a', Math.max(1, 3 * u), Math.max(1, 3 * u));
  },
};

// ── the battery charging dock ───────────────────────────────
const charger: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.06, 0.18, W - 0.06, 0.96, 12, 0.26);
    // the cabinet with a sloped console top
    lbox(p, 0.08, 0.22, W - 0.16, 0.7, 0, 0.5, mono(dark, STEEL[0]));
    lbox(p, 0.1, 0.24, W - 0.2, 0.66, 0.5, 8.4, { front: steel, side: steel, top: steel, edge: SLATE[0] });
    const F = front(p, 0.9);
    const S = side(p, W - 0.1);
    // six bays with battery packs
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 3; i++) {
        const a = 0.18 + i * 0.36;
        const z = 1 + r * 3.4;
        pq(p, F, a, a + 0.3, z, z + 2.9, '#14161a');
        pq(p, F, a + 0.03, a + 0.27, z + 0.2, z + 2.7, '#26282e');
        pq(p, F, a + 0.03, a + 0.27, z + 1.6, z + 2.2, YEL[4]);
        pq(p, F, a + 0.06, a + 0.16, z + 1.75, z + 2.05, '#1e1e24');
      }
    // the control side: a screen, louvres
    pq(p, F, 1.3, W - 0.18, 4.6, 7.8, '#1a1c22');
    pq(p, F, 1.34, W - 0.22, 4.9, 7.5, '#0a1620');
    for (let i = 0; i < 5; i++) pq(p, F, 1.32, W - 0.2, 1.2 + i * 0.6, 1.45 + i * 0.6, SLATE[0]);
    for (let i = 0; i < 7; i++) pq(p, S, 0.32, 0.82, 1.4 + i * 0.9, 1.7 + i * 0.9, SLATE[0]);
    // the yellow bolt sign
    const [tx, ty] = F.F(1.52, 3);
    fillPoly(p.c, [[tx, ty - 6], [tx + 6, ty + 4], [tx - 6, ty + 4]], '#1e1e24');
    fillPoly(p.c, [[tx, ty - 4], [tx + 4, ty + 3], [tx - 4, ty + 3]], YEL[4]);
    ln(p.c, tx + 1, ty - 2, tx - 1, ty + 1, '#1e1e24');
    ln(p.c, tx - 1, ty + 1, tx + 1, ty + 2, '#1e1e24');
    // on top: a charging plate with a rover docked, a coiled lead
    lbox(p, 1.0, 0.3, 0.86, 0.56, 8.9, 0.35, mono(enamel(TEAL), TEAL[1]));
    const [rx, ry] = anchor(p, 1.42, 0.58, 9.25);
    layer(
      p.c,
      (l) => {
        for (const [dx, dy] of [[-12, 1], [10, -9], [-4, 6], [17, -4]] as const) {
          ell(l, rx + dx, ry + dy - 4, 4, 4.5, '#1a1a1e');
          ell(l, rx + dx - 1, ry + dy - 5, 2, 2, '#4a4e58');
        }
        fillPoly(l, [[rx - 16, ry - 6], [rx + 8, ry - 17], [rx + 20, ry - 11], [rx - 4, ry]], SHELL[3]);
        fillPoly(l, [[rx - 16, ry - 6], [rx - 4, ry], [rx - 4, ry - 6], [rx - 16, ry - 12]], SHELL[4]);
        fillPoly(l, [[rx - 4, ry], [rx + 20, ry - 11], [rx + 20, ry - 17], [rx - 4, ry - 6]], SHELL[2]);
        fillPoly(l, [[rx - 16, ry - 12], [rx - 4, ry - 6], [rx + 20, ry - 17], [rx + 8, ry - 23]], SHELL[5]);
        px(l, rx - 13, ry - 10, ORANGE[4], 8, 2);
        // the lidar puck and a little camera mast
        ell(l, rx + 2, ry - 20, 5, 2.6, '#2a2a30');
        px(l, rx - 3, ry - 24, '#1a1a1e', 10, 4);
        ell(l, rx + 2, ry - 25, 5, 2.4, '#3a3d46');
        px(l, rx + 11, ry - 30, STEEL[3], 2, 10);
        px(l, rx + 9, ry - 33, '#1e1e24', 6, 4);
      },
      { rect: [rx - 22, ry - 38, rx + 26, ry + 8] },
    );
    const [cx, cy] = anchor(p, 0.5, 0.6, 8.9);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 3; i++) ell(l, cx + i, cy - 2 - i * 0.6, 9, 4, i & 1 ? '#2a2a30' : '#1e1e24');
        ell(l, cx + 1, cy - 3, 6, 2.4, SLATE[3]);
        px(l, cx + 8, cy - 4, '#ff6a3a', 4, 3);
      },
      { rect: [cx - 12, cy - 10, cx + 14, cy + 4] },
    );
    void k;
  },
  anim(p, k) {
    const F = front(p, 0.9);
    const u = p.k / 4;
    // each pack's charge bar fills at its own pace
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 3; i++) {
        const a = 0.18 + i * 0.36;
        const z = 1 + r * 3.4;
        const lvl = ((k.t * (0.06 + i * 0.02 + r * 0.03) + (i + r * 3) * 0.17) % 1.15) / 1.15;
        const n = Math.min(4, Math.floor(lvl * 5));
        for (let j = 0; j < 4; j++) {
          const [x, y] = F.F(a + 0.06 + j * 0.05, z + 0.7);
          px(p.c, x, y, j < n ? (n >= 4 ? LED.green : LED.amber) : '#2a2c30', Math.max(1, 2 * u), Math.max(1, 2 * u));
        }
      }
    // the console screen: a battery icon pulsing
    const [sx, sy] = F.F(1.4, 7);
    const lv = (Math.sin(k.t * 1.5) * 0.5 + 0.5) * 8;
    px(p.c, sx, sy, '#3fd6e6', Math.max(1, 10 * u), Math.max(1, u));
    px(p.c, sx, sy + 2 * u, '#3fd6e6', Math.max(1, Math.round(lv) * u), Math.max(1, 3 * u));
    px(p.c, sx, sy + 6 * u, '#3fd6e6', Math.max(1, 10 * u), Math.max(1, u));
    // the docked rover's charge light
    const [rx, ry] = anchor(p, 1.42, 0.58, 9.25);
    px(p.c, rx - 9 * u, ry - 9 * u, Math.sin(k.t * 3) > 0 ? LED.green : '#2a6a3a', Math.max(1, 2 * u), Math.max(1, u));
  },
};

// ── the eager test bot ──────────────────────────────────────
const bot: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.56);
    contactShadow(p.c, x + 6, y + 2, 15, 5, 0.3);
    layer(
      p.c,
      (l) => {
        // two big wheels and a caster
        ell(l, x - 9, y - 6, 5, 7, RUBBER[1]);
        ell(l, x - 10, y - 6, 3, 5, RUBBER[3]);
        ell(l, x - 10, y - 6, 1.6, 2.4, ORANGE[4]);
        ell(l, x + 10, y - 7, 5, 7, RUBBER[0]);
        ell(l, x + 11, y - 7, 2, 3, ORANGE[2]);
        // the body: a rounded shell with an orange band and a tool belt
        fillPoly(l, [[x - 9, y - 4], [x + 9, y - 4], [x + 11, y - 22], [x - 11, y - 22]], SHELL[3]);
        fillPoly(l, [[x - 9, y - 4], [x - 4, y - 4], [x - 6, y - 22], [x - 11, y - 22]], SHELL[5]);
        fillPoly(l, [[x + 5, y - 4], [x + 9, y - 4], [x + 11, y - 22], [x + 7, y - 22]], SHELL[1]);
        px(l, x - 11, y - 15, ORANGE[4], 22, 3);
        px(l, x - 11, y - 15, ORANGE[5], 7, 3);
        ell(l, x, y - 23, 11, 3, SHELL[5]);
        // little arms raised, grippers open (eager to help)
        ln(l, x - 11, y - 18, x - 17, y - 26, SHELL[2], 3);
        ln(l, x - 17, y - 26, x - 15, y - 34, SHELL[2], 3);
        ln(l, x - 15, y - 34, x - 18, y - 38, '#2a2a30', 2);
        ln(l, x - 14, y - 34, x - 12, y - 38, '#2a2a30', 2);
        ln(l, x + 11, y - 18, x + 18, y - 24, SHELL[1], 3);
        ln(l, x + 18, y - 24, x + 17, y - 32, SHELL[1], 3);
        ln(l, x + 17, y - 32, x + 14, y - 36, '#2a2a30', 2);
        ln(l, x + 18, y - 32, x + 21, y - 36, '#2a2a30', 2);
        // the neck
        px(l, x - 2, y - 28, '#2a2a30', 4, 5);
      },
      { rect: [x - 24, y - 44, x + 26, y + 4] },
    );
    void k;
  },
  anim(p, k) {
    // the head is live: it bobs, its screen eyes glance around and blink, the antenna light winks
    const u = p.k / 4;
    const [x, y] = anchor(p, 0.5, 0.56);
    const bob = Math.sin(k.t * 3.2) > 0.6 ? 1 : 0;
    const hy = y - 28 * u - bob * u;
    const hx = x;
    const R2 = (dx: number, dy: number, w: number, h: number, col: string) => px(p.c, hx + dx * u, hy + dy * u, col, Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
    R2(-11, -16, 22, 15, '#3a3c44');
    R2(-10, -16, 20, 14, SHELL[4]);
    R2(-10, -16, 4, 14, SHELL[6]);
    R2(-8, -13, 16, 9, '#101620');
    const look = Math.round(Math.sin(k.t * 0.9) * 2);
    const blink = Math.sin(k.t * 1.7 + 1) > 0.95;
    if (blink) {
      R2(-5 + look, -9, 3, 1, LED.cyan);
      R2(2 + look, -9, 3, 1, LED.cyan);
    } else {
      R2(-5 + look, -11, 3, 4, LED.cyan);
      R2(2 + look, -11, 3, 4, LED.cyan);
      R2(-5 + look, -11, 1, 1, '#ffffff');
      R2(2 + look, -11, 1, 1, '#ffffff');
    }
    R2(-2, -6, 4, 1, '#3fb6c8');
    R2(-1, -22, 2, 6, STEEL[3]);
    R2(-2, -25, 4, 3, Math.sin(k.t * 4) > 0 ? '#ff5446' : '#8a2a26');
    R2(-2, -25, 1, 1, '#ffd0c8');
  },
};

export const ROBOTICS_ROOM: Record<string, PropArt> = { workbench, desk, assembly, printer3d, charger, bot };
export { flatQuad, mug, spool, stool, steel, dark };

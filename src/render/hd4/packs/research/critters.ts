// Research Hub — the summit's animals, shaded volumes with hand-placed details.
//   res_marmot  on all fours, scurrying, or sitting up on watch (whistling)
//   res_ibex    a billy with great ridged horns, or a nanny; standing, walking, grazing
//   res_eagle   a golden eagle circling high over the valley
//   res_chough  alpine choughs: black, a yellow beak, red legs, tumbling in the wind
import type { CritterPose } from '../../../critters';
import { type CritterArt, volume } from '../../animals';
import { ell, fillPoly, hash, ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;

const MARMOT = [
  ['#2e2218', '#463424', '#604a32', '#7a6244', '#947c58', '#b0986e'],
  ['#3a2c20', '#54402e', '#70583e', '#8c7250', '#a88c66', '#c4a880'],
];
const IBEX = [
  ['#2e241c', '#463a2e', '#5e4e40', '#786654', '#94806a', '#ae9a82'],
  ['#3a2e22', '#54442f', '#6e5a40', '#8a7454', '#a68e6a', '#c0aa86'],
];
const HORN = ['#221c18', '#342b23', '#4a3e32', '#615343', '#7c6c58', '#9c8a70', '#bcaa8c'];

const marmot = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const f = MARMOT[s.variant % 2];
  if (s.frame >= 2) {
    // sitting up on watch, paws to the chest; frame 3 whistles
    volume(c, [{ x: 9, y: 17, rx: 7, ry: 8, z: 1 }, { x: 10, y: 8, rx: 5.5, ry: 6, z: 2 }, { x: 11, y: 2.5, rx: 4.5, ry: 4, z: 3 }], f, ox, oy);
    px(c, ox + 3, oy + 21, f[0], 5, 3);
    ell(c, ox + 12, oy + 12, 2.5, 2, f[4]);
    px(c, ox + 12, oy + 3, '#1a1418', 2, 2);
    px(c, ox + 12, oy + 3, '#ffffff');
    px(c, ox + 14, oy + 5, s.frame === 3 ? '#3a1a18' : f[4], 2, s.frame === 3 ? 2 : 1);
    px(c, ox + 8, oy - 1, f[1], 3, 2);
    ell(c, ox + 9, oy + 25, 6, 1.5, f[1]);
    return;
  }
  const step = s.frame === 1;
  for (const [lx, d] of [[6, step ? 1 : 0], [10, step ? -1 : 0], [17, step ? -1 : 0], [20, step ? 1 : 0]] as const) {
    ln(c, ox + lx, oy + 18, ox + lx + d, oy + 22, f[1], 2);
  }
  // the bushy dark tail, the round body, the broad head with small ears
  for (let i = 0; i < 6; i++) px(c, ox + 1 - i * 0.4, oy + 13 - i, f[1 + (i & 1)], 3, 2);
  volume(c, [{ x: 12, y: 14, rx: 10, ry: 6.5, z: 1 }, { x: 22, y: 11, rx: 5, ry: 4.5, z: 2 }], f, ox, oy);
  ell(c, ox + 25, oy + 13, 2.5, 2, f[4]);
  px(c, ox + 22, oy + 9, '#1a1418', 2, 2);
  px(c, ox + 22, oy + 9, '#ffffff');
  px(c, ox + 19, oy + 6, f[1], 3, 2);
  px(c, ox + 26, oy + 12, '#1a1418');
};

/**
 * One horn: a tapered cubic Bézier from the skull to the tip (points in head-local coordinates,
 * rotated by the head's pitch), shaded as a rounded rod lit from the upper left, with knotted
 * ridges across its front edge. `far` darkens the one behind.
 */
function horn(c: C, hx: number, hy: number, pitch: number, P: number[][], w0: number, w1: number, ridges: number, far: boolean) {
  const cs = Math.cos(pitch);
  const sn = Math.sin(pitch);
  const Q = P.map(([x, y]) => [hx + x * cs - y * sn, hy + x * sn + y * cs]);
  const N = 72;
  const S: number[][] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    const x = b0 * Q[0][0] + b1 * Q[1][0] + b2 * Q[2][0] + b3 * Q[3][0];
    const y = b0 * Q[0][1] + b1 * Q[1][1] + b2 * Q[2][1] + b3 * Q[3][1];
    const dx = 3 * u * u * (Q[1][0] - Q[0][0]) + 6 * u * t * (Q[2][0] - Q[1][0]) + 3 * t * t * (Q[3][0] - Q[2][0]);
    const dy = 3 * u * u * (Q[1][1] - Q[0][1]) + 6 * u * t * (Q[2][1] - Q[1][1]) + 3 * t * t * (Q[3][1] - Q[2][1]);
    const l = Math.hypot(dx, dy) || 1;
    S.push([x, y, -dy / l, dx / l, w0 + (w1 - w0) * Math.pow(t, 0.8)]);
    x0 = Math.min(x0, x - 3);
    x1 = Math.max(x1, x + 3);
    y0 = Math.min(y0, y - 3);
    y1 = Math.max(y1, y + 3);
  }
  const L = [-0.55, -0.62, 0.56];
  for (let y = Math.floor(y0); y <= y1; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i <= N; i++) {
        const ex = x + 0.5 - S[i][0];
        const ey = y + 0.5 - S[i][1];
        const d = ex * ex + ey * ey;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const [sx, sy, nx, ny, w] = S[bi];
      const t = bi / N;
      const o = (x + 0.5 - sx) * nx + (y + 0.5 - sy) * ny;
      // the knots: every ridge swells the front edge by a pixel, a groove follows it
      const ph = (t * ridges) % 1;
      const knot = t < 0.9 && ph < 0.34 ? 1 : 0;
      const half = w / 2 + (o > 0 ? knot * 0.9 : 0);
      if (bi === 0 && bd > half * half) continue;
      if (Math.abs(o) > half || (bi === N && bd > 0.5)) continue;
      const q = Math.max(-1, Math.min(1, o / half));
      const lz = Math.sqrt(Math.max(0, 1 - q * q));
      let v = (nx * q * L[0] + ny * q * L[1] + lz * L[2]) * 3.2 + 1.4;
      if (knot && o > -half * 0.4) v += 1.1;
      else if (t < 0.9 && ph > 0.34 && ph < 0.52) v -= 0.9;
      if (far) v -= 1.6;
      v -= t * 0.4;
      const k = Math.max(0, Math.min(HORN.length - 1, Math.round(v + (((x ^ y) & 1) ? 0.15 : -0.15))));
      px(c, x, y, HORN[k]);
    }
}

const ibex = (c: C, ox: number, oy0: number, s: { frame: number; variant: number }) => {
  const billy = s.variant % 2 === 0;
  const f = IBEX[s.variant % 2];
  const graze = s.frame === 2;
  const step = s.frame === 1;
  // the sprite is tall enough for the billy's horns above the head
  const oy = oy0 + 10;
  // legs: slim, dark down the front, small hooves; the near pair a shade lighter
  for (const [lx, d, near] of [[10, step ? 2 : 0, 0], [15, step ? -2 : 0, 1], [32, step ? -2 : 0, 0], [37, step ? 2 : 0, 1]] as const) {
    ln(c, ox + lx, oy + 30, ox + lx + d, oy + 46, near ? f[3] : f[2], 3);
    ln(c, ox + lx + 1, oy + 31, ox + lx + d + 1, oy + 45, f[0]);
    px(c, ox + lx + d - 1, oy + 46, '#1e1814', 4, 2);
  }
  // a stocky body with the shoulders high, the neck, the head (lowered when grazing), a short tail
  volume(
    c,
    [
      { x: 22, y: 26, rx: 16, ry: 9.5, z: 1 },
      { x: 31, y: 23, rx: 9, ry: 9, z: 1.5 },
      { x: 38, y: graze ? 30 : 18, rx: 5.5, ry: 8, z: 2 },
    ],
    f,
    ox,
    oy,
  );
  // pale belly, the dark chest
  ell(c, ox + 23, oy + 33, 10, 2.5, f[4]);
  px(c, ox + 39, oy + 25, f[1], 3, 6);
  px(c, ox + 5, oy + 20, f[1], 3, 4);
  const hx = graze ? 43 : 42;
  const hy = graze ? 38 : 11;
  const pitch = graze ? 0.75 : 0;
  // the horn behind first, then the head, then the near horn over it
  const HB = billy
    ? [[-1.5, -3.5], [-4, -16], [-14, -19.5], [-20, -10]]
    : [[-1, -3], [-2, -8.5], [-5, -11.5], [-8.5, -11]];
  const hw0 = billy ? 4.6 : 2.2;
  const hw1 = billy ? 1.4 : 1;
  const nR = billy ? 9 : 3;
  horn(c, ox + hx - 1.5, oy + hy - 1, pitch, HB, hw0 * 0.9, hw1, nR, true);
  volume(c, [{ x: hx, y: hy, rx: 5, ry: 4, z: 3 }, { x: hx + 3.5, y: hy + 1.5, rx: 3, ry: 2.5, z: 3 }], f, ox, oy);
  px(c, ox + hx + 5, oy + hy + 1, f[0], 2, 2);
  px(c, ox + hx - 1, oy + hy - 2, '#1a1418', 2, 2);
  px(c, ox + hx - 1, oy + hy - 2, '#e8c860');
  px(c, ox + hx - 5, oy + hy - 2, f[3], 3, 2);
  // the beard on the billy
  if (billy) for (let i = 0; i < 4; i++) px(c, ox + hx + 2 - i * 0.3, oy + hy + 3 + i, f[0], 2, 1);
  horn(c, ox + hx, oy + hy, pitch, HB, hw0, hw1, nR, false);
};

const eagle = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  // high above its ground point; wings spread wide in a shallow V, fingered tips
  const y0 = oy + 8;
  const x0 = ox + 34;
  const lift = s.frame === 1 ? -3 : 0;
  const B = ['#1e140e', '#2e2016', '#3e2c1e', '#523a26', '#6a4c30', '#8a6a3e'];
  for (const sgn of [-1, 1]) {
    const tip = x0 + sgn * 33;
    fillPoly(c, [[x0, y0 + 2], [x0 + sgn * 12, y0 - 2 + lift], [tip, y0 - 6 + lift * 1.6], [tip - sgn * 2, y0 - 1 + lift], [x0 + sgn * 10, y0 + 5]], B[sgn < 0 ? 3 : 2]);
    // pale bands across the flight feathers, primaries spread like fingers
    ln(c, x0 + sgn * 8, y0 + 3, x0 + sgn * 22, y0 - 1 + lift, B[5]);
    for (let i = 0; i < 4; i++) px(c, tip - sgn * (i * 2), y0 - 6 + lift * 1.6 + i, B[1], 2, 2);
  }
  // body, the golden nape, the tail fanned
  ell(c, x0, y0 + 2, 4, 6, B[2]);
  ell(c, x0, y0 - 3, 3, 3, '#a87a3a');
  px(c, x0 - 1, y0 - 6, '#e8b830', 2, 2);
  fillPoly(c, [[x0 - 3, y0 + 7], [x0 + 3, y0 + 7], [x0 + 4, y0 + 13], [x0 - 4, y0 + 13]], B[3]);
  px(c, x0 - 4, y0 + 12, B[1], 9, 1);
};

const chough = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const x0 = ox + 9;
  const y0 = oy + 6;
  const up = s.frame === 0 ? -4 : s.frame === 1 ? 0 : 3;
  const K = ['#0e0c12', '#18161e', '#24222c', '#34323e'];
  fillPoly(c, [[x0 - 1, y0], [x0 - 9, y0 + up], [x0 - 7, y0 + up + 2], [x0, y0 + 2]], K[2]);
  fillPoly(c, [[x0 + 1, y0], [x0 + 9, y0 + up - 1], [x0 + 8, y0 + up + 1], [x0 + 1, y0 + 2]], K[1]);
  ell(c, x0, y0 + 1, 2.5, 2, K[2]);
  px(c, x0 + 2, y0, '#f0c830', 2, 1);
  px(c, x0 - 2, y0 + 3, K[0], 3, 2);
  px(c, x0 - 1, y0 + 4, '#c8382a', 1, 1);
  void hash;
};

const moveFrame = (p: CritterPose, walk: number, idle: number[]) => (p.moving ? (Math.sin(p.phase * 2.2) > 0 ? walk : 0) : idle[Math.floor((Math.sin(p.phase * 0.3 + p.seed) + 1) * 0.5 * idle.length) % idle.length]);

export const RESEARCH_CRITTERS: Record<string, CritterArt> = {
  res_marmot: { paint: marmot, w: 30, h: 28, ax: 13, ay: 24, frames: 4, variants: 2, speed: 0.025, frameOf: (p) => moveFrame(p, 1, [0, 2, 3, 2, 0]) },
  res_ibex: { paint: ibex, w: 54, h: 62, ax: 24, ay: 58, frames: 3, variants: 2, speed: 0.012, frameOf: (p) => moveFrame(p, 1, [0, 2, 2]) },
  res_eagle: { paint: eagle, w: 70, h: 220, ax: 34, ay: 218, frames: 2, variants: 1, speed: 0.03, fly: true, frameOf: (p) => (Math.sin(p.phase * 0.4) > 0.7 ? 1 : 0) },
  res_chough: { paint: chough, w: 20, h: 70, ax: 9, ay: 66, frames: 3, variants: 1, speed: 0.09, fly: true, frameOf: (p) => Math.floor(p.phase * 1.5 + p.seed) % 3 },
};

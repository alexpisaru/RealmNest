// Data Center — the site's own life: arctic foxes (white and blue morph), reindeer
// (dark and pale) digging for lichen, and ravens hopping round the bins.
// Bodies are shaded volumes (see hd4/animals volume); details are hand placed.
import type { CritterPose } from '../../../critters';
import { type CritterArt, volume } from '../../animals';
import { ell, fillPoly, ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;

const FOX_W = ['#848a98', '#a4aab8', '#c4cad6', '#dce2ea', '#edf1f6', '#fbfdff'];
const FOX_B = ['#2e2a28', '#443e3a', '#5c544e', '#766c64', '#90847a', '#aa9e92'];

const fox: CritterArt['paint'] = (c, ox, oy, s) => {
  const fur = s.variant % 2 ? FOX_B : FOX_W;
  const f = s.frame;
  const trot = f >= 1;
  const lift = f === 1 ? 1 : 0;
  // legs: short, a little darker, alternating at the trot
  for (const [lx, d] of [[9, f === 1 ? 2 : f === 2 ? -2 : 0], [12, f === 1 ? -2 : f === 2 ? 2 : 0], [19, f === 1 ? -2 : f === 2 ? 2 : 0], [22, f === 1 ? 2 : f === 2 ? -2 : 0]] as const) {
    ln(c, ox + lx, oy + 16 - lift, ox + lx + d, oy + 22, fur[2], 2);
    px(c, ox + lx + d - 1, oy + 22, fur[1], 3, 1);
  }
  // the brush: a big plume held low behind, swinging at the trot
  volume(c, [{ x: 4, y: 14 + (trot ? -1 : 2), rx: 6.5, ry: 4, z: 0 }, { x: 8, y: 13, rx: 4, ry: 3.5, z: 0.5 }], fur, ox, oy - lift);
  volume(c, [{ x: 15, y: 13, rx: 9, ry: 5.4, z: 1 }, { x: 23, y: 9, rx: 4.6, ry: 4.4, z: 2 }, { x: 27, y: 10, rx: 2.6, ry: 1.8, z: 3 }], fur, ox, oy - lift);
  const hx = ox + 23;
  const hy = oy + 9 - lift;
  // small round ears, a black nose, a dark eye
  fillPoly(c, [[hx - 4, hy - 3], [hx - 3, hy - 8], [hx, hy - 4]], fur[3]);
  fillPoly(c, [[hx, hy - 4], [hx + 2, hy - 8], [hx + 3, hy - 3]], fur[2]);
  px(c, hx + 6, hy, '#141218', 2, 2);
  px(c, hx + 1, hy - 2, '#141218', 2, 2);
  px(c, hx + 1, hy - 2, '#ffffff');
  px(c, hx - 1, hy + 3, fur[5], 4, 1);
};

const RD_D = ['#2a2019', '#3c2e24', '#503e30', '#66503e', '#7e644e', '#967a62'];
const RD_P = ['#46403c', '#5e5650', '#786f66', '#928778', '#ac9f90', '#c4b8aa'];
const MANE = ['#8a8070', '#a89c88', '#c4b8a2', '#dcd2bc', '#ece4d2', '#f8f2e4'];

const reindeer: CritterArt['paint'] = (c, ox, oy, s) => {
  // drawn at 1.3× the base sketch so it stands at a reindeer's height beside the crew
  const S = 1.3;
  const X = (v: number) => ox + Math.round(v * S);
  const Y = (v: number) => oy + Math.round(v * S);
  const body = s.variant % 2 ? RD_P : RD_D;
  const graze = s.frame === 1;
  const walk = s.frame === 2;
  // legs with pale socks
  for (const [lx, d] of [[17, walk ? 2 : 0], [21, walk ? -2 : 0], [33, walk ? -2 : 0], [37, walk ? 2 : 0]] as const) {
    ln(c, X(lx), Y(32), X(lx + d), Y(47), body[1], 3);
    px(c, X(lx + d) - 1, Y(43), MANE[4], 4, 4);
    px(c, X(lx + d) - 1, Y(47), '#1a1410', 4, 2);
  }
  // the body with a pale belly line, a small white rump patch and stubby tail
  volume(c, [{ x: 27 * S, y: 27 * S, rx: 15 * S, ry: 8.5 * S, z: 1 }], body, ox, oy);
  volume(c, [{ x: 13.5 * S, y: 25 * S, rx: 3 * S, ry: 4 * S, z: 1.5 }], MANE, ox, oy);
  px(c, X(10), Y(21), MANE[4], 3, 2);
  for (let i = 0; i < 18; i++) px(c, X(17 + i), Y(34.5), body[0], 2, 1);
  const hx = graze ? 45 : 47;
  const hy = graze ? 37 : 13;
  // the neck: pale, carrying a shaggy beard of long hair under the throat
  volume(c, [{ x: 39 * S, y: (graze ? 30 : 21) * S, rx: 5.5 * S, ry: (graze ? 5.5 : 8) * S, z: 2 }], MANE, ox, oy);
  if (!graze) for (let i = 0; i < 7; i++) ln(c, X(37 + i), Y(25), X(37.4 + i), Y(29 + (i % 3)), MANE[i % 2 ? 2 : 3]);
  // the long head: brow, a long face, the dark velvety muzzle, an ear laid back
  volume(c, [{ x: (hx - 1) * S, y: hy * S, rx: 4.6 * S, ry: 3.8 * S, z: 3 }, { x: (hx + 4) * S, y: (hy + 1.2) * S, rx: 4.4 * S, ry: 2.6 * S, z: 3.5 }, { x: (hx + 7.5) * S, y: (hy + 1.6) * S, rx: 2.2 * S, ry: 2 * S, z: 4, ramp: MANE }], body, ox, oy);
  px(c, X(hx + 8), Y(hy + 1), '#2a201a', 3, 2);
  fillPoly(c, [[X(hx - 4), Y(hy - 2)], [X(hx - 9), Y(hy - 4)], [X(hx - 4), Y(hy)]], body[2]);
  // the antlers: two beams sweeping back and up, tines forward, the brow shovel
  const ax = X(hx - 2);
  const ay = Y(hy - 4);
  const T = (v: number) => Math.round(v * S);
  for (const [sd, col] of [[0, '#8a7a64'], [4, '#b8a888']] as const) {
    ln(c, ax + sd, ay, ax + T(-6) + sd, ay + T(-9), col, 2);
    ln(c, ax + T(-6) + sd, ay + T(-9), ax + T(-4) + sd, ay + T(-18), col);
    ln(c, ax + T(-4) + sd, ay + T(-18), ax + T(2) + sd, ay + T(-22), col);
    ln(c, ax + T(-5) + sd, ay + T(-12), ax + T(1) + sd, ay + T(-14), col);
    ln(c, ax + T(-3) + sd, ay + T(-17), ax + T(3) + sd, ay + T(-17), col);
    ln(c, ax + T(1) + sd, ay + T(-1), ax + T(5) + sd, ay + T(-3), col);
  }
  // eye and nose
  px(c, X(hx), Y(hy - 1.5), '#141010', 2, 2);
  px(c, X(hx) + 1, Y(hy - 1.5), '#e8e0d0');
  // snow kicked up where it digs for lichen
  if (graze) for (let i = 0; i < 7; i++) px(c, X(hx - 4 + i * 2), Y(hy + 6) - (i % 3), '#eef2f8', 2, 1);
};

const RAVEN = ['#08080e', '#10121c', '#1a1e2c', '#262c40', '#38425c', '#52608a'];
const raven: CritterArt['paint'] = (c, ox, oy, s) => {
  const peck = s.frame === 1;
  ln(c, ox + 9, oy + 13, ox + 9, oy + 16, '#2a2a30');
  ln(c, ox + 12, oy + 13, ox + 12, oy + 16, '#2a2a30');
  // the wedge tail, the body, the shaggy throat, the head with its heavy beak
  fillPoly(c, [[ox + 1, oy + 10], [ox + 7, oy + 8], [ox + 7, oy + 12], [ox, oy + 13]], RAVEN[1]);
  volume(c, [{ x: 10, y: 10, rx: 6.5, ry: 4.2, z: 1 }], RAVEN, ox, oy);
  const hx = peck ? 17 : 16;
  const hy = peck ? 12 : 5;
  volume(c, [{ x: hx, y: hy, rx: 3.2, ry: 3, z: 2 }], RAVEN, ox, oy);
  fillPoly(c, [[ox + hx + 2, oy + hy - 1], [ox + hx + 7, oy + hy + 1], [ox + hx + 2, oy + hy + 2]], '#2a2e38');
  px(c, ox + hx, oy + hy - 1, '#c8d0e0');
  ell(c, ox + 8, oy + 9, 4, 1.5, RAVEN[4]);
};

const step = (p: CritterPose, n: number) => (p.moving ? 1 + (Math.sin(p.phase * 2.2) > 0 ? 0 : 1) * (n - 2 >= 1 ? 1 : 0) : 0);

export const DC_CRITTERS: Record<string, CritterArt> = {
  dc_fox: { paint: fox, w: 34, h: 26, ax: 15, ay: 22, frames: 3, variants: 2, speed: 0.05, frameOf: (p) => step(p, 3) },
  dc_reindeer: {
    paint: reindeer,
    w: 76,
    h: 66,
    ax: 35,
    ay: 62,
    frames: 3,
    variants: 2,
    speed: 0.012,
    frameOf: (p: CritterPose) => (p.moving ? 2 : Math.sin(p.phase * 0.15 + p.seed) > -0.3 ? 1 : 0),
  },
  dc_raven: { paint: raven, w: 26, h: 18, ax: 10, ay: 16, frames: 2, variants: 1, speed: 0.035, frameOf: (p: CritterPose) => (p.moving ? (Math.sin(p.phase * 2.4) > 0.3 ? 1 : 0) : Math.sin(p.phase * 0.8 + p.seed) > 0.4 ? 1 : 0) },
};

void (null as unknown as C);

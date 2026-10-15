// Chemical Lab — the campus's own wildlife (ducks are built in):
//   lab_heron      a grey heron stalking the pond's shallows (neck up / striking)
//   lab_rabbit     rabbits on the lawns (sitting / hopping), two coats
//   lab_dragonfly  blue dragonflies over the reeds (flying)
import type { CritterPose } from '../../../critters';
import { type CritterArt, volume } from '../../animals';
import { ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;

const GREY = ['#3a3e48', '#555a66', '#727884', '#9196a0', '#b2b6be', '#d2d6dc'];
const WHITE = ['#8a8e94', '#acb0b6', '#cdd0d4', '#e4e6e8', '#f2f4f4', '#ffffff'];

const heron = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const strike = s.frame === 1;
  // long thin legs standing in the shallows, a ripple ring round them
  ln(c, ox + 13, oy + 32, ox + 12, oy + 38, '#8a7e52');
  ln(c, ox + 12, oy + 38, ox + 13, oy + 44, '#8a7e52');
  ln(c, ox + 17, oy + 32, ox + 18, oy + 44, '#6e6440');
  for (let i = -5; i < 32; i += 3) px(c, ox + i, oy + 44 + (i % 6 === 0 ? 0 : 1), '#a8d8dc', 2, 1);
  // the body: a long grey wedge, high at the shoulder, sloping to the tail; dark flight feathers below
  volume(c, [{ x: 16, y: 26, rx: 11, ry: 6.5, z: 1 }, { x: 6, y: 30, rx: 7, ry: 3.5, z: 0 }], GREY, ox, oy);
  px(c, ox + 4, oy + 30, '#2a2e38', 9, 2);
  px(c, ox + 8, oy + 28, GREY[1], 10, 2);
  px(c, ox + 10, oy + 24, GREY[4], 8, 1);
  // breast plumes hanging at the front
  for (let i = 0; i < 4; i++) px(c, ox + 22 + i, oy + 26 + (i % 2), WHITE[3 + (i % 2)], 1, 7 - i);
  // the neck: an S-curve resting, stretched forward when it strikes; white with a dark streak down the front
  const P0: [number, number] = [23, 23];
  const P1: [number, number] = strike ? [30, 20] : [19, 13];
  const P2: [number, number] = strike ? [37, 22] : [24, 4];
  let hx = P2[0];
  let hy = P2[1];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const qx = (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0];
    const qy = (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1];
    px(c, ox + qx - 1, oy + qy - 1, WHITE[4], 3, 3);
    if (i % 2 === 0 && i < 12) px(c, ox + qx + 1, oy + qy, '#2a2a32', 1, 1);
    hx = qx;
    hy = qy;
  }
  // the head: white with a black stripe from the eye to the plume, a long yellow dagger bill
  volume(c, [{ x: hx, y: hy - 1, rx: 3, ry: 2.6, z: 3 }], WHITE, ox, oy);
  ln(c, ox + hx - 1, oy + hy - 3, ox + hx - 7, oy + hy - 2, '#1a1a20');
  ln(c, ox + hx - 5, oy + hy - 2, ox + hx - 9, oy + hy, '#1a1a20');
  const bx = strike ? 9 : 8;
  ln(c, ox + hx + 2, oy + hy - 1, ox + hx + 2 + bx, oy + hy + (strike ? 2 : 0), '#e8a828', 2);
  px(c, ox + hx + 2, oy + hy - 2, '#f2d24a', 2, 1);
  px(c, ox + hx, oy + hy - 2, '#e8c040', 1, 1);
};

const rabbit = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const fur = s.variant % 2 ? ['#4a3a2e', '#6a5442', '#8a6e56', '#a88a6e', '#c4a68a', '#dcc2a6'] : ['#4a4644', '#66605c', '#847c76', '#a29890', '#bcb2aa', '#d6ccc4'];
  const hop = s.frame === 1;
  if (hop) {
    volume(c, [{ x: 10, y: 11, rx: 9, ry: 5, z: 1 }, { x: 19, y: 7, rx: 4.5, ry: 4, z: 2 }], fur, ox, oy);
    px(c, ox + 2, oy + 13, fur[1], 6, 2);
    px(c, ox + 15, oy + 13, fur[2], 4, 2);
  } else {
    volume(c, [{ x: 9, y: 11, rx: 7, ry: 6, z: 1 }, { x: 15, y: 6, rx: 4.5, ry: 4, z: 2 }], fur, ox, oy);
    px(c, ox + 11, oy + 15, fur[3], 4, 2);
  }
  const hx = hop ? 19 : 15;
  const hy = hop ? 7 : 6;
  // long ears, the white scut, an eye
  ln(c, ox + hx - 2, oy + hy - 3, ox + hx - 4, oy + hy - 10, fur[2], 2);
  ln(c, ox + hx, oy + hy - 3, ox + hx + 1, oy + hy - 10, fur[3], 2);
  px(c, ox + hx - 3, oy + hy - 8, '#d8a0a0', 1, 3);
  px(c, ox + (hop ? 1 : 2), oy + (hop ? 9 : 10), '#f6f2ea', 3, 3);
  px(c, ox + hx + 1, oy + hy - 1, '#1a1418', 1, 1);
};

const dragonfly = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const up = s.frame === 0;
  // the abdomen (blue, segmented), thorax, head; four glassy wings
  for (let i = 0; i < 10; i++) px(c, ox + 2 + i, oy + 6, i % 3 === 0 ? '#1a3a8a' : s.variant % 2 ? '#3aa0e0' : '#4ac0a0', 1, 1);
  px(c, ox + 12, oy + 5, '#2a5aa8', 3, 3);
  px(c, ox + 15, oy + 5, '#2a6a58', 2, 2);
  const wy = up ? 2 : 4;
  for (const dx of [10, 13]) {
    px(c, ox + dx - 1, oy + wy, '#d8eef8', 2, 3);
    px(c, ox + dx - 5, oy + wy - (up ? 1 : 0), '#e8f6fc', 5, 1);
    px(c, ox + dx + 1, oy + wy + (up ? 0 : 1), '#e8f6fc', 5, 1);
  }
};

export const CHEMLAB_CRITTERS: Record<string, CritterArt> = {
  lab_heron: {
    paint: heron,
    w: 46,
    h: 48,
    ax: 14,
    ay: 44,
    frames: 2,
    variants: 1,
    speed: 0.006,
    frameOf: (p: CritterPose) => (Math.sin(p.phase * 0.18 + p.seed) > 0.75 ? 1 : 0),
  },
  lab_rabbit: {
    paint: rabbit,
    w: 26,
    h: 18,
    ax: 10,
    ay: 16,
    frames: 2,
    variants: 2,
    speed: 0.025,
    frameOf: (p: CritterPose) => (p.moving && Math.sin(p.phase * 2.2) > 0.2 ? 1 : 0),
  },
  lab_dragonfly: {
    paint: dragonfly,
    w: 18,
    h: 10,
    ax: 9,
    ay: 9,
    frames: 2,
    variants: 2,
    speed: 0.32,
    fly: true,
    frameOf: (p: CritterPose) => (Math.sin(p.phase * 5) > 0 ? 0 : 1),
  },
};

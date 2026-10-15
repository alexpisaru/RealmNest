// Creative Studio — the seaside's own life: herring gulls on the sand and the
// boardwalk (standing, strutting, calling; adults and mottled juveniles),
// gulls gliding overhead, and little shore crabs scuttling by the water.
import type { CritterArt } from '../../animals';
import { volume } from '../../animals';
import { ell, fillPoly, ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;
const WHITE = ['#8a8c94', '#aeb0b6', '#cfd0d4', '#e6e6e8', '#f4f4f4', '#ffffff'];
const MANTLE = ['#4e5662', '#646c78', '#7c8490', '#949ca6', '#acb2ba', '#c4c8ce'];
const JUV = ['#4a3e34', '#625446', '#7c6c5a', '#968670', '#ae9e88', '#c6b8a2'];

const gull: CritterArt = {
  w: 30,
  h: 26,
  ax: 13,
  ay: 23,
  frames: 3,
  variants: 2,
  speed: 0.04,
  paint(c: C, ox, oy, s) {
    const juv = s.variant % 2 === 1;
    const walk = s.frame === 1;
    const call = s.frame === 2;
    // pink legs
    ln(c, ox + 11, oy + 17, ox + (walk ? 9 : 11), oy + 22, '#d88a7a');
    ln(c, ox + 14, oy + 17, ox + (walk ? 16 : 14), oy + 22, '#c87868');
    px(c, ox + (walk ? 8 : 10), oy + 22, '#c87868', 3, 1);
    px(c, ox + (walk ? 15 : 13), oy + 22, '#b86858', 3, 1);
    // tail, body, folded wing, head
    const body = juv ? JUV : WHITE;
    volume(c, [{ x: 4, y: 11, rx: 5, ry: 2.6, z: 0 }, { x: 12, y: 12, rx: 9, ry: 5.4, z: 1 }], body, ox, oy);
    const hx = call ? 21 : 20;
    const hy = call ? 3 : 6;
    volume(c, [{ x: hx - 2, y: hy + 3, rx: 3.4, ry: 4, z: 2 }, { x: hx, y: hy, rx: 4, ry: 3.6, z: 3 }], juv ? JUV : WHITE, ox, oy);
    // the grey mantle and the folded wing with black primaries and white spots
    if (!juv) {
      fillPoly(c, [[ox + 4, oy + 9], [ox + 16, oy + 8], [ox + 18, oy + 12], [ox + 7, oy + 14]], MANTLE[3]);
      fillPoly(c, [[ox + 6, oy + 9], [ox + 15, oy + 8.5], [ox + 15, oy + 10], [ox + 7, oy + 11]], MANTLE[4]);
      fillPoly(c, [[ox + 1, oy + 10], [ox + 6, oy + 9], [ox + 7, oy + 13], [ox + 1, oy + 12]], '#1e1e24');
      px(c, ox + 2, oy + 10, '#ffffff', 1, 1);
      px(c, ox + 4, oy + 11, '#ffffff', 1, 1);
    } else {
      for (let i = 0; i < 6; i++) px(c, ox + 5 + i * 2, oy + 9 + (i % 2), JUV[1], 2, 1);
    }
    // the yellow bill with its red spot, open when calling; a pale eye
    if (call) {
      fillPoly(c, [[ox + hx + 3, oy + hy - 1], [ox + hx + 9, oy + hy - 4], [ox + hx + 4, oy + hy]], '#f2c84a');
      fillPoly(c, [[ox + hx + 3, oy + hy + 1], [ox + hx + 8, oy + hy + 2], [ox + hx + 3, oy + hy + 2]], '#e8b03e');
    } else {
      px(c, ox + hx + 3, oy + hy, '#f2c84a', 6, 2);
      px(c, ox + hx + 7, oy + hy + 1, '#e0402a', 1, 1);
    }
    px(c, ox + hx + 1, oy + hy - 2, '#1a1418', 2, 2);
    px(c, ox + hx + 1, oy + hy - 2, '#f6e6a0', 1, 1);
  },
  frameOf: (p) => (p.moving ? (Math.sin(p.phase * 2.2) > 0 ? 1 : 0) : Math.sin(p.phase * 0.35 + p.seed) > 0.85 ? 2 : 0),
};

const gullFly: CritterArt = {
  w: 38,
  h: 74,
  ax: 19,
  ay: 72,
  frames: 3,
  variants: 1,
  speed: 0.05,
  fly: true,
  paint(c: C, ox, oy, s) {
    // drawn high in its box: gulls glide well above the beach
    const y = oy + 8;
    const x = ox + 19;
    const f = s.frame;
    const tip = f === 0 ? -9 : f === 1 ? -2 : 5;
    const mid = f === 0 ? -5 : f === 1 ? -1 : 2;
    for (const side of [-1, 1]) {
      fillPoly(c, [[x, y], [x + side * 8, y + mid], [x + side * 17, y + tip], [x + side * 15, y + tip + 3], [x + side * 7, y + mid + 4], [x, y + 3]], side < 0 ? MANTLE[4] : MANTLE[2]);
      fillPoly(c, [[x + side * 14, y + tip], [x + side * 17, y + tip], [x + side * 15, y + tip + 3], [x + side * 12, y + tip + 3]], '#1e1e24');
    }
    ell(c, x, y + 2, 4, 2.4, WHITE[4]);
    ell(c, x + 4, y + 1, 2.4, 2, WHITE[5]);
    px(c, x + 6, y + 1, '#f2c84a', 3, 1);
    px(c, x - 5, y + 2, WHITE[3], 3, 2);
  },
  frameOf: (p) => {
    const ph = Math.sin(p.phase * 0.9 + p.seed);
    return ph > 0.6 ? 0 : ph < -0.6 ? 2 : 1;
  },
};

const crab: CritterArt = {
  w: 20,
  h: 13,
  ax: 10,
  ay: 11,
  frames: 2,
  variants: 2,
  speed: 0.03,
  paint(c: C, ox, oy, s) {
    const col = s.variant % 2 ? ['#6a2214', '#8a2e1a', '#ac4024', '#c85a32', '#dc7848', '#ea9a6a'] : ['#5a3a1e', '#7a5028', '#9a6834', '#b48444', '#c89c5a', '#dab478'];
    const f = s.frame;
    for (let i = 0; i < 3; i++) {
      const lx = ox + 6 + i * 4;
      ln(c, lx, oy + 8, lx - 3 + (f ? 1 : -1), oy + 11, col[1]);
      ln(c, lx, oy + 8, lx + 3 + (f ? -1 : 1), oy + 11, col[1]);
    }
    volume(c, [{ x: 10, y: 7, rx: 6, ry: 3.4, z: 1 }], col, ox, oy);
    // claws raised and the eye stalks
    ell(c, ox + 3, oy + 4 - f, 2.4, 2, col[3]);
    ell(c, ox + 17, oy + 4 - (1 - f), 2.4, 2, col[3]);
    px(c, ox + 8, oy + 2, '#1a1418', 1, 2);
    px(c, ox + 11, oy + 2, '#1a1418', 1, 2);
  },
  frameOf: (p) => (p.moving && Math.sin(p.phase * 3) > 0 ? 1 : 0),
};

export const STUDIO_CRITTERS: Record<string, CritterArt> = { std_gull: gull, std_gullFly: gullFly, std_crab: crab };

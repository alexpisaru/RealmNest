// Logistics Port — the harbour's own life (see CritterArt in hd4/animals).
//   gull       herring gulls on the quay: standing, strutting, pecking; adult
//              and a mottled brown juvenile
//   gullfly    gulls wheeling high over the harbour (drawn well above their
//              ground point, wings up / level / down / gliding)
//   cormorant  a cormorant on the breakwater, wings hung out to dry
//   seal       a harbour seal swimming in the basin, its head up, a V wake
import type { CritterPose } from '../../../critters';
import type { CritterArt } from '../../animals';
import { volume } from '../../animals';
import { fillPoly, ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;

const WHITE = ['#8e9294', '#b0b4b4', '#cfd2d0', '#e6e8e4', '#f4f6f2', '#ffffff'];
const GREY = ['#4e5662', '#646c78', '#7a838e', '#929aa4', '#aab2ba', '#c2c8ce'];
const BROWN = ['#4a3a2c', '#5e4a38', '#745c46', '#8a7058', '#a0866c', '#b89e84'];

const gullPaint = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  const juv = s.variant % 3 === 2;
  const body = juv ? BROWN : WHITE;
  const back = juv ? BROWN : GREY;
  const step = s.frame === 1;
  const peck = s.frame === 2;
  // pink legs
  ln(c, ox + 11, oy + 17, ox + 11 + (step ? 1 : 0), oy + 21, '#d08a7a');
  ln(c, ox + 14, oy + 17, ox + 14 - (step ? 1 : 0), oy + 21, '#b87464');
  px(c, ox + 10 + (step ? 1 : 0), oy + 21, '#c07868', 3, 1);
  px(c, ox + 13 - (step ? 1 : 0), oy + 21, '#a86454', 3, 1);
  // tail, body, folded wing with black tips
  volume(c, [{ x: 4, y: 12, rx: 4, ry: 2.4, z: 0, ramp: back }, { x: 12, y: 13, rx: 8, ry: 5, z: 1 }], body, ox, oy);
  volume(c, [{ x: 10, y: 11, rx: 7.5, ry: 3.2, z: 2 }], back, ox, oy);
  px(c, ox + 1, oy + 11, '#1e1e24', 4, 2);
  px(c, ox + 2, oy + 11, '#f2f2ee', 1, 1);
  if (juv) for (let i = 0; i < 6; i++) px(c, ox + 6 + i * 2, oy + 10 + (i % 2), BROWN[1], 1, 1);
  // head, eye, the yellow bill with its red spot (down when pecking)
  const hx = peck ? 21 : 18;
  const hy = peck ? 14 : 6;
  volume(c, [{ x: hx, y: hy, rx: 3.6, ry: 3.4, z: 3 }], body, ox, oy);
  px(c, ox + hx + 1, oy + hy - 1, '#2a2226', 1, 1);
  px(c, ox + hx + 3, oy + hy, juv ? '#3a3a3a' : '#f2c43a', 4, 1);
  px(c, ox + hx + 3, oy + hy + 1, juv ? '#2a2a2a' : '#e2b02a', 3, 1);
  if (!juv) px(c, ox + hx + 5, oy + hy + 1, '#d8402a', 1, 1);
  if (!peck) px(c, ox + 15, oy + 8, body[5], 3, 4);
};

const gull: CritterArt = {
  paint: gullPaint,
  w: 26,
  h: 24,
  ax: 12,
  ay: 21,
  frames: 3,
  variants: 3,
  speed: 0.02,
  frameOf: (p: CritterPose) => (p.moving ? (Math.sin(p.phase * 2) > 0 ? 1 : 0) : Math.sin(p.phase * 0.7 + p.seed) > 0.55 ? 2 : 0),
};

// ── gulls in flight ──────────────────────────────────────────
const FLY_H = 150;
const gullFlyPaint = (c: C, ox: number, oy: number, s: { frame: number; variant: number }) => {
  // drawn near the top of a tall box: the anchor (the ground point) is far below
  const x = ox + 22;
  const y = oy + 12;
  const f = s.frame;
  const wingTip = f === 0 ? -9 : f === 1 ? -2 : f === 2 ? 6 : -4;
  const wingMid = f === 0 ? -6 : f === 1 ? -1 : f === 2 ? 3 : -2;
  // wings: grey above with black tips, a white trailing edge
  for (const dir of [-1, 1]) {
    const pts: [number, number][] = [[x, y], [x + dir * 9, y + wingMid], [x + dir * 20, y + wingTip], [x + dir * 19, y + wingTip + 2], [x + dir * 8, y + wingMid + 3], [x, y + 3]];
    fillPoly(c, pts, dir < 0 ? GREY[3] : GREY[2]);
    px(c, x + dir * 17 - (dir < 0 ? 2 : 0), y + wingTip, '#1e1e24', 4, 2);
    ln(c, x + dir * 2, y + 3, x + dir * 15, y + wingTip + 3, '#f2f2ee');
  }
  // body and head, bill, tail
  fillPoly(c, [[x - 6, y + 1], [x + 7, y], [x + 9, y + 2], [x + 6, y + 4], [x - 6, y + 4]], WHITE[4]);
  px(c, x + 8, y, WHITE[5], 3, 3);
  px(c, x + 11, y + 1, '#f2c43a', 2, 1);
  px(c, x - 9, y + 1, WHITE[3], 4, 2);
  px(c, x + 9, y + 1, '#2a2226', 1, 1);
  if (s.variant % 2) px(c, x - 3, y + 2, WHITE[2], 6, 1);
};

const gullfly: CritterArt = {
  paint: gullFlyPaint,
  w: 44,
  h: FLY_H,
  ax: 22,
  ay: FLY_H - 2,
  frames: 4,
  variants: 2,
  speed: 0.045,
  fly: true,
  frameOf: (p: CritterPose) => {
    const cyc = (p.phase * 0.35 + p.seed) % 6;
    if (cyc > 3.5) return 3; // gliding
    return Math.floor(cyc * 2) % 3;
  },
};

// ── a cormorant drying its wings ─────────────────────────────
const DARK = ['#141418', '#1c1c22', '#26262e', '#30303a', '#3c3c48', '#4a4a58'];
const cormorant: CritterArt = {
  paint: (c, ox, oy, s) => {
    const spread = s.frame === 0;
    // feet and a tail propping it up
    px(c, ox + 13, oy + 31, '#2a2a30', 4, 1);
    px(c, ox + 17, oy + 31, '#2a2a30', 4, 1);
    ln(c, ox + 15, oy + 27, ox + 15, oy + 31, '#2a2a30');
    ln(c, ox + 18, oy + 27, ox + 18, oy + 31, '#2a2a30');
    px(c, ox + 9, oy + 26, DARK[1], 5, 3);
    // body upright, wings hung out in a W or folded
    volume(c, [{ x: 16, y: 20, rx: 5.5, ry: 8, z: 1 }], DARK, ox, oy);
    if (spread) {
      for (const dir of [-1, 1]) {
        const wx = ox + 16 + dir * 5;
        fillPoly(c, [[wx, oy + 14], [wx + dir * 10, oy + 9], [wx + dir * 14, oy + 13], [wx + dir * 13, oy + 22], [wx + dir * 4, oy + 21]], dir < 0 ? DARK[3] : DARK[2]);
        for (let i = 0; i < 4; i++) ln(c, wx + dir * (3 + i * 3), oy + 12, wx + dir * (3 + i * 3), oy + 21, DARK[1]);
      }
    } else volume(c, [{ x: 15, y: 19, rx: 4.5, ry: 6.5, z: 2 }], DARK, ox, oy);
    // the long neck, head with a hooked bill and the yellow throat patch
    ln(c, ox + 17, oy + 13, ox + 19, oy + 6, DARK[3], 2);
    volume(c, [{ x: 19, y: 5, rx: 3, ry: 2.6, z: 3 }], DARK, ox, oy);
    px(c, ox + 21, oy + 5, '#3a3a3a', 4, 1);
    px(c, ox + 25, oy + 6, '#3a3a3a', 1, 1);
    px(c, ox + 20, oy + 6, '#e2b03a', 2, 1);
    px(c, ox + 19, oy + 4, '#3ab08a', 1, 1);
  },
  w: 34,
  h: 34,
  ax: 16,
  ay: 31,
  frames: 2,
  variants: 1,
  speed: 0.002,
  frameOf: (p: CritterPose) => (Math.sin(p.phase * 0.08 + p.seed) > -0.4 ? 0 : 1),
};

// ── a harbour seal ───────────────────────────────────────────
const SEAL = ['#2a2a28', '#3a3a36', '#4c4a44', '#5e5c54', '#726e64', '#888476'];
const seal: CritterArt = {
  paint: (c, ox, oy, s) => {
    const up = s.frame === 0;
    // the wake: a V of foam behind, rings round the body
    for (let i = 0; i < 6; i++) {
      px(c, ox + 2 + i * 2, oy + 16 - i, '#d8ece6', 2, 1);
      px(c, ox + 2 + i * 2, oy + 18 + i * 0.5, '#c2ddd5', 2, 1);
    }
    for (let i = 0; i < 9; i++) px(c, ox + 10 + i * 2, oy + 19, i % 2 ? '#a8ccc4' : '#d8ece6', 2, 1);
    // the back just breaking the surface, the round head
    volume(c, [{ x: 18, y: 17, rx: 8, ry: 2.6, z: 1 }], SEAL, ox, oy);
    const hy = up ? 10 : 14;
    volume(c, [{ x: 26, y: hy, rx: 4.6, ry: 4.2, z: 2 }], SEAL, ox, oy);
    px(c, ox + 27, oy + hy - 1, '#141414', 1, 1);
    px(c, ox + 29, oy + hy - 1, '#141414', 1, 1);
    px(c, ox + 29, oy + hy + 1, '#1e1e1e', 2, 1);
    for (let i = 0; i < 5; i++) px(c, ox + 18 + i * 2, oy + 15 + (i % 2), SEAL[0], 1, 1);
  },
  w: 36,
  h: 22,
  ax: 18,
  ay: 18,
  frames: 2,
  variants: 1,
  speed: 0.012,
  frameOf: (p: CritterPose) => (Math.sin(p.phase * 0.3 + p.seed) > -0.3 ? 0 : 1),
};

export const PORT_CRITTERS: Record<string, CritterArt> = { gull, gullfly, cormorant, seal };

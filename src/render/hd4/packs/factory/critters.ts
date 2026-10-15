// Factory — the estate's own wildlife (pigeons and cats are built in).
//   fac_gull  a herring gull loafing on the wharf: standing, strutting, stretching its wings
//   fac_rat   a brown rat nosing round the coal heap and the skip
import type { CritterArt } from '../../animals';
import { volume } from '../../animals';
import type { CritterPose } from '../../../critters';

type C = CanvasRenderingContext2D;

const GULL = ['#8a8c96', '#a8aab2', '#c6c8ce', '#dfe0e4', '#efeff2', '#fbfbfc'];
const WING = ['#4a5260', '#5e6674', '#727a88', '#8a92a0', '#a2aab6'];
const RAT = ['#2a2220', '#3a302a', '#4c3e34', '#5e4e40', '#72604e', '#867260'];

function px(c: C, x: number, y: number, col: string, w = 1, h = 1) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

const gull: CritterArt = {
  w: 30,
  h: 28,
  ax: 13,
  ay: 25,
  frames: 3,
  variants: 2,
  speed: 0.03,
  paint(c, ox, oy, s) {
    const stretch = s.frame === 2;
    const step = s.frame === 1;
    // pink legs
    px(c, ox + 11, oy + 19, '#d88a7a', 1, 6);
    px(c, ox + 15 + (step ? 1 : 0), oy + 19, '#c87a6a', 1, 6);
    px(c, ox + 10, oy + 25, '#c87a6a', 3, 1);
    px(c, ox + 14 + (step ? 1 : 0), oy + 25, '#b86a5a', 3, 1);
    // tail, body, the grey mantle, head
    volume(c, [{ x: 4, y: 14, rx: 4, ry: 2.4, z: 0, ramp: WING }, { x: 12, y: 14, rx: 9, ry: 6, z: 1 }, { x: 20, y: 7, rx: 4.6, ry: 4.4, z: 3 }], GULL, ox, oy);
    if (stretch) {
      // wings raised in a stretch
      for (let i = 0; i < 9; i++) {
        px(c, ox + 6 + i, oy + 9 - i * 1.1, WING[2 + (i & 1)], 2, 3);
        px(c, ox + 8 + i, oy + 6 - i * 1.2, WING[3], 2, 2);
      }
      px(c, ox + 14, oy - 3, '#1e1e24', 3, 2);
    } else {
      volume(c, [{ x: 10, y: 12, rx: 8, ry: 3.6, z: 2 }], WING, ox, oy);
      // black wingtips with white spots
      px(c, ox + 1, oy + 12, '#1e1e24', 5, 2);
      px(c, ox + 2, oy + 12, '#f2f2f4');
    }
    // yellow bill with a red spot, a pale fierce eye
    px(c, ox + 24, oy + 6, '#f2c83a', 4, 2);
    px(c, ox + 26, oy + 7, '#d8402e', 1, 1);
    px(c, ox + 21, oy + 5, '#f6e8a0', 2, 1);
    px(c, ox + 22, oy + 5, '#1e1e24');
    if (s.variant % 2) px(c, ox + 18, oy + 3, '#c8c8ce', 4, 2);
  },
  frameOf(p: CritterPose) {
    if (p.moving) return Math.sin(p.phase * 2.2) > 0 ? 1 : 0;
    return Math.sin(p.phase * 0.35 + p.seed) > 0.85 ? 2 : 0;
  },
};

const rat: CritterArt = {
  w: 22,
  h: 12,
  ax: 10,
  ay: 10,
  frames: 2,
  variants: 1,
  speed: 0.09,
  paint(c, ox, oy, s) {
    const run = s.frame === 1;
    // a long naked tail, the body, the pointed head
    for (let i = 0; i < 9; i++) px(c, ox + 1 + i * 0.9, oy + 7 + Math.sin(i * 0.7 + (run ? 1 : 0)) * 1.2, '#b88a7a', 1, 1);
    volume(c, [{ x: 11, y: 6, rx: 5.5, ry: 3.4, z: 1 }, { x: 16.5, y: 6, rx: 3, ry: 2.4, z: 2 }], RAT, ox, oy);
    px(c, ox + 19, oy + 6, '#d8a090', 1, 1);
    px(c, ox + 16, oy + 4, '#141012');
    px(c, ox + 14, oy + 2, '#a87a6a', 2, 1);
    px(c, ox + 9 + (run ? 1 : 0), oy + 9, RAT[1], 1, 2);
    px(c, ox + 13 - (run ? 1 : 0), oy + 9, RAT[1], 1, 2);
  },
  frameOf(p: CritterPose) {
    return p.moving && Math.sin(p.phase * 4) > 0 ? 1 : 0;
  },
};

export const FACTORY_CRITTERS: Record<string, CritterArt> = { fac_gull: gull, fac_rat: rat };

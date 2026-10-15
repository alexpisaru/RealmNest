// Space — the station's own life: a hovering maintenance drone, a hull-crawling
// inspection robot and astronauts on EVA in magnetic boots (shaded volumes).
import type { CritterPose } from '../../../critters';
import { type CritterArt, volume } from '../../animals';
import { ell, ln, px } from '../../kit4';

type C = CanvasRenderingContext2D;

const SUIT = ['#6e7484', '#9298a6', '#b6bbc6', '#d4d8e0', '#eaecf0', '#fbfcfd'];
const GOLDV = ['#5a3a12', '#8a5a1a', '#b8862c', '#e0b448', '#f6dc8a'];
const BOT = ['#3a3e4c', '#555b6c', '#737a8c', '#959cac', '#b8bec9', '#dadee5'];
const DRONE = ['#2a2e3a', '#3e4454', '#565e70', '#727b8e', '#929bae', '#b6bdcc'];

/** A maintenance drone: a disc body, four ducted fans, a camera eye, a status light. */
const drone: CritterArt = {
  w: 30,
  h: 20,
  ax: 15,
  ay: 18,
  frames: 2,
  variants: 2,
  speed: 0.05,
  fly: true,
  paint(c: C, ox: number, oy: number, s) {
    const amber = s.variant % 2 === 1;
    // fans: rings with a blur of blades (frame swaps the blade angle)
    for (const [fx, fy] of [[5, 7], [25, 7], [8, 12], [22, 12]] as const) {
      ell(c, ox + fx, oy + fy, 5, 2.4, DRONE[1]);
      ell(c, ox + fx, oy + fy, 3.6, 1.6, '#1a1c24');
      if (s.frame === 0) ln(c, ox + fx - 3, oy + fy, ox + fx + 3, oy + fy, DRONE[3]);
      else ln(c, ox + fx - 1, oy + fy - 1, ox + fx + 1, oy + fy + 1, DRONE[3]);
    }
    ln(c, ox + 9, oy + 8, ox + 21, oy + 8, DRONE[2], 2);
    volume(c, [{ x: 15, y: 8, rx: 8, ry: 5.5, z: 1 }, { x: 15, y: 5, rx: 5, ry: 3, z: 2, ramp: amber ? ['#6a3410', '#93501a', '#bb6e22', '#de8c2c', '#f2a83e', '#f8c46a'] : ['#9aa2b0', '#c4cad4', '#dfe3e9', '#eef0f4', '#f8f9fb', '#ffffff'] }], DRONE, ox, oy);
    // the camera eye and a little manipulator arm
    ell(c, ox + 21, oy + 9, 2.4, 2.2, '#121620');
    px(c, ox + 21, oy + 8, '#7adde2', 2, 2);
    ln(c, ox + 12, oy + 13, ox + 10, oy + 17, DRONE[3]);
    px(c, ox + 8, oy + 17, DRONE[4], 3, 1);
    px(c, ox + 14, oy + 2, s.frame === 0 ? '#46b456' : '#165428', 2, 1);
  },
};

/** An inspection crawler: a low body on six legs, a camera mast with a cyan eye. */
const crawler: CritterArt = {
  w: 32,
  h: 24,
  ax: 15,
  ay: 21,
  frames: 2,
  variants: 2,
  speed: 0.02,
  frameOf: (p: CritterPose) => (p.moving && Math.sin(p.phase * 2.2) > 0 ? 1 : 0),
  paint(c: C, ox: number, oy: number, s) {
    const step = s.frame === 1;
    // six legs, alternating
    for (let i = 0; i < 3; i++) {
      const lx = ox + 8 + i * 7;
      const up = (i % 2 === 0) === step ? -1 : 0;
      ln(c, lx, oy + 14, lx - 3, oy + 20 + up, BOT[1], 2);
      ln(c, lx + 2, oy + 14, lx + 5, oy + 20 - up - 1, BOT[2], 1);
      px(c, lx - 4, oy + 20 + up, BOT[0], 3, 1);
    }
    volume(c, [{ x: 15, y: 12, rx: 11, ry: 4.6, z: 1 }, { x: 22, y: 10, rx: 4, ry: 3, z: 2 }], s.variant ? BOT : SUIT, ox, oy);
    px(c, ox + 6, oy + 11, '#de8c2c', 12, 1);
    // the mast and the camera head
    ln(c, ox + 22, oy + 9, ox + 23, oy + 2, BOT[2], 2);
    px(c, ox + 21, oy + 0, BOT[1], 7, 4);
    px(c, ox + 26, oy + 1, '#7adde2', 2, 2);
    px(c, ox + 9, oy + 9, '#e04a3c', 2, 1);
  },
};

/** An astronaut on EVA: white suit, backpack, gold visor, magnetic boots, a tether. */
const eva: CritterArt = {
  w: 40,
  h: 76,
  ax: 18,
  ay: 72,
  frames: 3,
  variants: 2,
  speed: 0.012,
  frameOf: (p: CritterPose) => (p.moving ? (Math.sin(p.phase * 1.2) > 0 ? 1 : 2) : 0),
  paint(c: C, ox: number, oy: number, s) {
    const stripe = s.variant % 2 ? '#e04a3c' : '#de8c2c';
    const f = s.frame;
    const legA = f === 1 ? 3 : f === 2 ? -3 : 0;
    // legs and boots
    for (const [lx, d, ramp] of [[14, -legA, 2], [21, legA, 3]] as const) {
      volume(c, [{ x: lx + d * 0.3, y: 54, rx: 4.4, ry: 8, z: 1 }, { x: lx + d * 0.7, y: 64, rx: 3.8, ry: 6, z: 1 }], SUIT, ox, oy);
      px(c, ox + lx + d - 4, oy + 68, '#5a6070', 9, 4);
      px(c, ox + lx + d - 4, oy + 68, '#8a92a4', 9, 1);
      void ramp;
    }
    // the backpack behind, the torso, the chest unit with a stripe
    volume(c, [{ x: 10, y: 30, rx: 7, ry: 11, z: 0 }], ['#4a505e', '#6a7080', '#8e94a2', '#b0b6c2', '#ccd0d8', '#e2e5ea'], ox, oy);
    volume(c, [{ x: 18, y: 34, rx: 9, ry: 12, z: 1 }, { x: 18, y: 45, rx: 8, ry: 5, z: 1 }], SUIT, ox, oy);
    px(c, ox + 14, oy + 32, '#c8ccd4', 9, 6);
    px(c, ox + 15, oy + 33, '#3a3e48', 3, 1);
    px(c, ox + 19, oy + 33, '#46b456', 2, 1);
    px(c, ox + 19, oy + 35, '#e04a3c', 2, 1);
    px(c, ox + 10, oy + 46, '#5a6378', 17, 3);
    // arms: one reaching forward with a pistol-grip tool when working
    volume(c, [{ x: 12, y: 36, rx: 3.6, ry: 9, z: 2 }], SUIT, ox, oy);
    px(c, ox + 9, oy + 31, stripe, 6, 2);
    if (f === 0) {
      volume(c, [{ x: 27, y: 33, rx: 6, ry: 3.4, z: 2 }], SUIT, ox, oy);
      px(c, ox + 31, oy + 31, '#d7dce6', 4, 4);
      px(c, ox + 34, oy + 30, '#3a3e48', 5, 3);
      px(c, ox + 37, oy + 31, '#de8c2c', 2, 1);
    } else volume(c, [{ x: 24, y: 37, rx: 3.6, ry: 9, z: 2 }], SUIT, ox, oy);
    // the helmet: shell, gold visor with a reflection, two lamps
    volume(c, [{ x: 19, y: 15, rx: 8.5, ry: 8.5, z: 3 }], SUIT, ox, oy);
    ell(c, ox + 21, oy + 16, 6, 5, GOLDV[2]);
    ell(c, ox + 20, oy + 15, 4, 3.2, GOLDV[3]);
    px(c, ox + 18, oy + 13, GOLDV[4], 3, 2);
    px(c, ox + 12, oy + 9, '#f2f4f6', 3, 3);
    px(c, ox + 25, oy + 8, '#fff4d0', 3, 3);
    // the tether trailing from the waist
    ln(c, ox + 9, oy + 47, ox + 2, oy + 60, '#e8e2d0');
    ln(c, ox + 2, oy + 60, ox + 1, oy + 74, '#e8e2d0');
  },
};

export const SPACE_CRITTERS: Record<string, CritterArt> = {
  spc_drone: drone,
  spc_crawler: crawler,
  spc_eva: eva,
};

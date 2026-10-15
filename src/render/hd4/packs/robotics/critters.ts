// Robotics — the airfield's own life: quadcopters out on test flights, a
// six-wheeled rover on its rounds, brown hares in the dry grass.
import type { CritterArt } from '../../animals';
import { volume } from '../../animals';
import { ell, fillPoly, ln, px } from '../../kit4';
import { quad } from './airfield';

/** A quadcopter test flight: two rotor-blur phases; variant 0 dark, 1 white. */
const rob_drone: CritterArt = {
  w: 34,
  h: 22,
  ax: 17,
  ay: 18,
  frames: 2,
  variants: 2,
  speed: 0.22,
  fly: true,
  frameOf: (p) => Math.floor(p.phase * 2) % 2,
  paint(c, ox, oy, s) {
    const x = ox + 17;
    const y = oy + 10;
    quad(c, x, y, 1, 1 + s.frame);
    if (s.variant === 1) {
      fillPoly(c, [[x - 6, y], [x + 1, y - 4], [x + 7, y - 1], [x, y + 3]], '#e8e8ea');
      px(c, x - 2, y - 2, '#2b98aa', 4, 1);
    }
    // the blur's alternate phase: offset blade glints
    const g = s.frame ? '#ffffff' : '#c8d0d8';
    for (const [dx, dy] of [[-12, -2], [6, -6], [-6, 6], [12, 2]] as const) px(c, x + dx + (s.frame ? 2 : -2), y + dy - 3, g, 2, 1);
  },
};

/** A small six-wheeled rover with a camera mast: wheel spokes turn between the two frames. */
const rob_rover: CritterArt = {
  w: 38,
  h: 30,
  ax: 18,
  ay: 26,
  frames: 2,
  variants: 2,
  speed: 0.05,
  frameOf: (p) => (p.moving ? Math.floor(p.phase * 1.5) % 2 : 0),
  paint(c, ox, oy, s) {
    const body = s.variant ? ['#5a2210', '#a84822', '#cc622c', '#ea8240', '#f6a462'] : ['#5e6066', '#9a9ca4', '#cfd0d4', '#e2e3e5', '#f6f6f8'];
    const x = ox + 18;
    const y = oy + 26;
    // rocker-bogie: three wheels a side (near side drawn over the far side)
    for (const dx of [-11, 0, 11]) {
      ell(c, x + dx + 2, y - 6, 4, 4, '#1a1a1e');
    }
    ln(c, x - 11, y - 8, x + 11, y - 9, '#3a3a40', 2);
    // the deck: a box with a solar panel and a camera mast
    fillPoly(c, [[x - 13, y - 10], [x + 13, y - 10], [x + 12, y - 17], [x - 12, y - 17]], body[2]);
    fillPoly(c, [[x - 13, y - 10], [x - 8, y - 10], [x - 8, y - 17], [x - 12, y - 17]], body[3]);
    px(c, x - 12, y - 19, '#1e2a44', 24, 2);
    for (let i = 0; i < 6; i++) px(c, x - 11 + i * 4, y - 19, '#3a4a6a', 1, 2);
    px(c, x + 8, y - 27, '#3a3a40', 2, 8);
    px(c, x + 5, y - 30, '#26282e', 8, 4);
    px(c, x + 10, y - 29, '#62e6f0', 2, 2);
    for (const dx of [-11, 0, 11]) {
      ell(c, x + dx, y - 5, 4.4, 4.4, '#141418');
      ell(c, x + dx, y - 5, 2, 2, '#5a5c64');
      const a = s.frame ? 0.8 : 0;
      ln(c, x + dx - Math.cos(a) * 3, y - 5 - Math.sin(a) * 3, x + dx + Math.cos(a) * 3, y - 5 + Math.sin(a) * 3, '#8a8c94');
    }
  },
};

const HARE = ['#3e2a1c', '#5a3e28', '#7a5636', '#9a7048', '#b88c5e', '#d2aa7a'];
/** A brown hare: sitting up (0) or mid-hop (1, 2). */
const rob_hare: CritterArt = {
  w: 32,
  h: 26,
  ax: 14,
  ay: 23,
  frames: 3,
  variants: 2,
  speed: 0.035,
  frameOf: (p) => (p.moving ? 1 + (Math.floor(p.phase * 1.2) % 2) : 0),
  paint(c, ox, oy, s) {
    const x = ox;
    const y = oy;
    const dark = s.variant === 1;
    const ramp = dark ? HARE.map((h, i) => (i < 5 ? HARE[Math.max(0, i - 1)] : h)) : HARE;
    if (s.frame === 0) {
      // sitting: haunch, upright chest, head with long black-tipped ears
      volume(c, [{ x: 10, y: 17, rx: 8, ry: 6, z: 1 }, { x: 16, y: 12, rx: 5, ry: 6, z: 2 }, { x: 19, y: 6, rx: 4, ry: 3.6, z: 3 }], ramp, x, y);
      fillPoly(c, [[x + 16, y + 3], [x + 15, y - 7], [x + 17, y - 7], [x + 18, y + 3]], ramp[3]);
      fillPoly(c, [[x + 19, y + 3], [x + 20, y - 6], [x + 22, y - 6], [x + 21, y + 3]], ramp[2]);
      px(c, x + 15, y - 8, '#1a1418', 2, 2);
      px(c, x + 20, y - 7, '#1a1418', 2, 2);
      px(c, x + 20, y + 5, '#1a1418', 1, 1);
      px(c, x + 5, y + 14, '#f2ece0', 3, 3);
      px(c, x + 14, y + 21, ramp[1], 5, 1);
    } else {
      const st = s.frame === 1;
      // stretched mid-hop: long body, hind legs back, forelegs reaching
      volume(c, [{ x: 9, y: 14, rx: 8, ry: 5, z: 1 }, { x: 18, y: 12, rx: 6, ry: 4.4, z: 2 }, { x: 25, y: 9, rx: 4, ry: 3.4, z: 3 }], ramp, x, y);
      fillPoly(c, [[x + 24, y + 6], [x + 20, y - 3], [x + 22, y - 4], [x + 26, y + 6]], ramp[3]);
      px(c, x + 20, y - 4, '#1a1418', 2, 2);
      px(c, x + 26, y + 8, '#1a1418', 1, 1);
      ln(c, x + 4, y + 16, st ? x - 2 : x + 2, y + 21, ramp[1], 2);
      ln(c, x + 20, y + 15, st ? x + 26 : x + 23, y + 20, ramp[1], 2);
      px(c, x + 1, y + 11, '#f2ece0', 3, 3);
    }
  },
};

const SWAN = ['#7a8088', '#a4aab0', '#c8ccd0', '#e2e4e6', '#f2f3f4', '#ffffff'];
/** A mute swan gliding on the pond: the neck in an S, orange bill; frame 1 dips the head. */
const rob_swan: CritterArt = {
  w: 34,
  h: 30,
  ax: 15,
  ay: 24,
  frames: 2,
  variants: 1,
  speed: 0.03,
  frameOf: (p) => (p.moving ? 0 : Math.floor(p.phase * 0.4) % 2),
  paint(c, ox, oy, s) {
    const x = ox;
    const y = oy;
    // ripples round the body
    px(c, x + 2, y + 25, '#9ccce4', 26, 1);
    px(c, x + 6, y + 27, '#7cb8d6', 18, 1);
    volume(c, [{ x: 13, y: 20, rx: 11, ry: 5.4, z: 1 }, { x: 6, y: 18, rx: 6, ry: 4.6, z: 2 }], SWAN, x, y);
    // the folded wing's edge and the raised tail
    ln(c, x + 4, y + 17, x + 18, y + 19, SWAN[2]);
    fillPoly(c, [[x + 22, y + 16], [x + 27, y + 13], [x + 25, y + 19]], SWAN[3]);
    if (s.frame === 0) {
      // the neck up in an S, the head, the orange bill with its black knob
      ln(c, x + 5, y + 16, x + 4, y + 6, SWAN[4], 3);
      ln(c, x + 4, y + 6, x + 6, y + 2, SWAN[5], 3);
      ell(c, x + 4, y + 2, 2.6, 2, SWAN[5]);
      px(c, x, y + 2, '#e8782a', 3, 2);
      px(c, x + 2, y + 1, '#1a1418', 2, 2);
    } else {
      ln(c, x + 5, y + 16, x + 1, y + 13, SWAN[4], 3);
      ell(c, x, y + 15, 2.6, 2, SWAN[5]);
      px(c, x - 3, y + 16, '#e8782a', 3, 2);
    }
  },
};

export const ROBOTICS_CRITTERS: Record<string, CritterArt> = { rob_drone, rob_rover, rob_hare, rob_swan };

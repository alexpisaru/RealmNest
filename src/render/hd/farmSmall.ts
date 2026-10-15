// HD Farm small props and garden furniture.
import { darken, lighten } from '../color';
import type { PropArt } from '../props';
import { canopy, ellipse, hh, OUTL, px, RAMP, type Ramp, rng, siding, solid, stones, tbox, groundShadow } from './kit';
import { potHD } from './farmBuildings';
import { castShadow } from './plane';

const wood = (r: Ramp = RAMP.wood) => ({ left: siding(r, 3), right: siding(r, 3), top: siding(r, 3), edge: r[0] });
const flat = (r: Ramp) => ({ left: solid(r), right: solid(r), top: solid(r), edge: r[0] });

/** Garden armchair (Adirondack style), cushion in the prop colour. Faces the prop front. */
const armchair: PropArt = {
  draw(p, k) {
    const cush = k.color ?? '#d9a066';
    const cr: Ramp = [darken(cush, 0.45), darken(cush, 0.28), darken(cush, 0.12), cush, lighten(cush, 0.18), lighten(cush, 0.32)];
    castShadow(p, 0.2, 0.2, 0.6, 0.6, 22, 0.22);
    for (const [a, b] of [[0.22, 0.25], [0.72, 0.25], [0.22, 0.75], [0.72, 0.75]] as const) tbox(p, a, b - 0.05, 0.06, 0.06, 0, 7, flat(RAMP.woodPale));
    tbox(p, 0.2, 0.2, 0.6, 0.6, 7, 2.5, wood(RAMP.woodPale));
    tbox(p, 0.24, 0.26, 0.52, 0.5, 9.5, 2.5, flat(cr));
    // back rest
    tbox(p, 0.2, 0.15, 0.6, 0.1, 9, 15, wood(RAMP.woodPale));
    tbox(p, 0.24, 0.24, 0.52, 0.08, 11, 10, flat(cr));
    // arm rests
    for (const a of [0.14, 0.78]) tbox(p, a, 0.2, 0.08, 0.62, 14, 1.8, flat(RAMP.woodPale));
  },
};

const cafeTable: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 7, y + 2, 14, 5, 0.25);
    px(p.c, x - 1, y - 14, OUTL, 4, 14);
    px(p.c, x, y - 14, RAMP.iron[2], 2, 14);
    ellipse(p.c, x, y - 1, 7, 2, OUTL);
    ellipse(p.c, x, y - 15, 15, 7.5, OUTL);
    ellipse(p.c, x, y - 15.5, 14, 6.5, RAMP.wood[3]);
    ellipse(p.c, x - 2, y - 16.5, 9, 4, RAMP.wood[4]);
    for (let i = -10; i <= 10; i += 5) px(p.c, x + i, y - 19 + Math.abs(i) * 0.15, RAMP.wood[2], 1, 7);
    // tea set: teapot + cups
    ellipse(p.c, x + 2, y - 21, 4, 3, OUTL);
    ellipse(p.c, x + 2, y - 21, 3, 2.4, '#f2ead8');
    px(p.c, x + 1, y - 23, '#c84e3e', 2, 1);
    px(p.c, x - 7, y - 18, OUTL, 4, 3);
    px(p.c, x - 6, y - 18, '#fbf4e4', 2, 2);
    px(p.c, x + 7, y - 17, OUTL, 4, 3);
    px(p.c, x + 8, y - 17, '#fbf4e4', 2, 2);
  },
};

const picnic: PropArt = {
  draw(p) {
    castShadow(p, 0.05, 0.05, 1.9, 0.9, 16, 0.22);
    // benches on both long sides + table top
    for (const b of [0.02, 0.8]) {
      tbox(p, 0.15, b, 1.7, 0.18, 6, 2.5, wood());
      for (const a of [0.25, 1.65]) tbox(p, a, b + 0.06, 0.08, 0.06, 0, 6, flat(RAMP.wood));
    }
    for (const a of [0.35, 1.55]) tbox(p, a, 0.3, 0.1, 0.4, 0, 12, flat(RAMP.wood));
    tbox(p, 0.05, 0.25, 1.9, 0.5, 12, 2.5, wood());
    // checked cloth runner + a basket and a jug
    const R = rng(3);
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 3; j++) {
        const [x, y] = p.P(0.5 + i * 0.09, 0.32 + j * 0.13, 14.6);
        px(p.c, x, y, (i + j) % 2 ? '#d84a3a' : '#fbf4e4', 3, 2);
      }
    const [bx, by] = p.P(1.45, 0.45, 15);
    px(p.c, bx - 5, by - 7, OUTL, 11, 8);
    px(p.c, bx - 4, by - 6, RAMP.hay[2], 9, 6);
    for (let i = 0; i < 4; i++) px(p.c, bx - 4 + i * 2, by - 6, RAMP.hay[0], 1, 6);
    px(p.c, bx - 3, by - 10, RAMP.wood[1], 7, 1);
    ellipse(p.c, bx - 1, by - 8, 3, 2, '#e2553b');
    ellipse(p.c, bx + 2, by - 8, 2.5, 2, '#9fd060');
    void R;
  },
};

const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    castShadow(p, 0.05, 0.25, W - 0.1, 0.5, 18, 0.22);
    for (const a of [0.12, W - 0.18]) tbox(p, a, 0.3, 0.06, 0.4, 0, 7, flat(RAMP.iron));
    tbox(p, 0.05, 0.3, W - 0.1, 0.42, 7, 2.5, wood(RAMP.woodPale));
    tbox(p, 0.05, 0.25, W - 0.1, 0.06, 9, 11, wood(RAMP.woodPale));
    for (const a of [0.12, W - 0.18]) tbox(p, a, 0.24, 0.06, 0.08, 9, 12, flat(RAMP.iron));
    // a cushion and a book left on the seat
    tbox(p, 0.3, 0.36, 0.5, 0.3, 9.5, 1.5, flat(RAMP.red));
    const [x, y] = p.P(W - 0.6, 0.5, 10);
    px(p.c, x - 3, y - 2, OUTL, 7, 3);
    px(p.c, x - 2, y - 2, '#4a6aa8', 5, 1);
  },
};

const birdbath: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 8, y + 2, 14, 5, 0.28);
    tbox(p, 0.3, 0.3, 0.4, 0.4, 0, 3, { left: stones(RAMP.stone, 3, 0.3), right: stones(RAMP.stone, 3, 0.3), top: solid(RAMP.stone), edge: RAMP.stone[0] });
    px(p.c, x - 4, y - 24, OUTL, 9, 20);
    px(p.c, x - 3, y - 24, RAMP.stone[4], 3, 19);
    px(p.c, x, y - 24, RAMP.stone[3], 3, 19);
    px(p.c, x + 3, y - 24, RAMP.stone[2], 1, 19);
    ellipse(p.c, x, y - 26, 15, 6.5, OUTL);
    ellipse(p.c, x, y - 26.5, 14, 5.5, RAMP.stone[3]);
    ellipse(p.c, x, y - 27.5, 11, 3.8, RAMP.water[3]);
    ellipse(p.c, x - 3, y - 28, 4, 1.4, RAMP.water[5]);
    // ivy on the pedestal
    canopy(p.c, x - 2, y - 8, 5, 6, k.seed, { ramp: RAMP.leafWarm, rmin: 1.6, rmax: 2.4 });
  },
};

const lanternPost: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 6, y + 2, 8, 3, 0.25);
    px(p.c, x - 3, y - 4, OUTL, 7, 4);
    px(p.c, x - 2, y - 4, RAMP.iron[2], 5, 3);
    px(p.c, x - 2, y - 66, OUTL, 4, 64);
    px(p.c, x - 1, y - 66, RAMP.iron[2], 2, 63);
    px(p.c, x - 1, y - 66, RAMP.iron[3], 1, 63);
    // lantern housing
    px(p.c, x - 6, y - 82, OUTL, 13, 17);
    px(p.c, x - 5, y - 80, '#ffd77a', 11, 13);
    px(p.c, x - 4, y - 79, '#fff3c2', 4, 6);
    px(p.c, x, y - 80, OUTL, 1, 13);
    px(p.c, x - 7, y - 84, OUTL, 15, 3);
    px(p.c, x - 4, y - 87, OUTL, 9, 3);
    px(p.c, x - 6, y - 83, RAMP.iron[2], 13, 1);
  },
  anim(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    const f = 0.18 + Math.sin(k.t * 3 + k.seed) * 0.03;
    p.c.globalAlpha = f;
    ellipse(p.c, x, y - 74, 16, 14, '#ffd77a');
    p.c.globalAlpha = f * 0.7;
    ellipse(p.c, x + 4, y + 2, 16, 5, '#ffd77a');
    p.c.globalAlpha = 1;
  },
};

const pots: PropArt = {
  draw(p, k) {
    const sets: Record<string, string[]> = {
      pink: ['#f08aa8', '#e8577a', '#fbd0dc'],
      purple: ['#c49cf2', '#a77ad8', '#f2a8c2'],
      yellow: ['#f6d860', '#f2b84b', '#fbf4e4'],
      red: ['#e2553b', '#f08a5a', '#fbf4e4'],
      mixed: ['#f6d860', '#f08aa8', '#c49cf2'],
    };
    const s = sets[k.variant ?? 'mixed'] ?? sets.mixed;
    potHD(p, 0.3, 0.35, s[0], 1.1);
    potHD(p, 0.72, 0.42, s[1], 0.9);
    potHD(p, 0.48, 0.75, s[2], 1.25);
  },
};

const firewood: PropArt = {
  draw(p) {
    castShadow(p, 0.1, 0.25, 0.8, 0.5, 18, 0.22);
    const [x, y] = p.P(0.5, 0.5, 0);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++) {
        const cx = x - 12 + i * 8 + row * 4;
        const cy = y - 4 - row * 7;
        ellipse(p.c, cx, cy, 4.5, 4, OUTL);
        ellipse(p.c, cx, cy, 3.6, 3.2, '#d8b07e');
        ellipse(p.c, cx, cy, 1.6, 1.4, '#b08452');
        px(p.c, cx - 3, cy - 3, RAMP.wood[2], 2, 1);
      }
    tbox(p, 0.05, 0.3, 0.9, 0.4, 0, 1.5, flat(RAMP.wood));
  },
};

const wheelbarrow: PropArt = {
  draw(p) {
    castShadow(p, 0.15, 0.3, 0.7, 0.4, 14, 0.22);
    const [x, y] = p.P(0.5, 0.5, 0);
    // wheel
    ellipse(p.c, x + 10, y - 4, 5, 5, OUTL);
    ellipse(p.c, x + 10, y - 4, 3.6, 3.6, '#4a4e5a');
    px(p.c, x + 10, y - 5, RAMP.metal[3], 1, 1);
    // tray
    tbox(p, 0.15, 0.3, 0.62, 0.42, 6, 7, { left: solid(RAMP.red), right: solid(RAMP.red), top: solid(RAMP.soil), edge: RAMP.red[0] });
    canopy(p.c, x - 2, y - 17, 8, 4, 5, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 2.6, dots: ['#e2553b', '#f6d860'], dotChance: 0.6 });
    // handles + legs
    for (const dy of [0, 4]) for (let i = 0; i < 12; i++) px(p.c, x - 12 - i, y - 10 + dy - i * 0.5 + i, RAMP.wood[3]);
    px(p.c, x - 9, y - 6, RAMP.iron[2], 1, 6);
  },
};

const crate: PropArt = {
  draw(p, k) {
    castShadow(p, 0.2, 0.2, 0.6, 0.6, 14, 0.22);
    tbox(p, 0.2, 0.2, 0.6, 0.6, 0, 12, { left: siding(RAMP.woodPale, 4), right: siding(RAMP.woodPale, 4), top: solid(RAMP.wood), edge: RAMP.woodPale[0] });
    const [x, y] = p.P(0.5, 0.5, 12);
    const fruit = [['#d8432f', '#e8573f'], ['#f08a3a', '#f2a03d'], ['#9fd060', '#7cc04c']][k.seed % 3];
    const R = rng(k.seed);
    for (let i = 0; i < 9; i++) {
      const fx = x - 8 + R() * 16;
      const fy = y - 3 + R() * 5;
      ellipse(p.c, fx, fy, 2.6, 2.4, darken(fruit[0], 0.35));
      ellipse(p.c, fx, fy - 0.4, 2, 1.8, fruit[i % 2]);
      px(p.c, fx - 1, fy - 2, lighten(fruit[0], 0.45));
    }
  },
};

const compost: PropArt = {
  draw(p, k) {
    castShadow(p, 0.15, 0.15, 0.7, 0.7, 16, 0.22);
    tbox(p, 0.15, 0.15, 0.7, 0.7, 0, 12, { left: siding(RAMP.wood, 3), right: siding(RAMP.wood, 3), top: solid(RAMP.soil), edge: RAMP.wood[0] });
    const [x, y] = p.P(0.5, 0.5, 12);
    canopy(p.c, x, y - 2, 10, 4, k.seed, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 2.6, dots: ['#8a5a3a', '#f2b84b'], dotChance: 0.4 });
  },
};

const wateringCan: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    const col = k.color ?? '#5aa0b8';
    groundShadow(p.c, x + 4, y + 1, 7, 2.5, 0.25);
    px(p.c, x - 5, y - 10, OUTL, 10, 10);
    px(p.c, x - 4, y - 9, col, 8, 8);
    px(p.c, x - 4, y - 9, lighten(col, 0.3), 2, 8);
    px(p.c, x + 2, y - 9, darken(col, 0.25), 2, 8);
    for (let i = 0; i < 6; i++) px(p.c, x + 4 + i, y - 6 - i, OUTL, 2, 2);
    px(p.c, x + 9, y - 12, darken(col, 0.2), 3, 2);
    px(p.c, x - 3, y - 14, OUTL, 6, 1);
    px(p.c, x - 3, y - 14, OUTL, 1, 5);
    px(p.c, x + 2, y - 14, OUTL, 1, 5);
  },
};

const gnome: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 4, y + 1, 6, 2, 0.25);
    const coat = k.seed % 2 ? '#4a7ad0' : '#3f9a5a';
    px(p.c, x - 4, y - 11, OUTL, 9, 11);
    px(p.c, x - 3, y - 10, coat, 7, 7);
    px(p.c, x - 3, y - 3, '#6a4630', 7, 3);
    px(p.c, x - 3, y - 14, OUTL, 7, 4);
    px(p.c, x - 2, y - 14, '#f2c8a0', 5, 3);
    px(p.c, x - 2, y - 11, '#fbf4e4', 5, 3);
    px(p.c, x - 2, y - 16, '#d8432f', 5, 2);
    px(p.c, x - 1, y - 18, '#d8432f', 3, 2);
    px(p.c, x, y - 20, '#e8573f', 1, 2);
  },
};

const signpost: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 6, y + 2, 8, 3, 0.25);
    px(p.c, x - 1, y - 40, OUTL, 4, 40);
    px(p.c, x, y - 40, RAMP.wood[3], 2, 40);
    for (const [dy, dir] of [[-36, 1], [-28, -1]] as const) {
      const w = 22;
      const x0 = dir > 0 ? x : x - w;
      px(p.c, x0 - 1, y + dy - 1, OUTL, w + 2, 7);
      px(p.c, x0, y + dy, RAMP.woodPale[3], w, 5);
      px(p.c, x0, y + dy, RAMP.woodPale[4], w, 1);
      for (let i = 0; i < 5; i++) px(p.c, x0 + 3 + i * 3, y + dy + 2, RAMP.wood[1], 2, 1);
      const tip = dir > 0 ? x0 + w : x0 - 1;
      px(p.c, tip, y + dy + 1, OUTL, 1, 3);
    }
  },
};

const bicycle: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 4, y + 2, 16, 3, 0.25);
    const red = '#c8443a';
    for (const wx of [-10, 10]) {
      ellipse(p.c, x + wx, y - 7, 7, 7, OUTL);
      ellipse(p.c, x + wx, y - 7, 5.5, 5.5, '#5a5e6a');
      ellipse(p.c, x + wx, y - 7, 4.5, 4.5, 'rgba(0,0,0,0)');
      ellipse(p.c, x + wx, y - 7, 1, 1, RAMP.metal[3]);
    }
    for (let i = 0; i < 20; i++) px(p.c, x - 10 + i, y - 7 - (i < 10 ? i * 0.6 : 6 - (i - 10) * 0.6) , red, 1, 2);
    px(p.c, x - 2, y - 15, red, 2, 9);
    px(p.c, x - 5, y - 17, OUTL, 7, 2);
    px(p.c, x + 7, y - 19, OUTL, 6, 2);
    px(p.c, x + 9, y - 18, red, 2, 9);
    // basket with flowers
    px(p.c, x + 11, y - 22, OUTL, 8, 6);
    px(p.c, x + 12, y - 21, RAMP.hay[2], 6, 4);
    canopy(p.c, x + 15, y - 24, 4, 3, 2, { ramp: RAMP.leaf, rmin: 1.6, rmax: 2.2, dots: ['#f08aa8', '#f6d860'], dotChance: 0.9 });
  },
};

export const FARM_SMALL: Record<string, PropArt> = { armchair, cafeTable, picnic, bench, birdbath, lanternPost, pots, firewood, wheelbarrow, crate, compost, wateringCan, gnome, signpost, bicycle };
void hh;

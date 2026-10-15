// HD Farm vegetation and field props: trees, bushes, hedges, flowers,
// grass, crops, beds, hay, scarecrow, stone walls, fences, beehives.
import { darken, mix } from '../color';
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { boards, canopy, ellipse, flowers, groundShadow, hh, OUTL, px, RAMP, type Ramp, rng, siding, solid, stones, tbox, tuft } from './kit';
import { castShadow, front, pq } from './plane';

const FLOWER_SETS: Record<string, string[]> = {
  pink: ['#e8577a', '#f08aa8', '#fbd0dc', '#d64a7a'],
  yellow: ['#f6d860', '#f2b84b', '#fbe9a0', '#f08a3a'],
  white: ['#fbf4e4', '#ffffff', '#f2ead8', '#f6d860'],
  purple: ['#a77ad8', '#c49cf2', '#8a5ac0', '#e3cdf8'],
  red: ['#d8432f', '#e8577a', '#f08a5a'],
  mixed: ['#f6d860', '#f08aa8', '#fbf4e4', '#c49cf2', '#f08a5a', '#e8577a'],
};
const setFor = (v: string | undefined, seed: number) => FLOWER_SETS[v ?? ''] ?? Object.values(FLOWER_SETS)[seed % 6];

/** Trunk with bark streaks, root flare and a fork into the canopy. */
function trunk(p: PropPainter, x: number, y: number, h: number, w: number, seed: number) {
  const c = p.c;
  const R = rng(seed);
  // roots
  px(c, x - w / 2 - 3, y - 2, OUTL, w + 6, 3);
  px(c, x - w / 2 - 2, y - 2, RAMP.wood[1], w + 4, 2);
  px(c, x - w / 2 - 1, y - h - 1, OUTL, w + 2, h + 1);
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const ww = Math.max(3, Math.round(w * (1 - t * 0.35)));
    const x0 = Math.round(x - ww / 2);
    px(c, x0, y - j - 1, RAMP.wood[2], ww, 1);
    px(c, x0, y - j - 1, RAMP.wood[3], Math.max(1, Math.floor(ww / 3)), 1); // lit left side
    px(c, x0 + ww - 2, y - j - 1, RAMP.wood[1], 2, 1); // shaded right
    if (R() < 0.18) px(c, x0 + 1 + Math.floor(R() * (ww - 2)), y - j - 1, RAMP.wood[1], 1, 2); // bark streak
  }
  // fork
  for (let i = 0; i < 9; i++) {
    px(c, x - 2 - i * 0.7, y - h - i, RAMP.wood[2], 2, 1);
    px(c, x + 1 + i * 0.6, y - h - i, RAMP.wood[1], 2, 1);
  }
}

const FRUIT: Record<string, string[]> = { apple: ['#d8432f', '#e8573f'], pear: ['#d9c84a', '#c8b83a'], orange: ['#f08a3a', '#f2a03d'], peach: ['#f2a07a', '#e8806a'] };

function treeArt(kind: 'fruit' | 'big'): PropArt {
  return {
    draw(p, k) {
      const [x, y] = p.P(0.5, 0.5, 0);
      const s = 0.85 + hh(k.seed, 1, 1) * 0.3;
      const big = kind === 'big';
      const rx = (big ? 46 : 38) * s;
      const ry = (big ? 40 : 32) * s;
      const cz = (big ? 76 : 62) * s;
      groundShadow(p.c, x + 16 * s, y + 4, rx * 1.0, ry * 0.42, 0.34);
      trunk(p, x, y, cz - ry * 0.62, big ? 10 : 8, k.seed);
      const dark = k.variant === 'dark' || k.variant === 'deep' || k.variant === 'warm' || big;
      const ramp: Ramp =
        k.variant === 'warm' ? RAMP.leafWarm : k.variant === 'deep' ? RAMP.leafDeep : big ? (hh(k.seed, 2, 2) > 0.5 ? RAMP.leafDeep : RAMP.leaf) : dark ? RAMP.leafDeep : RAMP.leaf;
      const fruit = !dark ? FRUIT[k.variant ?? 'apple'] ?? FRUIT.apple : undefined;
      // two or three lobes for a natural silhouette
      const R = rng(k.seed * 7 + 3);
      const lobes = big ? 3 : 2;
      for (let i = 0; i < lobes; i++) {
        const lx = x + (R() - 0.5) * rx * 0.5;
        const ly = y - cz + (R() - 0.3) * ry * 0.3;
        canopy(p.c, lx, ly, rx * (0.72 + R() * 0.15), ry * (0.72 + R() * 0.15), k.seed * 13 + i, { ramp, rmin: 4, rmax: 7.5, density: 1.15 });
      }
      canopy(p.c, x, y - cz, rx, ry, k.seed * 17 + 5, { ramp, rmin: 4, rmax: 7.5, dots: fruit, dotChance: 0.3 });
    },
  };
}

const bush: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    const s = 0.8 + hh(k.seed, 3) * 0.4;
    groundShadow(p.c, x + 6, y + 1, 15 * s, 5 * s, 0.3);
    const fl = hh(k.seed, 4) > 0.45 ? setFor(undefined, k.seed) : undefined;
    canopy(p.c, x, y - 9 * s, 15 * s, 11 * s, k.seed * 5, { ramp: RAMP.leaf, rmin: 2.6, rmax: 4.5, flatBottom: true, dots: fl, dotChance: 0.55 });
  },
};

const hedgeRow: PropArt = {
  draw(p, k) {
    const w = k.w;
    const fl = k.variant ? setFor(k.variant, k.seed) : undefined;
    castShadow(p, 0, 0.15, w, 0.7, 30, 0.22);
    const n = Math.round(w * 3);
    for (let i = 0; i < n; i++) {
      const [x, y] = p.P((i + 0.5) / 3, 0.55, 0);
      canopy(p.c, x, y - 15, 13, 13, k.seed * 3 + i * 11, { ramp: RAMP.leaf, rmin: 2.8, rmax: 4.6, dots: fl, dotChance: 0.5, flatBottom: true });
    }
  },
};

const flowerPatch: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 11);
    const cols = setFor(k.variant, k.seed);
    for (let i = 0; i < 3; i++) {
      const [x, y] = p.P(0.25 + R() * 0.5, 0.25 + R() * 0.5, 0);
      canopy(p.c, x, y - 4, 7, 4.5, k.seed * 7 + i, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 2.8, flatBottom: true, outline: i === 0 });
      flowers(p.c, x, y - 6, 7, 4, cols, 9, k.seed * 3 + i);
    }
  },
};

const tallGrass: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 5);
    for (let i = 0; i < 4; i++) {
      const [x, y] = p.P(0.2 + R() * 0.6, 0.2 + R() * 0.6, 0);
      tuft(p.c, x, y, RAMP.leafWarm, k.seed * 5 + i, 1.4);
    }
  },
};

const sunflowers: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 2);
    for (let i = 0; i < 3; i++) {
      const [x, y] = p.P(0.25 + i * 0.25, 0.3 + R() * 0.4, 0);
      const h = 52 + Math.floor(R() * 26);
      px(p.c, x - 1, y - h, OUTL, 4, h);
      px(p.c, x, y - h, RAMP.leafWarm[3], 2, h);
      for (const lz of [0.35, 0.6]) {
        const ly = y - h * lz;
        canopy(p.c, x - 5, ly, 5, 3, k.seed + i * 3 + lz * 10, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 2.6 });
        canopy(p.c, x + 6, ly - 4, 5, 3, k.seed + i * 5 + lz * 10, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 2.6 });
      }
      // head: petal ring + seed centre, tilted toward the viewer
      const hy = y - h - 2;
      ellipse(p.c, x + 1, hy, 8, 7, darken('#f2b84b', 0.45));
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        px(p.c, x + 1 + Math.cos(ang) * 6 - 1, hy + Math.sin(ang) * 5.5 - 1, a % 3 === 0 ? '#fbe07a' : '#f6c73a', 2, 2);
      }
      ellipse(p.c, x + 1, hy, 3.6, 3.2, '#5a3a22');
      px(p.c, x, hy - 1, '#7a5230', 2, 1);
    }
  },
};

// ── crops ───────────────────────────────────────────────────
function plantAt(p: PropPainter, kind: string, x: number, y: number, seed: number) {
  const c = p.c;
  const R = rng(seed * 7 + 1);
  switch (kind) {
    case 'carrot': {
      // feathery tops in two greens, orange shoulders peeking out
      for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * 1.5;
        const h = 8 + Math.floor(R() * 6);
        const lean = i < 3 ? -1 : i > 3 ? 1 : 0;
        for (let j = 0; j < h; j++) px(c, x + dx + (j > h * 0.55 ? lean : 0) + (j > h * 0.85 ? lean : 0), y - 2 - j, j > h - 2 ? RAMP.leafWarm[5] : j < 2 ? RAMP.leafWarm[1] : RAMP.leafWarm[3 + (j & 1)]);
      }
      px(c, x - 3, y - 2, '#a85420', 6, 2);
      px(c, x - 2, y - 3, '#f08a3a', 4, 2);
      px(c, x - 2, y - 3, '#f6a860', 2, 1);
      break;
    }
    case 'tomato': {
      // staked plant with trusses of red and ripening fruit
      px(c, x + 4, y - 30, OUTL, 3, 30);
      px(c, x + 5, y - 30, RAMP.wood[3], 1, 30);
      canopy(c, x, y - 15, 9, 14, seed, { ramp: RAMP.leaf, rmin: 2.4, rmax: 3.8, dots: ['#e2553b', '#d8432f', '#f08a5a', '#f6b24a'], dotChance: 0.8 });
      break;
    }
    case 'cabbage': {
      // outer leaves, layered head, pale heart and veins
      ellipse(c, x, y - 4, 12, 7, mix(RAMP.teal[0], OUTL, 0.35));
      ellipse(c, x, y - 4.5, 11, 6, '#4e8a6c');
      for (const [dx, dy] of [[-7, -3], [7, -3], [-4, 0], [5, 0]]) ellipse(c, x + dx, y - 4 + dy * 0.5, 4.5, 2.6, '#6aa886');
      ellipse(c, x, y - 7, 7, 4.5, '#7fbc98');
      ellipse(c, x - 1, y - 8, 4.5, 3, '#a6d8b6');
      ellipse(c, x - 2, y - 9, 2, 1.4, '#d2f0da');
      px(c, x, y - 11, '#5a9a78', 1, 6);
      px(c, x - 5, y - 6, '#5a9a78', 3, 1);
      px(c, x + 3, y - 6, '#5a9a78', 3, 1);
      break;
    }
    case 'pumpkin': {
      canopy(c, x - 4, y - 7, 10, 6, seed, { ramp: RAMP.leaf, rmin: 2.4, rmax: 3.6 });
      if (seed % 3 !== 0) {
        ellipse(c, x + 4, y - 4, 8.5, 6, '#7a3412');
        ellipse(c, x + 4, y - 4.5, 7.5, 5, '#e07a28');
        for (const dx of [-4, 0, 4]) px(c, x + 4 + dx, y - 8, '#b85a1e', 1, 7);
        px(c, x + 1, y - 7, '#f6a050', 3, 1);
        px(c, x + 4, y - 11, RAMP.wood[1], 2, 3);
      }
      break;
    }
    case 'wheat':
      break;
    case 'lettuce': {
      ellipse(c, x, y - 4, 10, 6, '#2e6a26');
      for (const [dx, dy] of [[-5, -1], [5, -1], [0, 1]]) ellipse(c, x + dx, y - 4 + dy, 5, 3, '#5fa83c');
      ellipse(c, x, y - 6, 7, 4.5, '#7cc04c');
      ellipse(c, x - 1, y - 7, 4, 2.6, '#a8dc68');
      ellipse(c, x - 2, y - 8, 1.6, 1.2, '#d0f090');
      break;
    }
    default: {
      canopy(c, x, y - 7, 8, 6.5, seed, { ramp: RAMP.leafDeep, rmin: 2, rmax: 3.2, dots: ['#a77ad8', '#c49cf2', '#fbf4e4'], dotChance: 0.55 });
    }
  }
}

function wheatField(p: PropPainter, k: PropCtx) {
  const R = rng(k.seed + 9);
  const n = Math.round(k.w * k.d * 70);
  const stalks: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = R() * k.w;
    const b = R() * k.d;
    stalks.push([a, b, R()]);
  }
  stalks.sort((m, q) => m[0] + m[1] - (q[0] + q[1]));
  for (const [a, b, r] of stalks) {
    const [x, y] = p.P(a, b, 0);
    const h = 14 + Math.floor(r * 8);
    const lean = r > 0.6 ? 1 : 0;
    for (let j = 0; j < h; j++) px(p.c, x + (j > h * 0.6 ? lean : 0), y - j, j < 3 ? RAMP.hay[1] : RAMP.hay[2 + (j > h - 5 ? 1 : 0)]);
    px(p.c, x - 1 + lean, y - h - 2, RAMP.hay[4], 2, 4);
    px(p.c, x + lean, y - h - 3, RAMP.hay[5], 1, 2);
  }
}

const crops: PropArt = {
  draw(p, k) {
    const kind = k.variant ?? 'carrot';
    if (kind === 'wheat') return wheatField(p, k);
    const rows = Math.max(1, Math.round(k.d * 2));
    const per = Math.max(2, Math.round(k.w * (kind === 'cabbage' || kind === 'lettuce' || kind === 'pumpkin' ? 2.6 : 3.4)));
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < per; i++) {
        const a = (i + 0.5) / (per / k.w) + (hh(i, r, 3) - 0.5) * 0.08;
        const b = (r + 0.5) / (rows / k.d);
        const [x, y] = p.P(a, b, 0);
        plantAt(p, kind, x, y, k.seed * 31 + r * 7 + i);
      }
  },
};

const BED_PLANTS: Record<string, string> = { pink: 'roses', yellow: 'marigold', lettuce: 'lettuce', herbs: 'herbs', purple: 'lavender' };

const raisedBed: PropArt = {
  draw(p, k) {
    castShadow(p, 0.05, 0.1, k.w - 0.1, k.d - 0.2, 14, 0.2);
    tbox(p, 0.05, 0.08, k.w - 0.1, k.d - 0.16, 0, 9, { left: siding(RAMP.wood, 4), right: siding(RAMP.wood, 4), top: solid(RAMP.soil), edge: RAMP.wood[0] });
    // corner posts
    for (const [a, b] of [[0.05, k.d - 0.08], [k.w - 0.05, k.d - 0.08], [k.w - 0.05, 0.08]] as const) {
      const [x, y] = p.P(a, b, 0);
      px(p.c, x - 1, y - 21, OUTL, 4, 21);
      px(p.c, x, y - 20, RAMP.wood[3], 2, 20);
    }
    const kind = BED_PLANTS[k.variant ?? ''] ?? 'mixed';
    const n = Math.round(k.w * 4);
    for (let i = 0; i < n; i++) {
      for (const b of [0.32, 0.68]) {
        const [x, y] = p.P(0.2 + (i * (k.w - 0.4)) / (n - 1), b * k.d, 9);
        if (kind === 'lettuce') plantAt(p, 'lettuce', x, y, i);
        else if (kind === 'herbs') canopy(p.c, x, y - 4, 5, 4, k.seed + i * 3 + b * 10, { ramp: RAMP.leafDeep, rmin: 1.6, rmax: 2.6, dots: ['#fbf4e4', '#c49cf2'], dotChance: 0.3 });
        else {
          const cols = kind === 'roses' ? FLOWER_SETS.pink : kind === 'marigold' ? ['#f2b84b', '#f08a3a', '#f6d860'] : kind === 'lavender' ? FLOWER_SETS.purple : FLOWER_SETS.mixed;
          canopy(p.c, x, y - 7, 7.5, 6.5, k.seed + i * 3 + b * 10, { ramp: RAMP.leaf, rmin: 2.2, rmax: 3.3, dots: cols, dotChance: 0.95 });
        }
      }
    }
  },
};

// ── hay ─────────────────────────────────────────────────────
const haystack: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 8, y + 2, 20, 6, 0.3);
    ellipse(p.c, x, y - 12, 19, 15, mix(RAMP.hay[0], OUTL, 0.4));
    ellipse(p.c, x, y - 12, 18, 14, RAMP.hay[2]);
    ellipse(p.c, x - 3, y - 15, 13, 10, RAMP.hay[3]);
    ellipse(p.c, x - 6, y - 19, 7, 5, RAMP.hay[4]);
    const R = rng(k.seed);
    for (let i = 0; i < 70; i++) {
      const a = R() * 2 - 1;
      const b = R() * 2 - 1;
      if (a * a + b * b > 0.9) continue;
      const sx = x + a * 17;
      const sy = y - 12 + b * 13;
      px(p.c, sx, sy, RAMP.hay[a + b < 0 ? 5 : 1], 3, 1);
    }
    px(p.c, x - 18, y - 4, RAMP.hay[1], 36, 2);
    // loose straw at the base
    for (let i = 0; i < 14; i++) px(p.c, x - 20 + R() * 40, y - 1 + R() * 4, RAMP.hay[R() > 0.5 ? 4 : 2], 3, 1);
  },
};

const hay: PropArt = {
  draw(p) {
    castShadow(p, 0.15, 0.25, 0.7, 0.5, 14, 0.24);
    const straw = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => {
      let i = light === 2 ? 4 : light === 1 ? 3 : 2;
      if (hh(Math.floor(u / 3), Math.floor(v), 4) < 0.3) i += 1;
      if (hh(x, y, 5) < 0.15) i -= 1;
      return RAMP.hay[Math.max(0, Math.min(5, i))];
    };
    tbox(p, 0.15, 0.25, 0.7, 0.5, 0, 12, { left: straw, right: straw, top: straw, edge: RAMP.hay[0] });
    const F = front(p, 0.75);
    pq(p, F, 0.35, 0.39, 0, 12, '#8a6a3a');
    pq(p, F, 0.62, 0.66, 0, 12, '#8a6a3a');
  },
};

const scarecrow: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 8, y + 2, 10, 3, 0.25);
    px(p.c, x - 1, y - 52, OUTL, 4, 52);
    px(p.c, x, y - 52, RAMP.wood[3], 2, 52);
    // arms + plaid shirt
    px(p.c, x - 15, y - 40, OUTL, 32, 4);
    px(p.c, x - 14, y - 39, RAMP.wood[2], 30, 2);
    px(p.c, x - 8, y - 42, OUTL, 18, 20);
    const shirt = k.seed % 2 ? RAMP.red : RAMP.blue;
    for (let j = 0; j < 18; j++) for (let i = 0; i < 16; i++) px(p.c, x - 7 + i, y - 41 + j, (i % 4 === 0 || j % 4 === 0) ? shirt[1] : shirt[3]);
    for (const sx of [-14, 12]) {
      px(p.c, x + sx, y - 41, OUTL, 4, 8);
      px(p.c, x + sx + 1, y - 40, shirt[2], 2, 5);
      px(p.c, x + sx + 1, y - 35, RAMP.hay[4], 2, 3);
    }
    // burlap head + straw hat
    ellipse(p.c, x + 1, y - 48, 6, 6, OUTL);
    ellipse(p.c, x + 1, y - 48, 5, 5, '#d8c08e');
    px(p.c, x - 1, y - 49, '#3b2a26');
    px(p.c, x + 3, y - 49, '#3b2a26');
    px(p.c, x - 1, y - 46, '#8a5a3a', 5, 1);
    ellipse(p.c, x + 1, y - 53, 11, 3, OUTL);
    ellipse(p.c, x + 1, y - 53, 10, 2, RAMP.hay[3]);
    px(p.c, x - 3, y - 59, OUTL, 9, 6);
    px(p.c, x - 2, y - 58, RAMP.hay[4], 7, 5);
    px(p.c, x - 2, y - 55, RAMP.red[3], 7, 1);
  },
};

// ── walls & fences ──────────────────────────────────────────
const stoneWall: PropArt = {
  draw(p, k) {
    castShadow(p, 0, 0.2, k.w, 0.6, 22, 0.22);
    tbox(p, 0, 0.2, k.w, 0.6, 0, 11, { left: stones(RAMP.stoneWarm, 5, 0.35), right: stones(RAMP.stoneWarm, 5, 0.35), top: stones(RAMP.stoneWarm, 6, 0.5), edge: RAMP.stoneWarm[0] });
    // capstones
    const n = Math.round(k.w * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * k.w;
      tbox(p, a + 0.02, 0.15, k.w / n - 0.04, 0.7, 11, 2.5 + hh(i, k.seed) * 1.5, { left: undefined, right: undefined, top: stones(RAMP.stone, 8, 0.4), outline: false });
    }
    const R = rng(k.seed);
    for (let i = 0; i < k.w * 3; i++) {
      const [x, y] = p.P(R() * k.w, 0.85, 0);
      tuft(p.c, x, y, RAMP.leafWarm, k.seed + i);
    }
    if (k.variant === 'flowers')
      for (let i = 0; i < k.w * 2; i++) {
        const [x, y] = p.P(0.3 + i * 0.5, 0.5, 13);
        canopy(p.c, x, y - 2, 7, 4, k.seed * 3 + i, { ramp: RAMP.leafWarm, rmin: 1.8, rmax: 3, dots: FLOWER_SETS.mixed, dotChance: 0.6 });
      }
  },
};

const fenceRow: PropArt = {
  draw(p, k) {
    const w = k.w;
    const wood = RAMP.woodPale;
    const R = rng(k.seed + 3);
    // rails first (behind posts on the far side)
    for (const z of [6, 12]) tbox(p, 0, 0.47, w, 0.06, z, 2.2, { left: siding(wood, 5), right: solid(wood), top: solid(wood), edge: wood[0] });
    const posts = Math.round(w) + 1;
    for (let i = 0; i < posts; i++) {
      const a = Math.min(w - 0.08, (i * w) / (posts - 1));
      const h = 15 + R() * 2;
      tbox(p, a - 0.05, 0.44, 0.1, 0.12, 0, h, { left: boards(wood, 4), right: solid(wood), top: solid(wood), edge: wood[0] });
      const [x, y] = p.P(a, 0.6, 0);
      tuft(p.c, x, y, RAMP.leafWarm, k.seed + i * 7);
    }
  },
};

const beehive: PropArt = {
  draw(p, k) {
    castShadow(p, 0.2, 0.2, 0.6, 0.6, 30, 0.22);
    tbox(p, 0.22, 0.22, 0.56, 0.56, 0, 3, { left: solid(RAMP.wood), right: solid(RAMP.wood), top: solid(RAMP.wood), edge: RAMP.wood[0] });
    const cols: Ramp[] = [RAMP.cream, RAMP.yellow, ['#4a6a8a', '#6a8aaa', '#8aaac6', '#b0c8de', '#d4e2ee']];
    const pal = cols[k.seed % 3];
    for (let i = 0; i < 3; i++) tbox(p, 0.25, 0.25, 0.5, 0.5, 3 + i * 7, 6.5, { left: siding(pal, 7), right: siding(pal, 7), top: solid(pal), edge: pal[0] });
    tbox(p, 0.2, 0.2, 0.6, 0.6, 24, 3, { left: solid(RAMP.roof), right: solid(RAMP.roof), top: solid(RAMP.roof), edge: RAMP.roof[0] });
    const F = front(p, 0.75);
    pq(p, F, 0.38, 0.62, 3.5, 5, '#2a1a14');
  },
  anim(p, k) {
    for (let i = 0; i < 4; i++) {
      const t = k.t * 2 + i * 1.7;
      const [x, y] = p.P(0.5 + Math.sin(t) * 0.5, 0.75 + Math.cos(t * 1.3) * 0.4, 10 + Math.sin(t * 2) * 6);
      px(p.c, x, y, '#2a2018');
      px(p.c, x + 1, y, '#f2c84b');
    }
  },
};

const trough: PropArt = {
  draw(p) {
    castShadow(p, 0.1, 0.25, 1.8, 0.5, 10, 0.2);
    tbox(p, 0.1, 0.25, 1.8, 0.5, 0, 8, { left: siding(RAMP.wood, 4), right: siding(RAMP.wood, 4), top: solid(RAMP.water), edge: RAMP.wood[0] });
    const [x, y] = p.P(1, 0.5, 8);
    px(p.c, x - 6, y - 1, RAMP.water[5], 8, 1);
  },
};

// ── stones, water plants, barrels ──────────────────────────
const rock: PropArt = {
  draw(p, k) {
    const [x, y] = p.P(0.5, 0.5, 0);
    const R = rng(k.seed * 3 + 1);
    const n = 1 + Math.floor(R() * 3);
    groundShadow(p.c, x + 6, y + 2, 16, 5, 0.3);
    for (let i = 0; i < n; i++) {
      const rx = 7 + R() * 7;
      const ry = rx * (0.6 + R() * 0.2);
      const cx = x + (R() - 0.5) * 16;
      const cy = y - ry * 0.6 + (R() - 0.3) * 5;
      ellipse(p.c, cx, cy, rx + 1, ry + 1, mix(RAMP.stone[0], OUTL, 0.5));
      ellipse(p.c, cx, cy, rx, ry, RAMP.stone[2]);
      ellipse(p.c, cx - rx * 0.2, cy - ry * 0.25, rx * 0.75, ry * 0.65, RAMP.stone[3]);
      ellipse(p.c, cx - rx * 0.35, cy - ry * 0.45, rx * 0.35, ry * 0.3, RAMP.stone[4]);
      // moss cap + cracks
      if (R() > 0.4) ellipse(p.c, cx - rx * 0.1, cy - ry * 0.7, rx * 0.5, ry * 0.25, RAMP.leafWarm[2 + Math.floor(R() * 2)]);
      px(p.c, cx + rx * 0.2, cy - ry * 0.1, RAMP.stone[1], 1, Math.max(2, ry * 0.5));
    }
    const [tx, ty] = p.P(0.2 + R() * 0.6, 0.85, 0);
    tuft(p.c, tx, ty, RAMP.leafWarm, k.seed);
  },
};

const pebbles: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 41);
    for (let i = 0; i < 6; i++) {
      const [x, y] = p.P(0.15 + R() * 0.7, 0.15 + R() * 0.7, 0);
      const w = 2 + Math.floor(R() * 3);
      px(p.c, x, y, OUTL, w + 2, 3);
      px(p.c, x + 1, y, RAMP.stone[3], w, 2);
      px(p.c, x + 1, y, RAMP.stone[4], 1, 1);
    }
  },
};

const lilies: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 7);
    for (let i = 0; i < 3; i++) {
      const [x, y] = p.P(0.2 + R() * 0.6, 0.2 + R() * 0.6, 0);
      const r = 5 + R() * 3;
      ellipse(p.c, x, y, r + 1, r * 0.5 + 1, '#1f4a2c');
      ellipse(p.c, x, y, r, r * 0.5, '#4f9840');
      ellipse(p.c, x - 1, y - 1, r * 0.6, r * 0.3, '#6db24a');
      px(p.c, x, y - r * 0.5, '#1f4a2c', 1, Math.ceil(r * 0.5)); // notch
      if (R() > 0.45) {
        px(p.c, x - 2, y - 3, '#f2a8c2', 4, 2);
        px(p.c, x - 1, y - 4, '#fbd0dc', 2, 2);
        px(p.c, x, y - 3, '#f6d860');
      }
    }
  },
};

const reeds: PropArt = {
  draw(p, k) {
    const R = rng(k.seed + 19);
    for (let i = 0; i < 9; i++) {
      const [x, y] = p.P(0.2 + R() * 0.6, 0.3 + R() * 0.5, 0);
      const h = 18 + Math.floor(R() * 22);
      const lean = R() > 0.5 ? 1 : -1;
      for (let j = 0; j < h; j++) px(p.c, x + (j > h * 0.7 ? lean : 0), y - j, j < h * 0.3 ? RAMP.leafDeep[2] : RAMP.leafWarm[3 + (j & 1)]);
      if (R() > 0.45) {
        px(p.c, x - 1 + lean, y - h - 6, OUTL, 4, 8);
        px(p.c, x + lean, y - h - 5, '#7a4a2a', 2, 6);
        px(p.c, x + lean, y - h - 5, '#9a6238', 1, 3);
      }
    }
  },
};

const barrel: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    groundShadow(p.c, x + 7, y + 2, 13, 4, 0.28);
    const h = 30;
    ellipse(p.c, x, y - 2, 11, 5, OUTL);
    px(p.c, x - 11, y - h, OUTL, 23, h - 1);
    for (let i = -10; i <= 10; i++) {
      const t = (i + 10) / 20;
      const col = t < 0.25 ? RAMP.wood[4] : t < 0.65 ? RAMP.wood[3] : t < 0.85 ? RAMP.wood[2] : RAMP.wood[1];
      const bulge = Math.round(Math.sqrt(1 - ((i / 11) ** 2)) * 2);
      px(p.c, x + i, y - h + 2 - bulge * 0, col, 1, h - 3);
      if ((i + 10) % 5 === 0) px(p.c, x + i, y - h + 2, RAMP.wood[1], 1, h - 3);
    }
    for (const z of [7, h - 8]) px(p.c, x - 11, y - z, RAMP.iron[1], 23, 2);
    ellipse(p.c, x, y - h + 1, 11, 5, OUTL);
    ellipse(p.c, x, y - h + 1, 10, 4, RAMP.wood[2]);
    ellipse(p.c, x - 1, y - h, 7, 2.5, RAMP.wood[3]);
  },
};

export const FARM_NATURE: Record<string, PropArt> = {
  cropRow: crops,
  rock,
  pebbles,
  lilies,
  reeds,
  barrel,
  fruitTree: treeArt('fruit'),
  tree: treeArt('big'),
  bush,
  hedgeRow,
  flowerPatch,
  tallGrass,
  sunflowers,
  crops,
  raisedBed,
  haystack,
  hay,
  scarecrow,
  stoneWall,
  fenceRow,
  beehive,
  trough,
};
export { FLOWER_SETS, plantAt };

// 128×64 pond & shore set and a few garden props.
//   rock:   boulder · flat · mossy · cluster
//   reeds:  cattail · reedgrass · iris · rush
//   dock (w 2) · rowboat · birdbath · gnome · bicycle
import { darken, lighten } from '../color';
import { tbox } from '../hd/kit';
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, R, rng } from './kit4';
import { boards4, siding4 } from './materials4';
import { leafBlades } from './plants';

const anchor = (p: PropPainter, a = 0.5, b = 0.5, z = 0): [number, number] => {
  const [x, y] = p.P(a, b, z);
  return [Math.round(x), Math.round(y)];
};

/** A rounded stone shaded as a volume (cell texture = grain), with optional moss cap. */
function stone(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, seed: number, mossy = false, ramp = R.stone) {
  const masses: Mass[] = [{ x, y: y - ry * 0.8, rx, ry, z: 1 }];
  foliage(c, masses, ramp, seed, { cell: Math.max(4, rx * 0.5), tilt: 0.08 });
  if (mossy) foliage(c, [{ x: x - rx * 0.15, y: y - ry * 1.35, rx: rx * 0.6, ry: ry * 0.4, z: 2 }], R.oak, seed + 1, { cell: 2.6 });
  // a crack and a highlight chip
  ln(c, x + rx * 0.2, y - ry * 1.2, x + rx * 0.35, y - ry * 0.6, ramp[1]);
  px(c, x - rx * 0.45, y - ry * 1.3, ramp[6] ?? ramp[5], 2, 1);
}

const ROCKS: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  boulder(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed);
    contactShadow(p.c, x + 12, y + 4, 30, 9, 0.3);
    layer(p.c, (l) => stone(l, x, y, 20 + Rn() * 6, 14 + Rn() * 4, k.seed));
    layer(p.c, (l) => leafBlades(l, x + 16, y + 2, 7, R.birch, k.seed, 12, 10), { outline: 0.5 });
  },
  flat(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 8, y + 3, 28, 7, 0.26);
    layer(p.c, (l) => stone(l, x, y + 4, 24, 7, k.seed, false, R.stoneWarm));
  },
  mossy(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 12, y + 4, 28, 8, 0.3);
    layer(p.c, (l) => stone(l, x, y, 18, 13, k.seed, true));
    layer(p.c, (l) => leafBlades(l, x - 14, y + 2, 8, R.birch, k.seed + 1, 12, 10), { outline: 0.5 });
  },
  cluster(p, k) {
    const Rn = rng(k.seed);
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 12, y + 4, 34, 9, 0.28);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) stone(l, x - 14 + i * 13 + Rn() * 4, y - 2 + (i & 1) * 5, 8 + Rn() * 6, 6 + Rn() * 4, k.seed + i, Rn() > 0.6, i === 1 ? R.stoneWarm : R.stone);
    });
  },
};

const REEDS: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  cattail(p, k) {
    const Rn = rng(k.seed + 19);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 12; i++) {
          const [x, y] = anchor(p, 0.2 + Rn() * 0.6, 0.3 + Rn() * 0.5);
          const h = 34 + Math.floor(Rn() * 34);
          const lean = Rn() > 0.5 ? 2 : -2;
          curve(l, x, y, x + lean * 0.3, y - h * 0.6, x + lean, y - h, R.willow[3 + (i & 1)]);
          if (Rn() > 0.4) {
            px(l, x + lean - 1, y - h - 12, '#5a3420', 4, 12);
            px(l, x + lean - 1, y - h - 12, '#8a5432', 2, 10);
            px(l, x + lean, y - h - 15, R.willow[2], 1, 3);
          }
        }
        for (let i = 0; i < 6; i++) {
          const [x, y] = anchor(p, 0.2 + Rn() * 0.6, 0.4 + Rn() * 0.4);
          leafBlades(l, x, y, 4, R.willow, k.seed + i, 26, 8);
        }
      },
      { outline: 0.55 },
    );
  },
  reedgrass(p, k) {
    const Rn = rng(k.seed + 21);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 4; i++) {
          const [x, y] = anchor(p, 0.2 + Rn() * 0.6, 0.3 + Rn() * 0.5);
          leafBlades(l, x, y, 14, R.willow, k.seed + i, 32, 14);
          for (let j = 0; j < 3; j++) {
            const sx = x + (Rn() - 0.5) * 12;
            const h = 40 + Rn() * 12;
            curve(l, sx, y, sx + 2, y - h * 0.6, sx + 6, y - h, R.hay[2]);
            for (let q = 0; q < 6; q++) px(l, sx + 5 + (q & 1), y - h + q * 1.4, R.hay[4], 2, 1);
          }
        }
      },
      { outline: 0.5 },
    );
  },
  iris(p, k) {
    const Rn = rng(k.seed + 23);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 3; i++) {
          const [x, y] = anchor(p, 0.25 + Rn() * 0.5, 0.35 + Rn() * 0.4);
          // sword leaves and yellow flag iris blooms
          for (let j = 0; j < 7; j++) {
            const lean = (j - 3) * 2.5;
            curve(l, x + (j - 3), y, x + lean * 0.4, y - 18, x + lean, y - 30 - Rn() * 8, R.birch[2 + (j & 1)]);
          }
          for (let j = 0; j < 2; j++) {
            const fx = x + (Rn() - 0.5) * 12;
            const fy = y - 34 - Rn() * 8;
            px(l, fx - 3, fy, '#f2c43a', 7, 2);
            px(l, fx - 1, fy - 3, '#f8dc60', 3, 3);
            px(l, fx - 3, fy + 2, '#d8a420', 2, 2);
            px(l, fx + 2, fy + 2, '#d8a420', 2, 2);
            px(l, fx, fy + 1, '#8a5a2a');
          }
        }
      },
      { outline: 0.5 },
    );
  },
  rush(p, k) {
    const Rn = rng(k.seed + 25);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 26; i++) {
          const [x, y] = anchor(p, 0.2 + Rn() * 0.6, 0.35 + Rn() * 0.4);
          const h = 18 + Rn() * 18;
          ln(l, x, y, x + (Rn() - 0.5) * 6, y - h, R.oak[3 + (i % 3)]);
          if (Rn() > 0.7) px(l, x - 1, y - h * 0.8, '#7a5a3a', 2, 3);
        }
      },
      { outline: 0.5 },
    );
  },
};

const dock: PropArt = {
  draw(p, k) {
    // a small wooden jetty: posts in the water, plank deck, a rope and a lantern
    for (const [a, b] of [[0.1, 0.2], [0.1, 0.8], [1.9, 0.2], [1.9, 0.8], [1.0, 0.2], [1.0, 0.8]] as const) tbox(p, a - 0.05, b - 0.05, 0.1, 0.1, -6, 9, { left: siding4(R.wood, 30), right: siding4(R.wood, 30), top: siding4(R.wood), edge: R.wood[0] });
    tbox(p, 0, 0.15, 2, 0.7, 3, 1.4, { left: siding4(R.woodGrey, 20), right: siding4(R.woodGrey, 20), top: boards4(R.woodGrey, 13, true), edge: R.woodGrey[0] });
    const [rx, ry] = anchor(p, 1.9, 0.8, 6);
    layer(p.c, (l) => {
      curve(l, rx, ry, rx + 6, ry + 10, rx + 2, ry + 16, '#c8b088');
      ell(l, rx + 2, ry + 18, 4, 2, '#c8b088');
    });
    void k;
  },
};

const rowboat: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.75, 0.5);
    layer(p.c, (l) => {
      fillPoly(l, [[x - 46, y - 10], [x + 40, y - 10], [x + 52, y - 16], [x + 34, y + 4], [x - 38, y + 4]], R.woodRed[2]);
      fillPoly(l, [[x - 46, y - 10], [x + 40, y - 10], [x + 52, y - 16], [x + 46, y - 13], [x - 44, y - 8]], R.woodRed[4]);
      fillPoly(l, [[x - 40, y - 9], [x + 38, y - 9], [x + 30, y + 1], [x - 34, y + 1]], R.wood[2]);
      for (let i = -30; i < 30; i += 16) px(l, x + i, y - 9, R.wood[4], 3, 10);
      ln(l, x - 10, y - 6, x + 30, y - 22, R.wood[4], 2);
      fillPoly(l, [[x + 26, y - 26], [x + 34, y - 20], [x + 30, y - 16], [x + 22, y - 22]], R.wood[3]);
      for (let i = -44; i < 50; i += 3) px(l, x + i, y + 6, '#cfeaf2', 2, 1);
    });
    void k;
  },
};

const birdbath: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 14, y + 4, 26, 9, 0.3);
    layer(p.c, (l) => {
      foliage(l, [{ x, y: y - 4, rx: 14, ry: 7, z: 1 }], R.stone, k.seed, { cell: 6 });
      fillPoly(l, [[x - 6, y - 6], [x + 6, y - 6], [x + 4, y - 40], [x - 4, y - 40]], R.stone[3]);
      fillPoly(l, [[x - 6, y - 6], [x - 2, y - 6], [x - 1, y - 40], [x - 4, y - 40]], R.stone[5]);
      ell(l, x, y - 44, 26, 11, R.stone[2]);
      ell(l, x, y - 45, 25, 10, R.stone[4]);
      ell(l, x, y - 46, 20, 7.5, R.water[2]);
      ell(l, x - 5, y - 47, 9, 3, R.water[4]);
      px(l, x - 12, y - 47, R.water[6], 5, 1);
      // a sparrow on the rim
      px(l, x + 14, y - 54, R.wood[2], 6, 5);
      px(l, x + 18, y - 57, R.wood[1], 4, 4);
      px(l, x + 22, y - 56, '#f2b84b', 2, 1);
    });
    layer(p.c, (l) => foliage(l, [{ x: x - 4, y: y - 14, rx: 6, ry: 10, z: 1 }], R.oak, k.seed + 3, { cell: 2.8 }), { outline: 0.6 });
  },
};

const gnome: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 2, 10, 3, 0.26);
    const coat = [R.blue, R.red, ['#2a4a2a', '#3a6a3a', '#4e8a4e', '#68a868', '#8cc48c', '#b0dcb0']][k.seed % 3];
    layer(p.c, (l) => {
      px(l, x - 6, y - 4, '#5a3a2a', 12, 4);
      fillPoly(l, [[x - 7, y - 4], [x + 7, y - 4], [x + 5, y - 18], [x - 5, y - 18]], coat[3]);
      fillPoly(l, [[x + 2, y - 4], [x + 7, y - 4], [x + 5, y - 18], [x + 2, y - 18]], coat[1]);
      fillPoly(l, [[x - 5, y - 18], [x + 5, y - 18], [x + 4, y - 9], [x - 4, y - 9]], '#f6f2e8');
      ell(l, x, y - 21, 5, 4.5, '#f2c8a0');
      px(l, x - 1, y - 20, '#e8a080', 3, 2);
      fillPoly(l, [[x - 6, y - 24], [x + 6, y - 24], [x + 1, y - 38]], '#d8302a');
      fillPoly(l, [[x - 6, y - 24], [x - 1, y - 24], [x + 1, y - 38]], '#e85a40');
      px(l, x - 2, y - 22, '#1a1418');
      px(l, x + 2, y - 22, '#1a1418');
    });
  },
};

const bicycle: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    contactShadow(p.c, x + 6, y + 3, 30, 5, 0.26);
    const red = ['#7a1e1e', '#a02828', '#c43c34', '#de5a48'];
    layer(p.c, (l) => {
      for (const wx of [-20, 20]) {
        ell(l, x + wx, y - 13, 13, 13, '#2a2630');
        ell(l, x + wx, y - 13, 11, 11, 'rgba(0,0,0,0)');
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          ln(l, x + wx, y - 13, x + wx + Math.cos(ang) * 10, y - 13 + Math.sin(ang) * 10, '#a8aab4');
        }
        ell(l, x + wx, y - 13, 2, 2, '#d8dade');
      }
      ln(l, x - 20, y - 13, x - 2, y - 28, red[2], 3);
      ln(l, x - 2, y - 28, x + 16, y - 26, red[2], 3);
      ln(l, x + 16, y - 26, x + 20, y - 13, red[1], 3);
      ln(l, x - 20, y - 13, x, y - 12, red[1], 3);
      ln(l, x, y - 12, x - 2, y - 28, red[3], 2);
      px(l, x - 8, y - 33, '#3a2a26', 12, 3);
      ln(l, x + 16, y - 26, x + 14, y - 36, red[2], 2);
      px(l, x + 8, y - 38, '#3a3640', 12, 2);
      // wicker basket with flowers
      px(l, x + 18, y - 42, R.hay[2], 14, 9);
      for (let i = 0; i < 14; i += 3) px(l, x + 18 + i, y - 42, R.hay[0], 1, 9);
      foliage(l, [{ x: x + 25, y: y - 46, rx: 8, ry: 5, z: 1 }], R.apple, k.seed, { cell: 2.6, dots: ['#f08aa8', '#f6d860', '#fbf7ee'], dotChance: 0.9, dotSize: 3 });
    });
  },
};

export const WATER4: Record<string, PropArt> = {
  rock: { draw: (p, k) => ROCKS[k.variant && ROCKS[k.variant] ? k.variant : (['boulder', 'mossy', 'cluster', 'flat'] as const)[k.seed % 4]](p, k) },
  reeds: { draw: (p, k) => REEDS[k.variant && REEDS[k.variant] ? k.variant : (['cattail', 'reedgrass', 'iris', 'rush'] as const)[k.seed % 4]](p, k) },
  dock: dock,
  rowboat: rowboat,
  birdbath,
  gnome,
  bicycle,
};
export const ROCK_VARIANTS = Object.keys(ROCKS);
export const REED_VARIANTS = Object.keys(REEDS);
export { darken, lighten, hash };

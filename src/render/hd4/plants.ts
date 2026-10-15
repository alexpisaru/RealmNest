// 128×64 plants — bushes, flowers, grasses, ferns and hedges.
//   bush:       round · hydrangea · berry · boxwood · lavender · rose · fern
//   flowers:    daisy · tulip · poppy · marigold · hollyhock · foxglove ·
//               forgetmenot · cosmos · wild  (legacy flowerPatch maps here)
//   tallGrass:  tuft · seedheads · sedge · clump
//   hedgeRow:   clipped hedge with blossom variants
import { darken, lighten } from '../color';
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { contactShadow, curve, ell, foliage, hash, layer, ln, type Mass, px, R, type Ramp, rng } from './kit4';

const anchor = (p: PropPainter, a = 0.5, b = 0.5): [number, number] => {
  const [x, y] = p.P(a, b, 0);
  return [Math.round(x), Math.round(y)];
};

// ── flower heads (native pixels) ────────────────────────────
type Head = (c: CanvasRenderingContext2D, x: number, y: number, col: string, seed: number) => void;

const daisyHead: Head = (c, x, y, col) => {
  const shade = darken(col, 0.18);
  px(c, x - 2, y, col, 2, 1);
  px(c, x + 1, y, col, 2, 1);
  px(c, x, y - 2, col, 1, 2);
  px(c, x, y + 1, shade, 1, 2);
  px(c, x - 1, y - 1, col);
  px(c, x + 1, y + 1, shade);
  px(c, x + 1, y - 1, col);
  px(c, x - 1, y + 1, shade);
  px(c, x, y, '#f2c43a');
};
const tulipHead: Head = (c, x, y, col) => {
  px(c, x - 1, y - 1, col, 3, 3);
  px(c, x - 1, y + 1, darken(col, 0.25), 3, 1);
  px(c, x - 1, y - 2, col);
  px(c, x + 1, y - 2, darken(col, 0.12));
  px(c, x - 1, y - 1, lighten(col, 0.3));
};
const poppyHead: Head = (c, x, y, col) => {
  px(c, x - 2, y - 1, col, 4, 2);
  px(c, x - 1, y - 2, lighten(col, 0.15), 3, 1);
  px(c, x - 2, y + 1, darken(col, 0.3), 4, 1);
  px(c, x, y - 1, '#2a1a1a');
};
const marigoldHead: Head = (c, x, y, col) => {
  px(c, x - 1, y - 1, col, 3, 3);
  px(c, x - 2, y, darken(col, 0.15));
  px(c, x + 2, y, darken(col, 0.2));
  px(c, x, y - 2, lighten(col, 0.2));
  px(c, x, y, darken(col, 0.35));
  px(c, x - 1, y - 1, lighten(col, 0.35));
};
const rosetteHead: Head = (c, x, y, col) => {
  px(c, x - 2, y - 1, col, 4, 3);
  px(c, x - 1, y - 2, col, 2, 1);
  px(c, x - 1, y + 2, darken(col, 0.25), 2, 1);
  px(c, x + 1, y - 1, darken(col, 0.15), 1, 3);
  px(c, x - 1, y, darken(col, 0.45), 2, 1);
  px(c, x - 2, y - 1, lighten(col, 0.3));
};
/** A rose: spiral of petals 6×5 with a dark heart. */
const roseHead: Head = (c, x, y, col) => {
  const d = darken(col, 0.25);
  const l = lighten(col, 0.3);
  px(c, x - 3, y - 1, col, 6, 3);
  px(c, x - 2, y - 2, col, 4, 1);
  px(c, x - 2, y + 2, d, 4, 1);
  px(c, x + 2, y - 1, d, 1, 3);
  px(c, x - 1, y - 1, d, 2, 1);
  px(c, x, y, darken(col, 0.45));
  px(c, x - 3, y - 1, l);
  px(c, x - 2, y - 2, l);
};
const cosmosHead: Head = (c, x, y, col, seed) => {
  const sh = darken(col, 0.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + seed;
    px(c, x + Math.round(Math.cos(a) * 2), y + Math.round(Math.sin(a) * 1.6), i > 2 ? sh : col);
  }
  px(c, x, y, '#e8b830');
};
const tinyHead: Head = (c, x, y, col) => {
  px(c, x, y, col);
  px(c, x + 1, y, darken(col, 0.2));
  px(c, x, y - 1, lighten(col, 0.25));
};

/** Leaves at the base of a flower clump: short arching blades. */
export function leafBlades(c: CanvasRenderingContext2D, x: number, y: number, n: number, ramp: Ramp, seed: number, h = 9, spread = 14) {
  const Rn = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x + (Rn() - 0.5) * spread;
    const len = h * (0.6 + Rn() * 0.6);
    const lean = (Rn() - 0.5) * 8;
    const tone = 2 + Math.floor(Rn() * 3);
    curve(c, bx, y, bx + lean * 0.3, y - len * 0.6, bx + lean, y - len, ramp[tone]);
    px(c, bx + lean, y - len, ramp[Math.min(ramp.length - 1, tone + 2)]);
  }
}

interface FlowerSpec {
  head: Head;
  cols: string[];
  /** stem height range (px) */
  stem: [number, number];
  count: [number, number];
  leaves: Ramp;
  /** heads per stem (spikes) */
  spike?: number;
  low?: boolean;
}

const LEAF = R.apple;
const FLOWERS: Record<string, FlowerSpec> = {
  daisy: { head: daisyHead, cols: ['#fbf7ee', '#ffffff'], stem: [8, 16], count: [9, 14], leaves: LEAF },
  tulip: { head: tulipHead, cols: ['#d8362e', '#f2b33a', '#e8577a', '#fbf2e6'], stem: [12, 20], count: [6, 10], leaves: R.birch },
  poppy: { head: poppyHead, cols: ['#d8302a', '#e4472e'], stem: [12, 22], count: [6, 10], leaves: R.birch },
  marigold: { head: marigoldHead, cols: ['#f08a1e', '#f6b42a', '#e86a18'], stem: [5, 10], count: [8, 13], leaves: R.oak },
  hollyhock: { head: rosetteHead, cols: ['#e88aa8', '#fbe6ee', '#c4466e'], stem: [34, 52], count: [3, 4], leaves: R.apple, spike: 6 },
  foxglove: { head: tinyHead, cols: ['#a066c8', '#c48ae0', '#8048a8'], stem: [28, 40], count: [3, 5], leaves: R.oak, spike: 9 },
  forgetmenot: { head: tinyHead, cols: ['#6a9ae6', '#8ab4f2', '#fbf2e6'], stem: [2, 5], count: [26, 36], leaves: R.oak, low: true },
  cosmos: { head: cosmosHead, cols: ['#f08ab4', '#fbe2ee', '#d85a90'], stem: [14, 26], count: [7, 11], leaves: R.birch },
  lavenderSmall: { head: tinyHead, cols: ['#8a6ad0', '#a68ae0', '#6e4eb4'], stem: [12, 18], count: [10, 14], leaves: ['#3a4a3a', '#4a5e48', '#5e7258', '#748a6c', '#8ea486', '#a8bca0'], spike: 5 },
  wild: { head: daisyHead, cols: ['#fbf7ee', '#f6d860', '#e8577a', '#a8c0f0'], stem: [6, 18], count: [10, 16], leaves: LEAF },
};
// legacy flowerPatch variants
const FLOWER_ALIAS: Record<string, string> = { pink: 'cosmos', yellow: 'marigold', white: 'daisy', purple: 'lavenderSmall', red: 'poppy', mixed: 'wild' };
const FLOWER_KEYS = ['daisy', 'tulip', 'poppy', 'marigold', 'cosmos', 'wild', 'forgetmenot'];

function flowerClump(p: PropPainter, k: PropCtx, kind?: string) {
  const c = p.c;
  const key = kind && FLOWERS[kind] ? kind : FLOWER_ALIAS[kind ?? ''] ?? FLOWER_KEYS[k.seed % FLOWER_KEYS.length];
  const f = FLOWERS[key];
  const Rn = rng(k.seed * 41 + key.length);
  const [x, y] = anchor(p, 0.4 + Rn() * 0.2, 0.4 + Rn() * 0.2);
  const W = f.low ? 34 : 28;
  contactShadow(c, x + 10, y + 4, W + 6, 10, 0.2);
  layer(
    c,
    (l) => {
      // a cushion of leaves the stems rise from
      const mound: Mass[] = [];
      for (let i = 0; i < 5; i++) mound.push({ x: x + (Rn() - 0.5) * W * 1.2, y: y - 4 - Rn() * 4, rx: 9 + Rn() * 6, ry: 6 + Rn() * 3, z: i });
      foliage(l, mound, f.leaves, k.seed, { cell: 3.2, tilt: 0.2 });
      leafBlades(l, x, y, f.low ? 18 : 16, f.leaves, k.seed, f.low ? 8 : 14, W * 1.6);
      const n = Math.round((f.count[0] + Math.floor(Rn() * (f.count[1] - f.count[0]))) * 1.8);
      const heads: [number, number, string][] = [];
      for (let i = 0; i < n; i++) {
        const a2 = Rn() * Math.PI * 2;
        const d = Math.sqrt(Rn());
        const sx = x + Math.cos(a2) * d * W;
        const sy = y - 3 + Math.sin(a2) * d * (W * 0.32);
        const h = (f.stem[0] + Rn() * (f.stem[1] - f.stem[0])) * 1.5;
        const lean = (Rn() - 0.5) * 8;
        const col = f.cols[Math.floor(Rn() * f.cols.length)];
        if (!f.low) curve(l, sx, sy, sx + lean * 0.2, sy - h * 0.5, sx + lean, sy - h, f.leaves[2 + (i & 1)]);
        if (f.spike) {
          for (let j = 0; j < f.spike; j++) {
            const t = j / f.spike;
            heads.push([sx + lean * (1 - t * 0.3) + (j & 1 ? 1 : -1), sy - h + t * h * 0.55, j < 2 ? lighten(col, 0.12) : col]);
          }
        } else heads.push([sx + lean, sy - h, col]);
      }
      heads.sort((a3, b3) => a3[1] - b3[1]);
      for (const [hx, hy, col] of heads) f.head(l, hx, hy, col, Math.floor(hx * 13 + hy));
    },
    { outline: 0.5 },
  );
}

// ── bushes ──────────────────────────────────────────────────
function domeMasses(x: number, y: number, rx: number, ry: number, Rn: () => number, n = 4): Mass[] {
  const out: Mass[] = [{ x, y: y - ry * 0.55, rx: rx * 0.7, ry: ry * 0.62, z: 1 }];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.05 + (i / Math.max(1, n - 1)) * 0.9);
    out.push({ x: x + Math.cos(a) * rx * 0.48, y: y - ry * 0.45 + Math.sin(a) * ry * 0.25 + ry * 0.15, rx: rx * (0.45 + Rn() * 0.12), ry: ry * (0.42 + Rn() * 0.1), z: 2 + i * 0.1 });
  }
  out.push({ x: x + (Rn() - 0.5) * rx * 0.3, y: y - ry * 0.25, rx: rx * 0.6, ry: ry * 0.38, z: 3 });
  return out;
}

function bush(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const v = k.variant && BUSHES[k.variant] ? k.variant : (['round', 'round', 'berry', 'hydrangea', 'boxwood', 'rose'] as const)[k.seed % 6];
  BUSHES[v](p, k);
  void c;
}

const BUSHES: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  round(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 1);
    const s = 0.85 + Rn() * 0.3;
    contactShadow(p.c, x + 12 * s, y + 4, 34 * s, 10 * s, 0.3);
    layer(p.c, (l) => foliage(l, domeMasses(x, y, 32 * s, 34 * s, Rn), R.hedge, k.seed, { cell: 5, tilt: 0.18, bias: 0.02 }));
  },
  hydrangea(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 2);
    const s = 0.9 + Rn() * 0.25;
    const blooms = [['#6a8ad8', '#8aa8ec', '#b0c6f6'], ['#d86a9a', '#ec8ab4', '#f6b6d0'], ['#ece6f2', '#ffffff', '#d8cee6']][k.seed % 3];
    contactShadow(p.c, x + 12 * s, y + 4, 36 * s, 11 * s, 0.3);
    const masses = domeMasses(x, y, 34 * s, 34 * s, Rn);
    layer(p.c, (l) => {
      foliage(l, masses, R.oak, k.seed, { cell: 5.5, tilt: 0.2 });
      // mophead flower balls made of tiny florets, lit on the upper left
      const ramp = [darken(blooms[0], 0.45), darken(blooms[0], 0.25), blooms[0], blooms[1], blooms[2], lighten(blooms[2], 0.3)];
      const balls: Mass[] = [];
      for (let i = 0; i < 7; i++) {
        const m = masses[i % masses.length];
        const r = 7 + Rn() * 3.5;
        balls.push({ x: m.x + (Rn() - 0.5) * m.rx, y: m.y - m.ry * 0.3 + (Rn() - 0.5) * m.ry * 0.6, rx: r, ry: r * 0.86, z: m.y + i });
      }
      // mophead flower balls: tiny florets as clumps, lit on the upper left
      foliage(l, balls, ramp, k.seed + 5, { cell: 2.4, tilt: 0.25 });
    });
  },
  berry(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 3);
    const s = 0.85 + Rn() * 0.3;
    contactShadow(p.c, x + 12 * s, y + 4, 32 * s, 10 * s, 0.3);
    layer(p.c, (l) =>
      foliage(l, domeMasses(x, y, 30 * s, 30 * s, Rn, 5), R.oak, k.seed, { cell: 4.5, tilt: 0.22, bias: -0.04, dots: ['#c42a3a', '#e0404a', '#8a1a2a'], dotChance: 0.22, dotSize: 3 }),
    );
  },
  boxwood(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 4);
    const s = 0.9 + Rn() * 0.2;
    contactShadow(p.c, x + 12 * s, y + 4, 30 * s, 9 * s, 0.32);
    // clipped ball on a short stem, very fine leaf texture
    layer(p.c, (l) => foliage(l, [{ x, y: y - 26 * s, rx: 25 * s, ry: 23 * s, z: 1 }], R.hedge, k.seed, { cell: 3.2, tilt: 0.1, bias: 0.04 }));
  },
  lavender(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 5);
    contactShadow(p.c, x + 10, y + 4, 30, 9, 0.26);
    const grey = ['#2e3a30', '#3e4c3e', '#52624e', '#687a62', '#829478', '#9eae92'];
    layer(p.c, (l) => {
      foliage(l, domeMasses(x, y + 4, 26, 18, Rn, 4), grey, k.seed, { cell: 3.5, tilt: 0.2 });
      const spikes: [number, number, number][] = [];
      for (let i = 0; i < 46; i++) {
        const a2 = Rn() * Math.PI;
        const d = Math.sqrt(Rn());
        spikes.push([x + Math.cos(a2 + Math.PI) * d * 26, y - 10 - Math.sin(a2) * d * 8, 16 + Rn() * 14]);
      }
      spikes.sort((m, n) => m[1] - n[1]);
      for (const [sx, base, h] of spikes) {
        const lean = (sx - x) * 0.12;
        ln(l, sx, base, sx + lean, base - h, grey[2]);
        for (let j = 0; j < 8; j++) {
          const t = j / 8;
          const col = t < 0.25 ? '#b8a0ec' : t < 0.6 ? '#8f6ed6' : '#6e4eb4';
          px(l, sx + lean * (1 - t * 0.4) - (j & 1), base - h + j * 1.4, col, 2, 1);
        }
      }
    });
  },
  rose(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 6);
    const s = 0.9 + Rn() * 0.2;
    const col = ['#c8283a', '#e8577a', '#f6d2dc', '#f2b33a'][k.seed % 4];
    contactShadow(p.c, x + 12 * s, y + 4, 32 * s, 10 * s, 0.3);
    layer(p.c, (l) => {
      foliage(l, domeMasses(x, y, 30 * s, 30 * s, Rn), R.oak, k.seed, { cell: 4.5, tilt: 0.2, bias: -0.02 });
      for (let i = 0; i < 16; i++) roseHead(l, x + (Rn() - 0.5) * 52 * s, y - 12 - Rn() * 40 * s, col, i);
    });
  },
  fern(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 7);
    contactShadow(p.c, x + 10, y + 3, 30, 8, 0.24);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (1.08 + (i / 8) * 0.84);
          const len = 30 + Rn() * 14;
          const ex = x + Math.cos(a) * len;
          const ey = y - 6 + Math.sin(a) * len * 0.75;
          const mx = (x + ex) / 2;
          const my = Math.min(y - 8, ey) - 10;
          const tone = Math.cos(a) < 0 ? 4 : 2;
          // frond spine with leaflets on both sides
          const n = 14;
          for (let j = 1; j < n; j++) {
            const t = j / n;
            const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
            const qy = (1 - t) * (1 - t) * (y - 4) + 2 * (1 - t) * t * my + t * t * ey;
            const lw = Math.round((1 - t) * 5) + 1;
            px(l, qx - lw, qy, R.birch[tone], lw, 1);
            px(l, qx, qy + 1, R.birch[tone - 1], lw, 1);
            px(l, qx, qy, R.birch[tone + 1]);
          }
        }
      },
      { outline: 0.6 },
    );
  },
};

// ── grasses ─────────────────────────────────────────────────
const GRASS: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  tuft(p, k) {
    const Rn = rng(k.seed * 3 + 1);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) {
        const [x, y] = anchor(p, 0.25 + Rn() * 0.5, 0.25 + Rn() * 0.5);
        leafBlades(l, x, y, 18, R.birch, k.seed + i, 22, 22);
      }
    }, { outline: 0.5 });
  },
  seedheads(p, k) {
    const Rn = rng(k.seed * 3 + 2);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) {
        const [x, y] = anchor(p, 0.25 + Rn() * 0.5, 0.25 + Rn() * 0.5);
        leafBlades(l, x, y, 16, R.willow, k.seed + i, 20, 22);
        for (let j = 0; j < 7; j++) {
          const sx = x + (Rn() - 0.5) * 20;
          const h = 28 + Rn() * 14;
          const lean = (Rn() - 0.5) * 8;
          curve(l, sx, y, sx + lean * 0.2, y - h * 0.5, sx + lean, y - h, R.hay[2]);
          for (let q = 0; q < 4; q++) px(l, sx + lean + (q & 1 ? 1 : -1), y - h + q * 1.5, R.hay[4 + (q === 0 ? 1 : 0)]);
        }
      }
    }, { outline: 0.5 });
  },
  sedge(p, k) {
    const [x, y] = anchor(p);
    layer(p.c, (l) => {
      const Rn = rng(k.seed * 3 + 3);
      for (let i = 0; i < 34; i++) {
        const sx = x + (Rn() - 0.5) * 28;
        const len = 20 + Rn() * 22;
        const a = Math.PI * (1.15 + Rn() * 0.7);
        curve(l, sx, y, sx + Math.cos(a) * len * 0.3, y - len * 0.8, sx + Math.cos(a) * len, y - len * 0.55, R.willow[2 + (i % 3)]);
      }
    }, { outline: 0.5 });
  },
  clump(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 3 + 4);
    layer(p.c, (l) => {
      leafBlades(l, x, y, 48, R.oak, k.seed, 24, 36);
      for (let i = 0; i < 9; i++) daisyHead(l, x + (Rn() - 0.5) * 30, y - 14 - Rn() * 10, '#fbf2e6', i);
    }, { outline: 0.5 });
  },
};

// ── hedges ──────────────────────────────────────────────────
function hedgeRow(p: PropPainter, k: PropCtx) {
  const w = k.w;
  const Rn = rng(k.seed * 5 + 9);
  const bloom: Record<string, string[]> = { white: ['#fbf7ee', '#ffffff'], pink: ['#e8577a', '#f6b6d0'], mixed: ['#f6d860', '#e8577a', '#fbf7ee'] };
  const dots = k.variant ? bloom[k.variant] : undefined;
  // shadow along the hedge's lower right
  const [sx0, sy0] = p.P(0, 0.9, 0);
  const [sx1, sy1] = p.P(w, 0.9, 0);
  contactShadow(p.c, (sx0 + sx1) / 2 + 14, (sy0 + sy1) / 2 + 4, Math.hypot(sx1 - sx0, sy1 - sy0) / 2 + 20, 14, 0.3);
  const masses: Mass[] = [];
  const n = Math.round(w * 3);
  for (let i = 0; i < n; i++) {
    const [x, y] = p.P((i + 0.5) / 3, 0.55, 0);
    masses.push({ x: x + (Rn() - 0.5) * 6, y: y - 26 - Rn() * 6, rx: 22 + Rn() * 6, ry: 24 + Rn() * 5, z: y });
  }
  layer(p.c, (l) => foliage(l, masses, R.hedge, k.seed, { cell: 4.5, tilt: 0.16, dots, dotChance: dots ? 0.35 : 0, dotSize: 3 }));
}

// ── sunflowers ──────────────────────────────────────────────
function sunflowers(p: PropPainter, k: PropCtx) {
  const Rn = rng(k.seed * 9 + 1);
  const c = p.c;
  const [x0, y0] = anchor(p);
  contactShadow(c, x0 + 14, y0 + 4, 34, 9, 0.24);
  const stems: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const [x, y] = anchor(p, 0.25 + i * 0.25, 0.3 + Rn() * 0.4);
    stems.push([x, y, 110 + Rn() * 50]);
  }
  stems.sort((a, b) => a[1] - b[1]);
  for (const [x, y, h] of stems)
    layer(c, (l) => {
      // stem with big heart-shaped leaves
      px(l, x - 1, y - h, R.birch[2], 3, h);
      px(l, x - 1, y - h, R.birch[4], 1, h);
      for (const t of [0.3, 0.5, 0.68]) {
        const ly = y - h * t;
        const side = t === 0.5 ? 1 : -1;
        foliage(l, [{ x: x + side * 10, y: ly, rx: 10, ry: 6, z: 1 }], R.birch, Math.floor(x + t * 100), { cell: 3, tilt: 0.1 });
      }
      // head facing the sun (slightly to the left), petal ring + seed disc
      const hx = x - 2;
      const hy = y - h - 2;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const r = 11 + (a & 1);
        const pxl = hx + Math.cos(ang) * r;
        const pyl = hy + Math.sin(ang) * r * 0.85;
        ell(l, pxl, pyl, 3.2, 2.2, a < 8 ? '#f2b62a' : '#f8cc40');
        px(l, pxl - 1, pyl - 1, '#fde68a');
      }
      ell(l, hx, hy, 8, 7, '#4a2e18');
      ell(l, hx - 1, hy - 1, 6, 5, '#6a4224');
      for (let i = 0; i < 18; i++) px(l, hx + (hash(i, 1, k.seed) - 0.5) * 11, hy + (hash(i, 2, k.seed) - 0.5) * 9, '#8a5a2e');
    });
}

export const PLANTS: Record<string, PropArt> = {
  bush: { draw: bush },
  shrub: { draw: bush },
  flowers: { draw: (p, k) => flowerClump(p, k, k.variant) },
  flowerPatch: { draw: (p, k) => flowerClump(p, k, k.variant) },
  tallGrass: {
    draw(p, k) {
      const v = k.variant && GRASS[k.variant] ? k.variant : (['tuft', 'seedheads', 'sedge', 'clump'] as const)[k.seed % 4];
      GRASS[v](p, k);
    },
  },
  fern: { draw: (p, k) => BUSHES.fern(p, k) },
  hedgeRow: { draw: hedgeRow },
  sunflowers: { draw: sunflowers },
};

export const BUSH_VARIANTS = Object.keys(BUSHES);
export const FLOWER_VARIANTS = Object.keys(FLOWERS);
export const GRASS_VARIANTS = Object.keys(GRASS);

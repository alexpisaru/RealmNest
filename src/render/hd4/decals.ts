// 128×64 ground decals — flat details baked into the ground (never occlude).
//   path edges:   edge.tufts · edge.stones · edge.crumbs · edge.flowers · edge.moss · edge.puddle
//   transitions:  trans.patchy · trans.worn · trans.mud · trans.dry · trans.clover · trans.gravel
//   clutter:      clutter.leaves · clutter.twigs · clutter.pebbles · clutter.mushrooms ·
//                 clutter.flowers · clutter.weeds · steps (stepping stones)
// Decals draw straight into the ground buffer: no layers (the target is the whole scene).
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { bayer, curve, ell, hash, ln, px, R, rng } from './kit4';

type C = CanvasRenderingContext2D;

/** Random points inside the decal's footprint (tile-local a, b) → screen. */
function scatter(p: PropPainter, n: number, seed: number, a0 = 0.1, a1 = 0.9, b0 = 0.1, b1 = 0.9) {
  const Rn = rng(seed);
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = p.P(a0 + Rn() * (a1 - a0) * p.pw, b0 + Rn() * (b1 - b0) * p.pd, 0);
    out.push([Math.round(x), Math.round(y), Rn()]);
  }
  return out;
}

function pebble(c: C, x: number, y: number, w: number, seed: number, r = R.stone) {
  const h = Math.max(2, Math.round(w * 0.6));
  ell(c, x + 0.5, y + 1, w / 2 + 0.5, h / 2 + 0.5, r[1]);
  ell(c, x, y, w / 2, h / 2, r[3 + (seed > 0.5 ? 1 : 0)]);
  px(c, x - w * 0.25, y - h * 0.3, r[5], Math.max(1, Math.round(w * 0.3)), 1);
}

function blade(c: C, x: number, y: number, h: number, lean: number, ramp: readonly string[], tone: number) {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    px(c, x + Math.round(lean * t * t), y - j, ramp[Math.min(ramp.length - 1, tone + (t > 0.7 ? 2 : t > 0.35 ? 1 : 0))]);
  }
}

function tuftAt(c: C, x: number, y: number, n: number, h: number, seed: number, ramp: readonly string[] = R.birch) {
  const Rn = rng(seed);
  for (let i = 0; i < n; i++) blade(c, x + Math.round((Rn() - 0.5) * n * 1.4), y, Math.round(h * (0.5 + Rn() * 0.6)), (Rn() - 0.5) * 6, ramp, 1 + Math.floor(Rn() * 2));
}

function leaf(c: C, x: number, y: number, col: string, flip: boolean) {
  px(c, x, y, col, 3, 1);
  px(c, x + (flip ? 0 : 1), y - 1, col, 2, 1);
  px(c, x + (flip ? 2 : 0), y + 1, col);
}

const D: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  // ── path edges ──────────────────────────────────────────
  'edge.tufts'(p, k) {
    for (const [x, y, r] of scatter(p, 7, k.seed, 0.05, 0.95, 0.35, 0.65)) tuftAt(p.c, x, y, 5 + Math.floor(r * 4), 7 + r * 6, Math.floor(r * 1000));
  },
  'edge.stones'(p, k) {
    for (const [x, y, r] of scatter(p, 11, k.seed, 0.05, 0.95, 0.42, 0.58)) pebble(p.c, x, y, 3 + Math.round(r * 5), r);
    for (const [x, y, r] of scatter(p, 3, k.seed + 1, 0.1, 0.9, 0.4, 0.6)) tuftAt(p.c, x, y, 3, 6, Math.floor(r * 100));
  },
  'edge.crumbs'(p, k) {
    for (const [x, y, r] of scatter(p, 40, k.seed, 0.05, 0.95, 0.3, 0.7)) px(p.c, x, y, R.soil[3 + Math.floor(r * 3)], r > 0.7 ? 2 : 1, 1);
    for (const [x, y, r] of scatter(p, 6, k.seed + 2, 0.1, 0.9, 0.35, 0.65)) pebble(p.c, x, y, 2 + Math.round(r * 2), r, R.stoneWarm);
  },
  'edge.flowers'(p, k) {
    for (const [x, y, r] of scatter(p, 8, k.seed, 0.05, 0.95, 0.35, 0.65)) {
      tuftAt(p.c, x, y, 3, 6, Math.floor(r * 300));
      const col = ['#fbf7ee', '#f6d860', '#f2b6c8'][Math.floor(r * 3)];
      px(p.c, x - 1, y - 6, col, 3, 1);
      px(p.c, x, y - 7, col, 1, 3);
      px(p.c, x, y - 6, '#e8b830');
    }
  },
  'edge.moss'(p, k) {
    const Rn = rng(k.seed);
    for (const [x, y] of scatter(p, 6, k.seed, 0.1, 0.9, 0.3, 0.7)) {
      const rx = 6 + Rn() * 8;
      for (let j = -3; j <= 3; j++)
        for (let i = -rx; i <= rx; i++) {
          if ((i / rx) ** 2 + (j / 3.5) ** 2 > 1 || hash(x + i, y + j, k.seed) < 0.25) continue;
          px(p.c, x + i, y + j, R.oak[3 + (bayer(x + i, y + j) > 0.5 ? 1 : 0) + (j < -1 ? 1 : 0)]);
        }
    }
  },
  'edge.puddle'(p, k) {
    const [x, y] = p.P(0.5 * p.pw, 0.5 * p.pd, 0);
    const Rn = rng(k.seed);
    const rx = 16 + Rn() * 10;
    ell(p.c, x, y + 1, rx + 2, rx * 0.36 + 1, R.soil[2]);
    ell(p.c, x, y, rx, rx * 0.34, R.water[2]);
    ell(p.c, x - rx * 0.2, y - 1, rx * 0.6, rx * 0.18, R.water[4]);
    px(p.c, x - rx * 0.5, y - 1, R.water[6], Math.round(rx * 0.4), 1);
    px(p.c, x + rx * 0.1, y + 2, R.water[5], Math.round(rx * 0.3), 1);
  },
  // ── transitions ─────────────────────────────────────────
  'trans.patchy'(p, k) {
    for (const [x, y, r] of scatter(p, 10, k.seed)) tuftAt(p.c, x, y, 4 + Math.floor(r * 5), 6 + r * 6, Math.floor(r * 999), R.apple);
  },
  'trans.worn'(p, k) {
    // a scuffed patch of bare, dry earth: irregular, lighter than the grass, blades surviving at the rim
    const [x, y] = p.P(0.5 * p.pw, 0.5 * p.pd, 0);
    const Rn = rng(k.seed);
    const rx = 24 + Rn() * 12;
    const ry = rx * 0.38;
    const ph = Rn() * 6;
    for (let j = -Math.ceil(ry) - 2; j <= ry + 2; j++)
      for (let i = -Math.ceil(rx) - 2; i <= rx + 2; i++) {
        const a = Math.atan2(j / ry, i / rx);
        const edge = 1 + Math.sin(a * 3 + ph) * 0.12 + Math.sin(a * 5 - ph) * 0.08;
        const d = Math.sqrt((i / rx) ** 2 + (j / ry) ** 2) / edge;
        if (d > 1) continue;
        // the rim breaks up into the turf: fewer bare pixels toward the edge
        if (d > 0.62 && hash(x + i, y + j, k.seed) < (d - 0.62) * 2.4) continue;
        const h = hash((x + i) >> 1, y + j, k.seed + 1);
        const tone = d < 0.5 ? 4 : 3;
        px(p.c, x + i, y + j, R.dirt[h < 0.08 ? tone - 1 : h > 0.94 ? tone + 1 : tone]);
      }
    for (const [tx, ty, r] of scatter(p, 4, k.seed + 3, 0.25, 0.75, 0.3, 0.7)) {
      if (r < 0.5) pebble(p.c, tx, ty, 3, r, R.stoneWarm);
      else tuftAt(p.c, tx, ty, 3, 5, Math.floor(r * 77));
    }
  },
  'trans.mud'(p, k) {
    // a soft, wet patch: darker earth toward the middle, a lighter dried rim, boot prints and a sky glint
    const [x, y] = p.P(0.5 * p.pw, 0.5 * p.pd, 0);
    const Rn = rng(k.seed);
    const rx = 20 + Rn() * 10;
    const ry = rx * 0.36;
    const ph = Rn() * 6;
    for (let j = -Math.ceil(ry) - 2; j <= ry + 2; j++)
      for (let i = -Math.ceil(rx) - 2; i <= rx + 2; i++) {
        const a = Math.atan2(j / ry, i / rx);
        const edge = 1 + Math.sin(a * 2 + ph) * 0.14 + Math.sin(a * 5 + ph * 2) * 0.07;
        const d = Math.sqrt((i / rx) ** 2 + (j / ry) ** 2) / edge;
        if (d > 1) continue;
        if (d > 0.8 && hash(x + i, y + j, k.seed) < (d - 0.8) * 3) continue;
        const tone = d > 0.82 ? 3 : d > 0.55 ? 2 : 1;
        px(p.c, x + i, y + j, R.dirt[tone - (hash(x + i, y + j, k.seed + 2) < 0.06 ? 1 : 0)]);
      }
    // boot prints
    for (let i = 0; i < 4; i++) {
      const fx = x - rx * 0.45 + i * rx * 0.3;
      const fy = y + (i & 1 ? 2 : -2);
      px(p.c, fx - 1, fy, R.dirt[0], 3, 1);
      px(p.c, fx, fy + 1, R.dirt[0], 2, 1);
    }
    // water caught in the ruts, glinting with the sky
    px(p.c, x - rx * 0.3, y - 1, R.water[4], 6, 1);
    px(p.c, x - rx * 0.3 + 1, y, R.water[2], 4, 1);
    px(p.c, x + rx * 0.2, y + 2, R.water[5], 3, 1);
  },
  'trans.dry'(p, k) {
    for (const [x, y, r] of scatter(p, 14, k.seed)) tuftAt(p.c, x, y, 3 + Math.floor(r * 3), 5 + r * 5, Math.floor(r * 555), R.hay);
  },
  'trans.clover'(p, k) {
    for (const [x, y, r] of scatter(p, 22, k.seed)) {
      const g = R.apple;
      px(p.c, x - 1, y, g[4], 2, 1);
      px(p.c, x + 1, y - 1, g[5], 2, 1);
      px(p.c, x, y - 2, g[4], 2, 1);
      px(p.c, x, y + 1, g[2], 2, 1);
      if (r > 0.75) {
        px(p.c, x, y - 4, '#fbf7ee', 2, 2);
        px(p.c, x, y - 5, '#ffffff');
      }
    }
  },
  'trans.gravel'(p, k) {
    for (const [x, y, r] of scatter(p, 60, k.seed)) px(p.c, x, y, R.stone[2 + Math.floor(r * 4)], r > 0.6 ? 2 : 1, 1);
    for (const [x, y, r] of scatter(p, 8, k.seed + 1)) pebble(p.c, x, y, 2 + Math.round(r * 3), r);
  },
  // ── clutter ─────────────────────────────────────────────
  'clutter.leaves'(p, k) {
    const cols = ['#c4732e', '#d89a3a', '#9a4a2a', '#7a9a3a', '#e0b048'];
    for (const [x, y, r] of scatter(p, 16, k.seed)) leaf(p.c, x, y, cols[Math.floor(r * cols.length)], r > 0.5);
  },
  'clutter.twigs'(p, k) {
    const Rn = rng(k.seed);
    for (const [x, y] of scatter(p, 6, k.seed)) {
      const len = 6 + Rn() * 10;
      const a = Rn() * Math.PI;
      ln(p.c, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4, R.bark[2]);
      ln(p.c, x, y - 1, x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4 - 1, R.bark[4]);
      if (Rn() > 0.5) ln(p.c, x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.2, x + Math.cos(a) * len * 0.5 + 3, y - 3, R.bark[2]);
    }
  },
  'clutter.pebbles'(p, k) {
    for (const [x, y, r] of scatter(p, 9, k.seed)) pebble(p.c, x, y, 2 + Math.round(r * 5), r);
  },
  'clutter.mushrooms'(p, k) {
    for (const [x, y, r] of scatter(p, 6, k.seed, 0.3, 0.7, 0.3, 0.7)) {
      const red = r > 0.6;
      const cap = red ? ['#8a1a1a', '#c8382a', '#e8604a'] : ['#7a5a3a', '#a07a4e', '#c8a070'];
      px(p.c, x, y - 4, '#efe6d2', 2, 4);
      ell(p.c, x + 1, y - 5, 4, 2.2, cap[0]);
      ell(p.c, x + 0.5, y - 5.5, 3.4, 1.8, cap[1]);
      px(p.c, x - 1, y - 6, cap[2], 2, 1);
      if (red) px(p.c, x + 2, y - 6, '#ffffff');
    }
  },
  'clutter.flowers'(p, k) {
    const cols = ['#fbf7ee', '#f6d860', '#c49cf2', '#f2b6c8', '#8ab4f2'];
    for (const [x, y, r] of scatter(p, 18, k.seed)) {
      const col = cols[Math.floor(r * cols.length)];
      px(p.c, x, y - 1, R.apple[3], 1, 2);
      px(p.c, x - 1, y - 2, col, 3, 1);
      px(p.c, x, y - 3, col);
    }
  },
  'clutter.weeds'(p, k) {
    for (const [x, y, r] of scatter(p, 6, k.seed)) {
      // dandelion: rosette of toothed leaves and a yellow head or a seed clock
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ln(p.c, x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 2.4, R.apple[3]);
      }
      curve(p.c, x, y, x + 1, y - 6, x + 2, y - 11, R.apple[2]);
      if (r > 0.5) {
        px(p.c, x + 1, y - 13, '#f2c43a', 3, 2);
        px(p.c, x + 2, y - 14, '#f8dc60');
      } else {
        ell(p.c, x + 2, y - 13, 2.5, 2.5, '#efeae0');
        px(p.c, x + 1, y - 14, '#ffffff');
      }
    }
  },
  steps(p, k) {
    // stepping stones across grass
    const Rn = rng(k.seed);
    for (let i = 0; i < 3; i++) {
      const [x, y] = p.P(0.2 + i * 0.3 * p.pw, 0.5 * p.pd + (Rn() - 0.5) * 0.2, 0);
      const rx = 11 + Rn() * 4;
      ell(p.c, x + 1, y + 1, rx + 1, rx * 0.45 + 1, R.stone[1]);
      ell(p.c, x, y, rx, rx * 0.45, R.stone[3]);
      ell(p.c, x - rx * 0.25, y - 1, rx * 0.6, rx * 0.22, R.stone[4]);
      px(p.c, x - rx * 0.4, y - rx * 0.25, R.stone[5], 4, 1);
      tuftAt(p.c, x + rx * 0.8, y + 1, 3, 4, i * 13 + k.seed);
    }
  },
};

/** Lily pads with the odd flower — flat on the water. */
function lilies(p: PropPainter, k: PropCtx) {
  const Rn = rng(k.seed + 7);
  for (let i = 0; i < 4; i++) {
    const [x, y] = p.P(0.15 + Rn() * 0.7, 0.15 + Rn() * 0.7, 0);
    const r = 7 + Rn() * 5;
    ell(p.c, x + 1, y + 1, r + 1, r * 0.5 + 1, R.water[0]);
    ell(p.c, x, y, r, r * 0.5, R.apple[3]);
    ell(p.c, x - r * 0.2, y - 1, r * 0.6, r * 0.28, R.apple[4]);
    // the notch
    px(p.c, x, y - r * 0.5, R.water[2], Math.max(1, Math.round(r * 0.3)), Math.ceil(r * 0.5));
    if (Rn() > 0.55) {
      px(p.c, x - 3, y - 4, '#f2b6c8', 6, 2);
      px(p.c, x - 2, y - 6, '#fbdbe4', 4, 2);
      px(p.c, x - 1, y - 7, '#ffffff', 2, 1);
      px(p.c, x, y - 5, '#f2c43a');
    }
  }
}

function decal(p: PropPainter, k: PropCtx) {
  const v = k.variant && D[k.variant] ? k.variant : 'clutter.pebbles';
  D[v](p, k);
}

export const DECAL_VARIANTS = Object.keys(D);

export const DECALS: Record<string, PropArt> = {
  decal: { draw: decal },
  lilies: { draw: lilies },
  pebbles: { draw: (p, k) => D['clutter.pebbles'](p, k) },
};

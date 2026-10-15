// 128×64 trees — seven species with their own silhouettes, trunks and
// leaf language (not recolours): oak, apple (pear / plum), birch, pine,
// willow, cherry, poplar, plus a staked sapling. Crowns are leaf volumes
// shaded per pixel (see foliage() in kit4); each instance varies size,
// lean, masses and details by seed.
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { bayer, branch, type C, contactShadow, curve, dotFruit, foliage, hash, layer, type Mass, px, R, type Ramp, rng, trunk } from './kit4';

function anchor(p: PropPainter) {
  const [x, y] = p.P(0.5, 0.5, 0);
  return [Math.round(x), Math.round(y)] as const;
}

/** Masses spread around a crown centre: a core, a ring of lobes, a lower front lobe. */
function crown(x: number, cy: number, rx: number, ry: number, n: number, Rn: () => number, spread = 0.46): Mass[] {
  const out: Mass[] = [{ x, y: cy - ry * 0.08, rx: rx * 0.62, ry: ry * 0.6 }];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 1.02 + (i / (n - 1)) * Math.PI * 1.04 + (Rn() - 0.5) * 0.35;
    const d = spread + Rn() * 0.12;
    out.push({ x: x + Math.cos(a) * rx * d * 1.05, y: cy + Math.sin(a) * ry * d * 0.95 + ry * 0.1, rx: rx * (0.4 + Rn() * 0.14), ry: ry * (0.38 + Rn() * 0.12) });
  }
  out.push({ x: x - rx * 0.28 + Rn() * rx * 0.2, y: cy + ry * 0.36, rx: rx * 0.46, ry: ry * 0.34 });
  out.push({ x: x + rx * 0.3 + Rn() * rx * 0.1, y: cy + ry * 0.32, rx: rx * 0.42, ry: ry * 0.32 });
  // lower masses are nearer the camera
  for (const m of out) m.z = m.y + m.ry * 0.3;
  return out;
}

/** Leaves, twigs or acorns under a tree. */
function litter(c: C, x: number, y: number, seed: number, cols: string[]) {
  const lr = rng(seed + 77);
  for (let i = 0; i < 9; i++) {
    const fx = x + (lr() - 0.3) * 70;
    const fy = y + (lr() - 0.4) * 18;
    px(c, fx, fy, cols[Math.floor(lr() * cols.length)], 3, 1);
    px(c, fx + 1, fy - 1, cols[Math.floor(lr() * cols.length)]);
  }
}

// ── oak ─────────────────────────────────────────────────────
function oak(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 101 + 1);
  const s = 0.88 + Rn() * 0.26;
  const rx = 112 * s;
  const ry = 88 * s;
  const cz = 132 * s;
  const cy = y - cz;
  const lean = (Rn() - 0.5) * 0.6;
  contactShadow(c, x + 36 * s, y + 10, rx * 1.08, ry * 0.42, 0.36);
  const masses = crown(x, cy, rx, ry, 6 + Math.floor(Rn() * 2), Rn);
  trunk(c, x, y, cz - ry * 0.3, 34 * s, R.bark, k.seed, { lean, moss: true });
  layer(c, (l) => {
    for (const [dx, dy, w] of [[-0.6, -0.3, 8], [0.55, -0.35, 7], [-0.15, -0.72, 6], [0.28, -0.6, 5]] as const) branch(l, x + lean * 8, cy + ry * 0.5, x + dx * rx, cy + dy * ry, w * s, R.bark[1], R.bark[3]);
    foliage(l, masses, R.oak, k.seed, { cell: 7.5, holes: 0.06, tilt: 0.16 });
  });
  litter(c, x, y, k.seed, ['#9a6a3a', '#c4904a', '#7a4a2a']);
}

// ── fruit trees: apple / pear / plum / orange ───────────────
const FRUIT: Record<string, string[]> = {
  apple: ['#d4392b', '#e5543a', '#b52a24'],
  pear: ['#d9c84a', '#c7b23a', '#e6d86a'],
  plum: ['#6a3a8a', '#7e4aa0', '#5a2e78'],
  orange: ['#ee8a2e', '#f4a03e', '#d8741e'],
};

function fruitTree(p: PropPainter, k: PropCtx, fruitKey = 'apple') {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 113 + 2);
  const s = 0.86 + Rn() * 0.24;
  const rx = 88 * s;
  const ry = 64 * s;
  const cz = 100 * s;
  const cy = y - cz;
  const fruit = FRUIT[fruitKey] ?? FRUIT.apple;
  contactShadow(c, x + 28 * s, y + 8, rx * 1.05, ry * 0.44, 0.34);
  const masses: Mass[] = [
    { x, y: cy - ry * 0.05, rx: rx * 0.74, ry: ry * 0.72 },
    { x: x - rx * 0.46, y: cy + ry * 0.12, rx: rx * 0.5, ry: ry * 0.48 },
    { x: x + rx * 0.47, y: cy + ry * 0.16, rx: rx * 0.52, ry: ry * 0.46 },
    { x: x + (Rn() - 0.5) * rx * 0.3, y: cy - ry * 0.44, rx: rx * 0.5, ry: ry * 0.42 },
    { x: x + (Rn() - 0.5) * rx * 0.2, y: cy + ry * 0.4, rx: rx * 0.5, ry: ry * 0.3 },
  ];
  for (const m of masses) m.z = m.y + m.ry * 0.3;
  // gnarled fruit-tree trunk that forks low
  trunk(c, x, y, cz - ry * 0.55, 21 * s, R.bark, k.seed + 5, { lean: (Rn() - 0.5) * 0.8 });
  layer(c, (l) => {
    for (const [dx, dy] of [[-0.5, -0.1], [0.45, -0.15], [0.05, -0.55]] as const) branch(l, x, cy + ry * 0.55, x + dx * rx, cy + dy * ry, 6 * s, R.bark[1], R.bark[3]);
    foliage(l, masses, R.apple, k.seed, { cell: 6.5, holes: 0.05, bias: 0.04, dots: fruit, dotChance: 0.13, dotSize: 5 });
  });
  // windfall fruit in the grass
  const fr = rng(k.seed + 9);
  for (let i = 0; i < 4 + Math.floor(fr() * 4); i++) dotFruit(c, x + (fr() - 0.25) * rx * 1.1, y + (fr() - 0.35) * 18, fruit[0], 4.5);
}

// ── birch ───────────────────────────────────────────────────
function birch(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 127 + 3);
  const s = 0.9 + Rn() * 0.25;
  const rx = 62 * s;
  const ry = 90 * s;
  const cz = 170 * s;
  const cy = y - cz;
  contactShadow(c, x + 24 * s, y + 8, rx * 1.15, ry * 0.26, 0.28);
  // two or three slender white stems leaning apart
  const stems = 2 + (Rn() > 0.5 ? 1 : 0);
  const tops: [number, number][] = [];
  for (let i = 0; i < stems; i++) {
    const off = (i - (stems - 1) / 2) * 8;
    const lean = (i - (stems - 1) / 2) * 0.8 + (Rn() - 0.5) * 0.3;
    const h = cz - ry * (0.15 + Rn() * 0.2);
    trunk(c, x + off, y - i, h, (11 - i * 2) * s, R.barkPale, k.seed + i * 13, { lean, roots: i === 0, birch: true });
    tops.push([x + off + lean * h * 0.2, y - h]);
  }
  const masses: Mass[] = [{ x, y: cy, rx: rx * 0.55, ry: ry * 0.5 }];
  for (let i = 0; i < 22; i++) {
    const a = Rn() * Math.PI * 2;
    const d = Math.sqrt(Rn()) * 0.74;
    masses.push({ x: x + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d * 0.92 + ry * 0.06, rx: rx * (0.27 + Rn() * 0.12), ry: ry * (0.16 + Rn() * 0.08) });
  }
  for (const m of masses) m.z = m.y;
  layer(c, (l) => {
    // fine twigs from the stem tops into the leaf masses
    for (const [tx, ty] of tops)
      for (const m of masses.slice(0, 7)) curve(l, tx, ty + 18, (tx + m.x) / 2 + (Rn() - 0.5) * 10, (ty + m.y) / 2, m.x, m.y + m.ry * 0.4, R.barkPale[1]);
    foliage(l, masses, R.birch, k.seed, { cell: 4, holes: 0.12, bias: 0.08, tilt: 0.26 });
  });
}

// ── pine (conifer with tiered, drooping skirts) ─────────────
function pine(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 131 + 4);
  const s = 0.85 + Rn() * 0.3;
  const H = 252 * s;
  const W = 92 * s;
  contactShadow(c, x + 30 * s, y + 8, W * 0.95, 22 * s, 0.34);
  trunk(c, x, y, 64 * s, 15 * s, R.bark, k.seed + 3, { roots: true });
  const tiers = 7;
  layer(c, (l) => conifer(l, x, y - 34 * s, H - 40 * s, W, tiers, R.pine, k.seed));
}

/**
 * Conifer: stacked conical skirts, bottom first. Each skirt has a cone
 * normal (lit on the upper left), needle streaks running down and out,
 * a jagged drooping hem, and sits in the shadow of the skirt above.
 */
function conifer(c: C, x: number, base: number, H: number, W: number, tiers: number, ramp: Ramp, seed: number) {
  const N = ramp.length;
  const spacing = (H * 0.84) / (tiers - 1);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1);
    const hemY = base - f * H * 0.84;
    const skirt = spacing * (1.5 - f * 0.25);
    const topY = hemY - skirt;
    const half = W * (1 - f * 0.82) * (0.9 + hash(t, 1, seed) * 0.18);
    const shift = (hash(t, 2, seed) - 0.5) * 6;
    const lobeW = 13 + hash(t, 3, seed) * 6;
    for (let yy = Math.floor(topY - (t === tiers - 1 ? spacing : 0)); yy < hemY + 12; yy++) {
      const u = Math.max(0, (yy - topY) / skirt);
      // skirt widens downward like a cone; the top tier comes to a point
      const hw = t === tiers - 1 ? half * Math.max(0, (yy - (topY - spacing)) / (skirt + spacing)) : half * (0.3 + 0.7 * Math.min(1, u));
      for (let xx = Math.floor(x + shift - hw - 6); xx <= x + shift + hw + 6; xx++) {
        const dxs = xx + 0.5 - (x + shift);
        if (Math.abs(dxs) > hw) continue;
        // scalloped, drooping hem: lobes hang lower toward the tips
        const ph = (((dxs + 1000) % lobeW) / lobeW) * Math.PI * 2;
        const hem = hemY + (Math.abs(dxs) / Math.max(1, half)) * 8 + (1 - Math.cos(ph)) * 3.5 + hash(Math.floor(xx / 2), t, seed) * 2;
        if (yy > hem) continue;
        const nx = dxs / Math.max(1, half);
        let v = 0.58 - nx * 0.46 - u * 0.12;
        // needle hatching running down and outward on each side
        const side = dxs < 0 ? -1 : 1;
        const perp = (xx * 1.0 - yy * 0.8 * side) / 2.2;
        v += (hash(Math.floor(perp), Math.floor((yy + xx * 0.3 * side) / 7), seed + t) - 0.5) * 0.36;
        // lobe shading: each hanging lobe lit on its left
        v += Math.sin(ph) * -0.08;
        if (yy > hem - 2.5) v -= 0.22;
        // in the shadow of the skirt above
        if (t < tiers - 1) {
          const aboveHem = hemY - spacing;
          if (yy < aboveHem + 10) v -= 0.3 * (1 - Math.max(0, yy - aboveHem) / 10);
        }
        const tone = Math.max(0, Math.min(N - 1, Math.round(v * (N - 1) + (bayer(xx, yy) - 0.5) * 0.7)));
        px(c, xx, yy, ramp[tone]);
      }
    }
    // a few cones hanging under the skirt
    if (t < tiers - 2 && hash(t, 5, seed) > 0.4) {
      const cx = x + shift + (hash(t, 6, seed) - 0.5) * half * 1.2;
      px(c, cx, hemY - 2, '#4a2e1a', 4, 8);
      px(c, cx, hemY - 2, '#7a5232', 2, 7);
      px(c, cx, hemY + 1, '#4a2e1a', 4, 1);
    }
  }
}

// ── willow ──────────────────────────────────────────────────
function willow(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 137 + 5);
  const s = 0.9 + Rn() * 0.22;
  const rx = 106 * s;
  const ry = 58 * s;
  const cz = 152 * s;
  const cy = y - cz;
  contactShadow(c, x + 32 * s, y + 10, rx * 1.08, ry * 0.52, 0.32);
  trunk(c, x, y, cz - ry * 0.2, 26 * s, R.bark, k.seed + 7, { lean: 0.6, moss: true });
  const masses: Mass[] = [
    { x, y: cy, rx: rx * 0.74, ry: ry * 0.8 },
    { x: x - rx * 0.52, y: cy + ry * 0.24, rx: rx * 0.46, ry: ry * 0.5 },
    { x: x + rx * 0.52, y: cy + ry * 0.24, rx: rx * 0.48, ry: ry * 0.5 },
  ];
  for (const m of masses) m.z = m.y;
  curtain(c, x, cy, rx, ry, s, k.seed, false);
  layer(c, (l) => foliage(l, masses, R.willow, k.seed, { cell: 5.5, tilt: 0.14, stretch: 1.3 }));
  curtain(c, x, cy, rx, ry, s, k.seed + 1, true);
}

/**
 * Hanging willow fronds: a curtain of 2-px leafy ribbons continuing the dome
 * down toward the ground, lit on the left, denser at the sides so the trunk
 * shows through the middle; ragged, tapering tips.
 */
function curtain(c: C, x: number, cy: number, rx: number, ry: number, s: number, seed: number, front: boolean) {
  layer(
    c,
    (l) => {
      const span = rx * 0.98;
      for (let sx = -span; sx <= span; sx += front ? 3 : 2) {
        const col = Math.round(sx);
        const h1 = hash(col, 1, seed);
        const u = sx / span;
        // the middle front is thinner so the trunk reads through
        if (front && Math.abs(u) < 0.35 && h1 < 0.55) continue;
        if (!front && h1 < 0.15) continue;
        // start on the crown surface: high in the middle, lower toward the sides
        const top = cy - ry * 0.72 * Math.sqrt(Math.max(0, 1 - u * u));
        const y0 = front ? cy + ry * (0.05 + h1 * 0.3) - ry * 0.25 * Math.sqrt(Math.max(0, 1 - u * u)) : top + ry * 0.35;
        const len = (82 + hash(col, 2, seed) * 60) * s * (1 - Math.abs(u) * 0.15);
        const sway = u * 16 * s;
        const lit = 0.56 - u * 0.42 + (front ? 0.08 : -0.3);
        for (let j = 0; j < len; j++) {
          const t = j / len;
          const xx = x + sx + sway * t * t + Math.sin(j * 0.09 + col) * 1.2;
          let tone = 1 + lit * 5 + (hash(col, Math.floor(j / 3), seed) - 0.5) * 1.6;
          if (t > 0.82) tone -= 1.2;
          const ti = Math.max(0, Math.min(6, Math.round(tone + (bayer(Math.round(xx), j) - 0.5) * 0.6)));
          const w = t > 0.9 ? 1 : 2;
          px(l, xx, y0 + j, R.willow[ti], w, 1);
          // little leaves stepping off the ribbon
          if (j % 5 === 2 && t < 0.9) px(l, xx + (j % 10 === 2 ? -1 : 2), y0 + j, R.willow[Math.min(6, ti + 1)]);
        }
      }
    },
    { outline: front ? 0.6 : false },
  );
}

// ── cherry in blossom ───────────────────────────────────────
function cherry(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 139 + 6);
  const s = 0.88 + Rn() * 0.22;
  const rx = 92 * s;
  const ry = 64 * s;
  const cz = 104 * s;
  const cy = y - cz;
  contactShadow(c, x + 28 * s, y + 8, rx, ry * 0.44, 0.32);
  trunk(c, x, y, cz - ry * 0.5, 19 * s, ['#2a1a1c', '#3d2427', '#54322f', '#6b4138', '#82513f', '#9a6550'], k.seed + 2, { lean: (Rn() - 0.5) * 0.6 });
  const masses: Mass[] = [
    { x, y: cy, rx: rx * 0.7, ry: ry * 0.64 },
    { x: x - rx * 0.54, y: cy + ry * 0.2, rx: rx * 0.46, ry: ry * 0.44 },
    { x: x + rx * 0.54, y: cy + ry * 0.12, rx: rx * 0.48, ry: ry * 0.44 },
    { x: x - rx * 0.12, y: cy - ry * 0.46, rx: rx * 0.44, ry: ry * 0.38 },
    { x: x + rx * 0.1, y: cy + ry * 0.4, rx: rx * 0.42, ry: ry * 0.28 },
  ];
  for (const m of masses) m.z = m.y + m.ry * 0.3;
  layer(c, (l) => {
    for (const [dx, dy] of [[-0.62, 0], [0.56, -0.1], [0, -0.62]]) branch(l, x, cy + ry * 0.5, x + dx * rx, cy + dy * ry, 6 * s, '#3d2427', '#6b4138');
    foliage(l, masses, R.cherry, k.seed, { cell: 5, holes: 0.08, tilt: 0.2, sparkle: '#ffffff', dots: ['#5a953f', '#457d38'], dotChance: 0.08, dotSize: 3 });
  });
  // fallen petals
  const fp = rng(k.seed + 8);
  for (let i = 0; i < 34; i++) px(c, x + (fp() - 0.35) * rx * 1.6, y + (fp() - 0.4) * 28, fp() > 0.5 ? '#f2b6c8' : '#fbdbe4', fp() > 0.7 ? 2 : 1, 1);
}

// ── poplar ──────────────────────────────────────────────────
function poplar(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 149 + 7);
  const s = 0.88 + Rn() * 0.24;
  const rx = 36 * s;
  const ry = 108 * s;
  const cz = 150 * s;
  const cy = y - cz;
  contactShadow(c, x + 30 * s, y + 8, rx * 1.7, 15 * s, 0.3);
  trunk(c, x, y, 52 * s, 13 * s, R.bark, k.seed + 1, {});
  const masses: Mass[] = [
    { x, y: cy, rx, ry, z: 1 },
    { x: x - rx * 0.32, y: cy + ry * 0.38, rx: rx * 0.82, ry: ry * 0.5, z: 2 },
    { x: x + rx * 0.26, y: cy - ry * 0.32, rx: rx * 0.8, ry: ry * 0.56, z: 0 },
  ];
  layer(c, (l) => foliage(l, masses, R.poplar, k.seed, { cell: 5.5, stretch: 1.7, tilt: 0.16 }));
}

// ── sapling (young tree tied to a stake) ────────────────────
function sapling(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = anchor(p);
  const Rn = rng(k.seed * 151 + 8);
  contactShadow(c, x + 12, y + 4, 28, 9, 0.28);
  layer(c, (l) => {
    px(l, x + 6, y - 54, '#5a3a22', 3, 54);
    px(l, x + 6, y - 54, '#8a6038', 1, 54);
  });
  trunk(c, x, y, 56, 6, R.bark, k.seed, { roots: false });
  px(c, x - 1, y - 32, '#c8b088', 10, 2);
  layer(c, (l) => {
    const masses: Mass[] = [
      { x, y: y - 74, rx: 26, ry: 24, z: 1 },
      { x: x - 12, y: y - 62, rx: 15, ry: 13, z: 2 },
      { x: x + 13, y: y - 64, rx: 15, ry: 13, z: 2 },
    ];
    foliage(l, masses, Rn() > 0.5 ? R.apple : R.birch, k.seed, { cell: 5, bias: 0.06 });
  });
}

const SPECIES: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  oak,
  apple: (p, k) => fruitTree(p, k, 'apple'),
  pear: (p, k) => fruitTree(p, k, 'pear'),
  plum: (p, k) => fruitTree(p, k, 'plum'),
  orange: (p, k) => fruitTree(p, k, 'orange'),
  birch,
  pine,
  willow,
  cherry,
  poplar,
  sapling,
};

/** Variant names of 'tree' / 'fruitTree' this set understands. */
export const TREE_SPECIES = Object.keys(SPECIES);

// legacy variants from the 64×32 layout map onto species
const LEGACY: Record<string, string> = { dark: 'oak', deep: 'oak', warm: 'birch', big: 'oak' };

export const TREES: Record<string, PropArt> = {
  tree: {
    draw(p, k) {
      const v = k.variant && SPECIES[k.variant] ? k.variant : LEGACY[k.variant ?? ''] ?? (['oak', 'oak', 'birch', 'pine', 'poplar'] as const)[k.seed % 5];
      SPECIES[v](p, k);
    },
  },
  fruitTree: {
    draw(p, k) {
      const v = k.variant && SPECIES[k.variant] ? k.variant : LEGACY[k.variant ?? ''] ?? 'apple';
      SPECIES[v](p, k);
    },
  },
};

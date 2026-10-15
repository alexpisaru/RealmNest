// 128×64 crops — nine families, each plant at its own growth stage
// (sprout → young → mature → ripe), irregular spacing, gaps and weeds,
// soil mounded at the base: carrot · cabbage · tomato · pumpkin · wheat ·
// lettuce · corn · beans · herbs.
import { darken, lighten } from '../color';
import type { PropPainter } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { contactShadow, curve, dotFruit, ell, foliage, hash, layer, ln, type Mass, px, R, rng } from './kit4';

type C = CanvasRenderingContext2D;
type Plant = (c: C, x: number, y: number, stage: number, seed: number) => void;

/** a feathery frond: curved stem with alternating leaflets */
function frond(c: C, x: number, y: number, len: number, lean: number, col: string, hi: string) {
  const ex = x + lean;
  const ey = y - len;
  curve(c, x, y, x + lean * 0.2, y - len * 0.6, ex, ey, col);
  for (let i = 2; i < len; i += 2) {
    const t = i / len;
    const fx = x + lean * t * t;
    const fy = y - i;
    px(c, fx - 2, fy, col, 2, 1);
    px(c, fx + 1, fy - 1, t > 0.6 ? hi : col, 2, 1);
  }
}

/** broad leaf with a midrib (pumpkin, beans) */
function broadLeaf(c: C, x: number, y: number, r: number, base: readonly string[], seed: number) {
  ell(c, x + 0.5, y + 1, r + 0.5, r * 0.7 + 0.5, base[1]);
  ell(c, x, y, r, r * 0.68, base[3]);
  ell(c, x - r * 0.25, y - r * 0.2, r * 0.55, r * 0.35, base[4]);
  ln(c, x - r * 0.6, y + r * 0.2, x + r * 0.5, y - r * 0.2, base[2]);
  if (hash(seed, 1) > 0.5) px(c, x + r * 0.3, y + r * 0.35, base[1], 2, 1);
}

const P: Record<string, Plant> = {
  carrot(c, x, y, st, seed) {
    const n = 3 + st * 2;
    const len = 5 + st * 4;
    for (let i = 0; i < n; i++) frond(c, x + (i - n / 2) * 1.4, y - 1, len * (0.7 + hash(seed, i) * 0.5), (i - n / 2) * 2.4, R.birch[3], R.birch[5]);
    if (st >= 2) {
      px(c, x - 3, y - 2, '#a85420', 6, 2);
      px(c, x - 2, y - 3, '#f08a3a', 4, 2);
      px(c, x - 2, y - 3, '#f8b060', 2, 1);
    }
    if (st === 3 && hash(seed, 9) > 0.6) px(c, x + 2, y - len, '#d8c050', 2, 2); // a yellowing frond
  },
  cabbage(c, x, y, st, seed) {
    const red = hash(seed, 3) < 0.18;
    const g = red ? ['#3a2040', '#563058', '#744270', '#94588a', '#b47aa8', '#d4a2c8'] : ['#2c4a3a', '#3e6650', '#548466', '#6ea47e', '#90c49a', '#bce2c0'];
    const r = [5, 9, 12, 15][st];
    // outer leaves spreading on the soil, then the folded head
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      ell(c, x + Math.cos(a) * r * 0.7, y - 2 + Math.sin(a) * r * 0.28, r * 0.48, r * 0.26, g[2 + (i & 1)]);
    }
    if (st >= 1) {
      ell(c, x, y - r * 0.35, r * 0.62, r * 0.48, g[1]);
      ell(c, x - 0.5, y - r * 0.42, r * 0.54, r * 0.4, g[3]);
      ell(c, x - r * 0.15, y - r * 0.52, r * 0.32, r * 0.22, g[4]);
      px(c, x - r * 0.25, y - r * 0.6, g[5], 2, 1);
      ln(c, x - r * 0.4, y - r * 0.3, x, y - r * 0.55, g[2]);
      ln(c, x + r * 0.35, y - r * 0.28, x + 1, y - r * 0.5, g[2]);
    }
  },
  tomato(c, x, y, st, seed) {
    // cane with string ties, bushy plant, trusses of green / ripening / red fruit
    const h = 16 + st * 9;
    px(c, x + 5, y - h - 8, '#8a6a3a', 2, h + 8);
    px(c, x + 5, y - h - 8, '#b8925a', 1, h + 8);
    const masses: Mass[] = [];
    for (let i = 0; i < 2 + st; i++) masses.push({ x: x + (hash(seed, i) - 0.5) * 8, y: y - 6 - (i / (2 + st)) * h, rx: 6 + st, ry: 6 + st * 0.6, z: i });
    foliage(c, masses, R.apple, seed, { cell: 3, tilt: 0.2 });
    if (st >= 2) {
      const cols = st === 3 ? ['#d8302a', '#e84a30', '#c8282a', '#f08a3a'] : ['#8ab84a', '#a8c85a', '#c8b84a'];
      for (let i = 0; i < 3 + st * 2; i++) dotFruit(c, x + (hash(seed, i + 20) - 0.5) * 12, y - 8 - hash(seed, i + 30) * h * 0.8, cols[i % cols.length], 4);
    }
    for (let i = 1; i <= 2; i++) px(c, x + 3, y - h * (i / 2.5), '#e8dcc0', 4, 1);
  },
  pumpkin(c, x, y, st, seed) {
    const Rn = rng(seed);
    for (let i = 0; i < 3 + st; i++) broadLeaf(c, x + (Rn() - 0.5) * 22, y - 3 - Rn() * 6, 4 + Rn() * 2 + st, R.apple, seed + i);
    // curling tendril
    curve(c, x - 8, y - 2, x - 12, y - 8, x - 6, y - 9, R.apple[2]);
    if (st >= 2) {
      const big = st === 3;
      const col = big ? (hash(seed, 7) < 0.2 ? '#e8d8b0' : '#e07a28') : '#b8b040';
      const rx = big ? 10 + Rn() * 3 : 5;
      const ry = rx * 0.72;
      const px0 = x + 6;
      const py0 = y - ry + 1;
      ell(c, px0 + 1, py0 + 1, rx, ry, darken(col, 0.4));
      ell(c, px0, py0, rx, ry, col);
      for (const dx of [-rx * 0.5, 0, rx * 0.5]) ln(c, px0 + dx, py0 - ry * 0.8, px0 + dx * 0.8, py0 + ry * 0.8, darken(col, 0.2));
      ell(c, px0 - rx * 0.35, py0 - ry * 0.4, rx * 0.3, ry * 0.25, lighten(col, 0.3));
      px(c, px0 - 1, py0 - ry - 2, R.bark[3], 3, 3);
    }
  },
  lettuce(c, x, y, st, seed) {
    const red = hash(seed, 4) < 0.25;
    const g = red ? ['#4a2420', '#6a3430', '#8a4a3a', '#a8664a', '#c08a5a', '#d8b070'] : ['#2e5a24', '#3e7a2e', '#58a03c', '#78c04c', '#a0dc68', '#c8f090'];
    const r = [4, 7, 10, 12][st];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed * 0.3;
      ell(c, x + Math.cos(a) * r * 0.55, y - r * 0.35 + Math.sin(a) * r * 0.25, r * 0.5, r * 0.36, g[2 + (i % 2)]);
      // frilly edge
      px(c, x + Math.cos(a) * r * 0.9, y - r * 0.35 + Math.sin(a) * r * 0.36, g[4]);
    }
    ell(c, x, y - r * 0.55, r * 0.46, r * 0.34, g[4]);
    px(c, x - 1, y - r * 0.7, g[5], 2, 1);
  },
  corn(c, x, y, st, seed) {
    const h = 20 + st * 18;
    const Rn = rng(seed);
    ln(c, x, y, x, y - h, R.birch[2], 2);
    px(c, x, y - h, R.birch[4], 1, h);
    for (let i = 0; i < 3 + st; i++) {
      const t = 0.25 + (i / (3 + st)) * 0.7;
      const side = i & 1 ? 1 : -1;
      const ly = y - h * t;
      curve(c, x, ly, x + side * 9, ly - 6, x + side * 16, ly + 2 + Rn() * 4, R.birch[3]);
      curve(c, x, ly + 1, x + side * 9, ly - 5, x + side * 15, ly + 3 + Rn() * 4, R.birch[2]);
    }
    if (st >= 2) {
      // cob in its husk with silk
      px(c, x + 2, y - h * 0.55, '#8ab04a', 4, 9);
      px(c, x + 3, y - h * 0.55 + 1, st === 3 ? '#f2d060' : '#c8d070', 2, 6);
      px(c, x + 3, y - h * 0.55 - 2, '#c8905a', 2, 2);
    }
    if (st >= 1) for (let i = 0; i < 4; i++) ln(c, x, y - h, x + (i - 1.5) * 3, y - h - 6, st === 3 ? '#d8b860' : '#b8c870');
  },
  beans(c, x, y, st, seed) {
    const h = 30 + st * 10;
    // bean pole with a climbing vine, leaves, white flowers and hanging pods
    ln(c, x, y, x + 2, y - h - 6, '#a07a4a', 2);
    const Rn = rng(seed);
    for (let i = 0; i < 4 + st * 2; i++) {
      const t = i / (4 + st * 2);
      broadLeaf(c, x + 1 + Math.sin(t * 9) * 5, y - t * h - 4, 3 + st * 0.5, R.apple, seed + i);
    }
    if (st >= 1) for (let i = 0; i < 3; i++) px(c, x + (Rn() - 0.5) * 10, y - Rn() * h, '#fbf7ee', 2, 2);
    if (st >= 2) for (let i = 0; i < st * 2; i++) px(c, x + (Rn() - 0.5) * 9, y - 8 - Rn() * h * 0.8, '#6aa040', 2, 6);
  },
  herbs(c, x, y, st, seed) {
    const r = 4 + st * 3;
    const masses: Mass[] = [{ x, y: y - r * 0.6, rx: r, ry: r * 0.75, z: 1 }];
    foliage(c, masses, R.oak, seed, { cell: 2.6, tilt: 0.25 });
    if (st >= 2) for (let i = 0; i < 4 + st; i++) px(c, x + (hash(seed, i) - 0.5) * r * 1.6, y - r * 1.2 - hash(seed, i + 9) * 3, i & 1 ? '#c49cf2' : '#fbf7ee');
  },
};

/** small weeds between the crops */
function weed(c: C, x: number, y: number, seed: number) {
  for (let i = 0; i < 4; i++) ln(c, x, y, x + (hash(seed, i) - 0.5) * 8, y - 3 - hash(seed, i + 5) * 5, R.birch[3 + (i & 1)]);
}

function wheatField(p: PropPainter, k: PropCtx) {
  const Rn = rng(k.seed + 9);
  const stalks: [number, number, number][] = [];
  const n = Math.round(k.w * k.d * 260);
  const ripe = k.variant === 'wheatGreen' ? 0.15 : 0.85;
  for (let i = 0; i < n; i++) stalks.push([Rn() * k.w, Rn() * k.d, Rn()]);
  stalks.sort((m, q) => m[0] + m[1] - (q[0] + q[1]));
  for (const [a, b, r] of stalks) {
    const [x, y] = p.P(a, b, 0);
    const h = 28 + Math.floor(r * 16);
    const lean = r > 0.6 ? 2 : r < 0.2 ? -1 : 0;
    const gold = noise(a, b) * 0.5 + ripe * 0.5 > 0.5;
    const ramp = gold ? R.hay : R.birch;
    // the stalk in four runs: shaded foot, straight stem, the bend, the lit top under the ear
    const j1 = Math.floor(h * 0.65);
    px(p.c, x, y - 3, ramp[1], 1, 4);
    px(p.c, x, y - j1, ramp[2], 1, j1 - 3);
    px(p.c, x + lean, y - (h - 9), ramp[2], 1, h - 9 - j1);
    px(p.c, x + lean, y - (h - 1), ramp[3], 1, 8);
    // ear with awns
    for (let q = 0; q < 6; q++) px(p.c, x - 1 + lean + (q & 1), y - h - 1 - q * 1.2, ramp[q < 2 ? 5 : 4], 2, 1);
    px(p.c, x + lean, y - h - 9, ramp[6] ?? ramp[5]);
    px(p.c, x + lean + 2, y - h - 7, ramp[5]);
  }
}
const noise = (a: number, b: number) => (Math.sin(a * 3.1 + b * 1.7) + Math.sin(a * 1.3 - b * 2.9)) * 0.25 + 0.5;

/** A crop bed: rows along the prop width, each plant at its own stage, gaps and weeds. */
function crops(p: PropPainter, k: PropCtx) {
  const kind = k.variant ?? 'carrot';
  if (kind === 'wheat' || kind === 'wheatGreen') return wheatField(p, k);
  const plant = P[kind] ?? P.carrot;
  const tall = kind === 'corn' || kind === 'beans' || kind === 'tomato';
  const rows = Math.max(1, Math.round(k.d * 2));
  const per = Math.max(2, Math.round(k.w * (kind === 'cabbage' || kind === 'pumpkin' ? 2.8 : kind === 'lettuce' ? 3.4 : tall ? 3 : 4)));
  const Rn = rng(k.seed * 17 + kind.length);
  const fieldStage = 1.6 + Rn() * 1.2;
  // each row is one layer (outlined as a row), rows painted back to front
  for (let r = 0; r < rows; r++) {
    const items: [number, number, number, number][] = [];
    for (let i = 0; i < per; i++) {
      if (Rn() < 0.07) continue; // a gap
      const a = ((i + 0.5) / per) * k.w + (Rn() - 0.5) * 0.06;
      const b = ((r + 0.5) / rows) * k.d + (Rn() - 0.5) * 0.05;
      const st = Math.max(0, Math.min(3, Math.round(fieldStage + (Rn() - 0.5) * 1.6 + (hash(i, r, k.seed) - 0.5) * 0.6)));
      items.push([a, b, st, Math.floor(Rn() * 1e6)]);
    }
    if (!items.length) continue;
    items.sort((m, q) => m[0] + m[1] - (q[0] + q[1]));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const pts = items.map(([a, b, st, seed]) => {
      const [x, y] = p.P(a, b, 0);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      // soil mound under each plant
      ell(p.c, x + 1, y + 1, 6, 2.5, R.soil[1]);
      ell(p.c, x, y, 5, 2, R.soil[3]);
      if (tall) contactShadow(p.c, x + 6, y + 2, 8, 3, 0.2);
      return [x, y, st, seed] as const;
    });
    layer(p.c, (l) => pts.forEach(([x, y, st, seed]) => plant(l, Math.round(x), Math.round(y), st, seed)), { outline: 0.55, rect: [x0 - 34, y0 - 96, x1 + 34, y1 + 8] });
  }
  // weeds between the rows
  for (let i = 0; i < k.w * k.d * 1.5; i++) {
    const [x, y] = p.P(Rn() * k.w, Math.floor(Rn() * rows) / rows * k.d + (0.5 / rows) * k.d * (Rn() > 0.5 ? 1.5 : 0.5), 0);
    if (Rn() < 0.5) weed(p.c, x, y, i + k.seed);
  }
}

export const CROP_FAMILIES = [...Object.keys(P), 'wheat', 'wheatGreen'];
export const CROPS: Record<string, PropArt> = {
  crops: { draw: crops },
  cropRow: { draw: crops },
};

// Chemical Lab — the campus landscape at 128×64 (1 z ≈ 10 cm).
//   lab_birch     multi-stem Himalayan birches: chalk-white stems with dark
//                 lenticels, a light, weeping crown of small leaves
//   lab_pine      Scots pines: a tall bare trunk, orange bark above, flat
//                 cloud-like needle clumps on crooked limbs
//   lab_shrub     'grass' (miscanthus with plumes), 'ball' (clipped yew),
//                 'cornus' (red-stemmed dogwood), 'sedge', 'fern'
//   lab_hedge     a clipped hornbeam hedge (long, sliced)
//   lab_reeds     'phrag' (common reed), 'typha' (bulrush), 'iris' (yellow flag), 'rush'
//   lab_lily      water-lily pads (flat)
//   lab_rock      granite boulders at the water's edge
//   lab_meadow    a wildflower clump (walk-through)
//   lab_boardwalk a silvered larch boardwalk on piles over the pond ('deck': a platform with a bench)
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { bayer, type C, contactShadow, curve, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { coat, LEAF, P, PINE, SILVER } from './lk';

// ── birch ───────────────────────────────────────────────────
const BIRCHBARK: Ramp = ['#2a2c24', '#424c31', '#959686', '#d7d2cf', '#f1ede6', '#fdfcf8'];
const BIRCHLEAF: Ramp = ['#244113', '#30521a', '#466f1b', '#557d24', '#68922c', '#7ea93a', '#a3ca5a', '#c6e07a'];

/** One white birch stem from (x, y) up h px, leaning; lenticels as dark dashes, dark at the foot. */
function birchStem(c: C, x: number, y: number, h: number, w0: number, dxTop: number, seed: number) {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const w = Math.max(2, Math.round(w0 * (1 - t * 0.55)));
    const cx = x + dxTop * (0.55 * t + 0.45 * t * t);
    const x0 = Math.round(cx - w / 2);
    for (let i = 0; i < w; i++) {
      const u = i / Math.max(1, w - 1);
      let tone = u < 0.3 ? 5 : u < 0.62 ? 4 : u < 0.86 ? 3 : 2;
      // horizontal lenticels and a few black scars, rough dark bark at the foot
      const yy = y - j;
      if (hash(Math.floor((x0 + i) / 3), Math.floor(yy / 2), seed) < 0.1 && (yy & 1) === 0) tone = 1;
      if (t < 0.12 && hash(x0 + i, Math.floor(yy / 2), seed + 1) < 0.5 - t * 4) tone = Math.min(tone, 1 + (hash(x0 + i, yy, seed) < 0.5 ? 0 : 1));
      if (hash(Math.floor(yy / 9), 1, seed + Math.floor((x0 + i) / 4)) < 0.05) tone = 0;
      c.fillStyle = BIRCHBARK[tone];
      c.fillRect(x0 + i, yy - 1, 1, 1);
    }
  }
}

function birch(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = P(p, 0.5, 0.5, 0);
  const Rn = rng(k.seed * 131 + 7);
  const s = 0.85 + Rn() * 0.3;
  const H = Math.round(470 * s);
  const rx = 88 * s;
  const ry = 150 * s;
  const cy = y - H + ry * 0.95;
  contactShadow(c, x + 30 * s, y + 8, rx * 1.05, 26 * s, 0.3);
  // three to five stems from one base, leaning apart
  const stems = 3 + Math.floor(Rn() * 3);
  const tops: [number, number][] = [];
  layer(c, (l) => {
    const mid = (stems - 1) / 2;
    for (let i = 0; i < stems; i++) {
      const off = (i - mid) * 5;
      const ln0 = mid > 0 ? (i - mid) / mid : 0;
      const dxTop = ln0 * rx * 0.42 + (Rn() - 0.5) * 10;
      const h = Math.round(H * (0.56 + Rn() * 0.14));
      birchStem(l, x + off, y - (i % 2), h, (14 - Math.abs(i - mid) * 2) * s, dxTop, k.seed * 7 + i);
      tops.push([x + off + dxTop, y - h]);
    }
    // short dark twigs at the stem tops (the crown hides most of them)
    for (const [tx, ty] of tops)
      for (let j = 0; j < 2; j++) {
        const ex = tx + (Rn() - 0.5) * rx * 0.5;
        const ey = ty - 10 - Rn() * 18 * s;
        curve(l, tx, ty + 10, (tx + ex) / 2 + (Rn() - 0.5) * 6, (ty + ey) / 2 + 3, ex, ey, BIRCHBARK[1]);
      }
  });
  // the crown: a tall, loose oval of bright leaf clumps (the picture's lime birches), lit from
  // the upper left, with gaps where the white stems show through
  const masses: Mass[] = [];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const my = cy - ry * 0.9 + t * ry * 1.45;
    const wdt = rx * (0.35 + Math.sin(t * Math.PI * 0.92) * 0.6);
    masses.push({ x: x + (Rn() - 0.5) * wdt * 1.1, y: my, rx: wdt * (0.45 + Rn() * 0.25), ry: ry * (0.17 + Rn() * 0.07), z: i + Rn() });
  }
  for (let i = 0; i < 6; i++) masses.push({ x: x + (Rn() - 0.5) * rx * 1.4, y: cy + (Rn() - 0.5) * ry, rx: rx * 0.28, ry: ry * 0.13, z: 14 + i });
  layer(c, (l) => foliage(l, masses, BIRCHLEAF, k.seed, { cell: 4.2, holes: 0.12, tilt: 0.3, bias: 0.12, sparkle: '#d8ec98' }), { outline: 0.5 });
  // a few yellow leaves fallen in the grass
  const fr = rng(k.seed + 3);
  for (let i = 0; i < 6; i++) px(c, x + (fr() - 0.3) * 70, y + (fr() - 0.4) * 16, ['#d8c050', '#b8a040', '#e8d070'][i % 3], 2, 1);
}

// ── Scots pine ──────────────────────────────────────────────
const PINEBARK_LO: Ramp = ['#2a2420', '#3e342c', '#54463a', '#6a5a4a', '#80705e'];
const PINEBARK_HI: Ramp = ['#4a2414', '#713620', '#8a4a28', '#a8622f', '#c87c40', '#dc9552'];

function pine(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = P(p, 0.5, 0.5, 0);
  const Rn = rng(k.seed * 149 + 3);
  const s = 0.88 + Rn() * 0.28;
  const H = Math.round(560 * s);
  const lean = (Rn() - 0.5) * 0.06;
  contactShadow(c, x + 36 * s, y + 10, 80 * s, 24 * s, 0.32);
  // a straight trunk: grey-brown at the foot, warm orange-brown above
  layer(c, (l) => {
    const th = Math.round(H * 0.94);
    for (let j = 0; j < th; j++) {
      const t = j / th;
      const w = Math.max(3, Math.round(15 * s * (1 - t * 0.6) * (j < 6 ? 1 + (6 - j) * 0.08 : 1)));
      const cx = x + lean * t * H;
      const x0 = Math.round(cx - w / 2);
      const hi = t > 0.18 + hash(j >> 3, 1, k.seed) * 0.06;
      const r = hi ? PINEBARK_HI : PINEBARK_LO;
      for (let i = 0; i < w; i++) {
        const u = i / Math.max(1, w - 1);
        let tone = u < 0.28 ? r.length - 2 : u < 0.6 ? r.length - 3 : u < 0.85 ? 1 : 0;
        if (!hi && hash(x0 + i, Math.floor((y - j) / 5), k.seed) < 0.22) tone -= 1;
        if (hi && hash(Math.floor((x0 + i) / 2), Math.floor((y - j) / 3), k.seed + 1) < 0.16) tone += 1;
        px(l, x0 + i, y - j - 1, r[Math.max(0, Math.min(r.length - 1, tone))]);
      }
    }
  });
  // stacked tiers of needle pads, wide below and narrowing to the top, each a lobed mound
  // with a dark underside; the upper tiers overhang the ones below
  const n = 6 + Math.floor(Rn() * 2);
  const masses: Mass[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ty = y - H * (0.4 + t * 0.56);
    const tx = x + lean * H * (0.4 + t * 0.56) + (Rn() - 0.5) * 12;
    const rx = (84 - t * 58 + Rn() * 12) * s;
    const ry = (21 - t * 5) * s;
    // a flat cloud of needles: a scalloped lower edge of small lobes, a lit crown on top
    const lobes = 5;
    for (let j = 0; j < lobes; j++) {
      const f = (j / (lobes - 1)) * 2 - 1;
      masses.push({ x: tx + f * rx * 0.66, y: ty + 2 + Math.abs(f) * 4, rx: rx * 0.36, ry: ry * 0.8, z: i * 10 + 1 + (1 - Math.abs(f)) });
    }
    masses.push({ x: tx - rx * 0.08, y: ty - ry * 0.3, rx: rx * 0.7, ry: ry * 0.75, z: i * 10 + 3 });
  }
  layer(c, (l) => foliage(l, masses, PINE, k.seed, { cell: 4.2, holes: 0.03, tilt: 0.22, bias: 0.04, sparkle: '#8ab860' }), { outline: 0.55 });
  // cones and needles in the grass
  const fr = rng(k.seed + 5);
  for (let i = 0; i < 5; i++) {
    const fx = x + (fr() - 0.3) * 80;
    const fy = y + (fr() - 0.4) * 18;
    px(c, fx, fy, '#6a4a2a', 3, 2);
    px(c, fx, fy, '#8a643a', 1, 1);
  }
}

// ── round-crowned deciduous trees (lime and field maple) ─────
const TREELEAF: Ramp = ['#1f3d10', '#2b4c1c', '#39601e', '#4c7424', '#5e862b', '#76a034', '#92b84a', '#b4d470'];
const TREEBARK: Ramp = ['#3a2a1e', '#54402c', '#6e5438', '#8a6a48', '#a4845e'];

function roundTree(p: PropPainter, k: PropCtx) {
  const c = p.c;
  const [x, y] = P(p, 0.5, 0.5, 0);
  const Rn = rng(k.seed * 173 + 11);
  const s = 0.75 + Rn() * 0.35;
  const H = Math.round(330 * s);
  const rx = 100 * s;
  const ry = 104 * s;
  const cy = y - H + ry * 0.92;
  contactShadow(c, x + 30 * s, y + 8, rx * 0.95, 24 * s, 0.32);
  layer(c, (l) => {
    // a short trunk forking into two or three limbs
    for (let j = 0; j < H * 0.45; j++) {
      const w = Math.max(3, Math.round(13 * s * (1 - (j / H) * 0.6)));
      for (let i = 0; i < w; i++) px(l, x - w / 2 + i, y - j - 1, TREEBARK[i < w * 0.3 ? 4 : i < w * 0.65 ? 2 : 1]);
    }
    for (const f of [-1, 0.2, 1]) curve(l, x, y - H * 0.4, x + f * rx * 0.2, y - H * 0.55, x + f * rx * 0.45, y - H * 0.72, TREEBARK[2], 3);
  });
  const masses: Mass[] = [];
  for (let i = 0; i < 20; i++) {
    const t = Rn() * Math.PI * 2;
    const d = Math.sqrt(Rn()) * 0.66;
    masses.push({ x: x + Math.cos(t) * rx * d, y: cy + Math.sin(t) * ry * d * 0.85, rx: rx * (0.32 + Rn() * 0.14), ry: ry * (0.26 + Rn() * 0.1), z: Math.sin(t) * d + Rn() * 0.2 });
  }
  layer(c, (l) => foliage(l, masses, TREELEAF, k.seed, { cell: 4.6, holes: 0.08, tilt: 0.28, bias: 0.12, sparkle: '#d0e890' }), { outline: 0.55 });
}

// ── shrubs and grasses ──────────────────────────────────────
function shrub(p: PropPainter, k: PropCtx) {
  const v = k.variant ?? ['grass', 'ball', 'cornus', 'sedge'][k.seed % 4];
  const [x, y] = P(p, 0.5, 0.5, 0);
  const Rn = rng(k.seed * 17 + 9);
  const c = p.c;
  if (v === 'grass') {
    // miscanthus: a fountain of arching blades, silky plumes above
    contactShadow(c, x + 8, y + 3, 26, 8, 0.24);
    layer(c, (l) => {
      for (let i = 0; i < 46; i++) {
        const a = -1.25 + (i / 45) * 2.5 + (Rn() - 0.5) * 0.15;
        const len = 40 + Rn() * 34;
        const ex = x + Math.sin(a) * len * 0.9;
        const ey = y - Math.cos(a) * len * 0.75 - 10;
        curve(l, x + (Rn() - 0.5) * 10, y, x + Math.sin(a) * len * 0.3, y - len * 0.9, ex, ey, ['#5a7a3a', '#6e8e44', '#86a252', '#a6b866', '#c4c884'][Math.floor(Rn() * 5)]);
      }
      for (let i = 0; i < 9; i++) {
        const px0 = x + (Rn() - 0.5) * 40;
        const py0 = y - 68 - Rn() * 22;
        for (let j = 0; j < 7; j++) ln(l, px0, py0 + j * 2, px0 + 4 + (j % 3), py0 - 6 + j * 2, j % 2 ? '#e8d8c0' : '#d8c4a8');
        ln(l, px0, py0, px0 + 1, py0 + 26, '#b8b080');
      }
    }, { outline: 0.4 });
  } else if (v === 'ball') {
    contactShadow(c, x + 8, y + 3, 22, 8, 0.28);
    layer(c, (l) => foliage(l, [{ x, y: y - 20, rx: 24, ry: 20, z: 1 }, { x: x - 8, y: y - 16, rx: 14, ry: 12, z: 0 }], ['#16301a', '#1e4222', '#285a2a', '#346e30', '#468238', '#5e9a44', '#7cb456'], k.seed, { cell: 2.6, tilt: 0.08 }), { outline: 0.6 });
  } else if (v === 'cornus') {
    // red-stemmed dogwood: a vase of thin coral-red twigs, leaves along their upper half
    contactShadow(c, x + 8, y + 3, 26, 8, 0.24);
    layer(c, (l) => {
      const tips: [number, number][] = [];
      for (let i = 0; i < 30; i++) {
        const a = -0.85 + (i / 29) * 1.7 + (Rn() - 0.5) * 0.2;
        const h = 34 + Rn() * 30;
        const ex = x + Math.sin(a) * h * 0.75;
        const ey = y - Math.cos(a) * h;
        curve(l, x + (Rn() - 0.5) * 8, y, x + Math.sin(a) * h * 0.25, y - h * 0.55, ex, ey, ['#9a2a20', '#b8382a', '#d04a30', '#e0603a'][Math.floor(Rn() * 4)]);
        tips.push([ex, ey]);
      }
      const masses: Mass[] = tips.filter((_, i) => i % 2 === 0).map(([tx, ty], i) => ({ x: tx + (Rn() - 0.5) * 4, y: ty + 6 + Rn() * 8, rx: 6 + Rn() * 3, ry: 4 + Rn() * 2, z: i }));
      foliage(l, masses, LEAF, k.seed, { cell: 2.2, holes: 0.25, tilt: 0.3 });
    }, { outline: 0.45 });
  } else if (v === 'fern') {
    contactShadow(c, x + 6, y + 3, 18, 6, 0.22);
    layer(c, (l) => {
      for (let i = 0; i < 10; i++) {
        const a = -1.3 + (i / 9) * 2.6;
        const len = 18 + Rn() * 10;
        const ex = x + Math.sin(a) * len;
        const ey = y - Math.cos(a) * len * 0.6 - 4;
        ln(l, x, y - 2, ex, ey, '#3a6a2a');
        for (let j = 1; j < 6; j++) {
          const t = j / 6;
          const fx = x + (ex - x) * t;
          const fy = y - 2 + (ey - y + 2) * t;
          ln(l, fx, fy, fx + (a > 0 ? 3 : -3), fy + 2, j % 2 ? '#5a8a3a' : '#4a7a32');
        }
      }
    }, { outline: 0.45 });
  } else {
    // sedge: a low arching tussock
    contactShadow(c, x + 6, y + 2, 18, 6, 0.22);
    layer(c, (l) => {
      for (let i = 0; i < 30; i++) {
        const a = -1.3 + Rn() * 2.6;
        const len = 14 + Rn() * 12;
        curve(l, x + (Rn() - 0.5) * 6, y, x + Math.sin(a) * len * 0.3, y - len, x + Math.sin(a) * len, y - len * 0.5 + Math.abs(a) * 6, ['#4a6a32', '#5a7e3a', '#6e9246', '#86a856'][Math.floor(Rn() * 4)]);
      }
    }, { outline: 0.4 });
  }
}

// ── flower beds: mounded perennials in drifts (the picture's lush planting) ──
const BED_KINDS: string[][] = [
  ['#f6f8ec', '#ffffff', '#f2d24a'], // white daisies and yarrow
  ['#9a6ad0', '#b88ae0', '#7a52b8'], // lavender, salvia, catmint
  ['#f2d24a', '#f6e27a', '#e8a82a'], // rudbeckia, achillea
  ['#e88ab0', '#f2b0c8', '#d0507a'], // echinacea, phlox
  ['#f6f8ec', '#b88ae0', '#f2d24a', '#e88ab0'], // mixed
];

/** A planted bed: low mounds of leaves covering the footprint, flowers on top, a few tall spikes. */
function flowerbed(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const Rn = rng(k.seed * 41 + 13);
  const kind = BED_KINDS[k.variant ? +k.variant % BED_KINDS.length : k.seed % BED_KINDS.length];
  const masses: Mass[] = [];
  const n = Math.max(6, Math.round(W * D * 9));
  for (let i = 0; i < n; i++) {
    const a = 0.08 + Rn() * (W - 0.16);
    const b = 0.08 + Rn() * (D - 0.16);
    const [x, y] = P(p, a, b, 0);
    masses.push({ x, y: y - 12 - Rn() * 6, rx: 17 + Rn() * 10, ry: 11 + Rn() * 5, z: a + b + Rn() * 0.3 });
  }
  contactShadow(p.c, P(p, W / 2, D / 2, 0)[0] + 10, P(p, W / 2, D / 2, 0)[1] + 4, 30 + (W + D) * 18, 12 + (W + D) * 6, 0.22);
  layer(p.c, (l) => foliage(l, masses, LEAF, k.seed, { cell: 2.8, holes: 0.02, tilt: 0.3, bias: 0.14, dots: kind, dotChance: 0.72, dotSize: 3 }), { outline: 0.45 });
  // tall flower spikes standing out of the mounds
  layer(p.c, (l) => {
    for (let i = 0; i < n * 1.4; i++) {
      const [x, y] = P(p, 0.12 + Rn() * (W - 0.24), 0.12 + Rn() * (D - 0.24), 0);
      const h = 22 + Rn() * 18;
      const col = kind[Math.floor(Rn() * kind.length)];
      ln(l, x, y - 12, x + (Rn() - 0.5) * 4, y - h, '#3f6a1c');
      px(l, x - 1, y - h - 5, col, 3, 5);
      px(l, x - 2, y - h - 3, col, 5, 2);
      px(l, x - 1, y - h - 5, '#ffffff', 1, 1);
    }
  }, { outline: false });
}

/** A clipped hornbeam hedge: a box of fine leaves, lit top, a darker shaded side and a dark foot. */
const hedge: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Hh = 12;
    footShadow(p, 0.1, 0.25, W - 0.1, 0.78, Hh, 0.26);
    const leafy = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => {
      const r = ['#1c3420', '#244226', '#2e522e', '#3a6436', '#4a7840', '#5e8c4c', '#76a25a'];
      let i = light === 2 ? 4.4 : light === 1 ? 3.4 : 2.2;
      const cl = hash(Math.floor(u / 3), Math.floor(v / 3), 71);
      i += (cl - 0.5) * 1.6;
      if (hash(x, y, 72) < 0.12) i -= 1;
      if (light !== 2 && v < 5 && bayer(x, y) * 5 > v) i -= 1;
      return r[Math.max(0, Math.min(6, Math.round(i)))];
    };
    lbox(p, 0.05, 0.28, W - 0.1, 0.46, 0, Hh, { front: (l) => leafy(l), side: (l) => leafy(l), top: (l) => leafy(l), edge: '#14281a' });
    // a few leaves sticking out of the clipped faces
    const F = front(p, 0.74);
    const Rn = rng(k.seed + 3);
    for (let i = 0; i < W * 6; i++) {
      const [lx, ly] = F.F(0.1 + Rn() * (W - 0.2), Rn() * Hh);
      px(p.c, lx, ly, Rn() < 0.5 ? '#5e8c4c' : '#3a6436', 2, 1);
    }
  },
};

// ── the pond ────────────────────────────────────────────────
function reeds(p: PropPainter, k: PropCtx) {
  const v = k.variant ?? ['phrag', 'typha', 'iris', 'rush'][k.seed % 4];
  const c = p.c;
  const Rn = rng(k.seed * 23 + 1);
  const [x, y] = P(p, 0.5, 0.5, 0);
  layer(c, (l) => {
    const n = v === 'iris' ? 14 : 26;
    for (let i = 0; i < n; i++) {
      const sx = x + (Rn() - 0.5) * 50;
      const sy = y + (Rn() - 0.5) * 16;
      if (v === 'phrag') {
        const h = 60 + Rn() * 40;
        const lean = (Rn() - 0.3) * 8;
        ln(l, sx, sy, sx + lean, sy - h, Rn() < 0.5 ? '#8a9a4a' : '#a8a860');
        // a leaf flag and the fluffy purple-brown plume
        ln(l, sx + lean * 0.5, sy - h * 0.5, sx + lean * 0.5 + 9, sy - h * 0.5 - 4, '#6e8a3a');
        for (let j = 0; j < 6; j++) px(l, sx + lean - 1 + (j % 2), sy - h - j * 2, j < 3 ? '#8a6a5a' : '#a88a74', 3, 2);
      } else if (v === 'typha') {
        const h = 40 + Rn() * 28;
        ln(l, sx, sy, sx + 1, sy - h, '#6a8a3a');
        if (Rn() < 0.6) {
          px(l, sx - 1, sy - h + 4, '#5a3a22', 3, 9);
          px(l, sx - 1, sy - h + 4, '#7a5232', 1, 9);
          px(l, sx, sy - h, '#6a8a3a', 1, 4);
        }
        curve(l, sx, sy, sx + 4, sy - h * 0.6, sx + 10, sy - h * 0.7, '#5e7e34');
      } else if (v === 'iris') {
        const h = 26 + Rn() * 18;
        fillPoly(l, [[sx - 1, sy], [sx + 2, sy], [sx + 3, sy - h], [sx + 1, sy - h - 3]], ['#3e6a32', '#4e7e3a', '#5e9244'][Math.floor(Rn() * 3)]);
        if (Rn() < 0.45) {
          const fx = sx + 4;
          const fy = sy - h * 0.8;
          ln(l, sx + 1, sy - h * 0.4, fx, fy, '#4e7e3a');
          px(l, fx - 2, fy - 3, '#f2d23a', 5, 3);
          px(l, fx - 1, fy, '#e8b02a', 3, 2);
          px(l, fx, fy - 2, '#8a5a2a', 1, 1);
        }
      } else {
        const h = 22 + Rn() * 16;
        ln(l, sx, sy, sx + (Rn() - 0.5) * 6, sy - h, ['#2e5228', '#3a6230', '#4a7438'][Math.floor(Rn() * 3)]);
      }
    }
  }, { outline: 0.35 });
  // the water shows a little ripple ring where the stems stand in it
  void k;
}

const lily: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 29 + 5);
    const c = p.c;
    for (let i = 0; i < 6; i++) {
      const [x, y] = P(p, 0.15 + Rn() * 0.7, 0.15 + Rn() * 0.7, 0);
      const r = 5 + Rn() * 4;
      ell(c, x, y + 1, r + 1, r * 0.5 + 0.5, '#1e3a2a');
      ell(c, x, y, r, r * 0.5, Rn() < 0.5 ? '#3e7a3a' : '#4e8a42');
      ell(c, x - r * 0.3, y - r * 0.15, r * 0.5, r * 0.22, '#6aa452');
      // the notch
      fillPoly(c, [[x, y], [x + r, y - r * 0.2], [x + r, y + r * 0.2]], '#2a5a5a');
      if (Rn() < 0.35) {
        const pink = Rn() < 0.4;
        px(c, x - 2, y - 3, pink ? '#f2a6c4' : '#fbfaf6', 5, 2);
        px(c, x - 1, y - 4, pink ? '#f8c8da' : '#ffffff', 3, 1);
        px(c, x, y - 3, '#f2d23a', 1, 1);
      }
    }
  },
};

const rock: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 31 + 7);
    const [x, y] = P(p, 0.5, 0.55, 0);
    contactShadow(p.c, x + 8, y + 3, 26, 8, 0.3);
    const granite: Ramp = ['#3e3c3e', '#565456', '#6e6c6c', '#888584', '#a29e9c', '#bcb8b4', '#d4d0ca'];
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      const n = 2 + Math.floor(Rn() * 3);
      for (let i = 0; i < n; i++) masses.push({ x: x + (Rn() - 0.5) * 34, y: y - 6 - Rn() * 6, rx: 10 + Rn() * 10, ry: 7 + Rn() * 6, z: i });
      foliage(l, masses, granite, k.seed, { cell: 6, tilt: 0.25 });
      // lichen and moss spots
      for (let i = 0; i < 8; i++) px(l, x + (Rn() - 0.5) * 30, y - 6 - Rn() * 12, Rn() < 0.5 ? '#8a9a5a' : '#c8c08a', 2, 1);
    }, { outline: 0.6 });
  },
};

const meadowClump: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 37 + 11);
    const [x, y] = P(p, 0.5, 0.5, 0);
    const kinds = [['#fbfaf2', '#f2d24a'], ['#b07ad8', '#8a5ab8'], ['#e84a3a', '#2a2a30'], ['#f2d24a', '#e8a82a']];
    const kind = kinds[k.seed % kinds.length];
    layer(p.c, (l) => {
      for (let i = 0; i < 22; i++) {
        const sx = x + (Rn() - 0.5) * 60;
        const sy = y + (Rn() - 0.5) * 22;
        const h = 8 + Rn() * 14;
        ln(l, sx, sy, sx + (Rn() - 0.5) * 4, sy - h, Rn() < 0.5 ? '#5a7a3a' : '#6e8e44');
        if (Rn() < 0.6) {
          px(l, sx - 1, sy - h - 1, kind[0], 3, 2);
          px(l, sx, sy - h - 1, kind[1], 1, 1);
        }
      }
    }, { outline: false });
  },
};

// ── the boardwalk ───────────────────────────────────────────
/** Decking seen from above: boards across the walk (the top face is in world axes, so it depends on the rotation). */
const deckMat = (light: 0 | 1 | 2, rot: 0 | 1) => (u0: number, v0: number, x: number, y: number) => {
  const along = rot === 0 ? u0 : v0;
  const across = rot === 0 ? v0 : u0;
  const b = Math.floor(along / 7);
  if (along % 7 < 1.2) return SILVER[0];
  let i = (light === 2 ? 4.4 : light === 1 ? 3.4 : 2.2) + (hash(b, 0, 81) - 0.5) * 1.2;
  if (hash(x, y, 82) < 0.04) i -= 1;
  if (hash(b, Math.floor(across / 18), 83) < 0.08) i -= 0.8;
  return SILVER[Math.max(0, Math.min(SILVER.length - 1, Math.round(i)))];
};

const boardwalk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const deck = k.variant === 'deck';
    const Z = 2.4;
    const b0 = deck ? 0.1 : 0.22;
    const b1 = deck ? D - 0.1 : D - 0.22;
    // piles: round silvered posts into the water, with a ripple ring
    for (let a = 0.3; a < W; a += 1.2)
      for (const b of [b0 + 0.06, b1 - 0.06]) {
        const [x, y] = P(p, a, b, 0);
        ell(p.c, x, y + 1, 7, 3, '#4d8a8b');
        px(p.c, x - 3, y - 10, SILVER[2], 6, 10);
        px(p.c, x - 3, y - 10, SILVER[4], 2, 10);
        px(p.c, x - 3, y - 2, '#3a4a42', 6, 2);
      }
    // edge beams and the decking (boards run across)
    lbox(p, 0, b0, W, b1 - b0, Z - 0.8, 0.8, { front: coat(SILVER), side: coat(SILVER), top: (light) => deckMat(light, p.rot), edge: SILVER[0] });
    // low kerb rails on both edges, posts with a handrail on the water side
    lbox(p, 0, b0, W, 0.08, Z, 0.8, mono(coat(SILVER), SILVER[0]));
    for (let a = 0.2; a < W; a += 1.2) lbox(p, a, b1 - 0.08, 0.08, 0.08, Z, 8.6, mono(coat(SILVER), SILVER[0]));
    lbox(p, 0, b1 - 0.08, W, 0.08, Z, 0.8, mono(coat(SILVER), SILVER[0]));
    lbox(p, 0, b1 - 0.1, W, 0.12, Z + 8.6, 0.6, mono(coat(SILVER), SILVER[0]));
    if (deck) {
      // a bench on the platform and an interpretation board
      lbox(p, W * 0.25, 0.3, W * 0.5, 0.4, Z, 3.2, mono(coat(['#4e301c', '#6c4428', '#8c5a34', '#ab7442', '#c68f56', '#dcad74']), '#3e2414'));
      lbox(p, W * 0.25, 0.25, W * 0.5, 0.1, Z + 3.2, 3.6, mono(coat(['#4e301c', '#6c4428', '#8c5a34', '#ab7442', '#c68f56', '#dcad74']), '#3e2414'));
    }
  },
};

export const CHEMLAB_NATURE: Record<string, PropArt> = {
  lab_birch: { draw: birch },
  lab_pine: { draw: pine },
  lab_tree: { draw: roundTree },
  lab_flowerbed: { draw: flowerbed },
  lab_shrub: { draw: shrub },
  lab_hedge: hedge,
  lab_reeds: { draw: reeds },
  lab_lily: lily,
  lab_rock: rock,
  lab_meadow: meadowClump,
  lab_boardwalk: boardwalk,
};

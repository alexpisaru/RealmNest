// Research Hub — the summit's plants and stones (1 z ≈ 10 cm).
//   res_larch     European larch: a narrow cone of soft, light-green tiers
//                 drooping from a straight red-barked trunk (young / grown / old)
//   res_pine      Swiss stone pine (arolla): a dense, dark, many-topped crown
//   res_snag      a lightning-struck larch, bleached silver
//   res_boulder   granite boulders: big, a cluster, a flat slab, a mossy one
//   res_flowers   a drift of one wildflower: gentian, alpenrose, edelweiss,
//                 arnica, bellflower, globeflower
//   res_grass     a tussock of sedge
//   res_shrub     juniper, dwarf mountain pine, alpenrose bush
//   res_cairn     a stone man marking the path
import type { PropArt } from '../../../props';
import { contactShadow, curve, dotFruit, ell, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { anchor } from '../util';
import { grassSkirt, plot, rockMass } from './kit';
import { ROCKL } from './meadow';
import { ARVE, BARKG, BARKL, FLOWERS, LARCH, ROCK } from './palette';

const LARCH_Y: Ramp = ['#34401e', '#465426', '#5c6c2e', '#748436', '#8e9c40', '#aab44e', '#c8ca62'];

/** A tapering trunk with bark plates, lit on the left. */
function bark(l: CanvasRenderingContext2D, x: number, y: number, h: number, w0: number, w1: number, r: Ramp, seed: number, lean = 0) {
  const R = rng(seed);
  void R;
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const w = w0 + (w1 - w0) * t;
    const cx = x + lean * t * t * h;
    for (let i = 0; i < w; i++) {
      const u = i / Math.max(1, w - 1);
      let tone = u < 0.25 ? 4 : u < 0.55 ? 3 : u < 0.8 ? 2 : 1;
      // plates: short vertical cracks
      const cell = Math.floor((cx - w / 2 + i) / 2.5) * 31 + Math.floor((y - j) / 5);
      if (((cell * 2654435761) >>> 0) % 7 === 0) tone -= 1;
      if (((cell * 40503) >>> 0) % 11 === 0) tone += 1;
      plot(l, cx - w / 2 + i, y - j, r[Math.max(0, Math.min(r.length - 1, tone))]);
    }
  }
}

// ── the larch ───────────────────────────────────────────────
const res_larch: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p);
    const R = rng(k.seed * 131 + 7);
    const kind = k.variant ?? ['young', 'grown', 'grown', 'old', 'grown', 'young', 'old', 'grown'][k.seed % 8];
    const s = kind === 'young' ? 0.6 + R() * 0.12 : kind === 'old' ? 1.04 + R() * 0.1 : 0.84 + R() * 0.14;
    const H = 460 * s;
    const W0 = 70 * s;
    const lean = (R() - 0.5) * 8 * s;
    contactShadow(c, x + 40 * s, y + 10, 70 * s, 20 * s, 0.3);
    const trunkX = (yy: number) => x + lean * Math.pow((y - yy) / H, 2);
    // whorls of branches: level out, droop, turn up at the tip; soft tufts hang along them
    const back: Mass[] = [];
    const frontM: Mass[] = [];
    const twigs: [number, number, number, number, number, boolean][] = [];
    const bot = H * (kind === 'old' ? 0.24 : 0.17);
    const top = kind === 'old' ? H * 0.84 : H * 0.98;
    let yb = y - bot;
    let wi = 0;
    while (y - yb < top) {
      const t = (y - yb - bot) / (top - bot);
      const W = W0 * Math.pow(Math.max(0, 1 - t), 0.85) + 7 * s;
      const n = 3 + Math.floor(R() * 2);
      for (let j = 0; j < n; j++) {
        const dir = (j + wi) % 2 ? 1 : -1;
        const isFront = R() < 0.45;
        const L = W * (0.6 + R() * 0.5);
        const bx = trunkX(yb);
        const ex = bx + dir * L * (0.85 + R() * 0.15);
        const ey = yb + L * (0.3 + R() * 0.22);
        twigs.push([bx, yb, ex, ey, dir, isFront]);
        const list = isFront ? frontM : back;
        const steps = Math.max(2, Math.round(L / 6));
        for (let q = 1; q <= steps; q++) {
          const f = q / steps;
          const mx = bx + (ex - bx) * f;
          const my = yb + (ey - yb) * Math.pow(f, 1.6) - (f > 0.8 ? (f - 0.8) * 26 : 0);
          list.push({ x: mx + (R() - 0.5) * 5, y: my + 4 + (R() - 0.5) * 4, rx: (7 + (1 - f) * 4) * Math.max(0.85, s), ry: (5 + (1 - f) * 2.4) * Math.max(0.85, s), z: (isFront ? 1000 : 0) - yb * 0.01 + f });
        }
      }
      yb -= (10 + R() * 7) * Math.max(0.75, s);
      wi++;
    }
    const ramp = k.seed % 5 === 3 ? LARCH_Y : LARCH;
    // the back branches, then the trunk and the twigs, then the branches in front
    layer(c, (l) => foliage(l, back, ramp, k.seed, { cell: 2.2, holes: 0.1, tilt: 0.16, bias: -0.08 }), { outline: 0.55 });
    layer(c, (l) => {
      for (let j = 0; j < H * (kind === 'old' ? 0.9 : 0.99); j++) {
        const t = j / H;
        const w = Math.max(2, (11 * s + 2) * (1 - t * 0.9));
        const cx = trunkX(y - j);
        for (let i = 0; i < w; i++) {
          const u = i / Math.max(1, w - 1);
          let tone = u < 0.28 ? 4 : u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
          if (((Math.floor((cx - w / 2 + i) / 2.5) * 31 + Math.floor((y - j) / 5)) * 2654435761 >>> 0) % 7 === 0) tone -= 1;
          px(l, cx - w / 2 + i, y - j, BARKL[Math.max(0, tone)]);
        }
      }
      for (const [bx, by, ex, ey, dir] of twigs) {
        curve(l, bx, by, bx + (ex - bx) * 0.5, by + (ey - by) * 0.15, ex, ey - 2, BARKL[2], 1);
        ln(l, ex, ey - 2, ex + dir * 3, ey - 6, BARKL[3]);
      }
      // dead twigs low on the trunk
      for (let i = 0; i < 5; i++) {
        const yy = y - H * (0.07 + i * 0.03);
        const dir = i % 2 ? 1 : -1;
        ln(l, trunkX(yy), yy, trunkX(yy) + dir * (6 + R() * 9) * s, yy - 3 - R() * 5, BARKG[3]);
      }
      if (kind === 'old') ln(l, trunkX(y - H * 0.88), y - H * 0.88, trunkX(y - H) + 2, y - H * 1.02, BARKG[4], 2);
    }, { outline: 0.5 });
    layer(c, (l) => foliage(l, frontM, ramp, k.seed + 1, { cell: 2.2, holes: 0.08, tilt: 0.16 }), { outline: 0.55 });
    // little cones on the upper branches
    for (let i = 0; i < 7; i++) {
      const m = frontM[Math.floor(R() * frontM.length)];
      if (m && m.y < y - H * 0.4) px(c, m.x + (R() - 0.5) * m.rx, m.y + 1, i % 2 ? '#7a4a2a' : '#a06a3a', 2, 3);
    }
  },
};

// ── the Norway spruce ───────────────────────────────────────
// The reference's tree: a tall dark cone of drooping tiers, light new growth on
// the sunlit tips, the shade side almost black, a thin leader on top.
const SPRUCE: Ramp = ['#0c180a', '#132210', '#1c3016', '#283f1e', '#365228', '#486a32', '#5f843c', '#7e9e4c', '#a2b866'];
const res_spruce: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p);
    const R = rng(k.seed * 71 + 5);
    const kind = k.variant ?? ['tall', 'mid', 'mid', 'young', 'tall', 'mid', 'young', 'tall'][k.seed % 8];
    const s = kind === 'young' ? 0.5 + R() * 0.12 : kind === 'tall' ? 0.98 + R() * 0.14 : 0.74 + R() * 0.14;
    const H = 440 * s;
    const W = 74 * s + 6;
    const lean = (R() - 0.5) * 4 * s;
    contactShadow(c, x + 30 * s, y + 8, 60 * s + 8, 17 * s + 4, 0.38);
    layer(c, (l) => {
      // the trunk under the lowest tier
      const tb = H * 0.1;
      for (let j = 0; j < tb; j++) for (let i = 0; i < 6 * s + 2; i++) plot(l, x - 3 * s + i, y - j, BARKL[i < 2 ? 4 : i < 4 * s ? 2 : 1]);
      // tiers from the bottom up: each hangs from the trunk, widens and droops, its fringe ragged
      const n = Math.max(6, Math.round(11 * Math.sqrt(s)));
      const yb = y - tb * 0.7;
      const yt = y - H;
      for (let j = 0; j < n; j++) {
        const t = j / (n - 1);
        const th = (38 + (1 - t) * 22) * Math.max(0.65, s);
        const ybot = yb - (yb - yt - th * 0.6) * Math.pow(t, 0.92);
        const ytop = ybot - th;
        const wb = (W * Math.pow(1 - t * 0.93, 0.95) + 3) * (j > 0 && j < n - 1 ? 0.82 + R() * 0.36 : 1);
        const asym = (R() - 0.5) * 0.36;
        const cx = x + lean * t * 8 + (R() - 0.5) * 3 * s;
        const ph = R() * 6;
        const skew = (R() - 0.5) * 0.25;
        for (let yy = Math.floor(ytop); yy <= ybot + 3; yy++) {
          const r = (yy - ytop) / th;
          const hw0 = wb * (0.22 + 0.78 * Math.pow(Math.min(1, Math.max(0, r)), 0.62));
          for (let xx = Math.floor(cx - hw0 * (1 + asym) - 2); xx <= cx + hw0 * (1 - asym) + 2; xx++) {
            const hw = hw0 * (xx < cx ? 1 + asym : 1 - asym);
            const xo = (xx - cx) / Math.max(1, wb);
            // the fringe: drooping branch tips along the tier's lower edge, the outer ends curling up
            const tip = 0.5 + 0.28 * Math.sin(xx * 0.55 + ph) + (hash(xx >> 1, j * 7, k.seed + 5) - 0.5) * 0.9;
            const bottom = 1 - 0.28 * xo * xo + (tip - 0.5) * (9 / th) + skew * xo;
            if (r > bottom || Math.abs(xx - cx) > hw + (tip > 0.72 ? 3 : tip < 0.3 ? -2 : 0)) continue;
            if (r < 0) continue;
            const lit = xo < -0.08;
            let tone = lit ? 4 : xo < 0.12 ? 2.8 : 1.4;
            if (r < 0.2) tone -= 0.8;
            if (r > bottom - 0.17) tone -= 2.1;
            else if (r > bottom - 0.36) tone += lit ? 1.5 : 0.7;
            if (Math.abs(xx - cx) > hw - 2.5 && lit && r > 0.3) tone += 2.2;
            const hh = hash(xx >> 1, yy, k.seed);
            if (hh < 0.18) tone -= 1;
            else if (hh > 0.88) tone += 0.8;
            tone -= Math.max(0, xo) * 1.2;
            plot(l, xx, yy, SPRUCE[Math.max(0, Math.min(SPRUCE.length - 1, Math.round(tone)))]);
          }
        }
      }
      // the leader
      for (let j = 0; j < 14 * s + 4; j++) plot(l, x + lean * 8 - 1 + (j > 10 * s ? 1 : 0), yt - j + 6, SPRUCE[j < 6 ? 5 : 6]);
    }, { outline: 0.5 });
    // cones hanging on the upper tiers
    for (let i = 0; i < 4; i++) px(c, x + (R() - 0.5) * W * 0.5, y - H * (0.62 + R() * 0.25), i % 2 ? '#6a3a22' : '#8a5030', 2, 3);
  },
};

// ── the arolla pine ─────────────────────────────────────────
const res_pine: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p);
    const R = rng(k.seed * 97 + 3);
    const s = 0.7 + R() * 0.45;
    const H = 330 * s;
    contactShadow(c, x + 40 * s, y + 10, 76 * s, 22 * s, 0.34);
    const tops = 1 + Math.floor(R() * 3);
    // a stout trunk splitting into upturned limbs
    layer(c, (l) => {
      bark(l, x, y, H * 0.45, 18 * s + 3, 10 * s, BARKG, k.seed);
      for (let i = 0; i < tops; i++) {
        const tx = x + (i - (tops - 1) / 2) * 26 * s;
        curve(l, x, y - H * 0.42, tx - (tx - x) * 0.2, y - H * 0.6, tx, y - H * 0.92, BARKG[3], Math.max(2, 6 * s));
        curve(l, x - 1, y - H * 0.42, tx - (tx - x) * 0.2 - 1, y - H * 0.6, tx - 1, y - H * 0.92, BARKG[5], 1);
      }
      for (let i = 0; i < 7; i++) {
        const yy = y - H * (0.3 + R() * 0.45);
        const dir = R() < 0.5 ? -1 : 1;
        curve(l, x, yy, x + dir * 20 * s, yy - 4, x + dir * (34 + R() * 16) * s, yy - 18 * s, BARKG[2], 3);
      }
    });
    // dense clumps of needles, darker inside, sunlit tufts on the upper left
    const masses: Mass[] = [];
    for (let i = 0; i < 28; i++) {
      const t = R();
      const yy = y - H * (0.26 + t * 0.7);
      const spread = (1 - t * 0.45) * 52 * s;
      masses.push({ x: x + (R() - 0.5) * 2 * spread, y: yy, rx: (14 + R() * 12) * s, ry: (11 + R() * 9) * s, z: -yy * 0.1 + R() * 4 });
    }
    for (let i = 0; i < tops; i++) masses.push({ x: x + (i - (tops - 1) / 2) * 26 * s, y: y - H * 0.94, rx: 14 * s, ry: 16 * s, z: -100 });
    layer(c, (l) => foliage(l, masses, ARVE, k.seed, { cell: 3.6, holes: 0.14, tilt: 0.2 }), { outline: 0.62 });
    // purple-brown cones up top
    for (let i = 0; i < 5; i++) {
      const m = masses[masses.length - 1 - Math.floor(R() * 6)];
      if (m) dotFruit(c, m.x + (R() - 0.5) * m.rx, m.y - m.ry * 0.3, '#6a4a6a', 4);
    }
  },
};

// ── a bleached snag ─────────────────────────────────────────
const res_snag: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p);
    const R = rng(k.seed * 53 + 1);
    const H = 230 + R() * 80;
    contactShadow(c, x + 20, y + 6, 30, 9, 0.28);
    layer(c, (l) => {
      const silver: Ramp = ['#4a4844', '#6a6660', '#8e8880', '#b0aaa0', '#cec8bc', '#e6e0d4'];
      // a twisted, split trunk with spiral grain
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const w = 12 - t * 9;
        const cx = x + Math.sin(t * 3 + k.seed) * 4;
        for (let i = 0; i < w; i++) {
          const u = i / Math.max(1, w - 1);
          let tone = u < 0.3 ? 4 : u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
          if (Math.floor(i + j * 0.3) % 5 === 0) tone -= 1;
          px(l, cx - w / 2 + i, y - j, silver[Math.max(0, tone)]);
        }
      }
      // the lightning scar and broken limbs
      ln(l, x + 1, y - H * 0.2, x + 3, y - H * 0.8, '#3a3632');
      for (let i = 0; i < 5; i++) {
        const yy = y - H * (0.35 + i * 0.12);
        const dir = i % 2 ? 1 : -1;
        const len = 14 + R() * 22;
        ln(l, x, yy, x + dir * len, yy - len * 0.5, silver[3], 3 - (i > 2 ? 1 : 0));
        ln(l, x + dir * len, yy - len * 0.5, x + dir * (len + 6), yy - len * 0.5 - 8, silver[2]);
      }
    });
  },
};

// ── boulders ────────────────────────────────────────────────
const res_boulder: PropArt = {
  draw(p, k) {
    const W = k.w;
    const [x, y] = anchor(p, W / 2, k.d / 2, 0);
    const R = rng(k.seed * 17 + 5);
    const kind = k.variant ?? ['big', 'cluster', 'slab', 'mossy', 'big', 'cluster'][k.seed % 6];
    const S = W * (0.9 + R() * 0.35);
    const drop = (dx: number, dy: number, rx: number, ry: number, sd: number, o: { moss?: number; lichen?: number; snow?: boolean } = {}) => {
      contactShadow(p.c, x + dx + rx * 0.45, y + dy + ry * 0.35, rx * 1.15, ry * 0.65, 0.3);
      layer(p.c, (l) => rockMass(l, x + dx, y + dy - ry * 0.55, rx, ry, sd, ROCKL, { lichen: 0.025, ...o }), { outline: 0.66 });
    };
    if (kind === 'big') {
      drop(0, 0, 42 * S, 30 * S, k.seed * 3, { moss: 0.3 });
      layer(p.c, (l) => grassSkirt(l, x, y + 4, 40 * S, 12 * S, k.seed, 18), { outline: false });
    } else if (kind === 'cluster') {
      drop(-24 * S, -4 * S, 24 * S, 17 * S, k.seed * 3 + 1);
      drop(22 * S, -2 * S, 20 * S, 15 * S, k.seed * 3 + 2);
      drop(0, 8 * S, 28 * S, 18 * S, k.seed * 3 + 3, { moss: 0.4 });
      layer(p.c, (l) => grassSkirt(l, x, y + 10, 44 * S, 12 * S, k.seed, 22), { outline: false });
    } else if (kind === 'snowy') {
      // a big block at the brink, snow lying on its top
      drop(0, 0, 50 * S, 34 * S, k.seed * 3 + 6, { snow: true, lichen: 0.04 });
      drop(34 * S, 10 * S, 22 * S, 16 * S, k.seed * 3 + 7, { snow: true });
    } else if (kind === 'slab') {
      drop(0, 4, 52 * S, 16 * S, k.seed * 3 + 4, { lichen: 0.12 });
      layer(p.c, (l) => grassSkirt(l, x, y + 8, 48 * S, 10 * S, k.seed, 16), { outline: false });
    } else {
      drop(0, 0, 34 * S, 26 * S, k.seed * 3 + 5, { moss: 1, lichen: 0.1 });
      // a juniper growing from its side
      layer(p.c, (l) => foliage(l, [{ x: x + 26 * S, y: y - 6, rx: 18 * S, ry: 10 * S, z: 1 }, { x: x + 38 * S, y: y - 2, rx: 12 * S, ry: 7 * S, z: 2 }], ['#142a26', '#1c3830', '#264a3a', '#325c46', '#426e52', '#58845e'], k.seed, { cell: 2.6, dots: ['#3a4a7a'], dotChance: 0.15, dotSize: 2 }), { outline: 0.6 });
    }
  },
};

// ── wildflower drifts ───────────────────────────────────────
const SPECIES = ['gentian', 'alpenrose', 'edelweiss', 'arnica', 'bellflower', 'globeflower'] as const;
const res_flowers: PropArt = {
  draw(p, k) {
    const sp = (k.variant as (typeof SPECIES)[number]) ?? SPECIES[k.seed % SPECIES.length];
    const R = rng(k.seed * 29 + 11);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    layer(p.c, (l) => {
      const n = 18 + Math.floor(R() * 10);
      for (let i = 0; i < n; i++) {
        const x = cx + (R() - 0.5) * 84;
        const y = cy + (R() - 0.5) * 38;
        // a little rosette of leaves
        for (let j = 0; j < 4; j++) ln(l, x, y, x + (j - 1.5) * 2.5, y - 2 - (j % 2) * 2, ['#2e4a22', '#3c5e28', '#4e7430'][j % 3]);
        if (sp === 'gentian') {
          // deep blue trumpets sitting on the turf
          px(l, x - 2, y - 7, '#1e2e8a', 5, 6);
          px(l, x - 2, y - 7, FLOWERS.gentian, 3, 5);
          px(l, x - 3, y - 8, FLOWERS.gentianL, 7, 2);
          px(l, x, y - 6, '#f0f0a0', 1, 1);
        } else if (sp === 'alpenrose') {
          foliage(l, [{ x, y: y - 6, rx: 7, ry: 5, z: i }], ['#142a1c', '#1e3a24', '#2a4e2e', '#386438', '#4a7a42'], k.seed + i, { cell: 2, dots: [FLOWERS.rose, FLOWERS.roseL], dotChance: 0.9, dotSize: 3 });
        } else if (sp === 'edelweiss') {
          ln(l, x, y, x, y - 7, '#a8b4a0');
          for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [1, -1], [-1, 1]] as const) px(l, x + dx, y - 9 + dy, FLOWERS.edel);
          px(l, x, y - 9, '#d8c870');
        } else if (sp === 'arnica') {
          const h = 8 + R() * 6;
          ln(l, x, y, x + 1, y - h, '#4e7430');
          for (let a = 0; a < 6; a++) px(l, x + 1 + Math.cos(a) * 2.5, y - h + Math.sin(a) * 1.5, FLOWERS.arnica, 2, 1);
          px(l, x, y - h - 1, '#c86a10', 2, 2);
        } else if (sp === 'bellflower') {
          const h = 9 + R() * 5;
          curve(l, x, y, x + 2, y - h, x + 5, y - h + 2, '#4e7430');
          px(l, x + 4, y - h + 2, FLOWERS.bell, 3, 3);
          px(l, x + 4, y - h + 2, '#b8a0f0', 1, 2);
          px(l, x + 1, y - h * 0.6, FLOWERS.bell, 2, 2);
        } else {
          const h = 10 + R() * 6;
          ln(l, x, y, x, y - h, '#4e7430');
          ell(l, x, y - h - 1, 3, 3, '#e8b820');
          px(l, x - 1, y - h - 2, '#fff090', 2, 1);
        }
      }
      // grass blades through the drift
      for (let i = 0; i < 18; i++) {
        const x = cx + (R() - 0.5) * 76;
        const y = cy + (R() - 0.5) * 30;
        const h = 4 + R() * 6;
        ln(l, x, y, x + (R() - 0.5) * 4, y - h, ['#3c5e28', '#4e7430', '#64883a', '#7e9e46'][i % 4]);
      }
    }, { outline: 0.4 });
  },
};

// ── a sedge tussock ─────────────────────────────────────────
const res_grass: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 41 + 3);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    const n = 2 + Math.floor(R() * 3);
    layer(p.c, (l) => {
      for (let t = 0; t < n; t++) {
        const x = cx + (R() - 0.5) * 60;
        const y = cy + (R() - 0.5) * 24;
        const blades = 14 + Math.floor(R() * 8);
        for (let i = 0; i < blades; i++) {
          const a = -Math.PI / 2 + (i / (blades - 1) - 0.5) * 2.2;
          const len = 10 + R() * 12;
          const ex = x + Math.cos(a) * len * 0.9;
          const ey = y + Math.sin(a) * len;
          const col = R() < 0.3 ? ['#a49a5a', '#bcb070', '#8a8048'][i % 3] : ['#3c5a26', '#4e6e2c', '#628432', '#7a9a3c'][i % 4];
          curve(l, x + (i - blades / 2) * 0.4, y, x + Math.cos(a) * len * 0.4, y + Math.sin(a) * len * 0.9, ex, ey + 3, col);
        }
      }
    }, { outline: 0.45 });
  },
};

// ── shrubs: juniper, dwarf mountain pine, alpenrose ─────────
const res_shrub: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 61 + 9);
    const kind = k.variant ?? ['juniper', 'mugo', 'alpenrose'][k.seed % 3];
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, cx + 14, cy + 4, 38, 11, 0.28);
    const masses: Mass[] = [];
    if (kind === 'mugo') {
      // a sprawl of dark limbs with upturned tufts and pale candles
      layer(p.c, (l) => {
        for (let i = 0; i < 5; i++) curve(l, cx, cy, cx + (i - 2) * 14, cy - 6, cx + (i - 2) * 22, cy - 18 - R() * 10, BARKG[2], 3);
      });
      for (let i = 0; i < 9; i++) masses.push({ x: cx + (R() - 0.5) * 64, y: cy - 14 - R() * 16, rx: 12 + R() * 6, ry: 9 + R() * 4, z: i });
      layer(p.c, (l) => {
        foliage(l, masses, ARVE, k.seed, { cell: 3, tilt: 0.2 });
        for (let i = 0; i < 8; i++) px(l, cx + (R() - 0.5) * 60, cy - 26 - R() * 12, '#c8c890', 2, 4);
      }, { outline: 0.6 });
    } else if (kind === 'juniper') {
      for (let i = 0; i < 7; i++) masses.push({ x: cx + (R() - 0.5) * 66, y: cy - 6 - R() * 6, rx: 14 + R() * 6, ry: 6 + R() * 3, z: i });
      layer(p.c, (l) => foliage(l, masses, ['#142a26', '#1c3830', '#264a3a', '#325c46', '#426e52', '#58845e'], k.seed, { cell: 2.4, dots: ['#3a4a7a', '#4a5a8a'], dotChance: 0.18, dotSize: 2 }), { outline: 0.6 });
    } else {
      for (let i = 0; i < 8; i++) masses.push({ x: cx + (R() - 0.5) * 56, y: cy - 12 - R() * 14, rx: 12 + R() * 5, ry: 9 + R() * 4, z: i });
      layer(p.c, (l) => foliage(l, masses, ['#142a1c', '#1e3a24', '#2a4e2e', '#386438', '#4a7a42', '#62904e'], k.seed, { cell: 2.4, dots: [FLOWERS.rose, FLOWERS.roseL, '#e05a80'], dotChance: 0.7, dotSize: 3 }), { outline: 0.6 });
    }
  },
};

// ── a cairn ─────────────────────────────────────────────────
const res_cairn: PropArt = {
  draw(p, k) {
    const R = rng(k.seed * 7 + 2);
    const [cx, cy] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, cx + 8, cy + 3, 18, 6, 0.28);
    let y = cy;
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const rx = (16 - i * 2) * (0.9 + R() * 0.2);
      const ry = 5 + R() * 2;
      const dx = (R() - 0.5) * 4;
      layer(p.c, (l) => rockMass(l, cx + dx, y - ry * 0.4, rx, ry, k.seed * 11 + i, ROCK, { lichen: 0.12 }), { outline: 0.6 });
      y -= ry * 1.1;
    }
  },
};

export const RESEARCH_NATURE: Record<string, PropArt> = { res_spruce, res_larch, res_pine, res_snag, res_boulder, res_flowers, res_grass, res_shrub, res_cairn };

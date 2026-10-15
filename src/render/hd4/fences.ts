// 128×64 fences, gates and garden walls.
//   fenceRow: rail · picket · wattle · broken      (w × 1, along the prop width)
//   gate:     wooden gate between posts
//   stoneWall: dry · cut · mossy · ruin · brick     (legacy 'flowers' → mossy)
import { type FaceTex, tbox, texPara } from '../hd/kit';
import type { PropPainter, V2 } from '../iso';
import type { PropArt, PropCtx } from '../props';
import { contactShadow, ell, fillPoly, foliage, hash, layer, type Mass, px, R, type Ramp, rng } from './kit4';
import { boards4, bricks4, cutStone4, fieldStones4, siding4 } from './materials4';
import { leafBlades } from './plants';

const flat = (r: Ramp) => ({ left: siding4(r, 40), right: siding4(r, 40), top: siding4(r, 40), edge: r[0] });

/** Long soft shadow along a linear prop (fence, wall), cast to the lower right. */
function lineShadow(p: PropPainter, w: number, h: number, alpha = 0.26) {
  const [x0, y0] = p.P(0, 0.75, 0);
  const [x1, y1] = p.P(w, 0.75, 0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  contactShadow(p.c, (x0 + x1) / 2 + h * 0.5, (y0 + y1) / 2 + h * 0.12 + 4, len / 2 + 10, 8 + h * 0.18, alpha);
}

function tufts(p: PropPainter, w: number, seed: number, n = 3) {
  const Rn = rng(seed);
  layer(
    p.c,
    (l) => {
      for (let i = 0; i < Math.round(w * n); i++) {
        const [x, y] = p.P(Rn() * w, 0.62 + Rn() * 0.12, 0);
        leafBlades(l, x, y, 7, R.birch, Math.floor(x * 7 + y), 13, 10);
      }
    },
    { outline: 0.5 },
  );
}

// ── fences ──────────────────────────────────────────────────
function post(p: PropPainter, a: number, h: number, r: Ramp, cap = true) {
  tbox(p, a - 0.05, 0.43, 0.1, 0.12, 0, h, { left: boards4(r, 20, false), right: boards4(r, 20, false), top: siding4(r), edge: r[0] });
  if (cap) tbox(p, a - 0.06, 0.42, 0.12, 0.14, h, 1.2, { left: siding4(r), right: siding4(r), top: siding4(r), edge: r[0] });
}

const FENCES: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  rail(p, k) {
    const w = k.w;
    const r = R.wood;
    lineShadow(p, w, 16);
    for (const z of [6, 12.5]) tbox(p, 0, 0.47, w, 0.06, z, 2.6, { left: siding4(r, 5), right: siding4(r, 5), top: siding4(r, 5), edge: r[0] });
    const posts = Math.round(w) + 1;
    for (let i = 0; i < posts; i++) post(p, Math.min(w - 0.06, (i * w) / (posts - 1) + 0.04), 16 + hash(i, 1, k.seed) * 2, r);
    tufts(p, w, k.seed);
  },
  picket(p, k) {
    // a low cottage picket fence: weathered cream paint, gaps between the pickets, the odd one missing
    const w = k.w;
    const paint = R.cream;
    lineShadow(p, w, 13, 0.2);
    for (const z of [3, 9]) tbox(p, 0, 0.5, w, 0.05, z, 1.8, { left: siding4(R.woodPale, 4), right: siding4(R.woodPale, 4), top: siding4(R.woodPale, 4), edge: R.woodPale[0] });
    const n = Math.round(w * 5);
    for (let i = 0; i < n; i++) {
      if (hash(i, 4, k.seed) < 0.06) continue;
      const a = (i + 0.5) / 5;
      const h = 12.5 + (hash(i, 5, k.seed) - 0.5) * 1.2;
      tbox(p, a - 0.03, 0.44, 0.06, 0.04, 0, h, { left: boards4(paint, 30, false), right: boards4(paint, 30, false), top: siding4(paint), edge: paint[0] });
      // pointed top and the odd chipped spot showing wood
      const [tx, ty] = p.P(a, 0.47, h);
      fillPoly(p.c, [[tx - 3, ty + 1], [tx + 4, ty + 1], [tx, ty - 4]], paint[4]);
      px(p.c, tx - 1, ty - 3, paint[5]);
      if (hash(i, 2, k.seed) < 0.35) {
        const [cx, cy] = p.P(a, 0.48, 3 + hash(i, 3, k.seed) * 8);
        px(p.c, cx - 1, cy, R.wood[3], 2, 2);
      }
    }
    tufts(p, w, k.seed + 1, 4);
  },
  wattle(p, k) {
    const w = k.w;
    lineShadow(p, w, 16);
    const stakes: number[] = [];
    for (let a = 0.05; a < w; a += 0.34) stakes.push(a);
    for (const a of stakes) post(p, a, 18 + hash(a * 10, 1, k.seed) * 3, R.wood, false);
    // woven panel: bands passing in front of and behind the stakes, rows alternating
    const o = p.P(0, 0.5, 0);
    const pu = p.P(w, 0.5, 0);
    const pv = p.P(0, 0.5, 16);
    const U: V2 = [pu[0] - o[0], pu[1] - o[1]];
    const V: V2 = [pv[0] - o[0], pv[1] - o[1]];
    const len = Math.hypot(...U);
    const sp = (len / w) * 0.34;
    const tex: FaceTex = (u, v, x, y) => {
      const row = Math.floor(v / 5);
      const fv = v - row * 5;
      const ph = ((u / sp + (row & 1) * 0.5) % 1) * Math.PI * 2;
      const bulge = Math.sin(ph);
      let i = 3 + bulge * 1.2 + (hash(row, Math.floor(u / 9), k.seed) - 0.5) * 0.8;
      if (fv < 1) i -= 1.6;
      if (fv > 3.5) i += 0.5;
      if (hash(x, y, 9) < 0.05) i -= 1;
      return R.wood[Math.max(0, Math.min(6, Math.round(i)))];
    };
    texPara(p.c, o, U, V, tex);
    // twig ends poking above the top
    const Rn = rng(k.seed + 3);
    for (let i = 0; i < w * 6; i++) {
      const [tx, ty] = p.P(Rn() * w, 0.5, 16);
      px(p.c, tx, ty - 3, R.wood[2], 1, 4);
    }
    tufts(p, w, k.seed + 2, 4);
  },
  broken(p, k) {
    const w = k.w;
    const r = R.woodGrey;
    lineShadow(p, w, 14, 0.22);
    // a top rail with a missing span, a fallen rail in the grass, a leaning post
    tbox(p, 0, 0.47, w * 0.55, 0.06, 12.5, 2.4, { left: siding4(r, 5), right: siding4(r, 5), top: siding4(r, 5), edge: r[0] });
    tbox(p, 0, 0.47, w, 0.06, 6, 2.4, { left: siding4(r, 5), right: siding4(r, 5), top: siding4(r, 5), edge: r[0] });
    const posts = Math.round(w) + 1;
    for (let i = 0; i < posts; i++) {
      const a = Math.min(w - 0.06, (i * w) / (posts - 1) + 0.04);
      if (i === posts - 1) {
        // leaning post
        const [bx, by] = p.P(a, 0.5, 0);
        layer(p.c, (l) => {
          fillPoly(l, [[bx - 3, by], [bx + 3, by], [bx + 15, by - 58], [bx + 9, by - 60]], r[3]);
          fillPoly(l, [[bx + 1, by], [bx + 3, by], [bx + 15, by - 58], [bx + 13, by - 58]], r[1]);
        });
      } else post(p, a, 14 + hash(i, 1, k.seed) * 4, r);
    }
    const [fx0, fy0] = p.P(w * 0.5, 0.95, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[fx0 - 30, fy0 + 2], [fx0 + 34, fy0 - 10], [fx0 + 34, fy0 - 6], [fx0 - 30, fy0 + 6]], r[3]);
      fillPoly(l, [[fx0 - 30, fy0 + 5], [fx0 + 34, fy0 - 7], [fx0 + 34, fy0 - 6], [fx0 - 30, fy0 + 6]], r[1]);
    });
    // moss on the posts and lots of grass
    tufts(p, w, k.seed + 3, 6);
  },
};

function fenceRow(p: PropPainter, k: PropCtx) {
  const v = k.variant && FENCES[k.variant] ? k.variant : 'rail';
  FENCES[v](p, k);
}

function gate(p: PropPainter, k: PropCtx) {
  const w = k.w;
  const r = R.wood;
  lineShadow(p, w, 18);
  post(p, 0.05, 21, r);
  post(p, w - 0.05, 21, r);
  // ledged-and-braced gate leaf: vertical boards, two ledges, a Z brace, hinges and a latch
  const leaf = (a0: number, a1: number) => {
    const o = p.P(a0, 0.5, 2);
    const pu = p.P(a1, 0.5, 2);
    const pv = p.P(a0, 0.5, 17);
    texPara(p.c, o, [pu[0] - o[0], pu[1] - o[1]], [pv[0] - o[0], pv[1] - o[1]], boards4(r, 10, true)(1, 1, Math.hypot(pv[0] - o[0], pv[1] - o[1])));
    for (const z of [4, 14]) tbox(p, a0, 0.48, a1 - a0, 0.04, z, 2, flat(r));
    const [ax, ay] = p.P(a0 + 0.04, 0.48, 5);
    const [bx, by] = p.P(a1 - 0.04, 0.48, 14);
    layer(p.c, (l) => {
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        px(l, ax + (bx - ax) * t - 1, ay + (by - ay) * t, r[4], 3, 2);
      }
    });
    for (const z of [4.5, 14.5]) {
      const [hx, hy] = p.P(a0 + 0.02, 0.47, z);
      px(p.c, hx, hy - 1, R.iron[2], 7, 2);
    }
  };
  leaf(0.12, w - 0.12);
  const [lx, ly] = p.P(w - 0.16, 0.46, 10);
  px(p.c, lx - 2, ly - 2, R.iron[1], 5, 3);
  px(p.c, lx - 1, ly - 2, R.metal[4], 1, 1);
  tufts(p, w, k.seed + 7, 2);
}

// ── walls ───────────────────────────────────────────────────
const MOSS = R.oak;

function capStones(p: PropPainter, w: number, z: number, r: Ramp, seed: number, mossy = false) {
  const Rn = rng(seed);
  layer(p.c, (l) => {
    const n = Math.round(w * 5);
    for (let i = 0; i < n; i++) {
      const [x, y] = p.P((i + 0.5) / 5 + (Rn() - 0.5) * 0.05, 0.5, z);
      const rx = 7 + Rn() * 4;
      const ry = 4 + Rn() * 2;
      ell(l, x + 1, y + 1, rx, ry, r[1]);
      ell(l, x, y, rx, ry, r[3 + (Rn() > 0.6 ? 1 : 0)]);
      ell(l, x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4, r[5]);
      if (mossy && Rn() < 0.55) ell(l, x - 1, y - ry * 0.4, rx * 0.6, ry * 0.45, MOSS[3 + (Rn() > 0.5 ? 1 : 0)]);
    }
  });
}

const WALLS: Record<string, (p: PropPainter, k: PropCtx) => void> = {
  dry(p, k) {
    const w = k.w;
    lineShadow(p, w, 13, 0.3);
    const m = fieldStones4(R.stoneWarm, 11, 0.3, MOSS);
    tbox(p, 0, 0.22, w, 0.56, 0, 11, { left: m, right: m, top: fieldStones4(R.stoneWarm, 9, 0.4, MOSS), edge: R.stoneWarm[0] });
    capStones(p, w, 11.5, R.stoneWarm, k.seed);
    tufts(p, w, k.seed, 3);
  },
  cut(p, k) {
    const w = k.w;
    lineShadow(p, w, 13, 0.3);
    const m = cutStone4(R.stone, 11);
    tbox(p, 0, 0.24, w, 0.52, 0, 11, { left: m, right: m, top: cutStone4(R.stone, 14), edge: R.stone[0] });
    tbox(p, -0.03, 0.2, w + 0.06, 0.6, 11, 2.2, { left: cutStone4(R.stone, 40), right: cutStone4(R.stone, 40), top: cutStone4(R.stone, 30), edge: R.stone[0] });
    tufts(p, w, k.seed + 1, 2);
  },
  mossy(p, k) {
    const w = k.w;
    lineShadow(p, w, 13, 0.3);
    const m = fieldStones4(R.stone, 11, 0.6, MOSS);
    tbox(p, 0, 0.22, w, 0.56, 0, 11, { left: m, right: m, top: fieldStones4(R.stone, 9, 0.8, MOSS), edge: R.stone[0] });
    capStones(p, w, 11.5, R.stone, k.seed, true);
    // ivy draping over the top and down the face, ferns at the foot
    const Rn = rng(k.seed + 5);
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let i = 0; i < w * 3; i++) {
        const [x, y] = p.P(Rn() * w, 0.75, 6 + Rn() * 8);
        masses.push({ x, y, rx: 6 + Rn() * 6, ry: 5 + Rn() * 6, z: y });
      }
      foliage(l, masses, R.oak, k.seed, { cell: 3.4, tilt: 0.2 });
    });
    tufts(p, w, k.seed + 2, 5);
  },
  ruin(p, k) {
    const w = k.w;
    lineShadow(p, w, 9, 0.26);
    const m = fieldStones4(R.stoneWarm, 11, 0.45, MOSS);
    const segs = Math.max(2, Math.round(w * 2));
    for (let i = 0; i < segs; i++) {
      if (hash(i, 1, k.seed) < 0.2) continue;
      const a0 = (i / segs) * w;
      const h = 4 + hash(i, 2, k.seed) * 9;
      tbox(p, a0, 0.24, w / segs + 0.01, 0.52, 0, h, { left: m, right: m, top: fieldStones4(R.stoneWarm, 9, 0.6, MOSS), edge: R.stoneWarm[0] });
    }
    // tumbled stones in the grass
    const Rn = rng(k.seed + 9);
    layer(p.c, (l) => {
      for (let i = 0; i < w * 3; i++) {
        const [x, y] = p.P(Rn() * w, 0.95 + Rn() * 0.2, 0);
        const rx = 5 + Rn() * 4;
        ell(l, x + 1, y, rx, rx * 0.6, R.stoneWarm[1]);
        ell(l, x, y - 1, rx, rx * 0.55, R.stoneWarm[3]);
        ell(l, x - rx * 0.3, y - rx * 0.35, rx * 0.4, rx * 0.25, R.stoneWarm[5]);
      }
    });
    tufts(p, w, k.seed + 4, 6);
  },
  brick(p, k) {
    const w = k.w;
    lineShadow(p, w, 13, 0.3);
    const m = bricks4(R.brick);
    tbox(p, 0, 0.3, w, 0.4, 0, 12, { left: m, right: m, top: bricks4(R.brick), edge: R.brick[0] });
    tbox(p, -0.03, 0.26, w + 0.06, 0.48, 12, 2, { left: cutStone4(R.stoneWarm, 40), right: cutStone4(R.stoneWarm, 40), top: cutStone4(R.stoneWarm, 30), edge: R.stoneWarm[0] });
    // a plant growing from a gap in the mortar
    const [gx, gy] = p.P(w * (0.3 + hash(1, 1, k.seed) * 0.4), 0.7, 6);
    layer(p.c, (l) => leafBlades(l, gx, gy, 6, R.birch, k.seed, 8, 6), { outline: 0.5 });
    tufts(p, w, k.seed + 5, 2);
  },
};

function stoneWall(p: PropPainter, k: PropCtx) {
  const alias: Record<string, string> = { flowers: 'mossy' };
  const v = k.variant && WALLS[k.variant] ? k.variant : alias[k.variant ?? ''] ?? 'dry';
  WALLS[v](p, k);
}

export const FENCE_VARIANTS = Object.keys(FENCES);
export const WALL_VARIANTS = Object.keys(WALLS);

export const STRUCTURES: Record<string, PropArt> = {
  fenceRow: { draw: fenceRow },
  gate: { draw: gate },
  stoneWall: { draw: stoneWall },
};

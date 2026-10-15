// Data Center — the snowy north round the site (1 z ≈ 10 cm).
//   dc_spruce    Norway spruce: tiers of drooping branches, each loaded with snow
//   dc_pine      Scots pine: a tall bare trunk, orange high up, a flat snowy crown
//   dc_birch     a winter birch: white bark with black marks, a purple haze of twigs
//   dc_shrub     juniper, willow or heather half buried in snow
//   dc_mound     drifts and snow-covered humps
//   dc_rock      granite boulders with snow caps and lichen
//   dc_snowbank  the ridge of snow the plough throws up along the roads
//   dc_reeds     dry reeds and grass stalks standing out of the snow on the shore
//   dc_ridge     a snowy ridge with rock outcrops and spruces, wind turbines on its crest
import { mix } from '../../../color';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { parseColor } from '../../../hd/soft';
import { bayer, contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng, soft } from '../../kit4';
import { anchor } from '../util';
import { BARKD, BARKR, BIRCH, HEATH, PINEG, ROCK, SNOW, SPRUCE } from './palette';
import { driftLine, snowMasses } from './room';

type C = CanvasRenderingContext2D;
const clampI = (i: number, n: number) => {
  const r = Math.round(i);
  return r >= n ? n - 1 : r >= 0 ? r : 0;
};

// ── spruce ──────────────────────────────────────────────────
/**
 * A snowy Norway spruce drawn at (x, y) (its foot) into `c`: stacked tiers of
 * drooping branches, bottom first; each tier's visible band shows snow lying on
 * the branches' upper side and the dark needles of the drooping tips under it.
 * Lit from the upper left. `s` scales the tree.
 */
export function drawSpruce(c: C, x: number, y: number, s: number, seed: number) {
  const Rn = rng(seed * 131 + 7);
  const H = 280 * s;
  const W = 64 * s * (0.9 + Rn() * 0.2);
  const tiers = 8 + Math.floor(Rn() * 3);
  // the trunk under the lowest skirt
  for (let j = 0; j < 22 * s; j++) for (let i = -4; i < 4; i++) px(c, x + i, y - j, BARKD[i < -1 ? 4 : i < 2 ? 3 : 2]);
  const base = y - 14 * s;
  let apex = base;
  for (let t = 0; t < tiers; t++) {
    const f0 = t / tiers;
    const hem = base - f0 * (H - 34 * s) * 0.94;
    const top = hem - H * (0.2 - f0 * 0.06);
    apex = Math.min(apex, top);
    const hw = W * Math.pow(1 - f0, 0.92) * (0.88 + Rn() * 0.24) + 4 * s;
    const snowLine = 0.5 + Rn() * 0.14;
    const ph = Rn() * 10;
    const y0 = Math.floor(top);
    const y1 = Math.ceil(hem + 8 * s);
    for (let py = y0; py <= y1; py++) {
      const dy = (py - top) / (hem - top);
      if (dy < 0) continue;
      const half = hw * (0.16 + 0.84 * Math.min(1, Math.pow(Math.min(dy, 1), 0.75)));
      for (let pxi = Math.floor(x - half - 3); pxi <= Math.ceil(x + half + 3); pxi++) {
        const nx = (pxi - x) / Math.max(1, half);
        if (nx < -1 || nx > 1) continue;
        // the hem: drooping branch tips at intervals, a jagged line between them
        const tip = Math.max(0, Math.sin(pxi * 0.42 / s + ph)) ** 6 * 7 * s;
        const hemHere = hem + tip + (hash(pxi, t, seed) - 0.5) * 2.2 - Math.abs(nx) ** 3 * 5 * s;
        if (py > hemHere) continue;
        const ldy = (py - top) / (hemHere - top);
        // snow on the upper side of the branches in heavy clumps, breaking up toward the tips
        const clump = hash(Math.floor(pxi / 4), Math.floor(py / 3), seed + t * 7);
        const snowEdge = snowLine + Math.sin(pxi * 0.31 + ph) * 0.1 + (clump - 0.5) * 0.3 - nx * 0.08;
        let col: string;
        if (ldy < snowEdge) {
          let v = 5.3 - nx * 1.2 - ldy * 1.0;
          if (ldy > snowEdge - 0.1) v -= 1.6; // the snow's own shadowed lip
          if (hash(pxi, py, seed + 3) < 0.03) v += 1;
          col = SNOW[clampI(v + (bayer(pxi, py) - 0.5) * 0.7, 7)];
        } else {
          let v = 3.5 - nx * 1.6 - (ldy - snowEdge) * 2.6;
          if (hash(pxi, Math.floor(py / 3), seed + 5) < 0.2) v -= 1;
          if (ldy > 0.88) v -= 1;
          col = SPRUCE[clampI(v + (bayer(pxi, py) - 0.5) * 0.7, 7)];
          // flakes caught in the needles
          if (hash(pxi >> 1, py >> 1, seed + 9) < 0.05 && ldy < 0.8) col = SNOW[nx < 0.2 ? 6 : 4];
        }
        c.fillStyle = col;
        c.fillRect(pxi, py, 1, 1);
      }
    }
    // snow clumps sitting on the drooping tips
    for (let i = 0; i < 5 + hw / 7; i++) {
      const tx = x + (Rn() - 0.5) * hw * 1.8;
      const ty = hem - 2 + Rn() * 3;
      px(c, tx - 3, ty - 2, SNOW[tx < x ? 6 : 5], 5, 2);
      px(c, tx - 2, ty, SNOW[tx < x ? 4 : 3], 4, 1);
    }
  }
  // the leader rising from the top tier, a tuft of snow on it
  const tipY = Math.round(apex) + 3;
  const L = Math.round(14 * s);
  for (let j = 0; j < L; j++) px(c, x - (j < L * 0.45 ? 1 : 0), tipY - j, j < 3 ? SPRUCE[2] : SPRUCE[3 + (j & 1)], j < L * 0.45 ? 2 : 1, 1);
  px(c, x - 1, tipY - L + 2, SNOW[6], 2, 2);
}

const dc_spruce: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const s = (0.82 + hash(k.seed, 1, 3) * 0.4) * (k.variant === 'big' ? 1.3 : 1);
    contactShadow(p.c, x + 30 * s, y + 6, 70 * s, 16 * s, 0.3);
    layer(p.c, (l) => drawSpruce(l, x, y, s, k.seed), { outline: 0.55, rect: [x - 80 * s, y - 340 * s - 10, x + 80 * s, y + 8] });
  },
};

const PINEBARK: Ramp = ['#2c221c', '#3e3028', '#544236', '#6a5444', '#806654', '#967a66'];

// ── Scots pine ──────────────────────────────────────────────
const dc_pine: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 97 + 3);
    const s = (0.86 + Rn() * 0.3) * (k.variant === 'big' ? 1.25 : 1);
    const H = 330 * s;
    const lean = (Rn() - 0.5) * 14;
    contactShadow(p.c, x + 40 * s, y + 6, 74 * s, 18 * s, 0.28);
    layer(p.c, (l) => {
      // the trunk: grey-brown and plated low down, flaking orange in the crown
      const top = H * 0.78;
      for (let j = 0; j < top; j++) {
        const t = j / top;
        const ww = 13 * s * (1 - t * 0.55);
        const cx = x + lean * t * t;
        for (let i = 0; i < ww; i++) {
          const u = i / ww;
          const high = t > 0.38 + (bayer(i, j) - 0.5) * 0.16;
          const r = high ? BARKR : PINEBARK;
          let tone = u < 0.25 ? 4 : u < 0.55 ? 3 : u < 0.8 ? 2 : 1;
          // fissured plates low down, papery flakes high up
          if (!high && hash(Math.floor((cx - ww / 2 + i) / 3), Math.floor((y - j) / 5), k.seed) < 0.22) tone -= 1;
          if (high && hash(Math.floor((cx - ww / 2 + i) / 2), Math.floor((y - j) / 3), k.seed + 1) < 0.12) tone += 1;
          px(l, cx - ww / 2 + i, y - j, r[Math.max(0, Math.min(r.length - 1, tone))]);
        }
        // snow plastered on the windward (left) side of the lower trunk
        if (t < 0.4 && hash(j >> 2, 3, k.seed) < 0.5) px(l, cx - ww / 2, y - j, SNOW[5], 2, 1);
      }
      // a few bare limbs, then the crown: flat clumps of needles, each carrying a slab of snow
      const cy = y - top;
      const masses: Mass[] = [];
      const n = 5 + Math.floor(Rn() * 3);
      // the crown keeps within ~100 px of the trunk on the left (the sprite's box ends 112 px left of its foot)
      const reach = Math.min(44 * s, 50);
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * 2;
        const mx = x + lean + a * reach + (Rn() - 0.5) * 12;
        const my = cy + 6 * s + Math.abs(a) * 8 * s - Rn() * 34 * s;
        masses.push({ x: mx, y: my, rx: Math.min((20 + Rn() * 12) * s, 36), ry: (10 + Rn() * 6) * s, z: -my });
        ln(l, x + lean * 0.8, cy + 16 * s, mx, my + 6 * s, BARKR[2], Math.max(1, Math.round(3 * s)));
      }
      masses.push({ x: x + lean, y: cy - 34 * s, rx: 30 * s, ry: 14 * s, z: 99 });
      foliage(l, masses, PINEG, k.seed, { cell: 5, tilt: 0.2, holes: 0.06 });
      // snow lying on top of each clump, in a few soft lumps
      const caps: Mass[] = [];
      for (const m of masses) for (let j = 0; j < 3; j++) caps.push({ x: m.x - m.rx * 0.45 + j * m.rx * 0.38, y: m.y - m.ry * 0.62 + (j === 1 ? -1 : 0), rx: m.rx * 0.34, ry: Math.max(2.5, m.ry * 0.28), z: m.z! + j * 0.01 });
      snowMasses(l, caps, k.seed + 1);
    }, { outline: 0.55, rect: [x - 100 * s, y - H - 40, x + 110 * s, y + 8] });
  },
};

// ── winter birch ────────────────────────────────────────────
const dc_birch: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 113 + 9);
    const s = 0.8 + Rn() * 0.3;
    const H = 220 * s;
    contactShadow(p.c, x + 24 * s, y + 5, 40 * s, 10 * s, 0.24);
    layer(p.c, (l) => {
      // two stems leaning apart, white with black lenticels and dark cracked bark at the foot
      const stems = Rn() < 0.6 ? 2 : 1;
      const tops: [number, number][] = [];
      for (let st = 0; st < stems; st++) {
        const off = (st - (stems - 1) / 2) * 7 * s;
        const lean = (st - (stems - 1) / 2) * 22 * s + (Rn() - 0.5) * 8;
        const h = H * (0.62 + Rn() * 0.1);
        for (let j = 0; j < h; j++) {
          const t = j / h;
          const ww = (8 - st * 2) * s * (1 - t * 0.6) + 1;
          const cx = x + off + lean * t * t;
          for (let i = 0; i < ww; i++) {
            const u = i / ww;
            let col = BIRCH[u < 0.3 ? 5 : u < 0.7 ? 4 : 3];
            if (j < 14 * s && hash(Math.floor((cx + i) / 2), j >> 1, k.seed) < 0.5) col = BARKD[2];
            else if (hash(Math.floor((cx + i) / 3), Math.floor((y - j) / 2), k.seed + st) < 0.1) col = BIRCH[0];
            px(l, cx - ww / 2 + i, y - j, col);
          }
        }
        tops.push([x + off + lean, y - h]);
      }
      // the crown: limbs forking into a haze of fine purple-brown twigs, a little snow on the limbs
      const twig = (x0: number, y0: number, ang: number, len: number, depth: number, w: number) => {
        const x1 = x0 + Math.cos(ang) * len;
        const y1 = y0 + Math.sin(ang) * len;
        if (x1 < x - 104) return; // the sprite's box ends 112 px left of the foot
        ln(l, x0, y0, x1, y1, depth > 2 ? '#86767a' : depth > 1 ? '#706266' : BIRCH[2], Math.max(1, Math.round(w)));
        if (depth < 2 && w > 1) px(l, x0 + (x1 - x0) * 0.4, y0 + (y1 - y0) * 0.4 - 1, SNOW[6], 2, 1);
        if (depth >= 4) {
          if (Rn() < 0.45) ln(l, x1, y1, x1 + (Rn() - 0.5) * 3, y1 + 4 + Rn() * 4, Rn() < 0.5 ? '#a8989a' : Rn() < 0.5 ? SNOW[5] : '#6a5c60');
          return;
        }
        const n = depth < 2 ? 3 : 2;
        for (let i = 0; i < n; i++) twig(x1, y1, ang + (Rn() - 0.5) * 1.1 - 0.05, len * (0.6 + Rn() * 0.15), depth + 1, w * 0.6);
      };
      for (const [tx, ty] of tops) for (let i = 0; i < 5; i++) twig(tx, ty + 30 * s, -Math.PI / 2 + (i - 2) * 0.34 + (Rn() - 0.5) * 0.24, (28 + Rn() * 14) * s, 0, 3 * s);
    }, { outline: 0.5, rect: [x - 110, y - H * 1.5, x + 130, y + 6] });
  },
};

// ── shrubs, mounds, rocks ───────────────────────────────────
const dc_shrub: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 7 + 1);
    const kind = k.variant ?? ['juniper', 'willow', 'heather'][k.seed % 3];
    contactShadow(p.c, x + 10, y + 3, 26, 7, 0.22);
    layer(p.c, (l) => {
      if (kind === 'juniper') {
        // a dark juniper under a heavy cushion of snow, green showing on its shaded flank
        foliage(l, [{ x: x + 2, y: y - 12, rx: 22, ry: 13, z: 1 }, { x: x - 10, y: y - 8, rx: 14, ry: 9, z: 2 }], SPRUCE, k.seed, { cell: 3.4 });
        snowMasses(l, [{ x: x - 2, y: y - 18, rx: 20, ry: 9, z: 3 }, { x: x - 12, y: y - 12, rx: 11, ry: 6, z: 4 }], k.seed + 1);
      } else if (kind === 'willow') {
        // red-brown willow stems rising out of a drift
        snowMasses(l, [{ x, y: y - 5, rx: 24, ry: 8, z: 1 }], k.seed);
        for (let i = 0; i < 14; i++) {
          const bx = x - 14 + i * 2.2 + (Rn() - 0.5) * 2;
          const h = 18 + Rn() * 26;
          const lean = (i - 7) * 0.9;
          ln(l, bx, y - 6, bx + lean, y - 6 - h, i % 3 === 0 ? '#6e4a3a' : '#5a3e32');
          px(l, bx + lean, y - 7 - h, '#8a6a58');
        }
      } else {
        // a tussock of brown heather poking through thin snow
        snowMasses(l, [{ x, y: y - 3, rx: 20, ry: 6, z: 1 }], k.seed);
        for (let i = 0; i < 22; i++) {
          const bx = x - 16 + Rn() * 32;
          const h = 4 + Rn() * 9;
          ln(l, bx, y - 3, bx + (Rn() - 0.5) * 4, y - 3 - h, HEATH[2 + Math.floor(Rn() * 3)]);
        }
      }
    }, { outline: 0.5, rect: [x - 34, y - 54, x + 34, y + 6] });
  },
};

const dc_mound: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 11 + 5);
    const big = k.variant === 'big' || Rn() < 0.35;
    const m: Mass[] = [];
    const n = big ? 4 : 2;
    for (let i = 0; i < n; i++) m.push({ x: x - 14 + Rn() * 28, y: y - 4 - Rn() * (big ? 10 : 4), rx: (big ? 26 : 16) + Rn() * 12, ry: (big ? 10 : 6) + Rn() * 4, z: i });
    contactShadow(p.c, x + 12, y + 3, big ? 40 : 26, big ? 9 : 6, 0.16);
    layer(p.c, (l) => snowMasses(l, m, k.seed), { outline: 0.4, rect: [x - 60, y - 40, x + 60, y + 10] });
  },
};

/**
 * A faceted granite lump: the ellipse's surface broken into flat facets (sectors round
 * a top face), each lit by its own normal from the upper left, so it reads as cut
 * rock rather than a round blob; darker toward its foot and its outline.
 */
function rockMass(c: C, q: Mass, seed: number) {
  const nSec = 6 + Math.floor(hash(seed, 1, 3) * 3);
  const rot = hash(seed, 2, 3) * 6.28;
  const x0 = Math.floor(q.x - q.rx);
  const x1 = Math.ceil(q.x + q.rx);
  const y0 = Math.floor(q.y - q.ry);
  const y1 = Math.ceil(q.y + q.ry);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - q.x) / q.rx;
      const ny = (y + 0.5 - q.y) / q.ry;
      // a blocky, slightly lumpy outline (a superellipse)
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const r = Math.cbrt(ax * ax * ax + ay * ay * ay);
      const wob = 1 + (hash(Math.floor((Math.atan2(ny, nx) + 4) * 3), 5, seed) - 0.5) * 0.12;
      if (r > wob) continue;
      let fnx: number;
      let fny: number;
      let fnz: number;
      if (r < 0.38 + hash(seed, 4, 3) * 0.12 && ny < 0.1) {
        // the top facet
        fnx = -0.1;
        fny = -0.3;
        fnz = 0.95;
      } else {
        const ang = Math.atan2(ny, nx) - rot;
        const sec = Math.floor(((ang / 6.2832) % 1 + 1) % 1 * nSec);
        const ca = ((sec + 0.5) / nSec) * 6.2832 + rot + (hash(sec, 6, seed) - 0.5) * 0.4;
        fnx = Math.cos(ca) * 0.8;
        fny = Math.sin(ca) * 0.8;
        fnz = 0.5;
      }
      let t = 3.0 + (-fnx * 0.75 - fny * 0.55 + fnz * 0.6) * 2.6;
      if (ny > 0.3) t -= (ny - 0.3) * 1.6;
      if (r > 0.9) t -= 0.8;
      if (hash(x, y, seed + 9) < 0.05) t += 0.8;
      else if (hash(x, y, seed + 10) < 0.04) t -= 0.8;
      px(c, x, y, ROCK[clampI(t + (bayer(x, y) - 0.5) * 0.6, 7)]);
    }
}

const dc_rock: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 17 + 3);
    // 'shore': a big granite boulder on the fjord's edge under a thick pillow of snow
    const big = k.variant === 'shore';
    const s = big ? 1.8 + Rn() * 0.7 : 0.7 + Rn() * 0.7;
    contactShadow(p.c, x + 14 * s, y + 3, 32 * s, 9 * s, big ? 0.4 : 0.3);
    const m: Mass[] = [{ x, y: y - 10 * s, rx: 22 * s, ry: 13 * s, z: 1 }, { x: x + (Rn() - 0.5) * 20 * s, y: y - 6 * s, rx: 15 * s, ry: 8 * s, z: 2 }];
    if (Rn() < 0.5 || big) m.push({ x: x + 16 * s, y: y - 4 * s, rx: 10 * s, ry: 6 * s, z: 3 });
    layer(p.c, (l) => {
      [...m].sort((a, b) => a.z! - b.z!).forEach((q, i) => rockMass(l, q, k.seed * 7 + i));
      // dark cracks down the faces, grey-green lichen rosettes, then the snow on the tops
      for (let i = 0; i < 3 + (big ? 3 : 0); i++) {
        const cx = x - 16 * s + Rn() * 30 * s;
        const cy = y - 12 * s + Rn() * 6 * s;
        ln(l, cx, cy, cx + (Rn() - 0.5) * 4, cy + 5 + Rn() * 6 * s, ROCK[0]);
      }
      for (let i = 0; i < 6; i++) px(l, x - 14 * s + Rn() * 28 * s, y - 4 * s - Rn() * 12 * s, Rn() < 0.5 ? '#8a9a7a' : '#a8b08a', 2, 1);
      const cap = big ? 0.46 : 0.42;
      snowMasses(l, m.map((q, i) => ({ x: q.x - 2 * s, y: q.y - q.ry * (big ? 0.62 : 0.62), rx: q.rx * (big ? 0.8 : 0.78), ry: q.ry * cap, z: 10 + i })), k.seed + 2);
    }, { outline: 0.6, rect: [x - 50 * s, y - 40 * s, x + 50 * s, y + 6] });
  },
};

/**
 * A granite crag breaking out of the forest floor: a few blocky outcrops of grey rock,
 * steep faces split by dark joints and lit on their left, every ledge and top under a
 * thick cushion of snow, drifts banked against its foot.
 */
const dc_crag: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 53 + 11);
    const W = k.w;
    const D = k.d;
    const [cx, cy] = p.P(W / 2, D / 2, 0);
    const R = (W + D) * 22;
    contactShadow(p.c, cx + R * 0.3, cy + 10, R * 1.2, R * 0.45, 0.36);
    // the rock: tiers of big chunky lumps, the lower ones wide and in front, the upper ones stacked behind
    const m: Mass[] = [];
    const sc = R / 96;
    for (let t = 0; t < 3; t++) {
      const n = 4 - t + Math.floor(Rn() * 2);
      const span = R * (1.2 - t * 0.3);
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        m.push({ x: cx + f * span * 1.9 + (Rn() - 0.5) * 14 - t * 6, y: cy - 4 - t * 40 * sc + Math.abs(f) * 18 + (Rn() - 0.5) * 6, rx: (34 - t * 4 + Rn() * 12) * sc, ry: (32 - t * 2 + Rn() * 10) * sc, z: -t * 10 - Math.abs(f) * 2 + i * 0.01 });
      }
    }
    m.sort((q, r) => q.z! - r.z!);
    let y0 = Infinity;
    for (const q of m) y0 = Math.min(y0, q.y - q.ry);
    layer(p.c, (l) => {
      m.forEach((q, qi) => {
        rockMass(l, q, k.seed * 13 + qi);
        // joints running down the face, each with a lit lip, a bedding line across
        for (let j = 0; j < 3; j++) {
          const jx = q.x - q.rx * 0.6 + Rn() * q.rx * 1.2;
          const jy = q.y - q.ry * 0.35 + Rn() * q.ry * 0.3;
          const len = q.ry * (0.5 + Rn() * 0.6);
          ln(l, jx, jy, jx + (Rn() - 0.5) * 6, jy + len, ROCK[0]);
          ln(l, jx - 1, jy, jx - 1 + (Rn() - 0.5) * 2, jy + len * 0.6, ROCK[5]);
        }
        const by = q.y + q.ry * (0.15 + Rn() * 0.3);
        ln(l, q.x - q.rx * 0.7, by, q.x + q.rx * 0.5, by + 3, ROCK[1]);
        for (let i = 0; i < 3; i++) px(l, q.x - q.rx * 0.6 + Rn() * q.rx, q.y - Rn() * q.ry * 0.5, Rn() < 0.5 ? '#7e8e72' : '#9aa684', 2, 1);
        // its cap of snow, thick on the crown, a little lip over the face
        snowMasses(l, [
          { x: q.x - q.rx * 0.1, y: q.y - q.ry * 0.72, rx: q.rx * 0.78, ry: Math.max(4, q.ry * 0.34), z: 1 },
          { x: q.x - q.rx * 0.42, y: q.y - q.ry * 0.5, rx: q.rx * 0.34, ry: Math.max(3, q.ry * 0.2), z: 2 },
        ], k.seed + qi * 7);
      });
    }, { outline: 0.6, rect: [cx - R * 2, y0 - 30, cx + R * 2, cy + R * 0.7] });
  },
};

const dc_snowbank: PropArt = {
  draw(p, k) {
    // a long ridge of ploughed snow: lumpy on top, grey with road spray on the road side, blue in its lee
    const W = k.w;
    const Rn = rng(k.seed * 23 + 1);
    const roadSide = 0.15;
    // 'big': the high bank further from the road, a ridge of old ploughed snow
    const big = k.variant === 'big';
    driftLine(p, -0.08, W + 0.08, big ? 0.55 : 0.5, 0, big ? 12 : 7, big ? k.seed : 3, false, false);
    const [sx0, sy0] = p.P(0, 1, 0);
    const [sx1, sy1] = p.P(W, 0, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 30 * W; i++) {
        const a = Rn() * W;
        const [x, y] = p.P(a, roadSide + Rn() * 0.25, 1 + Rn() * 5);
        px(l, x, y, Rn() < 0.5 ? '#7a7670' : '#9a948c', Rn() < 0.3 ? 2 : 1, 1);
      }
    }, { outline: false, rect: [Math.min(sx0, sx1) - 30, Math.min(sy0, sy1) - 50, Math.max(sx0, sx1) + 30, Math.max(sy0, sy1) + 10] });
  },
};

const dc_reeds: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 29 + 7);
    layer(p.c, (l) => {
      for (let i = 0; i < 18; i++) {
        const bx = x - 18 + Rn() * 36;
        const by = y - 2 + Rn() * 6;
        const h = 16 + Rn() * 26;
        const lean = (Rn() - 0.3) * 8;
        ln(l, bx, by, bx + lean, by - h, Rn() < 0.5 ? '#b89a5a' : '#9a7e46');
        if (Rn() < 0.4) {
          ell(l, bx + lean, by - h - 3, 1.5, 4, '#6a4a2a');
          px(l, bx + lean - 1, by - h - 7, SNOW[6], 3, 1);
        }
      }
      snowMasses(l, [{ x, y: y - 1, rx: 20, ry: 4, z: 1 }], k.seed);
    }, { outline: 0.4, rect: [x - 30, y - 56, x + 30, y + 8] });
  },
};

// ── a snow fence on the open field: grey slats on posts, the drift it gathers ──
const SLAT: Ramp = ['#3a3430', '#4e4640', '#645a52', '#7a7066', '#92867a', '#a89c90'];
const dc_snowfence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Hf = 15;
    const b = 0.45;
    // the drift on the lee side first (behind the slats from the camera's side it shows through the gaps)
    driftLine(p, 0.05, W - 0.05, b + 0.22, 0, 6, k.seed + 3);
    const c = p.c;
    // posts every 1.5 tiles with a brace, two rails, slats with gaps between (a few missing, a few leaning)
    for (let a = 0.05; a <= W; a += 1.5) {
      const [x0, y0] = p.P(a, b, 0);
      const [x1, y1] = p.P(a, b, Hf + 2);
      ln(c, x0, y0, x1, y1, SLAT[1], 3);
      ln(c, x0 - 1, y0, x1 - 1, y1, SLAT[3]);
      const [bx, by] = p.P(a, b - 0.4, 0);
      ln(c, bx, by, x1, y1 + 14, SLAT[1], 2);
      px(c, x1 - 2, y1 - 2, SNOW[6], 4, 2);
    }
    for (const z of [3, 12]) {
      const [x0, y0] = p.P(0, b, z);
      const [x1, y1] = p.P(W, b, z);
      ln(c, x0, y0, x1, y1, SLAT[2], 2);
    }
    const Rn = rng(k.seed * 13 + 1);
    const n = Math.round(W * 9);
    for (let i = 0; i < n; i++) {
      if (Rn() < 0.06) continue;
      const a = (i + 0.5) * (W / n);
      const lean = Rn() < 0.05 ? 0.12 : 0;
      const [x0, y0] = p.P(a, b + 0.01, 1 + Rn() * 0.6);
      const [x1, y1] = p.P(a + lean, b + 0.01, Hf - Rn() * 0.8);
      ln(c, x0, y0, x1, y1, SLAT[3 + (i % 2)], 2);
      ln(c, x0 + 1, y0, x1 + 1, y1, SLAT[1]);
      if (Rn() < 0.5) px(c, x1, y1 - 1, SNOW[6], 2, 1);
    }
    // the windward foot buried in a low bank
    driftLine(p, 0, W, b + 0.06, 0, 3, k.seed);
  },
};

// ── the ridge and its wind turbines ─────────────────────────
const TOWER = 150;
interface Dome {
  x: number;
  y: number;
  top: number;
  rx: number;
  ry: number;
  turbine: boolean;
}

/** The rotor hub of a dome's turbine in screen px (the same point in draw and anim, at any zoom). */
function turbineHub(p: PropPainter, d: Dome): [number, number] {
  const u = p.k / 4;
  const x = d.x - d.rx * 0.08;
  return [x + 31 * u, d.top + 10 * u - TOWER * 4 * u - 4 * u];
}

/** The ridge as a line of snow domes along its axis (local b), highest in the middle; some carry a turbine. */
function ridgeDomes(p: PropPainter, k: PropCtx): Dome[] {
  const W = k.w;
  const D = k.d;
  const Rn = rng(k.seed * 7 + 11);
  const north = k.variant === 'north';
  const u = p.k / 4;
  const n = Math.max(4, Math.round(D / 1.6));
  const out: Dome[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const b = 0.6 + t * (D - 1.2);
    const a = W * 0.5 + Math.sin(b * 0.55 + k.seed) * 0.5;
    const z = (10 + 22 * Math.sin(Math.PI * t) ** 0.8) * (0.85 + Rn() * 0.3);
    const [gx, gy] = p.P(a, b, 0);
    // in screen px at the painter's own scale (the anim runs at the view's zoom, not at k = 4)
    const H = z * 4 * u;
    const ry = (H + 46 * u) / 2;
    const turbine = k.variant === 'plain' ? false : k.variant === 'long' ? i === Math.floor(n * 0.15) || i === Math.floor(n * 0.5) || i === Math.floor(n * 0.85) : north ? i === Math.floor(n / 2) : i === Math.floor(n * 0.3) || i === Math.floor(n * 0.72);
    out.push({ x: gx, y: gy - H + ry, top: gy - H, rx: 190 * u + H * 0.3, ry, turbine });
  }
  return out;
}

/** A small granite outcrop breaking the snow: dark lumps, lit on their upper left, capped with snow. */
function outcrop(c: C, x: number, y: number, s: number, seed: number) {
  const Rn = rng(seed);
  const parts: Mass[] = [];
  for (let i = 0; i < 3; i++) parts.push({ x: x + (Rn() - 0.5) * 22 * s, y: y - Rn() * 6 * s, rx: (8 + Rn() * 8) * s, ry: (5 + Rn() * 4) * s, z: i });
  foliage(c, parts, ROCK, seed, { cell: 5 * s, tilt: 0.1 });
  snowMasses(c, parts.map((q, i) => ({ x: q.x - 1, y: q.y - q.ry * 0.6, rx: q.rx * 0.7, ry: Math.max(2, q.ry * 0.35), z: 10 + i })), seed + 1);
}

/**
 * A snowy hill from overlapping domes: each pixel takes the normal of the front-most
 * dome, lit from the upper left; toward each dome's foot the tone eases into the
 * ground snow's, so the hill rises out of the field instead of sitting on it. Only
 * the upper silhouette gets a fine line. Written straight into the CPU layer.
 */
function hill(c: C, masses: Mass[], seed: number) {
  const sc = soft(c);
  if (!sc) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of masses) {
    x0 = Math.min(x0, Math.floor(m.x - m.rx));
    x1 = Math.max(x1, Math.ceil(m.x + m.rx));
    y0 = Math.min(y0, Math.floor(m.y - m.ry));
    y1 = Math.max(y1, Math.ceil(m.y + m.ry));
  }
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const front = new Int16Array(W * H).fill(-1);
  masses.forEach((m, mi) => {
    for (let y = Math.floor(m.y - m.ry); y <= m.y + m.ry; y++) {
      const ny = (y + 0.5 - m.y) / m.ry;
      if (ny <= -1 || ny >= 1) continue;
      const hw = m.rx * Math.sqrt(1 - ny * ny);
      for (let x = Math.round(m.x - hw); x < Math.round(m.x + hw); x++) {
        const k = (y - y0) * W + (x - x0);
        const cur = front[k];
        if (cur < 0 || (masses[cur].z ?? 0) <= (m.z ?? 0)) front[k] = mi;
      }
    }
  });
  const PK = SNOW.map((q) => (parseColor(q) | 0xff000000) >>> 0);
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const k = (y - y0) * W + (x - x0);
      const mi = front[k];
      if (mi < 0) continue;
      const m = masses[mi];
      const nx = (x + 0.5 - m.x) / m.rx;
      const ny = (y + 0.5 - m.y) / m.ry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lit = -nx * 0.6 - ny * 0.25 + nz * 0.2;
      const foot = ny > 0 ? Math.min(1, ny * 1.25) ** 2 : 0;
      let t = (4.7 + lit * 2.4) * (1 - foot) + 4.75 * foot;
      // the line where this dome passes behind the one in front of it, on the lower right
      const above = y > y0 ? front[k - W] : -1;
      const top = above < 0;
      if (top && ny < 0.2) t = nx > 0 ? 3.4 : 5.6;
      if (hash(x, y, seed) > 0.995) t = 6;
      const tone = Math.round(t + (bayer(x, y) - 0.5) * 0.7);
      const xx = x - sc.ox;
      const yy = y - sc.oy;
      if (xx < 0 || yy < 0 || xx >= sc.width || yy >= sc.height) continue;
      sc.data[yy * sc.width + xx] = PK[tone < 0 ? 0 : tone > 6 ? 6 : tone];
      if (xx < bx0) bx0 = xx;
      if (xx > bx1) bx1 = xx;
      if (yy < by0) by0 = yy;
      if (yy > by1) by1 = yy;
    }
  if (bx1 >= bx0) sc.touch(bx0, by0, bx1 + 1, by1 + 1);
}

const dc_ridge: PropArt = {
  draw(p, k) {
    const c = p.c;
    const domes = ridgeDomes(p, k);
    const Rn = rng(k.seed * 41 + 3);
    // the domes as one smooth hill whose foot melts into the snow around it
    hill(c, domes.map((d, i) => ({ x: d.x, y: d.y, rx: d.rx, ry: d.ry, z: i })), k.seed);
    domes.forEach((d) => {
      // wind-scoured streaks running down its shaded flank
      for (let i = 0; i < 7; i++) {
        const t = (i + Rn()) / 7;
        const sx = d.x + d.rx * (0.05 + t * 0.7);
        const sy = d.y - d.ry * (0.55 - t * 0.6);
        ln(c, sx, sy, sx + 16 + Rn() * 20, sy + 10 + Rn() * 8, SNOW[3]);
      }
      // outcrops on the steeper sides, then the spruces standing on the slope, back to front
      const items: [number, number, number][] = [];
      for (let i = 0; i < 3; i++) items.push([d.x + d.rx * (0.15 + Rn() * 0.6), d.y - d.ry * (0.2 + Rn() * 0.5), 0]);
      for (let i = 0; i < 4; i++) {
        const fx = (Rn() - 0.5) * 1.6;
        const fy = -0.75 + Rn() * 1.1;
        if (fx * fx + fy * fy * 1.4 > 0.8) continue;
        if (d.turbine && Math.abs(fx) < 0.35 && fy < -0.3) continue;
        items.push([d.x + fx * d.rx, d.y + fy * d.ry, 1]);
      }
      items.sort((q, r) => q[1] - r[1]);
      for (const [x, y, kind] of items) {
        if (kind === 0) layer(c, (l) => outcrop(l, x, y, 1, Math.floor(x * 7 + y)), { outline: 0.55, rect: [x - 40, y - 30, x + 40, y + 16] });
        else {
          contactShadow(c, x + 18, y + 4, 34, 8, 0.22);
          layer(c, (l) => drawSpruce(l, x, y, 0.5 + Rn() * 0.25, Math.floor(x * 31 + y * 17)), { outline: 0.55, rect: [x - 50, y - 220, x + 50, y + 6] });
        }
      }
      // the turbine on the crest: footing, a tapered white tower, the nacelle facing the fjord
      if (!d.turbine) return;
      const x = d.x - d.rx * 0.08;
      const y = d.top + 10;
      layer(c, (l) => {
        ell(l, x, y + 2, 24, 9, '#6a7078');
        ell(l, x, y + 1, 20, 7, '#8a9098');
        for (let j = 0; j < TOWER * 4; j++) {
          const t = j / (TOWER * 4);
          const hw = 10 - t * 5.5;
          for (let i = -hw; i < hw; i++) {
            const u = (i + hw) / (2 * hw);
            px(l, x + i, y - j, ['#f4f6f8', '#e6eaee', '#cfd5dc', '#b4bcc6', '#9aa4b0'][u < 0.25 ? 0 : u < 0.5 ? 1 : u < 0.75 ? 2 : u < 0.9 ? 3 : 4]);
          }
        }
        px(l, x - 3, y - 26, '#8a96a2', 6, 14);
        for (let i = -9; i < 9; i++) px(l, x + i, y - 60, '#5cd8c0');
        const ny = y - TOWER * 4;
        for (let j = -11; j < 11; j++)
          for (let i = -34; i < 28; i++) {
            if (i < -24 && (i + 34) * (i + 34) * 0.01 + j * j * 0.012 > 1.3) continue;
            px(l, x + i, ny + j - i * 0.12, ['#f4f6f8', '#dde2e8', '#b8c0ca'][j < -3 ? 0 : j < 5 ? 1 : 2]);
          }
        // the hub's spinner, where the anim's three blades meet (turbineHub)
        const [hx, hy] = turbineHub(p, d);
        ell(l, hx, hy, 8, 10, '#d6dce2');
        ell(l, hx - 1, hy - 1, 6, 8, '#eef2f5');
        ell(l, hx + 1, hy - 2, 3, 4, '#ffffff');
        for (let i = -30; i < 22; i++) px(l, x + i, ny - 11 - i * 0.12, '#ffffff', 1, 2);
      }, { rect: [x - 42, y - TOWER * 4 - 30, x + 46, y + 14] });
    });
  },
  anim(p, k) {
    // the rotors turning slowly in the cold wind, seen a little from the side
    const u = p.k / 4;
    const domes = ridgeDomes(p, k).filter((d) => d.turbine);
    domes.forEach((d, i) => {
      const x = d.x - d.rx * 0.08;
      const [hx, hy] = turbineHub(p, d);
      const ang = k.t * 0.9 + i * 1.7 + (k.seed % 7);
      const R = 290 * u;
      for (let bl = 0; bl < 3; bl++) {
        const th = ang + (bl * Math.PI * 2) / 3;
        const ex = hx + Math.cos(th) * R * 0.52;
        const ey = hy + Math.sin(th) * R + Math.cos(th) * R * 0.26;
        const L = Math.hypot(ex - hx, ey - hy) || 1;
        const nx = -(ey - hy) / L;
        const ny = (ex - hx) / L;
        const at2 = (t: number, w: number, sgn: number): [number, number] => [hx + (ex - hx) * t + nx * w * sgn * u, hy + (ey - hy) * t + ny * w * sgn * u];
        fillPoly(p.c, [at2(0, 3, 1), at2(0.22, 5, 1), at2(1, 0.8, 1), at2(1, 0.8, -1), at2(0.22, 2, -1), at2(0, 2.5, -1)], '#eef2f5');
        fillPoly(p.c, [at2(0.22, 2, -1), at2(1, 0.8, -1), at2(1, 0, 1), at2(0.22, 0, 1)], '#b6c0ca');
        // the red warning tips
        fillPoly(p.c, [at2(0.84, 1.6, 1), at2(1, 0.8, 1), at2(1, 0.8, -1), at2(0.84, 1.2, -1)], '#d8382c');
      }
      ell(p.c, hx, hy, 6 * u, 7 * u, '#f4f6f8');
      // the red light on the nacelle, blinking in step on all turbines
      if (Math.sin(k.t * 1.6) > 0.3) {
        p.c.globalAlpha = 0.4;
        ell(p.c, x - 10 * u, hy - 12 * u, 6 * u, 6 * u, '#ff5a3a');
        p.c.globalAlpha = 1;
        px(p.c, x - 11 * u, hy - 13 * u, '#ff4a3a', Math.max(1, Math.round(3 * u)), Math.max(1, Math.round(3 * u)));
      }
    });
  },
};

export const DC_NATURE: Record<string, PropArt> = { dc_spruce, dc_pine, dc_birch, dc_shrub, dc_mound, dc_rock, dc_crag, dc_snowbank, dc_reeds, dc_snowfence, dc_ridge };
void mix;
void (null as unknown as PropPainter);
void (null as unknown as Ramp);

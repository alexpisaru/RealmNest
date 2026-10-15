// Creative Studio — the beach and the dunes (1 z ≈ 10 cm).
//   std_palm        coconut (curved, ringed, drooping fronds), fan (Washingtonia with
//                   its skirt of dead leaves) and Canary date palms
//   std_marram      tufts of marram grass (walk-through)
//   std_dune        a sand dune with real volume: lit slope, shaded flank, wind
//                   ripples, marram on its crest and a half-buried sand fence
//   std_sandFence   weathered slat fencing wired together, leaning, buried
//   std_ropeFence   posts and a sagging rope along the dune paths
//   std_deckchair   striped canvas deckchairs (rot 1 faces the sea)
//   std_umbrella    tilted beach parasols with a towel, a bag and a cool box below
//   std_castle      a sandcastle with a bucket, a spade and a paper flag
//   std_bush        oleander, hibiscus, agave, pampas grass, sea grape
//   std_groyne      a line of old timber posts running into the sea
//   std_buoy        swim-zone buoys bobbing (anim)
//   std_surf        the wash of the waves on the sand (live)
//   std_decal       flat details: towels, footprints, shells, wrack, paint, cables…

import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { bayer, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { anchor, footShadow } from '../util';
import { coastX } from './ground';
import { darken, DRIFT, GEAR, LEAF, lighten, MARRAM, PALMLEAF, PINE, SAND, weathered, pmod } from './kit';

type V3 = [number, number, number];
const BARK: Ramp = ['#3a2c22', '#55402e', '#6e543c', '#87694c', '#a0805e', '#b89872', '#ccae88'];
const FANLEAF: Ramp = ['#26402a', '#305434', '#3c6a3c', '#4c8244', '#5e9a4c', '#78b058', '#96c46a'];
const DEADLEAF: Ramp = ['#4a3a24', '#62502e', '#7c683c', '#96804c', '#ae9a62', '#c4b07a'];

// ── palms ───────────────────────────────────────────────────
/** A tapered, ringed trunk from (x, y) curving by `lean` px at the top. Returns the top. */
function palmTrunk(l: CanvasRenderingContext2D, x: number, y: number, H: number, w0: number, w1: number, lean: number, ring: number, date: boolean, seed: number): [number, number] {
  for (let j = 0; j < H; j++) {
    const t = j / H;
    const cx = x + lean * t * t;
    const w = w0 + (w1 - w0) * t + (j < 6 ? (6 - j) * 0.7 : 0);
    const x0 = Math.round(cx - w / 2);
    const W = Math.round(w);
    for (let i = 0; i < W; i++) {
      const u = i / Math.max(1, W - 1);
      let tone = u < 0.2 ? 5 : u < 0.45 ? 4 : u < 0.75 ? 3 : 2;
      if (date) {
        // the Canary palm's diamonds of old leaf bases
        const dx = (x0 + i) * 0.5 + j * 0.5;
        const dy = (x0 + i) * 0.5 - j * 0.5;
        if (Math.abs((dx % 5) - 2.5) < 0.7 || Math.abs((dy % 5) - 2.5) < 0.7) tone -= 2;
      } else {
        if ((j + Math.floor(hash(Math.floor(j / ring), 1, seed) * 2)) % ring === 0) tone -= 2;
        else if ((j + 1) % ring === 0) tone += 1;
      }
      if (hash(x0 + i, j, seed) < 0.04) tone -= 1;
      px(l, x0 + i, y - j, BARK[Math.max(0, Math.min(6, tone))]);
    }
  }
  return [x + lean, y - H];
}

/** One pinnate frond from the crown at (tx, ty): azimuth th (radians, ground plane), length L tiles. */
function frond(l: CanvasRenderingContext2D, tx: number, ty: number, th: number, L: number, droop: number, ramp: Ramp, seed: number, dead = false) {
  const cx = Math.cos(th);
  const cy = Math.sin(th);
  const sx = (cx - cy) * 64;
  const sy = (cx + cy) * 32;
  const lit = cx * -0.6 + cy * 0.5 > 0 ? 1 : 0;
  const pts: [number, number][] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const rise = L * 16 * (0.42 * s - droop * s * s) * 4;
    pts.push([tx + sx * L * s, ty + sy * L * s - rise]);
  }
  // leaflets hang from both sides of the rachis, longest in the middle
  const Rn = rng(seed);
  for (let i = 1; i < n; i++) {
    const [x, y] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x;
    const dy = y2 - y;
    const m = Math.hypot(dx, dy) || 1;
    const nx = -dy / m;
    const ny = dx / m;
    const s = i / n;
    const len = (6 + Math.sin(s * Math.PI) * 14) * (0.8 + Rn() * 0.4);
    for (const side of [-1, 1]) {
      const ex = x + nx * side * len * 0.75 + dx * 0.25;
      const ey = y + ny * side * len * 0.45 + len * 0.7;
      const col = dead ? DEADLEAF[2 + (side > 0 ? 1 : 0)] : ramp[Math.max(0, Math.min(ramp.length - 1, 2 + lit * 2 + (side < 0 ? 1 : 0) - (s > 0.8 ? 1 : 0)))];
      ln(l, x, y, ex, ey, col);
      if (len > 10) ln(l, x + dx * 0.5, y + dy * 0.5, ex + dx * 0.4, ey + dy * 0.4, col);
    }
  }
  for (let i = 0; i < n; i++) ln(l, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], dead ? DEADLEAF[1] : ramp[1], i < 4 ? 2 : 1);
}

/** A fan leaf (Washingtonia) at the end of a petiole: azimuth th, elevation el (radians). */
function fanLeaf(l: CanvasRenderingContext2D, tx: number, ty: number, th: number, el: number, seed: number) {
  const L = 0.44;
  const cx = Math.cos(el) * Math.cos(th);
  const cy = Math.cos(el) * Math.sin(th);
  const ex = tx + (cx - cy) * 64 * L;
  const ey = ty + (cx + cy) * 32 * L - Math.sin(el) * 64 * L;
  ln(l, tx, ty, ex, ey, FANLEAF[1], 2);
  // facing the sun: up and to the upper left
  const lit = Math.sin(el) * 0.7 + (-cx * 0.36 + cy * 0.56) * 0.7;
  const base = lit > 0.35 ? 4 : lit > -0.05 ? 3 : 2;
  const out = Math.atan2(ey - ty, ex - tx);
  const R0 = 18 + hash(seed, 3, 7) * 6;
  for (let i = 0; i <= 14; i++) {
    const a = out - 1.25 + (i / 14) * 2.5;
    const r = R0 * (0.82 + hash(i, 1, seed) * 0.32);
    const fx = ex + Math.cos(a) * r;
    const fy = ey + Math.sin(a) * r * 0.72;
    ln(l, ex, ey, fx, fy, FANLEAF[Math.min(6, base + (i % 2))]);
    ln(l, ex, ey + 1, fx, fy + 1, FANLEAF[Math.max(0, base - 1 + (i % 2))]);
    // the frayed tips droop
    ln(l, fx, fy, fx + Math.cos(a) * 2, fy + 3 + (i % 3), FANLEAF[Math.max(0, base - 1)]);
  }
}

const palm: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 41 + 3);
    const kind = k.variant ?? ['coco', 'coco', 'fan', 'date'][k.seed % 4];
    // drawn at the centre of its footprint (2×2 leaves room for the fronds)
    const [x, y] = anchor(p, k.w / 2, k.d / 2);
    const c = p.c;
    if (kind === 'date') {
      const H = 50 + Rn() * 24;
      contactShadow(c, x + 40, y + 8, 70, 22, 0.41);
      let top: [number, number] = [x, y - H * 4];
      layer(c, (l) => {
        top = palmTrunk(l, x, y, H * 4, 18, 15, (Rn() - 0.3) * 8, 6, true, k.seed);
      }, { outline: 0.6 });
      const [tx, ty] = top;
      layer(c, (l) => {
        const n = 26;
        const order = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + Rn() * 0.2).sort((a, b) => Math.cos(a) + Math.sin(a) - (Math.cos(b) + Math.sin(b)));
        for (const th of order) frond(l, tx, ty + 4, th, 1.15 + Rn() * 0.25, 0.75 + Rn() * 0.3, PALMLEAF, Math.floor(th * 100) + k.seed);
        for (let i = 0; i < 5; i++) dotFruit(l, tx - 8 + Rn() * 16, ty + 6 + Rn() * 6, '#e8902a', 4);
        // young fronds standing up from the heart of the crown
        ell(l, tx, ty + 2, 12, 7, PALMLEAF[1]);
        const young = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + Rn() * 0.3).sort((a, b) => Math.cos(a) + Math.sin(a) - (Math.cos(b) + Math.sin(b)));
        for (const th of young) frond(l, tx, ty, th, 0.55 + Rn() * 0.2, -0.1 + Rn() * 0.3, PALMLEAF, Math.floor(th * 77) + k.seed);
      }, { outline: 0.55 });
      return;
    }
    if (kind === 'fan') {
      const H = 120 + Rn() * 30;
      contactShadow(c, x + 60, y + 10, 50, 16, 0.38);
      let top: [number, number] = [x, y - H * 4];
      layer(c, (l) => {
        top = palmTrunk(l, x, y, H * 4, 11, 8, (Rn() - 0.2) * 10, 7, false, k.seed);
        // the thatched skirt of dead fronds hanging under the crown
        const [sx, sy] = top;
        for (let j = 0; j < 40; j++) {
          const t = j / 40;
          const w = 13 - t * 4;
          for (let i = -w; i < w; i++) {
            const u = (i + w) / (2 * w);
            let tone = u < 0.25 ? 4 : u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
            if (hash(Math.floor(sx + i), Math.floor((sy + j) / 3), k.seed) < 0.25) tone -= 1;
            if (j > 36 && hash(Math.floor(sx + i), 1, k.seed) < 0.5) continue;
            px(l, sx + i, sy + 4 + j, DEADLEAF[Math.max(0, Math.min(5, tone))]);
          }
        }
      }, { outline: 0.6 });
      const [tx, ty] = top;
      const leaves = Array.from({ length: 22 }, (_, i) => ({ th: (i / 22) * Math.PI * 2 * 2.618 + Rn() * 0.4, el: -0.35 + Rn() * 1.35 }));
      const depth = (q: { th: number; el: number }) => Math.cos(q.el) * (Math.cos(q.th) + Math.sin(q.th)) * 0.5 + Math.sin(q.el) * 0.2;
      leaves.sort((a, b) => depth(a) - depth(b));
      layer(c, (l) => {
        for (const q of leaves) if (depth(q) < 0) fanLeaf(l, tx, ty, q.th, q.el, Math.floor(q.th * 100) + k.seed);
        // the dense core of young leaves
        foliage(l, [{ x: tx, y: ty - 5, rx: 19, ry: 13, z: 1 }], FANLEAF, k.seed + 5, { cell: 3.4, tilt: 0.2 });
        for (const q of leaves) if (depth(q) >= 0) fanLeaf(l, tx, ty, q.th, q.el, Math.floor(q.th * 100) + k.seed);
      }, { outline: 0.55 });
      return;
    }
    // the coconut palm: slender, leaning, ringed; drooping fronds; nuts
    const H = 100 + Rn() * 40;
    const lean = (0.3 + Rn() * 0.7) * (Rn() < 0.75 ? 1 : -0.5) * 70;
    contactShadow(c, x + 46 + lean * 0.5, y + 10, 64, 20, 0.38);
    let top: [number, number] = [x, y - H * 4];
    layer(c, (l) => {
      top = palmTrunk(l, x, y, H * 4, 12, 7, lean, 5, false, k.seed);
    }, { outline: 0.6 });
    const [tx, ty] = top;
    const n = 12;
    const ths = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 + (Rn() - 0.5) * 0.3);
    const back = ths.filter((th) => Math.cos(th) + Math.sin(th) < 0);
    const frontF = ths.filter((th) => Math.cos(th) + Math.sin(th) >= 0);
    layer(c, (l) => {
      for (const th of back) frond(l, tx, ty, th, 1.25 + Rn() * 0.35, 0.95 + Rn() * 0.35, PALMLEAF, Math.floor(th * 100) + k.seed);
      if (Rn() < 0.6) frond(l, tx, ty + 4, 1.9 + Rn(), 0.9, 2.2, PALMLEAF, k.seed + 5, true);
    }, { outline: 0.55 });
    layer(c, (l) => {
      for (let i = 0; i < 5; i++) dotFruit(l, tx - 7 + (i % 3) * 6 + Rn() * 2, ty + 4 + Math.floor(i / 3) * 5, i % 2 ? '#7a8a3a' : '#8a6a3a', 6);
      ell(l, tx, ty + 1, 6, 4, BARK[2]);
    }, { outline: 0.6 });
    layer(c, (l) => {
      for (const th of frontF) frond(l, tx, ty, th, 1.2 + Rn() * 0.35, 0.95 + Rn() * 0.35, PALMLEAF, Math.floor(th * 100) + k.seed);
    }, { outline: 0.55 });
  },
};

// ── marram grass ────────────────────────────────────────────
/** A tuft of marram: arching blades from a root at (x, y). */
export function marramTuft(l: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number) {
  // a spiky rosette of dune grass: dark blades behind, lit blades in front, pale tips
  const Rn = rng(seed);
  ell(l, x + 5, y + 2, 13 * size + 4, 4 * size, 'rgba(42,26,42,0.34)');
  const n = Math.round(14 + size * 10);
  const blades: [number, number, number][] = [];
  for (let i = 0; i < n; i++) blades.push([-1.3 + (i / (n - 1)) * 2.6 + (Rn() - 0.5) * 0.25, (22 + Rn() * 22) * size, Rn()]);
  // the back half first (blades leaning away), then the front
  blades.sort((p, q) => Math.abs(q[0]) - Math.abs(p[0]));
  for (let pass = 0; pass < 2; pass++)
    for (const [ang, len, r] of blades) {
      const back = r < 0.45;
      if ((pass === 0) !== back) continue;
      const ex = x + Math.sin(ang) * len * 1.25;
      const ey = y - 2 - Math.cos(ang) * len * 0.95;
      const lit = ang < 0.2;
      const col = back ? MARRAM[lit ? 2 : 1] : MARRAM[lit ? 5 : 3];
      const w = 2.4 * size;
      fillPoly(l, [[x - w, y - 1], [x + w, y - 1], [ex, ey]], col);
      ln(l, x, y - 1, ex, ey, back ? MARRAM[0] : MARRAM[lit ? 6 : 4]);
      px(l, ex - 1, ey - 1, back ? MARRAM[3] : MARRAM[6], 2, 2);
    }
  ell(l, x, y - 2, 4 * size, 2.5 * size, MARRAM[0]);
  if (Rn() < 0.35) {
    const bx = x + (Rn() - 0.5) * 6 * size;
    const len = (34 + Rn() * 10) * size;
    ln(l, bx, y - 4, bx + 3, y - len, MARRAM[2]);
    for (let j = 0; j < 5; j++) px(l, bx + 2 + j * 0.3, y - len + j * 2, '#e8d890', 2, 2);
  }
}

const marram: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 13 + 1);
    layer(p.c, (l) => {
      const n = 1 + Math.floor(Rn() * 3);
      const tufts: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = p.P(0.25 + Rn() * 0.5, 0.25 + Rn() * 0.5);
        tufts.push([x, y, (n === 1 ? 1.5 : 1.05) + Rn() * 0.5]);
      }
      tufts.sort((a, b) => a[1] - b[1]);
      for (const [x, y, s] of tufts) marramTuft(l, x, y, s, Math.round(x * 7 + y * 13) + k.seed);
    }, { outline: 0.5 });
  },
};

// ── dunes ───────────────────────────────────────────────────
const DUNE: Ramp = ['#9a7040', '#b0844e', '#c69a5e', '#d8ae6e', '#e8c080', '#f4d094', '#fcdeae'];

const dune: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Rn = rng(k.seed * 17 + 5);
    const H = 9 + Rn() * 5 + Math.min(W, D) * 1.8;
    const ca = W / 2 + (Rn() - 0.5) * 0.4;
    const cb = D / 2 + (Rn() - 0.5) * 0.3;
    const ra = W / 2 - 0.1;
    const rb = D / 2 - 0.1;
    const hgt = (a: number, b: number) => {
      const r2 = ((a - ca) / ra) ** 2 + ((b - cb) / rb) ** 2;
      if (r2 >= 1) return 0;
      // a soft crest a little toward the back, steeper lee on the right
      return H * (1 - r2) * (1 - r2 * 0.35);
    };
    const c = p.c;
    footShadow(p, 0.2, 0.3, W - 0.1, D - 0.1, H * 1.1, 0.38);
    // ray-march each pixel's line of sight to the front-most point of the mound
    const corners = [p.P(0, 0, 0), p.P(W, 0, 0), p.P(W, D, 0), p.P(0, D, 0), p.P(ca, cb, H)];
    const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
    const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
    const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 4;
    const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
    const [ox, oy] = p.P(0, 0, 0);
    const kk = p.k;
    for (let py = y0; py < y1; py++)
      for (let pxx = x0; pxx < x1; pxx++) {
        // local a − b fixed by the column; t = a + b along the view ray (z = 8t − Yc)
        const s = (pxx + 0.5 - ox) / (16 * kk);
        const Yc = (py + 0.5 - oy) / kk;
        const tTop = Math.min(2 * Math.max(W, D) + 2, (H + Yc) / 8);
        const tEnd = Yc / 8;
        let hit = -1;
        let tHi = tTop;
        for (let t = tTop; t >= tEnd; t -= 0.1) {
          const a = (t + s) / 2;
          const b = (t - s) / 2;
          if (hgt(a, b) >= 8 * t - Yc) {
            hit = t;
            break;
          }
          tHi = t;
        }
        if (hit < 0) continue;
        let lo = hit;
        let hi = Math.min(hit + 0.1, tHi);
        for (let it = 0; it < 5; it++) {
          const mid = (lo + hi) / 2;
          if (hgt((mid + s) / 2, (mid - s) / 2) >= 8 * mid - Yc) lo = mid;
          else hi = mid;
        }
        const a = (lo + s) / 2;
        const b = (lo - s) / 2;
        const e = 0.02;
        const ha = (hgt(a + e, b) - hgt(a - e, b)) / (2 * e) / 16;
        const hb = (hgt(a, b + e) - hgt(a, b - e)) / (2 * e) / 16;
        // relief lighting, exaggerated as a pixel artist would: lit windward face, shaded lee
        const nx = -ha * 3.2;
        const ny = -hb * 3.2;
        const nl = Math.hypot(nx, ny, 1);
        const dd = (nx * -0.36 + ny * 0.56 + 0.75) / nl;
        const z = hgt(a, b);
        let tone = 3.3 + (dd - 0.75) * 5.2 + (z / H) * 1.1;
        // wind ripples across the slope, grains
        const rip = Math.sin((a * 1.3 + b * 0.5) * 12 + Math.sin(b * 3) * 2);
        if (rip > 0.88) tone += 0.7;
        else if (rip < -0.9) tone -= 0.6;
        if (hash(pxx, py, 11) < 0.05) tone -= 1;
        tone += (bayer(pxx, py) - 0.5) * 0.6;
        c.fillStyle = DUNE[Math.max(0, Math.min(6, Math.round(tone)))];
        c.fillRect(pxx, py, 1, 1);
      }
    // marram on the crest and the flanks, a half-buried fence on one side
    layer(c, (l) => {
      const n = Math.round(W * D * 2);
      const tufts: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = ca + (Rn() - 0.5) * ra * 1.5;
        const b = cb + (Rn() - 0.5) * rb * 1.5;
        const z = hgt(a, b);
        if (z < 1.2) continue;
        const [x, y] = p.P(a, b, z);
        tufts.push([x, y, 0.6 + Rn() * 0.6]);
      }
      tufts.sort((m, q) => m[1] - q[1]);
      for (const [x, y, s] of tufts) marramTuft(l, x, y, s, Math.round(x * 3 + y * 7) + k.seed);
    }, { outline: 0.5 });
    if (Rn() < 0.6) {
      layer(c, (l) => {
        const bq = cb + rb * 0.55;
        for (let a = ca - ra * 0.7; a < ca + ra * 0.6; a += 0.11) {
          if (hash(Math.round(a * 50), 3, k.seed) < 0.15) continue;
          const z = hgt(a, bq);
          const [x0q, y0q] = p.P(a, bq, Math.max(0, z - 1));
          const top = 6 + hash(Math.round(a * 50), 4, k.seed) * 3;
          ln(l, x0q, y0q, x0q + 1, y0q - top * 4 + z * 0, DRIFT[3 + (Math.round(a * 50) % 2)], 2);
        }
        for (const zz of [2, 6]) {
          let prev: [number, number] | null = null;
          for (let a = ca - ra * 0.7; a < ca + ra * 0.6; a += 0.11) {
            const z = hgt(a, bq);
            const q = p.P(a, bq, Math.max(0, z - 1) + zz);
            if (prev) ln(l, prev[0], prev[1], q[0], q[1], '#5a5a5e');
            prev = q;
          }
        }
      }, { outline: 0.5 });
    }
  },
};

// ── fences ──────────────────────────────────────────────────
const sandFence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 7 + 3);
    footShadow(p, 0, 0.3, W, 0.7, 6, 0.23);
    layer(p.c, (l) => {
      // a ridge of sand piled along the foot
      for (let a = 0; a < W; a += 0.05) {
        const [x, y] = p.P(a, 0.5, 0);
        ell(l, x, y, 5, 2.5, SAND[3 + (Math.floor(a * 20) % 2)]);
      }
    }, { outline: false });
    layer(p.c, (l) => {
      const lean = (Rn() - 0.5) * 0.08;
      for (let a = 0.05; a < W - 0.02; a += 0.1) {
        if (Rn() < 0.08) continue;
        const h = 8 + Rn() * 2.4 - (Rn() < 0.06 ? 4 : 0);
        const [x0, y0] = p.P(a, 0.5, 0.6);
        const [x1, y1] = p.P(a + lean, 0.5 - lean, h);
        const col = Rn() < 0.12 ? '#a8463a' : DRIFT[3 + Math.floor(Rn() * 3)];
        ln(l, x0, y0, x1, y1, col, 3);
        ln(l, x0, y0, x1, y1, lighten(col, 0.18), 1);
        px(l, x1 - 1, y1 - 1, darken(col, 0.2), 3, 1);
      }
      for (const z of [2.2, 7]) {
        const [x0, y0] = p.P(0, 0.5, z);
        const [x1, y1] = p.P(W, 0.5, z + lean * 4);
        ln(l, x0, y0, x1, y1, '#5a5a5e');
      }
      // an end post
      for (const a of [0.02, W - 0.06]) {
        const [x, y] = p.P(a, 0.5, 0);
        px(l, x - 2, y - 46, DRIFT[2], 4, 46);
        px(l, x - 2, y - 46, DRIFT[4], 1, 46);
      }
    }, { outline: 0.55 });
  },
};

const ropeFence: PropArt = {
  draw(p, k) {
    const W = k.w;
    layer(p.c, (l) => {
      const n = Math.max(2, Math.round(W / 1.5) + 1);
      const tops: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = 0.1 + ((W - 0.2) * i) / (n - 1);
        const [x, y] = p.P(a, 0.5, 0);
        contactShadow(l, x + 4, y + 1, 5, 2, 0.29);
        px(l, x - 2, y - 26, DRIFT[2], 5, 26);
        px(l, x - 2, y - 26, DRIFT[4], 1, 26);
        px(l, x - 3, y - 27, DRIFT[1], 7, 2);
        tops.push([x, y - 22]);
      }
      for (let i = 0; i + 1 < tops.length; i++) {
        const [x0, y0] = tops[i];
        const [x1, y1] = tops[i + 1];
        curve(l, x0, y0, (x0 + x1) / 2, (y0 + y1) / 2 + 10, x1, y1, '#c8b088', 2);
        curve(l, x0, y0 + 1, (x0 + x1) / 2, (y0 + y1) / 2 + 11, x1, y1 + 1, '#8a7452', 1);
      }
    }, { outline: 0.5 });
    void k;
  },
};

// ── deckchairs and parasols ─────────────────────────────────
const CANVAS = [['#d8402e', '#f6eedc'], ['#2a5a9a', '#f6eedc'], ['#e8b03e', '#2a8a86'], ['#3a8a5a', '#f6eedc'], ['#e06a9a', '#f6eedc'], ['#f08a3a', '#1e2a4a']];

const deckchair: PropArt = {
  draw(p, k) {
    const [ca, cb] = CANVAS[pmod(k.seed + p.x * 3 + p.y, CANVAS.length)];
    footShadow(p, 0.2, 0.15, 0.8, 0.9, 7, 0.35);
    layer(p.c, (l) => {
      const P = (a: number, b: number, z: number) => p.P(a, b, z);
      // the frame: long rails from the front feet up to the top back, the back legs
      for (const a of [0.24, 0.76]) {
        const f = P(a, 0.86, 0);
        const t = P(a, 0.18, 9.6);
        ln(l, f[0], f[1], t[0], t[1], PINE[3], 2);
        ln(l, f[0] - 1, f[1], t[0] - 1, t[1], PINE[5], 1);
        const bf = P(a, 0.2, 0);
        const bt = P(a, 0.62, 4.2);
        ln(l, bf[0], bf[1], bt[0], bt[1], PINE[2], 2);
      }
      const r0 = P(0.24, 0.18, 9.6);
      const r1 = P(0.76, 0.18, 9.6);
      ln(l, r0[0], r0[1], r1[0], r1[1], PINE[4], 2);
      const f0 = P(0.24, 0.8, 2.6);
      const f1 = P(0.76, 0.8, 2.6);
      ln(l, f0[0], f0[1], f1[0], f1[1], PINE[3], 2);
      // the sling: striped canvas sagging between the rails
      const n = 10;
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const seg = (t: number): [number, number, number] => [0.8 - t * 0.6, 2.6 + t * 7 - Math.sin(t * Math.PI) * 2.6, 0];
        const [b0, z0] = seg(t0);
        const [b1, z1] = seg(t1);
        for (let s = 0; s < 6; s++) {
          const a0 = 0.27 + s * 0.077;
          const a1 = a0 + 0.077;
          const col = s % 2 ? cb : ca;
          const q = [P(a0, b0, z0), P(a1, b0, z0), P(a1, b1, z1), P(a0, b1, z1)];
          fillPoly(l, q, t0 < 0.5 ? col : lighten(col, 0.12));
        }
      }
      // sometimes a towel over the back, a hat or a paperback on the seat
      const Rn = rng(k.seed * 5 + 2);
      if (Rn() < 0.4) {
        const [hx, hy] = P(0.5, 0.55, 5);
        ell(l, hx, hy, 8, 3, '#e8cc90');
        ell(l, hx, hy - 2, 4, 2.5, '#f2dca8');
        px(l, hx - 4, hy - 2, '#2a5a9a', 8, 1);
      } else if (Rn() < 0.5) {
        const [bx, by] = P(0.5, 0.5, 4.6);
        fillPoly(l, [[bx - 5, by], [bx, by - 3], [bx + 5, by], [bx, by + 3]], '#e06a4a');
      }
    }, { outline: 0.55 });
  },
};

/** A beach towel on the sand (flat), striped. */
function towel(c: CanvasRenderingContext2D, p: PropPainter, a: number, b: number, w: number, d: number, cols: string[], ang = 0) {
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => {
    const ru = u * Math.cos(ang) - v * Math.sin(ang);
    const rv = u * Math.sin(ang) + v * Math.cos(ang);
    return [a + ru, b + rv] as [number, number];
  });
  const n = 7;
  const lerp = (P0: [number, number], P1: [number, number], t: number): [number, number] => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const A0 = lerp(pts[0], pts[1], t0);
    const A1 = lerp(pts[0], pts[1], t1);
    const B0 = lerp(pts[3], pts[2], t0);
    const B1 = lerp(pts[3], pts[2], t1);
    fillPoly(c, [p.P(A0[0], A0[1], 0.05), p.P(A1[0], A1[1], 0.05), p.P(B1[0], B1[1], 0.05), p.P(B0[0], B0[1], 0.05)], cols[i % cols.length]);
  }
  // the towel's shadow edge on the sand
  const e0 = p.P(pts[3][0], pts[3][1], 0);
  const e1 = p.P(pts[2][0], pts[2][1], 0);
  ln(c, e0[0], e0[1] + 1, e1[0], e1[1] + 1, 'rgba(60,40,30,0.25)');
}

// the reference's parasols: red, blue, orange on white, and navy with orange
const PARASOL = [['#e0302a', '#fbf8f2'], ['#2a5ab8', '#fbf8f2'], ['#f08a1a', '#fbf8f2'], ['#1e2a4a', '#f08a1a'], ['#e0302a', '#fbf8f2'], ['#1e8a90', '#fbf8f2']];
const umbrella: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 9 + 4);
    const [c1, c2] = PARASOL[pmod(k.seed * 5 + 1, PARASOL.length)];
    const c = p.c;
    // the towel, a bag and flip-flops in its shade
    layer(c, (l) => {
      towel(l, p, 0.52, 0.62, 0.36, 0.7, [c2, ['#7ac7bb', '#f0a6c0', '#f2c84a', '#e06a4a'][Math.floor(Rn() * 4)]], (Rn() - 0.5) * 0.5);
      if (Rn() < 0.6) {
        const [bx, by] = p.P(0.25, 0.36, 0);
        fillPoly(l, [[bx - 6, by], [bx + 6, by - 2], [bx + 7, by - 10], [bx - 5, by - 8]], '#d8b878');
        curve(l, bx - 3, by - 8, bx, by - 15, bx + 4, by - 9, '#8a6a3a');
        px(l, bx - 4, by - 6, '#e06a4a', 10, 2);
      }
      if (Rn() < 0.6) {
        const [cx, cy] = p.P(0.78, 0.3, 0);
        px(l, cx - 7, cy - 9, '#f6f2ea', 14, 9);
        px(l, cx - 7, cy - 9, '#2a8ab8', 14, 3);
        px(l, cx - 7, cy - 9, '#ffffff', 2, 9);
      }
      const [fx, fy] = p.P(0.7, 0.92, 0);
      px(l, fx - 4, fy - 1, '#e0603e', 3, 2);
      px(l, fx + 1, fy, '#e0603e', 3, 2);
    }, { outline: 0.5 });
    // the tilted pole and the scalloped canopy, panels lit toward the sun
    const base: V3 = [0.5, 0.56, 0];
    const tilt = 0.12 + Rn() * 0.1;
    const top: V3 = [0.5 - tilt, 0.56 - tilt * 0.6, 21];
    const [bx0, by0] = p.P(...base);
    const [tx, ty] = p.P(...top);
    contactShadow(c, tx + 34, by0 + 4, 46, 18, 0.35);
    layer(c, (l) => {
      ln(l, bx0, by0, tx, ty, '#f2ece0', 2);
      ln(l, bx0 + 1, by0, tx + 1, ty, '#a8a094', 1);
      const n = 12;
      const R = 0.62;
      const rim: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        rim.push(p.P(top[0] + Math.cos(t) * R, top[1] + Math.sin(t) * R, top[2] - 4 + Math.cos(t + 0.7) * 1.4));
      }
      const apex = p.P(top[0], top[1], top[2] + 2.5);
      const order = rim.map((_, i) => i).sort((i, j) => rim[i][1] - rim[j][1]);
      for (const i of order) {
        const j = (i + 1) % n;
        const t = ((i + 0.5) / n) * Math.PI * 2;
        const litK = -Math.cos(t) * 0.5 + Math.sin(t) * 0.4;
        const col = i % 2 ? c1 : c2;
        fillPoly(l, [apex, rim[i], rim[j]], litK > 0.15 ? lighten(col, 0.12) : litK < -0.2 ? darken(col, 0.18) : col);
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mx = (rim[i][0] + rim[j][0]) / 2;
        const my = (rim[i][1] + rim[j][1]) / 2;
        ell(l, mx, my + 1, 4, 2, darken(i % 2 ? c1 : c2, 0.08));
      }
      px(l, apex[0] - 1, apex[1] - 3, '#f2ece0', 3, 3);
    }, { outline: 0.55 });
  },
};

// ── a sandcastle ────────────────────────────────────────────
const castle: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 20, 7, 0.29);
    layer(p.c, (l) => {
      const tower = (tx: number, ty: number, h: number, r: number) => {
        for (let j = 0; j < h; j++) {
          for (let i = -r; i < r; i++) {
            const t = (i + r) / (2 * r);
            px(l, tx + i, ty - j, DUNE[t < 0.3 ? 5 : t < 0.6 ? 4 : t < 0.85 ? 3 : 2]);
          }
        }
        for (let i = -r; i < r; i += 3) px(l, tx + i, ty - h - 2, DUNE[5], 2, 2);
        ell(l, tx, ty - h, r, r * 0.4, DUNE[6]);
      };
      ell(l, x, y, 18, 8, DUNE[2]);
      ell(l, x, y - 2, 16, 7, DUNE[4]);
      tower(x - 8, y - 2, 10, 5);
      tower(x + 7, y, 8, 5);
      tower(x, y - 5, 16, 6);
      px(l, x, y - 30, '#5a4a3a', 1, 9);
      fillPoly(l, [[x + 1, y - 30], [x + 8, y - 28], [x + 1, y - 25]], '#e0402a');
      // the bucket and spade
      const [bx, by] = p.P(0.82, 0.78);
      fillPoly(l, [[bx - 5, by - 8], [bx + 5, by - 8], [bx + 4, by], [bx - 4, by]], '#2a8ab8');
      px(l, bx - 5, by - 9, '#5aaad8', 10, 2);
      ln(l, bx - 12, by + 2, bx - 6, by - 10, '#e8b03e', 2);
      fillPoly(l, [[bx - 14, by + 1], [bx - 9, by - 1], [bx - 10, by + 5], [bx - 14, by + 5]], '#e8b03e');
    }, { outline: 0.55 });
    void k;
  },
};

// ── coastal shrubs ──────────────────────────────────────────
const bush: PropArt = {
  draw(p, k) {
    const kind = k.variant ?? ['oleander', 'hibiscus', 'agave', 'pampas', 'seagrape'][pmod(k.seed + p.x * 7 + p.y * 3, 5)];
    const [x, y] = anchor(p, 0.5, 0.55);
    const Rn = rng(k.seed * 11 + 2);
    contactShadow(p.c, x + 16, y + 6, 46, 14, 0.4);
    layer(p.c, (l) => {
      if (kind === 'agave') {
        const A: Ramp = ['#2a4a4a', '#386060', '#4a7876', '#5e908a', '#7aa89e', '#9cc2b4'];
        for (let i = 0; i < 15; i++) {
          const a = -1.5 + (i / 14) * 3;
          const len = 40 + Rn() * 16 - Math.abs(a) * 7;
          const ex = x + Math.sin(a) * len * 1.2;
          const ey = y - 4 - Math.cos(a) * len * 0.9;
          fillPoly(l, [[x - 6, y - 2], [x + 6, y - 2], [ex, ey]], A[a < 0 ? 4 : 1]);
          ln(l, x, y - 2, ex, ey, A[a < 0 ? 5 : 3]);
          px(l, ex - 1, ey - 1, '#3a2a20', 2, 2);
        }
        if (Rn() < 0.3) {
          ln(l, x + 2, y - 10, x + 6, y - 90, '#7a6a3a', 3);
          for (let j = 0; j < 5; j++) ell(l, x + 6 + (j % 2 ? 6 : -6), y - 60 - j * 7, 5, 3, '#c8b040');
        }
      } else if (kind === 'pampas') {
        for (let i = 0; i < 22; i++) {
          const a = (Rn() - 0.5) * 1.6;
          const len = 26 + Rn() * 16;
          curve(l, x + a * 6, y, x + a * 14, y - len * 0.6, x + a * 26, y - len * 0.8 + Math.abs(a) * 10, MARRAM[2 + (i % 3)]);
        }
        for (let i = 0; i < 7; i++) {
          const a = (Rn() - 0.5) * 1.2;
          const tx = x + a * 16;
          const ty = y - 46 - Rn() * 14;
          ln(l, x + a * 4, y - 6, tx, ty, '#a8a070');
          for (let j = 0; j < 9; j++) ell(l, tx + Math.sin(j) * 1.5, ty - j * 1.6, 3.2 - j * 0.2, 2, j % 2 ? '#f2e6c8' : '#e2d2a8');
        }
      } else {
        // a leafy round shrub with flowers (oleander pink, hibiscus red) or the big round sea grape leaves
        // a big lush shrub nearly a tile wide
        const n = 9;
        const masses: Mass[] = [];
        for (let i = 0; i < n; i++) masses.push({ x: x + (Rn() - 0.5) * 64, y: y - 18 - Rn() * 26, rx: 17 + Rn() * 9, ry: 14 + Rn() * 6, z: i });
        masses.push({ x, y: y - 40, rx: 26, ry: 20, z: n });
        if (kind === 'bougain') for (let i = 0; i < 5; i++) masses.push({ x: x + (Rn() - 0.5) * 60, y: y - 44 - Rn() * 22, rx: 14 + Rn() * 6, ry: 11 + Rn() * 4, z: n + 1 + i });
        const dots = kind === 'oleander' ? ['#f06aa0', '#f8a6c8', '#fbe0ea'] : kind === 'hibiscus' ? ['#e0302a', '#f05a3a', '#f6c040'] : kind === 'bougain' ? ['#e0408a', '#c02a70', '#f291b6', '#c15984'] : undefined;
        foliage(l, masses, kind === 'seagrape' ? ['#1e4a1a', '#2a5e22', '#387428', '#4a8c30', '#62a43c', '#80bc4c', '#a4d066'] : LEAF, k.seed + 3, { cell: kind === 'seagrape' ? 5 : 3, tilt: 0.2, dots, dotChance: kind === 'bougain' ? 0.9 : 0.6, dotSize: 4 });
      }
    }, { outline: 0.6 });
  },
};

// ── the groyne: old posts marching into the sea ─────────────
const groyne: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 3 + 9);
    const wood = weathered(DRIFT);
    void wood;
    layer(p.c, (l) => {
      for (let a = 0.2; a < W - 0.1; a += 0.32) {
        const h = 6 + Rn() * 6 - (a / W) * 3;
        const [x, y] = p.P(a, 0.5, 0);
        const w = 7;
        for (let j = 0; j < h * 4; j++) {
          for (let i = 0; i < w; i++) {
            const t = i / (w - 1);
            let tone = t < 0.3 ? 4 : t < 0.6 ? 3 : 2;
            if (j < 6) tone = 1;
            else if (j < 9 && hash(i, j, Math.round(a * 10)) < 0.6) tone = 0;
            px(l, x - 3 + i, y - j, j < 6 ? ['#2a3a2a', '#3a5030', '#2e4428'][i % 3] : DRIFT[tone]);
          }
        }
        ell(l, x, y - h * 4, 3.5, 1.5, DRIFT[5]);
        // a gull's perch: white splashes
        if (Rn() < 0.2) px(l, x - 2, y - h * 4 + 1, '#f6f6f0', 4, 2);
      }
      // the planks between the posts near the shore
      for (let a = 0.2; a < W * 0.5; a += 0.32) {
        const [x0, y0] = p.P(a, 0.42, 3);
        const [x1, y1] = p.P(a + 0.32, 0.42, 3);
        ln(l, x0, y0, x1, y1, DRIFT[2], 3);
      }
    }, { outline: 0.55 });
  },
};

// ── swim-zone buoys ─────────────────────────────────────────
const buoy: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const yel = k.variant === 'yellow' || (k.variant !== 'red' && k.seed % 2 === 1);
    layer(p.c, (l) => {
      // a ring of foam and the buoy's dark reflection, a round float with a white band and a flag
      ell(l, x + 2, y + 2, 14, 5, '#e8f8fa');
      ell(l, x + 2, y + 2, 11, 4, '#0a4a72');
      ell(l, x, y - 7, 10, 10, yel ? '#f2c030' : '#e0302a');
      ell(l, x + 3, y - 4, 6, 6, yel ? '#c8901a' : '#a8201a');
      ell(l, x - 3, y - 10, 4, 4, yel ? '#fbe08a' : '#f88a70');
      px(l, x - 4, y - 12, '#ffffff', 2, 2);
      px(l, x - 10, y - 8, '#fbf6ee', 20, 3);
      px(l, x - 10, y - 6, '#c8c4bc', 20, 1);
      px(l, x, y - 30, GEAR[3], 2, 20);
      fillPoly(l, [[x + 2, y - 30], [x + 11, y - 27], [x + 2, y - 24]], yel ? '#e0302a' : '#fbf6ee');
    }, { outline: 0.6 });
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const u = p.k / 4;
    const t = (k.t * 0.5 + k.seed * 0.3) % 1;
    p.c.globalAlpha = 0.5 * (1 - t);
    for (let a = 0; a < 20; a++) {
      const ang = (a / 20) * Math.PI * 2;
      px(p.c, x + Math.cos(ang) * (8 + t * 14) * u, y + Math.sin(ang) * (3 + t * 6) * u, '#e8f8fa', Math.max(1, u), Math.max(1, u));
    }
    p.c.globalAlpha = 1;
  },
};

// ── the wash of the waves (live) ────────────────────────────
const surf: PropArt = {
  live: true,
  draw(p, k) {
    const u = p.k / 4;
    const t = k.t;
    // world rows covered by the footprint; the shore runs along y here
    const y0 = p.y;
    const y1 = p.y + (p.rot === 0 ? k.d : k.w);
    for (let wave = 0; wave < 2; wave++) {
      const ph = (t * 0.11 + wave * 0.5 + k.seed * 0.17) % 1;
      // a crest rolls in, runs up the sand and fades
      const off = 0.9 - ph * 1.5;
      const alpha = ph < 0.75 ? 0.9 : (1 - ph) * 3.6;
      let prev: [number, number] | null = null;
      for (let yy = y0; yy <= y1 + 1e-6; yy += 0.08) {
        const xc = coastX(yy) + off + Math.sin(yy * 3.1 + wave * 2 + t * 0.4) * 0.12;
        const a = xc - p.x;
        const b = yy - p.y;
        const q = p.rot === 0 ? p.P(a, b, 0) : p.P(p.pw - b, a, 0);
        if (prev) {
          p.c.globalAlpha = alpha;
          ln(p.c, prev[0], prev[1], q[0], q[1], '#ffffff', Math.max(1, Math.round(2 * u)));
          p.c.globalAlpha = alpha * 0.5;
          ln(p.c, prev[0] + 4 * u, prev[1] + 2 * u, q[0] + 4 * u, q[1] + 2 * u, '#d8f2f4', Math.max(1, Math.round(u)));
        }
        prev = q;
      }
    }
    p.c.globalAlpha = 1;
  },
};

// ── flat details on the ground ──────────────────────────────
const decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'shells';
    const c = p.c;
    const Rn = rng(k.seed * 7 + 13);
    const [x, y] = anchor(p, 0.5 * p.pw, 0.5 * p.pd);
    if (v === 'towel') {
      const cols = [CANVAS[Math.floor(Rn() * CANVAS.length)][0], '#f6eedc', CANVAS[Math.floor(Rn() * CANVAS.length)][0]];
      towel(c, p, 0.5, 0.5, 0.4, 0.78, cols, (Rn() - 0.5) * 0.8);
      if (Rn() < 0.6) {
        const [fx, fy] = p.P(0.5 + (Rn() - 0.5) * 0.3, 0.85);
        px(c, fx - 4, fy - 1, ['#2a5a9a', '#e06a4a', '#f2c84a'][Math.floor(Rn() * 3)], 3, 2);
        px(c, fx + 1, fy, ['#2a5a9a', '#e06a4a', '#f2c84a'][Math.floor(Rn() * 3)], 3, 2);
      }
      if (Rn() < 0.4) {
        const [bx, by] = p.P(0.5, 0.3);
        px(c, bx - 3, by - 1, '#1e1e24', 7, 2);
        px(c, bx - 4, by - 1, '#1e1e24', 1, 1);
      }
    } else if (v === 'cooler' || v === 'kit') {
      // sunbathers' gear: a towel with a cool box, a beach bag, sandals and a bottle
      const cols = [CANVAS[Math.floor(Rn() * CANVAS.length)][0], '#f6eedc', CANVAS[Math.floor(Rn() * CANVAS.length)][0]];
      towel(c, p, 0.42, 0.5, 0.4, 0.8, cols, (Rn() - 0.5) * 0.6);
      const [cx, cy] = p.P(0.82, 0.3);
      const body = ['#2a8ab8', '#e0402a', '#1e8a90', '#f2c84a'][Math.floor(Rn() * 4)];
      ell(c, cx + 4, cy + 3, 10, 4, 'rgba(70,40,20,0.35)');
      if (v === 'cooler') {
        fillPoly(c, [[cx - 9, cy - 2], [cx, cy + 3], [cx, cy - 7], [cx - 9, cy - 12]], darken(body, 0.2));
        fillPoly(c, [[cx, cy + 3], [cx + 8, cy - 1], [cx + 8, cy - 11], [cx, cy - 7]], body);
        fillPoly(c, [[cx - 9, cy - 12], [cx, cy - 7], [cx + 8, cy - 11], [cx - 1, cy - 16]], '#fbf6ee');
        px(c, cx - 3, cy - 14, '#c8c4bc', 6, 1);
      } else {
        fillPoly(c, [[cx - 8, cy], [cx + 7, cy - 2], [cx + 6, cy - 12], [cx - 7, cy - 10]], body);
        px(c, cx - 7, cy - 10, lighten(body, 0.3), 13, 1);
        ln(c, cx - 4, cy - 10, cx, cy - 17, '#3a3036');
        ln(c, cx, cy - 17, cx + 4, cy - 11, '#3a3036');
        for (let i = 0; i < 3; i++) px(c, cx - 5 + i * 4, cy - 7, '#fbf6ee', 2, 4);
      }
      const [bx, by] = p.P(0.2, 0.86);
      px(c, bx - 1, by - 8, '#e8f4f8', 3, 8);
      px(c, bx - 1, by - 10, '#2a5ab8', 3, 2);
      px(c, bx + 4, by - 1, ['#e0402a', '#f2c84a', '#2a5ab8'][Math.floor(Rn() * 3)], 4, 2);
      px(c, bx + 9, by, ['#e0402a', '#f2c84a', '#2a5ab8'][Math.floor(Rn() * 3)], 4, 2);
    } else if (v === 'steps') {
      // a trail of bare footprints
      const dir = Rn() * Math.PI * 2;
      for (let i = 0; i < 9; i++) {
        const t = i / 8 - 0.5;
        const a = 0.5 + Math.cos(dir) * t * 0.9 + (i % 2 ? 0.05 : -0.05) * Math.sin(dir);
        const b = 0.5 + Math.sin(dir) * t * 0.9 - (i % 2 ? 0.05 : -0.05) * Math.cos(dir);
        const [fx, fy] = p.P(a, b);
        ell(c, fx, fy, 2.2, 1.2, '#b8986c');
        px(c, fx - 1, fy - 1, '#c8a87a', 2, 1);
      }
    } else if (v === 'shells') {
      for (let i = 0; i < 6; i++) {
        const [sx, sy] = p.P(Rn(), Rn());
        const col = ['#fbf4ea', '#f2d4c4', '#e8c0a8', '#d8d0c4'][Math.floor(Rn() * 4)];
        ell(c, sx, sy, 2.5, 1.6, col);
        px(c, sx - 1, sy - 1, '#ffffff');
      }
      if (Rn() < 0.4) {
        const [sx, sy] = p.P(Rn(), Rn());
        fillPoly(c, [[sx, sy - 4], [sx + 1.5, sy - 1], [sx + 5, sy - 1], [sx + 2, sy + 1], [sx + 3, sy + 4], [sx, sy + 2], [sx - 3, sy + 4], [sx - 2, sy + 1], [sx - 5, sy - 1], [sx - 1.5, sy - 1]], '#e8804a');
      }
    } else if (v === 'wrack') {
      for (let i = 0; i < 14; i++) {
        const [sx, sy] = p.P(Rn(), Rn());
        ln(c, sx, sy, sx + 4 + Rn() * 4, sy + (Rn() - 0.5) * 3, ['#3a4228', '#4e5430', '#5e6034'][Math.floor(Rn() * 3)], 2);
      }
    } else if (v === 'ball') {
      ell(c, x + 3, y + 2, 7, 3, 'rgba(60,40,30,0.25)');
      ell(c, x, y - 4, 6, 6, '#fbf6ee');
      fillPoly(c, [[x, y - 10], [x + 6, y - 4], [x, y - 4]], '#e0402a');
      fillPoly(c, [[x - 6, y - 4], [x, y - 4], [x, y + 2]], '#2a5ab8');
      fillPoly(c, [[x, y - 4], [x + 6, y - 4], [x, y + 2]], '#f2c84a');
      px(c, x - 3, y - 8, '#ffffff', 2, 2);
    } else if (v === 'heart') {
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        const hx = 16 * Math.sin(t) ** 3;
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        px(c, x + hx * 1.2, y + hy * 0.6, '#b8986c', 2, 1);
      }
    } else if (v === 'iceplant' || v === 'gazania') {
      // a mat of succulent ice plant (pink flowers) or gazanias (orange and yellow) on the sand
      const fl = v === 'iceplant' ? ['#f06aa8', '#f8a0c8', '#e04a90'] : ['#f2902a', '#f6c040', '#e8602a'];
      for (let i = 0; i < 26; i++) {
        const a = 0.15 + Rn() * 0.7;
        const b = 0.15 + Rn() * 0.7;
        const [sx, sy] = p.P(a, b);
        ell(c, sx, sy, 5 + Rn() * 4, 2.6 + Rn() * 1.6, i % 3 ? '#4e7a3a' : '#5e8e44');
        ell(c, sx - 1, sy - 1, 3, 1.4, '#7aa852');
      }
      for (let i = 0; i < 18; i++) {
        const [sx, sy] = p.P(0.18 + Rn() * 0.64, 0.18 + Rn() * 0.64);
        px(c, sx - 1, sy - 1, fl[Math.floor(Rn() * 3)], 3, 2);
        px(c, sx, sy - 1, '#fff2c0', 1, 1);
      }
    } else if (v === 'chalk') {
      // chalk on the boards: a sun, a fish, a hopscotch, hearts, in soft pastel
      const cols = ['#f8e0a0', '#f8b8c8', '#a8d8f0', '#c8f0c0', '#f6f2ea'];
      const kind = Math.floor(Rn() * 3);
      if (kind === 0) {
        for (let a = 0; a < 24; a++) {
          const t = (a / 24) * Math.PI * 2;
          px(c, x + Math.cos(t) * 10, y + Math.sin(t) * 5, cols[0], 2, 1);
        }
        for (let i = 0; i < 8; i++) {
          const t = (i / 8) * Math.PI * 2;
          ln(c, x + Math.cos(t) * 13, y + Math.sin(t) * 6.5, x + Math.cos(t) * 18, y + Math.sin(t) * 9, cols[0]);
        }
      } else if (kind === 1) {
        for (let i = 0; i < 5; i++) {
          const [qx, qy] = p.P(0.15 + i * 0.16, 0.5);
          const col = cols[i % 5];
          ln(c, qx - 7, qy - 3, qx + 7, qy + 4, col);
          ln(c, qx - 7, qy - 3, qx - 1, qy - 6, col);
          ln(c, qx + 7, qy + 4, qx + 13, qy + 1, col);
          px(c, qx + 1, qy - 1, col, 2, 2);
        }
      } else {
        for (let a = 0; a < 30; a++) {
          const t = (a / 30) * Math.PI * 2;
          px(c, x - 6 + Math.cos(t) * 12, y + Math.sin(t) * 5, cols[2], 2, 1);
        }
        ln(c, x + 6, y, x + 14, y - 5, cols[2]);
        ln(c, x + 6, y, x + 14, y + 5, cols[2]);
        px(c, x - 12, y - 1, cols[1], 2, 2);
        for (let i = 0; i < 3; i++) px(c, x - 4 + i * 4, y - 9 - i, cols[3], 2, 2);
      }
    } else if (v === 'splat') {
      for (let i = 0; i < 5; i++) {
        const [sx, sy] = p.P(0.2 + Rn() * 0.6, 0.2 + Rn() * 0.6);
        const col = ['#e0603e', '#2a8a86', '#e8b03e', '#5a7ac8', '#f0a6c0'][Math.floor(Rn() * 5)];
        ell(c, sx, sy, 3 + Rn() * 5, 1.5 + Rn() * 2.5, col);
        for (let j = 0; j < 4; j++) px(c, sx + (Rn() - 0.5) * 20, sy + (Rn() - 0.5) * 9, col, 2, 1);
      }
    } else if (v === 'cable') {
      // a cable snaking across the floor, taped down
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const q = p.P(t * p.pw, 0.5 + Math.sin(t * 7 + k.seed) * 0.12);
        if (prev) ln(c, prev[0], prev[1], q[0], q[1], '#24232b', 2);
        prev = q;
      }
      const [tx, ty] = p.P(p.pw * 0.5, 0.5 + Math.sin(3.5 + k.seed) * 0.12);
      fillPoly(c, [[tx - 8, ty - 2], [tx + 2, ty - 6], [tx + 8, ty - 3], [tx - 2, ty + 1]], '#e8e4da');
    } else if (v === 'paper') {
      for (let i = 0; i < 3; i++) {
        const [sx, sy] = p.P(0.25 + Rn() * 0.5, 0.25 + Rn() * 0.5);
        fillPoly(c, [[sx - 9, sy], [sx + 1, sy - 5], [sx + 10, sy], [sx, sy + 5]], '#f8f4ea');
        ln(c, sx - 4, sy, sx + 3, sy - 3, '#7a7068');
        ln(c, sx - 2, sy + 2, sx + 5, sy - 1, '#e0603e');
      }
    }
  },
};

export const STUDIO_BEACH: Record<string, PropArt> = {
  std_palm: palm,
  std_marram: marram,
  std_dune: dune,
  std_sandFence: sandFence,
  std_ropeFence: ropeFence,
  std_deckchair: deckchair,
  std_umbrella: umbrella,
  std_castle: castle,
  std_bush: bush,
  std_groyne: groyne,
  std_buoy: buoy,
  std_surf: surf,
  std_decal: decal,
};
export { towel, CANVAS, frond };

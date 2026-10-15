// Research Hub — drawing helpers of this pack (primitives over kit4: curved
// volumes shaded per pixel, a few surface materials, rows of books).
import { darken, lighten } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import { parseColor } from '../../../hd/soft';
import type { PropPainter } from '../../../iso';
import { at, bayer, type C, hash, noise2, px, type Ramp, soft } from '../../kit4';
import { type Plane, pq } from '../../plane4';

/** One pixel, written straight into a CPU layer when possible. */
export function plot(c: C, x: number, y: number, col: string) {
  const s = soft(c);
  if (s && s.globalAlpha >= 0.999) {
    const xx = Math.round(x) - s.ox;
    const yy = Math.round(y) - s.oy;
    if (xx < 0 || yy < 0 || xx >= s.width || yy >= s.height) return;
    s.data[yy * s.width + xx] = (parseColor(col) | 0xff000000) >>> 0;
    s.touch(xx, yy, xx + 1, yy + 1);
    return;
  }
  px(c, x, y, col);
}

// one sun from the upper left: +y faces lit, +x faces in shade, tops brightest
const LX = -0.42;
const LY = 0.62;
const LZ = 0.66;
const LN = Math.hypot(LX, LY, LZ);
/** Diffuse light of a unit normal (−1 … 1). */
export const lightOf = (nx: number, ny: number, nz: number) => (nx * LX + ny * LY + nz * LZ) / LN;

/** Ramp index from light, dithered: ambient + diffuse. */
export function toneOf(r: Ramp, l: number, x: number, y: number, amb = 0.22, gain = 0.78, dz = 0.7) {
  const v = amb + gain * Math.max(0, l);
  const t = v * (r.length - 1) + (bayer(x, y) - 0.5) * dz;
  return t <= 0 ? 0 : t >= r.length - 1 ? r.length - 1 : Math.round(t);
}

/**
 * A sphere (or its upper half) of radius r tiles centred on screen (cx, cy):
 * every pixel gets the normal of the front-most surface point. `paint`
 * returns a colour for a pixel from its normal (or null to skip).
 */
export function sphere(c: C, k: number, cx: number, cy: number, r: number, paint: (nx: number, ny: number, nz: number, x: number, y: number) => string | null, o: { upper?: boolean; clipY?: number } = {}) {
  const A = 16 * k;
  const B = 8 * k;
  const rx = Math.ceil(r * 1.4143 * A) + 1;
  const ry = Math.ceil(r * 1.23 * A) + 1;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    if (o.clipY !== undefined && y > o.clipY) break;
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const a = (x + 0.5 - cx) / A;
      const R2 = r * r - (a * a) / 2;
      if (R2 <= 0) continue;
      const q = (y + 0.5 - cy) / B;
      const disc = 12 * R2 - 2 * q * q;
      if (disc < 0) continue;
      const z = (-2 * q + Math.sqrt(disc)) / 6;
      if (o.upper && z < 0) continue;
      const b = q + 2 * z;
      const nx = (a + b) / 2 / r;
      const ny = (b - a) / 2 / r;
      const col = paint(nx, ny, z / r, x, y);
      if (col) plot(c, x, y, col);
    }
  }
}

/**
 * The front half of a vertical cylinder of radius r tiles whose base centre is
 * at screen (cx, cy), from height z0 to z1 (z units). `paint` gets the normal,
 * the angle round the axis (0 … π, left → right) and the height.
 */
export function cylinder(c: C, k: number, cx: number, cy: number, r: number, z0: number, z1: number, paint: (nx: number, ny: number, ang: number, z: number, x: number, y: number) => string | null) {
  const A = 16 * k;
  const B = 8 * k;
  const rx = Math.ceil(r * 1.4143 * A);
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const a = (x + 0.5 - cx) / A;
    const d = 2 * r * r - a * a;
    if (d < 0) continue;
    const b = Math.sqrt(d);
    const nx = (a + b) / 2 / r;
    const ny = (b - a) / 2 / r;
    const yb = cy + b * B;
    const ang = Math.acos(Math.max(-1, Math.min(1, -a / (r * 1.4143))));
    for (let y = Math.floor(yb - z1 * k); y < yb - z0 * k; y++) {
      const z = (yb - (y + 0.5)) / k;
      const col = paint(nx, ny, ang, z, x, y);
      if (col) plot(c, x, y, col);
    }
  }
}

/** The top disc of a cylinder (an ellipse) at height z. */
export function disc(c: C, k: number, cx: number, cy: number, r: number, z: number, col: (x: number, y: number, u: number, v: number) => string | null) {
  const A = 16 * k;
  const B = 8 * k;
  const rx = r * 1.4143 * A;
  const ry = r * 1.4143 * B;
  const yc = cy - z * k;
  for (let y = Math.floor(yc - ry); y <= yc + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - yc) / ry;
      if (u * u + v * v > 1) continue;
      const cc = col(x, y, u, v);
      if (cc) plot(c, x, y, cc);
    }
}

// ── surface materials ───────────────────────────────────────
const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/** Smooth leather: a sheen near the top, soft creases, a darker welt along the bottom. */
export const leather =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.3;
    if (v > h - 3) i += 1.2;
    else if (v > h - 7 && bayer(x, y) > 0.4) i += 0.6;
    if (v < 1.5) i -= 1.2;
    const n = noise2(u * 0.09, v * 0.16, 81);
    if (n > 0.7) i += 0.6;
    else if (n < 0.24 && bayer(x, y) > 0.3) i -= 0.7;
    if (hash(x, y, 82) < 0.03) i -= 0.6;
    return at(r, i);
  };

/** Vertical tongue-and-groove stone-pine boards: honey grain, dark knots, a groove shadow. */
export const pineBoards =
  (r: Ramp, bw = 12): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const b = Math.floor(u / bw);
    const fu = u - b * bw;
    let i = base(light, r.length) + (hash(b, 1, 83) - 0.5) * 1.1 + 0.2;
    if (fu < 1) return at(r, i - 2.4);
    if (fu < 2) i += light ? 0.8 : 0.4;
    if (fu > bw - 1.4) i -= 0.8;
    // grain: thin wavy streaks along the board
    const g = noise2(fu * 0.45 + b * 5.3 + Math.sin(v * 0.07 + b) * 0.8, v * 0.05, 84);
    if (g > 0.66) i -= 0.9;
    else if (g < 0.2) i += 0.5;
    // knots: the stone pine is famous for them — a dark ring and a darker heart
    for (let kk = 0; kk < 2; kk++) {
      if (hash(b, kk + 3, 85) > 0.62) continue;
      const kx = 3 + hash(b, kk + 5, 86) * (bw - 6);
      const ky = h * hash(b, kk + 7, 87);
      const d = Math.hypot((fu - kx) * 1.3, (v - ky) * 0.8);
      if (d < 1.6) return at(r, i - 2.6);
      if (d < 3) return at(r, i - 1.3);
    }
    if (hash(x, y, 88) < 0.02) i -= 0.8;
    return at(r, i);
  };

/**
 * Mortared rubble masonry: irregular stones (a Voronoi of flattened cells),
 * each a lumpy block lit on its top, set in pale lime mortar. The pattern is
 * solved once per ramp and light into a seamless tile (the Voronoi wraps), so
 * big facades cost an array lookup per pixel.
 */
const RUB_RUST: Ramp = ['#5a3a26', '#74482c', '#8c5a36', '#a46e44', '#b88252', '#c89664', '#d6a878'];
const rubbleTiles = new Map<string, { w: number; h: number; idx: Uint8Array; cols: string[] }>();
function rubbleTile(r: Ramp, m: Ramp, size: number, light: number) {
  const key = `${r.join()}|${m.join()}|${size}|${light}`;
  let t = rubbleTiles.get(key);
  if (t) return t;
  const S = size;
  const SV = Math.max(4, Math.round(S * 0.62));
  const NX = 16;
  const NY = 15;
  const w = S * NX;
  const h = SV * NY;
  const cols: string[] = [];
  const colIdx = new Map<string, number>();
  const idx = new Uint8Array(w * h);
  const put = (c: string) => {
    let i = colIdx.get(c);
    if (i === undefined) {
      i = cols.length;
      cols.push(c);
      colIdx.set(c, i);
    }
    return i;
  };
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const gx = Math.floor(u / S);
      const gy = Math.floor(v / SV);
      let d1 = 1e9;
      let d2 = 1e9;
      let fy = 0;
      let id = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const cx = gx + i;
          const cy = gy + j;
          const hx = ((cx % NX) + NX) % NX;
          const hy = ((cy % NY) + NY) % NY;
          const px0 = (cx + 0.12 + hash(hx, hy, 91) * 0.76) * S;
          const py0 = (cy + 0.12 + hash(hx, hy, 92) * 0.76) * SV;
          const d = Math.hypot(u + 0.5 - px0, (v + 0.5 - py0) * (S / SV) * 0.96);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            fy = py0;
            id = hx * 7349 + hy * 1913;
          } else if (d < d2) d2 = d;
        }
      const gap = d2 - d1;
      let c: string;
      if (gap < 2.2) c = at(m, (light === 0 ? 0.6 : 1.8) + (hash(u, v, 93) < 0.2 ? -1 : 0) + (gap < 1 ? -0.6 : 0));
      else {
        let i = base(light, r.length) + (hash(id, 1, 94) - 0.5) * 2;
        const dv = v + 0.5 - fy;
        if (dv > S * 0.1) i += 0.9;
        else if (dv < -S * 0.12) i -= 0.8;
        if (gap < 3.4) i -= 0.6;
        if (hash(u, v, 95) < 0.05) i -= 1;
        c = hash(id, 2, 96) < 0.08 ? at(RUB_RUST, i) : at(r, i);
      }
      idx[v * w + u] = put(c);
    }
  t = { w, h, idx, cols };
  rubbleTiles.set(key, t);
  return t;
}

export const rubble =
  (r: Ramp, m: Ramp, size = 13): Mat =>
  (light) => {
    const t = rubbleTile(r, m, size, light);
    const { w, h, idx, cols } = t;
    return (u, v) => {
      const uu = ((Math.floor(u) % w) + w) % w;
      const vv = ((Math.floor(v) % h) + h) % h;
      return cols[idx[vv * w + uu]];
    };
  };

/** Horizontal squared logs (Blockbau): rounded profile, checks, a dark seam between logs. */
export const logs =
  (r: Ramp, lh = 9): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const row = Math.floor(v / lh);
    const fv = v - row * lh;
    let i = base(light, r.length) + (hash(row, 1, 97) - 0.5) * 0.8;
    if (fv < 1.2) return at(r, 0);
    // rounded: lit upper band, shaded lower band
    if (fv > lh - 2.5) i += 1;
    else if (fv < 3) i -= 0.7;
    // checks (drying cracks) and grain along the log
    if (noise2(u * 0.05 + row * 11, fv * 0.6, 98) > 0.74) i -= 1.1;
    if (hash(Math.floor(u / 3), row, 99) < 0.04) i -= 0.6;
    // the sun burns the upper logs darker, splashes lighten the bottom
    if (v > h * 0.7) i -= 0.4;
    if (hash(x, y, 100) < 0.03) i += 0.7;
    return at(r, i);
  };

/** Stone-slab roof (piode): big irregular gneiss slabs, thick lips, lichen. */
export const piode =
  (r: Ramp, rowH = 12): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = hash(row, 3, 101) * 30;
    // slabs of uneven width
    const cell = Math.floor((u + off) / 26);
    const split = hash(cell, row, 102) * 26;
    const sub = (u + off - cell * 26) > split ? 1 : 0;
    const id = cell * 2 + sub + row * 977;
    const drop = hash(id, 4, 103) * 3;
    let i = (light === 0 ? 1.4 : light === 2 ? 3.8 : 3) + (hash(id, 5, 104) - 0.5) * 1.6;
    if (fv < 1.6 + drop * 0.5) return at(r, i - 2.2);
    if (fv < 3.2 + drop * 0.4) i -= 0.8;
    const su = (u + off - cell * 26) - (sub ? split : 0);
    if (su < 1.2) i -= 1.2;
    if (fv > rowH - 2) i += 0.8;
    if (hash(x, y, 105) < 0.05) i -= 0.8;
    // lichen in muted yellow and grey-green blots on a few old slabs, moss in the damp lower rows
    const n = noise2(u * 0.08, v * 0.1, 106);
    if (n > 0.86 && hash(id, 6, 107) < 0.4) return n > 0.92 ? '#9a9450' : '#7a8466';
    if (fv > rowH - 3 && hash(id, 8, 109) < 0.12 && hash(x, y, 110) < 0.5) return '#4a5a3a';
    return at(r, i);
  };

/** Lime-washed plaster over stone, a little uneven. */
export const limewash =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.4;
    const n = noise2(u * 0.04, v * 0.05, 108) + noise2(u * 0.13, v * 0.11, 109) * 0.4;
    if (n > 0.95 && bayer(x, y) > 0.5) i += 0.7;
    else if (n < 0.42 && bayer(x, y) > 0.5) i -= 0.8;
    if (v < 9 && bayer(x, y) * 9 > v) i -= 0.8;
    if (hash(x, y, 110) < 0.03) i -= 0.8;
    return at(r, i);
  };

/** Painted panel colour on a plane (flat with a lit top lip). */
export const flat =
  (col: string): FaceTex =>
  () =>
    col;

// ── faceted rock ────────────────────────────────────────────
/**
 * A granite rock mass: an irregular blob whose normals snap to a handful of
 * random facets, so it reads as split, glacier-worn stone (crisp facet edges,
 * lit upper-left faces), with cracks, lichen and a mossy, grassy foot.
 * (x, y) is the screen centre of the mass, (rx, ry) its radii; the base is
 * flattened onto the ground at y + ry * 0.62.
 */
export function rockMass(c: C, x: number, y: number, rx: number, ry: number, seed: number, r: Ramp, o: { lichen?: number; moss?: number; snow?: boolean } = {}) {
  const R = (i: number) => hash(seed, i, 401);
  const nf = 7;
  const fac: [number, number, number][] = [];
  for (let i = 0; i < nf; i++) {
    const a = R(i * 3) * Math.PI * 2;
    const el = 0.25 + R(i * 3 + 1) * 1.0;
    fac.push([Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el) * 0.8 - 0.15, Math.sin(el)]);
  }
  fac.push([-0.3, -0.5, 0.82]);
  const ph1 = R(40) * 6;
  const ph2 = R(41) * 6;
  const base = y + ry * 0.62;
  const N = r.length;
  for (let py = Math.floor(y - ry * 1.3); py <= base + 1; py++)
    for (let px0 = Math.floor(x - rx * 1.25); px0 <= x + rx * 1.25; px0++) {
      const dx = (px0 + 0.5 - x) / rx;
      const dy = (py + 0.5 - y) / ry;
      const th = Math.atan2(dy, dx);
      const rr = 1 + 0.13 * Math.sin(3 * th + ph1) + 0.08 * Math.sin(5 * th + ph2);
      const d2 = (dx * dx + dy * dy) / (rr * rr);
      if (d2 > 1 || py > base) continue;
      const nz = Math.sqrt(1 - d2);
      const bx = dx / rr;
      const by = dy / rr;
      let best = -9;
      let second = -9;
      let bi = 0;
      for (let i = 0; i < fac.length; i++) {
        const d = bx * fac[i][0] + by * fac[i][1] + nz * fac[i][2];
        if (d > best) {
          second = best;
          best = d;
          bi = i;
        } else if (d > second) second = d;
      }
      const f = fac[bi];
      let l = -f[0] * 0.55 - f[1] * 0.68 + f[2] * 0.48;
      l = Math.max(0, l) * 0.95 + 0.08;
      let t = l * (N - 1) + (bayer(px0, py) - 0.5) * 0.6 + (hash(bi, seed, 402) - 0.5) * 0.6;
      if (best - second < 0.025) t -= 1.2;
      // cracks
      if (Math.abs(Math.sin(dx * 7 + ph1 + dy * 3)) < 0.04 && hash(px0 >> 2, py >> 2, seed) < 0.5) t -= 1.5;
      // snow on the flattest tops
      if (o.snow && f[2] > 0.8 && by < -0.2 && hash(px0 >> 1, py >> 1, seed + 3) < 0.8) {
        plot(c, px0, py, l > 0.55 ? '#f4f8fc' : '#c4d0e0');
        continue;
      }
      // lichen blots and moss at the foot
      const lich = hash(px0 >> 1, py >> 1, seed + 5);
      if (lich < (o.lichen ?? 0.05) && l > 0.3) {
        plot(c, px0, py, ['#b4a83c', '#c8843a', '#9aa070', '#d0c860'][(hash(px0 >> 2, py >> 2, seed) * 4) | 0]);
        continue;
      }
      if (o.moss && py > base - ry * 0.35 * o.moss && hash(px0, py, seed + 7) < 0.55) {
        plot(c, px0, py, ['#2e4a22', '#3a5a28', '#4a6a30'][(hash(px0, py >> 1, seed) * 3) | 0]);
        continue;
      }
      if (hash(px0, py, seed + 9) < 0.04) t -= 1;
      plot(c, px0, py, r[t <= 0 ? 0 : t >= N - 1 ? N - 1 : Math.round(t)]);
    }
}

/** A skirt of grass blades round the foot of something, along an ellipse on the ground. */
export function grassSkirt(c: C, x: number, y: number, rx: number, ry: number, seed: number, n = 14, ramp: Ramp = ['#2e4a22', '#3c5e28', '#4e7430', '#64883a', '#7e9e46', '#9ab452']) {
  for (let i = 0; i < n; i++) {
    const a = hash(i, 1, seed) * Math.PI + 0.1;
    const bx = x + Math.cos(a) * rx * (0.8 + hash(i, 2, seed) * 0.3);
    const by = y + Math.sin(a) * ry * (0.7 + hash(i, 3, seed) * 0.3);
    const h = 3 + hash(i, 4, seed) * 5;
    const lean = hash(i, 5, seed) < 0.5 ? -1 : 1;
    for (let j = 0; j < h; j++) plot(c, bx + (j > h * 0.6 ? lean : 0), by - j, ramp[Math.min(ramp.length - 1, 1 + Math.floor((j / h) * (ramp.length - 1)))]);
  }
}

// ── rows of books ───────────────────────────────────────────
export const SPINES = ['#6a1e1c', '#2a3e5a', '#2e4a30', '#5a3a1e', '#7a5a2a', '#3a2a40', '#8a3a24', '#1e3a3a', '#4a1a2a', '#6a5a3a'];

/**
 * A row of upright books along a front plane from a0 to a1 on a shelf at z0:
 * spines in leather with gilt bands, the odd leaning volume, gaps.
 */
export function bookRow(p: PropPainter, F: Plane, a0: number, a1: number, z0: number, hMax: number, rnd: () => number, o: { tall?: boolean; boxes?: number } = {}) {
  let a = a0;
  while (a < a1 - 0.04) {
    const r = rnd();
    if (o.boxes && r < o.boxes && a < a1 - 0.3) {
      // an archive box: buff or slate board, a paper label, a pull ring
      const bw = 0.22 + rnd() * 0.06;
      const bh = Math.min(hMax, 3.2 + rnd() * 0.6);
      const col = rnd() < 0.55 ? ['#8a7458', '#a48c6c', '#bca482'][Math.floor(rnd() * 3)] : ['#4e5a66', '#5e6a76', '#6a5a4a'][Math.floor(rnd() * 3)];
      pq(p, F, a, a + bw, z0, z0 + bh, darken(col, 0.25));
      pq(p, F, a + 0.012, a + bw - 0.012, z0, z0 + bh - 0.15, F.light ? col : darken(col, 0.12));
      pq(p, F, a + bw * 0.22, a + bw * 0.78, z0 + bh * 0.52, z0 + bh * 0.8, '#efe6d0');
      pq(p, F, a + bw * 0.28, a + bw * 0.66, z0 + bh * 0.66, z0 + bh * 0.7, '#5a5048');
      const [rx, ry] = F.F(a + bw / 2, z0 + bh * 0.3);
      px(p.c, rx - 1, ry - 1, '#2a2420', 3, 2);
      a += bw + 0.01;
      continue;
    }
    if (r < 0.06) {
      a += 0.03 + rnd() * 0.05; // a gap
      continue;
    }
    const w = (o.tall ? 0.06 : 0.045) + rnd() * 0.045;
    const h = Math.min(hMax, (o.tall ? 3.1 : 2.3) + rnd() * 1.2);
    const col = SPINES[Math.floor(rnd() * SPINES.length)];
    const c = F.light ? col : darken(col, 0.15);
    pq(p, F, a, a + w, z0, z0 + h, c);
    pq(p, F, a, a + w * 0.28, z0, z0 + h, lighten(c, 0.14));
    // gilt bands on the spine, a label on the tall ledgers
    if (w > 0.06 || rnd() < 0.6) {
      pq(p, F, a, a + w, z0 + h * 0.82, z0 + h * 0.86, '#c8a04a');
      pq(p, F, a, a + w, z0 + h * 0.16, z0 + h * 0.2, '#a8843a');
    }
    if (o.tall && rnd() < 0.5) pq(p, F, a + w * 0.15, a + w * 0.85, z0 + h * 0.55, z0 + h * 0.68, '#e8dcc0');
    pq(p, F, a, a + w, z0 + h - 0.12, z0 + h, darken(c, 0.3));
    a += w + 0.004;
  }
}

/** A thin strip of soft shadow under something, on a plane. */
export function shadowStrip(p: PropPainter, F: Plane, a0: number, a1: number, z0: number, z1: number, alpha = 0.22) {
  p.c.globalAlpha = alpha;
  pq(p, F, a0, a1, z0, z1, '#2a1a2a');
  p.c.globalAlpha = 1;
}

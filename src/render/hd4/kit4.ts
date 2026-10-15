// ─────────────────────────────────────────────────────────────
// 128×64 art kit — the Farm's 2× fidelity asset library.
//
// Everything here draws in native pixels (1 art pixel = 1 frame pixel at
// zoom 1, tile 128×64, 1 world z unit = 4 px). Assets rasterise into a
// SoftCtx (CPU) so they can use layers: each element (canopy, trunk,
// roof…) is drawn into its own layer, outlined selectively, then
// composited — the way a pixel artist separates and outlines parts.
//
// Light comes from the upper left; shadows fall to the lower right.
// Every material uses a 5–7 tone hue-shifted ramp; outlines are dark warm
// tones of the colour they enclose, never black.
// ─────────────────────────────────────────────────────────────

import { darken, lighten, mix } from '../color';
import { parseColor, SoftCtx } from '../hd/soft';

export type C = CanvasRenderingContext2D;
export type Ramp = readonly string[];
export const OUTL = '#3b2a26';
export const SHADOW = '#2a1a2a';

// ── deterministic noise ─────────────────────────────────────
export function hash(a: number, b = 0, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function rng(seed: number) {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
export function noise2(x: number, y: number, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

// ── ramps ───────────────────────────────────────────────────
/** Build a hue-shifted ramp around a base colour: shadows lean purple/blue, lights lean warm. */
export function rampOf(base: string, n = 6, spread = 0.5): string[] {
  const out: string[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const t = (i - mid) / mid; // -1 … 1
    if (t < 0) out.push(mix(darken(base, -t * spread), '#3a2a5a', -t * 0.22));
    else out.push(mix(lighten(base, t * spread * 0.8), '#fff2c0', t * 0.18));
  }
  return out;
}
/** Ramp tone at a (fractional) index, rounded then clamped to the ramp. */
export const at = (r: Ramp, i: number) => {
  const j = Math.round(i);
  return r[j < 0 ? 0 : j >= r.length ? r.length - 1 : j];
};

export const R = {
  // foliage families (7 tones, deep → sunlit)
  oak: ['#1b3524', '#22452a', '#2d5a2f', '#3b7034', '#4f883a', '#69a044', '#8cba52'],
  apple: ['#1f3d26', '#284f2c', '#356632', '#457d38', '#5a953f', '#78ad4a', '#9cc65c'],
  birch: ['#2c4a22', '#3a5e28', '#4c742e', '#618a35', '#7aa23e', '#98ba4c', '#bcd368'],
  pine: ['#132a2a', '#183631', '#1f4437', '#29553f', '#356748', '#467a52', '#5e9060'],
  willow: ['#283f20', '#344f26', '#42622c', '#537633', '#678c3b', '#80a447', '#a0bc5a'],
  cherry: ['#5e2440', '#7d3352', '#a24868', '#c4668a', '#df8eab', '#f2b6c8', '#fbdbe4'],
  poplar: ['#1d3a26', '#25492b', '#305c31', '#3e7136', '#50873c', '#6a9e46', '#8ab454'],
  hedge: ['#1c3622', '#244629', '#2f5a2f', '#3c6f35', '#4f863c', '#68a046', '#88b856'],
  bark: ['#2a1c16', '#3b281d', '#4f3625', '#65452f', '#7c573b', '#946c4a'],
  barkPale: ['#4a443e', '#6b645c', '#8f877d', '#b5ada2', '#d8d1c4', '#efe9de'],
  wood: ['#3a2418', '#553522', '#714a2e', '#8d5f3a', '#a97848', '#c4915a', '#dbad74'],
  woodGrey: ['#3c3530', '#57504a', '#736b63', '#90877d', '#ada398', '#c8bfb2'],
  woodPale: ['#4f3a2a', '#6d5440', '#8c6e54', '#aa8a6a', '#c6a684', '#dcc09e'],
  woodRed: ['#3d1a19', '#5c2522', '#7e322b', '#a04335', '#bd5841', '#d47354'],
  plaster: ['#7a685a', '#9d8a77', '#bfab92', '#d8c7aa', '#ebdec4', '#f7efdc'],
  stone: ['#3a3639', '#524d4f', '#6c6665', '#87807c', '#a39b94', '#bfb7ad', '#d6cfc4'],
  stoneWarm: ['#43372f', '#5d4d41', '#786454', '#937d69', '#ad977f', '#c6b198', '#dccab0'],
  brick: ['#45201c', '#622b23', '#80392c', '#9c4a37', '#b65e45', '#cc7a5a'],
  roof: ['#14302f', '#1b403c', '#235249', '#2d6656', '#3a7b64', '#4d9275', '#6aab8a'],
  roofRed: ['#3a1a1c', '#532425', '#6e302d', '#8a3e35', '#a65040', '#c06750'],
  glass: ['#24444c', '#2f5a63', '#3f7680', '#5a949a', '#82b6b6', '#b6dcd6', '#e4f6f0'],
  metal: ['#2d3038', '#43474f', '#5d626b', '#7a7f88', '#9ba0a8', '#c2c6cc', '#e6e8eb'],
  iron: ['#1c1a20', '#29262e', '#38343e', '#48444f', '#5b5762'],
  soil: ['#24160f', '#341f15', '#462b1d', '#593826', '#6d4630', '#83573b'],
  /** bare earth of paths and yards (the ground's dirt tones) */
  dirt: ['#6e4a30', '#83593a', '#9a6b45', '#ad7d52', '#c0905f', '#d2a771'],
  hay: ['#6a4818', '#8c6322', '#ad7f2e', '#c99a3c', '#dfb553', '#efce76', '#f8e6a4'],
  cream: ['#8a7c6a', '#ab9b84', '#c9b99d', '#e0d2b6', '#f0e6cf', '#fbf6e8'],
  water: ['#163f63', '#1d5079', '#25628d', '#30769f', '#418cb2', '#5ca5c4', '#86c2d6'],
  red: ['#4e1518', '#6e1f22', '#8f2b2a', '#b23b33', '#cf5340', '#e47658'],
  blue: ['#1f2d52', '#2b3f70', '#3a5490', '#4c6bad', '#6687c7', '#8aa8dc'],
  yellow: ['#6e4410', '#94621a', '#b88326', '#d6a534', '#ecc650', '#f6e086'],
  pink: ['#5e2142', '#84305a', '#a84472', '#c9608c', '#e386a8', '#f4b4c8'],
  purple: ['#2f2050', '#432e6c', '#5a408a', '#7457a6', '#9178c0', '#b39cd8'],
  white: ['#7c7a86', '#9e9ca6', '#bfbcc3', '#dbd8dc', '#efedee', '#ffffff'],
  orange: ['#5e2a0e', '#853e14', '#ab561c', '#cd7126', '#e8913a', '#f6b45e'],
  canvas: ['#6c5e4c', '#8c7c66', '#ac9b80', '#c8b89b', '#ded0b4', '#efe5cf'],
  skin: ['#6a3f2c', '#8c573c', '#b27650', '#d29a6e', '#e8bb8e', '#f6d7b2'],
} satisfies Record<string, readonly string[]>;

// ── raster helpers (native pixels) ─────────────────────────
export function px(c: C, x: number, y: number, col: string, w = 1, h = 1) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Filled ellipse, crisp. */
export function ell(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  const r = Math.max(0.5, ry);
  const n = Math.ceil(r);
  for (let dy = -n; dy <= n; dy++) {
    const yy = dy + 0.5 * Math.sign(dy);
    const t = 1 - (yy * yy) / (r * r + 0.25);
    if (t < 0) continue;
    const w = rx * Math.sqrt(t);
    const x0 = Math.round(cx - w);
    const x1 = Math.round(cx + w);
    if (x1 > x0) c.fillRect(x0, Math.round(cy + dy), x1 - x0, 1);
  }
}

/** Convex or concave polygon fill (even-odd), crisp scanlines. */
export function fillPoly(c: C, pts: [number, number][], col: string) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  c.fillStyle = col;
  const xs: number[] = [];
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]);
      const b = Math.round(xs[i + 1]);
      if (b > a) c.fillRect(a, y, b - a, 1);
    }
  }
}

/** 1-px line (Bresenham). */
export function ln(c: C, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  c.fillStyle = col;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 4000; i++) {
    c.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Quadratic curve as connected pixels. */
export function curve(c: C, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, w = 1) {
  const n = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  let px0 = x0;
  let py0 = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    ln(c, px0, py0, x, y, col, w);
    px0 = x;
    py0 = y;
  }
}

// ── layers ──────────────────────────────────────────────────
/** The SoftCtx behind an art context (HD4 art always rasterises on the CPU). */
export function soft(c: C): SoftCtx | null {
  return c instanceof SoftCtx ? c : null;
}

/**
 * Draw into a temporary layer the size of the target, optionally outline it
 * selectively, then composite it over the target. Falls back to drawing
 * directly when the target is not a SoftCtx.
 */
export function layer(c: C, draw: (l: C) => void, o: { outline?: number | false; alpha?: number; rect?: [number, number, number, number] } = {}) {
  const s = soft(c);
  if (!s) return draw(c);
  // a bounded layer when the caller knows the element's extent (cheap for many small parts)
  let x0 = s.ox;
  let y0 = s.oy;
  let w = s.width;
  let h = s.height;
  if (o.rect) {
    x0 = Math.max(s.ox, Math.floor(o.rect[0]) - 2);
    y0 = Math.max(s.oy, Math.floor(o.rect[1]) - 2);
    w = Math.min(s.ox + s.width, Math.ceil(o.rect[2]) + 2) - x0;
    h = Math.min(s.oy + s.height, Math.ceil(o.rect[3]) + 2) - y0;
    if (w <= 0 || h <= 0) return;
  }
  const l = new SoftCtx(w, h, undefined, x0, y0);
  draw(l.asContext());
  if (!l.dirty) return;
  if (o.outline !== false) outlineLayer(l, o.outline ?? 0.72);
  composite(s, l, o.alpha ?? 1);
}

/** Alpha-over composite of a layer onto a target (layers may be smaller, with an origin); only its drawn box is visited. */
export function composite(dst: SoftCtx, src: SoftCtx, alpha = 1) {
  if (!src.dirty) return;
  const d = dst.data;
  const s = src.data;
  const sw = src.width;
  const dw = dst.width;
  const offX = src.ox - dst.ox;
  const offY = src.oy - dst.oy;
  const xa = Math.max(src.dx0, -offX);
  const xb = Math.min(src.dx1, dw - offX);
  const ya = Math.max(src.dy0, -offY);
  const yb = Math.min(src.dy1, dst.height - offY);
  if (xb <= xa || yb <= ya) return;
  for (let y = ya; y < yb; y++) {
    const srow = y * sw;
    const drow = (y + offY) * dw + offX;
    for (let x = xa; x < xb; x++) {
      const v = s[srow + x];
      const sa8 = v >>> 24;
      if (!sa8) continue;
      const i = drow + x;
      const sa = (sa8 / 255) * alpha;
      if (sa >= 0.999) {
        d[i] = v;
        continue;
      }
      const o = d[i];
      const da = (o >>> 24) / 255;
      const oa = sa + da * (1 - sa);
      const k = sa / oa;
      const r = Math.round((o & 255) + ((v & 255) - (o & 255)) * k);
      const g = Math.round(((o >>> 8) & 255) + (((v >>> 8) & 255) - ((o >>> 8) & 255)) * k);
      const b = Math.round(((o >>> 16) & 255) + (((v >>> 16) & 255) - ((o >>> 16) & 255)) * k);
      d[i] = ((Math.round(oa * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  dst.touch(xa + offX, ya + offY, xb + offX, yb + offY);
}

/** Selective 1-px outline around a layer's opaque pixels (warm dark tint of the neighbour). */
export function outlineLayer(l: SoftCtx, k = 0.72) {
  if (!l.dirty) return;
  const { width: w, height: h, data } = l;
  const x0 = Math.max(0, l.dx0 - 1);
  const y0 = Math.max(0, l.dy0 - 1);
  const x1 = Math.min(w, l.dx1 + 1);
  const y1 = Math.min(h, l.dy1 + 1);
  // snapshot of the rows we read (one more above and below)
  const sy0 = Math.max(0, y0 - 1);
  const src = data.slice(sy0 * w, Math.min(h, y1 + 1) * w);
  const so = sy0 * w;
  const OR = 0x3b;
  const OG = 0x2a;
  const OB = 0x26;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const si = i - so;
      if (src[si] >>> 24) continue;
      let s = -1;
      let kk = k;
      if (y < h - 1 && src[si + w] >>> 24 > 200) (s = src[si + w]), (kk = k + 0.06);
      else if (x > 0 && src[si - 1] >>> 24 > 200) s = src[si - 1];
      else if (x < w - 1 && src[si + 1] >>> 24 > 200) (s = src[si + 1]), (kk = k + 0.04);
      else if (y > 0 && src[si - w] >>> 24 > 200) (s = src[si - w]), (kk = k + 0.12);
      if (s < 0) continue;
      const r = Math.round((s & 255) + (OR - (s & 255)) * kk);
      const g = Math.round(((s >>> 8) & 255) + (OG - ((s >>> 8) & 255)) * kk);
      const b = Math.round(((s >>> 16) & 255) + (OB - ((s >>> 16) & 255)) * kk);
      data[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  l.touch(x0, y0, x1, y1);
}

/** Inner rim light: opaque pixels whose upper-left neighbour is empty get one step lighter. */
export function rimLight(c: C, ramp: Ramp, step = 1) {
  const s = soft(c);
  if (!s || !s.dirty) return;
  const { width: w, data } = s;
  const idx = new Map<number, number>();
  ramp.forEach((col, i) => idx.set(parseColor(col), i));
  // only opaque pixels change (and stay opaque), so the alpha tests can read the live buffer
  for (let y = Math.max(1, s.dy0); y < s.dy1; y++)
    for (let x = Math.max(1, s.dx0); x < s.dx1; x++) {
      const i = y * w + x;
      const t = idx.get(data[i]);
      if (t === undefined) continue;
      if (!(data[i - w] >>> 24) || !(data[i - 1] >>> 24)) data[i] = parseColor(ramp[Math.min(ramp.length - 1, t + step)]);
    }
}

// ── light & shadow ──────────────────────────────────────────
/** Soft contact shadow: two dithered density steps, offset toward the lower right. */
export function contactShadow(c: C, cx: number, cy: number, rx: number, ry: number, alpha = 0.32) {
  // soft pixel-art shadow: a solid core and an ordered-dither falloff (no banded rings)
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  c.fillStyle = SHADOW;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      // denser toward the upper-left core (the object stands there)
      const core = Math.sqrt((dx + 0.25) ** 2 + (dy + 0.2) ** 2);
      const dens = Math.min(1, (1 - d) * 1.6) * (core < 0.55 ? 1 : 0.75);
      if (dens < bayer(x, y)) continue;
      c.globalAlpha = core < 0.5 ? alpha : alpha * 0.7;
      c.fillRect(x, y, 1, 1);
    }
  c.globalAlpha = 1;
}

// ── foliage masses (per-pixel shaded) ───────────────────────
/** A rounded leaf mass: an ellipsoid seen from the camera; higher z is in front. */
export interface Mass {
  x: number;
  y: number;
  rx: number;
  ry: number;
  z?: number;
}

export interface MassOpts {
  /** leaf-clump cell size in px */
  cell?: number;
  /** vertical stretch of cells (poplar, conifers) */
  stretch?: number;
  /** random light tilt per clump */
  tilt?: number;
  /** chance a clump is a see-through gap showing the dark interior */
  holes?: number;
  /** brightness bias */
  bias?: number;
  /** fruit / blossom colours on lit clumps */
  dots?: string[];
  dotChance?: number;
  dotSize?: number;
  /** tiny sparkles on the brightest clumps */
  sparkle?: string;
}

const LX = -0.55;
const LY = -0.68;
const LZ = 0.48;

/**
 * Foliage as volumes: every pixel takes the normal of the front-most mass it
 * belongs to, lit from the upper left, plus a clumpy leaf texture from a
 * Voronoi of small cells (each clump a little bump with a dark lower-right
 * seam). Cells decide membership, so the silhouette is made of leaf clumps.
 * Masses in front cast shadow on the ones behind. Quantised with ordered
 * dithering into the ramp. Draws into `c` (use inside a layer to outline).
 */
export function foliage(c: C, masses: Mass[], ramp: Ramp, seed: number, o: MassOpts = {}) {
  const S = o.cell ?? 7;
  const st = o.stretch ?? 1;
  const SY = S * st;
  const tilt = o.tilt ?? 0.18;
  const N = ramp.length;
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  masses.forEach((m, i) => {
    if (m.z === undefined) m.z = i;
    bx0 = Math.min(bx0, m.x - m.rx - S);
    bx1 = Math.max(bx1, m.x + m.rx + S);
    by0 = Math.min(by0, m.y - m.ry - S);
    by1 = Math.max(by1, m.y + m.ry + S);
  });
  if (!(bx1 > bx0)) return;
  const zs = masses.map((m) => m.z!);
  const X0 = Math.floor(bx0);
  const Y0 = Math.floor(by0);

  // front-most mass under every pixel centre, solved once (with room up-left for the cast-shadow probe)
  const MX0 = X0 - 7;
  const MY0 = Y0 - 9;
  const MW = Math.ceil(bx1) - MX0 + 1;
  const MH = Math.ceil(by1) - MY0 + 1;
  const fm = new Int16Array(MW * MH).fill(-1);
  for (let mi = 0; mi < masses.length; mi++) {
    const m = masses[mi];
    const ya = Math.max(MY0, Math.floor(m.y - m.ry - 1));
    const yb = Math.min(MY0 + MH - 1, Math.ceil(m.y + m.ry + 1));
    for (let y = ya; y <= yb; y++) {
      const dy = (y + 0.5 - m.y) / m.ry;
      const t = 1 - dy * dy;
      if (t < 0) continue;
      const hw = m.rx * Math.sqrt(t);
      const xa = Math.max(MX0, Math.ceil(m.x - hw - 0.5));
      const xb = Math.min(MX0 + MW - 1, Math.floor(m.x + hw - 0.5));
      for (let x = xa; x <= xb; x++) {
        const k = (y - MY0) * MW + (x - MX0);
        const cur = fm[k];
        if (cur < 0 || zs[mi] > zs[cur]) fm[k] = mi;
      }
    }
  }
  const frontPx = (x: number, y: number) => {
    const xx = x - MX0;
    const yy = y - MY0;
    return xx < 0 || yy < 0 || xx >= MW || yy >= MH ? -1 : fm[yy * MW + xx];
  };
  const frontAt = (x: number, y: number) => {
    let best = -1;
    for (let mi = 0; mi < masses.length; mi++) {
      const m = masses[mi];
      const dx = (x - m.x) / m.rx;
      const dy = (y - m.y) / m.ry;
      if (dx * dx + dy * dy <= 1 && (best < 0 || zs[mi] > zs[best])) best = mi;
    }
    return best;
  };

  // leaf clumps: one jittered feature point per cell, each solved once
  const gx0 = Math.floor(bx0 / S) - 2;
  const gy0 = Math.floor(by0 / SY) - 2;
  const GW = Math.floor(bx1 / S) + 3 - gx0;
  const GH = Math.floor(by1 / SY) + 3 - gy0;
  const n = GW * GH;
  const fx = new Float32Array(n);
  const fy = new Float32Array(n);
  const fid = new Int32Array(n);
  const fmass = new Int16Array(n);
  const ftilt = new Float32Array(n);
  const fhole = new Uint8Array(n);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const cx = gx0 + i;
      const cy = gy0 + j;
      const k = j * GW + i;
      fx[k] = (cx + 0.2 + hash(cx, cy, seed) * 0.6) * S;
      fy[k] = (cy + 0.2 + hash(cx, cy, seed + 1) * 0.6) * SY;
      const id = cx * 73856093 + cy * 19349663;
      fid[k] = id;
      fmass[k] = frontAt(fx[k], fy[k]);
      ftilt[k] = (hash(id, 7, seed) - 0.5) * 2 * tilt;
      fhole[k] = o.holes && hash(id, 11, seed) < o.holes ? 1 : 0;
    }

  // pixels: straight into the buffer when the target is a CPU layer
  const sc = soft(c);
  const direct = sc !== null && sc.globalAlpha >= 0.999;
  const packed = ramp.map((col) => (parseColor(col) | 0xff000000) >>> 0);
  const bias = o.bias ?? 0;
  const dotSeen = o.dots ? new Uint8Array(n) : null;
  const dotChance = o.dotChance ?? 0.25;
  const dots: number[] = [];
  let wx0 = Infinity;
  let wy0 = Infinity;
  let wx1 = -Infinity;
  let wy1 = -Infinity;
  for (let y = Y0; y < by1; y++)
    for (let x = X0; x < bx1; x++) {
      const cxp = x + 0.5;
      const cyp = y + 0.5;
      const gx = Math.floor(cxp / S) - gx0;
      const gy = Math.floor(cyp / SY) - gy0;
      let d1 = 1e18;
      let d2 = 1e18;
      let best = -1;
      for (let j = -1; j <= 1; j++) {
        const row = (gy + j) * GW + gx;
        for (let i = -1; i <= 1; i++) {
          const k = row + i;
          const ddx = cxp - fx[k];
          const ddy = (cyp - fy[k]) / st;
          const d = ddx * ddx + ddy * ddy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
          } else if (d < d2) d2 = d;
        }
      }
      const mi = fmass[best];
      if (mi < 0) continue;
      const m = masses[mi];
      // keep pixels near their clump (no cells bleeding far outside the masses)
      if (frontPx(x, y) < 0) {
        const dx = (cxp - m.x) / (m.rx + S * 0.5);
        const dy = (cyp - m.y) / (m.ry + S * 0.5);
        if (dx * dx + dy * dy > 1) continue;
      }
      const nx = (cxp - m.x) / m.rx;
      const ny = (cyp - m.y) / m.ry;
      const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
      let v = Math.max(0, nx * LX + ny * LY + nz * LZ) * 0.9 + 0.12;
      // clump bump: a rounded leaf clump, lit on its upper left, a soft seam on the lower right
      const e1 = Math.sqrt(d1);
      const lx = (cxp - fx[best]) / S;
      const ly = (cyp - fy[best]) / SY;
      v += (1 - Math.min(1, e1 / (S * 0.66)) - 0.45) * 0.26;
      v += (-lx * 0.5 - ly * 0.6) * 0.24;
      v += ftilt[best];
      if (Math.sqrt(d2) - e1 < 0.9 && (lx > 0 || ly > 0)) v -= 0.13;
      v += (hash(x, y, seed + 17) - 0.5) * 0.1;
      // cast shadow from masses in front, toward the light
      const lit = frontPx(x - 6, y - 8);
      if (lit >= 0 && lit !== mi && zs[lit] > zs[mi]) v -= 0.24;
      // gaps into the darker interior
      if (fhole[best] && nz > 0.45) v = Math.min(v, 0.08);
      v += bias;
      const t = v * (N - 1) + (bayer(x, y) - 0.5) * 0.7;
      const tone = t <= 0 ? 0 : t >= N - 1 ? N - 1 : Math.round(t);
      if (direct) {
        const xx = x - sc.ox;
        const yy = y - sc.oy;
        if (xx >= 0 && yy >= 0 && xx < sc.width && yy < sc.height) {
          sc.data[yy * sc.width + xx] = packed[tone];
          if (xx < wx0) wx0 = xx;
          if (xx > wx1) wx1 = xx;
          if (yy < wy0) wy0 = yy;
          if (yy > wy1) wy1 = yy;
        }
      } else {
        c.fillStyle = ramp[tone];
        c.fillRect(x, y, 1, 1);
      }
      if (dotSeen && tone >= N - 3 && !dotSeen[best] && hash(fid[best], 13, seed) < dotChance) {
        dotSeen[best] = 1;
        dots.push(best);
      }
      if (o.sparkle && tone === N - 1 && hash(x, y, seed) < 0.04) px(c, x, y, o.sparkle);
    }
  if (direct && wx1 >= wx0) sc.touch(wx0, wy0, wx1 + 1, wy1 + 1);
  if (o.dots) {
    const Rn = rng(seed * 5 + 3);
    for (const k of dots) dotFruit(c, fx[k] + (Rn() - 0.5) * 2, fy[k], o.dots[Math.floor(Rn() * o.dots.length)], o.dotSize ?? 4);
  }
}

// ── foliage ─────────────────────────────────────────────────
export interface Cluster {
  x: number;
  y: number;
  r: number;
  /** 0 … 1 light */
  l: number;
}

/**
 * Poisson-ish cluster distribution over a silhouette (inside(x, y) in local px),
 * so foliage reads as evenly packed leaf masses instead of random blobs.
 */
export function scatterClusters(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, rmin: number, rmax: number, seed: number, tries = 2600): Cluster[] {
  const R0 = rng(seed);
  const out: Cluster[] = [];
  for (let i = 0; i < tries; i++) {
    const x = x0 + R0() * (x1 - x0);
    const y = y0 + R0() * (y1 - y0);
    if (!inside(x, y)) continue;
    const r = rmin + R0() * (rmax - rmin);
    let ok = true;
    for (const o of out)
      if ((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < (Math.min(o.r, r) * 0.95) ** 2) {
        ok = false;
        break;
      }
    if (ok) out.push({ x, y, r, l: 0.5 });
  }
  return out;
}

export interface FoliageOpts {
  /** extra darkness for clusters deep inside (0 … 1) */
  depth?: number;
  /** fraction of clusters that get a sparkle highlight */
  glint?: number;
  /** scalloped leaf edges */
  scallop?: boolean;
  /** blossoms / fruit drawn on top of lit clusters */
  dots?: string[];
  dotChance?: number;
  dotSize?: number;
}

/**
 * Draw shaded leaf clusters (already lit) into the current layer:
 * dark crescent underneath, body, light crescent on the upper left,
 * scalloped leaf notches and a few glints on the sunny side.
 */
export function drawClusters(c: C, cl: Cluster[], ramp: Ramp, seed: number, o: FoliageOpts = {}) {
  const N = ramp.length;
  const Rn = rng(seed * 31 + 7);
  const sorted = [...cl].sort((a, b) => a.y - b.y);
  for (const k of sorted) {
    const base = Math.max(1, Math.min(N - 2, Math.round(1 + k.l * (N - 3))));
    const x = k.x;
    const y = k.y;
    const r = k.r;
    ell(c, x + 0.6, y + r * 0.22, r, r * 0.86, ramp[Math.max(0, base - 2)]);
    ell(c, x, y, r * 0.96, r * 0.8, ramp[base - 1]);
    ell(c, x - r * 0.12, y - r * 0.14, r * 0.8, r * 0.64, ramp[base]);
    if (k.l > 0.35) ell(c, x - r * 0.3, y - r * 0.32, r * 0.46, r * 0.34, ramp[Math.min(N - 1, base + 1)]);
    if (o.scallop !== false) {
      // leaf notches: short dark arcs along the lower rim and a split in the middle
      const n = 2 + Math.floor(Rn() * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.15 + Rn() * 0.7);
        px(c, x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.66, ramp[Math.max(0, base - 2)], 2, 1);
      }
      if (r > 5 && Rn() > 0.4) px(c, x + (Rn() - 0.5) * r * 0.6, y + r * 0.1, ramp[Math.max(0, base - 1)], Math.max(2, Math.round(r * 0.4)), 1);
    }
    if (k.l > 0.62 && Rn() < (o.glint ?? 0.5)) {
      px(c, x - r * 0.42, y - r * 0.42, ramp[N - 1], 2, 1);
      px(c, x - r * 0.2, y - r * 0.5, ramp[N - 1]);
    }
    if (o.dots && Rn() < (o.dotChance ?? 0.3) && k.l > 0.2) {
      const col = o.dots[Math.floor(Rn() * o.dots.length)];
      const ds = o.dotSize ?? 3;
      const fx = x + (Rn() - 0.5) * r * 1.1;
      const fy = y + (Rn() - 0.3) * r * 0.8;
      dotFruit(c, fx, fy, col, ds);
    }
  }
}

/** A fruit / blossom dot: dark rim below, body, highlight. */
export function dotFruit(c: C, x: number, y: number, col: string, size = 3) {
  const s = Math.max(2, Math.round(size));
  ell(c, x, y + 0.5, s * 0.62, s * 0.62, darken(col, 0.38));
  ell(c, x - 0.3, y, s * 0.52, s * 0.5, col);
  px(c, x - s * 0.35, y - s * 0.35, lighten(col, 0.45));
}

/** Light value for a point of a crown: sun from the upper left, darker toward the core and the lower right. */
export function lightAt(dx: number, dy: number, rx: number, ry: number, n = 0) {
  const nx = dx / rx;
  const ny = dy / ry;
  const rim = Math.min(1, Math.hypot(nx, ny));
  return Math.max(0, Math.min(1, 0.52 - nx * 0.3 - ny * 0.38 + (rim - 0.6) * 0.18 + n));
}

// ── bark & wood ─────────────────────────────────────────────
/**
 * Tapered trunk with root flare, bark streaks, a lit left edge and a shaded right edge.
 * (x, y) = ground point; h = visible height; w = base width.
 */
export function trunk(c: C, x: number, y: number, h: number, w: number, ramp: Ramp, seed: number, o: { lean?: number; roots?: boolean; moss?: boolean; birch?: boolean } = {}) {
  const Rn = rng(seed);
  const lean = o.lean ?? 0;
  layer(c, (l) => {
    // root flare
    if (o.roots !== false) {
      for (const [dx, len] of [[-1, w * 0.9], [1, w * 0.8], [-0.4, w * 0.5], [0.5, w * 0.55]] as const) {
        const ex = x + dx * len;
        fillPoly(l, [[x - w * 0.3, y - 3], [x + w * 0.3, y - 3], [ex + 1.5, y + 1], [ex - 1.5, y + 1]], ramp[2]);
      }
    }
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const ww = Math.max(3, w * (1 - t * 0.38) * (j < 5 ? 1 + (5 - j) * 0.06 : 1));
      const cx = x + lean * t * t * h * 0.2;
      const x0 = Math.round(cx - ww / 2);
      const W = Math.round(ww);
      for (let i = 0; i < W; i++) {
        const u = i / Math.max(1, W - 1);
        let tone = u < 0.22 ? 4 : u < 0.5 ? 3 : u < 0.8 ? 2 : 1;
        if (o.birch) {
          tone = u < 0.3 ? 5 : u < 0.7 ? 4 : 3;
          // dark lenticels and patches
          if (hash(Math.floor((x0 + i) / 3), Math.floor((y - j) / 2), seed) < 0.12) tone = 0;
        } else {
          // vertical bark ridges
          if (hash(x0 + i, Math.floor((y - j) / 6), seed) < 0.18) tone -= 1;
          if (hash(Math.floor((x0 + i) / 2), Math.floor((y - j) / 9), seed + 3) < 0.08) tone += 1;
        }
        px(l, x0 + i, y - j - 1, ramp[Math.max(0, Math.min(ramp.length - 1, tone))]);
      }
      if (o.moss && Rn() < 0.5 && t < 0.5) px(l, x0 + W - 2, y - j - 1, R.oak[3], 2, 1);
    }
  });
}

/** A branch as a tapering stroke (for crowns that show their structure). */
export function branch(c: C, x0: number, y0: number, x1: number, y1: number, w0: number, col: string, colHi?: string) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ww = Math.max(1, Math.round(w0 * (1 - t * 0.7)));
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    px(c, x - ww / 2, y, col, ww, 1);
    if (colHi && ww > 2) px(c, x - ww / 2, y, colHi);
  }
}

// ── stamps (hand-authored micro pixel maps) ─────────────────
export interface Stamp {
  w: number;
  h: number;
  rows: string[];
}
export const stamp = (rows: string[]): Stamp => ({ w: Math.max(...rows.map((r) => r.length)), h: rows.length, rows });

/** Draw a stamp: digits index into `pal`, '.' is transparent; flipX mirrors. */
export function drawStamp(c: C, st: Stamp, x: number, y: number, pal: readonly string[], flipX = false) {
  for (let j = 0; j < st.h; j++) {
    const row = st.rows[j];
    let run = -1;
    let runCol = '';
    const flush = (end: number) => {
      if (run < 0) return;
      c.fillStyle = runCol;
      if (flipX) c.fillRect(Math.round(x + st.w - end), Math.round(y + j), end - run, 1);
      else c.fillRect(Math.round(x + run), Math.round(y + j), end - run, 1);
      run = -1;
    };
    for (let i = 0; i <= row.length; i++) {
      const ch = i < row.length ? row[i] : '.';
      const col = ch === '.' ? '' : pal[parseInt(ch, 36)] ?? '';
      if (col !== runCol || !col) {
        flush(i);
        if (col) {
          run = i;
          runCol = col;
        } else runCol = '';
      }
    }
  }
}

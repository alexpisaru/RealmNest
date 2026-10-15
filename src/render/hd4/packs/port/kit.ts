// Logistics Port — the pack's own drawing helpers (materials, stencils,
// ropes, a standing gull). Primitives come from kit4 / plane4; the looks
// (corrugated steel, container paint, stencilled codes) are this port's.
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, ell, fillPoly, hash, ln, px, type Ramp, soft } from '../../kit4';
import { fn } from './fast';
import type { Plane } from '../../plane4';
import { RUST } from './palette';

const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/**
 * Corrugated steel with vertical ribs (containers, sheds): a lit flank, the
 * crest, a shaded flank and the valley per rib; rust runs from the top, grime
 * gathers at the foot, a dent or two.
 */
export const corr =
  (r: Ramp, pitch = 10, rust = 0.5, seed = 0): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const f = ((u + seed * 3.7) % pitch) / pitch;
    let i = base(light, r.length) + 0.2;
    // (second pass) deeper valleys, brighter crests: the ribs read at the zoomed-out view
    if (f < 0.13) i += light === 0 ? 0.7 : 1.5;
    else if (f < 0.46) i += 0;
    else if (f < 0.62) i -= 1.8;
    else i -= 0.6;
    if (v < 3 && bayer(x, y) * 3 > v) i -= 1;
    if (v > h - 1.5) i += 0.6;
    // a dent: a soft dip, shadowed on its upper left, lit lower right
    const dx = (u - (seed * 53) % 90 - 20) / 9;
    const dy = (v - h * 0.45) / 7;
    const dd = dx * dx + dy * dy;
    if (dd < 1 && seed % 3 === 0) i += dx + dy < 0 ? -0.7 : 0.4;
    // rust: a few streaks running down from the top rail (fading out), patches along the foot
    if (rust > 0) {
      const col = Math.floor(u / 2);
      const run = hash(col, seed, 81);
      if (run < 0.035 * rust) {
        const len = 6 + hash(col, seed, 82) * h * 0.55;
        const fade = (h - v) / len;
        if (fade < 1 && bayer(x, y) > fade * 0.95) return at(RUST, (light === 0 ? 2 : 3) + (f < 0.13 ? 1 : 0) - fade);
      }
      if (v < h * 0.22 && fn(u * 0.09 + seed, v * 0.2, 83) > 1 - 0.3 * rust && bayer(x, y) > 0.35) return at(RUST, light === 0 ? 1.5 : 2.6);
    }
    if (hash(x, y, 84) < 0.02) i -= 0.7;
    return at(r, i);
  };

/** Horizontal sheet cladding (shed walls): shallow ribs along u, a lit lip on each. */
export const cladH =
  (r: Ramp, pitch = 7, rust = 0.3, seed = 0): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const f = (v % pitch) / pitch;
    let i = base(light, r.length);
    if (f > 0.82) i += 0.8;
    else if (f < 0.2) i -= 0.8;
    if (v < 4 && bayer(x, y) * 4 > v) i -= 1;
    if (rust > 0 && fn(u * 0.05 + seed, v * 0.2, 85) > 1 - 0.15 * rust && bayer(x, y) > 0.4) return at(RUST, light === 0 ? 1.4 : 2.4);
    if (hash(x, y, 86) < 0.025) i -= 0.7;
    if (Math.floor(u / 64) !== Math.floor((u - 1) / 64)) i -= 1.2;
    void h;
    return at(r, i);
  };

/** Flat steel plate (paint) with a little grime at the foot and scratches. */
export const plate =
  (r: Ramp, grime = 0.5): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length) + 0.2;
    if (v > h - 1.5) i += 0.7;
    if (v < 4 * grime && bayer(x, y) * 4 * grime > v) i -= 1;
    const g = hash(x, y, 87);
    if (g < 0.025) i -= 0.8;
    else if (g > 0.985) i += 0.8;
    return at(r, i);
  };

/** Weathered timber boards along u (bench slats, crates, jetty decks). */
export const planks =
  (r: Ramp, bw = 6, along: 'u' | 'v' = 'u'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const a = along === 'u' ? v : u;
    const b = along === 'u' ? u : v;
    const row = Math.floor(a / bw);
    const fa = a - row * bw;
    let i = base(light, r.length) + (hash(row, 1, 88) - 0.5) * 1.2;
    if (fa < 1) return at(r, i - 2);
    if (fa > bw - 1.2) i += 0.6;
    if (fn(b * 0.08 + row * 7, fa * 0.6, 89) > 0.66) i -= 0.7;
    if (hash(x, y, 90) < 0.03) i -= 0.8;
    return at(r, i);
  };

/** Ramp from one colour (dark → light) for small painted parts. */
export function rampOf(hex: string): Ramp {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (k: number, t: [number, number, number]) => {
    const c = (v: number, w: number) => Math.max(0, Math.min(255, Math.round(v + (w - v) * Math.abs(k))));
    return '#' + [c(r, t[0]), c(g, t[1]), c(b, t[2])].map((q) => q.toString(16).padStart(2, '0')).join('');
  };
  return [f(0.62, [42, 31, 61]), f(0.42, [42, 31, 61]), f(0.2, [42, 31, 61]), hex, f(0.18, [255, 248, 232]), f(0.36, [255, 248, 232])];
}

// ── a 3×5 stencil font ───────────────────────────────────────
const GLYPHS: Record<string, string> = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '.###..#..#...##',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '.###..#.##.#.##',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..',
  Q: '.#.#.##.###..##',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.########.#',
  X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
  '0': '####.##.##.####',
  '1': '.#.##..#..#.###',
  '2': '##...#.#.#..###',
  '3': '##...#.#...###.',
  '4': '#.##.####..#..#',
  '5': '####..##...###.',
  '6': '.###..####.####',
  '7': '###..#.#..#..#.',
  '8': '####.#####.####',
  '9': '####.####..###.',
  '-': '......###......',
  '.': '.............#.',
  '/': '..#..#.#.#..#..',
  ' ': '...............',
};

/** Pixel text: 3×5 glyphs, each column shifted by `slope` px (text on an iso face). */
export function text(c: CanvasRenderingContext2D, x: number, y: number, s: string, col: string, slope = 0, scale = 1) {
  let cx = 0;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++) {
        if (g[j * 3 + i] !== '#') continue;
        const gx = cx + i;
        px(c, x + gx * scale, y + j * scale + Math.round(gx * slope * scale), col, scale, scale);
      }
    cx += 4;
  }
}

/** Width in px of a stencilled string. */
export const textW = (s: string, scale = 1) => (s.length * 4 - 1) * scale;

/** Text on a plane, starting at (u, z) = top-left of the text; front planes read along +u, side planes along −u. */
export function stencil(p: PropPainter, pl: Plane, u: number, z: number, s: string, col: string, scale = 1) {
  const [x, y] = pl.F(u, z);
  const [x2, y2] = pl.F(u + 0.5, z);
  const slope = (y2 - y) / (x2 - x);
  text(p.c, Math.round(x), Math.round(y), s, col, slope, scale);
}

// ── ropes ────────────────────────────────────────────────────
/** A rope sagging between two screen points (a 1-px line, a lighter twist every few px). */
export function rope(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag: number, col: string, hi?: string) {
  const n = Math.max(6, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  let px0 = x0;
  let py0 = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    ln(c, px0, py0, x, y, col);
    if (hi && i % 3 === 0) px(c, x, y - 1, hi);
    px0 = x;
    py0 = y;
  }
}

/** A coil of rope seen from above: concentric ellipses, lit on the upper left. */
export function coil(c: CanvasRenderingContext2D, x: number, y: number, r: number, R: Ramp) {
  for (let k = r; k > 1; k -= 1.6) {
    ell(c, x, y, k, k * 0.5, R[1]);
    ell(c, x - 0.4, y - 0.5, k - 0.6, (k - 0.6) * 0.48, R[3]);
    px(c, x - k * 0.6, y - k * 0.3, R[5]);
  }
  ell(c, x, y, 1.6, 0.8, R[0]);
}

// ── a herring gull standing (the same bird as the pack's critter) ──
/** A standing gull, feet at (x, y), facing right (dir 1) or left (−1). */
export function gullStand(c: CanvasRenderingContext2D, x: number, y: number, dir = 1, look = 0) {
  const X = (dx: number) => x + dx * dir;
  const f = (dx: number, dy: number, w: number, h: number, col: string) => px(c, dir > 0 ? X(dx) : X(dx) - w + 1, y + dy, col, w, h);
  // legs
  f(-1, -3, 1, 3, '#d08a7a');
  f(1, -3, 1, 3, '#c07868');
  // tail and folded wings (grey back, black tips with a white spot)
  f(-7, -9, 3, 2, '#1e1e24');
  f(-6, -9, 1, 1, '#f2f2ee');
  f(-5, -11, 8, 3, '#9aa2ac');
  f(-4, -12, 6, 1, '#b4bcc4');
  // white body and breast
  f(-4, -8, 8, 4, '#eef0ee');
  f(2, -9, 3, 4, '#ffffff');
  f(-3, -5, 6, 1, '#c8cccc');
  // head, eye, yellow bill with the red spot
  const hy = look ? -15 : -14;
  f(2, hy, 4, 4, '#ffffff');
  f(3, hy + 1, 1, 1, '#2a2226');
  f(6, hy + 1, 3, 1, '#f2c43a');
  f(7, hy + 2, 1, 1, '#d8402a');
}

/**
 * A cheap cast shadow for big props: a dithered band on the ground along the
 * footprint's +x side (the sun is upper left), `len` tiles wide, plus a thin
 * contact line along the front. Much cheaper than a full contact ellipse.
 */
export function shadowBand(p: PropPainter, a0: number, b0: number, a1: number, b1: number, len = 0.45, alpha = 0.3) {
  const [xa, ya] = p.W(a0, b0);
  const [xb, yb] = p.W(a1, b1);
  const x1 = Math.max(xa, xb);
  const y0 = Math.min(ya, yb);
  const y1 = Math.max(ya, yb);
  const x0 = Math.min(xa, xb);
  const W = p.w;
  const band: [number, number][] = [W.P(x1, y0 + len * 0.6), W.P(x1 + len, y0 + len * 0.6), W.P(x1 + len, y1 + len * 0.3), W.P(x1, y1)];
  const front: [number, number][] = [W.P(x0 + 0.1, y1), W.P(x1, y1), W.P(x1, y1 + 0.08), W.P(x0 + 0.1, y1 + 0.08)];
  const s = soft(p.c);
  const c = p.c;
  c.globalAlpha = alpha;
  c.fillStyle = '#2a1a2a';
  // dither the band: rasterise it row by row, keep pixels by an ordered threshold
  for (const [poly, dens] of [[band, 0.75], [front, 0.9]] as const) {
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const q of poly) {
      ymin = Math.min(ymin, q[1]);
      ymax = Math.max(ymax, q[1]);
    }
    for (let y = Math.floor(ymin); y < Math.ceil(ymax); y++) {
      const sy = y + 0.5;
      let xl = Infinity;
      let xr = -Infinity;
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          const x = ax + ((sy - ay) * (bx - ax)) / (by - ay);
          xl = Math.min(xl, x);
          xr = Math.max(xr, x);
        }
      }
      for (let x = Math.round(xl); x < Math.round(xr); x++) if (bayer(x, y) < dens) c.fillRect(x, y, 1, 1);
    }
  }
  c.globalAlpha = 1;
  void s;
  void fillPoly;
}

/**
 * A boat's deck inside its hull outline (pts: [a, half-beam] from end to end),
 * filled flat with plank seams along the length — far cheaper than a textured
 * many-sided polygon.
 */
export function deckFill(p: PropPainter, pts: [number, number][], bm: number, z: number, R: Ramp, k = 0.88) {
  const scr: [number, number][] = [];
  for (const [a, h] of pts) scr.push(p.P(a, bm + h * k, z));
  for (let i = pts.length - 1; i >= 0; i--) scr.push(p.P(pts[i][0], bm - pts[i][1] * k, z));
  fillPoly(p.c, scr, R[3]);
  let hb = 0;
  for (const q of pts) hb = Math.max(hb, q[1]);
  for (let s = -0.84; s <= 0.85; s += 0.21) {
    const off = s * hb * k;
    let i0 = -1;
    let i1 = -1;
    for (let i = 0; i < pts.length; i++)
      if (pts[i][1] * k > Math.abs(off) + 0.03) {
        if (i0 < 0) i0 = i;
        i1 = i;
      }
    if (i0 < 0 || i1 <= i0) continue;
    const A = p.P(pts[i0][0], bm + off, z);
    const B = p.P(pts[i1][0], bm + off, z);
    ln(p.c, A[0], A[1], B[0], B[1], Math.abs(s) < 0.1 ? R[4] : R[2]);
  }
}

/** A heap of netting with floats, at screen point (x, y). */
export function netHeap(c: CanvasRenderingContext2D, x: number, y: number, seed: number, w = 18, brown = false) {
  const G = brown ? ['#3a2418', '#5a3622', '#74482c', '#8e5a36'] : ['#1a3a26', '#24503a', '#2e6448', '#3e7a58'];
  for (let i = 0; i < w * 1.6; i++) {
    const hx = x - w + hash(i, 1, seed) * w * 2;
    const hy = y - 2 - hash(i, 2, seed) * w * 0.5 + Math.abs(hx - x) * 0.2;
    ell(c, hx, hy, 5 + hash(i, 3, seed) * 3, 3 + hash(i, 4, seed) * 1.5, G[1 + Math.floor(hash(i, 5, seed) * 3)]);
  }
  for (let i = 0; i < w * 3; i++) px(c, x - w + hash(i, 6, seed) * w * 2, y - w * 0.5 + hash(i, 7, seed) * w * 0.5, G[0]);
  for (let i = 0; i < w / 3; i++) {
    const fx = x - w * 0.8 + hash(i, 8, seed) * w * 1.6;
    const fy = y - 3 - hash(i, 9, seed) * w * 0.4;
    ell(c, fx, fy, 2, 1.6, i % 3 ? '#f2a02a' : '#e8e4da');
  }
}

// ── wheels (second pass: real tyres in their planes) ─────────
export const CHROME: Ramp = ['#4a4e56', '#6a707a', '#8e949c', '#b4bac0', '#d4d8dc', '#eef0f2'];
export const TYRE = '#16161a';

/**
 * A wheel in a vertical plane: centre (u, zc), radius R tiles along the plane
 * (and R·20 z up). The tyre, a lit tread arc on its upper left, the rim, the hub and bolts.
 */
export function wheelOn(p: PropPainter, pl: Plane, u: number, zc: number, R: number, rim = CHROME) {
  const c = p.c;
  const ring = (k: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      pts.push(pl.F(u + Math.cos(t) * R * k, zc + Math.sin(t) * R * 20 * k));
    }
    return pts;
  };
  // the contact shadow on the ground
  const [gx, gy] = pl.F(u, 0);
  ell(c, gx + 3, gy + 1, R * 64 * 0.9, R * 32 * 0.7, '#121014');
  fillPoly(c, ring(1), TYRE);
  // the lit shoulder of the tread (upper left)
  const sh = ring(1);
  for (let i = 9; i < 14; i++) ln(c, sh[i][0], sh[i][1], sh[i + 1][0], sh[i + 1][1], '#3a3a42');
  fillPoly(c, ring(0.66), rim[1]);
  fillPoly(c, ring(0.56), rim[3]);
  const hi = ring(0.56);
  for (let i = 10; i < 15; i++) ln(c, hi[i][0], hi[i][1], hi[i + 1][0], hi[i + 1][1], rim[5]);
  fillPoly(c, ring(0.24), rim[0]);
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2 + 0.3;
    const [bx, by] = pl.F(u + Math.cos(t) * R * 0.38, zc + Math.sin(t) * R * 20 * 0.38);
    px(c, bx, by, rim[5], 1, 1);
  }
}

/** The dark arch over a wheel on a body face (draw before the wheel). */
export function archOn(p: PropPainter, pl: Plane, u: number, zc: number, R: number) {
  const pts: [number, number][] = [pl.F(u - R * 1.18, 0.4)];
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI - (i / 10) * Math.PI;
    pts.push(pl.F(u + Math.cos(t) * R * 1.18, zc + Math.sin(t) * R * 20 * 1.18));
  }
  pts.push(pl.F(u + R * 1.18, 0.4));
  fillPoly(p.c, pts, '#0e0e12');
}


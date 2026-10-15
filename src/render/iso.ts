// ─────────────────────────────────────────────────────────────
// Isometric pixel-art rasterizer.
// 2:1 tiles (32×16). World (x, y, z) → screen: ((x−y)·16, (x+y)·8 − z).
// A Painter may carry a pixel scale k (2 → 64×32 tiles, heights ×2) for HD worlds.
// Polygons are scan-converted with fillRect so edges stay crisp (no AA).
// ─────────────────────────────────────────────────────────────

import { darken, lighten, mix } from './color';

export type C = CanvasRenderingContext2D;
export type V2 = [number, number];

export const TW = 32;
export const TH = 16;
export const WALL_H = 64;
export const SLAB = 12;
export const OUT = '#2b2236';

export const proj = (x: number, y: number, z = 0): V2 => [(x - y) * 16, (x + y) * 8 - z];

export function rect(c: C, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Convex polygon fill, one scanline at a time. */
export function poly(c: C, pts: V2[], col: string) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  c.fillStyle = col;
  const n = pts.length;
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    let xl = Infinity;
    let xr = -Infinity;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
        const x = x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0);
        if (x < xl) xl = x;
        if (x > xr) xr = x;
      }
    }
    if (xr > xl) {
      const a = Math.round(xl);
      const b = Math.round(xr);
      if (b > a) c.fillRect(a, y, b - a, 1);
    }
  }
}

export function line(c: C, x0: number, y0: number, x1: number, y1: number, col: string) {
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
  for (let i = 0; i < 2000; i++) {
    c.fillRect(x0, y0, 1, 1);
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

export interface Shades {
  top: string;
  left: string; // south-west face (lit)
  right: string; // south-east face (shade)
}

export const shades = (base: string, topBoost = 0.16): Shades => ({
  top: lighten(base, topBoost),
  left: base,
  right: darken(base, 0.2),
});

/**
 * Painter maps world coordinates to a canvas with an origin offset.
 * Used for the background, the frame and per-prop sprite caches.
 */
export class Painter {
  constructor(
    readonly c: C,
    public ox: number,
    public oy: number,
    readonly k = 1,
  ) {}

  P(x: number, y: number, z = 0): V2 {
    const k = this.k;
    return [(x - y) * 16 * k + this.ox, ((x + y) * 8 - z) * k + this.oy];
  }

  quad(pts: [number, number, number][], col: string) {
    poly(
      this.c,
      pts.map(([x, y, z]) => this.P(x, y, z)),
      col,
    );
  }

  /** Axis-aligned world box with lit faces and a pixel outline. */
  box(x0: number, y0: number, w: number, d: number, z0: number, h: number, base: string | Shades, outline = true) {
    const s = typeof base === 'string' ? shades(base) : base;
    const x1 = x0 + w;
    const y1 = y0 + d;
    const z1 = z0 + h;
    if (h > 0) {
      this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], s.left);
      this.quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], s.right);
    }
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], s.top);
    if (!outline) return;
    const A = this.P(x0, y0, z1);
    const B = this.P(x1, y0, z1);
    const B0 = this.P(x1, y0, z0);
    const C0 = this.P(x1, y1, z0);
    const D0 = this.P(x0, y1, z0);
    const D = this.P(x0, y1, z1);
    const Cc = this.P(x1, y1, z1);
    const hull = h > 0 ? [A, B, B0, C0, D0, D] : [A, B, Cc, D];
    // tinted (selective) outline, darker on the shaded side
    const edgeTop = mix(darken(s.top, 0.5), OUT, 0.45);
    const edgeLow = mix(darken(s.right, 0.5), OUT, 0.65);
    for (let i = 0; i < hull.length; i++) {
      const [ax, ay] = hull[i];
      const [bx, by] = hull[(i + 1) % hull.length];
      line(this.c, ax, ay, bx, by, i < 2 ? edgeTop : edgeLow);
    }
    if (h > 0) {
      line(this.c, D[0], D[1], Cc[0], Cc[1], lighten(s.top, 0.12));
      line(this.c, Cc[0], Cc[1], B[0], B[1], lighten(s.top, 0.12));
      line(this.c, Cc[0], Cc[1] + 1, C0[0], C0[1] - 1, darken(s.left, 0.12));
    }
  }

  /** Small screen-aligned rectangle at a world point (for tiny details). */
  dot(x: number, y: number, z: number, col: string, w = 1, h = 1) {
    const [sx, sy] = this.P(x, y, z);
    rect(this.c, sx, sy, w, h, col);
  }

  line3(a: [number, number, number], b: [number, number, number], col: string) {
    const [ax, ay] = this.P(...a);
    const [bx, by] = this.P(...b);
    line(this.c, ax, ay, bx, by, col);
  }
}

/**
 * Prop-local painter: (a, b) are coordinates along the prop's width and
 * depth; b = d is the FRONT. rot 0 → front faces +y (SW), rot 1 → +x (SE).
 */
export class PropPainter {
  constructor(
    readonly w: Painter,
    readonly x: number,
    readonly y: number,
    readonly pw: number,
    readonly pd: number,
    readonly rot: 0 | 1,
  ) {}

  get c() {
    return this.w.c;
  }

  /** pixel scale (1 = 32×16 tiles, 2 = 64×32) */
  get k() {
    return this.w.k;
  }

  W(a: number, b: number): [number, number] {
    return this.rot === 0 ? [this.x + a, this.y + b] : [this.x + b, this.y + this.pw - a];
  }

  P(a: number, b: number, z = 0): V2 {
    const [x, y] = this.W(a, b);
    return this.w.P(x, y, z);
  }

  box(a0: number, b0: number, aw: number, bd: number, z0: number, h: number, base: string | Shades, outline = true) {
    const [xa, ya] = this.W(a0, b0);
    const [xb, yb] = this.W(a0 + aw, b0 + bd);
    this.w.box(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya), z0, h, base, outline);
  }

  /** Rectangle on the vertical plane b = const (a0..a1, z0..z1) — e.g. a screen on the front. */
  face(a0: number, a1: number, b: number, z0: number, z1: number, col: string) {
    poly(this.c, [this.P(a0, b, z0), this.P(a1, b, z0), this.P(a1, b, z1), this.P(a0, b, z1)], col);
  }

  /** Rectangle on the vertical plane a = const (side). */
  side(a: number, b0: number, b1: number, z0: number, z1: number, col: string) {
    poly(this.c, [this.P(a, b0, z0), this.P(a, b1, z0), this.P(a, b1, z1), this.P(a, b0, z1)], col);
  }

  /** Rectangle on a horizontal plane at height z. */
  top(a0: number, b0: number, a1: number, b1: number, z: number, col: string) {
    poly(this.c, [this.P(a0, b0, z), this.P(a1, b0, z), this.P(a1, b1, z), this.P(a0, b1, z)], col);
  }

  dot(a: number, b: number, z: number, col: string, w = 1, h = 1) {
    const [sx, sy] = this.P(a, b, z);
    rect(this.c, sx, sy, w, h, col);
  }

  ln(a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, col: string) {
    const [x0, y0] = this.P(a0, b0, z0);
    const [x1, y1] = this.P(a1, b1, z1);
    line(this.c, x0, y0, x1, y1, col);
  }

  shadow(a0 = 0, b0 = 0, aw = this.pw, bd = this.pd) {
    const s = 0.12;
    this.c.globalAlpha = 0.22;
    this.top(a0 - s, b0 + s, a0 + aw + s, b0 + bd + s * 2, 0, '#1c1228');
    this.c.globalAlpha = 1;
  }
}

/** Painter on a back wall plane: u along the wall, z up. */
export class WallPainter {
  constructor(
    readonly w: Painter,
    readonly side: 'ne' | 'nw',
    readonly at: number,
    readonly width: number,
  ) {}

  get c() {
    return this.w.c;
  }

  P(u: number, z: number): V2 {
    const k = this.at + u;
    return this.side === 'ne' ? this.w.P(k, 0, z) : this.w.P(0, k, z);
  }

  quad(u0: number, u1: number, z0: number, z1: number, col: string) {
    poly(this.c, [this.P(u0, z0), this.P(u1, z0), this.P(u1, z1), this.P(u0, z1)], col);
  }

  /** Framed panel with outline. */
  panel(u0: number, u1: number, z0: number, z1: number, col: string, frame = OUT) {
    this.quad(u0, u1, z0, z1, frame);
    const du = 1 / 16;
    this.quad(u0 + du, u1 - du, z0 + 1, z1 - 1, col);
  }

  dot(u: number, z: number, col: string, w = 1, h = 1) {
    const [x, y] = this.P(u, z);
    rect(this.c, x, y, w, h, col);
  }

  ln(u0: number, z0: number, u1: number, z1: number, col: string) {
    const [x0, y0] = this.P(u0, z0);
    const [x1, y1] = this.P(u1, z1);
    line(this.c, x0, y0, x1, y1, col);
  }
}

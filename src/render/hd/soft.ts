// ─────────────────────────────────────────────────────────────
// SoftCtx — a tiny CPU raster target that implements the subset of
// CanvasRenderingContext2D the HD art uses (fillStyle, fillRect,
// globalAlpha). HD props draw tens of thousands of 1-px rects; doing that
// into a Uint32Array and uploading once is far cheaper than recording
// them as canvas commands (which the browser replays on first use).
//
// Also: tight cropping, a pixel-art-safe 2:1 reduction (the mode of each
// 2×2 block, ties to the darker colour — crisp, no new colours) used as
// the low-DPI level of detail, and a selective outline pass.
// ─────────────────────────────────────────────────────────────

const parsed = new Map<string, number>();

/** Parse '#rgb', '#rrggbb' or 'rgba(r,g,b,a)' / 'rgb(r,g,b)' into 0xAABBGGRR (little-endian RGBA). */
export function parseColor(s: string): number {
  let v = parsed.get(s);
  if (v !== undefined) return v;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;
  if (s[0] === '#') {
    if (s.length === 4) {
      r = parseInt(s[1] + s[1], 16);
      g = parseInt(s[2] + s[2], 16);
      b = parseInt(s[3] + s[3], 16);
    } else {
      r = parseInt(s.slice(1, 3), 16);
      g = parseInt(s.slice(3, 5), 16);
      b = parseInt(s.slice(5, 7), 16);
      if (s.length === 9) a = parseInt(s.slice(7, 9), 16);
    }
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map((t) => parseFloat(t));
      [r, g, b] = p;
      if (p.length > 3) a = Math.round(p[3] * 255);
    }
  }
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  parsed.set(s, v);
  return v;
}

export class SoftCtx {
  readonly data: Uint32Array;
  private style = '#000000';
  private rgba = 0xff000000;
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  /** bounding box of the pixels drawn so far (buffer coordinates, x1 / y1 exclusive) */
  dx0 = Infinity;
  dy0 = Infinity;
  dx1 = -Infinity;
  dy1 = -Infinity;

  constructor(
    readonly width: number,
    readonly height: number,
    data?: Uint32Array,
    /** origin of this buffer in the caller's coordinates (bounded layers) */
    readonly ox = 0,
    readonly oy = 0,
  ) {
    this.data = data ?? new Uint32Array(width * height);
  }

  get canvas() {
    return { width: this.width, height: this.height };
  }

  get fillStyle() {
    return this.style;
  }
  set fillStyle(s: string) {
    this.style = s;
    this.rgba = parseColor(s);
  }

  fillRect(x: number, y: number, w: number, h: number) {
    x -= this.ox;
    y -= this.oy;
    let x0 = Math.round(x);
    let y0 = Math.round(y);
    let x1 = Math.round(x + w);
    let y1 = Math.round(y + h);
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > this.width) x1 = this.width;
    if (y1 > this.height) y1 = this.height;
    if (x1 <= x0 || y1 <= y0) return;
    const src = this.rgba;
    const sa = ((src >>> 24) / 255) * this.globalAlpha;
    if (sa <= 0) return;
    this.touch(x0, y0, x1, y1);
    const d = this.data;
    const W = this.width;
    if (sa >= 0.999) {
      const v = (src | 0xff000000) >>> 0;
      for (let yy = y0; yy < y1; yy++) d.fill(v, yy * W + x0, yy * W + x1);
      return;
    }
    const sr = src & 255;
    const sg = (src >>> 8) & 255;
    const sb = (src >>> 16) & 255;
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) {
        const i = yy * W + xx;
        const dst = d[i];
        const da = (dst >>> 24) / 255;
        const oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        const k = sa / oa;
        const r = Math.round((dst & 255) + (sr - (dst & 255)) * k);
        const g = Math.round(((dst >>> 8) & 255) + (sg - ((dst >>> 8) & 255)) * k);
        const b = Math.round(((dst >>> 16) & 255) + (sb - ((dst >>> 16) & 255)) * k);
        d[i] = ((Math.round(oa * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
  }

  /** Set one pixel to a packed colour (no blending). */
  put(x: number, y: number, v: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = v;
    this.touch(x, y, x + 1, y + 1);
  }

  /** Extend the drawn bounding box (buffer coordinates, exclusive end). */
  touch(x0: number, y0: number, x1: number, y1: number) {
    if (x0 < this.dx0) this.dx0 = x0;
    if (y0 < this.dy0) this.dy0 = y0;
    if (x1 > this.dx1) this.dx1 = x1;
    if (y1 > this.dy1) this.dy1 = y1;
  }

  /** True once anything has been drawn. */
  get dirty() {
    return this.dx1 > this.dx0;
  }

  /** Copy the pixels into a real canvas. */
  toCanvas(): HTMLCanvasElement {
    return bufferToCanvas(this.data, this.width, this.height);
  }

  /** Typed as a 2D context for the art code (only fillStyle / fillRect / globalAlpha are used). */
  asContext(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D;
  }
}

export function bufferToCanvas(data: Uint32Array, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  if (w > 0 && h > 0) {
    const img = new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, w * h * 4), w, h);
    cv.getContext('2d')!.putImageData(img, 0, 0);
  }
  return cv;
}

/** Bounding box of non-transparent pixels, or null if empty. */
export function opaqueBounds(data: Uint32Array, w: number, h: number) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[row + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** Copy a sub-rectangle of a buffer. */
export function cropBuffer(data: Uint32Array, w: number, x0: number, y0: number, cw: number, ch: number): Uint32Array {
  const out = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const sy = y0 + y;
    if (sy < 0) continue;
    const srow = sy * w;
    for (let x = 0; x < cw; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= w) continue;
      out[y * cw + x] = data[srow + sx];
    }
  }
  return out;
}

const lum = (v: number) => (v & 255) * 0.3 + ((v >>> 8) & 255) * 0.59 + ((v >>> 16) & 255) * 0.11;

/**
 * Pixel-art-safe 2:1 reduction: each output pixel is the most frequent
 * colour of its 2×2 block (ties → the darker one, so 1-px outlines
 * survive); a block that is mostly transparent stays transparent.
 * Width/height must be even.
 */
export function downsampleMode(data: Uint32Array, w: number, h: number): Uint32Array {
  const W2 = w >> 1;
  const H2 = h >> 1;
  const out = new Uint32Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    const r0 = y * 2 * w;
    const r1 = r0 + w;
    const o = y * W2;
    for (let x = 0; x < W2; x++) {
      const p0 = data[r0 + x * 2];
      const p1 = data[r0 + x * 2 + 1];
      const p2 = data[r1 + x * 2];
      const p3 = data[r1 + x * 2 + 1];
      if (p0 === p1 && p0 === p2 && p0 === p3) {
        if (p0 >>> 24 >= 128) out[o + x] = p0;
        continue;
      }
      const s0 = p0 >>> 24 >= 128;
      const s1 = p1 >>> 24 >= 128;
      const s2 = p2 >>> 24 >= 128;
      const s3 = p3 >>> 24 >= 128;
      if ((s0 ? 1 : 0) + (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0) < 2) continue;
      let best = 0;
      let bc = -1;
      let bl = 1e9;
      if (s0) {
        const c = 1 + (p1 === p0 ? 1 : 0) + (p2 === p0 ? 1 : 0) + (p3 === p0 ? 1 : 0);
        const l = lum(p0);
        if (c > bc || (c === bc && l < bl)) (best = p0), (bc = c), (bl = l);
      }
      if (s1) {
        const c = 1 + (p0 === p1 ? 1 : 0) + (p2 === p1 ? 1 : 0) + (p3 === p1 ? 1 : 0);
        const l = lum(p1);
        if (c > bc || (c === bc && l < bl)) (best = p1), (bc = c), (bl = l);
      }
      if (s2) {
        const c = 1 + (p0 === p2 ? 1 : 0) + (p1 === p2 ? 1 : 0) + (p3 === p2 ? 1 : 0);
        const l = lum(p2);
        if (c > bc || (c === bc && l < bl)) (best = p2), (bc = c), (bl = l);
      }
      if (s3) {
        const c = 1 + (p0 === p3 ? 1 : 0) + (p1 === p3 ? 1 : 0) + (p2 === p3 ? 1 : 0);
        const l = lum(p3);
        if (c > bc || (c === bc && l < bl)) best = p3;
      }
      out[o + x] = best;
    }
  }
  return out;
}

/**
 * Selective outline: every transparent pixel touching an opaque one becomes a
 * deep, warm shade of the colour it borders (darker underneath), never black.
 */
export function outlineBuffer(data: Uint32Array, w: number, h: number, k = 0.7) {
  const src = data.slice();
  const OR = 0x3b;
  const OG = 0x2a;
  const OB = 0x26;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i] >>> 24) continue;
      let s = -1;
      let kk = k;
      if (y > 0 && src[i - w] >>> 24 > 200) (s = src[i - w]), (kk = k + 0.08);
      else if (x > 0 && src[i - 1] >>> 24 > 200) s = src[i - 1];
      else if (x < w - 1 && src[i + 1] >>> 24 > 200) s = src[i + 1];
      else if (y < h - 1 && src[i + w] >>> 24 > 200) (s = src[i + w]), (kk = k - 0.1);
      if (s < 0) continue;
      const r = Math.round((s & 255) + (OR - (s & 255)) * kk);
      const g = Math.round(((s >>> 8) & 255) + (OG - ((s >>> 8) & 255)) * kk);
      const b = Math.round(((s >>> 16) & 255) + (OB - ((s >>> 16) & 255)) * kk);
      data[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
}

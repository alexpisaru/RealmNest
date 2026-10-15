// Character pipeline prototype: RGBA images, PNG read/write (8-bit, non-interlaced; what
// EffectCraft writes and what our tools write) and the pixel helpers the pipeline needs.
// No dependencies beyond node:zlib, like the other tools/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

export interface Img {
  w: number;
  h: number;
  /** RGBA, 4 bytes per pixel, row-major */
  d: Uint8Array;
}

export const blank = (w: number, h: number): Img => ({ w, h, d: new Uint8Array(w * h * 4) });
export const clone = (im: Img): Img => ({ w: im.w, h: im.h, d: im.d.slice() });
export const idx = (im: Img, x: number, y: number) => (y * im.w + x) * 4;
export const alpha = (im: Img, x: number, y: number) => (x < 0 || y < 0 || x >= im.w || y >= im.h ? 0 : im.d[idx(im, x, y) + 3]);
/** 0xRRGGBBAA, 0 when transparent (or outside) */
export function px(im: Img, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return 0;
  const i = idx(im, x, y);
  if (!im.d[i + 3]) return 0;
  return ((im.d[i] << 24) | (im.d[i + 1] << 16) | (im.d[i + 2] << 8) | im.d[i + 3]) >>> 0;
}
export function setPx(im: Img, x: number, y: number, c: number) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
  const i = idx(im, x, y);
  im.d[i] = c >>> 24;
  im.d[i + 1] = (c >>> 16) & 255;
  im.d[i + 2] = (c >>> 8) & 255;
  im.d[i + 3] = c & 255;
}
export const hex = (c: string) => ((parseInt(c.slice(1, 7), 16) << 8) | 0xff) >>> 0;
/** the colour with full alpha, as an unsigned 0xRRGGBBFF (plain `c | 0xff` would turn negative for red ≥ 0x80) */
export const opaque = (c: number) => (c | 0xff) >>> 0;
export const toHex = (c: number) => '#' + (c >>> 8).toString(16).padStart(6, '0');

// ── PNG ──────────────────────────────────────────────────────

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(b: Uint8Array) {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const o = new Uint8Array(12 + data.length);
  const dv = new DataView(o.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  o.set(data, 8);
  dv.setUint32(8 + data.length, crc(o.subarray(4, 8 + data.length)));
  return o;
}

export function encodePng(im: Img): Uint8Array {
  const raw = new Uint8Array((im.w * 4 + 1) * im.h);
  for (let y = 0; y < im.h; y++) raw.set(im.d.subarray(y * im.w * 4, (y + 1) * im.w * 4), y * (im.w * 4 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, im.w);
  dv.setUint32(4, im.h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function decodePng(buf: Uint8Array): Img {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (o < buf.length) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(...buf.subarray(o + 4, o + 8));
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(o + 8);
      h = dv.getUint32(o + 12);
      depth = data[8];
      ctype = data[9];
      if (data[12]) throw new Error('interlaced PNG not supported');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const bpc = depth / 8;
  if (depth !== 8 && depth !== 16) throw new Error(`PNG bit depth ${depth} not supported`);
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[ctype];
  if (!ch) throw new Error(`PNG colour type ${ctype} not supported`);
  const bpp = ch * bpc;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const cur = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const im = blank(w, h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = (k: number) => cur[x * bpp + k * bpc]; // 16-bit: the high byte
      const i = (y * w + x) * 4;
      if (ctype === 6) im.d.set([s(0), s(1), s(2), s(3)], i);
      else if (ctype === 2) im.d.set([s(0), s(1), s(2), 255], i);
      else if (ctype === 0) im.d.set([s(0), s(0), s(0), 255], i);
      else if (ctype === 4) im.d.set([s(0), s(0), s(0), s(1)], i);
      else {
        const p = s(0);
        im.d.set([palette![p * 3], palette![p * 3 + 1], palette![p * 3 + 2], trns && p < trns.length ? trns[p] : 255], i);
      }
    }
    prev.set(cur);
  }
  return im;
}

export const readPng = (path: string) => decodePng(readFileSync(path));
export function writePng(path: string, im: Img) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(im));
}

// ── pixel helpers ────────────────────────────────────────────

/** Scale2x (EPX): doubles a sprite without inventing colours, smoothing diagonal edges. */
export function scale2x(src: Img): Img {
  const out = blank(src.w * 2, src.h * 2);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const P = px(src, x, y);
      const A = px(src, x, y - 1);
      const B = px(src, x + 1, y);
      const C = px(src, x - 1, y);
      const D = px(src, x, y + 1);
      setPx(out, 2 * x, 2 * y, C === A && C !== D && A !== B ? A : P);
      setPx(out, 2 * x + 1, 2 * y, A === B && A !== C && B !== D ? B : P);
      setPx(out, 2 * x, 2 * y + 1, D === C && D !== B && C !== A ? C : P);
      setPx(out, 2 * x + 1, 2 * y + 1, B === D && B !== A && D !== C ? D : P);
    }
  return out;
}

/** Back from k× by sampling each k×k block at (k/2, k/2), as RotSprite does. */
export function sampleDown(src: Img, k: number): Img {
  const out = blank(Math.floor(src.w / k), Math.floor(src.h / k));
  const o = k >> 1;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) setPx(out, x, y, px(src, x * k + o, y * k + o));
  return out;
}

/** Nearest-neighbour enlargement, for previews and GIFs only. */
export function upscale(src: Img, k: number): Img {
  const out = blank(src.w * k, src.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) setPx(out, x, y, px(src, Math.floor(x / k), Math.floor(y / k)));
  return out;
}

/** Draws `src` over `dst` at (ox, oy); alpha is binary in this pipeline, so no blending. */
export function blit(dst: Img, src: Img, ox: number, oy: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = px(src, x, y);
      if (c) setPx(dst, ox + x, oy + y, c);
    }
}

export function bbox(im: Img): [number, number, number, number] | null {
  let x0 = im.w;
  let y0 = im.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++)
      if (im.d[idx(im, x, y) + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}

export function colours(im: Img): Set<number> {
  const s = new Set<number>();
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const c = px(im, x, y);
    if (c) s.add(opaque(c));
  }
  return s;
}

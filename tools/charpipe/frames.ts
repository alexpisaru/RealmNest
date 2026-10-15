// Character pipeline prototype, step 3: check and normalise rendered frames, pack them, describe them.
//
// The renderer is not trusted to be pixel-safe: every frame is measured, and anything that is not
// exactly what pixel art allows is reported (and, where it is safe, corrected):
//   size        the frame is exactly frame × k; anything else means scaling crept in
//   alpha       no semi-transparent pixel (anti-aliasing); hard-thresholded at 50 % if any
//   palette     every colour comes from the source art; strays snap to the nearest source colour
//   anchor      the lowest opaque row (the soles) per frame, and the bbox per frame (jumping)
//   rest match  frame-0 pixels that differ from the rest-pose sprite (only meaningful for idle)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bbox, blank, blit, colours, idx, opaque, px, readPng, sampleDown, setPx, toHex, writePng, type Img } from './img';

export interface FrameReport {
  frame: number;
  partialAlpha: number;
  offPalette: number;
  /** lowest opaque row, i.e. where the feet touch */
  soleRow: number;
  bbox: [number, number, number, number] | null;
}
export interface SequenceReport {
  anim: string;
  mode: string;
  frames: FrameReport[];
  sizeOk: boolean;
  rawSize: [number, number];
  restDiff?: number;
  warnings: string[];
}

function nearest(c: number, pal: number[]): number {
  let best = pal[0];
  let bd = Infinity;
  const r = c >>> 24;
  const g = (c >>> 16) & 255;
  const b = (c >>> 8) & 255;
  for (const p of pal) {
    const d = (r - (p >>> 24)) ** 2 + (g - ((p >>> 16) & 255)) ** 2 + (b - ((p >>> 8) & 255)) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export function normalise(rawDir: string, outDir: string, o: { anim: string; mode: string; k: number; w: number; h: number; palette: Set<number>; rest?: Img }): { report: SequenceReport; frames: Img[] } {
  const files = readdirSync(rawDir)
    .filter((f) => /^raw_\d+\.png$/.test(f))
    .sort();
  const pal = [...o.palette];
  const warnings: string[] = [];
  const frames: Img[] = [];
  const reports: FrameReport[] = [];
  let sizeOk = true;
  let rawSize: [number, number] = [0, 0];
  files.forEach((f, i) => {
    let im = readPng(join(rawDir, f));
    rawSize = [im.w, im.h];
    if (im.w !== o.w * o.k || im.h !== o.h * o.k) {
      sizeOk = false;
      warnings.push(`${f}: ${im.w}×${im.h}, expected ${o.w * o.k}×${o.h * o.k}`);
    }
    // alpha: count, then harden
    let partialAlpha = 0;
    for (let p = 3; p < im.d.length; p += 4) {
      const a = im.d[p];
      if (a > 0 && a < 255) partialAlpha++;
      im.d[p] = a >= 128 ? 255 : 0;
    }
    if (o.k > 1) im = sampleDown(im, o.k);
    // palette
    let offPalette = 0;
    for (let y = 0; y < im.h; y++)
      for (let x = 0; x < im.w; x++) {
        const c = px(im, x, y);
        if (c && !o.palette.has(opaque(c))) {
          offPalette++;
          setPx(im, x, y, nearest(c, pal));
        }
      }
    const b = bbox(im);
    reports.push({ frame: i, partialAlpha, offPalette, soleRow: b ? b[3] : -1, bbox: b });
    writePng(join(outDir, `frame_${String(i).padStart(3, '0')}.png`), im);
    frames.push(im);
  });
  const report: SequenceReport = { anim: o.anim, mode: o.mode, frames: reports, sizeOk, rawSize, warnings };
  const aa = reports.reduce((n, r) => n + r.partialAlpha, 0);
  const off = reports.reduce((n, r) => n + r.offPalette, 0);
  if (aa) warnings.push(`${aa} semi-transparent pixels in the raw render (anti-aliasing), hardened`);
  if (off) warnings.push(`${off} pixels not in the source palette, snapped`);
  const soles = new Set(reports.map((r) => r.soleRow));
  if (soles.size > 1) warnings.push(`sole row moves: ${[...soles].join(', ')}`);
  if (o.rest && frames[0]) {
    let d = 0;
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (px(frames[0], x, y) !== px(o.rest, x, y)) d++;
    report.restDiff = d;
  }
  return { report, frames };
}

/** A horizontal strip, no padding, frames in order. */
export function pack(frames: Img[]): Img {
  const w = frames[0].w;
  const sheet = blank(w * frames.length, frames[0].h);
  frames.forEach((f, i) => blit(sheet, f, i * w, 0));
  return sheet;
}

export function paletteOf(...ims: Img[]): Set<number> {
  const s = new Set<number>();
  for (const im of ims) for (const c of colours(im)) s.add(c);
  return s;
}

/** For the report: frames side by side on a background, enlarged k×, with a 1-px ground line at the anchor. */
export function contactSheet(rows: Img[][], k: number, footY: number, bg = 0x3a3f4aff): Img {
  const w = rows[0][0].w;
  const h = rows[0][0].h;
  const cols = Math.max(...rows.map((r) => r.length));
  const out = blank(cols * (w + 4) * k, rows.length * (h + 4) * k);
  for (let p = 0; p < out.d.length; p += 4) setPx(out, (p / 4) % out.w, Math.floor(p / 4 / out.w), bg);
  rows.forEach((r, ry) =>
    r.forEach((f, cx) => {
      const ox = cx * (w + 4) * k;
      const oy = ry * (h + 4) * k;
      for (let x = 0; x < w * k; x++) setPx(out, ox + x, oy + footY * k, 0x6b7385ff);
      for (let y = 0; y < h * k; y++)
        for (let x = 0; x < w * k; x++) {
          const c = px(f, Math.floor(x / k), Math.floor(y / k));
          if (c) {
            const i = idx(out, ox + x, oy + y);
            out.d[i] = c >>> 24;
            out.d[i + 1] = (c >>> 16) & 255;
            out.d[i + 2] = (c >>> 8) & 255;
            out.d[i + 3] = 255;
          }
        }
    }),
  );
  return out;
}

export const hexList = (s: Set<number>) => [...s].map(toHex);

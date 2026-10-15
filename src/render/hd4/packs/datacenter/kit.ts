// Data Center — small helpers of this pack: a 3×5 pixel font for labels and
// signs, and the pack's own surface materials (perforated rack doors, ribbed
// trapezoidal cladding, snow on top faces, charred timber).
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { bayer, hash, px, type C, type Ramp } from '../../kit4';
import type { Plane } from '../../plane4';
import { CHAR, CLAD, RACK, SNOW } from './palette';

/** A ramp tone by a fractional index, rounded and clamped (always a colour of the ramp). */
export const at = (r: Ramp, i: number) => {
  const k = Math.round(i);
  return r[k >= r.length ? r.length - 1 : k >= 0 ? k : 0];
};

// ── a 3×5 pixel font ────────────────────────────────────────
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '-': '000000111000000', '.': '000000000000010', '%': '101001010100101', ':': '000010000010000',
  '/': '001001010100100', '°': '010101010000000', ' ': '000000000000000', '>': '100010001010100', '+': '000010111010000',
};

/**
 * Write a short label in pixels along a vertical plane: (u, z) is the top-left
 * of the first letter; `dir` 1 reads along +u (front planes), -1 along −u (side
 * planes, so the text still reads left to right on screen). `s` = pixel size.
 */
export function label(p: PropPainter, pl: Plane, u: number, z: number, str: string, col: string, dir: 1 | -1 = 1, s = 1) {
  const [ox, oy] = pl.F(u, z);
  const [ax, ay] = pl.F(u + dir, z);
  const len = Math.hypot(ax - ox, ay - oy);
  const ux = (ax - ox) / len;
  const uy = (ay - oy) / len;
  let cx = 0;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) {
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++) {
          if (g[r * 3 + c] !== '1') continue;
          const d = (cx + c) * s;
          px(p.c, Math.round(ox + ux * d * 1.12), Math.round(oy + uy * d * 1.12 + r * s), col, s, s);
        }
    }
    cx += 4;
  }
}

/** The same font straight on screen (for sprites drawn in screen space). */
export function labelXY(c: C, x: number, y: number, str: string, col: string, s = 1) {
  let cx = 0;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === '1') px(c, x + (cx + k) * s, y + r * s, col, s, s);
    cx += 4;
  }
}

/** Pixel size for live (anim) drawing: 1 art pixel at zoom ≥ 1, half below. */
export const unit = (p: PropPainter) => Math.max(1, Math.round(p.k / 4));

// ── materials ───────────────────────────────────────────────
const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/**
 * Trapezoidal ribbed steel cladding: a rib every `pitch` px — a lit left flank,
 * a flat crest, a shaded right flank, then the wide pan — with streaks of grime
 * running down from the top and a darker foot.
 */
export const ribbed =
  (r: Ramp = CLAD, pitch = 13): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const f = u % pitch;
    let i = base(light, r.length) + 0.2;
    if (f < 1.2) i += light ? 1.3 : 0.9; // the lit flank
    else if (f < 3.2) i += light ? 0.7 : 0.45; // the crest
    else if (f < 4.4) i -= 1.1; // the shaded flank
    else if (f > pitch - 1) i -= 0.35;
    // weathering: faint vertical streaks below the top, a dirty foot splashed by snowmelt
    if (hash(Math.floor(u / 3), 7, 3) < 0.18 && v > h - 30 - hash(Math.floor(u / 3), 8, 3) * 40) i -= 0.4;
    if (v < 8 && bayer(x, y) * 8 > v + 1) i -= 0.7;
    if (hash(x, y, 5) < 0.015) i -= 0.6;
    return at(r, i);
  };

/** Charred timber boards (shou sugi ban): vertical boards, a crackled alligator texture, a silvery sheen. */
export const charred: Mat = (light, _w, h) => (u, v, x, y) => {
  const bw = 10;
  const b = Math.floor(u / bw);
  const fu = u - b * bw;
  let i = (light ? 3 : 1.8) + (hash(b, 1, 41) - 0.5) * 0.8;
  if (fu < 1) return at(CHAR, 0);
  if (fu < 2 && light) i += 0.7;
  // the crackle: small rounded cells, lit on their upper edge
  const cy = Math.floor((v + hash(b, 2, 42) * 9) / 4.5);
  const cl = (v + hash(b, 2, 42) * 9) % 4.5;
  if (cl < 0.9) i -= 0.9;
  else if (cl > 3.6 && hash(b, cy, 43) < 0.5) i += 0.6;
  if (hash(x, y, 44) < 0.03) i += 1.2;
  if (v > h - 2) i -= 0.6;
  return at(CHAR, i);
};

/** Fresh snow lying on a top face: soft and bright, faint wind ripples, blue crystal dents. Cheap (big roofs). */
export const snowTop: Mat = () => (u, v, x, y) => {
  let i = 5.15;
  const h = hash(x, y, 62);
  if (h < 0.018) i -= 0.9;
  else if (h > 0.996) return SNOW[6];
  // long soft ripples every few tiles, broken up
  const r = (v + u * 0.21) % 41;
  if (r < 1.2 && hash(Math.floor(u / 9), Math.floor(v / 41), 63) < 0.55) i -= 0.7;
  else if (r < 2.2 && hash(Math.floor(u / 9), Math.floor(v / 41), 63) < 0.55) i += 0.5;
  return at(SNOW, i + (bayer(x, y) - 0.5) * 0.5);
};

/** Perforated steel of a rack door: holes on a 3 px pitch over dark server fronts behind. */
export const meshDoor: Mat = (light) => (u, v) => {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const hole = iu % 3 !== 2 && iv % 3 !== 2;
  if (!hole) return at(RACK, light ? 3.4 : 2.6);
  // through the holes: the servers, bands of 2U with a lit top edge
  const band = Math.floor(v / 4);
  const f = v - band * 4;
  return at(RACK, f > 3 ? 2.2 : (band & 1 ? 1 : 0.6) + (hash(band, Math.floor(u / 11), 3) < 0.2 ? 1 : 0));
};

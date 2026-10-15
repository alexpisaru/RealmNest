// Robotics pack — palette and surface materials of a working hangar at a small
// airfield: powder-coated steel, galvanised corrugated sheet, aluminium
// extrusion, birch ply, safety yellow, PCB green, sealed concrete.
// Materials, not designs: every prop of this pack builds on them.
import type { FaceTex, Light, Mat } from '../../../hd/kit';
import { at, bayer, fillPoly, hash, noise2, type Ramp } from '../../kit4';

// ── ramps (dark → light) ────────────────────────────────────
/** powder-coated machine steel, nearly black-blue */
export const STEEL: Ramp = ['#17191f', '#20232b', '#2b2f39', '#373c48', '#464c5a', '#5a6170', '#727a8a'];
/** the hangar's slate blue (walls, cabinets) */
export const SLATE: Ramp = ['#162234', '#1e2e46', '#283c58', '#334c6a', '#40607e', '#527492', '#6a8caa'];
/** galvanised steel sheet */
export const GALV: Ramp = ['#454c54', '#5b646c', '#737d85', '#8d979e', '#a8b1b6', '#c4cbce', '#e0e5e6'];
/** anodised aluminium extrusion */
export const ALU: Ramp = ['#59606a', '#737b86', '#8f98a3', '#adb5bf', '#c9cfd6', '#e1e5e9', '#f4f6f8'];
/** safety yellow */
export const YEL: Ramp = ['#6a460e', '#946414', '#bf891e', '#dfa92c', '#f3c843', '#f8db74', '#fcefae'];
/** the workshop's teal accent */
export const TEAL: Ramp = ['#0e343c', '#134a55', '#1a6270', '#227c8c', '#2b98aa', '#3fb6c8', '#7ad6e2'];
/** PLA orange (prints, cables, cones) */
export const ORANGE: Ramp = ['#5a2210', '#80321a', '#a84822', '#cc622c', '#ea8240', '#f6a462', '#fcc890'];
/** red: tool chests, extinguishers, fuel bands */
export const RED: Ramp = ['#43100f', '#661816', '#8e2220', '#b42e28', '#d24434', '#e86a50', '#f49a80'];
/** birch plywood */
export const BIRCH: Ramp = ['#6a5032', '#886a44', '#a68658', '#c0a070', '#d6b98a', '#e6cfa6', '#f2e2c4'];
/** beech butcher block */
export const BEECH: Ramp = ['#5c3618', '#7a4a22', '#98602e', '#b4783c', '#c99050', '#dcaa6a', '#ecc68e'];
/** kraft cardboard */
export const KRAFT: Ramp = ['#5e4224', '#7c5a32', '#9a7442', '#b48c54', '#c8a46a', '#dabc86'];
/** pine battens and crate boards */
export const PINE: Ramp = ['#5a3e22', '#7a5630', '#9a7040', '#b88a52', '#d0a468', '#e2bc82', '#f0d4a2'];
/** PCB solder mask */
export const PCB: Ramp = ['#0b2416', '#10341f', '#164628', '#1e5c34', '#287442', '#3a9256'];
/** black rubber and plastics */
export const RUBBER: Ramp = ['#111216', '#18191e', '#202228', '#2a2c34', '#363944', '#464a56'];
/** off-white robot shells and appliance plastics */
export const SHELL: Ramp = ['#7c7e86', '#9a9ca4', '#b6b8be', '#cfd0d4', '#e2e3e5', '#f0f1f2', '#fbfbfc'];
/** sealed workshop concrete */
export const CONC: Ramp = ['#5e5a52', '#726d64', '#878177', '#9b958a', '#aea89c', '#c0baae', '#d2cdc2'];
/** hazard black */
export const HAZK = '#1d1c20';

export const LED = { green: '#62f08e', red: '#ff5446', amber: '#ffb03a', blue: '#5cb8ff', cyan: '#62e6f0', white: '#f6fbff' };

/** A ramp of n tones around a base colour (shadows to purple, lights to warm). */
export function ramp6(hex: string): Ramp {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r, g, b] = p(hex);
  const to = (rr: number, gg: number, bb: number) => '#' + [rr, gg, bb].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const dk = (t: number) => to(r + (42 - r) * t, g + (31 - g) * t, b + (61 - b) * t);
  const lt = (t: number) => to(r + (255 - r) * t, g + (246 - g) * t, b + (226 - b) * t);
  return [dk(0.6), dk(0.42), dk(0.22), hex, lt(0.2), lt(0.4)];
}

export const base = (light: Light | number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

// ── materials ───────────────────────────────────────────────
/**
 * Corrugated sheet with vertical ribs: a lit flank, a crest highlight, a
 * shaded flank and a dark valley per rib; sheet laps, fastener rows, rust
 * runs under a few fasteners and grime rising from the foot.
 */
export const corrugated =
  (r: Ramp, o: { pitch?: number; lap?: number; rust?: number; seed?: number; grime?: number; tint?: number } = {}): Mat =>
  (light) => {
    const P = o.pitch ?? 6;
    const lap = o.lap ?? 66;
    const seed = o.seed ?? 0;
    const rust = o.rust ?? 0.35;
    const grime = o.grime ?? 14;
    const b0 = base(light, r.length);
    const RUST = ['#5a2e1a', '#7a4024', '#985434'];
    return (u, v, x, y) => {
      const sheet = Math.floor(u / lap);
      const f = (((u % P) + P) % P) / P;
      let i = b0 + (hash(sheet, 1, seed) - 0.5) * (o.tint ?? 0.9);
      if (f < 0.28) i += light ? 0.5 : 0.15;
      else if (f < 0.46) i += light ? 1.25 : 0.55;
      else if (f < 0.76) i -= light ? 0.45 : 0.3;
      else i -= 1.05;
      const lu = ((u % lap) + lap) % lap;
      if (lu < 1) i -= 1.6;
      else if (lu < 2) i += 0.4;
      // fastener rows on the crests every ~1 m
      const row = Math.floor((v + 6) / 34);
      const fv = v + 6 - row * 34;
      const crest = f >= 0.28 && f < 0.46;
      if (crest && fv < 1.2 && hash(Math.floor(u / P), row, seed + 3) < 0.5) {
        // a rust run under some fasteners
        return light ? '#d8dcdc' : '#9aa0a2';
      }
      if (rust > 0 && crest) {
        const rk = hash(Math.floor(u / P), row, seed + 5);
        if (rk < rust * 0.3 && fv > 1.2 && fv < 1.2 + rk * 60) return RUST[light ? 2 : 1];
      }
      // weathering: rain streaks running down from the fastener rows, grime from the ground
      const sc = Math.floor(u / 3);
      const hs = hash(sc, 1, seed + 7);
      if (hs < 0.16) {
        const top = 20 + hash(sc, 2, seed + 7) * 120;
        if (v < top && v > top - 16 - hs * 160 && bayer(x, y) > 0.35) i -= 0.6;
      }
      if (v < grime && bayer(x, y) * grime > v) i -= 1;
      if (hash(x, y, seed + 9) < 0.015) i -= 0.8;
      return at(r, i);
    };
  };

/** A trapezoidal box profile (wide flat pans, narrow ribs) for hangar cladding. */
export const boxProfile =
  (r: Ramp, o: { pitch?: number; seed?: number; rust?: number; grime?: number } = {}): Mat =>
  (light) => {
    const P = o.pitch ?? 14;
    const seed = o.seed ?? 0;
    const b0 = base(light, r.length);
    const grime = o.grime ?? 16;
    return (u, v, x, y) => {
      const k = Math.floor(u / P);
      const f = u - k * P;
      let i = b0 + (hash(Math.floor(u / 70), 2, seed) - 0.5) * 0.7;
      if (f < 1) i -= 1.3;
      else if (f < 2.2) i += light ? 1.2 : 0.5;
      else if (f < 3.4) i += 0.4;
      else if (f > P - 1.6) i -= 0.6;
      const sc = Math.floor(u / 4);
      const hs = hash(sc, 1, seed + 1);
      if (hs < 0.14) {
        const top = 30 + hash(sc, 2, seed + 1) * 140;
        if (v < top && v > top - 20 - hs * 200 && bayer(x, y) > 0.4) i -= 0.6;
      }
      if (v < grime && bayer(x, y) * grime > v) i -= 1;
      if ((o.rust ?? 0) > 0 && f < 2.2 && hash(k, Math.floor(v / 40), seed + 4) < (o.rust ?? 0) * 0.07 && v % 40 < 14) return light ? '#6e5244' : '#4e3e36';
      if (hash(x, y, seed + 2) < 0.012) i -= 0.8;
      return at(r, i);
    };
  };

/** Painted concrete block: running bond, mortar under the paint, scuffs near the floor. */
export const blockwork =
  (r: Ramp, bw = 32, bh = 8): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / bh);
    const fv = v - row * bh;
    const off = row & 1 ? bw / 2 : 0;
    const col = Math.floor((u + off) / bw);
    const fu = u + off - col * bw;
    let i = base(light, r.length) + (hash(col, row, 81) - 0.5) * 0.5;
    if (fv < 1 || fu < 1) i -= 0.9;
    else if (fv > bh - 1.5) i += 0.5;
    // the block's open texture through the paint
    const g = hash(x, y, 82);
    if (g < 0.07) i -= 0.6;
    else if (g > 0.97) i += 0.6;
    if (noise2(u * 0.05, v * 0.08, 83) > 0.7 && bayer(x, y) > 0.55) i -= 0.5;
    // scuffs and cart knocks low down
    if (v < 10 && hash(Math.floor(u / 9), Math.floor(v / 3), 84) < 0.06) i -= 1.2;
    return at(r, i);
  };

/** Cast concrete: formwork panel lines, tie holes, a few pores and stains. */
export const castConcrete =
  (r: Ramp, panel = 48): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if (u % panel < 1) i -= 0.8;
    const tu = u % (panel / 2);
    const tv = v % 22;
    if (Math.abs(tu - panel / 4) < 1.2 && Math.abs(tv - 11) < 1.2) return at(r, i - 1.6);
    const g = hash(x, y, 91);
    if (g < 0.05) i -= 0.8;
    if (noise2(u * 0.04, v * 0.06, 92) > 0.66 && bayer(x, y) > 0.5) i -= 0.6;
    if (v < 6 && bayer(x, y) * 6 > v) i -= 0.8;
    return at(r, i);
  };

/** Perforated hardboard (pegboard): a grid of holes, each with a lit lower lip. */
export const pegboardMat: Mat = (light) => (u, v, x, y) => {
  const PB: Ramp = ['#6a4e30', '#8a6a44', '#a68458', '#bc9a6c', '#cfae80', '#ddc296'];
  const S = 6;
  const fu = u % S;
  const fv = v % S;
  let i = base(light, PB.length) + (noise2(u * 0.03, v * 0.03, 95) - 0.5) * 0.8;
  if (fu >= 2 && fu < 4 && fv >= 2 && fv < 4) return fv < 3 ? '#2a1e16' : '#3e2c1e';
  if (hash(x, y, 96) < 0.03) i -= 0.6;
  return at(PB, i);
};

/** Plywood: soft grain on the faces; the edge shows its laminations. */
export const plyFace =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.2;
    if (noise2(u * 0.05 + v * 0.4, v * 0.2, 97) > 0.66) i -= 0.6;
    if (noise2(u * 0.02, v * 0.6, 98) < 0.22) i += 0.4;
    if (hash(x, y, 99) < 0.025) i -= 0.6;
    return at(r, i);
  };
export const plyEdge =
  (r: Ramp): Mat =>
  (light) =>
  (_u, v) =>
    at(r, base(light, r.length) + (Math.floor(v) % 2 ? -0.8 : 0.5));

/** Checker (diamond) plate. */
export const diamondPlate =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    const cu = Math.floor(u / 5);
    const cv = Math.floor(v / 4);
    const fu = u - cu * 5;
    const fv = v - cv * 4;
    const odd = (cu + cv) & 1;
    if (odd ? fu > 1 && fu < 4 && fv > 1.4 && fv < 2.4 : fu > 1.6 && fu < 2.6 && fv > 0.6 && fv < 3.2) i += 1.2;
    if (hash(x, y, 101) < 0.04) i -= 0.6;
    return at(r, i);
  };

/** Powder coat or enamel: flat, a lit top lip, a dark foot, a few chips. */
export const enamel =
  (r: Ramp, chips = 0.01): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length);
    if (v > h - 1.5) i += 1;
    if (v < 1.5) i -= 1;
    const g = hash(x, y, 103);
    if (g < chips) return '#8a8e94';
    if (g > 0.985) i += 0.6;
    return at(r, i);
  };

/** Brushed aluminium with the slot lines of an extrusion. */
export const extrusion =
  (r: Ramp = ALU, slots = true): Mat =>
  (light, w, h) =>
  (u, v) => {
    let i = base(light, r.length);
    const long = Math.max(w, h);
    const across = long === h ? u : v;
    const size = long === h ? w : h;
    if (slots && size > 5 && Math.abs(across - size / 2) < 0.8) i -= 1.4;
    if (across < 1) i += 0.8;
    return at(r, i);
  };

/** Glass seen from outside or inside: tinted, two diagonal reflections. */
export const glassMat =
  (r: Ramp, band = 34): Mat =>
  (light, w) =>
  (u, v, x, y) => {
    const d = (u * 0.85 + v) % band;
    let i = light === 0 ? 1.3 : 2.2;
    if (d > 4 && d < 9) i += 2;
    else if (d > 13 && d < 15) i += 1.1;
    if (v < 3 && (u < 5 || u > w - 5)) i -= 1;
    if (hash(x, y, 105) < 0.02) i += 1;
    return at(r, i);
  };

/** window glass: deep teal, as in the reference (#0c3f52 … #4595ae) */
export const GLASS: Ramp = ['#08262e', '#0c3a4a', '#0f5068', '#17688a', '#2a84a6', '#5aa8c4', '#bfe6f0'];

/** Flat colour as a texture (for poly3 / pt) */
export const flat =
  (col: string): FaceTex =>
  () =>
    col;

/** A glyph table (3×5 pixel font) for stencils, registrations and numbers. */
export const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  '-': ['000', '000', '111', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

/**
 * Stencil text onto any planar parallelogram: origin O, unit steps U (one
 * glyph pixel to the right) and V (one glyph pixel down), all in screen px.
 */
export function stencil(c: CanvasRenderingContext2D, text: string, ox: number, oy: number, ux: number, uy: number, vx: number, vy: number, col: string) {
  let cx = 0;
  const tiny = Math.abs(ux) + Math.abs(uy) < 1.6 && Math.abs(vx) + Math.abs(vy) < 1.6;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 3; k++) {
        if (g[r][k] !== '1') continue;
        const gx = cx + k;
        const x = ox + gx * ux + r * vx;
        const y = oy + gx * uy + r * vy;
        if (tiny) {
          c.fillStyle = col;
          c.fillRect(Math.round(x), Math.round(y), 1, 1);
        } else
          fillPoly(
            c,
            [
              [x, y],
              [x + ux, y + uy],
              [x + ux + vx, y + uy + vy],
              [x + vx, y + vy],
            ],
            col,
          );
      }
    cx += 4;
  }
}

/** Width of a stencilled string in glyph pixels. */
export const textW = (text: string) => text.length * 4 - 1;

export { at, hash, noise2, bayer };

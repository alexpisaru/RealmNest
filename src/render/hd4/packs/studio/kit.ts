// Creative Studio — the pack's own ramps, surface materials and small helpers
// (a seaside arts district: sun-faded painted timber, corrugated tin, plywood,
// corduroy, rattan, zellige, sand and sea). Designs stay in this folder.
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Light, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, hash, noise2, type Ramp } from '../../kit4';
import { poly3 } from '../../plane4';

// ── ramps (dark → light; shadows lean violet, lights lean warm) ──
export const PLY: Ramp = ['#6e5236', '#8c6c48', '#aa885c', '#c4a274', '#d8ba8c', '#e8cfa6', '#f4e2c2'];
export const PINE: Ramp = ['#6a4426', '#865834', '#a26c40', '#b9814e', '#cc965e', '#dcab72', '#eac28c'];
export const WALNUT: Ramp = ['#26160e', '#3a2316', '#50311e', '#664028', '#7c5234', '#946644'];
export const BEECH: Ramp = ['#6e4a30', '#8c613e', '#a87a4e', '#c09262', '#d4aa78', '#e4c294'];
export const GEAR: Ramp = ['#111015', '#1a1920', '#24232b', '#302f38', '#3e3d48', '#53525e', '#6c6b78'];
export const ALU: Ramp = ['#4a4f58', '#666c76', '#848b95', '#a4abb4', '#c4cad1', '#e0e4e8', '#f6f8fa'];
export const CHAR: Ramp = ['#1e1d24', '#2a2932', '#383742', '#474654', '#585766', '#6c6b7a'];
export const CORAL: Ramp = ['#7a2418', '#9a3020', '#c0402c', '#e4664a', '#f08068', '#f8a088', '#fdc4ac'];
export const TEAL: Ramp = ['#0c4048', '#10565e', '#167078', '#1e8a90', '#2aa4a6', '#46bcba', '#78d6ce'];
export const MUSTARD: Ramp = ['#7a4a0c', '#9a6210', '#c07e1a', '#e0a030', '#f3ba4f', '#f8d564', '#fce68e'];
export const MINT: Ramp = ['#1c5a4e', '#287464', '#38907e', '#56a9a1', '#77c6c1', '#9cdcd4', '#c6f0e8'];
export const SKY: Ramp = ['#1e3c7a', '#2a5298', '#3a6ab6', '#5286cc', '#6d98d1', '#90b6e6', '#bcd6f4'];
export const PINK: Ramp = ['#781c46', '#a02c60', '#c15984', '#e0749e', '#f291b6', '#f8b4cc', '#fdd6e4'];
export const LILAC: Ramp = ['#34276a', '#4a3a88', '#6d5aa2', '#8a76c2', '#a696da', '#c0b4ea', '#ddd6f6'];
export const LEMON: Ramp = ['#7a5e0e', '#a08016', '#c8a01e', '#e8c42e', '#f8d564', '#fce47c', '#fef0aa'];
export const CREAM: Ramp = ['#8c7e6c', '#a89a86', '#c4b6a0', '#dbcfba', '#ebe2d0', '#f6f0e4', '#fffbf4'];
export const WALLW: Ramp = ['#b49678', '#ccae8c', '#e2c6a0', '#f0d8b4', '#f8e6c6', '#fdf0d8', '#fffaf0'];
export const SAND: Ramp = ['#c08648', '#d29a58', '#e6b06c', '#f6c47c', '#ffd08a', '#ffdc9e', '#ffe8ba'];
export const DRIFT: Ramp = ['#4a4038', '#625649', '#7c6e5e', '#958774', '#ae9f8a', '#c6b8a2', '#dcd0bc'];
export const RUST: Ramp = ['#4a2214', '#68301a', '#884222', '#a8582e', '#c4723e', '#d88e56'];
export const LEAF: Ramp = ['#123816', '#1c4c1c', '#286424', '#367e2c', '#4a9836', '#64b042', '#88c858'];
export const PALMLEAF: Ramp = ['#16340c', '#224810', '#306218', '#427c20', '#58962a', '#76ae38', '#9cc652'];
export const MARRAM: Ramp = ['#1e3a0a', '#2a4a0e', '#3e6216', '#5d742d', '#7a9234', '#a5ab34', '#c8cc6a'];
export const TERRA: Ramp = ['#5e2a1c', '#7e3a26', '#9e4e32', '#bc6640', '#d28052', '#e29c6c'];

/** A fabric ramp around a colour. */
export const fabric = (col: string): Ramp => [darken(col, 0.56), darken(col, 0.4), darken(col, 0.22), col, lighten(col, 0.16), lighten(col, 0.32)];

// ── surface materials ────────────────────────────────────────
const base = (light: Light, n: number) => (light === 2 ? n - 1.8 : light === 1 ? n - 3 : Math.max(0.7, n - 5.6));

/** Flat colour per face light (no texture): for distant or tiny faces. */
export const flat =
  (r: Ramp, off = 0): Mat =>
  (light) =>
  () =>
    at(r, base(light, r.length) + off);

/** Vertical shiplap boards (whitewashed interior walls): V-grooves with a lit lip, faint grain, nail heads. */
export const shiplap =
  (r: Ramp, bw = 13): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const b = Math.floor(u / bw);
    const fu = u - b * bw;
    let i = base(light, r.length) + (hash(b, 3, 71) - 0.5) * 0.7;
    if (fu < 1) return at(r, i - 1.6);
    if (fu < 2) i += 0.7;
    if (fu > bw - 1.2) i -= 0.5;
    if (hash(b, Math.floor(v / 5), 72) < 0.06 && Math.abs(fu - bw * 0.55) < 0.6) i -= 0.6;
    if (noise2(u * 0.05, v * 0.03, 73) > 0.7 && bayer(x, y) > 0.55) i -= 0.6;
    if ((Math.abs(v - 9) < 0.7 || Math.abs(v - (h - 10)) < 0.7) && Math.abs(fu - bw / 2) < 0.7) return at(r, i - 2);
    return at(r, i);
  };

/** Horizontal weatherboards (clapboard) in sun-faded paint: shadow under each lip, flecks of bare wood. */
export const clap =
  (r: Ramp, bh = 9, wear = 0.5): Mat =>
  (light) => {
    // per-board values are cached: neighbouring pixels share a board
    let lRow = -1e9;
    let off = 0;
    let lSeg = -1e9;
    let tone = 0;
    let lCell = -1e9;
    let cell = 0;
    const b0 = base(light, r.length);
    return (u, v, x, y) => {
      const row = Math.floor(v / bh);
      const fv = v - row * bh;
      if (row !== lRow) {
        lRow = row;
        off = hash(row, 1, 74) * 60;
        lSeg = -1e9;
        lCell = -1e9;
      }
      const seg = Math.floor((u + off) / 70);
      if (seg !== lSeg) {
        lSeg = seg;
        tone = (hash(seg, row, 75) - 0.5) * 0.8;
      }
      let i = b0 + tone;
      if (fv < 1.2) return at(r, i - 2.1);
      if (fv < 2.4) i -= 0.8;
      if (fv > bh - 1.6) i += light === 0 ? 0.4 : 0.9;
      if (u + off - seg * 70 < 1) return at(r, i - 1.4);
      // sun-faded paint: chalky blooms, and bare grey timber where it flaked
      const cu = Math.floor(u / 13);
      if (cu !== lCell) {
        lCell = cu;
        cell = hash(cu, row, 76);
      }
      if (cell > 0.8 && bayer(x, y) > 0.5) i += 0.7;
      if (wear > 0 && cell < wear * 0.06 && fv > 2 && hash(x >> 1, y, 78) < 0.7) return at(DRIFT, light === 0 ? 2 : 4);
      if (hash(x, y, 79) < 0.025) i -= 0.8;
      return at(r, i);
    };
  };

/** Corrugated tin: ridges running up the slope (along v), streaks of rust, screw rows. */
export const corrugated =
  (r: Ramp, rust = 0.25): Mat =>
  (light) => {
    let lKey = -1e9;
    let sTone = 0;
    const b0 = base(light, r.length);
    return (u, v, x, y) => {
    const p = (u % 10) * 0.7;
    const sheet = Math.floor(u / 60);
    const key = sheet * 4096 + Math.floor(v / 60);
    if (key !== lKey) {
      lKey = key;
      sTone = (hash(sheet, Math.floor(v / 60), 80) - 0.5) * 0.5;
    }
    let i = b0 + (p < 2 ? 1.2 : p < 3.5 ? 0.4 : p < 5.5 ? -1.1 : -0.3) + sTone;
    // laps between sheets, screw rows
    if (v % 60 < 1.2) return at(r, i - 1.4);
    if (Math.abs((v % 26) - 13) < 0.7 && p > 1 && p < 3) return at(ALU, 3);
    // rust streaks running down from the laps and screws
    if (rust > 0) {
      const rc = hash(Math.floor(u / 5), Math.floor(v / 30), 81);
      if (rc < rust * 0.22 && hash(x >> 1, y >> 2, 82) < 0.75) return mix(at(r, i - 0.6), RUST[2], 0.45);
    }
    if (hash(x, y, 83) < 0.02) i -= 0.7;
    return at(r, i);
    };
  };

/** Cedar shingles, sun-bleached silver: staggered rows, shadow lips, a few dark ones. */
export const shakes =
  (r: Ramp, rowH = 7, sw = 9): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = (row & 1 ? sw / 2 : 0) + hash(row, 9, 84) * 3;
    const col = Math.floor((u + off) / sw);
    const fu = u + off - col * sw;
    let i = (light === 0 ? 1.6 : light === 2 ? 3.8 : 3) + (hash(col, row, 85) - 0.5) * 1.5;
    if (fv < 1.2 + hash(col, row, 86) * 0.8) return at(r, i - 2);
    if (fu < 1) i -= 1.2;
    if (fv > rowH - 1.6) i += 0.8;
    if (hash(x, y, 87) < 0.04) i -= 0.8;
    return at(r, i);
  };

/** Corduroy: vertical ribs, a soft nap toward the top lip. */
export const corduroy =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.3;
    const p = u % 3;
    if (p < 1) i -= 0.7;
    else if (p < 2) i += 0.3;
    if (v > h - 2.5) i += 1;
    if (v < 2) i -= 0.8;
    if (noise2(u * 0.1, v * 0.2, 88) > 0.7 && bayer(x, y) > 0.5) i -= 0.5;
    return at(r, i);
  };

/** Birch plywood veneer: pale, long soft grain along u. */
export const plyFace =
  (r: Ramp = PLY): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.4;
    if (noise2(u * 0.03 + v * 0.4, v * 0.25, 89) > 0.66) i -= 0.7;
    if (noise2(u * 0.02, v * 0.18, 90) < 0.22) i += 0.5;
    if (hash(x, y, 91) < 0.02) i -= 0.7;
    return at(r, i);
  };

/** Plywood edge: the laminations as thin stripes up the face. */
export const plyEdge =
  (r: Ramp = PLY): Mat =>
  (light) =>
  (_u, v) =>
    at(r, base(light, r.length) + (Math.floor(v) % 2 ? 0.6 : -1.2));

/** Pine boards (furniture, crates): grain along u, knots. */
export const pine =
  (r: Ramp = PINE, along: 'u' | 'v' = 'u'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const a = along === 'u' ? u : v;
    const b = along === 'u' ? v : u;
    let i = base(light, r.length) + 0.2;
    if (noise2(a * 0.05 + b * 0.8, b * 0.4, 92) > 0.64) i -= 0.9;
    if (hash(Math.floor(a / 23), Math.floor(b / 9), 93) < 0.05 && Math.hypot((a % 23) - 11, (b % 9) - 4) < 1.6) i -= 1.6;
    if (hash(x, y, 94) < 0.03) i -= 0.7;
    return at(r, i);
  };

/** Weathered driftwood-grey timber: deep cracks along the grain. */
export const weathered =
  (r: Ramp = DRIFT, along: 'u' | 'v' = 'u'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const a = along === 'u' ? u : v;
    const b = along === 'u' ? v : u;
    let i = base(light, r.length) + 0.2 + (noise2(a * 0.02, b * 0.1, 95) - 0.5) * 0.8;
    if (noise2(a * 0.04 + b * 1.1, b * 0.6, 96) > 0.7) i -= 1.2;
    if (hash(x, y, 97) < 0.04) i -= 0.7;
    return at(r, i);
  };

/** Rattan / wicker: a basket weave of short strokes. */
export const rattan =
  (r: Ramp = BEECH): Mat =>
  (light) =>
  (u, v, x, y) => {
    const cu = Math.floor(u / 4);
    const cv = Math.floor(v / 3);
    const horiz = (cu + cv) & 1;
    const f = horiz ? (u % 4) / 4 : (v % 3) / 3;
    let i = base(light, r.length) + (f < 0.2 || f > 0.8 ? -1 : f < 0.5 ? 0.6 : 0);
    if (hash(x, y, 98) < 0.03) i -= 0.6;
    return at(r, i);
  };

/** Glazed square tiles (zellige): every tile its own tone, a glossy streak, pale grout. */
export const zellige =
  (r: Ramp, s = 6, grout = '#e8dccb'): Mat =>
  (light) =>
  (u, v, x, y) => {
    const cu = Math.floor(u / s);
    const cv = Math.floor(v / s);
    const fu = u - cu * s;
    const fv = v - cv * s;
    if (fu < 1 || fv < 1) return light === 0 ? darken(grout, 0.18) : grout;
    let i = base(light, r.length) + (hash(cu, cv, 99) - 0.5) * 1.8;
    if (Math.abs(fu - fv - 1) < 0.8 && fu > 1.5) i += 1.2;
    if (hash(x, y, 100) < 0.04) i -= 0.6;
    return at(r, i);
  };

/** Speckled terrazzo: chips of colour in a pale ground. */
export const terrazzo =
  (r: Ramp, chips: string[]): Mat =>
  (light) =>
  (u, v, x, y) => {
    const h = hash(Math.floor(u / 2), Math.floor(v / 2), 101);
    if (h < 0.09) return chips[Math.floor(h * 1000) % chips.length];
    let i = base(light, r.length) + 0.3;
    if (hash(x, y, 102) < 0.08) i -= 0.6;
    return at(r, i);
  };

/** Canvas / linen: a fine weave. */
export const linen =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if ((Math.floor(u) + Math.floor(v)) % 2 === 0 && bayer(x, y) > 0.5) i -= 0.4;
    if (hash(x, y, 103) < 0.03) i -= 0.6;
    return at(r, i);
  };

/** Felt / foam: soft speckle. */
export const felt =
  (r: Ramp): Mat =>
  (light) =>
  (_u, _v, x, y) => {
    let i = base(light, r.length) + (hash(x, y, 104) - 0.5) * 0.9;
    if (hash(x >> 1, y >> 1, 105) < 0.1) i -= 0.5;
    return at(r, i);
  };

/** Matte powder coat with a lit lip on top. */
export const coat =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length);
    if (v > h - 1.2) i += 1;
    if (hash(x, y, 106) < 0.015) i -= 0.6;
    return at(r, i);
  };

/** A FaceTex from a material for a given face light (for poly3 / pt). */
export const tex = (m: Mat, light: Light, w = 64, h = 64): FaceTex => m(light, w, h);

/** A uniform face colour (FaceTex) — for small poly3 faces. */
export const solid = (col: string): FaceTex => () => col;

// ── lighting for freely oriented faces ───────────────────────
/** Sun direction in "real" units (1 tile = 16 z): from the upper left of the screen. */
const SUN: [number, number, number] = [-0.36, 0.56, 0.75];
/** Shade index (0 … n−1) of a face with world normal n (real units). */
export function shadeOf(n: [number, number, number], len: number): number {
  const m = Math.hypot(n[0], n[1], n[2]) || 1;
  const d = (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) / m;
  return Math.max(0, Math.min(len - 1, 1.2 + (d + 0.36) * (len - 2.2) / 1.1));
}

type V3 = [number, number, number];
/**
 * A convex solid from prop-local faces: draws only the faces turned toward the
 * camera (view direction (1, 1, 1) in real units), each shaded by the sun.
 * `paint(i, face)` returns a FaceTex for the shade index i, or a colour.
 */
export function solidFaces(p: PropPainter, faces: V3[][], paint: (shade: number, fi: number) => FaceTex | Mat | string, twoSided = faces.length === 1) {
  const toW = (q: V3): V3 => {
    const [x, y] = p.W(q[0], q[1]);
    return [x * 16, y * 16, q[2]];
  };
  // the solid's centre: every face normal is turned to point away from it
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let n0 = 0;
  for (const f of faces)
    for (const q of f) {
      const w = toW(q);
      cx += w[0];
      cy += w[1];
      cz += w[2];
      n0++;
    }
  cx /= n0;
  cy /= n0;
  cz /= n0;
  faces.forEach((f, fi) => {
    const w = f.map(toW);
    // Newell's normal: robust for long, curved outlines (a hull's deck, a disc)
    let n: V3 = [0, 0, 0];
    for (let i = 0; i < w.length; i++) {
      const a = w[i];
      const b = w[(i + 1) % w.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (const q of w) {
      fx += q[0] / w.length;
      fy += q[1] / w.length;
      fz += q[2] / w.length;
    }
    if (n[0] * (fx - cx) + n[1] * (fy - cy) + n[2] * (fz - cz) < 0) n = [-n[0], -n[1], -n[2]];
    // a lone panel (a canvas, a screen, a disc) shows whichever side faces us
    if (twoSided && n[0] + n[1] + n[2] < 0) n = [-n[0], -n[1], -n[2]];
    if (n[0] + n[1] + n[2] <= 0.0001) return;
    const s = paint(shadeOf(n, 7), fi);
    poly3(p, f, typeof s === 'string' ? solid(s) : s, 1);
  });
}

/** A modulo that stays positive for negative world coordinates. */
export const pmod = (a: number, n: number) => ((Math.round(a) % n) + n) % n;

/** Mix helper re-exported for the pack. */
export { mix, darken, lighten };

// ─────────────────────────────────────────────────────────────
// HD art kit (64×32 tiles) — see docs/FARM_ART_BIBLE.md.
//
// • Ramps: 5–6 tones per material, hue-shifted (shadows → purple,
//   lights → warm yellow).
// • texQuad: per-pixel textured parallelogram in prop space. The iso
//   projection is affine, so any planar face (walls, roofs, tops) maps to
//   a screen parallelogram and can be textured in its own (u, v) pixels.
// • Materials: planks, siding, plaster, stone blocks, shingles, glass.
// • canopy: foliage from dozens of shaded leaf clusters (sun upper-left).
// • Selective outline: dark warm brown mixed with the enclosed colour.
// ─────────────────────────────────────────────────────────────

import { darken, lighten, mix } from '../color';
import { line, type C, type PropPainter, type V2 } from '../iso';

export type Ramp = readonly string[];
export const OUTL = '#3b2a26';
export const SHADOW = '#2a1a2a';

/** Material ramps (dark → light). */
export const RAMP = {
  leaf: ['#1f4a2c', '#2a6233', '#3a7d38', '#4f9840', '#6db24a', '#93c95a'],
  leafWarm: ['#2a4a26', '#3a6430', '#527f36', '#6d9a3e', '#8db44c', '#b2cd62'],
  leafDeep: ['#183b2a', '#20503a', '#2b6640', '#3a7d47', '#529652', '#72ae5e'],
  wood: ['#3e2619', '#5c3a24', '#7b5131', '#9a6a40', '#b98654', '#d4a46c'],
  woodPale: ['#5a4030', '#7a5a40', '#9a7652', '#b89366', '#d2ae80', '#e6c89a'],
  plaster: ['#7d6a5c', '#a68f78', '#c8b394', '#e0cfae', '#f0e4c6', '#faf2dc'],
  roof: ['#1a3634', '#214a45', '#2a6055', '#357863', '#4a9274', '#69ad8a'],
  barn: ['#3e1a1e', '#5e2425', '#82322c', '#a44434', '#c25c40', '#d97c55'],
  stone: ['#3f3b40', '#5a5458', '#767071', '#938b88', '#b0a79f', '#cbc2b6'],
  stoneWarm: ['#4a3d38', '#665449', '#83705e', '#a08b74', '#bba68b', '#d5c2a4'],
  brick: ['#4a2420', '#6a3227', '#8c4430', '#ad5a3c', '#c8764e'],
  terracotta: ['#5e3122', '#80432c', '#a35a38', '#c07448', '#d6915e', '#e6ad7a'],
  glass: ['#2e5560', '#3f7580', '#5f9ca2', '#8cc4c0', '#c2e6dc'],
  metal: ['#3b3f4c', '#565c6c', '#7c8494', '#a7aeba', '#d2d6dd'],
  iron: ['#24222a', '#363440', '#4b4856', '#66636f'],
  soil: ['#2e1c14', '#432a1d', '#5a3a27', '#704a32', '#87603f'],
  hay: ['#7a5420', '#a0742c', '#c4983c', '#dfba58', '#f0d67e', '#f8eaa8'],
  cream: ['#8e7f6e', '#b8a58c', '#d8c7a8', '#ece0c4', '#f8f1de'],
  water: ['#1d4f7a', '#24648f', '#2f7aa4', '#3d92b8', '#5aaccc', '#86c8de'],
  canvas: ['#7a6a58', '#a39078', '#c8b69a', '#e2d3b8', '#f3e9d4'],
  teal: ['#1f4a4c', '#2a6362', '#367c78', '#4a9890', '#6cb4a8'],
  blue: ['#273a63', '#33508a', '#4467ab', '#5a82c4', '#7ea2da'],
  red: ['#5a1a20', '#80262a', '#a63632', '#c84e3e', '#e0705a'],
  yellow: ['#8a5a14', '#b3801e', '#d6a630', '#ecc750', '#f7e284'],
  pink: ['#6e2a48', '#984060', '#c25c80', '#e07ea0', '#f2a8c2'],
} satisfies Record<string, readonly string[]>;

export const pick = (r: Ramp, i: number) => r[i < 0 ? 0 : i >= r.length ? r.length - 1 : Math.floor(i)];

// ── deterministic noise ─────────────────────────────────────
export function hh(a: number, b: number, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (px: number, py: number) => BAYER[((py & 3) << 2) | (px & 3)];

// ── pixel primitives ────────────────────────────────────────
export function px(c: C, x: number, y: number, col: string, w = 1, h = 1) {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Filled ellipse, crisp. */
export function ellipse(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  const r = Math.max(0.5, ry);
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    const t = 1 - ((dy + 0.5 * Math.sign(dy)) * (dy + 0.5 * Math.sign(dy))) / (r * r + 0.25);
    if (t < 0) continue;
    const w = rx * Math.sqrt(t);
    const x0 = Math.round(cx - w);
    const x1 = Math.round(cx + w);
    if (x1 > x0) c.fillRect(x0, Math.round(cy + dy), x1 - x0, 1);
  }
}

/** Soft cast shadow on the ground, dithered in two density steps. */
export function groundShadow(c: C, cx: number, cy: number, rx: number, ry: number, alpha = 0.3) {
  c.globalAlpha = alpha * 0.6;
  ellipse(c, cx, cy, rx, ry, SHADOW);
  c.globalAlpha = alpha * 0.55;
  ellipse(c, cx - rx * 0.08, cy - ry * 0.05, rx * 0.72, ry * 0.7, SHADOW);
  c.globalAlpha = 1;
}

// ── textured faces ──────────────────────────────────────────
export type V3 = [number, number, number];
/** Texture: (u, v) in face pixels from the face origin, (px, py) screen pixel. Return null to skip. */
export type FaceTex = (u: number, v: number, px: number, py: number) => string | null;

/**
 * Fill the parallelogram O, O+U, O+U+V, O+V (prop-local a, b, z) with a texture.
 * u runs 0..|U| and v 0..|V| in screen pixels along each edge.
 */
export function texQuad(p: PropPainter, O: V3, U: V3, V: V3, tex: FaceTex) {
  const o = p.P(O[0], O[1], O[2]);
  const pu = p.P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
  const pv = p.P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
  texPara(p.c, o, [pu[0] - o[0], pu[1] - o[1]], [pv[0] - o[0], pv[1] - o[1]], tex);
}

/**
 * Screen-space textured parallelogram. Along each pixel row u and v are linear
 * in x, so only the span where both can lie in [0, 1) is visited (widened by a
 * pixel; the exact per-pixel test decides). Long iso faces cover a small part
 * of their bounding box, so this skips most of the work without changing a pixel.
 */
export function texPara(c: C, o: V2, U: V2, V: V2, tex: FaceTex) {
  const det = U[0] * V[1] - U[1] * V[0];
  if (Math.abs(det) < 1e-6) return;
  const lu = Math.hypot(U[0], U[1]);
  const lv = Math.hypot(V[0], V[1]);
  const xs = [o[0], o[0] + U[0], o[0] + V[0], o[0] + U[0] + V[0]];
  const ys = [o[1], o[1] + U[1], o[1] + V[1], o[1] + U[1] + V[1]];
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const cu = V[1] / det;
  const cv = -U[1] / det;
  const hx = 0.5 - o[0];
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - o[1];
    let lo = x0;
    let hi = x1 - 1;
    const ku = (hx * V[1] - dy * V[0]) / det;
    if (cu !== 0) {
      const a = -ku / cu;
      const b = (1 - ku) / cu;
      lo = Math.max(lo, Math.floor(Math.min(a, b)) - 1);
      hi = Math.min(hi, Math.ceil(Math.max(a, b)) + 1);
    } else if (ku < 0 || ku >= 1) continue;
    const kv = (U[0] * dy - U[1] * hx) / det;
    if (cv !== 0) {
      const a = -kv / cv;
      const b = (1 - kv) / cv;
      lo = Math.max(lo, Math.floor(Math.min(a, b)) - 1);
      hi = Math.min(hi, Math.ceil(Math.max(a, b)) + 1);
    } else if (kv < 0 || kv >= 1) continue;
    if (hi < lo) continue;
    let runCol: string | null = null;
    let runX = lo;
    for (let x = lo; x <= hi; x++) {
      const dx = x + 0.5 - o[0];
      const u = (dx * V[1] - dy * V[0]) / det;
      const v = (U[0] * dy - U[1] * dx) / det;
      const col = u >= 0 && u < 1 && v >= 0 && v < 1 ? tex(u * lu, v * lv, x, y) : null;
      if (col !== runCol) {
        if (runCol) {
          c.fillStyle = runCol;
          c.fillRect(runX, y, x - runX, 1);
        }
        runCol = col;
        runX = x;
      }
    }
    if (runCol) {
      c.fillStyle = runCol;
      c.fillRect(runX, y, hi + 1 - runX, 1);
    }
  }
}

// ── materials ───────────────────────────────────────────────
/** Light level of a face: 0 shaded (screen right), 1 lit (screen left), 2 top. */
export type Light = 0 | 1 | 2;
export type Mat = (light: Light, w: number, h: number) => FaceTex;

const baseIdx = (light: Light, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/** Flat material with bottom ambient occlusion and a lit top edge. */
export const solid =
  (r: Ramp, grit = 0.04): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = baseIdx(light, r.length);
    if (light !== 2 && v < 3 && bayer(x, y) > v / 3) i--;
    if (light !== 2 && v > h - 1.5) i++;
    const n = hh(x, y, 3);
    if (n < grit) i--;
    else if (n > 1 - grit * 0.5) i++;
    return pick(r, i);
  };

/** Vertical boards (barn, shed, fence boards). */
export const boards =
  (r: Ramp, bw = 6): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const b = Math.floor(u / bw);
    const fu = u - b * bw;
    let i = baseIdx(light, r.length) + (hh(b, 0, 11) > 0.6 ? 0.5 : hh(b, 0, 11) < 0.25 ? -0.6 : 0);
    if (fu < 1) return pick(r, i - 2);
    if (fu < 2 && light === 1) i += 0.8;
    if (hh(b, Math.floor(v / 3), 12) < 0.12 && Math.floor(fu) === 3) i -= 1; // grain fleck
    if (hh(b, Math.floor(v), 13) < 0.03) i -= 1;
    if (v < 3 && bayer(x, y) > v / 3) i -= 1;
    if (v > h - 1.5) i += 1;
    return pick(r, i);
  };

/** Horizontal siding / planks (deck, crates, beds). */
export const siding =
  (r: Ramp, bh = 4): Mat =>
  (light, w, h) =>
  (u, v, _x, _y) => {
    const row = Math.floor(v / bh);
    const fv = v - row * bh;
    const seg = Math.floor((u + hh(row, 1, 14) * 20) / 22);
    let i = baseIdx(light, r.length) + (hh(seg, row, 15) - 0.5) * 1.1;
    if (fv < 1) return pick(r, i - 2);
    if (fv >= bh - 1 && light !== 0) i += 0.7;
    const su = u + hh(row, 1, 14) * 20 - seg * 22;
    if (su < 1) return pick(r, i - 1.6);
    if (hh(Math.floor(u / 2), row, 16) < 0.06) i -= 0.8;
    if (light !== 2 && v < 2) i -= 1;
    return pick(r, i);
    void w;
    void h;
  };

/** Plaster / stucco with speckle and a darker plinth. */
export const plaster =
  (r: Ramp): Mat =>
  (light) =>
  (_u, v, x, y) => {
    let i = baseIdx(light, r.length);
    const n = hh(x, y, 21);
    if (n < 0.05) i -= 1;
    else if (n > 0.97) i += 1;
    if (v < 4 && bayer(x, y) * 4 > v) i -= 1;
    return pick(r, i);
  };

/** Irregular stone blocks with grout, bevel and moss. */
export const stones =
  (r: Ramp, rowH = 6, moss = 0.25): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = hh(row, 2, 31) * 12;
    const bwid = 8 + Math.floor(hh(row, 3, 32) * 6);
    const col = Math.floor((u + off) / bwid);
    const fu = u + off - col * bwid;
    const tone = (hh(col, row, 33) - 0.5) * 1.6;
    if (fv < 1 || fu < 1) {
      if (moss > 0 && row === 0 && hh(col, 7, 34) < moss) return pick(RAMP.leafWarm, light === 0 ? 1 : 2);
      return pick(r, 0);
    }
    let i = baseIdx(light, r.length) + tone;
    if (fv >= rowH - 1.5) i += 0.8; // lit top bevel of each block
    if (fu < 2) i -= 0.6;
    if (hh(x, y, 35) < 0.06) i -= 1;
    if (moss > 0 && fv < 2.5 && hh(col, row, 36) < moss * 0.5) return pick(RAMP.leafWarm, (light === 0 ? 1 : 2) + (hh(x, y, 37) > 0.5 ? 1 : 0));
    return pick(r, i);
  };

/** Roof shingles (rows along u; v runs up the slope). */
export const shingles =
  (r: Ramp, rowH = 5, sw = 7): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / rowH);
    const fv = v - row * rowH;
    const off = row & 1 ? sw / 2 : 0;
    const col = Math.floor((u + off) / sw);
    const fu = u + off - col * sw;
    let i = (light === 0 ? 1.4 : 3) + (hh(col, row, 41) - 0.5) * 1.2;
    if (fv < 1.2) return pick(r, i - 1.6); // shadow line under the row above
    if (fu < 1) i -= 1;
    if (fv > rowH - 1.6) i += 1; // lit lower lip
    if (hh(x, y, 42) < 0.04) i -= 1;
    return pick(r, i);
  };

/** Glass panes with tint, two diagonal reflections and a darker lower edge. */
export const glass =
  (r: Ramp = RAMP.glass): Mat =>
  (light, w, h) =>
  (u, v) => {
    const d = (u * 0.9 + v) % 22;
    let i = light === 0 ? 1 : 2;
    if (d > 3 && d < 5.5) i += 2;
    else if (d > 7 && d < 8) i += 1;
    if (v < 2) i -= 1;
    void w;
    void h;
    return pick(r, i);
  };

// ── boxes ───────────────────────────────────────────────────
export interface BoxMats {
  top?: Mat;
  left?: Mat;
  right?: Mat;
  /** outline colour bias (darkest tone of the main material) */
  edge?: string;
  outline?: boolean;
}

/**
 * Textured box in prop space. Faces are chosen by WORLD facing, so lighting
 * stays correct for rotated props: world +y face (screen left) is lit,
 * world +x face (screen right) is shaded, top brightest.
 */
export function tbox(p: PropPainter, a0: number, b0: number, aw: number, bd: number, z0: number, h: number, m: BoxMats) {
  const [xa, ya] = p.W(a0, b0);
  const [xb, yb] = p.W(a0 + aw, b0 + bd);
  const x0 = Math.min(xa, xb);
  const y0 = Math.min(ya, yb);
  const w = Math.abs(xb - xa);
  const d = Math.abs(yb - ya);
  wbox(p, x0, y0, w, d, z0, h, m);
}

/** Textured box in world space (x, y relative to the prop's world origin handled by p.w). */
export function wbox(p: PropPainter, x0: number, y0: number, w: number, d: number, z0: number, h: number, m: BoxMats) {
  const W = p.w;
  const k = W.k;
  const P = (x: number, y: number, z: number) => W.P(x, y, z);
  const face = (O: V3, U: V3, V: V3, mat: Mat | undefined, light: Light) => {
    if (!mat) return;
    const o = P(...O);
    const pu = P(O[0] + U[0], O[1] + U[1], O[2] + U[2]);
    const pv = P(O[0] + V[0], O[1] + V[1], O[2] + V[2]);
    const Us: V2 = [pu[0] - o[0], pu[1] - o[1]];
    const Vs: V2 = [pv[0] - o[0], pv[1] - o[1]];
    texPara(W.c, o, Us, Vs, mat(light, Math.hypot(...Us), Math.hypot(...Vs)));
  };
  const x1 = x0 + w;
  const y1 = y0 + d;
  const z1 = z0 + h;
  if (h > 0) {
    face([x0, y1, z0], [w, 0, 0], [0, 0, h], m.left, 1);
    face([x1, y1, z0], [0, -d, 0], [0, 0, h], m.right, 0);
  }
  face([x0, y1, z1], [w, 0, 0], [0, -d, 0], m.top, 2);
  if (m.outline === false) return;
  const edge = m.edge ?? '#4a3428';
  const hull: V2[] = h > 0 ? [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)] : [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  const top = mix(edge, OUTL, 0.4);
  const low = mix(darken(edge, 0.3), OUTL, 0.7);
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i];
    const [bx, by] = hull[(i + 1) % hull.length];
    // edges on the right/lower side sit 1px inside the face (avoids double-thick outlines)
    line(W.c, ax - (i >= 2 ? 0 : 0), ay, bx, by, i < 2 ? top : low);
  }
  void k;
}

// ── foliage ─────────────────────────────────────────────────
export interface CanopyOpts {
  ramp?: Ramp;
  /** fruit or blossom colours, scattered on lit clusters */
  dots?: string[];
  dotChance?: number;
  /** cluster radius range (px) */
  rmin?: number;
  rmax?: number;
  density?: number;
  /** flatten the bottom (bushes sitting on the ground) */
  flatBottom?: boolean;
  outline?: boolean;
}

/**
 * A mass of leaves: dozens of small clusters, each shaded by its position
 * toward the sun (upper left), drawn back to front, with a selective
 * dark-green outline around the whole silhouette, crescent shadows under
 * each cluster and bright tips on the lit side.
 */
export function canopy(c: C, cx: number, cy: number, rx: number, ry: number, seed: number, o: CanopyOpts = {}) {
  const ramp = o.ramp ?? RAMP.leaf;
  const R = rng(seed);
  const rmin = o.rmin ?? 3;
  const rmax = o.rmax ?? 5.5;
  const n = Math.round(((rx * ry) / 9) * (o.density ?? 1)) + 4;
  const pts: { x: number; y: number; r: number; l: number }[] = [];
  for (let i = 0; i < n * 3 && pts.length < n; i++) {
    const a = R() * 2 - 1;
    const b = R() * 2 - 1;
    if (a * a + b * b > 1) continue;
    if (o.flatBottom && b > 0.75) continue;
    const r = rmin + R() * (rmax - rmin);
    // sun from the upper left; clusters near the rim on the shaded side get darker
    const l = 0.58 - a * 0.32 - b * 0.42 + (R() - 0.5) * 0.28;
    pts.push({ x: cx + a * (rx - r * 0.6), y: cy + b * (ry - r * 0.6), r, l });
  }
  pts.sort((p1, p2) => p1.y - p2.y);
  const N = ramp.length;
  const edge = mix(ramp[0], OUTL, 0.5);
  if (o.outline !== false) for (const p of pts) ellipse(c, p.x, p.y, p.r + 1, (p.r + 1) * 0.9, edge);
  for (const p of pts) {
    const li = Math.max(1, Math.min(N - 2, Math.round(p.l * (N - 1))));
    ellipse(c, p.x, p.y, p.r, p.r * 0.9, ramp[li - 1]);
    ellipse(c, p.x - 0.6, p.y - 1, p.r - 0.8, (p.r - 0.8) * 0.85, ramp[li]);
    if (p.l > 0.5) ellipse(c, p.x - p.r * 0.35, p.y - p.r * 0.45, p.r * 0.42, p.r * 0.32, ramp[Math.min(N - 1, li + 1)]);
  }
  // leaf tips: tiny protrusions along the lit rim
  for (const p of pts) {
    if (R() > 0.5) continue;
    const ang = Math.PI * (1.0 + R() * 0.9);
    const ex = p.x + Math.cos(ang) * (p.r + 0.5);
    const ey = p.y + Math.sin(ang) * (p.r + 0.5) * 0.9;
    px(c, ex, ey, ramp[Math.min(N - 1, Math.round(p.l * (N - 1)) + 1)]);
  }
  if (o.dots?.length) {
    const chance = o.dotChance ?? 0.35;
    for (const p of pts) {
      if (R() > chance) continue;
      const col = o.dots[Math.floor(R() * o.dots.length)];
      const fx = p.x + (R() - 0.5) * p.r;
      const fy = p.y + (R() - 0.4) * p.r * 0.8;
      px(c, fx, fy, darken(col, 0.35), 2, 2);
      px(c, fx, fy, col, 2, 1);
      px(c, fx, fy, lighten(col, 0.45));
    }
  }
}

/** Little flower heads (plus-shaped petals with a centre) scattered in an ellipse. */
export function flowers(c: C, cx: number, cy: number, rx: number, ry: number, cols: string[], n: number, seed: number) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = R() * 2 - 1;
    const b = R() * 2 - 1;
    if (a * a + b * b > 1) continue;
    const x = Math.round(cx + a * rx);
    const y = Math.round(cy + b * ry);
    const col = cols[Math.floor(R() * cols.length)];
    const big = R() > 0.55;
    if (big) {
      px(c, x - 1, y, darken(col, 0.25), 3, 1);
      px(c, x, y - 1, col, 1, 3);
      px(c, x - 1, y - 1, col);
      px(c, x, y, R() > 0.5 ? '#f6d860' : lighten(col, 0.5));
    } else {
      px(c, x, y, col, 2, 1);
      px(c, x, y - 1, lighten(col, 0.3));
    }
  }
}

/** Grass tuft: blades with dark roots and bright tips. */
export function tuft(c: C, x: number, y: number, ramp: Ramp, seed: number, size = 1) {
  const R = rng(seed);
  const n = 4 + Math.floor(R() * 3 * size);
  for (let i = 0; i < n; i++) {
    const bx = Math.round(x + (R() - 0.5) * 7 * size);
    const h = Math.round((3 + R() * 4) * size);
    const lean = R() > 0.5 ? 1 : -1;
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const col = t < 0.3 ? ramp[1] : t < 0.7 ? ramp[2 + (i & 1)] : ramp[4];
      px(c, bx + (j > h * 0.6 ? lean : 0), y - j, col);
    }
  }
}

/** Selective outline of everything drawn in a canvas region (1px, darker below). */
export function outlineCanvas(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!;
  const { width: W, height: H } = cv;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const o = [0x3b, 0x2a, 0x26];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : (y * W + x) * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 0) continue;
      let src = -1;
      let k = 0;
      for (const [dx, dy, kk] of [[0, -1, 0.72], [-1, 0, 0.62], [1, 0, 0.62], [0, 1, 0.5]] as const) {
        const j = at(x + dx, y + dy);
        if (j >= 0 && d[j + 3] > 200) {
          src = j;
          k = kk;
          break;
        }
      }
      if (src < 0) continue;
      out[i] = d[src] + (o[0] - d[src]) * k;
      out[i + 1] = d[src + 1] + (o[1] - d[src + 1]) * k;
      out[i + 2] = d[src + 2] + (o[2] - d[src + 2]) * k;
      out[i + 3] = 255;
    }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

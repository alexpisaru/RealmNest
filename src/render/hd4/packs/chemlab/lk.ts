// Chemical Lab — the pack's own palette and small drawing helpers (lab kit).
// Primitives only (cylinders, glassware, labels, safety pictograms); every
// design that uses them lives in this pack. 1 z ≈ 10 cm, a person ≈ 17.5 z.
import { darken, lighten, mix } from '../../../color';
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { at, bayer, type C, ell, fillPoly, hash, ln, noise2, OUTL, px, type Ramp } from '../../kit4';
import { type Plane, pt } from '../../plane4';

// ── palette ─────────────────────────────────────────────────
// Re-toned (0.6.x) to the owner's retouched picture (docs/worlds-bake/ritocchi/chemlab.webp):
// see the sampled hex codes at the top of index.ts.
/** powder-coated lab white (cool, a hint of mint) */
export const LW: Ramp = ['#7f8f8d', '#9eadab', '#bccac7', '#d5e0dd', '#e7eeec', '#f5f9f8'];
/** teal accent (epoxy, handles, stripes) */
export const TEAL: Ramp = ['#173f3c', '#1f5551', '#286d66', '#33877d', '#45a394', '#6cc0b0', '#a2dccf'];
/** stainless steel */
export const STEEL: Ramp = ['#454b53', '#5e656e', '#7a828b', '#979fa8', '#b5bcc4', '#d4dadf', '#eff2f4'];
/** black epoxy-resin worktops */
export const RESIN: Ramp = ['#17191d', '#202328', '#2a2e34', '#363b42', '#444a52', '#575e67'];
/** anthracite aluminium (frames, mullions) */
export const ANTH: Ramp = ['#1e2226', '#2a2f34', '#363c42', '#444b52', '#555d65', '#6a737b'];
/** safety yellow */
export const YEL: Ramp = ['#6a470c', '#93660f', '#bd8a16', '#dfae26', '#f2c63e', '#fadf78'];
/** signal red */
export const RED: Ramp = ['#4e1214', '#721a1c', '#982424', '#be3530', '#d9503f', '#ec7a62'];
/** sign green */
export const GRN: Ramp = ['#0e3a22', '#14502e', '#1b693c', '#22844b', '#36a062', '#62bf84'];
/** sign blue */
export const BLU: Ramp = ['#0f2a5a', '#173c7a', '#20509c', '#2c66bc', '#4583d4', '#74a6e6'];
/** warm white precast concrete (buildings) */
export const CONC: Ramp = ['#8a8f8b', '#a8aea9', '#c4cac5', '#d8ddd8', '#e7ebe6', '#f2f5f0', '#fbfcf9'];
/** dark grey concrete (plinths, kerbs) */
export const DCONC: Ramp = ['#3e3d3c', '#52504e', '#666461', '#7b7875', '#918d89', '#a6a29d'];
/** curtain-wall glass (reflective, blue-green) */
export const CGLASS: Ramp = ['#1c3a48', '#24495a', '#2e5a6c', '#356778', '#447a8a', '#508897', '#86b4bc', '#d0e6e4'];
/** larch timber, fresh */
export const LARCH: Ramp = ['#5a3416', '#7a4a20', '#8f5c2a', '#a8743c', '#c88e52', '#d8a56e', '#e8c486'];
/** larch timber, silvered (boardwalk, benches) */
export const SILVER: Ramp = ['#45403b', '#5d5750', '#776f66', '#91887d', '#aaa093', '#c2b9ab', '#d8d0c3'];
/** corten steel */
export const CORTEN: Ramp = ['#3e1e12', '#5a2a18', '#78381e', '#954a26', '#b05e30', '#c6763f', '#d8925a'];
/** galvanised steel */
export const GALV: Ramp = ['#5a5f62', '#72787b', '#8b9195', '#a5abae', '#bec3c5', '#d6dadb'];
/** sedum on the green roofs */
export const SEDUM: Ramp = ['#2e4210', '#3e5612', '#526813', '#69841b', '#7e9a28', '#96b23a'];
export const SEDUMRED: Ramp = ['#5a2a24', '#76382c', '#934a36', '#ac6044', '#c27a52'];
/** birch / meadow greens */
export const LEAF: Ramp = ['#244113', '#2f5418', '#3f6a1c', '#557d24', '#68922c', '#7ea93a', '#95c048', '#b4d870'];
export const PINE: Ramp = ['#082b23', '#11392b', '#1c4a33', '#285a37', '#2d6a40', '#3f7c3e', '#5a9040', '#76a850'];
/** pond water */
export const POND: Ramp = ['#0a3440', '#0d4453', '#10505f', '#165b6a', '#1c6874', '#2a7a82', '#4a9898', '#7cc0bc'];

/** Liquids in the glassware. */
export const LIQ = {
  blue: '#2f6fd0',
  cyan: '#2ab0c8',
  orange: '#ef8a2a',
  amber: '#c8781e',
  green: '#3fb860',
  lime: '#a6d23a',
  purple: '#8e46c8',
  pink: '#ea5aa2',
  red: '#d23a30',
  yellow: '#f2d23a',
  clear: '#cfe9ef',
};
export const LIQS = [LIQ.blue, LIQ.orange, LIQ.green, LIQ.purple, LIQ.pink, LIQ.cyan, LIQ.yellow, LIQ.red, LIQ.lime, LIQ.amber];

/** Ramp around a colour (shadows lean purple, lights warm). */
export const rampAround = (col: string): Ramp => [darken(col, 0.55), darken(col, 0.38), darken(col, 0.2), col, lighten(col, 0.18), lighten(col, 0.36)];

// ── materials (textured faces) ──────────────────────────────
const base = (light: number, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

/** Powder coat: smooth, a lit top lip, a faint dark foot, rare specks. */
export const coat =
  (r: Ramp, lip = true): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length) + 0.3;
    if (lip && v > h - 1.2) i += 1;
    if (v < 1.2 && light !== 2) i -= 1;
    if (hash(x, y, 101) < 0.012) i -= 1;
    return at(r, i);
  };

/** Brushed stainless: fine horizontal streaks, one soft highlight band, no noise blobs. */
export const steelMat =
  (r: Ramp = STEEL, band = 0.68): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.2;
    const t = v / Math.max(1, h);
    if (Math.abs(t - band) < 0.1) i += 1.1;
    else if (Math.abs(t - band) < 0.17 && bayer(x, y) > 0.5) i += 0.6;
    if (hash(Math.floor(u / 9), Math.floor(v), 102) < 0.12) i -= 0.6;
    if (light !== 2 && v < 1) i -= 1;
    return at(r, i);
  };

/** Epoxy resin worktop: deep charcoal with a sheen streak and pin-holes. */
export const resinMat: Mat = (light) => (u, v, x, y) => {
  let i = light === 2 ? 2.4 : light === 1 ? 2 : 1;
  if (light === 2 && (u * 0.6 - v) % 46 < 3) i += 1.2;
  if (hash(x, y, 103) < 0.02) i += 1;
  return at(RESIN, i);
};

/** Clear lab glass over a darker interior: tint, diagonal reflections. */
export const glassMat =
  (r: Ramp = CGLASS): Mat =>
  (light, w) =>
  (u, v, x, y) => {
    const d = (u * 0.8 + v) % 40;
    let i = light === 0 ? 2.2 : 3;
    if (d > 4 && d < 9) i += 2.4;
    else if (d > 13 && d < 15) i += 1.4;
    if (v < 3 && (u < 5 || u > w - 5)) i -= 1;
    if (hash(x, y, 104) < 0.02) i += 1;
    return at(r, i);
  };

/** Precast white concrete: fine aggregate speckle, soft blotches, a weathering streak now and then. */
export const concMat =
  (r: Ramp = CONC, joint = 0): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length) + 0.2;
    const s = hash(x, y, 105);
    if (s < 0.06) i -= 1;
    else if (s > 0.97) i += 1;
    if (noise2(u * 0.04, v * 0.05, 106) > 0.66 && bayer(x, y) > 0.55) i -= 0.7;
    if (joint && u % joint < 1.1) i -= 1.6;
    // a rain streak below a sill
    const cx = Math.floor(u / 31);
    if (hash(cx, 9, 107) < 0.12 && Math.abs(u - cx * 31 - 15) < 1.2 && v < h * 0.9 && bayer(x, y) > 0.4) i -= 0.6;
    return at(r, i);
  };

/** Vertical larch boards (cladding, soffits). */
export const larchMat =
  (r: Ramp = LARCH, bw = 7): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const b = Math.floor(u / bw);
    const fu = u - b * bw;
    let i = base(light, r.length) + (hash(b, 0, 108) - 0.5) * 1.4;
    if (fu < 1) return at(r, i - 2);
    if (noise2(fu * 0.6 + b * 5, v * 0.07, 109) > 0.64) i -= 0.8;
    if (hash(x, y, 110) < 0.03) i -= 0.8;
    if (v < 2) i -= 0.8;
    void h;
    return at(r, i);
  };

// ── geometry helpers ────────────────────────────────────────
/** Screen point of prop-local (a, b, z), rounded. */
export const P = (p: PropPainter, a: number, b: number, z = 0): [number, number] => {
  const [x, y] = p.P(a, b, z);
  return [Math.round(x), Math.round(y)];
};

// ── screen-space shapes ─────────────────────────────────────
/**
 * An upright cylinder (drum, tank, column, bottle body): (cx, cy) is the centre
 * of its base ellipse, rx its screen radius, h its height in px. Lit from the
 * left, a specular stripe, ribs at the given heights, a lit top ellipse.
 */
export function cyl(c: C, cx: number, cy: number, rx: number, h: number, r: Ramp, o: { ry?: number; ribs?: number[]; top?: string | null; spec?: boolean; rim?: string } = {}) {
  const ry = o.ry ?? rx * 0.5;
  const n = r.length;
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  for (let x = x0; x < x1; x++) {
    const u = (x + 0.5 - cx) / rx;
    if (u <= -1 || u >= 1) continue;
    const e = Math.sqrt(1 - u * u);
    // light from the upper left: brightest a third of the way in from the left edge
    let t = 0.62 - u * 0.42 - Math.abs(u + 0.38) * 0.28;
    if (o.spec !== false && u > -0.62 && u < -0.42) t += 0.22;
    if (u > 0.8) t -= 0.12;
    const yb = cy + e * ry;
    const yt = cy - h + e * ry;
    for (let y = Math.floor(yt); y < Math.ceil(yb); y++) {
      let tt = t;
      if (o.ribs)
        for (const rh of o.ribs) {
          const ry2 = cy - rh + e * ry;
          if (Math.abs(y + 0.5 - ry2) < 1) tt += y + 0.5 < ry2 ? 0.18 : -0.2;
        }
      const tone = Math.max(0, Math.min(n - 1, Math.round(tt * (n - 1) + (bayer(x, y) - 0.5) * 0.6)));
      c.fillStyle = r[tone];
      c.fillRect(x, y, 1, 1);
    }
  }
  if (o.top !== null) {
    ell(c, cx, cy - h, rx, ry, o.top ?? r[n - 2]);
    if (o.rim) ell(c, cx - rx * 0.12, cy - h - ry * 0.1, rx * 0.78, ry * 0.7, o.rim);
  }
}

// ── glassware (screen space, ≈1.5× real size for readability) ──
const GL = '#e6f4f6';
const GLD = '#9fc3cb';

/** Erlenmeyer flask: conical body, narrow neck, liquid to `fill` (0..1). */
export function erlen(c: C, x: number, y: number, s: number, liq: string, fill = 0.45) {
  const h = Math.round(s);
  const bw = Math.round(s * 0.46);
  const nw = Math.max(1, Math.round(s * 0.12));
  const neck = Math.round(h * 0.34);
  // outline glass
  fillPoly(c, [[x - bw - 1, y + 1], [x + bw + 1, y + 1], [x + nw + 1, y - h + neck], [x + nw + 1, y - h], [x - nw - 1, y - h], [x - nw - 1, y - h + neck]], GLD);
  fillPoly(c, [[x - bw, y], [x + bw, y], [x + nw, y - h + neck], [x + nw, y - h + 1], [x - nw, y - h + 1], [x - nw, y - h + neck]], GL);
  // liquid
  const lh = Math.round((h - neck) * fill);
  const lw = bw - ((bw - nw) * lh) / (h - neck);
  fillPoly(c, [[x - bw + 1, y], [x + bw - 1, y], [x + lw - 1, y - lh], [x - lw + 1, y - lh]], liq);
  px(c, x - lw + 1, y - lh, lighten(liq, 0.4), Math.max(1, Math.round(lw * 2 - 2)), 1);
  px(c, x + bw - 3, y - 2, darken(liq, 0.25), 2, 2);
  // glint and rim
  px(c, x - bw + 2, y - lh - 2, '#ffffff', 1, Math.max(1, Math.round(h * 0.25)));
  px(c, x - nw - 1, y - h - 1, GLD, nw * 2 + 2, 1);
}

/** Beaker: straight walls, a pouring lip, graduations, liquid to `fill`. */
export function beaker(c: C, x: number, y: number, w: number, h: number, liq: string, fill = 0.55) {
  px(c, x - w - 1, y - h - 1, GLD, w * 2 + 2, h + 2);
  px(c, x - w, y - h, GL, w * 2, h);
  const lh = Math.round(h * fill);
  px(c, x - w + 1, y - lh, liq, w * 2 - 2, lh);
  px(c, x - w + 1, y - lh, lighten(liq, 0.4), w * 2 - 2, 1);
  px(c, x + w - 2, y - lh + 1, darken(liq, 0.22), 1, lh - 1);
  for (let i = 2; i < h - 2; i += 3) px(c, x - w + 1, y - i, GLD, 2, 1);
  px(c, x - w + 1, y - h + 1, '#ffffff', 1, Math.max(1, h - lh - 2));
  px(c, x - w - 2, y - h - 1, GLD, 2, 1);
}

/** Round-bottom flask with a long neck. */
export function rbFlask(c: C, x: number, y: number, r: number, liq: string, neck = 8) {
  px(c, x - 2, y - r * 2 - neck, GLD, 4, neck + 2);
  px(c, x - 1, y - r * 2 - neck, GL, 2, neck + 2);
  ell(c, x, y - r, r + 1, r + 1, GLD);
  ell(c, x, y - r, r, r, GL);
  ell(c, x, y - r * 0.6, r - 1, r * 0.55, liq);
  px(c, x - r + 2, y - r * 0.9, lighten(liq, 0.4), Math.max(1, r * 2 - 4), 1);
  px(c, x - r * 0.5, y - r * 1.5, '#ffffff', 2, 2);
}

/** Reagent bottle: body, shoulder, cap, a paper label with a coloured stripe. */
export function bottle(c: C, x: number, y: number, w: number, h: number, body: string, cap: string, label = '#f4f1e6', stripe?: string) {
  const sh = Math.max(2, Math.round(h * 0.18));
  px(c, x - w - 1, y - h + sh, mix(body, OUTL, 0.45), w * 2 + 2, h - sh + 1);
  px(c, x - w, y - h + sh, body, w * 2, h - sh);
  fillPoly(c, [[x - w, y - h + sh + 1], [x + w, y - h + sh + 1], [x + Math.ceil(w * 0.45), y - h + 1], [x - Math.ceil(w * 0.45), y - h + 1]], body);
  px(c, x - Math.ceil(w * 0.45), y - h - 2, cap, Math.ceil(w * 0.45) * 2, 3);
  px(c, x - Math.ceil(w * 0.45), y - h - 2, lighten(cap, 0.3), 1, 3);
  // label
  const l0 = y - Math.round(h * 0.68);
  const lh = Math.max(2, Math.round(h * 0.36));
  px(c, x - w + 1, l0, label, w * 2 - 1, lh);
  if (stripe) px(c, x - w + 1, l0, stripe, w * 2 - 1, 1);
  if (lh > 3) px(c, x - w + 2, l0 + 2, '#5a5a62', Math.max(1, w), 1);
  // glint on the lit left
  px(c, x - w, y - h + sh + 1, lighten(body, 0.45), 1, Math.max(1, h - sh - 3));
  px(c, x + w - 1, y - h + sh + 1, darken(body, 0.3), 1, h - sh - 1);
}

/** A squeeze wash bottle with a bent nozzle. */
export function washBottle(c: C, x: number, y: number, cap: string) {
  px(c, x - 4, y - 11, '#c8d2d4', 8, 11);
  px(c, x - 3, y - 11, '#eef3f3', 6, 11);
  px(c, x - 3, y - 4, '#d6e8f2', 6, 3);
  px(c, x - 2, y - 13, cap, 4, 2);
  ln(c, x, y - 13, x + 1, y - 18, '#e8eef0');
  ln(c, x + 1, y - 18, x + 5, y - 17, '#e8eef0');
  px(c, x - 3, y - 9, '#ffffff', 1, 6);
}

/** A test-tube rack (screen-aligned) with coloured tubes. */
export function tubeRack(c: C, x: number, y: number, n: number, cols: string[], seed: number) {
  const w = n * 3 + 2;
  // tubes behind the front bar
  for (let i = 0; i < n; i++) {
    const tx = x - Math.floor(w / 2) + 1 + i * 3;
    const lift = hash(i, 1, seed) < 0.2 ? -2 : 0;
    px(c, tx, y - 13 + lift, GLD, 2, 12);
    px(c, tx, y - 12 + lift, GL, 1, 10);
    const col = cols[Math.floor(hash(i, 2, seed) * cols.length)];
    const lv = 3 + Math.floor(hash(i, 3, seed) * 5);
    px(c, tx, y - 2 - lv + lift, col, 2, lv);
    if (hash(i, 4, seed) < 0.4) px(c, tx, y - 14 + lift, ['#e04848', '#3a8ae0', '#40c070', '#f0c040'][i % 4], 2, 2);
  }
  // the rack: white plastic, two bars
  px(c, x - Math.floor(w / 2), y - 7, '#d8e2e4', w, 2);
  px(c, x - Math.floor(w / 2), y - 1, '#c2ced2', w, 2);
  px(c, x - Math.floor(w / 2), y - 7, '#f4f8f8', w, 1);
  px(c, x - Math.floor(w / 2) - 1, y - 7, '#a8b4b8', 1, 8);
  px(c, x + Math.ceil(w / 2), y - 7, '#a8b4b8', 1, 8);
}

/** A magnetic stirrer hot-plate (white, ceramic top, a dial), optionally with a beaker on it. */
export function stirrer(c: C, x: number, y: number, liq?: string) {
  fillPoly(c, [[x - 10, y - 2], [x, y - 7], [x + 10, y - 2], [x, y + 3]], '#e8eeee');
  fillPoly(c, [[x - 10, y - 2], [x, y + 3], [x, y + 6], [x - 10, y + 1]], '#c6d0d0');
  fillPoly(c, [[x, y + 3], [x + 10, y - 2], [x + 10, y + 1], [x, y + 6]], '#a6b2b4');
  fillPoly(c, [[x - 7, y - 2], [x, y - 5.5], [x + 7, y - 2], [x, y + 1.5]], '#f6f8f8');
  px(c, x - 6, y + 2, '#3a5a8a', 2, 2);
  px(c, x + 5, y + 1, TEAL[4], 2, 1);
  if (liq) beaker(c, x, y - 1, 4, 9, liq, 0.6);
}

// ── labels and safety pictograms ────────────────────────────
/** GHS hazard diamond (red border, white field, black symbol) centred on (x, y), half-size s. */
export function ghs(c: C, x: number, y: number, s: number, kind = 0) {
  fillPoly(c, [[x, y - s - 1], [x + s + 1, y], [x, y + s + 1], [x - s - 1, y]], RED[3]);
  fillPoly(c, [[x, y - s + 1], [x + s - 1, y], [x, y + s - 1], [x - s + 1, y]], '#fbfaf6');
  const k = kind % 4;
  if (s < 4) {
    px(c, x - 1, y - 1, '#1a1a1e', 2, 2);
    return;
  }
  if (k === 0) {
    // flame
    px(c, x - 1, y - 2, '#1a1a1e', 2, 4);
    px(c, x - 2, y, '#1a1a1e', 4, 2);
    px(c, x - 2, y + 2, '#1a1a1e', 5, 1);
  } else if (k === 1) {
    // exclamation mark
    px(c, x, y - 3, '#1a1a1e', 1, 4);
    px(c, x, y + 2, '#1a1a1e', 1, 1);
  } else if (k === 2) {
    // corrosion: drops over a bar
    px(c, x - 2, y - 2, '#1a1a1e', 1, 2);
    px(c, x + 1, y - 2, '#1a1a1e', 1, 2);
    px(c, x - 3, y + 1, '#1a1a1e', 6, 2);
  } else {
    // skull
    px(c, x - 1, y - 2, '#1a1a1e', 3, 3);
    px(c, x - 2, y + 2, '#1a1a1e', 5, 1);
  }
}

/** Kinds of ISO safety signs. */
export type SignKind = 'goggles' | 'coat' | 'gloves' | 'warn' | 'flame' | 'corrosive' | 'exit' | 'firstaid' | 'shower' | 'eyewash' | 'fire' | 'nofood' | 'alarm' | 'biohaz';

/**
 * A safety sign as a texture in face pixels (u along the surface, v up), drawn
 * by `pt` so it skews with the wall. w × h face pixels.
 */
function signTex(kind: SignKind, w: number, h: number): FaceTex {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  return (u, v) => {
    const dx = u - cx;
    const dy = v - cy;
    const d = Math.hypot(dx / r, dy / r);
    const nx = dx / r;
    const ny = -dy / r; // y down in the pictogram
    switch (kind) {
      case 'goggles':
      case 'coat':
      case 'gloves': {
        // blue mandatory disc with a white rim and a white symbol
        if (d > 1) return null;
        if (d > 0.88) return '#f4f6f8';
        let sym = false;
        if (kind === 'goggles') sym = Math.abs(ny) < 0.22 && Math.abs(nx) < 0.62 && !(Math.abs(nx) < 0.1 && ny > -0.05);
        else if (kind === 'coat') sym = (ny > -0.5 && ny < 0.6 && Math.abs(nx) < 0.3 + (ny < -0.2 ? 0.1 : 0)) || (ny > -0.5 && ny < 0.1 && Math.abs(nx) < 0.55 && Math.abs(nx) > 0.3);
        else sym = (nx > -0.35 && nx < 0.25 && ny > -0.1 && ny < 0.6) || (nx > -0.35 && nx < 0.35 && ny > -0.55 && ny <= -0.1 && Math.floor((nx + 0.35) / 0.175) % 2 === 0);
        return sym ? '#f4f6f8' : d < 0.8 && bayer(Math.floor(u), Math.floor(v)) > 0.92 ? BLU[4] : BLU[3];
      }
      case 'warn':
      case 'flame':
      case 'corrosive': {
        // yellow triangle, black border, black symbol
        const tv = (h - v) / h; // 0 top … 1 bottom
        const half = tv * 0.58 * w;
        if (tv < 0.04 || tv > 1 || Math.abs(dx) > half) return null;
        if (tv > 0.9 || Math.abs(dx) > half - w * 0.09) return '#1c1c20';
        const sy = (tv - 0.45) / 0.45;
        if (kind === 'warn') return (Math.abs(dx) < w * 0.05 && sy > -0.35 && sy < 0.45) || (Math.abs(dx) < w * 0.05 && sy > 0.62 && sy < 0.78) ? '#1c1c20' : YEL[4];
        if (kind === 'flame') return (Math.abs(dx) < w * (0.11 - sy * 0.07) && sy > -0.3 && sy < 0.7) || (sy > 0.72 && sy < 0.82 && Math.abs(dx) < w * 0.16) ? '#1c1c20' : YEL[4];
        return (sy > 0.45 && sy < 0.62 && Math.abs(dx) < w * 0.2) || (sy > -0.3 && sy < 0.2 && (Math.abs(dx + w * 0.1) < w * 0.035 || Math.abs(dx - w * 0.08) < w * 0.035)) ? '#1c1c20' : YEL[4];
      }
      case 'exit':
      case 'firstaid':
      case 'shower':
      case 'eyewash': {
        // green safe-condition sign with a white symbol
        if (u < 0.6 || v < 0.6 || u > w - 0.6 || v > h - 0.6) return '#f4f6f8';
        const sx = (u - 1) / (w - 2);
        const sy2 = 1 - (v - 1) / (h - 2);
        let sym = false;
        if (kind === 'exit') {
          // a running figure on the left, an arrow on the right
          const fx = sx * 2.2;
          sym = (Math.hypot(fx - 0.42, sy2 - 0.2) < 0.1) || (Math.abs(fx - 0.45 + (sy2 - 0.5) * 0.4) < 0.08 && sy2 > 0.3 && sy2 < 0.62) || (Math.abs(fx - 0.35 - (sy2 - 0.62) * 0.9) < 0.07 && sy2 > 0.6 && sy2 < 0.86) || (Math.abs(fx - 0.6 + (sy2 - 0.62) * 0.4) < 0.07 && sy2 > 0.6 && sy2 < 0.86);
          if (sx > 0.55 && sx < 0.92) sym = (Math.abs(sy2 - 0.5) < 0.09 && sx < 0.85) || (Math.abs(sy2 - 0.5) < (0.92 - sx) * 1.1 && sx > 0.74);
        } else if (kind === 'firstaid') sym = (Math.abs(sx - 0.5) < 0.12 && Math.abs(sy2 - 0.5) < 0.34) || (Math.abs(sy2 - 0.5) < 0.12 && Math.abs(sx - 0.5) < 0.34);
        else if (kind === 'shower') sym = (Math.abs(sy2 - 0.18) < 0.06 && sx > 0.28 && sx < 0.72) || (Math.abs(sx - 0.5) < 0.06 && sy2 > 0.18 && sy2 < 0.3) || (Math.hypot(sx - 0.5, sy2 - 0.45) < 0.09) || (Math.abs(sx - 0.5) < 0.1 && sy2 > 0.52 && sy2 < 0.9) || ((sx * 7 + sy2 * 3) % 1 < 0.25 && sy2 > 0.24 && sy2 < 0.42 && Math.abs(sx - 0.5) < 0.24);
        else sym = (Math.abs(Math.hypot((sx - 0.5) * 1.4, sy2 - 0.62) - 0.2) < 0.06) || (Math.hypot(sx - 0.5, sy2 - 0.62) < 0.07) || (Math.abs(sx - 0.38) < 0.04 && sy2 > 0.16 && sy2 < 0.34) || (Math.abs(sx - 0.62) < 0.04 && sy2 > 0.16 && sy2 < 0.34);
        return sym ? '#f4f6f8' : GRN[3];
      }
      case 'fire':
      case 'alarm': {
        if (u < 0.6 || v < 0.6 || u > w - 0.6 || v > h - 0.6) return '#f4f6f8';
        const sx = (u - 1) / (w - 2);
        const sy2 = 1 - (v - 1) / (h - 2);
        const sym = kind === 'fire' ? (Math.abs(sx - 0.45) < 0.13 && sy2 > 0.3 && sy2 < 0.88) || (Math.abs(sy2 - 0.26) < 0.06 && sx > 0.45 && sx < 0.75) : Math.hypot(sx - 0.5, sy2 - 0.5) < 0.24 && Math.hypot(sx - 0.5, sy2 - 0.5) > 0.12;
        return sym ? '#f4f6f8' : RED[3];
      }
      case 'nofood': {
        if (d > 1) return null;
        if (d > 0.8 || (Math.abs(nx + ny) < 0.16 && d < 0.85)) return RED[3];
        const cup = Math.abs(nx) < 0.3 && ny > -0.3 && ny < 0.45;
        return cup ? '#2a2a30' : '#f6f6f2';
      }
      case 'biohaz': {
        const tv = (h - v) / h;
        const half = tv * 0.58 * w;
        if (tv < 0.04 || tv > 1 || Math.abs(dx) > half) return null;
        if (tv > 0.9 || Math.abs(dx) > half - w * 0.09) return '#1c1c20';
        const rr = Math.hypot(dx / w, tv - 0.6);
        return rr < 0.16 && rr > 0.08 ? '#1c1c20' : YEL[4];
      }
    }
    return null;
  };
}

/**
 * Draw a sign on a plane (u0..u1 along it, z0..z1 up). Planes whose u runs right to
 * left on screen (a room's NW wall, a prop's right side) are mirrored back so the
 * pictogram reads the right way round.
 */
export function sign(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, kind: SignKind, light?: 0 | 1 | 2) {
  const [ax, ay] = pl.F(u0, z0);
  const [bx, by] = pl.F(u1, z0);
  const w = Math.hypot(bx - ax, by - ay);
  const h = (z1 - z0) * p.k;
  const tex = signTex(kind, w, h);
  const rtl = bx < ax;
  pt(p, pl, u0, u1, z0, z1, rtl ? (u, v, x, y) => tex(w - u, v, x, y) : tex, light ?? pl.light);
}

/** A tiny text-like label line (grey dashes) on a light card, screen-aligned. */
export function card(c: C, x: number, y: number, w: number, h: number, bg = '#f4f1e6', ink = '#6a6a72') {
  px(c, x, y, bg, w, h);
  for (let j = 1; j < h - 1; j += 2) px(c, x + 1, y + j, ink, Math.max(1, Math.round((w - 2) * (0.5 + hash(x, y + j, 7) * 0.5))), 1);
}

// ── a 3×5 pixel font for labels and signage ─────────────────
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '-': '000000111000000', '.': '000000000000010', '/': '001001010100100', ':': '000010000010000',
  '+': '000010111010000', '%': '101001010100101', ' ': '000000000000000',
};

/** Width in font pixels of a string (3 px glyphs, 1 px spacing). */
const textW = (s: string) => s.length * 4 - 1;

/**
 * Text written on a plane, centred in u0..u1 and z0..z1. Each glyph stays
 * upright (crisp and readable) and steps along the plane's slope, the way
 * pixel artists letter iso signage. Reads left to right on screen.
 */
export function planeText(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, s: string, ink: string, sc = 1, shade?: string) {
  const zc = (z0 + z1) / 2;
  const A = pl.F(u0, zc);
  const B = pl.F(u1, zc);
  const [L, Rr] = A[0] <= B[0] ? [A, B] : [B, A];
  const dx = Rr[0] - L[0];
  const slope = dx > 0.5 ? (Rr[1] - L[1]) / dx : 0;
  const tw = textW(s) * sc;
  const x0 = Math.round((L[0] + Rr[0]) / 2 - tw / 2);
  for (let i = 0; i < s.length; i++) {
    const gx = x0 + i * 4 * sc;
    const gy = Math.round(L[1] + slope * (gx + 1.5 * sc - L[0]) - 2.5 * sc);
    const g = GLYPHS[s[i]] ?? GLYPHS[' '];
    for (let j = 0; j < 15; j++) {
      if (g[j] !== '1') continue;
      // big letters get a dark return edge on their lower right (they stand proud of the wall)
      if (shade) px(p.c, gx + (j % 3) * sc + 1, gy + Math.floor(j / 3) * sc + 1, shade, sc, sc);
      px(p.c, gx + (j % 3) * sc, gy + Math.floor(j / 3) * sc, ink, sc, sc);
    }
  }
}

/**
 * A horizontal cylinder along local a (rot 0): axis at (b = bc, z = zc), radius R tiles
 * (R·10 in z), from a0 to a1, shaded per pixel from the surface normal; the +x end cap
 * shows as a flat disc. `band(a, t)` may return a colour for labels and hoops.
 */
export function hcyl(p: PropPainter, a0: number, a1: number, bc: number, zc: number, R: number, r: Ramp, band?: (a: number, t: number) => string | null) {
  const c = p.c;
  const k = p.k;
  const Rz = R * 10;
  const corners: [number, number][] = [];
  for (const a of [a0, a1]) for (const b of [bc - R, bc + R]) for (const z of [zc - Rz, zc + Rz]) corners.push(p.P(a, b, z));
  const x0 = Math.floor(Math.min(...corners.map((q) => q[0])));
  const x1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const y0 = Math.floor(Math.min(...corners.map((q) => q[1])));
  const y1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const [ox, oy] = p.P(0, 0, 0);
  const M = Math.hypot(16 * R, Rz);
  const phi = Math.atan2(Rz, 16 * R);
  const n = r.length;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const sx = (x + 0.5 - ox) / (16 * k); // a − b
      const sy = (y + 0.5 - oy) / k; // (a + b)·8 − z
      let col: string | null = null;
      let depth = -Infinity;
      const K = sy - 8 * sx - 16 * bc + zc;
      if (Math.abs(K) <= M) {
        const base = Math.acos(K / M);
        for (const t of [base - phi, -base - phi]) {
          const b = bc + R * Math.cos(t);
          const a = sx + b;
          const z = zc + Rz * Math.sin(t);
          if (a < a0 || a > a1) continue;
          const d = a + b + z / 8;
          if (d <= depth) continue;
          depth = d;
          const sh = 0.55 * Math.cos(t) + 0.8 * Math.sin(t);
          const bandCol = band?.(a, t);
          col = bandCol ?? r[Math.max(0, Math.min(n - 1, Math.round(n * 0.45 + sh * n * 0.42 + (bayer(x, y) - 0.5) * 0.7)))];
        }
      }
      // the end cap at a1 (a flat disc in the plane a = a1)
      const bcap = a1 - sx;
      const zcap = (a1 + bcap) * 8 - sy;
      const e = ((bcap - bc) / R) ** 2 + ((zcap - zc) / Rz) ** 2;
      if (e <= 1) {
        const d = a1 + bcap + zcap / 8;
        if (d > depth) col = e > 0.86 ? r[0] : r[1];
      }
      if (col) {
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
}

// Space pack: ramps, surface materials and shading helpers of the orbital station.
// Cool metals and padded panels with warm accents (gold foil, amber handrails,
// orange hazard paint). Light comes from the upper left: +y faces lit, +x faces
// in shade, tops brightest. Everything here belongs to this world only.
import type { FaceTex, Light, Mat } from '../../../hd/kit';
import { parseColor, SoftCtx } from '../../../hd/soft';
import type { PropPainter } from '../../../iso';
import { at, bayer, type C, ell, fillPoly, hash, noise2, px, type Ramp, soft } from '../../kit4';

// ── ramps (dark → light) ────────────────────────────────────
/** exterior hull plating: cool grey aluminium */
export const HULL: Ramp = ['#1d212c', '#2f3546', '#404758', '#565f74', '#6d7282', '#878c9d', '#acb1b5'];
/** white MMOD shield panels and beta cloth */
export const WHITE: Ramp = ['#545a6a', '#717888', '#949baa', '#b6bcc8', '#d3d8e0', '#e9edf2', '#f8fafc'];
/** gunmetal: frames, bases, kick plates */
export const GUN: Ramp = ['#14161d', '#1c1f29', '#262a36', '#323745', '#404656', '#535a6b', '#6a7284'];
/** bright brushed aluminium */
export const ALU: Ramp = ['#4a5060', '#626a7a', '#7e8696', '#9ba3b1', '#b9c0cb', '#d6dbe3', '#eef1f5'];
/** multi-layer insulation: crinkled gold foil */
export const GOLD: Ramp = ['#5a3a12', '#7e5418', '#a8741e', '#c8962e', '#e0b448', '#f2d278', '#fcecb0'];
/** amber paint: EVA handrails, hazard bands */
export const AMBER: Ramp = ['#6a3410', '#8d5a13', '#b98d3a', '#e59733', '#f1bd3c', '#fbd262', '#fef7d0'];
/** padded interior wall panels: cool off-white fabric */
export const PAD: Ramp = ['#424c5a', '#566475', '#676c7e', '#878f9e', '#a6aab6', '#c4c9d4', '#e7e4d5'];
/** the module floor: anodised slate blue */
export const FLOOR: Ramp = ['#141d33', '#1f2e4e', '#2b3e5f', '#394c74', '#48557d', '#4f6189', '#6c7fa6'];
/** screens and glow */
export const CYAN: Ramp = ['#0e3a44', '#155462', '#1f7482', '#2c98a4', '#45bcc4', '#7adde2', '#c2f6f6'];
export const VIOLET: Ramp = ['#2a1848', '#3e2468', '#58348c', '#7448ae', '#9264cc', '#b48ce2', '#dcc4f4'];
export const RED: Ramp = ['#3e0e12', '#64161a', '#8e2024', '#bc3030', '#e04a3c', '#f47a62', '#fcb4a0'];
export const GREEN: Ramp = ['#0e3a1e', '#165428', '#207234', '#2e9242', '#46b456', '#78d47a', '#b8f0b0'];
/** solar cells: deep indigo with a violet sheen */
export const SOLAR: Ramp = ['#07195b', '#0e236d', '#122b7c', '#1f398b', '#293f8f', '#324a9c', '#475fb0'];
/** radiators: white ceramic panels */
export const RAD: Ramp = ['#5c6474', '#7a8292', '#98a0ae', '#b6bdc8', '#d0d5dd', '#e6e9ee', '#f6f8fa'];
/** thermal tiles: black ceramic */
export const TILE: Ramp = ['#0e0f14', '#16181f', '#1e212a', '#282c37', '#343946', '#434958', '#565d6e'];
/** screen backgrounds */
export const SCREEN = '#0a1420';
export const OUTL = '#2b2230';

/** Fabric ramp around a colour (sofas, bags). */
export function rampAround(hex: string): Ramp {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (k: number, warm: number) => {
    const rr = Math.max(0, Math.min(255, Math.round(r * k + warm * 18)));
    const gg = Math.max(0, Math.min(255, Math.round(g * k + warm * 10)));
    const bb = Math.max(0, Math.min(255, Math.round(b * k - warm * 6 + (1 - Math.min(1, k)) * 26)));
    return '#' + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, '0');
  };
  return [f(0.42, 0), f(0.58, 0), f(0.75, 0), f(0.9, 0.2), f(1.05, 0.5), f(1.2, 0.8), f(1.34, 1)];
}

const base = (light: Light, n: number) => (light === 2 ? n - 2 : light === 1 ? n - 3 : Math.max(1, n - 5));

// ── surface materials (Mat: (light, w, h) → (u, v, x, y) → colour) ──
/**
 * Riveted plating: panels pw × ph face pixels, a dark seam with a lit lip,
 * rivets along the seams, per-panel tone, micrometeoroid pits.
 */
export const plating =
  (r: Ramp, pw = 30, ph = 22, seed = 1): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / ph);
    const off = row & 1 ? pw / 2 : 0;
    const col = Math.floor((u + off) / pw);
    const fu = u + off - col * pw;
    const fv = v - row * ph;
    let i = base(light, r.length) + (hash(col, row, seed) - 0.5) * 0.9;
    if (fu < 1 || fv < 1) return at(r, i - 2);
    if (fv > ph - 1.2 || fu < 2) i += 0.8;
    // rivets: a bright head with a shadow under it, every 5 px along the seams
    if ((fv < 3.2 && fv > 1.6) || (fu > 1.8 && fu < 3.4)) {
      const along = fv < 3.2 && fv > 1.6 ? fu : fv;
      if (Math.abs((along % 5) - 2.5) < 0.6) return at(r, i + 1.4);
    }
    if (hash(x, y, seed + 7) < 0.025) i -= 1;
    return at(r, i);
  };

/** White shield panels (MMOD): large squares, recessed bolts at the corners, faint stains. */
export const shield =
  (r: Ramp = WHITE, pw = 26, ph = 26): Mat =>
  (light) =>
  (u, v, x, y) => {
    const col = Math.floor(u / pw);
    const row = Math.floor(v / ph);
    const fu = u - col * pw;
    const fv = v - row * ph;
    let i = base(light, r.length) + (hash(col, row, 31) - 0.5) * 0.7;
    if (fu < 1 || fv < 1) return at(r, i - 1.6);
    if ((fu < 3.5 || fu > pw - 3.5) && (fv < 3.5 || fv > ph - 3.5)) return at(r, i - 1.2);
    if (noise2(u * 0.05, v * 0.08, 32) > 0.7 && bayer(x, y) > 0.55) i -= 0.6;
    return at(r, i);
  };

/** Quilted padding: diamond stitching, a button in each diamond, a soft sheen near the top. */
export const quilt =
  (r: Ramp, cell = 14): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const a = (u + v) / cell;
    const b = (u - v) / cell;
    const fa = a - Math.floor(a);
    const fb = b - Math.floor(b);
    let i = base(light, r.length) + 0.4;
    // each diamond is a puffed cushion: lit on its upper left
    i += (0.5 - fb) * 0.9 + (fa - 0.5) * 0.5;
    if (fa < 0.07 || fb < 0.07) i -= 1.3;
    if (Math.abs(fa - 0.5) < 0.09 && Math.abs(fb - 0.5) < 0.09) i -= 1;
    if (v > h - 3) i += 0.7;
    if (hash(x, y, 33) < 0.03) i -= 0.5;
    return at(r, i);
  };

/** Brushed metal with fine streaks along u. */
export const brushedU =
  (r: Ramp, sheen = 0.6): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    let i = base(light, r.length);
    if (Math.abs(v / Math.max(1, h) - sheen) < 0.15) i += 0.9;
    if (noise2(u * 0.015, v * 1.3, 41) > 0.63) i -= 0.6;
    if (hash(x, y, 42) < 0.03) i += 0.8;
    return at(r, i);
  };

/** Crinkled gold MLI foil: bright creases, dark folds. */
export const foil =
  (r: Ramp = GOLD): Mat =>
  (light) =>
  (u, v, x, y) => {
    const n = noise2(u * 0.22, v * 0.3, 51) + noise2(u * 0.6, v * 0.5, 52) * 0.5;
    let i = base(light, r.length) + (n - 0.75) * 2.6;
    if (hash(x, y, 53) < 0.04) i += 1.5;
    return at(r, i);
  };

/** Solar cells: square cells with silver busbars and a sheen band. */
export const cells =
  (cw = 9, ch = 9): Mat =>
  (light) =>
  (u, v, x, y) => {
    const fu = u % cw;
    const fv = v % ch;
    if (fu < 1 || fv < 1) return light === 0 ? '#3a4079' : '#878caf';
    let i = (light === 2 ? 3 : light === 1 ? 2.6 : 1.6) + ((u * 0.6 + v) % 70 < 10 ? 1.4 : 0) + (hash(Math.floor(u / cw), Math.floor(v / ch), 61) - 0.5) * 0.6;
    if (Math.abs(fu - cw / 2) < 0.5) i += 0.6;
    if (hash(x, y, 62) < 0.02) i += 1;
    return at(SOLAR, i);
  };

/** Vent grille: horizontal slots in a frame. */
export const grille =
  (r: Ramp, pitch = 3): Mat =>
  (light, w, h) =>
  (u, v) => {
    const b = base(light, r.length);
    if (u < 1.5 || u > w - 1.5 || v < 1.5 || v > h - 1.5) return at(r, b + 1);
    return v % pitch < 1.2 ? at(r, b - 2.5) : at(r, b);
  };

/** Flat colour with a lit top lip and a dark foot (screens' bezels, small parts). */
export const flat =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = base(light, r.length);
    if (v > h - 1.5) i += 1;
    if (v < 1.2) i -= 1;
    if (hash(x, y, 71) < 0.015) i -= 0.6;
    return at(r, i);
  };

/** A single colour for every face of a tiny part, shaded by light. */
export const tone =
  (r: Ramp, off = 0): Mat =>
  (light) =>
  () =>
    at(r, base(light, r.length) + off);

// ── the light (world space): +y lit, +x shaded, tops brightest ──
const LW = (() => {
  const v = [-0.34, 0.62, 0.71];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();
/** toward the camera, in world metres (x, y, z) */
const CAM = (() => {
  const v = [1, 1, 1.6];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();
const HALF = (() => {
  const v = [LW[0] + CAM[0], LW[1] + CAM[1], LW[2] + CAM[2]];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/** Prop-local direction (da, db, dz) → world direction (dx, dy, dz). */
function toWorld(p: PropPainter, da: number, db: number, dz: number): [number, number, number] {
  return p.rot === 0 ? [da, db, dz] : [db, -da, dz];
}

/** Packed opaque colour for direct buffer writes. */
export const packCol = (col: string) => (parseColor(col) | 0xff000000) >>> 0;

/** Direct pixel writer into a CPU layer (falls back to fillRect). */
export class Pix {
  private sc: SoftCtx | null;
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;
  constructor(readonly c: C) {
    const s = soft(c);
    this.sc = s && s.globalAlpha >= 0.999 ? s : null;
  }
  set(x: number, y: number, col: string) {
    const s = this.sc;
    if (!s) return px(this.c, x, y, col);
    this.setPacked(x, y, (parseColor(col) | 0xff000000) >>> 0, col);
  }
  /** Set a pixel to a packed colour (0xAABBGGRR); `col` is its string, for the fallback path. */
  setPacked(x: number, y: number, v: number, col: string) {
    const s = this.sc;
    if (!s) return px(this.c, x, y, col);
    const xx = x - s.ox;
    const yy = y - s.oy;
    if (xx < 0 || yy < 0 || xx >= s.width || yy >= s.height) return;
    s.data[yy * s.width + xx] = v;
    if (xx < this.x0) this.x0 = xx;
    if (xx > this.x1) this.x1 = xx;
    if (yy < this.y0) this.y0 = yy;
    if (yy > this.y1) this.y1 = yy;
  }
  done() {
    if (this.sc && this.x1 >= this.x0) this.sc.touch(this.x0, this.y0, this.x1 + 1, this.y1 + 1);
  }
}

export interface CylOpts {
  /** body ramp (dark → light) */
  ramp: Ramp;
  /** texture: (t metres along the axis, angle, x, y) → tone offset, or a colour */
  tex?: (t: number, ang: number, x: number, y: number) => number | string | null;
  /** cap ramp at the end facing the camera (false: open) */
  cap?: Ramp | false;
  capTex?: (r: number, ang: number, x: number, y: number) => number | string | null;
  /** metallic highlight strength */
  spec?: number;
  bias?: number;
}

/**
 * A cylinder between two prop-local points (a, b in tiles, z in z units) with
 * radius r in metres (1 tile = 1 m = 10 z), shaded per pixel: lambert from the
 * upper left plus a metallic sheen, quantised to the ramp with ordered dither.
 * Angle 0 points along e1 (horizontal perpendicular), π/2 straight up for
 * horizontal axes.
 */
export function cyl(p: PropPainter, a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, r: number, o: CylOpts) {
  const u = [a1 - a0, b1 - b0, (z1 - z0) / 10];
  const L = Math.hypot(u[0], u[1], u[2]);
  if (L < 1e-6) return;
  u[0] /= L;
  u[1] /= L;
  u[2] /= L;
  // perpendiculars: e1 horizontal, e2 = u × e1 (up for horizontal axes)
  let e1: number[];
  if (Math.abs(u[2]) > 0.95) e1 = [1, 0, 0];
  else {
    const h = Math.hypot(u[0], u[1]);
    e1 = [u[1] / h, -u[0] / h, 0];
  }
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  if (e2[2] < 0) {
    e2[0] = -e2[0];
    e2[1] = -e2[1];
    e2[2] = -e2[2];
    e1[0] = -e1[0];
    e1[1] = -e1[1];
  }
  const S = p.P(a0, b0, z0);
  const E = p.P(a1, b1, z1);
  const P1 = p.P(a0 + e1[0] * r, b0 + e1[1] * r, z0 + e1[2] * r * 10);
  const P2 = p.P(a0 + e2[0] * r, b0 + e2[1] * r, z0 + e2[2] * r * 10);
  const D = [E[0] - S[0], E[1] - S[1]];
  const E1 = [P1[0] - S[0], P1[1] - S[1]];
  const E2 = [P2[0] - S[0], P2[1] - S[1]];
  // world directions for lighting and depth
  const w1 = toWorld(p, e1[0], e1[1], e1[2]);
  const w2 = toWorld(p, e2[0], e2[1], e2[2]);
  const wu = toWorld(p, u[0], u[1], u[2]);
  const d1 = w1[0] * CAM[0] + w1[1] * CAM[1] + w1[2] * CAM[2];
  const d2 = w2[0] * CAM[0] + w2[1] * CAM[1] + w2[2] * CAM[2];
  const N = [-D[1], D[0]];
  const DD = D[0] * D[0] + D[1] * D[1];
  const n1 = E1[0] * N[0] + E1[1] * N[1];
  const n2 = E2[0] * N[0] + E2[1] * N[1];
  const Rn = Math.hypot(n1, n2);
  const psi = Math.atan2(n2, n1);
  const ramp = o.ramp;
  const nr = ramp.length;
  const spec = o.spec ?? 0.5;
  const bias = o.bias ?? 0;
  // bounding box
  const ext = Math.hypot(E1[0], E1[1]) + Math.hypot(E2[0], E2[1]);
  const xa = Math.floor(Math.min(S[0], E[0]) - ext - 1);
  const xb = Math.ceil(Math.max(S[0], E[0]) + ext + 1);
  const ya = Math.floor(Math.min(S[1], E[1]) - ext - 1);
  const yb = Math.ceil(Math.max(S[1], E[1]) + ext + 1);
  const W = new Pix(p.c);
  const rp = ramp.map(packCol);
  const lightOf = (c: number, s: number) => {
    const nx = w1[0] * c + w2[0] * s;
    const ny = w1[1] * c + w2[1] * s;
    const nz = w1[2] * c + w2[2] * s;
    const lam = Math.max(0, nx * LW[0] + ny * LW[1] + nz * LW[2]);
    const sp = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
    const x2 = sp * sp;
    const x4 = x2 * x2;
    const x8 = x4 * x4;
    return lam * 0.78 + 0.14 + x8 * x8 * x2 * spec + bias;
  };
  const cps = Math.cos(psi);
  const sps = Math.sin(psi);
  const N0 = N[0] / Rn;
  const N1 = N[1] / Rn;
  if (Rn > 1e-6)
    for (let y = ya; y <= yb; y++) {
      const qy = y + 0.5 - S[1];
      for (let x = xa; x <= xb; x++) {
        const qx = x + 0.5 - S[0];
        const w = qx * N0 + qy * N1;
        if (w < -1 || w > 1) continue;
        const sa = Math.sqrt(1 - w * w);
        // the two angles ψ ± acos(w) without trigonometry; keep the one facing the camera
        const c1 = cps * w - sps * sa;
        const s1 = sps * w + cps * sa;
        const c2 = cps * w + sps * sa;
        const s2 = sps * w - cps * sa;
        const first = c1 * d1 + s1 * d2 >= c2 * d1 + s2 * d2;
        const bc = first ? c1 : c2;
        const bs = first ? s1 : s2;
        const bt = ((qx - bc * E1[0] - bs * E2[0]) * D[0] + (qy - bc * E1[1] - bs * E2[1]) * D[1]) / DD;
        if (bt < 0 || bt > 1) continue;
        let v = lightOf(bc, bs);
        if (o.tex) {
          const tx = o.tex(bt * L, Math.atan2(bs, bc), x, y);
          if (tx === null) continue;
          if (typeof tx === 'string') {
            W.set(x, y, tx);
            continue;
          }
          v += tx / (nr - 1);
        }
        const ti = v * (nr - 1) + (bayer(x, y) - 0.5) * 0.7;
        const k = ti <= 0 ? 0 : ti >= nr - 1 ? nr - 1 : Math.round(ti);
        W.setPacked(x, y, rp[k], ramp[k]);
      }
    }
  W.done();
  // the cap at the end facing the camera
  if (o.cap !== false) {
    const facing = wu[0] * CAM[0] + wu[1] * CAM[1] + wu[2] * CAM[2];
    const C0 = facing > 0 ? E : S;
    const cr = o.cap ?? ramp;
    const n = facing > 0 ? wu : [-wu[0], -wu[1], -wu[2]];
    const lam = Math.max(0, n[0] * LW[0] + n[1] * LW[1] + n[2] * LW[2]) * 0.78 + 0.14 + bias;
    const W2 = new Pix(p.c);
    const det = E1[0] * E2[1] - E1[1] * E2[0];
    if (Math.abs(det) > 1e-6) {
      const ex = Math.ceil(Math.abs(E1[0]) + Math.abs(E2[0])) + 1;
      const ey = Math.ceil(Math.abs(E1[1]) + Math.abs(E2[1])) + 1;
      for (let y = Math.floor(C0[1] - ey); y <= C0[1] + ey; y++)
        for (let x = Math.floor(C0[0] - ex); x <= C0[0] + ex; x++) {
          const qx = x + 0.5 - C0[0];
          const qy = y + 0.5 - C0[1];
          const c = (qx * E2[1] - qy * E2[0]) / det;
          const s = (E1[0] * qy - E1[1] * qx) / det;
          const rr = Math.hypot(c, s);
          if (rr > 1) continue;
          let v = lam;
          let col: string | null = null;
          if (o.capTex) {
            const tx = o.capTex(rr, Math.atan2(s, c), x, y);
            if (tx === null) continue;
            if (typeof tx === 'string') col = tx;
            else v += tx / (cr.length - 1);
          }
          if (rr > 0.9) v -= 0.12;
          if (!col) {
            const ti = v * (cr.length - 1) + (bayer(x, y) - 0.5) * 0.7;
            col = cr[ti <= 0 ? 0 : ti >= cr.length - 1 ? cr.length - 1 : Math.round(ti)];
          }
          W2.set(x, y, col);
        }
    }
    W2.done();
  }
}

/** Screen point on a cylinder's surface (same parameters as cyl): t metres along, angle. */
export function cylPoint(p: PropPainter, a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, r: number, t: number, ang: number): [number, number] {
  const u = [a1 - a0, b1 - b0, (z1 - z0) / 10];
  const L = Math.hypot(u[0], u[1], u[2]);
  u[0] /= L;
  u[1] /= L;
  u[2] /= L;
  let e1: number[];
  if (Math.abs(u[2]) > 0.95) e1 = [1, 0, 0];
  else {
    const h = Math.hypot(u[0], u[1]);
    e1 = [u[1] / h, -u[0] / h, 0];
  }
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  if (e2[2] < 0) {
    e2[0] = -e2[0];
    e2[1] = -e2[1];
    e2[2] = -e2[2];
    e1[0] = -e1[0];
    e1[1] = -e1[1];
  }
  const c = Math.cos(ang) * r;
  const s = Math.sin(ang) * r;
  return p.P(a0 + u[0] * t + e1[0] * c + e2[0] * s, b0 + u[1] * t + e1[1] * c + e2[1] * s, z0 + (u[2] * t + e1[2] * c + e2[2] * s) * 10);
}

export interface BallOpts {
  ramp: Ramp;
  tex?: (nx: number, ny: number, nz: number, x: number, y: number) => number | string | null;
  spec?: number;
  bias?: number;
  /** only the upper half (domes) */
  dome?: boolean;
}

/**
 * An ellipsoid centred on a prop-local point: radii ra, rb (metres) and rz
 * (metres), shaded per pixel with the world light and a sheen.
 */
export function ball(p: PropPainter, a: number, b: number, z: number, ra: number, rb: number, rz: number, o: BallOpts) {
  const C0 = p.P(a, b, z);
  const ramp = o.ramp;
  const nr = ramp.length;
  const spec = o.spec ?? 0.4;
  const bias = o.bias ?? 0;
  // screen basis of the three local axes (scaled by radii)
  const PA = p.P(a + ra, b, z);
  const PB = p.P(a, b + rb, z);
  const PZ = p.P(a, b, z + rz * 10);
  const A = [PA[0] - C0[0], PA[1] - C0[1]];
  const B = [PB[0] - C0[0], PB[1] - C0[1]];
  const Z = [PZ[0] - C0[0], PZ[1] - C0[1]];
  const ext = Math.abs(A[0]) + Math.abs(B[0]) + Math.abs(Z[0]) + 1;
  const eyy = Math.abs(A[1]) + Math.abs(B[1]) + Math.abs(Z[1]) + 1;
  // camera direction in the scaled local frame
  const ca = toLocalScaled(p, ra, rb, rz);
  const W = new Pix(p.c);
  for (let y = Math.floor(C0[1] - eyy); y <= C0[1] + eyy; y++)
    for (let x = Math.floor(C0[0] - ext); x <= C0[0] + ext; x++) {
      const qx = x + 0.5 - C0[0];
      const qy = y + 0.5 - C0[1];
      // points s·A + t·B + w·Z on the unit sphere, projecting to q: solve along the camera ray
      // q = s A + t B + w Z, with (s, t, w) = q0 + λ·cam (cam projects to 0)
      const q0 = solve2(A, B, qx, qy);
      if (!q0) continue;
      // q0 = (s, t, 0); ray (s, t, 0) + λ (ca)
      const [s0, t0] = q0;
      const aa = ca[0] * ca[0] + ca[1] * ca[1] + ca[2] * ca[2];
      const bb = 2 * (s0 * ca[0] + t0 * ca[1]);
      const cc = s0 * s0 + t0 * t0 - 1;
      const disc = bb * bb - 4 * aa * cc;
      if (disc < 0) continue;
      const lam = (-bb + Math.sqrt(disc)) / (2 * aa);
      const ns = s0 + lam * ca[0];
      const nt = t0 + lam * ca[1];
      const nw = lam * ca[2];
      if (o.dome && nw < -0.02) continue;
      // normal in local scaled space → world
      const nl = [ns / ra, nt / rb, nw / rz];
      const wn = toWorld(p, nl[0], nl[1], nl[2]);
      const m = Math.hypot(wn[0], wn[1], wn[2]);
      const nx = wn[0] / m;
      const ny = wn[1] / m;
      const nz = wn[2] / m;
      const lamb = Math.max(0, nx * LW[0] + ny * LW[1] + nz * LW[2]);
      const sp = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
      const q2 = sp * sp;
      const q4 = q2 * q2;
      const q8 = q4 * q4;
      let v = lamb * 0.78 + 0.14 + q8 * q8 * spec + bias;
      let col: string | null = null;
      if (o.tex) {
        const tx = o.tex(ns, nt, nw, x, y);
        if (tx === null) continue;
        if (typeof tx === 'string') col = tx;
        else v += tx / (nr - 1);
      }
      if (!col) {
        const ti = v * (nr - 1) + (bayer(x, y) - 0.5) * 0.7;
        col = ramp[ti <= 0 ? 0 : ti >= nr - 1 ? nr - 1 : Math.round(ti)];
      }
      W.set(x, y, col);
    }
  W.done();
}

/** The camera direction expressed in a prop's local axes scaled by radii (for ball). */
function toLocalScaled(p: PropPainter, ra: number, rb: number, rz: number): [number, number, number] {
  // world CAM → local: rot 0 identity; rot 1: world (x, y) = (b, −a) → a = −y, b = x
  const la = p.rot === 0 ? CAM[0] : -CAM[1];
  const lb = p.rot === 0 ? CAM[1] : CAM[0];
  // camera direction in metres → in scaled units (divide by radii); its projection is 0 by construction
  return [la / ra, lb / rb, CAM[2] / rz];
}

function solve2(A: number[], B: number[], qx: number, qy: number): [number, number] | null {
  const det = A[0] * B[1] - A[1] * B[0];
  if (Math.abs(det) < 1e-9) return null;
  return [(qx * B[1] - qy * B[0]) / det, (A[0] * qy - A[1] * qx) / det];
}

export interface FrustumOpts {
  ramp: Ramp;
  /** texture: (z, angle round the axis in world space, x, y) → tone offset or a colour */
  tex?: (z: number, ang: number, x: number, y: number) => number | string | null;
  /** ramp of the top face (false: open, e.g. a nozzle's mouth drawn by the caller) */
  top?: Ramp | false;
  topTex?: (r: number, ang: number, x: number, y: number) => number | string | null;
  spec?: number;
  bias?: number;
}

/**
 * A vertical frustum (cylinder, cone, bell) on a prop-local point, from z0 with
 * radius r0 to z1 with radius r1 (metres), drawn slice by slice from the bottom
 * so each slice's front rim is the visible wall; per-pixel normals tilt with the
 * slope, lit from the upper left.
 */
export function frustum(p: PropPainter, a: number, b: number, z0: number, z1: number, r0: number, r1: number, o: FrustumOpts) {
  const ramp = o.ramp;
  const nr = ramp.length;
  const rp = ramp.map(packCol);
  const spec = o.spec ?? 0.5;
  const bias = o.bias ?? 0;
  const hm = Math.max(1e-6, (z1 - z0) / 10);
  const slope = (r0 - r1) / hm;
  const steps = Math.max(1, Math.ceil(((z1 - z0) * p.k) / 1));
  const W = new Pix(p.c);
  for (let i = 0; i <= steps; i++) {
    const z = z0 + ((z1 - z0) * i) / steps;
    const r = r0 + ((r1 - r0) * i) / steps;
    if (r <= 0) continue;
    const top = i === steps && o.top !== false;
    const [cx, cy] = p.P(a, b, z);
    const k4 = p.k / 4;
    const rx = 90.51 * r * k4;
    const ry = 45.25 * r * k4;
    for (let dy = Math.floor(-ry); dy <= Math.ceil(ry); dy++) {
      const yy = Math.round(cy) + dy;
      const t = 1 - ((dy + 0.5) * (dy + 0.5)) / (ry * ry + 0.25);
      if (t < 0) continue;
      const hw = rx * Math.sqrt(t);
      for (let xx = Math.round(cx - hw); xx < Math.round(cx + hw); xx++) {
        const dx = xx + 0.5 - cx;
        const ddy = yy + 0.5 - cy;
        // the slice's circle angle in prop-local axes, then the world normal
        const u = dx / (64 * r * k4);
        const v = ddy / (32 * r * k4);
        const ca = (u + v) / 2;
        const sa = (v - u) / 2;
        const wn = toWorld(p, ca, sa, 0);
        let nx = wn[0];
        let ny = wn[1];
        let nz = slope;
        if (top) {
          nx = 0;
          ny = 0;
          nz = 1;
        }
        const m = Math.hypot(nx, ny, nz) || 1;
        nx /= m;
        ny /= m;
        nz /= m;
        const lam = Math.max(0, nx * LW[0] + ny * LW[1] + nz * LW[2]);
        const sp = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
        const q2 = sp * sp;
        const q4 = q2 * q2;
        const q8 = q4 * q4;
        let val = lam * 0.78 + 0.14 + q8 * q8 * spec + bias;
        const R = top && o.top ? o.top : ramp;
        const tex = top ? o.topTex : o.tex;
        if (tex) {
          const tx = top ? tex(Math.hypot(ca, sa), Math.atan2(wn[1], wn[0]), xx, yy) : tex(z, Math.atan2(wn[1], wn[0]), xx, yy);
          if (tx === null) continue;
          if (typeof tx === 'string') {
            W.set(xx, yy, tx);
            continue;
          }
          val += tx / (R.length - 1);
        }
        const ti = val * (R.length - 1) + (bayer(xx, yy) - 0.5) * 0.7;
        const kk = ti <= 0 ? 0 : ti >= R.length - 1 ? R.length - 1 : Math.round(ti);
        if (R === ramp) W.setPacked(xx, yy, rp[kk], ramp[kk]);
        else W.set(xx, yy, R[kk]);
      }
    }
  }
  W.done();
  void nr;
}

/**
 * A flared bell or cone along any axis (nozzles, horns): from prop-local point 0
 * (radius r0) to point 1 (radius r1), drawn as slices from the end turned away
 * from the camera to the end facing it. The near end is a cap, or — if `mouth`
 * is given — an open mouth: a lit rim round a dark throat.
 */
export function bell(p: PropPainter, a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, r0: number, r1: number, o: { ramp: Ramp; mouth?: string; spec?: number; bias?: number }) {
  const u = [a1 - a0, b1 - b0, (z1 - z0) / 10];
  const L = Math.hypot(u[0], u[1], u[2]);
  if (L < 1e-6) return;
  u[0] /= L;
  u[1] /= L;
  u[2] /= L;
  let e1: number[];
  if (Math.abs(u[2]) > 0.95) e1 = [1, 0, 0];
  else {
    const h = Math.hypot(u[0], u[1]);
    e1 = [u[1] / h, -u[0] / h, 0];
  }
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  const S0 = p.P(a0, b0, z0);
  const S1 = p.P(a1, b1, z1);
  const P1 = p.P(a0 + e1[0], b0 + e1[1], z0 + e1[2] * 10);
  const P2 = p.P(a0 + e2[0], b0 + e2[1], z0 + e2[2] * 10);
  const E1 = [P1[0] - S0[0], P1[1] - S0[1]];
  const E2 = [P2[0] - S0[0], P2[1] - S0[1]];
  const det = E1[0] * E2[1] - E1[1] * E2[0];
  if (Math.abs(det) < 1e-9) return;
  const w1 = toWorld(p, e1[0], e1[1], e1[2]);
  const w2 = toWorld(p, e2[0], e2[1], e2[2]);
  const wu = toWorld(p, u[0], u[1], u[2]);
  const toward1 = wu[0] * CAM[0] + wu[1] * CAM[1] + wu[2] * CAM[2] > 0;
  const slope = (r1 - r0) / L;
  const ramp = o.ramp;
  const nr = ramp.length;
  const rp = ramp.map(packCol);
  const spec = o.spec ?? 0.6;
  const bias = o.bias ?? 0;
  const steps = Math.max(2, Math.ceil(Math.hypot(S1[0] - S0[0], S1[1] - S0[1])) + 1);
  const W = new Pix(p.c);
  for (let j = 0; j <= steps; j++) {
    const i = toward1 ? j : steps - j;
    const t = i / steps;
    const cx = S0[0] + (S1[0] - S0[0]) * t;
    const cy = S0[1] + (S1[1] - S0[1]) * t;
    const r = r0 + (r1 - r0) * t;
    if (r <= 0.005) continue;
    const last = j === steps;
    const ex = (Math.abs(E1[0]) + Math.abs(E2[0])) * r + 1;
    const ey = (Math.abs(E1[1]) + Math.abs(E2[1])) * r + 1;
    for (let y = Math.floor(cy - ey); y <= cy + ey; y++)
      for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
        const qx = (x + 0.5 - cx) / r;
        const qy = (y + 0.5 - cy) / r;
        const al = (qx * E2[1] - qy * E2[0]) / det;
        const be = (E1[0] * qy - E1[1] * qx) / det;
        const rr = al * al + be * be;
        if (rr > 1) continue;
        if (last && o.mouth) {
          W.set(x, y, rr > 0.72 ? ramp[Math.min(nr - 1, 5)] : o.mouth);
          continue;
        }
        let nx: number;
        let ny: number;
        let nz: number;
        if (last) {
          const sg = toward1 ? 1 : -1;
          nx = wu[0] * sg;
          ny = wu[1] * sg;
          nz = wu[2] * sg;
        } else {
          nx = w1[0] * al + w2[0] * be - wu[0] * slope;
          ny = w1[1] * al + w2[1] * be - wu[1] * slope;
          nz = w1[2] * al + w2[2] * be - wu[2] * slope;
        }
        const m = Math.hypot(nx, ny, nz) || 1;
        nx /= m;
        ny /= m;
        nz /= m;
        const lam = Math.max(0, nx * LW[0] + ny * LW[1] + nz * LW[2]);
        const sp = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
        const q2 = sp * sp;
        const q4 = q2 * q2;
        const q8 = q4 * q4;
        const v = lam * 0.78 + 0.14 + q8 * q8 * spec + bias;
        const ti = v * (nr - 1) + (bayer(x, y) - 0.5) * 0.7;
        const kk = ti <= 0 ? 0 : ti >= nr - 1 ? nr - 1 : Math.round(ti);
        W.setPacked(x, y, rp[kk], ramp[kk]);
      }
  }
  W.done();
}

// ── glows and lights ─────────────────────────────────────────
/** A dithered halo (screens, lamps) — use in anim or static art. */
export function halo(c: C, x: number, y: number, rx: number, ry: number, col: string, alpha = 0.25) {
  const prev = c.globalAlpha;
  for (let j = Math.floor(-ry); j <= ry; j++)
    for (let i = Math.floor(-rx); i <= rx; i++) {
      const d = Math.hypot(i / rx, j / ry);
      if (d > 1) continue;
      const dens = (1 - d) * 1.4;
      if (dens < bayer(x + i, y + j)) continue;
      c.globalAlpha = prev * alpha * (d < 0.45 ? 1 : 0.6);
      c.fillStyle = col;
      c.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
    }
  c.globalAlpha = prev;
}

/** A small lamp: a bright core, a mid ring, a dark rim (status LEDs, nav lights). */
export function led(c: C, x: number, y: number, r: Ramp, size = 2) {
  if (size <= 1) return px(c, x, y, r[5]);
  if (size === 2) {
    px(c, x, y, r[4], 2, 2);
    px(c, x, y, r[6]);
    return;
  }
  ell(c, x, y, size * 0.6, size * 0.6, r[2]);
  ell(c, x - 0.3, y - 0.3, size * 0.42, size * 0.42, r[4]);
  px(c, x - size * 0.2, y - size * 0.2, r[6]);
}

/** A polygon through prop-local 3D points (flat colour). */
export function quad3(p: PropPainter, pts: [number, number, number][], col: string) {
  fillPoly(
    p.c,
    pts.map(([a, b, z]) => p.P(a, b, z)),
    col,
  );
}

/** Lit / shaded pick for a vertical face: 1 = +y face (lit), 0 = +x face. */
export const lit = (light: Light, r: Ramp, litI: number, shadeI: number) => at(r, light ? litI : shadeI);

export type { FaceTex, Mat, Light };

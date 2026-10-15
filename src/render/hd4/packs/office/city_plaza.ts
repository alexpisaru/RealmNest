// Office — the modern city plaza (the owner's retouch, 2026-10): date palms in
// cream stone planters, slim light poles, striped market stalls, a square
// fountain with dancing jets, a ring sculpture, glass bus shelters, a white and
// orange tram, a green kiosk, café tables under white parasols, benches and
// bocce lawns. Bright, vivid, luxurious: Dubai / Miami rather than old Rome.
import type { PropMeta } from '../../../../data/props';
import { darken, lighten } from '../../../color';
import { type FaceTex, type Mat, texPara } from '../../../hd/kit';
import { Painter, PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { at, bayer, type C, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, noise2, px, type Ramp, rng } from '../../kit4';
import { boards4 } from '../../materials4';
import { front, pq, pt, side } from '../../plane4';
import { grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';

// ── palette ─────────────────────────────────────────────────
const CREAM: Ramp = ['#8a7a60', '#a8977a', '#cbb999', '#e6d9c0', '#f4ecdc', '#fffaf0'];
const CHAR: Ramp = ['#1c1d22', '#2a2c32', '#3a3d45', '#55596a', '#727789', '#959bad'];
const PALM: Ramp = ['#143414', '#1f4a1a', '#2c6a20', '#3f8a28', '#5aa832', '#86c84a', '#b4e070'];
const TRUNK: Ramp = ['#3e2a18', '#5a3e22', '#6a4a2a', '#8a6538', '#b08848', '#d8b060', '#f2d488', '#fff0c0'];
const WOOD: Ramp = ['#4a2816', '#6a3c22', '#8a5230', '#a8693a', '#c4844e', '#dca468'];
const GLASS: Ramp = ['#1c3a6a', '#28508e', '#3f72b4', '#7aa6dc', '#c4dcf4', '#eef6ff'];
const LEAF: Ramp = ['#163a1a', '#1f5222', '#2c6a26', '#3d852c', '#55a234', '#78bf44', '#a6d860'];
const SOIL: Ramp = ['#24180f', '#33231a', '#433024', '#55402e'];
const BLOOMS = ['#f07ab0', '#a070e0', '#f6d040', '#fbf7ee', '#e8383a', '#f59a3a', '#f4a8d0'];
const LIGHT_W = '#fff0c0';
const LIGHT_M = '#ffd98a';
const LIGHT_D = '#f2b860';

// ── small helpers ───────────────────────────────────────────
/** Screen depth of a local point (larger = nearer the camera), for drawing parts back to front. */
const depthOf = (p: PropPainter, a: number, b: number) => (p.rot ? b - a : a + b);
/** The local a of the visible end face (a = w for rot 0, a = 0 for rot 1). */
const nearA = (p: PropPainter, w: number) => (p.rot ? 0 : w);
/** Pixel scale for animations (they may draw at a smaller zoom). */
const unit = (p: PropPainter) => p.k / 4;

/**
 * A vertical pill (a stadium: straight sides, round ends) of flat colour, as runs of
 * rows that never overlap, so it blends evenly under globalAlpha (glows in anims).
 */
function pill(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  const r = Math.min(rx, ry);
  const y0 = Math.round(cy - ry);
  const y1 = Math.round(cy + ry);
  const half = (y: number) => {
    const d = Math.max(0, Math.abs(y + 0.5 - cy) - (ry - r));
    return Math.round((Math.sqrt(Math.max(0, r * r - d * d)) * rx) / r);
  };
  let s = y0;
  for (let y = y0 + 1; y <= y1; y++) {
    if (y < y1 && half(y) === half(s)) continue;
    const w = half(s);
    if (w > 0) c.fillRect(Math.round(cx) - w, s, w * 2, y - s);
    s = y;
  }
}

/**
 * A 1-px stroke along f(s), s = 0..1 (about `len` px long), merged into horizontal and vertical
 * runs so a long curve costs a few rects (for anims, which redraw every frame).
 */
function stroke(c: C, f: (s: number) => [number, number], col: (s: number) => string, len: number) {
  const n = Math.max(2, Math.ceil(len * 2));
  let x0 = 0;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;
  let rc = '';
  let lx = NaN;
  let ly = NaN;
  const flush = () => {
    if (!rc) return;
    c.fillStyle = rc;
    c.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    rc = '';
  };
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const [fx, fy] = f(s);
    const x = Math.round(fx);
    const y = Math.round(fy);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    const cc = col(s);
    if (cc === rc) {
      if (y0 === y1 && y === y0 && (x === x1 + 1 || x === x0 - 1)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        continue;
      }
      if (x0 === x1 && x === x0 && (y === y1 + 1 || y === y0 - 1)) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        continue;
      }
    }
    flush();
    x0 = x1 = x;
    y0 = y1 = y;
    rc = cc;
  }
  flush();
}

/** Smooth cream stone: speckle, a lit top lip, a darker foot and optional slab joints. */
const smooth =
  (r: Ramp, joint = 0, bright = 0): Mat =>
  (light, _w, h) =>
  (u, v, x, y) => {
    const n = r.length;
    let i = (light === 2 ? n - 1.7 : light === 1 ? n - 2.5 : n - 4) + bright;
    if (light !== 2 && v > h - 1.3) i += 0.9;
    if (light !== 2 && v < 1.3) i -= 0.6;
    const s = hash(x, y, 91);
    if (s < 0.05) i -= 0.7;
    else if (s > 0.975) i += 0.6;
    if (joint && u > 2 && u % joint < 1) i -= 1.3;
    return at(r, i);
  };

/** Powder-coated metal: flat, a lit lip, rare speckle. */
const coat =
  (r: Ramp): Mat =>
  (light, _w, h) =>
  (_u, v, x, y) => {
    let i = light === 2 ? r.length - 2 : light === 1 ? r.length - 3 : 1;
    if (v > h - 1.2) i += 1;
    if (hash(x, y, 93) < 0.02) i += 0.6;
    return at(r, i);
  };

/** An upright cylinder (posts, poles): lit on the left, a dark rim on the right. */
function cylinder(c: C, x: number, yTop: number, yBot: number, w: number, r: Ramp, lift = 0) {
  const W = Math.max(2, Math.round(w));
  const x0 = Math.round(x - W / 2);
  for (let i = 0; i < W; i++) {
    const u = (i + 0.5) / W;
    const t = u < 0.2 ? 3 : u < 0.42 ? 4 : u < 0.7 ? 2 : u < 0.88 ? 1 : 0;
    px(c, x0 + i, yTop, r[Math.min(r.length - 1, t + lift)], 1, Math.max(1, yBot - yTop));
  }
}

/** A moulded cream stone box (planters, plinths, borders): a darker plinth, the wall, a projecting coping. */
function curbBox(p: PropPainter, a0: number, b0: number, aw: number, bd: number, h: number) {
  const plinth = smooth(CREAM, 0, -0.6);
  const wall = smooth(CREAM, 26);
  lbox(p, a0 - 0.02, b0 - 0.02, aw + 0.04, bd + 0.04, 0, 0.8, { front: plinth, side: plinth, top: plinth, edge: CREAM[1] });
  lbox(p, a0 + 0.02, b0 + 0.02, aw - 0.04, bd - 0.04, 0.8, h - 2, { front: wall, side: wall, top: wall, edge: CREAM[1] });
  const cop = smooth(CREAM, 0, 0.4);
  lbox(p, a0 - 0.03, b0 - 0.03, aw + 0.06, bd + 0.06, h - 1.2, 1.2, { front: cop, side: cop, top: cop, edge: CREAM[1] });
}

/** A textured horizontal rectangle (local a0..a1 × b0..b1 at height z); u runs along a, v along b (from the front). */
function topQuad(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, tex: FaceTex) {
  const o = p.P(a0, b1, z);
  const pa = p.P(a1, b1, z);
  const pb = p.P(a0, b0, z);
  texPara(p.c, o, [pa[0] - o[0], pa[1] - o[1]], [pb[0] - o[0], pb[1] - o[1]], tex);
}

/** The soil inside a planter: sunk below the coping, the far inner walls showing, pebbles and crumbs. */
function soilBed(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number) {
  const zs = z - 0.9;
  const tex = (u: number, v: number, x: number, y: number) => {
    let i = 1.6 + (noise2(u * 0.12, v * 0.2, seed) - 0.5) * 1.6;
    const hsh = hash(x, y, seed + 5);
    if (hsh < 0.08) i += 1.2;
    else if (hsh > 0.93) i -= 1;
    return at(SOIL, i);
  };
  topQuad(p, a0, b0, a1, b1, zs, tex);
  const R0 = rng(seed * 13 + 1);
  const n = Math.round((a1 - a0) * (b1 - b0) * 90);
  for (let i = 0; i < n; i++) {
    const [x, y] = p.P(a0 + R0() * (a1 - a0), b0 + R0() * (b1 - b0), zs);
    const r = R0();
    px(p.c, x, y, r < 0.35 ? SOIL[3] : r < 0.55 ? '#8a7f74' : r < 0.62 ? '#c8c0b2' : SOIL[0], r < 0.62 && r > 0.35 ? 2 : 1, 1);
  }
  // the far inner walls of the curb, in their own shade
  const fb = front(p, b0);
  pq(p, fb, a0, a1, zs, z, fb.light ? CREAM[2] : CREAM[1]);
  const fa = side(p, p.rot ? a1 : a0);
  pq(p, fa, b0, b1, zs, z, fa.light ? CREAM[2] : CREAM[1]);
}

// ── plants for the planters ─────────────────────────────────
type Kind = 'shrub' | 'bloom' | 'spiky' | 'ball' | 'lavender' | 'fern';

/** One plant in a bed, standing on (x, y), in its own outlined layer. */
function bedPlant(c: C, x: number, y: number, kind: Kind, s: number, seed: number, col: string) {
  const rect: [number, number, number, number] = [x - 26 * s, y - 40 * s, x + 26 * s, y + 6];
  layer(
    c,
    (l) => {
      const R0 = rng(seed);
      if (kind === 'shrub' || kind === 'bloom') {
        const m: Mass[] = [
          { x, y: y - 7 * s, rx: 11 * s, ry: 8 * s, z: 1 },
          { x: x - 6 * s, y: y - 4 * s, rx: 7 * s, ry: 5.5 * s, z: 2 },
          { x: x + 6 * s, y: y - 4 * s, rx: 7 * s, ry: 5.5 * s, z: 2 },
        ];
        foliage(l, m, LEAF, seed, kind === 'bloom' ? { cell: 2.6, dots: [col, lighten(col, 0.3)], dotChance: 0.8, dotSize: 3 } : { cell: 3, tilt: 0.14, dots: [col], dotChance: 0.18, dotSize: 3 });
      } else if (kind === 'ball') {
        // a clipped box ball: dense, round, a crisp lit cap
        foliage(l, [{ x, y: y - 9 * s, rx: 10 * s, ry: 9 * s, z: 1 }], ['#123018', '#1a4220', '#245828', '#2f6e2e', '#3f8634', '#56a03e', '#78b84c'], seed, { cell: 2.2, tilt: 0.08 });
      } else if (kind === 'spiky') {
        // a cordyline / agave rosette: sword leaves fanning up and out
        const n = 9 + Math.floor(R0() * 4);
        const red = col === '#e8383a';
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.5 + (R0() - 0.5) * 0.25;
          const len = (12 + R0() * 9) * s * (1 - Math.abs(Math.cos(a)) * 0.25);
          const ex = x + Math.cos(a) * len;
          const ey = y - 3 - Math.abs(Math.sin(a)) * len;
          const lit = Math.cos(a) < 0.2;
          const c0 = red ? (lit ? '#c8384a' : '#8a2438') : lit ? LEAF[4] : LEAF[2];
          const c1 = red ? '#f06a6a' : LEAF[6];
          ln(l, x, y - 2, ex, ey, c0, 2);
          ln(l, x + (ex - x) * 0.4, y - 2 + (ey - y) * 0.4, ex, ey, c1);
        }
      } else if (kind === 'lavender') {
        foliage(l, [{ x, y: y - 4 * s, rx: 10 * s, ry: 5 * s, z: 1 }], LEAF, seed, { cell: 2.4 });
        for (let q = 0; q < 11; q++) {
          const sx = x - 9 * s + q * 1.8 * s;
          const h = (9 + R0() * 7) * s;
          const lean = (q - 5) * 0.35;
          ln(l, sx, y - 5, sx + lean, y - 5 - h, '#5e8a50');
          for (let j = 0; j < 5; j++) px(l, sx + lean - 0.5, y - 5 - h + j * 1.4, j < 2 ? lighten(col, 0.25) : col, 2, 1);
        }
      } else {
        // a fern / small palm: arching green fronds
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (1.05 + (i / (n - 1)) * 0.9);
          const len = (13 + R0() * 5) * s;
          const ex = x + Math.cos(a) * len;
          const ey = y - 9 * s + Math.sin(a) * len * 0.45 + 6 * s;
          curve(l, x, y - 3, (x + ex) / 2, y - 16 * s, ex, ey, LEAF[3], 1);
          for (let j = 2; j < 8; j++) {
            const t = j / 8;
            const qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ((x + ex) / 2) + t * t * ex;
            const qy = (1 - t) * (1 - t) * (y - 3) + 2 * (1 - t) * t * (y - 16 * s) + t * t * ey;
            px(l, qx - 2, qy, LEAF[j % 2 ? 5 : 4], 2, 1);
            px(l, qx + 1, qy + 1, LEAF[3], 2, 1);
          }
        }
      }
    },
    { outline: 0.6, rect },
  );
}

/** Fill a bed (local a0..a1 × b0..b1, soil at z) with a seeded mix of plants, back to front. */
function plantBed(p: PropPainter, a0: number, b0: number, a1: number, b1: number, z: number, seed: number, skip?: (a: number, b: number) => boolean, kinds: Kind[] = ['shrub', 'bloom', 'spiky', 'bloom', 'lavender', 'fern', 'bloom', 'shrub'], step = 0.27) {
  const R0 = rng(seed * 7 + 11);
  const pts: { a: number; b: number; kind: Kind; s: number; col: string }[] = [];
  const na = Math.max(1, Math.round((a1 - a0) / step));
  const nb = Math.max(1, Math.round((b1 - b0) / step));
  for (let i = 0; i < na; i++)
    for (let j = 0; j < nb; j++) {
      const a = a0 + ((i + 0.5) * (a1 - a0)) / na + (R0() - 0.5) * 0.08;
      const b = b0 + ((j + 0.5) * (b1 - b0)) / nb + (R0() - 0.5) * 0.08;
      if (skip?.(a, b)) continue;
      const kind = kinds[Math.floor(R0() * kinds.length)];
      pts.push({ a, b, kind, s: 0.85 + R0() * 0.4, col: BLOOMS[Math.floor(R0() * BLOOMS.length)] });
    }
  pts.sort((q, r) => depthOf(p, q.a, q.b) - depthOf(p, r.a, r.b));
  for (const q of pts) {
    const [x, y] = p.P(q.a, q.b, z - 0.9);
    bedPlant(p.c, x, y, q.kind, q.s, Math.floor(seed * 31 + q.a * 97 + q.b * 53), q.col);
  }
  return pts;
}

// ── 1. palm: a date palm, in a planter (vaso) or on the ground (libera) ──
interface Frond {
  /** direction round the head (0 = screen right, π/2 = toward the camera) */
  phi: number;
  L: number;
  /** elevation of the frond at its base, and how much it bends down to the tip (radians) */
  e0: number;
  kap: number;
  tier: number;
}

/** A scaly date-palm trunk (a diamond lattice of old leaf bases), curving a little; `glow` lights its foot warm (the uplight). */
function palmTrunk(c: C, x: number, y: number, H: number, w0: number, w1: number, lean: number, seed: number, glow: number) {
  layer(
    c,
    (l) => {
      const P = 7;
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const cx = x + lean * t * t;
        const ww = w0 + (w1 - w0) * t + (j < 9 ? (9 - j) * 0.6 : 0);
        const W = Math.max(3, Math.round(ww));
        const x0 = Math.round(cx - W / 2);
        const jj = j + (seed % 7);
        for (let i = 0; i < W; i++) {
          const u = (i + 0.5) / W;
          let tone = u < 0.14 ? 3.9 : u < 0.34 ? 3.5 : u < 0.56 ? 2.8 : u < 0.78 ? 2.1 : u < 0.92 ? 1.4 : 0.9;
          // the lattice runs round the cylinder: diagonal seams, squeezed toward the edges
          const s = (Math.asin(2 * u - 1) / Math.PI + 0.5) * 30;
          const d1 = (((s + jj * 0.9) % P) + P) % P;
          const d2 = (((s - jj * 0.9) % P) + P) % P;
          if (d1 < 1.1) tone -= 1.4;
          else if (d2 < 0.9) tone -= 0.8;
          else if (d1 > P - 2.2 && d2 > 2) tone += 0.7;
          if (hash(x0 + i, jj, seed) < 0.04) tone -= 0.6;
          // the uplight: warm and bright at the foot, fading up the trunk
          if (glow > 0) {
            const g = glow * Math.max(0, 1 - j / (H * 0.9)) ** 1.1 * (1.25 - Math.abs(u - 0.4) * 1.3);
            tone += Math.max(0, g) * 4;
          }
          px(l, x0 + i, y - j - 1, at(TRUNK, tone + (bayer(x0 + i, y - j) - 0.5) * 0.45));
        }
      }
    },
    { outline: 0.62, rect: [x - w0 - Math.abs(lean) - 8, y - H - 4, x + w0 + Math.abs(lean) + 8, y + 2] },
  );
}

const nrm3 = (v: number[]) => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

/** A frond's rib as 3D points (x right, y toward the camera, z up, in px) from the head outward. */
function frondPath(f: Frond, steps: number) {
  const cp = Math.cos(f.phi);
  const sp = Math.sin(f.phi);
  const pts: number[][] = [[0, 0, 0]];
  let D = 0;
  let Z = 0;
  for (let i = 1; i <= steps; i++) {
    const s = (i - 0.5) / steps;
    const th = f.e0 - f.kap * s * s * 0.6 - f.kap * s * 0.4;
    D += (Math.cos(th) * f.L) / steps;
    Z += (Math.sin(th) * f.L) / steps;
    pts.push([cp * D, sp * D, Z]);
  }
  return pts;
}

/** The crown: pinnate fronds arching out from the head, leaflets in a V, lit from the upper left. */
function palmCrown(c: C, hx: number, hy: number, fronds: Frond[], seed: number, which: 'back' | 'front') {
  const LV = nrm3([-0.58, -0.48, 0.66]);
  const list = fronds.filter((f) => (which === 'back' ? Math.sin(f.phi) < 0.1 : Math.sin(f.phi) >= 0.1)).sort((f, g) => Math.sin(f.phi) - Math.sin(g.phi) || f.tier - g.tier);
  for (const f of list) {
    const cp = Math.cos(f.phi);
    const sp = Math.sin(f.phi);
    const scr = (q: number[]) => [hx + q[0], hy + q[1] * 0.5 - q[2]];
    const N = [-sp, cp, 0];
    const steps = Math.max(28, Math.round(f.L / 2));
    const pts = frondPath(f, steps);
    let bx0 = hx;
    let bx1 = hx;
    let by0 = hy;
    let by1 = hy;
    for (const q of pts) {
      const [x, y] = scr(q);
      bx0 = Math.min(bx0, x);
      bx1 = Math.max(bx1, x);
      by0 = Math.min(by0, y);
      by1 = Math.max(by1, y);
    }
    const pad = f.L * 0.24 + 6;
    layer(
      c,
      (l) => {
        // the leaflets: the far row first, then the rib, then the near row
        for (const row of [0, 1]) {
          for (let i = 2; i < steps; i++) {
            const s = i / steps;
            if (s < 0.12) continue;
            const q = pts[i];
            const q2 = pts[i + 1];
            const T = nrm3([q2[0] - q[0], q2[1] - q[1], q2[2] - q[2]]);
            // the frond's own "up": square to the rib, in its vertical plane
            const hz = Math.hypot(T[0], T[1]) || 1;
            const U = [(-T[2] * T[0]) / hz, (-T[2] * T[1]) / hz, hz];
            const prof = Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.1) / 0.92)), 0.5);
            for (const sg of [-1, 1]) {
              const ny = sg * N[1];
              if ((row === 0) !== (ny < 0)) continue;
              const hh = hash(i * 3 + (sg > 0 ? 1 : 0), f.tier * 7 + Math.round(f.phi * 10), seed);
              if (hh < 0.06) continue; // a missing leaflet here and there
              const len = f.L * 0.2 * prof * (0.8 + hh * 0.4);
              const wob = (hash(i, sg + 5, seed + 3) - 0.5) * 0.3;
              const up = 0.5 - 0.55 * s;
              const d = nrm3([T[0] * (0.62 + wob) + sg * N[0] * 0.8 + U[0] * up, T[1] * (0.62 + wob) + sg * N[1] * 0.8 + U[1] * up, T[2] * (0.62 + wob) + U[2] * up]);
              // the leaflet's upper surface and its light
              const n0 = nrm3([T[1] * d[2] - T[2] * d[1], T[2] * d[0] - T[0] * d[2], T[0] * d[1] - T[1] * d[0]]);
              const n = n0[2] < 0 ? [-n0[0], -n0[1], -n0[2]] : n0;
              const dl = n[0] * LV[0] + n[1] * LV[1] + n[2] * LV[2];
              let v = dl > 0 ? 0.34 + dl * 0.68 : 0.28;
              v += (-q[0] / f.L) * 0.12 + (q[2] / f.L) * 0.2 - (f.tier === 2 ? 0.06 : 0) - (sp < -0.3 ? 0.07 : 0);
              v += (hh - 0.5) * 0.16;
              const [x0, y0] = scr(q);
              const x1 = x0 + d[0] * len;
              const y1 = y0 + (d[1] * 0.5 - d[2]) * len;
              const tone = v * 6;
              const xm = x0 + (x1 - x0) * 0.42;
              const ym = y0 + (y1 - y0) * 0.42;
              ln(l, x0, y0, xm, ym, at(PALM, tone - 0.9));
              ln(l, xm, ym, x1, y1, at(PALM, tone + 0.3));
            }
          }
          if (row === 0) {
            // the rib: pale yellow-green, thick at the base
            for (let i = 0; i < steps; i++) {
              const [xa, ya] = scr(pts[i]);
              const [xb, yb] = scr(pts[i + 1]);
              const s = i / steps;
              const lit = cp < 0.3 || pts[i][2] > 6;
              ln(l, xa, ya, xb, yb, s < 0.3 ? (lit ? '#c8c46a' : '#8a8a40') : lit ? '#a4d060' : '#5a8a34', s < 0.3 ? 2 : 1);
            }
          }
        }
      },
      { outline: 0.58, rect: [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad] },
    );
  }
}

/** Frond set for a palm, seeded: 12–16 fronds in three tiers, each tier spread evenly round the head. */
function palmFronds(seed: number, L: number): Frond[] {
  const R0 = rng(seed * 41 + 7);
  const n = 12 + Math.floor(R0() * 5);
  const t0 = Math.round(n * 0.25);
  const t1 = Math.round(n * 0.4);
  const tiers = [t0, t1, n - t0 - t1];
  const out: Frond[] = [];
  const base = R0() * Math.PI * 2;
  tiers.forEach((m, tier) => {
    const off = base + tier * 0.9;
    for (let i = 0; i < m; i++) {
      const phi = off + (i / m) * Math.PI * 2 + (R0() - 0.5) * (2 / m);
      const e0 = tier === 0 ? 1.15 + R0() * 0.25 : tier === 1 ? 0.55 + R0() * 0.2 : 0.12 + R0() * 0.2;
      const kap = tier === 0 ? 0.7 + R0() * 0.3 : tier === 1 ? 1.15 + R0() * 0.25 : 1.2 + R0() * 0.3;
      out.push({ phi, L: L * (tier === 0 ? 0.74 : tier === 1 ? 1 : 0.92) * (0.92 + R0() * 0.16), e0, kap, tier });
    }
  });
  return out;
}

const palma: PropArt = {
  draw(p, k) {
    const vaso = (k.variant ?? 'vaso') !== 'libera';
    const W = k.w;
    const D = k.d;
    const Rn = rng(k.seed * 53 + 17);
    const [x, y] = anchor(p, W / 2, D / 2);
    const sc = 0.92 + Rn() * 0.16;
    // potted palms are stocky (a short, thick, lit trunk, as in the retouch); the free ones on the promenade tall
    const H = Math.round((vaso ? 184 : 244) * sc);
    const lean = (Rn() - 0.5) * 22;
    const L = 128 * (0.94 + Rn() * 0.12);
    const fronds = palmFronds(k.seed, L);
    const base = vaso ? 5 : 0;
    // the crown's shadow falls far to the lower right, the trunk's at its foot
    contactShadow(p.c, x + 64 * sc, y + 20, 96, 32, 0.18);
    contactShadow(p.c, x + 10, y + 4, 26, 9, 0.3);
    const ring = (a: number, b: number) => Math.hypot(a - W / 2, b - D / 2) < 0.17;
    const ahead = (a: number, b: number) => depthOf(p, a, b) > depthOf(p, W / 2, D / 2) + 0.02;
    const kinds: Kind[] = ['bloom', 'shrub', 'spiky', 'bloom', 'fern', 'bloom'];
    if (vaso) {
      // a cream stone planter the size of the footprint, a bed of flowers round the trunk
      footShadow(p, 0.06, 0.06, W - 0.06, D - 0.06, 5, 0.26);
      curbBox(p, 0.06, 0.06, W - 0.12, D - 0.12, base);
      soilBed(p, 0.17, 0.17, W - 0.17, D - 0.17, base, k.seed);
      plantBed(p, 0.17, 0.17, W - 0.17, D - 0.17, base, k.seed, (a, b) => ring(a, b) || ahead(a, b), kinds, 0.22);
    } else {
      // an iron tree grate in the paving, gravel round the trunk
      const ca = W / 2;
      const cb = D / 2;
      const gr = (r: number, col: string) => fillPoly(p.c, [p.P(ca - r, cb - r), p.P(ca + r, cb - r), p.P(ca + r, cb + r), p.P(ca - r, cb + r)], col);
      gr(0.31, CHAR[1]);
      gr(0.27, CHAR[2]);
      for (let i = 0; i < 9; i++) {
        const t = ca - 0.22 + i * 0.055;
        const [ax, ay] = p.P(t, cb - 0.24);
        const [bx, by] = p.P(t, cb + 0.24);
        ln(p.c, ax, ay, bx, by, CHAR[0]);
      }
      gr(0.13, '#6a5e52');
      const G = rng(k.seed + 3);
      for (let i = 0; i < 30; i++) {
        const [gx, gy] = p.P(ca - 0.12 + G() * 0.24, cb - 0.12 + G() * 0.24);
        px(p.c, gx, gy, G() < 0.5 ? '#a89a88' : '#4e443a', 2, 1);
      }
    }
    // the trunk (its foot lit warm by the uplight in a planter)
    palmTrunk(p.c, x, y - base * 4 + 3, H - base * 4, vaso ? 34 : 30, vaso ? 26 : 22, lean, k.seed, vaso ? 1 : 0);
    const hx = Math.round(x + lean);
    const hy = Math.round(y - H);
    if (vaso) {
      // the bed in front of the trunk, then the uplight in the soil
      plantBed(p, 0.17, 0.17, W - 0.17, D - 0.17, base, k.seed, (a, b) => ring(a, b) || !ahead(a, b), kinds, 0.22);
      const [lx, ly0] = p.P(W / 2, D / 2 + 0.2, base - 0.9);
      const ly = ly0 + 2;
      layer(
        p.c,
        (l) => {
          fillPoly(l, [[lx - 6, ly], [lx + 6, ly], [lx + 5, ly - 5], [lx - 5, ly - 5]], CHAR[2]);
          px(l, lx - 5, ly - 5, CHAR[4], 10, 1);
          ell(l, lx, ly - 6, 5, 1.8, LIGHT_M);
          px(l, lx - 3, ly - 7, LIGHT_W, 5, 1);
        },
        { outline: 0.6, rect: [lx - 9, ly - 10, lx + 9, ly + 2] },
      );
    }
    // the crown: the fronds behind, the head of leaf bases, dates, the fronds in front
    palmCrown(p.c, hx, hy, fronds, k.seed, 'back');
    layer(
      p.c,
      (l) => {
        // the head: frond bases (boots) packed round the top of the trunk
        ell(l, hx, hy + 8, 12, 9, '#6a5a2a');
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.08 + (i / 8) * 0.84);
          const bx = hx + Math.cos(a) * 8;
          const by = hy + 16 - Math.sin(a) * 3;
          const tx = hx + Math.cos(a) * 14;
          const ty = hy + 1 - Math.sin(a) * 3;
          ln(l, bx, by, tx, ty, i < 3 ? '#a89448' : i < 6 ? '#8a7a38' : '#5e5426', 3);
          ln(l, bx - 1, by, tx - 1, ty, i < 3 ? '#cdb868' : '#9a8a44', 1);
        }
      },
      { outline: 0.6, rect: [hx - 22, hy - 8, hx + 22, hy + 26] },
    );
    // bunches of dates hanging under the head
    const nb = 2 + Math.floor(Rn() * 2);
    const D0 = rng(k.seed * 7 + 2);
    layer(
      p.c,
      (l) => {
        for (let q = 0; q < nb; q++) {
          const bx = hx + (q - (nb - 1) / 2) * 13 + (D0() - 0.5) * 4;
          const by = hy + 14;
          curve(l, hx + (bx - hx) * 0.3, hy + 8, bx, by - 2, bx + (bx - hx) * 0.25, by + 5, '#d0a040', 1);
          const n = 9 + Math.floor(D0() * 5);
          for (let r = 0; r < n; r++) {
            const t = D0();
            const yy = by + 2 + t * 13;
            const xx = bx + (bx - hx) * 0.2 + (D0() - 0.5) * (9 - t * 5);
            px(l, xx - 1, yy - 1, ['#e8962e', '#c8701e', '#f2b24a'][(r + q) % 3], 3, 3);
            px(l, xx - 1, yy - 1, '#f8d080');
          }
        }
      },
      { outline: 0.45, rect: [hx - 40, hy, hx + 40, hy + 40] },
    );
    palmCrown(p.c, hx, hy, fronds, k.seed, 'front');
  },
};
palma.lights = (k) => ((k.variant ?? 'vaso') === 'libera' ? [] : [{ a: k.w / 2, b: k.d / 2 + 0.2, z: 4, r: 1.2, kind: 'lamp', color: '#ffd98a' }]);

// ── 2. stone planter without a palm: 1×1, 2×1, 2×2, 3×1 ─────
const vasoQ: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const h = 4.4;
    footShadow(p, 0.06, 0.06, W - 0.06, D - 0.06, 5, 0.24);
    curbBox(p, 0.06, 0.06, W - 0.12, D - 0.12, h);
    soilBed(p, 0.17, 0.17, W - 0.17, D - 0.17, h, k.seed);
    const R0 = rng(k.seed * 3 + 5);
    // sometimes a clipped box ball or a small spiky palm marks the middle
    const centre = R0() < 0.45 ? { a: W / 2 + (R0() - 0.5) * 0.3, b: D / 2 } : null;
    const kinds: Kind[] = R0() < 0.5 ? ['bloom', 'shrub', 'spiky', 'bloom', 'lavender', 'fern', 'bloom'] : ['bloom', 'bloom', 'ball', 'shrub', 'spiky', 'lavender'];
    const skip = centre ? (a: number, b: number) => Math.hypot(a - centre.a, (b - centre.b) * 1.2) < 0.22 : undefined;
    const pts = plantBed(p, 0.2, 0.2, W - 0.2, D - 0.2, h, k.seed, skip, kinds);
    if (centre) {
      const [cx, cy] = p.P(centre.a, centre.b, h - 0.9);
      bedPlant(p.c, cx, cy, R0() < 0.5 ? 'ball' : 'spiky', 1.35, k.seed + 77, '#e8383a');
      // the plants in front of it again, so it sits in the bed
      for (const q of pts) {
        if (depthOf(p, q.a, q.b) <= depthOf(p, centre.a, centre.b) + 0.15) continue;
        const [x, y] = p.P(q.a, q.b, h - 0.9);
        bedPlant(p.c, x, y, q.kind, q.s, Math.floor(k.seed * 31 + q.a * 97 + q.b * 53), q.col);
      }
    }
  },
};

// ── 3. modern street light: a slim round post, a warm light panel up top ──
const palo: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const H = 192 + ((k.seed % 3) - 1) * 4;
    contactShadow(p.c, x + 8, y + 3, 12, 4, 0.3);
    layer(
      p.c,
      (l) => {
        // a round foot plate, the post, a slim shadow gap, the light panel and a cap
        ell(l, x + 0.5, y - 1, 8, 3.6, CHAR[1]);
        ell(l, x - 0.5, y - 2, 7, 3, CHAR[3]);
        px(l, x - 3, y - 4, CHAR[4], 3, 1);
        cylinder(l, x, y - H, y - 2, 10, CHAR);
        const top = y - H + 6;
        const bot = y - H + 68;
        // the panel: a glowing strip round the front of the post, hottest in the middle
        for (let j = top; j < bot; j++) {
          const t = (j - top) / (bot - top);
          const end = t < 0.05 || t > 0.95;
          px(l, x - 4, j, end ? LIGHT_D : LIGHT_M, 1, 1);
          px(l, x - 3, j, end ? LIGHT_M : LIGHT_W, 4, 1);
          px(l, x + 1, j, end ? LIGHT_D : LIGHT_M, 1, 1);
          px(l, x + 2, j, LIGHT_D, 1, 1);
          px(l, x + 3, j, '#8a6040', 1, 1);
        }
        px(l, x - 2, top + 4, '#ffffff', 2, bot - top - 8);
        // the panel's frame lips and the cap
        px(l, x - 5, top - 2, CHAR[2], 10, 2);
        px(l, x - 5, top - 2, CHAR[4], 3, 1);
        px(l, x - 5, bot, CHAR[2], 10, 2);
        px(l, x - 5, bot, CHAR[4], 3, 1);
        ell(l, x, y - H - 1, 6, 2.4, CHAR[2]);
        px(l, x - 4, y - H - 2, CHAR[4], 5, 1);
        // a warm sheen on the post just under the light
        for (let j = 0; j < 16; j++) if (bayer(x, bot + 2 + j) < 1 - j / 16) px(l, x - 4, bot + 2 + j, '#7a6a5a', 2, 1);
      },
      { outline: 0.6, rect: [x - 12, y - H - 6, x + 12, y + 5] },
    );
  },
  anim(p, k) {
    // the light panel breathes: two flat warm halo steps round it (no gradient, so it rasterises anywhere)
    const u = unit(p);
    const [x, y] = anchor(p);
    const H = (192 + ((k.seed % 3) - 1) * 4) * u;
    const top = y - H + 6 * u;
    const bot = y - H + 68 * u;
    const ry = (bot - top) / 2;
    const b = 0.5 + 0.5 * Math.sin(k.t * 2.2 + k.seed);
    const c = p.c;
    c.globalAlpha = 0.07 + b * 0.04;
    pill(c, x, top + ry, 15 * u, ry + 14 * u, LIGHT_M);
    c.globalAlpha = 0.09 + b * 0.06;
    pill(c, x, top + ry, 9 * u, ry + 6 * u, LIGHT_W);
    c.globalAlpha = 1;
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 40, r: 2.6, kind: 'lamp', color: '#ffe2a8' }],
};

// ── 11. modern bench: wooden slats on dark metal frames ─────
const pancaM: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.28, W - 0.1, 0.78, 8, 0.26);
    const wood = mono(grain(WOOD), WOOD[0]);
    const metal = mono(coat(CHAR), CHAR[0]);
    const ends = [0.22, W - 0.28].sort((a, b) => depthOf(p, a, 0.5) - depthOf(p, b, 0.5));
    // the frames' back posts, the backrest slats in front of them
    for (const a of ends) lbox(p, a, 0.22, 0.06, 0.05, 0, 10.6, metal);
    for (let i = 0; i < 3; i++) lbox(p, 0.06, 0.27, W - 0.12, 0.045, 5.9 + i * 1.6, 1.15, wood);
    // legs, the seat rails and the foot bars
    for (const a of ends) {
      lbox(p, a, 0.32, 0.06, 0.48, 0, 0.45, metal);
      lbox(p, a, 0.34, 0.06, 0.05, 0, 4, metal);
      lbox(p, a, 0.72, 0.06, 0.05, 0, 4, metal);
      lbox(p, a, 0.3, 0.06, 0.5, 3.4, 0.6, metal);
    }
    // the seat: four slats with gaps
    for (let i = 0; i < 4; i++) lbox(p, 0.06, 0.32 + i * 0.115, W - 0.12, 0.095, 4.0, 0.62, wood);
  },
};

// ── 12. a bocce lawn: a cream kerb, striped turf, balls and the jack ──
const prato: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.04, 0.04, W - 0.04, D - 0.04, 2, 0.16);
    const kz = 1.6;
    const tz = 1.1;
    // the turf: mown stripes, a fine grass speckle, darker under the far kerb
    const TURF: Ramp = ['#2a6a1e', '#3e8a2a', '#4c9a32', '#56a83a', '#64b442', '#74c24a', '#8ad25a'];
    const stripe = 0.25;
    topQuad(p, 0.1, 0.1, W - 0.1, D - 0.1, tz, (u: number, v: number, x: number, y: number) => {
      const band = Math.floor(v / (stripe * 71.6)) & 1;
      let i = band ? 4 : 2.8;
      const n = hash(x, y, k.seed + 31);
      if (n < 0.12) i -= 1;
      else if (n > 0.9) i += 1;
      if (hash(x >> 1, y, k.seed + 32) < 0.05) i -= 1.4;
      if (noise2(u * 0.05, v * 0.08, k.seed) > 0.7 && bayer(x, y) > 0.5) i -= 0.5;
      return at(TURF, i);
    });
    // the kerb: four low cream walls, back to front
    const T = smooth(CREAM, 0, 0.3);
    const sides: [number, number, number, number][] = [
      [0.04, 0.04, W - 0.08, 0.1],
      [0.04, 0.04, 0.1, D - 0.08],
      [W - 0.14, 0.04, 0.1, D - 0.08],
      [0.04, D - 0.14, W - 0.08, 0.1],
    ];
    sides.sort((q, r) => depthOf(p, q[0] + q[2] / 2, q[1] + q[3] / 2) - depthOf(p, r[0] + r[2] / 2, r[1] + r[3] / 2));
    for (const [a, b, aw, bd] of sides) lbox(p, a, b, aw, bd, 0, kz, { front: T, side: T, top: T, edge: CREAM[1] });
    // bocce balls: tan and white, the little jack, each with its shadow
    const R0 = rng(k.seed * 11 + 3);
    const balls: { a: number; b: number; col: Ramp; r: number }[] = [];
    const TAN: Ramp = ['#5a3a1e', '#8a5e30', '#b8844a', '#d8a868', '#f0cc90'];
    const WHT: Ramp = ['#6a6a72', '#a8a8b0', '#d4d4d8', '#f0f0ec', '#ffffff'];
    const RED: Ramp = ['#5a1210', '#a02418', '#d83a24', '#f06a40', '#ffa070'];
    const nb = 4 + Math.floor(R0() * 3);
    for (let i = 0; i < nb; i++) balls.push({ a: 0.35 + R0() * (W - 0.7), b: 0.35 + R0() * (D - 0.7), col: i % 2 ? TAN : WHT, r: 5.5 });
    balls.push({ a: 0.5 + R0() * (W - 1), b: 0.5 + R0() * (D - 1), col: RED, r: 2.6 });
    balls.sort((q, r) => depthOf(p, q.a, q.b) - depthOf(p, r.a, r.b));
    for (const bl of balls) {
      const [bx, by0] = p.P(bl.a, bl.b, tz);
      const by = by0 - bl.r + 1;
      p.c.globalAlpha = 0.35;
      ell(p.c, bx + bl.r * 0.6, by0 + 0.5, bl.r * 1.3, bl.r * 0.5, '#1a3a12');
      p.c.globalAlpha = 1;
      ell(p.c, bx, by, bl.r + 0.6, bl.r + 0.6, bl.col[0]);
      ell(p.c, bx, by, bl.r, bl.r, bl.col[2]);
      ell(p.c, bx - bl.r * 0.2, by - bl.r * 0.25, bl.r * 0.7, bl.r * 0.65, bl.col[3]);
      px(p.c, bx - bl.r * 0.45, by - bl.r * 0.55, bl.col[4], bl.r > 3 ? 2 : 1, 1);
      if (bl.col === TAN) ln(p.c, bx - bl.r + 1, by + 1, bx + bl.r - 1, by - 1, bl.col[1]);
    }
  },
};

// ── 10. café table under a white parasol ───────────────────
/** A wooden bistro chair at (x, y): seen from the front (f = 1, its back behind) or from behind (f = -1). */
function cafeChair(l: C, x: number, y: number, f: number) {
  const W0 = '#6a3c22';
  const W1 = '#a8693a';
  const W2 = '#c4844e';
  const W3 = '#e0aa6a';
  // legs
  for (const dx of [-5, 5]) ln(l, x + dx, y, x + dx * 0.9, y - 12, W0, 2);
  for (const dx of [-3, 3]) ln(l, x + dx, y - 3, x + dx, y - 12, W1);
  // the seat
  fillPoly(l, [[x - 7, y - 13], [x + 7, y - 13], [x + 6, y - 17], [x - 6, y - 17]], W2);
  px(l, x - 6, y - 17, W3, 12, 1);
  px(l, x - 7, y - 13, W0, 14, 1);
  // the slatted back
  const bx = x + f * 1;
  const by = f > 0 ? y - 17 : y - 13;
  const c0 = f > 0 ? W1 : W2;
  ln(l, bx - 6, by, bx - 6, by - 15, W0, 2);
  ln(l, bx + 6, by, bx + 6, by - 15, W0, 2);
  for (let i = 0; i < 3; i++) px(l, bx - 6, by - 6 - i * 4, i === 2 ? W3 : c0, 13, 2);
}

const tavoloM: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, k.w / 2, k.d / 2);
    const Rn = rng(k.seed * 3 + 7);
    contactShadow(p.c, x + 26, y + 8, 50, 18, 0.18);
    contactShadow(p.c, x + 4, y + 2, 26, 9, 0.22);
    // chairs round the table (two or three), behind ones first
    const n = 2 + (Rn() < 0.55 ? 1 : 0);
    const off = Rn() * Math.PI * 2;
    const chairs = Array.from({ length: n }, (_, i) => off + (i / n) * Math.PI * 2 + (Rn() - 0.5) * 0.4).map((t) => ({ t, x: x + Math.cos(t) * 21, y: y + Math.sin(t) * 10 }));
    const behind = chairs.filter((q) => Math.sin(q.t) < 0).sort((q, r) => q.y - r.y);
    const before = chairs.filter((q) => Math.sin(q.t) >= 0).sort((q, r) => q.y - r.y);
    layer(p.c, (l) => behind.forEach((q) => cafeChair(l, q.x, q.y, 1)), { outline: 0.6, rect: [x - 40, y - 50, x + 40, y + 16] });
    layer(
      p.c,
      (l) => {
        // the table: a cast foot, a slim column, a round white top; cups and a little vase
        ell(l, x, y, 7, 3, CHAR[1]);
        px(l, x - 1, y - 28, CHAR[3], 3, 28);
        px(l, x - 1, y - 28, CHAR[4], 1, 28);
        ell(l, x, y - 29, 15, 7.5, '#b8b4ac');
        ell(l, x, y - 30.5, 15, 7.5, '#f6f4ee');
        ell(l, x - 4, y - 32, 8, 3, '#ffffff');
        px(l, x - 8, y - 34, '#fbf8f2', 4, 3);
        px(l, x - 7, y - 35, '#5a3420', 2, 1);
        px(l, x + 4, y - 33, '#fbf8f2', 4, 3);
        px(l, x + 5, y - 34, '#5a3420', 2, 1);
        px(l, x - 1, y - 38, '#d8eef4', 3, 6);
        dotFruit(l, x, y - 40, ['#e8577a', '#f6d040', '#f07ab0'][k.seed % 3], 3);
      },
      { outline: 0.6, rect: [x - 20, y - 46, x + 20, y + 6] },
    );
    layer(p.c, (l) => before.forEach((q) => cafeChair(l, q.x, q.y, -1)), { outline: 0.6, rect: [x - 40, y - 40, x + 40, y + 20] });
    // the parasol: a slim pole, eight white panels with seams, a scalloped hem, a finial
    layer(
      p.c,
      (l) => {
        const rimY = y - 84;
        const apexY = rimY - 24;
        const R0 = 58;
        px(l, x - 1, apexY, '#d8d4cc', 3, y - 30 - apexY);
        px(l, x - 1, apexY, '#f4f2ec', 1, y - 30 - apexY);
        // the underside showing under the front hem
        const rim: [number, number][] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          rim.push([x + Math.cos(a) * R0, rimY + Math.sin(a) * R0 * 0.48]);
        }
        for (let i = 0; i < 8; i++) {
          const [ax, ay] = rim[i];
          const [bx, by] = rim[(i + 1) % 8];
          const mid = (i + 0.5) / 8 * Math.PI * 2 + Math.PI / 8;
          // panels facing the upper left catch the sun
          const lit = Math.cos(mid - 3.75);
          const col = lit > 0.5 ? '#fffdf6' : lit > -0.1 ? '#f4efe2' : lit > -0.6 ? '#e2dac8' : '#cfc6b2';
          fillPoly(l, [[x, apexY], [ax, ay], [bx, by]], col);
          ln(l, x, apexY, ax, ay, '#c8bea8');
          // the scalloped hem between the rib tips
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          if (my > rimY - 6) fillPoly(l, [[ax, ay], [bx, by], [mx, my + 4]], lit > -0.1 ? '#ece6d6' : '#d6ccb8');
        }
        // a finial and the crown vent
        ell(l, x, apexY + 1, 6, 2.6, '#e8e2d2');
        ell(l, x, apexY - 3, 3, 3, '#c8bea8');
        px(l, x - 1, apexY - 5, '#ffffff', 2, 1);
      },
      { outline: 0.55, rect: [x - 66, y - 122, x + 66, y - 26] },
    );
  },
};

// ── 9. green kiosk: posters on its sides, a serving window, a lit roof edge ──
const KIOSK: Ramp = ['#0e2a1a', '#153a24', '#1c4e30', '#24663e', '#2e7e4c', '#3f9660'];
const kioskPoster = (p: PropPainter, pl: ReturnType<typeof front>, u0: number, u1: number, z0: number, z1: number, seed: number) => {
  const R0 = rng(seed);
  const cols = ['#e8383a', '#f6d040', '#3f8ad8', '#f07ab0', '#3fb68b', '#f59a3a', '#8a5ad8', '#fbf7ee'];
  const nu = Math.max(1, Math.round((u1 - u0) / 0.36));
  const nz = 3;
  const du = (u1 - u0) / nu;
  const dz = (z1 - z0) / nz;
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nz; j++) {
      const a = u0 + i * du + 0.025;
      const b = a + du - 0.05;
      const zz = z0 + j * dz + 0.5;
      const c = cols[Math.floor(R0() * cols.length)];
      const cc = pl.light ? c : darken(c, 0.18);
      pq(p, pl, a, b, zz, zz + dz - 1, cc);
      // a cover: a pale masthead, a picture block, a few lines of text
      pq(p, pl, a + 0.02, b - 0.02, zz + dz - 2.6, zz + dz - 1.4, pl.light ? '#fbf8f2' : '#d8d4cc');
      pq(p, pl, a + 0.03, a + (b - a) * 0.6, zz + 1, zz + dz - 3.6, lighten(cc, 0.35));
      pq(p, pl, a + (b - a) * 0.66, b - 0.03, zz + 1.4, zz + 1.9, '#2a2a30');
      pq(p, pl, a + (b - a) * 0.66, b - 0.03, zz + 2.6, zz + 3.1, '#2a2a30');
    }
};

const chioscoM: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.15, 0.15, W - 0.15, D - 0.15, 30, 0.28);
    const g = coat(KIOSK);
    const a0 = 0.26;
    const b0 = 0.26;
    const aw = W - 0.52;
    const bd = D - 0.52;
    const H = 23;
    lbox(p, a0 - 0.03, b0 - 0.03, aw + 0.06, bd + 0.06, 0, 0.8, mono(coat(CHAR), CHAR[0]));
    lbox(p, a0, b0, aw, bd, 0.8, H - 0.8, { front: g, side: g, top: g, edge: KIOSK[0] });
    const F = front(p, b0 + bd);
    const sa = nearA(p, a0 + aw) === 0 ? a0 : a0 + aw;
    const S = side(p, sa);
    // corner posts, a little lighter
    for (const u of [a0 + 0.04, a0 + aw - 0.04]) pq(p, F, u - 0.035, u + 0.035, 0.8, H, KIOSK[F.light ? 4 : 2]);
    for (const u of [b0 + 0.04, b0 + bd - 0.04]) pq(p, S, u - 0.035, u + 0.035, 0.8, H, KIOSK[S.light ? 4 : 2]);
    // the front: magazines on the left, the serving window on the right
    const split = a0 + aw * 0.55;
    kioskPoster(p, F, a0 + 0.1, split, 3, 20, k.seed * 3 + 1);
    pq(p, F, split + 0.06, a0 + aw - 0.1, 9, 19.5, KIOSK[0]);
    pt(p, F, split + 0.09, a0 + aw - 0.13, 9.5, 19, (u: number, v: number, x: number, y: number) => {
      const d = (u * 0.8 + v) % 26;
      let i = 1.3;
      if (d > 4 && d < 8) i += 2;
      if (v < 6) i -= 0.6;
      if (hash(x, y, 7) < 0.03) i += 1;
      return at(GLASS, i);
    });
    // a shopkeeper's warm light inside, a little shelf and a bell
    pq(p, F, split + 0.12, split + 0.3, 10, 13.5, '#f2c46a');
    pq(p, F, split + 0.04, a0 + aw - 0.06, 8.2, 9, KIOSK[F.light ? 5 : 3]);
    pq(p, F, split + 0.04, a0 + aw - 0.06, 7.6, 8.2, KIOSK[1]);
    // the side: a full rack of covers
    kioskPoster(p, S, b0 + 0.1, b0 + bd - 0.1, 3, 20, k.seed * 5 + 2);
    // the roof: a flat overhanging slab, a lit strip round its edge, a low hip on top
    const R = coat(KIOSK);
    lbox(p, 0.06, 0.06, W - 0.12, D - 0.12, H, 2.4, { front: R, side: R, top: R, edge: KIOSK[0] });
    const RF = front(p, D - 0.06);
    const RS = side(p, nearA(p, W - 0.06) === 0 ? 0.06 : W - 0.06);
    pq(p, RF, 0.06, W - 0.06, H, H + 0.5, LIGHT_M);
    pq(p, RS, 0.06, D - 0.06, H, H + 0.5, LIGHT_D);
    pq(p, RF, 0.1, W - 0.1, H + 0.12, H + 0.38, LIGHT_W);
    // the kiosk's name on the fascia
    pq(p, RF, W / 2 - 0.42, W / 2 + 0.42, H + 0.75, H + 2.15, RF.light ? '#fbf8f2' : '#d8d4cc');
    pq(p, RF, W / 2 - 0.32, W / 2 + 0.1, H + 1.5, H + 1.85, '#1c4e30');
    pq(p, RF, W / 2 - 0.32, W / 2 + 0.3, H + 1.0, H + 1.25, '#e8383a');
    const [tx, ty] = p.P(W / 2, D / 2, H + 2.4);
    const cs = [p.P(0.12, 0.12, H + 2.4), p.P(W - 0.12, 0.12, H + 2.4), p.P(W - 0.12, D - 0.12, H + 2.4), p.P(0.12, D - 0.12, H + 2.4)];
    // the corners by where they fall on screen, whatever the rotation
    const top = cs.reduce((q, r) => (r[1] < q[1] ? r : q));
    const bot = cs.reduce((q, r) => (r[1] > q[1] ? r : q));
    const lft = cs.reduce((q, r) => (r[0] < q[0] ? r : q));
    const rgt = cs.reduce((q, r) => (r[0] > q[0] ? r : q));
    const apex: [number, number] = [tx, ty - 9];
    layer(
      p.c,
      (l) => {
        // a low hip roof: the sun on the two faces toward the upper left, the right ones in shade
        fillPoly(l, [lft, top, apex], KIOSK[5]);
        fillPoly(l, [top, rgt, apex], KIOSK[3]);
        fillPoly(l, [lft, apex, bot], KIOSK[4]);
        fillPoly(l, [apex, rgt, bot], KIOSK[2]);
        ln(l, bot[0], bot[1], apex[0], apex[1], KIOSK[1]);
        ln(l, lft[0], lft[1], apex[0], apex[1], '#5aae72');
      },
      { outline: 0.6, rect: [lft[0] - 4, apex[1] - 10, rgt[0] + 4, bot[1] + 4] },
    );
  },
  lights: (k) => [{ a: k.w / 2, b: k.d - 0.05, z: 22, r: 1.4, kind: 'lamp', color: '#ffe6b0' }],
};

// ── 5. ring sculpture: an upright torus (or two) on a cream plinth ──
/** Point-sampled tori with a z-buffer: upright rings in the vertical plane at `yaw`, lit from the upper left with a specular sheen. */
function rings(c: C, cx: number, cy: number, list: { R: number; r: number; yaw: number; dz: number }[], ramp: Ramp, seed: number) {
  const pad = 6;
  const ext = Math.max(...list.map((q) => q.R + q.r)) + pad;
  const x0 = Math.floor(cx - ext);
  const y0 = Math.floor(cy - ext * 2 - 20);
  const Wd = Math.ceil(ext * 2);
  const Ht = Math.ceil(ext * 3 + 40);
  const zb = new Float32Array(Wd * Ht).fill(-1e9);
  const vb = new Float32Array(Wd * Ht);
  const LV = nrm3([-0.6, -0.42, 0.68]);
  const V = [0, 0.866, 0.5];
  const Hh = nrm3([LV[0] + V[0], LV[1] + V[1], LV[2] + V[2]]);
  for (const q of list) {
    const h = [Math.cos(q.yaw), Math.sin(q.yaw), 0];
    const m = [-Math.sin(q.yaw), Math.cos(q.yaw), 0];
    const nT = Math.ceil(q.R * 2 * Math.PI * 2.2);
    const nP = Math.ceil(q.r * 2 * Math.PI * 2.4);
    for (let i = 0; i < nT; i++) {
      const th = (i / nT) * Math.PI * 2;
      const e = [Math.cos(th) * h[0], Math.cos(th) * h[1], Math.sin(th)];
      for (let j = 0; j < nP; j++) {
        const ps = (j / nP) * Math.PI * 2;
        const n = [Math.cos(ps) * e[0] + Math.sin(ps) * m[0], Math.cos(ps) * e[1] + Math.sin(ps) * m[1], Math.cos(ps) * e[2]];
        if (n[1] * V[1] + n[2] * V[2] < -0.05) continue;
        const X = e[0] * q.R + n[0] * q.r;
        const Y = e[1] * q.R + n[1] * q.r;
        const Z = e[2] * q.R + n[2] * q.r + q.R + q.r + q.dz;
        const sx = Math.round(cx + X) - x0;
        const sy = Math.round(cy + Y * 0.5 - Z) - y0;
        if (sx < 0 || sy < 0 || sx >= Wd || sy >= Ht) continue;
        const dep = Y * 0.866 + Z * 0.5;
        const k = sy * Wd + sx;
        if (dep <= zb[k]) continue;
        zb[k] = dep;
        const dif = Math.max(0, n[0] * LV[0] + n[1] * LV[1] + n[2] * LV[2]);
        const sp = Math.pow(Math.max(0, n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]), 24);
        // brushed: a faint streak along the ring
        const br = (hash(Math.round(th * 40), Math.round(ps * 3), seed) - 0.5) * 0.08;
        vb[k] = 0.12 + dif * 0.62 + sp * 0.75 + br;
      }
    }
  }
  const N = ramp.length;
  layer(
    c,
    (l) => {
      for (let y = 0; y < Ht; y++)
        for (let x = 0; x < Wd; x++) {
          const k = y * Wd + x;
          if (zb[k] < -1e8) continue;
          const t = vb[k] * (N - 1) + (bayer(x + x0, y + y0) - 0.5) * 0.6;
          px(l, x + x0, y + y0, ramp[Math.max(0, Math.min(N - 1, Math.round(t)))]);
        }
    },
    { outline: 0.62, rect: [x0, y0, x0 + Wd, y0 + Ht] },
  );
}

const scultura: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.12, 0.12, W - 0.12, D - 0.12, 28, 0.24);
    // a two-step cream plinth with a dark granite block for the ring
    const T = smooth(CREAM, 0, 0.2);
    const T2 = smooth(CREAM, 22, 0);
    lbox(p, 0.1, 0.1, W - 0.2, D - 0.2, 0, 1.4, { front: T, side: T, top: T, edge: CREAM[1] });
    lbox(p, 0.34, 0.34, W - 0.68, D - 0.68, 1.4, 5, { front: T2, side: T2, top: T, edge: CREAM[1] });
    lbox(p, 0.3, 0.3, W - 0.6, D - 0.6, 6.4, 0.9, { front: T, side: T, top: T, edge: CREAM[1] });
    const G = coat(CHAR);
    lbox(p, W / 2 - 0.24, D / 2 - 0.2, 0.48, 0.4, 7.3, 1.8, { front: G, side: G, top: G, edge: CHAR[0] });
    // a small brass plaque on the plinth
    const F = front(p, D - 0.34);
    pq(p, F, W / 2 - 0.3, W / 2 + 0.3, 2.6, 4.6, '#8a6a2a');
    pq(p, F, W / 2 - 0.26, W / 2 + 0.26, 2.9, 4.3, '#d8b860');
    pq(p, F, W / 2 - 0.2, W / 2 + 0.2, 3.5, 3.7, '#8a6a2a');
    const [x, y] = p.P(W / 2, D / 2, 9.1);
    const steel = k.variant === 'acciaio';
    const ramp: Ramp = steel ? ['#2a3038', '#47505c', '#6c7684', '#94a0ae', '#bcc6d0', '#e2e8ee', '#ffffff'] : ['#4a3418', '#6e5228', '#9a7a42', '#c4a062', '#e2c68c', '#f6e2b4', '#fff8e6'];
    const yaw = 0.3 + ((k.seed % 5) - 2) * 0.06;
    rings(p.c, x, y, [
      { R: 46, r: 8.5, yaw, dz: 0 },
      { R: 33, r: 6, yaw: yaw + 0.95, dz: 13 },
    ], ramp, k.seed);
  },
};

// ── 4. square fountain: a cream basin, turquoise water, dancing jets ──
const WATER: Ramp = ['#0b5470', '#157f9e', '#1c93b2', '#22a7c2', '#4ccbe0', '#9be6f0', '#e0fbff'];

/** The fountain's jets: a tall one in the middle, four smaller round it (local a, b; height and width in px at k = 4). */
const fountainJets = (W: number, D: number) => {
  const o = Math.min(W, D) * 0.2;
  return [
    { a: W / 2, b: D / 2, h: 136, w: 9, big: true },
    { a: W / 2 - o * 1.25, b: D / 2, h: 84, w: 5, big: false },
    { a: W / 2 + o * 1.25, b: D / 2, h: 84, w: 5, big: false },
    { a: W / 2, b: D / 2 - o * 1.25, h: 84, w: 5, big: false },
    { a: W / 2, b: D / 2 + o * 1.25, h: 84, w: 5, big: false },
  ];
};

/** A jet's column of water, one colour per pixel strip across it: the lit left side white, the right side cyan, rimmed. */
const jetTone = (i: number, w: number) => (i === 0 ? '#d4f4fb' : i === w - 1 ? '#5cbcd6' : i === w - 2 && w > 3 ? '#a2e2ef' : i < w * 0.55 ? '#ffffff' : '#e2f7fb');
/** Underwater lamps: one in the middle of each inner wall. */
const fountainLamps = (W: number, D: number) => [
  { a: W / 2, b: 0.8 },
  { a: W / 2, b: D - 0.8 },
  { a: 0.8, b: D / 2 },
  { a: W - 0.8, b: D / 2 },
];
const FZ = { step: 1, wall: 5, top: 6.4, water: 5 };

const fontanaQ: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const IN = 0.62;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 8, 0.24);
    // the low outer step and the basin wall, an LED strip glowing under the coping
    const S0 = smooth(CREAM, 0, -0.3);
    const S1 = smooth(CREAM, 34, 0);
    lbox(p, 0.1, 0.1, W - 0.2, D - 0.2, 0, FZ.step, { front: S0, side: S0, top: S0, edge: CREAM[1] });
    lbox(p, 0.3, 0.3, W - 0.6, D - 0.6, FZ.step, FZ.wall - FZ.step, { front: S1, side: S1, top: S1, edge: CREAM[1] });
    const F = front(p, D - 0.3);
    const S = side(p, nearA(p, W - 0.3) === 0 ? 0.3 : W - 0.3);
    for (const pl of [F, S]) {
      const [u0, u1] = pl === F ? [0.3, W - 0.3] : [0.3, D - 0.3];
      // the strip washes the wall below it with warm light
      pq(p, pl, u0, u1, FZ.step + 0.2, FZ.wall - 1.5, pl.light ? '#f6e6c4' : '#e2cfa8');
      pt(p, pl, u0, u1, FZ.step + 0.2, FZ.wall - 1.5, (_u: number, v: number, x: number, y: number) => (bayer(x, y) * 12 < v ? (pl.light ? '#fff0cc' : '#f0dcb0') : null));
      pq(p, pl, u0, u1, FZ.wall - 1.5, FZ.wall - 0.7, LIGHT_D);
      pq(p, pl, u0 + 0.02, u1 - 0.02, FZ.wall - 1.35, FZ.wall - 0.85, pl.light ? LIGHT_W : LIGHT_M);
    }
    // warm light spilling on the step under the strip
    const Rs = rng(k.seed + 9);
    for (let i = 0; i < 260; i++) {
      const t = Rs();
      const onFront = Rs() < 0.5;
      const [sx, sy] = onFront ? p.P(0.3 + t * (W - 0.6), D - 0.3 + Rs() * 0.12, FZ.step) : p.P(nearA(p, W - 0.3) === 0 ? 0.3 - Rs() * 0.12 : W - 0.3 + Rs() * 0.12, 0.3 + t * (D - 0.6), FZ.step);
      px(p.c, sx, sy, Rs() < 0.5 ? '#fff2cf' : '#fbe6b4');
    }
    // the water: ripples round the jets, caustic threads, a shadow under the far walls, lamps glowing
    const jets = fountainJets(W, D);
    const lamps = fountainLamps(W, D);
    const T = Math.hypot(64, 32) * (p.k / 4);
    const farA = p.rot ? W - IN : IN;
    topQuad(p, IN, IN, W - IN, D - IN, FZ.water, (u: number, v: number, x: number, y: number) => {
      const A = IN + u / T;
      const B = D - IN - v / T;
      let i = 3;
      const dFar = Math.min(B - IN, Math.abs(A - farA));
      if (dFar < 0.1) i -= 1.4;
      else if (dFar < 0.2) i -= 0.6;
      const n1 = noise2(A * 7 + k.seed, B * 7, 3);
      const n2 = noise2(A * 13, B * 13 + k.seed, 4);
      if (Math.abs(n1 - 0.5) < 0.03 || Math.abs(n2 - 0.5) < 0.018) i += 1.6;
      // a broad sky reflection toward the near walls
      if ((W - A) + (D - B) < 1.1 && bayer(x, y) > 0.55) i += 0.8;
      for (const j of jets) {
        const r = Math.hypot((A - j.a) * 1.0, (B - j.b) * 1.0);
        const rr = j.big ? 0.42 : 0.26;
        if (r < rr && Math.abs(Math.sin(r * 48)) > 0.86) i += 1.1;
      }
      for (const L of lamps) {
        const r = Math.hypot(A - L.a, B - L.b);
        if (r < 0.07) i = 6;
        else if (r < 0.2 && bayer(x, y) < 1 - r / 0.2) i += 1.6;
      }
      if (hash(x, y, 77) < 0.012) i += 1;
      return at(WATER, i + (bayer(x, y) - 0.5) * 0.4);
    });
    // a few coins on the bottom
    for (let i = 0; i < 9; i++) {
      const [cx, cy] = p.P(IN + 0.2 + Rs() * (W - 2 * IN - 0.4), IN + 0.2 + Rs() * (D - 2 * IN - 0.4), FZ.water);
      px(p.c, cx, cy, '#c8962a', 2, 1);
      px(p.c, cx, cy - 1, '#f2d26a');
    }
    // the coping: four moulded strips round the water (their inner faces are the wet inner walls)
    const C0 = smooth(CREAM, 30, 0.5);
    const strips: [number, number, number, number][] = [
      [0.24, 0.24, W - 0.48, IN - 0.24],
      [0.24, D - IN, W - 0.48, IN - 0.24],
      [0.24, IN, IN - 0.24, D - 2 * IN],
      [W - IN, IN, IN - 0.24, D - 2 * IN],
    ];
    strips.sort((q, r) => depthOf(p, q[0] + q[2] / 2, q[1] + q[3] / 2) - depthOf(p, r[0] + r[2] / 2, r[1] + r[3] / 2));
    for (const [a, b, aw, bd] of strips) lbox(p, a, b, aw, bd, FZ.water, FZ.top - FZ.water, { front: C0, side: C0, top: C0, edge: CREAM[1] });
    // the wet line along the far inner walls
    const fb = front(p, IN);
    pq(p, fb, IN, W - IN, FZ.water, FZ.water + 0.35, '#5f8f92');
    const fa = side(p, farA);
    pq(p, fa, IN, D - IN, FZ.water, FZ.water + 0.35, '#4f7c80');
    // the jets' nozzles and the foam at their feet (the water itself is animated)
    for (const j of jets.sort((q, r) => depthOf(p, q.a, q.b) - depthOf(p, r.a, r.b))) {
      const [jx, jy] = p.P(j.a, j.b, FZ.water);
      const rx = j.big ? 14 : 8;
      if (j.big) {
        // a round stone boss the centre jet rises from
        ell(p.c, jx, jy - 3, 11, 5, CREAM[2]);
        ell(p.c, jx, jy - 5, 11, 5, CREAM[4]);
        ell(p.c, jx - 2, jy - 6, 6, 2, CREAM[5]);
      }
      const fy = jy - (j.big ? 5 : 0);
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        const rr = 1 + (hash(a, j.big ? 1 : 2, k.seed) - 0.5) * 0.3;
        px(p.c, jx + Math.cos(ang) * rx * rr, fy + Math.sin(ang) * rx * 0.48 * rr, a % 3 ? '#ffffff' : '#c8f2f8', 2, 1);
      }
      ell(p.c, jx, fy, rx * 0.55, rx * 0.25, '#e8fbff');
      ell(p.c, jx, fy - 1, 3, 1.6, CHAR[3]);
      px(p.c, jx - 1, fy - 2, '#d8dee6', 2, 1);
    }
  },
  anim(p, k) {
    // Each jet: rings spreading on the water, a foam mound at its foot, a pale veil of falling water
    // round a shaded rising column, a crown at the top curling over into a bell of streams (a bead
    // running down each) and a few loose drops. Merged runs keep it to a few hundred rects a frame.
    const u = unit(p);
    const q = (n: number) => Math.max(1, Math.round(n * u));
    const c = p.c;
    const fr = Math.floor(k.t * 12);
    const jets = fountainJets(k.w, k.d).sort((a, b) => depthOf(p, a.a, a.b) - depthOf(p, b.a, b.b));
    jets.forEach((j, n) => {
      const [fx, fy] = p.P(j.a, j.b, FZ.water);
      const jx = Math.round(fx);
      const wy = Math.round(fy);
      // the centre jet leaves the top of its stone boss
      const lift = j.big ? Math.round(5 * u) : 0;
      const base = wy - lift;
      const H = Math.round(j.h * u * (0.95 + 0.05 * Math.sin(k.t * 3.1 + n * 1.7)));
      const top = base - H;
      const width = (y: number) => Math.max(q(2), Math.round(j.w * u * (1 - 0.45 * (y / H))));
      const veil = (y: number) => (width(y) >> 1) + Math.round((j.big ? 4 : 2.2) * u * (0.35 + 0.65 * (1 - y / H)));
      // rings spreading on the water
      c.globalAlpha = 0.4;
      for (let r = 0; r < (j.big ? 2 : 1); r++) {
        const t = (k.t * 0.7 + r * 0.5 + n * 0.21) % 1;
        const rx = ((j.big ? 14 : 6) + t * (j.big ? 18 : 10)) * u;
        const m = j.big ? 16 : 10;
        for (let a = 0; a < m; a++) {
          const ang = ((a + 0.5 * r) / m) * Math.PI * 2;
          px(c, jx + Math.cos(ang) * rx, wy + Math.sin(ang) * rx * 0.48, '#e8fafc', q(2), q(1));
        }
      }
      c.globalAlpha = 1;
      // a stepped mound of foam where the jet leaves the water (or the boss)
      const mw = Math.round((j.w * 0.5 + 4) * u);
      px(c, jx - mw, base - q(1), '#dff8fc', mw * 2 + 1, q(1));
      px(c, jx - mw + q(2), base - q(2), '#eefcff', mw * 2 + 1 - q(4), q(1));
      px(c, jx - mw + q(3), base - q(3), '#ffffff', mw * 2 + 1 - q(6), q(1));
      // the bell: streams curling out of the crown and falling back round the column, a bead of
      // water running down each, the tips flickering into spray; loose drops fly further
      const r0 = j.w * 0.5 * u;
      const Rb = (j.big ? 15 : 8) * u;
      const Lb = Math.min(H * 0.55, (j.big ? 64 : 34) * u);
      const streams = j.big ? [0.39, 1.18, 1.96, 2.75, 3.53, 5.89] : [0.39, 2.75];
      const bellAt = (ca: number, sa: number, s: number): [number, number] => {
        const r = r0 + (Rb - r0) * (2 * s - s * s);
        return [jx + ca * r, top + Lb * s * s + sa * r];
      };
      const tone = (s: number) => (s < 0.55 ? '#e2f7fb' : '#a8e4f0');
      const nd = j.big ? 12 : 4;
      const R = (j.big ? 30 : 13) * u;
      const spray = (behind: boolean) => {
        for (const ang of streams) {
          if (Math.sin(ang) < 0 !== behind) continue;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang) * 0.48;
          const end = hash(Math.round(ang * 10), fr, n + 3) < 0.35 ? 0.8 : 1;
          stroke(c, (s) => bellAt(ca, sa, s * end), (s) => tone(s * end), Lb + Rb);
          const [bx, by] = bellAt(ca, sa, (k.t * (j.big ? 0.9 : 1.3) + ang * 0.37) % 1);
          px(c, bx - (q(2) >> 1), by, '#ffffff', q(2), q(2));
        }
        for (let i = 0; i < nd; i++) {
          const h1 = hash(i, n, 61);
          const ang = (i / nd) * Math.PI * 2 + (h1 - 0.5) * 0.5;
          if (Math.sin(ang) < 0 !== behind) continue;
          const t = (k.t * (j.big ? 0.8 : 1.2) + hash(i, n, 62)) % 1;
          const r = R * (0.5 + 0.5 * h1) * t;
          const h = (H + lift) * (1 + 0.2 * t - 1.2 * t * t);
          const x = jx + Math.cos(ang) * r;
          const gy = wy + Math.sin(ang) * r * 0.48;
          px(c, x, gy - h, t < 0.5 ? '#ffffff' : '#c4eef7', q(t < 0.35 ? 2 : 1), q(2));
          // a plink where it lands
          if (t > 0.9) px(c, x - q(1), gy, '#ffffff', q(3), q(1));
        }
      };
      spray(true);
      // the falling water round the rising core: a pale veil, wider toward the foot
      c.globalAlpha = 0.38;
      c.fillStyle = '#eafcff';
      for (let y = q(4); y < H; ) {
        const e = veil(y);
        let y2 = y + 1;
        while (y2 < H && veil(y2) === e) y2++;
        c.fillRect(jx - e, base - y2, e * 2 + 1, y2 - y);
        y = y2;
      }
      c.globalAlpha = 1;
      // the column, in bands of equal width, each band in runs of one tone
      for (let y = 0; y < H; ) {
        const w = width(y);
        let y2 = y + 1;
        while (y2 < H && width(y2) === w) y2++;
        const x0 = jx - (w >> 1);
        for (let i = 0; i < w; ) {
          const col = jetTone(i, w);
          let i2 = i + 1;
          while (i2 < w && jetTone(i2, w) === col) i2++;
          px(c, x0 + i, base - y2, col, i2 - i, y2 - y);
          i = i2;
        }
        y = y2;
      }
      // froth sliding down the veil's edges; on the big jet, pale dashes rising up the core
      const slide = (j.big ? 12 : 16) * u;
      for (let m = 0; m < H / slide - 1; m++) {
        const yy = (((m * slide - k.t * 70 * u) % H) + H) % H;
        if (yy < q(4)) continue;
        const e = veil(yy);
        px(c, m % 2 ? jx + e : jx - e, base - yy, m % 3 ? '#ffffff' : '#d4f4fb', q(1), q(2));
      }
      if (j.big)
        for (let m = 0; m < H / (12 * u) - 1; m++) {
          const yy = (m * 12 * u + k.t * 80 * u) % H;
          const w = width(yy);
          px(c, jx - (w >> 1) + 1, base - yy - 1, '#bfeaf4', Math.max(1, (w >> 1) - 1), 1);
        }
      // the crown: the water slows, spreads and breaks into spray
      const cw = Math.round((j.w * 0.5 + 1.5) * u);
      px(c, jx - cw, top, '#ffffff', cw * 2 + 1, q(2));
      px(c, jx - cw + q(1), top - q(1), '#ffffff', cw * 2 + 1 - q(2), q(1));
      const s = j.big ? 1 : 0.6;
      for (let i = 0; i < (j.big ? 10 : 4); i++) {
        const h1 = hash(i, fr, n * 7 + 71);
        const h2 = hash(i, fr, n * 7 + 72);
        px(c, jx + (h1 - 0.5) * 20 * s * u, top - h2 * h2 * 7 * s * u, h2 < 0.6 ? '#ffffff' : '#d4f4fa', q(1), q(1));
      }
      // foam churning at the foot (on the boss for the centre jet)
      for (let i = 0; i < (j.big ? 8 : 4); i++) {
        const h1 = hash(i, fr, n * 5 + 81);
        const h2 = hash(i, fr, n * 5 + 82);
        const ang = h1 * Math.PI * 2;
        const rr = (j.big ? 5 + h2 * 5 : 2 + h2 * 5) * u;
        px(c, jx + Math.cos(ang) * rr, base + Math.sin(ang) * rr * 0.48 - q(1), h2 < 0.55 ? '#ffffff' : '#c8f2f8', q(2), q(1));
      }
      spray(false);
    });
  },
  lights: (k) => fountainLamps(k.w, k.d).map((L) => ({ a: L.a, b: L.b, z: FZ.water, r: 2, kind: 'lamp' as const, color: '#c8f4ff' })),
};

// ── 6. market stall: a striped awning on four posts, a wooden counter, goods ──
const STALL: Record<string, [string, string]> = {
  rosa: ['#f06aa8', '#fff6fa'],
  rossa: ['#e0362e', '#fff8f2'],
  blu: ['#203c80', '#f8faff'],
  verde: ['#1a8a48', '#f6fbf4'],
};
const GOODS = ['frutta', 'fiori', 'artigianato', 'tessuti'] as const;

const bancarellaM: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const v = k.variant && STALL[k.variant] ? k.variant : (['rosa', 'rossa', 'blu', 'verde'] as const)[k.seed % 4];
    const [col, white] = STALL[v];
    const goods = GOODS[(Object.keys(STALL).indexOf(v) + k.seed) % 4];
    footShadow(p, 0.06, 0.12, W - 0.06, D - 0.04, 22, 0.24);
    const wood = grain(WOOD);
    const posts = mono(coat(CHAR), CHAR[0]);
    const zc = 8.6;
    // the back posts (the counter covers their feet)
    for (const a of [0.1, W - 0.16]) lbox(p, a, 0.18, 0.06, 0.06, 0, 27.4, posts);
    // the counter: a plank cabinet, a top that overhangs, a painted band in the stall's colour
    lbox(p, 0.14, 0.26, W - 0.28, 0.62, 0, zc - 0.5, { front: boards4(WOOD, 9, false), side: boards4(WOOD, 9, false), top: wood, edge: WOOD[0] });
    lbox(p, 0.1, 0.22, W - 0.2, 0.7, zc - 0.5, 0.5, { front: wood, side: wood, top: wood, edge: WOOD[0] });
    const F = front(p, 0.88);
    pq(p, F, 0.14, W - 0.14, zc - 2.4, zc - 0.6, F.light ? col : darken(col, 0.2));
    pq(p, F, 0.14, W - 0.14, zc - 2.4, zc - 2.1, darken(col, 0.35));
    // a little sign on the counter's front
    const sa = W / 2 - 0.36;
    pq(p, F, sa - 0.02, sa + 0.74, 2.1, 5.3, WOOD[0]);
    pq(p, F, sa, sa + 0.72, 2.3, 5.1, F.light ? '#fbf6ea' : '#dcd4c2');
    pq(p, F, sa + 0.08, sa + 0.5, 4.0, 4.5, darken(col, 0.1));
    pq(p, F, sa + 0.08, sa + 0.64, 2.9, 3.3, '#3a3a40');
    const R0 = rng(k.seed * 5 + 1);
    // the goods on top: two full rows, the back row first
    const top = zc;
    const n = Math.max(3, Math.round((W - 0.4) / 0.3));
    const spots: { a: number; b: number; i: number }[] = [];
    for (const b of [0.44, 0.7]) for (let i = 0; i < n; i++) spots.push({ a: 0.3 + (i * (W - 0.6)) / Math.max(1, n - 1), b, i: i + (b > 0.5 ? n : 0) });
    spots.sort((q, r) => depthOf(p, q.a, q.b) - depthOf(p, r.a, r.b));
    for (const s of spots) {
      const [gx, gy] = p.P(s.a, s.b, top);
      if (goods === 'frutta') {
        // crates heaped with oranges, lemons, apples, grapes, limes
        const fruit = ['#f08a2e', '#f2d240', '#d8302a', '#7a3a9a', '#8ac04a', '#f06a8a'][Math.floor(R0() * 6)];
        lbox(p, s.a - 0.14, s.b - 0.11, 0.28, 0.22, top, 1.5, mono(wood, WOOD[0]));
        const [hx, hy] = p.P(s.a, s.b, top + 1.5);
        layer(p.c, (l) => {
          for (const [row, cnt] of [[0, 5], [1, 4], [2, 3]] as const)
            for (let q = 0; q < cnt; q++) dotFruit(l, hx - (cnt - 1) * 2.6 + q * 5.2 + (R0() - 0.5), hy - 1 - row * 3.4, fruit, 5);
        }, { outline: 0.5, rect: [hx - 18, hy - 18, hx + 18, hy + 4] });
        if (s.i % 4 === 1) {
          px(p.c, gx - 5, gy - 1, '#2a2a2e', 9, 5);
          px(p.c, gx - 4, gy, '#f2ead6', 6, 1);
        }
      } else if (goods === 'fiori') {
        // zinc buckets of tulips, roses, sunflowers, lavender
        const bloom = BLOOMS[Math.floor(R0() * BLOOMS.length)];
        layer(p.c, (l) => {
          fillPoly(l, [[gx - 7, gy - 11], [gx + 7, gy - 11], [gx + 5, gy], [gx - 5, gy]], '#9aa4ae');
          px(l, gx - 7, gy - 12, '#d4dae0', 14, 2);
          px(l, gx - 5, gy - 9, '#b8c0c8', 2, 8);
          foliage(l, [{ x: gx, y: gy - 17, rx: 9, ry: 7, z: 1 }], LEAF, s.i + k.seed, { cell: 2.4, dots: [bloom, lighten(bloom, 0.3)], dotChance: 0.95, dotSize: 4 });
        }, { outline: 0.55, rect: [gx - 14, gy - 30, gx + 14, gy + 2] });
      } else if (goods === 'artigianato') {
        // glazed pots, bowls and woven baskets
        const kind = (s.i + k.seed) % 3;
        const glaze = ['#2a6ac8', '#3fb6b0', '#d86a3a', '#f2d24a', '#fbf7ee', '#c83a5a'][Math.floor(R0() * 6)];
        layer(p.c, (l) => {
          if (kind === 0) {
            ell(l, gx, gy - 7, 7, 7, darken(glaze, 0.25));
            ell(l, gx - 1, gy - 8, 6, 6, glaze);
            px(l, gx - 3, gy - 16, darken(glaze, 0.2), 6, 3);
            px(l, gx - 3, gy - 11, '#fbf7ee', 6, 1);
            px(l, gx - 4, gy - 10, lighten(glaze, 0.45), 2, 2);
          } else if (kind === 1) {
            fillPoly(l, [[gx - 9, gy - 8], [gx + 9, gy - 8], [gx + 6, gy], [gx - 6, gy]], '#c8a060');
            for (let q = -8; q < 9; q += 3) ln(l, gx + q, gy - 8, gx + q * 0.7, gy, '#8a6a3a');
            ln(l, gx - 8, gy - 4, gx + 8, gy - 4, '#e0c080');
            curve(l, gx - 8, gy - 8, gx, gy - 20, gx + 8, gy - 8, '#8a6a3a', 1);
          } else {
            ell(l, gx, gy - 3, 9, 4, darken(glaze, 0.3));
            ell(l, gx, gy - 5, 9, 3.5, glaze);
            ell(l, gx, gy - 5, 6, 2, darken(glaze, 0.15));
            ell(l, gx + 4, gy - 9, 6, 6, '#fbf7ee');
            ell(l, gx + 4, gy - 9, 4, 4, '#2a6ac8');
          }
        }, { outline: 0.55, rect: [gx - 14, gy - 24, gx + 14, gy + 2] });
      } else {
        // folded cloth in stacks
        const cloth = ['#e8383a', '#f6d040', '#3f8ad8', '#f07ab0', '#3fb68b', '#8a5ad8', '#f59a3a', '#fbf7ee'];
        let z = top;
        const m = 3 + Math.floor(R0() * 3);
        for (let q = 0; q < m; q++) {
          const cc = cloth[Math.floor(R0() * cloth.length)];
          lbox(p, s.a - 0.13, s.b - 0.1, 0.26, 0.2, z, 0.8, mono(paint([darken(cc, 0.45), darken(cc, 0.3), darken(cc, 0.12), cc, lighten(cc, 0.2), lighten(cc, 0.4)]), darken(cc, 0.5)));
          z += 0.8;
        }
      }
    }
    // the front posts
    for (const a of [0.1, W - 0.16]) lbox(p, a, 0.88, 0.06, 0.06, 0, 22.4, posts);
    // scarves hanging from the front edge for the cloth seller
    if (goods === 'tessuti') {
      for (const [a, cc] of [[0.3, '#f07ab0'], [0.42, '#3fb6b0'], [W - 0.42, '#f6d040'], [W - 0.3, '#8a5ad8']] as const) {
        pq(p, front(p, 0.97), a - 0.05, a + 0.05, 13, 21.6, F.light ? cc : darken(cc, 0.2));
        pq(p, front(p, 0.97), a - 0.05, a - 0.02, 13, 21.6, lighten(cc, 0.25));
      }
    }
    // the awning: striped canvas sloping to the front, bulging a little, a scalloped valance
    const zb = 27.6;
    const zf = 21.9;
    const b0 = 0.08;
    const b1 = D + 0.08;
    const zAt = (t: number) => zb + (zf - zb) * t + Math.sin(Math.PI * t) * 0.9;
    const ns = Math.max(6, Math.round(W * 4.5));
    const a0 = -0.06;
    const a1 = W + 0.06;
    const seg = 6;
    const shade = p.rot ? 0.12 : 0;
    for (let i = 0; i < ns; i++) {
      const sa0 = a0 + ((a1 - a0) * i) / ns;
      const sa1 = a0 + ((a1 - a0) * (i + 1)) / ns;
      const base = i % 2 ? white : col;
      for (let j = 0; j < seg; j++) {
        const t0 = j / seg;
        const t1 = (j + 1) / seg;
        const q = [p.P(sa0, b0 + (b1 - b0) * t0, zAt(t0)), p.P(sa1, b0 + (b1 - b0) * t0, zAt(t0)), p.P(sa1, b0 + (b1 - b0) * t1, zAt(t1)), p.P(sa0, b0 + (b1 - b0) * t1, zAt(t1))];
        // the crown of the bulge catches the sun, the front lip turns down
        const t = shade + (j === 1 || j === 2 ? -0.06 : j === seg - 1 ? 0.1 : 0);
        fillPoly(p.c, q, t < 0 ? lighten(base, -t * 2) : t > 0 ? darken(base, t) : base);
      }
    }
    // the valance: hanging from the front edge, scalloped, the stripes carried on
    const FV = front(p, b1);
    for (let i = 0; i < ns; i++) {
      const sa0 = a0 + ((a1 - a0) * i) / ns;
      const sa1 = a0 + ((a1 - a0) * (i + 1)) / ns;
      const base = i % 2 ? white : col;
      const c0 = FV.light ? darken(base, 0.06) : darken(base, 0.22);
      pq(p, FV, sa0, sa1, zf - 2.3, zf, c0);
      const [ex0, ey0] = FV.F(sa0, zf - 2.3);
      const [ex1, ey1] = FV.F(sa1, zf - 2.3);
      fillPoly(p.c, [[ex0, ey0], [ex1, ey1], [(ex0 + ex1) / 2 + 1, (ey0 + ey1) / 2 + 4]], c0);
    }
    pq(p, FV, a0, a1, zf - 0.35, zf, darken(col, 0.3));
    // the side flap on the visible end, in the stall's colour
    const SV = side(p, p.rot ? a0 : a1);
    for (let j = 0; j < seg; j++) {
      const t0 = j / seg;
      const t1 = (j + 1) / seg;
      const u0 = b0 + (b1 - b0) * t0;
      const u1 = b0 + (b1 - b0) * t1;
      fillPoly(p.c, [SV.F(u0, zAt(t0)), SV.F(u1, zAt(t1)), SV.F(u1, zAt(t1) - 2.3), SV.F(u0, zAt(t0) - 2.3)], SV.light ? col : darken(col, 0.22));
    }
  },
};

// ── 7. glass bus shelter: a dark frame, glass walls, a blue glass roof, a lit poster ──
/** Clear glass with a light-blue tint and two diagonal reflections (drawn with alpha). */
const pane =
  (bright = 0): Mat =>
  (light) =>
  (u, v, x, y) => {
    const d = (u * 0.8 + v) % 44;
    let i = (light ? 3.4 : 2.8) + bright;
    if (d > 6 && d < 13) i += 1.2;
    else if (d > 20 && d < 22) i += 0.8;
    if (hash(x, y, 71) < 0.02) i += 1;
    return at(GLASS, i);
  };

const pensilinaM: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.04, 0.12, W - 0.04, D - 0.02, 22, 0.24);
    const metal = mono(coat(CHAR), CHAR[0]);
    const bw = 0.2;
    const fb = 0.86;
    const H = 21.6;
    const near = nearA(p, W);
    const aFar = near ? 0.1 : W - 0.1;
    const aNear = near ? W - 0.1 : 0.1;
    // the far end's glass panel, the back glass wall
    p.c.globalAlpha = 0.5;
    pt(p, side(p, aFar), bw + 0.04, fb - 0.06, 1.2, H, pane());
    pt(p, front(p, bw), 0.12, W - 0.12, 1.2, H, pane());
    p.c.globalAlpha = 1;
    // a route map on the back glass
    const BG = front(p, bw + 0.01);
    const ma = near ? 0.5 : W - 1.3;
    pq(p, BG, ma, ma + 0.8, 9, 17, '#f4f2ea');
    for (let i = 0; i < 5; i++) pq(p, BG, ma + 0.08, ma + 0.72, 15.6 - i * 1.4, 16 - i * 1.4, ['#e2553b', '#2a6ac8', '#3fb68b', '#f2b33a', '#8a5ad8'][i]);
    // rails along the back wall, the back posts
    lbox(p, 0.1, bw - 0.03, W - 0.2, 0.04, 1.0, 0.5, metal);
    lbox(p, 0.1, bw - 0.03, W - 0.2, 0.04, H - 0.2, 0.6, metal);
    for (const a of [0.08, W / 3, (2 * W) / 3, W - 0.14]) lbox(p, a, bw - 0.04, 0.06, 0.06, 0, H + 0.6, metal);
    // the bench: wooden slats on metal brackets along the back wall
    const sA0 = near ? 0.3 : 0.9;
    const sA1 = near ? W - 0.9 : W - 0.3;
    for (const a of [sA0 + 0.1, (sA0 + sA1) / 2, sA1 - 0.16]) lbox(p, a, bw + 0.04, 0.05, 0.26, 0, 4.2, metal);
    for (let i = 0; i < 3; i++) lbox(p, sA0, bw + 0.06 + i * 0.09, sA1 - sA0, 0.075, 4.2, 0.55, mono(grain(WOOD), WOOD[0]));
    // the far end's front post
    lbox(p, aFar - 0.03, fb, 0.06, 0.06, 0, H + 0.6, metal);
    // the lit advertising box at the near end
    const adA0 = near ? W - 0.2 : 0.08;
    lbox(p, adA0, bw + 0.02, 0.12, fb - bw - 0.02, 0.6, H - 0.6, metal);
    const AD = side(p, near ? W - 0.08 : 0.08);
    const u0 = bw + 0.08;
    const u1 = fb - 0.06;
    pq(p, AD, u0 - 0.02, u1 + 0.02, 2.2, H - 1.6, '#f4fbff');
    adPoster(p, AD, u0 + 0.03, u1 - 0.03, 2.8, H - 2.2, k.seed);
    // the near end's front post
    lbox(p, aNear - 0.03, fb, 0.06, 0.06, 0, H + 0.6, metal);
    // the roof: blue reflective glass in a dark frame, tilted down to the back
    const zf = H + 2.4;
    const zbk = H + 1.4;
    const rb0 = 0.06;
    const rb1 = D + 0.04;
    const ra0 = -0.06;
    const ra1 = W + 0.06;
    const zr = (b: number) => zbk + ((zf - zbk) * (b - rb0)) / (rb1 - rb0);
    // the fascia on the front and the visible end
    const FR = front(p, rb1);
    pq(p, FR, ra0, ra1, zf - 0.9, zf, CHAR[FR.light ? 3 : 2]);
    pq(p, FR, ra0, ra1, zf - 0.9, zf - 0.6, CHAR[1]);
    const SR = side(p, near ? ra1 : ra0);
    fillPoly(p.c, [SR.F(rb0, zr(rb0) - 0.9), SR.F(rb1, zf - 0.9), SR.F(rb1, zf), SR.F(rb0, zr(rb0))], CHAR[SR.light ? 3 : 2]);
    // the glass top
    const o = p.P(ra0, rb1, zf);
    const pa = p.P(ra1, rb1, zf);
    const pb = p.P(ra0, rb0, zbk);
    const ru = Math.hypot(pa[0] - o[0], pa[1] - o[1]);
    const rv = Math.hypot(pb[0] - o[0], pb[1] - o[1]);
    texPara(p.c, o, [pa[0] - o[0], pa[1] - o[1]], [pb[0] - o[0], pb[1] - o[1]], (u: number, v: number, x: number, y: number) => {
      if (u < 2 || v < 2 || u > ru - 2 || v > rv - 2) return CHAR[2];
      if (Math.abs(u - ru / 3) < 0.8 || Math.abs(u - (2 * ru) / 3) < 0.8) return CHAR[3];
      const d = (u * 0.55 + v * 1.4) % 70;
      let i = 2.2;
      if (d > 8 && d < 22) i += 1.6 + (d > 12 && d < 17 ? 1 : 0);
      else if (d > 34 && d < 38) i += 1;
      if (v > rv - 8) i -= 0.6;
      if (hash(x, y, 72) < 0.025) i += 1;
      return at(GLASS, i + (bayer(x, y) - 0.5) * 0.5);
    });
    // two small downlights under the front edge
    for (const a of [W * 0.3, W * 0.7]) {
      const [lx, ly] = p.P(a, rb1 - 0.12, zf - 0.9);
      px(p.c, lx - 2, ly, LIGHT_M, 5, 2);
      px(p.c, lx - 1, ly, LIGHT_W, 3, 1);
    }
  },
  lights: (k) => [
    { a: k.w * 0.3, b: 0.6, z: 22, r: 1.6, kind: 'lamp', color: '#fff0d0' },
    { a: k.w * 0.7, b: 0.6, z: 22, r: 1.6, kind: 'lamp', color: '#fff0d0' },
  ],
};

/** A backlit poster: a sunset over the sea, a palm, a white headline band. */
function adPoster(p: PropPainter, pl: ReturnType<typeof side>, u0: number, u1: number, z0: number, z1: number, seed: number) {
  const H = z1 - z0;
  const bands = ['#ffb35a', '#ff8a5a', '#f06a7a', '#b85a9a', '#6a4aa0'];
  for (let i = 0; i < bands.length; i++) pq(p, pl, u0, u1, z0 + H * (0.42 + i * 0.116), z0 + H * (0.42 + (i + 1) * 0.116), bands[bands.length - 1 - i]);
  // the sun on the horizon, the sea, the sand
  const um = u0 + (u1 - u0) * (0.4 + (seed % 3) * 0.1);
  pq(p, pl, um - 0.07, um + 0.07, z0 + H * 0.42, z0 + H * 0.56, '#fff2b0');
  pq(p, pl, u0, u1, z0 + H * 0.3, z0 + H * 0.42, '#2a6ac8');
  pq(p, pl, u0, u1, z0 + H * 0.38, z0 + H * 0.4, '#8ab8f0');
  pq(p, pl, u0, u1, z0 + H * 0.18, z0 + H * 0.3, '#f2d49a');
  // a palm silhouette
  const ua = u0 + (u1 - u0) * 0.8;
  pq(p, pl, ua - 0.012, ua + 0.012, z0 + H * 0.2, z0 + H * 0.78, '#3a1e3a');
  for (const [du, dz] of [[-0.09, -1.6], [0.09, -1.4], [-0.06, 0.8], [0.07, 0.9]] as const) {
    const [ax, ay] = pl.F(ua, z0 + H * 0.78);
    const [bx, by] = pl.F(ua + du, z0 + H * 0.78 + dz);
    ln(p.c, ax, ay, bx, by, '#3a1e3a', 2);
  }
  // the headline
  pq(p, pl, u0, u1, z0, z0 + H * 0.18, '#ffffff');
  pq(p, pl, u0 + (u1 - u0) * 0.12, u1 - (u1 - u0) * 0.2, z0 + H * 0.1, z0 + H * 0.14, '#2a2a3a');
  pq(p, pl, u0 + (u1 - u0) * 0.12, u1 - (u1 - u0) * 0.4, z0 + H * 0.04, z0 + H * 0.07, '#e2553b');
}

// ── 8. the tram: white, an orange skirt, a dark-blue window band, a rounded cab at both ends ──
const TW: Ramp = ['#8a92a0', '#b0b6c2', '#ced3db', '#e4e7ec', '#f2f4f7', '#ffffff'];
const TO: Ramp = ['#7a2e0c', '#a83e14', '#d0561c', '#ec722a', '#f8924a', '#ffb470'];
const TG: Ramp = ['#0a1630', '#102244', '#18325e', '#22467e', '#3a66a6', '#7aa4dc', '#c4dcf4'];
const TZ = { bot: 1.2, skirt: 6.8, top: 27.6 };

/**
 * The tram's skin by height under a continuous light L (0 = the shaded side, 1 = the lit side,
 * 2 = the roof): the orange skirt, a grey seam, white, the dark-blue glass band, the roof's shoulder.
 */
function tramTone(z: number, L: number, cab: boolean, x: number, y: number): string {
  const lt = (shade: number, lit: number, top: number) => (L <= 1 ? shade + (lit - shade) * L : lit + (top - lit) * (L - 1));
  if (L > 1.55) return at(TW, 4.4 - (hash(x, y, 3) < 0.04 ? 1 : 0));
  if (z < TZ.skirt) {
    let i = lt(2, 3.3, 4.2);
    if (z < TZ.bot + 0.8) i -= 1;
    if (z > TZ.skirt - 0.5) i += 0.9;
    return at(TO, i + (bayer(x, y) - 0.5) * 0.4);
  }
  if (z < TZ.skirt + 0.5) return at(TW, lt(1, 2, 3));
  const g0 = cab ? 10.8 : 11.4;
  const g1 = cab ? 23.8 : 22.6;
  if (z >= g0 && z < g1) {
    // glass: deep blue, long diagonal sky reflections running across the whole car
    const d = (((x * 0.55 + y) % 52) + 52) % 52;
    let i = lt(1.7, 2.5, 3.2);
    if (d > 6 && d < 14) i += cab ? 2.4 : 1.7;
    else if (d > 22 && d < 25) i += 0.9;
    if (z > g1 - 1.1) i -= 0.9;
    return at(TG, i + (bayer(x, y) - 0.5) * 0.3);
  }
  let i = lt(2.6, 4, 4.4);
  if (z >= g1 && z < g1 + 0.45) i -= 1;
  if (z < g0 && z > g0 - 0.4) i -= 0.5;
  if (hash(x, y, 9) < 0.015) i -= 0.6;
  return at(TW, i + (bayer(x, y) - 0.5) * 0.4);
}

/**
 * The car body ray-cast as one rounded solid (a box with rounded vertical corners, a rounded
 * roof shoulder and both ends curving back at the top): smooth cabs at both ends, the same
 * from either rotation. Drawn into `l`, a layer the caller outlines.
 */
function tramBody(l: C, q: PropPainter, W: number, nose: number) {
  const O = q.P(0, 0, 0);
  const PA = q.P(1, 0, 0);
  const PB = q.P(0, 1, 0);
  const PZ = q.P(0, 0, 1);
  const ua = [PA[0] - O[0], PA[1] - O[1]];
  const ub = [PB[0] - O[0], PB[1] - O[1]];
  const uz = [PZ[0] - O[0], PZ[1] - O[1]];
  const det = ua[0] * ub[1] - ua[1] * ub[0];
  // a ray (one screen pixel): a(z) = a0 + daz·z, b(z) = b0 + dbz·z; higher z is nearer the camera
  const daz = (-uz[0] * ub[1] + uz[1] * ub[0]) / det;
  const dbz = (-ua[0] * uz[1] + ua[1] * uz[0]) / det;
  const stepM = Math.hypot(daz, dbz, 0.1);
  const ca = W / 2;
  const cb = 0.5;
  const hl = (W - 0.08) / 2;
  const hb = 0.42;
  const zb = TZ.bot * 0.1;
  const zt = TZ.top * 0.1;
  const zc2 = (zt + zb - 1) / 2;
  const hz2 = (zt - zb + 1) / 2;
  const rc = 0.3;
  const rt = 0.62;
  const rl = 0.12;
  const rr = (x: number, y: number, hx: number, hy: number, r: number) => {
    const qx = Math.abs(x) - (hx - r);
    const qy = Math.abs(y) - (hy - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  // in metres: a and b in tiles, z / 10
  const sdf = (a: number, b: number, zm: number) => {
    const x = a - ca;
    const y = b - cb;
    const d1 = Math.max(rr(x, y, hl, hb, rc), zb - zm, zm - zt);
    const d2 = rr(x, zm - zc2, hl, hz2, rt);
    const d3 = rr(y, zm - zc2, hb, hz2, rl);
    return Math.max(d1, d2, d3);
  };
  const corners = [q.P(0, 0, 0), q.P(W, 0, 0), q.P(W, 1, 0), q.P(0, 1, 0), q.P(0, 0, TZ.top), q.P(W, 0, TZ.top), q.P(W, 1, TZ.top), q.P(0, 1, TZ.top)];
  const x0 = Math.floor(Math.min(...corners.map((c) => c[0])));
  const x1 = Math.ceil(Math.max(...corners.map((c) => c[0])));
  const y0 = Math.floor(Math.min(...corners.map((c) => c[1])));
  const y1 = Math.ceil(Math.max(...corners.map((c) => c[1])));
  const e = 0.004;
  for (let sy = y0; sy < y1; sy++)
    for (let sx = x0; sx < x1; sx++) {
      const px0 = sx + 0.5 - O[0];
      const py0 = sy + 0.5 - O[1];
      const a0 = (px0 * ub[1] - py0 * ub[0]) / det;
      const b0 = (ua[0] * py0 - ua[1] * px0) / det;
      let z = TZ.top + 0.5;
      let hit = false;
      for (let it = 0; it < 60 && z > TZ.bot - 0.6; it++) {
        const d = sdf(a0 + daz * z, b0 + dbz * z, z * 0.1);
        if (d < 0.003) {
          hit = true;
          break;
        }
        z -= Math.max(d / stepM, 0.03);
      }
      if (!hit) continue;
      const a = a0 + daz * z;
      const b = b0 + dbz * z;
      const zm = z * 0.1;
      let na = sdf(a + e, b, zm) - sdf(a - e, b, zm);
      let nb = sdf(a, b + e, zm) - sdf(a, b - e, zm);
      let nz = sdf(a, b, zm + e) - sdf(a, b, zm - e);
      const nl = Math.hypot(na, nb, nz) || 1;
      na /= nl;
      nb /= nl;
      nz /= nl;
      // the normal in the world: +y faces are lit, +x faces in shade, the roof brightest
      const wx = q.rot ? nb : na;
      const wy = q.rot ? -na : nb;
      const fl = Math.max(0, wy) ** 2;
      const fs = Math.max(0, wx) ** 2;
      const ft = Math.max(0, nz) ** 2;
      const L = (fl + ft * 2) / (fl + fs + ft + 1e-6);
      const cab = Math.abs(a - ca) > hl - nose;
      px(l, sx, sy, tramTone(z, L, cab, sx, sy));
    }
}

const tramM: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const nose = 0.6;
    const b0 = 0.08;
    const bd = D - 0.16;
    footShadow(p, 0.05, 0.05, W - 0.05, D - 0.05, 30, 0.3);
    // bogies in the shadow under the skirt
    const dark = mono(coat(CHAR), CHAR[0]);
    for (const a of [1.15, W / 2, W - 1.15]) lbox(p, a - 0.5, 0.2, 1.0, 0.6, 0, 1.6, dark);
    // the whole car in one outlined layer: the rounded body, then the side's details
    layer(
      p.c,
      (l) => {
        const q = new PropPainter(new Painter(l, p.w.ox, p.w.oy, p.w.k), p.x, p.y, p.pw, p.pd, p.rot);
        tramBody(l, q, W, nose);
        const F = front(q, b0 + bd);
        const doors = W >= 7 ? [1.55, W / 2 - 0.36, W - 2.27] : [1.6, W - 2.3];
        // window pillars
        for (let a = nose + 0.5; a < W - nose - 0.3; a += 0.82) {
          if (doors.some((d) => a > d - 0.12 && a < d + 0.84)) continue;
          pq(q, F, a, a + 0.07, 11.4, 22.6, F.light ? TW[4] : TW[2]);
        }
        // passengers: soft silhouettes behind the glass
        const R0 = rng(k.seed * 9 + 4);
        for (let a = nose + 0.3; a < W - nose - 0.3; a += 0.3) {
          if (R0() < 0.55 || doors.some((d) => a > d - 0.1 && a < d + 0.8)) continue;
          const [hx, hy] = F.F(a, 17.6);
          const tone = F.light ? '#30508a' : '#243e6a';
          ell(l, hx, hy, 3, 3.4, tone);
          fillPoly(l, [[hx - 6, hy + 10], [hx + 6, hy + 10], [hx + 4, hy + 3], [hx - 4, hy + 3]], tone);
        }
        // doors: grey frames, two glass leaves, a green button
        for (const d of doors) {
          pq(q, F, d - 0.05, d + 0.77, TZ.bot + 0.4, 23.4, F.light ? '#9aa2ae' : '#6e7684');
          pt(q, F, d, d + 0.72, TZ.bot + 0.9, 22.9, (_u: number, v: number, x: number, y: number) => {
            const dd = (((x * 0.55 + y) % 52) + 52) % 52;
            let i = F.light ? 2.4 : 1.7;
            if (dd > 6 && dd < 14) i += 1.6;
            if (v > 82) i -= 0.6;
            if (hash(x, y, 4) < 0.02) i += 1;
            return at(TG, i);
          });
          pq(q, F, d + 0.355, d + 0.365, TZ.bot + 0.9, 22.9, '#0a1226');
          pq(q, F, d - 0.05, d + 0.77, 9.6, 10, F.light ? '#b8c0ca' : '#848c98');
          const [bx, by] = F.F(d + 0.82, 12);
          px(l, bx, by, '#3fe08a', 2, 2);
        }
        // a thin orange pinstripe over the windows, the line's logo on the skirt
        pq(q, F, nose + 0.2, W - nose - 0.2, 23.3, 23.6, TO[F.light ? 3 : 2]);
        const la = W / 2 + 0.6;
        pq(q, F, la, la + 0.5, 7.8, 9.4, F.light ? '#2a3a5a' : '#1e2a44');
        pq(q, F, la + 0.06, la + 0.2, 8.2, 9, TO[4]);
        // the visible cab (both cabs are alike, so the tram reads right driving either way):
        // headlights low on the nose with red tail lamps outboard, a destination sign, the wiper
        const tip = nearA(q, W) ? W - 0.04 : 0.04;
        const E = side(q, tip);
        for (const u of [0.36, 0.56]) {
          pq(q, E, u, u + 0.08, 4.8, 6.6, '#fff8e0');
          pq(q, E, u + 0.015, u + 0.05, 5.3, 6.2, '#ffffff');
        }
        for (const u of [0.29, 0.66]) {
          pq(q, E, u, u + 0.05, 5.0, 6.4, '#c8182c');
          pq(q, E, u + 0.01, u + 0.03, 5.5, 6.1, '#ff6a6a');
        }
        pq(q, E, 0.38, 0.62, 19.6, 21.4, '#14161c');
        for (let i = 0; i < 5; i++) pq(q, E, 0.41 + i * 0.042, 0.43 + i * 0.042, 20.1, 20.9, '#ffa040');
        const [w0x, w0y] = E.F(0.58, 11.2);
        const [w1x, w1y] = E.F(0.44, 16.8);
        ln(l, w0x, w0y, w1x, w1y, '#0a1226');
      },
      { outline: 0.55 },
    );
    // the roof: equipment boxes and the pantograph in the middle
    const RB = mono(paint(['#7a828e', '#9aa2ae', '#b8bec8', '#cdd2d9', '#dfe3e8', '#eef0f3']), '#5a626e');
    for (const a of [nose + 0.6, W - nose - 2.0]) {
      lbox(p, a, 0.27, 1.4, 0.46, TZ.top - 0.2, 1.4, RB);
      for (let i = 0; i < 6; i++) {
        const [hx, hy] = p.P(a + 0.15 + i * 0.22, 0.33, TZ.top + 1.2);
        const [ix, iy] = p.P(a + 0.15 + i * 0.22, 0.67, TZ.top + 1.2);
        ln(p.c, hx, hy, ix, iy, '#8a929e');
      }
    }
    const pa = W / 2;
    lbox(p, pa - 0.3, 0.3, 0.6, 0.4, TZ.top - 0.2, 1.0, dark);
    const P1 = p.P(pa - 0.22, 0.5, TZ.top + 0.8);
    const P2 = p.P(pa + 0.1, 0.5, TZ.top + 7);
    const P3 = p.P(pa - 0.06, 0.5, TZ.top + 12.6);
    layer(
      p.c,
      (l) => {
        ln(l, P1[0], P1[1], P2[0], P2[1], CHAR[2], 2);
        ln(l, P2[0], P2[1], P3[0], P3[1], CHAR[3], 2);
        ln(l, P1[0] + 3, P1[1], P2[0], P2[1], CHAR[1]);
        const h0 = p.P(pa - 0.06, 0.16, TZ.top + 12.6);
        const h1 = p.P(pa - 0.06, 0.84, TZ.top + 12.6);
        ln(l, h0[0], h0[1], h1[0], h1[1], CHAR[1], 2);
        ln(l, h0[0], h0[1] - 1, h1[0], h1[1] - 1, CHAR[4]);
        for (const q of [p.P(pa - 0.26, 0.34, TZ.top + 0.8), p.P(pa + 0.26, 0.66, TZ.top + 0.8)]) {
          px(l, q[0] - 2, q[1] - 3, '#e8e0d0', 4, 3);
          px(l, q[0] - 2, q[1] - 3, '#ffffff', 2, 1);
        }
      },
      { outline: 0.5, rect: [Math.min(P1[0], P3[0]) - 40, P3[1] - 30, Math.max(P1[0], P3[0]) + 40, P1[1] + 8] },
    );
  },
  lights: (k) => {
    const W = k.w;
    const out: PropLight[] = [
      { a: 0.02, b: 0.5, z: 6, r: 1.5, kind: 'lamp', color: '#fff4d8' },
      { a: W - 0.02, b: 0.5, z: 6, r: 1.5, kind: 'lamp', color: '#fff4d8' },
    ];
    for (let a = 1.2; a < W - 1; a += 1.5) out.push({ a, b: k.d - 0.08, z: 17, r: 0.9, kind: 'window', color: '#fff0d0' });
    return out;
  },
};

export const CITY_PLAZA: Record<string, PropArt> = {
  palma,
  vasoQ,
  palo,
  fontanaQ,
  scultura,
  bancarellaM,
  pensilinaM,
  tramM,
  chioscoM,
  tavoloM,
  pancaM,
  prato,
};

export const CITY_PLAZA_META: Record<string, PropMeta> = {
  palma: { w: 1, d: 1, h: 130 },
  vasoQ: { w: 2, d: 1, h: 16 },
  palo: { w: 1, d: 1, h: 52 },
  fontanaQ: { w: 4, d: 4, h: 30 },
  scultura: { w: 2, d: 2, h: 40 },
  bancarellaM: { w: 2, d: 1, h: 30 },
  pensilinaM: { w: 3, d: 1, h: 34 },
  tramM: { w: 7, d: 1, h: 42 },
  chioscoM: { w: 2, d: 2, h: 34 },
  tavoloM: { w: 1, d: 1, h: 30, solid: false },
  pancaM: { w: 2, d: 1, h: 10 },
  prato: { w: 2, d: 2, h: 4 },
};

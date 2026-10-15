// Robotics pack — a tiny flat-shaded mesh rasteriser for the curved, many-sided
// things a box kit can't build: aircraft, tanks, the tower's glass cab, drones.
// Faces are planar polygons in prop-local (a, b, z), wound counter-clockwise
// seen from outside. Hidden faces are culled against the iso view direction,
// the rest are lit by the pack's sun (upper left), sorted far → near and
// filled (or textured through poly3).
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import { fillPoly, type Ramp } from '../../kit4';
import { poly3 } from '../../plane4';

export type V3 = [number, number, number];

export interface Face {
  pts: V3[];
  /** a ramp lit by the face normal, or a flat colour */
  col: Ramp | string;
  /** optional texture, drawn with poly3 (exact, per pixel) */
  tex?: Mat | FaceTex;
  /** thin sheets seen from both sides */
  two?: boolean;
  /** tone offset */
  bias?: number;
  /** depth nudge (tiles) for hand-ordered parts */
  dz?: number;
  /** a callback drawn right after the face (decals on it), with its screen points */
  after?: (scr: [number, number][], tone: number) => void;
}

// view direction (raw a/b tiles, z units) and the sun, in metric units (1 tile = 10 z)
const VIEW: V3 = [1, 1, 1.6];
const SUN: V3 = (() => {
  const v: V3 = [-0.32, 0.56, 0.76];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Newell normal of a polygon (any units). */
export function newell(pts: V3[]): V3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i];
    const n = pts[(i + 1) % pts.length];
    nx += (c[1] - n[1]) * (c[2] + n[2]);
    ny += (c[2] - n[2]) * (c[0] + n[0]);
    nz += (c[0] - n[0]) * (c[1] + n[1]);
  }
  return [nx, ny, nz];
}

/** Reverse a face's winding if its normal points away from `out` (metric local coords). */
export function orient(pts: V3[], out: V3): V3[] {
  const n = newell(pts.map(([a, b, z]) => [a, b, z / 10] as V3));
  return n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? [...pts].reverse() : pts;
}

const centroid = (pts: V3[]): V3 => {
  let a = 0;
  let b = 0;
  let z = 0;
  for (const p of pts) {
    a += p[0];
    b += p[1];
    z += p[2];
  }
  return [a / pts.length, b / pts.length, z / pts.length];
};

/** Draw a mesh. Light 0…1 maps onto the ramp like the box kit: top ≈ n−2, lit front ≈ n−3, shaded side ≈ 1. */
export function drawMesh(p: PropPainter, faces: Face[], o: { inflate?: number; c?: CanvasRenderingContext2D } = {}) {
  const inflate = o.inflate ?? 0.35;
  const C = o.c ?? p.c;
  // textured faces go through poly3, which only needs P and the target canvas
  const pp = o.c ? ({ P: (a: number, b: number, z?: number) => p.P(a, b, z), c: o.c } as unknown as PropPainter) : p;
  const items: { f: Face; scr: [number, number][]; tone: number; depth: number; light: 0 | 1 | 2 }[] = [];
  for (const f of faces) {
    if (f.pts.length < 3) continue;
    // world points (rotation applied), metric z for normals
    const W = f.pts.map(([a, b, z]) => {
      const [x, y] = p.W(a, b);
      return [x, y, z / 10] as V3;
    });
    let n = newell(W);
    const len = Math.hypot(...n);
    if (len < 1e-9) continue;
    n = [n[0] / len, n[1] / len, n[2] / len];
    let vis = n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2];
    if (vis <= 0) {
      if (!f.two) continue;
      n = [-n[0], -n[1], -n[2]];
      vis = -vis;
    }
    const lv = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
    const N = typeof f.col === 'string' ? 1 : f.col.length;
    const tone = 1 + lv * (N - 2.2) + (f.bias ?? 0);
    const [cx, cy, cz] = centroid(W);
    const depth = cx + cy + (cz * 10) / 24 + (f.dz ?? 0);
    const scr = f.pts.map(([a, b, z]) => p.P(a, b, z) as [number, number]);
    const light: 0 | 1 | 2 = n[2] > 0.7 ? 2 : lv > 0.3 ? 1 : 0;
    items.push({ f, scr, tone, depth, light });
  }
  items.sort((m, k) => m.depth - k.depth);
  for (const it of items) {
    const f = it.f;
    if (f.tex) {
      poly3(pp, f.pts, f.tex, it.light);
    } else {
      const col = typeof f.col === 'string' ? f.col : f.col[Math.max(0, Math.min(f.col.length - 1, Math.round(it.tone)))];
      let pts = it.scr;
      if (inflate > 0) {
        let sx = 0;
        let sy = 0;
        for (const q of pts) {
          sx += q[0];
          sy += q[1];
        }
        sx /= pts.length;
        sy /= pts.length;
        pts = pts.map(([x, y]) => {
          const dx = x - sx;
          const dy = y - sy;
          const d = Math.hypot(dx, dy) || 1;
          return [x + (dx / d) * inflate, y + (dy / d) * inflate] as [number, number];
        });
      }
      fillPoly(C, pts, col);
    }
    f.after?.(it.scr, it.tone);
  }
}

// ── builders ────────────────────────────────────────────────
/** An axis-aligned box as six faces (only the visible ones survive culling). */
export function box(a0: number, b0: number, z0: number, a1: number, b1: number, z1: number, col: Ramp | string, o: Partial<Face> = {}): Face[] {
  const F = (pts: V3[]): Face => ({ ...o, pts, col });
  return [
    F([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]]),
    F([[a0, b1, z0], [a1, b1, z0], [a1, b0, z0], [a0, b0, z0]]),
    F([[a0, b1, z0], [a0, b1, z1], [a1, b1, z1], [a1, b1, z0]]),
    F([[a1, b0, z0], [a1, b0, z1], [a0, b0, z1], [a0, b0, z0]]),
    F([[a1, b0, z0], [a1, b1, z0], [a1, b1, z1], [a1, b0, z1]]),
    F([[a0, b1, z0], [a0, b0, z0], [a0, b0, z1], [a0, b1, z1]]),
  ];
}

export interface Section {
  /** position along the axis (tiles) */
  s: number;
  /** centre across (tiles) and height (z) */
  c: number;
  z: number;
  /** half width (tiles) and half height (z) */
  w: number;
  h: number;
}

/**
 * A lofted body along local a ('a') or b ('b') through elliptic sections of
 * n sides. colOf(k, i) picks the colour of the facet between ring vertex k and
 * k+1 of segment i (livery stripes, glazing). Ends are capped.
 */
export function loft(axis: 'a' | 'b', secs: Section[], n: number, colOf: (k: number, i: number) => Ramp | string, o: Partial<Face> & { caps?: boolean; phase?: number } = {}): Face[] {
  const ph = o.phase ?? Math.PI / n;
  const ring = (S: Section): V3[] => {
    const out: V3[] = [];
    for (let k = 0; k < n; k++) {
      const t = ph + (k / n) * Math.PI * 2;
      const lat = S.c + S.w * Math.cos(t);
      const zz = S.z + S.h * Math.sin(t);
      out.push(axis === 'a' ? [S.s, lat, zz] : [lat, S.s, zz]);
    }
    return out;
  };
  const rings = secs.map(ring);
  const faces: Face[] = [];
  const { caps, phase, ...rest } = o;
  void phase;
  for (let i = 0; i + 1 < secs.length; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const sm = (secs[i].s + secs[i + 1].s) / 2;
    const cm = (secs[i].c + secs[i + 1].c) / 2;
    const zm = (secs[i].z + secs[i + 1].z) / 2;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      let pts: V3[] = [A[k], A[k1], B[k1], B[k]];
      // degenerate ends (a point section) become triangles
      if (secs[i].w < 1e-4 && secs[i].h < 1e-4) pts = [A[k], B[k1], B[k]];
      else if (secs[i + 1].w < 1e-4 && secs[i + 1].h < 1e-4) pts = [A[k], A[k1], B[k]];
      const c = centroid(pts);
      const out: V3 = axis === 'a' ? [0, c[1] - cm, (c[2] - zm) / 10] : [c[0] - cm, 0, (c[2] - zm) / 10];
      faces.push({ ...rest, pts: orient(pts, out), col: colOf(k, i) });
      void sm;
    }
  }
  if (caps !== false) {
    const first = secs[0];
    const last = secs[secs.length - 1];
    if (first.w > 1e-4) faces.push({ ...rest, pts: orient(rings[0], axis === 'a' ? [-1, 0, 0] : [0, -1, 0]), col: colOf(-1, 0) });
    if (last.w > 1e-4) faces.push({ ...rest, pts: orient(rings[rings.length - 1], axis === 'a' ? [1, 0, 0] : [0, 1, 0]), col: colOf(-2, secs.length - 1) });
  }
  return faces;
}

/** A cylinder along an axis: centre (ca, cb, cz), radius r (tiles across, rz in z), length l. */
export function cylinder(axis: 'a' | 'b' | 'z', ca: number, cb: number, cz: number, r: number, rz: number, l: number, n: number, col: Ramp | string, o: Partial<Face> & { caps?: boolean } = {}): Face[] {
  if (axis === 'z') {
    const faces: Face[] = [];
    const { caps, ...rest } = o;
    const ringAt = (z: number): V3[] => {
      const out: V3[] = [];
      for (let k = 0; k < n; k++) {
        const t = (k / n) * Math.PI * 2;
        out.push([ca + r * Math.cos(t), cb + r * Math.sin(t), z]);
      }
      return out;
    };
    const A = ringAt(cz);
    const B = ringAt(cz + l);
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const pts: V3[] = [A[k], A[k1], B[k1], B[k]];
      const c = centroid(pts);
      faces.push({ ...rest, pts: orient(pts, [c[0] - ca, c[1] - cb, 0]), col });
    }
    if (caps !== false) faces.push({ ...rest, pts: orient(B, [0, 0, 1]), col });
    return faces;
  }
  const s0 = axis === 'a' ? ca - l / 2 : cb - l / 2;
  const c = axis === 'a' ? cb : ca;
  return loft(axis, [{ s: s0, c, z: cz, w: r, h: rz }, { s: s0 + l, c, z: cz, w: r, h: rz }], n, () => col, o);
}

/** A flat polygon (both sides), e.g. a propeller blade, a fin, a sign. */
export const sheet = (pts: V3[], col: Ramp | string, o: Partial<Face> = {}): Face => ({ ...o, pts, col, two: true });

// Helpers for drawing on vertical planes of HD props (walls, doors, windows).
import { darken, lighten, mix } from '../color';
import { poly, type PropPainter, type V2 } from '../iso';
import { canopy, type FaceTex, hh, type Light, type Mat, OUTL, px, RAMP, type Ramp, SHADOW, texPara } from './kit';

/** A vertical plane: F(u, z) → screen. `light` 1 = lit (world +y face), 0 = shaded (+x face). */
export interface Plane {
  F: (u: number, z: number) => V2;
  light: Light;
}

/** Front plane b = const (rot 0 → world +y face, lit). */
export const front = (p: PropPainter, b: number): Plane => ({ F: (u, z) => p.P(u, b, z), light: p.rot === 0 ? 1 : 0 });
/** Side plane a = const, u runs along b (rot 0 → world +x face, shaded). */
export const side = (p: PropPainter, a: number): Plane => ({ F: (u, z) => p.P(a, u, z), light: p.rot === 0 ? 0 : 1 });

export function pq(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, col: string) {
  poly(p.c, [pl.F(u0, z0), pl.F(u1, z0), pl.F(u1, z1), pl.F(u0, z1)], col);
}

/** Textured rectangle on a plane, with u measured from u0 and v from z0. */
export function pt(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, mat: Mat | FaceTex, light?: Light) {
  const o = pl.F(u0, z0);
  const a = pl.F(u1, z0);
  const b = pl.F(u0, z1);
  const U: V2 = [a[0] - o[0], a[1] - o[1]];
  const V: V2 = [b[0] - o[0], b[1] - o[1]];
  const tex = mat.length === 3 ? (mat as Mat)(light ?? pl.light, Math.hypot(...U), Math.hypot(...V)) : (mat as FaceTex);
  texPara(p.c, o, U, V, tex);
}

/** Straight beam on a plane between two (u, z) points, `t` px thick (vertical extent). */
export function beam(p: PropPainter, pl: Plane, u0: number, z0: number, u1: number, z1: number, t: number, col: string) {
  const a = pl.F(u0, z0);
  const b = pl.F(u1, z1);
  const k = p.k;
  const h = (t * k) / 2;
  if (Math.abs(b[0] - a[0]) < 0.5) {
    poly(p.c, [[a[0] - h, a[1]], [a[0] + h, a[1]], [b[0] + h, b[1]], [b[0] - h, b[1]]], col);
  } else {
    poly(p.c, [[a[0], a[1] - h], [b[0], b[1] - h], [b[0], b[1] + h], [a[0], a[1] + h]], col);
  }
}

export interface WindowOpts {
  frame?: string;
  shutters?: Ramp;
  box?: string[] | null;
  muntins?: boolean;
  lit?: boolean;
}

/** Window with frame, glass reflections, muntins, optional shutters and flower box. */
export function windowOn(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, o: WindowOpts = {}) {
  const frame = o.frame ?? '#efe6d2';
  const fr = pl.light ? frame : darken(frame, 0.22);
  const du = (u1 - u0) * 0.1;
  const dz = (z1 - z0) * 0.08;
  // recess shadow + frame
  pq(p, pl, u0 - 0.03, u1 + 0.03, z0 - 1, z1 + 1, mix(fr, OUTL, 0.65));
  pq(p, pl, u0, u1, z0, z1, fr);
  pq(p, pl, u0 + du, u1 - du, z0 + dz, z1 - dz, darken(RAMP.glass[0], 0.25));
  const gl: FaceTex = (u, v) => {
    const d = (u * 0.8 + v) % 26;
    let i = pl.light ? 2 : 1;
    if (v > (z1 - z0 - 2 * dz) * p.k - 3) i -= 1; // shadow under the lintel
    if (d > 4 && d < 7) i += 2;
    else if (d > 10 && d < 11.5) i += 1;
    if (o.lit && v < 6) i += 1;
    return RAMP.glass[Math.max(0, Math.min(4, i))];
  };
  pt(p, pl, u0 + du * 1.4, u1 - du * 1.4, z0 + dz * 1.4, z1 - dz * 1.6, gl);
  if (o.muntins !== false) {
    const um = (u0 + u1) / 2;
    const zm = (z0 + z1) / 2;
    beam(p, pl, um, z0 + dz, um, z1 - dz, 0.8, fr);
    beam(p, pl, u0 + du, zm, u1 - du, zm, 0.8, fr);
  }
  // sill
  pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 1.5, z0, lighten(fr, 0.08));
  if (o.shutters) {
    const sw = (u1 - u0) * 0.42;
    for (const [a, b] of [[u0 - sw - 0.04, u0 - 0.04], [u1 + 0.04, u1 + 0.04 + sw]]) {
      const r = o.shutters;
      pq(p, pl, a - 0.02, b + 0.02, z0 - 0.5, z1 + 0.5, mix(r[0], OUTL, 0.4));
      pt(p, pl, a, b, z0, z1, (u, v, x, y) => {
        const slat = Math.floor(v / 3);
        let i = pl.light ? 3 : 1;
        if (v - slat * 3 < 1) i -= 1;
        if (u < 1.2) i += 1;
        if (hh(x, y, 5) < 0.04) i -= 1;
        return r[Math.max(0, Math.min(r.length - 1, i))];
      });
    }
  }
  if (o.box) {
    const bz = z0 - 1.5;
    pq(p, pl, u0 - 0.04, u1 + 0.04, bz - 5, bz, mix(RAMP.wood[1], OUTL, 0.3));
    pt(p, pl, u0 - 0.02, u1 + 0.02, bz - 4.5, bz - 0.5, (u: number, v: number) => RAMP.wood[(pl.light ? 3 : 2) - (v < 1.5 ? 1 : 0) + (u % 9 < 1 ? -1 : 0)]);
    const [ax, ay] = pl.F(u0, bz);
    const [bx, by] = pl.F(u1, bz);
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      canopy(p.c, x, y - 2, 3, 2.5, Math.floor(x * 13 + y * 7), { ramp: RAMP.leafWarm, rmin: 1.6, rmax: 2.4, outline: false, dots: o.box, dotChance: 0.9 });
    }
  }
}

/** Plank door with frame, hinges and knob. */
export function doorOn(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, ramp: Ramp = RAMP.wood) {
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0, z1 + 1.5, mix(ramp[0], OUTL, 0.5));
  pt(p, pl, u0, u1, z0, z1, (u, v, x, y) => {
    let i = pl.light ? 3 : 1.5;
    if (u % 6 < 1) i -= 1.4;
    if (v < 2) i -= 1;
    if (hh(x, y, 9) < 0.05) i -= 1;
    return ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];
  });
  // iron hinges + knob
  for (const z of [z0 + (z1 - z0) * 0.25, z0 + (z1 - z0) * 0.75]) beam(p, pl, u0 + 0.02, z, u0 + (u1 - u0) * 0.35, z, 0.7, RAMP.iron[1]);
  const [kx, ky] = pl.F(u0 + (u1 - u0) * 0.82, z0 + (z1 - z0) * 0.45);
  px(p.c, kx - 1, ky - 1, '#f2d27a', 2, 2);
  px(p.c, kx, ky, '#8a6a2a');
}

/** A cast shadow of a box, offset toward the lower right (sun from the upper left). */
export function castShadow(p: PropPainter, a0: number, b0: number, aw: number, bd: number, h: number, alpha = 0.26) {
  const L = h * 0.014;
  const pts: [number, number][] = [];
  for (const [a, b] of [[a0, b0], [a0 + aw, b0], [a0 + aw, b0 + bd], [a0, b0 + bd]]) {
    const [x, y] = p.W(a, b);
    pts.push([x, y], [x + L, y + L * 0.25]);
  }
  // convex hull (monotone chain) in world space → screen polygon
  pts.sort((m, n) => m[0] - n[0] || m[1] - n[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const pt of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: number[][] = [];
  for (const pt of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  p.c.globalAlpha = alpha;
  poly(
    p.c,
    hull.map(([x, y]) => p.w.P(x, y, 0)),
    SHADOW,
  );
  p.c.globalAlpha = 1;
}

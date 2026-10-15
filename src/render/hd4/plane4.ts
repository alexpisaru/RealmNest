// 128×64 helpers for vertical planes of buildings: windows with panes,
// curtains, shutters and flower boxes; panel doors; timber beams; porch.
import { darken, lighten, mix } from '../color';
import { type FaceTex, type Light, type Mat, texPara } from '../hd/kit';
import { poly, type PropPainter, type V2 } from '../iso';
import { at, foliage, hash, type Mass, OUTL, px, R, type Ramp } from './kit4';
import { boards4, glass4 } from './materials4';

/** A vertical plane: F(u, z) → screen; light 1 = lit (world +y face), 0 = shaded (+x face). */
export interface Plane {
  F: (u: number, z: number) => V2;
  light: Light;
}
export const front = (p: PropPainter, b: number): Plane => ({ F: (u, z) => p.P(u, b, z), light: p.rot === 0 ? 1 : 0 });
export const side = (p: PropPainter, a: number): Plane => ({ F: (u, z) => p.P(a, u, z), light: p.rot === 0 ? 0 : 1 });

export function pq(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, col: string) {
  poly(p.c, [pl.F(u0, z0), pl.F(u1, z0), pl.F(u1, z1), pl.F(u0, z1)], col);
}

/** Textured rectangle on a plane (v measured up from z0). */
export function pt(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, mat: Mat | FaceTex, light?: Light) {
  const o = pl.F(u0, z0);
  const a = pl.F(u1, z0);
  const b = pl.F(u0, z1);
  const U: V2 = [a[0] - o[0], a[1] - o[1]];
  const V: V2 = [b[0] - o[0], b[1] - o[1]];
  // a Mat returns a FaceTex when given (light, w, h); a FaceTex returns a colour
  const probe = (mat as (a: number, b: number, c: number) => unknown)(light ?? pl.light, Math.hypot(...U), Math.hypot(...V));
  const tex = typeof probe === 'function' ? (probe as FaceTex) : (mat as FaceTex);
  texPara(p.c, o, U, V, tex);
}

/** Timber beam on a plane between two (u, z) points: wood grain, lit top edge, dark lower edge. */
export function beam(p: PropPainter, pl: Plane, u0: number, z0: number, u1: number, z1: number, t: number, ramp: Ramp = R.wood) {
  const a = pl.F(u0, z0);
  const b = pl.F(u1, z1);
  const h = t * 2; // t in world units → px at k=4 is 4·t; half thickness 2·t
  const vertical = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]) * 0.25;
  const lit = pl.light ? 3 : 1;
  if (vertical) {
    poly(p.c, [[a[0] - h, a[1]], [a[0] + h, a[1]], [b[0] + h, b[1]], [b[0] - h, b[1]]], ramp[lit]);
    poly(p.c, [[a[0] - h, a[1]], [a[0] - h + 1, a[1]], [b[0] - h + 1, b[1]], [b[0] - h, b[1]]], ramp[lit + 1]);
    poly(p.c, [[a[0] + h - 1, a[1]], [a[0] + h, a[1]], [b[0] + h, b[1]], [b[0] + h - 1, b[1]]], ramp[Math.max(0, lit - 2)]);
  } else {
    poly(p.c, [[a[0], a[1] - h], [b[0], b[1] - h], [b[0], b[1] + h], [a[0], a[1] + h]], ramp[lit]);
    poly(p.c, [[a[0], a[1] - h], [b[0], b[1] - h], [b[0], b[1] - h + 1], [a[0], a[1] - h + 1]], ramp[lit + 1]);
    poly(p.c, [[a[0], a[1] + h - 1], [b[0], b[1] + h - 1], [b[0], b[1] + h], [a[0], a[1] + h]], ramp[Math.max(0, lit - 2)]);
  }
}

export interface WindowOpts {
  frame?: string;
  shutters?: Ramp;
  box?: string[] | null;
  curtains?: string;
  panes?: 2 | 4 | 6;
  lit?: boolean;
  arch?: boolean;
}

/** Window: recess, frame, glass with reflections, muntins, curtains, sill, shutters, flower box. */
export function window4(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, o: WindowOpts = {}) {
  const fr = o.frame ?? '#f2ece0';
  const frc = pl.light ? fr : mix(fr, '#8a8aa0', 0.25);
  const du = (u1 - u0) * 0.08;
  const dz = (z1 - z0) * 0.07;
  pq(p, pl, u0 - 0.02, u1 + 0.02, z0 - 0.6, z1 + 0.6, mix(frc, OUTL, 0.7));
  pq(p, pl, u0, u1, z0, z1, frc);
  pt(p, pl, u0 + du, u1 - du, z0 + dz, z1 - dz, glass4(R.glass), pl.light ? 1 : 0);
  // interior darkness at the top and curtains tied to the sides
  pq(p, pl, u0 + du, u1 - du, z1 - dz - 1.2, z1 - dz, darken(R.glass[0], 0.3));
  if (o.curtains) {
    const cw = (u1 - u0) * 0.16;
    const cc = pl.light ? o.curtains : darken(o.curtains, 0.2);
    pq(p, pl, u0 + du, u0 + du + cw, z0 + dz + (z1 - z0) * 0.3, z1 - dz, cc);
    pq(p, pl, u1 - du - cw, u1 - du, z0 + dz + (z1 - z0) * 0.3, z1 - dz, cc);
    pq(p, pl, u0 + du, u0 + du + cw * 0.4, z0 + dz + (z1 - z0) * 0.3, z1 - dz, lighten(cc, 0.15));
  }
  // muntins
  const um = (u0 + u1) / 2;
  const zm = (z0 + z1) / 2;
  beam(p, pl, um, z0 + dz, um, z1 - dz, 0.5, [frc, frc, frc, frc, lighten(frc, 0.08), lighten(frc, 0.12)]);
  if ((o.panes ?? 4) >= 4) beam(p, pl, u0 + du, zm, u1 - du, zm, 0.45, [frc, frc, frc, frc, lighten(frc, 0.08), lighten(frc, 0.12)]);
  // sill with a shadow under it
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 1.6, z0, lighten(frc, 0.06));
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 2.2, z0 - 1.6, mix(frc, OUTL, 0.5));
  if (o.shutters) {
    const sw = (u1 - u0) * 0.46;
    for (const [a, b] of [[u0 - sw - 0.03, u0 - 0.03], [u1 + 0.03, u1 + 0.03 + sw]]) {
      pq(p, pl, a - 0.015, b + 0.015, z0 - 0.4, z1 + 0.4, mix(o.shutters[0], OUTL, 0.4));
      pt(p, pl, a, b, z0, z1, boards4(o.shutters, 6, false), pl.light);
      // Z-brace and two iron hinges
      beam(p, pl, a + 0.02, z0 + (z1 - z0) * 0.25, b - 0.02, z0 + (z1 - z0) * 0.25, 0.4, o.shutters);
      beam(p, pl, a + 0.02, z0 + (z1 - z0) * 0.75, b - 0.02, z0 + (z1 - z0) * 0.75, 0.4, o.shutters);
    }
  }
  if (o.box) flowerBox(p, pl, u0 - 0.06, u1 + 0.06, z0 - 2.2, o.box);
}

/** A planted window box hung under a sill: planks, then a spill of leaves and blooms. */
export function flowerBox(p: PropPainter, pl: Plane, u0: number, u1: number, z: number, blooms: string[]) {
  pq(p, pl, u0, u1, z - 5, z, mix(R.wood[1], OUTL, 0.3));
  pt(p, pl, u0 + 0.01, u1 - 0.01, z - 4.6, z - 0.4, (u: number, v: number) => at(R.wood, (pl.light ? 3 : 2) + (u % 13 < 1 ? -1 : 0) - (v < 1.5 ? 1 : 0)));
  const [ax, ay] = pl.F(u0, z);
  const [bx, by] = pl.F(u1, z);
  const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 7));
  const masses: Mass[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    masses.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t - 4, rx: 5, ry: 4.5, z: i });
  }
  foliage(p.c, masses, R.apple, Math.floor(ax * 7 + ay), { cell: 2.6, dots: blooms, dotChance: 0.75, dotSize: 3 });
  // trailing stems hanging over the front
  for (let i = 0; i < n; i += 2) {
    const t = (i + 0.5) / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (let j = 0; j < 6 + (i % 3) * 3; j++) px(p.c, x + (j % 4 === 3 ? 1 : 0), y + 2 + j, R.apple[2 + (j & 1)]);
  }
}

/** Panel door: frame, raised panels, a glazed top light, knob and kick plate. */
export function door4(p: PropPainter, pl: Plane, u0: number, u1: number, z0: number, z1: number, paint: Ramp, o: { glass?: boolean } = {}) {
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0, z1 + 1.8, mix(paint[0], OUTL, 0.5));
  const light = pl.light;
  const W = u1 - u0;
  const H = z1 - z0;
  pt(p, pl, u0, u1, z0, z1, (_u, _v, x, y) => at(paint, (light ? 3 : 1.6) - (hash(x, y, 4) < 0.04 ? 1 : 0)));
  // two raised panels below, a glazed light above
  const pan = (a: number, b: number, c: number, d: number) => {
    pq(p, pl, a, b, c, d, paint[light ? 2 : 1]);
    pq(p, pl, a + W * 0.04, b, c + H * 0.03, d, paint[light ? 4 : 2]);
    pq(p, pl, a + W * 0.04, b - W * 0.04, c + H * 0.03, d - H * 0.03, paint[light ? 3 : 1]);
  };
  pan(u0 + W * 0.12, u0 + W * 0.46, z0 + H * 0.08, z0 + H * 0.46);
  pan(u0 + W * 0.54, u1 - W * 0.12, z0 + H * 0.08, z0 + H * 0.46);
  if (o.glass !== false) {
    pq(p, pl, u0 + W * 0.12, u1 - W * 0.12, z0 + H * 0.56, z0 + H * 0.9, paint[0]);
    pt(p, pl, u0 + W * 0.15, u1 - W * 0.15, z0 + H * 0.58, z0 + H * 0.88, glass4(R.glass), light);
    beam(p, pl, (u0 + u1) / 2, z0 + H * 0.58, (u0 + u1) / 2, z0 + H * 0.88, 0.4, paint);
  } else pan(u0 + W * 0.12, u1 - W * 0.12, z0 + H * 0.56, z0 + H * 0.9);
  const [kx, ky] = pl.F(u0 + W * 0.84, z0 + H * 0.48);
  px(p.c, kx - 1, ky - 1, '#7a5a20', 3, 3);
  px(p.c, kx - 1, ky - 1, '#f2d27a', 2, 2);
  pq(p, pl, u0 + W * 0.04, u1 - W * 0.04, z0, z0 + H * 0.05, '#8a7a5a');
}

type V3 = [number, number, number];

/**
 * Textured planar polygon from prop-local 3D points, clipped exactly (walls
 * whose base follows a roof slope, dormer cheeks, chimney faces, roof valleys).
 * pts[0]→pts[1] sets the texture's u axis and pts[0]→pts[last] its v axis,
 * unless a basis (origin, u end, v end) is given — e.g. horizontal courses on
 * a face whose bottom edge is slanted.
 */
export function poly3(p: PropPainter, pts: V3[], mat: Mat | FaceTex, light: Light, basis?: [V3, V3, V3]) {
  const S = pts.map((q) => p.P(q[0], q[1], q[2]));
  const B = basis ? basis.map((q) => p.P(q[0], q[1], q[2])) : [S[0], S[1], S[S.length - 1]];
  const o = B[0];
  const e1: V2 = [B[1][0] - o[0], B[1][1] - o[1]];
  const e2: V2 = [B[2][0] - o[0], B[2][1] - o[1]];
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  if (Math.abs(det) < 1e-6) return;
  const st = S.map(([x, y]): [number, number] => {
    const dx = x - o[0];
    const dy = y - o[1];
    return [(dx * e2[1] - dy * e2[0]) / det, (e1[0] * dy - e1[1] * dx) / det];
  });
  let s0 = Infinity;
  let s1 = -Infinity;
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const [s, t] of st) {
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
  }
  const O: V2 = [o[0] + e1[0] * s0 + e2[0] * t0, o[1] + e1[1] * s0 + e2[1] * t0];
  const U: V2 = [e1[0] * (s1 - s0), e1[1] * (s1 - s0)];
  const V: V2 = [e2[0] * (t1 - t0), e2[1] * (t1 - t0)];
  const lu = Math.hypot(...U);
  const lv = Math.hypot(...V);
  if (lu < 0.5 || lv < 0.5) return;
  const probe = (mat as (a: number, b: number, c: number) => unknown)(light, lu, lv);
  const tex = typeof probe === 'function' ? (probe as FaceTex) : (mat as FaceTex);
  const inside = (s: number, t: number) => {
    let c = false;
    for (let i = 0, j = st.length - 1; i < st.length; j = i++) {
      const [si, ti] = st[i];
      const [sj, tj] = st[j];
      if (ti > t !== tj > t && s < ((sj - si) * (t - ti)) / (tj - ti) + si) c = !c;
    }
    return c;
  };
  texPara(p.c, O, U, V, (u, v, x, y) => (inside(s0 + (u / lu) * (s1 - s0), t0 + (v / lv) * (t1 - t0)) ? tex(u, v, x, y) : null));
}

/** Textured polygon on a vertical plane from (u, z) points. */
export function ppoly(p: PropPainter, pl: Plane & { at: (u: number, z: number) => V3 }, pts: [number, number][], mat: Mat | FaceTex, light?: Light) {
  poly3(p, pts.map(([u, z]) => pl.at(u, z)), mat, light ?? pl.light);
}

/** Planes that also know their 3D points (for poly3). */
export const front3 = (p: PropPainter, b: number) => ({ ...front(p, b), at: (u: number, z: number): V3 => [u, b, z] });
export const side3 = (p: PropPainter, a: number) => ({ ...side(p, a), at: (u: number, z: number): V3 => [a, u, z] });

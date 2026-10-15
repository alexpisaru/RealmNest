// Robotics — the light aircraft of the airfield at 128×64 (1 z ≈ 10 cm, 1 tile ≈ 1 m).
// Each plane is a mesh (see mesh.ts): a 12-sided lofted fuselage whose cabin facets
// are glazed, straight wings, tailplane and fin extruded from an airfoil section so
// they have real thickness, a spinner and a two-blade propeller, gear legs with
// tyres and hubs (spats on some), livery stripes, the registration and nav lights.
//   rob_plane  cessna (white/red high wing) · cub (yellow high wing, tailwheel) ·
//              robin (white/blue low wing, bubble canopy) · biplane (red) ·
//              club (white/teal high wing, taxiing: the propeller a blur, no chocks);
//              suffix '-rev' points the nose to −a. The +b side always faces the camera.
//   rob_glider a glider in its closed trailer · rob_steps a maintenance platform
import type { PropArt } from '../../../props';
import { contactShadow, ell, fillPoly, layer, ln, px, type Ramp, SHADOW } from '../../kit4';
import { front } from '../../plane4';
import { box, drawMesh, type Face, loft, orient, type Section, sheet, type V3 } from './mesh';
import { GALV, RUBBER, STEEL, stencil, YEL } from './rkit';

const WHITE: Ramp = ['#7e8088', '#9c9ea6', '#b8bac0', '#d0d2d6', '#e4e5e8', '#f2f3f4', '#fdfdfe'];
const CUBY: Ramp = ['#7a5410', '#a0721a', '#c89424', '#e2b02c', '#f2c436', '#f8d860', '#fcea98'];
const PRED: Ramp = ['#4a1214', '#6e1a1c', '#962424', '#bc3028', '#d84434', '#ea6a52', '#f49a80'];
const PBLUE: Ramp = ['#0e1e44', '#162c5e', '#1e3c7c', '#2a4e9a', '#3a64b8', '#5682d0', '#7aa2e2'];
const BLACK: Ramp = ['#0e0e12', '#16161c', '#1e1e26', '#282832', '#34343e', '#42424e', '#52525e'];
const TEAL_R: Ramp = ['#0e343c', '#134a55', '#1a6270', '#227c8c', '#2b98aa', '#3fb6c8', '#7ad6e2'];
/** cabin glazing: a light sky tint, brighter where it faces the sun */
const GLAZE: Ramp = ['#1c3442', '#2a4c5e', '#3c6678', '#52829a', '#6c9eb4', '#8cbccc', '#c4e2ea'];

interface Spec {
  wing: 'high' | 'low' | 'bi';
  gear: 'tri' | 'tail';
  len: number;
  span: number;
  body: Ramp;
  trim: Ramp;
  wingCol: Ramp;
  reg: string;
  spats: boolean;
  /** the cowling in the trim colour */
  nose: boolean;
  /** taxiing under its own power: the propeller turning, no chocks or tie-downs */
  taxi?: boolean;
}

const SPECS: Record<string, Spec> = {
  cessna: { wing: 'high', gear: 'tri', len: 7.6, span: 10, body: WHITE, trim: PRED, wingCol: WHITE, reg: 'D-EROB', spats: true, nose: false },
  club: { wing: 'high', gear: 'tri', len: 7.6, span: 10, body: WHITE, trim: TEAL_R, wingCol: WHITE, reg: 'D-ENSA', spats: true, nose: false, taxi: true },
  cub: { wing: 'high', gear: 'tail', len: 6.8, span: 10, body: CUBY, trim: BLACK, wingCol: CUBY, reg: 'N3C-K', spats: false, nose: false },
  robin: { wing: 'low', gear: 'tri', len: 7, span: 8.6, body: WHITE, trim: PBLUE, wingCol: WHITE, reg: 'F-GKBA', spats: true, nose: true },
  biplane: { wing: 'bi', gear: 'tail', len: 6, span: 6.6, body: PRED, trim: WHITE, wingCol: PRED, reg: 'G-BRAV', spats: true, nose: false },
};

type P2 = [number, number];
/** fuselage keys: [fraction of the length from the tail, centre offset z, half width (tiles), half height (z)] */
const HIGH: [number, number, number, number][] = [
  [0, 3.4, 0.05, 0.9],
  [0.12, 2.8, 0.14, 2.0],
  [0.3, 1.8, 0.3, 3.8],
  [0.46, 0.8, 0.5, 6.1],
  [0.54, 0.4, 0.6, 7.2],
  [0.74, 0.3, 0.62, 7.4],
  [0.8, -0.6, 0.56, 6.4],
  [0.9, -1.0, 0.47, 5.2],
  [1.0, -1.2, 0.34, 3.8],
];
const LOW: [number, number, number, number][] = [
  [0, 2.6, 0.05, 0.8],
  [0.12, 2.2, 0.14, 1.8],
  [0.3, 1.4, 0.3, 3.4],
  [0.46, 0.8, 0.46, 5.2],
  [0.52, 1.4, 0.54, 6.4],
  [0.66, 1.6, 0.56, 6.8],
  [0.76, 0.6, 0.53, 5.8],
  [0.82, -0.2, 0.47, 4.8],
  [0.92, -0.6, 0.41, 4.2],
  [1.0, -0.8, 0.31, 3.2],
];

/** An (s, z) polygon extruded across b from b0 to b1: wings, tailplanes, the fin. */
function prism(prof: [number, number][], b0: number, b1: number, col: Ramp | string, o: { caps?: [boolean, boolean]; dz?: number; after?: (f: number, scr: P2[]) => void } = {}): Face[] {
  const out: Face[] = [];
  let cs = 0;
  let cz = 0;
  for (const [s, z] of prof) {
    cs += s / prof.length;
    cz += z / prof.length;
  }
  for (let i = 0; i < prof.length; i++) {
    const [s0, z0] = prof[i];
    const [s1, z1] = prof[(i + 1) % prof.length];
    if (Math.abs(s1 - s0) < 1e-6 && Math.abs(z1 - z0) < 1e-6) continue;
    // the edge's outward normal in metric (s, z / 10)
    let ns = (z1 - z0) / 10;
    let nz = -(s1 - s0);
    const ms = (s0 + s1) / 2 - cs;
    const mz = ((z0 + z1) / 2 - cz) / 10;
    if (ns * ms + nz * mz < 0) {
      ns = -ns;
      nz = -nz;
    }
    const pts: V3[] = [
      [s0, b0, z0],
      [s1, b0, z1],
      [s1, b1, z1],
      [s0, b1, z0],
    ];
    const f: Face = { pts: orient(pts, [ns, 0, nz]), col, dz: o.dz };
    if (o.after) {
      const idx = i;
      f.after = (scr) => o.after!(idx, scr as P2[]);
    }
    out.push(f);
  }
  const [c0, c1] = o.caps ?? [true, true];
  if (c0) out.push({ pts: orient(prof.map(([s, z]) => [s, b0, z] as V3), [0, -1, 0]), col, dz: o.dz });
  if (c1) out.push({ pts: orient(prof.map(([s, z]) => [s, b1, z] as V3), [0, 1, 0]), col, dz: o.dz });
  return out;
}

/** An airfoil section: leading edge at sLE (toward the nose), the chord running back, thickness t (z) on a base z0. */
function airfoil(sLE: number, chord: number, z0: number, t: number): [number, number][] {
  const C = chord;
  return [
    [sLE, z0 + 0.4 * t],
    [sLE - 0.07 * C, z0 + 0.88 * t],
    [sLE - 0.3 * C, z0 + t],
    [sLE - C, z0 + 0.28 * t],
    [sLE - C, z0],
    [sLE - 0.3 * C, z0 - 0.02 * t],
    [sLE - 0.05 * C, z0 + 0.06 * t],
  ];
}

/** Clip an (s, z) polygon to the band z0 ≤ z ≤ z1 (fin stripes). */
function clipZ(poly: [number, number][], z0: number, z1: number): [number, number][] {
  const cut = (pts: [number, number][], keep: (z: number) => boolean, zc: number) => {
    const out: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i];
      const B = pts[(i + 1) % pts.length];
      const ka = keep(A[1]);
      const kb = keep(B[1]);
      if (ka) out.push(A);
      if (ka !== kb) {
        const t = (zc - A[1]) / (B[1] - A[1]);
        out.push([A[0] + (B[0] - A[0]) * t, zc]);
      }
    }
    return out;
  };
  return cut(cut(poly, (z) => z >= z0, z0), (z) => z <= z1, z1);
}

const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const rob_plane: PropArt = {
  draw(p, k) {
    const [kind, rev0] = (k.variant ?? 'cessna').split('-');
    const rev = rev0 === 'rev';
    const sp = SPECS[kind] ?? SPECS.cessna;
    const W = k.w;
    const D = k.d;
    const c = D / 2;
    const L = sp.len;
    const off = (W - L) / 2;
    const u = p.k / 4;
    const low = sp.wing === 'low';
    const bi = sp.wing === 'bi';
    const tail = sp.gear === 'tail';
    const faces: Face[] = [];
    const P2 = (s: number, b: number, z: number) => p.P(rev ? off + L - s : off + s, b, z) as P2;

    // ── the fuselage ──
    const keys = low || bi ? LOW : HIGH;
    const zc = low ? 11 : bi ? 10.6 : 12;
    const prof = (f: number) => {
      for (let i = 0; i + 1 < keys.length; i++) {
        const A = keys[i];
        const B = keys[i + 1];
        if (f <= B[0] || i + 2 === keys.length) {
          const t = Math.max(0, Math.min(1, (f - A[0]) / (B[0] - A[0])));
          return { z: zc + A[1] + (B[1] - A[1]) * t, w: A[2] + (B[2] - A[2]) * t, h: A[3] + (B[3] - A[3]) * t };
        }
      }
      return { z: zc, w: 0.3, h: 3 };
    };
    const at = (s: number): Section => ({ s, c, ...prof(s / L) });
    // glazing and posts: section breaks so every pane is whole facets
    const winB = low ? [0.5, 0.63, 0.65, 0.76, 0.82] : bi ? [0.55, 0.65] : [0.44, 0.52, 0.62, 0.65, 0.745, 0.8];
    const fr = [...new Set([...keys.map((q) => q[0]), ...winB, 0.05, 0.86, 0.95])].sort((a, b) => a - b);
    const secs = fr.map((f) => at(f * L));
    const N = 12;
    const ph = Math.PI / N;
    const colOf = (f: number, i: number): Ramp | string => {
      if (f < 0) return sp.nose ? sp.trim : sp.body;
      const fm = (fr[i] + fr[i + 1]) / 2;
      const t = ph + ((f + 0.5) / N) * Math.PI * 2;
      const sn = Math.round(Math.sin(t) * 100) / 100;
      const cs = Math.round(Math.cos(t) * 100) / 100;
      if (sp.nose && fm > 0.82) return sp.trim;
      if (low) {
        if (fm > 0.5 && fm < 0.82 && sn > 0.4 && !(fm > 0.63 && fm < 0.65)) return GLAZE;
      } else if (bi) {
        if (fm > 0.55 && fm < 0.65 && sn > 0.8) return '#1a1418';
      } else {
        if (fm > 0.52 && fm < 0.745 && Math.abs(sn - 0.5) < 0.4 && !(fm > 0.62 && fm < 0.65)) return GLAZE;
        if (fm > 0.745 && fm < 0.8 && sn > 0.3) return GLAZE;
        if (fm > 0.44 && fm < 0.52 && sn > 0.6) return GLAZE;
      }
      // the cheatline along the side under the windows, and a pinstripe below it
      if (fm > 0.05 && fm < 0.86 && cs > 0.9 && Math.abs(sn) < 0.1) return sp.trim;
      return sp.body;
    };
    const fus = loft('a', secs, N, colOf, { phase: ph });
    // glints on the panes and a pale pinstripe along the cheatline
    for (const f of fus) {
      if (f.col === GLAZE)
        f.after = (scr) => {
          if (scr.length < 4) return;
          const a = lerp(scr[0] as P2, scr[3] as P2, 0.25);
          const b = lerp(scr[1] as P2, scr[2] as P2, 0.6);
          ln(p.c, a[0], a[1], b[0], b[1], '#e4f4f8');
        };
    }
    faces.push(...fus);
    // the spinner: a cone to a point
    const ns = secs[secs.length - 1];
    faces.push(...loft('a', [{ s: ns.s, c, z: ns.z, w: ns.w * 0.62, h: ns.h * 0.62 }, { s: ns.s + 0.22, c, z: ns.z, w: ns.w * 0.5, h: ns.h * 0.5 }, { s: ns.s + 0.5, c, z: ns.z, w: 0.001, h: 0.001 }], 10, () => sp.trim, { phase: Math.PI / 10, caps: false }));

    // ── the tail: tailplane and fin ──
    const tq = at(0.08 * L);
    const tz = tq.z + tq.h * 0.2;
    const tc = 0.22 * L;
    const tspan = bi ? 2.6 : 3.6;
    for (const [b0, b1, col] of [
      [c - tspan / 2, c - 0.5, sp.wingCol],
      [c - 0.5, c + 0.5, sp.wingCol],
      [c + 0.5, c + tspan / 2, sp.wingCol],
    ] as const)
      faces.push(...prism(airfoil(tc + 0.06, tc, tz - 0.6, 1.3), b0, b1, col, { caps: [b0 < c - 1, b1 > c + 1] }));
    const finTop = tz + (low ? 12.5 : bi ? 10 : 12);
    const finP: [number, number][] = [
      [0.0, tz - 0.4],
      [0.27 * L, tz - 0.4],
      [0.27 * L - 0.6, tz + 1.4],
      [0.11 * L, finTop],
      [0.015 * L, finTop],
    ];
    const bands: [number, number, Ramp][] = [
      [tz - 0.4, tz + (finTop - tz) * 0.56, sp.body],
      [tz + (finTop - tz) * 0.56, tz + (finTop - tz) * 0.68, sp.trim],
      [tz + (finTop - tz) * 0.68, tz + (finTop - tz) * 0.76, sp.body],
      [tz + (finTop - tz) * 0.76, finTop, sp.trim],
    ];
    for (const [z0, z1, col] of bands) {
      const part = clipZ(finP, z0, z1);
      if (part.length >= 3) faces.push(...prism(part, c - 0.06, c + 0.06, col, { dz: 0.04 }));
    }

    // ── the wings ──
    const chord = low ? 1.75 : bi ? 1.25 : 1.55;
    const wLE = low ? 0.69 * L : bi ? 0.74 * L : 0.69 * L;
    const wz = low ? zc - 6.8 : bi ? zc - 5.6 : prof(0.6).z + prof(0.6).h + 0.2;
    const wt = low ? 2.4 : bi ? 1.6 : 2.2;
    const upperZ = zc + 9;
    const wingSet = (z: number, sLE: number, span: number, above: boolean) => {
      const n = Math.max(4, Math.round(span / 1.05));
      for (let i = 0; i < n; i++) {
        const b0 = c - span / 2 + (span * i) / n;
        const b1 = c - span / 2 + (span * (i + 1)) / n;
        const tip = i === 0 || i === n - 1;
        const r = tip ? sp.trim : sp.wingCol;
        const mid = b1 > c - 0.6 && b0 < c + 0.6;
        // a low wing's centre section sits under the cabin; a high wing's over it
        const dz = above ? 1 : low && mid ? -1.2 : 0;
        const ch = tip ? chord * 0.94 : chord;
        faces.push(
          ...prism(airfoil(sLE - (tip ? 0.04 : 0), ch, z, wt), b0, b1, r, {
            caps: [i === 0, i === n - 1],
            dz,
            after: (e, scr) => {
              // panel lines between the bays on the top, the flap and aileron hinge on the trailing face
              if (e === 2 && !mid) {
                const a = lerp(scr[0], scr[1], 0.55);
                const b = lerp(scr[3], scr[2], 0.55);
                ln(p.c, a[0], a[1], b[0], b[1], r[2]);
              }
              if (e === 1 || e === 2) ln(p.c, scr[0][0], scr[0][1], scr[1][0], scr[1][1], r[3]);
              if (e === 3) ln(p.c, scr[0][0], scr[0][1], scr[3][0], scr[3][1], r[1]);
            },
          }),
        );
      }
    };
    wingSet(wz, wLE, sp.span, sp.wing === 'high');
    if (bi) wingSet(upperZ, wLE + 0.35, sp.span * 0.96, true);
    // struts: a high wing's from the lower fuselage to the wing; a biplane's N-struts and cabane
    if (sp.wing === 'high')
      for (const sgn of [-1, 1]) {
        const q = at(0.6 * L);
        const b = c + sgn * sp.span * 0.25;
        const z0 = q.z - q.h * 0.55;
        faces.push(sheet([[0.59 * L, c + sgn * q.w * 0.8, z0], [0.62 * L, c + sgn * q.w * 0.8, z0 + 0.6], [0.62 * L, b, wz], [0.59 * L, b, wz - 0.3]], sp.body, { dz: 0.02 }));
      }
    if (bi)
      for (const sgn of [-1, 1]) {
        const b = c + sgn * sp.span * 0.36;
        faces.push(sheet([[wLE - chord + 0.15, b, wz + wt], [wLE - 0.2, b, wz + wt], [wLE + 0.15, b, upperZ], [wLE - chord + 0.5, b, upperZ]], STEEL, { dz: 0.02 }));
        faces.push(sheet([[wLE - 0.5, c + sgn * 0.3, zc + 4], [wLE - 0.35, c + sgn * 0.3, zc + 4], [wLE - 0.1, c + sgn * 0.5, upperZ], [wLE - 0.25, c + sgn * 0.5, upperZ]], STEEL, { dz: 0.02 }));
      }

    // ── landing gear ──
    const R = tail ? 3.4 : 3.2;
    const mainS = tail ? 0.73 * L : 0.6 * L;
    const track = low ? 1.25 : tail ? 1.05 : 1.2;
    const tyre = (s: number, b: number, r: number, spat: Ramp | null, dz = 0) => {
      const w = 0.09;
      const rw = r * 0.065;
      const fs = loft('b', [{ s: b - w, c: s, z: r, w: rw, h: r }, { s: b + w, c: s, z: r, w: rw, h: r }], 14, () => RUBBER, { phase: 0, caps: false, dz });
      faces.push(...fs);
      const ring: V3[] = [];
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) * Math.PI * 2;
        ring.push([s + rw * Math.cos(t), b + w, r + r * Math.sin(t)]);
      }
      faces.push({
        pts: orient(ring, [0, 1, 0]),
        col: RUBBER,
        dz,
        after: (scr) => {
          let x = 0;
          let y = 0;
          for (const q of scr) {
            x += q[0] / scr.length;
            y += q[1] / scr.length;
          }
          fillPoly(p.c, scr.map(([qx, qy]) => [x + (qx - x) * 0.58, y + (qy - y) * 0.58] as P2), GALV[3]);
          fillPoly(p.c, scr.map(([qx, qy]) => [x - 0.6 + (qx - x) * 0.44, y - 0.6 + (qy - y) * 0.44] as P2), GALV[5]);
          fillPoly(p.c, scr.map(([qx, qy]) => [x + (qx - x) * 0.18, y + (qy - y) * 0.18] as P2), GALV[1]);
        },
      });
      faces.push({ pts: orient(ring.map(([s2, , z]) => [s2, b - w, z] as V3), [0, -1, 0]), col: RUBBER, dz });
      if (spat)
        faces.push(
          ...loft(
            'a',
            [
              { s: s - 0.42, c: b, z: r + 0.5, w: 0.02, h: 0.5 },
              { s: s - 0.24, c: b, z: r + 0.6, w: 0.13, h: r * 0.9 },
              { s: s + 0.16, c: b, z: r + 0.5, w: 0.14, h: r * 0.95 },
              { s: s + 0.36, c: b, z: r + 0.2, w: 0.05, h: r * 0.5 },
            ],
            10,
            () => spat,
            { phase: Math.PI / 10, dz: dz + 0.05 },
          ),
        );
    };
    for (const sgn of [-1, 1]) {
      const q = at(mainS);
      const n0 = faces.length;
      const zTop = low ? wz : q.z - q.h * 0.8;
      const bTop = low ? c + sgn * track : c + sgn * q.w * 0.5;
      // a flat spring-steel leg, wide enough to read
      faces.push(sheet([[mainS - 0.1, bTop, zTop], [mainS + 0.1, bTop, zTop], [mainS + 0.06, c + sgn * track, R + 0.6], [mainS - 0.06, c + sgn * track, R + 0.6]], sp.spats ? sp.body : STEEL));
      tyre(mainS, c + sgn * (track + 0.03), R, sp.spats ? (sp.nose ? sp.trim : sp.body) : null);
      if (low) for (let j = n0; j < faces.length; j++) faces[j].dz = (faces[j].dz ?? 0) - 1.6;
    }
    if (tail) {
      const q = at(0.3);
      faces.push(sheet([[0.24, c, q.z - q.h * 0.8], [0.36, c, q.z - q.h * 0.8], [0.34, c, 1.4], [0.28, c, 1.4]], STEEL));
      tyre(0.3, c, 1.2, null);
    }
    else {
      const sN = 0.9 * L;
      faces.push(...box(sN - 0.04, c - 0.03, R, sN + 0.04, c + 0.03, at(sN).z - at(sN).h * 0.7, STEEL));
      tyre(sN, c, R * 0.85, sp.spats ? (sp.nose ? sp.trim : sp.body) : null, 0.02);
    }

    // ── the propeller ──
    const pa = ns.s + 0.26;
    const pz = ns.z;
    if (!sp.taxi) {
      faces.push(sheet([[pa, c - 0.07, pz + 0.6], [pa, c + 0.07, pz + 0.6], [pa, c + 0.11, pz + 8.6], [pa, c - 0.02, pz + 9.2]], BLACK, { dz: 0.3 }));
      faces.push(sheet([[pa, c - 0.07, pz - 0.6], [pa, c + 0.07, pz - 0.6], [pa, c + 0.02, pz - 8.8], [pa, c - 0.11, pz - 8.2]], BLACK, { dz: 0.3 }));
      faces.push(sheet([[pa, c + 0.012, pz + 8.0], [pa, c + 0.115, pz + 8.0], [pa, c + 0.11, pz + 8.6], [pa, c - 0.02, pz + 9.2]], YEL, { dz: 0.31 }));
      faces.push(sheet([[pa, c - 0.012, pz - 7.6], [pa, c - 0.115, pz - 7.6], [pa, c - 0.11, pz - 8.2], [pa, c + 0.02, pz - 8.8]], YEL, { dz: 0.31 }));
    }

    // map plane space onto the footprint: centred, nose to +a (or −a when reversed)
    const mesh = faces.map((f): Face => {
      const pts = f.pts.map(([s, b, z]) => [rev ? off + L - s : off + s, b, z] as V3);
      return { ...f, pts: rev ? pts.reverse() : pts };
    });

    // ── shadows on the apron, cast to the lower right by height ──
    const shadow = (pts: [number, number][], z: number) => {
      const dx = z * 1.5 * u;
      const dy = z * 0.45 * u;
      fillPoly(p.c, pts.map(([s, b]) => { const [x, y] = P2(s, b, 0); return [x + dx, y + dy] as P2; }), SHADOW);
    };
    p.c.globalAlpha = 0.24;
    shadow([[wLE - chord, c - sp.span / 2], [wLE, c - sp.span / 2], [wLE, c + sp.span / 2], [wLE - chord, c + sp.span / 2]], wz);
    shadow([[0.2, c - 0.3], [L, c - 0.5], [L, c + 0.5], [0.2, c + 0.3]], zc * 0.6);
    shadow([[0.06, c - tspan / 2], [tc + 0.06, c - tspan / 2], [tc + 0.06, c + tspan / 2], [0.06, c + tspan / 2]], tz);
    p.c.globalAlpha = 1;
    const [mx, my] = P2(L * 0.6, c, 0);
    contactShadow(p.c, mx + 12 * u, my + 4 * u, L * 16 * u, 12 * u, 0.26);
    for (const sgn of [-1, 1]) {
      const [gx, gy] = P2(mainS, c + sgn * (track + 0.03), 0);
      contactShadow(p.c, gx + 1 * u, gy, 7 * u, 2.4 * u, 0.5);
    }
    // chocks and tie-downs (parked planes only)
    if (!sp.taxi)
      for (const sgn of [-1, 1]) {
        for (const ds of [0.32, -0.32]) {
          const [cx, cy] = P2(mainS + ds, c + sgn * (track + 0.03), 0);
          px(p.c, cx - 4 * u, cy - 3 * u, YEL[3], 8 * u, 3 * u);
          px(p.c, cx - 4 * u, cy - 3 * u, YEL[5], 8 * u, 1 * u);
        }
        const [tx, ty] = P2(wLE - chord / 2, c + sgn * sp.span * 0.36, wz);
        const [gx, gy] = P2(wLE - chord / 2 + 0.3, c + sgn * sp.span * 0.38, 0);
        if (wz > 12) ln(p.c, tx, ty, gx, gy, '#d8c890');
        ell(p.c, gx, gy, 2 * u, 1 * u, '#5a5a60');
      }

    layer(p.c, (l) => drawMesh(p, mesh, { c: l, inflate: 0.4 }), { outline: 0.5 });

    // ── livery and details on the visible side ──
    const C2 = p.c;
    // the registration on the rear fuselage, legible
    {
      const sA = L * 0.17;
      const qA = at(sA);
      const qB = at(L * 0.21);
      const [ax, ay] = P2(sA, c + qA.w * 0.98, qA.z + qA.h * 0.1);
      const [bx, by] = P2(L * 0.21, c + qB.w * 0.98, qB.z + qB.h * 0.1);
      const dx = bx - ax;
      const ux = dx >= 0 ? 1 : -1;
      const uy = ((by - ay) / Math.abs(dx || 1)) * ux;
      const w = sp.reg.length * 4 - 1;
      const ox = dx >= 0 ? ax : ax - w;
      const oy = dx >= 0 ? ay - 5 : ay - 5 - uy * w;
      stencil(C2, sp.reg, ox, oy, u, uy * u, 0, u, sp.body === WHITE || sp.body === CUBY ? '#20222c' : '#f2f0ea');
    }
    // nav lights on the tips (red left, green right), a strobe on the fin
    const [lx0, ly0] = P2(wLE - chord / 2, c - sp.span / 2, wz + wt * 0.6);
    const [lx1, ly1] = P2(wLE - chord / 2, c + sp.span / 2, wz + wt * 0.6);
    px(C2, lx0 - 1 * u, ly0 - 1 * u, rev ? '#3aff6a' : '#ff3a2a', 2 * u, 2 * u);
    px(C2, lx1 - 1 * u, ly1 - 1 * u, rev ? '#ff3a2a' : '#3aff6a', 2 * u, 2 * u);
    const [fx, fy] = P2(0.02 * L, c, finTop);
    px(C2, fx - 1 * u, fy - 2 * u, '#ff4a3a', 2 * u, 2 * u);
    // the turning propeller of a taxiing plane: a pale disc and the blur of its blades
    if (sp.taxi) {
      const pts: P2[] = [];
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        pts.push(P2(pa, c + Math.cos(t) * 0.55, pz + Math.sin(t) * 8.8));
      }
      C2.globalAlpha = 0.22;
      fillPoly(C2, pts, '#d8dce0');
      C2.globalAlpha = 0.5;
      const [t0x, t0y] = P2(pa, c + 0.5, pz + 4);
      const [t1x, t1y] = P2(pa, c - 0.5, pz - 4);
      ln(C2, t0x, t0y, t1x, t1y, '#2a2a30', Math.max(1, Math.round(u)));
      C2.globalAlpha = 1;
    }
    // the cowling's air inlets, when the nose faces us
    const noseVis = (p.rot === 0 && !rev) || (p.rot === 1 && rev);
    if (noseVis)
      for (const sgn of [-1, 1]) {
        const [ix, iy] = P2(ns.s + 0.02, c + sgn * 0.2, ns.z - 1.8);
        ell(C2, ix, iy, 2 * u, 1.4 * u, '#16161c');
      }
    // the exhaust stub under the cowling and the step on the near leg
    const qe = at(L * 0.86);
    const [ex, ey] = P2(L * 0.86, c + qe.w * 0.7, qe.z - qe.h * 0.8);
    px(C2, ex - 1 * u, ey, '#3a3a40', 3 * u, 2 * u);
    void front;
  },
  lights(k) {
    const [kind] = (k.variant ?? 'cessna').split('-');
    const sp = SPECS[kind] ?? SPECS.cessna;
    if (!sp.taxi) return [];
    return [{ a: k.w / 2, b: k.d / 2, z: 24, r: 1.2, color: '#ff4a3a', kind: 'lamp' }];
  },
};

/** A glider in its trailer: a long white fibreglass box on a twin axle, the club stripe. */
const rob_glider: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = D / 2;
    const faces: Face[] = [];
    faces.push(...box(0.2, c - 0.05, 1.4, 0.9, c + 0.05, 1.8, STEEL));
    faces.push(
      ...loft(
        'a',
        [
          { s: 0.7, c, z: 7.6, w: 0.2, h: 3.6 },
          { s: 1.3, c, z: 8.4, w: 0.62, h: 6.4 },
          { s: W - 0.6, c, z: 8.4, w: 0.62, h: 6.4 },
          { s: W - 0.2, c, z: 8.4, w: 0.55, h: 5.8 },
        ],
        10,
        (f) => (f === 0 || f === 9 ? TEAL_R : WHITE),
        { phase: 0 },
      ),
    );
    for (const s of [W * 0.5 - 0.35, W * 0.5 + 0.35])
      for (const b of [c - 0.66, c + 0.66]) faces.push(...loft('b', [{ s: b - 0.08, c: s, z: 1.6, w: 0.16, h: 1.6 }, { s: b + 0.08, c: s, z: 1.6, w: 0.16, h: 1.6 }], 10, () => RUBBER, { phase: 0 }));
    const [x0, y0] = p.P(W / 2, c, 0);
    contactShadow(p.c, x0 + 14, y0 + 4, W * 28, 16, 0.28);
    layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
    const F = front(p, c + 0.6);
    const [tx, ty] = F.F(2.0, 10.6);
    stencil(p.c, 'ASK-21', tx, ty, 1.79, 0.9, 0, 1.6, '#2a2c34');
    void k;
  },
};

/** A yellow maintenance platform: steps up to a railed deck at wing height. */
const rob_steps: PropArt = {
  draw(p, k) {
    const faces: Face[] = [];
    for (let i = 0; i < 4; i++) faces.push(...box(0.2 + i * 0.12, 0.25, 1 + i * 3.2, 0.34 + i * 0.12, 0.75, 1.5 + i * 3.2, CUBY));
    faces.push(...box(0.62, 0.22, 12.6, 0.92, 0.78, 13.2, CUBY));
    for (const [a, b] of [[0.2, 0.25], [0.2, 0.71], [0.88, 0.25], [0.88, 0.71]] as const) faces.push(...box(a, b, 0.6, a + 0.04, b + 0.04, 12.6, STEEL));
    faces.push(...box(0.62, 0.22, 16.4, 0.92, 0.26, 16.8, CUBY, { dz: 0.1 }));
    faces.push(...box(0.88, 0.22, 13.2, 0.92, 0.78, 16.8, CUBY, { dz: 0.1 }));
    const [x0, y0] = p.P(0.5, 0.5, 0);
    contactShadow(p.c, x0 + 10, y0 + 2, 18, 6, 0.26);
    layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
    for (const [a, b] of [[0.22, 0.27], [0.22, 0.73], [0.9, 0.27], [0.9, 0.73]] as const) {
      const [wx, wy] = p.P(a, b, 0.3);
      ell(p.c, wx, wy, 2, 1.4, RUBBER[1]);
    }
    void k;
  },
};

export const ROBOTICS_PLANES: Record<string, PropArt> = { rob_plane, rob_glider, rob_steps };

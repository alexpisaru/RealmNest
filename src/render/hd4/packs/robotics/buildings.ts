// Robotics — the airfield's buildings at 128×64 (1 z ≈ 10 cm; a storey ≈ 34 z).
//   rob_hangar    arch (barrel vault, grey-green) · gable (rust red) · far (flat, distant);
//                 suffix '-open': two door leaves slid back, a plane's tail inside
//   rob_tower     the control tower: a rendered shaft, a gallery, the glazed octagonal cab,
//                 antennas and the rotating beacon
//   rob_terminal  the aero club: white render and larch boards, a glazed café, a canopy,
//                 flags, a radio mast, plant on the roof
//   rob_thangar   a row of T-hangars with bifold doors
//   rob_fuelfarm  two horizontal tanks in a bund, pipework, a pump cabinet
//   rob_container a 20-foot box (colour by variant)
//   rob_farm      a distant farmstead: house, barn, silo (flat shaded)
//   rob_far       distant low industrial buildings (flat shaded)
// The visible faces are the front (b = d, +y) and the side (a = w, +x).
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { at, bayer, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { box, cylinder, drawMesh, type Face, loft } from './mesh';
import { base, boxProfile, castConcrete, CONC, corrugated, enamel, GALV, GLASS, glassMat, RED, SHELL, STEEL, stencil, TEAL, YEL } from './rkit';

type Pl = Plane & { at: (u: number, z: number) => [number, number, number] };

// sampled from the reference: arched hangar roof #507466…#789f84, walls #4c6c5b…#5c7d6b
const GREENGREY: Ramp = ['#162a20', '#22402e', '#30563e', '#3e6a4e', '#4e7e5e', '#64946e', '#80ac88'];
// the red hangar: roof #7b2f24, walls #c14937…#d95844
const RUST: Ramp = ['#3e100c', '#5e1a12', '#7e261a', '#a03424', '#bc4430', '#d25640', '#e6765a'];
const RENDER: Ramp = ['#8c8a84', '#a8a69e', '#c2c0b8', '#d6d4cc', '#e6e4dc', '#f2f0e8', '#fbfaf4'];
// timber cladding #9d5c2b…#d39055
const LARCH: Ramp = ['#4e260e', '#6e3816', '#8e4c20', '#a8602c', '#be7438', '#d28c4e', '#e4a86c'];
const DARKWIN = '#1c2630';
const WHITE_R: Ramp = ['#8a8c92', '#a8aab0', '#c4c6ca', '#dadcde', '#eaebec', '#f6f6f7', '#ffffff'];

/** A crisp cast shadow on the ground: the footprint swept s tiles toward +a (the sun is upper left). */
function castShadow(p: PropPainter, a0: number, b0: number, a1: number, b1: number, s: number, alpha = 0.42) {
  p.c.globalAlpha = alpha;
  fillPoly(p.c, [p.P(a0, b0, 0), p.P(a1 + s, b0 + s * 0.25, 0), p.P(a1 + s, b1 + s * 0.25, 0), p.P(a0, b1, 0)], '#2a1a2a');
  p.c.globalAlpha = alpha * 0.5;
  fillPoly(p.c, [p.P(a1, b0, 0), p.P(a1 + s * 1.15, b0 + s * 0.3, 0), p.P(a1 + s * 1.15, b1 + s * 0.3, 0), p.P(a1, b1, 0)], '#2a1a2a');
  p.c.globalAlpha = 1;
}

// ── hangars ─────────────────────────────────────────────────
/** The inside of a hangar seen through open doors: lit floor, the far wall's ribs, trusses and lamps in the gloom. */
const interior: FaceTex = (u, v, x, y) => {
  if (v < 10) return v < 4 || bayer(x, y) > 0.35 ? '#7a756c' : '#6a665e';
  if (v < 14) return '#4e4a44';
  if (v < 96) {
    // the far wall: ribbed sheet in the gloom, a lit band where the lamps fall
    let c = u % 9 < 2 ? '#2a2c2a' : '#343634';
    if (v < 40 && bayer(x, y) > 0.5) c = u % 9 < 2 ? '#323432' : '#3e403c';
    return c;
  }
  if (Math.abs(((u + v * 1.4) % 46) - 23) < 1.2 || Math.abs(((u - v * 1.4 + 2000) % 46) - 23) < 1.2) return '#2e2c2a';
  if (v > 104 && v < 108 && u % 40 < 14) return '#f6eecc';
  return v > 120 ? '#141214' : '#1c1a18';
};

function hangarFront(p: PropPainter, F: Pl, W: number, Hw: number, rise: number, arch: boolean, clad: Mat, r: Ramp, open: boolean, seed: number) {
  const light = F.light;
  const D = F.at(0, 0)[1];
  // the cladding of the whole front, the gable on top
  pt(p, F, 0, W, 0, Hw, clad, light);
  // the gable as vertical strips of cladding (cheap), each topped by a sliver up to the curve
  const N = 16;
  const top = (a: number) => (arch ? Hw + rise * Math.sqrt(Math.max(0, 1 - ((a - W / 2) / (W / 2)) ** 2)) : Hw + rise * (1 - Math.abs(a - W / 2) / (W / 2)));
  const fill = at(r, light ? 3 : 1.6);
  for (let i = 0; i < N; i++) {
    const u0 = (i / N) * W;
    const u1 = ((i + 1) / N) * W;
    const z0 = top(u0);
    const z1 = top(u1);
    const zm = Math.min(z0, z1);
    if (zm > Hw + 0.2) pt(p, F, u0, u1, Hw, zm, clad, light);
    fillPoly(p.c, [F.F(u0, zm), F.F(u1, zm), F.F(u1, z1), F.F(u0, z0)], fill);
  }
  // the verge flashing along the curve
  for (let i = 0; i < N; i++) {
    const [x0, y0] = F.F((i / N) * W, top((i / N) * W));
    const [x1, y1] = F.F(((i + 1) / N) * W, top(((i + 1) / N) * W));
    ln(p.c, x0, y0, x1, y1, at(r, 5), 2);
  }
  // the doors: a steel header, six leaves on their track; two slid open if the hangar is in use
  const d0 = 0.6;
  const d1 = W - 0.6;
  const dz = Math.min(Hw + rise * 0.45, 46);
  pq(p, F, d0 - 0.2, d1 + 0.2, dz, dz + 2.6, at(STEEL, light ? 3 : 2));
  pq(p, F, d0 - 0.2, d1 + 0.2, dz + 2.3, dz + 2.6, at(STEEL, light ? 5 : 3));
  const n = 6;
  const lw = (d1 - d0) / n;
  const leaf: Mat = (lt, w, h) => {
    const sheet = boxProfile(r, { pitch: 10, rust: 0.5, grime: 10, seed: seed + 3 })(lt, w, h);
    return (u, v, x, y) => {
      if (u < 2.5 || u > w - 2.5) return at(r, (lt ? 2 : 1) - 0.4);
      if (v < 4) return Math.floor(u / 6) & 1 ? YEL[lt ? 4 : 3] : '#1d1c20';
      return sheet(u, v, x, y);
    };
  };
  if (open) {
    // the opening (leaves 3–4 slid behind 5–6), the lit hall, a high-wing's tail and a tool cart inside
    pt(p, F, d0 + lw * 2, d0 + lw * 4, 0, dz, interior, light);
    const [tx, ty] = F.F(d0 + lw * 2.6, 0);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[tx - 62, ty - 40], [tx + 46, ty - 54], [tx + 50, ty - 48], [tx - 58, ty - 34]], '#d8d6d0');
        fillPoly(l, [[tx - 62, ty - 40], [tx + 46, ty - 54], [tx + 46, ty - 56], [tx - 62, ty - 42]], '#f2f0ea');
        fillPoly(l, [[tx - 30, ty - 30], [tx + 40, ty - 50], [tx + 44, ty - 42], [tx - 24, ty - 22]], '#c8c6c0');
        fillPoly(l, [[tx - 4, ty - 44], [tx + 14, ty - 48], [tx + 8, ty - 98], [tx - 2, ty - 100]], '#e8e6e0');
        fillPoly(l, [[tx - 4, ty - 44], [tx, ty - 44], [tx + 1, ty - 99], [tx - 2, ty - 100]], '#ffffff');
        fillPoly(l, [[tx + 8, ty - 62], [tx + 12, ty - 63], [tx + 9, ty - 92], [tx + 6, ty - 92]], '#c8302a');
        px(l, tx - 10, ty - 44, '#1e1e24', 3, 18);
        px(l, tx + 56, ty - 60, '#2a2a30', 2, 60);
        ell(l, tx + 57, ty - 62, 6, 4, '#ffe6a0');
        px(l, tx - 50, ty - 16, '#b42e28', 18, 12);
        px(l, tx - 50, ty - 16, '#d24434', 18, 2);
        px(l, tx - 48, ty - 6, '#1a1a1e', 3, 3);
        px(l, tx - 36, ty - 6, '#1a1a1e', 3, 3);
      },
      { rect: [tx - 70, ty - 106, tx + 66, ty + 2] },
    );
  }
  // the leaves stand proud of the front on their tracks: a lit face, a dark edge, the number
  const leafBox = (u0: number, u1: number, t: number) => {
    if (F.light) lbox(p, u0, D, u1 - u0, t, 0.2, dz - 0.2, { front: leaf, side: enamel(STEEL), top: enamel(STEEL), edge: STEEL[0] });
    else lbox(p, D, u0, t, u1 - u0, 0.2, dz - 0.2, { front: enamel(STEEL), side: leaf, top: enamel(STEEL), edge: STEEL[0] });
  };
  for (let i = 0; i < n; i++) {
    if (open && (i === 2 || i === 3)) continue;
    const u0 = d0 + i * lw;
    leafBox(u0 + 0.02, u0 + lw - 0.02, i % 2 ? 0.08 : 0.14);
    const [nx, ny] = F.F(u0 + lw / 2 - 0.15, 9);
    stencil(p.c, String(i + 1), nx, ny + (i % 2 ? 4 : 7), 1.79, 0.9, 0, 2, '#f2f0ea');
  }
  if (open) for (let j = 0; j < 2; j++) leafBox(d0 + lw * (4 + j) + 0.12, d0 + lw * (5 + j) + 0.1, 0.24);
  // the gable: a painted hangar number, a strip of translucent sheets, a floodlight
  const gz = dz + 4;
  pq(p, F, W / 2 - 1.2, W / 2 + 1.2, gz + 3, gz + 9, '#f2f0ea');
  const [hx, hy] = F.F(W / 2 - 0.9, gz + 8);
  stencil(p.c, `HANGAR ${(seed % 7) + 2}`, hx, hy, 1.79 * 0.7, 0.9 * 0.7, 0, 1.4, '#1e1e24');
  if (rise > 18) pt(p, F, W / 2 - 3, W / 2 + 3, gz + 12, gz + 15, (u: number, _v: number, x: number, y: number) => (u % 14 < 1 ? at(r, 1) : bayer(x, y) > 0.3 ? '#d8dccc' : '#bcc2b2'), light);
  const [fx, fy] = F.F(W / 2, dz + 3.4);
  px(p.c, fx - 5, fy - 3, '#2a2a30', 10, 4);
  px(p.c, fx - 4, fy - 1, '#fff2c0', 8, 2);
}

/** A barrel vault roof as strips, corrugations running down the curve, translucent sheets, rust. */
function vault(p: PropPainter, W: number, D: number, Hw: number, rise: number, r: Ramp, flat: boolean, seed: number) {
  const N = 12;
  const z = (a: number) => Hw + rise * Math.sqrt(Math.max(0, 1 - ((a - W / 2) / (W / 2)) ** 2));
  const oh = 0.25;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * W;
    const a1 = ((i + 1) / N) * W;
    const z0 = z(a0);
    const z1 = z(a1);
    // the strip's slope decides its tone (lit facing +y/up, shaded facing +x)
    const slope = (z1 - z0) / ((a1 - a0) * 10);
    const nz = 1 / Math.sqrt(1 + slope * slope);
    const nx = -slope * nz;
    const lv = Math.max(0, -0.32 * nx + 0.76 * nz);
    const tone = 1 + lv * 4.8;
    const Q = (b0: number, b1: number): [number, number][] => [p.P(a0, b0, z0), p.P(a1, b0, z1), p.P(a1, b1, z1), p.P(a0, b1, z0)];
    fillPoly(p.c, Q(-oh, D + oh), at(r, tone));
    if (flat) {
      for (let b = 0.5; b < D; b += 1.6) {
        const [x0, y0] = p.P(a0, b, z0);
        const [x1, y1] = p.P(a1, b, z1);
        ln(p.c, x0, y0, x1, y1, at(r, tone - 1));
      }
      continue;
    }
    // translucent sheets in a few strips, rust where water sits, the corrugations
    const sky = i % 4 === 2;
    for (let b = 1.4; sky && b < D - 1; b += 3.2) fillPoly(p.c, Q(b, b + 1.1), tone > 3 ? '#aeb8ac' : '#96a094');
    for (let b = 0.6; b < D; b += 2.3) {
      if (hash(i, Math.floor(b * 10), seed) < 0.12) {
        p.c.globalAlpha = 0.28;
        fillPoly(p.c, Q(b, b + 0.2 + hash(i, Math.floor(b), seed + 1) * 0.5), '#7a4a34');
        p.c.globalAlpha = 1;
      }
    }
    for (let b = -oh + 0.11; b < D + oh; b += 0.22) {
      const [x0, y0] = p.P(a0, b, z0);
      const [x1, y1] = p.P(a1, b, z1);
      ln(p.c, x0, y0, x1, y1, at(r, tone - 1));
      const [x2, y2] = p.P(a0, b + 0.06, z0);
      const [x3, y3] = p.P(a1, b + 0.06, z1);
      ln(p.c, x2, y2, x3, y3, at(r, tone + 0.6));
    }
  }
  // turbine ventilators along the crown
  if (!flat)
    for (let b = 1.6; b < D - 1; b += 3) {
      const [vx, vy] = p.P(W / 2, b, Hw + rise + 0.4);
      layer(
        p.c,
        (l) => {
          px(l, vx - 3, vy - 6, at(r, 2), 6, 6);
          ell(l, vx, vy - 9, 6, 4, at(r, 1));
          ell(l, vx, vy - 10, 5.4, 3.4, '#a8acb0');
          for (let i = -4; i <= 4; i += 2) px(l, vx + i, vy - 12, '#7a7e84', 1, 4);
          ell(l, vx - 1, vy - 13, 4, 2, '#c8ccd0');
        },
        { rect: [vx - 9, vy - 18, vx + 9, vy + 2] },
      );
    }
  // a ridge vent along the crown, the eaves' shadow lines
  const [x0, y0] = p.P(W / 2, -oh, Hw + rise + 0.6);
  const [x1, y1] = p.P(W / 2, D + oh, Hw + rise + 0.6);
  ln(p.c, x0, y0, x1, y1, at(r, 5), 3);
  ln(p.c, x0, y0 + 3, x1, y1 + 3, at(r, 1));
  for (const a of [0, W]) {
    const [e0x, e0y] = p.P(a, -oh, Hw);
    const [e1x, e1y] = p.P(a, D + oh, Hw);
    ln(p.c, e0x, e0y + 1, e1x, e1y + 1, at(r, 0), 2);
  }
}

const rob_hangar: PropArt = {
  draw(p, k) {
    const [kind, state] = (k.variant ?? 'arch').split('-');
    const W = k.w;
    const D = k.d;
    const open = state === 'open';
    const far = kind === 'far';
    const arch = kind !== 'gable';
    const r = kind === 'gable' ? RUST : GREENGREY;
    const Hw = 40;
    const rise = arch ? Math.min(46, W * 2.8) : 24;
    footShadow(p, 0, 0, W, D, Hw + rise, 0.3);
    castShadow(p, 0, 0, W, D, far ? 0 : 2.4);
    const clad = far ? ((light: 0 | 1 | 2) => (u: number) => at(r, base(light, r.length) + (u % 14 < 1.4 ? -1 : 0))) as Mat : boxProfile(r, { pitch: 14, rust: 0.6, grime: 18, seed: k.seed });
    // the side wall (shaded): cladding, a personnel door, windows, downpipes
    const S = side3(p, W);
    pt(p, S, 0, D, 0, Hw, clad, S.light);
    if (!far) {
      for (let b = 1.5; b < D - 1; b += 3.2) {
        pq(p, S, b, b + 1.4, 22, 30, at(STEEL, 1));
        pt(p, S, b + 0.06, b + 1.34, 22.6, 29.4, glassMat(GLASS), S.light);
      }
      pq(p, S, D - 2.2, D - 1.3, 0, 21, at(STEEL, 2));
      pq(p, S, D - 2.15, D - 1.35, 0.2, 20.6, at(r, 1));
      for (const b of [0.3, D - 0.3]) pq(p, S, b - 0.07, b + 0.07, 0, Hw, GALV[2]);
    }
    // the roof
    if (arch) vault(p, W, D, Hw, rise, r, far, k.seed);
    else {
      const oh = 0.3;
      // the roof is a darker, weathered red than the walls (#7b2f24 in the reference)
      const RR: Ramp = ['#2e0a08', '#46120c', '#5e1a12', '#742418', '#862e20', '#9c3a28', '#b44a34'];
      const roofMat: Mat = (light) => (u, _v, x, y) => at(RR, base(light, RR.length) + (u % 9 < 1.4 ? -1.2 : u % 9 < 2.6 ? 0.6 : 0) + (hash(x, y, 7) < 0.02 ? -1 : 0));
      poly3(p, [[-oh, -oh, Hw], [W / 2, -oh, Hw + rise], [W / 2, D + oh, Hw + rise], [-oh, D + oh, Hw]], roofMat, 2, [[-oh, -oh, Hw], [-oh, D + oh, Hw], [W / 2, -oh, Hw + rise]]);
      poly3(p, [[W / 2, -oh, Hw + rise], [W + oh, -oh, Hw], [W + oh, D + oh, Hw], [W / 2, D + oh, Hw + rise]], roofMat, 0, [[W / 2, -oh, Hw + rise], [W / 2, D + oh, Hw + rise], [W + oh, -oh, Hw]]);
      // translucent sheets in rows on both slopes, the ridge cap, two ventilators, the gutter
      for (const [aA, aB, zA, zB] of [[W * 0.12, W * 0.3, Hw + rise * 0.24, Hw + rise * 0.6], [W * 0.7, W * 0.88, Hw + rise * 0.6, Hw + rise * 0.24]] as const)
        for (let b = 1.4; b < D - 1; b += 3.4) {
          // milky sheets laid over the profile: the corrugations show through, a pale lap at the top edge
          const q = [p.P(aA, b, zA), p.P(aB, b, zB), p.P(aB, b + 0.9, zB), p.P(aA, b + 0.9, zA)];
          p.c.globalAlpha = aA < W / 2 ? 0.3 : 0.2;
          fillPoly(p.c, q, '#eef0e6');
          p.c.globalAlpha = 1;
          ln(p.c, q[0][0], q[0][1], q[3][0], q[3][1], aA < W / 2 ? '#d8d4c8' : '#a8a296');
        }
      const [r0x, r0y] = p.P(W / 2, -oh, Hw + rise + 0.4);
      const [r1x, r1y] = p.P(W / 2, D + oh, Hw + rise + 0.4);
      ln(p.c, r0x, r0y, r1x, r1y, at(r, 5), 3);
      ln(p.c, r0x, r0y + 3, r1x, r1y + 3, at(r, 1));
      for (const b of [D * 0.3, D * 0.7]) {
        const [vx, vy] = p.P(W / 2, b, Hw + rise + 0.4);
        px(p.c, vx - 4, vy - 8, at(r, 2), 8, 8);
        ell(p.c, vx, vy - 9, 6, 3, '#9a9ea4');
        ell(p.c, vx, vy - 10, 4, 2, '#c4c8cc');
      }
      const [g0x, g0y] = p.P(W + oh, -oh, Hw - 0.4);
      const [g1x, g1y] = p.P(W + oh, D + oh, Hw - 0.4);
      ln(p.c, g0x, g0y, g1x, g1y, GALV[2], 2);
    }
    // the front with its doors
    const F = front3(p, D);
    if (far) {
      pt(p, F, 0, W, 0, Hw, clad, F.light);
      if (arch) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * W;
          pts.push([a, Hw + rise * Math.sqrt(Math.max(0, 1 - ((a - W / 2) / (W / 2)) ** 2))]);
        }
        fillPoly(p.c, [...pts.map(([u, z]) => F.F(u, z) as [number, number]), F.F(W, Hw) as [number, number], F.F(0, Hw) as [number, number]], at(r, 4));
      }
      pq(p, F, 0.6, W - 0.6, 0, 40, at(r, 3));
      for (let i = 1; i < 6; i++) pq(p, F, 0.6 + ((W - 1.2) * i) / 6 - 0.03, 0.6 + ((W - 1.2) * i) / 6 + 0.03, 0, 40, at(r, 1));
    } else hangarFront(p, F, W, Hw, rise, arch, clad, r, open, k.seed);
  },
  lights: (k) => {
    const [kind, state] = (k.variant ?? 'arch').split('-');
    if (kind === 'far') return [];
    const out: PropLight[] = [{ a: k.w / 2, b: k.d + 0.3, z: 46, r: 4.5, kind: 'lamp' }];
    if (state === 'open') out.push({ a: k.w * 0.45, b: k.d - 0.5, z: 12, r: 4, kind: 'window' });
    for (let b = 1.5; b < k.d - 1; b += 3.2) out.push({ a: k.w, b: b + 0.7, z: 26, r: 1.2, kind: 'window' });
    return out;
  },
};

// ── the control tower ───────────────────────────────────────
const rob_tower: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = W / 2;
    const cb = D / 2;
    const H = 78;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 100, 0.3);
    castShadow(p, 0.5, 0.5, W - 0.5, D - 0.5, 2.6, 0.3);
    // the shaft: rendered, a darker plinth, storey bands, a glazed stair core on the front
    const rend: Mat = (light, _w, h) => (_u, v, x, y) => {
      if (v < 6) return at(CONC, (light ? 3 : 1.6) + (hash(x, y, 3) < 0.05 ? -1 : 0));
      let i = base(light, RENDER.length);
      if (v % 26 < 1.4) i -= 1.2;
      if (hash(x, y, 4) < 0.03) i -= 0.7;
      if (v > h - 1.5) i += 0.6;
      return at(RENDER, i);
    };
    lbox(p, 0.5, 0.5, W - 1, D - 1, 0, H, { front: rend, side: rend, top: (_l) => () => RENDER[3], edge: RENDER[0] });
    const F = front3(p, D - 0.5);
    const S = side3(p, W - 0.5);
    for (let s = 0; s < 3; s++) {
      const z0 = 8 + s * 26;
      pq(p, F, 0.9, 1.8, z0, z0 + 12, DARKWIN);
      pt(p, F, 0.95, 1.75, z0 + 0.4, z0 + 11.6, glassMat(GLASS), F.light);
      pq(p, S, 1.2, D - 1.2, z0 + 2, z0 + 11, DARKWIN);
      pt(p, S, 1.25, D - 1.25, z0 + 2.4, z0 + 10.6, glassMat(GLASS), S.light);
    }
    // the stair core: a slot of glass up the front
    pq(p, F, W - 1.6, W - 1.0, 4, H - 4, DARKWIN);
    pt(p, F, W - 1.56, W - 1.04, 4.4, H - 4.4, glassMat(GLASS, 22), F.light);
    // the door at its foot, a sign
    pq(p, F, 2.2, 2.9, 0, 9, STEEL[2]);
    pq(p, F, 2.25, 2.85, 0.2, 8.6, TEAL[3]);
    pq(p, F, 1.9, 3.2, 10, 12, '#1e1e24');
    const [tx, ty] = F.F(2.0, 11.6);
    stencil(p.c, 'ATC', tx, ty, 1.79, 0.9, 0, 1.2, '#f2f0ea');
    // the gallery slab and its railing
    lbox(p, 0.1, 0.1, W - 0.2, D - 0.2, H, 1.6, { front: enamel(RENDER), side: enamel(RENDER), top: (_l) => (_u, _v, x, y) => (hash(x, y, 5) < 0.06 ? CONC[3] : CONC[4]), edge: RENDER[0] });
    // the cab: an octagon of outward-leaning glass under a deep roof
    const faces: Face[] = [];
    const glassCol: Ramp = ['#24404c', '#2e5260', '#3c6878', '#4e8090', '#6a9eac', '#94c0c8', '#c8e4e6'];
    // eight glass facets: radius 1.25 at the sill, 1.55 at the head
    const n = 8;
    const z0 = H + 3.4;
    const z1 = H + 23;
    for (let i = 0; i < n; i++) {
      const t0 = ((i + 0.5) / n) * Math.PI * 2;
      const t1 = ((i + 1.5) / n) * Math.PI * 2;
      const P0: [number, number, number] = [c + Math.cos(t0) * 1.25, cb + Math.sin(t0) * 1.25, z0];
      const P1: [number, number, number] = [c + Math.cos(t1) * 1.25, cb + Math.sin(t1) * 1.25, z0];
      const P2: [number, number, number] = [c + Math.cos(t1) * 1.55, cb + Math.sin(t1) * 1.55, z1];
      const P3: [number, number, number] = [c + Math.cos(t0) * 1.55, cb + Math.sin(t0) * 1.55, z1];
      faces.push({ pts: [P0, P1, P2, P3], col: glassCol });
      // mullion
      faces.push(...cylinder('z', c + Math.cos(t0) * 1.4, cb + Math.sin(t0) * 1.4, z0, 0.04, 0.04, z1 - z0, 4, STEEL));
    }
    // the sill band below the glass, the roof slab above
    faces.push(...cylinder('z', c, cb, H + 1.6, 1.3, 1.3, 1.8, 8, RENDER));
    faces.push(...cylinder('z', c, cb, z1, 1.64, 1.64, 0.6, 8, STEEL));
    faces.push(...cylinder('z', c, cb, z1 + 0.6, 1.6, 1.6, 0.7, 8, RENDER));
    layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
    // reflections and the controllers' silhouettes behind the glass
    const [gx, gy] = p.P(c - 0.2, cb + 1.3, z0 + 6);
    layer(
      p.c,
      (l) => {
        for (let i = 0; i < 3; i++) ln(l, gx - 30 + i * 22, gy + 8, gx - 22 + i * 22, gy - 26, 'rgba(220,240,240,0.25)', 3);
        // two heads and a console glow
        ell(l, gx - 10, gy - 2, 4, 5, '#0e1418');
        ell(l, gx + 14, gy - 4, 4, 5, '#0e1418');
        px(l, gx - 18, gy + 6, '#3fb6c8', 40, 2);
      },
      { outline: false, rect: [gx - 40, gy - 30, gx + 40, gy + 14] },
    );
    // railings round the gallery
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      for (const [a, b] of [[0.15 + t * (W - 0.3), D - 0.15], [W - 0.15, 0.15 + t * (D - 0.3)]] as const) {
        const [x0, y0] = p.P(a, b, H + 1.6);
        px(p.c, x0, y0 - 12, GALV[3], 1, 12);
      }
    }
    for (const [a0, b0, a1, b1] of [[0.15, D - 0.15, W - 0.15, D - 0.15], [W - 0.15, 0.15, W - 0.15, D - 0.15]] as const) {
      const [x0, y0] = p.P(a0, b0, H + 4.6);
      const [x1, y1] = p.P(a1, b1, H + 4.6);
      ln(p.c, x0, y0, x1, y1, GALV[4], 2);
    }
    // antennas, a wind vane with its cups, an obstruction light, the beacon mast
    const [rx, ry] = p.P(c, cb, z1 + 1.6);
    layer(
      p.c,
      (l) => {
        ln(l, rx - 10, ry, rx - 12, ry - 40, GALV[4]);
        ln(l, rx + 8, ry + 2, rx + 9, ry - 26, GALV[4]);
        px(l, rx + 1, ry - 26, GALV[3], 2, 26);
        ln(l, rx - 6, ry - 24, rx + 8, ry - 24, GALV[3]);
        for (const dx of [-6, 8]) ell(l, rx + dx, ry - 25, 2, 1.4, '#e8e6e0');
        px(l, rx - 13, ry - 42, RED[4], 2, 2);
        px(l, rx - 2, ry - 38, STEEL[2], 6, 10);
      },
      { rect: [rx - 20, ry - 50, rx + 16, ry + 4] },
    );
    void k;
  },
  lights: (k) => [
    { a: k.w / 2, b: k.d / 2 + 1.2, z: 92, r: 2.4, kind: 'window', color: '#e0f4ff' },
    { a: 1.4, b: k.d - 0.5, z: 14, r: 1.2, kind: 'window' },
    { a: 1.4, b: k.d - 0.5, z: 40, r: 1.2, kind: 'window' },
    { a: 2.5, b: k.d - 0.4, z: 10, r: 1.6, kind: 'lamp' },
  ],
  anim(p, k) {
    // the rotating aerodrome beacon: alternating green and white sweeps
    const W = k.w;
    const D = k.d;
    const [rx, ry] = p.P(W / 2, D / 2, 78 + 23 + 1.3);
    const u = p.k / 4;
    const ph = (k.t * 0.8) % 1;
    const col = ph < 0.5 ? '#9cffb0' : '#ffffff';
    ell(p.c, rx + 1 * u, ry - 40 * u, 3 * u, 2.4 * u, col);
    if (ph % 0.5 < 0.12) {
      p.c.globalAlpha = 0.3;
      ell(p.c, rx + 1 * u, ry - 40 * u, 10 * u, 6 * u, col);
      p.c.globalAlpha = 1;
    }
    if (Math.sin(k.t * 3) > 0.6) px(p.c, rx - 13 * u, ry - 42 * u, '#ff4a3a', Math.max(1, 2 * u), Math.max(1, 2 * u));
  },
};

// ── the aero club terminal ──────────────────────────────────
const rob_terminal: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const H = 34;
    footShadow(p, 0, 0, W, D, 40, 0.3);
    castShadow(p, 0, 0, W, D, 1.3);
    const rend = (light: 0 | 1 | 2, _w: number, h: number) => (_u: number, v: number, x: number, y: number) => {
      if (v < 5) return at(CONC, light ? 3 : 1.6);
      let i = base(light, RENDER.length);
      if (hash(x, y, 9) < 0.03) i -= 0.7;
      if (v > h - 1.5) i += 0.5;
      return at(RENDER, i);
    };
    const larch: Mat = (light) => (u, v, x, y) => {
      const bd = Math.floor(u / 6);
      let i = base(light, LARCH.length) + (hash(bd, 1, 11) - 0.5) * 1.2;
      if (u % 6 < 0.9) i -= 1.4;
      if (hash(x, y, 12) < 0.04) i -= 0.6;
      void v;
      return at(LARCH, i);
    };
    // the main block, a raised clerestory in the middle
    // a gravel-ballasted flat roof inside a pale coping
    const roof: Mat = () => (u, v, x, y) => {
      if (u < 3 || v < 3 || u > (W - 0.05) * 71.5 - 3) return RENDER[5];
      // a membrane roof in strips: welded seams, ballast gravel, a few puddle stains
      if (u % 48 < 1.2) return '#6a6862';
      if (u % 48 < 2.2) return '#a4a198';
      const g = hash(x, y, 13);
      if (hash(Math.floor(u / 40), Math.floor(v / 30), 14) < 0.12 && bayer(x, y) > 0.4) return '#6e6c66';
      return g < 0.14 ? '#62605a' : g > 0.9 ? '#aeaba2' : g > 0.75 ? '#959289' : '#85827a';
    };
    lbox(p, 0, 0, W, D, 0, H, { front: rend, side: rend, top: roof, edge: RENDER[0] });
    const F = front3(p, D);
    const S = side3(p, W);
    // larch-clad bays at the ends, a long glazed café between
    pt(p, F, 0, 2.6, 5, H - 2, larch, F.light);
    pt(p, F, W - 2.2, W, 5, H - 2, larch, F.light);
    pq(p, F, 2.8, W - 2.4, 4, H - 6, DARKWIN);
    pt(p, F, 2.9, W - 2.5, 4.4, H - 6.4, glassMat(GLASS, 40), F.light);
    for (let u = 2.9; u < W - 2.4; u += 1.2) pq(p, F, u, u + 0.06, 4, H - 6, STEEL[2]);
    pq(p, F, 2.8, W - 2.4, 15.5, 16.2, STEEL[2]);
    // the entrance canopy and a sign over it
    lbox(p, W - 5.2, D, 2.4, 1.1, 22, 0.8, { front: enamel(RENDER), side: enamel(RENDER), top: enamel(GALV), edge: GALV[0] });
    for (const a of [W - 5.1, W - 2.9]) lbox(p, a, D + 0.95, 0.08, 0.08, 0, 22, mono(enamel(GALV), GALV[0]));
    pq(p, F, 3.4, 9.4, H - 4.6, H - 1.4, TEAL[3]);
    const [sx, sy] = F.F(3.8, H - 2);
    stencil(p.c, 'AERO CLUB', sx, sy, 1.79 * 1.2, 0.9 * 1.2, 0, 1.8, '#f2f0ea');
    // the side: windows, a fire door
    pt(p, S, 0, D, 5, H - 2, larch, S.light);
    for (let b = 1; b < D - 1.5; b += 2.4) {
      pq(p, S, b, b + 1.3, 12, 24, DARKWIN);
      pt(p, S, b + 0.05, b + 1.25, 12.4, 23.6, glassMat(GLASS), S.light);
    }
    // the clerestory and the roof plant: a radio mast, AC units, solar panels
    lbox(p, W * 0.3, D * 0.25, W * 0.4, D * 0.5, H, 8, { front: rend, side: rend, top: (_l) => () => '#5e5e64', edge: RENDER[0] });
    const Fc = front3(p, D * 0.75);
    pq(p, Fc, W * 0.32, W * 0.68, H + 2, H + 6, DARKWIN);
    pt(p, Fc, W * 0.33, W * 0.67, H + 2.3, H + 5.7, glassMat(GLASS), Fc.light);
    for (let i = 0; i < 5; i++) {
      const a = 0.5 + i * 1.44;
      poly3(p, [[a, 0.6, H + 0.2], [a + 1.4, 0.6, H + 0.2], [a + 1.4, 1.9, H + 2.4], [a, 1.9, H + 2.4]], (u: number, v: number) => (u % 12 < 1 || v % 9 < 1 ? '#8a9aa8' : '#1e2a44'), 2);
    }
    // roof plant: two condensers with fan grilles, a duct, a roof hatch
    for (const a of [W - 2.6, W - 4.2]) {
      lbox(p, a, 1, 1.2, 0.9, H, 3.4, mono(enamel(SHELL), SHELL[0]));
      const [fx, fy] = p.P(a + 0.6, 1.45, H + 3.4);
      ell(p.c, fx, fy, 9, 4.5, '#3a3c42');
      ell(p.c, fx, fy, 2, 1, '#8a8c92');
    }
    lbox(p, W - 4.2, 2.2, 0.5, 2.4, H, 1.2, mono(enamel(GALV), GALV[0]));
    // more roof plant, as in the reference: white AC boxes along the clerestory, vent stacks, a cable tray
    for (let i = 0; i < 4; i++) {
      const a = W * 0.36 + i * 1.15;
      lbox(p, a, D * 0.78, 0.8, 0.55, H, 2.4, mono(enamel(SHELL), SHELL[0]));
      const [gx, gy] = front3(p, D * 0.78 + 0.55).F(a + 0.4, 1.4 + H);
      for (let j = -6; j <= 6; j += 3) px(p.c, gx + j, gy - 2, '#5a5e66', 2, 4);
    }
    for (const [a, b] of [[1.6, 3.2], [2.6, 4.4], [W - 1.6, D - 1.8], [W * 0.25, D - 1.2]] as const) {
      lbox(p, a, b, 0.2, 0.2, H, 2.6, mono(enamel(GALV), GALV[0]));
      lbox(p, a - 0.06, b - 0.06, 0.32, 0.32, H + 2.6, 0.5, mono(enamel(STEEL), STEEL[0]));
    }
    const [c0x, c0y] = p.P(W * 0.3, D * 0.9, H + 0.3);
    const [c1x, c1y] = p.P(W - 1, D * 0.9, H + 0.3);
    ln(p.c, c0x, c0y, c1x, c1y, GALV[2], 2);
    // the coping's lit edge
    const [e0x, e0y] = p.P(0, D, H);
    const [e1x, e1y] = p.P(W, D, H);
    ln(p.c, e0x, e0y - 1, e1x, e1y - 1, '#ffffff');
    lbox(p, 1.2, D - 2.4, 0.9, 0.9, H, 0.8, mono(enamel(GALV), GALV[0]));
    const [mx, my] = p.P(W - 1, D * 0.6, H);
    layer(
      p.c,
      (l) => {
        px(l, mx - 1, my - 80, GALV[3], 2, 80);
        for (let i = 0; i < 4; i++) ln(l, mx - 8 + i, my - 76 + i * 16, mx + 8 - i, my - 76 + i * 16, GALV[4]);
        px(l, mx - 1, my - 84, RED[4], 2, 3);
      },
      { rect: [mx - 12, my - 88, mx + 12, my + 2] },
    );
    // flags on three poles at the corner
    for (let i = 0; i < 3; i++) {
      const [fx, fy] = p.P(W + 0.6, D - 0.6 - i * 0.9, 0);
      const col = ['#2b98aa', '#f2c43a', '#d8402e'][i];
      layer(
        p.c,
        (l) => {
          px(l, fx, fy - 64, '#e8e6e0', 2, 64);
          fillPoly(l, [[fx + 2, fy - 64], [fx + 20, fy - 62], [fx + 18, fy - 52], [fx + 2, fy - 54]], col);
          px(l, fx + 2, fy - 60, '#ffffff', 16, 1);
        },
        { rect: [fx - 2, fy - 68, fx + 24, fy + 2] },
      );
    }
    void k;
  },
  lights: (k) => {
    const out: PropLight[] = [];
    for (let a = 3.6; a < k.w - 2.6; a += 2.2) out.push({ a, b: k.d, z: 10, r: 1.8, kind: 'window' });
    for (let b = 1.6; b < k.d - 1.5; b += 2.4) out.push({ a: k.w, b, z: 18, r: 1.2, kind: 'window' });
    out.push({ a: k.w - 4, b: k.d + 0.9, z: 21, r: 2.2, kind: 'lamp' });
    return out;
  },
};

// ── T-hangars ───────────────────────────────────────────────
const rob_thangar: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const H = 28;
    footShadow(p, 0, 0, W, D, 30, 0.3);
    castShadow(p, 0, 0, W, D, 1.1);
    const r = GREENGREY;
    const clad: Mat = (light) => (u: number) => at(r, base(light, r.length) + (u % 6 < 1.2 ? -0.9 : u % 6 < 2.4 ? 0.5 : 0));
    lbox(p, 0, 0, W, D, 0, H, { front: clad, side: clad, edge: r[0] });
    poly3(p, [[-0.2, -0.2, H + 6], [W + 0.2, -0.2, H + 6], [W + 0.2, D + 0.3, H], [-0.2, D + 0.3, H]], (u: number) => at(r, 4 + (u % 8 < 1.2 ? -1 : 0)), 2);
    const F = front3(p, D);
    const R0 = rng(k.seed * 3 + 1);
    // a row of bays: most stand open on a dim store of crates, a few behind roller doors
    const bays = Math.floor((W - 0.4) / 3.2);
    for (let i = 0; i < bays; i++) {
      const a = 0.4 + i * 3.2;
      const open = i % 3 !== 1 || R0() < 0.3;
      if (open) {
        pt(p, F, a, a + 2.9, 0, 19, (_u: number, v: number, x: number, y: number) => (v < 6 ? (bayer(x, y) > 0.4 ? '#3a3632' : '#2e2a28') : v > 66 ? '#141214' : bayer(x, y) > 0.7 ? '#24201e' : '#1a1816'), F.light);
        // the lamp inside and its pool, crates and cabinets on the floor
        const [lx, ly] = F.F(a + 1.45, 17.5);
        px(p.c, lx - 6, ly, '#f6eecc', 12, 2);
        p.c.globalAlpha = 0.18;
        fillPoly(p.c, [[lx - 6, ly + 2], [lx + 6, ly + 2], [lx + 30, ly + 60], [lx - 30, ly + 60]], '#fff0c0');
        p.c.globalAlpha = 1;
        const goods: Ramp[] = [YEL, ['#5a3e22', '#7a5630', '#9a7040', '#b88a52', '#d0a468', '#e2bc82'], ['#0e2a5a', '#163c7a', '#1e4e98', '#2a62b2', '#3a78c8', '#5a92da'], YEL];
        let u = a + 0.25;
        while (u < a + 2.4) {
          const w = 0.45 + R0() * 0.4;
          const h = 4 + R0() * 6;
          const g = goods[Math.floor(R0() * goods.length)];
          const u1 = Math.min(a + 2.7, u + w);
          pq(p, F, u, u1, 0.2, h, at(g, 3));
          pq(p, F, u, u1, h - 0.6, h, at(g, 5));
          pq(p, F, u, u + 0.06, 0.2, h, at(g, 1));
          pq(p, F, u + (u1 - u) * 0.4, u + (u1 - u) * 0.6, h * 0.5, h * 0.62, '#2a2a30');
          u = u1 + 0.08 + R0() * 0.3;
        }
        // the roller door wound up in its box
        pq(p, F, a - 0.1, a + 3.0, 19, 22, at(GREENGREY, 2));
        pq(p, F, a - 0.1, a + 3.0, 21.4, 22, at(GREENGREY, 4));
      } else {
        pq(p, F, a, a + 2.9, 0.2, 21, at(GREENGREY, F.light ? 3 : 1.6));
        for (let z = 1; z < 21; z += 0.9) pq(p, F, a, a + 2.9, z, z + 0.25, at(GREENGREY, F.light ? 2 : 1));
        pq(p, F, a, a + 2.9, 0.2, 2, at(GREENGREY, 1));
      }
      // the bay number, a lamp over each bay, a red sign on one
      pq(p, F, a + 0.9, a + 2.0, 23.2, 26, '#f2f0ea');
      const [tx, ty] = F.F(a + 1.05, 25.4);
      stencil(p.c, `T${i + 1}`, tx, ty, 1.79, 0.9, 0, 1.4, '#1e1e24');
      const [bx, by] = F.F(a + 2.6, 24);
      px(p.c, bx - 2, by - 2, '#2a2a30', 5, 3);
      px(p.c, bx - 1, by, '#fff2c0', 3, 1);
      if (i % 4 === 2) {
        pq(p, F, a + 0.2, a + 0.8, 10, 14, RED[3]);
        pq(p, F, a + 0.26, a + 0.74, 12.6, 13.4, '#f2f0ea');
      }
      // a pillar between bays: a lit edge, a dark crease
      pq(p, F, a + 2.95, a + 3.15, 0, H, at(GREENGREY, F.light ? 4 : 2));
      pq(p, F, a + 3.12, a + 3.15, 0, H, at(GREENGREY, 0));
    }
  },
  lights: (k) => {
    const out = [];
    for (let i = 0; i < Math.floor((k.w - 0.4) / 3.2); i++) out.push({ a: 0.4 + i * 3.2 + 2.6, b: k.d + 0.3, z: 24, r: 1.6, kind: 'lamp' as const });
    return out;
  },
};

// ── the fuel farm ───────────────────────────────────────────
const rob_fuelfarm: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0, 0, W, D, 20, 0.28);
    // the bund: a low concrete wall round the tanks
    const bund = castConcrete(CONC, 40);
    lbox(p, 0, 0, W, 0.25, 0, 6, { front: bund, side: bund, top: bund, edge: CONC[0] });
    lbox(p, 0, 0, 0.25, D, 0, 6, { front: bund, side: bund, top: bund, edge: CONC[0] });
    const faces: Face[] = [];
    const tanks: [number, Ramp, string][] = [[D * 0.32, RED, 'AVGAS'], [D * 0.7, ['#121216', '#1a1a20', '#24242c', '#30303a', '#3e3e4a', '#4e4e5c'], 'JET A1']];
    for (const [b] of tanks) {
      for (const a of [1.2, W - 1.6]) faces.push(...box(a, b - 0.7, 0, a + 0.4, b + 0.7, 4, CONC));
      faces.push(...loft('a', [{ s: 0.7, c: b, z: 11, w: 0.95, h: 9 }, { s: W - 0.7, c: b, z: 11, w: 0.95, h: 9 }], 14, () => SHELL, { phase: 0 }));
    }
    layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
    // coloured bands, stencils, a ladder and the walkway, pipes to the pump cabinet
    for (const [b, col, name] of tanks) {
      const F = front3(p, b + 0.95);
      pq(p, F, 1.0, W - 1.0, 7, 9.5, col[3]);
      const [tx, ty] = F.F(1.4, 12.8);
      stencil(p.c, name, tx, ty, 1.79 * 0.8, 0.9 * 0.8, 0, 1.3, '#3a3c44');
      const [lx, ly] = p.P(W - 0.8, b + 0.6, 0);
      for (let i = 0; i < 9; i++) px(p.c, lx - 3, ly - 6 - i * 9, GALV[4], 7, 1);
      ln(p.c, lx - 3, ly, lx - 3, ly - 84, GALV[3]);
      ln(p.c, lx + 3, ly, lx + 3, ly - 84, GALV[3]);
    }
    lbox(p, W - 0.9, D - 1.0, 0.7, 0.7, 0, 9, { front: enamel(SHELL), side: enamel(SHELL), top: enamel(SHELL), edge: SHELL[0] });
    const [px0, py0] = p.P(1, D * 0.32, 3);
    const [px1, py1] = p.P(W - 0.6, D - 0.6, 3);
    ln(p.c, px0, py0, px1, py1, GALV[4], 2);
    const [sx, sy] = p.P(W * 0.4, 0.2, 7);
    fillPoly(p.c, [[sx, sy - 6], [sx + 6, sy + 4], [sx - 6, sy + 4]], '#1e1e24');
    fillPoly(p.c, [[sx, sy - 4], [sx + 4, sy + 3], [sx - 4, sy + 3]], YEL[4]);
  },
};

// ── a shipping container ────────────────────────────────────
const CONT: Record<string, Ramp> = {
  blue: ['#06244a', '#0a3466', '#0e4a8a', '#145eaa', '#1a70c2', '#3a8ad4'],
  red: ['#4a1210', '#6a1a16', '#8a241e', '#a83028', '#c44234', '#d85a48'],
  green: ['#143422', '#1c462c', '#245a38', '#2e6e44', '#3a8452', '#4c9a62'],
  orange: ['#5a2a10', '#7e3a16', '#a24c1c', '#c46224', '#e07a30', '#f09848'],
};
const rob_container: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const r = CONT[k.variant ?? Object.keys(CONT)[k.seed % 4]] ?? CONT.blue;
    footShadow(p, 0, 0.1, W, D - 0.1, 26, 0.28);
    const cl = corrugated(r, { pitch: 7, rust: 0.6, seed: k.seed, grime: 6, lap: 200 });
    lbox(p, 0.1, 0.2, W - 0.2, D - 0.4, 0.4, 25, { front: cl, side: cl, top: (_l) => (u: number) => at(r, 3 + (u % 8 < 1 ? -1 : 0)), edge: r[0] });
    // the doors with their locking bars on the visible end
    const S = side3(p, W - 0.1);
    pq(p, S, 0.2 + (D - 0.4) / 2 - 0.02, 0.2 + (D - 0.4) / 2 + 0.02, 0.8, 25, r[0]);
    for (const b of [0.5, 0.8, D - 0.8, D - 0.5]) pq(p, S, b, b + 0.04, 1, 25, GALV[3]);
    const F = front3(p, D - 0.2);
    const [tx, ty] = F.F(0.6, 22);
    stencil(p.c, 'RBTU 220481', tx, ty, 1.34, 0.67, 0, 1.2, '#f2f0ea');
  },
};

// ── distant farmsteads and buildings (flat shaded) ──────────
function flatBox(p: PropPainter, a: number, b: number, w: number, d: number, h: number, r: Ramp, roof: Ramp | null, rise = 0) {
  const f0 = p.P(a, b + d, 0);
  const f1 = p.P(a + w, b + d, 0);
  const f2 = p.P(a + w, b + d, h);
  const f3 = p.P(a, b + d, h);
  const s1 = p.P(a + w, b, 0);
  const s2 = p.P(a + w, b, h);
  fillPoly(p.c, [f0, f1, f2, f3], r[3]);
  fillPoly(p.c, [f1, s1, s2, f2], r[1]);
  if (roof) {
    const A = p.P(a - 0.2, b + d + 0.2, h);
    const B = p.P(a + w + 0.2, b + d + 0.2, h);
    const Cc = p.P(a + w + 0.2, b + d / 2, h + rise);
    const Dd = p.P(a - 0.2, b + d / 2, h + rise);
    const E = p.P(a + w + 0.2, b - 0.2, h);
    fillPoly(p.c, [A, B, Cc, Dd], roof[4]);
    fillPoly(p.c, [B, E, Cc], roof[2]);
    ln(p.c, Dd[0], Dd[1], Cc[0], Cc[1], roof[5], 2);
    ln(p.c, A[0], A[1] + 1, B[0], B[1] + 1, roof[0], 2);
  } else {
    const t = [p.P(a, b, h), p.P(a + w, b, h), p.P(a + w, b + d, h), p.P(a, b + d, h)];
    fillPoly(p.c, t, r[4]);
  }
}

const TILE: Ramp = ['#5e1610', '#821e16', '#a42a1e', '#bd4436', '#d05444', '#e2705e'];
const SLATER: Ramp = ['#2a2c32', '#34363e', '#40424c', '#4c4e5a', '#5a5c68', '#6a6c78'];
/** The farmhouse beyond the road: white walls, a red tiled roof, a grey silo and a lean-to. */
const rob_farm: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0, 0, W, D, 30, 0.3);
    // the silo first (it stands behind the house)
    const faces = cylinder('z', W * 0.16, D * 0.3, 0, 0.95, 0.95, 54, 12, GALV);
    drawMesh(p, faces);
    const [cx, cy] = p.P(W * 0.16, D * 0.3, 54);
    ell(p.c, cx, cy, 15, 7.5, GALV[5]);
    ell(p.c, cx - 2, cy - 3, 9, 4, GALV[6]);
    for (let z = 8; z < 54; z += 9) {
      const [rx, ry] = p.P(W * 0.16 + 0.67, D * 0.3 + 0.67, z);
      px(p.c, rx - 30, ry, GALV[2], 30, 1);
    }
    // a timber lean-to behind
    flatBox(p, W * 0.3, 0.4, W * 0.4, D * 0.3, 22, LARCH, SLATER, 6);
    // the house
    const a0 = W * 0.3;
    const b0 = D * 0.42;
    const w = W * 0.62;
    const d = D * 0.42;
    const h = 30;
    flatBox(p, a0, b0, w, d, h, RENDER, TILE, 18);
    // roof tiles: rows of darker courses on the lit slope
    for (let t = 0.15; t < 1; t += 0.14) {
      const [x0, y0] = p.P(a0 - 0.2, b0 + d + 0.2 - (d / 2 + 0.2) * t, h + 18 * t);
      const [x1, y1] = p.P(a0 + w + 0.2, b0 + d + 0.2 - (d / 2 + 0.2) * t, h + 18 * t);
      ln(p.c, x0, y0, x1, y1, TILE[2]);
    }
    const F = front3(p, b0 + d);
    const S = side3(p, a0 + w);
    for (let i = 0; i < 4; i++) {
      const u = a0 + 0.5 + i * (w - 1) / 4;
      if (i === 2) {
        pq(p, F, u, u + 0.7, 0, 18, '#5a3418');
        pq(p, F, u + 0.05, u + 0.65, 0.2, 17.4, '#7a4a24');
        pq(p, F, u + 0.32, u + 0.38, 0.2, 17.4, '#4a2a12');
        continue;
      }
      for (const z0 of [6, 19]) {
        pq(p, F, u - 0.05, u + 0.75, z0 - 0.5, z0 + 8.5, '#d8d6cc');
        pq(p, F, u, u + 0.7, z0, z0 + 8, '#1a3c52');
        pq(p, F, u, u + 0.32, z0 + 4, z0 + 8, '#3a6a84');
        pq(p, F, u + 0.33, u + 0.37, z0, z0 + 8, '#e8e6dc');
        pq(p, F, u - 0.1, u + 0.8, z0 - 1, z0 - 0.4, '#a8a69e');
      }
    }
    for (const bb of [b0 + 0.6, b0 + d - 1.4]) {
      pq(p, S, bb, bb + 0.7, 19, 27, '#122a3a');
      pq(p, S, bb + 0.05, bb + 0.3, 23, 27, '#2a5068');
    }
    // a chimney
    const [chx, chy] = p.P(a0 + w * 0.7, b0 + d / 2, h + 18);
    px(p.c, chx - 5, chy - 22, RENDER[3], 6, 22);
    px(p.c, chx + 1, chy - 20, RENDER[1], 4, 20);
    px(p.c, chx - 6, chy - 24, TILE[1], 12, 3);
    void k;
  },
  lights: (k) => [
    { a: k.w * 0.3 + 0.9, b: k.d * 0.84, z: 10, r: 1.2, kind: 'window' },
    { a: k.w * 0.3 + 4.4, b: k.d * 0.84, z: 22, r: 1.2, kind: 'window' },
    { a: k.w * 0.3 + 3.1, b: k.d * 0.84 + 0.2, z: 18, r: 1.6, kind: 'lamp' },
  ],
};

const rob_far: PropArt = {
  draw(p, k) {
    const R0 = rng(k.seed * 3 + 11);
    const W = k.w;
    const D = k.d;
    const blocks: [number, number, number, number, number, Ramp, boolean][] = [];
    for (let a = 0; a < W - 1; a += 3 + R0() * 3)
      for (let b = 0; b < D - 1; b += 3 + R0() * 3) {
        const w = Math.min(W - a, 2.6 + R0() * 4);
        const d = Math.min(D - b, 2.4 + R0() * 3);
        const pick = R0();
        const r = pick < 0.35 ? GREENGREY : pick < 0.55 ? RUST : pick < 0.8 ? RENDER : SLATER;
        blocks.push([a, b, w, d, 24 + Math.floor(R0() * 4) * 8, r, pick > 0.55 && pick < 0.8]);
      }
    blocks.sort((m, n) => m[0] + m[1] - (n[0] + n[1]));
    for (const [a, b, w, d, h, r, house] of blocks) {
      flatBox(p, a, b, w, d, h, r, house ? TILE : null, house ? 10 : 0);
      if (!house) {
        const t = [p.P(a, b, h), p.P(a + w, b, h), p.P(a + w, b + d, h), p.P(a, b + d, h)];
        fillPoly(p.c, t, at(r, 2));
        const F = front3(p, b + d);
        for (let u = a + 0.4; u < a + w - 0.6; u += 1.4) pq(p, F, u, u + 0.7, 6, h - 6, at(r, 1));
      } else {
        const F = front3(p, b + d);
        for (let u = a + 0.4; u < a + w - 0.5; u += 1) pq(p, F, u, u + 0.4, h * 0.4, h * 0.75, '#2e3a44');
      }
    }
  },
};

// ── navigation and weather ─────────────────────────────────
/** A DVOR beacon: a white shelter under its counterpoise disc, a ring of antenna masts. */
const rob_vor: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = W / 2;
    const cb = D / 2;
    footShadow(p, 0.3, 0.3, W - 0.3, D - 0.3, 14, 0.22);
    // the gravel ring the masts stand on
    const [gx, gy] = p.P(c, cb, 0);
    const R = Math.min(W, D) * 0.46;
    ell(p.c, gx, gy, R * 64, R * 32, '#8a877e');
    ell(p.c, gx, gy, R * 64 - 4, R * 32 - 2, '#9a978e');
    const faces: Face[] = [];
    // the counterpoise: a flat disc on legs, the shelter under it, the central antenna
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      faces.push(...cylinder('z', c + Math.cos(t) * 1.1, cb + Math.sin(t) * 1.1, 0, 0.05, 0.05, 12, 4, GALV));
    }
    faces.push(...cylinder('z', c, cb, 0, 0.7, 0.7, 9, 8, WHITE_R));
    faces.push(...cylinder('z', c, cb, 12, 1.5, 1.5, 0.6, 12, GALV));
    faces.push(...cylinder('z', c, cb, 12.6, 0.22, 0.22, 7, 8, WHITE_R));
    drawMesh(p, faces);
    const [dx, dy] = p.P(c + 0.4, cb + 0.6, 0);
    px(p.c, dx - 3, dy - 18, '#2a2c32', 6, 18);
    // the ring of antenna masts with their little dipoles
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const [mx, my] = p.P(c + Math.cos(t) * R, cb + Math.sin(t) * R, 0);
      px(p.c, mx, my - 30, '#d8d6d0', 2, 30);
      px(p.c, mx - 3, my - 32, '#f2f0ea', 8, 2);
      px(p.c, mx - 1, my - 28, '#c83a2a', 4, 2);
    }
    void k;
  },
};

/** The met garden: a Stevenson screen, a rain gauge, the anemometer mast, a low fence. */
const rob_met: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 10, 0.2);
    // the screen: a white louvred box on four legs
    for (const [a, b] of [[0.5, 0.5], [1.0, 0.5], [0.5, 0.9], [1.0, 0.9]] as const) lbox(p, a, b, 0.05, 0.05, 0, 8, mono(enamel(WHITE_R), WHITE_R[0]));
    const louvre: Mat = (light) => (_u, v) => at(WHITE_R, (light ? 4 : 2.4) + (v % 3 < 1 ? -1 : 0));
    lbox(p, 0.42, 0.42, 0.7, 0.56, 8, 4.2, { front: louvre, side: louvre, top: enamel(WHITE_R), edge: WHITE_R[0] });
    lbox(p, 0.38, 0.38, 0.78, 0.64, 12.2, 0.6, mono(enamel(WHITE_R), WHITE_R[0]));
    // a rain gauge, the mast with cups and vane
    const [rx, ry] = p.P(1.5, 1.4, 0);
    px(p.c, rx - 3, ry - 8, GALV[4], 6, 8);
    px(p.c, rx - 3, ry - 8, GALV[6], 2, 8);
    ell(p.c, rx, ry - 8, 3, 1.4, GALV[2]);
    const [mx, my] = p.P(W - 0.4, 0.4, 0);
    layer(
      p.c,
      (l) => {
        px(l, mx - 1, my - 120, GALV[3], 3, 120);
        px(l, mx - 1, my - 120, GALV[5], 1, 120);
        ln(l, mx - 10, my - 122, mx + 10, my - 122, GALV[2]);
        for (const dx of [-10, 10]) ell(l, mx + dx, my - 123, 2.4, 1.6, '#e8e6e0');
        ln(l, mx, my - 128, mx + 12, my - 130, GALV[3]);
        fillPoly(l, [[mx + 10, my - 133], [mx + 16, my - 131], [mx + 10, my - 127]], '#c83a2a');
        for (const s of [-1, 1]) ln(l, mx, my - 100, mx + s * 26, my + 2, '#a8aab0');
      },
      { rect: [mx - 30, my - 136, mx + 30, my + 4] },
    );
    // a knee-high picket fence round the garden
    for (let a = 0.05; a <= W - 0.05; a += 0.2) {
      const [fx, fy] = p.P(a, D - 0.05, 0);
      px(p.c, fx, fy - 9, '#f2f0ea', 1, 9);
      const [sx, sy] = p.P(W - 0.05, a * (D / W), 0);
      px(p.c, sx, sy - 9, '#d8d6d0', 1, 9);
    }
    const [f0x, f0y] = p.P(0.05, D - 0.05, 5);
    const [f1x, f1y] = p.P(W - 0.05, D - 0.05, 5);
    ln(p.c, f0x, f0y, f1x, f1y, '#f2f0ea');
    void k;
  },
};

export const ROBOTICS_BUILDINGS: Record<string, PropArt> = { rob_hangar, rob_tower, rob_terminal, rob_thangar, rob_fuelfarm, rob_container, rob_farm, rob_far, rob_vor, rob_met };

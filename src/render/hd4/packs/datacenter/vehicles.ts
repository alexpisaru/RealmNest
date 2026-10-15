// Data Center — the site's vehicles and boat as real volumes (1 z ≈ 10 cm, a tile ≈ 1.6 m).
//   dc_car         pickups and SUVs parked nose-in to the road ('red-pickup', 'white-suv', …):
//                  a painted body on four tyres in their arches, a glasshouse with pillars,
//                  tail lights, plate, mirrors, door lines, snow on the roof, bonnet and bed
//   dc_plough      the gritter-plough parked by the hall, its beacons turning
//   dc_ploughM     the same truck working the site road (a vehicle line): its art 'back' has
//                  the nose at a = 0, so it always drives blade-first
//   dc_snowmobile  a snowmobile: two skis on spindles, the track under its tunnel, the hood,
//                  a windscreen, the long seat, bars, running boards
//   dc_boat        a green rowboat moored by the jetty, afloat among the floes
//
// Bodies are extruded side profiles (prism): every face whose normal looks at the viewer
// is drawn with its own light (top 2, the world +y face 1, the world +x face 0). Wheels are
// true discs in the flank's vertical plane, so they come out as tilted iso ellipses.
import { darken, lighten } from '../../../color';
import type { Light, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { ell, fillPoly, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { paint } from '../materials';
import { footShadow, lbox, mono } from '../util';
import { at, label, unit } from './kit';
import { ICE, ORA, RACK, SNOW, STEEL, YEL } from './palette';
import { snowLayer, snowSlab } from './room';

type V2 = [number, number];
type V3 = [number, number, number];
const TYRE: Ramp = ['#0c0d10', '#16181c', '#202328', '#2c3036', '#3a3f46'];
const GLASS = { dark: '#2a4256', mid: '#3e5c74', pale: '#9cc4dc', glint: '#e6f4fc' };

/** Does a local face normal (na along a, nz' along z in tile units) face the viewer? */
const seen = (p: PropPainter, na: number, nz: number) => (p.rot === 0 ? na : -na) + 0.5 * nz > 1e-4;
/** The light of a face from its local normal: tops 2, the visible end lit or shaded by the rotation. */
const lightOf = (p: PropPainter, na: number, nz: number): Light => (nz > Math.abs(na) * 0.7 ? 2 : p.rot === 0 ? 0 : 1);
/** The visible long flank (local +b) is lit for rot 0, shaded for rot 1. */
const flankLight = (p: PropPainter): Light => (p.rot === 0 ? 1 : 0);

/**
 * An extruded side profile: the polygon prof in (a, z) pushed across b0..b1. Draws the
 * visible faces only (the +b cap and the edges facing the viewer), so a convex profile
 * needs no sorting. mat(light, kind) picks each face's material: kind 'cap' for the
 * flank, 'top' / 'end' for the edge faces (with the edge index).
 */
function prism(p: PropPainter, prof: V2[], b0: number, b1: number, mat: (kind: 'cap' | 'top' | 'end', e: [V2, V2] | null) => Mat, edge?: string) {
  // counter-clockwise in (a, z')
  let area = 0;
  for (let i = 0; i < prof.length; i++) {
    const [a1, z1] = prof[i];
    const [a2, z2] = prof[(i + 1) % prof.length];
    area += a1 * (z2 / 16) - a2 * (z1 / 16);
  }
  const P = area < 0 ? [...prof].reverse() : prof;
  for (let i = 0; i < P.length; i++) {
    const [a1, z1] = P[i];
    const [a2, z2] = P[(i + 1) % P.length];
    const na = (z2 - z1) / 16;
    const nz = -(a2 - a1);
    if (!seen(p, na, nz)) continue;
    const L = lightOf(p, na, nz);
    poly3(p, [[a1, b1, z1], [a2, b1, z2], [a2, b0, z2], [a1, b0, z1]], mat(L === 2 ? 'top' : 'end', [P[i], P[(i + 1) % P.length]]), L);
  }
  let a0 = Infinity;
  let aM = -Infinity;
  let z0 = Infinity;
  let zM = -Infinity;
  for (const [a, z] of P) {
    a0 = Math.min(a0, a);
    aM = Math.max(aM, a);
    z0 = Math.min(z0, z);
    zM = Math.max(zM, z);
  }
  poly3(p, P.map(([a, z]): V3 => [a, b1, z]), mat('cap', null), flankLight(p), [[a0, b1, z0], [aM, b1, z0], [a0, b1, zM]]);
  if (edge) {
    // a crisp line round the flank's outline
    for (let i = 0; i < P.length; i++) {
      const [x0, y0] = p.P(P[i][0], b1, P[i][1]);
      const [x1, y1] = p.P(P[(i + 1) % P.length][0], b1, P[(i + 1) % P.length][1]);
      ln(p.c, x0, y0, x1, y1, edge);
    }
  }
}

/** A disc of radius r (z units) in the vertical plane b = const, centred at (a, zc). */
function disc(p: PropPainter, a: number, b: number, zc: number, r: number, col: string, t0 = 0, t1 = Math.PI * 2) {
  const pts: V2[] = [];
  const n = 26;
  const full = t1 - t0 >= Math.PI * 2 - 1e-6;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    pts.push(p.P(a + (r * Math.cos(t)) / 16, b, zc + r * Math.sin(t)));
  }
  if (!full) pts.push(p.P(a, b, zc));
  fillPoly(p.c, pts, col);
}

/**
 * A wheel on the visible flank (plane b): the tread's depth toward the body, the tyre's
 * sidewall, a rim with its dished centre and hub, lug nuts, a lit upper edge.
 */
function wheel(p: PropPainter, a: number, b: number, r: number, rim = '#b9c0c8', tw = 0.13) {
  const zc = r;
  for (let i = 0; i <= 4; i++) disc(p, a, b - tw + (tw * i) / 4, zc, r, i === 0 ? TYRE[0] : TYRE[1]);
  disc(p, a, b, zc, r, TYRE[2]);
  disc(p, a, b, zc, r, TYRE[3], Math.PI * 0.45, Math.PI * 0.95);
  disc(p, a, b, zc, r * 0.86, TYRE[2]);
  disc(p, a, b, zc, r * 0.6, darken(rim, 0.35));
  disc(p, a, b, zc, r * 0.52, rim);
  disc(p, a, b, zc, r * 0.52, lighten(rim, 0.25), Math.PI * 0.5, Math.PI);
  disc(p, a, b, zc, r * 0.24, darken(rim, 0.25));
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2 + 0.3;
    const [x, y] = p.P(a + (r * 0.38 * Math.cos(t)) / 16, b, zc + r * 0.38 * Math.sin(t));
    px(p.c, x, y, darken(rim, 0.5));
  }
  const [hx, hy] = p.P(a, b, zc);
  px(p.c, hx - 1, hy - 1, lighten(rim, 0.5), 2, 2);
}

/** The far-side wheel: only its dark tread shows under the body. */
const farWheel = (p: PropPainter, a: number, b: number, r: number) => {
  disc(p, a, b, r, r, TYRE[0]);
  disc(p, a, b + 0.04, r, r * 0.92, TYRE[1]);
};

/** The dark wheel well round a wheel on the flank (the upper half of a disc). */
const arch = (p: PropPainter, a: number, b: number, r: number, col: string) => disc(p, a, b, r, r + 1.4, col, 0, Math.PI);

/** Glossy car paint: a lit shoulder, a dark sill, a soft reflection band, the odd glint. */
const carPaint = (r: Ramp): Mat => (light, _w, h) => (u, v, x, y) => {
  let i = light === 2 ? 4 : light === 1 ? 3.2 : 2.1;
  if (v > h - 2) i += 1.1;
  else if (v > h - 4) i += 0.5;
  if (v < 2) i -= 1.2;
  if (light !== 2 && Math.abs(v - h * 0.62) < 0.8) i += 0.45;
  if (hash(x, y, 31) < 0.012) i += 1.5;
  void u;
  return at(r, i);
};

/** Tinted glass: a pale sky reflection in diagonal bands, darker toward the bottom. */
const glassMat = (bright = 0): Mat => (light, _w, h) => (u, v) => {
  const s = (u * 0.75 + v * 1.1) % 34;
  if (s < 2) return GLASS.glint;
  if (s < 7) return GLASS.pale;
  if (v < h * 0.3) return GLASS.dark;
  return light + bright >= 1 ? GLASS.mid : GLASS.dark;
};

// ── cars ────────────────────────────────────────────────────
const CAR_COL: Record<string, Ramp> = {
  red: ['#3e0a0c', '#62100f', '#8c1814', '#b42418', '#d4382a', '#ee6a52'],
  white: ['#6e7882', '#949ca6', '#b9c0c8', '#d6dbe0', '#eceff2', '#fbfcfd'],
  blue: ['#0e1e3c', '#16305e', '#204486', '#2c5ab0', '#4276cc', '#6a98e2'],
  black: ['#08090c', '#111318', '#1a1d24', '#252a32', '#353b45', '#4c5460'],
  green: ['#12261a', '#1c3826', '#284e34', '#366644', '#4a8058', '#66a072'],
};

/**
 * A car along local a, its nose toward a = w: 'col-pickup' (a crew cab and an open bed) or
 * 'col-suv'. On a 3 × 2 tile bay it is 2.7 tiles long and 1.3 wide.
 */
function car(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const [colName, bodyName] = (k.variant ?? 'red-pickup').split('-');
  const r = CAR_COL[colName === 'pickup' ? 'green' : colName] ?? CAR_COL.red;
  const pickup = bodyName ? bodyName === 'pickup' : colName === 'pickup';
  const a0 = 0.15;
  const L = W - 0.3;
  const A = (f: number) => a0 + f;
  const wid = Math.min(D - 0.5, 1.3);
  const b0 = (D - wid) / 2;
  const b1 = b0 + wid;
  const R = 3.3;
  const body = carPaint(r);
  const nose = p.rot === 0; // the visible end: the nose for rot 0, the tail for rot 1
  footShadow(p, a0 - 0.05, b0 - 0.05, a0 + L + 0.05, b1 + 0.08, 15, 0.4);
  // dark under the car, the far wheels
  const [u0x, u0y] = p.P(A(0.3), (b0 + b1) / 2, 0);
  const [u1x, u1y] = p.P(A(L - 0.3), (b0 + b1) / 2, 0);
  layer(p.c, (l) => {
    for (let t = 0; t <= 1; t += 0.05) ell(l, u0x + (u1x - u0x) * t, u0y + (u1y - u0y) * t, 26, 11, '#0a0c12');
  }, { alpha: 0.35, outline: false });
  const wf = [0.55, L - 0.6];
  for (const f of wf) farWheel(p, A(f), b0 + 0.14, R);
  // the lower body: tail, sill, nose and bonnet in one profile
  const zw = pickup ? 9.6 : 9.2;
  const low: V2[] = [[A(0), 3.2], [A(0.05), 2.3], [A(L - 0.07), 2.3], [A(L), 3.6], [A(L), 7], [A(L - 0.06), zw - 0.9], [A(L - 0.6), zw - 0.2], [A(0), zw]];
  prism(p, low, b0, b1, (kind) => (kind === 'top' ? body : body), r[0]);
  // the flank: wheel wells, a sill shadow, the shoulder crease
  const F = front(p, b1 + 0.002);
  pq(p, F, A(0.08), A(L - 0.1), 2.3, 3.1, r[0]);
  for (const f of wf) arch(p, A(f), b1 + 0.003, R, TYRE[1]);
  for (const f of wf) wheel(p, A(f), b1 + 0.004, R, colName === 'black' ? '#8a929c' : '#c4cad2');
  // mud flaps of grey slush behind the wheels
  for (const f of wf) {
    const [x, y] = F.F(A(f - 0.32), 3);
    px(p.c, x - 1, y - 6, '#5a5c62', 3, 7);
  }
  // drifts on the bonnet against the windscreen (behind the glasshouse when the nose faces away)
  const bonnetSnow = () => {
    const lumps: Mass[] = [];
    for (let i = 0; i < 5; i++) {
      const [x, y] = p.P(A(2.06 + (i % 2) * 0.1), b0 + 0.2 + i * (wid - 0.4) / 4, zw - 0.3);
      lumps.push({ x, y: y - 1, rx: 7 + (i % 3) * 2, ry: 3, z: i });
    }
    snowLayer(p.c, lumps, k.seed + 3, 0.3);
  };
  if (!nose) bonnetSnow();
  // the glasshouse
  const g0 = b0 + 0.07;
  const g1 = b1 - 0.07;
  const zr = pickup ? 16.2 : 16;
  const cab0 = pickup ? 1.08 : 0.06;
  const glassF: V2[] = [[A(cab0), zw], [A(1.97), zw], [A(1.62), zr - 0.2], [A(cab0 + (pickup ? 0.04 : 0.1)), zr]];
  const roofMat: Mat = (light) => () => at(r, light === 2 ? 4 : 3);
  prism(p, glassF, g0, g1, (kind, e) => {
    if (kind === 'cap') return glassMat(1);
    // the roof (the edge along the top) in paint, the screens in glass
    if (e && Math.min(e[0][1], e[1][1]) > zr - 0.5) return roofMat;
    return glassMat(kind === 'top' ? 1 : 0);
  }, r[0]);
  // pillars and the roof line on the flank: A along the windscreen, B in the middle, C at the back
  const G = front(p, g1 + 0.003);
  const line = (fa: number, za: number, fb: number, zb: number, col: string, w = 2) => {
    const [x0, y0] = G.F(A(fa), za);
    const [x1, y1] = G.F(A(fb), zb);
    ln(p.c, x0, y0, x1, y1, col, w);
  };
  const pil = r[nose ? 3 : 2];
  line(1.97, zw, 1.62, zr - 0.2, pil, 3);
  line(pickup ? 1.5 : 1.25, zw, pickup ? 1.48 : 1.22, zr - 0.1, pil, 3);
  if (!pickup) line(0.68, zw, 0.66, zr, pil, 3);
  line(cab0 + 0.02, zw, cab0 + (pickup ? 0.06 : 0.12), zr, pil, 4);
  line(cab0, zr, 1.62, zr - 0.2, r[4], 1);
  line(cab0, zw + 0.3, 1.97, zw + 0.3, r[1], 1);
  // door seams, handles, the mirror on its arm
  const doors = pickup ? [1.5, 1.08] : [1.25, 0.68];
  for (const f of doors) pq(p, F, A(f) - 0.006, A(f) + 0.006, 3, zw - 0.3, r[0]);
  pq(p, F, A(1.95) - 0.006, A(1.95) + 0.006, 3.4, zw - 0.3, r[1]);
  for (const f of doors) pq(p, F, A(f + 0.12), A(f + 0.24), zw - 1.6, zw - 1.1, lighten(r[3], 0.35));
  lbox(p, A(1.86), b1 - 0.02, 0.1, 0.09, zw + 0.7, 1.7, mono(paint(r), r[0]));
  if (pickup) {
    // the bed: its floor in shadow, snow heaped inside, the rails round it, a tailgate seam
    const top = (f0: number, f1: number, c0: number, c1: number, z: number, col: string) => fillPoly(p.c, [p.P(A(f0), c0, z), p.P(A(f1), c0, z), p.P(A(f1), c1, z), p.P(A(f0), c1, z)], col);
    top(0.06, 1.02, b0 + 0.07, b1 - 0.07, zw, '#14161c');
    snowSlab(p, A(0.1), b0 + 0.1, A(0.98), b1 - 0.1, zw - 1.3, k.seed + 5, 1.6);
    lbox(p, A(0), b0, 1.06, 0.06, zw, 0.6, mono(paint(r), r[0]));
    lbox(p, A(0), b1 - 0.06, 1.06, 0.06, zw, 0.6, mono(paint(r), r[0]));
    lbox(p, A(0), b0, 0.06, b1 - b0, zw, 0.6, mono(paint(r), r[0]));
    pq(p, F, A(1.04), A(1.06), 3, zw + 0.5, r[0]);
  }
  // the visible end: the tail (lamps, plate, bumper, tailgate handle) or the nose (lamps, grille)
  const E = side(p, nose ? A(L) + 0.002 : A(0) - 0.002);
  const lamp = (c0: number, c1: number, z0: number, z1: number, col: string, hi: string) => {
    pq(p, E, c0, c1, z0, z1, col);
    pq(p, E, c0, c0 + (c1 - c0) * 0.4, z1 - 0.6, z1, hi);
  };
  if (nose) {
    lamp(b0 + 0.06, b0 + 0.28, 5.2, 6.4, '#f6eecc', '#ffffff');
    lamp(b1 - 0.28, b1 - 0.06, 5.2, 6.4, '#f6eecc', '#ffffff');
    pq(p, E, b0 + 0.34, b1 - 0.34, 4.2, 6.4, '#1a1c22');
    for (let z = 4.6; z < 6.2; z += 0.6) pq(p, E, b0 + 0.36, b1 - 0.36, z, z + 0.25, '#5a6068');
    pq(p, E, b0 + 0.02, b1 - 0.02, 2.3, 3.6, '#2a2d34');
    pq(p, E, (b0 + b1) / 2 - 0.13, (b0 + b1) / 2 + 0.13, 2.6, 3.5, '#eef0f2');
  } else {
    lamp(b0 + 0.04, b0 + 0.16, 5.4, 8, '#c81e1a', '#ff6a50');
    lamp(b1 - 0.16, b1 - 0.04, 5.4, 8, '#c81e1a', '#ff6a50');
    pq(p, E, b0 + 0.02, b1 - 0.02, 2.3, 3.7, '#2a2d34');
    pq(p, E, b0 + 0.02, b1 - 0.02, 3.5, 3.7, '#4a4e56');
    pq(p, E, (b0 + b1) / 2 - 0.15, (b0 + b1) / 2 + 0.15, 4.2, 5.4, '#eef0f2');
    pq(p, E, (b0 + b1) / 2 - 0.12, (b0 + b1) / 2 + 0.12, 4.5, 5.1, '#3a3e48');
    pq(p, E, (b0 + b1) / 2 - 0.1, (b0 + b1) / 2 + 0.1, 7.4, 7.9, r[1]);
  }
  // snow: a cushion on the roof
  snowSlab(p, A(cab0 + 0.08), g0 + 0.03, A(1.6), g1 - 0.03, zr, k.seed + 2, 1.5);
  if (nose) bonnetSnow();
  // a white rim of frost along the top of the flank
  const [sx0, sy0] = F.F(A(0.05), zw - 0.05);
  const [sx1, sy1] = F.F(A(L - 0.62), zw - 0.25);
  ln(p.c, sx0, sy0, sx1, sy1, SNOW[5]);
}

const dc_car: PropArt = { draw: (p, k) => car(p, k) };

// ── the gritter-plough ──────────────────────────────────────
const BEACON: Ramp = ['#7a3a0a', '#a8540e', '#d47614', '#f29a2a', '#fcc04a', '#ffde80'];

/** Yellow body panels: ribs, a band of dark vents, road grime at the foot. */
const hopperMat: Mat = (light, _w, h) => (u, v, x, y) => {
  let i = light === 2 ? 4.4 : light === 1 ? 3.4 : 2.3;
  const f = u % 15;
  if (f < 1.2) i -= 1.3;
  else if (f < 2.4) i += 0.8;
  if (v > h - 2) i += 0.8;
  if (v < 5 && hash(Math.floor(u / 2), Math.floor(v), 77) < 0.45 - v * 0.08) i -= 1.2;
  if (hash(x, y, 78) < 0.02) i -= 0.7;
  return at(YEL, i);
};
const cabMat: Mat = (light, _w, h) => (u, v, x, y) => {
  let i = light === 2 ? 4.4 : light === 1 ? 3.3 : 2.2;
  if (v > h - 1.6) i += 1;
  if (v < 1.6) i -= 1;
  if (hash(x, y, 79) < 0.015) i += 1.3;
  void u;
  return at(ORA, i);
};

/**
 * The plough truck: a gritter body and an orange cab-over on a black chassis, three axles
 * of big tyres, a light bar with two beacons, an angled yellow blade in front pushing a
 * wave of snow. Drawn from a = ox over W tiles (blade included), b0..b1 across; `back`
 * turns it round so the blade is at the a = 0 end.
 */
function ploughTruck(p: PropPainter, ox: number, W: number, b0: number, b1: number, back: boolean, seed: number) {
  const blade = 0.55;
  const L = W - blade - 0.05;
  const A = (f: number) => (back ? ox + W - 0.05 - f : ox + 0.05 + f);
  const span = (f0: number, f1: number): [number, number] => [Math.min(A(f0), A(f1)), Math.abs(A(f1) - A(f0))];
  const R = 4.4;
  const bm = (b0 + b1) / 2;
  const cab0 = L - 1.05;
  const nose = (p.rot === 0) !== back; // the nose at the visible end
  footShadow(p, Math.min(A(0), A(L + blade)), b0 - 0.1, Math.max(A(0), A(L + blade)), b1 + 0.1, 28, 0.42);
  const axles = [0.45, 1.08, L - 0.5];
  for (const f of axles) farWheel(p, A(f), b0 + 0.16, R);
  // the chassis rails and the fuel tank, the bumper beam carrying the blade's frame
  const [ca, cw] = span(0.1, L - 0.1);
  lbox(p, ca, b0 + 0.18, cw, b1 - b0 - 0.36, 4.5, 3.6, mono(paint(RACK), RACK[0]));
  // the blade sits right against the nose, angled in plan (its far end leads)
  const fl = L + 0.34;
  const ft = L + 0.13;
  const bladeAt = (b: number) => fl + (ft - fl) * ((b - (b0 - 0.16)) / (b1 + 0.36 - b0));
  // the blade's mount: a plate on the bumper, two push arms reaching the moldboard, the lift ram
  const [ma, mw] = span(L - 0.04, L + 0.08);
  lbox(p, ma, b0 + 0.12, mw, b1 - b0 - 0.24, 2.4, 5.2, mono(paint(RACK), RACK[0]));
  for (const b of [b0 + 0.22, b1 - 0.22]) {
    const [x0, y0] = p.P(A(L + 0.02), b, 4.6);
    const [x1, y1] = p.P(A(bladeAt(b) - 0.01), b, 3.8);
    ln(p.c, x0, y0, x1, y1, '#1e2026', 6);
    ln(p.c, x0, y0 - 2, x1, y1 - 2, '#4a4e56', 2);
  }
  {
    const [x0, y0] = p.P(A(L + 0.02), bm, 8.5);
    const [x1, y1] = p.P(A(bladeAt(bm) - 0.01), bm, 6.5);
    ln(p.c, x0, y0, x1, y1, '#2a2e34', 4);
    ln(p.c, x0, y0 - 1, x1, y1 - 1, '#c8ccd2', 1);
  }
  const bodyTop = 27;
  const F = front(p, b1 - 0.02 + 0.003);
  const drawBody = () => {
    // the gritter body: a ribbed yellow box with a salt hopper's grated top, a ladder and a spinner at the tail
    const [ba, bw] = span(0.04, cab0 - 0.06);
    lbox(p, ba, b0 + 0.02, bw, b1 - b0 - 0.04, 8.1, bodyTop - 8.1, {
      front: hopperMat,
      side: hopperMat,
      top: () => (u, v) => (u % 7 < 1.2 || v % 7 < 1.2 ? '#7a6a48' : (u + v) % 14 < 7 ? '#d8cca8' : '#c8ba92'),
      edge: YEL[0],
    });
    // a black band of louvres along the flank, the lettering, amber markers, a reflective stripe
    for (let f = 0.2; f < cab0 - 0.3; f += 0.22) pq(p, F, A(f), A(f + 0.12), 19, 22.5, '#1c1c20');
    pt(p, F, Math.min(A(0.08), A(cab0 - 0.12)), Math.max(A(0.08), A(cab0 - 0.12)), 10.4, 11.6, (u: number) => (Math.floor(u / 6) % 2 ? '#e8321e' : '#f4f2ee'), F.light);
    label(p, F, A(back ? cab0 - 0.35 : 0.35), 17, 'GRIT', YEL[0]);
    for (let f = 0.15; f < cab0 - 0.1; f += 0.55) {
      const [x, y] = F.F(A(f), 9.2);
      px(p.c, x - 1, y - 1, '#ffa630', 3, 2);
    }
    // snow crusting the hopper's top edge
    snowSlab(p, ba + 0.05, b0 + 0.06, ba + bw - 0.05, b0 + 0.3, bodyTop, seed + 7, 0.8);
  };
  const drawCab = () => {
    // the cab: a tall cab-over, a raked windscreen, big glass, a sun visor
    const cabProf: V2[] = [[A(cab0), 7.6], [A(L), 7.6], [A(L), 18], [A(L - 0.13), 27.6], [A(L - 0.3), 30.4], [A(cab0), 30.4]];
    prism(p, cabProf, b0 + 0.03, b1 - 0.03, (kind, e) => {
      if (kind === 'cap' || !e) return cabMat;
      // the windscreen: the edge from the nose's top (z 18) up to the roof's front (z 27.6)
      const zs = [e[0][1], e[1][1]].sort((x, y) => x - y);
      if (zs[0] === 18 && zs[1] === 27.6) return glassMat(1);
      return cabMat;
    }, ORA[0]);
    const C = front(p, b1 - 0.03 + 0.003);
    // the side window and door, a step, the mirror on its arm
    const cw0 = A(cab0 + 0.12);
    const cw1 = A(L - 0.3);
    pt(p, C, Math.min(cw0, cw1), Math.max(cw0, cw1), 19.6, 28.4, glassMat(0), C.light);
    pq(p, C, Math.min(cw0, cw1), Math.max(cw0, cw1), 19.2, 19.7, ORA[0]);
    pq(p, C, A(cab0 + 0.08) - 0.006, A(cab0 + 0.08) + 0.006, 8, 29, ORA[0]);
    pq(p, C, A(L - 0.12) - 0.006, A(L - 0.12) + 0.006, 8, 18, ORA[1]);
    pq(p, C, Math.min(A(cab0 + 0.22), A(cab0 + 0.36)), Math.max(A(cab0 + 0.22), A(cab0 + 0.36)), 17, 17.6, '#e8eaee');
    lbox(p, Math.min(A(cab0 + 0.15), A(cab0 + 0.6)), b1 - 0.05, 0.45, 0.08, 5.6, 0.8, mono(paint(STEEL), STEEL[0]));
    lbox(p, A(L - 0.05) - 0.05, b1 - 0.02, 0.1, 0.1, 21, 6, mono(paint(RACK), RACK[0]));
    label(p, C, A(back ? L - 0.2 : cab0 + 0.2), 13, 'DC-1', ORA[0]);
    // the light bar and the two amber beacons on the roof, a snow cushion behind them
    const [la, lw] = span(L - 0.72, L - 0.4);
    lbox(p, la, b0 + 0.12, lw, b1 - b0 - 0.24, 30.4, 1.3, mono(paint(RACK), RACK[0]));
    for (const b of [b0 + 0.16, b1 - 0.24]) lbox(p, la + lw / 2 - 0.05, b, 0.1, 0.08, 31.7, 2, mono(paint(BEACON), BEACON[0]));
    for (const b of [b0 + 0.2, b1 - 0.2]) {
      const [x, y] = p.P(la + lw / 2, b, 33);
      px(p.c, x - 1, y - 2, '#fff4c0', 2, 2);
    }
    const [sa, sw] = span(cab0 + 0.08, L - 0.78);
    snowSlab(p, sa, b0 + 0.08, sa + sw, b1 - 0.08, 30.4, seed + 3, 1.2);
  };
  const drawWheels = () => {
    // the near wheels in their arches, the mud flaps, the fuel tank between the axles
    for (const f of axles) arch(p, A(f), b1 - 0.02, R, '#16181c');
    for (const f of axles) wheel(p, A(f), b1 - 0.015, R, '#d0d4da', 0.16);
    const [ta, tw] = span(1.5, 1.92);
    if (cab0 - 1.92 > 0.02) {
      lbox(p, ta, b1 - 0.2, tw, 0.16, 3.6, 3.6, mono(paint(STEEL), STEEL[0]));
    }
    for (const f of [axles[1] - 0.35, axles[2] - 0.35]) {
      const [x, y] = F.F(A(f), 7.6);
      px(p.c, x - 1, y, '#16181c', 3, 18);
    }
  };
  const drawEnd = () => {
    // the visible end: the cab's face (grille, lamps, wipers) or the gritter's tail (ladder, spinner, lamps)
    if (nose) {
      const E = side(p, A(L) + (back ? -0.003 : 0.003));
      pq(p, E, b0 + 0.18, b1 - 0.18, 10, 16.6, '#1c1e24');
      for (let z = 10.6; z < 16.2; z += 1.1) pq(p, E, b0 + 0.2, b1 - 0.2, z, z + 0.45, '#4a4e58');
      for (const [c0, c1] of [[b0 + 0.05, b0 + 0.17], [b1 - 0.17, b1 - 0.05]] as const) {
        pq(p, E, c0, c1, 11, 14, '#fff6d0');
        pq(p, E, c0, c1, 13.4, 14, '#ffffff');
        pq(p, E, c0, c1, 9.8, 10.6, '#ffa630');
      }
      pq(p, E, b0 + 0.03, b1 - 0.03, 7.6, 9.4, '#202228');
      label(p, E, p.rot === 0 ? bm + 0.2 : bm - 0.2, 16.2, 'DC', ORA[5], p.rot === 0 ? -1 : 1);
    } else {
      const E = side(p, A(0) + (back ? 0.003 : -0.003));
      for (const [c0, c1] of [[b0 + 0.06, b0 + 0.18], [b1 - 0.18, b1 - 0.06]] as const) {
        pq(p, E, c0, c1, 9.6, 12.4, '#c81e1a');
        pq(p, E, c0, c1, 11.8, 12.4, '#ff6a50');
      }
      pt(p, E, b0 + 0.04, b1 - 0.04, 8.2, 9.4, (u: number) => (Math.floor(u / 5) % 2 ? '#e8321e' : '#f4f2ee'), E.light);
      // the ladder up to the hopper
      for (const c of [bm - 0.12, bm + 0.12]) pq(p, E, c - 0.015, c + 0.015, 9, bodyTop + 2, '#2a2e34');
      for (let z = 10; z < bodyTop; z += 2.4) pq(p, E, bm - 0.12, bm + 0.12, z, z + 0.45, '#3a3e46');
      // the spinner disc under the tail
      const [sx, sy] = p.P(A(-0.12), bm, 6);
      ell(p.c, sx, sy, 10, 4, '#1c1e24');
      ell(p.c, sx, sy - 1, 7, 2.5, '#5a5e66');
    }
  };
  const drawBlade = () => {
    // the blade: angled in plan (its far end leads), the curved moldboard in bands, a rubber edge,
    // a lit top lip, marker rods at both ends; a wave of snow rolls off its trailing end
    const q = (f: number, b: number, z: number): V3 => [A(f), b, z];
    const qA0 = q(fl, b0 - 0.16, 0.4);
    const qB0 = q(ft, b1 + 0.2, 0.4);
    const zt = 10;
    const na = back ? -1 : 1;
    const frontSeen = seen(p, na, 0) || seen(p, na * 0.9, 0.15);
    const bands = [0.4, 1.8, 3.6, 6, 8.4, zt];
    const cols = frontSeen ? ['#1a1a1e', YEL[2], YEL[3], YEL[4], YEL[5]] : ['#1a1a1e', YEL[1], YEL[1], YEL[2], YEL[2]];
    for (let i = 0; i < bands.length - 1; i++) {
      const z0 = bands[i];
      const z1 = bands[i + 1];
      // the moldboard curls forward toward its top
      const lean0 = (z0 / zt) ** 2 * 0.08;
      const lean1 = (z1 / zt) ** 2 * 0.08;
      poly3(p, [q(fl + lean0, b0 - 0.16, z0), q(ft + lean0, b1 + 0.2, z0), q(ft + lean1, b1 + 0.2, z1), q(fl + lean1, b0 - 0.16, z1)], () => cols[i], frontSeen ? 1 : 0);
    }
    // ribs on its back (when we see the back), the top lip
    const [l0x, l0y] = p.P(A(fl + 0.08), b0 - 0.16, zt);
    const [l1x, l1y] = p.P(A(ft + 0.08), b1 + 0.2, zt);
    ln(p.c, l0x, l0y, l1x, l1y, '#fff2a8', 2);
    ln(p.c, l0x, l0y + 2, l1x, l1y + 2, YEL[3], 1);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const [x0, y0] = p.P(A(fl + (ft - fl) * t), b0 - 0.16 + (b1 + 0.36 - b0) * t, 1.8);
      ln(p.c, x0, y0, x0, y0 - 30, frontSeen ? YEL[2] : YEL[0]);
    }
    for (const [f, b] of [[fl, b0 - 0.16], [ft, b1 + 0.2]] as const) {
      const [x, y] = p.P(A(f), b, zt);
      px(p.c, x - 1, y - 30, '#2a2e34', 2, 30);
      px(p.c, x - 2, y - 34, '#ff5a2a', 4, 6);
      px(p.c, x - 2, y - 28, '#f4f2ee', 4, 3);
    }
    void qA0;
    void qB0;
    const m: Mass[] = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const [x, y] = p.P(A(fl + 0.12 + (ft - fl) * t), b0 - 0.1 + (b1 + 0.5 - b0) * t, 0);
      m.push({ x, y: y - 3 - t * 3, rx: 14 + t * 8, ry: 5 + t * 3, z: i });
    }
    const [wx, wy] = p.P(A(ft - 0.1), b1 + 0.55, 0);
    m.push({ x: wx, y: wy - 4, rx: 22, ry: 7, z: 9 });
    snowLayer(p.c, m, seed + 11, 0.4);
  };
  // back to front: the end toward the viewer last
  if (nose) {
    drawBody();
    drawCab();
    drawWheels();
    drawEnd();
    drawBlade();
  } else {
    drawBlade();
    drawCab();
    drawBody();
    drawWheels();
    drawEnd();
  }
}

const dc_plough: PropArt = {
  draw(p, k) {
    // parked on the apron: the same truck as the one on the road, 4 tiles long, centred on its bay
    const wid = Math.min(k.d - 0.3, 1.2);
    const b0 = (k.d - wid) / 2;
    ploughTruck(p, (k.w - 4) / 2, 4, b0, b0 + wid, k.variant === 'back', k.seed);
  },
  anim(p, k) {
    // the amber beacons turning
    const u = unit(p);
    const wid = Math.min(k.d - 0.3, 1.2);
    const b0 = (k.d - wid) / 2;
    const L = 4 - 0.55 - 0.05;
    const a = (k.w - 4) / 2 + 0.05 + L - 0.56;
    for (const [b, ph] of [[b0 + 0.2, 0], [b0 + wid - 0.2, Math.PI]] as const) {
      if (Math.sin(k.t * 7 + ph) <= 0) continue;
      const [x, y] = p.P(a, b, 33.2);
      p.c.globalAlpha = 0.35;
      ell(p.c, x, y, 14 * u, 8 * u, '#ffb43a');
      p.c.globalAlpha = 1;
      px(p.c, x - u, y - u, '#fff0b0', 3 * u, 2 * u);
    }
  },
  lights: (k) => [{ a: (k.w - 4) / 2 + 3.5, b: k.d / 2, z: 12, r: 1.4, color: '#fff2c8', kind: 'lamp' }],
};

/** The plough on the road: the art 'back' is the same truck turned round (blade at a = 0). */
const dc_ploughM: PropArt = {
  draw(p, k) {
    const wid = Math.min(k.d - 0.05, 1.15);
    const b0 = (k.d - wid) / 2;
    ploughTruck(p, 0, k.w, b0, b0 + wid, k.variant === 'back', k.seed);
  },
};

// ── the snowmobile ──────────────────────────────────────────
const SLED: Ramp = ['#3e0c0c', '#661414', '#921e1a', '#bc2c22', '#dc4632', '#f27a5e'];
const dc_snowmobile: PropArt = {
  draw(p, k) {
    // nose toward a = w; 1.9 tiles long, the skis 0.7 apart
    const W = k.w;
    const D = k.d;
    const a0 = (W - 1.9) / 2;
    const A = (f: number) => a0 + f;
    const bm = D / 2;
    const red = paint(SLED);
    footShadow(p, A(0), bm - 0.4, A(1.9), bm + 0.42, 8, 0.36);
    // the far ski and its spindle
    const ski = (b: number, near: boolean) => {
      const col = near ? '#22252b' : '#121316';
      // a long plastic ski with an upturned tip, a steel keel line, the spindle and its yellow shock
      const pts: V2[] = [p.P(A(1.02), b - 0.06, 0.2), p.P(A(1.74), b - 0.06, 0.2), p.P(A(1.9), b - 0.06, 1.2), p.P(A(1.96), b - 0.06, 2.6), p.P(A(1.96), b + 0.06, 2.6), p.P(A(1.9), b + 0.06, 1.2), p.P(A(1.74), b + 0.06, 0.2), p.P(A(1.02), b + 0.06, 0.2)];
      fillPoly(p.c, pts, col);
      const [x0, y0] = p.P(A(1.02), b + 0.06, 0.6);
      const [x1, y1] = p.P(A(1.76), b + 0.06, 0.6);
      ln(p.c, x0, y0, x1, y1, near ? '#6a707a' : '#2a2d34');
      const [t0x, t0y] = p.P(A(1.76), b + 0.06, 0.6);
      const [t1x, t1y] = p.P(A(1.95), b + 0.06, 2.6);
      ln(p.c, t0x, t0y, t1x, t1y, near ? '#8a929c' : '#2a2d34');
      const [s0x, s0y] = p.P(A(1.42), b, 0.8);
      const [s1x, s1y] = p.P(A(1.36), bm + (b - bm) * 0.6, 5.2);
      ln(p.c, s0x, s0y, s1x, s1y, near ? '#3a3e46' : '#202228', 2);
      ln(p.c, s0x + 3, s0y - 1, s1x + 3, s1y - 2, near ? '#e8b020' : '#7a5a10', 2);
    };
    ski(bm - 0.42, false);
    // the track: a black ribbed belt on bogie wheels under the tunnel, slanting up at the front
    const tb0 = bm - 0.22;
    const tb1 = bm + 0.22;
    const trackProf: V2[] = [[A(0.08), 0.2], [A(1.0), 0.2], [A(1.18), 2.4], [A(1.05), 3.6], [A(0.08), 3.6], [A(0.02), 2]];
    prism(p, trackProf, tb0, tb1, () => (_l, _w, h) => (u, v) => (v < 1.4 || v > h - 1.2 ? '#101114' : u % 6 < 2 ? '#3a3d44' : '#1c1e22'), '#08090b');
    const T = front(p, tb1 + 0.003);
    for (let f = 0.22; f < 1.0; f += 0.24) {
      const [x, y] = T.F(A(f), 1.6);
      ell(p.c, x, y, 3.4, 3.4, '#4a4e56');
      ell(p.c, x - 0.5, y - 0.5, 1.6, 1.6, '#9aa0a8');
    }
    // the tunnel and the running boards, red with black boards
    lbox(p, A(0.0), tb0 - 0.02, 1.0, tb1 - tb0 + 0.04, 3.6, 1.6, mono(red, SLED[0]));
    lbox(p, A(0.42), bm - 0.31, 0.6, 0.62, 3.6, 0.45, mono((light) => (u, v) => (light === 2 ? ((Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? '#a6acb4' : '#7e848c') : '#5a6068'), '#2a2d34'));
    // the snow flap and the tail light at the back
    const Et = side(p, p.rot === 0 ? A(1.9) : A(0) - 0.003);
    if (p.rot !== 0) {
      pq(p, Et, tb0 + 0.04, tb1 - 0.04, 0.4, 3.4, '#16181c');
      pq(p, Et, bm - 0.1, bm + 0.1, 4.2, 5, '#e8281e');
    }
    // the seat: long black padding with a grey piping, dusted with snow
    const seat: V2[] = [[A(0.14), 5.2], [A(0.96), 5.2], [A(1.0), 6.4], [A(0.92), 7.2], [A(0.18), 7]];
    prism(p, seat, bm - 0.15, bm + 0.15, (kind) => (kind === 'cap' ? (_l, _w, h) => (_u, v) => (v > h - 1.4 ? '#4a4e58' : v < 1 ? '#5a5e66' : '#22252b') : (l) => () => (l === 2 ? '#3a3e48' : '#2a2d34')), '#0e0f12');
    snowSlab(p, A(0.22), bm - 0.1, A(0.42), bm + 0.1, 7, k.seed + 1, 0.4);
    // the hood: a wedge from the bumper up to the dash, the side panels flaring over the skis
    const hood: V2[] = [[A(1.0), 3.4], [A(1.72), 2.4], [A(1.86), 3.4], [A(1.6), 6.4], [A(1.22), 8.6], [A(1.0), 8.2]];
    prism(p, hood, bm - 0.3, bm + 0.3, (kind) => (kind === 'cap' ? red : kind === 'top' ? (_l, _w, h) => (_u, v) => (v > h * 0.45 && v < h * 0.62 ? '#16181c' : SLED[4]) : red), SLED[0]);
    const H = front(p, bm + 0.3 + 0.003);
    // a black-and-white stripe on the side panel, the brand, an air vent
    const [h0x, h0y] = H.F(A(1.08), 5.6);
    const [h1x, h1y] = H.F(A(1.66), 4.2);
    ln(p.c, h0x, h0y, h1x, h1y, '#f4f2ee', 2);
    ln(p.c, h0x, h0y + 2, h1x, h1y + 2, '#16181c', 2);
    pq(p, H, A(1.12), A(1.3), 3.8, 4.6, '#16181c');
    // the windscreen, smoked, raked back over the bars
    const w0 = A(1.22);
    const w1 = A(1.08);
    poly3(p, [[w0, bm - 0.26, 8.4], [w0, bm + 0.26, 8.4], [w1, bm + 0.22, 12.6], [w1, bm - 0.22, 12.6]], (_l: Light) => (u: number, v: number) => ((u + v) % 18 < 3 ? '#cfe6f4' : '#5a7c94'), 2);
    const [e0x, e0y] = p.P(w1, bm - 0.22, 12.6);
    const [e1x, e1y] = p.P(w1, bm + 0.22, 12.6);
    ln(p.c, e0x, e0y, e1x, e1y, '#e6f4fc');
    // the handlebars with their grips, the mirrors
    const [g0x, g0y] = p.P(A(1.04), bm - 0.3, 9.2);
    const [g1x, g1y] = p.P(A(1.04), bm + 0.3, 9.2);
    ln(p.c, g0x, g0y, g1x, g1y, '#16181c', 2);
    px(p.c, g0x - 2, g0y - 1, '#2a2d34', 4, 3);
    px(p.c, g1x - 2, g1y - 1, '#2a2d34', 4, 3);
    // the headlight in the nose
    const En = side(p, p.rot === 0 ? A(1.84) : A(0));
    if (p.rot === 0) {
      pq(p, En, bm - 0.1, bm + 0.1, 3.8, 4.8, '#fff6d0');
      pq(p, En, bm - 0.1, bm - 0.02, 4.4, 4.8, '#ffffff');
    }
    // the near ski last
    ski(bm + 0.42, true);
  },
};

// ── the boat ────────────────────────────────────────────────
const HULL: Ramp = ['#0c1e16', '#143022', '#1c442e', '#265a3c', '#327250', '#468a64'];
const dc_boat: PropArt = {
  draw(p, k) {
    // a clinker rowboat afloat, bow toward a = w, a small outboard on the transom, snow in its bottom
    const W = k.w;
    const D = k.d;
    const bc = D / 2;
    const a0 = 0.12;
    const L = W - 0.24;
    const A = (t: number) => a0 + t * L;
    const beam = 0.36;
    const hb = (t: number) => beam * Math.min(1, (1 - t) * 3.2) ** 0.8 * Math.min(1, 0.55 + t * 2.4) ** 0.5; // fine bow, broad transom
    const zg = (t: number) => 4.4 + 2.2 * Math.max(0, t - 0.55) ** 1.6 * 4; // the sheer rising to the bow
    const P = (t: number, s: number, z: number) => p.P(A(t), bc + s, z);
    const N = 16;
    // dark water round the hull: its reflection, slush and broken ice
    layer(p.c, (l) => {
      const pts: V2[] = [];
      for (let i = 0; i <= N; i++) pts.push(P(i / N, hb(i / N) * 1.25 + 0.05, 0));
      for (let i = N; i >= 0; i--) pts.push(P(i / N, -hb(i / N) * 1.25 - 0.05, 0));
      fillPoly(l, pts, '#061420');
    }, { alpha: 0.7, outline: false });
    // the reflection of the green hull, broken by ripples
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const [x, y] = P(t, hb(t) + 0.02, 0);
      for (let j = 1; j < 7; j += 2) px(p.c, x, y + j * 2, j < 3 ? HULL[2] : HULL[1], 4, 1);
    }
    const Rn = rng(k.seed * 13 + 5);
    for (let i = 0; i < 14; i++) {
      const t = Rn();
      const s = (Rn() < 0.5 ? -1 : 1) * (hb(t) + 0.08 + Rn() * 0.1);
      const [x, y] = P(t, s, 0);
      fillPoly(p.c, [[x - 4, y], [x, y - 2], [x + 5, y - 1], [x + 2, y + 2]], Rn() < 0.5 ? ICE[5] : ICE[4]);
    }
    // the hull's inside (the far half) and the floorboards
    const inner: V2[] = [];
    for (let i = 0; i <= N; i++) inner.push(P(i / N, -hb(i / N), zg(i / N)));
    for (let i = N; i >= 0; i--) inner.push(P(i / N, hb(i / N), zg(i / N)));
    fillPoly(p.c, inner, '#b89a6e');
    const floor: V2[] = [];
    for (let i = 1; i < N; i++) floor.push(P(i / N, -hb(i / N) * 0.6, 1.4));
    for (let i = N - 1; i > 0; i--) floor.push(P(i / N, hb(i / N) * 0.6, 1.4));
    fillPoly(p.c, floor, '#7a6040');
    for (let i = 1; i < N; i += 2) {
      const [x0, y0] = P(i / N, -hb(i / N) * 0.6, 1.4);
      const [x1, y1] = P(i / N, hb(i / N) * 0.6, 1.4);
      ln(p.c, x0, y0, x1, y1, '#5a4430');
    }
    // the far side's inner planking, lit
    for (let s2 = 0; s2 < 3; s2++) {
      const pts: V2[] = [];
      for (let i = 0; i <= N; i++) pts.push(P(i / N, -hb(i / N) * (0.95 - s2 * 0.12), zg(i / N) - s2 * 1.1));
      for (let i = N; i >= 0; i--) pts.push(P(i / N, -hb(i / N) * (0.83 - s2 * 0.12), zg(i / N) - (s2 + 1) * 1.1));
      fillPoly(p.c, pts, ['#d4b88a', '#c4a678', '#b09264'][s2]);
    }
    // snow lying in its bottom, the two thwarts and the oars along them
    const ms: Mass[] = [];
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.17;
      const [x, y] = P(t, 0, 2);
      ms.push({ x, y, rx: 14, ry: 5, z: i });
    }
    snowLayer(p.c, ms, k.seed + 3, 0.3);
    for (const t of [0.3, 0.62]) {
      const pts = [P(t, -hb(t) * 0.92, zg(t) - 1), P(t + 0.05, -hb(t) * 0.92, zg(t) - 1), P(t + 0.05, hb(t) * 0.92, zg(t) - 1), P(t, hb(t) * 0.92, zg(t) - 1)];
      fillPoly(p.c, pts, '#d8bc8c');
      const [sx, sy] = P(t + 0.025, 0, zg(t) - 0.6);
      px(p.c, sx - 8, sy - 1, SNOW[6], 16, 2);
    }
    const [o0x, o0y] = P(0.12, -hb(0.12) * 0.6, zg(0.12) - 0.4);
    const [o1x, o1y] = P(0.86, -hb(0.86) * 0.4, zg(0.86) - 0.4);
    ln(p.c, o0x, o0y, o1x, o1y, '#a07a4a', 2);
    // the near side of the hull: green strakes from the waterline up to the white gunwale
    const strakes = 4;
    for (let s2 = 0; s2 < strakes; s2++) {
      const f0 = s2 / strakes;
      const f1 = (s2 + 1) / strakes;
      const pts: V2[] = [];
      const zAt = (t: number, f: number) => zg(t) * f;
      const sAt = (t: number, f: number) => hb(t) * (0.72 + 0.28 * f);
      for (let i = 0; i <= N; i++) pts.push(P(i / N, sAt(i / N, f0), zAt(i / N, f0)));
      for (let i = N; i >= 0; i--) pts.push(P(i / N, sAt(i / N, f1), zAt(i / N, f1)));
      fillPoly(p.c, pts, HULL[p.rot === 0 ? 2 + s2 * 0.75 | 0 : 1 + (s2 * 0.75) | 0]);
      // the lap of each strake: a lit lower edge
      for (let i = 0; i < N; i++) {
        const [x0, y0] = P(i / N, sAt(i / N, f1), zAt(i / N, f1));
        const [x1, y1] = P((i + 1) / N, sAt((i + 1) / N, f1), zAt((i + 1) / N, f1));
        ln(p.c, x0, y0, x1, y1, HULL[Math.min(5, 3 + s2 * 0.5) | 0]);
      }
    }
    // the gunwale: a white rubbing strake all round the near side and the stem
    for (let i = 0; i < N; i++) {
      const [x0, y0] = P(i / N, hb(i / N), zg(i / N));
      const [x1, y1] = P((i + 1) / N, hb((i + 1) / N), zg((i + 1) / N));
      ln(p.c, x0, y0, x1, y1, '#f4f2ee', 2);
      ln(p.c, x0, y0 + 2, x1, y1 + 2, '#9aa4a8');
    }
    // the transom at the stern (a = a0) and its outboard, the far gunwale's lit rim
    const tPts: V2[] = [P(0, -hb(0), zg(0)), P(0, hb(0), zg(0)), P(0, hb(0) * 0.72, 0), P(0, -hb(0) * 0.72, 0)];
    fillPoly(p.c, tPts, p.rot === 1 ? HULL[3] : HULL[1]);
    const [tx0, ty0] = P(0, -hb(0), zg(0));
    const [tx1, ty1] = P(0, hb(0), zg(0));
    ln(p.c, tx0, ty0, tx1, ty1, '#f4f2ee', 2);
    for (let i = 0; i < N; i++) {
      const [x0, y0] = P(i / N, -hb(i / N), zg(i / N));
      const [x1, y1] = P((i + 1) / N, -hb((i + 1) / N), zg((i + 1) / N));
      ln(p.c, x0, y0, x1, y1, '#e6e8ea');
    }
    const [mx, my] = P(-0.02, 0, zg(0) + 1);
    px(p.c, mx - 4, my - 10, '#1c1e22', 9, 11);
    px(p.c, mx - 4, my - 10, '#4a4e56', 9, 2);
    px(p.c, mx - 3, my - 7, '#d8402e', 7, 2);
    px(p.c, mx - 1, my + 1, '#2a2d34', 3, 16);
    // the bow's painter running off to the jetty's bollard (toward −b)
    const [bx, by] = P(0.94, 0, zg(0.94));
    const [jx, jy] = p.P(A(0.82), -0.12, 7);
    ln(p.c, bx, by, (bx + jx) / 2, Math.max(by, jy) + 6, '#c8b48a');
    ln(p.c, (bx + jx) / 2, Math.max(by, jy) + 6, jx, jy, '#c8b48a');
  },
};

export const DC_VEHICLES: Record<string, PropArt> = { dc_car, dc_plough, dc_ploughM, dc_snowmobile, dc_boat };

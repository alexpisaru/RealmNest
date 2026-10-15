// Robotics — the airfield's ground vehicles at 128×64, modelled as real boxes with
// lit tops, mid fronts and dark sides, round tyres with rims and hubs in their
// wheel arches, glass with reflections, lights, bumpers, plates and livery.
//   rob_car       hatch · sedan · estate · van · pickup · follow ("follow me");
//                 suffix '-rev' puts the nose at a = 0 (a moving car's run back, or a car parked nose to +y at rot 1)
//   rob_fueltruck the avgas bowser: a cab-over rigid with a white tank, the hose cabinet at the rear ('-rev' as above)
//   rob_tug       a compact yellow tow tractor with its glazed cab
//   rob_bagcart   a baggage tractor and three dollies of crates and cases
//   rob_gpu       a ground power unit on its trolley · rob_chocks a pair of wheel chocks · rob_towbar a tow bar on the ground
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { at, contactShadow, fillPoly, hash, layer, ln, px, type Ramp } from '../../kit4';
import { front, pq, poly3, pt, side } from '../../plane4';
import { footShadow, lbox, mono } from '../util';
import { drawMesh, type Face, loft } from './mesh';
import { enamel, GALV, ORANGE, PINE, RED, stencil, YEL } from './rkit';

type V2 = [number, number];

// ── paint ───────────────────────────────────────────────────
export const V_WHITE: Ramp = ['#8a8c94', '#a6a8b0', '#c0c2c8', '#d6d8dc', '#e8e9ec', '#f4f5f6', '#ffffff'];
export const V_RED: Ramp = ['#4a1214', '#701a1c', '#9a2424', '#c0302a', '#dc4434', '#ee6a52', '#f8a088'];
export const V_BLUE: Ramp = ['#0e1e48', '#162e66', '#1e4088', '#2a54a8', '#3a6cc8', '#5a8ade', '#86acec'];
const V_GREEN: Ramp = ['#10301a', '#184424', '#205a2e', '#2c7038', '#3a8a44', '#54a258', '#7cbc74'];
const V_SILVER: Ramp = ['#4e545e', '#666c76', '#80868e', '#9aa0a8', '#b4b9c0', '#cdd1d6', '#e6e8ec'];
export const V_YEL: Ramp = ['#6a4a0c', '#94680e', '#c08c16', '#e2aa20', '#f4c430', '#fad85e', '#fde89a'];
const TRIM: Ramp = ['#121318', '#1a1c22', '#24262e', '#30323c', '#3e414c', '#50545e'];
const TYRE: Ramp = ['#0c0d10', '#15161b', '#1e2026', '#292b33', '#363944', '#4a4e5a'];

const flat =
  (r: Ramp, li: number, ld: number, lt = li + 1): Mat =>
  (light) =>
  () =>
    at(r, light === 2 ? lt : light ? li : ld);
/** body paint: enamel on the sides, a bright lid */
const paint = (r: Ramp) => ({ front: enamel(r, 0.004), side: enamel(r, 0.004), top: flat(r, r.length - 2, r.length - 3, r.length - 1), edge: r[0] });
const dark = (r: Ramp = TRIM) => mono(flat(r, 3, 2, 4), r[0]);

/** Window glass: a light sky tint, a darker band under the roof, two diagonal glints. */
const GLASS: Mat = (light, _w, h) => (u, v) => {
  if (v > h - 2.5) return light ? '#28404e' : '#1e3440';
  const r = (u * 0.8 + v) % 34;
  if (r < 2.5) return '#e2f4f8';
  if (r > 5 && r < 7) return '#b4d6e2';
  return light ? (v > h * 0.55 ? '#6a9cb2' : '#7cacbf') : v > h * 0.55 ? '#4e7c92' : '#5c8aa0';
};

// ── wheels ──────────────────────────────────────────────────
/** the screen direction of the prop's +a axis, normalised */
function dirA(p: PropPainter): V2 {
  const o = p.P(0, 0, 0);
  const q = p.P(1, 0, 0);
  const l = Math.hypot(q[0] - o[0], q[1] - o[1]);
  return [(q[0] - o[0]) / l, (q[1] - o[1]) / l];
}

/** the screen direction of +b, normalised, turned to read left to right */
function readB(p: PropPainter): V2 {
  const o = p.P(0, 0, 0);
  const q = p.P(0, 1, 0);
  const l = Math.hypot(q[0] - o[0], q[1] - o[1]);
  const d: V2 = [(q[0] - o[0]) / l, (q[1] - o[1]) / l];
  return d[0] < 0 ? [-d[0], -d[1]] : d;
}

/** stencilled text centred on (cx, cy), running along d (3×5 glyphs, s px per glyph pixel) */
function label(c: CanvasRenderingContext2D, text: string, cx: number, cy: number, d: V2, s: number, col: string) {
  const w = (text.length * 4 - 1) * s;
  stencil(c, text, cx - (d[0] * w) / 2, cy - (d[1] * w) / 2 - 2.5 * s, d[0] * s, d[1] * s, 0, s, col);
}

/** an ellipse lying in a vertical plane along +a: rx along the a direction, ry up (px) */
function oval(cx: number, cy: number, d: V2, rx: number, ry: number, t0 = 0, t1 = Math.PI * 2, n = 30): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    out.push([cx + d[0] * rx * Math.cos(t), cy + d[1] * rx * Math.cos(t) - ry * Math.sin(t)]);
  }
  return out;
}

/**
 * A tyre on the near (+b) side: the tread band seen past its edge, the sidewall,
 * the rim with its lip and nuts, the hub. r in px at k = 4, the centre at height r.
 */
export function wheel(p: PropPainter, a: number, b: number, r: number, o: { rim?: Ramp; tw?: number; far?: boolean } = {}) {
  const u = p.k / 4;
  const R = r * u;
  const d = dirA(p);
  const [cx, cy] = p.P(a, b, R / p.k);
  const [bx, by] = p.P(a, b - (o.tw ?? 0.14), R / p.k);
  const c = p.c;
  const n = Math.max(2, Math.ceil(Math.hypot(bx - cx, by - cy)));
  for (let i = n; i >= 1; i--) fillPoly(c, oval(cx + ((bx - cx) * i) / n, cy + ((by - cy) * i) / n, d, R * 1.04, R), i === n ? TYRE[0] : TYRE[1]);
  if (o.far) {
    fillPoly(c, oval(cx, cy, d, R * 1.04, R), TYRE[1]);
    fillPoly(c, oval(cx, cy, d, R * 0.5, R * 0.48), TYRE[0]);
    return;
  }
  const rim = o.rim ?? GALV;
  fillPoly(c, oval(cx, cy, d, R * 1.04, R), TYRE[2]);
  fillPoly(c, oval(cx - 0.5 * u, cy - 0.5 * u, d, R * 0.84, R * 0.82), TYRE[3]);
  fillPoly(c, oval(cx, cy, d, R * 0.66, R * 0.64), TYRE[1]);
  fillPoly(c, oval(cx, cy, d, R * 0.58, R * 0.56), rim[2]);
  fillPoly(c, oval(cx - 0.6 * u, cy - 0.6 * u, d, R * 0.48, R * 0.46), rim[4]);
  fillPoly(c, oval(cx, cy, d, R * 0.24, R * 0.23), rim[2]);
  fillPoly(c, oval(cx - 0.4 * u, cy - 0.4 * u, d, R * 0.15, R * 0.14), rim[6] ?? rim[5]);
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2 + 0.4;
    px(c, cx + d[0] * R * 0.36 * Math.cos(t) - 0.5, cy + d[1] * R * 0.36 * Math.cos(t) - R * 0.36 * Math.sin(t) - 0.5, rim[1], Math.max(1, Math.round(u)), Math.max(1, Math.round(u)));
  }
  // the tyre's lit shoulder (upper left) and its dark foot
  for (const [x, y] of oval(cx, cy, d, R * 0.96, R * 0.93, 1.75, 2.9, 10)) px(c, x, y, TYRE[5]);
  for (const [x, y] of oval(cx, cy, d, R * 0.97, R * 0.95, 4.3, 5.2, 8)) px(c, x, y, TYRE[0]);
}

/** the dark wheel well round a wheel on the body's near face */
function arch(p: PropPainter, a: number, b: number, r: number, col = '#121216', lip?: string) {
  const u = p.k / 4;
  const R = r * u;
  const d = dirA(p);
  const [cx, cy] = p.P(a, b, R / p.k);
  if (lip) fillPoly(p.c, oval(cx, cy, d, (R + 3.6 * u) * 1.04, R + 3.6 * u, 0, Math.PI, 16), lip);
  fillPoly(p.c, oval(cx, cy, d, (R + 2.4 * u) * 1.04, R + 2.4 * u, 0, Math.PI, 16), col);
}

/** a soft dark contact patch under a tyre */
function tread(p: PropPainter, a: number, b: number, r: number) {
  const u = p.k / 4;
  const [x, y] = p.P(a, b - 0.06, 0);
  contactShadow(p.c, x + 1 * u, y, r * 1.1 * u, r * 0.34 * u, 0.5);
}

/** axis helper: a part along the vehicle from s0 to s1 (s from the tail), nose at +a unless rev */
function along(p: PropPainter, a0: number, L: number, rev: boolean) {
  const A = (s: number) => (rev ? a0 + L - s : a0 + s);
  const box = (s0: number, s1: number, b0: number, b1: number, z0: number, z1: number, m: Parameters<typeof lbox>[7]) => {
    const x = A(s0);
    const y = A(s1);
    lbox(p, Math.min(x, y), b0, Math.abs(y - x), b1 - b0, z0, z1 - z0, m);
  };
  return { A, box };
}

/** the end plane (a = const) and whether the nose is on the visible end */
function ends(p: PropPainter, rev: boolean) {
  return { noseVis: (p.rot === 0) !== rev };
}

// ── cars ────────────────────────────────────────────────────
interface CarSpec {
  body: Ramp;
  len: number;
  kind: 'hatch' | 'sedan' | 'estate' | 'van' | 'pickup' | 'follow';
}
const CARS: Record<string, CarSpec> = {
  hatch: { body: V_RED, len: 1.7, kind: 'hatch' },
  sedan: { body: V_SILVER, len: 1.9, kind: 'sedan' },
  sedanb: { body: V_BLUE, len: 1.9, kind: 'sedan' },
  estate: { body: V_BLUE, len: 1.85, kind: 'estate' },
  van: { body: V_WHITE, len: 1.9, kind: 'van' },
  pickup: { body: V_GREEN, len: 1.9, kind: 'pickup' },
  follow: { body: V_YEL, len: 1.8, kind: 'follow' },
};

const rob_car: PropArt = {
  draw(p, k) {
    const [name, r0] = (k.variant ?? 'hatch').split('-');
    const rev = r0 === 'rev';
    const v = CARS[name] ?? CARS.hatch;
    const B = v.body;
    const W = k.w;
    const D = k.d;
    const L = v.len;
    const a0 = (W - L) / 2;
    const van = v.kind === 'van';
    const half = van ? 0.43 : 0.37;
    const bl = D / 2 - half;
    const br = D / 2 + half;
    const { A, box } = along(p, a0, L, rev);
    const { noseVis } = ends(p, rev);
    const sVis = noseVis ? L : 0;
    const u = p.k / 4;
    const R = van ? 12 : 11;
    const ws = [0.36, L - 0.38];
    const zw = 7.2; // the waist
    footShadow(p, Math.min(A(0), A(L)) + 0.04, bl + 0.02, Math.max(A(0), A(L)) - 0.04, br + 0.04, van ? 22 : 14, 0.34);
    for (const s of ws) wheel(p, A(s), bl + 0.16, R, { far: true });
    box(0.1, L - 0.1, bl + 0.05, br - 0.05, 1.4, 2.6, dark());
    // the body to the waist; a van's box to the roof
    const top = van ? 20.6 : zw;
    const bonnet = van ? L - 0.46 : L;
    if (van) {
      // the bonnet first when it is on the hidden end
      if (!noseVis) box(bonnet, L, bl + 0.02, br - 0.02, 2.4, 9.4, paint(B));
      box(0, bonnet, bl, br, 2.4, top, paint(B));
      box(0.03, bonnet - 0.03, bl + 0.03, br - 0.03, top, top + 0.8, mono(flat(B, 4, 3, 5), B[0]));
      if (noseVis) box(bonnet, L, bl + 0.02, br - 0.02, 2.4, 9.4, paint(B));
    } else box(0, L, bl, br, 2.4, top, paint(B));
    const F = front(p, br + 0.001);
    // the cabin: rear screen, glass box, windscreen (hidden end first), a body-coloured roof
    let g0 = 0;
    let g1 = 0;
    let zt = 13.4;
    if (!van) {
      const k0 = { hatch: [0.2, 1.06], sedan: [0.5, 1.2], estate: [0.12, 1.16], follow: [0.24, 1.12], pickup: [0.86, 1.2] }[v.kind as 'hatch'];
      g0 = k0[0];
      g1 = k0[1];
      const rear = v.kind === 'sedan' ? 0.3 : v.kind === 'pickup' ? 0.02 : 0.14;
      const fwd = 0.4;
      const ib = 0.05;
      const slope = (sTop: number, sFoot: number, lit: boolean) => {
        const pts: [number, number, number][] = [
          [A(sTop), bl + ib, zt],
          [A(sTop), br - ib, zt],
          [A(sFoot), br - 0.02, zw],
          [A(sFoot), bl + 0.02, zw],
        ];
        poly3(p, pts, lit ? GLASS : flat(TRIM, 3, 2, 3), lit ? (p.rot === 0 ? 0 : 1) : 0);
      };
      if (noseVis) slope(g0, g0 - rear, false);
      else slope(g1, g1 + fwd, false);
      box(g0, g1, bl + ib, br - ib, zw, zt, { front: GLASS, side: GLASS, top: flat(B, 5, 4, 6), edge: B[0] });
      // pillars and the roof's thickness
      const Fg = front(p, br - ib + 0.001);
      for (const s of [g0, g1, (g0 + g1) / 2 + (v.kind === 'pickup' ? 0 : 0.02)]) pq(p, Fg, A(s) - 0.025, A(s) + 0.025, zw, zt, B[F.light ? 3 : 2]);
      box(g0 - 0.04, g1 + 0.04, bl + ib - 0.01, br - ib + 0.01, zt, zt + 1, mono(flat(B, 4, 3, 5), B[0]));
      if (noseVis) slope(g1, g1 + fwd, true);
      else slope(g0, g0 - rear, true);
      // the side windows' sloping ends (on the near face), framed in body colour
      const tri = (sA: number, sB: number) => {
        const pts: [number, number, number][] = [
          [A(sA), br - ib, zt],
          [A(sA), br - ib, zw],
          [A(sB), br - ib, zw + 0.6],
        ];
        poly3(p, pts, GLASS, F.light);
      };
      tri(g1, g1 + fwd * 0.82);
      if (v.kind !== 'pickup') tri(g0, g0 - rear * 0.8);
      pq(p, F, A(g0) - 0.02, A(g1) + 0.02, zw - 0.2, zw + 0.5, B[F.light ? 2 : 1]);
      // roof rails (estate), the light bar (follow me)
      if (v.kind === 'estate') for (const b of [bl + 0.1, br - 0.1]) box(g0 + 0.05, g1 - 0.05, b - 0.02, b + 0.02, zt + 1, zt + 1.8, dark());
      if (v.kind === 'follow') {
        box((g0 + g1) / 2 - 0.18, (g0 + g1) / 2 + 0.18, bl + 0.12, br - 0.12, zt + 1, zt + 2.6, dark());
        const [lx, ly] = p.P((A(g0) + A(g1)) / 2, br - 0.13, zt + 2.2);
        px(p.c, lx - 6 * u, ly - 2 * u, '#f0a020', 4 * u, 2 * u);
        px(p.c, lx + 2 * u, ly - 1 * u, '#f0a020', 4 * u, 2 * u);
      }
      // a pickup's load bed: its floor and the inside of the far wall
      if (v.kind === 'pickup') {
        const s0 = 0.05;
        const s1 = g0 - 0.06;
        fillPoly(p.c, [p.P(A(s0), bl + 0.06, zw - 2.2), p.P(A(s1), bl + 0.06, zw - 2.2), p.P(A(s1), bl + 0.06, zw), p.P(A(s0), bl + 0.06, zw)], B[1]);
        fillPoly(p.c, [p.P(A(s0), bl + 0.06, zw - 2.2), p.P(A(s1), bl + 0.06, zw - 2.2), p.P(A(s1), br - 0.06, zw - 2.2), p.P(A(s0), br - 0.06, zw - 2.2)], TRIM[1]);
        for (let i = 1; i < 4; i++) {
          const b = bl + 0.06 + ((br - bl - 0.12) * i) / 4;
          const [x0, y0] = p.P(A(s0), b, zw - 2.2);
          const [x1, y1] = p.P(A(s1), b, zw - 2.2);
          ln(p.c, x0, y0, x1, y1, TRIM[3]);
        }
      }
    } else {
      // the van's windscreen and its cab windows
      const ws0: [number, number, number][] = [
        [A(bonnet), bl + 0.05, top - 1],
        [A(bonnet), br - 0.05, top - 1],
        [A(bonnet + 0.36), br - 0.05, 9.6],
        [A(bonnet + 0.36), bl + 0.05, 9.6],
      ];
      if (noseVis) poly3(p, ws0, GLASS, p.rot === 0 ? 0 : 1);
      poly3(p, [[A(bonnet), br - 0.019, top - 1], [A(bonnet), br - 0.019, 9.4], [A(bonnet + 0.36), br - 0.019, 9.4]], flat(B, 4, 2), F.light);
      pt(p, F, Math.min(A(bonnet - 0.42), A(bonnet - 0.04)), Math.max(A(bonnet - 0.42), A(bonnet - 0.04)), 11.2, 18.4, GLASS, F.light);
      const sd = bonnet - 0.5;
      pq(p, F, A(sd) - 0.012, A(sd) + 0.012, 2.6, top - 0.6, B[1]);
      const [tx, ty] = F.F((A(0.04) + A(sd - 0.04)) / 2, 15.4);
      label(p.c, 'AERO CLUB', tx, ty, dirA(p), 1.6 * u, '#2b98aa');
      for (const z of [8.8, 9.4]) pq(p, F, Math.min(A(0.05), A(bonnet - 0.05)), Math.max(A(0.05), A(bonnet - 0.05)), z, z + 0.3, z < 9 ? '#2b98aa' : '#e8a030');
    }
    // body lines on the near face: door shuts, handles, the sill, a rub strip
    const dm = v.kind === 'pickup' ? g0 + 0.03 : van ? 0 : (g0 + g1) / 2 + 0.02;
    if (!van) {
      pq(p, F, A(dm) - 0.01, A(dm) + 0.01, 2.8, zw - 0.2, B[1]);
      pq(p, F, A(g1 + 0.02) - 0.01, A(g1 + 0.02) + 0.01, 2.8, zw - 0.2, B[1]);
      if (v.kind !== 'hatch' && v.kind !== 'pickup' && v.kind !== 'follow') pq(p, F, A(g0 - 0.02) - 0.01, A(g0 - 0.02) + 0.01, 2.8, zw - 0.2, B[1]);
      for (const s of [dm + 0.08, g1 - 0.14]) {
        const [hx, hy] = F.F(A(s), 6.1);
        px(p.c, hx - 2 * u, hy - 1 * u, B[6] ?? B[5], 4 * u, 1 * u);
        px(p.c, hx - 2 * u, hy, B[1], 4 * u, 1 * u);
      }
    }
    pq(p, F, Math.min(A(0.02), A(L - 0.02)), Math.max(A(0.02), A(L - 0.02)), 2.4, 3.2, TRIM[3]);
    pq(p, F, Math.min(A(0.02), A(L - 0.02)), Math.max(A(0.02), A(L - 0.02)), zw - 2.6, zw - 2.2, B[F.light ? 5 : 3]);
    // the follow-me chequers
    if (v.kind === 'follow')
      for (let i = 0; i < 12; i++) {
        const s = 0.12 + i * 0.13;
        pq(p, F, Math.min(A(s), A(s + 0.13)), Math.max(A(s), A(s + 0.13)), 3.4 + (i % 2) * 0.9, 4.3 + (i % 2) * 0.9, '#1c1c22');
      }
    // the wing mirror on the near side
    {
      const sm = van ? bonnet - 0.02 : g1 + 0.02;
      const [mx, my] = p.P(A(sm), br + 0.08, van ? 15 : zw + 1.4);
      px(p.c, mx - 2 * u, my - 3 * u, TRIM[2], 4 * u, 4 * u);
      px(p.c, mx - 2 * u, my - 3 * u, B[5], 4 * u, 1 * u);
    }
    // the visible end: headlamps, grille and plate at the nose; tail lamps, plate and a rear wiper at the tail
    const S = side(p, A(sVis) + (p.rot === 0 ? 0.001 : -0.001));
    const c0 = bl + 0.04;
    const c1 = br - 0.04;
    pq(p, S, c0, c1, 2.2, 3.6, TRIM[3]);
    pq(p, S, c0, c1, 3.4, 3.6, TRIM[4]);
    if (noseVis) {
      for (const [b0, b1] of [[c0 + 0.02, c0 + 0.16], [c1 - 0.16, c1 - 0.02]]) {
        pq(p, S, b0, b1, 5, 6.2, '#3a3a40');
        pq(p, S, b0 + 0.01, b1 - 0.01, 5.2, 6.0, '#fff6d0');
        pq(p, S, b0 + 0.01, b0 + 0.05, 5.6, 6.0, '#ffffff');
      }
      pq(p, S, c0 + 0.22, c1 - 0.22, 4.2, 5.8, '#1a1a20');
      for (let z = 4.6; z < 5.8; z += 0.5) pq(p, S, c0 + 0.24, c1 - 0.24, z, z + 0.2, '#4a4e58');
      const [ix, iy] = F.F(A(L - 0.04), 5.6);
      px(p.c, ix - 1 * u, iy - 1 * u, '#f0a020', 2 * u, 2 * u);
    } else {
      for (const [b0, b1] of [[c0 + 0.01, c0 + 0.14], [c1 - 0.14, c1 - 0.01]]) {
        pq(p, S, b0, b1, 4.6, 6.4, '#5a1414');
        pq(p, S, b0 + 0.01, b1 - 0.01, 4.8, 6.2, '#d8302a');
        pq(p, S, b0 + 0.01, b0 + 0.05, 5.6, 6.2, '#ff8a6a');
      }
      if (van) {
        pq(p, S, D / 2 - 0.005, D / 2 + 0.005, 3.6, top - 0.4, B[1]);
        pt(p, S, c0 + 0.06, D / 2 - 0.04, 12, 18, GLASS, S.light);
        pt(p, S, D / 2 + 0.04, c1 - 0.06, 12, 18, GLASS, S.light);
      }
    }
    pq(p, S, D / 2 - 0.1, D / 2 + 0.1, 2.5, 3.4, '#2a2a30');
    pq(p, S, D / 2 - 0.09, D / 2 + 0.09, 2.6, 3.3, '#f4f2e8');
    pq(p, S, D / 2 - 0.08, D / 2 - 0.03, 2.7, 3.2, '#2a50a0');
    // the near wheels in their arches
    for (const s of ws) {
      arch(p, A(s), br + 0.002, R, '#121216', B[F.light ? 2 : 1]);
      tread(p, A(s), br, R);
      wheel(p, A(s), br + 0.03, R, { rim: v.kind === 'pickup' || van ? GALV : V_SILVER });
    }
  },
  lights(k) {
    const [name, r0] = (k.variant ?? 'hatch').split('-');
    if (name !== 'follow') return [];
    void r0;
    return [{ a: k.w / 2, b: k.d / 2, z: 16, r: 1.6, color: '#ffb030', kind: 'lamp' }];
  },
};

// ── the avgas bowser ────────────────────────────────────────
const rob_fueltruck: PropArt = {
  draw(p, k) {
    const rev = (k.variant ?? '').includes('rev');
    const W = k.w;
    const D = k.d;
    const c = D / 2;
    const L = W - 0.2;
    const a0 = 0.1;
    const { A, box } = along(p, a0, L, rev);
    const { noseVis } = ends(p, rev);
    const u = p.k / 4;
    const bl = c - 0.56;
    const br = c + 0.56;
    const R = 15;
    const axles = [0.86, 1.62, L - 0.58];
    const cab0 = L - 1.18;
    footShadow(p, Math.min(A(0), A(L)), bl, Math.max(A(0), A(L)), br + 0.06, 30, 0.36);
    for (const s of axles) wheel(p, A(s), bl + 0.22, R, { far: true });
    // the chassis rails and the cab's frame
    box(0.12, L - 0.2, bl + 0.16, br - 0.16, 3.4, 6.2, dark());
    // the tank: an elliptic barrel, white with the fuel company's orange-red band low on its flank
    const tank = () => {
      const s0 = 0.5;
      const s1 = cab0 - 0.08;
      const zc = 16.8;
      const secs = [
        { s: A(s0), c, z: zc, w: 0.47, h: 8.6 },
        { s: A(s0 + 0.07), c, z: zc, w: 0.56, h: 10.2 },
        { s: A(s1 - 0.07), c, z: zc, w: 0.56, h: 10.2 },
        { s: A(s1), c, z: zc, w: 0.47, h: 8.6 },
      ];
      const n = 20;
      const ph = Math.PI / n;
      const faces: Face[] = loft(
        'a',
        secs,
        n,
        (f) => {
          if (f < 0) return V_WHITE;
          const t = ph + ((f + 0.5) / n) * Math.PI * 2;
          const sn = Math.sin(t);
          const cs = Math.cos(t);
          if (cs > 0.2 && sn < -0.06 && sn > -0.62) return ORANGE;
          if (cs > 0.2 && sn <= -0.62 && sn > -0.8) return V_RED;
          return V_WHITE;
        },
        { phase: ph },
      );
      layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
      // the band's lettering, the manlids and the walkway rail on top, the ladder at the rear
      const F = front(p, c + 0.47);
      const [tx, ty] = F.F((A(s0) + A(s1)) / 2, 12.6);
      const d = dirA(p);
      label(p.c, 'AVGAS 100LL', tx, ty, d, 2 * u, '#fff4e8');
      const zt = zc + 10.2;
      for (const s of [s0 + 0.5, (s0 + s1) / 2, s1 - 0.5]) {
        const [mx, my] = p.P(A(s), c, zt);
        fillPoly(p.c, oval(mx, my, d, 9 * u, 3 * u), V_WHITE[1]);
        fillPoly(p.c, oval(mx, my - 1 * u, d, 8 * u, 2.6 * u), V_WHITE[4]);
        px(p.c, mx - 1 * u, my - 3 * u, '#c83a2a', 2 * u, 2 * u);
      }
      const [r0x, r0y] = p.P(A(s0 + 0.2), c + 0.3, zt + 2.2);
      const [r1x, r1y] = p.P(A(s1 - 0.2), c + 0.3, zt + 2.2);
      ln(p.c, r0x, r0y, r1x, r1y, YEL[4], Math.max(1, Math.round(u)));
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const x = r0x + (r1x - r0x) * t;
        const y = r0y + (r1y - r0y) * t;
        ln(p.c, x, y, x, y + 9 * u, YEL[3], Math.max(1, Math.round(u)));
      }
      const [lx, ly] = p.P(A(s0 + 0.05), br - 0.02, 6.4);
      const [lx2, ly2] = p.P(A(s0 + 0.05), br - 0.06, zt);
      for (const dx of [0, 6 * u]) ln(p.c, lx + dx, ly, lx2 + dx, ly2, GALV[4], Math.max(1, Math.round(u)));
      for (let z = 8; z < zt; z += 3) {
        const [x, y] = p.P(A(s0 + 0.05), br - 0.03, z);
        px(p.c, x, y, GALV[5], 6 * u, 1 * u);
      }
    };
    // the cab-over: a red lower half, white above, a black bumper and the big windscreen
    const cab = () => {
      box(cab0, L, bl, br, 4.2, 13.2, paint(V_RED));
      box(cab0, L, bl, br, 13.2, 27.6, paint(V_WHITE));
      box(cab0 + 0.06, L - 0.12, bl + 0.06, br - 0.06, 27.6, 29, mono(flat(V_WHITE, 4, 3, 5), V_WHITE[0]));
      const Fc = front(p, br + 0.001);
      // the door, its window, the handle, the steps, the company stripe
      pt(p, Fc, Math.min(A(cab0 + 0.2), A(L - 0.16)), Math.max(A(cab0 + 0.2), A(L - 0.16)), 17.2, 25.8, GLASS, Fc.light);
      pq(p, Fc, Math.min(A(cab0 + 0.14), A(L - 0.12)), Math.max(A(cab0 + 0.14), A(L - 0.12)), 16.6, 17.2, V_WHITE[Fc.light ? 2 : 1]);
      for (const s of [cab0 + 0.14, L - 0.12]) pq(p, Fc, A(s) - 0.008, A(s) + 0.008, 5, 26.4, V_WHITE[1]);
      pq(p, Fc, A(cab0 + 0.3) - 0.04, A(cab0 + 0.3) + 0.04, 15.2, 15.7, GALV[5]);
      pq(p, Fc, Math.min(A(cab0), A(L)), Math.max(A(cab0), A(L)), 13, 13.6, '#f4c430');
      for (const z of [5.4, 8.6]) pq(p, Fc, Math.min(A(cab0 + 0.22), A(cab0 + 0.6)), Math.max(A(cab0 + 0.22), A(cab0 + 0.6)), z, z + 0.7, TRIM[4]);
      // the mirror on its arm
      const [mx, my] = p.P(A(L - 0.04), br + 0.14, 22);
      ln(p.c, mx, my + 4 * u, mx + 6 * u * (p.rot === 0 ? -1 : 1), my + 6 * u, TRIM[2], Math.max(1, Math.round(u)));
      px(p.c, mx - 2 * u, my - 6 * u, TRIM[1], 4 * u, 10 * u);
      px(p.c, mx - 1 * u, my - 5 * u, '#6a9cb2', 2 * u, 7 * u);
      // the beacon
      const [bx, by] = p.P(A(L - 0.6), c, 29);
      px(p.c, bx - 4 * u, by - 2 * u, TRIM[2], 8 * u, 2 * u);
      fillPoly(p.c, oval(bx, by - 4 * u, [1, 0], 3 * u, 3 * u), '#f08a1a');
      px(p.c, bx - 1 * u, by - 6 * u, '#ffd27a', 2 * u, 2 * u);
      if (noseVis) {
        const S = side(p, A(L) + (p.rot === 0 ? 0.001 : -0.001));
        pt(p, S, bl + 0.08, br - 0.08, 16.4, 26, GLASS, S.light);
        pq(p, S, c - 0.01, c + 0.01, 16.4, 26, V_WHITE[2]);
        pq(p, S, bl + 0.02, br - 0.02, 26, 27.2, '#1e2026');
        pq(p, S, bl + 0.2, br - 0.2, 6.4, 11.6, '#1a1a20');
        for (let z = 7; z < 11.4; z += 1) pq(p, S, bl + 0.22, br - 0.22, z, z + 0.4, '#565a64');
        for (const [b0, b1] of [[bl + 0.04, bl + 0.18], [br - 0.18, br - 0.04]]) {
          pq(p, S, b0, b1, 7.4, 9.6, '#30323a');
          pq(p, S, b0 + 0.01, b1 - 0.01, 7.6, 9.4, '#fff6d0');
          pq(p, S, b0 + 0.01, b0 + 0.05, 8.6, 9.4, '#ffffff');
        }
        pq(p, S, bl - 0.01, br + 0.01, 3.4, 6.2, TRIM[3]);
        pq(p, S, bl - 0.01, br + 0.01, 5.8, 6.2, TRIM[5]);
        pq(p, S, c - 0.12, c + 0.12, 3.8, 5.2, '#f4f2e8');
        const [sx, sy] = S.F(c, 15);
        label(p.c, 'AVGAS', sx, sy, readB(p), 1.4 * u, '#c0302a');
      }
    };
    // the rear cabinet: hose reel, meters, a roller shutter
    const cabinet = () => {
      box(0, 0.5, bl + 0.04, br - 0.04, 4.6, 22, {
        front: (light) => (_u, v) => at(GALV, (light ? 4 : 2.6) + (Math.floor(v / 3) % 2 ? -0.5 : 0)),
        side: flat(GALV, 3, 2, 4),
        top: flat(GALV, 5, 4, 6),
        edge: GALV[0],
      });
      const F = front(p, br - 0.04 + 0.001);
      pq(p, F, Math.min(A(0.06), A(0.44)), Math.max(A(0.06), A(0.44)), 6.4, 20, '#2a2c34');
      const [hx, hy] = F.F(A(0.25), 13);
      const d = dirA(p);
      fillPoly(p.c, oval(hx, hy, d, 13 * u, 13 * u), '#3a3c44');
      for (let i = 0; i < 5; i++) fillPoly(p.c, oval(hx, hy, d, (11 - i * 1.8) * u, (11 - i * 1.8) * u), i % 2 ? '#141418' : '#22242a');
      fillPoly(p.c, oval(hx, hy, d, 3 * u, 3 * u), YEL[4]);
      ln(p.c, hx - 4 * u, hy + 10 * u, hx - 8 * u, hy + 30 * u, '#141418', Math.max(2, Math.round(2 * u)));
      px(p.c, hx - 10 * u, hy + 29 * u, GALV[5], 5 * u, 3 * u);
      const [gx, gy] = F.F(A(0.42), 18);
      for (const dx of [0, 7 * u]) {
        fillPoly(p.c, oval(gx + dx * d[0], gy + dx * d[1], d, 2.6 * u, 2.6 * u), '#f4f2e8');
        px(p.c, gx + dx * d[0], gy + dx * d[1] - 2 * u, '#c0302a', 1 * u, 2 * u);
      }
      // the tail lamps when the rear faces us
      if (!noseVis) {
        const S = side(p, A(0) + (p.rot === 0 ? 0.001 : -0.001));
        for (const [b0, b1] of [[bl + 0.06, bl + 0.22], [br - 0.22, br - 0.06]]) pq(p, S, b0, b1, 4.8, 6.4, '#d8302a');
        pq(p, S, bl + 0.04, br - 0.04, 3, 4.6, '#e8b830');
      }
    };
    if (noseVis) {
      cabinet();
      tank();
      cab();
    } else {
      cab();
      tank();
      cabinet();
    }
    // the side: an under-run bar, a lockable toolbox and the extinguisher, the mudguards
    const F = front(p, br + 0.001);
    box(1.98, 2.62, br - 0.3, br - 0.04, 3.4, 7.4, mono(flat(GALV, 4, 3, 5), GALV[0]));
    pq(p, F, Math.min(A(2.0), A(2.6)), Math.max(A(2.0), A(2.6)), 6.4, 6.8, GALV[2]);
    const [ex, ey] = p.P(A(2.78), br - 0.06, 4);
    px(p.c, ex - 2 * u, ey - 12 * u, RED[3], 4 * u, 12 * u);
    px(p.c, ex - 2 * u, ey - 12 * u, RED[5], 1 * u, 12 * u);
    px(p.c, ex - 1 * u, ey - 14 * u, '#2a2a30', 2 * u, 2 * u);
    for (const s of [axles[0], axles[1]]) arch(p, A(s), br - 0.08, R, '#16171c', TRIM[3]);
    arch(p, A(axles[2]), br + 0.002, R, '#121216', V_RED[2]);
    for (const s of axles) {
      tread(p, A(s), br - 0.04, R);
      wheel(p, A(s), br - 0.02, R, { tw: 0.2 });
    }
  },
  anim(p, k) {
    const rev = (k.variant ?? '').includes('rev');
    const L = k.w - 0.2;
    const a = rev ? 0.1 + 0.6 : 0.1 + L - 0.6;
    const [bx, by] = p.P(a, k.d / 2, 29);
    const u = p.k / 4;
    if (Math.sin(k.t * 7) > 0.3) {
      fillPoly(p.c, oval(bx, by - 4 * u, [1, 0], 3.4 * u, 3.4 * u), '#ffd27a');
      p.c.globalAlpha = 0.25;
      fillPoly(p.c, oval(bx, by - 4 * u, [1, 0], 10 * u, 6 * u), '#ffb03a');
      p.c.globalAlpha = 1;
    }
  },
};

// ── the tow tractor ─────────────────────────────────────────
const rob_tug: PropArt = {
  draw(p, k) {
    const rev = (k.variant ?? '').includes('rev');
    const W = k.w;
    const D = k.d;
    const c = D / 2;
    const L = 1.62;
    const a0 = (W - L) / 2;
    const { A, box } = along(p, a0, L, rev);
    const { noseVis } = ends(p, rev);
    const u = p.k / 4;
    const bl = c - 0.4;
    const br = c + 0.4;
    const R = 10;
    const ws = [0.34, L - 0.34];
    const Y = V_YEL;
    footShadow(p, Math.min(A(0), A(L)), bl, Math.max(A(0), A(L)), br + 0.05, 18, 0.36);
    for (const s of ws) wheel(p, A(s), bl + 0.2, R, { far: true });
    box(0.08, L - 0.08, bl + 0.06, br - 0.06, 1.6, 3.2, dark());
    // the low body with its ballast, the hitch at each end, the glazed cab and its roof
    const hitch = (s0: number, s1: number) => box(s0, s1, c - 0.08, c + 0.08, 2.6, 4, dark());
    if (noseVis) hitch(-0.12, 0);
    else hitch(L, L + 0.12);
    box(0, L, bl, br, 3, 8.4, paint(Y));
    const cab0 = 0.18;
    const cab1 = 0.98;
    box(cab0, cab1, bl + 0.04, br - 0.04, 8.4, 17.6, { front: GLASS, side: GLASS, top: flat(Y, 5, 4, 6), edge: Y[0] });
    const Fg = front(p, br - 0.04 + 0.001);
    for (const s of [cab0, cab1, (cab0 + cab1) / 2]) pq(p, Fg, A(s) - 0.03, A(s) + 0.03, 8.4, 17.6, Y[Fg.light ? 3 : 2]);
    pq(p, Fg, Math.min(A(cab0), A(cab1)), Math.max(A(cab0), A(cab1)), 8.4, 9.2, Y[Fg.light ? 3 : 2]);
    const Sg = side(p, (p.rot === 0) === !rev ? A(cab1) : A(cab0));
    pq(p, Sg, bl + 0.04, bl + 0.08, 8.4, 17.6, Y[Sg.light ? 3 : 2]);
    pq(p, Sg, br - 0.08, br - 0.04, 8.4, 17.6, Y[Sg.light ? 3 : 2]);
    box(cab0 - 0.04, cab1 + 0.04, bl + 0.02, br - 0.02, 17.6, 18.8, mono(flat(Y, 4, 3, 5), Y[0]));
    // the bonnet's louvres, a hazard band on the bumpers, the beacon
    const F = front(p, br + 0.001);
    for (let i = 0; i < 4; i++) {
      const s = cab1 + 0.1 + i * 0.1;
      pq(p, F, A(s) - 0.02, A(s) + 0.02, 5.4, 7.4, Y[1]);
    }
    const S = side(p, (p.rot === 0) === !rev ? A(L) + (p.rot === 0 ? 0.001 : -0.001) : A(0) + (p.rot === 0 ? 0.001 : -0.001));
    pt(p, S, bl, br, 3, 5, (_u: number, v: number, x: number, y: number) => (Math.floor((x - y * 0.5 + v) / 5) & 1 ? '#1d1c20' : '#f4c430') as string, S.light);
    if (noseVis)
      for (const [b0, b1] of [[bl + 0.04, bl + 0.14], [br - 0.14, br - 0.04]]) {
        pq(p, S, b0, b1, 6, 7.4, '#fff6d0');
        pq(p, S, b0, b0 + 0.03, 6.8, 7.4, '#ffffff');
      }
    else for (const [b0, b1] of [[bl + 0.04, bl + 0.14], [br - 0.14, br - 0.04]]) pq(p, S, b0, b1, 6, 7.4, '#d8302a');
    const [bx, by] = p.P(A((cab0 + cab1) / 2), c, 18.8);
    px(p.c, bx - 3 * u, by - 1 * u, TRIM[2], 6 * u, 2 * u);
    fillPoly(p.c, oval(bx, by - 3 * u, [1, 0], 2.6 * u, 2.6 * u), '#f08a1a');
    px(p.c, bx - 1 * u, by - 5 * u, '#ffd27a', 2 * u, 2 * u);
    {
      const [x, y] = F.F((A(cab0) + A(cab1)) / 2, 5.6);
      label(p.c, 'TUG 3', x, y, dirA(p), 1.2 * u, '#1d1c20');
    }
    for (const s of ws) {
      arch(p, A(s), br + 0.002, R, '#121216', Y[F.light ? 2 : 1]);
      tread(p, A(s), br, R);
      wheel(p, A(s), br + 0.04, R, { tw: 0.2, rim: V_YEL });
    }
  },
  anim(p, k) {
    const rev = (k.variant ?? '').includes('rev');
    const L = 1.62;
    const a0 = (k.w - L) / 2;
    const s = (0.18 + 0.98) / 2;
    const [bx, by] = p.P(rev ? a0 + L - s : a0 + s, k.d / 2, 18.8);
    const u = p.k / 4;
    if (Math.sin(k.t * 6 + 1) > 0.4) fillPoly(p.c, oval(bx, by - 3 * u, [1, 0], 3 * u, 3 * u), '#ffd27a');
  },
};

// ── the baggage train ───────────────────────────────────────
const CART: Ramp = ['#14223a', '#1c3050', '#264268', '#325684', '#426ca0', '#5a86ba', '#7aa2d0'];
const CASES: Ramp[] = [
  ['#1e3a6a', '#264a84', '#2e5ca0', '#3a70ba', '#4c86cc', '#68a0dc'],
  ['#5a1416', '#7a1c1e', '#9a2626', '#bc3430', '#d44c40', '#e8705c'],
  ['#1e4a2a', '#286036', '#327642', '#3e8c50', '#4ca260', '#62b876'],
  ['#2a2a32', '#36363e', '#44444e', '#54545e', '#666672', '#7a7a86'],
  ['#6a4a10', '#8a6416', '#ac7e1e', '#cc9a2a', '#e2b440', '#f0ca66'],
];
const crate: Mat = (light, w, h) => (u, v, x, y) => {
  let i = light === 2 ? 4.4 : light ? 3.6 : 2.2;
  if (v < 1.2 || v > h - 1.2 || u < 1.2 || u > w - 1.2) i -= 1.2;
  else if (Math.abs(v - h / 2) < 0.8) i -= 0.6;
  if (hash(x, y, 9) < 0.05) i -= 0.5;
  return at(PINE, i);
};
const rob_bagcart: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = D / 2;
    const u = p.k / 4;
    const bl = c - 0.42;
    const br = c + 0.42;
    // left to right: three dollies, then the tractor pulling toward +a
    const n = 3;
    const tr0 = W - 1.42;
    const cl = (tr0 - 0.12) / n;
    footShadow(p, 0.1, bl, W - 0.05, br + 0.04, 12, 0.32);
    const R0 = (s: number) => {
      let q = s;
      return () => {
        q = (q * 9301 + 49297) % 233280;
        return q / 233280;
      };
    };
    for (let i = 0; i < n; i++) {
      const a0 = 0.12 + i * cl;
      const a1 = a0 + cl - 0.3;
      const wr = 7;
      for (const s of [a0 + 0.22, a1 - 0.22]) wheel(p, s, bl + 0.12, wr, { far: true });
      // the drawbar to the next dolly (or the tractor)
      lbox(p, a1, c - 0.03, 0.32, 0.06, 2.6, 0.6, dark());
      lbox(p, a0 + 0.04, bl + 0.06, a1 - a0 - 0.08, br - bl - 0.12, 2, 1.4, dark());
      lbox(p, a0, bl, a1 - a0, br - bl, 3.4, 1.2, paint(CART));
      // the far rail and the rear gate
      lbox(p, a0, bl, a1 - a0, 0.04, 4.6, 5.4, mono(flat(CART, 3, 2, 4), CART[0]));
      lbox(p, a0, bl, 0.04, br - bl, 4.6, 5.4, mono(flat(CART, 3, 2, 4), CART[0]));
      // the load: crates and cases, back row first
      const R = R0(k.seed * 31 + i * 7 + 3);
      for (const row of [bl + 0.06, c + 0.02]) {
        let a = a0 + 0.08;
        while (a < a1 - 0.28) {
          const w = 0.26 + R() * 0.26;
          const a2 = Math.min(a1 - 0.06, a + w);
          const isCrate = R() < 0.45;
          const h = isCrate ? 4.6 + R() * 2 : 2.6 + R() * 3.4;
          const bd = Math.min(br - 0.06 - row, 0.32 + R() * 0.06);
          if (isCrate) lbox(p, a, row, a2 - a, bd, 4.6, h, { front: crate, side: crate, top: crate, edge: PINE[0] });
          else {
            const r = CASES[Math.floor(R() * CASES.length)];
            lbox(p, a, row + 0.04, a2 - a, bd - 0.08, 4.6, h, { front: enamel(r, 0.01), side: enamel(r, 0.01), top: flat(r, 4, 3, 5), edge: r[0] });
            const [hx, hy] = p.P((a + a2) / 2, row + bd / 2, 4.6 + h);
            px(p.c, hx - 2 * u, hy - 2 * u, '#1a1a20', 4 * u, 2 * u);
          }
          a = a2 + 0.04;
        }
      }
      // the near rail on its posts, the front gate
      lbox(p, a1 - 0.04, bl, 0.04, br - bl, 4.6, 5.4, mono(flat(CART, 3, 2, 4), CART[0]));
      for (const s of [a0, (a0 + a1) / 2, a1 - 0.04]) lbox(p, s, br - 0.04, 0.04, 0.04, 4.6, 5.4, mono(flat(CART, 4, 3, 5), CART[0]));
      lbox(p, a0, br - 0.04, a1 - a0, 0.04, 9.2, 0.8, mono(flat(CART, 4, 3, 5), CART[0]));
      lbox(p, a0, br - 0.04, a1 - a0, 0.04, 6.8, 0.5, mono(flat(CART, 4, 3, 5), CART[0]));
      const F = front(p, br + 0.001);
      pq(p, F, a0 + 0.06, a0 + 0.3, 3.6, 4.4, '#f4f2e8');
      for (const s of [a0 + 0.22, a1 - 0.22]) {
        tread(p, s, br - 0.04, wr);
        wheel(p, s, br - 0.04, wr, { tw: 0.1 });
      }
    }
    // the tractor: white with a blue stripe, a canopy on four posts over the seat
    const T0 = tr0 + 0.04;
    const T1 = W - 0.08;
    const Rt = 10;
    for (const s of [T0 + 0.3, T1 - 0.3]) wheel(p, s, bl + 0.18, Rt, { far: true });
    lbox(p, T0, bl + 0.06, T1 - T0, br - bl - 0.12, 1.6, 1.6, dark());
    lbox(p, T0 - 0.1, c - 0.06, 0.12, 0.12, 2.4, 1.4, dark());
    lbox(p, T0, bl, T1 - T0, br - bl, 3, 6, paint(V_WHITE));
    // the seat and wheel between the posts, under the canopy
    lbox(p, T0 + 0.16, c - 0.2, 0.3, 0.4, 9, 1.4, dark());
    lbox(p, T0 + 0.12, c - 0.2, 0.08, 0.4, 9, 5, dark());
    lbox(p, T0 + 0.62, bl + 0.06, T1 - T0 - 0.68, br - bl - 0.12, 9, 2.6, paint(V_WHITE));
    const [sx, sy] = p.P(T0 + 0.6, c, 13);
    ln(p.c, sx - 4 * u, sy + 1 * u, sx + 4 * u, sy - 2 * u, '#16161a', Math.max(1, Math.round(2 * u)));
    for (const [a, b] of [[T0 + 0.04, bl + 0.04], [T0 + 0.04, br - 0.08], [T0 + 0.7, bl + 0.04], [T0 + 0.7, br - 0.08]] as const) lbox(p, a, b, 0.04, 0.04, 9, 9, mono(flat(TRIM, 3, 2, 4), TRIM[0]));
    lbox(p, T0 - 0.02, bl, 0.8, br - bl, 18, 1, mono(flat(V_BLUE, 4, 3, 5), V_BLUE[0]));
    const F = front(p, br + 0.001);
    pq(p, F, T0, T1, 5.6, 6.6, V_BLUE[F.light ? 4 : 3]);
    pq(p, F, T0, T1, 3, 3.6, TRIM[3]);
    const S = side(p, T1 + 0.001);
    pq(p, S, bl + 0.04, bl + 0.16, 6.8, 8, '#fff6d0');
    pq(p, S, br - 0.16, br - 0.04, 6.8, 8, '#fff6d0');
    pq(p, S, bl + 0.24, br - 0.24, 4.4, 7.6, '#2a2c34');
    pq(p, S, bl, br, 3, 4.2, TRIM[3]);
    const [bx, by] = p.P(T0 + 0.4, c, 19);
    fillPoly(p.c, oval(bx, by - 3 * u, [1, 0], 2.6 * u, 2.6 * u), '#f08a1a');
    for (const s of [T0 + 0.3, T1 - 0.3]) {
      arch(p, s, br + 0.002, Rt, '#121216', V_WHITE[2]);
      tread(p, s, br, Rt);
      wheel(p, s, br + 0.04, Rt, { tw: 0.18 });
    }
  },
};

// ── apron equipment ─────────────────────────────────────────
/** A yellow ground power unit on a trolley: louvres, the control panel, the cable coiled on top. */
const rob_gpu: PropArt = {
  draw(p, k) {
    const u = p.k / 4;
    const Y = V_YEL;
    footShadow(p, 0.12, 0.18, 0.92, 0.84, 14, 0.32);
    for (const s of [0.28, 0.72]) wheel(p, s, 0.3, 6, { far: true });
    lbox(p, 0.16, 0.22, 0.68, 0.56, 1.6, 1.4, dark());
    lbox(p, 0.84, 0.47, 0.34, 0.06, 2.2, 0.6, dark());
    lbox(p, 0.14, 0.2, 0.72, 0.6, 3, 9, paint(Y));
    lbox(p, 0.12, 0.18, 0.76, 0.64, 12, 0.8, mono(flat(Y, 4, 3, 5), Y[0]));
    const F = front(p, 0.8 + 0.001);
    pq(p, F, 0.2, 0.46, 6, 10.4, '#1e1e24');
    pq(p, F, 0.23, 0.43, 8.4, 10, '#3fd68a');
    for (const a of [0.27, 0.35]) pq(p, F, a, a + 0.04, 6.6, 7.4, a < 0.3 ? '#d8302a' : '#f4f2e8');
    for (let i = 0; i < 5; i++) pq(p, F, 0.54, 0.8, 4.4 + i * 1.4, 5 + i * 1.4, Y[1]);
    const S = side(p, 0.86 + 0.001);
    for (let i = 0; i < 4; i++) pq(p, S, 0.26, 0.74, 4.6 + i * 1.6, 5.2 + i * 1.6, Y[1]);
    pt(p, S, 0.2, 0.8, 3, 4, (_u: number, _v: number, x: number, y: number) => (Math.floor((x - y * 0.5) / 4) & 1 ? '#1d1c20' : '#f4c430') as string, S.light);
    // the cable coiled on top, its plug hanging over the edge
    const [cx, cy] = p.P(0.5, 0.5, 12.8);
    const d = dirA(p);
    for (let i = 0; i < 3; i++) {
      fillPoly(p.c, oval(cx, cy - i * 1.6 * u, [1, 0], 11 * u, 5.4 * u), i % 2 ? '#1c1c22' : '#2a2a32');
      fillPoly(p.c, oval(cx, cy - i * 1.6 * u, [1, 0], 6 * u, 2.6 * u), Y[3]);
    }
    ln(p.c, cx - 10 * u, cy, cx - 16 * u, cy + 14 * u, '#1c1c22', Math.max(1, Math.round(2 * u)));
    px(p.c, cx - 18 * u, cy + 13 * u, GALV[5], 4 * u, 4 * u);
    void d;
    for (const s of [0.28, 0.72]) {
      tread(p, s, 0.8, 6);
      wheel(p, s, 0.82, 6, { tw: 0.08 });
    }
    void k;
  },
};

/** A pair of yellow wheel chocks joined by a rope. */
const rob_chocks: PropArt = {
  draw(p, k) {
    const u = p.k / 4;
    const ch = (a: number, b: number) => {
      lbox(p, a, b, 0.3, 0.18, 0, 2, paint(V_YEL));
      lbox(p, a + 0.06, b, 0.18, 0.18, 2, 1.2, paint(V_YEL));
      const F = front(p, b + 0.181);
      pq(p, F, a + 0.03, a + 0.27, 0.6, 1.3, '#1d1c20');
    };
    footShadow(p, 0.2, 0.3, 0.8, 0.7, 2, 0.24);
    ch(0.14, 0.26);
    ch(0.56, 0.56);
    const [x0, y0] = p.P(0.44, 0.34, 1.6);
    const [x1, y1] = p.P(0.62, 0.64, 1.6);
    const [mx, my] = p.P(0.48, 0.62, 0.2);
    ln(p.c, x0, y0, mx, my, '#e8e0c0', Math.max(1, Math.round(u)));
    ln(p.c, mx, my, x1, y1, '#e8e0c0', Math.max(1, Math.round(u)));
    void k;
  },
};

/** A tow bar lying on the apron: a yellow A-frame on two small wheels, the towing eye at its tip. */
const rob_towbar: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = k.d / 2;
    const u = p.k / 4;
    footShadow(p, 0.1, c - 0.3, W - 0.1, c + 0.3, 3, 0.24);
    wheel(p, 0.5, c - 0.22, 5, { far: true });
    const tube = (a0: number, b0: number, z0: number, a1: number, b1: number, z1: number) => {
      const [x0, y0] = p.P(a0, b0, z0);
      const [x1, y1] = p.P(a1, b1, z1);
      ln(p.c, x0, y0 + 1 * u, x1, y1 + 1 * u, V_YEL[1], Math.max(2, Math.round(3 * u)));
      ln(p.c, x0, y0 - 1 * u, x1, y1 - 1 * u, V_YEL[4], Math.max(1, Math.round(2 * u)));
      ln(p.c, x0, y0 - 1.5 * u, x1, y1 - 1.5 * u, V_YEL[6], Math.max(1, Math.round(u)));
    };
    tube(0.5, c - 0.24, 2.4, W - 0.25, c, 1.6);
    tube(0.5, c + 0.24, 2.4, W - 0.25, c, 1.6);
    tube(0.5, c - 0.26, 2.4, 0.5, c + 0.26, 2.4);
    // the head that clamps the nose wheel, the hazard stripes, the towing eye
    lbox(p, 0.12, c - 0.14, 0.38, 0.28, 1, 2.4, paint(V_YEL));
    const F = front(p, c + 0.141);
    for (let i = 0; i < 4; i++) pq(p, F, 0.14 + i * 0.09, 0.18 + i * 0.09, 1.2, 3.2, '#1d1c20');
    const [ex, ey] = p.P(W - 0.2, c, 1.6);
    fillPoly(p.c, oval(ex, ey, dirA(p), 4 * u, 3 * u), '#2a2a30');
    fillPoly(p.c, oval(ex, ey, dirA(p), 2 * u, 1.4 * u), '#8a8c94');
    tread(p, 0.5, c + 0.26, 5);
    wheel(p, 0.5, c + 0.28, 5, { tw: 0.08 });
    void k;
  },
};

export const ROBOTICS_VEHICLES: Record<string, PropArt> = { rob_car, rob_fueltruck, rob_tug, rob_bagcart, rob_gpu, rob_chocks, rob_towbar };
export { dirA, label, oval };

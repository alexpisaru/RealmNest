// Creative Studio — the arts district's buildings (1 z ≈ 10 cm; a storey ≈ 28 z).
//   std_house    timber beach houses on lattice-skirted piers, painted weatherboard,
//                tin or shake roofs, porches and verandas, sash windows with shutters
//                and window boxes, murals on the side walls. Variants: cottage
//                (gable front, porch), twin (two storeys, double veranda), studio
//                (a boathouse-studio with glass barn doors), surf (the surf shop),
//                cafe (an awning, tables), gallery (flat roof, roof terrace, a mural).
//   std_hut      a bathing hut (each its own colour)
//   std_lifeguard the lifeguard hut on stilts with its ramp and flags
//   std_roofs    a distant roofscape of beach houses (flat fills only, cheap)
// Visible faces: the front (b = d) and the side turned to the camera (a = w for
// rot 0, a = 0 for rot 1). Roofs are convex solids: only faces toward us draw.
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx, PropLight } from '../../../props';
import { at, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { beam, front3, type Plane, poly3, pq, pt, side3 } from '../../plane4';
import { footShadow, lbox } from '../util';
import { PALMLEAF, ALU, clap, CORAL, corrugated, CREAM, darken, DRIFT, fabric, GEAR, LEAF, LEMON, lighten, LILAC, MINT, MUSTARD, PINE, PINK, shakes, SKY, solidFaces, TEAL, weathered, pmod } from './kit';
import { pot } from './lounge';
import { frond } from './beach';

type V3 = [number, number, number];
type Pl = Plane & { at: (u: number, z: number) => V3 };

/** Siding colours of the district. */
export const SIDING: Record<string, Ramp> = {
  mint: MINT,
  coral: ['#7a2416', '#a23420', '#c84a30', '#e4664a', '#f08068', '#f8a088', '#fcc4a8'],
  lemon: LEMON,
  sky: SKY,
  pink: PINK,
  lilac: LILAC,
  teal: ['#14524c', '#1c6c64', '#28887e', '#3ea69a', '#5ec0b4', '#82d4c8', '#aee6dc'],
  white: ['#8e8880', '#aaa59c', '#c6c1b6', '#dcd8cc', '#ece8de', '#f8f4ec', '#fffdf8'],
  butter: ['#865a10', '#a87418', '#cc9424', '#eab03a', '#f3ba4f', '#f8d06e', '#fce49c'],
};
// roofs (exact reference tones at index 3–4): red, green, grey, ochre, blue, coral, turquoise
const ROOFC: Ramp[] = [
  ['#4a120c', '#681c14', '#82261c', '#973227', '#b44943', '#c8604e', '#dc806a'],
  ['#0a3028', '#0e4034', '#145244', '#1c6057', '#21786a', '#2e9280', '#48ac98'],
  ['#3a3c42', '#4a4d54', '#575c64', '#707378', '#888b88', '#9d9da0', '#bcbcbe'],
  ['#7a4610', '#9a5c14', '#c07a24', '#e09a3a', '#f3ba4f', '#fabf5e', '#fcd688'],
  ['#1a2c6a', '#223c84', '#2e50a0', '#4468bc', '#6d98d1', '#88b0e0', '#a8c8ec'],
  ['#7a2a1a', '#a03a26', '#c84e36', '#e4664a', '#f08068', '#f69a80', '#fbb8a0'],
  ['#14524e', '#1a6a64', '#24847c', '#3a9e94', '#58b4ac', '#77c6c1', '#9cdcd4'],
];
const SHAKE: Ramp = ['#45464c', '#575960', '#6c6e74', '#83858a', '#9d9da0', '#b4b4b6', '#cacacc'];
const TRIM = CREAM;

/** A roof material with the face's shade baked in (ignores the face light). */
const roofOf =
  (r: Ramp, tin: boolean, shade: number, far = false): Mat =>
  () => {
    const l = shade >= 3.6 ? 2 : shade >= 2.4 ? 1 : 0;
    if (far) {
      const c = r[Math.max(1, Math.min(r.length - 1, Math.round(shade)))];
      const d = darken(c, 0.12);
      return (u: number) => (u % 7 < 2 ? d : c);
    }
    return (tin ? corrugated(r, 0.07) : shakes(r))(l as 0 | 1 | 2, 64, 64);
  };

// ── facade pieces ───────────────────────────────────────────
/** A double-hung sash window: white frame, two panes, curtains, optional shutters and a window box. */
function sash(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, o: { shut?: Ramp; box?: string[]; curtain?: string; seed: number; lit?: boolean }) {
  const light = pl.light;
  const fr = light ? TRIM[5] : TRIM[3];
  pq(p, pl, u0 - 0.05, u1 + 0.05, z0 - 0.8, z1 + 1.2, darken(fr, 0.25));
  pq(p, pl, u0 - 0.03, u1 + 0.03, z0 - 0.4, z1 + 0.9, fr);
  const glass: FaceTex = (u, v, x, y) => {
    const d = (u * 0.85 + v) % 30;
    if (d > 4 && d < 8) return light ? '#c8e2ea' : '#a8c4cc';
    if (o.lit && v < 10 && v > 3) return hash(x >> 1, y >> 1, 3) < 0.5 ? '#f2d48a' : '#e6c070';
    return v > (z1 - z0) * 4 - 8 ? '#1e2a34' : light ? '#3a5466' : '#2e4452';
  };
  pt(p, pl, u0 + 0.03, u1 - 0.03, z0, z1, glass, light);
  if (o.curtain) {
    const cw = (u1 - u0) * 0.22;
    pq(p, pl, u0 + 0.03, u0 + 0.03 + cw, z0 + (z1 - z0) * 0.25, z1, light ? o.curtain : darken(o.curtain, 0.2));
    pq(p, pl, u1 - 0.03 - cw, u1 - 0.03, z0 + (z1 - z0) * 0.25, z1, light ? o.curtain : darken(o.curtain, 0.2));
  }
  beam(p, pl, u0, (z0 + z1) / 2, u1, (z0 + z1) / 2, 0.45, TRIM);
  beam(p, pl, (u0 + u1) / 2, z0, (u0 + u1) / 2, z1, 0.3, TRIM);
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.2, z0 - 0.4, light ? TRIM[6] : TRIM[4]);
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.6, z0 - 1.2, darken(TRIM[2], 0.3));
  if (o.shut) {
    const sw = (u1 - u0) * 0.5;
    for (const [a, b] of [[u0 - sw - 0.05, u0 - 0.05], [u1 + 0.05, u1 + 0.05 + sw]]) {
      pt(p, pl, a, b, z0 - 0.2, z1 + 0.6, (_u: number, v: number) => at(o.shut!, (light ? 3.4 : 2) + (v % 3 < 1 ? -1.2 : 0.2)), light);
      pq(p, pl, a, b, z1 + 0.3, z1 + 0.6, o.shut[light ? 5 : 3]);
    }
  }
  if (o.box) {
    const [ax, ay] = pl.F(u0 - 0.06, z0 - 1.6);
    const [bx, by] = pl.F(u1 + 0.06, z0 - 1.6);
    pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 4, z0 - 1.6, o.shut ? o.shut[light ? 2 : 1] : PINE[light ? 3 : 2]);
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 6));
    const masses: Mass[] = [];
    for (let i = 0; i <= n; i++) masses.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n - 3, rx: 4.5, ry: 4, z: i });
    layer(p.c, (l) => foliage(l, masses, LEAF, o.seed, { cell: 2.4, dots: o.box, dotChance: 0.8, dotSize: 3 }), { outline: 0.55, rect: [Math.min(ax, bx) - 8, Math.min(ay, by) - 12, Math.max(ax, bx) + 8, Math.max(ay, by) + 6] });
  }
}

/** A painted panel door with a glazed top, a transom light, a little porch lamp. */
function beachDoor(p: PropPainter, pl: Pl, u0: number, u1: number, z0: number, z1: number, col: Ramp, seed: number) {
  const light = pl.light;
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0, z1 + 3.4, light ? TRIM[5] : TRIM[3]);
  pt(p, pl, u0 + 0.02, u1 - 0.02, z1 + 0.6, z1 + 2.8, (u: number, v: number) => ((u + v) % 20 < 3 ? '#c8e2ea' : '#3a5466'), light);
  pt(p, pl, u0, u1, z0, z1, (u: number, v: number, x: number, y: number) => {
    const W = (u1 - u0) * 71.6;
    const H = (z1 - z0) * 4;
    const U = u / W;
    const V = v / H;
    if (V > 0.55 && V < 0.9 && U > 0.15 && U < 0.85) return (u + v) % 18 < 3 ? '#d0e6ec' : '#34505e';
    let i = light ? 3.4 : 2;
    if ((V > 0.08 && V < 0.46 && (Math.abs(U - 0.15) < 0.04 || Math.abs(U - 0.85) < 0.04 || Math.abs(V - 0.08) < 0.02 || Math.abs(V - 0.46) < 0.02)) || Math.abs(U - 0.5) < 0.02) i -= 1.2;
    if (hash(x, y, 5) < 0.03) i -= 0.6;
    return at(col, i);
  }, light);
  const [kx, ky] = pl.F(u1 - (u1 - u0) * 0.14, z0 + (z1 - z0) * 0.48);
  px(p.c, kx - 1, ky - 1, '#7a5a20', 3, 3);
  px(p.c, kx - 1, ky - 1, '#f2d27a', 1, 1);
  // a ship's lantern beside the door
  const [lx, ly] = pl.F(u1 + 0.22, z1 - 2);
  px(p.c, lx - 2, ly - 7, GEAR[2], 5, 8);
  px(p.c, lx - 1, ly - 6, '#ffe7a8', 3, 5);
  px(p.c, lx - 3, ly - 8, GEAR[3], 7, 1);
  void seed;
}

/** Murals painted over the boards (U across, V up in 0…1); null keeps the siding. */
function mural(kind: number): (U: number, V: number, u: number, v: number) => string | null {
  return (U, V, u, v) => {
    if (U < 0.05 || U > 0.95 || V < 0.06 || V > 0.94) return null;
    const groove = v % 9 < 1.2;
    const g = (c: string) => (groove ? darken(c, 0.18) : c);
    if (kind === 0) {
      // the great wave: a curling crest with foam claws, a low sun
      const s = Math.hypot((U - 0.78) * 1.4, V - 0.78);
      if (s < 0.1) return g('#f6c050');
      const crest = 0.3 + Math.sin(U * 4.2 + 0.4) * 0.22;
      const curl = Math.hypot(U - 0.36, V - 0.62);
      if (curl < 0.2 && curl > 0.12 && U < 0.5) return g((Math.floor(u / 4) + Math.floor(v / 4)) % 3 === 0 ? '#ffffff' : '#e8f4f6');
      if (V < crest) return g(V > crest - 0.05 ? '#e8f4f6' : V > crest - 0.16 ? '#3a7ab4' : '#1e3e74');
      return g(V > 0.7 ? '#f4dcb8' : '#f8e8cc');
    }
    if (kind === 1) {
      // a giant fish swimming through bubbles
      const fx = (U - 0.46) / 0.32;
      const fy = (V - 0.5) / 0.2;
      const body = fx * fx + fy * fy;
      if (body < 1) {
        if (Math.hypot(fx - 0.62, fy - 0.2) < 0.13) return g(Math.hypot(fx - 0.62, fy - 0.2) < 0.07 ? '#1e2a3a' : '#fbf6ec');
        const sc = Math.abs(((fx * 6) % 1) - 0.5) < 0.08 || Math.abs(fy) > 0.85;
        if (Math.abs(fx - 0.25) < 0.05 || Math.abs(fx + 0.15) < 0.05) return g('#e0603e');
        return g(sc ? '#d07a2a' : fy < 0 ? '#f2a83e' : '#f6c060');
      }
      if (fx < -0.9 && fx > -1.5 && Math.abs(fy) < (-0.9 - fx) * 1.4) return g('#e0603e');
      const b = Math.hypot(((U * 9) % 1) - 0.5, ((V * 7 + U * 2) % 1) - 0.5);
      if (b < 0.12 && b > 0.06 && hash(Math.floor(U * 9), Math.floor(V * 7 + U * 2), 3) < 0.3) return g('#e8f6f6');
      return g(V < 0.2 ? '#1e6a74' : '#2a8a8e');
    }
    if (kind === 2) {
      // an octopus on coral pink, curling its arms
      const hx = (U - 0.5) / 0.2;
      const hy = (V - 0.7) / 0.17;
      if (hx * hx + hy * hy < 1) return g(Math.hypot(hx + 0.35, hy - 0.1) < 0.18 || Math.hypot(hx - 0.35, hy - 0.1) < 0.18 ? '#fbf6ec' : hx < -0.3 ? '#9a6ad0' : '#7a4ab0');
      for (let i = 0; i < 6; i++) {
        const ox = 0.24 + i * 0.105;
        const ax = ox + Math.sin(V * 9 + i) * 0.05;
        if (V < 0.58 && V > 0.1 + (i % 2) * 0.08 && Math.abs(U - ax) < 0.03 + (V - 0.1) * 0.03) return g((Math.floor(v / 3) % 3 === 0 && U > ax) ? '#e8c8f0' : '#8a5ac0');
      }
      return g(V < 0.12 ? '#f2d0a0' : '#f4a0a8');
    }
    if (kind === 3) {
      // sunset stripes, a palm silhouette, gulls
      const sun = Math.hypot((U - 0.4) * 1.2, V - 0.45);
      if (Math.abs(U - 0.72 - (V - 0.2) * 0.12) < 0.018 && V < 0.78 && V > 0.12) return g('#2a1a2e');
      const pa = Math.atan2(V - 0.78, U - 0.76);
      if (Math.hypot(U - 0.76, V - 0.78) < 0.16 && Math.abs(Math.sin(pa * 4)) > 0.55) return g('#2a1a2e');
      if (sun < 0.16) return g(V < 0.4 ? '#f2c050' : '#f8dc70');
      if (Math.abs(V - 0.85 + Math.abs(U - 0.22) * 0.8) < 0.01 && Math.abs(U - 0.22) < 0.04) return g('#2a1a2e');
      const bands = ['#5a3a7a', '#a84a7a', '#e0603e', '#f2903e', '#f6c060'];
      return g(V < 0.3 ? (Math.floor(u / 6 + v / 3) % 4 === 0 ? '#8ac8d0' : '#3a7ab0') : bands[Math.max(0, Math.min(4, Math.floor((1 - V) * 6.2)))]);
    }
    if (kind === 4) {
      // Memphis: a big sun, a teal triangle, a navy zigzag, coral squiggles, lilac half-moon, confetti on pink
      const c1 = Math.hypot((U - 0.28) * 1.1, V - 0.62);
      if (c1 < 0.2) return g(c1 > 0.17 ? '#1e2a4a' : '#f6c43a');
      const zig = V - 0.34 - Math.abs(((U * 4) % 1) - 0.5) * 0.3;
      if (Math.abs(zig) < 0.045) return g('#1e2a4a');
      if (zig < -0.045 && zig > -0.09) return g('#f6f2ea');
      if (V > 0.5 && V < 0.9 && U > 0.56 && U < 0.84 && V - 0.5 < (U - 0.56) * 1.4) return g('#2a8a86');
      const hm = Math.hypot((U - 0.78) * 1.2, V - 0.2);
      if (hm < 0.14 && V > 0.2) return g('#9a7ad0');
      if (Math.abs(V - 0.82 - Math.sin(U * 26) * 0.03) < 0.02 && U < 0.5) return g('#e0603e');
      if (Math.abs(V - 0.12 - Math.sin(U * 30 + 1) * 0.025) < 0.018 && U < 0.6) return g('#e0603e');
      const cx = Math.floor(U * 26);
      const cy = Math.floor(V * 18);
      if (hash(cx, cy, 41) < 0.08) return g(['#1e2a4a', '#2a8a86', '#f6c43a'][Math.floor(hash(cx, cy, 42) * 3)]);
      return g((Math.floor(u / 4) + Math.floor(v / 4)) % 6 === 0 ? '#f6c8d4' : '#f8dce2');
    }
    // big hibiscus flowers on deep green
    for (const [cx, cy, s] of [[0.32, 0.6, 0.22], [0.7, 0.38, 0.18], [0.75, 0.8, 0.12]] as const) {
      const dx = (U - cx) / s;
      const dy = (V - cy) / s;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (r < 0.18) return g('#f6e070');
      if (r < 0.75 + Math.cos(a * 5) * 0.25) return g(r < 0.4 ? '#a8203a' : dx < 0 ? '#f06a7a' : '#e0405a');
    }
    return g(hash(Math.floor(u / 5), Math.floor(v / 5), 9) < 0.3 ? '#2e6a3a' : '#245a32');
  };
}

// ── the house ───────────────────────────────────────────────
interface HouseSpec {
  storeys: number;
  roof: 'front' | 'side' | 'flat';
  porch: number;
  tin: boolean;
  /** body inset from the footprint's sides (a) and back (b), pier height, storey height */
  ia: number;
  ib: number;
  P: number;
  SH: number;
}
const SPECS: Record<string, HouseSpec> = {
  cottage: { storeys: 1, roof: 'front', porch: 1.4, tin: true, ia: 0.8, ib: 0.7, P: 5, SH: 31 },
  twin: { storeys: 2, roof: 'side', porch: 1.4, tin: false, ia: 0.5, ib: 0.7, P: 4.5, SH: 29 },
  studio: { storeys: 1, roof: 'front', porch: 0, tin: true, ia: 0.6, ib: 0.7, P: 2, SH: 36 },
  surf: { storeys: 1, roof: 'front', porch: 0, tin: true, ia: 0.6, ib: 0.7, P: 2, SH: 36 },
  cafe: { storeys: 1, roof: 'side', porch: 1.4, tin: true, ia: 0.5, ib: 0.8, P: 4, SH: 33 },
  gallery: { storeys: 2, roof: 'flat', porch: 0, tin: false, ia: 0.3, ib: 0.3, P: 1.5, SH: 30 },
};

/** A point on a roof slope: s from the eave (0) to the ridge (1), t along the eave. */
type SlopeFn = (s: number, t: number) => V3;

/** Skylights, a solar water heater, gulls on the ridge: life on a roof slope. */
function roofLife(p: PropPainter, at3: SlopeFn, ridge: (t: number) => V3, seed: number) {
  const Rn = rng(seed * 7 + 5);
  const c = p.c;
  // one or two skylights: a white frame, dark glass with a reflection
  const n = 1 + (Rn() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const t0 = 0.18 + i * 0.42 + Rn() * 0.1;
    const s0 = 0.25 + Rn() * 0.2;
    const q = [at3(s0, t0), at3(s0, t0 + 0.12), at3(s0 + 0.24, t0 + 0.12), at3(s0 + 0.24, t0)].map((v) => p.P(v[0], v[1], v[2] + 0.4));
    fillPoly(c, q, TRIM[5]);
    const g = [at3(s0 + 0.03, t0 + 0.012), at3(s0 + 0.03, t0 + 0.108), at3(s0 + 0.21, t0 + 0.108), at3(s0 + 0.21, t0 + 0.012)].map((v) => p.P(v[0], v[1], v[2] + 0.5));
    fillPoly(c, g, '#2e4452');
    ln(c, g[0][0], g[0][1], g[2][0], g[2][1], '#8ab4c4');
  }
  // a solar water heater: a panel with a white tank along its top
  if (Rn() < 0.45) {
    const t0 = 0.55 + Rn() * 0.15;
    const q = [at3(0.42, t0), at3(0.42, t0 + 0.22), at3(0.78, t0 + 0.22), at3(0.78, t0)].map((v) => p.P(v[0], v[1], v[2] + 0.8));
    fillPoly(c, q, '#1e2c4a');
    for (let j = 1; j < 4; j++) {
      const a = at3(0.42, t0 + j * 0.055);
      const b = at3(0.78, t0 + j * 0.055);
      const A = p.P(a[0], a[1], a[2] + 0.9);
      const B = p.P(b[0], b[1], b[2] + 0.9);
      ln(c, A[0], A[1], B[0], B[1], '#4a6a9a');
    }
    const ta = at3(0.8, t0);
    const tb = at3(0.8, t0 + 0.22);
    const A = p.P(ta[0], ta[1], ta[2] + 2);
    const B = p.P(tb[0], tb[1], tb[2] + 2);
    ln(c, A[0], A[1], B[0], B[1], '#d8d4cc', 7);
    ln(c, A[0], A[1] - 2, B[0], B[1] - 2, '#f6f2ea', 2);
  }
  // gulls resting on the ridge
  for (let i = 0; i < 3; i++) {
    if (Rn() < 0.55) continue;
    const r = ridge(0.15 + Rn() * 0.7);
    const [x, y] = p.P(r[0], r[1], r[2]);
    layer(c, (l) => {
      px(l, x - 4, y - 7, '#f6f6f2', 8, 5);
      px(l, x - 4, y - 7, '#9aa0aa', 6, 2);
      px(l, x - 6, y - 6, '#1e1e24', 2, 2);
      px(l, x + 3, y - 10, '#f6f6f2', 4, 4);
      px(l, x + 7, y - 9, '#f2c84a', 2, 1);
      px(l, x - 1, y - 2, '#e8a080', 1, 2);
      px(l, x + 1, y - 2, '#e8a080', 1, 2);
    }, { outline: 0.5, rect: [x - 10, y - 14, x + 12, y + 2] });
  }
}

function house(p: PropPainter, k: PropCtx) {
  // houses beyond the default framing are drawn flat (no per-pixel materials)
  const far = (k.variant ?? '').endsWith('-far');
  const v = far ? (k.variant ?? '').slice(0, -4) : k.variant ?? 'cottage';
  const S = SPECS[v] ?? SPECS.cottage;
  const W = k.w;
  const D = k.d;
  const Rn = rng(k.seed * 31 + 7);
  const sidingKeys = Object.keys(SIDING);
  // color 'name' or 'name:roof' (a ROOFC index) picks the siding and, optionally, the roof
  const [colName, roofPick] = (k.color ?? '').split(':');
  const sid = SIDING[colName] ?? SIDING[sidingKeys[pmod(k.seed * 7 + p.x * 3 + p.y, sidingKeys.length)]];
  const trimAccent: Ramp = [TEAL, CORAL, SKY, MUSTARD, PINK][Math.floor(Rn() * 5)];
  // a roof that sets off the siding: red on cool walls, teal or blue on warm ones, grey anywhere
  const pairs: Record<string, number[]> = { mint: [0, 1, 2], coral: [2, 1], lemon: [4, 0, 6], sky: [0, 5, 1], pink: [2, 1], lilac: [2, 0], teal: [0, 5], white: [4, 2, 6], butter: [6, 4, 0] };
  const sidKey = Object.keys(SIDING).find((key) => SIDING[key] === sid) ?? 'white';
  const opts = pairs[sidKey] ?? [0, 1, 2];
  const pick = opts[Math.floor(Rn() * opts.length)];
  const roofR = roofPick ? ROOFC[+roofPick] ?? SHAKE : S.tin ? ROOFC[pick] : SHAKE;
  const P = S.P;
  const SH = S.SH;
  const a0 = S.ia;
  const a1 = W - S.ia;
  const b0 = S.ib;
  const b1 = D - 0.2 - S.porch;
  const ze = P + S.storeys * SH;
  const visA = p.rot === 0 ? a1 : a0;
  const F = front3(p, b1);
  const Sd = side3(p, visA);
  footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 30, 0.43);
  // the lattice skirt on piers, then the weatherboard body
  const lattice: Mat = far ? (light) => () => (light ? '#3a3236' : '#2a2226') : (light) => (u, vv) => {
    const d1 = (u + vv) % 7;
    const d2 = (u - vv + 700) % 7;
    if (d1 < 1.5 || d2 < 1.5) return TRIM[light ? 4 : 2];
    return '#2a2226';
  };
  if (P > 3) {
    // stilts at the corners and between, the lattice skirt set back behind them
    lbox(p, a0 + 0.14, b0 + 0.14, a1 - a0 - 0.28, b1 - b0 - 0.2, 0, P, { front: lattice, side: lattice, top: lattice, edge: '#2a2226' });
    const post: Mat = (light) => (_u, vv) => at(DRIFT, (light ? 4 : 2) + (vv < 3 ? -1.4 : 0));
    for (const a of [a0 + 0.02, (a0 + a1) / 2 - 0.06, a1 - 0.14]) lbox(p, a, b1 - 0.14, 0.12, 0.12, 0, P, { front: post, side: post, top: post, edge: DRIFT[0] });
    for (const b of [b0 + 0.02, (b0 + b1) / 2 - 0.06]) lbox(p, p.rot === 0 ? a1 - 0.14 : a0 + 0.02, b, 0.12, 0.12, 0, P, { front: post, side: post, top: post, edge: DRIFT[0] });
  } else {
    // a low painted plinth
    const plinth: Mat = (light) => (_u, vv, x, y) => at(['#6a6460', '#827c76', '#9a948c', '#b0aaa2', '#c4beb6', '#d6d0c8'], (light === 2 ? 4 : light ? 3.4 : 2) + (vv < 2 ? -1 : 0) + (hash(x, y, 9) < 0.06 ? -0.7 : 0));
    lbox(p, a0 + 0.04, b0 + 0.04, a1 - a0 - 0.08, b1 - b0 - 0.08, 0, P, { front: plinth, side: plinth, top: plinth, edge: '#4a4440' });
  }
  const boards: Mat = far ? (light) => (_u, vv) => at(sid, (light === 2 ? 5 : light ? 4 : 2) + (vv % 9 < 1.2 ? -1.6 : 0)) : clap(sid, 9, 0.45);
  lbox(p, a0, b0, a1 - a0, b1 - b0, P, S.storeys * SH, { front: boards, side: boards, top: boards, edge: darken(sid[0], 0.2) });
  // a mural on the side wall of studios, the surf shop, the gallery and some cottages
  const muralKind = v === 'surf' ? 3 : v === 'gallery' ? 4 : v === 'studio' ? 1 + (k.seed % 2) * 2 : Rn() < 0.4 ? Math.floor(Rn() * 6) : -1;
  if (muralKind >= 0 && !far) {
    const m = mural(muralKind);
    const len = (b1 - b0) * 71.6;
    const hgt = S.storeys * SH * 4;
    pt(p, Sd, b0, b1, P + 1, ze - 1, (u: number, vv: number, x: number, y: number) => {
      // the board order runs from the back of the house to its front on rot 0; mirror for rot 1
      const U = p.rot === 0 ? u / len : 1 - u / len;
      const c = m(U, vv / hgt, u, vv);
      if (!c) return null;
      return hash(x, y, 7) < 0.02 ? darken(c, 0.1) : c;
    }, Sd.light);
  }
  // corner boards and a band between the storeys
  for (const u of [a0, a1 - 0.1]) pq(p, F, u, u + 0.1, P, ze, F.light ? TRIM[5] : TRIM[3]);
  for (const u of [b0, b1 - 0.1]) pq(p, Sd, u, u + 0.1, P, ze, Sd.light ? TRIM[5] : TRIM[3]);
  if (S.storeys > 1) {
    pq(p, F, a0, a1, P + SH - 0.4, P + SH + 0.8, F.light ? TRIM[5] : TRIM[3]);
    pq(p, Sd, b0, b1, P + SH - 0.4, P + SH + 0.8, Sd.light ? TRIM[5] : TRIM[3]);
  }
  const shutters = Rn() < 0.6 ? trimAccent : undefined;
  const curtains = ['#f6eedc', '#f0a6c0', '#f2da74', '#9ad0e8'];
  const blooms = [['#e8402a', '#f06a7a', '#fbf6ec'], ['#f2c84a', '#e0603e'], ['#c070d0', '#f0a6c0', '#fbf6ec']][Math.floor(Rn() * 3)];
  // ── the ground floor front by variant ──
  const fw = a1 - a0;
  const am = (a0 + a1) / 2;
  if (v === 'studio' || v === 'surf') {
    // glazed barn doors on a track and a hand-painted sign board
    const d0 = am - fw * 0.28;
    const d1 = am + fw * 0.28;
    pq(p, F, d0 - 0.1, d1 + 0.1, P, P + 22, darken(sid[1], 0.2));
    for (const [u0, u1] of [[d0, am - 0.02], [am + 0.02, d1]]) {
      pt(p, F, u0, u1, P, P + 21, (u: number, vv: number) => {
        const W2 = (u1 - u0) * 71.6;
        const U = u / W2;
        if (U < 0.08 || U > 0.92 || vv < 3 || vv > 80 || (vv > 38 && vv < 42) || Math.abs(U - 0.5) < 0.04) return at(trimAccent, F.light ? 3.4 : 2);
        return (u + vv) % 26 < 4 ? '#cfe6ee' : v === 'surf' ? '#3a5466' : (Math.floor(u / 9) + Math.floor(vv / 13)) % 4 === 0 ? '#e8c890' : '#3a5466';
      }, F.light);
    }
    beam(p, F, d0 - 0.4, P + 22.6, d1 + 0.4, P + 22.6, 0.4, GEAR);
    // the sign
    const sz = P + 24;
    pq(p, F, am - fw * 0.34, am + fw * 0.34, sz, sz + 3.6, v === 'surf' ? '#1e2a4a' : TRIM[F.light ? 6 : 4]);
    for (let i = 0; i < 6; i++) pq(p, F, am - fw * 0.26 + i * fw * 0.09, am - fw * 0.26 + i * fw * 0.09 + fw * 0.06, sz + 0.9, sz + 2.7, v === 'surf' ? ['#f2c84a', '#7ac7bb', '#f06a7a'][i % 3] : '#2a3a4a');
    if (v === 'surf') {
      // a wave painted under the sign
      for (let i = 0; i < 18; i++) {
        const u = am - fw * 0.34 + (i / 17) * fw * 0.68;
        const z = sz - 0.6 + Math.sin(i * 0.9) * 0.4;
        pq(p, F, u, u + fw * 0.04, z - 0.5, z, '#3a8ab8');
      }
    }
    // side windows
    for (let i = 0; i < Math.max(1, Math.round((b1 - b0) / 2.4)); i++) {
      const c = b0 + (b1 - b0) * ((i + 0.5) / Math.max(1, Math.round((b1 - b0) / 2.4)));
      if (muralKind >= 0 && i !== 0) continue;
      sash(p, Sd, c - 0.36, c + 0.36, P + 9, P + 22, { seed: k.seed + i, curtain: curtains[i % 4] });
    }
  } else if (v === 'gallery') {
    // a shopfront of big panes on the ground floor, windows above, the gallery's sign
    pt(p, F, a0 + 0.3, a1 - 0.3, P + 1.5, P + 22, (u: number, vv: number) => {
      if (u % 72 < 3 || vv < 3 || vv > 79) return GEAR[2];
      if ((u + vv) % 40 < 5) return '#d4eaf0';
      const fx = Math.floor(u / 72);
      if (vv > 22 && vv < 60 && u % 72 > 16 && u % 72 < 52) return ['#e0603e', '#2a8a86', '#f2c84a', '#5a7ac8'][fx % 4];
      return '#f2ede4';
    }, F.light);
    const n = Math.max(2, Math.round(fw / 1.6));
    for (let i = 0; i < n; i++) {
      const c = a0 + fw * ((i + 0.5) / n);
      sash(p, F, c - 0.36, c + 0.36, P + SH + 8, P + SH + 22, { seed: k.seed + i, curtain: curtains[(i + 1) % 4] });
    }
    pq(p, F, am - fw * 0.3, am + fw * 0.3, P + 23, P + 26.4, '#1e2a3a');
    for (let i = 0; i < 7; i++) pq(p, F, am - fw * 0.24 + i * fw * 0.07, am - fw * 0.24 + i * fw * 0.07 + fw * 0.045, P + 23.8, P + 25.6, '#f6f2ea');
  } else {
    // cottages, twins and the café: a door and windows either side
    const n = Math.max(2, Math.round(fw / 1.7));
    const di = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      const c = a0 + fw * ((i + 0.5) / n);
      if (i === di) beachDoor(p, F, c - 0.36, c + 0.36, P, P + 21, trimAccent, k.seed);
      else sash(p, F, c - 0.34, c + 0.34, P + 8, P + 21, { shut: shutters, box: S.porch > 0 ? undefined : blooms, curtain: curtains[(i + k.seed) % 4], seed: k.seed + i, lit: Rn() < 0.2 });
      if (S.storeys > 1) sash(p, F, c - 0.32, c + 0.32, P + SH + 8, P + SH + 21, { shut: shutters, box: blooms, curtain: curtains[(i + 2) % 4], seed: k.seed + i * 3 });
    }
    const ns = Math.max(1, Math.round((b1 - b0) / 2.2));
    for (let i = 0; i < ns; i++) {
      const c = b0 + (b1 - b0) * ((i + 0.5) / ns);
      if (muralKind >= 0) break;
      sash(p, Sd, c - 0.32, c + 0.32, P + 8, P + 21, { shut: shutters, box: blooms, curtain: curtains[i % 4], seed: k.seed + 20 + i });
      if (S.storeys > 1) sash(p, Sd, c - 0.32, c + 0.32, P + SH + 8, P + SH + 21, { shut: shutters, curtain: curtains[(i + 3) % 4], seed: k.seed + 30 + i });
    }
  }
  // ── the roof ──
  const oh = 0.32;
  if (S.roof === 'front') {
    const rise = ((a1 - a0) / 2 + oh) * 11.5;
    const zr = ze + rise;
    // the front gable: weatherboard, a round attic window or a little balcony door, a fish weathervane
    const gpts: V3[] = [[a0, b1, ze], [a1, b1, ze], [am, b1, zr - 1]];
    poly3(p, gpts, boards, F.light, [[a0, b1, ze], [a1, b1, ze], [a0, b1, zr]]);
    const [gx, gy] = F.F(am, ze + rise * 0.42);
    layer(p.c, (l) => {
      ell(l, gx, gy, 9, 9, TRIM[F.light ? 5 : 3]);
      ell(l, gx, gy, 7, 7, '#2e4452');
      ln(l, gx - 7, gy, gx + 7, gy, TRIM[4]);
      ln(l, gx, gy - 7, gx, gy + 7, TRIM[4]);
      px(l, gx - 4, gy - 4, '#c8e2ea', 2, 2);
    }, { outline: 0.5, rect: [gx - 12, gy - 12, gx + 12, gy + 12] });
    const L0: V3 = [a0 - oh, b0 - oh, ze - 1];
    const L1: V3 = [a0 - oh, b1 + oh, ze - 1];
    const R0: V3 = [am, b0 - oh, zr];
    const R1: V3 = [am, b1 + oh, zr];
    const E0: V3 = [a1 + oh, b0 - oh, ze - 1];
    const E1: V3 = [a1 + oh, b1 + oh, ze - 1];
    solidFaces(p, [[L0, L1, R1, R0], [E0, E1, R1, R0]], (s) => roofOf(roofR, S.tin, s, far), false);
    if (!far) {
      // the slope turned to the camera: the right one on rot 0, the left one on rot 1
      const eA = p.rot === 0 ? a1 + oh : a0 - oh;
      roofLife(p, (s2, t) => [eA + (am - eA) * s2, b0 - oh + (b1 - b0 + 2 * oh) * t, ze - 1 + (zr - ze + 1) * s2], (t) => [am, b0 - oh + (b1 - b0 + 2 * oh) * t, zr], k.seed);
    }
    // white bargeboards with a scalloped trim along the front edges, a ridge cap
    const bL = p.P(...L1);
    const bR = p.P(...E1);
    const bT = p.P(...R1);
    ln(p.c, bL[0], bL[1], bT[0], bT[1], TRIM[5], 3);
    ln(p.c, bT[0], bT[1], bR[0], bR[1], TRIM[4], 3);
    for (let i = 1; i < 10; i++) {
      for (const [A, Bp] of [[bL, bT], [bT, bR]] as const) {
        const t = i / 10;
        const x = A[0] + (Bp[0] - A[0]) * t;
        const y = A[1] + (Bp[1] - A[1]) * t;
        px(p.c, x - 1, y + 2, TRIM[3], 3, 2);
      }
    }
    const r0 = p.P(...R0);
    ln(p.c, r0[0], r0[1] - 1, bT[0], bT[1] - 1, darken(roofR[5], 0.05), 2);
    // a flue pipe, sometimes a fish weathervane on the ridge
    const fa = a0 + (a1 - a0) * (0.25 + Rn() * 0.2);
    const fb = b0 + (b1 - b0) * 0.35;
    const fz = ze + rise * (1 - Math.abs(fa - am) / ((a1 - a0) / 2 + oh));
    const [fx, fy] = p.P(fa, fb, fz);
    const [vx0, vy0] = p.P(am, b0 + (b1 - b0) * 0.7, zr);
    layer(p.c, (l) => {
      px(l, fx - 2, fy - 22, ALU[3], 5, 22);
      px(l, fx - 2, fy - 22, ALU[5], 1, 22);
      px(l, fx - 4, fy - 26, ALU[2], 9, 4);
      if (Rn() < 0.6) {
        const [vx, vy] = [vx0, vy0];
        px(l, vx, vy - 16, GEAR[3], 1, 16);
        fillPoly(l, [[vx - 8, vy - 17], [vx + 4, vy - 20], [vx + 8, vy - 17], [vx + 4, vy - 14]], '#3a8a8a');
        fillPoly(l, [[vx + 7, vy - 17], [vx + 11, vy - 20], [vx + 11, vy - 14]], '#3a8a8a');
      }
    }, { outline: 0.55, rect: [Math.min(fx, vx0) - 14, Math.min(fy, vy0) - 30, Math.max(fx, vx0) + 14, Math.max(fy, vy0) + 4] });
  } else if (S.roof === 'side') {
    const bm = (b0 + b1) / 2;
    const rise = ((b1 - b0) / 2 + oh) * 11.5;
    const zr = ze + rise;
    const gpts: V3[] = [[visA, b0, ze], [visA, b1, ze], [visA, bm, zr - 1]];
    poly3(p, gpts, boards, Sd.light, [[visA, b0, ze], [visA, b1, ze], [visA, b0, zr]]);
    const [gx, gy] = Sd.F(bm, ze + rise * 0.4);
    layer(p.c, (l) => {
      px(l, gx - 5, gy - 8, TRIM[4], 10, 13);
      px(l, gx - 4, gy - 7, '#2e4452', 8, 11);
      px(l, gx - 4, gy - 2, TRIM[4], 8, 1);
    }, { outline: 0.5, rect: [gx - 8, gy - 10, gx + 8, gy + 8] });
    const B0: V3 = [a0 - oh, b0 - oh, ze - 1];
    const B1: V3 = [a1 + oh, b0 - oh, ze - 1];
    const R0: V3 = [a0 - oh, bm, zr];
    const R1: V3 = [a1 + oh, bm, zr];
    const F0: V3 = [a0 - oh, b1 + oh, ze - 1];
    const F1: V3 = [a1 + oh, b1 + oh, ze - 1];
    solidFaces(p, [[B0, B1, R1, R0], [F0, F1, R1, R0]], (s) => roofOf(roofR, S.tin, s, far), false);
    if (!far) roofLife(p, (s2, t) => [a0 - oh + (a1 - a0 + 2 * oh) * t, b1 + oh + (bm - b1 - oh) * s2, ze - 1 + (zr - ze + 1) * s2], (t) => [a0 - oh + (a1 - a0 + 2 * oh) * t, bm, zr], k.seed);
    const e0 = p.P(...F0);
    const e1 = p.P(...F1);
    ln(p.c, e0[0], e0[1] + 1, e1[0], e1[1] + 1, TRIM[4], 2);
    const sv = p.rot === 0 ? [[a1 + oh, b1 + oh, ze - 1], [a1 + oh, bm, zr], [a1 + oh, b0 - oh, ze - 1]] : [[a0 - oh, b1 + oh, ze - 1], [a0 - oh, bm, zr], [a0 - oh, b0 - oh, ze - 1]];
    const s0 = p.P(...(sv[0] as V3));
    const s1 = p.P(...(sv[1] as V3));
    const s2 = p.P(...(sv[2] as V3));
    ln(p.c, s0[0], s0[1], s1[0], s1[1], TRIM[5], 3);
    ln(p.c, s1[0], s1[1], s2[0], s2[1], TRIM[4], 3);
    const r0 = p.P(...R0);
    const r1 = p.P(...R1);
    ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, darken(roofR[5], 0.05), 2);
    // a dormer-ish skylight and a flue
    const [fx, fy] = p.P(a0 + (a1 - a0) * 0.7, bm - 0.4, zr - 2);
    layer(p.c, (l) => {
      px(l, fx - 2, fy - 18, ALU[3], 5, 18);
      px(l, fx - 2, fy - 18, ALU[5], 1, 18);
      px(l, fx - 4, fy - 21, ALU[2], 9, 3);
    }, { outline: 0.55, rect: [fx - 6, fy - 24, fx + 6, fy + 2] });
  } else {
    // flat roof: a parapet, a roof terrace with parasols and planters
    const pc: Mat = (light) => () => TRIM[light === 2 ? 5 : light ? 4 : 2];
    lbox(p, a0 - 0.05, b0 - 0.05, a1 - a0 + 0.1, b1 - b0 + 0.1, ze, 0.6, { front: pc, side: pc, top: () => (_u, _vv, x, y) => (hash(x >> 1, y >> 1, 3) < 0.1 ? '#8a8478' : '#a8a294'), edge: '#6a6458' });
    const deckM = weathered(DRIFT);
    lbox(p, a0 + 0.4, b0 + 0.4, (a1 - a0) * 0.6, b1 - b0 - 0.8, ze + 0.6, 0.4, { front: deckM, side: deckM, top: deckM, edge: DRIFT[0] });
    // a glazed roof lantern lighting the gallery below
    const la0 = a0 + (a1 - a0) * 0.68;
    const la1 = a1 - 0.5;
    const lb0 = b0 + 0.7;
    const lb1 = b1 - 0.9;
    const glassM: Mat = (light) => (u, vv) => ((u * 0.8 + vv) % 24 < 3 ? '#d8eef4' : u % 18 < 1.4 ? TRIM[4] : light === 2 ? '#7aa8bc' : light ? '#4e7a90' : '#3a5c70');
    lbox(p, la0, lb0, la1 - la0, lb1 - lb0, ze + 0.6, 4.4, { front: glassM, side: glassM, top: glassM, edge: '#2a3a44' });
    const lam = (la0 + la1) / 2;
    solidFaces(p, [
      [[la0, lb0, ze + 5], [la0, lb1, ze + 5], [lam, lb1, ze + 8.4], [lam, lb0, ze + 8.4]],
      [[la1, lb0, ze + 5], [la1, lb1, ze + 5], [lam, lb1, ze + 8.4], [lam, lb0, ze + 8.4]],
    ], (s2) => (_l: 0 | 1 | 2, w2: number) => (u: number, vv: number) => ((u + vv * 0.7) % 26 < 3 ? '#e8f6fa' : u % Math.max(8, w2 / 6) < 1.2 ? TRIM[4] : s2 > 4 ? '#8ab8cc' : '#5a8aa0'), false);
    const para: Mat = (light) => () => TRIM[light === 2 ? 6 : light ? 5 : 3];
    for (const [u0, u1] of [[a0, a1]] as const) {
      lbox(p, u0, b1 - 0.12, u1 - u0, 0.12, ze + 0.6, 3.4, { front: para, side: para, top: para, edge: TRIM[1] });
    }
    lbox(p, p.rot === 0 ? a1 - 0.12 : a0, b0, 0.12, b1 - b0, ze + 0.6, 3.4, { front: para, side: para, top: para, edge: TRIM[1] });
    const [ux, uy] = p.P(a0 + (a1 - a0) * 0.4, b0 + (b1 - b0) * 0.45, ze + 1);
    layer(p.c, (l) => {
      px(l, ux, uy - 34, GEAR[3], 2, 34);
      for (let i = 0; i < 8; i++) {
        const t0 = (i / 8) * Math.PI * 2;
        const t1 = ((i + 1) / 8) * Math.PI * 2;
        fillPoly(l, [[ux + 1, uy - 40], [ux + 1 + Math.cos(t0) * 30, uy - 30 + Math.sin(t0) * 13], [ux + 1 + Math.cos(t1) * 30, uy - 30 + Math.sin(t1) * 13]], i % 2 ? '#f6eedc' : '#e0603e');
      }
      for (const [fa, fb2] of [[0.75, 0.82], [0.88, 0.5], [0.2, 0.86]] as const) {
        const [qx, qy] = p.P(a0 + (a1 - a0) * fa, b0 + (b1 - b0) * fb2, ze + 1);
        const top = pot(l, qx, qy, 8, 9, 'terrazzo', k.seed);
        foliage(l, [{ x: qx, y: top - 9, rx: 11, ry: 9, z: 1 }], LEAF, k.seed + Math.round(fa * 10), { cell: 3, dots: ['#f06a7a', '#fbf6ec'], dotChance: 0.5, dotSize: 3 });
      }
      // a white water tank on legs and a pair of deckchairs
      const [wx, wy] = p.P(a0 + (a1 - a0) * 0.82, b0 + (b1 - b0) * 0.18, ze + 1);
      for (const dx of [-8, 8]) ln(l, wx + dx, wy, wx + dx * 0.8, wy - 10, GEAR[3], 2);
      for (let j = 0; j < 16; j++) ell(l, wx, wy - 12 - j, 12, 5, j === 15 ? '#fbf8f2' : j > 11 ? '#f0ece4' : '#d8d4cc');
      px(l, wx - 12, wy - 27, '#ffffff', 2, 14);
      for (let i = 0; i < 2; i++) {
        const [cx, cy] = p.P(a0 + (a1 - a0) * (0.32 + i * 0.16), b0 + (b1 - b0) * 0.62, ze + 1);
        ln(l, cx - 6, cy, cx + 2, cy - 12, PINE[3], 2);
        fillPoly(l, [[cx - 5, cy - 3], [cx + 3, cy - 13], [cx + 6, cy - 11], [cx - 2, cy - 1]], i ? '#2a8a86' : '#e0603e');
      }
    }, { outline: 0.6, rect: (() => {
      const cs = [p.P(a0, b0, ze + 12), p.P(a1, b0, ze + 12), p.P(a1, b1, ze), p.P(a0, b1, ze)];
      return [Math.min(...cs.map((q) => q[0])) - 40, Math.min(...cs.map((q) => q[1])) - 50, Math.max(...cs.map((q) => q[0])) + 40, Math.max(...cs.map((q) => q[1])) + 10] as [number, number, number, number];
    })() });
    // festoon bulbs strung over the terrace
    const s0 = p.P(a0 + 0.2, b1 - 0.1, ze + 9);
    const s1 = p.P(a1 - 0.2, b0 + 0.2, ze + 9);
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = s0[0] + (s1[0] - s0[0]) * t;
      const y = s0[1] + (s1[1] - s0[1]) * t + Math.sin(t * Math.PI) * 14;
      px(p.c, x, y, '#3a3036', 1, 1);
      if (i % 2 === 0) px(p.c, x - 1, y + 1, i % 4 ? '#ffe8a0' : '#ffd070', 2, 3);
    }
  }
  // ── the porch: deck on piers, posts, a tin lean-to roof, railing, steps, life ──
  if (S.porch > 0) {
    const pb0 = b1;
    const pb1 = D - 0.12;
    const deck: Mat = far ? (light) => () => DRIFT[light === 2 ? 4 : 3] : weathered(DRIFT);
    lbox(p, a0 + 0.05, pb0, a1 - a0 - 0.1, pb1 - pb0 - 0.4, 0, P, { front: lattice, side: lattice, top: deck, edge: '#2a2226' });
    lbox(p, a0 + 0.05, pb0, a1 - a0 - 0.1, pb1 - pb0 - 0.4, P - 0.5, 0.5, { front: (l) => () => TRIM[l ? 5 : 3], side: (l) => () => TRIM[l ? 5 : 3], top: deck, edge: TRIM[1] });
    // steps down in the middle
    for (let s = 0; s < 3; s++) lbox(p, am - 0.45, pb1 - 0.4 + s * 0.13, 0.9, 0.14, 0, P - 1 - s * 1, { front: deck, side: deck, top: deck, edge: DRIFT[0] });
    // porch life: a bench, a pot of geraniums, a hanging lantern, a surfboard leaning
    const PF = front3(p, pb0 + 0.02);
    const [bx, by] = p.P(a0 + 0.6, pb0 + 0.25, P);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 16, by - 8], [bx + 6, by - 19], [bx + 8, by - 15], [bx - 14, by - 4]], fabric(trimAccent[3])[3]);
      for (let i = 0; i < 3; i++) ln(l, bx - 14 + i * 9, by - 4 - i * 4, bx - 14 + i * 9, by + 3 - i * 4, PINE[2], 2);
      const [qx, qy] = p.P(a1 - 0.5, pb0 + 0.3, P);
      const top = pot(l, qx, qy, 7, 9, 'dip', k.seed);
      foliage(l, [{ x: qx, y: top - 7, rx: 9, ry: 7, z: 1 }], LEAF, k.seed + 6, { cell: 2.6, dots: blooms, dotChance: 0.7, dotSize: 3 });
      if (Rn() < 0.6) {
        const [sx, sy] = p.P(a1 - 1.1, pb0 + 0.1, P);
        const col = ['#f6eedc', '#7ac7bb', '#f2c84a', '#e0603e'][Math.floor(Rn() * 4)];
        for (let j = 0; j < 40; j++) {
          const w = Math.round(Math.sqrt(Math.sin(Math.min(1, (j / 40) * 1.06 + 0.04) * Math.PI)) * 8) + 1;
          px(l, sx - w + j * 0.18, sy - j, col, w * 2, 1);
          px(l, sx - w + j * 0.18, sy - j, lighten(col, 0.3), 1, 1);
        }
      }
    }, { outline: 0.6, rect: (() => {
      const cs = [p.P(a0, pb0, P + 20), p.P(a1, pb0, P + 20), p.P(a1, pb1, P), p.P(a0, pb1, P)];
      return [Math.min(...cs.map((q) => q[0])) - 30, Math.min(...cs.map((q) => q[1])) - 40, Math.max(...cs.map((q) => q[0])) + 30, Math.max(...cs.map((q) => q[1])) + 10] as [number, number, number, number];
    })() });
    void PF;
    // posts and the lean-to roof
    const zt = P + SH - 2;
    const zl = P + SH - 6;
    const posts = Math.max(2, Math.round((a1 - a0) / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const a = a0 + 0.1 + ((a1 - a0 - 0.32) * i) / (posts - 1);
      lbox(p, a, pb1 - 0.55, 0.12, 0.12, P, zl - P, { front: (l) => () => TRIM[l ? 5 : 3], side: (l) => () => TRIM[l ? 4 : 2], top: () => () => TRIM[5], edge: TRIM[1] });
    }
    const roofP: V3[] = [[a0 - 0.1, pb0, zt], [a1 + 0.1, pb0, zt], [a1 + 0.1, pb1 - 0.3, zl], [a0 - 0.1, pb1 - 0.3, zl]];
    poly3(p, roofP, far ? () => roofR[4] : (S.tin ? corrugated(roofR, 0.04) : shakes(SHAKE))(2, 64, 64), 2, [[a0 - 0.1, pb1 - 0.3, zl], [a1 + 0.1, pb1 - 0.3, zl], [a0 - 0.1, pb0, zt]]);
    const PFr = front3(p, pb1 - 0.3);
    pq(p, PFr, a0 - 0.1, a1 + 0.1, zl - 1, zl, TRIM[PFr.light ? 5 : 3]);
    // scalloped valance in the accent colour
    for (let u = a0; u < a1; u += 0.22) {
      const [x, y] = PFr.F(u + 0.11, zl - 1);
      ell(p.c, x, y + 1, 5, 2.5, trimAccent[PFr.light ? 4 : 2]);
    }
    // the railing either side of the steps
    const RF = front3(p, pb1 - 0.48);
    for (let u = a0 + 0.1; u < a1 - 0.1; u += 0.12) {
      if (Math.abs(u - am) < 0.5) continue;
      pq(p, RF, u, u + 0.04, P, P + 3.4, TRIM[RF.light ? 5 : 3]);
    }
    for (const [u0, u1] of [[a0 + 0.1, am - 0.5], [am + 0.5, a1 - 0.1]]) {
      pq(p, RF, u0, u1, P + 3.2, P + 3.8, TRIM[RF.light ? 6 : 4]);
      pq(p, RF, u0, u1, P + 0.3, P + 0.6, TRIM[RF.light ? 4 : 2]);
    }
    if (S.storeys > 1) {
      // the upper veranda: a balcony deck on the porch posts, its railing, a hammock
      const bz = P + SH;
      lbox(p, a0 - 0.05, pb0, a1 - a0 + 0.1, pb1 - pb0 - 0.4, bz - 0.6, 0.6, { front: (l) => () => TRIM[l ? 5 : 3], side: (l) => () => TRIM[l ? 4 : 2], top: deck, edge: TRIM[1] });
      for (let i = 0; i < posts; i++) {
        const a = a0 + 0.1 + ((a1 - a0 - 0.32) * i) / (posts - 1);
        lbox(p, a, pb1 - 0.55, 0.1, 0.1, bz, SH - 3, { front: (l) => () => TRIM[l ? 5 : 3], side: (l) => () => TRIM[l ? 4 : 2], top: () => () => TRIM[5], edge: TRIM[1] });
      }
      const UF = front3(p, pb1 - 0.48);
      for (let u = a0 + 0.05; u < a1 - 0.05; u += 0.12) pq(p, UF, u, u + 0.035, bz, bz + 3.6, TRIM[UF.light ? 5 : 3]);
      pq(p, UF, a0, a1, bz + 3.4, bz + 4, TRIM[UF.light ? 6 : 4]);
      const [h0x, h0y] = UF.F(a0 + 0.6, bz + 10);
      const [h1x, h1y] = UF.F(a0 + 2.0, bz + 10);
      layer(p.c, (l) => {
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const x = h0x + (h1x - h0x) * t;
          const y = h0y + (h1y - h0y) * t + Math.sin(t * Math.PI) * 10;
          px(l, x, y, i % 2 ? '#e0603e' : '#f2c84a', 2, 4);
        }
      }, { outline: 0.5, rect: [Math.min(h0x, h1x) - 4, Math.min(h0y, h1y) - 4, Math.max(h0x, h1x) + 4, Math.max(h0y, h1y) + 18] });
    }
  }
  if (v === 'cafe') {
    // a striped awning over the porch edge and café tables on the boardwalk side
    const PFr = front3(p, D - 0.3);
    for (let u = a0; u < a1; u += 0.3) {
      const q0 = PFr.F(u, P + SH - 7);
      const q1 = PFr.F(u + 0.3, P + SH - 7);
      fillPoly(p.c, [q0, q1, [q1[0], q1[1] + 8], [q0[0], q0[1] + 8]], Math.floor(u / 0.3) % 2 ? '#f6eedc' : '#2a8a86');
    }
  }
  // a climbing bougainvillea up a corner of some houses
  if (Rn() < 0.45) {
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      const ca = p.rot === 0 ? a1 : a0;
      for (let z = 4; z < ze - 4; z += 3.5) {
        const [x, y] = p.P(ca, b1, z);
        masses.push({ x: x + (hash(z, 1, k.seed) - 0.5) * 14, y, rx: 7 + hash(z, 2, k.seed) * 4, ry: 6, z });
      }
      foliage(l, masses, LEAF, k.seed + 9, { cell: 2.8, dots: ['#e0408a', '#f06aa8', '#c02a70'], dotChance: 0.75, dotSize: 3 });
    }, { outline: 0.6, rect: (() => {
      const ca = p.rot === 0 ? a1 : a0;
      const b = p.P(ca, b1, 0);
      const t = p.P(ca, b1, ze);
      return [b[0] - 26, t[1] - 14, b[0] + 26, b[1] + 10] as [number, number, number, number];
    })() });
  }
}

const houseArt: PropArt = {
  draw: house,
  // lit windows on the street front and a lamp on the porch
  lights(k) {
    const v = (k.variant ?? 'cottage').replace(/-far$/, '');
    const S = SPECS[v] ?? SPECS.cottage;
    const a0 = S.ia;
    const a1 = k.w - S.ia;
    const b1 = k.d - 0.2 - S.porch;
    const out: PropLight[] = [];
    const n = Math.max(2, Math.round((a1 - a0) / 1.7));
    for (let st = 0; st < S.storeys; st++)
      for (let i = 0; i < n; i++)
        if (hash(i, st, k.seed + 3) < 0.55) out.push({ a: a0 + (a1 - a0) * ((i + 0.5) / n), b: b1 + 0.05, z: S.P + st * S.SH + 14, r: 0.7, kind: 'window', color: '#ffd68a' });
    if (S.porch > 0) out.push({ a: (a0 + a1) / 2, b: k.d - 0.5, z: S.P + S.SH - 6, r: 1.1, kind: 'lamp', color: '#ffe2a0' });
    return out;
  },
};

// ── bathing huts ────────────────────────────────────────────
const hut: PropArt = {
  draw(p, k) {
    const keys = ['coral', 'mint', 'lemon', 'sky', 'pink', 'lilac', 'teal', 'white', 'butter'];
    const sid = SIDING[k.color ?? keys[pmod(k.seed + p.x, keys.length)]] ?? MINT;
    const stripe = pmod(p.x, 3) !== 1;
    footShadow(p, 0.05, 0.1, 0.95, 0.95, 20, 0.41);
    const a0 = 0.1;
    const a1 = 0.9;
    const b0 = 0.15;
    const b1 = 0.86;
    const P = 1.6;
    const H = 23;
    const deck = weathered(DRIFT);
    lbox(p, a0 - 0.04, b0, a1 - a0 + 0.08, b1 - b0 + 0.1, 0, P, { front: deck, side: deck, top: deck, edge: DRIFT[0] });
    const boards: Mat = (light) => (u, v, x, y) => {
      const b = Math.floor(u / 8);
      const fu = u - b * 8;
      const col = stripe && b % 2 ? SIDING.white : sid;
      let i = (light ? 3.4 : 2) + (hash(b, 1, 61) - 0.5) * 0.5;
      if (fu < 1) i -= 1.6;
      if (v < 3) i -= 0.7;
      if (hash(x, y, 62) < 0.02) i -= 0.6;
      return at(col, i);
    };
    lbox(p, a0, b0, a1 - a0, b1 - b0 - 0.05, P, H, { front: boards, side: boards, top: boards, edge: darken(sid[0], 0.2) });
    const F = front3(p, b1 - 0.05);
    // the door, open on some huts to show towels inside
    const open = hash(Math.round(p.x * 7), 3, k.seed) < 0.35;
    if (open) {
      pq(p, F, 0.28, 0.72, P, P + 15, '#2a2026');
      pq(p, F, 0.3, 0.42, P + 6, P + 12, '#f0a6c0');
      pq(p, F, 0.46, 0.62, P + 4, P + 13, '#7ac7bb');
    } else {
      pq(p, F, 0.28, 0.72, P, P + 15, darken(sid[F.light ? 3 : 2], 0.15));
      pq(p, F, 0.31, 0.69, P + 0.4, P + 14.6, sid[F.light ? 4 : 2]);
      pq(p, F, 0.36, 0.64, P + 10, P + 13, '#f6f2ea');
      pq(p, F, 0.6, 0.64, P + 6.5, P + 7.5, '#7a5a22');
    }
    // the gable roof with white bargeboards and a little star
    const am = 0.5;
    const ze = P + H;
    const zr = ze + 6;
    poly3(p, [[a0, b1 - 0.05, ze], [a1, b1 - 0.05, ze], [am, b1 - 0.05, zr]], boards, F.light, [[a0, b1 - 0.05, ze], [a1, b1 - 0.05, ze], [a0, b1 - 0.05, zr]]);
    const roofR = ROOFC[pmod(p.x + k.seed, 2)];
    solidFaces(p, [[[a0 - 0.1, b0 - 0.1, ze - 0.5], [a0 - 0.1, b1 + 0.08, ze - 0.5], [am, b1 + 0.08, zr], [am, b0 - 0.1, zr]], [[a1 + 0.1, b0 - 0.1, ze - 0.5], [a1 + 0.1, b1 + 0.08, ze - 0.5], [am, b1 + 0.08, zr], [am, b0 - 0.1, zr]]], (s) => roofOf(roofR, true, s), false);
    const l0 = p.P(a0 - 0.1, b1 + 0.08, ze - 0.5);
    const t0 = p.P(am, b1 + 0.08, zr);
    const r0 = p.P(a1 + 0.1, b1 + 0.08, ze - 0.5);
    ln(p.c, l0[0], l0[1], t0[0], t0[1], TRIM[5], 2);
    ln(p.c, t0[0], t0[1], r0[0], r0[1], TRIM[4], 2);
    const [sx, sy] = F.F(am, ze + 2.4);
    px(p.c, sx - 1, sy - 3, '#f2c84a', 3, 3);
    // a deckchair or a bucket and spade by the door
    if (open) {
      const [cx, cy] = p.P(0.75, 0.98, 0);
      layer(p.c, (l) => {
        ln(l, cx - 6, cy, cx + 2, cy - 12, PINE[3], 2);
        ln(l, cx + 4, cy, cx - 4, cy - 10, PINE[2], 2);
        fillPoly(l, [[cx - 5, cy - 3], [cx + 3, cy - 13], [cx + 6, cy - 11], [cx - 2, cy - 1]], '#e0603e');
      }, { outline: 0.55 });
    }
  },
};

// ── the lifeguard hut ───────────────────────────────────────
const lifeguard: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 34, 0.45);
    const c = p.c;
    const pink = SIDING.pink;
    const deckZ = 15;
    const a0 = 0.5;
    const a1 = W - 0.5;
    const b0 = 0.4;
    const b1 = D - 1.1;
    // stilts and cross bracing
    const post: Mat = (l) => (_u, v, x, y) => at(TRIM, (l ? 4 : 2) + (hash(x, y, 4) < 0.05 ? -1 : 0) + (v < 3 ? -1.4 : 0));
    for (const a of [a0 + 0.1, a1 - 0.25]) for (const b of [b0 + 0.1, b1 - 0.25]) lbox(p, a, b, 0.14, 0.14, 0, deckZ, { front: post, side: post, top: post, edge: TRIM[1] });
    layer(c, (l) => {
      for (const b of [b1 - 0.18]) {
        const x0 = p.P(a0 + 0.17, b, 1);
        const x1 = p.P(a1 - 0.18, b, deckZ - 1);
        const x2 = p.P(a1 - 0.18, b, 1);
        const x3 = p.P(a0 + 0.17, b, deckZ - 1);
        ln(l, x0[0], x0[1], x1[0], x1[1], TRIM[3], 2);
        ln(l, x2[0], x2[1], x3[0], x3[1], TRIM[3], 2);
      }
    }, { outline: 0.5 });
    // the deck platform with a railing, the cabin, the curved roof
    const deck = weathered(DRIFT);
    lbox(p, a0 - 0.1, b0 - 0.1, a1 - a0 + 0.2, b1 - b0 + 0.6, deckZ, 0.8, { front: (l) => () => TRIM[l ? 5 : 3], side: (l) => () => TRIM[l ? 4 : 2], top: deck, edge: TRIM[1] });
    const stripes: Mat = (light) => (u, v, x, y) => {
      const band = Math.floor(v / 8) % 2;
      let i = (light ? 3.4 : 2) + (hash(x, y, 5) < 0.03 ? -0.6 : 0);
      if (u % 11 < 1) i -= 1.2;
      return at(band ? pink : SIDING.butter, i);
    };
    lbox(p, a0 + 0.1, b0, a1 - a0 - 0.2, b1 - b0 - 0.2, deckZ + 0.8, 12, { front: stripes, side: stripes, top: stripes, edge: darken(pink[0], 0.2) });
    const F = front3(p, b1 - 0.2);
    const sideA = p.rot === 0 ? a1 - 0.1 : a0 + 0.1;
    const Sd = side3(p, sideA);
    // the big window band with a red cross sign above
    pq(p, F, a0 + 0.3, a1 - 0.3, deckZ + 5.5, deckZ + 10.6, TRIM[F.light ? 5 : 3]);
    pt(p, F, a0 + 0.36, a1 - 0.36, deckZ + 6, deckZ + 10.2, (u: number, v: number) => ((u * 0.9 + v) % 22 < 3 ? '#cfe6ee' : '#2e4a5a'), F.light);
    pq(p, Sd, b0 + 0.25, b1 - 0.45, deckZ + 6, deckZ + 10.2, '#2e4a5a');
    const ra = 0;
    void ra;
    const am = (a0 + a1) / 2;
    const ze = deckZ + 12.8;
    const zr = ze + 5;
    poly3(p, [[a0 + 0.1, b1 - 0.2, ze - 0.2], [a1 - 0.1, b1 - 0.2, ze - 0.2], [am, b1 - 0.2, zr - 0.4]], stripes, F.light, [[a0, b1 - 0.2, ze], [a1, b1 - 0.2, ze], [a0, b1 - 0.2, zr]]);
    solidFaces(p, [
      [[a0 - 0.15, b0 - 0.2, ze], [a0 - 0.15, b1 + 0.05, ze], [am, b1 + 0.05, zr], [am, b0 - 0.2, zr]],
      [[a1 + 0.15, b0 - 0.2, ze], [a1 + 0.15, b1 + 0.05, ze], [am, b1 + 0.05, zr], [am, b0 - 0.2, zr]],
    ], (s) => roofOf(ROOFC[6], true, s), false);
    // white bargeboards along the roof's front edge
    const bl = p.P(a0 - 0.15, b1 + 0.05, ze);
    const bt = p.P(am, b1 + 0.05, zr);
    const br = p.P(a1 + 0.15, b1 + 0.05, ze);
    ln(p.c, bl[0], bl[1], bt[0], bt[1], TRIM[5], 2);
    ln(p.c, bt[0], bt[1], br[0], br[1], TRIM[4], 2);
    const [cx, cy] = F.F(am, ze + 1.6);
    px(c, cx - 4, cy - 1, '#e0402a', 9, 3);
    px(c, cx - 1, cy - 4, '#e0402a', 3, 9);
    // the railing round the deck front, the ramp down to the sand
    const RF = front3(p, b1 + 0.38);
    for (let u = a0 - 0.05; u < a1 + 0.05; u += 0.14) pq(p, RF, u, u + 0.04, deckZ + 0.8, deckZ + 4, TRIM[RF.light ? 5 : 3]);
    pq(p, RF, a0 - 0.1, a1 + 0.1, deckZ + 3.8, deckZ + 4.4, TRIM[RF.light ? 6 : 4]);
    const rampM = weathered(DRIFT, 'v');
    poly3(p, [[am - 0.4, b1 + 0.45, deckZ + 0.8], [am + 0.4, b1 + 0.45, deckZ + 0.8], [am + 0.4, D - 0.05, 0], [am - 0.4, D - 0.05, 0]], rampM(2, 64, 64), 2, [[am - 0.4, D - 0.05, 0], [am + 0.4, D - 0.05, 0], [am - 0.4, b1 + 0.45, deckZ + 0.8]]);
    // flags on a pole, a red rescue board leaning, a lifebuoy on the rail
    const [fx, fy] = p.P(a1 + 0.05, b0 + 0.2, deckZ + 0.8);
    layer(c, (l) => {
      px(l, fx - 1, fy - 64, ALU[4], 2, 64);
      fillPoly(l, [[fx + 1, fy - 64], [fx + 20, fy - 60], [fx + 1, fy - 54]], '#e0402a');
      fillPoly(l, [[fx + 1, fy - 59], [fx + 20, fy - 57], [fx + 1, fy - 54]], '#f2c84a');
      const [bx, by] = p.P(a0 + 0.2, b1 + 0.55, 0);
      for (let j = 0; j < 40; j++) {
        const w = Math.round(Math.sin(Math.min(1, (j / 40) * 1.1 + 0.05) * Math.PI) * 4) + 1;
        px(l, bx - w - j * 0.1, by - j, '#d83a2a', w * 2, 1);
        px(l, bx - w - j * 0.1, by - j, '#f06a50', 1, 1);
      }
      const [lx, ly] = RF.F(am + 0.6, deckZ + 2.6);
      ell(l, lx, ly, 6, 6, '#e8502a');
      ell(l, lx, ly, 3, 3, 'rgba(0,0,0,0)');
      for (let i = 0; i < 4; i++) {
        const t = (i / 4) * Math.PI * 2 + 0.4;
        px(l, lx + Math.cos(t) * 4.5 - 1, ly + Math.sin(t) * 4.5 - 1, '#fbf6ee', 3, 2);
      }
      ell(l, lx, ly, 2, 2, pink[3]);
    }, { outline: 0.6 });
  },
};

// ── a distant roofscape (flat fills; fills the frame's far edges) ──
/** A cheap flowering shrub from flat ellipses: dark core, lit leaves, blossoms. */
function blobBush(l: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, bloom: string[] | null) {
  const Rn = rng(seed);
  ell(l, x + 3, y + 1, r + 3, r * 0.4, 'rgba(42,26,42,0.3)');
  for (let i = 0; i < 6; i++) ell(l, x + (Rn() - 0.5) * r * 1.4, y - r * 0.5 - Rn() * r * 0.6, r * 0.55, r * 0.45, ['#1c4c1c', '#286424'][i % 2]);
  for (let i = 0; i < 7; i++) ell(l, x - r * 0.3 + (Rn() - 0.6) * r * 1.1, y - r * 0.8 - Rn() * r * 0.5, r * 0.32, r * 0.26, ['#4a9836', '#64b042', '#367e2c'][i % 3]);
  for (let i = 0; i < 9; i++) px(l, x - r * 0.4 + (Rn() - 0.6) * r * 1.2, y - r * 0.9 - Rn() * r * 0.6, '#88c858', 2, 1);
  if (bloom) for (let i = 0; i < Math.round(r * 1.6); i++) px(l, x + (Rn() - 0.55) * r * 1.6, y - r * 0.3 - Rn() * r * 1.1, bloom[i % bloom.length], 2, 2);
}

const roofs: PropArt = {
  draw(p, k) {
    const Rn = rng(k.seed * 3 + 11);
    const W = k.w;
    const D = k.d;
    const cols = Object.values(SIDING);
    const accents: Ramp[] = [TEAL, CORAL, SKY, MUSTARD, PINK, ['#f6f2ea', '#f6f2ea', '#e8e4dc', '#ffffff', '#ffffff', '#ffffff', '#ffffff']];
    const BLOOMS = [['#e0408a', '#f291b6', '#c02a70'], ['#f05a3a', '#f8d564'], ['#e0408a', '#fbf6ec'], ['#c15984', '#f291b6']];
    // h < 0 marks a palm, h = 0 a shrub: they join the depth order
    const blocks: [number, number, number, number, number, Ramp, number][] = [];
    for (let a = 0; a < W - 1.5; a += 3.2 + Rn() * 1.6)
      for (let b = 0; b < D - 1.5; b += 3.4 + Rn() * 1.4) {
        const w = Math.min(W - a - 0.2, 2.6 + Rn() * 1.4);
        const d = Math.min(D - b - 0.2, 2.6 + Rn() * 1.4);
        blocks.push([a + 0.2, b + 0.2, w, d, Rn() < 0.3 ? 52 : 30, cols[Math.floor(Rn() * cols.length)], [0, 0, 1, 2, 3, 4, 5, 6][Math.floor(Rn() * 8)]]);
        // a shrub or two in the yard in front of the house, a palm beside it
        for (let j = 0; j < 2; j++) blocks.push([a + 0.3 + Rn() * w, b + d + 0.35 + Rn() * 0.4, 0, 0, 0, cols[0], Math.floor(Rn() * 1000)]);
        if (Rn() < 0.6) blocks.push([a + w + 0.3 + Rn() * 0.4, b + Rn() * d, 0, 0, -(78 + Rn() * 36), cols[0], 0]);
      }
    for (let i = 0; i < Math.round((W * D) / 22); i++) blocks.push([0.6 + Rn() * (W - 1.2), 0.6 + Rn() * (D - 1.2), 0, 0, -(78 + Rn() * 36), cols[0], 0]);
    blocks.sort((m, n) => m[0] + m[2] + m[1] + m[3] - (n[0] + n[2] + n[1] + n[3]));
    for (const [a, b, w, d, h, r, rc] of blocks) {
      if (h === 0) {
        const [x, y] = p.P(a, b, 0);
        layer(p.c, (l) => blobBush(l, x, y, 18 + (rc % 11), rc, rc % 3 === 0 ? null : BLOOMS[rc % 4]), { outline: 0.55, rect: [x - 44, y - 64, x + 44, y + 10] });
        continue;
      }
      if (h < 0) {
        const [x, y] = p.P(a, b, 0);
        const top = -h * 4;
        const lean = (hash(Math.round(a * 10), Math.round(b * 10), 4) - 0.4) * 30;
        layer(p.c, (l) => {
          for (let j = 0; j < top; j++) {
            const cx = x + lean * (j / top) ** 2;
            px(l, cx - 3, y - j, j % 6 < 1 ? '#55402e' : '#87694c', 6, 1);
            px(l, cx - 3, y - j, '#b89872', 2, 1);
            px(l, cx + 2, y - j, '#55402e', 1, 1);
          }
          const tx = x + lean;
          const ty = y - top;
          const seed = Math.round(a * 31 + b * 17);
          const ths = Array.from({ length: 13 }, (_, i) => (i / 13) * Math.PI * 2 + hash(i, seed, 5) * 0.4);
          ths.sort((m, n) => Math.cos(m) + Math.sin(m) - (Math.cos(n) + Math.sin(n)));
          for (const th of ths) frond(l, tx, ty, th, 0.95 + hash(seed, Math.round(th * 9), 6) * 0.3, 1 + hash(seed, Math.round(th * 7), 7) * 0.3, PALMLEAF, seed + Math.round(th * 100));
          ell(l, tx, ty + 1, 5, 4, '#55402e');
          px(l, tx - 4, ty + 3, '#8a6a3a', 3, 3);
          px(l, tx + 1, ty + 4, '#7a8a3a', 3, 3);
        }, { outline: 0.5, rect: [x - 110 - Math.abs(lean), y - top - 70, x + 110 + Math.abs(lean), y + 4] });
        continue;
      }
      const f0 = p.P(a, b + d, 0);
      const f1 = p.P(a + w, b + d, 0);
      const f2 = p.P(a + w, b + d, h);
      const f3 = p.P(a, b + d, h);
      const s1 = p.P(a + w, b, 0);
      const s2 = p.P(a + w, b, h);
      fillPoly(p.c, [f0, f1, f2, f3], r[4]);
      fillPoly(p.c, [f1, s1, s2, f2], r[2]);
      // weatherboard lines on both faces
      for (let z = 4; z < h; z += 2.5) {
        const q0 = p.P(a, b + d, z);
        const q1 = p.P(a + w, b + d, z);
        ln(p.c, q0[0], q0[1], q1[0], q1[1], r[3]);
        const s0 = p.P(a + w, b, z);
        ln(p.c, q1[0], q1[1], s0[0], s0[1], r[1]);
      }
      // white corner boards, the lattice skirt
      ln(p.c, f0[0], f0[1], f3[0], f3[1], CREAM[5], 2);
      ln(p.c, f1[0], f1[1], f2[0], f2[1], CREAM[6], 2);
      fillPoly(p.c, [f0, f1, [f1[0], f1[1] - 12], [f0[0], f0[1] - 12]], '#4a4044');
      for (let i = 0; i < 12; i += 3) ln(p.c, f0[0], f0[1] - i, f1[0], f1[1] - i, '#8a7a72');
      const F = front3(p, b + d);
      const S = side3(p, a + w);
      const acc = accents[Math.floor(Rn() * accents.length)];
      for (let z = 9; z < h - 8; z += 26) {
        let i = 0;
        for (let u = a + 0.4; u < a + w - 0.4; u += 0.9, i++) {
          const door = z === 9 && i === 1;
          const z0 = door ? 3 : z;
          pq(p, F, u - 0.12, u - 0.02, z0, z + 13, acc[4]);
          pq(p, F, u + 0.32, u + 0.42, z0, z + 13, acc[4]);
          pq(p, F, u - 0.04, u + 0.34, z0 - 0.6, z + 13.8, CREAM[6]);
          if (door) {
            pq(p, F, u, u + 0.3, z0, z + 13, acc[2]);
            pq(p, F, u + 0.04, u + 0.26, z + 7, z + 12, '#2a3a48');
          } else {
            const lit = Rn() < 0.2;
            pq(p, F, u, u + 0.3, z, z + 13, lit ? '#f2d48a' : '#2a4050');
            pq(p, F, u, u + 0.3, z + 6, z + 6.6, CREAM[5]);
            pq(p, F, u + 0.02, u + 0.09, z + 8, z + 12, lit ? '#fff0c0' : '#7aa8bc');
            pq(p, F, u - 0.06, u + 0.4, z - 1.6, z - 0.6, CREAM[6]);
            if (Rn() < 0.4) {
              const bl = BLOOMS[Math.floor(Rn() * 4)];
              for (let j = 0; j < 4; j++) pq(p, F, u - 0.04 + j * 0.1, u + 0.04 + j * 0.1, z - 3, z - 1.4, j % 2 ? '#3a7e2c' : bl[j % bl.length]);
            }
          }
        }
        for (let u = b + 0.4; u < b + d - 0.4; u += 0.9) {
          pq(p, S, u - 0.04, u + 0.34, z - 0.6, z + 13.6, CREAM[4]);
          pq(p, S, u, u + 0.3, z, z + 13, '#22384a');
          pq(p, S, u, u + 0.3, z + 6, z + 6.6, CREAM[3]);
        }
      }
      // a dark eave shadow under the roof
      const e0 = p.P(a, b + d, h - 1.5);
      const e1 = p.P(a + w, b + d, h - 1.5);
      ln(p.c, e0[0], e0[1], e1[0], e1[1], darken(r[1], 0.25), 3);
      // a gable roof facing the street: two planes, ribs, a lit ridge and white bargeboards
      const am = a + w / 2;
      const rise = w * 4.6;
      const L0 = p.P(a - 0.2, b - 0.2, h);
      const L1 = p.P(a - 0.2, b + d + 0.2, h);
      const R0 = p.P(am, b - 0.2, h + rise);
      const R1 = p.P(am, b + d + 0.2, h + rise);
      const E0 = p.P(a + w + 0.2, b - 0.2, h);
      const E1 = p.P(a + w + 0.2, b + d + 0.2, h);
      const roofR = ROOFC[rc];
      fillPoly(p.c, [L0, L1, R1, R0], roofR[5]);
      fillPoly(p.c, [E0, E1, R1, R0], roofR[3]);
      const g0 = p.P(a, b + d, h);
      const g1 = p.P(a + w, b + d, h);
      const g2 = p.P(am, b + d, h + rise - 1);
      fillPoly(p.c, [g0, g1, g2], r[5]);
      const [gx, gy] = F.F(am, h + rise * 0.35);
      px(p.c, gx - 3, gy - 4, CREAM[6], 7, 8);
      px(p.c, gx - 2, gy - 3, '#2a4050', 5, 6);
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        ln(p.c, E0[0] + (E1[0] - E0[0]) * t, E0[1] + (E1[1] - E0[1]) * t, R0[0] + (R1[0] - R0[0]) * t, R0[1] + (R1[1] - R0[1]) * t, roofR[1]);
        ln(p.c, L0[0] + (L1[0] - L0[0]) * t, L0[1] + (L1[1] - L0[1]) * t, R0[0] + (R1[0] - R0[0]) * t, R0[1] + (R1[1] - R0[1]) * t, roofR[3]);
      }
      ln(p.c, R0[0], R0[1], R1[0], R1[1], roofR[6], 2);
      ln(p.c, E0[0], E0[1] + 1, E1[0], E1[1] + 1, roofR[0], 2);
      ln(p.c, L1[0], L1[1], R1[0], R1[1], CREAM[6], 2);
      ln(p.c, R1[0], R1[1], E1[0], E1[1], CREAM[4], 2);
      // a solar panel on the lit slope
      if (Rn() < 0.45) {
        const q = [p.P(am - w * 0.12, b + d * 0.25, h + rise * 0.75), p.P(am - w * 0.12, b + d * 0.65, h + rise * 0.75), p.P(a + w * 0.08, b + d * 0.65, h + rise * 0.18), p.P(a + w * 0.08, b + d * 0.25, h + rise * 0.18)];
        fillPoly(p.c, q, '#1e2c4a');
        ln(p.c, q[0][0], q[0][1], q[2][0], q[2][1], '#6a8ac0');
        ln(p.c, q[0][0], q[0][1], q[1][0], q[1][1], CREAM[6], 1);
      }
    }
  },
};

export const STUDIO_HOUSES: Record<string, PropArt> = { std_house: houseArt, std_hut: hut, std_lifeguard: lifeguard, std_roofs: roofs };
export { mural, sash, beachDoor, ROOFC, roofOf, TRIM };

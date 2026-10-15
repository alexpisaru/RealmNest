// Data Center — life on the fjord's shore (1 z ≈ 10 cm).
//   dc_cabin     'stuga': a falu-red cabin with white trims, a roof under a deep quilt of
//                snow, icicles, warm windows, a chimney smoking, a lantern by the door;
//                'sauna': a grey log sauna by the jetty, its stove going
//   dc_jetty     a solid timber jetty out over the ice: piles, bracing, a snowy plank deck,
//                railing, bollards and rope, a ladder, a lifebuoy, a lantern (the boat is in vehicles.ts)
//   dc_woodpile  split birch logs stacked under a little roof
//   dc_decal     flat details baked into the ground: boot prints, fox tracks, ski tracks,
//                parking bays, utility covers, an oil stain
import { mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { boards4, fieldStones4, siding4 } from '../../materials4';
import { front, front3, poly3, pq, pt, side, side3 } from '../../plane4';
import { paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { at, snowTop, unit } from './kit';
import { FALU, ICE, ROCK, SNOW, TRIM, WARM } from './palette';
import { plume, WOODSMOKE } from './plume';
import { driftLine, snowLayer, snowMasses, snowSlab } from './room';

const LOGS: Ramp = ['#2a2420', '#3a322c', '#4c423a', '#5e5248', '#726458', '#887868'];

/** A small cabin window: white frame and cross, warm light, a curtain at each side. */
function cabinWindow(p: PropPainter, pl: ReturnType<typeof front3>, u0: number, u1: number, z0: number, z1: number, seed: number) {
  const light = pl.light;
  pq(p, pl, u0 - 0.06, u1 + 0.06, z0 - 0.7, z1 + 0.7, at(TRIM, light ? 5 : 3));
  pt(p, pl, u0, u1, z0, z1, (u: number, v: number) => {
    if ((u * 0.8 + v) % 26 < 3) return '#fff6d8';
    return at(WARM, 3 + (v / ((z1 - z0) * 4)) * 2.2 - (hash(Math.floor(u / 4), 1, seed) < 0.2 ? 1 : 0));
  }, light);
  const um = (u0 + u1) / 2;
  const zm = (z0 + z1) / 2;
  pq(p, pl, um - 0.025, um + 0.025, z0, z1, at(TRIM, light ? 5 : 3));
  pq(p, pl, u0, u1, zm - 0.25, zm + 0.25, at(TRIM, light ? 5 : 3));
  // the curtains, red-checked
  for (const [a, b] of [[u0, u0 + (u1 - u0) * 0.2], [u1 - (u1 - u0) * 0.2, u1]] as const) pt(p, pl, a, b, z0 + (z1 - z0) * 0.25, z1, (u: number, v: number) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? '#c8443a' : '#e8d8c8'), light);
  // a snow ridge on the sill
  pq(p, pl, u0 - 0.08, u1 + 0.08, z0 - 1.2, z0 - 0.5, SNOW[light ? 6 : 4]);
}

/** A gable roof along a, quilted with snow: the lit front slope, the gable's edge in profile, an overhanging lip, icicles. */
function snowRoof(p: PropPainter, a0: number, a1: number, b0: number, b1: number, ze: number, zr: number, seed: number) {
  const bm = (b0 + b1) / 2;
  // the snow on the slope facing us
  poly3(p, [[a0, b1, ze + 1.2], [a1, b1, ze + 1.2], [a1, bm, zr + 1.4], [a0, bm, zr + 1.4]], (u: number, v: number, x: number, y: number) => {
    let i = 5 + (v / 60) * 0.6;
    if (hash(x, y, 7) < 0.03) i -= 0.8;
    if ((u * 0.25 + v) % 19 < 1) i -= 0.5;
    return at(SNOW, i);
  }, 1);
  // the gable edge in profile: dark barge board, the white quilt on top
  const E = (a: number) => [p.P(a, b1, ze), p.P(a, bm, zr)] as const;
  const [g0, g1] = E(a1);
  ln(p.c, g0[0], g0[1], g1[0], g1[1], '#2a1a14', 2);
  ln(p.c, g0[0], g0[1] - 2, g1[0], g1[1] - 2, TRIM[4], 2);
  for (let i = 0; i < 4; i++) ln(p.c, g0[0] + 1, g0[1] - 4 - i, g1[0] + 1, g1[1] - 4 - i, i === 0 ? SNOW[3] : SNOW[5 + (i === 3 ? 1 : 0)]);
  // the far slope beyond the ridge, its snow seen as a sliver
  const r0 = p.P(a0, bm, zr + 1.4);
  const r1 = p.P(a1, bm, zr + 1.4);
  ln(p.c, r0[0], r0[1] - 1, r1[0], r1[1] - 1, SNOW[6], 2);
  // the overhanging lip of snow along the eave, icicles under it
  const Rn = rng(seed * 7 + 3);
  driftLine(p, a0, a1, b1 + 0.04, ze + 0.6, 5, seed);
  const [x0, y0] = p.P(a0 + 0.1, b1 + 0.05, ze);
  const [x1, y1] = p.P(a1 - 0.1, b1 + 0.05, ze);
  const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 6);
  for (let i = 0; i < n; i++) {
    if (Rn() < 0.4) continue;
    const t = (i + Rn() * 0.5) / n;
    const len = 2 + Math.floor(Rn() * Rn() * 14);
    for (let j = 0; j < len; j++) px(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 3 + j, j < len * 0.4 ? '#f4f8fc' : '#bcd4e6', 1, 1);
  }
}

function stuga(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const a0 = 0.2;
  const a1 = W - 0.2;
  const b0 = 0.3;
  const b1 = D - 0.3;
  const ze = 20;
  const zr = 31;
  footShadow(p, a0, b0, a1, b1 + 0.3, 30, 0.3);
  // a fieldstone foundation, falu-red board-and-batten walls, white corner boards
  lbox(p, a0 - 0.04, b0 - 0.04, a1 - a0 + 0.08, b1 - b0 + 0.08, 0, 1.6, mono(fieldStones4(ROCK, 9, 0), ROCK[0]));
  const wall = boards4(FALU, 9, false);
  lbox(p, a0, b0, a1 - a0, b1 - b0, 1.6, ze - 1.6, { front: wall, side: wall, top: paint(FALU), edge: FALU[0] });
  const F = front3(p, b1);
  const S = side3(p, a1);
  // the gable over the side wall
  poly3(p, [[a1, b0, ze], [a1, b1, ze], [a1, (b0 + b1) / 2, zr]], wall, 0);
  for (const [pl, u] of [[F, a0], [F, a1 - 0.1], [S, b1 - 0.1]] as const) pq(p, pl, u, u + 0.1, 1.6, ze, at(TRIM, pl.light ? 5 : 3));
  // windows and the door; a lantern beside it
  cabinWindow(p, F, a0 + 0.3, a0 + 0.78, 8, 15, k.seed);
  cabinWindow(p, F, a1 - 0.9, a1 - 0.42, 8, 15, k.seed + 1);
  cabinWindow(p, S, (b0 + b1) / 2 - 0.2, (b0 + b1) / 2 + 0.2, 22.5, 27, k.seed + 2);
  const dm = (a0 + a1) / 2 + 0.1;
  pq(p, F, dm - 0.3, dm + 0.3, 1.6, 17.6, at(TRIM, 5));
  pt(p, F, dm - 0.25, dm + 0.25, 1.6, 17, (u: number, v: number) => (u % 9 < 1 ? '#1a2a22' : v > 40 && v < 56 && u > 6 && u < 30 ? '#f8d27a' : '#2e4a3c'), F.light);
  pq(p, F, dm + 0.12, dm + 0.17, 8.4, 9.2, '#d8b86a');
  const [lx, ly] = F.F(dm + 0.45, 14);
  layer(p.c, (l) => {
    px(l, lx - 2, ly - 8, '#1e1e22', 5, 2);
    px(l, lx - 2, ly - 6, '#ffe2a0', 5, 6);
    px(l, lx - 2, ly, '#1e1e22', 5, 1);
  }, { rect: [lx - 4, ly - 10, lx + 5, ly + 3] });
  // the chimney through the snowy roof
  const ca = a0 + (a1 - a0) * 0.7;
  lbox(p, ca, (b0 + b1) / 2 - 0.12, 0.3, 0.3, zr - 6, 12, mono(fieldStones4(ROCK, 6, 0), ROCK[0]));
  snowRoof(p, a0 - 0.22, a1 + 0.22, b0 - 0.25, b1 + 0.25, ze, zr, k.seed);
  lbox(p, ca - 0.04, (b0 + b1) / 2 - 0.16, 0.38, 0.38, zr + 6, 1, mono(snowTop, SNOW[2]));
  // the warm light from the windows on the snow outside
  const [gx, gy] = p.P((a0 + a1) / 2, b1 + 0.7, 0);
  p.c.globalAlpha = 0.14;
  ell(p.c, gx, gy, 80, 22, '#ffd890');
  p.c.globalAlpha = 1;
}

function sauna(p: PropPainter, k: PropCtx) {
  const W = k.w;
  const D = k.d;
  const a0 = 0.25;
  const a1 = W - 0.25;
  const b0 = 0.3;
  const b1 = D - 0.35;
  const ze = 17;
  const zr = 25;
  footShadow(p, a0, b0, a1, b1 + 0.3, 24, 0.3);
  lbox(p, a0 - 0.04, b0 - 0.04, a1 - a0 + 0.08, b1 - b0 + 0.08, 0, 1.4, mono(fieldStones4(ROCK, 8, 0), ROCK[0]));
  // horizontal grey logs with their round ends crossing at the corners
  const logs: Mat = siding4(LOGS, 9);
  lbox(p, a0, b0, a1 - a0, b1 - b0, 1.4, ze - 1.4, { front: logs, side: logs, top: paint(LOGS), edge: LOGS[0] });
  const F = front3(p, b1);
  const S = side3(p, a1);
  poly3(p, [[a1, b0, ze], [a1, b1, ze], [a1, (b0 + b1) / 2, zr]], logs, 0);
  for (let z = 2; z < ze - 1; z += 2.25) {
    const [cx, cy] = p.P(a1 + 0.05, b1 + 0.05, z + 1);
    ell(p.c, cx, cy, 4, 4, LOGS[2]);
    ell(p.c, cx - 1, cy - 1, 3, 3, '#a89070');
    px(p.c, cx - 1, cy - 1, '#7a6450', 2, 2);
  }
  // the door with a little window, a bench by it, the stove's glow in the window
  pt(p, F, a0 + 0.25, a0 + 0.7, 1.4, 15.6, (u: number, v: number) => (u % 8 < 1 ? '#2a2018' : v > 38 && v < 50 && u > 8 && u < 24 ? '#ffb85a' : '#5a4434'), F.light);
  cabinWindow(p, S, (b0 + b1) / 2 - 0.16, (b0 + b1) / 2 + 0.16, 8, 12, k.seed + 3);
  // the stove pipe through the roof
  const ca = a0 + (a1 - a0) * 0.62;
  lbox(p, ca, (b0 + b1) / 2, 0.12, 0.12, zr - 4, 10, mono(paint(['#1a1a1e', '#26262c', '#33333a', '#404048', '#4e4e58', '#5e5e6a']), '#0e0e10'));
  snowRoof(p, a0 - 0.2, a1 + 0.2, b0 - 0.22, b1 + 0.25, ze, zr, k.seed);
  lbox(p, ca - 0.04, (b0 + b1) / 2 - 0.04, 0.2, 0.2, zr + 6, 0.8, mono(paint(['#1a1a1e', '#26262c', '#33333a', '#404048', '#4e4e58', '#5e5e6a']), '#0e0e10'));
}

const dc_cabin: PropArt = {
  draw(p, k) {
    if (k.variant === 'sauna') sauna(p, k);
    else stuga(p, k);
  },
  lights(k) {
    const W = k.w;
    const D = k.d;
    if (k.variant === 'sauna') return [{ a: 0.5, b: D - 0.35, z: 12, r: 1.2, color: '#ffb05a', kind: 'window' }];
    return [
      { a: 0.74, b: D - 0.3, z: 11.5, r: 1.2, color: '#ffd08a', kind: 'window' },
      { a: W - 0.86, b: D - 0.3, z: 11.5, r: 1.2, color: '#ffd08a', kind: 'window' },
      { a: W / 2 + 0.55, b: D - 0.25, z: 13, r: 1.6, color: '#ffd890', kind: 'lamp' },
    ];
  },
  anim(p, k) {
    // wood smoke curling up from the chimney (thicker over the sauna's stove)
    const W = k.w;
    const D = k.d;
    const sauna2 = k.variant === 'sauna';
    const a = sauna2 ? 0.25 + (W - 0.5) * 0.62 + 0.06 : 0.2 + (W - 0.4) * 0.7 + 0.15;
    const z = sauna2 ? 25 + 6.8 : 31 + 7;
    const [x, y] = p.P(a, D / 2 - (sauna2 ? 0.02 : 0.0), z);
    const u = p.k / 4;
    plume(p, x, y, WOODSMOKE, k.t, sauna2 ? 0.09 : 0.07, k.seed, sauna2 ? 0.95 : 0.8);
    // the lantern flickering by the door
    if (!sauna2) {
      const [lx, ly] = p.P((0.2 + W - 0.2) / 2 + 0.55, D - 0.3, 12.5);
      p.c.globalAlpha = 0.18 + Math.sin(k.t * 9 + k.seed) * 0.04;
      ell(p.c, lx, ly, 14 * u, 12 * u, '#ffd890');
      p.c.globalAlpha = 1;
    }
  },
};

const PLANK: Ramp = ['#2a2018', '#3e3024', '#564230', '#6e563e', '#88704e', '#a48a62', '#c0a67a'];
const TAR: Ramp = ['#14100c', '#201a14', '#2e261e', '#3c3228', '#4c4034'];
/**
 * A solid timber jetty from the shore out over the ice (its water end is the visible
 * end): pairs of tarred piles driven through the ice with collars of ice round them,
 * cross bracing, two stringers carrying a deck of planks laid across under a quilt of
 * snow with a trodden path, a railing along the far side, snow-capped bollards with a
 * sagging rope along the near side, a ladder down at the end, a lifebuoy and a lantern.
 */
const dc_jetty: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const water = p.rot === 1; // the water end is at a = 0 for rot 1, a = w for rot 0
    const A = (t: number) => (water ? t : W - t);
    const Z = 5.6;
    const b0 = 0.08;
    const b1 = D - 0.08;
    const tar = mono(paint(TAR), TAR[0]);
    const wood = mono(paint(PLANK), PLANK[0]);
    const piles: number[] = [];
    for (let t = 0.12; t < W - 0.3; t += 0.95) piles.push(t);
    const span = (t0: number, t1: number): [number, number] => [Math.min(A(t0), A(t1)), Math.abs(A(t1) - A(t0))];
    // its shadow on the ice and water, the ice collars round the piles
    layer(p.c, (l) => {
      fillPoly(l, [p.P(A(0), b0 + 0.2, 0), p.P(A(W - 0.4), b0 + 0.2, 0), p.P(A(W - 0.4), b1 + 0.25, 0), p.P(A(0), b1 + 0.25, 0)], '#0a1622');
    }, { alpha: 0.4, outline: false });
    for (const t of piles)
      for (const b of [b0 + 0.06, b1 - 0.06]) {
        const [x, y] = p.P(A(t), b, 0);
        ell(p.c, x + 1, y + 1, 11, 5, ICE[2]);
        ell(p.c, x, y, 9, 4, ICE[5]);
        ell(p.c, x - 1, y - 1, 5, 2, ICE[6]);
      }
    // the far row of piles running up into the railing posts
    for (const t of piles) lbox(p, A(t) - 0.06, b0, 0.12, 0.12, -3, Z + 3 + 9.4, tar);
    // the shore end: a low step of field stones under the deck's end, snow banked against it
    const [sa, sw] = span(W - 0.45, W - 0.02);
    lbox(p, sa, b0 - 0.02, sw, b1 - b0 + 0.04, 0, Z - 1.6, mono(fieldStones4(ROCK, 8, 0.1), ROCK[0]));
    // the stringers and the deck: planks laid across, snow on them
    const [da, dw] = span(0, W - 0.05);
    lbox(p, da, b0 + 0.04, dw, b1 - b0 - 0.08, Z - 1.6, 1.2, mono(paint(TAR), TAR[0]));
    const along = (u: number, v: number) => (p.rot === 1 ? v : u);
    const across = (u: number, v: number) => (p.rot === 1 ? u : v);
    lbox(p, da, b0, dw, b1 - b0, Z - 0.6, 0.6, {
      front: (light) => (u) => at(PLANK, (light ? 4 : 2.6) + (p.rot === 1 ? 0 : u % 9 < 1.4 ? -2 : 0)),
      side: (light) => (u) => at(PLANK, (light ? 4 : 2.6) + (p.rot === 1 && u % 9 < 1.4 ? -2 : 0)),
      top: (_l, w, h) => (u, v, x, y) => {
        const al = along(u, v);
        const ac = across(u, v);
        const L = p.rot === 1 ? h : w;
        const Wd = p.rot === 1 ? w : h;
        const joint = al % 9 < 1.2;
        // the trodden path down the middle: grey wood and boot prints; snow lying elsewhere,
        // thinner at the edges where the plank ends and the gaps show
        const mid = Math.abs(ac - Wd * 0.48) < Wd * 0.17;
        const edge = ac < 4 || ac > Wd - 4;
        if (edge) return joint ? PLANK[1] : at(PLANK, 4 + (hash(Math.floor(al / 9), 3, 7) - 0.5));
        if (mid) {
          const print = al % 13 < 5 && hash(Math.floor(al / 13), Math.floor(ac / 6), 4) < 0.7;
          if (print) return joint ? SNOW[2] : SNOW[3];
          return joint ? SNOW[3] : at(SNOW, 4.6 + (hash(x, y, 5) < 0.06 ? -1 : 0));
        }
        if (joint && hash(Math.floor(al / 9), Math.floor(ac / 5), 9) < 0.35) return SNOW[3];
        return at(SNOW, 5.4 + (hash(x, y, 6) < 0.05 ? -1 : 0) + (al > L - 3 ? -1 : 0));
      },
      edge: PLANK[0],
    });
    // a snow lip along the near edge, icicles under it
    const [e0x, e0y] = p.P(A(0), b1, Z);
    const [e1x, e1y] = p.P(A(W - 0.05), b1, Z);
    ln(p.c, e0x, e0y - 1, e1x, e1y - 1, SNOW[6], 2);
    const Rn = rng(k.seed * 31 + 7);
    for (let i = 0; i < W * 9; i++) {
      const t = Rn() * (W - 0.2);
      const [x, y] = p.P(A(t), b1, Z - 1.6);
      px(p.c, x, y, Rn() < 0.5 ? ICE[6] : ICE[4], 1, 2 + Math.floor(Rn() * 5));
    }
    // the far railing: a top rail and a mid rail between the posts, snow on the top rail
    const [ra, rw] = span(piles[0], piles[piles.length - 1]);
    lbox(p, ra, b0 + 0.02, rw, 0.08, Z + 4.4, 0.7, wood);
    lbox(p, ra, b0 + 0.02, rw, 0.08, Z + 8.8, 0.9, { ...wood, top: () => () => SNOW[6] });
    for (const t of piles) {
      const [x, y] = p.P(A(t), b0 + 0.06, Z + 9.7);
      snowLayer(p.c, [{ x, y: y - 1, rx: 5, ry: 2.4, z: 1 }], k.seed + Math.round(t * 10), 0.3);
    }
    // the near piles: tarred, cut off as bollards above the deck, a snow cap each, the bracing
    const F = front(p, b1 + 0.07);
    for (let i = 0; i < piles.length - 1; i++) {
      const [x0, y0] = F.F(A(piles[i]), 0.6);
      const [x1, y1] = F.F(A(piles[i + 1]), Z - 1.8);
      ln(p.c, x0, y0, x1, y1, TAR[2], 3);
      ln(p.c, x0, y0 - 1, x1, y1 - 1, TAR[4]);
    }
    for (const t of piles) {
      lbox(p, A(t) - 0.06, b1 - 0.12, 0.12, 0.12, -3, Z + 3 + 3.6, tar);
      const [x, y] = p.P(A(t), b1 - 0.06, Z + 3.6);
      snowLayer(p.c, [{ x, y: y - 1, rx: 6, ry: 3, z: 1 }], k.seed + 40 + Math.round(t * 10), 0.3);
    }
    // a mooring rope sagging from bollard to bollard
    for (let i = 0; i < piles.length - 1; i++) {
      const [x0, y0] = p.P(A(piles[i]), b1 - 0.02, Z + 3);
      const [x1, y1] = p.P(A(piles[i + 1]), b1 - 0.02, Z + 3);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2 + 7;
      ln(p.c, x0, y0, mx, my, '#c8b48a');
      ln(p.c, mx, my, x1, y1, '#c8b48a');
    }
    // the ladder down to the water at the end, the lifebuoy on the end post, the lantern post
    const E = side(p, A(0) + (water ? -0.004 : 0.004));
    for (const c of [D / 2 - 0.16, D / 2 + 0.16]) pq(p, E, c - 0.02, c + 0.02, -1, Z + 2.4, '#8a929c');
    for (let z = 0; z < Z; z += 1.6) pq(p, E, D / 2 - 0.16, D / 2 + 0.16, z, z + 0.4, '#6a727c');
    const [bx, by] = p.P(A(piles[0]), b0 + 0.06, Z + 6.4);
    layer(p.c, (l) => {
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        px(l, bx + Math.cos(ang) * 7, by + Math.sin(ang) * 7, Math.floor(i / 6) % 2 ? '#f4f2ee' : '#e8541e', 2, 2);
      }
    }, { outline: 0.5, rect: [bx - 11, by - 11, bx + 11, by + 11] });
    lbox(p, A(0.12) - 0.05, b1 - 0.11, 0.1, 0.1, Z + 3.6, 10, tar);
    driftLine(p, Math.min(A(W - 0.5), A(W + 0.05)), Math.max(A(W - 0.5), A(W + 0.05)), b1 + 0.06, 0, 4, k.seed + 3);
    lbox(p, A(0.12) - 0.08, b1 - 0.14, 0.16, 0.16, Z + 13.6, 2.6, { front: () => () => '#ffd27a', side: () => () => '#e8a848', top: () => () => '#2a2420', edge: '#1a140e' });
    const [lx, ly] = p.P(A(0.12), b1 - 0.06, Z + 16.2);
    px(p.c, lx - 4, ly - 2, '#1a140e', 8, 2);
    snowLayer(p.c, [{ x: lx, y: ly - 3, rx: 5, ry: 2, z: 1 }], k.seed + 77, 0.3);
  },
  lights: (k) => [{ a: 0.12, b: k.d - 0.06, z: 21, r: 1.8, color: '#ffd27a', kind: 'lamp' }],
};

const dc_woodpile: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.25, 0.9, 0.8, 12, 0.26);
    // a stack of split birch, the log ends toward us (pale rings, bark rims), a lean-to roof heaped with snow
    lbox(p, 0.12, 0.3, 0.76, 0.45, 0, 0.6, mono(paint(LOGS), LOGS[0]));
    const F = front3(p, 0.75);
    pq(p, F, 0.12, 0.88, 0.6, 9.4, '#3a2a1e');
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++) {
        const [x, y] = F.F(0.17 + c * 0.11 + (r % 2) * 0.05, 1.4 + r * 1.4);
        ell(p.c, x, y, 3.6, 3, '#e8e2d2');
        ell(p.c, x - 0.5, y, 2.4, 2, '#d8c49a');
        px(p.c, x - 1, y - 1, '#b89a6a', 2, 1);
        ell(p.c, x + 2, y + 1, 1, 1, '#5a4a3a');
      }
    for (const a of [0.12, 0.84]) for (const b of [0.3, 0.72]) lbox(p, a, b, 0.05, 0.05, 0, b < 0.5 ? 11.6 : 10.2, mono(paint(LOGS), LOGS[0]));
    // the lean-to roof: weathered boards falling toward the front, a slab of snow on them
    const P = (a: number, b: number, z: number) => p.P(a, b, z);
    fillPoly(p.c, [P(0.06, 0.24, 11.8), P(0.94, 0.24, 11.8), P(0.94, 0.86, 10), P(0.06, 0.86, 10)], LOGS[3]);
    fillPoly(p.c, [P(0.06, 0.86, 10), P(0.94, 0.86, 10), P(0.94, 0.86, 9.4), P(0.06, 0.86, 9.4)], LOGS[1]);
    snowSlab(p, 0.06, 0.24, 0.94, 0.86, 10.6, k.seed, 1.2);
    void k;
  },
};

// ── out on the ice: a fishing tent, and a snowman by the cabins ──
const dc_icehut: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.45);
    contactShadow(p.c, x + 14, y + 4, 30, 9, 0.24);
    layer(p.c, (l) => {
      // a pop-up hub tent in red: four quilted panels, the lit one toward us, the door flap rolled up
      const H = 72;
      const W2 = 44;
      fillPoly(l, [[x - W2, y - 2], [x, y + 9], [x, y - H + 6], [x - W2 + 4, y - H + 14]], '#c8382a');
      fillPoly(l, [[x, y + 9], [x + W2, y - 2], [x + W2 - 4, y - H + 14], [x, y - H + 6]], '#8a2018');
      fillPoly(l, [[x - W2 + 4, y - H + 14], [x, y - H + 6], [x + W2 - 4, y - H + 14], [x, y - H + 2]], '#e05844');
      // the quilting seams and the guy lines, the doorway into the dark
      for (let i = 1; i < 4; i++) ln(l, x - W2 + i * 7, y - 2 + i * 2.7, x - W2 + 4 + i * 6, y - H + 14 - i * 2, '#a62c26');
      fillPoly(l, [[x - 26, y + 3], [x - 6, y + 10], [x - 7, y - 36], [x - 24, y - 38]], '#2a1410');
      px(l, x - 28, y - 42, '#f2c230', 24, 4);
      px(l, x - 22, y - 8, '#4a2a20', 8, 10);
      ln(l, x + W2 - 2, y - 14, x + W2 + 14, y + 2, '#d8dce0');
      ln(l, x - W2 + 2, y - 14, x - W2 - 12, y + 4, '#d8dce0');
      px(l, x - 4, y - H + 1, SNOW[6], 10, 3);
      // a plastic sled with a box of gear, and the auger standing in the snow
      fillPoly(l, [[x + 22, y + 10], [x + 40, y + 2], [x + 46, y + 6], [x + 28, y + 14]], '#2a62b0');
      px(l, x + 30, y + 2, '#f4f2ee', 8, 6);
      ln(l, x + 18, y - 4, x + 20, y - 34, '#9aa0a8', 2);
      ln(l, x + 14, y - 30, x + 26, y - 34, '#2a2e34', 2);
    }, { outline: 0.5, rect: [x - 62, y - 82, x + 64, y + 22] });
    void k;
  },
};

const dc_snowman: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 10, y + 3, 18, 6, 0.24);
    const m = [
      { x, y: y - 10, rx: 15, ry: 12, z: 0 },
      { x: x + 1, y: y - 30, rx: 11, ry: 10, z: 1 },
      { x: x + 1, y: y - 45, rx: 8, ry: 8, z: 2 },
    ];
    layer(p.c, (l) => {
      snowMasses(l, m, k.seed);
      // coal eyes and buttons, a carrot nose, stick arms, a red knitted hat and scarf
      px(l, x - 3, y - 48, '#1a1418', 2, 2);
      px(l, x + 3, y - 48, '#1a1418', 2, 2);
      px(l, x + 1, y - 45, '#ee7a2a', 6, 2);
      for (const yy of [-34, -28, -22]) px(l, x, y + yy, '#1a1418', 2, 2);
      ln(l, x - 9, y - 32, x - 22, y - 42, '#5a3e2a');
      ln(l, x - 18, y - 39, x - 20, y - 46, '#5a3e2a');
      ln(l, x + 11, y - 32, x + 24, y - 38, '#5a3e2a');
      px(l, x - 7, y - 39, '#c8382a', 16, 3);
      px(l, x + 5, y - 38, '#c8382a', 3, 8);
      fillPoly(l, [[x - 7, y - 52], [x + 9, y - 52], [x + 6, y - 60], [x - 4, y - 60]], '#c8382a');
      px(l, x - 7, y - 53, '#f4f2ee', 16, 2);
      ell(l, x + 1, y - 62, 3, 3, '#f4f2ee');
    }, { outline: 0.5, rect: [x - 28, y - 68, x + 28, y + 4] });
  },
};

// ── flat details in the snow and on the yards ───────────────
const dc_decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'steps';
    const c = p.c;
    const Rn = rng(k.seed * 31 + 7);
    const print = (x: number, y: number, w: number, h: number) => {
      // a dent in the snow: blue in its hollow, a lit rim on its lower edge
      ell(c, x, y, w, h, SNOW[2]);
      ell(c, x, y - 0.5, w * 0.8, h * 0.6, SNOW[1]);
      px(c, x - w * 0.6, y + h - 0.5, SNOW[6], Math.max(1, w * 1.2), 1);
    };
    if (v === 'steps' || v === 'fox') {
      // a trail wandering across a few tiles: boot prints in pairs, or a fox's single file
      let a = 0.2;
      let b = 0.3;
      let dir = Rn() * Math.PI * 2;
      const fox = v === 'fox';
      for (let i = 0; i < (fox ? 40 : 26); i++) {
        dir += (Rn() - 0.5) * 0.35;
        a += Math.cos(dir) * (fox ? 0.09 : 0.14);
        b += Math.sin(dir) * (fox ? 0.09 : 0.14);
        const off = (i % 2 ? 1 : -1) * (fox ? 0.01 : 0.05);
        const [x, y] = p.P(a - Math.sin(dir) * off, b + Math.cos(dir) * off);
        if (fox) print(x, y, 1.5, 1);
        else print(x, y, 3, 1.5);
      }
    } else if (v === 'ski') {
      // two grooves running straight-ish, pole dents either side
      let a = 0;
      let b = 0.3;
      const dir = 0.35 + Rn() * 0.4;
      for (let i = 0; i < 90; i++) {
        a += Math.cos(dir) * 0.05;
        b += Math.sin(dir) * 0.05 + Math.sin(i * 0.12) * 0.004;
        for (const off of [-0.08, 0.08]) {
          const [x, y] = p.P(a - Math.sin(dir) * off, b + Math.cos(dir) * off);
          px(c, x, y, SNOW[2], 2, 1);
          px(c, x, y + 1, SNOW[6], 2, 1);
        }
        if (i % 9 === 0) for (const off of [-0.22, 0.22]) {
          const [x, y] = p.P(a - Math.sin(dir) * off, b + Math.cos(dir) * off);
          print(x, y, 1, 1);
        }
      }
    } else if (v === 'bay') {
      // parking bay lines: yellow paint showing through the packed snow
      for (const a of [0.05, 1.95]) {
        const [x0, y0] = p.P(a, 0.1);
        const [x1, y1] = p.P(a, 0.95);
        const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i < n; i++) if (hash(i, Math.round(a * 10), k.seed) < 0.75) px(c, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, '#d8b438', 2, 1);
      }
    } else if (v === 'cover') {
      // a cleared cast-iron utility cover with its grid, a ring of wet asphalt round it
      const [x, y] = anchor(p);
      ell(c, x, y, 24, 12, '#5a6068');
      ell(c, x, y, 18, 9, '#2a2e34');
      ell(c, x, y, 16, 8, '#3a3e46');
      for (let i = -12; i <= 12; i += 4) ln(c, x + i, y - 6, x + i, y + 6, '#4a5058');
      ell(c, x - 3, y - 2, 6, 2, '#5a6068');
    } else if (v === 'hole') {
      // fishing holes drilled in the ice: dark water in a ring of slush and the ice chips around
      const Rn2 = rng(k.seed * 7 + 2);
      for (let i = 0; i < 3; i++) {
        const [x, y] = p.P(0.2 + Rn2() * 0.6, 0.2 + Rn2() * 0.6);
        ell(c, x, y, 7, 3.5, '#c8dce8');
        ell(c, x, y, 5, 2.5, '#16283a');
        px(c, x - 3, y - 1, '#3a5a78', 3, 1);
        for (let j = 0; j < 5; j++) px(c, x - 8 + Rn2() * 16, y - 4 + Rn2() * 8, '#eef4f8', 2, 1);
      }
    } else if (v === 'track') {
      // a snowmobile's track: a wide ribbed band with two ski grooves beside it, running along the prop
      const n = 120;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const a = t * p.pw;
        const wob = Math.sin(t * 5 + k.seed) * 0.08;
        const [x, y] = p.P(a, 0.5 + wob);
        px(c, x - 4, y - 2, i % 3 === 0 ? SNOW[2] : SNOW[3], 8, 4);
        for (const off of [-0.28, 0.28]) {
          const [sx, sy] = p.P(a, 0.5 + wob + off);
          px(c, sx, sy, SNOW[2], 2, 1);
          px(c, sx, sy + 1, SNOW[6], 2, 1);
        }
      }
    } else if (v === 'oil') {
      const [x, y] = anchor(p);
      ell(c, x, y, 26, 11, 'rgba(30,26,34,0.35)');
      ell(c, x - 6, y - 1, 12, 5, 'rgba(60,70,110,0.3)');
    }
    void mix;
  },
};

export const DC_SHORE: Record<string, PropArt> = { dc_cabin, dc_jetty, dc_woodpile, dc_icehut, dc_snowman, dc_decal };
void contactShadow;
void fillPoly;
void unit;

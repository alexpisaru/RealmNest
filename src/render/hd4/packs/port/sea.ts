// Logistics Port — the water side. The sea lies QD z-units below the quay, so
// hulls float with their waterline at z = −QD (moored boats sit at the foot of
// the wall).
//   prt_trawler   fishing boats moored at the quay (variants by seed: hull
//                 colour, gear, nets) · prt_ferry  the red-and-white harbour
//                 car ferry · prt_tug  a tug with its tyre fenders · prt_sail
//                 a yacht under sail · prt_dinghy  a skiff · prt_launch  motor
//                 launches in the marina (cuddy cruiser, open launch, workboat)
//   prt_buoy      channel buoys (red, green) with lights · prt_pontoon  a
//                 floating timber pontoon with finger piers
//   prt_lighthouse  the red-and-white lighthouse at the breakwater head
//   prt_tetrapods   concrete armour units at the breakwater's seaward foot
//   prt_parapet   the breakwater's wave wall · prt_coaster  a small cargo ship
//                 under way off the breakwater, her wake and bow wave
//   prt_cliff · prt_cottage · prt_pine · prt_bush   the far headland
import { darken, lighten } from '../../../color';
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import type { Mat } from '../../../hd/kit';
import { at, bayer, contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, pt, side } from '../../plane4';
import { anchor, lbox, mono } from '../util';
import { coil, deckFill, gullStand, netHeap, planks, plate, rope, shadowBand, stencil } from './kit';
import { QD } from './layout';
import { BOX_COLOURS, P, ROPE, RUBBER, TIMBERW } from './palette';
import { drawBox, glass } from './quay';

const ZW = -QD;

/** The visible end plane of a box spanning a0 … a1 (rot 0 shows a1, rot 1 shows a0). */
const endAt = (p: PropPainter, a0: number, a1: number) => (p.rot === 0 ? a1 : a0);

/**
 * A hull along local a (a0 … a1), centred on b = bm with half-beam hb, waterline z = zw,
 * deck edge zd. beam(t) gives the half-beam fraction from the stern (t = 0) to the bow
 * (t = 1); the bow points away from the visible end. Draws the starboard facets, a sheer
 * strake, the boot-top, the visible end (transom) and the deck; returns the deck outline.
 */
function hull(p: PropPainter, a0: number, a1: number, bm: number, hb: number, zw: number, zd: number, R: Ramp, o: { beam: (t: number) => number; strake?: string; boot?: string; deck?: Ramp; name?: string; rail?: boolean }) {
  const c = p.c;
  const N = 30;
  const sternAtA1 = p.rot === 0;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + (a1 - a0) * t;
    const ts = sternAtA1 ? 1 - t : t; // 0 at the stern
    pts.push([a, o.beam(ts) * hb]);
  }
  // (second pass) the hull's reflection: its colour mirrored under the waterline in broken wobbly
  // rows, darker away from the hull; and the keel's shadow in the water toward the lower right
  layer(c, (l) => {
    for (let i = 0; i < N; i++) {
      const A = p.P(pts[i][0], bm + pts[i][1] * 0.9, zw);
      const B = p.P(pts[i + 1][0], bm + pts[i + 1][1] * 0.9, zw);
      const depth = Math.round((zd - zw) * 4 * 0.8);
      for (let r = 2; r < depth; r += 2) {
        if (hash(i, r, 77) < 0.25) continue;
        const wob = ((r >> 1) & 1) * 2 - 1;
        ln(l, A[0] + wob, A[1] + r, B[0] + wob, B[1] + r, r < depth * 0.5 ? darken(R[2], 0.35) : '#0a2c48', 1);
      }
    }
    const sh = pts.map(([a, h]) => p.P(a + 0.12, bm + h * 0.9 + 0.12, zw));
    for (let i = 0; i < N; i++) ln(l, sh[i][0], sh[i][1] + 1, sh[i + 1][0], sh[i + 1][1] + 1, '#05213a', 4);
  }, { outline: false, alpha: 0.75 });
  // the water at the hull: a dark shadow band, a little foam
  layer(c, (l) => {
    for (let i = 0; i < N; i++) {
      const A = p.P(pts[i][0], bm + pts[i][1] * 0.92 + 0.05, zw);
      const B = p.P(pts[i + 1][0], bm + pts[i + 1][1] * 0.92 + 0.05, zw);
      ln(l, A[0] + 1, A[1] + 2, B[0] + 1, B[1] + 2, '#0a2a44', 3);
      if (i % 3 === 1) px(l, A[0], A[1] + 4, '#b8dcec', 4, 1);
    }
  }, { outline: false });
  for (let i = 0; i < N; i++) {
    const [aA, hA] = pts[i];
    const [aB, hB] = pts[i + 1];
    const nx = -(hB - hA);
    const ny = aB - aA;
    // the world normal: rot 0 maps local (a, b) to (x, y); rot 1 maps b → +x, a → −y
    const wn = p.rot === 0 ? [nx, ny] : [ny, -nx];
    const lit = (-0.5 * wn[0] + wn[1]) / Math.hypot(nx, ny);
    const tone = 2.3 + lit * 2.2;
    const q = [p.P(aA, bm + hA, zd), p.P(aB, bm + hB, zd), p.P(aB, bm + hB * 0.9, zw), p.P(aA, bm + hA * 0.9, zw)];
    fillPoly(c, q, at(R, tone));
    if (o.strake) {
      const s0 = p.P(aA, bm + hA, zd);
      const s1 = p.P(aB, bm + hB, zd);
      fillPoly(c, [s0, s1, [s1[0], s1[1] + 3], [s0[0], s0[1] + 3]], lit > 0 ? o.strake : darken(o.strake, 0.25));
    }
    if (o.boot) {
      const w0 = p.P(aA, bm + hA * 0.9, zw);
      const w1 = p.P(aB, bm + hB * 0.9, zw);
      fillPoly(c, [[w0[0], w0[1] - 3], [w1[0], w1[1] - 3], w1, w0], lit > 0 ? o.boot : darken(o.boot, 0.25));
    }
  }
  // the transom on the visible end
  const ea = endAt(p, a0, a1);
  const he = (sternAtA1 ? pts[N] : pts[0])[1];
  const tr = [p.P(ea, bm - he, zd), p.P(ea, bm + he, zd), p.P(ea, bm + he * 0.9, zw), p.P(ea, bm - he * 0.9, zw)];
  fillPoly(c, tr, R[1]);
  if (o.strake) fillPoly(c, [tr[0], tr[1], [tr[1][0], tr[1][1] + 3], [tr[0][0], tr[0][1] + 3]], darken(o.strake, 0.3));
  if (o.name) stencil(p, side(p, ea), bm + he * 0.6, zd - 2, o.name, '#f2f0ea');
  // the deck and the bulwark rail round it
  deckFill(p, pts, bm, zd - 0.6, o.deck ?? TIMBERW);
  const far = pts.map(([a, h]) => p.P(a, bm - h * 0.95, zd + 1.4));
  for (let i = 0; i < N; i++) ln(c, far[i][0], far[i][1], far[i + 1][0], far[i + 1][1], lighten(R[3], 0.2), 2);
  const near = pts.map(([a, h]) => p.P(a, bm + h, zd + 1.4));
  const nearB = pts.map(([a, h]) => p.P(a, bm + h, zd));
  for (let i = 0; i < N; i++) fillPoly(c, [near[i], near[i + 1], nearB[i + 1], nearB[i]], o.strake ?? R[4]);
  for (let i = 0; i < N; i++) ln(c, near[i][0], near[i][1] - 1, near[i + 1][0], near[i + 1][1] - 1, R[2], 1);
  // (second pass) guard rails: stanchions along both sides with a bright top rail
  if (o.rail !== false && hb >= 0.3) {
    const RH = 6;
    const topN = pts.map(([a, h]) => p.P(a, bm + h * 0.97, zd + 1.4 + RH));
    const topF = pts.map(([a, h]) => p.P(a, bm - h * 0.92, zd + 1.4 + RH));
    for (let i = 2; i < N - 1; i++) {
      if (pts[i][1] < hb * 0.35) continue;
      ln(c, topF[i][0], topF[i][1], topF[i + 1][0], topF[i + 1][1], '#c8ccd0');
      if (i % 3 === 0) ln(c, far[i][0], far[i][1], topF[i][0], topF[i][1], '#9aa0a6');
    }
    for (let i = 2; i < N - 1; i++) {
      if (pts[i][1] < hb * 0.35) continue;
      if (i % 3 === 0) ln(c, near[i][0], near[i][1], topN[i][0], topN[i][1], '#d8dce0');
      ln(c, topN[i][0], topN[i][1], topN[i + 1][0], topN[i + 1][1], '#f4f6f8');
      ln(c, topN[i][0], topN[i][1] + 1, topN[i + 1][0], topN[i + 1][1] + 1, '#8a9096');
    }
  }
  return pts;
}

const boatBeam = (t: number) => (t < 0.08 ? 0.88 + t * 1.5 : t > 0.62 ? Math.sqrt(Math.max(0, 1 - ((t - 0.62) / 0.38) ** 2)) : 1);

// ── fishing boats at the quay ────────────────────────────────
const HULLC: Ramp[] = [
  ['#0e2458', '#14317a', '#1c449c', '#2556bc', '#3069d6', '#4a82e6', '#6e9ef0'],
  ['#0e3a20', '#145030', '#1c663c', '#257c4a', '#30925a', '#48a86e', '#68bc86'],
  ['#4a0c10', '#6a1218', '#8e1a1e', '#b02424', '#c83430', '#dc4c44', '#ec6a5c'],
  ['#5a6064', '#747a7e', '#8e9498', '#a8aeb0', '#c2c6c6', '#d8dada', '#ecedec'],
  ['#0a3634', '#0f4a48', '#156260', '#1c7a76', '#26928c', '#3eaaa2', '#62c2b8'],
];

const trawler: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const R = HULLC[k.seed % HULLC.length];
    const Rn = rng(k.seed * 29 + 3);
    const bm = D / 2 + 0.05;
    const hb = D / 2 - 0.22;
    const a0 = 0.15;
    const a1 = W - 0.15;
    const zd = ZW + 9.5 + (k.seed % 2) * 1.5;
    const names = ['GESINE', 'ANNA', 'KAI 7', 'MOEWE', 'ELBE 3', 'HOFFNUNG', 'FRIEDA', 'NORD 12'];
    const strake = k.seed % HULLC.length === 3 ? '#2c4a80' : '#ece8de';
    hull(p, a0, a1, bm, hb, ZW, zd, R, { beam: boatBeam, strake, boot: '#a8322a', name: names[k.seed % names.length] });
    const zdk = zd - 0.6;
    // the wheelhouse: aft of midships, white, windows, a mast with lights, a radar
    const sternAtA1 = p.rot === 0;
    const wa = sternAtA1 ? a0 + (a1 - a0) * 0.5 : a0 + (a1 - a0) * 0.22;
    const ww = (a1 - a0) * 0.24;
    const wd = hb * 1.1;
    const whit = plate(P.white);
    lbox(p, wa, bm - wd / 2, ww, wd, zdk, 21, { front: whit, side: whit, top: plate(['#5a5e64', '#6a6e74', '#7c8086', '#8e9296', '#a2a6aa', '#b6babc']), edge: P.white[0] });
    const WF = front(p, bm + wd / 2);
    pt(p, WF, wa + 0.06, wa + ww - 0.06, zdk + 12, zdk + 18, glass, WF.light);
    const ea = endAt(p, wa, wa + ww);
    pt(p, side(p, ea), bm - wd / 2 + 0.06, bm + wd / 2 - 0.06, zdk + 12, zdk + 18, glass);
    pq(p, side(p, ea), bm + wd * 0.1, bm + wd * 0.38, zdk, zdk + 10.5, '#d0ccc2');
    lbox(p, wa - 0.05, bm - wd / 2 - 0.05, ww + 0.1, wd + 0.1, zdk + 21, 0.6, mono(plate(R), R[0]));
    const [mx, my] = anchor(p, wa + ww / 2, bm, zdk + 21.6);
    const mh = 40 + (k.seed % 3) * 8;
    layer(c, (l) => {
      px(l, mx - 1, my - mh, '#d8dcdc', 2, mh);
      px(l, mx - 1, my - mh, '#f4f6f6', 1, mh);
      px(l, mx - 8, my - mh + 14, '#d8dcdc', 16, 2);
      ln(l, mx - 7, my - mh + 26, mx + 7, my - mh + 28, '#e8eaec', 2);
      px(l, mx - 2, my - mh - 4, '#f4f0e6', 3, 4);
      px(l, mx + 7, my - mh + 13, '#3ac85a', 2, 2);
      px(l, mx - 9, my - mh + 13, '#d8402a', 2, 2);
      fillPoly(l, [[mx + 1, my - mh], [mx + 11, my - mh + 3], [mx + 1, my - mh + 6]], ['#d8402a', '#2c5aa0', '#f2c43a'][k.seed % 3]);
    }, { rect: [mx - 12, my - mh - 6, mx + 14, my + 2] });
    // gear: trawl booms raised (some), a net drum and a gantry aft, fish boxes, a coil
    const aft = sternAtA1 ? a1 - 0.35 : a0 + 0.35;
    if (k.seed % 3 !== 2) {
      const g0 = p.P(aft, bm - hb * 0.7, zdk);
      const g1 = p.P(aft, bm + hb * 0.7, zdk);
      const g2 = p.P(aft, bm - hb * 0.7, zdk + 24);
      const g3 = p.P(aft, bm + hb * 0.7, zdk + 24);
      ln(c, g0[0], g0[1], g2[0], g2[1], '#e8b42a', 2);
      ln(c, g1[0], g1[1], g3[0], g3[1], '#c8941c', 2);
      ln(c, g2[0], g2[1], g3[0], g3[1], '#e8b42a', 3);
      // the net drum with green netting wound on it
      const [dx, dy] = anchor(p, sternAtA1 ? aft - 0.4 : aft + 0.4, bm, zdk + 2);
      layer(c, (l) => {
        ell(l, dx, dy, 12, 7, '#2e5a3a');
        ell(l, dx, dy - 2, 11, 6, '#3a6e46');
        for (let i = 0; i < 14; i++) px(l, dx - 10 + i * 1.5, dy - 4 + Math.sin(i) * 2, '#1e3a26');
        ell(l, dx - 12, dy, 2, 5, '#c8941c');
        ell(l, dx + 12, dy, 2, 5, '#c8941c');
      }, { rect: [dx - 16, dy - 10, dx + 16, dy + 9] });
    }
    if (k.seed % 2 === 0) {
      // outrigger booms raised in a V over the wheelhouse
      const [ox, oy] = anchor(p, wa + ww / 2, bm, zdk + 4);
      ln(c, ox, oy, ox - 46, oy - 112, '#c8ccd0', 2);
      ln(c, ox, oy, ox + 36, oy - 118, '#c8ccd0', 2);
      ln(c, ox - 46, oy - 112, ox - 2, oy - 84 - mh, '#3a3a40');
      ln(c, ox + 36, oy - 118, ox - 2, oy - 84 - mh, '#3a3a40');
    }
    const fwd = sternAtA1 ? a0 + (a1 - a0) * 0.25 : a1 - (a1 - a0) * 0.25;
    const nb = 2 + Math.floor(Rn() * 3);
    for (let i = 0; i < nb; i++) {
      const fa = fwd + (Rn() - 0.5) * 0.6;
      const fb = bm + (Rn() - 0.5) * hb;
      const col = [P.blue, P.red, P.green][Math.floor(Rn() * 3)];
      lbox(p, fa, fb, 0.22, 0.18, zdk + (i % 2) * 1.5, 1.5, mono(plate(col), col[0]));
    }
    const [cx, cy] = anchor(p, fwd + 0.3, bm + hb * 0.3, zdk);
    coil(c, cx, cy, 7, ROPE);
    // a net heap with floats, a winch forward of the wheelhouse, a cluster of buoys
    const [nx, ny] = anchor(p, sternAtA1 ? aft - 0.9 : aft + 0.9, bm + hb * 0.35, zdk);
    layer(c, (l) => netHeap(l, nx, ny, k.seed, 15, k.seed % 3 === 1), { rect: [nx - 24, ny - 18, nx + 24, ny + 6] });
    const wa2 = sternAtA1 ? wa - 0.35 : wa + ww + 0.1;
    lbox(p, wa2, bm - 0.3, 0.25, 0.6, zdk, 2.4, mono(plate(P.grey), P.grey[0]));
    const [wx2, wy2] = anchor(p, wa2 + 0.12, bm + 0.32, zdk + 1.6);
    ell(c, wx2, wy2, 4, 4, '#2a2a30');
    ell(c, wx2, wy2, 2.5, 2.5, ROPE[2]);
    for (let i = 0; i < 4; i++) {
      const [bx, by] = anchor(p, fwd - 0.2 + i * 0.12, bm - hb * 0.4, zdk + 1.4);
      ell(c, bx, by, 3, 3, i % 2 ? '#f28a2a' : '#e8402a');
      px(c, bx - 1, by - 2, '#ffb07a', 1, 1);
    }
    // buoys and fenders over the side
    for (let i = 0; i < 3; i++) {
      const fa = a0 + (a1 - a0) * (0.25 + i * 0.25);
      const [fx, fy] = p.P(fa, bm + hb * 0.96, zd);
      px(c, fx - 2, fy, i % 2 ? '#f28a2a' : '#f4f0e6', 4, 7);
      px(c, fx - 2, fy, '#ffffff', 1, 6);
      px(c, fx - 1, fy - 3, '#3a3a40', 1, 3);
    }
    // a gull resting on the wheelhouse roof
    if (k.seed % 4 === 1) {
      const [gx, gy] = anchor(p, wa + ww * 0.3, bm, zdk + 21.6);
      gullStand(c, gx, gy, 1);
    }
    // mooring lines to the quay behind (toward −b)
    if (k.variant === 'moor') {
      for (const la of [a0 + 0.4, a1 - 0.4]) {
        const [x0, y0] = p.P(la, bm - hb, zd + 1.4);
        const [x1, y1] = p.P(la + (la < (a0 + a1) / 2 ? -0.7 : 0.7), -0.25, 5);
        rope(c, x0, y0, x1, y1, 4, ROPE[2], ROPE[4]);
      }
    }
  },
};

// ── the harbour ferry ────────────────────────────────────────
// A small car ferry, 21 m: the car deck aft (always the visible end), a 2.4 m
// saloon, the open upper deck with benches, the wheelhouse and funnel forward.
const FRED: Ramp = ['#4a0a0e', '#6e1016', '#94181c', '#b42222', '#cc2e2a', '#e04a40', '#f06a58'];
const ferryBeam = (t: number) => (t < 0.06 ? 0.9 + t * 1.6 : t > 0.78 ? Math.sqrt(Math.max(0, 1 - ((t - 0.78) / 0.22) ** 2)) : 1);
const ROOFG: Ramp = ['#5a5e64', '#6a6e74', '#7c8086', '#8e9296', '#a2a6aa', '#b6babc'];
const SOOT: Ramp = ['#1a1a1e', '#222226', '#2a2a30', '#34343a', '#3e3e46', '#4a4a52'];
const RAILC = '#e8e4da';

/** Positions along a by the fraction t from the stern (the stern is always the visible end). */
function plan(p: PropPainter, a0: number, a1: number) {
  const sternA1 = p.rot === 0;
  const A = (t: number) => (sternA1 ? a1 - (a1 - a0) * t : a0 + (a1 - a0) * t);
  const span = (t0: number, t1: number): [number, number] => {
    const x = A(t0);
    const y = A(t1);
    return x < y ? [x, y] : [y, x];
  };
  return { A, span, sternA1 };
}

/** A railing between two local points (a, b): stanchions, a knee rail and a top rail h z-units up. */
function rail(p: PropPainter, s: [number, number], e: [number, number], z: number, h = 10, col = RAILC) {
  const c = p.c;
  const n = Math.max(1, Math.round(Math.hypot(e[0] - s[0], e[1] - s[1]) / 0.34));
  const dark = darken(col, 0.2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = s[0] + (e[0] - s[0]) * t;
    const b = s[1] + (e[1] - s[1]) * t;
    const [x0, y0] = p.P(a, b, z);
    const [x1, y1] = p.P(a, b, z + h);
    ln(c, x0, y0, x1, y1, dark);
  }
  const m0 = p.P(s[0], s[1], z + h * 0.5);
  const m1 = p.P(e[0], e[1], z + h * 0.5);
  ln(c, m0[0], m0[1], m1[0], m1[1], dark);
  const t0 = p.P(s[0], s[1], z + h);
  const t1 = p.P(e[0], e[1], z + h);
  ln(c, t0[0], t0[1], t1[0], t1[1], col, 2);
}

/** A railing following the hull's outline (pts from hull()) at b = bm ± half-beam. */
function railHull(p: PropPainter, pts: [number, number][], bm: number, sgn: 1 | -1, z: number, from: number, to: number, h = 9) {
  const sel = pts.filter(([a]) => a >= from - 1e-6 && a <= to + 1e-6);
  for (let i = 0; i < sel.length - 1; i += 2) {
    const j = Math.min(sel.length - 1, i + 2);
    rail(p, [sel[i][0], bm + sgn * sel[i][1] * 0.97], [sel[j][0], bm + sgn * sel[j][1] * 0.97], z, h);
  }
}

/** A car or a van along a, its back to the visible end: body, glasshouse, wheels, lights. */
function vehicle(p: PropPainter, aS: number, aE: number, bS: number, bE: number, z: number, col: Ramp, van: boolean) {
  const c = p.c;
  const body = plate(col);
  const hb = van ? 17 : 6.4;
  const z0 = z + 2.2;
  lbox(p, aS, bS, aE - aS, bE - bS, z0, hb, { front: body, side: body, top: body, edge: col[0] });
  const len = aE - aS;
  const back = endAt(p, aS, aE);
  const toFront = back === aE ? -1 : 1; // the direction from the back toward the bonnet
  const SE = side(p, back);
  const FS = front(p, bE);
  if (van) {
    // the cab's side window at the front, a sliding door line, a stripe and the rear doors
    const ca = back + toFront * (len - 0.55);
    pt(p, FS, Math.min(ca, ca + toFront * 0.42), Math.max(ca, ca + toFront * 0.42), z0 + 9.5, z0 + 14.5, glass, FS.light);
    pq(p, FS, Math.min(aS, aE) + 0.05, Math.max(aS, aE) - 0.05, z0 + 5, z0 + 6.4, '#b2342a');
    const sd = back + toFront * (len * 0.55);
    pq(p, FS, sd - 0.012, sd + 0.012, z0 + 0.5, z0 + 15, darken(col[3], 0.25));
    pq(p, SE, (bS + bE) / 2 - 0.012, (bS + bE) / 2 + 0.012, z0 + 0.5, z0 + 16, darken(col[2], 0.3));
    for (const [u0, u1] of [[bS + 0.1, (bS + bE) / 2 - 0.08], [(bS + bE) / 2 + 0.08, bE - 0.1]]) pt(p, SE, u0, u1, z0 + 10.5, z0 + 14.5, glass, SE.light);
    pq(p, SE, bS + 0.02, bS + 0.08, z0 + 2, z0 + 7, '#c8281e');
    pq(p, SE, bE - 0.08, bE - 0.02, z0 + 2, z0 + 7, '#c8281e');
    stencil(p, FS, Math.min(aS, aE) + len * 0.3, z0 + 12.5, 'FISCH', '#2c4a80');
  } else {
    // the glasshouse set back from the bonnet, the roof, rear window and lights
    const g0 = back + toFront * 0.35;
    const g1 = back + toFront * (len * 0.68);
    const ga = Math.min(g0, g1);
    const gb = Math.max(g0, g1);
    lbox(p, ga, bS + 0.07, gb - ga, bE - bS - 0.14, z0 + hb, 4.6, { front: glass, side: glass, top: body, edge: col[0] });
    lbox(p, ga - 0.03, bS + 0.05, gb - ga + 0.06, bE - bS - 0.1, z0 + hb + 4.6, 0.8, mono(body, col[0]));
    const pil = (g0 + g1) / 2;
    pq(p, front(p, bE - 0.07), pil - 0.03, pil + 0.03, z0 + hb, z0 + hb + 4.6, col[1]);
    pq(p, SE, bS + 0.04, bS + 0.2, z0 + 4.4, z0 + 5.8, '#c8281e');
    pq(p, SE, bE - 0.2, bE - 0.04, z0 + 4.4, z0 + 5.8, '#c8281e');
    pq(p, SE, (bS + bE) / 2 - 0.12, (bS + bE) / 2 + 0.12, z0 + 2.2, z0 + 3.4, '#e8e4d0');
  }
  // wheels in their arches on the near side
  for (const a of [aS + 0.42, aE - 0.42]) {
    const [x, y] = FS.F(a, z0 + 0.9);
    ell(c, x, y, 10, 10, '#141418');
    ell(c, x, y + 1, 4.5, 4.5, '#6e7278');
    ell(c, x - 1, y, 2, 2, '#a8acb0');
  }
}

const ferry: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const bm = D / 2;
    const hb = D / 2 - 0.12;
    const a0 = 0.1;
    const a1 = W - 0.1;
    const zd = ZW + 14;
    const zdk = zd - 0.6;
    const zs = zdk + 24; // the saloon's roof: the upper deck
    const { A, span, sternA1 } = plan(p, a0, a1);
    const pts = hull(p, a0, a1, bm, hb, ZW, zd, FRED, { beam: ferryBeam, strake: '#f2ede2', boot: '#2a2a30', deck: ['#2a4a32', '#34583c', '#3e6646', '#4a7452', '#56825e', '#64906a'], rail: false });
    const white = plate(P.white);
    // far to near: the far rail, the foredeck, the saloon and what stands on it, the car deck, the near rail
    railHull(p, pts, bm, -1, zd + 1.4, a0, a1);
    // the foredeck: a windlass, bitts, the jackstaff with its flag
    const wa = A(0.93);
    lbox(p, wa - 0.22, bm - 0.38, 0.44, 0.76, zdk, 3.6, mono(plate(P.grey), P.grey[0]));
    for (const db of [-0.42, 0.42]) {
      const [x, y] = p.P(wa, bm + db, zdk + 1.8);
      ell(c, x, y, 4, 4, '#2a2a30');
      ell(c, x, y, 2, 2, '#5a5a62');
    }
    for (const db of [-hb * 0.6, hb * 0.6]) for (const da of [-0.12, 0.12]) lbox(p, A(0.885) + da - 0.04, bm + db - 0.04, 0.08, 0.08, zdk, 3.2, mono(plate(SOOT), '#101012'));
    {
      const [x, y] = p.P(A(0.992), bm, zd + 1.4);
      px(c, x - 1, y - 44, '#e8e4da', 2, 44);
      fillPoly(c, [[x + 1, y - 44], [x + 15, y - 40], [x + 1, y - 35]], '#2c5aa0');
      px(c, x + 1, y - 41, '#f2ede2', 9, 2);
    }
    // the saloon: 2.4 m of white deckhouse, a band of windows, doors in its aft end
    const [s0, s1] = span(0.3, 0.86);
    const sb0 = bm - hb * 0.8;
    const sb1 = bm + hb * 0.8;
    lbox(p, s0, sb0, s1 - s0, sb1 - sb0, zdk, 24, { front: white, side: white, top: plate(['#4a5a52', '#56665e', '#62726a', '#6e7e76', '#7a8a82', '#86968e']), edge: P.white[0] });
    const F1 = front(p, sb1);
    pq(p, F1, s0, s1, zdk + 1.6, zdk + 3, FRED[4]);
    pt(p, F1, s0 + 0.14, s1 - 0.14, zdk + 9, zdk + 19, glass, F1.light);
    for (let u = s0 + 0.62; u < s1 - 0.2; u += 0.62) pq(p, F1, u, u + 0.05, zdk + 9, zdk + 19, '#e8e4da');
    pq(p, F1, s0, s1, zdk + 21.6, zdk + 22.6, FRED[4]);
    const SE = side(p, endAt(p, s0, s1));
    pt(p, SE, sb0 + 0.14, bm - 0.46, zdk + 9, zdk + 19, glass, SE.light);
    pt(p, SE, bm + 0.46, sb1 - 0.14, zdk + 9, zdk + 19, glass, SE.light);
    pq(p, SE, bm - 0.36, bm + 0.36, zdk, zdk + 21, '#c8c4ba');
    pt(p, SE, bm - 0.32, bm + 0.32, zdk, zdk + 20.2, glass, SE.light);
    pq(p, SE, bm - 0.015, bm + 0.015, zdk, zdk + 20.2, '#c8c4ba');
    pq(p, SE, sb0, sb1, zdk + 1.6, zdk + 3, FRED[3]);
    for (const fa of [0.25, 0.75]) {
      const [lx, ly] = F1.F(s0 + (s1 - s0) * fa, zdk + 5);
      ell(c, lx, ly, 5, 5, '#e8562a');
      ell(c, lx, ly, 2.4, 2.4, P.white[4]);
      px(c, lx - 5, ly - 1, '#f4f0e6', 2, 2);
      px(c, lx + 3, ly - 1, '#f4f0e6', 2, 2);
    }
    // the upper deck: its far rail, the wheelhouse forward, the funnel, benches and liferafts aft
    const [o0, o1] = span(0.3, 0.64);
    rail(p, [o0, sb0 + 0.04], [o1, sb0 + 0.04], zs);
    const [w0, w1] = span(0.64, 0.84);
    const wb0 = bm - hb * 0.56;
    const wb1 = bm + hb * 0.56;
    lbox(p, w0, wb0, w1 - w0, wb1 - wb0, zs, 19, { front: white, side: white, top: plate(ROOFG), edge: P.white[0] });
    const WF = front(p, wb1);
    pt(p, WF, w0 + 0.08, w1 - 0.08, zs + 10, zs + 16.4, glass, WF.light);
    for (let u = w0 + 0.42; u < w1 - 0.2; u += 0.42) pq(p, WF, u, u + 0.04, zs + 10, zs + 16.4, '#e8e4da');
    const WE = side(p, endAt(p, w0, w1));
    pt(p, WE, wb0 + 0.08, wb1 - 0.08, zs + 10, zs + 16.4, glass, WE.light);
    pq(p, WE, bm + 0.2, bm + 0.5, zs, zs + 17.4, '#d0ccc2');
    pq(p, WE, bm + 0.24, bm + 0.46, zs + 10, zs + 16, '#3a5a66');
    lbox(p, w0 - 0.06, wb0 - 0.06, w1 - w0 + 0.12, wb1 - wb0 + 0.12, zs + 19, 0.8, { front: white, side: white, top: plate(ROOFG), edge: P.white[0] });
    // the mast on the wheelhouse roof: radar, steaming light, side lights
    const [mx, my] = anchor(p, (w0 + w1) / 2, bm, zs + 19.8);
    layer(c, (l) => {
      px(l, mx - 1, my - 66, '#e8e4da', 2, 66);
      px(l, mx - 1, my - 66, '#ffffff', 1, 66);
      px(l, mx - 11, my - 40, '#e8e4da', 22, 2);
      px(l, mx + 9, my - 43, '#3ac85a', 2, 3);
      px(l, mx - 11, my - 43, '#d8402a', 2, 3);
      px(l, mx - 3, my - 22, '#3a3a40', 6, 4);
      ln(l, mx - 13, my - 25, mx + 13, my - 21, '#2a2a30', 3);
      px(l, mx - 2, my - 70, '#f4f0e6', 3, 4);
      fillPoly(l, [[mx + 1, my - 66], [mx + 14, my - 62], [mx + 1, my - 58]], '#2c5aa0');
    }, { rect: [mx - 16, my - 74, mx + 18, my + 2] });
    // the funnel: red, a white band, a sooty top
    const [f0, f1] = span(0.555, 0.625);
    lbox(p, f0, bm - 0.3, f1 - f0, 0.6, zs, 22, { front: plate(FRED), side: plate(FRED), top: plate(SOOT), edge: FRED[0] });
    const FF = front(p, bm + 0.3);
    const FE = side(p, endAt(p, f0, f1));
    pq(p, FF, f0, f1, zs + 13, zs + 16, '#f2ede2');
    pq(p, FE, bm - 0.3, bm + 0.3, zs + 13, zs + 16, '#dcd8ce');
    pq(p, FF, f0, f1, zs + 19.4, zs + 22, '#1e1e22');
    pq(p, FE, bm - 0.3, bm + 0.3, zs + 19.4, zs + 22, '#16161a');
    // liferaft canisters in cradles by the funnel
    for (const b of [sb0 + 0.22, sb1 - 0.22]) {
      for (const t of [0.6, 0.53]) {
        const [x, y] = p.P(A(t), b, zs + 3);
        px(c, x - 6, y + 1, '#5a5e64', 12, 2);
        ell(c, x, y - 2, 8, 4.5, '#d8d4ca');
        ell(c, x - 1, y - 3, 6.5, 3, '#f4f2ec');
        px(c, x - 1, y - 6, '#c8382a', 2, 7);
      }
    }
    // benches on the open deck, far to near, in two rows facing the rail
    const slats = planks(['#5e3e28', '#745032', '#8a623e', '#9e744a', '#b2885a', '#c49a68'], 3, 'u');
    const slatM = { front: slats, side: slats, top: slats, edge: '#3a2618' };
    for (let t = 0.47; t > 0.31; t -= 0.075) {
      const [ba, bb] = span(t - 0.04, t);
      for (const far of [true, false]) {
        const b = far ? sb0 + 0.2 : sb1 - 0.5;
        for (const a of [ba + 0.04, bb - 0.04])
          for (const db of [0.05, 0.25]) {
            const [x0, y0] = p.P(a, b + db, zs);
            px(c, x0, y0 - 14, '#2a2a30', 1, 14);
          }
        lbox(p, ba, b, bb - ba, 0.3, zs + 3.6, 0.8, slatM);
        lbox(p, ba, far ? b : b + 0.26, bb - ba, 0.04, zs + 4.4, 4, slatM);
      }
    }
    rail(p, [o0, sb1 - 0.04], [o1, sb1 - 0.04], zs);
    const ae = endAt(p, s0, s1);
    rail(p, [ae, sb0 + 0.04], [ae, sb1 - 0.04], zs);
    // the stairway from the car deck up to the upper deck, against the saloon's aft end
    {
      const da = sternA1 ? 0.5 : -0.5;
      const st0 = p.P(ae + da, sb0 + 0.3, zdk);
      const st1 = p.P(ae, sb0 + 0.3, zs);
      const st2 = p.P(ae, sb0 + 0.62, zs);
      const st3 = p.P(ae + da, sb0 + 0.62, zdk);
      fillPoly(c, [st0, st1, st2, st3], '#7a7e84');
      for (let i = 1; i < 8; i++) {
        const q0 = p.P(ae + da * (1 - i / 8), sb0 + 0.3, zdk + (zs - zdk) * (i / 8));
        const q1 = p.P(ae + da * (1 - i / 8), sb0 + 0.62, zdk + (zs - zdk) * (i / 8));
        ln(c, q0[0], q0[1], q1[0], q1[1], '#a8acb0');
      }
      const h0 = p.P(ae + da, sb0 + 0.62, zdk + 9);
      const h1 = p.P(ae, sb0 + 0.62, zs + 9);
      ln(c, h0[0], h0[1], h1[0], h1[1], RAILC, 2);
    }
    // the car deck: a lane line, a car in the far lane, a van in the near lane
    {
      const [l0, l1] = span(0.03, 0.29);
      for (let a = l0; a < l1 - 0.1; a += 0.36) {
        const q0 = p.P(a, bm - 0.02, zdk);
        const q1 = p.P(Math.min(l1, a + 0.2), bm - 0.02, zdk);
        ln(c, q0[0], q0[1], q1[0], q1[1], '#c8a030', 2);
      }
      const [c0, c1] = span(0.04, 0.24);
      vehicle(p, c0, c1, bm - 1.25, bm - 0.35, zdk, ['#141e30', '#1c2a44', '#26385a', '#324a74', '#405e8e', '#5474a6'], false);
      const [v0, v1] = span(0.035, 0.275);
      vehicle(p, v0, v1, bm + 0.25, bm + 1.2, zdk, P.white, true);
    }
    railHull(p, pts, bm, 1, zd + 1.4, a0, a1);
    // the stern gate across the car deck's end
    const se = endAt(p, a0, a1);
    rail(p, [se, bm - hb * 0.85], [se, bm + hb * 0.85], zd + 1.4, 9, '#f2c43a');
    stencil(p, front(p, bm + hb), a0 + (a1 - a0) * 0.42, zd - 3.2, 'FERRY 62', '#f2ede2', 2);
    // the gangway to the pier, mooring lines to its bollards (placed along the pier at b = −1)
    const gA = A(0.17);
    const [g0x, g0y] = p.P(gA, bm - hb, zd + 1.4);
    const [g1x, g1y] = p.P(gA + (sternA1 ? -0.3 : 0.3), -0.5, 0.5);
    ln(c, g0x, g0y, g1x, g1y, '#9aa0a6', 4);
    ln(c, g0x, g0y - 1, g1x, g1y - 1, '#c8ccd0', 2);
    ln(c, g0x, g0y - 30, g1x, g1y - 30, '#e8e4da');
    for (let t = 0; t <= 1; t += 0.5) ln(c, g0x + (g1x - g0x) * t, g0y + (g1y - g0y) * t, g0x + (g1x - g0x) * t, g0y + (g1y - g0y) * t - 30, '#c8ccd0');
    if (p.rot === 1) {
      for (const [fa, ba] of [[A(0.05), 3.5], [A(0.88), 8.5]] as const) {
        const [x0, y0] = p.P(fa, bm - hb, zd + 1.4);
        const [x1, y1] = p.P(ba, -1, 5);
        rope(c, x0, y0, x1, y1, 5, ROPE[2], ROPE[4]);
        ell(c, x1, y1 + 1, 7, 2.5, ROPE[1]);
      }
    }
  },
  anim(p, k) {
    // smoke from the funnel
    const { span } = plan(p, 0.1, k.w - 0.1);
    const [f0, f1] = span(0.555, 0.625);
    const [x, y] = p.P((f0 + f1) / 2, k.d / 2, ZW + 14 - 0.6 + 24 + 23);
    const u = p.k / 4;
    for (let i = 0; i < 4; i++) {
      const t = (k.t * 0.25 + i / 4) % 1;
      p.c.globalAlpha = 0.28 * (1 - t);
      ell(p.c, x + t * 40 * u, y - t * 30 * u, (3 + t * 7) * u, (2 + t * 5) * u, '#d8d8dc');
    }
    p.c.globalAlpha = 1;
  },
};

// ── the tug ──────────────────────────────────────────────────
const TUG: Ramp = ['#4a0c10', '#6a1218', '#8a1a20', '#aa2428', '#c43030', '#d84a44', '#e8665a'];
const tugBeam = (t: number) => (t < 0.1 ? 0.8 + t * 2 : t > 0.6 ? Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.4) ** 2)) * 0.98 + 0.02 : 1);

const tug: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const bm = D / 2;
    const hb = D / 2 - 0.15;
    const a0 = 0.15;
    const a1 = W - 0.15;
    const zd = ZW + 10;
    const pts = hull(p, a0, a1, bm, hb, ZW, zd, TUG, { beam: tugBeam, strake: '#c8382a', boot: '#a8322a', name: 'BUGSIER 9' });
    // tyre fenders all round the gunwale
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [a, h] = pts[i];
      const [x, y] = p.P(a, bm + h, zd - 1);
      ell(c, x, y + 3, 4, 3.5, '#121216');
      ell(c, x - 1, y + 2, 2, 1.5, '#3a3a40');
    }
    const zdk = zd - 0.6;
    const sternA1 = p.rot === 0;
    const wa = a0 + (a1 - a0) * (sternA1 ? 0.25 : 0.4);
    const ww = (a1 - a0) * 0.35;
    const white = plate(P.white);
    lbox(p, wa, bm - hb * 0.6, ww, hb * 1.2, zdk, 15, { front: plate(P.red), side: plate(P.red), top: plate(P.red), edge: P.red[0] });
    for (let u = wa + 0.3; u < wa + ww - 0.2; u += 0.45) {
      const [x, y] = front(p, bm + hb * 0.6).F(u, zdk + 9);
      ell(c, x, y, 3, 3, '#1e2a30');
      px(c, x - 1, y - 1, '#5a7a86', 1, 1);
    }
    // on the deckhouse: the wheelhouse forward, the funnel aft of it (f runs from forward to aft)
    const F = (f: number) => (sternA1 ? wa + ww * f : wa + ww * (1 - f));
    const h0 = Math.min(F(0.06), F(0.6));
    const h1 = Math.max(F(0.06), F(0.6));
    lbox(p, h0, bm - hb * 0.5, h1 - h0, hb, zdk + 15, 16, { front: white, side: white, top: plate(['#5a5e64', '#6a6e74', '#7c8086', '#8e9296', '#a2a6aa', '#b6babc']), edge: P.white[0] });
    const WF = front(p, bm + hb * 0.5);
    pt(p, WF, h0 + 0.06, h1 - 0.06, zdk + 23, zdk + 29, glass, WF.light);
    pt(p, side(p, endAt(p, h0, h1)), bm - hb * 0.45, bm + hb * 0.45, zdk + 23, zdk + 29, glass);
    lbox(p, h0 - 0.04, bm - hb * 0.54, h1 - h0 + 0.08, hb * 1.08, zdk + 31, 0.7, mono(plate(P.red), P.red[0]));
    // the funnel in the owner's colours, the towing hook aft, a mast
    const fa = Math.min(F(0.67), F(0.93));
    const fw = Math.abs(F(0.93) - F(0.67));
    const gold = plate(['#4e3a0c', '#6e5212', '#906c18', '#b08820', '#c8a02a', '#dcb840']);
    lbox(p, fa, bm - 0.25, fw, 0.5, zdk + 15, 14, { front: gold, side: gold, top: plate(TUG), edge: '#3a2a08' });
    pq(p, front(p, bm + 0.25), fa, fa + fw, zdk + 25, zdk + 29, '#1e1e24');
    pq(p, side(p, endAt(p, fa, fa + fw)), bm - 0.25, bm + 0.25, zdk + 25, zdk + 29, '#16161a');
    const [mx, my] = anchor(p, (h0 + h1) / 2, bm, zdk + 31.7);
    px(c, mx - 1, my - 30, '#e8e4da', 2, 30);
    px(c, mx - 7, my - 20, '#e8e4da', 14, 2);
    px(c, mx - 2, my - 34, '#f4f0e6', 3, 4);
    const aft = sternA1 ? a1 - 0.5 : a0 + 0.5;
    const [hx, hy] = anchor(p, aft, bm, zdk);
    px(c, hx - 3, hy - 8, '#3a3a40', 6, 8);
    px(c, hx - 4, hy - 9, '#5a5a62', 8, 2);
    void k;
  },
};

// ── yachts under sail out at sea ─────────────────────────────
const TEAK: Ramp = ['#6a5a40', '#7e6c4e', '#92805e', '#a6946e', '#b8a880', '#c8ba92'];
const GRP: Ramp = ['#6a6e72', '#8a8e90', '#aaaeae', '#c8cac8', '#e2e2de', '#f2f2ee', '#ffffff'];

const sail: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const bm = D / 2;
    const hb = Math.min(0.55, D / 2 - 0.05);
    const a0 = 0.1;
    const a1 = W - 0.1;
    const zd = ZW + 5;
    const { A, span } = plan(p, a0, a1);
    // the wake astern and the bow wave, on the water
    layer(c, (l) => {
      for (let i = 1; i < 9; i++) {
        for (const s of [-1, 1]) {
          const [x, y] = p.P(A(-i * 0.09), bm + s * (hb * 0.5 + i * 0.07), ZW);
          px(l, x - 2, y, i % 2 ? '#e2f2f8' : '#b4d8e8', 4 + (i % 3), 1);
        }
      }
      for (const s of [-1, 1]) {
        const [x, y] = p.P(A(0.93), bm + s * hb * 0.75, ZW);
        px(l, x - 4, y + 1, '#f2f9fb', 8, 1);
        px(l, x - 2, y + 3, '#cfe6ee', 5, 1);
      }
    }, { outline: false });
    hull(p, a0, a1, bm, hb, ZW, zd, GRP, { beam: (t) => (t < 0.1 ? 0.85 : t > 0.55 ? Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)) : 1), strake: ['#2c5aa0', '#a8322a', '#1e6a5a'][k.seed % 3], deck: TEAK });
    // the coachroof with its portholes, the cockpit coaming aft
    const [r0, r1] = span(0.34, 0.66);
    lbox(p, r0, bm - hb * 0.52, r1 - r0, hb * 1.04, zd - 0.6, 4.4, mono(plate(P.white), P.white[0]));
    const RF = front(p, bm + hb * 0.52);
    for (const t of [0.42, 0.5, 0.58]) {
      const [x, y] = RF.F(A(t), zd + 1.6);
      px(c, x - 2, y - 1, '#1e2a30', 4, 2);
    }
    // the rig: mast, boom swung out to leeward, the mainsail, the genoa with its blue leech strip
    const ma = A(0.6);
    const H = 34 + W * 16;
    const zb = zd + 7;
    const lee = 0.62;
    const P3 = (a: number, b: number, z: number) => p.P(a, b, z);
    const head = P3(ma, bm, zd + H);
    const tack = P3(ma, bm, zb);
    const clew = P3(A(0.1), bm + lee, zb + 1);
    const roach = P3(A(0.3), bm + lee * 0.55, zd + H * 0.55);
    layer(c, (l) => {
      // the genoa first (it sets behind the mainsail on this tack)
      const gh = P3(ma, bm, zd + H * 0.86);
      const gt = P3(A(0.985), bm, zd + 2.4);
      const gc = P3(A(0.44), bm + lee * 0.95, zd + 5);
      const gm = P3(A(0.62), bm + lee * 0.75, zd + H * 0.42);
      fillPoly(l, [gh, gt, gc, gm], '#e2e0d8');
      fillPoly(l, [gh, [gt[0] * 0.7 + gh[0] * 0.3, gt[1] * 0.7 + gh[1] * 0.3], gm], '#eeece6');
      ln(l, gh[0], gh[1], gm[0], gm[1], '#2c4a7a', 2);
      ln(l, gm[0], gm[1], gc[0], gc[1], '#2c4a7a', 2);
      ln(l, gc[0], gc[1], gt[0], gt[1], '#2c4a7a', 2);
      // the mainsail with a little roach, seams and battens
      fillPoly(l, [head, tack, clew, roach], '#f4f2ec');
      fillPoly(l, [head, [tack[0] * 0.5 + head[0] * 0.5, tack[1] * 0.5 + head[1] * 0.5], roach], '#fbfaf6');
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const q0 = [tack[0] + (head[0] - tack[0]) * t, tack[1] + (head[1] - tack[1]) * t];
        const lp = t < 0.5 ? [clew[0] + (roach[0] - clew[0]) * t * 2, clew[1] + (roach[1] - clew[1]) * t * 2] : [roach[0] + (head[0] - roach[0]) * (t - 0.5) * 2, roach[1] + (head[1] - roach[1]) * (t - 0.5) * 2];
        ln(l, q0[0], q0[1], lp[0], lp[1], i % 2 ? '#dcdad2' : '#e6e4dc');
      }
      // the mast and the boom
      ln(l, tack[0], tack[1] + 6, head[0], head[1] - 2, '#9aa0a6', 2);
      ln(l, tack[0], tack[1], clew[0], clew[1], '#5a5e64', 2);
      // the backstay and forestay
      const st = P3(A(0.02), bm, zd + 1.4);
      ln(l, head[0], head[1], st[0], st[1], '#8a9096');
      px(l, head[0] - 1, head[1] - 4, '#d8402a', 3, 3);
    }, { outline: 0.5 });
  },
};

const dinghy: PropArt = {
  draw(p, k) {
    // a clinker rowing skiff: real freeboard in its colour, a varnished gunwale, floorboards, two
    // thwarts, oars shipped along the seats, an outboard on the transom, a fender and painter lines
    const c = p.c;
    const W = k.w;
    const D = k.d;
    const bm = D / 2;
    const hb = Math.min(0.42, D / 2 - 0.1);
    const a0 = 0.12;
    const a1 = W - 0.12;
    const zg = ZW + 6.5;
    const hc = [P.green, P.red, P.sky, P.white][k.seed % 4];
    const beam = (t: number) => (t > 0.6 ? Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.4) ** 2)) : 0.88 + t * 0.2);
    const { A, span, sternA1 } = plan(p, a0, a1);
    const FLOOR: Ramp = ['#4a3a24', '#5a4830', '#6a563a', '#7a6444', '#8a7450', '#9a845c'];
    hull(p, a0, a1, bm, hb, ZW, zg, hc, { beam, strake: '#ece8de', boot: '#2a2a30', deck: FLOOR, rail: false });
    // the gunwale: a varnished rim all round the sheer (t = 0 at the stern)
    const N = 24;
    const rim = (sgn: number) => Array.from({ length: N + 1 }, (_, i) => p.P(A(i / N), bm + sgn * beam(i / N) * hb, zg));
    for (const sgn of [-1, 1]) {
      const r = rim(sgn);
      for (let i = 0; i < N; i++) {
        ln(c, r[i][0], r[i][1] + 1, r[i + 1][0], r[i + 1][1] + 1, '#5a3e22', 2);
        ln(c, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1], '#d8a868', 1);
      }
    }
    // the transom cap across the stern
    {
      const [x0, y0] = p.P(A(0), bm - beam(0) * hb, zg);
      const [x1, y1] = p.P(A(0), bm + beam(0) * hb, zg);
      ln(c, x0, y0, x1, y1, '#c89858', 2);
    }
    // two thwarts across the boat, the stern sheets and a bow seat
    const seat = plate(['#7a5a34', '#8e6a40', '#a27c4c', '#b68e5a', '#c8a26a', '#d8b47c']);
    for (const t of [0.12, 0.42, 0.68]) {
      const w = beam(t) * hb * 0.94;
      const [s0, s1] = span(t - 0.035, t + 0.035);
      lbox(p, s0, bm - w, s1 - s0, w * 2, zg - 2.4, 1.6, { front: seat, side: seat, top: seat, edge: '#4a321c' });
    }
    // the oars shipped along the thwarts, blades toward the bow
    for (const off of [-0.12, 0.1]) {
      const [x0, y0] = p.P(A(0.18), bm + off, zg - 0.2);
      const [x1, y1] = p.P(A(0.86), bm + off * 0.6, zg - 0.4);
      ln(c, x0, y0, x1, y1, '#3e2a16', 3);
      ln(c, x0, y0 - 1, x1, y1 - 1, '#d8b47c', 1);
      const [bx, by] = p.P(A(0.82), bm + off * 0.65, zg - 0.3);
      ell(c, bx, by, 6, 3, '#c89a5c');
      ell(c, bx, by - 1, 4, 2, '#e8c68c');
    }
    // the outboard on the transom: clamp, cowling, tiller arm and the leg into the water
    {
      const as = A(0) + (sternA1 ? 0.05 : -0.05);
      const [lx, ly] = p.P(as, bm, ZW + 0.5);
      const [tx, ty] = p.P(as, bm, zg + 1);
      ln(c, lx, ly, tx, ty, '#22242a', 3);
      lbox(p, as - 0.09, bm - 0.1, 0.18, 0.2, zg + 0.5, 4.2, { front: plate(['#1a1c22', '#24262e', '#2e3038', '#3a3c46', '#484a54', '#585a64']), side: plate(['#1a1c22', '#24262e', '#2e3038', '#3a3c46', '#484a54', '#585a64']), top: plate(['#2a2c34', '#3a3c46', '#4a4c56', '#5a5c66', '#6a6c76', '#7a7c86']), edge: '#121318' });
      const [hx, hy] = p.P(as + (sternA1 ? -0.28 : 0.28), bm + 0.04, zg + 2.2);
      const [gx, gy] = p.P(as, bm, zg + 2.6);
      ln(c, gx, gy, hx, hy, '#2a2c32', 2);
      px(c, gx - 2, gy - 3, '#e0b030', 4, 1);
    }
    // a white fender over the side and the painter lines to the pontoon
    {
      const [fx, fy] = p.P(A(0.55), bm + beam(0.55) * hb + 0.02, zg - 1);
      px(c, fx - 2, fy - 1, '#f2f2ee', 4, 8);
      px(c, fx - 2, fy - 1, '#ffffff', 1, 7);
      px(c, fx - 2, fy + 6, '#b8b8b2', 4, 1);
    }
    if (p.rot === 1) {
      for (const b of [-0.25, D + 0.25]) {
        const [x0, y0] = p.P(A(0.9), b < 0 ? bm - 0.3 : bm + 0.3, zg);
        const [x1, y1] = p.P(A(0.85), b, ZW + 2.4);
        rope(c, x0, y0, x1, y1, 3, ROPE[2], ROPE[4]);
      }
    }
  },
};

// ── motor launches in the marina ─────────────────────────────
// kinds by seed: 0 a cuddy-cabin cruiser, 1 an open launch with a centre
// console and a bimini, 2 a harbour workboat with a little wheelhouse.
const CUSHION: Ramp = ['#8a7a5a', '#a08e68', '#b6a47c', '#c8b88e', '#d8caa2', '#e6dab6'];
const LAUNCH: Ramp[] = [GRP, ['#0e1e3a', '#16294e', '#203764', '#2c4a80', '#3a5e98', '#4e74ae', '#6890c2'], ['#5a2a0e', '#7a3a12', '#9a4c18', '#c0621e', '#dc7a2a', '#ec943e', '#f4ae5a']];

const launch: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const bm = D / 2;
    const hb = Math.min(0.52, D / 2 - 0.1);
    const a0 = 0.1;
    const a1 = W - 0.1;
    const zd = ZW + 6;
    const zdk = zd - 0.6;
    const kind = k.variant === 'cuddy' ? 0 : k.variant === 'open' ? 1 : k.variant === 'work' ? 2 : k.seed % 3;
    const { A, span, sternA1 } = plan(p, a0, a1);
    const stripe = kind === 1 ? '#ece8de' : kind === 2 ? '#2a2a30' : ['#2c5aa0', '#1e6a5a', '#a8322a'][Math.floor(k.seed / 3) % 3];
    hull(p, a0, a1, bm, hb, ZW, zd, LAUNCH[kind], { beam: (t) => (t < 0.1 ? 0.9 : t > 0.55 ? Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)) : 1), strake: stripe, boot: kind === 2 ? '#a8322a' : '#2a2a30', deck: kind === 2 ? ['#3e4248', '#4c5056', '#5a5e64', '#6a6e74', '#7a7e84', '#8c9096'] : TEAK });
    const white = plate(P.white);
    const toStern = sternA1 ? 1 : -1;
    if (kind === 0) {
      // the cabin forward: portholes, the windscreen raked aft in a frame, a helm seat behind it
      const [c0, c1] = span(0.44, 0.8);
      lbox(p, c0, bm - hb * 0.62, c1 - c0, hb * 1.24, zdk, 6.5, { front: white, side: white, top: plate(GRP.slice(2)), edge: P.white[0] });
      const CF = front(p, bm + hb * 0.62);
      for (const t of [0.53, 0.62, 0.71]) {
        const [x, y] = CF.F(A(t), zdk + 3.6);
        ell(c, x, y, 2.5, 2, '#1e2a30');
        px(c, x - 1, y - 1, '#5a7a86', 1, 1);
      }
      const ae = A(0.44);
      const q = [[ae, bm - hb * 0.6, zdk + 6.5], [ae, bm + hb * 0.6, zdk + 6.5], [ae + toStern * 0.14, bm + hb * 0.6, zdk + 11.5], [ae + toStern * 0.14, bm - hb * 0.6, zdk + 11.5]].map(([a, b, z]) => p.P(a, b, z));
      fillPoly(c, q, '#3a5a66');
      fillPoly(c, [q[0], [q[0][0] * 0.6 + q[1][0] * 0.4, q[0][1] * 0.6 + q[1][1] * 0.4], [q[3][0] * 0.7 + q[2][0] * 0.3, q[3][1] * 0.7 + q[2][1] * 0.3], q[3]], '#5a7e8a');
      ln(c, q[2][0], q[2][1], q[3][0], q[3][1], '#e8e8e4', 2);
      ln(c, q[1][0], q[1][1], q[2][0], q[2][1], '#c8cac8');
      lbox(p, A(0.32) - 0.1, bm - 0.16, 0.2, 0.32, zdk, 3.4, { front: white, side: white, top: plate(CUSHION), edge: P.white[0] });
      lbox(p, A(0.32) - 0.1 + (sternA1 ? 0.16 : 0), bm - 0.16, 0.04, 0.32, zdk + 3.4, 3, mono(plate(CUSHION), CUSHION[0]));
      if (k.seed % 2 === 0) {
        // a canvas cover over the cockpit, sagging between its bows
        const [k0, k1] = span(0.08, 0.42);
        const cv = [[k0, bm - hb * 0.85, zd + 4], [k1, bm - hb * 0.85, zd + 6], [k1, bm + hb * 0.85, zd + 6], [k0, bm + hb * 0.85, zd + 4]].map(([a, b, z]) => p.P(a, b, z));
        fillPoly(c, cv, '#22406a');
        for (let i = 1; i < 4; i++) {
          const t = i / 4;
          const l0 = p.P(k0 + (k1 - k0) * t, bm - hb * 0.85, zd + 4 + 2 * t + 0.6);
          const l1 = p.P(k0 + (k1 - k0) * t, bm + hb * 0.85, zd + 4 + 2 * t + 0.6);
          ln(c, l0[0], l0[1], l1[0], l1[1], '#2e5282');
        }
        ln(c, cv[2][0], cv[2][1], cv[3][0], cv[3][1], '#16304e', 2);
      }
    } else if (kind === 1) {
      // the centre console with a small screen, a bench aft, the bimini on four posts
      const [c0, c1] = span(0.44, 0.52);
      lbox(p, c0, bm - 0.17, c1 - c0, 0.34, zdk, 8.5, { front: white, side: white, top: plate(['#2a2e34', '#33373e', '#3c4048', '#464a52', '#50545c', '#5a5e66']), edge: P.white[0] });
      const ae = A(0.53);
      const sc = [[ae, bm - 0.18, zdk + 8.5], [ae, bm + 0.18, zdk + 8.5], [ae + toStern * 0.06, bm + 0.18, zdk + 12], [ae + toStern * 0.06, bm - 0.18, zdk + 12]].map(([a, b, z]) => p.P(a, b, z));
      fillPoly(c, sc, '#4a6e7a');
      const [s0, s1] = span(0.1, 0.24);
      lbox(p, s0, bm - hb * 0.7, s1 - s0, hb * 1.4, zdk, 3.2, { front: white, side: white, top: plate(CUSHION), edge: P.white[0] });
      const [b0, b1] = span(0.28, 0.58);
      const corners: [number, number][] = [[b0, bm - hb * 0.78], [b1, bm - hb * 0.78], [b1, bm + hb * 0.78], [b0, bm + hb * 0.78]];
      for (const [a, b] of corners.slice(0, 2)) {
        const [x0, y0] = p.P(a, b, zdk);
        const [x1, y1] = p.P(a, b, zdk + 17);
        ln(c, x0, y0, x1, y1, '#b8bcc0');
      }
      const top = corners.map(([a, b]) => p.P(a, b, zdk + 17));
      fillPoly(c, top, '#4a6a96');
      fillPoly(c, [top[0], top[1], [top[1][0], top[1][1] + 3], [top[0][0], top[0][1] + 3]], '#2e4a70');
      fillPoly(c, [top[2], top[3], [top[3][0], top[3][1] + 3], [top[2][0], top[2][1] + 3]], '#6a8ab4');
      ln(c, top[3][0], top[3][1], top[0][0], top[0][1], '#7a9ac2');
      for (const [a, b] of corners.slice(2)) {
        const [x0, y0] = p.P(a, b, zdk);
        const [x1, y1] = p.P(a, b, zdk + 17);
        ln(c, x0, y0, x1, y1, '#d8dcdc');
      }
    } else {
      // the workboat: a wheelhouse, a towing post aft, tyres along the rubbing strake
      const [w0, w1] = span(0.3, 0.56);
      lbox(p, w0, bm - hb * 0.62, w1 - w0, hb * 1.24, zdk, 19, { front: white, side: white, top: plate(ROOFG), edge: P.white[0] });
      const WF = front(p, bm + hb * 0.62);
      pt(p, WF, w0 + 0.06, w1 - 0.06, zdk + 11, zdk + 16.4, glass, WF.light);
      const WE = side(p, endAt(p, w0, w1));
      pt(p, WE, bm - hb * 0.56, bm + hb * 0.56, zdk + 11, zdk + 16.4, glass, WE.light);
      pq(p, WE, bm - 0.1, bm + 0.16, zdk, zdk + 10.4, '#d0ccc2');
      lbox(p, w0 - 0.04, bm - hb * 0.66, w1 - w0 + 0.08, hb * 1.32, zdk + 19, 0.7, mono(plate(LAUNCH[2]), LAUNCH[2][1]));
      const [mx, my] = anchor(p, (w0 + w1) / 2, bm, zdk + 19.7);
      px(c, mx - 1, my - 26, '#e8e4da', 2, 26);
      px(c, mx - 6, my - 18, '#e8e4da', 12, 2);
      px(c, mx - 2, my - 30, '#f4f0e6', 3, 4);
      lbox(p, A(0.1) - 0.06, bm - 0.06, 0.12, 0.12, zdk, 5, mono(plate(SOOT), '#101012'));
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const [x, y] = p.P(A(t), bm + hb * 0.98, zd - 1.6);
        ell(c, x, y + 2, 4, 3.5, '#121216');
        ell(c, x - 1, y + 1, 2, 1.5, '#3a3a40');
      }
    }
    // the outboard on the transom
    if (kind !== 2) {
      const se = endAt(p, a0, a1);
      const [x, y] = p.P(se + toStern * 0.06, bm, zd + 0.5);
      layer(c, (l) => {
        px(l, x - 2, y, '#2a2a30', 4, 12);
        px(l, x - 5, y - 9, '#1e1e24', 10, 10);
        px(l, x - 5, y - 9, '#3a3a42', 3, 10);
        px(l, x - 4, y - 10, '#2a2a30', 8, 1);
        px(l, x - 5, y - 5, '#d8d4ca', 10, 1);
      }, { rect: [x - 8, y - 14, x + 8, y + 14] });
    }
    // white fenders over the side, lines to the finger piers either side
    for (const t of [0.3, 0.62]) {
      const [fx, fy] = p.P(A(t), bm + hb * 0.97, zd);
      px(c, fx - 2, fy, '#f4f0e6', 4, 7);
      px(c, fx - 2, fy, '#ffffff', 1, 6);
      px(c, fx - 1, fy - 3, '#3a3a40', 1, 3);
    }
    if (p.rot === 1) {
      for (const [t, b] of [[0.88, -0.25], [0.88, D + 0.25], [0.12, -0.25], [0.12, D + 0.25]] as const) {
        const [x0, y0] = p.P(A(t), b < 0 ? bm - hb * 0.8 : bm + hb * 0.8, zd + 0.6);
        const [x1, y1] = p.P(A(t) + (t > 0.5 ? 0.25 : -0.25), b, ZW + 2.4);
        rope(c, x0, y0, x1, y1, 3, ROPE[2], ROPE[4]);
      }
    }
  },
};

// ── buoys ────────────────────────────────────────────────────
const buoy: PropArt = {
  draw(p, k) {
    const [x, y0] = anchor(p, 0.5, 0.5, ZW);
    const y = y0;
    const red = k.variant !== 'green';
    const col: Ramp = red ? P.red : P.green;
    layer(p.c, (l) => {
      // the float, the cage, the topmark, a ring of foam
      for (let i = 0; i < 18; i++) px(l, x - 10 + i * 1.2, y + 2 + Math.sin(i) * 1.2, '#cfe6ee', 2, 1);
      ell(l, x, y, 11, 5, col[1]);
      for (let j = 0; j < 12; j++) {
        const w = 10 - j * 0.35;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, col[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.8 ? 3 : 2]);
        }
      }
      ell(l, x, y - 12, 7, 3, col[5]);
      for (const dx of [-5, 0, 5]) ln(l, x + dx, y - 12, x + dx * 0.4, y - 34, '#3a3a40');
      if (red) fillPoly(l, [[x - 5, y - 34], [x + 5, y - 34], [x + 5, y - 42], [x - 5, y - 42]], col[3]);
      else fillPoly(l, [[x - 6, y - 34], [x + 6, y - 34], [x, y - 44]], col[3]);
      px(l, x - 1, y - 47, '#2a2a30', 3, 3);
      for (let i = 0; i < 4; i++) px(l, x - 7 + i * 4, y - 7, '#f4f0e6', 2, 2);
    }, { rect: [x - 14, y - 50, x + 14, y + 6] });
    if (k.seed % 3 === 0) gullStand(p.c, x + 2, y - 12, -1);
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, ZW);
    const on = Math.sin(k.t * 2.4 + k.seed) > 0.55;
    px(p.c, x - 1, y - 47, on ? (k.variant !== 'green' ? '#ff5a3a' : '#5aff7a') : '#2a2a30', 3, 3);
  },
};

// ── the pontoon ──────────────────────────────────────────────
// variant 'walk': the main floating walkway along a, piles behind it and a
// gangway up to the quay edge (the quay is 3.2 tiles behind at y = 13);
// variant 'finger': one finger pier running out along b (boats lie between).
const pontoon: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const zt = ZW + 2.4;
    const deckM = planks(['#5a4a3a', '#6e5c48', '#857058', '#9c846a', '#b29a7e', '#c4ac90'], 4, 'v');
    const floatM = plate(['#3a3e44', '#4a4e54', '#5a5e64', '#6c7076', '#7e8288', '#92969a']);
    // (second pass) stout timber piles as in the reference: a lit flank, a shaded flank, a pale
    // cap, a ring of weed and wet timber at the waterline, a dark wobbly reflection under them
    const pile = (a: number, b: number, h: number) => {
      const [x, y] = p.P(a, b, ZW);
      const X = Math.round(x);
      const Y = Math.round(y);
      for (let j = 0; j < 14; j += 2) px(p.c, X - 5 + ((j >> 1) % 2 ? 1 : -1), Y + 2 + j, j < 6 ? '#062a44' : '#0a3656', 10 - (j >> 2), 1);
      p.c.fillStyle = '#4a3a2c';
      p.c.fillRect(X - 5, Y - h, 10, h);
      p.c.fillStyle = '#7a6248';
      p.c.fillRect(X - 5, Y - h, 4, h);
      p.c.fillStyle = '#2a2018';
      p.c.fillRect(X + 3, Y - h, 2, h);
      p.c.fillStyle = '#1c2a20';
      p.c.fillRect(X - 5, Y - 8, 10, 8);
      p.c.fillStyle = '#3a5a34';
      p.c.fillRect(X - 5, Y - 10, 10, 2);
      ell(p.c, X, Y - h, 5, 2.5, '#d8c8a8');
      px(p.c, X - 3, Y - h - 1, '#f2e6cc', 3, 1);
    };
    if (k.variant === 'finger') {
      lbox(p, 0.35, 0, 0.3, D - 0.15, ZW, 2, { front: floatM, side: floatM, top: deckM, edge: '#2a2a30' });
      for (const b of [0.8, D - 0.5]) {
        const [x, y] = p.P(0.65, b, zt - 0.4);
        px(p.c, x - 1, y - 2, '#2a2a30', 4, 2);
      }
      pile(0.5, D - 0.1, 54);
      pile(0.5, D * 0.5, 46);
      return;
    }
    for (let a = 0.4; a < W; a += 2) pile(a, 0.05, 60);
    lbox(p, 0, 0.1, W, 0.7, ZW, 2.4, { front: floatM, side: floatM, top: deckM, edge: '#2a2a30' });
    for (let a = 0.4; a < W; a += 2) {
      const [x, y] = p.P(a, 0.7, zt);
      px(p.c, x - 4, y - 2, '#2a2a30', 8, 2);
    }
    // (second pass) piles on the walkway's seaward side too, between the fingers, with a few
    // mooring cleats, a hose reel and a power post on the deck
    for (let a = 1.4; a < W - 0.5; a += 4) pile(a, 0.86, 52);
    for (let a = 2.4; a < W - 1; a += 4) {
      const [x, y] = p.P(a, 0.45, zt);
      px(p.c, x - 3, y - 12, '#e8eaec', 6, 12);
      px(p.c, x + 1, y - 12, '#a8acb0', 2, 12);
      px(p.c, x - 2, y - 10, '#2c7ac8', 4, 3);
    }
    // the gangway: a ramp of planks with handrails from the walkway up to the quay's edge
    const gw = W - 2.2;
    const qb = -3.2;
    poly3(p, [[gw - 0.22, 0.15, zt], [gw + 0.22, 0.15, zt], [gw + 0.22, qb + 0.05, 0.4], [gw - 0.22, qb + 0.05, 0.4]], planks(['#4a4440', '#5c544e', '#6e665e', '#80786e', '#928a7e', '#a49c90'], 3, 'u'), 2);
    for (const da of [-0.24, 0.24]) {
      const A = p.P(gw + da, 0.15, zt + 4);
      const B = p.P(gw + da, qb + 0.05, 4.4);
      ln(p.c, A[0], A[1], B[0], B[1], da > 0 ? '#c8ccd0' : '#e8eaec');
      for (let t = 0; t <= 1; t += 0.25) {
        const P0 = p.P(gw + da, 0.15 + (qb - 0.1) * t, zt + (0.4 - zt) * t);
        ln(p.c, P0[0], P0[1], P0[0], P0[1] - 16, '#9aa0a6');
      }
    }
    void k;
  },
};

// ── the lighthouse at the breakwater head ────────────────────
const lighthouse: PropArt = {
  draw(p, k) {
    const c = p.c;
    const [x, y] = anchor(p, k.w / 2, k.d / 2);
    contactShadow(c, x + 30, y + 8, 60, 18, 0.3);
    // a round granite plinth with steps
    layer(c, (l) => {
      for (let j = 0; j < 18; j++) {
        const w = 46;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          const yb = Math.sqrt(Math.max(0, 1 - (i / w) ** 2)) * w * 0.5;
          px(l, x + i, y + yb - j, ['#5a5856', '#6e6c68', '#82807a', '#96938c', '#a8a59c'][t < 0.25 ? 4 : t < 0.5 ? 3 : t < 0.78 ? 2 : 1]);
        }
      }
      ell(l, x, y - 18, 46, 23, '#9a978e');
      ell(l, x - 4, y - 20, 36, 17, '#aeaba2');
    }, { rect: [x - 50, y - 44, x + 50, y + 26] });
    // the tower: tapering, banded red and white, lit on the left
    const H = 400;
    const r0 = 22;
    const r1 = 15;
    layer(c, (l) => {
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const r = r0 + (r1 - r0) * t;
        const band = Math.floor((j / H) * 6) % 2 === 0;
        const R: Ramp = band ? ['#5a0c10', '#7e1418', '#a01c20', '#c01f2b', '#d83a3a', '#e85a52'] : ['#7a7874', '#9e9c96', '#c2bfb8', '#dcd9d2', '#ecebe4', '#f8f6f0'];
        for (let i = -r; i < r; i++) {
          const u = (i + r) / (2 * r);
          const tone = u < 0.16 ? 5 : u < 0.42 ? 4 : u < 0.7 ? 3 : u < 0.88 ? 2 : 1;
          px(l, x + i, y - 18 - j + Math.sqrt(Math.max(0, 1 - (i / r) ** 2)) * r * 0.45, R[tone]);
        }
      }
      // the door and small windows up the tower
      px(l, x - 6, y - 40, '#3a2a20', 10, 20);
      px(l, x - 6, y - 40, '#5a4030', 2, 20);
      for (const j of [120, 220, 310]) {
        px(l, x - 3, y - 18 - j, '#1e2a30', 5, 9);
        px(l, x - 3, y - 18 - j, '#5a7a86', 1, 9);
      }
    }, { rect: [x - 26, y - H - 30, x + 26, y + 8] });
    // the gallery with its railing, the lantern room, the red dome, the vent ball
    const gy = y - 18 - H;
    layer(c, (l) => {
      ell(l, x, gy + 4, 26, 9, '#3a3a40');
      ell(l, x, gy + 2, 26, 9, '#5a5a62');
      for (let i = -24; i <= 24; i += 4) px(l, x + i, gy - 10 + Math.abs(i) * 0.12, '#2a2a30', 1, 12);
      for (let i = -25; i <= 25; i++) px(l, x + i, gy - 11 + Math.sqrt(Math.max(0, 1 - (i / 25) ** 2)) * 7, '#2a2a30');
      // the lantern: glazing in a frame
      for (let j = 0; j < 26; j++)
        for (let i = -13; i < 13; i++) {
          const u = (i + 13) / 26;
          const frame = Math.abs(i) % 7 === 0 || j < 2 || j > 23;
          px(l, x + i, gy - 12 - j, frame ? '#2a2a30' : u < 0.3 ? '#c8e4e8' : u < 0.7 ? '#8ab4bc' : '#5a8a94');
        }
      px(l, x - 4, gy - 30, '#fff4c0', 8, 12);
      ell(l, x, gy - 40, 16, 6, '#8a2622');
      for (let j = 0; j < 10; j++) {
        const w = 16 - j * 1.5;
        px(l, x - w, gy - 40 - j, '#aa322a', w * 2, 1);
        px(l, x - w, gy - 40 - j, '#c84838', Math.max(1, w * 0.6), 1);
      }
      ell(l, x, gy - 53, 4, 4, '#2a2a30');
      px(l, x - 1, gy - 64, '#2a2a30', 2, 10);
    }, { rect: [x - 30, gy - 68, x + 30, gy + 14] });
    // gulls on the plinth and on the gallery rail
    gullStand(c, x - 30, y - 18, 1);
    gullStand(c, x + 20, gy - 9, -1);
  },
  anim(p, k) {
    const [x, y] = anchor(p, k.w / 2, k.d / 2);
    const gy = y - 18 - 400;
    const t = (k.t * 0.6) % 1;
    // the light turning: a bright core, and a beam sweeping once per cycle
    const u = p.k / 4;
    p.c.globalAlpha = 0.9;
    px(p.c, x - 4 * u, gy - 30 * u, '#fff8d8', 8 * u, 12 * u);
    const ang = t * Math.PI * 2;
    const dx = Math.cos(ang);
    if (Math.sin(ang) > 0) {
      p.c.globalAlpha = 0.18 * Math.sin(ang);
      const len = 120 * u;
      for (let i = 4; i < len; i += 2 * u) {
        const w = (2 + i * 0.12) * u;
        p.c.fillStyle = '#fff2b0';
        p.c.fillRect(Math.round(x + dx * i - w / 2), Math.round(gy - 24 * u - w * 0.3), Math.max(1, Math.round(w)), Math.max(1, Math.round(w * 0.6)));
      }
    }
    p.c.globalAlpha = 1;
  },
};

// ── tetrapods at the breakwater's foot ───────────────────────
const CONC: Ramp = ['#6a645a', '#7e786c', '#928b7e', '#a69e90', '#b8b0a0', '#c8c0ae', '#d6cebc'];
function tetrapod(c: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number) {
  // four stubby cones from a core: one up, three splayed down, shaded from the upper left
  const legs: [number, number][] = [[0, -1.1], [-0.95, 0.55], [0.95, 0.55], [0.1, 0.8]];
  const rot = hash(seed, 1, 3) * 6.28;
  const pts = legs.map(([lx, ly]) => {
    const cr = Math.cos(rot * 0.3);
    const sr = Math.sin(rot * 0.3);
    return [lx * cr - ly * sr * 0.6, lx * sr * 0.6 + ly * cr] as [number, number];
  });
  const order = pts.map((q, i) => [q, i] as const).sort((a, b) => a[0][1] - b[0][1]);
  for (const [[lx, ly]] of order) {
    const ex = x + lx * s;
    const ey = y + ly * s * 0.8;
    for (let t = 0; t <= 1; t += 0.08) {
      const r = s * (0.42 - t * 0.2);
      const cx = x + (ex - x) * t;
      const cy = y + (ey - y) * t;
      const lit = -lx * 0.5 - ly * 0.6;
      ell(c, cx, cy, r, r * 0.85, CONC[Math.max(0, Math.min(6, Math.round(2.4 + lit * 1.6)))]);
    }
    ell(c, ex - s * 0.05, ey - s * 0.06, s * 0.16, s * 0.13, CONC[Math.max(0, Math.min(6, Math.round(4 - ly * 1.2)))]);
  }
  ell(c, x - s * 0.1, y - s * 0.12, s * 0.28, s * 0.22, CONC[5]);
  if (hash(seed, 2, 3) < 0.3) px(c, x - 2, y + s * 0.3, '#3a4a2a', 3, 2);
}

const tetrapods: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const Rn = rng(k.seed * 41 + 7);
    const items: [number, number, number][] = [];
    for (let a = 0.2; a < W - 0.1; a += 0.42 + Rn() * 0.18) {
      items.push([a, 0.2 + Rn() * 0.25, 0]);
      if (Rn() < 0.7) items.push([a + 0.2, 0.62 + Rn() * 0.2, 1]);
      if (Rn() < 0.35) items.push([a + 0.1, 0.4 + Rn() * 0.2, 2]);
    }
    items.sort((m, n) => m[1] - n[1] || m[0] - n[0]);
    // foam churning round their feet
    layer(c, (l) => {
      for (let a = 0; a < W; a += 0.08) {
        const [x, y] = p.P(a, 0.95 + Math.sin(a * 7) * 0.05, ZW);
        if (Rn() < 0.7) px(l, x, y, Rn() < 0.5 ? '#f2f9fb' : '#cfe6ee', 3 + Math.floor(Rn() * 4), 1);
      }
    }, { outline: false });
    layer(c, (l) => {
      for (const [a, b, tier] of items) {
        const [x, y] = p.P(a, b, ZW + 4 + tier * 7);
        tetrapod(l, x, y, 15 + Rn() * 5, Math.floor(a * 100 + b * 37));
      }
    }, { outline: 0.6 });
  },
};

// ── the breakwater's wave wall ───────────────────────────────
const parapet: PropArt = {
  draw(p, k) {
    const W = k.w;
    const m = plate(CONC);
    lbox(p, 0, 0.55, W, 0.4, 0, 9, { front: m, side: m, top: plate(CONC), edge: CONC[0] });
    // expansion joints, rust stains, a painted warning
    const F = front(p, 0.95);
    for (let a = 2; a < W; a += 2) pq(p, F, a, a + 0.02, 0, 9, CONC[1]);
    const Rn = rng(k.seed + 3);
    for (let i = 0; i < W / 3; i++) {
      const a = Rn() * W;
      pq(p, F, a, a + 0.04, 3, 8.6, '#7a4a2a');
    }
    for (let a = 1; a < W; a += 6) stencil(p, F, a, 6, 'NO BATHING', '#c8382a');
  },
};

// ── a coaster under way off the breakwater ───────────────────
// A small general-cargo ship, 32 m: a black hull, hatch covers with a few
// boxes on them, a deck crane, the white accommodation aft with the bridge,
// the funnel and an orange freefall lifeboat; her wake and bow wave.
const COASTER: Ramp = ['#0a1020', '#0e1628', '#141e34', '#1a2840', '#22324e', '#2c3e5e', '#384c6e'];
const HATCH: Ramp = ['#24342c', '#2c3e34', '#36483e', '#405448', '#4c6254', '#5a7262'];
const coasterBeam = (t: number) => (t < 0.04 ? 0.94 + t * 1.5 : t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) * 0.96 + 0.04 : 1);

const coaster: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const bm = D / 2;
    const hb = D / 2 - 0.1;
    const a0 = 0.1;
    const a1 = W - 0.1;
    const zd = ZW + 22;
    const zdk = zd - 0.6;
    const { A, span, sternA1 } = plan(p, a0, a1);
    const toStern = sternA1 ? 1 : -1;
    // the bow wave: foam pushed out along the stem and the shoulders (her wake astern is in the sea)
    layer(c, (l) => {
      for (let t = 0.74; t < 1; t += 0.01) {
        const h = coasterBeam(t) * hb;
        for (const s of t > 0.93 ? [1, -1] : [1]) {
          const off = 0.04 + (1 - t) * 0.55 + Math.sin(t * 60) * 0.03;
          const [x, y] = p.P(A(t), bm + s * (h + off), ZW);
          px(l, x - 3, y + 1, t > 0.92 ? '#f8fcfd' : hash(Math.floor(t * 100), 1, 5) < 0.5 ? '#f2f9fb' : '#cfe6ee', t > 0.92 ? 7 : 5, t > 0.95 ? 2 : 1);
        }
      }
    }, { outline: false });
    const pts = hull(p, a0, a1, bm, hb, ZW, zd, COASTER, { beam: coasterBeam, strake: '#d8d4ca', boot: '#a8322a', deck: ['#3a3430', '#4a423c', '#5a5048', '#6a5e54', '#7a6c60', '#8a7a6c'], name: 'HELGA', rail: false });
    stencil(p, front(p, bm + hb), A(0.86), zd - 3, 'HELGA', '#e8e4da', 2);
    railHull(p, pts, bm, -1, zd + 1.4, a0, a1, 9);
    // the foremast and windlass on the forecastle
    {
      const [x, y] = anchor(p, A(0.9), bm, zdk);
      lbox(p, A(0.94) - 0.25, bm - 0.4, 0.5, 0.8, zdk, 4, mono(plate(P.grey), P.grey[0]));
      layer(c, (l) => {
        px(l, x - 2, y - 120, '#d8d4ca', 4, 120);
        px(l, x - 2, y - 120, '#f2efe6', 1, 120);
        px(l, x - 10, y - 90, '#d8d4ca', 20, 2);
        px(l, x - 2, y - 124, '#f4f0e6', 4, 4);
        px(l, x - 3, y - 60, '#2a2a30', 6, 5);
      }, { rect: [x - 14, y - 128, x + 14, y + 2] });
    }
    // the hatch coaming and its folding covers
    const hcB0 = bm - hb * 0.78;
    const hcB1 = bm + hb * 0.78;
    const panels: Mat = (light) => (u, v, x, y) => {
      let i = light === 0 ? 1.8 : light === 2 ? 3.6 : 3;
      if (u % 56 < 2) i -= 1.4;
      else if (u % 14 < 1) i -= 0.6;
      if (hash(x, y, 77) < 0.03) i -= 0.8;
      void v;
      return at(HATCH, i);
    };
    // two hatches, far to near; on each a 20 ft box either side of the centreline, some two high
    const Rn = rng(k.seed * 17 + 5);
    const zc = zdk + 8;
    const hatch = (t0: number, t1: number) => {
      const [h0, h1] = span(t0, t1);
      lbox(p, h0, hcB0, h1 - h0, hcB1 - hcB0, zdk, 8, { front: plate(HATCH), side: plate(HATCH), top: panels, edge: HATCH[0] });
      const ba = (h0 + h1) / 2 - 1.5 + (Rn() - 0.5) * 0.6;
      for (const rb0 of [hcB0 + 0.06, hcB1 - 1.28]) {
        if (Rn() < 0.15) continue;
        const n = Rn() < 0.45 ? 2 : 1;
        for (let j = 0; j < n; j++) drawBox(p, ba, rb0, 3, 1.22, zc + j * 26, 26, P[BOX_COLOURS[Math.floor(Rn() * BOX_COLOURS.length)]], { seed: Math.floor(Rn() * 1000), cheap: true, code: false, logo: false, doors: 'blank' });
      }
    };
    const crane = () => {
      const ca = A(0.54);
      lbox(p, ca - 0.3, bm - 0.3, 0.6, 0.6, zdk, 16, mono(plate(P.yellow), P.yellow[0]));
      lbox(p, ca - 0.42, bm - 0.4, 0.84, 0.8, zdk + 16, 11, { front: plate(P.yellow), side: plate(P.yellow), top: plate(P.yellow), edge: P.yellow[0] });
      const CF = front(p, bm + 0.4);
      pt(p, CF, ca - 0.3, ca - 0.02, zdk + 20, zdk + 25, glass, CF.light);
      const j0 = p.P(ca, bm, zdk + 24);
      const j1 = p.P(A(0.7), bm, zdk + 88);
      ln(c, j0[0], j0[1], j1[0], j1[1], '#b8901c', 6);
      ln(c, j0[0], j0[1] - 2, j1[0], j1[1] - 2, '#e8b42a', 3);
      const cr = p.P(A(0.7), bm, zdk + 72);
      ln(c, j1[0], j1[1], cr[0], cr[1], '#2a2a30');
      px(c, cr[0] - 3, cr[1], '#e8b42a', 6, 5);
    };
    hatch(0.57, 0.86);
    crane();
    hatch(0.22, 0.51);
    // the accommodation aft: three white decks stepping in, the bridge with wings
    const [d0, d1] = span(0.03, 0.18);
    const ab0 = bm - hb * 0.86;
    const ab1 = bm + hb * 0.86;
    const white = plate(P.white);
    const levels: [number, number, number][] = [[zdk, 24, 0], [zdk + 24, 22, 0.08], [zdk + 46, 22, 0.16]];
    for (const [z0, h, inset] of levels) {
      const e0 = sternA1 ? d0 + inset * 0.6 : d0 + inset;
      const e1 = sternA1 ? d1 - inset : d1 - inset * 0.6;
      const bb0 = ab0 + inset;
      const bb1 = ab1 - inset;
      lbox(p, e0, bb0, e1 - e0, bb1 - bb0, z0, h, { front: white, side: white, top: plate(ROOFG), edge: P.white[0] });
      const AF = front(p, bb1);
      const AE = side(p, endAt(p, e0, e1));
      const top = z0 === zdk + 46;
      if (top) {
        pt(p, AF, e0 + 0.08, e1 - 0.08, z0 + 11, z0 + 18, glass, AF.light);
        pt(p, AE, bb0 + 0.08, bb1 - 0.08, z0 + 11, z0 + 18, glass, AE.light);
      } else {
        for (let u = e0 + 0.35; u < e1 - 0.3; u += 0.62) pq(p, AF, u, u + 0.32, z0 + 9, z0 + 15, '#2a3e48');
        for (let u = bb0 + 0.3; u < bb1 - 0.3; u += 0.62) pq(p, AE, u, u + 0.32, z0 + 9, z0 + 15, '#22343e');
      }
      rail(p, [e0, bb1 + 0.02], [e1, bb1 + 0.02], z0 + h, 9);
    }
    // the bridge wings: slabs out to the ship's sides at bridge-deck level
    const wz = zdk + 46;
    const [wa0, wa1] = span(0.13, 0.17);
    lbox(p, wa0, bm - hb * 0.98, wa1 - wa0, hb * 0.98 - (bm - ab0 - 0.16), wz - 1, 1.2, mono(plate(P.white), P.white[0]));
    lbox(p, wa0, ab1 - 0.16, wa1 - wa0, bm + hb * 0.98 - (ab1 - 0.16), wz - 1, 1.2, mono(plate(P.white), P.white[0]));
    rail(p, [wa0, bm + hb * 0.98], [wa1, bm + hb * 0.98], wz, 9);
    // the funnel abaft the bridge: blue with a white star band, a black top
    const [f0, f1] = span(0.045, 0.1);
    const FUN: Ramp = ['#0e1e3a', '#16294e', '#203764', '#2c4a80', '#3a5e98', '#4e74ae'];
    lbox(p, f0, bm - 0.38, f1 - f0, 0.76, zdk + 68, 22, { front: plate(FUN), side: plate(FUN), top: plate(SOOT), edge: FUN[0] });
    pq(p, front(p, bm + 0.38), f0, f1, zdk + 76, zdk + 82, '#f2ede2');
    pq(p, side(p, endAt(p, f0, f1)), bm - 0.38, bm + 0.38, zdk + 76, zdk + 82, '#dcd8ce');
    pq(p, front(p, bm + 0.38), f0, f1, zdk + 87.5, zdk + 90, '#1a1a1e');
    // the radar mast on the wheelhouse top
    const [rx, ry] = anchor(p, A(0.14), bm, zdk + 68);
    layer(c, (l) => {
      px(l, rx - 1, ry - 70, '#e8e4da', 3, 70);
      px(l, rx - 12, ry - 40, '#e8e4da', 24, 2);
      ln(l, rx - 15, ry - 50, rx + 15, ry - 45, '#2a2a30', 3);
      ln(l, rx - 10, ry - 28, rx + 10, ry - 25, '#2a2a30', 2);
      px(l, rx - 2, ry - 74, '#f4f0e6', 4, 4);
      px(l, rx + 10, ry - 43, '#3ac85a', 2, 3);
      px(l, rx - 12, ry - 43, '#d8402a', 2, 3);
    }, { rect: [rx - 18, ry - 78, rx + 18, ry + 2] });
    // the freefall lifeboat on its ramp over the stern
    {
      const la = A(0.012);
      const q0 = p.P(la, bm - 0.5, zdk + 26);
      const q1 = p.P(la, bm + 0.5, zdk + 26);
      const q2 = p.P(la + toStern * 0.9, bm + 0.5, zdk + 14);
      const q3 = p.P(la + toStern * 0.9, bm - 0.5, zdk + 14);
      fillPoly(c, [q0, q1, q2, q3], '#6a6e74');
      const b0 = p.P(la + toStern * 0.1, bm, zdk + 30);
      const b1 = p.P(la + toStern * 0.8, bm, zdk + 21);
      layer(c, (l) => {
        ln(l, b0[0], b0[1], b1[0], b1[1], '#e8622a', 16);
        ln(l, b0[0], b0[1] - 4, b1[0], b1[1] - 4, '#f28a3e', 6);
        ln(l, b0[0], b0[1] + 5, b1[0], b1[1] + 5, '#b8481c', 3);
        px(l, (b0[0] + b1[0]) / 2 - 3, (b0[1] + b1[1]) / 2 - 3, '#2a3e48', 6, 3);
      }, { outline: 0.6 });
    }
    railHull(p, pts, bm, 1, zd + 1.4, a0, a1, 9);
  },
};

// ── the far headland ──────────────────────────────────────────
const cliff: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const Rn = rng(k.seed * 13 + 1);
    // a rocky shore: lumpy outcrops shaded from the upper left, surf at their feet, turf on top
    const masses: Mass[] = [];
    for (let i = 0; i < W * 3; i++) {
      const a = 0.2 + Rn() * (W - 0.4);
      const b = 0.3 + Rn() * (D - 0.6);
      const [x, y] = p.P(a, b, 0);
      masses.push({ x, y: y - 10 - Rn() * 26, rx: 14 + Rn() * 18, ry: 10 + Rn() * 12, z: y });
    }
    layer(c, (l) => foliage(l, masses, ['#4a4a4c', '#5e5e60', '#727274', '#88888a', '#9c9c9c', '#b0b0ae', '#c4c4c0'], k.seed, { cell: 9, tilt: 0.3 }), { outline: 0.55 });
    layer(c, (l) => {
      const tops: Mass[] = masses.filter((_, i) => i % 3 === 0).map((m) => ({ x: m.x - 4, y: m.y - m.ry * 0.7, rx: m.rx * 0.7, ry: m.ry * 0.35, z: m.z! + 1 }));
      foliage(l, tops, ['#344a14', '#43601a', '#527420', '#628828', '#749a32', '#86aa40', '#9cbc52'], k.seed + 1, { cell: 4 });
    }, { outline: 0.55 });
    for (let a = 0; a < W; a += 0.1) {
      const [x, y] = p.P(a, D - 0.1, ZW * 0.5);
      if (Rn() < 0.6) px(c, x, y, '#f2f9fb', 3, 1);
    }
  },
};

/** Clay pantiles in courses (v runs up the slope). */
const pantiles =
  (r: Ramp): Mat =>
  (light) =>
  (u, v, x, y) => {
    const row = Math.floor(v / 4);
    const off = row & 1 ? 3 : 0;
    let i = (light === 0 ? 1.6 : 3) + (hash(Math.floor((u + off) / 6), row, 63) - 0.5) * 1.1;
    if (v - row * 4 < 1) i -= 1.4;
    else if ((u + off) % 6 < 1) i -= 0.7;
    if (hash(x, y, 64) < 0.04) i -= 0.8;
    return at(r, i);
  };

/** Limewashed or boarded walls with a little grime at the foot. */
const limewash =
  (r: Ramp, boards: boolean): Mat =>
  (light) =>
  (u, v, x, y) => {
    let i = light === 0 ? 2.2 : 3.8;
    if (boards && v % 5 < 1) i -= 0.9;
    if (v < 6 && bayer(x, y) * 6 > v) i -= 0.7;
    if (hash(x, y, 65) < 0.03) i -= 0.6;
    void u;
    return at(r, i);
  };

/** A white picket fence between two local points: pointed pickets every 0.1 tile on two rails. */
function picket(p: PropPainter, s: [number, number], e: [number, number], h = 8) {
  const c = p.c;
  const n = Math.max(1, Math.round(Math.hypot(e[0] - s[0], e[1] - s[1]) / 0.1));
  for (const z of [h * 0.3, h * 0.75]) {
    const r0 = p.P(s[0], s[1], z);
    const r1 = p.P(e[0], e[1], z);
    ln(c, r0[0], r0[1], r1[0], r1[1], '#a8a49a');
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x0, y0] = p.P(s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, 0);
    const [, y1] = p.P(s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, h);
    px(c, x0 - 1, y1, '#f2efe6', 2, y0 - y1);
    px(c, x0, y1 - 1, '#f2efe6', 1, 1);
    px(c, x0, y1 + 2, '#c8c4ba', 1, y0 - y1 - 2);
  }
}

const cottage: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const v = k.seed % 4;
    const walls = [P.white, P.cream, ['#6a2a22', '#86382c', '#a04a38', '#b45e48', '#c8745c', '#d88c72'], ['#3a4a5a', '#4a5c6e', '#5c7084', '#70869a', '#869cae', '#9cb2c2']][v] as Ramp;
    const roofC: Ramp = k.seed % 2 ? ['#5e1e15', '#7e2a1e', '#a13725', '#b64d3a', '#c85f4c', '#d8765e'] : ['#28304a', '#323c58', '#3e4866', '#4a5676', '#586486', '#687496'];
    const a0 = 0.25;
    const a1 = W - 0.25;
    const b0 = 0.25;
    const b1 = D - 0.95;
    const H = 26;
    const bm = (b0 + b1) / 2;
    const zr = H + (b1 - b0) * 7.5;
    shadowBand(p, a0, b0, a1, b1, 0.5, 0.24);
    const m = limewash(walls, v >= 2);
    lbox(p, a0, b0, a1 - a0, b1 - b0, 0, H, { front: m, side: m, edge: walls[0] });
    const F = front(p, b1);
    const S = side(p, a1);
    pq(p, F, a0, a1, 0, 2.4, '#6e6a62');
    pq(p, S, b0, b1, 0, 2.4, '#5a5650');
    // the roof: pantiles or slate over the eaves, the gable end, barge boards
    poly3(p, [[a0 - 0.12, b1 + 0.16, H - 1.2], [a1 + 0.14, b1 + 0.16, H - 1.2], [a1 + 0.14, bm, zr], [a0 - 0.12, bm, zr]], pantiles(roofC), 1);
    poly3(p, [[a1, b1, H], [a1, b0, H], [a1, bm, zr]], m, 0, [[a1, b1, H], [a1, b0, H], [a1, b1, zr]]);
    const g0 = p.P(a1 + 0.14, b1 + 0.16, H - 1.2);
    const g1 = p.P(a1 + 0.14, bm, zr + 0.6);
    const g2 = p.P(a1 + 0.14, b0 - 0.16, H - 1.2);
    ln(c, g0[0], g0[1], g1[0], g1[1], '#e8e4da', 2);
    ln(c, g1[0], g1[1], g2[0], g2[1], '#d8d4ca', 2);
    const r0 = p.P(a0 - 0.12, bm, zr + 0.4);
    ln(c, r0[0], r0[1], g1[0], g1[1], roofC[1], 2);
    // the door with a fanlight, windows with white frames, shutters and sills
    const shut = ['#2e5a3a', '#2c4a80', '#8a2a22', '#3a6e6a'][(k.seed >> 1) % 4];
    const dc = a0 + (a1 - a0) * 0.36;
    pq(p, F, dc - 0.24, dc + 0.24, 0, 22, '#e8e4da');
    pq(p, F, dc - 0.2, dc + 0.2, 0, 19.5, shut);
    pq(p, F, dc - 0.2, dc + 0.2, 19.6, 21.4, '#3a5a66');
    pq(p, F, dc - 0.01, dc + 0.01, 0, 19.5, darken(shut, 0.3));
    px(c, ...F.F(dc + 0.14, 10), '#e8c060', 2, 2);
    for (const wc of [a0 + (a1 - a0) * 0.12, a0 + (a1 - a0) * 0.7]) {
      pq(p, F, wc - 0.2, wc + 0.2, 9, 20, '#e8e4da');
      pq(p, F, wc - 0.16, wc + 0.16, 9.8, 19.2, '#24343e');
      pq(p, F, wc - 0.01, wc + 0.01, 9.8, 19.2, '#e8e4da');
      pq(p, F, wc - 0.16, wc + 0.16, 14.2, 14.8, '#e8e4da');
      pq(p, F, wc - 0.36, wc - 0.22, 9, 20, shut);
      pq(p, F, wc + 0.22, wc + 0.36, 9, 20, shut);
      pq(p, F, wc - 0.24, wc + 0.24, 8, 9, '#c8c4ba');
    }
    pq(p, S, bm - 0.18, bm + 0.18, 9, 20, '#d8d4ca');
    pq(p, S, bm - 0.14, bm + 0.14, 9.8, 19.2, '#1e2a32');
    pq(p, S, bm - 0.1, bm + 0.1, H + 3, H + 9, '#1e2a32');
    // the chimney on the ridge
    lbox(p, a0 + 0.3, bm - 0.16, 0.32, 0.32, zr - 4, 12, mono(plate(['#4a2218', '#62301f', '#7a3e28', '#8e4e32', '#a2603e', '#b4744e']), '#3a1a12'));
    lbox(p, a0 + 0.27, bm - 0.19, 0.38, 0.38, zr + 8, 1.2, mono(plate(['#4e4c48', '#62605a', '#76736c', '#8a867e', '#9e9a90', '#b2aea2']), '#3a3834'));
    // the front garden: a gravel path to the gate, flowers, a picket fence
    const fb = D - 0.08;
    const path = [[dc - 0.16, b1, 0], [dc + 0.16, b1, 0], [dc + 0.16, fb, 0], [dc - 0.16, fb, 0]].map(([a, b, z]) => p.P(a, b, z));
    fillPoly(c, path, '#b8ac94');
    const Rn = rng(k.seed * 11 + 2);
    for (let i = 0; i < 26; i++) {
      const a = a0 + Rn() * (a1 - a0);
      if (Math.abs(a - dc) < 0.25) continue;
      const [x, y] = p.P(a, b1 + 0.12 + Rn() * 0.5, 0);
      px(c, x, y - 2, '#3a5a2a', 2, 3);
      px(c, x, y - 3, ['#e8c040', '#d8402a', '#f4f0e6', '#b05a9a'][Math.floor(Rn() * 4)], 2, 2);
    }
    picket(p, [0.05, fb], [dc - 0.22, fb]);
    picket(p, [dc + 0.22, fb], [W - 0.05, fb]);
    picket(p, [0.05, b1 + 0.1], [0.05, fb]);
    picket(p, [W - 0.05, b1 + 0.1], [W - 0.05, fb]);
  },
};

const pine: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 5 + 2);
    contactShadow(p.c, x + 20, y + 4, 34, 10, 0.26);
    layer(p.c, (l) => {
      // a wind-bent maritime pine: a leaning trunk, flat-topped crown blown inland
      const lean = 12 + Rn() * 8;
      const H = 78 + Rn() * 14;
      for (let j = 0; j < H; j++) {
        const t = j / H;
        const cx = x + lean * t * t;
        const w = Math.max(4, 10 - t * 5);
        for (let i = 0; i < w; i++) px(l, cx - w / 2 + i, y - j, i < w * 0.35 ? '#7a5a40' : i < w * 0.7 ? '#5a3e2c' : '#432c20');
        if (j % 7 === 3) px(l, cx - w / 2 + 1, y - j, '#4a3222', w - 2, 1);
      }
      // a forked limb or two into the crown
      ln(l, x + lean * 0.7, y - H * 0.85, x + lean - 18, y - H - 8, '#5a3e2c', 3);
      ln(l, x + lean * 0.8, y - H * 0.9, x + lean + 20, y - H - 6, '#5a3e2c', 3);
      const masses: Mass[] = [];
      for (let i = 0; i < 14; i++) masses.push({ x: x + lean - 46 + Rn() * 92, y: y - H - 8 + (Rn() - 0.5) * 22, rx: 22 + Rn() * 16, ry: 11 + Rn() * 7, z: i });
      masses.push({ x: x + lean - 6, y: y - H - 24, rx: 38, ry: 14, z: 15 });
      masses.push({ x: x + lean + 14, y: y - H - 30, rx: 26, ry: 11, z: 16 });
      foliage(l, masses, ['#1e3a22', '#26482a', '#305a34', '#3c6c3e', '#4a7e48', '#5a9054', '#6ea464'], k.seed, { cell: 5, holes: 0.06 });
    }, { outline: 0.55, rect: [x - 70, y - 150, x + 110, y + 6] });
  },
};

/** Gorse and heather on the headland: a low rounded bush, flowering yellow or pink. */
const bush: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const Rn = rng(k.seed * 3 + 1);
    contactShadow(p.c, x + 8, y + 2, 20, 6, 0.24);
    const gorse = k.seed % 3 !== 2;
    layer(p.c, (l) => {
      const masses: Mass[] = [];
      for (let i = 0; i < 7; i++) masses.push({ x: x - 22 + Rn() * 44, y: y - 10 - Rn() * 12, rx: 13 + Rn() * 8, ry: 9 + Rn() * 4, z: i });
      foliage(l, masses, gorse ? ['#1e3a14', '#2a4e1c', '#366224', '#44762c', '#528a34', '#62a03e', '#78b44e'] : ['#2a2a1e', '#3a3a26', '#4a4a30', '#5a5a3a', '#6a6a44', '#7c7c50', '#8e8e5e'], k.seed, { cell: 3, dots: gorse ? ['#f2c42a', '#e8b020', '#f6d860'] : ['#b05a9a', '#c87ab4', '#9a4a86'], dotChance: 0.6, dotSize: 2 });
    }, { outline: 0.55, rect: [x - 44, y - 40, x + 44, y + 4] });
  },
};

// ── night lights ────────────────────────────────────────────
lighthouse.lights = (k) => [{ a: k.w / 2, b: k.d / 2, z: 118, r: 5, color: '#fff2b0', kind: 'lamp' }];
ferry.lights = (k) => [
  { a: k.w * 0.45, b: k.d / 2, z: 26, r: 2.2, color: '#ffd9a0', kind: 'window' },
  { a: k.w * 0.7, b: k.d / 2, z: 30, r: 1.8, color: '#ffd9a0', kind: 'window' },
];
coaster.lights = (k) => [{ a: k.w * 0.82, b: k.d / 2, z: 50, r: 2, color: '#ffd9a0', kind: 'window' }];
cottage.lights = (k) => [{ a: k.w * 0.3, b: k.d - 0.2, z: 14, r: 1.3, color: '#ffcf8a', kind: 'window' }];
buoy.lights = () => [{ a: 0.5, b: 0.5, z: 12, r: 1.2, color: '#ff9a7a', kind: 'lamp' }];
tug.lights = (k) => [{ a: k.w * 0.5, b: k.d / 2, z: 24, r: 1.4, color: '#ffd9a0', kind: 'window' }];

export const PORT_SEA: Record<string, PropArt> = {
  prt_trawler: trawler,
  prt_ferry: ferry,
  prt_tug: tug,
  prt_sail: sail,
  prt_dinghy: dinghy,
  prt_launch: launch,
  prt_buoy: buoy,
  prt_pontoon: pontoon,
  prt_lighthouse: lighthouse,
  prt_tetrapods: tetrapods,
  prt_parapet: parapet,
  prt_coaster: coaster,
  prt_cliff: cliff,
  prt_cottage: cottage,
  prt_pine: pine,
  prt_bush: bush,
};

export { RUBBER };

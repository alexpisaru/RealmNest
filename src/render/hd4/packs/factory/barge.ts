// Factory — the coal boat and the footbridge over the canal (1 z ≈ 10 cm; a tile ≈ 1.6 m ≈ 16 z).
//   fac_barge    a working narrowboat (14 m × 2.1 m) loaded with coal, under way: a black hull with
//                freeboard and sheer, rubbing strakes, a rounded bow with its rope fender button, a
//                counter stern with the rudder and a brass swan-neck tiller; the back cabin in green
//                and red with portholes, a name board, the chimney, a water can, a rope coil and the
//                gang plank on its roof; the hold heaped with coal between coamings and rolled side
//                cloths, top planks on their stands, the cratch at the fore end; her reflection, the
//                bow wave and the stern wash. 'moving' has the bow at +a, 'moving-rev' at a = 0.
//   fac_bridge   a raised footbridge (overhead: the boat passes beneath it): brick stairs on the wharf,
//                white plate girders over the boat's lane, a steel trestle clear of the lane, a steel
//                stair down to the towpath, railings, a lamp
import { darken, lighten } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { ell, fillPoly, hash, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, side } from '../../plane4';
import { lbox } from '../util';
import { planeText } from './font';
import { at, BRICK, brick, IRON, OLDWOOD, RED, STONE } from './palette';

type V3 = [number, number, number];
const flat = (r: Ramp, li: number, ld: number, lt = li + 1): Mat => (light) => () => at(r, light === 2 ? lt : light ? li : ld);
const mono = (m: Mat, edge: string) => ({ front: m, side: m, top: m, edge });
const poly = (p: PropPainter, pts: V3[], col: string) => fillPoly(p.c, pts.map(([a, b, z]) => p.P(a, b, z)), col);
const line3 = (p: PropPainter, A: V3, B: V3, col: string, w = 1) => {
  const [x0, y0] = p.P(...A);
  const [x1, y1] = p.P(...B);
  ln(p.c, x0, y0, x1, y1, col, w);
};
/** the canal's water level (as in canal.ts) */
const WZ = -5;

const HULL: Ramp = ['#0c0b0e', '#141318', '#1c1b22', '#26252e', '#32313c', '#42414e', '#5a5968'];
const GREEN: Ramp = ['#0c2216', '#123020', '#1a3e2a', '#225036', '#2c6244', '#3a7654', '#52906a'];
const CREAM = '#ece2c4';
const BRASS = ['#6a4a14', '#9a7020', '#c8982c', '#e8c050', '#fbe48c'];
const COAL: Ramp = ['#0e0d10', '#17161a', '#212026', '#2c2b32', '#3c3b44', '#56545e', '#7e7c88'];
const ROPE = ['#6a5232', '#8e7046', '#b0905a', '#ceb07a', '#e8cc98'];

// ── the narrowboat ──────────────────────────────────────────
const fac_barge: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const dir: 1 | -1 = k.variant === 'moving-rev' ? -1 : 1;
    /** bow-forward position s → a */
    const A = (s: number) => (dir > 0 ? s : W - s);
    const bm = D / 2;
    const HW = Math.min(0.64, D / 2 - 0.04);
    const s0 = 0.34; // the counter's end
    const s1 = W - 0.05; // the stem
    const hw = (s: number) => {
      if (s < 0.95) {
        const t = Math.max(0, (s - s0) / (0.95 - s0));
        return HW * (0.46 + 0.54 * Math.sqrt(1 - (1 - t) ** 2));
      }
      if (s > W - 1.55) {
        const t = Math.max(0, (s1 - s) / (s1 - (W - 1.55)));
        return Math.max(0.035, HW * Math.sqrt(1 - (1 - t) ** 2.4));
      }
      return HW;
    };
    const zg = (s: number) => 2 + 2.4 * Math.max(0, (s - (W - 1.9)) / 1.9) ** 2 + 1.3 * Math.max(0, (1.05 - s) / 0.7) ** 2;
    const S: number[] = [];
    for (let s = s0; s < 0.95; s += 0.06) S.push(s);
    for (let s = 0.95; s < W - 1.55; s += 0.5) S.push(s);
    for (let s = W - 1.55; s < s1; s += 0.08) S.push(s);
    S.push(s1);
    const P3 = (s: number, side: number, z: number): V3 => [A(s), bm + side * hw(s), z];

    // the water: her shadow and reflection beside the near side, ripples, the bow wave and stern wash
    p.c.globalAlpha = 0.42;
    poly(p, [...S.map((s) => [A(s), bm + hw(s) + 0.04, WZ] as V3), ...[...S].reverse().map((s) => [A(s), bm + hw(s) + 0.3 * Math.min(1, hw(s) / HW), WZ] as V3)], '#08100c');
    p.c.globalAlpha = 0.3;
    const R = rng(k.seed * 31 + 7);
    for (let s = 0.7; s < 2.6; s += 0.07) {
      const [x, y] = p.P(A(s), bm + HW + 0.12 + R() * 0.12, WZ);
      px(p.c, x - 2, y, s > 1.0 && s < 2.4 && R() < 0.5 ? GREEN[4] : '#a83a2a', 4, 1);
    }
    p.c.globalAlpha = 0.6;
    for (let s = s0 + 0.2; s < s1 - 0.3; s += 0.32) {
      const [x, y] = p.P(A(s + R() * 0.1), bm + hw(s) + 0.05, WZ);
      px(p.c, x - 4, y + 1, '#b8c8b8', 8, 1);
    }
    // the bow wave curling off the stem along both sides, the stern wash boiling behind the rudder
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const [x, y] = p.P(A(s1 - t * 1.3), bm + sd * (hw(s1 - t * 1.3) + 0.04 + t * 0.14), WZ);
        p.c.globalAlpha = 0.75 * (1 - t * 0.7);
        px(p.c, x - 3, y, i % 2 ? '#e8f0e8' : '#c8d8cc', 6, 1);
      }
    }
    for (let i = 0; i < 22; i++) {
      const t = R();
      const [x, y] = p.P(A(s0 - 0.05 - t * 0.75), bm + (R() - 0.5) * (0.3 + t * 0.7), WZ);
      p.c.globalAlpha = 0.7 * (1 - t);
      px(p.c, x - 2, y, R() < 0.5 ? '#e8f0e8' : '#b8ccc0', 3 + Math.round(R() * 5), 1);
    }
    p.c.globalAlpha = 1;

    // the rudder and its stock: behind the counter (drawn first when the stern is the far end)
    const rudder = () => {
      const ra0 = A(0.04);
      const ra1 = A(s0 + 0.02);
      const F = front(p, bm);
      pq(p, F, Math.min(ra0, ra1), Math.max(ra0, ra1), WZ, 0.6, HULL[3]);
      pq(p, F, Math.min(ra0, ra1), Math.max(ra0, ra1), 0.2, 0.6, HULL[5]);
      line3(p, [A(s0 + 0.02), bm, 0.6], [A(s0 + 0.02), bm, zg(s0) + 2.6], HULL[4], 2);
    };
    const button = () => {
      // the rope fender button on the stem
      const [x, y] = p.P(A(s1 + 0.03), bm, 0.4);
      ell(p.c, x, y, 6, 6, ROPE[1]);
      ell(p.c, x - 1, y - 1, 4, 4, ROPE[3]);
      for (let i = -4; i <= 4; i += 2) px(p.c, x + i, y - 5 + Math.abs(i) * 0.4, ROPE[0], 1, 10 - Math.abs(i) * 0.8);
      px(p.c, x - 2, y - 3, ROPE[4], 2, 1);
    };
    if (dir > 0) rudder();
    else button();

    // the hull: far side first, then the counter's end, then the near side in strips shaded by their normal
    const strip = (sd: number) => {
      for (let i = 0; i + 1 < S.length; i++) {
        const sa = S[i];
        const sb = S[i + 1];
        const dh = (hw(sb) - hw(sa)) / (sb - sa);
        // the outward normal in plan, in (a, b)
        const nl = Math.hypot(dh, 1);
        const na = (-dh * sd * dir) / nl;
        const nb = sd / nl;
        const lum = 2.6 + 1.1 * nb * (sd > 0 ? 1 : 0.4) - 0.9 * Math.max(0, na);
        const base = at(HULL, lum);
        poly(p, [P3(sa, sd, WZ), P3(sb, sd, WZ), P3(sb, sd, zg(sb)), P3(sa, sd, zg(sa))], base);
        // the waterline in red oxide, two rubbing strakes, the top band and the gunwale's lit edge
        poly(p, [P3(sa, sd, WZ), P3(sb, sd, WZ), P3(sb, sd, WZ + 0.9), P3(sa, sd, WZ + 0.9)], lum > 2.6 ? '#5a2a1e' : '#3e1e16');
        for (const z of [-2.2, -0.4]) {
          poly(p, [P3(sa, sd, z), P3(sb, sd, z), P3(sb, sd, z + 0.5), P3(sa, sd, z + 0.5)], at(HULL, lum + 1.6));
          poly(p, [P3(sa, sd, z - 0.3), P3(sb, sd, z - 0.3), P3(sb, sd, z), P3(sa, sd, z)], at(HULL, lum - 1.4));
        }
        poly(p, [P3(sa, sd, zg(sa) - 1.3), P3(sb, sd, zg(sb) - 1.3), P3(sb, sd, zg(sb) - 0.5), P3(sa, sd, zg(sa) - 0.5)], lum > 2.6 ? RED[3] : RED[1]);
        poly(p, [P3(sa, sd, zg(sa) - 0.5), P3(sb, sd, zg(sb) - 0.5), P3(sb, sd, zg(sb)), P3(sa, sd, zg(sa))], lum > 2.6 ? CREAM : '#8a8270');
      }
    };
    strip(-1);
    // the counter's end (seen when the stern is the near end)
    poly(p, [P3(s0, -1, WZ + 1.6), P3(s0, 1, WZ + 1.6), P3(s0, 1, zg(s0)), P3(s0, -1, zg(s0))], HULL[1]);
    poly(p, [P3(s0, -1, zg(s0) - 1.3), P3(s0, 1, zg(s0) - 1.3), P3(s0, 1, zg(s0) - 0.5), P3(s0, -1, zg(s0) - 0.5)], RED[1]);
    strip(1);
    // the bow flash: a painted diamond and the boat's number on the near bow; rope fenders along the side
    {
      const sb = W - 1.15;
      const [x, y] = p.P(A(sb), bm + hw(sb) + 0.01, zg(sb) - 3.4);
      fillPoly(p.c, [[x, y - 6], [x + 7, y], [x, y + 6], [x - 7, y]], CREAM);
      fillPoly(p.c, [[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]], RED[3]);
      for (const s of [1.6, 3.4, 5.2, W - 2.2]) {
        const [fx, fy] = p.P(A(s), bm + hw(s) + 0.03, zg(s) - 1.6);
        ln(p.c, fx, fy - 6, fx, fy - 2, ROPE[1]);
        ell(p.c, fx, fy + 1, 3, 4, ROPE[1]);
        ell(p.c, fx - 1, fy, 1.6, 2.4, ROPE[3]);
      }
    }
    // the top of the hull: the bottom boards inside, the fore deck, the stern deck
    poly(p, [...S.map((s) => P3(s, -1, zg(s))), ...[...S].reverse().map((s) => P3(s, 1, zg(s)))], '#1a1612');
    const deck = (sa: number, sb: number) => {
      const pts: number[] = S.filter((s) => s >= sa && s <= sb);
      poly(p, [...pts.map((s) => P3(s, -0.9, zg(s) + 0.05)), ...[...pts].reverse().map((s) => P3(s, 0.9, zg(s) + 0.05))], OLDWOOD[2]);
      for (let s = sa + 0.12; s < sb; s += 0.14) line3(p, P3(s, -0.85, zg(s) + 0.06), P3(s, 0.85, zg(s) + 0.06), OLDWOOD[1]);
    };

    const zC = 2; // the cabin's sill
    const c0 = 0.62;
    const c1 = 2.55;
    const ch = 8.2;
    const cw = 0.5;
    const cabin = () => {
      deck(s0, c0 + 0.02);
      const a0 = Math.min(A(c0), A(c1));
      const a1 = Math.max(A(c0), A(c1));
      const panel: Mat = (light, _w, h) => (u, v) => {
        // green sides inside a red border and a cream coach line, the top band in red
        let i = light === 2 ? 4.4 : light ? 3.2 : 2;
        if (v > h - 5) return at(['#5a1c16', '#7a241c', '#9a2e22', '#b83a2a', '#d0503a'], light ? 3 : 2);
        if (v < 3 || u < 3 || u > _w - 3) return at(['#5a1c16', '#7a241c', '#9a2e22', '#b83a2a', '#d0503a'], light ? 3 : 1.6);
        if (v < 4 || v > h - 6) return light ? CREAM : '#a89e86';
        if (u % 60 < 1) i -= 0.8;
        return at(GREEN, i);
      };
      lbox(p, a0, bm - cw, a1 - a0, 2 * cw, zC, ch, { front: panel, side: panel, top: flat(['#4a1e16', '#62281c', '#7a3424', '#92402c', '#aa4e36'], 3, 2, 3.4), edge: GREEN[0] });
      // the roof: cambered, overhanging a little, red oxide; the slide hatch at the stern end
      const zr = zC + ch;
      poly(p, [[a0 - 0.04, bm - cw - 0.04, zr], [a1 + 0.04, bm - cw - 0.04, zr], [a1 + 0.04, bm, zr + 0.8], [a0 - 0.04, bm, zr + 0.8]], '#8a3a28');
      poly(p, [[a0 - 0.04, bm, zr + 0.8], [a1 + 0.04, bm, zr + 0.8], [a1 + 0.04, bm + cw + 0.04, zr], [a0 - 0.04, bm + cw + 0.04, zr]], '#a24a32');
      line3(p, [a0 - 0.04, bm + cw + 0.04, zr], [a1 + 0.04, bm + cw + 0.04, zr], '#d06a48');
      line3(p, [a0 - 0.04, bm + cw + 0.04, zr - 0.3], [a1 + 0.04, bm + cw + 0.04, zr - 0.3], '#4a1e16');
      const ha0 = Math.min(A(c0), A(c0 + 0.38));
      lbox(p, ha0, bm - 0.22, 0.38, 0.44, zr + 0.4, 0.9, mono(flat(OLDWOOD, 3.4, 2.2, 4.2), OLDWOOD[0]));
      // the near side: three portholes with brass rims, the name board, a little castle panel
      const F = front(p, bm + cw + 0.002);
      for (const s of [c0 + 0.35, c0 + 0.8, c1 - 0.3]) {
        const [x, y] = F.F(A(s), zC + ch * 0.58);
        ell(p.c, x, y, 5, 5, BRASS[1]);
        ell(p.c, x, y, 4, 4, BRASS[3]);
        ell(p.c, x, y, 2.8, 2.8, '#1a2a30');
        px(p.c, x - 2, y - 2, '#c8dce0', 2, 1);
      }
      const nA = A(c0 + 1.25);
      pq(p, F, nA - 0.36, nA + 0.36, zC + 2.2, zC + 4.6, CREAM);
      planeText(p.c, F, nA, zC + 3.4, 'ALBION', '#3a1a12', 1);
      // the visible end: back doors with roses and castles (stern near) or the engine-room bulkhead
      const Se = side(p, a1 + 0.002);
      if (dir < 0) {
        for (const [b0, b1] of [[bm - cw + 0.08, bm - 0.02], [bm + 0.02, bm + cw - 0.08]] as const) {
          pq(p, Se, b0, b1, zC + 0.6, zr - 1.2, '#7a241c');
          pq(p, Se, b0 + 0.04, b1 - 0.04, zC + 1.2, zr - 1.8, '#d8ccaa');
          pq(p, Se, b0 + 0.06, b1 - 0.06, zC + 1.4, zC + 3.4, GREEN[4]);
          pq(p, Se, b0 + 0.12, b0 + 0.2, zC + 3.4, zC + 5.6, '#c8b8a0');
          const [rx, ry] = Se.F((b0 + b1) / 2, zr - 3);
          px(p.c, rx - 1, ry - 1, '#d8302a', 3, 3);
          px(p.c, rx + 2, ry, '#f2a0a0', 2, 2);
        }
      } else {
        pq(p, Se, bm - 0.22, bm + 0.22, zC + 0.6, zr - 1, '#5a1c16');
        pq(p, Se, bm - 0.18, bm + 0.18, zC + 1, zr - 1.4, GREEN[3]);
        const [dx, dy] = Se.F(bm, zC + ch * 0.55);
        fillPoly(p.c, [[dx, dy - 5], [dx + 4, dy], [dx, dy + 5], [dx - 4, dy]], CREAM);
      }
      // roof furniture: the chimney with brass bands, a painted water can, a rope coil, the gang plank
      const [cx, cy] = p.P(A(c1 - 0.42), bm - 0.05, zr + 0.6);
      px(p.c, cx - 3, cy - 15, '#16151a', 7, 15);
      px(p.c, cx - 3, cy - 15, '#3e3c46', 2, 15);
      for (const yy of [-4, -9, -15]) px(p.c, cx - 4, cy + yy, BRASS[3], 9, 2);
      px(p.c, cx - 4, cy - 17, '#0c0b0e', 9, 2);
      const [wx, wy] = p.P(A(c0 + 1.05), bm + 0.1, zr + 0.6);
      px(p.c, wx - 4, wy - 12, GREEN[3], 9, 12);
      px(p.c, wx - 4, wy - 12, GREEN[5], 2, 12);
      px(p.c, wx - 4, wy - 8, '#c83a2a', 9, 2);
      px(p.c, wx - 1, wy - 6, CREAM, 3, 2);
      px(p.c, wx - 2, wy - 14, GREEN[2], 5, 2);
      const [rx, ry] = p.P(A(c0 + 0.6), bm + 0.15, zr + 0.6);
      for (let i = 0; i < 4; i++) ell(p.c, rx, ry - i * 1.4, 9 - i, 4.5 - i * 0.4, ROPE[i % 2 ? 1 : 3]);
      ell(p.c, rx, ry - 5, 3, 1.4, ROPE[0]);
      lbox(p, Math.min(A(c0 + 0.12), A(c1 - 0.08)), bm - cw + 0.04, Math.abs(A(c1 - 0.08) - A(c0 + 0.12)), 0.14, zr + 0.3, 0.6, mono(flat(OLDWOOD, 3.6, 2.4, 4.6), OLDWOOD[0]));
      // a tunnel lamp in brass by the roof's fore end
      const [lx, ly] = p.P(A(c1 - 0.1), bm + 0.32, zr + 0.4);
      px(p.c, lx - 2, ly - 6, BRASS[2], 5, 6);
      px(p.c, lx - 1, ly - 5, '#fff2c0', 3, 3);
    };
    const tiller = () => {
      // the brass swan neck and the tiller bar with its white-scrubbed grip
      const [x0, y0] = p.P(A(s0 + 0.02), bm, zg(s0) + 2.6);
      const [x1, y1] = p.P(A(s0 + 0.1), bm, zg(s0) + 6.4);
      const [x2, y2] = p.P(A(s0 + 0.62), bm + 0.08, zg(s0) + 7.2);
      ln(p.c, x0, y0, x1, y1, BRASS[2], 2);
      ln(p.c, x0 - 1, y0, x1 - 1, y1, BRASS[4], 1);
      ln(p.c, x1, y1, x2, y2, BRASS[2], 2);
      ln(p.c, x1, y1 - 1, x2, y2 - 1, BRASS[4], 1);
      px(p.c, x2 - 2, y2 - 2, '#f4f0e4', 5, 3);
      // a coiled stern line on the counter
      const [ex, ey] = p.P(A(s0 + 0.14), bm - 0.15, zg(s0));
      for (let i = 0; i < 3; i++) ell(p.c, ex, ey - i, 5 - i, 2.5 - i * 0.4, ROPE[i % 2 ? 1 : 3]);
    };
    const h0 = 2.75;
    const h1 = W - 1.6;
    const hold = () => {
      const pts = S.filter((s) => s >= h0 && s <= h1);
      const ca = (sd: number, dz: number, inset: number) => [...pts.map((s) => [A(s), bm + sd * (hw(s) - inset), zg(s) + dz] as V3)];
      // the far coaming's inside face, the far side cloth rolled along it
      poly(p, [...ca(-1, 0, 0.06), ...ca(-1, 2.4, 0.06).reverse()], OLDWOOD[1]);
      line3(p, [A(h0), bm - HW + 0.06, zg(h0) + 2.4], [A(h1), bm - HW + 0.06, zg(h1) + 2.4], OLDWOOD[3]);
      for (let s = h0; s < h1; s += 0.05) {
        const [x, y] = p.P(A(s), bm - HW + 0.04, zg(s) + 2.7);
        ell(p.c, x, y, 3, 3, '#24261c');
        px(p.c, x - 1, y - 2, '#4a4c3a', 2, 1);
      }
      // the coal: lumps heaped to a ridge above the coamings, lit on top, a few glints
      const lumps: [number, number, number, number][] = [];
      for (let s = h0 + 0.05; s < h1 - 0.03; s += 0.06)
        for (let t = -1; t <= 1.001; t += 0.13) {
          const fs = (s - (h0 + h1) / 2) / ((h1 - h0) / 2);
          const h = 5.4 * (1 - fs ** 8) * (1 - t * t * 0.85) + R() * 0.9 - 0.4;
          lumps.push([s + (R() - 0.5) * 0.04, bm + t * (HW - 0.1) + (R() - 0.5) * 0.04, zg(s) + 0.6 + Math.max(0, h), R()]);
        }
      lumps.sort((m, o) => A(m[0]) + m[1] - (A(o[0]) + o[1]));
      for (const [s, b, z, r] of lumps) {
        const [x, y] = p.P(A(s), b, z);
        px(p.c, x - 2, y - 1, at(COAL, 0.6 + r * 1.4 + (z - zg(s)) * 0.25), 5, 3);
        px(p.c, x - 2, y - 2, at(COAL, 2.4 + r * 2.4 + (z - zg(s)) * 0.3), r < 0.5 ? 2 : 3, 1);
        if (r > 0.96) px(p.c, x, y - 2, '#c8c8d8', 1, 1);
      }
      // the near coaming (painted), its cloth roll; the stands and the top planks along the middle
      poly(p, [...ca(1, 0, 0.02), ...ca(1, 2.4, 0.02).reverse()], HULL[3]);
      line3(p, [A(h0), bm + HW - 0.02, zg(h0) + 2.4], [A(h1), bm + HW - 0.02, zg(h1) + 2.4], '#8a8270');
      for (let s = h0; s < h1; s += 0.05) {
        const [x, y] = p.P(A(s), bm + HW - 0.04, zg(s) + 2.7);
        ell(p.c, x, y, 3, 3, '#2e3024');
        px(p.c, x - 1, y - 2, '#5a5c46', 2, 1);
      }
      const zt = zg(h0) + 9;
      for (const s of [h0 + 0.05, (h0 + h1) / 2, h1 - 0.05]) line3(p, [A(s), bm, zg(s)], [A(s), bm, zt], OLDWOOD[3], 3);
      lbox(p, Math.min(A(h0), A(h1)), bm - 0.08, Math.abs(A(h1) - A(h0)), 0.16, zt, 0.4, mono(flat(OLDWOOD, 3.6, 2.2, 4.6), OLDWOOD[0]));
      // the cratch: a triangular board at the hold's fore end, painted, its stem line up from the bow
      const cs = h1 + 0.02;
      poly(p, [[A(cs), bm - hw(cs) + 0.05, zg(cs)], [A(cs), bm + hw(cs) - 0.05, zg(cs)], [A(cs), bm, zt + 0.4]], dir > 0 ? GREEN[3] : GREEN[1]);
      poly(p, [[A(cs), bm - 0.12, zg(cs) + 1.6], [A(cs), bm + 0.12, zg(cs) + 1.6], [A(cs), bm, zt - 1.6]], CREAM);
      line3(p, [A(cs), bm, zt + 0.4], [A(s1 - 0.1), bm, zg(s1 - 0.1) + 4], '#d8d0b8');
    };
    const fore = () => {
      deck(h1 + 0.05, s1);
      // the stem post (the "tipcat") and a coiled bow line
      const [x, y] = p.P(A(s1 - 0.12), bm, zg(s1 - 0.12));
      px(p.c, x - 1, y - 12, OLDWOOD[3], 3, 12);
      px(p.c, x - 1, y - 12, OLDWOOD[5], 1, 12);
      const [ex, ey] = p.P(A(s1 - 0.5), bm, zg(s1 - 0.5));
      for (let i = 0; i < 3; i++) ell(p.c, ex, ey - i, 5 - i, 2.5 - i * 0.4, ROPE[i % 2 ? 1 : 3]);
    };
    if (dir > 0) {
      tiller();
      cabin();
      hold();
      fore();
      button();
    } else {
      fore();
      hold();
      cabin();
      tiller();
      rudder();
    }
    void lighten;
    void hash;
  },
};

// ── the footbridge ──────────────────────────────────────────
// Its footprint spans the canal along b: the wharf (b 0 … 1.4), the water (1.4 … 5.4), the towpath's lip.
// The boat's lane is b 1.7 … 3.1; the deck crosses it at 19.5 z, a trestle stands at b 3.3 clear of it.
const DZ = 19.5;
const fac_bridge: PropArt = {
  overhead: true,
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const a0 = 0.32;
    const a1 = W - 0.32;
    const WHITE: Ramp = ['#6e6a66', '#8e8a84', '#aeaaa2', '#c8c4ba', '#dedad0', '#f0ece2', '#fbf8f0'];
    const nS = 0.1; // the north stair's foot
    const nT = 1.42; // its top, the north abutment's face over the water
    const tB = 3.32; // the trestle
    const sF = D - 0.12; // the south stair's foot on the towpath
    const tread: Mat = (light) => (_u, v, x, y) => at(STONE, (light === 2 ? 4.2 : light ? 3.2 : 2) - (hash(x, y, 3) < 0.06 ? 1 : 0) - (v < 1 && light === 2 ? 0.8 : 0));
    const brk = brick(BRICK, { soot: 0.1 });
    // the shadow of the deck on the water
    p.c.globalAlpha = 0.38;
    poly(p, [[a0 + 0.3, nT + 0.2, WZ], [a1 + 0.5, nT + 0.2, WZ], [a1 + 0.5, tB + 0.5, WZ], [a0 + 0.3, tB + 0.5, WZ]], '#08100c');
    p.c.globalAlpha = 1;
    // the north stair: a brick abutment on the wharf, steps rising toward the water, its face down to the water
    const nSteps = 10;
    for (let i = 0; i < nSteps; i++) {
      const b = nS + ((nT - nS) * i) / nSteps;
      const z1 = (DZ * (i + 1)) / nSteps;
      lbox(p, a0 - 0.08, b, a1 - a0 + 0.16, (nT - nS) / nSteps + 0.001, 0, z1, { front: tread, side: brk, top: tread, edge: BRICK[0] });
    }
    lbox(p, a0 - 0.08, nT, a1 - a0 + 0.16, 0.06, WZ, DZ - WZ, { front: brk, side: brk, top: tread, edge: BRICK[0] });
    // stone copings on the abutment's side walls
    for (const a of [a0 - 0.12, a1 + 0.04]) for (let i = 0; i < nSteps; i++) {
      const b = nS + ((nT - nS) * i) / nSteps;
      lbox(p, a, b, 0.08, (nT - nS) / nSteps + 0.001, (DZ * (i + 1)) / nSteps, 0.8, mono(tread, STONE[0]));
    }
    // the trestle: two steel columns on concrete footings at the water, a cross head, diagonal braces
    for (const a of [a0 + 0.04, a1 - 0.12]) {
      lbox(p, a - 0.04, tB - 0.04, 0.16, 0.16, WZ, 1.6, mono(flat(['#4e4a44', '#6a6458', '#857c70', '#978d80', '#a69b8c'], 3, 2, 4), '#3a3632'));
      lbox(p, a, tB, 0.08, 0.08, WZ + 1.6, DZ - 3 - WZ - 1.6, mono(flat(WHITE, 4, 2.4, 5), WHITE[0]));
    }
    {
      const F = front(p, tB + 0.081);
      const [x0, y0] = F.F(a0 + 0.1, WZ + 2);
      const [x1, y1] = F.F(a1 - 0.1, DZ - 4);
      const [x2, y2] = F.F(a0 + 0.1, DZ - 4);
      const [x3, y3] = F.F(a1 - 0.1, WZ + 2);
      ln(p.c, x0, y0, x1, y1, WHITE[2], 2);
      ln(p.c, x2, y2, x3, y3, WHITE[2], 2);
      lbox(p, a0 - 0.02, tB - 0.02, a1 - a0 + 0.04, 0.12, DZ - 4, 1.2, mono(flat(WHITE, 4, 2.4, 5), WHITE[0]));
    }
    // the main span: cross girders and plank deck from the abutment to the trestle, plate girders each side
    const deckTop: Mat = (light) => (u, v, x, y) => at(OLDWOOD, (light === 2 ? 4 : 3) + (v % 7 < 1.2 ? -1.6 : 0) + (hash(Math.floor(v / 7), Math.floor(u / 40), 4) - 0.5) - (hash(x, y, 5) < 0.04 ? 1 : 0));
    lbox(p, a0, nT - 0.02, a1 - a0, tB - nT + 0.14, DZ - 0.6, 0.6, { front: flat(IRON, 2, 1), side: flat(IRON, 2, 1), top: deckTop, edge: IRON[0] });
    const plate: Mat = (light, _w, h) => (u, v) => {
      let i = light === 2 ? 5 : light ? 4 : 2.6;
      if (u % 18 < 1.4) i -= 1.2; // web stiffeners
      if (v > h - 1.5) i += 1;
      if (v < 2) i -= 0.8;
      if (u % 6 < 1 && (v < 3 || v > h - 3)) i -= 1.4; // rivets
      return at(WHITE, i);
    };
    const gz0 = DZ - 4;
    const gz1 = DZ + 1.4;
    lbox(p, a0 - 0.1, nT - 0.04, 0.08, tB - nT + 0.18, gz0, gz1 - gz0, { front: plate, side: plate, top: flat(WHITE, 5, 4, 5.4), edge: WHITE[0] });
    // the south stair: steel stringers from the trestle down to a stone landing on the towpath
    const sSteps = 14;
    const sb0 = tB + 0.12;
    for (let i = 0; i < sSteps; i++) {
      const b = sb0 + ((sF - sb0) * i) / sSteps;
      const z = DZ - (DZ - 1) * ((i + 1) / sSteps);
      lbox(p, a0 + 0.04, b, a1 - a0 - 0.08, (sF - sb0) / sSteps + 0.004, z, 0.5, { front: flat(IRON, 3, 2), side: flat(IRON, 2, 1), top: (light) => (u, v) => at(IRON, (light === 2 ? 4 : 3) - ((u + v) % 4 < 1 ? 1 : 0)), edge: IRON[0] });
    }
    lbox(p, a0 - 0.06, sF - 0.62, a1 - a0 + 0.12, 0.62, 0, 1.1, { front: tread, side: tread, top: tread, edge: STONE[0] });
    // the stringers (far one first), white like the girders
    const stringer = (a: number) => {
      poly(p, [[a, sb0, DZ - 0.2], [a, sF - 0.3, 1], [a, sF - 0.3, -1.4], [a, sb0, DZ - 2.8]], WHITE[a > W / 2 ? 2 : 1]);
      line3(p, [a, sb0, DZ - 0.2], [a, sF - 0.3, 1], WHITE[5]);
    };
    stringer(a0 + 0.02);
    // railings: posts and rails up the north stair, along the deck, down the south stair
    const railZ = 10;
    const rail = (a: number, col: string, hi: string) => {
      const path: V3[] = [[a, nS + 0.05, railZ * 0.6], [a, nT, DZ + railZ], [a, tB + 0.1, DZ + railZ], [a, sF - 0.35, 1 + railZ]];
      for (let i = 0; i + 1 < path.length; i++) {
        line3(p, path[i], path[i + 1], col, 2);
        line3(p, [path[i][0], path[i][1], path[i][2] + 0.3], [path[i + 1][0], path[i + 1][1], path[i + 1][2] + 0.3], hi);
        line3(p, [path[i][0], path[i][1], path[i][2] - railZ * 0.5], [path[i + 1][0], path[i + 1][1], path[i + 1][2] - railZ * 0.5], col);
      }
      const zAt = (b: number) => (b < nT ? DZ * Math.max(0, (b - nS) / (nT - nS)) : b < tB + 0.1 ? DZ : DZ - (DZ - 1) * Math.min(1, (b - tB - 0.1) / (sF - 0.35 - tB - 0.1)));
      for (let b = nS + 0.2; b < sF - 0.3; b += 0.36) {
        const z = b < nT ? zAt(b) : zAt(b);
        const top = b < nT ? Math.max(railZ * 0.6, z + railZ) : z + railZ;
        line3(p, [a, b, Math.max(0, z)], [a, b, top], col);
      }
    };
    rail(a0 - 0.06, WHITE[2], WHITE[4]);
    // the near girder over the lane, its plate and number; the near stringer and railing
    lbox(p, a1 + 0.02, nT - 0.04, 0.08, tB - nT + 0.18, gz0, gz1 - gz0, { front: plate, side: plate, top: flat(WHITE, 5, 4, 5.4), edge: WHITE[0] });
    const S = side(p, a1 + 0.101);
    pq(p, S, nT + 0.5, nT + 1.4, gz0 + 1.2, gz1 - 1.2, '#1e2a3a');
    planeText(p.c, S, nT + 0.95, (gz0 + gz1) / 2, 'BRIDGE 3', '#e8e2d0', 1);
    stringer(a1 - 0.02);
    rail(a1 + 0.06, WHITE[3], WHITE[6]);
    // the lamp on the deck by the north end of the near railing
    const [lx, ly] = p.P(a1 + 0.06, nT + 0.15, DZ);
    px(p.c, lx - 1, ly - 34, '#2a2a30', 3, 34);
    px(p.c, lx, ly - 34, '#5a5a64', 1, 34);
    px(p.c, lx - 5, ly - 44, '#1e1e24', 11, 3);
    px(p.c, lx - 4, ly - 41, '#ffe6a0', 9, 7);
    px(p.c, lx - 3, ly - 40, '#fff8e0', 3, 3);
    px(p.c, lx - 5, ly - 34, '#1e1e24', 11, 2);
    void k;
    void darken;
  },
  lights: (k) => [{ a: k.w - 0.26, b: 1.57, z: DZ + 10, r: 2.4, kind: 'lamp' } as PropLight],
};

export const FACTORY_BOATS: Record<string, PropArt> = { fac_barge, fac_bridge };

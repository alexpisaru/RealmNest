// Creative Studio — the boardwalk, the pier and the boats (1 z ≈ 10 cm).
//   std_pier       a timber pier on piles (a ramp up from the boardwalk, X-braces,
//                  railings, lamps, benches, lifebuoys, an angler's kit, crab pots,
//                  a bait-and-gelato kiosk at the end, a ladder to the water)
//   std_festoon    a span of festoon bulbs (or bunting) between two posts
//   std_lamp       a boardwalk lamp: a ship's lantern on a teal post
//   std_bench      a painted slatted bench with a plaque
//   std_surfRack   an A-frame rack of rental surfboards
//   std_picnic     a picnic table with lunch on it
//   std_signpost   arrows to the pier, the beach and the studios
//   std_planter    a timber planter of grasses and agave
//   std_pleinAir   a painter's field easel set up facing the sea
import type { FaceTex, Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropLight } from '../../../props';
import { at, contactShadow, ell, fillPoly, foliage, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front3, pq, pt, side3 } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { marramTuft } from './beach';
import { painting } from './gear';
import { coastX } from './ground';
import { ROOFC, roofOf } from './houses';
import { ALU, coat, CORAL, CREAM, darken, DRIFT, GEAR, LEAF, lighten, MUSTARD, PINE, pine, solidFaces, SKY, TEAL, weathered, pmod } from './kit';
import { agave } from './lounge';

type V3 = [number, number, number];

// ── the pier ────────────────────────────────────────────────
// warm sun-bleached timber of the pier (the reference's #b3967b / #8f7d68)
const TIMBER: Ramp = ['#3e2c1e', '#5a4230', '#76583e', '#927052', '#b3967b', '#cbb294', '#e0ccae'];
const pier: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = p.c;
    const b0 = 0.25;
    const b1 = D - 0.25;
    const ramp = 3;
    const dz = (a: number) => (a < ramp ? 1 + (a / ramp) * 6.2 : 7.2);
    const wet = (a: number, b: number) => p.x + a >= coastX(p.y + b) - 0.2;
    const pileW = 9;
    /** A round pile from the ground up to the deck at (a, b). */
    const pile = (l: CanvasRenderingContext2D, a: number, b: number) => {
      const z1 = dz(a) - 0.8;
      if (z1 <= 0.4) return;
      const [x, y] = p.P(a, b, 0);
      const h = Math.round(z1 * 4);
      const inWater = wet(a, b);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < pileW; i++) {
          const t = i / (pileW - 1);
          let tone = t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1;
          if (hash(x + i, Math.floor((y - j) / 3), 3) < 0.12) tone -= 1;
          let col = TIMBER[Math.max(0, tone)];
          if (j < (inWater ? 7 : 3)) col = inWater ? ['#24382a', '#2e4a30', '#3a5a36', '#2a4028'][(i + j) % 4] : TIMBER[Math.max(0, tone - 2)];
          if (inWater && j >= 7 && j < 10 && hash(i, j, Math.round(a * 9)) < 0.5) col = '#d8d2c0';
          px(l, x - 4 + i, y - j, col);
        }
      }
      if (inWater) for (let i = -6; i <= 6; i += 2) px(l, x + i, y + (Math.abs(i) > 3 ? 1 : 0), '#e8f6f6', 2, 1);
    };
    const piles: number[] = [];
    for (let a = 0.6; a < W - 0.2; a += 1.6) piles.push(a);
    footShadow(p, 0, 0.2, W, D, 10, 0.29);
    // the back row of piles and their braces, then the front row
    layer(c, (l) => {
      for (const a of piles) pile(l, a, b0 + 0.08);
    }, { outline: 0.5 });
    layer(c, (l) => {
      for (let i = 0; i + 1 < piles.length; i++) {
        const a0 = piles[i];
        const a1 = piles[i + 1];
        if (dz(a0) < 3) continue;
        for (const b of [b1 - 0.08]) {
          const q0 = p.P(a0, b, 0.6);
          const q1 = p.P(a1, b, dz(a1) - 1.4);
          const q2 = p.P(a1, b, 0.6);
          const q3 = p.P(a0, b, dz(a0) - 1.4);
          ln(l, q0[0], q0[1], q1[0], q1[1], TIMBER[2], 3);
          ln(l, q2[0], q2[1], q3[0], q3[1], TIMBER[3], 3);
        }
      }
      for (const a of piles) pile(l, a, b1 - 0.08);
    }, { outline: 0.5 });
    // the deck: the ramp, then the level run; boards across the pier
    const boards = (light: 0 | 1 | 2): FaceTex => (u, v, x, y) => {
      const f = u % 9;
      if (f < 1.2) return '#2e2620';
      let i = (light === 2 ? 4 : light ? 3 : 1.6) + (hash(Math.floor(u / 9), 3, 7) - 0.5) * 1.2;
      if (hash(Math.floor(u / 9), Math.floor(v / 22), 8) < 0.08) i -= 1;
      if (hash(x, y, 9) < 0.04) i -= 0.7;
      return at(TIMBER, i);
    };
    const F = front3(p, b1);
    const z7 = 7.2;
    // front edge (fascia) of the deck
    for (const [aa, ab] of [[0, ramp], [ramp, W]] as const) {
      const za = dz(aa);
      const zb = dz(ab - 0.001);
      fillPoly(c, [p.P(aa, b1, za - 0.9), p.P(ab, b1, zb - 0.9), p.P(ab, b1, zb), p.P(aa, b1, za)], TIMBER[F.light ? 3 : 2]);
      const e0 = p.P(aa, b1, za - 0.9);
      const e1 = p.P(ab, b1, zb - 0.9);
      ln(c, e0[0], e0[1], e1[0], e1[1], TIMBER[1]);
    }
    // the end of the pier
    const Sd = side3(p, p.rot === 0 ? W : 0);
    pq(p, Sd, b0, b1, z7 - 0.9, z7, TIMBER[Sd.light ? 3 : 1]);
    pt(p, F, 0, 0.01, 0, 0.01, boards(1));
    // the deck tops
    const top: Mat = () => boards(2);
    const rampPts: V3[] = [[0, b1, dz(0)], [ramp, b1, z7], [ramp, b0, z7], [0, b0, dz(0)]];
    const runPts: V3[] = [[ramp, b1, z7], [W, b1, z7], [W, b0, z7], [ramp, b0, z7]];
    solidFaces(p, [rampPts], () => top, true);
    solidFaces(p, [runPts], () => top, true);
    // the back railing: posts and two rails following the deck
    const railH = 4.4;
    const rail = (l: CanvasRenderingContext2D, b: number, lit: boolean) => {
      for (let a = 0.15; a < W - 0.05; a += 0.8) {
        const z = dz(a);
        const [x, y] = p.P(a, b, z);
        px(l, x - 1, y - railH * 4, ALU[lit ? 4 : 2], 3, railH * 4);
        px(l, x - 1, y - railH * 4, ALU[6], 1, railH * 4);
      }
      for (const dzr of [railH, railH * 0.5]) {
        let prev: [number, number] | null = null;
        for (let a = 0.15; a <= W - 0.05; a += 0.4) {
          const q = p.P(a, b, dz(a) + dzr);
          if (prev) ln(l, prev[0], prev[1], q[0], q[1], ALU[dzr === railH ? 5 : 3], dzr === railH ? 2 : 1);
          prev = q;
        }
      }
    };
    layer(c, (l) => rail(l, b0 + 0.1, false), { outline: 0.5 });
    // lamps, benches, crab pots and the kiosk at the end
    const lamp = (l: CanvasRenderingContext2D, a: number, b: number) => {
      const z = dz(a);
      const [x, y] = p.P(a, b, z);
      px(l, x - 2, y - 66, NAVY[2], 4, 66);
      px(l, x - 2, y - 66, NAVY[4], 1, 66);
      px(l, x - 4, y - 4, NAVY[1], 8, 4);
      ln(l, x, y - 60, x - 10, y - 64, NAVY[2], 2);
      ln(l, x, y - 60, x + 10, y - 64, NAVY[2], 2);
      for (const dx of [-10, 10]) {
        ell(l, x + dx, y - 70, 6, 7, '#fff4c8');
        ell(l, x + dx - 1, y - 72, 2, 2, '#ffffff');
        px(l, x + dx - 1, y - 77, NAVY[1], 3, 2);
      }
      ell(l, x, y - 72, 3, 3, NAVY[3]);
    };
    const kioskA = W - 2.7;
    layer(c, (l) => {
      for (let a = 1.6; a < kioskA - 0.6; a += 4.8) lamp(l, a, b0 + 0.12);
      for (let a = 4; a < kioskA - 1; a += 5.6) {
        // a bench against the back rail, facing the sea
        const z = dz(a);
        const q0 = p.P(a - 0.5, b0 + 0.35, z + 2.2);
        const q1 = p.P(a + 0.5, b0 + 0.35, z + 2.2);
        const q2 = p.P(a + 0.5, b0 + 0.6, z + 2.2);
        const q3 = p.P(a - 0.5, b0 + 0.6, z + 2.2);
        fillPoly(l, [q0, q1, q2, q3], PINE[4]);
        ln(l, q3[0], q3[1], q2[0], q2[1], PINE[2], 2);
        const k0 = p.P(a - 0.5, b0 + 0.32, z + 5);
        const k1 = p.P(a + 0.5, b0 + 0.32, z + 5);
        ln(l, k0[0], k0[1], k1[0], k1[1], PINE[3], 3);
        for (const aa of [a - 0.45, a + 0.45]) {
          const f = p.P(aa, b0 + 0.55, z);
          ln(l, f[0], f[1], f[0], f[1] - 9, GEAR[2], 2);
        }
      }
      // crab pots stacked and a coil of rope
      const az = Math.max(4, kioskA - 1.4);
      const [cx, cy] = p.P(az, b0 + 0.6, z7);
      for (let i = 0; i < 3; i++) {
        const ox = (i % 2) * 12;
        const oy = -Math.floor(i / 2) * 9;
        px(l, cx - 8 + ox, cy - 8 + oy, '#3a5a5a', 14, 9);
        for (let j = 0; j < 14; j += 3) px(l, cx - 8 + ox + j, cy - 8 + oy, '#8ab0a8', 1, 9);
        px(l, cx - 8 + ox, cy - 9 + oy, '#c86a3a', 14, 1);
      }
      const [rx, ry] = p.P(az + 0.7, b1 - 0.5, z7);
      for (let r = 6; r > 1; r -= 1.5) ell(l, rx, ry - 2, r, r * 0.5, r % 3 < 1.5 ? '#c8b088' : '#a8905e');
    }, { outline: 0.55 });
    // the kiosk: a little white hut with a tin roof, a hatch and an awning, a flag
    const ka0 = kioskA;
    const ka1 = W - 0.4;
    const kb0 = b0 + 0.3;
    const kb1 = b1 - 0.55;
    const kz = z7;
    const kw: Mat = (light) => (_u, v, x, y) => {
      const f = v % 8;
      let i = (light ? 3.6 : 2.2) + (f < 1.2 ? -1.6 : f > 6.4 ? 0.6 : 0);
      if (hash(x, y, 4) < 0.03) i -= 0.6;
      return at(CREAM, i);
    };
    lbox(p, ka0, kb0, ka1 - ka0, kb1 - kb0, kz, 16, { front: kw, side: kw, top: kw, edge: CREAM[0] });
    const KF = front3(p, kb1);
    pq(p, KF, ka0 + 0.35, ka1 - 0.35, kz + 6.5, kz + 12.5, '#2a2226');
    pq(p, KF, ka0 + 0.35, ka1 - 0.35, kz + 6.5, kz + 7.4, PINE[KF.light ? 4 : 2]);
    for (let i = 0; i < 4; i++) {
      const u = ka0 + 0.5 + i * ((ka1 - ka0 - 1) / 3);
      pq(p, KF, u - 0.05, u + 0.05, kz + 7.4, kz + 9.4, ['#f2c84a', '#e0603e', '#7ac7bb', '#f0a6c0'][i]);
    }
    for (let u = ka0 + 0.25; u < ka1 - 0.25; u += 0.24) {
      const q0 = KF.F(u, kz + 13.5);
      const q1 = KF.F(u + 0.24, kz + 13.5);
      fillPoly(c, [q0, q1, [q1[0] - 12, q1[1] + 9], [q0[0] - 12, q0[1] + 9]], Math.floor((u - ka0) / 0.24) % 2 ? '#f6eedc' : '#2a8ab8');
    }
    const kam = (ka0 + ka1) / 2;
    const kbm = (kb0 + kb1) / 2;
    const ke = kz + 16;
    const kr = ke + 5;
    solidFaces(p, [
      [[ka0 - 0.15, kb0 - 0.15, ke], [ka1 + 0.15, kb0 - 0.15, ke], [ka1 + 0.15, kbm, kr], [ka0 - 0.15, kbm, kr]],
      [[ka0 - 0.15, kb1 + 0.15, ke], [ka1 + 0.15, kb1 + 0.15, ke], [ka1 + 0.15, kbm, kr], [ka0 - 0.15, kbm, kr]],
    ], (s) => roofOf(ROOFC[0], true, s), false);
    const [fx, fy] = p.P(kam, kbm, kr);
    layer(c, (l) => {
      px(l, fx - 1, fy - 30, ALU[4], 2, 30);
      fillPoly(l, [[fx + 1, fy - 30], [fx + 16, fy - 27], [fx + 1, fy - 22]], '#e0402a');
      fillPoly(l, [[fx + 1, fy - 26], [fx + 16, fy - 25], [fx + 1, fy - 22]], '#fbf6ee');
    }, { outline: 0.5 });
    // the front railing, lifebuoys, an angler's rod and bucket, gulls on the posts
    layer(c, (l) => {
      rail(l, b1 - 0.1, true);
      for (let a = 2.4; a < kioskA - 0.5; a += 3.2) {
        const [lx, ly] = p.P(a, b1 - 0.06, dz(a) + 2.6);
        ell(l, lx, ly, 6, 6, '#e8502a');
        ell(l, lx, ly, 2.6, 2.6, TIMBER[2]);
        for (let i = 0; i < 4; i++) {
          const t = (i / 4) * Math.PI * 2 + 0.4;
          px(l, lx + Math.cos(t) * 4.4 - 1, ly + Math.sin(t) * 4.4 - 1, '#fbf6ee', 3, 2);
        }
      }
      for (let a = 1.6 + 2.4; a < kioskA - 0.6; a += 4.8) lamp(l, a, b1 - 0.12);
      const ra = Math.min(W - 3.5, 8.6);
      const [rx, ry] = p.P(ra, b1 - 0.1, z7);
      ln(l, rx, ry, rx + 42, ry - 70, '#3a3036', 1);
      ln(l, rx, ry, rx + 12, ry - 20, '#8a5a3a', 2);
      ln(l, rx + 42, ry - 70, rx + 64, ry + 40, '#d8e6ea');
      const [bx, by] = p.P(ra - 0.3, b1 - 0.45, z7);
      fillPoly(l, [[bx - 5, by - 9], [bx + 5, by - 9], [bx + 4, by], [bx - 4, by]], '#e8b03e');
      px(l, bx - 5, by - 10, '#f6d070', 10, 2);
      for (let a = 5.55; a < W - 3; a += 7.2) {
        const [gx, gy] = p.P(a, b1 - 0.1, dz(a) + railH);
        px(l, gx - 3, gy - 6, '#f6f6f2', 7, 5);
        px(l, gx - 3, gy - 6, '#9aa0aa', 5, 2);
        px(l, gx + 3, gy - 8, '#f6f6f2', 3, 3);
        px(l, gx + 6, gy - 7, '#f2c84a', 2, 1);
        px(l, gx - 1, gy - 1, '#e8a080', 1, 2);
      }
      // a ladder down to the water at the end
      const [lx, ly] = p.P(W - 0.25, b1 - 0.02, z7);
      const [, ly2] = p.P(W - 0.25, b1 - 0.02, 0);
      px(l, lx - 5, ly, ALU[3], 1, ly2 - ly);
      px(l, lx + 4, ly, ALU[3], 1, ly2 - ly);
      for (let yy = ly + 4; yy < ly2; yy += 5) px(l, lx - 5, yy, ALU[4], 10, 1);
    }, { outline: 0.5 });
  },
};

pier.lights = (k) => {
  const out: PropLight[] = [];
  const kioskA = k.w - 2.7;
  for (let a = 1.6; a < kioskA - 0.6; a += 4.8) out.push({ a, b: 0.37, z: 25, r: 1.4, kind: 'lamp', color: '#ffe6b0' });
  for (let a = 4; a < kioskA - 0.6; a += 4.8) out.push({ a, b: k.d - 0.37, z: 25, r: 1.4, kind: 'lamp', color: '#ffe6b0' });
  out.push({ a: k.w - 1.5, b: k.d - 0.6, z: 17, r: 0.8, kind: 'window', color: '#ffd68a' });
  return out;
};

// ── boats ───────────────────────────────────────────────────
const teak: Mat = () => (u, v, x, y) => {
  if (v % 6 < 1) return '#d8ccb8';
  return hash(Math.floor(u / 14), Math.floor(v / 6), 3) < 0.3 ? '#a87a4a' : hash(x, y, 4) < 0.05 ? '#8a5e34' : '#b88a56';
};


// ── the water taxi (a moving vehicle: double-ended, so it reads the same both ways) ──
const ferry: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    const bc = 0.5;
    const beam = 0.62;
    const fb = 3.4;
    const [sx, sy] = p.P(W / 2, bc, 0);
    c.globalAlpha = 0.32;
    ell(c, sx + 10, sy + 4, W * 30, 16, '#062a48');
    c.globalAlpha = 1;
    // a symmetric hull, pointed at both ends: white topsides, a turquoise sheer stripe, red antifouling
    const N = 12;
    const hb = (t: number) => (beam / 2) * Math.max(0.1, Math.pow(Math.sin(Math.PI * t), 0.55));
    const Dk: [V3, V3][] = [];
    const Wl: [V3, V3][] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const tw = 0.04 + t * 0.92;
      Dk.push([[0.1 + t * (W - 0.2), bc + hb(t), fb], [0.1 + t * (W - 0.2), bc - hb(t), fb]]);
      Wl.push([[0.1 + tw * (W - 0.2), bc + hb(tw) * 0.8, 0], [0.1 + tw * (W - 0.2), bc - hb(tw) * 0.8, 0]]);
    }
    const faces: V3[][] = [];
    for (let i = 0; i < N; i++) {
      faces.push([Wl[i][0], Wl[i + 1][0], Dk[i + 1][0], Dk[i][0]]);
      faces.push([Wl[i][1], Wl[i + 1][1], Dk[i + 1][1], Dk[i][1]]);
    }
    faces.push([...Dk.map((q) => q[0]), ...Dk.slice().reverse().map((q) => q[1])]);
    const H: Ramp = ['#8a8680', '#a8a49c', '#c4c0b6', '#dad6cc', '#eae6dc', '#f6f2ea', '#fffcf6'];
    solidFaces(p, faces, (sh, fi) => {
      if (fi === faces.length - 1) return teak;
      const base = H[Math.round(Math.min(6, Math.max(0, sh)))];
      return (_l: 0 | 1 | 2, _w: number, h: number) => (_u: number, v: number) => (v < 2.2 ? '#b8302a' : v / h > 0.58 && v / h < 0.76 ? '#1e8a90' : base);
    }, false);
    for (let i = 0; i < N; i++) {
      const q0 = p.P(...Dk[i][0]);
      const q1 = p.P(...Dk[i + 1][0]);
      ln(c, q0[0], q0[1], q1[0], q1[1], '#ffffff');
    }
    // the cabin amidships: white sides, a band of windows, a turquoise canopy roof
    const ca0 = W * 0.3;
    const ca1 = W * 0.7;
    const cab: Mat = (light) => (u, v) => {
      if (v > 8 && v < 18) return (u + v) % 22 < 3 ? '#d8eef4' : u % 18 < 2 ? '#f6f2ea' : light ? '#2e5468' : '#22404e';
      return light ? '#f6f2ea' : '#d8d4cc';
    };
    lbox(p, ca0, bc - 0.2, ca1 - ca0, 0.4, fb, 6.4, { front: cab, side: cab, top: () => () => '#e8e4dc', edge: '#8a8680' });
    lbox(p, ca0 - 0.12, bc - 0.27, ca1 - ca0 + 0.24, 0.54, fb + 6.4, 0.9, { front: (l) => () => (l ? '#2aa4a6' : '#1e8a90'), side: (l) => () => (l ? '#2aa4a6' : '#167078'), top: () => (u: number) => (u % 12 < 6 ? '#46bcba' : '#f6f2ea'), edge: '#0c4048' });
    layer(c, (l) => {
      // a lifebuoy on the cabin side, a little flag on a staff at each end
      const [lx, ly] = p.P(W / 2, bc + 0.21, fb + 3.2);
      ell(l, lx, ly, 5, 5, '#e8402a');
      ell(l, lx, ly, 2, 2, '#22404e');
      for (let i = 0; i < 4; i++) px(l, lx + Math.cos(i * 1.57 + 0.4) * 3.6 - 1, ly + Math.sin(i * 1.57 + 0.4) * 3.6 - 1, '#fbf6ee', 2, 2);
      for (const a of [0.35, W - 0.35]) {
        const [fx, fy] = p.P(a, bc, fb);
        px(l, fx, fy - 18, '#2a2a30', 1, 18);
        fillPoly(l, [[fx + 1, fy - 18], [fx + 9, fy - 16], [fx + 1, fy - 13]], '#f3ba4f');
      }
    }, { outline: 0.5 });
  },
};

// ── the gelato truck ────────────────────────────────────────

// ── festoon spans, lamps, benches ───────────────────────────
const festoon: PropArt = {
  draw(p, k) {
    const W = k.w;
    const flags = k.variant === 'flags';
    const Rn = rng(k.seed * 3 + 1);
    layer(p.c, (l) => {
      const tops: [number, number][] = [];
      for (const a of [0.12, W - 0.12]) {
        const [x, y] = p.P(a, 0.5, 0);
        contactShadow(l, x + 6, y + 2, 7, 3, 0.32);
        px(l, x - 2, y - 76, CREAM[4], 5, 76);
        px(l, x - 2, y - 76, CREAM[6], 1, 76);
        px(l, x + 2, y - 76, CREAM[2], 1, 76);
        px(l, x - 3, y - 79, TEAL[3], 7, 3);
        tops.push([x, y - 72]);
      }
      const [x0, y0] = tops[0];
      const [x1, y1] = tops[1];
      const n = Math.round(W * 6);
      let prev: [number, number] = [x0, y0];
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 18;
        ln(l, prev[0], prev[1], x, y, '#3a3036');
        prev = [x, y];
        if (i === n) break;
        if (flags) {
          const col = ['#e0402a', '#f2c84a', '#2a8ab8', '#f6eedc', '#2a8a86', '#f06aa0'][Math.floor(Rn() * 6)];
          fillPoly(l, [[x - 3, y], [x + 3, y], [x, y + 8]], col);
        } else {
          px(l, x, y + 1, '#3a3036', 1, 2);
          ell(l, x, y + 4, 2, 2.4, i % 3 === 0 ? '#ffd27a' : '#fff0c0');
          px(l, x - 1, y + 3, '#ffffff');
        }
      }
    }, { outline: 0.5 });
  },
};

const NAVY: Ramp = ['#0e1424', '#162036', '#1e2c4a', '#2a3c60', '#3c5280', '#5a72a0'];
const lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 11, 4, 0.46);
    layer(p.c, (l) => {
      // a cast-iron post: a stepped foot, a fluted shaft with collars, a lantern with a dome
      fillPoly(l, [[x - 7, y], [x + 7, y], [x + 5, y - 8], [x - 5, y - 8]], NAVY[2]);
      px(l, x - 7, y - 2, NAVY[1], 14, 2);
      px(l, x - 5, y - 8, NAVY[4], 2, 8);
      px(l, x - 4, y - 14, NAVY[2], 8, 6);
      px(l, x - 4, y - 14, NAVY[4], 1, 6);
      px(l, x - 2, y - 92, NAVY[2], 5, 80);
      px(l, x - 2, y - 92, NAVY[5], 1, 80);
      px(l, x + 2, y - 92, NAVY[0], 1, 80);
      for (const z of [30, 62, 88]) {
        px(l, x - 3, y - z, NAVY[3], 7, 2);
        px(l, x - 3, y - z, NAVY[5], 7, 1);
      }
      fillPoly(l, [[x - 7, y - 94], [x + 7, y - 94], [x + 6, y - 110], [x - 6, y - 110]], NAVY[1]);
      fillPoly(l, [[x - 5, y - 96], [x + 5, y - 96], [x + 4, y - 108], [x - 4, y - 108]], '#fff4c8');
      px(l, x - 3, y - 106, '#ffffff', 2, 8);
      px(l, x, y - 108, NAVY[1], 1, 12);
      fillPoly(l, [[x - 9, y - 110], [x + 9, y - 110], [x + 4, y - 116], [x - 4, y - 116]], NAVY[2]);
      px(l, x - 9, y - 111, NAVY[4], 18, 1);
      ell(l, x, y - 118, 2, 2, '#e8c46a');
      if (k.variant === 'banner') {
        // a festival banner on an arm: pink and teal with a little sun
        px(l, x + 2, y - 84, NAVY[2], 14, 2);
        const col = ['#e0408a', '#1e8a90', '#f3ba4f', '#6d5aa2'][pmod(p.x * 3 + p.y, 4)];
        fillPoly(l, [[x + 6, y - 82], [x + 15, y - 80], [x + 15, y - 56], [x + 6, y - 58]], col);
        px(l, x + 6, y - 82, lighten(col, 0.3), 1, 24);
        ell(l, x + 10.5, y - 70, 2.5, 2.5, '#fff0b0');
        px(l, x + 7, y - 61, '#fbf6ee', 7, 1);
      } else {
        // a lifebuoy on the post
        ell(l, x + 1, y - 46, 7, 7, '#e8402a');
        ell(l, x + 1, y - 46, 3, 3, NAVY[2]);
        for (let i = 0; i < 4; i++) {
          const t = (i / 4) * Math.PI * 2 + 0.4;
          px(l, x + 1 + Math.cos(t) * 5 - 1, y - 46 + Math.sin(t) * 5 - 1, '#fbf6ee', 3, 2);
        }
      }
    }, { outline: 0.6 });
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 26, r: 1.6, kind: 'lamp', color: '#ffe2a0' }],
};

const bench: PropArt = {
  draw(p, k) {
    const W = k.w;
    const col = [TEAL, CORAL, SKY, MUSTARD][pmod(k.seed + p.x + p.y, 4)];
    footShadow(p, 0.08, 0.25, W - 0.08, 0.8, 6, 0.35);
    const paintM = coat(col);
    for (const a of [0.14, W - 0.2]) {
      lbox(p, a, 0.3, 0.06, 0.45, 0, 4.2, mono(paintM, col[0]));
      lbox(p, a, 0.2, 0.06, 0.08, 0, 9, mono(paintM, col[0]));
      lbox(p, a, 0.3, 0.06, 0.5, 5.6, 0.5, mono(paintM, col[0]));
    }
    for (let i = 0; i < 4; i++) lbox(p, 0.08, 0.3 + i * 0.11, W - 0.16, 0.09, 4.2, 0.45, mono(paintM, col[0]));
    for (let i = 0; i < 3; i++) lbox(p, 0.08, 0.2, W - 0.16, 0.05, 5.6 + i * 1.2, 0.8, mono(paintM, col[0]));
    const F = front3(p, 0.25);
    pq(p, F, W / 2 - 0.15, W / 2 + 0.15, 7, 7.8, '#c89a42');
    pq(p, F, W / 2 - 0.12, W / 2 + 0.12, 7.2, 7.6, '#e8c46a');
    // an ice-cream cup or a newspaper left on the seat
    const [nx, ny] = anchor(p, W * (0.3 + hash(k.seed, 1, 3) * 0.4), 0.48, 4.7);
    if (hash(k.seed, 2, 3) < 0.5) {
      px(p.c, nx - 5, ny - 3, '#ece6d8', 10, 4);
      px(p.c, nx - 4, ny - 2, '#3a3a40', 7, 1);
    } else {
      px(p.c, nx - 2, ny - 5, '#f6f2ea', 5, 5);
      px(p.c, nx - 2, ny - 7, '#f0a6c0', 5, 3);
    }
  },
};

// ── the surf rack ───────────────────────────────────────────
const surfRack: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.05, 0.2, W - 0.05, 0.8, 14, 0.35);
    const wood = pine(PINE);
    for (const a of [0.1, W - 0.16]) lbox(p, a, 0.3, 0.06, 0.4, 0, 9, mono(wood, PINE[0]));
    lbox(p, 0.1, 0.4, W - 0.2, 0.2, 0.6, 0.6, mono(wood, PINE[0]));
    const Rn = rng(k.seed * 5 + 3);
    const n = Math.round(W * 3);
    for (let i = 0; i < n; i++) {
      const a = 0.25 + (i * (W - 0.5)) / (n - 1);
      const col = ['#f6eedc', '#7ac7bb', '#f2c84a', '#e06a4a', '#9ad0e8', '#f0a6c0', '#2a5a9a'][Math.floor(Rn() * 7)];
      const h = 19 + Rn() * 9;
      const [x0, y0] = p.P(a, 0.5, 1);
      const [x1, y1] = p.P(a - 0.03, 0.42, h);
      layer(c, (l) => {
        const m = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let j = 0; j <= m; j++) {
          const t = j / m;
          const w = Math.round(Math.sqrt(Math.max(0, Math.sin(Math.min(1, t * 1.06 + 0.04) * Math.PI))) * 9) + 1;
          const x = x0 + (x1 - x0) * t;
          const y = y0 + (y1 - y0) * t;
          px(l, x - w, y, col, w * 2, 1);
          px(l, x - w, y, lighten(col, 0.3), 1, 1);
          px(l, x + w - 1, y, darken(col, 0.15), 1, 1);
          if (Math.abs(t - 0.5) < 0.02) px(l, x - w, y, darken(col, 0.3), w * 2, 1);
        }
      }, { outline: 0.55 });
    }
    lbox(p, 0.1, 0.32, W - 0.2, 0.08, 8.4, 0.6, mono(wood, PINE[0]));
    // a rental sign
    const F = front3(p, 0.4);
    pq(p, F, W / 2 - 0.35, W / 2 + 0.35, 4.4, 7.4, '#1e2a4a');
    for (let i = 0; i < 4; i++) pq(p, F, W / 2 - 0.25 + i * 0.13, W / 2 - 0.16 + i * 0.13, 5.4, 6.6, '#f2c84a');
  },
};

// ── picnic table, signpost, bikes, planters, a field easel ──
const picnic: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.05, 0.05, W - 0.05, 0.95, 8, 0.41);
    // a painted picnic set: the A-frame legs carry the top and both bench seats
    const col = [TEAL, CORAL, SKY, MUSTARD][pmod(k.seed + p.x * 3 + p.y, 4)];
    const painted = coat(col);
    const legs = (a: number) => {
      layer(c, (l) => {
        const f0 = p.P(a, 0.04, 0);
        const f1 = p.P(a, 0.96, 0);
        const t = p.P(a, 0.5, 7);
        ln(l, f0[0], f0[1], t[0], t[1], col[2], 3);
        ln(l, f1[0], f1[1], t[0], t[1], col[3], 3);
        ln(l, f0[0] - 1, f0[1], t[0] - 1, t[1], col[4], 1);
        const s0 = p.P(a, 0.06, 4);
        const s1 = p.P(a, 0.94, 4);
        ln(l, s0[0], s0[1], s1[0], s1[1], col[1], 2);
      }, { outline: 0.5 });
    };
    legs(0.32);
    for (const b of [0.04, 0.78]) lbox(p, 0.1, b, W - 0.2, 0.18, 4, 0.6, { front: painted, side: painted, top: coat([col[2], col[3], col[4], col[5], col[6] ?? col[5], col[6] ?? col[5]]), edge: col[0] });
    for (let i = 0; i < 3; i++) lbox(p, 0.05, 0.27 + i * 0.155, W - 0.1, 0.14, 7, 0.6, { front: painted, side: painted, top: coat([col[2], col[3], col[4], col[5], col[6] ?? col[5], col[6] ?? col[5]]), edge: col[0] });
    legs(W - 0.32);
    layer(c, (l) => {
      // lunch: a paper tray of fries, two drinks, a cone, napkins
      const [tx, ty] = p.P(W * 0.35, 0.5, 7.5);
      fillPoly(l, [[tx - 7, ty], [tx, ty - 4], [tx + 7, ty], [tx, ty + 4]], '#e8dcc4');
      for (let i = 0; i < 6; i++) px(l, tx - 4 + i * 1.6, ty - 3 - (i % 3), '#f2c84a', 1, 4);
      for (const [dx, col] of [[16, '#e0402a'], [24, '#2a8ab8']] as const) {
        const [dx2, dy2] = p.P(W * 0.35 + dx / 70, 0.42, 7.5);
        px(l, dx2 - 2, dy2 - 8, '#f6f2ea', 5, 8);
        px(l, dx2 - 2, dy2 - 5, col, 5, 2);
        px(l, dx2, dy2 - 11, '#3a3036', 1, 4);
      }
      const [cx, cy] = p.P(W * 0.7, 0.58, 7.5);
      fillPoly(l, [[cx - 3, cy - 4], [cx + 3, cy - 4], [cx, cy + 2]], '#d8a868');
      ell(l, cx, cy - 6, 3.5, 3, '#f0a6c0');
    }, { outline: 0.5 });
    void k;
  },
};

const signpost: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 3, 10, 4, 0.35);
    layer(p.c, (l) => {
      px(l, x - 2, y - 64, DRIFT[2], 5, 64);
      px(l, x - 2, y - 64, DRIFT[4], 1, 64);
      const arrows: [number, number, string][] = [[-58, 1, '#e0603e'], [-48, -1, '#2a8a86'], [-38, 1, '#f2c84a']];
      for (const [dy, dir, col] of arrows) {
        const x0 = x + (dir > 0 ? 2 : -22);
        const x1 = x0 + 20;
        fillPoly(l, [[x0, y + dy], [x1, y + dy - 4], dir > 0 ? [x1 + 5, y + dy - 1] : [x1, y + dy - 4], [x1, y + dy + 3], [x0, y + dy + 7], dir < 0 ? [x0 - 5, y + dy + 4] : [x0, y + dy + 7]], col);
        for (let i = 0; i < 3; i++) px(l, x0 + 4 + i * 5, y + dy + 1 - i * 1, '#fbf6ee', 3, 2);
      }
    }, { outline: 0.55 });
    void k;
  },
};


const BLOOMS = [['#e0408a', '#f291b6', '#c12a6a', '#fbd0e2'], ['#f2902a', '#f6c040', '#e8602a', '#fff0b0'], ['#e04040', '#f88080', '#c02a2a', '#ffe0e0']];
const planter: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.05, 0.15, W - 0.05, 0.85, 6, 0.35);
    const wood = weathered(DRIFT, 'u');
    const Rn = rng(k.seed * 7 + 1);
    if (k.variant === 'bloom') {
      // a painted planter box spilling bougainvillea / geraniums, the reference's pink blooms
      const col = [TEAL, CORAL, SKY, MUSTARD][pmod(k.seed + p.x + p.y * 3, 4)];
      lbox(p, 0.08, 0.2, W - 0.16, 0.6, 0, 5.4, { front: coat(col), side: coat(col), top: (l) => () => (l ? '#5a4030' : '#5a4030'), edge: col[0] });
      const F = front3(p, 0.8);
      pq(p, F, 0.08, W - 0.08, 4.8, 5.4, col[F.light ? 5 : 3]);
      const bl = BLOOMS[pmod(k.seed + p.x * 3 + p.y, 3)];
      layer(p.c, (l) => {
        const masses: { x: number; y: number; rx: number; ry: number; z: number }[] = [];
        for (let a = 0.3; a < W - 0.2; a += 0.42) {
          const [x, y] = p.P(a, 0.5, 5.4);
          masses.push({ x: x + (Rn() - 0.5) * 6, y: y - 9 - Rn() * 4, rx: 13 + Rn() * 4, ry: 10 + Rn() * 3, z: y });
        }
        foliage(l, masses, LEAF, k.seed + 3, { cell: 3, tilt: 0.2, dots: bl, dotChance: 0.75, dotSize: 4 });
        // trailing stems over the front edge
        for (let a = 0.25; a < W - 0.15; a += 0.3) {
          const [x, y] = p.P(a, 0.82, 5);
          px(l, x - 1, y, LEAF[3], 2, 4 + Math.round(Rn() * 4));
          px(l, x - 2, y + 4, bl[Math.floor(Rn() * 3)], 3, 3);
        }
      }, { outline: 0.55 });
      return;
    }
    lbox(p, 0.08, 0.2, W - 0.16, 0.6, 0, 4.6, { front: wood, side: wood, top: (l) => () => (l ? '#5a4030' : '#5a4030'), edge: DRIFT[0] });
    layer(p.c, (l) => {
      for (let a = 0.35; a < W - 0.2; a += 0.6) {
        const [x, y] = p.P(a, 0.5, 4.6);
        if (Rn() < 0.4) agave(l, x, y, k.seed + Math.round(a * 10));
        else marramTuft(l, x, y, 0.8, k.seed + Math.round(a * 13));
      }
    }, { outline: 0.5 });
  },
};

const pleinAir: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 12, 0.32);
    // a tripod field easel with a small canvas of the bay, a stool, a paint box
    const [x, y] = anchor(p, 0.45, 0.45);
    layer(c, (l) => {
      for (const [dx, dy] of [[-12, 4], [10, 2], [-1, -8]] as const) {
        ln(l, x, y - 44, x + dx, y + dy, PINE[3], 2);
        ln(l, x - 1, y - 44, x + dx - 1, y + dy, PINE[5], 1);
      }
    }, { outline: 0.55 });
    const corners: V3[] = [[0.22, 0.6, 7.6], [0.7, 0.6, 7.6], [0.7, 0.54, 15], [0.22, 0.54, 15]];
    layer(c, (l) => solidFaces(Object.create(p, { c: { value: l } }) as PropPainter, [corners], () => painting(0)), { outline: 0.5 });
    layer(c, (l) => {
      const [sx, sy] = p.P(0.7, 0.85, 0);
      for (const dx of [-6, 0, 6]) ln(l, sx, sy - 14, sx + dx, sy, PINE[2], 2);
      ell(l, sx, sy - 15, 7, 3, '#2a5a7a');
      const [bx, by] = p.P(0.25, 0.85, 0);
      px(l, bx - 8, by - 5, PINE[3], 16, 5);
      px(l, bx - 8, by - 5, PINE[5], 16, 1);
      for (let i = 0; i < 5; i++) px(l, bx - 6 + i * 3, by - 7, ['#e0603e', '#2a8a86', '#f2c84a', '#5a7ac8', '#f6f0e4'][i], 2, 2);
      // a straw hat hung on the easel
      ell(l, x + 6, y - 40, 8, 3, '#e8cc90');
      ell(l, x + 6, y - 42, 4, 2.5, '#f2dca8');
    }, { outline: 0.5 });
    void k;
  },
};

export const STUDIO_BOARDWALK: Record<string, PropArt> = {
  std_ferry: ferry,
  std_pier: pier,
  std_festoon: festoon,
  std_lamp: lamp,
  std_bench: bench,
  std_surfRack: surfRack,
  std_picnic: picnic,
  std_signpost: signpost,
  std_planter: planter,
  std_pleinAir: pleinAir,
};

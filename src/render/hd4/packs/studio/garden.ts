// Creative Studio — back gardens and side yards of the district.
//   std_shed      a little weatherboard garden studio with a pent tin roof
//   std_laundry   a washing line of towels, swimsuits and shirts on two T-posts
//   std_shower    an outdoor beach shower on a slatted pallet
//   std_picket    a low white picket fence with the odd climbing rose
import type { Mat } from '../../../hd/kit';
import type { PropArt } from '../../../props';
import { at, contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, rng } from '../../kit4';
import { front3, pq, pt } from '../../plane4';
import { anchor, footShadow, lbox } from '../util';
import { beachDoor, ROOFC, roofOf, SIDING, TRIM } from './houses';
import { ALU, clap, darken, DRIFT, GEAR, LEAF, lighten, pmod, solidFaces, weathered } from './kit';
import { pot } from './lounge';

type V3 = [number, number, number];

const shed: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const keys = Object.keys(SIDING);
    const sid = SIDING[k.color ?? keys[pmod(k.seed * 3 + p.x + p.y, keys.length)]];
    const c = p.c;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 16, 0.38);
    const a0 = 0.2;
    const a1 = W - 0.2;
    const b0 = 0.25;
    const b1 = D - 0.3;
    const boards = clap(sid, 8, 0.4);
    lbox(p, a0, b0, a1 - a0, b1 - b0, 0, 1.2, { front: (l) => () => (l ? '#3a3236' : '#2a2226'), side: (l) => () => (l ? '#3a3236' : '#2a2226'), top: () => () => '#2a2226', edge: '#2a2226' });
    lbox(p, a0, b0, a1 - a0, b1 - b0, 1.2, 18, { front: boards, side: boards, top: boards, edge: darken(sid[0], 0.2) });
    const F = front3(p, b1);
    const am = (a0 + a1) / 2;
    beachDoor(p, F, am - 0.3, am + 0.3, 1.2, 16.4, [SIDING.teal, SIDING.coral, SIDING.butter][k.seed % 3], k.seed);
    // a little window with a pot on its sill, a sign
    pq(p, F, a0 + 0.15, a0 + 0.5, 7, 13, TRIM[F.light ? 5 : 3]);
    pt(p, F, a0 + 0.18, a0 + 0.47, 7.4, 12.6, (u: number, v: number) => ((u + v) % 16 < 3 ? '#c8e2ea' : '#34505e'), F.light);
    pq(p, F, am - 0.36, am + 0.36, 17.2, 19, '#1e2a3a');
    for (let i = 0; i < 4; i++) pq(p, F, am - 0.26 + i * 0.14, am - 0.18 + i * 0.14, 17.6, 18.6, '#f6f2ea');
    // the pent roof: high at the back, low at the front, tin
    const zb = 21.5;
    const zf = 18.6;
    const roofR = ROOFC[pmod(k.seed + p.x, ROOFC.length)];
    solidFaces(p, [[[a0 - 0.15, b0 - 0.12, zb], [a1 + 0.15, b0 - 0.12, zb], [a1 + 0.15, b1 + 0.15, zf], [a0 - 0.15, b1 + 0.15, zf]]], (s) => roofOf(roofR, true, s + 0.8), true);
    const sideA = p.rot === 0 ? a1 : a0;
    const tri: V3[] = [[sideA, b0, 19.2], [sideA, b1, 19.2], [sideA, b1, zf], [sideA, b0, zb - 0.4]];
    solidFaces(p, [tri], () => boards, true);
    const e0 = p.P(a0 - 0.15, b1 + 0.15, zf);
    const e1 = p.P(a1 + 0.15, b1 + 0.15, zf);
    ln(c, e0[0], e0[1], e1[0], e1[1], TRIM[4], 2);
    // pots and a bucket by the door
    layer(c, (l) => {
      const [qx, qy] = p.P(a1 - 0.25, D - 0.12, 0);
      const top = pot(l, qx, qy, 6, 8, 'dip', k.seed);
      foliage(l, [{ x: qx, y: top - 6, rx: 8, ry: 6, z: 1 }], LEAF, k.seed + 2, { cell: 2.4, dots: ['#f06a7a', '#fbf6ee'], dotChance: 0.6, dotSize: 3 });
      const [bx, by] = p.P(a0 + 0.25, D - 0.12, 0);
      fillPoly(l, [[bx - 5, by - 9], [bx + 5, by - 9], [bx + 4, by], [bx - 4, by]], ALU[3]);
      px(l, bx - 5, by - 10, ALU[5], 10, 2);
      for (let i = 0; i < 3; i++) ln(l, bx - 2 + i * 2, by - 9, bx - 4 + i * 3, by - 20, ['#c8382a', '#3a3036', '#e8b03e'][i]);
    }, { outline: 0.55 });
  },
};

const laundry: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 11 + 3);
    layer(p.c, (l) => {
      const tops: [number, number][] = [];
      for (const a of [0.1, W - 0.1]) {
        const [x, y] = p.P(a, 0.5, 0);
        contactShadow(l, x + 5, y + 2, 6, 2.5, 0.32);
        px(l, x - 2, y - 60, DRIFT[3], 4, 60);
        px(l, x - 2, y - 60, DRIFT[5], 1, 60);
        px(l, x - 7, y - 60, DRIFT[2], 14, 3);
        tops.push([x, y - 58]);
      }
      const [x0, y0] = tops[0];
      const [x1, y1] = tops[1];
      const n = Math.round(W * 4);
      let prev: [number, number] = [x0, y0];
      const pts: [number, number][] = [];
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const q: [number, number] = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 8];
        ln(l, prev[0], prev[1], q[0], q[1], '#e8e2d6');
        prev = q;
        pts.push(q);
      }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const q = pts[Math.min(pts.length - 1, Math.floor(t * 24))];
        const kind = Math.floor(Rn() * 4);
        const col = ['#f6f2ea', '#e0603e', '#7ac7bb', '#f2c84a', '#f0a6c0', '#2a5a9a', '#ffffff'][Math.floor(Rn() * 7)];
        const [x, y] = q;
        if (kind === 0) {
          // a striped beach towel
          for (let j = 0; j < 5; j++) px(l, x - 6, y + j * 4, j % 2 ? '#f6f2ea' : col, 12, 4);
          px(l, x - 6, y, lighten(col, 0.2), 1, 20);
        } else if (kind === 1) {
          // a T-shirt
          fillPoly(l, [[x - 7, y], [x + 7, y], [x + 9, y + 4], [x + 5, y + 5], [x + 5, y + 14], [x - 5, y + 14], [x - 5, y + 5], [x - 9, y + 4]], col);
          px(l, x - 5, y, lighten(col, 0.2), 2, 14);
        } else if (kind === 2) {
          // a swimsuit
          fillPoly(l, [[x - 4, y], [x + 4, y], [x + 3, y + 7], [x + 1, y + 10], [x - 1, y + 10], [x - 3, y + 7]], col);
        } else {
          // a pair of shorts
          fillPoly(l, [[x - 5, y], [x + 5, y], [x + 6, y + 9], [x + 1, y + 9], [x, y + 4], [x - 1, y + 9], [x - 6, y + 9]], col);
        }
        px(l, x - 1, y - 1, '#c8a060', 2, 3);
      }
    }, { outline: 0.5 });
    void hash;
  },
};

const shower: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 18, 0.32);
    const wood = weathered(DRIFT);
    // a slatted pallet, dark where it's wet
    const wet: Mat = (light) => (u, v, x, y) => (u % 8 < 1.5 ? '#2a2226' : at(DRIFT, (light === 2 ? 2.4 : 1.6) + (hash(x, y, 3) < 0.1 ? -0.6 : 0) + (v > 10 ? 0.6 : 0)));
    lbox(p, 0.2, 0.25, 0.6, 0.55, 0, 0.8, { front: wood, side: wood, top: wet, edge: DRIFT[0] });
    lbox(p, 0.42, 0.2, 0.12, 0.12, 0, 26, { front: wood, side: wood, top: wood, edge: DRIFT[0] });
    const [x, y] = anchor(p, 0.48, 0.32, 0);
    layer(c, (l) => {
      // the pipe up the post, the rose and the pull chain, a towel on a hook
      px(l, x + 6, y - 100, ALU[4], 2, 96);
      px(l, x + 6, y - 100, ALU[6], 1, 96);
      ln(l, x + 6, y - 100, x + 18, y - 104, ALU[4], 2);
      ell(l, x + 20, y - 101, 6, 3, ALU[3]);
      ell(l, x + 20, y - 102, 5, 2, ALU[5]);
      px(l, x + 6, y - 46, '#c8a050', 6, 3);
      ln(l, x + 20, y - 98, x + 20, y - 70, '#8a8e96');
      px(l, x + 19, y - 70, '#c8a050', 3, 3);
      fillPoly(l, [[x - 10, y - 74], [x - 1, y - 76], [x, y - 50], [x - 9, y - 47]], '#f0a6c0');
      for (let i = 0; i < 4; i++) px(l, x - 9, y - 70 + i * 6, '#f6eedc', 8, 2);
      // flip-flops on the pallet
      const [fx, fy] = anchor(p, 0.62, 0.66, 0.8);
      px(l, fx - 4, fy - 1, '#2a8ab8', 3, 2);
      px(l, fx + 1, fy, '#2a8ab8', 3, 2);
    }, { outline: 0.5 });
    void GEAR;
    void k;
  },
  anim(p, k) {
    // a few drips falling from the rose
    const [x, y] = anchor(p, 0.48, 0.32, 0);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.9 + i / 3 + k.seed * 0.1) % 1;
      px(p.c, x + (17 + i * 3) * u, y + (-98 + t * 95) * u, '#c8eef6', Math.max(1, u), Math.max(1, 2 * u));
    }
  },
};

const picket: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Rn = rng(k.seed * 5 + 1);
    layer(p.c, (l) => {
      for (let a = 0.05; a < W; a += 0.13) {
        const [x0, y0] = p.P(a, 0.5, 0);
        px(l, x0 - 1, y0 - 22, TRIM[5], 3, 22);
        px(l, x0 - 1, y0 - 22, TRIM[6], 1, 22);
        px(l, x0, y0 - 24, TRIM[4], 1, 2);
      }
      for (const z of [1.6, 4.4]) {
        const [x0, y0] = p.P(0, 0.5, z);
        const [x1, y1] = p.P(W, 0.5, z);
        ln(l, x0, y0, x1, y1, TRIM[3], 2);
      }
    }, { outline: 0.5 });
    // a climbing rose or two along it
    layer(p.c, (l) => {
      for (let a = 0.4; a < W - 0.2; a += 1.4 + Rn()) {
        if (Rn() < 0.5) continue;
        const masses: Mass[] = [];
        for (let i = 0; i < 4; i++) {
          const [x, y] = p.P(a + i * 0.12, 0.52, 2 + Rn() * 3);
          masses.push({ x, y, rx: 6, ry: 5, z: i });
        }
        foliage(l, masses, LEAF, Math.round(a * 17) + k.seed, { cell: 2.6, dots: ['#e8402a', '#f06a7a', '#fbe0ea'], dotChance: 0.6, dotSize: 3 });
      }
    }, { outline: 0.55 });
  },
};

export const STUDIO_GARDEN: Record<string, PropArt> = { std_shed: shed, std_laundry: laundry, std_shower: shower, std_picket: picket };

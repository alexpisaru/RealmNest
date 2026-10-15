// Research Hub — the library's smaller treasures (1 z ≈ 10 cm).
//   res_planchest  a low walnut plan chest, rolled charts and an open atlas on it
//   res_telescope  a brass refractor on a larch tripod, aimed out of the north window
//   res_orrery     a brass orrery on a round table; its planets go round (live)
//   res_trolley    a library trolley loaded with ledgers and archive boxes
//   res_stove      a green-tiled corner stove (Kachelofen) with a warming bench
//   res_archboxes  archive boxes and ledgers stacked on the floor
import { darken, lighten } from '../../../color';
import type { PropArt } from '../../../props';
import { at, contactShadow, curve, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt, side } from '../../plane4';
import { grain, paint } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { bookRow, lightOf, sphere, toneOf } from './kit';
import { BRASS, IRONK, LARCHF, PARCH, WALNUT } from './palette';

const walnut = grain(WALNUT);
const walnutV = grain(WALNUT, 'v');
const TILE: Ramp = ['#142a22', '#1c3a2e', '#264a3a', '#305c48', '#3e6e56', '#548468', '#6e9c80'];

// ── the plan chest ──────────────────────────────────────────
const res_planchest: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 8.4;
    footShadow(p, 0.06, 0.14, W - 0.06, 0.92, 8, 0.26);
    lbox(p, 0.1, 0.18, W - 0.2, 0.68, 0, 0.8, mono(paint(WALNUT), WALNUT[0]));
    lbox(p, 0.06, 0.14, W - 0.12, 0.74, 0.8, Z - 1.4, { front: walnutV, side: walnutV, top: walnut, edge: WALNUT[0] });
    const F = front(p, 0.88);
    for (let i = 0; i < 5; i++) {
      const z0 = 1.05 + i * 1.22;
      pq(p, F, 0.1, W - 0.1, z0, z0 + 1.1, WALNUT[1]);
      pq(p, F, 0.12, W - 0.12, z0 + 0.1, z0 + 1.02, F.light ? WALNUT[4] : WALNUT[3]);
      for (const a of [0.42, W - 0.42]) {
        const [hx, hy] = F.F(a, z0 + 0.55);
        px(p.c, hx - 4, hy - 1, BRASS[2], 8, 2);
        px(p.c, hx - 4, hy - 1, BRASS[5], 3, 1);
      }
      pq(p, F, W / 2 - 0.12, W / 2 + 0.12, z0 + 0.4, z0 + 0.8, '#efe6cc');
    }
    lbox(p, 0.02, 0.1, W - 0.04, 0.82, Z - 0.6, 0.6, { front: walnut, side: walnut, top: walnut, edge: WALNUT[0] });
    // an open atlas with a mountain map, rolled charts tied with red tape, a pair of dividers
    const [ax, ay] = anchor(p, W * 0.38, 0.5, Z);
    layer(p.c, (l) => {
      fillPoly(l, [[ax - 26, ay + 2], [ax + 2, ay - 12], [ax + 28, ay], [ax, ay + 14]], '#5a2a1e');
      fillPoly(l, [[ax - 24, ay + 1], [ax + 1, ay - 11], [ax + 1, ay + 12]], '#ece2c4');
      fillPoly(l, [[ax + 1, ay - 11], [ax + 26, ay], [ax + 1, ay + 12]], '#e2d6b4');
      ln(l, ax + 1, ay - 11, ax + 1, ay + 12, '#a89470');
      for (let i = 0; i < 4; i++) curve(l, ax - 20 + i * 4, ay + 2, ax - 12 + i * 3, ay - 6 + i, ax - 4 + i * 2, ay - 2 + i * 2, '#a8845a');
      for (let i = 0; i < 3; i++) curve(l, ax + 5 + i * 3, ay - 4 + i * 2, ax + 12 + i * 2, ay - 8 + i * 3, ax + 20, ay - 1 + i * 2, '#a8845a');
      ell(l, ax + 14, ay + 3, 4, 2, '#7aa8c8');
      ln(l, ax - 14, ay - 2, ax - 6, ay - 7, '#c82a2a');
    });
    for (let i = 0; i < 3; i++) {
      const [r0x, r0y] = anchor(p, W - 0.7, 0.32 + i * 0.18, Z + 0.7);
      const [r1x, r1y] = anchor(p, W - 0.12, 0.26 + i * 0.18, Z + 0.7);
      const c = ['#e8dcbc', '#d8c8a0', '#f0e6cc'][i];
      layer(p.c, (l) => {
        ln(l, r0x, r0y, r1x, r1y, darken(c, 0.2), 6);
        ln(l, r0x, r0y - 2, r1x, r1y - 2, c, 3);
        ell(l, r1x + 1, r1y - 1, 3, 3, darken(c, 0.15));
        px(l, (r0x + r1x) / 2, (r0y + r1y) / 2 - 3, '#a8282a', 2, 6);
      }, { rect: [r0x - 6, r0y - 8, r1x + 6, r1y + 6] });
    }
    void k;
  },
};

// ── the brass refractor at the window ───────────────────────
const res_telescope: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.6, 0);
    contactShadow(p.c, x + 12, y + 3, 22, 7, 0.26);
    layer(p.c, (l) => {
      // the larch tripod: three splayed legs, a spreader, the brass head
      const hy = y - 52;
      for (const [dx, dy] of [[-18, 4], [16, 6], [4, -8]] as const) {
        ln(l, x, hy, x + dx, y + dy, LARCHF[3], 3);
        ln(l, x - 1, hy, x + dx - 1, y + dy, LARCHF[5], 1);
        px(l, x + dx - 1, y + dy - 1, BRASS[2], 3, 2);
      }
      ell(l, x, y - 18, 9, 3, LARCHF[2]);
      ell(l, x, hy, 4, 3, BRASS[2]);
      // the tube aimed up out of the north window (up and to the right on screen)
      const ex = x + 44;
      const ey = hy - 40;
      const bx0 = x - 18;
      const by0 = hy + 14;
      ln(l, bx0, by0, ex, ey, BRASS[2], 7);
      ln(l, bx0, by0 - 2, ex, ey - 2, BRASS[4], 3);
      ln(l, bx0 + 1, by0 - 3, ex + 1, ey - 3, BRASS[6], 1);
      // rings, the dew cap, the eyepiece and a little finder scope
      for (const t of [0.3, 0.62]) {
        const rx = bx0 + (ex - bx0) * t;
        const ry = by0 + (ey - by0) * t;
        ln(l, rx - 2, ry - 4, rx + 2, ry + 4, BRASS[1], 2);
      }
      ln(l, ex - 6, ey + 5, ex + 4, ey - 3, IRONK[3], 9);
      ell(l, ex + 3, ey - 3, 3, 4, '#1a1e24');
      ln(l, bx0, by0, bx0 - 6, by0 + 5, IRONK[3], 3);
      ln(l, x + 2, hy - 10, x + 18, hy - 22, BRASS[3], 2);
    });
    void k;
  },
};

// ── the orrery ──────────────────────────────────────────────
const ORB = [0.18, 0.28, 0.4, 0.55];
const PLANETS = ['#c8b8a8', '#e8c890', '#5a8ad0', '#d07050'];
const orreryCentre = (p: Parameters<PropArt['draw']>[0]) => anchor(p, 0.5, 0.5, 11.5);
const res_orrery: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 10, y + 3, 20, 6, 0.26);
    layer(p.c, (l) => {
      // a round walnut table on a turned pedestal and three feet
      for (const dx of [-10, 0, 10]) ln(l, x, y - 6, x + dx, y + (dx === 0 ? 3 : 0), WALNUT[3], 2);
      px(l, x - 2, y - 26, WALNUT[3], 5, 20);
      px(l, x - 2, y - 26, WALNUT[5], 1, 20);
      ell(l, x, y - 27, 18, 8, WALNUT[2]);
      ell(l, x, y - 28, 17, 7, WALNUT[4]);
      ell(l, x - 4, y - 29, 9, 3, WALNUT[5]);
    });
    const [cx, cy] = orreryCentre(p);
    layer(p.c, (l) => {
      // the brass base, the column, the tilted ecliptic rings
      ell(l, cx, cy + 12, 8, 3, BRASS[2]);
      ell(l, cx, cy + 11, 7, 2, BRASS[4]);
      px(l, cx - 1, cy, BRASS[3], 2, 12);
      for (const r of ORB) {
        const R0 = r * 64;
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          px(l, cx + Math.cos(a) * R0, cy + Math.sin(a) * R0 * 0.42, i % 2 ? BRASS[2] : BRASS[4]);
        }
      }
    }, { outline: false });
    // the Sun: a gilded ball
    sphere(p.c, p.k, cx, cy - 2, 0.07, (nx, ny, nz, xx, yy) => ['#8a5a10', '#b07a18', '#d8a028', '#f0c848', '#fae078', '#fff4b8'][toneOf(['', '', '', '', '', ''], lightOf(nx, ny, nz), xx, yy, 0.35, 0.65)]);
    void k;
  },
  anim(p, k) {
    const [cx, cy] = orreryCentre(p);
    const u = p.k / 4;
    ORB.forEach((r, i) => {
      const a = k.t * (0.9 / (i + 1)) + i * 1.7 + k.seed;
      const R0 = r * 64 * u;
      const x = cx + Math.cos(a) * R0;
      const y = cy - 2 * u + Math.sin(a) * R0 * 0.42;
      p.c.fillStyle = BRASS[3];
      p.c.fillRect(Math.round(cx), Math.round(cy - 2 * u), 1, 1);
      const s = Math.max(1, Math.round((i === 2 ? 3 : 2) * u));
      p.c.fillStyle = darken(PLANETS[i], 0.3);
      p.c.fillRect(Math.round(x - s / 2), Math.round(y - s / 2 + 1), s, s);
      p.c.fillStyle = PLANETS[i];
      p.c.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      p.c.fillStyle = lighten(PLANETS[i], 0.4);
      p.c.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), 1, 1);
      if (i === 3) {
        // a ringed planet's ring
        p.c.fillStyle = '#e8d8a8';
        p.c.fillRect(Math.round(x - s), Math.round(y), s * 2 + 1, 1);
      }
    });
  },
};

// ── a library trolley ───────────────────────────────────────
const res_trolley: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.2, 0.85, 0.85, 8, 0.24);
    const R = rng(k.seed * 7 + 5);
    for (const [a, b] of [[0.18, 0.24], [0.76, 0.24], [0.18, 0.78], [0.76, 0.78]] as const) {
      lbox(p, a, b, 0.05, 0.05, 0.6, 8.4, mono(walnut, WALNUT[0]));
      const [wx, wy] = anchor(p, a + 0.025, b + 0.025, 0.4);
      ell(p.c, wx, wy, 2.5, 2.5, IRONK[2]);
    }
    for (const z of [1.4, 5.2]) {
      lbox(p, 0.16, 0.22, 0.66, 0.62, z, 0.4, mono(walnut, WALNUT[0]));
      bookRow(p, front(p, 0.66), 0.2, 0.8, z + 0.4, 3.2, R, { boxes: z < 2 ? 0.6 : 0.1, tall: z < 2 });
    }
    lbox(p, 0.16, 0.22, 0.66, 0.62, 8.6, 0.4, mono(walnut, WALNUT[0]));
    // a push handle, a stack on top
    const [hx, hy] = anchor(p, 0.82, 0.5, 9.4);
    ln(p.c, hx, hy, hx + 6, hy - 10, BRASS[3], 2);
    const [sx, sy] = anchor(p, 0.48, 0.52, 9);
    layer(p.c, (l) => {
      for (let i = 0; i < 3; i++) {
        const c = ['#6a1e1c', '#2a3e5a', '#7a5a2a'][i];
        fillPoly(l, [[sx - 11, sy - i * 3], [sx, sy - 6 - i * 3], [sx + 11, sy - i * 3], [sx, sy + 6 - i * 3]], c);
        fillPoly(l, [[sx - 11, sy - i * 3], [sx, sy + 6 - i * 3], [sx, sy + 8 - i * 3], [sx - 11, sy + 2 - i * 3]], '#ece2c8');
      }
    });
  },
};

// ── the tiled corner stove ──────────────────────────────────
const res_stove: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.08, 0.92, 0.92, 18, 0.28);
    // a stone base, the tiled body, a cornice, a crown of tiles, the bench round it
    lbox(p, 0.12, 0.12, 0.76, 0.76, 0, 1.6, mono(paint(['#4a4a4e', '#5e5e62', '#747476', '#8a8a8a', '#a09e9a', '#b6b2ac']), '#3a3a3e'));
    const tile = (light: 0 | 1 | 2) => (u: number, v: number, x: number, y: number) => {
      const fu = u % 11;
      const fv = v % 11;
      if (fu < 1 || fv < 1) return '#d8d0b8';
      // a glazed tile: lit bevel upper left, a sheen, crackle
      let i = (light ? 3.4 : 2.2) + (fu < 3 || fv > 8 ? 1 : 0) - (fu > 8 || fv < 3 ? 0.8 : 0);
      if (Math.abs(fu - fv) < 0.8 && fu > 3 && fu < 6) i += 1.4;
      if (hash(x, y, 3) < 0.03) i -= 1;
      return at(TILE, i);
    };
    lbox(p, 0.14, 0.14, 0.72, 0.72, 1.6, 14, { front: (l) => tile(l), side: (l) => tile(l), top: paint(TILE), edge: TILE[0] });
    lbox(p, 0.1, 0.1, 0.8, 0.8, 15.6, 1.2, mono(paint(['#b8b0a0', '#c8c0b0', '#d8d0c0', '#e6e0d2', '#f0eade', '#f8f4ea']), '#8a8478'));
    lbox(p, 0.2, 0.2, 0.6, 0.6, 16.8, 3, { front: (l) => tile(l), side: (l) => tile(l), top: paint(TILE), edge: TILE[0] });
    const F = front(p, 0.86);
    pq(p, F, 0.36, 0.64, 3, 6.4, IRONK[1]);
    pq(p, F, 0.39, 0.61, 3.3, 6.1, IRONK[3]);
    const [hx, hy] = F.F(0.58, 4.8);
    px(p.c, hx - 1, hy - 1, BRASS[4], 2, 2);
    const S = side(p, 0.86);
    pt(p, S, 0.3, 0.7, 9, 12, (u: number, v: number) => (u % 5 < 1 || v % 5 < 1 ? '#3a2a20' : '#e8e0c8'), S.light);
    // the warming bench and a pair of wool socks drying on the rail
    lbox(p, 0.02, 0.86, 0.96, 0.12, 0, 4.4, mono(grain(LARCHF), LARCHF[0]));
    lbox(p, 0.86, 0.02, 0.12, 0.84, 0, 4.4, mono(grain(LARCHF), LARCHF[0]));
    const [sx, sy] = F.F(0.3, 13);
    px(p.c, sx - 8, sy, IRONK[3], 22, 1);
    px(p.c, sx - 4, sy + 1, '#b8282a', 4, 7);
    px(p.c, sx - 4, sy + 6, '#e8e0d0', 5, 2);
    px(p.c, sx + 4, sy + 1, '#3a5a8a', 4, 6);
    px(p.c, sx + 4, sy + 5, '#e8e0d0', 5, 2);
    void k;
  },
};

// ── archive boxes on the floor ──────────────────────────────
const res_archboxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.15, 0.88, 0.88, 8, 0.24);
    const box = (a: number, b: number, w: number, d: number, z: number, h: number, col: string) => {
      const r: Ramp = [darken(col, 0.45), darken(col, 0.3), darken(col, 0.15), col, lighten(col, 0.12), lighten(col, 0.24)];
      lbox(p, a, b, w, d, z, h, mono(paint(r), r[0]));
      const F = front(p, b + d);
      pq(p, F, a + w * 0.25, a + w * 0.75, z + h * 0.45, z + h * 0.8, '#efe6d0');
      pq(p, F, a + w * 0.3, a + w * 0.66, z + h * 0.6, z + h * 0.66, '#5a5048');
    };
    box(0.14, 0.22, 0.42, 0.56, 0, 3.4, '#a48c6c');
    box(0.18, 0.26, 0.36, 0.5, 3.4, 3.2, '#5e6a76');
    box(0.58, 0.4, 0.3, 0.42, 0, 3.4, '#bca482');
    // a pile of ledgers leaning on the boxes
    const [lx, ly] = anchor(p, 0.7, 0.86, 0);
    layer(p.c, (l) => {
      for (let i = 0; i < 4; i++) {
        const c = ['#6a1e1c', '#2e4a30', '#2a3e5a', '#5a3a1e'][(i + k.seed) % 4];
        fillPoly(l, [[lx - 10, ly - i * 3], [lx, ly - 5 - i * 3], [lx + 10, ly - i * 3], [lx, ly + 5 - i * 3]], c);
        fillPoly(l, [[lx - 10, ly - i * 3], [lx, ly + 5 - i * 3], [lx, ly + 7 - i * 3], [lx - 10, ly + 2 - i * 3]], '#ece2c8');
        px(l, lx - 1, ly - i * 3 - 2, '#c8a04a', 3, 1);
      }
    });
    void PARCH;
  },
};

export const RESEARCH_LIBRARY: Record<string, PropArt> = { res_planchest, res_telescope, res_orrery, res_trolley, res_stove, res_archboxes };

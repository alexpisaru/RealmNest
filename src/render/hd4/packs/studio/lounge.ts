// Creative Studio — the lounge, the coffee bar, plants and the clutter of a
// working studio: a corduroy modular sofa, a pallet coffee table, a rattan
// peacock chair, a tiled pour-over bar, kentia, cactus, pothos, agave,
// strelitzia and cereus in painted pots and paint tins; shelves, leaning
// canvases, a paint cart, a costume rail, a reflector, a ring light, a
// beanbag, a record player, a floor lamp, boxes, a plan chest, surfboards.
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { contactShadow, curve, dotFruit, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, poly3, pq, side } from '../../plane4';
import { cardboard } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';
import { bar, pole } from './gear';
import { ALU, BEECH, CHAR, coat, CORAL, corduroy, CREAM, darken, fabric, felt, GEAR, LEAF, lighten, MINT, MUSTARD, PALMLEAF, PINE, pine, PLY, plyEdge, plyFace, SKY, solidFaces, TEAL, TERRA, WALNUT, zellige } from './kit';

type V3 = [number, number, number];
/** A painter that draws into a layer (same geometry). */
const into = (p: PropPainter, l: CanvasRenderingContext2D) => Object.create(p, { c: { value: l } }) as PropPainter;

// ── the corduroy modular sofa ───────────────────────────────
const sofa: PropArt = {
  draw(p, k) {
    const W = k.w;
    const fr = fabric(k.color ?? '#5b8def');
    const cord = corduroy(fr);
    const c = p.c;
    footShadow(p, 0.06, 0.12, W - 0.06, 0.94, 6, 0.38);
    lbox(p, 0.16, 0.22, W - 0.32, 0.62, 0, 1.1, mono(coat(CHAR), CHAR[0]));
    lbox(p, 0.06, 0.12, W - 0.12, 0.8, 1.1, 2.3, { front: cord, side: cord, top: cord, edge: fr[0] });
    // back cushions, then the seat cushions, then the low arms
    const n = 3;
    const sw = (W - 0.6) / n;
    for (let i = 0; i < n; i++) lbox(p, 0.3 + i * sw + 0.01, 0.14, sw - 0.02, 0.26, 3.4, 5.4, { front: cord, side: cord, top: cord, edge: fr[0] });
    for (let i = 0; i < n; i++) {
      const a0 = 0.3 + i * sw + 0.01;
      lbox(p, a0, 0.4, sw - 0.02, 0.5, 3.4, 1.5, { front: cord, side: cord, top: cord, edge: fr[0] });
      // a soft lit lip along the cushion's front edge and a pressed hollow
      const Fc = front(p, 0.9);
      pq(p, Fc, a0 + 0.03, a0 + sw - 0.05, 4.6, 4.9, fr[4]);
      const [hx, hy] = p.P(a0 + sw * 0.5, 0.62, 4.9);
      ell(c, hx, hy, 10, 3, fr[2]);
    }
    for (const a of [0.06, W - 0.3]) lbox(p, a, 0.12, 0.24, 0.8, 3.4, 2.7, { front: cord, side: cord, top: cord, edge: fr[0] });
    // pillows: a striped one and a terrazzo-print one; a mustard cable-knit throw; an open book
    const pill = (a: number, b: number, col: string, pat: number) => {
      const [x, y] = anchor(p, a, b, 5);
      layer(c, (l) => {
        fillPoly(l, [[x - 10, y + 2], [x + 8, y - 6], [x + 10, y - 20], [x - 8, y - 13]], darken(col, 0.28));
        fillPoly(l, [[x - 9, y + 1], [x + 7, y - 6], [x + 9, y - 19], [x - 7, y - 12]], col);
        if (pat === 0) for (let i = 0; i < 4; i++) ln(l, x - 8 + i * 4, y - i * 2, x - 6 + i * 4, y - 13 - i * 2, '#f6eedc', 1);
        else for (let i = 0; i < 9; i++) px(l, x - 6 + hash(i, 1, pat) * 13, y - 14 + hash(i, 2, pat) * 12, ['#2a8a86', '#e06a4a', '#1e2a3a'][i % 3], 2, 1);
        fillPoly(l, [[x - 6, y - 3], [x + 2, y - 7], [x + 4, y - 13], [x - 4, y - 9]], lighten(col, 0.14));
      });
    };
    pill(0.48, 0.4, '#e06a4a', 0);
    pill(W - 0.62, 0.4, '#f2e6cc', 1);
    const [tx, ty] = anchor(p, 0.16, 0.66, 6.1);
    layer(c, (l) => {
      fillPoly(l, [[tx - 8, ty - 6], [tx + 14, ty - 14], [tx + 22, ty + 4], [tx + 4, ty + 20], [tx - 4, ty + 22]], MUSTARD[3]);
      for (let i = 0; i < 6; i++) {
        const sx = tx - 5 + i * 4;
        for (let j = 0; j < 7; j++) px(l, sx + (j & 1), ty - 6 - i * 1.3 + j * 3.4, j % 2 ? MUSTARD[2] : MUSTARD[4], 2, 2);
      }
      for (let i = 0; i < 6; i++) px(l, tx - 3 + i * 3.4, ty + 21 - i * 0.6, MUSTARD[5], 1, 4);
    });
    const [bx, by] = anchor(p, W - 0.95, 0.66, 4.9);
    layer(c, (l) => {
      fillPoly(l, [[bx - 11, by], [bx, by - 6], [bx + 11, by], [bx, by + 6]], '#2a5a7a');
      fillPoly(l, [[bx - 10, by - 1], [bx, by - 7], [bx, by + 4]], '#fbf6ea');
      fillPoly(l, [[bx, by - 7], [bx + 10, by - 1], [bx, by + 4]], '#efe8d8');
      for (let i = 0; i < 3; i++) ln(l, bx - 7 + i * 2, by - 1 - i, bx - 2 + i * 2, by - 4 - i, '#a89c88');
    });
  },
};

// ── the pallet coffee table ─────────────────────────────────
const coffeeTable: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.15, 0.2, W - 0.15, 0.85, 4, 0.32);
    const wood = pine(['#5e4630', '#7a5c3e', '#957250', '#ad8a62', '#c2a076', '#d4b48a', '#e2c8a0']);
    for (const [a, b] of [[0.2, 0.26], [W - 0.2, 0.26], [0.2, 0.78], [W - 0.2, 0.78]] as const) {
      const [x, y] = p.P(a, b, 0.6);
      ell(c, x, y, 3, 2.5, GEAR[1]);
      ell(c, x - 1, y - 1, 1.2, 1, GEAR[4]);
    }
    for (const b of [0.18, 0.46, 0.74]) lbox(p, 0.14, b, W - 0.28, 0.12, 1.2, 0.5, mono(wood, '#3e2c1c'));
    for (const a of [0.16, W / 2 - 0.08, W - 0.32]) for (const b of [0.18, 0.46, 0.74]) lbox(p, a, b, 0.16, 0.12, 1.7, 2.1, mono(wood, '#3e2c1c'));
    for (let i = 0; i < 6; i++) lbox(p, 0.12, 0.16 + i * 0.115, W - 0.24, 0.095, 3.8, 0.6, mono(wood, '#3e2c1c'));
    const tz = 4.4;
    layer(c, (l) => {
      // art books, a bowl of shells, an instant camera with two prints, a candle in a bottle
      const [bx, by] = p.P(0.45, 0.42, tz);
      for (let i = 0; i < 3; i++) {
        const col = ['#e06a4a', '#f6eedc', '#2a5a7a'][i];
        fillPoly(l, [[bx - 15, by - i * 3], [bx + 1, by - 8 - i * 3], [bx + 15, by - 1 - i * 3], [bx - 1, by + 7 - i * 3]], darken(col, 0.3));
        fillPoly(l, [[bx - 14, by - 1 - i * 3], [bx + 1, by - 8 - i * 3], [bx + 14, by - 2 - i * 3], [bx - 1, by + 5 - i * 3]], col);
      }
      const [sx, sy] = p.P(W - 0.55, 0.36, tz);
      ell(l, sx, sy - 2, 11, 5, '#2a6a7a');
      ell(l, sx, sy - 3, 10, 4, '#4a8e9a');
      ell(l, sx, sy - 4, 8, 3, '#e8dcc4');
      for (const [dx, dy, col] of [[-4, -5, '#f6d8c8'], [2, -6, '#fbf6ee'], [5, -4, '#e8b090'], [-1, -3, '#d8c0a8']] as const) dotFruit(l, sx + dx, sy + dy, col, 3);
      const [cx, cy] = p.P(W / 2 + 0.1, 0.66, tz);
      fillPoly(l, [[cx - 7, cy - 2], [cx + 3, cy - 7], [cx + 9, cy - 4], [cx - 1, cy + 1]], '#f2f0ea');
      px(l, cx - 6, cy - 11, '#f2f0ea', 12, 9);
      px(l, cx - 6, cy - 11, '#ffffff', 2, 9);
      ell(l, cx, cy - 7, 3, 3, GEAR[2]);
      ell(l, cx - 1, cy - 8, 1, 1, '#8ab0d0');
      px(l, cx + 3, cy - 10, '#e06a4a', 2, 1);
      for (const [dx, col] of [[12, '#7ab0c8'], [20, '#e8b070']] as const) {
        fillPoly(l, [[cx + dx - 5, cy + 2], [cx + dx + 1, cy - 1], [cx + dx + 6, cy + 2], [cx + dx, cy + 5]], '#fbf8f2');
        fillPoly(l, [[cx + dx - 3, cy + 2], [cx + dx + 1, cy], [cx + dx + 4, cy + 2], [cx + dx, cy + 3]], col);
      }
      const [gx, gy] = p.P(0.3, 0.74, tz);
      px(l, gx - 3, gy - 14, '#2e6a4a', 6, 14);
      px(l, gx - 3, gy - 14, '#4e8e6a', 2, 14);
      px(l, gx - 1, gy - 19, '#2e6a4a', 2, 5);
      px(l, gx - 2, gy - 25, '#f6eedc', 4, 6);
      px(l, gx - 3, gy - 20, '#f6eedc', 1, 4);
      px(l, gx + 2, gy - 18, '#f6eedc', 1, 6);
      px(l, gx - 1, gy - 27, '#3a3030', 1, 2);
    });
    void k;
  },
  anim(p, k) {
    // the candle flame flickers
    const [gx, gy] = p.P(0.3, 0.74, 4.4);
    const u = p.k / 4;
    const f = Math.sin(k.t * 9) > 0 ? 1 : 0;
    px(p.c, gx - u + f * u, gy - 31 * u, '#ffd27a', Math.max(1, 2 * u), Math.max(1, 3 * u));
    px(p.c, gx, gy - 30 * u, '#fff4d0', Math.max(1, u), Math.max(1, u));
    p.c.globalAlpha = 0.12;
    ell(p.c, gx, gy - 30 * u, 8 * u, 6 * u, '#ffd27a');
    p.c.globalAlpha = 1;
  },
};

// ── the rattan peacock chair ────────────────────────────────
const armchair: PropArt = {
  draw(p, k) {
    const cush = fabric(k.color ?? '#f2b84b');
    const c = p.c;
    const RT: Ramp = ['#5a3c22', '#7a5430', '#9a6e40', '#b88a54', '#d0a46a', '#e4be86'];
    footShadow(p, 0.12, 0.15, 0.88, 0.9, 10, 0.38);
    // the fan back: radiating spokes and rings, a band of open diamonds, a braided rim
    const bb = 0.24;
    const ua = 0.5;
    const R0 = 0.5;
    const zb = 4.6;
    const zc = 12.5;
    const rise = 9.5;
    const fan: V3[] = [[ua - 0.28, bb, zb]];
    for (let i = 0; i <= 28; i++) {
      const t = Math.PI - (i / 28) * Math.PI;
      fan.push([ua + Math.cos(t) * R0, bb, zc + Math.sin(t) * rise]);
    }
    fan.push([ua + 0.28, bb, zb]);
    const weave: Mat = (_l, w, h) => (u, v, x, y) => {
      // plane coords: U across (−0.5…0.5 of the fan width), Z up in z units
      const U = (u / w - 0.5) * 2 * R0;
      const Z = (v / h) * (zc + rise - zb) + zb;
      const ang = Math.atan2((Z - 3) / 18, U);
      const rr = Math.hypot(U / R0, (Z - zc) / rise);
      const rr0 = Math.hypot(U / 0.3, (Z - 3) / 9);
      if (Z > zc && rr > 0.9) return RT[(Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? 4 : 2];
      const spoke = Math.abs(((ang / Math.PI) * 30) % 1 - 0.5) < 0.18;
      const ring = Math.abs(((rr0 * 6) % 1) - 0.5) < 0.2;
      const open = rr0 > 1.25 && rr0 < 1.75 && !spoke && !ring;
      if (open) return null;
      return RT[spoke ? (U < 0 ? 4 : 3) : ring ? 3 : 2 + (hash(x, y, 3) < 0.25 ? 1 : 0)];
    };
    layer(c, (l) => poly3(into(p, l), fan, weave, 1, [[ua - R0, bb, zb], [ua + R0, bb, zb], [ua - R0, bb, zc + rise]]), { outline: 0.6 });
    // the hourglass base
    layer(c, (l) => {
      for (let z = 0; z <= 4.4; z += 0.25) {
        const t = Math.abs(z - 2.2) / 2.2;
        const r = 0.13 + t * t * 0.17;
        const [x, y] = p.P(0.5, 0.52, z);
        const rx = r * 72;
        ell(l, x, y, rx, rx * 0.5, RT[Math.floor(z * 4) % 3 === 0 ? 1 : 2]);
        ell(l, x - rx * 0.3, y - 1, rx * 0.55, rx * 0.25, RT[Math.floor(z * 4) % 3 === 0 ? 2 : 4]);
      }
    }, { outline: 0.6 });
    // the seat rim and the cushion with button tufting
    layer(c, (l) => {
      const [x, y] = p.P(0.5, 0.56, 4.6);
      ell(l, x, y, 30, 15, RT[1]);
      ell(l, x, y - 2, 29, 14, RT[3]);
      ell(l, x, y - 6, 25, 12, cush[1]);
      ell(l, x, y - 8, 24, 11, cush[3]);
      ell(l, x - 5, y - 10, 13, 5, cush[4]);
      for (const [dx, dy] of [[-8, -8], [8, -9], [0, -5], [0, -12]] as const) px(l, x + dx, y + dy, cush[1], 2, 1);
      // the woven rim's lip
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI;
        px(l, x + Math.cos(a) * 28, y + Math.sin(a) * 13 - 1, RT[i % 2 ? 2 : 4], 3, 2);
      }
    }, { outline: 0.6 });
    void k;
  },
};

// ── the tiled pour-over bar ─────────────────────────────────
const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.04, 0.08, W - 0.04, 0.94, 9, 0.35);
    const tile = zellige(TEAL, 6);
    const block = pine(PINE);
    lbox(p, 0.06, 0.14, W - 0.12, 0.72, 0, 0.9, mono(coat(GEAR), GEAR[0]));
    lbox(p, 0.04, 0.1, W - 0.08, 0.78, 0.9, 7.8, { front: tile, side: tile, top: tile, edge: TEAL[0] });
    // a coral tile band under the worktop
    const vis = p.rot === 0 ? side(p, W - 0.04) : side(p, 0.04);
    const Fr = front(p, 0.88);
    pq(p, Fr, 0.04, W - 0.04, 7.6, 8.4, CORAL[3]);
    pq(p, vis, 0.1, 0.88, 7.6, 8.4, CORAL[2]);
    for (let i = 0; i < 12; i++) {
      const a = 0.08 + (i * (W - 0.16)) / 12;
      pq(p, Fr, a, a + 0.01, 7.6, 8.4, '#e8dccb');
    }
    // butcher-block worktop
    lbox(p, 0, 0.06, W, 0.86, 8.7, 0.8, { front: block, side: block, top: block, edge: PINE[0] });
    const tz = 9.5;
    // a chalk sign hung on the front
    const [sx, sy] = Fr.F(W * 0.7, 6.5);
    layer(c, (l) => {
      ln(l, sx - 6, sy - 14, sx, sy - 20, '#8a7a5a');
      ln(l, sx + 6, sy - 14, sx, sy - 20, '#8a7a5a');
      fillPoly(l, [[sx - 10, sy - 14], [sx + 10, sy - 14], [sx + 10, sy], [sx - 10, sy]], '#5a3c22');
      fillPoly(l, [[sx - 8, sy - 12], [sx + 8, sy - 12], [sx + 8, sy - 2], [sx - 8, sy - 2]], '#2a302c');
      ln(l, sx - 6, sy - 9, sx + 5, sy - 9, '#f6f0e4');
      ln(l, sx - 5, sy - 5, sx + 3, sy - 5, '#f0c070');
    });
    layer(c, (l) => {
      // the electric hob with a moka pot
      const [hx, hy] = p.P(0.28, 0.48, tz);
      ell(l, hx, hy, 10, 5, GEAR[1]);
      ell(l, hx, hy - 1, 9, 4, GEAR[3]);
      fillPoly(l, [[hx - 5, hy - 2], [hx + 5, hy - 2], [hx + 4, hy - 10], [hx + 6, hy - 18], [hx - 6, hy - 18], [hx - 4, hy - 10]], ALU[3]);
      fillPoly(l, [[hx - 5, hy - 2], [hx - 1, hy - 2], [hx - 1, hy - 18], [hx - 6, hy - 18], [hx - 4, hy - 10]], ALU[5]);
      px(l, hx - 6, hy - 20, ALU[4], 12, 2);
      px(l, hx - 1, hy - 22, GEAR[2], 3, 2);
      ln(l, hx + 6, hy - 16, hx + 11, hy - 10, GEAR[2], 2);
      // the gooseneck kettle
      const [kx, ky] = p.P(0.62, 0.42, tz);
      fillPoly(l, [[kx - 7, ky], [kx + 7, ky], [kx + 6, ky - 12], [kx - 6, ky - 12]], GEAR[2]);
      px(l, kx - 6, ky - 12, GEAR[4], 2, 12);
      ell(l, kx, ky - 13, 6, 2, GEAR[3]);
      curve(l, kx - 6, ky - 4, kx - 14, ky - 6, kx - 13, ky - 16, GEAR[2], 2);
      curve(l, kx + 6, ky - 10, kx + 11, ky - 12, kx + 7, ky - 3, GEAR[3], 2);
      px(l, kx - 1, ky - 16, '#c8a050', 2, 2);
      // a glass carafe under a white ceramic dripper
      const [gx, gy] = p.P(0.94, 0.48, tz);
      fillPoly(l, [[gx - 6, gy], [gx + 6, gy], [gx + 5, gy - 9], [gx - 5, gy - 9]], '#cfe2e6');
      fillPoly(l, [[gx - 5, gy - 1], [gx + 5, gy - 1], [gx + 4, gy - 5], [gx - 4, gy - 5]], '#6a3a20');
      px(l, gx - 5, gy - 9, '#f2fbfd', 2, 8);
      px(l, gx - 2, gy - 11, '#cfe2e6', 4, 2);
      fillPoly(l, [[gx - 7, gy - 19], [gx + 7, gy - 19], [gx + 2, gy - 12], [gx - 2, gy - 12]], '#f6f2ea');
      px(l, gx - 7, gy - 20, '#ffffff', 14, 2);
      px(l, gx + 2, gy - 18, '#d8d2c6', 4, 5);
      // a beech hand grinder
      const [rx, ry] = p.P(1.2, 0.42, tz);
      px(l, rx - 4, ry - 13, BEECH[3], 8, 13);
      px(l, rx - 4, ry - 13, BEECH[5], 2, 13);
      px(l, rx - 5, ry - 15, ALU[4], 10, 2);
      ln(l, rx, ry - 15, rx + 8, ry - 19, ALU[3], 2);
      ell(l, rx + 9, ry - 20, 2, 2, BEECH[2]);
      // a cake under a glass dome on a stand
      const [cx, cy] = p.P(1.52, 0.5, tz);
      px(l, cx - 1, cy - 5, '#e8e4dc', 3, 5);
      ell(l, cx, cy - 6, 10, 4, '#f2eee6');
      fillPoly(l, [[cx - 7, cy - 7], [cx + 7, cy - 7], [cx + 7, cy - 14], [cx - 7, cy - 14]], '#f0a6c0');
      ell(l, cx, cy - 14, 7, 3, '#fbe0ea');
      px(l, cx - 7, cy - 11, '#fbf6ee', 14, 1);
      dotFruit(l, cx - 2, cy - 16, '#c8382a', 3);
      layer(l, (g) => {
        ell(g, cx, cy - 13, 11, 12, '#e8f6fa');
      }, { alpha: 0.35, outline: false });
      px(l, cx - 7, cy - 22, '#ffffff', 2, 6);
      // the mug tree with mismatched handmade mugs
      const [mx, my] = p.P(W - 0.2, 0.42, tz);
      px(l, mx - 1, my - 22, BEECH[3], 3, 22);
      ell(l, mx, my, 6, 3, BEECH[2]);
      for (const [dx, dy, col] of [[-6, -18, '#e06a4a'], [5, -14, '#2a8a86'], [-6, -9, '#e8b03e'], [5, -6, '#f2ece0']] as const) {
        px(l, mx + dx - 3, my + dy, col, 6, 6);
        px(l, mx + dx - 3, my + dy, lighten(col, 0.25), 1, 6);
        px(l, mx + dx - 3, my + dy + 5, darken(col, 0.25), 6, 1);
      }
      // a jar of beans and a sprig in a little vase
      const [jx, jy] = p.P(0.12, 0.74, tz);
      px(l, jx - 4, jy - 10, '#d8eaee', 8, 10);
      for (let i = 0; i < 6; i++) px(l, jx - 3 + (i % 3) * 2, jy - 7 + Math.floor(i / 3) * 3, '#5a3420', 2, 2);
      px(l, jx - 4, jy - 12, '#c8a070', 8, 2);
    });
    void k;
  },
  anim(p, k) {
    // steam from the moka pot's spout
    const [x, y] = p.P(0.28, 0.48, 9.5);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.45 + i / 3) % 1;
      p.c.globalAlpha = 0.32 * (1 - t);
      ell(p.c, x + (12 + Math.sin(t * 6 + i) * 3) * u, y - (12 + t * 26) * u, (2 + t * 4) * u, (2 + t * 3) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── plants ──────────────────────────────────────────────────
type PotKind = 'stripe' | 'tin' | 'terrazzo' | 'basket' | 'dip';
/** A pot with its own decoration; returns the screen y of its rim. */
function pot(l: CanvasRenderingContext2D, x: number, y: number, rw: number, h: number, kind: PotKind, seed: number): number {
  const cols = (t: number, r: Ramp) => r[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.82 ? 3 : 2];
  for (let j = 0; j < h; j++) {
    const taper = kind === 'basket' ? Math.sin((j / h) * Math.PI) * 0.18 + 0.82 : kind === 'tin' ? 1 : 1 - (j / h) * -0.1;
    const w = rw * taper;
    for (let i = -w; i < w; i++) {
      const t = (i + w) / (2 * w);
      let col: string;
      if (kind === 'stripe') col = (j > h * 0.3 && j < h * 0.42) || (j > h * 0.6 && j < h * 0.66) ? cols(t, CORAL) : cols(t, CREAM);
      else if (kind === 'tin') col = j > h * 0.25 && j < h * 0.7 ? cols(t, seed % 2 ? SKY : MUSTARD) : cols(t, ALU);
      else if (kind === 'terrazzo') col = hash(Math.floor((x + i) / 2), Math.floor((y - j) / 2), 7) < 0.1 ? ['#e06a4a', '#2a8a86', '#e8b03e', '#3a3036'][Math.floor(hash(x + i, y - j, 8) * 4)] : cols(t, ['#6a6660', '#86827a', '#a29e96', '#bab6ae', '#ceCac2', '#e2ded6']);
      else if (kind === 'basket') col = ((j >> 1) + (Math.floor((i + w) / 3) & 1)) % 2 ? cols(t, ['#5a4024', '#7a5a34', '#9a7644', '#b89458', '#cfae70', '#e2c68c']) : cols(t, ['#4a3420', '#6a4c2c', '#8a663a', '#a8824c', '#c09c62', '#d6b47c']);
      else col = j < h * 0.45 ? cols(t, TERRA) : cols(t, TEAL);
      px(l, x + i, y - j, col);
    }
  }
  if (kind === 'tin') {
    // drips of paint down the tin from its rim
    for (let i = 0; i < 5; i++) {
      const dx = -rw + 2 + hash(i, 1, seed) * (rw * 2 - 4);
      const len = 3 + hash(i, 2, seed) * h * 0.5;
      px(l, x + dx, y - h, ['#e06a4a', '#2a8a86', '#f6f0e4', '#e8b03e'][i % 4], 2, len);
    }
    px(l, x - rw - 1, y - h - 1, ALU[5], rw * 2 + 2, 2);
  } else if (kind !== 'basket') px(l, x - rw - 1, y - h - 1, kind === 'stripe' ? CREAM[6] : kind === 'dip' ? TEAL[5] : '#e8e4dc', rw * 2 + 2, 3);
  else px(l, x - rw, y - h - 1, '#c09c62', rw * 2, 2);
  return y - h;
}

function kentia(l: CanvasRenderingContext2D, x: number, top: number, Hh: number, seed: number) {
  const Rn = rng(seed);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -1.25 + (i / (n - 1)) * 2.5 + (Rn() - 0.5) * 0.25;
    const len = Hh * (0.75 + Rn() * 0.3);
    const ex = x + Math.sin(a) * len * 0.95;
    const ey = top - Math.cos(a) * len * 0.55 - len * 0.25;
    const cx = x + Math.sin(a) * len * 0.35;
    const cy = top - len * 0.95;
    curve(l, x, top, cx, cy, ex, ey, PALMLEAF[1], 1);
    // leaflets along the rachis, drooping, lit on the left
    for (let s = 0.2; s < 1; s += 0.07) {
      const qx = (1 - s) * (1 - s) * x + 2 * (1 - s) * s * cx + s * s * ex;
      const qy = (1 - s) * (1 - s) * top + 2 * (1 - s) * s * cy + s * s * ey;
      const ll = 9 * (1 - s * 0.6);
      const lit = Math.sin(a) < 0.2 ? 5 : 3;
      ln(l, qx, qy, qx - ll * 0.7, qy + ll * 0.8, PALMLEAF[lit - (s > 0.6 ? 1 : 0)]);
      ln(l, qx, qy, qx + ll * 0.7, qy + ll * 0.8, PALMLEAF[lit - 2]);
    }
  }
}

function cactus(l: CanvasRenderingContext2D, x: number, top: number, Hh: number, seed: number) {
  const C: Ramp = ['#1e4a34', '#28603e', '#357a4a', '#459458', '#5aac68', '#7ac47e'];
  const col = (cx: number, by: number, h: number, r: number) => {
    for (let j = 0; j < h; j++) {
      const capR = j > h - r ? Math.sqrt(Math.max(0, r * r - (j - (h - r)) ** 2)) : r;
      for (let i = -capR; i < capR; i++) {
        const t = (i + capR) / (2 * capR);
        let tone = t < 0.25 ? 4 : t < 0.5 ? 3 : t < 0.78 ? 2 : 1;
        if (Math.round(i + r) % 4 === 0) tone -= 1;
        px(l, cx + i, by - j, C[Math.max(0, tone)]);
      }
      if (j % 5 === 2) for (let i = -capR + 2; i < capR; i += 4) px(l, cx + i, by - j, '#f2f0d8');
    }
  };
  const Rn = rng(seed);
  col(x, top, Hh, 6);
  const arms = 1 + Math.floor(Rn() * 2);
  for (let i = 0; i < arms; i++) {
    const s = i % 2 ? 1 : -1;
    const ay = top - Hh * (0.35 + Rn() * 0.2);
    for (let j = 0; j < 9; j++) px(l, x + s * (5 + j), ay - j * 0.3, C[s < 0 ? 3 : 2], 3, 6);
    col(x + s * 13, ay, Hh * (0.3 + Rn() * 0.15), 4.5);
  }
  if (Rn() < 0.6) {
    dotFruit(l, x - 1, top - Hh - 1, '#f06a9a', 4);
    dotFruit(l, x + 3, top - Hh + 1, '#f8a0c0', 3);
  }
}

function pothos(l: CanvasRenderingContext2D, x: number, top: number, seed: number) {
  const Rn = rng(seed);
  const leaf = (lx: number, ly: number, s: number) => {
    const lit = Rn() < 0.6;
    ell(l, lx, ly, 4 * s, 3.2 * s, LEAF[lit ? 4 : 2]);
    ell(l, lx - 1, ly - 1, 2.4 * s, 1.8 * s, LEAF[lit ? 5 : 3]);
    if (Rn() < 0.4) px(l, lx, ly, '#d8e2a0', 2, 1);
    px(l, lx, ly + 3 * s - 1, LEAF[1], 1, 1);
  };
  // a mound over the rim, then trailing vines
  for (let i = 0; i < 12; i++) leaf(x - 10 + Rn() * 20, top - 6 + Rn() * 6, 1.1);
  for (let v = 0; v < 5; v++) {
    let vx = x - 12 + v * 6;
    let vy = top;
    const len = 18 + Rn() * 34;
    for (let j = 0; j < len; j += 4) {
      vx += (Rn() - 0.5) * 3 + (v - 2) * 0.4;
      vy += 4;
      px(l, vx, vy - 2, LEAF[1], 1, 4);
      leaf(vx + (j % 8 ? 3 : -3), vy, 0.9);
    }
  }
}

function agave(l: CanvasRenderingContext2D, x: number, top: number, seed: number) {
  const A: Ramp = ['#2a4a4a', '#386060', '#4a7876', '#5e908a', '#7aa89e', '#9cc2b4'];
  const Rn = rng(seed);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = -1.4 + (i / (n - 1)) * 2.8;
    const len = 16 + Rn() * 10 - Math.abs(a) * 2;
    const ex = x + Math.sin(a) * len * 1.1;
    const ey = top - Math.cos(a) * len * 0.9;
    fillPoly(l, [[x - 3, top], [x + 3, top], [ex, ey]], A[a < 0 ? 4 : 2]);
    ln(l, x, top, ex, ey, A[a < 0 ? 5 : 3]);
    px(l, ex, ey - 1, '#3a2a20', 1, 2);
  }
}

function strelitzia(l: CanvasRenderingContext2D, x: number, top: number, Hh: number, seed: number) {
  const Rn = rng(seed);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = -0.9 + (i / (n - 1)) * 1.8 + (Rn() - 0.5) * 0.3;
    const len = Hh * (0.55 + Rn() * 0.4);
    const sx = x + Math.sin(a) * len * 0.5;
    const sy = top - Math.cos(a) * len;
    ln(l, x + (i - 4) * 0.6, top, sx, sy, LEAF[2], 2);
    // the paddle leaf: a long ellipse along the stem's direction, a pale midrib, a tear or two
    const ang = a * 0.9;
    const L = 22 + Rn() * 10;
    const steps = 18;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const w = Math.sin(t * Math.PI) * 6;
      const cx = sx + Math.sin(ang) * L * t;
      const cy = sy - Math.cos(ang) * L * t;
      const lit = a < 0.1;
      ell(l, cx, cy, w, w * 0.55, LEAF[lit ? 4 : 2]);
      px(l, cx - w * 0.5, cy - 1, LEAF[lit ? 5 : 3], Math.max(1, Math.round(w * 0.5)), 1);
      px(l, cx, cy, '#a8c87a');
    }
    if (Rn() < 0.4) {
      const t = 0.5 + Rn() * 0.3;
      const cx = sx + Math.sin(ang) * L * t;
      const cy = sy - Math.cos(ang) * L * t;
      px(l, cx + 2, cy, 'rgba(0,0,0,0)', 1, 1);
      ln(l, cx + 1, cy, cx + 6, cy + 2, LEAF[1]);
    }
  }
  // the flower: an orange crest over a blue tongue on a beak-like spathe
  const fx = x + 10;
  const fy = top - Hh * 0.62;
  ln(l, x + 2, top, fx, fy, LEAF[2], 2);
  fillPoly(l, [[fx - 2, fy], [fx + 12, fy - 3], [fx + 1, fy + 3]], '#5a7a4a');
  fillPoly(l, [[fx + 2, fy - 2], [fx + 6, fy - 11], [fx + 8, fy - 2]], '#f2902a');
  fillPoly(l, [[fx + 6, fy - 3], [fx + 10, fy - 10], [fx + 11, fy - 3]], '#f8b040');
  px(l, fx + 7, fy - 3, '#3a5ab8', 4, 2);
}

const PLANTS = ['kentia', 'cactus', 'pothos', 'agave'] as const;
function pottedPlant(p: PropPainter, k: PropCtx, tall: boolean) {
  const [x, y] = anchor(p, 0.5, 0.5, 0);
  contactShadow(p.c, x + 8, y + 3, 18, 6, 0.38);
  const pick = Math.abs(Math.round(p.x * 5 + p.y * 3) + k.seed);
  const kind = tall ? (pick % 2 ? 'strelitzia' : 'cereus') : PLANTS[pick % PLANTS.length];
  layer(p.c, (l) => {
    if (kind === 'strelitzia') {
      const top = pot(l, x, y, 14, 18, 'basket', k.seed);
      strelitzia(l, x, top + 2, 92, k.seed);
    } else if (kind === 'cereus') {
      const top = pot(l, x, y, 13, 16, 'terrazzo', k.seed);
      cactus(l, x, top, 84, k.seed);
    } else if (kind === 'kentia') {
      const top = pot(l, x, y, 11, 15, 'stripe', k.seed);
      kentia(l, x, top, 58, k.seed);
    } else if (kind === 'cactus') {
      const top = pot(l, x, y, 10, 13, 'dip', k.seed);
      cactus(l, x, top, 38, k.seed);
    } else if (kind === 'pothos') {
      // a paint-tin pot up on a little stool, the vines spilling down
      for (const dx of [-8, 8]) ln(l, x + dx * 0.6, y - 18, x + dx, y, BEECH[3], 2);
      ell(l, x, y - 19, 11, 4, BEECH[2]);
      ell(l, x, y - 20, 10, 3.5, BEECH[4]);
      const top = pot(l, x, y - 20, 9, 13, 'tin', k.seed);
      pothos(l, x, top, k.seed);
    } else {
      const top = pot(l, x, y, 12, 12, 'terrazzo', k.seed);
      agave(l, x, top, k.seed);
    }
  }, { outline: 0.6 });
}
const plant: PropArt = { draw: (p, k) => pottedPlant(p, k, false) };
const plantTall: PropArt = { draw: (p, k) => pottedPlant(p, k, true) };

// ── shelving, canvases, the paint cart ──────────────────────
const shelf: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.1, 0.06, 0.9, 0.6, 14, 0.35);
    const H = 21;
    const pf = plyFace();
    for (const a of [0.08, 0.86]) lbox(p, a, 0.08, 0.06, 0.48, 0, H, { front: plyEdge(), side: pf, top: plyEdge(), edge: PLY[0] });
    lbox(p, 0.14, 0.08, 0.72, 0.04, 0.6, H - 0.6, mono(plyFace(['#5e4630', '#7a5c3e', '#957250', '#ad8a62', '#c2a076', '#d4b48a', '#e2c8a0']), PLY[0]));
    const Rn = rng(k.seed * 11 + 5);
    for (const z of [0.6, 5.6, 10.6, 15.6, 20.4]) {
      lbox(p, 0.14, 0.1, 0.72, 0.46, z, 0.6, { front: plyEdge(), side: plyEdge(), top: pf, edge: PLY[0] });
      if (z > 20) continue;
      const F = front(p, 0.46);
      let a = 0.17;
      while (a < 0.82) {
        const r = Rn();
        const zb = z + 0.6;
        if (r < 0.14 && a < 0.6) {
          // a trailing plant in a cup
          const [x, y] = F.F(a + 0.1, zb);
          layer(c, (l) => {
            pot(l, x, y, 5, 7, 'stripe', k.seed);
            pothos(l, x, y - 7, k.seed + Math.round(z));
          }, { outline: 0.6 });
          a += 0.24;
        } else if (r < 0.26 && a < 0.62) {
          // a box file / magazine holder
          const col = ['#e06a4a', '#2a8a86', '#e8b03e', '#f2ece0'][Math.floor(Rn() * 4)];
          pq(p, F, a, a + 0.16, zb, zb + 3.6, col);
          pq(p, F, a, a + 0.03, zb, zb + 3.6, lighten(col, 0.2));
          pq(p, F, a + 0.05, a + 0.11, zb + 2.2, zb + 2.8, '#f6f0e4');
          a += 0.18;
        } else if (r < 0.34) {
          // a jar of brushes
          const [x, y] = F.F(a + 0.06, zb);
          layer(c, (l) => {
            px(l, x - 3, y - 7, '#d8eaee', 6, 7);
            for (let i = 0; i < 4; i++) ln(l, x - 2 + i, y - 7, x - 4 + i * 2.4, y - 15, ['#c8382a', '#3a3036', '#e8b03e', '#2a5a8a'][i]);
          });
          a += 0.13;
        } else {
          const w = 0.035 + Rn() * 0.04;
          const h = 2.4 + Rn() * 1.6;
          const col = ['#e06a4a', '#2a5a7a', '#e8b03e', '#2a8a86', '#f2ece0', '#3a3036', '#c070a0', '#7a9a52'][Math.floor(Rn() * 8)];
          pq(p, F, a, a + w, zb, zb + h, col);
          pq(p, F, a, a + w * 0.3, zb, zb + h, lighten(col, 0.22));
          pq(p, F, a, a + w, zb + h * 0.72, zb + h * 0.72 + 0.25, lighten(col, 0.45));
          a += w + 0.006;
        }
      }
    }
  },
};

const canvases: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.05, 0.05, 0.95, 0.6, 12, 0.32);
    // stretched canvases leaning on the wall: big ones behind, small ones in front
    const set: [number, number, number, number, number][] = [
      [0.06, 0.94, 19, 0.12, -1],
      [0.14, 0.8, 15, 0.22, 2],
      [0.3, 0.92, 11, 0.34, -1],
      [0.12, 0.5, 8, 0.44, 0],
    ];
    for (const [a0, a1, h, b, kind] of set) {
      const lean = 0.1;
      const corners: V3[] = [[a0, b + lean, 0.2], [a1, b + lean, 0.2], [a1, b, h], [a0, b, h]];
      layer(c, (l) => {
        const q = into(p, l);
        if (kind < 0) {
          // its back: raw canvas wrap and pine stretcher bars
          solidFaces(q, [corners], () => (_l2: number, w: number, hh: number) => (u: number, v: number, x: number, y: number) => {
            const U = u / w;
            const V = v / hh;
            if (U < 0.06 || U > 0.94 || V < 0.05 || V > 0.95 || Math.abs(U - 0.5) < 0.03 || Math.abs(V - 0.5) < 0.025) return hash(x, y, 2) < 0.1 ? PINE[3] : PINE[4];
            return (x + y) & 1 && hash(x, y, 3) < 0.4 ? '#d8ccb4' : '#e6dcc8';
          });
        } else {
          const painted = (_l2: number, w: number, hh: number) => (u: number, v: number, x: number, y: number) => {
            const U = u / w;
            const V = v / hh;
            if (kind === 2) {
              if (V > 0.6) return hash(Math.floor(u / 3), Math.floor(v / 2), 4) < 0.1 ? '#f6d8a0' : '#f2a868';
              if (V > 0.4) return '#e0603e';
              return Math.abs(U - 0.5 - Math.sin(V * 9) * 0.1) < 0.08 ? '#2e3e6a' : '#3aa0b4';
            }
            const r = Math.hypot(U - 0.4, V - 0.6);
            if (r < 0.22) return '#e8b03e';
            void x;
            void y;
            return V < 0.3 ? '#2a8a86' : '#f4ead6';
          };
          solidFaces(q, [corners], () => painted);
        }
      }, { outline: 0.55 });
    }
    void k;
  },
};

const paintCart: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 10, 0.35);
    const m = coat(MINT);
    for (const [a, b] of [[0.2, 0.22], [0.74, 0.22], [0.2, 0.76], [0.74, 0.76]] as const) {
      pole(p, a + 0.03, b + 0.03, 0.8, 11.2, MINT, 2);
      const [x, y] = p.P(a + 0.03, b + 0.03, 0.4);
      ell(c, x, y, 2.5, 2, GEAR[1]);
    }
    const Rn = rng(k.seed * 5 + 9);
    for (const z of [1.2, 5.6, 10]) {
      lbox(p, 0.18, 0.2, 0.64, 0.6, z, 1.2, { front: m, side: m, top: (light) => (u, v, x, y) => (u % 8 < 1 || v % 8 < 1 ? MINT[2] : m(light, 64, 64)(u, v, x, y)), edge: MINT[0] });
      const tz = z + 1.2;
      layer(c, (l) => {
        if (z > 9) {
          // jars of water with brushes, tubes of paint, a sponge
          const [jx, jy] = p.P(0.34, 0.4, tz);
          px(l, jx - 4, jy - 9, '#bcd8e2', 8, 9);
          px(l, jx - 3, jy - 5, '#8aa8b8', 6, 5);
          for (let i = 0; i < 4; i++) ln(l, jx - 2 + i, jy - 9, jx - 5 + i * 3, jy - 19, ['#3a3036', '#c8382a', '#e8b03e', '#2a5a8a'][i]);
          for (let i = 0; i < 4; i++) {
            const [tx, ty] = p.P(0.5 + i * 0.07, 0.62, tz);
            fillPoly(l, [[tx - 6, ty], [tx + 2, ty - 4], [tx + 4, ty - 3], [tx - 4, ty + 1]], ['#e06a4a', '#2a8a86', '#e8b03e', '#5a7ac8'][i]);
            px(l, tx + 2, ty - 4, '#f6f0e4', 2, 1);
          }
          const [sx, sy] = p.P(0.72, 0.36, tz);
          px(l, sx - 4, sy - 3, '#f2d24a', 7, 3);
          px(l, sx - 4, sy - 3, '#7ab040', 7, 1);
        } else if (z > 5) {
          for (let i = 0; i < 4; i++) {
            const [sx, sy] = p.P(0.3 + i * 0.14, 0.48 + (i % 2) * 0.12, tz);
            const col = ['#e06a4a', '#f2ece0', '#2a8a86', '#3a3036'][Math.floor(Rn() * 4)];
            px(l, sx - 3, sy - 12, col, 6, 12);
            px(l, sx - 3, sy - 12, lighten(col, 0.3), 1, 12);
            px(l, sx - 2, sy - 14, ALU[4], 4, 2);
            px(l, sx - 1, sy - 15, GEAR[2], 2, 1);
          }
        } else {
          const [bx, by] = p.P(0.5, 0.5, tz);
          fillPoly(l, [[bx - 14, by], [bx, by - 7], [bx + 14, by], [bx, by + 7]], '#1e2a3a');
          fillPoly(l, [[bx - 12, by - 2], [bx, by - 8], [bx + 12, by - 2], [bx, by + 4]], '#f6f0e4');
          ell(l, bx + 6, by - 6, 4, 3, '#c8c4bc');
          ell(l, bx + 6, by - 6, 2, 1.5, '#8a867e');
        }
      });
    }
  },
};

// ── a costume rail, a reflector, a posing stool, a ring light ─
const rail: PropArt = {
  draw(p, k) {
    const W = k.w;
    const c = p.c;
    footShadow(p, 0.05, 0.2, W - 0.05, 0.8, 16, 0.32);
    // a black steel rail on castors with garments on wooden hangers
    for (const a of [0.12, W - 0.12]) {
      bar(p, [a, 0.3, 0.6], [a, 0.7, 0.6], GEAR[2], GEAR[4], 2);
      pole(p, a, 0.5, 0.6, 17, GEAR, 2);
      for (const b of [0.3, 0.7]) {
        const [x, y] = p.P(a, b, 0.3);
        ell(c, x, y, 2, 2, GEAR[0]);
      }
    }
    bar(p, [0.1, 0.5, 17], [W - 0.1, 0.5, 17], GEAR[3], GEAR[5], 2);
    const Rn = rng(k.seed * 3 + 1);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = 0.24 + (i * (W - 0.48)) / (n - 1) + (Rn() - 0.5) * 0.03;
      const [x, y] = p.P(a, 0.5, 17);
      const col = ['#e06a4a', '#f2ece0', '#2a8a86', '#e8b03e', '#3a5a9a', '#f0a6c0', '#3a3036', '#7a9a52'][Math.floor(Rn() * 8)];
      const long = Rn() < 0.4;
      const len = long ? 40 : 26;
      layer(c, (l) => {
        ln(l, x, y, x, y + 3, BEECH[2]);
        ln(l, x - 6, y + 6, x, y + 2, BEECH[3], 2);
        ln(l, x + 6, y + 6, x, y + 2, BEECH[3], 2);
        fillPoly(l, [[x - 7, y + 5], [x + 7, y + 5], [x + 8 + (long ? 3 : 0), y + len], [x - 8 - (long ? 3 : 0), y + len]], col);
        fillPoly(l, [[x - 7, y + 5], [x - 3, y + 5], [x - 4 - (long ? 2 : 0), y + len], [x - 8 - (long ? 3 : 0), y + len]], lighten(col, 0.16));
        fillPoly(l, [[x + 3, y + 5], [x + 7, y + 5], [x + 8 + (long ? 3 : 0), y + len], [x + 4, y + len]], darken(col, 0.2));
        if (!long && Rn() < 0.5) px(l, x - 1, y + 6, '#f6f0e4', 2, len - 8);
      }, { outline: 0.55 });
    }
    // a straw hat on top and a pair of trainers below
    const [hx, hy] = p.P(W * 0.3, 0.5, 17.8);
    layer(c, (l) => {
      ell(l, hx, hy, 10, 4, '#d8b878');
      ell(l, hx, hy - 3, 5, 3, '#e8cc90');
      px(l, hx - 5, hy - 2, '#3a3036', 10, 1);
    });
    const [sx, sy] = p.P(W * 0.62, 0.62, 0);
    layer(c, (l) => {
      for (const dx of [0, 9]) {
        fillPoly(l, [[sx + dx - 6, sy], [sx + dx + 3, sy - 4], [sx + dx + 6, sy - 2], [sx + dx - 3, sy + 2]], '#f6f2ea');
        px(l, sx + dx - 5, sy, '#e06a4a', 8, 1);
      }
    });
  },
};

const reflector: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 12, 0.29);
    // a C-stand: turtle base of three legs, a riser, a grip arm holding a gold disc
    layer(c, (l) => {
      const hub = p.P(0.5, 0.5, 2.4);
      for (const [a, b] of [[0.18, 0.62], [0.78, 0.66], [0.52, 0.18]] as const) {
        const f = p.P(a, b, 0);
        ln(l, hub[0], hub[1], f[0], f[1], ALU[3], 2);
        ln(l, hub[0], hub[1] - 1, f[0], f[1] - 1, ALU[5], 1);
      }
      const top = p.P(0.5, 0.5, 19);
      px(l, hub[0] - 1, top[1], ALU[3], 3, hub[1] - top[1]);
      px(l, hub[0] - 1, top[1], ALU[5], 1, hub[1] - top[1]);
      px(l, hub[0] - 3, top[1] - 2, GEAR[2], 7, 5);
      const arm = p.P(0.3, 0.3, 21);
      ln(l, top[0], top[1], arm[0], arm[1], ALU[3], 2);
      ell(l, arm[0], arm[1], 2, 2, GEAR[3]);
    }, { outline: 0.6 });
    // the reflector disc, tilted toward the set
    const C: V3 = [0.34, 0.34, 23];
    const pts: V3[] = [];
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      pts.push([C[0] + Math.cos(t) * 0.26 * 0.7, C[1] + Math.cos(t) * 0.26 * 0.7, C[2] + Math.sin(t) * 6.5 + Math.cos(t) * 1.5]);
    }
    const gold: Mat = (_l, w, h) => (u, v, x, y) => {
      const U = u / w - 0.5;
      const V = v / h - 0.5;
      const r = Math.hypot(U, V);
      if (r > 0.46) return GEAR[2];
      const crink = hash(Math.floor(u / 3), Math.floor(v / 3), 5);
      void x;
      void y;
      return crink < 0.3 ? '#f8e098' : crink < 0.7 ? '#e8c060' : U + V < 0 ? '#fff0b8' : '#c89a3a';
    };
    layer(c, (l) => solidFaces(into(p, l), [pts], () => gold), { outline: 0.6 });
    void k;
  },
};

const stool: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 7, y + 2, 13, 4, 0.32);
    layer(p.c, (l) => {
      for (const [dx, dy] of [[-9, -2], [8, -3], [-3, 4], [5, 3]] as const) {
        ln(l, x + dx * 0.55, y - 26, x + dx, y + dy, BEECH[3], 2);
        ln(l, x + dx * 0.55 - 1, y - 26, x + dx - 1, y + dy, BEECH[5], 1);
      }
      ell(l, x, y - 10, 8, 3.5, 'rgba(0,0,0,0)');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        px(l, x + Math.cos(a) * 7, y - 10 + Math.sin(a) * 3, BEECH[2]);
      }
      ell(l, x, y - 28, 11, 5, BEECH[2]);
      ell(l, x, y - 29, 10, 4.5, BEECH[4]);
      ell(l, x - 3, y - 30, 5, 2, BEECH[5]);
    }, { outline: 0.6 });
    void k;
  },
};

const ringLight: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.2, 0.2, 0.8, 0.8, 14, 0.29);
    layer(c, (l) => {
      const hub = p.P(0.5, 0.5, 4);
      for (const [a, b] of [[0.2, 0.7], [0.82, 0.62], [0.5, 0.16]] as const) {
        const f = p.P(a, b, 0);
        ln(l, hub[0], hub[1], f[0], f[1], GEAR[3], 2);
      }
      const top = p.P(0.5, 0.5, 21);
      px(l, hub[0] - 1, top[1], GEAR[3], 3, hub[1] - top[1]);
      px(l, hub[0] - 1, top[1], GEAR[5], 1, hub[1] - top[1]);
      // the ring, facing the room, with a phone clamped in its centre
      const [rx, ry] = p.P(0.52, 0.56, 25);
      ell(l, rx, ry, 17, 18, GEAR[1]);
      ell(l, rx, ry, 15, 16, '#fffaf0');
      ell(l, rx, ry, 11, 12, GEAR[1]);
      ell(l, rx, ry, 10, 11, 'rgba(0,0,0,0)');
      px(l, rx - 1, ry - 10, GEAR[2], 2, 20);
      fillPoly(l, [[rx - 4, ry - 7], [rx + 4, ry - 7], [rx + 4, ry + 7], [rx - 4, ry + 7]], GEAR[2]);
      fillPoly(l, [[rx - 3, ry - 6], [rx + 3, ry - 6], [rx + 3, ry + 6], [rx - 3, ry + 6]], '#2a3a5a');
    }, { outline: 0.6 });
    void k;
  },
  anim(p, k) {
    const [rx, ry] = p.P(0.52, 0.56, 25);
    const u = p.k / 4;
    p.c.globalAlpha = 0.1 + Math.sin(k.t * 1.2) * 0.01;
    ell(p.c, rx, ry, 30 * u, 30 * u, '#fff8e8');
    p.c.globalAlpha = 1;
  },
};

// ── the lounge corner: a beanbag, a record player, a floor lamp ─
const beanbag: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 9, y + 3, 26, 9, 0.41);
    const fr = fabric('#2a8a86');
    layer(p.c, (l) => {
      // a slouched pear: a wide base, a back that leans away, a dent where you sit
      for (let j = 0; j < 30; j++) {
        const t = j / 30;
        const w = 24 * (1 - t * t * 0.55) - (t > 0.75 ? (t - 0.75) * 30 : 0);
        const cx = x + t * 9;
        const cy = y - 3 - j;
        for (let i = -w; i < w; i++) {
          const u = (i + w) / (2 * w);
          let tone = u < 0.22 ? 4 : u < 0.5 ? 3 : u < 0.8 ? 2 : 1;
          if (t > 0.88) tone += 1;
          if (Math.floor(cx + i) % 3 === 0) tone -= 0.5;
          px(l, cx + i, cy, fr[Math.max(0, Math.min(5, Math.round(tone)))]);
        }
      }
      ell(l, x - 3, y - 15, 13, 5, fr[1]);
      ell(l, x - 4, y - 16, 11, 3.5, fr[2]);
      // a seam over the top, a carry handle, a paperback left on it
      curve(l, x - 14, y - 26, x + 4, y - 36, x + 22, y - 22, fr[1]);
      px(l, x + 6, y - 31, fr[0], 6, 2);
      fillPoly(l, [[x - 8, y - 14], [x + 1, y - 18], [x + 7, y - 15], [x - 2, y - 11]], '#e0603e');
      fillPoly(l, [[x - 6, y - 14], [x + 1, y - 17], [x + 5, y - 15], [x - 2, y - 12]], '#f6f0e4');
    }, { outline: 0.6 });
    void k;
  },
};

// ── a dog asleep in its bed, an inflatable flamingo, gear cases ─
const dogbed: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 8, y + 3, 24, 8, 0.35);
    const bed = fabric('#c8b08a');
    const fur = ['#6e3412', '#94481a', '#b86224', '#d47e34', '#e89c50', '#f4ba74'];
    layer(p.c, (l) => {
      ell(l, x, y - 4, 24, 11, bed[1]);
      ell(l, x, y - 6, 23, 10, bed[3]);
      ell(l, x - 2, y - 7, 18, 7, bed[2]);
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        px(l, x + Math.cos(t) * 21, y - 6 + Math.sin(t) * 9, bed[4], 2, 1);
      }
      // the dog, curled nose to tail
      ell(l, x + 2, y - 10, 14, 7, fur[2]);
      ell(l, x, y - 12, 12, 5, fur[3]);
      ell(l, x - 3, y - 13, 7, 3, fur[4]);
      ell(l, x - 10, y - 9, 6, 5, fur[3]);
      ell(l, x - 12, y - 8, 3.5, 2.6, '#f2e6cc');
      fillPoly(l, [[x - 13, y - 13], [x - 11, y - 18], [x - 8, y - 13]], fur[2]);
      px(l, x - 14, y - 9, '#1a1418', 2, 1);
      px(l, x - 10, y - 11, '#3a2a22', 2, 1);
      curve(l, x + 14, y - 8, x + 10, y - 2, x - 4, y - 4, '#f4e2c0', 3);
      px(l, x - 4, y - 7, '#c8443a', 4, 2);
    }, { outline: 0.6 });
    void k;
  },
  anim(p, k) {
    // a slow breath and the odd twitch of an ear
    const [x, y] = anchor(p, 0.5, 0.55);
    const u = p.k / 4;
    const br = Math.sin(k.t * 1.6) > 0 ? 1 : 0;
    px(p.c, x - 2 * u, y - (17 + br) * u, '#d47e34', Math.max(1, 8 * u), Math.max(1, u));
  },
};

const flamingo: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.55);
    contactShadow(p.c, x + 8, y + 3, 26, 9, 0.32);
    const pk = ['#a83a6a', '#c84e84', '#e06a9e', '#f08ab6', '#f8aed0', '#fdd2e6'];
    layer(p.c, (l) => {
      // the ring lying on the floor
      for (let j = 0; j < 9; j++) {
        const t = j / 8;
        ell(l, x, y - 2 - j, 24 - Math.abs(t - 0.5) * 6, 11 - Math.abs(t - 0.5) * 3, pk[Math.min(5, 1 + Math.round(t * 3))]);
      }
      ell(l, x + 1, y - 7, 13, 5.5, '#2a2226');
      ell(l, x - 8, y - 11, 8, 2.5, pk[5]);
      // the neck rising in an S, the head and its black-tipped beak
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const nx = x + 14 + Math.sin(t * 3.2) * 7;
        const ny = y - 10 - t * 36;
        ell(l, nx, ny, 4, 3, pk[t < 0.5 ? 3 : 4]);
      }
      ell(l, x + 12, y - 48, 6, 5, pk[4]);
      fillPoly(l, [[x + 6, y - 48], [x - 2, y - 44], [x + 6, y - 45]], '#f6f0e4');
      fillPoly(l, [[x - 2, y - 44], [x + 1, y - 45], [x + 1, y - 43]], '#1e1e24');
      px(l, x + 10, y - 50, '#1e1e24', 2, 2);
    }, { outline: 0.6 });
    void k;
  },
};

const cases: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.2, 0.85, 0.85, 8, 0.35);
    const shell = (light: 0 | 1 | 2) => (_u: number, v: number, x: number, y: number) => GEAR[(light === 2 ? 4 : light ? 3 : 2) + (v % 7 < 1 ? -1 : 0) + (hash(x, y, 3) < 0.04 ? 1 : 0)] ?? GEAR[0];
    lbox(p, 0.18, 0.3, 0.6, 0.45, 0, 4.6, { front: shell, side: shell, top: shell, edge: GEAR[0] });
    lbox(p, 0.24, 0.36, 0.5, 0.36, 4.6, 3.6, { front: shell, side: shell, top: shell, edge: GEAR[0] });
    const F = front(p, 0.75);
    for (const a of [0.3, 0.62]) pq(p, F, a, a + 0.06, 2.6, 3.6, '#f2c84a');
    const F2 = front(p, 0.72);
    pq(p, F2, 0.4, 0.58, 7.2, 7.6, GEAR[5]);
    // a long light-stand bag leaning beside
    const [bx, by] = anchor(p, 0.86, 0.55, 0);
    layer(p.c, (l) => {
      ln(l, bx, by, bx - 6, by - 44, GEAR[2], 6);
      ln(l, bx - 2, by, bx - 8, by - 44, GEAR[4], 1);
      px(l, bx - 6, by - 26, '#e0603e', 6, 2);
    }, { outline: 0.6 });
    void k;
  },
};

const records: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 8, 0.35);
    // a crate of records with a turntable on top
    const crate = pine(['#5a3e26', '#765234', '#926844', '#aa8056', '#c09868', '#d4b07e']);
    lbox(p, 0.2, 0.2, 0.6, 0.6, 0, 5.4, { front: crate, side: crate, top: crate, edge: '#3a2818' });
    const F = front(p, 0.8);
    const S = side(p, 0.8);
    pq(p, F, 0.28, 0.72, 3.4, 4.4, '#3a2818');
    pq(p, S, 0.28, 0.72, 3.4, 4.4, '#2e2014');
    for (let i = 0; i < 7; i++) {
      const col = ['#e06a4a', '#f2ece0', '#2a5a7a', '#e8b03e', '#3a3036', '#2a8a86', '#f0a6c0'][i];
      pq(p, F, 0.24 + i * 0.075, 0.3 + i * 0.075, 0.6, 3.2, col);
    }
    lbox(p, 0.16, 0.2, 0.68, 0.6, 5.4, 1.2, { front: pine(WALNUT), side: pine(WALNUT), top: felt(CHAR), edge: WALNUT[0] });
    const [tx, ty] = p.P(0.46, 0.5, 6.6);
    layer(c, (l) => {
      ell(l, tx, ty, 15, 8, GEAR[1]);
      ell(l, tx, ty - 1, 14, 7, GEAR[2]);
      for (let r = 4; r < 14; r += 3) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          if (i % 3) continue;
          px(l, tx + Math.cos(a) * r, ty - 1 + Math.sin(a) * r * 0.5, GEAR[3]);
        }
      }
      ell(l, tx, ty - 1, 4, 2, '#e06a4a');
      px(l, tx - 6, ty - 4, GEAR[5], 6, 1);
      const [ax, ay] = p.P(0.74, 0.32, 6.8);
      ln(l, ax, ay, tx + 6, ty - 3, ALU[4], 1);
      ell(l, ax, ay, 2, 2, ALU[3]);
    });
    void k;
  },
};

const floorLamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 2, 16, 5, 0.35);
    layer(p.c, (l) => {
      // a beech tripod and a big pleated linen drum
      for (const [dx, dy] of [[-14, 2], [12, 0], [0, -8]] as const) {
        ln(l, x, y - 44, x + dx, y + dy, BEECH[3], 2);
        ln(l, x - 1, y - 44, x + dx - 1, y + dy, BEECH[5], 1);
      }
      px(l, x - 1, y - 58, BEECH[2], 2, 16);
      fillPoly(l, [[x - 16, y - 54], [x + 16, y - 54], [x + 13, y - 78], [x - 13, y - 78]], '#efe2c8');
      for (let i = -14; i <= 14; i += 3) ln(l, x + i, y - 54, x + i * 0.82, y - 78, '#dccaa8');
      fillPoly(l, [[x - 16, y - 54], [x - 8, y - 54], [x - 7, y - 78], [x - 13, y - 78]], '#f8eedc');
      px(l, x - 16, y - 55, '#fff2c8', 32, 2);
    }, { outline: 0.6 });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const u = p.k / 4;
    p.c.globalAlpha = 0.1 + Math.sin(k.t * 1.1) * 0.01;
    ell(p.c, x, y - 40 * u, 30 * u, 40 * u, '#ffe7a8');
    p.c.globalAlpha = 1;
  },
};

// ── boxes, a plan chest, surfboards in the corner ───────────
const boxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.12, 0.12, 0.88, 0.88, 8, 0.35);
    const KR: Ramp = ['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70', '#e6c48c'];
    const kb = cardboard(KR);
    const stack: [number, number, number, number, number][] = [
      [0.14, 0.18, 0.64, 0.62, 0],
      [0.2, 0.22, 0.52, 0.5, 3.8],
      [0.3, 0.32, 0.36, 0.34, 7.2],
    ];
    for (const [a, b, w, d, z] of stack) {
      lbox(p, a, b, w, d, z, 3.4, mono(kb, '#5a3e22'));
      const F = front(p, b + d);
      pq(p, F, a + w * 0.42, a + w * 0.58, z, z + 3.4, '#c8b48a');
      pq(p, F, a + 0.06, a + w * 0.36, z + 1.2, z + 2.6, '#f6f0e2');
      pq(p, F, a + 0.08, a + w * 0.3, z + 1.7, z + 1.9, '#e06a4a');
    }
    // a skateboard leaning on the stack and a poster tube
    const [sx, sy] = anchor(p, 0.86, 0.66, 0);
    layer(p.c, (l) => {
      ln(l, sx, sy, sx - 6, sy - 38, '#2a2a30', 5);
      ln(l, sx - 1, sy, sx - 7, sy - 38, '#e06a4a', 1);
      for (const t of [0.2, 0.8]) {
        const wx = sx - 6 * t;
        const wy = sy - 38 * t;
        px(l, wx + 3, wy - 1, '#f2e6c0', 3, 3);
      }
      ln(l, sx - 30, sy + 2, sx - 22, sy - 30, '#c8a070', 4);
      ell(l, sx - 22, sy - 31, 2, 1.5, '#2a2a30');
    }, { outline: 0.6 });
    void k;
  },
};

const planChest: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.1, 0.12, 0.9, 0.88, 7, 0.35);
    const pf = plyFace();
    lbox(p, 0.1, 0.14, 0.8, 0.72, 0, 8.4, { front: pf, side: pf, top: pf, edge: PLY[0] });
    const F = front(p, 0.86);
    for (let i = 0; i < 5; i++) {
      const z = 0.6 + i * 1.5;
      pq(p, F, 0.14, 0.86, z, z + 1.3, PLY[F.light ? 4 : 2]);
      pq(p, F, 0.14, 0.86, z, z + 0.15, PLY[1]);
      pq(p, F, 0.42, 0.58, z + 0.5, z + 0.8, ALU[F.light ? 4 : 2]);
    }
    layer(c, (l) => {
      const [x, y] = p.P(0.5, 0.5, 8.4);
      for (let i = 0; i < 5; i++) fillPoly(l, [[x - 22, y - i], [x - 2, y - 10 - i], [x + 22, y - i], [x + 2, y + 10 - i]], i % 2 ? '#f6f0e4' : '#ebe2d0');
      fillPoly(l, [[x - 16, y - 6], [x - 2, y - 13], [x + 12, y - 6], [x - 2, y + 1]], '#2a8a86');
      ell(l, x + 2, y - 7, 4, 2, '#e8b03e');
      ln(l, x - 12, y - 4, x + 6, y - 12, '#3a3036');
      // a desk lamp clipped on
      const [lx, ly] = p.P(0.82, 0.24, 8.4);
      ln(l, lx, ly, lx - 4, ly - 18, GEAR[2], 2);
      fillPoly(l, [[lx - 10, ly - 22], [lx, ly - 22], [lx - 2, ly - 14], [lx - 8, ly - 14]], '#e8b03e');
    });
    void k;
  },
};

const surfboards: PropArt = {
  draw(p, k) {
    const c = p.c;
    footShadow(p, 0.1, 0.05, 0.9, 0.6, 18, 0.32);
    const board = (a: number, b: number, h: number, wdt: number, col: string, stripe: string) => {
      const [x0, y0] = p.P(a, b, 0.4);
      const [x1, y1] = p.P(a - 0.04, b - 0.18, h);
      layer(c, (l) => {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const w = wdt * Math.sqrt(Math.max(0, Math.sin(Math.min(1, t * 1.15) * Math.PI))) + 1;
          const x = x0 + (x1 - x0) * t;
          const y = y0 + (y1 - y0) * t;
          px(l, x - w, y, col, w * 2, 1);
          px(l, x - w, y, lighten(col, 0.3), Math.max(1, w * 0.5), 1);
          if (Math.abs(t - 0.45) < 0.04 || Math.abs(t - 0.52) < 0.02) px(l, x - w, y, stripe, w * 2, 1);
          px(l, x - 0.5, y, darken(col, 0.12), 1, 1);
        }
      }, { outline: 0.6 });
    };
    board(0.3, 0.32, 24, 9, '#f2ece0', '#e06a4a');
    board(0.64, 0.38, 17, 10, '#7ac7bb', '#f2ece0');
    void k;
  },
};

export const STUDIO_LOUNGE: Record<string, PropArt> = {
  sofa,
  coffeeTable,
  armchair,
  counter,
  plant,
  plantTall,
  std_shelf: shelf,
  std_canvases: canvases,
  std_paintCart: paintCart,
  std_rail: rail,
  std_reflector: reflector,
  std_stool: stool,
  std_ringLight: ringLight,
  std_beanbag: beanbag,
  std_dogbed: dogbed,
  std_flamingo: flamingo,
  std_cases: cases,
  std_records: records,
  std_floorLamp: floorLamp,
  std_boxes: boxes,
  std_planChest: planChest,
  std_surfboards: surfboards,
};
export { pot, kentia, cactus, agave, pothos, strelitzia };

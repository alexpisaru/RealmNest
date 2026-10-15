// Office — the studio's furniture at 128×64 (1 z unit ≈ 10 cm; a person is ~17.5 z).
// A warm, design-literate office in a historic building: oak and black steel
// desks, a white-oak meeting table, a sage coffee bar with an espresso
// machine, a terracotta velvet sofa, a blue wingback, oak bookcases, an
// arc lamp, a mint fridge, a bentwood coat stand… and the cut front walls.
import { darken, lighten, mix } from '../../../color';
import type { Mat } from '../../../hd/kit';
import type { PropPainter } from '../../../iso';
import type { PropArt, PropCtx } from '../../../props';
import { at, contactShadow, curve, dotFruit, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, R, type Ramp, rng } from '../../kit4';
import { bricks4, plaster4, siding4 } from '../../materials4';
import { front, pq, pt, side } from '../../plane4';
import { brushed, grain, paint, velvet } from '../materials';
import { anchor, footShadow, lbox, mono } from '../util';

const OAK: Ramp = ['#3d2617', '#5a3a22', '#7a5230', '#9a6b40', '#b88752', '#d2a46a', '#e6c08a'];
const WHITEOAK: Ramp = ['#6a5238', '#86684a', '#a2835e', '#bb9c74', '#d0b38a', '#e2c9a2', '#f0dcba'];
const STEEL: Ramp = ['#141418', '#1e1e24', '#2a2a32', '#383842', '#4a4a56', '#62626e'];
const CHROME: Ramp = ['#4a4e58', '#6a707c', '#8e94a0', '#b4bac4', '#d8dce2', '#f4f6f8'];
const BRASS: Ramp = ['#5a4218', '#7e5e22', '#a47c30', '#c89c42', '#e2bc5e', '#f4da8c'];
const SAGE: Ramp = ['#3e4c3e', '#4f5f4c', '#62735d', '#768a70', '#8da285', '#a7b99e'];
const MINT: Ramp = ['#4e7a6c', '#64947e', '#7eae96', '#9ac6ae', '#b6dcc6', '#d2eedc'];
const IVORY: Ramp = ['#8e877a', '#aaa393', '#c4bdac', '#d8d2c2', '#e8e3d6', '#f6f2e8'];
const TERRA: Ramp = ['#6e2a1c', '#8c3a26', '#a84c32', '#c0603f', '#d47a58', '#e49a7a'];
const POT: Ramp = ['#6a3220', '#8a432a', '#a85a38', '#c07448', '#d48e5e', '#e4a878'];

/** Fabric ramp around a colour. */
const fabric = (col: string): Ramp => [darken(col, 0.5), darken(col, 0.34), darken(col, 0.18), col, lighten(col, 0.16), lighten(col, 0.3)];

const oakTop = grain(OAK);
const steel = paint(STEEL);

// ── the task chair (pushed aside by its owner) ──────────────
function taskChair(p: PropPainter, a: number, b: number, seed: number) {
  const [x, y] = anchor(p, a, b);
  contactShadow(p.c, x + 6, y + 2, 13, 4, 0.26);
  layer(p.c, (l) => {
    // five-star base with castors
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + seed;
      const ex = x + Math.cos(ang) * 11;
      const ey = y + Math.sin(ang) * 5;
      ln(l, x, y - 3, ex, ey - 2, STEEL[2], 2);
      px(l, ex - 1, ey - 2, STEEL[0], 3, 3);
    }
    // gas lift
    px(l, x - 1, y - 16, CHROME[3], 3, 13);
    px(l, x - 1, y - 16, CHROME[5], 1, 13);
    // seat: a padded charcoal cushion
    ell(l, x, y - 18, 13, 6, '#2e3036');
    ell(l, x - 1, y - 19, 12, 5, '#44464e');
    ell(l, x - 3, y - 20, 7, 2.5, '#5a5c66');
    // mesh back
    fillPoly(l, [[x - 10, y - 22], [x + 8, y - 25], [x + 9, y - 44], [x - 9, y - 41]], '#2a2c32');
    for (let j = 0; j < 9; j++) ln(l, x - 9, y - 24 - j * 2, x + 8, y - 27 - j * 2, '#3e4048');
    fillPoly(l, [[x - 10, y - 41], [x + 9, y - 44], [x + 9, y - 46], [x - 10, y - 43]], '#4a4c54');
    // armrests
    for (const s of [-1, 1]) {
      ln(l, x + s * 11, y - 18, x + s * 11, y - 26, STEEL[3], 2);
      px(l, x + s * 11 - 3, y - 27, '#2a2c32', 7, 2);
    }
  });
}

/** A monitor on a slim stand, facing the room; the screen is filled by anim. */
function monitor(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number) {
  const F = front(p, b);
  const am = (a0 + a1) / 2;
  // stand: a foot plate and an arm up to the back of the screen
  lbox(p, am - 0.12, b - 0.14, 0.24, 0.12, 7.4, 0.3, mono(steel, STEEL[0]));
  lbox(p, am - 0.025, b - 0.08, 0.05, 0.05, 7.6, z0 - 7.6 + 1.5, mono(steel, STEEL[0]));
  lbox(p, a0, b - 0.03, a1 - a0, 0.03, z0, z1 - z0, { front: paint(STEEL), side: paint(STEEL), top: paint(STEEL), edge: STEEL[0] });
  pq(p, F, a0 + 0.02, a1 - 0.02, z0 + 0.35, z1 - 0.3, '#10141c');
  pq(p, F, a0, a1, z0, z0 + 0.35, STEEL[3]);
}

/** Live screen content: code, charts or a design canvas, scrolling slowly. */
function screen(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number, t: number, seed: number, kind: number) {
  const F = front(p, b);
  const w = a1 - a0;
  if (kind === 0) {
    // code: indented coloured lines scrolling up
    const n = 7;
    const off = (t * 0.6 + seed) % 1;
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.6 + ((i + off) / n) * (z1 - z0 - 1.2);
      const ind = (hash(i + Math.floor(t * 0.6 + seed), 1, seed) * 3) | 0;
      const len = 0.2 + hash(i + Math.floor(t * 0.6 + seed), 2, seed) * 0.5;
      const col = ['#7ec8f2', '#f2c86a', '#e88aa8', '#9ae0a4'][(i + ind) % 4];
      const [x0, y0] = F.F(a0 + 0.06 + ind * 0.05, z);
      const [x1, y1] = F.F(Math.min(a1 - 0.05, a0 + 0.06 + ind * 0.05 + len * w), z);
      ln(p.c, x0, y0, x1, y1, col);
    }
  } else if (kind === 1) {
    // a dashboard: bars that breathe and a line chart
    for (let i = 0; i < 6; i++) {
      const h = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3 + seed))) * (z1 - z0 - 1.4);
      pq(p, F, a0 + 0.06 + i * w * 0.08, a0 + 0.06 + i * w * 0.08 + w * 0.05, z0 + 0.6, z0 + 0.6 + h * 0.6, i === 4 ? '#f2b84b' : '#5fd38d');
    }
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 8; i++) {
      const u = a0 + w * 0.55 + (i / 8) * w * 0.38;
      const z = z0 + 1 + (0.5 + 0.4 * Math.sin(i * 0.9 + t * 0.5 + seed)) * (z1 - z0 - 2);
      const q = F.F(u, z);
      if (prev) ln(p.c, prev[0], prev[1], q[0], q[1], '#7ec8f2');
      prev = q;
    }
  } else {
    // a design canvas: artboards and a moving cursor
    pq(p, F, a0 + 0.05, a1 - 0.05, z0 + 0.4, z1 - 0.35, '#2a2e38');
    pq(p, F, a0 + 0.1, a0 + w * 0.45, z0 + 0.9, z1 - 0.9, '#f6f0e2');
    pq(p, F, a0 + w * 0.52, a1 - 0.1, z0 + 0.9, z1 - 0.9, '#f6f0e2');
    pq(p, F, a0 + 0.14, a0 + w * 0.4, z1 - 2.4, z1 - 1.3, '#e2553b');
    pq(p, F, a0 + w * 0.56, a1 - 0.14, z0 + 1.2, z0 + 2.2, '#3fb68b');
    const cu = a0 + w * (0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.7 + seed)));
    const cz = z0 + (z1 - z0) * (0.4 + 0.2 * Math.cos(t * 0.9 + seed));
    const [cx, cy] = F.F(cu, cz);
    px(p.c, cx, cy, '#ffffff', 2, 3);
  }
}

// ── desks ───────────────────────────────────────────────────
const desk: PropArt = {
  draw(p, k) {
    const W = k.w;
    const v = k.variant ?? 'single';
    const Z = 7.4;
    footShadow(p, 0.15, 0.15, W - 0.15, 0.9, 8, 0.24);
    // sled legs: black steel loops at both ends, a cable tray between
    for (const a of [0.2, W - 0.26]) {
      lbox(p, a, 0.2, 0.06, 0.62, 0, 0.5, mono(steel, STEEL[0]));
      lbox(p, a, 0.2, 0.06, 0.06, 0, Z, mono(steel, STEEL[0]));
      lbox(p, a, 0.76, 0.06, 0.06, 0, Z, mono(steel, STEEL[0]));
    }
    lbox(p, 0.3, 0.24, W - 0.6, 0.12, 4.6, 0.9, mono(steel, STEEL[0]));
    // a drawer pedestal on the left in oak with brass pulls
    lbox(p, 0.34, 0.24, 0.42, 0.56, 0, Z - 0.5, { front: siding4(OAK, 9), side: siding4(OAK, 9), top: oakTop, edge: OAK[0] });
    const F = front(p, 0.8);
    for (const z of [1.6, 3.9, 6.2]) {
      const [hx, hy] = F.F(0.55, z);
      px(p.c, hx - 4, hy - 1, BRASS[4], 8, 2);
      px(p.c, hx - 4, hy, BRASS[1], 8, 1);
    }
    // the oak top
    lbox(p, 0.12, 0.12, W - 0.24, 0.76, Z - 0.5, 0.5, { front: oakTop, side: oakTop, top: oakTop, edge: OAK[1] });
    const tz = Z;
    // things on the desk
    if (v === 'dual') {
      monitor(p, 0.42, 0.98, 0.32, 8.6, 12.6);
      monitor(p, 1.02, 1.58, 0.32, 8.6, 12.6);
    } else if (v === 'laptop') {
      // a laptop on a wooden riser
      lbox(p, 0.72, 0.36, 0.56, 0.3, tz, 1.2, { front: oakTop, side: oakTop, top: oakTop, edge: OAK[1] });
      lbox(p, 0.74, 0.38, 0.52, 0.26, tz + 1.2, 0.2, mono(brushed(CHROME), CHROME[1]));
      lbox(p, 0.74, 0.36, 0.52, 0.03, tz + 1.4, 3.6, mono(brushed(CHROME), CHROME[1]));
      pq(p, front(p, 0.39), 0.77, 1.23, tz + 1.7, tz + 4.8, '#10141c');
    } else {
      monitor(p, 0.62, 1.38, 0.32, 8.6, 13.2);
      // a brass task lamp
      const [lx, ly] = anchor(p, W - 0.42, 0.34, tz);
      layer(p.c, (l) => {
        ell(l, lx, ly, 7, 3, BRASS[2]);
        ell(l, lx - 1, ly - 1, 6, 2, BRASS[4]);
        ln(l, lx, ly - 1, lx - 4, ly - 26, BRASS[3], 2);
        ln(l, lx - 4, ly - 26, lx + 8, ly - 34, BRASS[3], 2);
        fillPoly(l, [[lx + 4, ly - 36], [lx + 16, ly - 30], [lx + 14, ly - 26], [lx + 4, ly - 31]], '#2e4a3a');
        fillPoly(l, [[lx + 6, ly - 30], [lx + 14, ly - 26], [lx + 12, ly - 26], [lx + 6, ly - 29]], '#fff0c0');
      });
    }
    // keyboard, mouse, a mug, a notebook, a small plant
    const [kx, ky] = anchor(p, W / 2, 0.62, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[kx - 18, ky + 2], [kx + 4, ky - 9], [kx + 18, ky - 2], [kx - 4, ky + 9]], '#d8d8dc');
      fillPoly(l, [[kx - 16, ky + 2], [kx + 4, ky - 8], [kx + 16, ky - 2], [kx - 4, ky + 8]], '#eeeef0');
      for (let i = 0; i < 5; i++) ln(l, kx - 13 + i * 3, ky + 3 - i * 1.5, kx + 1 + i * 3, ky + 3 - i * 1.5 - 7, '#c8c8ce');
      ell(l, kx + 22, ky - 2, 3, 2, '#e8e8ec');
      // the notebook with a pencil
      fillPoly(l, [[kx - 34, ky - 4], [kx - 22, ky - 10], [kx - 12, ky - 5], [kx - 24, ky + 1]], '#c8443a');
      fillPoly(l, [[kx - 32, ky - 4], [kx - 22, ky - 9], [kx - 14, ky - 5], [kx - 24, ky]], '#f6f0e2');
      ln(l, kx - 28, ky - 3, kx - 18, ky - 8, '#e2b23a', 1);
    });
    const [mx, my] = anchor(p, W - 0.3, 0.6, tz);
    layer(p.c, (l) => {
      px(l, mx - 4, my - 9, '#f2ead8', 8, 9);
      px(l, mx - 4, my - 9, '#ffffff', 2, 9);
      px(l, mx + 4, my - 7, '#e2dac8', 3, 5);
      ell(l, mx, my - 9, 4, 1.5, '#4a2e1e');
    });
    if (v !== 'single') {
      const [sx, sy] = anchor(p, 0.3, 0.3, tz);
      layer(p.c, (l) => {
        fillPoly(l, [[sx - 5, sy - 8], [sx + 5, sy - 8], [sx + 4, sy], [sx - 4, sy]], '#e8e0d0');
        foliage(l, [{ x: sx, y: sy - 12, rx: 6, ry: 5, z: 1 }], R.birch, k.seed + 7, { cell: 2.2, tilt: 0.3 });
      });
    }
    // the chair, rolled out to the right
    taskChair(p, W - 0.42, 1.12, k.seed * 0.7);
  },
  anim(p, k) {
    const v = k.variant ?? 'single';
    const kind = k.seed % 3;
    if (v === 'dual') {
      screen(p, 0.44, 0.96, 0.32, 8.95, 12.3, k.t, k.seed, kind);
      screen(p, 1.04, 1.56, 0.32, 8.95, 12.3, k.t, k.seed + 5, (kind + 1) % 3);
    } else if (v === 'laptop') screen(p, 0.78, 1.22, 0.39, 6 + 1.7 + 1.4, 6 + 4.6 + 1.4, k.t, k.seed, kind);
    else screen(p, 0.64, 1.36, 0.32, 8.95, 12.9, k.t, k.seed, kind);
  },
};

// ── meeting table ───────────────────────────────────────────
const table: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const Z = 7.4;
    footShadow(p, 0.2, 0.2, W - 0.2, D - 0.2, 8, 0.24);
    const wo = grain(WHITEOAK);
    // two trestle legs in black steel and a long white-oak top with a bevelled edge
    for (const a of [0.55, W - 0.65]) {
      lbox(p, a, 0.35, 0.1, D - 0.7, 0, 0.5, mono(steel, STEEL[0]));
      lbox(p, a + 0.02, D / 2 - 0.05, 0.06, 0.1, 0.5, Z - 1.1, mono(steel, STEEL[0]));
      lbox(p, a, 0.35, 0.1, D - 0.7, Z - 1.1, 0.5, mono(steel, STEEL[0]));
    }
    lbox(p, 0.1, 0.12, W - 0.2, D - 0.24, Z - 0.6, 0.6, { front: wo, side: wo, top: wo, edge: WHITEOAK[1] });
    // a runner of linen, laptops, notebooks, a carafe, glasses and a vase of tulips
    const tz = Z;
    const P = (a: number, b: number) => anchor(p, a, b, tz);
    layer(p.c, (l) => {
      const r0 = P(0.5, D / 2 - 0.12);
      const r1 = P(W - 0.5, D / 2 - 0.12);
      const r2 = P(W - 0.5, D / 2 + 0.12);
      const r3 = P(0.5, D / 2 + 0.12);
      fillPoly(l, [r0, r1, r2, r3], '#e8dcc4');
      // laptops facing their owners: a thin silver base on the table, the lid up at its far edge
      const Q = (a: number, b: number, z: number) => anchor(p, a, b, tz + z);
      for (const [a, b, open, toFront] of [[0.8, 0.36, 1, 0], [1.95, D - 0.36, 1, 1], [2.5, 0.36, 0, 0]] as const) {
        const hw = 0.15;
        const hd = 0.1;
        const b0 = b - hd;
        const b1 = b + hd;
        // the base: a silver slab with a darker keyboard
        fillPoly(l, [Q(a - hw, b0, 0.35), Q(a + hw, b0, 0.35), Q(a + hw, b1, 0.35), Q(a - hw, b1, 0.35)], '#cfd3d9');
        fillPoly(l, [Q(a - hw, b1, 0), Q(a + hw, b1, 0), Q(a + hw, b1, 0.35), Q(a - hw, b1, 0.35)], '#9aa0aa');
        fillPoly(l, [Q(a + hw, b0, 0), Q(a + hw, b1, 0), Q(a + hw, b1, 0.35), Q(a + hw, b0, 0.35)], '#a8aeb8');
        const kb0 = toFront ? b0 + 0.02 : b0 + 0.08;
        fillPoly(l, [Q(a - hw + 0.03, kb0, 0.36), Q(a + hw - 0.03, kb0, 0.36), Q(a + hw - 0.03, kb0 + 0.1, 0.36), Q(a - hw + 0.03, kb0 + 0.1, 0.36)], '#5a606a');
        if (!open) continue;
        // the lid stands at the edge away from its owner, leaning back a little
        const bl = toFront ? b0 : b1;
        const lean = toFront ? -0.04 : 0.04;
        const lid = [Q(a - hw, bl, 0.35), Q(a + hw, bl, 0.35), Q(a + hw, bl + lean, 2.9), Q(a - hw, bl + lean, 2.9)];
        if (toFront) {
          // the screen faces us
          fillPoly(l, lid, '#2a2e36');
          fillPoly(l, [Q(a - hw + 0.02, bl, 0.6), Q(a + hw - 0.02, bl, 0.6), Q(a + hw - 0.02, bl + lean, 2.7), Q(a - hw + 0.02, bl + lean, 2.7)], '#4f7fb4');
          fillPoly(l, [Q(a - hw + 0.04, bl, 2.1), Q(a + 0.02, bl, 2.1), Q(a + 0.02, bl + lean, 2.5), Q(a - hw + 0.04, bl + lean, 2.5)], '#9cc4ea');
        } else {
          // we see the lid's back: silver with a little logo
          fillPoly(l, lid, '#c4c9d0');
          const [lx, ly] = Q(a, bl + lean / 2, 1.7);
          px(l, lx - 1, ly - 1, '#f2f4f8', 3, 3);
        }
      }
      // notebooks and pens
      for (const [a, b, c] of [[1.3, 0.4, '#2e4a6a'], [2.4, D - 0.4, '#3a5a3a'], [0.62, D - 0.38, '#c8443a']] as const) {
        const [x, y] = P(a, b);
        fillPoly(l, [[x - 8, y], [x, y - 4], [x + 8, y], [x, y + 4]], c);
        fillPoly(l, [[x - 7, y], [x, y - 3], [x + 6, y], [x, y + 3]], '#f6f0e2');
        ln(l, x - 4, y + 4, x + 4, y, '#2a2a30');
      }
      // carafe and glasses
      const [cx, cy] = P(W / 2 + 0.1, D / 2);
      px(l, cx - 4, cy - 16, '#cfe8ee', 8, 16);
      px(l, cx - 3, cy - 12, '#a8d6e2', 6, 10);
      px(l, cx - 4, cy - 16, '#f2fbfd', 2, 14);
      px(l, cx - 2, cy - 19, '#cfe8ee', 4, 3);
      for (const [dx, dy] of [[-14, 4], [12, 6], [16, -3]] as const) {
        px(l, cx + dx - 2, cy + dy - 7, '#d8eef2', 5, 7);
        px(l, cx + dx - 2, cy + dy - 7, '#ffffff', 1, 6);
      }
      // the tulips
      const [vx, vy] = P(W / 2 - 0.45, D / 2 + 0.02);
      px(l, vx - 4, vy - 12, '#3a5a7a', 8, 12);
      px(l, vx - 4, vy - 12, '#5a7a9a', 2, 12);
      for (let i = 0; i < 7; i++) {
        const sx = vx - 6 + i * 2;
        const top = vy - 24 - (i % 3) * 3;
        ln(l, vx, vy - 12, sx, top + 3, R.birch[3]);
        ell(l, sx, top, 2.2, 3, ['#e8577a', '#f2b33a', '#d8302a', '#f08ab4'][i % 4]);
        px(l, sx - 1, top - 2, '#ffffff');
      }
    });
    void k;
  },
};

// ── the coffee bar ──────────────────────────────────────────
const counter: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 9;
    footShadow(p, 0.05, 0.1, W - 0.05, 0.92, 9, 0.24);
    // sage cabinets: doors with brass knobs, a plinth, an oak worktop
    lbox(p, 0.06, 0.12, W - 0.12, 0.76, 0, 0.8, mono(paint(['#1e2a1e', '#2a382a', '#364636', '#425442', '#4e604e', '#5c6e5c']), '#1e2a1e'));
    lbox(p, 0.06, 0.12, W - 0.12, 0.76, 0.8, Z - 1.4, { front: paint(SAGE), side: paint(SAGE), top: paint(SAGE), edge: SAGE[0] });
    const F = front(p, 0.88);
    const S = side(p, W - 0.06);
    const n = Math.round(W * 2);
    for (let i = 0; i < n; i++) {
      const a0 = 0.1 + ((W - 0.2) * i) / n;
      const a1 = 0.1 + ((W - 0.2) * (i + 1)) / n - 0.03;
      pq(p, F, a0, a1, 1.2, Z - 1.9, darken(SAGE[2], 0.12));
      pq(p, F, a0 + 0.04, a1 - 0.04, 1.6, Z - 2.3, SAGE[F.light ? 3 : 2]);
      const [hx, hy] = F.F(i % 2 ? a0 + 0.08 : a1 - 0.08, Z - 3);
      px(p.c, hx - 1, hy - 1, BRASS[4], 3, 3);
    }
    pq(p, S, 0.16, 0.84, 1.2, Z - 1.9, darken(SAGE[1], 0.1));
    lbox(p, 0.02, 0.08, W - 0.04, 0.84, Z - 0.6, 0.6, { front: oakTop, side: oakTop, top: oakTop, edge: OAK[1] });
    const tz = Z;
    // the espresso machine: chrome box, two group heads, a gauge, a cup tray on top
    lbox(p, 0.22, 0.2, 0.62, 0.42, tz, 4.2, { front: brushed(CHROME), side: brushed(CHROME, 0.5), top: paint(CHROME), edge: CHROME[0] });
    const M = front(p, 0.62);
    pq(p, M, 0.26, 0.8, tz + 2.6, tz + 3.4, '#c8382a');
    for (const a of [0.38, 0.66]) {
      const [gx, gy] = M.F(a, tz + 2.2);
      px(p.c, gx - 3, gy, STEEL[2], 7, 3);
      px(p.c, gx - 1, gy + 3, STEEL[1], 3, 5);
      ln(p.c, gx + 3, gy + 1, gx + 9, gy + 4, STEEL[0], 2);
    }
    const [ggx, ggy] = M.F(0.53, tz + 3.7);
    ell(p.c, ggx, ggy, 3, 3, '#f6f2e8');
    px(p.c, ggx, ggy - 2, '#c8382a', 1, 2);
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = anchor(p, 0.3 + i * 0.13, 0.4, tz + 4.2);
      px(p.c, cx - 3, cy - 5, '#fbf7ee', 6, 5);
      px(p.c, cx - 3, cy - 5, '#ffffff', 2, 5);
    }
    // the grinder, a jar of biscotti, a bowl of lemons, a basil pot
    const [gx, gy] = anchor(p, 1.05, 0.38, tz);
    layer(p.c, (l) => {
      px(l, gx - 5, gy - 12, STEEL[2], 10, 12);
      px(l, gx - 5, gy - 12, STEEL[4], 2, 12);
      fillPoly(l, [[gx - 6, gy - 12], [gx + 6, gy - 12], [gx + 4, gy - 22], [gx - 4, gy - 22]], '#6a4a2e');
      fillPoly(l, [[gx - 4, gy - 13], [gx - 1, gy - 13], [gx - 1, gy - 21], [gx - 3, gy - 21]], '#8a6a46');
      const [jx, jy] = anchor(p, 1.38, 0.42, tz);
      px(l, jx - 6, jy - 14, '#d8eef2', 12, 14);
      for (let i = 0; i < 6; i++) px(l, jx - 5 + (i % 3) * 3, jy - 4 - Math.floor(i / 3) * 4, '#c89a5a', 4, 3);
      px(l, jx - 6, jy - 16, '#8a6a46', 12, 3);
      const [bx, by] = anchor(p, 1.62, 0.6, tz);
      ell(l, bx, by - 3, 9, 4, '#3a5a7a');
      ell(l, bx, by - 4, 8, 3, '#5a7a9a');
      for (let i = 0; i < 4; i++) dotFruit(l, bx - 5 + i * 3.4, by - 6 - (i & 1), '#f2d240', 5);
    });
    const [px2, py2] = anchor(p, W - 0.25, 0.3, tz);
    layer(p.c, (l) => {
      fillPoly(l, [[px2 - 6, py2 - 10], [px2 + 6, py2 - 10], [px2 + 5, py2], [px2 - 5, py2]], '#b8693e');
      foliage(l, [{ x: px2, y: py2 - 16, rx: 8, ry: 7, z: 1 }], R.apple, k.seed + 3, { cell: 2.4 });
    });
  },
  anim(p, k) {
    // steam over the machine
    const [x, y] = anchor(p, 0.5, 0.4, 9 + 4.2);
    const u = p.k / 4;
    for (let i = 0; i < 3; i++) {
      const t = (k.t * 0.5 + i / 3) % 1;
      p.c.globalAlpha = 0.35 * (1 - t);
      ell(p.c, x + Math.sin(t * 6 + i) * 3 * u, y - t * 26 * u, (2 + t * 4) * u, (2 + t * 3) * u, '#ffffff');
    }
    p.c.globalAlpha = 1;
  },
};

// ── a glass dispenser of lemon water on an oak stand ────────
const watercooler: PropArt = {
  draw(p, k) {
    footShadow(p, 0.25, 0.25, 0.75, 0.75, 9, 0.24);
    const wo = grain(OAK);
    lbox(p, 0.25, 0.25, 0.5, 0.5, 0, 8.6, { front: siding4(OAK, 8), side: siding4(OAK, 8), top: wo, edge: OAK[0] });
    pq(p, front(p, 0.75), 0.3, 0.7, 2, 6.8, darken(OAK[2], 0.15));
    const [x, y] = anchor(p, 0.5, 0.5, 8.6);
    layer(p.c, (l) => {
      // the jar: glass with water, lemon slices and mint, a chrome tap
      px(l, x - 11, y - 34, '#dcf0f4', 22, 34);
      px(l, x - 10, y - 26, '#b8e0ea', 20, 26);
      px(l, x - 11, y - 34, '#f6fdfe', 3, 32);
      for (const [dx, dy] of [[-4, -8], [3, -16], [-2, -22], [5, -6]] as const) {
        ell(l, x + dx, y + dy, 4, 4, '#f2d240');
        ell(l, x + dx, y + dy, 2.6, 2.6, '#fbe88a');
      }
      for (const [dx, dy] of [[0, -12], [-6, -18]] as const) px(l, x + dx, y + dy, '#4a8a3a', 3, 2);
      ell(l, x, y - 35, 12, 3, '#cfe4ea');
      px(l, x - 3, y - 39, OAK[3], 6, 4);
      px(l, x + 8, y - 5, CHROME[3], 6, 3);
      px(l, x + 12, y - 3, CHROME[2], 2, 3);
      // glasses on the stand
      for (const dx of [-14, 18]) {
        px(l, x + dx - 2, y + 3, '#d8eef2', 5, 8);
        px(l, x + dx - 2, y + 3, '#ffffff', 1, 7);
      }
    });
    void k;
  },
};

// ── lounge: sofa, coffee table, wingback armchair ───────────
const sofa: PropArt = {
  draw(p, k) {
    const W = k.w;
    const col = k.color ?? '#d0705a';
    const fr = fabric(col);
    footShadow(p, 0.08, 0.15, W - 0.08, 0.92, 6, 0.26);
    // tapered oak legs
    for (const a of [0.2, W - 0.26]) for (const b of [0.22, 0.78]) lbox(p, a, b, 0.06, 0.06, 0, 1.4, mono(grain(OAK), OAK[0]));
    // base, seat cushions, back cushions, arms
    lbox(p, 0.1, 0.16, W - 0.2, 0.74, 1.4, 1.8, { front: velvet(fr), side: velvet(fr), top: velvet(fr), edge: fr[0] });
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a0 = 0.32 + ((W - 0.64) * i) / n;
      lbox(p, a0 + 0.01, 0.38, (W - 0.64) / n - 0.02, 0.5, 3.2, 1.3, { front: velvet(fr), side: velvet(fr), top: velvet(fr), edge: fr[0] });
      lbox(p, a0 + 0.01, 0.18, (W - 0.64) / n - 0.02, 0.22, 3.2, 4.6, { front: velvet(fr), side: velvet(fr), top: velvet(fr), edge: fr[0] });
    }
    for (const a of [0.1, W - 0.32]) lbox(p, a, 0.16, 0.22, 0.74, 3.2, 2.6, { front: velvet(fr), side: velvet(fr), top: velvet(fr), edge: fr[0] });
    // throw pillows and a knitted throw over the right arm
    const pill = (a: number, c: string) => {
      const [x, y] = anchor(p, a, 0.42, 5.4);
      layer(p.c, (l) => {
        fillPoly(l, [[x - 9, y + 2], [x + 7, y - 6], [x + 9, y - 18], [x - 7, y - 11]], darken(c, 0.25));
        fillPoly(l, [[x - 8, y + 1], [x + 6, y - 6], [x + 8, y - 17], [x - 6, y - 10]], c);
        fillPoly(l, [[x - 6, y - 2], [x + 2, y - 6], [x + 4, y - 12], [x - 4, y - 8]], lighten(c, 0.15));
      });
    };
    pill(0.55, '#e2b23a');
    pill(W - 0.6, '#f2ead6');
    const [tx, ty] = anchor(p, W - 0.22, 0.6, 5.8);
    layer(p.c, (l) => {
      fillPoly(l, [[tx - 10, ty - 4], [tx + 8, ty - 12], [tx + 12, ty + 6], [tx - 6, ty + 14]], '#e8dcc0');
      for (let i = 0; i < 6; i++) ln(l, tx - 8 + i * 3, ty - 5 + i * -1.4 + 2, tx - 4 + i * 3, ty + 12 - i * 1.4, '#d0c0a0');
      for (let i = 0; i < 5; i++) px(l, tx - 6 + i * 4, ty + 14 - i * 1.8, '#e8dcc0', 1, 4);
    });
  },
};

const coffeeTable: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.3, 0.25, W - 0.3, 0.75, 4, 0.22);
    const [x, y] = anchor(p, W / 2, 0.5, 0);
    layer(p.c, (l) => {
      // brass hairpin legs
      for (const [dx, dy] of [[-30, -4], [30, -2], [-18, 6], [18, 8]] as const) {
        ln(l, x + dx, y + dy - 15, x + dx * 1.05, y + dy, BRASS[3], 2);
        ln(l, x + dx + 1, y + dy - 15, x + dx * 1.05 + 1, y + dy, BRASS[1], 1);
      }
      // the oval marble top with a thickness
      ell(l, x, y - 14, 44, 16, '#9a958e');
      ell(l, x, y - 16, 44, 16, '#e8e4dc');
      ell(l, x - 8, y - 19, 26, 8, '#f4f1ea');
      for (let i = 0; i < 3; i++) curve(l, x - 30 + i * 18, y - 22 + i * 3, x - 10 + i * 12, y - 10, x + 6 + i * 10, y - 18, '#c8c2b8');
      // magazines, a candle, a ceramic bowl
      fillPoly(l, [[x - 26, y - 14], [x - 12, y - 21], [x + 2, y - 15], [x - 12, y - 8]], '#2e4a6a');
      fillPoly(l, [[x - 22, y - 15], [x - 10, y - 21], [x + 2, y - 17], [x - 10, y - 11]], '#f2c86a');
      px(l, x + 12, y - 26, '#f6f0e2', 6, 9);
      px(l, x + 14, y - 29, '#2a2a2e', 1, 3);
      ell(l, x + 22, y - 16, 7, 3, '#3a6a5a');
      ell(l, x + 22, y - 17, 6, 2, '#5a8a7a');
    });
    void k;
  },
};

const armchair: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#5b8def';
    const fr = fabric(mix(col, '#2a3a6a', 0.25));
    footShadow(p, 0.15, 0.2, 0.85, 0.9, 7, 0.26);
    const v = { front: velvet(fr), side: velvet(fr), top: velvet(fr), edge: fr[0] };
    // short oak legs, a base, then back to front: the back, the far arm, the cushion, the near arm
    for (const [a, b] of [[0.2, 0.24], [0.74, 0.24], [0.2, 0.8], [0.74, 0.8]] as const) lbox(p, a, b, 0.06, 0.06, 0, 1.5, mono(grain(OAK), OAK[0]));
    lbox(p, 0.16, 0.2, 0.68, 0.66, 1.5, 2.4, v);
    lbox(p, 0.16, 0.18, 0.68, 0.2, 3.9, 6.6, { ...v, front: velvet(fr, 0) });
    lbox(p, 0.16, 0.38, 0.15, 0.48, 3.9, 2.6, v);
    lbox(p, 0.31, 0.38, 0.38, 0.46, 3.9, 1.1, v);
    lbox(p, 0.69, 0.38, 0.15, 0.48, 3.9, 2.6, v);
    // button tufting on the back
    const F = front(p, 0.38);
    for (const [a, z] of [[0.36, 7.4], [0.64, 7.4], [0.5, 8.6], [0.36, 9.6], [0.64, 9.6]] as const) {
      const [bx, by] = F.F(a, z);
      px(p.c, bx, by, fr[1], 2, 2);
    }
    void k;
  },
};

// ── storage ─────────────────────────────────────────────────
const bookshelf: PropArt = {
  draw(p, k) {
    const W = k.w;
    const H = 20;
    footShadow(p, 0.05, 0.05, W - 0.05, 0.7, 14, 0.24);
    const wo = grain(OAK, 'v');
    // carcass: the back and the plinth first, the shelves and their rows, then the sides and the top over them
    lbox(p, 0.06, 0.06, W - 0.12, 0.08, 0, H, mono(siding4(OAK, 40), OAK[0]));
    // the side panel away from us goes behind the rows, the near one over them
    const [farA, nearA] = p.rot === 0 ? [0.06, W - 0.14] : [W - 0.14, 0.06];
    lbox(p, farA, 0.06, 0.08, 0.6, 0, H, { front: wo, side: wo, top: wo, edge: OAK[0] });
    lbox(p, 0.14, 0.14, W - 0.28, 0.5, 0, 1.2, { front: wo, side: wo, top: oakTop, edge: OAK[0] });
    const shelves = [1.2, 5.8, 10.2, 14.6];
    const Rn = rng(k.seed * 13 + 1);
    for (const z of shelves) {
      lbox(p, 0.14, 0.14, W - 0.28, 0.5, z, 0.4, { front: wo, side: wo, top: oakTop, edge: OAK[0] });
      // the row on this shelf: books upright, a leaning one, a stack, a plant or an object
      const F = front(p, 0.5);
      let a = 0.18;
      while (a < W - 0.24) {
        const r = Rn();
        if (r < 0.1 && a < W - 0.6) {
          // a horizontal stack
          for (let i = 0; i < 4; i++) {
            const c = ['#7a3a2a', '#2e4a6a', '#c8a050', '#e8dcc6', '#3a5a3a'][Math.floor(Rn() * 5)];
            pq(p, F, a, a + 0.32, z + 0.4 + i * 0.55, z + 0.9 + i * 0.55, c);
            pq(p, F, a, a + 0.32, z + 0.85 + i * 0.55, z + 0.9 + i * 0.55, lighten(c, 0.3));
          }
          a += 0.36;
        } else if (r < 0.18 && a < W - 0.5) {
          // a small plant or a brass object
          const [x, y] = F.F(a + 0.14, z + 0.4);
          layer(p.c, (l) => {
            if (Rn() < 0.6) {
              fillPoly(l, [[x - 5, y - 8], [x + 5, y - 8], [x + 4, y], [x - 4, y]], '#e8e0d0');
              const masses: Mass[] = [];
              for (let j = 0; j < 4; j++) masses.push({ x: x - 6 + j * 4, y: y - 11 + (j % 2) * 2, rx: 4.5, ry: 3.5, z: j });
              foliage(l, masses, R.apple, Math.floor(x + y), { cell: 2.2 });
              for (let j = 0; j < 3; j++) for (let q = 0; q < 6 + j * 4; q++) px(l, x - 5 + j * 4, y + q - 2, R.apple[2 + (q & 1)]);
            } else {
              ell(l, x, y - 6, 5, 6, BRASS[3]);
              ell(l, x - 2, y - 8, 2, 2, BRASS[5]);
            }
          });
          a += 0.3;
        } else {
          const w = 0.05 + Rn() * 0.05;
          const h = 2.6 + Rn() * 1.4;
          const c = ['#7a3a2a', '#2e4a6a', '#c8a050', '#3a5a3a', '#e8dcc6', '#8a2a3a', '#4a3a5a', '#d87a4a'][Math.floor(Rn() * 8)];
          const lean = Rn() < 0.06;
          if (lean) {
            const [x0, y0] = F.F(a, z + 0.4);
            const [x1, y1] = F.F(a + 0.14, z + 0.4 + h);
            ln(p.c, x0, y0, x1, y1, c, 4);
          } else {
            pq(p, F, a, a + w, z + 0.4, z + 0.4 + h, c);
            pq(p, F, a, a + w * 0.3, z + 0.4, z + 0.4 + h, lighten(c, 0.2));
            pq(p, F, a, a + w, z + 0.4 + h * 0.7, z + 0.6 + h * 0.7, lighten(c, 0.45));
          }
          a += w + 0.008;
        }
      }
    }
    lbox(p, nearA, 0.06, 0.08, 0.6, 0, H, { front: wo, side: wo, top: wo, edge: OAK[0] });
    lbox(p, 0.06, 0.06, W - 0.12, 0.62, H - 0.6, 0.8, { front: wo, side: wo, top: oakTop, edge: OAK[0] });
  },
};

const printer: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.1, 0.9, 0.9, 10, 0.24);
    const body = paint(IVORY);
    // the stand with paper drawers, the machine, the scanner lid, the control panel
    lbox(p, 0.12, 0.12, 0.76, 0.76, 0, 4.2, { front: paint(['#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76', '#7a7a86', '#8a8a96']), side: paint(['#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76', '#7a7a86', '#8a8a96']), top: body, edge: '#2a2a30' });
    lbox(p, 0.12, 0.12, 0.76, 0.76, 4.2, 5.6, { front: body, side: body, top: body, edge: IVORY[0] });
    const F = front(p, 0.88);
    for (const z of [0.6, 2.4]) pq(p, F, 0.2, 0.8, z, z + 1.4, darken(IVORY[2], 0.2));
    for (const z of [5, 6.6]) {
      pq(p, F, 0.18, 0.82, z, z + 1.2, IVORY[F.light ? 2 : 1]);
      pq(p, F, 0.42, 0.58, z + 0.4, z + 0.7, '#5a5a64');
    }
    lbox(p, 0.1, 0.1, 0.8, 0.8, 9.8, 0.6, { front: paint(['#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76', '#7a7a86', '#8a8a96']), side: body, top: paint(['#3a3a40', '#4a4a52', '#5a5a64', '#6a6a76', '#7a7a86', '#8a8a96']), edge: '#2a2a30' });
    // output tray with printed sheets, a control panel
    lbox(p, 0.2, 0.55, 0.6, 0.3, 8.6, 0.2, mono(body, IVORY[0]));
    for (let i = 0; i < 3; i++) lbox(p, 0.26, 0.58, 0.48, 0.24, 8.8 + i * 0.12, 0.1, mono(paint(['#d8d4ca', '#e8e4da', '#f2eee6', '#fbf8f2', '#ffffff', '#ffffff']), '#c8c4ba'));
    lbox(p, 0.6, 0.62, 0.26, 0.2, 9.8, 0.8, { front: paint(STEEL), side: paint(STEEL), top: paint(STEEL), edge: STEEL[0] });
    // a recycling bin beside it
    const [bx, by] = anchor(p, 0.86, 0.95, 0);
    layer(p.c, (l) => {
      fillPoly(l, [[bx - 7, by - 16], [bx + 7, by - 16], [bx + 6, by], [bx - 6, by]], '#3a6a9a');
      px(l, bx - 7, by - 17, '#5a8aba', 14, 2);
      px(l, bx - 5, by - 18, '#fbf8f2', 6, 3);
    });
    void k;
  },
  anim(p, k) {
    // a blinking status light on the panel
    const on = Math.sin(k.t * 3 + k.seed) > 0;
    const [x, y] = anchor(p, 0.72, 0.82, 10.4);
    px(p.c, x, y, on ? '#5fd38d' : '#2a5a3a', 2, 2);
  },
};

const filingCabinet: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 10, 0.24);
    const wo = grain(OAK, 'v');
    lbox(p, 0.16, 0.18, 0.68, 0.64, 0, 12, { front: wo, side: wo, top: oakTop, edge: OAK[0] });
    const F = front(p, 0.82);
    for (let i = 0; i < 4; i++) {
      const z0 = 0.6 + i * 2.85;
      pq(p, F, 0.2, 0.8, z0, z0 + 2.55, darken(OAK[2], 0.18));
      pt(p, F, 0.22, 0.78, z0 + 0.15, z0 + 2.4, grain(OAK), F.light);
      // brass label holder and pull
      pq(p, F, 0.4, 0.6, z0 + 1.5, z0 + 2.1, BRASS[3]);
      pq(p, F, 0.42, 0.58, z0 + 1.6, z0 + 2, '#f6f0e2');
      pq(p, F, 0.44, 0.56, z0 + 0.7, z0 + 1, BRASS[4]);
    }
    // on top: a stack of folders or a plant
    const [x, y] = anchor(p, 0.5, 0.5, 12);
    layer(p.c, (l) => {
      if (k.seed % 2) {
        for (let i = 0; i < 4; i++) {
          const c = ['#c8a050', '#3a5a7a', '#e8dcc6', '#a84c32'][i];
          fillPoly(l, [[x - 14, y - i * 2], [x, y - 7 - i * 2], [x + 14, y - i * 2], [x, y + 7 - i * 2]], c);
        }
      } else {
        fillPoly(l, [[x - 7, y - 12], [x + 7, y - 12], [x + 6, y], [x - 6, y]], '#e8e0d0');
        for (let i = 0; i < 9; i++) {
          const a = -1.4 + i * 0.35;
          ln(l, x, y - 11, x + Math.sin(a) * 12, y - 11 - Math.cos(a) * 20, R.birch[2 + (i % 3)], 2);
        }
      }
    });
  },
};

const sideTable: PropArt = {
  draw(p, k) {
    footShadow(p, 0.3, 0.3, 0.7, 0.7, 5, 0.22);
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    layer(p.c, (l) => {
      // brass tripod, a round marble top
      for (const dx of [-8, 0, 8]) ln(l, x, y - 20, x + dx, y + (dx === 0 ? 4 : 0), BRASS[3], 2);
      ell(l, x, y - 21, 15, 7, '#9a958e');
      ell(l, x, y - 22, 15, 7, '#e8e4dc');
      ell(l, x - 4, y - 24, 8, 3, '#f6f3ec');
      if (k.seed % 2) {
        // a ceramic lamp with a linen shade
        ell(l, x + 2, y - 30, 6, 7, '#3a6a8a');
        ell(l, x, y - 32, 2, 2, '#5a8aaa');
        px(l, x + 1, y - 40, BRASS[3], 2, 4);
        fillPoly(l, [[x - 7, y - 40], [x + 11, y - 40], [x + 8, y - 52], [x - 4, y - 52]], '#f2e6cc');
        fillPoly(l, [[x - 7, y - 40], [x + 11, y - 40], [x + 10, y - 42], [x - 6, y - 42]], '#fff3d0');
      } else {
        // books and a vase with a single branch
        fillPoly(l, [[x - 10, y - 22], [x, y - 27], [x + 10, y - 22], [x, y - 17]], '#2e4a6a');
        fillPoly(l, [[x - 8, y - 24], [x, y - 28], [x + 8, y - 24], [x, y - 20]], '#c8443a');
        px(l, x + 4, y - 36, '#e8e0d0', 5, 10);
        curve(l, x + 6, y - 36, x + 2, y - 46, x + 10, y - 54, R.bark[2]);
        for (let i = 0; i < 5; i++) dotFruit(l, x + 2 + (i % 3) * 3, y - 44 - i * 2.4, '#f2b6c8', 3);
      }
    });
  },
};

const boxes: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 6, 0.24);
    const kraft = (light: 0 | 1 | 2) => (light === 2 ? 4 : light === 1 ? 3 : 2);
    const box: Mat = (light) => (u, v, x, y) => {
      const KR: Ramp = ['#6a4a2a', '#8a6236', '#a87a46', '#c29458', '#d6ac70', '#e6c48c'];
      let i = kraft(light);
      if (u % 3 < 0.7) i -= 0.4;
      if (hash(x, y, 4) < 0.04) i -= 0.6;
      if (Math.abs(v - 6) < 0.8) i += 0.6;
      return at(KR, i);
    };
    const stack: [number, number, number, number, number][] = [
      [0.18, 0.2, 0.6, 0.6, 0],
      [0.22, 0.26, 0.52, 0.5, 3.6],
      [0.3, 0.3, 0.42, 0.4, 7],
    ];
    for (const [a, b, w, d, z] of stack) {
      lbox(p, a, b, w, d, z, 3.4, mono(box, '#5a3e22'));
      // a printed label and the hand hole
      const F = front(p, b + d);
      pq(p, F, a + w * 0.3, a + w * 0.7, z + 1.2, z + 2.4, '#f6f0e2');
      pq(p, F, a + w * 0.35, a + w * 0.6, z + 1.6, z + 1.8, '#3a3a40');
    }
    // a poster tube leaning on the stack
    const [tx, ty] = anchor(p, 0.85, 0.6, 0);
    layer(p.c, (l) => {
      ln(l, tx, ty, tx - 8, ty - 38, '#c8a070', 5);
      ln(l, tx - 2, ty, tx - 10, ty - 38, '#e0bc8a', 1);
      ell(l, tx - 9, ty - 39, 3, 1.5, '#2a2a30');
    });
    void k;
  },
};

// ── lamps, plants, the fridge and the coat stand ───────────
const lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.35, 0.6, 0);
    contactShadow(p.c, x + 6, y + 2, 14, 5, 0.26);
    layer(p.c, (l) => {
      // a marble block base, the brass arc, a white dome shade
      fillPoly(l, [[x - 9, y - 5], [x + 1, y - 10], [x + 11, y - 5], [x + 1, y]], '#c8c2b8');
      fillPoly(l, [[x - 9, y - 5], [x + 1, y], [x + 1, y + 4], [x - 9, y - 1]], '#a8a298');
      fillPoly(l, [[x + 1, y], [x + 11, y - 5], [x + 11, y - 1], [x + 1, y + 4]], '#8a847a');
      curve(l, x + 1, y - 6, x + 6, y - 110, x + 46, y - 92, BRASS[3], 2);
      curve(l, x, y - 6, x + 5, y - 110, x + 45, y - 92, BRASS[5], 1);
      ell(l, x + 47, y - 86, 13, 9, '#e8e4dc');
      ell(l, x + 45, y - 90, 10, 6, '#f8f6f0');
      ell(l, x + 47, y - 79, 9, 3, '#fff0c0');
    });
    void k;
  },
  anim(p, k) {
    const [x, y] = anchor(p, 0.35, 0.6, 0);
    const u = p.k / 4;
    p.c.globalAlpha = 0.1 + Math.sin(k.t * 1.1) * 0.01;
    ell(p.c, x + 47 * u, y - 60 * u, 30 * u, 44 * u, '#ffe7a8');
    p.c.globalAlpha = 1;
  },
};

const PLANTS = ['fig', 'monstera', 'snake', 'rubber'] as const;
function pottedPlant(p: PropPainter, k: PropCtx, tall: boolean) {
  const kind = tall ? (k.seed % 2 ? 'olive' : 'fig') : PLANTS[k.seed % PLANTS.length];
  const [x, y] = anchor(p, 0.5, 0.5, 0);
  contactShadow(p.c, x + 8, y + 3, 18, 6, 0.26);
  const Rn = rng(k.seed * 9 + 2);
  layer(p.c, (l) => {
    // the pot: terracotta, a woven basket or a speckled white ceramic
    const style = k.seed % 3;
    const pw = tall ? 13 : 10;
    const ph = tall ? 22 : 16;
    if (style === 1) {
      for (let j = 0; j < ph; j++) {
        const w = pw - j * 0.12;
        px(l, x - w, y - j, j % 3 === 0 ? '#8a6a3a' : '#b8925a', w * 2, 1);
      }
      for (let i = -pw; i < pw; i += 4) ln(l, x + i, y, x + i * 0.9, y - ph, '#9a7a46');
    } else {
      const r = style === 0 ? POT : IVORY;
      for (let j = 0; j < ph; j++) {
        const w = pw - j * 0.1;
        for (let i = -w; i < w; i++) {
          const t = (i + w) / (2 * w);
          px(l, x + i, y - j, r[t < 0.3 ? 4 : t < 0.6 ? 3 : t < 0.85 ? 2 : 1]);
        }
      }
      if (style === 2) for (let i = 0; i < 12; i++) px(l, x - pw + 2 + hash(i, 1, k.seed) * pw * 1.8, y - 2 - hash(i, 2, k.seed) * (ph - 4), '#4a4a50');
      px(l, x - pw - 1, y - ph - 1, r[5], pw * 2 + 2, 3);
    }
    const top = y - ph;
    if (kind === 'fig') {
      // fiddle-leaf fig: a straight stem, big wavy leaves stacked up it
      const H = tall ? 100 : 60;
      px(l, x - 1, top - H, R.bark[2], 3, H);
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const lx = x + (i % 2 ? 1 : -1) * (8 + Rn() * 8);
        const ly = top - H * (0.25 + t * 0.78);
        ell(l, lx, ly, 9, 6, R.oak[2]);
        ell(l, lx - 1, ly - 1, 8, 5, R.oak[3 + (i % 2)]);
        ln(l, lx - 6, ly + 1, lx + 6, ly - 2, R.oak[2]);
      }
    } else if (kind === 'olive') {
      // a potted olive: twisted trunk, silvery canopy
      curve(l, x, top, x - 8, top - 50, x + 4, top - 90, R.barkPale[1], 4);
      const masses: Mass[] = [];
      for (let i = 0; i < 9; i++) masses.push({ x: x + 2 + (Rn() - 0.5) * 50, y: top - 92 + (Rn() - 0.5) * 34, rx: 13 + Rn() * 6, ry: 10 + Rn() * 4, z: i });
      foliage(l, masses, ['#3a4a3a', '#4a5e4a', '#5e745c', '#748a70', '#8ea486', '#aabca0', '#c4d4b8'], k.seed, { cell: 3, tilt: 0.25 });
    } else if (kind === 'monstera') {
      // monstera: big split leaves on long stalks fanning out
      for (let i = 0; i < 9; i++) {
        const a = -1.2 + i * 0.3 + (Rn() - 0.5) * 0.2;
        const len = 26 + Rn() * 18;
        const ex = x + Math.sin(a) * len * 1.2;
        const ey = top - Math.cos(a) * len;
        curve(l, x, top, x + Math.sin(a) * len * 0.5, top - len * 0.8, ex, ey, R.apple[2], 2);
        ell(l, ex, ey, 12, 9, R.apple[2]);
        ell(l, ex - 1, ey - 1, 11, 8, R.apple[3 + (i % 2)]);
        for (let s = 0; s < 3; s++) ln(l, ex - 9 + s * 6, ey + 5, ex - 4 + s * 4, ey - 1, R.apple[1]);
        px(l, ex - 3, ey - 4, R.apple[5], 3, 2);
      }
    } else if (kind === 'snake') {
      // snake plant: upright banded blades with yellow edges
      for (let i = 0; i < 9; i++) {
        const bx = x - 8 + i * 2;
        const h = 30 + Rn() * 24;
        const lean = (i - 4) * 0.6;
        for (let j = 0; j < h; j++) {
          const w = j > h - 6 ? 1 : 3;
          const xx = bx + lean * (j / h) * 4;
          px(l, xx, top - j, (j / 4) % 3 < 1 ? '#3a5a3a' : '#5a7a4a', w, 1);
          px(l, xx + w, top - j, '#c8c060');
        }
      }
    } else {
      // rubber plant: glossy dark oval leaves on a few stems
      for (let s = 0; s < 3; s++) {
        const sx = x - 6 + s * 6;
        const h = 40 + s * 10;
        px(l, sx, top - h, R.bark[2], 2, h);
        for (let i = 0; i < 6; i++) {
          const ly = top - h * (0.3 + i * 0.13);
          const side2 = i % 2 ? 1 : -1;
          ell(l, sx + side2 * 8, ly, 8, 5, '#1e3a22');
          ell(l, sx + side2 * 8 - 1, ly - 1, 6, 3.5, '#2e5a32');
          px(l, sx + side2 * 8 - 3, ly - 2, '#6a9a6a', 2, 1);
        }
      }
    }
  });
}
const plant: PropArt = { draw: (p, k) => pottedPlant(p, k, false) };
const plantTall: PropArt = { draw: (p, k) => pottedPlant(p, k, true) };

const fridge: PropArt = {
  draw(p, k) {
    footShadow(p, 0.15, 0.15, 0.85, 0.85, 12, 0.26);
    // a retro fridge: rounded mint body, chrome handle, magnets and a child's drawing
    lbox(p, 0.16, 0.16, 0.68, 0.66, 0, 15, { front: brushed(MINT, 0.85), side: brushed(MINT, 0.85), top: paint(MINT), edge: MINT[0] });
    const F = front(p, 0.82);
    pq(p, F, 0.18, 0.82, 10.2, 10.5, darken(MINT[1], 0.2));
    const [hx, hy] = F.F(0.74, 12.4);
    px(p.c, hx - 1, hy - 14, CHROME[4], 3, 16);
    px(p.c, hx - 1, hy - 14, CHROME[5], 1, 16);
    const [h2x, h2y] = F.F(0.74, 8.6);
    px(p.c, h2x - 1, h2y - 2, CHROME[4], 3, 22);
    // the drawing and magnets
    pq(p, F, 0.26, 0.5, 5.6, 8.6, '#fbf8f2');
    const [dx, dy] = F.F(0.38, 7);
    ell(p.c, dx, dy, 4, 4, '#f2c42a');
    px(p.c, dx - 6, dy + 6, '#3fb68b', 12, 2);
    for (const [a, z, c] of [[0.3, 8.4, '#e2553b'], [0.46, 8.4, '#2a5aa8'], [0.62, 12.5, '#f2c42a'], [0.36, 13.2, '#3fb68b']] as const) {
      const [mx, my] = F.F(a, z);
      px(p.c, mx - 1, my - 1, c, 3, 3);
    }
    // a little badge
    const [bx, by] = F.F(0.32, 14.2);
    px(p.c, bx - 4, by - 1, CHROME[4], 8, 2);
    void k;
  },
};

const coatRack: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5, 0);
    contactShadow(p.c, x + 8, y + 2, 14, 5, 0.26);
    layer(p.c, (l) => {
      // bentwood stand: three feet, a pole, curling hooks
      for (const dx of [-10, 2, 12]) curve(l, x, y - 14, x + dx * 0.6, y - 4, x + dx, y + (dx === 2 ? 4 : 0), OAK[3], 2);
      px(l, x - 1, y - 74, OAK[3], 3, 64);
      px(l, x - 1, y - 74, OAK[5], 1, 64);
      for (const s of [-1, 1]) {
        curve(l, x, y - 70, x + s * 10, y - 76, x + s * 8, y - 66, OAK[3], 2);
        curve(l, x, y - 56, x + s * 8, y - 60, x + s * 7, y - 52, OAK[3], 2);
      }
      ell(l, x, y - 76, 3, 2, OAK[4]);
      // a camel coat, a striped scarf, a straw hat
      fillPoly(l, [[x - 10, y - 66], [x - 4, y - 68], [x - 2, y - 30], [x - 14, y - 28]], '#c89a62');
      fillPoly(l, [[x - 10, y - 66], [x - 7, y - 67], [x - 8, y - 30], [x - 13, y - 29]], '#a87a46');
      for (let i = 0; i < 6; i++) px(l, x + 5, y - 66 + i * 5, i % 2 ? '#c8382a' : '#f2ead6', 4, 5);
      ell(l, x + 8, y - 72, 9, 3, '#d8b878');
      ell(l, x + 8, y - 74, 5, 3, '#e8c888');
      px(l, x + 3, y - 73, '#3a3030', 10, 1);
      // an umbrella hooked on the side
      ln(l, x + 12, y - 2, x + 6, y - 44, '#2a3a5a', 3);
      curve(l, x + 6, y - 44, x + 3, y - 50, x + 7, y - 52, '#6a4a2e', 2);
    });
    void k;
  },
};

// ── the front walls: the palazzo's facade, cut low ─────────
const STUCCO: Ramp = ['#9a6a3a', '#b47e46', '#c99456', '#d8a868', '#e4bc80', '#eed09a'];
const lowWall: PropArt = {
  draw(p, k) {
    const W = k.w;
    const Z = 7;
    const T = 0.3;
    // facade: a travertine plinth, ochre stucco above; the cut top shows brick and lime
    const fac: Mat = (light, _w, h) => {
      const stuc = plaster4(STUCCO)(light, _w, h);
      return (u, v, x, y) => {
        if (v < 10) return at(['#a8957a', '#b9a689', '#c9b798', '#d7c6a8', '#e3d4b8', '#eee2c9'], (light ? 3.5 : 2) + (u % 52 < 1.2 ? -2 : 0) + (v > 8.6 ? 1 : 0));
        return stuc(u, v, x, y);
      };
    };
    lbox(p, 0, 0, W, T, 0, Z, { front: fac, side: fac, top: (light) => (u, v, x, y) => (v < 2.5 || v > 10 ? at(['#c4b8a4', '#d4c8b2', '#e2d6c0', '#ece2ce', '#f4ecdc', '#faf4e8'], light === 2 ? 3 : 2) : bricks4(R.brick)(1, 0, 0)(u, v, x, y)), edge: '#7a5a3a' });
    // the bottoms of the street-side windows survive the cut: stone sills at intervals
    const F = front(p, T);
    for (let a = 1.5; a < W - 0.5; a += 3) {
      pq(p, F, a - 0.62, a + 0.62, Z - 0.7, Z, F.light ? '#e8dcc4' : '#c4b8a0');
      pq(p, F, a - 0.62, a + 0.62, Z - 1.1, Z - 0.7, '#8a7a62');
      pq(p, F, a - 0.5, a + 0.5, Z - 0.7, Z, '#4a5a64');
    }
    // a strip of ivy here and there at the foot
    const Rn = rng(k.seed * 7 + 5);
    layer(p.c, (l) => {
      for (let a = 0.4; a < W - 0.3; a += 1.4 + Rn() * 2) {
        if (Rn() < 0.45) continue;
        const masses: Mass[] = [];
        for (let i = 0; i < 4; i++) {
          const [x, y] = p.P(a + i * 0.12, T + 0.02, 1 + Rn() * 4);
          masses.push({ x, y, rx: 5 + Rn() * 3, ry: 4 + Rn() * 2, z: i });
        }
        foliage(l, masses, R.oak, Math.floor(a * 17), { cell: 2.6 });
      }
    });
  },
};

// at night: the desk lamps' monitors glow a little, the floor lamp lights the lounge
desk.lights = (k) => [{ a: k.w / 2, b: 0.4, z: 11, r: 0.9, color: '#bcd6ff' }];
lamp.lights = () => [{ a: 0.5, b: 0.5, z: 15, r: 2.2 }];

export const OFFICE_ROOM: Record<string, PropArt> = {
  desk,
  table,
  counter,
  watercooler,
  sofa,
  coffeeTable,
  armchair,
  bookshelf,
  printer,
  filingCabinet,
  sideTable,
  boxes,
  lamp,
  plant,
  plantTall,
  fridge,
  coatRack,
  lowWall,
};

export { OAK, BRASS, STEEL, CHROME, TERRA, IVORY };

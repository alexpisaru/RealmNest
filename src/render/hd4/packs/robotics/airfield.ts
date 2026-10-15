// Robotics — the airfield's furniture at 128×64: paint on the pavements,
// runway / taxiway / threshold / approach lights, taxiway signs, the windsock,
// a PAPI bar, cones, the perimeter fence, dry-grass verges with wildflowers,
// gorse, hedgerows, poplars and round trees, drone pads, apron clutter.
//   rob_mark      flat paint: line, dash, num:NN, piano:N, chev, hold, hatch, stand:N, tdz, aim,
//                 tiedown, oil, skid, seg (the windsock's segmented circle), arrow, grate
//   rob_light     white · blue · green · red · amber
//   rob_sign      panels "A|36" (location / mandatory / direction ">B")
//   rob_windsock  · rob_papi · rob_approach · rob_cone · rob_fence (sign) · rob_gate
//   rob_tuft      tuft · seed · thistle · rob_flowers poppy · cornflower · daisy · yellow · mix
//   rob_bush · rob_tree · rob_poplar · rob_hedge
//   rob_pad       drone · dock · empty · rob_extcart · rob_drums · rob_bins · rob_picnic
import type { PropPainter } from '../../../iso';
import type { PropArt } from '../../../props';
import { contactShadow, ell, fillPoly, foliage, hash, layer, ln, type Mass, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { CONC, enamel, GALV, LED, ORANGE, RED, RUBBER, SHELL, STEEL, stencil, textW, YEL } from './rkit';

const WHITE = '#e4e2d8';
const WHITE_D = '#bebcb2';
const YELLOW = '#dcb030';
const YELLOW_D = '#a88626';

type Pt = [number, number];

/** A painted quad on the ground (local a, b), worn by tyres and weather. */
function paint(p: PropPainter, a0: number, b0: number, a1: number, b1: number, col: string, wear: string, seed: number, wearRate = 0.05) {
  const q: Pt[] = [p.P(a0, b0), p.P(a1, b0), p.P(a1, b1), p.P(a0, b1)];
  fillPoly(p.c, q, col);
  const area = Math.abs((a1 - a0) * (b1 - b0)) * 4096;
  const n = Math.floor(area * wearRate);
  const R0 = rng(seed);
  p.c.fillStyle = wear;
  for (let i = 0; i < n; i++) {
    const s = R0();
    const t = R0();
    const [x, y] = p.P(a0 + (a1 - a0) * s, b0 + (b1 - b0) * t);
    p.c.fillRect(Math.round(x), Math.round(y), R0() < 0.3 ? 2 : 1, 1);
  }
}

/** A painted polygon from local (a, b) points (no wear). */
const paintPoly = (p: PropPainter, pts: Pt[], col: string) => fillPoly(p.c, pts.map(([a, b]) => p.P(a, b) as Pt), col);

/** Digits laid out in the ground plane: columns along +a, rows along +b. */
function groundText(p: PropPainter, text: string, a0: number, b0: number, cw: number, ch: number, col: string, seed: number) {
  const FONT: Record<string, string[]> = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    A: ['010', '101', '111', '101', '101'],
    B: ['110', '101', '110', '101', '110'],
    H: ['101', '101', '111', '101', '101'],
  };
  let cx = 0;
  for (const ch2 of text) {
    const g = FONT[ch2];
    if (g)
      for (let r = 0; r < 5; r++)
        for (let k = 0; k < 3; k++) if (g[r][k] === '1') paint(p, a0 + (cx + k) * cw, b0 + r * ch, a0 + (cx + k + 1) * cw, b0 + (r + 1) * ch, col, '#3a3a40', seed + r * 7 + k, 0.03);
    cx += 4;
  }
}

// ── paint on the pavements (flat, baked into the ground) ────
const rob_mark: PropArt = {
  draw(p, k) {
    const [v, arg] = (k.variant ?? 'line').split(':');
    const W = p.pw;
    const D = p.pd;
    const col = k.color ?? (v === 'line' || v === 'dash' || v === 'num' || v === 'piano' || v === 'tdz' || v === 'aim' || v === 'seg' || v === 'arrow' ? WHITE : YELLOW);
    const dk = col === WHITE ? WHITE_D : col === YELLOW ? YELLOW_D : '#3a3a40';
    const s = k.seed * 31;
    if (v === 'line') {
      const w = parseFloat(arg ?? '') || 0.14;
      for (let a = 0; a < W; a += 4) paint(p, a, D / 2 - w / 2, Math.min(W, a + 4), D / 2 + w / 2, col, dk, s + a);
    } else if (v === 'dash') {
      const [len, gap] = (arg ?? '3,2').split(',').map(Number);
      const w = 0.2;
      for (let a = 0; a < W; a += len + gap) paint(p, a, D / 2 - w / 2, Math.min(W, a + len), D / 2 + w / 2, col, dk, s + a, 0.08);
    } else if (v === 'num') {
      const text = arg ?? '36';
      const cols = textW(text);
      const cw = (W * 0.86) / cols;
      groundText(p, text, W * 0.07, D * 0.05, cw, (D * 0.9) / 5, col, s);
    } else if (v === 'piano') {
      const n = parseInt(arg ?? '8', 10);
      const bw = W / (n * 2 + 2);
      for (let i = 0; i < n; i++) {
        const a = bw * (1 + i * 2) + (i >= n / 2 ? bw * 2 : 0) - bw * 0.5;
        paint(p, a, 0.05, a + bw, D - 0.05, col, dk, s + i, 0.06);
      }
    } else if (v === 'chev') {
      // yellow chevrons on the blast pad, pointing back toward the runway (−b)
      const n = Math.max(1, Math.floor(D / 1.4));
      for (let i = 0; i < n; i++) {
        const b = 0.4 + i * 1.4;
        const w = 0.28;
        paintPoly(p, [[0.2, b + 0.9], [W / 2, b], [W / 2, b + w], [0.2, b + 0.9 + w]], col);
        paintPoly(p, [[W - 0.2, b + 0.9], [W / 2, b], [W / 2, b + w], [W - 0.2, b + 0.9 + w]], col);
      }
    } else if (v === 'hold') {
      // the runway holding position: two solid lines, two dashed, across the taxiway (along a)
      for (const [b, dash] of [[0.15, false], [0.42, false], [0.72, true], [0.99, true]] as const) {
        if (!dash) paint(p, 0.05, b, W - 0.05, b + 0.14, col, dk, s + b * 10);
        else for (let a = 0.05; a < W - 0.05; a += 0.7) paint(p, a, b, Math.min(W - 0.05, a + 0.4), b + 0.14, col, dk, s + a * 10);
      }
    } else if (v === 'hatch') {
      // keep-clear: a yellow border and diagonal stripes
      paint(p, 0, 0, W, 0.12, col, dk, s);
      paint(p, 0, D - 0.12, W, D, col, dk, s + 1);
      paint(p, 0, 0, 0.12, D, col, dk, s + 2);
      paint(p, W - 0.12, 0, W, D, col, dk, s + 3);
      for (let a = -D; a < W; a += 0.6) {
        const a0 = Math.max(0.12, a);
        const a1 = Math.min(W - 0.12, a + D);
        if (a1 <= a0) continue;
        const b0 = 0.12 + (a0 - a);
        const b1 = 0.12 + (a1 - a);
        paintPoly(
          p,
          [
            [a0, Math.min(D - 0.12, b0)],
            [Math.min(W - 0.12, a0 + 0.2), Math.min(D - 0.12, b0)],
            [Math.min(W - 0.12, a1 + 0.2), Math.min(D - 0.12, b1)],
            [a1, Math.min(D - 0.12, b1)],
          ],
          col,
        );
      }
    } else if (v === 'stand') {
      // a parking stand: the lead-in line, the stop bar, the stand number
      paint(p, W / 2 - 0.07, 1.4, W / 2 + 0.07, D, col, dk, s);
      paint(p, W / 2 - 1.2, 1.1, W / 2 + 1.2, 1.32, col, dk, s + 1);
      groundText(p, arg ?? '1', W / 2 - 0.5, 0.1, 0.32, 0.18, col, s + 2);
    } else if (v === 'tdz') {
      for (const side of [0.18, W - 0.18 - 1.6])
        for (let i = 0; i < 3; i++) paint(p, side + i * 0.6, 0.2, side + i * 0.6 + 0.36, D - 0.2, col, dk, s + i + side * 3, 0.06);
    } else if (v === 'aim') {
      for (const a of [0.4, W - 0.4 - 1.2]) paint(p, a, 0.1, a + 1.2, D - 0.1, col, dk, s + a, 0.06);
    } else if (v === 'tiedown') {
      // a ring set in the slab, and a frayed rope left on it
      const [x, y] = p.P(W / 2, D / 2);
      ell(p.c, x, y, 5, 2.6, '#3a3a3e');
      ell(p.c, x, y, 3.4, 1.6, '#8a8c90');
      ell(p.c, x, y - 1, 3.4, 1.4, '#c8cacc');
      ell(p.c, x, y, 2, 0.8, '#3a3a3e');
      if (k.seed % 3 === 0) {
        ln(p.c, x + 3, y, x + 14, y + 3, '#d8c890');
        ln(p.c, x + 14, y + 3, x + 18, y + 1, '#d8c890');
      }
    } else if (v === 'oil') {
      const [x, y] = p.P(W / 2, D / 2);
      const R0 = rng(k.seed + 5);
      for (let i = 0; i < 4; i++) ell(p.c, x + (R0() - 0.5) * 18, y + (R0() - 0.5) * 8, 6 + R0() * 8, 3 + R0() * 3, i ? '#4a4844' : '#3e3c38');
      ell(p.c, x - 4, y - 1, 3, 1, '#6a6a7a');
    } else if (v === 'skid') {
      const R0 = rng(k.seed + 9);
      for (let i = 0; i < 6; i++) {
        const a = 0.6 + R0() * (W - 1.2);
        const b0 = R0() * D * 0.5;
        const [x0, y0] = p.P(a, b0);
        const [x1, y1] = p.P(a + (R0() - 0.5) * 0.3, b0 + 1.5 + R0() * 3);
        ln(p.c, x0, y0, x1, y1, '#1e1f22', 2);
        ln(p.c, x0 + 3, y0 + 1, x1 + 3, y1 + 1, '#222327', 1);
      }
    } else if (v === 'seg') {
      // the segmented circle round the windsock: eight white L-shaped markers
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = Math.min(W, D) * 0.42;
        const ca = W / 2 + Math.cos(ang) * r;
        const cb = D / 2 + Math.sin(ang) * r;
        const ta = -Math.sin(ang) * 0.5;
        const tb = Math.cos(ang) * 0.5;
        paintPoly(p, [[ca - ta, cb - tb], [ca + ta, cb + tb], [ca + ta + Math.cos(ang) * 0.18, cb + tb + Math.sin(ang) * 0.18], [ca - ta + Math.cos(ang) * 0.18, cb - tb + Math.sin(ang) * 0.18]], WHITE);
      }
    } else if (v === 'arrow') {
      paint(p, W / 2 - 0.08, 0.8, W / 2 + 0.08, D - 0.1, col, dk, s);
      paintPoly(p, [[W / 2, 0.1], [W / 2 + 0.4, 0.9], [W / 2 - 0.4, 0.9]], col);
    } else if (v === 'grate') {
      for (let a = 0.1; a < W - 0.1; a += 0.5) {
        const q: Pt[] = [p.P(a, D / 2 - 0.12), p.P(a + 0.46, D / 2 - 0.12), p.P(a + 0.46, D / 2 + 0.12), p.P(a, D / 2 + 0.12)];
        fillPoly(p.c, q, '#2a2a2e');
        for (let j = 0; j < 4; j++) {
          const [x0, y0] = p.P(a + 0.06 + j * 0.1, D / 2 - 0.08);
          const [x1, y1] = p.P(a + 0.06 + j * 0.1, D / 2 + 0.08);
          ln(p.c, x0, y0, x1, y1, '#5a5a60');
        }
      }
    }
  },
};

// ── lights ──────────────────────────────────────────────────
const LENS: Record<string, [string, string, string]> = {
  white: ['#c8c4a8', '#f2eccc', '#ffffff'],
  blue: ['#1e3e9a', '#3a6ad8', '#a8c8ff'],
  green: ['#1e6a3a', '#3ab060', '#b8f2c8'],
  red: ['#7a1e1e', '#d8402e', '#ffb0a0'],
  amber: ['#8a5a14', '#e8a030', '#ffe0a0'],
};
const rob_light: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const L = LENS[k.variant ?? 'white'] ?? LENS.white;
    contactShadow(p.c, x + 3, y + 1, 5, 2, 0.24);
    layer(
      p.c,
      (l) => {
        // base can, frangible yellow stem, the lens head
        ell(l, x, y, 4, 2, '#4a4c52');
        px(l, x - 1, y - 9, YEL[4], 3, 9);
        px(l, x - 1, y - 9, YEL[6], 1, 9);
        px(l, x - 1, y - 5, '#2a2a30', 3, 1);
        ell(l, x, y - 11, 3.4, 2.6, L[0]);
        ell(l, x - 0.5, y - 12, 2.6, 2, L[1]);
        px(l, x - 1, y - 13, L[2], 1, 1);
      },
      { rect: [x - 6, y - 16, x + 6, y + 4] },
    );
  },
  lights: (k) => [{ a: 0.5, b: 0.5, z: 3, r: 0.6, color: (LENS[k.variant ?? 'white'] ?? LENS.white)[1] }],
};

// ── signs ───────────────────────────────────────────────────
const rob_sign: PropArt = {
  draw(p, k) {
    const panels = (k.variant ?? 'sign:A').split(':')[1]?.split('|') ?? ['A'];
    const pw = 0.62;
    const W = panels.length * pw;
    const a0 = 0.5 - W / 2;
    footShadow(p, a0, 0.3, a0 + W, 0.7, 8, 0.24);
    // legs on frangible couplings, the box
    for (const a of [a0 + 0.12, a0 + W - 0.16]) lbox(p, a, 0.44, 0.04, 0.04, 0, 2.6, mono(enamel(GALV), GALV[0]));
    lbox(p, a0, 0.36, W, 0.2, 2.6, 6, { front: enamel(STEEL), side: enamel(STEEL), top: enamel(STEEL), edge: STEEL[0] });
    const F = front(p, 0.56);
    panels.forEach((t, i) => {
      const u0 = a0 + i * pw + 0.03;
      const u1 = u0 + pw - 0.06;
      const mandatory = /^\d/.test(t);
      const dir = t.startsWith('>');
      const bg = mandatory ? RED[3] : dir ? YEL[4] : '#141416';
      const fg = mandatory ? '#f6f4ec' : dir ? '#141416' : YEL[4];
      pq(p, F, u0, u1, 2.9, 8.3, bg);
      if (!mandatory && !dir) {
        pq(p, F, u0 + 0.04, u1 - 0.04, 3.2, 3.5, YEL[4]);
        pq(p, F, u0 + 0.04, u1 - 0.04, 7.7, 8.0, YEL[4]);
      }
      const text = dir ? t.slice(1) : t;
      const tw = textW(text) * 2;
      const [cx, cy] = F.F((u0 + u1) / 2, 7);
      const ux = F.light ? 1.79 : 1.79;
      stencil(p.c, text, cx - (tw / 2) * 0.9, cy - (tw / 2) * 0.45, ux, 0.9, 0, 2, fg);
      if (dir) {
        const [ax, ay] = F.F(u1 - 0.12, 5.6);
        fillPoly(p.c, [[ax - 4, ay - 3], [ax + 2, ay], [ax - 4, ay + 3]], fg);
      }
    });
  },
};

// ── the windsock ────────────────────────────────────────────
const rob_windsock: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 10, y + 3, 14, 5, 0.28);
    layer(
      p.c,
      (l) => {
        // a concrete plinth, the hinged mast in red and white bands, a ladder rung or two
        fillPoly(l, [[x - 10, y], [x, y - 5], [x + 10, y], [x, y + 5]], CONC[5]);
        fillPoly(l, [[x - 10, y], [x, y + 5], [x, y + 8], [x - 10, y + 3]], CONC[3]);
        fillPoly(l, [[x, y + 5], [x + 10, y], [x + 10, y + 3], [x, y + 8]], CONC[2]);
        for (let j = 0; j < 236; j++) {
          const band = Math.floor(j / 26) % 2;
          const c0 = band ? '#f2f0e6' : RED[3];
          const c1 = band ? '#c8c6bc' : RED[1];
          px(l, x - 2, y - 2 - j, c0, 2, 1);
          px(l, x, y - 2 - j, c1, 2, 1);
        }
        px(l, x - 4, y - 30, GALV[3], 8, 2);
        // the swivel head and the sock's hoop
        px(l, x - 2, y - 242, '#2a2a30', 4, 6);
        ell(l, x + 4, y - 236, 4, 10, '#2a2a30');
        ell(l, x + 4, y - 236, 2.4, 8, '#5a5a60');
        // the warning light on top
        ell(l, x, y - 245, 2.4, 2, RED[4]);
      },
      { rect: [x - 12, y - 250, x + 10, y + 10] },
    );
    void k;
  },
  anim(p, k) {
    // the sock streams east and ripples in the breeze
    const u = p.k / 4;
    const [x, y] = anchor(p, 0.5, 0.5);
    const ox = x + 5 * u;
    const oy = y - 236 * u;
    const gust = 0.85 + 0.15 * Math.sin(k.t * 0.7);
    for (let i = 0; i < 5; i++) {
      const t0 = i / 5;
      const t1 = (i + 1) / 5;
      const len = 86 * gust;
      const droop = (1 - gust) * 40;
      const w0 = (10 - t0 * 5) * u;
      const w1 = (10 - t1 * 5) * u;
      const x0 = ox + t0 * len * u;
      const x1 = ox + t1 * len * u;
      const y0 = oy + (t0 * t0 * droop + Math.sin(k.t * 6 - t0 * 5) * 2.4 * t0) * u;
      const y1 = oy + (t1 * t1 * droop + Math.sin(k.t * 6 - t1 * 5) * 2.4 * t1) * u;
      const col = i % 2 ? '#f6f2e6' : '#f07020';
      fillPoly(p.c, [[x0, y0 - w0], [x1, y1 - w1], [x1, y1 + w1], [x0, y0 + w0]], col);
      fillPoly(p.c, [[x0, y0 + w0 * 0.3], [x1, y1 + w1 * 0.3], [x1, y1 + w1], [x0, y0 + w0]], i % 2 ? '#d0ccc0' : '#c85a18');
    }
  },
};

// ── PAPI, approach lights, cones ────────────────────────────
const rob_papi: PropArt = {
  draw(p, k) {
    const W = k.w;
    for (let i = 0; i < 4; i++) {
      const a = 0.2 + i * ((W - 0.4) / 4);
      footShadow(p, a, 0.3, a + 0.5, 0.7, 4, 0.22);
      lbox(p, a + 0.1, 0.42, 0.06, 0.06, 0, 1.4, mono(enamel(GALV), GALV[0]));
      lbox(p, a, 0.3, 0.42, 0.34, 1.4, 2.6, { front: enamel(SHELL), side: enamel(SHELL), top: enamel(SHELL), edge: SHELL[0] });
      const F = front(p, 0.64);
      for (const da of [0.1, 0.28]) {
        const [lx, ly] = F.F(a + da, 2.7);
        ell(p.c, lx, ly, 2.6, 2.6, '#2a2a30');
        ell(p.c, lx, ly, 1.8, 1.8, i < 2 ? '#f2f0e6' : '#e04030');
      }
    }
    void k;
  },
};

const rob_approach: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 8, y + 2, 12, 4, 0.24);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[x - 7, y], [x, y - 3.5], [x + 7, y], [x, y + 3.5]], CONC[4]);
        for (let j = 0; j < 80; j++) px(l, x - 1, y - 2 - j, Math.floor(j / 10) % 2 ? '#f2f0e6' : RED[3], 3, 1);
        // the crossbar with five light heads
        ln(l, x - 30, y - 82 + 15, x + 30, y - 82 - 15, GALV[2], 2);
        for (let i = -2; i <= 2; i++) {
          const hx = x + i * 13;
          const hy = y - 82 - i * 6.5;
          px(l, hx - 2, hy - 4, '#2a2a30', 5, 4);
          px(l, hx - 1, hy - 3, '#f2eccc', 3, 2);
        }
      },
      { rect: [x - 34, y - 100, x + 34, y + 6] },
    );
    void k;
  },
  lights: () => [{ a: 0.5, b: 0.5, z: 21, r: 1.6, color: '#fff4d0' }],
};

const rob_cone: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 4, y + 1, 7, 2.6, 0.26);
    layer(
      p.c,
      (l) => {
        fillPoly(l, [[x - 7, y], [x, y - 3.5], [x + 7, y], [x, y + 3.5]], '#1e1e22');
        for (let j = 0; j < 18; j++) {
          const w = 5 - j * 0.24;
          const band = j > 5 && j < 8 ? 1 : j > 11 && j < 14 ? 1 : 0;
          px(l, x - w, y - 1 - j, band ? '#f2f2ee' : ORANGE[4], Math.ceil(w), 1);
          px(l, x, y - 1 - j, band ? '#c8c8c4' : ORANGE[3], Math.ceil(w), 1);
        }
        px(l, x - 1, y - 20, ORANGE[5], 2, 2);
      },
      { rect: [x - 9, y - 24, x + 9, y + 5] },
    );
    void k;
  },
};

// ── the perimeter fence ─────────────────────────────────────
const MESH = 'rgba(150,156,160,0.85)';
const rob_fence: PropArt = {
  draw(p, k) {
    const W = k.w;
    const sign = k.variant === 'sign';
    const H = 18;
    // the chain-link mesh between posts: a diamond weave, mostly see-through
    const F = front(p, 0.5);
    pt(
      p,
      F,
      0,
      W,
      0.4,
      H - 1,
      (u: number, v: number) => {
        const d1 = (u * 0.9 + v) % 5;
        const d2 = (u * 0.9 - v + 1000) % 5;
        if (d1 < 0.7 || d2 < 0.7) return MESH;
        return null;
      },
      F.light,
    );
    // the bottom tension wire and the top rail
    for (const z of [0.6, H - 1]) {
      const [x0, y0] = F.F(0, z);
      const [x1, y1] = F.F(W, z);
      ln(p.c, x0, y0, x1, y1, z > 2 ? GALV[4] : GALV[2], z > 2 ? 2 : 1);
    }
    // three strands of barbed wire on the angled arms
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = p.P(0, 0.5 + 0.12 * (i + 1), H + 0.6 + i * 1.3);
      const [x1, y1] = p.P(W, 0.5 + 0.12 * (i + 1), H + 0.6 + i * 1.3);
      ln(p.c, x0, y0, x1, y1, GALV[3]);
      for (let t = 0.04; t < 1; t += 0.06) px(p.c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 1, GALV[5], 1, 3);
    }
    // concrete posts every two tiles, each with its cranked arm
    for (let a = 0; a <= W + 0.01; a += 2) {
      const aa = Math.min(W - 0.08, a);
      lbox(p, aa, 0.44, 0.1, 0.1, 0, H + 0.4, { front: enamel(CONC), side: enamel(CONC), top: enamel(CONC), edge: CONC[0] });
      const [b0x, b0y] = p.P(aa + 0.05, 0.5, H + 0.4);
      const [b1x, b1y] = p.P(aa + 0.05, 0.95, H + 4);
      ln(p.c, b0x, b0y, b1x, b1y, GALV[2], 2);
    }
    if (sign) {
      pq(p, F, W / 2 - 0.4, W / 2 + 0.4, 9, 13, '#f2f0ea');
      pq(p, F, W / 2 - 0.37, W / 2 + 0.37, 11.6, 12.8, RED[3]);
      for (let i = 0; i < 3; i++) {
        const [a0x, a0y] = F.F(W / 2 - 0.3, 9.8 + i * 0.6);
        const [a1x, a1y] = F.F(W / 2 + 0.3 - i * 0.08, 9.8 + i * 0.6);
        ln(p.c, a0x, a0y, a1x, a1y, '#3a3a40');
      }
    }
  },
};

/** A double gate in the perimeter fence, one leaf ajar, a sign and a padlock. */
const rob_gate: PropArt = {
  draw(p, k) {
    const W = k.w;
    for (const a of [0, W - 0.12]) lbox(p, a, 0.42, 0.12, 0.12, 0, 20, { front: enamel(GALV), side: enamel(GALV), top: enamel(GALV), edge: GALV[0] });
    const F = front(p, 0.5);
    const leaf = (u0: number, u1: number) => {
      pt(p, F, u0, u1, 1, 17, (u: number, v: number, x: number, y: number) => (u < 2 || u > (u1 - u0) * 71.5 - 2 || v < 2 || v > 62 ? GALV[F.light ? 4 : 2] : ((u * 0.9 + v) % 5 < 0.7 || (u * 0.9 - v + 1000) % 5 < 0.7) && (x + y) % 1 === 0 ? MESH : null), F.light);
      const [x0, y0] = F.F(u0, 1);
      const [x1, y1] = F.F(u1, 17);
      ln(p.c, x0, y0, x1, y1, GALV[3]);
    };
    leaf(0.14, W / 2);
    leaf(W / 2, W - 0.14);
    pq(p, F, W / 2 - 0.5, W / 2 - 0.05, 10, 13, YEL[4]);
    pq(p, F, W / 2 - 0.47, W / 2 - 0.08, 12.2, 12.8, '#1e1e24');
    const [lx, ly] = F.F(W / 2, 8.5);
    px(p.c, lx - 1, ly - 2, '#c8a040', 3, 4);
    void k;
  },
};

// ── the verges: dry grass, wildflowers, gorse ───────────────
const DRYG: Ramp = ['#3e5a16', '#52701c', '#688824', '#7e9c2c', '#96ae38', '#b0c04c', '#ccd270'];
const GRN: Ramp = ['#1e3a10', '#2c5014', '#3e6a1a', '#548420', '#6e9c28', '#8ab238'];

const rob_tuft: PropArt = {
  draw(p, k) {
    const v = k.variant ?? ['tuft', 'seed', 'tuft', 'thistle'][k.seed % 4];
    const [x, y] = anchor(p, 0.5, 0.5);
    const R0 = rng(k.seed * 13 + 1);
    layer(
      p.c,
      (l) => {
        if (v === 'thistle') {
          // spiny leaves, a branching stem, purple heads on green bracts
          for (let i = 0; i < 7; i++) {
            const ang = Math.PI + (i / 6) * Math.PI;
            ln(l, x, y, x + Math.cos(ang) * 9, y + Math.sin(ang) * 3 - 1, GRN[2 + (i % 2)], 2);
            px(l, x + Math.cos(ang) * 9, y + Math.sin(ang) * 3 - 3, GRN[4]);
          }
          for (const [dx, h] of [[0, 26], [-5, 19], [6, 21]] as const) {
            ln(l, x, y - 2, x + dx, y - h, GRN[1]);
            ell(l, x + dx, y - h + 1, 2.6, 2.2, GRN[3]);
            ell(l, x + dx, y - h - 2, 2.4, 2, '#a85ac8');
            px(l, x + dx - 1, y - h - 3, '#d8a0f0', 2, 1);
          }
          return;
        }
        const n = v === 'seed' ? 16 : 22;
        for (let i = 0; i < n; i++) {
          const bx = x + (R0() - 0.5) * 12;
          const h = (v === 'seed' ? 14 : 8) + R0() * (v === 'seed' ? 14 : 9);
          const lean = (R0() - 0.5) * 9;
          const col = DRYG[2 + Math.floor(R0() * 5)];
          ln(l, bx, y + 1, bx + lean * 0.5, y + 1 - h * 0.55, col);
          ln(l, bx + lean * 0.5, y + 1 - h * 0.55, bx + lean, y + 1 - h, col);
          if (v === 'seed' && R0() < 0.5) {
            // oat-like spikelets dangling from the tips
            for (let j = 0; j < 3; j++) px(l, bx + lean + (j % 2 ? 1 : -1), y + 2 - h + j * 2, DRYG[6], 1, 2);
          }
        }
        for (let i = 0; i < 4; i++) px(l, x - 5 + i * 3, y, GRN[2], 2, 1);
      },
      { outline: 0.5, rect: [x - 18, y - 34, x + 18, y + 4] },
    );
  },
};

const FLOWER: Record<string, string[]> = {
  poppy: ['#c8281e', '#e8402e', '#1e1418'],
  cornflower: ['#3a5ac8', '#6a8ae8', '#2a2a5a'],
  daisy: ['#f2f0e4', '#ffffff', '#f2c42a'],
  yellow: ['#e2b020', '#f6d040', '#c88a10'],
};
const rob_flowers: PropArt = {
  draw(p, k) {
    const keys = Object.keys(FLOWER);
    const v = k.variant ?? keys[k.seed % keys.length];
    const [x, y] = anchor(p, 0.5, 0.5);
    const R0 = rng(k.seed * 17 + 3);
    layer(
      p.c,
      (l) => {
        const n = 7 + Math.floor(R0() * 5);
        // stems and a few leaves first, then the heads
        const heads: [number, number, string[]][] = [];
        for (let i = 0; i < n; i++) {
          const bx = x + (R0() - 0.5) * 18;
          const by = y + (R0() - 0.5) * 6;
          const h = 7 + R0() * 12;
          const lean = (R0() - 0.5) * 5;
          ln(l, bx, by, bx + lean, by - h, GRN[2 + (i % 2)]);
          if (R0() < 0.5) px(l, bx + (R0() < 0.5 ? -2 : 1), by - h * 0.4, GRN[4], 2, 1);
          const pal = v === 'mix' ? FLOWER[keys[Math.floor(R0() * keys.length)]] : FLOWER[v] ?? FLOWER.poppy;
          heads.push([bx + lean, by - h, pal]);
        }
        for (const [hx, hy, pal] of heads) {
          if (pal === FLOWER.poppy) {
            ell(l, hx, hy, 2.6, 2.2, pal[0]);
            px(l, hx - 1, hy - 1, pal[1], 2, 1);
            px(l, hx, hy, pal[2]);
          } else if (pal === FLOWER.daisy) {
            px(l, hx - 2, hy, pal[0], 5, 1);
            px(l, hx, hy - 2, pal[0], 1, 5);
            px(l, hx - 1, hy - 1, pal[1], 3, 3);
            px(l, hx, hy, pal[2]);
          } else {
            px(l, hx - 1, hy - 1, pal[0], 3, 3);
            px(l, hx - 1, hy - 1, pal[1], 2, 1);
            px(l, hx, hy, pal[2]);
          }
        }
      },
      { outline: 0.45, rect: [x - 16, y - 26, x + 16, y + 6] },
    );
  },
};

const GORSE: Ramp = ['#0e2410', '#163414', '#20481a', '#2e601e', '#3e7824', '#56922c', '#76ac3a'];
const rob_bush: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const R0 = rng(k.seed * 7 + 2);
    const s = 0.8 + R0() * 0.5;
    contactShadow(p.c, x + 10 * s, y + 3, 22 * s, 7 * s, 0.28);
    const masses: Mass[] = [];
    for (let i = 0; i < 6; i++) masses.push({ x: x + (R0() - 0.5) * 30 * s, y: y - 10 * s - R0() * 12 * s, rx: (9 + R0() * 6) * s, ry: (7 + R0() * 4) * s, z: i });
    layer(p.c, (l) => foliage(l, masses, GORSE, k.seed, { cell: 2.6, tilt: 0.2, dots: ['#f2c42a', '#f6d84a', '#e8a820'], dotChance: 0.5, dotSize: 2 }), { outline: 0.6, rect: [x - 40, y - 46, x + 40, y + 6] });
  },
};

// ── trees ───────────────────────────────────────────────────
const LEAF: Ramp = ['#0e220c', '#183410', '#244a14', '#326218', '#447c1c', '#5e9422', '#7cac2e', '#a6c444'];
const POPLAR: Ramp = ['#06160a', '#0c240e', '#143412', '#1e4616', '#2a5a1a', '#3a6e20', '#52862a'];
const BARK: Ramp = ['#2e2620', '#40362c', '#544838', '#6a5c48', '#807058', '#988a70'];

function trunk2(l: CanvasRenderingContext2D, x: number, y: number, h: number, w: number) {
  for (let j = 0; j < h; j++) {
    const ww = Math.max(2, w * (1 - (j / h) * 0.4));
    for (let i = 0; i < ww; i++) {
      const t = i / ww;
      let tone = t < 0.25 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1;
      if (hash(Math.floor((x + i) / 2), Math.floor((y - j) / 5), 3) < 0.15) tone -= 1;
      px(l, x - ww / 2 + i, y - j, BARK[Math.max(0, tone)]);
    }
  }
}

const rob_tree: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const R0 = rng(k.seed * 97 + 5);
    const s = 0.8 + R0() * 0.35;
    const rx = 92 * s;
    const ry = 74 * s;
    const cy = y - 104 * s;
    contactShadow(p.c, x + 34 * s, y + 8, rx * 1.05, ry * 0.42, 0.32);
    layer(p.c, (l) => {
      trunk2(l, x, y, 120 * s - ry * 0.4, 16 * s);
      ln(l, x, cy + ry * 0.4, x - rx * 0.4, cy - ry * 0.1, BARK[2], 4);
      ln(l, x, cy + ry * 0.4, x + rx * 0.35, cy - ry * 0.2, BARK[2], 4);
    });
    const masses: Mass[] = [];
    // a full rounded crown: lobes spread through an ellipse, a big core, a few at the rim
    masses.push({ x: x + (R0() - 0.5) * 8, y: cy, rx: rx * 0.62, ry: ry * 0.56 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + R0() * 0.5;
      const rr = 0.42 + R0() * 0.2;
      masses.push({ x: x + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr * 0.9 - ry * 0.05, rx: rx * (0.32 + R0() * 0.12), ry: ry * (0.3 + R0() * 0.1) });
    }
    masses.push({ x: x + (R0() - 0.5) * rx * 0.3, y: cy - ry * 0.45, rx: rx * 0.36, ry: ry * 0.3 });
    for (const m of masses) m.z = m.y + m.ry * 0.3;
    layer(p.c, (l) => foliage(l, masses, LEAF, k.seed, { cell: 6, holes: 0.06, tilt: 0.16 }), { outline: 0.62 });
  },
};

const rob_poplar: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const R0 = rng(k.seed * 89 + 7);
    const s = 0.85 + R0() * 0.3;
    const H = 250 * s;
    contactShadow(p.c, x + 30 * s, y + 6, 40 * s, 12 * s, 0.3);
    layer(p.c, (l) => trunk2(l, x, y, 34 * s, 10 * s));
    const masses: Mass[] = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const w = 20 * s * (1 - Math.abs(t - 0.32) * 1.1);
      masses.push({ x: x + (R0() - 0.5) * 8, y: y - 34 * s - t * (H - 46 * s), rx: Math.max(7, w), ry: 22 * s, z: i });
    }
    masses.push({ x, y: y - H + 6, rx: 7 * s, ry: 12 * s, z: 20 });
    layer(p.c, (l) => foliage(l, masses, POPLAR, k.seed, { cell: 4, stretch: 1.6, tilt: 0.14, holes: 0.04 }), { outline: 0.62 });
  },
};

const HAW: Ramp = ['#0e2410', '#163614', '#224c18', '#30641c', '#427e22', '#5a962a', '#7aae38'];
const rob_hedge: PropArt = {
  draw(p, k) {
    const W = k.w;
    const R0 = rng(k.seed * 11 + 3);
    footShadow(p, 0, 0.3, W, 0.7, 16, 0.26);
    const masses: Mass[] = [];
    for (let a = 0.2; a < W - 0.1; a += 0.45) {
      const [mx, my] = p.P(a, 0.5, 6 + R0() * 4);
      masses.push({ x: mx, y: my, rx: 16 + R0() * 8, ry: 14 + R0() * 6, z: my });
    }
    layer(p.c, (l) => foliage(l, masses, HAW, k.seed, { cell: 3.4, tilt: 0.18, dots: k.seed % 2 ? ['#f2eee0', '#ffffff'] : ['#a8281e', '#c83a2a'], dotChance: 0.25, dotSize: 2 }), { outline: 0.6 });
  },
};

// ── drone pads ──────────────────────────────────────────────
/** A quadcopter seen three-quarter, centred on (x, y) — frame, rotors, skids, gimbal, LEDs. */
export function quad(l: CanvasRenderingContext2D, x: number, y: number, s = 1, spin = 0, pale = false) {
  const arm = (dx: number, dy: number) => {
    ln(l, x, y, x + dx * s, y + dy * s, '#2a2c32', 2);
    ell(l, x + dx * s, y + dy * s - 1, 2.2 * s, 1.6 * s, '#1e1e24');
    // the rotor: two pale blades (or a blur when spinning)
    if (spin) {
      l.fillStyle = 'rgba(220,226,232,0.45)';
      ell(l, x + dx * s, y + dy * s - 2, 7 * s, 3 * s, 'rgba(220,226,232,0.45)');
    } else {
      ln(l, x + dx * s - 6 * s, y + dy * s - 2, x + dx * s + 6 * s, y + dy * s - 3, '#c8ccd2');
    }
  };
  // skids under the body
  ln(l, x - 6 * s, y + 5 * s, x + 2 * s, y + 9 * s, '#2a2c32');
  ln(l, x - 1 * s, y + 3 * s, x + 7 * s, y + 7 * s, '#2a2c32');
  arm(-12, -2);
  arm(6, -6);
  // the body: a grey shell, a yellow battery, the camera gimbal
  fillPoly(l, [[x - 6 * s, y], [x + 1 * s, y - 4 * s], [x + 7 * s, y - 1 * s], [x, y + 3 * s]], pale ? '#d8dadf' : '#3a3d46');
  fillPoly(l, [[x - 6 * s, y], [x, y + 3 * s], [x, y + 5 * s], [x - 6 * s, y + 2 * s]], pale ? '#b4b6bc' : '#2a2c32');
  fillPoly(l, [[x, y + 3 * s], [x + 7 * s, y - 1 * s], [x + 7 * s, y + 1 * s], [x, y + 5 * s]], pale ? '#94969e' : '#1e2026');
  px(l, x - 2 * s, y - 2 * s, YEL[4], Math.max(1, 4 * s), Math.max(1, 1 * s));
  ell(l, x + 3 * s, y + 5 * s, 1.8 * s, 1.6 * s, '#121216');
  arm(-6, 6);
  arm(12, 2);
  px(l, x - 12 * s, y - 3 * s, '#ff4a3a', 1, 1);
  px(l, x + 12 * s, y + 1 * s, '#4aff7a', 1, 1);
}

const rob_pad: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const v = k.variant ?? 'drone';
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 2, 0.2);
    // a flush dark pad: rubberised deck, a thin white border, a white ring with an H
    lbox(p, 0.12, 0.12, W - 0.24, D - 0.24, 0, 0.3, { front: enamel(RUBBER), side: enamel(RUBBER), top: (_l) => (_u: number, _v: number, x: number, y: number) => (hash(x, y, 3) < 0.07 ? '#3c3d44' : hash(x, y, 4) < 0.05 ? '#1c1d22' : '#2a2b31'), edge: '#141418' });
    const z = 0.32;
    const sq = (a0: number, b0: number, a1: number, b1: number, col: string) => fillPoly(p.c, [p.P(a0, b0, z), p.P(a1, b0, z), p.P(a1, b1, z), p.P(a0, b1, z)], col);
    sq(0.22, 0.22, W - 0.22, 0.28, '#e8e6dc');
    sq(0.22, D - 0.28, W - 0.22, D - 0.22, '#e8e6dc');
    sq(0.22, 0.22, 0.28, D - 0.22, '#e8e6dc');
    sq(W - 0.28, 0.22, W - 0.22, D - 0.22, '#e8e6dc');
    const [cx, cy] = p.P(W / 2, D / 2, z);
    const R = Math.min(W, D) * 22;
    ell(p.c, cx, cy, R, R / 2, '#f4f2ea');
    ell(p.c, cx, cy, R - 4, R / 2 - 2, '#2a2b31');
    const H = (a0: number, b0: number, a1: number, b1: number) => sq(a0, b0, a1, b1, '#f4f2ea');
    const m = W / 2;
    H(m - 0.35, D / 2 - 0.3, m - 0.22, D / 2 + 0.3);
    H(m + 0.22, D / 2 - 0.3, m + 0.35, D / 2 + 0.3);
    H(m - 0.22, D / 2 - 0.05, m + 0.22, D / 2 + 0.05);
    // corner lights
    for (const [a, b] of [[0.25, 0.25], [W - 0.25, 0.25], [0.25, D - 0.25], [W - 0.25, D - 0.25]] as const) {
      const [lx, ly] = p.P(a, b, z);
      px(p.c, lx - 1, ly - 2, '#1e1e22', 3, 3);
    }
    if (v === 'drone') {
      const [dx, dy] = p.P(W / 2 + 0.35, D / 2 + 0.2, z);
      layer(p.c, (l) => quad(l, dx, dy - 6, 2.1), { outline: 0.55, rect: [dx - 40, dy - 30, dx + 40, dy + 24] });
    } else if (v === 'dock') {
      // a drone-in-a-box: a white station with its lid slid open, the drone charging inside
      lbox(p, W / 2 - 0.5, D / 2 - 0.42, 1.0, 0.84, z, 3.2, { front: enamel(SHELL), side: enamel(SHELL), top: (_l) => () => '#26282e', edge: SHELL[0] });
      lbox(p, W / 2 - 0.55, D / 2 - 0.85, 1.1, 0.42, z + 3.2, 0.5, mono(enamel(SHELL), SHELL[0]));
      const [dx, dy] = p.P(W / 2, D / 2 + 0.05, z + 3.2);
      layer(p.c, (l) => quad(l, dx, dy - 2, 0.9), { outline: 0.55, rect: [dx - 18, dy - 14, dx + 18, dy + 10] });
      const F = front(p, D / 2 + 0.42);
      pq(p, F, W / 2 - 0.4, W / 2 - 0.1, z + 0.6, z + 1.2, '#1e2a3a');
    }
  },
  anim(p, k) {
    // the corner lights chase round
    const W = k.w;
    const D = k.d;
    const u = p.k / 4;
    const i0 = Math.floor(k.t * 2 + k.seed) % 4;
    const cs = [[0.25, 0.25], [W - 0.25, 0.25], [W - 0.25, D - 0.25], [0.25, D - 0.25]] as const;
    cs.forEach(([a, b], i) => {
      const [lx, ly] = p.P(a, b, 0.32);
      px(p.c, lx - u, ly - u, i === i0 ? LED.green : '#2a5a3a', Math.max(1, 2 * u), Math.max(1, u));
    });
  },
};

// ── apron clutter ───────────────────────────────────────────
const rob_extcart: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 6, y + 2, 12, 4, 0.26);
    layer(
      p.c,
      (l) => {
        // two wheels, the handle, a big red bottle, a hose and horn
        ell(l, x - 6, y - 4, 4, 5, RUBBER[1]);
        ell(l, x - 6, y - 4, 1.6, 2, GALV[4]);
        for (let j = 0; j < 30; j++) {
          const w = j > 26 ? 7 - (j - 26) * 1.2 : 7;
          for (let i = -w; i < w; i++) {
            const t = (i + w) / (2 * w);
            px(l, x + i, y - 3 - j, RED[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.85 ? 3 : 2]);
          }
        }
        px(l, x - 7, y - 20, '#f2f0ea', 14, 5);
        px(l, x - 2, y - 36, '#2a2a30', 4, 6);
        ln(l, x + 2, y - 34, x + 12, y - 20, '#1e1e24', 2);
        ln(l, x + 12, y - 20, x + 10, y - 6, '#1e1e24', 2);
        ell(l, x + 6, y - 3, 4, 5, RUBBER[0]);
        ln(l, x - 6, y - 30, x - 12, y - 40, GALV[3], 2);
      },
      { rect: [x - 16, y - 44, x + 16, y + 4] },
    );
    void k;
  },
};

const rob_drums: PropArt = {
  draw(p, k) {
    footShadow(p, 0.08, 0.1, 0.92, 0.92, 9, 0.26);
    lbox(p, 0.08, 0.1, 0.84, 0.82, 0, 0.9, { front: enamel(['#5a3e22', '#7a5630', '#9a7040', '#b88a52', '#d0a468', '#e2bc82']), side: enamel(['#5a3e22', '#7a5630', '#9a7040', '#b88a52', '#d0a468', '#e2bc82']), top: (_l) => (u: number) => (u % 12 < 7 ? '#c8a068' : '#5a3e22'), edge: '#3e2a16' });
    const drum = (a: number, b: number, col: Ramp) => {
      const [x, y] = anchor(p, a, b, 0.9);
      layer(
        p.c,
        (l) => {
          const R0 = 9;
          for (let j = 0; j < 22; j++)
            for (let i = -R0; i <= R0; i++) {
              const t = (i + R0) / (2 * R0);
              let tone = t < 0.2 ? 5 : t < 0.45 ? 4 : t < 0.72 ? 3 : t < 0.9 ? 2 : 1;
              if (j === 6 || j === 15) tone += 1;
              px(l, x + i, y - j + Math.round(Math.sqrt(Math.max(0, 1 - (i / R0) ** 2)) * 3.5), col[Math.max(0, Math.min(col.length - 1, tone))]);
            }
          ell(l, x, y - 22, R0, 3.5, col[4]);
          ell(l, x + 3, y - 22, 1.6, 0.8, '#1e1e24');
        },
        { rect: [x - 12, y - 28, x + 12, y + 6] },
      );
    };
    const blue: Ramp = ['#0e2244', '#14305c', '#1c4078', '#265294', '#3466ae', '#4a80c8'];
    drum(0.3, 0.32, blue);
    drum(0.7, 0.34, RED);
    drum(0.32, 0.72, RED);
    drum(0.72, 0.74, blue);
    void k;
  },
};

const rob_bins: PropArt = {
  draw(p, k) {
    footShadow(p, 0.1, 0.12, 0.9, 0.9, 10, 0.26);
    const green: Ramp = ['#14301e', '#1c4028', '#245232', '#2e643c', '#3a7848', '#4a8a56'];
    for (const [a, col] of [[0.1, green], [0.52, ['#2a2c30', '#36383e', '#44464e', '#54565e', '#66686e', '#7a7c82'] as Ramp]] as const) {
      lbox(p, a, 0.24, 0.38, 0.56, 0.3, 9.4, { front: enamel(col), side: enamel(col), top: enamel(col), edge: col[0] });
      lbox(p, a - 0.02, 0.2, 0.42, 0.64, 9.7, 0.5, mono(enamel(col), col[0]));
      const [wx, wy] = anchor(p, a + 0.32, 0.26, 0.6);
      ell(p.c, wx, wy, 2.4, 3, RUBBER[1]);
    }
    void k;
  },
};

const rob_picnic: PropArt = {
  draw(p, k) {
    const W = k.w;
    footShadow(p, 0.1, 0.1, W - 0.1, 0.9, 8, 0.26);
    const wood = enamel(['#4a3020', '#644028', '#7e5434', '#986842', '#b07c52', '#c89464']);
    // A-frame legs, two benches and the table top, a parasol in the club's teal
    for (const a of [0.3, W - 0.4]) {
      lbox(p, a, 0.1, 0.1, 0.8, 0, 7.2, mono(wood, '#3a2414'));
    }
    lbox(p, 0.1, 0.04, W - 0.2, 0.18, 4.2, 0.4, mono(wood, '#3a2414'));
    lbox(p, 0.1, 0.78, W - 0.2, 0.18, 4.2, 0.4, mono(wood, '#3a2414'));
    lbox(p, 0.06, 0.28, W - 0.12, 0.44, 7.2, 0.45, mono(wood, '#3a2414'));
    const [x, y] = anchor(p, W / 2, 0.5, 7.65);
    layer(
      p.c,
      (l) => {
        px(l, x - 1, y - 52, '#e8e6e0', 2, 52);
        for (let i = 0; i < 8; i++) {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          const lit = Math.cos((a0 + a1) / 2 + 2.3) > 0;
          fillPoly(l, [[x, y - 60], [x + Math.cos(a0) * 40, y - 46 + Math.sin(a0) * 18], [x + Math.cos(a1) * 40, y - 46 + Math.sin(a1) * 18]], i % 2 ? (lit ? '#3fb6c8' : '#2b8a9a') : lit ? '#f2f0e6' : '#cfccc0');
        }
        // a coffee cup and a flight logbook on the table
        px(l, x - 14, y - 6, '#f2ead8', 4, 5);
        fillPoly(l, [[x + 6, y - 2], [x + 14, y - 6], [x + 20, y - 3], [x + 12, y + 1]], '#1e3a6a');
      },
      { rect: [x - 44, y - 64, x + 44, y + 4] },
    );
    void k;
  },
};

export const ROBOTICS_AIRFIELD: Record<string, PropArt> = {
  rob_mark,
  rob_light,
  rob_sign,
  rob_windsock,
  rob_papi,
  rob_approach,
  rob_cone,
  rob_fence,
  rob_gate,
  rob_tuft,
  rob_flowers,
  rob_bush,
  rob_tree,
  rob_poplar,
  rob_hedge,
  rob_pad,
  rob_extcart,
  rob_drums,
  rob_bins,
  rob_picnic,
};

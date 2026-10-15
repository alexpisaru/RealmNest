// Robotics — the summer countryside round the airfield, and the extra apron and
// landside clutter of the owner's retouched picture (128×64, 1 z ≈ 10 cm).
//   rob_pine     a Scots-pine-like conifer in tiers (size by seed)
//   rob_bale     a round hay bale in the wheat
//   rob_reeds    a clump of reeds and bulrushes at the pond's edge
//   rob_rail     a weathered post-and-rail fence (w tiles along a)
//   rob_tank     the white fuel tank of the south compound: ladder, cage, vent
//   rob_kiosk    a grey electrical cabinet with louvres and a warning sign
//   rob_lamp     a tall lamp post (car park, apron, fence line)
//   rob_crates   wooden crates on a pallet (variants by seed)
//   rob_disc     the round yellow taxiway location disc ("A")
import type { PropArt } from '../../../props';
import { bayer, contactShadow, ell, fillPoly, hash, layer, ln, px, type Ramp, rng } from '../../kit4';
import { front, pq, pt } from '../../plane4';
import { anchor, footShadow, lbox, mono } from '../util';
import { cylinder, drawMesh, type Face } from './mesh';
import { enamel, GALV, KRAFT, PINE, RED, stencil, YEL } from './rkit';

// ── palette sampled from the reference ──────────────────────
/** pine needles: #011608 … #679b2e in the picture */
const NEEDLE: Ramp = ['#081a0c', '#0e2a10', '#173c14', '#22521a', '#2e6a1e', '#428424', '#5e9e2e', '#86ba44'];
const BARK: Ramp = ['#2a1a12', '#40281a', '#5a3a22', '#74502e', '#8e663c'];
/** hay: #dea640 / #f1b44d */
const HAY: Ramp = ['#7a5214', '#a06c1c', '#c48a28', '#dea640', '#ecba52', '#f6d27a', '#fce6a8'];
const REED: Ramp = ['#2a3a10', '#3e5216', '#566c1c', '#708824', '#8ca232', '#a8b84a'];
const WHITE_T: Ramp = ['#8c9096', '#a8acb2', '#c4c8cc', '#dcdfe2', '#ebedef', '#f6f7f8', '#ffffff'];
const CAB: Ramp = ['#4e5258', '#686c72', '#82868c', '#9a9ea4', '#b2b6ba', '#c8ccd0', '#dcdfe2'];
const WOOD: Ramp = ['#3a2616', '#54381e', '#6e4c2a', '#8a6238', '#a47a48', '#bc925c'];

// ── pines ───────────────────────────────────────────────────
/**
 * A conifer in drooping tiers, painted pixel by pixel: each tier a skirt that
 * widens to a ragged hem, lit from the upper left, the shade of the tier above
 * under its top, needle grain, a few bright tips. Size and slenderness by seed.
 */
const rob_pine: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const R0 = rng(k.seed * 131 + 17);
    const s = 0.9 + R0() * 0.5;
    const H = Math.round(260 * s);
    const W = (54 + R0() * 18) * s;
    const trunkH = Math.round(30 * s);
    const tiers = 5 + Math.floor(R0() * 2);
    contactShadow(p.c, x + 28 * s, y + 6, W * 0.95, 14 * s, 0.5);
    layer(
      p.c,
      (l) => {
        // the trunk, reddish under the crown
        for (let j = 0; j < trunkH + 20; j++)
          for (let i = -4; i <= 4; i++) {
            if (Math.abs(i) > 4 * s + 1) continue;
            const t = (i + 4) / 8;
            px(l, x + i, y - j, BARK[t < 0.3 ? 4 : t < 0.6 ? 3 : t < 0.85 ? 2 : 1]);
          }
        const top = y - H;
        const crown = H - trunkH;
        for (let yy = top; yy < y - trunkH + 6; yy++) {
          const t = (yy - top) / crown; // 0 at the tip, 1 at the base
          const tt = Math.min(0.999, Math.max(0, t));
          const ti = Math.floor(tt * tiers);
          const f = tt * tiers - ti; // 0 top of a tier, 1 its hem
          const env = W * Math.pow(Math.min(1, t * 1.05), 0.85);
          const half = env * (0.5 + 0.5 * f);
          for (let xx = Math.floor(x - half - 3); xx <= Math.ceil(x + half + 3); xx++) {
            const dx = xx - x;
            // a ragged edge: drooping branch tips along the hem
            const rag = (hash(Math.floor(xx / 3), ti, k.seed) - 0.5) * 6 + (f > 0.8 ? (hash(xx, ti + 7, k.seed) - 0.5) * 4 : 0);
            if (Math.abs(dx) > half + rag * 0.5) continue;
            if (f > 0.86 && hash(xx >> 1, ti, k.seed + 3) < (f - 0.86) * 6) continue;
            const nx = dx / Math.max(4, half);
            let i = 3.5 - nx * 2.3 - f * 0.5;
            if (f < 0.3) i -= (0.3 - f) * 11; // in the shade of the tier above
            if (f > 0.55 && f < 0.75 && nx < 0.2) i += 0.8; // the lit swell of the tier
            // needle grain: short diagonal strokes
            const g = hash(Math.floor((xx + yy) / 2), Math.floor(yy / 2), k.seed + 5);
            if (g < 0.22) i -= 1;
            else if (g > 0.9) i += 0.9;
            if (t < 0.08) i += 0.6;
            const d = bayer(xx, yy) - 0.5;
            const tone = Math.max(0, Math.min(NEEDLE.length - 1, Math.round(i + d * 0.8)));
            px(l, xx, yy, NEEDLE[tone]);
          }
        }
        // a few bright new shoots on the lit side
        for (let n = 0; n < 14; n++) {
          const ty = top + 10 + R0() * (crown - 20);
          const tt = (ty - top) / crown;
          const half = W * Math.pow(tt, 0.85) * 0.8;
          px(l, x - half * R0(), ty, NEEDLE[7], 2, 1);
        }
      },
      { outline: 0.62, rect: [x - W - 12, y - H - 6, x + W + 12, y + 4] },
    );
  },
};

// ── hay bales, reeds ────────────────────────────────────────
const rob_bale: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p);
    const R0 = rng(k.seed * 7 + 3);
    const r = 20 + R0() * 3;
    contactShadow(p.c, x + 14, y + 2, 30, 9, 0.38);
    layer(
      p.c,
      (l) => {
        // the rolled body seen from the side: lit top, straw stripes round it
        for (let yy = -2 * r; yy <= 0; yy++)
          for (let xx = -r - 8; xx <= r + 8; xx++) {
            const v = (yy + r) / r; // −1 top … 1 bottom
            if (Math.abs(xx) > r + 8 - Math.max(0, Math.abs(v) - 0.7) * 26) continue;
            let i = 3.6 - v * 1.6 - (xx / r) * 0.6;
            if (hash(xx >> 1, yy, k.seed) < 0.18) i -= 1;
            if ((yy & 3) === 0) i -= 0.5;
            px(l, x + xx, y + yy, HAY[Math.max(0, Math.min(6, Math.round(i + bayer(xx, yy) - 0.5)))]);
          }
        // the visible end: a spiral of straw
        const ex = x + r + 4;
        const ey = y - r;
        for (let rr = r; rr > 0; rr -= 1) {
          const c = rr % 4 === 0 ? HAY[2] : rr % 4 === 2 ? HAY[5] : HAY[4];
          ell(l, ex - (r - rr) * 0.15, ey, rr * 0.42, rr, c);
        }
        px(l, ex - 1, ey - 1, HAY[1], 2, 2);
      },
      { outline: 0.6, rect: [x - r - 14, y - 2 * r - 6, x + r + 20, y + 4] },
    );
  },
};

const rob_reeds: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    const R0 = rng(k.seed * 19 + 5);
    layer(
      p.c,
      (l) => {
        const n = 26 + Math.floor(R0() * 10);
        for (let i = 0; i < n; i++) {
          const bx = x + (R0() - 0.5) * 44;
          const by = y + (R0() - 0.5) * 14;
          const h = 26 + R0() * 34;
          const lean = (R0() - 0.5) * 10;
          const col = REED[1 + Math.floor(R0() * 5)];
          ln(l, bx, by, bx + lean * 0.4, by - h * 0.6, col);
          ln(l, bx + lean * 0.4, by - h * 0.6, bx + lean, by - h, col);
          if (R0() < 0.25) {
            // a bulrush head
            px(l, bx + lean - 1, by - h - 1, '#4a2e16', 3, 7);
            px(l, bx + lean - 1, by - h - 1, '#6e4626', 1, 6);
          }
        }
        for (let i = 0; i < 8; i++) px(l, x - 18 + i * 5, y + 2, REED[0], 4, 1);
      },
      { outline: 0.45, rect: [x - 32, y - 70, x + 32, y + 12] },
    );
  },
};

// ── a post-and-rail fence ───────────────────────────────────
const rob_rail: PropArt = {
  draw(p, k) {
    const W = k.w;
    const F = front(p, 0.5);
    for (const z of [5, 9.5]) {
      pt(p, F, 0, W, z, z + 1.1, (u: number, v: number, xx: number, yy: number) => {
        let i = (v > 0.5 ? 4 : 2.6) + (hash(Math.floor(u / 6), Math.floor(z), 3) - 0.5);
        if (hash(xx, yy, 4) < 0.08) i -= 1;
        return WOOD[Math.max(0, Math.min(5, Math.round(i)))];
      }, F.light);
    }
    for (let a = 0; a <= W + 0.01; a += 1) {
      const aa = Math.min(W - 0.1, a);
      lbox(p, aa, 0.44, 0.1, 0.1, 0, 12, { front: enamel(WOOD), side: enamel(WOOD), top: enamel(WOOD), edge: WOOD[0] });
    }
  },
};

// ── the south compound ──────────────────────────────────────
const rob_tank: PropArt = {
  draw(p, k) {
    const W = k.w;
    const D = k.d;
    const c = W / 2;
    const cb = D / 2;
    footShadow(p, 0.1, 0.1, W - 0.1, D - 0.1, 30, 0.34);
    const faces: Face[] = [];
    faces.push(...cylinder('z', c, cb, 0, 0.92, 0.92, 2.4, 14, CAB));
    faces.push(...cylinder('z', c, cb, 2.4, 0.88, 0.88, 12.4, 14, WHITE_T, { caps: false }));
    faces.push(...cylinder('z', c, cb, 14.8, 0.885, 0.885, 1.6, 14, RED, { caps: false }));
    faces.push(...cylinder('z', c, cb, 16.4, 0.88, 0.88, 7, 14, WHITE_T));
    layer(p.c, (l) => drawMesh(p, faces, { c: l }), { outline: 0.5 });
    // a shallow dome, the vent, the stencil band, a ladder with a hoop cage
    const [tx, ty] = p.P(c, cb, 23.4);
    ell(p.c, tx, ty, 58, 29, WHITE_T[4]);
    ell(p.c, tx - 6, ty - 3, 40, 19, WHITE_T[5]);
    ell(p.c, tx - 12, ty - 6, 18, 8, WHITE_T[6]);
    px(p.c, tx - 4, ty - 14, CAB[2], 8, 10);
    px(p.c, tx - 6, ty - 16, CAB[4], 12, 3);
    const [lx, ly] = p.P(c + 0.92, cb + 0.3, 0);
    layer(
      p.c,
      (l) => {
        ln(l, lx - 3, ly, lx - 3, ly - 100, GALV[3]);
        ln(l, lx + 3, ly - 2, lx + 3, ly - 102, GALV[3]);
        for (let i = 0; i < 12; i++) px(l, lx - 3, ly - 6 - i * 8, GALV[5], 7, 1);
        for (let i = 0; i < 6; i++) ell(l, lx, ly - 46 - i * 10, 8, 3, i & 1 ? GALV[2] : GALV[4]);
      },
      { rect: [lx - 12, ly - 110, lx + 12, ly + 2] },
    );
  },
};

const rob_kiosk: PropArt = {
  draw(p, k) {
    const R0 = rng(k.seed * 5 + 1);
    const h = 9 + Math.floor(R0() * 4);
    footShadow(p, 0.15, 0.2, 0.85, 0.8, h, 0.34);
    const louvre = (light: 0 | 1 | 2) => (_u: number, v: number, xx: number, yy: number) => {
      let i = light === 2 ? 5 : light ? 4 : 2.2;
      if (v > h * 4 - 10 && v % 3 < 1) i -= 1.4;
      if (v < 3) i -= 1;
      if (hash(xx, yy, 7) < 0.03) i -= 1;
      return CAB[Math.max(0, Math.min(6, Math.round(i)))];
    };
    lbox(p, 0.2, 0.25, 0.6, 0.5, 0, h, { front: louvre, side: louvre, top: louvre, edge: CAB[0] });
    lbox(p, 0.17, 0.22, 0.66, 0.56, h, 0.5, mono(enamel(CAB), CAB[0]));
    const F = front(p, 0.75);
    pq(p, F, 0.48, 0.5, 0.6, h - 1, CAB[1]);
    const [wx, wy] = F.F(0.3, h * 0.62);
    fillPoly(p.c, [[wx, wy - 5], [wx + 5, wy + 3], [wx - 5, wy + 3]], '#1e1e24');
    fillPoly(p.c, [[wx, wy - 3], [wx + 3, wy + 2], [wx - 3, wy + 2]], YEL[4]);
    px(p.c, wx + 10, wy, '#d8402e', 3, 3);
  },
};

const rob_lamp: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 4, y + 1, 7, 3, 0.3);
    layer(
      p.c,
      (l) => {
        px(l, x - 3, y - 6, CAB[2], 6, 6);
        px(l, x - 1, y - 96, GALV[4], 3, 92);
        px(l, x - 1, y - 96, GALV[6], 1, 92);
        ln(l, x, y - 96, x + 14, y - 100, GALV[3], 2);
        px(l, x + 8, y - 104, '#3a3c42', 14, 5);
        px(l, x + 9, y - 100, '#fff2c0', 12, 2);
      },
      { outline: 0.5, rect: [x - 8, y - 110, x + 26, y + 4] },
    );
    void k;
  },
  lights: () => [{ a: 0.75, b: 0.35, z: 25, r: 2.6, kind: 'lamp' }],
};

const rob_crates: PropArt = {
  draw(p, k) {
    const R0 = rng(k.seed * 23 + 7);
    footShadow(p, 0.08, 0.1, 0.92, 0.92, 10, 0.36);
    lbox(p, 0.08, 0.1, 0.84, 0.8, 0, 0.8, mono(enamel(PINE), PINE[0]));
    const crate = (a: number, b: number, w: number, d: number, z: number, h: number, r: Ramp) => {
      const mat = (light: 0 | 1 | 2) => (u: number, v: number, xx: number, yy: number) => {
        let i = light === 2 ? 5 : light ? 4 : 2.4;
        if (u < 2 || v < 2 || v > h * 4 - 2 || u % 22 < 2) i -= 1.2;
        if (v % 8 < 1) i -= 0.6;
        if (hash(xx, yy, 9) < 0.05) i -= 0.8;
        return r[Math.max(0, Math.min(r.length - 1, Math.round(i)))];
      };
      lbox(p, a, b, w, d, z, h, { front: mat, side: mat, top: mat, edge: r[0] });
    };
    const big = R0() < 0.5;
    crate(0.12, 0.14, 0.42, 0.74, 0.8, 5, PINE);
    crate(0.54, 0.4, 0.36, 0.48, 0.8, 4, R0() < 0.5 ? KRAFT : PINE);
    if (big) crate(0.18, 0.2, 0.34, 0.5, 5.8, 3.6, KRAFT);
    const F = front(p, 0.88);
    const [sx, sy] = F.F(0.6, 3.6);
    stencil(p.c, 'UP', sx, sy, 1.34, 0.67, 0, 1.2, '#2a1e14');
  },
};

/** A baggage train: a yellow tractor pulling three dollies loaded with crates and bags. */
/** The yellow round location disc on a post by the taxiway corner. */
const rob_disc: PropArt = {
  draw(p, k) {
    const [x, y] = anchor(p, 0.5, 0.5);
    contactShadow(p.c, x + 6, y + 2, 10, 4, 0.32);
    layer(
      p.c,
      (l) => {
        px(l, x - 1, y - 18, GALV[3], 3, 18);
        ell(l, x, y - 26, 12, 12, '#2a2210');
        ell(l, x, y - 26, 11, 11, YEL[4]);
        ell(l, x - 3, y - 29, 5, 4, YEL[5]);
        stencil(l, 'A', x - 3, y - 31, 2, 0, 0, 2, '#1e1a10');
      },
      { outline: 0.5, rect: [x - 16, y - 42, x + 16, y + 4] },
    );
    void k;
  },
};

export const ROBOTICS_COUNTRY: Record<string, PropArt> = { rob_pine, rob_bale, rob_reeds, rob_rail, rob_tank, rob_kiosk, rob_lamp, rob_crates, rob_disc };

// Factory — flat details baked into the ground (they never block a tile).
//   fac_decal variants: puddle · oil · manhole · drain · bay · hatch · arrow · tyres ·
//   weeds · coal · litter · feathers · bricks · slow · grate
import type { PropArt } from '../../../props';
import { ell, fillPoly, hash, ln, px, rng } from '../../kit4';
import { planeText } from './font';
import { front } from '../../plane4';
import { BRICK, IRON, WEED } from './palette';

const fac_decal: PropArt = {
  draw(p, k) {
    const v = k.variant ?? 'puddle';
    const W = p.pw;
    const D = p.pd;
    const [x, y] = p.P(W / 2, D / 2);
    const c = p.c;
    const Rn = rng(k.seed * 7 + 3);
    const P = (a: number, b: number) => p.P(a, b);
    if (v === 'puddle') {
      // a shallow puddle: dark rim, the sky in it, a few ripples
      const rx = 18 + Rn() * 22;
      const ry = rx * 0.42;
      const blob = (grow: number, col: string) => {
        for (let i = 0; i < 4; i++) ell(c, x + (hash(i, 1, k.seed) - 0.5) * rx * 0.8, y + (hash(i, 2, k.seed) - 0.5) * ry * 0.6, rx * (0.55 + hash(i, 3, k.seed) * 0.3) + grow, ry * (0.6 + hash(i, 4, k.seed) * 0.3) + grow * 0.5, col);
      };
      blob(2, '#2a2a30');
      blob(0, '#5a6a74');
      blob(-4, '#7a8e98');
      px(c, x - rx * 0.3, y - 2, '#b8c8cc', Math.round(rx * 0.5), 1);
      px(c, x - rx * 0.1, y + 2, '#9aaab0', Math.round(rx * 0.3), 1);
    } else if (v === 'oil') {
      ell(c, x, y, 16, 7, '#2a2a30');
      ell(c, x - 2, y - 1, 12, 5, '#36363e');
      px(c, x - 6, y - 2, '#6a5a8a', 4, 1);
      px(c, x - 1, y - 1, '#4a7a6a', 4, 1);
      px(c, x + 3, y, '#8a6a4a', 3, 1);
    } else if (v === 'manhole') {
      // a square cast-iron cover in a frame, a chequer of raised bars
      const q = [P(0.28, 0.28), P(0.72, 0.28), P(0.72, 0.72), P(0.28, 0.72)];
      fillPoly(c, q, IRON[1]);
      fillPoly(c, [P(0.31, 0.31), P(0.69, 0.31), P(0.69, 0.69), P(0.31, 0.69)], IRON[3]);
      for (let i = 1; i < 6; i++) {
        const f = 0.31 + i * 0.063;
        const [a0, a1] = [P(f, 0.31), P(f, 0.69)];
        ln(c, a0[0], a0[1], a1[0], a1[1], IRON[2]);
        const [b0, b1] = [P(0.31, f), P(0.69, f)];
        ln(c, b0[0], b0[1], b1[0], b1[1], IRON[4]);
      }
    } else if (v === 'drain') {
      // a gully grate at the kerb: bars, dark slots, a leaf caught in it
      fillPoly(c, [P(0.3, 0.38), P(0.7, 0.38), P(0.7, 0.62), P(0.3, 0.62)], IRON[0]);
      for (let i = 0; i < 6; i++) {
        const f = 0.32 + i * 0.065;
        const [a0, a1] = [P(f, 0.4), P(f, 0.6)];
        ln(c, a0[0], a0[1], a1[0], a1[1], IRON[3]);
      }
      px(c, x + 3, y - 1, '#8a6a3a', 4, 2);
    } else if (v === 'bay' || v === 'hatch') {
      // painted yellow lines: a parking bay, or a hatched keep-clear box
      const yel = '#d8a82c';
      const line = (a0: number, b0: number, a1: number, b1: number) => {
        const [x0, y0] = P(a0, b0);
        const [x1, y1] = P(a1, b1);
        for (let t = 0; t <= 1; t += 0.01) if (hash(Math.round(t * 100), 7, k.seed) > 0.08) px(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, yel, 3, 2);
      };
      if (v === 'bay') {
        line(0.05, 0.05, 0.05, D - 0.05);
        line(W - 0.05, 0.05, W - 0.05, D - 0.05);
        line(0.05, 0.05, W - 0.05, 0.05);
      } else {
        line(0.05, 0.05, W - 0.05, 0.05);
        line(W - 0.05, 0.05, W - 0.05, D - 0.05);
        line(W - 0.05, D - 0.05, 0.05, D - 0.05);
        line(0.05, D - 0.05, 0.05, 0.05);
        for (let s = 0.3; s < W + D - 0.2; s += 0.35) {
          const a0 = Math.max(0.05, s - (D - 0.1));
          const b0 = Math.min(D - 0.05, s);
          const a1 = Math.min(W - 0.05, s);
          const b1 = Math.max(0.05, s - (W - 0.1));
          line(a0, b0, a1, b1);
        }
      }
    } else if (v === 'walk') {
      // a yellow pedestrian walkway line along the shop's yard wall, dashed and worn
      const [x0, y0] = P(0.5, 0);
      const [x1, y1] = P(0.5, D);
      for (let t = 0; t < 1; t += 0.005) if ((t * 10) % 1 < 0.65 && hash(Math.round(t * 200), 3, k.seed) > 0.1) px(c, x0 + (x1 - x0) * t - 1, y0 + (y1 - y0) * t, '#d8a82c', 3, 2);
    } else if (v === 'arrow') {
      const col = '#d8d4c8';
      const pts = [P(0.2, 0.44), P(0.6, 0.44), P(0.6, 0.32), P(0.85, 0.5), P(0.6, 0.68), P(0.6, 0.56), P(0.2, 0.56)];
      fillPoly(c, pts, col);
      for (let i = 0; i < 20; i++) px(c, x - 20 + Rn() * 40, y - 8 + Rn() * 16, '#5a5a60', 2, 1);
    } else if (v === 'slow') {
      planeText(c, front(p, D * 0.5), W / 2, 0, 'SLOW', '#d8d4c8', 3);
    } else if (v === 'tyres') {
      // two dark tyre tracks curving across
      for (const off of [-0.18, 0.18]) {
        let [px0, py0] = P(0, D / 2 + off);
        for (let t = 0.05; t <= 1.001; t += 0.05) {
          const [px1, py1] = P(t * W, D / 2 + off + Math.sin(t * 3 + k.seed) * 0.12);
          ln(c, px0, py0, px1, py1, '#2a2a2e', 3);
          px0 = px1;
          py0 = py1;
        }
      }
    } else if (v === 'weeds') {
      // a crack with grass and a dandelion pushing through
      let [cx, cy] = P(0.2, 0.3 + Rn() * 0.4);
      for (let i = 0; i < 10; i++) {
        const nx = cx + 6 + Rn() * 4;
        const ny = cy + (Rn() - 0.5) * 6;
        ln(c, cx, cy, nx, ny, '#2a2a2e');
        if (i % 2 === 0) {
          px(c, cx, cy - 3, WEED[3], 1, 3);
          px(c, cx + 1, cy - 5, WEED[4], 1, 4);
          px(c, cx - 1, cy - 2, WEED[2], 1, 2);
        }
        cx = nx;
        cy = ny;
      }
      if (Rn() < 0.6) {
        ell(c, x, y - 2, 5, 2, WEED[2]);
        px(c, x - 1, y - 8, WEED[4], 1, 6);
        ell(c, x, y - 9, 2.4, 2, '#f2c83a');
      }
    } else if (v === 'coal') {
      for (let i = 0; i < 70; i++) {
        const ox = (Rn() - 0.5) * 70 * W;
        const oy = (Rn() - 0.5) * 30 * D;
        px(c, x + ox, y + oy, i % 4 ? '#1e1c22' : '#3a3846', 1 + (i % 3 === 0 ? 1 : 0), 1);
      }
    } else if (v === 'litter') {
      for (let i = 0; i < 12; i++) {
        const [fx, fy] = P(Rn() * W, Rn() * D);
        px(c, fx, fy, ['#8a6a3a', '#a87a3a', '#6a5a2a', '#c89a4a'][i % 4], 3, 2);
      }
      const [lx, ly] = P(0.6, 0.4);
      px(c, lx, ly, '#e2402e', 5, 3);
      px(c, lx + 1, ly + 1, '#f2eee2', 3, 1);
      for (let i = 0; i < 4; i++) {
        const [fx, fy] = P(Rn() * W, Rn() * D);
        px(c, fx, fy, '#e8e4d8', 2, 1);
        px(c, fx + 2, fy, '#c8743a', 1, 1);
      }
    } else if (v === 'feathers') {
      for (let i = 0; i < 6; i++) {
        const [fx, fy] = P(Rn() * W, Rn() * D);
        ln(c, fx, fy, fx + 4, fy - 1, '#a8acb4');
        px(c, fx, fy, '#e0e2e6', 2, 1);
      }
    } else if (v === 'bricks') {
      for (let i = 0; i < 18; i++) {
        const [fx, fy] = P(Rn() * W, Rn() * D);
        const col = BRICK[2 + Math.floor(Rn() * 4)];
        px(c, fx, fy, col, 4 + Math.floor(Rn() * 3), 2);
        px(c, fx, fy + 2, BRICK[1], 4, 1);
      }
    } else if (v === 'grate') {
      // a long steel trench grate across a doorway
      fillPoly(c, [P(0.05, 0.4), P(W - 0.05, 0.4), P(W - 0.05, 0.6), P(0.05, 0.6)], IRON[0]);
      for (let a = 0.08; a < W - 0.05; a += 0.06) {
        const [a0, a1] = [P(a, 0.42), P(a, 0.58)];
        ln(c, a0[0], a0[1], a1[0], a1[1], IRON[3]);
      }
    }
  },
};

export const FACTORY_DECALS: Record<string, PropArt> = { fac_decal };

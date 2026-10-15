// ─────────────────────────────────────────────────────────────
// Homestead / garden props for the Farm vertical slice
// (also reused by other outdoor scenes). Prop-local coordinates:
// a = width, b = depth, b = d is the front (faces the viewer).
// ─────────────────────────────────────────────────────────────

import { darken, lighten, mix, withAlpha } from './color';
import { OUT, poly, type PropPainter, rect } from './iso';
import { disc, foliage, type PropArt } from './props';

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const WOOD = '#8a5a3c';
const WOOD_L = '#a8734c';
const WOOD_D = '#5e3c28';
const FLOWER_SETS: Record<string, string[]> = {
  pink: ['#ef9ac0', '#f7c4da', '#e2558a'],
  yellow: ['#f2d06b', '#fff1a8', '#e8a53d'],
  purple: ['#b48ae8', '#d6bdf5', '#7d5bc4'],
  red: ['#e2553b', '#f08a6a', '#b8392a'],
  white: ['#fbf4e4', '#ffffff', '#e8dcc4'],
  mixed: ['#ef9ac0', '#f2d06b', '#b48ae8', '#fbf4e4', '#e2553b'],
};

function poly3(p: PropPainter, pts: [number, number, number][], col: string) {
  poly(
    p.c,
    pts.map(([a, b, z]) => p.P(a, b, z)),
    col,
  );
}

/** A cluster of flower dots over foliage. */
function flowerClump(p: PropPainter, a: number, b: number, z: number, r: number, set: string[], seed: number, leaf = '#4f9a55') {
  foliage(p, a, b, z, r, leaf, seed);
  const [x, y] = p.P(a, b, z);
  for (let i = 0; i < r * 2.2; i++) {
    const fx = x + (hash(i, seed, 3) - 0.5) * r * 1.8;
    const fy = y + (hash(seed, i, 4) - 0.6) * r * 1.3;
    const col = set[Math.floor(hash(i, seed, 5) * set.length)];
    rect(p.c, fx, fy, 2, 1, col);
    rect(p.c, fx, fy - 1, 1, 1, lighten(col, 0.3));
  }
}

function stoneFace(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number, base: string, seed: number) {
  p.face(a0, a1, b, z0, z1, darken(base, 0.25));
  const rows = Math.max(1, Math.round((z1 - z0) / 4));
  for (let r = 0; r < rows; r++) {
    const zz0 = z0 + ((z1 - z0) * r) / rows + 0.5;
    const zz1 = z0 + ((z1 - z0) * (r + 1)) / rows - 0.5;
    let a = a0 + (r % 2) * 0.12;
    let i = 0;
    while (a < a1 - 0.05) {
      const w = 0.18 + hash(i, r, seed) * 0.16;
      const tone = hash(r, i, seed + 1);
      p.face(Math.max(a0, a + 0.02), Math.min(a1, a + w - 0.02), b, zz0, zz1, tone > 0.66 ? lighten(base, 0.12) : tone > 0.33 ? base : darken(base, 0.08));
      a += w;
      i++;
    }
  }
}

// ── buildings ───────────────────────────────────────────────

const farmhouse: PropArt = {
  draw(p, k) {
    const w = k.w;
    const d = k.d;
    const wd = d - 0.7; // wall depth, steps in front
    const wall = '#f0e1c6';
    const timber = '#7a4e33';
    p.shadow(0, 0, w + 0.4, d);
    p.box(0, 0, w, wd, 0, 5, '#9a8f84');
    stoneFace(p, 0, w, wd, 0, 5, '#a59a8a', 3);
    p.box(0.08, 0.08, w - 0.16, wd - 0.16, 5, 38, wall);
    // timber frame on the front and right side
    for (const a of [0.08, w / 4, w / 2 - 0.55, w / 2 + 0.55, (3 * w) / 4, w - 0.08]) p.face(a - 0.05, a + 0.05, wd - 0.08, 5, 43, timber);
    p.face(0.08, w - 0.08, wd - 0.08, 24, 26, timber);
    p.face(0.08, w - 0.08, wd - 0.08, 41, 43, timber);
    for (const b of [0.1, wd / 2, wd - 0.1]) p.side(w - 0.08, b - 0.05, b + 0.05, 5, 43, darken(timber, 0.2));
    p.side(w - 0.08, 0.08, wd - 0.08, 24, 26, darken(timber, 0.2));
    // windows with green frames, shutters and flower boxes
    const win = (a: number) => {
      p.face(a - 0.18, a - 0.04, wd - 0.08, 12, 30, '#3f8a6a');
      p.face(a + 0.84, a + 0.98, wd - 0.08, 12, 30, '#3f8a6a');
      p.face(a, a + 0.8, wd - 0.08, 11, 31, '#2f5a4a');
      p.face(a + 0.06, a + 0.74, wd - 0.08, 12, 30, '#8fc4e0');
      p.face(a + 0.06, a + 0.74, wd - 0.08, 22, 30, '#b8dcef');
      p.face(a + 0.38, a + 0.42, wd - 0.08, 12, 30, '#2f5a4a');
      p.face(a + 0.06, a + 0.74, wd - 0.08, 20, 21, '#2f5a4a');
      p.ln(a + 0.15, wd - 0.08, 28, a + 0.3, wd - 0.08, 25, '#ffffff');
      p.box(a - 0.06, wd - 0.05, 0.92, 0.22, 8, 4, WOOD);
      const [fx, fy] = p.P(a + 0.4, wd + 0.06, 13);
      for (let i = 0; i < 9; i++) {
        const col = ['#e2558a', '#f2d06b', '#e2553b', '#fbf4e4'][i % 4];
        rect(p.c, fx - 8 + i * 2, fy - 2 - (i % 2), 2, 2, i % 3 ? '#4f9a55' : col);
      }
    };
    win(0.55);
    win(w / 4 + 0.55);
    win(w - w / 4 - 1.35);
    win(w - 1.45);
    // side windows
    for (const b of [0.7, wd - 1.6]) {
      p.side(w - 0.08, b, b + 0.8, 12, 30, '#2f5a4a');
      p.side(w - 0.08, b + 0.06, b + 0.74, 13, 29, '#7fb2cc');
    }
    // door, canopy and steps
    const m = w / 2;
    p.face(m - 0.48, m + 0.48, wd - 0.08, 5, 33, '#2f5a4a');
    p.face(m - 0.42, m + 0.42, wd - 0.08, 5, 31, '#7a4a2e');
    p.face(m - 0.36, m - 0.04, wd - 0.08, 18, 28, '#8a5a3a');
    p.face(m + 0.04, m + 0.36, wd - 0.08, 18, 28, '#8a5a3a');
    p.dot(m + 0.25, wd - 0.08, 17, '#f2d06b', 2, 2);
    p.box(m - 0.7, wd - 0.1, 1.4, 0.45, 34, 3, '#3f8a6a');
    p.box(m - 0.6, wd, 1.2, 0.35, 0, 4, '#b5ab9c');
    p.box(m - 0.5, wd + 0.3, 1.0, 0.32, 0, 2, '#c4baa9');
    // lanterns either side of the door
    for (const a of [m - 0.75, m + 0.65]) {
      p.box(a, wd - 0.05, 0.12, 0.08, 26, 6, '#2b2236');
      p.face(a + 0.02, a + 0.1, wd + 0.03, 27, 31, '#ffd98a');
    }
    // hip roof with clay-green tiles
    const ov = 0.35;
    const z0 = 43;
    const zr = 82;
    const r0 = 1.6;
    const front: [number, number, number][] = [[-ov, wd + ov, z0], [w + ov, wd + ov, z0], [w - r0, wd / 2, zr], [r0, wd / 2, zr]];
    const side: [number, number, number][] = [[w + ov, -ov, z0], [w + ov, wd + ov, z0], [w - r0, wd / 2, zr]];
    poly3(p, side, '#2f6a52');
    poly3(p, front, '#4f8f72');
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      const b = wd + ov - (wd / 2 + ov) * f;
      const z = z0 + (zr - z0) * f;
      const a0 = -ov + (r0 + ov) * f;
      const a1 = w + ov - (r0 + ov) * f;
      p.ln(a0, b, z, a1, b, z, '#3d7a60');
      for (let a = a0 + ((i % 2) * 0.15); a < a1; a += 0.3) p.ln(a, b, z, a, b + 0.1, z - 2, '#2f6a52');
      // side slope rows
      const sb0 = -ov + (wd / 2 + ov) * f;
      const sb1 = wd + ov - (wd / 2 + ov) * f;
      const sa = w + ov - (r0 + ov) * f;
      p.ln(sa, sb0, z, sa, sb1, z, '#24563f');
    }
    p.ln(-ov, wd + ov, z0, w + ov, wd + ov, z0, mix(OUT, '#2f5a4a', 0.4));
    p.ln(r0, wd / 2, zr, w - r0, wd / 2, zr, '#6fb08f');
    p.ln(-ov, wd + ov, z0, r0, wd / 2, zr, '#2f5a4a');
    p.ln(w + ov, wd + ov, z0, w - r0, wd / 2, zr, '#24563f');
    // chimney
    p.box(w - 2.6, 0.9, 0.55, 0.55, 64, 26, '#b5654a');
    p.box(w - 2.65, 0.85, 0.65, 0.65, 90, 3, '#8a4a36');
    // climbing vines on the left corner
    for (let i = 0; i < 6; i++) flowerClump(p, 0.15 + (i % 2) * 0.25, wd - 0.05, 8 + i * 6, 4, FLOWER_SETS.pink, i + 40, '#3e8a4a');
  },
  anim(p, k) {
    const wd = k.d - 0.7;
    const m = k.w / 2;
    p.c.globalAlpha = 0.25 + Math.sin(k.t * 2) * 0.05;
    for (const a of [m - 0.69, m + 0.71]) {
      const [x, y] = p.P(a, wd + 0.05, 29);
      disc(p.c, x, y, 6, '#ffd98a', 1);
    }
    p.c.globalAlpha = 1;
    // smoke from the chimney
    for (let i = 0; i < 4; i++) {
      const s = (k.t * 0.5 + i * 0.25) % 1;
      const [x, y] = p.P(k.w - 2.35, 1.1, 95 + s * 26);
      p.c.globalAlpha = 0.35 * (1 - s);
      disc(p.c, x + Math.sin(s * 6 + i) * 3, y, 2 + s * 3, '#e8e1d8', 1);
    }
    p.c.globalAlpha = 1;
  },
};

const greenhouse2: PropArt = {
  draw(p, k) {
    const w = k.w;
    const d = k.d;
    const frame = '#7a4e33';
    p.shadow();
    p.box(0, 0, w, d, 0, 8, '#b5654a');
    for (let z = 2; z < 8; z += 3) p.face(0, w, d, z, z + 1, '#9a4f3a');
    p.top(0.1, 0.1, w - 0.1, d - 0.1, 8, '#6f5a48');
    // shelves and plants inside
    p.box(0.25, 0.3, w - 0.5, 0.4, 8, 8, WOOD);
    for (let i = 0; i < w * 2; i++) {
      p.box(0.35 + i * 0.48, 0.38, 0.2, 0.2, 16, 4, '#c0603f');
      foliage(p, 0.45 + i * 0.48, 0.48, 24, 3, i % 2 ? '#5fb04f' : '#7bc35a', i);
    }
    for (let i = 0; i < 3; i++) foliage(p, 0.8 + i * 1.1, d - 0.8, 16, 5, ['#4f9a55', '#5fae5a', '#3e8a4a'][i], i + 20);
    // glass walls
    p.c.globalAlpha = 0.32;
    p.face(0, w, d, 8, 36, '#d6f2fb');
    p.side(w, 0, d, 8, 36, '#bfe3f2');
    p.c.globalAlpha = 1;
    // frame
    for (let a = 0; a <= w + 0.01; a += w / 4) p.ln(a, d, 8, a, d, 36, frame);
    for (let b = 0; b <= d + 0.01; b += d / 3) p.ln(w, b, 8, w, b, 36, darken(frame, 0.15));
    p.ln(0, d, 36, w, d, 36, frame);
    p.ln(w, 0, 36, w, d, 36, frame);
    p.ln(0, d, 22, w, d, 22, frame);
    p.ln(w, 0, 22, w, d, 22, darken(frame, 0.15));
    // pitched glass roof along a
    p.c.globalAlpha = 0.4;
    poly3(p, [[0, d, 36], [w, d, 36], [w, d / 2, 54], [0, d / 2, 54]], '#e6f8ff');
    poly3(p, [[w, 0, 36], [w, d, 36], [w, d / 2, 54]], '#cdeefa');
    p.c.globalAlpha = 1;
    for (let a = 0; a <= w + 0.01; a += w / 4) p.ln(a, d, 36, a, d / 2, 54, frame);
    p.ln(0, d / 2, 54, w, d / 2, 54, frame);
    p.ln(w, d, 36, w, d / 2, 54, frame);
    p.ln(w, 0, 36, w, d / 2, 54, frame);
    // reflections
    p.ln(0.3, d, 30, 0.6, d, 24, withAlpha('#ffffff', 0.8));
    p.ln(w, 0.4, 30, w, 0.7, 24, withAlpha('#ffffff', 0.6));
    // door + little red sign
    p.face(w / 2 - 0.4, w / 2 + 0.4, d + 0.01, 8, 30, frame);
    p.c.globalAlpha = 0.4;
    p.face(w / 2 - 0.32, w / 2 + 0.32, d + 0.01, 9, 29, '#e6f8ff');
    p.c.globalAlpha = 1;
    p.face(w / 2 - 0.35, w / 2 + 0.35, d + 0.02, 31, 35, '#c0533f');
    p.face(w / 2 - 0.25, w / 2 + 0.25, d + 0.02, 32.5, 33.5, '#fbf4e4');
  },
};

const pergola: PropArt = {
  draw(p, k) {
    const w = k.w;
    const d = k.d;
    const post = '#7a4e33';
    for (const [a, b] of [[0.05, 0.05], [w - 0.2, 0.05]]) p.box(a, b, 0.15, 0.15, 0, 38, post);
    p.box(0, 0, w, 0.15, 38, 4, WOOD_L);
    for (let a = 0.2; a < w; a += 0.45) p.box(a, 0, 0.1, d, 42, 2, WOOD);
  },
  anim(p, k) {
    // front posts, beam, vines and string lights over everything that sits inside
    const w = k.w;
    const d = k.d;
    const post = '#7a4e33';
    for (const [a, b] of [[0.05, d - 0.2], [w - 0.2, d - 0.2]]) p.box(a, b, 0.15, 0.15, 0, 38, post);
    p.box(0, d - 0.18, w, 0.15, 38, 4, WOOD_L);
    for (let i = 0; i < 5; i++) flowerClump(p, 0.1 + (i % 2) * 0.1, d - 0.12, 10 + i * 6, 3, FLOWER_SETS.purple, i + 60, '#3e8a4a');
    for (let i = 0; i < w * 2; i++) flowerClump(p, 0.3 + i * 0.5, d - 0.1, 40 - (i % 2) * 2, 3, FLOWER_SETS.white, i + 70, '#4f9a55');
    for (let i = 0; i <= w * 4; i++) {
      const a = (i / (w * 4)) * w;
      const sag = Math.sin((a / w) * Math.PI) * 5;
      const [x, y] = p.P(a, d - 0.1, 36 - sag);
      const on = Math.sin(k.t * 2 + i) > -0.6;
      rect(p.c, x, y, 1, 2, on ? '#ffe08a' : '#a8884a');
      if (on) {
        p.c.globalAlpha = 0.18;
        disc(p.c, x, y + 1, 3, '#ffd98a', 1);
        p.c.globalAlpha = 1;
      }
    }
  },
};

const raisedBed: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0, k.w, k.d, 0, 8, WOOD);
    for (let z = 2.5; z < 8; z += 2.7) {
      p.face(0, k.w, k.d, z, z + 0.6, WOOD_D);
      p.side(k.w, 0, k.d, z, z + 0.6, WOOD_D);
    }
    p.top(0.08, 0.08, k.w - 0.08, k.d - 0.08, 8, '#5c3d28');
    const v = k.variant ?? 'mixed';
    const n = Math.max(2, Math.round(k.w * 2));
    for (let j = 0; j < Math.max(1, Math.round(k.d * 1.5)); j++)
      for (let i = 0; i < n; i++) {
        const a = (k.w * (i + 0.5)) / n;
        const b = (k.d * (j + 0.5)) / Math.max(1, Math.round(k.d * 1.5));
        const seed = i * 7 + j + k.seed;
        if (v === 'lettuce') {
          const [x, y] = p.P(a, b, 9);
          disc(p.c, x, y - 2, 4, '#3e7a3b');
          disc(p.c, x, y - 3, 3, '#8fd06a');
          disc(p.c, x - 1, y - 4, 1, '#c4ef9a');
        } else if (v === 'herbs') foliage(p, a, b, 13, 3, i % 2 ? '#5f8f4a' : '#7fa86a', seed);
        else if (v === 'cabbage') {
          const [x, y] = p.P(a, b, 9);
          disc(p.c, x, y - 2, 4, '#4f7f8a');
          disc(p.c, x, y - 3, 3, '#8fb8a8');
        } else flowerClump(p, a, b, 13, 3, FLOWER_SETS[v] ?? FLOWER_SETS.mixed, seed);
      }
  },
};

const sunflowers: PropArt = {
  draw(p, k) {
    for (let i = 0; i < 3; i++) {
      const a = 0.25 + (i % 2) * 0.45 + hash(i, k.seed) * 0.1;
      const b = 0.3 + i * 0.2;
      const h = 30 + i * 4 + Math.floor(hash(k.seed, i) * 6);
      p.ln(a, b, 0, a, b, h, '#4f8a3c');
      p.ln(a + 0.02, b, 0, a + 0.02, b, h, '#3e7a3b');
      const [lx, ly] = p.P(a, b, h * 0.5);
      rect(p.c, lx - 4, ly, 4, 2, '#5f9a45');
      rect(p.c, lx + 1, ly - 4, 4, 2, '#5f9a45');
      const [x, y] = p.P(a, b, h);
      disc(p.c, x, y, 5, '#b8862a', 1);
      disc(p.c, x, y, 4, '#f2c43b', 1);
      disc(p.c, x, y, 2, '#6b4426', 1);
      rect(p.c, x - 1, y - 1, 1, 1, '#8a5a32');
    }
  },
};

const lanternPost: PropArt = {
  draw(p) {
    p.box(0.42, 0.42, 0.16, 0.16, 0, 4, '#5a6378');
    p.box(0.46, 0.46, 0.08, 0.08, 4, 28, '#2b2236', false);
    p.box(0.36, 0.36, 0.28, 0.28, 32, 9, '#2b2236');
    p.face(0.4, 0.6, 0.64, 33, 40, '#ffd98a');
    p.side(0.64, 0.4, 0.6, 33, 40, '#f2b84b');
    p.box(0.33, 0.33, 0.34, 0.34, 41, 2, '#3a3f5a');
  },
  anim(p, k) {
    const [x, y] = p.P(0.5, 0.5, 37);
    p.c.globalAlpha = 0.22 + Math.sin(k.t * 3 + k.seed) * 0.04;
    disc(p.c, x, y, 9, '#ffd98a', 1);
    p.c.globalAlpha = 1;
  },
};

const stoneWall: PropArt = {
  draw(p, k) {
    const base = k.color ?? '#a59a8a';
    p.shadow(0, 0.3, k.w, 0.5);
    p.box(0, 0.3, k.w, 0.45, 0, 10, base);
    stoneFace(p, 0, k.w, 0.75, 0, 10, base, k.seed);
    p.top(0, 0.3, k.w, 0.75, 10, lighten(base, 0.12));
    for (let i = 0; i < k.w * 3; i++) {
      if (hash(i, k.seed) < 0.45) continue;
      const [x, y] = p.P((i + 0.5) / 3, 0.5, 11);
      rect(p.c, x - 1, y - 1, 3, 2, '#6f8f45');
      if (k.variant === 'flowers' && hash(k.seed, i) > 0.5) rect(p.c, x, y - 2, 1, 1, '#ef9ac0');
    }
  },
};

const hedgeRow: PropArt = {
  draw(p, k) {
    const set = FLOWER_SETS[k.variant ?? 'mixed'] ?? FLOWER_SETS.mixed;
    p.shadow();
    const n = Math.max(1, Math.round(k.w * 1.6));
    for (let i = 0; i < n; i++) {
      const a = (k.w * (i + 0.5)) / n;
      foliage(p, a, 0.5, 9, 8, i % 3 === 0 ? '#3e7a3b' : '#4a8a42', i + k.seed);
    }
    for (let i = 0; i < n; i++) {
      const a = (k.w * (i + 0.5)) / n;
      const [x, y] = p.P(a, 0.5, 9);
      for (let j = 0; j < 5; j++) {
        if (hash(i, j, k.seed) < 0.45) continue;
        const col = set[Math.floor(hash(j, i, k.seed + 1) * set.length)];
        rect(p.c, x + (hash(i, j, 3) - 0.5) * 12, y + (hash(j, i, 4) - 0.7) * 8, 2, 2, col);
      }
    }
  },
};

const birdbath: PropArt = {
  draw(p) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.3, 0.3, 0.4, 0.4, 0, 3, '#b5ab9c');
    p.box(0.42, 0.42, 0.16, 0.16, 3, 12, '#c4baa9');
    p.box(0.18, 0.18, 0.64, 0.64, 15, 4, '#d2c8b6');
    p.top(0.26, 0.26, 0.74, 0.74, 19, '#6aaee0');
    p.dot(0.4, 0.4, 19, '#d8eefc', 2, 1);
  },
};

const wateringCan: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#5f8f7a';
    p.box(0.35, 0.4, 0.3, 0.22, 0, 6, col);
    p.ln(0.65, 0.5, 3, 0.85, 0.5, 8, darken(col, 0.2));
    p.ln(0.4, 0.5, 6, 0.55, 0.5, 9, darken(col, 0.3));
    p.ln(0.55, 0.5, 9, 0.6, 0.5, 6, darken(col, 0.3));
  },
};

const wheelbarrow: PropArt = {
  draw(p) {
    p.shadow(0.1, 0.2, 0.9, 0.6);
    p.box(0.15, 0.25, 0.6, 0.5, 6, 6, '#5f8f7a');
    p.top(0.2, 0.3, 0.7, 0.7, 12, '#7a5236');
    foliage(p, 0.45, 0.5, 13, 3, '#7bc35a', 3);
    const [x, y] = p.P(0.85, 0.5, 4);
    disc(p.c, x, y, 3, OUT, 1);
    disc(p.c, x, y, 2, '#5a6378', 1);
    p.ln(0.15, 0.3, 8, -0.1, 0.3, 10, WOOD_D);
    p.ln(0.15, 0.7, 8, -0.1, 0.7, 10, WOOD_D);
  },
};

const bicycle: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#c0392b';
    const [x0, y0] = p.P(0.2, 0.5, 5);
    const [x1, y1] = p.P(0.85, 0.5, 5);
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      disc(p.c, x, y, 5, '#2b2236', 1);
      rect(p.c, x - 4, y - 1, 9, 1, '#3a3f5a');
      disc(p.c, x, y, 3, '#cfd5dc', 1);
      disc(p.c, x, y, 2, '#2b2236', 1);
    }
    p.ln(0.2, 0.5, 5, 0.5, 0.5, 11, col);
    p.ln(0.5, 0.5, 11, 0.85, 0.5, 5, col);
    p.ln(0.4, 0.5, 5, 0.5, 0.5, 11, col);
    p.ln(0.4, 0.5, 5, 0.85, 0.5, 5, col);
    p.ln(0.5, 0.5, 11, 0.45, 0.5, 14, '#3a3f5a');
    p.ln(0.8, 0.5, 8, 0.78, 0.5, 15, col);
    p.box(0.72, 0.42, 0.14, 0.16, 15, 1, '#2b2236', false);
    p.box(0.4, 0.45, 0.12, 0.1, 14, 1, '#2b2236', false);
    p.box(0.85, 0.38, 0.2, 0.24, 9, 4, '#a8734c');
  },
};

const gnome: PropArt = {
  draw(p) {
    const [x, y] = p.P(0.5, 0.5, 0);
    p.c.globalAlpha = 0.25;
    rect(p.c, x - 3, y, 7, 1, '#1c1228');
    p.c.globalAlpha = 1;
    rect(p.c, x - 3, y - 6, 6, 6, OUT);
    rect(p.c, x - 2, y - 5, 4, 5, '#3f6fb5');
    rect(p.c, x - 2, y - 8, 4, 3, '#f6d2b0');
    rect(p.c, x - 2, y - 6, 4, 2, '#fbf4e4');
    rect(p.c, x - 2, y - 12, 4, 4, '#e2553b');
    rect(p.c, x - 1, y - 14, 2, 2, '#e2553b');
    rect(p.c, x - 3, y - 9, 6, 1, '#c0392b');
  },
};

const firewood: PropArt = {
  draw(p) {
    p.shadow(0, 0.2, 1, 0.6);
    for (let r = 0; r < 3; r++)
      for (let i = 0; i < 3 - r; i++) {
        const [x, y] = p.P(0.25 + i * 0.25 + r * 0.12, 0.7, 3 + r * 5);
        disc(p.c, x, y, 3, '#5e3c28', 1);
        disc(p.c, x, y, 2, '#c49a6c', 1);
        rect(p.c, x, y, 1, 1, '#8a5a3c');
      }
  },
};

const coop: PropArt = {
  draw(p, k) {
    p.shadow();
    for (const [a, b] of [[0.2, 0.2], [k.w - 0.3, 0.2], [0.2, k.d - 0.3], [k.w - 0.3, k.d - 0.3]]) p.box(a, b, 0.1, 0.1, 0, 10, WOOD_D);
    p.box(0.1, 0.1, k.w - 0.2, k.d - 0.4, 10, 18, '#c49a6c');
    for (let a = 0.3; a < k.w - 0.2; a += 0.25) p.face(a, a + 0.02, k.d - 0.3, 10, 28, '#a8734c');
    p.face(k.w / 2 - 0.25, k.w / 2 + 0.25, k.d - 0.3, 11, 22, '#3a2b22');
    poly3(p, [[-0.05, k.d - 0.15, 28], [k.w + 0.05, k.d - 0.15, 28], [k.w + 0.05, k.d / 2 - 0.2, 40], [-0.05, k.d / 2 - 0.2, 40]], '#c0533f');
    poly3(p, [[k.w + 0.05, 0, 28], [k.w + 0.05, k.d - 0.15, 28], [k.w + 0.05, k.d / 2 - 0.2, 40]], '#8f3a2c');
    for (let i = 1; i < 4; i++) p.ln(-0.05, k.d - 0.15 - ((k.d / 2 + 0.05) * i) / 4, 28 + i * 3, k.w + 0.05, k.d - 0.15 - ((k.d / 2 + 0.05) * i) / 4, 28 + i * 3, '#a8442f');
    // ramp
    poly3(p, [[k.w / 2 - 0.2, k.d - 0.3, 10], [k.w / 2 + 0.2, k.d - 0.3, 10], [k.w / 2 + 0.2, k.d + 0.4, 0], [k.w / 2 - 0.2, k.d + 0.4, 0]], WOOD_L);
    // straw
    for (let i = 0; i < 6; i++) p.dot(0.3 + i * 0.25, k.d - 0.2, 1, '#e8c574', 2, 1);
  },
};

const beehive: PropArt = {
  draw(p) {
    p.shadow(0.15, 0.15, 0.7, 0.7);
    p.box(0.2, 0.2, 0.6, 0.6, 0, 4, WOOD_D);
    p.box(0.22, 0.22, 0.56, 0.56, 4, 8, '#f4f1ea');
    p.box(0.22, 0.22, 0.56, 0.56, 12, 8, '#f2d06b');
    p.box(0.16, 0.16, 0.68, 0.68, 20, 3, '#c49a6c');
    p.face(0.4, 0.6, 0.78, 5, 6, OUT);
  },
  anim(p, k) {
    for (let i = 0; i < 3; i++) {
      const a = k.t * 2 + i * 2.1;
      const [x, y] = p.P(0.5 + Math.cos(a) * 0.5, 0.6 + Math.sin(a * 1.3) * 0.4, 14 + Math.sin(a * 2) * 6);
      rect(p.c, x, y, 1, 1, '#2b2236');
    }
  },
};

const scarecrow: PropArt = {
  draw(p) {
    p.ln(0.5, 0.5, 0, 0.5, 0.5, 34, WOOD_D);
    p.ln(0.15, 0.5, 26, 0.85, 0.5, 26, WOOD_D);
    p.box(0.35, 0.42, 0.3, 0.16, 16, 12, '#c0533f');
    p.face(0.35, 0.65, 0.58, 21, 22, '#8f3a2c');
    const [x, y] = p.P(0.5, 0.5, 33);
    disc(p.c, x, y, 4, '#e8c574', 1);
    rect(p.c, x - 7, y - 4, 14, 2, '#c9a24a');
    rect(p.c, x - 4, y - 8, 8, 4, '#c9a24a');
    rect(p.c, x - 2, y - 1, 1, 1, OUT);
    rect(p.c, x + 1, y - 1, 1, 1, OUT);
  },
};

const fruitTree: PropArt = {
  draw(p, k) {
    p.shadow(-0.2, -0.1, 1.4, 1.2);
    p.box(0.4, 0.4, 0.2, 0.2, 0, 24, '#7a5236');
    p.ln(0.5, 0.5, 18, 0.3, 0.5, 26, '#7a5236');
    p.ln(0.5, 0.5, 20, 0.7, 0.4, 28, '#7a5236');
    foliage(p, 0.5, 0.5, 34, 13, k.variant === 'dark' ? '#3e7a3b' : '#4f9a55', k.seed);
    foliage(p, 0.35, 0.6, 44, 9, '#5fae5a', k.seed + 1);
    foliage(p, 0.65, 0.35, 46, 8, '#5fae5a', k.seed + 2);
    const fruit = k.variant === 'pear' ? '#d9c84a' : k.variant === 'orange' ? '#f08a3a' : '#d8432f';
    for (let i = 0; i < 9; i++) {
      const [x, y] = p.P(0.5, 0.5, 38);
      const fx = x + (hash(i, k.seed, 6) - 0.5) * 22;
      const fy = y + (hash(k.seed, i, 7) - 0.5) * 18;
      rect(p.c, fx, fy, 2, 2, fruit);
      rect(p.c, fx, fy, 1, 1, lighten(fruit, 0.4));
    }
  },
};

const pots: PropArt = {
  draw(p, k) {
    const set = FLOWER_SETS[k.variant ?? 'mixed'] ?? FLOWER_SETS.mixed;
    const spots: [number, number, number][] = [[0.3, 0.3, 0.32], [0.7, 0.4, 0.26], [0.4, 0.72, 0.22]];
    spots.forEach(([a, b, s], i) => {
      p.box(a - s / 2, b - s / 2, s, s, 0, 6 + s * 10, '#c0603f');
      p.face(a - s / 2, a + s / 2, b + s / 2, 4 + s * 10, 6 + s * 10, '#d77a52');
      if (i === 1) foliage(p, a, b, 12 + s * 10, 3, '#4f9a55', k.seed + i);
      else flowerClump(p, a, b, 10 + s * 10, 3, set, k.seed + i);
    });
  },
};

const fenceRow: PropArt = {
  draw(p, k) {
    const col = k.color ?? '#a6714a';
    for (let a = 0; a <= k.w + 0.01; a += 0.5) p.box(Math.min(a, k.w - 0.1), 0.45, 0.1, 0.1, 0, 14, darken(col, 0.1));
    p.box(0, 0.47, k.w, 0.06, 5, 2, col, false);
    p.box(0, 0.47, k.w, 0.06, 10, 2, col, false);
    p.ln(0, 0.53, 12, k.w, 0.53, 12, lighten(col, 0.2));
  },
};

const well: PropArt = {
  draw(p) {
    p.shadow(0, 0, 1, 1);
    p.box(0.1, 0.1, 0.8, 0.8, 0, 12, '#a59a8a');
    stoneFace(p, 0.1, 0.9, 0.9, 0, 12, '#a59a8a', 9);
    p.top(0.22, 0.22, 0.78, 0.78, 12, '#2b4a6a');
    p.box(0.12, 0.45, 0.08, 0.1, 12, 22, WOOD_D);
    p.box(0.8, 0.45, 0.08, 0.1, 12, 22, WOOD_D);
    poly3(p, [[0, 0.5, 32], [1, 0.5, 32], [1, 0.95, 26], [0, 0.95, 26]], '#c0533f');
    poly3(p, [[0, 0.05, 26], [1, 0.05, 26], [1, 0.5, 32], [0, 0.5, 32]], '#8f3a2c');
    p.ln(0.5, 0.5, 30, 0.5, 0.5, 18, OUT);
    p.box(0.42, 0.42, 0.16, 0.16, 14, 4, WOOD);
  },
};

const haystack: PropArt = {
  draw(p) {
    p.shadow(0, 0, 1, 1);
    const [x, y] = p.P(0.5, 0.5, 0);
    for (let i = 0; i < 4; i++) {
      disc(p.c, x, y - 4 - i * 4, 11 - i * 2.4, darken('#e8c574', 0.35 - i * 0.05), 0.6);
      disc(p.c, x, y - 5 - i * 4, 10 - i * 2.4, i % 2 ? '#e8c574' : '#dcb860', 0.6);
    }
    for (let i = 0; i < 10; i++) rect(p.c, x - 8 + hash(i, 1) * 16, y - 4 - hash(1, i) * 14, 2, 1, '#c9a24a');
  },
};

const signpost: PropArt = {
  draw(p, k) {
    p.ln(0.5, 0.5, 0, 0.5, 0.5, 26, WOOD_D);
    p.box(0.1, 0.45, 0.8, 0.1, 18, 7, WOOD_L);
    p.face(0.2, 0.75, 0.55, 20.5, 21.5, '#5e3c28');
    p.face(0.2, 0.6, 0.55, 22.5, 23.5, '#5e3c28');
    void k;
  },
};

const compost: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.1, 0.15, 0.8, 0.7, 0, 12, WOOD);
    for (let z = 2; z < 12; z += 3) p.face(0.1, 0.9, 0.85, z, z + 1, WOOD_D);
    p.top(0.15, 0.2, 0.85, 0.8, 12, '#4f3322');
    foliage(p, 0.5, 0.5, 14, 3, '#7a8a3a', 5);
  },
};

export const FARM_ART: Record<string, PropArt> = {
  farmhouse,
  greenhouse2,
  pergola,
  raisedBed,
  sunflowers,
  lanternPost,
  stoneWall,
  hedgeRow,
  birdbath,
  wateringCan,
  wheelbarrow,
  bicycle,
  gnome,
  firewood,
  coop,
  beehive,
  scarecrow,
  fruitTree,
  pots,
  fenceRow,
  well,
  haystack,
  signpost,
  compost,
};


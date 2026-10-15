// ─────────────────────────────────────────────────────────────
// Isometric prop art. Each prop has a static drawer (cached into a
// sprite once) and an optional animated overlay drawn every frame.
// All coordinates are prop-local (a = width, b = depth, b = d is the front).
// ─────────────────────────────────────────────────────────────

import type { WorldTheme } from '../domain/world';
import { darken, lighten, mix } from './color';
import { OUT, poly, type PropPainter, rect, type C } from './iso';

export interface PropCtx {
  w: number;
  d: number;
  variant?: string;
  color?: string;
  th: WorldTheme;
  t: number;
  seed: number;
}

/** A light a prop gives at night, in its local coordinates (a along its width, b along its depth, z up). */
export interface PropLight {
  a: number;
  b: number;
  z: number;
  /** radius of its pool of light on the ground, in tiles */
  r: number;
  /** '#rrggbb', warm white by default */
  color?: string;
  kind?: 'lamp' | 'window';
}

export interface PropArt {
  draw: (p: PropPainter, k: PropCtx) => void;
  anim?: (p: PropPainter, k: PropCtx) => void;
  /** where it gives light at night (src/render/night.ts) */
  lights?: (k: PropCtx) => PropLight[];
  /** spans over the ground (a bridge): anything moving under its footprint passes beneath it */
  overhead?: boolean;
  /** fully animated (no cache) */
  live?: boolean;
  /** apply the automatic selective outline to the cached sprite (HD art) */
  outline?: boolean;
}

const WOOD = '#9a6a45';
const WOOD_D = '#6f4a30';
const METAL = '#9aa4b8';
const DARK = '#3a3f5a';
const SCREEN = '#141a2e';

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const blink = (t: number, rate: number, seed = 0) => Math.sin(t * rate + seed * 12.9898) > 0;

export function disc(c: C, cx: number, cy: number, r: number, col: string, squash = 0.85) {
  c.fillStyle = col;
  const ry = Math.max(1, Math.round(r * squash));
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.floor(r * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
export function blob(c: C, cx: number, cy: number, r: number, col: string) {
  disc(c, cx, cy, r + 1, OUT);
  disc(c, cx, cy, r, col);
}

/** Leafy clump: outline, body, highlight. */
export function foliage(p: PropPainter, a: number, b: number, z: number, r: number, base: string, seed = 0) {
  const [x, y] = p.P(a, b, z);
  const offs = [
    [0, 0, r],
    [-r * 0.6, r * 0.25, r * 0.7],
    [r * 0.6, r * 0.2, r * 0.7],
    [0, -r * 0.5, r * 0.75],
  ];
  const edge = mix(darken(base, 0.55), OUT, 0.35);
  for (const [dx, dy, rr] of offs) disc(p.c, x + dx, y + dy, rr + 1, edge);
  for (const [dx, dy, rr] of offs) disc(p.c, x + dx, y + dy + 1, rr, darken(base, 0.18));
  for (const [dx, dy, rr] of offs) disc(p.c, x + dx, y + dy - 1, rr - 1, base);
  disc(p.c, x - r * 0.3, y - r * 0.5, r * 0.42, lighten(base, 0.2));
  disc(p.c, x - r * 0.4, y - r * 0.6, r * 0.18, lighten(base, 0.36));
  for (let i = 0; i < r * 2; i++) {
    const lx = x + (hash(i, seed) - 0.5) * r * 1.7;
    const ly = y + (hash(seed, i) - 0.45) * r * 1.2;
    rect(p.c, lx, ly, 1, 1, darken(base, 0.3));
    rect(p.c, lx + 1, ly - 1, 1, 1, lighten(base, 0.15));
  }
}

function screenLines(p: PropPainter, a0: number, a1: number, b: number, z0: number, z1: number, t: number, cols: string[], seed: number) {
  const rows = Math.max(1, Math.floor((z1 - z0 - 2) / 2));
  for (let i = 0; i < rows; i++) {
    const len = 0.25 + ((Math.sin(t * 1.7 + i * 2.1 + seed) + 1) / 2) * (a1 - a0 - 0.3);
    p.ln(a0 + 0.06, b, z1 - 2 - i * 2, a0 + 0.06 + len, b, z1 - 2 - i * 2, cols[i % cols.length]);
  }
}

function monitor(p: PropPainter, a: number, b: number, w: number, z: number, h: number) {
  p.box(a + w / 2 - 0.05, b + 0.02, 0.1, 0.06, z, 4, '#5a6378', false);
  p.box(a, b, w, 0.08, z + 3, h, '#2f3346');
  p.face(a + 0.05, a + w - 0.05, b + 0.08, z + 5, z + h + 1, SCREEN);
}

// ── furniture ────────────────────────────────────────────────

const desk: PropArt = {
  draw(p, k) {
    p.shadow();
    const top = k.variant === 'scope' ? '#8a9bb0' : WOOD;
    p.box(0.08, 0.2, 0.12, 0.7, 0, 15, WOOD_D);
    p.box(k.w - 0.2, 0.2, 0.12, 0.7, 0, 15, WOOD_D);
    p.box(0.08, 0.2, k.w - 0.16, 0.1, 4, 10, darken(top, 0.25), false);
    p.box(0, 0.12, k.w, 0.86, 15, 3, top);
    const v = k.variant ?? 'single';
    if (v === 'dual' || v === 'edit') {
      monitor(p, 0.2, 0.22, 0.7, 18, 11);
      monitor(p, 1.1, 0.22, 0.7, 18, 11);
    } else if (v === 'laptop') {
      p.box(0.65, 0.5, 0.7, 0.32, 18, 1, '#c9ccd6');
      p.box(0.65, 0.45, 0.7, 0.06, 19, 9, '#c9ccd6');
      p.face(0.7, 1.3, 0.51, 20, 27, SCREEN);
    } else if (v === 'tablet') {
      p.box(0.5, 0.45, 0.9, 0.4, 18, 1, '#2b2236');
      p.top(0.58, 0.5, 1.32, 0.8, 19, '#3a3f5a');
      p.box(1.6, 0.25, 0.1, 0.1, 18, 14, '#5a6378', false);
      p.box(1.45, 0.25, 0.3, 0.25, 30, 4, '#f2b84b');
    } else if (v === 'books') {
      monitor(p, 0.9, 0.22, 0.8, 18, 11);
      for (let i = 0; i < 4; i++) p.box(0.15, 0.35, 0.5, 0.35, 18 + i * 2, 2, ['#c0533f', '#5b8def', '#f2b84b', '#3fb68b'][i]);
    } else if (v === 'scope') {
      p.box(0.15, 0.25, 0.8, 0.45, 18, 10, '#d7dce6');
      p.face(0.22, 0.88, 0.7, 20, 26, '#0e2a1a');
      p.box(1.2, 0.4, 0.6, 0.35, 18, 3, '#3f8a5a');
      for (let i = 0; i < 4; i++) p.dot(1.3 + i * 0.12, 0.55, 22, '#f2b84b');
    } else if (v === 'dispatch') {
      monitor(p, 0.9, 0.22, 0.8, 18, 11);
      p.top(0.15, 0.4, 0.75, 0.85, 18, '#fbfbf7');
      p.box(0.25, 0.3, 0.3, 0.2, 18, 3, DARK);
    } else monitor(p, 0.6, 0.22, 0.8, 18, 11);
    if (v !== 'tablet' && v !== 'scope' && v !== 'laptop') p.top(0.6, 0.6, 1.3, 0.8, 18, '#e4e1da');
    p.box(k.w - 0.3, 0.6, 0.12, 0.12, 18, 3, '#fbfbf7', false);
  },
  anim(p, k) {
    const v = k.variant ?? 'single';
    const cols = ['#5fd38d', '#6aa9ff', '#f2b84b', '#ef7aa8'];
    if (v === 'dual' || v === 'edit') {
      screenLines(p, 0.25, 0.85, 0.3, 21, 29, k.t, cols, k.seed);
      if (v === 'edit') p.ln(1.15, 0.3, 23, 1.15 + ((k.t * 0.3) % 0.55), 0.3, 23, '#ef7aa8');
      else screenLines(p, 1.15, 1.75, 0.3, 21, 29, k.t, cols, k.seed + 3);
    } else if (v === 'laptop') screenLines(p, 0.7, 1.25, 0.51, 21, 27, k.t, cols, k.seed);
    else if (v === 'scope') {
      for (let i = 0; i < 9; i++) p.dot(0.26 + i * 0.07, 0.7, 23 + Math.round(Math.sin(k.t * 5 + i) * 2), '#59e08a');
    } else if (v !== 'tablet') screenLines(p, v === 'single' ? 0.65 : 0.95, v === 'single' ? 1.35 : 1.65, 0.3, 21, 29, k.t, cols, k.seed);
  },
};

const table: PropArt = {
  draw(p, k) {
    p.shadow();
    for (const [a, b] of [[0.2, 0.2], [k.w - 0.35, 0.2], [0.2, k.d - 0.35], [k.w - 0.35, k.d - 0.35]]) p.box(a, b, 0.15, 0.15, 0, 12, WOOD_D);
    p.box(0.05, 0.05, k.w - 0.1, k.d - 0.1, 12, 3, '#b07b52');
    p.box(0.4, 0.4, 0.6, 0.4, 15, 1, '#c9ccd6');
    p.box(0.4, 0.35, 0.6, 0.05, 16, 6, '#c9ccd6');
    p.top(1.3, 0.6, 1.8, 1.2, 15, '#fbfbf7');
    p.top(1.9, 0.3, 2.3, 0.7, 15, '#f2d06b');
    p.box(2.4, 1.2, 0.12, 0.12, 15, 3, '#fbfbf7', false);
    p.box(0.7, 1.4, 0.12, 0.12, 15, 3, '#e2553b', false);
  },
};

const coffeeTable: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0.15, k.w - 0.2, 0.7, 0, 7, '#8a5a3c');
    p.box(0.5, 0.35, 0.2, 0.2, 7, 4, '#c0603f');
    foliage(p, 0.6, 0.45, 13, 3, '#5fb04f', 3);
    p.top(1.0, 0.3, 1.5, 0.7, 7, '#5b8def');
  },
};

const cafeTable: PropArt = {
  draw(p) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.45, 0.45, 0.1, 0.1, 0, 12, DARK, false);
    p.box(0.15, 0.15, 0.7, 0.7, 12, 2, '#f4f1ea');
    p.box(0.3, 0.3, 0.12, 0.12, 14, 3, '#e2553b', false);
    p.box(0.6, 0.55, 0.12, 0.12, 14, 3, '#5b8def', false);
  },
};

const counter: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.1, k.w, 0.9, 0, 18, '#8a6a4f');
    p.face(0.1, k.w / 2 - 0.05, 1.0, 3, 15, darken('#8a6a4f', 0.12));
    p.face(k.w / 2 + 0.05, k.w - 0.1, 1.0, 3, 15, darken('#8a6a4f', 0.12));
    p.box(0, 0.1, k.w, 0.9, 18, 2, '#e8e1d2');
    p.box(0.25, 0.25, 0.55, 0.45, 20, 13, DARK);
    p.face(0.35, 0.7, 0.7, 23, 29, '#5a6378');
    p.box(0.45, 0.55, 0.15, 0.15, 20, 3, '#fbfbf7', false);
    p.box(1.2, 0.5, 0.12, 0.12, 20, 3, '#fbfbf7', false);
    p.box(1.45, 0.4, 0.12, 0.12, 20, 3, '#ef9ac0', false);
  },
  anim(p, k) {
    p.dot(0.4, 0.7, 31, blink(k.t, 2, k.seed) ? '#5fd38d' : '#2f7a4c', 2, 1);
    const s = (k.t * 5 + k.seed) % 6;
    const [x, y] = p.P(0.52, 0.62, 26 + s * 1.5);
    rect(p.c, x + (s > 3 ? 1 : 0), y, 1, 1, 'rgba(255,255,255,0.7)');
  },
};

const watercooler: PropArt = {
  draw(p) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.25, 0.3, 0.5, 0.5, 0, 16, '#e4e7ec');
    p.box(0.3, 0.35, 0.4, 0.4, 16, 12, '#7fc2f0');
    p.dot(0.4, 0.8, 11, '#5b8def', 2, 2);
    p.dot(0.6, 0.8, 11, '#e2553b', 2, 2);
  },
};

const vending: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.08, 0.15, 0.84, 0.75, 0, 38, '#c0533f');
    p.face(0.14, 0.62, 0.9, 8, 34, SCREEN);
    const cols = ['#f2b84b', '#5fd38d', '#6aa9ff', '#ef7aa8'];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) p.dot(0.2 + i * 0.13, 0.9, 12 + j * 5, cols[(i + j) % 4], 2, 2);
    p.face(0.68, 0.86, 0.9, 20, 30, '#e8e1d2');
  },
  anim(p, k) {
    p.dot(0.72, 0.9, 32, blink(k.t, 1.3, k.seed) ? k.th.accent : '#5a6378', 2, 2);
  },
};

function seatArt(p: PropPainter, k: PropCtx, n: number) {
  const col = k.color ?? '#d0705a';
  p.shadow();
  p.box(0, 0.25, n, 0.75, 0, 7, darken(col, 0.1));
  p.box(0, 0.05, n, 0.3, 7, 12, darken(col, 0.18));
  p.box(0, 0.25, 0.25, 0.75, 7, 5, darken(col, 0.05));
  p.box(n - 0.25, 0.25, 0.25, 0.75, 7, 5, darken(col, 0.05));
  for (let i = 0; i < n; i++) p.box(i + 0.28 - (i > 0 ? 0.03 : 0), 0.35, n === 1 ? 0.44 : 0.94 - (i === 0 || i === n - 1 ? 0.25 : 0), 0.6, 7, 2, lighten(col, 0.12), false);
  if (n > 1) p.box(0.35, 0.18, 0.4, 0.15, 12, 7, '#f2d06b');
}

const sofa: PropArt = { draw: (p, k) => seatArt(p, k, k.w) };
const armchair: PropArt = { draw: (p, k) => seatArt(p, k, 1) };

const bench: PropArt = {
  draw(p, k) {
    p.shadow();
    for (let i = 0; i < k.w; i++) p.box(i + 0.15, 0.3, 0.12, 0.4, 0, 6, '#5a6378', false);
    p.box(k.w - 0.27, 0.3, 0.12, 0.4, 0, 6, '#5a6378', false);
    p.box(0.05, 0.2, k.w - 0.1, 0.6, 6, 2, k.color ?? '#b07b52');
    p.ln(0.05, 0.4, 8, k.w - 0.05, 0.4, 8, darken(k.color ?? '#b07b52', 0.2));
  },
};

const bookshelf: PropArt = {
  draw(p, k) {
    p.shadow();
    const v = k.variant;
    const frame = v === 'archive' ? '#6b4632' : '#8a5a3c';
    p.box(0, 0.35, k.w, 0.65, 0, 46, frame);
    p.face(0.08, k.w - 0.08, 1.0, 3, 43, darken(frame, 0.35));
    const cols = v === 'assets' ? ['#ef7aa8', '#5b8def', '#f2b84b', '#7bd36b', '#9b7bea'] : ['#c0533f', '#5b8def', '#f2b84b', '#3fb68b', '#9b7bea', '#e8e1d2'];
    for (let s = 0; s < 4; s++) {
      const z = 4 + s * 10;
      p.face(0.08, k.w - 0.08, 1.0, z - 1, z, frame);
      let a = 0.12;
      let i = 0;
      while (a < k.w - 0.2) {
        const bw = v === 'archive' ? 0.22 : v === 'assets' ? 0.3 : 0.1 + hash(i, s, k.seed) * 0.08;
        const bh = v === 'archive' ? 7 : v === 'assets' ? 6 : 5 + Math.floor(hash(s, i) * 3);
        p.face(a, Math.min(a + bw, k.w - 0.1), 1.0, z, z + bh, cols[(i + s * 3 + k.seed) % cols.length]);
        a += bw + 0.03;
        i++;
      }
    }
  },
};

const cabinet: PropArt = {
  draw(p, k) {
    p.shadow();
    const v = k.variant;
    const col = v === 'flammable' ? '#f3c843' : v === 'locker' ? '#6a7aa0' : METAL;
    p.box(0.1, 0.25, 0.8, 0.7, 0, 38, col);
    p.face(0.48, 0.52, 0.95, 2, 36, darken(col, 0.3));
    if (v === 'flammable') p.face(0.2, 0.8, 0.95, 18, 26, '#e2553b');
    else for (let i = 0; i < 4; i++) p.face(0.15, 0.42, 0.95, 28 + i * 2, 29 + i * 2, darken(col, 0.25));
  },
};

const crate: PropArt = {
  draw(p) {
    p.shadow(0.1, 0.1, 0.8, 0.8);
    p.box(0.12, 0.12, 0.76, 0.76, 0, 14, '#c08a55');
    p.face(0.15, 0.85, 0.88, 6, 7, '#8a5a32');
    p.side(0.88, 0.15, 0.85, 6, 7, '#7a4a2a');
  },
};

const barrel: PropArt = {
  draw(p, k) {
    p.shadow(0.15, 0.15, 0.7, 0.7);
    const col = k.variant === 'chem' ? '#f3c843' : k.color ?? '#3f6fb5';
    p.box(0.2, 0.2, 0.6, 0.6, 0, 18, col);
    p.face(0.2, 0.8, 0.8, 5, 6, darken(col, 0.25));
    p.face(0.2, 0.8, 0.8, 12, 13, darken(col, 0.25));
    p.side(0.8, 0.2, 0.8, 5, 6, darken(col, 0.4));
    p.side(0.8, 0.2, 0.8, 12, 13, darken(col, 0.4));
  },
};

const lamp: PropArt = {
  draw(p) {
    p.box(0.4, 0.4, 0.2, 0.2, 0, 2, DARK, false);
    p.ln(0.5, 0.5, 2, 0.5, 0.5, 30, DARK);
    p.box(0.3, 0.3, 0.4, 0.4, 30, 8, '#f2d06b');
  },
};

const printer: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.15, 0.25, 0.7, 0.6, 0, 14, '#d7dce6');
    p.top(0.25, 0.3, 0.75, 0.6, 14, '#fbfbf7');
    p.face(0.25, 0.75, 0.85, 4, 6, '#5a6378');
  },
};

const plant: PropArt = {
  draw(p, k) {
    p.shadow(0.25, 0.25, 0.5, 0.5);
    p.box(0.3, 0.3, 0.4, 0.4, 0, 9, '#c0603f');
    p.top(0.33, 0.33, 0.67, 0.67, 9, '#5a3a24');
    foliage(p, 0.5, 0.5, 18, 6, '#4f9a55', k.seed);
  },
};

const plantTall: PropArt = {
  draw(p, k) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.3, 0.3, 0.4, 0.4, 0, 10, '#e8e1d2');
    p.ln(0.5, 0.5, 10, 0.45, 0.5, 26, '#5a3a24');
    foliage(p, 0.5, 0.5, 24, 6, '#3e8a4a', k.seed);
    foliage(p, 0.45, 0.5, 34, 5, '#4f9a55', k.seed + 1);
  },
};

const tree: PropArt = {
  draw(p, k) {
    p.shadow(0, 0, 1, 1);
    p.box(0.4, 0.4, 0.2, 0.2, 0, 22, '#8a5a3c');
    foliage(p, 0.5, 0.5, 34, 11, '#4f9a55', k.seed);
    foliage(p, 0.5, 0.5, 48, 8, '#5fae5a', k.seed + 2);
    if (hash(k.seed, 1) > 0.5) {
      p.dot(0.3, 0.6, 32, '#e2553b', 2, 2);
      p.dot(0.7, 0.4, 40, '#e2553b', 2, 2);
    }
  },
};

const bush: PropArt = {
  draw(p, k) {
    foliage(p, 0.5, 0.5, 6, 6, '#4f9a55', k.seed);
    p.dot(0.4, 0.5, 9, '#f3c843', 1, 1);
    p.dot(0.6, 0.4, 7, '#ef7aa8', 1, 1);
  },
};

// ── industry ────────────────────────────────────────────────

const machine: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0.1, 1.8, 1.8, 0, 36, '#7d8aa3');
    p.box(0.3, 0.2, 1.4, 0.6, 36, 6, '#5a6378');
    p.face(0.25, 1.75, 1.9, 2, 5, k.th.accent);
    const v = k.variant;
    p.face(0.35, 1.65, 1.9, 9, 30, OUT);
    p.face(0.4, 1.6, 1.9, 10, 29, v === 'oven' ? '#7a3a1e' : '#1d2238');
  },
  anim(p, k) {
    const v = k.variant;
    if (v === 'press') {
      const z = 14 + Math.round((Math.sin(k.t * 3) + 1) * 5);
      p.face(0.8, 1.2, 1.9, z, 29, '#c9d0dc');
      p.face(0.55, 1.45, 1.9, z - 3, z, '#e2553b');
    } else if (v === 'cnc') {
      const a = 1.0 + Math.sin(k.t * 2) * 0.45;
      p.face(a - 0.05, a + 0.05, 1.9, 18, 29, '#c9d0dc');
      p.dot(a, 1.9, 17, blink(k.t, 18) ? '#f2b84b' : '#ffffff', 2, 1);
    } else {
      p.c.globalAlpha = 0.55 + Math.sin(k.t * 2) * 0.2;
      p.face(0.45, 1.55, 1.9, 11, 28, '#f07a2f');
      p.c.globalAlpha = 1;
      p.face(0.5, 1.5, 1.9, 18, 19, '#f2d06b');
    }
    p.dot(1.75, 1.9, 34, blink(k.t, 2.4, k.seed) ? '#5fd38d' : '#2f7a4c', 2, 2);
  },
};

const robotArm: PropArt = {
  draw(p, k) {
    for (let i = 0; i < 8; i++) p.top(i * 0.25, 1.85, i * 0.25 + 0.12, 2, 0, k.th.accent);
    p.box(0.55, 0.55, 0.9, 0.9, 0, 10, '#5a6378');
  },
  anim(p, k) {
    const base = p.P(1, 1, 10);
    const a1 = -1.6 + Math.sin(k.t * 0.9) * 0.7;
    const a2 = a1 + 1.3 + Math.sin(k.t * 1.3) * 0.5;
    const j1 = [base[0] + Math.cos(a1) * 14, base[1] + Math.sin(a1) * 14];
    const j2 = [j1[0] + Math.cos(a2) * 12, j1[1] + Math.sin(a2) * 12];
    const seg = (x0: number, y0: number, x1: number, y1: number, col: string) => {
      for (let i = 0; i <= 12; i++) {
        const x = x0 + ((x1 - x0) * i) / 12;
        const y = y0 + ((y1 - y0) * i) / 12;
        rect(p.c, x - 2, y - 2, 5, 5, OUT);
      }
      for (let i = 0; i <= 12; i++) {
        const x = x0 + ((x1 - x0) * i) / 12;
        const y = y0 + ((y1 - y0) * i) / 12;
        rect(p.c, x - 1, y - 1, 3, 3, col);
      }
    };
    seg(base[0], base[1], j1[0], j1[1], '#f2a03d');
    seg(j1[0], j1[1], j2[0], j2[1], '#f3c843');
    rect(p.c, j2[0] - 2, j2[1] - 1, 5, 4, DARK);
    rect(p.c, j1[0] - 1, j1[1] - 1, 3, 3, DARK);
  },
};

const conveyor: PropArt = {
  draw(p, k) {
    p.shadow();
    for (let i = 0; i < k.w; i++) p.box(i + 0.2, 0.3, 0.1, 0.4, 0, 8, DARK, false);
    p.box(0, 0.2, k.w, 0.6, 8, 4, '#5a6378');
    p.top(0.05, 0.28, k.w - 0.05, 0.72, 12, '#2f3346');
  },
  anim(p, k) {
    const off = (k.t * 0.8) % 0.4;
    for (let a = off; a < k.w - 0.05; a += 0.4) p.ln(a, 0.3, 12, a, 0.7, 12, '#4a5270');
    for (let n = 0; n < Math.ceil(k.w / 2.5); n++) {
      const a = ((k.t * 0.8 + n * 2.5) % (k.w - 0.5)) + 0.1;
      p.box(a, 0.33, 0.35, 0.34, 12, 6, '#c08a55');
    }
  },
};

const console_: PropArt = {
  draw(p, k) {
    p.shadow();
    const v = k.variant;
    const body = v === 'space' ? '#4b5578' : v === 'noc' ? '#3d4458' : v === 'ops' ? DARK : '#5a6378';
    p.box(0, 0.35, k.w, 0.65, 0, 14, body);
    p.box(0.1, 0.15, k.w * 0.45, 0.1, 14, 11, '#2f3346');
    p.box(k.w * 0.52, 0.15, k.w * 0.45, 0.1, 14, 11, '#2f3346');
    p.face(0.15, k.w * 0.53, 0.25, 15, 24, SCREEN);
    p.face(k.w * 0.56, k.w - 0.08, 0.25, 15, 24, SCREEN);
    p.top(0.1, 0.45, k.w - 0.1, 0.9, 14, lighten(body, 0.2));
  },
  anim(p, k) {
    const c1 = k.variant === 'noc' ? '#59e08a' : k.th.accent;
    const c2 = k.variant === 'noc' ? '#59e08a' : k.th.accent2;
    for (let i = 0; i < 9; i++) {
      p.dot(0.2 + i * 0.08, 0.25, 19 + Math.round(Math.sin(k.t * 3 + i * 0.8 + k.seed) * 2), c1);
      p.dot(k.w * 0.6 + i * 0.08, 0.25, 19 + Math.round(Math.cos(k.t * 2 + i * 0.7) * 2), c2);
    }
    for (let i = 0; i < 6; i++) p.dot(0.2 + i * 0.28, 0.65, 14, blink(k.t, 1 + i * 0.4, i + k.seed) ? c1 : '#5a6378', 2, 1);
  },
};

const rack: PropArt = {
  draw(p, k) {
    p.shadow();
    const v = k.variant ?? 'boxes';
    const up = v === 'pallets' ? '#f07a2f' : '#5a6378';
    for (let a = 0; a <= k.w; a += k.w / 2) p.box(Math.min(a, k.w - 0.12), 0.2, 0.12, 0.7, 0, 44, up, false);
    for (const z of [2, 16, 30]) p.box(0, 0.2, k.w, 0.7, z, 2, v === 'pallets' ? '#3f6fb5' : '#7d8394');
    for (const [li, z] of [[0, 4], [1, 18], [2, 32]] as const) {
      let a = 0.15;
      let i = 0;
      while (a < k.w - 0.4) {
        const w = 0.45 + hash(i, li, k.seed) * 0.25;
        const h = 6 + Math.floor(hash(li, i) * 5);
        const col = v === 'parts' ? ['#f3c843', '#2fb5c8', '#e2553b', '#7bd36b'][(i + li) % 4] : v === 'pallets' ? (hash(i, li) > 0.4 ? '#c08a55' : '#d7dce6') : '#c08a55';
        p.box(a, 0.3, Math.min(w, k.w - a - 0.15), 0.5, z, h, col);
        a += w + 0.12;
        i++;
      }
    }
  },
};

const workbench: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.08, 0.2, 0.12, 0.7, 0, 14, '#5a6378');
    p.box(k.w - 0.2, 0.2, 0.12, 0.7, 0, 14, '#5a6378');
    p.box(0.1, 0.25, k.w - 0.2, 0.6, 3, 2, '#7d8394', false);
    p.box(0, 0.1, k.w, 0.9, 14, 3, '#c9a77a');
    p.box(0.15, 0.3, 0.3, 0.3, 17, 5, '#5a6378');
    p.box(0.7, 0.4, 0.6, 0.35, 17, 2, '#3f8a5a');
    for (let i = 0; i < 4; i++) p.dot(0.8 + i * 0.1, 0.55, 20, '#f2b84b');
    p.box(1.5, 0.35, 0.08, 0.4, 17, 2, '#e2553b', false);
  },
  anim(p, k) {
    if (Math.sin(k.t * 9 + k.seed) > 0.85) {
      p.dot(1.0, 0.55, 23, '#fff6a8');
      p.dot(1.1, 0.5, 25, '#ffffff');
    }
  },
};

// ── farm ─────────────────────────────────────────────────────

const crops: PropArt = {
  draw(p, k) {
    p.box(0, 0, k.w, k.d, 0, 2, '#7a5236', false);
    for (let b = 0.25; b < k.d; b += 0.5) p.ln(0.05, b, 2, k.w - 0.05, b, 2, '#6a4630');
    const v = k.variant;
    for (let j = 0; j < k.d * 2; j++)
      for (let i = 0; i < k.w * 2; i++) {
        const a = i * 0.5 + 0.25;
        const b = j * 0.5 + 0.25;
        const [x, y] = p.P(a, b, 2);
        if (v === 'carrot') {
          rect(p.c, x - 1, y - 1, 3, 2, '#f07a2f');
          rect(p.c, x - 1, y - 5, 1, 4, '#5fb04f');
          rect(p.c, x + 1, y - 6, 1, 5, '#4f9a55');
        } else if (v === 'wheat') {
          rect(p.c, x - 1, y - 8, 1, 8, '#c9a24a');
          rect(p.c, x + 1, y - 7, 1, 7, '#c9a24a');
          rect(p.c, x - 2, y - 10, 2, 3, '#f2d06b');
          rect(p.c, x + 1, y - 9, 2, 3, '#e8c060');
        } else if (v === 'pumpkin') {
          if ((i + j) % 2) continue;
          disc(p.c, x, y - 2, 4, OUT);
          disc(p.c, x, y - 2, 3, '#f07a2f');
          rect(p.c, x, y - 5, 1, 2, '#4f9a55');
          rect(p.c, x - 1, y - 3, 1, 3, '#c95a1f');
        } else if (v === 'tomato') {
          if ((i + j) % 2) continue;
          rect(p.c, x, y - 12, 1, 12, '#a6714a');
          disc(p.c, x, y - 6, 4, '#3e7a3b');
          disc(p.c, x - 1, y - 8, 3, '#5fae5a');
          for (const [dx, dy] of [[-2, -5], [2, -7], [0, -3], [-1, -9]]) rect(p.c, x + dx, y + dy, 2, 2, '#e2553b');
        } else if (v === 'cabbage') {
          disc(p.c, x, y - 2, 4, '#3f6f62');
          disc(p.c, x, y - 3, 3, '#7fb0a0');
          disc(p.c, x - 1, y - 4, 1, '#c4e6d8');
        } else {
          disc(p.c, x, y - 2, 3, '#3e7a3b');
          disc(p.c, x, y - 3, 2, '#8fd06a');
        }
      }
  },
};

const greenhouse: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0, k.w, k.d, 0, 6, '#c9c3b5');
    for (let i = 0; i < 4; i++) foliage(p, 0.6 + (i % 2) * 1.6, 0.8 + Math.floor(i / 2) * 1.3, 12, 4, i % 2 ? '#5fb04f' : '#7bc35a', i);
    p.c.globalAlpha = 0.35;
    p.face(0, k.w, k.d, 6, 36, '#cdeefa');
    p.side(k.w, 0, k.d, 6, 36, '#bfe3f2');
    p.c.globalAlpha = 0.55;
    p.top(0, 0, k.w, k.d / 2, 36 + 0, '#dff6ff');
    p.c.globalAlpha = 1;
    // frame
    for (let a = 0; a <= k.w; a += k.w / 3) p.ln(a, k.d, 6, a, k.d, 36, '#f4f1ea');
    for (let b = 0; b <= k.d; b += k.d / 3) p.ln(k.w, b, 6, k.w, b, 36, '#f4f1ea');
    p.ln(0, k.d, 36, k.w, k.d, 36, '#f4f1ea');
    p.ln(k.w, 0, 36, k.w, k.d, 36, '#f4f1ea');
    p.ln(0, k.d / 2, 48, k.w, k.d / 2, 48, '#f4f1ea');
    p.ln(0, k.d, 36, 0, k.d / 2, 48, '#f4f1ea');
    p.ln(k.w, k.d, 36, k.w, k.d / 2, 48, '#f4f1ea');
    p.c.globalAlpha = 0.45;
    poly4(p, [k.w, k.d, 36], [0, k.d, 36], [0, k.d / 2, 48], [k.w, k.d / 2, 48], '#e6f8ff');
    p.c.globalAlpha = 1;
    p.face(1.2, 1.8, k.d, 6, 26, '#9ad0e0');
  },
};

function poly4(p: PropPainter, a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number], col: string) {
  const pts = [a, b, c, d].map(([x, y, z]) => p.P(x, y, z));
  poly(p.c, pts, col);
}

const barn: PropArt = {
  draw(p, k) {
    p.shadow();
    const wall = '#c0533f';
    p.box(0, 0, k.w, k.d, 0, 34, wall);
    for (let a = 0.3; a < k.w; a += 0.3) p.ln(a, k.d, 1, a, k.d, 33, darken(wall, 0.12));
    for (let b = 0.3; b < k.d; b += 0.3) p.ln(k.w, b, 1, k.w, b, 33, darken(wall, 0.3));
    // gable end on the right side
    poly4(p, [k.w, 0, 34], [k.w, k.d, 34], [k.w, k.d / 2, 58], [k.w, k.d / 2, 58], darken(wall, 0.22));
    // roof (front slope visible)
    poly4(p, [0, k.d / 2, 58], [k.w, k.d / 2, 58], [k.w + 0.1, k.d + 0.15, 32], [-0.1, k.d + 0.15, 32], '#7a3a2e');
    for (let i = 1; i < 5; i++) {
      const f = i / 5;
      p.ln(-0.1, k.d / 2 + (k.d / 2 + 0.15) * f, 58 - 26 * f, k.w + 0.1, k.d / 2 + (k.d / 2 + 0.15) * f, 58 - 26 * f, '#5e2c22');
    }
    p.ln(0, k.d / 2, 58, k.w, k.d / 2, 58, OUT);
    p.ln(-0.1, k.d + 0.15, 32, k.w + 0.1, k.d + 0.15, 32, OUT);
    // doors
    const m = k.w / 2;
    p.face(m - 0.8, m + 0.8, k.d, 0, 24, '#fbf4e4');
    p.face(m - 0.7, m - 0.05, k.d, 1, 22, wall);
    p.face(m + 0.05, m + 0.7, k.d, 1, 22, wall);
    p.ln(m - 0.7, k.d, 1, m - 0.05, k.d, 22, '#fbf4e4');
    p.ln(m + 0.05, k.d, 22, m + 0.7, k.d, 1, '#fbf4e4');
    p.side(k.w, k.d / 2 - 0.3, k.d / 2 + 0.3, 40, 50, '#f2d06b');
  },
};

const shed: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0, k.w, k.d, 0, 30, '#7d8a6a');
    p.box(-0.08, -0.08, k.w + 0.16, k.d + 0.16, 30, 4, '#5a4a3a');
    p.face(0.5, 1.5, k.d, 0, 22, '#5a4a3a');
    p.face(0.55, 1.45, k.d, 1, 21, '#8a7a5a');
  },
};

const pump: PropArt = {
  draw(p) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.2, 0.2, 0.6, 0.6, 0, 6, '#5a6378');
    p.box(0.35, 0.35, 0.3, 0.3, 6, 16, '#3f6fb5');
    p.box(0.3, 0.3, 0.4, 0.4, 22, 3, '#5b8def');
    p.ln(0.65, 0.5, 18, 0.95, 0.5, 18, METAL);
  },
  anim(p, k) {
    const s = (k.t * 4) % 1;
    p.dot(0.95, 0.5, 17 - s * 12, '#7fc2f0');
  },
};

const trough: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.2, k.w, 0.6, 0, 8, '#8a5a3c');
    p.top(0.08, 0.28, k.w - 0.08, 0.72, 7, '#5b9bd5');
  },
};

const toolRack: PropArt = {
  draw(p) {
    p.box(0.1, 0.35, 0.8, 0.15, 0, 28, '#a6714a');
    p.face(0.2, 0.25, 0.5, 6, 26, '#9aa4b8');
    p.face(0.45, 0.5, 0.5, 4, 26, '#8a5a3c');
    p.face(0.38, 0.58, 0.5, 4, 8, '#9aa4b8');
    p.face(0.7, 0.75, 0.5, 8, 26, '#8a5a3c');
  },
};

const hay: PropArt = {
  draw(p) {
    p.shadow(0.1, 0.1, 0.8, 0.8);
    p.box(0.1, 0.1, 0.8, 0.8, 0, 12, '#e8c574');
    p.face(0.1, 0.9, 0.9, 4, 5, '#c9a24a');
    p.face(0.1, 0.9, 0.9, 8, 9, '#c9a24a');
  },
};

const picnic: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0, k.w - 0.2, 0.2, 0, 6, WOOD);
    p.box(0.1, 0.8, k.w - 0.2, 0.2, 0, 6, WOOD);
    p.box(0.3, 0.4, 0.1, 0.2, 0, 11, WOOD_D, false);
    p.box(k.w - 0.4, 0.4, 0.1, 0.2, 0, 11, WOOD_D, false);
    p.box(0, 0.25, k.w, 0.5, 11, 2, '#b07b52');
    p.top(0.3, 0.3, 0.9, 0.7, 13, '#e2553b');
    p.top(0.4, 0.3, 0.5, 0.7, 13, '#fbfbf7');
  },
};

// ── space / lab / tech ──────────────────────────────────────

const pod: PropArt = {
  draw(p) {
    p.shadow(0.15, 0.15, 0.7, 0.7);
    p.box(0.15, 0.15, 0.7, 0.7, 0, 6, '#5a6378');
    p.c.globalAlpha = 0.6;
    p.box(0.22, 0.22, 0.56, 0.56, 6, 30, '#5ee0e6', false);
    p.c.globalAlpha = 1;
    p.box(0.15, 0.15, 0.7, 0.7, 36, 5, '#5a6378');
  },
  anim(p, k) {
    for (let i = 0; i < 3; i++) {
      const z = 8 + ((k.t * 8 + i * 9 + k.seed * 3) % 26);
      p.dot(0.4 + i * 0.1, 0.6, z, '#e6ffff');
    }
  },
};

const hologram: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.25, 0.25, 1.5, 1.5, 0, 12, '#4b5578');
    p.top(0.4, 0.4, 1.6, 1.6, 12, '#5ee0e6');
    p.top(0.5, 0.5, 1.5, 1.5, 12, '#24456a');
    void k;
  },
  anim(p, k) {
    const [cx, cy] = p.P(1, 1, 30);
    p.c.globalAlpha = 0.35 + Math.sin(k.t * 6) * 0.05;
    disc(p.c, cx, cy, 10, k.th.accent, 1);
    p.c.globalAlpha = 0.85;
    disc(p.c, cx, cy, 7, '#1a3f5c', 1);
    const o = Math.round(((k.t * 3) % 12) - 6);
    rect(p.c, cx + o, cy - 2, 3, 2, '#7bd36b');
    rect(p.c, cx - 3 + o / 2, cy + 2, 4, 2, '#7bd36b');
    p.c.globalAlpha = 1;
    for (let i = 0; i < 12; i++) {
      const ang = k.t * 1.5 + (i / 12) * Math.PI * 2;
      rect(p.c, cx + Math.cos(ang) * 13, cy + Math.sin(ang) * 5, 1, 1, k.th.accent2);
    }
  },
};

const hatch: PropArt = {
  draw(p, k) {
    p.box(0.1, 0.1, 1.8, 1.8, 0, 3, '#f3c843');
    for (let i = 0; i < 6; i++) p.top(0.15 + i * 0.3, 0.12, 0.27 + i * 0.3, 0.22, 3, OUT);
    p.top(0.35, 0.35, 1.65, 1.65, 3, '#59607a');
    p.top(0.5, 0.5, 1.5, 1.5, 3, '#8a93a8');
    p.ln(1, 0.5, 3, 1, 1.5, 3, '#59607a');
    p.ln(0.5, 1, 3, 1.5, 1, 3, '#59607a');
    void k;
  },
  anim(p, k) {
    const a = k.t * 2.5;
    p.dot(1 + Math.cos(a) * 0.75, 1 + Math.sin(a) * 0.75, 4, k.th.accent2, 2, 2);
  },
};

const hydro: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.05, 0.25, k.w - 0.1, 0.6, 0, 10, '#d7dce6');
    for (let i = 0; i < k.w * 2; i++) foliage(p, 0.3 + i * 0.48, 0.55, 13, 3, i % 2 ? '#5fb04f' : '#7bc35a', i + k.seed);
    p.box(0.05, 0.25, 0.08, 0.1, 10, 14, METAL, false);
    p.box(k.w - 0.13, 0.25, 0.08, 0.1, 10, 14, METAL, false);
    p.box(0.05, 0.25, k.w - 0.1, 0.3, 24, 2, '#5a6378');
  },
  anim(p, k) {
    p.c.globalAlpha = 0.6 + Math.sin(k.t * 3) * 0.25;
    p.face(0.1, k.w - 0.1, 0.55, 23, 24, '#b07bf0');
    p.c.globalAlpha = 1;
  },
};

const dispenser: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.1, 0.25, 0.8, 0.7, 0, 36, '#d7dce6');
    p.face(0.2, 0.8, 0.95, 22, 32, SCREEN);
    p.face(0.25, 0.75, 0.95, 6, 14, DARK);
  },
  anim(p, k) {
    p.dot(0.3, 0.95, 28, '#5ee0e6', 4, 1);
    p.dot(0.3, 0.95, 25, blink(k.t, 2) ? '#f2b84b' : '#5a6378', 6, 1);
  },
};

const labbench: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.15, k.w, 0.85, 0, 18, '#b7c7cf');
    for (let a = 0.1; a < k.w - 0.4; a += 1) p.face(a, a + 0.8, 1.0, 3, 15, darken('#b7c7cf', 0.1));
    p.box(0, 0.15, k.w, 0.85, 18, 3, '#f3f6f8');
    const v = k.variant;
    if (v === 'microscope') {
      p.box(0.4, 0.35, 0.35, 0.35, 21, 3, DARK);
      p.box(0.5, 0.4, 0.15, 0.15, 24, 10, '#5a6378');
      p.box(0.45, 0.45, 0.25, 0.1, 32, 3, DARK);
    }
    const flasks: [number, string][] = v === 'capsule' ? [] : [[1.3, '#59e08a'], [1.8, '#5b8def'], [2.4, '#e2553b']];
    for (const [a, col] of flasks) if (a < k.w - 0.2) p.box(a, 0.45, 0.2, 0.2, 21, 6, col);
    if (v === 'capsule') for (let i = 0; i < 6; i++) p.box(0.3 + i * 0.2, 0.4, 0.1, 0.1, 21, 7, ['#b07bf0', '#5ee0e6', '#f2b84b', '#59e08a'][i % 4], false);
  },
  anim(p, k) {
    if (k.variant === 'capsule') return;
    for (const [a, col] of [[1.4, '#59e08a'], [1.9, '#5b8def'], [2.5, '#e2553b']] as const) {
      if (a > k.w - 0.2) continue;
      const s = (k.t * 2 + a * 3) % 3;
      p.dot(a, 0.55, 28 + s * 2, lighten(col, 0.5));
    }
  },
};

const fumehood: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.2, k.w, 0.8, 0, 50, '#e4e7ec');
    p.face(0.1, k.w - 0.1, 1.0, 18, 44, '#8a93a8');
    p.face(0.15, k.w - 0.15, 1.0, 19, 43, '#d5eef5');
    p.face(0.15, k.w - 0.15, 1.0, 30, 31, '#ffffff');
    p.box(0.4, 0.5, 0.2, 0.2, 18, 6, '#59e08a');
    p.box(1.2, 0.5, 0.25, 0.25, 18, 4, '#b07bf0');
    p.face(0.15, k.w - 0.15, 1.0, 4, 14, '#c9d0dc');
  },
  anim(p, k) {
    p.dot(k.w - 0.25, 1.0, 47, blink(k.t, 2, k.seed) ? '#59e08a' : '#2f7a4c', 2, 2);
    const s = (k.t * 3) % 6;
    p.dot(0.5, 0.6, 26 + s, '#ffffff');
  },
};

const drum: PropArt = { draw: (p, k) => barrel.draw(p, { ...k, variant: 'chem' }) };

const reagents: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.4, k.w, 0.6, 0, 44, '#e7ddcb');
    p.face(0.06, k.w - 0.06, 1.0, 2, 42, '#d0c4ae');
    const cols = ['#e2553b', '#5b8def', '#59e08a', '#f3c843', '#b07bf0', '#2fb5c8'];
    for (let s = 0; s < 4; s++) {
      const z = 4 + s * 10;
      p.face(0.06, k.w - 0.06, 1.0, z - 1, z, '#a07a55');
      for (let i = 0; i < k.w * 5; i++) p.face(0.12 + i * 0.19, 0.24 + i * 0.19, 1.0, z, z + 4 + (i % 3), cols[(i + s) % cols.length]);
    }
  },
};

const shower: PropArt = {
  draw(p) {
    p.box(0.45, 0.45, 0.1, 0.1, 0, 50, '#59e08a', false);
    p.box(0.25, 0.25, 0.5, 0.5, 48, 4, '#59e08a');
    p.box(0.2, 0.2, 0.6, 0.6, 0, 2, '#e4e7ec');
    p.box(0.55, 0.3, 0.3, 0.2, 26, 6, '#59e08a');
    p.face(0.6, 0.8, 0.5, 27, 31, '#ffffff');
  },
};

const analyzer: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.1, 0.25, 0.8, 0.7, 0, 28, '#e4e7ec');
    p.face(0.18, 0.82, 0.95, 16, 26, SCREEN);
    p.box(0.25, 0.6, 0.5, 0.3, 4, 4, '#5a6378');
  },
  anim(p, k) {
    for (let i = 0; i < 8; i++) p.dot(0.22 + i * 0.075, 0.95, 18 + Math.round((Math.sin(k.t * 2 + i) + 1) * 3), '#59e08a');
  },
};

const easel: PropArt = {
  draw(p, k) {
    p.ln(0.25, 0.7, 0, 0.45, 0.5, 30, '#8a5a3c');
    p.ln(0.75, 0.7, 0, 0.55, 0.5, 30, '#8a5a3c');
    p.ln(0.5, 0.3, 0, 0.5, 0.5, 30, '#6f4a30');
    p.face(0.15, 0.85, 0.62, 12, 32, OUT);
    p.face(0.18, 0.82, 0.62, 13, 31, '#fbf4e4');
    p.face(0.2, 0.8, 0.62, 14, 21, '#7bc35a');
    p.face(0.2, 0.8, 0.62, 21, 30, '#9fd3ee');
    p.dot(0.6, 0.62, 28, '#f2b84b', 3, 3);
    p.face(0.15, 0.85, 0.62, 11, 12, '#6f4a30');
    void k;
  },
};

const tripod: PropArt = {
  draw(p) {
    p.ln(0.3, 0.75, 0, 0.5, 0.5, 18, DARK);
    p.ln(0.7, 0.75, 0, 0.5, 0.5, 18, DARK);
    p.ln(0.5, 0.25, 0, 0.5, 0.5, 18, DARK);
    p.box(0.3, 0.35, 0.4, 0.3, 18, 9, DARK);
    p.box(0.42, 0.18, 0.16, 0.18, 20, 5, '#5a6378');
  },
  anim(p, k) {
    p.dot(0.35, 0.65, 25, blink(k.t, 3) ? '#e2553b' : '#5a2a22', 1, 1);
  },
};

const softbox: PropArt = {
  draw(p) {
    p.ln(0.5, 0.5, 0, 0.5, 0.5, 26, DARK);
    p.ln(0.3, 0.7, 0, 0.5, 0.5, 6, DARK);
    p.ln(0.7, 0.7, 0, 0.5, 0.5, 6, DARK);
    p.box(0.2, 0.4, 0.6, 0.2, 26, 16, '#e8e1d2');
    p.face(0.25, 0.75, 0.6, 27, 41, '#fff6d8');
  },
};

const podcast: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.15, k.w, 0.85, 0, 14, '#3a3f5a');
    p.box(0, 0.15, k.w, 0.85, 14, 2, '#262a3d');
    for (const a of [0.45, k.w - 0.45]) {
      p.box(a - 0.04, 0.5, 0.08, 0.08, 16, 6, OUT, false);
      p.box(a - 0.1, 0.45, 0.2, 0.18, 22, 6, '#9aa4b8');
    }
    p.box(k.w / 2 - 0.3, 0.4, 0.6, 0.3, 16, 3, '#1d2238');
  },
  anim(p, k) {
    p.dot(k.w / 2 - 0.15, 0.7, 18, blink(k.t, 4) ? '#e2553b' : '#5fd38d', 2, 1);
  },
};

const assembly: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.15, 0.15, 1.7, 1.7, 0, 6, '#5a6378');
    for (const [a, b] of [[0.2, 0.2], [1.7, 0.2]]) p.box(a, b, 0.1, 0.1, 6, 36, '#f3c843', false);
    p.box(0.2, 0.2, 1.6, 0.1, 40, 3, '#f3c843');
    // robot
    p.box(0.75, 0.85, 0.2, 0.2, 6, 10, '#c9d0dc');
    p.box(1.05, 0.85, 0.2, 0.2, 6, 10, '#c9d0dc');
    p.box(0.7, 0.8, 0.6, 0.35, 16, 12, '#e4e7ec');
    p.box(0.8, 0.85, 0.4, 0.3, 28, 8, '#d7dce6');
    p.face(0.85, 1.15, 1.15, 31, 34, SCREEN);
    p.box(0.55, 0.9, 0.15, 0.15, 18, 9, '#9aa4b8', false);
  },
  anim(p, k) {
    p.dot(0.95, 1.15, 33, blink(k.t, 1.5) ? '#5ee0e6' : '#2a5b78', 2, 1);
    p.dot(1.1, 1.15, 33, blink(k.t, 1.5) ? '#5ee0e6' : '#2a5b78', 2, 1);
    if (Math.sin(k.t * 7) > 0.8) {
      p.dot(1.35, 0.9, 22, '#fff6a8');
      p.dot(1.45, 0.95, 24, '#ffffff');
    }
  },
};

const bot: PropArt = {
  live: true,
  draw(p, k) {
    const a = k.t * 0.8;
    const ox = Math.cos(a) * 0.25;
    const oy = Math.sin(a) * 0.25;
    const bob = Math.round(Math.sin(k.t * 6));
    p.c.globalAlpha = 0.25;
    p.top(0.25 + ox, 0.25 + oy, 0.75 + ox, 0.75 + oy, 0, '#1c1228');
    p.c.globalAlpha = 1;
    p.box(0.3 + ox, 0.3 + oy, 0.4, 0.4, 2 + bob, 9, '#d7dce6');
    p.face(0.35 + ox, 0.65 + ox, 0.7 + oy, 6 + bob, 9 + bob, SCREEN);
    p.dot(0.42 + ox, 0.7 + oy, 7 + bob, '#5ee0e6');
    p.dot(0.56 + ox, 0.7 + oy, 7 + bob, '#5ee0e6');
    p.ln(0.5 + ox, 0.5 + oy, 11 + bob, 0.5 + ox, 0.5 + oy, 15 + bob, OUT);
    p.dot(0.5 + ox, 0.5 + oy, 16 + bob, blink(k.t, 2) ? '#e2553b' : '#f2b84b', 2, 2);
  },
};

const printer3d: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.15, 0.2, 0.7, 0.7, 0, 4, DARK);
    for (const [a, b] of [[0.15, 0.2], [0.75, 0.2], [0.15, 0.8], [0.75, 0.8]]) p.box(a, b, 0.1, 0.1, 4, 26, '#5a6378', false);
    p.box(0.15, 0.2, 0.7, 0.7, 30, 2, '#5a6378');
  },
  anim(p, k) {
    const prog = (k.t * 0.15) % 1;
    const h = Math.max(1, Math.round(prog * 12));
    p.box(0.38, 0.42, 0.24, 0.24, 4, h, '#f3c843', false);
    const a = 0.5 + Math.sin(k.t * 5) * 0.2;
    p.box(a - 0.08, 0.45, 0.16, 0.16, 4 + h + 2, 3, '#9aa4b8', false);
  },
};

const charger: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0.3, k.w, 0.7, 0, 8, '#5a6378');
    for (const a of [0.25, 1.15]) {
      p.box(a, 0.4, 0.5, 0.45, 8, 8, '#d7dce6');
      p.face(a + 0.05, a + 0.45, 0.85, 11, 14, SCREEN);
    }
  },
  anim(p, k) {
    for (let i = 0; i < 5; i++) p.face(0.2 + i * 0.3, 0.4 + i * 0.3, 1.0, 3, 5, i < (k.t * 2) % 6 ? '#59e08a' : '#235a38');
  },
};

const servers: PropArt = {
  draw(p, k) {
    p.shadow();
    for (let i = 0; i < k.w; i++) {
      p.box(i + 0.04, 0.15, 0.92, 0.85, 0, 50, '#2f3546');
      for (let s = 0; s < 8; s++) p.face(i + 0.1, i + 0.9, 1.0, 4 + s * 5.5, 8 + s * 5.5, '#3b4258');
    }
  },
  anim(p, k) {
    for (let i = 0; i < k.w; i++)
      for (let s = 0; s < 8; s++) {
        const on = blink(k.t, 1 + hash(i, s, k.seed) * 6, i * 3 + s);
        p.dot(i + 0.15, 1.0, 7 + s * 5.5, on ? '#59e08a' : '#235a38');
        if (hash(s, i) > 0.75) p.dot(i + 0.3, 1.0, 7 + s * 5.5, on ? '#f2b84b' : '#5a4a20');
      }
  },
};

const cooling: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.05, 0.2, k.w - 0.1, 0.8, 0, 34, '#c9d0dc');
    p.face(0.2, 0.95, 1.0, 8, 28, DARK);
    p.face(1.05, 1.8, 1.0, 8, 28, DARK);
  },
  anim(p, k) {
    for (const ca of [0.575, 1.425]) {
      const [cx, cy] = p.P(ca, 1.0, 18);
      for (let n = 0; n < 4; n++) {
        const ang = k.t * 8 + (n * Math.PI) / 2;
        for (let d = 2; d < 7; d++) rect(p.c, cx + Math.cos(ang) * d * 0.9, cy + Math.sin(ang) * d, 1, 1, '#9aa4b8');
      }
    }
  },
};

const netcab: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.1, 0.15, 0.8, 0.8, 0, 48, '#2f3546');
    const cols = ['#5b8def', '#f3c843', '#59e08a', '#e2553b'];
    for (let i = 0; i < 8; i++) p.face(0.15 + i * 0.08, 0.2 + i * 0.08, 0.95, 6, 40 - (i % 3) * 6, cols[i % 4]);
  },
  anim(p, k) {
    for (let s = 0; s < 5; s++) p.dot(0.8, 0.95, 10 + s * 7, blink(k.t, 2 + s, s) ? '#59e08a' : '#235a38');
  },
};

const cart: PropArt = {
  draw(p) {
    p.shadow(0.15, 0.15, 0.7, 0.7);
    p.box(0.15, 0.2, 0.7, 0.6, 3, 2, '#9aa4b8');
    p.box(0.15, 0.2, 0.7, 0.6, 12, 2, '#9aa4b8');
    p.box(0.25, 0.3, 0.2, 0.3, 14, 3, DARK);
    p.box(0.55, 0.3, 0.2, 0.3, 14, 3, DARK);
    p.ln(0.15, 0.8, 0, 0.15, 0.8, 14, METAL);
    p.ln(0.85, 0.8, 0, 0.85, 0.8, 14, METAL);
  },
};

const terrarium: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0, 0, k.w, k.d, 0, 8, WOOD);
    for (let i = 0; i < 5; i++) foliage(p, 0.4 + (i % 3) * 0.6, 0.5 + Math.floor(i / 3) * 0.9, 14, 4, ['#5fb04f', '#7bc35a', '#3e8a4a'][i % 3], i + k.seed);
    p.c.globalAlpha = 0.3;
    p.face(0, k.w, k.d, 8, 32, '#cdeefa');
    p.side(k.w, 0, k.d, 8, 32, '#bfe3f2');
    p.top(0, 0, k.w, k.d, 32, '#e6f8ff');
    p.c.globalAlpha = 1;
    p.ln(0, k.d, 32, k.w, k.d, 32, '#f4f1ea');
    p.ln(k.w, 0, 32, k.w, k.d, 32, '#f4f1ea');
    p.ln(k.w, k.d, 8, k.w, k.d, 32, '#f4f1ea');
    p.ln(0, k.d, 8, 0, k.d, 32, '#f4f1ea');
  },
  anim(p, k) {
    p.c.globalAlpha = 0.35;
    const s = (k.t * 2) % 1;
    p.dot(0.6, 0.8, 20 + s * 10, '#ffffff', 2, 1);
    p.dot(1.4, 1.2, 18 + ((s + 0.5) % 1) * 10, '#ffffff', 2, 1);
    p.c.globalAlpha = 1;
  },
};

const globe: PropArt = {
  draw(p) {
    p.shadow(0.25, 0.25, 0.5, 0.5);
    p.box(0.35, 0.35, 0.3, 0.3, 0, 3, WOOD_D);
    p.ln(0.5, 0.5, 3, 0.5, 0.5, 12, WOOD_D);
    const [x, y] = p.P(0.5, 0.5, 20);
    blob(p.c, x, y, 7, '#5b8def');
    rect(p.c, x - 3, y - 3, 4, 3, '#7bc35a');
    rect(p.c, x + 1, y + 1, 3, 3, '#7bc35a');
    rect(p.c, x - 4, y - 4, 2, 1, '#cfe3ff');
  },
};

// ── port ─────────────────────────────────────────────────────

const CONTAINER = { red: '#c0533f', blue: '#3f6fb5', green: '#3f8a5a', yellow: '#e0a83a', teal: '#2f8f8f' } as Record<string, string>;

const container: PropArt = {
  draw(p, k) {
    p.shadow();
    const col = CONTAINER[k.variant ?? 'red'] ?? k.color ?? '#c0533f';
    p.box(0, 0.05, k.w, 0.9, 0, 26, col);
    for (let a = 0.12; a < k.w; a += 0.12) p.ln(a, 0.95, 2, a, 0.95, 24, darken(col, 0.15));
    for (let b = 0.15; b < 0.95; b += 0.12) p.ln(k.w, b, 2, k.w, b, 24, darken(col, 0.35));
    p.face(0.05, 0.3, 0.95, 4, 22, darken(col, 0.08));
    p.face(0.12, 0.2, 0.95, 18, 19, '#fbf4e4');
  },
};

const crane: PropArt = {
  draw(p, k) {
    const col = '#f07a2f';
    for (const [a, b] of [[0.1, 0.1], [1.7, 0.1], [0.1, 1.7], [1.7, 1.7]]) p.box(a, b, 0.2, 0.2, 0, 88, col);
    p.box(0.1, 0.1, 1.8, 0.2, 86, 6, col);
    p.box(0.1, 1.7, 1.8, 0.2, 86, 6, col);
    p.box(0.1, 0.1, 0.2, 1.8, 86, 6, darken(col, 0.05));
    p.box(1.7, 0.1, 0.2, 1.8, 86, 6, darken(col, 0.05));
    for (let z = 10; z < 84; z += 14) {
      p.ln(0.2, 1.8, z, 1.8, 1.8, z + 12, darken(col, 0.2));
      p.ln(1.8, 0.2, z, 1.8, 1.8, z + 12, darken(col, 0.3));
    }
    void k;
  },
  anim(p, k) {
    const a = 0.4 + ((Math.sin(k.t * 0.4) + 1) / 2) * 1.1;
    p.box(a, 0.8, 0.35, 0.4, 82, 6, '#3a3f5a');
    const drop = 30 + Math.round((Math.sin(k.t * 0.6) + 1) * 14);
    p.ln(a + 0.18, 1.0, 82, a + 0.18, 1.0, 82 - drop, OUT);
    p.box(a + 0.03, 0.85, 0.3, 0.3, 82 - drop - 4, 4, '#f3c843');
  },
};

const booth: PropArt = {
  draw(p, k) {
    p.shadow();
    p.box(0.1, 0.1, 1.8, 1.8, 0, 40, '#dfe6ef');
    p.face(0.25, 1.75, 1.9, 20, 34, OUT);
    p.face(0.3, 1.7, 1.9, 21, 33, '#2b4a6a');
    p.side(1.9, 0.3, 1.7, 21, 33, '#24405c');
    p.face(0.8, 1.2, 1.9, 0, 18, '#5a6378');
    p.box(0, 0, 2, 2, 40, 3, '#5a6274');
    p.ln(1.6, 0.4, 43, 1.6, 0.4, 56, OUT);
    void k;
  },
  anim(p, k) {
    for (let i = 0; i < 5; i++) p.dot(0.4 + i * 0.25, 1.9, 26 + Math.round(Math.sin(k.t * 2 + i) * 2), k.th.accent);
    p.dot(1.6, 0.4, 57, blink(k.t, 1.5) ? '#e2553b' : '#5a2a22', 2, 2);
  },
};

const kiosk: PropArt = {
  draw(p) {
    p.shadow(0.2, 0.2, 0.6, 0.6);
    p.box(0.35, 0.4, 0.3, 0.3, 0, 18, '#5a6378');
    p.box(0.2, 0.45, 0.6, 0.15, 18, 12, '#3a3f5a');
    p.face(0.25, 0.75, 0.6, 20, 29, SCREEN);
  },
  anim(p, k) {
    for (let i = 0; i < 6; i++) p.dot(0.28 + i * 0.08, 0.6, 22 + ((i + Math.floor(k.t * 2)) % 4), '#59e08a');
  },
};

const forklift: PropArt = {
  draw(p) {
    p.shadow();
    p.box(0.15, 0.4, 0.7, 1.2, 4, 14, '#f3c843');
    p.box(0.25, 0.6, 0.5, 0.5, 18, 2, '#3a3f5a');
    p.ln(0.2, 0.6, 18, 0.2, 0.6, 30, OUT);
    p.ln(0.8, 0.6, 18, 0.8, 0.6, 30, OUT);
    p.box(0.15, 0.55, 0.7, 0.6, 30, 2, '#d9a92a');
    p.box(0.15, 1.6, 0.7, 0.1, 0, 22, '#5a6378');
    p.box(0.25, 1.7, 0.12, 0.3, 2, 1, '#9aa4b8', false);
    p.box(0.63, 1.7, 0.12, 0.3, 2, 1, '#9aa4b8', false);
    for (const [a, b] of [[0.15, 0.5], [0.15, 1.4]]) p.box(a - 0.05, b, 0.1, 0.25, 0, 5, OUT, false);
  },
};

const bollard: PropArt = {
  draw(p) {
    p.box(0.35, 0.35, 0.3, 0.3, 0, 7, '#3a3f5a');
    p.box(0.3, 0.3, 0.4, 0.4, 7, 2, '#5a6378');
  },
};

const boat: PropArt = {
  live: true,
  draw(p, k) {
    const z = Math.round(Math.sin(k.t * 1.2) * 1.5) - 3;
    p.box(0.1, 0.4, 3.6, 1.2, z, 10, '#c0533f');
    p.box(0.1, 0.4, 3.6, 1.2, z + 10, 2, '#f4f1ea');
    p.box(1.4, 0.7, 1.2, 0.7, z + 12, 12, '#f4f1ea');
    p.face(1.5, 2.5, 1.4, z + 17, z + 21, '#2b4a6a');
    p.ln(2.0, 1.0, z + 24, 2.0, 1.0, z + 36, OUT);
    p.dot(2.0, 1.0, z + 37, '#f3c843', 2, 2);
  },
};

export const PROP_ART: Record<string, PropArt> = {
  desk,
  table,
  coffeeTable,
  cafeTable,
  counter,
  watercooler,
  vending,
  sofa,
  armchair,
  bench,
  bookshelf,
  cabinet,
  crate,
  barrel,
  lamp,
  printer,
  plant,
  plantTall,
  tree,
  bush,
  machine,
  robotArm,
  conveyor,
  console: console_,
  rack,
  workbench,
  crops,
  greenhouse,
  barn,
  shed,
  pump,
  trough,
  toolRack,
  hay,
  picnic,
  pod,
  hologram,
  hatch,
  hydro,
  dispenser,
  labbench,
  fumehood,
  drum,
  reagents,
  shower,
  analyzer,
  easel,
  tripod,
  softbox,
  podcast,
  assembly,
  bot,
  printer3d,
  charger,
  servers,
  cooling,
  netcab,
  cart,
  terrarium,
  globe,
  container,
  crane,
  booth,
  kiosk,
  forklift,
  bollard,
  boat,
};


// ─────────────────────────────────────────────────────────────
// Environment art: floor tiles, floor patches, back walls / fences,
// the diorama slab, and wall-mounted props.
// ─────────────────────────────────────────────────────────────

import type { FloorPatch, WallPropPlacement, WorldDef, WorldTheme } from '../domain/world';
import { darken, lighten, mix } from './color';
import { disc } from './props';
import { line, OUT, type Painter, rect, WALL_H, WallPainter } from './iso';

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// ── walls (drawn as depth-sorted items so scenery can sit behind them) ──

const T = 0.25; // wall thickness in tiles

/** Floor overlays that stay vector: rugs, lanes, test pads. */
export function drawFloorOverlays(P: Painter, w: WorldDef) {
  for (const s of w.environment.patches) patchRect(P, s);
}

function patchRect(P: Painter, s: FloorPatch) {
  const { x, y, w, d } = s;
  const col = s.color ?? '#f3c843';
  if (s.style === 'rug') {
    P.quad([[x + 0.1, y + 0.1, 0], [x + w - 0.1, y + 0.1, 0], [x + w - 0.1, y + d - 0.1, 0], [x + 0.1, y + d - 0.1, 0]], darken(col, 0.28));
    P.quad([[x + 0.18, y + 0.18, 0], [x + w - 0.18, y + 0.18, 0], [x + w - 0.18, y + d - 0.18, 0], [x + 0.18, y + d - 0.18, 0]], lighten(col, 0.05));
    P.quad([[x + 0.32, y + 0.32, 0], [x + w - 0.32, y + 0.32, 0], [x + w - 0.32, y + d - 0.32, 0], [x + 0.32, y + d - 0.32, 0]], lighten(col, 0.16));
    const inner = mix(lighten(col, 0.16), darken(col, 0.2), 0.5);
    P.line3([x + 0.45, y + 0.45, 0], [x + w - 0.45, y + 0.45, 0], inner);
    P.line3([x + 0.45, y + d - 0.45, 0], [x + w - 0.45, y + d - 0.45, 0], inner);
    P.line3([x + 0.45, y + 0.45, 0], [x + 0.45, y + d - 0.45, 0], inner);
    P.line3([x + w - 0.45, y + 0.45, 0], [x + w - 0.45, y + d - 0.45, 0], inner);
    for (let i = 0; i < w * 3; i++) P.dot(x + 0.15 + i / 3, y + d - 0.08, 0, lighten(col, 0.35));
  } else if (s.style === 'lane') {
    if (w >= d) P.quad([[x, y + 0.45, 0], [x + w, y + 0.45, 0], [x + w, y + 0.55, 0], [x, y + 0.55, 0]], col);
    else P.quad([[x + 0.45, y, 0], [x + 0.55, y, 0], [x + 0.55, y + d, 0], [x + 0.45, y + d, 0]], col);
  } else if (s.style === 'pad') {
    P.quad([[x + 0.1, y + 0.1, 0], [x + w - 0.1, y + 0.1, 0], [x + w - 0.1, y + d - 0.1, 0], [x + 0.1, y + d - 0.1, 0]], mix('#8b919f', col, 0.15));
    for (let i = 0; i < w * 3; i++) if (i % 2 === 0) P.line3([x + 0.1 + i / 3, y + 0.1, 0], [x + 0.1 + (i + 1) / 3, y + 0.1, 0], col);
    for (let i = 0; i < d * 3; i++) if (i % 2 === 0) P.line3([x + 0.1, y + 0.1 + i / 3, 0], [x + 0.1, y + 0.1 + (i + 1) / 3, 0], col);
  }
}

/** One back wall of an indoor room, with paneling, rail, baseboard, cap and its wall props. */
export function drawWall(P: Painter, w: WorldDef, side: 'ne' | 'nw', t: number) {
  const th = w.theme;
  const H = WALL_H;
  const { cols, rows } = w;
  if (side === 'nw') {
    const c = darken(th.wall, 0.14);
    P.quad([[0, 0, 0], [0, rows, 0], [0, rows, H], [0, 0, H]], c);
    wallTexture(P, side, rows, c);
    P.quad([[0, 0, 0], [0, rows, 0], [0, rows, 7], [0, 0, 7]], darken(th.wallTrim, 0.15));
    P.line3([0, 0, 7], [0, rows, 7], lighten(th.wallTrim, 0.1));
    P.quad([[-T, 0, H], [0, 0, H], [0, rows, H], [-T, rows, H]], lighten(c, 0.16));
    P.quad([[-T, rows, 0], [0, rows, 0], [0, rows, H], [-T, rows, H]], darken(c, 0.2));
    P.line3([-T, 0, H], [-T, rows, H], OUT);
    P.line3([-T, rows, H], [-T, rows, 0], OUT);
    P.line3([-T, rows, H], [0, rows, H], OUT);
    P.line3([0, rows, H], [0, rows, 0], darken(c, 0.35));
  } else {
    const c = th.wall;
    P.quad([[0, 0, 0], [cols, 0, 0], [cols, 0, H], [0, 0, H]], c);
    wallTexture(P, side, cols, c);
    P.quad([[0, 0, 0], [cols, 0, 0], [cols, 0, 7], [0, 0, 7]], th.wallTrim);
    P.line3([0, 0, 7], [cols, 0, 7], lighten(th.wallTrim, 0.2));
    P.quad([[-T, -T, H], [cols, -T, H], [cols, 0, H], [0, 0, H], [-T, 0, H]], lighten(c, 0.16));
    P.quad([[cols, -T, 0], [cols, 0, 0], [cols, 0, H], [cols, -T, H]], darken(c, 0.32));
    P.line3([-T, -T, H], [cols, -T, H], OUT);
    P.line3([cols, -T, H], [cols, -T, 0], OUT);
    P.line3([cols, -T, H], [cols, 0, H], OUT);
    P.line3([cols, 0, H], [cols, 0, 0], darken(c, 0.4));
    P.line3([0, 0, 0], [0, 0, H], darken(c, 0.3));
  }
  for (const wp of w.environment.wallProps) if (wp.wall === side) drawWallProp(P, wp, th, t);
}

/** Wainscot boards below the rail, subtle patterned paper above. */
function wallTexture(P: Painter, side: 'ne' | 'nw', len: number, c: string) {
  const at = (u: number, z: number): [number, number, number] => (side === 'ne' ? [u, 0, z] : [0, u, z]);
  const lower = darken(c, 0.08);
  P.quad([at(0, 7), at(len, 7), at(len, 26), at(0, 26)], lower);
  for (let u = 0.25; u < len; u += 0.25) P.line3(at(u, 8), at(u, 25), darken(c, 0.16));
  P.quad([at(0, 26), at(len, 26), at(len, 28), at(0, 28)], lighten(c, 0.12));
  P.line3(at(0, 28), at(len, 28), darken(c, 0.2));
  for (let u = 0.12; u < len; u += 0.25)
    for (let z = 34; z < WALL_H - 4; z += 8) {
      const [x, y] = P.P(...at(u + ((z / 8) % 2) * 0.125, z));
      rect(P.c, x, y, 1, 1, darken(c, 0.07));
    }
  P.quad([at(0, WALL_H - 4), at(len, WALL_H - 4), at(len, WALL_H), at(0, WALL_H)], lighten(c, 0.08));
}

// ── wall props ───────────────────────────────────────────────

interface WallCtx {
  w: number;
  variant?: string;
  color?: string;
  th: WorldTheme;
  t: number;
}

type WallArt = (W: WallPainter, k: WallCtx) => void;

const windowArt: WallArt = (W, k) => {
  const u0 = 0.15;
  const u1 = k.w - 0.15;
  W.panel(u0, u1, 18, 54, k.th.wallTrim);
  W.quad(u0 + 0.1, u1 - 0.1, 21, 51, '#9fd3ee');
  W.quad(u0 + 0.1, u1 - 0.1, 40, 51, '#c3e6f6');
  W.quad(u0 + 0.1, u1 - 0.1, 21, 27, '#86c06a');
  for (let u = 1; u < k.w; u++) W.quad(u - 0.04, u + 0.04, 21, 51, k.th.wallTrim);
  W.quad(u0 + 0.1, u1 - 0.1, 35, 36, k.th.wallTrim);
  W.ln(u0 + 0.3, 48, u0 + 0.5, 44, '#ffffff');
  W.quad(u0 - 0.05, u1 + 0.05, 16, 18, darken(k.th.wallTrim, 0.2));
};

const starwindow: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 14, 56, '#59607a');
  W.quad(0.2, k.w - 0.2, 17, 53, '#0a0d20');
  for (let i = 0; i < k.w * 6; i++) {
    const u = 0.25 + hash(i, k.w) * (k.w - 0.5);
    const z = 19 + hash(k.w, i) * 32;
    const tw = Math.sin(k.t * 2 + i) > 0.2;
    W.dot(u, z, tw ? '#ffffff' : '#6f78a8');
  }
  if (k.variant === 'planet') {
    const [x, y] = W.P(k.w * 0.7, 30);
    disc(W.c, x, y, 12, '#e2553b', 1);
    disc(W.c, x - 3, y - 3, 6, '#f08a5f', 1);
    rect(W.c, x - 18, y + 1, 36, 1, '#f2b84b');
  }
  for (let u = 1; u < k.w; u++) W.quad(u - 0.03, u + 0.03, 17, 53, '#3b4566');
};

const whiteboard: WallArt = (W, k) => {
  const blue = k.variant === 'blueprint';
  W.panel(0.15, k.w - 0.15, 22, 52, '#c9ccd6');
  W.quad(0.25, k.w - 0.25, 24, 50, blue ? '#2f5f9e' : '#fbfbf7');
  if (blue) {
    for (let u = 0.4; u < k.w - 0.3; u += 0.3) W.ln(u, 25, u, 49, '#4d7fc0');
    W.quad(0.6, 1.4, 30, 44, '#cfe3ff');
    W.quad(0.7, 1.3, 32, 42, '#2f5f9e');
  } else {
    W.ln(0.4, 46, 1.2, 46, '#5b8def');
    W.ln(0.4, 42, 1.0, 42, '#5b8def');
    W.ln(0.4, 38, 1.4, 38, '#e2553b');
    W.quad(1.6, 1.95, 40, 47, '#f2d06b');
    W.quad(2.05, 2.4, 40, 47, '#ef9ac0');
    W.quad(1.6, 1.95, 30, 37, '#9fe3b8');
  }
  W.quad(0.4, k.w - 0.4, 20, 22, '#9aa0ae');
};

const poster: WallArt = (W, k) => {
  const col = k.color ?? '#e2553b';
  W.panel(0.2, 0.8, 26, 50, '#fbf4e4');
  W.quad(0.3, 0.7, 36, 47, col);
  W.quad(0.38, 0.62, 39, 44, lighten(col, 0.4));
  W.quad(0.3, 0.7, 30, 31, OUT);
};

const clock: WallArt = (W, k) => {
  const [x, y] = W.P(0.5, 44);
  disc(W.c, x, y, 7, OUT, 1);
  disc(W.c, x, y, 6, '#fbfbf7', 1);
  rect(W.c, x, y - 4, 1, 4, OUT);
  const a = k.t * 0.8;
  line(W.c, x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4, '#e2553b');
};

const pinboard: WallArt = (W, k) => {
  W.panel(0.15, k.w - 0.15, 24, 50, '#c89b6d');
  const cols = ['#ef7aa8', '#f2b84b', '#5b8def', '#7bd36b', '#fbf4e4', '#9b7bea'];
  for (let i = 0; i < k.w * 4; i++) {
    const u = 0.3 + hash(i, 1, k.w) * (k.w - 0.7);
    const z = 28 + hash(1, i) * 16;
    W.quad(u, u + 0.22, z, z + 6, cols[i % cols.length]);
    W.dot(u + 0.1, z + 5, '#e2553b');
  }
};

const door: WallArt = (W, k) => {
  const v = k.variant;
  const col = v === 'airlock' ? '#8a93a8' : v === 'secure' ? '#3b4258' : darken(k.th.wallTrim, 0.05);
  W.panel(0.08, k.w - 0.08, 0, 46, darken(col, 0.25));
  W.quad(0.15, k.w - 0.15, 0, 43, col);
  W.quad(k.w / 2 - 0.02, k.w / 2 + 0.02, 0, 43, darken(col, 0.3));
  if (v === 'airlock') {
    for (let u = 0.2; u < k.w - 0.2; u += 0.12) W.quad(u, u + 0.06, 40, 43, '#f3c843');
    W.quad(0.3, 0.7, 22, 32, '#0c1024');
  } else {
    W.quad(0.25, 0.42, 26, 38, lighten(col, 0.25));
    W.quad(0.58, 0.75, 26, 38, lighten(col, 0.25));
    W.dot(0.44, 20, '#f2d06b', 2, 2);
  }
  if (v === 'secure') W.dot(0.85, 24, Math.sin(k.t * 2) > 0 ? '#59e08a' : '#e2553b', 2, 3);
};

const shutter: WallArt = (W, k) => {
  W.panel(0.05, k.w - 0.05, 0, 50, '#9aa0ae');
  for (let z = 3; z < 46; z += 3) W.ln(0.1, z, k.w - 0.1, z, '#7d8394');
  for (let u = 0.1; u < k.w - 0.1; u += 0.25) W.quad(u, u + 0.12, 46, 50, '#f3c843');
  W.quad(0.1, k.w - 0.1, 0, 2, k.th.accent);
};

const pipes: WallArt = (W, k) => {
  W.quad(0, k.w, 44, 49, OUT);
  W.quad(0, k.w, 45, 48, '#9aa4b8');
  W.quad(0, k.w, 34, 38, OUT);
  W.quad(0, k.w, 35, 37, '#c0533f');
  for (let u = 0.5; u < k.w; u += 1.5) W.quad(u, u + 0.12, 43, 50, '#5a6378');
  const [x, y] = W.P(2.5, 28);
  disc(W.c, x, y, 4, OUT, 1);
  disc(W.c, x, y, 3, '#fbfbf7', 1);
  rect(W.c, x + Math.round(Math.sin(k.t * 2) * 1.5), y - 2, 1, 2, '#e2553b');
};

const sign: WallArt = (W) => {
  const [x, y] = W.P(0.5, 40);
  for (let i = 0; i < 9; i++) rect(W.c, x - i / 2 - 1, y - 6 + i, i + 2, 1, OUT);
  for (let i = 1; i < 8; i++) rect(W.c, x - i / 2, y - 6 + i, i + 1, 1, '#f3c843');
  rect(W.c, x, y - 3, 1, 3, OUT);
  rect(W.c, x, y + 1, 1, 1, OUT);
};

const screen: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 20, 56, '#3a3f5a');
  W.quad(0.2, k.w - 0.2, 23, 53, '#0b0e1d');
  const n = Math.floor(k.w * 6);
  for (let i = 0; i < n; i++) {
    const u = 0.3 + (i / n) * (k.w - 0.6);
    const h = 4 + ((Math.sin(k.t * 1.3 + i * 0.7) + 1) / 2) * 16;
    W.quad(u, u + 0.06, 26, 26 + h, i % 3 === 0 ? k.th.accent : '#5b6488');
  }
  W.ln(0.3, 50, 1.2, 50, k.th.accent2);
};

const wallpanel: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 18, 52, '#4b5578');
  for (let u = 0.25; u < k.w - 0.2; u += 0.25)
    for (let z = 22; z < 50; z += 6) W.dot(u, z, Math.sin(k.t * (1 + hash(u * 10, z) * 3) + u * 7 + z) > 0 ? '#5ee0e6' : '#2e3656', 2, 2);
};

const chemshelf: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 22, 58, '#e7ddcb');
  const cols = ['#e2553b', '#5b8def', '#59e08a', '#f3c843', '#b07bf0', '#2fb5c8'];
  for (const z of [24, 36, 48]) {
    W.quad(0.15, k.w - 0.15, z - 1, z, '#a07a55');
    for (let u = 0.25; u < k.w - 0.2; u += 0.2) W.quad(u, u + 0.12, z, z + 5 + Math.floor(hash(u * 10, z) * 4), cols[Math.floor(hash(z, u * 10) * cols.length)]);
  }
};

const backdrop: WallArt = (W, k) => {
  W.quad(0.1, k.w - 0.1, 56, 60, OUT);
  W.quad(0.15, k.w - 0.15, 0, 57, '#f7d9a8');
  W.quad(0.15, 0.25, 0, 57, '#e9c48e');
};

const assetwall: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 18, 56, '#8a5a3c');
  const cols = ['#ef7aa8', '#5b8def', '#f2b84b', '#7bd36b', '#9b7bea', '#fbf4e4'];
  for (const z of [20, 32, 44]) {
    W.quad(0.15, k.w - 0.15, z - 1, z, '#5a3a24');
    for (let u = 0.25; u < k.w - 0.3; u += 0.35) W.quad(u, u + 0.28, z, z + 7, cols[Math.floor(hash(u * 10, z) * cols.length)]);
  }
};

const statusboard: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 24, 54, '#3a3f5a');
  W.quad(0.2, k.w - 0.2, 26, 52, '#0d1220');
  for (let i = 0; i < k.w * 3; i++) {
    const u = 0.3 + i * 0.3;
    if (u > k.w - 0.3) break;
    const h = 4 + ((Math.sin(k.t * 1.5 + i) + 1) / 2) * 16;
    W.quad(u, u + 0.15, 28, 28 + h, i === 4 ? '#f2b84b' : '#59e08a');
  }
};

const cabletray: WallArt = (W, k) => {
  W.quad(0, k.w, 54, 58, OUT);
  W.quad(0, k.w, 55, 57, '#7d8394');
  const cols = ['#5b8def', '#f3c843', '#59e08a', '#e2553b'];
  for (let u = 0.3; u < k.w; u += 0.45) {
    const len = 10 + hash(u * 10, 2) * 16;
    W.ln(u, 54, u, 54 - len, cols[Math.floor(u * 3) % 4]);
  }
};

const pegboard: WallArt = (W, k) => {
  W.panel(0.1, k.w - 0.1, 22, 54, '#c9a77a');
  for (let u = 0.25; u < k.w - 0.15; u += 0.18) for (let z = 26; z < 52; z += 5) W.dot(u, z, '#9c7d55');
  W.quad(0.4, 0.5, 30, 46, '#5a6378');
  W.quad(0.8, 0.95, 34, 48, '#e2553b');
  W.quad(1.4, 1.9, 42, 44, '#9aa4b8');
  W.quad(2.2, 2.35, 30, 46, '#f3c843');
};

const frames: WallArt = (W, k) => {
  const cols = ['#e2553b', '#5b8def', '#3fb68b', '#f2b84b', '#ef9ac0'];
  const n = Math.max(1, Math.round(k.w * 2));
  for (let i = 0; i < n; i++) {
    const u = 0.15 + (i * (k.w - 0.3)) / n;
    const z = 36 + (i % 2) * 6;
    const wdt = 0.3 + (i % 3) * 0.06;
    W.panel(u, u + wdt, z, z + 10 + (i % 2) * 2, cols[(i + Math.round(k.t * 0)) % cols.length], '#5e3c28');
    W.quad(u + 0.06, u + wdt - 0.06, z + 3, z + 6, lighten(cols[i % cols.length], 0.3));
  }
};

const shelfPlant: WallArt = (W, k) => {
  W.quad(0.1, k.w - 0.1, 38, 40, '#8a5a3c');
  W.quad(0.1, k.w - 0.1, 37, 38, '#5e3c28');
  for (let u = 0.25; u < k.w - 0.1; u += 0.45) {
    W.quad(u, u + 0.18, 40, 45, '#c0603f');
    const [x, y] = W.P(u + 0.09, 48);
    disc(W.c, x, y, 3, '#4f9a55');
    disc(W.c, x - 1, y - 1, 1, '#7bc35a');
    rect(W.c, x - 2, y + 2, 1, 4, '#4f9a55');
  }
};

const sconce: WallArt = (W, k) => {
  W.quad(0.4, 0.6, 40, 46, '#2b2236');
  W.quad(0.42, 0.58, 41, 45, '#ffe2a0');
  W.c.globalAlpha = 0.18 + Math.sin(k.t * 2) * 0.03;
  const [x, y] = W.P(0.5, 43);
  disc(W.c, x, y, 9, '#ffe2a0', 1.2);
  W.c.globalAlpha = 1;
};

const hangingPlant: WallArt = (W) => {
  W.ln(0.5, 60, 0.5, 50, '#5e3c28');
  W.quad(0.38, 0.62, 44, 50, '#c0603f');
  const [x, y] = W.P(0.5, 46);
  disc(W.c, x, y, 4, '#4f9a55');
  for (let i = 0; i < 4; i++) rect(W.c, x - 4 + i * 2, y + 2, 1, 4 + (i % 2) * 3, '#5fae5a');
};

export const WALL_ART: Record<string, WallArt> = {
  frames,
  shelfPlant,
  sconce,
  hangingPlant,
  window: windowArt,
  starwindow,
  whiteboard,
  poster,
  clock,
  pinboard,
  moodboard: pinboard,
  door,
  shutter,
  pipes,
  sign,
  screen,
  wallpanel,
  chemshelf,
  backdrop,
  assetwall,
  statusboard,
  cabletray,
  pegboard,
};

function drawWallProp(P: Painter, wp: WallPropPlacement, th: WorldTheme, t: number) {
  const art = WALL_ART[wp.type];
  if (!art) return;
  art(new WallPainter(P, wp.wall, wp.at, wp.w), { w: wp.w, variant: wp.variant, color: wp.color, th, t });
}

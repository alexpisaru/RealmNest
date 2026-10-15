// ─────────────────────────────────────────────────────────────
// 128×64 animals — production sprites for the Farm's ambient life.
//
// Bodies are small volumes shaded per pixel (sun upper-left, dithered
// into a 5–6 tone ramp), with hand-placed details: beaks, combs, eyes,
// ears, patches, wool and feathers. Each kind has idle / move poses and
// most have two variants (by seed). Sprites are cached per pose and side;
// the half-resolution level of detail is the pixel-art-safe 2:1 reduction.
//
// Kinds: chicken (white, brown) · rooster · duck (white, mallard) ·
// cat (ginger tabby, tuxedo) · dog · sheep (white, brown) · cow · frog ·
// butterfly (3) · bird (sparrow, robin)
// ─────────────────────────────────────────────────────────────

import type { CritterPose } from '../critters';
import { bufferToCanvas, downsampleMode, SoftCtx } from '../hd/soft';
import { bayer, ell, fillPoly, hash, ln, outlineLayer, px } from './kit4';

type C = CanvasRenderingContext2D;
type Ramp = readonly string[];

export interface Part {
  x: number;
  y: number;
  rx: number;
  ry: number;
  z: number;
  ramp?: Ramp;
  /** optional per-pixel texture: returns a tone offset */
  tex?: (x: number, y: number) => number;
  /** optional mask: only pixels where it returns true are painted */
  mask?: (x: number, y: number) => boolean;
}

/** Shade a set of ellipsoid parts per pixel (front-most part wins), quantised with dithering. */
export function volume(c: C, parts: Part[], ramp: Ramp, ox: number, oy: number) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    x0 = Math.min(x0, p.x - p.rx);
    x1 = Math.max(x1, p.x + p.rx);
    y0 = Math.min(y0, p.y - p.ry);
    y1 = Math.max(y1, p.y + p.ry);
  }
  for (let y = Math.floor(y0); y <= y1; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      let best: Part | null = null;
      for (const p of parts) {
        const dx = (x + 0.5 - p.x) / p.rx;
        const dy = (y + 0.5 - p.y) / p.ry;
        if (dx * dx + dy * dy <= 1 && (!best || p.z > best.z)) best = p;
      }
      if (!best || (best.mask && !best.mask(x, y))) continue;
      const r = best.ramp ?? ramp;
      const nx = (x + 0.5 - best.x) / best.rx;
      const ny = (y + 0.5 - best.y) / best.ry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = Math.max(0, -nx * 0.5 - ny * 0.62 + nz * 0.55) * 0.95 + 0.1;
      if (best.tex) v += best.tex(x, y);
      const t = v * (r.length - 1) + (bayer(x + ox, y + oy) - 0.5) * 0.6;
      px(c, ox + x, oy + y, r[Math.max(0, Math.min(r.length - 1, Math.round(t)))]);
    }
}

// ── palettes ────────────────────────────────────────────────
const P = {
  white: ['#8a8072', '#b0a492', '#d0c6b4', '#e8e0d0', '#f6f2e8', '#ffffff'],
  brown: ['#4a2a1a', '#6a3c22', '#8a522c', '#a86a38', '#c48a4e', '#dca86a'],
  rooster: ['#4a1e14', '#6e2c1a', '#943e20', '#b8562a', '#d4783a', '#ecA050'],
  tail: ['#101418', '#1a2428', '#223a34', '#2e5240', '#3e6a48', '#5a8a58'],
  comb: ['#7a1414', '#a82020', '#d03428', '#e85a40'],
  beak: ['#a86a18', '#d89428', '#f2b83a', '#fad468'],
  duckWhite: ['#7e8288', '#a8acb0', '#ccced0', '#e6e8e8', '#f6f8f8', '#ffffff'],
  mallardBody: ['#4a4038', '#665a4e', '#857868', '#a49682', '#beb09a', '#d6cab2'],
  mallardHead: ['#0e2a1e', '#163e2a', '#1e5638', '#2a7048', '#3a8c5a', '#5aaa70'],
  ginger: ['#6a2e10', '#8e4216', '#b45c20', '#d4782e', '#e89a48', '#f6bc70'],
  black: ['#141218', '#1e1c24', '#2a2832', '#383642', '#4a4856', '#5e5c6a'],
  shiba: ['#6e3412', '#94481a', '#b86224', '#d47e34', '#e89c50', '#f4ba74'],
  cream: ['#8a7a66', '#ac9a82', '#cab89c', '#e2d2b6', '#f2e6cc', '#fcf4e2'],
  wool: ['#8e887c', '#b2ab9c', '#d0c8b6', '#e6dfcc', '#f4eedd', '#fffaee'],
  woolBrown: ['#3a2a20', '#54402e', '#6e543c', '#8a6a4c', '#a6845e', '#c2a07a'],
  face: ['#141016', '#221c22', '#302830', '#40363e', '#52464e'],
  cow: ['#8a8680', '#b0aca4', '#d0ccc4', '#e6e2da', '#f4f2ec', '#ffffff'],
  frog: ['#1e3a12', '#2e541a', '#3e7024', '#56902e', '#74ae3c', '#9ccc56'],
  sparrow: ['#3a2a20', '#56402e', '#76583e', '#987452', '#b89268', '#d6b488'],
};

// ── per-kind painters (draw facing right; mirrored for left) ─
interface Pose {
  frame: number;
  variant: number;
}
type Painter = (c: C, ox: number, oy: number, s: Pose) => void;

/** Simple two-tone leg with a foot. */
function leg(c: C, x: number, y: number, h: number, col: string, foot: string, fwd = 0) {
  ln(c, x, y - h, x + fwd, y, col);
  px(c, x + fwd - 1, y, foot, 3, 1);
}

const chicken: Painter = (c, ox, oy, s) => {
  const brown = s.variant % 2 === 1;
  const body = brown ? P.brown : P.white;
  const peck = s.frame === 2;
  const step = s.frame === 1;
  // legs first (behind the fluffy body)
  leg(c, ox + 9, oy + 25, 6, P.beak[1], P.beak[2], step ? 1 : 0);
  leg(c, ox + 13, oy + 25, 6, P.beak[0], P.beak[1], step ? -1 : 0);
  const hx = peck ? 21 : 18;
  const hy = peck ? 15 : 7;
  const tail: Part = { x: 4, y: 10, rx: 4, ry: 6.5, z: 0 };
  volume(c, [tail, { x: 11, y: 14, rx: 9, ry: 7, z: 1 }, { x: 16, y: peck ? 14 : 10, rx: 4, ry: 5, z: 2 }, { x: hx, y: hy, rx: 4, ry: 4, z: 3 }], body, ox, oy);
  // wing with feather tips, speckles on the brown hen
  ell(c, ox + 10, oy + 14, 5, 3.2, body[2]);
  for (let i = 0; i < 4; i++) px(c, ox + 6 + i * 2, oy + 16 + (i & 1), body[1], 2, 1);
  if (brown) for (let i = 0; i < 9; i++) px(c, ox + 5 + hash(i, 1) * 12, oy + 10 + hash(i, 2) * 8, body[1]);
  // comb, wattle, beak, eye
  px(c, ox + hx - 2, oy + hy - 6, P.comb[2], 2, 2);
  px(c, ox + hx, oy + hy - 7, P.comb[2], 2, 3);
  px(c, ox + hx + 2, oy + hy - 6, P.comb[1], 2, 2);
  px(c, ox + hx + 3, oy + hy + 1, P.comb[1], 2, 3);
  px(c, ox + hx + 4, oy + hy - 1, P.beak[2], 3, 2);
  px(c, ox + hx + 4, oy + hy, P.beak[0], 2, 1);
  px(c, ox + hx + 1, oy + hy - 2, '#1a1418', 2, 2);
  px(c, ox + hx + 1, oy + hy - 2, '#ffffff');
};

const rooster: Painter = (c, ox, oy, s) => {
  const step = s.frame === 1;
  leg(c, ox + 12, oy + 31, 8, P.beak[1], P.beak[2], step ? 1 : 0);
  leg(c, ox + 16, oy + 31, 8, P.beak[0], P.beak[1], step ? -1 : 0);
  // sweeping sickle tail feathers in iridescent green-black
  for (let i = 0; i < 5; i++) {
    const a = -0.6 - i * 0.28;
    for (let t = 0; t < 14; t++) {
      const r = 6 + t;
      px(c, ox + 9 + Math.cos(a - t * 0.06) * r * -0.8, oy + 15 + Math.sin(a - t * 0.06) * r * 0.9, P.tail[1 + ((i + t) % 4)], 2, 2);
    }
  }
  volume(c, [{ x: 14, y: 19, rx: 10, ry: 8, z: 1 }, { x: 20, y: 13, rx: 5, ry: 7, z: 2 }, { x: 22, y: 7, rx: 4.5, ry: 4.5, z: 3 }], P.rooster, ox, oy);
  ell(c, ox + 13, oy + 20, 6, 3.6, P.tail[3]);
  for (let i = 0; i < 4; i++) px(c, ox + 9 + i * 2, oy + 22 + (i & 1), P.tail[1], 2, 1);
  // big comb and wattles
  for (const [dx, h] of [[-2, 3], [0, 5], [2, 4], [4, 3]]) px(c, ox + 22 + dx, oy + 7 - 4 - h, P.comb[2], 2, h);
  px(c, ox + 25, oy + 9, P.comb[1], 2, 5);
  px(c, ox + 26, oy + 6, P.beak[2], 3, 2);
  px(c, ox + 23, oy + 5, '#1a1418', 2, 2);
  px(c, ox + 23, oy + 5, '#f2c43a');
};

const duck: Painter = (c, ox, oy, s) => {
  const mallard = s.variant % 2 === 1;
  const body = mallard ? P.mallardBody : P.duckWhite;
  const bob = s.frame === 1 ? 1 : 0;
  const y = oy + bob;
  volume(c, [{ x: 4, y: 11, rx: 4, ry: 3, z: 0 }, { x: 12, y: 13, rx: 11, ry: 6, z: 1 }, { x: 19, y: 8, rx: 3.6, ry: 5, z: 2 }, { x: 21, y: 4, rx: 4.5, ry: 4, z: 3, ramp: mallard ? P.mallardHead : body }], body, ox, y);
  if (mallard) {
    px(c, ox + 17, y + 8, '#f6f2e8', 6, 1); // white neck ring
    ell(c, ox + 9, y + 13, 5, 2.5, '#3a5aa8'); // blue speculum on the wing
    px(c, ox + 6, y + 12, '#f6f2e8', 6, 1);
  } else ell(c, ox + 11, y + 13, 6, 3, body[2]);
  px(c, ox + 25, y + 4, P.beak[2], 4, 2);
  px(c, ox + 25, y + 5, P.beak[0], 4, 1);
  px(c, ox + 22, y + 2, '#1a1418', 2, 2);
  px(c, ox + 22, y + 2, '#ffffff');
  // water line ripples
  for (let i = -2; i < 26; i += 3) px(c, ox + i, oy + 18 + (i % 6 === 0 ? 0 : 1), '#cfeaf2', 2, 1);
};

const cat: Painter = (c, ox, oy, s) => {
  const tux = s.variant % 2 === 1;
  const fur = tux ? P.black : P.ginger;
  const walking = s.frame >= 2;
  if (walking) {
    // body horizontal, tail up, legs alternating
    const f = s.frame === 3;
    for (const [lx, d] of [[6, f ? 1 : -1], [10, f ? -1 : 1], [18, f ? -1 : 1], [22, f ? 1 : -1]] as const) {
      ln(c, ox + lx, oy + 16, ox + lx + d, oy + 23, fur[1]);
      px(c, ox + lx + d - 1, oy + 23, tux ? '#f2ece0' : fur[2], 3, 1);
    }
    for (let i = 0; i < 12; i++) px(c, ox + 3 - i * 0.2, oy + 13 - i, fur[2 + (i & 1)], 2, 1);
    volume(c, [{ x: 14, y: 14, rx: 11, ry: 5.5, z: 1 }, { x: 25, y: 9, rx: 5.5, ry: 5, z: 2 }], fur, ox, oy);
  } else {
    // sitting, tail curled around the paws, swishing tip
    const sw = s.frame === 1 ? 1 : 0;
    for (let i = 0; i < 10; i++) px(c, ox + 3 + i, oy + 24 - Math.sin(i * 0.3) * 2 - (i > 7 ? sw : 0), fur[2 + (i & 1)], 2, 2);
    volume(c, [{ x: 10, y: 17, rx: 7.5, ry: 8.5, z: 1 }, { x: 13, y: 7, rx: 6.5, ry: 5.5, z: 2 }], fur, ox, oy);
    px(c, ox + 9, oy + 23, tux ? '#f2ece0' : fur[3], 3, 2);
    px(c, ox + 13, oy + 23, tux ? '#f2ece0' : fur[3], 3, 2);
    if (tux) ell(c, ox + 11, oy + 16, 3, 5, '#f2ece0');
  }
  // ears, stripes, face
  const hx = walking ? 25 : 13;
  const hy = walking ? 9 : 7;
  fillPoly(c, [[ox + hx - 6, oy + hy - 2], [ox + hx - 4, oy + hy - 9], [ox + hx - 1, oy + hy - 4]], fur[2]);
  fillPoly(c, [[ox + hx + 1, oy + hy - 4], [ox + hx + 4, oy + hy - 9], [ox + hx + 6, oy + hy - 2]], fur[1]);
  px(c, ox + hx - 4, oy + hy - 6, '#e8a0a0');
  if (!tux) for (let i = 0; i < 4; i++) px(c, ox + (walking ? 9 + i * 4 : 6 + i * 2), oy + (walking ? 10 : 12 + i * 2), fur[1], walking ? 1 : 3, walking ? 4 : 1);
  if (tux) px(c, ox + hx - 2, oy + hy + 1, '#f2ece0', 5, 3);
  px(c, ox + hx - 3, oy + hy - 1, '#7ac04a', 2, 2);
  px(c, ox + hx + 2, oy + hy - 1, '#7ac04a', 2, 2);
  px(c, ox + hx - 3, oy + hy - 1, '#1a1418');
  px(c, ox + hx + 2, oy + hy - 1, '#1a1418');
  px(c, ox + hx, oy + hy + 1, '#e88a8a', 1, 1);
};

const dog: Painter = (c, ox, oy, s) => {
  const fur = P.shiba;
  const f = s.frame;
  const moving = f >= 1;
  for (const [lx, d] of [[8, f === 1 ? 1 : f === 2 ? -1 : 0], [12, f === 1 ? -1 : f === 2 ? 1 : 0], [21, f === 1 ? -1 : f === 2 ? 1 : 0], [25, f === 1 ? 1 : f === 2 ? -1 : 0]] as const) {
    ln(c, ox + lx, oy + 18, ox + lx + d, oy + 27, fur[2]);
    px(c, ox + lx + d - 1, oy + 27, P.cream[3], 3, 1);
  }
  // curled tail over the back
  for (let i = 0; i < 9; i++) px(c, ox + 6 - Math.cos(i * 0.5) * 3, oy + 10 - Math.sin(i * 0.5) * 4 - (moving && f === 2 ? 1 : 0), i > 5 ? P.cream[3] : fur[3], 3, 2);
  volume(c, [{ x: 16, y: 16, rx: 12, ry: 6.5, z: 1 }, { x: 28, y: 10, rx: 6, ry: 5.5, z: 2 }, { x: 33, y: 12, rx: 3.5, ry: 2.6, z: 3, ramp: P.cream }], fur, ox, oy);
  ell(c, ox + 18, oy + 19, 8, 2.6, P.cream[3]);
  // pointy ears, eye, nose, collar
  fillPoly(c, [[ox + 24, oy + 7], [ox + 25, oy - 1], [ox + 28, oy + 5]], fur[2]);
  fillPoly(c, [[ox + 29, oy + 5], [ox + 32, oy - 1], [ox + 33, oy + 7]], fur[1]);
  px(c, ox + 25, oy + 2, P.cream[2]);
  px(c, ox + 29, oy + 9, '#1a1418', 2, 2);
  px(c, ox + 29, oy + 9, '#ffffff');
  px(c, ox + 36, oy + 11, '#1a1418', 2, 2);
  px(c, ox + 23, oy + 13, '#c8443a', 2, 5);
  px(c, ox + 24, oy + 17, '#f2c43a', 2, 2);
};

const sheep: Painter = (c, ox, oy, s) => {
  const brown = s.variant % 2 === 1;
  const wool = brown ? P.woolBrown : P.wool;
  const graze = s.frame === 1;
  const step = s.frame === 2;
  for (const [lx, d] of [[9, step ? 1 : 0], [13, step ? -1 : 0], [24, step ? -1 : 0], [28, step ? 1 : 0]] as const) {
    ln(c, ox + lx, oy + 22, ox + lx + d, oy + 31, P.face[1], 2);
    px(c, ox + lx + d, oy + 31, P.face[0], 3, 1);
  }
  // woolly body: bumpy clumps texture
  const woolTex = (x: number, y: number) => {
    const cx = Math.floor(x / 4);
    const cy = Math.floor(y / 3.5);
    const fx = x - (cx * 4 + 2);
    const fy = y - (cy * 3.5 + 1.8);
    return (0.6 - Math.hypot(fx, fy) / 3) * 0.35 + (hash(cx, cy, 7) - 0.5) * 0.15;
  };
  volume(c, [{ x: 19, y: 16, rx: 15, ry: 10, z: 1, tex: woolTex }, { x: 10, y: 13, rx: 7, ry: 7, z: 0.5, tex: woolTex }], wool, ox, oy);
  // dark face and ears; head down when grazing
  const hx = graze ? 34 : 35;
  const hy = graze ? 20 : 10;
  volume(c, [{ x: hx, y: hy, rx: 5, ry: 6.5, z: 2 }], P.face, ox, oy);
  ell(c, ox + hx - 3, oy + hy - 6, 4, 3.6, wool[3]); // woolly topknot
  px(c, ox + hx - 7, oy + hy - 2, P.face[2], 4, 2);
  px(c, ox + hx + 4, oy + hy - 2, P.face[1], 4, 2);
  px(c, ox + hx + 1, oy + hy - 1, '#d8c890', 2, 1);
  px(c, ox + hx + 1, oy + hy - 1, '#1a1418');
};

const cow: Painter = (c, ox, oy, s) => {
  // a holstein at its real size next to the sheep: drawn at 1.35× (volumes are shaded per pixel, so it gains detail, not blocks)
  const S = 1.35;
  const X = (v: number) => ox + Math.round(v * S);
  const Y = (v: number) => oy + Math.round(v * S);
  const graze = s.frame === 1;
  const step = s.frame === 2;
  for (const [lx, d] of [[10, step ? 1 : 0], [16, step ? -1 : 0], [38, step ? -1 : 0], [44, step ? 1 : 0]] as const) {
    ln(c, X(lx), Y(30), X(lx + d), Y(44), P.cow[2], 4);
    ln(c, X(lx) - 1, Y(31), X(lx + d) - 1, Y(42), P.cow[4], 1);
    px(c, X(lx + d) - 2, Y(43), P.face[1], 6, 3);
    px(c, X(lx + d) - 2, Y(43), P.face[2], 2, 1);
  }
  // tail with a tuft
  ln(c, X(4), Y(16), X(2), Y(32), P.cow[1], 2);
  px(c, X(1) - 1, Y(32), P.face[1], 4, 6);
  // holstein body: white, then black patches shaded with their own ramp
  const patch = (x: number, y: number) => {
    const u = x / S;
    const v = y / S;
    return Math.sin(u * 0.2 + 1) + Math.sin(v * 0.28 + u * 0.09) + Math.sin(u * 0.07 - v * 0.2) * 0.6 > 1.0;
  };
  const body = { x: 26 * S, y: 22 * S, rx: 23 * S, ry: 12 * S, z: 1 };
  volume(c, [body], P.cow, ox, oy);
  volume(c, [{ ...body, mask: patch }], P.black, ox, oy);
  ell(c, X(30), Y(33), 5 * S, 2.5 * S, '#e8a0a8'); // udder
  px(c, X(29), Y(35), '#c87880', 2, 2);
  px(c, X(32), Y(35), '#c87880', 2, 2);
  const hx = graze ? 50 : 52;
  const hy = graze ? 30 : 14;
  const head = { x: hx * S, y: hy * S, rx: 6.5 * S, ry: 7.5 * S, z: 2 };
  volume(c, [head], P.cow, ox, oy);
  // a black patch over the far eye and ear
  volume(c, [{ ...head, mask: (x: number, y: number) => x < head.x - 2 && y < head.y + 3 }], P.black, ox, oy);
  ell(c, X(hx + 4), Y(hy + 5), 4.5 * S, 3.4 * S, '#e8a0a8'); // muzzle
  px(c, X(hx + 3), Y(hy + 5), '#a85a60', 2, 1);
  px(c, X(hx + 6), Y(hy + 5), '#a85a60', 2, 1);
  px(c, X(hx - 4), Y(hy - 9), '#e8dcc0', 4, 3); // horns
  px(c, X(hx + 3), Y(hy - 9), '#d8ccb0', 4, 3);
  px(c, X(hx - 9), Y(hy - 6), P.cow[2], 6, 4); // ear
  px(c, X(hx - 8), Y(hy - 5), '#e8a0a8', 3, 2);
  px(c, X(hx), Y(hy - 3), '#1a1418', 3, 3); // eye with a catch-light
  px(c, X(hx) + 1, Y(hy - 3), '#ffffff');
  // a brass bell on a strap
  px(c, X(hx - 4), Y(hy + 7), '#6a4a2a', 6, 1);
  ell(c, X(hx - 2), Y(hy + 10), 2.4, 2.6, '#c8962a');
  px(c, X(hx - 3), Y(hy + 9), '#f2d26a');
};

const frog: Painter = (c, ox, oy, s) => {
  volume(c, [{ x: 7, y: 8, rx: 6, ry: 4, z: 1 }, { x: 9, y: 5, rx: 4, ry: 3, z: 2 }], P.frog, ox, oy);
  px(c, ox + 7, oy + 2, P.frog[4], 2, 2);
  px(c, ox + 11, oy + 2, P.frog[3], 2, 2);
  px(c, ox + 8, oy + 3, s.frame === 1 ? P.frog[3] : '#1a1418');
  px(c, ox + 12, oy + 3, s.frame === 1 ? P.frog[2] : '#1a1418');
  px(c, ox + 2, oy + 11, P.frog[2], 4, 1);
  px(c, ox + 10, oy + 11, P.frog[2], 4, 1);
};

const BUTTERFLY = [
  ['#b07a20', '#f2b84b', '#fbe08a'],
  ['#a84a6e', '#ef9ac0', '#fbd6e6'],
  ['#3a6a9a', '#7ab4e6', '#c8e6fa'],
];
const butterfly: Painter = (c, ox, oy, s) => {
  const pal = BUTTERFLY[s.variant % 3];
  const open = s.frame === 0;
  px(c, ox + 5, oy + 2, '#2a2026', 1, 6);
  if (open) {
    ell(c, ox + 2.5, oy + 3, 2.6, 2.2, pal[1]);
    ell(c, ox + 8.5, oy + 3, 2.6, 2.2, pal[1]);
    ell(c, ox + 3, oy + 6.5, 1.8, 1.6, pal[0]);
    ell(c, ox + 8, oy + 6.5, 1.8, 1.6, pal[0]);
    px(c, ox + 2, oy + 2, pal[2]);
    px(c, ox + 9, oy + 2, pal[2]);
  } else {
    ell(c, ox + 4, oy + 3, 1.2, 2.6, pal[1]);
    ell(c, ox + 7, oy + 3, 1.2, 2.6, pal[0]);
  }
};

const bird: Painter = (c, ox, oy, s) => {
  const robin = s.variant % 2 === 1;
  const hop = s.frame === 1 ? -2 : 0;
  ln(c, ox + 6, oy + 10, ox + 6, oy + 13, '#8a6a4a');
  ln(c, ox + 8, oy + 10, ox + 8, oy + 13, '#8a6a4a');
  volume(c, [{ x: 4, y: 7 + hop, rx: 3, ry: 2, z: 0 }, { x: 7, y: 8 + hop, rx: 5, ry: 3.6, z: 1 }, { x: 11, y: 5 + hop, rx: 3, ry: 3, z: 2 }], P.sparrow, ox, oy);
  if (robin) ell(c, ox + 9, oy + 8 + hop, 2.6, 2.4, '#e06a3a');
  px(c, ox + 14, oy + 5 + hop, '#f2b84b', 2, 1);
  px(c, ox + 12, oy + 4 + hop, '#1a1418');
};

/** A city pigeon: plump grey body, iridescent neck, pecking or strutting. */
const pigeon: Painter = (c, ox, oy, s) => {
  const white = s.variant % 3 === 2;
  const peck = s.frame === 1;
  const body: Ramp = white ? ['#8a8a92', '#a8a8b0', '#c4c4cc', '#dcdce2', '#ececf0', '#fafafc'] : ['#2e3038', '#44464f', '#5c5e68', '#757884', '#8e929e', '#a8acb8'];
  // legs
  px(c, ox + 9, oy + 13, '#c86a6a', 1, 3);
  px(c, ox + 12, oy + 13, '#c86a6a', 1, 3);
  // tail, body, wing bars, neck sheen, head (down when pecking)
  volume(c, [{ x: 4, y: 9, rx: 4, ry: 2.2, z: 0 }, { x: 10, y: 9, rx: 6.5, ry: 4.6, z: 1 }], body, ox, oy);
  px(c, ox + 8, oy + 8, body[1], 5, 1);
  px(c, ox + 7, oy + 10, body[1], 5, 1);
  const hx = peck ? 17 : 15;
  const hy = peck ? 11 : 4;
  if (!white) {
    ell(c, ox + 14, oy + (peck ? 9 : 6), 2.6, 2.4, '#4e7a6a');
    px(c, ox + 13, oy + (peck ? 8 : 5), '#8a5a8e', 2, 2);
  }
  volume(c, [{ x: hx, y: hy, rx: 2.8, ry: 2.6, z: 2 }], body, ox, oy);
  px(c, ox + hx + 2, oy + hy, '#d8c8a8', 2, 1);
  px(c, ox + hx, oy + hy - 1, '#e86a2a');
};

const KINDS: Record<string, { paint: Painter; w: number; h: number; ax: number; ay: number; frames: number; variants: number }> = {
  pigeon: { paint: pigeon, w: 22, h: 18, ax: 10, ay: 15, frames: 2, variants: 3 },
  chicken: { paint: chicken, w: 30, h: 30, ax: 12, ay: 26, frames: 3, variants: 2 },
  rooster: { paint: rooster, w: 34, h: 36, ax: 15, ay: 32, frames: 2, variants: 1 },
  duck: { paint: duck, w: 32, h: 22, ax: 13, ay: 18, frames: 2, variants: 2 },
  cat: { paint: cat, w: 34, h: 30, ax: 13, ay: 25, frames: 4, variants: 2 },
  dog: { paint: dog, w: 42, h: 32, ax: 18, ay: 28, frames: 3, variants: 1 },
  sheep: { paint: sheep, w: 44, h: 36, ax: 20, ay: 32, frames: 3, variants: 2 },
  cow: { paint: cow, w: 88, h: 64, ax: 38, ay: 61, frames: 3, variants: 1 },
  frog: { paint: frog, w: 16, h: 14, ax: 8, ay: 12, frames: 2, variants: 1 },
  butterfly: { paint: butterfly, w: 12, h: 10, ax: 6, ay: 9, frames: 2, variants: 3 },
  bird: { paint: bird, w: 18, h: 16, ax: 7, ay: 14, frames: 2, variants: 2 },
};

const cache = new Map<string, { cv: HTMLCanvasElement; ax: number; ay: number }>();

/**
 * A critter kind a world pack brings along (see WorldPack.critters): its painter
 * draws the sprite facing right at (ox, oy) inside a w×h box; (ax, ay) is the
 * foot point. frameOf picks the pose frame from the motion state.
 */
export interface CritterArt {
  paint: (c: CanvasRenderingContext2D, ox: number, oy: number, s: { frame: number; variant: number }) => void;
  w: number;
  h: number;
  ax: number;
  ay: number;
  frames: number;
  variants: number;
  /** wander speed (tiles per second-ish, default 0.1) */
  speed?: number;
  /** flies at height z (no ground shadow) */
  fly?: boolean;
  frameOf?: (p: CritterPose) => number;
}

/** Sprite for one animal pose (cached). `art` is a pack's own kind. */
export function animalSprite(kind: string, variant: number, frame: number, right: boolean, lod: boolean, art?: CritterArt) {
  const K = art ?? KINDS[kind] ?? KINDS.chicken;
  const v = variant % K.variants;
  const f = frame % K.frames;
  const key = `${art ? 'pack:' : ''}${kind}|${v}|${f}|${right ? 1 : 0}|${lod ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // even-sized buffer so the half-resolution copy aligns
  const W = K.w + 4 + ((K.w + 4) & 1);
  const H = K.h + 4 + ((K.h + 4) & 1);
  const s = new SoftCtx(W, H);
  K.paint(s.asContext(), 2, 2, { frame: f, variant: v });
  outlineLayer(s, 0.7);
  let data = s.data;
  if (!right) {
    const m = new Uint32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + (W - 1 - x)] = data[y * W + x];
    data = m;
  }
  const ax0 = right ? K.ax + 2 : W - 1 - (K.ax + 2);
  const ay0 = K.ay + 2;
  const out = lod ? { cv: bufferToCanvas(downsampleMode(data, W, H), W / 2, H / 2), ax: Math.round(ax0 / 2), ay: Math.round(ay0 / 2) } : { cv: bufferToCanvas(data, W, H), ax: ax0, ay: ay0 };
  cache.set(key, out);
  return out;
}

/** Frame for a pose from the critter's motion state. */
function frameFor(p: CritterPose): number {
  switch (p.kind) {
    case 'chicken':
      return p.moving ? (Math.sin(p.phase * 2) > 0 ? 1 : 0) : Math.sin(p.phase) > 0.45 ? 2 : 0;
    case 'rooster':
      return p.moving && Math.sin(p.phase * 2) > 0 ? 1 : 0;
    case 'duck':
      return Math.sin(p.phase * 0.5) > 0 ? 1 : 0;
    case 'cat':
      return p.moving ? (Math.sin(p.phase * 2) > 0 ? 2 : 3) : Math.sin(p.phase * 0.4) > 0.3 ? 1 : 0;
    case 'dog':
      return p.moving ? (Math.sin(p.phase * 2.4) > 0 ? 1 : 2) : 0;
    case 'sheep':
    case 'cow':
      return p.moving ? 2 : Math.sin(p.phase * 0.15 + p.seed) > -0.2 ? 1 : 0;
    case 'frog':
      return Math.sin(p.phase * 0.7) > 0.92 ? 1 : 0;
    case 'butterfly':
      return Math.sin(p.phase) > 0 ? 0 : 1;
    case 'bird':
      return p.moving && Math.sin(p.phase * 2) > 0 ? 1 : 0;
    case 'pigeon':
      return p.moving ? (Math.sin(p.phase * 2.4) > 0.6 ? 1 : 0) : Math.sin(p.phase * 0.9 + p.seed) > 0.2 ? 1 : 0;
    default:
      return 0;
  }
}

/** Draw a critter at screen foot position (sx, sy); `lod` = half-resolution frame; `art` = a pack's own kind. */
export function drawAnimal(c: CanvasRenderingContext2D, p: CritterPose, sx: number, sy: number, lod: boolean, art?: CritterArt) {
  const s = lod ? 0.5 : 1;
  const fly = art ? !!art.fly : p.kind === 'butterfly' || p.kind === 'bird';
  const lift = fly ? p.z * 4 * s : 0;
  if (!fly) {
    // soft contact shadow toward the lower right
    const K = art ?? KINDS[p.kind] ?? KINDS.chicken;
    c.globalAlpha = 0.24;
    c.fillStyle = '#2a1a2a';
    const rx = Math.round(K.w * 0.42 * s);
    const ry = Math.max(1, Math.round(K.w * 0.12 * s));
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.5)));
      c.fillRect(Math.round(sx + 3 * s - w), Math.round(sy + dy), w * 2, 1);
    }
    c.globalAlpha = 1;
  }
  const spr = animalSprite(p.kind, p.seed, art?.frameOf ? art.frameOf(p) : frameFor(p), p.right, lod, art);
  c.drawImage(spr.cv, Math.round(sx - spr.ax), Math.round(sy - spr.ay - lift));
}

export const ANIMAL_KINDS = Object.keys(KINDS);
/** Hand-drawn variants per animal kind. */
export const ANIMAL_VARIANTS: Record<string, number> = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.variants]));

// ─────────────────────────────────────────────────────────────
// Ground materials, shaded per pixel.
//
// Every material picks from a small hand-tuned palette (4–6 tones) and
// quantises noise with ordered (Bayer) dithering, so the result stays
// "pixel art" — no smooth gradients, no anti-aliasing.
// Colours are packed 0xRRGGBB.
// ─────────────────────────────────────────────────────────────

import type { MaterialId } from '../domain/world';

export type Packed = number;

export const pack = (hex: string): Packed => parseInt(hex.slice(1), 16);
const pal = (...hex: string[]) => hex.map(pack);

export function h2(i: number, j: number, s = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s);
  const b = h2(xi + 1, yi, s);
  const c = h2(xi, yi + 1, s);
  const d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const dith = (px: number, py: number) => BAYER[((py & 3) << 2) | (px & 3)];

/** Quantise 0..1 into n steps with ordered dithering. */
const q = (v: number, n: number, px: number, py: number) => {
  const i = Math.floor(v * n + dith(px, py) - 0.5);
  return i < 0 ? 0 : i >= n ? n - 1 : i;
};
const clampI = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

/** Context handed to shaders. `at` reads the material of a neighbouring tile. */
export interface ShadeCtx {
  at: (ix: number, iy: number) => MaterialId;
}

type Shader = (x: number, y: number, px: number, py: number, c: ShadeCtx) => Packed;

// ── palettes ────────────────────────────────────────────────

const GRASS = pal('#4a8338', '#579443', '#64a24c', '#72b055', '#84bf60', '#97cc6d');
const MEADOW = pal('#5b8a3a', '#689842', '#76a64a', '#85b252', '#97bf5d', '#a8c968');
const FLOWERS = pal('#fbf4e4', '#f2d06b', '#ef9ac0', '#c49cf2', '#ffffff');
const STONE = pal('#9c6c52', '#ab7a5e', '#ba886a', '#c89776', '#d4a585', '#dfb493');
const GROUT = pack('#7e5a47');
const MOSS = pal('#5f7f3c', '#6f8f45', '#80a04f');
const COBBLE = pal('#6f7480', '#7d828d', '#8b909a', '#9a9fa8', '#a9adb5');
const DIRT = pal('#94693f', '#a27649', '#b08453', '#bd925e', '#c9a06a');
const SOIL = pal('#4f3322', '#5c3d28', '#6a4730', '#785237', '#86603f');
const WATER = pal('#2b5f9a', '#3470ad', '#3e80bf', '#4b91cd', '#62a6da');
const FOAM = pack('#d8eefc');
const WOOD = pal('#6c472d', '#7f5536', '#92643f', '#a37249', '#b48254', '#c39262');
const PLANKS = pal('#a77c55', '#b6895f', '#c4976a', '#d0a476', '#dbb183');
const CARPET = pal('#2a2f47', '#30364f', '#373e59', '#3f4763');
const CONCRETE = pal('#767880', '#808289', '#8a8c93', '#94969d', '#9fa1a8');
const LAB = pal('#cdd6da', '#d8e0e3', '#e3e9ec', '#edf2f4', '#f6f9fa');
const TILE = pal('#c9b69a', '#d4c2a6', '#dfcdb2', '#e8d8bf');
const METAL = pal('#29304a', '#313a56', '#3a4462', '#45506f', '#525e7e');
const RAISED = pal('#3f4658', '#474e61', '#50576b', '#5a6276');
const ASPHALT = pal('#33363e', '#393c45', '#40434c', '#474a53');
const SIDEWALK = pal('#9ea2a8', '#aaaeb4', '#b6babf', '#c2c6ca');
const SAND = pal('#cfb47f', '#d9c08e', '#e3cc9b', '#ecd7a8');
const GRAVEL = pal('#9a917f', '#a69d8c', '#b5ac9a', '#c4bba8', '#d2cab8');
const DECK = pal('#7e5234', '#8c5d3c', '#9a6a45', '#a87752', '#b5845e');
const HULL = pal('#31374d', '#383f57', '#414962', '#4b546d');
const SPACE = pal('#04050d', '#070916', '#0b0e20', '#11152b');
const FOREST = pal('#2f5426', '#38602b', '#426c30', '#4d7a36', '#5a883d', '#6a9846');

// ── shaders ─────────────────────────────────────────────────

const grassLike =
  (P: Packed[], flowerChance: number, seed: number): Shader =>
  (x, y, px, py) => {
    const n = vnoise(x * 0.42, y * 0.42, seed) * 0.6 + vnoise(x * 1.6, y * 1.6, seed + 1) * 0.4;
    let i = q(n * 0.9 + 0.08, P.length, px, py);
    const t = h2(px, py, seed + 3);
    if (t < 0.045 || h2(px, py + 1, seed + 3) < 0.045) i = clampI(i - 2, P.length);
    else if (t > 0.988) i = clampI(i + 1, P.length);
    if (flowerChance > 0 && h2(px >> 1, py >> 1, seed + 9) < flowerChance && vnoise(x * 0.8, y * 0.8, seed + 5) > 0.6)
      return FLOWERS[Math.floor(h2(px >> 1, py >> 1, seed + 10) * FLOWERS.length)];
    return P[i];
  };

const paving: Shader = (x, y, px, py) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  const r = Math.floor(v * 2);
  const fv = v * 2 - r;
  const su = u * 2 + ((iy * 2 + r) & 1) * 0.5;
  const c = Math.floor(su);
  const fu = su - c;
  const sid = h2(ix * 2 + c, iy * 2 + r, 5);
  if (fu < 0.07 || fv < 0.1) {
    if (h2(ix * 2 + c, iy * 2 + r, 7) < 0.3 && vnoise(x * 2.5, y * 2.5, 4) > 0.5) return MOSS[q(vnoise(x * 6, y * 6, 2), 3, px, py)];
    return GROUT;
  }
  let i = 1 + Math.floor(sid * 3.2) + (vnoise(x * 3, y * 3, 6) > 0.62 ? 1 : 0);
  if (fv < 0.24) i++;
  if (fu > 0.88 || fv > 0.92) i--;
  if (h2(px, py, 8) < 0.05) i--;
  if (h2(px, py, 11) < 0.0025) return pack(h2(px, py, 12) > 0.5 ? '#d08a3a' : '#7fa04f');
  return STONE[clampI(i, STONE.length)];
};

const cobble: Shader = (x, y, px, py) => {
  const ix = Math.floor(x * 3);
  const iy = Math.floor(y * 3);
  const u = x * 3 - ix;
  const v = y * 3 - iy;
  if (u < 0.12 || v < 0.16) return pack('#555963');
  let i = 1 + Math.floor(h2(ix, iy, 14) * 3);
  if (v < 0.35) i++;
  if (h2(px, py, 15) < 0.06) i--;
  return COBBLE[clampI(i, COBBLE.length)];
};

const dirt: Shader = (x, y, px, py) => {
  let i = q(vnoise(x * 0.9, y * 0.9, 3) * 0.8 + 0.1, DIRT.length, px, py);
  const h = h2(px, py, 4);
  if (h < 0.025) i = clampI(i + 2, DIRT.length);
  else if (h > 0.975) i = clampI(i - 2, DIRT.length);
  return DIRT[i];
};

const soil: Shader = (x, y, px, py) => {
  const f = (y * 3) % 1;
  let i = q(vnoise(x * 1.4, y * 1.4, 16) * 0.7 + 0.15, SOIL.length, px, py);
  if (f < 0.35) i = clampI(i - 2, SOIL.length);
  else if (f > 0.75) i = clampI(i + 1, SOIL.length);
  if (h2(px, py, 17) < 0.03) i = clampI(i + 1, SOIL.length);
  return SOIL[i];
};

const water: Shader = (x, y, px, py, c) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  const shore =
    (u < 0.1 && c.at(ix - 1, iy) !== 'water') ||
    (v < 0.1 && c.at(ix, iy - 1) !== 'water') ||
    (u > 0.92 && c.at(ix + 1, iy) !== 'water') ||
    (v > 0.92 && c.at(ix, iy + 1) !== 'water');
  if (shore) return FOAM;
  const n = vnoise(x * 0.35, y * 0.35, 18);
  let i = q(n * 0.55 + 0.2, WATER.length - 1, px, py);
  // short wave crests: little horizontal dashes scattered by noise
  const crest = vnoise(x * 2.2, y * 4.4, 19);
  if (crest > 0.8 && ((px >> 1) + (py >> 2)) % 5 !== 0) i = WATER.length - 1;
  else if (crest > 0.72) i = Math.min(WATER.length - 2, i + 1);
  return WATER[i];
};

function planksAlongX(P: Packed[], per: number, seed: number): Shader {
  return (x, y, px, py) => {
    const iy = Math.floor(y);
    const v = y - iy;
    const pr = Math.floor(v * per);
    const fv = v * per - pr;
    const row = iy * per + pr;
    const su = x + h2(row, 0, seed);
    const seg = Math.floor(su);
    const fu = su - seg;
    if (fv > 0.84 || fu < 0.025) return P[0];
    let i = 1 + Math.floor(h2(seg, row, seed + 1) * (P.length - 2));
    if (Math.sin(fu * 37 + h2(seg, row, seed + 2) * 20 + fv * 3) > 0.9) i--;
    if (fv < 0.18) i++;
    if (h2(px, py, seed + 3) < 0.03) i--;
    return P[clampI(i, P.length)];
  };
}

function planksAlongY(P: Packed[], per: number, seed: number): Shader {
  const s = planksAlongX(P, per, seed);
  return (x, y, px, py, c) => s(y, x, px, py, c);
}

const carpet: Shader = (x, y, px, py) => {
  let i = q(vnoise(x * 1.2, y * 1.2, 19) * 0.6 + 0.2, CARPET.length, px, py);
  if (h2(px, py, 20) < 0.08) i = clampI(i + 1, CARPET.length);
  return CARPET[i];
};

const concrete: Shader = (x, y, px, py) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if ((ix % 3 === 0 && x - ix < 0.03) || (iy % 3 === 0 && y - iy < 0.05)) return pack('#6a6c73');
  let i = q(vnoise(x * 0.7, y * 0.7, 22) * 0.7 + 0.15, CONCRETE.length, px, py);
  if (vnoise(x * 0.25, y * 0.25, 23) < 0.22) i = clampI(i - 1, CONCRETE.length);
  if (h2(px, py, 24) < 0.05) i = clampI(i + (h2(px, py, 25) > 0.5 ? 1 : -1), CONCRETE.length);
  return CONCRETE[i];
};

const smallTiles =
  (P: Packed[], per: number, grout: Packed): Shader =>
  (x, y, px, py) => {
    const sx = x * per;
    const sy = y * per;
    const u = sx - Math.floor(sx);
    const v = sy - Math.floor(sy);
    if (u < 0.06 || v < 0.1) return grout;
    let i = 1 + Math.floor(h2(Math.floor(sx), Math.floor(sy), 26) * (P.length - 2));
    if (v < 0.25) i++;
    if (u > 0.92) i--;
    if (h2(px, py, 27) < 0.03) i--;
    return P[clampI(i, P.length)];
  };

const metal: Shader = (x, y, px, py) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  if (u < 0.03 || v < 0.05) return METAL[0];
  if (u > 0.97 || v > 0.95) return METAL[4];
  for (const [a, b] of [[0.12, 0.14], [0.88, 0.14], [0.12, 0.86], [0.88, 0.86]]) if (Math.abs(u - a) < 0.035 && Math.abs(v - b) < 0.07) return METAL[4];
  let i = 2 + ((ix + iy) & 1);
  if (((px + py * 2) & 7) === 0) i++;
  if (vnoise(x * 0.5, y * 0.5, 28) < 0.3) i--;
  return METAL[clampI(i, METAL.length)];
};

const raised: Shader = (x, y, px, py) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  if (u < 0.04 || v < 0.07) return RAISED[0];
  if ((ix * 3 + iy) % 5 === 0 && (Math.floor(u * 6) + Math.floor(v * 6)) % 2 === 0 && ((px + py) & 1)) return RAISED[0];
  let i = 2;
  if (v < 0.2) i++;
  if (h2(px, py, 29) < 0.05) i--;
  return RAISED[clampI(i, RAISED.length)];
};

const asphalt: Shader = (x, y, px, py) => {
  let i = q(vnoise(x * 0.6, y * 0.6, 30) * 0.5 + 0.25, ASPHALT.length, px, py);
  if (h2(px, py, 31) < 0.06) i = clampI(i + 1, ASPHALT.length);
  return ASPHALT[i];
};

const sidewalk: Shader = (x, y, px, py) => {
  const u = x - Math.floor(x);
  const v = y - Math.floor(y);
  if (u < 0.04 || v < 0.07) return pack('#8a8e94');
  let i = 1 + Math.floor(h2(Math.floor(x), Math.floor(y), 32) * 2);
  if (v < 0.2) i++;
  if (h2(px, py, 33) < 0.04) i--;
  return SIDEWALK[clampI(i, SIDEWALK.length)];
};

const noisy =
  (P: Packed[], scale: number, seed: number, grit = 0.08): Shader =>
  (x, y, px, py) => {
    let i = q(vnoise(x * scale, y * scale, seed) * 0.7 + 0.15, P.length, px, py);
    const h = h2(px, py, seed + 1);
    if (h < grit) i = clampI(i + 1, P.length);
    else if (h > 1 - grit) i = clampI(i - 1, P.length);
    return P[i];
  };

const hull: Shader = (x, y, px, py) => {
  const ix = Math.floor(x / 2);
  const iy = Math.floor(y / 2);
  const u = x / 2 - ix;
  const v = y / 2 - iy;
  if (u < 0.02 || v < 0.03) return HULL[0];
  let i = 1 + ((ix + iy) & 1);
  if (v < 0.1) i++;
  if (h2(px, py, 34) < 0.03) i--;
  return HULL[clampI(i, HULL.length)];
};

const space: Shader = (x, y, px, py) => {
  const s = h2(px, py, 35);
  if (s < 0.0022) return pack(s < 0.0007 ? '#ffffff' : '#9fb0ff');
  const n = vnoise(x * 0.12, y * 0.12, 36);
  if (n > 0.72 && h2(px, py, 37) < (n - 0.72) * 2) return pack('#2a1f4a');
  return SPACE[q(vnoise(x * 0.3, y * 0.3, 38) * 0.6, SPACE.length, px, py)];
};

const hazard: Shader = (x, y) => (((x + y) * 3) % 1 < 0.5 ? pack('#f3c843') : pack('#2b2236'));

const grate: Shader = (_x, y, px) => ((y * 5) % 1 < 0.35 ? pack('#22283a') : (px & 3) === 0 ? pack('#3b4258') : pack('#2f3546'));

const roof: Shader = (x, y, px, py) => {
  const r = Math.floor(y * 3);
  const su = x * 3 + (r & 1) * 0.5;
  const fu = su - Math.floor(su);
  const fv = y * 3 - r;
  if (fv > 0.8) return pack('#2f5a4a');
  return pack(fu < 0.08 ? '#356a56' : fv < 0.3 ? '#4f8f72' : h2(px, py, 39) < 0.05 ? '#3d7a60' : '#447f66');
};

export const SHADERS: Record<MaterialId, Shader> = {
  grass: grassLike(GRASS, 0.006, 40),
  meadow: grassLike(MEADOW, 0.014, 50),
  paving,
  cobble,
  dirt,
  soil,
  water,
  wood: planksAlongX(WOOD, 4, 60),
  planks: planksAlongX(PLANKS, 3, 70),
  carpet,
  concrete,
  lab: smallTiles(LAB, 2, pack('#bfc9ce')),
  tile: smallTiles(TILE, 1, pack('#a8977c')),
  metal,
  raised,
  asphalt,
  sidewalk,
  sand: noisy(SAND, 0.8, 80),
  gravel: noisy(GRAVEL, 3, 90, 0.25),
  deck: planksAlongY(DECK, 3, 100),
  hull,
  space,
  hazard,
  grate,
  roof,
  forest: grassLike(FOREST, 0.003, 120),
};

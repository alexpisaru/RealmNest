// ─────────────────────────────────────────────────────────────
// 64×96 characters for 128×64 worlds.
//
// The crew system is unchanged: the same profile + outfit layers compose
// the figure's silhouette (shared with the 32×48 composer), which is
// enlarged with Scale2x (rounded diagonals, no blocky stairs) and then
// refined at native resolution: redrawn eyes (iris, pupil, catch-light,
// lashes), brows, mouth and nose; hair strands and sheen; fabric folds and
// weave; rim light on the sunny edges; a 1-px selective outline.
// The half-resolution level of detail is the hand-tuned 32×48 sprite.
// ─────────────────────────────────────────────────────────────

import { darken, lighten, mix } from '../color';
import { composeRaw, getSpriteHD } from '../hd/spritesHD';
import { lookKey, type Look, type Pose } from '../sprites';
import { composeTemplate, halveTemplate } from './peopleTemplate';

/** The character canvas: the hand-drawn figures stand 112 px tall on it (src/render/hd4/peopleTemplate.ts). */
export const PERSON_W = 80;
export const PERSON_H = 128;
export const PERSON_FOOT_X = 40;
export const PERSON_FOOT_Y = 120;
/** the composed figures below are 64×96 (feet at 32, 90), placed on the canvas feet to feet */
const OLD_W = 64;
const OLD_H = 96;
const OLD_DX = PERSON_FOOT_X - 32;
const OLD_DY = PERSON_FOOT_Y - 90;

const OUTL = '#3b2a26';
type Grid = (string | null)[];

function scale2x(src: Grid, w: number, h: number): Grid {
  const W = w * 2;
  const out: Grid = new Array(W * h * 2).fill(null);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : src[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      let e0 = P;
      let e1 = P;
      let e2 = P;
      let e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      const o = y * 2 * W + x * 2;
      out[o] = e0;
      out[o + 1] = e1;
      out[o + W] = e2;
      out[o + W + 1] = e3;
    }
  return out;
}

function hash(a: number, b: number, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function compose64(look: Look, pose: Pose): Grid {
  const r = composeRaw(look, pose);
  const W = OLD_W;
  const H = OLD_H;
  const g = scale2x(r.px, r.w, r.h);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : g[y * W + x]);
  const set = (x: number, y: number, c: string | null) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = c;
  };
  const hairSet = new Set(r.hair);
  const skinSet = new Set(r.skin);
  const topSet = new Set(r.top);
  const pantsSet = new Set(r.pants);

  // ── hair: strands and a sheen band ─────────────────────────
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (!c || !hairSet.has(c)) continue;
      const strand = hash(x + Math.floor(y / 5), 1, 7) < 0.16;
      if (strand && c !== r.hair[0]) set(x, y, darken(c, 0.16));
      const top = r.hy * 2;
      if (y > top - 4 && y < top + 4 && x < r.cx * 2 + 2 && x > r.cx * 2 - 12 && (x + y) % 3 !== 0) set(x, y, lighten(c, 0.22));
    }

  // ── fabric: weave speckle and folds at waist, elbows and knees ─
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (!c) continue;
      const isTop = topSet.has(c);
      const isPants = pantsSet.has(c);
      if (!isTop && !isPants) continue;
      if (hash(x, y, 11) < 0.07) set(x, y, darken(c, 0.07));
      const waist = (r.hip - 3) * 2;
      if (isTop && (y === waist || y === waist - 5) && hash(x, y, 13) < 0.55) set(x, y, darken(c, 0.14));
      if (isPants && (y === r.hip * 2 + 16 || y === r.hip * 2 + 17) && hash(x >> 1, 3, 17) < 0.5) set(x, y, darken(c, 0.12));
    }

  // ── face: native eyes, brows, nose and mouth ───────────────
  if (!r.back) {
    const hy = r.hy;
    const cx = r.cx + r.turn;
    const ey = (hy + 5) * 2;
    const skin = r.skin[2];
    const shade = r.skin[1];
    const eyeL = (cx - 4 + r.turn) * 2;
    const eyeR = (cx + 1 + r.turn) * 2;
    // clear the enlarged features back to skin
    for (const ex of [eyeL, eyeR]) for (let y = ey - 4; y < ey + 6; y++) for (let x = ex - 1; x < ex + 5; x++) if (at(x, y) && !hairSet.has(at(x, y)!)) set(x, y, skin);
    const deep = darken(r.eye, 0.45);
    const blink = pose.blink;
    for (const ex of [eyeL, eyeR]) {
      if (blink) {
        for (let i = 0; i < 4; i++) set(ex + i, ey + 2, deep);
        set(ex - 1, ey + 1, deep);
        continue;
      }
      // upper lid / lashes
      for (let i = 0; i < 4; i++) set(ex + i, ey - 1, mix(r.hair[0], OUTL, 0.5));
      if (r.fem) set(ex + (ex === eyeL ? -1 : 4), ey - 2, OUTL);
      // iris with pupil and catch-light
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) set(ex + i, ey + j, j === 3 ? darken(r.eye, 0.2) : r.eye);
      set(ex + 1, ey + 1, deep);
      set(ex + 2, ey + 1, deep);
      set(ex + 1, ey + 2, deep);
      set(ex + 2, ey + 2, deep);
      set(ex + 1, ey, '#ffffff');
      set(ex + 3, ey + 3, lighten(r.eye, 0.25));
      // lower lid shade
      for (let i = 0; i < 4; i++) set(ex + i, ey + 4, shade);
    }
    // brows
    const browC = r.fem ? mix(r.hair[1], skin, 0.25) : r.hair[1];
    if (!r.profile.glasses)
      for (const ex of [eyeL, eyeR]) {
        set(ex - 1, ey - 3, browC);
        for (let i = 0; i < 4; i++) set(ex + i, ey - 4, browC);
        if (!r.fem) for (let i = 0; i < 4; i++) set(ex + i, ey - 3, browC);
      }
    // nose: a soft shadow on the shaded side, a highlight on the bridge
    const nx = cx * 2 + r.turn;
    set(nx + 1, ey + 5, shade);
    set(nx + 1, ey + 6, shade);
    set(nx, ey + 6, mix(skin, shade, 0.5));
    set(nx - 1, ey + 4, lighten(skin, 0.1));
    // mouth: a small smile (talk frames open it)
    const my = ey + 9;
    const mx = cx * 2 - 2 + r.turn * 2;
    const talking = pose.mode === 'talk' && pose.frame % 2 === 1;
    for (let y = my - 1; y <= my + 2; y++) for (let x = mx - 2; x <= mx + 6; x++) if (at(x, y) && skinSet.has(at(x, y)!)) set(x, y, skin);
    const lip = r.fem ? '#b4505a' : darken(shade, 0.22);
    if (talking) {
      for (let x = mx; x < mx + 5; x++) set(x, my, '#5a2226');
      for (let x = mx + 1; x < mx + 4; x++) set(x, my + 1, '#d86a6a');
    } else {
      for (let x = mx + 1; x < mx + 4; x++) set(x, my, lip);
      set(mx, my - 1, mix(skin, lip, 0.5));
      set(mx + 4, my - 1, mix(skin, lip, 0.5));
    }
    // cheeks
    for (const bx of [eyeL - 1, eyeR + 2]) {
      set(bx, ey + 6, r.blush);
      set(bx + 1, ey + 6, mix(skin, r.blush, 0.5));
    }
    if (r.profile.freckles) for (const [dx, dy] of [[0, 6], [2, 7], [5, 6], [8, 7], [10, 6]]) set(eyeL + dx, ey + dy, '#c4704a');
    // glasses: thin native frames around each eye and a bridge
    if (r.profile.glasses) {
      const gc = r.profile.glasses === 'round' ? '#a87a36' : '#5a4a5e';
      for (const ex of [eyeL, eyeR]) {
        for (let x = ex - 2; x <= ex + 5; x++) {
          if (r.profile.glasses === 'round' && (x === ex - 2 || x === ex + 5)) continue;
          set(x, ey - 2, gc);
          set(x, ey + 5, gc);
        }
        for (let y = ey - 1; y <= ey + 4; y++) {
          set(ex - 2, y, gc);
          set(ex + 5, y, gc);
        }
        set(ex + 4, ey - 1, '#ffffff');
      }
      for (let x = eyeL + 6; x < eyeR - 2; x++) set(x, ey, gc);
    }
  }

  // ── rim light on the sunny (upper-left) edges, shade on the right ─
  const src = g.slice();
  const sat = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : src[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = sat(x, y);
      if (!c) continue;
      if (!sat(x - 1, y) || !sat(x, y - 1)) set(x, y, lighten(c, 0.1));
      else if (!sat(x + 1, y)) set(x, y, darken(c, 0.1));
    }

  // ── 1-px selective outline ─────────────────────────────────
  const src2 = g.slice();
  const s2 = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : src2[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (s2(x, y)) continue;
      const up = s2(x, y - 1);
      const sd = s2(x - 1, y) ?? s2(x + 1, y);
      const dn = s2(x, y + 1);
      const base = up ?? sd ?? dn;
      if (!base) continue;
      set(x, y, mix(base, OUTL, up ? 0.8 : sd ? 0.72 : 0.62));
    }

  if (r.mirrored) {
    const m: Grid = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + (W - 1 - x)] = g[y * W + x];
    return m;
  }
  return g;
}

const cache = new Map<string, HTMLCanvasElement>();

/** 64×96 sprite (or the 32×48 sprite for the half-resolution level of detail). */
export function getPerson(look: Look, pose: Pose, lod = false): HTMLCanvasElement {
  const art = look.profile.art;
  const key = `${lookKey(look)}|${pose.dir}|${pose.mode}|${pose.frame}|${pose.blink ? 1 : 0}|${lod ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = lod ? PERSON_W / 2 : PERSON_W;
    cv.height = lod ? PERSON_H / 2 : PERSON_H;
    const ctx = cv.getContext('2d')!;
    // walk frames run 0..7; the composed figures draw a 4-frame cycle
    const p4 = pose.mode === 'walk' ? { ...pose, frame: pose.frame >> 1 } : pose;
    if (lod && !art) ctx.drawImage(getSpriteHD(look, p4), OLD_DX / 2, OLD_DY / 2);
    else {
      const full = art ? composeTemplate(pose) : compose64(look, p4);
      const fw = art ? PERSON_W : OLD_W;
      const g = lod ? halveTemplate(full) : full;
      const gw = lod ? PERSON_W / 2 : fw;
      const ox = art ? 0 : OLD_DX;
      const oy = art ? 0 : OLD_DY;
      g.forEach((c, i) => {
        if (!c) return;
        ctx.fillStyle = c;
        ctx.fillRect(ox + (i % gw), oy + Math.floor(i / gw), 1, 1);
      });
    }
    if (cache.size > 3000) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}

// ─────────────────────────────────────────────────────────────
// Procedural sprite composer:  BASE BODY + HAIR + OUTFIT + ACCESSORY
//
// Each sprite is a 20×30 pixel buffer (design grid 16×26 with a margin
// for big hair and hats), outlined automatically and cached per
// look × direction × pose × frame. Swapping hair, outfit or accessory is
// just a different cache key. Hand-drawn sheets can replace this later
// through src/render/assets.ts without touching the engine.
//
// Isometric facings: se/sw = 3/4 front, ne/nw = 3/4 back (west = mirror).
// 's' / 'n' are straight front/back, used for portraits.
// ─────────────────────────────────────────────────────────────

import type { VisualProfile } from '../domain/character';
import type { OutfitLayers } from '../domain/outfit';
import { outfitLayers } from '../data/outfits';
import { SKIN_TONES } from '../data/presets';
import { darken, lighten, mix } from './color';

export const SPRITE_W = 20;
export const SPRITE_H = 30;
/** feet (bottom row of the shoes) inside the sprite canvas */
export const SPRITE_FOOT_X = 10;
export const SPRITE_FOOT_Y = 28;
const OX = 2;
const OY = 4;

export type SpriteDir = 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';
export type PoseMode = 'stand' | 'walk' | 'work' | 'talk';
export interface Pose {
  dir: SpriteDir;
  mode: PoseMode;
  frame: number;
  blink?: boolean;
  /** on a seat (sofa, armchair, bench): a character with a sitting sheet uses it */
  sit?: boolean;
}

export interface Look {
  profile: VisualProfile;
  outfitId: string;
  outfitVariant?: string;
  signature: string;
}

const OUTLINE = '#2b2236';

class PixelBuf {
  px: (string | null)[] = new Array(SPRITE_W * SPRITE_H).fill(null);
  set(x: number, y: number, c: string | null) {
    x += OX;
    y += OY;
    if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) return;
    this.px[y * SPRITE_W + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string | null) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Selective outline: each edge pixel is a deep shade of the colour it borders (darker underneath). */
  outline() {
    const src = [...this.px];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H ? null : src[y * SPRITE_W + x]);
    for (let y = 0; y < SPRITE_H; y++)
      for (let x = 0; x < SPRITE_W; x++) {
        if (at(x, y)) continue;
        const up = at(x, y - 1);
        const side = at(x - 1, y) ?? at(x + 1, y);
        const down = at(x, y + 1);
        const base = up ?? side ?? down;
        if (!base) continue;
        const k = up ? 0.78 : side ? 0.68 : 0.58;
        this.px[y * SPRITE_W + x] = mix(base, OUTLINE, k);
      }
  }
  mirror() {
    const out = new PixelBuf();
    for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) out.px[y * SPRITE_W + (SPRITE_W - 1 - x)] = this.px[y * SPRITE_W + x];
    return out;
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = SPRITE_W;
    cv.height = SPRITE_H;
    const ctx = cv.getContext('2d')!;
    this.px.forEach((c, i) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(i % SPRITE_W, Math.floor(i / SPRITE_W), 1, 1);
    });
    return cv;
  }
}

// ── resolved paint ───────────────────────────────────────────

interface Paint {
  p: VisualProfile;
  o: OutfitLayers;
  sig: string;
  skin: { base: string; shade: string; blush: string; hi: string };
  hc: string;
  hs: string;
  hl: string;
  eye: string;
  accent: string;
  top: string;
  topS: string;
  sleeve: string;
  sleeveS: string;
  pants: string;
  pantsS: string;
  shoes: string;
  hand: string;
  L: number;
  W: number;
  ty: number;
  th: number;
  hy: number;
}

const res = (c: string | undefined, sig: string) => (c === 'signature' ? sig : c);

function paintFor(look: Look): Paint {
  const p = look.profile;
  const o = outfitLayers(look.outfitId, look.outfitVariant);
  const sig = look.signature;
  const s = SKIN_TONES[p.skin];
  const top = res(o.top, sig)!;
  const coat = res(o.coat, sig);
  const pants = res(o.overalls, sig) ?? res(o.pants, sig)!;
  const build = { slim: [5, 6], regular: [4, 8], broad: [3, 10] }[p.build];
  const ty = { tall: 15, regular: 16, short: 17 }[p.height];
  return {
    p,
    o,
    sig,
    skin: { ...s, hi: lighten(s.base, 0.25) },
    hc: p.hairColor,
    hs: darken(p.hairColor, 0.3),
    hl: lighten(p.hairColor, 0.3),
    eye: p.eyeColor,
    accent: p.hairAccent ?? sig,
    top,
    topS: darken(top, 0.2),
    sleeve: coat ?? top,
    sleeveS: darken(coat ?? top, 0.2),
    pants,
    pantsS: darken(pants, 0.22),
    shoes: res(o.shoes, sig)!,
    hand: res(o.gloves, sig) ?? s.base,
    L: build[0],
    W: build[1],
    ty,
    th: 20 - ty,
    hy: ty - 9,
  };
}

// ── body ─────────────────────────────────────────────────────

function legs(b: PixelBuf, p: Paint, dy: number, liftL: boolean, liftR: boolean, back: boolean) {
  const { L, W, o } = p;
  const lw = W >= 10 ? 3 : 2;
  const inset = W >= 8 ? 1 : 0;
  const xl = L + inset;
  const xr = L + W - inset - lw;
  const hip = 20 + dy;
  const skirt = res(o.skirt, p.sig);
  const boots = res(o.boots, p.sig);
  b.rect(L, hip, W, 1, skirt ?? p.pants);
  const leg = (x: number, lift: boolean) => {
    const bottom = lift ? 21 : 22;
    const legCol = skirt ? p.skin.base : p.pants;
    b.rect(x, hip + 1, lw, bottom - hip, legCol);
    if (!skirt) b.set(x + lw - 1, bottom, p.pantsS);
    if (boots) b.rect(x, bottom - 1, lw, 2, boots);
    b.rect(x, bottom + 1, lw, 1, p.shoes);
  };
  leg(xl, liftL);
  leg(xr, liftR);
  if (skirt) {
    b.rect(L - 1, hip, W + 2, 2, skirt);
    b.rect(L - 1, hip + 1, W + 2, 1, darken(skirt, 0.15));
  }
  const coat = res(o.coat, p.sig);
  if (coat && o.longCoat) {
    if (back) b.rect(L, hip, W, 2, coat);
    else {
      b.rect(L, hip, 2, 2, coat);
      b.rect(L + W - 2, hip, 2, 2, darken(coat, 0.08));
    }
  }
  const apron = res(o.apron, p.sig);
  if (apron && !back) b.rect(L + 1, hip, W - 2, 2, apron);
}

function torso(b: PixelBuf, p: Paint, dy: number, back: boolean, turn: number) {
  const { L, W, th, o } = p;
  const ty = p.ty + dy;
  const cx = 7 + turn;
  b.rect(L, ty, W, th, p.top);
  b.rect(L + W - 1, ty, 1, th, p.topS);
  if (!back) b.rect(L, ty, 1, th, lighten(p.top, 0.12));
  b.set(L + Math.floor(W / 2), ty + th - 1, darken(p.top, 0.12));
  if (p.p.body === 'fem' && th >= 4) {
    b.set(L, ty + th - 2, null);
    b.set(L + W - 1, ty + th - 2, null);
  }
  const stripe = res(o.stripe, p.sig);
  if (stripe) b.rect(L, ty + 1, W, 1, stripe), th >= 4 && b.rect(L, ty + 3, W, 1, stripe);

  const ov = res(o.overalls, p.sig);
  if (ov) {
    if (back) {
      b.rect(L + 1, ty, 1, th, ov);
      b.rect(L + W - 2, ty, 1, th, ov);
    } else {
      b.rect(L + 2, ty + 1, W - 4, th - 1, ov);
      b.set(L + 1, ty, ov);
      b.set(L + W - 2, ty, ov);
      b.set(L + 2, ty + 1, lighten(ov, 0.5));
      b.set(L + W - 3, ty + 1, lighten(ov, 0.5));
    }
  }
  const sus = res(o.suspenders, p.sig);
  if (sus) {
    b.rect(L + 1, ty, 1, th, sus);
    b.rect(L + W - 2, ty, 1, th, sus);
  }
  const apron = res(o.apron, p.sig);
  if (apron && !back) {
    b.rect(L + 1, ty + 1, W - 2, th - 1, apron);
    b.set(L + 1, ty, apron);
    b.set(L + W - 2, ty, apron);
    b.set(cx, ty + th - 2, darken(apron, 0.2));
  }
  const coat = res(o.coat, p.sig);
  if (coat) {
    if (back) {
      b.rect(L, ty, W, th, coat);
      b.rect(L + W - 1, ty, 1, th, darken(coat, 0.1));
    } else {
      b.rect(L, ty, cx - L, th, coat);
      b.rect(cx + 2, ty, L + W - cx - 2, th, coat);
      b.rect(L + W - 1, ty, 1, th, darken(coat, 0.1));
      b.set(cx - 1, ty + 1, darken(coat, 0.12));
      b.set(cx + 2, ty + 1, darken(coat, 0.12));
    }
  }
  if (o.vest) {
    const vc = res(o.vest.color, p.sig)!;
    const vs = res(o.vest.stripe, p.sig)!;
    if (back) {
      b.rect(L, ty, W, th, vc);
      b.rect(L, ty + th - 2, W, 1, vs);
    } else {
      b.rect(L, ty, 2, th, vc);
      b.rect(L + W - 2, ty, 2, th, vc);
      b.rect(L, ty + th - 2, 2, 1, vs);
      b.rect(L + W - 2, ty + th - 2, 2, 1, vs);
    }
  }
  const nc = res(o.neckColor, p.sig);
  switch (o.neck) {
    case 'collar':
      if (back) b.rect(cx - 1, ty, 4, 1, nc ?? p.topS);
      else {
        b.set(cx - 1, ty, nc ?? '#fff');
        b.set(cx + 2, ty, nc ?? '#fff');
        b.set(cx, ty, p.skin.shade);
        b.set(cx + 1, ty, p.skin.shade);
      }
      break;
    case 'tie':
      if (!back) {
        b.set(cx - 1, ty, '#f4f1ea');
        b.set(cx + 2, ty, '#f4f1ea');
        b.rect(cx, ty, 2, th - 1, nc ?? '#c33');
        b.set(cx + 1, ty + 1, darken(nc ?? '#c33', 0.2));
      }
      break;
    case 'hood':
      if (back) b.rect(L + 1, ty, W - 2, 2, p.topS);
      else {
        b.rect(L + 1, ty, W - 2, 1, p.topS);
        b.set(cx, ty, p.skin.shade);
        b.set(cx + 1, ty, p.skin.shade);
        const cord = lighten(p.top, 0.55);
        b.rect(cx, ty + 1, 1, 2, cord);
        b.rect(cx + 1, ty + 1, 1, 2, cord);
      }
      break;
    case 'ring':
      b.rect(L, ty, W, 1, nc ?? '#999');
      break;
    case 'vneck':
      if (!back) b.set(cx, ty, p.skin.base), b.set(cx + 1, ty, p.skin.base);
      break;
    case 'turtle':
      b.rect(cx - 1, ty, 4, 1, lighten(p.top, 0.15));
      break;
    case 'scarf':
      b.rect(L, ty, W, 1, nc ?? p.sig);
      if (!back) b.rect(cx + 1, ty + 1, 1, 3, nc ?? p.sig), b.set(cx + 1, ty + 3, darken(nc ?? p.sig, 0.2));
      break;
  }
  if (p.p.accessory === 'scarf' && o.neck !== 'scarf') {
    b.rect(L, ty, W, 1, p.sig);
    if (!back) b.rect(cx, ty + 1, 1, 2, p.sig);
  }
  const belt = res(o.belt, p.sig);
  if (belt) {
    b.rect(L, 20 + dy, W, 1, belt);
    if (!back) b.rect(cx, 20 + dy, 2, 1, lighten(belt, 0.45));
  }
  const patch = res(o.patch, p.sig);
  if (patch && !back) b.set(L + 1, ty + 1, patch);
  const badge = res(o.badge, p.sig);
  if (badge && !back) b.set(L + W - 3, ty + 1, badge);
}

function arms(b: PixelBuf, p: Paint, dy: number, pose: Pose, back: boolean) {
  const { L, W, th } = p;
  const ty = p.ty + dy;
  let raiseL = 0;
  let raiseR = 0;
  let reach = false;
  if (pose.mode === 'walk') {
    if (pose.frame === 1) raiseL = 1;
    if (pose.frame === 3) raiseR = 1;
  } else if (pose.mode === 'work') {
    reach = true;
    raiseL = pose.frame % 2 === 0 ? 2 : 1;
    raiseR = pose.frame % 2 === 0 ? 1 : 2;
  }
  const arm = (x: number, raise: number, inward: number) => {
    const len = th - raise;
    b.rect(x, ty, 1, len, p.sleeve);
    if (reach) {
      if (!back) b.set(x + inward, ty + len, p.hand);
    } else b.set(x, ty + len, p.hand);
  };
  arm(L - 1, raiseL, 1);
  arm(L + W, raiseR, -1);
  b.set(L + W, ty, p.sleeveS);
  const patch = res(p.o.patch, p.sig);
  if (patch) b.set(L - 1, ty + 1, patch);
}

// ── head & face ──────────────────────────────────────────────

function headFront(b: PixelBuf, p: Paint, dy: number, pose: Pose, turn: number) {
  const s = p.skin;
  const hy = p.hy + dy;
  const pr = p.p;
  b.rect(5, hy, 6, 1, s.base);
  b.rect(4, hy + 1, 8, 7, s.base);
  b.rect(5, hy + 8, 6, 1, s.shade);
  b.set(4, hy + 7, null);
  b.set(11, hy + 7, null);
  b.set(11, hy + 6, s.shade);
  // ears (the far ear hides when turned)
  if (turn <= 0) b.rect(12, hy + 4, 1, 2, s.shade);
  b.rect(3, hy + 4, 1, 2, s.base);
  // big, soft 2x2 eyes with a catch-light
  const ex = 5 + turn;
  const ex2 = 9 + turn;
  const deep = darken(p.eye, 0.35);
  if (pose.blink) {
    b.rect(ex, hy + 5, 2, 1, deep);
    b.rect(ex2, hy + 5, 2, 1, deep);
  } else {
    for (const e of [ex, ex2]) {
      b.rect(e, hy + 4, 2, 2, p.eye);
      b.set(e + 1, hy + 5, deep);
      b.set(e, hy + 4, '#fffaf2');
    }
    if (pr.body === 'fem') {
      b.set(ex - 1, hy + 4, deep);
      b.set(ex2 + 2, hy + 4, deep);
    }
  }
  // brows
  if (!pr.glasses) {
    const bc = pr.body === 'fem' ? mix(p.hs, s.base, 0.25) : p.hs;
    b.rect(ex, hy + 3, 2, 1, bc);
    b.rect(ex2, hy + 3, 2, 1, bc);
  }
  if (turn > 0) b.set(ex2 + 2, hy + 6, s.shade); // nose hint on the turned side
  // cheeks
  if (pr.freckles) {
    b.set(ex, hy + 6, '#c4704a');
    b.set(ex + 1, hy + 7, '#c4704a');
    b.set(ex2 + 1, hy + 6, '#c4704a');
  } else {
    b.set(ex, hy + 6, s.blush);
    b.set(ex2 + 1, hy + 6, s.blush);
  }
  // mouth: a small smile
  const talking = pose.mode === 'talk' && pose.frame % 2 === 1;
  const mx = 7 + turn;
  const lip = pr.body === 'fem' ? '#b4505a' : darken(s.shade, 0.25);
  if (talking) b.rect(mx, hy + 7, 2, 1, '#7a2e30');
  else {
    b.rect(mx, hy + 7, 2, 1, lip);
    b.set(mx - 1, hy + 6, mix(s.base, lip, 0.35));
    b.set(mx + 2, hy + 6, mix(s.base, lip, 0.35));
  }

  if (pr.facialHair === 'beard') {
    b.rect(4, hy + 5, 1, 2, p.hc);
    b.rect(11, hy + 5, 1, 2, p.hc);
    b.rect(4, hy + 6, 8, 2, p.hc);
    b.rect(5, hy + 8, 6, 1, p.hs);
    b.set(4, hy + 7, p.hs);
    b.set(11, hy + 7, p.hs);
    b.rect(mx, hy + 7, 2, 1, talking ? '#7a2e30' : s.shade);
  } else if (pr.facialHair === 'mustache') {
    b.rect(mx - 1, hy + 6, 4, 1, p.hc);
  } else if (pr.facialHair === 'stubble') {
    for (const [x, y] of [[5, 7], [7, 8], [9, 8], [10, 7]]) b.set(x, hy + y, mix(s.base, p.hc, 0.4));
  }
  if (pr.earring) {
    b.set(3, hy + 6, pr.earring);
    if (turn <= 0) b.set(12, hy + 6, pr.earring);
  }
  if (pr.glasses) {
    const g = pr.glasses === 'round' ? '#b98a3e' : '#2f2a3a';
    for (const lx of [ex - 1, ex2 - 1]) {
      for (let i = 0; i < 4; i++) {
        b.set(lx + i, hy + 3, g);
        b.set(lx + i, hy + 6, g);
      }
      b.rect(lx, hy + 4, 1, 2, g);
      b.rect(lx + 3, hy + 4, 1, 2, g);
      if (pr.glasses === 'round') {
        b.set(lx, hy + 3, s.base);
        b.set(lx + 3, hy + 3, s.base);
        b.set(lx, hy + 6, s.base);
        b.set(lx + 3, hy + 6, s.base);
      }
    }
  }
}

function headBack(b: PixelBuf, p: Paint, dy: number, turn: number) {
  const s = p.skin;
  const hy = p.hy + dy;
  b.rect(5, hy, 6, 1, s.base);
  b.rect(4, hy + 1, 8, 7, s.shade);
  b.rect(5, hy + 8, 6, 1, s.shade);
  b.rect(3, hy + 4, 1, 2, s.shade);
  b.rect(12, hy + 4, 1, 2, s.shade);
  if (p.p.facialHair === 'beard') {
    b.rect(4, hy + 6, 1, 2, p.hc);
    b.rect(11, hy + 6, 1, 2, p.hc);
  }
  if (turn > 0) {
    // a glimpse of cheek and ear on the turned side
    b.rect(11, hy + 5, 2, 2, s.base);
    b.set(12, hy + 4, s.base);
  }
}

// ── hair ─────────────────────────────────────────────────────

function cap(b: PixelBuf, p: Paint, hy: number) {
  b.rect(4, hy - 1, 8, 1, p.hc);
  b.rect(3, hy, 10, 2, p.hc);
  b.set(3, hy + 2, p.hs);
  b.set(12, hy + 2, p.hs);
  b.rect(5, hy - 1, 2, 1, p.hl);
  b.set(5, hy, p.hl);
}

function hairFront(b: PixelBuf, p: Paint, dy: number, turn: number) {
  const hy = p.hy + dy;
  const { hc, hs, hl } = p;
  switch (p.p.hair) {
    case 'mane': {
      // voluminous, wavy, messy — the founder's look
      b.rect(3, hy - 3, 10, 1, hc);
      b.rect(2, hy - 2, 12, 3, hc);
      b.rect(1, hy - 1, 14, 2, hc);
      for (const [x, y] of [[4, -4], [7, -5], [8, -4], [10, -4], [12, -3], [2, -3], [0, -1], [15, -1], [14, -2]]) b.set(x, hy + y, hc);
      b.rect(1, hy + 1, 3, 5, hc);
      b.rect(12, hy + 1, 3, 5, hc);
      b.set(1, hy + 6, hc);
      b.set(2, hy + 7, hs);
      b.set(14, hy + 6, hc);
      b.set(13, hy + 7, hs);
      // fringe strands with gaps
      for (const [x, y] of [[4, 1], [5, 1], [5, 2], [6, 1], [8, 1], [9, 1], [10, 1], [10, 2], [11, 1], [4, 2], [11, 3]]) b.set(x + (x > 7 ? turn : 0), hy + y, hc);
      // shading strands + highlights
      for (const [x, y] of [[3, -1], [6, -2], [9, -1], [12, 0], [2, 3], [13, 3], [5, 0], [10, 0], [7, 1], [2, 5], [13, 5]]) b.set(x, hy + y, hs);
      for (const [x, y] of [[5, -3], [6, -3], [8, -3], [4, -2], [11, -2], [9, -2]]) b.set(x, hy + y, hl);
      break;
    }
    case 'crew':
      cap(b, p, hy);
      b.set(4, hy + 2, hs);
      b.set(11, hy + 2, hs);
      break;
    case 'tousled':
      cap(b, p, hy);
      for (const x of [5, 8, 9]) b.set(x, hy - 2, hc);
      b.set(12, hy - 1, hc);
      b.rect(4, hy + 2, 3, 1, hc);
      b.rect(9, hy + 2, 3, 1, hc);
      b.rect(3, hy + 2, 1, 4, hc);
      b.rect(12, hy + 2, 1, 4, hc);
      b.set(8, hy - 2, hl);
      break;
    case 'spiky':
      cap(b, p, hy);
      for (const [x, y] of [[4, -2], [6, -2], [6, -3], [8, -2], [9, -3], [9, -2], [11, -2], [3, -1], [12, -1]]) b.set(x, hy + y, hc);
      b.set(6, hy - 3, hl);
      b.set(9, hy - 3, hl);
      for (const x of [5, 7, 10]) b.set(x, hy + 2, hc);
      break;
    case 'shaved': {
      const fuzz = mix(p.skin.base, hc, 0.35);
      b.rect(5, hy, 6, 1, fuzz);
      b.set(4, hy + 1, fuzz);
      b.set(11, hy + 1, fuzz);
      b.set(6, hy, mix(p.skin.hi, hc, 0.2));
      break;
    }
    case 'bun':
      cap(b, p, hy);
      b.rect(6, hy - 4, 4, 3, hc);
      b.set(6, hy - 4, null);
      b.set(9, hy - 4, null);
      b.set(7, hy - 4, hl);
      b.rect(7, hy - 1, 2, 1, p.accent);
      b.rect(4, hy + 2, 4, 1, hc);
      b.rect(3, hy + 2, 1, 2, hc);
      b.rect(12, hy + 2, 1, 2, hc);
      break;
    case 'curly':
      b.rect(3, hy - 2, 10, 1, hc);
      b.rect(2, hy - 1, 12, 3, hc);
      b.rect(2, hy + 2, 2, 4, hc);
      b.rect(12, hy + 2, 2, 4, hc);
      for (const x of [4, 5, 7, 8, 10, 11]) b.set(x, hy + 2, hc);
      for (const [x, y] of [[4, -1], [7, 0], [10, -1], [5, 1], [9, 1], [2, 3], [13, 4], [12, 0], [3, 1]]) b.set(x, hy + y, hs);
      b.set(6, hy - 2, hl);
      b.set(9, hy - 1, hl);
      break;
    case 'afro':
      b.rect(3, hy - 5, 10, 1, hc);
      b.rect(2, hy - 4, 12, 1, hc);
      b.rect(1, hy - 3, 14, 6, hc);
      b.rect(1, hy + 3, 3, 3, hc);
      b.rect(12, hy + 3, 3, 3, hc);
      b.set(1, hy - 3, null);
      b.set(14, hy - 3, null);
      for (let i = 0; i < 14; i++) b.set(1 + i, hy + 2, i > 2 && i < 11 ? (i % 2 ? hc : null) : hc);
      for (const [x, y] of [[3, -2], [6, -3], [9, -2], [12, -1], [4, 0], [8, 0], [11, 1], [2, 4], [13, 4], [5, -4]]) b.set(x, hy + y, hs);
      b.set(6, hy - 4, hl);
      b.set(10, hy - 3, hl);
      break;
    case 'ponytail':
      cap(b, p, hy);
      b.rect(4, hy + 2, 2, 1, hc);
      b.rect(9, hy + 2, 3, 1, hc);
      b.set(11, hy + 3, hc);
      b.rect(3, hy + 2, 1, 2, hc);
      b.rect(12, hy + 2, 1, 2, hc);
      b.rect(13, hy + 1, 1, 6, hc);
      b.set(13, hy + 6, hs);
      b.set(13, hy + 1, p.accent);
      break;
    case 'undercut': {
      const side = mix(p.skin.base, hc, 0.45);
      b.rect(4, hy - 2, 6, 1, hc);
      b.rect(3, hy - 1, 10, 2, hc);
      b.rect(6, hy + 1, 7, 1, hc);
      b.rect(11, hy + 2, 2, 1, hc);
      b.set(12, hy + 3, hc);
      b.rect(3, hy + 1, 1, 3, side);
      b.set(4, hy + 1, side);
      b.rect(6, hy - 1, 3, 1, hl);
      b.set(10, hy + 1, hs);
      break;
    }
    case 'bob':
      cap(b, p, hy);
      b.rect(4, hy + 2, 8, 1, hc);
      b.rect(2, hy + 1, 2, 7, hc);
      b.rect(12, hy + 1, 2, 7, hc);
      b.rect(2, hy + 7, 2, 1, hs);
      b.rect(12, hy + 7, 2, 1, hs);
      b.set(7, hy + 2, hs);
      break;
    case 'long':
      cap(b, p, hy);
      b.rect(5, hy + 2, 2, 1, hc);
      b.rect(9, hy + 2, 3, 1, hc);
      for (let y = 1; y <= 11; y++) {
        b.rect(2, hy + y, 2, 1, y % 3 === 0 ? hs : hc);
        b.rect(12, hy + y, 2, 1, y % 3 === 1 ? hs : hc);
      }
      b.set(2, hy + 11, hs);
      b.set(13, hy + 11, hs);
      break;
    case 'braids':
      cap(b, p, hy);
      b.set(7, hy - 1, hs);
      b.set(7, hy, hs);
      b.set(4, hy + 2, hc);
      b.set(11, hy + 2, hc);
      for (let y = 1; y <= 10; y++) {
        const c1 = y % 2 ? hc : hs;
        const c2 = y % 2 ? hs : hc;
        b.set(2, hy + y, c1);
        b.set(3, hy + y, c2);
        b.set(12, hy + y, c2);
        b.set(13, hy + y, c1);
      }
      b.rect(2, hy + 11, 2, 1, p.accent);
      b.rect(12, hy + 11, 2, 1, p.accent);
      break;
  }
}

function hairBack(b: PixelBuf, p: Paint, dy: number) {
  const hy = p.hy + dy;
  const { hc, hs, hl } = p;
  const base = () => {
    b.rect(4, hy - 1, 8, 1, hc);
    b.rect(3, hy, 10, 6, hc);
    b.rect(3, hy + 5, 10, 1, hs);
    b.rect(5, hy - 1, 2, 1, hl);
  };
  switch (p.p.hair) {
    case 'mane':
      b.rect(3, hy - 3, 10, 1, hc);
      b.rect(2, hy - 2, 12, 2, hc);
      b.rect(1, hy, 14, 7, hc);
      for (const [x, y] of [[4, -4], [7, -5], [8, -4], [10, -4], [12, -3], [2, -3], [0, 0], [15, 0]]) b.set(x, hy + y, hc);
      for (const x of [2, 4, 7, 9, 12, 14]) b.set(x, hy + 7, hc);
      for (const [x, y] of [[5, -1], [8, 0], [11, -1], [4, 2], [9, 3], [12, 2], [6, 4], [3, 5], [10, 5], [7, 6]]) b.set(x, hy + y, hs);
      for (const [x, y] of [[6, -3], [9, -2], [5, -2]]) b.set(x, hy + y, hl);
      break;
    case 'crew':
    case 'spiky':
    case 'undercut':
      base();
      if (p.p.hair === 'spiky') for (const [x, y] of [[4, -2], [6, -3], [6, -2], [9, -3], [9, -2], [11, -2]]) b.set(x, hy + y, hc);
      if (p.p.hair === 'undercut') b.rect(3, hy + 3, 10, 3, mix(p.skin.base, hc, 0.45));
      break;
    case 'tousled':
      base();
      b.rect(3, hy + 6, 10, 1, hc);
      for (const x of [5, 8, 9]) b.set(x, hy - 2, hc);
      break;
    case 'shaved': {
      const fuzz = mix(p.skin.base, hc, 0.35);
      b.rect(5, hy, 6, 1, fuzz);
      b.rect(4, hy + 1, 8, 5, fuzz);
      break;
    }
    case 'bun':
      base();
      b.rect(6, hy - 4, 4, 3, hc);
      b.set(6, hy - 4, null);
      b.set(9, hy - 4, null);
      b.rect(6, hy - 1, 4, 1, p.accent);
      break;
    case 'ponytail':
      base();
      b.rect(7, hy + 5, 2, 6, hc);
      b.rect(7, hy + 5, 2, 1, p.accent);
      b.set(8, hy + 10, hs);
      break;
    case 'curly':
      b.rect(3, hy - 2, 10, 1, hc);
      b.rect(2, hy - 1, 12, 7, hc);
      b.rect(3, hy + 6, 10, 1, hs);
      for (const [x, y] of [[4, 0], [7, 1], [10, 0], [5, 3], [9, 3], [3, 4], [12, 4]]) b.set(x, hy + y, hs);
      break;
    case 'afro':
      b.rect(3, hy - 5, 10, 1, hc);
      b.rect(2, hy - 4, 12, 1, hc);
      b.rect(1, hy - 3, 14, 10, hc);
      b.set(1, hy - 3, null);
      b.set(14, hy - 3, null);
      for (const [x, y] of [[3, -2], [6, -3], [9, -1], [12, 0], [4, 2], [8, 3], [11, 4], [5, 5], [10, 6]]) b.set(x, hy + y, hs);
      break;
    case 'bob':
      b.rect(4, hy - 1, 8, 1, hc);
      b.rect(3, hy, 10, 1, hc);
      b.rect(2, hy + 1, 12, 7, hc);
      b.rect(2, hy + 7, 12, 1, hs);
      b.rect(5, hy - 1, 2, 1, hl);
      break;
    case 'long':
      base();
      b.rect(3, hy + 5, 10, 7, hc);
      for (let y = 6; y < 12; y += 2) b.rect(5 + (y % 4), hy + y, 1, 2, hs);
      b.rect(3, hy + 11, 10, 1, hs);
      break;
    case 'braids':
      base();
      for (let y = 5; y <= 11; y++) for (let x = 3; x <= 12; x++) b.set(x, hy + y, (x + y) % 2 ? hc : hs);
      for (const x of [3, 6, 9, 12]) b.set(x, hy + 12, p.accent);
      break;
  }
}

// ── headgear & accessories ───────────────────────────────────

function headgear(b: PixelBuf, p: Paint, dy: number, back: boolean) {
  const kind = p.o.headgear;
  if (!kind) return;
  const hy = p.hy + dy;
  const c = res(p.o.headgearColor, p.sig) ?? '#888';
  const cs = darken(c, 0.22);
  const ch = lighten(c, 0.35);
  // big hair pokes out under most hats
  switch (kind) {
    case 'hardhat':
      b.rect(4, hy - 2, 8, 1, c);
      b.rect(3, hy - 1, 10, 2, c);
      b.rect(2, hy + 1, 12, 1, cs);
      b.rect(7, hy - 2, 2, 3, ch);
      break;
    case 'strawhat':
      b.rect(4, hy - 3, 8, 3, c);
      b.rect(4, hy - 1, 8, 1, '#b6492f');
      b.rect(0, hy, 16, 1, c);
      b.rect(1, hy + 1, 14, 1, cs);
      b.set(6, hy - 3, ch);
      break;
    case 'cap':
      b.rect(4, hy - 1, 8, 2, c);
      b.rect(3, hy, 10, 1, c);
      if (back) b.rect(7, hy + 1, 2, 1, cs);
      else b.rect(4, hy + 1, 8, 1, cs), b.set(7, hy, ch);
      break;
    case 'hairnet':
      b.rect(4, hy - 2, 8, 1, c);
      b.rect(3, hy - 1, 10, 3, c);
      b.rect(3, hy + 1, 10, 1, ch);
      break;
    case 'beanie':
      b.rect(4, hy - 2, 8, 1, c);
      b.rect(3, hy - 1, 10, 3, c);
      b.rect(3, hy + 1, 10, 1, cs);
      b.set(7, hy - 3, ch);
      b.set(8, hy - 3, ch);
      break;
    case 'raincap':
      b.rect(4, hy - 2, 8, 1, c);
      b.rect(3, hy - 1, 10, 3, c);
      b.rect(1, hy + 1, 14, 1, cs);
      b.rect(2, hy + 2, 2, 4, c);
      b.rect(12, hy + 2, 2, 4, c);
      break;
    case 'beret':
      b.rect(3, hy - 2, 9, 2, c);
      b.rect(4, hy - 3, 6, 1, c);
      b.set(7, hy - 4, cs);
      break;
    case 'bandana':
      b.rect(3, hy - 1, 10, 2, c);
      b.set(5, hy, ch);
      b.set(9, hy - 1, ch);
      if (back) b.rect(7, hy + 1, 2, 2, cs);
      break;
    case 'visor':
      b.rect(3, hy - 1, 10, 1, c);
      if (!back) b.rect(4, hy + 3, 8, 2, '#9fe3e0'), b.rect(4, hy + 3, 8, 1, '#d8fbff');
      b.rect(2, hy + 3, 1, 2, c);
      b.rect(13, hy + 3, 1, 2, c);
      break;
    case 'headset':
      b.rect(5, hy - 2, 6, 1, c);
      b.set(4, hy - 1, c);
      b.set(11, hy - 1, c);
      b.rect(2, hy + 3, 2, 3, c);
      b.rect(12, hy + 3, 2, 3, c);
      if (!back) {
        b.set(12, hy + 6, '#7d7a8c');
        b.set(11, hy + 7, '#7d7a8c');
        b.set(10, hy + 7, '#e2553b');
      }
      break;
    case 'goggles': {
      const strap = '#3b3346';
      if (back) b.rect(3, hy + 2, 10, 1, strap);
      else {
        b.rect(3, hy + 1, 10, 1, strap);
        b.rect(4, hy + 1, 3, 2, c);
        b.rect(9, hy + 1, 3, 2, c);
        b.set(4, hy + 1, ch);
        b.set(9, hy + 1, ch);
      }
      break;
    }
  }
}

function accessory(b: PixelBuf, p: Paint, dy: number, back: boolean) {
  const hy = p.hy + dy;
  switch (p.p.accessory) {
    case 'headphones':
      if (p.o.headgear === 'headset') return;
      b.rect(4, hy - 2, 8, 1, '#2a2633');
      b.rect(1, hy + 3, 3, 3, '#2a2633');
      b.rect(12, hy + 3, 3, 3, '#2a2633');
      b.set(2, hy + 4, p.sig);
      b.set(13, hy + 4, p.sig);
      break;
    case 'flower':
      if (back) return;
      b.rect(12, hy - 1, 2, 2, '#ef7aa8');
      b.set(14, hy, '#ef7aa8');
      b.set(13, hy, '#f3c843');
      break;
  }
}

/** Skin right under the hairline gets a 1px shadow: adds depth to every face. */
function fringeShadow(b: PixelBuf, p: Paint, dy: number) {
  const hy = p.hy + dy;
  const hair = new Set([p.hc, p.hs, p.hl]);
  for (let x = 4; x <= 11; x++)
    for (let y = hy; y <= hy + 4; y++) {
      const i = (y + OY) * SPRITE_W + (x + OX);
      const above = b.px[i - SPRITE_W];
      if (b.px[i] === p.skin.base && above && hair.has(above)) {
        b.px[i] = p.skin.shade;
        break;
      }
    }
}

// ── composition ──────────────────────────────────────────────

function compose(look: Look, pose: Pose): PixelBuf {
  const p = paintFor(look);
  const b = new PixelBuf();
  const bob = pose.mode === 'walk' && pose.frame % 2 === 1 ? -1 : 0;
  const mirrored = pose.dir === 'sw' || pose.dir === 'nw';
  const back = pose.dir === 'n' || pose.dir === 'ne' || pose.dir === 'nw';
  const turn = pose.dir === 's' || pose.dir === 'n' ? 0 : 1;

  legs(b, p, bob, pose.mode === 'walk' && pose.frame === 1, pose.mode === 'walk' && pose.frame === 3, back);
  torso(b, p, bob, back, back ? 0 : turn);
  arms(b, p, bob, pose, back);
  if (back) {
    headBack(b, p, bob, turn);
    hairBack(b, p, bob);
  } else {
    headFront(b, p, bob, pose, turn);
    hairFront(b, p, bob, turn);
    fringeShadow(b, p, bob);
  }
  headgear(b, p, bob, back);
  accessory(b, p, bob, back);
  b.outline();
  return mirrored ? b.mirror() : b;
}

const cache = new Map<string, HTMLCanvasElement>();
const keyCache = new WeakMap<Look, string>();

export function lookKey(look: Look) {
  let k = keyCache.get(look);
  if (!k) {
    k = JSON.stringify([look.profile, look.outfitId, look.outfitVariant, look.signature]);
    keyCache.set(look, k);
  }
  return k;
}

export function getSprite(look: Look, pose: Pose): HTMLCanvasElement {
  const key = `${lookKey(look)}|${pose.dir}|${pose.mode}|${pose.frame}|${pose.blink ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = compose(look, pose).toCanvas();
    if (cache.size > 4000) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}

export const FRAME_COUNT: Record<PoseMode, number> = { stand: 1, walk: 4, work: 2, talk: 2 };

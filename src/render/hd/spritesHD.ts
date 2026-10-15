// ─────────────────────────────────────────────────────────────
// HD character composer — 32×48 frames for 64×32 worlds (the Farm).
//
// Same inputs as the base composer (VisualProfile + OutfitLayers + pose),
// so any character can enter the Farm. Proportions are not chibi: the
// head is about a quarter of the ~36 px body. Light from the upper left,
// 3–4 tone ramps per material, hue-shifted shadows, selective outline.
// ─────────────────────────────────────────────────────────────

import type { OutfitLayers } from '../../domain/outfit';
import { outfitLayers } from '../../data/outfits';
import { SKIN_TONES } from '../../data/presets';
import { darken, lighten, mix } from '../color';
import { lookKey, type Look, type Pose } from '../sprites';

export const HD_W = 32;
export const HD_H = 48;
export const HD_FOOT_X = 16;
export const HD_FOOT_Y = 45;

const OUTL = '#3b2a26';
const COOL = '#3a2a52';

/** 4-tone ramp: deep shadow, shadow, base, light (shadows hue-shifted toward purple). */
function ramp(c: string): [string, string, string, string] {
  return [mix(darken(c, 0.38), COOL, 0.22), mix(darken(c, 0.2), COOL, 0.12), c, lighten(c, 0.16)];
}

class Buf {
  px: (string | null)[] = new Array(HD_W * HD_H).fill(null);
  set(x: number, y: number, c: string | null) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= HD_W || y >= HD_H) return;
    this.px[y * HD_W + x] = c;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= HD_W || y >= HD_H) return null;
    return this.px[y * HD_W + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string | null) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** horizontal run per row: rows = [[x0, x1], ...] starting at y */
  rows(y: number, rows: [number, number][], c: string) {
    rows.forEach(([a, b], j) => this.rect(a, y + j, b - a + 1, 1, c));
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  /** recolour existing pixels of `from` inside a predicate */
  tint(pred: (x: number, y: number) => boolean, map: Map<string, string>) {
    for (let y = 0; y < HD_H; y++)
      for (let x = 0; x < HD_W; x++) {
        const c = this.px[y * HD_W + x];
        if (c && map.has(c) && pred(x, y)) this.px[y * HD_W + x] = map.get(c)!;
      }
  }
  outline() {
    const src = [...this.px];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= HD_W || y >= HD_H ? null : src[y * HD_W + x]);
    for (let y = 0; y < HD_H; y++)
      for (let x = 0; x < HD_W; x++) {
        if (at(x, y)) continue;
        const up = at(x, y - 1);
        const sd = at(x - 1, y) ?? at(x + 1, y);
        const dn = at(x, y + 1);
        const base = up ?? sd ?? dn;
        if (!base) continue;
        this.px[y * HD_W + x] = mix(base, OUTL, up ? 0.8 : sd ? 0.72 : 0.62);
      }
  }
  mirror() {
    const out = new Buf();
    for (let y = 0; y < HD_H; y++) for (let x = 0; x < HD_W; x++) out.px[y * HD_W + (HD_W - 1 - x)] = this.px[y * HD_W + x];
    return out;
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = HD_W;
    cv.height = HD_H;
    const ctx = cv.getContext('2d')!;
    this.px.forEach((c, i) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(i % HD_W, Math.floor(i / HD_W), 1, 1);
    });
    return cv;
  }
}

// ── resolved paint ───────────────────────────────────────────
const res = (c: string | undefined, sig: string) => (c === 'signature' ? sig : c);

interface Paint {
  o: OutfitLayers;
  look: Look;
  sig: string;
  skin: [string, string, string, string];
  blush: string;
  hair: [string, string, string, string];
  eye: string;
  accent: string;
  top: [string, string, string, string];
  sleeve: [string, string, string, string];
  pants: [string, string, string, string];
  shoes: [string, string, string, string];
  hand: string;
  /** shoulder half-width */
  sw: number;
  /** head top y, shoulder y, hip y, knee y */
  hy: number;
  sy: number;
  hip: number;
  fem: boolean;
}

function paintFor(look: Look): Paint {
  const p = look.profile;
  const o = outfitLayers(look.outfitId, look.outfitVariant);
  const sig = look.signature;
  const s = SKIN_TONES[p.skin];
  const top = res(o.top, sig)!;
  const coat = res(o.coat, sig);
  const pants = res(o.overalls, sig) ?? res(o.pants, sig)!;
  const sw = { slim: 5, regular: 6, broad: 7 }[p.build];
  const lift = { tall: -2, regular: 0, short: 2 }[p.height];
  return {
    o,
    look,
    sig,
    skin: [mix(darken(s.shade, 0.15), COOL, 0.15), s.shade, s.base, lighten(s.base, 0.12)],
    blush: s.blush,
    hair: [mix(darken(p.hairColor, 0.42), COOL, 0.2), darken(p.hairColor, 0.22), p.hairColor, lighten(p.hairColor, 0.28)],
    eye: p.eyeColor,
    accent: p.hairAccent ?? sig,
    top: ramp(top),
    sleeve: ramp(coat ?? top),
    pants: ramp(pants),
    shoes: ramp(res(o.boots, sig) ?? res(o.shoes, sig)!),
    hand: res(o.gloves, sig) ?? s.base,
    sw,
    hy: 9 + lift,
    sy: 21 + lift,
    hip: 32 + Math.round(lift / 2),
    fem: p.body === 'fem',
  };
}

const CX = 16; // body centre column (between 15 and 16)

// ── body ─────────────────────────────────────────────────────
function legs(b: Buf, p: Paint, bob: number, pose: Pose, back: boolean) {
  const o = p.o;
  const hip = p.hip + bob;
  const skirt = res(o.skirt, p.sig);
  const boots = res(o.boots, p.sig);
  const walk = pose.mode === 'walk';
  // frame 1: left leg forward, frame 3: right leg forward
  const fwdL = walk && pose.frame === 1;
  const fwdR = walk && pose.frame === 3;
  const leg = (x: number, fwd: boolean, back2: boolean, near: boolean) => {
    const footY = 44 - (fwd ? 1 : 0);
    const top = hip + 1;
    const len = footY - top;
    const lx = x + (fwd ? -1 : back2 ? 1 : 0) * (near ? 1 : 1);
    const col = skirt ? p.skin : p.pants;
    for (let j = 0; j < len; j++) {
      const xx = j > len / 2 ? lx : x;
      b.rect(xx, top + j, 4, 1, col[2]);
      b.set(xx, top + j, col[near ? 3 : 2]);
      b.set(xx + 3, top + j, col[1]);
    }
    if (!skirt) b.rect(lx, top + len - 1, 4, 1, col[1]); // cuff
    if (boots) b.rect(lx, footY - 3, 4, 3, p.shoes[2]), b.set(lx, footY - 3, p.shoes[3]);
    // shoe: toe pointing out to the facing side
    const toe = back ? 0 : 1;
    b.rect(lx, footY, 5, 2, p.shoes[1]);
    b.rect(lx, footY, 4 + toe, 1, p.shoes[2]);
    b.set(lx + 1, footY, p.shoes[3]);
  };
  const lx = CX - 5;
  const rx = CX + 1;
  leg(lx, fwdL, fwdR, true);
  leg(rx, fwdR, fwdL, false);
  // hips / seat
  const hipCol = skirt ? ramp(skirt) : p.pants;
  b.rect(CX - p.sw, hip - 1, p.sw * 2, 3, hipCol[2]);
  b.rect(CX + p.sw - 2, hip - 1, 2, 3, hipCol[1]);
  b.set(CX - 1, hip + 1, hipCol[1]);
  if (skirt) {
    const r = ramp(skirt);
    for (let j = 0; j < 6; j++) {
      const w = p.sw + 1 + Math.floor(j / 2);
      b.rect(CX - w, hip + j, w * 2, 1, r[2]);
      b.set(CX - w, hip + j, r[3]);
      b.rect(CX + w - 2, hip + j, 2, 1, r[1]);
      if (j % 2 === 1) b.set(CX - 2 + (j % 4), hip + j, r[1]);
    }
    b.rect(CX - p.sw - 3, hip + 6, (p.sw + 3) * 2, 1, r[0]);
  }
  const coat = res(o.coat, p.sig);
  if (coat && o.longCoat) {
    const r = ramp(coat);
    if (back) b.rect(CX - p.sw, hip - 1, p.sw * 2, 7, r[2]);
    else {
      b.rect(CX - p.sw - 1, hip - 1, 3, 7, r[3]);
      b.rect(CX + p.sw - 2, hip - 1, 3, 7, r[1]);
    }
  }
  const apron = res(o.apron, p.sig);
  if (apron && !back) {
    const r = ramp(apron);
    b.rect(CX - p.sw + 1, hip - 1, p.sw * 2 - 2, 6, r[2]);
    b.rect(CX + p.sw - 3, hip - 1, 2, 6, r[1]);
    b.rect(CX - p.sw + 1, hip + 5, p.sw * 2 - 2, 1, r[0]);
  }
}

function torso(b: Buf, p: Paint, bob: number, back: boolean, turn: number) {
  const o = p.o;
  const y0 = p.sy + bob;
  const y1 = p.hip + bob - 1;
  const h = y1 - y0;
  const T = p.top;
  // shoulders rounded, waist slightly narrower for fem
  for (let j = 0; j < h; j++) {
    let w = p.sw;
    if (j === 0) w -= 1;
    if (p.fem && j > h * 0.55) w -= 1;
    b.rect(CX - w, y0 + j, w * 2, 1, T[2]);
    b.set(CX - w, y0 + j, T[3]);
    b.set(CX - w + 1, y0 + j, j < 3 ? T[3] : T[2]);
    b.rect(CX + w - 2, y0 + j, 2, 1, T[1]);
  }
  // fold shading under the chest and at the waist
  if (!back) {
    b.rect(CX - p.sw + 2, y0 + Math.floor(h * 0.55), 3, 1, T[1]);
    b.set(CX + 1 + turn, y0 + h - 2, T[1]);
  } else b.rect(CX - 1, y0 + 2, 2, h - 3, T[1]);
  const stripe = res(o.stripe, p.sig);
  if (stripe) {
    const r = ramp(stripe);
    for (const sy of [y0 + 3, y0 + 6]) {
      b.rect(CX - p.sw, sy, p.sw * 2, 1, r[2]);
      b.rect(CX + p.sw - 2, sy, 2, 1, r[1]);
    }
  }
  const ov = res(o.overalls, p.sig);
  if (ov) {
    const r = ramp(ov);
    if (back) {
      b.rect(CX - p.sw + 1, y0, 2, h, r[2]);
      b.rect(CX + p.sw - 3, y0, 2, h, r[1]);
    } else {
      const bibTop = y0 + 3;
      b.rect(CX - p.sw + 2, bibTop, p.sw * 2 - 4, y1 - bibTop + 1, r[2]);
      b.rect(CX + p.sw - 4, bibTop, 2, y1 - bibTop + 1, r[1]);
      b.rect(CX - p.sw + 2, bibTop, p.sw * 2 - 4, 1, r[3]);
      // straps + brass buttons + pocket
      b.rect(CX - p.sw + 1, y0, 2, 4, r[2]);
      b.rect(CX + p.sw - 3, y0, 2, 4, r[1]);
      b.set(CX - p.sw + 2, bibTop, '#f2d27a');
      b.set(CX + p.sw - 3, bibTop, '#d8b45a');
      b.rect(CX - 2 + turn, bibTop + 2, 4, 2, r[1]);
      b.rect(CX - 2 + turn, bibTop + 2, 4, 1, r[0]);
    }
  }
  const sus = res(o.suspenders, p.sig);
  if (sus) {
    b.rect(CX - p.sw + 2, y0, 1, h, sus);
    b.rect(CX + p.sw - 3, y0, 1, h, darken(sus, 0.2));
  }
  const apron = res(o.apron, p.sig);
  if (apron && !back) {
    const r = ramp(apron);
    b.rect(CX - p.sw + 2, y0 + 3, p.sw * 2 - 4, h - 3, r[2]);
    b.rect(CX + p.sw - 4, y0 + 3, 2, h - 3, r[1]);
    b.rect(CX - 1, y0, 1, 3, r[1]);
    b.rect(CX + 1, y0, 1, 3, r[1]);
    b.rect(CX - 2 + turn, y0 + h - 3, 4, 2, r[1]);
  }
  const coat = res(o.coat, p.sig);
  if (coat) {
    const r = ramp(coat);
    if (back) {
      for (let j = 0; j < h; j++) {
        b.rect(CX - p.sw, y0 + j, p.sw * 2, 1, r[2]);
        b.rect(CX + p.sw - 2, y0 + j, 2, 1, r[1]);
      }
      b.rect(CX - 1, y0 + 4, 1, h - 4, r[1]);
    } else {
      const open = 2;
      for (let j = 0; j < h; j++) {
        b.rect(CX - p.sw, y0 + j, p.sw - open + turn, 1, r[2]);
        b.set(CX - p.sw, y0 + j, r[3]);
        b.rect(CX + open + turn, y0 + j, p.sw - open - turn, 1, r[1]);
      }
      // lapels
      b.set(CX - open + turn - 1, y0 + 1, r[3]);
      b.set(CX - open + turn - 1, y0 + 2, r[3]);
      b.set(CX + open + turn, y0 + 1, r[0]);
    }
  }
  if (o.vest) {
    const vc = ramp(res(o.vest.color, p.sig)!);
    const vs = res(o.vest.stripe, p.sig)!;
    if (back) b.rect(CX - p.sw, y0, p.sw * 2, h, vc[2]);
    else {
      b.rect(CX - p.sw, y0, 3, h, vc[2]);
      b.rect(CX + p.sw - 3, y0, 3, h, vc[1]);
      b.rect(CX - p.sw, y0 + h - 3, 3, 1, vs);
      b.rect(CX + p.sw - 3, y0 + h - 3, 3, 1, vs);
    }
  }
  const nc = res(o.neckColor, p.sig);
  const cx = CX + (back ? 0 : turn);
  switch (o.neck) {
    case 'collar':
      if (back) b.rect(cx - 2, y0, 4, 1, nc ?? T[1]);
      else {
        b.rect(cx - 3, y0, 2, 2, nc ?? '#fbf6ec');
        b.rect(cx + 1, y0, 2, 2, nc ?? '#efe8dc');
        b.rect(cx - 1, y0, 2, 2, p.skin[1]);
      }
      break;
    case 'tie':
      if (!back) {
        b.rect(cx - 3, y0, 2, 2, '#fbf6ec');
        b.rect(cx + 1, y0, 2, 2, '#efe8dc');
        const r = ramp(nc ?? '#c33');
        b.rect(cx - 1, y0, 2, 2, r[2]);
        b.rect(cx - 1, y0 + 2, 2, h - 3, r[2]);
        b.set(cx, y0 + 3, r[1]);
      }
      break;
    case 'hood':
      if (back) b.rect(CX - p.sw + 1, y0, p.sw * 2 - 2, 4, T[1]), b.rect(CX - p.sw + 2, y0 + 3, p.sw * 2 - 4, 1, T[0]);
      else {
        b.rect(CX - p.sw + 1, y0, p.sw * 2 - 2, 2, T[1]);
        b.rect(cx - 1, y0, 2, 1, p.skin[1]);
        b.rect(cx - 1, y0 + 2, 1, 3, lighten(T[2], 0.5));
        b.rect(cx + 1, y0 + 2, 1, 3, lighten(T[2], 0.5));
      }
      break;
    case 'ring':
      b.rect(CX - p.sw + 1, y0, p.sw * 2 - 2, 1, nc ?? '#9a9aa8');
      break;
    case 'vneck':
      if (!back) b.rect(cx - 1, y0, 2, 2, p.skin[2]), b.set(cx - 1, y0 + 2, p.skin[1]);
      break;
    case 'turtle':
      b.rect(cx - 2, y0 - 1, 4, 2, T[3]);
      break;
    case 'scarf': {
      const r = ramp(nc ?? p.sig);
      b.rect(CX - p.sw + 1, y0, p.sw * 2 - 2, 2, r[2]);
      b.rect(CX + p.sw - 3, y0, 2, 2, r[1]);
      if (!back) b.rect(cx + 1, y0 + 2, 2, 5, r[2]), b.set(cx + 2, y0 + 6, r[0]);
      break;
    }
    default:
      if (!back) b.rect(cx - 1, y0, 2, 1, p.skin[1]);
  }
  if (p.look.profile.accessory === 'scarf' && o.neck !== 'scarf') {
    const r = ramp(p.sig);
    b.rect(CX - p.sw + 1, y0, p.sw * 2 - 2, 2, r[2]);
    if (!back) b.rect(cx, y0 + 2, 2, 4, r[1]);
  }
  const belt = res(o.belt, p.sig);
  if (belt) {
    b.rect(CX - p.sw, y1, p.sw * 2, 1, belt);
    if (!back) b.rect(cx - 1, y1, 2, 1, lighten(belt, 0.5));
  }
  const patch = res(o.patch, p.sig);
  if (patch && !back) b.rect(CX - p.sw + 1, y0 + 3, 2, 2, patch);
  const badge = res(o.badge, p.sig);
  if (badge && !back) b.rect(CX + p.sw - 4, y0 + 3, 2, 2, badge), b.set(CX + p.sw - 4, y0 + 3, lighten(badge, 0.4));
}

function arms(b: Buf, p: Paint, bob: number, pose: Pose, back: boolean) {
  const y0 = p.sy + bob;
  const len = p.hip - p.sy + 1;
  const S = p.sleeve;
  const hand = ramp(p.hand);
  const arm = (side: -1 | 1, swing: number, raise: number, reach: boolean) => {
    const x = side < 0 ? CX - p.sw - 2 : CX + p.sw;
    const L = len - raise;
    for (let j = 0; j < L; j++) {
      const dx = j > L * 0.5 ? swing : 0;
      b.rect(x + dx, y0 + j, 2, 1, side < 0 ? S[3] : S[1]);
      b.set(x + dx + (side < 0 ? 1 : 0), y0 + j, side < 0 ? S[2] : S[0]);
    }
    const hx = x + swing + (reach && !back ? (side < 0 ? 2 : -2) : 0);
    const hy = y0 + L;
    b.rect(hx, hy, 2, 2, hand[2]);
    b.set(hx + (side < 0 ? 0 : 1), hy, hand[3]);
    b.set(hx + (side < 0 ? 1 : 0), hy + 1, hand[1]);
  };
  let sl = 0;
  let sr = 0;
  let rl = 0;
  let rr = 0;
  let reach = false;
  if (pose.mode === 'walk') {
    if (pose.frame === 1) (sl = 1), (sr = -1);
    if (pose.frame === 3) (sl = -1), (sr = 1);
  } else if (pose.mode === 'work') {
    reach = true;
    rl = pose.frame % 2 === 0 ? 4 : 2;
    rr = pose.frame % 2 === 0 ? 2 : 4;
  } else if (pose.mode === 'talk') {
    rr = pose.frame % 2 === 0 ? 3 : 5;
  }
  arm(-1, sl, rl, reach);
  arm(1, sr, rr, reach || pose.mode === 'talk');
}

// ── head & face ──────────────────────────────────────────────
const HEAD_ROWS: [number, number][] = [
  [-3, 2],
  [-4, 3],
  [-5, 4],
  [-5, 4],
  [-5, 4],
  [-5, 4],
  [-5, 4],
  [-5, 4],
  [-4, 3],
  [-4, 3],
  [-3, 2],
  [-2, 1],
];

function head(b: Buf, p: Paint, bob: number, pose: Pose, turn: number, back: boolean) {
  const hy = p.hy + bob;
  const s = p.skin;
  const pr = p.look.profile;
  const cx = CX + (back ? 0 : turn);
  HEAD_ROWS.forEach(([a, z], j) => {
    const jaw = p.fem && j >= 9 ? 1 : 0;
    b.rect(cx + a + jaw, hy + j, z - a + 1 - jaw * 2 + 1, 1, back ? s[1] : s[2]);
    if (!back) {
      b.set(cx + a + jaw, hy + j, j > 1 && j < 9 ? s[3] : s[2]);
      b.set(cx + z - jaw + 1, hy + j, s[1]);
    }
  });
  // neck
  b.rect(cx - 2, hy + 12, 4, 1, s[1]);
  if (back) return;
  // ears (far ear hidden when turned)
  b.rect(cx - 6, hy + 5, 1, 3, s[2]);
  b.set(cx - 6, hy + 6, s[1]);
  if (turn === 0) b.rect(cx + 6, hy + 5, 1, 3, s[1]);
  // under-chin shadow
  b.rect(cx - 2, hy + 11, 4, 1, s[1]);
  // eyes: 2×3 with catch-light, lashes for fem
  const ey = hy + 5;
  const exL = cx - 4 + turn;
  const exR = cx + 1 + turn;
  const deep = darken(p.eye, 0.4);
  if (pose.blink) {
    b.rect(exL, ey + 2, 2, 1, deep);
    b.rect(exR, ey + 2, 2, 1, deep);
  } else
    for (const ex of [exL, exR]) {
      b.rect(ex, ey, 2, 3, p.eye);
      b.rect(ex, ey + 2, 2, 1, deep);
      b.set(ex, ey, '#fffaf2');
      b.set(ex + 1, ey, darken(p.eye, 0.15));
      if (p.fem) b.set(ex + (ex === exL ? -1 : 2), ey, OUTL);
    }
  // brows
  if (!pr.glasses) {
    const bc = p.fem ? mix(p.hair[1], s[2], 0.3) : p.hair[1];
    b.rect(exL, ey - 2, 2, 1, bc);
    b.rect(exR, ey - 2, 2, 1, bc);
    if (!p.fem) b.set(exL - 1, ey - 1, bc), b.set(exR + 2, ey - 1, bc);
  }
  // nose: a shaded pixel on the shadow side + highlight
  b.set(cx + turn + 0, ey + 3, s[1]);
  b.set(cx + turn - 1, ey + 3, s[3]);
  // cheeks
  if (pr.freckles) for (const [x, y] of [[exL, 4], [exL + 1, 5], [exR + 1, 4], [exR, 5]]) b.set(x, ey + y, '#c4704a');
  else {
    b.set(exL - 1, ey + 4, p.blush);
    b.set(exR + 2, ey + 4, p.blush);
  }
  // mouth
  const talking = pose.mode === 'talk' && pose.frame % 2 === 1;
  const mx = cx - 1 + turn;
  const lip = p.fem ? '#b4505a' : darken(s[1], 0.25);
  if (talking) b.rect(mx, ey + 5, 3, 2, '#6a2a2e'), b.set(mx + 1, ey + 6, '#e07a7a');
  else {
    b.rect(mx, ey + 5, 3, 1, lip);
    b.set(mx - 1, ey + 4, mix(s[2], lip, 0.4));
    b.set(mx + 3, ey + 4, mix(s[2], lip, 0.4));
  }
  // facial hair
  const hc = p.hair;
  if (pr.facialHair === 'beard') {
    for (let j = 3; j < 12; j++) {
      const [a, z] = HEAD_ROWS[j];
      if (j < 7) {
        b.set(cx + a, hy + j, hc[1]);
        b.set(cx + z + 1, hy + j, hc[0]);
      } else b.rect(cx + a, hy + j, z - a + 2, 1, j > 9 ? hc[1] : hc[2]);
    }
    b.rect(mx, ey + 5, 3, 1, talking ? '#6a2a2e' : s[0]);
    b.set(cx - 2, hy + 8, hc[3]);
  } else if (pr.facialHair === 'mustache') b.rect(mx - 1, ey + 4, 5, 1, hc[2]), b.set(mx - 1, ey + 4, hc[3]);
  else if (pr.facialHair === 'stubble') for (const [x, y] of [[-3, 9], [-1, 10], [1, 10], [3, 9], [-4, 8], [3, 8]]) b.set(cx + x, hy + y, mix(s[2], hc[2], 0.4));
  if (pr.earring) b.set(cx - 6, hy + 8, pr.earring);
  if (pr.glasses) {
    // thin frame with a light lens tint so the eyes still read
    const g = pr.glasses === 'round' ? '#a87a36' : '#6a5a6e';
    const lens = mix(s[3], '#dff2f6', 0.55);
    for (const lx of [exL - 1, exR - 1]) {
      for (let y = ey - 1; y <= ey + 3; y++)
        for (let x = lx; x <= lx + 3; x++) {
          const edge = y === ey - 1 || y === ey + 3 || x === lx || x === lx + 3;
          const corner = pr.glasses === 'round' && (x === lx || x === lx + 3) && (y === ey - 1 || y === ey + 3);
          if (corner) continue;
          if (edge) b.set(x, y, g);
          else if (y === ey) b.set(x, y, x === lx + 1 ? '#ffffff' : lens); // glint across the top of the lens
          else if (b.get(x, y) === s[2] || b.get(x, y) === s[3]) b.set(x, y, lens);
        }
    }
    b.set(exL + 2, ey, g);
  }
}

// ── hair ─────────────────────────────────────────────────────
/** Hair cap over the skull: an ellipse clipped at the hairline, shaded from the upper left. */
function skullCap(b: Buf, p: Paint, cx: number, hy: number, extra = 0, fringe = 3) {
  const H = p.hair;
  for (let y = hy - 2 - extra; y <= hy + fringe + 1; y++)
    for (let x = cx - 6 - extra; x <= cx + 6 + extra; x++) {
      const dx = (x + 0.5 - cx) / (6 + extra);
      const dy = (y + 0.5 - (hy + 4)) / (6.5 + extra);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx + dy * 1.2;
      b.set(x, y, lit < -0.75 ? H[3] : lit < 0.15 ? H[2] : lit < 0.7 ? H[1] : H[0]);
    }
}

function strands(b: Buf, p: Paint, pts: [number, number][], tone: number) {
  for (const [x, y] of pts) b.set(x, y, p.hair[tone]);
}

function hairBehind(b: Buf, p: Paint, bob: number, back: boolean) {
  const hy = p.hy + bob;
  const cx = CX;
  const H = p.hair;
  const style = p.look.profile.hair;
  /** a fall of hair: tapers at the tips, wavy edges, strands, lit on the left */
  const fall = (x0: number, x1: number, y0: number, y1: number, wave = false) => {
    const n = y1 - y0;
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, n);
      const w = wave ? Math.round(Math.sin(y * 0.8) * 1) : 0;
      const taper = t > 0.75 ? Math.round((t - 0.75) * 8) : 0;
      const a = x0 + w + taper;
      const z = x1 + w - taper;
      for (let x = a; x <= z; x++) {
        const strand = (x - x0 + Math.floor(y / 4)) % 4 === 0;
        const col = x - a < 2 ? H[3] : z - x < 2 ? H[0] : strand ? H[1] : H[2];
        b.set(x, y, col);
      }
    }
    // ragged tips
    for (let x = x0 + 1; x < x1; x += 2) b.set(x, y1 + 1, H[1]);
  };
  switch (style) {
    case 'mane':
      fall(cx - 9, cx + 8, hy + 3, hy + 17 + (back ? 2 : 0), true);
      break;
    case 'long':
      fall(cx - 7, cx + 6, hy + 4, hy + 21);
      break;
    case 'bob':
      fall(cx - 7, cx + 6, hy + 3, hy + 11);
      break;
    case 'curly':
      fall(cx - 8, cx + 7, hy + 2, hy + 12, true);
      break;
    case 'afro':
      b.ellipse(cx, hy + 3, 10, 9.5, H[1]);
      break;
    case 'braids':
      if (back) fall(cx - 5, cx + 4, hy + 6, hy + 20);
      break;
    case 'ponytail':
      if (back) {
        fall(cx - 2, cx + 1, hy + 8, hy + 20);
        b.rect(cx - 2, hy + 8, 4, 1, p.accent);
      } else fall(cx + 5, cx + 8, hy + 4, hy + 18, true);
      break;
  }
}

function hairFront(b: Buf, p: Paint, bob: number, turn: number) {
  const hy = p.hy + bob;
  const cx = CX + turn;
  const H = p.hair;
  const side = (x: number, y0: number, y1: number, w = 2) => {
    for (let y = y0; y <= y1; y++) b.rect(x, y, w, 1, y % 3 === 0 ? H[1] : H[2]);
  };
  switch (p.look.profile.hair) {
    case 'mane': {
      skullCap(b, p, cx, hy, 2, 3);
      side(cx - 8, hy + 2, hy + 14, 3);
      side(cx + 5, hy + 2, hy + 13, 3);
      // wavy fringe with gaps, swept to one side
      for (let x = cx - 5; x <= cx + 5; x++) {
        const d = Math.round(1.5 + Math.sin(x * 1.3) * 1.2);
        b.rect(x, hy + 2, 1, d + 1, x < cx ? H[2] : H[1]);
      }
      strands(b, p, [[cx - 3, hy - 3], [cx - 2, hy - 2], [cx + 1, hy - 3], [cx - 5, hy - 1], [cx + 3, hy - 1], [cx - 7, hy + 4], [cx - 7, hy + 8]], 3);
      strands(b, p, [[cx, hy - 1], [cx + 4, hy + 1], [cx - 4, hy + 1], [cx + 6, hy + 6], [cx - 8, hy + 11], [cx + 6, hy + 11]], 0);
      // flyaway curls
      for (const [x, y] of [[cx - 6, hy - 4], [cx + 3, hy - 5], [cx + 7, hy - 2], [cx - 9, hy + 1], [cx + 8, hy + 3]]) b.set(x, y, H[2]);
      break;
    }
    case 'crew':
      skullCap(b, p, cx, hy, 0, 1);
      break;
    case 'tousled':
      skullCap(b, p, cx, hy, 1, 2);
      for (const x of [cx - 4, cx - 1, cx + 2, cx + 4]) b.rect(x, hy + 2, 2, 2, H[2]);
      strands(b, p, [[cx - 3, hy - 4], [cx, hy - 4], [cx + 3, hy - 3], [cx + 6, hy - 1]], 2);
      side(cx - 7, hy + 2, hy + 6);
      side(cx + 5, hy + 2, hy + 6);
      break;
    case 'spiky':
      skullCap(b, p, cx, hy, 0, 1);
      for (const [x, h] of [[cx - 5, 2], [cx - 3, 4], [cx - 1, 3], [cx + 1, 5], [cx + 3, 3], [cx + 5, 2]] as const) {
        b.rect(x, hy - 2 - h, 2, h, H[2]);
        b.set(x, hy - 2 - h, H[3]);
      }
      break;
    case 'shaved': {
      const fz = mix(p.skin[2], H[2], 0.35);
      for (let y = hy; y <= hy + 2; y++) for (let x = cx - 4; x <= cx + 4; x++) if (b.get(x, y)) b.set(x, y, (x + y) % 2 ? fz : mix(p.skin[1], H[2], 0.3));
      break;
    }
    case 'bun':
      skullCap(b, p, cx, hy, 0, 2);
      b.ellipse(cx, hy - 3, 3.5, 3, H[2]);
      b.set(cx - 1, hy - 5, H[3]);
      b.rect(cx - 2, hy - 1, 4, 1, p.accent);
      side(cx - 6, hy + 2, hy + 5);
      side(cx + 5, hy + 2, hy + 5);
      break;
    case 'curly':
      skullCap(b, p, cx, hy, 1, 2);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1 + i / 8);
        const x = cx + Math.cos(a) * 7;
        const y = hy + 4 + Math.sin(a) * 7;
        b.ellipse(x, y, 1.8, 1.8, i % 2 ? H[1] : H[2]);
        b.set(x - 1, y - 1, H[3]);
      }
      for (const x of [cx - 4, cx - 1, cx + 2]) b.ellipse(x + 1, hy + 3, 1.5, 1.4, H[2]);
      side(cx - 8, hy + 3, hy + 9, 2);
      side(cx + 6, hy + 3, hy + 9, 2);
      break;
    case 'afro': {
      // volume above and beside the face only (the face stays clear)
      for (let y = Math.floor(hy - 7); y <= hy + 10; y++)
        for (let x = cx - 10; x <= cx + 10; x++) {
          const dx = (x + 0.5 - cx) / 9.5;
          const dy = (y + 0.5 - (hy + 2)) / 8.5;
          if (dx * dx + dy * dy > 1) continue;
          if (y > hy + 2 && Math.abs(x + 0.5 - cx) < 5.5) continue;
          const lit = dx + dy;
          b.set(x, y, lit < -0.8 ? H[3] : lit < 0.3 ? H[2] : H[1]);
          if ((x * 3 + y * 5) % 7 === 0) b.set(x, y, H[1]);
        }
      b.ellipse(cx - 3, hy - 3, 3, 2, H[3]);
      // hairline
      for (let x = cx - 4; x <= cx + 4; x++) b.set(x, hy + 3 + (Math.abs(x - cx) > 3 ? 1 : 0), H[1]);
      break;
    }
    case 'ponytail':
      skullCap(b, p, cx, hy, 0, 2);
      b.rect(cx - 5, hy + 2, 4, 1, H[2]);
      b.rect(cx + 1, hy + 2, 4, 2, H[1]);
      b.rect(cx + 5, hy + 1, 2, 2, p.accent);
      break;
    case 'undercut': {
      skullCap(b, p, cx, hy, 0, 1);
      const sd = mix(p.skin[2], H[2], 0.45);
      for (let y = hy + 2; y < hy + 6; y++) b.set(cx - 6, y, sd), b.set(cx + 5, y, sd);
      for (let x = cx - 3; x <= cx + 6; x++) b.rect(x, hy - 2, 1, 4 - Math.abs(x - cx) / 3, H[2]);
      strands(b, p, [[cx - 1, hy - 3], [cx + 1, hy - 3], [cx + 3, hy - 2]], 3);
      b.rect(cx + 1, hy + 2, 5, 1, H[1]);
      break;
    }
    case 'bob':
      skullCap(b, p, cx, hy, 1, 3);
      side(cx - 7, hy + 2, hy + 10, 3);
      side(cx + 5, hy + 2, hy + 10, 3);
      b.rect(cx - 7, hy + 10, 3, 1, H[0]);
      b.rect(cx + 5, hy + 10, 3, 1, H[0]);
      break;
    case 'long':
      skullCap(b, p, cx, hy, 1, 2);
      side(cx - 7, hy + 2, hy + 18, 2);
      side(cx + 6, hy + 2, hy + 17, 2);
      b.rect(cx - 3, hy + 2, 3, 1, H[2]);
      break;
    case 'braids':
      skullCap(b, p, cx, hy, 0, 2);
      b.rect(cx, hy - 1, 1, 3, H[0]);
      for (const x of [cx - 7, cx + 5]) {
        for (let y = hy + 3; y <= hy + 18; y++) b.rect(x, y, 2, 1, (y + x) % 2 ? H[2] : H[1]);
        b.rect(x, hy + 19, 2, 1, p.accent);
      }
      break;
  }
}

function hairBack(b: Buf, p: Paint, bob: number) {
  const hy = p.hy + bob;
  const style = p.look.profile.hair;
  if (style === 'shaved') {
    const fz = mix(p.skin[1], p.hair[2], 0.35);
    for (let y = hy; y < hy + 9; y++) for (let x = CX - 5; x <= CX + 4; x++) if (b.get(x, y)) b.set(x, y, (x + y) % 2 ? fz : p.skin[1]);
    return;
  }
  if (style === 'afro') return void b.ellipse(CX, hy + 3, 9.5, 9, p.hair[2]);
  const big = style === 'mane' || style === 'curly' ? 2 : style === 'bob' || style === 'long' ? 1 : 0;
  skullCap(b, p, CX, hy, big, 9);
  if (style === 'undercut') for (let y = hy + 5; y < hy + 10; y++) b.rect(CX - 5, y, 10, 1, mix(p.skin[1], p.hair[2], 0.45));
  if (style === 'bun') b.ellipse(CX, hy - 3, 3.5, 3, p.hair[2]), b.rect(CX - 2, hy - 1, 4, 1, p.accent);
  if (style === 'spiky') for (const x of [CX - 4, CX - 1, CX + 2]) b.rect(x, hy - 5, 2, 3, p.hair[2]);
  for (let i = 0; i < 6; i++) b.set(CX - 4 + i * 2, hy + 2 + (i % 3) * 2, p.hair[1]);
}

// ── headgear & accessories ───────────────────────────────────
function headgear(b: Buf, p: Paint, bob: number, back: boolean, turn: number) {
  const kind = p.o.headgear;
  if (!kind) return;
  const hy = p.hy + bob;
  const cx = CX + (back ? 0 : turn);
  const r = ramp(res(p.o.headgearColor, p.sig) ?? '#888888');
  const dome = (rx: number, ry: number, y: number) => {
    for (let yy = Math.floor(y - ry); yy <= y; yy++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (yy + 0.5 - y) / ry;
        if (dx * dx + dy * dy <= 1) b.set(x, yy, dx + dy < -0.9 ? r[3] : dx > 0.45 ? r[1] : r[2]);
      }
  };
  switch (kind) {
    case 'strawhat': {
      const st = ramp('#e2c37a');
      for (let x = cx - 11; x <= cx + 10; x++) {
        b.set(x, hy + 2, x < cx ? st[3] : st[2]);
        b.set(x, hy + 3, st[1]);
      }
      dome(6, 6, hy + 2);
      for (let yy = hy - 4; yy <= hy + 2; yy++) for (let x = cx - 6; x <= cx + 6; x++) if (b.get(x, yy) && (x + yy) % 3 === 0) b.set(x, yy, st[1]);
      b.rect(cx - 6, hy, 13, 2, '#b6492f');
      b.rect(cx - 6, hy, 13, 1, '#d0644a');
      break;
    }
    case 'hardhat':
      dome(6.5, 6, hy + 2);
      b.rect(cx - 8, hy + 2, 16, 1, r[1]);
      b.rect(cx - 1, hy - 4, 2, 6, r[3]);
      break;
    case 'cap':
      dome(6, 5, hy + 2);
      if (!back) b.rect(cx - 2, hy + 2, 9, 1, r[1]), b.rect(cx - 2, hy + 3, 8, 1, r[0]);
      else b.rect(cx - 1, hy + 2, 3, 1, r[0]);
      b.set(cx, hy - 3, r[3]);
      break;
    case 'hairnet':
      dome(6.5, 6, hy + 2);
      for (let x = cx - 6; x <= cx + 6; x += 2) b.set(x, hy, r[3]);
      break;
    case 'beanie':
      dome(6.5, 7, hy + 3);
      b.rect(cx - 6, hy + 2, 13, 2, r[1]);
      for (let x = cx - 6; x <= cx + 6; x += 2) b.set(x, hy + 2, r[0]);
      b.ellipse(cx, hy - 5, 2, 1.5, r[3]);
      break;
    case 'raincap':
      dome(6.5, 6, hy + 2);
      b.rect(cx - 9, hy + 2, 18, 2, r[1]);
      b.rect(cx - 9, hy + 3, 18, 1, r[0]);
      break;
    case 'beret':
      b.ellipse(cx - 1, hy - 1, 7, 3.5, r[2]);
      b.ellipse(cx - 2, hy - 2, 4, 1.5, r[3]);
      b.set(cx, hy - 5, r[0]);
      break;
    case 'bandana':
      dome(6, 4, hy + 1);
      b.rect(cx - 6, hy, 13, 2, r[2]);
      for (const x of [cx - 4, cx + 1, cx + 4]) b.set(x, hy, '#fbf4e4');
      if (back) b.rect(cx - 1, hy + 2, 3, 3, r[1]);
      break;
    case 'visor':
      b.rect(cx - 6, hy + 1, 13, 1, r[2]);
      if (!back) b.rect(cx - 5, hy + 4, 11, 3, '#9fe3e0'), b.rect(cx - 5, hy + 4, 11, 1, '#d8fbff');
      break;
    case 'headset':
      b.rect(cx - 4, hy - 3, 9, 1, r[1]);
      b.rect(cx - 7, hy + 4, 2, 4, r[2]);
      b.rect(cx + 6, hy + 4, 2, 4, r[1]);
      if (!back) b.rect(cx + 3, hy + 9, 4, 1, '#7d7a8c'), b.set(cx + 2, hy + 9, '#e2553b');
      break;
    case 'goggles':
      b.rect(cx - 6, hy + 2, 13, 1, '#3b3346');
      if (!back) {
        b.rect(cx - 5, hy + 1, 4, 3, r[2]);
        b.rect(cx + 1, hy + 1, 4, 3, r[2]);
        b.set(cx - 5, hy + 1, r[3]);
        b.set(cx + 1, hy + 1, r[3]);
      }
      break;
  }
}

function accessory(b: Buf, p: Paint, bob: number, back: boolean, turn: number) {
  const hy = p.hy + bob;
  const cx = CX + (back ? 0 : turn);
  switch (p.look.profile.accessory) {
    case 'headphones':
      if (p.o.headgear === 'headset') return;
      b.rect(cx - 5, hy - 3, 11, 1, '#2a2633');
      b.rect(cx - 8, hy + 4, 3, 4, '#2a2633');
      b.rect(cx + 6, hy + 4, 3, 4, '#2a2633');
      b.set(cx - 7, hy + 5, p.sig);
      b.set(cx + 7, hy + 5, p.sig);
      break;
    case 'flower':
      if (back) return;
      b.rect(cx + 4, hy - 1, 3, 3, '#ef7aa8');
      b.set(cx + 5, hy, '#f3c843');
      b.set(cx + 7, hy, '#f6a8c4');
      break;
  }
}

// ── composition ──────────────────────────────────────────────
/** Raw 32×48 composition (unoutlined, unmirrored) plus the layout needed to refine it at 64×96. */
export function composeRaw(look: Look, pose: Pose) {
  const b = compose(look, pose, false);
  const p = paintFor(look);
  const back = pose.dir === 'n' || pose.dir === 'ne' || pose.dir === 'nw';
  return {
    px: b.px,
    w: HD_W,
    h: HD_H,
    cx: CX,
    hy: p.hy + (pose.mode === 'walk' && pose.frame % 2 === 1 ? -1 : 0),
    sy: p.sy,
    hip: p.hip,
    hair: p.hair,
    skin: p.skin,
    top: p.top,
    pants: p.pants,
    eye: p.eye,
    blush: p.blush,
    fem: p.fem,
    back,
    turn: pose.dir === 's' || pose.dir === 'n' ? 0 : 1,
    mirrored: pose.dir === 'sw' || pose.dir === 'nw',
    profile: look.profile,
  };
}

function compose(look: Look, pose: Pose, finish = true): Buf {
  const p = paintFor(look);
  const b = new Buf();
  const bob = pose.mode === 'walk' && pose.frame % 2 === 1 ? -1 : 0;
  const mirrored = pose.dir === 'sw' || pose.dir === 'nw';
  const back = pose.dir === 'n' || pose.dir === 'ne' || pose.dir === 'nw';
  const turn = pose.dir === 's' || pose.dir === 'n' ? 0 : 1;
  if (!back) hairBehind(b, p, bob, false);
  legs(b, p, bob, pose, back);
  torso(b, p, bob, back, back ? 0 : turn);
  arms(b, p, bob, pose, back);
  head(b, p, bob, pose, turn, back);
  if (back) {
    hairBehind(b, p, bob, true);
    hairBack(b, p, bob);
  } else hairFront(b, p, bob, turn);
  headgear(b, p, bob, back, turn);
  accessory(b, p, bob, back, turn);
  if (!finish) return b;
  b.outline();
  return mirrored ? b.mirror() : b;
}

const cache = new Map<string, HTMLCanvasElement>();

export function getSpriteHD(look: Look, pose: Pose): HTMLCanvasElement {
  const key = `${lookKey(look)}|${pose.dir}|${pose.mode}|${pose.frame}|${pose.blink ? 1 : 0}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = compose(look, pose).canvas();
    if (cache.size > 4000) cache.clear();
    cache.set(key, cv);
  }
  return cv;
}

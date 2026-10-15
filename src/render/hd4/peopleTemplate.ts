// ─────────────────────────────────────────────────────────────
// Characters drawn by hand (the owner's own pixel art: a 112 px figure on an 80×128 canvas, feet on row 120), animated
// with a skeleton cut out of the drawing.
//
// The three-quarter views (the ones the world shows) are rigged: each leg is a
// thigh and a shin turning at the hip and the knee, each forearm turns at the
// elbow. Parts are rotated with RotSprite (enlarged 8× with Scale2x, turned,
// sampled back), so the pixels stay crisp and the outlines stay whole. The
// front and back views (the character creator) only lift legs and arms.
// sw and nw are the three-quarter views mirrored.
//
// Walk frames run 0..7 (one stride per leg); work and talk have 2 frames.
// ─────────────────────────────────────────────────────────────

import type { Pose } from '../sprites';
import { ALEX_PALETTE, ALEX_VIEWS } from './peopleArt';

type Grid = (string | null)[];
type View = 's' | 'se' | 'ne' | 'n';
const W = 80;
const H = 128;

type Rect = [number, number, number, number]; // x0, y0, x1, y1 (inclusive)
interface Rig {
  /** far and near leg: the whole leg's box, the hip and knee pivots */
  legs: { box: Rect; hip: [number, number]; knee: [number, number] }[];
  /**
   * far and near arm: the forearm's pixels as row spans [y0, y1, x0, x1] and its elbow pivot;
   * the upper sleeve's spans and the shoulder pivot (the whole arm swings from there when walking)
   */
  arms: { spans: Rect[]; elbow: [number, number]; sleeve: Rect[]; shoulder: [number, number] }[];
}
interface ViewMeta {
  legTop: number;
  cx: number;
  armL: number;
  armR: number;
  armTop: number;
  armBot: number;
  rig?: Rig;
  /** blink: the eye boxes [x0, x1] on rows top..top+2, closed to a lash line on the middle row */
  eyes?: { boxes: [number, number][]; top: number; skin: string; lash: string };
  /** talk: the mouth's pixels and the open mouth drawn there */
  mouth?: { dark: [number, number][]; tongue: [number, number][] };
}

const META: Record<View, ViewMeta> = {
  s: {
    legTop: 83,
    cx: 40,
    armL: 26,
    armR: 53,
    armTop: 56,
    armBot: 82,
    eyes: { boxes: [[35, 38], [43, 46]], top: 33, skin: '#ffc27a', lash: '#2a0612' },
    mouth: { dark: [[40, 38], [41, 38]], tongue: [[40, 39], [41, 39]] },
  },
  se: {
    legTop: 80,
    cx: 41,
    armL: 26,
    armR: 53,
    armTop: 57,
    armBot: 80,
    rig: {
      legs: [
        { box: [16, 80, 40, 119], hip: [34, 80], knee: [29, 100] },
        { box: [41, 80, 66, 119], hip: [47, 80], knee: [48, 100] },
      ],
      arms: [
        { spans: [[57, 59, 10, 25], [60, 63, 10, 27], [64, 69, 10, 25], [70, 80, 10, 26]], elbow: [22, 57], sleeve: [[43, 56, 10, 25]], shoulder: [24, 44] },
        { spans: [[57, 64, 51, 70], [65, 80, 53, 70]], elbow: [55, 57], sleeve: [[42, 56, 52, 70]], shoulder: [53, 44] },
      ],
    },
    eyes: { boxes: [[38, 41], [46, 48]], top: 30, skin: '#fdb86e', lash: '#2a0612' },
    mouth: { dark: [[43, 36], [44, 36]], tongue: [[43, 37], [44, 37]] },
  },
  ne: {
    legTop: 80,
    cx: 40,
    armL: 26,
    armR: 51,
    armTop: 58,
    armBot: 80,
    rig: {
      legs: [
        { box: [14, 80, 39, 119], hip: [33, 80], knee: [28, 100] },
        { box: [40, 80, 64, 119], hip: [46, 80], knee: [47, 100] },
      ],
      arms: [
        { spans: [[58, 63, 10, 29], [64, 80, 10, 26]], elbow: [23, 58], sleeve: [[43, 57, 10, 26]], shoulder: [25, 44] },
        { spans: [[57, 63, 47, 70], [64, 80, 51, 70]], elbow: [53, 57], sleeve: [[43, 56, 46, 70]], shoulder: [48, 45] },
      ],
    },
  },
  n: { legTop: 83, cx: 40, armL: 25, armR: 54, armTop: 56, armBot: 82 },
};

const SYM = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
function decode(rows: string[], palette: string[]): Grid {
  const g: Grid = new Array(W * H).fill(null);
  rows.forEach((r, y) => {
    for (let x = 0; x < W; x++) {
      const ch = r[x];
      if (ch && ch !== '.') g[y * W + x] = palette[SYM.indexOf(ch)];
    }
  });
  return g;
}

const views = new Map<View, Grid>();
function view(v: View): Grid {
  let g = views.get(v);
  if (!g) {
    g = decode(ALEX_VIEWS[v], ALEX_PALETTE);
    views.set(v, g);
  }
  return g;
}

// ── RotSprite ────────────────────────────────────────────────

function scale2x(src: Grid, w: number, h: number): Grid {
  const W2 = w * 2;
  const out: Grid = new Array(W2 * h * 2).fill(null);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : src[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      const o = y * 2 * W2 + x * 2;
      out[o] = C === A && C !== D && A !== B ? A : P;
      out[o + 1] = A === B && A !== C && B !== D ? B : P;
      out[o + W2] = D === C && D !== B && C !== A ? C : P;
      out[o + W2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out;
}

/** A part cut out of a view: its pixels in a box, enlarged 8× once and kept. */
interface Part {
  x0: number;
  y0: number;
  w: number;
  h: number;
  big: Grid;
}
function cut(g: Grid, [x0, y0, x1, y1]: Rect, keep: (x: number, y: number) => boolean = () => true): Part {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  let p: Grid = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep(x0 + x, y0 + y)) p[y * w + x] = g[(y0 + y) * W + x0 + x];
  let ww = w;
  let hh = h;
  for (let i = 0; i < 3; i++) {
    p = scale2x(p, ww, hh);
    ww *= 2;
    hh *= 2;
  }
  return { x0, y0, w, h, big: p };
}

/**
 * Draw a part turned by `deg` (clockwise on screen) about its pivot (frame px),
 * with the pivot landing at `to`.
 */
function drawTurned(out: Grid, part: Part, pivot: [number, number], deg: number, to: [number, number]) {
  const a = (deg * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const R = Math.ceil(Math.hypot(part.w, part.h)) + 2;
  const BW = part.w * 8;
  const BH = part.h * 8;
  for (let oy = -R; oy <= R; oy++)
    for (let ox = -R; ox <= R; ox++) {
      // this output pixel's centre, back into the part's unrotated frame
      const dx = ox + 0.5;
      const dy = oy + 0.5;
      const sx = cs * dx + sn * dy + pivot[0] - part.x0;
      const sy = -sn * dx + cs * dy + pivot[1] - part.y0;
      const bx = Math.floor(sx * 8);
      const by = Math.floor(sy * 8);
      if (bx < 0 || by < 0 || bx >= BW || by >= BH) continue;
      const c = part.big[by * BW + bx];
      if (!c) continue;
      const tx = Math.floor(to[0] + ox);
      const ty = Math.floor(to[1] + oy);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H) out[ty * W + tx] = c;
    }
}

/**
 * Draw a part through a linear map M = [m00, m01, m10, m11] about its pivot
 * (frame px), the pivot landing at `to`: a shear walks a limb along the
 * ground's diagonal instead of turning it in the screen plane.
 */
function drawMapped(out: Grid, part: Part, pivot: [number, number], [a, b, c, d]: [number, number, number, number], to: [number, number]) {
  const det = a * d - b * c;
  const R = Math.ceil(Math.hypot(part.w, part.h) * 1.4) + 2;
  const BW = part.w * 8;
  const BH = part.h * 8;
  for (let oy = -R; oy <= R; oy++)
    for (let ox = -R; ox <= R; ox++) {
      const dx = ox + 0.5;
      const dy = oy + 0.5;
      const sx = (d * dx - b * dy) / det + pivot[0] - part.x0;
      const sy = (-c * dx + a * dy) / det + pivot[1] - part.y0;
      const bx = Math.floor(sx * 8);
      const by = Math.floor(sy * 8);
      if (bx < 0 || by < 0 || bx >= BW || by >= BH) continue;
      const col = part.big[by * BW + bx];
      if (!col) continue;
      const tx = Math.floor(to[0] + ox);
      const ty = Math.floor(to[1] + oy);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H) out[ty * W + tx] = col;
    }
}

function rotate(p: [number, number], about: [number, number], deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = p[0] - about[0];
  const dy = p[1] - about[1];
  return [about[0] + Math.cos(a) * dx - Math.sin(a) * dy, about[1] + Math.sin(a) * dx + Math.cos(a) * dy];
}

interface RigParts {
  base: Grid;
  thighs: Part[];
  shins: Part[];
  arms: Part[];
  /** sleeve and forearm together, for the walk's swing from the shoulder */
  wholeArms: Part[];
}
const rigs = new Map<View, RigParts>();
function rigOf(v: View): RigParts {
  let r = rigs.get(v);
  if (r) return r;
  const g = view(v);
  const rig = META[v].rig!;
  const base = g.slice();
  const clear = ([x0, y0, x1, y1]: Rect) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) base[y * W + x] = null;
  };
  const thighs: Part[] = [];
  const shins: Part[] = [];
  const inArms = (x: number, y: number) => rig.arms.some((a) => a.spans.some(([y0, y1, x0, x1]) => y >= y0 && y <= y1 && x >= x0 && x <= x1));
  const notArm = (x: number, y: number) => !inArms(x, y);
  for (const l of rig.legs) {
    const [x0, y0, x1, y1] = l.box;
    thighs.push(cut(g, [x0, y0, x1, l.knee[1] - 1], notArm));
    shins.push(cut(g, [x0, l.knee[1], x1, y1], notArm));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (notArm(x, y)) base[y * W + x] = null;
  }
  const cutSpans = (spans: Rect[]) => {
    const inside = (x: number, y: number) => spans.some(([y0, y1, x0, x1]) => y >= y0 && y <= y1 && x >= x0 && x <= x1);
    const box: Rect = [Math.min(...spans.map((r) => r[2])), Math.min(...spans.map((r) => r[0])), Math.max(...spans.map((r) => r[3])), Math.max(...spans.map((r) => r[1]))];
    return cut(g, box, inside);
  };
  const arms = rig.arms.map((a) => cutSpans(a.spans));
  const wholeArms = rig.arms.map((a) => cutSpans([...a.sleeve, ...a.spans]));
  // the forearms leave the body; the upper sleeves stay drawn on it, under the swinging arm, so it never leaves a hole
  for (const a of rig.arms) for (const r of a.spans) clear([r[2], r[0], r[3], r[1]]);
  r = { base, thighs, shins, arms, wholeArms };
  rigs.set(v, r);
  return r;
}

/**
 * The rigged pose: leg swing per leg (degrees, + = the foot toward the facing
 * side), knee bend (+ = the foot back), forearm swing, and a body lift in px.
 */
interface RigPose {
  thigh: [number, number];
  knee: [number, number];
  arm: [number, number];
  lift: number;
  /** the far forearm reaches in front of the body (hands at a desk), instead of hanging behind it */
  armFront?: boolean;
  /**
   * The walk, along the ground: each foot's step (px, + = forward along the facing diagonal),
   * how high each foot lifts, and each hand's swing (px, + = forward). Replaces thigh/knee/arm.
   */
  walk?: { step: [number, number]; footLift: [number, number]; swing: [number, number] };
}

/** Screen rows per px of step along the facing diagonal: forward is down-right (se), up-right (ne). */
const SLOPE: Partial<Record<View, number>> = { se: 0.5, ne: -0.5 };

function poseRig(v: View, rp: RigPose): Grid {
  const rig = META[v].rig!;
  const parts = rigOf(v);
  // the facing side is screen right in both drawn three-quarter views: + swings the foot right
  const out: Grid = new Array(W * H).fill(null);
  const slope = SLOPE[v] ?? 0;
  const drawLeg = (i: number) => {
    const l = rig.legs[i];
    const hipTo: [number, number] = [l.hip[0], l.hip[1] - rp.lift];
    if (rp.walk) {
      // shear the leg so its foot lands `step` px along the ground's diagonal, the knee following
      const L = l.box[3] - l.hip[1];
      const a = rp.walk.step[i] / L;
      const M: [number, number, number, number] = [1, a, 0, 1 + a * slope];
      drawMapped(out, parts.thighs[i], l.hip, M, hipTo);
      const kx = l.knee[0] - l.hip[0];
      const ky = l.knee[1] - l.hip[1];
      const kTo: [number, number] = [hipTo[0] + kx + a * ky, hipTo[1] + (1 + a * slope) * ky - rp.walk.footLift[i]];
      drawMapped(out, parts.shins[i], l.knee, M, kTo);
      return;
    }
    drawTurned(out, parts.thighs[i], l.hip, -rp.thigh[i], hipTo);
    const k = rotate(l.knee, l.hip, -rp.thigh[i]);
    drawTurned(out, parts.shins[i], l.knee, -rp.thigh[i] + rp.knee[i], [k[0], k[1] - rp.lift]);
  };
  const drawArm = (i: number) => {
    const a = rig.arms[i];
    if (rp.walk) {
      // the whole arm swings from the shoulder, its hand travelling along the ground's diagonal
      const part = parts.wholeArms[i];
      const L = part.y0 + part.h - a.shoulder[1];
      const b = rp.walk.swing[i] / L;
      drawMapped(out, part, a.shoulder, [1, b, 0, 1 + b * slope], [a.shoulder[0], a.shoulder[1] - rp.lift]);
      return;
    }
    drawTurned(out, parts.arms[i], a.elbow, -rp.arm[i], [a.elbow[0], a.elbow[1] - rp.lift]);
  };
  // the pelvis: the legs' top rows, unturned, under everything so a swinging thigh leaves no hole at the hip
  const g0 = view(v);
  const inArms = (x: number, y: number) => rig.arms.some((a) => a.spans.some(([y0, y1, x0, x1]) => y >= y0 && y <= y1 && x >= x0 && x <= x1));
  for (const l of rig.legs)
    for (let y = l.box[1]; y < l.box[1] + 3; y++)
      for (let x = l.box[0]; x <= l.box[2]; x++) {
        const c = g0[y * W + x];
        if (c && !inArms(x, y)) out[(y - rp.lift) * W + x] = c;
      }
  // back to front: far forearm, far leg, the body, near leg, near forearm. A far arm reaching
  // forward (at a desk, or swinging ahead in the walk) comes in front of the body so it never vanishes.
  const farFront = rp.armFront || (rp.walk ? rp.walk.swing[0] > 0.5 : false);
  if (!farFront) drawArm(0);
  drawLeg(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = parts.base[y * W + x];
      const ty = y - rp.lift;
      if (c && ty >= 0) out[ty * W + x] = c;
    }
  if (farFront) drawArm(0);
  drawLeg(1);
  drawArm(1);
  return out;
}

/** The walk: 8 frames, a sine stride; the swinging leg bends its knee, the body rises as the legs pass. */
function walkRig(f: number): RigPose {
  const t = ((f % 8) / 8) * Math.PI * 2;
  const s = Math.sin(t);
  const c = Math.cos(t);
  const STRIDE = 5;
  return {
    thigh: [0, 0],
    knee: [0, 0],
    arm: [0, 0],
    lift: Math.abs(c) > 0.7 ? 1 : 0,
    walk: {
      // the feet step along the ground's diagonal; a foot swinging forward lifts as it passes under the body
      step: [STRIDE * s, -STRIDE * s],
      footLift: [Math.round(Math.max(0, c) * 4), Math.round(Math.max(0, -c) * 4)],
      // each hand swings with the opposite foot
      swing: [-9 * s, 9 * s],
    },
  };
}

// ── simple moves for the front and back views ────────────────

/**
 * Move the pixels of a region by dy rows. Moving up clears what the region
 * leaves behind; moving down stretches it, so a lowered arm stays on its shoulder.
 */
function shift(g: Grid, inRegion: (x: number, y: number) => boolean, dy: number): Grid {
  if (!dy) return g;
  const out = g.slice();
  if (dy < 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inRegion(x, y)) out[y * W + x] = null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inRegion(x, y)) continue;
      const c = g[y * W + x];
      const ny = y + dy;
      if (c && ny >= 0 && ny < H) out[ny * W + x] = c;
    }
  return out;
}

function mirror(g: Grid): Grid {
  const m: Grid = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + (W - 1 - x)] = g[y * W + x];
  return m;
}

/** The figure for this pose, as 80×128 colours (null = transparent), feet on row 120. */
export function composeTemplate(pose: Pose): Grid {
  const mirrored = pose.dir === 'sw' || pose.dir === 'nw';
  const v: View = pose.dir === 's' ? 's' : pose.dir === 'n' ? 'n' : pose.dir === 'ne' || pose.dir === 'nw' ? 'ne' : 'se';
  const m = META[v];
  const f = pose.frame;
  let g: Grid;
  let lift = 0;
  if (m.rig) {
    let rp: RigPose = { thigh: [0, 0], knee: [0, 0], arm: [0, 0], lift: 0 };
    if (pose.mode === 'walk') rp = walkRig(f);
    // hands busy in front (typing): the forearms reach forward, in turn
    else if (pose.mode === 'work') {
      // seen from the front the far hand comes across the body to the desk; from behind the body would hide it,
      // so it stays at the side, just forward
      if (v === 'se') {
        rp.arm = f % 2 ? [30, 46] : [38, 40];
        rp.armFront = true;
      } else rp.arm = f % 2 ? [8, 46] : [12, 40];
    }
    // the near hand gestures
    else if (pose.mode === 'talk') rp.arm = [4, f % 2 ? 48 : 30];
    lift = rp.lift;
    g = poseRig(v, rp);
  } else {
    g = view(v).slice();
    const armL = (x: number, y: number) => x <= m.armL && y >= m.armTop && y <= m.armBot;
    const armR = (x: number, y: number) => x >= m.armR && y >= m.armTop && y <= m.armBot;
    const legL = (x: number, y: number) => x < m.cx && y >= m.legTop;
    const legR = (x: number, y: number) => x >= m.cx && y >= m.legTop;
    if (pose.mode === 'walk') {
      const ph = f % 8;
      if (ph === 1 || ph === 2) g = shift(shift(shift(g, legL, -2), armR, -1), armL, 1);
      else if (ph === 5 || ph === 6) g = shift(shift(shift(g, legR, -2), armL, -1), armR, 1);
    } else if (pose.mode === 'work') {
      g = shift(g, armL, f % 2 ? -2 : -3);
      g = shift(g, armR, f % 2 ? -3 : -2);
    } else if (pose.mode === 'talk') g = shift(g, armR, f % 2 ? -3 : -1);
  }
  if (pose.mode === 'talk' && f % 2 && m.mouth) {
    for (const [x, y] of m.mouth.dark) g[(y - lift) * W + x] = '#5a2226';
    for (const [x, y] of m.mouth.tongue) g[(y - lift) * W + x] = '#d86a6a';
  }
  if (pose.blink && m.eyes) {
    const e = m.eyes;
    for (const [x0, x1] of e.boxes)
      for (let x = x0; x <= x1; x++) {
        for (let dy = 0; dy < 3; dy++) g[(e.top + dy - lift) * W + x] = e.skin;
        g[(e.top + 1 - lift) * W + x] = e.lash;
      }
  }
  return mirrored ? mirror(g) : g;
}

/** The 40×64 level of detail: each 2×2 block keeps its commonest colour, outlines first. */
export function halveTemplate(g: Grid): Grid {
  const w = W / 2;
  const h = H / 2;
  const out: Grid = new Array(w * h).fill(null);
  const lum = (c: string) => {
    const n = parseInt(c.slice(1), 16);
    return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cs = [g[2 * y * W + 2 * x], g[2 * y * W + 2 * x + 1], g[(2 * y + 1) * W + 2 * x], g[(2 * y + 1) * W + 2 * x + 1]].filter((c): c is string => !!c);
      if (cs.length < 2) continue;
      const dark = cs.filter((c) => lum(c) < 45);
      if (dark.length >= 2) {
        out[y * w + x] = dark[0];
        continue;
      }
      const n = new Map<string, number>();
      for (const c of cs) n.set(c, (n.get(c) ?? 0) + 1);
      out[y * w + x] = [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  return out;
}

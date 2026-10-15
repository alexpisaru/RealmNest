// Cast assets: hair styles and the face's extras (facial hair, freckles, earring).
//
// The head is never reshaped by kind or build, so everything on the skull is drawn in absolute
// frame coordinates (the regular body's, as in tools/charpipe/factory/standard.ts, whose long and
// short hair are Maya's and Teo's). Hair that falls onto the shoulders and back follows the body:
// below the jaw each row slides with the near shoulder (`follow`). Hair in front of the head is on
// part 'head'; what falls behind the head and body is on 'hair_back' (drawn behind everything).
//
// Each layer is painted into a Sheet first (a little colour buffer with the Pen calls, details
// clipped to what is already painted), so shapes, cel shading and strands compose freely and the
// result can be bent to the body before it reaches the real pen.
import { Mask, type Pt } from '../../hd/mask';
import { asset, type AssetDef, type Material, type Slot } from '../catalog';
import { far, shaded, type Piece } from '../draw';
import type { BodyGeometry, Part } from '../body';
import { CANON, type Ramp } from '../palette';
import type { Pen } from '../pen';

const W = 80;
const H = 128;
const HR = CANON.hair;
const AC = CANON.accent;
const SK = CANON.skin;

const P = (pts: Pt[]) => Mask.poly(W, H, pts);
const E = (cx: number, cy: number, rx: number, ry: number) => Mask.ellipse(W, H, cx, cy, rx, ry);
const any = (...ms: Mask[]) => ms.reduce((a, m) => a.or(m), new Mask(W, H));

/** the skull (the head part without the ear), the ear, and what hair must leave clear */
const SKULL = P([[37, 33], [33, 32], [30, 29], [28, 25], [27, 19], [29, 13], [33, 9], [38, 7], [44, 6], [49, 7], [53, 9], [56, 13], [57, 18], [56, 22], [55, 24], [55, 30], [54, 32], [53, 34], [52, 35], [50, 37], [47, 39], [44, 39], [41, 37]]);
const EAR = P([[34, 26], [37, 25], [39, 27], [39, 31], [37, 33], [35, 32], [34, 29]]);
/** the ear and the ring around it (the hair's outline falls on the ring, the ear stays whole) */
const EAR_CLEAR = EAR.dilate(1);
/** the face below the brows' line: eyes, nose, mouth, cheek (the hair's ring may touch row 22 and the temple at x 39) */
const FACE = P([[39, 22], [64, 22], [64, 46], [38, 46], [38, 27], [39, 27]]);

/** a 1-px pencil stroke (Bresenham), as a mask */
function stroke(pts: Pt[]): Mask {
  const m = new Mask(W, H);
  if (pts.length === 1) m.set(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      m.set(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  return m;
}

/**
 * A layer being painted: the Pen calls into a colour buffer. Lines and dots only land on pixels
 * already painted (strands and partings never leave the hair); fills paint anywhere unless locked.
 */
class Sheet implements Pen {
  readonly px: (string | undefined)[] = new Array(W * H);
  private put(x: number, y: number, c: string, lock: boolean) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (lock && !this.px[y * W + x]) return;
    this.px[y * W + x] = c;
  }
  mask(m: Mask, c: string, lock = false) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.get(x, y)) this.put(x, y, c, lock);
  }
  poly(pts: Pt[], c: string, lock = false) {
    this.mask(P(pts), c, lock);
  }
  rect(x: number, y: number, w: number, h: number, c: string, lock = false) {
    this.mask(Mask.rect(W, H, x, y, w, h), c, lock);
  }
  line(pts: Pt[], c: string) {
    this.mask(stroke(pts), c, true);
  }
  dots(pts: Pt[], c: string) {
    for (const [x, y] of pts) this.put(x, y, c, true);
  }
  eraseMask(m: Mask) {
    for (let i = 0; i < W * H; i++) if (m.d[i]) this.px[i] = undefined;
  }
  /** everything painted */
  shape() {
    return new Mask(W, H).map((x, y) => (this.px[y * W + x] ? 1 : 0));
  }
  /** every row y slid right by dx(y) */
  warp(dx: (y: number) => number) {
    const s = new Sheet();
    for (let y = 0; y < H; y++) {
      const d = dx(y);
      for (let x = 0; x < W; x++) {
        const c = this.px[y * W + x];
        if (c && x + d >= 0 && x + d < W) s.px[y * W + x + d] = c;
      }
    }
    return s;
  }
  emit(pen: Pen) {
    const by = new Map<string, Mask>();
    this.px.forEach((c, i) => {
      if (!c) return;
      const m = by.get(c) ?? by.set(c, new Mask(W, H)).get(c)!;
      m.d[i] = 1;
    });
    for (const [c, m] of by) pen.mask(m, c);
  }
}

/**
 * Below the jaw, hair resting on the shoulders slides with the near shoulder (narrow builds bring
 * it in, broad ones push it out): nothing above row y0, the full shift from y1 down.
 */
function follow(g: BodyGeometry, y0 = 34, y1 = 46) {
  const d = g.at('upper_arm_R', 23, 50)[0] - 23;
  return (y: number) => Math.round(d * Math.max(0, Math.min(1, (y - y0) / (y1 - y0))));
}

type Layer = { part: Part; material: string; sheet: Sheet };
/** an asset from its layers: each layer a sheet painted once per body */
function style(id: string, label: string, slot: Slot, materials: Material[], layers: (g: BodyGeometry) => Layer[]): AssetDef {
  return asset({
    id,
    slot,
    label,
    materials,
    pieces: (g, aid) =>
      layers(g).map((l): Piece => {
        // no 1-px spurs on any silhouette (the runtime's outline pass would cut them anyway)
        if (!UNOUTLINED.has(id)) trim(l.sheet);
        return { asset: aid, part: l.part, material: l.material, draw: (pen) => l.sheet.emit(pen) };
      }),
  });
}
const sheet = (paint: (s: Sheet) => void) => {
  const s = new Sheet();
  paint(s);
  return s;
};

/** a fill lit from the upper left, then clipped to `keep` */
function fillHair(s: Sheet, m: Mask, r: Ramp = HR, opts: Parameters<typeof shaded>[3] = {}) {
  shaded(s, m, r, opts);
}

// ── Maya's long hair and Teo's tousled crop (standard.ts, as drawn) ───────────────────────────

function long(): AssetDef {
  return style('hair:long', 'Long', 'hair', ['hair'], (g) => {
    const back = sheet((s) => {
      s.poly([[28, 14], [24, 22], [22, 34], [20, 48], [18, 62], [18, 72], [20, 76], [22, 74], [24, 77], [26, 74], [28, 76], [31, 70], [33, 64], [35, 50], [37, 40], [38, 28], [36, 14]], HR.base);
      // the far side: a lock falling behind the cheek (the face covers all but its edge)
      s.poly([[50, 14], [57, 15], [59, 22], [59, 31], [57, 37], [55, 39], [52, 30]], HR.shade);
      s.poly([[31, 30], [38, 30], [36, 44], [34, 56], [32, 66], [29, 76], [26, 76], [29, 62], [31, 48]], HR.shade, true);
      s.poly([[34, 36], [38, 36], [36, 46], [34, 46]], HR.deep, true);
      s.line([[24, 24], [22, 36], [21, 48]], HR.hl);
      s.line([[20, 54], [19, 66]], HR.hl);
      s.line([[27, 26], [25, 44], [24, 62], [23, 72]], HR.shade);
      s.line([[57, 18], [58, 30]], HR.deep);
    }).warp(follow(g));
    const front = sheet((s) => {
      s.poly([[26, 22], [26, 16], [29, 12], [31, 11], [33, 8], [36, 7], [40, 5], [42, 6], [46, 6], [48, 7], [53, 9], [56, 11], [57, 13], [59, 18], [58, 22], [56, 21], [54, 22], [52, 20], [49, 21], [46, 20], [44, 21], [41, 20], [38, 23], [38, 29], [38, 36], [35, 40], [30, 37], [27, 30]], HR.base);
      // a long lock falling in front of the near shoulder
      s.poly([[31, 34], [38, 34], [37, 42], [36, 50], [34, 56], [32, 58], [31, 54], [30, 46]], HR.base);
      s.eraseMask(FACE);
      s.poly([[26, 24], [29, 23], [32, 31], [33, 40], [30, 37], [27, 30]], HR.shade, true);
      s.poly([[38, 19], [59, 18], [59, 23], [38, 23]], HR.shade, true);
      s.poly([[35, 26], [39, 26], [39, 37], [36, 39]], HR.shade, true);
      s.line([[29, 14], [33, 10], [38, 8]], HR.hl);
      s.line([[28, 17], [32, 13], [37, 11], [42, 10]], HR.hl);
      s.line([[47, 9], [44, 17]], HR.shade);
      s.line([[53, 11], [51, 17]], HR.shade);
      s.line([[39, 11], [37, 17]], HR.shade);
      s.line([[29, 21], [30, 28]], HR.hl);
      s.line([[31, 38], [31, 52]], HR.hl);
      s.line([[35, 38], [34, 50], [33, 55]], HR.shade);
    }).warp(follow(g));
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

function tousled(): AssetDef {
  return style('hair:tousled', 'Tousled', 'hair', ['hair'], () => {
    const back = sheet((s) => s.poly([[28, 16], [26, 24], [27, 34], [31, 40], [36, 38], [37, 20]], HR.shade));
    const front = sheet((s) => {
      s.poly([[25, 22], [26, 15], [30, 10], [35, 6], [40, 7], [43, 4], [47, 7], [52, 7], [56, 11], [59, 16], [58, 22], [57, 20], [55, 22], [53, 20], [51, 22], [49, 20], [47, 22], [45, 20], [43, 22], [41, 20], [39, 22], [38, 24], [37, 31], [34, 36], [30, 35], [27, 30]], HR.base);
      s.eraseMask(FACE);
      s.poly([[25, 24], [31, 22], [36, 30], [34, 36], [27, 32]], HR.shade, true);
      s.poly([[38, 18], [59, 17], [59, 23], [38, 23]], HR.shade, true);
      s.line([[29, 13], [33, 9], [37, 8]], HR.hl);
      s.line([[41, 8], [45, 7]], HR.hl);
      s.line([[47, 9], [44, 16]], HR.shade);
      s.line([[53, 11], [50, 17]], HR.shade);
      s.line([[39, 11], [37, 17]], HR.shade);
    });
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

// ── short caps ───────────────────────────────────────────────

/** a close crop: the skull grown by `v`, down to a hairline (front to nape), the ear left clear */
function crop(v: number, hairline: Pt[]) {
  const zone = P([[0, 0], [80, 0], ...hairline, [0, 40]]);
  return SKULL.dilate(v).and(zone).sub(EAR_CLEAR).sub(FACE);
}
/**
 * The hairline, front to nape, shared by every style: a low curve 2-3 rows above the brows (row 19
 * over the near eye, 18 in the middle, 19 at the far side), down the near temple to a sideburn in
 * front of the ear, round the ear and down to the nape. Swept-back styles start here too.
 */
const HAIRLINE: Pt[] = [[80, 20], [56, 20], [52, 19], [46, 19], [44, 20], [39, 20], [39, 26], [38, 26], [36, 24], [34, 25], [33, 30], [35, 34], [30, 40]];

/** the shadow side of a head of hair: behind the ear line, toward the nape */
const NAPE_SHADE: Pt[] = [[22, 21], [31, 19], [34, 24], [34, 40], [22, 40]];

/** a mask of single pixels */
const pixels = (pts: Pt[]) => {
  const m = new Mask(W, H);
  for (const [x, y] of pts) m.set(x, y);
  return m;
};

function crew(): AssetDef {
  return style('hair:crew', 'Crew cut', 'hair', ['hair'], () => {
    const m = crop(1, HAIRLINE);
    const front = sheet((s) => {
      fillHair(s, m, HR, { core: 3 });
      s.poly(NAPE_SHADE, HR.shade, true);
      // a flat-topped sheen, and the bristle along the hairline
      s.line([[29, 12], [33, 9], [38, 7], [44, 6]], HR.hl);
      s.line([[32, 12], [36, 10]], HR.hl);
      for (const x of [42, 45, 48, 51, 54]) s.line([[x, 18], [x + 1, 16]], HR.shade);
      s.line([[29, 26], [32, 30]], HR.deep);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function shaved(): AssetDef {
  return style('hair:shaved', 'Buzzed', 'hair', ['hair'], () => {
    const m = crop(0, HAIRLINE);
    const front = sheet((s) => {
      // a thin dark layer: the shade tones, with a fine stipple of the deepest one
      fillHair(s, m, far(HR), { core: 3 });
      s.mask(m.map((x, y) => ((x + y) % 2 === 0 && (x * 3 + y) % 4 === 0 ? 1 : 0)), HR.deep, true);
      s.poly(NAPE_SHADE, HR.deep, true);
      s.mask(P(NAPE_SHADE).map((x, y) => ((x + y) % 2 === 0 ? 1 : 0)), HR.shade, true);
      s.line([[30, 12], [34, 9], [39, 8]], HR.base);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function spiky(): AssetDef {
  return style('hair:spiky', 'Spiky', 'hair', ['hair'], () => {
    // gelled spikes swept up and back, a spiked fringe pointing down over the forehead
    const outline: Pt[] = [[40, 18], [42, 21], [44, 16], [47, 21], [48, 15], [51, 20], [52, 14], [56, 19], [56, 13], [60, 15], [58, 10], [62, 7], [56, 7], [57, 3], [51, 5], [49, 2], [45, 5], [41, 2], [39, 5], [34, 3], [34, 7], [28, 5], [30, 9], [24, 10], [27, 13], [22, 16], [26, 18], [24, 22], [27, 23], [27, 26], [30, 30], [34, 33], [33, 26], [36, 24], [38, 23], [38, 26], [40, 26]];
    const m = P(outline).or(crop(0, HAIRLINE)).sub(EAR_CLEAR).sub(FACE);
    const front = sheet((s) => {
      fillHair(s, m, HR, { core: 3 });
      s.poly(NAPE_SHADE, HR.shade, true);
      // each spike: lit on its upper-left flank, a parting down its middle
      for (const [bx, by, tx, ty] of [[36, 10, 34, 3], [41, 9, 41, 2], [46, 9, 49, 2], [52, 10, 56, 3], [56, 12, 61, 8], [31, 12, 29, 6], [28, 15, 24, 11], [27, 18, 23, 16]] as const) {
        s.line([[bx, by], [tx, ty]], HR.shade);
        s.line([[bx - 1, by - 1], [tx - 1, ty + 1]], HR.hl);
      }
      for (const [x, y] of [[43, 15], [47, 15], [51, 14], [55, 14]] as const) s.line([[x, y], [x + 1, y + 4]], HR.deep);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

/** a sleek cap pulled back off the forehead (for tied-up styles) */
const sleek = () => crop(0, HAIRLINE).or(SKULL.dilate(1).rows(0, 10)).sub(EAR_CLEAR).sub(FACE);

function bun(): AssetDef {
  return style('hair:bun', 'Top bun', 'hair', ['hair', 'accent'], () => {
    const cap = sleek();
    const knot = E(37, 5.9, 5.2, 3.9);
    const tie = P([[31, 8.5], [43, 7.5], [43, 9.6], [31, 10.6]]).and(knot.dilate(1).or(cap));
    const front = sheet((s) => {
      fillHair(s, cap, HR, { core: 3 });
      s.poly(NAPE_SHADE, HR.shade, true);
      // combed back toward the knot
      for (const [x, y] of [[55, 18], [49, 17], [44, 18], [41, 19]] as const) s.line([[x, y], [Math.round(38 + (x - 38) * 0.35), 9]], HR.shade);
      s.line([[30, 27], [31, 15]], HR.shade);
      s.line([[29, 18], [32, 12]], HR.hl);
      // the knot: a ball lit from the upper left, a twist line, then the tie under it
      shaded(s, knot, HR, { core: 2 });
      s.line([[34, 5], [37, 4], [40, 5], [41, 7]], HR.shade);
      s.line([[33, 7], [36, 7], [38, 6]], HR.deep);
      s.mask(tie, AC.base);
      s.mask(tie.sub(tie.shift(0, -1)), AC.shade, true);
      s.line([[32, 9], [35, 9]], AC.hl);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function ponytail(): AssetDef {
  return style('hair:ponytail', 'Ponytail', 'hair', ['hair', 'accent'], (g) => {
    const cap = sleek();
    const tie = P([[24, 13], [28, 12], [29, 18], [25, 19]]);
    const front = sheet((s) => {
      fillHair(s, cap, HR, { core: 3 });
      s.poly(NAPE_SHADE, HR.shade, true);
      // combed back toward the tie
      for (const [x, y] of [[55, 18], [49, 17], [44, 18], [41, 19], [37, 10]] as const) s.line([[x, y], [30, 15]], HR.shade);
      s.line([[33, 8], [29, 12]], HR.hl);
      s.mask(tie, AC.base);
      s.line([[25, 13], [25, 18]], AC.hl);
      s.line([[28, 13], [28, 18]], AC.shade);
    });
    const back = sheet((s) => {
      // the tail: out from the tie, then down the back
      const tail = P([[28, 12], [24, 12], [21, 15], [19, 20], [19, 28], [20, 36], [22, 43], [24, 47], [26, 43], [26, 36], [25, 29], [26, 22], [27, 18]]);
      fillHair(s, tail, far(HR), { core: 2 });
      s.line([[21, 18], [20, 26], [21, 36]], HR.base);
      s.line([[23, 16], [22, 28], [23, 38], [24, 44]], HR.deep);
      s.line([[25, 20], [24, 30]], HR.shade);
    }).warp(follow(g, 30, 46));
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

function undercut(): AssetDef {
  return style('hair:undercut', 'Undercut', 'hair', ['hair'], () => {
    // a long top swept up and over to the front, the sides clippered short
    const top = P([[29, 13], [28, 10], [31, 6], [36, 3.5], [42, 2], [49, 2], [55, 3.5], [59, 6], [61, 10], [60, 14], [58, 18], [57, 20], [52, 19], [46, 19], [44, 20], [39, 20], [37, 16], [34, 13]]).sub(FACE);
    const sides = crop(0, HAIRLINE).sub(top);
    const front = sheet((s) => {
      fillHair(s, sides, far(HR), { noCore: true });
      s.mask(sides.map((x, y) => ((x + y) % 2 === 0 ? 1 : 0)), HR.deep, true);
      fillHair(s, top, HR, { core: 2 });
      // the top's sweep: strands running from the crown out to the front lock
      s.line([[31, 10], [37, 5], [44, 3], [51, 3]], HR.hl);
      s.line([[33, 11], [39, 7], [46, 6]], HR.hl);
      s.line([[38, 11], [45, 9], [52, 9], [57, 13]], HR.shade);
      s.line([[47, 5], [54, 6], [59, 10]], HR.shade);
      s.line([[53, 12], [56, 17]], HR.deep);
      s.line([[40, 13], [44, 17], [45, 19]], HR.shade);
      s.line([[47, 12], [50, 16], [50, 18]], HR.shade);
      s.mask(top.dilate(1).sub(top).and(sides), HR.deep, true);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function bob(): AssetDef {
  return style('hair:bob', 'Bob', 'hair', ['hair'], () => {
    // a rounded cap with blunt bangs, the sides falling to the jaw and curling under
    const m = P([[40, 22], [58, 22], [59, 16], [58, 11], [55, 7], [50, 4], [44, 3], [38, 4], [32, 6], [28, 10], [25, 15], [24, 22], [24, 30], [25, 35], [28, 38], [33, 39], [37, 38], [38, 33], [38, 22]]).sub(FACE);
    const front = sheet((s) => {
      fillHair(s, m, HR, { core: 3 });
      s.poly([[22, 22], [30, 20], [35, 26], [36, 40], [22, 40]], HR.shade, true);
      s.poly([[22, 37], [40, 36], [40, 41], [22, 41]], HR.deep, true);
      s.line([[27, 13], [31, 9], [37, 6], [43, 5]], HR.hl);
      s.line([[26, 18], [30, 13], [35, 10]], HR.hl);
      // the bangs' partings and the cut line
      for (const x of [43, 47, 51, 55]) s.line([[x, 17], [x, 21]], HR.shade);
      s.line([[28, 21], [27, 33]], HR.hl);
      s.line([[33, 22], [34, 35]], HR.deep);
    });
    const back = sheet((s) => {
      // the far side, behind the cheek
      fillHair(s, P([[53, 12], [58, 13], [60, 19], [60, 30], [59, 37], [56, 38], [54, 33]]), far(HR), { noCore: true });
      s.line([[57, 16], [58, 34]], HR.deep);
    });
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

/**
 * Curls as little balls painted back to front: each lit on its upper left, shadowed on its lower
 * right, with a deep crease where it sits on the curls before it.
 */
function blobs(s: Sheet, at: Pt[], r: number, ramp: Ramp, clip: Mask) {
  for (const [x, y] of at) {
    const b = E(x, y, r, r).and(clip);
    const under = s.shape();
    s.mask(b, ramp.base);
    s.mask(b.sub(b.shift(1, 1)).sub(b.sub(b.shift(-1, -1))), ramp.hl, true);
    s.mask(b.sub(b.shift(-1, -1)), ramp.shade, true);
    s.mask(b.sub(b.shift(-1, -1)).and(under.shift(-1, -1)).and(under), ramp.deep, true);
  }
}
/** centres on a jittered grid inside a mask, top to bottom (so lower curls sit over higher ones) */
function scatter(m: Mask, step: number, seed: number): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < H; y += step - 1)
    for (let x = (Math.floor(y / (step - 1)) % 2) * Math.floor(step / 2); x < W; x += step) {
      const p: Pt = [x + (hash(x + seed, y, 3) - 1) + 0.5, y + (hash(y, x + seed, 3) - 1) + 0.5];
      if (m.get(Math.floor(p[0]), Math.floor(p[1]))) out.push(p);
    }
  return out;
}

function curly(): AssetDef {
  return style('hair:curly', 'Curly', 'hair', ['hair'], (g) => {
    // a cap of springy curls, a curly fringe above the brows, curls falling to the collar behind
    const area = any(SKULL.dilate(1).and(P([[0, 0], [80, 0], [80, 19], [56, 19], [52, 18], [46, 18], [44, 19], [39, 19], [39, 26], [38, 26], [36, 24], [34, 25], [31, 30], [33, 35], [0, 35]])))
      .sub(EAR_CLEAR)
      .sub(FACE);
    const clip = new Mask(W, H).map((_, y) => (y >= 2 ? 1 : 0)).sub(EAR_CLEAR).sub(FACE);
    const front = sheet((s) => {
      s.mask(area, HR.shade);
      blobs(s, scatter(area, 5, 0), 2.7, HR, clip);
      s.poly(NAPE_SHADE, HR.shade, true);
      trim(s);
    });
    const back = sheet((s) => {
      const fall = P([[27, 14], [21, 20], [20, 30], [22, 38], [30, 41], [38, 37], [37, 18]]);
      s.mask(fall, HR.deep);
      blobs(s, scatter(fall, 5, 7), 2.7, far(HR), new Mask(W, H).map(() => 1));
      trim(s);
    }).warp(follow(g));
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

/** a stable pseudo-random number in 0..n-1 for a pixel (textures that never repeat as a grid) */
const hash = (x: number, y: number, n: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 9973) % n;

/** a ball lit from the upper left: a lit crescent, the base, the shadowed side and its rim */
function ball(s: Sheet, m: Mask, cx: number, cy: number, rx: number, ry: number, r: Ramp) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m.get(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const l = -(dx * 0.6 + dy * 0.8);
      s.dots([[x, y]], l > 0.42 ? r.hl : l > -0.3 ? r.base : l > -0.72 ? r.shade : r.deep);
    }
}

function afro(): AssetDef {
  return style('hair:afro', 'Afro', 'hair', ['hair'], () => {
    // one big round mass framing the face, a texture of tight coils, the face left clear
    const cx = 42;
    const cy = 17;
    const rx = 20;
    const ry = 16;
    const top = new Mask(W, H).map((_, y) => (y >= 2 ? 1 : 0));
    // a soft, bumpy rim: little rounds all along the edge
    const rim: Mask[] = [];
    for (let a = 0; a < 360; a += 15) rim.push(E(cx + Math.cos((a * Math.PI) / 180) * (rx - 1), cy + Math.sin((a * Math.PI) / 180) * (ry - 1), 2.4, 2.4));
    const all = any(E(cx, cy, rx - 0.5, ry - 0.5), E(31, 25, 8, 9), ...rim).and(top);
    const zone = P([[0, 0], [80, 0], ...HAIRLINE.slice(0, 10), [31, 30], [33, 38], [0, 38]]);
    /** coils: a small cupped shadow under each, a lit fleck over it on the light side */
    const coils = (s: Sheet, area: Mask, seed: number) => {
      const inside = area.erode(1);
      for (const [fx, fy] of scatter(inside, 5, seed)) {
        const x = Math.floor(fx);
        const y = Math.floor(fy);
        const l = -(((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8);
        s.line([[x - 1, y], [x, y + 1], [x + 1, y + 1], [x + 2, y]], l < -0.3 ? HR.deep : HR.shade);
        if (l > -0.1) s.line([[x, y - 1], [x + 1, y - 1]], HR.hl);
      }
    };
    const front = sheet((s) => {
      const m = all.and(zone).sub(EAR_CLEAR).sub(FACE);
      s.mask(m, HR.base);
      ball(s, m, cx, cy, rx, ry, HR);
      coils(s, m, 3);
      s.poly([[18, 22], [31, 20], [34, 25], [34, 40], [18, 40]], HR.shade, true);
      trim(s);
    });
    // the far side's volume, behind the brow and cheek
    const back = sheet((s) => {
      const b = all.and(P([[52, 13], [80, 13], [80, 40], [52, 40]]));
      s.mask(b, HR.shade);
      ball(s, b, cx, cy, rx, ry, far(HR));
      coils(s, b, 5);
      trim(s);
    });
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

/** a point of a lock's spine: x, y, half-width */
type Knot = [number, number, number];
/** a lock of hair: a ribbon along a spine, as wide as each knot says (0 = a pointed tip) */
function ribbon(spine: Knot[]): Mask {
  const left: Pt[] = [];
  const right: Pt[] = [];
  spine.forEach(([x, y, w], i) => {
    const [ax, ay] = spine[Math.max(0, i - 1)];
    const [bx, by] = spine[Math.min(spine.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  });
  return P([...left, ...right.reverse()]);
}
/**
 * Locks painted back to front: each one cel-shaded on its own (lit upper left, shadowed lower
 * right), with a deep crease where it lies over the locks before it.
 */
function locks(s: Sheet, list: Knot[][], r: Ramp, clip?: Mask) {
  for (const spine of list) {
    let L = ribbon(spine);
    if (clip) L = L.and(clip);
    const under = s.shape();
    shaded(s, L, r, { core: 1 });
    // the crease: this lock's lower-right rim, where it covers hair already there
    s.mask(L.sub(L.shift(-1, -1)).and(under.shift(-1, -1)).and(under), r.deep, true);
  }
}
/** strip 1-px spurs (pixels with one neighbour or none) from a sheet's silhouette, as the runtime would */
function trim(s: Sheet) {
  for (let pass = 0; pass < 8; pass++) {
    const m = s.shape();
    const spurs = m.map((x, y, v) => (v && m.get(x + 1, y) + m.get(x - 1, y) + m.get(x, y + 1) + m.get(x, y - 1) <= 1 ? 1 : 0));
    if (!spurs.count()) break;
    s.eraseMask(spurs);
  }
}

function mane(): AssetDef {
  return style('hair:mane', 'Wavy mane', 'hair', ['hair'], (g) => {
    // the founder's mane: a big wavy volume, locks swept forward into a ragged fringe, curling
    // tips flaring off the crown, waves falling past the ear to the shoulders
    const keep = new Mask(W, H).map((_, y) => (y >= 2 ? 1 : 0)).sub(FACE);
    const front = sheet((s) => {
      // under the locks, the skull's cover in shadow (no skin between them)
      s.mask(SKULL.dilate(1).and(P([[0, 0], [80, 0], [80, 16], [41, 16], [39, 26], [37, 38], [0, 38]])).sub(FACE), HR.shade);
      locks(
        s,
        [
          // behind the ear, falling to the nape in waves
          [[30, 10, 2], [25, 15, 3.5], [23, 21, 3.5], [25, 27, 3], [22, 33, 2], [23, 36, 0.5]],
          [[34, 11, 2.5], [29, 17, 4], [28, 24, 4], [30, 30, 3], [27, 35, 2], [28, 39, 0.5]],
          [[37, 14, 2.5], [34, 20, 3.5], [36, 27, 3.5], [33, 33, 2.5], [35, 39, 0.5]],
          // flyaway curls off the crown
          [[34, 7, 2], [30, 4, 1.5], [26, 5, 0.4]],
          [[50, 5, 2], [55, 2, 1.2], [59, 3, 0.4]],
          // from the crown's whorl over the top and down into the fringe: far locks first
          [[46, 5, 2], [53, 4.5, 2.5], [58, 7, 3], [61, 11, 3], [59, 14, 2.5], [60, 18, 1.5], [58, 21, 0.4]],
          [[40, 5, 2], [47, 4.5, 2.5], [53, 5.5, 3], [57, 9, 3.5], [56, 13, 3], [57, 17, 1.5], [55, 21.5, 0.4]],
          [[36, 6, 2], [42, 4.5, 3], [48, 5, 3.5], [52, 9, 3.5], [50, 13, 3], [51, 17, 1.5], [50, 21.5, 0.4]],
          [[33, 7, 2], [38, 5.5, 3], [43, 6, 3.5], [46, 10, 3.5], [44, 14, 3], [45, 18, 2], [44, 21.5, 0.4]],
          [[30, 9, 2], [34, 7, 3], [38, 9, 3.5], [38, 13, 3], [40, 17, 2.5], [39, 24, 0.5]],
        ],
        HR,
        keep,
      );
      trim(s);
    });
    const back = sheet((s) => {
      locks(
        s,
        [
          [[34, 10, 5], [27, 18, 6], [24, 28, 6], [24, 38, 5], [21, 46, 0.5]],
          [[38, 16, 4], [33, 26, 5], [33, 36, 5], [30, 44, 4], [32, 50, 0.5]],
          [[30, 14, 3], [22, 22, 4], [19, 31, 4], [20, 38, 3], [17, 45, 0.5]],
          [[36, 30, 3], [37, 38, 4], [35, 46, 0.5]],
        ],
        far(HR),
      );
      trim(s);
    }).warp(follow(g));
    const farSide = sheet((s) => {
      // the far side's volume, behind the cheek
      locks(
        s,
        [
          [[54, 10, 3], [59, 15, 3.5], [61, 22, 3], [60, 29, 2], [62, 34, 0.4]],
          [[53, 18, 2], [57, 24, 3], [57, 31, 2], [55, 37, 0.4]],
        ],
        far(HR),
      );
      trim(s);
    });
    return [
      { part: 'hair_back', material: 'hair', sheet: back },
      { part: 'hair_back', material: 'hair', sheet: farSide },
      { part: 'head', material: 'hair', sheet: front },
    ];
  });
}

/** a box braid hanging from (x, y0) to y1, drifting dx per row; a bead at the end */
function braid(s: Sheet, x: number, y0: number, y1: number, r: Ramp, bead: boolean, dx = 0) {
  for (let y = y0; y <= y1; y++) {
    const bx = Math.round(x + (y - y0) * dx);
    const k = (y - y0) % 3;
    s.rect(bx, y, 3, 1, r.base);
    s.dots([[bx, y]], k === 0 ? r.hl : r.base);
    s.dots([[bx + 2, y]], k === 2 ? r.deep : r.shade);
    if (k === 2) s.dots([[bx + 1, y]], r.shade);
  }
  if (bead) {
    const bx = Math.round(x + (y1 + 1 - y0) * dx);
    s.rect(bx, y1 + 1, 3, 2, AC.base);
    s.dots([[bx, y1 + 1]], AC.hl);
    s.dots([[bx + 2, y1 + 2]], AC.shade);
  }
}

function braids(): AssetDef {
  return style('hair:braids', 'Box braids', 'hair', ['hair', 'accent'], (g) => {
    const cap = crop(1, HAIRLINE);
    const front = sheet((s) => {
      fillHair(s, cap, HR, { core: 3 });
      s.poly(NAPE_SHADE, HR.shade, true);
      // the boxes: partings in a grid over the scalp
      for (const [i, y] of [9, 13, 17, 21, 25, 29].entries())
        for (let x = 25 + (i % 2) * 3; x < 58; x += 6) {
          s.line([[x, y], [x + 2, y]], HR.deep);
          s.dots([[x + 3, y - 1], [x + 3, y - 2]], HR.shade);
        }
      s.line([[30, 9], [35, 7], [40, 6]], HR.hl);
      // two braids over the near shoulder
      braid(s, 31, 26, 50, HR, true, -0.04);
      braid(s, 34, 27, 46, HR, true, -0.02);
    });
    const backs = sheet((s) => {
      for (const [i, x] of [20, 23, 26, 29, 32].entries()) braid(s, x, 14 + i, 58 - (i % 2) * 5 - i, far(HR), true, -0.06);
      // the far side, behind the cheek
      braid(s, 56, 18, 38, far(HR), true, 0.02);
      braid(s, 53, 16, 34, far(HR), false, 0.04);
    }).warp(follow(g));
    return [
      { part: 'hair_back', material: 'hair', sheet: backs },
      { part: 'head', material: 'hair', sheet: front.warp(follow(g)) },
    ];
  });
}

// ── the face: facial hair, freckles, an earring ──────────────

/** where facial hair must never go: the eyes */
const EYES = P([[40, 22], [55, 22], [55, 31], [40, 31]]);

function beard(): AssetDef {
  return style('face:beard', 'Beard', 'face', ['hair'], () => {
    // from the sideburns along the jaw to a full chin, a moustache over the lip
    const m = any(
      SKULL.and(P([[37, 29], [39, 29], [39, 32], [42, 33], [45, 33], [47, 32], [52, 32], [58, 32], [58, 46], [34, 46], [34, 34], [37, 33]])),
      P([[40, 36], [44, 41], [48, 41], [52, 38], [54, 34], [52, 33]]),
    )
      .sub(EAR)
      .sub(EYES);
    const front = sheet((s) => {
      fillHair(s, m, HR, { core: 2 });
      trim(s);
      s.poly([[34, 36], [58, 36], [58, 46], [34, 46]], HR.shade, true);
      s.line([[39, 29], [41, 33]], HR.hl);
      s.line([[44, 34], [44, 38]], HR.hl);
      // the lips' line through the hair, the moustache's lower edge
      s.line([[47, 34], [50, 34]], HR.deep);
      s.line([[46, 33], [52, 33]], HR.shade);
      s.line([[42, 37], [45, 40], [49, 40]], HR.deep);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function mustache(): AssetDef {
  return style('face:mustache', 'Moustache', 'face', ['hair'], () => {
    // over the upper lip, the near end drooping past the mouth's corner
    const m = P([[45, 33], [47, 32], [53, 32], [54, 33], [54, 34], [47, 34], [46, 35], [45, 35]]);
    const front = sheet((s) => {
      fillHair(s, m, HR, { noCore: true });
      s.line([[47, 32], [50, 32]], HR.hl);
    });
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function stubble(): AssetDef {
  return style('face:stubble', 'Stubble', 'face', ['hair'], () => {
    // a light speckle over the jaw, chin and upper lip (not a shape: no fill, no edge)
    const area = SKULL.and(P([[37, 29], [40, 29], [40, 30], [43, 32], [53, 31], [55, 32], [55, 46], [34, 46], [36, 31]])).sub(EAR_CLEAR).sub(EYES).sub(P([[46, 34], [52, 34], [52, 35], [46, 35]]));
    // denser along the jaw's edge, thinning up the cheek
    const edge = area.sub(area.erode(2));
    const front = sheet((s) => s.mask(area.map((x, y, v) => (v && (x + y) % 2 === 0 && (edge.get(x, y) || hash(x, y, 2) === 0) ? 1 : 0)), HR.shade));
    return [{ part: 'head', material: 'hair', sheet: front }];
  });
}

function freckles(): AssetDef {
  return style('face:freckles', 'Freckles', 'face', ['skin'], () => {
    const front = sheet((s) => s.mask(pixels([[42, 31], [44, 30], [46, 31], [51, 31], [53, 30], [54, 32], [48, 29]]), SK.deep));
    return [{ part: 'head', material: 'skin', sheet: front }];
  });
}

function earring(): AssetDef {
  return style('face:earring', 'Earring', 'face', ['accent'], () => {
    const front = sheet((s) => {
      // a small drop on the lobe
      s.rect(35, 33, 2, 3, AC.base);
      s.dots([[35, 33]], AC.hl);
      s.dots([[36, 35]], AC.shade);
    });
    return [{ part: 'head', material: 'accent', sheet: front }];
  });
}

export const HAIR: AssetDef[] = [
  mane(),
  tousled(),
  crew(),
  spiky(),
  shaved(),
  bun(),
  curly(),
  afro(),
  ponytail(),
  undercut(),
  bob(),
  braids(),
  long(),
  beard(),
  mustache(),
  stubble(),
  freckles(),
  earring(),
];

/**
 * Assets drawn only as marks inside the body (no silhouette of their own): the runtime must not
 * outline them or clean their silhouette, or every dot gets a ring (or vanishes).
 */
export const UNOUTLINED = new Set(['face:freckles', 'face:stubble']);

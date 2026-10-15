// Cast factory: the drawing helpers every asset uses, and the base body (skin, face, underwear).
// Shapes are masks from the body (cast/body.ts); details are placed in regular-body coordinates
// through the body's own mapping, so they follow every kind, build and height. Colours are the
// canonical ramps (cast/palette.ts); outlines are added after animation, per band.
import { Mask, type Pt } from '../hd/mask';
import { limbOf, type BodyGeometry, type Part } from './body';
import { CANON, FIXED, type Ramp } from './palette';
import type { Pen } from './pen';

/** one layer of one asset on one rig part */
export interface Piece {
  asset: string;
  part: Part;
  material: string;
  draw(pen: Pen): void;
}

/** the same ramp one step darker: what turns away from the light (the far limbs) */
export const far = (r: Ramp): Ramp => ({ hl: r.base, base: r.shade, shade: r.deep, deep: r.deep });

/**
 * Flat fill + cel shading lit from the upper left: a shadow band low-right, a lit core up-left.
 * `whole` is the shape the light falls on (a whole limb, a whole garment), so a piece cut from it
 * gets no bands along the cut.
 */
export function shaded(pen: Pen, m: Mask, c: Ramp, opts: { band?: number; core?: number; whole?: Mask; noCore?: boolean } = {}) {
  const w = opts.whole ?? m;
  pen.mask(m, c.base);
  const band = opts.band ?? 1;
  pen.mask(w.sub(w.shift(-band, -band)).or(w.sub(w.erode(1)).sub(w.shift(1, 1))).and(m), c.shade, true);
  if (!opts.noCore) pen.mask(w.erode(opts.core ?? 2).shift(-1, -1).and(w.erode(1)).and(m), c.hl, true);
}

/** placing regular-body coordinates on a body, for one part */
export function on(g: BodyGeometry, part: Part) {
  const R = (x: number, y: number) => g.at(part, x, y);
  return {
    R,
    poly: (pts: Pt[]) => g.poly(part, pts),
    /** rows y0..y1 (regular coordinates) of a mask */
    rows: (m: Mask, y0: number, y1: number) => m.rows(R(0, y0)[1], R(0, y1)[1]),
    line: (pen: Pen, pts: Pt[], c: string) => pen.line(pts.map(([x, y]) => R(x, y)), c),
    dots: (pen: Pen, pts: Pt[], c: string) => pen.dots(pts.map(([x, y]) => R(x, y)), c),
  };
}

// ── the base body ────────────────────────────────────────────

export function bodyPieces(g: BodyGeometry): Piece[] {
  const sk = CANON.skin;
  const fk = far(sk);
  const un = CANON.under;
  const fem = g.kind === 'fem';
  const out: Piece[] = [];
  const add = (part: Part, material: string, draw: (pen: Pen) => void) => out.push({ asset: 'body', part, material, draw });
  const skin = (part: Part, ramp: Ramp, detail?: (pen: Pen) => void) =>
    add(part, 'skin', (pen) => {
      shaded(pen, g.parts[part], ramp, { whole: limbOf(g, part) });
      detail?.(pen);
    });

  // far arm and leg, in the body's shadow
  skin('upper_arm_L', fk);
  skin('lower_arm_L', fk, (pen) => {
    const o = on(g, 'lower_arm_L');
    o.line(pen, [[54, 75], [58, 75]], fk.shade);
    o.dots(pen, [[56, 76], [56, 77]], fk.shade);
  });
  skin('lower_leg_L', fk, (pen) => {
    const o = on(g, 'lower_leg_L');
    // the far foot in profile: toes to the right
    o.line(pen, [[53, 113], [56, 113]], fk.shade);
    o.dots(pen, [[54, 115], [56, 115]], fk.shade);
  });
  skin('upper_leg_L', fk);
  // the torso: neck in the jaw's shadow, collarbones, navel
  add('torso', 'skin', (pen) => {
    const o = on(g, 'torso');
    shaded(pen, g.parts.torso, sk, { core: 3 });
    pen.mask(o.rows(g.neck, 34, 37), sk.shade, true);
    o.dots(pen, [[38, 44], [39, 44], [46, 44], [47, 44]], sk.shade);
    o.dots(pen, [[42, 66]], sk.deep);
    if (!fem) o.line(pen, [[36, 50], [40, 51]], sk.shade);
  });
  // underwear: briefs, and a sports top on the feminine body
  add('torso', 'under', (pen) => {
    const o = on(g, 'torso');
    const briefs = o.rows(g.parts.torso, 73, 84);
    shaded(pen, briefs, un, { noCore: true });
    pen.mask(o.rows(briefs, 73, 73), un.shade, true);
    if (fem) {
      const top = o.rows(g.parts.torso, 47, 56);
      shaded(pen, top, un, { noCore: true });
      pen.mask(o.rows(top, 56, 56), un.deep, true);
      o.line(pen, [[37, 42], [36, 46]], un.base);
      o.line(pen, [[48, 42], [49, 46]], un.shade);
    }
  });
  for (const side of ['R', 'L'] as const) {
    const part: Part = `upper_leg_${side}`;
    add(part, 'under', (pen) => {
      const o = on(g, part);
      const m = o.rows(g.parts[part], 70, 84);
      shaded(pen, m, side === 'L' ? far(un) : un, { noCore: true });
      pen.mask(o.rows(m, 84, 84), un.deep, true);
    });
  }
  // the head: ear, eyes, brows, nose, mouth (the face fixed for Maya and Teo)
  add('head', 'skin', (pen) => {
    const o = on(g, 'head');
    shaded(pen, g.parts.head, sk, { core: 4 });
    // under the jaw
    pen.mask(g.parts.head.and(Mask.poly(80, 128, [[41, 37], [52, 34], [52, 40], [41, 40]])), sk.shade, true);
    // the ear: its rim lit, the bowl in shadow
    pen.mask(g.ear, sk.base, true);
    o.line(pen, [[36, 27], [37, 27]], sk.hl);
    o.line(pen, [[36, 28], [36, 31]], sk.deep);
    o.dots(pen, [[37, 29], [37, 30]], sk.shade);
    // eyes on one line (lid row 26, eye rows 27–29), looking ahead: near 3 px, far 2 px
    pen.line([[41, 26], [45, 26]], FIXED.outline);
    pen.dots([[42, 27], [42, 28]], FIXED.eyeWhite);
    pen.rect(43, 27, 2, 3, CANON.eyes.base);
    pen.dots([[44, 27], [44, 28]], FIXED.outline);
    pen.dots([[43, 27]], FIXED.white);
    pen.line([[49, 26], [52, 26]], FIXED.outline);
    pen.rect(50, 27, 2, 3, CANON.eyes.base);
    pen.dots([[51, 27], [51, 28]], FIXED.outline);
    pen.dots([[50, 27]], FIXED.white);
    // brows: the hair's colour (recoloured with it)
    pen.line([[41, 23], [44, 23]], CANON.hair.shade);
    pen.line([[49, 23], [51, 23]], CANON.hair.shade);
    // nose shadow and mouth
    pen.dots([[53, 31]], sk.shade);
    if (fem) {
      // lashes flicking out at the outer corners, fuller lips
      pen.dots([[40, 25], [53, 25]], FIXED.outline);
      pen.line([[47, 34], [49, 34]], FIXED.lips);
      pen.dots([[48, 35]], sk.shade);
    } else {
      pen.line([[48, 34], [49, 34]], FIXED.mouth);
      pen.dots([[50, 34]], sk.shade);
    }
  });
  // near leg and arm, in the light
  skin('lower_leg_R', sk, (pen) => {
    const o = on(g, 'lower_leg_R');
    // the near foot, front on: toes along the bottom
    for (const x of [29, 32, 35]) o.line(pen, [[x, 116], [x, 118]], sk.shade);
  });
  skin('upper_leg_R', sk);
  skin('upper_arm_R', sk);
  skin('lower_arm_R', sk, (pen) => {
    const o = on(g, 'lower_arm_R');
    // the relaxed fist
    o.line(pen, [[20, 75], [24, 75]], sk.shade);
    o.dots(pen, [[22, 76], [22, 77]], sk.shade);
    o.line(pen, [[20, 72], [23, 72]], sk.hl);
  });
  return out;
}

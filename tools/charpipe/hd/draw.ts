// HD character factory: what PhotoCraft paints for a base body (male or female). Shapes are
// masks derived from the body; details are placed in reference coordinates through the body's own
// mapping (g.at), so they follow the female warp. Outlines are not painted here: they are added
// after animation, around each runtime band (outline.ts).
import type { Painter } from '../pcdraw';
import { limbOf, type BodyGeometry, type Part } from './body';
import { Mask, type Pt } from './mask';
import { H, W } from './body';

export interface Ramp {
  hl: string;
  base: string;
  shade: string;
  deep?: string;
  accent?: string;
}
export interface StudioSpec {
  id: string;
  name: string;
  /** which base body: the reference's (m) or its female warp (f) */
  body?: 'm' | 'f';
  outline: string[];
  skin: Ramp;
  eyes: { iris: string; irisLight: string; white: string; line: string };
  mouth: string;
  briefs: Ramp;
  assets: { id: string; slot: string; label: string; colors: Ramp }[];
  outfits: Record<string, { label: string; top: string; bottom: string; shoes: string; hair?: string }>;
}

/** one layer of one asset on one part */
export interface Piece {
  asset: string;
  part: Part;
  material: string;
  draw(pt: Painter): void;
}

/** helpers placing reference-coordinate details on a body */
export function onBody(g: BodyGeometry, part: Part = 'torso') {
  const R = (x: number, y: number): Pt => g.atIn(part, x, y);
  return {
    R,
    rowsR: (m: Mask, y0: number, y1: number) => m.rows(R(0, y0)[1], R(0, y1)[1]),
    lineR: (pt: Painter, pts: Pt[], c: string) => pt.line(pts.map(([x, y]) => R(x, y)), c),
    dotsR: (pt: Painter, pts: Pt[], c: string) => pt.dots(pts.map(([x, y]) => R(x, y)), c),
  };
}

/**
 * Flat fill + cel shading lit from the upper left: a 2-px shadow band low-right, a lit core
 * up-left. `whole` is the shape the light falls on (a whole limb, a whole garment), so a part cut
 * from it gets no bands along the cut.
 */
export function shaded(pt: Painter, m: Mask, c: Ramp, opts: { band?: number; core?: number; whole?: Mask } = {}) {
  const w = opts.whole ?? m;
  pt.mask(m, c.base);
  const band = opts.band ?? 2;
  pt.mask(w.sub(w.shift(-band, -band)).or(w.sub(w.erode(1)).sub(w.shift(1, 1))).and(m), c.shade, true);
  const core = w.erode(opts.core ?? 4).shift(-2, -2).and(w.erode(2)).and(m);
  pt.mask(core, c.hl, true);
}

// ── the body ───────────────────────────────────────────────────

export function bodyPieces(g: BodyGeometry, s: StudioSpec): Piece[] {
  // the briefs and the sports top sit on the torso
  const { rowsR, lineR } = onBody(g);
  const female = g.kind === 'f';
  const sk = s.skin;
  const deep = sk.deep ?? sk.shade;
  const far = { ...sk, hl: sk.base, base: sk.shade, shade: deep };
  // the briefs: on the female body cut high at the sides (the hem rises from the crotch to the hip)
  // (and the waistband sits lower, under the navel)
  const highCut = female ? Mask.poly(W, H, [g.at(40, 139), g.at(84, 158), g.at(88, 158), g.at(130, 139), g.at(130, 200), g.at(40, 200)]).or(g.poly([[0, 0], [200, 0], [200, 135], [0, 135]])) : new Mask(W, H);
  const briefsOf = (m: Mask) => m.sub(highCut);
  const allBriefs = briefsOf(g.briefs.or(g.briefsLegs.upper_leg_R).or(g.briefsLegs.upper_leg_L));
  const briefsPiece = (part: Part, m: Mask): Piece => ({
    asset: 'body',
    part,
    material: 'briefs',
    draw: (pt) => {
      shaded(pt, m, s.briefs, { core: 3, whole: allBriefs });
      // the hem: a dark edge along the bottom
      pt.mask(m.sub(m.shift(0, -1)).and(allBriefs.sub(allBriefs.shift(0, -1))), s.briefs.deep ?? s.briefs.shade, true);
    },
  });
  const p = (part: Part, draw: (pt: Painter, m: Mask, whole: Mask) => void, material = 'skin'): Piece => ({ asset: 'body', part, material, draw: (pt) => draw(pt, g.parts[part], limbOf(g, part)) });
  const pieces: Piece[] = [
    p('upper_arm_L', (pt, m, whole) => shaded(pt, m, far, { whole })),
    p('lower_arm_L', (pt, m, whole) => {
      const { lineR } = onBody(g, 'lower_arm_L');
      shaded(pt, m, far, { whole });
      lineR(pt, [[108, 156], [116, 156]], deep);
      lineR(pt, [[111, 157], [111, 160]], deep);
    }),
    p('lower_leg_L', (pt, m, whole) => {
      const { lineR } = onBody(g, 'lower_leg_L');
      shaded(pt, m, far, { whole });
      // the far foot in profile: toes on the right
      lineR(pt, [[112, 218], [112, 221]], deep);
      lineR(pt, [[115, 218], [115, 221]], deep);
    }),
    p('upper_leg_L', (pt, m, whole) => {
      const { rowsR, lineR } = onBody(g, 'upper_leg_L');
      shaded(pt, m, far, { whole });
      pt.mask(rowsR(m, 150, 160), deep, true);
      lineR(pt, [[92, 186], [97, 188]], deep);
    }),
    briefsPiece('upper_leg_L', briefsOf(g.briefsLegs.upper_leg_L)),
    p('lower_leg_R', (pt, m, whole) => {
      const { lineR } = onBody(g, 'lower_leg_R');
      shaded(pt, m, sk, { whole });
      // the near foot, front on: toes along the bottom
      for (const x of [60, 64, 68, 72]) lineR(pt, [[x, 224], [x, 227]], sk.shade);
    }),
    p('upper_leg_R', (pt, m, whole) => {
      const { rowsR, lineR } = onBody(g, 'upper_leg_R');
      shaded(pt, m, sk, { whole });
      pt.mask(rowsR(m, 150, 159), sk.shade, true);
      lineR(pt, [[64, 186], [70, 188]], sk.shade);
    }),
    briefsPiece('upper_leg_R', briefsOf(g.briefsLegs.upper_leg_R)),
    p('torso', (pt, m, whole) => {
      const { R, rowsR, lineR, dotsR } = onBody(g, 'torso');
      shaded(pt, m, sk, { core: 5, whole });
      // the neck in the jaw's shadow, collarbones, chest, navel
      pt.mask(rowsR(m, 84, 89).cols(R(72, 0)[0], R(100, 0)[0]), deep, true);
      pt.mask(rowsR(m, 80, 92).cols(R(72, 0)[0], R(78, 0)[0]), sk.shade, true);
      dotsR(pt, [[79, 97], [80, 97], [81, 98], [92, 98], [93, 97], [94, 97]], sk.shade);
      if (!female) {
        lineR(pt, [[72, 113], [83, 115]], sk.shade);
        lineR(pt, [[90, 115], [100, 113]], sk.shade);
      }
      dotsR(pt, [[86, 127], [86, 128]], deep);
    }),
    {
      ...briefsPiece('torso', briefsOf(g.briefs)),
      draw: (pt) => {
        briefsPiece('torso', briefsOf(g.briefs)).draw(pt);
        pt.mask(rowsR(briefsOf(g.briefs), 130, 132), s.briefs.shade, true);
        if (!female) lineR(pt, [[86, 146], [86, 155]], s.briefs.shade);
      },
    },
    p('head', (pt, m, whole) => {
      const { R, lineR, dotsR } = onBody(g, 'head');
      shaded(pt, m, sk, { core: 6, whole });
      // the ear, drawn inside the skull's outline as in the reference: its front contour, a lit
      // rim, the whorl and the lobe
      lineR(pt, [[66, 64], [67, 66], [67, 72], [66, 75], [64, 77]], s.eyes.line);
      lineR(pt, [[62, 64], [65, 64]], s.eyes.line);
      lineR(pt, [[62, 66], [62, 74]], sk.hl);
      lineR(pt, [[64, 67], [64, 72]], deep);
      dotsR(pt, [[65, 69], [65, 70], [63, 75]], sk.shade);
      // brows (male: thick, 3 rows; female: 2, finer), lashes, a thin white, big dark irises with a
      // highlight, lower lids
      const e = s.eyes;
      lineR(pt, [[84, 58], [91, 58]], e.line);
      lineR(pt, [[83, 59], [92, 59]], e.line);
      lineR(pt, [[102, 58], [105, 58]], e.line);
      lineR(pt, [[101, 59], [106, 59]], e.line);
      if (!female) {
        lineR(pt, [[82, 60], [85, 60]], e.line);
        lineR(pt, [[90, 60], [92, 60]], e.line);
        lineR(pt, [[101, 60], [102, 60]], e.line);
      }
      pt.rect(...R(83, 63), 9, 2, e.line);
      dotsR(pt, [[92, 65], [82, 65]], e.line);
      pt.rect(...R(82, 66), 2, 6, e.white);
      pt.rect(...R(84, 65), 7, 4, e.iris);
      pt.rect(...R(84, 69), 7, 4, e.irisLight);
      pt.rect(...R(86, 67), 3, 4, e.line);
      pt.rect(...R(85, 66), 2, 2, '#ffffff');
      lineR(pt, [[84, 73], [90, 73]], sk.shade);
      pt.rect(...R(101, 63), 5, 2, e.line);
      pt.rect(...R(105, 66), 1, 6, e.white);
      pt.rect(...R(101, 65), 4, 4, e.iris);
      pt.rect(...R(101, 69), 4, 4, e.irisLight);
      pt.rect(...R(102, 67), 2, 3, e.line);
      dotsR(pt, [[101, 66]], '#ffffff');
      lineR(pt, [[101, 73], [105, 73]], sk.shade);
      if (female) {
        // lashes: a 2-px flick out of each eye's outer corner, a lash on the lower lid; lips
        lineR(pt, [[82, 63], [80, 61]], e.line);
        dotsR(pt, [[81, 64]], e.line);
        lineR(pt, [[105, 62], [106, 61]], e.line);
        dotsR(pt, [[83, 73]], e.line);
        lineR(pt, [[93, 80], [96, 80]], s.mouth);
        lineR(pt, [[94, 81], [95, 81]], '#e0877e');
      } else {
        lineR(pt, [[93, 80], [96, 80]], s.mouth);
        dotsR(pt, [[92, 79]], sk.shade);
      }
      // nose
      dotsR(pt, [[98, 75], [98, 76], [97, 76]], sk.shade);
    }),
    p('upper_arm_R', (pt, m, whole) => shaded(pt, m, sk, { whole })),
    p('lower_arm_R', (pt, m, whole) => {
      const { lineR } = onBody(g, 'lower_arm_R');
      shaded(pt, m, sk, { whole });
      // the relaxed fist: knuckles and fingers
      lineR(pt, [[47, 154], [58, 156]], sk.shade);
      lineR(pt, [[51, 157], [51, 161]], sk.shade);
      lineR(pt, [[55, 157], [55, 161]], sk.shade);
    }),
  ];
  if (female)
    // the female base wears a sports top with the briefs
    pieces.push({
      asset: 'body',
      part: 'torso',
      material: 'top',
      draw: (pt) => {
        const band = g.parts.torso.and(g.poly([[60, 103], [112, 103], [112, 122], [60, 122]]).or(g.bust ? Mask.ellipse(W, H, g.bust[0] - 5, g.bust[1], 7, 9).and(g.parts.torso) : new Mask(W, H)));
        shaded(pt, band, s.briefs, { core: 3 });
        // the underband, and the shadow under the bust
        pt.mask(band.sub(band.shift(0, -2)), s.briefs.shade, true);
        if (g.bust) pt.mask(Mask.ellipse(W, H, g.bust[0] - 4, g.bust[1] + 2, 5, 4).and(band).sub(band.shift(0, -2)), s.briefs.deep ?? s.briefs.shade, true);
        // straps from the band up over the shoulders
        lineR(pt, [[77, 103], [71, 92]], s.briefs.base);
        lineR(pt, [[78, 103], [72, 92]], s.briefs.shade);
        lineR(pt, [[96, 103], [101, 92]], s.briefs.base);
        lineR(pt, [[97, 103], [102, 92]], s.briefs.shade);
      },
    });
  return pieces;
}

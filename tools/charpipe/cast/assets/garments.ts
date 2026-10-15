// Cast assets: clothing. Every garment is the body's own part masks cut to length and grown, so it
// fits every kind, build and height; colours are canonical materials, recoloured at runtime.
//
// Conventions (regular-body coordinates, mapped onto any body through `on(g, part)`):
//   - a garment sits 1 px proud of the skin (`.dilate(1)` clipped near the part), a coat 2 px;
//   - light from the upper left: the near shoulder lit, the far side of the torso (x ≥ 47) turned
//     away into shade, sleeves and trouser legs shaded along their right side; shading is computed
//     on the whole garment, so the cuts between parts get no edge bands;
//   - the far limbs (L, image right) one step darker (`far`), darkest against the body;
//   - no outer outlines: the runtime rings every band after animation.
// Torso pieces never depend on height (upper bands are shared by every height); leg pieces place
// their rows through the leg's own mapping.
//
// Long hems (skirt, long coat, apron) hang from the torso to the knee in one piece, so standing
// they read as one cloth (no ring where the torso band meets the legs); each also has a panel on
// either thigh, hidden under it standing, which dresses the lap when the thighs come over the
// torso (sitting).
import { Mask, type Pt } from '../../hd/mask';
import { asset, type AssetDef, type Material, type Slot } from '../catalog';
import { far, on, type Piece } from '../draw';
import { limbOf, type BodyGeometry, type Part } from '../body';
import { CANON, FIXED, type Ramp } from '../palette';
import type { Pen } from '../pen';

const M = CANON.main;
const A = CANON.accent;
const MT = CANON.metal;
type Side = 'R' | 'L';
const SIDES: Side[] = ['R', 'L'];
const tone = (s: Side, r: Ramp) => (s === 'L' ? far(r) : r);

// the body's limb pieces without hands and feet (body.ts polygons, regular coordinates)
const SHIN: Record<Side, Pt[]> = {
  R: [[30, 96], [37, 96], [36, 111], [29, 111]],
  L: [[45, 96], [51, 96], [52, 110], [46, 110]],
};
const FOREARM: Record<Side, Pt[]> = {
  R: [[22, 57], [29, 57], [28, 71], [21, 71]],
  L: [[52, 57], [58, 57], [59, 71], [53, 71]],
};
/** the last row a trouser leg reaches (over the shoe's top) */
const ANKLE: Record<Side, number> = { R: 111, L: 110 };

const up = (s: Side): Part => `upper_arm_${s}`;
const lo = (s: Side): Part => `lower_arm_${s}`;
const thigh = (s: Side): Part => `upper_leg_${s}`;
const shin = (s: Side): Part => `lower_leg_${s}`;

const ALL = new Mask(80, 128).map(() => 1);
const NONE = new Mask(80, 128);
/** grow a shape by n px, kept within n px of a reference (the part it dresses) */
const grow = (m: Mask, ref: Mask, n = 1) => m.dilate(n).and(ref.dilate(n));
/** grow sideways and up only (shoes keep the sole on the ground line) */
const growNoDown = (m: Mask) => m.or(m.shift(1, 0)).or(m.shift(-1, 0)).or(m.shift(0, -1));
/** pixels within n px of the shape's right / left / bottom / top edge */
const rightBand = (w: Mask, n: number) => w.sub(w.shift(-n, 0));
const leftBand = (w: Mask, n: number) => w.sub(w.shift(n, 0));
const bottomBand = (w: Mask, n: number) => w.sub(w.shift(0, -n));
const topBand = (w: Mask, n: number) => w.sub(w.shift(0, n));
/** a 1-px line inset from the left edge, away from the ends (a lit crease) */
const litLine = (w: Mask, from: number) => leftBand(w.erode(1), 1).sub(topBand(w, from)).sub(bottomBand(w, 3));

/**
 * Cloth on the torso in three-quarter view: base, the far side (x ≥ 47) turned away into shade,
 * the near shoulder lit, the bottom edge shaded. `whole` is the cloth the light falls on.
 */
function torsoCloth(g: BodyGeometry, pen: Pen, m: Mask, c: Ramp, whole: Mask = m) {
  const o = on(g, 'torso');
  pen.mask(m, c.base);
  pen.mask(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]).and(m), c.shade, true);
  pen.mask(bottomBand(whole, 1).and(m), c.shade, true);
  pen.mask(rightBand(whole, 1).and(o.rows(ALL, 44, 128)).and(m), c.deep, true);
  pen.mask(o.poly([[27, 46], [31, 41], [38, 39], [36, 41], [31, 47], [29, 54]]).or(topBand(whole, 2).and(o.poly([[0, 0], [39, 0], [39, 128], [0, 128]]))).and(m), c.hl, true);
}

/**
 * A sleeve or trouser leg. Near: base, the right side in shade, a lit crease down the left.
 * Far (the ramp already one step darker): the side against the body in the deepest tone.
 */
function limbCloth(pen: Pen, s: Side, m: Mask, c: Ramp, whole: Mask = m, width = 3) {
  pen.mask(m, c.base);
  if (s === 'R') {
    pen.mask(rightBand(whole, width).or(bottomBand(whole, 1)).and(m), c.shade, true);
    pen.mask(litLine(whole, 3).and(m), c.hl, true);
  } else pen.mask(leftBand(whole, 2).or(bottomBand(whole, 1)).and(m), c.shade, true);
}

type Draw = (pen: Pen) => void;
interface Ctx {
  g: BodyGeometry;
  add(part: Part, draw: Draw, material?: string): void;
}
/** an asset from a body → pieces function, with a helper to push pieces */
function garment(id: string, slot: Slot, label: string, materials: Material[], make: (c: Ctx) => void): AssetDef {
  return asset({
    id,
    slot,
    label,
    materials,
    pieces: (g) => {
      const out: Piece[] = [];
      make({ g, add: (part, draw, material = 'cloth') => out.push({ asset: id, part, material, draw }) });
      return out;
    },
  });
}

/** the torso a top covers: neckline to the hem (regular rows), the neck scooped out */
function topBody(g: BodyGeometry, hem = 77, n = 1) {
  const o = on(g, 'torso');
  return o.rows(g.parts.torso, 40, hem).dilate(n).and(g.parts.torso.dilate(n)).sub(g.neck.erode(1).rows(0, o.R(0, 41)[1]));
}

/** the shadow under the bust on the feminine body */
function underBust(g: BodyGeometry, pen: Pen, c: string) {
  if (g.kind !== 'fem') return;
  on(g, 'torso').line(pen, [[47, 57], [49, 58], [52, 57]], c);
}

/** a sleeve on one arm, shoulder to `to` (regular rows), n px proud; `whole` spans both pieces */
function sleeve(g: BodyGeometry, s: Side, to: number, n = 1) {
  const limb = limbOf(g, up(s)).dilate(n);
  const u = on(g, up(s)).rows(g.parts[up(s)], 40, Math.min(to, 59)).dilate(n).and(limb);
  const l = to > 58 ? on(g, lo(s)).rows(g.poly(lo(s), FOREARM[s]), 56, to).dilate(n).and(limb) : null;
  return { u, l, whole: u.or(l ?? NONE) };
}

/** the lit cap of the near shoulder */
const shoulderCap = (g: BodyGeometry) => on(g, 'upper_arm_R').poly([[22, 46], [26, 42], [30, 42], [25, 47], [23, 53]]);

/** both sleeves of a garment, to `to`; `cuff` draws the end (rows near `to`) */
function sleeves(g: BodyGeometry, add: Ctx['add'], to: number, n: number, cuff: (pen: Pen, s: Side, m: Mask, c: Ramp) => void) {
  for (const s of SIDES) {
    const c = tone(s, M);
    const { u, l, whole } = sleeve(g, s, to, n);
    const ou = on(g, up(s));
    add(up(s), (pen) => {
      limbCloth(pen, s, u, c, whole);
      if (s === 'R') {
        pen.mask(shoulderCap(g).and(u), c.hl, true);
        ou.line(pen, [[28, 48], [28, 56]], c.shade);
      }
      if (!l) cuff(pen, s, u, c);
    });
    if (l)
      add(lo(s), (pen) => {
        limbCloth(pen, s, l, c, whole);
        // the elbow's crease
        if (s === 'R') on(g, lo(s)).line(pen, [[23, 59], [25, 60]], c.shade);
        cuff(pen, s, l, c);
      });
  }
}

// ── tops ──────────────────────────────────────────────────────

/** a top: torso from the neckline to the hem, sleeves to `to` (regular rows) */
function top(id: string, label: string, to: number, end: 'cuff' | 'hem' | 'rolled') {
  return garment(id, 'top', label, ['main'], ({ g, add }) => {
    const o = on(g, 'torso');
    const body = topBody(g);
    add('torso', (pen) => {
      torsoCloth(g, pen, body, M);
      // the crew neckline, the hem, a fold under the near arm and at the waist
      o.line(pen, [[38, 41], [40, 43], [45, 43], [47, 41]], M.deep);
      o.line(pen, [[41, 44], [44, 44]], M.shade);
      pen.mask(o.rows(body, 77, 78), M.shade, true);
      o.line(pen, [[33, 58], [34, 66]], M.shade);
      o.line(pen, [[44, 71], [46, 73]], M.shade);
      underBust(g, pen, M.shade);
    });
    sleeves(g, add, to, 1, (pen, s, m, c) => {
      const ol = on(g, to > 58 ? lo(s) : up(s));
      if (end === 'hem') {
        // a short sleeve's hem, open a little over the arm
        pen.mask(bottomBand(m, 2), c.shade, true);
        pen.mask(bottomBand(m, 1), c.deep, true);
      } else if (end === 'cuff') {
        pen.mask(ol.rows(m, to - 1, to + 1), c.shade, true);
        pen.mask(ol.rows(m, to - 2, to - 2), c.deep, true);
      } else {
        // the turn-up: a band a pixel wider than the sleeve, lit along its top, shadow under it
        const cuff = ol.rows(m.dilate(1), to - 3, to + 1).and(ol.rows(ALL, to - 3, to + 1));
        pen.mask(cuff, c.base);
        pen.mask(ol.rows(cuff, to - 3, to - 3), c.hl, true);
        pen.mask(rightBand(cuff, 2), c.shade, true);
        pen.mask(ol.rows(cuff, to, to + 1), c.shade, true);
        pen.mask(ol.rows(cuff, to - 4, to - 4).and(m), c.deep, true);
      }
    });
  });
}

// ── trousers ──────────────────────────────────────────────────

/** trouser legs (n px proud) from under the hips to the ankle, and the waist on the torso */
function trouserShapes(g: BodyGeometry, n: number) {
  const o = on(g, 'torso');
  const waist = o.rows(g.parts.torso, 74, 84).dilate(1).and(g.parts.torso.dilate(1));
  const legs = {} as Record<Side, { t: Mask; s: Mask }>;
  for (const s of SIDES) {
    const leg = limbOf(g, thigh(s));
    const t = grow(g.parts[thigh(s)], leg, n);
    const sh = on(g, shin(s)).rows(grow(g.poly(shin(s), SHIN[s]), leg, n), 95, ANKLE[s]);
    legs[s] = { t, s: sh };
  }
  return { waist, legs };
}

function trousers(id: string, label: string, cargo: boolean) {
  return garment(id, 'pants', label, ['main'], ({ g, add }) => {
    const o = on(g, 'torso');
    const { waist, legs } = trouserShapes(g, cargo ? 2 : 1);
    if (cargo)
      for (const s of SIDES) {
        // loose legs bunching out over the shoes
        const os = on(g, shin(s));
        legs[s].s = legs[s].s.or(os.rows(legs[s].s.dilate(1), 105, ANKLE[s]).and(legs[s].s.shift(1, 0).or(legs[s].s.shift(-1, 0))));
      }
    add('torso', (pen) => {
      torsoCloth(g, pen, waist, M);
      // the waistband with belt loops, the fly, the pockets' openings
      const band = o.rows(waist, 73, 75);
      pen.mask(band, M.base, true);
      pen.mask(o.rows(band, 73, 73), M.hl, true);
      pen.mask(o.rows(band, 75, 75), M.shade, true);
      pen.mask(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]).and(band), M.shade, true);
      o.dots(pen, [[35, 74], [49, 74]], M.deep);
      o.line(pen, [[43, 76], [43, 82], [41, 84]], M.shade);
      o.line(pen, [[33, 77], [36, 80]], M.deep);
      o.line(pen, [[49, 77], [51, 79]], M.deep);
    });
    for (const s of SIDES) {
      const c = tone(s, M);
      const { t, s: sh } = legs[s];
      const whole = t.or(sh);
      const ot = on(g, thigh(s));
      const os = on(g, shin(s));
      add(thigh(s), (pen) => {
        limbCloth(pen, s, t, c, whole);
        // a crease from the hip and the knee's folds
        if (s === 'R') ot.line(pen, [[33, 94], [36, 96]], c.shade);
        else ot.line(pen, [[48, 92], [50, 94]], c.shade);
        if (cargo) {
          // a bellows pocket on the outside of the thigh: flap, body, a seam down its side
          const p = (s === 'R' ? ot.poly([[30, 86], [36, 86], [36, 94], [30, 94]]) : ot.poly([[47, 86], [52, 86], [52, 94], [47, 94]])).and(t.erode(1));
          const flap = topBand(p, 2);
          pen.mask(p, c.base, true);
          pen.mask(topBand(p, 1), s === 'R' ? c.hl : c.base, true);
          pen.mask(bottomBand(flap, 1), c.deep, true);
          pen.mask(rightBand(p, 1).or(bottomBand(p, 1)).sub(flap), c.shade, true);
          if (s === 'R') pen.mask(leftBand(p, 1).sub(flap), c.hl, true);
        }
      });
      add(shin(s), (pen) => {
        limbCloth(pen, s, sh, c, whole);
        if (cargo) {
          // the bunched folds above the hem
          if (s === 'R') {
            os.line(pen, [[29, 104], [32, 105]], c.shade);
            os.line(pen, [[33, 106], [36, 105]], c.shade);
            os.line(pen, [[29, 108], [32, 109]], c.shade);
            os.dots(pen, [[29, 105], [30, 109]], c.hl);
          } else {
            os.line(pen, [[47, 104], [50, 105]], c.shade);
            os.line(pen, [[48, 107], [51, 108]], c.shade);
          }
        } else if (s === 'R') os.line(pen, [[31, 108], [34, 109]], c.shade);
        pen.mask(bottomBand(sh, 1), c.shade, true);
      });
    }
  });
}

// ── long hems: skirt, long coat, apron ────────────────────────

/**
 * The panel of a long hem on one thigh (it dresses the lap when sitting). Standing it stays
 * hidden under the hanging piece `cover` (a pixel inside its edge, its hem 3 px short so a tall
 * body's raised torso still covers it).
 */
function lapPanel(g: BodyGeometry, s: Side, pts: Pt[], cover: Mask) {
  const ot = on(g, thigh(s));
  const bb = cover.bbox()!;
  return ot.poly(pts).or(g.parts[thigh(s)].dilate(1)).and(cover.erode(1)).and(ALL.rows(0, bb[3] - 3));
}

const skirt = garment('skirt', 'skirt', 'Skirt', ['main'], ({ g, add }) => {
  const o = on(g, 'torso');
  const T = g.parts.torso;
  // an A-line from the waist to just above the knee
  const hips = o.rows(T, 72, 84).dilate(1).and(T.dilate(1));
  const flare = o.poly([[30, 78], [54, 78], [57, 95], [27, 95]]);
  const m = hips.or(flare);
  add('torso', (pen) => {
    torsoCloth(g, pen, m, M);
    pen.mask(rightBand(m, 2).and(o.rows(ALL, 84, 96)), M.shade, true);
    // the waistband, pleats fanning out, the hem
    const band = o.rows(m, 72, 74);
    pen.mask(o.rows(band, 72, 72), M.hl, true);
    pen.mask(o.rows(band, 74, 74), M.shade, true);
    o.line(pen, [[36, 78], [34, 86], [33, 93]], M.shade);
    o.line(pen, [[41, 79], [40, 93]], M.shade);
    o.line(pen, [[49, 79], [51, 93]], M.deep);
    o.line(pen, [[32, 85], [31, 92]], M.hl);
    pen.mask(bottomBand(m, 1), M.deep, true);
  });
  for (const s of SIDES) {
    const c = tone(s, M);
    const p = lapPanel(g, s, s === 'R' ? [[29, 76], [44, 76], [43, 96], [28, 96]] : [[41, 76], [53, 76], [56, 96], [41, 96]], m);
    add(thigh(s), (pen) => {
      limbCloth(pen, s, p, c);
      pen.mask(bottomBand(p, 1), c.deep, true);
    });
  }
});

function coat(id: string, label: string, long: boolean) {
  return garment(id, 'coat', label, ['main', 'accent'], ({ g, add }) => {
    const o = on(g, 'torso');
    const T = g.parts.torso;
    const hem = long ? 96 : 79;
    // open down the front from a V at the collar; the long coat's skirts fall open below the hips
    const opening = o.poly([[39, 36], [47, 36], [45.5, 49], [45.5, 84], [48, 98], [40, 98], [41, 84], [41, 48]]);
    let body = o.rows(T, 40, Math.min(hem, 84)).dilate(2).and(T.dilate(2));
    if (long) body = body.or(o.poly([[29, 78], [55, 78], [57, 96], [27, 96]]));
    body = body.sub(g.neck.rows(0, o.R(0, 41)[1])).sub(opening);
    add('torso', (pen) => {
      torsoCloth(g, pen, body, M);
      // the inside edges along the opening in shadow, the near arm's shadow on the body
      pen.mask(o.poly([[39, 47], [41, 47], [41, 99], [39, 99]]).and(body), M.shade, true);
      pen.mask(o.poly([[31, 47], [34, 47], [34, 74], [31, 74]]).and(body), M.shade, true);
      // collar and lapels (the near one turned to the light)
      const lapel = o.poly([[36, 40], [39, 40], [41, 48], [41, 52], [37, 44]]).and(body);
      pen.mask(lapel, M.hl, true);
      o.line(pen, [[37, 41], [34, 43]], M.shade);
      o.line(pen, [[38, 41], [40, 47]], M.deep);
      o.line(pen, [[48, 41], [51, 43]], M.deep);
      o.line(pen, [[47, 41], [46, 48]], M.deep);
      o.line(pen, [[40, 49], [40, hem]], M.deep);
      o.line(pen, [[46, 49], [46, Math.min(hem, 84)]], M.deep);
      // pocket flaps, the hem; buttons down the near edge
      if (long) {
        o.line(pen, [[49, 52], [52, 52]], M.deep);
        o.line(pen, [[31, 74], [37, 74]], M.deep);
        o.line(pen, [[49, 74], [53, 74]], M.deep);
        o.dots(pen, [[32, 75], [50, 75]], M.shade);
        o.line(pen, [[35, 86], [33, 95]], M.shade);
        o.line(pen, [[51, 86], [53, 95]], M.deep);
        pen.mask(o.poly([[46, 84], [60, 84], [60, 99], [46, 99]]).and(leftBand(body, 1)), M.deep, true);
      } else {
        o.line(pen, [[32, 66], [37, 66]], M.shade);
        o.line(pen, [[49, 66], [52, 66]], M.deep);
        o.dots(pen, [[38, 67], [50, 67]], M.hl);
      }
      pen.mask(bottomBand(body, 2), M.shade, true);
      pen.mask(o.rows(bottomBand(body, 2), 0, 128).and(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]])), M.deep, true);
      const buttons: Pt[] = long ? [[39, 52], [39, 60], [39, 68], [39, 76]] : [[39, 52], [39, 60], [39, 68]];
      o.dots(pen, buttons, A.base);
      o.dots(pen, buttons.map(([x, y]) => [x, y + 1] as Pt), A.deep);
    });
    if (long)
      for (const s of SIDES) {
        const c = tone(s, M);
        const p = lapPanel(g, s, s === 'R' ? [[28, 76], [41, 76], [41, 97], [27, 97]] : [[45, 76], [56, 76], [57, 97], [45, 97]], body);
        add(thigh(s), (pen) => {
          limbCloth(pen, s, p, c);
          pen.mask(bottomBand(p, 2), c.shade, true);
        });
      }
    sleeves(g, add, 71, 1, (pen, s, m, c) => {
      const ol = on(g, lo(s));
      pen.mask(ol.rows(m, 69, 72), c.shade, true);
      pen.mask(ol.rows(m, 68, 68), c.deep, true);
    });
  });
}

const apron = garment('apron', 'apron', 'Apron', ['main'], ({ g, add }) => {
  const o = on(g, 'torso');
  // a bib from the chest, wider over the hips, to the knee
  const m = o.poly([[36, 50], [49, 50], [50, 66], [53, 74], [54, 95], [32, 95], [32, 74], [35, 66]]);
  add('torso', (pen) => {
    // the neck strap and the waist ties, running round to the back
    const straps = o.poly([[36, 41], [38, 41], [38, 51], [36, 51]]).or(o.poly([[47, 41], [49, 41], [49, 51], [47, 51]]));
    pen.mask(straps, M.base);
    pen.mask(rightBand(straps, 1), M.shade, true);
    const ties = o.poly([[30, 65], [36, 65], [36, 67], [30, 67]]).or(o.poly([[49, 65], [55, 65], [55, 67], [49, 67]])).and(g.parts.torso);
    pen.mask(ties, M.shade);
    torsoCloth(g, pen, m, M);
    pen.mask(topBand(m, 1).sub(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]])), M.hl, true);
    // the front pocket, a fold down from the waist
    const pocket = o.poly([[37, 72], [49, 72], [49, 80], [37, 80]]);
    pen.mask(o.rows(pocket, 72, 72), M.deep, true);
    pen.mask(o.rows(pocket, 73, 73), M.shade, true);
    o.line(pen, [[43, 73], [43, 79]], M.shade);
    o.line(pen, [[37, 83], [35, 93]], M.shade);
    o.line(pen, [[48, 84], [50, 93]], M.deep);
    pen.mask(bottomBand(m, 1), M.deep, true);
  });
  for (const s of SIDES) {
    const c = tone(s, M);
    const p = lapPanel(g, s, s === 'R' ? [[32, 76], [44, 76], [44, 96], [31, 96]] : [[42, 76], [54, 76], [55, 96], [42, 96]], m);
    add(thigh(s), (pen) => {
      limbCloth(pen, s, p, c);
      pen.mask(bottomBand(p, 1), c.deep, true);
    });
  }
});

// ── shoes and boots ───────────────────────────────────────────

/** a shoe: the foot grown sideways and up (the sole stays on the ground line), from row `from` */
function shoeShape(g: BodyGeometry, s: Side, from: number) {
  const os = on(g, shin(s));
  const foot = g.feet[s];
  // the toe a pixel longer
  const toe = s === 'R' ? foot.shift(1, 0) : foot.shift(1, 0);
  return growNoDown(foot.or(toe)).and(os.rows(ALL, from, 128));
}

const shoes = garment('shoes:shoe', 'shoes', 'Shoes', ['main'], ({ g, add }) => {
  for (const s of SIDES) {
    const c = tone(s, M);
    const os = on(g, shin(s));
    const m = shoeShape(g, s, s === 'R' ? 109 : 107);
    add(shin(s), (pen) => {
      pen.mask(m, c.base);
      pen.mask(rightBand(m, 2), c.shade, true);
      // the sole: a welt line above the dark tread
      pen.mask(bottomBand(m, 1), c.deep, true);
      pen.mask(bottomBand(m, 3).sub(bottomBand(m, 2)), c.shade, true);
      pen.mask(topBand(m, 1), c.shade, true);
      if (s === 'R') {
        // front on: the toe cap lit, laces on the instep
        os.line(pen, [[29, 114], [33, 114]], c.hl);
        os.line(pen, [[31, 111], [33, 111]], c.shade);
        os.line(pen, [[31, 113], [33, 113]], c.shade);
      } else {
        // in profile: the toe to the right, the heel in shadow
        os.line(pen, [[51, 111], [54, 112]], c.hl);
        pen.mask(leftBand(m, 3), c.shade, true);
        os.line(pen, [[48, 109], [49, 110]], c.deep);
      }
    });
  }
});

const boots = garment('boots', 'boots', 'Boots', ['main', 'accent'], ({ g, add }) => {
  for (const s of SIDES) {
    const c = tone(s, M);
    const la = tone(s, A);
    const os = on(g, shin(s));
    const shaft = os.rows(g.poly(shin(s), SHIN[s]), 101, 112).dilate(1).and(os.rows(ALL, 100, 128));
    const m = shoeShape(g, s, 100).or(shaft);
    add(shin(s), (pen) => {
      pen.mask(m, c.base);
      if (s === 'R') {
        pen.mask(rightBand(m, 3), c.shade, true);
        pen.mask(litLine(shaft, 2).and(os.rows(ALL, 102, 108)), c.hl, true);
      } else pen.mask(leftBand(m, 2), c.shade, true);
      // the cuff, a thick sole with its welt, the heel
      pen.mask(topBand(m, 1), c.hl, true);
      pen.mask(topBand(m, 2).sub(topBand(m, 1)), c.shade, true);
      pen.mask(bottomBand(m, 2), c.deep, true);
      pen.mask(bottomBand(m, 3).sub(bottomBand(m, 2)), c.shade, true);
      // laces: short crossbars down the front, a toe cap
      if (s === 'R') {
        for (const y of [104, 106, 108]) os.line(pen, [[32, y], [34, y]], la.base);
        os.line(pen, [[32, 110], [34, 110]], la.shade);
        os.line(pen, [[28, 114], [32, 114]], c.hl);
      } else {
        for (const y of [104, 106]) os.line(pen, [[49, y], [51, y]], la.base);
        os.line(pen, [[50, 108], [51, 108]], la.shade);
        os.line(pen, [[52, 111], [55, 112]], c.hl);
      }
    });
  }
});

// ── overalls, vest ────────────────────────────────────────────

const overalls = garment('overalls', 'overalls', 'Overalls', ['main', 'metal'], ({ g, add }) => {
  const o = on(g, 'torso');
  const T = g.parts.torso;
  const { waist, legs } = trouserShapes(g, 1);
  const bib = o.poly([[35, 53], [50, 53], [50, 75], [35, 75]]).and(T.dilate(1));
  const straps = o.poly([[34, 41], [37, 41], [37, 54], [35, 54]]).or(o.poly([[48, 41], [51, 41], [50, 54], [48, 54]])).and(T.dilate(1));
  const body = waist.or(bib);
  add('torso', (pen) => {
    torsoCloth(g, pen, body, M);
    pen.mask(topBand(bib, 1), M.hl, true);
    // straps over the shoulders
    pen.mask(straps, M.base);
    pen.mask(rightBand(straps, 1), M.shade, true);
    pen.mask(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]).and(straps), M.shade, true);
    pen.mask(leftBand(straps, 1).and(o.rows(ALL, 40, 50)), M.hl, true);
    // the bib pocket, the side openings with their buttons, the fly
    const pocket = o.poly([[39, 58], [46, 58], [46, 64], [39, 64]]);
    pen.mask(pocket, M.shade, true);
    pen.mask(topBand(pocket, 1), M.deep, true);
    pen.mask(leftBand(pocket, 1).sub(topBand(pocket, 1)), M.base, true);
    o.line(pen, [[35, 75], [35, 79]], M.deep);
    o.line(pen, [[50, 75], [50, 79]], M.deep);
    o.line(pen, [[43, 77], [43, 82], [41, 84]], M.shade);
    o.dots(pen, [[36, 76], [49, 76]], MT.base);
    // a buckle where each strap meets the bib
    const buckles = o.poly([[35, 52], [38, 52], [38, 55], [35, 55]]).or(o.poly([[48, 52], [51, 52], [51, 55], [48, 55]]));
    pen.mask(buckles, MT.base);
    pen.mask(rightBand(buckles, 1).or(bottomBand(buckles, 1)), MT.shade, true);
    o.dots(pen, [[35, 52]], MT.hl);
    o.dots(pen, [[49, 53]], MT.deep);
  });
  for (const s of SIDES) {
    const c = tone(s, M);
    const { t, s: sh } = legs[s];
    const whole = t.or(sh);
    add(thigh(s), (pen) => {
      limbCloth(pen, s, t, c, whole);
      if (s === 'R') on(g, thigh(s)).line(pen, [[33, 94], [36, 96]], c.shade);
    });
    add(shin(s), (pen) => {
      limbCloth(pen, s, sh, c, whole);
      // a turned-up cuff
      const os = on(g, shin(s));
      const y = ANKLE[s];
      pen.mask(os.rows(sh, y - 3, y - 3), c.deep, true);
      pen.mask(os.rows(sh, y - 2, y - 2), s === 'R' ? c.hl : c.base, true);
      pen.mask(os.rows(sh, y - 1, y), c.base, true);
      pen.mask(bottomBand(sh, 1).or(rightBand(os.rows(sh, y - 2, y), 2)), c.shade, true);
    });
  }
});

const vest = garment('vest', 'vest', 'Safety vest', ['main', 'accent'], ({ g, add }) => {
  const o = on(g, 'torso');
  const body = o.rows(g.parts.torso, 41, 79).dilate(1).and(g.parts.torso.dilate(1)).sub(o.poly([[38, 36], [48, 36], [43, 52]]));
  const right = o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]);
  add('torso', (pen) => {
    torsoCloth(g, pen, body, M);
    // the V's edges, the front closure, the hem
    o.line(pen, [[38, 41], [42, 50]], M.hl);
    o.line(pen, [[48, 41], [44, 50]], M.deep);
    o.line(pen, [[43, 52], [43, 79]], M.deep);
    o.line(pen, [[44, 52], [44, 79]], M.hl);
    pen.mask(bottomBand(body, 2), M.shade, true);
    // reflective tape: braces over the shoulders, two bands round the body
    for (const [x0, x1] of [[35, 38], [48, 51]] as const) {
      const brace = o.poly([[x0, 38], [x1, 38], [x1, 62], [x0, 62]]).and(body);
      pen.mask(brace, A.base, true);
      pen.mask(brace.and(right), A.shade, true);
      pen.mask(leftBand(brace, 1).and(o.rows(ALL, 40, 48)), A.hl, true);
    }
    for (const [y0, y1] of [[63, 65], [71, 73]]) {
      const band = o.rows(body, y0, y1);
      pen.mask(band, A.base, true);
      pen.mask(o.rows(band, y0, y0), A.hl, true);
      pen.mask(band.and(right).or(o.rows(band, y1, y1)), A.shade, true);
      o.line(pen, [[43, y0], [43, y1]], M.deep);
    }
    // a pen in the chest pocket
    o.line(pen, [[48, 55], [51, 55]], M.deep);
  });
});

// ── trims and straps ──────────────────────────────────────────

/** a band across the chest and both sleeves (over the top) */
const stripe = garment('stripe', 'stripe', 'Stripe', ['main'], ({ g, add }) => {
  const o = on(g, 'torso');
  const band = o.rows(topBody(g), 57, 59);
  add('torso', (pen) => {
    pen.mask(band, M.base);
    pen.mask(o.rows(band, 57, 57), M.hl, true);
    pen.mask(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]).and(band), M.shade, true);
    pen.mask(o.rows(band, 59, 59), M.shade, true);
  });
  for (const s of SIDES) {
    const c = tone(s, M);
    const { u, whole } = sleeve(g, s, 70);
    const ou = on(g, up(s));
    const b = ou.rows(u, 48, 49);
    add(up(s), (pen) => {
      pen.mask(b, c.base);
      pen.mask((s === 'R' ? rightBand(whole, 3) : leftBand(whole, 2)).and(b), c.shade, true);
      if (s === 'R') pen.mask(ou.rows(b, 48, 48).sub(rightBand(whole, 3)), c.hl, true);
    });
  }
});

const suspenders = garment('suspenders', 'suspenders', 'Suspenders', ['main'], ({ g, add }) => {
  const o = on(g, 'torso');
  add('torso', (pen) => {
    const near = o.poly([[35, 41], [37, 41], [37, 78], [35, 78]]).and(g.parts.torso.dilate(1));
    const farS = o.poly([[48, 41], [50, 41], [49, 78], [47, 78]]).and(g.parts.torso.dilate(1));
    pen.mask(near, M.base);
    pen.mask(leftBand(near, 1), M.hl, true);
    pen.mask(farS, M.shade);
    pen.mask(rightBand(farS, 1), M.deep, true);
    // the button tabs at the waist
    o.line(pen, [[35, 75], [37, 75]], M.deep);
    o.line(pen, [[47, 75], [49, 75]], M.deep);
  });
});

const belt = garment('belt', 'belt', 'Belt', ['main', 'metal'], ({ g, add }) => {
  const o = on(g, 'torso');
  add('torso', (pen) => {
    const b = o.rows(g.parts.torso.dilate(1), 75, 77);
    pen.mask(b, M.base);
    pen.mask(o.rows(b, 75, 75), M.hl, true);
    pen.mask(o.rows(b, 77, 77), M.shade, true);
    pen.mask(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]]).and(b), M.shade, true);
    o.dots(pen, [[36, 76], [49, 76]], M.deep);
    // the buckle: a frame with its tongue
    const buckle = o.poly([[41, 74], [45, 74], [45, 79], [41, 79]]);
    pen.mask(buckle, MT.base);
    pen.mask(rightBand(buckle, 1).or(bottomBand(buckle, 1)), MT.shade, true);
    o.dots(pen, [[41, 74]], MT.hl);
    o.line(pen, [[42, 76], [43, 76]], MT.deep);
  });
});

const strap = garment('strap', 'strap', 'Crossbody strap', ['main', 'metal'], ({ g, add }) => {
  const o = on(g, 'torso');
  add('torso', (pen) => {
    // from the near shoulder across the chest to the far hip, a ring on the way
    o.line(pen, [[34, 41], [41, 54], [51, 70]], M.base);
    o.line(pen, [[35, 41], [42, 54], [52, 70]], M.shade);
    o.line(pen, [[33, 42], [40, 54]], M.hl);
    const ring = o.poly([[39, 52], [43, 52], [43, 56], [39, 56]]);
    pen.mask(ring.sub(ring.erode(1)), MT.base);
    o.dots(pen, [[39, 52]], MT.hl);
    o.dots(pen, [[42, 55]], MT.shade);
    // the hip pouch: flap, body, clasp
    const pouch = o.poly([[46, 69], [55, 69], [55, 79], [47, 79]]);
    pen.mask(pouch, M.base);
    pen.mask(rightBand(pouch, 2).or(bottomBand(pouch, 1)), M.shade, true);
    pen.mask(o.rows(pouch, 69, 69), M.hl, true);
    pen.mask(o.rows(pouch, 72, 72), M.deep, true);
    o.dots(pen, [[50, 72], [50, 73]], MT.base);
  });
});

const gloves = garment('gloves', 'gloves', 'Gloves', ['main'], ({ g, add }) => {
  for (const s of SIDES) {
    const c = tone(s, M);
    const ol = on(g, lo(s));
    // a snug glove, a cuff a pixel proud over the wrist
    const cuff = ol.rows(g.poly(lo(s), FOREARM[s]), 68, 71).dilate(1).and(ol.rows(ALL, 68, 71));
    const m = g.hands[s].or(cuff);
    add(lo(s), (pen) => {
      pen.mask(m, c.base);
      pen.mask(rightBand(m, 2).or(bottomBand(m, 1)), c.shade, true);
      pen.mask(ol.rows(cuff, 68, 68), s === 'R' ? c.hl : c.base, true);
      pen.mask(ol.rows(cuff, 70, 70), c.deep, true);
      // the fingers of the fist
      if (s === 'R') {
        ol.line(pen, [[20, 75], [24, 75]], c.shade);
        ol.dots(pen, [[22, 76], [22, 77]], c.shade);
        ol.line(pen, [[20, 72], [23, 72]], c.hl);
      } else {
        ol.line(pen, [[54, 75], [58, 75]], c.shade);
        ol.dots(pen, [[56, 76], [56, 77]], c.shade);
      }
    });
  }
});

const badge = garment('badge', 'badge', 'ID badge', ['main'], ({ g, add }) => {
  const o = on(g, 'torso');
  add('torso', (pen) => {
    const card = o.poly([[45, 51], [50, 51], [50, 57], [45, 57]]);
    pen.mask(card, M.base);
    pen.mask(topBand(card, 1), M.hl, true);
    pen.mask(rightBand(card, 1).or(bottomBand(card, 1)), M.shade, true);
    // a photo, a line of text, the clip
    o.dots(pen, [[46, 53], [47, 53], [46, 54]], M.deep);
    o.dots(pen, [[47, 54]], M.shade);
    o.line(pen, [[46, 56], [48, 56]], M.deep);
    o.dots(pen, [[47, 50]], M.deep);
  });
});

const patch = garment('patch', 'patch', 'Arm patch', ['main'], ({ g, add }) => {
  const ou = on(g, 'upper_arm_R');
  add('upper_arm_R', (pen) => {
    // a shield on the near shoulder, inside the sleeve's edge
    const p = ou.poly([[24, 47], [28, 47], [28, 51], [26, 53], [24, 51]]).and(g.parts.upper_arm_R);
    pen.mask(p, M.base);
    pen.mask(topBand(p, 1), M.hl, true);
    pen.mask(rightBand(p, 1).or(bottomBand(p, 1)), M.shade, true);
    ou.dots(pen, [[25, 49], [26, 50]], M.deep);
  });
});

// ── neck pieces ───────────────────────────────────────────────

function neck(name: string, label: string, draw: (g: BodyGeometry, pen: Pen) => void, back?: (g: BodyGeometry, pen: Pen) => void) {
  return garment(`neck:${name}`, 'neck', label, ['main'], ({ g, add }) => {
    if (back) add('hair_back', (pen) => back(g, pen));
    add('torso', (pen) => draw(g, pen));
  });
}

/** a shirt collar's two wings, the near one lit */
const collarWings = (g: BodyGeometry, pen: Pen, c: Ramp) => {
  const o = on(g, 'torso');
  const near = o.poly([[36, 39], [39, 39], [42, 45], [36, 43]]);
  const farW = o.poly([[46, 39], [49, 39], [50, 42], [45, 44]]);
  pen.mask(near, c.base);
  pen.mask(topBand(near, 1), c.hl, true);
  o.line(pen, [[37, 43], [41, 45]], c.shade);
  pen.mask(farW, c.shade);
  o.line(pen, [[46, 39], [49, 39]], c.base);
  o.dots(pen, [[45, 44]], c.deep);
};

const NECKS: AssetDef[] = [
  neck('collar', 'Shirt collar', (g, pen) => {
    const o = on(g, 'torso');
    // the band round the back of the neck, then the two wings
    pen.mask(o.rows(g.neck.dilate(1).sub(g.neck), 37, 40), M.shade);
    collarWings(g, pen, M);
  }),
  neck('tie', 'Tie', (g, pen) => {
    const o = on(g, 'torso');
    // a white shirt collar (fixed) under the tie
    collarWings(g, pen, { hl: FIXED.white, base: FIXED.eyeWhite, shade: FIXED.eyeWhite, deep: FIXED.eyeWhite });
    const knot = o.poly([[41, 42], [45, 42], [44, 45], [42, 45]]);
    const blade = o.poly([[42, 45], [44, 45], [45, 64], [43, 66], [41, 64]]);
    pen.mask(blade, M.base);
    pen.mask(rightBand(blade, 1), M.shade, true);
    o.line(pen, [[42, 50], [44, 48]], M.shade);
    pen.mask(knot, M.base);
    o.dots(pen, [[42, 42]], M.hl);
    o.dots(pen, [[44, 43], [43, 44]], M.shade);
    o.dots(pen, [[43, 65]], M.deep);
  }),
  neck(
    'hood',
    'Hood',
    (g, pen) => {
      const o = on(g, 'torso');
      // the hood's rim lying round the shoulders, open at the throat, its drawstrings
      const roll = o.poly([[31, 41], [37, 38], [39, 41], [41, 45], [45, 45], [47, 41], [49, 38], [53, 42], [53, 46], [47, 48], [42, 49], [36, 48], [31, 45]]).and(g.parts.torso.dilate(1));
      torsoCloth(g, pen, roll, M);
      pen.mask(topBand(roll, 1).sub(o.poly([[47, 0], [80, 0], [80, 128], [47, 128]])), M.hl, true);
      o.line(pen, [[39, 42], [41, 46], [45, 46], [47, 42]], M.deep);
      o.line(pen, [[41, 48], [41, 54]], M.shade);
      o.line(pen, [[45, 48], [45, 53]], M.deep);
      o.dots(pen, [[41, 55], [45, 54]], M.hl);
    },
    (g, pen) => {
      // bunched behind the neck, under the back of the head
      const o = on(g, 'torso');
      const m = o.poly([[26, 33], [30, 29], [36, 29], [40, 36], [40, 44], [34, 46], [28, 44], [25, 39]]);
      const c = far(M);
      pen.mask(m, c.base);
      pen.mask(rightBand(m, 2).or(bottomBand(m, 1)), c.shade, true);
      o.line(pen, [[29, 33], [33, 32], [36, 36]], M.deep);
      o.line(pen, [[27, 36], [29, 34]], M.base);
    },
  ),
  neck('turtle', 'Turtleneck', (g, pen) => {
    const o = on(g, 'torso');
    const m = o.rows(g.neck.dilate(1), 34, 42).or(o.rows(g.parts.torso.and(g.neck.dilate(3)), 40, 43));
    pen.mask(m, M.base);
    pen.mask(rightBand(m, 3).or(bottomBand(m, 1)), M.shade, true);
    pen.mask(topBand(m, 1), M.hl, true);
    // the rolled collar's folds
    o.line(pen, [[39, 37], [45, 37]], M.shade);
    o.line(pen, [[39, 40], [46, 40]], M.shade);
    o.dots(pen, [[39, 38], [39, 41]], M.hl);
  }),
  neck('ring', 'Crew ring', (g, pen) => {
    const o = on(g, 'torso');
    const m = o.rows(g.neck.dilate(2).sub(g.neck.erode(1)), 39, 43).and(g.parts.torso.dilate(1));
    pen.mask(m, M.base);
    pen.mask(rightBand(m, 2).or(bottomBand(m, 1)), M.shade, true);
    o.dots(pen, [[39, 41], [40, 42]], M.hl);
  }),
  neck('vneck', 'V-neck trim', (g, pen) => {
    const o = on(g, 'torso');
    o.line(pen, [[38, 40], [42, 48]], M.base);
    o.line(pen, [[39, 40], [43, 48]], M.hl);
    o.line(pen, [[47, 40], [44, 48]], M.shade);
    o.line(pen, [[48, 40], [45, 48]], M.base);
    o.dots(pen, [[43, 49], [44, 49]], M.deep);
  }),
  neck('scarf', 'Scarf', (g, pen) => {
    const o = on(g, 'torso');
    const wrap = o.rows(g.neck.dilate(2), 36, 44).or(o.poly([[34, 41], [52, 41], [50, 46], [36, 46]])).and(g.parts.torso.dilate(2));
    const tail = o.poly([[37, 44], [42, 44], [41, 60], [36, 60]]);
    pen.mask(wrap, M.base);
    pen.mask(rightBand(wrap, 3).or(bottomBand(wrap, 1)), M.shade, true);
    pen.mask(topBand(wrap, 1), M.hl, true);
    o.line(pen, [[38, 39], [46, 42]], M.shade);
    pen.mask(tail, M.base);
    pen.mask(leftBand(tail, 1), M.hl, true);
    pen.mask(rightBand(tail, 1), M.shade, true);
    o.line(pen, [[36, 59], [41, 59]], M.shade);
    o.dots(pen, [[36, 61], [38, 61], [40, 61]], M.base);
    o.line(pen, [[37, 46], [42, 46]], M.deep);
  }),
  neck('henley', 'Henley placket', (g, pen) => {
    const o = on(g, 'torso');
    const ring = o.rows(g.neck.dilate(1).sub(g.neck.erode(1)), 40, 42).and(g.parts.torso.dilate(1));
    pen.mask(ring, M.base);
    pen.mask(rightBand(ring, 2), M.shade, true);
    const placket = o.poly([[42, 42], [45, 42], [45, 53], [42, 53]]);
    pen.mask(placket, M.base);
    pen.mask(rightBand(placket, 1), M.shade, true);
    o.line(pen, [[42, 53], [44, 53]], M.deep);
    o.dots(pen, [[43, 44], [43, 47], [43, 50]], M.hl);
    o.dots(pen, [[44, 44], [44, 47], [44, 50]], M.deep);
  }),
];

export const GARMENTS: AssetDef[] = [
  top('top:long', 'Long-sleeved top', 70, 'cuff'),
  top('top:short', 'T-shirt', 52, 'hem'),
  top('top:rolled', 'Rolled sleeves', 64, 'rolled'),
  trousers('pants:straight', 'Trousers', false),
  trousers('pants:cargo', 'Cargo trousers', true),
  skirt,
  shoes,
  boots,
  coat('coat:short', 'Jacket', false),
  coat('coat:long', 'Long coat', true),
  overalls,
  vest,
  apron,
  stripe,
  suspenders,
  belt,
  strap,
  gloves,
  badge,
  patch,
  ...NECKS,
];

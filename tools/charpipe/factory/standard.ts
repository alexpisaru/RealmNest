// Character factory: the "standard" RealmNest body in the se view (80×128, feet at 40,120), drawn
// in PhotoCraft part by part, back to front. Coordinates are pixel edges: a polygon from x=30
// to x=40 covers pixels 30..39; a line or dot is the pixel itself. Proportions follow
// docs/CHARACTER_ART_BIBLE.md; light comes from the upper left.
//
// A character is a list of pieces (one PhotoCraft layer each, named `<part>/<material>`), every
// piece drawn in three passes so the build can preview between them: fill (flat silhouette),
// shade (Lock Transparency fills), detail (pencil). Outlines follow, part by part.
import type { P, Painter } from '../pcdraw';
import type { CharacterSpec, Ramp } from './spec';

/** back to front; each entry is exported as one PNG per outfit */
export const PARTS = ['hair_back', 'upper_arm_L', 'lower_arm_L', 'lower_leg_L', 'upper_leg_L', 'torso', 'head', 'lower_leg_R', 'upper_leg_R', 'upper_arm_R', 'lower_arm_R'] as const;
export type Part = (typeof PARTS)[number];
/** the rig joint each part rides on */
export const JOINT: Record<string, string> = {
  hair_back: 'head',
  upper_arm_L: 'upper_arm_L',
  lower_arm_L: 'lower_arm_L',
  lower_leg_L: 'lower_leg_L',
  upper_leg_L: 'upper_leg_L',
  torso: 'torso',
  head: 'head',
  lower_leg_R: 'lower_leg_R',
  upper_leg_R: 'upper_leg_R',
  upper_arm_R: 'upper_arm_R',
  lower_arm_R: 'lower_arm_R',
  accessory: 'head',
};
/** rig pivots for this body (frame px), soles and reach for the shared walk */
export const PIVOTS: Record<string, P> = {
  root: [40, 120],
  pelvis: [41, 80],
  torso: [41, 80],
  head: [43, 39],
  upper_arm_R: [27, 46],
  lower_arm_R: [25, 58],
  upper_arm_L: [55, 46],
  lower_arm_L: [56, 58],
  upper_leg_R: [36, 80],
  lower_leg_R: [33, 98],
  upper_leg_L: [47, 80],
  lower_leg_L: [48, 97],
};
/** the middle of each sole's outline row: the near foot on row 119, the far one on 117 (art bible) */
export const SOLES: Record<string, P[]> = { lower_leg_R: [[32, 119]], lower_leg_L: [[51, 117]] };
export const REACH: Record<string, number> = { upper_leg_R: 39, upper_leg_L: 37, upper_arm_R: 33, upper_arm_L: 33 };
/**
 * Joint bands where a part's outline is erased: the neighbour overlaps there, and an outline
 * across a joint would show as a seam when the part turns. [x, y, w, h]
 */
export const SEAMS: Record<string, [number, number, number, number][]> = {
  torso: [[30, 84, 24, 2]],
  upper_leg_R: [[26, 75, 18, 4], [26, 98, 16, 3]],
  upper_leg_L: [[40, 75, 16, 4], [40, 97, 16, 3]],
  lower_leg_R: [[25, 94, 16, 4]],
  lower_leg_L: [[42, 93, 14, 4]],
  upper_arm_R: [[18, 58, 16, 3]],
  upper_arm_L: [[50, 58, 13, 3]],
  lower_arm_R: [[18, 55, 15, 3]],
  lower_arm_L: [[50, 55, 13, 3]],
};

export interface Piece {
  layer: string;
  fill(pt: Painter): void;
  shade?(pt: Painter): void;
  detail?(pt: Painter): void;
}

// ── hair styles ───────────────────────────────────────────────

function hairLong(h: Ramp): { back: Piece; front: Piece } {
  return {
    back: {
      layer: 'hair_back/hair',
      fill: (pt) => {
        pt.poly([[28, 14], [24, 22], [22, 34], [20, 48], [18, 62], [18, 72], [20, 76], [22, 74], [24, 77], [26, 74], [28, 76], [31, 70], [33, 64], [35, 50], [37, 40], [38, 28], [36, 14]], h.base);
        // the far side: a lock falling behind the cheek (the face covers all but its edge)
        pt.poly([[50, 14], [57, 15], [59, 22], [59, 31], [57, 37], [55, 39], [52, 30]], h.shade);
      },
      shade: (pt) => {
        // the side against the back is in the head's shadow
        pt.shade([[31, 30], [38, 30], [36, 44], [34, 56], [32, 66], [29, 76], [26, 76], [29, 62], [31, 48]], h.shade);
        pt.shade([[34, 36], [38, 36], [36, 46], [34, 46]], h.deep ?? h.shade);
      },
      detail: (pt) => {
        // strands: light on the outer (upper-left) edge, dark partings inside
        pt.line([[24, 24], [22, 36], [21, 48]], h.hl);
        pt.line([[20, 54], [19, 66]], h.hl);
        pt.line([[27, 26], [25, 44], [24, 62], [23, 72]], h.shade);
      },
    },
    front: {
      layer: 'head/hair',
      fill: (pt) => {
        // crown with a few tufts breaking the outline, fringe swept to the right
        pt.poly([[26, 22], [26, 16], [29, 12], [31, 11], [33, 8], [36, 7], [40, 5], [42, 6], [46, 6], [48, 7], [53, 9], [56, 11], [57, 13], [59, 18], [58, 22], [56, 21], [54, 22], [52, 20], [49, 21], [46, 20], [44, 21], [41, 20], [38, 23], [38, 29], [38, 36], [35, 40], [30, 37], [27, 30]], h.base);
        // a long lock falling in front of the near shoulder
        pt.poly([[31, 34], [38, 34], [37, 42], [36, 50], [34, 56], [32, 58], [31, 54], [30, 46]], h.base);
      },
      shade: (pt) => {
        // the back of the head, behind the ear line, and the fringe tips
        pt.shade([[26, 24], [29, 23], [32, 31], [33, 40], [30, 37], [27, 30]], h.shade);
        pt.shade([[38, 19], [59, 18], [59, 23], [38, 23]], h.shade);
        pt.shade([[35, 26], [39, 26], [39, 37], [36, 39]], h.shade);
      },
      detail: (pt) => {
        // a glossy band across the crown (light from the upper left) and the fringe's partings
        pt.line([[29, 14], [33, 10], [38, 8]], h.hl);
        pt.line([[28, 17], [32, 13], [37, 11], [42, 10]], h.hl);
        pt.line([[47, 9], [44, 17]], h.shade);
        pt.line([[53, 11], [51, 17]], h.shade);
        pt.line([[39, 11], [37, 17]], h.shade);
        pt.line([[29, 21], [30, 28]], h.hl);
        // the front lock: lit edge and a parting
        pt.line([[31, 38], [31, 52]], h.hl);
        pt.line([[35, 38], [34, 50], [33, 55]], h.shade);
      },
    },
  };
}

function hairShort(h: Ramp): { back: Piece; front: Piece } {
  // a short tousled crop: nothing behind the body, a rounder cap with chunky tufts
  return {
    back: {
      layer: 'hair_back/hair',
      fill: (pt) => pt.poly([[28, 16], [26, 24], [27, 34], [31, 40], [36, 38], [37, 20]], h.shade),
    },
    front: {
      layer: 'head/hair',
      fill: (pt) =>
        pt.poly([[25, 22], [26, 15], [30, 10], [35, 6], [40, 7], [43, 4], [47, 7], [52, 7], [56, 11], [59, 16], [58, 22], [57, 20], [55, 22], [53, 20], [51, 22], [49, 20], [47, 22], [45, 20], [43, 22], [41, 20], [39, 22], [38, 24], [37, 31], [34, 36], [30, 35], [27, 30]], h.base),
      shade: (pt) => {
        pt.shade([[25, 24], [31, 22], [36, 30], [34, 36], [27, 32]], h.shade);
        pt.shade([[38, 18], [59, 17], [59, 23], [38, 23]], h.shade);
      },
      detail: (pt) => {
        pt.line([[29, 13], [33, 9], [37, 8]], h.hl);
        pt.line([[41, 8], [45, 7]], h.hl);
        pt.line([[47, 9], [44, 16]], h.shade);
        pt.line([[53, 11], [50, 17]], h.shade);
        pt.line([[39, 11], [37, 17]], h.shade);
      },
    },
  };
}

const HAIR: Record<string, (h: Ramp) => { back: Piece; front: Piece }> = { long: hairLong, short: hairShort };

// ── tops (the jacket: torso panels + sleeves) ────────────────

interface Top {
  torso: Piece;
  upperR: Piece;
  lowerR: Piece;
  upperL: Piece;
  lowerL: Piece;
}

function openJacket(j: Ramp): Top {
  const deep = j.deep ?? j.shade;
  return {
    torso: {
      layer: 'torso/jacket',
      fill: (pt) => {
        pt.poly([[27, 46], [31, 42], [39, 40], [41, 48], [41, 75], [30, 75], [30, 62], [28, 54]], j.base);
        // the right panel runs a pixel under the far arm's shoulder, so a swing never opens a notch
        pt.poly([[46, 40], [52, 40], [55, 42], [55, 47], [54, 58], [53, 75], [46, 75], [45, 50]], j.base);
      },
      shade: (pt) => {
        // turned away from the light: the right panel, and the inside edges along the shirt
        pt.shade([[48, 40], [55, 40], [55, 76], [49, 76]], j.shade);
        pt.shadeRect(39, 48, 3, 28, j.shade);
        pt.shadeRect(30, 73, 24, 2, j.shade);
        pt.shade([[27, 46], [31, 42], [36, 41], [30, 47], [28, 52]], j.hl);
        // the near arm's shadow on the body
        pt.shadeRect(31, 47, 3, 27, j.shade);
      },
      detail: (pt) => {
        // lapels and collar, pocket flaps, the inside edge in deep shadow
        pt.line([[38, 41], [40, 47]], deep);
        pt.line([[47, 41], [46, 48]], deep);
        pt.line([[37, 41], [34, 43]], j.shade);
        pt.line([[48, 41], [51, 43]], deep);
        pt.line([[32, 63], [37, 63]], j.shade);
        pt.line([[48, 63], [52, 63]], deep);
        pt.line([[40, 48], [40, 74]], deep);
        pt.line([[46, 49], [46, 74]], deep);
        pt.dots([[38, 66], [50, 66]], j.hl);
      },
    },
    upperR: {
      layer: 'upper_arm_R/jacket',
      fill: (pt) => pt.poly([[23, 46], [27, 42], [32, 42], [31, 59], [22, 59], [22, 50]], j.base),
      shade: (pt) => {
        pt.shadeRect(29, 44, 3, 16, j.shade);
        pt.shade([[23, 46], [27, 42], [30, 42], [25, 47], [23, 52]], j.hl);
      },
      detail: (pt) => pt.line([[28, 48], [28, 57]], j.shade),
    },
    lowerR: {
      layer: 'lower_arm_R/jacket',
      fill: (pt) => pt.poly([[21, 57], [30, 57], [29, 72], [20, 72]], j.base),
      shade: (pt) => {
        pt.shadeRect(27, 57, 3, 16, j.shade);
        pt.shadeRect(20, 69, 10, 3, j.shade);
      },
      detail: (pt) => {
        pt.line([[20, 69], [28, 69]], deep);
        pt.line([[21, 60], [21, 67]], j.hl);
      },
    },
    upperL: {
      layer: 'upper_arm_L/jacket',
      fill: (pt) => pt.poly([[50, 42], [55, 42], [58, 46], [59, 59], [52, 59], [51, 50]], j.shade),
      shade: (pt) => pt.shadeRect(50, 42, 3, 18, deep),
    },
    lowerL: {
      layer: 'lower_arm_L/jacket',
      fill: (pt) => pt.poly([[52, 57], [59, 57], [60, 72], [53, 72]], j.shade),
      shade: (pt) => {
        pt.shadeRect(52, 57, 2, 16, deep);
        pt.shadeRect(52, 69, 9, 3, deep);
      },
    },
  };
}

/** a light technical jacket: closed front with a zip, a contrast stripe, high collar */
function techJacket(j: Ramp): Top {
  const deep = j.deep ?? j.shade;
  const acc = j.accent ?? deep;
  const base = openJacket(j);
  return {
    torso: {
      layer: 'torso/jacket',
      fill: (pt) => {
        pt.poly([[27, 46], [31, 42], [37, 39], [49, 39], [54, 44], [54, 58], [53, 75], [30, 75], [30, 62], [28, 54]], j.base);
      },
      shade: (pt) => {
        pt.shade([[47, 39], [55, 39], [55, 76], [48, 76]], j.shade);
        pt.shadeRect(30, 73, 24, 2, j.shade);
        pt.shade([[27, 46], [31, 42], [36, 40], [30, 47], [28, 52]], j.hl);
        // high collar
        pt.shadeRect(37, 39, 12, 3, j.shade);
      },
      detail: (pt) => {
        pt.line([[43, 42], [43, 74]], deep);
        pt.line([[44, 43], [44, 74]], j.hl);
        pt.line([[29, 60], [53, 60]], acc);
        pt.line([[29, 61], [53, 61]], acc);
        pt.line([[37, 41], [49, 41]], deep);
        pt.rect(33, 64, 5, 4, j.shade);
        pt.line([[33, 64], [37, 64]], deep);
        pt.dots([[45, 52], [45, 53]], acc);
      },
    },
    upperR: {
      ...base.upperR,
      detail: (pt) => {
        pt.line([[28, 48], [28, 57]], j.shade);
        pt.line([[22, 52], [30, 52]], acc);
      },
    },
    lowerR: {
      ...base.lowerR,
      detail: (pt) => {
        pt.line([[20, 69], [28, 69]], deep);
        pt.line([[21, 60], [21, 67]], j.hl);
        pt.line([[20, 70], [28, 70]], acc);
      },
    },
    upperL: { ...base.upperL, detail: (pt) => pt.line([[52, 52], [58, 52]], acc) },
    lowerL: base.lowerL,
  };
}

const TOPS: Record<string, (j: Ramp) => Top> = { 'open-jacket': openJacket, 'tech-jacket': techJacket };

// ── the whole figure ──────────────────────────────────────────

export function pieces(s: CharacterSpec): Piece[] {
  const sk = s.skin;
  const sh = s.outfit.shirt.colors;
  const tr = s.outfit.trousers.colors;
  const so = s.outfit.shoes.colors;
  const hair = (HAIR[s.hair.style] ?? hairLong)(s.hair.colors);
  const top = (TOPS[s.outfit.top.style] ?? openJacket)(s.outfit.top.colors);
  const skDeep = sk.deep ?? sk.shade;
  const trDeep = tr.deep ?? tr.shade;

  const hand = (layer: string, pts: P[], far: boolean): Piece => ({
    layer,
    fill: (pt) => pt.poly(pts, far ? sk.shade : sk.base),
    shade: (pt) => {
      const xs = pts.map((p) => p[0]);
      const x1 = Math.max(...xs);
      pt.shadeRect(x1 - 3, 71, 3, 10, far ? skDeep : sk.shade);
      pt.shadeRect(Math.min(...xs), 78, x1 - Math.min(...xs), 2, far ? skDeep : sk.shade);
    },
    detail: (pt) => {
      // the curled fingers of a relaxed fist
      const x0 = Math.min(...pts.map((p) => p[0]));
      pt.line([[x0 + 1, 75], [x0 + 5, 75]], far ? skDeep : sk.shade);
      pt.dots([[x0 + 3, 76], [x0 + 3, 77]], far ? skDeep : sk.shade);
      if (!far) pt.line([[x0 + 1, 72], [x0 + 4, 72]], sk.hl);
    },
  });

  const shoe = (layer: string, pts: P[], sole: number, x0: number, x1: number, far: boolean): Piece => ({
    layer,
    fill: (pt) => pt.poly(pts, so.base),
    shade: (pt) => {
      pt.shadeRect(x0, sole, x1 - x0, 1, so.shade);
      if (far) pt.shadeRect(x0, sole - 7, 3, 8, so.shade);
    },
    detail: (pt) => {
      pt.line([[x1 - 7, sole - 6], [x1 - 4, sole - 5]], so.hl);
      pt.line([[x0 + 1, sole - 2], [x1 - 2, sole - 2]], so.shade);
    },
  });

  return [
    hair.back,
    top.upperL,
    top.lowerL,
    hand('lower_arm_L/skin', [[53, 71], [60, 71], [61, 73], [61, 78], [59, 80], [55, 80], [53, 78]], true),
    {
      layer: 'lower_leg_L/trousers',
      fill: (pt) => pt.poly([[44, 96], [52, 96], [53, 111], [45, 111]], tr.shade),
      shade: (pt) => pt.shadeRect(44, 96, 2, 15, trDeep),
      detail: (pt) => pt.line([[45, 109], [52, 109]], trDeep),
    },
    shoe('lower_leg_L/shoe', [[44, 108], [53, 108], [57, 111], [58, 114], [58, 117], [44, 117]], 116, 44, 58, true),
    {
      layer: 'upper_leg_L/trousers',
      fill: (pt) => pt.poly([[42, 77], [51, 77], [52, 98], [43, 98]], tr.shade),
      shade: (pt) => pt.shadeRect(42, 77, 2, 22, trDeep),
      detail: (pt) => pt.line([[47, 92], [50, 94]], trDeep),
    },
    {
      layer: 'torso/skin',
      fill: (pt) => pt.poly([[39, 35], [47, 35], [47, 43], [39, 43]], sk.shade),
      shade: (pt) => pt.shadeRect(39, 39, 8, 2, skDeep),
    },
    {
      layer: 'torso/trousers',
      fill: (pt) => pt.poly([[31, 70], [52, 70], [52, 84], [31, 84]], tr.base),
      shade: (pt) => pt.shadeRect(46, 70, 6, 14, tr.shade),
      detail: (pt) => pt.line([[41, 78], [41, 83]], tr.shade),
    },
    {
      layer: 'torso/shirt',
      fill: (pt) => pt.poly([[37, 40], [49, 40], [47, 75], [39, 75]], sh.base),
      shade: (pt) => {
        pt.shadeRect(44, 40, 5, 36, sh.shade);
        pt.shade([[40, 40], [46, 40], [43, 45]], sk.shade);
      },
      detail: (pt) => {
        pt.line([[39, 40], [42, 44]], sh.hl);
        pt.line([[47, 40], [44, 44]], sh.shade);
        pt.dots([[43, 50], [43, 56], [43, 62], [43, 68]], sh.shade);
      },
    },
    top.torso,
    {
      layer: 'head/skin',
      // the face in three-quarter view: the far contour runs smoothly from the temple down the
      // cheek to the chin (no nose sticking out of it; the nose is a shadow inside)
      fill: (pt) => pt.poly([[36, 17], [52, 15], [54, 20], [55, 24], [55, 30], [54, 32], [53, 34], [52, 35], [50, 37], [47, 39], [44, 39], [41, 37], [37, 33]], sk.base),
      shade: (pt) => {
        // under the fringe, the back of the cheek by the hair, and under the jaw
        pt.shadeRect(36, 21, 20, 2, sk.shade);
        pt.shade([[36, 17], [40, 17], [40, 33], [42, 37], [44, 39], [40, 38], [37, 33]], sk.shade);
        pt.shade([[44, 37], [48, 37], [52, 34], [52, 36], [48, 39], [44, 39]], sk.shade);
      },
      detail: (pt) => {
        // the eyes on one line (lid on row 26, the eye on rows 27–29), built the same way and both
        // looking ahead (se): highlight and iris, the pupil on the side they look to. The near eye
        // has a 1-px white before the iris; the far one is foreshortened to 2 px.
        pt.line([[41, 26], [45, 26]], s.outline);
        pt.dots([[42, 27], [42, 28]], '#f4efe4');
        pt.rect(43, 27, 2, 3, s.eyes);
        pt.dots([[44, 27], [44, 28]], s.outline);
        pt.dots([[43, 27]], '#ffffff');
        pt.line([[49, 26], [52, 26]], s.outline);
        pt.rect(50, 27, 2, 3, s.eyes);
        pt.dots([[51, 27], [51, 28]], s.outline);
        pt.dots([[50, 27]], '#ffffff');
        // level 1-px brows, two rows above the lids
        pt.line([[41, 23], [44, 23]], s.hair.colors.shade);
        pt.line([[49, 23], [51, 23]], s.hair.colors.shade);
        // the shadow under the nose's tip; the mouth under it, with a darker corner
        pt.dots([[53, 31]], sk.shade);
        pt.line([[48, 34], [49, 34]], s.mouth);
        pt.dots([[50, 34]], sk.shade);
      },
    },
    hair.front,
    {
      layer: 'lower_leg_R/trousers',
      fill: (pt) => pt.poly([[29, 97], [38, 97], [37, 112], [28, 112]], tr.base),
      shade: (pt) => pt.shadeRect(35, 97, 3, 15, tr.shade),
      detail: (pt) => pt.line([[29, 110], [37, 110]], tr.shade),
    },
    shoe('lower_leg_R/shoe', [[25, 110], [37, 110], [40, 113], [41, 116], [41, 119], [24, 119]], 118, 24, 41, false),
    {
      layer: 'upper_leg_R/trousers',
      fill: (pt) => pt.poly([[31, 77], [41, 77], [39, 99], [29, 99]], tr.base),
      shade: (pt) => pt.shadeRect(37, 77, 4, 22, tr.shade),
      detail: (pt) => {
        pt.line([[32, 80], [31, 94]], tr.hl);
        pt.line([[32, 93], [35, 95]], tr.shade);
      },
    },
    top.upperR,
    top.lowerR,
    hand('lower_arm_R/skin', [[19, 71], [27, 71], [28, 73], [28, 78], [26, 80], [21, 80], [19, 78]], false),
  ];
}

/** the accessory, on its own layer (riding on the head) */
export function accessory(s: CharacterSpec): Piece | null {
  if (s.accessory?.style !== 'round-glasses') return null;
  const c = s.accessory.color;
  return {
    layer: 'accessory/glasses',
    fill: (pt) => {
      // two round rims (the far one narrower), a bridge and the temple running back into the hair
      pt.line([[41, 25], [45, 25]], c);
      pt.line([[41, 30], [45, 30]], c);
      pt.line([[40, 26], [40, 29]], c);
      pt.line([[46, 26], [46, 29]], c);
      pt.line([[49, 25], [51, 25]], c);
      pt.line([[49, 30], [51, 30]], c);
      pt.line([[48, 26], [48, 29]], c);
      pt.line([[52, 26], [52, 29]], c);
      pt.dots([[47, 27]], c);
      pt.line([[39, 27], [38, 27]], c);
    },
  };
}

// Cast factory: the RealmNest cast body at the standard model's scale (80×128, feet at 40,120, the
// proportions of Maya and Teo), in every shape the app offers:
//   kind   masc | fem | neutral   (shoulders, waist, hips, bust, jaw)
//   build  slim | regular | broad (widths: torso, limbs)
//   height short | regular | tall (leg length: the upper body rides 3 px lower or higher)
//
// The body is masks, one per rig part, from hand-placed polygons (pixel-edge coordinates, like
// tools/charpipe/factory/standard.ts) reshaped row by row for kind and build. Every garment, hair
// and accessory is cut from these masks, so it fits any body by construction.
//
// Height only changes the legs. Above the hips nothing changes shape: an upper-body frame of a
// tall figure is the regular frame moved up 3 px (the animations move the upper body by
// translations and turns about pivots that move with it), so upper bands are rendered once per
// kind and build and offset at runtime (HEIGHT_DY); leg bands are rendered for every height.
import { Mask, type Pt } from '../hd/mask';

export const W = 80;
export const H = 128;
export const FOOT: Pt = [40, 120];

export type Kind = 'masc' | 'fem' | 'neutral';
export type Build = 'slim' | 'regular' | 'broad';
export type Height = 'short' | 'regular' | 'tall';
export const KINDS: Kind[] = ['masc', 'fem', 'neutral'];
export const BUILDS: Build[] = ['slim', 'regular', 'broad'];
export const HEIGHTS: Height[] = ['short', 'regular', 'tall'];
/** how far the hips (and everything above them) move for a height: negative = up */
export const HEIGHT_DY: Record<Height, number> = { short: 3, regular: 0, tall: -3 };

/** back to front, as in the standard model; hands ride on the forearms, feet on the shins */
export const PARTS = ['hair_back', 'upper_arm_L', 'lower_arm_L', 'lower_leg_L', 'upper_leg_L', 'torso', 'head', 'lower_leg_R', 'upper_leg_R', 'upper_arm_R', 'lower_arm_R'] as const;
export type Part = (typeof PARTS)[number];
export const JOINT: Record<Part, string> = {
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
};
/** runtime layers: each band composites every asset in slot order, and gets its own outline */
export const BANDS: Record<Part, string> = {
  hair_back: 'back',
  upper_arm_L: 'armL',
  lower_arm_L: 'armL',
  lower_leg_L: 'legL',
  upper_leg_L: 'legL',
  torso: 'torso',
  head: 'head',
  lower_leg_R: 'legR',
  upper_leg_R: 'legR',
  upper_arm_R: 'armR',
  lower_arm_R: 'armR',
};
export const LEG_BANDS = ['legL', 'legR'];
/**
 * Band order per animation. Standing, both legs go under the torso (its hem and the trousers'
 * waist cover the hip joints); seated, both thighs come over it (the lap).
 */
export const BAND_ORDER: Record<string, string[]> = {
  default: ['back', 'armL', 'legL', 'legR', 'torso', 'head', 'armR'],
  sit: ['back', 'armL', 'torso', 'head', 'legL', 'legR', 'armR'],
};

// ── the regular masculine body, in polygons ───────────────────

const R: Record<string, Pt[]> = {
  // skull, face (three-quarter, facing right) and the back of the head
  head: [[37, 33], [33, 32], [30, 29], [28, 25], [27, 19], [29, 13], [33, 9], [38, 7], [44, 6], [49, 7], [53, 9], [56, 13], [57, 18], [56, 22], [55, 24], [55, 30], [54, 32], [53, 34], [52, 35], [50, 37], [47, 39], [44, 39], [41, 37]],
  ear: [[34, 26], [37, 25], [39, 27], [39, 31], [37, 33], [35, 32], [34, 29]],
  neck: [[39, 34], [47, 34], [47, 42], [39, 42]],
  torso: [[30, 45], [33, 42], [39, 40], [47, 40], [52, 41], [54, 44], [53, 56], [52, 66], [52, 76], [53, 84], [31, 84], [31, 76], [31, 66], [30, 56], [29, 50]],
  upper_arm_R: [[23, 46], [26, 43], [31, 43], [31, 58], [23, 58], [22, 51]],
  lower_arm_R: [[22, 57], [29, 57], [28, 71], [21, 71]],
  hand_R: [[19, 71], [27, 71], [28, 73], [28, 78], [26, 80], [21, 80], [19, 78]],
  upper_arm_L: [[51, 43], [55, 43], [57, 46], [58, 58], [52, 58], [51, 50]],
  lower_arm_L: [[52, 57], [58, 57], [59, 71], [53, 71]],
  hand_L: [[53, 71], [60, 71], [61, 73], [61, 78], [59, 80], [55, 80], [53, 78]],
  upper_leg_R: [[32, 77], [41, 77], [39, 98], [30, 98]],
  lower_leg_R: [[30, 96], [37, 96], [36, 111], [29, 111]],
  foot_R: [[27, 110], [36, 110], [38, 113], [39, 116], [39, 119], [26, 119]],
  upper_leg_L: [[42, 77], [50, 77], [51, 97], [44, 97]],
  lower_leg_L: [[45, 96], [51, 96], [52, 110], [46, 110]],
  foot_L: [[45, 108], [52, 108], [56, 111], [57, 114], [57, 117], [45, 117]],
};

/** rig pivots of the regular body (frame px) */
const PIVOTS_REGULAR: Record<string, Pt> = {
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

// ── reshaping: kind and build ──────────────────────────────────

/** the body's vertical axis */
const CX = 41.5;
type Keys = [number, number][];
const lerp = (k: Keys, y: number) => {
  if (y <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (y <= k[i][0]) return k[i - 1][1] + ((y - k[i - 1][0]) / (k[i][0] - k[i - 1][0])) * (k[i][1] - k[i - 1][1]);
  return k[k.length - 1][1];
};
/** torso width by row (scale about the axis), per kind */
const TORSO: Record<Kind, Keys> = {
  masc: [[0, 1]],
  // narrower shoulders and waist, hips flaring out
  fem: [[40, 0.88], [50, 0.88], [62, 0.84], [70, 0.96], [76, 1.08], [84, 1.08]],
  neutral: [[40, 0.93], [62, 0.92], [76, 1], [84, 1]],
};
const BUILD_W: Record<Build, number> = { slim: 0.88, regular: 1, broad: 1.15 };
/** limbs get thinner or thicker about their own axis */
const LIMB_W: Record<Build, number> = { slim: 0.85, regular: 1, broad: 1.18 };
/** the hips, for the thighs' tops (fem a little wider) */
const HIP_W: Record<Kind, number> = { masc: 1, fem: 1.08, neutral: 1 };

type Group = 'head' | 'torso' | 'armR' | 'armL' | 'legR' | 'legL';
const GROUP: Record<Part, Group> = {
  hair_back: 'head',
  head: 'head',
  torso: 'torso',
  upper_arm_R: 'armR',
  lower_arm_R: 'armR',
  upper_arm_L: 'armL',
  lower_arm_L: 'armL',
  upper_leg_R: 'legR',
  lower_leg_R: 'legR',
  upper_leg_L: 'legL',
  lower_leg_L: 'legL',
};

export interface BodyShape {
  kind: Kind;
  build: Build;
  height: Height;
}
export const shapeId = (s: BodyShape) => `${s.kind}-${s.build}-${s.height}`;
/** the body an upper-body frame is rendered on (height does not change it) */
export const upperId = (s: Pick<BodyShape, 'kind' | 'build'>) => `${s.kind}-${s.build}`;

export interface BodyGeometry extends BodyShape {
  parts: Record<Part, Mask>;
  /** the whole skin (all parts) */
  interior: Mask;
  /** separate pieces for details: hands, feet, neck, ear */
  hands: { R: Mask; L: Mask };
  feet: { R: Mask; L: Mask };
  neck: Mask;
  ear: Mask;
  /** regular-body coordinates → this body, for a detail on a part */
  at(part: Part, x: number, y: number): Pt;
  /** a polygon in regular-body coordinates, reshaped like a part */
  poly(part: Part, pts: Pt[]): Mask;
  pivots: Record<string, Pt>;
  soles: Record<string, Pt[]>;
  reach: Record<string, number>;
}

/**
 * x of a regular-body point on this body. Torso and head scale about the body's axis; each limb
 * keeps its own axis (moved with the shoulder or hip line) and scales its width about it.
 */
function forward(shape: BodyShape, group: Group, x: number, y: number): number {
  const { kind, build } = shape;
  const torsoK = (yy: number) => lerp(TORSO[kind], yy) * BUILD_W[build];
  switch (group) {
    case 'head':
      return x;
    case 'torso':
      return CX + (x - CX) * torsoK(y);
    case 'armR':
    case 'armL': {
      // the arm's axis rides on the shoulder (row 46), its width scales about that axis
      const axis = group === 'armR' ? 26.5 + (y - 46) * -0.12 : 55 + (y - 46) * 0.08;
      const shoulder = CX + (axis - CX) * torsoK(46);
      return shoulder + (x - axis) * LIMB_W[build];
    }
    case 'legR':
    case 'legL': {
      const axis = group === 'legR' ? 35.5 + (y - 80) * -0.12 : 47 + (y - 80) * 0.05;
      // the hip line follows the hips' width, fading to the regular stance by the knee
      const k = lerp([[80, HIP_W[kind] * BUILD_W[build]], [98, 1 + (BUILD_W[build] - 1) * 0.4], [120, 1]], y);
      const hip = CX + (axis - CX) * k;
      return hip + (x - axis) * LIMB_W[build];
    }
  }
}

/** a height's leg stretch: rows between the hips and the knee move, the shins and feet stay */
function legY(height: Height, y: number) {
  const dy = HEIGHT_DY[height];
  if (!dy) return y;
  // the thigh spans rows 77..97: its top moves by dy, the knee stays
  if (y >= 97) return y;
  return y + dy * ((97 - y) / 20);
}

const PART_SRC: Record<Part, string[]> = {
  hair_back: [],
  head: ['head', 'ear'],
  torso: ['torso', 'neck'],
  upper_arm_R: ['upper_arm_R'],
  lower_arm_R: ['lower_arm_R', 'hand_R'],
  upper_arm_L: ['upper_arm_L'],
  lower_arm_L: ['lower_arm_L', 'hand_L'],
  upper_leg_R: ['upper_leg_R'],
  lower_leg_R: ['lower_leg_R', 'foot_R'],
  upper_leg_L: ['upper_leg_L'],
  lower_leg_L: ['lower_leg_L', 'foot_L'],
};

export function bodyGeometry(shape: BodyShape): BodyGeometry {
  const isLeg = (p: Part) => GROUP[p] === 'legR' || GROUP[p] === 'legL';
  const map = (part: Part, [x, y]: Pt): Pt => {
    const g = GROUP[part];
    const yy = isLeg(part) ? legY(shape.height, y) : y;
    return [forward(shape, g, x, y), yy];
  };
  const poly = (part: Part, pts: Pt[]) => Mask.poly(W, H, pts.map((p) => map(part, p)));
  const parts = {} as Record<Part, Mask>;
  for (const p of PARTS) parts[p] = PART_SRC[p].reduce((m, k) => m.or(poly(p, R[k])), new Mask(W, H));
  // the bust: the chest's front (right) edge rounds out under the far arm
  if (shape.kind === 'fem') parts.torso = parts.torso.or(Mask.ellipse(W, H, forward(shape, 'torso', 51, 52), 52, 3, 4).and(parts.torso.dilate(2)));
  // hidden overlaps: the thighs' tops reach under the hips, the torso's sides under the near arm
  const hips = parts.torso.rows(74, 90);
  parts.upper_leg_R = parts.upper_leg_R.or(hips.and(poly('upper_leg_R', [[29, 74], [42, 74], [42, 80], [29, 80]])));
  parts.upper_leg_L = parts.upper_leg_L.or(hips.and(poly('upper_leg_L', [[42, 74], [54, 74], [54, 80], [42, 80]])));
  const pivots: Record<string, Pt> = {};
  const pivotPart: Record<string, Part> = { root: 'torso', pelvis: 'torso', torso: 'torso', head: 'head', upper_arm_R: 'upper_arm_R', lower_arm_R: 'lower_arm_R', upper_arm_L: 'upper_arm_L', lower_arm_L: 'lower_arm_L', upper_leg_R: 'upper_leg_R', lower_leg_R: 'lower_leg_R', upper_leg_L: 'upper_leg_L', lower_leg_L: 'lower_leg_L' };
  for (const [j, p] of Object.entries(PIVOTS_REGULAR)) {
    const [x, y] = map(pivotPart[j], p);
    pivots[j] = j === 'root' ? FOOT : [Math.round(x), Math.round(y)];
  }
  // the pelvis and torso pivots sit on the hip line, which height moves
  const hipY = Math.round(legY(shape.height, 80));
  pivots.pelvis = [pivots.pelvis[0], hipY];
  pivots.torso = [pivots.torso[0], hipY];
  const at = (part: Part, x: number, y: number): Pt => {
    const [fx, fy] = map(part, [x + 0.5, y + 0.5]);
    return [Math.round(fx - 0.5), Math.round(fy - 0.5)];
  };
  return {
    ...shape,
    parts,
    interior: Object.values(parts).reduce((a, m) => a.or(m), new Mask(W, H)),
    hands: { R: poly('lower_arm_R', R.hand_R), L: poly('lower_arm_L', R.hand_L) },
    feet: { R: poly('lower_leg_R', R.foot_R), L: poly('lower_leg_L', R.foot_L) },
    neck: poly('torso', R.neck),
    ear: poly('head', R.ear),
    at,
    poly,
    pivots,
    soles: { lower_leg_R: [[32, 119]], lower_leg_L: [[51, 117]] },
    reach: { upper_leg_R: 39 - HEIGHT_DY[shape.height], upper_leg_L: 37 - HEIGHT_DY[shape.height], upper_arm_R: 33, upper_arm_L: 33 },
  };
}

/** the whole limb a part belongs to (shading is computed on it, so cuts get no edge bands) */
export function limbOf(g: BodyGeometry, part: Part): Mask {
  const pair: Partial<Record<Part, Part>> = { upper_arm_R: 'lower_arm_R', lower_arm_R: 'upper_arm_R', upper_arm_L: 'lower_arm_L', lower_arm_L: 'upper_arm_L', upper_leg_R: 'lower_leg_R', lower_leg_R: 'upper_leg_R', upper_leg_L: 'lower_leg_L', lower_leg_L: 'upper_leg_L' };
  const o = pair[part];
  return o ? g.parts[part].or(g.parts[o]) : g.parts[part];
}

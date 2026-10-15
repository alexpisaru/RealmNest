// HD character factory: the base bodies at the reference's own scale (art/charpipe/reference/
// base_body_ref*.webp: 1 px = 6 px of the 1024×1536 image, a ~200 px figure).
//
// Frame 160×256, feet at (80, 240). The male body's silhouette and proportions are the
// reference's (its interior, inside the outline). The female body is the same reference warped
// row by row (narrower shoulders and waist, wider hips, a softer jaw). The cut into rig parts, the
// hidden overlaps that let parts turn, the shading and all details are ours. Reference
// coordinates map to the frame by (x - 3, y + 8).
//
// Outlines are not part of the parts: they are added after animation, frame by frame, around
// each runtime band (see outline.ts), so turning limbs never fray them and joints show no seams.
import { join } from 'node:path';
import { readPng } from '../img';
import { ART } from '../spec';
import { Mask, type Pt } from './mask';

export type BodyKind = 'm' | 'f';
export const W = 160;
export const H = 256;
export const FOOT: Pt = [80, 240];
const DX = -3;
const DY = 8;
/** reference coordinates → frame */
export const at = (x: number, y: number): Pt => [x + DX, y + DY];

/** back to front; the band says which runtime layer a part composites in */
export const PARTS = ['hair_back', 'upper_arm_L', 'lower_arm_L', 'lower_leg_L', 'upper_leg_L', 'lower_leg_R', 'upper_leg_R', 'torso', 'head', 'upper_arm_R', 'lower_arm_R'] as const;
export type Part = (typeof PARTS)[number];
export const JOINT: Record<Part, string> = {
  hair_back: 'head',
  upper_arm_L: 'upper_arm_L',
  lower_arm_L: 'lower_arm_L',
  lower_leg_L: 'lower_leg_L',
  upper_leg_L: 'upper_leg_L',
  lower_leg_R: 'lower_leg_R',
  upper_leg_R: 'upper_leg_R',
  torso: 'torso',
  head: 'head',
  upper_arm_R: 'upper_arm_R',
  lower_arm_R: 'lower_arm_R',
};
/**
 * Runtime compositing: bands back to front; inside a band every slot (body, shoes, bottom, top,
 * hair) draws in turn. Each band gets its own outline after animation, so a limb is outlined as
 * one piece (no seam at the elbow or knee) and separated from what lies behind it.
 */
export const BANDS: Record<Part, string> = {
  hair_back: 'back',
  upper_arm_L: 'armL',
  lower_arm_L: 'armL',
  lower_leg_L: 'legL',
  upper_leg_L: 'legL',
  lower_leg_R: 'legR',
  upper_leg_R: 'legR',
  torso: 'torso',
  head: 'head',
  upper_arm_R: 'armR',
  lower_arm_R: 'armR',
};
export const BAND_ORDER = ['back', 'armL', 'legL', 'legR', 'torso', 'head', 'armR'];

const R = { elbowY: 128, kneeY: 186, hipY: 152 };
/** the shoulders' frame row */
const SHOULDER_Y = 100 + DY;
/** the reference body's vertical axis, in frame x */
const CXF = 82;
type Keys = [number, number][];
const lerpKeys = (k: Keys, y: number) => {
  for (let i = 1; i < k.length; i++) if (y <= k[i][0]) return k[i - 1][1] + ((y - k[i - 1][0]) / (k[i][0] - k[i - 1][0])) * (k[i][1] - k[i - 1][1]);
  return k[k.length - 1][1];
};
/**
 * The female body: each part reshaped on its own (frame rows → horizontal scale), so limbs stay
 * straight: the torso narrower at the shoulders and waist, wider at the hips; the head a little
 * smaller with a narrower jaw; the legs wider at the hips and finer below; the arms thinner about
 * their own axis and drawn in with the narrower shoulders.
 */
const FEMALE = {
  head: [[0, 0.97], [76 + DY, 0.97], [86 + DY, 0.89], [256, 0.89]] as Keys,
  torso: [[0, 0.92], [80 + DY, 0.92], [92 + DY, 0.86], [112 + DY, 0.87], [126 + DY, 0.8], [138 + DY, 0.98], [148 + DY, 1.14], [160 + DY, 1.14]] as Keys,
  legs: [[0, 1.14], [150 + DY, 1.14], [168 + DY, 1.05], [186 + DY, 0.98], [206 + DY, 0.94], [256, 0.94]] as Keys,
  armWidth: 0.86,
  /** how much the shoulders come in: the arm keeps this fraction of its distance from the axis */
  armIn: 0.93,
  /** px per row the arms angle out below the shoulder (the hands clear the hips, the waist shows) */
  armOut: 0.07,
};
type PartGroup = 'head' | 'torso' | 'legs' | 'armR' | 'armL';
const GROUP: Record<Part, PartGroup> = {
  hair_back: 'head',
  head: 'head',
  torso: 'torso',
  upper_leg_L: 'legs',
  lower_leg_L: 'legs',
  upper_leg_R: 'legs',
  lower_leg_R: 'legs',
  upper_arm_R: 'armR',
  lower_arm_R: 'armR',
  upper_arm_L: 'armL',
  lower_arm_L: 'armL',
};
/** the frame x of a point on the female body (forward); arms need their row axis */
function femaleX(group: PartGroup, x: number, y: number, armAxis?: (y: number) => number, armShift?: number) {
  if (group === 'armR' || group === 'armL') {
    const c = armAxis!(y);
    const out = Math.max(0, y - SHOULDER_Y) * FEMALE.armOut * (group === 'armR' ? -1 : 1);
    return c + (x - c) * FEMALE.armWidth + armShift! + out;
  }
  return CXF + (x - CXF) * lerpKeys(FEMALE[group], y);
}

export function pivots(g: BodyGeometry): Record<string, Pt> {
  const w = (part: Part, x: number, y: number) => g.atIn(part, x, y);
  return {
    root: FOOT,
    pelvis: w('torso', 85, 150),
    torso: w('torso', 85, 150),
    head: w('head', 86, 84),
    upper_arm_R: w('upper_arm_R', 60, 100),
    lower_arm_R: w('lower_arm_R', 56, R.elbowY),
    upper_arm_L: w('upper_arm_L', 108, 102),
    lower_arm_L: w('lower_arm_L', 111, R.elbowY),
    upper_leg_R: w('upper_leg_R', 73, R.hipY),
    lower_leg_R: w('lower_leg_R', 71, R.kneeY),
    upper_leg_L: w('upper_leg_L', 96, R.hipY),
    lower_leg_L: w('lower_leg_L', 96, R.kneeY),
  };
}
/** sole points (outline row of each foot), reach (hip/shoulder → limb end) for the shared walk */
export const soles = (g: BodyGeometry): Record<string, Pt[]> => ({ lower_leg_R: [g.atIn('lower_leg_R', 67, 231)], lower_leg_L: [g.atIn('lower_leg_L', 103, 226)] });
export const REACH: Record<string, number> = { upper_leg_R: 79, upper_leg_L: 74, upper_arm_R: 62, upper_arm_L: 60 };

/** the whole limb a part belongs to: shading is computed on it, so cuts get no edge bands */
export function limbOf(g: BodyGeometry, part: Part): Mask {
  const pair: Partial<Record<Part, Part>> = { upper_arm_R: 'lower_arm_R', lower_arm_R: 'upper_arm_R', upper_arm_L: 'lower_arm_L', lower_arm_L: 'upper_arm_L', upper_leg_R: 'lower_leg_R', lower_leg_R: 'upper_leg_R', upper_leg_L: 'lower_leg_L', lower_leg_L: 'upper_leg_L' };
  const o = pair[part];
  return o ? g.parts[part].or(g.parts[o]) : g.parts[part];
}

export interface BodyGeometry {
  kind: BodyKind;
  parts: Record<Part, Mask>;
  /** the briefs, on the torso */
  briefs: Mask;
  /** the briefs on each thigh's top (shows when the leg turns out from under the torso) */
  briefsLegs: Record<'upper_leg_R' | 'upper_leg_L', Mask>;
  /** the female bust's front point (frame) */
  bust?: Pt;
  /** the whole interior (for garments) */
  interior: Mask;
  /** reference → frame on this body, for a detail on a given part (the torso by default) */
  at(x: number, y: number): Pt;
  atIn(part: Part, x: number, y: number): Pt;
  /** a polygon in reference coordinates on this body, shaped like a given part (the torso by default) */
  poly(pts: Pt[], part?: Part): Mask;
}

export function bodyGeometry(kind: BodyKind = 'm'): BodyGeometry {
  const im = readPng(join(ART, 'reference/base_body_ref_native.png'));
  const atK = (x: number, y: number) => at(x, y);
  const P = (pts: Pt[]) => Mask.poly(W, H, pts.map(([x, y]) => atK(x, y)));
  // the reference's silhouette on this body: every frame pixel looks up its reference pixel
  // (inverse warp, nearest), then the interior inside the 3-px outline
  const S = new Mask(W, H);
  const grey = new Mask(W, H);
  for (let fy = 0; fy < H; fy++)
    for (let fx = 0; fx < W; fx++) {
      const ry = fy - DY;
      const rx = fx - DX;
      if (rx < 0 || ry < 0 || rx >= im.w || ry >= im.h) continue;
      const i = (ry * im.w + rx) * 4;
      if (!im.d[i + 3]) continue;
      S.set(fx, fy);
      const [r, g, b] = [im.d[i], im.d[i + 1], im.d[i + 2]];
      const lum = r + g + b;
      if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && lum > 250 && lum < 420 && ry > 120) grey.set(fx, fy);
    }
  const I = S.erode(3).smooth();

  // the cuts, in reference coordinates
  const armR = P([[30, 88], [62, 88], [64, 100], [68, 106], [70, 112], [70, 118], [69, 122], [67, 128], [66, 134], [65, 140], [65, 146], [66, 150], [64, 156], [62, 160], [62, 175], [30, 175]]);
  const armL = P([[104, 88], [140, 88], [140, 175], [105, 175], [105, 156], [105, 148], [104, 142], [103, 136], [102, 130], [101, 122], [101, 114], [101, 106], [102, 100]]);
  const legR = P([[40, 157], [86, 157], [85, 170], [83, 190], [82, 210], [82, 240], [40, 240]]);
  const legL = P([[86, 157], [140, 157], [140, 240], [82, 240], [82, 210], [83, 190], [85, 170]]);
  const above = (y: number) => P([[-40, -10], [240, -10], [240, y], [-40, y]]);
  const below = (y: number) => P([[-40, y], [240, y], [240, 300], [-40, 300]]);
  // the head ends along the jaw (from behind the ear down to the chin), so the neck shows under it
  const jaw = P([[-40, -10], [240, -10], [240, 86], [98, 86], [86, 86], [80, 84], [74, 81], [69, 79], [60, 80], [-40, 80]]);

  // the ear: the interior's erosion clips its bump, so it comes from the silhouette itself
  const ear = S.erode(1).and(P([[59, 62], [72, 62], [72, 79], [59, 79]]));
  const head = I.or(ear).and(jaw);
  const legs = I.and(below(157)).sub(armR).sub(armL);
  const arms = I.and(below(88)).and(above(176));
  let aR = arms.and(armR).sub(legs);
  let aL = arms.and(armL).sub(legs);
  let torso = I.and(below(74)).sub(head).sub(aR).sub(aL).sub(legs);
  let lR = legs.and(legR);
  let lL = legs.and(legL);

  // hidden overlaps: what lies under a neighbour drawn in front, so turning never opens a hole
  torso = torso.or(aR.and(torso.dilate(3))).or(head.and(P([[72, 70], [99, 70], [99, 88], [72, 88]])));
  aL = aL.or(torso.and(aL.dilate(5)));
  // the thighs' tops under the hips: inside the torso only, so at rest they never stick out past it
  const hips = torso.and(P([[64, 140], [108, 140], [108, 158], [64, 158]]));
  lR = lR.or(hips.and(P([[40, 140], [86, 140], [86, 158], [40, 158]])));
  lL = lL.or(hips.and(P([[86, 140], [140, 140], [140, 158], [86, 158]])));
  const split = (limb: Mask, y: number, over: number, underOnTop: boolean) => {
    // upper part above y, lower below; the part drawn underneath gets `over` px more
    const fy = atK(0, y)[1];
    const up = limb.rows(0, fy - 1);
    const lo = limb.rows(fy, H);
    return underOnTop ? { upper: up.or(limb.rows(fy, fy + over - 1)), lower: lo } : { upper: up, lower: lo.or(limb.rows(fy - over, fy - 1)) };
  };
  // arms: the forearm is drawn over the upper arm; legs: the thigh over the shin
  const armRs = split(aR, R.elbowY, 4, true);
  const armLs = split(aL, R.elbowY, 4, true);
  const legRs = split(lR, R.kneeY, 4, false);
  const legLs = split(lL, R.kneeY, 4, false);

  // the briefs wrap the hips to the body's edges (the reference's stop under the arms)
  let briefsAll = grey.dilate(1).erode(1).and(I);
  for (let k = 1; k <= 10; k++) briefsAll = briefsAll.or(briefsAll.shift(-1, 0).and(I)).or(briefsAll.shift(1, 0).and(I));
  const briefs = briefsAll.and(torso).or(torso.and(grey.dilate(2)).and(I)).smooth();
  const male: Record<Part, Mask> = {
    hair_back: new Mask(W, H),
    upper_arm_L: armLs.upper,
    lower_arm_L: armLs.lower,
    lower_leg_L: legLs.lower,
    upper_leg_L: legLs.upper,
    lower_leg_R: legRs.lower,
    upper_leg_R: legRs.upper,
    torso,
    head,
    upper_arm_R: armRs.upper,
    lower_arm_R: armRs.lower,
  };
  // each arm's axis, row by row (the middle of the whole arm), and how far the shoulders come in
  const axis = (m: Mask) => {
    const c: number[] = [];
    for (let y = 0; y < H; y++) {
      let x0 = -1, x1 = -1;
      for (let x = 0; x < W; x++) if (m.get(x, y)) { if (x0 < 0) x0 = x; x1 = x; }
      c.push(x0 < 0 ? NaN : (x0 + x1 + 1) / 2);
    }
    // rows without the arm take the nearest row's axis
    for (let y = 1; y < H; y++) if (Number.isNaN(c[y])) c[y] = c[y - 1];
    for (let y = H - 2; y >= 0; y--) if (Number.isNaN(c[y])) c[y] = c[y + 1];
    return (y: number) => c[Math.max(0, Math.min(H - 1, Math.round(y)))] ?? CXF;
  };
  const axisR = axis(male.upper_arm_R.or(male.lower_arm_R));
  const axisL = axis(male.upper_arm_L.or(male.lower_arm_L));
  const shiftR = (axisR(SHOULDER_Y) - CXF) * (FEMALE.armIn - 1);
  const shiftL = (axisL(SHOULDER_Y) - CXF) * (FEMALE.armIn - 1);
  const fwd = (part: Part, x: number, y: number) => {
    if (kind === 'm') return x;
    const g = GROUP[part];
    return femaleX(g, x, y, g === 'armR' ? axisR : axisL, g === 'armR' ? shiftR : shiftL);
  };
  /** a mask on the female body: each frame pixel samples the male mask (inverse, nearest) */
  const reshape = (part: Part, m: Mask) => {
    if (kind === 'm') return m;
    const out = new Mask(W, H);
    for (let y = 0; y < H; y++) {
      // forward map of this row's pixel centres, inverted by search (it is monotonic in x)
      const xs: number[] = [];
      for (let x = 0; x < W; x++) xs.push(fwd(part, x + 0.5, y));
      for (let x = 0; x < W; x++) {
        const cx = x + 0.5;
        let best = -1, bd = Infinity;
        for (let sx = 0; sx < W; sx++) {
          const d = Math.abs(xs[sx] - cx);
          if (d < bd) { bd = d; best = sx; }
        }
        const scale = Math.abs((xs[Math.min(W - 1, best + 1)] - xs[Math.max(0, best - 1)]) / 2) || 1;
        if (bd <= scale / 2 + 1e-9 && m.get(best, y)) out.set(x, y);
      }
    }
    return out.smooth().and(out.dilate(1));
  };
  let bust: Pt | undefined;
  const parts = Object.fromEntries(Object.entries(male).map(([p, m]) => [p, reshape(p as Part, m)])) as Record<Part, Mask>;
  if (kind === 'f') {
    // the bust: the chest's front edge (the torso faces right) rounds out 2 px over the far arm
    const t = parts.torso;
    const [, cy] = at(0, 116);
    let edge = 0;
    for (let x = W - 1; x >= 0; x--) if (t.get(x, cy)) { edge = x; break; }
    parts.torso = t.or(Mask.ellipse(W, H, edge - 2, cy + 0.5, 6, 8.5).and(t.shift(6, 0).or(t.shift(6, 3))).sub(P([[0, 0], [240, 0], [240, 106], [0, 106]])));
    bust = [edge + 4, cy];
  }
  const atIn = (part: Part, x: number, y: number): Pt => {
    const [fx, fy] = at(x, y);
    return [Math.round(fwd(part, fx + 0.5, fy) - 0.5), fy];
  };
  return {
    kind,
    parts,
    briefs: reshape('torso', briefs),
    briefsLegs: {
      upper_leg_R: reshape('upper_leg_R', briefsAll).or(above(157)).and(parts.upper_leg_R),
      upper_leg_L: reshape('upper_leg_L', briefsAll).or(above(157)).and(parts.upper_leg_L),
    },
    bust,
    interior: kind === 'm' ? I : Object.values(parts).reduce((a, m) => a.or(m)),
    at: (x, y) => atIn('torso', x, y),
    atIn,
    poly: (pts, part = 'torso') => Mask.poly(W, H, pts.map(([x, y]) => atIn(part, x, y))),
  };
}

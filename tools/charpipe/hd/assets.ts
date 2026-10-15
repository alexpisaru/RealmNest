// HD character factory: the assets (hair, tops, bottoms, shoes) PhotoCraft paints over a base
// body. Every garment is the body's own part masks cut to length and grown 1 px, so it fits the
// rig (and the male or female body) by construction; colours are the spec's ramps (the studio
// recolours by swapping them). Coordinates in RP/lineR are the reference's, mapped through the body.
import type { Painter } from '../pcdraw';
import { type BodyGeometry, type Part } from './body';
import { onBody, shaded, type Piece, type Ramp, type StudioSpec } from './draw';
import type { Mask, Pt } from './mask';

function garment(asset: string, part: Part, m: Mask, c: Ramp, detail?: (pt: Painter, m: Mask) => void, whole?: Mask): Piece {
  return {
    asset,
    part,
    material: 'cloth',
    draw: (pt) => {
      shaded(pt, m, c, { core: 3, whole });
      detail?.(pt, m);
    },
  };
}

export function assetPieces(g: BodyGeometry, s: StudioSpec): Piece[] {
  const P = g.parts;
  const { rowsR, lineR, dotsR } = onBody(g);
  const RP = (pts: Pt[], part: Part = 'torso') => g.poly(pts, part);
  const onHead = onBody(g, 'head');
  const out: Piece[] = [];
  const col = (id: string) => s.assets.find((a) => a.id === id)!.colors;
  const grow = (m: Mask, n = 1) => m.dilate(n);
  // on the female body a top follows the bust: a shadow curving under it
  const underBust = (pt: Painter, c: string) => {
    if (!g.bust) return;
    const [bx, by] = g.bust;
    pt.line([[bx - 9, by + 3], [bx - 6, by + 5], [bx - 2, by + 5], [bx, by + 3]], c);
  };
  const neckline = RP([[70, 76], [102, 76], [99, 89], [88, 93], [77, 90]]);

  // T-shirt: short sleeves, crew neck, hem over the briefs' waistband
  {
    const c = col('top:tee');
    const d = c.deep ?? c.shade;
    out.push(
      garment('top:tee', 'torso', grow(rowsR(P.torso, 86, 141)).sub(neckline).and(grow(P.torso)), c, (pt, m) => {
        pt.mask(m.and(neckline.dilate(1)), c.shade, true);
        pt.mask(rowsR(m, 140, 143), c.shade, true);
        lineR(pt, [[80, 120], [84, 130]], d);
        underBust(pt, c.shade);
      }),
    );
    for (const arm of ['upper_arm_R', 'upper_arm_L'] as const) out.push(garment('top:tee', arm, grow(rowsR(P[arm], 80, 116)), c, (pt, m) => pt.mask(rowsR(m, 114, 118), d, true)));
  }
  // field jacket: long sleeves to the wrist, open V collar, zip, a chest pocket
  {
    const c = col('top:jacket');
    const d = c.deep ?? c.shade;
    const v = RP([[74, 76], [100, 76], [94, 94], [87, 106], [80, 94]]);
    out.push(
      garment('top:jacket', 'torso', grow(rowsR(P.torso, 86, 150)).sub(v).and(grow(P.torso, 2)), c, (pt, m) => {
        pt.mask(m.and(v.dilate(2)), c.hl, true);
        lineR(pt, [[87, 106], [87, 150]], d);
        lineR(pt, [[88, 107], [88, 150]], c.accent ?? c.hl);
        pt.mask(RP([[70, 116], [80, 116], [80, 126], [70, 126]]).and(m), c.shade, true);
        lineR(pt, [[70, 116], [80, 116]], d);
        pt.mask(rowsR(m, 147, 151), d, true);
        underBust(pt, d);
      }),
    );
    for (const side of ['R', 'L'] as const) {
      const up = grow(P[`upper_arm_${side}`]);
      const lo = grow(rowsR(P[`lower_arm_${side}`], 120, 147));
      out.push(garment('top:jacket', `upper_arm_${side}`, up, c, undefined, up.or(lo)));
      out.push(garment('top:jacket', `lower_arm_${side}`, lo, c, (pt, m) => pt.mask(rowsR(m, 143, 148), d, true), up.or(lo)));
    }
  }
  // trousers: from the waist (over the briefs) to the ankle
  for (const [id, cuff] of [['bottom:jeans', false], ['bottom:chinos', true]] as const) {
    const c = col(id);
    const d = c.deep ?? c.shade;
    const hips = grow(rowsR(P.torso, 128, 160)).and(grow(P.torso));
    const legs = { R: { up: grow(P.upper_leg_R), lo: grow(rowsR(P.lower_leg_R, 180, 203)) }, L: { up: grow(P.upper_leg_L), lo: grow(rowsR(P.lower_leg_L, 180, 203)) } };
    const whole = hips.or(legs.R.up).or(legs.R.lo).or(legs.L.up).or(legs.L.lo);
    out.push(
      garment(
        id,
        'torso',
        hips,
        c,
        (pt, m) => {
          // a thin waistband with its buckle, the fly
          pt.mask(rowsR(m, 128, 129), d, true);
          dotsR(pt, [[86, 129], [87, 129]], c.accent ?? c.hl);
          lineR(pt, [[86, 132], [86, 148]], c.shade);
        },
        whole,
      ),
    );
    for (const side of ['R', 'L'] as const) {
      const { up, lo } = legs[side];
      out.push(garment(id, `upper_leg_${side}`, up, c, (pt) => lineR(pt, side === 'R' ? [[66, 165], [67, 184]] : [[100, 165], [101, 184]], c.shade), whole));
      out.push(garment(id, `lower_leg_${side}`, lo, c, (pt, m) => pt.mask(rowsR(m, cuff ? 198 : 201, 204), cuff ? c.hl : c.shade, true), whole));
    }
  }
  // shoes: sneakers (low, white sole, a coloured stripe), boots (to mid-shin, dark sole, laces)
  for (const [id, top] of [['shoes:sneakers', 203], ['shoes:boots', 192]] as const) {
    const c = col(id);
    const d = c.deep ?? c.shade;
    for (const leg of ['lower_leg_R', 'lower_leg_L'] as const)
      out.push(
        garment(id, leg, grow(rowsR(P[leg], top, 240), 2).and(grow(P[leg], 2)), c, (pt, m) => {
          const bb = m.bbox()!;
          pt.mask(m.rows(bb[3] - 2, bb[3]), id === 'shoes:sneakers' ? c.hl : d, true);
          pt.mask(m.rows(bb[3] - 4, bb[3] - 3), id === 'shoes:sneakers' ? (c.accent ?? c.shade) : c.shade, true);
          if (id === 'shoes:boots') {
            const x = leg === 'lower_leg_R' ? 70 : 99;
            // laces: short crossbars, never a lone dot
            for (const y of [197, 201, 205]) lineR(pt, [[x - 1, y], [x + 1, y]], c.accent ?? c.hl);
          }
        }),
      );
  }
  // hair. The crown sits up to 4 px outside the skull (volume); the ear stays free.
  const head = P.head;
  const crown = (pts: Pt[]) => RP(pts, 'head').and(head.dilate(4));
  // two soft cowlicks breaking the crown's outline (low, so they read as hair, not horns)
  const tufts = RP([[80, 32], [84, 26], [89, 31]], 'head').or(RP([[94, 31], [99, 27], [102, 33]], 'head'));
  // short: swept fringe to the right, sideburn before the ear, a short nape behind it
  const shortHair = crown([[54, 74], [52, 58], [54, 44], [60, 34], [70, 26], [84, 22], [98, 24], [108, 29], [116, 38], [120, 48], [117, 56], [113, 51], [110, 58], [106, 51], [102, 57], [98, 50], [94, 56], [90, 50], [86, 55], [82, 50], [78, 54], [75, 50], [73, 58], [73, 68], [70, 70], [69, 61], [66, 60], [61, 62], [60, 70], [58, 77]]).or(tufts);
  // long: the same crown, a side part, hair falling behind the ear to the shoulders
  const longHair = crown([[54, 92], [50, 74], [52, 52], [58, 38], [68, 28], [84, 22], [98, 24], [108, 29], [116, 38], [120, 48], [119, 60], [115, 54], [112, 60], [108, 52], [103, 56], [98, 49], [93, 53], [88, 47], [83, 51], [78, 46], [74, 52], [72, 62], [69, 60], [61, 62], [61, 76], [62, 92]]).or(RP([[50, 74], [62, 74], [63, 94], [58, 98], [50, 96]], 'head'))
    // over the nape, behind the ear, so the neck's back edge never shows a gap
    .or(RP([[60, 74], [66, 78], [74, 81], [74, 92], [64, 96], [60, 94]], 'head'));
  for (const id of ['hair:short', 'hair:long']) {
    const c = col(id);
    const d = c.deep ?? c.shade;
    const hair = id === 'hair:short' ? shortHair : longHair;
    out.push({
      asset: id,
      part: 'head',
      material: 'hair',
      draw: (pt) => {
        shaded(pt, hair, c, { core: 5 });
        // strands toward the fringe tips, a sheen on the crown (light from the upper left)
        onHead.lineR(pt, [[90, 30], [82, 48]], d);
        onHead.lineR(pt, [[100, 31], [94, 48]], d);
        onHead.lineR(pt, [[108, 37], [104, 50]], d);
        onHead.lineR(pt, [[62, 48], [58, 64]], d);
        onHead.lineR(pt, [[64, 40], [72, 33], [82, 29]], c.hl);
        onHead.lineR(pt, [[66, 44], [74, 37]], c.hl);
        if (id === 'hair:long') {
          onHead.lineR(pt, [[56, 70], [56, 90]], d);
          onHead.lineR(pt, [[53, 66], [52, 84]], c.hl);
        }
      },
    });
    if (id === 'hair:long')
      out.push({
        asset: id,
        part: 'hair_back',
        material: 'hair',
        draw: (pt) => {
          // the mane narrows to a soft point between the shoulder blades
          const mane = RP([[54, 50], [66, 40], [71, 60], [70, 84], [67, 104], [63, 122], [58, 136], [53, 142], [48, 136], [44, 122], [43, 100], [45, 80], [48, 64]], 'head');
          shaded(pt, mane, { ...c, hl: c.base, base: c.shade, shade: d }, { core: 4 });
          onHead.lineR(pt, [[56, 74], [53, 120]], d);
          onHead.lineR(pt, [[48, 84], [47, 112]], c.base);
        },
      });
  }
  return out;
}

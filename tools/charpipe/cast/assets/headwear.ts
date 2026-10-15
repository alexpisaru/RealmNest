// Cast assets: headgear, glasses and the profile accessories (headphones, flower).
//
// The head is never reshaped (body.ts: the head group keeps its x), so everything here is drawn in
// absolute frame pixels. Landmarks of the head: skull top row 6, skull x 27..57, near ear x 34..39
// rows 25..33, brows row 23, eyes rows 26..29 (near x 41..45, far x 49..52), mouth row 34. Hair
// volume reaches row ~4 and x ~24..60.
//
// Hats sit DOWN on the head: every hat's lower edge follows one band line (`band`), seen in three-
// quarter view: about row 19 over the far brow, 21 over the near brow, lowest at the near temple,
// a little higher round the back. Under it at most two or three rows of forehead show above the
// brows. Nothing of a hat comes onto the brows or eyes (`clear`), so its outline ring stays off them.
import { Mask, type Pt } from '../../hd/mask';
import { W, H, type Part } from '../body';
import { asset, type AssetDef, type Material, type Slot } from '../catalog';
import { shaded, type Piece } from '../draw';
import { CANON, FIXED } from '../palette';
import type { Pen } from '../pen';

const M = CANON.main;
const S = CANON.second;
const A = CANON.accent;
const MT = CANON.metal;

// ── shapes ───────────────────────────────────────────────────

const ell = (cx: number, cy: number, rx: number, ry: number) => Mask.ellipse(W, H, cx, cy, rx, ry);
const poly = (pts: Pt[]) => Mask.poly(W, H, pts);
/** pixels of `m` for which `f` holds */
const where = (m: Mask, f: (x: number, y: number) => boolean) => m.map((x, y, v) => (v && f(x, y) ? 1 : 0));
/** the bottom edge of a shape, `t` px thick */
const bottomEdge = (m: Mask, t = 1) => m.sub(m.shift(0, -t));
/** the top edge of a shape, `t` px thick */
const topEdge = (m: Mask, t = 1) => m.sub(m.shift(0, t));
/** a 1-px ring just inside a shape's edge */
const rim = (m: Mask) => m.sub(m.erode(1));

const lerpKeys = (k: [number, number][], x: number) => {
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return k[i - 1][1] + ((x - k[i - 1][0]) / (k[i][0] - k[i - 1][0])) * (k[i][1] - k[i - 1][1]);
  return k[k.length - 1][1];
};
/** where a hat's band meets the head, by column (pixel-edge y): round the back, the near temple, the brows */
const band = (x: number) =>
  lerpKeys(
    [
      [24, 21],
      [32, 22],
      [38, 22.5],
      [44, 21.5],
      [52, 20.5],
      [58, 19.5],
      [62, 19],
    ],
    x,
  );
/** the part of `m` above the band line, moved by `dy` (positive = lower) */
const aboveBand = (m: Mask, dy = 0) => where(m, (x, y) => y + 0.5 <= band(x + 0.5) + dy);
/** a strip following the band line, from `top` to `bottom` px relative to it, over columns x0..x1 */
const bandStrip = (x0: number, x1: number, top: number, bottom: number) =>
  where(Mask.rect(W, H, x0, 0, x1 - x0 + 1, H), (x, y) => y + 0.5 > band(x + 0.5) + top && y + 0.5 <= band(x + 0.5) + bottom);
/** keeps a hat off the brows and eyes: over the face nothing below row 21 (its outline lands on 22) */
const clear = (m: Mask) => where(m, (x, y) => !(x >= 39 && x <= 54 && y >= 22) && !(x >= 34 && x <= 38 && y >= 24));

/** the round crown every hat starts from: centred over the skull, its lower edge on the band line */
const crown = (top: number, rx = 17, cx = 42.5, dy = 0) => {
  const cy = 22.5;
  return clear(aboveBand(ell(cx, cy, rx, cy - top), dy));
};

/** a 4-connected pencil line through `pts` (a diagonal step gets a corner pixel, so it survives
 *  the silhouette clean-up that drops pixels hanging on by a corner) */
function stair(pts: Pt[]): Mask {
  const m = new Mask(W, H);
  for (let i = 1; i < pts.length; i++) {
    let [x, y] = pts[i - 1];
    const [x1, y1] = pts[i];
    m.set(x, y);
    while (x !== x1 || y !== y1) {
      const dx = x1 - x;
      const dy = y1 - y;
      if (Math.abs(dx) * Math.abs(y1 - pts[i - 1][1]) >= Math.abs(dy) * Math.abs(x1 - pts[i - 1][0]) && dx) x += Math.sign(dx);
      else y += Math.sign(dy);
      m.set(x, y);
    }
  }
  return m;
}

type Draw = (pen: Pen) => void;
const piece = (asset: string, material: string, draw: Draw, part: Part = 'head'): Piece => ({ asset, part, material, draw });

function item(slot: Slot, id: string, label: string, materials: Material[], pieces: (id: string) => Piece[]): AssetDef {
  return asset({ id, slot, label, materials, pieces: (_g, aid) => pieces(aid) });
}

// ── headgear ─────────────────────────────────────────────────

/** hard hat: a tall smooth shell with a front-to-back ridge, a short brim with a longer peak */
const hardhat = item('headgear', 'headgear:hardhat', 'Hard hat', ['main'], (id) => {
  const shell = crown(4, 16.5, 43, -2);
  const brim = clear(bandStrip(23, 66, -2.5, 0).and(ell(44, 18.5, 22.5, 6)));
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, brim, M, { noCore: true });
      pen.mask(topEdge(brim), M.hl, true);
      pen.mask(bottomEdge(brim), M.deep, true);
      shaded(pen, shell, M, { core: 3 });
      pen.mask(bottomEdge(shell), M.deep, true);
      // the ridge from the peak up over the crown: lit on its left, shadowed on its right
      pen.line([[49, 17], [48, 12], [46, 8], [43, 5]], M.hl);
      pen.line([[50, 17], [49, 12], [47, 8], [44, 5]], M.shade);
    }),
  ];
});

/** straw hat: a low crown with a ribbon, a wide brim of braided straw */
const strawhat = item('headgear', 'headgear:strawhat', 'Straw hat', ['main', 'second'], (id) => {
  const brim = clear(ell(42.5, 17.6, 24, 4.2));
  const top = poly([[30, 17], [29.5, 12], [30.5, 9], [33, 7], [37, 6], [48, 6], [52, 7], [55, 9], [56, 12], [56, 17]]);
  const ribbon = top.rows(13, 15);
  const bow = poly([[28, 14], [31, 14], [30, 19], [27.5, 18]]);
  // the braid: rings round the brim, rows round the crown
  const rings = bottomEdge(ell(42.5, 17.6, 20, 3)).or(bottomEdge(ell(42.5, 17.6, 15.5, 2))).and(brim.erode(1)).sub(top);
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, brim, M, { noCore: true });
      pen.mask(topEdge(brim), M.hl, true);
      pen.mask(rings, M.shade, true);
      pen.mask(bottomEdge(brim), M.deep, true);
      shaded(pen, top, M, { core: 2 });
      pen.mask(where(top.erode(1).rows(0, 12), (x, y) => (x + 2 * y) % 6 === 0), M.shade, true);
    }),
    piece(id, 'second', (pen) => {
      pen.mask(ribbon, S.base);
      pen.mask(topEdge(ribbon), S.hl, true);
      pen.mask(bottomEdge(ribbon), S.shade, true);
      pen.mask(ribbon.cols(52, 60), S.shade, true);
      shaded(pen, bow, S, { noCore: true });
    }),
  ];
});

/** baseball cap: a six-panel crown with a button, the bill toward the face */
const cap = item('headgear', 'headgear:cap', 'Cap', ['main', 'second'], (id) => {
  const shell = crown(5, 16.5, 43);
  // the bill comes toward the viewer (down-right in this view): a short wedge out of the crown's front
  const bill = clear(poly([[46, 16], [51, 14.5], [56, 14.5], [60, 15.5], [62.5, 17.5], [63, 19.5], [61, 21.5], [56, 22], [46, 21.5]]));
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, shell, M, { core: 3 });
      pen.line([[43, 5], [46, 9], [48, 15]], M.shade);
      pen.line([[42, 6], [37, 11], [35, 18]], M.shade);
      pen.mask(bottomEdge(shell), M.deep, true);
      pen.dots([[42, 4], [43, 4]], M.shade);
    }),
    piece(id, 'second', (pen) => {
      shaded(pen, bill, S, { noCore: true });
      pen.mask(topEdge(bill), S.hl, true);
      pen.mask(bottomEdge(bill, 2), S.shade, true);
      pen.mask(bottomEdge(bill), S.deep, true);
    }),
  ];
});

/** hairnet: a bouffant cap of fine mesh, gathered on a ruffled elastic edge */
const hairnet = item('headgear', 'headgear:hairnet', 'Hairnet', ['main'], (id) => {
  const body = crown(4, 18, 42.5, -1);
  const ruffle = clear(where(aboveBand(Mask.rect(W, H, 24, 0, 37, H)).sub(body), (x) => x % 4 < 2).and(body.shift(0, 1)));
  const cap = body.or(ruffle);
  const edge = bandStrip(0, W, -3, 1).and(cap);
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, cap, M, { core: 3 });
      pen.mask(where(body.erode(1).sub(edge), (x, y) => (x + y) % 5 === 0 || (x - y + 500) % 5 === 0), M.shade, true);
      pen.mask(edge, M.base, true);
      pen.mask(topEdge(edge), M.hl, true);
      pen.mask(where(edge, (x) => x % 4 === 2), M.shade, true);
    }),
  ];
});

/** headset: a headband over the crown, a cup on the near ear, the mic boom toward the mouth */
const headset = item('headgear', 'headgear:headset', 'Headset', ['main', 'second'], (id) => {
  const arc = where(ell(47, 27, 12.5, 23.5).sub(ell(47, 27, 10.5, 21.5)).rows(0, 25), (x, y) => x <= 53 || y <= 4);
  const cup = ell(35.5, 29.5, 3.2, 4.4);
  const cushion = ell(37.5, 29.5, 2.2, 4);
  return [
    piece(id, 'second', (pen) => {
      shaded(pen, cushion, S, { noCore: true });
      pen.rect(44, 35, 2, 2, S.base);
      pen.dots([[44, 35]], S.hl);
      pen.dots([[45, 36]], S.shade);
    }),
    piece(id, 'main', (pen) => {
      shaded(pen, arc, M, { noCore: true });
      pen.mask(topEdge(arc), M.hl, true);
      shaded(pen, cup, M, { core: 1 });
      pen.mask(ell(35.5, 29.5, 1.4, 2.4), M.shade, true);
      pen.mask(stair([[38, 32], [41, 34], [43, 35]]), M.shade);
    }),
  ];
});

/** beanie: a knitted crown pulled down to the brows, a ribbed turned-up cuff, a knot on top */
const beanie = item('headgear', 'headgear:beanie', 'Beanie', ['main'], (id) => {
  const dome = crown(5, 18.5, 42.5, 0.5);
  const cuff = clear(bandStrip(24, 61, -5, 0.5).and(ell(42.5, 18, 18.5, 8)));
  const knot = ell(43, 4.6, 2, 1.5);
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, dome, M, { core: 3 });
      pen.mask(where(dome.erode(2), (x, y) => x % 3 === 0 && y % 2 === 0), M.shade, true);
      shaded(pen, cuff, M, { noCore: true });
      pen.mask(where(cuff.erode(1), (x) => x % 2 === 0), M.shade, true);
      pen.mask(topEdge(cuff), M.hl, true);
      shaded(pen, knot, M, { noCore: true });
    }),
  ];
});

/** goggles: an elastic strap round the head, two lenses pushed up just above the brows */
const goggles = item('headgear', 'headgear:goggles', 'Goggles', ['main', 'second'], (id) => {
  const strap = clear(bandStrip(24, 58, -4, -1));
  const lensN = ell(46, 18.8, 3.6, 2.5);
  const lensF = ell(54, 18.8, 2.5, 2.5);
  const frames = clear(lensN.dilate(1).or(lensF.dilate(1)));
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, strap, M, { noCore: true });
      pen.mask(topEdge(strap), M.hl, true);
      pen.mask(frames, M.base);
      pen.mask(frames.sub(frames.shift(-1, -1)), M.shade, true);
      pen.mask(frames.sub(frames.shift(1, 1)), M.hl, true);
    }),
    piece(id, 'second', (pen) => {
      for (const l of [lensN, lensF]) shaded(pen, l, S, { noCore: true });
      pen.line([[44, 17], [45, 17]], S.hl);
      pen.dots([[44, 18], [53, 17]], S.hl);
      pen.dots([[44, 17]], FIXED.white);
    }),
  ];
});

/** bandana: a kerchief over the crown, knotted at the back with two tails */
const bandana = item('headgear', 'headgear:bandana', 'Bandana', ['main', 'second'], (id) => {
  const cloth = crown(6, 17.5);
  const knot = ell(24, 19.5, 2.5, 2.2);
  const tails = poly([[23, 20], [26, 20], [26.5, 27], [24, 29], [22.5, 24]]).or(poly([[22, 20], [24, 21], [21, 27.5], [19, 26]]));
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, tails, M, { noCore: true });
      pen.line([[24, 22], [24, 27]], M.shade);
      shaded(pen, cloth, M, { core: 3 });
      pen.mask(bottomEdge(cloth, 2), M.shade, true);
      pen.mask(bottomEdge(cloth), M.deep, true);
      shaded(pen, knot, M, { noCore: true });
      pen.dots([[23, 18]], M.hl);
    }),
    piece(id, 'second', (pen) => {
      pen.mask(where(cloth.erode(1).sub(bottomEdge(cloth, 2)), (x, y) => (x % 4 === 0 && y % 4 === 0) || (x % 4 === 2 && y % 4 === 2)), S.base);
    }),
  ];
});

/** beret: a soft round crown slouched toward the back, its underside in shadow, a stalk on top */
const beret = item('headgear', 'headgear:beret', 'Beret', ['main'], (id) => {
  const puff = poly([[21, 15], [22, 10.5], [27, 7], [35, 5], [46, 5], [54, 6.5], [59, 9.5], [60.5, 13], [59, 16.5], [56, 19]]);
  const all = clear(puff.or(aboveBand(Mask.rect(W, H, 25, 12, 34, 12)))).smooth();
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, all, M, { core: 3 });
      // the overhang's underside, deepest at the back where it droops
      pen.mask(bottomEdge(all, 2), M.shade, true);
      pen.mask(bottomEdge(all).cols(0, 50), M.deep, true);
      pen.dots([[43, 3], [43, 4]], M.shade);
    }),
  ];
});

/** sun visor: a band round the head (the top open), a broad bill toward the face */
const visor = item('headgear', 'headgear:visor', 'Visor', ['main', 'second'], (id) => {
  const strip = clear(bandStrip(24, 58, -3.5, 0));
  const bill = clear(poly([[48, 16], [53, 14.5], [57, 14.5], [61, 15.5], [63, 17.5], [63.5, 19.5], [61.5, 21.5], [56, 22], [48, 21.5]]));
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, strip, M, { noCore: true });
      pen.mask(topEdge(strip), M.hl, true);
    }),
    piece(id, 'second', (pen) => {
      shaded(pen, bill, S, { noCore: true });
      pen.mask(topEdge(bill), S.hl, true);
      pen.mask(bottomEdge(bill, 2), S.shade, true);
      pen.mask(bottomEdge(bill), S.deep, true);
    }),
  ];
});

/** sou'wester: a rounded rain hat whose brim runs long down the back of the neck, over the ear's top */
const raincap = item('headgear', 'headgear:raincap', 'Rain hat', ['main'], (id) => {
  const top = crown(6, 14.5, 43, -2);
  const flap = poly([[22, 19], [25, 15], [32, 14], [38, 18], [39.5, 22], [38.5, 26], [35, 29.5], [29, 30], [24, 28.5], [21.5, 24]]);
  const ring = bandStrip(22, 64, -3.5, 0).and(ell(43, 19, 22, 6));
  const brim = clear(ring).or(flap.and(Mask.rect(W, H, 0, 0, 39, H)));
  const inner = brim.erode(2);
  return [
    piece(id, 'main', (pen) => {
      shaded(pen, brim, M, { noCore: true });
      // the back flap turns away from the light; a stitched seam runs round the brim
      pen.mask(where(brim, (x, y) => y > 25 - (x - 22) * 0.2), M.shade, true);
      pen.mask(where(rim(inner), (x, y) => (x + y) % 3 !== 0).sub(top.dilate(1)), M.shade, true);
      pen.mask(bottomEdge(brim), M.deep, true);
      shaded(pen, top, M, { core: 2 });
      pen.line([[43, 6], [45, 11], [46, 15]], M.shade);
      pen.mask(bottomEdge(top), M.deep, true);
    }),
  ];
});

// ── glasses ──────────────────────────────────────────────────
// Glasses get no outline (catalog.ts NO_OUTLINE): the thin frame is its own line, so these are
// Maya's rims exactly (rows 25..30 round the eyes, the far one narrower, the temple back to the ear).

function glasses(id: string, label: string, round: boolean): AssetDef {
  return item('glasses', id, label, ['main'], (aid) => [
    piece(aid, 'main', (pen) => {
      const lens = (x0: number, x1: number) => {
        const cut = round ? 1 : 0;
        pen.line([[x0 + cut, 25], [x1 - cut, 25]], M.base);
        pen.line([[x0 + cut, 30], [x1 - cut, 30]], M.shade);
        pen.line([[x0, 25 + cut], [x0, 30 - cut]], M.base);
        pen.line([[x1, 25 + cut], [x1, 30 - cut]], M.shade);
      };
      lens(40, 46);
      lens(48, 52);
      pen.dots([[47, 27], [38, 27], [39, 27]], M.base);
      pen.dots([[round ? 41 : 40, 25]], M.hl);
    }),
  ]);
}

// ── accessories ──────────────────────────────────────────────

/** over-ear headphones: a padded band over the head, big cups on metal sliders */
const headphones = item('accessory', 'accessory:headphones', 'Headphones', ['main', 'metal'], (id) => {
  const arc = where(ell(47, 27, 13.5, 24.5).sub(ell(47, 27, 10.5, 21.5)).rows(0, 20), (x, y) => x <= 53 || y <= 3);
  const cup = ell(35.5, 29.5, 4, 5.3);
  return [
    piece(id, 'metal', (pen) => {
      pen.rect(34, 19, 2, 6, MT.base);
      pen.line([[34, 19], [34, 24]], MT.hl);
    }),
    piece(id, 'main', (pen) => {
      shaded(pen, arc, M, { noCore: true });
      pen.mask(topEdge(arc), M.hl, true);
      shaded(pen, cup, M, { core: 1 });
      pen.mask(ell(36, 29.5, 2, 3.4), M.shade, true);
      pen.dots([[34, 26]], M.hl);
    }),
  ];
});

/** a five-petalled flower tucked behind the near ear */
const flower = item('accessory', 'accessory:flower', 'Flower', ['accent', 'main'], (id) => {
  const [cx, cy] = [32.5, 22.5];
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return ell(cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, 1.9, 1.9);
  });
  return [
    piece(id, 'accent', (pen) => {
      for (const p of petals) {
        pen.mask(p, A.base);
        pen.mask(p.sub(p.shift(-1, -1)), A.shade, true);
      }
      pen.dots([[31, 19], [30, 21]], A.hl);
    }),
    piece(id, 'main', (pen) => {
      pen.rect(32, 22, 2, 2, M.base);
      pen.dots([[32, 22]], M.hl);
      pen.dots([[33, 23]], M.shade);
    }),
  ];
});

export const HEADWEAR: AssetDef[] = [
  hardhat,
  strawhat,
  cap,
  hairnet,
  headset,
  beanie,
  goggles,
  bandana,
  beret,
  visor,
  raincap,
  glasses('glasses:round', 'Round glasses', true),
  glasses('glasses:square', 'Square glasses', false),
  headphones,
  flower,
];

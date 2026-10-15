import { sceneTileRange, type MaterialId } from '../../domain/world';
import { PROP_META } from '../props';
import type { WorldBuilder } from './builder';

// ─────────────────────────────────────────────────────────────
// Countryside filler: carries the hand-authored surroundings out
// to the edge of the painted frame. Roads are extended, the land
// between them is cut into parcels (fields, meadows, woods,
// orchards, fenced pastures with animals, kitchen plots, the odd
// farmstead or pond) and the rest is meadow scatter whose density
// drifts, so there are lush patches and quiet ones.
//
// Variety is authored, not recoloured: each wood has its own mix of
// species, each orchard its own fruit, flowers grow in drifts of one
// kind, verges get worn edges, stones and tufts (flat decals baked
// into the ground). Calmer near the homestead so it stays the focus.
// Deterministic: same world → same countryside.
// ─────────────────────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; d: number };
type Opt = { w?: number; d?: number; rot?: 0 | 1; variant?: string; color?: string };

export interface CountrysideOpts {
  /** hand-authored zone(s): left untouched; the first one is the reference for "near" */
  keep: Rect | Rect[];
  /** hand-authored ring: no parcels here, but meadow scatter and verges fill what is left free */
  authored?: Rect[];
  /** roads, painted and kept clear; make them long; anything off-frame is ignored */
  roads: (Rect & { mat: MaterialId; poplars?: boolean })[];
  seed?: number;
  /** pixel scale of the world (2 for 64×32 tiles, 4 for 128×64) */
  k?: number;
  /** parcel grid size (tiles) */
  cell?: number;
  /** parcel mix near the hand-authored zone / further out: [kind, weight] */
  near?: [ParcelKind, number][];
  far?: [ParcelKind, number][];
  /** peak tree density in woods (0..1) */
  woods?: number;
  /** meadow scatter density multiplier */
  scatter?: number;
  /** orchards in rows (default) or dense: trees on every other tile, a few blossoming cherries among them */
  orchard?: 'rows' | 'dense';
  /** where copses start in the land-use noise (0..1, default 0.74; lower = more copses) */
  copse?: number;
  /** white daisy drifts on the free grass (0 = none) */
  daisies?: number;
  /** lone trees in the meadow scatter (multiplier, default 1) */
  meadowTrees?: number;
}

export type ParcelKind = 'field' | 'meadow' | 'woods' | 'orchard' | 'pasture' | 'farmstead' | 'pond' | 'plot' | 'flowers';

// ── the palette of the land ─────────────────────────────────
type W<T> = [T, number][];
/** wood types: a mixed wood, an oak wood, a pine stand, a birch grove */
const WOODS: W<string>[] = [
  [['oak', 6], ['birch', 2], ['pine', 1.3], ['poplar', 0.5], ['sapling', 0.5]],
  [['oak', 8], ['birch', 1], ['cherry', 0.3], ['sapling', 0.6]],
  [['pine', 7], ['birch', 1.4], ['oak', 0.8], ['sapling', 0.4]],
  [['birch', 6], ['oak', 1.6], ['poplar', 0.4], ['sapling', 0.8]],
];
const FRUIT = ['apple', 'pear', 'plum', 'apple', 'cherry', 'orange', 'pear'];
const BUSH_WILD: W<string> = [['round', 4], ['berry', 2.2], ['fern', 1.6]];
const BUSH_GARDEN = ['hydrangea', 'rose', 'lavender', 'boxwood', 'rose'];
const WILDFLOWERS = ['daisy', 'poppy', 'cosmos', 'wild', 'forgetmenot', 'foxglove', 'marigold', 'tulip', 'hollyhock', 'lavenderSmall'];
const MEADOWFLOWERS = ['daisy', 'poppy', 'wild', 'forgetmenot', 'cosmos', 'daisy'];
const GRASSES = ['tuft', 'seedheads', 'sedge', 'clump'];
const FIELD_CROPS: W<string> = [['wheat', 6], ['wheatGreen', 2.4], ['corn', 2.4], ['cabbage', 1.1], ['pumpkin', 1.1], ['carrot', 0.8], ['beans', 0.8], ['lettuce', 0.5]];
const VEG = ['cabbage', 'tomato', 'carrot', 'pumpkin', 'lettuce', 'beans', 'herbs', 'corn'];
const HEDGES = ['white', 'pink', 'mixed', undefined];
const LONE: W<string> = [['oak', 5], ['birch', 1.2], ['cherry', 0.8], ['willow', 0.5], ['poplar', 0.6]];
const VERGE = ['edge.tufts', 'edge.stones', 'edge.crumbs', 'edge.tufts', 'edge.flowers', 'edge.stones'];
const FLOOR = ['clutter.leaves', 'clutter.twigs', 'clutter.leaves', 'clutter.mushrooms', 'edge.moss'];
const MEADOW_FLAT = ['trans.clover', 'clutter.flowers', 'trans.patchy', 'clutter.pebbles', 'trans.clover', 'clutter.weeds'];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

/** Largest piece of `r` left after cutting out `cut` (axis-aligned). */
function clip(r: Rect, cut: Rect): Rect {
  if (!overlaps(r, cut)) return r;
  const pieces: Rect[] = [
    { x: r.x, y: r.y, w: cut.x - r.x, d: r.d },
    { x: cut.x + cut.w, y: r.y, w: r.x + r.w - (cut.x + cut.w), d: r.d },
    { x: r.x, y: r.y, w: r.w, d: cut.y - r.y },
    { x: r.x, y: cut.y + cut.d, w: r.w, d: r.y + r.d - (cut.y + cut.d) },
  ].filter((p) => p.w > 0 && p.d > 0);
  pieces.sort((a, b) => b.w * b.d - a.w * a.d);
  return pieces[0] ?? { x: r.x, y: r.y, w: 0, d: 0 };
}

export function countryside(b: WorldBuilder, cols: number, rows: number, o: CountrysideOpts) {
  const R = sceneTileRange(cols, rows, true, o.k ?? 1);
  const keeps = Array.isArray(o.keep) ? o.keep : [o.keep];
  const keep0 = keeps[0];
  const seed = o.seed ?? 7;
  const rnd = (...n: number[]) => {
    let h = seed * 374761393;
    for (const v of n) h = Math.imul(h ^ (v * 668265263 + 0x9e3779b9), 2246822519) ^ (h >>> 13);
    h = Math.imul(h ^ (h >>> 16), 3266489917);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  /** smooth value noise over tiles (lush vs quiet patches, flower drifts) */
  const noise = (x: number, y: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = rnd(xi, yi, s);
    const bb = rnd(xi + 1, yi, s);
    const c = rnd(xi, yi + 1, s);
    const d = rnd(xi + 1, yi + 1, s);
    return a + (bb - a) * u + (c - a) * v + (a - bb - c + d) * u * v;
  };
  const pickW = <T>(t: number, list: W<T>): T => {
    const sum = list.reduce((a, [, w]) => a + w, 0);
    let acc = 0;
    for (const [k, w] of list) if (t < (acc += w / sum)) return k;
    return list[list.length - 1][0];
  };
  const pick = <T>(t: number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(t * list.length))];
  const inFrame = (x: number, y: number) => {
    const u = x - y;
    const v = x + y;
    return u >= R.u0 && u <= R.u1 && v >= R.v0 && v <= R.v1;
  };
  // tile bounding box of the frame diamond
  const X0 = Math.floor((R.u0 + R.v0) / 2) - 1;
  const X1 = Math.ceil((R.u1 + R.v1) / 2) + 1;
  const Y0 = Math.floor((R.v0 - R.u1) / 2) - 1;
  const Y1 = Math.ceil((R.v1 - R.u0) / 2) + 1;

  const occ = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const inKeep = (x: number, y: number) => keeps.some((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.d);
  const onRoad = (x: number, y: number) => o.roads.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d);
  const blocked = (x: number, y: number) => {
    if (inKeep(x, y) || onRoad(x, y)) return true;
    if (occ.has(key(x, y)) || !b.isFree(x, y)) return true;
    // never on authored paths, plots, water or paving
    const g = b.groundAt(x, y);
    return g !== null && g !== 'grass' && g !== 'meadow' && g !== 'forest';
  };
  const put = (type: string, x: number, y: number, opt: Opt = {}) => {
    const meta = PROP_META[type];
    const w = opt.w ?? meta.w;
    const d = opt.d ?? meta.d;
    const [fw, fd] = opt.rot === 1 ? [d, w] : [w, d];
    for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) if (blocked(x + i, y + j)) return false;
    // skip props whose whole footprint is off-frame
    if (!inFrame(x, y) && !inFrame(x + fw - 1, y + fd - 1) && !inFrame(x + fw - 1, y) && !inFrame(x, y + fd - 1)) return false;
    for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) occ.add(key(x + i, y + j));
    b.scenic(type, x, y, opt);
    return true;
  };
  /** A flat ground decal: may sit under trees and props, never on water, roads stay clean unless asked. */
  const flat = (variant: string, x: number, y: number, rot: 0 | 1 = 0, road = false) => {
    if (!inFrame(x, y) || inKeep(x, y) || (!road && onRoad(x, y))) return;
    if (b.groundAt(x, y) === 'water') return;
    b.scenic('decal', x, y, { variant, rot });
  };
  /** A drift: several plants of one kind clustered around a point. */
  const drift = (type: string, variant: string | undefined, cx: number, cy: number, n: number, spread: number, s: number) => {
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const a = rnd(cx, cy, s, i) * Math.PI * 2;
      const r = Math.sqrt(rnd(cy, cx, s, i + 50)) * spread;
      if (put(type, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), variant ? { variant } : {})) placed++;
    }
  };

  // ── roads ───────────────────────────────────────────────────
  for (const r of o.roads) b.ground(r.mat, r.x, r.y, r.w, r.d);

  // ── parcels ─────────────────────────────────────────────────
  const C = o.cell ?? 13;
  const ponds: Rect[] = [];
  const meadows: Rect[] = [];
  const pastures: Rect[] = [];
  const steads: Rect[] = [];
  let farmsteads = 0;
  let pastureCount = 0;
  const kcx = keep0.x + keep0.w / 2;
  const kcy = keep0.y + keep0.d / 2;

  /** Close a finished parcel to the meadow scatter (no stray copses in orchards, paddocks or gardens). */
  const seal = (r: Rect) => {
    for (let j = r.y; j < r.y + r.d; j++) for (let i = r.x; i < r.x + r.w; i++) occ.add(key(i, j));
  };
  /** A ring of rail fence round a parcel, with a gate in the front side. */
  const fenceRing = (r: Rect, variant: string, t: (n: number, m?: number) => number) => {
    const gate = r.x + 1 + Math.floor(t(60) * Math.max(1, r.w - 3));
    for (let i = 0; i < r.w; ) {
      const len = Math.min(3, r.w - i);
      const front = r.y + r.d - 1;
      if (gate >= r.x + i && gate < r.x + i + len) {
        // split the run around the gate
        for (let q = i; q < i + len; q++) {
          if (r.x + q === gate) put('gate', r.x + q, front);
          else put('fenceRow', r.x + q, front, { w: 1, variant });
        }
      } else put('fenceRow', r.x + i, front, { w: len, variant: t(61, i) < 0.12 ? 'broken' : variant });
      put('fenceRow', r.x + i, r.y, { w: len, variant });
      i += len;
    }
    for (let j = 1; j < r.d - 1; ) {
      const len = Math.min(3, r.d - 1 - j);
      put('fenceRow', r.x, r.y + j, { rot: 1, w: len, variant });
      put('fenceRow', r.x + r.w - 1, r.y + j, { rot: 1, w: len, variant: t(62, j) < 0.1 ? 'broken' : variant });
      j += len;
    }
  };

  const parcel = (r: Rect, id: number) => {
    const t = (n: number, m = 0) => rnd(id, n, m);
    const inner: Rect = { x: r.x + 1, y: r.y + 1, w: r.w - 2, d: r.d - 2 };
    const rx = (n: number) => inner.x + Math.floor(t(n) * inner.w);
    const ry = (n: number) => inner.y + Math.floor(t(n) * inner.d);
    // distance from the hand-authored zone, in tiles
    const dist = Math.max(Math.abs(r.x + r.w / 2 - kcx) - keep0.w / 2, Math.abs(r.y + r.d / 2 - kcy) - keep0.d / 2);
    const gate = (k: ParcelKind, w: number): [ParcelKind, number] => [
      k,
      k === 'farmstead'
        ? farmsteads < 2 && r.w >= 9 && r.d >= 8
          ? w
          : 0
        : k === 'pond'
          ? ponds.length < 2 && r.w >= 7 && r.d >= 7
            ? w
            : 0
          : k === 'pasture'
            ? pastureCount < 3 && r.w >= 6 && r.d >= 6
              ? w
              : 0
            : w,
    ];
    const near: [ParcelKind, number][] = o.near ?? [['field', 55], ['meadow', 33], ['orchard', 12]];
    const far: [ParcelKind, number][] = o.far ?? [['field', 44], ['meadow', 18], ['woods', 18], ['orchard', 9], ['pasture', 6], ['farmstead', 3], ['pond', 2]];
    const kind = pickW(t(1), (dist < 10 ? near : far).map(([k, w]) => gate(k, w)));

    // borders: a hedge or a stone wall on some front edges
    if (kind !== 'woods' && kind !== 'pasture' && t(2) < 0.52) {
      if (t(3) < 0.3) {
        const wv = pick(t(4), ['dry', 'mossy', 'dry', 'ruin']);
        for (let i = 0; i + 3 <= r.w; i += 3) if (t(5, i) > 0.12) put('stoneWall', r.x + i, r.y + r.d - 1, { w: 3, variant: wv });
      } else {
        const hv = pick(t(4), HEDGES);
        for (let i = 0; i + 3 <= r.w; i += 3) if (t(5, i) > 0.15) put('hedgeRow', r.x + i, r.y + r.d - 1, { w: 3, variant: hv });
        if (t(6, 1) < 0.35) for (let j = 0; j + 3 <= r.d - 1; j += 3) if (t(7, j) > 0.2) put('hedgeRow', r.x + r.w - 1, r.y + j, { rot: 1, w: 3, variant: hv });
      }
    }

    if (kind === 'field' && inner.w >= 3 && inner.d >= 3) {
      // tilled soil only under crops that were actually placed
      const sow = (x: number, y: number, w: number, d: number, variant: string) => {
        if (put('crops', x, y, { w, d, variant })) b.ground('soil', x, y, w, d);
      };
      if (t(9) < 0.3) for (let j = 0; j + 3 <= r.d - 1; j += 3) put('fenceRow', r.x + r.w - 1, r.y + j, { rot: 1, w: 3, variant: 'rail' });
      const v1 = pickW(t(6), FIELD_CROPS);
      if (inner.d >= 6 && t(7) > 0.5) {
        // two strips with a grassy headland between them
        const h1 = Math.floor(inner.d / 2) - 1;
        sow(inner.x, inner.y, inner.w, h1, v1);
        sow(inner.x, inner.y + h1 + 1, inner.w, inner.d - h1 - 1, pickW(t(8), FIELD_CROPS));
        for (let i = 0; i < inner.w; i++) if (t(10, i) < 0.4) flat(pick(t(11, i), ['trans.dry', 'trans.patchy', 'clutter.flowers']), inner.x + i, inner.y + h1);
      } else sow(inner.x, inner.y, inner.w, inner.d, v1);
      // on the headland ring, never inside the crop
      if (t(12) > 0.62) put('scarecrow', r.x + 1 + Math.floor(t(13) * (r.w - 2)), r.y);
      if (t(14) > 0.6) put('haystack', r.x, r.y + r.d - 2);
      if (t(15) > 0.75) put('hay', r.x + r.w - 2, r.y);
      for (let i = 0; i < r.w; i++) if (t(16, i) < 0.3) flat(pick(t(17, i), ['trans.dry', 'trans.patchy', 'clutter.weeds']), r.x + i, r.y);
    } else if (kind === 'orchard') {
      const v = pick(t(13), FRUIT);
      const dense = o.orchard === 'dense';
      for (let j = inner.y; j < inner.y + inner.d; j += dense ? 1 : 2)
        for (let i = inner.x + (dense ? (j - inner.y) % 2 : (j - inner.y) % 4 ? 1 : 0); i < inner.x + inner.w; i += 2) {
          const u = rnd(i, j, 39);
          if (u < 0.07) continue; // a gap where a tree was lost
          if (u < 0.13) put('tree', i, j, { variant: 'sapling' });
          else if (dense && u > 0.86) put('tree', i, j, { variant: 'cherry' }); // blossom among the fruit
          else put('fruitTree', i, j, { variant: u > 0.95 ? pick(rnd(i, j, 40), FRUIT) : v });
        }
      for (let j = r.y; j < r.y + r.d; j++)
        for (let i = r.x; i < r.x + r.w; i++) {
          const u = rnd(i, j, 37);
          if (u < 0.1) put('tallGrass', i, j, { variant: pick(rnd(i, j, 41), GRASSES) });
          else if (u < 0.16) put('flowerPatch', i, j, { variant: pick(rnd(i, j, 42), ['daisy', 'forgetmenot', 'daisy', 'wild']) });
          else if (u < 0.34) flat(pick(rnd(i, j, 43), ['trans.clover', 'clutter.leaves', 'clutter.flowers', 'trans.patchy']), i, j);
        }
      // harvest time: a ladder, baskets and the cart
      if (t(15) > 0.6) {
        const hx = rx(16);
        put('appleCart', hx, r.y + r.d - 1, {});
        put('basket', hx + 2, r.y + r.d - 1);
        put('ladder', hx - 1, r.y + r.d - 1);
      }
      if (t(17) > 0.6) for (let i = 0; i < 3; i++) put('beehive', r.x + 1 + i * 2, r.y);
      meadows.push(r);
      seal(r);
    } else if (kind === 'woods') {
      // a copse: dense in the middle, thinning to the edges, saplings and shrubs at the margin
      const mix = WOODS[Math.floor(t(40) * WOODS.length)];
      const mx = r.x + r.w / 2;
      const my = r.y + r.d / 2;
      for (let j = r.y; j < r.y + r.d; j++)
        for (let i = r.x; i < r.x + r.w; i++) {
          const e = Math.max(Math.abs(i + 0.5 - mx) / (r.w / 2), Math.abs(j + 0.5 - my) / (r.d / 2));
          const dens = (o.woods ?? 0.42) * (1 - e * e * 0.7);
          const u = rnd(i, j, 30);
          if (u < dens) put('tree', i, j, { variant: e > 0.72 && rnd(i, j, 33) < 0.3 ? 'sapling' : pickW(rnd(i, j, 32), mix) });
          else if (u < dens + 0.07) put('bush', i, j, { variant: pickW(rnd(i, j, 34), BUSH_WILD) });
          else if (u < dens + 0.13) put('fern', i, j);
          else if (u < dens + 0.16) put('tallGrass', i, j, { variant: rnd(i, j, 35) < 0.5 ? 'sedge' : 'clump' });
          // the woodland floor: leaves, twigs, moss and mushrooms (flat, under the trees too)
          if (e < 0.9 && rnd(i, j, 36) < 0.22) flat(pick(rnd(i, j, 38), FLOOR), i, j);
        }
      if (t(41) > 0.4) put('rock', rx(42), ry(43), { variant: 'mossy' });
      if (t(44) > 0.7) put('rock', rx(45), ry(46), { variant: 'cluster' });
      // shaded woodland floor under the copse (soft edges come from the ground warp)
      if (r.w >= 3 && r.d >= 3) b.ground('forest', r.x + 1, r.y + 1, r.w - 2, r.d - 2);
      meadows.push(r);
    } else if (kind === 'pasture') {
      pastureCount++;
      // a fenced paddock: sheep (and a cow or two) grazing, a trough, hay, a shade tree
      fenceRing(r, 'rail', t);
      const paddock: Rect = { x: r.x + 1, y: r.y + 1, w: r.w - 2, d: r.d - 2 };
      put('trough', paddock.x + Math.floor(t(19) * (paddock.w - 2)), paddock.y, { w: 2 });
      put('haystack', paddock.x + paddock.w - 1, paddock.y);
      if (t(20) > 0.4) put('tree', paddock.x, paddock.y + paddock.d - 1, { variant: 'oak' });
      for (let j = paddock.y; j < paddock.y + paddock.d; j++)
        for (let i = paddock.x; i < paddock.x + paddock.w; i++) {
          const u = rnd(i, j, 47);
          if (u < 0.12) flat(pick(rnd(i, j, 48), ['trans.worn', 'trans.clover', 'trans.patchy', 'trans.dry']), i, j);
          else if (u < 0.16) put('tallGrass', i, j, { variant: pick(rnd(i, j, 49), GRASSES) });
        }
      pastures.push(paddock);
      seal(r);
    } else if (kind === 'farmstead') {
      farmsteads++;
      const fx = r.x + 1 + Math.floor(t(21) * (r.w - 8));
      const fy = r.y + 1 + Math.floor(t(22) * (r.d - 7));
      put('barn', fx, fy);
      if (t(23) > 0.4) put('shed', fx + 4, fy + 1);
      put('haystack', fx, fy + 4);
      put('hay', fx + 1, fy + 4);
      put('wheelbarrow', fx + 3, fy + 4);
      put('chopBlock', fx + 5, fy + 3);
      put('firewood', fx + 6, fy + 3);
      if (t(24) > 0.5) put('laundry', fx + 1, fy + 6, { w: 2 });
      put('fruitTree', fx + 5, fy + 5, { variant: pick(t(25), FRUIT) });
      put('tree', fx - 1, fy, { variant: 'oak' });
      for (let i = -1; i < 7; i++) for (let j = 3; j < 6; j++) if (rnd(fx + i, fy + j, 26) < 0.3) flat(pick(rnd(fx + i, fy + j, 27), ['trans.worn', 'trans.dry', 'trans.mud']), fx + i, fy + j);
      steads.push({ x: fx, y: fy + 3, w: 6, d: 3 });
      meadows.push(r);
      seal(r);
    } else if (kind === 'pond') {
      const p: Rect = { x: inner.x + 1, y: inner.y + 1, w: inner.w - 2, d: inner.d - 2 };
      let clear = true;
      for (let j = -1; j <= p.d; j++) for (let i = -1; i <= p.w; i++) if (blocked(p.x + i, p.y + j)) clear = false;
      if (!clear) return;
      b.ground('water', p.x, p.y, p.w, p.d);
      for (let j = 0; j < p.d; j++) for (let i = 0; i < p.w; i++) occ.add(key(p.x + i, p.y + j));
      ponds.push(p);
      put('bench', p.x + 1, p.y + p.d, { w: 2 });
      put('tree', p.x - 1, p.y + Math.floor(p.d / 2), { variant: 'willow' });
      for (let n = 0; n < 8; n++) {
        const side = n % 4;
        const x = side === 0 ? p.x - 1 : side === 1 ? p.x + p.w : p.x + Math.floor(t(24, n) * p.w);
        const y = side === 2 ? p.y - 1 : side === 3 ? p.y + p.d : p.y + Math.floor(t(25, n) * p.d);
        if (n < 5) put('reeds', x, y, { variant: pick(t(26, n), ['cattail', 'reedgrass', 'iris', 'rush']) });
        else put('rock', x, y, { variant: pick(t(27, n), ['boulder', 'mossy', 'flat']) });
      }
      for (let n = 0; n < 3; n++) b.scenic('lilies', p.x + Math.floor(t(28, n) * p.w), p.y + Math.floor(t(29, n) * p.d));
    } else if (kind === 'plot' && inner.w >= 3 && inner.d >= 3) {
      // small fenced kitchen garden: picket fence, rows of mixed vegetables, flowers along the edge
      for (let i = 0; i + 3 <= r.w; i += 3) put('fenceRow', r.x + i, r.y + r.d - 1, { w: 3, variant: 'picket' });
      for (let j = 0; j + 3 <= r.d - 1; j += 3) put('fenceRow', r.x + r.w - 1, r.y + j, { rot: 1, w: 3, variant: 'picket' });
      for (let j = 0; j < inner.d; j++) {
        if (j % 2 === 1) {
          for (let i = 0; i < inner.w; i++) if (rnd(inner.x + i, inner.y + j, 31) < 0.3) flat('trans.worn', inner.x + i, inner.y + j);
          continue;
        }
        if (put('cropRow', inner.x, inner.y + j, { w: inner.w, d: 1, variant: pick(t(30, j), VEG) })) b.ground('soil', inner.x, inner.y + j, inner.w, 1);
      }
      const fv = pick(t(32), ['marigold', 'tulip', 'cosmos', 'daisy']);
      for (let i = 0; i < r.w - 1; i++) if (t(33, i) < 0.7) put('flowerPatch', r.x + i, r.y, { variant: fv });
      if (t(34) > 0.6) put('scarecrow', r.x, r.y + 1);
      meadows.push(r);
      seal(r);
    } else if (kind === 'flowers') {
      // a wildflower meadow: drifts of single species, a few shrubs, maybe beehives and a lone tree
      const nd = 3 + Math.floor(t(35) * 3);
      for (let n = 0; n < nd; n++) drift('flowerPatch', pick(t(36, n), WILDFLOWERS), rx(37 + n), ry(47 + n), 4 + Math.floor(t(38, n) * 6), 2.2, id * 7 + n);
      for (let n = 0; n < 2; n++) drift('tallGrass', pick(t(39, n), GRASSES), rx(57 + n), ry(59 + n), 3, 1.6, id * 11 + n);
      if (t(61) > 0.5) put('bush', rx(62), ry(63), { variant: pick(t(64), BUSH_GARDEN) });
      if (t(65) > 0.55) for (let i = 0; i < 3; i++) put('beehive', r.x + 1 + i * 2, r.y + r.d - 1);
      if (t(66) > 0.5) put('fruitTree', rx(67), ry(68), { variant: pick(t(69), FRUIT) });
      for (let j = r.y; j < r.y + r.d; j++) for (let i = r.x; i < r.x + r.w; i++) if (rnd(i, j, 70) < 0.18) flat(pick(rnd(i, j, 71), ['clutter.flowers', 'trans.clover', 'clutter.flowers']), i, j);
      meadows.push(r);
    } else {
      // open meadow: drifts of flowers and grasses, a clump of trees or a lone tree (and a picnic under it)
      const nd = 2 + Math.floor(t(25) * 3);
      for (let n = 0; n < nd; n++) drift('flowerPatch', pick(t(26, n), MEADOWFLOWERS), rx(27 + n), ry(29 + n * 3), 3 + Math.floor(t(31, n) * 4), 1.8, id * 13 + n);
      for (let n = 0; n < 2; n++) drift('tallGrass', pick(t(32, n), GRASSES), rx(33 + n * 7), ry(34 + n * 7), 3, 1.5, id * 17 + n);
      if (t(40) < 0.4) {
        const cx = rx(41);
        const cy = ry(42);
        drift('tree', pickW(t(43), LONE), cx, cy, 3 + Math.floor(t(44) * 3), 1.7, id * 19);
        drift('bush', pickW(t(45), BUSH_WILD), cx + 1, cy + 1, 3, 1.8, id * 23);
      } else if (t(35) > 0.35) {
        const tx = rx(36);
        const ty = ry(37);
        put('tree', tx, ty, { variant: pickW(t(38), LONE) });
        if (t(39) > 0.85) {
          put('picnicBlanket', tx + 1, ty + 1);
          put('basket', tx + 2, ty + 1);
        }
      }
      for (let j = r.y; j < r.y + r.d; j++) for (let i = r.x; i < r.x + r.w; i++) if (rnd(i, j, 72) < 0.16) flat(pick(rnd(i, j, 73), MEADOW_FLAT), i, j);
      meadows.push(r);
    }
  };

  let id = 0;
  for (let cy = Math.floor(Y0 / C) * C; cy <= Y1; cy += C) {
    for (let cx = Math.floor(X0 / C) * C; cx <= X1; cx += C) {
      let r: Rect = { x: cx + 1, y: cy + 1, w: C - 1, d: C - 1 };
      const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d], [r.x + (r.w >> 1), r.y + (r.d >> 1)]];
      if (!pts.some(([x, y]) => inFrame(x, y))) continue;
      for (const k of [...keeps, ...(o.authored ?? [])]) r = clip(r, { x: k.x - 1, y: k.y - 1, w: k.w + 2, d: k.d + 2 });
      for (const road of o.roads) r = clip(r, { x: road.x - 1, y: road.y - 1, w: road.w + 2, d: road.d + 2 });
      if (r.w < 3 || r.d < 3) continue;
      // split some cells into two parcels so the patchwork doesn't read as a grid
      const split = rnd(cx, cy, 40);
      if (split < 0.3 && r.w >= 9) {
        const a = 4 + Math.floor(rnd(cx, cy, 41) * (r.w - 8));
        parcel({ x: r.x, y: r.y, w: a, d: r.d }, ++id);
        parcel({ x: r.x + a + 1, y: r.y, w: r.w - a - 1, d: r.d }, ++id);
      } else if (split < 0.6 && r.d >= 9) {
        const a = 4 + Math.floor(rnd(cx, cy, 42) * (r.d - 8));
        parcel({ x: r.x, y: r.y, w: r.w, d: a }, ++id);
        parcel({ x: r.x, y: r.y + a + 1, w: r.w, d: r.d - a - 1 }, ++id);
      } else parcel(r, ++id);
    }
  }

  // ── road verges ─────────────────────────────────────────────
  for (const road of o.roads) {
    const horiz = road.w > road.d;
    const len = horiz ? road.w : road.d;
    for (let s = 0; s < len; s++) {
      for (const side of [-1, 1]) {
        const x = horiz ? road.x + s : side < 0 ? road.x - 1 : road.x + road.w;
        const y = horiz ? (side < 0 ? road.y - 1 : road.y + road.d) : road.y + s;
        // worn edges, stones and tufts on the road's own border tiles
        const ex = horiz ? x : side < 0 ? road.x : road.x + road.w - 1;
        const ey = horiz ? (side < 0 ? road.y : road.y + road.d - 1) : y;
        const u = rnd(ex, ey, 19);
        if (u < 0.42) flat(u < 0.025 ? 'edge.puddle' : pick(rnd(ex, ey, 18), VERGE), ex, ey, horiz ? 0 : 1, true);
        const t = rnd(x, y, 20);
        if (road.poplars && s % 3 === 0 && t < 0.6) put('tree', x, y, { variant: 'poplar' });
        else if (t < 0.07) put('tree', x, y, { variant: pickW(rnd(x, y, 22), LONE) });
        else if (t < 0.1) put('fruitTree', x, y, { variant: pick(rnd(x, y, 23), FRUIT) });
        else if (t < 0.16) put('bush', x, y, { variant: pickW(rnd(x, y, 24), BUSH_WILD) });
        else if (t < 0.25) put('flowerPatch', x, y, { variant: pick(rnd(x, y, 25), MEADOWFLOWERS) });
        else if (t < 0.3) put('tallGrass', x, y, { variant: pick(rnd(x, y, 26), GRASSES) });
        else if (t < 0.305) put('signpost', x, y);
      }
    }
  }

  // ── meadow scatter everywhere else (density drifts: lush patches and quiet ones) ─
  const inAuthored = (x: number, y: number) => (o.authored ?? []).some((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.d);
  const COPSE = ['oak', 'oak', 'birch', 'pine', 'oak', 'birch', 'cherry', 'poplar'];
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      if (!inFrame(x, y) || blocked(x, y)) continue;
      // copses: trees and shrubs clumped together where the land is left alone (one species per area)
      const cp = noise(x * 0.17, y * 0.17, 97);
      const c0 = o.copse ?? 0.74;
      if (cp > c0 && !inAuthored(x, y)) {
        const u = rnd(x, y, 98);
        const sp = COPSE[Math.floor(noise(x * 0.05, y * 0.05, 99) * COPSE.length * 0.999)];
        if (u < (cp - c0) * 1.6 + 0.12) put('tree', x, y, { variant: cp < c0 + 0.03 && rnd(x, y, 100) < 0.4 ? 'sapling' : sp });
        else if (u < 0.5) put('bush', x, y, { variant: pickW(rnd(x, y, 101), BUSH_WILD) });
        else if (u < 0.58) put('fern', x, y);
        else if (u < 0.75) flat(pick(rnd(x, y, 102), FLOOR), x, y);
        continue;
      }
      const lush = noise(x * 0.14, y * 0.14, 91);
      const dens = (o.scatter ?? 1) * (0.35 + 1.4 * lush * lush);
      const t = rnd(x, y, 21);
      // neighbouring flowers share a species: drifts, not confetti
      const species = MEADOWFLOWERS[Math.floor(noise(x * 0.22, y * 0.22, 92) * MEADOWFLOWERS.length * 0.999)];
      // white daisies gather in drifts of their own
      if (o.daisies && noise(x * 0.3, y * 0.3, 88) > 0.58 && rnd(x, y, 89) < 0.32 * o.daisies) {
        put('flowerPatch', x, y, { variant: 'daisy' });
        continue;
      }
      const lt = 0.0015 * (o.meadowTrees ?? 1);
      if (t < 0.035 * dens) put('flowerPatch', x, y, { variant: species });
      else if (t < 0.075 * dens) put('tallGrass', x, y, { variant: pick(rnd(x, y, 93), GRASSES) });
      else if (t < 0.083 * dens) put('bush', x, y, { variant: pickW(rnd(x, y, 94), BUSH_WILD) });
      else if (t < (0.083 + lt) * dens) put('tree', x, y, { variant: pickW(rnd(x, y, 95), LONE) });
      else if (t < (0.149 + lt) * dens) flat(pick(rnd(x, y, 96), MEADOW_FLAT), x, y);
    }

  // ── life ────────────────────────────────────────────────────
  for (const p of ponds) {
    b.critters('duck', p.x + 0.5, p.y + 0.5, p.w - 1, p.d - 1, 3);
    b.critters('frog', p.x - 0.8, p.y + p.d - 0.2, p.w + 1.6, 0.9, 2);
  }
  pastures.forEach((p, i) => {
    b.critters('sheep', p.x + 0.4, p.y + 1.2, p.w - 0.8, p.d - 1.6, Math.min(6, 3 + Math.floor((p.w * p.d) / 14)));
    if (i % 2 === 0) b.critters('cow', p.x + 0.6, p.y + 1.4, p.w - 1.2, p.d - 2, 1);
  });
  for (const s of steads) b.critters('chicken', s.x, s.y, s.w, s.d, 4);
  meadows
    .filter((_, i) => i % 3 === 0)
    .slice(0, 5)
    .forEach((m) => b.critters('butterfly', m.x, m.y, m.w, m.d, 2));
}

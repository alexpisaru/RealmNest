import { PROP_META } from '../props';
import { WorldBuilder } from './builder';
import { countryside } from './countryside';

// ─────────────────────────────────────────────────────────────
// FARM — art vertical slice at 128×64 tiles (docs/FARM_ART_BIBLE.md).
// A homestead yard (playable) inside a lived-in countryside, dressed
// from the 128×64 asset library (species, variants, decals, animals).
//
//   N   farmhouse: washing line, woodpile, rain barrel, bicycle, the dog
//       on the doorstep · barn yard: milk cans, ladder, hay, tarp ·
//       mixed fruit orchard behind mossy dry-stone walls
//   W   orchard at harvest (cart, baskets, ladder) · beehives in lavender ·
//       fenced wheat with a scarecrow on the headland
//   E   picket fence and the farm gate with the mailbox · poplar road ·
//       ripe and green wheat · sheep and a cow in a rail paddock ·
//       picket-fenced kitchen plots · a strip of fruit trees on the lane
//   S   hedges · duck pond with a jetty, rowboat, reeds, irises, lilies
//       and frogs · willow · wildflower drifts, a picnic under the cherry
//
// Stations, seats and points are the same as in the 64×32 slice.
// ─────────────────────────────────────────────────────────────

type Opt = { w?: number; d?: number; rot?: 0 | 1; variant?: string; color?: string };

const b = new WorldBuilder('farm', 22, 18);
const rnd = (i: number, j: number, s = 0) => {
  let h = Math.imul(i * 374761393 + j * 668265263 + s * 1442695041, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const pick = <T>(list: readonly T[], i: number, j: number, s: number): T => list[Math.floor(rnd(i, j, s) * list.length)];
const inYard = (x: number, y: number) => x >= 0 && y >= 0 && x < 22 && y < 18;
/** Free grass: no prop, no point, not a path, plot or water. */
const freeGrass = (x: number, y: number) => {
  if (!b.isFree(x, y)) return false;
  const g = b.groundAt(x, y);
  return g === null || g === 'grass' || g === 'meadow' || g === 'forest';
};
/** Solid scenery outside the yard, only on free grass. */
const place = (type: string, x: number, y: number, o: Opt = {}) => {
  const m = PROP_META[type];
  const w = o.w ?? m.w;
  const d = o.d ?? m.d;
  const [fw, fd] = o.rot === 1 ? [d, w] : [w, d];
  for (let j = 0; j < fd; j++) for (let i = 0; i < fw; i++) if (inYard(x + i, y + j) || !freeGrass(x + i, y + j)) return null;
  return b.scenic(type, x, y, o);
};
/** Walk-through plants anywhere (on grass only). */
const plant = (type: string, x: number, y: number, o: Opt = {}) => (freeGrass(x, y) ? b.decor(type, x, y, o) : null);
/** A flat ground decal: path edges, transitions, clutter. */
const decal = (variant: string, x: number, y: number, rot: 0 | 1 = 0) => b.decor('decal', x, y, { variant, rot });
/** A drift of one plant around a point: flowers grow in patches of one kind, not confetti. */
const drift = (type: string, variant: string | undefined, cx: number, cy: number, n: number, spread: number, s: number) => {
  const solid = PROP_META[type].solid !== false;
  for (let i = 0, k = 0; i < n * 3 && k < n; i++) {
    const a = rnd(cx * 7 + i, cy, s) * Math.PI * 2;
    const r = Math.sqrt(rnd(cy * 5 + i, cx, s + 1)) * spread;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r * 0.8);
    const o = variant ? { variant } : {};
    if (solid ? place(type, x, y, o) : plant(type, x, y, o)) k++;
  }
};

const EDGE = ['edge.tufts', 'edge.stones', 'edge.crumbs', 'edge.tufts', 'edge.flowers'];

// ── ground ────────────────────────────────────────────────────
b.ground('paving', 5, 0, 12, 8); // cobbled courtyard in front of the house
b.ground('dirt', 9, 7, 3, 18); // main lane, runs out south
b.ground('dirt', 1, 8, 8, 1); // to the field
b.ground('dirt', 12, 8, 21, 1); // east lane → road
b.ground('soil', 1, 9, 8, 8); // vegetable field
b.ground('paving', 9, -1, 3, 1); // doorstep
b.ground('deck', 16, 1, 4, 3); // pergola floor
b.ground('dirt', 23, -12, 2, 40); // country road
b.ground('dirt', 14, -3, 9, 3); // barn yard
b.ground('dirt', 19, -9, 4, 6); // track to the haystacks
b.ground('soil', 26, -10, 7, 3); // ripe wheat, east
b.ground('soil', 26, -6, 7, 2); // green wheat, east
b.ground('soil', -10, -10, 6, 4); // wheat, west
for (const [x, y, w, d] of [[13, 20, 9, 5], [12, 21, 2, 3], [15, 19, 4, 1], [21, 21, 2, 2], [15, 25, 5, 1]]) b.ground('water', x, y, w, d); // duck pond
b.ground('gravel', -11, -1, 10, 1); // west lane

// ── working yard ──────────────────────────────────────────────
b.station('greenhouse2', 1, 1, 'CROP', 'Greenhouse', { verb: 'potting seedlings' });
b.station('raisedBed', 6, 5, 'CROP', 'Rose bed', { variant: 'pink', verb: 'pruning roses' });
b.station('raisedBed', 14, 5, 'CROP', 'Marigold bed', { variant: 'yellow', verb: 'deadheading' });
b.station('crops', 1, 10, 'CROP', 'Carrot row', { w: 4, d: 1, variant: 'carrot', verb: 'pulling carrots' });
b.station('crops', 5, 10, 'CROP', 'Tomato row', { w: 3, d: 1, variant: 'tomato', verb: 'picking tomatoes' });
b.station('crops', 1, 13, 'CROP', 'Cabbage row', { w: 4, d: 1, variant: 'cabbage', verb: 'weeding' });
b.station('crops', 5, 13, 'CROP', 'Pumpkin row', { w: 3, d: 1, variant: 'pumpkin', verb: 'watering' });
b.station('raisedBed', 12, 10, 'CROP', 'Lettuce bed', { variant: 'lettuce', verb: 'harvesting lettuce' });
b.station('raisedBed', 15, 10, 'CROP', 'Herb bed', { variant: 'herbs', verb: 'cutting herbs' });
b.station('coop', 19, 10, 'CROP', 'Chicken coop', { verb: 'feeding the hens' });
b.station('shed', 19, 5, 'STORAGE', 'Tool shed');

// ── pergola lounge ────────────────────────────────────────────
b.prop('pergola', 16, 1);
b.seats('armchair', 16, 1, 'LOUNGE', 'Pergola', { color: '#d9a066' });
b.seats('armchair', 17, 1, 'LOUNGE', 'Pergola', { color: '#7fa86a' });
b.seats('armchair', 19, 2, 'LOUNGE', 'Pergola', { rot: 1, color: '#d9a066' });
b.prop('cafeTable', 18, 2);
b.point('BREAK', 18.5, 1.5, 'sw', 'Pergola table');
b.point('BREAK', 17.5, 2.5, 'se', 'Pergola table');
b.point('BREAK', 18.5, 3.5, 'ne', 'Pergola table');

// ── picnic & orchard bench ───────────────────────────────────
b.prop('picnic', 13, 13);
b.point('BREAK', 12.5, 13.5, 'se', 'Picnic table');
b.point('BREAK', 15.5, 13.5, 'nw', 'Picnic table');
b.point('BREAK', 13.5, 12.5, 'sw', 'Picnic table');
b.point('BREAK', 14.5, 14.5, 'ne', 'Picnic table');
b.prop('fruitTree', 17, 13, { variant: 'apple' });
b.seats('bench', 15, 16, 'LOUNGE', 'Bench under the apple tree');

// ── courtyard life ────────────────────────────────────────────
b.around(b.prop('farmFountain', 9, 2, { w: 3, d: 3 }), 'MEETING', 'Courtyard huddle');
// Victorian street lamps round the courtyard and down the lane
b.prop('farmLamp', 6, 0);
b.prop('farmLamp', 8, 7);
b.prop('farmLamp', 16, 5);
b.prop('farmLamp', 12, 9);
// a flower box at the courtyard's foot, a bench against the greenhouse
b.prop('raisedBed', 12, 7, { variant: 'mixed' });
b.prop('bench', 5, 2, { rot: 1 });
b.prop('pots', 8, 0, { variant: 'pink' });
b.prop('pots', 15, 0, { variant: 'mixed' });
b.prop('pots', 5, 6, { variant: 'purple' });
b.prop('firewood', 13, 0);
b.prop('wheelbarrow', 18, 6);
b.prop('crate', 18, 4);
b.prop('compost', 21, 7);
b.prop('hay', 21, 9);
b.prop('wateringCan', 4, 5);
b.prop('wateringCan', 8, 9, { color: '#9aa4b8' });
b.prop('gnome', 8, 6);
b.prop('gnome', 4, 0);
b.prop('signpost', 12, 16);
for (const y of [9, 11, 13, 15]) b.prop('sunflowers', 0, y);
b.prop('pots', 0, 6, { variant: 'yellow' });
b.prop('tree', 21, 16, { variant: 'cherry' });
b.prop('bush', 0, 17, { variant: 'hydrangea' });
b.prop('bush', 8, 17, { variant: 'rose' });

// ── decorative points ─────────────────────────────────────────
b.point('DECORATIVE', 1.5, 9.5, 'nw', 'Sunflowers');
b.point('DECORATIVE', 10.5, 0.5, 'ne', 'Farmhouse');
b.point('DECORATIVE', 16.5, 13.5, 'se', 'Apple tree');
b.point('DECORATIVE', 20.5, 14.5, 'ne', 'Chicken run');

b.spawn(10, 0);
b.spawn(11, 0);
b.node('courtyard', 10, 5);
b.node('field', 4, 12);

b.prop('pots', 5, 1, { variant: 'purple' });
b.prop('pots', 16, 6, { variant: 'yellow' });
b.prop('barrel', 13, 1);
// working clutter that tells what the yard is for (on edge tiles, never in a walkway)
b.prop('rainBarrel', 21, 5);
b.prop('tools', 21, 3);
b.prop('seedBags', 0, 4);
b.prop('potStack', 0, 2);

// ── yard dressing: walk-through decoration on every free edge ─
// the vegetable field: tall corn at the back, low crops in front
b.decor('cropRow', 2, 9, { w: 6, variant: 'corn' });
b.decor('cropRow', 1, 12, { w: 7, variant: 'lettuce' });
b.decor('cropRow', 1, 15, { w: 7, variant: 'herbs' });
b.decor('cropRow', 1, 16, { w: 7, variant: 'cabbage' });
// cottage flowers round the courtyard, the pergola and the house front
for (const [x, y, v] of [
  [0, 1, 'cosmos'], [0, 3, 'tulip'], [4, 4, 'marigold'], [4, 6, 'daisy'],
  [20, 1, 'lavenderSmall'], [21, 1, 'cosmos'], [21, 2, 'hollyhock'], [20, 3, 'wild'], [13, 7, 'marigold'], [16, 7, 'cosmos'],
  [0, 7, 'wild'], [2, 7, 'poppy'], [3, 7, 'poppy'], [5, 7, 'daisy'], [8, 7, 'tulip'], [17, 9, 'forgetmenot'],
  [18, 15, 'poppy'], [19, 16, 'wild'], [20, 17, 'daisy'], [18, 17, 'forgetmenot'], [16, 17, 'poppy'], [14, 16, 'daisy'],
  [12, 12, 'daisy'], [12, 14, 'forgetmenot'], [21, 13, 'wild'], [21, 15, 'poppy'],
  [4, 7, 'cosmos'], [17, 7, 'daisy'], [12, 11, 'wild'], [14, 11, 'daisy'], [17, 11, 'cosmos'], [13, 16, 'poppy'], [17, 16, 'daisy'], [16, 8, 'marigold'],
  [19, 14, 'daisy'], [20, 15, 'daisy'], [15, 14, 'daisy'], [16, 16, 'wild'], [12, 17, 'daisy'], [18, 11, 'daisy'], [20, 16, 'cosmos'], [13, 11, 'daisy'],
] as const)
  plant('flowerPatch', x, y, { variant: v });
for (const [x, y, v] of [
  [0, 8, 'clump'], [0, 10, 'seedheads'], [0, 12, 'tuft'], [0, 14, 'seedheads'], [0, 16, 'clump'], [0, 5, 'tuft'], [18, 7, 'seedheads'],
  [14, 9, 'tuft'], [18, 9, 'sedge'], [17, 12, 'clump'], [21, 6, 'sedge'], [20, 4, 'tuft'], [18, 12, 'seedheads'],
] as const)
  plant('tallGrass', x, y, { variant: v });
b.decor('fern', 21, 4);
b.decor('fern', 0, 0);
b.decor('broom', 18, 5);
b.decor('trellis', 8, 5);
// the lanes: worn edges, stones and tufts; stepping stones to the bench
for (let y = 9; y < 18; y++) {
  if (rnd(9, y, 3) < 0.55) decal(pick(EDGE, 9, y, 4), 9, y, 1);
  if (rnd(11, y, 3) < 0.55) decal(pick(EDGE, 11, y, 4), 11, y, 1);
}
for (let x = 1; x < 22; x++) if (x !== 9 && x !== 10 && x !== 11 && rnd(x, 8, 5) < 0.5) decal(pick(EDGE, x, 8, 6), x, 8);
for (const x of [12, 13, 14]) decal('steps', x, 15);
// moss creeping into the courtyard's joints, weeds by the walls
for (const [x, y] of [[5, 3], [5, 5], [16, 6], [6, 6], [6, 1], [14, 1], [11, 6], [7, 4]] as const) decal('edge.moss', x, y);
decal('clutter.weeds', 16, 4);
decal('clutter.leaves', 18, 0);
// the chicken run, the apple tree, the picnic, the bench
for (const [x, y, v] of [
  [19, 12, 'trans.worn'], [21, 12, 'trans.worn'], [21, 10, 'trans.dry'], [21, 11, 'trans.dry'], [19, 13, 'clutter.pebbles'], [20, 13, 'trans.worn'],
  [17, 14, 'clutter.leaves'], [18, 13, 'clutter.leaves'], [16, 12, 'trans.clover'], [13, 14, 'trans.worn'], [15, 17, 'trans.worn'], [16, 15, 'trans.clover'],
  [19, 7, 'trans.patchy'], [17, 6, 'trans.worn'], [2, 4, 'trans.worn'], [1, 5, 'clutter.pebbles'],
] as const)
  decal(v, x, y);

// ── north: farmhouse and barn yard ────────────────────────────
b.scenic('farmhouse', 6, -6);
b.scenic('barn', 15, -6);
// the porch and the alley between house and barn
b.scenic('bicycle', 14, -1);
b.scenic('rainBarrel', 14, -3);
b.scenic('milkCan', 14, -4);
b.decor('broom', 14, -2);
b.scenic('pots', 5, -1, { variant: 'red' });
for (const [x, v] of [[6, 'hollyhock'], [8, 'foxglove'], [12, 'hollyhock']] as const) plant('flowerPatch', x, -1, { variant: v });
b.scenic('farmLamp', 4, -1);
// west of the house: the well, a bench, the woodpile, the washing line
b.scenic('well', 2, -4);
b.scenic('bench', 3, -2);
b.scenic('chopBlock', 4, -5);
b.scenic('firewood', 5, -5);
b.scenic('laundry', 2, -7, { w: 2 });
b.scenic('hedgeRow', 0, -2, { w: 2, variant: 'white' });
b.scenic('basket', 1, -5);
// the barn yard: hay, milk cans, a ladder on the barn front, a tarp over spare timber
b.scenic('ladder', 18, -3);
b.scenic('milkCan', 15, -3);
b.scenic('tools', 16, -1);
b.scenic('wheelbarrow', 18, -1);
b.scenic('tarpPile', 22, -3);
for (const [x, y] of [[20, -3], [21, -5], [19, -7]]) b.scenic('haystack', x, y);
for (const [x, y] of [[19, -2], [21, -2], [20, -1]]) b.scenic('hay', x, y);
b.scenic('barrel', 21, -7);
for (const [x, y, v] of [
  [17, -2, 'trans.dry'], [19, -1, 'trans.dry'], [22, -1, 'trans.mud'], [20, -4, 'trans.dry'], [21, -9, 'trans.dry'], [16, -3, 'trans.worn'],
  [15, -1, 'edge.puddle'], [20, -8, 'trans.mud'], [13, -1, 'trans.worn'], [3, -3, 'trans.worn'], [1, -3, 'clutter.leaves'], [2, -5, 'trans.patchy'],
] as const)
  decal(v, x, y);
// the orchard behind: mixed fruit in rows, mossy walls in front
const ORCH = ['apple', 'pear', 'apple', 'plum', 'apple', 'cherry'];
/** Fruit trees on every other tile (crowns touching, as in the retouch): a few gaps, saplings and blossoming cherries. */
const orchard = (x0: number, y0: number, x1: number, y1: number, s: number) => {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if ((x + y) & 1) continue;
      const u = rnd(x, y, s);
      if (u < 0.07) continue;
      if (u < 0.13) place('tree', x, y, { variant: 'sapling' });
      else if (u > 0.88) place('tree', x, y, { variant: 'cherry' });
      else place('fruitTree', x, y, { variant: ORCH[(Math.abs(x) * 5 + Math.abs(y)) % ORCH.length] });
    }
};
orchard(-1, -15, 18, -10, 9);
b.scenic('stoneWall', -1, -8, { w: 6, variant: 'mossy' });
b.scenic('stoneWall', 14, -8, { w: 5, variant: 'dry' });
for (const [x, y, v] of [[0, -7, 'foxglove'], [4, -7, 'hollyhock'], [5, -7, 'cosmos'], [-1, -7, 'daisy']] as const) plant('flowerPatch', x, y, { variant: v });
for (const [x, y, v] of [[-2, -6, 'mossy'], [0, -6, 'flat']] as const) place('rock', x, y, { variant: v });

// ── west: dry-stone wall, orchard at harvest, beehives, fenced wheat ─
b.scenic('stoneWall', -1, 0, { rot: 1, w: 6, variant: 'mossy' });
b.scenic('stoneWall', -1, 8, { rot: 1, w: 4, variant: 'dry' });
b.scenic('stoneWall', -1, 13, { rot: 1, w: 5, variant: 'mossy' });
place('appleCart', -5, 3, { w: 2 });
place('basket', -4, 4);
place('basket', -2, 6);
b.decor('ladder', -3, 2);
place('birdhouse', -2, 4);
for (const x of [-4, -6, -8]) place('beehive', x, 17);
drift('flowerPatch', 'lavenderSmall', -6, 15, 6, 1.8, 11);
orchard(-11, 0, -3, 14, 10);
b.scenic('crops', -10, -10, { w: 6, d: 4, variant: 'wheat' });
b.scenic('fenceRow', -11, -5, { w: 8, variant: 'rail' });
b.scenic('fenceRow', -4, -10, { rot: 1, w: 5, variant: 'rail' });
place('scarecrow', -7, -6);
place('haystack', -3, -3);
b.scenic('fenceRow', -11, -2, { w: 10, variant: 'rail' });
for (let x = -11; x < -1; x++) if (rnd(x, -1, 7) < 0.45) decal(pick(['edge.tufts', 'edge.stones', 'trans.gravel'], x, -1, 8), x, -1);

// ── east: farm gate, poplar road, wheat, the paddock, kitchen plots ─
b.scenic('fenceRow', 22, 0, { rot: 1, w: 7, variant: 'rail' });
b.scenic('fenceRow', 22, 9, { rot: 1, w: 9, variant: 'rail' });
b.scenic('mailbox', 22, 7);
// wheat: ripe and green strips with a headland and a scarecrow, rail fence along the road
b.scenic('crops', 26, -10, { w: 7, d: 3, variant: 'wheat' });
b.scenic('crops', 26, -6, { w: 7, d: 2, variant: 'wheatGreen' });
b.scenic('fenceRow', 25, -11, { rot: 1, w: 7, variant: 'rail' });
place('scarecrow', 29, -7);
place('haystack', 33, -8);
for (let x = 26; x < 33; x++) if (rnd(x, -7, 12) < 0.5) decal(pick(['trans.dry', 'trans.patchy', 'clutter.flowers'], x, -7, 13), x, -7);
// the paddock: rail fence with a gate, sheep and a cow, trough, hay, a shade oak
for (let x = 26; x < 34; x += 3) {
  const w = Math.min(3, 34 - x);
  b.scenic('fenceRow', x, -3, { w, variant: 'rail' });
  if (x !== 29) b.scenic('fenceRow', x, 4, { w, variant: x === 32 ? 'broken' : 'rail' });
}
b.scenic('fenceRow', 30, 4, { w: 2, variant: 'rail' });
b.scenic('gate', 29, 4);
b.scenic('fenceRow', 26, -2, { rot: 1, w: 6, variant: 'rail' });
b.scenic('fenceRow', 33, -2, { rot: 1, w: 6, variant: 'rail' });
b.scenic('trough', 27, -2, { w: 2 });
b.scenic('haystack', 32, -2);
place('tree', 34, -2, { variant: 'oak' }); // shade by the paddock, not in front of it
for (const [x, y, v] of [[27, -1, 'trans.worn'], [28, -1, 'trans.mud'], [29, 3, 'trans.worn'], [30, 0, 'trans.clover'], [28, 2, 'trans.patchy'], [31, -1, 'trans.dry']] as const) decal(v, x, y);
// fruit trees along the lane, then the kitchen plots behind a picket fence
for (const [x, v] of [[26, 'apple'], [29, 'pear'], [32, 'plum']] as const) place('fruitTree', x, 6, { variant: v });
const plot = ['cabbage', 'beans', 'carrot', 'pumpkin', 'lettuce', 'tomato', 'cabbage'];
plot.forEach((v, j) => {
  if (j % 2) {
    for (let i = 0; i < 8; i += 2) plant('flowerPatch', 25 + i + (j & 2 ? 1 : 0), 10 + j, { variant: pick(['marigold', 'tulip', 'cosmos'], i, j, 14) });
    return;
  }
  b.ground('soil', 25, 10 + j, 8, 1);
  b.scenic('cropRow', 25, 10 + j, { w: 8, variant: v });
});
b.scenic('fenceRow', 25, 17, { w: 9, variant: 'picket' });
b.scenic('fenceRow', 33, 10, { rot: 1, w: 7, variant: 'picket' });
place('scarecrow', 31, 13);
place('wateringCan', 28, 11);
// worn edges along the road and the lane
for (let y = -12; y < 28; y++) {
  if (rnd(23, y, 15) < 0.4) decal(pick(EDGE, 23, y, 16), 23, y, 1);
  if (rnd(24, y, 15) < 0.4) decal(pick(EDGE, 24, y, 16), 24, y, 1);
}
for (let x = 25; x < 33; x++) if (rnd(x, 8, 17) < 0.45) decal(pick(EDGE, x, 8, 18), x, 8);

// ── south: hedges, the duck pond, the wildflower meadow ───────
b.scenic('hedgeRow', 0, 18, { w: 4, variant: 'pink' });
b.scenic('hedgeRow', 4, 18, { w: 5, variant: 'mixed' });
b.scenic('stoneWall', 12, 18, { w: 5, variant: 'mossy' });
b.scenic('stoneWall', 17, 18, { w: 5, variant: 'mossy' });
for (const x of [2, 4, 6]) b.scenic('sunflowers', x, 20);
b.scenic('farmLamp', 12, 19);
b.scenic('farmLamp', 8, 19);
// the jetty off the lane, a rowboat tied to it, the bench on the far shore
b.scenic('dock', 12, 22, { w: 2 });
b.scenic('rowboat', 13, 23, { w: 2 });
b.scenic('bench', 14, 26, { w: 2, variant: 'back' }); // faces the pond
for (const [x, y] of [[15, 21], [18, 22], [20, 23], [14, 20], [17, 24], [16, 20], [19, 21]]) b.scenic('lilies', x, y);
for (const [x, y, v] of [
  [13, 19, 'iris'], [19, 19, 'cattail'], [12, 20, 'reedgrass'], [12, 24, 'cattail'], [14, 25, 'rush'], [20, 25, 'iris'], [22, 24, 'cattail'], [22, 20, 'reedgrass'], [20, 19, 'rush'], [22, 23, 'cattail'],
] as const)
  b.decor('reeds', x, y, { variant: v });
for (const [x, y, v] of [[14, 19, 'boulder'], [21, 26, 'mossy'], [22, 25, 'cluster'], [13, 26, 'flat'], [21, 19, 'flat']] as const) place('rock', x, y, { variant: v });
place('tree', 12, 25, { variant: 'willow' });
for (const [x, y, v] of [[16, 26, 'trans.clover'], [18, 26, 'clutter.flowers'], [19, 26, 'trans.worn'], [13, 27, 'edge.puddle'], [17, 19, 'clutter.pebbles']] as const) decal(v, x, y);
// the meadow: drifts of one flower each, a cherry with a picnic under it, oaks and an apple tree
drift('flowerPatch', 'poppy', 3, 23, 7, 2.2, 21);
drift('flowerPatch', 'daisy', 7, 22, 6, 1.8, 22);
drift('flowerPatch', 'forgetmenot', 18, 27, 5, 1.6, 23);
drift('flowerPatch', 'wild', 1, 27, 6, 2, 24);
drift('flowerPatch', 'cosmos', 6, 27, 5, 1.6, 25);
drift('tallGrass', 'seedheads', 8, 25, 4, 1.5, 26);
drift('tallGrass', 'sedge', 22, 22, 3, 1.2, 27);
place('tree', 17, 28, { variant: 'cherry' });
place('picnicBlanket', 16, 29);
place('basket', 18, 29);
place('tree', 1, 24, { variant: 'oak' });
place('fruitTree', 6, 23, { variant: 'apple' });
place('tree', 21, 28, { variant: 'oak' });
place('tree', -4, 21, { variant: 'birch' });
place('tree', 13, 29, { variant: 'birch' });
place('fruitTree', 3, 27, { variant: 'pear' });
for (const [x, y, v] of [[8, 24, 'round'], [0, 21, 'berry'], [-1, 25, 'round'], [5, 25, 'berry']] as const) place('bush', x, y, { variant: v });
for (const [x, y, v] of [[4, 21, 'cherry'], [-2, 23, 'birch'], [19, 28, 'birch'], [8, 28, 'cherry'], [-3, 27, 'pine'], [1, 29, 'oak'], [23, 26, 'cherry'], [-1, 19, 'birch']] as const) place('tree', x, y, { variant: v });
for (const [x, y, v] of [[7, 20, 'rose'], [2, 26, 'round'], [20, 27, 'berry'], [-3, 24, 'round'], [6, 29, 'berry']] as const) place('bush', x, y, { variant: v });
drift('flowerPatch', 'daisy', 15, 28, 6, 2, 28);
drift('flowerPatch', 'daisy', -1, 22, 5, 1.8, 29);
drift('flowerPatch', 'daisy', 21, 21, 3, 1.2, 30);
for (let y = 18; y < 30; y++) if (y > 24 || y < 19) for (const x of [9, 11]) if (rnd(x, y, 19) < 0.5) decal(pick(EDGE, x, y, 20), x, y, 1);

// ── framing: big trees in the foreground and at the margins ───
for (const [x, y, v] of [[22, 31, 'oak'], [16, 37, 'oak'], [28, 26, 'willow'], [35, 19, 'oak'], [-8, 24, 'oak'], [36, -14, 'pine']] as const) place('tree', x, y, { variant: v });

// beyond: dense countryside to the frame edge — woods, orchards, paddocks,
// fields and meadows; the lanes keep leaving the frame
countryside(b, 22, 18, {
  k: 4,
  keep: [
    { x: -1, y: -7, w: 24, d: 26 }, // the homestead
    { x: 27, y: -2, w: 6, d: 6 }, // inside the paddock: grass for the sheep
    { x: 25, y: 9, w: 9, d: 8 }, // the kitchen plots
  ],
  authored: [
    { x: -1, y: -15, w: 25, d: 8 }, // orchard rows and the barn track
    { x: -12, y: -11, w: 11, d: 30 }, // west: wheat, orchard, beehives
    { x: 25, y: -11, w: 10, d: 29 }, // east: wheat, paddock, kitchen plots
    { x: -2, y: 19, w: 27, d: 11 }, // south: pond and meadow
  ],
  // dense and lush like the owner's retouch: orchards and copses everywhere, daisies in every gap
  near: [['orchard', 30], ['woods', 16], ['flowers', 16], ['field', 14], ['pasture', 12], ['meadow', 8]],
  far: [['woods', 48], ['orchard', 22], ['field', 10], ['flowers', 8], ['pasture', 5], ['meadow', 4], ['farmstead', 3], ['pond', 2], ['plot', 3]],
  woods: 0.85,
  scatter: 2.2,
  orchard: 'dense',
  copse: 0.64,
  daisies: 1,
  meadowTrees: 4,
  cell: 9,
  roads: [
    { mat: 'dirt', x: 23, y: -120, w: 2, d: 108, poplars: true }, // country road, north
    { mat: 'dirt', x: 23, y: 28, w: 2, d: 120, poplars: true }, // country road, south
    { mat: 'gravel', x: -120, y: -1, w: 108, d: 1 }, // west lane
    { mat: 'dirt', x: 9, y: 25, w: 3, d: 120 }, // main lane, south
    { mat: 'dirt', x: 33, y: 8, w: 120, d: 1 }, // east lane
  ],
});

// life
b.critters('chicken', 17.5, 12, 4, 4, 5);
b.critters('rooster', 18, 12.5, 3.5, 3, 1);
b.critters('butterfly', 4, 0, 13, 9, 6);
b.critters('butterfly', -9, 0, 8, 16, 3);
b.critters('butterfly', 0, 19, 12, 8, 4);
b.critters('duck', 14, 20.5, 7, 4, 5);
b.critters('frog', 12.6, 24.3, 8, 0.8, 2);
b.critters('frog', 20.2, 19.4, 2, 2, 1);
b.critters('bird', -10, 0, 8, 16, 3);
b.critters('bird', 24, 2, 8, 6, 2);
b.critters('cat', 12.5, -1.5, 0.6, 0.4, 1);
b.critters('dog', 7.6, -1.6, 4.2, 0.9, 1);
b.critters('sheep', 27.4, -1.2, 5.2, 4.6, 5);
b.critters('cow', 27.8, -0.6, 4.4, 3.6, 1);
// colours measured against the owner's retouch: greens 40% more saturated and turned
// toward yellow-green with deeper shade, warmer and lighter earth and wood
b.setScene({ ext: 14, outer: 'meadow', light: { tint: '#ffc070', strength: 0.3 }, grade: { saturation: 1.4, greenHue: 9, greenContrast: 1.35, earthLift: 0.05 } });

export const farm = b.build({
  name: 'Farm',
  description: 'A homestead yard: wooden greenhouse, flower beds, vegetable rows, a pergola lounge and a chicken coop, framed by the farmhouse, an orchard and open fields.',
  tagline: 'Grow, harvest and expand.',
  emoji: '🌾',
  theme: {
    floorA: '#8cc56a',
    floorB: '#84bd62',
    floorDetail: '#6ea54f',
    wall: '#4f8f4a',
    wallTrim: '#a6714a',
    slab: '#7a5236',
    accent: '#e8a53d',
    accent2: '#c0533f',
    ui: '#f2b98a',
    sky: ['#3a3170', '#f0a060'],
  },
  outfitCategory: 'farm',
  defaultOutfitId: 'farm.classic',
  environment: { floor: 'grass', outdoor: true, backdrop: 'none', tile: 128 },
  tasks: [
    'Water carrot rows',
    'Pick ripe tomatoes',
    'Weed the cabbages',
    'Pot new seedlings',
    'Prune the roses',
    'Feed the hens',
    'Collect eggs',
    'Cut fresh herbs',
    'Harvest lettuce',
  ],
});

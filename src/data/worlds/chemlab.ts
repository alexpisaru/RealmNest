import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('chemlab', 16, 14);

b.wall('window', 'ne', 1, 3);
b.wall('chemshelf', 'ne', 6, 3);
b.wall('sign', 'ne', 10, 1);
b.wall('door', 'ne', 13, 1);
b.wall('window', 'nw', 1, 2);
b.wall('chemshelf', 'nw', 4, 3);
b.wall('sign', 'nw', 9, 1);

b.patch('hazard', 14, 0, 2, 3);
b.patch('lane', 0, 6, 16, 1, { color: '#24a291' });

b.station('fumehood', 1, 0, 'LAB_BENCH', 'Fume hood 1', { verb: 'titrating' });
b.station('fumehood', 4, 0, 'LAB_BENCH', 'Fume hood 2', { verb: 'distilling' });
b.station('labbench', 2, 3, 'LAB_BENCH', 'Bench A', { slots: 2, verb: 'mixing' });
b.station('labbench', 7, 3, 'LAB_BENCH', 'Bench B', { slots: 2, variant: 'microscope', verb: 'observing' });
b.station('labbench', 2, 8, 'LAB_BENCH', 'Bench C', { slots: 2, verb: 'pipetting' });
b.station('analyzer', 11, 3, 'MACHINE', 'Analytical station', { verb: 'running spectrometry' });
b.station('reagents', 0, 10, 'STORAGE', 'Reagent storage', { rot: 1 });
b.prop('drum', 0, 13);
b.prop('drum', 1, 13);
b.prop('cabinet', 8, 8, { variant: 'flammable' });
b.prop('shower', 15, 0);
b.point('DECORATIVE', 14.5, 1.5, 'ne', 'Safety shower');

b.station('counter', 12, 11, 'COFFEE', 'Coffee (clean zone exit)', { slots: 2 });
b.prop('cafeTable', 13, 8);
b.point('BREAK', 12.5, 8.5, 'se', 'Café table');
b.point('BREAK', 14.5, 8.5, 'nw', 'Café table');
b.point('BREAK', 13.5, 7.5, 'sw', 'Café table');
b.point('BREAK', 13.5, 9.5, 'ne', 'Café table');

b.ring('MEETING', 6, 11, 'Lab sync');
b.prop('plant', 15, 13);
b.prop('plant', 11, 13);

b.spawn(13, 0);
b.spawn(13, 1);
b.node('aisle', 8, 6);

// ── the campus ───────────────────────────────────────────────
// The lab is the ground-floor wing of the chemistry building on a green
// science-park campus in a pine and birch forest. Behind its back walls rise the
// building's own upper floors (glass behind white fins, climbers, the CHEMISTRY
// logo, a wildflower roof with a glass atrium and exhaust stacks) and, to the
// west, a larch-louvred wing with a meadow roof and a roof terrace under a
// pergola. Round the room: an entrance plaza with a bike pergola and a
// bike-share dock, a red cycle path along the reed pond (lilies, rocks, flower
// beds, a timber boardwalk, a climber-covered pergola with benches), gardens of
// paths, flower beds and mixed trees to the south, a fenced hazmat yard with a
// liquid-nitrogen tank and a white van, EV parking under blue solar canopies, a
// campus shuttle on the road, and the forest out to the frame's edge.
function labCampus(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 14, outer: 'grass', frontWalls: true, light: { tint: '#fff2d8', strength: 0.22 }, grade: { saturation: 1.04, tone: [0, 0.075, 0.17, 0.28, 0.39, 0.5, 0.605, 0.71, 0.815, 0.915, 1] } });
  const hash = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 1442695041, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ── ground ────────────────────────────────────────────────
  // woods to the west and north, a flowery bank round the pond, the pond itself
  b.ground('forest', -46, -46, 34, 92);
  b.ground('forest', -12, -46, 80, 31);
  b.ground('meadow', 0, 19, 19, 14);
  b.ground('forest', -12, 34, 10, 30);
  for (const [x, y, w, d] of [[4, 22, 12, 8], [5, 21, 3, 1], [9, 21, 6, 1], [6, 20, 2, 1], [11, 20, 3, 1], [3, 23, 1, 5], [2, 25, 1, 2], [16, 23, 1, 5], [17, 25, 1, 1], [5, 30, 4, 1], [10, 30, 5, 1], [7, 31, 4, 1], [12, 31, 2, 1]] as const) b.ground('water', x, y, w, d);
  // gravel at the west wing's foot
  b.ground('gravel', -13, 16, 12, 1);
  // the entrance plaza wrapping round the lab's front corner, the terrace by the pond
  b.ground('paving', -2, R, 26, 3);
  b.ground('paving', C, -1, 7, R + 1);
  b.ground('paving', 17, 19, 7, 6);
  // the cycle path along the pond, a footpath down to the boardwalk
  b.ground('cobble', -46, 17, 84, 2);
  b.ground('sidewalk', 9, 19, 1, 1);
  // the garden paths south of the pond: along its south shore, a cross walk further down, and three runs south
  b.ground('sidewalk', -12, 32, 36, 1);
  b.ground('sidewalk', -12, 44, 36, 1);
  b.ground('sidewalk', -3, 29, 1, 35);
  b.ground('sidewalk', 9, 33, 1, 31);
  // EV parking under the solar canopies, the access roads and their pavements
  b.ground('asphalt', 23, 0, 15, 17);
  b.ground('asphalt', 24, -4, 14, 3);
  b.ground('sidewalk', 23, -1, 15, 1);
  b.ground('asphalt', 38, -46, 4, 110);
  b.ground('sidewalk', 37, -46, 1, 42);
  b.ground('sidewalk', 37, 19, 1, 45);
  b.ground('sidewalk', 42, -46, 1, 110);
  // the hazmat yard's slab and its service apron
  b.ground('concrete', -13, 19, 15, 10);
  // the service yard between the chemistry building and the tower, the paving under its recessed ground floor
  b.ground('paving', 24, -14, 2, 10);
  b.ground('paving', 14, -3, 10, 3);
  b.ground('paving', 22, -14, 2, 14);
  // a path through the lawns to the south-east
  b.ground('sidewalk', 24, 19, 1, 30);
  b.ground('sidewalk', 25, 30, 12, 1);

  // ── the lab's own building ────────────────────────────────
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });
  b.scenic('lab_building', -12, -13, { w: 11.7, d: 29, variant: 'b' });
  // flower beds along the west wing's foot, between its doors
  for (const [x, w] of [[-13, 3], [-10, 2], [-7, 3], [-3, 2]] as const) b.scenic('lab_flowerbed', x, 16, { w, d: 1, variant: String((x + 13) % 5) });
  b.scenic('lab_building', -0.3, -13, { w: 24.6, d: 12.7, variant: 'a' });
  b.scenic('lab_building', 26, -14, { w: 10, d: 10, variant: 'c' });

  // ── the entrance plaza ────────────────────────────────────
  // a bike pergola under climbers along the plaza, planters and lamps along its east edge,
  // the blue bike-share dock, a little tree in a pot, a bench
  b.scenic('lab_pergola', 18, 2, { w: 5, d: 2, rot: 1, variant: 'bikes' });
  b.scenic('lab_planter', 22, 1, { w: 2, rot: 1 });
  b.scenic('lab_planter', 22, 4, { w: 2, rot: 1 });
  b.scenic('lab_planter', 22, 8, { w: 3, rot: 1 });
  b.scenic('lab_lamp', 22, 0, { variant: 'pole' });
  for (const y of [3, 7]) b.scenic('lab_lamp', 22, y, { variant: 'bollard' });
  b.scenic('lab_lamp', 22, 11, { variant: 'pole' });
  b.scenic('lab_bikeshare', 18, 12, { w: 3 });
  b.scenic('lab_planter', 19, 8, { w: 1, variant: 'pot' });
  b.scenic('lab_bench', 18, 10, { w: 2, variant: 'block' });
  b.scenic('lab_sign', 20, 14, { variant: 'map' });
  b.scenic('lab_bench', 20, 16, { w: 2, variant: 'block' });
  b.scenic('lab_bin', 18, 16);
  b.scenic('lab_bin', 22, 14);
  b.scenic('lab_lamp', 16, 16, { variant: 'pole' });
  // the terrace by the pond: benches, flowering planters, bikes
  for (const x of [2, 7, 12]) b.scenic('lab_bench', x, 15, { w: 2, variant: 'back' });
  b.scenic('lab_planter', 4, 15, { w: 2 });
  b.scenic('lab_planter', 9, 15, { w: 2 });
  b.scenic('lab_bikes', 14, 15, { w: 2 });
  b.scenic('lab_bin', -1, 15);
  b.scenic('lab_lamp', 0, 16, { variant: 'pole' });
  b.scenic('lab_lamp', 10, 16, { variant: 'pole' });
  // the department's banners along the cycle path
  for (const [x, y] of [[-12, 16], [8, 19], [6, 16], [31, 23]] as const) b.scenic('lab_banner', x, y);
  // a strip of flower beds and small trees between the plaza and the car park
  b.scenic('lab_flowerbed', 23, 1, { w: 1, d: 4, variant: '1' });
  b.scenic('lab_tree', 23, 5);
  b.scenic('lab_flowerbed', 23, 6, { w: 1, d: 4, variant: '4' });
  b.scenic('lab_tree', 23, 10);
  b.scenic('lab_flowerbed', 23, 11, { w: 1, d: 5, variant: '0' });

  // ── the reed pond and the boardwalk ───────────────────────
  b.scenic('lab_boardwalk', 9, 20, { w: 4, d: 1, rot: 1 });
  b.scenic('lab_boardwalk', 8, 24, { w: 3, d: 2, variant: 'deck' });
  b.scenic('lab_boardwalk', 11, 24, { w: 6, d: 1 });
  b.scenic('lab_sign', 10, 19, { variant: 'pond' });
  const reeds: [number, number, string][] = [
    [4, 20, 'phrag'], [3, 21, 'typha'], [2, 23, 'phrag'], [2, 27, 'iris'], [3, 28, 'rush'], [5, 30, 'typha'], [6, 31, 'phrag'],
    [13, 31, 'iris'], [15, 30, 'rush'], [16, 29, 'phrag'], [17, 27, 'typha'], [17, 21, 'iris'], [15, 20, 'phrag'], [13, 20, 'rush'],
    [6, 20, 'iris'], [14, 28, 'typha'], [4, 26, 'rush'], [11, 30, 'phrag'], [9, 30, 'typha'],
  ];
  for (const [x, y, v] of reeds) b.scenic('lab_reeds', x, y, { variant: v });
  for (const [x, y] of [[6, 22], [7, 27], [12, 22], [13, 26], [5, 25], [10, 28], [14, 23], [8, 28], [11, 26], [6, 28], [9, 22], [15, 26], [4, 28], [12, 29]] as const) b.scenic('lab_lily', x, y);
  for (const [x, y] of [[2, 22], [18, 24], [16, 31], [1, 26], [3, 29], [17, 23], [14, 21], [4, 21], [8, 31]] as const) if (b.isFree(x, y)) b.scenic('lab_rock', x, y);
  // flower beds crowding the banks
  for (let y = 19; y < 32; y++)
    for (let x = 0; x < 19; x++) {
      if (b.groundAt(x, y) !== 'meadow' || !b.isFree(x, y) || hash(x, y, 61) > 0.62) continue;
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([dx, dy]) => b.groundAt(x + dx, y + dy) === 'water');
      if (wet) b.scenic('lab_flowerbed', x, y, { w: 1, d: 1, variant: String(Math.floor(hash(x, y, 62) * 5)) });
    }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 3) * 20) - 1;
    const y = 19 + Math.floor(hash(i, 2, 3) * 18);
    if (b.groundAt(x, y) === 'meadow') b.decor('lab_meadow', x, y);
  }

  // ── the hazmat yard ───────────────────────────────────────
  b.scenic('lab_fence', -12, 19, { w: 10 });
  b.scenic('lab_fence', -12, 28, { w: 10 });
  b.scenic('lab_fence', -13, 19, { w: 10, rot: 1 });
  b.scenic('lab_fence', -3, 19, { w: 3, rot: 1 });
  b.scenic('lab_fence', -3, 22, { w: 3, rot: 1, variant: 'gate' });
  b.scenic('lab_fence', -3, 25, { w: 3, rot: 1 });
  b.scenic('lab_lntank', -7, 20, { w: 3, d: 2 });
  b.scenic('lab_tank', -11, 20, { w: 3, d: 2 });
  b.scenic('lab_store', -11, 24, { w: 3, d: 2, rot: 1 });
  b.scenic('lab_cylcage', -7, 24, { w: 2 });
  b.scenic('lab_drumstore', -5, 26, { w: 2 });
  b.scenic('lab_ibc', -4, 22);
  b.scenic('lab_ibc', -4, 23);
  b.scenic('lab_spill', -8, 26);
  b.scenic('lab_sign', -2, 21, { variant: 'yard' });
  b.scenic('lab_car', -0.7, 22.4, { w: 1.3, d: 3.2, variant: 'van' });
  // yard clutter: more drums and IBCs, a spill kit by the gate
  b.scenic('lab_drumstore', -10, 27, { w: 2 });
  b.scenic('lab_ibc', -6, 22);
  b.scenic('lab_ibc', -12, 27);
  b.scenic('lab_ibc', 0, 27);
  b.scenic('lab_bin', 1, 27);
  b.scenic('lab_lamp', 1, 24, { variant: 'pole' });
  b.scenic('lab_lamp', 1, 20, { variant: 'bollard' });

  // ── EV parking under the solar canopies ───────────────────
  b.scenic('lab_carport', 24, 0, { w: 13, d: 5 });
  b.scenic('lab_carport', 24, 11, { w: 13, d: 5 });
  for (let i = 0; i < 7; i++) {
    b.decor('lab_decal', 24 + (i * 13) / 7, 0, { variant: i % 2 ? 'bay' : 'ev', w: 13 / 7, d: 5 });
    b.decor('lab_decal', 24 + (i * 13) / 7, 11, { variant: i % 2 ? 'ev' : 'bay', w: 13 / 7, d: 5 });
  }
  b.decor('lab_decal', 29, 6, { variant: 'arrow', rot: 1 });
  b.decor('lab_decal', 34, 10, { variant: 'oil' });
  // a planted island down the aisle: beds and two small trees
  b.scenic('lab_flowerbed', 27, 8, { w: 3, d: 1, variant: '1' });
  b.scenic('lab_tree', 30, 8);
  b.scenic('lab_flowerbed', 31, 8, { w: 3, d: 1, variant: '3' });
  b.scenic('lab_tree', 34, 8);
  b.scenic('lab_flowerbed', 35, 8, { w: 1, d: 1, variant: '0' });
  b.scenic('lab_charger', 37, 6);
  // planted islands: one between the bays with a tree, beds along the canopies' fronts
  b.scenic('lab_flowerbed', 24, 6, { w: 1, d: 4, variant: '3' });
  b.scenic('lab_tree', 25, 8);
  b.scenic('lab_flowerbed', 37, 0, { w: 1, d: 5, variant: '2' });
  b.scenic('lab_tree', 37, 8);
  b.scenic('lab_flowerbed', 37, 11, { w: 1, d: 5, variant: '4' });
  for (const [x, w, v] of [[24, 4, '0'], [29, 3, '2'], [33, 4, '1']] as const) b.scenic('lab_flowerbed', x, 16, { w, d: 1, variant: v });

  // ── the pergola by the pond: benches under climbers, beds round it ──
  b.scenic('lab_pergola', 19, 20, { w: 4, d: 2, variant: 'seats' });
  b.scenic('lab_flowerbed', 19, 23, { w: 4, d: 1, variant: '0' });
  b.scenic('lab_flowerbed', 23, 20, { w: 1, d: 3, variant: '1' });

  // ── more campus beyond: distant blocks in flat fills, inside the painted frame ──
  b.scenic('lab_skyline', -30, -21, { w: 11, d: 9 });
  b.scenic('lab_skyline', 47, 12, { w: 10, d: 12 });

  // ── the gardens south of the pond: beds along the paths, bollards ──
  const path = (x: number, y: number) => b.groundAt(x, y) === 'sidewalk';
  for (let y = 19; y < 62; y++)
    for (let x = -12; x < 38; x++) {
      if ((y < 33 && x < 24) || path(x, y) || !b.isFree(x, y)) continue;
      const g = b.groundAt(x, y) ?? 'grass';
      if (g !== 'grass' && g !== 'forest') continue;
      const edge = path(x - 1, y) || path(x + 1, y) || path(x, y - 1) || path(x, y + 1);
      if (!edge) {
        // island beds inside the compartments, two by two
        if (hash(x >> 1, y >> 1, 74) < 0.2 && (x & 1) === 0 && (y & 1) === 0 && [[1, 0], [0, 1], [1, 1]].every(([dx, dy]) => b.isFree(x + dx, y + dy) && !path(x + dx, y + dy)))
          b.scenic('lab_flowerbed', x, y, { w: 2, d: 2, variant: String(Math.floor(hash(x, y, 75) * 5)) });
        continue;
      }
      const h = hash(x, y, 71);
      if (h < 0.08) b.scenic('lab_lamp', x, y, { variant: 'bollard' });
      else if (h < 0.72) {
        // a bed one or two tiles long, along the path
        const along = path(x, y - 1) || path(x, y + 1);
        const long = hash(x, y, 72) < 0.5 && b.isFree(along ? x + 1 : x, along ? y : y + 1) && !path(along ? x + 1 : x, along ? y : y + 1);
        b.scenic('lab_flowerbed', x, y, { w: along && long ? 2 : 1, d: !along && long ? 2 : 1, variant: String(Math.floor(hash(x, y, 73) * 5)) });
      }
    }
  b.scenic('lab_bench', 2, 33, { w: 2, variant: 'back' });
  b.scenic('lab_bench', 13, 33, { w: 2, variant: 'back' });
  b.scenic('lab_bench', 4, 45, { w: 2, variant: 'block' });
  b.scenic('lab_bin', 15, 33);

  // ── trees: pine and birch forest, mixed garden trees, out to the frame's edge ──
  // The painted frame in tile space: u = x − y in [−37, 39], v = x + y in [−50, 81];
  // tall crowns rise into view from a little below the bottom edge.
  const inFrame = (x: number, y: number) => x - y >= -38 && x - y <= 40 && x + y >= -50 && x + y <= 92;
  const soft = new Set(['grass', 'meadow', 'forest', 'gravel']);
  // depth-sort safety: no tall tree just in front of a big scenic prop with a larger sort key
  const shadowed = (x: number, y: number) =>
    (y >= 16 && x - y >= 5 && x - y <= 28 && x + y < 52) || // in front of the second solar carport
    (y > -5 && x - y >= 28 && x - y <= 51 && x + y < 31) || // in front of the glass tower
    (y >= 21 && x - y >= -6 && x - y <= 3 && x + y < 43) || // in front of the pond pergola
    (x >= 24 && x <= 40 && y >= -15 && y <= 0) || // the service yard between the buildings
    (x >= -1 && x <= 25 && y >= -14 && y < 0) || // inside the chemistry building (its footprint starts at x = -0.3)
    (x >= -13 && x < 0 && y >= -14 && y < 17) || // inside the west wing
    (x >= -1 && x <= 4 && y >= 18 && y <= 33); // keep the view onto the hazmat yard open
  // the buildings' own footprints (the chemistry building's starts at x = -0.3, so isFree misses it)
  const built = (x: number, y: number) => (x >= -1 && x <= 25 && y >= -14 && y < 0) || (x >= -13 && x < 0 && y >= -14 && y < 17) || (x >= 25 && x < 37 && y >= -15 && y < -3);
  const tree = (t: string, x: number, y: number) => {
    if (b.inside(x, y) || built(x, y) || !inFrame(x, y) || shadowed(x, y) || !b.isFree(x, y) || !soft.has(b.groundAt(x, y) ?? 'grass')) return;
    b.scenic(t, x, y);
  };
  const kind = (x: number, y: number, wood: boolean) => {
    const h = hash(x, y, 45);
    if (wood) return h < 0.52 ? 'lab_pine' : h < 0.86 ? 'lab_birch' : 'lab_tree';
    return h < 0.24 ? 'lab_pine' : h < 0.62 ? 'lab_birch' : 'lab_tree';
  };
  // hand-placed: the birches west of the pond, big trees framing the bottom edge, the lawn by the pergola
  for (const [x, y] of [[-1, 36], [2, 35], [3, 38]] as const) tree('lab_birch', x, y);
  for (const [x, y] of [[13, 36], [6, 38], [17, 34], [20, 37], [11, 40], [16, 41], [2, 41], [23, 40], [7, 47]] as const) tree(kind(x, y, false), x, y);
  for (const [x, y] of [[19, 27], [21, 30], [26, 32], [29, 34], [32, 33], [35, 36], [27, 35], [28, 38], [33, 40], [38, 44]] as const) tree(kind(x, y, false), x, y);
  // a dense wood west of the green-roofed wing (the frame's top-left corner)
  for (let y = -14; y < 17; y += 2)
    for (let x = -26; x < -12; x += 2) {
      const jx = x + Math.floor(hash(x, y, 31) * 2);
      const jy = y + Math.floor(hash(x, y, 32) * 2);
      if (hash(x, y, 33) < 0.8) tree(kind(x, y, true), jx, jy);
    }
  // groves everywhere else: the woods to the west and north dense, the gardens in clumps between beds
  for (let y = -46; y < 62; y += 2)
    for (let x = -46; x < 62; x += 2) {
      const wood = x < -12 || y < -14;
      const grove = hash(Math.floor(x / 6), Math.floor(y / 6), 41) < (wood ? 0.66 : 0.5);
      const pr = grove ? (wood ? 0.66 : 0.52) : 0.1;
      if (hash(x, y, 42) >= pr) continue;
      const jx = x + Math.floor(hash(x, y, 43) * 2);
      const jy = y + Math.floor(hash(x, y, 44) * 2);
      tree(kind(jx, jy, wood), jx, jy);
    }
  // shrubs and grasses in drifts along the terrace and the plaza's edges, ferns in the woods
  for (const [x, y, v] of [[-2, 16, 'grass'], [17, 17, 'grass'], [23, 18, 'grass'], [24, 17, 'cornus'], [22, 19, 'ball'], [16, 21, 'grass'], [21, 26, 'cornus'], [25, 28, 'sedge'], [27, 26, 'grass'], [30, 28, 'cornus'], [33, 27, 'grass'], [36, 25, 'sedge'], [18, 26, 'sedge']] as const)
    if (b.isFree(x, y) && b.groundAt(x, y) !== 'cobble' && b.groundAt(x, y) !== 'paving') b.scenic('lab_shrub', x, y, { variant: v });
  for (let y = -46; y < 62; y += 3)
    for (let x = -46; x < 62; x += 3) {
      if (!inFrame(x, y) || hash(x, y, 51) > 0.35) continue;
      const g = b.groundAt(x, y) ?? 'grass';
      if (b.inside(x, y) || built(x, y) || shadowed(x, y) || !b.isFree(x, y) || (g !== 'forest' && g !== 'grass')) continue;
      b.scenic('lab_shrub', x, y, { variant: g === 'forest' ? (hash(x, y, 52) < 0.5 ? 'fern' : 'sedge') : hash(x, y, 52) < 0.5 ? 'ball' : 'grass' });
    }

  // ── street furniture along the path and the road ──────────
  for (const x of [26, 31, 36]) b.scenic('lab_lamp', x, 20, { variant: 'bollard' });
  for (const x of [-14, -8, 3, 18]) b.scenic('lab_lamp', x, 16, { variant: 'bollard' });
  for (let y = 4; y < 40; y += 8) b.scenic('lab_lamp', 42, y, { variant: 'pole' });
  // a planted verge along the far side of the road
  for (const [y, d, v] of [[-3, 3, '4'], [1, 2, '1'], [5, 3, '2'], [9, 2, '0'], [13, 3, '3'], [17, 2, '1']] as const) if (Array.from({ length: d }, (_, j) => b.isFree(43, y + j)).every(Boolean)) b.scenic('lab_flowerbed', 43, y, { w: 1, d, variant: v });
  for (const y of [0, 4, 8, 12, 16]) if (b.isFree(44, y)) b.scenic('lab_tree', 44, y);
  b.scenic('lab_bench', 28, 30, { w: 2, variant: 'back' });
  b.scenic('lab_bench', 33, 30, { w: 2, variant: 'block' });
  b.scenic('lab_bin', 31, 30);

  // ── the flat details of the ground ────────────────────────
  for (let x = -40; x < 38; x += 7) b.decor('lab_decal', x, 17, { variant: 'bike', w: 2 });
  for (let x = -40; x < 38; x += 2) b.decor('lab_decal', x, 17, { variant: 'dash', w: 2, d: 2 });
  for (const [x, y, v] of [[18, 7, 'manhole'], [5, 16, 'drain'], [22, 15, 'manhole'], [-1, 26, 'oil'], [0, 21, 'puddle'], [-6, 27, 'drain'], [33, 2, 'oil'], [29, 14, 'oil'], [26, 8, 'puddle']] as const) b.decor('lab_decal', x, y, { variant: v, w: v === 'drain' ? 3 : 1 });
  b.decor('lab_decal', 38, 17, { variant: 'zebra', w: 4, d: 2 });
  b.decor('lab_decal', 37, 17, { variant: 'tactile', rot: 1, w: 2 });
  for (let i = 0; i < 40; i++) {
    const x = -10 + Math.floor(hash(i, 21) * 50);
    const y = 18 + Math.floor(hash(i, 22) * 30);
    if (b.groundAt(x, y) === 'grass' || b.groundAt(x, y) === 'forest') b.decor('lab_decal', x, y, { variant: hash(i, 23) < 0.7 ? 'leaves' : 'stones' });
  }

  // ── life ──────────────────────────────────────────────────
  b.critters('duck', 4, 26, 11, 4, 4);
  b.critters('duck', 11, 21, 5, 2.5, 2);
  b.critters('lab_heron', 15, 26, 1.5, 3, 1);
  b.critters('lab_dragonfly', 4, 21, 12, 9, 4);
  b.critters('butterfly', 0, 19, 18, 3, 4);
  b.critters('butterfly', 0, 33, 22, 10, 3);
  b.critters('lab_rabbit', 26, 32, 9, 10, 3);
  b.critters('lab_rabbit', -30, 10, 10, 10, 2);
  b.critters('bird', 16, 14, 6, 4, 3);

  // passers-by: two on the cycle path (they turn off the frame), two round the entrance
  // plaza, two strolling the garden paths south of the pond
  b.walkers([[-36, 17.7], [37.5, 17.7], [37.5, 46]], 2, { speed: 0.7 });
  b.walkers([[17.5, 0.4], [21.5, 0.4], [21.5, 15.5], [17.5, 15.5]], 2, { loop: true });
  b.walkers([[-2.5, 32.5], [24.5, 32.5], [24.5, 44.5], [-2.5, 44.5]], 2, { loop: true, speed: 0.45 });
  // the driverless campus shuttle on the road, stopping by the car park
  b.vehicle({ type: 'lab_shuttle', x: 39.3, y: -50, axis: 'y', length: 110, w: 3, speed: 1.3, stops: [61], dwell: 6, endWait: 10 });
}

// lived-in lab details on free tiles (none of them blocks a station or the aisle)
b.prop('lab_cart', 6, 3);
b.prop('lab_waste', 5, 8);
b.prop('lab_freezer', 15, 3);
b.prop('lab_gas', 15, 5);
b.prop('lab_fridge', 14, 11);
b.prop('lab_sink', 9, 13);
b.prop('lab_board', 8, 11);
b.prop('lab_spill', 3, 13);
b.prop('lab_desk', 12, 3);
b.prop('lab_glovebox', 9, 8);
b.prop('lab_rotavap', 6, 8);
b.prop('lab_boxes', 0, 7);
// floor tape round the hazard storage, a floor drain by the sink (flat: nothing to trip over)
b.prop('lab_decal', 8, 8, { variant: 'tape' });
b.prop('lab_decal', 15, 5, { variant: 'tape' });
b.prop('lab_decal', 0, 13, { variant: 'tape', w: 2 });
b.prop('lab_decal', 11, 12, { variant: 'floordrain' });
b.prop('lab_decal', 12, 1, { variant: 'scuff' });
b.prop('lab_decal', 4, 12, { variant: 'spill' });
b.prop('lab_bin', 15, 11);

labCampus(b);
// the order places the clock clear of the fume hood ducts and the pressure monitor above the safety shower
decorateWalls(b, ['lab_periodic', 'lab_beacon', 'lab_clock', 'lab_ppe', 'lab_fire', 'lab_drying', 'lab_exit', 'lab_pressure']);

export const chemlab = b.build({
  name: 'Chemical Lab',
  description: 'A bright wet lab: fume hoods, three benches, an analytical station, reagent storage and a safety area.',
  tagline: 'Research, mix and make discoveries.',
  emoji: '🧪',
  theme: {
    floorA: '#e9eef0',
    floorB: '#dfe6e9',
    floorDetail: '#c9d3d8',
    wall: '#cfe9e3',
    wallTrim: '#4fae9f',
    slab: '#7d8e94',
    accent: '#4fae9f',
    accent2: '#f3c843',
    ui: '#f2b98a',
    sky: ['#1c2a33', '#5fa39a'],
  },
  outfitCategory: 'chemlab',
  defaultOutfitId: 'chemlab.researcher',
  environment: { floor: 'lab', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Titrate sample B-12',
    'Run spectrometry',
    'Prepare reagent stock',
    'Label specimen rack',
    'Clean fume hood',
    'Log safety check',
    'Mix buffer solution',
    'Centrifuge batch 7',
  ],
});

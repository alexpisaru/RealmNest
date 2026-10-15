import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('factory', 18, 14);

b.wall('pipes', 'ne', 0, 8);
b.wall('sign', 'ne', 9, 1);
b.wall('window', 'ne', 11, 3);
b.wall('shutter', 'ne', 15, 2);
b.wall('pipes', 'nw', 0, 6);
b.wall('window', 'nw', 7, 3);
b.wall('sign', 'nw', 11, 1);

b.patch('lane', 0, 6, 18, 1);
b.patch('hazard', 1, 4, 12, 1);
b.patch('hazard', 1, 9, 9, 1);

b.station('machine', 2, 2, 'MACHINE', 'Press line', { variant: 'press', verb: 'pressing' });
b.station('machine', 6, 2, 'MACHINE', 'CNC cell', { variant: 'cnc', verb: 'machining' });
b.station('machine', 10, 2, 'MACHINE', 'Curing oven', { variant: 'oven', verb: 'curing' });
b.station('robotArm', 13, 5, 'MACHINE', 'Robotic arm', { verb: 'supervising the arm' });
b.station('conveyor', 2, 7, 'MACHINE', 'Conveyor', { w: 8, slots: 3, verb: 'inspecting' });
b.station('console', 16, 2, 'CONTROL_PANEL', 'Control station', { rot: 1, verb: 'monitoring' });
b.station('workbench', 6, 11, 'WORKSTATION', 'Workbench', { verb: 'repairing' });
b.station('rack', 0, 9, 'STORAGE', 'Storage racks', { rot: 1, variant: 'boxes' });

b.station('vending', 16, 9, 'COFFEE', 'Vending machine', { rot: 1 });
b.station('watercooler', 16, 12, 'COFFEE', 'Water cooler', { rot: 1 });
b.seats('bench', 12, 12, 'BREAK', 'Break bench', { w: 3 });

b.ring('MEETING', 12, 9, 'Shift huddle');

for (const [x, y] of [[16, 6], [17, 6], [17, 7]]) b.prop('crate', x, y);
b.prop('barrel', 0, 6);
b.prop('barrel', 0, 7);
// the shop floor's clutter, on tiles nobody needs
b.prop('fac_lockers', 16, 10, { rot: 1 });
b.prop('fac_lockers', 16, 11, { rot: 1 });
b.prop('fac_pallettruck', 0, 0);
b.prop('fac_bin', 17, 1);
b.prop('fac_drill', 9, 11);
b.prop('fac_trolley', 0, 4);
b.prop('fac_bin', 17, 13);
b.prop('fac_drumtable', 15, 12);
b.decor('fac_decal', 15, 0, { variant: 'grate', w: 2, d: 1 });
b.decor('fac_decal', 9, 5, { variant: 'drain' });
b.decor('fac_decal', 15, 4, { variant: 'oil' });
b.decor('fac_decal', 4, 12, { variant: 'oil' });
b.point('DECORATIVE', 9.5, 0.5, 'ne', 'Safety sign');
b.point('STORAGE', 15.5, 7.5, 'se', 'Crate stack');

b.spawn(15, 0);
b.spawn(16, 0);
b.node('floor', 8, 6);

// ── the Albion Works ─────────────────────────────────────────
// The press shop is one hall of a red-brick mill estate on a canal. Behind its
// back walls, across narrow alleys: the north-light weaving shed with its zig-zag
// parapet (docks and lorries on its yard end) and the three-storey spinning mill
// with its clock tower. In front: the cobbled wharf with the boiler house and the
// chimney stack, a narrowboat unloading coal, a swing bridge over the canal; across
// the water a towpath, waste ground gone to buddleia and birch, a derelict shed and
// a little workshop. To the east the yard: the water tower, a rail spur with freight
// wagons on the ballast, pallets, gas cylinders, a skip, a forklift. The estate's
// roofs and a gasholder run on to the frame's edge.
function albionEstate(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  // wide props are cut into depth slices at tile edges; slices that land on fractional
  // frame pixels drop out of the CPU composite (tools/scene.ts), so every scenic
  // placement is snapped to 1/32 of a tile (2 px across, 1 px down)
  const q = (v: number) => Math.round(v * 32) / 32;
  const hash = (a: number, c: number) => {
    let h = Math.imul(a * 374761393 + c * 668265263, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const place = b.scenic.bind(b);
  b.scenic = (type, x, y, o = {}) => place(type, q(x), q(y), { ...o, ...(o.w !== undefined ? { w: q(o.w) } : {}), ...(o.d !== undefined ? { d: q(o.d) } : {}) });
  // every standing scenic prop's footprint, so the yards' stock is laid out with air between things
  // (the builder's own tile check misses props at fractional positions)
  const taken: [number, number, number, number][] = [];
  const GROUND = new Set(['fac_rail', 'fac_decal', 'fac_roofs', 'fac_quay', 'lowWall']);
  const snapped = b.scenic.bind(b);
  b.scenic = (type, x, y, o = {}) => {
    const pl = snapped(type, x, y, o);
    if (!GROUND.has(type)) {
      const [w, d] = pl.rot ? [pl.d, pl.w] : [pl.w, pl.d];
      taken.push([pl.x, pl.y, pl.x + w, pl.y + d]);
    }
    return pl;
  };
  /** true if a w × d footprint at (x, y) keeps `gap` tiles clear of every standing prop placed so far */
  const fits = (x: number, y: number, w: number, d: number, gap = 0.25) => taken.every(([x0, y0, x1, y1]) => x + w + gap <= x0 || x >= x1 + gap || y + d + gap <= y0 || y >= y1 + gap);
  b.setScene({ ext: 14, outer: 'meadow', frontWalls: true, light: { tint: '#ffcf90', strength: 0.32 }, grade: { saturation: 1.04, tone: [0, 0.075, 0.16, 0.26, 0.37, 0.5, 0.64, 0.775, 0.885, 0.955, 1] } });
  // ground: the yards, the alleys, the wharf, the canal and its towpath, the rail ballast
  b.ground('asphalt', -60, -60, 140, 80);
  // the back lots under the distant roofs (cheap ground: it barely shows between the blocks)
  b.ground('roof', -60, -60, 140, 44);
  b.ground('roof', -60, -16, 45, 30);
  b.ground('roof', 34, -16, 46, 27.6);
  b.ground('cobble', -3, -3, C + 6, 3);
  b.ground('cobble', -3, 0, 3, R);
  b.ground('cobble', -16, R, 80, 6);
  b.ground('sidewalk', -1, R, C + 2, 1);
  b.ground('sidewalk', C, -1, 1, R + 2);
  b.ground('sidewalk', 21, -15, 10, 13);
  b.ground('gravel', 19, 11.6, 60, 2);
  b.ground('water', -60, 20, 140, 4);
  b.ground('paving', -60, 24, 140, 3);
  b.ground('cobble', 10, 24, 2, 40);
  // (the press shop keeps its own slab)
  b.ground('concrete', 0, 0, C, R);

  // cut front walls of the press shop
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // the works: the weaving shed behind the ne wall, the mill behind the nw wall
  b.scenic('fac_shed', -2.75, -15, { w: 23.75, d: 12.25 });
  b.scenic('fac_mill', -12.75, -3, { w: 11, d: 16 });
  b.scenic('fac_boiler', -10, 14, { w: 7.25, d: 4 });
  b.scenic('fac_chimney', -2.6, 14.6, { w: 1.6, d: 1.6 });
  b.scenic('fac_coal', -2.4, 17, { w: 2, d: 1.4 });
  // Hilson's lorries backed onto the shed's docks (the nearest one comes and goes: see below)
  b.scenic('fac_lorry', 22.4, -9.2, { w: 8.6, d: 1.3, color: '#c43028' });
  b.scenic('fac_lorry', 22.4, -12.8, { w: 8.6, d: 1.3, color: '#c43028' });

  // the canal: the wharf's coping (a gap for the bridge), the towpath's lip, the narrowboat
  for (const x of [-16, -10, -4, 2]) b.scenic('fac_quay', x, 19, { w: 6, variant: 'near' });
  b.scenic('fac_quay', 8, 19, { w: 2, variant: 'near' });
  for (let x = 12; x < 60; x += 6) b.scenic('fac_quay', x, 19, { w: 6, variant: 'near' });
  for (const x of [-16, -10, -4, 2]) b.scenic('fac_quay', x, 24, { w: 6, variant: 'far' });
  b.scenic('fac_quay', 8, 24, { w: 2, variant: 'far' });
  for (let x = 12; x < 60; x += 6) b.scenic('fac_quay', x, 24, { w: 6, variant: 'far' });
  b.scenic('fac_bridge', 10, 18.6, { w: 2, d: 6 });
  b.scenic('fac_flotsam', 6, 22.4, { variant: 'trolley' });
  b.scenic('fac_flotsam', 16.6, 21.9, { variant: 'tyre' });
  b.scenic('fac_flotsam', 23.5, 22.5, { variant: 'bottle' });
  b.scenic('fac_flotsam', -7, 22.2, { variant: 'bottle' });
  b.scenic('fac_crane', 3.2, 18, { w: 1.2, d: 3.6 });
  for (const x of [-14, -7, -0.5, 9, 14.5, 20.6, 25.5, 31]) b.scenic('fac_bollard', x, 18.9);
  b.scenic('fac_lifebuoy', 17.9, 18.4);
  b.scenic('fac_lifebuoy', -12, 18.4);
  // the wharf's clutter: coal sacks by the crane, a sack truck, timber, a cable drum, drums and pallets
  b.scenic('fac_sacks', 5.2, 17.6);
  b.scenic('fac_sacks', 1.4, 15.4);
  b.scenic('fac_cart', 2.6, 15.3);
  b.scenic('fac_timber', 13, 15.4, { w: 2, d: 1 });
  b.scenic('fac_reel', 16, 15.3);
  b.scenic('fac_drums', 17.2, 15.3);
  b.scenic('fac_pallets', 7.6, 15.4);
  b.scenic('fac_pallets', 8.6, 15.4);
  b.scenic('fac_ibc', 21.5, 15.4);
  b.scenic('fac_timber', 23, 17.6, { w: 2, d: 1 });
  b.scenic('fac_sacks', -6, 18.2);
  for (const [x, y] of [[7.4, 18.2], [19.4, 18.2]] as const) b.scenic('fac_lamp', x, y);
  b.scenic('fac_drums', 12.4, 17.6);
  b.scenic('fac_pallets', 21.4, 17.6, { variant: 'stack' });
  b.scenic('fac_cylinders', 15.7, 18.1, { w: 2, d: 1 });
  b.scenic('fac_bike', 10.4, 15.2);
  b.scenic('fac_bike', 11.6, 15.3);

  // the far bank: the towpath fence, waste ground gone to buddleia and birch, a ruin, a workshop
  for (const x of [-16, -12, -8, -4, 0, 4]) b.scenic('fac_fence', x, 26.4, { w: 4 });
  b.scenic('fac_fence', 8, 26.4, { w: 2 });
  for (let x = 12; x < 60; x += 4) b.scenic('fac_fence', x, 26.4, { w: 4 });
  b.scenic('fac_derelict', 2, 28.5, { w: 7, d: 5 });
  b.scenic('fac_unit', 13, 28.2, { w: 4, d: 3, color: '#3e66a8' });
  b.scenic('fac_car', 12.2, 31.7, { w: 2, d: 1 });
  b.scenic('fac_tyres', 9.2, 34);
  b.scenic('fac_tyres', 17.4, 31.6);
  for (const [x, y] of [[0.5, 34], [12.9, 36.2], [1, 26.9]] as const) b.scenic('fac_buddleia', x, y);
  for (const [x, y] of [[-3, 27.6], [9.2, 28], [17.6, 28.4], [-6, 31], [20.5, 30.5], [-9, 27.8], [22, 27.6]] as const) b.scenic('fac_tree', x, y);
  for (const [x, y] of [[-1.5, 30.5], [8.8, 36.8], [23.5, 32], [6, 37.5]] as const) b.scenic('fac_birch', x, y);
  for (const [x, y] of [[14, 24.1], [19, 24.1], [-2, 24.1], [27, 24.1]] as const) b.scenic('fac_reeds', x, y);
  // further south: a fenced scrapyard, lock-ups, thickets of buddleia and birch, then more of the estate
  for (const x of [14.5, 18.5]) b.scenic('fac_fence', x, 32.6, { w: 4 });
  for (const x of [14.5, 18.5]) b.scenic('fac_fence', x, 40.6, { w: 4 });
  b.scenic('fac_fence', 14, 33, { w: 4, rot: 1 });
  b.scenic('fac_fence', 14, 37, { w: 4, rot: 1 });
  b.scenic('fac_fence', 22.5, 33, { w: 4, rot: 1 });
  b.scenic('fac_fence', 22.5, 37, { w: 4, rot: 1 });
  // the fenced stockyard (clear ground inside the fences' footprints: x 15–22.5, y 33.6–40.6): pipe
  // stacks on bearers, the skip, scrap and stock in rows with walkways between, nothing against the wire
  // (the tall pieces in the back row, the low pipe stacks in front of them)
  b.scenic('fac_skip', 15.2, 33.8, { w: 2.4, d: 1.2 });
  b.scenic('fac_drums', 18, 33.9);
  b.scenic('fac_tyres', 19.3, 33.9);
  b.scenic('fac_ibc', 20.7, 33.9);
  b.scenic('fac_pipes', 15.2, 35.4, { w: 3, d: 1.2, variant: 'black' });
  b.scenic('fac_pipes', 18.6, 35.5, { w: 3, d: 1, variant: 'grey' });
  b.scenic('fac_clutter', 15.2, 37, { w: 2.2, d: 1.1, variant: 'scrap' });
  b.scenic('fac_scrap', 17.8, 37, { w: 2, d: 1.6 });
  b.scenic('fac_clutter', 20.1, 37.1, { w: 2.1, d: 1.1, variant: 'yard' });
  b.scenic('fac_pipes', 15.2, 39, { w: 3, d: 1.2, variant: 'black' });
  b.scenic('fac_clutter', 18.6, 39.1, { w: 2.6, d: 1.1, variant: 'scrap' });
  // a second compound south of it (clear ground y 41.6–45.6): scrap, skips, drums, pipe stacks on bare dirt
  for (const x of [14.5, 18.5]) b.scenic('fac_fence', x, 45.6, { w: 4 });
  b.scenic('fac_fence', 14, 41, { w: 4, rot: 1 });
  b.scenic('fac_fence', 22.5, 41, { w: 4, rot: 1 });
  b.ground('dirt', 14.6, 33.2, 7.8, 12.2);
  for (const y of [41.8, 43.1, 44.4])
    for (const x of [15.2, 17.6, 20]) b.scenic('fac_clutter', x, y, { w: 2.1, d: 1, variant: hash(Math.round(x), Math.round(y)) < 0.5 ? 'scrap' : 'yard' });
  b.scenic('fac_unit', 1.5, 38.5, { w: 4, d: 3 });
  b.scenic('fac_unit', 6, 41.5, { w: 3, d: 3 });
  b.scenic('fac_unit', 12.4, 46.9, { w: 4, d: 3 });
  for (const [x, y] of [[7, 36.4], [12.6, 41], [25.4, 38.6], [-2, 31.6], [24.4, 42.6]] as const) b.scenic('fac_buddleia', x, y);
  for (const [x, y] of [[5.5, 35.6], [9.5, 39.4], [24.5, 34], [-4.5, 29.5], [18.8, 49.4], [17, 47.5]] as const) b.scenic('fac_tree', x, y);
  for (const [x, y] of [[3, 35.2], [8.6, 44], [25.6, 36.2], [-3.5, 28.6], [0.2, 33.2], [24.4, 45.2], [15, 50.4]] as const) b.scenic('fac_birch', x, y);
  for (const [x, y] of [[4, 48], [16, 51], [28, 41], [27, 28.5], [39, 26]] as const) b.scenic('fac_roofs', x, y, { w: 12, d: 12 });
  // the waste ground gone wild: thickets of buddleia, birch and sycamore wherever nothing stands
  for (let y = 27.5; y < 50; y += 1.5)
    for (let x = -22; x < 30; x += 1.5) {
      const jx = x + (hash(Math.round(x * 2), Math.round(y * 2) + 7) - 0.5) * 0.9;
      const jy = y + (hash(Math.round(y * 2), Math.round(x * 2) + 11) - 0.5) * 0.9;
      if (jx > 9.3 && jx < 12.8) continue; // the lane
      if (jx > 13.6 && jx < 23 && jy > 32.2 && jy < 46.2) continue; // the stockyards
      const r = hash(Math.round(jx * 4), Math.round(jy * 4) + 3);
      if (r > 0.42) continue;
      let free = true;
      for (let dy = -1; dy <= 1 && free; dy++) for (let dx = -1; dx <= 1; dx++) if (!b.isFree(Math.floor(jx) + dx, Math.floor(jy) + dy)) free = false;
      if (!free || !fits(jx, jy, 1, 1, 0.1)) continue;
      b.scenic(r < 0.14 ? 'fac_buddleia' : r < 0.26 ? 'fac_birch' : 'fac_tree', jx, jy);
    }
  // waste ground along the wharf's west end
  for (const [x, y] of [[-14, 15.2], [-15, 17.5]] as const) b.scenic('fac_tree', x, y);
  b.scenic('fac_buddleia', -11.2, 18.1);

  // the yard: the water tower, the rail spur, pallets, gas, the skip, the car park, the gatehouse. Every
  // piece stands on its own patch with a walkway round it; the stock filling the free patches goes in last
  b.scenic('fac_watertower', 23.5, 2, { w: 3, d: 3 });
  for (let x = 20; x < 84; x += 2) b.scenic('fac_rail', x, 11.8, { w: 2, d: 1.6 });
  b.scenic('fac_buffer', 19.4, 11.8, { w: 1, d: 1.6 });
  b.scenic('fac_forklift', 31.6, 4.2, { w: 1, d: 2 });
  // containers and pipe stacks at the yard's east end
  b.scenic('fac_container', 38.4, 4.8, { w: 6, d: 1.5, variant: 'green' });
  b.scenic('fac_container', 37, 7.4, { w: 6, d: 1.5, variant: 'red' });
  b.scenic('fac_container', 32.4, 9.7, { w: 3, d: 1.4, variant: 'blue' });
  b.scenic('fac_pipes', 27, 7.4, { w: 3, d: 1, variant: 'grey' });
  // crates and pallets by the water tower's legs, bulk bags, the gas cage, the skip, a scrap heap
  for (const [x, y, v] of [[23.3, 5.2, 'stack'], [24.6, 5.2, 'sacks'], [26.6, 5.2, 'stack'], [27.9, 5.2, 'bricks']] as const) b.scenic('fac_pallets', x, y, { variant: v });
  for (const [x, y] of [[22.1, 7.4], [23.4, 7], [32.3, 8.3], [33.6, 8.3]] as const) b.scenic('fac_bags', x, y);
  b.scenic('fac_cylinders', 19, 5, { w: 2, d: 1 });
  b.scenic('fac_skip', 19.3, 8, { w: 2.4, d: 1.2 });
  b.scenic('fac_scrap', 24.7, 7.7, { w: 2, d: 1.2 });
  for (const [x, y] of [[19, 2], [20.2, 2], [19, 3.3], [30.5, 7], [31.8, 7], [26.9, 0.4]] as const) b.scenic('fac_pallets', x, y);
  for (const [x, y] of [[19, 9.7], [23.3, 8.5]] as const) b.scenic('fac_ibc', x, y);
  for (const [x, y] of [[20.3, 9.8], [29.3, -3.7], [31.9, -3.6]] as const) b.scenic('fac_drums', x, y);
  b.scenic('fac_hut', 34, 6.4, { w: 2, d: 1.6 });
  // the car park: two staff cars and the works van in their bays, the estate's signboard
  b.scenic('fac_parked', 22.9, 9.95, { w: 2, d: 1.1, color: '#c8382a' });
  b.scenic('fac_parked', 25.6, 9.95, { w: 2, d: 1.1, color: '#2a5aa8' });
  b.scenic('fac_van', 29.4, 9.4, { w: 2, d: 1 });
  b.scenic('fac_sign', 36.4, 9.4, { w: 3, d: 1 });
  // the yard's stock: pallets of goods, crates, bulk bags, totes, pipe stacks, gas
  b.scenic('fac_clutter', 27.6, 1.7, { w: 2.8, d: 1.3, variant: 'yard' });
  b.scenic('fac_clutter', 32.6, 1.6, { w: 3.6, d: 1.9, variant: 'yard' });
  b.scenic('fac_clutter', 34.2, 4.3, { w: 3.6, d: 1.3, variant: 'scrap' });
  b.scenic('fac_clutter', 36.6, 0.3, { w: 3.6, d: 1.4, variant: 'yard' });
  b.scenic('fac_clutter', 22.6, -0.7, { w: 3.2, d: 1.2, variant: 'yard' });
  b.scenic('fac_clutter', 24, -3.9, { w: 5, d: 1.1, variant: 'yard' });
  b.scenic('fac_clutter', 26.4, -11.3, { w: 3.6, d: 1.1, variant: 'yard' });
  b.scenic('fac_clutter', 27.6, 3.4, { w: 2.8, d: 1.2, variant: 'yard' });
  b.scenic('fac_clutter', 23, -7.7, { w: 4, d: 1, variant: 'yard' });
  for (const [x, y] of [[29.6, 5.2], [39.6, 2.2], [30.6, -3.8], [32, 0.2], [-13.5, 15.4]] as const) b.scenic('fac_lamp', x, y);
  // and stock stacked on every free patch of the yard, clear of the gatehouse loop, the spur and its neighbours
  const onLoop = (x: number, y: number, w: number, d: number) =>
    (x < 31.8 && x + w > 30.2 && y < 7.4 && y + d > -2.2) ||
    (x < 22.4 && x + w > 20.8 && y < 7.4 && y + d > -2.2) ||
    (x < 31.8 && x + w > 20.8 && ((y < -0.6 && y + d > -2.2) || (y < 7.4 && y + d > 5.8)));
  for (let y = -1; y < 10.4; y += 1.25)
    for (let x = 19; x < 40; x += 2.25) {
      if (onLoop(x, y, 2, 1.1) || hash(Math.round(x * 4), Math.round(y * 4) + 5) > 0.75) continue;
      if (fits(x, y, 2, 1.1, 0.25)) b.scenic('fac_clutter', x, y, { w: 2, d: 1.1, variant: hash(Math.round(x), Math.round(y * 3)) < 0.3 ? 'scrap' : 'yard' });
    }
  b.scenic('fac_clutter', 18.2, 15.1, { w: 2.6, d: 0.9, variant: 'wharf' });
  b.scenic('fac_clutter', 4, 15.1, { w: 3.4, d: 0.9, variant: 'wharf' });
  b.scenic('fac_clutter', 0.2, 17.6, { w: 2.8, d: 1, variant: 'wharf' });
  b.scenic('fac_clutter', 13.5, 17.6, { w: 1.6, d: 1, variant: 'wharf' });
  b.scenic('fac_clutter', 25.2, 17.6, { w: 3, d: 1, variant: 'wharf' });
  b.scenic('fac_clutter', 28.6, 17.6, { w: 3, d: 1, variant: 'yard' });
  // a siding along the wharf with wagons standing on it
  for (let x = 24; x < 52; x += 2) b.scenic('fac_rail', x, 14.2, { w: 2, d: 1.6 });
  b.scenic('fac_buffer', 23.4, 14.2, { w: 1, d: 1.6 });
  for (const [x, v] of [[25.5, 'van'], [29.90625, 'coil'], [34.3125, 'open'], [38.71875, 'tank'], [43.125, 'open']] as const) b.scenic('fac_wagon', x, 14.4, { w: 4.4, d: 1.2, variant: v });

  // the estate beyond, to the frame's edge: blocks of roofs on a 12-tile grid, a gasholder,
  // the general stores at the wharf's west end
  for (const [x, y] of [
    [-38, -39], [-26, -39], [-14, -39], [-2, -39], [10, -39], [22, -39], [34, -39],
    [-38, -27], [-26, -27], [-14, -27], [-2, -27], [10, -27], [22, -27], [34, -27],
    [-38, -15], [-14.5, -15.5], [34, -15], [46, -15],
    [-38, -3], [-25, -3], [46, -3],
    [-38, 9],
  ] as const)
    b.scenic('fac_roofs', x, y, { w: 12, d: 12 });
  // the east end of the wharf runs in under a last block, short of the rail and the canal
  b.scenic('fac_roofs', 46, 14, { w: 12, d: 5 });
  b.scenic('fac_gasholder', -26, -13.5, { w: 6, d: 6 });
  // round the gasholder: a narrow block of sheds, its yard of stock and scrap
  b.scenic('fac_roofs', -20, -15, { w: 5.5, d: 12 });
  b.scenic('fac_clutter', -25.6, -7.2, { w: 5, d: 1.3, variant: 'yard' });
  b.scenic('fac_clutter', -25.6, -5.4, { w: 5, d: 1.9, variant: 'scrap' });
  b.scenic('fac_boiler', -24, 9.4, { w: 7.25, d: 4, variant: 'stores' });

  // flat details: puddles, oil, drains, painted markings, weeds, coal dust, litter, feathers
  for (const [x, y, v] of [
    [2, 15.4, 'drain'], [7, 15.4, 'drain'], [12, 15.4, 'drain'], [16, 15.4, 'drain'], [19.2, 4, 'drain'], [19.2, 11, 'drain'],
    [5, 16.5, 'manhole'], [14, 17, 'manhole'], [24, 6, 'manhole'], [29, 3, 'manhole'], [22, -1.5, 'grate'],
    [-0.5, 18.2, 'coal'], [1.5, 18.6, 'coal'], [3.5, 18.8, 'coal'], [-3.5, 18.6, 'coal'],
    [21, 6.8, 'oil'], [25.5, 4.4, 'oil'], [29, 6, 'oil'], [23, -2.2, 'oil'], [27.5, -3, 'tyres'], [24, 7, 'tyres'],
    [6, 17.2, 'puddle'], [-6, 18.8, 'puddle'], [18.5, 16.2, 'puddle'], [26, 9, 'puddle'], [33, 4.2, 'puddle'], [12, 30.5, 'puddle'],
    [9, 15.6, 'weeds'], [17, 15.2, 'weeds'], [-1, 16.5, 'weeds'], [19.5, 7.2, 'weeds'], [28.5, 11, 'weeds'], [11, 26, 'weeds'],
    [8, 18.4, 'feathers'], [15, 16.4, 'feathers'], [-8, 17.6, 'litter'], [22.5, 9.8, 'litter'], [16, 25.5, 'litter'], [4, 25.6, 'litter'],
    [7.5, 31.8, 'bricks'], [-2, 33, 'bricks'], [21, 34, 'bricks'], [31, 2, 'arrow'], [26, 2.6, 'slow'],
  ] as const)
    b.decor('fac_decal', x, y, { variant: v });
  b.decor('fac_decal', 29, 9, { variant: 'bay', w: 3, d: 2 });
  for (const x of [22, 25, 32]) b.decor('fac_decal', x, 9.6, { variant: 'bay', w: 3, d: 1.8 });
  for (let y = 0; y < 12; y += 2) b.decor('fac_decal', 18.9, y, { variant: 'walk', w: 1, d: 2 });
  b.decor('fac_decal', 22.6, -7.4, { variant: 'hatch', w: 2, d: 1 });
  b.decor('fac_decal', 22.6, -11, { variant: 'hatch', w: 2, d: 1 });
  // the yard's tarmac: oil, puddles, tyre marks, covers wherever nothing stands
  const YARD_DECALS = ['oil', 'oil', 'puddle', 'tyres', 'manhole', 'drain', 'litter', 'oil'];
  for (let y = -2; y < 11; y++)
    for (let x = 19; x < 40; x++) if (hash(x * 3, y * 5 + 1) < 0.22) b.decor('fac_decal', x, y, { variant: YARD_DECALS[Math.floor(hash(y, x * 7) * YARD_DECALS.length)] });
  for (let y = 16; y < 19; y++)
    for (let x = -15; x < 40; x++) if (hash(x, y) < 0.05) b.decor('fac_decal', x, y, { variant: hash(y, x) < 0.5 ? 'weeds' : 'feathers' });

  // life: pigeons and gulls on the wharf, a cat by the boiler house, ducks on the canal, a rat by the skip
  b.critters('pigeon', 4, 15.2, 12, 3, 7);
  b.critters('pigeon', 22, 3, 6, 4, 3);
  b.critters('fac_gull', 13, 16, 8, 3, 3);
  b.critters('fac_gull', -8, 18.2, 6, 1.4, 1);
  b.critters('cat', -1.2, 18.4, 1.4, 0.8, 1);
  b.critters('duck', 13, 20.6, 16, 3, 4);
  b.critters('fac_rat', 21, 9.6, 3, 1, 1);

  // things that move: a Hilson lorry reversing onto dock 1 and pulling away east, the trip working
  // the spur to its buffer (a shunter at each end, so a cab always leads), the coal boat coming up
  // the canal to unload at the crane, bow first both ways (under the footbridge)
  b.vehicle({ type: 'fac_lorry', variant: 'blue', x: 22.4, y: -5.6, axis: 'x', length: 25, w: 8.6, d: 1.3, speed: 1.4, endWait: 16 });
  b.vehicle({ type: 'fac_train', x: 21, y: 12, axis: 'x', length: 60, w: 27.2, d: 1.2, speed: 1.2, endWait: 18, phase: 20 });
  b.vehicle({ type: 'fac_barge', variant: 'moving', backVariant: 'moving-rev', x: -24, y: 20.3, axis: 'x', length: 96, w: 8.6, d: 1.4, speed: 0.7, stops: [24.6], dwell: 30, endWait: 6, phase: 30 });
  // passers-by: along the wharf, the towpath, the lane south from the canal, round the yard
  b.walkers([[0.3, 16.95], [45.5, 16.95]], 2);
  b.walkers([[-20, 25.6], [56, 25.6]], 2, { speed: 0.5 });
  b.walkers([[11, 27.2], [11, 47.3]], 1);
  b.walkers([[21.6, -1.4], [31, -1.4], [31, 6.6], [21.6, 6.6]], 1, { loop: true });
}

albionEstate(b);
decorateWalls(b, ['fac_fusebox', 'fac_notice', 'fac_firepoint', 'fac_fan', 'fac_toolboard', 'fac_firstaid']);

export const factory = b.build({
  name: 'Factory',
  description: 'A compact production floor: presses, a robotic arm, a long conveyor, a control station and a break corner.',
  tagline: 'Design, produce and optimize.',
  emoji: '🏭',
  theme: {
    floorA: '#a69a8b',
    floorB: '#a0947f',
    floorDetail: '#8d8274',
    wall: '#4b5568',
    wallTrim: '#f2a03d',
    slab: '#3a3f4c',
    accent: '#f2a03d',
    accent2: '#5b8def',
    ui: '#f2b98a',
    sky: ['#1d2233', '#b0603a'],
  },
  outfitCategory: 'factory',
  defaultOutfitId: 'factory.operator',
  environment: { floor: 'concrete', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Calibrate press line',
    'Inspect batch #4471',
    'Swap CNC tooling',
    'QA spot check',
    'Restock raw material',
    'Run maintenance cycle',
    'Log shift throughput',
    'Clear jam on belt',
  ],
});

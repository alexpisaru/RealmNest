import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('datacenter', 16, 14);

b.wall('statusboard', 'ne', 1, 3);
b.wall('cabletray', 'ne', 5, 7);
b.wall('door', 'ne', 13, 1, { variant: 'secure' });
b.wall('statusboard', 'nw', 2, 3);
b.wall('cabletray', 'nw', 6, 6);

b.patch('grate', 2, 4, 10, 2);
b.patch('grate', 2, 7, 10, 2);

b.station('servers', 2, 3, 'SERVER', 'Rack row A', { verb: 'hot-swapping drives' });
b.station('servers', 8, 3, 'SERVER', 'Rack row C', { verb: 'patching cables' });
b.station('servers', 2, 6, 'SERVER', 'Rack row B', { verb: 'flashing firmware' });
b.station('servers', 8, 6, 'SERVER', 'Rack row D', { verb: 'tracing a fault' });
b.station('cooling', 14, 2, 'MACHINE', 'Cooling unit', { verb: 'tuning airflow' });
b.station('netcab', 0, 4, 'SERVER', 'Network core', { rot: 1, verb: 'rerouting' });
b.station('desk', 2, 10, 'CONTROL_PANEL', 'Monitoring 1', { variant: 'dual', verb: 'monitoring' });
b.station('desk', 5, 10, 'CONTROL_PANEL', 'Monitoring 2', { variant: 'dual', verb: 'monitoring' });
b.station('cart', 12, 9, 'STORAGE', 'Maintenance cart');

b.station('counter', 12, 11, 'COFFEE', 'Coffee nook', { slots: 2 });
b.seats('bench', 14, 7, 'BREAK', 'Bench', { rot: 1 });
b.ring('MEETING', 9, 11, 'Incident huddle');
b.prop('plant', 15, 13);
b.prop('plant', 0, 0);
b.point('DECORATIVE', 2.5, 0.5, 'ne', 'Status board');

b.spawn(13, 0);
b.spawn(13, 1);
b.node('cold-aisle', 7, 5);

// lived-in details of the hall: UPS cabinets under the cable tray, a tape library,
// the gas-suppression cylinders by the door, boxes of new servers, a lifted floor
// panel behind a cone, a step ladder, the huddle's whiteboard
b.prop('dc_ups', 6, 0);
b.prop('dc_ups', 9, 0);
b.prop('dc_tapelib', 11, 0);
b.prop('dc_cylinders', 15, 0);
b.prop('dc_boxes', 15, 5);
b.prop('dc_boxes', 0, 12);
b.prop('dc_floorhole', 13, 5);
b.prop('dc_cone', 12, 6);
b.prop('dc_ladder', 0, 9);
b.prop('dc_whiteboard', 11, 12);
b.prop('dc_lift', 12, 4);
b.prop('dc_spools', 1, 6);
b.patch('lane', 13.8, 3.05, 2.15, 1.4);
b.patch('pad', 2.12, 10.98, 1.76, 1.12);
b.patch('pad', 5.12, 10.98, 1.76, 1.12);
b.patch('rug', 12.95, 0.08, 1.1, 0.75);

// ── the site ─────────────────────────────────────────────────
// A data hall on a snowy northern shore. The hall's main block of slate-blue
// ribbed cladding rises behind the room with its rooftop dry coolers steaming;
// the charred-timber admin wing with warm windows stands to the west. In front,
// the ploughed site road and the car park; east of the hall the generator yard,
// the access road through the security gate, the substation and a ridge of wind
// turbines. South, the fjord: red cabins and a sauna on a shore of snow-capped
// boulders, a jetty, dark water full of ice floes with a fishing hut on the big
// one, and the spruce forest of the far shore. North, granite crags in the
// snow-laden forest and a frozen pond.
function fjordSite(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 14, outer: 'meadow', frontWalls: true, light: { tint: '#d8e6ff', strength: 0.3 } });
  const hash = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 1442695041, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ground: the hall's concrete pad and aprons, the ploughed roads, the car park, the substation yard
  b.ground('concrete', -10, -11, 29, 11);
  b.ground('concrete', -10, 0, 10, 17);
  b.ground('concrete', 0, R, C + 3, 3);
  b.ground('concrete', C, 0, 3, R);
  b.ground('sidewalk', -6, 14, 4, 3);
  b.ground('asphalt', -45, 17, 105, 3);
  b.ground('asphalt', 19, -45, 3, 62);
  b.ground('asphalt', 3, 20, 11, 4);
  b.ground('gravel', 23, -2, 7, 11);
  b.ground('concrete', 22, 11, 4, 6);
  // the forests round the site, snow in their shade
  b.ground('forest', -40, -16, 30, 30);
  b.ground('forest', -10, -45, 29, 32);
  b.ground('forest', 23, -45, 20, 41);
  b.ground('forest', 26, 21, 30, 30);
  // trodden snow: the path to the cabins and their yards
  b.ground('soil', -12, 20, 15, 2);
  b.ground('soil', -9, 22, 11, 2);

  // the fjord: a rocky shore of snow-capped boulders, then open dark water full of ice floes
  // (the water shader draws the floes, see ground.ts: the same shore curves), the far shore's
  // rocks and forest. At its east end the near shore turns south.
  const inFrameS = (x: number, y: number) => x - y > -37 && x - y < 38 && x + y > -48 && x + y < 74;
  const nearShore = (x: number) => {
    const s = 24.6 + 1.3 * Math.sin(x * 0.33 + 0.4) + 0.8 * Math.sin(x * 0.12 + 2.3);
    return x > 27 ? Math.max(s, 24.6 + (x - 27) * 1.2) : s;
  };
  const farShore = (x: number) => 37.5 + 1.2 * Math.sin(x * 0.17 + 0.8) + 0.8 * Math.sin(x * 0.41);
  const shoreRocks: [number, number][] = [];
  for (let x = -45; x < 42; x++) {
    let s = Math.round(nearShore(x));
    if (x >= 2 && x <= 15) s = Math.max(s, 24); // the car park keeps its last row
    const f = Math.round(farShore(x));
    if (s >= f) continue;
    b.ground('dirt', x, s - 1, 1, 1);
    shoreRocks.push([x, s - 1]);
    // where the shore turns south, the boulders follow it down the column
    if (x > 27) for (let y = Math.round(nearShore(x - 1)); y < s - 1; y++) {
      b.ground('dirt', x, y, 1, 1);
      shoreRocks.push([x, y]);
    }
    b.ground('water', x, s, 1, f - s);
    b.ground('dirt', x, f, 1, 1);
    b.ground('forest', x, f + 1, 1, 20);
  }
  b.ground('asphalt', 3, 20, 11, 3);

  // the frozen pond up in the forest: broken plates of pale ice
  const inPond = (x: number, y: number) => ((x - y - 5.2) / 5.6) ** 2 + ((x + y + 41.7) / 4.9) ** 2 < 1;
  for (let y = -34; y < -14; y++) for (let x = -28; x < -8; x++) if (inPond(x + 0.5, y + 0.5)) b.ground('sand', x, y, 1, 1);

  // the cut front walls: the hall's cladding, cut low
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // the data hall behind the room, the admin wing to the west
  b.scenic('dc_hall', -8, -10, { w: 24.3, d: 9.7, variant: 'main' });
  b.scenic('dc_hall', -8, -0.3, { w: 7.7, d: 14.6, variant: 'wing' });

  // the generator yard on the east apron: three gensets and the bulk fuel tank
  for (const y of [-11, -8, -5]) b.scenic('dc_genset', 17, y, { rot: 1 });
  b.scenic('dc_fueltank', 17, -2, { w: 3, rot: 1 });

  // the substation: transformers, a gantry, the control hut, its own fence
  b.scenic('dc_transformer', 24, 0, { w: 2, d: 2 });
  b.scenic('dc_transformer', 24, 4, { w: 2, d: 2 });
  b.scenic('dc_gantry', 27, -1, { w: 4, rot: 1 });
  b.scenic('dc_hut', 27, 5, { w: 2, d: 2 });
  b.scenic('dc_fence', 23, -2, { w: 7, variant: 'sub' });
  b.scenic('dc_fence', 23, 8, { w: 7, variant: 'sub' });
  b.scenic('dc_fence', 29, -2, { w: 10, rot: 1, variant: 'sub' });
  b.scenic('dc_fence', 23, -1, { w: 9, rot: 1, variant: 'sub' });
  // the power line striding off north from the gantry
  b.scenic('dc_line', 24, -12, { w: 11, rot: 1 });
  // the ridge with its wind turbines
  // (east of the substation, so the towers rise over open snow at the frame's right edge, not in front of it)
  b.scenic('dc_ridge', 36, 0, { w: 8, d: 17, variant: 'long' });
  b.scenic('dc_ridge', 30, -11, { w: 7, d: 9, variant: 'plain' });

  // the site fence east of the road, the gatehouse and the barrier on the access road
  b.scenic('dc_fence', 23, -40, { w: 38, rot: 1 });
  b.scenic('dc_fence', 23, 9, { w: 5, rot: 1 });
  b.scenic('dc_fence', 25, 20, { w: 6, rot: 1 });
  b.scenic('dc_gatehouse', 23, 14, { w: 2, d: 2 });
  b.scenic('dc_barrier', 25, 17, { w: 3, rot: 1 });

  // street furniture on the aprons
  for (const x of [2, 6, 14, 17]) b.scenic('dc_lamp', x, 16);
  for (const y of [-9, -3, 4, 9]) b.scenic('dc_lamp', 18, y);
  for (const [x, y] of [[-9, 16], [-2, 16], [5, 24], [12, 24]] as const) b.scenic('dc_lamp', x, y);
  for (const x of [-7, -6, -1, 0]) b.scenic('dc_bollard', x, 16);
  b.scenic('dc_bikeshed', -12, 14, { w: 3 });
  // west of the wing a chain-link fence keeps the forest off the road, lamps along it
  for (let x = -44; x < -13; x += 4) b.scenic('dc_fence', x, 15, { w: 4 });
  for (const x of [-16, -23, -30, -37]) b.scenic('dc_lamp', x, 16);
  for (const x of [-7, -1]) b.scenic('dc_flag', x, 15);
  b.scenic('dc_gritbin', 14, 15);
  b.scenic('dc_gritbin', 17, 12);
  b.scenic('dc_hydrant', 4, 15);
  b.scenic('dc_hydrant', 17, 6);
  b.scenic('dc_parkbench', 8, 15, { w: 2 });
  b.scenic('dc_sign', 23, 21, { variant: 'elk' });
  b.scenic('dc_sign', 18, 15, { variant: 'dc' });
  b.scenic('dc_sign', 22, 10, { variant: 'hv' });
  b.scenic('dc_container', 15, 21, { variant: 'red' });

  // the car park (the plough works the road: see the vehicles below)
  // pickups and an SUV parked nose-in to the road, their tails toward the shore (as in the reference)
  for (const [x, v] of [[3, 'red-pickup'], [5, 'white-pickup'], [7, 'blue-pickup'], [9, 'black-pickup'], [11, 'white-suv']] as const) b.scenic('dc_car', x, 20, { rot: 1, variant: v });
  b.scenic('dc_car', -12, 20, { variant: 'green-pickup' });
  b.scenic('dc_snowmobile', -2, 23, { w: 2 });

  // the shore: red cabins, the sauna by its jetty, a boat turned over for the winter
  b.scenic('dc_cabin', -9, 21, { w: 3, d: 2, variant: 'stuga' });
  b.scenic('dc_cabin', -5, 21, { w: 3, d: 2, variant: 'stuga' });
  b.scenic('dc_cabin', 0, 22, { w: 2, d: 2, variant: 'sauna' });
  // the jetty runs from the sauna's door out over the ice, a rowboat moored along its east side
  b.scenic('dc_jetty', 0, 24, { w: 5, rot: 1 });
  b.scenic('dc_boat', 1, 26, { w: 2, rot: 1 });
  b.scenic('dc_woodpile', -6, 23);
  b.scenic('dc_woodpile', 2, 22);
  b.scenic('dc_kicksled', -2, 21);
  b.scenic('dc_snowman', -3, 23);
  // out on the big floe in the bay: the red fishing hut over its holes
  b.scenic('dc_icehut', 13, 30);
  b.decor('dc_decal', 12, 31, { variant: 'hole' });
  b.decor('dc_decal', 14, 29, { variant: 'hole' });
  // boulders all along the shore, a few standing out of the water among the floes
  for (const [x, y] of shoreRocks) if (b.isFree(x, y) && hash(x, y, 21) < 0.62) b.scenic('dc_rock', x, y, { variant: 'shore' });
  for (const [x, y] of shoreRocks) if (b.isFree(x, y + 1) && hash(x, y, 22) < 0.14) b.scenic('dc_rock', x, y + 1, { variant: 'shore' });

  // the south road: street lamps along its south verge too, east of the car park and out past the gate
  for (const x of [15, 22, 29, 35, 41, 47, 53]) if (b.isFree(x, 20)) b.scenic('dc_lamp', x, 20);
  for (const x of [-16, -24, -32, -40]) if (b.isFree(x, 20)) b.scenic('dc_lamp', x, 20);
  // snowy boulders piled on the shore between the road and the water, east of the car park
  for (let x = 13; x < 31; x++)
    for (let y = 21; y < 27; y++) {
      if (!b.isFree(x, y) || !inFrameS(x, y)) continue;
      const g = b.groundAt(x, y);
      if (g === 'water' || g === 'asphalt' || g === 'concrete') continue;
      const nearWater = b.groundAt(x, y + 1) === 'water' || b.groundAt(x, y + 2) === 'water' || b.groundAt(x + 1, y) === 'water';
      if (hash(x, y, 31) < (nearWater ? 0.7 : 0.22)) b.scenic('dc_rock', x, y, { variant: 'shore' });
    }
  // snowbanks thrown up by the plough along the roads' outer verges (gaps for the car park, the path and the gate);
  // where a lamp stands the bank breaks round it
  for (let x = -44; x < 60; x += 2) {
    if ((x >= -12 && x < 3) || (x >= 3 && x < 14) || (x >= 24 && x < 27)) continue;
    if (!b.decor('dc_snowbank', x, 20, { w: 2, variant: 's' })) for (const dx of [0, 1]) b.decor('dc_snowbank', x + dx, 20, { w: 1, variant: 's' });
  }
  // a second, bigger bank behind the first along the stretch east of the gate
  for (let x = 27; x < 60; x += 2) b.decor('dc_snowbank', x, 21, { w: 2, variant: 'big' });
  // snow-capped boulders along that verge, and a few out on the shore where it turns south
  for (let x = 27; x < 58; x++)
    for (const y of [22, 23]) if (b.isFree(x, y) && inFrameS(x, y) && hash(x, y, 33) < 0.3) b.scenic('dc_rock', x, y, hash(x, y, 34) < 0.4 ? { variant: 'shore' } : {});
  for (let y = -44; y < 16; y += 2) b.decor('dc_snowbank', 22, y, { w: 2, rot: 1, variant: 'e' });
  for (let x = 3; x < 13; x += 2) b.decor('dc_snowbank', x, 23, { w: 2, variant: 's' });

  // the forests: spruce and pine, birch at the edges, shrubs and rocks under the snow
  // only inside the painted frame (u = x − y, v = x + y)
  const inFrame = (x: number, y: number) => x - y > -37 && x - y < 38 && x + y > -48 && x + y < 74;
  const tree = (x: number, y: number, t: number) => {
    if (!inFrame(x, y) || !b.isFree(x, y) || b.inside(x, y)) return;
    // a clear verge of snow along the south road east of the car park: lamps, banks and boulders, then the trees
    if (x >= 13 && y >= 20 && y <= 23 && x - y > -10) return;
    const g = b.groundAt(x, y);
    if (g === 'water' || g === 'sand' || g === 'asphalt' || g === 'concrete' || g === 'gravel') return;
    const type = t < 0.72 ? 'dc_spruce' : t < 0.89 ? 'dc_pine' : 'dc_birch';
    // the foreground band along the bottom of the frame carries bigger trees (depth)
    b.scenic(type, x, y, x + y > 40 && type !== 'dc_birch' ? { variant: 'big' } : {});
  };
  const forest = (x0: number, y0: number, x1: number, y1: number, density: number, seed: number) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const h = hash(x, y, seed);
        if (h < density) tree(x, y, hash(x, y, seed + 1));
      }
  };
  // granite crags breaking out of the forest, snow on every ledge
  for (const [x, y] of [[-23, -8], [6, -21], [-10, -23], [-33, -2]] as const) b.scenic('dc_crag', x, y, { w: 3, d: 3 });
  forest(-40, -16, -10, 14, 0.6, 1);
  forest(-10, -45, 19, -13, 0.6, 2);
  forest(23, -45, 43, -4, 0.56, 3);
  forest(26, 22, 56, 50, 0.5, 4);
  forest(-45, 33, 42, 56, 0.62, 5);
  forest(-40, 14, -13, 20, 0.24, 6);
  // the open field east of the gate: snow fences against the drifting snow, scattered trees, ski tracks
  b.scenic('dc_snowfence', 29, 13, { w: 6 });
  b.scenic('dc_snowfence', 30, 21, { w: 5, rot: 1 });
  forest(30, 9, 56, 21, 0.2, 7);
  forest(24, 10, 30, 14, 0.32, 9);
  forest(33, -4, 56, 9, 0.3, 8);
  for (const [x, y] of [[29, 16], [35, 12], [41, 15]] as const) b.decor('dc_decal', x, y, { variant: 'ski' });
  for (const [x, y, v] of [[26, 15, 'steps'], [31, 14, 'fox'], [27, 9, 'steps']] as const) b.decor('dc_decal', x, y, { variant: v });

  // snow mounds and buried shrubs, rocks along the shore and in the open snow
  for (let y = -40; y < 50; y++)
    for (let x = -42; x < 58; x++) {
      if (b.inside(x, y) || !b.isFree(x, y) || !inFrame(x, y)) continue;
      const g = b.groundAt(x, y);
      const h = hash(x, y, 9);
      if (g === null || g === 'grass') {
        if (h < 0.035) b.scenic('dc_mound', x, y);
        else if (h < 0.05) b.scenic('dc_shrub', x, y);
        else if (h < 0.058) b.scenic('dc_rock', x, y);
      } else if (g === 'dirt' && h < 0.18) b.scenic('dc_rock', x, y);
      else if (g === 'forest' && h > 0.965) b.scenic('dc_shrub', x, y);
    }

  // flat details: tyre tracks, footprints, fox and ski tracks, markings, covers
  for (let x = 3; x < 13; x += 2) b.decor('dc_decal', x, 23, { variant: 'bay' });
  for (const [x, y] of [[2, 15], [10, 15], [-4, 15], [18, 2], [17, 11]] as const) b.decor('dc_decal', x, y, { variant: 'cover' });
  b.decor('dc_decal', 18, -6, { variant: 'oil' });
  for (const [x, y, v] of [
    [-7, 19.5, 'steps'], [-11, 22, 'steps'], [3, 26, 'fox'], [-14, 25, 'ski'], [-20, 23, 'ski'], [14, 22, 'steps'], [26, 10, 'fox'], [-16, 8, 'fox'], [6, -14, 'fox'],
  ] as const)
    b.decor('dc_decal', Math.floor(x), Math.floor(y), { variant: v });

  // the road plough works the site road, running on past both ends of the frame
  // (it comes in from off the frame to the west, turns back at the gate's barrier)
  // (blade first both ways: its art 'back' is the truck turned round)
  b.vehicle({ type: 'dc_ploughM', x: -50, y: 17.95, axis: 'x', length: 74.6, w: 4, d: 1.2, speed: 1.4, endWait: 3, phase: 30, backVariant: 'back' });
  // passers-by: staff walking the road's south verge and on up the east road, a cabin dweller
  // in front of the cabins, someone walking out past the gate, a skater on the pond, an ice
  // fisher on the big floe
  b.walkers([[-44, 19.55], [21.6, 19.55], [21.6, -44]], 2, { speed: 0.5 });
  b.walkers([[-8.5, 20.6], [-0.6, 20.6]], 1, { speed: 0.35 });
  b.walkers([[60, 19.55], [26.4, 19.55]], 1, { speed: 0.5 });
  b.walkers([[-21, -27.6], [-15.6, -27.6], [-15.6, -22.4], [-21, -22.4]], 1, { loop: true, speed: 0.8 });
  b.walkers([[12.2, 29.5], [14.75, 29.5], [14.75, 31.45], [12.2, 31.45]], 1, { loop: true, speed: 0.25 });

  // life: reindeer on the heath, arctic foxes at the forest edges, ravens round the bins and the car park
  b.critters('dc_reindeer', 26, 10, 3, 6, 3);
  b.critters('dc_reindeer', 27, 23, 7, 4, 2);
  b.critters('dc_fox', -14, 23.4, 6, 1.4, 1);
  b.critters('dc_fox', 24, 21, 6, 5, 1);
  b.critters('dc_raven', 1, 16.1, 12, 0.8, 3);
  b.critters('dc_raven', 15.2, 15.5, 3.5, 1.3, 2);
}

fjordSite(b);
decorateWalls(b, ['dc_panel', 'dc_extinguisher', 'dc_grille', 'dc_notice', 'dc_thermo']);

export const datacenter = b.build({
  name: 'Data Center',
  description: 'Four rack rows, a network core, a cooling unit, monitoring stations and a maintenance cart.',
  tagline: 'Process, analyze and keep systems online.',
  emoji: '🖥️',
  theme: {
    floorA: '#4a5266',
    floorB: '#454d60',
    floorDetail: '#383f50',
    wall: '#2b3142',
    wallTrim: '#59e08a',
    slab: '#1f2330',
    accent: '#59e08a',
    accent2: '#5b8def',
    ui: '#f2b98a',
    sky: ['#0b0f1a', '#22364a'],
  },
  outfitCategory: 'datacenter',
  defaultOutfitId: 'datacenter.sysadmin',
  environment: { floor: 'raised', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Hot-swap drive in R-12',
    'Patch cluster kernel',
    'Rebalance GPU load',
    'Trace network fault',
    'Update BMC firmware',
    'Check cooling loop',
    'Rotate backups',
    'Audit access logs',
  ],
});

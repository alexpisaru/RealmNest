import { COASTER, coastY, LADDERS, LAND, landAt } from '../../render/hd4/packs/port/layout';
import { WorldBuilder } from './builder';

const b = new WorldBuilder('port', 18, 16);

b.patch('water', 0, 13, 18, 3, { blocking: true });
b.patch('hazard', 1, 3, 7, 1);
b.patch('lane', 0, 9, 18, 1);
b.patch('lane', 9, 0, 1, 9);

b.station('container', 1, 1, 'WORKSTATION', 'Loading bay 1', { variant: 'red', verb: 'loading cargo' });
b.station('container', 4, 1, 'WORKSTATION', 'Loading bay 2', { variant: 'blue', verb: 'unloading cargo' });
b.prop('container', 7, 1, { variant: 'green' });
b.prop('container', 1, 5, { variant: 'yellow' });
b.prop('container', 1, 6, { variant: 'teal' });
b.station('desk', 10, 4, 'WORKSTATION', 'Dispatch', { variant: 'dispatch', verb: 'routing shipments' });
b.station('booth', 14, 1, 'CONTROL_PANEL', 'Control room', { verb: 'coordinating berths' });
b.station('kiosk', 13, 6, 'CONTROL_PANEL', 'Tracking terminal', { verb: 'tracking containers' });
b.station('crane', 10, 10, 'MACHINE', 'Gantry crane', { verb: 'operating the crane' });
b.station('rack', 0, 9, 'STORAGE', 'Warehouse A', { rot: 1, variant: 'pallets' });
b.station('rack', 4, 7, 'WORKSTATION', 'Warehouse B', { variant: 'pallets', verb: 'picking orders' });
b.prop('forklift', 7, 5);
b.prop('boat', 4, 13);
for (const x of [2, 8, 14, 16]) b.prop('bollard', x, 12);

b.station('vending', 16, 8, 'COFFEE', 'Vending', { rot: 1 });
b.seats('bench', 14, 11, 'BREAK', 'Harbour bench');
b.ring('MEETING', 6, 11, 'Dock huddle');
b.point('DECORATIVE', 12.5, 12.5, 'sw', 'Harbour view');
b.prop('crate', 17, 4);
b.prop('crate', 17, 5);
b.prop('barrel', 12, 1);

b.spawn(17, 6);
b.spawn(17, 7);
b.node('quay', 9, 11);

// ── the harbour ──────────────────────────────────────────────
// The playable quay is a stretch of the old harbour's waterfront. West, the
// cobbled fish harbour: the market hall with its awnings and stalls, the
// harbour master's office, a boatyard workshop, nets drying, fishing boats at
// the quay and the red-and-white ferry along the fish pier. North, behind a
// rail siding with a container train and the harbour road with its trucks,
// brick stores and corrugated sheds, a cold store, silos and tanks beyond.
// East, behind a fence, the container terminal: stacks in colourful blocks,
// two gantry cranes over a feeder ship at the berth, straddle carriers, the
// gate with trucks queuing. South, a marina pontoon, the basin with its buoys
// and tugs, the breakwater with tetrapods and the lighthouse, the open sea
// with yachts and a freighter, and the far headland.
function portHarbour(b: WorldBuilder) {
  b.setScene({ ext: 14, outer: 'water', light: { tint: '#ffc48a', strength: 0.4 }, grade: { saturation: 1.05, tone: [0, 0.05, 0.13, 0.24, 0.36, 0.5, 0.64, 0.77, 0.88, 0.96, 1] } });
  const hash = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 1442695041, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // ground: the quay land (every rect of the harbour's land has a quay wall where it meets the sea)
  for (const [x0, y0, x1, y1] of LAND) b.ground('concrete', x0, y0, x1 - x0, y1 - y0);
  // the old harbour's setts west of the playable quay, and the fish pier
  b.ground('paving', -40, -2, 38, 15);
  b.ground('paving', -11, 13, 5, 10);
  // the rail siding behind the quay, the harbour road and its pavement
  b.ground('gravel', -40, -3, 59, 2);
  b.ground('asphalt', -90, -7, 109, 4);
  b.ground('sidewalk', -90, -9, 109, 2);
  // the container terminal's yard (asphalt) north of its crane apron
  b.ground('asphalt', 19, -90, 71, 94);
  // (the far headland's beach and turf are painted by the sea's shader above its continuous coastline)

  // ── the quay's edge ──
  // the wall over the playable water is drawn as tiles (sprites over the water's ripples)
  for (let x = 0; x < 18; x++) b.prop('prt_quaywall', x, 13);
  // bollards along every berth (clear of the ladders), lamps, lifebuoys
  const ladderNear = (x: number, y: number) => LADDERS.some(([lx, ly]) => ly === y && Math.abs(lx - (x + 0.5)) < 0.9);
  for (const x of [-38, -34, -30, -26, -21, -17, -12, -9, -5, 19.5, 23.6, 29, 33.5, 38.5, 43.1]) if (!ladderNear(x, 13)) b.scenic('bollard', x, 12);
  for (const y of [14, 16.5, 19, 21.5]) b.scenic('bollard', -7, y, { rot: 1 });
  for (const x of [-10, -8]) b.scenic('bollard', x, 22);
  for (const [x, y] of [[-36, 11], [-27, 11], [-19, 11], [-3, 11], [-9, 21], [-9, 15]] as const) b.scenic('prt_lamp', x, y, { variant: 'quay' });
  for (const [x, y] of [[-15, 12], [-10.6, 18], [41.2, 12]] as const) b.scenic('prt_lifebuoy', x, y);
  b.scenic('prt_buffer', -35, 10);
  b.scenic('prt_buffer', -35, 11);

  // ── west: the old fish harbour ──
  b.scenic('prt_market', -23, 0.6, { w: 12, d: 5.8 });
  b.scenic('prt_office', -8.5, 1.5, { w: 4, d: 4 });
  // cars parked by the harbour master's office
  b.scenic('prt_car', -11, 2.2, { variant: 'white' });
  b.scenic('prt_car', -11, 3.5, { variant: 'sky' });
  b.scenic('prt_warehouse', -37, -0.5, { w: 11, d: 7, variant: 'saw' });
  for (const x of [-22.4, -19.9, -17.4, -14.9, -12.6]) b.scenic('prt_stall', x, 6.5, { w: 2 });
  b.scenic('prt_netrack', -33, 8.6, { w: 3 });
  b.scenic('prt_netrack', -29, 9.8, { w: 3 });
  const clutter: [string, number, number][] = [
    ['prt_nets', -24.5, 10.5], ['prt_pots', -25.5, 11.2], ['prt_fishbox', -11.5, 9], ['prt_fishbox', -10.5, 10.4], ['prt_fishbox', -13.5, 10.6],
    ['prt_nets', -7.2, 9.6], ['prt_pots', -6, 10.8], ['prt_drums', -3.4, 7.2], ['prt_pallets', -2.4, 8.4], ['prt_pots', -36.5, 9.4],
    ['prt_nets', -31.5, 11.6], ['prt_fishbox', -20, 10.6], ['prt_bin', -9.2, 7.6], ['prt_cone', -4.3, 12.1], ['prt_pots', -9.4, 13.4], ['prt_nets', -8.2, 19.4],
    ['prt_fishbox', -10.4, 16.2], ['prt_drums', -2.8, 4.6], ['prt_pallets', -1.8, 2.2], ['prt_bin', -4.6, 6.6],
  ];
  for (const [t, x, y] of clutter) b.scenic(t, x, y);
  // fishing boats at the west quay and along the fish pier's west side
  const boats: [number, number, number, number, 0 | 1][] = [[-24.8, 13.2, 5, 2, 0], [-18.6, 13.2, 5.6, 2.2, 0], [-14.4, 15, 4.5, 2, 1], [-14.2, 19.6, 4.6, 2.2, 1]];
  for (const [x, y, w, d, rot] of boats) b.scenic('prt_trawler', x, y, { w, d, rot, variant: 'moor' });
  // the ferry along the fish pier's east side
  b.scenic('prt_ferry', -6, 14.4, { w: 10.6, d: 3.6, rot: 1 });

  // ── north: the siding, the road, the stores ──
  b.decor('prt_track', -40, -2.5, { w: 59 });
  b.scenic('prt_buffer', 18.6, -2.5);
  // (the siding's container train runs: see the life at the end)
  b.decor('prt_mark', -40, -5.5, { w: 59, variant: 'dashes' });
  b.decor('prt_mark', -40, -3.95, { w: 59, variant: 'edge' });
  b.scenic('prt_truck', 8.0, -7, { w: 9, d: 2 });
  b.scenic('prt_truck', -14, -5.3, { w: 9, d: 2, variant: 'west' });
  b.scenic('prt_truck', -2.5, -7, { w: 7, d: 2, color: 'empty' });
  b.scenic('prt_warehouse', -35, -19, { w: 12, d: 10, variant: 'shed' });
  b.scenic('prt_warehouse', -22, -20, { w: 13, d: 11, variant: 'brick' });
  b.scenic('prt_warehouse', -8, -19, { w: 12, d: 10, variant: 'cold' });
  b.scenic('prt_warehouse', 5, -20, { w: 13, d: 11, variant: 'brick' });
  const skyline: [number, number, number, number, string?][] = [[-22, -44, 22, 20], [2, -46, 24, 24, 'tanks'], [-40, -30, 16, 14]];
  for (const [x, y, w, d, variant] of skyline) b.scenic('prt_skyline', x, y, { w, d, variant });
  for (const x of [-30, -16, -3, 10]) b.scenic('prt_lamp', x, -9);
  // street conifers and flower boxes along the stores' pavement (the reference's greenery)
  // (big stores draw over whatever stands right in front of them, so the pavement's trees stand in the gaps between them)
  for (const x of [-23, -9, 4.1, 18.2]) b.scenic('prt_tree', x, -8.8);
  for (const x of [-33, -27.5, -22, -3.5, 2, 7.5, 13]) b.scenic('prt_tree', x, -3.6);
  for (const x of [-10.2, -1.2, 3.4, 11.4, 15.6]) b.scenic('prt_planter', x, -8.85, { w: 1.6 });

  // ── east: the container terminal ──
  b.scenic('prt_gate', 19, -8, { w: 4, d: 5 });
  b.scenic('prt_fence', 18.2, -1, { w: 6, rot: 1 });
  b.scenic('prt_fence', 18.2, 8.5, { w: 3.4, rot: 1 });
  b.scenic('prt_fence', 18.2, 5, { w: 3.5, rot: 1, variant: 'gate' });
  const stacks: [number, number, string][] = [[19.6, -1.6, '20'], [32.6, -1.6, '20'], [19.6, -9.8, '40'], [32.6, -9.8, '20'], [19.6, -17.8, '20'], [46, 13.4, '20'], [46, 19.6, 'low']];
  for (const [x, y, v] of stacks) b.scenic('prt_stack', x, y, { w: 12.4, d: 5, variant: v });
  for (const [X, v] of [[29, 'down'], [36.5, 'up']] as const) {
    b.scenic('prt_stsframe', X, 4.6, { w: 1, d: 8.4 });
    b.scenic('prt_stsframe', X + 5, 4.6, { w: 1, d: 8.4 });
    b.scenic('prt_sts', X, 13, { w: 6, d: 17, variant: v });
  }
  b.scenic('prt_ship', 25, 13.3, { w: 18, d: 5 });
  b.scenic('prt_straddle', 31.6, 6.6, { w: 2, d: 3 });
  b.scenic('prt_straddle', 23, 7.4, { w: 2, d: 3 });
  b.scenic('prt_straddle', 44, -5.2, { w: 2, d: 3 });
  for (const [x, y] of [[18.6, 3.4], [32.2, -3.6], [45.2, 9.8]] as const) b.scenic('prt_mast', x, y);
  b.decor('prt_mark', 19, 4, { w: 40, variant: 'dashes' });
  b.scenic('prt_straddle', 52, 25.2, { w: 2, d: 3 });
  b.scenic('prt_truck', 45.4, 26.1, { w: 9, d: 2 });
  b.scenic('prt_mast', 45.6, 24.8);
  for (const [t, x, y] of [['prt_cone', 46, 25.6], ['prt_cone', 47.2, 25.2], ['prt_drums', 48.4, 25], ['prt_pallets', 49.6, 25.4]] as const) b.scenic(t, x, y);
  for (const x of [47, 51, 55]) b.scenic('bollard', x, 29);

  // ── south: the marina, the basin, the breakwater, the open sea ──
  b.scenic('prt_pontoon', 0.6, 16.2, { w: 17, d: 0.8, variant: 'walk' });
  for (let x = 1.1; x < 17; x += 2) b.scenic('prt_pontoon', x, 17, { w: 1, d: 3, variant: 'finger' });
  const marina: [string, number, number, string?][] = [['prt_launch', 1.85, 2.8, 'cuddy'], ['prt_dinghy', 3.85, 2.2], ['prt_launch', 5.85, 2.8, 'open'], ['prt_launch', 7.85, 2.6, 'work'], ['prt_launch', 9.85, 2.6, 'cuddy'], ['prt_dinghy', 11.85, 2], ['prt_launch', 13.85, 2.8, 'open']];
  for (const [t, x, w, v] of marina) b.scenic(t, x, 17.15, { w, d: 1.5, rot: 1, variant: v });
  b.scenic('prt_tug', 39.6, 18.6, { w: 4.2, d: 2 });
  b.scenic('prt_tug', 40.4, 23, { w: 4, d: 2 });
  b.scenic('prt_buoy', 2, 25.4, { variant: 'red' });
  b.scenic('prt_buoy', 7.4, 27.2, { variant: 'green' });
  b.scenic('prt_buoy', 18, 24, { variant: 'red' });
  b.scenic('prt_buoy', -9, 26.5, { variant: 'green' });
  b.scenic('prt_lighthouse', 9, 28, { w: 2, d: 2 });
  b.scenic('prt_parapet', 11, 29, { w: 34 });
  b.scenic('prt_tetrapods', 9, 30, { w: 36 });
  b.scenic('prt_tetrapods', 45, 30, { w: 18 });
  b.scenic('prt_trawler', 0, 29.6, { w: 5, d: 2 });
  const yachts: [number, number, number][] = [[-2, 31.5, 3], [30, 38.2, 3.4]];
  for (const [x, y, w] of yachts) b.scenic('prt_sail', x, y, { w, d: 1.2, variant: 'sailing' });
  b.scenic('prt_coaster', COASTER.x, COASTER.y, { w: COASTER.w, d: COASTER.d });
  // the far headland: rocks at the shore, cottages and wind-bent pines
  for (let x = 9; x < 40; x += 7) b.scenic('prt_cliff', x, Math.round(coastY(x + 3)) - 0.6, { w: 6, d: 2 });
  const cottages: [number, number][] = [[4, 4], [8, 3.4], [12, 4.4], [16, 4.1], [21, 4], [26, 3.2], [-2, 4.2]];
  for (const [x, dy] of cottages) b.scenic('prt_cottage', x, Math.round(coastY(x)) + dy, { w: 3, d: 2.8 });
  const pines: [number, number][] = [[1, 6], [6.5, 7], [10.5, 6.2], [14.4, 7.4], [19, 6.4], [24, 7], [29, 6], [-4, 6.6], [33, 6.8]];
  for (const [x, dy] of pines) b.scenic('prt_pine', x, Math.round(coastY(x)) + dy);
  for (let i = 0; i < 26; i++) {
    const x = 2 + hash(i, 1, 31) * 34;
    const y = Math.round(coastY(x)) + 2.6 + hash(i, 2, 31) * 9;
    const inCottage = cottages.some(([cx, dy]) => x > cx - 0.6 && x < cx + 3.4 && y > Math.round(coastY(cx)) + dy - 0.6 && y < Math.round(coastY(cx)) + dy + 3.3);
    if (!inCottage) b.decor('prt_bush', Math.floor(x), Math.floor(y));
  }

  // ── the flat details of the ground ──
  for (let y = -2; y < 30; y++)
    for (let x = -38; x < 40; x++) {
      if (!landAt(x + 0.5, y + 0.5)) continue;
      const t = hash(x, y, 7);
      const inside = x >= 0 && y >= 0 && x < 18 && y < 16;
      if (inside && t > 0.05) continue;
      if (t < 0.035) b.decor('prt_decal', x, y, { variant: !inside && y > 12 && x < -6 ? 'scales' : 'puddle' });
      else if (t < 0.055) b.decor('prt_decal', x, y, { variant: 'oil' });
      else if (t < 0.07) b.decor('prt_decal', x, y, { variant: 'rust' });
      else if (t < 0.085) b.decor('prt_decal', x, y, { variant: x < 0 ? 'feathers' : 'tyre' });
      else if (t < 0.092) b.decor('prt_decal', x, y, { variant: 'manhole' });
      else if (t < 0.1) b.decor('prt_decal', x, y, { variant: 'drain' });
      else if (t < 0.11 && !inside) b.decor('prt_decal', x, y, { variant: 'weeds' });
    }
  for (const [x, y] of [[-12, 8.4], [-16.5, 9.2], [-21, 9]] as const) b.decor('prt_decal', x, y, { variant: 'scales' });
  b.scenic('prt_decal', 6, 19.6, { variant: 'flotsam' });
  b.scenic('prt_decal', 24, 20, { variant: 'flotsam' });
  b.scenic('prt_decal', -3, 27, { variant: 'flotsam' });

  // ── life ──
  b.critters('gull', -10, 7.5, 9, 5, 4);
  b.critters('gull', -22, 8.6, 10, 3, 4);
  b.critters('gull', 12, 28.1, 18, 1.1, 4);
  b.critters('gull', -10.8, 14, 3.6, 8, 3);
  b.critters('gull', 19.5, 9, 16, 3, 2);
  b.critters('gullfly', -8, 14, 36, 14, 6);
  b.critters('gullfly', -26, -2, 22, 14, 4);
  b.critters('gullfly', 18, 8, 18, 10, 3);
  b.critters('cormorant', 16, 28.2, 16, 0.8, 2);
  b.critters('seal', 4, 21, 22, 5, 1);
  b.critters('seal', -4, 28, 10, 4, 1);
  b.critters('cat', -21, 7.9, 8, 1.4, 2);
  b.critters('pigeon', -20, -8.0, 24, 0.8, 6);

  // ── things that move ──
  // the container train on the siding: in from off the frame (west), it waits at the terminal's buffer, then leaves
  b.vehicle({ type: 'prt_train', x: -78, y: -2.5, axis: 'x', length: 96.5, w: 30, speed: 2.4, endWait: 22, phase: 6 });
  // passers-by: along the stores' pavement and back by the siding; on the breakwater; on the headland's footpath
  b.walkers([[-42, -7.4], [17.6, -7.4], [17.6, -1], [-42, -1]], 2, { loop: true });
  b.walkers([[11.9, 28.55], [62, 28.55]], 2, { speed: 0.45 });
  const path: [number, number][] = [];
  // (a little higher past the rocks at x ≈ 15, lower in front of the cottage at x ≈ 29)
  for (let x = -12; x <= 40; x += 2) path.push([x, coastY(x) + (x >= 14 && x <= 16 ? 3.25 : x >= 28 && x <= 30 ? 2.45 : 2.85)]);
  b.walkers(path, 2, { speed: 0.5 });
}

portHarbour(b);

export const port = b.build({
  name: 'Logistics Port',
  description: 'A harbour quay: container loading bays, a dispatch desk, a control room, tracking terminal, crane and warehouse.',
  tagline: 'Move, manage and connect the world.',
  emoji: '⚓',
  theme: {
    floorA: '#9a9ca3',
    floorB: '#93959c',
    floorDetail: '#7f8188',
    wall: '#5a6274',
    wallTrim: '#f07a2f',
    slab: '#4e5260',
    accent: '#f07a2f',
    accent2: '#5b8def',
    ui: '#f2b98a',
    sky: ['#25284a', '#e88a5a'],
  },
  outfitCategory: 'port',
  defaultOutfitId: 'port.dockworker',
  environment: { floor: 'concrete', outdoor: true, backdrop: 'none', tile: 128 },
  tasks: [
    'Unload container MSKU-88',
    'Scan inbound pallets',
    'Pick order #20931',
    'Route delivery vans',
    'Assign berth 3',
    'Track vessel ETA',
    'Lift reefer to stack',
    'Cycle count aisle 4',
  ],
});

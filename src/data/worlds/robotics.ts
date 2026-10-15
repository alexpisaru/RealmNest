import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('robotics', 16, 14);

b.wall('window', 'ne', 1, 3);
b.wall('pegboard', 'ne', 5, 3);
b.wall('whiteboard', 'ne', 9, 3, { variant: 'blueprint' });
b.wall('door', 'ne', 14, 1);
b.wall('window', 'nw', 1, 3);
b.wall('pegboard', 'nw', 5, 2);
b.wall('poster', 'nw', 8, 1, { color: '#2fb5c8' });
// a laminated wooden propeller hung high over the parts rack
b.wall('rob_prop', 'nw', 9, 3);
// the rest of the NW wall, hung by hand: the team's kanban board, a unit heater, a rack of
// cable drums, a fan up high over the drill, a fire point by the front corner
b.wall('rob_kanban', 'nw', 0, 1);
b.wall('rob_heater', 'nw', 4, 1);
b.wall('rob_spoolrack', 'nw', 7, 1);
b.wall('rob_fan', 'nw', 12, 1);
b.wall('rob_safety', 'nw', 13, 1);

b.patch('pad', 5, 7, 5, 4, { color: '#f3c843' });
b.patch('hazard', 10, 4, 4, 1);

b.station('workbench', 1, 2, 'WORKSTATION', 'Workbench A', { verb: 'soldering' });
b.station('workbench', 4, 2, 'WORKSTATION', 'Workbench B', { verb: 'wiring' });
b.station('desk', 7, 2, 'WORKSTATION', 'Electronics station', { variant: 'scope', verb: 'debugging' });
b.station('assembly', 11, 2, 'MACHINE', 'Robot assembly', { verb: 'assembling' });
b.station('printer3d', 1, 6, 'MACHINE', '3D printer', { verb: 'printing parts' });
b.station('charger', 12, 7, 'MACHINE', 'Charging dock', { verb: 'swapping batteries' });
b.station('workbench', 11, 10, 'WORKSTATION', 'Repair bench', { verb: 'repairing' });
b.prop('bot', 7, 8);
b.point('CONTROL_PANEL', 6.5, 8.5, 'se', 'Test area', { verb: 'field-testing' });
b.station('rack', 0, 9, 'STORAGE', 'Parts storage', { rot: 1, variant: 'parts' });

b.station('counter', 14, 11, 'COFFEE', 'Coffee', { slots: 2, w: 2 });
b.seats('bench', 7, 12, 'BREAK', 'Bench');
b.ring('MEETING', 4, 12, 'Stand-up');

b.prop('crate', 15, 4);
b.prop('crate', 15, 5);
b.prop('barrel', 15, 6);
b.prop('plant', 0, 0);
b.point('DECORATIVE', 10.5, 0.5, 'ne', 'Blueprints');

b.spawn(14, 0);
b.spawn(14, 1);
b.node('pad', 8, 9);

// lived-in workshop: a tool chest, a cable drum table, a pillar drill, a parts trolley,
// a cobot helping at the assembly stand, deliveries by the door, the robot dog
b.prop('rob_toolchest', 15, 9);
b.prop('rob_spool', 9, 12);
b.prop('rob_drill', 0, 12);
b.prop('rob_cart', 2, 6);
b.prop('rob_cobot', 13, 4);
b.prop('rob_boxes', 15, 0);
b.prop('rob_dog', 13, 13);
// hangar heritage: an aircraft engine on its stand, spare tyres, a step ladder by the door
b.prop('rob_engine', 3, 9);
b.prop('rob_tyres', 0, 8);
b.prop('rob_ladder', 15, 2);
// a wing in for re-covering on its trestles, a drawer cabinet under the window, the gas cage, a shop vac
b.prop('rob_wing', 3, 7, { w: 2 });
b.prop('rob_cabinet', 0, 2);
b.prop('rob_gas', 15, 7);
b.prop('rob_vac', 15, 1);
// flat details on the slab: machine keep-out tape, mats where people stand, a drain, the emblem
b.prop('rob_floor', 1, 6, { variant: 'tape' });
b.prop('rob_floor', 12, 7, { w: 2, variant: 'tape' });
b.prop('rob_floor', 1, 3, { w: 2, variant: 'mat' });
b.prop('rob_floor', 4, 3, { w: 2, variant: 'mat' });
b.prop('rob_floor', 7, 3, { w: 2, variant: 'mat' });
b.prop('rob_floor', 11, 11, { w: 2, variant: 'mat' });
b.prop('rob_floor', 10, 8, { variant: 'drain' });
b.prop('rob_floor', 10, 5, { w: 2, d: 2, variant: 'emblem' });

// ── the airfield ─────────────────────────────────────────────
// The workshop is a hangar on a small airfield in summer countryside. Its big
// sliding doors stand open onto the south apron: a white-and-red high-wing by
// the arched hangar, a blue low-wing, the avgas bowser and a baggage train.
// The hangar row runs west (the green arched hangar, the red gabled one, the
// long green shed with its open bays behind). East of the workshop: the
// helipads, taxiway A, the grass strip with the windsock, and runway 36. North,
// behind the back walls: the aero club and its tower, the car park, the fuel
// farm, the perimeter fence and the road, cypresses, wheat with hay bales, the
// farmhouse, a pond with swans and a field of sunflowers. South of the taxiway:
// the fenced fuel compound and the pines along the perimeter fence.
function roboticsAirfield(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 16, outer: 'grass', frontWalls: true, light: { tint: '#ffe2b0', strength: 0.3 } });
  const hash = (a: number, c: number, s = 0) => {
    let h = Math.imul(a * 374761393 + c * 668265263 + s * 2147483647, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  // ── ground: the countryside beyond the road, the road, aprons, taxiways, the runway
  b.ground('sand', -60, -60, 54, 37);
  b.ground('meadow', -26, -39, 16, 13);
  b.ground('meadow', -6, -60, 60, 37);
  b.ground('forest', -6, -60, 60, 24);
  b.ground('forest', 7, -36, 47, 9);
  b.ground('water', -4, -35, 10, 7);
  b.ground('soil', -6, -26, 60, 3);
  b.ground('meadow', 44, -16, 20, 90);
  b.ground('meadow', -60, 41, 104, 30);
  b.ground('asphalt', -60, -20, 80, 3);
  // landside: the car park, the fuel farm's yard, the club's forecourt, the strip along our hangar
  b.ground('asphalt', 4, -15, 9, 10);
  b.ground('gravel', 13, -15, 6, 8);
  b.ground('sidewalk', -14, -6, 18, 3);
  b.ground('paving', -2, -3, 22, 3);
  // the hangar row's yard and the shed's apron
  b.ground('paving', -40, -3, 38, 17);
  b.ground('paving', -40, -8, 26, 5);
  // the drone strip, the south apron, taxiways A and B, runway 36 and its connectors
  b.ground('paving', 16, -6, 4, 32);
  b.ground('paving', -40, 14, 60, 12);
  b.ground('asphalt', 20, -60, 4, 90);
  b.ground('asphalt', -60, 26, 84, 4);
  b.ground('asphalt', 27, -60, 8, 76);
  b.ground('asphalt', 24, 11, 3, 3);
  b.ground('asphalt', 24, -22, 3, 3);

  // ── the hangar's front walls, cut low: the big sliding doors stand open on the apron
  b.scenic('lowWall', 0, R, { w: 3 });
  b.scenic('lowWall', 3, R, { w: 10, variant: 'door' });
  b.scenic('lowWall', 13, R, { w: 3 });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // ── the hangar row (west) and the long shed behind it
  b.scenic('rob_hangar', -17, 1, { w: 16, d: 12, variant: 'arch-open' });
  b.scenic('rob_hangar', -35, 1, { w: 16, d: 12, variant: 'gable' });
  b.scenic('rob_thangar', -38, -13, { w: 22, d: 5 });
  b.scenic('rob_container', -40, -2, { w: 6, d: 2, variant: 'red' });
  for (const [x, y] of [[-18, -7.6], [-24.6, -7.4], [-29.4, -7.6], [-34, -7.4]] as const) b.scenic('rob_crates', x, y);
  b.scenic('rob_drums', -21, -7.4);

  // ── landside (north): the aero club and its tower, the car park, the fuel farm
  b.scenic('rob_terminal', -12, -14, { w: 12, d: 8 });
  b.scenic('rob_tower', 0, -12, { w: 4, d: 4 });
  b.scenic('rob_fuelfarm', 12.6, -15, { w: 5.4, d: 6 });
  b.scenic('rob_picnic', -11, -5, { w: 2 });
  b.scenic('rob_picnic', -6.5, -5, { w: 2 });
  b.scenic('rob_bins', 2, -5);
  for (const [x, y, v] of [
    [5, -14, 'hatch'],
    [7, -14, 'estate'],
    [9, -14, 'van'],
    [11, -14, 'pickup'],
    [6, -8, 'estate'],
    [10, -8, 'hatch'],
  ] as const)
    b.scenic('rob_car', x, y, { w: 2, d: 1, rot: 1, variant: `${v}-rev` });
  for (let x = 4.5; x < 13; x += 2) {
    b.scenic('rob_mark', x, -12.5, { w: 3, d: 1, rot: 1, variant: 'line:0.08' });
  }
  for (const [x, y] of [[4, -10], [12, -10], [13.2, -6.2], [19.2, -14]] as const) b.scenic('rob_lamp', x, y);
  // the perimeter fence along the road, a gate into the car park
  for (let x = -30; x < 19; x += 4) {
    if (x === 6) b.scenic('rob_gate', x, -16.5, { w: 4 });
    else b.scenic('rob_fence', x, -16.5, { w: 4, variant: (x / 4) % 3 === 0 ? 'sign' : undefined });
  }
  // the road's paint: a dashed centre line and solid edge lines
  b.scenic('rob_mark', -48, -19, { w: 67, d: 1, variant: 'dash:2,2' });
  b.scenic('rob_mark', -48, -20.35, { w: 68, d: 1, variant: 'line:0.08' });
  b.scenic('rob_mark', -48, -17.65, { w: 68, d: 1, variant: 'line:0.08' });
  // lawns inside the fence: bushes, young pines and round trees round the club, the tower and the car park
  for (const [x, y] of [[-15, -15.6], [-21, -15.4], [-27, -15.6], [1, -15], [3.4, -14], [-13.6, -10], [14, -5.6], [5, -4.4], [11, -4.4]] as const) b.scenic('rob_bush', x, y);
  for (const [x, y] of [[-18, -15], [-24, -15], [-30, -15], [2, -13.4], [8, -4.6], [19.4, -16]] as const) b.scenic('rob_pine', x, y);
  for (const [x, y] of [[-13.4, -12.6], [0.4, -15.4], [16, -4.4]] as const) b.scenic('rob_tree', x, y);

  // ── beyond the road: cypresses on the verge, wheat with hay bales, the farmhouse,
  //    a ploughed strip behind a rail fence, the pond with its reeds, sunflowers
  for (let x = -27; x < 18; x += 3.5) b.scenic('rob_poplar', Math.round(x), -22);
  for (let x = -29; x < 16; x += 3.5) b.scenic(hash(Math.round(x), 3) < 0.4 ? 'rob_tree' : 'rob_bush', Math.round(x) + 0.5, -21.2);
  for (let x = -31; x < 20; x += 2.3) if (b.isFree(Math.floor(x), -16)) b.scenic('rob_bush', Math.round(x * 2) / 2, -15.8);
  for (let x = -6; x < 14; x += 4) b.scenic('rob_rail', x, -27, { w: 4 });
  b.scenic('rob_farm', -18, -33, { w: 10, d: 8 });
  for (const [x, y] of [[-18, -25], [-13, -24.6], [-7.4, -25], [-24, -26], [-22, -30.6], [-27.6, -24.6], [-8, -33]] as const) b.scenic('rob_bale', x, y);
  for (const [x, y] of [[-26, -30], [-10, -37], [-7, -28.4], [-3, -27.6], [3, -27.4], [9, -27.6], [-5.6, -34], [7.4, -31]] as const) b.scenic('rob_tree', x, y);
  for (const [x, y] of [[-20, -27], [-7.6, -36.4], [6.6, -35.2], [12, -30], [-27, -27]] as const) b.scenic('rob_poplar', x, y);
  for (const [x, y] of [[-3.6, -35.4], [0, -35.6], [3.4, -35.4], [6.2, -33.4], [6.4, -30.2], [-4.6, -32]] as const) b.scenic('rob_reeds', x, y);
  b.critters('rob_swan', -2.6, -33.6, 7, 4.4, 3);

  // ── the drone strip and helipads (east of the workshop)
  b.scenic('rob_pad', 17, 1, { w: 2, d: 2, variant: 'empty' });
  b.scenic('rob_pad', 17, 5, { w: 2, d: 2, variant: 'empty' });
  b.scenic('rob_pad', 17, 9, { w: 2, d: 2, variant: 'empty' });
  b.scenic('rob_container', 17, -6, { w: 6, d: 2, rot: 1, variant: 'blue' });
  for (const [x, y] of [[16, -2], [16, -4], [19.2, -2.2]] as const) b.scenic('rob_crates', x, y);
  b.scenic('rob_picnic', 17, 12, { w: 2 });
  for (const y of [0.2, 4.2, 8.2, 11.4]) b.scenic('rob_cone', 19.2, y);

  // ── runway 36 and taxiway A
  b.scenic('rob_mark', 27, 12, { w: 8, d: 4, variant: 'chev' });
  b.scenic('rob_mark', 27, 11.2, { w: 8, d: 1, variant: 'line:0.5' });
  b.scenic('rob_mark', 27, 8.2, { w: 8, d: 3, variant: 'piano:8' });
  b.scenic('rob_mark', 28, 2.4, { w: 6, d: 4.8, variant: 'num:36' });
  b.scenic('rob_mark', 30.5, -50, { w: 51, d: 1, rot: 1, variant: 'dash:3,2' });
  b.scenic('rob_mark', 26.85, -50, { w: 62, d: 1, rot: 1, variant: 'line:0.18' });
  b.scenic('rob_mark', 34.15, -50, { w: 62, d: 1, rot: 1, variant: 'line:0.18' });
  b.scenic('rob_mark', 27, -9, { w: 8, d: 3, variant: 'tdz' });
  b.scenic('rob_mark', 27, -19, { w: 8, d: 5, variant: 'aim' });
  b.scenic('rob_mark', 28, -15, { w: 6, d: 9, variant: 'skid' });
  b.scenic('rob_mark', 21.5, -50, { w: 78, d: 1, rot: 1, variant: 'line:0.12', color: '#e8b830' });
  b.scenic('rob_mark', -40, 27.5, { w: 62, d: 1, variant: 'line:0.12', color: '#e8b830' });
  b.scenic('rob_mark', 25, 11, { w: 3, d: 1.2, rot: 1, variant: 'hold' });
  b.scenic('rob_mark', 25, -22, { w: 3, d: 1.2, rot: 1, variant: 'hold' });
  for (let y = -46; y <= 10; y += 4) {
    b.scenic('rob_light', 26.4, y, { variant: 'white' });
    b.scenic('rob_light', 34.6, y, { variant: 'white' });
  }
  for (let x = 27.3; x < 35; x += 1.2) {
    b.scenic('rob_light', x - 0.5, 11.6, { variant: 'green' });
    b.scenic('rob_light', x - 0.5, 15.6, { variant: 'red' });
  }
  for (let y = -46; y <= 24; y += 4) {
    if (y > 9 && y < 15) continue;
    if (y > -24 && y < -18) continue;
    b.scenic('rob_light', 19.4, y, { variant: 'blue' });
    b.scenic('rob_light', 23.6, y, { variant: 'blue' });
  }
  // taxiway B's edge lights stand on the apron side, clear of the taxiing plane's footprint
  for (let x = -38; x < 19; x += 4) b.scenic('rob_light', x, 24.3, { variant: 'blue' });
  for (let y = 18; y <= 38; y += 3) b.scenic('rob_approach', 30.5, y);
  b.scenic('rob_papi', 24, -17, { w: 3 });
  b.scenic('rob_windsock', 25, 2);
  b.scenic('rob_mark', 23.8, 0.8, { w: 3.4, d: 3.4, variant: 'seg' });
  b.scenic('rob_sign', 25, 14.3, { variant: 'sign:A|36' });
  b.scenic('rob_sign', 25, -19.2, { variant: 'sign:A|36' });
  b.scenic('rob_sign', 19, -7.6, { variant: 'sign:A' });
  b.scenic('rob_disc', 23.4, 30.6);
  b.scenic('rob_plane', 18.2, -16, { w: 7, d: 9, rot: 1, variant: 'cub' });

  // ── the south apron: tied-down aircraft, the bowser, a baggage train, tugs, cones
  b.scenic('rob_mark', 4.8, 14.35, { w: 6.4, d: 1.2, variant: 'hatch' });
  b.scenic('rob_plane', 2, 16, { w: 7, d: 9, variant: 'robin' });
  b.scenic('rob_plane', -14, 14, { w: 8, d: 10, rot: 1, variant: 'cessna-rev' });
  b.scenic('rob_plane', -32, 16, { w: 6, d: 7, variant: 'biplane' });
  // the bowser stands by the low-wing's nose, its hose cabinet toward the plane; the baggage
  // train waits behind it; a tug with its tow bar at the high-wing's nose; power units, chocks
  b.scenic('rob_fueltruck', 10.2, 18.4, { w: 5, d: 2 });
  b.scenic('rob_bagcart', 8.4, 21.8, { w: 6, d: 1 });
  b.scenic('rob_tug', -12.4, 22.6, { w: 2, d: 1 });
  b.scenic('rob_towbar', -8.6, 22.2, { w: 2, d: 1, rot: 1 });
  b.scenic('rob_tug', -18.6, 16.6, { w: 2, d: 1, rot: 1, variant: 'rev' });
  b.scenic('rob_extcart', 0, 15);
  b.scenic('rob_gpu', 9.2, 16.6);
  b.scenic('rob_gpu', -3.4, 15.6);
  b.scenic('rob_gpu', -20.4, 22.4);
  b.scenic('rob_steps', -3.6, 18.4);
  b.scenic('rob_drums', 14.5, 15.2);
  b.scenic('rob_crates', 15.6, 22.2);
  b.scenic('rob_crates', 16.6, 16.8);
  for (const [x, y] of [[8.2, 20.8], [-2.6, 21.2], [-7.2, 21.6], [15.2, 17.2], [-16.6, 21.2], [3.6, 15.2], [13.8, 22.6]] as const) b.scenic('rob_chocks', x, y);
  b.scenic('rob_towbar', 0.6, 22.4, { w: 2, d: 1 });
  b.scenic('rob_car', -24, 22, { w: 2, d: 1, variant: 'follow' });
  for (const [x, y] of [
    [1, 15.2], [10.2, 24], [-14, 24], [-5.5, 15], [3.4, 24], [-7.6, 19.4], [16.4, 22], [17.4, 15.6], [-2.4, 23.6], [8.2, 15.4],
    [5.4, 15.4], [6.2, 24.2], [15.6, 20.8], [9.6, 18], [-15.6, 13.6], [-15.4, 22.6], [-4.2, 13.4], [-4.6, 22.8], [-11.2, 21.4], [12.8, 24.2],
  ] as const)
    b.scenic('rob_cone', x, y);
  for (const [x, y] of [[-22, 17], [-22, 21], [-18, 17], [-18, 21], [-3, 19], [11, 21], [-10, 24]] as const) b.decor('rob_mark', x, y, { variant: 'tiedown' });
  for (const [x, y] of [[6, 21], [-9, 20], [-29, 19], [12, 19]] as const) b.decor('rob_mark', x, y, { variant: 'oil' });
  b.decor('rob_mark', -24, 16, { w: 4, d: 6, variant: 'stand:3' });

  // apron paint: the edge line along taxiway B, stand lead-in lines, a hatched keep-clear by the shed
  b.scenic('rob_mark', -40, 24.9, { w: 60, d: 1, variant: 'line:0.1' });
  b.decor('rob_mark', -12, -2.6, { w: 6, d: 1.6, variant: 'hatch' });
  // the hangar yard and the club's forecourt: benches, planters, pallets, a fuel cart, parked cars
  for (const [x, y] of [[-5, -2.5], [-15.6, -1.2], [-26.4, -1.6], [-33, -0.6]] as const) b.scenic('rob_crates', x, y);
  b.scenic('rob_drums', -9.4, -2.5);
  b.scenic('rob_gpu', -6.6, -2.5);
  b.scenic('rob_extcart', -1.4, 0.6);
  b.scenic('rob_tug', -37, -6, { w: 2, d: 1 });
  for (const [x, y] of [[-14.6, -6.8], [3.4, -6.6]] as const) b.scenic('rob_bush', x, y);
  for (const [x, y] of [[-19.6, -2], [-8.6, -0.4], [-30, 0.2], [-1.2, -4.6], [17.4, -0.6], [19.4, 13.4]] as const) b.scenic('rob_cone', x, y);
  // wear on the pavements: oil drips, drains and tie-down rings scattered over the slabs
  for (let y = -8; y < 26; y++)
    for (let x = -40; x < 20; x++) {
      if (b.groundAt(x, y) !== 'paving' || b.inside(x, y)) continue;
      const t = hash(x, y, 31);
      if (t < 0.05) b.decor('rob_mark', x, y, { variant: 'oil' });
      else if (t < 0.065) b.decor('rob_mark', x, y, { variant: 'tiedown' });
      else if (t < 0.075) b.decor('rob_mark', x, y, { variant: 'grate' });
    }

  // ── south of the taxiway: the fenced fuel compound, red-and-white masts, pines to the fence and beyond
  b.scenic('rob_tank', 11, 35, { w: 2, d: 2 });
  for (const [x, y] of [[9.4, 36.6], [14, 36.4], [13.6, 34.4], [9.6, 34.2]] as const) b.scenic('rob_kiosk', x, y);
  b.scenic('rob_fence', 9, 33, { w: 4 });
  b.scenic('rob_fence', 13, 33, { w: 4, variant: 'sign' });
  b.scenic('rob_fence', 17, 33, { w: 4, rot: 1 });
  b.scenic('rob_fence', 8, 33, { w: 4, rot: 1 });
  b.scenic('rob_approach', 4.6, 34.4);
  b.scenic('rob_approach', 18.6, 36.6);
  for (let x = 0; x < 44; x += 4) b.scenic('rob_fence', x, 40, { w: 4, variant: (x / 4) % 3 === 1 ? 'sign' : undefined });
  for (let y = -12; y < 40; y += 4) b.scenic('rob_fence', 44, y, { w: 4, rot: 1, variant: (y / 4) % 3 === 0 ? 'sign' : undefined });
  // the pines: a loose stand in the grass, thickening into a wood along the frame's foot
  for (let y = -20; y < 72; y += 1.6)
    for (let x = -8; x < 64; x += 1.8) {
      const tx = Math.round((x + (hash(Math.round(x * 5), Math.round(y * 5), 3) - 0.5) * 1.3) * 2) / 2;
      const ty = Math.round((y + (hash(Math.round(x * 5), Math.round(y * 5), 4) - 0.5) * 1.1) * 2) / 2;
      const g = b.groundAt(Math.floor(tx), Math.floor(ty));
      if (g !== null && g !== 'grass' && g !== 'meadow') continue;
      if (!b.isFree(Math.floor(tx), Math.floor(ty))) continue;
      if (tx - ty < -35 || tx + ty > 74 || tx - ty > 38) continue; // off the frame
      if (tx + ty < 40 || (tx < 44.5 && ty < 28)) continue;
      if (ty < 34.5 && tx < 24) continue; // under the taxiing plane's wing
      if (tx > 7.6 && tx < 18 && ty > 32 && ty < 40) continue; // the compound
      if (tx > 27.5 && tx < 33.5 && ty < 41) continue; // the approach lights
      if (Math.floor(ty) === 40 || Math.floor(tx) === 44) continue; // the fence lines
      const sum = tx + ty;
      const dens = sum > 60 ? 0.95 : sum > 54 ? 0.7 : 0.3;
      if (hash(Math.round(tx * 2), Math.round(ty * 2), 5) > dens) continue;
      b.scenic(hash(Math.round(tx * 2), Math.round(ty * 2), 6) < 0.78 ? 'rob_pine' : 'rob_tree', tx, ty);
    }
  for (const [x, y] of [[38, 3], [40, 14], [37, 25], [36, 33], [41, 36], [21, 38]] as const) b.scenic('rob_bush', x, y);
  for (const [x, y] of [[39, -8], [41, 4], [38.6, 18], [42, 28]] as const) b.scenic('rob_pine', x, y);
  b.scenic('rob_met', 37, 6, { w: 2, d: 2 });

  // ── verges: tufts and seed heads, wildflowers in drifts of one kind
  const kinds = ['poppy', 'cornflower', 'daisy', 'yellow'];
  for (let y = -30; y < 46; y++)
    for (let x = -40; x < 56; x++) {
      const g = b.groundAt(x, y);
      if (g !== null && g !== 'grass' && g !== 'meadow') continue;
      if (b.inside(x, y)) continue;
      const wing = y >= 30 && y < 34 && x < 24; // under the taxiing plane's wing: only low flowers
      const t = hash(x, y, 7);
      if (wing && t < 0.1) continue;
      const drift = Math.sin(x * 0.21 + y * 0.13) + Math.sin(y * 0.17 - x * 0.07);
      if (t < 0.1) b.decor('rob_tuft', x, y);
      else if (t < 0.16 + (drift > 1 ? 0.1 : 0)) b.decor('rob_flowers', x, y, { variant: kinds[Math.floor((x * 0.05 + y * 0.03 + 10) % 4)] });
      else if (t > 0.994) b.decor('rob_bush', x, y);
    }

  // ── life: a plane taxiing on taxiway B under its own power (nose always forward; it holds at
  //    the junction with taxiway A, turns and taxis back off the frame), a car on
  //    the road, people about, drones, hares, swans
  b.vehicle({ type: 'rob_plane', variant: 'club', backVariant: 'club-rev', x: -26, y: 25, axis: 'x', length: 43, w: 8, d: 6, speed: 0.8, endWait: 12, phase: 20 });
  b.vehicle({ type: 'rob_car', variant: 'sedan', backVariant: 'sedan-rev', x: -42, y: -20, axis: 'x', length: 63, w: 2, d: 1, speed: 2.4, endWait: 9, phase: 4 });
  b.walkers([[-1.5, -2.4], [15.5, -2.4], [15.5, -0.6], [-1.5, -0.6]], 2, { loop: true });
  b.walkers([[-13.5, -3.4], [-2.5, -3.4], [-2.5, -1], [-13.5, -1]], 1, { loop: true, speed: 0.6 });
  b.walkers([[-2, 16.4], [-2, 23.8], [1.3, 23.8], [1.3, 16.4]], 2, { loop: true });
  b.critters('rob_drone', 15, -2, 7, 16, 3);
  b.critters('rob_drone', 0, 15, 14, 10, 1);
  b.critters('rob_rover', 16.3, 0.5, 3.4, 13, 1);
  b.critters('rob_hare', 36, 0, 7, 22, 3);
  b.critters('rob_hare', 2, 31, 22, 2, 1);
  b.critters('bird', 24.2, -10, 2.6, 22, 4);
  b.critters('bird', -10, -26, 14, 3, 3);
  b.critters('cat', -16, 13.3, 2, 0.6, 1);
}

roboticsAirfield(b);
decorateWalls(b, ['rob_panel', 'rob_reel', 'rob_shelf', 'rob_safety', 'rob_chart', 'rob_photos']);

export const robotics = b.build({
  name: 'Robotics Workshop',
  description: 'Workbenches, an electronics station, a robot assembly stand, a test area with an eager bot, parts storage.',
  tagline: 'Build, prototype and experiment.',
  emoji: '🤖',
  theme: {
    floorA: '#a7a296',
    floorB: '#a09b8f',
    floorDetail: '#8b867b',
    wall: '#3d4a5c',
    wallTrim: '#f3c843',
    slab: '#4a4a52',
    accent: '#f3c843',
    accent2: '#2fb5c8',
    ui: '#f2b98a',
    sky: ['#1a2030', '#7a6a50'],
  },
  outfitCategory: 'robotics',
  defaultOutfitId: 'robotics.builder',
  environment: { floor: 'concrete', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Solder motor driver',
    'Tune PID loop',
    'Print gripper v3',
    'Program arm pick path',
    'Run obstacle course',
    'Flash bot firmware',
    'Swap battery packs',
    'Calibrate lidar',
  ],
});

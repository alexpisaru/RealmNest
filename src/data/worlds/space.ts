import type { MaterialId } from '../../domain/world';
import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('space', 16, 14);

b.wall('starwindow', 'ne', 0, 5);
b.wall('wallpanel', 'ne', 6, 3);
b.wall('starwindow', 'ne', 10, 3);
b.wall('door', 'ne', 14, 1, { variant: 'airlock' });
b.wall('starwindow', 'nw', 1, 5, { variant: 'planet' });
b.wall('wallpanel', 'nw', 8, 2);

b.patch('lane', 0, 4, 16, 1, { color: '#5ee0e6' });
b.patch('grate', 12, 5, 4, 4);
// a warm padded mat under the crew lounge
b.patch('pad', 7, 10, 5, 3, { color: '#a0562c' });

b.station('console', 1, 1, 'CONTROL_PANEL', 'Navigation', { variant: 'space', verb: 'plotting a burn' });
b.station('console', 4, 1, 'CONTROL_PANEL', 'Comms', { variant: 'space', verb: 'relaying' });
b.station('console', 7, 1, 'CONTROL_PANEL', 'Life support', { variant: 'space', verb: 'monitoring' });
b.station('console', 10, 1, 'CONTROL_PANEL', 'Power grid', { variant: 'space', verb: 'balancing' });
b.station('labbench', 1, 8, 'LAB_BENCH', 'Science bay', { variant: 'capsule', slots: 2, verb: 'experimenting' });
b.station('hydro', 10, 8, 'CROP', 'Hydroponics', { verb: 'tending plants' });
b.prop('hatch', 13, 6);
b.point('CONTROL_PANEL', 12.5, 6.5, 'se', 'Docking port', { verb: 'docking' });

const holo = b.prop('hologram', 6, 5);
b.around(holo, 'MEETING', 'Holo-table');

b.seats('sofa', 8, 11, 'LOUNGE', 'Crew lounge', { color: '#6a68c8' });
b.station('dispenser', 12, 11, 'COFFEE', 'Galley');
b.station('cabinet', 0, 5, 'STORAGE', 'Lockers', { rot: 1, variant: 'locker' });
b.prop('pod', 4, 8);
b.prop('pod', 5, 8);
b.point('DECORATIVE', 0.5, 3.5, 'nw', 'Observation window');
b.prop('plant', 15, 13);
b.prop('crate', 15, 9);
b.prop('crate', 15, 10);

b.spawn(14, 0);
b.spawn(14, 1);
b.node('core', 8, 9);

// ── the station round the module ─────────────────────────────
// The command module sits on the hull deck of a big orbital station. Behind it a
// chain of modules (a node, a lab wrapped in gold, a hab with lit windows, a cargo
// module) runs along the north side and a second hab along the west; past them the
// station's spine carries radiators, a comms tower and dishes. Four trusses reach
// out over the void to solar wings at the corners of the frame. On the west apron
// the robotic arm stands over the docked shuttle; a cargo capsule waits on the east
// pad; an RCS quad guards each outer corner. The deck's cut edges drop into space,
// and far below lies the planet's curved limb.
function spaceStation(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  // a contrast curve: deeper shadows, brighter highlights (the reference's punch)
  b.setScene({ ext: 16, outer: 'space', frontWalls: true, light: { tint: '#a8c8ff', strength: 0.3 }, grade: { saturation: 1.05, tone: [0, 0.08, 0.17, 0.272, 0.385, 0.5, 0.615, 0.728, 0.838, 0.935, 1] } });

  // the hull deck (scene ground wins over the floor: the room is never covered)
  const deck: [MaterialId, number, number, number, number][] = [
    ['hull', -9, -11, 35, 11],
    ['hull', -9, 0, 9, 20],
    ['hull', 0, R, 22, 6],
    ['hull', C, 0, 10, 16],
    ['hull', -4, -24, 18, 13],
    ['hull', 26, -6, 5, 14],
    ['deck', -16, 2, 7, 12],
  ];
  const zones: [MaterialId, number, number, number, number][] = [
    ['hazard', -16, 2, 7, 1],
    ['hazard', -16, 13, 7, 1],
    ['raised', 19, 17, 3, 3],
    ['raised', -9, 17, 3, 3],
    ['roof', 0, -22, 10, 4],
    ['grate', -7, 14, 4, 2],
    ['grate', 18, 1, 4, 2],
    ['deck', 19, 5, 6, 6],
  ];
  for (const [m, x, y, w, d] of [...deck, ...zones]) b.ground(m, x, y, w, d);
  /** A long thin prop laid as segments of at most n tiles (small sprites, shared between equal segments). */
  const run = (type: string, x: number, y: number, w: number, rot: 0 | 1, n: number, variant?: string) => {
    for (let o = 0; o < w; o += n) {
      const len = Math.min(n, w - o);
      if (rot === 0) b.scenic(type, x + o, y, { w: len, variant });
      else b.scenic(type, x, y + w - o - len, { w: len, rot: 1, variant });
    }
  };

  // the deck's cut edges where it meets the void (only the faces turned to the camera)
  const solid = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  let x0 = 0;
  let x1 = 0;
  let y0 = 0;
  let y1 = 0;
  for (const [, x, y, w, d] of deck)
    for (let j = y; j < y + d; j++)
      for (let i = x; i < x + w; i++) {
        solid.add(key(i, j));
        x0 = Math.min(x0, i);
        x1 = Math.max(x1, i);
        y0 = Math.min(y0, j);
        y1 = Math.max(y1, j);
      }
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) solid.add(key(i, j));
  for (let y = y0; y <= y1; y++) {
    let start = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const edge = solid.has(key(x, y)) && !solid.has(key(x, y + 1));
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) {
        run('spc_edge', start, y + 1, x - start, 0, 6);
        start = -1;
      }
    }
  }
  for (let x = x0; x <= x1; x++) {
    let start = -1;
    for (let y = y0; y <= y1 + 1; y++) {
      const edge = solid.has(key(x, y)) && !solid.has(key(x + 1, y));
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) {
        run('spc_edge', x + 1, start, y - start, 1, 6);
        start = -1;
      }
    }
  }

  // the module's cut front walls
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // ── north: the module chain, segments of ≤ 4 m so everything sorts cleanly ──
  b.scenic('spc_module', -8, -9, { w: 4, d: 4, variant: 'node:whole' });
  b.scenic('spc_adapter', -4, -9, { w: 1, d: 4 });
  b.scenic('spc_module', -3, -9, { w: 4, d: 4, variant: 'lab:s' });
  b.scenic('spc_module', 1, -9, { w: 4, d: 4, variant: 'lab:e' });
  b.scenic('spc_adapter', 5, -9, { w: 1, d: 4 });
  b.scenic('spc_module', 6, -9, { w: 4, d: 4, variant: 'hab:s' });
  b.scenic('spc_module', 10, -9, { w: 4, d: 4, variant: 'hab:m' });
  b.scenic('spc_module', 14, -9, { w: 3, d: 4, variant: 'hab:e' });
  b.scenic('spc_adapter', 17, -9, { w: 1, d: 4 });
  b.scenic('spc_module', 18, -9, { w: 4, d: 4, variant: 'cargo:s' });
  b.scenic('spc_module', 22, -9, { w: 3, d: 4, variant: 'cargo:e' });
  // west: a hab running south from the node's port
  b.scenic('spc_adapter', -8, -5, { w: 1, d: 4, rot: 1 });
  b.scenic('spc_module', -8, -4, { w: 4, d: 4, rot: 1, variant: 'hab:s' });
  b.scenic('spc_module', -8, 0, { w: 4, d: 4, rot: 1, variant: 'hab:m' });
  b.scenic('spc_module', -8, 4, { w: 3, d: 4, rot: 1, variant: 'hab:e' });
  // the strip between the modules and the room: conduits, boxes, vents
  for (const x of [-3, 2, 8, 19]) b.scenic('spc_pipes', x, -3, { w: 4 });
  for (const [x, y] of [[-1, -4], [9, -4], [13, -4], [23, -4], [-3, 1], [-3, 6]] as const) b.scenic('spc_box', x, y);
  for (const [x, y] of [[4, -4], [16, -4], [-2, 3], [25, -3]] as const) b.scenic('spc_vent', x, y);

  // ── the spine behind: radiators, the comms tower, dishes, a telescope, a greenhouse dome ──
  // the west end of the spine: life-support skids, a lit habitation dome, the comms
  // tower among antenna masts with red beacons; a lit shelter beside the greenhouse
  b.scenic('spc_lifesup', -3, -13, { w: 3, d: 2 });
  b.scenic('spc_antenna', 0, -12);
  b.scenic('spc_hangar', 8, -13, { w: 5, d: 2 });
  b.scenic('spc_tower', -3, -20);
  b.scenic('spc_habdome', -4, -19, { w: 3, d: 3 });
  b.scenic('spc_lifesup', -1, -20, { w: 3, d: 2 });
  for (const [x, y, v] of [[-4, -22, 'tall'], [0, -23, 'tall'], [-2, -23, ''], [-4, -15, '']] as const) b.scenic('spc_antenna', x, y, { variant: v || undefined });
  b.scenic('spc_dish', 11, -22, { w: 2, d: 2 });
  b.scenic('spc_dome', 4, -14, { w: 3, d: 3 });
  b.scenic('spc_dish', 10, -18, { w: 3, d: 3 });
  for (const [x, y] of [[-4, -24], [13, -24], [12, -14]] as const) b.scenic('spc_beacon', x, y);
  for (const [x, y] of [[1, -14], [-2, -21]] as const) b.scenic('spc_box', x, y);
  // the station's name painted big across the spine
  b.decor('spc_decal', 0, -17, { w: 9, d: 2, variant: 'name' });
  // the north truss and its wings (top right)
  b.scenic('spc_mount', 4, -24);
  run('spc_truss', 4, -52, 28, 1, 8);
  b.scenic('spc_solar', -7, -38, { w: 11, d: 4, variant: 'r' });
  b.scenic('spc_solar', 5, -38, { w: 11, d: 4 });
  b.scenic('spc_solar', -7, -45, { w: 11, d: 4, variant: 'r' });
  b.scenic('spc_solar', 5, -45, { w: 11, d: 4 });

  // ── west: the apron, the arm, the docked shuttle; the west truss and its wings ──
  b.scenic('spc_arm', -13, 7, { w: 3, d: 3 });
  b.scenic('spc_shuttle', -26, 4, { w: 9, d: 4 });
  b.scenic('spc_tunnel', -17, 4, { w: 2, d: 4 });
  b.scenic('spc_cargo', -15, 10, { w: 2, d: 2 });
  for (const [x, y] of [[-16, 2], [-10, 2], [-16, 13], [-10, 13]] as const) b.scenic('spc_beacon', x, y);
  b.scenic('spc_mount', -9, -3);
  run('spc_truss', -49, -3, 40, 0, 8);
  b.scenic('spc_solar', -33, -14, { w: 11, d: 4, rot: 1 });
  b.scenic('spc_solar', -33, -2, { w: 11, d: 4, rot: 1, variant: 'r' });
  b.scenic('spc_solar', -39, -14, { w: 11, d: 4, rot: 1 });
  b.scenic('spc_solar', -39, -2, { w: 11, d: 4, rot: 1, variant: 'r' });
  // the west strip's south end: cargo, tanks, an RCS quad on the corner
  b.scenic('spc_cargo', -7, 9, { w: 2, d: 2 });
  b.scenic('spc_tank', -4, 12, { w: 2, rot: 1 });
  b.scenic('spc_thruster', -9, 18, { w: 2, d: 2 });
  b.scenic('spc_mast', -6, 18);

  // ── east: the landing pad with the cargo capsule, cargo, the east truss and wings ──
  b.decor('spc_decal', 20, 6, { w: 4, d: 4, variant: 'pad' });
  b.scenic('spc_capsule', 20, 6, { w: 4, d: 4 });
  b.scenic('spc_cmg', 22, 3, { w: 2 });
  b.scenic('spc_cupola', 17, 7, { w: 2, d: 2 });
  b.scenic('spc_cmg', 29, 4, { w: 2, rot: 1 });
  b.scenic('spc_cargo', 17, 3, { w: 2, d: 2 });
  b.scenic('spc_cargo', 17, 12, { w: 2, d: 2 });
  b.scenic('spc_tank', 23, 1, { w: 2 });
  b.scenic('spc_tank', 23, 13, { w: 2 });
  for (const [x, y] of [[25, 0], [25, 15], [19, 5], [19, 10], [24, 5]] as const) b.scenic('spc_beacon', x, y);
  b.scenic('spc_hangar', 27, -6, { w: 5, d: 2, rot: 1 });
  b.scenic('spc_hangar', 27, 1, { w: 5, d: 2, rot: 1 });
  b.scenic('spc_dish', 29, -5, { w: 2, d: 2 });
  b.scenic('spc_mount', 25, 9);
  run('spc_truss', 26, 9, 28, 0, 8);
  b.scenic('spc_solar', 32, -2, { w: 11, d: 4, rot: 1 });
  b.scenic('spc_solar', 32, 10, { w: 11, d: 4, rot: 1, variant: 'r' });
  b.scenic('spc_solar', 38, -2, { w: 11, d: 4, rot: 1 });
  b.scenic('spc_solar', 38, 10, { w: 11, d: 4, rot: 1, variant: 'r' });

  // ── south: the deck in front of the module, the RCS quad, the south truss and wings ──
  b.scenic('spc_thruster', 20, 18, { w: 2, d: 2 });
  // an EVA worksite at an open access hatch
  b.scenic('spc_worksite', 12, 17, { w: 2 });
  b.scenic('spc_cargo', 1, 17, { w: 2, d: 2 });
  b.scenic('spc_tank', 8, 18, { w: 2 });
  b.scenic('spc_mast', 15, 18);
  for (const [x, y] of [[5, 18], [14, 16], [17, 18], [18, 15]] as const) b.scenic('spc_box', x, y);
  for (const [x, y] of [[0, 19], [10, 19], [21, 14]] as const) b.scenic('spc_beacon', x, y);
  b.scenic('spc_rail', 3, 15, { w: 4 });
  b.scenic('spc_rail', 12, 15, { w: 3 });
  b.scenic('spc_vent', 9, 17);
  b.scenic('spc_mount', 7, 19);
  run('spc_truss', 7, 20, 28, 1, 8);
  b.scenic('spc_solar', -4, 34, { w: 11, d: 4, variant: 'r' });
  b.scenic('spc_solar', 8, 34, { w: 11, d: 4 });
  b.scenic('spc_solar', -4, 40, { w: 11, d: 4, variant: 'r' });
  b.scenic('spc_solar', 8, 40, { w: 11, d: 4 });

  // ── flat details on the deck ──
  b.decor('spc_decal', 19, 17, { w: 3, d: 3, variant: 'scorch' });
  b.decor('spc_decal', -9, 17, { w: 3, d: 3, variant: 'scorch' });
  b.decor('spc_decal', -15, 5, { w: 2, d: 2, variant: 'arrows' });
  b.decor('spc_decal', -15, 8, { w: 2, d: 2, variant: 'arrows' });
  b.decor('spc_decal', -12, 3, { w: 2, d: 2, variant: 'number' });
  b.decor('spc_decal', 16, 9, { w: 2, d: 2, variant: 'number' });
  b.decor('spc_decal', 2, 15, { w: 1, d: 1, variant: 'tether' });
  b.decor('spc_decal', 0, 16, { w: 13, d: 1, variant: 'walk' });
  b.decor('spc_decal', 19, 12, { w: 6, d: 1, variant: 'walk' });
  b.decor('spc_decal', 17, -1, { w: 8, d: 1, variant: 'walk' });
  // inside: a cable run across the floor, zone codes by the docking well and the consoles
  b.decor('spc_decal', 1, 10, { w: 5, d: 1, variant: 'cable' });
  b.decor('spc_decal', 12, 10, { variant: 'label' });
  b.decor('spc_decal', 13, 3, { variant: 'label' });
  const hash = (a: number, c: number) => {
    let h = Math.imul(a * 374761393 + c * 668265263, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  for (let y = -24; y < 20; y++)
    for (let x = -9; x < 31; x++) {
      if (!solid.has(key(x, y)) || (x >= -1 && y >= -1 && x <= C && y <= R)) continue;
      if (b.groundAt(x, y) !== 'hull') continue;
      const t = hash(x, y);
      if (t < 0.025) b.decor('spc_decal', x, y, { variant: 'hatch' });
      else if (t < 0.07) b.decor('spc_decal', x, y, { variant: 'lights' });
      else if (t < 0.08) b.decor('spc_decal', x, y, { variant: 'number' });
    }

  // ── clutter over the open deck: racks of crates, cabinets, boxes, vents, tank pairs, lamp posts ──
  // (kept off the strips where the astronauts and crawlers work)
  const busy: [number, number, number, number][] = [[2, 14, 8, 4], [11, 14, 7, 5], [16, 12, 5, 4], [-16, 3, 7, 7], [-2, -19, 10, 4], [-1, -1, C + 2, R + 2]];
  const clear = (x: number, y: number) =>
    solid.has(key(x, y)) && b.groundAt(x, y) === 'hull' && b.isFree(x, y) && !busy.some(([bx, by, bw, bd]) => x >= bx && y >= by && x < bx + bw && y < by + bd);
  for (let y = -24; y < 20; y++)
    for (let x = -9; x < 31; x++) {
      if (!clear(x, y)) continue;
      const t = hash(x * 3 + 1, y * 5 + 2);
      if (t > 0.16) continue;
      const u = hash(x + 17, y - 9);
      if (u < 0.22 && clear(x + 1, y)) b.scenic('spc_rack', x, y, { w: 2 });
      else if (u < 0.36) b.scenic('spc_rack', x, y);
      else if (u < 0.58) b.scenic('spc_cabinet', x, y, { rot: u < 0.47 ? 1 : 0 });
      else if (u < 0.7) b.scenic('spc_box', x, y);
      else if (u < 0.78) b.scenic('spc_vent', x, y);
      else if (u < 0.83 && clear(x + 1, y)) b.scenic('spc_tank', x, y, { w: 2 });
      else b.scenic('spc_beacon', x, y);
    }

  // ── life: astronauts on EVA, crawlers inspecting the hull, drones on patrol ──
  b.critters('spc_eva', 3, 15.5, 6, 1.5, 2);
  b.critters('spc_eva', 12.5, 18.05, 1.1, 0.3, 1);
  b.critters('spc_eva', 16.5, 13.5, 3, 2, 1);
  b.critters('spc_eva', -15, 4, 4, 5, 1);
  b.critters('spc_crawler', 10, 15.5, 6, 1, 1);
  b.critters('spc_crawler', -1, -18, 8, 2, 1);
  b.critters('spc_drone', 2, 15, 14, 4, 2);
  b.critters('spc_drone', 19, 1, 6, 4, 1);
  b.critters('spc_drone', -14, 3, 4, 8, 1);

  // ── cargo trolleys riding the west and south trusses out to the wings and back ──
  b.vehicle({ type: 'spc_pod', x: -50, y: -3, axis: 'x', length: 41, w: 2, speed: 0.9, endWait: 6 });
  b.vehicle({ type: 'spc_pod', x: 7, y: 20, axis: 'y', length: 30, w: 2, speed: 0.8, endWait: 7, phase: 21 });
}

spaceStation(b);
// the crew's own things on the free stretches of wall
b.wall('spc_kit', 'ne', 13, 1);
b.wall('spc_suit', 'ne', 15, 1);
b.wall('spc_pipes', 'nw', 0, 1);
decorateWalls(b, ['spc_vent', 'spc_stowage', 'spc_screen', 'spc_patches', 'spc_pipes']);

export const space = b.build({
  name: 'Space Station',
  description: 'Command module with four consoles, an observation window, a science bay, a docking port and a lounge.',
  tagline: 'Explore, maintain and keep life going.',
  emoji: '🛰️',
  theme: {
    floorA: '#3b4566',
    floorB: '#37405f',
    floorDetail: '#2c3450',
    wall: '#2b3352',
    wallTrim: '#5ee0e6',
    slab: '#1d2238',
    accent: '#5ee0e6',
    accent2: '#b07bf0',
    ui: '#f2b98a',
    sky: ['#070914', '#2a2150'],
  },
  outfitCategory: 'space',
  defaultOutfitId: 'space.eva',
  environment: { floor: 'metal', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Align comms array',
    'Run diagnostics',
    'Plot orbit burn',
    'Dock supply pod',
    'Check O₂ scrubbers',
    'Grow lettuce module',
    'Patch micrometeor dent',
    'Analyze regolith sample',
  ],
});

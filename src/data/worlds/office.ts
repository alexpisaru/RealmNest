import { WorldBuilder } from './builder';
import { decorateWalls } from './surroundings';

const b = new WorldBuilder('office', 16, 14);

// walls
b.wall('window', 'ne', 1, 3);
b.wall('whiteboard', 'ne', 5, 3);
b.wall('poster', 'ne', 9, 1, { color: '#e2553b' });
b.wall('door', 'ne', 14, 1);
b.wall('window', 'nw', 1, 3);
b.wall('clock', 'nw', 5, 1);
b.wall('pinboard', 'nw', 7, 2);
b.wall('window', 'nw', 10, 3);

b.patch('rug', 10, 3, 5, 5, { color: '#3fb68b' });
b.patch('rug', 8, 9, 6, 4, { color: '#d0705a' });

// workstations
const desks: [number, number, string][] = [
  [2, 2, 'dual'],
  [5, 2, 'single'],
  [8, 2, 'laptop'],
  [2, 5, 'single'],
  [5, 5, 'dual'],
  [8, 5, 'single'],
  [2, 8, 'laptop'],
  [5, 8, 'dual'],
];
desks.forEach(([x, y, v], i) => b.station('desk', x, y, 'WORKSTATION', `Desk ${i + 1}`, { variant: v, verb: 'working at the desk' }));

// meeting
const table = b.prop('table', 11, 4);
b.around(table, 'MEETING', 'Meeting table');

// coffee & lounge
b.station('counter', 10, 0, 'COFFEE', 'Coffee machine', { slots: 2 });
b.station('watercooler', 12, 0, 'COFFEE', 'Water cooler');
b.seats('sofa', 9, 10, 'LOUNGE', 'Lounge sofa', { color: '#d0705a' });
b.prop('coffeeTable', 9, 11);
b.seats('armchair', 12, 11, 'LOUNGE', 'Armchair', { color: '#5b8def' });

// storage & decor
b.station('bookshelf', 0, 3, 'STORAGE', 'Bookshelf', { rot: 1 });
b.station('printer', 0, 7, 'STORAGE', 'Printer', { rot: 1 });
b.point('DECORATIVE', 6.5, 0.5, 'ne', 'Whiteboard');
b.point('DECORATIVE', 0.5, 11.5, 'nw', 'Window view');
for (const [x, y] of [[0, 0], [15, 0], [0, 13], [15, 13], [8, 0], [15, 8]]) b.prop(x === 15 && y === 8 ? 'plantTall' : 'plant', x, y);
b.prop('lamp', 13, 9);
// lived-in details
b.prop('fridge', 13, 0);
b.prop('coatRack', 15, 1);
b.prop('filingCabinet', 0, 10, { rot: 1, color: '#7d8aa3' });
b.prop('filingCabinet', 0, 9, { rot: 1, color: '#7d8aa3' });
b.prop('sideTable', 14, 11);
b.prop('boxes', 15, 4);
b.prop('plantTall', 7, 12);
b.prop('plant', 4, 12);
b.prop('sideTable', 9, 0);
b.patch('rug', 12, 1, 3, 2, { color: '#c0533f' });
b.patch('rug', 1, 1, 10, 9, { color: '#3e5a7a' });

b.spawn(14, 0);
b.spawn(14, 1);
b.node('hall', 7, 7);
b.node('door', 14, 1);

// ── the city plaza ───────────────────────────────────────────
// After the owner's retouch (2026-10): the studio is the ground floor of a
// modern block of cream stone, glass and timber with roof gardens. Round it a
// bright granite plaza with palms in stone planters, a striped market, a
// square fountain, a café under white parasols, a green kiosk, a ring
// sculpture and two lawns for bocce; a clock tower to the west; glass towers
// with rooftop pools beyond; a turquoise canal with an elevated monorail to
// the north; a boulevard with a planted median, bus shelters and the tram to
// the south, an avenue to the east. The layout keeps the old piazza's places.
// The frame shows tiles with -34 ≤ x − y ≤ 34 and x + y ≥ −44 (top).
function officeCity(b: WorldBuilder) {
  const C = b.cols;
  const R = b.rows;
  b.setScene({ ext: 14, outer: 'cobble', frontWalls: true, light: { tint: '#ffdcaa', strength: 0.3 } });
  // promenades round the blocks and the room, travertine bands framing the plaza
  b.ground('sidewalk', -14, -19, 44, 11);
  b.ground('sidewalk', -1, R, C + 4, 3);
  b.ground('sidewalk', C, -1, 3, R + 1);
  b.ground('sidewalk', C, -1, 28, 2);
  b.ground('paving', 0, 24, 31, 1);
  b.ground('paving', 30, 1, 1, 24);
  b.ground('paving', -1, 17, 2, 14);
  // the canal: a basin with a promenade round it
  b.ground('sidewalk', -12, -36, 28, 17);
  b.ground('water', -8, -32, 18, 12);
  // the boulevard to the south: two carriageways and a planted median
  b.ground('sidewalk', -40, 31, 79, 1);
  b.ground('asphalt', -40, 32, 88, 3);
  b.ground('paving', -40, 35, 79, 2);
  b.ground('asphalt', -40, 37, 88, 3);
  b.ground('sidewalk', -40, 40, 79, 4);
  // the avenue to the east
  b.ground('sidewalk', 39, -40, 1, 71);
  b.ground('asphalt', 40, -40, 3, 80);
  b.ground('paving', 43, -40, 2, 71);
  b.ground('asphalt', 45, -40, 3, 80);
  b.ground('sidewalk', 48, -40, 3, 80);

  // cut front walls of the studio
  b.scenic('lowWall', 0, R, { w: C });
  b.scenic('lowWall', C, 0, { w: R, rot: 1 });

  // the studio's own block: the row behind the back wall and the wing to the west
  b.scenic('blocco', -8, -8, { w: 10, d: 7.75, variant: 'archi-5-giardino' });
  b.scenic('blocco', 2, -8, { w: 9, d: 7.75, variant: 'vetro-5-pergola' });
  b.scenic('blocco', 11, -8, { w: 8.2, d: 7.75, variant: 'archi-4-giardino' });
  b.scenic('blocco', -8, -0.25, { w: 7.75, d: 17.4, variant: 'archi-4-pergola' });
  // the north side of the plaza: the café block, then an arcade
  b.scenic('blocco', 19.4, -8, { w: 8.5, d: 7.75, variant: 'negozi-4-giardino' });
  b.scenic('blocco', 28, -8, { w: 10, d: 7.75, variant: 'archi-4-piante' });
  // a second row of lower blocks towards the canal
  b.scenic('blocco', -16, -18, { w: 10, d: 8, variant: 'vetro-4-pergola' });
  b.scenic('blocco', -5, -18, { w: 10, d: 8, variant: 'negozi-3-giardino' });
  b.scenic('blocco', 6, -18, { w: 10, d: 8, variant: 'archi-3-piante' });
  // the west side: the clock tower
  b.scenic('campanile', -9, 18.5, { w: 8, d: 11 });
  // glass towers beyond, rooftop pools
  b.scenic('torre', -27, -8, { w: 12, d: 11, variant: '14-piscina' });
  b.scenic('torre', -27, -25, { w: 10, d: 12, variant: '18-tecnico' });
  b.scenic('torre', -25, 5, { w: 11, d: 11, variant: '10-terrazza' });
  b.scenic('torre', -21, -38, { w: 9, d: 9, variant: '20-piscina' });
  b.scenic('torre', -6, -46, { w: 10, d: 10, variant: '22-tecnico' });

  // the canal: its edge, palms on the promenade, the monorail over the water
  b.scenic('bordoCanale', -8, -20, { w: 18 });
  for (const x of [-11, -7, -3, 1, 5, 9, 13]) b.scenic('palma', x, -19, { variant: 'libera' });
  for (const y of [-34, -30, -22]) b.scenic('palma', -11, y, { variant: 'libera' });
  b.scenic('monorotaia', -22, -26, { w: 38 });

  // the café under the arcade block: tables under parasols, planters
  for (const [x, y] of [[20, 1], [22, 2], [24, 1], [26, 2], [21, 4], [23, 5], [25, 4], [27, 5]] as const) b.scenic('tavoloM', x, y);
  for (const x of [20, 25]) b.scenic('vasoQ', x, 7, { w: 2 });
  // the square fountain with benches facing it
  b.scenic('fontanaQ', 21, 9, { w: 4, d: 4 });
  b.scenic('pancaM', 22, 7, { w: 2 });
  b.scenic('pancaM', 26, 10, { w: 2, rot: 1 });
  b.scenic('pancaM', 21, 14, { w: 2 });
  b.scenic('pancaM', 19, 9, { w: 2, rot: 1 });
  // the market in front of the studio
  const stalls = ['rosa', 'rossa', 'blu', 'rossa', 'rosa'];
  stalls.forEach((v, i) => b.scenic('bancarellaM', 1 + i * 3, 19, { w: 2, variant: v }));
  // the ring sculpture between two bocce lawns
  b.scenic('prato', 16, 19, { w: 3, d: 2 });
  b.scenic('scultura', 20, 19, { w: 2, d: 2 });
  b.scenic('prato', 23, 19, { w: 3, d: 2 });
  // the kiosk
  b.scenic('chioscoM', 27, 15, { w: 2, d: 2 });
  // palms in stone planters across the plaza, planters, modern light poles
  for (const [x, y] of [[3, 26], [8, 26], [13, 26], [18, 26], [23, 26], [28, 26], [32, 3], [32, 8], [32, 13], [32, 18], [32, 23], [6, 22], [12, 22], [28, 11], [36, 5], [36, 13], [36, 21], [36, 28]] as const)
    b.scenic('palma', x, y, { variant: 'vaso' });
  for (const [x, y] of [[2, 16], [6, 16], [10, 16], [14, 16]] as const) b.scenic('vasoQ', x, y, { w: 2 });
  for (const [x, y, w, d] of [[17, 23, 2, 1], [25, 23, 2, 1], [34, 10, 1, 2], [34, 17, 1, 2], [1, 28, 3, 1], [15, 28, 3, 1], [26, 29, 3, 1]] as const) b.scenic('vasoQ', x, y, { w, d });
  for (const [x, y] of [[18, 3], [29, 10], [16, 22], [27, 22], [2, 23], [8, 16], [19, 15], [12, 16], [24, 16], [34, 6], [34, 14], [34, 24], [5, 29], [11, 29], [20, 29], [30, 29]] as const) b.scenic('palo', x, y);
  // the boulevard: bus shelters and the tram on the near carriageway, palms and flower beds on the median
  b.scenic('pensilinaM', 4, 30, { w: 3 });
  b.scenic('pensilinaM', 13, 30, { w: 3 });
  for (let x = -16; x < 38; x += 6) {
    b.scenic('palma', x, 35, { variant: 'vaso' });
    b.scenic('vasoQ', x + 1, 35, { w: 4, d: 2 });
    b.scenic('palo', x + 5, 36);
  }
  for (let y = -16; y < 31; y += 6) {
    b.scenic('palma', 43, y, { variant: 'vaso' });
    b.scenic('vasoQ', 43, y + 1, { w: 2, d: 4 });
  }
  // lane markings
  for (let x = -40; x < 48; x += 8) {
    b.decor('decal', x, 33, { variant: 'corsia', w: 8 });
    b.decor('decal', x, 38, { variant: 'corsia', w: 8 });
  }
  for (let y = -40; y < 40; y += 8) {
    b.decor('decal', 41, y, { variant: 'corsia', w: 8, rot: 1 });
    b.decor('decal', 46, y, { variant: 'corsia', w: 8, rot: 1 });
  }
  // manhole covers here and there
  const hash = (a: number, c: number) => {
    let h = Math.imul(a * 374761393 + c * 668265263, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  for (let y = -1; y < 31; y++)
    for (let x = -1; x < 39; x++) {
      if (x < C + 2 && y < R + 2) continue;
      if (hash(x, y) < 0.01) b.decor('decal', x, y, { variant: 'tombino' });
    }

  // the tram runs the boulevard and stops at both shelters; the monorail crosses over the canal
  // (both lines run on past the frame, where they wait before coming back)
  b.vehicle({ type: 'tramM', x: -14, y: 32, axis: 'x', length: 76, w: 7, speed: 1.6, stops: [16, 25], dwell: 5, endWait: 8 });
  b.vehicle({ type: 'trenoM', x: -34, y: -26, axis: 'x', length: 54, w: 8, speed: 2.6, endWait: 6, phase: 9 });
  // passers-by: round the café and the fountain, along the market, the boulevard, the avenue and the canal
  b.walkers([[17.6, 0.6], [30.5, 0.6], [30.5, 17.9], [17.6, 17.9]], 2, { loop: true });
  b.walkers([[-0.4, 18.1], [15.6, 18.1], [15.6, 21.5], [-0.4, 21.5]], 1, { loop: true });
  b.walkers([[-4, 31.5], [39.5, 31.5], [39.5, -14]], 2);
  b.walkers([[5, 41.6], [31, 41.6]], 1, { speed: 0.6 });
  b.walkers([[-9.4, -21], [-9.4, -33.5], [11.5, -33.5], [11.5, -21]], 1, { speed: 0.45 });

  // life: pigeons round the fountain and the market, a cat by the clock tower
  b.critters('pigeon', 19, 8, 9, 8, 9);
  b.critters('pigeon', 2, 21, 12, 3, 5);
  b.critters('pigeon', -6, -19, 12, 1, 4);
  b.critters('cat', 0.2, 22, 0.6, 2, 1);
}

officeCity(b);
decorateWalls(b);

export const office = b.build({
  name: 'Office',
  description: 'A warm open-plan studio: eight desks, a meeting table, a coffee corner and a lounge.',
  tagline: 'Build, plan and get things done together.',
  emoji: '🗂️',
  theme: {
    floorA: '#c99a6b',
    floorB: '#bd8e60',
    floorDetail: '#a87a50',
    wall: '#efe3cf',
    wallTrim: '#8a6a4f',
    slab: '#6b4a34',
    accent: '#3fb68b',
    accent2: '#e2553b',
    ui: '#f2b98a',
    sky: ['#2a2140', '#c9785a'],
  },
  outfitCategory: 'office',
  defaultOutfitId: 'office.tech_casual',
  environment: { floor: 'wood', outdoor: false, backdrop: 'walls', tile: 128 },
  tasks: [
    'Draft Q3 report',
    'Triage support inbox',
    'Refactor onboarding flow',
    'Review pull request',
    'Prepare client deck',
    'Update CRM records',
    'Write API docs',
    'Plan sprint backlog',
    'Summarize meeting notes',
    'Fix flaky test',
  ],
});
